/** Canonical sweetener keys, matching the PAC lookup table (see Calculate PAC skill). */
export { SWEETENER_KEYS } from '../../lib/composer/pac/pacTable';

export type SweetenerKey = string;

/**
 * Turns a snake_case key into a display label: underscores become spaces,
 * the first word is capitalized, and DE-style tokens (de42, de18…) are
 * uppercased in place (e.g. "glucose_syrup_de42" -> "Glucose syrup DE42").
 */
export function prettifyKey(key: string): string {
  return key
    .split('_')
    .map((word, i) => {
      if (/^de\d+$/i.test(word)) return word.toUpperCase();
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(' ');
}
