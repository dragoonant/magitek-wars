// The match screen (PLAN D17): the SNES hi-res mode, 512 x 448. Both Lines, both Crystals, the hand, the stack,
// the log and the prompt. Every choice comes from legalActions: a click narrows the legal actions, so the screen can
// never offer a move the engine would refuse, and never makes a choice for the player (KB rules 8 and 12).
import { drawCover, drawPic } from '../detail';
import type { Action, GameState, Seat, Unit } from '../engine/types';
import { LIMITS, spireId } from '../engine/types';
import { legalActions, whyNotPlay, whyNotDeclare } from '../engine/rules';
import { costOf, def, face, stats } from '../engine/query';
import { view } from '../engine/view';
import { drawText, drawTextCentred, fitText, textWidth, wrapPx } from '../font';
import type { Gfx } from '../gfx';
import { PALETTE, rgba, type Ink } from '../palette';
import { button, clipRound, fillRound, frame, highlight, panel, rule } from '../ui';
import { FACTIONS } from '../data/factions';
import { CARD_ART } from '../data/cardart';
import { cardArt, field, isMissing } from './art';
import { END_REASONS, KEYWORD_HELP, lineText, targetPrompt } from './text';
import type { Session } from './session';
import { playEvent } from '../audio/audio';
import { Fx, type BoltStyle, type Pt } from './fx';
import { bigCard, cardGrid, grouped, scrollButtons, type GridHot, type GridItem } from '../cardgrid';

/**
 * Logical screen size (PLAN D17, D23). The height is fixed at 448; the width follows the window's shape, from 512
 * (the SNES hi-res frame) up to WIDE_MAX. main.ts sets it each frame: the battle lays itself out across the width,
 * and screens built for 512 are drawn centred with HW at 512.
 */
export let HW = 512;
export const HH = 448;
export const BASE_W = 512;
export const WIDE_MAX = 1280;
export function setHW(w: number): void {
  HW = Math.max(BASE_W, Math.min(WIDE_MAX, Math.round(w)));
}

const SLOT = { w: 82, h: 104 };
/**
 * The Clockface layout (PLAN D37). Each player is a dial: the Crystal at the hub, Charge as an outer ring of ten
 * segments, Reserve as an inner ring of three arcs. The foe's dial sits at the top centre, yours at the bottom centre
 * with your hand split around it; Deck and Scrap piles at the far corners; the prompt, stack and buttons in the lane.
 */
const FOE_DIAL = { y: 23, r: 26 };
const MY_DIAL = { y: 410, r: 31 };
const FOE_LINE_Y = 58;
const MID_Y = 164;
const MY_LINE_Y = 208;
/** How far an attacker or blocker steps out of its Line toward the other side. */
const LUNGE = 6;
/** My Deck and Scrap piles sit at the far left and far right of the hand row. */
const PILE = { w: 44, h: 62 };
const HAND_Y = 330;
const CARD = { h: 104 };
const AI_DELAY = 520;
/** The gap kept clear around my dial in the hand row. */
const DIAL_GAP = 46;

/** Line slots: six columns across the width; a slot grows up to 110 wide, its art stays 64 x 48, centred. */
function slotGeo(): { w: number; dx: number; x0: number } {
  const dx = (HW - 8) / LIMITS.line;
  const w = Math.min(110, Math.floor(dx) - 2);
  return { w, dx, x0: 4 + (dx - w - 2) / 2 };
}
/**
 * Hand cards, split around my dial (PLAN D37): the first half to its left, the rest to its right, each half centred
 * between a pile and the dial. Cards are 58 wide at 512 and 66 on wider screens; a big hand overlaps.
 */
function handGeo(n: number): { w: number; xs: number[] } {
  const w = HW >= 640 ? 66 : 58;
  const nl = Math.ceil(n / 2), nr = n - nl;
  const lane = (count: number, a: number, b: number): number[] => {
    if (count === 0) return [];
    const dx = count > 1 ? Math.min(w + 6, (b - a - w) / (count - 1)) : 0;
    const total = w + (count - 1) * dx;
    const x0 = (a + b) / 2 - total / 2;
    return Array.from({ length: count }, (_, i) => Math.round(x0 + i * dx));
  };
  return { w, xs: [...lane(nl, 6 + PILE.w + 8, HW / 2 - DIAL_GAP), ...lane(nr, HW / 2 + DIAL_GAP, HW - 6 - PILE.w - 8)] };
}
/** The log drawer: it slides in from the right over the board. */
const drawerW = (): number => Math.round(Math.min(340, Math.max(250, HW * 0.4)));

interface Hot { x: number; y: number; w: number; h: number; id: string; kind: 'hand' | 'unit' | 'spire' | 'stack' | 'button' | 'hero' | 'orders' }
interface Button { id: string; label: string; enabled: boolean }

/** The click path of an action, in the order the player gives it: targets, then the unit to scrap. */
function pathOf(a: Action): string[] {
  if (a.type !== 'play') return [];
  return [...(a.targets ?? []), ...(a.replace ? [`R:${a.replace}`] : [])];
}


export class Match {
  /** Hand card armed for play, and the targets clicked so far. */
  private armed: { iid: string; path: string[] } | null = null;
  /** A unit picked as blocker (block phase) or a Dueler waiting for its forced blocker (declare). */
  private picked: { iid: string; mode: 'block' | 'duel' } | null = null;
  private mull = new Set<string>();
  private hots: Hot[] = [];
  private hover: Hot | null = null;
  private note = '';
  private aiAt = 0;
  private menu = false;
  /** Full-screen viewers: a player's Scrap (open information) or a Deck (mine: what is left, sorted; the foe's: a count). */
  private panel: { kind: 'scrap'; seat: Seat } | { kind: 'deck'; seat: Seat } | null = null;
  private scroll = 0;
  /** The log drawer: open or not, how far it has slid in (0 to 1), and its scroll. */
  private drawer = false;
  private drawerT = 0;
  private drawerScroll = 0;
  /** Where each unit is drawn now; it eases toward its slot, so attackers and blockers visibly move. */
  private at = new Map<string, [number, number]>();
  /** Where each unit was last drawn, so effects can rise from it (even after it is gone). */
  private pos = new Map<string, [number, number]>();
  /** Battle effects (PLAN D26), driven only by new log entries. */
  private fx = new Fx();
  /** The frame the last queued effect starts on: a new batch of events plays after the one before it. */
  private fxEnd = 0;
  private lastT = 0;
  /** Who cast each tactic on the stack, so its bolts start from that side. */
  private castBy = new Map<string, Seat>();
  /** Units summoned by a queued event: hidden until their turn, then they fly in from the hand. */
  private arrive = new Map<string, { born: number; seat: Seat }>();
  private seenLog = -1;
  /** My hand as last seen, and cards still on their way into it (hidden until the frame they land). */
  private knownHand = new Set<string>();
  private incoming = new Map<string, number>();
  /**
   * Where each unit sits on its Line, by column. Display only: no rule reads a unit's place (nothing in the engine or
   * the card text names a neighbour), so the player may drop a unit into any open slot. Kept per battle in storage.
   */
  private slots = new Map<string, number>();
  private slotKey: string;
  /** The column a unit being played will take, and the unit it replaces when the Line is full (set by a drop). */
  private pendingSlot: number | null = null;
  private preferredReplace: string | null = null;
  /** A press in progress: where it started, on what, and whether a touch has been held long enough to inspect. */
  private down: { x: number; y: number; hot: Hot | null; touch: boolean; timer: number; held: boolean; dead: boolean } | null = null;
  /** A hand card being dragged, and where the pointer is. */
  private drag: { iid: string; x: number; y: number } | null = null;
  /** The card a held touch is inspecting (cleared when the finger lifts). */
  private inspect: Hot | null = null;
  /** The enlarged card grows from its place: which card it is and how far it has grown. */
  private zoom = { key: '', k: 0 };
  /** A card opened from a deck or Scrap viewer for a closer look. */
  private peek: string | null = null;
  /** Set when the player leaves; main.ts returns to the title. */
  exit: 'title' | 'rematch' | null = null;
  /** Called once when the match ends (the roguelike reads the result). */
  onOver: ((winner: Seat | 'draw' | null) => void) | null = null;
  private overSent = false;
  /** Play-test mode (?auto in the URL): the AI plays our seat too, through this same screen. */
  auto = false;
  delay = AI_DELAY;
  /** Music for this battle: 'tense' for a campaign boss. */
  mood: 'battle' | 'tense' = 'battle';
  /** In a campaign run the end screen has one button, which hands the result back. */
  endLabel: string | null = null;

  constructor(readonly session: Session, readonly title: string) {
    this.slotKey = `mkw-slots-${session.setup.seed}`;
    try {
      const saved = JSON.parse(localStorage.getItem(this.slotKey) ?? '{}') as Record<string, number>;
      for (const [k, c] of Object.entries(saved)) if (Number.isInteger(c)) this.slots.set(k, c);
    } catch {
      /* no storage or a bad entry: units take the first open slots */
    }
    const q = new URLSearchParams(location.search);
    this.auto = q.has('auto');
    if (q.has('fast')) this.delay = 0;
  }

  private get s(): GameState {
    return this.session.state;
  }

  private get myTurn(): boolean {
    return this.s.phase !== 'over' && this.s.priority === 0;
  }

  private acts(): Action[] {
    return this.myTurn ? legalActions(this.s) : [];
  }

  private name(id: string, seat: Seat = 0): string {
    return face(this.s, seat, id).name;
  }

  private apply(a: Action): void {
    const before = new Set(this.s.players[0].line.map((u) => u.iid));
    const r = this.session.apply(a);
    if (r.ok && a.type === 'play' && this.pendingSlot !== null) {
      const fresh = this.s.players[0].line.find((u) => !before.has(u.iid) && u.card === this.cardOfAny(a.iid));
      if (fresh) {
        if (a.replace) this.slots.delete(a.replace);
        this.slots.set(fresh.iid, this.pendingSlot);
        this.saveSlots();
      }
    }
    this.pendingSlot = null;
    this.preferredReplace = null;
    this.note = r.ok ? '' : r.error ?? 'The engine refused that move.';
    this.armed = null;
    this.picked = null;
    if (this.s.phase !== 'mulligan') this.mull.clear();
    this.aiAt = performance.now() + this.delay;
  }

  /** The AI moves when it has priority, one action per beat so its moves can be followed. */
  update(now: number): void {
    if (this.s.phase === 'over') {
      if (!this.overSent) {
        this.overSent = true;
        this.onOver?.(this.s.winner);
      }
      return;
    }
    if ((this.s.priority !== 1 && !this.auto) || now < this.aiAt) return;
    // the AI waits for the effects of the last move to play out, so its moves can be followed
    if (this.delay > 0 && this.fxEnd > this.lastT) return;
    const r = this.session.apply(this.session.aiAction(this.s.priority));
    if (!r.ok) throw new Error(`The AI chose a move the engine refused: ${r.error ?? ''}`);
    this.aiAt = now + this.delay;
  }

  /** Read-only snapshot for end-to-end checks: what is clickable and where. */
  debug(): { hots: Hot[]; armed: string | null; next: string[]; buttons: string[]; note: string } {
    return { hots: [...this.hots], armed: this.armed?.iid ?? null, next: [...this.nextChoices()], buttons: this.buttons().filter((b) => b.enabled).map((b) => b.id), note: this.note };
  }

  // ---------- input ----------

  private buttons(): Button[] {
    const s = this.s;
    if (s.phase === 'over') return this.endLabel ? [{ id: 'title', label: this.endLabel, enabled: true }] : [{ id: 'rematch', label: 'REMATCH', enabled: true }, { id: 'title', label: 'TITLE', enabled: true }];
    if (!this.myTurn) return [];
    const acts = this.acts();
    const out: Button[] = [];
    if (s.phase === 'mulligan') {
      out.push({ id: 'mulligan', label: this.mull.size ? `REPLACE ${this.mull.size}` : 'KEEP HAND', enabled: true });
      return out;
    }
    if (this.armed) {
      const cands = this.candidates();
      const exact = cands.some((a) => pathOf(a).length === this.armed!.path.length);
      const scrapping = this.armed.path.some((p) => p.startsWith('R:'));
      out.push({ id: 'play', label: def(this.cardOf(this.armed.iid)).type === 'glyph' ? 'PLAY TACTIC' : scrapping ? 'SCRAP AND PLAY' : 'PLAY UNIT', enabled: exact });
      if (acts.some((a) => a.type === 'channel' && a.iid === this.armed!.iid)) out.push({ id: 'channel', label: 'CHANNEL', enabled: true });
      out.push({ id: 'cancel', label: 'CANCEL', enabled: true });
      return out;
    }
    if (this.picked?.mode === 'duel') {
      out.push({ id: 'noduel', label: 'NO DUEL', enabled: true }, { id: 'cancel', label: 'CANCEL', enabled: true });
      return out;
    }
    if (s.phase === 'declare') out.push({ id: 'attack', label: `ATTACK (${s.combat?.pairs.length ?? 0})`, enabled: acts.some((a) => a.type === 'attack') });
    if (s.phase === 'block') out.push({ id: 'blocks', label: 'LOCK BLOCKS', enabled: true });
    if (acts.some((a) => a.type === 'pass')) {
      const label = s.stack.length ? 'RESOLVE' : s.phase === 'combat' ? 'TO STRIKES' : s.passes > 0 ? 'END ROUND' : 'PASS';
      out.push({ id: 'pass', label, enabled: true });
    }
    return out;
  }

  /** The card id of a hand card, or of the card just played from the hand (it is gone from the hand by then). */
  private played = new Map<string, string>();
  private cardOfAny(iid: string): string | undefined {
    return this.played.get(iid);
  }

  private saveSlots(): void {
    try {
      localStorage.setItem(this.slotKey, JSON.stringify(Object.fromEntries(this.slots)));
    } catch {
      /* no storage: the places last for this visit only */
    }
  }

  private cardOf(iid: string): string {
    const h = this.s.players[0].hand.find((x) => x.iid === iid);
    if (!h) throw new Error(`no hand card ${iid}`);
    return h.card;
  }

  private candidates(): Action[] {
    if (!this.armed) return [];
    const { iid, path } = this.armed;
    return this.acts().filter((a) => a.type === 'play' && a.iid === iid && path.every((p, i) => pathOf(a)[i] === p));
  }

  /** Ids the next click may choose: targets, or 'R:<iid>' for the unit to scrap. */
  private nextChoices(): Set<string> {
    const out = new Set<string>();
    if (!this.armed) return out;
    const n = this.armed.path.length;
    for (const a of this.candidates()) {
      const p = pathOf(a);
      if (p.length > n) out.add(p[n]);
    }
    return out;
  }

  private prompt(): string {
    const s = this.s;
    if (s.phase === 'over') return '';
    if (!this.myTurn) return s.phase === 'mulligan' ? 'The foe is choosing its opening hand.' : 'The foe is thinking.';
    if (s.phase === 'mulligan') return 'Opening hand: click cards to replace them, then keep or replace.';
    if (this.armed) {
      const id = this.cardOf(this.armed.iid);
      const next = [...this.nextChoices()];
      const cut = this.armed.path.find((p) => p.startsWith('R:'));
      if (next.length === 0 && cut) {
        const u = this.s.players[0].line.find((x) => x.iid === cut.slice(2));
        return `Scrap ${u ? this.name(u.card) : 'that unit'} to make room for ${this.name(id)}? It goes to your Scrap.`;
      }
      if (next.length === 0) return `Play ${this.name(id)}?`;
      if (next.every((x) => x.startsWith('R:'))) return `Your Line is full: choose a unit to scrap for ${this.name(id)}.`;
      const d = def(id);
      const specs = d.type === 'glyph' ? d.targets ?? [] : d.abilities?.find((ab) => ab.on === 'deploy')?.targets ?? [];
      const slot = this.armed.path.length;
      const spec = specs[slot];
      return spec ? targetPrompt(this.name(id), slot, specs.length, spec) : `Choose a target for ${this.name(id)}.`;
    }
    if (this.picked?.mode === 'duel') return 'Dueler: choose the enemy unit that must block it, or attack without a duel.';
    if (this.picked?.mode === 'block') return 'Now click the attacker this unit blocks.';
    if (s.phase === 'declare') return 'Click units to add or withdraw attackers, then attack.';
    if (s.phase === 'block') return 'Blocking: click one of your units, then the attacker it blocks.';
    if (s.phase === 'combat') return 'The attack is locked in: answer with Swift or Flash tactics, or go to strikes.';
    if (s.stack.length) return 'Tactics are waiting: answer, or resolve the stack.';
    const canAttack = this.acts().some((a) => a.type === 'declare');
    return canAttack ? 'Your move: play a card, click a unit to attack, or pass.' : 'Your move: play a card or pass.';
  }

  private press(id: string): void {
    const acts = this.acts();
    if (id === 'menu') { this.menu = !this.menu; return; }
    if (id === 'log') { this.drawer = !this.drawer; this.drawerScroll = 0; return; }
    if (id === 'drawer-bg') return;
    if (id === 'drawer-up') { this.drawerScroll += 10; return; }
    if (id === 'drawer-down') { this.drawerScroll = Math.max(0, this.drawerScroll - 10); return; }
    if (id === 'scrap0' || id === 'scrap1') { this.panel = { kind: 'scrap', seat: id === 'scrap0' ? 0 : 1 }; this.scroll = 0; return; }
    if (id === 'deck0' || id === 'deck1') { this.panel = { kind: 'deck', seat: id === 'deck0' ? 0 : 1 }; this.scroll = 0; return; }
    if (id === 'panel-bg') return;
    if (id === 'panel-close') { this.panel = null; this.peek = null; return; }
    if (id === 'grid-up') { this.scroll = Math.max(0, this.scroll - 1); return; }
    if (id === 'grid-down') { this.scroll += 1; return; }
    if (id.startsWith('pgrid|')) { this.peek = this.peek === id.slice(6) ? null : id.slice(6); return; }
    if (this.menu) {
      if (id === 'm-resume') this.menu = false;
      else if (id === 'm-title') { this.menu = false; this.exit = 'title'; }
      else if (id === 'm-concede' && this.s.phase !== 'over') { this.menu = false; this.session.apply({ type: 'concede' }); }
      return;
    }
    if (id === 'rematch') { this.exit = 'rematch'; return; }
    if (id === 'title') { this.exit = 'title'; return; }
    if (id === 'cancel') { this.armed = null; this.picked = null; this.pendingSlot = null; this.preferredReplace = null; return; }
    if (id === 'mulligan') { this.apply({ type: 'mulligan', replace: [...this.mull] }); return; }
    if (id === 'pass') { this.apply({ type: 'pass' }); return; }
    if (id === 'attack') { this.apply({ type: 'attack' }); return; }
    if (id === 'blocks') { this.apply({ type: 'blocks' }); return; }
    if (id === 'channel' && this.armed) { this.apply({ type: 'channel', iid: this.armed.iid }); return; }
    if (id === 'noduel' && this.picked) { this.apply({ type: 'declare', unit: this.picked.iid }); return; }
    if (id === 'play' && this.armed) {
      this.played.set(this.armed.iid, this.cardOf(this.armed.iid));
      const n = this.armed.path.length;
      const a = this.candidates().find((x) => pathOf(x).length === n);
      if (a) this.apply(a);
      return;
    }
    void acts;
  }

  private clickHand(iid: string): void {
    const s = this.s;
    if (s.phase === 'mulligan') {
      if (!this.myTurn) return;
      if (this.mull.has(iid)) this.mull.delete(iid);
      else this.mull.add(iid);
      return;
    }
    if (!this.myTurn) { this.note = 'Wait: the foe has priority.'; return; }
    if (this.armed?.iid === iid) {
      // second click on the armed card plays it when no further choice is needed
      if (this.nextChoices().size === 0) this.press('play');
      else this.armed = null;
      return;
    }
    const playable = this.acts().some((a) => (a.type === 'play' || a.type === 'channel') && a.iid === iid);
    if (!playable) { this.note = whyNotPlay(s, 0, iid) ?? 'That card cannot be played now.'; this.armed = null; return; }
    this.armed = { iid, path: [] };
    this.picked = null;
    this.note = '';
  }

  /** After a choice: take the unit a drop pointed at when only the unit to scrap is left, and play once complete. */
  private advance(): void {
    if (!this.armed) return;
    const next = [...this.nextChoices()];
    const pref = this.preferredReplace ? `R:${this.preferredReplace}` : null;
    if (pref && next.length && next.every((x) => x.startsWith('R:')) && next.includes(pref)) this.armed.path.push(pref);
    // scrapping a unit is confirmed with SCRAP AND PLAY (PLAN D29); anything else plays once complete
    const last = this.armed.path[this.armed.path.length - 1];
    if (this.nextChoices().size === 0 && !last?.startsWith('R:')) this.press('play');
  }

  private clickObject(id: string): void {
    const s = this.s;
    if (!this.myTurn) return;
    if (this.armed) {
      const next = this.nextChoices();
      const key = next.has(id) ? id : next.has(`R:${id}`) ? `R:${id}` : null;
      if (!key) { this.note = 'That is not a legal choice for this card.'; return; }
      this.armed.path.push(key);
      this.advance();
      return;
    }
    const acts = this.acts();
    const mine = s.players[0].line.some((u) => u.iid === id);
    if (this.picked?.mode === 'duel') {
      const a = acts.find((x) => x.type === 'declare' && x.unit === this.picked!.iid && x.duel === id);
      if (a) this.apply(a);
      else this.note = 'That unit cannot be made to block.';
      return;
    }
    if (s.phase === 'block') {
      if (mine) {
        const un = acts.find((a) => a.type === 'unblock' && a.unit === id);
        if (un) { this.apply(un); return; }
        if (acts.some((a) => a.type === 'block' && a.unit === id)) this.picked = { iid: id, mode: 'block' };
        else this.note = 'That unit cannot block now.';
        return;
      }
      if (this.picked?.mode === 'block') {
        const a = acts.find((x) => x.type === 'block' && x.unit === this.picked!.iid && x.att === id);
        if (a) this.apply(a);
        else this.note = 'It cannot block that attacker.';
      }
      return;
    }
    if (mine && (s.phase === 'main' || s.phase === 'declare')) {
      const un = acts.find((a) => a.type === 'undeclare' && a.unit === id);
      if (un) { this.apply(un); return; }
      const decl = acts.filter((a) => a.type === 'declare' && a.unit === id);
      if (decl.length === 0) {
        this.note = whyNotDeclare(s, 0, id) ?? 'That unit cannot attack now.';
        return;
      }
      if (decl.some((a) => a.type === 'declare' && a.duel)) this.picked = { iid: id, mode: 'duel' };
      else this.apply(decl[0]);
    }
  }

  /** Pointer moved. A mouse moving over a card enlarges it; a press that moves on a hand card becomes a drag. */
  pointerMove(x: number, y: number, touch = false): void {
    if (!touch) this.hover = this.hit(x, y);
    const d = this.down;
    if (d && !d.dead) {
      const far = Math.hypot(x - d.x, y - d.y) > (d.touch ? 10 : 6);
      if (far && !this.drag && !d.held && d.hot?.kind === 'hand') this.startDrag(d);
      if (far && d.touch && !d.held) clearTimeout(d.timer);
    }
    if (this.drag) { this.drag.x = x; this.drag.y = y; }
  }

  pointerLeave(): void {
    this.hover = null;
  }

  /** A press starts: buttons act at once; anything else waits for release (a click), a drag, or a held touch. */
  pointerDown(x: number, y: number, touch = false): void {
    const h = this.hit(x, y);
    if (h?.kind === 'button') { this.press(h.id); return; }
    const d = { x, y, hot: h, touch, timer: 0, held: false, dead: false };
    if (touch && h) {
      d.timer = window.setTimeout(() => {
        if (this.down !== d || this.drag) return;
        d.held = true;
        this.inspect = h;
      }, 400);
    }
    this.down = d;
  }

  pointerUp(x: number, y: number): void {
    const d = this.down;
    this.down = null;
    if (!d) return;
    clearTimeout(d.timer);
    if (this.drag) { this.drop(x, y); this.drag = null; return; }
    if (d.held) { this.inspect = null; return; }
    if (!d.dead) this.clickAt(d.x, d.y);
  }

  pointerCancel(): void {
    if (this.down) clearTimeout(this.down.timer);
    this.down = null;
    this.inspect = null;
    if (this.drag) { this.drag = null; this.armed = null; this.pendingSlot = null; }
  }

  private startDrag(d: NonNullable<Match['down']>): void {
    const iid = d.hot!.id;
    if (this.menu || this.panel || !this.myTurn || this.s.phase === 'mulligan') return;
    const playable = this.acts().some((a) => a.type === 'play' && a.iid === iid);
    if (!playable) {
      this.note = whyNotPlay(this.s, 0, iid) ?? 'That card cannot be played now.';
      d.dead = true;
      return;
    }
    this.armed = { iid, path: [] };
    this.picked = null;
    this.pendingSlot = null;
    this.preferredReplace = null;
    this.note = '';
    this.inspect = null;
    this.drag = { iid, x: d.x, y: d.y };
  }

  /** Each of a Line's units by display column (see slots), filling any unplaced unit into the first open column. */
  private baseCols(v: GameState, seat: Seat): Map<string, number> {
    const out = new Map<string, number>();
    const taken = new Set<number>();
    const line = v.players[seat].line;
    for (const u of line) {
      const c = this.slots.get(u.iid);
      if (c !== undefined && c >= 0 && c < LIMITS.line && !taken.has(c)) { out.set(u.iid, c); taken.add(c); }
    }
    let changed = false;
    for (const u of line) {
      if (out.has(u.iid)) continue;
      let c = 0;
      while (taken.has(c)) c++;
      out.set(u.iid, c);
      taken.add(c);
      this.slots.set(u.iid, c);
      changed = true;
    }
    if (changed) this.saveSlots();
    return out;
  }

  /** The column a unit dropped at x, y would take: the open slot under it, or the nearest open one. */
  private dropCol(x: number): number | null {
    const v = this.s;
    if (v.players[0].line.length >= LIMITS.line) return null;
    const used = new Set(this.baseCols(v, 0).values());
    const sg = slotGeo();
    let best: number | null = null, bestD = Infinity;
    for (let c = 0; c < LIMITS.line; c++) {
      if (used.has(c)) continue;
      const d = Math.abs(sg.x0 + c * sg.dx + sg.w / 2 - x);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /** A dragged card is let go. Back over the hand cancels; a unit takes the slot it was dropped on; a tactic its target. */
  private drop(x: number, y: number): void {
    const iid = this.drag!.iid;
    if (!this.armed || this.armed.iid !== iid) return;
    if (y >= HAND_Y - 8) { this.armed = null; return; }
    const d = def(this.cardOf(iid));
    const h = this.hit(x, y);
    if (d.type !== 'glyph') {
      if (this.s.players[0].line.length >= LIMITS.line) {
        // a full Line: dropping on one of your units chooses it to be scrapped, and the new unit takes its place
        if (h?.kind === 'unit' && this.s.players[0].line.some((u) => u.iid === h.id)) {
          this.preferredReplace = h.id;
          this.pendingSlot = this.baseCols(this.s, 0).get(h.id) ?? null;
        }
      } else this.pendingSlot = this.dropCol(x);
      this.advance();
      return;
    }
    const next = this.nextChoices();
    if (h && next.has(h.id)) { this.armed.path.push(h.id); this.advance(); }
    else if (next.size === 0) this.press('play');
    // otherwise it stays chosen and the prompt asks for its target
  }

  private hit(x: number, y: number): Hot | null {
    for (let i = this.hots.length - 1; i >= 0; i--) {
      const h = this.hots[i];
      if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h;
    }
    return null;
  }

  private clickAt(x: number, y: number): void {
    const h = this.hit(x, y);
    if (!h) {
      if (this.armed || this.picked) { this.armed = null; this.picked = null; }
      return;
    }
    if (h.kind === 'button') this.press(h.id);
    else if (this.menu || this.panel) return;
    else if (h.kind === 'hand') this.clickHand(h.id);
    else if (h.kind === 'unit' || h.kind === 'spire' || h.kind === 'stack') this.clickObject(h.id);
  }

  /** Mouse wheel: scrolls the log drawer or an open viewer. */
  wheel(dy: number, x: number, _y: number): void {
    const step = Math.sign(dy) * Math.max(1, Math.round(Math.abs(dy) / 30));
    if (this.panel) this.scroll = Math.max(0, this.scroll + Math.sign(step));
    else if (this.drawer && x >= HW - drawerW()) this.drawerScroll = Math.max(0, this.drawerScroll - step);
  }

  key(code: string): void {
    if (this.panel) {
      if (code === 'Escape') { if (this.peek) this.peek = null; else this.panel = null; }
      else if (code === 'ArrowUp' || code === 'PageUp') this.scroll = Math.max(0, this.scroll - (code === 'PageUp' ? 3 : 1));
      else if (code === 'ArrowDown' || code === 'PageDown') this.scroll += code === 'PageDown' ? 3 : 1;
      return;
    }
    if (code === 'KeyL') { this.drawer = !this.drawer; this.drawerScroll = 0; return; }
    if (this.drawer && (code === 'PageUp' || code === 'PageDown')) {
      this.drawerScroll = Math.max(0, this.drawerScroll + (code === 'PageUp' ? 20 : -20));
      return;
    }
    if (code === 'Escape') {
      if (this.drawer) { this.drawer = false; return; }
      if (this.armed || this.picked) { this.armed = null; this.picked = null; }
      else this.menu = !this.menu;
      return;
    }
    if (this.menu) return;
    const btns = this.buttons().filter((b) => b.enabled);
    if ((code === 'Enter' || code === 'Space') && btns.length) {
      const pick = btns.find((b) => b.id === 'play') ?? btns.find((b) => b.id === 'pass' || b.id === 'attack' || b.id === 'blocks' || b.id === 'mulligan') ?? btns[0];
      this.press(pick.id);
    }
  }

  // ---------- drawing (PLAN D25: smooth panels, real type, rounded cards over the battlefield art) ----------

  draw(g: Gfx, t: number): void {
    this.hots = [];
    const v = view(this.s, 0);
    const bg = field(FACTIONS.find((f) => f.engine === def(v.players[0].heroes[0] ?? v.players[0].deckList[0]).faction)?.field ?? 'vaskor');
    if (bg) drawCover(g, bg, HW, HH);
    else g.rect(0, 0, HW, HH, 'duskZenith');
    g.wash(0, 0, HW, HH, 'ink', 0.42);

    this.lastT = t;
    this.fx.ambient(g, t, HW, HH);
    const onLine = new Set([...v.players[0].line, ...v.players[1].line].map((u) => u.iid));
    let pruned = false;
    for (const k of [...this.slots.keys()]) if (!onLine.has(k)) { this.slots.delete(k); pruned = true; }
    if (pruned) this.saveSlots();
    this.spawnFx(v, t);
    const [sx, sy] = this.fx.screen(t);
    g.ctx.save();
    g.ctx.translate(sx, sy);
    this.drawMiddle(g, v, t);
    this.fx.drawUnder(g, t, HW);
    this.drawLine(g, v, 1, FOE_LINE_Y, t);
    this.drawLine(g, v, 0, MY_LINE_Y, t);
    this.drawTop(g, v);
    this.drawCombat(g, v, t);
    this.drawPiles(g, v);
    this.drawHand(g, v, t);
    this.drawDial(g, v, 1, t);
    this.drawDial(g, v, 0, t);
    this.fx.draw(g, t, HW, HH);
    g.ctx.restore();
    if (v.phase === 'over') this.drawOver(g, v);
    this.drawButtons(g);
    this.drawerT += ((this.drawer ? 1 : 0) - this.drawerT) * 0.3;
    if (Math.abs(this.drawerT - (this.drawer ? 1 : 0)) < 0.01) this.drawerT = this.drawer ? 1 : 0;
    if (this.drawerT > 0) this.drawDrawer(g, v);
    if (this.drag) this.drawDragged(g, v, t);
    const look = this.inspect ?? (this.drag || this.down?.touch ? null : this.hover);
    if (this.panel) this.drawPanel(g, v);
    else if (look && !this.menu && v.phase !== 'over') this.drawDetail(g, v, look);
    else this.zoom = { key: '', k: 0 };
    if (this.menu) this.drawMenu(g);
  }

  /** A crystal gem: the thing each side defends (PLAN D24). */
  private gem(g: Gfx, cx: number, cy: number, r: number, hurt: boolean): void {
    const ctx = g.ctx;
    ctx.save();
    ctx.shadowColor = rgba(hurt ? 'emberBright' : 'crystalBright', 0.8);
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.62, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.55);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.55);
    ctx.lineTo(cx - r * 0.62, cy - r * 0.35);
    ctx.closePath();
    const gr = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gr.addColorStop(0, PALETTE[hurt ? 'emberGlow' : 'crystalWhite']);
    gr.addColorStop(0.45, PALETTE[hurt ? 'emberBright' : 'crystalBright']);
    gr.addColorStop(1, PALETTE[hurt ? 'emberDeep' : 'crystalDark']);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = rgba('ink', 0.8);
    ctx.stroke();
    // a facet line
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy - r * 0.35);
    ctx.lineTo(cx, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.62, cy - r * 0.35);
    ctx.moveTo(cx, cy - r * 0.05);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = rgba('crystalWhite', 0.45);
    ctx.stroke();
    ctx.restore();
  }

  /** A round stat badge: power in brass, health in iron (ember when hurt). */
  private badge(g: Gfx, cx: number, cy: number, value: number, kind: 'power' | 'health' | 'hurt' | 'cost' | 'costMod'): void {
    const ctx = g.ctx;
    const r = 6.5;
    const ramp: Record<typeof kind, [Ink, Ink]> = {
      power: ['brassLight', 'brassDark'], health: ['iron', 'ironNight'], hurt: ['ember', 'emberNight'],
      cost: ['crystal', 'crystalDeep'], costMod: ['crystalBright', 'crystalDark'],
    };
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
    ctx.strokeStyle = PALETTE[kind === 'power' ? 'brassGlint' : kind === 'cost' || kind === 'costMod' ? 'crystalWhite' : 'steam'];
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.restore();
    const s = String(value);
    drawTextCentred(g, s, cx, cy - 3.6, { color: kind === 'power' ? 'ink' : 'steamWhite', face: 'bold', scale: 1.05, shadow: kind === 'power' ? undefined : 'ink' });
  }

  /** The top corners: MENU and LOG at the left with the foe's heroes under them; the foe's hand and piles. */
  private drawTop(g: Gfx, v: GameState): void {
    let x = 6;
    for (const [id, label] of [['menu', 'MENU'], ['log', 'LOG']] as const) {
      const w = textWidth(label, 0.9, 'display') + 14;
      button(g, label, x, 4, { w, h: 14, state: this.hover?.id === id ? 'hot' : 'on' });
      this.hots.push({ x, y: 4, w, h: 14, id, kind: 'button' });
      x += w + 5;
    }
    this.drawFoeHand(g, v);
    this.heroChips(g, v, 1, 6, 23, false);
    this.heroChips(g, v, 0, 6, MY_LINE_Y + SLOT.h + 5, false);
  }

  /** Hero progress chips (R-H3, open information): a short name and Ascension progress; click for the card. */
  private heroChips(g: Gfx, v: GameState, seat: Seat, x: number, y: number, right: boolean): void {
    const p = v.players[seat];
    const maxX = HW / 2 - (seat === 0 ? DIAL_GAP : FOE_DIAL.r + 70);
    // campaign Orders (spec 21 R-X6), open information: hover or hold to read them; drawn first so it always fits
    const orders = p.orders ?? [];
    if (orders.length) {
      const label = `Orders ${orders.length}`;
      const ow = textWidth(label, 0.85, 'bold') + 12;
      fillRound(g, x, y, ow, 12, 'brassShadow', 0.8, 6);
      frame(g, x, y, ow, 12, this.hover?.id === `orders${seat}` ? 'brassGlint' : 'brassDark', 6, false);
      drawText(g, label, x + 6, y + 2.5, { color: 'brassGlint', face: 'bold', scale: 0.85 });
      this.hots.push({ x, y, w: ow, h: 12, id: `orders${seat}`, kind: 'orders' });
      x += ow + 4;
    }
    for (const h of p.heroes) {
      const d = def(h);
      const asc = p.ascended.includes(h);
      const lv = d.level;
      const have = lv ? (lv.who === 'you' ? p.seen[lv.stat] ?? 0 : 0) : 0;
      const words = face(v, seat, h).name.split(',')[0].split(' ');
      const short = (words.length > 2 ? words.slice(1) : words).join(' ');
      const label = `${short} ${asc ? 'ascended' : lv ? `${Math.min(have, lv.n)}/${lv.n}` : ''}`.trim();
      const w = textWidth(label, 0.85) + 12;
      if (x + w > maxX) break;
      const hot = this.hover?.id === h;
      fillRound(g, x, y, w, 12, asc ? 'brassShadow' : 'ink', 0.75, 6);
      frame(g, x, y, w, 12, hot || asc ? 'brassGlint' : seat === 0 ? 'brassDark' : 'emberDeep', 6, asc);
      drawText(g, label, x + 6, y + 2.5, { color: asc ? 'brassGlint' : 'steam', scale: 0.85 });
      this.hots.push({ x, y, w, h: 12, id: h, kind: 'hero' });
      x += w + 4;
    }
    void right;
  }

  /** Charge and Reserve a card in my hand would spend: a tactic spends Reserve first, then Charge (R-C2). */
  private costPreview(v: GameState): { charge: number; reserve: number } | null {
    const iid = this.drag?.iid ?? this.armed?.iid ?? (this.hover?.kind === 'hand' && !this.down?.touch ? this.hover.id : null);
    if (!iid) return null;
    const h = v.players[0].hand.find((x) => x.iid === iid);
    if (!h) return null;
    const cost = costOf(this.s, 0, h.card);
    const p = v.players[0];
    if (def(h.card).type === 'glyph') {
      const r = Math.min(p.reserve, cost);
      return { reserve: r, charge: Math.min(p.charge, cost - r) };
    }
    return { reserve: 0, charge: Math.min(p.charge, cost) };
  }

  /** Segment levels shown on each dial, easing toward the engine's numbers so spends drain and refills light up. */
  private seg: number[][] = [Array(LIMITS.maxCharge).fill(-1), Array(LIMITS.maxCharge).fill(-1)];
  private res: number[][] = [Array(LIMITS.reserve).fill(-1), Array(LIMITS.reserve).fill(-1)];
  private shownSpire: number[] = [-1, -1];
  private hubFlash: number[] = [0, 0];

  /**
   * A player's dial (PLAN D37). Hub: the Crystal (its number; ember at 5 or less; the target for Crystal cards).
   * Outer ring: ten Charge segments (lit = left this round, dim = spent, dark = not yet unlocked, R-C1).
   * Inner ring: three Reserve arcs (R-C4). A brass clock hand beside the dial marks the Initiative.
   */
  private drawDial(g: Gfx, v: GameState, seat: Seat, t: number): void {
    const p = v.players[seat];
    const D = seat === 0 ? MY_DIAL : FOE_DIAL;
    const cx = HW / 2, cy = D.y, r = D.r;
    const ctx = g.ctx;
    const foe = seat === 1;
    const preview = seat === 0 ? this.costPreview(v) : null;
    const pulse = 0.5 + 0.5 * Math.sin(t / 4);
    // backing disc and brass rim
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ironNight;
    ctx.fill();
    ctx.restore();
    const rim = ctx.createLinearGradient(0, cy - r - 8, 0, cy + r + 8);
    rim.addColorStop(0, PALETTE.brassGlint);
    rim.addColorStop(0.5, PALETTE.brass);
    rim.addColorStop(1, PALETTE.brassDark);
    ctx.lineWidth = 3;
    ctx.strokeStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    // Charge: ten segments, easing toward lit (1), spent (0.35) or locked (0)
    const n = LIMITS.maxCharge;
    const lit: Ink = foe ? 'emberGlow' : 'brassLight';
    for (let i = 0; i < n; i++) {
      const target = i < p.charge ? 1 : i < p.maxCharge ? 0.35 : 0;
      const cur = this.seg[seat][i] < 0 ? target : this.seg[seat][i];
      const next = Math.abs(target - cur) < 0.02 ? target : cur + (target - cur) * 0.14;
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n + 0.07, a1 = a0 + (2 * Math.PI) / n - 0.14;
      if (cur > 0.9 && target < 0.5) {
        // a spent segment lets off a puff of sparks
        this.fx.burst(cx + Math.cos((a0 + a1) / 2) * r, cy + Math.sin((a0 + a1) / 2) * r, [lit, 'steamWhite'], 6, t, { speed: 1.6, life: 18, size: 1.4 });
      } else if (cur >= 0 && cur < 0.5 && target === 1 && this.seg[seat][i] >= 0) {
        this.fx.burst(cx + Math.cos((a0 + a1) / 2) * r, cy + Math.sin((a0 + a1) / 2) * r, [lit], 4, t + i * 2, { speed: 1, life: 16, size: 1.2 });
      }
      this.seg[seat][i] = next;
      const spend = preview && i >= p.charge - preview.charge && i < p.charge;
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.lineWidth = foe ? 7 : 8;
      if (next <= 0.01) ctx.strokeStyle = PALETTE.ironDark;
      else if (next < 0.6) ctx.strokeStyle = rgba('brassShadow', 1);
      else ctx.strokeStyle = PALETTE[lit];
      if (spend) ctx.strokeStyle = rgba('steamWhite', 0.55 + 0.45 * pulse);
      if (next >= 0.6 || spend) {
        ctx.shadowColor = rgba(spend ? 'steamWhite' : lit, 0.9);
        ctx.shadowBlur = 6;
      }
      ctx.globalAlpha = next <= 0.01 ? 1 : Math.max(0.55, Math.min(1, next));
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
      ctx.restore();
      if (next > 0.01 && next < 0.6) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba('brass', 0.55);
        ctx.beginPath();
        ctx.arc(cx, cy, r + (foe ? 3.5 : 4), a0, a1);
        ctx.stroke();
        ctx.restore();
      }
    }
    // Reserve: three arcs inside the Charge ring
    const rr = r - (foe ? 7 : 8);
    for (let i = 0; i < LIMITS.reserve; i++) {
      const target = i < p.reserve ? 1 : 0;
      const cur = this.res[seat][i] < 0 ? target : this.res[seat][i];
      const next = Math.abs(target - cur) < 0.02 ? target : cur + (target - cur) * 0.1;
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.16, a1 = a0 + (2 * Math.PI) / 3 - 0.32;
      if (cur < 0.5 && target === 1 && this.res[seat][i] >= 0) {
        this.fx.rise(cx + Math.cos((a0 + a1) / 2) * rr, cy + Math.sin((a0 + a1) / 2) * rr, [foe ? 'emberBright' : 'crystalBright'], 5, t, 8);
      }
      this.res[seat][i] = next;
      const spend = preview && i >= p.reserve - preview.reserve && i < p.reserve;
      ctx.save();
      ctx.lineWidth = foe ? 3.5 : 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = PALETTE.ironDark;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a1);
      ctx.stroke();
      if (next > 0.02 || spend) {
        const ink: Ink = foe ? 'emberBright' : 'crystalBright';
        ctx.strokeStyle = spend ? rgba('steamWhite', 0.55 + 0.45 * pulse) : rgba(ink, Math.min(1, next));
        ctx.shadowColor = rgba(spend ? 'steamWhite' : ink, 0.9);
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, a0, a0 + (a1 - a0) * (spend ? 1 : next));
        ctx.stroke();
      }
      ctx.restore();
    }
    // the Crystal at the hub
    const hr = rr - (foe ? 5 : 6);
    if (this.shownSpire[seat] >= 0 && p.spire < this.shownSpire[seat]) this.hubFlash[seat] = 1;
    this.shownSpire[seat] = p.spire;
    this.hubFlash[seat] *= 0.9;
    const low = p.spire <= 5;
    const ramp: [Ink, Ink, Ink] = foe || low ? ['emberGlow', 'ember', 'emberNight'] : ['crystalWhite', 'crystal', 'crystalDeep'];
    ctx.save();
    ctx.shadowColor = rgba(ramp[1], low ? 0.6 + 0.4 * pulse : 0.8);
    ctx.shadowBlur = low ? 8 + 8 * pulse : 8;
    const hg = ctx.createRadialGradient(cx - hr * 0.35, cy - hr * 0.4, hr * 0.1, cx, cy, hr);
    hg.addColorStop(0, PALETTE[ramp[0]]);
    hg.addColorStop(0.5, PALETTE[ramp[1]]);
    hg.addColorStop(1, PALETTE[ramp[2]]);
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
    if (this.hubFlash[seat] > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba('steamWhite', this.hubFlash[seat] * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // cracks: one more for every three points of damage the Crystal has taken
    const cracks = Math.min(6, Math.floor((LIMITS.spire - p.spire) / 3));
    if (cracks > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, hr, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = rgba('ink', 0.55);
      ctx.lineWidth = 1;
      for (let i = 0; i < cracks; i++) {
        const a = i * 2.3 + seat;
        let px = cx + Math.cos(a) * hr, py = cy + Math.sin(a) * hr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let j = 1; j <= 3; j++) {
          px += (cx - px) * 0.35 + Math.sin(a * 3 + j) * 3;
          py += (cy - py) * 0.35 + Math.cos(a * 5 + j) * 3;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = rgba('steamWhite', 0.3);
    ctx.beginPath();
    ctx.ellipse(cx - hr * 0.3, cy - hr * 0.45, hr * 0.34, hr * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    const shake = this.hubFlash[seat] > 0.2 ? Math.sin(t * 2) * 2 * this.hubFlash[seat] : 0;
    drawTextCentred(g, String(p.spire), cx + shake, cy - (foe ? 8 : 10), { color: 'steamWhite', face: 'bold', scale: foe ? 1.55 : 1.85, outline: 'ink' });
    drawTextCentred(g, `${p.charge}/${p.maxCharge}`, cx, cy + (foe ? 4 : 5), { color: foe ? 'emberGlow' : 'brassGlint', face: 'bold', scale: 0.8, outline: 'ink' });
    // a target for "unit or Crystal" cards
    const on = this.nextChoices().has(spireId(seat));
    if (on) frame(g, cx - r - 9, cy - r - 9, 2 * r + 18, 2 * r + 18, 'brassGlint', r + 9, true);
    this.hots.push({ x: cx - r - 8, y: cy - r - 8, w: 2 * r + 16, h: 2 * r + 16, id: spireId(seat), kind: 'spire' });
    // the Initiative: a brass clock hand on the dial's left shoulder, pointing at the hub
    if (v.initiative === seat) {
      const a = Math.PI + (foe ? -0.55 : 0.55);
      const hx = cx + Math.cos(a) * (r + 17), hy = cy + Math.sin(a) * (r + 17);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a - Math.PI / 2);
      ctx.shadowColor = rgba('brassGlint', 0.9);
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 9); ctx.lineTo(4.5, -1); ctx.lineTo(0, -6); ctx.lineTo(-4.5, -1);
      ctx.closePath();
      ctx.fillStyle = PALETTE.brassGlint;
      ctx.fill();
      ctx.restore();
      this.hots.push({ x: hx - 7, y: hy - 7, w: 14, h: 14, id: 'initiative', kind: 'button' });
    }
  }

  /** A dial explained, for a mouse over it or a held finger: every number on it, from the engine. */
  private drawDialInfo(g: Gfx, v: GameState, seat: Seat): void {
    const p = v.players[seat];
    const rows: [string, string][] = [
      ['Crystal', `${p.spire} of ${LIMITS.spire}`],
      ['Charge', `${p.charge} left of ${p.maxCharge} (rises by 1 a round, up to ${LIMITS.maxCharge})`],
      ['Reserve', `${p.reserve} of ${LIMITS.reserve} (unspent Charge kept from last round; tactics spend it first)`],
      ['Hand', String(p.hand.length)], ['Deck', String(p.deck.length)], ['Scrap', String(p.scrap.length)],
    ];
    if (v.initiative === seat) rows.push(['Initiative', 'acts first this round']);
    const w = 250;
    const lines = rows.flatMap(([k, val]) => wrapPx(val, w - 70, 0.9).map((l, i) => [i === 0 ? k : '', l] as [string, string]));
    const h = 24 + lines.length * 10 + 4;
    const x = Math.round(HW / 2 + (seat === 0 ? MY_DIAL.r : FOE_DIAL.r) + 18);
    const y = seat === 0 ? MY_DIAL.y - h + 10 : FOE_DIAL.y - 10;
    panel(g, Math.min(x, HW - w - 4), y, w, h, { tone: 'dark' });
    const px = Math.min(x, HW - w - 4);
    drawText(g, seat === 0 ? 'YOUR CRYSTAL' : "THE FOE'S CRYSTAL", px + 8, y + 7, { color: seat === 0 ? 'brassGlint' : 'emberGlow', face: 'display' });
    lines.forEach(([k, val], i) => {
      if (k) drawText(g, k, px + 8, y + 22 + i * 10, { color: 'ironLight', scale: 0.9 });
      drawText(g, val, px + 64, y + 22 + i * 10, { color: 'steamWhite', scale: 0.9 });
    });
  }

  private unitTile(g: Gfx, v: GameState, u: Unit, x: number, y: number, t: number, role: string): void {
    const sw = slotGeo().w;
    const st = stats(v, u);
    const f = face(v, u.owner, u.card);
    const next = this.nextChoices();
    const choosable = next.has(u.iid) || next.has(`R:${u.iid}`) || (this.picked?.mode === 'duel' && u.owner === 1);
    const pulse = 0.5 + 0.5 * Math.sin(t / 6);
    const edge: Ink = choosable ? 'brassGlint' : this.picked?.iid === u.iid ? 'crystalBright' : role ? 'emberGlow' : f.ascended ? 'brassLight' : u.owner === 0 ? 'brassDark' : 'emberDeep';
    const ctx = g.ctx;
    // the card body
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    fillRound(g, x, y, sw, SLOT.h, u.owner === 0 ? 'ironNight' : 'emberNight', 0.95, 4);
    ctx.restore();
    // the art fills the top of the card
    const art = cardArt(u.card, f.ascended);
    const artH = 62;
    const unclip = clipRound(g, x + 1, y + 1, sw - 2, SLOT.h - 2, 3.5);
    if (art) {
      const k = Math.max((sw - 2) / 64, artH / 48);
      const sw0 = (sw - 2) / k, sh0 = artH / k;
      drawPic(g, art, x + 1, y + 1, sw - 2, artH, { x: (64 - sw0) / 2, y: (48 - sh0) / 2, w: sw0, h: sh0 });
    } else g.rect(x + 1, y + 1, sw - 2, artH, 'ironDark');
    // name plate fading up over the art
    const ng = ctx.createLinearGradient(0, y + 1, 0, y + 15);
    ng.addColorStop(0, rgba('ink', 0.85));
    ng.addColorStop(1, rgba('ink', 0));
    ctx.fillStyle = ng;
    ctx.fillRect(x + 1, y + 1, sw - 2, 15);
    const lg = ctx.createLinearGradient(0, y + artH - 14, 0, y + artH + 2);
    lg.addColorStop(0, rgba(u.owner === 0 ? 'ironNight' : 'emberNight', 0));
    lg.addColorStop(1, rgba(u.owner === 0 ? 'ironNight' : 'emberNight', 1));
    ctx.fillStyle = lg;
    ctx.fillRect(x + 1, y + artH - 14, sw - 2, 16);
    if (u.stasis) {
      // frozen: a pale frost over the art with crystal cracks and a few drifting flakes
      g.wash(x + 1, y + 1, sw - 2, artH, 'crystalWhite', 0.45);
      ctx.save();
      ctx.strokeStyle = rgba('crystalWhite', 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 8); ctx.lineTo(x + sw * 0.4, y + artH * 0.45); ctx.lineTo(x + sw * 0.3, y + artH - 6);
      ctx.moveTo(x + sw * 0.4, y + artH * 0.45); ctx.lineTo(x + sw - 8, y + artH * 0.3);
      ctx.moveTo(x + sw * 0.7, y + artH * 0.38); ctx.lineTo(x + sw * 0.8, y + artH - 4);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const fy = y + 4 + ((t * 0.4 + i * 13) % (artH - 8));
        ctx.fillStyle = rgba('steamWhite', 0.8);
        ctx.fillRect(x + 6 + ((i * 17) % (sw - 12)), fy, 1.5, 1.5);
      }
      ctx.restore();
      drawTextCentred(g, 'STASIS', x + sw / 2, y + 28, { color: 'crystalDeep', face: 'display' });
    }
    if (u.silenced) {
      // silenced: iron bands across the art
      ctx.save();
      ctx.strokeStyle = rgba('ironLight', 0.75);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y + artH * 0.25); ctx.lineTo(x + sw, y + artH * 0.6);
      ctx.moveTo(x, y + artH * 0.6); ctx.lineTo(x + sw, y + artH * 0.25);
      ctx.stroke();
      ctx.restore();
    }
    if (u.doomed) g.wash(x + 1, y + 1, sw - 2, SLOT.h - 2, 'emberDeep', 0.25 + 0.15 * Math.sin(t / 3));
    if (st.keywords.includes('plated' as never)) {
      // plated: a brass glint that sweeps across now and then
      const k = ((t + u.iid.length * 37) % 150) / 30;
      if (k < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gx = x + (sw + 30) * k - 15;
        const gr = ctx.createLinearGradient(gx - 12, 0, gx + 12, 0);
        gr.addColorStop(0, rgba('brassGlint', 0));
        gr.addColorStop(0.5, rgba('brassGlint', 0.45));
        gr.addColorStop(1, rgba('brassGlint', 0));
        ctx.fillStyle = gr;
        ctx.fillRect(x, y, sw, artH);
        ctx.restore();
      }
    }
    unclip();
    drawText(g, fitText(f.name, sw - 8, 0.95, 'bold'), x + 4, y + 3.5, { color: 'steamWhite', face: 'bold', scale: 0.95, shadow: 'ink' });
    if (u.ward) {
      // a Ward: a shimmering bubble over the card
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = 0.35 + 0.2 * Math.sin(t / 9 + u.iid.length);
      ctx.strokeStyle = rgba('crystalBright', a + 0.25);
      ctx.shadowColor = rgba('crystalBright', 0.9);
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + sw / 2, y + SLOT.h / 2, sw / 2 + 3, SLOT.h / 2 + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      const hg = ctx.createRadialGradient(x + sw * 0.3, y + SLOT.h * 0.25, 2, x + sw / 2, y + SLOT.h / 2, sw * 0.8);
      hg.addColorStop(0, rgba('crystalWhite', 0.22 * a));
      hg.addColorStop(1, rgba('crystalBright', 0));
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.restore();
    }
    const kws = st.keywords.map((k) => KEYWORD_HELP[k].name).join(' · ');
    if (kws) drawText(g, fitText(kws, sw - 8, 0.85), x + 4, y + artH + 2, { color: 'crystalBright', scale: 0.85 });
    if (role) drawText(g, role, x + 4, y + artH + 12, { color: 'emberGlow', face: 'bold', scale: 0.85 });
    if (u.silenced) drawTextCentred(g, 'silenced', x + sw / 2, y + SLOT.h - 13, { color: 'ironLight', scale: 0.85 });
    // attackers smoulder while combat is on
    if (role.startsWith('Attack') && t % 3 === 0) this.fx.burst(x + 6 + ((t * 7) % (sw - 12)), y + SLOT.h - 4, ['emberBright', 'emberGlow'], 1, t, { speed: 0.5, life: 22, size: 1.4, grav: -0.06 });
    if (this.armed?.path.includes(`R:${u.iid}`)) {
      g.wash(x + 1, y + 1, sw - 2, SLOT.h - 2, 'emberNight', 0.55);
      drawTextCentred(g, 'SCRAP', x + sw / 2, y + 30, { color: 'emberGlow', face: 'display', scale: 1.3, outline: 'ink', glow: 'ember' });
    }
    this.badge(g, x + 10, y + SLOT.h - 10, st.power, 'power');
    this.badge(g, x + sw - 10, y + SLOT.h - 10, st.hp, st.hp < st.health ? 'hurt' : 'health');
    frame(g, x, y, sw, SLOT.h, edge, 4, choosable || role !== '' || this.picked?.iid === u.iid);
    if (choosable && pulse > 0.5) frame(g, x - 1.5, y - 1.5, sw + 3, SLOT.h + 3, 'brassGlint', 5, true);
    this.hots.push({ x, y, w: sw, h: SLOT.h, id: u.iid, kind: 'unit' });
    this.pos.set(u.iid, [x + sw / 2, y + SLOT.h / 2]);
  }

  private roleOf(v: GameState, u: Unit): string {
    const c = v.combat;
    if (!c) return '';
    const pr = c.pairs.find((p) => p.att === u.iid);
    if (pr) return `Attack ${c.pairs.indexOf(pr) + 1}`;
    const bl = c.pairs.find((p) => p.blk === u.iid);
    if (bl) return `Block ${c.pairs.indexOf(bl) + 1}`;
    return '';
  }

  /**
   * Which column each unit of a Line is drawn in. Outside combat a unit sits in its own slot. In combat attackers
   * keep their column and step forward; each blocker moves to the column of the attacker it blocks and steps forward
   * to meet it; the other defenders fill the free columns in order. Display only: the engine's Line is unchanged.
   */
  private columns(v: GameState, seat: Seat): Map<string, { col: number; out: boolean }> {
    const line = v.players[seat].line;
    const out = new Map<string, { col: number; out: boolean }>();
    const c = v.combat;
    const base = this.baseCols(v, seat);
    if (!c || c.pairs.length === 0) {
      for (const u of line) out.set(u.iid, { col: base.get(u.iid)!, out: false });
      return out;
    }
    if (c.attacker === seat) {
      const att = new Set(c.pairs.map((p) => p.att));
      for (const u of line) out.set(u.iid, { col: base.get(u.iid)!, out: att.has(u.iid) });
      return out;
    }
    const foeBase = this.baseCols(v, c.attacker);
    const taken = new Set<number>();
    for (const p of c.pairs) {
      if (!p.blk || !line.some((u) => u.iid === p.blk)) continue;
      const col = foeBase.get(p.att);
      if (col === undefined || taken.has(col)) continue;
      out.set(p.blk, { col, out: true });
      taken.add(col);
    }
    // the others keep their own slot unless a blocker took it; those pushed aside take the nearest open slot
    const moved: Unit[] = [];
    for (const u of line) {
      if (out.has(u.iid)) continue;
      const b = base.get(u.iid)!;
      if (taken.has(b)) moved.push(u);
      else { out.set(u.iid, { col: b, out: false }); taken.add(b); }
    }
    for (const u of moved) {
      const b = base.get(u.iid)!;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < LIMITS.line; i++) if (!taken.has(i) && Math.abs(i - b) < bestD) { bestD = Math.abs(i - b); best = i; }
      out.set(u.iid, { col: best, out: false });
      taken.add(best);
    }
    return out;
  }

  private drawLine(g: Gfx, v: GameState, seat: Seat, y: number, t: number): void {
    const line = v.players[seat].line;
    const sg = slotGeo();
    const cols = this.columns(v, seat);
    const used = new Set([...cols.values()].map((c) => c.col));
    for (let i = 0; i < LIMITS.line; i++) {
      if (used.has(i)) continue;
      const x = Math.round(sg.x0 + i * sg.dx);
      fillRound(g, x, y, sg.w, SLOT.h, 'ink', 0.35, 4);
      g.ctx.save();
      g.ctx.setLineDash([3, 3]);
      frame(g, x + 1, y + 1, sg.w - 2, SLOT.h - 2, seat === 0 ? 'brassShadow' : 'emberNight', 4);
      g.ctx.restore();
    }
    // units that stepped out are drawn last, over their neighbours
    const order = [...line].sort((a, b) => Number(cols.get(a.iid)!.out) - Number(cols.get(b.iid)!.out));
    for (const u of order) {
      const c = cols.get(u.iid)!;
      const tx = sg.x0 + c.col * sg.dx;
      const ty = y + (c.out ? (seat === 0 ? -LUNGE : LUNGE) : 0);
      const arr = this.arrive.get(u.iid);
      if (arr) {
        if (t < arr.born) continue; // its summon has not played yet
        // it flies in from its owner's hand and lands with a ring and a puff of steam
        const o = this.sideOrigin(seat);
        this.at.set(u.iid, [o[0] - sg.w / 2, o[1] - SLOT.h / 2]);
        const cx = tx + sg.w / 2, cy = ty + SLOT.h / 2;
        const ink: Ink = seat === 0 ? 'crystalBright' : 'emberGlow';
        this.fx.ring(cx, cy, ink, t + 12, 10, 62, 24, 3);
        this.fx.burst(cx, ty + SLOT.h, ['steam', 'steamWhite'], 14, t + 12, { speed: 2.2, life: 26, size: 2.2, grav: -0.02, shape: 'dot', spread: sg.w });
        this.fx.flash(tx, ty, sg.w, SLOT.h, ink, t + 12, 18);
        this.fx.rune(cx, ty + SLOT.h - 4, sg.w * 0.62, ink, t + 6, 44);
        if (def(u.card).type === 'hero') {
          // a hero takes the field: a pillar of light, a gold rune and their name across the board
          this.fx.column(cx, 'brassGlint', t + 8, 56);
          this.fx.rune(cx, ty + SLOT.h - 4, sg.w * 0.9, 'brassGlint', t + 10, 56);
          this.fx.flashScreen('brassGlint', 0.18, t + 12, 10);
          this.fx.banner(this.name(u.card, seat), seat === 0 ? 'Your hero takes the field' : "The foe's hero takes the field", 'brassGlint', t + 4, cardArt(u.card, false), (MID_Y + MY_LINE_Y) / 2 - 4, 60);
          this.fx.shake(2.5, t + 12, 14);
        }
        this.arrive.delete(u.iid);
      }
      const cur = this.at.get(u.iid) ?? [tx, ty];
      const nx = Math.abs(tx - cur[0]) < 0.5 ? tx : cur[0] + (tx - cur[0]) * 0.25;
      const ny = Math.abs(ty - cur[1]) < 0.5 ? ty : cur[1] + (ty - cur[1]) * 0.25;
      this.at.set(u.iid, [nx, ny]);
      const [jx, jy] = this.fx.offset(u.iid, t);
      this.unitTile(g, v, u, Math.round(nx + jx), Math.round(ny + jy), t, this.roleOf(v, u));
    }
  }

  /** The strip between the Lines: the prompt, then the stack (or the round) on the left and the buttons on the right. */
  private drawMiddle(g: Gfx, v: GameState, t: number): void {
    const ctx = g.ctx;
    const top = MID_Y - 2, h = MY_LINE_Y - MID_Y + 2;
    const gr = ctx.createLinearGradient(0, top, 0, top + h);
    gr.addColorStop(0, rgba('ink', 0.5));
    gr.addColorStop(0.5, rgba('duskZenith', 0.75));
    gr.addColorStop(1, rgba('ink', 0.5));
    ctx.fillStyle = gr;
    ctx.fillRect(0, top, HW, h);
    const pr = this.note || this.prompt();
    const lines = wrapPx(pr, HW - 16, 1, 'bold').slice(0, 2);
    const py = lines.length > 1 ? MID_Y + 2 : MID_Y + 6;
    lines.forEach((l, i) => drawTextCentred(g, l, HW / 2, py + i * 10, { color: this.note ? 'emberGlow' : 'brassGlint', face: 'bold', shadow: 'ink' }));
    // the stack as a row of chips, newest first; the round when it is empty
    const rowY = MID_Y + 22;
    const btnW = this.buttons().reduce((a, b) => a + textWidth(b.label, 1, 'display') + 28, 0);
    const maxX = HW - 8 - btnW - 6;
    let sx = 8;
    if (v.stack.length === 0) {
      drawText(g, `Round ${v.round}`, sx, rowY + 3, { color: 'ironLight', face: 'display' });
    } else {
      drawText(g, 'Stack:', sx, rowY + 3.5, { color: 'ironLight' });
      sx += textWidth('Stack:', 1) + 5;
      const next = this.nextChoices();
      const items = [...v.stack].reverse();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const label = `${it.owner === 0 ? 'You' : 'Foe'}: ${this.name(it.card, it.owner)}`;
        const w = Math.min(textWidth(label, 1) + 28, 168);
        const rest = items.length - i - 1;
        if (sx + w > maxX - (rest ? 26 : 0)) {
          drawText(g, `+${items.length - i}`, sx, rowY + 3.5, { color: 'steam', face: 'bold' });
          break;
        }
        const on = next.has(it.sid);
        if (on) highlight(g, sx, rowY, w, 14, 'brass');
        else fillRound(g, sx, rowY, w, 14, it.owner === 0 ? 'ironNight' : 'emberNight', 0.85, 3);
        frame(g, sx, rowY, w, 14, on ? 'brassGlint' : it.owner === 0 ? 'brassDark' : 'emberDeep', 3);
        // a thumbnail of the card, so a tactic on the stack can be told at a glance
        const art = cardArt(it.card, false);
        if (art) {
          const un = clipRound(g, sx + 2, rowY + 2, 16, 10, 1.5);
          drawPic(g, art, sx + 2, rowY + 2, 16, 10, { x: 0, y: 4, w: 64, h: 40 });
          un();
        }
        drawText(g, fitText(label, w - 26), sx + 22, rowY + 3.5, { color: on ? 'brassGlint' : 'steamWhite' });
        this.hots.push({ x: sx, y: rowY, w, h: 14, id: it.sid, kind: 'stack' });
        sx += w + 4;
      }
    }
    void t;
  }

  /** The foe's hand as card backs to the left of its dial; its Deck and Scrap at the top right. */
  private drawFoeHand(g: Gfx, v: GameState): void {
    const p = v.players[1];
    const n = p.hand.length;
    const bw = 13, bh = 18;
    const right = HW / 2 - FOE_DIAL.r - 26;
    const dx = n > 1 ? Math.min(bw + 2, 140 / (n - 1)) : 0;
    const total = n ? bw + (n - 1) * dx : 0;
    const y = 4;
    let x = right - total;
    for (let i = 0; i < n; i++) {
      this.cardBack(g, x, y, bw, bh);
      x += dx;
    }
    drawTextCentred(g, n ? String(n) : '0', right + 9, y + 4, { color: 'emberGlow', face: 'bold', outline: 'ink' });
    // the foe's Deck and Scrap, small, at the top right
    let rx = HW - 6;
    for (const [id, label, count] of [['scrap1', 'Scrap', p.scrap.length], ['deck1', 'Deck', p.deck.length]] as const) {
      const w = 30, h = 38;
      rx -= w;
      this.pile(g, rx, y + 2, w, h, id === 'scrap1' ? p.scrap[p.scrap.length - 1] ?? null : null, count, label, id, id === 'deck1');
      rx -= 10;
    }
  }

  /**
   * A pile: a little stack of cards with its count, its name under it, a click target. The Deck shows backs; the
   * Scrap shows the face of its newest card (open information).
   */
  private pile(g: Gfx, x: number, y: number, w: number, h: number, topCard: string | null, count: number, label: string, id: string, back: boolean): void {
    const hot = this.hover?.id === id;
    const layers = Math.min(3, count);
    for (let i = layers - 1; i >= 0; i--) {
      const ox = x + i * 2, oy = y - i * 2;
      if (back) this.cardBack(g, ox, oy, w - 4, h - 4, id.endsWith('1'));
      else if (i === 0 && topCard) {
        const art = cardArt(topCard, false);
        fillRound(g, ox, oy, w - 4, h - 4, 'ironNight', 1, 3);
        if (art) {
          const un = clipRound(g, ox + 1, oy + 1, w - 6, h - 6, 2.5);
          const k = Math.max((w - 6) / 64, (h - 6) / 48);
          const sw = (w - 6) / k, sh = (h - 6) / k;
          drawPic(g, art, ox + 1, oy + 1, w - 6, h - 6, { x: (64 - sw) / 2, y: (48 - sh) / 2, w: sw, h: sh });
          un();
        }
        g.wash(ox, oy, w - 4, h - 4, 'ink', 0.35);
        frame(g, ox, oy, w - 4, h - 4, 'ironLight', 3);
      } else this.cardFace(g, ox, oy, w - 4, h - 4);
    }
    if (count === 0) {
      fillRound(g, x, y, w - 4, h - 4, 'ink', 0.45, 3);
      g.ctx.save();
      g.ctx.setLineDash([3, 3]);
      frame(g, x + 0.5, y + 0.5, w - 5, h - 5, 'brassDark', 3);
      g.ctx.restore();
    }
    if (hot) frame(g, x - 2, y - 6, w + 2, h + 6, 'brassGlint', 4, true);
    const cx = x + (w - 4) / 2;
    const big = w > 36;
    fillRound(g, cx - (big ? 13 : 10), y + h / 2 - (big ? 12 : 9), big ? 26 : 20, big ? 15 : 12, 'ink', 0.8, 4);
    drawTextCentred(g, String(count), cx, y + h / 2 - (big ? 10 : 7.5), { color: 'steamWhite', face: 'bold', scale: big ? 1.2 : 0.95 });
    drawTextCentred(g, label.toUpperCase(), cx, y + h + (big ? 2 : 0), { color: hot ? 'brassGlint' : 'ironLight', face: 'display', scale: big ? 0.85 : 0.7, shadow: 'ink' });
    this.hots.push({ x: x - 2, y: y - 6, w: w + 2, h: h + (big ? 18 : 14), id, kind: 'button' });
  }

  /** A face-down card: iron with an ember border and a small crystal in the middle. */
  private cardBack(g: Gfx, x: number, y: number, w: number, h: number, foe = true): void {
    const ctx = g.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 2;
    fillRound(g, x, y, w, h, foe ? 'emberNight' : 'ironNight', 0.97, 2);
    ctx.restore();
    frame(g, x, y, w, h, foe ? 'emberDeep' : 'brassDark', 2);
    frame(g, x + 1.5, y + 1.5, w - 3, h - 3, foe ? 'brassShadow' : 'crystalDeep', 1.5);
    this.gem(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.28, foe);
  }

  /** A face-up pile marker (the Scrap): a pale card with lines of text. */
  private cardFace(g: Gfx, x: number, y: number, w: number, h: number): void {
    fillRound(g, x, y, w, h, 'iron', 0.95, 2);
    frame(g, x, y, w, h, 'ironNight', 2);
    for (let i = 0; i < 3; i++) g.rect(x + 2, y + 3 + i * (h / 4), w - 4, 1, 'ironNight');
  }

  /** My Deck at the far left of the hand row and my Scrap at the far right (PLAN D37); click to look inside. */
  private drawPiles(g: Gfx, v: GameState): void {
    const p = v.players[0];
    const y = HAND_Y + 12;
    this.pile(g, 6, y, PILE.w, PILE.h, null, p.deck.length, 'Deck', 'deck0', true);
    this.pile(g, HW - 6 - PILE.w, y, PILE.w, PILE.h, p.scrap[p.scrap.length - 1] ?? null, p.scrap.length, 'Scrap', 'scrap0', false);
  }

  private drawHand(g: Gfx, v: GameState, _t: number): void {
    const p = v.players[0];
    const acts = this.acts();
    const cg = handGeo(p.hand.length);
    const cw = cg.w;
    // the card under the pointer (or the armed one) is drawn last, lifted, so an overlapped hand can still be read
    const top = p.hand.findIndex((h) => h.iid === (this.armed?.iid ?? (this.hover?.kind === 'hand' ? this.hover.id : '')));
    const order = p.hand.map((_, i) => i);
    if (top >= 0) { order.splice(top, 1); order.push(top); }
    for (const i of order) {
      const h = p.hand[i];
      const x = cg.xs[i];
      const land = this.incoming.get(h.iid);
      if (land !== undefined) {
        if (_t < land) continue;
        this.incoming.delete(h.iid);
      }
      const armed = this.armed?.iid === h.iid;
      if (this.drag?.iid === h.iid) {
        // its place in the hand stays marked while it is carried
        g.ctx.save();
        g.ctx.setLineDash([3, 3]);
        frame(g, x, HAND_Y, cw, CARD.h, 'crystalBright', 4);
        g.ctx.restore();
        continue;
      }
      const y = HAND_Y - (armed ? 6 : i === top ? 4 : 0);
      const playable = acts.some((a) => (a.type === 'play' || a.type === 'channel') && a.iid === h.iid);
      const marked = this.mull.has(h.iid);
      const edge: Ink = armed ? 'crystalBright' : marked ? 'emberBright' : playable ? 'brassLight' : 'ink';
      this.handCard(g, v, h.card, x, y, cw, edge, armed, marked);
      this.hots.push({ x, y, w: cw, h: CARD.h, id: h.iid, kind: 'hand' });
    }
    if (p.hand.length === 0) drawTextCentred(g, 'Your hand is empty', HW / 4 + 20, HAND_Y + 40, { color: 'ironLight' });
  }

  /** One hand card's face at x, y (in the hand, or carried by a drag). */
  private handCard(g: Gfx, v: GameState, card: string, x: number, y: number, cw: number, edge: Ink, glow: boolean, marked: boolean): void {
    const ctx = g.ctx;
    const d = def(card);
    const f = face(v, 0, card);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    fillRound(g, x, y, cw, CARD.h, d.type === 'glyph' ? 'duskHigh' : 'ironNight', 0.97, 4);
    ctx.restore();
    const art = cardArt(card, f.ascended);
    const artH = 56;
    const unclip = clipRound(g, x + 1, y + 1, cw - 2, CARD.h - 2, 3.5);
    if (art) {
      const k = Math.max((cw - 2) / 64, artH / 48);
      const sw0 = (cw - 2) / k, sh0 = artH / k;
      drawPic(g, art, x + 1, y + 1, cw - 2, artH, { x: (64 - sw0) / 2, y: (48 - sh0) / 2, w: sw0, h: sh0 });
    }
    const lg = ctx.createLinearGradient(0, y + artH - 12, 0, y + artH + 2);
    lg.addColorStop(0, rgba(d.type === 'glyph' ? 'duskHigh' : 'ironNight', 0));
    lg.addColorStop(1, rgba(d.type === 'glyph' ? 'duskHigh' : 'ironNight', 1));
    ctx.fillStyle = lg;
    ctx.fillRect(x + 1, y + artH - 12, cw - 2, 14);
    if (marked) g.wash(x + 1, y + 1, cw - 2, CARD.h - 2, 'emberNight', 0.55);
    unclip();
    const cost = costOf(this.s, 0, card);
    this.badge(g, x + 8.5, y + 8.5, cost, cost === d.cost ? 'cost' : 'costMod');
    const tag = d.type === 'glyph' ? (d.speed ?? '') : d.type === 'hero' ? 'hero' : '';
    if (tag) {
      const tw = textWidth(tag, 0.8) + 6;
      fillRound(g, x + cw - tw - 3, y + 3, tw, 9, 'ink', 0.75, 3);
      drawText(g, tag, x + cw - tw, y + 4.5, { color: d.type === 'hero' ? 'brassGlint' : 'crystalBright', scale: 0.8 });
    }
    // a name whose longest word does not fit is set smaller rather than broken mid-word
    const ns = f.name.split(' ').some((wd) => textWidth(wd, 0.95, 'bold') > cw - 7) ? 0.8 : 0.95;
    wrapPx(f.name, cw - 7, ns, 'bold').slice(0, 2).forEach((l, j) => drawText(g, l, x + 4, y + artH + 3 + j * 9.5, { color: 'steamWhite', face: 'bold', scale: ns, shadow: 'ink' }));
    if (d.type !== 'glyph') {
      this.badge(g, x + 9, y + CARD.h - 9, f.power, 'power');
      this.badge(g, x + cw - 9, y + CARD.h - 9, f.health, 'health');
    } else drawText(g, 'tactic', x + 4, y + CARD.h - 12, { color: 'ironLight', scale: 0.85 });
    if (marked) drawTextCentred(g, 'SWAP', x + cw / 2, y + 26, { color: 'emberGlow', face: 'display', outline: 'ink' });
    frame(g, x, y, cw, CARD.h, edge, 4, glow);
  }

  /** The card being dragged follows the pointer; a unit shows the slot it will take, a tactic the target under it. */
  private drawDragged(g: Gfx, v: GameState, t: number): void {
    const dg = this.drag!;
    const card = v.players[0].hand.find((h) => h.iid === dg.iid)?.card;
    if (!card) return;
    const d = def(card);
    const sg = slotGeo();
    const overHand = dg.y >= HAND_Y - 8;
    if (!overHand && d.type !== 'glyph') {
      const col = this.dropCol(dg.x);
      if (col !== null) {
        const x = sg.x0 + col * sg.dx;
        const a = 0.55 + 0.25 * Math.sin(t / 5);
        g.ctx.save();
        g.ctx.globalAlpha = a;
        fillRound(g, x, MY_LINE_Y, sg.w, SLOT.h, 'crystalDeep', 0.6, 4);
        frame(g, x, MY_LINE_Y, sg.w, SLOT.h, 'crystalBright', 4, true);
        g.ctx.restore();
        drawTextCentred(g, 'DEPLOY HERE', x + sg.w / 2, MY_LINE_Y + SLOT.h / 2 - 4, { color: 'crystalWhite', face: 'display', scale: 0.85, outline: 'ink' });
      }
    } else if (!overHand) {
      const h = this.hit(dg.x, dg.y);
      if (h && this.nextChoices().has(h.id)) frame(g, h.x - 2, h.y - 2, h.w + 4, h.h + 4, 'crystalBright', 5, true);
    }
    const cw = handGeo(v.players[0].hand.length).w;
    const k = overHand ? 1 : 1.1;
    g.ctx.save();
    g.ctx.translate(dg.x, dg.y);
    g.ctx.scale(k, k);
    g.ctx.rotate(Math.max(-0.08, Math.min(0.08, (dg.x - (this.down?.x ?? dg.x)) / 900)));
    g.ctx.globalAlpha = overHand ? 0.7 : 0.95;
    g.ctx.shadowColor = rgba('crystalBright', 0.6);
    this.handCard(g, v, card, -cw / 2, -CARD.h / 2, cw, 'crystalBright', true, false);
    g.ctx.restore();
  }

  private drawButtons(g: Gfx): void {
    const btns = this.buttons();
    const over = this.s.phase === 'over';
    const bw = (b: Button) => textWidth(b.label, 1, 'display') + 20;
    // at the end of a battle the buttons sit inside the result panel, centred
    let x = over ? HW / 2 + btns.reduce((a, b) => a + bw(b) + 8, -8) / 2 : HW - 8;
    for (const b of [...btns].reverse()) {
      const w = bw(b);
      x -= w;
      const y = over ? 226 : MID_Y + 21;
      button(g, b.label, x, y, { w, h: 17, state: b.enabled ? (this.hover?.id === b.id ? 'hot' : 'on') : 'off' });
      if (b.enabled) this.hots.push({ x, y, w, h: 17, id: b.id, kind: 'button' });
      x -= 8;
    }
  }

  /**
   * The full card, enlarged where it sits: it grows out of the card under the mouse (or under a held finger) and
   * shrinks away when the pointer leaves or the finger lifts. Hand cards grow upward from the hand.
   */
  /** A side's campaign Orders, each with everything it does (R-X6). */
  private drawOrders(g: Gfx, v: GameState, seat: Seat): void {
    const list = v.players[seat].orders ?? [];
    const w = 230, tw = w - 20;
    const lines = list.map((o) => wrapPx(o.text, tw, 0.95));
    const hgt = 24 + lines.reduce((n, l) => n + 12 + l.length * 10 + 4, 0);
    const x = Math.round(HW / 2 - w / 2), y = seat === 0 ? HH - 60 - hgt : 30;
    panel(g, x, y, w, hgt, { glow: 'brassGlint', studs: false });
    drawText(g, seat === 0 ? 'YOUR ORDERS' : "THE FOE'S ORDERS", x + 10, y + 8, { color: seat === 0 ? 'brassGlint' : 'emberGlow', face: 'display' });
    let ty = y + 22;
    list.forEach((o, i) => {
      drawText(g, o.name, x + 10, ty, { color: 'brassLight', face: 'bold' });
      ty += 12;
      for (const l of lines[i]) { drawText(g, l, x + 10, ty, { color: 'steamWhite', scale: 0.95 }); ty += 10; }
      ty += 4;
    });
  }

  private drawDetail(g: Gfx, v: GameState, h: Hot): void {
    if (h.kind === 'orders') { this.zoom = { key: '', k: 0 }; this.drawOrders(g, v, h.id === 'orders0' ? 0 : 1); return; }
    let cardId: string | null = null;
    let seat: Seat = 0;
    let unit: Unit | undefined;
    if (h.kind === 'hand') cardId = v.players[0].hand.find((x) => x.iid === h.id)?.card ?? null;
    else if (h.kind === 'unit') {
      unit = [...v.players[0].line, ...v.players[1].line].find((u) => u.iid === h.id);
      if (unit) { cardId = unit.card; seat = unit.owner; }
    } else if (h.kind === 'stack') {
      const it = v.stack.find((x) => x.sid === h.id);
      if (it) { cardId = it.card; seat = it.owner; }
    } else if (h.kind === 'hero') {
      cardId = h.id;
      seat = v.players[0].heroes.includes(h.id) ? 0 : 1;
    }
    if (h.kind === 'spire') { this.drawDialInfo(g, v, h.id === spireId(0) ? 0 : 1); return; }
    if (!cardId || cardId === '?') { this.zoom = { key: '', k: 0 }; return; }
    const d = def(cardId);
    const f = face(v, seat, cardId);
    const st = unit ? stats(v, unit) : null;
    // lay the card out first, to know its height
    const w = 168;
    const artW = w - 10, artH = Math.round(artW * 0.75);
    const tw = w - 16;
    const nameLines = wrapPx(f.name, tw - 22, 1.2, 'bold');
    const typeLine = d.type === 'glyph' ? `Tactic, ${d.speed ?? ''}` : d.type === 'hero' ? (f.ascended ? 'Hero, ascended' : 'Hero') : d.token ? 'Token unit' : 'Unit';
    const body: { text: string; ink: Ink; face: 'body' | 'bold'; kw?: string }[] = [];
    for (const l of wrapPx(f.text, tw, 0.95)) body.push({ text: l, ink: 'steamWhite', face: 'body' });
    for (const k of st ? st.keywords : f.keywords) {
      const kw = `${KEYWORD_HELP[k].name}:`;
      wrapPx(`${kw} ${KEYWORD_HELP[k].text}`, tw, 0.9).forEach((l, i) => body.push({ text: l, ink: 'steam', face: 'body', kw: i === 0 ? kw : undefined }));
    }
    if (d.level && !f.ascended) {
      const p = v.players[seat];
      const have = d.level.who === 'you' ? p.seen[d.level.stat] ?? 0 : unit?.seen[d.level.stat] ?? 0;
      for (const l of wrapPx(`Ascends: ${d.level.text} (${Math.min(have, d.level.n)}/${d.level.n})`, tw, 0.9)) body.push({ text: l, ink: 'brassLight', face: 'body' });
    }
    if (unit?.stasis) body.push({ text: 'In Stasis: cannot attack or block', ink: 'crystalWhite', face: 'body' });
    if (st && st.hp < st.health) body.push({ text: `Damaged: ${st.hp} of ${st.health} health`, ink: 'emberGlow', face: 'bold' });
    const hgt = Math.min(HH - 8, 5 + artH + 6 + nameLines.length * 12 + 13 + body.length * 10 + (d.type !== 'glyph' ? 24 : 8));
    // place it over its card, kept on screen; hand cards grow upward
    const cx0 = h.x + h.w / 2, cy0 = h.y + h.h / 2;
    const x = Math.round(Math.max(4, Math.min(HW - w - 4, cx0 - w / 2)));
    const y = Math.round(h.kind === 'hand' ? Math.max(4, Math.min(HH - 4, h.y + h.h + 2) - hgt) : Math.max(4, Math.min(HH - hgt - 4, cy0 - hgt / 2)));
    const key = `${h.kind}:${h.id}`;
    if (this.zoom.key !== key) this.zoom = { key, k: 0 };
    this.zoom.k += (1 - this.zoom.k) * 0.38;
    if (this.zoom.k > 0.995) this.zoom.k = 1;
    const e = 1 - (1 - this.zoom.k) ** 2;
    const sc = Math.min(h.w / w, h.h / hgt) + (1 - Math.min(h.w / w, h.h / hgt)) * e;
    const ctx = g.ctx;
    ctx.save();
    // grow from the card's own place: at full size the card sits at x, y
    const ox = cx0 + (x + w / 2 - cx0) * e, oy = cy0 + (y + hgt / 2 - cy0) * e;
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);
    ctx.translate(-(x + w / 2), -(y + hgt / 2));
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    const ground: Ink = d.type === 'glyph' ? 'duskHigh' : seat === 0 ? 'ironNight' : 'emberNight';
    fillRound(g, x, y, w, hgt, ground, 0.98, 6);
    ctx.shadowColor = 'transparent';
    const art = cardArt(cardId, f.ascended, true);
    const unclip = clipRound(g, x + 5, y + 5, artW, artH, 4);
    if (art) drawPic(g, art, x + 5, y + 5, artW, artH);
    else {
      g.rect(x + 5, y + 5, artW, artH, 'ironDark');
      drawTextCentred(g, isMissing(cardId, f.ascended, true) || !CARD_ART[cardId]?.art ? 'No art' : '…', x + w / 2, y + 5 + artH / 2 - 4, { color: 'iron' });
    }
    unclip();
    frame(g, x + 5, y + 5, artW, artH, 'brassDark', 4);
    const cost = seat === 0 ? costOf(this.s, 0, cardId) : d.cost;
    this.badge(g, x + 14, y + 14, cost, cost === d.cost ? 'cost' : 'costMod');
    let ty = y + 5 + artH + 6;
    nameLines.forEach((l, i) => drawText(g, l, x + 8, ty + i * 12, { color: 'brassGlint', face: 'bold', scale: 1.2, shadow: 'ink' }));
    ty += nameLines.length * 12;
    drawText(g, typeLine, x + 8, ty, { color: 'steam', scale: 0.9 });
    ty += 11;
    rule(g, x + 6, ty, w - 12);
    ty += 3;
    for (const l of body) {
      if (ty > y + hgt - (d.type !== 'glyph' ? 30 : 12)) break;
      if (l.kw) {
        drawText(g, l.kw, x + 8, ty, { color: 'crystalBright', face: 'bold', scale: 0.9 });
        drawText(g, l.text.slice(l.kw.length), x + 8 + textWidth(l.kw, 0.9, 'bold'), ty, { color: l.ink, scale: 0.9 });
      } else drawText(g, l.text, x + 8, ty, { color: l.ink, face: l.face, scale: l.ink === 'steamWhite' ? 0.95 : 0.9 });
      ty += 10;
    }
    if (d.type !== 'glyph') {
      const pw = st ? st.power : f.power;
      const hp = st ? st.hp : f.health;
      this.badge(g, x + 14, y + hgt - 13, pw, 'power');
      drawText(g, 'power', x + 24, y + hgt - 17, { color: 'ironLight', scale: 0.85 });
      this.badge(g, x + w - 14, y + hgt - 13, hp, st && st.hp < st.health ? 'hurt' : 'health');
      drawText(g, 'health', x + w - 24 - textWidth('health', 0.85), y + hgt - 17, { color: 'ironLight', scale: 0.85 });
    }
    frame(g, x, y, w, hgt, f.ascended ? 'brassGlint' : seat === 0 ? 'brassLight' : 'emberGlow', 6, true);
    ctx.restore();
  }

  /** Attack lines: each attacker to its blocker, or to the defender's Crystal when unblocked. */
  private drawCombat(g: Gfx, v: GameState, t: number): void {
    const c = v.combat;
    if (!c) return;
    const ctx = g.ctx;
    const line = (a: [number, number], b: [number, number], ink: Ink) => {
      ctx.save();
      ctx.shadowColor = rgba(ink, 0.9);
      ctx.shadowBlur = 5;
      ctx.strokeStyle = PALETTE[ink];
      ctx.lineWidth = 2.25;
      ctx.lineCap = 'round';
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -t * 0.6; // dashes that crawl toward the target
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(b[0], b[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[ink];
      ctx.fill();
      ctx.restore();
    };
    const defender: Seat = c.attacker === 0 ? 1 : 0;
    const crystal: [number, number] = this.crystalAt(defender);
    for (const pr of c.pairs) {
      const a = this.pos.get(pr.att);
      if (!a) continue;
      const b = pr.blk ? this.pos.get(pr.blk) : crystal;
      if (b) line(a, b, pr.blk ? 'brassGlint' : 'emberBright');
    }
  }

  /** Where a player's cards come from: the middle of their hand. */
  private sideOrigin(seat: Seat): Pt {
    return seat === 0 ? [HW / 4, HAND_Y + 40] : [HW / 2 - FOE_DIAL.r - 60, 14];
  }

  private crystalAt(seat: Seat | undefined): Pt {
    return [HW / 2, seat === 0 ? MY_DIAL.y : FOE_DIAL.y];
  }

  /**
   * New log events become effects (PLAN D26). A batch plays out in order: each event waits for the one before it, and
   * a new batch waits for the last. Sound is held back to its effect's frame. The log still says it all in words.
   */
  private spawnFx(v: GameState, t: number): void {
    if (this.seenLog < 0 || this.seenLog > v.log.length) this.seenLog = v.log.length; // a resumed game starts quiet
    const fresh = v.log.slice(this.seenLog);
    this.seenLog = v.log.length;
    // cards that joined my hand since the last look, in hand order, for the draw effect
    const newHand = v.players[0].hand.filter((h) => !this.knownHand.has(h.iid)).map((h) => h.iid);
    this.knownHand = new Set(v.players[0].hand.map((h) => h.iid));
    if (fresh.length === 0) return;
    const fx = this.fx;
    const base = Math.min(Math.max(t, this.fxEnd), t + 90);
    let d = 0;
    let striker: string | undefined;
    const pos = (iid?: string): Pt | undefined => (iid ? this.pos.get(iid) : undefined);
    const sg = slotGeo();
    const side = (seat: Seat | undefined): Ink => (seat === 0 ? 'crystalBright' : 'emberGlow');
    const isTactic = (id?: string): boolean => !!id && id !== '?' && !id.startsWith('order:') && def(id).type === 'glyph';
    /** A tactic's effect travels from its caster's side as a bolt; returns the delay until it lands. */
    const travel = (e: (typeof fresh)[number], to: Pt, ink: Ink, b: number, style: BoltStyle = 'plain'): number => {
      let from: Pt | undefined;
      if (isTactic(e.via)) from = this.sideOrigin(this.castBy.get(e.via!) ?? (e.seat === 0 ? 1 : 0));
      else if (e.unit && e.unit !== striker) from = pos(e.unit);
      if (!from) return 0;
      fx.bolt(from, to, ink, b, 14, undefined, style);
      return 14;
    };
    for (const e of fresh) {
      let b = base + d;
      const sound = b;
      let gap = 2;
      let p: Pt | undefined;
      switch (e.k) {
        case 'cast': {
          this.castBy.set(e.card!, e.seat ?? 0);
          const o = this.sideOrigin(e.seat ?? 0);
          fx.banner(this.name(e.card!, e.seat ?? 0), e.seat === 0 ? 'You play' : 'The foe plays', side(e.seat), b, cardArt(e.card!, false), (MID_Y + MY_LINE_Y) / 2 - 4, 55);
          fx.ring(o[0], o[1], side(e.seat), b, 6, 50, 22);
          fx.burst(o[0], o[1], [side(e.seat), 'steamWhite'], 18, b, { speed: 3, life: 26 });
          fx.fly(cardArt(e.card!, false), null, [o[0] - 30, o[1] - 42, 60, 84], [HW / 2 - 45, MID_Y - 62, 90, 126], b, { life: 30, arc: 20, dissolve: true });
          fx.rune(HW / 2, MID_Y + 20, 70, side(e.seat), b + 10, 40);
          gap = 16;
          break;
        }
        case 'play':
          if (e.seat === 1) {
            fx.banner(this.name(e.card!, 1), 'The foe plays', 'emberGlow', b, cardArt(e.card!, false), (MID_Y + MY_LINE_Y) / 2 - 4, 45);
            gap = 12;
          }
          break;
        case 'summon':
          if (e.unit) this.arrive.set(e.unit, { born: b, seat: e.seat ?? 0 });
          gap = 8;
          break;
        case 'strike': {
          striker = e.unit;
          const src = pos(e.unit);
          const dst = e.tunit?.startsWith('spire') ? this.crystalAt(e.tunit === 'spire0' ? 0 : 1) : pos(e.tunit);
          if (src && dst && e.unit) {
            const dx = dst[0] - src[0], dy = dst[1] - src[1];
            const len = Math.hypot(dx, dy) || 1;
            const reach = Math.min(22, len * 0.4);
            fx.jolt(e.unit, (dx / len) * reach, (dy / len) * reach, b, 18, 'lunge');
            const hit: Pt = [src[0] + (dx / len) * Math.min(len, len * 0.55), src[1] + (dy / len) * Math.min(len, len * 0.55)];
            const at = e.tunit?.startsWith('spire') ? dst : [(hit[0] + dst[0]) / 2, (hit[1] + dst[1]) / 2] as Pt;
            fx.slash(at[0], at[1], 'brassGlint', b + 5);
            fx.burst(at[0], at[1], ['emberBright', 'brassGlint', 'steamWhite'], 14, b + 5, { speed: 3.2, life: 20 });
            fx.shake(1.8, b + 5, 10);
          }
          gap = 6;
          break;
        }
        case 'dmg':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'emberBright', b, 'fire');
            fx.float(p[0], p[1], `-${e.n ?? 0}`, 'emberBright', b);
            fx.burst(p[0], p[1], ['ember', 'emberBright'], 12, b, { speed: 2.6, life: 22 });
            fx.flash(p[0] - sg.w / 2, p[1] - SLOT.h / 2, sg.w, SLOT.h, 'ember', b, 12);
            if (e.tunit) fx.jolt(e.tunit, 3 + Math.min(4, (e.n ?? 0)), 2, b, 14, 'shake');
            if ((e.n ?? 0) >= 4) {
              // a heavy blow: the screen flashes and shakes, the number lands bigger
              fx.flashScreen('emberGlow', 0.16, b, 6);
              fx.shake(3, b, 14);
              fx.ring(p[0], p[1], 'emberBright', b, 8, 60, 20, 3);
            }
          }
          gap = b - (base + d) + 8;
          break;
        case 'spireDmg':
          p = this.crystalAt(e.seat);
          b += travel(e, p, 'emberBright', b, 'fire');
          fx.float(p[0] + 18, p[1] + 6, `-${e.n ?? 0}`, 'emberGlow', b, 2.2);
          fx.burst(p[0], p[1], ['ember', 'emberGlow', 'brassGlint'], 24, b, { speed: 3.6, life: 30 });
          fx.ring(p[0], p[1], 'emberGlow', b, 6, 46, 24, 3);
          fx.shake((e.n ?? 0) >= 3 ? 4 : 2.2, b, 16);
          fx.vignette(e.seat === 1, 'ember', b);
          fx.burst(p[0], p[1], ['crystalWhite', e.seat === 0 ? 'crystalBright' : 'emberGlow'], 14, b, { speed: 3, life: 40, size: 2.6, grav: 0.12, shape: 'shard' });
          fx.flashScreen('ember', (e.n ?? 0) >= 3 ? 0.2 : 0.1, b, 8);
          gap = b - (base + d) + 10;
          break;
        case 'heal':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'crystalBright', b, 'crystal');
            fx.float(p[0], p[1], `+${e.n ?? 0}`, 'crystalBright', b);
            fx.rise(p[0], p[1], ['crystalBright', 'crystalWhite'], 12, b, sg.w * 0.8);
            fx.ring(p[0], p[1], 'crystalBright', b, 6, 34, 20, 2);
          }
          gap = b - (base + d) + 4;
          break;
        case 'spireHeal':
          p = this.crystalAt(e.seat);
          fx.float(p[0] + 18, p[1] + 6, `+${e.n ?? 0}`, 'crystalBright', b);
          fx.rise(p[0], p[1], ['crystalBright', 'crystalWhite'], 12, b, 30);
          gap = 4;
          break;
        case 'buff':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'brassGlint', b, 'brass');
            const sign = (n: number | undefined) => `${(n ?? 0) >= 0 ? '+' : ''}${n ?? 0}`;
            fx.float(p[0], p[1] - 10, `${sign(e.n)}|${sign(e.m)}`, 'brassGlint', b);
            fx.ring(p[0], p[1], 'brassGlint', b, 8, 40, 22, 2.5);
            fx.rise(p[0], p[1], ['brassGlint', 'brassLight'], 8, b, sg.w * 0.7);
          }
          gap = b - (base + d) + 4;
          break;
        case 'grant':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'crystalBright', b, 'brass');
            const kw = (e.s ?? '').split(',')[0] as keyof typeof KEYWORD_HELP;
            fx.ring(p[0], p[1], 'crystalBright', b, 8, 38, 22, 2);
            fx.float(p[0], p[1] - 14, KEYWORD_HELP[kw]?.name ?? '', 'crystalBright', b, 1.2);
          }
          gap = b - (base + d) + 4;
          break;
        case 'ward':
        case 'absorb':
          if ((p = pos(e.tunit))) {
            fx.ring(p[0], p[1], 'crystalWhite', b, 30, 44, 16, 3);
            fx.ring(p[0], p[1], 'crystalBright', b + 3, 24, 40, 16, 2);
            fx.float(p[0], p[1] - 14, e.k === 'ward' ? 'WARD' : 'PLATED', 'crystalWhite', b, 1.2);
          }
          gap = 6;
          break;
        case 'stasis':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'crystalWhite', b, 'frost');
            fx.ring(p[0], p[1], 'crystalWhite', b, 6, 44, 26, 3);
            fx.burst(p[0], p[1], ['crystalWhite', 'crystalBright'], 16, b, { speed: 1.2, life: 36, shape: 'dot', grav: 0.02, spread: 30 });
          }
          gap = b - (base + d) + 4;
          break;
        case 'silence':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'ironLight', b, 'shadow');
            fx.ring(p[0], p[1], 'ironLight', b, 40, 8, 18, 2.5);
            fx.float(p[0], p[1] - 14, 'SILENCED', 'ironLight', b, 1.2);
          }
          gap = b - (base + d) + 4;
          break;
        case 'destroy':
          if (e.s !== 'replaced' && (p = pos(e.tunit))) {
            b += travel(e, p, 'emberDeep', b, 'shadow');
            fx.ring(p[0], p[1], 'emberGlow', b, 44, 6, 16, 3);
          }
          gap = b - (base + d) + 2;
          break;
        case 'recall':
          if ((p = pos(e.tunit))) {
            fx.rise(p[0], p[1], ['steam', 'steamWhite'], 12, b, sg.w);
            fx.float(p[0], p[1] - 14, 'RECALLED', 'steam', b, 1.2);
          }
          gap = 6;
          break;
        case 'die':
          if ((p = pos(e.unit))) {
            const art = e.card ? cardArt(e.card, false) : null;
            if (art && art.complete && art.naturalWidth) {
              // the card breaks: its art falls apart in tumbling pieces
              fx.shatter(art, [0, 0, art.naturalWidth, art.naturalHeight], p[0] - sg.w / 2 + 1, p[1] - SLOT.h / 2 + 1, sg.w - 2, 62, b, 5, 4, 1.1);
            }
            fx.burst(p[0], p[1], [e.seat === 0 ? 'iron' : 'emberDeep', 'emberGlow', 'brassLight'], 26, b, { speed: 3.2, life: 42, size: 2.4, grav: 0.14, shape: 'shard', spread: sg.w * 0.6 });
            fx.burst(p[0], p[1], ['steam'], 10, b, { speed: 1.2, life: 40, size: 3, grav: -0.03, shape: 'dot', spread: sg.w * 0.5 });
            fx.flash(p[0] - sg.w / 2, p[1] - SLOT.h / 2, sg.w, SLOT.h, 'emberGlow', b, 20);
            fx.ring(p[0], p[1], 'emberGlow', b, 10, 56, 22, 3);
            fx.shake(2.2, b, 12);
          }
          gap = 8;
          break;
        case 'attack':
          for (const pr of v.combat?.pairs ?? []) {
            if ((p = pos(pr.att))) {
              fx.ring(p[0], p[1], 'emberBright', b, 20, 60, 20, 2.5);
              fx.burst(p[0], p[1], ['emberBright', 'brassGlint'], 8, b, { speed: 2, life: 18 });
            }
          }
          if (e.seat === 1) fx.banner('THE FOE ATTACKS', '', 'emberGlow', b, null, (MID_Y + MY_LINE_Y) / 2 - 2, 34);
          gap = 10;
          break;
        case 'blocks':
          for (const pr of v.combat?.pairs ?? []) {
            if (pr.blk && (p = pos(pr.blk))) fx.ring(p[0], p[1], 'brassGlint', b, 20, 56, 20, 2.5);
          }
          gap = 6;
          break;
        case 'ascend': {
          const u = v.players[e.seat ?? 0].line.find((x) => x.card === e.card);
          const x = (u && pos(u.iid)?.[0]) ?? HW / 2;
          fx.column(x, 'brassGlint', b, 60);
          fx.rise(x, (u && pos(u.iid)?.[1]) ?? 200, ['brassGlint', 'brassLight', 'steamWhite'], 30, b, 50);
          fx.banner('ASCENDED', this.name(e.card!, e.seat ?? 0), 'brassGlint', b + 6, cardArt(e.card!, true), (MID_Y + MY_LINE_Y) / 2 - 4, 70);
          fx.shake(3, b, 18);
          gap = 24;
          break;
        }
        case 'negate':
        case 'fizzle':
          fx.float(HW / 2, MID_Y + 30, e.k === 'negate' ? 'NEGATED' : 'FIZZLED', 'ironLight', b, 1.6);
          fx.burst(HW / 2, MID_Y + 34, ['steam', 'iron'], 14, b, { speed: 1.5, life: 30, shape: 'dot', grav: -0.02 });
          gap = 10;
          break;
        case 'resolve':
          if (e.card) this.castBy.delete(e.card);
          break;
        case 'draw': {
          // a card flies from the Deck to the hand; mine stays hidden in the hand until it lands
          const seat = e.seat ?? 0;
          for (let i = 0; i < (e.n ?? 1); i++) {
            const bb = b + i * 6;
            if (seat === 0) {
              const iid = newHand.shift();
              const hg = handGeo(v.players[0].hand.length);
              const idx = iid ? v.players[0].hand.findIndex((h) => h.iid === iid) : -1;
              const tx = idx >= 0 ? hg.xs[idx] : HW / 4;
              if (iid) this.incoming.set(iid, bb + 18);
              fx.fly(null, 'mine', [6, HAND_Y + 12, PILE.w - 4, PILE.h - 4], [tx, HAND_Y, hg.w, CARD.h], bb, { life: 18, arc: 24, spin: 0.2 });
            } else {
              fx.fly(null, 'foe', [HW - 76, 6, 26, 34], [HW / 2 - FOE_DIAL.r - 50, 4, 13, 18], bb, { life: 16, arc: 10 });
            }
          }
          gap = 4 + (e.n ?? 1) * 4;
          break;
        }
        case 'burn': {
          // a card that could not be kept burns away on its way to the Scrap
          const seat = e.seat ?? 0;
          const from: [number, number, number, number] = seat === 0 ? [6, HAND_Y + 12, PILE.w - 4, PILE.h - 4] : [HW - 76, 6, 26, 34];
          const to: [number, number, number, number] = seat === 0 ? [HW / 2 - 40, MID_Y - 30, 80, 110] : [HW / 2 - 30, MID_Y - 50, 60, 84];
          fx.fly(e.card ? cardArt(e.card, false) : null, null, from, to, b, { life: 34, arc: 20, burn: true });
          fx.float(to[0] + to[2] / 2, to[1] - 4, 'BURNED', 'emberGlow', b + 20, 1.2);
          gap = 14;
          break;
        }
        case 'create': {
          // a new card sparkles into being and joins the hand
          const seat = e.seat ?? 0;
          const at: [number, number, number, number] = [HW / 2 - 33, MID_Y - 40, 66, 92];
          fx.ring(HW / 2, MID_Y + 6, seat === 0 ? 'crystalBright' : 'emberGlow', b, 4, 60, 24, 2.5);
          fx.burst(HW / 2, MID_Y + 6, ['crystalWhite', 'brassGlint'], 20, b, { speed: 2.4, life: 30, shape: 'dot' });
          const hg = handGeo(v.players[0].hand.length);
          fx.fly(e.card ? cardArt(e.card, false) : null, seat === 1 ? 'foe' : null, at, seat === 0 ? [hg.xs[hg.xs.length - 1] ?? HW / 4, HAND_Y, hg.w, CARD.h] : [HW / 2 - FOE_DIAL.r - 50, 4, 13, 18], b + 8, { life: 22, arc: 16 });
          gap = 10;
          break;
        }
        case 'charge':
        case 'maxCharge':
        case 'reserve': {
          p = this.crystalAt(e.seat);
          const ink: Ink = e.k === 'reserve' ? (e.seat === 0 ? 'crystalBright' : 'emberBright') : e.seat === 0 ? 'brassGlint' : 'emberGlow';
          fx.ring(p[0], p[1], ink, b, 10, (e.seat === 0 ? MY_DIAL.r : FOE_DIAL.r) + 22, 22, 2.5);
          fx.rise(p[0], p[1], [ink, 'steamWhite'], 10, b, 40);
          gap = 4;
          break;
        }
        case 'rally':
          // a rally: every unit on that side lifts with a brass ring
          for (const u of v.players[e.seat ?? 0].line) {
            if ((p = pos(u.iid))) {
              fx.ring(p[0], p[1], 'brassGlint', b, 10, 46, 20, 2);
              fx.jolt(u.iid, 0, e.seat === 0 ? -6 : 6, b, 16, 'lunge');
            }
          }
          fx.banner('RALLY', '', 'brassGlint', b, null, (MID_Y + MY_LINE_Y) / 2 - 2, 30);
          gap = 10;
          break;
        case 'channel':
          if ((p = pos(e.tunit))) {
            fx.bolt(this.sideOrigin(e.seat ?? 0), p, 'crystalBright', b, 14, undefined, 'crystal');
            fx.ring(p[0], p[1], 'crystalBright', b + 14, 8, 46, 22, 2.5);
            fx.rise(p[0], p[1], ['crystalBright', 'crystalWhite'], 12, b + 14, sg.w * 0.8);
          }
          gap = 18;
          break;
        case 'over':
          if (e.seat === 0 || v.winner === 0) {
            fx.fireworks(HW, HH, b + 10, 12);
            fx.flashScreen('brassGlint', 0.2, b, 12);
          } else {
            // my Crystal breaks
            p = this.crystalAt(0);
            fx.burst(p[0], p[1], ['crystalWhite', 'crystalBright', 'crystal'], 40, b, { speed: 4, life: 60, size: 3, grav: 0.14, shape: 'shard' });
            fx.ring(p[0], p[1], 'crystalBright', b, 10, 120, 40, 4);
            fx.flashScreen('emberDeep', 0.3, b, 20);
            fx.shake(6, b, 30);
          }
          break;
        case 'round':
          if ((e.n ?? 0) > 1) fx.banner(`ROUND ${e.n ?? 0}`, '', 'brassLight', b, null, (MID_Y + MY_LINE_Y) / 2 - 2, 36);
          gap = 8;
          break;
        default:
          break;
      }
      if (sound <= t) playEvent(e, 0);
      else window.setTimeout(() => playEvent(e, 0), (sound - t) * (1000 / 60));
      d += gap;
    }
    this.fxEnd = base + d;
  }

  /** The whole log, or a player's Scrap, newest at the bottom; arrows or the buttons scroll. */
  /** A Deck or Scrap viewer, as cards (PLAN D29). Mine shows what is left, sorted so the draw order stays hidden. */
  private drawPanel(g: Gfx, v: GameState): void {
    const x = 16, y = 30, w = HW - 32, h = HH - 60;
    this.hots.push({ x: 0, y: 0, w: HW, h: HH, id: 'panel-bg', kind: 'button' });
    g.wash(0, 0, HW, HH, 'ink', 0.4);
    panel(g, x, y, w, h, { tone: 'dark' });
    const p = this.panel!;
    const faceOf = (id: string) => face(v, p.seat, id);
    const whose = p.seat === 0 ? 'YOUR' : "THE FOE'S";
    const title = p.kind === 'deck' ? `${whose} DECK (${v.players[p.seat].deck.length} LEFT)` : `${whose} SCRAP (${v.players[p.seat].scrap.length})`;
    drawText(g, title, x + 12, y + 9, { color: 'brassGlint', face: 'display', scale: 1.4 });
    const sub = p.kind === 'deck' && p.seat === 0 ? 'Sorted by cost; the draw order stays hidden. Click a card to see it up close.'
      : p.kind === 'scrap' ? 'In the order they went there. Click a card to see it up close.' : '';
    if (sub) drawText(g, sub, x + w - 12 - textWidth(sub, 0.9), y + 12, { color: 'ironLight', scale: 0.9 });
    rule(g, x + 10, y + 24, w - 20);
    const gh: GridHot[] = [];
    if (p.kind === 'deck' && p.seat === 1) {
      drawTextCentred(g, `${v.players[1].deck.length} cards. What is in the foe's deck is hidden.`, HW / 2, y + 60, { color: 'steam' });
      this.scroll = 0;
    } else {
      let items: GridItem[];
      if (p.kind === 'deck') items = grouped(this.s.players[0].deck, faceOf);
      else items = v.players[p.seat].scrap.map((id, i) => ({ id, tag: `#${i + 1}` }));
      const res = cardGrid(g, items, faceOf, x + 10, y + 32, w - 80, h - 64, this.scroll, this.hover?.id ?? null, 'pgrid|', gh);
      this.scroll = res.scroll;
      scrollButtons(g, x + w - 56, y + 34, h - 70, res.scroll, res.maxScroll, this.hover?.id ?? null, gh);
    }
    // grid cards with the same id share one hot; a click opens the card
    for (const q of gh) this.hots.push({ ...q, kind: 'button' });
    const cw = textWidth('CLOSE', 1, 'display') + 16;
    button(g, 'CLOSE', x + w - 10 - cw, y + h - 21, { h: 15, state: this.hover?.id === 'panel-close' ? 'hot' : 'on' });
    this.hots.push({ x: x + w - 10 - cw, y: y + h - 21, w: cw, h: 15, id: 'panel-close', kind: 'button' });
    // a closer look: on click, or under the mouse
    const look = this.peek ?? (this.hover?.id.startsWith('pgrid|') && !this.down?.touch ? this.hover.id.slice(6) : null);
    if (look) {
      const hv = this.hover?.id.startsWith('pgrid|') ? this.hover : null;
      const bx = hv && hv.x + hv.w / 2 > HW / 2 ? x + 14 : x + w - 14 - 180;
      bigCard(g, look, faceOf(look), bx, y + 34, 180);
    }
  }

  /** The log drawer: every card played and every effect, newest at the bottom, sliding in from the right. */
  private drawDrawer(g: Gfx, v: GameState): void {
    const w = drawerW();
    const ease = 1 - (1 - this.drawerT) ** 3;
    const x = Math.round(HW - w * ease), y = 24, h = HH - y - 4;
    g.wash(0, 0, x, HH, 'ink', 0.25 * ease);
    panel(g, x, y, w + 6, h, { tone: 'dark' });
    this.hots.push({ x, y, w, h, id: 'drawer-bg', kind: 'button' });
    drawText(g, 'BATTLE LOG', x + 12, y + 9, { color: 'brassGlint', face: 'display', scale: 1.3 });
    const cw = textWidth('CLOSE', 1, 'display') + 16;
    button(g, 'CLOSE', x + w - 10 - cw, y + 6, { h: 15, state: this.hover?.id === 'log' ? 'hot' : 'on' });
    this.hots.push({ x: x + w - 10 - cw, y: y + 6, w: cw, h: 15, id: 'log', kind: 'button' });
    rule(g, x + 10, y + 26, w - 20);
    const lines = v.log.flatMap((e) => wrapPx(lineText(e, (id) => face(this.s, e.seat ?? 0, id).name), w - 26)
      .map((text, i): { text: string; ink: Ink; head: boolean } => ({ text, head: i === 0 && e.k === 'round', ink: e.k === 'round' ? 'brassLight' : e.seat === 1 ? 'steam' : 'steamWhite' })));
    const rows = Math.floor((h - 58) / 10);
    this.drawerScroll = Math.min(this.drawerScroll, Math.max(0, lines.length - rows));
    const start = Math.max(0, lines.length - rows - this.drawerScroll);
    lines.slice(start, start + rows).forEach((l, i) => {
      const ly = y + 31 + i * 10;
      if (l.head && i > 0) rule(g, x + 10, ly - 2, w - 20, 'brassShadow');
      drawText(g, l.text, x + 12, ly, { color: l.ink, face: l.head ? 'bold' : 'body' });
    });
    if (lines.length === 0) drawText(g, 'Nothing has happened yet.', x + 12, y + 31, { color: 'iron' });
    const by = y + h - 21;
    const btn = (label: string, bx: number, id: string, on: boolean) => {
      const bw = button(g, label, bx, by, { h: 15, state: on ? (this.hover?.id === id ? 'hot' : 'on') : 'off' });
      if (on) this.hots.push({ x: bx, y: by, w: bw, h: 15, id, kind: 'button' });
      return bw;
    };
    const ow = btn('OLDER', x + 10, 'drawer-up', start > 0);
    btn('NEWER', x + 16 + ow, 'drawer-down', this.drawerScroll > 0);
    const range = lines.length ? `${start + 1}-${Math.min(lines.length, start + rows)} of ${lines.length}` : '';
    drawText(g, range, x + w - 12 - textWidth(range, 0.9), by + 4, { color: 'ironLight', scale: 0.9 });
  }

  private drawOver(g: Gfx, v: GameState): void {
    const w = 320, h = 96, x = (HW - w) / 2, y = 156;
    panel(g, x, y, w, h, { glow: v.winner === 0 ? 'brassGlint' : 'ember' });
    const head = v.winner === 0 ? 'VICTORY' : v.winner === 1 ? 'DEFEAT' : 'DRAW';
    drawTextCentred(g, head, HW / 2, y + 12, { color: v.winner === 0 ? 'brassGlint' : 'emberGlow', scale: 2.4, glow: v.winner === 0 ? 'brass' : 'ember' });
    drawTextCentred(g, END_REASONS[v.endReason ?? ''] ?? '', HW / 2, y + 40, { color: 'steamWhite' });
    drawTextCentred(g, `${this.title}, round ${v.round}`, HW / 2, y + 52, { color: 'ironLight' });
  }

  private drawMenu(g: Gfx): void {
    const w = 210, h = 100, x = (HW - w) / 2, y = 150;
    g.wash(0, 0, HW, HH, 'ink', 0.45);
    panel(g, x, y, w, h);
    const items: [string, string][] = [['m-resume', 'RESUME'], ['m-title', 'SAVE AND QUIT TO TITLE'], ['m-concede', 'CONCEDE THIS BATTLE']];
    items.forEach(([id, label], i) => {
      const yy = y + 14 + i * 26;
      button(g, label, x + 14, yy, { w: w - 28, h: 19, state: id === 'm-concede' ? 'danger' : this.hover?.id === id ? 'hot' : 'on' });
      this.hots.push({ x: x + 14, y: yy, w: w - 28, h: 19, id, kind: 'button' });
    });
  }
}
