// The campaign screens (spec 20, PLAN D18), hi-res 512 x 448: faction pick, act map, reward, rest, supply, deck,
// and the end of the run. Battles use the match screen; this controller starts them and reads their result.
import type { FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, face } from '../engine/query';
import { replay } from '../engine/save';
import { drawText, drawTextCentred, textWidth } from '../font';
import type { Gfx } from '../gfx';
import type { Ink } from '../palette';
import { wrap } from '../gallery-text';
import { drawWindow } from '../title';
import { FACTIONS } from '../data/factions';
import { FACTION_INFO } from '../data/decks';
import { cardArt, emblem, field } from '../match/art';
import { HH, HW, Match } from '../match/board';
import { Session } from '../match/session';
import {
  ACT_NAMES, FLOORS, LEADS, MIN_DECK, REST_REPAIR, SUPPLY_REPAIR, SUPPLY_REPAIR_PRICE, buy, choices, enter, finishBattle,
  leaveSupply, newRun, rest, takeReward, chooseEvent, removeForEvent, FACTION_NAMES, type MapNode, type RunState,
} from './run';
import { BOSS_INTRO, EVENTS } from './events';

export const RUN_KEY = 'magitek-wars.run';
const ACT_FIELDS = ['thrumhollow', 'rimeglass', 'vaskor'];



interface RunSave { game: 'magitek-wars.run'; version: 1; run: RunState; battleActions: string | null }

export function readRun(): { run: RunState; actions: unknown[] } | { problem: string } | null {
  let text: string | null;
  try {
    text = localStorage.getItem(RUN_KEY);
  } catch {
    return { problem: 'This browser does not allow saving, so the campaign cannot be kept.' };
  }
  if (text === null) return null;
  try {
    const s = JSON.parse(text) as RunSave;
    if (s.game !== 'magitek-wars.run' || s.version !== 1) return { problem: 'The saved campaign is from another version and cannot be opened.' };
    return { run: s.run, actions: s.battleActions ? (JSON.parse(s.battleActions) as unknown[]) : [] };
  } catch {
    return { problem: 'The saved campaign is damaged and cannot be opened.' };
  }
}

function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* no storage */
  }
}

const KIND_STYLE: Record<MapNode['kind'], { letter: string; ink: Ink; name: string }> = {
  skirmish: { letter: 'S', ink: 'ironLight', name: 'SKIRMISH' },
  elite: { letter: 'E', ink: 'emberBright', name: 'ELITE' },
  rest: { letter: 'R', ink: 'gloamBright', name: 'REST' },
  supply: { letter: 'D', ink: 'brassLight', name: 'SUPPLY DEPOT' },
  event: { letter: '?', ink: 'steamWhite', name: 'EVENT' },
  boss: { letter: 'B', ink: 'emberGlow', name: 'BOSS' },
};

type Hot = { x: number; y: number; w: number; h: number; id: string };

export class RunScreen {
  run: RunState | null = null;
  match: Match | null = null;
  problem = '';
  note = '';
  private deckOpen = false;
  private removing = false;
  private confirmAbandon = false;
  private foeDeckOpen = false;
  private hots: Hot[] = [];
  private hover: string | null = null;
  private savedActions = -1;
  /** Set when the player leaves for the title. */
  exit = false;

  constructor() {
    const r = readRun();
    if (r && 'problem' in r) this.problem = r.problem;
    else if (r) {
      this.run = r.run;
      if (r.run.phase === 'battle' && r.run.battle && r.actions.length) this.resumeBattle(r.actions as never[]);
    }
  }

  private save(): void {
    if (!this.run) return;
    const save: RunSave = {
      game: 'magitek-wars.run', version: 1, run: this.run,
      battleActions: this.match ? JSON.stringify(this.match.session.actions) : null,
    };
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(save));
    } catch {
      this.note = 'This browser refused the save: the campaign will be lost on reload.';
    }
  }

  private startBattle(): void {
    const r = this.run!;
    const b = r.battle!;
    const session = Session.start(b.setup, { deckNames: ['Your march', b.foeName], difficulty: b.level }, true);
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
    const session = Session.start(b.setup, { deckNames: ['Your march', b.foeName], difficulty: b.level }, true);
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
    if (this.match) {
      this.match.key(code);
      return;
    }
    if (code === 'Escape') {
      if (this.deckOpen || this.removing) { this.deckOpen = false; this.removing = false; }
      else this.exit = true;
    }
  }

  pointerMove(x: number, y: number): void {
    if (this.match) { this.match.pointerMove(x, y); return; }
    this.hover = this.hots.find((h) => x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h)?.id ?? null;
  }

  pointerDown(x: number, y: number): void {
    if (this.match) { this.match.pointerDown(x, y); return; }
    const h = this.hots.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
    if (!h) return;
    this.note = '';
    const [k, v] = h.id.split('|');
    const r = this.run;
    if (k === 'title') { this.exit = true; return; }
    if (k === 'faction') {
      this.run = newRun(v as FactionId, (Math.random() * 0x7fffffff) >>> 0);
      this.save();
      return;
    }
    if (!r) return;
    if (k === 'deck') { this.deckOpen = !this.deckOpen; return; }
    if (k === 'close') { this.deckOpen = false; this.removing = false; return; }
    if (k === 'abandon') { this.confirmAbandon = true; return; }
    if (k === 'abandon-yes') { clearRun(); this.run = null; this.confirmAbandon = false; return; }
    if (k === 'abandon-no') { this.confirmAbandon = false; return; }
    if (k === 'newrun') { clearRun(); this.run = null; return; }
    if (k === 'node') {
      enter(r, v);
      this.foeDeckOpen = false;
      this.save();
      return;
    }
    if (k === 'fight') { this.startBattle(); this.save(); return; }
    if (k === 'foedeck') { this.foeDeckOpen = !this.foeDeckOpen; return; }
    if (k === 'choice') {
      const why = chooseEvent(r, Number(v));
      if (why) this.note = why;
      this.save();
      return;
    }
    if (k === 'evcut') {
      removeForEvent(r, v);
      this.save();
      return;
    }
    if (k === 'take') { takeReward(r, v === '-' ? null : v); this.save(); return; }
    if (k === 'repair') { rest(r, { kind: 'repair' }); this.save(); return; }
    if (k === 'remove') { this.removing = true; return; }
    if (k === 'cut') {
      rest(r, { kind: 'remove', card: v });
      this.removing = false;
      this.save();
      return;
    }
    if (k === 'buy') {
      const why = buy(r, v);
      if (why) this.note = why;
      this.save();
      return;
    }
    if (k === 'leave') { leaveSupply(r); this.save(); }
  }

  // ---------- drawing ----------
  draw(g: Gfx, t: number): void {
    if (this.match) {
      this.match.draw(g, t);
      return;
    }
    this.hots = [];
    const r = this.run;
    if (!r) { this.drawPick(g); return; }
    const bg = field(ACT_FIELDS[Math.min(2, r.act - 1)]);
    if (bg) g.ctx.drawImage(bg, 0, 0, HW, HH);
    g.dither50(0, 0, HW, HH, 'ink');
    if (r.phase === 'won' || r.phase === 'lost') this.drawEnd(g, r);
    else {
      this.drawMap(g, r, t);
      this.drawSide(g, r);
      if (r.phase === 'reward') this.drawReward(g, r);
      if (r.phase === 'rest') this.drawRest(g, r);
      if (r.phase === 'supply') this.drawSupply(g, r);
      if (r.phase === 'event' || r.phase === 'eventRemove') this.drawEvent(g, r);
      if (r.phase === 'battle') this.drawBriefing(g, r);
    }
    if (this.deckOpen || this.removing || r.phase === 'eventRemove') this.drawDeck(g, r);
    if (this.note) {
      g.rect(0, HH - 14, HW, 14, 'ink');
      drawText(g, this.note.toUpperCase().slice(0, 84), 4, HH - 11, { color: 'emberGlow' });
    }
  }

  private button(g: Gfx, label: string, x: number, y: number, id: string, on = true): number {
    const w = textWidth(label) + 14;
    g.rect(x, y, w, 16, 'ink');
    g.rect(x + 1, y + 1, w - 2, 14, on ? 'brassDark' : 'ironDark');
    g.rect(x + 1, y + 1, w - 2, 1, on ? 'brassLight' : 'iron');
    drawText(g, label, x + 7, y + 5, { color: on ? 'brassGlint' : 'iron' });
    if (on) this.hots.push({ x, y, w, h: 16, id });
    return w;
  }

  private drawPick(g: Gfx): void {
    g.rect(0, 0, HW, HH, 'duskZenith');
    g.dither25(0, 0, HW, HH, 'gloamDeep');
    drawTextCentred(g, 'THE MARCH ON VASKOR', HW / 2, 10, { color: 'brassGlint', scale: 2 });
    drawTextCentred(g, 'CHOOSE YOUR FACTION. YOUR DECK GROWS WITH EVERY BATTLE;', HW / 2, 30, { color: 'steam' });
    drawTextCentred(g, 'YOUR BOILER ONLY HEALS AT REST STOPS AND DEPOTS.', HW / 2, 40, { color: 'steam' });
    if (this.problem) drawTextCentred(g, this.problem.toUpperCase().slice(0, 84), HW / 2, 50, { color: 'emberGlow' });
    FACTIONS.forEach((f, i) => {
      const x = 8 + (i % 3) * 168, y = 58 + Math.floor(i / 3) * 186;
      const id = `faction|${f.engine}`;
      const on = this.hover === id;
      g.rect(x, y, 160, 178, on ? 'brassGlint' : 'brassDark');
      g.rect(x + 1, y + 1, 158, 176, 'ironNight');
      const em = emblem(f.key);
      if (em) g.ctx.drawImage(em, x + 4, y + 4);
      drawText(g, f.name.replace('THE ', ''), x + 40, y + 8, { color: 'brassGlint' });
      const lead = LEADS[f.engine as FactionId];
      drawText(g, face(null, 0, lead).name.toUpperCase().slice(0, 19), x + 40, y + 20, { color: 'steam' });
      const art = cardArt(lead);
      if (art) g.ctx.drawImage(art, x + 4, y + 40, 128, 96);
      wrap(FACTION_INFO[f.engine as FactionId].blurb.toUpperCase(), 25).slice(0, 4).forEach((l, j) => drawText(g, l, x + 6, y + 140 + j * 9, { color: 'steamWhite' }));
      this.hots.push({ x, y, w: 160, h: 178, id });
    });
    this.button(g, 'BACK', 8, HH - 24, 'title');
  }

  private nodePos(r: RunState, n: MapNode): [number, number] {
    const row = r.map.floors[n.floor - 1];
    const i = row.indexOf(n);
    const x = 30 + ((i + 1) * 300) / (row.length + 1);
    const y = HH - 36 - ((n.floor - 1) * (HH - 80)) / (FLOORS - 1);
    return [Math.round(x), Math.round(y)];
  }

  private drawMap(g: Gfx, r: RunState, t: number): void {
    drawText(g, `ACT ${r.act}: ${ACT_NAMES[r.act - 1]}`, 8, 6, { color: 'brassGlint', scale: 2 });
    const can = new Set(choices(r).map((n) => n.id));
    // links first
    for (const row of r.map.floors) for (const n of row) {
      const [x0, y0] = this.nodePos(r, n);
      for (const id of n.links) {
        const m = r.map.floors.flat().find((q) => q.id === id)!;
        const [x1, y1] = this.nodePos(r, m);
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        const lit = r.at === n.id && can.has(m.id);
        for (let s = 0; s <= steps; s += 2) g.rect(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, 2, 2, lit ? 'brassGlint' : 'ironLight');
      }
    }
    const pulse = (t >> 4) % 2 === 0;
    for (const row of r.map.floors) for (const n of row) {
      const [x, y] = this.nodePos(r, n);
      const st = KIND_STYLE[n.kind];
      const size = n.kind === 'boss' ? 22 : 16;
      const here = r.at === n.id;
      const open = can.has(n.id);
      g.rect(x - size / 2 - 1, y - size / 2 - 1, size + 2, size + 2, here ? 'gloamWhite' : open ? (pulse ? 'brassGlint' : 'brass') : 'ink');
      g.rect(x - size / 2, y - size / 2, size, size, open || here ? 'ironDark' : 'ironNight');
      drawText(g, st.letter, x - 2, y - 3, { color: open || here ? st.ink : 'iron' });
      if (open) this.hots.push({ x: x - size / 2 - 2, y: y - size / 2 - 2, w: size + 4, h: size + 4, id: `node|${n.id}` });
    }
    if (r.phase === 'map' && this.hover?.startsWith('node|')) {
      const n = r.map.floors.flat().find((q) => q.id === this.hover!.slice(5));
      if (n) {
        const [x, y] = this.nodePos(r, n);
        const label = `FLOOR ${n.floor}: ${KIND_STYLE[n.kind].name}`;
        g.rect(x + 14, y - 6, textWidth(label) + 8, 12, 'ink');
        drawText(g, label, x + 18, y - 3, { color: 'steamWhite' });
      }
    }
    if (r.phase === 'map') drawText(g, r.at === null ? 'CHOOSE WHERE TO START THIS ACT.' : 'CHOOSE THE NEXT STOP.', 8, 26, { color: 'steam' });
  }

  private drawSide(g: Gfx, r: RunState): void {
    const x = 352;
    drawWindow(g, x, 40, 154, 200);
    const em = emblem(FACTIONS.find((f) => f.engine === r.faction)!.key);
    if (em) g.ctx.drawImage(em, x + 8, 48);
    drawText(g, FACTION_INFO[r.faction].name.toUpperCase().slice(0, 18), x + 44, 52, { color: 'brassGlint' });
    drawText(g, `BOILER ${r.boiler}/${LIMITS.spire}`, x + 10, 86, { color: r.boiler <= 6 ? 'emberGlow' : 'steamWhite' });
    drawText(g, `SCRIP ${r.scrip}`, x + 10, 98, { color: 'brassLight' });
    drawText(g, `DECK ${r.deck.length} CARDS`, x + 10, 110, { color: 'steamWhite' });
    drawText(g, `BATTLES WON ${r.wins}`, x + 10, 122, { color: 'steam' });
    let ly = 140;
    for (const k of ['skirmish', 'elite', 'rest', 'supply', 'event', 'boss'] as const) {
      drawText(g, `${KIND_STYLE[k].letter} ${KIND_STYLE[k].name}`, x + 10, ly, { color: KIND_STYLE[k].ink });
      ly += 10;
    }
    this.button(g, this.deckOpen ? 'HIDE DECK' : 'VIEW DECK', x + 8, 210, 'deck');
    this.button(g, 'TITLE', x + 92, 210, 'title');
    if (this.confirmAbandon) {
      drawText(g, 'END THIS RUN FOR GOOD?', x + 8, 248, { color: 'emberGlow' });
      this.button(g, 'YES, END IT', x + 8, 260, 'abandon-yes');
      this.button(g, 'NO', x + 100, 260, 'abandon-no');
    } else this.button(g, 'ABANDON RUN', x + 8, 250, 'abandon');
    const lines = r.log.slice(-5).flatMap((l) => wrap(l.toUpperCase(), 25));
    const recent = lines.slice(-12);
    recent.forEach((l, i) => drawText(g, l, x, 286 + i * 10, { color: i >= recent.length - 2 ? 'steamWhite' : 'ironLight' }));
  }

  private cardPanel(g: Gfx, id: string, x: number, y: number, hot: string, foot: string): void {
    const d = def(id);
    const f = face(null, 0, id);
    const on = this.hover === hot;
    g.rect(x, y, 150, 250, on ? 'brassGlint' : 'brassDark');
    g.rect(x + 1, y + 1, 148, 248, 'ironNight');
    const art = cardArt(id, false, true);
    if (art) g.ctx.drawImage(art, x + 11, y + 6);
    wrap(f.name.toUpperCase(), 23).slice(0, 2).forEach((l, i) => drawText(g, l, x + 6, y + 108 + i * 9, { color: 'brassGlint' }));
    const stat = d.type === 'glyph' ? `TACTIC, COST ${d.cost}` : `COST ${d.cost}  ${f.power}|${f.health}`;
    drawText(g, stat, x + 6, y + 128, { color: 'steam' });
    wrap(f.text.toUpperCase(), 23).slice(0, 10).forEach((l, i) => drawText(g, l, x + 6, y + 140 + i * 9, { color: 'steamWhite' }));
    drawText(g, foot, x + 6, y + 238, { color: 'brassLight' });
    this.hots.push({ x, y, w: 150, h: 250, id: hot });
  }

  private drawReward(g: Gfx, r: RunState): void {
    drawWindow(g, 10, 40, 492, 360);
    drawTextCentred(g, `VICTORY: +${r.offer!.scrip} SCRIP. TAKE ONE CARD FOR YOUR DECK.`, HW / 2, 52, { color: 'brassGlint' });
    r.offer!.cards.forEach((id, i) => this.cardPanel(g, id, 24 + i * 160, 70, `take|${id}`, 'CLICK TO TAKE'));
    this.button(g, 'TAKE NO CARD', HW / 2 - 50, 370, 'take|-');
  }

  private drawRest(g: Gfx, r: RunState): void {
    drawWindow(g, 60, 120, 392, 150);
    drawTextCentred(g, 'A REST STOP', HW / 2, 134, { color: 'brassGlint', scale: 2 });
    drawTextCentred(g, `REPAIR THE BOILER BY ${REST_REPAIR} (UP TO ${LIMITS.spire}), OR REMOVE ONE CARD FROM YOUR DECK.`, HW / 2, 160, { color: 'steamWhite' });
    this.button(g, `REPAIR (+${Math.min(REST_REPAIR, LIMITS.spire - r.boiler)})`, 120, 190, 'repair');
    this.button(g, 'REMOVE A CARD', 280, 190, 'remove', r.deck.length > MIN_DECK);
    if (r.deck.length <= MIN_DECK) drawTextCentred(g, `YOUR DECK IS AT THE ${MIN_DECK}-CARD MINIMUM.`, HW / 2, 220, { color: 'iron' });
  }

  private drawSupply(g: Gfx, r: RunState): void {
    drawWindow(g, 10, 40, 492, 380);
    drawTextCentred(g, `SUPPLY DEPOT. YOU HAVE ${r.scrip} SCRIP.`, HW / 2, 52, { color: 'brassGlint' });
    r.shop!.cards.forEach((c, i) => {
      const x = 20 + i * 120, y = 66;
      const on = this.hover === `buy|${c.id}`;
      g.rect(x, y, 112, 200, c.sold ? 'iron' : on ? 'brassGlint' : 'brassDark');
      g.rect(x + 1, y + 1, 110, 198, 'ironNight');
      const art = cardArt(c.id);
      if (art) g.ctx.drawImage(art, x + 24, y + 6);
      const f = face(null, 0, c.id);
      wrap(f.name.toUpperCase(), 17).slice(0, 2).forEach((l, j) => drawText(g, l, x + 4, y + 58 + j * 9, { color: 'brassGlint' }));
      const d = def(c.id);
      drawText(g, d.type === 'glyph' ? `TACTIC ${d.cost}` : `COST ${d.cost} ${f.power}|${f.health}`, x + 4, y + 78, { color: 'steam' });
      wrap(f.text.toUpperCase(), 17).slice(0, 10).forEach((l, j) => drawText(g, l, x + 4, y + 90 + j * 9, { color: 'steamWhite' }));
      drawText(g, c.sold ? 'BOUGHT' : `${c.price} SCRIP`, x + 4, y + 188, { color: c.sold ? 'iron' : 'brassLight' });
      if (!c.sold) this.hots.push({ x, y, w: 112, h: 200, id: `buy|${c.id}` });
    });
    this.button(g, r.shop!.repairSold ? 'REPAIR USED' : `REPAIR +${SUPPLY_REPAIR} FOR ${SUPPLY_REPAIR_PRICE}`, 20, 280, 'buy|repair', !r.shop!.repairSold);
    this.button(g, 'LEAVE THE DEPOT', 360, 390, 'leave');
  }

  private drawDeck(g: Gfx, r: RunState): void {
    drawWindow(g, 6, 30, 340, 410);
    const cutting = this.removing || r.phase === 'eventRemove';
    drawText(g, cutting ? 'CLICK A CARD TO REMOVE IT' : `YOUR DECK: ${r.deck.length} CARDS`, 16, 40, { color: 'brassGlint' });
    const counts = new Map<string, number>();
    for (const id of r.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const ids = [...counts.keys()].sort((a, b) => def(a).cost - def(b).cost || a.localeCompare(b));
    ids.forEach((id, i) => {
      const x = 16 + Math.floor(i / 36) * 166, y = 54 + (i % 36) * 10;
      const label = `${def(id).cost} ${face(null, 0, id).name.toUpperCase().slice(0, 20)} X${counts.get(id)}`;
      const hot = r.phase === 'eventRemove' ? `evcut|${id}` : this.removing ? `cut|${id}` : `none|${id}`;
      if (this.hover === hot && cutting) g.rect(x - 2, y - 1, 164, 9, 'emberDeep');
      drawText(g, label, x, y, { color: 'steamWhite' });
      if (cutting) this.hots.push({ x: x - 2, y: y - 1, w: 164, h: 9, id: hot });
    });
    if (r.phase !== 'eventRemove') this.button(g, 'CLOSE', 280, 420, 'close');
  }

  private drawEvent(g: Gfx, r: RunState): void {
    const ev = EVENTS.find((e) => e.id === r.event?.id);
    if (!ev || r.phase === 'eventRemove') return;
    drawWindow(g, 20, 110, 472, 210);
    drawTextCentred(g, ev.title, HW / 2, 124, { color: 'brassGlint', scale: 2 });
    ev.text.forEach((l, i) => drawTextCentred(g, l.toUpperCase(), HW / 2, 152 + i * 11, { color: 'steamWhite' }));
    ev.choices.forEach((c, i) => {
      const y = 196 + i * 26;
      const short = (c.costScrip ?? 0) > r.scrip;
      const id = `choice|${i}`;
      g.rect(36, y, 440, 20, this.hover === id && !short ? 'brassGlint' : 'brassDark');
      g.rect(37, y + 1, 438, 18, short ? 'ironNight' : 'ironDark');
      drawText(g, c.label, 46, y + 7, { color: short ? 'iron' : 'brassGlint' });
      this.hots.push({ x: 36, y, w: 440, h: 20, id });
    });
  }

  private drawBriefing(g: Gfx, r: RunState): void {
    const b = r.battle!;
    const deck = b.setup.decks[1];
    const factions = [...new Set(deck.map((id) => def(id).faction))];
    drawWindow(g, 20, 60, 472, this.foeDeckOpen ? 370 : 230);
    const intro = b.kind === 'boss' ? BOSS_INTRO[factions[0]] : null;
    drawTextCentred(g, b.kind === 'boss' ? `BOSS: ${intro?.who ?? b.foeName.toUpperCase()}` : `${KIND_STYLE[b.kind].name}: ${b.foeName.toUpperCase()}`, HW / 2, 74, { color: b.kind === 'boss' ? 'emberGlow' : 'brassGlint', scale: 2 });
    let y = 100;
    if (intro) for (const l of intro.lines) { drawTextCentred(g, l, HW / 2, y, { color: 'steamWhite' }); y += 11; }
    y += 6;
    drawTextCentred(g, `FACTIONS: ${factions.map((f) => FACTION_NAMES[f].toUpperCase()).join(', ')}`, HW / 2, y, { color: 'steam' });
    drawTextCentred(g, `FOE DECK ${deck.length} CARDS   FOE BOILER ${b.setup.startSpire?.[1] ?? 20}   AI LEVEL ${b.level === 'easy' ? 'RECRUIT' : b.level === 'normal' ? 'VETERAN' : 'MARSHAL'}`, HW / 2, y + 12, { color: 'steam' });
    drawTextCentred(g, `YOUR BOILER ${r.boiler}   YOUR DECK ${r.deck.length} CARDS`, HW / 2, y + 24, { color: 'steamWhite' });
    const by = this.foeDeckOpen ? 400 : 250;
    this.button(g, 'FIGHT', 300, by, 'fight');
    this.button(g, this.foeDeckOpen ? 'HIDE FOE DECK' : 'VIEW FOE DECK', 150, by, 'foedeck');
    if (this.foeDeckOpen) {
      const counts = new Map<string, number>();
      for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, c) => def(a).cost - def(c).cost || a.localeCompare(c));
      ids.forEach((id, i) => {
        const x = 34 + Math.floor(i / 20) * 230, yy = y + 42 + (i % 20) * 10;
        drawText(g, `${def(id).cost} ${face(null, 1, id).name.toUpperCase().slice(0, 28)} X${counts.get(id)}`, x, yy, { color: def(id).type === 'hero' ? 'brassLight' : 'steamWhite' });
      });
    }
  }

  private drawEnd(g: Gfx, r: RunState): void {
    drawWindow(g, 80, 140, 352, 150);
    const won = r.phase === 'won';
    drawTextCentred(g, won ? 'THE MARCH IS WON' : 'THE MARCH IS OVER', HW / 2, 156, { color: won ? 'brassGlint' : 'emberGlow', scale: 2 });
    drawTextCentred(g, `${FACTION_INFO[r.faction].name.toUpperCase()}: ACT ${r.act}, ${r.wins} BATTLES WON, ${r.deck.length} CARDS`, HW / 2, 186, { color: 'steamWhite' });
    drawTextCentred(g, (r.log[r.log.length - 1] ?? '').toUpperCase().slice(0, 56), HW / 2, 200, { color: 'steam' });
    this.button(g, 'NEW RUN', 150, 240, 'newrun');
    this.button(g, 'TITLE', 300, 240, 'title');
  }
}
