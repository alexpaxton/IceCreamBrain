# Techniques Index

Technique skills transform an ingredient into an ice cream-appropriate form before it enters a recipe. They are distinct from recipes — they produce a prepared ingredient or sub-recipe, not a finished product.

Use `suggest-techniques` to route ingredients to the correct technique(s) automatically. The individual technique skills can also be invoked directly.

---

## Registered Techniques

| Skill | Transforms | Trigger |
|-------|-----------|---------|
| `handling-starches` | Starchy ingredients (sweet potato, oats, chestnut, etc.) | Starch contribution > 1.5% of base weight — enzymes convert starch to sugars, eliminating chalky/gummy texture |
| `boost-fat-content` | Any liquid that needs a higher fat% | A base liquid (commercial non-dairy milk, water, etc.) needs its fat raised to match a dairy or recipe target — emulsifies oil into the liquid using lecithin |
| `create-dairy-alternative` | Combined cream + milk portion of a recipe | Recipe is dairy-free — produces a non-dairy liquid with equivalent macros to replace the whole dairy portion; typically invokes `boost-fat-content` |
| `oil-extraction` | Flavoring ingredients with fat-soluble compounds (LogP > 2) | Primary flavor compounds are fat-soluble and low water/alcohol-soluble per `ingredient-extraction` data — extracts into oil via sous vide, blending, or cold infusion depending on heat stability |

---

## Adding a New Technique

Create a skill at `.claude/skills/<name>/SKILL.md` with `technique: true` in the frontmatter. Add a row to the table above and add a corresponding entry to the registry in `suggest-techniques/SKILL.md`.
