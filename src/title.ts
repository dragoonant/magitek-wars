import { drawText, drawTextCentred, textWidth } from './font';
import { Gfx, H, W, drawSprite } from './gfx';
import { CURSOR, CURSOR_LEGEND } from './sprites';
import {
  CREDIT, DIALOGS, DIALOG_CLOSE, MENU, PRESS_START, SUBTITLE, TITLE_BOTTOM, TITLE_TOP, VERSION, type MenuId,
} from './strings';
import { buildWordmark } from './wordmark';

export type Mode = { kind: 'press' } | { kind: 'menu' } | { kind: 'dialog'; id: MenuId };

const MENU_BOX = { x: 70, y: 140, w: 116, h: 74 };
const WORDMARK_CAP = 18;
const WORDMARK_Y = 43;
const ITEM_X = MENU_BOX.x + 24;
const ITEM_Y0 = MENU_BOX.y + 10;
const ITEM_STEP = 10;

/** Riveted iron-and-brass window with a smoked-glass interior (ART-STYLE section 7). */
export function drawWindow(g: Gfx, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h, 'ink');
  g.rect(x + 1, y + 1, w - 2, h - 2, 'brassDark');
  g.rect(x + 1, y + 1, w - 3, 1, 'brassLight');
  g.rect(x + 1, y + 1, 1, h - 3, 'brassLight');
  g.rect(x + 2, y + 2, w - 5, 1, 'brass');
  g.rect(x + 2, y + 2, 1, h - 5, 'brass');
  g.rect(x + 2, y + h - 2, w - 3, 1, 'brassShadow');
  g.rect(x + w - 2, y + 2, 1, h - 3, 'brassShadow');
  g.rect(x + 3, y + 3, w - 6, h - 6, 'ink');
  g.rect(x + 4, y + 4, w - 8, h - 8, 'duskZenith');
  g.dither25(x + 4, y + 4, w - 8, h - 8, 'gloamDeep');
  const rivets: [number, number][] = [[x + 1, y + 1], [x + w - 3, y + 1], [x + 1, y + h - 3], [x + w - 3, y + h - 3]];
  for (let rx = x + 24; rx < x + w - 24; rx += 24) rivets.push([rx, y + 1], [rx, y + h - 3]);
  for (const [rx, ry] of rivets) {
    g.px(rx, ry, 'brassGlint');
    g.px(rx + 1, ry, 'brassLight');
    g.px(rx, ry + 1, 'brassLight');
    g.px(rx + 1, ry + 1, 'brassShadow');
  }
}

export class Title {
  mode: Mode = { kind: 'press' };
  cursor = 0;
  private wordmark: HTMLCanvasElement | null = null;
  /** A screen the player asked for; main.ts switches to it and clears this. */
  open: 'cards' | 'new' | 'continue' | 'run' | 'decks' | null = null;

  constructor(private readonly hasSave: () => boolean) {}

  async load(): Promise<void> {
    this.wordmark = await buildWordmark(`${TITLE_TOP} ${TITLE_BOTTOM}`, WORDMARK_CAP);
  }

  enabled(id: MenuId): boolean {
    return id !== 'continue' || this.hasSave();
  }

  private confirm(): void {
    const item = MENU[this.cursor];
    if (!this.enabled(item.id)) return;
    if (item.id === 'cards' || item.id === 'new' || item.id === 'continue' || item.id === 'run' || item.id === 'decks') this.open = item.id;
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
    if (emblem) g.ctx.drawImage(emblem, Math.round(W / 2 - emblem.width / 2), 3);
    if (this.wordmark) g.ctx.drawImage(this.wordmark, Math.round(W / 2 - this.wordmark.width / 2), WORDMARK_Y);
    drawTextCentred(g, SUBTITLE, W / 2, WORDMARK_Y + WORDMARK_CAP + 10, { color: 'emberGlow', outline: 'ink' });

    if (this.mode.kind === 'press') {
      if ((t >> 5) % 2 === 0) drawTextCentred(g, PRESS_START, W / 2, 186, { color: 'brassGlint', outline: 'ink' });
    } else {
      drawWindow(g, MENU_BOX.x, MENU_BOX.y, MENU_BOX.w, MENU_BOX.h);
      MENU.forEach((item, i) => {
        const on = this.enabled(item.id);
        const color = !on ? 'iron' : i === this.cursor ? 'brassGlint' : 'steamWhite';
        drawText(g, item.label, ITEM_X, ITEM_Y0 + i * ITEM_STEP, { color });
      });
      const bob = (t >> 4) % 2;
      drawSprite(g, CURSOR, CURSOR_LEGEND, ITEM_X - 12 + bob, ITEM_Y0 + this.cursor * ITEM_STEP);
    }

    if (this.mode.kind === 'dialog') {
      const lines = DIALOGS[this.mode.id];
      const h = lines.length * 10 + 31;
      const y = Math.round((H - h) / 2) - 4;
      drawWindow(g, 20, y, 216, h);
      lines.forEach((line, i) => drawText(g, line, 32, y + 10 + i * 10, { color: 'steamWhite' }));
      if ((t >> 5) % 2 === 0) drawTextCentred(g, DIALOG_CLOSE, W / 2, y + h - 15, { color: 'brassLight' });
    }

    drawTextCentred(g, CREDIT, W / 2, 214, { color: 'ironLight' });
    drawText(g, VERSION, W - 4 - textWidth(VERSION), 214, { color: 'iron' });
  }
}
