// Cards shown as cards (PLAN D29): a scrolling grid of small card faces for any list of cards the player looks
// through or picks from (a deck, a Scrap, a card to remove), and one large card for confirming a pick. Every screen
// that asks the player to choose a card shows the cards themselves and confirms the choice before it is made.
import { drawPic } from './detail';
import { def, type Face } from './engine/query';
import { drawText, drawTextCentred, textWidth, wrapPx } from './font';
import type { Gfx } from './gfx';
import { PALETTE, rgba, type Ink } from './palette';
import { button, clipRound, fillRound, frame, panel, rule } from './ui';
import { cardArt } from './match/art';

export interface GridItem {
  id: string;
  /** Copies of it, shown as ×n when more than one. */
  count?: number;
  /** A note under the card (its place in a Scrap, say). */
  tag?: string;
}

export interface GridHot { x: number; y: number; w: number; h: number; id: string }

export const MINI = { w: 72, h: 100 };

/** A round number badge, the same look as the battle screen's. */
export function chip(g: Gfx, cx: number, cy: number, value: number | string, kind: 'cost' | 'power' | 'health', r = 6.5): void {
  const ctx = g.ctx;
  const ramp: Record<typeof kind, [Ink, Ink]> = { cost: ['crystal', 'crystalDeep'], power: ['brassLight', 'brassDark'], health: ['iron', 'ironNight'] };
  const [a, b] = ramp[kind];
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const gr = ctx.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, r);
  gr.addColorStop(0, PALETTE[a]);
  gr.addColorStop(1, PALETTE[b]);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE[kind === 'power' ? 'brassGlint' : kind === 'cost' ? 'crystalWhite' : 'steam'];
  ctx.stroke();
  ctx.restore();
  drawTextCentred(g, String(value), cx, cy - 3.6 * (r / 6.5), { color: kind === 'power' ? 'ink' : 'steamWhite', face: 'bold', scale: 1.05 * (r / 6.5), shadow: kind === 'power' ? undefined : 'ink' });
}

/** A small card face: art, cost, name and stats. */
export function miniCard(g: Gfx, id: string, f: Face, x: number, y: number, o: { hot?: boolean; picked?: boolean; count?: number; tag?: string; w?: number; h?: number } = {}): void {
  const w = o.w ?? MINI.w, h = o.h ?? MINI.h;
  const d = def(id);
  const ctx = g.ctx;
  const ground: Ink = d.type === 'glyph' ? 'duskHigh' : 'ironNight';
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = o.hot ? 10 : 5;
  ctx.shadowOffsetY = 2;
  fillRound(g, x, y, w, h, ground, 0.97, 4);
  ctx.restore();
  const artH = Math.round(h * 0.54);
  const art = cardArt(id, f.ascended);
  const un = clipRound(g, x + 1, y + 1, w - 2, h - 2, 3.5);
  if (art) {
    const k = Math.max((w - 2) / 64, artH / 48);
    const sw = (w - 2) / k, sh = artH / k;
    drawPic(g, art, x + 1, y + 1, w - 2, artH, { x: (64 - sw) / 2, y: (48 - sh) / 2, w: sw, h: sh });
  } else g.rect(x + 1, y + 1, w - 2, artH, 'ironDark');
  const lg = ctx.createLinearGradient(0, y + artH - 12, 0, y + artH + 2);
  lg.addColorStop(0, rgba(ground, 0));
  lg.addColorStop(1, rgba(ground, 1));
  ctx.fillStyle = lg;
  ctx.fillRect(x + 1, y + artH - 12, w - 2, 14);
  un();
  chip(g, x + 8.5, y + 8.5, d.cost, 'cost');
  if (o.count && o.count > 1) {
    const s = `×${o.count}`;
    const tw = textWidth(s, 0.95, 'bold') + 8;
    fillRound(g, x + w - tw - 3, y + 3, tw, 11, 'ink', 0.85, 3);
    drawText(g, s, x + w - tw + 1, y + 4.5, { color: 'brassGlint', face: 'bold', scale: 0.95 });
  } else if (d.type === 'hero') {
    const tw = textWidth('hero', 0.8) + 6;
    fillRound(g, x + w - tw - 3, y + 3, tw, 9, 'ink', 0.75, 3);
    drawText(g, 'hero', x + w - tw, y + 4.5, { color: 'brassGlint', scale: 0.8 });
  }
  const ns = f.name.split(' ').some((wd) => textWidth(wd, 0.9, 'bold') > w - 7) ? 0.78 : 0.9;
  wrapPx(f.name, w - 7, ns, 'bold').slice(0, 2).forEach((l, j) => drawText(g, l, x + 4, y + artH + 3 + j * 9, { color: 'steamWhite', face: 'bold', scale: ns, shadow: 'ink' }));
  if (d.type !== 'glyph') {
    chip(g, x + 9, y + h - 9, f.power, 'power');
    chip(g, x + w - 9, y + h - 9, f.health, 'health');
  } else drawText(g, d.speed ? `tactic, ${d.speed}` : 'tactic', x + 4, y + h - 12, { color: 'ironLight', scale: 0.8 });
  if (o.tag) drawTextCentred(g, o.tag, x + w / 2, y + h + 2, { color: 'ironLight', scale: 0.8 });
  frame(g, x, y, w, h, o.picked ? 'emberGlow' : o.hot ? 'brassGlint' : d.type === 'hero' ? 'brassLight' : 'ink', 4, o.hot || o.picked);
}

/**
 * A scrolling grid of cards inside x, y, w, h. Scroll counts rows from the top; the result says how far it can go.
 * Each card pushes a hot with id `${prefix}${item.id}` (the same id for every copy: copies are grouped).
 */
export function cardGrid(
  g: Gfx, items: GridItem[], faceOf: (id: string) => Face, x: number, y: number, w: number, h: number,
  scroll: number, hover: string | null, prefix: string, hots: GridHot[],
): { scroll: number; maxScroll: number } {
  const gap = 8;
  const rowH = MINI.h + (items.some((i) => i.tag) ? 14 : gap);
  const cols = Math.max(1, Math.floor((w + gap) / (MINI.w + gap)));
  const rows = Math.ceil(items.length / cols);
  const visible = Math.max(1, Math.floor((h + gap) / rowH));
  const maxScroll = Math.max(0, rows - visible);
  const sc = Math.max(0, Math.min(maxScroll, scroll));
  const left = x + (w - (cols * (MINI.w + gap) - gap)) / 2;
  for (let i = sc * cols; i < Math.min(items.length, (sc + visible) * cols); i++) {
    const it = items[i];
    const r = Math.floor(i / cols) - sc, c = i % cols;
    const cx = left + c * (MINI.w + gap), cy = y + r * rowH;
    const id = `${prefix}${it.id}`;
    miniCard(g, it.id, faceOf(it.id), cx, cy, { hot: hover === id, count: it.count, tag: it.tag });
    hots.push({ x: cx, y: cy, w: MINI.w, h: MINI.h, id });
  }
  if (items.length === 0) drawTextCentred(g, 'No cards here.', x + w / 2, y + 30, { color: 'iron' });
  return { scroll: sc, maxScroll };
}

/** Copies grouped and sorted by cost, then name: how a deck is listed everywhere. */
export function grouped(ids: string[], faceOf: (id: string) => Face): GridItem[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => def(a).cost - def(b).cost || faceOf(a).name.localeCompare(faceOf(b).name))
    .map((id) => ({ id, count: counts.get(id) }));
}

/** One card, large, with its full text: for a confirmation, or a closer look. Returns its height. */
export function bigCard(g: Gfx, id: string, f: Face, x: number, y: number, w = 170, glow: Ink = 'brassGlint'): number {
  const d = def(id);
  const artW = w - 10, artH = Math.round(artW * 0.75), tw = w - 16;
  const nameLines = wrapPx(f.name, tw - 20, 1.2, 'bold');
  const text = wrapPx(f.text, tw, 0.95);
  const hgt = 5 + artH + 6 + nameLines.length * 12 + 14 + text.length * 10 + (d.type !== 'glyph' ? 24 : 8);
  const ctx = g.ctx;
  ctx.save();
  ctx.shadowColor = rgba(glow, 0.55);
  ctx.shadowBlur = 16;
  fillRound(g, x, y, w, hgt, d.type === 'glyph' ? 'duskHigh' : 'ironNight', 0.98, 6);
  ctx.restore();
  const art = cardArt(id, f.ascended, true);
  const un = clipRound(g, x + 5, y + 5, artW, artH, 4);
  if (art) drawPic(g, art, x + 5, y + 5, artW, artH);
  else g.rect(x + 5, y + 5, artW, artH, 'ironDark');
  un();
  frame(g, x + 5, y + 5, artW, artH, 'brassDark', 4);
  chip(g, x + 15, y + 15, d.cost, 'cost', 8);
  let ty = y + 5 + artH + 6;
  nameLines.forEach((l, i) => drawText(g, l, x + 8, ty + i * 12, { color: 'brassGlint', face: 'bold', scale: 1.2, shadow: 'ink' }));
  ty += nameLines.length * 12;
  drawText(g, d.type === 'glyph' ? `Tactic, ${d.speed ?? ''}` : d.type === 'hero' ? 'Hero' : 'Unit', x + 8, ty, { color: 'steam', scale: 0.9 });
  ty += 11;
  rule(g, x + 6, ty, w - 12);
  ty += 4;
  for (const l of text) { drawText(g, l, x + 8, ty, { color: 'steamWhite', scale: 0.95 }); ty += 10; }
  if (d.type !== 'glyph') {
    chip(g, x + 14, y + hgt - 13, f.power, 'power');
    drawText(g, 'power', x + 24, y + hgt - 17, { color: 'ironLight', scale: 0.85 });
    chip(g, x + w - 14, y + hgt - 13, f.health, 'health');
    drawText(g, 'health', x + w - 24 - textWidth('health', 0.85), y + hgt - 17, { color: 'ironLight', scale: 0.85 });
  }
  frame(g, x, y, w, hgt, glow, 6, true);
  return hgt;
}

/**
 * A confirmation: the card large on the left, the question and two buttons on the right, over a dimmed screen.
 * Pushes hots `confirm-yes` and `confirm-no`.
 */
export function confirmCard(
  g: Gfx, sw: number, sh: number, id: string, f: Face, question: string, detail: string, yes: string, danger: boolean,
  hover: string | null, hots: GridHot[],
): void {
  g.wash(0, 0, sw, sh, 'ink', 0.6);
  hots.push({ x: 0, y: 0, w: sw, h: sh, id: 'confirm-bg' });
  const w = 380, cw = 170;
  const ch = Math.min(sh - 40, 300);
  const x = (sw - w) / 2, y = Math.max(10, (sh - ch) / 2 - 10);
  panel(g, x, y, w, ch + 20, { glow: danger ? 'ember' : 'brassGlint' });
  bigCard(g, id, f, x + 10, y + 10, cw, danger ? 'emberGlow' : 'brassGlint');
  const tx = x + cw + 22, tw = w - cw - 32;
  let ty = y + 26;
  for (const l of wrapPx(question, tw, 1.2, 'bold')) { drawText(g, l, tx, ty, { color: danger ? 'emberGlow' : 'brassGlint', face: 'bold', scale: 1.2 }); ty += 13; }
  ty += 6;
  for (const l of wrapPx(detail, tw)) { drawText(g, l, tx, ty, { color: 'steam' }); ty += 10.5; }
  const by = y + ch - 30;
  const yw = Math.max(tw, textWidth(yes, 1, 'display') + 16);
  button(g, yes, tx, by - 24, { w: yw, h: 19, state: danger ? 'danger' : hover === 'confirm-yes' ? 'hot' : 'on' });
  hots.push({ x: tx, y: by - 24, w: yw, h: 19, id: 'confirm-yes' });
  button(g, 'BACK', tx, by + 2, { w: yw, h: 19, state: hover === 'confirm-no' ? 'hot' : 'on' });
  hots.push({ x: tx, y: by + 2, w: yw, h: 19, id: 'confirm-no' });
}

/** Scroll buttons for a grid: an up and a down arrow at the right edge, live only when there is more that way. */
export function scrollButtons(g: Gfx, x: number, y: number, h: number, scroll: number, maxScroll: number, hover: string | null, hots: GridHot[]): void {
  if (maxScroll === 0) return;
  const draw = (label: string, by: number, id: string, on: boolean) => {
    button(g, label, x, by, { w: 44, h: 18, state: !on ? 'off' : hover === id ? 'hot' : 'on' });
    if (on) hots.push({ x, y: by, w: 44, h: 18, id });
  };
  draw('UP', y, 'grid-up', scroll > 0);
  draw('DOWN', y + h - 18, 'grid-down', scroll < maxScroll);
  drawTextCentred(g, `row ${scroll + 1}`, x + 22, y + h / 2 - 10, { color: 'ironLight', scale: 0.85 });
  drawTextCentred(g, `of ${maxScroll + 1}`, x + 22, y + h / 2, { color: 'ironLight', scale: 0.85 });
}
