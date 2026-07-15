---
name: calculate-pac
description: Calculates PAC (Potere Anti-Congelante / anti-freezing power) for an ice cream or sorbet recipe. Outputs per-ingredient PAC breakdown, total PAC, Normalised PAC, estimated serving temperature, freezing point (approximate), and % water frozen. Uses the PAC lookup table from the Gelatologist articles and icecreamcalc.com formulas.
---

# Calculate PAC

## When to Use

- User asks for the PAC of a recipe
- User invokes `/calculate-pac` directly
- A recipe is being balanced and freeze point / scoopability needs checking
- User asks whether a recipe will be too hard or too soft

---

## Inputs

| Input | Required | Notes |
|---|---|---|
| Ingredient list with grams | yes | From recipe or inline |
| Recipe type | yes | `gelato` or `sorbet` |
| Serving temperature | no | Default: -12°C / 10.4°F |
| MSNF % | no | Auto-derived from dairy ingredients |
| Total solids % | no | Auto-derived from ingredients |

---

## PAC Lookup Table

These are the values used in the script. Source: Gelatologist article image + allulose from George Leung article.

| Ingredient | Type | PAC |
|---|---|---|
| Agave syrup | Sugar | 180 |
| Allulose | Sugar | 190 |
| Dextrose | Sugar | 190 |
| Ethanol | Alcohol | 740 |
| Fructose | Sugar | 190 |
| Glucose Syrup DE 42 | Sugar | 129 |
| Glucose Syrup Powder DE 38 | Sugar | 129 |
| Grape sugar | Sugar | 190 |
| Honey | Sugar | 190 |
| Inulin | Fibre | 25 |
| Invert Sugar | Sugar | 172 |
| Lactose | Sugar | 100 |
| Maltitol | Polyol | 99 |
| Maltodextrin DE 18 | Starch | 129 |
| Maple Syrup | Sugar | 100 |
| Polydextrose | Fibre | 60 |
| Salt | Salt | 585 |
| Sorbitol | Polyol | 190 |
| Sucrose | Sugar | 100 |
| Trehalose | Sugar | 100 |
| Xylitol | Polyol | 220 |

Built-in ingredient presets (sugar + water composition): `sucrose`, `dextrose`, `fructose`, `invert_sugar`, `trehalose`, `lactose`, `sorbitol`, `maltitol`, `xylitol`, `allulose`, `inulin`, `polydextrose`, `salt`, `ethanol`, `glucose_syrup_de42`, `glucose_syrup_powder_de38`, `maltodextrin_de18`, `honey`, `agave_syrup`, `maple_syrup`, `grape_sugar`, `milk_whole`, `cream_35`, `cream_49`.

---

## Step 1 — Parse the recipe

Extract all ingredients and their gram weights from the recipe or conversation. Identify:
- Which ingredients match built-in presets (use the preset name)
- Which are fruit purees, custom bases, or other non-preset items (user must specify composition)

If any ingredient has unknown sugar composition, ask the user before proceeding:
> "I don't have sugar composition data for [ingredient]. Can you tell me the approximate sugar % and water % by weight? Or should I skip it?"

---

## Step 2 — Build the command

Construct the `--ingredient` arguments:

**Built-in preset** (name must match preset key exactly):
```
--ingredient "sucrose:200"
--ingredient "milk_whole:500"
--ingredient "dextrose:50"
```

**Custom ingredient with known composition:**
```
--ingredient "lychee_puree:300:fructose:0.10:sucrose:0.05:water:0.82"
--ingredient "lemon_juice:250:fructose:0.04:sucrose:0.01:water:0.93"
```

Stack as many sugar types as needed. Water and msnf are special keys (not PAC-bearing).

---

## Step 3 — Run the script

```bash
python3 .claude/skills/calculate-pac/pac_calculator.py \
  --ingredient "..." \
  [--ingredient "..."] \
  --total TOTAL_GRAMS \
  --type gelato|sorbet \
  --serve TEMP_C
```

`--total` should match the recipe total. `--serve` defaults to -12 if omitted.

---

## Step 4 — Interpret and report results

Print the full script output verbatim, then add a short interpretation:

**PAC targets (from Gelatologist articles):**
- Gelato: 24–28 (serving temp = –PAC/2 °C)
- Sorbet: 30–36 (serving temp = –PAC/2.5 °C)

**Freezing point target:** –2.75°C to –3.0°C / –27.0°F to –26.8°F

**% Water frozen target:** 75–80% at serving temperature
- ~75%: softer (Bologna-style)
- ~80%: firmer

If PAC is outside target, note the direction:
- Too low → will freeze hard, reduce water or increase sugar
- Too high → will freeze soft, increase water or reduce/swap sugars

Do not suggest specific fixes unless the user asks — just flag the direction.

---

## Formulas reference (for transparency)

**PAC:**
```
PAC = sum(ingredient_grams × purity × PAC_value) / total_recipe_grams
```

**Normalised PAC:**
```
PACn = PAC / (total_water% / 100)
```

**Freezing point (approximate, icecreamcalc.com + Goff & Hartel):**
```
x = PACn
FPse = -(1.8e-9·x⁴ – 1.5486e-6·x³ + 4.066439e-4·x² + 4.29570733e-2·x + 0.1564927407)
FPmsnf = -(MSNF% × 2.37) / water%
FP = FPse + FPmsnf  (+ salt/alcohol terms if present)
```

**% Water frozen (Gelatologist Part II):**
```
Xw = 1 – TS/100
X_ice = (1.105 × Xw) / (1 + 0.8765 / ln(FP – T + 1))
%Wf = X_ice / Xw
```

FP and %Wf are flagged as approximate in the output. The PAC number is confirmed against the Gelatologist worked example (PAC 24.2).
