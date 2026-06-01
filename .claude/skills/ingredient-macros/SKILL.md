---
name: ingredient-macros
description: Given a food ingredient, look up its macronutrient breakdown (water, fat, protein, total sugars, starch, other solids) formatted as percentages, with at least one citation. Checks a local reference table first before searching the internet, and saves new findings back to the reference table for future use.
---

# Ingredient Macros Lookup

## When to Use

- User asks "what are the macros for X?"
- User asks "what's the nutritional breakdown of X?"
- User needs to know the water, fat, protein, sugar, or starch content of an ingredient
- User is building a recipe and wants precise macronutrient data for a specific ingredient
- `categorize-ingredient` has classified an ingredient as **Base** or **Both**

This skill applies to **base ingredients** — those that contribute meaningfully to the recipe's macro profile (water, fat, sugars, protein). Pure flavorings at trace amounts (≤ 2% of recipe) do not need this skill; their macro contribution is negligible. For ingredients classified as **Both** by `categorize-ingredient`, run this skill alongside `ingredient-extraction`.

## Steps

### 1 — Identify the ingredient

Extract the specific ingredient from the user's message. If ambiguous (e.g. "cream" → heavy cream vs. light cream), ask one clarifying question before proceeding.

### 2 — Check the local reference table first

Read `.claude/skills/ingredient-macros/reference-table.csv`. The file uses comma-separated values with a header row: `Ingredient,Water,Fat,Sugars,Starch,Protein,Other solids,Source`. Scan for a row matching the ingredient (case-insensitive, ignore minor wording differences like "raw" vs. "fresh").

- **If found:** use those values directly. Present them with the citation stored in the table. Skip steps 3 and 4. Still do step 5 (format the output) and step 6 (formulation notes).
- **If not found:** continue to step 3.

### 3 — Search the internet for data

Run a **WebSearch** for:

```
site:fdc.nal.usda.gov "[ingredient name]"
```

USDA FoodData Central is the primary source of truth. If the ingredient is not found or the USDA entry is sparse, also search:

```
"[ingredient name]" macronutrient breakdown per 100g
```

Prefer sources in this order:
1. **USDA FoodData Central** — fdc.nal.usda.gov (most authoritative)
2. **Nutritionix** or **Cronometer** — reliable third-party databases that source from USDA
3. **Published food science literature** — e.g. Codex Alimentarius, peer-reviewed journals

### 4 — Fetch the data page

Use **WebFetch** to retrieve the actual page content so you can read precise gram values. Do not rely solely on search snippets — fetch the source page to get accurate numbers.

### 5 — Extract and verify values

From the source, extract **per-100g values** for:

| Macro | Notes |
|-------|-------|
| Water | Moisture content |
| Total fat | Includes saturated, unsaturated |
| Total sugars | Mono- and disaccharides combined |
| Starch | If present; 0 for most dairy/meat |
| Protein | |
| Other solids | Calculated: 100 − (water + fat + sugars + starch + protein). Captures fiber, minerals, organic acids, etc. |

All values should sum to **exactly 100g**. If the raw source values don't sum to 100, normalize them proportionally and note that you did so.

### 6 — Format the output

Present the breakdown as a table. Because values are per 100g, **grams = percent directly** — multiply any weight by the decimal (e.g. 0.36) to get mass of that macro.

```
## [Ingredient Name] — Macronutrient Breakdown

| Macro         | g per 100g | %    |
|---------------|-----------|------|
| Water         | Xg        | X%   |
| Total fat     | Xg        | X%   |
| Total sugars  | Xg        | X%   |
| Starch        | Xg        | X%   |
| Protein       | Xg        | X%   |
| Other solids  | Xg        | X%   |
| **Total**     | **100g**  | **100%** |

**To calculate macro mass from a given weight:**
  mass of macro = ingredient weight (g) × (macro % ÷ 100)
  Example: 250g [ingredient] × 0.XX = XXg [macro]

**Source:** [Full citation — author/organization, title, URL, access date]
```

Include at least **one citation**. If you used multiple sources to fill in missing values, cite all of them.

### 7 — Flag notable values

After the table, add a brief note (1–3 sentences) on anything that would matter for ice cream formulation: high water content (affects iciness), high sugar (lowers freezing point), high fat (richness and texture), low solids (may need balancing).

### 8 — Save to the reference table

**Only applies when data came from the internet (step 3 onward) — skip if the data came from the local reference table.**

Append a new row to `.claude/skills/ingredient-macros/reference-table.csv` using this format:

```
Ingredient name,Xg,Xg,Xg,Xg,Xg,Xg,https://source-url
```

Columns are: **Ingredient,Water,Fat,Sugars,Starch,Protein,Other solids,Source**

Use the canonical ingredient name (e.g. `Green peas, raw`). Values should be numeric grams-per-100g (no "g" suffix). The Source column should be a bare URL. If the file is empty or missing its header, write the header row first:

```
Ingredient,Water,Fat,Sugars,Starch,Protein,Other solids,Source
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using search snippet values without fetching the source page | Always WebFetch the USDA or source page for precise numbers |
| Values not summing to 100 | Calculate "Other solids" as the remainder; normalize if needed |
| Omitting starch entirely | Include it explicitly (as 0 if absent) — it matters for formulation |
| Citing a generic nutrition label instead of a primary database | Prefer USDA FoodData Central; note if only secondary sources were available |
| Skipping the citation | Always include at least one full citation with URL |
