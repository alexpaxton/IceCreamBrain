---
name: flavor-balance
description: Given a set of flavoring ingredients, calls ingredient-lookup-vocs for each, compares their flavor compound profiles, and produces a report classifying the combination as complementary (high compound overlap) or contrasting (low or no overlap), with a breakdown of which ingredients share which compounds and which flavor notes will be emphasized.
---

# Flavor Balance

## When to Use

- User asks "how do these flavors work together?" or "will X and Y pair well?"
- User wants to know if a set of ingredients will be complementary or contrasting
- User invokes `/flavor-balance`

---

## Step 1 — Identify the ingredients

Extract the list of ingredients from the user's message. Minimum two ingredients required. If any ingredient is ambiguous (e.g. "pepper", "citrus"), resolve the ambiguity with one clarifying question before proceeding.

---

## Step 2 — Run ingredient-lookup-vocs for each ingredient

Invoke the `ingredient-lookup-vocs` skill for every ingredient in the list. Run all lookups **in parallel** — do not wait for one to complete before starting the next.

Collect the full compound profile for each ingredient: compound names, flavor descriptors (the role/description), and PubChem CIDs where available.

Do not present the individual extraction profiles to the user — they are intermediate data for the analysis in Steps 3–5.

---

## Step 3 — Build the compound map

Construct a table mapping every compound to the ingredient(s) it appears in. Use compound names as the canonical key; treat entries as matching if they refer to the same compound (same PubChem CID, or identical common name with at most minor spelling variation — e.g. "geranial" and "α-citral" are the same compound).

Example internal structure:

| Compound | Ingredient A | Ingredient B | Ingredient C |
|----------|-------------|-------------|-------------|
| Linalool | ✓ | ✓ | — |
| Geranial | — | ✓ | ✓ |
| β-Caryophyllene | — | — | ✓ |

Only include a compound as shared if it appears in **two or more** ingredients.

---

## Step 4 — Score the overlap

Count:
- **S** = number of shared compounds (appearing in 2+ ingredients)
- **T** = total unique compounds across all ingredients

Compute an overlap ratio: **S / T**

Use this threshold to classify:

| Overlap ratio | Classification |
|--------------|---------------|
| ≥ 0.25 (25% of all compounds are shared) | **Complementary** |
| < 0.25 | **Contrasting** |

If S = 0, it is always **Contrasting** regardless of T.

If S ≥ 1 but ratio is below 0.25, still note the shared compound(s) — the flavors are mostly contrasting but with one connecting thread.

---

## Step 5 — Determine which flavors will be emphasized

**For complementary combinations:**
Shared compounds appear in multiple ingredients — they will be reinforced and perceived as louder or more prominent. Name these compounds and their flavor character. Unique compounds in each ingredient will recede somewhat into the shared backdrop.

**For contrasting combinations:**
Each ingredient's character notes stand alone with little or no blurring. Identify the primary character compound(s) of each ingredient — these will be the distinct, individually-perceptible notes in the combination. Also note whether any contrast is likely to create tension (compounds with opposite character that may clash) vs. simply distinct (compounds with different characters that stay separate).

---

## Step 6 — Write the report

Present the results using this structure:

```
## Flavor Balance Report — [Ingredient 1], [Ingredient 2], [Ingredient N]

### Classification: [Complementary / Contrasting]

[1–2 sentences explaining the classification: how many compounds are shared, what that means
for how the combination will taste.]

---

### Compound Overlap

| Compound | Flavor Character | [Ingredient 1] | [Ingredient 2] | [Ingredient N] |
|----------|-----------------|---------------|---------------|---------------|
| [shared compound] | [descriptor] | ✓ | ✓ | — |
| [shared compound] | [descriptor] | — | ✓ | ✓ |

*No overlapping compounds* — (only if S = 0)

---

### Flavors Emphasized

**[Complementary — use this block if complementary:]**
The combination will amplify **[shared compound(s)]** — the [flavor descriptor] note will be
the loudest element of the combination. Each ingredient also contributes unique notes
([list unique compounds per ingredient]) that add variety around that shared core.

**[Contrasting — use this block if contrasting:]**
Each ingredient's character note will be individually perceptible:
- **[Ingredient 1]:** [primary compound] → [flavor descriptor]
- **[Ingredient 2]:** [primary compound] → [flavor descriptor]
- …

[If any ingredients share even one compound despite the contrasting classification, note it
as a "connecting thread" — a subtle bridge between otherwise distinct flavors.]

[1 sentence on whether the contrast is likely to be harmonious (different but not clashing)
or tense (opposing characteristics — e.g. camphor coolness against sharp citral acidity).]
```

Keep the report concise. The compound overlap table should be complete; the prose sections should each be 2–4 sentences.

---

## Step 7 — Ask to proceed

After delivering the report, ask:

> **"Would you like to create a recipe using these ingredients?"**

If yes, invoke the `create-recipe` skill.
