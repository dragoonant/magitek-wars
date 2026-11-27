import { Gfx, H, W, drawSprite, rng } from './gfx';
import { GLOAM_CYCLE, WINDOW_CYCLE, type Ink } from './palette';
import { AIRSHIP, AIRSHIP_LEGEND, STRIDER, STRIDER_LEGEND } from './sprites';

// The title backdrop: Vaskor at dusk (docs/WORLD.md). Three parallax layers built once into an offscreen canvas,
// brought to life by palette cycling and a few small sprites (ART-STYLE section 6).

const HORIZON = 150;
const CITY_BASE = 176;
const SUN = { x: 128, y: 146, r: 30 };
const BEACON = { x: 128, y: 64 };
const STRIDER_AT = { x: 14, y: 130 };

interface Light { x: number; y: number; phase: number }
interface Emitter { x: number; y: number; every: number; offset: number }
interface Puff { x: number; y: number; age: number; life: number }
interface Star { x: number; y: number; phase: number }

const SKY: readonly [number, Ink][] = [
  [0, 'duskZenith'],
  [28, 'duskHigh'],
  [52, 'duskMid'],
  [76, 'duskLow'],
  [98, 'emberDeep'],
  [116, 'ember'],
  [132, 'emberBright'],
  [144, 'emberGlow'],
];

/** Top of the foreground ridge the strider stands on (flat between x 14 and 42). */
function ridgeTop(x: number): number {
  const off = Math.max(0, Math.abs(x - 28) - 14);
  const h = Math.round(12 - (off * off) / 40);
  return h > 0 ? CITY_BASE - h : CITY_BASE;
}

export class Scene {
  readonly bg: HTMLCanvasElement;
  private readonly lights: Light[] = [];
  private readonly emitters: Emitter[] = [];
  private readonly stars: Star[] = [];
  private puffs: Puff[] = [];

  constructor() {
    this.bg = document.createElement('canvas');
    this.bg.width = W;
    this.bg.height = H;
    const ctx = this.bg.getContext('2d');
    if (!ctx) throw new Error('scene: no 2d context');
    const g = new Gfx(ctx);
    const r = rng(0x6a7e);
    this.sky(g);
    this.sun(g);
    this.mountains(g);
    this.farCity(g, r);
    this.citadel(g, r);
    this.nearCity(g, r);
    this.ground(g);
    for (let i = 0; i < 40; i++) this.stars.push({ x: Math.floor(r() * W), y: 2 + Math.floor(r() * 60), phase: Math.floor(r() * 64) });
    this.emitters.push({ x: STRIDER_AT.x + 8, y: STRIDER_AT.y - 1, every: 22, offset: 3 });
  }

  private sky(g: Gfx): void {
    for (let i = 0; i < SKY.length; i++) {
      const [top, c] = SKY[i];
      const bottom = i + 1 < SKY.length ? SKY[i + 1][0] : HORIZON;
      g.rect(0, top, W, bottom - top, c);
    }
    for (let i = 1; i < SKY.length; i++) {
      const [b, next] = SKY[i];
      g.dither25(0, b - 4, W, 2, next);
      g.dither50(0, b - 2, W, 2, next);
    }
    g.rect(0, HORIZON, W, CITY_BASE - HORIZON, 'emberGlow');
  }

  private sun(g: Gfx): void {
    const { x: cx, y: cy, r } = SUN;
    for (let y = cy - r; y <= cy + r; y++) {
      const band = y - (cy - 10);
      if (band >= 0 && band % 5 === 4) continue; // smog stripes
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        g.px(x, y, dy < -14 ? 'brassGlint' : 'emberGlow');
      }
    }
  }

  private mountains(g: Gfx): void {
    for (let x = 0; x < W; x++) {
      const lift = 0.35 + (0.65 * Math.abs(x - 128)) / 128; // a valley where the sun sets
      const h = (16 + 8 * Math.sin(x * 0.029 + 0.5) + 5 * Math.sin(x * 0.071 + 2) + 2 * Math.sin(x * 0.23)) * lift;
      const top = Math.round(HORIZON - h);
      g.rect(x, top, 1, CITY_BASE - top, 'duskMid');
      g.px(x, top, 'emberDeep');
    }
  }

  private farCity(g: Gfx, r: () => number): void {
    let x = -4;
    while (x < W) {
      const w = 6 + Math.floor(r() * 9);
      const h = 18 + Math.floor(r() * 28);
      const top = CITY_BASE - h;
      g.rect(x, top, w, h, 'duskLow');
      g.rect(x + 1, top + 1, w - 1, h - 1, 'ironDark');
      if (r() < 0.25 && w >= 8) {
        const rad = Math.floor(w / 2);
        const cx = x + rad;
        for (let dy = -rad; dy <= 0; dy++) {
          for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) g.px(cx + dx, top + dy, 'ironDark');
        }
      }
      x += w + Math.floor(r() * 3);
    }
  }

  private windows(r: () => number, x: number, top: number, w: number, bottom: number, chance: number): void {
    for (let wy = top + 3; wy < bottom - 3; wy += 4) {
      for (let wx = x + 2; wx < x + w - 1; wx += 3) {
        if (r() < chance) this.lights.push({ x: wx, y: wy, phase: Math.floor(r() * 64) });
      }
    }
  }

  private citadel(g: Gfx, r: () => number): void {
    const tiers: [number, number, number, number][] = [
      [106, 140, 44, 36],
      [112, 112, 32, 28],
      [118, 92, 20, 20],
      [126, 72, 4, 20],
      [127, 66, 2, 6],
    ];
    for (const [x, y, w, h] of tiers) {
      g.rect(x, y, w, h, 'ironNight');
      g.rect(x, y, w, 1, 'emberDeep');
      g.rect(x, y + 1, 1, h - 1, 'ironDark');
    }
    this.windows(r, 106, 140, 44, CITY_BASE, 0.35);
    this.windows(r, 118, 92, 20, 112, 0.3);
    // The brass wheel on the citadel's face.
    const cx = 128;
    const cy = 125;
    for (let dy = -11; dy <= 11; dy++) {
      for (let dx = -11; dx <= 11; dx++) {
        const d = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * 10;
        const tooth = a % 1 < 0.5;
        let c: Ink | null = null;
        if (d <= 2) c = 'ink';
        else if (d <= 5) c = 'brassDark';
        else if (d <= 7.5) c = dx + dy < -3 ? 'brassLight' : 'brass';
        else if (d <= 10 && tooth) c = dx + dy < -4 ? 'brass' : 'brassDark';
        if (c) g.px(cx + dx, cy + dy, c);
      }
    }
  }

  private nearCity(g: Gfx, r: () => number): void {
    let x = -2;
    while (x < W) {
      const w = 8 + Math.floor(r() * 12);
      if (x + w > 100 && x < 156) {
        x = 157;
        continue;
      }
      const h = 8 + Math.floor(r() * 22);
      const top = CITY_BASE - h;
      g.rect(x, top, w, h, 'ironNight');
      g.rect(x, top, w, 1, 'ironDark');
      this.windows(r, x, top, w, CITY_BASE, 0.3);
      if (r() < 0.45) {
        const sx = x + 2 + Math.floor(r() * Math.max(1, w - 6));
        const sh = 12 + Math.floor(r() * 18);
        g.rect(sx, top - sh, 3, sh, 'ironNight');
        g.rect(sx - 1, top - sh, 5, 2, 'ironDark');
        this.emitters.push({ x: sx + 1, y: top - sh - 1, every: 26 + Math.floor(r() * 20), offset: Math.floor(r() * 40) });
      }
      x += w + 1 + Math.floor(r() * 4);
    }
  }

  private ground(g: Gfx): void {
    g.rect(0, CITY_BASE, W, H - CITY_BASE, 'ink');
    g.rect(0, CITY_BASE, W, 1, 'ironNight');
    for (let x = 0; x < W; x++) {
      const top = ridgeTop(x);
      if (top >= CITY_BASE) continue;
      g.rect(x, top, 1, CITY_BASE - top, 'ink');
      g.px(x, top, 'ironDark');
    }
    // Window lights the ridge covers are not drawn.
    for (let i = this.lights.length - 1; i >= 0; i--) if (this.lights[i].y >= ridgeTop(this.lights[i].x)) this.lights.splice(i, 1);
    g.rect(0, 194, W, 1, 'ironDark');
    for (let x = 1; x < W; x += 6) g.rect(x, 195, 3, 1, 'brassShadow');
  }

  /** Advance one logical frame (60 per second). */
  step(t: number): void {
    for (const e of this.emitters) {
      if ((t + e.offset) % e.every === 0) this.puffs.push({ x: e.x, y: e.y, age: 0, life: 170 + ((t * 7 + e.x) % 90) });
    }
    for (const p of this.puffs) {
      p.age++;
      p.x += 0.07;
      p.y -= 0.13;
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life && p.y > -6);
  }

  draw(g: Gfx, t: number): void {
    for (const s of this.stars) {
      if (((t >> 3) + s.phase) % 23 === 0) continue;
      const bright = ((t >> 4) + s.phase) % 9 === 0;
      g.px(s.x, s.y, bright ? 'steamWhite' : s.phase % 3 === 0 ? 'steam' : 'ironLight');
    }
    const ax = Math.round(W + 12 - ((t * 0.15) % (W + 48)));
    const lamp = GLOAM_CYCLE[(t >> 4) % GLOAM_CYCLE.length] === 'gloamWhite' ? 'brassGlint' : 'emberGlow';
    drawSprite(g, AIRSHIP, { ...AIRSHIP_LEGEND, g: lamp }, ax, 34 + Math.round(Math.sin(t / 120)));

    for (const l of this.lights) {
      const off = ((t >> 7) + l.phase * 3) % 17 === 0;
      g.px(l.x, l.y, off ? 'ironDark' : WINDOW_CYCLE[((t >> 5) + l.phase) % WINDOW_CYCLE.length]);
    }

    const glow = GLOAM_CYCLE[(t >> 3) % GLOAM_CYCLE.length];
    g.rect(BEACON.x - 1, BEACON.y, 3, 1, glow);
    if (glow === 'gloamWhite' || glow === 'gloamBright') {
      g.px(BEACON.x, BEACON.y - 1, 'gloam');
      g.px(BEACON.x, BEACON.y + 1, 'gloam');
    }

    for (const p of this.puffs) {
      const k = p.age / p.life;
      const rad = 1 + Math.min(3, Math.floor(k * 5));
      const c: Ink = k < 0.3 ? 'steam' : k < 0.6 ? 'ironLight' : 'iron';
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy > rad * rad + rad) continue;
          if (k > 0.82 && (cx + dx + cy + dy) % 2 !== 0) continue; // thinning smoke dithers out
          g.px(cx + dx, cy + dy, c);
        }
      }
    }

    drawSprite(g, STRIDER, { ...STRIDER_LEGEND, g: GLOAM_CYCLE[(t >> 4) % GLOAM_CYCLE.length] }, STRIDER_AT.x, STRIDER_AT.y);
  }
}

/** A rotating brass gear, drawn per frame (rotation is drawn, never a transform: ART-STYLE section 1). */
export function drawGear(g: Gfx, cx: number, cy: number, rot: number, teeth = 8): void {
  for (let dy = -9; dy <= 9; dy++) {
    for (let dx = -9; dx <= 9; dx++) {
      const d = Math.hypot(dx, dy);
      const tooth = (((Math.atan2(dy, dx) + rot) / (Math.PI * 2) + 2) * teeth) % 1 < 0.5;
      let c: Ink | null = null;
      if (d <= 1.5) c = 'ink';
      else if (d <= 3.2) c = 'brassDark';
      else if (d <= 5.2) c = dx + dy < -2 ? 'brassGlint' : 'brassLight';
      else if (d <= 6.2) c = 'brass';
      else if (d <= 7.8 && tooth) c = dx + dy < -3 ? 'brassLight' : 'brassDark';
      else if (d <= 8.8 && (tooth || d <= 7.2)) c = 'ink'; // 1 px outline
      if (c) g.px(cx + dx, cy + dy, c);
    }
  }
}
