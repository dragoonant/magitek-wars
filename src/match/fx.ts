// Battle effects (PLAN D26): particles, rings, bolts, slashes, banners, floating numbers and shakes, drawn over the
// match screen. The engine's log is the only trigger: board.ts turns each new log entry into effects here, so an
// effect can never show something the engine did not do. Time is in frames (60 a second); an effect born in the
// future waits, which is how a batch of events is played out one after another instead of all at once.
import { drawPic } from '../detail';
import { drawTextCentred } from '../font';
import type { Gfx } from '../gfx';
import { rgba, type Ink } from '../palette';
import { fillRound, frame } from '../ui';

export type Pt = [number, number];

interface Particle { x: number; y: number; vx: number; vy: number; born: number; life: number; ink: Ink; size: number; grav: number; drag: number; shape: 'dot' | 'shard' | 'spark' }
interface Ring { x: number; y: number; r0: number; r1: number; born: number; life: number; ink: Ink; width: number }
/** How a bolt looks in flight: fire for harm, crystal for repair, brass for orders and buffs, frost, or shadow. */
export type BoltStyle = 'fire' | 'crystal' | 'brass' | 'frost' | 'shadow' | 'plain';
interface Bolt { from: Pt; to: Pt; born: number; life: number; ink: Ink; hit?: () => void; done?: boolean; style: BoltStyle }
/** A card flying across the board: drawn, created, burned, cast or played. */
interface FlyCard { img: HTMLImageElement | null; back: 'mine' | 'foe' | null; from: [number, number, number, number]; to: [number, number, number, number]; born: number; life: number; arc: number; spin: number; burn: boolean; dissolve: boolean; land?: () => void; done?: boolean }
/** A piece of a broken card: a part of its art that tumbles and falls. */
interface Shard { img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number; x: number; y: number; w: number; h: number; vx: number; vy: number; rot: number; vr: number; born: number; life: number }
interface Rune { x: number; y: number; r: number; ink: Ink; born: number; life: number }
interface ScreenFlash { ink: Ink; a: number; born: number; life: number }
interface Slash { x: number; y: number; born: number; life: number; ink: Ink; angle: number; len: number }
interface Float { x: number; y: number; text: string; ink: Ink; born: number; scale: number }
interface Flash { x: number; y: number; w: number; h: number; ink: Ink; born: number; life: number }
interface Banner { title: string; sub: string; ink: Ink; born: number; life: number; art: HTMLImageElement | null; y: number }
interface Column { x: number; born: number; life: number; ink: Ink }
interface Jolt { dx: number; dy: number; born: number; life: number; kind: 'lunge' | 'shake' }

const MAX_PARTICLES = 700;

export class Fx {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private slashes: Slash[] = [];
  private floats: Float[] = [];
  private flashes: Flash[] = [];
  private banners: Banner[] = [];
  private columns: Column[] = [];
  private jolts = new Map<string, Jolt[]>();
  private shakes: { amp: number; born: number; life: number }[] = [];
  private vignettes: { top: boolean; ink: Ink; born: number; life: number }[] = [];
  private seed = 1;

  /** A small deterministic random, so effects never touch the engine's seeded RNG. */
  private rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // ---------- building blocks ----------

  burst(x: number, y: number, ink: Ink | Ink[], n: number, born: number, o: { speed?: number; life?: number; size?: number; grav?: number; up?: number; spread?: number; shape?: Particle['shape']; drag?: number } = {}): void {
    const inks = Array.isArray(ink) ? ink : [ink];
    for (let i = 0; i < n && this.parts.length < MAX_PARTICLES; i++) {
      const a = this.rnd() * Math.PI * 2;
      const sp = (o.speed ?? 2) * (0.35 + this.rnd() * 0.85);
      const spread = o.spread ?? 0;
      this.parts.push({
        x: x + (this.rnd() - 0.5) * spread, y: y + (this.rnd() - 0.5) * spread,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0),
        born, life: (o.life ?? 28) * (0.6 + this.rnd() * 0.6), ink: inks[i % inks.length],
        size: (o.size ?? 1.6) * (0.6 + this.rnd() * 0.8), grav: o.grav ?? 0.06, drag: o.drag ?? 0.94, shape: o.shape ?? 'spark',
      });
    }
  }

  /** Motes that drift up: repairs, buffs, recalls. */
  rise(x: number, y: number, ink: Ink | Ink[], n: number, born: number, w = 40): void {
    const inks = Array.isArray(ink) ? ink : [ink];
    for (let i = 0; i < n && this.parts.length < MAX_PARTICLES; i++) {
      this.parts.push({
        x: x + (this.rnd() - 0.5) * w, y: y + (this.rnd() - 0.2) * 30, vx: (this.rnd() - 0.5) * 0.3, vy: -0.5 - this.rnd() * 0.9,
        born: born + Math.floor(this.rnd() * 10), life: 34 + this.rnd() * 20, ink: inks[i % inks.length], size: 1.2 + this.rnd() * 1.2,
        grav: -0.005, drag: 0.99, shape: 'dot',
      });
    }
  }

  ring(x: number, y: number, ink: Ink, born: number, r0 = 6, r1 = 40, life = 22, width = 2.5): void {
    this.rings.push({ x, y, r0, r1, born, life, ink, width });
  }

  bolt(from: Pt, to: Pt, ink: Ink, born: number, life = 12, hit?: () => void, style: BoltStyle = 'plain'): void {
    this.bolts.push({ from, to, born, life, ink, hit, style });
  }

  private cards: FlyCard[] = [];
  private shards: Shard[] = [];
  private runes: Rune[] = [];
  private flashesFull: ScreenFlash[] = [];

  /** A card flying from one rectangle to another (x, y, w, h), face up (img) or as a back; it may burn or dissolve. */
  fly(img: HTMLImageElement | null, back: FlyCard['back'], from: FlyCard['from'], to: FlyCard['to'], born: number, o: { life?: number; arc?: number; spin?: number; burn?: boolean; dissolve?: boolean; land?: () => void } = {}): void {
    this.cards.push({ img, back, from, to, born, life: o.life ?? 22, arc: o.arc ?? 30, spin: o.spin ?? 0, burn: !!o.burn, dissolve: !!o.dissolve, land: o.land });
  }

  /** Break a picture (the part sx, sy, sw, sh of img) drawn at x, y, w, h into tumbling pieces. */
  shatter(img: HTMLImageElement, src: [number, number, number, number], x: number, y: number, w: number, h: number, born: number, cols = 5, rows = 4, power = 1): void {
    const [sx, sy, sw, sh] = src;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + (c * w) / cols, py = y + (r * h) / rows;
        const dx = px + w / cols / 2 - (x + w / 2), dy = py + h / rows / 2 - (y + h / 2);
        this.shards.push({
          img, sx: sx + (c * sw) / cols, sy: sy + (r * sh) / rows, sw: sw / cols, sh: sh / rows, x: px, y: py, w: w / cols, h: h / rows,
          vx: (dx * 0.06 + (this.rnd() - 0.5) * 2.2) * power, vy: (dy * 0.05 - 1.2 - this.rnd() * 2) * power, rot: 0, vr: (this.rnd() - 0.5) * 0.35,
          born: born + Math.floor(this.rnd() * 3), life: 46 + this.rnd() * 20,
        });
      }
    }
  }

  /** A turning circle of runes under a unit as it is deployed. */
  rune(x: number, y: number, r: number, ink: Ink, born: number, life = 40): void {
    this.runes.push({ x, y, r, ink, born, life });
  }

  /** The whole screen lit for a moment: the weight of a big hit. */
  flashScreen(ink: Ink, a: number, born: number, life = 6): void {
    this.flashesFull.push({ ink, a, born, life });
  }

  /** Bursts of light over the board, one after another: a victory. */
  fireworks(w: number, h: number, born: number, n = 10): void {
    const inks: Ink[][] = [['brassGlint', 'brassLight'], ['crystalBright', 'crystalWhite'], ['emberGlow', 'emberBright'], ['steamWhite', 'brassGlint']];
    for (let i = 0; i < n; i++) {
      const x = w * (0.15 + this.rnd() * 0.7), y = h * (0.12 + this.rnd() * 0.45), b = born + i * 9 + Math.floor(this.rnd() * 5);
      const ink = inks[i % inks.length];
      this.bolt([x + (this.rnd() - 0.5) * 60, h], [x, y], ink[0], b, 16, undefined, 'plain');
      this.burst(x, y, ink, 26, b + 16, { speed: 3.4, life: 46, size: 1.8, grav: 0.05, drag: 0.95 });
      this.ring(x, y, ink[0], b + 16, 4, 44, 26, 2);
    }
  }

  /** Small embers that drift up through the scene, drawn under everything else. */
  ambient(g: Gfx, t: number, w: number, h: number, ink: Ink = 'emberGlow'): void {
    const ctx = g.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const sp = 0.18 + ((i * 37) % 11) / 40;
      const x = ((i * 97.3) % w) + Math.sin(t / 60 + i) * 14;
      const y = h - (((t * sp + i * 53) % (h + 40)));
      const a = 0.18 + 0.18 * Math.sin(t / 20 + i * 1.7);
      ctx.fillStyle = rgba(i % 3 === 0 ? 'crystalBright' : ink, a);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  slash(x: number, y: number, ink: Ink, born: number): void {
    const a = -0.7 + this.rnd() * 0.4;
    this.slashes.push({ x, y, born, life: 12, ink, angle: a, len: 34 });
    this.slashes.push({ x, y, born: born + 2, life: 12, ink: 'steamWhite', angle: a + Math.PI / 2.3, len: 26 });
  }

  float(x: number, y: number, text: string, ink: Ink, born: number, scale = 2): void {
    this.floats.push({ x, y, text, ink, born, scale });
  }

  flash(x: number, y: number, w: number, h: number, ink: Ink, born: number, life = 16): void {
    this.flashes.push({ x, y, w, h, ink, born, life });
  }

  banner(title: string, sub: string, ink: Ink, born: number, art: HTMLImageElement | null, y: number, life = 70): void {
    // one banner at a time: a newer one cuts the old one short
    for (const b of this.banners) if (b.born + b.life > born) b.life = Math.max(0, born - b.born);
    this.banners.push({ title, sub, ink, born, life, art, y });
  }

  column(x: number, ink: Ink, born: number, life = 50): void {
    this.columns.push({ x, born, life, ink });
  }

  shake(amp: number, born: number, life = 14): void {
    this.shakes.push({ amp, born, life });
  }

  vignette(top: boolean, ink: Ink, born: number, life = 26): void {
    this.vignettes.push({ top, ink, born, life });
  }

  /** Move a unit's drawing for a moment: a lunge toward a target, or a hurt shake. */
  jolt(iid: string, dx: number, dy: number, born: number, life: number, kind: Jolt['kind']): void {
    const list = this.jolts.get(iid) ?? [];
    list.push({ dx, dy, born, life, kind });
    this.jolts.set(iid, list);
  }

  /** The current extra offset of a unit's drawing. */
  offset(iid: string, t: number): Pt {
    const list = this.jolts.get(iid);
    if (!list) return [0, 0];
    let x = 0, y = 0;
    for (const j of list) {
      const age = t - j.born;
      if (age < 0 || age > j.life) continue;
      const k = age / j.life;
      if (j.kind === 'lunge') {
        // fast out, slower back
        const s = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        x += j.dx * s; y += j.dy * s;
      } else {
        const s = (1 - k) * Math.sin(age * 1.9);
        x += j.dx * s; y += j.dy * s * 0.5;
      }
    }
    if (list.every((j) => t - j.born > j.life)) this.jolts.delete(iid);
    return [x, y];
  }

  /** Screen shake offset now. */
  screen(t: number): Pt {
    let amp = 0;
    for (const s of this.shakes) {
      const age = t - s.born;
      if (age >= 0 && age < s.life) amp = Math.max(amp, s.amp * (1 - age / s.life));
    }
    if (amp === 0) return [0, 0];
    return [Math.sin(t * 2.3) * amp, Math.cos(t * 1.7) * amp * 0.7];
  }

  /** Whether anything is still playing (or waiting to play). */
  busy(t: number): boolean {
    return this.parts.length + this.rings.length + this.bolts.length + this.floats.length + this.cards.length + this.shards.length > 0 || this.banners.some((b) => t < b.born + b.life);
  }

  // ---------- drawing ----------

  /** Effects that sit under the units: banners and light columns. */
  drawUnder(g: Gfx, t: number, w: number): void {
    const ctx = g.ctx;
    this.columns = this.columns.filter((c) => t - c.born < c.life);
    for (const c of this.columns) {
      const age = t - c.born;
      if (age < 0) continue;
      const k = age / c.life;
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      const cw = 30 + 30 * Math.sin(k * Math.PI);
      const gr = ctx.createLinearGradient(c.x - cw, 0, c.x + cw, 0);
      gr.addColorStop(0, rgba(c.ink, 0));
      gr.addColorStop(0.5, rgba(c.ink, 0.55 * a));
      gr.addColorStop(1, rgba(c.ink, 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gr;
      ctx.fillRect(c.x - cw, 0, cw * 2, 448);
      ctx.restore();
    }
    void w;
  }

  /** Everything else, over the board. */
  draw(g: Gfx, t: number, w: number, h: number): void {
    const ctx = g.ctx;
    // vignettes: the edge of the side whose Crystal was hit glows
    this.vignettes = this.vignettes.filter((v) => t - v.born < v.life);
    for (const v of this.vignettes) {
      const age = t - v.born;
      if (age < 0) continue;
      const a = 0.55 * (1 - age / v.life);
      const y0 = v.top ? 0 : h - 90;
      const gr = ctx.createLinearGradient(0, v.top ? 0 : h, 0, v.top ? 90 : h - 90);
      gr.addColorStop(0, rgba(v.ink, a));
      gr.addColorStop(1, rgba(v.ink, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, y0, w, 90);
    }
    // tile flashes
    this.flashes = this.flashes.filter((f) => t - f.born < f.life);
    for (const f of this.flashes) {
      const age = t - f.born;
      if (age < 0) continue;
      const a = 1 - age / f.life;
      ctx.save();
      ctx.globalAlpha = a;
      frame(g, f.x, f.y, f.w, f.h, f.ink, 4, true);
      ctx.globalCompositeOperation = 'lighter';
      fillRound(g, f.x, f.y, f.w, f.h, f.ink, 0.35 * a, 4);
      ctx.restore();
    }
    // rings
    this.rings = this.rings.filter((r) => t - r.born < r.life);
    for (const r of this.rings) {
      const age = t - r.born;
      if (age < 0) continue;
      const k = age / r.life;
      const e = 1 - (1 - k) ** 3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(r.ink, 1 - k);
      ctx.shadowColor = rgba(r.ink, 0.9);
      ctx.shadowBlur = 6;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // bolts: a bright head with a fading trail; the hit callback fires on arrival
    for (const b of this.bolts) {
      const age = t - b.born;
      if (age < 0) continue;
      if (age >= b.life) {
        if (!b.done) { b.done = true; b.hit?.(); }
        continue;
      }
      const k = age / b.life;
      const e = k * k * (3 - 2 * k);
      const mx = (b.from[0] + b.to[0]) / 2, my = (b.from[1] + b.to[1]) / 2 - 30;
      const at = (q: number): Pt => [
        (1 - q) * (1 - q) * b.from[0] + 2 * (1 - q) * q * mx + q * q * b.to[0],
        (1 - q) * (1 - q) * b.from[1] + 2 * (1 - q) * q * my + q * q * b.to[1],
      ];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const q0 = Math.max(0, e - 0.06 * (i + 1)), q1 = Math.max(0, e - 0.06 * i);
        const p0 = at(q0), p1 = at(q1);
        ctx.strokeStyle = rgba(b.ink, 0.9 - i * 0.14);
        ctx.lineWidth = 4 - i * 0.55;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      const hd = at(e);
      ctx.shadowColor = rgba(b.ink, 1);
      ctx.shadowBlur = b.style === 'plain' ? 10 : 16;
      ctx.fillStyle = rgba('steamWhite', 0.95);
      ctx.beginPath();
      ctx.arc(hd[0], hd[1], b.style === 'plain' ? 3 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (b.style === 'brass') {
        // a turning cog at the head
        ctx.translate(hd[0], hd[1]);
        ctx.rotate(age * 0.5);
        ctx.strokeStyle = rgba('brassGlint', 0.95);
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(8, 0); ctx.stroke(); }
      }
      ctx.restore();
      if (b.style === 'fire') {
        this.burst(hd[0], hd[1], ['emberBright', 'emberGlow'], 2, t, { speed: 0.8, life: 16, size: 1.6, grav: -0.03 });
        if (age % 2 === 0) this.burst(hd[0], hd[1], ['steam'], 1, t, { speed: 0.3, life: 26, size: 3, grav: -0.02, shape: 'dot' });
      } else if (b.style === 'crystal') this.burst(hd[0], hd[1], ['crystalWhite', 'crystalBright'], 2, t, { speed: 0.6, life: 20, size: 1.3, grav: 0, shape: 'dot' });
      else if (b.style === 'frost') this.burst(hd[0], hd[1], ['crystalWhite'], 2, t, { speed: 1, life: 18, size: 1.8, grav: 0.04, shape: 'shard' });
      else if (b.style === 'shadow') this.burst(hd[0], hd[1], ['duskMid', 'emberDeep'], 2, t, { speed: 0.5, life: 22, size: 2.4, grav: 0, shape: 'dot' });
      else if (b.style === 'brass') { if (age % 2 === 0) this.burst(hd[0], hd[1], ['brassGlint'], 1, t, { speed: 1.2, life: 14, size: 1.2 }); }
      else if (age % 2 === 0) this.burst(hd[0], hd[1], b.ink, 1, t, { speed: 0.5, life: 14, size: 1.2, grav: 0 });
    }
    this.bolts = this.bolts.filter((b) => !b.done);
    // slashes
    this.slashes = this.slashes.filter((s) => t - s.born < s.life);
    for (const s of this.slashes) {
      const age = t - s.born;
      if (age < 0) continue;
      const k = age / s.life;
      const grow = Math.min(1, k * 3);
      const dx = Math.cos(s.angle) * s.len / 2, dy = Math.sin(s.angle) * s.len / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(s.ink, 1 - k);
      ctx.shadowColor = rgba(s.ink, 1);
      ctx.shadowBlur = 8;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3 * (1 - k);
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x - dx + dx * 2 * grow, s.y - dy + dy * 2 * grow);
      ctx.stroke();
      ctx.restore();
    }
    // runes under deployed units
    this.runes = this.runes.filter((r) => t - r.born < r.life);
    for (const r of this.runes) {
      const age = t - r.born;
      if (age < 0) continue;
      const k = age / r.life;
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(r.x, r.y);
      ctx.scale(1, 0.42);
      ctx.strokeStyle = rgba(r.ink, 0.85 * a);
      ctx.shadowColor = rgba(r.ink, 1);
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.rotate(age * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(-age * 0.12);
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(0, 0, r.r * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = rgba(r.ink, 0.9 * a);
        ctx.beginPath(); ctx.moveTo(r.r * 0.86, 0); ctx.lineTo(r.r * 0.86 + 4, -3); ctx.lineTo(r.r * 0.86 + 8, 0); ctx.lineTo(r.r * 0.86 + 4, 3); ctx.fill();
      }
      ctx.restore();
    }
    // flying cards
    for (const c of this.cards) {
      const age = t - c.born;
      if (age < 0) continue;
      if (age >= c.life) { if (!c.done) { c.done = true; c.land?.(); } continue; }
      const k = age / c.life;
      const e = 1 - (1 - k) ** 3;
      const lerp = (a: number, b: number) => a + (b - a) * e;
      const cx = lerp(c.from[0] + c.from[2] / 2, c.to[0] + c.to[2] / 2);
      const cy = lerp(c.from[1] + c.from[3] / 2, c.to[1] + c.to[3] / 2) - Math.sin(k * Math.PI) * c.arc;
      const cw = lerp(c.from[2], c.to[2]), ch = lerp(c.from[3], c.to[3]);
      const fade = c.burn || c.dissolve ? Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(k * Math.PI) * c.spin);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
      const bx = -cw / 2, by = -ch / 2;
      if (c.back) {
        fillRound(g, bx, by, cw, ch, c.back === 'foe' ? 'emberNight' : 'ironNight', 1, 3);
        ctx.shadowBlur = 0;
        frame(g, bx, by, cw, ch, c.back === 'foe' ? 'emberDeep' : 'brassDark', 3);
        frame(g, bx + 2, by + 2, cw - 4, ch - 4, c.back === 'foe' ? 'brassShadow' : 'crystalDeep', 2);
      } else {
        fillRound(g, bx, by, cw, ch, 'ironNight', 1, 3);
        ctx.shadowBlur = 0;
        if (c.img) {
          const ah = ch * 0.6;
          drawPic(g, c.img, bx + 1, by + 1, cw - 2, ah);
        }
        frame(g, bx, by, cw, ch, c.burn ? 'emberBright' : 'brassLight', 3, c.burn || c.dissolve);
      }
      if (c.burn && k > 0.35) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('emberBright', 0.5 * (k - 0.35));
        ctx.fillRect(bx, by + ch * (1 - (k - 0.35) / 0.65), cw, ch * ((k - 0.35) / 0.65));
      }
      ctx.restore();
      if (c.burn && k > 0.35 && age % 2 === 0) this.burst(cx, cy + ch / 2 - ch * ((k - 0.35) / 0.65), ['emberBright', 'emberGlow', 'steam'], 4, t, { speed: 1.2, life: 26, size: 1.8, grav: -0.05, spread: cw });
      if (c.dissolve && k > 0.45 && age % 2 === 0) this.burst(cx, cy, ['crystalWhite', 'brassGlint'], 5, t, { speed: 1.6, life: 24, size: 1.4, grav: -0.02, shape: 'dot', spread: cw });
    }
    this.cards = this.cards.filter((c) => !c.done);
    // pieces of broken cards
    this.shards = this.shards.filter((p) => t - p.born < p.life);
    for (const p of this.shards) {
      const age = t - p.born;
      if (age < 0) {
        ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.w, p.h);
        continue;
      }
      p.vy += 0.16; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / p.life);
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot);
      ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, -p.w / 2, -p.h / 2, p.w, p.h);
      ctx.strokeStyle = rgba('emberGlow', 0.6 * Math.max(0, 1 - age / 20));
      ctx.lineWidth = 1;
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    // particles
    this.parts = this.parts.filter((p) => t - p.born < p.life);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const age = t - p.born;
      if (age < 0) continue;
      // integrate once per frame drawn; frames and ticks are close enough for an effect
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx; p.y += p.vy;
      const a = 1 - age / p.life;
      ctx.fillStyle = rgba(p.ink, a);
      if (p.shape === 'spark') {
        ctx.strokeStyle = rgba(p.ink, a);
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      } else if (p.shape === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(age * 0.3 + p.size);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2.2, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // floating numbers and words
    this.floats = this.floats.filter((f) => t - f.born < 50);
    for (const f of this.floats) {
      const age = t - f.born;
      if (age < 0) continue;
      const fade = Math.max(0, 1 - age / 50);
      const pop = age < 6 ? 1 + (6 - age) * 0.12 : 1;
      drawTextCentred(g, f.text, f.x, f.y - age / 2, { color: f.ink, face: 'bold', outline: 'ink', glow: f.ink, scale: f.scale * pop, alpha: Math.min(1, fade * 1.6) });
    }
    // the whole screen lit for a moment
    this.flashesFull = this.flashesFull.filter((f) => t - f.born < f.life);
    for (const f of this.flashesFull) {
      const age = t - f.born;
      if (age < 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(f.ink, f.a * (1 - age / f.life));
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // banners: a card or a moment named across the middle of the board
    this.banners = this.banners.filter((b) => t - b.born < b.life);
    for (const b of this.banners) {
      const age = t - b.born;
      if (age < 0) continue;
      const inK = Math.min(1, age / 8);
      const outK = Math.min(1, (b.life - age) / 10);
      const a = Math.min(inK, outK);
      const bh = b.art ? 84 : 34;
      const y = b.y - bh / 2;
      ctx.save();
      ctx.globalAlpha = a;
      const gr = ctx.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, rgba('ink', 0));
      gr.addColorStop(0.25, rgba('ink', 0.82));
      gr.addColorStop(0.75, rgba('ink', 0.82));
      gr.addColorStop(1, rgba('ink', 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, y, w, bh);
      const lg = ctx.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, rgba(b.ink, 0));
      lg.addColorStop(0.5, rgba(b.ink, 0.9));
      lg.addColorStop(1, rgba(b.ink, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(0, y, w, 1.5);
      ctx.fillRect(0, y + bh - 1.5, w, 1.5);
      const slide = (1 - inK) * 30;
      if (b.art) {
        const aw = 96, ah = 72, ax = w / 2 - aw - 14 - slide, ay = y + 6;
        ctx.shadowColor = rgba(b.ink, 0.9);
        ctx.shadowBlur = 12;
        fillRound(g, ax - 2, ay - 2, aw + 4, ah + 4, 'ink', 1, 4);
        ctx.shadowBlur = 0;
        drawPic(g, b.art, ax, ay, aw, ah);
        frame(g, ax - 2, ay - 2, aw + 4, ah + 4, b.ink, 4, true);
        drawTextCentred(g, b.sub, w / 2 + 80 + slide, y + 24, { color: 'steam', scale: 1 });
        drawTextCentred(g, b.title, w / 2 + 80 + slide, y + 38, { color: b.ink, face: 'display', scale: 1.6, glow: b.ink, outline: 'ink' });
      } else {
        drawTextCentred(g, b.title, w / 2 + slide, y + 8, { color: b.ink, face: 'display', scale: 1.7, glow: b.ink, outline: 'ink' });
      }
      ctx.restore();
    }
  }
}
