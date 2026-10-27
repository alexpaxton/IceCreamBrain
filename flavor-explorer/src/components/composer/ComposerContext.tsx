import { createContext, useContext } from 'react';
import type { BaseComponent, Derived, IngredientMacros, NodeData, SavedBase } from '../../lib/composer/types';
import type { IngredientDb } from '../../lib/composer/ingredientDb';

export interface ComposerContextValue {
  db: IngredientDb;
  derived: Derived;
  savedBases: SavedBase[];
  /** Merges a partial patch into a node's data. */
  updateNodeData: <T extends NodeData = NodeData>(id: string, patch: Partial<T>) => void;
  /** Persists a new named base blend built from the given components. */
  saveBase: (name: string, components: BaseComponent[]) => void;
  /** Adds a user-authored ingredient to the db and persists it. */
  addUserIngredient: (ingredient: IngredientMacros) => void;
}

export const ComposerContext = createContext<ComposerContextValue | null>(null);

export function useComposer(): ComposerContextValue {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within a ComposerContext.Provider');
  return ctx;
}
