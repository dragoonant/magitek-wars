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
const FOE_LINE_Y = 24;
const MID_Y = 130;
const MY_LINE_Y = 210;
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
/** Hand cards: ten across the width, 49 to 66 wide (66 shows the whole 64-wide art). */
function cardGeo(): { w: number; dx: number; x0: number } {
  const dx = Math.max(50, Math.min(72, (HW - 12) / 10));
  const w = Math.min(66, Math.floor(dx) - 1);
  return { w, dx, x0: 6 };
}
/** The log takes the right part of the middle strip; at 512 it starts at x 300. */
const logX = (): number => Math.round((HW * 300) / BASE_W);

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
  /** Full-screen viewers: the whole log, or a player's Scrap (open information). */
  private panel: { kind: 'log' } | { kind: 'scrap'; seat: Seat } | null = null;
  private scroll = 0;
  /** Where each unit was last drawn, so effects can rise from it (even after it is gone). */
  private pos = new Map<string, [number, number]>();
  private fx: { x: number; y: number; text: string; ink: Ink; born: number; flash?: boolean }[] = [];
  private seenLog = -1;
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
    const r = this.session.apply(a);
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
    if (id === 'log') { this.panel = this.panel?.kind === 'log' ? null : { kind: 'log' }; this.scroll = 0; return; }
    if (id === 'scrap0' || id === 'scrap1') { this.panel = { kind: 'scrap', seat: id === 'scrap0' ? 0 : 1 }; this.scroll = 0; return; }
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
    if (id === 'cancel') { this.armed = null; this.picked = null; return; }
    if (id === 'mulligan') { this.apply({ type: 'mulligan', replace: [...this.mull] }); return; }
    if (id === 'pass') { this.apply({ type: 'pass' }); return; }
    if (id === 'attack') { this.apply({ type: 'attack' }); return; }
    if (id === 'blocks') { this.apply({ type: 'blocks' }); return; }
    if (id === 'channel' && this.armed) { this.apply({ type: 'channel', iid: this.armed.iid }); return; }
    if (id === 'noduel' && this.picked) { this.apply({ type: 'declare', unit: this.picked.iid }); return; }
    if (id === 'play' && this.armed) {
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

  private clickObject(id: string): void {
    const s = this.s;
    if (!this.myTurn) return;
    if (this.armed) {
      const next = this.nextChoices();
      const key = next.has(id) ? id : next.has(`R:${id}`) ? `R:${id}` : null;
      if (!key) { this.note = 'That is not a legal choice for this card.'; return; }
      this.armed.path.push(key);
      if (this.nextChoices().size === 0) this.press('play');
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

  pointerMove(x: number, y: number): void {
    this.hover = this.hit(x, y);
  }

  private hit(x: number, y: number): Hot | null {
    for (let i = this.hots.length - 1; i >= 0; i--) {
      const h = this.hots[i];
      if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h;
    }
    return null;
  }

  pointerDown(x: number, y: number): void {
    const h = this.hit(x, y);
    if (!h) {
      if (this.armed || this.picked) { this.armed = null; this.picked = null; }
      return;
    }
    if (h.kind === 'button') this.press(h.id);
    else if (this.menu) return;
    else if (h.kind === 'hand') this.clickHand(h.id);
    else if (h.kind === 'unit' || h.kind === 'spire' || h.kind === 'stack') this.clickObject(h.id);
  }

  key(code: string): void {
    if (this.panel) {
      if (code === 'Escape' || code === 'KeyL') this.panel = null;
      else if (code === 'ArrowUp' || code === 'PageUp') this.scroll += code === 'PageUp' ? 20 : 2;
      else if (code === 'ArrowDown' || code === 'PageDown') this.scroll = Math.max(0, this.scroll - (code === 'PageDown' ? 20 : 2));
      return;
    }
    if (code === 'KeyL') { this.panel = { kind: 'log' }; this.scroll = 0; return; }
    if (code === 'Escape') {
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

    this.drawBar(g, v, 1, 0);
    this.drawLine(g, v, 1, FOE_LINE_Y, t);
    this.drawMiddle(g, v, t);
    this.drawLine(g, v, 0, MY_LINE_Y, t);
    this.drawBar(g, v, 0, MY_BAR_Y);
    this.drawCombat(g, v, t);
    this.drawHand(g, v, t);
    this.spawnFx(v, t);
    this.drawFx(g, t);
    if (v.phase === 'over') this.drawOver(g, v);
    this.drawButtons(g);
    if (this.panel) this.drawPanel(g, v);
    else if (this.hover && !this.menu && v.phase !== 'over') this.drawDetail(g, v, this.hover);
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
      // Scrap opens the Scrap viewer for this player
      if (k === 'Scrap') this.hots.push({ x: start - 2, y: y + 1, w: ix - start - 6, h: 9, id: `scrap${seat}`, kind: 'button' });
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

  private drawLine(g: Gfx, v: GameState, seat: Seat, y: number, t: number): void {
    const line = v.players[seat].line;
    const sg = slotGeo();
    for (let i = 0; i < LIMITS.line; i++) {
      const x = Math.round(sg.x0 + i * sg.dx);
      const u = line[i];
      if (u) this.unitTile(g, v, u, x, y, t, this.roleOf(v, u));
      else {
        fillRound(g, x, y, sg.w, SLOT.h, 'ink', 0.35, 4);
        g.ctx.save();
        g.ctx.setLineDash([3, 3]);
        frame(g, x + 1, y + 1, sg.w - 2, SLOT.h - 2, seat === 0 ? 'brassShadow' : 'emberNight', 4);
        g.ctx.restore();
      }
    }
  }

  private drawMiddle(g: Gfx, v: GameState, t: number): void {
    const ctx = g.ctx;
    const top = MID_Y - 4, h = MY_LINE_Y - MID_Y + 2;
    const gr = ctx.createLinearGradient(0, top, 0, top + h);
    gr.addColorStop(0, rgba('ink', 0.55));
    gr.addColorStop(0.5, rgba('duskZenith', 0.78));
    gr.addColorStop(1, rgba('ink', 0.55));
    ctx.fillStyle = gr;
    ctx.fillRect(0, top + 2, HW, h - 4);
    const lx = logX();
    const pr = this.note || this.prompt();
    const lines = wrapPx(pr, lx - 14, 1, 'bold');
    lines.slice(0, 2).forEach((l, i) => drawText(g, l, 8, MID_Y + i * 10, { color: this.note ? 'emberGlow' : 'brassGlint', face: 'bold', shadow: 'ink' }));
    // stack, newest on top
    let sy = MID_Y + 22;
    drawText(g, v.stack.length ? 'Stack (newest first)' : `Round ${v.round}`, 8, sy, { color: 'ironLight', face: v.stack.length ? 'body' : 'display' });
    sy += 11;
    const next = this.nextChoices();
    for (const it of [...v.stack].reverse().slice(0, 5)) {
      const label = `${it.owner === 0 ? 'You' : 'Foe'}: ${this.name(it.card, it.owner)}`;
      const on = next.has(it.sid);
      if (on) highlight(g, 4, sy - 2, lx - 12, 10.5, 'brass');
      else fillRound(g, 4, sy - 2, lx - 12, 10.5, 'ironNight', 0.75, 2);
      drawText(g, fitText(label, lx - 20), 8, sy, { color: on ? 'brassGlint' : 'steamWhite' });
      this.hots.push({ x: 4, y: sy - 1, w: lx - 10, h: 10, id: it.sid, kind: 'stack' });
      sy += 11;
    }
    // log: the latest lines
    const log = v.log.slice(-60);
    const out: string[] = [];
    for (const e of log) out.push(...wrapPx(lineText(e, (id) => face(this.s, e.seat ?? 0, id).name), HW - lx - 12));
    const shown = out.slice(-7);
    ctx.fillStyle = rgba('brass', 0.6);
    ctx.fillRect(lx, MID_Y - 2, 1, 78);
    shown.forEach((l, i) => drawText(g, l, lx + 6, MID_Y + i * 10, { color: i === shown.length - 1 ? 'steamWhite' : 'steam', alpha: i === shown.length - 1 ? 1 : 0.55 + (0.4 * i) / shown.length }));
    void t;
  }

  private drawHand(g: Gfx, v: GameState, _t: number): void {
    const p = v.players[0];
    const acts = this.acts();
    const cg = cardGeo();
    const cw = cg.w;
    const ctx = g.ctx;
    for (let i = 0; i < p.hand.length; i++) {
      const h = p.hand[i];
      const x = Math.round(cg.x0 + i * cg.dx);
      const armed = this.armed?.iid === h.iid;
      const y = HAND_Y - (armed ? 6 : 0);
      const d = def(h.card);
      const f = face(v, 0, h.card);
      const playable = acts.some((a) => (a.type === 'play' || a.type === 'channel') && a.iid === h.iid);
      const marked = this.mull.has(h.iid);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      fillRound(g, x, y, cw, CARD.h, d.type === 'glyph' ? 'duskHigh' : 'ironNight', 0.97, 4);
      ctx.restore();
      const art = cardArt(h.card, f.ascended);
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
      const cost = costOf(this.s, 0, h.card);
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
      const edge: Ink = armed ? 'crystalBright' : marked ? 'emberBright' : playable ? 'brassLight' : 'ink';
      frame(g, x, y, cw, CARD.h, edge, 4, armed);
      this.hots.push({ x, y, w: cw, h: CARD.h, id: h.iid, kind: 'hand' });
    }
    if (p.hand.length === 0) drawText(g, 'Your hand is empty', 8, HAND_Y + 40, { color: 'ironLight' });
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
      const y = over ? 226 : MID_Y + 57;
      button(g, b.label, x, y, { w, h: 17, state: b.enabled ? (this.hover?.id === b.id ? 'hot' : 'on') : 'off' });
      if (b.enabled) this.hots.push({ x, y, w, h: 17, id: b.id, kind: 'button' });
      x -= 8;
    }
  }

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
    if (!cardId || cardId === '?') return;
    const d = def(cardId);
    const f = face(v, seat, cardId);
    const w = 260, hgt = 262;
    const x = h.x + h.w / 2 < HW / 2 ? HW - w - 6 : 6;
    const y = 36;
    panel(g, x, y, w, hgt, { tone: 'dark' });
    const art = cardArt(cardId, f.ascended, true);
    if (art) {
      const unclip = clipRound(g, x + 8, y + 8, 128, 96, 3);
      drawPic(g, art, x + 8, y + 8);
      unclip();
      frame(g, x + 8, y + 8, 128, 96, 'brassDark', 3);
    } else drawTextCentred(g, isMissing(cardId, f.ascended, true) || !CARD_ART[cardId]?.art ? 'No art' : '…', x + 72, y + 50, { color: 'iron' });
    const tx = x + 144, tw = w - 152;
    const nm = wrapPx(f.name, tw, 1.15, 'bold');
    nm.forEach((l, i) => drawText(g, l, tx, y + 10 + i * 11, { color: 'brassGlint', face: 'bold', scale: 1.15 }));
    let yy = y + 14 + nm.length * 11;
    drawText(g, d.type === 'glyph' ? `Tactic, ${d.speed ?? ''}` : d.type === 'hero' ? (f.ascended ? 'Hero, ascended' : 'Hero') : d.token ? 'Token unit' : 'Unit', tx, yy, { color: 'steam' });
    yy += 14;
    const cost = seat === 0 ? costOf(this.s, 0, cardId) : d.cost;
    this.badge(g, tx + 6, yy + 3, cost, 'cost');
    drawText(g, 'cost', tx + 15, yy, { color: 'ironLight', scale: 0.9 });
    if (d.type !== 'glyph') {
      const st = unit ? stats(v, unit) : null;
      this.badge(g, tx + 6, yy + 19, st ? st.power : f.power, 'power');
      drawText(g, 'power', tx + 15, yy + 16, { color: 'ironLight', scale: 0.9 });
      const hp = st ? st.hp : f.health;
      this.badge(g, tx + 6, yy + 35, hp, st && st.hp < st.health ? 'hurt' : 'health');
      drawText(g, st ? `health (of ${st.health})` : 'health', tx + 15, yy + 32, { color: 'ironLight', scale: 0.9 });
    }
    let ty = y + 114;
    rule(g, x + 8, ty - 5, w - 16);
    for (const l of wrapPx(f.text, w - 18)) { drawText(g, l, x + 9, ty, { color: 'steamWhite' }); ty += 10.5; }
    const kws = unit ? stats(v, unit).keywords : f.keywords;
    for (const k of kws) {
      ty += 2;
      const lines = wrapPx(`${KEYWORD_HELP[k].name}: ${KEYWORD_HELP[k].text}`, w - 18, 0.95);
      for (const [i, l] of lines.entries()) {
        if (ty > y + hgt - 14) break;
        if (i === 0) {
          const kw = `${KEYWORD_HELP[k].name}:`;
          drawText(g, kw, x + 9, ty, { color: 'crystalBright', face: 'bold', scale: 0.95 });
          drawText(g, l.slice(kw.length), x + 9 + textWidth(kw, 0.95, 'bold'), ty, { color: 'steam', scale: 0.95 });
        } else drawText(g, l, x + 9, ty, { color: 'steam', scale: 0.95 });
        ty += 10;
      }
    }
    if (d.level && !f.ascended && ty < y + hgt - 20) {
      const p = v.players[seat];
      const have = d.level.who === 'you' ? p.seen[d.level.stat] ?? 0 : unit?.seen[d.level.stat] ?? 0;
      ty += 3;
      for (const l of wrapPx(`Ascends: ${d.level.text} (${Math.min(have, d.level.n)}/${d.level.n})`, w - 18)) {
        drawText(g, l, x + 9, ty, { color: 'brassLight' });
        ty += 10.5;
      }
    }
    if (unit?.stasis && ty < y + hgt - 10) drawText(g, 'In Stasis: cannot attack or block', x + 9, ty, { color: 'crystalWhite' });
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

  /** New log events become floating numbers over what they hit (the log still says it in words). */
  private spawnFx(v: GameState, t: number): void {
    if (this.seenLog < 0 || this.seenLog > v.log.length) this.seenLog = v.log.length; // a resumed game starts quiet
    const fresh = v.log.slice(this.seenLog);
    this.seenLog = v.log.length;
    const crystalAt = (seat: Seat | undefined): [number, number] => [66, seat === 0 ? MY_BAR_Y + 12 : 12];
    const at = (iid?: string) => (iid ? this.pos.get(iid) : undefined);
    for (const e of fresh) {
      playEvent(e, 0);
      const sign = (n: number | undefined) => `${(n ?? 0) >= 0 ? '+' : ''}${n ?? 0}`;
      let p: [number, number] | undefined;
      if (e.k === 'dmg' && (p = at(e.tunit))) this.fx.push({ x: p[0], y: p[1], text: `-${e.n ?? 0}`, ink: 'emberBright', born: t });
      else if (e.k === 'heal' && (p = at(e.tunit))) this.fx.push({ x: p[0], y: p[1], text: `+${e.n ?? 0}`, ink: 'crystalBright', born: t });
      else if (e.k === 'buff' && (p = at(e.tunit))) this.fx.push({ x: p[0], y: p[1] - 10, text: `${sign(e.n)}|${sign(e.m)}`, ink: 'brassGlint', born: t });
      else if (e.k === 'spireDmg') { p = crystalAt(e.seat); this.fx.push({ x: p[0], y: p[1], text: `-${e.n ?? 0}`, ink: 'emberGlow', born: t }); }
      else if (e.k === 'spireHeal') { p = crystalAt(e.seat); this.fx.push({ x: p[0], y: p[1], text: `+${e.n ?? 0}`, ink: 'crystalBright', born: t }); }
      else if (e.k === 'die' && (p = at(e.unit))) this.fx.push({ x: p[0], y: p[1], text: '', ink: 'emberGlow', born: t, flash: true });
    }
  }

  private drawFx(g: Gfx, t: number): void {
    this.fx = this.fx.filter((f) => t - f.born < 50);
    for (const f of this.fx) {
      const age = t - f.born;
      const fade = Math.max(0, 1 - age / 50);
      if (f.flash) {
        const sw = slotGeo().w;
        g.ctx.save();
        g.ctx.globalAlpha = fade;
        frame(g, f.x - sw / 2, f.y - SLOT.h / 2, sw, SLOT.h, f.ink, 4, true);
        g.wash(f.x - sw / 2, f.y - SLOT.h / 2, sw, SLOT.h, f.ink, 0.25 * fade);
        g.ctx.restore();
        continue;
      }
      drawTextCentred(g, f.text, f.x, f.y - age / 2, { color: f.ink, face: 'bold', outline: 'ink', glow: f.ink, scale: 2, alpha: Math.min(1, fade * 1.6) });
    }
  }

  /** The whole log, or a player's Scrap, newest at the bottom; arrows or the buttons scroll. */
  private drawPanel(g: Gfx, v: GameState): void {
    const x = 16, y = 30, w = HW - 32, h = HH - 60;
    panel(g, x, y, w, h, { tone: 'dark' });
    const p = this.panel!;
    let lines: { text: string; ink: Ink }[];
    if (p.kind === 'log') {
      lines = v.log.flatMap((e) => wrapPx(lineText(e, (id) => face(this.s, e.seat ?? 0, id).name), w - 24)
        .map((text): { text: string; ink: Ink } => ({ text, ink: e.k === 'round' ? 'brassLight' : 'steamWhite' })));
    } else {
      const scrap = v.players[p.seat].scrap;
      lines = scrap.map((id, i): { text: string; ink: Ink } => ({ text: `${i + 1}. ${face(v, p.seat, id).name} (${def(id).type === 'glyph' ? 'tactic' : def(id).type}, cost ${def(id).cost})`, ink: 'steamWhite' }));
      if (lines.length === 0) lines = [{ text: 'Nothing in the Scrap yet.', ink: 'iron' }];
    }
    const title = p.kind === 'log' ? 'BATTLE LOG' : `${p.seat === 0 ? 'YOUR' : "THE FOE'S"} SCRAP (${v.players[p.seat].scrap.length})`;
    drawText(g, title, x + 12, y + 9, { color: 'brassGlint', face: 'display', scale: 1.4 });
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
