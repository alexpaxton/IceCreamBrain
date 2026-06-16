---
name: ingredient-lookup-vocs
description: Given any ingredient, identifies its primary volatile organic compounds (VOCs), looks up each compound's solubility in water, alcohol, and oil, and documents how temperature affects both solubility and compound stability. Checks a local reference doc first; saves new findings to it after a web search. Ends with a practical ice cream extraction recommendation.
---

# Ingredient Lookup: VOCs

## When to Use

- User asks "what's soluble in cinnamon?" or "how should I extract [ingredient]?"
- User wants to know whether to steep an ingredient in cream, milk, alcohol, or water
- User asks about flavor compounds in an ingredient
- User invokes `/ingredient-lookup-vocs`
- `categorize-ingredient` has classified an ingredient as **Flavoring** or **Both**
- `recipe-format` needs VOC smell/taste notes to populate the `flavors` frontmatter field
- User wants to understand the VOC profile of any ingredient (including base ingredients like whole milk)

---

## Scripts

All data operations use a single unified script:

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py <command> [args]
```

| Command | What it does |
|---------|-------------|
| `lookup ingredient <query>` | Exits 0 + JSON if found, 1 if not |
| `lookup compound <query>` | Exits 0 + JSON if found, 1 if not |
| `lookup compounds <n1> [n2 ...]` | Always exits 0; prints `{"found": {...}, "missing": [...]}` |
| `insert compound '<json>'` | Single insert; exits 1 if id already exists |
| `insert ingredient '<json>'` | Single insert; exits 1 if id already exists |
| `insert compounds '<json-array>'` | Batch insert; skips existing ids; prints summary |
| `insert ingredients '<json-array>'` | Batch insert; skips existing ids; prints summary |
| `pubchem '<json-array>'` | Batch-fetch PubChem data; outputs compound entry array |
| `flavordb <ingredient>` | Search FlavorDB; auto-fetches entity on single match |
| `flavordb <entity_id>` | Fetch FlavorDB entity directly by numeric id |

---

## Step 1 — Identify the ingredient

Extract the specific ingredient from the user's message. If ambiguous (e.g. "pepper" → black pepper vs. Sichuan pepper vs. white pepper), ask one clarifying question before proceeding.

---

## Step 2 — Check the local reference data first

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py lookup ingredient "<ingredient>"
```

- **Exit 0 (found):** the JSON output is the ingredient entry. Collect all `compound_id` values from its `compounds` array and batch-check them:

  ```
  python3 .claude/skills/ingredient-lookup-vocs/vocs.py lookup compounds <id1> <id2> ...
  ```

  All should be in `found`; use those entries. **Skip Steps 3 and 4.** Still do Step 5.

- **Exit 1 (not found):** continue to Step 3.

---

## Step 3 — Query FlavorDB

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py flavordb "<ingredient>"
```

Handle each `status`:

**`not_found`** → proceed to Step 3-Fallback.

**`found`** → proceed to Step 4-FlavorDB with the command output (contains `entity` and `molecules`).

**`multiple`** → present the `matches` list to the user, e.g.:

```
Multiple matches in FlavorDB for "mango":
1. Mango (fruit) — Mangifera
2. Mangosteen (fruit) — Garcinia
3. Purple mangosteen (fruit) — Garcinia mangostana
Which did you mean? (enter a number, or "none" to search the web instead)
```

Wait for the user's reply. If "none", proceed to Step 3-Fallback. Otherwise re-run with the chosen `entity_id`:

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py flavordb <entity_id>
```

Then proceed to Step 4-FlavorDB with that output.

---

## Step 3-Fallback — Web search for primary flavor compounds

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

Identify **all flavor compounds** documented in the sources — the goal is full coverage to enable overlap detection with other ingredients. Include dominant and secondary compounds; only exclude compounds with no odor or flavor significance (e.g., pure hydrocarbons listed without aroma notes).

Then proceed to Step 4-PubChem for each compound.

---

## Step 4-FlavorDB — Batch-check compound cache

The `flavordb` output from Step 3 contains:
- `entity` — ingredient metadata (`entity_id`, `name`, `scientific_name`, `flavordb_url`) — save for Step 6
- `molecules` — array pre-shaped for `vocs.py pubchem` input

Batch-check which compounds are already cached by passing all `molecules[].name` values:

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py lookup compounds <name1> <name2> ...
```

The result splits them into `found` (use stored data) and `missing` (need PubChem lookup).

Then proceed to Step 4-PubChem for only the `missing` compounds, passing the corresponding subset of `molecules`.

---

## Step 4-PubChem — Batch-fetch missing compounds from PubChem

**For compounds from FlavorDB:** build a JSON array from the missing molecules and run in one call:

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py pubchem '<json-array>'
```

Each array element should contain the FlavorDB fields:

```json
[
  {
    "name": "<common_name>",
    "pubchem_cid": <pubchem_id>,
    "odor": "<odor or null>",
    "taste": "<taste or null>",
    "fat_logp": <xlogp or null>
  }
]
```

The script fetches solubility and boiling point for each CID, parses the PubChem JSON structure, and outputs a complete compound entry array.

**Review the output before inserting.** The script applies heuristics to parse raw PubChem text — check that:
- `solubility.water` is a water value, not an alcohol or other-solvent value
- `solubility.alcohol` is present when the raw data mentions it
- `temp_notes` has the correct atmospheric boiling point (values with reduced pressure are flagged)
- `flavor_smell` looks right (built from the first `@`-segment of FlavorDB `odor` and `taste`)

Correct any misinterpretations in the JSON before proceeding to Step 6.

**For compounds from web search:** build the same array structure but omit `odor`, `taste`, and `fat_logp` if unknown. After the `pubchem` call, fill in `flavor_smell` and `fat_logp` from the web search results.

---

## Step 5 — Save to the reference data

**Only applies when data came from FlavorDB or web searches — skip if all data came from the local JSON files.**

**Before writing either file:** scan every temperature value in all fields. Any temperature expressed in only one unit must be converted and rewritten in both, e.g. `25°C (77°F)` or `100°C / 212°F`. Do not write entries with single-unit temperatures. (`vocs.py pubchem` output already applies dual-unit formatting automatically; check for any that were manually constructed.)

### New compounds (from Step 4-PubChem)

Insert all new compound entries at once:

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py insert compounds '<json-array>'
```

The script skips any ids that already exist and prints a summary. Each entry must match the compound schema:

```json
{
  "id": "<kebab-case-id>",
  "name": "<display name>",
  "aliases": [],
  "pubchem_cid": <integer or null>,
  "flavor_smell": "<notes>",
  "solubility": {
    "water": "<value>",
    "alcohol": "<value>",
    "fat_logp": "<value>"
  },
  "temp_notes": "<notes or —>",
  "sources": ["<url>"]
}
```

- If the compound came from FlavorDB, `fat_logp` is the `xlogp` value from FlavorDB; `pubchem_cid` is the `pubchem_id` from FlavorDB.
- Compound sources = chemical property URLs (PubChem, ChemicalBook, NIST WebBook, GoodScentsCompany for individual compounds). Research papers about the ingredient's overall VOC profile go on the ingredient instead.

### New ingredient (from Step 3 or Step 4-FlavorDB)

```
python3 .claude/skills/ingredient-lookup-vocs/vocs.py insert ingredient '<json>'
```

Entry schema:

```json
{
  "id": "<kebab-case-id>",
  "name": "<display name>",
  "scientific_name": "<string or null>",
  "variety": "<string or null>",
  "gcms_summary": "<string>",
  "compounds": [
    { "compound_id": "<string>", "percentage": <number or null>, "notes": "<string or null>" }
  ],
  "warnings": "<string or null>",
  "sources": ["<url>"]
}
```

- If data came from FlavorDB, `gcms_summary` should note "VOC profile from FlavorDB (entity_id: N)". Set `percentage` to `null` (FlavorDB does not provide abundance data). The ingredient source URL is `https://cosylab.iiitd.edu.in/flavordb2/entity_details?id=[entity_id]`.
- If data came from web search, `gcms_summary` summarizes what the GC-MS or aroma literature says. `percentage` is populated where available.

`percentage` is a decimal fraction (0.0–1.0) or `null`. Convert source strings:
- Range `"54–74%"` → midpoint: `(54 + 74) / 2 / 100` → `0.64`
- Approximate `"~39%"` → strip `~` and `%`: `0.39`
- Qualified upper bound `"up to 70%"` → `0.70`
- `"X% dry weight"` or `"X% of volatiles"` → strip qualifier, `X / 100`
- `"trace"`, `"trace–minor"`, or variety-specific values → `null`

Ingredient-specific caveats about a compound (e.g., acid sensitivity in context, crystallization risk, enzymatic generation) go in `compounds[].notes`. Safety/handling flags go in `warnings`.

Confirm to the user: **"Saved [Ingredient] to ingredients.json; added [N] new compound(s) to compounds.json."**

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skipping non-dominant compounds | Pull all compounds — full coverage enables ingredient overlap detection |
| Writing temperatures in only one unit | Every temperature must appear in both °C and °F before saving |
| Not reviewing `pubchem` output before inserting | The script uses heuristics — water/alcohol values and BPs can be misclassified |
| Reporting solubility without temperature | Always note the temperature at which the solubility value was measured |
| Skipping the LogP value | LogP is the most reliable single indicator of fat vs. water preference — always record it if available |
| Forgetting volatilization | Low-boiling-point compounds escape during cooking — this is the most practically important temperature effect for ice cream |
| Adding a summary or extraction guide | Save data only — no synthesis section, no output table |
| Running one `pubchem` call per compound | Pass the full missing-compounds array in one call |
