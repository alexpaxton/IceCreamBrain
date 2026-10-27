import { describe, expect, it } from 'vitest';
import { STANDARDS, checkMacros } from '../standards';
import type { Band, BookMacro, IngredientMacros, ResolvedLine, StyleStandard } from '../types';

function band(standard: StyleStandard, macro: BookMacro): Band {
  const found = standard.rows.find((row) => row.macro === macro);
  if (!found) throw new Error(`Missing ${macro} row`);
  return found.band;
}

describe('STANDARDS literal bands', () => {
  it('custard', () => {
    const s = STANDARDS.custard;
    expect(band(s, 'butterfat')).toEqual({ min: 10, idealLow: 11, idealHigh: 12, max: 14 });
    expect(band(s, 'sugar')).toEqual({ min: 15, idealLow: 17, idealHigh: 19, max: 22 });
    expect(band(s, 'eggYolk')).toEqual({ min: 5, idealLow: 9, idealHigh: 12, max: 15 });
    expect(band(s, 'msnf')).toEqual({ min: 5, idealLow: 6, idealHigh: 8, max: 10 });
    expect(band(s, 'water')).toEqual({ min: 45, idealLow: 54, idealHigh: 57, max: 60 });
  });

  it('philadelphia', () => {
    const s = STANDARDS.philadelphia;
    expect(band(s, 'butterfat')).toEqual({ min: 12, idealLow: 15, idealHigh: 18, max: 20 });
    expect(band(s, 'sugar')).toEqual({ min: 15, idealLow: 17, idealHigh: 19, max: 22 });
    expect(band(s, 'msnf')).toEqual({ min: 6, idealLow: 8, idealHigh: 10, max: 12 });
    expect(band(s, 'water')).toEqual({ min: 50, idealLow: 54, idealHigh: 57, max: 60 });
    expect(s.rows.some((r) => r.macro === 'eggYolk')).toBe(false);
  });

  it('sherbet', () => {
    const s = STANDARDS.sherbet;
    expect(band(s, 'butterfat')).toEqual({ min: 2, idealLow: 3, idealHigh: 4, max: 6 });
    expect(band(s, 'sugar')).toEqual({ min: 20, idealLow: 23, idealHigh: 25, max: 27 });
    expect(band(s, 'msnf')).toEqual({ min: 2, idealLow: 3, idealHigh: 4, max: 5 });
    expect(band(s, 'water')).toEqual({ min: 50, idealLow: 54, idealHigh: 57, max: 60 });
    expect(s.addedSugarOnly).toBe(true);
  });

  it('frozen-yogurt', () => {
    const s = STANDARDS['frozen-yogurt'];
    expect(band(s, 'butterfat')).toEqual({ min: 5, idealLow: 7, idealHigh: 8, max: 10 });
    expect(band(s, 'sugar')).toEqual({ min: 20, idealLow: 23, idealHigh: 25, max: 27 });
    expect(band(s, 'msnf')).toEqual({ min: 10, idealLow: 11, idealHigh: 12, max: 15 });
    expect(band(s, 'water')).toEqual({ min: 50, idealLow: 54, idealHigh: 57, max: 60 });
  });

  it('sorbet', () => {
    const s = STANDARDS.sorbet;
    expect(band(s, 'sugar')).toEqual({ min: 24, idealLow: 26, idealHigh: 29, max: 31 });
    expect(band(s, 'water')).toEqual({ min: 65, idealLow: 68, idealHigh: 72, max: 75 });
    expect(band(s, 'butterfat')).toEqual({ min: 0, idealLow: 0, idealHigh: 1, max: 2 });
    expect(s.rows.some((r) => r.macro === 'msnf')).toBe(false);
    expect(s.rows.some((r) => r.macro === 'eggYolk')).toBe(false);
    expect(s.sourceNote).toBe('Sorbet ranges are web-sourced (not from the book)');
  });
});

const cream: IngredientMacros = {
  id: 'cream',
  name: 'Cream',
  water: 57.71,
  fat: 36.08,
  sugars: 2.84,
  starch: 0,
  protein: 2.84,
  otherSolids: 0.53,
  isDairy: true,
};

const sugar: IngredientMacros = {
  id: 'sugar',
  name: 'Sugar',
  water: 0.02,
  fat: 0,
  sugars: 99.8,
  starch: 0,
  protein: 0,
  otherSolids: 0.18,
};

const yolk: IngredientMacros = {
  id: 'yolk',
  name: 'Egg yolk',
  water: 52.31,
  fat: 26.54,
  sugars: 0.56,
  starch: 0,
  protein: 15.86,
  otherSolids: 4.73,
  isEggYolk: true,
};

function line(macros: IngredientMacros, grams: number, role: ResolvedLine['role'] = 'base'): ResolvedLine {
  return {
    ingredientId: macros.id,
    name: macros.name,
    pct: 0,
    grams,
    macros,
    pacLine: { name: macros.name, grams, pacContributions: {}, waterGrams: 0, msnfGrams: 0 },
    role,
  };
}

describe('checkMacros', () => {
  it('pct column sums to 100 and dairy lactose lands in MSNF not Sugar', () => {
    const lines = [line(cream, 400), line(sugar, 150)];
    const result = checkMacros({ lines, style: 'philadelphia', addedSugarGrams: 0 });

    const total = result.rows.reduce((sum, r) => sum + r.pct, 0);
    expect(total).toBeCloseTo(100, 5);

    const sugarRow = result.rows.find((r) => r.label === 'Sugar')!;
    const msnfRow = result.rows.find((r) => r.label === 'MSNF')!;
    // sugar row should only reflect the non-dairy sugar line's sugars
    const expectedSugarPct = (150 * (99.8 / 100)) / 550 * 100;
    expect(sugarRow.pct).toBeCloseTo(expectedSugarPct, 5);
    // msnf should include cream's protein + sugars(lactose) + otherSolids
    const expectedMsnfPct = ((400 * (2.84 + 2.84 + 0.53)) / 100 / 550) * 100;
    expect(msnfRow.pct).toBeCloseTo(expectedMsnfPct, 5);
  });

  it('zero-yolk custard flags the Egg yolk row as low with pct 0', () => {
    const lines = [line(cream, 500), line(sugar, 150)];
    const result = checkMacros({ lines, style: 'custard', addedSugarGrams: 0 });
    const eggRow = result.rows.find((r) => r.label === 'Egg yolk')!;
    expect(eggRow.pct).toBe(0);
    expect(eggRow.status).toBe('low');
  });

  it('custard assigns whole yolk grams to Egg yolk row, excluded from butterfat/sugar/water', () => {
    const lines = [line(cream, 400), line(sugar, 100), line(yolk, 100)];
    const result = checkMacros({ lines, style: 'custard', addedSugarGrams: 0 });
    const eggRow = result.rows.find((r) => r.label === 'Egg yolk')!;
    const expectedPct = (100 / 600) * 100;
    expect(eggRow.pct).toBeCloseTo(expectedPct, 5);

    const total = result.rows.reduce((sum, r) => sum + r.pct, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it('sherbet addedSugarOnly: Sugar row uses addedSugarGrams, remainder falls to Other', () => {
    const fruit: IngredientMacros = {
      id: 'fruit',
      name: 'Fruit',
      water: 80,
      fat: 0,
      sugars: 15,
      starch: 0,
      protein: 1,
      otherSolids: 4,
    };
    const lines = [line(cream, 100, 'base'), line(sugar, 100, 'sweetener'), line(fruit, 200, 'ingredient')];
    const addedSugarGrams = 100 * (99.8 / 100); // sugar line's full sugar grams
    const result = checkMacros({ lines, style: 'sherbet', addedSugarGrams });

    const sugarRow = result.rows.find((r) => r.label === 'Sugar')!;
    const totalGrams = 400;
    expect(sugarRow.pct).toBeCloseTo((addedSugarGrams / totalGrams) * 100, 5);

    const otherRow = result.rows.find((r) => r.label === 'Other')!;
    const fruitSugarGrams = 200 * (15 / 100);
    // other includes fruit's non-added sugar plus its protein/otherSolids
    expect(otherRow.pct).toBeGreaterThan((fruitSugarGrams / totalGrams) * 100 - 1);
  });
});
