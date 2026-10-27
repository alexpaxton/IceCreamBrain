import type { IngredientMacros, MacroKey, MacroTotals } from './types';

const MACRO_KEYS: MacroKey[] = ['water', 'fat', 'sugars', 'starch', 'protein', 'otherSolids'];

/**
 * Sums each macro (in grams) across resolved lines and derives % of total
 * weight. `totalGrams` is the sum of all line grams.
 */
export function totalMacros(lines: { macros: IngredientMacros; grams: number }[]): MacroTotals {
  const grams: Record<MacroKey, number> = {
    water: 0,
    fat: 0,
    sugars: 0,
    starch: 0,
    protein: 0,
    otherSolids: 0,
  };
  let totalGrams = 0;

  for (const line of lines) {
    totalGrams += line.grams;
    for (const key of MACRO_KEYS) {
      grams[key] += (line.grams * line.macros[key]) / 100;
    }
  }

  const pct: Record<MacroKey, number> = {
    water: 0,
    fat: 0,
    sugars: 0,
    starch: 0,
    protein: 0,
    otherSolids: 0,
  };
  for (const key of MACRO_KEYS) {
    pct[key] = totalGrams > 0 ? (grams[key] / totalGrams) * 100 : 0;
  }

  return { grams, pct, totalGrams };
}
