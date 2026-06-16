---
name: categorize-ingredient
description: Determines whether an ingredient functions as a flavoring, a base ingredient, or both in a given ice cream recipe. Routes to the correct downstream skills: ingredient-lookup-vocs for flavorings, ingredient-macros and handling-starches for base ingredients.
---

# Categorize Ingredient

## When to Use

- Any skill needs to determine which downstream tools to invoke for an ingredient
- `create-recipe` is deciding which skills to run for an unusual ingredient
- `recipe-format` is identifying flavoring ingredients to source VOC notes from
- User asks "is [X] a flavoring or base ingredient?"

---

## Step 1 — Gather context

Identify:
1. The ingredient name
2. Its weight or percentage in the recipe (if known — request it if not)
3. The recipe style (custard, Philadelphia, sorbet, etc.) if known

If called from another skill, these values should be passed in.

---

## Step 2 — Classify

Apply the following rules in order.

### Always Base

Unconditionally base regardless of quantity:
- **Dairy:** heavy cream, whole milk, buttermilk, half-and-half, condensed milk, skim/whole milk powder
- **Eggs** or egg yolks
- **Plain sweeteners:** granulated sugar, sucrose, glucose syrup, dextrose, invert sugar, treacle
- **Stabilizers/emulsifiers:** xanthan gum, guar gum, locust bean gum, carrageenan, lecithin
- **Water**
- **Non-dairy base liquids:** oat milk, cashew cream, almond milk, coconut milk/cream
- **Honey, maple syrup, agave** — treated as sweetener replacements, not flavorings

### Always Flavoring

Unconditionally flavoring regardless of quantity:
- **Pure extracts and essences:** vanilla extract, almond extract, rose water, orange blossom water
- **Spices at ≤ 3% of recipe:** cinnamon, cardamom, ginger, black pepper, clove, star anise, nutmeg
- **Herbs at ≤ 3% of recipe:** mint, basil, tarragon, thyme
- **Spirits/alcohol at < 5% of recipe:** brandy, rum, bourbon, amaretto, etc.
- **Steep-and-strain ingredients:** tea bags, coffee beans, citrus zest (when strained out and not weighed into the final base)

### Quantity + Purpose test (everything else)

| Condition | Classification |
|-----------|---------------|
| ≤ 3% of total recipe weight AND added for taste/aroma | **Flavoring** |
| > 10% of total recipe weight | **Base** (and possibly also **Both** if it has strong flavor character) |
| 3–10% of total recipe weight | Evaluate purpose — see below |

**Purpose evaluation for the 3–10% range:** Does this ingredient move the macro totals (water %, fat %, sugar %, protein %) meaningfully? If yes → **Base** or **Both**. If its macro contribution is incidental and it's present solely for taste → **Flavoring**.

### Common ambiguous ingredients

| Ingredient | Classification | Notes |
|------------|---------------|-------|
| Cocoa powder | **Both** | Always affects macros meaningfully; also the primary flavoring |
| Nut paste (almond, hazelnut, pistachio, tahini, peanut butter) | **Both** if > 5%; **Flavoring** if ≤ 5% | High fat and protein at larger amounts |
| Fruit purée | **Both** if > 10%; **Flavoring** if ≤ 10% | High water content affects iciness above ~10% |
| Matcha powder | **Flavoring** if ≤ 3%; **Both** if > 3% | Protein and chlorophyll become formulation-relevant at higher doses |
| Miso paste | **Both** | Flavor ingredient but contributes significant salt and protein |
| Starchy vegetables (sweet potato, taro, chestnut, oat) | **Both** | Even when used for flavor, their starch and bulk require `handling-starches` |
| Lemon/lime juice | **Flavoring** if ≤ 5%; **Both** if > 5% | Acid affects flavor; at high quantities also affects texture/protein |
| Ground spices at > 3% | **Both** | Starch and fat become formulation-relevant at high concentrations |
| Spirits/alcohol at ≥ 5% | **Both** | Affects freezing point at higher quantities |

---

## Step 3 — State downstream skills

For each ingredient:

```
**[Ingredient]** — [Flavoring / Base / Both]

- Rationale: [1–2 sentences]
- Skills to invoke:
  - `ingredient-lookup-vocs` — yes / no
  - `ingredient-macros`     — yes / no
  - `handling-starches`     — yes (if Base or Both AND likely starchy) / no
```

---

## Step 4 — Batch mode

If called with a full ingredient list, classify all in one pass and present a summary table:

| Ingredient | Weight | % | Category | ingredient-lookup-vocs | ingredient-macros | handling-starches |
|------------|--------|---|----------|-----------------------|-------------------|-------------------|
| Heavy cream | 300g | 30% | Base | — | ✓ (quick-ref) | — |
| Whole milk | 400g | 40% | Base | — | ✓ (quick-ref) | — |
| Granulated sugar | 120g | 12% | Base | — | ✓ (quick-ref) | — |
| Sweet potato purée | 80g | 8% | Both | ✓ | ✓ | ✓ |
| Vanilla extract | 10g | 1% | Flavoring | ✓ | — | — |

Follow the table with a consolidated dispatch list — which skills need to run and for which ingredients — so the calling skill can issue the lookups efficiently.

---

## Notes

### handling-starches applies only to Base and Both

Starchy ingredients used purely as flavorings at trace amounts (e.g., a pinch of ground cinnamon) will rarely push `starch_pct` above the 1.5% threshold. Always flag them for `handling-starches` when classified as Base or Both; let `handling-starches` Step 1 make the final call via the threshold check.

### ingredient-macros for flavoring ingredients

Pure flavorings at trace amounts (≤ 2% of recipe) don't need `ingredient-macros` — their macro contribution is negligible. For flavorings in the 2–5% range that are also classified as **Both**, run `ingredient-macros` since their contribution is formulation-relevant.
