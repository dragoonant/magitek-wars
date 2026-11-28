// Every string the title screen draws.
export const TITLE_TOP = 'MAGITEK';
export const TITLE_BOTTOM = 'WARS';
export const SUBTITLE = 'A WAR OF STEAM AND CRYSTAL';
export const PRESS_START = 'PRESS START';
export const CREDIT = 'by evilgouki';
export const VERSION = 'v0.1';

export type MenuId = 'run' | 'new' | 'continue' | 'decks' | 'cards' | 'story' | 'art' | 'credits';

export const MENU: readonly { id: MenuId; label: string }[] = [
  { id: 'run', label: 'CAMPAIGN' },
  { id: 'new', label: 'QUICK BATTLE' },
  { id: 'continue', label: 'CONTINUE' },
  { id: 'decks', label: 'DECK BUILDER' },
  { id: 'cards', label: 'CARD GALLERY' },
  { id: 'story', label: 'THE STORY' },
  { id: 'art', label: 'ART: DETAIL' },
  { id: 'credits', label: 'CREDITS' },
];

export const DIALOGS: Record<MenuId, readonly string[]> = {
  run: [],
  new: [],
  continue: [],
  decks: [],
  cards: [],
  story: [],
  art: [],
  credits: ['Magitek Wars, an original game', 'Design and code: evilgouki', 'Art: FLUX.2 klein with our own', 'style LoRA', 'Type: Cinzel, Fira Sans (OFL)', 'Card engine: Annals of', 'Scrivenearth, also by evilgouki'],
};

export const DIALOG_CLOSE = 'Press any key';

/** The attract mode (src/attract.ts, PLAN D27). */
export const ATTRACT = {
  hint: '‹ › page through · any other key or tap returns to the title',
} as const;

/** The title menu's art switch (PLAN D22) names the current mode; P switches it anywhere. */
export const ART_LABEL = { detail: 'ART: DETAIL', pixel: 'ART: PIXEL' } as const;

/** Fixed labels on the card gallery (src/gallery.ts). */
export const GALLERY = {
  factionKeys: 'Q ‹  › E',
  back: 'X back',
  pageLeft: '‹',
  pageRight: '›',
  loading: '…',
  noArt: 'No art',
  toAscended: 'A: ascended',
  toBase: 'A: base form',
  ascendsWhen: 'Ascends when: ',
  token: ' token',
} as const;
