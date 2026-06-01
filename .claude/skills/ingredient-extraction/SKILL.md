---
name: ingredient-extraction
description: Given a flavoring ingredient, identifies its primary flavor compounds, looks up each compound's solubility in water, alcohol, and oil, and documents how temperature affects both solubility and compound stability. Checks a local reference doc first; saves new findings to it after a web search. Ends with a practical ice cream extraction recommendation.
---

# Ingredient Extraction

## When to Use

- User asks "what's soluble in cinnamon?" or "how should I extract [ingredient]?"
- User wants to know whether to steep an ingredient in cream, milk, alcohol, or water
- User asks about flavor compounds in an ingredient
- User invokes `/ingredient-extraction`
- `categorize-ingredient` has classified an ingredient as **Flavoring** or **Both**
- `recipe-format` needs VOC smell/taste notes to populate the `flavors` frontmatter field

This skill applies to **flavoring ingredients only** — those added primarily for taste or aroma. For ingredients classified as **Base** by `categorize-ingredient`, use `ingredient-macros` instead. For ingredients classified as **Both**, both skills should be invoked.

---

## Step 1 — Identify the ingredient

Extract the specific ingredient from the user's message. If ambiguous (e.g. "pepper" → black pepper vs. Sichuan pepper vs. white pepper), ask one clarifying question before proceeding.

---

## Step 2 — Check the local reference doc first

Read `.claude/skills/ingredient-extraction/reference-doc.md`. Scan for a top-level `## [Ingredient]` heading matching the requested ingredient (case-insensitive; ignore minor wording differences like "Ceylon cinnamon" vs. "cinnamon").

- **If found:** use the stored data directly. Present it in the output format (Step 5). Skip Steps 3 and 4. Still do Step 6 (ice cream recommendation).
- **If not found:** continue to Step 3.

---

## Step 3 — Search for primary flavor compounds

Run a **WebSearch** for:

```
"[ingredient]" primary flavor compounds aroma chemistry
```

If that yields thin results, also try:

```
"[ingredient]" volatile compounds flavor chemistry GC-MS
```

Prefer sources in this order:
1. **PubChem** — pubchem.ncbi.nlm.nih.gov (authoritative chemical properties)
2. **The Good Scents Company** — thegoodscentscompany.com (flavor compound profiles)
3. **Sigma-Aldrich / Merck** — for chemical specifications
4. **Peer-reviewed food science journals** — e.g. *Journal of Agricultural and Food Chemistry*, *Food Chemistry*, *Flavour and Fragrance Journal*
5. **Fenaroli's Handbook of Flavor Ingredients** — if cited by other sources

Identify the **3–6 most significant flavor compounds** — those most responsible for the characteristic smell and taste of the ingredient. Do not list every trace compound. Focus on:
- The compound(s) that define the ingredient's recognizable character (e.g., cinnamaldehyde for cinnamon)
- Any compounds that provide secondary but distinctive notes

---

## Step 4 — Look up solubility and temperature data for each compound

For each identified compound, run a **WebSearch** then **WebFetch** on PubChem:

```
site:pubchem.ncbi.nlm.nih.gov "[compound name]"
```

Fetch the PubChem compound page. Look for values under **Solubility** and **Physical and Chemical Properties**. Capture:

### Solubility in each medium

| Medium | What to record |
|--------|---------------|
| Water | Quantitative if available (e.g., "1.2 g/L at 25°C"); otherwise qualitative: Insoluble / Slightly soluble / Moderately soluble / Soluble / Miscible |
| Ethanol / alcohol | Same scale; note if "miscible" (fully mixable in all proportions) |
| Oil / fat (lipids) | Lipophilicity; note if LogP value is available (LogP > 2 = strongly fat-soluble; LogP < 0 = prefers water) |

### Temperature effects

For each compound, document:
1. **Effect on solubility** — does heating increase or decrease how much dissolves in each medium?
2. **Stability** — does the compound degrade, volatilize, polymerize, or transform at temperatures relevant to cooking?
   - Volatilization threshold (compounds with low boiling points escape at cooking temps)
   - Degradation temperature (where the compound breaks down or converts to another compound)
   - Whether it survives boiling (100°C) and custard cooking (~80°C)
3. **Practical consequence** — e.g., "must be added after cooking to preserve", "benefits from long cold infusion", "heat-stable through standard custard process"

If temperature data is not on PubChem, search:

```
"[compound name]" thermal stability food processing
```

or:

```
"[compound name]" boiling point volatilization
```

---

## Step 5 — Format the output

One table per ingredient, one row per compound, no prose summaries:

```
## [Ingredient]

| Compound | Flavor/smell | Water | Alcohol | Fat (LogP) | Temp notes |
|----------|-------------|-------|---------|------------|------------|
| [name] | [notes] | [value] | [value] | [value] | [value] |
```

- If a value could not be found, write `—`
- LogP in the Fat cell if available (LogP > 2 = strongly fat-soluble; LogP < 0 = prefers water)
- Temp notes: flag volatilization threshold, stability at custard/boiling temps, or any transformation; write `—` if stable across all cooking temperatures

---

## Step 6 — Save to the reference doc

**Only applies when data came from web searches (Steps 3–4) — skip if the data came from the local reference doc.**

Append a new entry to `.claude/skills/ingredient-extraction/reference-doc.md` using the exact section structure described in that file's header. Add it in alphabetical order among the existing ingredient sections.

The entry must include:
- The `## [Ingredient]` heading
- One `### [Compound Name]` subsection per compound, each containing the solubility table, temperature effects, flavor/smell notes, and source URLs

Confirm to the user: **"Saved [Ingredient] extraction profile to the reference doc."**

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Listing every trace compound | Focus on the 3–6 that define the flavor character |
| Using only search snippets for solubility | Always WebFetch the PubChem page for precise values |
| Reporting solubility without temperature | Always note the temperature at which the solubility value was measured |
| Skipping the LogP value | LogP is the most reliable single indicator of fat vs. water preference — always record it if available |
| Forgetting volatilization | Low-boiling-point compounds escape during cooking — this is the most practically important temperature effect for ice cream |
| Adding a summary or extraction guide | Output is per-compound data only — no synthesis section |
