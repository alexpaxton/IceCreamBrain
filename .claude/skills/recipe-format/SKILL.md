---
name: recipe-format
description: Enforces consistent formatting for all created or updated recipes. Validates and auto-corrects frontmatter, checks required body sections are present and in the right order, and derives flavor tags from the smell/taste notes of the volatile organic compounds in the flavoring ingredients. Called by create-recipe and create-dairy-alternative before saving; also invokable directly to lint an existing file.
---

# Recipe Format

## When to Use

- Automatically called by `create-recipe` (Step 7) and `create-dairy-alternative` (Step 10) before any recipe is saved
- User invokes `/recipe-format` directly to lint or reformat an existing recipe file
- Any skill that modifies and re-saves a recipe file must call this skill first

This skill applies **only to recipes in `recipes-in-testing/` and any user-created recipe files** — not to the source Dana Cree recipes in `dana-cree-recipes/`.

---

## Step 1 — Get the recipe content

If invoked directly by the user:
- If a file path is given, read it with the `Read` tool
- If recipe content is pasted inline, use it from context

If called by another skill, receive the recipe content as a string before it is written to disk. Apply formatting, then return the corrected content for the calling skill to write.

---

## Step 2 — Validate and correct the frontmatter

Every recipe file must begin with a YAML frontmatter block. Validate each field against the schema below. Auto-correct anything that can be inferred; flag anything that cannot.

### Required fields

**`status`** — lifecycle stage of the recipe

| Allowed value | Meaning |
|---------------|---------|
| `untested` | Created but never made |
| `tested` | Made at least once |
| `approved` | Tested and considered successful |
| `archived` | Retired |

Default for new recipes: `untested`. If the field is missing, set it to `untested`. If the value is not in the list, flag it and ask the user to choose.

---

**`style`** — ice cream style

| Allowed value | Matches |
|---------------|---------|
| `custard` | Custard, egg-based |
| `philadelphia` | Philadelphia-style, no eggs |
| `frozen-yogurt` | Frozen yogurt |
| `sherbet` | Sherbet |
| `sorbet` | Sorbet |

Infer from the recipe's `**Style:**` body line if the frontmatter field is missing. Normalize case and spacing (e.g. "Philadelphia Style" → `philadelphia`, "Frozen Yogurt" → `frozen-yogurt`). Flag if it cannot be inferred.

---

**`dairy-free`** — boolean

Allowed values: `true` or `false` (unquoted YAML booleans).

Infer from recipe content if missing: `true` if the recipe contains a non-dairy base sub-recipe or if no dairy ingredients (cream, milk, butter, egg yolks) appear in the ingredient table.

---

**`created`** — ISO date, `YYYY-MM-DD`

Set to today's date if missing. Never modify an existing value.

---

### Optional fields

**`updated`** — ISO date, `YYYY-MM-DD`

Set or update to today's date whenever a recipe file is modified after initial creation. Do not add this field on first save.

---

**`flavors`** — YAML list of smell/taste notes derived from the volatile organic compounds in the recipe's flavoring ingredients

For each flavoring ingredient in the recipe, check the `ingredient-extraction` reference doc for its documented VOC flavor/aroma notes. Collect every distinct note across all flavoring ingredients and list them as individual tags. These are free-form descriptors taken directly from the compound profiles — not a fixed vocabulary.

```yaml
flavors:
  - vanilla
  - creamy
  - woody
  - floral
```

- Identify the flavoring ingredients (i.e. those contributing aroma/taste, not base dairy/sweeteners/stabilizers). If an ingredient's role is ambiguous, run `categorize-ingredient` to confirm before deciding whether to pull VOC notes from it.
- Pull the smell/taste notes from their VOC profiles in the `ingredient-extraction` reference doc; run `ingredient-extraction` for any ingredient not yet documented
- For ingredients classified as **Both**, include their VOC notes in `flavors` — they contribute flavor even though they also affect the base
- Deduplicate and list all notes
- Use lowercase, hyphenate multi-word notes (e.g. `stone-fruit`, `dried-fruit`)

---

**`sub-recipes`** — YAML list of sub-recipe names as they appear in the file

```yaml
sub-recipes:
  - Cashew Non-Dairy Base
  - Enzyme-Treated Sweet Potato Puree
```

Infer by scanning the file for `## ` headings that appear after the first `---` divider. If no dividers exist, omit the field.

---

### Corrected frontmatter template

```yaml
---
status: untested
style: custard
dairy-free: false
created: YYYY-MM-DD
flavors:
  - vanilla
---
```

---

## Step 3 — Validate the body structure

Check that the following sections are present and in this order. Auto-insert missing structural elements where the content is unambiguous; flag the rest.

### Main recipe structure

| Element | Format | Required |
|---------|--------|----------|
| Recipe title | `# [Name]` — H1, first line after frontmatter | Yes |
| Style line | `**Style:** [value]` | Yes |
| Makes line | `**Makes:** between 1 and 1½ quarts` | Yes |
| Headnote | 1–3 sentences of plain prose, no heading | Yes |
| Ingredients heading | `## Ingredients` | Yes |
| Ingredients table | Three columns: `Ingredient \| g \| %` | Yes |
| Xanthan gum line | Immediately after the ingredients table, before the next heading | Yes |
| Macro breakdown heading | `## Macroingredient Breakdown` | Yes |
| Macro table | Four columns: `Macroingredient \| g \| % of base` | Yes |
| Method heading | `## Method` | Yes |
| Method steps | Bold step labels, e.g. `**Boil the dairy.**` | Yes |
| Notes heading | `## Notes` | Recommended |

### Xanthan gum line format

Must read exactly:

```
Xanthan gum — 1g | ¼ tsp, blended into the fully chilled base before churning
```

If another texture agent is present instead (cornstarch, tapioca, commercial stabilizer), replace it with the standard xanthan gum line and move the alternative to the `## Notes` section as an option.

### Ingredient table format

```markdown
| Ingredient | g | % |
|------------|---|---|
| Heavy cream | 300g | 30% |
| Whole milk | 400g | 40% |
| **Total base** | **~1000g** | **100%** |
```

- Last row must be the bolded total
- Percentages must sum to 100%
- Weights must sum to approximately 1000g (flag if <900g or >1100g)

### Macro table format

```markdown
| Macroingredient | g | % of base |
|-----------------|---|-----------|
| Water | Xg | X% |
| Total fat | Xg | X% |
| Total sugars | Xg | X% |
| Protein | Xg | X% |
| Other solids | Xg | X% |
| **Total** | **~1000g** | **100%** |
```

Row order must be: Water, Total fat, Total sugars, Protein, Other solids, Total.

### Sub-recipe structure

Each sub-recipe is separated from the main recipe and from other sub-recipes by a `---` divider. Within a sub-recipe:

| Element | Format |
|---------|--------|
| Sub-recipe heading | `## [Name]` |
| Output note | `*Makes: ~[X]g — replaces [ingredient(s)] in the main recipe*` in italics |
| Ingredients heading | `### Ingredients` |
| Ingredients table | Two columns: `Ingredient \| g` |
| Method heading | `### Method` |
| Method steps | Numbered list with bold step labels |
| Macro comparison | `### Macro comparison` table (optional but encouraged) |

---

## Step 4 — Flag and report

After checking, report what was auto-corrected and what still needs attention:

```
**Recipe Format Check — [Recipe Name]**

✅ Auto-corrected:
- Added missing `status: untested`
- Inferred `flavors: [nut, spice]` from ingredients
- Standardized xanthan gum line

⚠️ Needs your input:
- `style` could not be inferred — please specify: custard | philadelphia | frozen-yogurt | sherbet | sorbet
- Ingredient table percentages sum to 98% — check weights

ℹ️ Recommended:
- Consider adding a `## Notes` section
```

If everything is valid, confirm: **"Format looks good — ready to save."**

---

## Step 5 — Write the corrected file

If called by another skill: return the corrected content string to the calling skill to write.

If called directly on an existing file: write the corrected content back to the same path using the `Edit` or `Write` tool. Confirm the path to the user.
