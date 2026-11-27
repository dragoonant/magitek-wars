import { Gfx, H, W, rng } from './gfx';
import type { Ink } from './palette';

// The title backdrop (PLAN D13): Vaskor's Gear Citadel at dusk between two cliffs, rendered with the house style
// LoRA and snapped to the 256 x 224 grid (tools/art/snap.mjs), with the six faction leads standing on the cliff tops.
// Code adds only what a still image cannot: twinkling stars.

const ART = `${import.meta.env.BASE_URL}art/title/`;

/** Where each lead stands: feet on the cliff top (y), left edge x. Left group faces right, right group left. */
export const CAST: readonly { id: string; x: number; y: number }[] = [
  { id: 'wren', x: 5, y: 151 },
  { id: 'ilse', x: 26, y: 151 },
  { id: 'ulla', x: 47, y: 151 },
  { id: 'vell', x: 193, y: 151 },
  { id: 'ebbe', x: 210, y: 152 },
  { id: 'dasha', x: 227, y: 151 },
];

interface Star { x: number; y: number; phase: number }

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`art: could not load ${src}`));
    img.src = src;
  });
}

export class Scene {
  readonly bg: HTMLCanvasElement;
  private readonly stars: Star[] = [];
  private cast: { img: HTMLImageElement; x: number; y: number }[] = [];
  emblem: HTMLImageElement | null = null;
  ready = false;

  constructor() {
    this.bg = document.createElement('canvas');
    this.bg.width = W;
    this.bg.height = H;
  }

  async load(): Promise<void> {
    const [backdrop, emblem, ...cast] = await Promise.all([
      loadImage(`${ART}backdrop.png`),
      loadImage(`${ART}emblem.png`),
      ...CAST.map((c) => loadImage(`${ART}${c.id}.png`)),
    ]);
    const ctx = this.bg.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('scene: no 2d context');
    ctx.drawImage(backdrop, 0, 0);
    this.emblem = emblem;
    this.cast = CAST.map((c, i) => ({ img: cast[i], x: c.x, y: c.y - cast[i].height }));
    // Stars twinkle only where the backdrop is dark sky.
    const px = ctx.getImageData(0, 0, W, 90).data;
    const r = rng(0x6a7e);
    for (let tries = 0; tries < 400 && this.stars.length < 28; tries++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * 90), i = (y * W + x) * 4;
      if (px[i] + px[i + 1] + px[i + 2] < 210) this.stars.push({ x, y, phase: Math.floor(r() * 96) });
    }
    this.ready = true;
  }

  draw(g: Gfx, t: number): void {
    if (!this.ready) {
      g.rect(0, 0, W, H, 'duskZenith');
      return;
    }
    g.ctx.drawImage(this.bg, 0, 0);
    for (const s of this.stars) {
      const p = (t + s.phase) % 96;
      const c: Ink | null = p < 4 ? 'steamWhite' : p < 8 ? 'steam' : p < 12 ? 'duskLow' : null;
      if (c) g.px(s.x, s.y, c);
      if (p < 3) {
        g.px(s.x - 1, s.y, 'duskLow');
        g.px(s.x + 1, s.y, 'duskLow');
      }
    }
    for (const c of this.cast) g.ctx.drawImage(c.img, c.x, c.y);
  }
}
