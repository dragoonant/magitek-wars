import type { Legend } from './gfx';

// Sprites drawn by us as character maps ('.' = transparent). Each uses at most 15 colours (ART-STYLE section 2).

/** Gloamwork strider body: a riveted boiler with a red lacquer band, a rear chimney and an enclosed cab whose porthole
 *  ('g', cycled) faces right. 30 x 17; legs are added by buildStrider. */
const STRIDER_BODY: readonly string[] = [
  '......kkkkk...................',
  '......kYBbk...................',
  '......kkkkk...................',
  '......klsdk...................',
  '......klsdk...................',
  '...kkkklsdkkkkkkkkkkkkkk......',
  '..klllhhhhhllllllllllsssk.....',
  '..kllllllllllllllllssssdk.....',
  '..klsssssssssssssdBBBdsdk.....',
  '..klsssssssssssssBgwgBsdk.....',
  '..klsssssssssssssBgggBsdk.....',
  '..klsssssssssssssBgggBsdk.....',
  '..klsssssssssssssdbbbdsdk.....',
  '..keeYeeeYeeeYeeeYeeeYeek.....',
  '..ksssssssssssssssssddddk.....',
  '..kdddddddddddddddddddddk.....',
  '..kkkkkkkkkkkkkkkkkkkkkkk.....',
];

/** Reverse-knee legs drawn as thick lines into the character grid: ink outline first, then the fill. */
function buildStrider(): string[] {
  const w = 30;
  const h = 34;
  const grid = Array.from({ length: h }, (_, y) => (STRIDER_BODY[y] ?? '').padEnd(w, '.').split(''));
  const disc = (cx: number, cy: number, r: number, ch: string) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (y < 17 || y >= h || x < 0 || x >= w) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) grid[y][x] = ch;
      }
    }
  };
  const line = (pts: [number, number][], r: number, ch: string) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
      for (let k = 0; k <= n; k++) disc(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, ch);
    }
  };
  const leg = (hip: [number, number], knee: [number, number], ankle: [number, number], fill: string, foot: string) => {
    line([hip, knee, ankle], 1.7, 'k');
    line([hip, knee, ankle], 0.75, fill);
    const [ax] = ankle;
    for (let x = ax - 5; x <= ax + 5; x++) {
      if (x < 0 || x >= w) continue;
      grid[31][x] = 'k';
      grid[32][x] = x === ax - 5 || x === ax + 5 ? 'k' : foot;
      grid[33][x] = 'k';
    }
    grid[knee[1]][knee[0]] = 'B'; // knee joint
    grid[knee[1] - 1][knee[0]] = 'Y';
  };
  // A mid-stride pose: far leg planted behind, near leg stepping forward.
  leg([9, 17], [12, 24], [6, 30], 'd', 'd');
  leg([14, 17], [21, 23], [19, 30], 's', 'l');
  for (let x = 9; x <= 16; x++) {
    grid[17][x] = x === 9 || x === 16 ? 'k' : 'b'; // hip block
  }
  return grid.map((row) => row.join(''));
}

/** Gloamwork strider: a two-legged walking boiler with an enclosed cab, 30 x 34. 'g' is the porthole glow (cycled). */
export const STRIDER: readonly string[] = buildStrider();
export const STRIDER_LEGEND: Legend = {
  k: 'ink',
  d: 'ironDark',
  s: 'iron',
  l: 'ironLight',
  h: 'steam',
  b: 'brassDark',
  B: 'brass',
  Y: 'brassLight',
  e: 'emberDeep',
  g: 'gloam',
  w: 'gloamWhite',
};

/** Gale Exchange airship, far away, drifting across the dusk. 'g' is a gondola lamp (cycled). */
export const AIRSHIP: readonly string[] = [
  '.....kkkkkkkkkkk.......',
  '...kkIIIIIIIIIIIkk..kk.',
  '..kIIIIIIIIIIIIIIIkkIk.',
  '.kiiiiiiiiiiiiiiiiiiik.',
  '..kiiiiiiiiiiiiiiiikkik',
  '...kkkkkkkkkkkkkkk...kk',
  '.......kbbbbbk.........',
  '.......kbgbgbk.........',
  '........kkkkk..........',
];
export const AIRSHIP_LEGEND: Legend = {
  k: 'ironNight',
  I: 'duskLow',
  i: 'duskMid',
  b: 'brassShadow',
  g: 'emberGlow',
};

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

export const ALL_SPRITES = [
  { name: 'strider', map: STRIDER, legend: STRIDER_LEGEND },
  { name: 'airship', map: AIRSHIP, legend: AIRSHIP_LEGEND },
  { name: 'cursor', map: CURSOR, legend: CURSOR_LEGEND },
] as const;
