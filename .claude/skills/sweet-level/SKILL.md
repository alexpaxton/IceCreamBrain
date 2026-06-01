---
name: sweet-level
description: Given a sweetness percent (0–100) and total sugar weight in grams, returns a sucrose/glucose split. Optionally substitutes an alternative sweetener (e.g. honey) and adjusts with glucose to maintain target sweetness. Ends with a freezing-point depression check and glucose-adjustment suggestion if needed.
---

# Sweet Level

## When to Use

- User asks to set or adjust sweetness of a recipe
- User asks how much sucrose and glucose to use for a given sweetness level
- `create-recipe` needs to determine the sugar split for a recipe
- User invokes `/sweet-level` directly
- User mentions an alternative sweetener and wants to know how to use it

---

## Inputs

| Input | Type | Required | Notes |
|---|---|---|---|
| `sweetness_pct` | number 0–100 | yes | 0 = all glucose (least sweet), 100 = all sucrose (most sweet) |
| `total_weight` | grams | yes | Total weight of sugar in the recipe |
| `sweetener` | string | no | Alternative sweetener name (e.g. "honey", "trehalose"). If omitted, default split is sucrose + glucose only. |

---

## Step 1 — Gather inputs

If any required input is missing, ask for it before proceeding. If `sweetener` is not provided, skip Steps 2–3 and go straight to Step 4a.

---

## Step 2 — Check sweetener reference table

Read `.claude/skills/sweet-level/sweetener-reference.csv`. Columns: `Sweetener, Relative_Sweetness, FPD, Notes, Source`.

- Match the requested sweetener case-insensitively.
- Treat "dextrose" as matching "Glucose / Dextrose".
- If a specific honey variety is given (e.g. "manuka honey"), treat it as a distinct row — do not match "Honey (average)".
- **If found:** use `Relative_Sweetness` and `FPD` directly. Skip Step 3.
- **If not found:** continue to Step 3.

---

## Step 3 — Look up and save unknown sweetener

Run a `WebSearch` for:
```
"[sweetener name]" relative sweetness sucrose = 100
```

Then `WebFetch` the most authoritative source (prefer USDA, food science journals, or Codex Alimentarius). Extract:
- Relative sweetness (sucrose = 100 scale)
- FPD value (sucrose = 1.0 scale); if not directly available, use molecular weight to estimate: monosaccharides ≈ 1.9, disaccharides ≈ 0.5–1.0

Append a row to `sweetener-reference.csv`:
```
Sweetener name,Relative_Sweetness,FPD,Brief note,https://source-url
```

**Honey special case:** If the sweetener is "honey" without a specific variety, store it as `Honey (average)` and note to the user: *"Using average honey values. Actual sweetness varies by variety (e.g. acacia vs. manuka). If you're using a specific type, I can look it up as a separate entry."*

---

## Step 4 — Calculate sweetener quantities

### 4a — Default (sucrose + glucose only)

```
sucrose_g = total_weight × (sweetness_pct / 100)
glucose_g = total_weight × (1 − sweetness_pct / 100)
```

### 4b — Alternative sweetener

```
target_sucrose_g   = total_weight × (sweetness_pct / 100)
alt_g              = target_sucrose_g × (100 / alt_relative_sweetness)
glucose_g          = total_weight − alt_g
```

**Edge cases:**
- If `glucose_g < 0`: the alternative sweetener alone exceeds the target sweetness at this weight. Cap `alt_g = total_weight`, set `glucose_g = 0`, and warn: *"[Sweetener] is sweet enough that [alt_g_capped]g hits the sweetness target — no glucose needed. Consider reducing total weight if you want to leave room for glucose's texture benefits."*
- If `alt_g > total_weight`: the sweetener is too weak to reach the target at this weight. Set `alt_g = total_weight`, `glucose_g = 0`, and warn: *"[Sweetener] can't reach [sweetness_pct]% sweetness at [total_weight]g — you'd need [calculated_needed]g, which exceeds the budget. Maximum achievable sweetness at this weight: [max_pct]%."*

---

## Step 5 — Freezing point depression check

Calculate the weighted FPD index for this sugar blend:

```
FPD_index = (Σ sweetener_g × FPD_value) / total_weight
```

For example, sucrose + glucose split:
```
FPD_index = (sucrose_g × 1.0 + glucose_g × 1.9) / total_weight
```

**Reference points:**
| FPD_index | Meaning |
|---|---|
| 1.0 | Pure sucrose — freezes hard |
| ~1.2 | Typical recipe default (75% sucrose / 25% glucose) |
| 1.9 | Pure glucose — freezes very soft |

**Acceptable range: 1.15–1.60**

- Below 1.15: too sucrose-heavy; ice cream may freeze hard. Suggest swapping some sucrose for glucose.
- Above 1.60: heavily monosaccharide-dominant; texture may be gummy or too soft.
- In range: confirm and proceed.

**If out of range — suggest glucose adjustment:**

To hit a target FPD_index `T`:
```
glucose_adj_g = (T × total_weight − sucrose_g × 1.0 − other_sweetener_g × FPD_other) / (1.9 − 1.0)
sucrose_adj_g = total_weight − glucose_adj_g − other_sweetener_g
```

Present the adjusted quantities alongside an updated sweetness_pct for the new split. Do not silently apply the adjustment — present it as a suggestion and let the user confirm.

---

## Step 6 — Output

### Called standalone (user invoked directly, or no recipe context in conversation)

```
## Sugar split — [total_weight]g at [sweetness_pct]% sweet

| Qty | Ingredient |
|-----|-----------|
| [sucrose_g]g | Sucrose |
| [alt_g]g | [Alternative sweetener, if used] |
| [glucose_g]g | Glucose / Dextrose |

**FPD index:** [value] ([status: in range / too low / too high])
[If out of range: "To bring FPD to [target], use [adj_glucose_g]g glucose and [adj_sucrose_g]g sucrose instead — effective sweetness [adj_pct]%."]
[If honey or average sweetener used: note about variety variation.]
```

### Called from `create-recipe` (recipe context present in conversation)

Return only:
1. The ingredient rows to splice into the broader recipe ingredient table (same format as the create-recipe table: `| [g] | [name] |`)
2. A one-line FPD note to append after the ingredient table: `> FPD index: [value] — [in range / adjustment suggestion]`

Do not emit headers or standalone formatting — the calling skill owns the document structure.
