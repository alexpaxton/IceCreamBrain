import type { ComposerDoc, Derived, ResolvedLine } from '../../lib/composer/types';
import type { IngredientDb } from '../../lib/composer/ingredientDb';
import { resolveGraph } from '../../lib/composer/resolve';
import { PRESETS } from '../../lib/composer/pac/pacTable';
import { analyzePac } from '../../lib/composer/pac/pac';
import { checkMacros } from '../../lib/composer/standards';
import { totalMacros } from '../../lib/composer/macros';
import { renderRecipeMarkdown } from '../../lib/composer/markdown';

const EMPTY_DERIVED: Derived = { recipe: null, issues: [], pac: null, macroChecks: {}, markdown: '' };

/** Sum of a set of resolved lines' sweetener-role PAC contributions (net sugar grams). */
function addedSugarGramsFor(lines: ResolvedLine[]): number {
  return lines
    .filter((line) => line.role === 'sweetener')
    .reduce(
      (sum, line) => sum + Object.values(line.pacLine.pacContributions).reduce((a, b) => a + b, 0),
      0,
    );
}

/** Resolves the composer graph and runs the PAC, macro, and markdown engines over it. */
export function computeDerived(doc: ComposerDoc, db: IngredientDb): Derived {
  try {
    const { recipe, issues, checks } = resolveGraph(doc, db, PRESETS);

    const pac = recipe
      ? analyzePac({
          lines: recipe.lines.map((l) => l.pacLine),
          totalGrams: recipe.outputGrams,
          type: recipe.style === 'sorbet' ? 'sorbet' : 'gelato',
          serveTempC: recipe.serveTempC,
        })
      : null;

    const macroChecks: Derived['macroChecks'] = {};
    for (const [checkId, lines] of Object.entries(checks)) {
      macroChecks[checkId] = checkMacros({
        lines,
        style: recipe?.style ?? 'philadelphia',
        addedSugarGrams: addedSugarGramsFor(lines),
      });
    }

    const markdown = recipe ? renderRecipeMarkdown(recipe, totalMacros(recipe.lines)) : '';

    return { recipe, issues, pac, macroChecks, markdown };
  } catch (err) {
    return { ...EMPTY_DERIVED, issues: [{ severity: 'error', message: String(err) }] };
  }
}
