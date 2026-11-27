// Every string the title screen draws. tests/font.test.ts checks the house font can draw each one.
export const TITLE_TOP = 'MAGITEK';
export const TITLE_BOTTOM = 'WARS';
export const SUBTITLE = 'A WAR OF STEAM AND GLOAM';
export const PRESS_START = 'PRESS START';
export const CREDIT = 'BY EVILGOUKI';
export const VERSION = 'V0.1';

export type MenuId = 'run' | 'new' | 'continue' | 'decks' | 'cards' | 'credits';

export const MENU: readonly { id: MenuId; label: string }[] = [
  { id: 'run', label: 'CAMPAIGN' },
  { id: 'new', label: 'QUICK BATTLE' },
  { id: 'continue', label: 'CONTINUE' },
  { id: 'decks', label: 'DECK BUILDER' },
  { id: 'cards', label: 'CARD GALLERY' },
  { id: 'credits', label: 'CREDITS' },
];

export const DIALOGS: Record<MenuId, readonly string[]> = {
  run: [],
  new: [],
  continue: [],
  decks: [],
  cards: [],
  credits: ['MAGITEK WARS, AN ORIGINAL GAME', 'DESIGN AND CODE: EVILGOUKI', 'ART: FLUX.2 KLEIN WITH OUR', 'OWN STYLE LORA, FIXED IN CODE', 'TITLE TYPE: CINZEL (OFL)', 'CARD ENGINE: ANNALS OF', 'SCRIVENEARTH, ALSO EVILGOUKI'],
};

export const DIALOG_CLOSE = 'PRESS ANY KEY';

/** Fixed labels on the card gallery (src/gallery.ts). */
export const GALLERY = {
  factionKeys: 'Q <  > E',
  back: 'X BACK',
  pageLeft: '<',
  pageRight: '>',
  loading: '...',
  noArt: 'NO ART',
  toAscended: 'A: ASCENDED',
  toBase: 'A: BASE FORM',
  ascendsWhen: 'ASCENDS WHEN: ',
  token: ' TOKEN',
} as const;
