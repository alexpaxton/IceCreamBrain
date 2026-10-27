import type { MacroTotals, RecipeModel, StyleId } from './types';

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function styleLabel(style: StyleId): string {
  if (style === 'philadelphia') return 'Philadelphia';
  return capitalize(style);
}

function slugifyFlavor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatXanthanGrams(outputGrams: number): string {
  const rounded = Math.round((outputGrams / 1000) * 10) / 10;
  const str = rounded.toFixed(1);
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function buildFrontmatter(recipe: RecipeModel, today: string): string {
  const lines = ['---', 'status: untested', `style: ${recipe.style}`, `dairy-free: ${recipe.dairyFree}`, `created: ${today}`];

  const flavorNames = [
    ...new Set(recipe.lines.filter((l) => l.role === 'flavoring').map((l) => slugifyFlavor(l.name))),
  ];
  if (flavorNames.length > 0) {
    lines.push('flavors:');
    for (const flavor of flavorNames) lines.push(`  - ${flavor}`);
  }

  lines.push('---');
  return lines.join('\n');
}

function buildHeadnote(recipe: RecipeModel): string {
  const flavorNames = recipe.lines.filter((l) => l.role === 'flavoring').map((l) => l.name);
  const styleName = styleLabel(recipe.style);
  const styleAdj = recipe.style === 'philadelphia' ? 'Philadelphia-style' : `${styleName}-style`;

  if (flavorNames.length === 0) {
    return `A ${styleAdj} recipe.`;
  }
  return `A ${styleAdj} recipe flavored with ${formatList(flavorNames)}.`;
}

function buildIngredientsTable(recipe: RecipeModel): string {
  const rows = recipe.lines.map(
    (line) => `| ${line.name} | ${Math.round(line.grams)}g | ${round1(line.pct)}% |`,
  );
  const totalRow = `| **Total base** | **~${Math.round(recipe.outputGrams)}g** | **100%** |`;

  return ['| Ingredient | g | % |', '|------------|---|---|', ...rows, totalRow].join('\n');
}

function buildMacroTable(recipe: RecipeModel, macros: MacroTotals): string {
  const otherSolidsGrams = macros.grams.otherSolids + macros.grams.starch;
  const otherSolidsPct = macros.pct.otherSolids + macros.pct.starch;

  const rows = [
    `| Water | ${Math.round(macros.grams.water)}g | ${round1(macros.pct.water)}% |`,
    `| Total fat | ${Math.round(macros.grams.fat)}g | ${round1(macros.pct.fat)}% |`,
    `| Total sugars | ${Math.round(macros.grams.sugars)}g | ${round1(macros.pct.sugars)}% |`,
    `| Protein | ${Math.round(macros.grams.protein)}g | ${round1(macros.pct.protein)}% |`,
    `| Other solids | ${Math.round(otherSolidsGrams)}g | ${round1(otherSolidsPct)}% |`,
    `| **Total** | **~${Math.round(recipe.outputGrams)}g** | **100%** |`,
  ];

  return ['| Macroingredient | g | % of base |', '|-----------------|---|-----------|', ...rows].join(
    '\n',
  );
}

const CHILL_STEP = '**Chill.** Cover and refrigerate the base for at least 4 hours, or overnight, until fully chilled.';
const XANTHAN_STEP = '**Blend in xanthan.** Whisk the xanthan gum into the fully chilled base until evenly dispersed.';
const CHURN_STEP = "**Churn.** Churn in an ice cream maker according to the manufacturer’s instructions.";

function buildMethodSteps(style: StyleId): string[] {
  switch (style) {
    case 'custard':
      return [
        '**Heat the dairy.** Combine the base dairy and sugars in a saucepan and warm over medium heat until steaming.',
        '**Temper the yolks.** Whisk the egg yolks in a separate bowl, then slowly stream in some of the hot dairy while whisking constantly to bring the yolks up to temperature without scrambling them.',
        '**Cook to nappe.** Return the tempered yolks to the saucepan and cook gently, stirring constantly, until the custard thickens enough to coat the back of a spoon (82°C / 180°F).',
        '**Strain.** Strain the custard through a fine-mesh sieve into a clean container.',
        CHILL_STEP,
        XANTHAN_STEP,
        CHURN_STEP,
      ];
    case 'philadelphia':
      return [
        '**Heat and dissolve.** Combine the dairy and sugars in a saucepan and warm over medium heat, stirring until fully dissolved.',
        '**Cool.** Remove from heat and let cool before transferring to a clean container.',
        CHILL_STEP,
        XANTHAN_STEP,
        CHURN_STEP,
      ];
    case 'sherbet':
      return [
        '**Purée.** Blend the fruit (or other flavoring base) until smooth and strain if needed.',
        '**Blend with dairy.** Whisk the purée together with the dairy and sugars until fully combined.',
        CHILL_STEP,
        XANTHAN_STEP,
        CHURN_STEP,
      ];
    case 'sorbet':
      return [
        '**Make the syrup.** Dissolve the sweetener in the water portion over low heat, then cool.',
        '**Purée.** Blend the fruit until smooth and combine with the cooled syrup.',
        CHILL_STEP,
        XANTHAN_STEP,
        CHURN_STEP,
      ];
    default:
      return [CHILL_STEP, XANTHAN_STEP, CHURN_STEP];
  }
}

function buildMethod(recipe: RecipeModel): string {
  return buildMethodSteps(recipe.style)
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
}

function buildNotes(recipe: RecipeModel): string {
  const tempF = (recipe.serveTempC * 9) / 5 + 32;
  return `Serve at approximately ${Math.round(recipe.serveTempC)}°C / ${Math.round(tempF)}°F.`;
}

/** Renders a RecipeModel + its macro totals as a recipe-format-compliant markdown document. */
export function renderRecipeMarkdown(
  recipe: RecipeModel,
  macros: MacroTotals,
  opts?: { today?: string },
): string {
  const today = opts?.today ?? new Date().toISOString().slice(0, 10);
  const name = recipe.name?.trim() || 'Untitled Recipe';

  return [
    buildFrontmatter(recipe, today),
    '',
    `# ${name}`,
    '',
    `**Style:** ${styleLabel(recipe.style)}`,
    `**Makes:** ~${Math.round(recipe.outputGrams)}g`,
    '',
    buildHeadnote(recipe),
    '',
    '## Ingredients',
    '',
    buildIngredientsTable(recipe),
    '',
    `Xanthan gum — ${formatXanthanGrams(recipe.outputGrams)}g | ¼ tsp per ~1000g, blended into the fully chilled base before churning`,
    '',
    '## Macroingredient Breakdown',
    '',
    buildMacroTable(recipe, macros),
    '',
    '## Method',
    '',
    buildMethod(recipe),
    '',
    '## Notes',
    '',
    buildNotes(recipe),
  ].join('\n');
}
