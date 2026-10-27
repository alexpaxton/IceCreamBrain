// Verbatim port of pac_calculator.py PAC_TABLE / PRESETS.
// Source: /Users/xx/src/ice-cream/.claude/skills/calculate-pac/pac_calculator.py

import type { SweetenerPreset } from '../types';

// ---------------------------------------------------------------------------
// PAC lookup table (source: Gelatologist / Wiley article, confirmed from image)
// Values are PAC per 100g of PURE substance (sucrose = 100 reference)
// ---------------------------------------------------------------------------
export const PAC_TABLE: Record<string, number> = {
  agave_syrup: 180,
  dextrose: 190, // anhydrous; commercial dextrose monohydrate is ~92% pure
  ethanol: 740,
  fructose: 190,
  glucose_syrup_de42: 129,
  glucose_syrup_powder_de38: 129,
  grape_sugar: 190,
  honey: 190,
  inulin: 25,
  invert_sugar: 172,
  lactose: 100,
  maltitol: 99,
  maltodextrin_de18: 129,
  maple_syrup: 100,
  polydextrose: 60,
  salt: 585,
  sorbitol: 190,
  sucrose: 100,
  trehalose: 100,
  xylitol: 220,
  allulose: 190, // source: George Leung article (1.9x sucrose)
};

// ---------------------------------------------------------------------------
// Built-in ingredient presets
// Each preset defines: { sugars: {sugar_type: fraction}, water: fraction, msnf: fraction }
// Fractions must sum to <= 1.0 (remainder is non-PAC solids like fat, protein)
// ---------------------------------------------------------------------------
export const PRESETS: Record<string, SweetenerPreset> = {
  // Pure sugars (purity < 1.0 for commercial products)
  sucrose: { sugars: { sucrose: 1.0 }, water: 0.0, msnf: 0 },
  dextrose: { sugars: { dextrose: 0.92 }, water: 0.08, msnf: 0 }, // monohydrate
  fructose: { sugars: { fructose: 1.0 }, water: 0.0, msnf: 0 },
  invert_sugar: { sugars: { invert_sugar: 0.79 }, water: 0.21, msnf: 0 }, // ~79% solids
  trehalose: { sugars: { trehalose: 1.0 }, water: 0.0, msnf: 0 },
  lactose: { sugars: { lactose: 1.0 }, water: 0.0, msnf: 0 },
  sorbitol: { sugars: { sorbitol: 1.0 }, water: 0.0, msnf: 0 },
  maltitol: { sugars: { maltitol: 1.0 }, water: 0.0, msnf: 0 },
  xylitol: { sugars: { xylitol: 1.0 }, water: 0.0, msnf: 0 },
  allulose: { sugars: { allulose: 1.0 }, water: 0.0, msnf: 0 },
  inulin: { sugars: { inulin: 1.0 }, water: 0.0, msnf: 0 },
  polydextrose: { sugars: { polydextrose: 1.0 }, water: 0.0, msnf: 0 },
  salt: { sugars: { salt: 1.0 }, water: 0.0, msnf: 0 },
  ethanol: { sugars: { ethanol: 1.0 }, water: 0.0, msnf: 0 },
  // Syrups
  glucose_syrup_de42: { sugars: { glucose_syrup_de42: 0.8 }, water: 0.2, msnf: 0 },
  glucose_syrup_powder_de38: { sugars: { glucose_syrup_powder_de38: 0.97 }, water: 0.03, msnf: 0 },
  maltodextrin_de18: { sugars: { maltodextrin_de18: 0.97 }, water: 0.03, msnf: 0 },
  honey: { sugars: { honey: 0.79 }, water: 0.21, msnf: 0 },
  agave_syrup: { sugars: { agave_syrup: 0.76 }, water: 0.24, msnf: 0 },
  maple_syrup: { sugars: { maple_syrup: 0.67 }, water: 0.33, msnf: 0 },
  grape_sugar: { sugars: { grape_sugar: 1.0 }, water: 0.0, msnf: 0 },
  // Dairy
  milk_whole: { sugars: { lactose: 0.049 }, water: 0.876, msnf: 0.087 },
  cream_35: { sugars: { lactose: 0.028 }, water: 0.62, msnf: 0.042 },
  cream_49: { sugars: { lactose: 0.028 }, water: 0.45, msnf: 0.035 },
};

// Preset keys usable as sweetener-node options (excludes dairy presets).
export const SWEETENER_KEYS: string[] = Object.keys(PRESETS).filter(
  (key) => key !== 'milk_whole' && key !== 'cream_35' && key !== 'cream_49'
);
