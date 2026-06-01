---
name: iterate-recipe
description: Takes testing notes on an existing versioned recipe and produces a new incremented version file. Never modifies the source file. The new version carries a "Changes from vN" section documenting what was observed and what was adjusted.
---

# Iterate Recipe

## Trigger

- User says "I tested [recipe]", "here are my notes on [recipe]", "let's update [recipe]", or invokes `/iterate-recipe`
- User provides tasting or testing feedback on a recipe in `recipes-in-testing/`

---

## Step 1 — Identify the recipe

Determine which recipe file is being iterated:

- If the user names the recipe or file explicitly, locate the highest-versioned file matching that name in `recipes-in-testing/` (e.g. `recipes-in-testing/lemongrass-custard-v1.md`)
- If ambiguous (no name given, or multiple versions exist), ask: **"Which recipe are you iterating on?"** — list candidates if helpful
- Read the identified file in full before proceeding

---

## Step 2 — Collect testing notes

If the user has already provided notes inline, extract them from context. If they haven't yet, ask:

> **"What did you observe? Tell me what worked, what didn't, and anything you want to change."**

Let them describe freely. Probe with one follow-up if the notes are too thin to act on — e.g. "too sweet" without any other context might need "is the base overwhelming the flavor, or is the sugar level itself the issue?"

Do not suggest changes yet. Just listen and confirm you've understood the notes correctly.

---

## Step 3 — Propose adjustments

Based on the testing notes, propose specific changes to the recipe. Present them as a list before writing anything:

```
**Proposed changes for v[N+1]:**

- [Ingredient or step] — [what and why, e.g. "reduce sugar from 180g to 160g — base read as too sweet against the lemongrass"]
- …

Anything to add, remove, or change before I write the new version?
```

Wait for confirmation. Adjust the proposal if the user pushes back before proceeding.

---

## Step 4 — Build the new version

Determine the next version number by reading the `version` field from the source file's frontmatter and adding 1. The filename increments accordingly: `<slug>-v<N>.md` → `<slug>-v<N+1>.md`. The recipe title also increments: `[Recipe Name] v<N>` → `[Recipe Name] v<N+1>`.

Apply all confirmed adjustments. The format is identical to `create-recipe` output, with one addition — a **Changes** section inserted between the concept paragraph and the Ingredients table:

```markdown
---
version: [N+1]
---

# [Recipe Name] v[N+1]

[Concept paragraph — update only if the direction shifted meaningfully; otherwise carry forward as-is]

## Changes from v[N]

**Observations:** [1–3 sentences summarizing what the tester found]

**Adjustments:**
- [change 1]
- [change 2]
- …

## Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [name] |

## Tools

- [tool]

## Procedure

**[Step label].** [Instructions.]
```

If the concept paragraph is carried forward unchanged, that's fine — don't pad it.

---

## Step 5 — Save

1. Write the new version to `recipes-in-testing/<slug>-v<N+1>.md`
2. Do **not** modify or delete the source file
3. Confirm both paths to the user:

```
Saved: recipes-in-testing/<slug>-v<N+1>.md
Source preserved: recipes-in-testing/<slug>-v<N>.md
```
