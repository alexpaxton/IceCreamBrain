---
name: create-recipe
description: Creates a simplified test recipe based on a flavor idea. Saves to recipes-in-testing/ with a v1 suffix. Format is a concept paragraph, ingredient list (targeting 1L), tools list, and procedure. Calls categorize-ingredient for unusual ingredients, ingredient-extraction for new flavorings, and handling-starches if starch is present.
---

# Create Recipe

## Trigger

User says "create recipe", "new recipe", "let's make a recipe", or invokes `/create-recipe`.

---

## Step 1 — Listen first

Ask the user one open question:

> **"What do you want to make?"**

Let them describe it however they like — flavor, style, constraints, inspiration, or any combination. Don't prompt for a style. Read what they give you, then infer direction in Step 2.

---

## Step 2 — Infer the plan and confirm

### 2a — Style

| Signal in description | Inferred style |
|-----------------------|---------------|
| "custard", "egg", "rich", "eggy", "custardy" | Custard |
| "Philadelphia", "Philly", "eggless", "no egg" | Philadelphia Style |
| "yogurt", "tangy", "tart base" | Frozen Yogurt |
| "sherbet" | Sherbet |
| "sorbet", "fruit only", "no dairy no egg" | Sorbet |
| Style not mentioned, dairy mentioned → default | Custard |
| Style not mentioned, dairy-free mentioned → default | Philadelphia Style (Dairy-free) |

### 2b — Dairy or dairy-free

Flag as dairy-free if the user says: "dairy-free", "vegan", "non-dairy", "plant-based", "no milk/cream", or names a specific non-dairy base (oat, cashew, almond, coconut, etc.) as the intended base.

### 2c — Which skills will be needed

For any ingredient that isn't obviously pure dairy, sweetener, or stabilizer, invoke `categorize-ingredient` to determine its role. Then invoke `suggest-techniques` on all Base and Both ingredients — it checks the full technique registry and returns which technique skills apply. Combined, their outputs determine which skills to dispatch:

| Condition | Skill to invoke |
|-----------|----------------|
| Always | `sweet-level` |
| Recipe is dairy-free | `create-dairy-alternative` |
| `suggest-techniques` flags starch treatment needed | `handling-starches` |
| `suggest-techniques` flags fat boost needed | `boost-fat-content` |
| Any ingredient is a store-bought product | `product-macros` |
| Any Flavoring/Both ingredient not in the `ingredient-extraction` reference doc | `ingredient-extraction` |

For `sweet-level`: use the total sugar weight from the proportion guide below and a default `sweetness_pct` of 75 (matching the standard 3:1 sucrose:glucose ratio) unless the user specifies otherwise or mentions an alternative sweetener. Splice the returned ingredient rows into the recipe table in place of the sugar/glucose lines. Append the FPD note after the ingredient table.

### 2d — Present the plan and confirm

```
**Style:** [inferred style]
**Dairy-free:** yes / no
**Approach:** [1–2 sentences on flavor direction or any technique considerations]
**Skills I'll use:** [list, or "none beyond standard"]

Say yes to proceed, or tell me what to change.
```

Do not generate any recipe content until the user confirms.

---

## Step 3 — Invoke skills for special ingredients

Run whichever apply. Independent lookups can run in parallel.

- **`categorize-ingredient`** — batch all ambiguous ingredients in one call before dispatching downstream skills
- **`ingredient-extraction`** — for Flavoring/Both ingredients not already in the reference doc; use the compound data to inform steeping medium and temperature in the procedure
- **`handling-starches`** — if starch_pct > 1.5%; its enzyme treatment step will be inserted into the procedure
- **`create-dairy-alternative`** — if dairy-free; its output defines the base ingredient list and any special prep
- **`product-macros`** — if a store-bought product is involved; ask the user to provide package photos before proceeding

---

## Step 4 — Build the test recipe

Read `.claude/skills/create-recipe/tools.md` before drafting. Reference only listed tools in the procedure.

Target a **~1L base** (approximately 950–1000g depending on density).

### Output format

```markdown
---
version: 1
---

# [Recipe Name] v1

[1 paragraph: the concept — what the flavor is, why this approach, any key technique choices or ingredient interactions worth noting]

## Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [name] |
| … | … |

## Tools

- [tool]
- …

## Procedure

**[Step label].** [Instructions.]
```

### Format rules

- Ingredients: two-column table, Qty (grams) | Ingredient; no percentage column, no total row
- Ingredient order: base liquids first, then fats/eggs, then sugars, then stabilizers, then flavorings
- Always include xanthan gum as a stabilizer at **1g per 1000g of total base**; scale proportionally if the recipe targets a different yield (e.g. 0.95g for a 950g base). It is not optional and needs no annotation.
- Tools: list only what's actually used in the procedure
- Procedure: bold each step label; cover only what's specific to this recipe
  - Omit standard steps the maker already knows: combining base liquids, tempering eggs, straining, chilling over ice bath, churning
  - Include: steeping approach and duration, infusion medium (informed by `ingredient-extraction` compound data), enzyme treatment if applicable, any non-obvious timing or temperature, special ingredient prep
- If `handling-starches` was invoked, include the enzyme treatment as a procedure step
- If `create-dairy-alternative` was invoked, describe the non-dairy base preparation as the first procedure step

---

## Step 5 — Iterate

After presenting the draft: **"What would you like to change?"**

Keep iterating until the user is satisfied. No macro recalculation required unless the user asks for it.

---

## Step 6 — Save

When the user signals the recipe is ready to test ("done", "save it", "looks good", "that's it"):

1. Slugify the recipe name (lowercase, hyphens, no special chars), append `-v1`
2. Create `recipes-in-testing/` if it doesn't exist
3. Save to `recipes-in-testing/<slug>-v1.md`
4. Confirm the path

No `recipe-format` validation — test recipes use their own simplified format.

---

## Proportion guide (per ~1L base)

Rough starting ranges by style. Adjust based on flavor ingredients.

| Style | Heavy cream | Whole milk | Egg yolks | Sugar | Glucose syrup |
|-------|------------|-----------|-----------|-------|--------------|
| Custard | 280–360g | 300–420g | 60–90g | 140–200g | 30–70g |
| Philadelphia | 340–400g | 280–380g | — | 140–200g | 30–70g |
| Frozen yogurt | 100–150g | 200–300g | — | 120–180g | 30–60g |
| Sherbet | 60–90g | 200–300g | — | 160–220g | 40–80g |
| Sorbet | — | — | — | 220–300g | 40–80g |

These are starting points, not constraints.
