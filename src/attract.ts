// The attract mode (PLAN D27): when the title waits unattended, or when THE STORY is picked on the title menu, the
// world of the Crystal War is introduced page by page, then each nation at war, over its own painted field.
// Drawn at 512 x 448 like the campaign screens. Left and right page through; any other key or tap returns.
import { drawCover, drawPic } from './detail';
import { drawText, drawTextCentred, textWidth, wrapPx } from './font';
import type { Gfx } from './gfx';
import { rgba } from './palette';
import { clipRound, frame, rule } from './ui';
import { FACTIONS } from './data/factions';
import { cardArt, emblem, field } from './match/art';
import { LEADS } from './run/run';
import { attractPages, type StoryPage } from './story';
import { ATTRACT } from './strings';

const W = 512;
const H = 448;
/** Frames (60 a second) a page stays up: a base, plus time to read it at about 20 characters a second. */
export function pageFrames(p: StoryPage): number {
  const chars = p.heading.length + (p.sub?.length ?? 0) + p.paragraphs.reduce((n, s) => n + s.length, 0);
  return 210 + Math.round(chars * 3);
}
const FADE = 36;
/** Frames between one paragraph appearing and the next. */
const STAGGER = 70;
export const TEXT_W = 440;
const LINE = 12.5;

export class Attract {
  readonly pages = attractPages();
  page = 0;
  private t0 = -1;
  /** Set when the player leaves, or the last page has played; main.ts returns to the title. */
  exit = false;

  /** `from` says where the title returns to: the PRESS START screen (idle) or the menu (picked there). */
  constructor(readonly from: 'idle' | 'menu') {}

  private go(d: number): void {
    const n = this.page + d;
    if (n >= this.pages.length) { this.exit = true; return; }
    this.page = Math.max(0, n);
    this.t0 = -1;
  }

  key(code: string): void {
    if (code === 'ArrowRight' || code === 'KeyD') this.go(1);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.go(-1);
    else this.exit = true;
  }

  /** A tap on the left or right edge pages; anywhere else returns to the title. */
  pointerDown(x: number, _y: number): void {
    if (x < 96) this.go(-1);
    else if (x >= W - 96) this.go(1);
    else this.exit = true;
  }

  draw(g: Gfx, t: number): void {
    if (this.t0 < 0) this.t0 = t;
    const p = this.pages[this.page];
    const dur = pageFrames(p);
    const age = t - this.t0;
    if (age >= dur) { this.go(1); if (this.exit) { g.rect(0, 0, W, H, 'ink'); return; } }
    const k = Math.min(1, age / dur);
    const fade = Math.min(1, age / FADE, (dur - age) / FADE);
    const ctx = g.ctx;
    g.rect(0, 0, W, H, 'ink');
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    // the field, slowly drawing closer
    const img = field(p.field);
    if (img) {
      const z = 1.02 + 0.07 * k;
      ctx.save();
      ctx.translate(W / 2, H * 0.42);
      ctx.scale(z, z);
      ctx.translate(-W / 2 + (this.page % 2 ? 8 : -8) * (k - 0.5), -H * 0.42);
      drawCover(g, img, W, H);
      ctx.restore();
    }
    const dark = ctx.createLinearGradient(0, 0, 0, H);
    dark.addColorStop(0, rgba('duskZenith', 0.35));
    dark.addColorStop(0.38, rgba('ink', p.nation ? 0.35 : 0.25));
    dark.addColorStop(0.62, rgba('ink', 0.78));
    dark.addColorStop(1, rgba('ink', 0.94));
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);

    let y = 232;
    if (p.nation) {
      // the nation's lead, framed, with its emblem
      const art = cardArt(LEADS[p.nation], false, true);
      const aw = 256, ah = 192, ax = (W - aw) / 2, ay = 22;
      if (art) {
        const un = clipRound(g, ax, ay, aw, ah, 4);
        drawPic(g, art, ax, ay, aw, ah);
        un();
      }
      frame(g, ax, ay, aw, ah, 'brass', 4, true);
      const em = emblem(FACTIONS.find((f) => f.engine === p.nation)!.key);
      y = 230;
      if (em) {
        const hw = textWidth(p.heading, 2.2, 'display');
        drawPic(g, em, W / 2 - hw / 2 - 36, y - 6);
        drawPic(g, em, W / 2 + hw / 2 + 8, y - 6);
      }
    }
    drawTextCentred(g, p.heading, W / 2, y, { color: 'brassGlint', scale: 2.2, face: 'display', outline: 'ink', shadow: 'emberNight' });
    y += 26;
    if (p.sub) {
      drawTextCentred(g, p.sub, W / 2, y, { color: 'emberGlow', face: 'display', shadow: 'ink' });
      y += 14;
    }
    rule(g, W / 2 - 150, y, 300);
    y += 10;
    p.paragraphs.forEach((para, i) => {
      const a = Math.max(0, Math.min(1, (age - 20 - i * STAGGER) / 30));
      for (const line of wrapPx(para, TEXT_W)) {
        if (a > 0) drawTextCentred(g, line, W / 2, y, { color: 'steamWhite', shadow: 'ink', alpha: a });
        y += LINE;
      }
      y += 6;
    });
    ctx.restore();

    // paging: chevrons at the edges, a dot for each page, and what a key does
    const pulse = 0.45 + 0.25 * Math.sin(t / 18);
    if (this.page > 0) drawText(g, '‹', 14, H / 2 - 10, { color: 'brassLight', scale: 3, face: 'display', alpha: pulse, shadow: 'ink' });
    drawText(g, '›', W - 26, H / 2 - 10, { color: 'brassLight', scale: 3, face: 'display', alpha: pulse, shadow: 'ink' });
    const n = this.pages.length;
    for (let i = 0; i < n; i++) {
      const x = W / 2 - (n - 1) * 6 + i * 12;
      ctx.beginPath();
      ctx.arc(x, H - 26, i === this.page ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(i === this.page ? 'brassGlint' : 'iron', i === this.page ? 1 : 0.8);
      ctx.fill();
    }
    drawTextCentred(g, ATTRACT.hint, W / 2, H - 16, { color: 'steam', scale: 0.9, alpha: 0.8 });
  }
}
