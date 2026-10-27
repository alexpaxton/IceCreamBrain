/** Base flavor style; drives default PAC/macro targets and checks. */
export type StyleId = 'philadelphia' | 'custard' | 'sherbet' | 'sorbet';

/**
 * Macro breakdown for a single ingredient, expressed as percentages of
 * total weight (water/fat/sugars/starch/protein/otherSolids sum to ~100).
 */
export interface IngredientMacros {
  id: string; // slug, e.g. "cream-heavy"
  name: string;
  water: number;
  fat: number;
  sugars: number;
  starch: number;
  protein: number;
  otherSolids: number; // percentages, sum ~100
  source?: string;
  isDairy?: boolean; // drives MSNF attribution
  isEggYolk?: boolean; // drives custard egg-yolk check
  sugarComposition?: Record<string, number>; // PAC-table key -> fraction of this ingredient's sugars; default {sucrose: 1}
  userAdded?: boolean;
}

/** One ingredient's share of a base blend. */
export interface BaseComponent {
  ingredientId: string;
  pct: number; // pct of base, sum 100
}

/** A named, reusable base blend saved by the user. */
export interface SavedBase {
  id: string;
  name: string;
  components: BaseComponent[];
}

/** Discriminated union of all node payload shapes on the composer canvas. */
export type NodeData =
  | { kind: 'style'; style: StyleId }
  | { kind: 'sweetener'; totalPct: number; split: { pacKey: string; pct: number }[] } // split sums to 100
  | { kind: 'base'; baseId: string | null; components: BaseComponent[] }
  | { kind: 'servingTemp'; value: number; unit: 'F' | 'C' }
  | { kind: 'output'; grams: number; recipeName: string }
  | { kind: 'flavoring'; ingredientId: string | null; pct: number }
  | { kind: 'ingredient'; ingredientId: string | null; pct: number }
  | { kind: 'pacCheck' }
  | { kind: 'macroCheck' };

/** Serializable react-flow node, trimmed to what Composer persists. */
export interface PersistedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  deletable?: boolean;
  hidden?: boolean;
}

/** Serializable react-flow edge, trimmed to what Composer persists. */
export interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  deletable?: boolean;
  hidden?: boolean;
}

/** Full persisted canvas document: everything needed to rebuild the graph. */
export interface ComposerDoc {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}

// ---------------------------------------------------------------------------
// PAC engine (src/lib/composer/pac/)
// ---------------------------------------------------------------------------

/**
 * Composition of a sweetener/ingredient preset: mass fractions of sugars
 * (keyed by PAC-table entry), water, and MSNF. Mirrors pac_calculator.py PRESETS.
 */
export interface SweetenerPreset {
  sugars: Record<string, number>;
  water: number;
  msnf: number;
}

/** One recipe line prepared for PAC math: net sugar grams per PAC-table key. */
export interface PacLine {
  name: string;
  grams: number;
  pacContributions: Record<string, number>; // PAC-table key -> net grams
  waterGrams: number;
  msnfGrams: number;
}

/** One (ingredient, sugar) row of the PAC breakdown. */
export interface PacBreakdownRow {
  ingredient: string;
  grams: number;
  sugar: string;
  netGrams: number;
  contribution: number;
}

/** Inclusive [low, high] target range. */
export type Range = [number, number];

/** Full output of analyzePac, mirroring pac_calculator.py main(). */
export interface PacAnalysis {
  totalGrams: number;
  waterPct: number;
  tsPct: number;
  msnfPct: number;
  pac: number;
  pacn: number; // normalised PAC (pac / water fraction)
  breakdown: PacBreakdownRow[];
  freezingPointC: number | null; // null when no water
  iceFraction: number | null; // null when serve temp is above FP
  pctWaterFrozen: number | null;
  servingTempEstC: number; // -(pac/2) gelato, -(pac/2.5) sorbet
  serveTempC: number;
  targets: { pac: Range; freezingPointC: Range; pctWaterFrozen: Range };
  inRange: { pac: boolean; freezingPointC: boolean | null; pctWaterFrozen: boolean | null };
}

// ---------------------------------------------------------------------------
// Macro engine (macros.ts / standards.ts)
// ---------------------------------------------------------------------------

export type MacroKey = 'water' | 'fat' | 'sugars' | 'starch' | 'protein' | 'otherSolids';

/** Totals across all resolved lines, in grams and as % of total weight. */
export interface MacroTotals {
  grams: Record<MacroKey, number>;
  pct: Record<MacroKey, number>;
  totalGrams: number;
}

/** min / ideal band / max, all as % of total recipe weight. */
export interface Band {
  min: number;
  idealLow: number;
  idealHigh: number;
  max: number;
}

export type BookMacro = 'butterfat' | 'sugar' | 'eggYolk' | 'msnf' | 'water';

/** Style standard from the Dana Cree functional-ratio charts. */
export interface StyleStandard {
  rows: { macro: BookMacro; band: Band }[];
  addedSugarOnly?: boolean; // sherbet: compare sweetener-node sugars only
  sourceNote?: string; // sorbet: web-sourced ranges, not from the book
}

export type MacroCheckStatus = 'ideal' | 'ok' | 'low' | 'high' | 'info';

/** One row of the Macro | Standard | % check table. */
export interface MacroCheckRow {
  label: string;
  band: Band | null; // null for the Other row
  pct: number;
  status: MacroCheckStatus;
}

export interface MacroCheckResult {
  rows: MacroCheckRow[]; // pct column sums to 100
  sourceNote?: string;
}

// ---------------------------------------------------------------------------
// Graph resolution (resolve.ts)
// ---------------------------------------------------------------------------

/** One resolved recipe line with concrete grams at the chosen output size. */
export interface ResolvedLine {
  ingredientId: string;
  name: string;
  pct: number; // % of total recipe
  grams: number; // pct/100 * outputGrams
  macros: IngredientMacros;
  pacLine: PacLine;
  role: 'base' | 'sweetener' | 'ingredient' | 'flavoring';
}

export interface Issue {
  severity: 'warning' | 'error';
  message: string;
  nodeId?: string;
}

/** The generated recipe: everything downstream consumers need. */
export interface RecipeModel {
  name: string;
  style: StyleId;
  serveTempC: number;
  outputGrams: number;
  lines: ResolvedLine[]; // ordered: base, ingredients, sweeteners, flavorings
  addedSugarGrams: number; // sugars contributed by the sweetener node
  dairyFree: boolean;
}

export interface ResolveResult {
  recipe: RecipeModel | null; // null if fatally incomplete
  issues: Issue[];
  /** Per-macroCheck-node contributor sets (playground checks included). */
  checks: Record<string, ResolvedLine[]>;
}

// ---------------------------------------------------------------------------
// Derived state consumed by the UI (computed in ComposerPage)
// ---------------------------------------------------------------------------

export interface Derived {
  recipe: RecipeModel | null;
  issues: Issue[];
  pac: PacAnalysis | null;
  /** MacroCheckResult per macroCheck node id (main check and playground checks). */
  macroChecks: Record<string, MacroCheckResult>;
  markdown: string;
}
