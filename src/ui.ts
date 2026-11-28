// The interface kit (PLAN D25): smoked-glass panels in brass frames, brass buttons and painted backdrops, drawn
// smoothly at the screen's own resolution to sit with the rendered art instead of looking like a 16-bit cartridge.
// Every colour is a house colour (src/palette.ts); gradients, shadows and transparency blend between them.
import { loadArt, picSize } from './detail';
import { drawText, textWidth, type Face } from './font';
import type { Gfx } from './gfx';
import { PALETTE, rgba, type Ink } from './palette';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}

/** A small brass stud: a lit dome with a dark rim. */
export function stud(g: Gfx, x: number, y: number, r = 1.6): void {
  const ctx = g.ctx;
  const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0.1, x, y, r);
  gr.addColorStop(0, PALETTE.brassGlint);
  gr.addColorStop(0.5, PALETTE.brass);
  gr.addColorStop(1, PALETTE.brassShadow);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export type PanelTone = 'glass' | 'dark' | 'light';

/**
 * A smoked-glass panel in a brass frame with a soft shadow: the house window (replaces ART-STYLE section 7's riveted
 * 1 px window). `glow` lights the frame, for the panel in focus.
 */
export function panel(g: Gfx, x: number, y: number, w: number, h: number, opt: { tone?: PanelTone; glow?: Ink; r?: number; studs?: boolean } = {}): void {
  const ctx = g.ctx;
  const r = opt.r ?? 4;
  ctx.save();
  // shadow under the panel
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, r);
  const tone = opt.tone ?? 'glass';
  ctx.fillStyle = tone === 'light'
    ? vgrad(ctx, y, y + h, [[0, rgba('ironDark', 0.94)], [1, rgba('ironNight', 0.96)]])
    : tone === 'dark'
      ? vgrad(ctx, y, y + h, [[0, rgba('ironNight', 0.96)], [1, rgba('ink', 0.97)]])
      : vgrad(ctx, y, y + h, [[0, rgba('duskHigh', 0.9)], [0.45, rgba('duskZenith', 0.9)], [1, rgba('ink', 0.94)]]);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // a faint sheen across the top of the glass
  roundRect(ctx, x + 2, y + 2, w - 4, Math.min(18, h / 3), Math.max(0, r - 2));
  ctx.fillStyle = vgrad(ctx, y + 2, y + 2 + Math.min(18, h / 3), [[0, rgba('steamWhite', 0.07)], [1, rgba('steamWhite', 0)]]);
  ctx.fill();
  // the brass frame: lit from the top
  if (opt.glow) {
    ctx.shadowColor = rgba(opt.glow, 0.8);
    ctx.shadowBlur = 6;
  }
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = vgrad(ctx, y, y + h, [[0, PALETTE.brassLight], [0.25, PALETTE.brass], [0.75, PALETTE.brassDark], [1, PALETTE.brass]]);
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  roundRect(ctx, x + 2.25, y + 2.25, w - 4.5, h - 4.5, Math.max(0, r - 1.5));
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = rgba('brassShadow', 0.9);
  ctx.stroke();
  ctx.restore();
  if (opt.studs !== false && w > 30 && h > 30) for (const [sx, sy] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) stud(g, sx, sy, 1.4);
}

export type ButtonState = 'on' | 'off' | 'hot' | 'danger' | 'picked';

/** A brass button; its label is drawn in Cinzel. Returns the width. */
export function button(g: Gfx, label: string, x: number, y: number, opt: { w?: number; h?: number; state?: ButtonState; face?: Face } = {}): number {
  const ctx = g.ctx;
  const face = opt.face ?? 'display';
  const h = opt.h ?? 16;
  const w = opt.w ?? Math.ceil(textWidth(label, 1, face)) + 16;
  const st = opt.state ?? 'on';
  ctx.save();
  ctx.shadowColor = st === 'hot' ? rgba('brassGlint', 0.7) : 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = st === 'hot' ? 6 : 3;
  ctx.shadowOffsetY = st === 'hot' ? 0 : 1;
  roundRect(ctx, x, y, w, h, 3);
  const ramp: Record<ButtonState, [Ink, Ink, Ink]> = {
    on: ['brassLight', 'brass', 'brassDark'],
    hot: ['brassGlint', 'brassLight', 'brass'],
    picked: ['brassGlint', 'brassLight', 'brass'],
    off: ['iron', 'ironDark', 'ironNight'],
    danger: ['emberBright', 'ember', 'emberDeep'],
  };
  const [a, b, c] = ramp[st];
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, PALETTE[a]], [0.45, PALETTE[b]], [1, PALETTE[c]]]);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba('ink', 0.85);
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  ctx.stroke();
  roundRect(ctx, x + 1.5, y + 1.25, w - 3, h / 2 - 1, 2);
  ctx.fillStyle = rgba('steamWhite', st === 'off' ? 0.05 : 0.18);
  ctx.fill();
  ctx.restore();
  const ink: Ink = st === 'off' ? 'ironLight' : st === 'danger' ? 'steamWhite' : 'brassShadow';
  const tw = textWidth(label, 1, face);
  drawText(g, label, x + (w - tw) / 2, y + (h - 7) / 2 + 0.5, { color: ink, face });
  return w;
}

/** A soft highlight bar for the picked row of a list. */
export function highlight(g: Gfx, x: number, y: number, w: number, h: number, ink: Ink = 'brass', strength = 1): void {
  const ctx = g.ctx;
  ctx.save();
  const gr = ctx.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, rgba(ink, 0.55 * strength));
  gr.addColorStop(0.6, rgba(ink, 0.25 * strength));
  gr.addColorStop(1, rgba(ink, 0.05 * strength));
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.fillStyle = PALETTE[ink === 'brass' ? 'brassGlint' : ink];
  ctx.fillRect(x, y + 1, 1.5, h - 2);
  ctx.restore();
}

/** A rounded frame around a picture (cards, portraits): ink edge, brass line, soft shadow. */
export function frame(g: Gfx, x: number, y: number, w: number, h: number, ink: Ink = 'brass', r = 3, glow = false): void {
  const ctx = g.ctx;
  ctx.save();
  if (glow) {
    ctx.shadowColor = rgba(ink, 0.9);
    ctx.shadowBlur = 7;
  }
  roundRect(ctx, x - 0.5, y - 0.5, w + 1, h + 1, r);
  ctx.lineWidth = glow ? 1.75 : 1.25;
  ctx.strokeStyle = PALETTE[ink];
  ctx.stroke();
  ctx.restore();
}

/** Clip later drawing to a rounded rectangle; call the returned function to undo it. */
export function clipRound(g: Gfx, x: number, y: number, w: number, h: number, r = 3): () => void {
  g.ctx.save();
  roundRect(g.ctx, x, y, w, h, r);
  g.ctx.clip();
  return () => g.ctx.restore();
}

/** A rounded flat fill (house colour at an opacity). */
export function fillRound(g: Gfx, x: number, y: number, w: number, h: number, ink: Ink, a = 1, r = 3): void {
  const ctx = g.ctx;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = rgba(ink, a);
  ctx.fill();
}

// Painted backdrops: a battlefield render, blurred and darkened, behind the menu screens, so every screen sits in
// the world of the art instead of on a flat navy fill.
const backdrops = new Map<string, { src: HTMLImageElement; soft: HTMLCanvasElement } | 'loading' | Error>();

/** Fields under public/art/fields/ (without .png) usable as backdrops. */
export type Field = 'vaskor' | 'thrumhollow' | 'rimeglass' | 'kitebarrow' | 'sedgemere' | 'hush' | 'greying';

function soften(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const { w, h } = picSize(img);
  c.width = Math.max(8, Math.round(w / 3));
  c.height = Math.max(8, Math.round(h / 3));
  const cx = c.getContext('2d');
  if (!cx) throw new Error('ui: no 2d context');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Fill w x h with a painted backdrop: the field render, softened and dimmed, with a vignette. While the picture
 * loads, a dusk gradient stands in (and the load is started).
 */
export function backdrop(g: Gfx, w: number, h: number, field: Field = 'vaskor', dim = 0.5): void {
  const ctx = g.ctx;
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, PALETTE.duskHigh], [0.6, PALETTE.duskZenith], [1, PALETTE.ink]]);
  ctx.fillRect(0, 0, w, h);
  const b = backdrops.get(field);
  if (b === undefined) {
    backdrops.set(field, 'loading');
    loadArt(`art/fields/${field}.png`).then(
      (img) => backdrops.set(field, { src: img, soft: soften(img) }),
      (e: unknown) => backdrops.set(field, e instanceof Error ? e : new Error(String(e))),
    );
  } else if (b instanceof Error) throw b;
  else if (b !== 'loading') {
    const size = { w: b.soft.width, h: b.soft.height };
    const k = Math.max(w / size.w, h / size.h);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b.soft, (w - size.w * k) / 2, (h - size.h * k) / 2, size.w * k, size.h * k);
    ctx.restore();
  }
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, rgba('duskZenith', dim - 0.1)], [0.5, rgba('ink', dim - 0.05)], [1, rgba('ink', dim + 0.1)]]);
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, rgba('ink', 0.45));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/** A thin brass rule with fading ends, to divide sections. */
export function rule(g: Gfx, x: number, y: number, w: number, ink: Ink = 'brass'): void {
  const ctx = g.ctx;
  const gr = ctx.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, rgba(ink, 0));
  gr.addColorStop(0.15, rgba(ink, 0.9));
  gr.addColorStop(0.85, rgba(ink, 0.9));
  gr.addColorStop(1, rgba(ink, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(x, y, w, 1);
}
