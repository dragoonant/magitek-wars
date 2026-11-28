// Battle setup (hi-res, 512 x 448): your deck, the foe's deck and the AI level. Every premade deck is here, plus
// one single-faction deck per faction, so every deck can be play-tested (owner, 2026-11-27).
import { drawPic } from '../detail';
import type { FactionId } from '../engine/types';
import { checkDeck } from '../engine/validate';
import { def } from '../engine/query';
import { autoDeck, premadeDecks, FACTION_INFO } from '../data/decks';
import { FACTIONS } from '../data/factions';
import { DIFFICULTIES, type Difficulty } from '../ai/ai';
import { drawText, drawTextCentred, fitText, wrapPx } from '../font';
import type { Gfx } from '../gfx';
import { backdrop, button, highlight, panel } from '../ui';
import { emblem } from './art';
import { savedLegalDecks } from '../deckbuilder/edit';
import { HH, HW } from './board';

export interface DeckOption { name: string; about: string; cards: string[]; factions: string[] }

export function deckOptions(): DeckOption[] {
  const facs = (cards: string[]) => [...new Set(cards.map((c) => def(c).faction))].map((f) => FACTIONS.find((x) => x.engine === f)!.key);
  const out: DeckOption[] = premadeDecks().map((d) => ({ name: d.name, about: d.about ?? `${[...new Set(d.cards.map((c) => FACTION_INFO[def(c).faction].name))].join(' and ')}, built along the Charge curve.`, cards: d.cards, factions: facs(d.cards) }));
  for (const f of FACTIONS) {
    const cards = autoDeck(f.engine as FactionId, f.engine as FactionId);
    if (!checkDeck(cards).ok) throw new Error(`the single-faction deck for ${f.name} is not legal`);
    out.push({ name: `${FACTION_INFO[f.engine].name} (single faction)`, about: FACTION_INFO[f.engine].blurb, cards, factions: [f.key] });
  }
  // decks the player built (only legal ones; the deck builder marks the others ILLEGAL)
  for (const d of savedLegalDecks()) out.push({ name: `${d.name} (yours)`, about: 'A deck you built in the deck builder.', cards: d.cards, factions: facs(d.cards) });
  return out;
}

const ROW = 10;
const LIST_Y = 40;

export class BattleSetup {
  readonly decks = deckOptions();
  mine = 0;
  /** -1 = random */
  foe = -1;
  level: Difficulty = 'normal';
  private hots: { x: number; y: number; w: number; h: number; id: string }[] = [];
  /** Set when the player starts or leaves; main.ts acts on it. */
  result: { kind: 'start'; mine: DeckOption; foe: DeckOption; level: Difficulty } | { kind: 'back' } | null = null;

  key(code: string): void {
    const n = this.decks.length;
    if (code === 'ArrowDown') this.mine = (this.mine + 1) % n;
    else if (code === 'ArrowUp') this.mine = (this.mine + n - 1) % n;
    else if (code === 'ArrowRight') this.foe = this.foe + 1 >= n ? -1 : this.foe + 1;
    else if (code === 'ArrowLeft') this.foe = this.foe - 1 < -1 ? n - 1 : this.foe - 1;
    else if (code === 'Enter' || code === 'Space') this.start();
    else if (code === 'Escape' || code === 'KeyX') this.result = { kind: 'back' };
  }

  private start(): void {
    const foe = this.foe >= 0 ? this.decks[this.foe] : this.decks[Math.floor(Math.random() * this.decks.length)];
    this.result = { kind: 'start', mine: this.decks[this.mine], foe, level: this.level };
  }

  pointerDown(x: number, y: number): void {
    const h = this.hots.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
    if (!h) return;
    const [k, v] = h.id.split(':');
    if (k === 'mine') this.mine = Number(v);
    else if (k === 'foe') this.foe = Number(v);
    else if (k === 'level') this.level = v as Difficulty;
    else if (k === 'start') this.start();
    else if (k === 'back') this.result = { kind: 'back' };
  }

  draw(g: Gfx): void {
    this.hots = [];
    backdrop(g, HW, HH, 'kitebarrow');
    drawTextCentred(g, 'CHOOSE YOUR BATTLE', HW / 2, 7, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    this.list(g, 'YOUR DECK', 6, this.mine, 'mine', false);
    this.list(g, 'FOE DECK', 260, this.foe, 'foe', true);
    const d = this.decks[this.mine];
    const y = 372;
    panel(g, 4, y, 300, 72);
    drawText(g, d.name, 13, y + 9, { color: 'brassGlint', face: 'bold' });
    wrapPx(d.about, 282).slice(0, 4).forEach((l, i) => drawText(g, l, 13, y + 22 + i * 10.5, { color: 'steamWhite' }));
    let bx = 312;
    drawText(g, 'FOE LEVEL', bx, y + 1, { color: 'brassLight', face: 'display', shadow: 'ink' });
    for (const lv of DIFFICULTIES) {
      const on = lv.id === this.level;
      const w = button(g, lv.name.toUpperCase(), bx, y + 12, { h: 15, state: on ? 'picked' : 'off' });
      this.hots.push({ x: bx, y: y + 12, w, h: 15, id: `level:${lv.id}` });
      bx += w + 4;
    }
    const blurb = DIFFICULTIES.find((l) => l.id === this.level)!.blurb;
    wrapPx(blurb, 196).slice(0, 2).forEach((l, i) => drawText(g, l, 312, y + 31 + i * 10, { color: 'steam', shadow: 'ink' }));
    this.button(g, 'START BATTLE', 400, y + 52, 'start');
    this.button(g, 'BACK', 312, y + 52, 'back');
  }

  private button(g: Gfx, label: string, x: number, y: number, id: string): void {
    const w = button(g, label, x, y, { h: 17 });
    this.hots.push({ x, y, w, h: 17, id });
  }

  private list(g: Gfx, head: string, x: number, sel: number, id: string, random: boolean): void {
    panel(g, x - 2, 24, 250, 342, { tone: 'dark' });
    drawText(g, head, x + 7, 30, { color: 'brassLight', face: 'display' });
    const rows: { i: number; label: string; facs: string[] }[] = [];
    if (random) rows.push({ i: -1, label: 'Random deck', facs: [] });
    this.decks.forEach((d, i) => rows.push({ i, label: d.name, facs: d.factions }));
    rows.forEach((r, k) => {
      const y = LIST_Y + 2 + k * ROW;
      const on = r.i === sel;
      if (on) highlight(g, x + 2, y - 1.5, 242, ROW - 0.5);
      r.facs.forEach((f, j) => {
        const em = emblem(f);
        if (em) drawPic(g, em, x + 5 + j * 11, y - 1, 9, 9);
      });
      drawText(g, fitText(r.label, 212), x + 29, y + 0.5, { color: on ? 'brassGlint' : 'steamWhite', face: on ? 'bold' : 'body', scale: 0.95 });
      this.hots.push({ x, y: y - 1, w: 246, h: ROW - 1, id: `${id}:${r.i}` });
    });
  }
}
