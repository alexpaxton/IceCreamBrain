import type { ComposerDoc } from '../../lib/composer/types';

/**
 * The starting canvas: the core nodes every recipe needs, wired together
 * with fixed (non-deletable) edges. Users add flavoring/ingredient nodes
 * on top of this.
 */
export function defaultDoc(): ComposerDoc {
  return {
    nodes: [
      {
        id: 'style',
        type: 'style',
        position: { x: 40, y: 160 },
        data: { kind: 'style', style: 'philadelphia' },
        deletable: false,
      },
      {
        id: 'base',
        type: 'base',
        position: { x: 340, y: 0 },
        data: {
          kind: 'base',
          baseId: null,
          components: [
            { ingredientId: 'milk-whole-3-25-milkfat', pct: 60 },
            { ingredientId: 'cream-fluid-heavy-whipping', pct: 40 },
          ],
        },
        deletable: false,
      },
      {
        id: 'sweetener',
        type: 'sweetener',
        position: { x: 340, y: 220 },
        data: {
          kind: 'sweetener',
          totalPct: 18,
          split: [{ pacKey: 'sucrose', pct: 100 }],
        },
        deletable: false,
      },
      {
        id: 'serving-temp',
        type: 'servingTemp',
        position: { x: 340, y: 440 },
        data: { kind: 'servingTemp', value: -12, unit: 'C' },
        deletable: false,
      },
      {
        id: 'output',
        type: 'output',
        position: { x: 680, y: 160 },
        data: { kind: 'output', grams: 1000, recipeName: 'Untitled Recipe' },
        deletable: false,
      },
      {
        id: 'pac-check',
        type: 'pacCheck',
        position: { x: 1000, y: 40 },
        data: { kind: 'pacCheck' },
        deletable: false,
      },
      {
        id: 'macro-check',
        type: 'macroCheck',
        position: { x: 1000, y: 300 },
        data: { kind: 'macroCheck' },
        deletable: false,
      },
    ],
    edges: [
      { id: 'edge-style-base', source: 'style', target: 'base', deletable: false },
      { id: 'edge-style-macro', source: 'style', target: 'macro-check', deletable: false },
      { id: 'edge-base-output', source: 'base', target: 'output', deletable: false },
      { id: 'edge-sweetener-output', source: 'sweetener', target: 'output', deletable: false },
      { id: 'edge-servingtemp-pac', source: 'serving-temp', target: 'pac-check', deletable: false },
      { id: 'edge-output-pac', source: 'output', target: 'pac-check', deletable: false },
      { id: 'edge-output-macro', source: 'output', target: 'macro-check', deletable: false },
    ],
  };
}
