import { describe, expect, it } from 'vitest';
import type { PacLine } from '../../types';
import { PAC_TABLE, PRESETS, SWEETENER_KEYS } from '../pacTable';
import {
  analyzePac,
  buildPresetPacLine,
  calcFreezingPoint,
  calcIceFraction,
  calcPac,
  celsiusToFahrenheit,
} from '../pac';
import golden from '../__fixtures__/python-golden.json';

// -----------------------------------------------------------------------
// Test-only helper: reproduces pac_calculator.py's parse_ingredient() so the
// golden fixtures' raw "name:grams[:sugar:frac...]" tokens can be turned
// into PacLine objects for the TS port under test. Not part of the public
// pac/pac.ts API (only the preset path — buildPresetPacLine — is).
// -----------------------------------------------------------------------
function parseIngredientToken(token: string): PacLine {
  const parts = token.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid ingredient format: ${token}`);
  }
  const name = parts[0].trim().toLowerCase().replace(/ /g, '_');
  const grams = Number(parts[1]);

  if (parts.length === 2) {
    return buildPresetPacLine(name, grams);
  }

  if ((parts.length - 2) % 2 !== 0) {
    throw new Error(`Composition for '${name}' must be key:value pairs: ${token}`);
  }
  const pacContributions: Record<string, number> = {};
  let msnfGrams = 0;
  let waterFrac = 0;
  for (let i = 2; i < parts.length; i += 2) {
    const key = parts[i].trim().toLowerCase().replace(/ /g, '_');
    const frac = Number(parts[i + 1]);
    if (key === 'water') {
      waterFrac = frac;
    } else if (key === 'msnf') {
      msnfGrams += grams * frac;
    } else if (key in PAC_TABLE) {
      pacContributions[key] = grams * frac;
    } else {
      throw new Error(`Unknown sugar type '${key}' for '${name}'`);
    }
  }
  return { name, grams, pacContributions, waterGrams: grams * waterFrac, msnfGrams };
}

interface GoldenBreakdownRow {
  ingredient: string;
  grams: number;
  sugar: string;
  netGrams: number;
  contribution: number;
}

interface GoldenCase {
  name: string;
  cli: string;
  inputs: {
    ingredients: string[];
    type: 'gelato' | 'sorbet';
    serveTempC: number;
    totalGrams?: number;
  };
  expected: {
    totalGrams: number;
    waterPct: number;
    tsPct: number;
    msnfPct: number;
    pac: number;
    pacn: number;
    freezingPointC: number | null;
    iceFraction: number | null;
    pctWaterFrozen: number | null;
    servingTempEstC: number;
    saltPac: number;
    alcoholPac: number;
    breakdown: GoldenBreakdownRow[];
  };
}

const cases = golden as GoldenCase[];

describe('analyzePac matches python golden fixtures', () => {
  for (const c of cases) {
    it(c.name, () => {
      const lines = c.inputs.ingredients.map(parseIngredientToken);
      const result = analyzePac({
        lines,
        totalGrams: c.inputs.totalGrams,
        type: c.inputs.type,
        serveTempC: c.inputs.serveTempC,
      });

      // PAC / PACn: relative tolerance against python's full-precision values
      expect(result.pac).toBeCloseTo(c.expected.pac, 6);
      expect(result.pacn).toBeCloseTo(c.expected.pacn, 4);

      expect(result.totalGrams).toBeCloseTo(c.expected.totalGrams, 6);
      expect(result.waterPct).toBeCloseTo(c.expected.waterPct, 4);
      expect(result.tsPct).toBeCloseTo(c.expected.tsPct, 4);
      expect(result.msnfPct).toBeCloseTo(c.expected.msnfPct, 4);
      expect(result.servingTempEstC).toBeCloseTo(c.expected.servingTempEstC, 6);

      // Freezing point / % water frozen: absolute tolerance 0.05
      if (c.expected.freezingPointC === null) {
        expect(result.freezingPointC).toBeNull();
      } else {
        expect(result.freezingPointC).not.toBeNull();
        expect(Math.abs(result.freezingPointC! - c.expected.freezingPointC)).toBeLessThan(0.05);
      }

      if (c.expected.pctWaterFrozen === null) {
        expect(result.pctWaterFrozen).toBeNull();
        expect(result.iceFraction).toBeNull();
      } else {
        expect(result.pctWaterFrozen).not.toBeNull();
        expect(Math.abs(result.pctWaterFrozen! - c.expected.pctWaterFrozen)).toBeLessThan(0.05);
        expect(result.iceFraction).not.toBeNull();
        expect(Math.abs(result.iceFraction! - c.expected.iceFraction!)).toBeLessThan(0.001);
      }

      // Breakdown rows: same ingredient/sugar/netGrams/contribution set
      expect(result.breakdown).toHaveLength(c.expected.breakdown.length);
      c.expected.breakdown.forEach((expectedRow, i) => {
        const row = result.breakdown[i];
        expect(row.ingredient).toBe(expectedRow.ingredient);
        expect(row.sugar).toBe(expectedRow.sugar);
        expect(row.grams).toBeCloseTo(expectedRow.grams, 6);
        expect(row.netGrams).toBeCloseTo(expectedRow.netGrams, 6);
        expect(row.contribution).toBeCloseTo(expectedRow.contribution, 6);
      });
    });
  }
});

describe('calcFreezingPoint / calcIceFraction against golden salt+ethanol case', () => {
  it('reproduces salt and alcohol cryoscopic terms', () => {
    const c = cases.find((x) => x.name === 'sorbet_salt_and_ethanol')!;
    const lines = c.inputs.ingredients.map(parseIngredientToken);
    const { pac } = calcPac(lines, c.expected.totalGrams);
    const fp = calcFreezingPoint(
      pac,
      c.expected.waterPct,
      c.expected.msnfPct,
      c.expected.saltPac,
      c.expected.alcoholPac
    );
    expect(fp).not.toBeNull();
    expect(Math.abs(fp! - c.expected.freezingPointC!)).toBeLessThan(0.05);

    const ice = calcIceFraction(fp!, c.expected.tsPct, c.inputs.serveTempC);
    expect(ice).not.toBeNull();
    expect(Math.abs(ice!.pctWaterFrozen * 100 - c.expected.pctWaterFrozen!)).toBeLessThan(0.05);
  });
});

describe('PAC_TABLE spot values', () => {
  it('sucrose is 100 (reference)', () => {
    expect(PAC_TABLE.sucrose).toBe(100);
  });
  it('ethanol is 740', () => {
    expect(PAC_TABLE.ethanol).toBe(740);
  });
  it('dextrose is 190', () => {
    expect(PAC_TABLE.dextrose).toBe(190);
  });
});

describe('PRESETS / SWEETENER_KEYS', () => {
  it('has 21 PAC_TABLE entries', () => {
    expect(Object.keys(PAC_TABLE)).toHaveLength(21);
  });
  it('has 24 presets', () => {
    expect(Object.keys(PRESETS)).toHaveLength(24);
  });
  it('SWEETENER_KEYS excludes dairy presets', () => {
    expect(SWEETENER_KEYS).not.toContain('milk_whole');
    expect(SWEETENER_KEYS).not.toContain('cream_35');
    expect(SWEETENER_KEYS).not.toContain('cream_49');
    expect(SWEETENER_KEYS).toHaveLength(Object.keys(PRESETS).length - 3);
  });
});

describe('buildPresetPacLine', () => {
  it('throws on unknown preset', () => {
    expect(() => buildPresetPacLine('unobtainium', 100)).toThrow();
  });

  it('applies dextrose monohydrate purity (0.92)', () => {
    const line = buildPresetPacLine('dextrose', 100);
    expect(line.pacContributions.dextrose).toBeCloseTo(92, 9);
    expect(line.waterGrams).toBeCloseTo(8, 9);
    expect(line.msnfGrams).toBe(0);
  });

  it('applies dairy preset MSNF and water fractions', () => {
    const line = buildPresetPacLine('milk_whole', 1000);
    expect(line.pacContributions.lactose).toBeCloseTo(49, 9);
    expect(line.waterGrams).toBeCloseTo(876, 9);
    expect(line.msnfGrams).toBeCloseTo(87, 9);
  });
});

describe('celsiusToFahrenheit', () => {
  it('converts 0C to 32F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });
  it('converts -12C to 10.4F', () => {
    expect(celsiusToFahrenheit(-12)).toBeCloseTo(10.4, 9);
  });
});
