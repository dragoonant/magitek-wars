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
import { cardArt, emblem, field, isMissing } from './art';
import { END_REASONS, KEYWORD_HELP, lineText, targetPrompt } from './text';
import type { Session } from './session';
import { playEvent } from '../audio/audio';
import { Fx, type Pt } from './fx';

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
/** The foe's hand as card backs, with its Deck and Scrap piles at the right. */
const FOE_HAND_Y = 24;
const FOE_LINE_Y = 44;
const MID_Y = 150;
const MY_LINE_Y = 210;
/** How far an attacker or blocker steps out of its Line toward the other side. */
const LUNGE = 8;
/** My Deck and Scrap piles sit either side of the hand. */
const PILE = { w: 44, h: 62 };
const MY_BAR_Y = 316;
const HAND_Y = 342;
const CARD = { h: 104 };
const AI_DELAY = 520;

/** Line slots: six columns across the width; a slot grows up to 110 wide, its art stays 64 x 48, centred. */
function slotGeo(): { w: number; dx: number; x0: number } {
  const dx = (HW - 8) / LIMITS.line;
  const w = Math.min(110, Math.floor(dx) - 2);
  return { w, dx, x0: 4 + (dx - w - 2) / 2 };
}
/**
 * Hand cards, centred between the two piles. Cards are 58 wide at 512 and 66 (the whole 64-wide art) on wider
 * screens; a big hand overlaps them rather than shrinking them.
 */
function cardGeo(n: number): { w: number; dx: number; x0: number } {
  const w = HW >= 640 ? 66 : 58;
  const left = 6 + PILE.w + 10, right = HW - 6 - PILE.w - 10;
  const avail = right - left;
  const dx = n > 1 ? Math.min(w + 6, (avail - w) / (n - 1)) : 0;
  const total = w + Math.max(0, n - 1) * dx;
  return { w, dx, x0: Math.round(HW / 2 - total / 2) };
}
/** The log drawer: it slides in from the right over the board. */
const drawerW = (): number => Math.round(Math.min(340, Math.max(250, HW * 0.4)));

interface Hot { x: number; y: number; w: number; h: number; id: string; kind: 'hand' | 'unit' | 'spire' | 'stack' | 'button' | 'hero' }
interface Button { id: string; label: string; enabled: boolean }

/** The click path of an action, in the order the player gives it: targets, then the unit to scrap. */
function pathOf(a: Action): string[] {
  if (a.type !== 'play') return [];
  return [...(a.targets ?? []), ...(a.replace ? [`R:${a.replace}`] : [])];
}

function factionOf(cardId: string): string {
  const d = def(cardId);
  return FACTIONS.find((f) => f.engine === d.faction)?.key ?? 'dominion';
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
      out.push({ id: 'play', label: def(this.cardOf(this.armed.iid)).type === 'glyph' ? 'PLAY TACTIC' : 'PLAY UNIT', enabled: exact });
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
    if (id === 'panel-close') { this.panel = null; return; }
    if (id === 'panel-up') { this.scroll += 10; return; }
    if (id === 'panel-down') { this.scroll = Math.max(0, this.scroll - 10); return; }
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
    if (this.nextChoices().size === 0) this.press('play');
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
    if (touch && h && h.kind !== 'spire') {
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
    if (this.panel) this.scroll = Math.max(0, this.scroll - step);
    else if (this.drawer && x >= HW - drawerW()) this.drawerScroll = Math.max(0, this.drawerScroll - step);
  }

  key(code: string): void {
    if (this.panel) {
      if (code === 'Escape') this.panel = null;
      else if (code === 'ArrowUp' || code === 'PageUp') this.scroll += code === 'PageUp' ? 20 : 2;
      else if (code === 'ArrowDown' || code === 'PageDown') this.scroll = Math.max(0, this.scroll - (code === 'PageDown' ? 20 : 2));
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
    const onLine = new Set([...v.players[0].line, ...v.players[1].line].map((u) => u.iid));
    let pruned = false;
    for (const k of [...this.slots.keys()]) if (!onLine.has(k)) { this.slots.delete(k); pruned = true; }
    if (pruned) this.saveSlots();
    this.spawnFx(v, t);
    const [sx, sy] = this.fx.screen(t);
    g.ctx.save();
    g.ctx.translate(sx, sy);
    this.drawBar(g, v, 1, 0);
    this.drawFoeHand(g, v);
    this.drawMiddle(g, v, t);
    this.fx.drawUnder(g, t, HW);
    this.drawLine(g, v, 1, FOE_LINE_Y, t);
    this.drawLine(g, v, 0, MY_LINE_Y, t);
    this.drawBar(g, v, 0, MY_BAR_Y);
    this.drawCombat(g, v, t);
    this.drawPiles(g, v);
    this.drawHand(g, v, t);
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

  private drawBar(g: Gfx, v: GameState, seat: Seat, y: number): void {
    const p = v.players[seat];
    const ctx = g.ctx;
    const gr = ctx.createLinearGradient(0, y, 0, y + 22);
    gr.addColorStop(0, rgba('ironDark', 0.92));
    gr.addColorStop(1, rgba('ironNight', 0.95));
    ctx.fillStyle = gr;
    ctx.fillRect(0, y, HW, 22);
    rule(g, 0, seat === 1 ? y + 21 : y, HW);
    const fk = p.deckList.length ? factionOf(p.deckList[0]) : 'dominion';
    const em = emblem(fk);
    if (em) drawPic(g, em, 2, y + 1, 20, 20);
    const who = seat === 0 ? 'YOU' : 'FOE';
    drawText(g, who, 26, y + 4, { color: seat === 0 ? 'brassGlint' : 'emberGlow', face: 'display', shadow: 'ink' });
    if (v.initiative === seat) {
      // the Initiative: a glowing brass diamond beside the name
      const dx = 26 + textWidth(who, 1, 'display') + 6 - 49.5;
      ctx.save();
      ctx.translate(dx, 0);
      ctx.shadowColor = rgba('brassGlint', 0.9);
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(49.5, y + 4); ctx.lineTo(52.5, y + 7.5); ctx.lineTo(49.5, y + 11); ctx.lineTo(46.5, y + 7.5);
      ctx.closePath();
      ctx.fillStyle = PALETTE.brassGlint;
      ctx.fill();
      ctx.restore();
      this.hots.push({ x: 44 + dx, y: y + 1, w: 10, h: 10, id: 'initiative', kind: 'button' });
    }
    // the Crystal: a click target for "unit or Crystal" cards
    const bx = 56;
    const bossOn = this.nextChoices().has(spireId(seat));
    const low = p.spire <= 5;
    fillRound(g, bx, y + 1.5, 64, 19, low ? 'emberNight' : 'ink', 0.85, 4);
    frame(g, bx, y + 1.5, 64, 19, bossOn ? 'brassGlint' : low ? 'ember' : 'crystalDark', 4, bossOn);
    this.gem(g, bx + 10, y + 11, 7, low);
    drawText(g, String(p.spire), bx + 22, y + 5, { color: low ? 'emberGlow' : 'steamWhite', face: 'bold', scale: 1.5, shadow: 'ink' });
    drawText(g, 'Crystal', bx + 22 + textWidth(String(p.spire), 1.5, 'bold') + 3, y + 8, { color: low ? 'emberGlow' : 'crystalBright', scale: 0.85 });
    this.hots.push({ x: bx, y: y + 1, w: 64, h: 19, id: spireId(seat), kind: 'spire' });
    const parts: [string, string][] = [['Charge', `${p.charge}/${p.maxCharge}`], ['Reserve', `${p.reserve}`], ['Hand', `${p.hand.length}`], ['Deck', `${p.deck.length}`], ['Scrap', `${p.scrap.length}`]];
    let ix = 128;
    for (const [k, val] of parts) {
      const start = ix;
      drawText(g, k, ix, y + 2.5, { color: 'ironLight', scale: 0.9 });
      ix += textWidth(k, 0.9) + 3;
      drawText(g, val, ix, y + 2.5, { color: k === 'Charge' ? 'crystalBright' : 'steamWhite', face: 'bold', scale: 0.9 });
      ix += textWidth(val, 0.9, 'bold') + 10;
      // Deck and Scrap open their viewers for this player
      if (k === 'Scrap' || k === 'Deck') this.hots.push({ x: start - 2, y: y + 1, w: ix - start - 6, h: 9, id: `${k.toLowerCase()}${seat}`, kind: 'button' });
    }
    // hero progress, open information (R-H3)
    let hx = 128;
    for (const h of p.heroes) {
      const d = def(h);
      const asc = p.ascended.includes(h);
      const lv = d.level;
      const have = lv ? (lv.who === 'you' ? p.seen[lv.stat] ?? 0 : 0) : 0;
      const words = face(v, seat, h).name.split(',')[0].split(' ');
      const short = (words.length > 2 ? words.slice(1) : words).join(' ');
      const label = `${short} ${asc ? 'ascended' : lv ? `${Math.min(have, lv.n)}/${lv.n}` : ''}`;
      drawText(g, label, hx, y + 12.5, { color: asc ? 'brassGlint' : 'steam', scale: 0.9 });
      this.hots.push({ x: hx, y: y + 11, w: textWidth(label, 0.9), h: 9, id: h, kind: 'hero' });
      hx += textWidth(label, 0.9) + 12;
    }
    if (seat === 0) {
      const mw = button(g, 'MENU', HW - 6 - (textWidth('MENU', 1, 'display') + 16), y + 3, { h: 15 });
      const mx = HW - 6 - mw;
      this.hots.push({ x: mx, y: y + 3, w: mw, h: 15, id: 'menu', kind: 'button' });
      const lw = textWidth('LOG', 1, 'display') + 16;
      const lx = mx - 6 - lw;
      button(g, 'LOG', lx, y + 3, { h: 15 });
      this.hots.push({ x: lx, y: y + 3, w: lw, h: 15, id: 'log', kind: 'button' });
    }
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
    if (u.stasis) { g.wash(x + 1, y + 1, sw - 2, artH, 'crystalWhite', 0.55); drawTextCentred(g, 'STASIS', x + sw / 2, y + 28, { color: 'crystalDeep', face: 'display' }); }
    unclip();
    drawText(g, fitText(f.name, sw - 8, 0.95, 'bold'), x + 4, y + 3.5, { color: 'steamWhite', face: 'bold', scale: 0.95, shadow: 'ink' });
    if (u.ward) frame(g, x + 2, y + 2, sw - 4, artH - 2, 'crystalBright', 3, true);
    const kws = st.keywords.map((k) => KEYWORD_HELP[k].name).join(' · ');
    if (kws) drawText(g, fitText(kws, sw - 8, 0.85), x + 4, y + artH + 2, { color: 'crystalBright', scale: 0.85 });
    if (role) drawText(g, role, x + 4, y + artH + 12, { color: 'emberGlow', face: 'bold', scale: 0.85 });
    if (u.silenced) drawTextCentred(g, 'silenced', x + sw / 2, y + SLOT.h - 13, { color: 'ironLight', scale: 0.85 });
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
    const py = lines.length > 1 ? MID_Y + 8 : MID_Y + 12;
    lines.forEach((l, i) => drawTextCentred(g, l, HW / 2, py + i * 10, { color: this.note ? 'emberGlow' : 'brassGlint', face: 'bold', shadow: 'ink' }));
    // the stack as a row of chips, newest first; the round when it is empty
    const rowY = MID_Y + 30;
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
        const w = Math.min(textWidth(label, 1) + 10, 150);
        const rest = items.length - i - 1;
        if (sx + w > maxX - (rest ? 26 : 0)) {
          drawText(g, `+${items.length - i}`, sx, rowY + 3.5, { color: 'steam', face: 'bold' });
          break;
        }
        const on = next.has(it.sid);
        if (on) highlight(g, sx, rowY, w, 14, 'brass');
        else fillRound(g, sx, rowY, w, 14, it.owner === 0 ? 'ironNight' : 'emberNight', 0.85, 3);
        frame(g, sx, rowY, w, 14, on ? 'brassGlint' : it.owner === 0 ? 'brassDark' : 'emberDeep', 3);
        drawText(g, fitText(label, w - 10), sx + 5, rowY + 3.5, { color: on ? 'brassGlint' : 'steamWhite' });
        this.hots.push({ x: sx, y: rowY, w, h: 14, id: it.sid, kind: 'stack' });
        sx += w + 4;
      }
    }
    void t;
  }

  /** The foe's hand as small card backs, centred, so its size can be seen at a glance; its piles sit at the right. */
  private drawFoeHand(g: Gfx, v: GameState): void {
    const p = v.players[1];
    const n = p.hand.length;
    const bw = 12, bh = 16;
    const dx = n > 1 ? Math.min(bw + 3, 200 / (n - 1)) : 0;
    const total = n ? bw + (n - 1) * dx : 0;
    let x = HW / 2 - total / 2;
    const y = FOE_HAND_Y + 1;
    for (let i = 0; i < n; i++) {
      this.cardBack(g, x, y, bw, bh);
      x += dx;
    }
    if (n === 0) drawTextCentred(g, 'no cards in hand', HW / 2, y + 4, { color: 'ironLight', scale: 0.85 });
    else drawText(g, String(n), HW / 2 + total / 2 + 5, y + 3.5, { color: 'emberGlow', face: 'bold' });
    // the foe's Deck and Scrap, small, at the right
    let rx = HW - 6;
    for (const [id, label, count] of [['scrap1', 'Scrap', p.scrap.length], ['deck1', 'Deck', p.deck.length]] as const) {
      const w = textWidth(`${label} ${count}`, 0.9, 'bold') + 24;
      rx -= w;
      const hot = this.hover?.id === id;
      fillRound(g, rx, y - 1, w, bh + 2, hot ? 'emberNight' : 'ink', 0.8, 3);
      frame(g, rx, y - 1, w, bh + 2, hot ? 'emberGlow' : 'emberDeep', 3);
      if (label === 'Deck') this.cardBack(g, rx + 3, y + 1, 9, 12);
      else this.cardFace(g, rx + 3, y + 1, 9, 12);
      drawText(g, `${label} ${count}`, rx + 16, y + 4, { color: 'steamWhite', face: 'bold', scale: 0.9 });
      this.hots.push({ x: rx, y: y - 1, w, h: bh + 2, id, kind: 'button' });
      rx -= 6;
    }
  }

  /** A face-down card: iron with an ember border and a small crystal in the middle. */
  private cardBack(g: Gfx, x: number, y: number, w: number, h: number): void {
    const ctx = g.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 2;
    fillRound(g, x, y, w, h, 'emberNight', 0.97, 2);
    ctx.restore();
    frame(g, x, y, w, h, 'emberDeep', 2);
    frame(g, x + 1.5, y + 1.5, w - 3, h - 3, 'brassShadow', 1.5);
    this.gem(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.28, false);
  }

  /** A face-up pile marker (the Scrap): a pale card with lines of text. */
  private cardFace(g: Gfx, x: number, y: number, w: number, h: number): void {
    fillRound(g, x, y, w, h, 'iron', 0.95, 2);
    frame(g, x, y, w, h, 'ironNight', 2);
    for (let i = 0; i < 3; i++) g.rect(x + 2, y + 3 + i * (h / 4), w - 4, 1, 'ironNight');
  }

  /** My Deck (left of the hand) and Scrap (right of it), each a little stack with its count; click to look inside. */
  private drawPiles(g: Gfx, v: GameState): void {
    const p = v.players[0];
    const y = HAND_Y + (CARD.h - PILE.h) / 2 - 4;
    const piles: [string, string, number, number, boolean][] = [
      ['deck0', 'DECK', p.deck.length, 6, true],
      ['scrap0', 'SCRAP', p.scrap.length, HW - 6 - PILE.w, false],
    ];
    for (const [id, label, count, x, back] of piles) {
      const hot = this.hover?.id === id;
      const layers = Math.min(3, count);
      for (let i = layers - 1; i >= 0; i--) {
        const ox = x + i * 2, oy = y - i * 2;
        if (back) this.cardBack(g, ox, oy, PILE.w - 4, PILE.h - 4);
        else this.cardFace(g, ox, oy, PILE.w - 4, PILE.h - 4);
      }
      if (count === 0) {
        fillRound(g, x, y, PILE.w - 4, PILE.h - 4, 'ink', 0.45, 3);
        g.ctx.save();
        g.ctx.setLineDash([3, 3]);
        frame(g, x + 0.5, y + 0.5, PILE.w - 5, PILE.h - 5, 'brassDark', 3);
        g.ctx.restore();
      }
      if (hot) frame(g, x - 2, y - 6, PILE.w + 2, PILE.h + 6, 'brassGlint', 4, true);
      const cx = x + (PILE.w - 4) / 2;
      fillRound(g, cx - 13, y + PILE.h / 2 - 12, 26, 15, 'ink', 0.8, 4);
      drawTextCentred(g, String(count), cx, y + PILE.h / 2 - 10, { color: 'steamWhite', face: 'bold', scale: 1.2 });
      drawTextCentred(g, label, cx, y + PILE.h + 2, { color: hot ? 'brassGlint' : 'ironLight', face: 'display', scale: 0.85, shadow: 'ink' });
      this.hots.push({ x: x - 2, y: y - 6, w: PILE.w + 2, h: PILE.h + 18, id, kind: 'button' });
    }
  }

  private drawHand(g: Gfx, v: GameState, _t: number): void {
    const p = v.players[0];
    const acts = this.acts();
    const cg = cardGeo(p.hand.length);
    const cw = cg.w;
    // the card under the pointer (or the armed one) is drawn last, lifted, so an overlapped hand can still be read
    const top = p.hand.findIndex((h) => h.iid === (this.armed?.iid ?? (this.hover?.kind === 'hand' ? this.hover.id : '')));
    const order = p.hand.map((_, i) => i);
    if (top >= 0) { order.splice(top, 1); order.push(top); }
    for (const i of order) {
      const h = p.hand[i];
      const x = Math.round(cg.x0 + i * cg.dx);
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
    if (p.hand.length === 0) drawTextCentred(g, 'Your hand is empty', HW / 2, HAND_Y + 40, { color: 'ironLight' });
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
    const cw = cardGeo(v.players[0].hand.length).w;
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
      const y = over ? 226 : MID_Y + 29;
      button(g, b.label, x, y, { w, h: 17, state: b.enabled ? (this.hover?.id === b.id ? 'hot' : 'on') : 'off' });
      if (b.enabled) this.hots.push({ x, y, w, h: 17, id: b.id, kind: 'button' });
      x -= 8;
    }
  }

  /**
   * The full card, enlarged where it sits: it grows out of the card under the mouse (or under a held finger) and
   * shrinks away when the pointer leaves or the finger lifts. Hand cards grow upward from the hand.
   */
  private drawDetail(g: Gfx, v: GameState, h: Hot): void {
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
    const crystal: [number, number] = [66, defender === 0 ? MY_BAR_Y + 12 : 12];
    for (const pr of c.pairs) {
      const a = this.pos.get(pr.att);
      if (!a) continue;
      const b = pr.blk ? this.pos.get(pr.blk) : crystal;
      if (b) line(a, b, pr.blk ? 'brassGlint' : 'emberBright');
    }
  }

  /** Where a player's cards come from: the middle of their hand. */
  private sideOrigin(seat: Seat): Pt {
    return seat === 0 ? [HW / 2, HAND_Y + 30] : [HW / 2, FOE_HAND_Y + 8];
  }

  private crystalAt(seat: Seat | undefined): Pt {
    return [66, seat === 0 ? MY_BAR_Y + 12 : 12];
  }

  /**
   * New log events become effects (PLAN D26). A batch plays out in order: each event waits for the one before it, and
   * a new batch waits for the last. Sound is held back to its effect's frame. The log still says it all in words.
   */
  private spawnFx(v: GameState, t: number): void {
    if (this.seenLog < 0 || this.seenLog > v.log.length) this.seenLog = v.log.length; // a resumed game starts quiet
    const fresh = v.log.slice(this.seenLog);
    this.seenLog = v.log.length;
    if (fresh.length === 0) return;
    const fx = this.fx;
    const base = Math.min(Math.max(t, this.fxEnd), t + 90);
    let d = 0;
    let striker: string | undefined;
    const pos = (iid?: string): Pt | undefined => (iid ? this.pos.get(iid) : undefined);
    const sg = slotGeo();
    const side = (seat: Seat | undefined): Ink => (seat === 0 ? 'crystalBright' : 'emberGlow');
    const isTactic = (id?: string): boolean => !!id && id !== '?' && def(id).type === 'glyph';
    /** A tactic's effect travels from its caster's side as a bolt; returns the delay until it lands. */
    const travel = (e: (typeof fresh)[number], to: Pt, ink: Ink, b: number): number => {
      let from: Pt | undefined;
      if (isTactic(e.via)) from = this.sideOrigin(this.castBy.get(e.via!) ?? (e.seat === 0 ? 1 : 0));
      else if (e.unit && e.unit !== striker) from = pos(e.unit);
      if (!from) return 0;
      fx.bolt(from, to, ink, b, 12);
      return 12;
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
            b += travel(e, p, 'emberBright', b);
            fx.float(p[0], p[1], `-${e.n ?? 0}`, 'emberBright', b);
            fx.burst(p[0], p[1], ['ember', 'emberBright'], 12, b, { speed: 2.6, life: 22 });
            fx.flash(p[0] - sg.w / 2, p[1] - SLOT.h / 2, sg.w, SLOT.h, 'ember', b, 12);
            if (e.tunit) fx.jolt(e.tunit, 3, 2, b, 14, 'shake');
          }
          gap = b - (base + d) + 8;
          break;
        case 'spireDmg':
          p = this.crystalAt(e.seat);
          b += travel(e, p, 'emberBright', b);
          fx.float(p[0] + 18, p[1] + 6, `-${e.n ?? 0}`, 'emberGlow', b, 2.2);
          fx.burst(p[0], p[1], ['ember', 'emberGlow', 'brassGlint'], 24, b, { speed: 3.6, life: 30 });
          fx.ring(p[0], p[1], 'emberGlow', b, 6, 46, 24, 3);
          fx.shake((e.n ?? 0) >= 3 ? 4 : 2.2, b, 16);
          fx.vignette(e.seat === 1, 'ember', b);
          gap = b - (base + d) + 10;
          break;
        case 'heal':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'crystalBright', b);
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
            b += travel(e, p, 'brassGlint', b);
            const sign = (n: number | undefined) => `${(n ?? 0) >= 0 ? '+' : ''}${n ?? 0}`;
            fx.float(p[0], p[1] - 10, `${sign(e.n)}|${sign(e.m)}`, 'brassGlint', b);
            fx.ring(p[0], p[1], 'brassGlint', b, 8, 40, 22, 2.5);
            fx.rise(p[0], p[1], ['brassGlint', 'brassLight'], 8, b, sg.w * 0.7);
          }
          gap = b - (base + d) + 4;
          break;
        case 'grant':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'crystalBright', b);
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
            b += travel(e, p, 'crystalWhite', b);
            fx.ring(p[0], p[1], 'crystalWhite', b, 6, 44, 26, 3);
            fx.burst(p[0], p[1], ['crystalWhite', 'crystalBright'], 16, b, { speed: 1.2, life: 36, shape: 'dot', grav: 0.02, spread: 30 });
          }
          gap = b - (base + d) + 4;
          break;
        case 'silence':
          if ((p = pos(e.tunit))) {
            b += travel(e, p, 'ironLight', b);
            fx.ring(p[0], p[1], 'ironLight', b, 40, 8, 18, 2.5);
            fx.float(p[0], p[1] - 14, 'SILENCED', 'ironLight', b, 1.2);
          }
          gap = b - (base + d) + 4;
          break;
        case 'destroy':
          if (e.s !== 'replaced' && (p = pos(e.tunit))) {
            b += travel(e, p, 'emberDeep', b);
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
  private drawPanel(g: Gfx, v: GameState): void {
    const x = 16, y = 30, w = HW - 32, h = HH - 60;
    panel(g, x, y, w, h, { tone: 'dark' });
    const p = this.panel!;
    this.hots.push({ x: 0, y: 0, w: HW, h: HH, id: 'panel-bg', kind: 'button' });
    let lines: { text: string; ink: Ink }[];
    if (p.kind === 'deck' && p.seat === 1) {
      lines = [{ text: `${v.players[1].deck.length} cards. What is in the foe's deck is hidden.`, ink: 'steam' }];
    } else if (p.kind === 'deck') {
      // what is left in my deck, from the full state: contents only, sorted by cost then name, so the order stays hidden
      const counts = new Map<string, number>();
      for (const id of this.s.players[0].deck) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, b) => def(a).cost - def(b).cost || face(v, 0, a).name.localeCompare(face(v, 0, b).name));
      lines = ids.map((id): { text: string; ink: Ink } => ({ text: `${counts.get(id)} x ${face(v, 0, id).name} (${def(id).type === 'glyph' ? 'tactic' : def(id).type}, cost ${def(id).cost})`, ink: 'steamWhite' }));
      if (lines.length === 0) lines = [{ text: 'Your deck is empty.', ink: 'iron' }];
    } else {
      const scrap = v.players[p.seat].scrap;
      lines = scrap.map((id, i): { text: string; ink: Ink } => ({ text: `${i + 1}. ${face(v, p.seat, id).name} (${def(id).type === 'glyph' ? 'tactic' : def(id).type}, cost ${def(id).cost})`, ink: 'steamWhite' }));
      if (lines.length === 0) lines = [{ text: 'Nothing in the Scrap yet.', ink: 'iron' }];
    }
    const whose = p.seat === 0 ? 'YOUR' : "THE FOE'S";
    const title = p.kind === 'deck' ? `${whose} DECK (${v.players[p.seat].deck.length} LEFT)` : `${whose} SCRAP (${v.players[p.seat].scrap.length})`;
    drawText(g, title, x + 12, y + 9, { color: 'brassGlint', face: 'display', scale: 1.4 });
    if (p.kind === 'deck' && p.seat === 0) drawText(g, 'sorted by cost; the draw order stays hidden', x + w - 12 - textWidth('sorted by cost; the draw order stays hidden', 0.9), y + 12, { color: 'ironLight', scale: 0.9 });
    rule(g, x + 10, y + 24, w - 20);
    const rows = Math.floor((h - 50) / 10);
    this.scroll = Math.min(this.scroll, Math.max(0, lines.length - rows));
    const start = Math.max(0, lines.length - rows - this.scroll);
    lines.slice(start, start + rows).forEach((l, i) => drawText(g, l.text, x + 12, y + 29 + i * 10, { color: l.ink }));
    const btn = (label: string, bx: number, id: string) => {
      const bw = button(g, label, bx, y + h - 21, { h: 15 });
      this.hots.push({ x: bx, y: y + h - 21, w: bw, h: 15, id, kind: 'button' });
      return bw;
    };
    const ow = btn('OLDER', x + 10, 'panel-up');
    btn('NEWER', x + 16 + ow, 'panel-down');
    btn('CLOSE', x + w - 10 - (textWidth('CLOSE', 1, 'display') + 16), 'panel-close');
    drawText(g, `${start + 1}–${Math.min(lines.length, start + rows)} of ${lines.length}`, x + 150, y + h - 17, { color: 'ironLight' });
  }

  /** The log drawer: every card played and every effect, newest at the bottom, sliding in from the right. */
  private drawDrawer(g: Gfx, v: GameState): void {
    const w = drawerW();
    const ease = 1 - (1 - this.drawerT) ** 3;
    const x = Math.round(HW - w * ease), y = FOE_HAND_Y, h = HH - y - 4;
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
