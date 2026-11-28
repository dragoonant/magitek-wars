import { PALETTE, type Ink } from './palette';

export const W = 256;
export const H = 224;

/** Drawing on a logical canvas in house colours; the backing canvas has several device pixels per logical one (PLAN D25). */
export class Gfx {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  px(x: number, y: number, c: Ink): void {
    this.ctx.fillStyle = PALETTE[c];
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, c: Ink): void {
    this.ctx.fillStyle = PALETTE[c];
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** A 25% wash of colour c over a rectangle (PLAN D25: was an ordered dither). */
  dither25(x: number, y: number, w: number, h: number, c: Ink): void {
    this.wash(x, y, w, h, c, 0.25);
  }

  /** A 50% wash of colour c over a rectangle (PLAN D25: was a checker dither). */
  dither50(x: number, y: number, w: number, h: number, c: Ink): void {
    this.wash(x, y, w, h, c, 0.5);
  }

  /** Colour c over a rectangle at opacity a. */
  wash(x: number, y: number, w: number, h: number, c: Ink, a: number): void {
    this.ctx.save();
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = PALETTE[c];
    this.ctx.fillRect(x, y, w, h);
    this.ctx.restore();
  }
}

export type Legend = Record<string, Ink>;

/** Draw a character-map sprite. '.' is transparent; every other character must be in the legend. */
export function drawSprite(g: Gfx, map: readonly string[], legend: Legend, x: number, y: number): void {
  for (let j = 0; j < map.length; j++) {
    const row = map[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = legend[ch];
      if (!c) throw new Error(`sprite: no colour for '${ch}'`);
      g.px(x + i, y + j, c);
    }
  }
}

/** Seeded RNG (mulberry32) so the skyline is the same every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
