import type { Legend } from './gfx';

// Interface sprites drawn by us as character maps ('.' = transparent), house palette, at most 15 colours each
// (ART-STYLE section 2). Scene and character art is rendered and snapped instead (PLAN D13, D14).

/** Menu cursor: a brass pointer. */
export const CURSOR: readonly string[] = [
  'kk.....',
  'kGk....',
  'kBGk...',
  'kBBBk..',
  'kBBk...',
  'kbk....',
  'kk.....',
];
export const CURSOR_LEGEND: Legend = { k: 'ink', G: 'brassGlint', B: 'brassLight', b: 'brassDark' };

export const ALL_SPRITES = [{ name: 'cursor', map: CURSOR, legend: CURSOR_LEGEND }] as const;
