// Deck builder screen (hi-res, 512 x 448). Left: the card pool with faction, cost and type filters. Right: the deck,
// grouped by cost, with every R-G1 limit and every rule checkDeck reports. Saved decks go through ./model (DECKS_KEY).
// Editing logic is in ./edit (tested); this file only draws and routes input. No native tooltips: hovering a card
// shows a detail window drawn on the canvas.
import { drawPic } from '../detail';
import type { CardType, DeckList, FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, face, hasCard } from '../engine/query';
import { checkDeck } from '../engine/validate';
import { FACTIONS } from '../data/factions';
import { CARD_ART } from '../data/cardart';
import { canDraw, drawText, drawTextCentred, drawTextRight, fitText, textWidth, wrapPx } from '../font';
import type { Gfx } from '../gfx';
import { PALETTE, type Ink } from '../palette';
import { backdrop, button, clipRound, fillRound, frame, highlight, panel, rule } from '../ui';
import { cardArt, emblem, isMissing } from '../match/art';
import { HH, HW } from '../match/board';
import { KEYWORD_HELP } from '../match/text';
import { countOf, loadDecks, saveDecks, type Storage as DeckStore } from './model';
import {
  COST_BUCKETS, NAME_MAX, TYPE_LABEL, addOne, browserStore, bucketOf, canAdd, costLabel, deckStatus, editName, fillDeck,
  fillFactions, finalName, groupDeck, nameIdeas, poolCards, removeDeck, removeOne, upsertDeck, type PoolFilter,
} from './edit';

interface Hot { x: number; y: number; w: number; h: number; id: string }

type Mode =
  | { kind: 'edit' }
  | { kind: 'name'; name: string; ideas: string[]; idea: number }
  | { kind: 'load'; scroll: number }
  | { kind: 'confirm'; lines: string[]; yes: string; no: string; onYes: () => void };

/** As typed, with any character that cannot be drawn shown as '?' (visible, never a crash or a silent drop). */
function say(s: string): string {
  return [...s].map((ch) => (canDraw(ch) ? ch : '?')).join('');
}

/** 'COST 3' -> 'Cost 3' for labels that come from ./edit in capitals. */
const sentence = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
/** 'CINDRAL DOMINION' -> 'Cindral Dominion' for faction names stored in capitals. */
const titled = (s: string): string => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// layout
const LEFT_X = 4;
const TAB_Y = 24;
const COST_Y = 46;
const TYPE_Y = 60;
const GRID_Y = 76;
const COLS = 4;
const ROWS = 5;
const CELL_W = 72;
const CELL_H = 62;
const PAGE_Y = GRID_Y + ROWS * CELL_H + 2;
const MSG_Y = 404;
const BTN_Y = 428;
const RIGHT_X = 304;
const RIGHT_W = HW - RIGHT_X - 4;
const RIGHT_BOTTOM = 398;
const LIST_Y = 76;
const ROW_H = 9;

const TYPES: CardType[] = ['unit', 'hero', 'glyph'];
const HINT = 'Click a card to add a copy. Right-click, or click a deck row, takes one out.';

export class DeckBuilder {
  /** The deck being built, in deck order. */
  cards: string[] = [];
  /** Name of the saved deck this was loaded from or last saved as, and its cards at that moment. */
  savedName: string | null = null;
  private savedCards: string[] = [];
  filter: PoolFilter = { faction: null, cost: null, type: null };
  /** First pool row shown. */
  scroll = 0;
  /** First deck-list line shown. */
  listScroll = 0;
  /** Page of rule lines shown when they do not all fit. */
  rulePage = 0;
  /** In remove mode a click on a pool card takes a copy out instead of adding one. */
  removeMode = false;
  mode: Mode = { kind: 'edit' };
  /** The last thing that happened, or why a click was refused. */
  note = '';
  noteBad = false;
  /** Set when the player leaves; main.ts acts on it. */
  result: { kind: 'back' } | null = null;
  private hots: Hot[] = [];
  private mx = -1;
  private my = -1;
  private saved: DeckList[] = [];
  private loadProblem: string | null = null;

  constructor(private readonly store: DeckStore = browserStore()) {
    this.reload();
  }

  private reload(): void {
    const r = loadDecks(this.store);
    this.saved = r.decks;
    this.loadProblem = r.problem;
  }

  get dirty(): boolean {
    return [...this.cards].sort().join(',') !== [...this.savedCards].sort().join(',');
  }

  private tell(text: string, bad = false): void {
    this.note = text;
    this.noteBad = bad;
  }

  /** Read-only snapshot for end-to-end checks. */
  debug(): { mode: string; cards: number; note: string; hots: string[] } {
    return { mode: this.mode.kind, cards: this.cards.length, note: this.note, hots: this.hots.map((h) => h.id) };
  }

  // ---------- actions ----------

  private add(id: string): void {
    const r = addOne(this.cards, id);
    if (r.problem) { this.tell(`${def(id).name}: ${r.problem}.`, true); return; }
    this.cards = r.cards;
    this.tell(`Added ${def(id).name} (${countOf(this.cards, id)}/${LIMITS.copies}).`);
  }

  private remove(id: string): void {
    const r = removeOne(this.cards, id);
    if (r.problem) { this.tell(`${r.problem}.`, true); return; }
    this.cards = r.cards;
    const nm = hasCard(id) ? def(id).name : id;
    this.tell(`Took out ${nm} (${countOf(this.cards, id)} left).`);
  }

  private guard(what: string, then: () => void): void {
    if (!this.dirty) { then(); return; }
    this.mode = {
      kind: 'confirm', lines: ['This deck has unsaved changes.', `${sentence(what)} and lose them?`], yes: what, no: 'KEEP EDITING',
      onYes: () => { this.mode = { kind: 'edit' }; then(); },
    };
  }

  private newDeck(): void {
    this.guard('START A NEW DECK', () => {
      this.cards = [];
      this.savedName = null;
      this.savedCards = [];
      this.listScroll = 0;
      this.rulePage = 0;
      this.tell('New deck. Pick cards from the pool, or a faction tab and FILL.');
    });
  }

  private openSave(): void {
    this.reload();
    const ideas = nameIdeas(this.cards, this.saved.map((d) => d.name));
    this.mode = { kind: 'name', name: this.savedName && /^[A-Z0-9 ]*$/.test(this.savedName) ? this.savedName.slice(0, NAME_MAX) : '', ideas, idea: -1 };
  }

  private commitSave(name: string): void {
    const nm = finalName(name);
    if (!nm) { this.tell('Type a name, or press NEXT NAME for one.', true); return; }
    this.reload();
    const doSave = (): void => {
      const { decks, replaced } = upsertDeck(this.saved, { name: nm, cards: this.cards });
      const err = saveDecks(this.store, decks);
      this.mode = { kind: 'edit' };
      if (err) { this.tell(`Not saved: ${err}`, true); return; }
      this.saved = decks;
      this.loadProblem = null;
      this.savedName = nm;
      this.savedCards = [...this.cards];
      const st = deckStatus(this.cards);
      this.tell(`${replaced ? 'Saved over' : 'Saved'} ${nm}${st.legal ? ' (legal).' : `, marked ILLEGAL: ${st.reason}.`}`, !st.legal);
    };
    const clash = this.saved.some((d) => d.name === nm) && nm !== this.savedName;
    if (this.loadProblem) {
      this.mode = { kind: 'confirm', lines: [this.loadProblem, 'Saving writes the readable decks only.', 'The rest will be lost. Save anyway?'], yes: 'SAVE ANYWAY', no: 'CANCEL', onYes: doSave };
    } else if (clash) {
      this.mode = { kind: 'confirm', lines: [`A saved deck is already named ${nm}.`, 'Replace it with this deck?'], yes: 'REPLACE IT', no: 'CANCEL', onYes: doSave };
    } else doSave();
  }

  private openLoad(): void {
    this.reload();
    this.mode = { kind: 'load', scroll: 0 };
  }

  private loadDeck(d: DeckList): void {
    this.guard('LOAD ANOTHER DECK', () => {
      this.cards = [...d.cards];
      this.savedName = d.name;
      this.savedCards = [...d.cards];
      this.listScroll = 0;
      this.rulePage = 0;
      this.mode = { kind: 'edit' };
      const st = deckStatus(d.cards);
      this.tell(`Loaded ${d.name}${st.legal ? '.' : `, ILLEGAL: ${st.reason}.`}`, !st.legal);
    });
  }

  private deleteDeck(): void {
    const nm = this.savedName;
    if (!nm || !this.saved.some((d) => d.name === nm)) { this.tell('This deck is not saved, so there is nothing to delete. Use LOAD to open a saved deck first.', true); return; }
    this.mode = {
      kind: 'confirm', lines: [`Delete the saved deck ${nm}?`, 'This cannot be undone. The cards stay in the editor until you leave.'], yes: 'DELETE IT', no: 'KEEP IT',
      onYes: () => {
        this.reload();
        const decks = removeDeck(this.saved, nm);
        const err = this.loadProblem ?? saveDecks(this.store, decks);
        this.mode = { kind: 'edit' };
        if (err) { this.tell(`Not deleted: ${err}`, true); return; }
        this.saved = decks;
        this.savedName = null;
        this.savedCards = [];
        this.tell(`Deleted ${nm}. The cards are still here, unsaved.`);
      },
    };
  }

  private fill(): void {
    const f = fillFactions(this.cards, this.filter.faction);
    if (f.problem) { this.tell(`${f.problem}.`, true); return; }
    if (this.cards.length >= LIMITS.deck) { this.tell(`The deck already has ${this.cards.length} cards.`, true); return; }
    const r = fillDeck(this.cards, f.factions);
    this.cards = r.cards;
    const names = f.factions.map((x) => FACTIONS.find((y) => y.engine === x)!.name).join(' AND ');
    if (r.problem) this.tell(`${r.problem}.`, true);
    else this.tell(`FILL added ${r.added.length} cards from ${names}.`);
  }

  private back(): void {
    this.guard('LEAVE', () => { this.result = { kind: 'back' }; });
  }

  private poolRows(): number {
    return Math.ceil(poolCards(this.filter).length / COLS);
  }

  private scrollBy(d: number): void {
    this.scroll = Math.max(0, Math.min(Math.max(0, this.poolRows() - ROWS), this.scroll + d));
  }

  private setFilter(f: Partial<PoolFilter>): void {
    this.filter = { ...this.filter, ...f };
    this.scroll = 0;
  }

  // ---------- input ----------

  key(code: string): void {
    const m = this.mode;
    if (m.kind === 'name') {
      if (code === 'Enter') this.commitSave(m.name);
      else if (code === 'Escape') this.mode = { kind: 'edit' };
      else if (code === 'Tab') this.nextIdea(m);
      else {
        const n = editName(m.name, code);
        if (n !== null) m.name = n;
      }
      return;
    }
    if (m.kind === 'confirm') {
      if (code === 'Enter') m.onYes();
      else if (code === 'Escape' || code === 'KeyX') this.mode = { kind: 'edit' };
      return;
    }
    if (m.kind === 'load') {
      if (code === 'Escape' || code === 'KeyX') this.mode = { kind: 'edit' };
      else if (code === 'ArrowDown' || code === 'PageDown') m.scroll = Math.min(Math.max(0, this.saved.length - 1), m.scroll + (code === 'PageDown' ? 8 : 1));
      else if (code === 'ArrowUp' || code === 'PageUp') m.scroll = Math.max(0, m.scroll - (code === 'PageUp' ? 8 : 1));
      return;
    }
    if (code === 'ArrowDown') this.scrollBy(1);
    else if (code === 'ArrowUp') this.scrollBy(-1);
    else if (code === 'PageDown') this.scrollBy(ROWS);
    else if (code === 'PageUp') this.scrollBy(-ROWS);
    else if (code === 'ArrowRight' || code === 'ArrowLeft') {
      const order: (FactionId | null)[] = [null, ...FACTIONS.map((f) => f.engine as FactionId)];
      const i = order.indexOf(this.filter.faction);
      this.setFilter({ faction: order[(i + (code === 'ArrowRight' ? 1 : order.length - 1)) % order.length] });
    } else if (code === 'Escape' || code === 'KeyX') this.back();
  }

  /** Mouse wheel (optional; main.ts may forward it): positive scrolls down whatever list is under the pointer. */
  wheel(dy: number, x = this.mx, y = this.my): void {
    const step = dy > 0 ? 1 : -1;
    if (this.mode.kind === 'load') { this.key(step > 0 ? 'ArrowDown' : 'ArrowUp'); return; }
    if (this.mode.kind !== 'edit') return;
    if (x >= RIGHT_X) this.listScroll = Math.max(0, this.listScroll + step * 3);
    else if (y >= GRID_Y && y < PAGE_Y) this.scrollBy(step);
  }

  pointerMove(x: number, y: number): void {
    this.mx = x;
    this.my = y;
  }

  /** `button` 2 is the right mouse button (main.ts passes PointerEvent.button); it removes a copy instead of adding. */
  pointerDown(x: number, y: number, button = 0): void {
    this.mx = x;
    this.my = y;
    const h = [...this.hots].reverse().find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
    if (!h) return;
    const i = h.id.indexOf(':');
    const k = h.id.slice(0, i);
    const v = h.id.slice(i + 1);
    const alt = button === 2;
    const m = this.mode;
    switch (k) {
      case 'pool': if (alt !== this.removeMode) this.remove(v); else this.add(v); break;
      case 'deck':
        if (!alt) this.remove(v);
        else if (hasCard(v)) this.add(v);
        else this.tell(`${v} is not a known card and cannot be added.`, true);
        break;
      case 'fac': this.setFilter({ faction: v === 'all' ? null : (v as FactionId) }); break;
      case 'cost': this.setFilter({ cost: v === 'all' ? null : Number(v) }); break;
      case 'type': this.setFilter({ type: v === 'all' ? null : (v as CardType) }); break;
      case 'page': this.scrollBy(v === 'up' ? -ROWS : ROWS); break;
      case 'list': this.listScroll = Math.max(0, this.listScroll + (v === 'up' ? -8 : 8)); break;
      case 'rules': this.rulePage += 1; break;
      case 'btn': this.button(v); break;
      case 'name':
        if (m.kind !== 'name') break;
        if (v === 'next') this.nextIdea(m);
        else if (v === 'clear') m.name = '';
        else if (v === 'save') this.commitSave(m.name);
        else this.mode = { kind: 'edit' };
        break;
      case 'load':
        if (m.kind !== 'load') break;
        if (v === 'cancel') this.mode = { kind: 'edit' };
        else if (v === 'up') m.scroll = Math.max(0, m.scroll - 8);
        else if (v === 'down') m.scroll = Math.min(Math.max(0, this.saved.length - 1), m.scroll + 8);
        else { const d = this.saved[Number(v)]; if (d) this.loadDeck(d); }
        break;
      case 'confirm':
        if (m.kind !== 'confirm') break;
        if (v === 'yes') m.onYes(); else this.mode = { kind: 'edit' };
        break;
    }
  }

  private nextIdea(m: Extract<Mode, { kind: 'name' }>): void {
    m.idea = (m.idea + 1) % m.ideas.length;
    m.name = m.ideas[m.idea];
  }

  private button(id: string): void {
    if (id === 'new') this.newDeck();
    else if (id === 'save') this.openSave();
    else if (id === 'load') this.openLoad();
    else if (id === 'delete') this.deleteDeck();
    else if (id === 'fill') this.fill();
    else if (id === 'back') this.back();
    else if (id === 'mode') {
      this.removeMode = !this.removeMode;
      this.tell(this.removeMode ? 'Remove mode: clicking a pool card takes a copy out.' : 'Add mode: clicking a pool card adds a copy.');
    }
  }

  // ---------- drawing (PLAN D25: painted backdrop, glass panels, brass buttons, rounded card tiles) ----------

  draw(g: Gfx, t: number): void {
    this.hots = [];
    backdrop(g, HW, HH, 'thrumhollow', 0.42);
    drawText(g, 'DECK BUILDER', LEFT_X + 2, 5, { color: 'brassGlint', scale: 2, face: 'display', shadow: 'ink' });
    this.drawFilters(g);
    this.drawPool(g);
    this.drawDeck(g);
    this.drawFooter(g);
    if (this.mode.kind === 'edit') {
      const h = [...this.hots].reverse().find((r) => this.mx >= r.x && this.my >= r.y && this.mx < r.x + r.w && this.my < r.y + r.h);
      if (h && (h.id.startsWith('pool:') || h.id.startsWith('deck:'))) this.drawDetail(g, h.id.slice(5), h);
      return;
    }
    // a window is open: only its controls answer
    this.hots = [];
    g.wash(0, 0, HW, HH, 'ink', 0.55);
    if (this.mode.kind === 'name') this.drawName(g, t, this.mode);
    else if (this.mode.kind === 'load') this.drawLoad(g, this.mode);
    else this.drawConfirm(g, this.mode);
  }

  private hovering(x: number, y: number, w: number, h: number): boolean {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  /** A small filter chip: lit brass when on, smoked iron when off. */
  private chip(g: Gfx, label: string, x: number, y: number, id: string, on: boolean, h = 12): number {
    const w = Math.ceil(textWidth(label, 0.95, 'bold')) + 10;
    const hot = this.hovering(x, y, w, h);
    if (on) {
      fillRound(g, x, y, w, h, 'brassDark', 0.95, 3);
      frame(g, x, y, w, h, 'brassLight', 3, hot);
    } else {
      fillRound(g, x, y, w, h, 'ironNight', 0.85, 3);
      frame(g, x, y, w, h, hot ? 'brass' : 'ironDark', 3);
    }
    drawText(g, label, x + 5, y + (h - 7) / 2, { color: on ? 'brassGlint' : hot ? 'steamWhite' : 'steam', face: 'bold', scale: 0.95 });
    this.hots.push({ x, y, w, h, id });
    return w;
  }

  private btn(g: Gfx, label: string, x: number, y: number, id: string, tone: 'brass' | 'ember' = 'brass'): number {
    const w = Math.ceil(textWidth(label, 1, 'display')) + 16;
    const hot = this.hovering(x, y, w, 16);
    button(g, label, x, y, { w, h: 16, state: tone === 'ember' ? 'danger' : hot ? 'hot' : 'on' });
    this.hots.push({ x, y, w, h: 16, id });
    return w;
  }

  /** A round badge with a number, the battle screen's style: cost in crystal, power in brass, health in iron. */
  private badge(g: Gfx, cx: number, cy: number, value: number | string, kind: 'cost' | 'power' | 'health', r = 6): void {
    const ctx = g.ctx;
    const ramp: Record<typeof kind, [Ink, Ink, Ink]> = {
      cost: ['crystal', 'crystalDeep', 'crystalWhite'], power: ['brassLight', 'brassDark', 'brassGlint'], health: ['iron', 'ironNight', 'steam'],
    };
    const [a, b, edge] = ramp[kind];
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
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = PALETTE[edge];
    ctx.stroke();
    ctx.restore();
    drawTextCentred(g, String(value), cx, cy - 3.4 * (r / 6.5), { color: kind === 'power' ? 'ink' : 'steamWhite', face: 'bold', scale: r / 6.5, shadow: kind === 'power' ? undefined : 'ink' });
  }

  private drawFilters(g: Gfx): void {
    let x = LEFT_X;
    const tab = (id: string, w: number, on: boolean): boolean => {
      const hot = this.hovering(x, TAB_Y, w, 18);
      fillRound(g, x, TAB_Y, w, 18, on ? 'brassDark' : 'ironNight', on ? 0.95 : 0.85, 4);
      frame(g, x, TAB_Y, w, 18, on ? 'brassLight' : hot ? 'brass' : 'ironDark', 4, on);
      this.hots.push({ x, y: TAB_Y, w, h: 18, id });
      return hot;
    };
    const allOn = this.filter.faction === null;
    tab('fac:all', 26, allOn);
    drawTextCentred(g, 'ALL', x + 13, TAB_Y + 5.5, { color: allOn ? 'brassGlint' : 'steam', face: 'display', scale: 0.9 });
    x += 28;
    for (const f of FACTIONS) {
      const on = this.filter.faction === f.engine;
      tab(`fac:${f.engine}`, 20, on);
      const em = emblem(f.key);
      if (em) drawPic(g, em, x + 2, TAB_Y + 1, 16, 16);
      else drawText(g, f.key.slice(0, 2).toUpperCase(), x + 4, TAB_Y + 6, { color: 'steam' });
      x += 22;
    }
    const fac = FACTIONS.find((f) => f.engine === this.filter.faction);
    drawText(g, fac ? titled(fac.name) : 'Every faction', x + 4, TAB_Y + 5.5, { color: 'brassLight', face: 'bold', shadow: 'ink' });

    drawText(g, 'Cost', LEFT_X, COST_Y + 2.5, { color: 'ironLight' });
    x = LEFT_X + 30;
    x += this.chip(g, 'All', x, COST_Y, 'cost:all', this.filter.cost === null) + 2;
    for (let b = 0; b < COST_BUCKETS; b++) x += this.chip(g, costLabel(b), x, COST_Y, `cost:${b}`, this.filter.cost === b) + 2;

    drawText(g, 'Type', LEFT_X, TYPE_Y + 2.5, { color: 'ironLight' });
    x = LEFT_X + 30;
    x += this.chip(g, 'All', x, TYPE_Y, 'type:all', this.filter.type === null) + 2;
    for (const ty of TYPES) x += this.chip(g, sentence(TYPE_LABEL[ty]), x, TYPE_Y, `type:${ty}`, this.filter.type === ty) + 2;
    const n = poolCards(this.filter).length;
    const lbl = `${n} card${n === 1 ? '' : 's'}`;
    drawText(g, lbl, RIGHT_X - 8 - textWidth(lbl), TYPE_Y + 2.5, { color: 'steam' });
  }

  private drawPool(g: Gfx): void {
    const pool = poolCards(this.filter);
    const rows = Math.ceil(pool.length / COLS);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rows - ROWS)));
    fillRound(g, LEFT_X - 2, GRID_Y - 3, COLS * CELL_W + 10, ROWS * CELL_H + 3, 'ink', 0.55, 4);
    if (!pool.length) drawTextCentred(g, 'No card matches these filters', LEFT_X + (COLS * CELL_W) / 2, GRID_Y + 100, { color: 'ironLight' });
    for (let k = 0; k < ROWS * COLS; k++) {
      const c = pool[this.scroll * COLS + k];
      if (!c) break;
      const x = LEFT_X + (k % COLS) * CELL_W + 2;
      const y = GRID_Y + Math.floor(k / COLS) * CELL_H;
      const n = countOf(this.cards, c.id);
      const why = canAdd(this.cards, c.id);
      const hover = this.hovering(x, y, 66, CELL_H - 2);
      const ctx = g.ctx;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      fillRound(g, x, y, 66, 50, c.type === 'glyph' ? 'duskHigh' : 'ironDark', 1, 3.5);
      ctx.restore();
      const unclip = clipRound(g, x, y, 66, 50, 3.5);
      const art = cardArt(c.id);
      if (art) drawPic(g, art, x, y, 66, 50);
      else drawTextCentred(g, isMissing(c.id) || !CARD_ART[c.id]?.art ? 'No art' : '…', x + 33, y + 21, { color: 'iron' });
      if (why && n === 0) g.wash(x, y, 66, 50, 'ink', 0.55);
      unclip();
      this.badge(g, x + 7.5, y + 7.5, c.cost, 'cost', 5.5);
      if (c.type !== 'unit') {
        const tag = c.type === 'glyph' ? 'tactic' : 'hero';
        const tw = textWidth(tag, 0.75) + 6;
        fillRound(g, x + 64 - tw, y + 2, tw, 9, 'ink', 0.75, 3);
        drawText(g, tag, x + 67 - tw, y + 3.5, { color: c.type === 'hero' ? 'brassGlint' : 'crystalBright', scale: 0.75 });
      }
      if (n > 0) {
        const s = `${n}/${LIMITS.copies}`;
        const sw = textWidth(s, 0.9, 'bold') + 6;
        fillRound(g, x + 64 - sw, y + 38, sw, 10, 'ink', 0.8, 3);
        drawText(g, s, x + 67 - sw, y + 39.5, { color: n >= LIMITS.copies ? 'emberGlow' : 'crystalBright', face: 'bold', scale: 0.9 });
      }
      frame(g, x, y, 66, 50, hover ? 'brassGlint' : n > 0 ? 'brassLight' : 'ironDark', 3.5, hover);
      drawText(g, fitText(say(c.name), 68, 0.9, 'bold'), x, y + 52.5, { color: n > 0 ? 'brassGlint' : 'steamWhite', face: 'bold', scale: 0.9, shadow: 'ink' });
      this.hots.push({ x, y, w: 66, h: CELL_H - 2, id: `pool:${c.id}` });
    }
    // scroll bar and page buttons
    const barX = LEFT_X + COLS * CELL_W + 1;
    const barH = ROWS * CELL_H - 4;
    fillRound(g, barX, GRID_Y, 4, barH, 'ironNight', 0.9, 2);
    if (rows > ROWS) {
      const th = Math.max(8, Math.round((barH * ROWS) / rows));
      const ty = GRID_Y + Math.round(((barH - th) * this.scroll) / (rows - ROWS));
      fillRound(g, barX, ty, 4, th, 'brassLight', 1, 2);
    }
    let x = LEFT_X;
    x += this.chip(g, 'Prev', x, PAGE_Y, 'page:up', false) + 4;
    x += this.chip(g, 'Next', x, PAGE_Y, 'page:down', false) + 6;
    const last = Math.min(rows, this.scroll + ROWS);
    drawText(g, rows ? `Rows ${this.scroll + 1}–${last} of ${rows}` : 'No rows', x, PAGE_Y + 2.5, { color: 'ironLight' });
    const mode = this.removeMode ? 'Click removes' : 'Click adds';
    const mw = Math.ceil(textWidth(mode, 0.95, 'bold')) + 10;
    this.chip(g, mode, RIGHT_X - 8 - mw, PAGE_Y, 'btn:mode', this.removeMode);
  }

  private drawDeck(g: Gfx): void {
    const x = RIGHT_X;
    panel(g, x - 3, 21, RIGHT_W + 6, RIGHT_BOTTOM - 18, { studs: false });
    const check = checkDeck(this.cards);
    const title = this.savedName ? fitText(say(this.savedName), RIGHT_W - 60, 1, 'display') : 'NEW DECK';
    drawText(g, title, x + 3, 26, { color: 'brassGlint', face: 'display' });
    if (this.dirty) drawTextRight(g, 'unsaved', x + RIGHT_W - 3, 26, { color: 'emberGlow', face: 'bold' });
    const full = check.size === LIMITS.deck;
    drawText(g, `${check.size}/${LIMITS.deck}`, x + 3, 36, { color: full ? 'crystalBright' : 'emberGlow', scale: 2, face: 'bold', shadow: 'ink' });
    const hc = check.heroCards;
    drawText(g, `Factions ${check.factions.length}/${LIMITS.factions}`, x + 70, 36, { color: check.factions.length > LIMITS.factions ? 'emberGlow' : 'steamWhite' });
    check.factions.forEach((f, i) => {
      const key = FACTIONS.find((y) => y.engine === f)?.key;
      const em = key ? emblem(key) : null;
      if (em) drawPic(g, em, x + 160 + i * 12, 35, 10, 10);
    });
    drawText(g, `Heroes ${hc}/${LIMITS.heroCards}`, x + 70, 46, { color: hc > LIMITS.heroCards ? 'emberGlow' : 'steamWhite' });
    drawText(g, `max ${LIMITS.copies} each`, x + 140, 46, { color: 'steamWhite' });
    // the curve: cards per cost bucket (the same buckets as the cost filter)
    const curve = Array<number>(COST_BUCKETS).fill(0);
    for (const id of this.cards) if (hasCard(id)) curve[bucketOf(def(id).cost)] += 1;
    drawText(g, 'Cost', x + 3, 56, { color: 'ironLight' });
    drawText(g, 'Cards', x + 3, 65, { color: 'ironLight' });
    for (let b = 0; b < COST_BUCKETS; b++) {
      const bx = x + 40 + b * 21;
      drawTextCentred(g, costLabel(b), bx + 3, 56, { color: 'ironLight' });
      drawTextCentred(g, String(curve[b]), bx + 3, 65, { color: curve[b] ? 'steamWhite' : 'iron', face: curve[b] ? 'bold' : 'body' });
    }

    // rules (R-G1): every line checkDeck reports, paged if they do not fit
    const ruleLines: { text: string; ink: Ink }[] = [];
    if (check.ok) ruleLines.push({ text: 'Legal deck: ready for battle', ink: 'crystalBright' });
    for (const e of check.errors) wrapPx(say(e), RIGHT_W - 12).forEach((l, i) => ruleLines.push({ text: (i ? '   ' : '') + l, ink: 'emberGlow' }));
    const maxRule = 14;
    const pages = Math.max(1, Math.ceil(ruleLines.length / maxRule));
    this.rulePage %= pages;
    const shownRules = ruleLines.slice(this.rulePage * maxRule, (this.rulePage + 1) * maxRule);
    const ruleTop = RIGHT_BOTTOM - 14 - shownRules.length * ROW_H;
    rule(g, x, ruleTop - 3, RIGHT_W);
    drawText(g, pages > 1 ? `Deck rules R-G1, page ${this.rulePage + 1}/${pages}: click` : 'Deck rules R-G1', x + 3, ruleTop, { color: 'ironLight' });
    shownRules.forEach((l, i) => drawText(g, l.text, x + 3, ruleTop + 10 + i * ROW_H, { color: l.ink }));
    if (pages > 1) this.hots.push({ x, y: ruleTop - 2, w: RIGHT_W, h: RIGHT_BOTTOM - ruleTop, id: 'rules:next' });

    // the list, grouped by cost
    const lines: { text: string; ink: Ink; id?: string; n?: number }[] = [];
    if (!this.cards.length) lines.push({ text: 'The deck is empty', ink: 'ironLight' });
    for (const grp of groupDeck(this.cards)) {
      lines.push({ text: `${sentence(grp.label)}  (${grp.total})`, ink: 'brassLight' });
      for (const r of grp.rows) lines.push({ text: fitText(say(r.name), RIGHT_W - 30), ink: r.known ? 'steamWhite' : 'emberGlow', id: r.id, n: r.n });
    }
    const listBottom = ruleTop - 6;
    const fitRows = Math.max(1, Math.floor((listBottom - LIST_Y) / ROW_H) - 1);
    const maxScroll = Math.max(0, lines.length - fitRows);
    this.listScroll = Math.min(this.listScroll, maxScroll);
    const shown = lines.slice(this.listScroll, this.listScroll + fitRows);
    shown.forEach((l, i) => {
      const y = LIST_Y + i * ROW_H;
      if (l.id) {
        if (this.hovering(x, y - 1, RIGHT_W, ROW_H)) highlight(g, x, y - 1.5, RIGHT_W, ROW_H, 'brass');
        const tl = hasCard(l.id) ? def(l.id).type : null;
        drawText(g, `${l.n}`, x + 5, y, { color: l.n! >= LIMITS.copies ? 'emberGlow' : 'crystalBright', face: 'bold' });
        drawText(g, tl === 'glyph' ? 'T' : tl === 'hero' ? 'H' : tl ? 'U' : '?', x + 15, y, { color: tl === 'hero' ? 'brassLight' : 'ironLight' });
        drawText(g, l.text, x + 25, y, { color: l.ink });
        this.hots.push({ x, y: y - 1, w: RIGHT_W, h: ROW_H, id: `deck:${l.id}` });
      } else drawText(g, l.text, x + 3, y, { color: l.ink, face: 'bold' });
    });
    if (lines.length > fitRows) {
      const y = LIST_Y + fitRows * ROW_H;
      let bx = x + 2;
      bx += this.chip(g, 'Up', bx, y - 1, 'list:up', false, 10) + 2;
      bx += this.chip(g, 'Down', bx, y - 1, 'list:down', false, 10) + 4;
      drawText(g, `Lines ${this.listScroll + 1}–${this.listScroll + shown.length} of ${lines.length}`, bx, y, { color: 'ironLight' });
    }
  }

  private drawFooter(g: Gfx): void {
    const text = this.note ? say(this.note) : HINT;
    wrapPx(text, HW - 2 * LEFT_X).slice(0, 2).forEach((l, i) => drawText(g, l, LEFT_X, MSG_Y + i * 10, { color: this.note && this.noteBad ? 'emberGlow' : this.note ? 'brassGlint' : 'steam', shadow: 'ink' }));
    let x = LEFT_X;
    for (const [id, label] of [['new', 'NEW'], ['save', 'SAVE'], ['load', 'LOAD'], ['delete', 'DELETE'], ['fill', 'FILL']] as const) {
      x += this.btn(g, label, x, BTN_Y, `btn:${id}`, id === 'delete' ? 'ember' : 'brass') + 6;
    }
    const fillTo = fillFactions(this.cards, this.filter.faction);
    const facs = fillTo.factions.map((f) => titled(FACTIONS.find((y) => y.engine === f)!.name)).join(' + ');
    const backW = Math.ceil(textWidth('BACK', 1, 'display')) + 16;
    drawText(g, fitText(fillTo.problem ? 'Fill: pick a faction' : `Fill from ${facs}`, HW - 4 - backW - 8 - x), x, BTN_Y + 4.5, { color: 'steam', shadow: 'ink' });
    this.btn(g, 'BACK', HW - 4 - backW, BTN_Y, 'btn:back');
  }

  private drawDetail(g: Gfx, cardId: string, h: Hot): void {
    if (!hasCard(cardId)) {
      const w = 250, x = h.x + h.w / 2 < HW / 2 ? HW - w - 4 : 4;
      panel(g, x, 40, w, 64);
      wrapPx(say(`Unknown card ${cardId}. The data has no card with this id; take it out to make the deck legal.`), w - 18).slice(0, 4)
        .forEach((l, i) => drawText(g, l, x + 9, 50 + i * 10, { color: 'emberGlow' }));
      return;
    }
    const d = def(cardId);
    const f = face(null, 0, cardId);
    const w = 260, hgt = 262;
    const x = h.x + h.w / 2 < HW / 2 ? HW - w - 4 : 4;
    const y = 36;
    panel(g, x, y, w, hgt);
    const art = cardArt(cardId, false, true);
    if (art) {
      const unclip = clipRound(g, x + 8, y + 8, 128, 96, 3);
      drawPic(g, art, x + 8, y + 8);
      unclip();
      frame(g, x + 8, y + 8, 128, 96, 'brassDark', 3);
    } else drawTextCentred(g, isMissing(cardId, false, true) || !CARD_ART[cardId]?.art ? 'No art' : '…', x + 72, y + 50, { color: 'iron' });
    const tx = x + 144, tw = w - 152;
    const nm = wrapPx(say(f.name), tw, 1.15, 'bold');
    nm.forEach((l, i) => drawText(g, l, tx, y + 10 + i * 11, { color: 'brassGlint', face: 'bold', scale: 1.15 }));
    let yy = y + 14 + nm.length * 11;
    drawText(g, d.type === 'glyph' ? `Tactic, ${say(d.speed ?? '')}` : d.type === 'hero' ? 'Hero' : 'Unit', tx, yy, { color: 'steam' });
    yy += 14;
    this.badge(g, tx + 6, yy + 3, d.cost, 'cost');
    drawText(g, 'cost', tx + 15, yy, { color: 'ironLight', scale: 0.9 });
    if (d.type !== 'glyph') {
      this.badge(g, tx + 6, yy + 19, f.power, 'power');
      drawText(g, 'power', tx + 15, yy + 16, { color: 'ironLight', scale: 0.9 });
      this.badge(g, tx + 6, yy + 35, f.health, 'health');
      drawText(g, 'health', tx + 15, yy + 32, { color: 'ironLight', scale: 0.9 });
      yy += 32;
    }
    yy += 14;
    const fac = FACTIONS.find((z) => z.engine === d.faction);
    const facName = wrapPx(fac ? titled(fac.name) : say(d.faction), tw);
    facName.forEach((l, i) => drawText(g, l, tx, yy + i * 10, { color: 'ironLight' }));
    const n = countOf(this.cards, cardId);
    drawText(g, `In deck ${n}/${LIMITS.copies}`, tx, yy + 2 + facName.length * 10, { color: n ? 'crystalBright' : 'ironLight', face: 'bold' });
    const why = canAdd(this.cards, cardId);
    const whyLines = why ? wrapPx(say(`Cannot add: ${why}`), w - 18) : [];
    const limit = y + hgt - 14 - whyLines.length * 10;
    whyLines.forEach((l, i) => drawText(g, l, x + 9, limit + 4 + i * 10, { color: 'emberGlow' }));
    let ty = y + 114;
    rule(g, x + 8, ty - 5, w - 16);
    const room = (): boolean => ty <= limit - 10;
    const put = (s: string, ink: Ink, scale = 1): void => {
      for (const l of wrapPx(say(s), w - 18, scale)) { if (!room()) return; drawText(g, l, x + 9, ty, { color: ink, scale }); ty += 10.5 * scale; }
    };
    put(f.text, 'steamWhite');
    for (const k of f.keywords) { ty += 2; put(`${KEYWORD_HELP[k].name}: ${KEYWORD_HELP[k].text}`, 'crystalBright', 0.95); }
    if (d.level) { ty += 2; put(`Ascends: ${d.level.text} (${d.level.n})`, 'brassLight'); }
    if (d.ascended) {
      ty += 3;
      put(`Ascended: ${d.ascended.name ?? d.name}${d.ascended.power !== undefined ? ` ${d.ascended.power}|${d.ascended.health ?? f.health}` : ''}`, 'brassGlint');
      put(d.ascended.text, 'steam');
    }
  }

  private drawName(g: Gfx, t: number, m: Extract<Mode, { kind: 'name' }>): void {
    const w = 360, h = 150, x = (HW - w) / 2, y = 130;
    panel(g, x, y, w, h);
    drawText(g, 'SAVE THIS DECK', x + 14, y + 11, { color: 'brassGlint', face: 'display', scale: 1.3 });
    drawText(g, 'Type a name (A–Z, 0–9, space; Backspace erases),', x + 14, y + 26, { color: 'steam' });
    drawText(g, 'or press NEXT NAME (or Tab) for one.', x + 14, y + 36, { color: 'steam' });
    fillRound(g, x + 12, y + 48, w - 24, 18, 'ink', 0.9, 3);
    frame(g, x + 12, y + 48, w - 24, 18, 'brass', 3);
    drawText(g, m.name, x + 18, y + 53.5, { color: 'steamWhite', face: 'bold' });
    if ((t >> 4) % 2 === 0) fillRound(g, x + 18 + textWidth(m.name, 1, 'bold') + (m.name ? 2 : 0), y + 52, 1.5, 10, 'brassLight', 1, 0.5);
    drawTextRight(g, `${m.name.length}/${NAME_MAX}`, x + w - 18, y + 53.5, { color: 'ironLight' });
    const st = deckStatus(this.cards);
    const lines = st.legal ? ['This deck is legal.'] : wrapPx(say(`This deck is illegal and will be saved marked ILLEGAL: ${st.reason}`), w - 28);
    lines.slice(0, 3).forEach((l, i) => drawText(g, l, x + 14, y + 73 + i * 10, { color: st.legal ? 'crystalBright' : 'emberGlow' }));
    let bx = x + 14;
    const by = y + h - 28;
    bx += this.btn(g, 'NEXT NAME', bx, by, 'name:next') + 6;
    bx += this.btn(g, 'CLEAR', bx, by, 'name:clear') + 6;
    bx += this.btn(g, 'SAVE', bx, by, 'name:save') + 6;
    this.btn(g, 'CANCEL', bx, by, 'name:cancel');
  }

  private drawLoad(g: Gfx, m: Extract<Mode, { kind: 'load' }>): void {
    const w = 460, h = 380, x = (HW - w) / 2, y = 30;
    panel(g, x, y, w, h);
    drawText(g, 'LOAD A SAVED DECK', x + 14, y + 11, { color: 'brassGlint', face: 'display', scale: 1.3 });
    let ly = y + 28;
    if (this.loadProblem) {
      for (const l of wrapPx(say(this.loadProblem), w - 28)) { drawText(g, l, x + 14, ly, { color: 'emberGlow' }); ly += 10; }
    }
    if (!this.saved.length) drawText(g, 'No saved decks yet. Build one and press SAVE.', x + 14, ly + 6, { color: 'ironLight' });
    const ROW = 22;
    const fitRows = Math.floor((y + h - 34 - ly) / ROW);
    m.scroll = Math.min(m.scroll, Math.max(0, this.saved.length - fitRows));
    this.saved.slice(m.scroll, m.scroll + fitRows).forEach((d, k) => {
      const i = m.scroll + k;
      const ry = ly + k * ROW;
      const hover = this.hovering(x + 10, ry, w - 20, ROW - 2);
      if (hover) highlight(g, x + 10, ry, w - 20, ROW - 2, 'brass');
      else fillRound(g, x + 10, ry, w - 20, ROW - 2, 'ironNight', 0.75, 3);
      const st = deckStatus(d.cards);
      const meta = `${d.cards.length}/${LIMITS.deck}  ${sentence(st.label)}`;
      drawTextRight(g, meta, x + w - 16, ry + 2.5, { color: st.legal ? 'crystalBright' : 'emberGlow', face: 'bold' });
      drawText(g, fitText(say(d.name), w - 40 - textWidth(meta, 1, 'bold'), 1, 'bold'), x + 15, ry + 2.5, { color: 'steamWhite', face: 'bold' });
      const sub = !st.legal ? say(st.reason) : say(checkDeck(d.cards).factions.map((f) => titled(FACTIONS.find((z) => z.engine === f)!.name)).join(' and '));
      drawText(g, fitText(sub, w - 32, 0.9), x + 15, ry + 12, { color: st.legal ? 'ironLight' : 'emberGlow', scale: 0.9 });
      this.hots.push({ x: x + 10, y: ry, w: w - 20, h: ROW - 2, id: `load:${i}` });
    });
    const by = y + h - 26;
    let bx = x + 14;
    if (this.saved.length > fitRows) {
      bx += this.btn(g, 'UP', bx, by, 'load:up') + 6;
      bx += this.btn(g, 'DOWN', bx, by, 'load:down') + 6;
      drawText(g, `${m.scroll + 1}–${Math.min(this.saved.length, m.scroll + fitRows)} of ${this.saved.length}`, bx, by + 4.5, { color: 'ironLight' });
    }
    this.btn(g, 'CANCEL', x + w - 14 - (Math.ceil(textWidth('CANCEL', 1, 'display')) + 16), by, 'load:cancel');
  }

  private drawConfirm(g: Gfx, m: Extract<Mode, { kind: 'confirm' }>): void {
    const w = 340;
    const lines = m.lines.flatMap((l) => wrapPx(say(l), w - 30));
    const h = 52 + lines.length * 10.5, x = (HW - w) / 2, y = 160;
    panel(g, x, y, w, h);
    lines.forEach((l, i) => drawText(g, l, x + 15, y + 13 + i * 10.5, { color: 'steamWhite' }));
    const by = y + h - 27;
    const yw = this.btn(g, m.yes, x + 15, by, 'confirm:yes', 'ember');
    this.btn(g, m.no, x + 15 + yw + 8, by, 'confirm:no');
  }
}
