import { PALETTE, type Ink } from './palette';

export const W = 256;
export const H = 224;

/** Whole-pixel drawing on a 256x224 logical canvas, house palette only. */
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

  /** 25% ordered dither of colour c over a rectangle (ART-STYLE section 4). */
  dither25(x: number, y: number, w: number, h: number, c: Ink): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const X = x + i;
        const Y = y + j;
        if (Y % 2 === 0 && (X + Y / 2) % 2 === 0) this.px(X, Y, c);
      }
    }
  }

  /** 50% checker dither of colour c over a rectangle. */
  dither50(x: number, y: number, w: number, h: number, c: Ink): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === 0) this.px(x + i, y + j, c);
    }
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
