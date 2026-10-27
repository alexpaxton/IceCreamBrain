import type { IngredientMacros } from './types';
import seedData from '../../data/composerIngredients.json';

const seedIngredients = seedData.ingredients as IngredientMacros[];

/** Merged view of the seed ingredient table and user-added ingredients. */
export interface IngredientDb {
  all: IngredientMacros[];
  byId: Map<string, IngredientMacros>;
}

/**
 * Merges the seed ingredient table with user-added ingredients. User
 * entries (userAdded: true) shadow seed entries that share the same id.
 */
export function buildIngredientDb(userIngredients: IngredientMacros[]): IngredientDb {
  const byId = new Map<string, IngredientMacros>();

  for (const ingredient of seedIngredients) {
    byId.set(ingredient.id, ingredient);
  }
  for (const ingredient of userIngredients) {
    byId.set(ingredient.id, ingredient);
  }

  return { all: [...byId.values()], byId };
}
