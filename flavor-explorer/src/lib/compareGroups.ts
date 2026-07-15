import type { Ingredient } from './types';

export interface CompareGroup {
  ids: string[];
  label: string;
  cids: string[];
}

/**
 * Partitions every compound across the given ingredients into exclusive
 * ownership groups (e.g. "only in A", "shared by A + B"). Every ingredient
 * gets an entry even if it has no exclusive compounds, so callers that need
 * one region per ingredient (like a venn diagram) always have one.
 */
export function buildCompareGroups(ingredients: Ingredient[]): CompareGroup[] {
  const allCompoundIds = Array.from(
    new Set(ingredients.flatMap((ing) => ing.compounds.map((c) => c.compound_id))),
  );

  const groups = new Map<string, CompareGroup>();

  for (const cid of allCompoundIds) {
    const owners = ingredients.filter((ing) => ing.compounds.some((c) => c.compound_id === cid));
    const ids = owners.map((o) => o.id).sort();
    const key = ids.join(',');

    if (!groups.has(key)) {
      const label =
        owners.length === ingredients.length
          ? 'Shared by all ingredients'
          : owners.map((o) => o.name).join(' + ');
      groups.set(key, { ids, label, cids: [] });
    }
    groups.get(key)!.cids.push(cid);
  }

  for (const ing of ingredients) {
    if (!groups.has(ing.id)) {
      groups.set(ing.id, { ids: [ing.id], label: ing.name, cids: [] });
    }
  }

  return [...groups.values()];
}
