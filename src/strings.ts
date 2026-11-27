// Every string the title screen draws. tests/font.test.ts checks the house font can draw each one.
export const TITLE_TOP = 'MAGITEK';
export const TITLE_BOTTOM = 'WARS';
export const SUBTITLE = 'A WAR OF STEAM AND GLOAM';
export const PRESS_START = 'PRESS START';
export const CREDIT = 'BY EVILGOUKI';
export const VERSION = 'V0.1';

export type MenuId = 'new' | 'continue' | 'cards' | 'credits';

export const MENU: readonly { id: MenuId; label: string }[] = [
  { id: 'new', label: 'NEW GAME' },
  { id: 'continue', label: 'CONTINUE' },
  { id: 'cards', label: 'CARD GALLERY' },
  { id: 'credits', label: 'CREDITS' },
];

export const DIALOGS: Record<MenuId, readonly string[]> = {
  new: ['THE FRONT IS NOT OPEN YET.', 'THIS TITLE SCREEN IS THE', 'FIRST DISPATCH. BATTLES', 'COME NEXT.'],
  continue: ['NO SAVED GAME YET.', 'CONTINUE OPENS WHEN A', 'GAME IS IN PROGRESS.'],
  cards: [],
  credits: ['MAGITEK WARS, AN ORIGINAL GAME', 'DESIGN AND CODE: EVILGOUKI', 'ART: FLUX.2 KLEIN WITH OUR', 'OWN STYLE LORA, FIXED IN CODE', 'TITLE TYPE: CINZEL (OFL)'],
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
  draftText: 'RULES TEXT NOT YET RE-SKINNED',
} as const;
