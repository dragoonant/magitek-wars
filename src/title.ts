import { drawPic, isDetail, picSize, setDetail } from './detail';
import { highlight, panel } from './ui';
import { drawText, drawTextCentred, textWidth } from './font';
import { Gfx, H, W } from './gfx';
import type { Ink } from './palette';
import {
  ART_LABEL, CREDIT, DIALOGS, DIALOG_CLOSE, MENU, PRESS_START, SUBTITLE, TITLE_BOTTOM, TITLE_TOP, VERSION, type MenuId,
} from './strings';

export type Mode = { kind: 'press' } | { kind: 'menu' } | { kind: 'dialog'; id: MenuId };

const MENU_BOX = { x: 72, y: 112, w: 112, h: 96 };
const WORDMARK_CAP = 18;
const WORDMARK_Y = 43;
const ITEM_X = MENU_BOX.x + 22;
const ITEM_Y0 = MENU_BOX.y + 11;
const ITEM_STEP = 10;

/** The house window (PLAN D25): a smoked-glass panel in a brass frame (src/ui.ts). */
export function drawWindow(g: Gfx, x: number, y: number, w: number, h: number): void {
  panel(g, x, y, w, h);
}

export class Title {
  mode: Mode = { kind: 'press' };
  cursor = 0;
  /** A screen the player asked for; main.ts switches to it and clears this. */
  open: 'cards' | 'new' | 'continue' | 'run' | 'expedition' | 'decks' | null = null;

  constructor(private readonly hasSave: () => boolean) {}

  async load(): Promise<void> {
    /* the wordmark is type, drawn each frame (PLAN D25) */
  }

  enabled(id: MenuId): boolean {
    return id !== 'continue' || this.hasSave();
  }

  private confirm(): void {
    const item = MENU[this.cursor];
    if (!this.enabled(item.id)) return;
    if (item.id === 'art') setDetail(!isDetail());
    else if (item.id === 'cards' || item.id === 'new' || item.id === 'continue' || item.id === 'run' || item.id === 'expedition' || item.id === 'decks') this.open = item.id;
    else this.mode = { kind: 'dialog', id: item.id };
  }

  key(code: string): void {
    const m = this.mode;
    if (m.kind === 'press') {
      this.mode = { kind: 'menu' };
      return;
    }
    if (m.kind === 'dialog') {
      this.mode = { kind: 'menu' };
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW') this.cursor = (this.cursor + MENU.length - 1) % MENU.length;
    else if (code === 'ArrowDown' || code === 'KeyS') this.cursor = (this.cursor + 1) % MENU.length;
    else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') this.confirm();
    else if (code === 'Escape' || code === 'KeyX') this.mode = { kind: 'press' };
  }

  private itemAt(x: number, y: number): number {
    for (let i = 0; i < MENU.length; i++) {
      const top = ITEM_Y0 + i * ITEM_STEP - 3;
      if (x >= MENU_BOX.x + 4 && x < MENU_BOX.x + MENU_BOX.w - 4 && y >= top && y < top + ITEM_STEP) return i;
    }
    return -1;
  }

  pointerMove(x: number, y: number): void {
    if (this.mode.kind !== 'menu') return;
    const i = this.itemAt(x, y);
    if (i >= 0) this.cursor = i;
  }

  pointerDown(x: number, y: number): void {
    if (this.mode.kind !== 'menu') {
      this.mode = { kind: 'menu' };
      return;
    }
    const i = this.itemAt(x, y);
    if (i < 0) return;
    this.cursor = i;
    this.confirm();
  }

  draw(g: Gfx, t: number, emblem: HTMLImageElement | null): void {
    if (emblem) drawPic(g, emblem, Math.round(W / 2 - picSize(emblem).w / 2), 3);
    // The wordmark (PLAN D13, D25): Cinzel Bold in a brass gradient with an ink edge and an ember shadow.
    const brass = (r: number): Ink => (r < 1 ? 'brassGlint' : r < 3 ? 'brassLight' : r < 5 ? 'brass' : 'brassDark');
    drawTextCentred(g, `${TITLE_TOP} ${TITLE_BOTTOM}`, W / 2, WORDMARK_Y, { color: 'brass', scale: WORDMARK_CAP / 7, face: 'display', rowColor: brass, outline: 'ink', shadow: 'emberNight' });
    drawTextCentred(g, SUBTITLE, W / 2, WORDMARK_Y + WORDMARK_CAP + 9, { color: 'emberGlow', face: 'display', outline: 'ink', shadow: 'ink' });

    if (this.mode.kind === 'press') {
      const pulse = 0.55 + 0.45 * Math.sin(t / 14);
      drawTextCentred(g, PRESS_START, W / 2, 186, { color: 'brassGlint', face: 'display', outline: 'ink', glow: 'emberBright', alpha: pulse });
    } else {
      drawWindow(g, MENU_BOX.x, MENU_BOX.y, MENU_BOX.w, MENU_BOX.h);
      MENU.forEach((item, i) => {
        const on = this.enabled(item.id);
        const here = i === this.cursor;
        if (here && on) highlight(g, MENU_BOX.x + 6, ITEM_Y0 + i * ITEM_STEP - 2, MENU_BOX.w - 12, ITEM_STEP - 0.5, 'brass', 0.5 + 0.2 * Math.sin(t / 10));
        const color = !on ? 'iron' : here ? 'brassGlint' : 'steamWhite';
        drawText(g, item.id === 'art' ? ART_LABEL[isDetail() ? 'detail' : 'pixel'] : item.label, ITEM_X - 8, ITEM_Y0 + i * ITEM_STEP, { color, face: 'display', shadow: 'ink' });
      });
    }

    if (this.mode.kind === 'dialog') {
      const lines = DIALOGS[this.mode.id];
      const h = lines.length * 10 + 31;
      const y = Math.round((H - h) / 2) - 4;
      drawWindow(g, 20, y, 216, h);
      lines.forEach((line, i) => drawText(g, line, 32, y + 10 + i * 10, { color: 'steamWhite' }));
      drawTextCentred(g, DIALOG_CLOSE, W / 2, y + h - 15, { color: 'brassLight', alpha: 0.6 + 0.4 * Math.sin(t / 14) });
    }

    drawTextCentred(g, CREDIT, W / 2, 213, { color: 'steam', outline: 'ink' });
    drawText(g, VERSION, W - 6 - textWidth(VERSION), 213, { color: 'ironLight', outline: 'ink' });
  }
}
