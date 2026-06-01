---
name: boost-fat-content
description: Technique skill. Raises the fat content of any liquid by emulsifying oil into it. Oil can be neutral (flavorless) or a flavored oil from oil-extraction. Returns the updated liquid weight, ratio, and per-100g macros.
technique: true
---

# Boost Fat Content

## When to Use

- `create-dairy-alternative` needs to raise a base liquid's fat to match a dairy target
- A recipe uses a low-fat liquid that needs a richer fat profile
- User invokes `/boost-fat-content` directly
- `suggest-techniques` flags an oil as needing to be incorporated into a base liquid

This skill is a **technique**. It operates on an existing liquid — it does not choose what that liquid is.

---

## Step 1 — Confirm inputs

Gather:
- **Base liquid**: name, weight (g), and current fat% (from `product-macros`, `ingredient-macros`, or known values)
- **Target fat%**: what fat% should the finished liquid have
- **Oil**: neutral (grapeseed, sunflower, refined coconut) or a specific flavored oil from `oil-extraction`

If the oil choice is unclear, ask: **"Should the oil be neutral, or do you want to use a flavored oil here?"**

---

## Step 2 — Calculate

```
oil_g     = base_g × (target_fat_pct − base_fat_pct) ÷ (1 − target_fat_pct)
lecithin_g = (base_g + oil_g) × 0.005
total_g   = base_g + oil_g + lecithin_g
```

Example: 700g oat milk at 1.5% fat → target 17% fat
```
oil_g      = 700 × (0.17 − 0.015) ÷ (1 − 0.17) = 700 × 0.187 = 130.7g
lecithin_g = (700 + 130.7) × 0.005 = 4.2g
total_g    = 834.9g  →  final fat% ≈ (700 × 0.015 + 130.7) ÷ 834.9 = 16.9% ✓
```

Weigh lecithin on the milligram scale.

---

## Step 3 — Write the process

This produces a method block (not a full sub-recipe) to be inserted into the parent sub-recipe or procedure:

```
**Boost fat.** Add [base liquid] and [lecithin_g]g sunflower lecithin to the Vitamix. 
Let the lecithin hydrate for 2 minutes. With the blender running on low, stream in 
[oil_g]g [oil name] slowly. Ramp to high for 30 seconds until the mixture is fully 
opaque and homogeneous.
```

---

## Step 4 — Return updated macros

Calculate per-100g macros for the boosted liquid:

```
fat_per_100g    = (base_g × base_fat_pct + oil_g) ÷ total_g × 100
water_per_100g  = (base_g × base_water_pct) ÷ total_g × 100
protein_per_100g = (base_g × base_protein_pct) ÷ total_g × 100
sugars_per_100g  = (base_g × base_sugar_pct) ÷ total_g × 100
```

Return to the calling skill:
- Total weight of boosted liquid
- Per-100g macro profile
- The method block from Step 3
