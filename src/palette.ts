// House palette (docs/ART-STYLE.md section 2). 15-bit colour: every channel is a multiple of 8.
// 31 colours plus transparent. New colours need a PLAN decision.
export const PALETTE = {
  ink: '#080810',
  ironNight: '#181828',
  ironDark: '#283040',
  iron: '#485060',
  ironLight: '#788090',
  steam: '#b0b8c0',
  steamWhite: '#e8e8e0',
  brassShadow: '#382010',
  brassDark: '#704818',
  brass: '#b07828',
  brassLight: '#e0b040',
  brassGlint: '#f8e898',
  emberNight: '#401020',
  emberDeep: '#782028',
  ember: '#c04028',
  emberBright: '#f07830',
  emberGlow: '#f8b848',
  duskZenith: '#100828',
  duskHigh: '#201848',
  duskMid: '#402860',
  duskLow: '#704070',
  crystalDeep: '#083830',
  crystalDark: '#107058',
  crystal: '#20b088',
  crystalBright: '#60f0c0',
  crystalWhite: '#d0f8e8',
  mossDark: '#283018',
  moss: '#506030',
  verdigris: '#387068',
  skinShadow: '#a86848',
  skin: '#e8a878',
} as const;

export type Ink = keyof typeof PALETTE;

/** Palette cycle for crystal glow (beacons, cockpits). */
export const CRYSTAL_CYCLE: readonly Ink[] = ['crystalDark', 'crystal', 'crystalBright', 'crystalWhite', 'crystalBright', 'crystal'];
/** Palette cycle for furnace-lit windows. */
export const WINDOW_CYCLE: readonly Ink[] = ['emberGlow', 'brassLight', 'emberBright', 'brassLight'];

/** A house colour with transparency (PLAN D25: the interface blends house colours; it never invents new ones). */
export function rgba(c: Ink, a: number): string {
  const h = PALETTE[c];
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;
}
