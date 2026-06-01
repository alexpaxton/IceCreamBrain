---
name: recipe-macros
description: Given an ingredient list with quantities, looks up macros per ingredient using the ingredient-macros skill, then totals all macros across the full list and presents a combined breakdown table.
---

# Recipe Macros

## When to Use

- User provides a list of ingredients with weights and asks for the macro totals
- User wants to know the macronutrient breakdown of a full recipe or batch
- User asks "what are the macros for this recipe?" or "total macros for these ingredients"

## Steps

### 1 — Parse the ingredient list

Extract each ingredient as a pair: **name** and **weight in grams**. If quantities are given in non-gram units (oz, cups, tbsp, etc.), convert to grams before proceeding. If a weight is ambiguous or missing, ask the user to clarify before continuing.

### 2 — Look up macros for each ingredient

For each ingredient, invoke the `ingredient-macros` skill via the `Skill` tool. All ingredient lookups are independent — run them **in parallel** (multiple `Skill` tool calls in a single response) to save time.

Each call returns a per-100g breakdown: Water, Fat, Sugars, Starch, Protein, Other solids.

### 3 — Scale each ingredient's macros to its actual weight

For each ingredient with weight W grams and per-100g macro values, compute the macro mass:

```
macro_mass = W × (macro_per_100g ÷ 100)
```

Example: 250g heavy cream with 36g fat per 100g → 250 × 0.36 = 90g fat

Do this for all six macros: Water, Fat, Sugars, Starch, Protein, Other solids.

### 4 — Sum macros across all ingredients

Add up each macro column to get the total for the full ingredient list.

| Macro | Ingredient 1 | Ingredient 2 | … | Total |
|-------|-------------|-------------|---|-------|

The grand total grams should equal (or be very close to) the sum of all ingredient weights — if it drifts more than 1%, recheck your math.

### 5 — Format the output

Present two tables:

**Table 1 — Per-ingredient contribution (grams)**

| Ingredient | Weight | Water | Fat | Sugars | Starch | Protein | Other solids |
|------------|--------|-------|-----|--------|--------|---------|--------------|
| [Ingredient 1] | Xg | Xg | Xg | Xg | Xg | Xg | Xg |
| [Ingredient 2] | Xg | Xg | Xg | Xg | Xg | Xg | Xg |
| … | … | … | … | … | … | … | … |
| **Total** | **Xg** | **Xg** | **Xg** | **Xg** | **Xg** | **Xg** | **Xg** |

**Table 2 — Macro totals as % of total weight**

| Macro | g | % of total |
|-------|---|------------|
| Water | Xg | X% |
| Total fat | Xg | X% |
| Total sugars | Xg | X% |
| Starch | Xg | X% |
| Protein | Xg | X% |
| Other solids | Xg | X% |
| **Total** | **Xg** | **100%** |

### 6 — Flag formulation notes

After the tables, add a short note (2–4 sentences) on anything significant for ice cream formulation: whether water is too high (icy result), sugars are in range for freeze point depression, fat level for the target style, or any ingredient whose macro data came from an internet lookup rather than the local reference table (flag for lower confidence).

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running ingredient lookups sequentially | Call all `ingredient-macros` skills in parallel |
| Forgetting to scale per-100g values to actual weight | Always multiply: `W × (macro ÷ 100)` |
| Totals not matching sum of weights | Recheck: grand macro total must ≈ total ingredient weight |
| Skipping starch column | Include it explicitly even if zero — it affects formulation |
