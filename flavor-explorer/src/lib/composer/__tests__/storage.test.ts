import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadDoc,
  saveDoc,
  loadUserIngredients,
  saveUserIngredients,
  loadSavedBases,
  saveSavedBases,
} from '../storage';
import type { ComposerDoc, IngredientMacros, SavedBase } from '../types';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as { localStorage: Storage }).localStorage = new MemoryStorage();
});

describe('composer doc', () => {
  it('round-trips a saved document', () => {
    const doc: ComposerDoc = {
      nodes: [
        {
          id: 'n1',
          type: 'style',
          position: { x: 0, y: 0 },
          data: { kind: 'style', style: 'philadelphia' },
        },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };

    saveDoc(doc);
    expect(loadDoc()).toEqual(doc);
  });

  it('returns null when nothing is stored', () => {
    expect(loadDoc()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('composer.doc.v1', '{not valid json');
    expect(loadDoc()).toBeNull();
  });

  it('returns null for the wrong version', () => {
    localStorage.setItem(
      'composer.doc.v1',
      JSON.stringify({ version: 2, data: { nodes: [], edges: [] } }),
    );
    expect(loadDoc()).toBeNull();
  });

  it('returns null for malformed data shape', () => {
    localStorage.setItem('composer.doc.v1', JSON.stringify({ version: 1, data: { nodes: 'nope' } }));
    expect(loadDoc()).toBeNull();
  });
});

describe('user ingredients', () => {
  it('round-trips a saved list', () => {
    const list: IngredientMacros[] = [
      {
        id: 'custom-syrup',
        name: 'Custom Syrup',
        water: 20,
        fat: 0,
        sugars: 78,
        starch: 0,
        protein: 0,
        otherSolids: 2,
        userAdded: true,
      },
    ];

    saveUserIngredients(list);
    expect(loadUserIngredients()).toEqual(list);
  });

  it('returns [] when nothing is stored', () => {
    expect(loadUserIngredients()).toEqual([]);
  });

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem('composer.userIngredients.v1', '{not valid json');
    expect(loadUserIngredients()).toEqual([]);
  });

  it('returns [] for the wrong version', () => {
    localStorage.setItem(
      'composer.userIngredients.v1',
      JSON.stringify({ version: 0, data: [] }),
    );
    expect(loadUserIngredients()).toEqual([]);
  });
});

describe('saved bases', () => {
  it('round-trips a saved list', () => {
    const list: SavedBase[] = [
      {
        id: 'base-1',
        name: 'Classic Philly',
        components: [
          { ingredientId: 'cream-fluid-heavy-whipping', pct: 40 },
          { ingredientId: 'milk-whole-3-25-milkfat', pct: 60 },
        ],
      },
    ];

    saveSavedBases(list);
    expect(loadSavedBases()).toEqual(list);
  });

  it('returns [] when nothing is stored', () => {
    expect(loadSavedBases()).toEqual([]);
  });

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem('composer.bases.v1', '{not valid json');
    expect(loadSavedBases()).toEqual([]);
  });

  it('returns [] for the wrong version', () => {
    localStorage.setItem('composer.bases.v1', JSON.stringify({ version: 2, data: [] }));
    expect(loadSavedBases()).toEqual([]);
  });
});
