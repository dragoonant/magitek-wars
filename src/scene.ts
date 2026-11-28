import { drawPic, loadArt, picSize } from './detail';
import { Gfx, H, W, rng } from './gfx';
import { rgba } from './palette';

// The title backdrop (PLAN D13): Vaskor's Gear Citadel at dusk between two cliffs, rendered with the house style
// LoRA and snapped to the 256 x 224 grid (tools/art/snap.mjs), with the six faction leads standing on the cliff tops.
// Code adds only what a still image cannot: twinkling stars.


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

export class Scene {
  private bg: HTMLImageElement | null = null;
  private stars: Star[] = [];
  private cast: { img: HTMLImageElement; x: number; y: number }[] = [];
  emblem: HTMLImageElement | null = null;
  ready = false;

  /** Loads the title art in the current detail mode (PLAN D22); called again when the mode changes. */
  async load(): Promise<void> {
    const [backdrop, emblem, ...cast] = await Promise.all([
      loadArt('art/title/backdrop.png'),
      loadArt('art/title/emblem.png'),
      ...CAST.map((c) => loadArt(`art/title/${c.id}.png`)),
    ]);
    // Stars twinkle only where the backdrop is dark sky (sampled on the logical 256 x 90 grid).
    const probe = document.createElement('canvas');
    probe.width = W;
    probe.height = 90;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('scene: no 2d context');
    ctx.drawImage(backdrop, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, 90).data;
    const r = rng(0x6a7e);
    const stars: Star[] = [];
    for (let tries = 0; tries < 400 && stars.length < 28; tries++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * 90), i = (y * W + x) * 4;
      if (px[i] + px[i + 1] + px[i + 2] < 210) stars.push({ x, y, phase: Math.floor(r() * 96) });
    }
    this.bg = backdrop;
    this.stars = stars;
    this.emblem = emblem;
    this.cast = CAST.map((c, i) => ({ img: cast[i], x: c.x, y: c.y - picSize(cast[i]).h }));
    this.ready = true;
  }

  draw(g: Gfx, t: number): void {
    if (!this.ready || !this.bg) {
      g.rect(0, 0, W, H, 'duskZenith');
      return;
    }
    drawPic(g, this.bg, 0, 0, W, H);
    // stars twinkle as soft points of light (PLAN D25)
    const ctx = g.ctx;
    for (const s of this.stars) {
      const p = (t + s.phase) % 96;
      if (p >= 12) continue;
      const a = p < 4 ? 1 : p < 8 ? 0.6 : 0.3;
      const r = p < 3 ? 1.4 : 0.8;
      const gr = ctx.createRadialGradient(s.x + 0.5, s.y + 0.5, 0, s.x + 0.5, s.y + 0.5, r);
      gr.addColorStop(0, rgba('steamWhite', a));
      gr.addColorStop(1, rgba('steamWhite', 0));
      ctx.fillStyle = gr;
      ctx.fillRect(s.x + 0.5 - r, s.y + 0.5 - r, r * 2, r * 2);
    }
    for (const c of this.cast) drawPic(g, c.img, c.x, c.y);
  }
}
