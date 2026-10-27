import type { IngredientDb } from './ingredientDb';
import type {
  ComposerDoc,
  IngredientMacros,
  Issue,
  NodeData,
  PacLine,
  PersistedNode,
  RecipeModel,
  ResolvedLine,
  ResolveResult,
  StyleId,
  SweetenerPreset,
} from './types';

const PCT_TOLERANCE = 0.5;

type StyleData = Extract<NodeData, { kind: 'style' }>;
type SweetenerData = Extract<NodeData, { kind: 'sweetener' }>;
type BaseData = Extract<NodeData, { kind: 'base' }>;
type ServingTempData = Extract<NodeData, { kind: 'servingTemp' }>;
type OutputData = Extract<NodeData, { kind: 'output' }>;
type UserNodeData = Extract<NodeData, { kind: 'ingredient' | 'flavoring' }>;

/** Prettifies a PAC-table key, e.g. 'glucose_syrup_de42' -> 'Glucose syrup DE42'. */
function prettifyKey(key: string): string {
  const words = key.split('_').map((word) => (/^de\d+$/i.test(word) ? word.toUpperCase() : word));
  const joined = words.join(' ');
  return joined.length > 0 ? joined.charAt(0).toUpperCase() + joined.slice(1) : joined;
}

/** PacLine for a sweetener-node line, built directly from the preset (mirrors the Python preset path). */
function buildSweetenerPacLine(name: string, grams: number, preset: SweetenerPreset): PacLine {
  const pacContributions: Record<string, number> = {};
  for (const [key, fraction] of Object.entries(preset.sugars)) {
    pacContributions[key] = grams * fraction;
  }
  return {
    name,
    grams,
    pacContributions,
    waterGrams: grams * preset.water,
    msnfGrams: grams * preset.msnf,
  };
}

/** PacLine for a macro-based line (base/ingredient/flavoring). */
function buildIngredientPacLine(grams: number, macros: IngredientMacros): PacLine {
  const sugarGrams = (grams * macros.sugars) / 100;
  const composition = macros.sugarComposition ?? { sucrose: 1 };
  const pacContributions: Record<string, number> = {};
  for (const [key, fraction] of Object.entries(composition)) {
    pacContributions[key] = sugarGrams * fraction;
  }
  const waterGrams = (grams * macros.water) / 100;
  const msnfGrams = macros.isDairy
    ? (grams * (macros.protein + macros.sugars + macros.otherSolids)) / 100
    : 0;
  return { name: macros.name, grams, pacContributions, waterGrams, msnfGrams };
}

/** Builds a directed adjacency list from persisted edges, skipping hidden edges. */
function buildAdjacency(doc: ComposerDoc): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.hidden) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }
  return adjacency;
}

/** All node ids reachable from `startId` by following directed edges, excluding startId itself. */
function reachableFrom(startId: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const stack = [...(adjacency.get(startId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) stack.push(next);
    }
  }
  return visited;
}

/**
 * Turns a persisted composer graph into a concrete RecipeModel: locates the
 * core singleton nodes, walks connectivity for ingredient/flavoring nodes,
 * and computes % and gram lines for base/sweetener/ingredient/flavoring.
 */
export function resolveGraph(
  doc: ComposerDoc,
  db: IngredientDb,
  presets: Record<string, SweetenerPreset>,
): ResolveResult {
  const issues: Issue[] = [];

  const styleNode = doc.nodes.find((n) => n.data.kind === 'style');
  const sweetenerNode = doc.nodes.find((n) => n.data.kind === 'sweetener');
  const baseNode = doc.nodes.find((n) => n.data.kind === 'base');
  const servingTempNode = doc.nodes.find((n) => n.data.kind === 'servingTemp');
  const outputNode = doc.nodes.find((n) => n.data.kind === 'output');

  if (!outputNode || !styleNode) {
    issues.push({ severity: 'error', message: 'Recipe is missing a required output or style node.' });
    return { recipe: null, issues, checks: {} };
  }

  const style: StyleId = (styleNode.data as StyleData).style;
  const outputData = outputNode.data as OutputData;
  const outputGrams = outputData.grams;
  const recipeName = outputData.recipeName;

  let serveTempC = 0;
  if (servingTempNode) {
    const servingData = servingTempNode.data as ServingTempData;
    serveTempC = servingData.unit === 'F' ? ((servingData.value - 32) * 5) / 9 : servingData.value;
  }

  const adjacency = buildAdjacency(doc);
  const outputReachable = reachableFrom(outputNode.id, adjacency);

  const userNodes: PersistedNode[] = doc.nodes.filter(
    (n) => n.data.kind === 'ingredient' || n.data.kind === 'flavoring',
  );
  const connectedToOutput = userNodes.filter((n) =>
    reachableFrom(n.id, adjacency).has(outputNode.id),
  );

  // -------------------------------------------------------------------------
  // Sweetener lines
  // -------------------------------------------------------------------------
  const sweetenerLines: ResolvedLine[] = [];
  let sweetenerTotalPct = 0;
  if (sweetenerNode) {
    const sweetenerData = sweetenerNode.data as SweetenerData;
    sweetenerTotalPct = sweetenerData.totalPct;

    const splitSum = sweetenerData.split.reduce((sum, entry) => sum + entry.pct, 0);
    if (sweetenerData.split.length > 0 && Math.abs(splitSum - 100) > PCT_TOLERANCE) {
      issues.push({
        severity: 'warning',
        message: `Sweetener split percentages sum to ${splitSum}, expected 100.`,
        nodeId: sweetenerNode.id,
      });
    }

    for (const entry of sweetenerData.split) {
      const preset = presets[entry.pacKey];
      if (!preset) {
        issues.push({
          severity: 'error',
          message: `Unknown sweetener preset "${entry.pacKey}".`,
          nodeId: sweetenerNode.id,
        });
        continue;
      }

      const pct = (sweetenerTotalPct * entry.pct) / 100;
      const grams = (pct / 100) * outputGrams;
      const sugarsPct = Object.values(preset.sugars).reduce((sum, fraction) => sum + fraction, 0) * 100;
      const waterPct = preset.water * 100;
      const otherSolidsPct = Math.max(0, 100 - waterPct - sugarsPct);
      const name = prettifyKey(entry.pacKey);

      const macros: IngredientMacros = {
        id: `sweetener:${entry.pacKey}`,
        name,
        water: waterPct,
        fat: 0,
        sugars: sugarsPct,
        starch: 0,
        protein: 0,
        otherSolids: otherSolidsPct,
        sugarComposition: preset.sugars,
      };

      sweetenerLines.push({
        ingredientId: macros.id,
        name,
        pct,
        grams,
        macros,
        pacLine: buildSweetenerPacLine(name, grams, preset),
        role: 'sweetener',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Connected ingredient / flavoring lines
  // -------------------------------------------------------------------------
  const ingredientLines: ResolvedLine[] = [];
  const flavoringLines: ResolvedLine[] = [];
  let connectedPctSum = 0;

  for (const node of connectedToOutput) {
    const data = node.data as UserNodeData;
    if (!data.ingredientId || !db.byId.has(data.ingredientId)) {
      issues.push({
        severity: 'warning',
        message: 'Ingredient node references an unknown ingredient.',
        nodeId: node.id,
      });
      continue;
    }

    const macros = db.byId.get(data.ingredientId)!;
    const pct = data.pct;
    connectedPctSum += pct;
    const grams = (pct / 100) * outputGrams;

    const line: ResolvedLine = {
      ingredientId: macros.id,
      name: macros.name,
      pct,
      grams,
      macros,
      pacLine: buildIngredientPacLine(grams, macros),
      role: data.kind === 'flavoring' ? 'flavoring' : 'ingredient',
    };

    if (data.kind === 'flavoring') flavoringLines.push(line);
    else ingredientLines.push(line);
  }

  // -------------------------------------------------------------------------
  // Base lines
  // -------------------------------------------------------------------------
  const baseLines: ResolvedLine[] = [];

  if (style === 'sorbet') {
    const declaredTotal = sweetenerTotalPct + connectedPctSum;
    if (Math.abs(declaredTotal - 100) > PCT_TOLERANCE) {
      const verb = declaredTotal < 100 ? 'unallocated' : 'over-allocated';
      issues.push({
        severity: 'warning',
        message: `Sorbet recipe is ${verb}: declared percentages sum to ${declaredTotal.toFixed(1)}%, expected 100%.`,
      });
    }
  } else {
    const basePctRaw = 100 - sweetenerTotalPct - connectedPctSum;
    let basePct = basePctRaw;
    if (basePctRaw < 0) {
      issues.push({
        severity: 'error',
        message: `Base percentage is negative (${basePctRaw.toFixed(1)}%): sweetener and ingredients exceed 100% of the recipe.`,
        nodeId: baseNode?.id,
      });
      basePct = 0;
    }

    if (baseNode) {
      const baseData = baseNode.data as BaseData;
      const componentSum = baseData.components.reduce((sum, c) => sum + c.pct, 0);
      if (baseData.components.length > 0 && Math.abs(componentSum - 100) > PCT_TOLERANCE) {
        issues.push({
          severity: 'warning',
          message: `Base component percentages sum to ${componentSum}, expected 100.`,
          nodeId: baseNode.id,
        });
      }

      for (const component of baseData.components) {
        const macros = db.byId.get(component.ingredientId);
        if (!macros) {
          issues.push({
            severity: 'warning',
            message: 'Base component references an unknown ingredient.',
            nodeId: baseNode.id,
          });
          continue;
        }

        const pct = (basePct * component.pct) / 100;
        const grams = (pct / 100) * outputGrams;

        baseLines.push({
          ingredientId: macros.id,
          name: macros.name,
          pct,
          grams,
          macros,
          pacLine: buildIngredientPacLine(grams, macros),
          role: 'base',
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assemble recipe
  // -------------------------------------------------------------------------
  const lines: ResolvedLine[] = [...baseLines, ...ingredientLines, ...sweetenerLines, ...flavoringLines];

  const addedSugarGrams = sweetenerLines.reduce(
    (sum, line) =>
      sum + Object.values(line.pacLine.pacContributions).reduce((a, b) => a + b, 0),
    0,
  );

  const dairyFree = !lines.some((line) => line.macros.isDairy);

  const recipe: RecipeModel = {
    name: recipeName,
    style,
    serveTempC,
    outputGrams,
    lines,
    addedSugarGrams,
    dairyFree,
  };

  // -------------------------------------------------------------------------
  // Macro-check contributor sets
  // -------------------------------------------------------------------------
  const macroCheckNodes = doc.nodes.filter((n) => n.data.kind === 'macroCheck');
  const checks: Record<string, ResolvedLine[]> = {};
  const NOMINAL_GRAMS = 1000;

  for (const checkNode of macroCheckNodes) {
    if (outputReachable.has(checkNode.id)) {
      checks[checkNode.id] = lines;
      continue;
    }

    const contributors = userNodes.filter((n) =>
      reachableFrom(n.id, adjacency).has(checkNode.id),
    );

    const validContributors: { node: PersistedNode; data: UserNodeData; macros: IngredientMacros }[] = [];
    for (const node of contributors) {
      const data = node.data as UserNodeData;
      if (!data.ingredientId || !db.byId.has(data.ingredientId)) continue;
      validContributors.push({ node, data, macros: db.byId.get(data.ingredientId)! });
    }

    const pctSum = validContributors.reduce((sum, c) => sum + c.data.pct, 0);

    checks[checkNode.id] = validContributors.map(({ data, macros }) => {
      const pct = pctSum > 0 ? (data.pct / pctSum) * 100 : 0;
      const grams = (pct / 100) * NOMINAL_GRAMS;
      return {
        ingredientId: macros.id,
        name: macros.name,
        pct,
        grams,
        macros,
        pacLine: buildIngredientPacLine(grams, macros),
        role: data.kind === 'flavoring' ? 'flavoring' : 'ingredient',
      };
    });
  }

  return { recipe, issues, checks };
}
