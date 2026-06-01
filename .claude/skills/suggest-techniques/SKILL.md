---
name: suggest-techniques
description: Given one or more ingredients with their categories, checks the technique registry and returns which technique skills apply and why. Called by create-recipe during planning; also invokable directly. See .claude/skills/techniques/index.md for the full technique list.
---

# Suggest Techniques

## When to Use

- Called by `create-recipe` during Step 2 planning, after `categorize-ingredient` has run
- User asks "what techniques apply to [ingredient]?" or invokes `/suggest-techniques`
- Any skill that processes ingredients wants to know if a transformation step is needed before formulation

---

## Technique Registry

| Trigger | Technique | Skill to invoke |
|---------|-----------|----------------|
| A Base or Both ingredient has starch content that would push total base starch above 1.5% | Enzyme starch conversion — alpha-amylase breaks starch into sugars before churning, eliminating chalky or gummy texture | `handling-starches` |
| Recipe is dairy-free and needs a non-dairy base liquid | Dairy alternative — produces a non-dairy liquid with equivalent macros to the combined cream + milk portion | `create-dairy-alternative` |
| A base liquid needs its fat% raised (e.g. oat milk being used in place of cream) | Fat boost — emulsifies oil into the liquid to raise fat content to a target% | `boost-fat-content` |
| A Flavoring or Both ingredient's primary flavor compounds are predominantly fat-soluble (LogP > 2) with low water and alcohol solubility per `ingredient-extraction` data | Oil extraction — extracts flavor into oil via sous vide, blending, or cold infusion; method chosen based on heat stability and physical structure of the ingredient | `oil-extraction` |

---

## Step 1 — Accept ingredients

Accept a list of ingredients with their quantities and categories from `categorize-ingredient`. If categories are not provided, run `categorize-ingredient` first.

For oil extraction checks, Flavoring and Both ingredients should also be evaluated — oil extraction is a flavoring technique, not a base-structure technique.

---

## Step 2 — Check each ingredient against the registry

For each Base or Both ingredient:

- **Starch check**: if the ingredient is known to be starchy (sweet potato, oats, chestnut, corn, cassava, taro, green banana, potato), estimate its starch contribution. If starch data is unknown, invoke `ingredient-macros`. Flag for `handling-starches` if total starch_pct > 1.5%.
- **Dairy-free check**: if the recipe has no dairy at all, flag for `create-dairy-alternative`.
- **Fat gap check**: if a non-dairy liquid is being used whose fat% is notably lower than what the recipe calls for, flag for `boost-fat-content`.

For each Flavoring or Both ingredient:

- **Oil extraction check**: if `ingredient-extraction` data is available, check the Fat (LogP) column. If dominant compounds have LogP > 2 and low water/alcohol solubility, flag for `oil-extraction`. If `ingredient-extraction` has not been run yet, note that this check should be revisited after it runs.

---

## Step 3 — Present recommendations and ask the user to choose

If no techniques apply, output: **"No technique intervention needed for these ingredients."** and stop.

Otherwise, present the flagged techniques to the user as a **multiple-choice question** using the `AskUserQuestion` tool (not as plain text). Rules:

- One question: **"Which techniques should be applied to this recipe?"**
- `multiSelect: true`
- One option per flagged technique; label = short technique name (e.g. "Oil extraction", "Starch conversion"); description = the ingredient, skill name, and one-sentence reason
- Always include a **"None — skip all techniques"** option

Wait for the user's answer before proceeding. Only return the user-selected techniques as the output of this skill. If `create-recipe` called this skill, pass only the selected techniques back to it for the **Skills I'll use** section.

---

## Notes

This skill routes — it does not execute. Each referenced technique skill handles its own full process and outputs a sub-recipe or method step. When called by `create-recipe`, its output populates the **Skills I'll use** section of the plan confirmation.
