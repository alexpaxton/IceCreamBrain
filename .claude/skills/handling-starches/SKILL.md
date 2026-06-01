---
name: handling-starches
description: Technique skill. Detects high-starch ingredients in a recipe, calculates alpha-amylase enzyme dosing, adds an enzyme treatment step to the method, accounts for water loss during extended cooking, and recalculates macros to reflect starch-to-sugar conversion.
technique: true
---

# Handling Starches

## When to Use

- User invokes `/handling-starches` directly
- Any other skill (create-recipe, create-dairy-alternative, recipe-macros) encounters an ingredient with notable starch content
- User mentions a starchy ingredient: oats, sweet potato, potato, taro, chestnut, corn, cassava, rice, banana (green/unripe), plantain, or similar
- `categorize-ingredient` has classified a starchy ingredient as **Base** or **Both**

This skill applies **only to base ingredients**. If a starchy ingredient is classified as a pure **Flavoring** by `categorize-ingredient` (e.g., a small amount of ground cinnamon or rice flour used as a trace flavoring), its starch contribution is typically negligible. In all cases, Step 1's `starch_pct > 1.5%` threshold check is the definitive test — run it regardless of category when starchy ingredients are present.

This skill produces **two outputs**: (1) an enzyme treatment step to insert into the recipe method, and (2) a corrected macro table with starch converted to sugars.

---

## Step 1 — Identify starchy ingredients

For each ingredient in the recipe, check its starch content using the `ingredient-macros` skill. Run all lookups in parallel.

Calculate starch contributions for all ingredients, sum them, and compare against the total recipe weight:

```
starch_contribution = ingredient_weight × (starch_per_100g ÷ 100)
total_starch = sum of all starch_contributions
starch_pct = total_starch ÷ total_recipe_weight × 100
```

Enzyme treatment is **required** if `starch_pct > 1.5%`. At that level, unconverted starch will produce a chalky, gummy texture in the finished ice cream.

Common high-starch ingredients for reference:

| Ingredient | Starch per 100g |
|------------|----------------|
| Rice (raw) | ~79g |
| Oats (raw) | ~60g |
| Corn / maize | ~74g |
| Chestnut | ~36g |
| Cassava | ~35g |
| Taro | ~28g |
| Sweet potato | ~17g |
| Potato | ~15g |
| Green/unripe banana | ~15–20g |

If `starch_pct ≤ 1.5%`, note the total starch percentage to the user and stop — no enzyme treatment is needed.

---

## Step 2 — Calculate enzyme dose

Use alpha-amylase at **¼ tsp per liter of liquid in the recipe**.

The relevant liquid is the total weight of all liquid ingredients (dairy or non-dairy base, water, liquid purees, etc.) in grams. Since 1 liter of water ≈ 1000g, treat grams as milliliters for dosing purposes.

```
total_liquid_g = sum of all liquid ingredient weights
dose_tsp = (total_liquid_g ÷ 1000) × 0.25
dose_tsp = round to nearest ⅛ tsp for practicality
```

Example: 800g total liquid → 0.8 liters → 0.8 × 0.25 = **0.2 tsp** (round to ¼ tsp)

State the dose clearly in the treatment step.

---

## Step 3 — Write the enzyme treatment step

Insert the following as a dedicated method step **before** the main cook (before boiling the dairy/base). It replaces any generic "combine ingredients" step for the starchy ingredient.

Adapt the bracketed values to the specific recipe:

```
**Enzyme treatment.** Combine [starchy ingredient(s)] with [liquid — dairy base, water, or non-dairy base] 
in a heavy-bottomed saucepan. Weigh the pot and contents together and note the weight — you will 
need this number. Heat over low-medium heat, stirring, until the mixture reaches 65°C / 150°F. 
Add [dose]g alpha-amylase (¼ tsp per liter), stir to incorporate, and maintain the temperature 
between 62–68°C / 144–154°F for 45–60 minutes, stirring every 5–10 minutes. Use a thermometer — 
below 60°C the enzyme stalls; above 72°C it denatures and stops working.

**Tip:** Cover the pan loosely or use a low oven at 65°C to hold temperature with less attention. 
Some evaporation is unavoidable.

**Kill the enzyme.** Raise the heat and bring the mixture to a full boil (80°C+ / 176°F+) for 
2 minutes. This denatures the alpha-amylase and locks in the conversion.

**Restore weight.** Remove from heat and let cool to below 50°C. Weigh the pot and contents 
again. Add filtered water to bring the total back to the pre-cook weight noted above. Stir well 
before proceeding.
```

If the recipe already has a step that heats the liquid above 80°C (e.g. custard cooking), the "kill the enzyme" instruction can be folded into that step — just note that the high-heat step serves double duty.

---

## Step 4 — Recalculate the macro table

Alpha-amylase converts starch to sugars (primarily maltose). For formulation purposes, treat the conversion as:

```
converted_sugars ≈ starch_contribution   (gram-for-gram; the mass difference from hydrolysis is negligible at recipe scale)
```

Update the recipe's macro breakdown table:
- **Starch** → subtract the converted amount (set to ~0 for fully treated ingredients)
- **Total sugars** → add the same amount
- **All other macros** → unchanged
- **Total weight** → unchanged (water re-addition restores the pre-cook weight)

Present the updated table with a note:

```
*Starch values reflect post-enzyme-treatment conversion. [Xg] starch → [Xg] additional sugars.*
```

---

## Step 5 — Flag freeze-point impact

If the converted starch adds **more than 20g of sugars** to the recipe, flag it:

```
⚠️ Freeze-point note: enzyme treatment converts [X]g of starch to sugars, 
raising total sugars from [before]% to [after]% of the base. This lowers the 
freezing point and will produce a softer ice cream. Consider reducing other 
sugars (sucrose or glucose syrup) by [X]g to compensate if you want firmer texture.
```

Compute the suggested reduction as the full gram amount of converted starch, applied to glucose syrup first (lower sweetness impact), then sucrose if more reduction is needed.

If the converted starch adds fewer than 20g of sugars, note the conversion briefly but no adjustment is needed.

---

## Step 6 — Summarize changes

After presenting the treatment step and updated macros, give a brief summary:

```
**Starch handling summary**
- Flagged ingredient(s): [list]
- Total starch converted: ~[X]g
- Enzyme dose: [X] tsp alpha-amylase
- Treatment: 45–60 min at 62–68°C, then heat to 80°C+ to kill
- Water re-addition: weigh before, restore weight after cooking
- Macro impact: +[X]g sugars, −[X]g starch
- [Freeze-point flag if applicable]
```

---

## Notes

### Temperature window

Alpha-amylase has a narrow active range. Stay between **62–68°C / 144–154°F**:
- Below 60°C: enzyme is largely inactive
- 62–68°C: optimal conversion speed
- Above 72°C: enzyme begins denaturing rapidly
- Above 80°C: enzyme is fully denatured (used intentionally to stop conversion)

A probe thermometer and occasional adjustment is the most reliable approach. A sous vide circulator is ideal if available.

### Conversion completeness

45–60 minutes at temperature converts most (but not all) starch. Very dense or whole preparations (e.g. whole oat groats rather than rolled oats) may need longer or benefit from a blending step first to expose more starch surface. Flag this if the starchy ingredient is coarse or whole.

### Oats specifically

Oat starch gelatinizes readily at 60–68°C and responds well to alpha-amylase. This is the same process commercial oat milk manufacturers use to produce sweetness without added sugar. The treated oat liquid will taste notably sweeter and less grainy than untreated — this is the desired outcome.

### Purees vs. raw ingredient

If the starchy ingredient is being used as a puree (e.g. sweet potato puree, roasted chestnut paste), the starch has already gelatinized during cooking, which makes it more accessible to the enzyme. Treatment time can be reduced to 30 minutes.

### Interaction with other skills

- **categorize-ingredient**: run this first when it's unclear whether a starchy ingredient is functioning as a base component or purely a flavoring. Only Base and Both classifications warrant starch treatment; Step 1's threshold check confirms whether treatment is actually required.
- **create-dairy-alternative**: if the non-dairy base uses oats, this skill should be applied to the oat base during Step 5 of that skill — before the macros are finalized. The post-treatment starch and sugar values are what should be used in the base's macro profile.
- **recipe-macros**: if run before enzyme treatment, the starch column will be inflated. Note this and re-run or adjust after treatment.
