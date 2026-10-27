import { describe, expect, it } from 'vitest';
import { totalMacros } from '../macros';
import type { IngredientMacros } from '../types';

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

const water: IngredientMacros = {
  id: 'water',
  name: 'Water',
  water: 100,
  fat: 0,
  sugars: 0,
  starch: 0,
  protein: 0,
  otherSolids: 0,
};

describe('totalMacros', () => {
  it('sums grams per macro across lines', () => {
    const totals = totalMacros([
      { macros: cream, grams: 400 },
      { macros: sugar, grams: 150 },
    ]);

    expect(totals.totalGrams).toBe(550);
    expect(totals.grams.fat).toBeCloseTo((400 * 36.08) / 100, 6);
    expect(totals.grams.sugars).toBeCloseTo((400 * 2.84) / 100 + (150 * 99.8) / 100, 6);
  });

  it('pct sums to ~100 across 3 lines', () => {
    const totals = totalMacros([
      { macros: cream, grams: 300 },
      { macros: sugar, grams: 120 },
      { macros: water, grams: 580 },
    ]);

    const pctSum = Object.values(totals.pct).reduce((a, b) => a + b, 0);
    expect(pctSum).toBeCloseTo(100, 5);
  });

  it('returns zeroed totals for an empty line list', () => {
    const totals = totalMacros([]);
    expect(totals.totalGrams).toBe(0);
    expect(totals.pct.water).toBe(0);
    expect(totals.grams.fat).toBe(0);
  });
});
