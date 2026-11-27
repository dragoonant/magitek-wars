// Every string the title screen draws. tests/font.test.ts checks the house font can draw each one.
export const TITLE_TOP = 'MAGITEK';
export const TITLE_BOTTOM = 'WARS';
export const SUBTITLE = 'A WAR OF STEAM AND GLOAM';
export const PRESS_START = 'PRESS START';
export const CREDIT = 'BY EVILGOUKI';
export const VERSION = 'V0.1';

export type MenuId = 'new' | 'continue' | 'credits';

export const MENU: readonly { id: MenuId; label: string }[] = [
  { id: 'new', label: 'NEW GAME' },
  { id: 'continue', label: 'CONTINUE' },
  { id: 'credits', label: 'CREDITS' },
];

export const DIALOGS: Record<MenuId, readonly string[]> = {
  new: ['THE FRONT IS NOT OPEN YET.', 'THIS TITLE SCREEN IS THE', 'FIRST DISPATCH. BATTLES', 'COME NEXT.'],
  continue: ['NO SAVED GAME YET.', 'CONTINUE OPENS WHEN A', 'GAME IS IN PROGRESS.'],
  credits: ['MAGITEK WARS', 'DESIGN AND CODE: EVILGOUKI', 'ALL ART DRAWN IN CODE.', 'AN ORIGINAL GAME.'],
};

export const DIALOG_CLOSE = 'PRESS ANY KEY';
