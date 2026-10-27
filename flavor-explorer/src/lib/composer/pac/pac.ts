// Pure TS port of pac_calculator.py's calc_pac / calc_fp / calc_ice_fraction / main().
// Source: /Users/xx/src/ice-cream/.claude/skills/calculate-pac/pac_calculator.py

import type { PacAnalysis, PacBreakdownRow, PacLine, Range } from '../types';
import { PAC_TABLE, PRESETS } from './pacTable';

/**
 * Port of parse_ingredient's preset-lookup branch:
 *   for sugar, frac in preset.sugars.items():
 *       line.pac_contributions[sugar] = grams * frac
 *   line.water_grams = grams * preset.water
 *   line.msnf_grams = grams * preset.msnf
 */
export function buildPresetPacLine(name: string, grams: number): PacLine {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(
      `Unknown ingredient '${name}'. Either add it to PRESETS or specify composition: ${name}:${grams}:sugar_type:fraction`
    );
  }
  const pacContributions: Record<string, number> = {};
  for (const [sugar, frac] of Object.entries(preset.sugars)) {
    pacContributions[sugar] = grams * frac;
  }
  return {
    name,
    grams,
    pacContributions,
    waterGrams: grams * preset.water,
    msnfGrams: grams * preset.msnf,
  };
}

/**
 * PAC = sum(net_sugar_grams * PAC_value) / total_recipe_grams
 * Port of calc_pac.
 */
export function calcPac(
  lines: PacLine[],
  totalGrams: number
): { pac: number; breakdown: PacBreakdownRow[] } {
  const rows: PacBreakdownRow[] = [];
  let pacSum = 0;
  for (const line of lines) {
    let linePac = 0;
    for (const [sugar, netGrams] of Object.entries(line.pacContributions)) {
      const contribution = (netGrams * PAC_TABLE[sugar]) / totalGrams;
      linePac += contribution;
      rows.push({ ingredient: line.name, grams: line.grams, sugar, netGrams, contribution });
    }
    pacSum += linePac;
  }
  return { pac: pacSum, breakdown: rows };
}

/**
 * Port of calc_fp (icecreamcalc.com method, Goff & Hartel for MSNF).
 * Returns freezing point in °C, or null if inputs are invalid (water_pct <= 0).
 * water_pct and msnf_pct are percentages (0-100).
 */
export function calcFreezingPoint(
  pac: number,
  waterPct: number,
  msnfPct: number,
  saltPac = 0,
  alcoholPac = 0
): number | null {
  if (waterPct <= 0) {
    return null;
  }

  const waterFrac = waterPct / 100.0;
  const pacn = pac / waterFrac; // normalised PAC

  // Sugar FP: polynomial fit to sucrose solution experimental data
  const x = pacn;
  const fpSugars = -(
    1.8e-9 * x ** 4 -
    1.5486e-6 * x ** 3 +
    4.066439e-4 * x ** 2 +
    4.29570733e-2 * x +
    0.1564927407
  );

  // MSNF mineral salts (Goff & Hartel 7th ed.)
  const fpMsnf = waterPct > 0 ? -(msnfPct * 2.37) / waterPct : 0.0;

  // Salt and alcohol (cryoscopic, linear)
  const pacnSalt = waterFrac > 0 ? saltPac / waterFrac : 0.0;
  const pacnAlcohol = waterFrac > 0 ? alcoholPac / waterFrac : 0.0;
  const fpSalt = -2.0 * 1.86 * (pacnSalt / 58.44);
  const fpAlcohol = -1.0 * 1.86 * (pacnAlcohol / 46.0684);

  return fpSugars + fpMsnf + fpSalt + fpAlcohol;
}

/**
 * Port of calc_ice_fraction (Gelatologist Part II formula).
 * Returns null if above FP, or if the ln() argument is <= 0.
 * pctWaterFrozen is returned as a fraction 0-1 here, same as the Python return value.
 */
export function calcIceFraction(
  fp: number,
  tsPct: number,
  serveTempC: number
): { iceFraction: number; pctWaterFrozen: number } | null {
  if (serveTempC >= fp) {
    return null; // above freezing point, no ice
  }
  const xw = 1.0 - tsPct / 100.0;
  const lnArg = fp - serveTempC + 1;
  if (lnArg <= 0) {
    return null;
  }
  const xIce = (1.105 * xw) / (1.0 + 0.8765 / Math.log(lnArg));
  const pctWf = xw > 0 ? xIce / xw : 0.0;
  return { iceFraction: xIce, pctWaterFrozen: pctWf };
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** Mirrors pac_calculator.py's main(). */
export function analyzePac(input: {
  lines: PacLine[];
  totalGrams?: number;
  type: 'gelato' | 'sorbet';
  serveTempC: number;
  msnfPctOverride?: number;
  tsPctOverride?: number;
}): PacAnalysis {
  const { lines, type, serveTempC, msnfPctOverride, tsPctOverride } = input;

  const totalGrams = input.totalGrams ?? lines.reduce((sum, l) => sum + l.grams, 0);

  const totalWaterGrams = lines.reduce((sum, l) => sum + l.waterGrams, 0);
  const totalMsnfGrams = lines.reduce((sum, l) => sum + l.msnfGrams, 0);
  const waterPct = (totalWaterGrams / totalGrams) * 100;
  const msnfPct = msnfPctOverride ?? (totalMsnfGrams / totalGrams) * 100;

  // Salt and alcohol PAC (for FP only — already counted in main PAC via table)
  const saltPac = lines.reduce(
    (sum, line) => sum + ((line.pacContributions['salt'] ?? 0) * PAC_TABLE['salt']) / totalGrams,
    0
  );
  const alcoholPac = lines.reduce(
    (sum, line) =>
      sum + ((line.pacContributions['ethanol'] ?? 0) * PAC_TABLE['ethanol']) / totalGrams,
    0
  );

  const { pac, breakdown } = calcPac(lines, totalGrams);
  const waterFrac = waterPct / 100.0;
  const pacn = waterFrac > 0 ? pac / waterFrac : 0.0;

  const tsPct = tsPctOverride ?? ((totalGrams - totalWaterGrams) / totalGrams) * 100;

  const fp = calcFreezingPoint(pac, waterPct, msnfPct, saltPac, alcoholPac);
  const iceResult = fp !== null ? calcIceFraction(fp, tsPct, serveTempC) : null;

  const pacTarget: Range = type === 'gelato' ? [24, 28] : [30, 36];
  const fpTarget: Range = [-3.0, -2.75];
  const wfTarget: Range = [75, 80];

  const servingTempEstC = type === 'gelato' ? -(pac / 2) : -(pac / 2.5);

  const pctWaterFrozen = iceResult !== null ? iceResult.pctWaterFrozen * 100 : null;

  const inRangePac = pac >= pacTarget[0] && pac <= pacTarget[1];
  const inRangeFp = fp !== null ? fp >= fpTarget[0] && fp <= fpTarget[1] : null;
  const inRangeWf =
    pctWaterFrozen !== null ? pctWaterFrozen >= wfTarget[0] && pctWaterFrozen <= wfTarget[1] : null;

  return {
    totalGrams,
    waterPct,
    tsPct,
    msnfPct,
    pac,
    pacn,
    breakdown,
    freezingPointC: fp,
    iceFraction: iceResult !== null ? iceResult.iceFraction : null,
    pctWaterFrozen,
    servingTempEstC,
    serveTempC,
    targets: { pac: pacTarget, freezingPointC: fpTarget, pctWaterFrozen: wfTarget },
    inRange: { pac: inRangePac, freezingPointC: inRangeFp, pctWaterFrozen: inRangeWf },
  };
}
