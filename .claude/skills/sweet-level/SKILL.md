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

If any required input is missing, ask for it before proceeding.

---

## Step 2 — Run the calculation script

Run `.claude/skills/sweet-level/sweet_level.py` with:

```
python3 .claude/skills/sweet-level/sweet_level.py <sweetness_pct> <total_weight_g> [sweetener_name]
```

- Omit `sweetener_name` for the default sucrose + glucose split.
- Pass the sweetener name (case-insensitive) when an alternative sweetener is in use.

**Exit codes:**
- `0` — success; stdout contains the formatted result; skip to Step 4
- `1` — input error (bad arguments)
- `2` — sweetener not in reference table; stderr contains `NOT_FOUND:<name>` — continue to Step 3 to look it up, then re-run

The script handles all edge cases (glucose_g < 0, alt_g > total_weight), FPD calculation, and FPD adjustment suggestions. Do not redo this math manually.

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

## Step 4 — FPD reference (for context only)

The script enforces acceptable range 1.15–1.60. Below 1.15 the ice cream may freeze hard; above 1.60 it may be gummy or too soft. Reference points:

| FPD_index | Meaning |
|---|---|
| 1.0 | Pure sucrose — freezes hard |
| ~1.2 | Typical recipe default |
| 1.9 | Pure glucose — freezes very soft |

Do not silently apply an FPD adjustment — present it as a suggestion and let the user confirm.

---

## Step 5 — Output

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
