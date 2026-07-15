#!/usr/bin/env python3
"""
pac_calculator.py — PAC (Potere Anti-Congelante) calculator for ice cream and sorbet recipes.

Usage:
    python3 pac_calculator.py [--ingredient NAME:GRAMS] ... [--total GRAMS]
                              [--type gelato|sorbet] [--serve TEMP_C]
                              [--msnf PCT] [--ts PCT]

    For ingredients with known sugar composition (custom/fruit):
        python3 pac_calculator.py --ingredient "lychee_puree:300:fructose:0.12:water:0.82"

    Format: NAME:GRAMS[:SUGAR_TYPE:FRACTION[:SUGAR_TYPE:FRACTION ...]]
    Sugar types may be stacked: fructose:0.07:sucrose:0.05:water:0.88

Options:
    --ingredient   Repeatable. Built-in presets: sucrose, dextrose, glucose_syrup_de42,
                   glucose_syrup_powder_de38, fructose, invert_sugar, trehalose, lactose,
                   honey, agave_syrup, maple_syrup, grape_sugar, allulose, inulin,
                   maltodextrin_de18, polydextrose, sorbitol, maltitol, xylitol, salt,
                   ethanol, milk_whole, cream_35, cream_49.
                   Custom: NAME:GRAMS:sugar_type:fraction[:water:fraction ...]
    --total        Total recipe weight in grams. If omitted, summed from ingredients.
    --type         gelato or sorbet. Determines target range and serving temp formula.
    --serve        Serving temperature in °C (negative). Default: -12.
    --msnf         MSNF % of total recipe (for FP calculation). Default: auto from ingredients.
    --ts           Total solids % override (for FP calculation). Default: auto.

Exit codes:
    0  Success
    1  Input error
"""

import math
import sys
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# PAC lookup table (source: Gelatologist / Wiley article, confirmed from image)
# Values are PAC per 100g of PURE substance (sucrose = 100 reference)
# ---------------------------------------------------------------------------
PAC_TABLE: dict[str, float] = {
    "agave_syrup": 180,
    "dextrose": 190,         # anhydrous; commercial dextrose monohydrate is ~92% pure
    "ethanol": 740,
    "fructose": 190,
    "glucose_syrup_de42": 129,
    "glucose_syrup_powder_de38": 129,
    "grape_sugar": 190,
    "honey": 190,
    "inulin": 25,
    "invert_sugar": 172,
    "lactose": 100,
    "maltitol": 99,
    "maltodextrin_de18": 129,
    "maple_syrup": 100,
    "polydextrose": 60,
    "salt": 585,
    "sorbitol": 190,
    "sucrose": 100,
    "trehalose": 100,
    "xylitol": 220,
    "allulose": 190,         # source: George Leung article (1.9x sucrose)
}

# ---------------------------------------------------------------------------
# Built-in ingredient presets
# Each preset defines: {sugar_type: fraction, "water": fraction, "msnf": fraction}
# Fractions must sum to <= 1.0 (remainder is non-PAC solids like fat, protein)
# ---------------------------------------------------------------------------
@dataclass
class IngredientPreset:
    sugars: dict[str, float]   # {pac_table_key: mass_fraction}
    water: float               # mass fraction of water
    msnf: float = 0.0          # MSNF mass fraction (contributes to FP via minerals)

PRESETS: dict[str, IngredientPreset] = {
    # Pure sugars (purity < 1.0 for commercial products)
    "sucrose":                     IngredientPreset({"sucrose": 1.0},          water=0.0),
    "dextrose":                    IngredientPreset({"dextrose": 0.92},        water=0.08),  # monohydrate
    "fructose":                    IngredientPreset({"fructose": 1.0},         water=0.0),
    "invert_sugar":                IngredientPreset({"invert_sugar": 0.79},    water=0.21),  # ~79% solids
    "trehalose":                   IngredientPreset({"trehalose": 1.0},        water=0.0),
    "lactose":                     IngredientPreset({"lactose": 1.0},          water=0.0),
    "sorbitol":                    IngredientPreset({"sorbitol": 1.0},         water=0.0),
    "maltitol":                    IngredientPreset({"maltitol": 1.0},         water=0.0),
    "xylitol":                     IngredientPreset({"xylitol": 1.0},          water=0.0),
    "allulose":                    IngredientPreset({"allulose": 1.0},         water=0.0),
    "inulin":                      IngredientPreset({"inulin": 1.0},           water=0.0),
    "polydextrose":                IngredientPreset({"polydextrose": 1.0},     water=0.0),
    "salt":                        IngredientPreset({"salt": 1.0},             water=0.0),
    "ethanol":                     IngredientPreset({"ethanol": 1.0},          water=0.0),
    # Syrups
    "glucose_syrup_de42":          IngredientPreset({"glucose_syrup_de42": 0.80},      water=0.20),
    "glucose_syrup_powder_de38":   IngredientPreset({"glucose_syrup_powder_de38": 0.97}, water=0.03),
    "maltodextrin_de18":           IngredientPreset({"maltodextrin_de18": 0.97},        water=0.03),
    "honey":                       IngredientPreset({"honey": 0.79},           water=0.21),
    "agave_syrup":                 IngredientPreset({"agave_syrup": 0.76},     water=0.24),
    "maple_syrup":                 IngredientPreset({"maple_syrup": 0.67},     water=0.33),
    "grape_sugar":                 IngredientPreset({"grape_sugar": 1.0},      water=0.0),
    # Dairy
    "milk_whole":   IngredientPreset({"lactose": 0.049}, water=0.876, msnf=0.087),
    "cream_35":     IngredientPreset({"lactose": 0.028}, water=0.620, msnf=0.042),
    "cream_49":     IngredientPreset({"lactose": 0.028}, water=0.450, msnf=0.035),
}

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class IngredientLine:
    name: str
    grams: float
    pac_contributions: dict[str, float] = field(default_factory=dict)  # {sugar: net_grams}
    water_grams: float = 0.0
    msnf_grams: float = 0.0
    pac_total: float = 0.0  # raw sum before /total_grams

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def parse_ingredient(token: str) -> IngredientLine:
    """
    Formats:
      name:grams                           — preset lookup
      name:grams:sugar:frac[:sugar:frac]   — explicit composition
    """
    parts = token.split(":")
    if len(parts) < 2:
        raise ValueError(f"Invalid ingredient format: {token!r}. Expected name:grams")

    name = parts[0].strip().lower().replace(" ", "_")
    try:
        grams = float(parts[1])
    except ValueError:
        raise ValueError(f"Invalid grams for {name!r}: {parts[1]!r}")

    line = IngredientLine(name=name, grams=grams)

    if len(parts) == 2:
        # Preset lookup
        preset_key = name
        if preset_key not in PRESETS:
            raise ValueError(
                f"Unknown ingredient {name!r}. Either add it to PRESETS or specify composition: "
                f"{name}:{grams}:sugar_type:fraction"
            )
        preset = PRESETS[preset_key]
        for sugar, frac in preset.sugars.items():
            line.pac_contributions[sugar] = grams * frac
        line.water_grams = grams * preset.water
        line.msnf_grams = grams * preset.msnf
    else:
        # Explicit composition: sugar:frac pairs in remaining parts
        if (len(parts) - 2) % 2 != 0:
            raise ValueError(f"Composition for {name!r} must be key:value pairs: {token!r}")
        water_frac = 0.0
        for i in range(2, len(parts), 2):
            key = parts[i].strip().lower().replace(" ", "_")
            try:
                frac = float(parts[i + 1])
            except ValueError:
                raise ValueError(f"Invalid fraction for {key!r}: {parts[i+1]!r}")
            if key == "water":
                water_frac = frac
            elif key == "msnf":
                line.msnf_grams += grams * frac
            elif key in PAC_TABLE:
                line.pac_contributions[key] = grams * frac
            else:
                raise ValueError(
                    f"Unknown sugar type {key!r} for {name!r}. "
                    f"Known types: {', '.join(sorted(PAC_TABLE))}"
                )
        line.water_grams = grams * water_frac

    return line

# ---------------------------------------------------------------------------
# PAC calculation
# ---------------------------------------------------------------------------
def calc_pac(lines: list[IngredientLine], total_grams: float) -> tuple[float, list[tuple]]:
    """
    PAC = sum(net_sugar_grams * PAC_value) / total_recipe_grams
    Returns (total_pac, breakdown_rows)
    breakdown_rows: [(ingredient_name, grams, sugar, net_grams, pac_contribution)]
    """
    rows = []
    pac_sum = 0.0
    for line in lines:
        line_pac = 0.0
        for sugar, net_grams in line.pac_contributions.items():
            contrib = net_grams * PAC_TABLE[sugar] / total_grams
            line_pac += contrib
            rows.append((line.name, line.grams, sugar, net_grams, contrib))
        line.pac_total = line_pac
        pac_sum += line_pac
    return pac_sum, rows

# ---------------------------------------------------------------------------
# FP calculation (icecreamcalc.com method, Goff & Hartel for MSNF)
# Note: polynomial uses x = PACn (not PACn * 0.1 as documented on icecreamcalc);
# the 0.1 scaling appears to be an internal unit conversion in their software.
# Verified against Gelatologist examples within ~6% for sorbet (no MSNF).
# ---------------------------------------------------------------------------
def calc_fp(pac: float, water_pct: float, msnf_pct: float,
            salt_pac: float = 0.0, alcohol_pac: float = 0.0) -> float | None:
    """
    Returns freezing point in °C, or None if inputs are invalid.
    water_pct and msnf_pct are percentages (0–100).
    """
    if water_pct <= 0:
        return None

    water_frac = water_pct / 100.0
    pacn = pac / water_frac  # normalised PAC

    # Sugar FP: polynomial fit to sucrose solution experimental data
    x = pacn
    fp_sugars = -(1.8e-9 * x**4 - 1.5486e-6 * x**3 + 4.066439e-4 * x**2
                  + 4.29570733e-2 * x + 0.1564927407)

    # MSNF mineral salts (Goff & Hartel 7th ed.)
    fp_msnf = -(msnf_pct * 2.37) / water_pct if water_pct > 0 else 0.0

    # Salt and alcohol (cryoscopic, linear)
    pacn_salt = salt_pac / water_frac if water_frac > 0 else 0.0
    pacn_alcohol = alcohol_pac / water_frac if water_frac > 0 else 0.0
    fp_salt = -2.0 * 1.86 * (pacn_salt / 58.44)
    fp_alcohol = -1.0 * 1.86 * (pacn_alcohol / 46.0684)

    return fp_sugars + fp_msnf + fp_salt + fp_alcohol

# ---------------------------------------------------------------------------
# Ice fraction / % water frozen (Gelatologist Part II formula)
# ---------------------------------------------------------------------------
def calc_ice_fraction(fp: float, ts_pct: float, serve_temp_c: float) -> tuple[float, float] | None:
    """
    Returns (ice_fraction, pct_water_frozen) or None if above FP.
    ts_pct: total solids as percentage.
    """
    if serve_temp_c >= fp:
        return None  # above freezing point, no ice
    xw = 1.0 - (ts_pct / 100.0)
    ln_arg = fp - serve_temp_c + 1
    if ln_arg <= 0:
        return None
    x_ice = (1.105 * xw) / (1.0 + 0.8765 / math.log(ln_arg))
    pct_wf = x_ice / xw if xw > 0 else 0.0
    return x_ice, pct_wf

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def celsius_to_fahrenheit(c: float) -> float:
    return c * 9 / 5 + 32

def format_temp(c: float) -> str:
    return f"{c:.2f}°C / {celsius_to_fahrenheit(c):.1f}°F"

def main():
    args = sys.argv[1:]

    ingredients_raw: list[str] = []
    total_override: float | None = None
    recipe_type: str = "sorbet"
    serve_temp: float = -12.0
    msnf_override: float | None = None
    ts_override: float | None = None

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--ingredient" and i + 1 < len(args):
            ingredients_raw.append(args[i + 1])
            i += 2
        elif a == "--total" and i + 1 < len(args):
            total_override = float(args[i + 1])
            i += 2
        elif a == "--type" and i + 1 < len(args):
            recipe_type = args[i + 1].lower()
            i += 2
        elif a == "--serve" and i + 1 < len(args):
            serve_temp = float(args[i + 1])
            i += 2
        elif a == "--msnf" and i + 1 < len(args):
            msnf_override = float(args[i + 1])
            i += 2
        elif a == "--ts" and i + 1 < len(args):
            ts_override = float(args[i + 1])
            i += 2
        else:
            print(f"Error: unknown argument {a!r}", file=sys.stderr)
            sys.exit(1)

    if not ingredients_raw:
        print("Error: no --ingredient arguments provided.", file=sys.stderr)
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    # Parse
    lines: list[IngredientLine] = []
    for raw in ingredients_raw:
        try:
            lines.append(parse_ingredient(raw))
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    total_grams = total_override if total_override else sum(l.grams for l in lines)
    if total_grams <= 0:
        print("Error: total recipe weight must be > 0", file=sys.stderr)
        sys.exit(1)

    # Derived totals
    total_water_grams = sum(l.water_grams for l in lines)
    total_msnf_grams = sum(l.msnf_grams for l in lines)
    water_pct = (total_water_grams / total_grams) * 100
    msnf_pct = msnf_override if msnf_override is not None else (total_msnf_grams / total_grams) * 100

    # Salt and alcohol PAC (for FP only — already counted in main PAC via table)
    salt_pac = sum(
        line.pac_contributions.get("salt", 0) * PAC_TABLE["salt"] / total_grams
        for line in lines
    )
    alcohol_pac = sum(
        line.pac_contributions.get("ethanol", 0) * PAC_TABLE["ethanol"] / total_grams
        for line in lines
    )

    # PAC
    pac, breakdown = calc_pac(lines, total_grams)
    water_frac = water_pct / 100.0
    pacn = pac / water_frac if water_frac > 0 else 0.0

    # Total solids
    total_sugar_grams = sum(net for _, _, _, net, _ in breakdown)
    ts_pct = ts_override if ts_override is not None else ((total_grams - total_water_grams) / total_grams) * 100

    # FP
    fp = calc_fp(pac, water_pct, msnf_pct, salt_pac, alcohol_pac)
    ice_result = calc_ice_fraction(fp, ts_pct, serve_temp) if fp is not None else None

    # Targets
    if recipe_type == "gelato":
        pac_target = (24, 28)
        serve_formula_label = "PAC / 2"
        serve_formula_temp = pac / 2
    else:
        pac_target = (30, 36)
        serve_formula_label = "PAC / 2.5"
        serve_formula_temp = pac / 2.5
    fp_target = (-3.0, -2.75)
    wf_target = (75, 80)

    # ---------------------------------------------------------------------------
    # Output
    # ---------------------------------------------------------------------------
    print(f"\n{'='*60}")
    print(f"PAC ANALYSIS — {recipe_type.upper()}  ({total_grams:.0f}g recipe)")
    print(f"{'='*60}\n")

    # Breakdown table
    print("INGREDIENT BREAKDOWN")
    print(f"  {'Ingredient':<22} {'Sugar':<26} {'Net g':>6}  {'PAC contrib':>11}")
    print(f"  {'-'*22} {'-'*26} {'-'*6}  {'-'*11}")
    last_ing = None
    for ing_name, ing_grams, sugar, net_grams, contrib in breakdown:
        if ing_name != last_ing:
            ing_label = f"{ing_name} ({ing_grams:.0f}g)"
            last_ing = ing_name
        else:
            ing_label = ""
        print(f"  {ing_label:<22} {sugar:<26} {net_grams:>6.1f}  {contrib:>10.3f}")

    # PAC summary
    in_range = pac_target[0] <= pac <= pac_target[1]
    range_flag = "✓ in range" if in_range else f"✗ target {pac_target[0]}–{pac_target[1]}"
    print(f"\n{'─'*60}")
    print(f"  Total recipe:        {total_grams:.0f}g")
    print(f"  Total water:         {total_water_grams:.1f}g  ({water_pct:.1f}%)")
    print(f"  Total solids (TS):   {ts_pct:.1f}%")
    if msnf_pct > 0:
        print(f"  MSNF:                {msnf_pct:.2f}%")
    print(f"\n  PAC:                 {pac:.2f}  [{range_flag}]")
    print(f"  Normalised PAC:      {pacn:.2f}")
    print(f"  Serving temp est.:   {format_temp(-serve_formula_temp)}  ({serve_formula_label})")

    # FP and ice fraction
    if fp is not None:
        fp_in_range = fp_target[0] <= fp <= fp_target[1]
        fp_flag = "✓ in range" if fp_in_range else f"✗ target {fp_target[0]} to {fp_target[1]}°C"
        print(f"\n  Freezing point:      {format_temp(fp)}  [{fp_flag}]  ⚠ approx")
        print(f"  (At serve temp {format_temp(serve_temp)})")
        if ice_result:
            x_ice, pct_wf = ice_result
            wf_in_range = wf_target[0] <= pct_wf * 100 <= wf_target[1]
            wf_flag = "✓ in range" if wf_in_range else f"✗ target {wf_target[0]}–{wf_target[1]}%"
            print(f"  Ice fraction:        {x_ice:.3f}")
            print(f"  % water frozen:      {pct_wf*100:.1f}%  [{wf_flag}]")
        else:
            print(f"  % water frozen:      n/a (above freezing point)")
    else:
        print(f"\n  Freezing point:      n/a (no water in recipe)")

    print(f"\n{'='*60}\n")
    print("NOTE: FP and %Wf are approximate. Verify against a")
    print("      reference recipe before relying on these values.\n")

if __name__ == "__main__":
    main()
