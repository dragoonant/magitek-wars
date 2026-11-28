// The Hero Expeditions screens (spec 21, PLAN D33, D34), hi-res 512 x 448: hero pick, expedition pick, the expedition map, rewards,
// Orders, Fittings, recruits, rest, depot, events, briefings and the end of a run. Battles use the match screen; this
// controller starts them and reads their result. The hero profile (ranks, R-E13) is kept in its own browser slot.
import { drawPic } from '../detail';
import type { GameState } from '../engine/types';
import { LIMITS } from '../engine/types';
import { allCards, def, face, type Face } from '../engine/query';
import { replay } from '../engine/save';
import { drawText, drawTextCentred, fitText, textWidth, wrapPx } from '../font';
import type { Gfx } from '../gfx';
import { PALETTE, rgba, type Ink } from '../palette';
import { backdrop, button, clipRound, fillRound, frame, highlight, panel, rule } from '../ui';
import { FACTIONS } from '../data/factions';
import { FACTION_INFO } from '../data/decks';
import { cardArt, emblem, portrait } from '../match/art';
import { HH, HW, Match } from '../match/board';
import { Session } from '../match/session';
import { bigCard, cardGrid, confirmCard, grouped, miniCard, scrollButtons } from '../cardgrid';
import {
  DEPOT, FACTION_NAMES, MIN_DECK, bossName, foeName, buy, canRemove, choices, chooseEvent, choosePick, deckFittings, enter, exp, finishBattle, fit,
  fitTargets, leaveDepot, newRun, removeForEvent, rest, restRepair, stop, takeReward, type RunState,
} from './run';
import { BOSS_INTRO, EVENTS } from '../run/events';
import { HEROES, MAX_RANK, hero, rankUnlock, type RunHero } from './heroes';
import { order } from './orders';
import { fitting } from './fittings';
import { EXPEDITIONS, rows, type Stop, type StopKind } from './expeditions';
import { PROFILE_KEY, addXp, heroRank, markWon, parseProfile, toNextRank, unlocked, type Profile } from './profile';

export const EXPEDITION_KEY = 'magitek-wars.expedition';

interface RunSave { game: 'magitek-wars.expedition'; version: 2; run: RunState; battleActions: string | null }

export function readExpedition(): { run: RunState; actions: unknown[] } | { problem: string } | null {
  let text: string | null;
  try {
    text = localStorage.getItem(EXPEDITION_KEY);
  } catch {
    return { problem: 'This browser does not allow saving, so the expedition cannot be kept.' };
  }
  if (text === null) return null;
  try {
    const s = JSON.parse(text) as { game?: string; version?: number; run?: RunState; battleActions?: string | null };
    if (s.game !== 'magitek-wars.expedition') return { problem: 'The saved expedition is damaged and cannot be opened.' };
    if (s.version !== 2 || !s.run) return { problem: 'The saved expedition is from another version and cannot be opened.' };
    return { run: s.run, actions: s.battleActions ? (JSON.parse(s.battleActions) as unknown[]) : [] };
  } catch {
    return { problem: 'The saved expedition is damaged and cannot be opened.' };
  }
}

function clearRun(): void {
  try {
    localStorage.removeItem(EXPEDITION_KEY);
  } catch {
    /* no storage */
  }
}

function loadProfile(): { profile: Profile; problem: string | null } {
  try {
    return parseProfile(localStorage.getItem(PROFILE_KEY));
  } catch {
    return { profile: parseProfile(null).profile, problem: 'This browser does not allow saving, so hero ranks will not be kept.' };
  }
}

export const KIND_STYLE: Record<StopKind, { letter: string; ink: Ink; name: string }> = {
  battle: { letter: 'S', ink: 'ironLight', name: 'BATTLE' },
  elite: { letter: 'E', ink: 'emberBright', name: 'ELITE' },
  boss: { letter: 'B', ink: 'emberGlow', name: 'BOSS' },
  rest: { letter: 'R', ink: 'crystalBright', name: 'REST' },
  depot: { letter: 'D', ink: 'brassLight', name: 'DEPOT' },
  event: { letter: '?', ink: 'steamWhite', name: 'EVENT' },
  order: { letter: 'O', ink: 'brassGlint', name: 'ORDER' },
  cache: { letter: 'C', ink: 'verdigris', name: 'CACHE' },
  recruit: { letter: 'H', ink: 'crystalWhite', name: 'RECRUIT' },
};
const LEVEL_NAME = { easy: 'Recruit', normal: 'Veteran', hard: 'Marshal' } as const;

type Hot = { x: number; y: number; w: number; h: number; id: string };
const stars = (n: number): string => `${n} ${n === 1 ? 'star' : 'stars'}`;
const shortName = (id: string): string => def(id).name;

export class ExpeditionScreen {
  run: RunState | null = null;
  match: Match | null = null;
  profile: Profile;
  problem = '';
  note = '';
  /** The hero picked on the first screen, before an expedition is chosen. */
  private chosen: string | null = null;
  /** Rank lines gained this run, for the end screen. */
  private rankUps: string[] = [];
  private deckOpen = false;
  private ordersOpen = false;
  private removing = false;
  private gridScroll = 0;
  private gridMax = 0;
  /** A picked card waiting for the player to confirm it, or a card opened for a closer look. */
  private confirm: { kind: 'cut' | 'evcut' | 'buy' | 'fit'; id: string } | null = null;
  private peek: string | null = null;
  private confirmAbandon = false;
  private foeDeckOpen = false;
  private hots: Hot[] = [];
  private hover: string | null = null;
  private savedActions = -1;
  /** Set when the player leaves for the title. */
  exit = false;

  constructor() {
    const p = loadProfile();
    this.profile = p.profile;
    if (p.problem) this.problem = p.problem;
    const r = readExpedition();
    if (r && 'problem' in r) this.problem = r.problem;
    else if (r) {
      this.run = r.run;
      if (r.run.phase === 'battle' && r.run.battle && r.actions.length) this.resumeBattle(r.actions as never[]);
    }
  }

  /** The card as it stands in this run: its Fitting included (R-X5). */
  private faceOf(id: string): Face {
    const r = this.run;
    if (!r) return face(null, 0, id);
    const fake = { players: [{ ascended: [], fittings: deckFittings(r) }, { ascended: [] }] } as unknown as GameState;
    return face(fake, 0, id);
  }

  // ---------- saving (R-E16) ----------
  private saveProfile(): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    } catch {
      this.note = 'This browser refused the save: hero ranks will be lost on reload.';
    }
  }

  /** Move the run's new XP into the hero's rank, and record a won expedition (R-E13, R-E14). */
  private bank(): void {
    const r = this.run;
    if (!r) return;
    const delta = r.xp - r.xpBanked;
    let changed = false;
    if (delta > 0) {
      const h = hero(r.hero);
      for (const rank of addXp(this.profile, r.hero, delta)) {
        this.rankUps.push(`Rank ${rank}: ${rankUnlock(h, rank, { order: (id) => order(id).name, fitting: (id) => fitting(id).name })}`);
      }
      r.xpBanked = r.xp;
      changed = true;
    }
    if (r.phase === 'won' && !this.profile.heroWon[r.hero]?.includes(r.expedition)) { markWon(this.profile, r.hero, r.expedition); changed = true; }
    if (changed) this.saveProfile();
  }

  private save(): void {
    if (!this.run) return;
    this.bank();
    const save: RunSave = { game: 'magitek-wars.expedition', version: 2, run: this.run, battleActions: this.match ? JSON.stringify(this.match.session.actions) : null };
    try {
      localStorage.setItem(EXPEDITION_KEY, JSON.stringify(save));
    } catch {
      this.note = 'This browser refused the save: the expedition will be lost on reload.';
    }
  }

  private startBattle(): void {
    const b = this.run!.battle!;
    const session = Session.start(b.setup, { deckNames: [shortName(this.run!.hero), b.foeName], difficulty: b.level }, true);
    this.attach(session);
  }

  private resumeBattle(actions: never[]): void {
    const b = this.run!.battle!;
    const { state, failedAt } = replay(b.setup, actions);
    if (failedAt !== null) {
      this.note = 'The saved battle could not be replayed; it starts again from its first move.';
      this.startBattle();
      return;
    }
    const session = Session.start(b.setup, { deckNames: [shortName(this.run!.hero), b.foeName], difficulty: b.level }, true);
    session.state = state;
    session.actions = [...actions];
    this.attach(session);
  }

  private attach(session: Session): void {
    const b = this.run!.battle!;
    this.match = new Match(session, `${KIND_STYLE[b.kind].name}: ${b.foeName}`);
    this.match.endLabel = 'CONTINUE';
    if (b.kind === 'boss') this.match.mood = 'tense';
    this.savedActions = -1;
  }

  /** Called every frame: autosave battle moves, and close the battle when it ends. */
  update(now: number): void {
    if (!this.match || !this.run) return;
    this.match.update(now);
    const s = this.match.session;
    if (s.actions.length !== this.savedActions) {
      this.savedActions = s.actions.length;
      this.save();
    }
    if (this.match.exit) {
      this.match.exit = null;
      if (s.state.phase === 'over') {
        finishBattle(this.run, s.state.winner, s.state.players[0].spire);
        this.match = null;
        this.save();
      } else this.exit = true; // "save and quit to title" from the battle menu
    }
  }

  // ---------- input ----------
  key(code: string): void {
    if (this.match) { this.match.key(code); return; }
    if (code === 'Escape') {
      if (this.confirm || this.peek) { this.confirm = null; this.peek = null; }
      else if (this.deckOpen || this.removing || this.ordersOpen) { this.deckOpen = false; this.removing = false; this.ordersOpen = false; }
      else if (!this.run && this.chosen) this.chosen = null;
      else this.exit = true;
    }
  }

  pointerMove(x: number, y: number): void {
    if (this.match) { this.match.pointerMove(x, y); return; }
    this.hover = this.hit(x, y)?.id ?? null;
  }

  private hit(x: number, y: number): Hot | undefined {
    for (let i = this.hots.length - 1; i >= 0; i--) {
      const h = this.hots[i];
      if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h;
    }
    return undefined;
  }

  wheel(dy: number): void {
    if (this.match) return;
    if (this.deckOpen || this.removing || this.run?.phase === 'eventRemove' || this.run?.phase === 'fit') {
      this.gridScroll = Math.max(0, Math.min(this.gridMax, this.gridScroll + Math.sign(dy)));
    }
  }

  pointerDown(x: number, y: number): void {
    if (this.match) { this.match.pointerDown(x, y); return; }
    const h = this.hit(x, y);
    if (!h) return;
    this.note = '';
    const [k, v] = h.id.split('|');
    const r = this.run;
    if (this.peek) { this.peek = null; return; }
    if (this.confirm) {
      const c = this.confirm;
      if (k === 'confirm-no') this.confirm = null;
      if (k !== 'confirm-yes' || !r) return;
      this.confirm = null;
      if (c.kind === 'cut') { rest(r, { kind: 'remove', card: c.id }); this.removing = false; }
      else if (c.kind === 'evcut') removeForEvent(r, c.id);
      else if (c.kind === 'fit') fit(r, c.id);
      else {
        const why = buy(r, `card:${c.id}`);
        if (why) this.note = why;
      }
      this.save();
      return;
    }
    if (k === 'grid-up') { this.gridScroll = Math.max(0, this.gridScroll - 1); return; }
    if (k === 'grid-down') { this.gridScroll = Math.min(this.gridMax, this.gridScroll + 1); return; }
    if (k === 'deck-bg' || k === 'orders-bg') { if (k === 'orders-bg') this.ordersOpen = false; return; }
    if (k === 'look') { this.peek = v; return; }
    if (k === 'cutpick') { this.confirm = { kind: 'cut', id: v }; return; }
    if (k === 'evpick') { this.confirm = { kind: 'evcut', id: v }; return; }
    if (k === 'fitpick') { this.confirm = { kind: 'fit', id: v }; return; }
    if (k === 'title') { this.exit = true; return; }
    // hero and expedition pick
    if (k === 'hero') { this.chosen = v; this.problem = ''; return; }
    if (k === 'unchoose') { this.chosen = null; return; }
    if (k === 'expedition' && this.chosen) {
      const rank = heroRank(this.profile, this.chosen);
      this.run = newRun(this.chosen, v, (Math.random() * 0x7fffffff) >>> 0, rank);
      this.rankUps = [];
      this.chosen = null;
      this.save();
      return;
    }
    if (k === 'locked') { this.note = `Win ${EXPEDITIONS[Number(v) - 1].name} with any hero to open this expedition.`; return; }
    if (!r) return;
    if (k === 'deck') { this.deckOpen = !this.deckOpen; this.ordersOpen = false; this.gridScroll = 0; return; }
    if (k === 'orders') { this.ordersOpen = !this.ordersOpen; this.deckOpen = false; return; }
    if (k === 'close') { this.deckOpen = false; this.removing = false; return; }
    if (k === 'abandon') { this.confirmAbandon = true; return; }
    if (k === 'abandon-yes') { clearRun(); this.run = null; this.confirmAbandon = false; return; }
    if (k === 'abandon-no') { this.confirmAbandon = false; return; }
    if (k === 'newrun') { clearRun(); this.chosen = r.hero; this.run = null; this.rankUps = []; return; }
    if (k === 'stop') { enter(r, v); this.foeDeckOpen = false; this.save(); return; }
    if (k === 'fight') { this.startBattle(); this.save(); return; }
    if (k === 'foedeck') { this.foeDeckOpen = !this.foeDeckOpen; return; }
    if (k === 'choice') {
      const why = chooseEvent(r, Number(v));
      if (why) this.note = why;
      this.save();
      return;
    }
    if (k === 'bundle') { takeReward(r, v === '-' ? null : Number(v)); this.save(); return; }
    if (k === 'pick') { choosePick(r, v === '-' ? null : v); this.gridScroll = 0; this.save(); return; }
    if (k === 'nofit') { fit(r, null); this.save(); return; }
    if (k === 'repair') { rest(r, { kind: 'repair' }); this.save(); return; }
    if (k === 'remove') { this.removing = true; this.gridScroll = 0; return; }
    if (k === 'buy') {
      if (v.startsWith('card:')) {
        const price = r.shop?.cards.find((x) => x.id === v.slice(5))?.price ?? 0;
        if (r.scrip < price) { this.note = `Needs ${price} scrip.`; return; }
        this.confirm = { kind: 'buy', id: v.slice(5) };
        return;
      }
      const why = buy(r, v);
      if (why) this.note = why;
      this.gridScroll = 0;
      this.save();
      return;
    }
    if (k === 'leave') { leaveDepot(r); this.save(); }
  }

  // ---------- drawing ----------
  draw(g: Gfx, t: number): void {
    if (this.match) { this.match.draw(g, t); return; }
    this.hots = [];
    const r = this.run;
    if (!r) {
      if (this.chosen) this.drawExpeditions(g, hero(this.chosen));
      else this.drawHeroes(g);
    } else {
      backdrop(g, HW, HH, exp(r).field, 0.5);
      if (r.phase === 'won' || r.phase === 'lost') this.drawEnd(g, r);
      else {
        this.drawMap(g, r, t);
        this.drawSide(g, r);
        const modal = r.phase !== 'map' && r.phase !== 'fit' && r.phase !== 'eventRemove';
        if (modal) g.wash(0, 0, HW, HH, 'ink', 0.45);
        if (r.phase === 'reward') this.drawReward(g, r);
        if (r.phase === 'pick') this.drawPick(g, r);
        if (r.phase === 'rest') this.drawRest(g, r);
        if (r.phase === 'depot') this.drawDepot(g, r);
        if (r.phase === 'event') this.drawEvent(g, r);
        if (r.phase === 'battle') this.drawBriefing(g, r);
      }
      if (this.deckOpen || this.removing || r.phase === 'eventRemove' || r.phase === 'fit') this.drawDeck(g, r);
      if (this.ordersOpen) this.drawOrders(g, r);
      if (this.confirm) this.drawConfirm(g, r);
      else if (this.peek) {
        g.wash(0, 0, HW, HH, 'ink', 0.55);
        this.hots.push({ x: 0, y: 0, w: HW, h: HH, id: 'peek-bg' });
        bigCard(g, this.peek, this.faceOf(this.peek), HW / 2 - 90, 60, 180);
        drawTextCentred(g, 'Tap anywhere to close', HW / 2, HH - 20, { color: 'steam' });
      }
    }
    if (this.note) {
      const ctx = g.ctx;
      const gr = ctx.createLinearGradient(0, HH - 18, 0, HH);
      gr.addColorStop(0, rgba('emberNight', 0.85));
      gr.addColorStop(1, rgba('ink', 0.95));
      ctx.fillStyle = gr;
      ctx.fillRect(0, HH - 18, HW, 18);
      rule(g, 0, HH - 18, HW, 'ember');
      drawText(g, fitText(this.note, HW - 16), 8, HH - 12, { color: 'emberGlow', face: 'bold' });
    }
    void t;
  }

  private button(g: Gfx, label: string, x: number, y: number, id: string, on = true): number {
    const w = textWidth(label, 1, 'display') + 16;
    button(g, label, x, y, { w, h: 16, state: !on ? 'off' : this.hover === id ? 'hot' : 'on' });
    if (on) this.hots.push({ x, y, w, h: 16, id });
    return w;
  }

  private centredButton(g: Gfx, label: string, y: number, id: string, on = true): void {
    this.button(g, label, Math.round(HW / 2 - (textWidth(label, 1, 'display') + 16) / 2), y, id, on);
  }

  private pic(g: Gfx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, ink: Ink = 'brassDark', glow = false): void {
    if (img) {
      const un = clipRound(g, x, y, w, h, 3);
      drawPic(g, img, x, y, w, h);
      un();
    } else fillRound(g, x, y, w, h, 'ironDark', 0.9, 3);
    frame(g, x, y, w, h, ink, 3, glow);
  }

  /** A progress bar in brass and crystal. */
  private bar(g: Gfx, x: number, y: number, w: number, frac: number): void {
    fillRound(g, x, y, w, 5, 'ink', 0.85, 2.5);
    if (frac > 0) fillRound(g, x, y, Math.max(5, w * Math.min(1, frac)), 5, 'crystal', 0.95, 2.5);
    frame(g, x, y, w, 5, 'brassDark', 2.5);
  }

  private rankLine(id: string): string {
    const rank = heroRank(this.profile, id);
    const nx = toNextRank(this.profile, id);
    return nx ? `Rank ${rank} · ${nx.have}/${nx.need} XP to rank ${rank + 1}` : `Rank ${rank} · top rank`;
  }

  // ---------- hero and expedition pick (R-E1, R-E13, R-E14) ----------
  private drawHeroes(g: Gfx): void {
    backdrop(g, HW, HH, 'vaskor', 0.55);
    drawTextCentred(g, 'CHOOSE YOUR HERO', HW / 2, 9, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    drawTextCentred(g, 'Lead one hero on an expedition. Every battle won ranks the hero up for good.', HW / 2, 32, { color: 'steam', scale: 0.95 });
    if (this.problem) drawTextCentred(g, fitText(this.problem, HW - 20), HW / 2, 44, { color: 'emberGlow', face: 'bold' });
    HEROES.forEach((h, i) => {
      const x = 8 + (i % 3) * 168, y = 56 + Math.floor(i / 3) * 186;
      const id = `hero|${h.id}`;
      const on = this.hover === id;
      panel(g, x, y, 160, 178, { glow: on ? 'brassGlint' : undefined, tone: on ? 'light' : 'glass', studs: false });
      const fk = FACTIONS.find((f) => f.engine === h.faction)!.key;
      const em = emblem(fk);
      if (em) drawPic(g, em, x + 5, y + 5);
      drawText(g, fitText(face(null, 0, h.id).name, 112, 1, 'display'), x + 42, y + 8, { color: 'brassGlint', face: 'display', shadow: 'ink' });
      drawText(g, fitText(FACTION_INFO[h.faction].name, 112), x + 42, y + 20, { color: 'steam', scale: 0.95 });
      this.pic(g, cardArt(h.id), x + 16, y + 36, 128, 80, on ? 'brassGlint' : 'brassDark', on);
      const rank = heroRank(this.profile, h.id);
      const nx = toNextRank(this.profile, h.id);
      drawText(g, `Rank ${rank}`, x + 8, y + 122, { color: 'brassLight', face: 'bold' });
      const won = this.profile.heroWon[h.id]?.length ?? 0;
      if (won) drawText(g, `${won} won`, x + 152 - textWidth(`${won} won`, 0.9), y + 122, { color: 'crystalBright', scale: 0.9 });
      this.bar(g, x + 50, y + 125, 60, nx ? nx.have / nx.need : 1);
      wrapPx(h.plan, 146, 0.95).slice(0, 3).forEach((l, j) => drawText(g, l, x + 7, y + 136 + j * 10.5, { color: 'steamWhite', scale: 0.95 }));
      this.hots.push({ x, y, w: 160, h: 178, id });
    });
    this.button(g, 'BACK', 8, HH - 24, 'title');
  }

  private drawExpeditions(g: Gfx, h: RunHero): void {
    backdrop(g, HW, HH, 'vaskor', 0.6);
    const nm = face(null, 0, h.id).name;
    panel(g, 8, 8, 196, 432);
    this.pic(g, cardArt(h.id, false, true), 14, 14, 184, 138, 'brassGlint', true);
    drawText(g, fitText(nm, 184, 1.2, 'bold'), 14, 158, { color: 'brassGlint', face: 'bold', scale: 1.2, shadow: 'ink' });
    drawText(g, FACTION_INFO[h.faction].name, 14, 172, { color: 'steam', scale: 0.95 });
    drawText(g, this.rankLine(h.id), 14, 186, { color: 'brassLight', face: 'bold', scale: 0.95 });
    const nx = toNextRank(this.profile, h.id);
    this.bar(g, 14, 199, 184, nx ? nx.have / nx.need : 1);
    rule(g, 12, 210, 188);
    drawText(g, 'RANK UNLOCKS', 14, 216, { color: 'brassGlint', face: 'display', scale: 0.95 });
    const rank = heroRank(this.profile, h.id);
    let y = 230;
    for (let i = 1; i <= MAX_RANK; i++) {
      const got = i <= rank;
      const text = `${i}. ${rankUnlock(h, i, { order: (id) => order(id).name, fitting: (id) => fitting(id).name })}`;
      for (const [j, l] of wrapPx(text, 178, 0.92).entries()) {
        drawText(g, l, j ? 24 : 14, y, { color: got ? 'steamWhite' : 'iron', scale: 0.92, face: got && j === 0 ? 'bold' : undefined });
        y += 10;
      }
      y += 2;
    }
    const inn = order(h.innateOrder), sig = order(h.signatureOrder), mst = order(h.masteryOrder), sf = fitting(h.signatureFitting);
    y += 4;
    for (const l of [`${inn.name}: ${inn.text}`, `${sig.name}: ${sig.text}`, `${sf.name}: ${sf.text} on ${nm.split(' ').slice(-1)[0]}.`, `${mst.name}: ${mst.text}`]) {
      for (const w of wrapPx(l, 182, 0.85)) { if (y < 432) drawText(g, w, 14, y, { color: 'steam', scale: 0.85 }); y += 9; }
    }
    // expeditions
    drawText(g, 'CHOOSE AN EXPEDITION', 214, 12, { color: 'brassGlint', face: 'display', scale: 1.3, shadow: 'ink' });
    EXPEDITIONS.forEach((e, i) => {
      const ex = 212, ey = 34 + i * 122, ew = 292, eh = 114;
      const open = unlocked(this.profile, e.id);
      const id = open ? `expedition|${e.id}` : `locked|${i}`;
      const on = this.hover === id && open;
      panel(g, ex, ey, ew, eh, { tone: on ? 'light' : open ? 'glass' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
      drawText(g, e.name.toUpperCase(), ex + 10, ey + 9, { color: open ? 'brassGlint' : 'iron', face: 'display', scale: 1.1 });
      drawText(g, stars(e.stars), ex + ew - 10 - textWidth(stars(e.stars), 1, 'bold'), ey + 10, { color: open ? 'emberGlow' : 'iron', face: 'bold' });
      wrapPx(e.blurb, ew - 20).slice(0, 2).forEach((l, j) => drawText(g, l, ex + 10, ey + 26 + j * 10.5, { color: open ? 'steamWhite' : 'iron' }));
      const battles = e.stops.filter((s) => s.kind === 'battle' || s.kind === 'elite').length;
      const boss = e.stops.find((s) => s.kind === 'boss')!.foe!;
      drawText(g, `${e.stops.length} stops on ${rows(e)} rows, ${battles} battles, boss ${bossName(h.faction, boss)}.`, ex + 10, ey + 52, { color: open ? 'steam' : 'iron', scale: 0.95 });
      const mine = this.profile.heroWon[h.id]?.includes(e.id);
      if (!open) drawText(g, `Win ${EXPEDITIONS[i - 1].name} with any hero to open it.`, ex + 10, ey + 68, { color: 'ironLight', face: 'bold' });
      else drawText(g, mine ? `${nm.split(' ').slice(-1)[0]} has won this one. Win XP: ${30 * e.stars} for the boss.` : `Winning it gives ${30 * e.stars} more rank XP.`, ex + 10, ey + 68, { color: mine ? 'crystalBright' : 'steam', scale: 0.95 });
      if (open) drawText(g, 'CLICK TO SET OUT', ex + 10, ey + eh - 18, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
      this.hots.push({ x: ex, y: ey, w: ew, h: eh, id });
    });
    this.button(g, 'OTHER HEROES', 212, HH - 24, 'unchoose');
  }

  // ---------- map (R-E3) ----------
  private stopPos(r: RunState, s: Stop): [number, number] {
    const n = rows(exp(r));
    const x = 20 + s.x * 300;
    const y = HH - 40 - (s.row * (HH - 96)) / Math.max(1, n - 1);
    return [Math.round(x), Math.round(y)];
  }

  private medallion(g: Gfx, x: number, y: number, rad: number, s: Stop, here: boolean, open: boolean, seen: boolean, glow: number): void {
    const ctx = g.ctx;
    const st = KIND_STYLE[s.kind];
    const lit = here || open;
    ctx.save();
    if (lit) {
      ctx.shadowColor = rgba(here ? 'crystalBright' : 'brassGlint', 0.55 + 0.4 * glow);
      ctx.shadowBlur = 5 + 5 * glow;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    const rim = ctx.createLinearGradient(x, y - rad, x, y + rad);
    rim.addColorStop(0, PALETTE[here ? 'crystalWhite' : lit ? 'brassGlint' : seen ? 'crystalDark' : 'iron']);
    rim.addColorStop(0.5, PALETTE[here ? 'crystal' : lit ? 'brass' : 'ironDark']);
    rim.addColorStop(1, PALETTE[here ? 'crystalDeep' : lit ? 'brassShadow' : 'ironNight']);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, rad - 2, 0, Math.PI * 2);
    const fg = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 0.5, x, y, rad - 2);
    fg.addColorStop(0, PALETTE[lit ? 'ironLight' : 'ironDark']);
    fg.addColorStop(0.55, PALETTE[lit ? 'ironDark' : 'ironNight']);
    fg.addColorStop(1, PALETTE.ink);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = rgba('ink', 0.9);
    ctx.stroke();
    ctx.restore();
    const sc = s.kind === 'boss' ? 1.5 : 1.1;
    drawTextCentred(g, st.letter, x, y - 3.5 * sc, { color: lit ? st.ink : seen ? 'steam' : 'iron', face: 'display', scale: sc, shadow: 'ink' });
  }

  private drawMap(g: Gfx, r: RunState, t: number): void {
    const e = exp(r);
    drawText(g, e.name.toUpperCase(), 10, 8, { color: 'brassGlint', scale: 1.6, face: 'display', shadow: 'ink' });
    const can = new Set(choices(r).map((s) => s.id));
    const ctx = g.ctx;
    const walked = new Set<string>();
    for (let i = 1; i < r.visited.length; i++) walked.add(`${r.visited[i - 1]}>${r.visited[i]}`);
    for (const s of e.stops) {
      const [x0, y0] = this.stopPos(r, s);
      for (const id of s.to) {
        const m = stop(r, id);
        const [x1, y1] = this.stopPos(r, m);
        const lit = r.at === s.id && can.has(m.id);
        const done = walked.has(`${s.id}>${m.id}`);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = lit || done ? 2 : 1.25;
        ctx.strokeStyle = lit ? PALETTE.brassGlint : done ? rgba('crystalBright', 0.85) : rgba('ironLight', 0.55);
        if (lit) {
          ctx.shadowColor = rgba('brassGlint', 0.8);
          ctx.shadowBlur = 4;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -t * 0.4;
        } else if (!done) ctx.setLineDash([2, 3]);
        const mx = (x0 + x1) / 2 + (y1 - y0) * 0.08, my = (y0 + y1) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(mx, my, x1, y1);
        ctx.stroke();
        ctx.restore();
      }
    }
    const glow = 0.5 + 0.5 * Math.sin(t / 9);
    for (const s of e.stops) {
      const [x, y] = this.stopPos(r, s);
      const rad = s.kind === 'boss' ? 14 : 10;
      const here = r.at === s.id;
      const open = can.has(s.id);
      const hov = this.hover === `stop|${s.id}`;
      this.medallion(g, x, y, rad + (hov ? 1 : 0), s, here, open, r.visited.includes(s.id), open ? glow : here ? 0.6 : 0);
      const size = rad * 2 + 4;
      if (open) this.hots.push({ x: x - size / 2, y: y - size / 2, w: size, h: size, id: `stop|${s.id}` });
    }
    if (r.phase === 'map' && this.hover?.startsWith('stop|')) {
      const s = stop(r, this.hover.slice(5));
      const [x, y] = this.stopPos(r, s);
      const label = s.foe ? `${KIND_STYLE[s.kind].name.toLowerCase()}: ${foeName(r, s)}` : KIND_STYLE[s.kind].name.toLowerCase();
      const w = textWidth(label, 1, 'bold') + 12;
      const lx = Math.min(x + 16, 344 - w);
      fillRound(g, lx, y - 8, w, 15, 'ink', 0.88, 4);
      frame(g, lx, y - 8, w, 15, 'brass', 4);
      drawText(g, label, lx + 6, y - 4, { color: 'steamWhite', face: 'bold' });
    }
    if (r.phase === 'map') drawText(g, r.at === null ? 'Choose where to start.' : 'Choose the next stop.', 10, 28, { color: 'steam', shadow: 'ink' });
  }


  private drawSide(g: Gfx, r: RunState): void {
    const x = 352;
    panel(g, x, 34, 154, 252);
    const pt = portrait(r.hero);
    if (pt) this.pic(g, pt, x + 8, 42, 40, 40);
    wrapPx(face(null, 0, r.hero).name, 96, 1, 'bold').slice(0, 2).forEach((l, i) => drawText(g, l, x + 54, 44 + i * 11, { color: 'brassGlint', face: 'bold' }));
    drawText(g, `Rank ${r.rank}${r.recruits.length ? ` · +${r.recruits.length} hero` : ''}`, x + 54, 68, { color: 'steam', scale: 0.95 });
    const row = (label: string, value: string, y: number, ink: Ink) => {
      drawText(g, label, x + 10, y, { color: 'ironLight' });
      drawText(g, value, x + 62, y, { color: ink, face: 'bold' });
    };
    row('Crystal', `${r.crystal}/${LIMITS.spire}`, 90, r.crystal <= 6 ? 'emberGlow' : 'crystalBright');
    row('Scrip', `${r.scrip}`, 102, 'brassLight');
    row('Deck', `${r.deck.length} cards`, 114, 'steamWhite');
    row('Orders', `${r.orders.length}`, 126, 'brassGlint');
    row('Fittings', `${Object.keys(deckFittings(r)).length}`, 138, 'verdigris');
    row('Rank XP', `+${r.xp}`, 150, 'crystalBright');
    rule(g, x + 8, 164, 138);
    const kinds: StopKind[] = ['battle', 'elite', 'boss', 'rest', 'depot', 'event', 'order', 'cache', 'recruit'];
    kinds.forEach((k, i) => {
      const lx = x + 10 + (i % 2) * 70, yy = 170 + Math.floor(i / 2) * 11;
      drawText(g, KIND_STYLE[k].letter, lx, yy, { color: KIND_STYLE[k].ink, face: 'display' });
      drawText(g, KIND_STYLE[k].name.toLowerCase(), lx + 11, yy, { color: 'steam', scale: 0.9 });
    });
    this.button(g, this.deckOpen ? 'HIDE DECK' : 'DECK', x + 8, 230, 'deck');
    this.button(g, 'ORDERS', x + 62, 230, 'orders');
    this.button(g, 'TITLE', x + 8, 250, 'title');
    if (this.confirmAbandon) {
      panel(g, x - 2, 288, 158, 46, { tone: 'dark', glow: 'ember', studs: false });
      drawText(g, 'End this run for good?', x + 6, 294, { color: 'emberGlow', face: 'bold' });
      this.button(g, 'YES, END IT', x + 6, 310, 'abandon-yes');
      this.button(g, 'NO', x + 106, 310, 'abandon-no');
    } else this.button(g, 'ABANDON', x + 62, 250, 'abandon');
    const lines = r.log.slice(-5).flatMap((l) => wrapPx(l, 150, 0.95));
    const recent = lines.slice(-9);
    if (recent.length && !this.confirmAbandon) {
      panel(g, x - 2, 292, 158, recent.length * 10.5 + 10, { tone: 'dark', studs: false });
      recent.forEach((l, i) => drawText(g, l, x + 4, 298 + i * 10.5, { color: i >= recent.length - 2 ? 'steamWhite' : 'steam', scale: 0.95, alpha: i >= recent.length - 2 ? 1 : 0.75 }));
    }
  }

  // ---------- rewards, picks (R-E7 to R-E9, R-E12) ----------
  private drawReward(g: Gfx, r: RunState): void {
    const o = r.offer!;
    panel(g, 10, 36, 492, 392);
    drawTextCentred(g, 'VICTORY', HW / 2, 46, { color: 'brassGlint', scale: 1.6, glow: 'brass' });
    drawTextCentred(g, `+${o.scrip} scrip · +${o.xp} rank XP for ${shortName(r.hero)}. Take one bundle of cards.`, HW / 2, 64, { color: 'steamWhite' });
    const names = ['HERO BUNDLE', 'FACTION BUNDLE', 'WILD BUNDLE'];
    const why = [`From ${shortName(r.hero)}'s own pool`, `From ${[...new Set([r.faction, ...r.recruits.map((x) => hero(x).faction)])].map((f) => FACTION_NAMES[f]).join(' and ')}`, 'From any faction'];
    o.bundles.forEach((b, i) => {
      const bx = 18 + i * 162, by = 78, bw = 154, bh = 316;
      const id = `bundle|${i}`;
      const on = this.hover === id;
      panel(g, bx, by, bw, bh, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
      drawTextCentred(g, names[i], bx + bw / 2, by + 8, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
      drawTextCentred(g, fitText(why[i], bw - 10, 0.85), bx + bw / 2, by + 21, { color: 'steam', scale: 0.85 });
      this.hots.push({ x: bx, y: by, w: bw, h: bh, id });
      const cw = 68, ch = 94;
      b.forEach((cid, j) => {
        const cx = bx + 6 + (j % 2) * (cw + 6), cy = by + 34 + Math.floor(j / 2) * (ch + 6);
        miniCard(g, cid, this.faceOf(cid), cx, cy, { hot: on, w: cw, h: ch });
      });
      const listY = by + 34 + Math.ceil(b.length / 2) * (ch + 6) + 2;
      b.forEach((cid, j) => drawText(g, fitText(`${def(cid).cost} · ${this.faceOf(cid).name}`, bw - 12, 0.9), bx + 6, listY + j * 10, { color: 'steamWhite', scale: 0.9 }));
      drawTextCentred(g, 'CLICK TO TAKE', bx + bw / 2, by + bh - 16, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
    });
    this.centredButton(g, 'TAKE NO CARDS', 402, 'bundle|-');
  }

  private optionPanel(g: Gfx, x: number, y: number, w: number, h: number, id: string, title: string, tag: string, text: string, ink: Ink): void {
    const on = this.hover === id;
    panel(g, x, y, w, h, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
    wrapPx(title, w - 16, 1.15, 'bold').slice(0, 2).forEach((l, i) => drawText(g, l, x + 8, y + 10 + i * 13, { color: on ? 'brassGlint' : ink, face: 'bold', scale: 1.15 }));
    drawText(g, tag, x + 8, y + 38, { color: 'steam', scale: 0.9 });
    rule(g, x + 6, y + 50, w - 12);
    wrapPx(text, w - 16).slice(0, 8).forEach((l, i) => drawText(g, l, x + 8, y + 58 + i * 11, { color: 'steamWhite' }));
    drawText(g, 'CLICK TO TAKE', x + 8, y + h - 16, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
    this.hots.push({ x, y, w, h, id });
  }

  private drawPick(g: Gfx, r: RunState): void {
    const p = r.pick!;
    if (p.kind === 'recruit') { this.drawRecruit(g, r); return; }
    const isOrder = p.kind === 'order';
    panel(g, 10, 80, 492, 270);
    drawTextCentred(g, isOrder ? 'A COMMAND POST' : 'A PARTS CACHE', HW / 2, 92, { color: 'brassGlint', scale: 1.6, shadow: 'ink' });
    drawTextCentred(g, isOrder ? 'Take one Order. It works in every battle for the rest of the run.' : 'Take one Fitting, then choose the card it goes on: every copy gets it.', HW / 2, 112, { color: 'steamWhite' });
    p.options.forEach((id, i) => {
      const x = 20 + i * 162, y = 128;
      if (isOrder) { const o = order(id); this.optionPanel(g, x, y, 150, 186, `pick|${id}`, o.name, `Order, ${o.rarity}`, o.text, 'brassLight'); }
      else { const f = fitting(id); this.optionPanel(g, x, y, 150, 186, `pick|${id}`, f.name, `Fitting, ${f.rarity}`, `${f.text}. ${f.cost ? 'Goes on any card that costs 2 or more.' : 'Goes on a unit or hero.'}`, 'verdigris'); }
    });
    if (p.options.length === 0) drawTextCentred(g, 'Nothing here is new to you.', HW / 2, 200, { color: 'steam' });
    this.centredButton(g, isOrder ? 'TAKE NO ORDER' : 'TAKE NO FITTING', 324, 'pick|-');
  }

  private drawRecruit(g: Gfx, r: RunState): void {
    const p = r.pick!;
    panel(g, 30, 60, 452, 320);
    drawTextCentred(g, 'A RECRUITING POST', HW / 2, 72, { color: 'brassGlint', scale: 1.6, shadow: 'ink' });
    drawTextCentred(g, 'A second hero can join your expedition, with two copies and four of their cards.', HW / 2, 92, { color: 'steamWhite' });
    p.options.forEach((id, i) => {
      const h = hero(id);
      const x = 44 + i * 216, y = 108, w = 208, hh = 236;
      const hid = `pick|${id}`;
      const on = this.hover === hid;
      panel(g, x, y, w, hh, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
      this.pic(g, cardArt(id), x + 8, y + 8, 128, 96, on ? 'brassGlint' : 'brassDark', on);
      const pt = portrait(id);
      if (pt) this.pic(g, pt, x + 146, y + 8, 52, 52);
      drawText(g, fitText(face(null, 0, id).name, w - 16, 1.1, 'bold'), x + 8, y + 110, { color: 'brassGlint', face: 'bold', scale: 1.1 });
      drawText(g, FACTION_INFO[h.faction].name, x + 8, y + 124, { color: 'steam', scale: 0.95 });
      wrapPx(h.plan, w - 16).slice(0, 2).forEach((l, j) => drawText(g, l, x + 8, y + 138 + j * 10.5, { color: 'steamWhite' }));
      const support = Object.keys(h.starter).filter((c) => c !== id).slice(0, 2);
      drawText(g, 'Joins with:', x + 8, y + 164, { color: 'ironLight', scale: 0.95 });
      [`${face(null, 0, id).name} ×2`, ...support.map((c) => `${def(c).name} ×2`)].forEach((l, j) => drawText(g, fitText(l, w - 16, 0.95), x + 8, y + 176 + j * 10.5, { color: 'steamWhite', scale: 0.95 }));
      drawText(g, 'CLICK TO RECRUIT', x + 8, y + hh - 16, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
      this.hots.push({ x, y, w, h: hh, id: hid });
    });
    this.centredButton(g, 'GO ON ALONE', 354, 'pick|-');
  }

  private drawOrders(g: Gfx, r: RunState): void {
    this.hots.push({ x: 0, y: 0, w: HW, h: HH, id: 'orders-bg' });
    g.wash(0, 0, HW, HH, 'ink', 0.5);
    const list = r.orders.map(order);
    const lines = list.map((o) => wrapPx(o.text, 300));
    const hgt = Math.min(400, 46 + lines.reduce((n, l) => n + 13 + l.length * 11 + 5, 0) + (list.length ? 0 : 14));
    const y = Math.round((HH - hgt) / 2);
    panel(g, 90, y, 332, hgt, { glow: 'brassGlint' });
    drawText(g, `YOUR ORDERS (${list.length})`, 102, y + 10, { color: 'brassGlint', face: 'display', scale: 1.2 });
    let ty = y + 30;
    if (!list.length) drawText(g, 'No Orders yet. Command posts, depots and rank unlocks give them.', 102, ty, { color: 'steam' });
    list.forEach((o, i) => {
      if (ty > y + hgt - 20) return;
      drawText(g, o.name, 102, ty, { color: 'brassLight', face: 'bold' });
      ty += 13;
      for (const l of lines[i]) { drawText(g, l, 102, ty, { color: 'steamWhite' }); ty += 11; }
      ty += 5;
    });
    drawTextCentred(g, 'Tap anywhere to close', HW / 2, y + hgt - 14, { color: 'steam', scale: 0.9 });
  }

  // ---------- rest, depot, event, briefing ----------
  private drawRest(g: Gfx, r: RunState): void {
    panel(g, 60, 120, 392, 118);
    drawTextCentred(g, 'A REST STOP', HW / 2, 134, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    wrapPx(`Repair the Crystal by ${restRepair(r)} (up to ${LIMITS.spire}), or remove one card from your deck.`, 360).forEach((l, i) => drawTextCentred(g, l, HW / 2, 160 + i * 11, { color: 'steamWhite' }));
    this.button(g, `REPAIR (+${Math.min(restRepair(r), LIMITS.spire - r.crystal)})`, 120, 190, 'repair');
    this.button(g, 'REMOVE A CARD', 280, 190, 'remove', r.deck.length > MIN_DECK);
    if (r.deck.length <= MIN_DECK) drawTextCentred(g, `Your deck is at the ${MIN_DECK}-card minimum.`, HW / 2, 220, { color: 'ironLight' });
  }

  private drawDepot(g: Gfx, r: RunState): void {
    const sh = r.shop!;
    panel(g, 10, 36, 492, 398);
    drawTextCentred(g, 'SUPPLY DEPOT', HW / 2, 45, { color: 'brassGlint', scale: 1.5, shadow: 'ink' });
    drawTextCentred(g, `You have ${r.scrip} scrip.`, HW / 2, 62, { color: 'brassLight', face: 'bold' });
    sh.cards.forEach((c, i) => {
      const x = 20 + i * 120, y = 76;
      const id = `buy|card:${c.id}`;
      const on = this.hover === id;
      panel(g, x, y, 112, 196, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
      this.pic(g, cardArt(c.id), x + 8, y + 6, 96, 72, c.sold ? 'iron' : on ? 'brassGlint' : 'brassDark');
      if (c.sold) g.wash(x + 8, y + 6, 96, 72, 'ink', 0.55);
      const f = this.faceOf(c.id);
      const nm = wrapPx(f.name, 102, 1, 'bold').slice(0, 2);
      nm.forEach((l, j) => drawText(g, l, x + 6, y + 83 + j * 10, { color: 'brassGlint', face: 'bold' }));
      const d = def(c.id);
      const sy = y + 85 + nm.length * 10;
      drawText(g, d.type === 'glyph' ? `Tactic, cost ${d.cost}` : `Cost ${d.cost} · ${f.power}|${f.health}`, x + 6, sy, { color: 'steam', scale: 0.95 });
      wrapPx(f.text, 100, 0.9).slice(0, 7).forEach((l, j) => drawText(g, l, x + 6, sy + 12 + j * 9.5, { color: 'steamWhite', scale: 0.9 }));
      drawText(g, c.sold ? 'BOUGHT' : `${c.price} SCRIP`, x + 6, y + 183, { color: c.sold ? 'iron' : 'brassLight', face: 'display' });
      if (!c.sold) this.hots.push({ x, y, w: 112, h: 196, id });
    });
    // the Fitting and the Order on the shelf
    const fx = 380, fw = 112;
    const fi = fitting(sh.fitting.id);
    const fon = this.hover === 'buy|fitting';
    panel(g, fx, 76, fw, 96, { tone: fon ? 'light' : 'dark', glow: fon ? 'brassGlint' : undefined, studs: false });
    drawText(g, 'FITTING', fx + 6, 82, { color: 'verdigris', face: 'display', scale: 0.9 });
    drawText(g, fitText(fi.name, fw - 12, 1, 'bold'), fx + 6, 95, { color: 'brassGlint', face: 'bold' });
    wrapPx(`${fi.text}. On every copy of one card.`, fw - 12, 0.9).slice(0, 4).forEach((l, j) => drawText(g, l, fx + 6, 108 + j * 9.5, { color: 'steamWhite', scale: 0.9 }));
    drawText(g, sh.fitting.sold ? 'BOUGHT' : `${sh.fitting.price} SCRIP`, fx + 6, 158, { color: sh.fitting.sold ? 'iron' : 'brassLight', face: 'display' });
    if (!sh.fitting.sold) this.hots.push({ x: fx, y: 76, w: fw, h: 96, id: 'buy|fitting' });
    if (sh.order) {
      const o = order(sh.order.id);
      const oon = this.hover === 'buy|order';
      panel(g, fx, 176, fw, 96, { tone: oon ? 'light' : 'dark', glow: oon ? 'brassGlint' : undefined, studs: false });
      drawText(g, 'ORDER', fx + 6, 182, { color: 'brassGlint', face: 'display', scale: 0.9 });
      drawText(g, fitText(o.name, fw - 12, 1, 'bold'), fx + 6, 195, { color: 'brassGlint', face: 'bold' });
      wrapPx(o.text, fw - 12, 0.9).slice(0, 4).forEach((l, j) => drawText(g, l, fx + 6, 208 + j * 9.5, { color: 'steamWhite', scale: 0.9 }));
      drawText(g, sh.order.sold ? 'BOUGHT' : `${sh.order.price} SCRIP`, fx + 6, 258, { color: sh.order.sold ? 'iron' : 'brassLight', face: 'display' });
      if (!sh.order.sold) this.hots.push({ x: fx, y: 176, w: fw, h: 96, id: 'buy|order' });
    }
    this.button(g, sh.repairSold ? 'REPAIR USED' : `REPAIR +${DEPOT.repair} FOR ${DEPOT.repairPrice}`, 20, 284, 'buy|repair', !sh.repairSold);
    this.button(g, 'LEAVE THE DEPOT', 492 - 10 - (textWidth('LEAVE THE DEPOT', 1, 'display') + 16), 408, 'leave');
  }

  /** The deck as cards: to look through, to pick the card to remove, or the card a Fitting goes on. */
  private drawDeck(g: Gfx, r: RunState): void {
    this.hots.push({ x: 0, y: 0, w: HW, h: HH, id: 'deck-bg' });
    g.wash(0, 0, HW, HH, 'ink', 0.35);
    panel(g, 6, 26, 500, 416);
    const fitting_ = r.phase === 'fit' && r.fitWith ? fitting(r.fitWith.id) : null;
    const cutting = this.removing || r.phase === 'eventRemove';
    const head = fitting_ ? `FIT ${fitting_.name.toUpperCase()} (${fitting_.text.toUpperCase()})` : cutting ? 'CHOOSE A CARD TO REMOVE' : `YOUR DECK: ${r.deck.length} CARDS`;
    drawText(g, fitText(head, 480, 1.2, 'display'), 18, 36, { color: fitting_ ? 'verdigris' : cutting ? 'emberGlow' : 'brassGlint', face: 'display', scale: 1.2 });
    const sub = fitting_ ? 'Every copy of the card you choose gets it. A card holds one Fitting; a new one replaces the old.'
      : cutting ? `You will be asked to confirm. Your deck has ${r.deck.length} cards; your lead hero stays.` : 'Click a card to see it up close.';
    drawText(g, fitText(sub, 480, 0.95), 18, 50, { color: 'steam', scale: 0.95 });
    rule(g, 12, 62, 488);
    const ids = fitting_ ? r.deck.filter((id) => fitTargets(r, r.fitWith!.id).includes(id)) : cutting ? r.deck.filter((id) => canRemove(r, id)) : r.deck;
    const prefix = fitting_ ? 'fitpick|' : r.phase === 'eventRemove' ? 'evpick|' : this.removing ? 'cutpick|' : 'look|';
    const items = grouped(ids, (id) => this.faceOf(id)).map((it) => ({ ...it, tag: r.fittings[it.id] && r.deck.includes(it.id) ? fitting(r.fittings[it.id]).name : undefined }));
    const res = cardGrid(g, items, (id) => this.faceOf(id), 14, 70, 434, 336, this.gridScroll, this.hover, prefix, this.hots);
    this.gridScroll = res.scroll;
    this.gridMax = res.maxScroll;
    scrollButtons(g, 454, 72, 330, res.scroll, res.maxScroll, this.hover, this.hots);
    if (fitting_) this.button(g, 'LEAVE IT BEHIND', 506 - 14 - (textWidth('LEAVE IT BEHIND', 1, 'display') + 16), 420, 'nofit');
    else if (r.phase !== 'eventRemove') this.button(g, cutting ? 'KEEP MY DECK' : 'CLOSE', 506 - 14 - (textWidth(cutting ? 'KEEP MY DECK' : 'CLOSE', 1, 'display') + 16), 420, 'close');
  }

  private drawConfirm(g: Gfx, r: RunState): void {
    const c = this.confirm!;
    const f = this.faceOf(c.id);
    const copies = r.deck.filter((x) => x === c.id).length;
    if (c.kind === 'cut' || c.kind === 'evcut') {
      const left = copies > 1 ? `You have ${copies} copies; ${copies - 1} will stay.` : 'It is your only copy.';
      confirmCard(g, HW, HH, c.id, f, `Remove ${f.name} from your deck?`, `${left} Your deck will have ${r.deck.length - 1} cards.`, 'REMOVE IT', true, this.hover, this.hots);
    } else if (c.kind === 'fit') {
      const fi = fitting(r.fitWith!.id);
      const old = r.fittings[c.id] ? ` It replaces ${fitting(r.fittings[c.id]).name}.` : '';
      confirmCard(g, HW, HH, c.id, f, `Fit ${f.name} with ${fi.name}?`, `${fi.text} on all ${copies} ${copies === 1 ? 'copy' : 'copies'}.${old}`, 'FIT IT', false, this.hover, this.hots);
    } else {
      const price = r.shop?.cards.find((x) => x.id === c.id)?.price ?? 0;
      confirmCard(g, HW, HH, c.id, f, `Buy ${f.name} for ${price} scrip?`, `You have ${r.scrip} scrip; ${r.scrip - price} will be left.${copies ? ` You already have ${copies}.` : ''}`, 'BUY IT', false, this.hover, this.hots);
    }
  }

  private drawEvent(g: Gfx, r: RunState): void {
    const ev = EVENTS.find((e) => e.id === r.event?.id);
    if (!ev) return;
    panel(g, 20, 110, 472, 96 + ev.choices.length * 26);
    drawTextCentred(g, ev.title, HW / 2, 124, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    ev.text.forEach((l, i) => drawTextCentred(g, l, HW / 2, 152 + i * 11, { color: 'steamWhite' }));
    ev.choices.forEach((c, i) => {
      const y = 196 + i * 26;
      const short = (c.costScrip ?? 0) > r.scrip;
      const id = `choice|${i}`;
      const on = this.hover === id && !short;
      fillRound(g, 36, y, 440, 20, short ? 'ironNight' : on ? 'brassDark' : 'ironDark', 0.9, 4);
      if (on) highlight(g, 36, y, 440, 20, 'brass', 0.8);
      frame(g, 36, y, 440, 20, short ? 'ironDark' : on ? 'brassGlint' : 'brassDark', 4, on);
      drawText(g, fitText(c.label, 424, 1, 'display'), 46, y + 6.5, { color: short ? 'iron' : 'brassGlint', face: 'display' });
      this.hots.push({ x: 36, y, w: 440, h: 20, id });
    });
  }

  private drawBriefing(g: Gfx, r: RunState): void {
    const b = r.battle!;
    const deck = b.setup.decks[1];
    const factions = [...new Set(deck.map((id) => def(id).faction))];
    const bossFace = b.kind === 'boss' && !this.foeDeckOpen;
    const intro = b.kind === 'boss' ? BOSS_INTRO[b.faction] : null;
    // a boss shows the face of the hero card that bears its name (Foreman Otto Brandt is a Free Gauge hero card)
    const bossCard = allCards().find((c) => c.type === 'hero' && b.foeName.startsWith(c.name));
    const bossPic = bossFace && bossCard ? portrait(bossCard.id) : null;
    const orders = b.orders.map(order);
    const orderLines = orders.flatMap((o) => wrapPx(`${o.name}: ${o.text}`, 440));
    const factsY = 104 + (bossPic ? 104 : 0) + (intro && bossFace ? intro.lines.length * 12 : 0) + orderLines.length * 11 + (orders.length ? 6 : 0);
    const by = this.foeDeckOpen ? 404 : factsY + 42;
    panel(g, 20, 52, 472, by + 28 - 52, { glow: b.kind === 'boss' ? 'ember' : undefined });
    const head = `${KIND_STYLE[b.kind].name}: ${b.foeName.toUpperCase()}`;
    drawTextCentred(g, fitText(head, 452, 1.5, 'display'), HW / 2, 64, { color: b.kind === 'boss' ? 'emberGlow' : 'brassGlint', scale: 1.5, face: 'display', shadow: 'ink' });
    let y = 90;
    if (intro && bossFace) {
      if (bossPic) { this.pic(g, bossPic, HW / 2 - 48, y, 96, 96, 'ember', true); y += 104; }
      for (const l of intro.lines) { drawTextCentred(g, fitText(l, 452, 1, 'display'), HW / 2, y, { color: 'steamWhite', face: 'display' }); y += 12; }
    }
    y += 6;
    rule(g, 40, y - 4, 432);
    drawTextCentred(g, `Factions: ${factions.map((f) => FACTION_NAMES[f]).join(', ')}`, HW / 2, y + 2, { color: 'steam' });
    drawTextCentred(g, `Foe deck ${deck.length} cards · foe Crystal ${b.setup.startSpire?.[1] ?? 20} · AI level ${LEVEL_NAME[b.level]}`, HW / 2, y + 14, { color: 'steam' });
    drawTextCentred(g, `Your Crystal ${r.crystal} · your deck ${r.deck.length} cards · ${r.orders.length} Orders`, HW / 2, y + 26, { color: 'crystalBright', face: 'bold' });
    if (!this.foeDeckOpen && orders.length) {
      let oy = y + 40;
      for (const l of orderLines) { drawTextCentred(g, l, HW / 2, oy, { color: 'emberGlow', face: 'bold' }); oy += 11; }
    }
    this.button(g, 'FIGHT', 300, by, 'fight');
    this.button(g, this.foeDeckOpen ? 'HIDE FOE DECK' : 'VIEW FOE DECK', 150, by, 'foedeck');
    if (this.foeDeckOpen) {
      const counts = new Map<string, number>();
      for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, c) => def(a).cost - def(c).cost || a.localeCompare(c));
      ids.forEach((id, i) => {
        const x = 34 + Math.floor(i / 22) * 230, yy = y + 42 + (i % 22) * 10;
        drawText(g, String(def(id).cost), x, yy, { color: 'crystalBright', face: 'bold', scale: 0.95 });
        drawText(g, fitText(`${face(null, 1, id).name} ×${counts.get(id)}`, 206, 0.95), x + 10, yy, { color: def(id).type === 'hero' ? 'brassLight' : 'steamWhite', scale: 0.95 });
      });
    }
  }

  private drawEnd(g: Gfx, r: RunState): void {
    const won = r.phase === 'won';
    const lines = [...this.rankUps];
    const h = 168 + lines.length * 11;
    const y = Math.round((HH - h) / 2);
    panel(g, 70, y, 372, h, { glow: won ? 'brassGlint' : 'ember' });
    drawTextCentred(g, won ? 'EXPEDITION WON' : 'THE EXPEDITION IS OVER', HW / 2, y + 16, { color: won ? 'brassGlint' : 'emberGlow', scale: 2, glow: won ? 'brass' : 'ember' });
    drawTextCentred(g, `${shortName(r.hero)} on ${exp(r).name}: ${r.wins} ${r.wins === 1 ? 'battle' : 'battles'} won, ${r.deck.length} cards, ${r.orders.length} Orders`, HW / 2, y + 46, { color: 'steamWhite' });
    wrapPx(r.log[r.log.length - 1] ?? '', 340).slice(0, 2).forEach((l, i) => drawTextCentred(g, l, HW / 2, y + 60 + i * 11, { color: 'steam' }));
    drawTextCentred(g, `+${r.xp} rank XP this run (kept). ${this.rankLine(r.hero)}`, HW / 2, y + 88, { color: 'crystalBright', face: 'bold' });
    const nx = toNextRank(this.profile, r.hero);
    this.bar(g, HW / 2 - 90, y + 102, 180, nx ? nx.have / nx.need : 1);
    lines.forEach((l, i) => drawTextCentred(g, fitText(`New: ${l}`, 350), HW / 2, y + 114 + i * 11, { color: 'brassGlint', face: 'bold' }));
    if (won) {
      const i = EXPEDITIONS.findIndex((e) => e.id === r.expedition);
      const nextE = EXPEDITIONS[i + 1];
      if (nextE) drawTextCentred(g, `${nextE.name} is open.`, HW / 2, y + h - 46, { color: 'emberGlow', face: 'bold' });
    }
    this.button(g, 'NEW RUN', 150, y + h - 28, 'newrun');
    this.button(g, 'TITLE', 300, y + h - 28, 'title');
  }
}
