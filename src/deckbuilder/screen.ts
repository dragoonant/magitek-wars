// Deck builder screen (hi-res, 512 x 448). Left: the card pool with faction, cost and type filters. Right: the deck,
// grouped by cost, with every R-G1 limit and every rule checkDeck reports. Saved decks go through ./model (DECKS_KEY).
// Editing logic is in ./edit (tested); this file only draws and routes input. No native tooltips: hovering a card
// shows a detail window drawn on the canvas.
import type { CardType, DeckList, FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, face, hasCard } from '../engine/query';
import { checkDeck } from '../engine/validate';
import { FACTIONS } from '../data/factions';
import { CARD_ART } from '../data/cardart';
import { GLYPHS, drawText, drawTextCentred, textWidth } from '../font';
import type { Gfx } from '../gfx';
import type { Ink } from '../palette';
import { wrap } from '../gallery-text';
import { drawWindow } from '../title';
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

/** Upper case, with any character the house font lacks shown as '?' (visible, never a crash or a silent drop). */
function say(s: string): string {
  return [...s.toUpperCase()].map((ch) => (ch in GLYPHS ? ch : '?')).join('');
}

const fit = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}.` : s);

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
const RULE_CHARS = 33;

const TYPES: CardType[] = ['unit', 'hero', 'glyph'];
const HINT = 'CLICK A CARD TO ADD A COPY. RIGHT-CLICK, OR CLICK A DECK ROW, TAKES ONE OUT.';

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
      kind: 'confirm', lines: ['THIS DECK HAS UNSAVED CHANGES.', `${what} AND LOSE THEM?`], yes: what, no: 'KEEP EDITING',
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
      this.mode = { kind: 'confirm', lines: [this.loadProblem, 'SAVING WRITES THE READABLE DECKS ONLY.', 'THE REST WILL BE LOST. SAVE ANYWAY?'], yes: 'SAVE ANYWAY', no: 'CANCEL', onYes: doSave };
    } else if (clash) {
      this.mode = { kind: 'confirm', lines: [`A SAVED DECK IS ALREADY NAMED ${nm}.`, 'REPLACE IT WITH THIS DECK?'], yes: 'REPLACE IT', no: 'CANCEL', onYes: doSave };
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
      kind: 'confirm', lines: [`DELETE THE SAVED DECK ${nm}?`, 'THIS CANNOT BE UNDONE. THE CARDS STAY', 'IN THE EDITOR UNTIL YOU LEAVE.'], yes: 'DELETE IT', no: 'KEEP IT',
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

  // ---------- drawing ----------

  draw(g: Gfx, t: number): void {
    this.hots = [];
    g.rect(0, 0, HW, HH, 'duskZenith');
    g.dither25(0, 0, HW, HH, 'gloamDeep');
    drawText(g, 'DECK BUILDER', LEFT_X + 2, 5, { color: 'brassGlint', scale: 2 });
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
    g.dither50(0, 0, HW, HH, 'ink');
    if (this.mode.kind === 'name') this.drawName(g, t, this.mode);
    else if (this.mode.kind === 'load') this.drawLoad(g, this.mode);
    else this.drawConfirm(g, this.mode);
  }

  private chip(g: Gfx, label: string, x: number, y: number, id: string, on: boolean, h = 12): number {
    const w = textWidth(label) + 8;
    g.rect(x, y, w, h, on ? 'brassLight' : 'ink');
    g.rect(x + 1, y + 1, w - 2, h - 2, on ? 'brassDark' : 'ironNight');
    drawText(g, label, x + 4, y + Math.floor((h - 7) / 2), { color: on ? 'brassGlint' : 'steam' });
    this.hots.push({ x, y, w, h, id });
    return w;
  }

  private btn(g: Gfx, label: string, x: number, y: number, id: string, tone: 'brass' | 'ember' = 'brass'): number {
    const w = textWidth(label) + 14;
    g.rect(x, y, w, 16, 'ink');
    g.rect(x + 1, y + 1, w - 2, 14, tone === 'ember' ? 'emberDeep' : 'brassDark');
    g.rect(x + 1, y + 1, w - 2, 1, tone === 'ember' ? 'emberBright' : 'brassLight');
    drawText(g, label, x + 7, y + 5, { color: tone === 'ember' ? 'emberGlow' : 'brassGlint' });
    this.hots.push({ x, y, w, h: 16, id });
    return w;
  }

  private drawFilters(g: Gfx): void {
    let x = LEFT_X;
    const allOn = this.filter.faction === null;
    g.rect(x, TAB_Y, 26, 18, allOn ? 'brassLight' : 'ink');
    g.rect(x + 1, TAB_Y + 1, 24, 16, allOn ? 'brassDark' : 'ironNight');
    drawText(g, 'ALL', x + 4, TAB_Y + 6, { color: allOn ? 'brassGlint' : 'steam' });
    this.hots.push({ x, y: TAB_Y, w: 26, h: 18, id: 'fac:all' });
    x += 28;
    for (const f of FACTIONS) {
      const on = this.filter.faction === f.engine;
      g.rect(x, TAB_Y, 20, 18, on ? 'brassLight' : 'ink');
      g.rect(x + 1, TAB_Y + 1, 18, 16, on ? 'brassDark' : 'ironNight');
      const em = emblem(f.key);
      if (em) g.ctx.drawImage(em, x + 2, TAB_Y + 1, 16, 16);
      else drawText(g, f.key.slice(0, 2).toUpperCase(), x + 4, TAB_Y + 6, { color: 'steam' });
      this.hots.push({ x, y: TAB_Y, w: 20, h: 18, id: `fac:${f.engine}` });
      x += 22;
    }
    const fac = FACTIONS.find((f) => f.engine === this.filter.faction);
    drawText(g, fac ? fac.name : 'EVERY FACTION', x + 4, TAB_Y + 6, { color: 'brassLight' });

    drawText(g, 'COST', LEFT_X, COST_Y + 3, { color: 'ironLight' });
    x = LEFT_X + 30;
    x += this.chip(g, 'ALL', x, COST_Y, 'cost:all', this.filter.cost === null) + 2;
    for (let b = 0; b < COST_BUCKETS; b++) x += this.chip(g, costLabel(b), x, COST_Y, `cost:${b}`, this.filter.cost === b) + 2;

    drawText(g, 'TYPE', LEFT_X, TYPE_Y + 3, { color: 'ironLight' });
    x = LEFT_X + 30;
    x += this.chip(g, 'ALL', x, TYPE_Y, 'type:all', this.filter.type === null) + 2;
    for (const ty of TYPES) x += this.chip(g, TYPE_LABEL[ty], x, TYPE_Y, `type:${ty}`, this.filter.type === ty) + 2;
    const n = poolCards(this.filter).length;
    const lbl = `${n} CARD${n === 1 ? '' : 'S'}`;
    drawText(g, lbl, RIGHT_X - 8 - textWidth(lbl), TYPE_Y + 3, { color: 'steam' });
  }

  private drawPool(g: Gfx): void {
    const pool = poolCards(this.filter);
    const rows = Math.ceil(pool.length / COLS);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rows - ROWS)));
    g.rect(LEFT_X - 1, GRID_Y - 2, COLS * CELL_W + 9, ROWS * CELL_H + 2, 'ink');
    if (!pool.length) drawTextCentred(g, 'NO CARD MATCHES THESE FILTERS', LEFT_X + (COLS * CELL_W) / 2, GRID_Y + 100, { color: 'ironLight' });
    for (let k = 0; k < ROWS * COLS; k++) {
      const c = pool[this.scroll * COLS + k];
      if (!c) break;
      const x = LEFT_X + (k % COLS) * CELL_W + 2;
      const y = GRID_Y + Math.floor(k / COLS) * CELL_H;
      const n = countOf(this.cards, c.id);
      const why = canAdd(this.cards, c.id);
      const hover = this.mx >= x && this.my >= y && this.mx < x + 66 && this.my < y + CELL_H - 2;
      g.rect(x, y, 66, 50, hover ? 'brassGlint' : n > 0 ? 'brassLight' : 'iron');
      g.rect(x + 1, y + 1, 64, 48, c.type === 'glyph' ? 'duskHigh' : 'ironDark');
      const art = cardArt(c.id);
      if (art) g.ctx.drawImage(art, x + 1, y + 1, 64, 48);
      else drawTextCentred(g, isMissing(c.id) || !CARD_ART[c.id]?.art ? 'NO ART' : '...', x + 33, y + 21, { color: 'iron' });
      if (why && n === 0) g.dither50(x + 1, y + 1, 64, 48, 'ink');
      g.rect(x + 1, y + 1, 12, 10, 'ink');
      drawText(g, String(c.cost), x + 4, y + 2, { color: 'brassGlint' });
      const tl = c.type === 'glyph' ? 'T' : c.type === 'hero' ? 'H' : 'U';
      g.rect(x + 56, y + 1, 9, 10, 'ink');
      drawText(g, tl, x + 58, y + 2, { color: c.type === 'hero' ? 'brassLight' : 'ironLight' });
      if (n > 0) {
        const s = `${n}/${LIMITS.copies}`;
        g.rect(x + 64 - textWidth(s) - 3, y + 39, textWidth(s) + 4, 10, 'ink');
        drawText(g, s, x + 64 - textWidth(s) - 1, y + 41, { color: n >= LIMITS.copies ? 'emberGlow' : 'gloamBright' });
      }
      drawText(g, fit(say(c.name), 11), x, y + 52, { color: n > 0 ? 'brassGlint' : 'steamWhite' });
      this.hots.push({ x, y, w: 66, h: CELL_H - 2, id: `pool:${c.id}` });
    }
    // scroll bar and page buttons
    const barX = LEFT_X + COLS * CELL_W + 1;
    const barH = ROWS * CELL_H - 4;
    g.rect(barX, GRID_Y, 4, barH, 'ironNight');
    if (rows > ROWS) {
      const th = Math.max(8, Math.round((barH * ROWS) / rows));
      const ty = GRID_Y + Math.round(((barH - th) * this.scroll) / (rows - ROWS));
      g.rect(barX, ty, 4, th, 'brassLight');
    }
    let x = LEFT_X;
    x += this.chip(g, 'PREV', x, PAGE_Y, 'page:up', false) + 4;
    x += this.chip(g, 'NEXT', x, PAGE_Y, 'page:down', false) + 6;
    const last = Math.min(rows, this.scroll + ROWS);
    drawText(g, rows ? `ROWS ${this.scroll + 1}-${last} OF ${rows}` : 'NO ROWS', x, PAGE_Y + 3, { color: 'ironLight' });
    const mode = this.removeMode ? 'CLICK REMOVES' : 'CLICK ADDS';
    const mw = textWidth(mode) + 8;
    this.chip(g, mode, RIGHT_X - 8 - mw, PAGE_Y, 'btn:mode', this.removeMode);
  }

  private drawDeck(g: Gfx): void {
    const x = RIGHT_X;
    g.rect(x - 2, 22, RIGHT_W + 4, RIGHT_BOTTOM - 20, 'ink');
    g.rect(x - 1, 23, RIGHT_W + 2, RIGHT_BOTTOM - 22, 'ironNight');
    const check = checkDeck(this.cards);
    const title = this.savedName ? fit(say(this.savedName), 22) : 'NEW DECK';
    drawText(g, title, x + 2, 26, { color: 'brassGlint' });
    if (this.dirty) drawText(g, 'UNSAVED', x + RIGHT_W - 2 - textWidth('UNSAVED'), 26, { color: 'emberGlow' });
    const full = check.size === LIMITS.deck;
    drawText(g, `${check.size}/${LIMITS.deck}`, x + 2, 36, { color: full ? 'gloamBright' : 'emberGlow', scale: 2 });
    const hc = check.heroCards;
    drawText(g, `FACTIONS ${check.factions.length}/${LIMITS.factions}`, x + 70, 36, { color: check.factions.length > LIMITS.factions ? 'emberGlow' : 'steamWhite' });
    check.factions.forEach((f, i) => {
      const key = FACTIONS.find((y) => y.engine === f)?.key;
      const em = key ? emblem(key) : null;
      if (em) g.ctx.drawImage(em, x + 160 + i * 12, 35, 10, 10);
    });
    drawText(g, `HEROES ${hc}/${LIMITS.heroCards}`, x + 70, 46, { color: hc > LIMITS.heroCards ? 'emberGlow' : 'steamWhite' });
    drawText(g, `MAX ${LIMITS.copies} EACH`, x + 140, 46, { color: 'steamWhite' });
    // the curve: cards per cost bucket (the same buckets as the cost filter)
    const curve = Array<number>(COST_BUCKETS).fill(0);
    for (const id of this.cards) if (hasCard(id)) curve[bucketOf(def(id).cost)] += 1;
    drawText(g, 'COST', x + 2, 56, { color: 'ironLight' });
    drawText(g, 'CARDS', x + 2, 65, { color: 'ironLight' });
    for (let b = 0; b < COST_BUCKETS; b++) {
      const bx = x + 38 + b * 21;
      drawText(g, costLabel(b), bx, 56, { color: 'ironLight' });
      drawText(g, String(curve[b]), bx, 65, { color: curve[b] ? 'steamWhite' : 'iron' });
    }

    // rules (R-G1): every line checkDeck reports, paged if they do not fit
    const ruleLines: { text: string; ink: Ink }[] = [];
    if (check.ok) ruleLines.push({ text: 'LEGAL DECK: READY FOR BATTLE', ink: 'gloamBright' });
    for (const e of check.errors) wrap(say(e), RULE_CHARS).forEach((l, i) => ruleLines.push({ text: (i ? '  ' : '') + l, ink: 'emberGlow' }));
    const maxRule = 14;
    const pages = Math.max(1, Math.ceil(ruleLines.length / maxRule));
    this.rulePage %= pages;
    const shownRules = ruleLines.slice(this.rulePage * maxRule, (this.rulePage + 1) * maxRule);
    const ruleTop = RIGHT_BOTTOM - 14 - shownRules.length * ROW_H;
    g.rect(x, ruleTop - 3, RIGHT_W, 1, 'brassDark');
    drawText(g, pages > 1 ? `DECK RULES R-G1, PAGE ${this.rulePage + 1}/${pages}: CLICK` : 'DECK RULES R-G1', x + 2, ruleTop, { color: 'ironLight' });
    shownRules.forEach((l, i) => drawText(g, l.text, x + 2, ruleTop + 10 + i * ROW_H, { color: l.ink }));
    if (pages > 1) this.hots.push({ x, y: ruleTop - 2, w: RIGHT_W, h: RIGHT_BOTTOM - ruleTop, id: 'rules:next' });

    // the list, grouped by cost
    const lines: { text: string; ink: Ink; id?: string; n?: number }[] = [];
    if (!this.cards.length) lines.push({ text: 'THE DECK IS EMPTY', ink: 'ironLight' });
    for (const grp of groupDeck(this.cards)) {
      lines.push({ text: `${grp.label}  (${grp.total})`, ink: 'brassLight' });
      for (const r of grp.rows) lines.push({ text: fit(say(r.name), 26), ink: r.known ? 'steamWhite' : 'emberGlow', id: r.id, n: r.n });
    }
    const listBottom = ruleTop - 6;
    const fitRows = Math.max(1, Math.floor((listBottom - LIST_Y) / ROW_H) - 1);
    const maxScroll = Math.max(0, lines.length - fitRows);
    this.listScroll = Math.min(this.listScroll, maxScroll);
    const shown = lines.slice(this.listScroll, this.listScroll + fitRows);
    shown.forEach((l, i) => {
      const y = LIST_Y + i * ROW_H;
      if (l.id) {
        const hover = this.mx >= x && this.mx < x + RIGHT_W && this.my >= y - 1 && this.my < y + ROW_H - 1;
        if (hover) g.rect(x, y - 1, RIGHT_W, ROW_H, 'brassDark');
        const tl = hasCard(l.id) ? def(l.id).type : null;
        drawText(g, `${l.n}`, x + 4, y, { color: l.n! >= LIMITS.copies ? 'emberGlow' : 'gloamBright' });
        drawText(g, tl === 'glyph' ? 'T' : tl === 'hero' ? 'H' : tl ? 'U' : '?', x + 14, y, { color: 'ironLight' });
        drawText(g, l.text, x + 24, y, { color: l.ink });
        this.hots.push({ x, y: y - 1, w: RIGHT_W, h: ROW_H, id: `deck:${l.id}` });
      } else drawText(g, l.text, x + 2, y, { color: l.ink });
    });
    if (lines.length > fitRows) {
      const y = LIST_Y + fitRows * ROW_H;
      let bx = x + 2;
      bx += this.chip(g, 'UP', bx, y - 1, 'list:up', false, 10) + 2;
      bx += this.chip(g, 'DOWN', bx, y - 1, 'list:down', false, 10) + 4;
      drawText(g, `LINES ${this.listScroll + 1}-${this.listScroll + shown.length} OF ${lines.length}`, bx, y, { color: 'ironLight' });
    }
  }

  private drawFooter(g: Gfx): void {
    const text = this.note ? say(this.note) : HINT;
    wrap(text, 84).slice(0, 2).forEach((l, i) => drawText(g, l, LEFT_X, MSG_Y + i * 9, { color: this.note && this.noteBad ? 'emberGlow' : this.note ? 'brassGlint' : 'ironLight' }));
    let x = LEFT_X;
    for (const [id, label] of [['new', 'NEW'], ['save', 'SAVE'], ['load', 'LOAD'], ['delete', 'DELETE'], ['fill', 'FILL']] as const) {
      x += this.btn(g, label, x, BTN_Y, `btn:${id}`, id === 'delete' ? 'ember' : 'brass') + 6;
    }
    const fillTo = fillFactions(this.cards, this.filter.faction);
    const facs = fillTo.factions.map((f) => FACTIONS.find((y) => y.engine === f)!.key.toUpperCase()).join(' + ');
    drawText(g, fillTo.problem ? 'FILL: PICK A FACTION' : `FILL FROM ${facs}`, x, BTN_Y + 5, { color: 'ironLight' });
    this.btn(g, 'BACK', HW - 4 - (textWidth('BACK') + 14), BTN_Y, 'btn:back');
  }

  private drawDetail(g: Gfx, cardId: string, h: Hot): void {
    if (!hasCard(cardId)) {
      const w = 250, x = h.x + h.w / 2 < HW / 2 ? HW - w - 4 : 4;
      drawWindow(g, x, 40, w, 60);
      wrap(say(`Unknown card ${cardId}. The data has no card with this id; take it out to make the deck legal.`), 39).slice(0, 4)
        .forEach((l, i) => drawText(g, l, x + 8, 50 + i * 9, { color: 'emberGlow' }));
      return;
    }
    const d = def(cardId);
    const f = face(null, 0, cardId);
    const w = 250, hgt = 250;
    const x = h.x + h.w / 2 < HW / 2 ? HW - w - 4 : 4;
    const y = 40;
    drawWindow(g, x, y, w, hgt);
    const art = cardArt(cardId, false, true);
    if (art) g.ctx.drawImage(art, x + 8, y + 8);
    else drawTextCentred(g, isMissing(cardId, false, true) || !CARD_ART[cardId]?.art ? 'NO ART' : '...', x + 72, y + 50, { color: 'iron' });
    const nm = wrap(say(f.name), 17);
    nm.forEach((l, i) => drawText(g, l, x + 140, y + 10 + i * 9, { color: 'brassGlint' }));
    let yy = y + 14 + nm.length * 9;
    drawText(g, d.type === 'glyph' ? `TACTIC ${say(d.speed ?? '')}` : d.type === 'hero' ? 'HERO' : 'UNIT', x + 140, yy, { color: 'steam' });
    yy += 11;
    drawText(g, `COST ${d.cost}`, x + 140, yy, { color: 'steamWhite' });
    if (d.type !== 'glyph') {
      drawText(g, `POWER ${f.power}`, x + 140, yy + 10, { color: 'steamWhite' });
      drawText(g, `HEALTH ${f.health}`, x + 140, yy + 20, { color: 'steamWhite' });
    }
    const fac = FACTIONS.find((z) => z.engine === d.faction);
    const facName = wrap(fac ? fac.name : say(d.faction), 17);
    facName.forEach((l, i) => drawText(g, l, x + 140, yy + 32 + i * 9, { color: 'ironLight' }));
    const n = countOf(this.cards, cardId);
    drawText(g, `IN DECK ${n}/${LIMITS.copies}`, x + 140, yy + 34 + facName.length * 9, { color: n ? 'gloamBright' : 'ironLight' });
    const why = canAdd(this.cards, cardId);
    const whyLines = why ? wrap(say(`Cannot add: ${why}`), 39) : [];
    const limit = y + hgt - 14 - whyLines.length * 9;
    whyLines.forEach((l, i) => drawText(g, l, x + 8, limit + 4 + i * 9, { color: 'emberGlow' }));
    let ty = y + 110;
    const room = (): boolean => ty <= limit - 9;
    const put = (s: string, ink: Ink): void => {
      for (const l of wrap(say(s), 39)) { if (!room()) return; drawText(g, l, x + 8, ty, { color: ink }); ty += 9; }
    };
    put(f.text, 'steamWhite');
    for (const k of f.keywords) put(`${KEYWORD_HELP[k].name}: ${KEYWORD_HELP[k].text}`, 'gloamBright');
    if (d.level) put(`Ascends: ${d.level.text} (${d.level.n})`, 'brassLight');
    if (d.ascended) {
      ty += 2;
      put(`Ascended: ${d.ascended.name ?? d.name}${d.ascended.power !== undefined ? ` ${d.ascended.power}|${d.ascended.health ?? f.health}` : ''}`, 'brassGlint');
      put(d.ascended.text, 'steam');
    }
  }

  private drawName(g: Gfx, t: number, m: Extract<Mode, { kind: 'name' }>): void {
    const w = 360, h = 150, x = (HW - w) / 2, y = 130;
    drawWindow(g, x, y, w, h);
    drawText(g, 'SAVE THIS DECK', x + 12, y + 12, { color: 'brassGlint' });
    drawText(g, 'TYPE A NAME (A-Z, 0-9, SPACE; BACKSPACE ERASES)', x + 12, y + 24, { color: 'ironLight' });
    drawText(g, 'OR PRESS NEXT NAME (OR TAB) FOR ONE.', x + 12, y + 33, { color: 'ironLight' });
    g.rect(x + 12, y + 46, w - 24, 18, 'ink');
    g.rect(x + 13, y + 47, w - 26, 16, 'ironNight');
    drawText(g, m.name, x + 18, y + 52, { color: 'steamWhite' });
    if ((t >> 4) % 2 === 0) g.rect(x + 18 + textWidth(m.name) + (m.name ? 2 : 0), y + 51, 5, 8, 'brassLight');
    drawText(g, `${m.name.length}/${NAME_MAX}`, x + w - 18 - textWidth(`${m.name.length}/${NAME_MAX}`), y + 52, { color: 'iron' });
    const st = deckStatus(this.cards);
    const lines = st.legal ? ['THIS DECK IS LEGAL.'] : wrap(say(`This deck is illegal and will be saved marked ILLEGAL: ${st.reason}`), 54);
    lines.slice(0, 3).forEach((l, i) => drawText(g, l, x + 12, y + 72 + i * 9, { color: st.legal ? 'gloamBright' : 'emberGlow' }));
    let bx = x + 12;
    const by = y + h - 28;
    bx += this.btn(g, 'NEXT NAME', bx, by, 'name:next') + 6;
    bx += this.btn(g, 'CLEAR', bx, by, 'name:clear') + 6;
    bx += this.btn(g, 'SAVE', bx, by, 'name:save') + 6;
    this.btn(g, 'CANCEL', bx, by, 'name:cancel');
  }

  private drawLoad(g: Gfx, m: Extract<Mode, { kind: 'load' }>): void {
    const w = 460, h = 380, x = (HW - w) / 2, y = 30;
    drawWindow(g, x, y, w, h);
    drawText(g, 'LOAD A SAVED DECK', x + 12, y + 12, { color: 'brassGlint' });
    let ly = y + 24;
    if (this.loadProblem) {
      for (const l of wrap(say(this.loadProblem), 70)) { drawText(g, l, x + 12, ly, { color: 'emberGlow' }); ly += 9; }
    }
    if (!this.saved.length) drawText(g, 'NO SAVED DECKS YET. BUILD ONE AND PRESS SAVE.', x + 12, ly + 6, { color: 'ironLight' });
    const ROW = 20;
    const fitRows = Math.floor((y + h - 34 - ly) / ROW);
    m.scroll = Math.min(m.scroll, Math.max(0, this.saved.length - fitRows));
    this.saved.slice(m.scroll, m.scroll + fitRows).forEach((d, k) => {
      const i = m.scroll + k;
      const ry = ly + k * ROW;
      const hover = this.mx >= x + 10 && this.mx < x + w - 10 && this.my >= ry && this.my < ry + ROW - 2;
      g.rect(x + 10, ry, w - 20, ROW - 2, hover ? 'brassDark' : 'ironNight');
      const st = deckStatus(d.cards);
      drawText(g, fit(say(d.name), 40), x + 14, ry + 2, { color: 'steamWhite' });
      const meta = `${d.cards.length}/${LIMITS.deck}  ${st.label}`;
      drawText(g, meta, x + w - 14 - textWidth(meta), ry + 2, { color: st.legal ? 'gloamBright' : 'emberGlow' });
      if (!st.legal) drawText(g, fit(say(st.reason), 72), x + 14, ry + 10, { color: 'emberGlow' });
      else drawText(g, say(checkDeck(d.cards).factions.map((f) => FACTIONS.find((z) => z.engine === f)!.name).join(' AND ')), x + 14, ry + 10, { color: 'ironLight' });
      this.hots.push({ x: x + 10, y: ry, w: w - 20, h: ROW - 2, id: `load:${i}` });
    });
    const by = y + h - 26;
    let bx = x + 12;
    if (this.saved.length > fitRows) {
      bx += this.btn(g, 'UP', bx, by, 'load:up') + 6;
      bx += this.btn(g, 'DOWN', bx, by, 'load:down') + 6;
      drawText(g, `${m.scroll + 1}-${Math.min(this.saved.length, m.scroll + fitRows)} OF ${this.saved.length}`, bx, by + 5, { color: 'ironLight' });
    }
    this.btn(g, 'CANCEL', x + w - 12 - (textWidth('CANCEL') + 14), by, 'load:cancel');
  }

  private drawConfirm(g: Gfx, m: Extract<Mode, { kind: 'confirm' }>): void {
    const lines = m.lines.flatMap((l) => wrap(say(l), 50));
    const w = 330, h = 50 + lines.length * 10, x = (HW - w) / 2, y = 160;
    drawWindow(g, x, y, w, h);
    lines.forEach((l, i) => drawText(g, l, x + 14, y + 12 + i * 10, { color: 'steamWhite' }));
    const by = y + h - 26;
    const yw = this.btn(g, m.yes, x + 14, by, 'confirm:yes', 'ember');
    this.btn(g, m.no, x + 14 + yw + 8, by, 'confirm:no');
  }
}
