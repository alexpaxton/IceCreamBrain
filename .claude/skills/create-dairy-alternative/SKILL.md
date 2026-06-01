---
name: create-dairy-alternative
description: Technique skill. Replaces the combined cream and milk portion of a recipe with a non-dairy liquid of equivalent macros. Calculates the dairy target from the recipe, helps the user choose a base liquid, invokes boost-fat-content to hit the fat target, and returns a sub-recipe with macros.
technique: true
---

# Create Dairy Alternative

## When to Use

- A recipe is dairy-free and needs a non-dairy base liquid
- User invokes `/create-dairy-alternative` directly
- `create-recipe` has flagged a dairy-free recipe

This skill is a **technique**. It produces a non-dairy base liquid that replaces the cream and milk portion of the recipe — not a finished ice cream.

---

## Step 1 — Identify the dairy being replaced

Read the recipe and sum all dairy ingredients (heavy cream, whole milk, buttermilk, half-and-half, etc.).

Calculate the **combined dairy macros** for the total:

```
combined_fat_pct   = Σ(ingredient_g × fat_pct) ÷ total_dairy_g
combined_water_pct = Σ(ingredient_g × water_pct) ÷ total_dairy_g
combined_protein_pct = Σ(ingredient_g × protein_pct) ÷ total_dairy_g
```

Use the quick-reference values from `create-recipe` or invoke `ingredient-macros` if a dairy ingredient is unusual.

Present the target:
```
Replacing [X]g dairy ([cream breakdown]):
Target: ~[fat]% fat / ~[water]% water / ~[protein]% protein
```

---

## Step 2 — Choose a base liquid

Check `.claude/skills/create-dairy-alternative/reference-table.md` first. If a matching formulation exists, offer to use it.

If not, present options and ask the user to choose:

| Option | Fat% (approx) | Flavor | Notes |
|--------|--------------|--------|-------|
| Oat milk (commercial) | 1–2% | Neutral, slightly sweet | Low protein; fat boost almost always needed |
| Cashew milk (commercial) | 1–3% | Mild, slightly nutty | Good neutral base |
| Soy milk (commercial) | 2–3% | Mild | Highest protein of commercial options (~3g/100g); closest to dairy protein |
| Full-fat coconut milk (canned) | 17–20% | Distinct coconut flavor | May not need fat boost; strong flavor commitment |
| Light coconut milk (canned) | 4–6% | Mild coconut | Some fat boost needed |
| Water | 0% | Completely neutral | Maximum control; fat boost supplies all fat and any flavor |

For commercial products, invoke `product-macros` to get exact macros before proceeding.

If the user wants oat milk and the recipe has a large amount (oat starch_pct > 1.5%), note that `handling-starches` may be needed for a homemade oat base.

---

## Step 3 — Calculate the fat gap

Compare the chosen base liquid's fat% to the dairy target fat%.

- If base fat% ≥ dairy target fat%: no fat boost needed. Note any protein or sugar adjustments if significant.
- If base fat% < dairy target fat%: invoke `boost-fat-content` with:
  - The base liquid weight and fat%
  - Target fat% (from Step 1)
  - Oil choice — ask if not clear:
    > **"Should the oil be flavor-neutral, or do you want to use it to introduce a specific flavor?"**
    
    If flavor is desired, invoke `oil-extraction` first, then pass the resulting flavored oil to `boost-fat-content`.

---

## Step 4 — Write the sub-recipe

Combine the base liquid preparation and the fat boost step into a sub-recipe:

```markdown
## [Name] Non-Dairy Base

*Makes: ~[X]g — replaces [list of dairy ingredients] in the main recipe*

### Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [base liquid] |
| [g] | [oil] |
| [g] | Sunflower lecithin |

### Method

[If base needs preparation (e.g. homemade oat milk): include those steps first]

[Insert boost-fat-content method block from Step 3]
```

---

## Step 5 — Save to reference table

After confirming the formulation works, append a row to each table in `.claude/skills/create-dairy-alternative/reference-table.md`:
- Formulation ratios (raw ingredient, water, oil per 100g output)
- Output macro profile (per 100g)
- Flavor and notes

---

## Step 6 — Confirm to the calling recipe

Return:
- Sub-recipe name
- Total weight
- Per-100g macro profile
- How to reference it in the main recipe's ingredient list (e.g. "replace 300g heavy cream + 400g whole milk with 700g Oat Non-Dairy Base")
