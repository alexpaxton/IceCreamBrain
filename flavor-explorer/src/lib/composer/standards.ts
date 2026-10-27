import type {
  Band,
  BookMacro,
  MacroCheckResult,
  MacroCheckRow,
  MacroCheckStatus,
  ResolvedLine,
  StyleId,
  StyleStandard,
} from './types';

/** Dana Cree functional-ratio charts, plus a web-sourced sorbet chart. */
export const STANDARDS: Record<StyleId | 'frozen-yogurt', StyleStandard> = {
  custard: {
    rows: [
      { macro: 'butterfat', band: { min: 10, idealLow: 11, idealHigh: 12, max: 14 } },
      { macro: 'sugar', band: { min: 15, idealLow: 17, idealHigh: 19, max: 22 } },
      { macro: 'eggYolk', band: { min: 5, idealLow: 9, idealHigh: 12, max: 15 } },
      { macro: 'msnf', band: { min: 5, idealLow: 6, idealHigh: 8, max: 10 } },
      { macro: 'water', band: { min: 45, idealLow: 54, idealHigh: 57, max: 60 } },
    ],
  },
  philadelphia: {
    rows: [
      { macro: 'butterfat', band: { min: 12, idealLow: 15, idealHigh: 18, max: 20 } },
      { macro: 'sugar', band: { min: 15, idealLow: 17, idealHigh: 19, max: 22 } },
      { macro: 'msnf', band: { min: 6, idealLow: 8, idealHigh: 10, max: 12 } },
      { macro: 'water', band: { min: 50, idealLow: 54, idealHigh: 57, max: 60 } },
    ],
  },
  sherbet: {
    rows: [
      { macro: 'butterfat', band: { min: 2, idealLow: 3, idealHigh: 4, max: 6 } },
      { macro: 'sugar', band: { min: 20, idealLow: 23, idealHigh: 25, max: 27 } },
      { macro: 'msnf', band: { min: 2, idealLow: 3, idealHigh: 4, max: 5 } },
      { macro: 'water', band: { min: 50, idealLow: 54, idealHigh: 57, max: 60 } },
    ],
    addedSugarOnly: true,
  },
  'frozen-yogurt': {
    rows: [
      { macro: 'butterfat', band: { min: 5, idealLow: 7, idealHigh: 8, max: 10 } },
      { macro: 'sugar', band: { min: 20, idealLow: 23, idealHigh: 25, max: 27 } },
      { macro: 'msnf', band: { min: 10, idealLow: 11, idealHigh: 12, max: 15 } },
      { macro: 'water', band: { min: 50, idealLow: 54, idealHigh: 57, max: 60 } },
    ],
  },
  sorbet: {
    rows: [
      { macro: 'butterfat', band: { min: 0, idealLow: 0, idealHigh: 1, max: 2 } },
      { macro: 'sugar', band: { min: 24, idealLow: 26, idealHigh: 29, max: 31 } },
      { macro: 'water', band: { min: 65, idealLow: 68, idealHigh: 72, max: 75 } },
    ],
    sourceNote: 'Sorbet ranges are web-sourced (not from the book)',
  },
};

function bandFor(standard: StyleStandard, macro: BookMacro): Band | undefined {
  return standard.rows.find((row) => row.macro === macro)?.band;
}

function statusFor(pct: number, band: Band): MacroCheckStatus {
  if (pct < band.min) return 'low';
  if (pct > band.max) return 'high';
  if (pct >= band.idealLow && pct <= band.idealHigh) return 'ideal';
  return 'ok';
}

const ROW_LABELS: Record<BookMacro, string> = {
  butterfat: 'Butterfat',
  sugar: 'Sugar',
  eggYolk: 'Egg yolk',
  msnf: 'MSNF',
  water: 'Water',
};

/**
 * Maps resolved recipe lines into the book's macro rows (Butterfat, Sugar,
 * Egg yolk, MSNF, Water, Other) so the pct column sums to 100.
 */
export function checkMacros(args: {
  lines: ResolvedLine[];
  style: StyleId;
  addedSugarGrams: number;
}): MacroCheckResult {
  const { lines, style, addedSugarGrams } = args;
  const standard = STANDARDS[style];
  const isCustard = style === 'custard';

  const totalGrams = lines.reduce((sum, line) => sum + line.grams, 0);

  let butterfatGrams = 0;
  let sugarGrams = 0;
  let eggYolkGrams = 0;
  let msnfGrams = 0;
  let waterGrams = 0;
  let otherGrams = 0;

  for (const line of lines) {
    const { macros, grams } = line;

    if (isCustard && macros.isEggYolk) {
      // Book chart treats yolk as a whole-ingredient %; the entire line
      // lands in the Egg yolk row rather than decomposing into macros.
      eggYolkGrams += grams;
      continue;
    }

    const fatG = (grams * macros.fat) / 100;
    const sugarsG = (grams * macros.sugars) / 100;
    const proteinG = (grams * macros.protein) / 100;
    const starchG = (grams * macros.starch) / 100;
    const otherSolidsG = (grams * macros.otherSolids) / 100;
    const waterG = (grams * macros.water) / 100;

    butterfatGrams += fatG;
    waterGrams += waterG;
    otherGrams += starchG; // starch has no book row; always falls to Other

    if (macros.isDairy) {
      // Dairy sugars (lactose) count toward MSNF, not the Sugar row.
      msnfGrams += proteinG + sugarsG + otherSolidsG;
    } else {
      sugarGrams += sugarsG;
      otherGrams += proteinG + otherSolidsG;
    }
  }

  let sugarRowGrams = sugarGrams;
  if (standard.addedSugarOnly) {
    const nonAddedSugar = sugarGrams - addedSugarGrams;
    sugarRowGrams = addedSugarGrams;
    otherGrams += nonAddedSugar;
  }

  const rows: MacroCheckRow[] = [];

  function pushRow(macro: BookMacro, grams: number): void {
    const band = bandFor(standard, macro);
    if (!band) return;
    const pct = totalGrams > 0 ? (grams / totalGrams) * 100 : 0;
    rows.push({ label: ROW_LABELS[macro], band, pct, status: statusFor(pct, band) });
  }

  pushRow('butterfat', butterfatGrams);
  pushRow('sugar', sugarRowGrams);
  if (isCustard) {
    pushRow('eggYolk', eggYolkGrams);
  }
  pushRow('msnf', msnfGrams);
  pushRow('water', waterGrams);

  const otherPct = totalGrams > 0 ? (otherGrams / totalGrams) * 100 : 0;
  rows.push({ label: 'Other', band: null, pct: otherPct, status: 'info' });

  return { rows, sourceNote: standard.sourceNote };
}
