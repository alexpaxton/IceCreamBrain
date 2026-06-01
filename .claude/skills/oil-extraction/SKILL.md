---
name: oil-extraction
description: Technique skill. Extracts flavor compounds from an ingredient into oil to produce a flavored oil for use in a recipe. Chooses between three methods — sous vide warm extraction, blend extraction, or cold infusion — based on the ingredient's heat stability and physical structure, informed by ingredient-extraction compound data.
technique: true
---

# Oil Extraction

## When to Use

- `suggest-techniques` has flagged a flavoring ingredient for oil extraction (primary compounds are fat-soluble, LogP > 2, with low water and alcohol solubility)
- User invokes `/oil-extraction` directly
- User asks how to extract flavor from an ingredient like pea shoots, herbs, spices, or aromatics into oil

This skill is a **technique**, not a recipe. It produces a flavored oil that is incorporated into the main recipe as a flavor component.

---

## Step 1 — Confirm compound solubility

If `ingredient-extraction` data is already available for the ingredient, read the compound table. Confirm that the dominant flavor compounds have:
- Fat (LogP) column: LogP > 2 (strongly fat-soluble), or qualitatively "oil-soluble"
- Water column: low (Insoluble or Slightly soluble)

If `ingredient-extraction` has not been run, invoke it now. Oil extraction is only the right technique when fat is the primary extraction medium — if the compounds are also water- or alcohol-soluble, mention that those vectors may be more practical or complementary.

---

## Step 2 — Select the extraction method

Work through this decision tree in order:

### Is the ingredient heat-stable?

Check the **Temp notes** column in the `ingredient-extraction` compound table. The ingredient is heat-stable if the dominant compounds:
- Do not volatilize below 100°C (boiling point well above custard cooking temps)
- Are not flagged as degrading or transforming at 65–70°C
- Have no acid-sensitivity or enzyme-sensitivity warnings that heat would accelerate

**If heat-stable → use Method A (sous vide warm extraction)**

### If not heat-stable: can the ingredient be broken down mechanically?

The ingredient can be blended or ground if it is:
- Soft, leafy, or fleshy (herbs, shoots, fruit flesh, blanched vegetables)
- A spice or dried ingredient that a spice grinder can reduce to a fine powder

**If mechanically workable → use Method B (blend extraction)**

### If neither:

The ingredient is heat-sensitive and cannot be efficiently blended or ground (e.g. a delicate dried flower, a volatile resin, a fragile citrus zest).

**→ use Method C (cold infusion)**

---

## Step 3 — Calculate ratios and write the sub-recipe

### Method A — Sous vide warm extraction

**Ratio:** 1 part ingredient : 3–5 parts neutral oil by weight (use more oil for subtler ingredients; less for strong ones like spices)

**Temperature:** 60–65°C / 140–149°F for 1–2 hours. Stay below 70°C to avoid driving off volatile compounds even if the ingredient is broadly heat-stable.

```markdown
## [Ingredient] Oil (Sous Vide)

*Makes: ~[X]g — use [quantity] in the main recipe as a flavor component*

### Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [ingredient] |
| [g] | Neutral oil (grapeseed or sunflower) |

### Method

1. **Bag.** Combine [ingredient] and oil in a vacuum bag. Seal using the chamber vacuum sealer.
2. **Extract.** Cook sous vide at 63°C / 145°F for [1–2] hours.
3. **Strain.** Pass through the tamis (60-mesh) or a fine mesh strainer. Press to extract all oil; discard solids.
4. **Cool.** Let the oil come to room temperature before using or storing.
```

---

### Method B — Blend extraction

Best for soft, leafy, or fleshy ingredients. A blanching step before blending is recommended for green ingredients to deactivate oxidative enzymes (lipoxygenase, peroxidase) that would otherwise cause rapid off-flavor and color loss.

**Ratio:** 1 part ingredient : 2–3 parts neutral oil by weight

```markdown
## [Ingredient] Oil (Blend)

*Makes: ~[X]g — use [quantity] in the main recipe as a flavor component*

### Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [ingredient] |
| [g] | Neutral oil (grapeseed or sunflower) |

### Method

1. **Blanch** (green/leafy ingredients only). Bring a pot of water to a rolling boil. Blanch [ingredient] for [15–30] seconds, then transfer immediately to an ice bath. Drain and pat dry thoroughly — excess water will cause the oil to splatter and cloud.
2. **Blend.** Combine [ingredient] and oil in the Vitamix. Run on high for 60–90 seconds until completely smooth and the mixture is vibrantly colored.
3. **Strain.** Pass through the tamis (60-mesh). Let gravity do most of the work; pressing forces fine particles through and will cloud the oil. Discard solids.
4. **Chill.** Refrigerate the oil for 30 minutes — cold helps the remaining fine particles settle for a cleaner result.
```

**Note on pea shoots and similar:** always blanch first to deactivate lipoxygenase, which causes rapid grassy/beany off-flavors when raw plant tissue is blended with oil.

---

### Method C — Cold infusion

For heat-sensitive ingredients that cannot be blended. Extraction is slower and less efficient — use a higher oil ratio and longer time.

**Ratio:** 1 part ingredient : 5–8 parts neutral oil by weight
**Time:** 24–72 hours refrigerated

```markdown
## [Ingredient] Oil (Cold Infusion)

*Makes: ~[X]g — use [quantity] in the main recipe as a flavor component*

### Ingredients

| Qty | Ingredient |
|-----|-----------|
| [g] | [ingredient] |
| [g] | Neutral oil (grapeseed or sunflower) |

### Method

1. **Combine.** Place [ingredient] and oil in a sealed container. Stir or shake to coat.
2. **Infuse.** Refrigerate for [24–72] hours. Taste after 24 hours — proceed to straining when flavor is where you want it.
3. **Strain.** Pass through a fine mesh strainer. Do not press. Discard solids.
```

---

## Step 4 — Confirm to the calling recipe

State:
- Sub-recipe name and method used
- Finished weight
- How much to use in the main recipe (start small — flavored oils are concentrated; suggest a starting range of 20–60g per 1L base depending on intensity)
- Oil choice note: neutral oil if the oil itself should be invisible in the flavor; a complementary oil (olive, sesame, walnut) if it adds to the flavor direction
