import { describe, expect, it } from 'vitest';
import { renderRecipeMarkdown } from '../markdown';
import { totalMacros } from '../macros';
import type { IngredientMacros, PacLine, RecipeModel, ResolvedLine } from '../types';

function macros(overrides: Partial<IngredientMacros> & { id: string; name: string }): IngredientMacros {
  return {
    water: 0,
    fat: 0,
    sugars: 0,
    starch: 0,
    protein: 0,
    otherSolids: 0,
    ...overrides,
  };
}

function pacLine(name: string, grams: number): PacLine {
  return { name, grams, pacContributions: {}, waterGrams: 0, msnfGrams: 0 };
}

function makeLine(
  id: string,
  name: string,
  pct: number,
  grams: number,
  role: ResolvedLine['role'],
  macroOverrides: Partial<IngredientMacros> = {},
): ResolvedLine {
  return {
    ingredientId: id,
    name,
    pct,
    grams,
    macros: macros({ id, name, ...macroOverrides }),
    pacLine: pacLine(name, grams),
    role,
  };
}

function buildRecipe(overrides: Partial<RecipeModel> = {}): RecipeModel {
  const lines: ResolvedLine[] = [
    makeLine('cream', 'Cream', 47.5, 475, 'base', { water: 57.71, fat: 36.08, sugars: 2.84, protein: 2.84, otherSolids: 0.53, isDairy: true }),
    makeLine('milk', 'Milk', 32, 320, 'base', { water: 88.13, fat: 3.25, sugars: 4.8, protein: 3.15, otherSolids: 0.67, isDairy: true }),
    makeLine('sweetener:sucrose', 'Sucrose', 20, 200, 'sweetener', { sugars: 100 }),
    makeLine('vanilla-bean-extract', 'Vanilla Bean Extract', 0.5, 5, 'flavoring', { water: 53, sugars: 12, otherSolids: 35 }),
  ];

  return {
    name: 'Vanilla Bean Custard',
    style: 'custard',
    serveTempC: -12,
    outputGrams: 1000,
    lines,
    addedSugarGrams: 200,
    dairyFree: false,
    ...overrides,
  };
}

describe('renderRecipeMarkdown', () => {
  it('emits frontmatter with the expected fields', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });

    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('status: untested');
    expect(md).toContain('style: custard');
    expect(md).toContain('dairy-free: false');
    expect(md).toContain('created: 2026-07-15');
    expect(md).toContain('flavors:\n  - vanilla-bean-extract');
  });

  it('omits the flavors field when there are no flavoring lines', () => {
    const recipe = buildRecipe({
      lines: buildRecipe().lines.filter((l) => l.role !== 'flavoring'),
    });
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });
    expect(md).not.toContain('flavors:');
  });

  it('falls back to "Untitled Recipe" when the name is empty', () => {
    const recipe = buildRecipe({ name: '' });
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines));
    expect(md).toContain('# Untitled Recipe');
  });

  it('renders title, style, and makes lines', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });
    expect(md).toContain('# Vanilla Bean Custard');
    expect(md).toContain('**Style:** Custard');
    expect(md).toContain('**Makes:** ~1000g');
  });

  it('orders sections: Ingredients before Macroingredient Breakdown before Method', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });

    const ingredientsIdx = md.indexOf('## Ingredients');
    const macroIdx = md.indexOf('## Macroingredient Breakdown');
    const methodIdx = md.indexOf('## Method');
    const notesIdx = md.indexOf('## Notes');

    expect(ingredientsIdx).toBeGreaterThan(-1);
    expect(macroIdx).toBeGreaterThan(ingredientsIdx);
    expect(methodIdx).toBeGreaterThan(macroIdx);
    expect(notesIdx).toBeGreaterThan(methodIdx);
  });

  it('uses the correct table headers', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });
    expect(md).toContain('| Ingredient | g | % |');
    expect(md).toContain('| Macroingredient | g | % of base |');
  });

  it('emits the xanthan gum line immediately after the ingredients table', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });
    expect(md).toMatch(
      /^Xanthan gum — [\d.]+g \| ¼ tsp per ~1000g, blended into the fully chilled base before churning$/m,
    );
  });

  it('sums ingredient pcts to ~100 and marks the bold total rows', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });

    const pctSum = recipe.lines.reduce((sum, l) => sum + l.pct, 0);
    expect(pctSum).toBeCloseTo(100, 5);

    expect(md).toContain('| **Total base** | **~1000g** | **100%** |');
    expect(md).toContain('| **Total** | **~1000g** | **100%** |');
  });

  it('lists temperatures in both Celsius and Fahrenheit', () => {
    const recipe = buildRecipe();
    const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });

    // Custard method step: nappe temp
    expect(md).toMatch(/82°C \/ 180°F/);
    // Notes: serving temp
    expect(md).toMatch(/-12°C \/ 10°F/);
  });

  it('renders style-specific method steps for each style', () => {
    for (const style of ['custard', 'philadelphia', 'sherbet', 'sorbet'] as const) {
      const recipe = buildRecipe({ style });
      const md = renderRecipeMarkdown(recipe, totalMacros(recipe.lines), { today: '2026-07-15' });
      expect(md).toMatch(/\d+\.\s\*\*.+\*\*/); // numbered, bold-labeled steps
      expect(md).toContain('**Churn.**');
      expect(md).toContain('**Blend in xanthan.**');
    }
  });
});
