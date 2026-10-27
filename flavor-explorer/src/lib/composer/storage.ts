import type { ComposerDoc, IngredientMacros, SavedBase } from './types';

const DOC_KEY = 'composer.doc.v1';
const USER_INGREDIENTS_KEY = 'composer.userIngredients.v1';
const SAVED_BASES_KEY = 'composer.bases.v1';

interface Envelope<T> {
  version: 1;
  data: T;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Reads and validates an envelope from storage. Never throws. */
function readEnvelope<T>(key: string, isValid: (data: unknown) => data is T): T | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    !('data' in parsed)
  ) {
    return null;
  }

  const data = (parsed as Envelope<unknown>).data;
  return isValid(data) ? data : null;
}

function writeEnvelope<T>(key: string, data: T): void {
  const storage = getStorage();
  if (!storage) return;

  const envelope: Envelope<T> = { version: 1, data };
  try {
    storage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Storage full, disabled, or unavailable — persistence is best-effort.
  }
}

function isComposerDoc(data: unknown): data is ComposerDoc {
  if (typeof data !== 'object' || data === null) return false;
  const doc = data as { nodes?: unknown; edges?: unknown };
  return Array.isArray(doc.nodes) && Array.isArray(doc.edges);
}

function isIngredientMacrosArray(data: unknown): data is IngredientMacros[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { name?: unknown }).name === 'string',
  );
}

function isSavedBaseArray(data: unknown): data is SavedBase[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { name?: unknown }).name === 'string' &&
      Array.isArray((item as { components?: unknown }).components),
  );
}

/** Loads the persisted canvas document. Returns null if absent/corrupt/wrong version. */
export function loadDoc(): ComposerDoc | null {
  return readEnvelope(DOC_KEY, isComposerDoc);
}

export function saveDoc(doc: ComposerDoc): void {
  writeEnvelope(DOC_KEY, doc);
}

/** Loads user-added ingredients. Returns [] if absent/corrupt/wrong version. */
export function loadUserIngredients(): IngredientMacros[] {
  return readEnvelope(USER_INGREDIENTS_KEY, isIngredientMacrosArray) ?? [];
}

export function saveUserIngredients(list: IngredientMacros[]): void {
  writeEnvelope(USER_INGREDIENTS_KEY, list);
}

/** Loads saved base blends. Returns [] if absent/corrupt/wrong version. */
export function loadSavedBases(): SavedBase[] {
  return readEnvelope(SAVED_BASES_KEY, isSavedBaseArray) ?? [];
}

export function saveSavedBases(list: SavedBase[]): void {
  writeEnvelope(SAVED_BASES_KEY, list);
}

/** Standard trailing-edge debounce. */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
