---
name: product-macros
description: Given photos of a store-bought product's packaging, extracts nutrition facts, ingredients, and total package size to produce a per-100g macro profile consistent with other skills. Checks the reference doc first; saves new products after confirmation.
---

# Product Macros

## When to Use

- User invokes `/product-macros` directly
- User shares a photo of a product package and asks about its macros
- A store-bought product is being used in a recipe and its macro profile is unknown
- User wants to add a product to the reference for future use

---

## Step 1 — Check the reference doc first

Before reading any images, read `.claude/skills/product-macros/reference-table.md` and scan the **Product** and **Brand** columns for a match (case-insensitive).

If a match is found, present it:

```
I have [Product] by [Brand] ([Size]) in the reference:

| Macro | per 100g |
|-------|---------|
| Fat | Xg |
| Water | Xg |
| Sugars | Xg |
| Starch | Xg |
| Protein | Xg |
| Other solids | Xg |

Want to use this, or re-read the package to update it?
```

If the user confirms the saved entry, use those values and skip to Step 5 (formulation notes). If they want to re-read or update, proceed through all steps and overwrite the saved entry at the end.

---

## Step 2 — Read the package images

The user will have provided one or more images — either pasted directly into the chat or as file paths. Read all images provided:
- If file paths are given: use the `Read` tool on each
- If images are pasted inline: they are visible in context — read them directly

**Required data — request additional photos if any of these are missing:**

| Data point | Typically found on |
|------------|-------------------|
| Product name and brand | Front label |
| Flavor / variety (if applicable) | Front label |
| Total package weight or volume | Front label or bottom |
| Serving size (with unit: g, ml, oz, tbsp, etc.) | Nutrition facts panel |
| Servings per container | Nutrition facts panel |
| Total fat (g per serving) | Nutrition facts panel |
| Total carbohydrate (g per serving) | Nutrition facts panel |
| Dietary fiber (g per serving) | Nutrition facts panel |
| Total sugars (g per serving) | Nutrition facts panel |
| Protein (g per serving) | Nutrition facts panel |
| Ingredients list | Back or side label |

If the nutrition facts panel is hard to read (small text, glare, angle), ask the user to provide a clearer photo of that panel specifically before proceeding.

---

## Step 3 — Convert serving values to per-100g

### 3a — Establish serving size in grams

If the serving size is given in grams: use it directly.

If given in volume (ml, fl oz, cups, tbsp, etc.):
- For water-based liquids (syrups, juices, milks): 1ml ≈ 1g
- For cream or thick liquids: 1ml ≈ 1.01–1.05g (use 1g unless density is known)
- For dry goods by volume (tbsp, cups): use standard volume-to-mass conversions, or note that the conversion is approximate

If serving size is ambiguous, note the assumption made.

### 3b — Scale each nutrient to per 100g

```
nutrient_per_100g = (nutrient_per_serving ÷ serving_size_g) × 100
```

Apply to: total fat, total carbohydrate, dietary fiber, total sugars, protein.

### 3c — Derive starch and water

```
starch = total_carbs_per_100g − dietary_fiber_per_100g − total_sugars_per_100g
water  = 100 − fat_per_100g − total_carbs_per_100g − protein_per_100g
other_solids = dietary_fiber_per_100g + (100 − fat − water − total_carbs − protein)
```

> Water is derived, not labeled. The formula works because fat + protein + total carbs accounts for essentially all non-water, non-ash mass. Ash (minerals) is small enough (~0.5–2g/100g) that it falls into rounding.

**Sanity checks:**
- Water should be ≥ 0. If negative, label rounding has inflated the macros — note this and cap water at 0, distributing the overage into other solids.
- All macros should sum to ~100g. If the sum is off by more than 2g, flag it.
- Caloric check: `(fat × 9) + (protein × 4) + (net_carbs × 4) + (fiber × 2)` should be within ~10% of the labeled calories per serving. Flag if not.

---

## Step 4 — Present the macro profile

```
## [Product Name] — [Brand] ([Size])

**Serving size:** [X]g ([original label description])
**Servings per container:** [X]

### Macro Profile (per 100g)

| Macro | g per 100g |
|-------|-----------|
| Water | Xg |
| Total fat | Xg |
| Total sugars | Xg |
| Starch | Xg |
| Protein | Xg |
| Other solids | Xg |
| **Total** | **~100g** |

### Ingredients
[Full ingredients list as read from label]

### Notes
[Any relevant flags: water derived, caloric check result, volume-to-mass conversion assumptions, label rounding issues]
```

---

## Step 5 — Formulation notes

After the table, add a brief note (2–4 sentences) on what this product means for ice cream formulation:
- Is water content high enough to affect iciness?
- Is the sugar content significant for freeze-point depression?
- Is fat content meaningful relative to the total recipe?
- Any ingredients of note (stabilizers, emulsifiers, acids) that affect texture or flavor?

---

## Step 6 — Save to reference doc

If the product is not already in the reference (or the user asked to update an existing entry), save it to `.claude/skills/product-macros/reference-table.md`.

Append (or update) one row in the **Products** table:

```
| [Product name] | [Brand] | [Size] | [fat] | [water] | [sugars] | [starch] | [protein] | [other_solids] | [serving_size_g] | [notes] |
```

Use a concise but unambiguous product name (e.g., `Sweetened condensed milk`, `Oat milk, barista blend`, `Caramel sauce`). Include the flavor/variety in the name if it meaningfully affects the macros.

Confirm to the user: **"Saved [Product] by [Brand] to the product reference."**

---

## Common Issues

| Issue | Resolution |
|-------|-----------|
| Serving size in pieces/units, not grams | Ask user for package weight and divide by number of servings to get serving size in grams |
| Added sugars listed but total sugars not | Total sugars = added sugars + natural sugars; if natural sugars unknown, flag as "≥ added sugars" |
| "Less than 1g" entries | Use 0.5g for calculation; note the assumption |
| Two nutrition panels (e.g. dry and prepared) | Use the **as-sold** (dry/undiluted) panel unless the user specifies otherwise |
| Foreign label with different format | Extract the same data points regardless of label format; note the country/standard |
