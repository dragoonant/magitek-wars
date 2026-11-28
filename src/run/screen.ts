// The campaign screens (spec 20, PLAN D18), hi-res 512 x 448: faction pick, act map, reward, rest, supply, deck,
// and the end of the run. Battles use the match screen; this controller starts them and reads their result.
import { drawPic } from '../detail';
import type { FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, face } from '../engine/query';
import { replay } from '../engine/save';
import { drawText, drawTextCentred, fitText, textWidth, wrapPx } from '../font';
import type { Gfx } from '../gfx';
import { PALETTE, rgba, type Ink } from '../palette';
import { backdrop, button, clipRound, fillRound, frame, highlight, panel, rule, type Field } from '../ui';
import { FACTIONS } from '../data/factions';
import { FACTION_INFO } from '../data/decks';
import { cardArt, emblem, portrait } from '../match/art';
import { HH, HW, Match } from '../match/board';
import { Session } from '../match/session';
import {
  ACT_NAMES, FLOORS, LEADS, MIN_DECK, REST_REPAIR, SUPPLY_REPAIR, SUPPLY_REPAIR_PRICE, buy, choices, enter, finishBattle,
  leaveSupply, newRun, rest, takeReward, chooseEvent, removeForEvent, FACTION_NAMES, type MapNode, type RunState,
} from './run';
import { BOSS_INTRO, EVENTS } from './events';
import { NATIONS } from '../story';

export const RUN_KEY = 'magitek-wars.run';
const ACT_FIELDS: Field[] = ['thrumhollow', 'rimeglass', 'vaskor'];

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
    // D24 renamed the Boiler to the Crystal and the gloam seep to a crystal seam: carry older saves across.
    const old = s.run as RunState & { boiler?: number };
    if (old.crystal === undefined && typeof old.boiler === 'number') { old.crystal = old.boiler; delete old.boiler; }
    if (old.event?.id === 'gloam-seep') old.event.id = 'crystal-seam';
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
  rest: { letter: 'R', ink: 'crystalBright', name: 'REST' },
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
  /** The nation whose prologue is open on the pick screen, before the run begins (R-R13). */
  private preview: FactionId | null = null;
  /** The act whose opening line has been read; a later act shows its line first (R-R13). */
  private seenAct = 0;
  /** Set when the player leaves for the title. */
  exit = false;

  constructor() {
    const r = readRun();
    if (r && 'problem' in r) this.problem = r.problem;
    else if (r) {
      this.run = r.run;
      this.seenAct = r.run.act;
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
      if (this.preview) this.preview = null;
      else if (this.deckOpen || this.removing) { this.deckOpen = false; this.removing = false; }
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
    if (k === 'faction') { this.preview = v as FactionId; return; }
    if (k === 'pickagain') { this.preview = null; return; }
    if (k === 'begin' && this.preview) {
      this.run = newRun(this.preview, (Math.random() * 0x7fffffff) >>> 0);
      this.preview = null;
      this.seenAct = 0;
      this.save();
      return;
    }
    if (!r) return;
    if (k === 'marchon') { this.seenAct = r.act; return; }
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

  // ---------- drawing (PLAN D25: painted backdrops, glass panels, brass buttons, real type) ----------
  draw(g: Gfx, t: number): void {
    if (this.match) {
      this.match.draw(g, t);
      return;
    }
    this.hots = [];
    const r = this.run;
    if (!r) {
      if (this.preview) this.drawPrologue(g, this.preview);
      else this.drawPick(g, t);
      return;
    }
    backdrop(g, HW, HH, ACT_FIELDS[Math.min(2, r.act - 1)], 0.5);
    if (r.phase === 'won' || r.phase === 'lost') this.drawEnd(g, r);
    else {
      this.drawMap(g, r, t);
      this.drawSide(g, r);
      const modal = r.phase === 'reward' || r.phase === 'rest' || r.phase === 'supply' || r.phase === 'event' || r.phase === 'battle';
      if (modal) g.wash(0, 0, HW, HH, 'ink', 0.45);
      if (r.phase === 'reward') this.drawReward(g, r);
      if (r.phase === 'rest') this.drawRest(g, r);
      if (r.phase === 'supply') this.drawSupply(g, r);
      if (r.phase === 'event' || r.phase === 'eventRemove') this.drawEvent(g, r);
      if (r.phase === 'battle') this.drawBriefing(g, r);
      if (r.phase === 'map' && r.act > this.seenAct) this.drawActCard(g, r);
    }
    if (this.deckOpen || this.removing || r.phase === 'eventRemove') this.drawDeck(g, r);
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
  }

  private button(g: Gfx, label: string, x: number, y: number, id: string, on = true): number {
    const w = textWidth(label, 1, 'display') + 16;
    button(g, label, x, y, { w, h: 16, state: !on ? 'off' : this.hover === id ? 'hot' : 'on' });
    if (on) this.hots.push({ x, y, w, h: 16, id });
    return w;
  }

  /** A card's picture in a rounded brass frame. */
  private pic(g: Gfx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, ink: Ink = 'brassDark', glow = false): void {
    if (img) {
      const un = clipRound(g, x, y, w, h, 3);
      drawPic(g, img, x, y, w, h);
      un();
    } else fillRound(g, x, y, w, h, 'ironDark', 0.9, 3);
    frame(g, x, y, w, h, ink, 3, glow);
  }

  private drawPick(g: Gfx, t: number): void {
    backdrop(g, HW, HH, 'vaskor', 0.55);
    drawTextCentred(g, 'THE MARCH ON VASKOR', HW / 2, 9, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    drawTextCentred(g, 'Choose a nation to read why it marches. Your deck grows with every battle; your Crystal heals at rests and depots.', HW / 2, 32, { color: 'steam', scale: 0.95 });
    if (this.problem) drawTextCentred(g, fitText(this.problem, HW - 20), HW / 2, 44, { color: 'emberGlow', face: 'bold' });
    FACTIONS.forEach((f, i) => {
      const x = 8 + (i % 3) * 168, y = 56 + Math.floor(i / 3) * 186;
      const id = `faction|${f.engine}`;
      const on = this.hover === id;
      panel(g, x, y, 160, 178, { glow: on ? 'brassGlint' : undefined, tone: on ? 'light' : 'glass', studs: false });
      const em = emblem(f.key);
      if (em) drawPic(g, em, x + 5, y + 5);
      drawText(g, fitText(f.name.replace('THE ', ''), 112, 1, 'display'), x + 42, y + 10, { color: 'brassGlint', face: 'display', shadow: 'ink' });
      const lead = LEADS[f.engine as FactionId];
      drawText(g, fitText(face(null, 0, lead).name, 112), x + 42, y + 22, { color: 'steam' });
      this.pic(g, cardArt(lead), x + 16, y + 40, 128, 96, on ? 'brassGlint' : 'brassDark', on);
      wrapPx(FACTION_INFO[f.engine as FactionId].blurb, 146).slice(0, 3).forEach((l, j) => drawText(g, l, x + 7, y + 142 + j * 10.5, { color: 'steamWhite' }));
      this.hots.push({ x, y, w: 160, h: 178, id });
    });
    void t;
    this.button(g, 'BACK', 8, HH - 24, 'title');
  }

  /** A nation's prologue (R-R13): who leads it and why it marches on Vaskor, before the run begins. */
  private drawPrologue(g: Gfx, f: FactionId): void {
    const fac = FACTIONS.find((q) => q.engine === f)!;
    const story = NATIONS[f];
    backdrop(g, HW, HH, fac.field as Field, 0.6);
    panel(g, 20, 12, 472, 424, { glow: 'brass' });
    const em = emblem(fac.key);
    if (em) { drawPic(g, em, 34, 24); drawPic(g, em, HW - 34 - 28, 24); }
    drawTextCentred(g, fac.name, HW / 2, 26, { color: 'brassGlint', scale: 2, face: 'display', shadow: 'ink' });
    drawTextCentred(g, story.lead, HW / 2, 48, { color: 'steam', face: 'display' });
    this.pic(g, cardArt(LEADS[f], false, true), HW / 2 - 96, 64, 192, 144, 'brass', true);
    drawTextCentred(g, story.title, HW / 2, 218, { color: 'emberGlow', scale: 1.3, face: 'display', shadow: 'ink' });
    rule(g, 60, 234, 392);
    let y = 242;
    for (const para of story.prologue) {
      for (const l of wrapPx(para, 440)) { drawText(g, l, 36, y, { color: 'steamWhite' }); y += 11.5; }
      y += 5;
    }
    this.button(g, 'CHOOSE ANOTHER NATION', 36, 410, 'pickagain');
    const label = 'BEGIN THE MARCH';
    this.button(g, label, HW - 36 - (textWidth(label, 1, 'display') + 16), 410, 'begin');
  }

  /** The opening of an act (R-R13): where the march has reached, and what it means for this nation. */
  private drawActCard(g: Gfx, r: RunState): void {
    this.hots = []; // the map waits under the card
    g.wash(0, 0, HW, HH, 'ink', 0.55);
    const lines = wrapPx(NATIONS[r.faction].acts[r.act - 1], 380, 1.1);
    const h = 92 + lines.length * 13;
    const y0 = Math.round((HH - h) / 2);
    panel(g, 56, y0, 400, h, { glow: 'brass' });
    drawTextCentred(g, `ACT ${r.act}`, HW / 2, y0 + 14, { color: 'emberGlow', face: 'display', shadow: 'ink' });
    drawTextCentred(g, ACT_NAMES[r.act - 1], HW / 2, y0 + 28, { color: 'brassGlint', scale: 2, face: 'display', shadow: 'ink' });
    rule(g, 96, y0 + 52, 320);
    lines.forEach((l, i) => drawTextCentred(g, l, HW / 2, y0 + 60 + i * 13, { color: 'steamWhite', scale: 1.1 }));
    const label = 'MARCH ON';
    this.button(g, label, HW / 2 - (textWidth(label, 1, 'display') + 16) / 2, y0 + h - 26, 'marchon');
  }

  private nodePos(r: RunState, n: MapNode): [number, number] {
    const row = r.map.floors[n.floor - 1];
    const i = row.indexOf(n);
    const x = 30 + ((i + 1) * 300) / (row.length + 1);
    const y = HH - 36 - ((n.floor - 1) * (HH - 80)) / (FLOORS - 1);
    return [Math.round(x), Math.round(y)];
  }

  /** A map stop: a brass-rimmed medallion with its kind's letter; lit when it is where you are or can go. */
  private medallion(g: Gfx, x: number, y: number, rad: number, n: MapNode, here: boolean, open: boolean, glow: number): void {
    const ctx = g.ctx;
    const st = KIND_STYLE[n.kind];
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
    // rim
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    const rim = ctx.createLinearGradient(x, y - rad, x, y + rad);
    rim.addColorStop(0, PALETTE[here ? 'crystalWhite' : lit ? 'brassGlint' : 'iron']);
    rim.addColorStop(0.5, PALETTE[here ? 'crystal' : lit ? 'brass' : 'ironDark']);
    rim.addColorStop(1, PALETTE[here ? 'crystalDeep' : lit ? 'brassShadow' : 'ironNight']);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.restore();
    // face
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
    const sc = n.kind === 'boss' ? 1.5 : 1.1;
    drawTextCentred(g, st.letter, x, y - 3.5 * sc, { color: lit ? st.ink : 'iron', face: 'display', scale: sc, shadow: 'ink' });
  }

  private drawMap(g: Gfx, r: RunState, t: number): void {
    drawText(g, `ACT ${r.act}: ${ACT_NAMES[r.act - 1]}`, 10, 8, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    const can = new Set(choices(r).map((n) => n.id));
    const ctx = g.ctx;
    // links first: smooth paths; the ones leading on from here are lit and crawl
    for (const row of r.map.floors) for (const n of row) {
      const [x0, y0] = this.nodePos(r, n);
      for (const id of n.links) {
        const m = r.map.floors.flat().find((q) => q.id === id)!;
        const [x1, y1] = this.nodePos(r, m);
        const lit = r.at === n.id && can.has(m.id);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = lit ? 2 : 1.25;
        ctx.strokeStyle = lit ? PALETTE.brassGlint : rgba('ironLight', 0.55);
        if (lit) {
          ctx.shadowColor = rgba('brassGlint', 0.8);
          ctx.shadowBlur = 4;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -t * 0.4;
        } else ctx.setLineDash([2, 3]);
        const mx = (x0 + x1) / 2 + (y1 - y0) * 0.08, my = (y0 + y1) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(mx, my, x1, y1);
        ctx.stroke();
        ctx.restore();
      }
    }
    const glow = 0.5 + 0.5 * Math.sin(t / 9);
    for (const row of r.map.floors) for (const n of row) {
      const [x, y] = this.nodePos(r, n);
      const rad = n.kind === 'boss' ? 13 : 9;
      const here = r.at === n.id;
      const open = can.has(n.id);
      const hov = this.hover === `node|${n.id}`;
      this.medallion(g, x, y, rad + (hov ? 1 : 0), n, here, open, open ? glow : here ? 0.6 : 0);
      const size = n.kind === 'boss' ? 22 : 16;
      if (open) this.hots.push({ x: x - size / 2 - 2, y: y - size / 2 - 2, w: size + 4, h: size + 4, id: `node|${n.id}` });
    }
    if (r.phase === 'map' && this.hover?.startsWith('node|')) {
      const n = r.map.floors.flat().find((q) => q.id === this.hover!.slice(5));
      if (n) {
        const [x, y] = this.nodePos(r, n);
        const label = `Floor ${n.floor}: ${KIND_STYLE[n.kind].name.toLowerCase()}`;
        const w = textWidth(label, 1, 'bold') + 12;
        fillRound(g, x + 16, y - 8, w, 15, 'ink', 0.88, 4);
        frame(g, x + 16, y - 8, w, 15, 'brass', 4);
        drawText(g, label, x + 22, y - 4, { color: 'steamWhite', face: 'bold' });
      }
    }
    if (r.phase === 'map') drawText(g, r.at === null ? 'Choose where to start this act.' : 'Choose the next stop.', 10, 30, { color: 'steam', shadow: 'ink' });
  }

  private drawSide(g: Gfx, r: RunState): void {
    const x = 352;
    panel(g, x, 40, 154, 242);
    const em = emblem(FACTIONS.find((f) => f.engine === r.faction)!.key);
    if (em) drawPic(g, em, x + 8, 48);
    wrapPx(FACTION_INFO[r.faction].name.toUpperCase(), 100, 1, 'display').slice(0, 2).forEach((l, i) => drawText(g, l, x + 44, 50 + i * 10, { color: 'brassGlint', face: 'display' }));
    const lead = portrait(LEADS[r.faction]);
    if (lead) this.pic(g, lead, x + 100, 70, 48, 48);
    const row = (label: string, value: string, y: number, ink: Ink) => {
      drawText(g, label, x + 10, y, { color: 'ironLight' });
      drawText(g, value, x + 56, y, { color: ink, face: 'bold' });
    };
    row('Crystal', `${r.crystal}/${LIMITS.spire}`, 80, r.crystal <= 6 ? 'emberGlow' : 'crystalBright');
    row('Scrip', `${r.scrip}`, 92, 'brassLight');
    row('Deck', `${r.deck.length} cards`, 104, 'steamWhite');
    row('Won', `${r.wins} battles`, 116, 'steamWhite');
    rule(g, x + 8, 132, 138);
    const ly = 138;
    (['skirmish', 'elite', 'rest', 'supply', 'event', 'boss'] as const).forEach((k, i) => {
      const lx = x + 10 + (i % 2) * 70, yy = ly + Math.floor(i / 2) * 12;
      drawText(g, KIND_STYLE[k].letter, lx, yy, { color: KIND_STYLE[k].ink, face: 'display' });
      drawText(g, KIND_STYLE[k].name.toLowerCase(), lx + 10, yy, { color: 'steam', scale: 0.9 });
    });
    this.button(g, this.deckOpen ? 'HIDE DECK' : 'VIEW DECK', x + 8, 210, 'deck');
    this.button(g, 'TITLE', x + 92, 210, 'title');
    if (this.confirmAbandon) {
      drawText(g, 'End this run for good?', x + 8, 248, { color: 'emberGlow', face: 'bold', shadow: 'ink' });
      this.button(g, 'YES, END IT', x + 8, 260, 'abandon-yes');
      this.button(g, 'NO', x + 106, 260, 'abandon-no');
    } else this.button(g, 'ABANDON RUN', x + 8, 250, 'abandon');
    const lines = r.log.slice(-5).flatMap((l) => wrapPx(l, 150, 0.95));
    const recent = lines.slice(-12);
    if (recent.length) {
      panel(g, x - 2, 288, 158, recent.length * 10.5 + 10, { tone: 'dark', studs: false });
      recent.forEach((l, i) => drawText(g, l, x + 4, 294 + i * 10.5, { color: i >= recent.length - 2 ? 'steamWhite' : 'steam', scale: 0.95, alpha: i >= recent.length - 2 ? 1 : 0.75 }));
    }
  }

  private cardPanel(g: Gfx, id: string, x: number, y: number, hot: string, foot: string): void {
    const d = def(id);
    const f = face(null, 0, id);
    const on = this.hover === hot;
    panel(g, x, y, 150, 250, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
    this.pic(g, cardArt(id, false, true), x + 11, y + 6, 128, 96, on ? 'brassGlint' : 'brassDark');
    const nm = wrapPx(f.name, 138, 1.05, 'bold').slice(0, 2);
    nm.forEach((l, i) => drawText(g, l, x + 7, y + 108 + i * 11, { color: 'brassGlint', face: 'bold', scale: 1.05 }));
    const sy = y + 110 + nm.length * 11;
    const stat = d.type === 'glyph' ? `Tactic, cost ${d.cost}` : `Cost ${d.cost} · ${f.power}|${f.health}`;
    drawText(g, stat, x + 7, sy, { color: 'steam' });
    rule(g, x + 6, sy + 11, 138);
    wrapPx(f.text, 136).slice(0, 9).forEach((l, i) => drawText(g, l, x + 7, sy + 16 + i * 10.5, { color: 'steamWhite' }));
    drawText(g, foot, x + 7, y + 236, { color: on ? 'brassGlint' : 'brassLight', face: 'display' });
    this.hots.push({ x, y, w: 150, h: 250, id: hot });
  }

  private drawReward(g: Gfx, r: RunState): void {
    panel(g, 10, 40, 492, 360);
    drawTextCentred(g, 'VICTORY', HW / 2, 50, { color: 'brassGlint', scale: 1.6, glow: 'brass' });
    drawTextCentred(g, `+${r.offer!.scrip} scrip. Take one card for your deck.`, HW / 2, 66, { color: 'steamWhite' });
    r.offer!.cards.forEach((id, i) => this.cardPanel(g, id, 24 + i * 160, 80, `take|${id}`, 'CLICK TO TAKE'));
    this.button(g, 'TAKE NO CARD', HW / 2 - (textWidth('TAKE NO CARD', 1, 'display') + 16) / 2, 372, 'take|-');
  }

  private drawRest(g: Gfx, r: RunState): void {
    panel(g, 60, 120, 392, 118);
    drawTextCentred(g, 'A REST STOP', HW / 2, 134, { color: 'brassGlint', scale: 2, shadow: 'ink' });
    wrapPx(`Repair the Crystal by ${REST_REPAIR} (up to ${LIMITS.spire}), or remove one card from your deck.`, 360).forEach((l, i) => drawTextCentred(g, l, HW / 2, 160 + i * 11, { color: 'steamWhite' }));
    this.button(g, `REPAIR (+${Math.min(REST_REPAIR, LIMITS.spire - r.crystal)})`, 120, 190, 'repair');
    this.button(g, 'REMOVE A CARD', 280, 190, 'remove', r.deck.length > MIN_DECK);
    if (r.deck.length <= MIN_DECK) drawTextCentred(g, `Your deck is at the ${MIN_DECK}-card minimum.`, HW / 2, 220, { color: 'ironLight' });
  }

  private drawSupply(g: Gfx, r: RunState): void {
    panel(g, 10, 40, 492, 380);
    drawTextCentred(g, 'SUPPLY DEPOT', HW / 2, 49, { color: 'brassGlint', scale: 1.5, shadow: 'ink' });
    drawTextCentred(g, `You have ${r.scrip} scrip.`, HW / 2, 64, { color: 'brassLight', face: 'bold' });
    r.shop!.cards.forEach((c, i) => {
      const x = 20 + i * 120, y = 76;
      const on = this.hover === `buy|${c.id}`;
      panel(g, x, y, 112, 196, { tone: on ? 'light' : 'dark', glow: on ? 'brassGlint' : undefined, studs: false });
      this.pic(g, cardArt(c.id), x + 8, y + 6, 96, 72, c.sold ? 'iron' : on ? 'brassGlint' : 'brassDark');
      if (c.sold) g.wash(x + 8, y + 6, 96, 72, 'ink', 0.55);
      const f = face(null, 0, c.id);
      const nm = wrapPx(f.name, 102, 1, 'bold').slice(0, 2);
      nm.forEach((l, j) => drawText(g, l, x + 6, y + 83 + j * 10, { color: 'brassGlint', face: 'bold' }));
      const d = def(c.id);
      const sy = y + 85 + nm.length * 10;
      drawText(g, d.type === 'glyph' ? `Tactic, cost ${d.cost}` : `Cost ${d.cost} · ${f.power}|${f.health}`, x + 6, sy, { color: 'steam', scale: 0.95 });
      wrapPx(f.text, 100, 0.9).slice(0, 7).forEach((l, j) => drawText(g, l, x + 6, sy + 12 + j * 9.5, { color: 'steamWhite', scale: 0.9 }));
      drawText(g, c.sold ? 'BOUGHT' : `${c.price} SCRIP`, x + 6, y + 183, { color: c.sold ? 'iron' : 'brassLight', face: 'display' });
      if (!c.sold) this.hots.push({ x, y, w: 112, h: 196, id: `buy|${c.id}` });
    });
    this.button(g, r.shop!.repairSold ? 'REPAIR USED' : `REPAIR +${SUPPLY_REPAIR} FOR ${SUPPLY_REPAIR_PRICE}`, 20, 284, 'buy|repair', !r.shop!.repairSold);
    this.button(g, 'LEAVE THE DEPOT', 492 - 10 - (textWidth('LEAVE THE DEPOT', 1, 'display') + 16), 392, 'leave');
  }

  private drawDeck(g: Gfx, r: RunState): void {
    panel(g, 6, 30, 340, 410);
    const cutting = this.removing || r.phase === 'eventRemove';
    drawText(g, cutting ? 'CLICK A CARD TO REMOVE IT' : `YOUR DECK: ${r.deck.length} CARDS`, 16, 40, { color: cutting ? 'emberGlow' : 'brassGlint', face: 'display' });
    rule(g, 12, 51, 328);
    const counts = new Map<string, number>();
    for (const id of r.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const ids = [...counts.keys()].sort((a, b) => def(a).cost - def(b).cost || a.localeCompare(b));
    ids.forEach((id, i) => {
      const x = 16 + Math.floor(i / 36) * 166, y = 56 + (i % 36) * 10;
      const hot = r.phase === 'eventRemove' ? `evcut|${id}` : this.removing ? `cut|${id}` : `none|${id}`;
      if (this.hover === hot && cutting) highlight(g, x - 3, y - 1.5, 164, 10, 'ember');
      drawText(g, String(def(id).cost), x, y, { color: 'crystalBright', face: 'bold', scale: 0.95 });
      const n = `×${counts.get(id)}`;
      drawText(g, fitText(face(null, 0, id).name, 128, 0.95), x + 10, y, { color: def(id).type === 'hero' ? 'brassLight' : 'steamWhite', scale: 0.95 });
      drawText(g, n, x + 158 - textWidth(n, 0.95), y, { color: 'ironLight', scale: 0.95 });
      if (cutting) this.hots.push({ x: x - 2, y: y - 1, w: 164, h: 9, id: hot });
    });
    if (r.phase !== 'eventRemove') this.button(g, 'CLOSE', 280, 420, 'close');
  }

  private drawEvent(g: Gfx, r: RunState): void {
    const ev = EVENTS.find((e) => e.id === r.event?.id);
    if (!ev || r.phase === 'eventRemove') return;
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
    const intro = b.kind === 'boss' ? BOSS_INTRO[factions[0]] : null;
    const bossPic = bossFace && intro ? portrait(intro.hero) : null;
    // the buttons sit just under the facts (or under the foe's deck list when it is open)
    const factsY = 104 + (bossPic ? 104 : 0) + (intro ? intro.lines.length * 12 : 0);
    const by = this.foeDeckOpen ? 400 : factsY + 42;
    panel(g, 20, 60, 472, by + 28 - 60, { glow: b.kind === 'boss' ? 'ember' : undefined });
    const head = b.kind === 'boss' ? `BOSS: ${intro?.who ?? b.foeName.toUpperCase()}` : `${KIND_STYLE[b.kind].name}: ${b.foeName.toUpperCase()}`;
    drawTextCentred(g, fitText(head, 452, 1.6, 'display'), HW / 2, 74, { color: b.kind === 'boss' ? 'emberGlow' : 'brassGlint', scale: 1.6, face: 'display', shadow: 'ink' });
    let y = 98;
    if (intro) {
      if (bossPic) { this.pic(g, bossPic, HW / 2 - 48, y, 96, 96, 'ember', true); y += 104; }
      for (const l of intro.lines) { drawTextCentred(g, fitText(l, 452, 1, 'display'), HW / 2, y, { color: 'steamWhite', face: 'display' }); y += 12; }
    }
    y += 6;
    rule(g, 40, y - 4, 432);
    drawTextCentred(g, `Factions: ${factions.map((f) => FACTION_NAMES[f]).join(', ')}`, HW / 2, y + 2, { color: 'steam' });
    drawTextCentred(g, `Foe deck ${deck.length} cards · foe Crystal ${b.setup.startSpire?.[1] ?? 20} · AI level ${b.level === 'easy' ? 'Recruit' : b.level === 'normal' ? 'Veteran' : 'Marshal'}`, HW / 2, y + 14, { color: 'steam' });
    drawTextCentred(g, `Your Crystal ${r.crystal} · your deck ${r.deck.length} cards`, HW / 2, y + 26, { color: 'crystalBright', face: 'bold' });
    this.button(g, 'FIGHT', 300, by, 'fight');
    this.button(g, this.foeDeckOpen ? 'HIDE FOE DECK' : 'VIEW FOE DECK', 150, by, 'foedeck');
    if (this.foeDeckOpen) {
      const counts = new Map<string, number>();
      for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, c) => def(a).cost - def(c).cost || a.localeCompare(c));
      ids.forEach((id, i) => {
        const x = 34 + Math.floor(i / 20) * 230, yy = y + 42 + (i % 20) * 10;
        drawText(g, String(def(id).cost), x, yy, { color: 'crystalBright', face: 'bold', scale: 0.95 });
        drawText(g, fitText(`${face(null, 1, id).name} ×${counts.get(id)}`, 206, 0.95), x + 10, yy, { color: def(id).type === 'hero' ? 'brassLight' : 'steamWhite', scale: 0.95 });
      });
    }
  }

  private drawEnd(g: Gfx, r: RunState): void {
    const won = r.phase === 'won';
    // a won run closes with its nation's ending (R-R13)
    const ending = won ? wrapPx(NATIONS[r.faction].ending, 330) : [];
    const extra = ending.length ? ending.length * 11.5 + 10 : 0;
    const h = 128 + extra;
    const y0 = Math.round((HH - h) / 2) - 20;
    panel(g, 80, y0, 352, h, { glow: won ? 'brassGlint' : 'ember' });
    drawTextCentred(g, won ? 'THE MARCH IS WON' : 'THE MARCH IS OVER', HW / 2, y0 + 16, { color: won ? 'brassGlint' : 'emberGlow', scale: 2, glow: won ? 'brass' : 'ember' });
    drawTextCentred(g, `${FACTION_INFO[r.faction].name}: act ${r.act}, ${r.wins} battles won, ${r.deck.length} cards`, HW / 2, y0 + 46, { color: 'steamWhite' });
    wrapPx(r.log[r.log.length - 1] ?? '', 330).slice(0, 2).forEach((l, i) => drawTextCentred(g, l, HW / 2, y0 + 60 + i * 11, { color: 'steam' }));
    if (ending.length) rule(g, 120, y0 + 86, 272);
    ending.forEach((l, i) => drawTextCentred(g, l, HW / 2, y0 + 94 + i * 11.5, { color: 'steamWhite' }));
    this.button(g, 'NEW RUN', 150, y0 + h - 28, 'newrun');
    this.button(g, 'TITLE', 300, y0 + h - 28, 'title');
  }
}
