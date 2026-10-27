import { describe, expect, it } from 'vitest';
import { resolveGraph } from '../resolve';
import { buildIngredientDb } from '../ingredientDb';
import { checkMacros } from '../standards';
import type { ComposerDoc, PersistedEdge, PersistedNode, SweetenerPreset } from '../types';

const db = buildIngredientDb([]);

const presets: Record<string, SweetenerPreset> = {
  sucrose: { sugars: { sucrose: 1 }, water: 0, msnf: 0 },
  honey: { sugars: { honey: 0.79 }, water: 0.21, msnf: 0 },
};

function node(id: string, data: PersistedNode['data'], extra: Partial<PersistedNode> = {}): PersistedNode {
  return { id, type: data.kind, position: { x: 0, y: 0 }, data, ...extra };
}

function edge(id: string, source: string, target: string, extra: Partial<PersistedEdge> = {}): PersistedEdge {
  return { id, source, target, ...extra };
}

describe('resolveGraph', () => {
  it('computes base remainder math from sweetener + connected ingredient pcts', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('sw1', { kind: 'sweetener', totalPct: 20, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [
            { ingredientId: 'cream-fluid-heavy-whipping', pct: 60 },
            { ingredientId: 'milk-whole-3-25-milkfat', pct: 40 },
          ],
        }),
        node('temp1', { kind: 'servingTemp', value: -12, unit: 'C' }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Test Philly' }),
      ],
      edges: [],
    };

    const result = resolveGraph(doc, db, presets);
    expect(result.recipe).not.toBeNull();
    const recipe = result.recipe!;

    expect(recipe.lines.map((l) => l.role)).toEqual(['base', 'base', 'sweetener']);

    const cream = recipe.lines.find((l) => l.ingredientId === 'cream-fluid-heavy-whipping')!;
    const milk = recipe.lines.find((l) => l.ingredientId === 'milk-whole-3-25-milkfat')!;
    const sweetener = recipe.lines.find((l) => l.role === 'sweetener')!;

    expect(cream.pct).toBeCloseTo(48, 5); // 80% base * 60%
    expect(cream.grams).toBeCloseTo(480, 5);
    expect(milk.pct).toBeCloseTo(32, 5); // 80% base * 40%
    expect(sweetener.pct).toBeCloseTo(20, 5);

    const pctSum = recipe.lines.reduce((sum, l) => sum + l.pct, 0);
    expect(pctSum).toBeCloseTo(100, 5);
  });

  it('sorbet ignores the base node and warns when declared pcts are unallocated', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'sorbet' }),
        node('sw1', { kind: 'sweetener', totalPct: 30, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [{ ingredientId: 'cream-fluid-heavy-whipping', pct: 100 }],
        }),
        node('mango1', { kind: 'ingredient', ingredientId: 'ataulfo-mango-ripe', pct: 50 }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Mango Sorbet' }),
      ],
      edges: [edge('e1', 'mango1', 'out1')],
    };

    const result = resolveGraph(doc, db, presets);
    expect(result.recipe).not.toBeNull();
    const recipe = result.recipe!;

    expect(recipe.lines.some((l) => l.role === 'base')).toBe(false);
    expect(
      result.issues.some((i) => i.severity === 'warning' && /unallocated/i.test(i.message)),
    ).toBe(true);
  });

  it('clamps a negative base pct to 0 and emits an error', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('sw1', { kind: 'sweetener', totalPct: 60, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [{ ingredientId: 'cream-fluid-heavy-whipping', pct: 100 }],
        }),
        node('fruit1', { kind: 'ingredient', ingredientId: 'ataulfo-mango-ripe', pct: 50 }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Overloaded' }),
      ],
      edges: [edge('e1', 'fruit1', 'out1')],
    };

    const result = resolveGraph(doc, db, presets);
    expect(result.recipe).not.toBeNull();
    const recipe = result.recipe!;

    expect(result.issues.some((i) => i.severity === 'error' && /negative/i.test(i.message))).toBe(
      true,
    );
    const baseLine = recipe.lines.find((l) => l.role === 'base')!;
    expect(baseLine.pct).toBe(0);
    expect(baseLine.grams).toBe(0);
  });

  it('normalizes a playground macroCheck contributor set to sum to 100', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Playground' }),
        node('a1', { kind: 'ingredient', ingredientId: 'cream-fluid-heavy-whipping', pct: 30 }),
        node('b1', { kind: 'ingredient', ingredientId: 'milk-whole-3-25-milkfat', pct: 30 }),
        node('check1', { kind: 'macroCheck' }),
      ],
      edges: [edge('e1', 'a1', 'check1'), edge('e2', 'b1', 'check1')],
    };

    const result = resolveGraph(doc, db, presets);
    const contributors = result.checks.check1;
    expect(contributors).toHaveLength(2);

    const pctSum = contributors.reduce((sum, l) => sum + l.pct, 0);
    expect(pctSum).toBeCloseTo(100, 5);
    for (const line of contributors) {
      expect(line.pct).toBeCloseTo(50, 5);
      expect(line.grams).toBeCloseTo(500, 5);
    }

    // a1/b1 never reach the output node, so they're excluded from the recipe itself.
    expect(result.recipe!.lines.some((l) => l.ingredientId === 'cream-fluid-heavy-whipping')).toBe(
      false,
    );
  });

  it('excludes a fully disconnected user node from the recipe and from checks', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Isolated' }),
        node('isolated1', { kind: 'ingredient', ingredientId: 'cream-fluid-heavy-whipping', pct: 40 }),
        node('check1', { kind: 'macroCheck' }),
      ],
      edges: [],
    };

    const result = resolveGraph(doc, db, presets);
    expect(result.recipe!.lines.some((l) => l.ingredientId === 'cream-fluid-heavy-whipping')).toBe(
      false,
    );
    expect(result.checks.check1).toEqual([]);
  });

  it('converts serving temperature from Fahrenheit to Celsius', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('temp1', { kind: 'servingTemp', value: 14, unit: 'F' }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Temp Test' }),
      ],
      edges: [],
    };

    const result = resolveGraph(doc, db, presets);
    expect(result.recipe!.serveTempC).toBeCloseTo(-10, 5);
  });

  it('flags dairyFree true/false based on isDairy lines', () => {
    const dairyDoc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'philadelphia' }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [{ ingredientId: 'cream-fluid-heavy-whipping', pct: 100 }],
        }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Dairy' }),
      ],
      edges: [],
    };
    const dairyResult = resolveGraph(dairyDoc, db, presets);
    expect(dairyResult.recipe!.dairyFree).toBe(false);

    const nonDairyDoc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'sorbet' }),
        node('sw1', { kind: 'sweetener', totalPct: 30, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('mango1', { kind: 'ingredient', ingredientId: 'ataulfo-mango-ripe', pct: 70 }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Sorbet' }),
      ],
      edges: [edge('e1', 'mango1', 'out1')],
    };
    const nonDairyResult = resolveGraph(nonDairyDoc, db, presets);
    expect(nonDairyResult.recipe!.dairyFree).toBe(true);
  });

  it('missing output or style node yields recipe: null with an error issue', () => {
    const doc: ComposerDoc = {
      nodes: [node('out1', { kind: 'output', grams: 1000, recipeName: 'No Style' })],
      edges: [],
    };
    const result = resolveGraph(doc, db, presets);
    expect(result.recipe).toBeNull();
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('custard with zero yolk grams flags the Egg yolk row as low via checkMacros', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'custard' }),
        node('sw1', { kind: 'sweetener', totalPct: 18, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [
            { ingredientId: 'cream-fluid-heavy-whipping', pct: 60 },
            { ingredientId: 'milk-whole-3-25-milkfat', pct: 40 },
          ],
        }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'No-yolk custard' }),
      ],
      edges: [],
    };
    const result = resolveGraph(doc, db, presets);
    const recipe = result.recipe!;
    const macroCheck = checkMacros({
      lines: recipe.lines,
      style: 'custard',
      addedSugarGrams: recipe.addedSugarGrams,
    });
    const eggRow = macroCheck.rows.find((r) => r.label === 'Egg yolk')!;
    expect(eggRow.pct).toBe(0);
    expect(eggRow.status).toBe('low');
  });

  it('sherbet: added-sugar row reflects only the sweetener node, dairy lactose lands in MSNF', () => {
    const doc: ComposerDoc = {
      nodes: [
        node('style1', { kind: 'style', style: 'sherbet' }),
        node('sw1', { kind: 'sweetener', totalPct: 25, split: [{ pacKey: 'sucrose', pct: 100 }] }),
        node('base1', {
          kind: 'base',
          baseId: null,
          components: [{ ingredientId: 'milk-whole-3-25-milkfat', pct: 100 }],
        }),
        node('mango1', { kind: 'ingredient', ingredientId: 'ataulfo-mango-ripe', pct: 20 }),
        node('out1', { kind: 'output', grams: 1000, recipeName: 'Mango Sherbet' }),
      ],
      edges: [edge('e1', 'mango1', 'out1')],
    };

    const result = resolveGraph(doc, db, presets);
    const recipe = result.recipe!;
    expect(recipe.addedSugarGrams).toBeCloseTo(250, 5); // 25% of 1000g, pure sucrose

    const macroCheck = checkMacros({
      lines: recipe.lines,
      style: 'sherbet',
      addedSugarGrams: recipe.addedSugarGrams,
    });

    const sugarRow = macroCheck.rows.find((r) => r.label === 'Sugar')!;
    expect(sugarRow.pct).toBeCloseTo((recipe.addedSugarGrams / recipe.outputGrams) * 100, 5);

    const msnfRow = macroCheck.rows.find((r) => r.label === 'MSNF')!;
    expect(msnfRow.pct).toBeGreaterThan(0);

    const otherRow = macroCheck.rows.find((r) => r.label === 'Other')!;
    // mango's non-added sugar (not from the sweetener node) should land in Other, not Sugar.
    expect(otherRow.pct).toBeGreaterThan(0);

    const total = macroCheck.rows.reduce((sum, r) => sum + r.pct, 0);
    expect(total).toBeCloseTo(100, 5);
  });
});
