---
name: add-technique
description: Scaffolds a new technique skill. Creates the SKILL.md with the correct structure and technique: true frontmatter, adds a row to the techniques index, and registers the trigger condition in suggest-techniques.
---

# Add Technique

## When to Use

- User describes a new ingredient transformation that should be reusable across recipes
- User invokes `/add-technique`

---

## Step 1 — Gather the spec

Ask (or infer from context):

1. **Name** — what is the technique called? (will become the skill name and folder)
2. **What it transforms** — which ingredient(s) or ingredient type does it apply to?
3. **Trigger condition** — what characteristic of an ingredient causes this technique to be needed? (e.g. "starch > 1.5%", "pure oil as base component")
4. **What it produces** — a sub-recipe? A method step? Updated macros? All three?
5. **Why it matters** — what problem does it solve or what does it enable?

Confirm with the user before writing anything.

---

## Step 2 — Create the skill file

Create `.claude/skills/<name>/SKILL.md` with this structure:

```markdown
---
name: <name>
description: Technique skill. <one sentence describing what it transforms and what it produces>.
technique: true
---

# <Title>

## When to Use

- `suggest-techniques` has flagged [ingredient type] for this technique
- User invokes `/<name>` directly
- [any other natural-language triggers]

This skill is a **technique**, not a recipe. It produces [sub-recipe / method step / updated macros] that feeds into a larger recipe.

---

## Step 1 — [first step]

[content]

---

## Step N — Confirm to the calling recipe

State:
- What was produced
- How to reference it in the main recipe
- Any macro profile to return to the caller
```

Fill in all steps based on the spec from Step 1. Reference only tools listed in `.claude/skills/create-recipe/tools.md`.

---

## Step 3 — Register in the techniques index

Read `.claude/skills/techniques/index.md`. Add a row to the **Registered Techniques** table:

```markdown
| `<name>` | <what it transforms> | <trigger condition — one sentence> |
```

Insert in alphabetical order by skill name.

---

## Step 4 — Register in suggest-techniques

Read `.claude/skills/suggest-techniques/SKILL.md`. Add a row to the **Technique Registry** table:

```markdown
| <trigger condition — when does this apply?> | <technique name — what it does in one phrase> | `<name>` |
```

---

## Step 5 — Confirm

Report all three files written:

```
Created:  .claude/skills/<name>/SKILL.md
Updated:  .claude/skills/techniques/index.md
Updated:  .claude/skills/suggest-techniques/SKILL.md
```
