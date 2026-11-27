// The match screen (PLAN D17): the SNES hi-res mode, 512 x 448. Both Lines, both Boilers, the hand, the stack,
// the log and the prompt. Every choice comes from legalActions: a click narrows the legal actions, so the screen can
// never offer a move the engine would refuse, and never makes a choice for the player (KB rules 8 and 12).
import type { Action, GameState, Keyword, Seat, Unit } from '../engine/types';
import { LIMITS, spireId } from '../engine/types';
import { legalActions, whyNotPlay, whyNotDeclare } from '../engine/rules';
import { costOf, def, face, stats } from '../engine/query';
import { view } from '../engine/view';
import { drawText, drawTextCentred, textWidth } from '../font';
import { Gfx, drawSprite } from '../gfx';
import type { Ink } from '../palette';
import { wrap } from '../gallery-text';
import { CURSOR, CURSOR_LEGEND } from '../sprites';
import { drawWindow } from '../title';
import { FACTIONS } from '../data/factions';
import { CARD_ART } from '../data/cardart';
import { cardArt, emblem, field, isMissing } from './art';
import { END_REASONS, KEYWORD_HELP, lineText, targetPrompt } from './text';
import type { Session } from './session';

export const HW = 512;
export const HH = 448;

const SLOT = { w: 82, h: 104, dx: 84, x0: 4 };
const FOE_LINE_Y = 24;
const MID_Y = 130;
const MY_LINE_Y = 210;
const MY_BAR_Y = 316;
const HAND_Y = 342;
const CARD = { w: 49, h: 104, dx: 50, x0: 6 };
const AI_DELAY = 520;

interface Hot { x: number; y: number; w: number; h: number; id: string; kind: 'hand' | 'unit' | 'spire' | 'stack' | 'button' | 'hero' }
interface Button { id: string; label: string; enabled: boolean }

const KW_SHORT: Record<Keyword, string> = {
  vanguard: 'VAN', pierce: 'PRC', aerial: 'AIR', spotter: 'SPT', plated: 'PLT', siphon: 'SPH',
  ward: 'WRD', dueler: 'DUL', dread: 'DRD', unstable: 'UNS', mend: 'MND', corrosive: 'COR',
};

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
  /** Set when the player leaves; main.ts returns to the title. */
  exit: 'title' | 'rematch' | null = null;
  /** Called once when the match ends (the roguelike reads the result). */
  onOver: ((winner: Seat | 'draw' | null) => void) | null = null;
  private overSent = false;
  /** Play-test mode (?auto in the URL): the AI plays our seat too, through this same screen. */
  auto = false;
  delay = AI_DELAY;
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

  // ---------- drawing ----------

  draw(g: Gfx, t: number): void {
    this.hots = [];
    const v = view(this.s, 0);
    const bg = field(FACTIONS.find((f) => f.engine === def(v.players[0].heroes[0] ?? v.players[0].deckList[0]).faction)?.field ?? 'vaskor');
    if (bg) g.ctx.drawImage(bg, 0, 0, HW, HH);
    else g.rect(0, 0, HW, HH, 'duskZenith');
    g.dither50(0, 0, HW, HH, 'ink');

    this.drawBar(g, v, 1, 0);
    this.drawLine(g, v, 1, FOE_LINE_Y, t);
    this.drawMiddle(g, v, t);
    this.drawLine(g, v, 0, MY_LINE_Y, t);
    this.drawBar(g, v, 0, MY_BAR_Y);
    this.drawHand(g, v, t);
    if (v.phase === 'over') this.drawOver(g, v);
    this.drawButtons(g);
    if (this.hover && !this.menu && v.phase !== 'over') this.drawDetail(g, v, this.hover);
    if (this.menu) this.drawMenu(g);
  }

  private drawBar(g: Gfx, v: GameState, seat: Seat, y: number): void {
    const p = v.players[seat];
    g.rect(0, y, HW, 22, 'ironNight');
    g.rect(0, y + 21, HW, 1, 'brassDark');
    const fk = p.deckList.length ? factionOf(p.deckList[0]) : 'dominion';
    const em = emblem(fk);
    if (em) g.ctx.drawImage(em, 2, y + 1, 20, 20);
    const who = seat === 0 ? 'YOU' : 'FOE';
    drawText(g, who, 26, y + 2, { color: seat === 0 ? 'brassGlint' : 'emberGlow' });
    if (v.initiative === seat) {
      // the Initiative: a small brass diamond beside the name
      g.rect(48, y + 4, 3, 1, 'brassGlint');
      g.rect(47, y + 5, 5, 1, 'brassGlint');
      g.rect(48, y + 6, 3, 1, 'brassGlint');
      this.hots.push({ x: 44, y: y + 1, w: 10, h: 10, id: 'initiative', kind: 'button' });
    }
    // the Boiler: a click target for "unit or Boiler" cards
    const bx = 56;
    const bossOn = this.nextChoices().has(spireId(seat));
    g.rect(bx, y + 1, 64, 19, bossOn ? 'brassGlint' : 'ink');
    g.rect(bx + 1, y + 2, 62, 17, p.spire <= 5 ? 'emberDeep' : 'ironDark');
    drawText(g, `BOILER ${p.spire}`, bx + 4, y + 7, { color: p.spire <= 5 ? 'emberGlow' : 'steamWhite' });
    this.hots.push({ x: bx, y: y + 1, w: 64, h: 19, id: spireId(seat), kind: 'spire' });
    const info = `CHARGE ${p.charge}/${p.maxCharge}  RES ${p.reserve}  HAND ${p.hand.length}  DECK ${p.deck.length}  SCRAP ${p.scrap.length}`;
    drawText(g, info, 126, y + 2, { color: 'steam' });
    // hero progress, open information (R-H3)
    let hx = 126;
    for (const h of p.heroes) {
      const d = def(h);
      const asc = p.ascended.includes(h);
      const lv = d.level;
      const have = lv ? (lv.who === 'you' ? p.seen[lv.stat] ?? 0 : 0) : 0;
      const words = face(v, seat, h).name.split(',')[0].split(' ');
      const short = (words.length > 2 ? words.slice(1) : words).join(' ').toUpperCase();
      const label = `${short} ${asc ? 'ASCENDED' : lv ? `${Math.min(have, lv.n)}/${lv.n}` : ''}`;
      drawText(g, label, hx, y + 12, { color: asc ? 'brassGlint' : 'ironLight' });
      this.hots.push({ x: hx, y: y + 11, w: textWidth(label), h: 9, id: h, kind: 'hero' });
      hx += textWidth(label) + 12;
    }
    if (seat === 0) {
      const lbl = 'MENU';
      const mx = HW - textWidth(lbl) - 10;
      g.rect(mx - 4, y + 3, textWidth(lbl) + 8, 15, 'ink');
      drawText(g, lbl, mx, y + 7, { color: 'brassLight' });
      this.hots.push({ x: mx - 4, y: y + 3, w: textWidth(lbl) + 8, h: 15, id: 'menu', kind: 'button' });
    }
  }

  private unitTile(g: Gfx, v: GameState, u: Unit, x: number, y: number, t: number, role: string): void {
    const st = stats(v, u);
    const f = face(v, u.owner, u.card);
    const next = this.nextChoices();
    const choosable = next.has(u.iid) || next.has(`R:${u.iid}`) || (this.picked?.mode === 'duel' && u.owner === 1);
    const pulse = (t >> 4) % 2 === 0;
    const edge: Ink = choosable ? (pulse ? 'brassGlint' : 'emberBright') : this.picked?.iid === u.iid ? 'gloamBright' : role ? 'emberGlow' : f.ascended ? 'brassLight' : 'ink';
    g.rect(x, y, SLOT.w, SLOT.h, edge);
    g.rect(x + 1, y + 1, SLOT.w - 2, SLOT.h - 2, u.owner === 0 ? 'ironDark' : 'emberNight');
    const name = f.name.toUpperCase();
    drawText(g, name.length > 13 ? name.slice(0, 12) + '.' : name, x + 3, y + 3, { color: 'steamWhite' });
    const art = cardArt(u.card, f.ascended);
    if (art) g.ctx.drawImage(art, x + 9, y + 12);
    else g.rect(x + 9, y + 12, 64, 48, 'ironNight');
    if (u.stasis) { g.dither50(x + 9, y + 12, 64, 48, 'gloamWhite'); drawTextCentred(g, 'STASIS', x + 41, y + 32, { color: 'ink' }); }
    if (u.ward) { g.rect(x + 8, y + 11, 66, 1, 'gloamBright'); g.rect(x + 8, y + 60, 66, 1, 'gloamBright'); g.rect(x + 8, y + 11, 1, 50, 'gloamBright'); g.rect(x + 73, y + 11, 1, 50, 'gloamBright'); }
    const kws = st.keywords.map((k) => KW_SHORT[k]).join(' ');
    drawText(g, kws.length > 13 ? kws.slice(0, 13) : kws, x + 3, y + 64, { color: 'gloamBright' });
    if (role) drawText(g, role, x + 3, y + 74, { color: 'emberGlow' });
    drawText(g, String(st.power), x + 6, y + 86, { color: 'brassGlint', scale: 2 });
    const hp = String(st.hp);
    drawText(g, hp, x + SLOT.w - 6 - textWidth(hp, 2), y + 86, { color: st.hp < st.health ? 'emberBright' : 'steamWhite', scale: 2 });
    if (u.silenced) drawText(g, 'SIL', x + 34, y + 90, { color: 'iron' });
    this.hots.push({ x, y, w: SLOT.w, h: SLOT.h, id: u.iid, kind: 'unit' });
  }

  private roleOf(v: GameState, u: Unit): string {
    const c = v.combat;
    if (!c) return '';
    const pr = c.pairs.find((p) => p.att === u.iid);
    if (pr) return `ATTACK ${c.pairs.indexOf(pr) + 1}`;
    const bl = c.pairs.find((p) => p.blk === u.iid);
    if (bl) return `BLOCK ${c.pairs.indexOf(bl) + 1}`;
    return '';
  }

  private drawLine(g: Gfx, v: GameState, seat: Seat, y: number, t: number): void {
    const line = v.players[seat].line;
    for (let i = 0; i < LIMITS.line; i++) {
      const x = SLOT.x0 + i * SLOT.dx;
      const u = line[i];
      if (u) this.unitTile(g, v, u, x, y, t, this.roleOf(v, u));
      else {
        g.rect(x, y, SLOT.w, SLOT.h, 'ink');
        g.dither25(x + 1, y + 1, SLOT.w - 2, SLOT.h - 2, 'ironDark');
      }
    }
  }

  private drawMiddle(g: Gfx, v: GameState, t: number): void {
    g.rect(0, MID_Y - 4, HW, MY_LINE_Y - MID_Y + 2, 'ink');
    g.dither50(0, MID_Y - 4, HW, MY_LINE_Y - MID_Y + 2, 'duskZenith');
    const pr = this.note || this.prompt();
    const lines = wrap(pr.toUpperCase(), 48);
    lines.slice(0, 2).forEach((l, i) => drawText(g, l, 6, MID_Y - 1 + i * 9, { color: this.note ? 'emberGlow' : 'brassGlint' }));
    // stack, newest on top
    let sy = MID_Y + 20;
    drawText(g, v.stack.length ? 'STACK (NEWEST FIRST)' : `ROUND ${v.round}`, 6, sy, { color: 'ironLight' });
    sy += 10;
    const next = this.nextChoices();
    for (const it of [...v.stack].reverse().slice(0, 5)) {
      const label = `${it.owner === 0 ? 'YOU' : 'FOE'}: ${this.name(it.card, it.owner).toUpperCase()}`;
      const on = next.has(it.sid);
      g.rect(4, sy - 1, 290, 10, on ? 'brassDark' : 'ironNight');
      drawText(g, label.slice(0, 48), 6, sy, { color: on ? 'brassGlint' : 'steamWhite' });
      this.hots.push({ x: 4, y: sy - 1, w: 290, h: 10, id: it.sid, kind: 'stack' });
      sy += 10;
    }
    // log: the latest lines
    const log = v.log.slice(-60);
    const out: string[] = [];
    for (const e of log) {
      const txt = lineText(e, (id) => face(this.s, e.seat ?? 0, id).name).toUpperCase();
      out.push(...wrap(txt, 34));
    }
    const shown = out.slice(-8);
    g.rect(300, MID_Y - 3, 1, 80, 'brassDark');
    shown.forEach((l, i) => drawText(g, l, 304, MID_Y - 1 + i * 9, { color: i === shown.length - 1 ? 'steamWhite' : 'ironLight' }));
    void t;
  }

  private drawHand(g: Gfx, v: GameState, t: number): void {
    const p = v.players[0];
    const acts = this.acts();
    for (let i = 0; i < p.hand.length; i++) {
      const h = p.hand[i];
      const x = CARD.x0 + i * CARD.dx;
      const y = HAND_Y - (this.armed?.iid === h.iid ? 6 : 0);
      const d = def(h.card);
      const f = face(v, 0, h.card);
      const playable = acts.some((a) => (a.type === 'play' || a.type === 'channel') && a.iid === h.iid);
      const marked = this.mull.has(h.iid);
      g.rect(x, y, CARD.w, CARD.h, this.armed?.iid === h.iid ? 'gloamBright' : marked ? 'emberBright' : playable ? 'brassLight' : 'ink');
      g.rect(x + 1, y + 1, CARD.w - 2, CARD.h - 2, d.type === 'glyph' ? 'duskHigh' : 'ironDark');
      const art = cardArt(h.card, f.ascended);
      if (art) g.ctx.drawImage(art, 8, 0, 47, 48, x + 1, y + 12, 47, 48);
      const cost = String(costOf(this.s, 0, h.card));
      g.rect(x + 1, y + 1, 12, 10, 'ink');
      drawText(g, cost, x + 4, y + 3, { color: cost === String(d.cost) ? 'brassGlint' : 'gloamBright' });
      drawText(g, d.type === 'glyph' ? (d.speed ?? '').slice(0, 1).toUpperCase() : d.type === 'hero' ? 'H' : 'U', x + CARD.w - 8, y + 3, { color: 'ironLight' });
      wrap(f.name.toUpperCase(), 8).slice(0, 3).forEach((l, j) => drawText(g, l, x + 2, y + 62 + j * 9, { color: 'steamWhite' }));
      if (d.type !== 'glyph') drawText(g, `${f.power}|${f.health}`, x + 3, y + 93, { color: 'brassLight' });
      if (marked) drawText(g, 'SWAP', x + 12, y + 30, { color: 'emberGlow', outline: 'ink' });
      this.hots.push({ x, y, w: CARD.w, h: CARD.h, id: h.iid, kind: 'hand' });
    }
    if (p.hand.length === 0) drawText(g, 'YOUR HAND IS EMPTY', 6, HAND_Y + 40, { color: 'iron' });
    void t;
  }

  private drawButtons(g: Gfx): void {
    const btns = this.buttons();
    const over = this.s.phase === 'over';
    // at the end of a battle the buttons sit inside the result panel, centred
    let x = over ? HW / 2 + btns.reduce((a, b) => a + textWidth(b.label) + 20, -6) / 2 : HW - 6;
    for (const b of [...btns].reverse()) {
      const w = textWidth(b.label) + 14;
      x -= w;
      const y = over ? 226 : MID_Y + 58;
      g.rect(x, y, w, 16, 'ink');
      g.rect(x + 1, y + 1, w - 2, 14, b.enabled ? 'brassDark' : 'ironDark');
      g.rect(x + 1, y + 1, w - 2, 1, b.enabled ? 'brassLight' : 'iron');
      drawText(g, b.label, x + 7, y + 5, { color: b.enabled ? 'brassGlint' : 'iron' });
      if (b.enabled) this.hots.push({ x, y, w, h: 16, id: b.id, kind: 'button' });
      x -= 6;
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
    const w = 250, hgt = 250;
    const x = h.x + h.w / 2 < HW / 2 ? HW - w - 4 : 4;
    const y = 40;
    drawWindow(g, x, y, w, hgt);
    const art = cardArt(cardId, f.ascended, true);
    if (art) g.ctx.drawImage(art, x + 8, y + 8);
    else drawTextCentred(g, isMissing(cardId, f.ascended, true) || !CARD_ART[cardId]?.art ? 'NO ART' : '...', x + 72, y + 50, { color: 'iron' });
    const nm = wrap(f.name.toUpperCase(), 17);
    nm.forEach((l, i) => drawText(g, l, x + 140, y + 10 + i * 9, { color: 'brassGlint' }));
    let yy = y + 14 + nm.length * 9;
    drawText(g, d.type === 'glyph' ? `TACTIC ${(d.speed ?? '').toUpperCase()}` : d.type === 'hero' ? (f.ascended ? 'HERO, ASCENDED' : 'HERO') : d.token ? 'TOKEN UNIT' : 'UNIT', x + 140, yy, { color: 'steam' });
    yy += 11;
    drawText(g, `COST ${seat === 0 ? costOf(this.s, 0, cardId) : d.cost}`, x + 140, yy, { color: 'steamWhite' });
    if (d.type !== 'glyph') {
      const st = unit ? stats(v, unit) : null;
      drawText(g, `POWER ${st ? st.power : f.power}`, x + 140, yy + 10, { color: 'steamWhite' });
      drawText(g, `HEALTH ${st ? `${st.hp}/${st.health}` : f.health}`, x + 140, yy + 20, { color: 'steamWhite' });
    }
    let ty = y + 110;
    for (const l of wrap(f.text.toUpperCase(), 39)) { drawText(g, l, x + 8, ty, { color: 'steamWhite' }); ty += 9; }
    const kws = unit ? stats(v, unit).keywords : f.keywords;
    for (const k of kws) {
      for (const l of wrap(`${KEYWORD_HELP[k].name.toUpperCase()}: ${KEYWORD_HELP[k].text.toUpperCase()}`, 39)) {
        if (ty > y + hgt - 20) break;
        drawText(g, l, x + 8, ty, { color: 'gloamBright' });
        ty += 9;
      }
    }
    if (d.level && !f.ascended && ty < y + hgt - 20) {
      const p = v.players[seat];
      const have = d.level.who === 'you' ? p.seen[d.level.stat] ?? 0 : unit?.seen[d.level.stat] ?? 0;
      for (const l of wrap(`ASCENDS: ${d.level.text.toUpperCase()} (${Math.min(have, d.level.n)}/${d.level.n})`, 39)) {
        drawText(g, l, x + 8, ty, { color: 'brassLight' });
        ty += 9;
      }
    }
    if (unit?.stasis && ty < y + hgt - 10) drawText(g, 'IN STASIS: CANNOT ATTACK OR BLOCK', x + 8, ty, { color: 'gloamWhite' });
  }

  private drawOver(g: Gfx, v: GameState): void {
    const w = 300, h = 90, x = (HW - w) / 2, y = 160;
    drawWindow(g, x, y, w, h);
    const head = v.winner === 0 ? 'VICTORY' : v.winner === 1 ? 'DEFEAT' : 'DRAW';
    drawTextCentred(g, head, HW / 2, y + 12, { color: v.winner === 0 ? 'brassGlint' : 'emberGlow', scale: 2 });
    drawTextCentred(g, (END_REASONS[v.endReason ?? ''] ?? '').toUpperCase(), HW / 2, y + 36, { color: 'steamWhite' });
    drawTextCentred(g, `${this.title.toUpperCase()}, ROUND ${v.round}`, HW / 2, y + 48, { color: 'ironLight' });
  }

  private drawMenu(g: Gfx): void {
    const w = 200, h = 96, x = (HW - w) / 2, y = 150;
    drawWindow(g, x, y, w, h);
    const items: [string, string][] = [['m-resume', 'RESUME'], ['m-title', 'SAVE AND QUIT TO TITLE'], ['m-concede', 'CONCEDE THIS BATTLE']];
    items.forEach(([id, label], i) => {
      const yy = y + 16 + i * 22;
      g.rect(x + 12, yy - 4, w - 24, 16, 'ironNight');
      drawText(g, label, x + 20, yy, { color: id === 'm-concede' ? 'emberGlow' : 'steamWhite' });
      this.hots.push({ x: x + 12, y: yy - 4, w: w - 24, h: 16, id, kind: 'button' });
    });
    drawSprite(g, CURSOR, CURSOR_LEGEND, x + 6, y + 16);
  }
}
