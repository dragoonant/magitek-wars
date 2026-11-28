// The campaign run (docs/spec/20-roguelike.md, PLAN D18). Pure data and rules: no DOM. Everything random comes from
// the run's own seeded generator, stored in the run, so a run replays from its seed (R-R1).
import type { FactionId, Seat, Setup } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def } from '../engine/query';
import { autoDeck, collectible } from '../data/decks';
import type { Difficulty } from '../ai/ai';
import { EVENTS, cardFor, eventCrystal } from './events';

export type NodeKind = 'skirmish' | 'elite' | 'rest' | 'supply' | 'event' | 'boss';
export interface MapNode { id: string; floor: number; kind: NodeKind; links: string[] }
export interface ActMap { act: number; floors: MapNode[][] }

export interface Offer { cards: string[]; scrip: number }
export interface Shop { cards: { id: string; price: number; sold: boolean }[]; repairSold: boolean }
export interface Battle { setup: Setup; foeName: string; level: Difficulty; kind: NodeKind }

export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'supply' | 'event' | 'eventRemove' | 'won' | 'lost';

export interface RunState {
  v: 1;
  seed: number;
  rng: number;
  faction: FactionId;
  deck: string[];
  crystal: number;
  scrip: number;
  act: number;
  map: ActMap;
  /** Node the player stands on (null at the start of an act). */
  at: string | null;
  phase: RunPhase;
  battle: Battle | null;
  offer: Offer | null;
  shop: Shop | null;
  /** The event at this stop (R-R11), and what its last choice gave. */
  event?: { id: string; result: string[] } | null;
  /** Battles won, for the end screen. */
  wins: number;
  log: string[];
}

export const ACTS = 3;
export const FLOORS = 7;
export const ACT_NAMES = ['THRUMHOLLOW', 'THE RIMEGLASS FLATS', 'VASKOR'];
/** Each faction's lead, the WORLD.md character (R-R2). */
export const LEADS: Record<FactionId, string> = {
  prism: 'prism-tamsin', ember: 'ember-crucible', tide: 'tide-maren', coil: 'coil-aruvi', storm: 'storm-jax', under: 'under-penn',
};
/** The faction that rules each act's boss fight, with fallbacks when it is the player's own (R-R6). */
const BOSS_FACTIONS: FactionId[][] = [['storm', 'coil', 'under'], ['tide', 'ember', 'coil'], ['prism', 'under', 'ember']];
const ALL: FactionId[] = ['prism', 'ember', 'tide', 'coil', 'storm', 'under'];

/** R-R6 table: [deck size, foe Crystal, AI level] by act (0-2) and kind. */
const FOES: Record<'skirmish' | 'elite' | 'boss', [number, number, Difficulty][]> = {
  skirmish: [[20, 10, 'easy'], [24, 14, 'normal'], [28, 18, 'normal']],
  elite: [[24, 14, 'normal'], [28, 18, 'normal'], [30, 20, 'hard']],
  boss: [[26, 16, 'normal'], [30, 20, 'hard'], [34, 20, 'hard']],
};
const SCRIP: Record<'skirmish' | 'elite' | 'boss', number> = { skirmish: 10, elite: 25, boss: 50 };
export const REST_REPAIR = 6;
/** R-R5 field repairs after every won battle (BALANCE R-2). */
export const FIELD_REPAIR = 3;
export const SUPPLY_REPAIR = 5;
export const SUPPLY_REPAIR_PRICE = 20;
export const MIN_DECK = 10;

// ---------- random ----------
function next(r: RunState): number {
  r.rng = (r.rng + 0x6d2b79f5) >>> 0;
  let t = r.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (r: RunState, n: number): number => Math.floor(next(r) * n);
function pick<T>(r: RunState, list: T[]): T {
  if (list.length === 0) throw new Error('run: pick from an empty list');
  return list[int(r, list.length)];
}
function shuffled<T>(r: RunState, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(r, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- decks ----------
const byCost = (a: string, b: string) => def(a).cost - def(b).cost || a.localeCompare(b);

/** Cards per Charge cost in the starter (R-R2, BALANCE R-1): 3 at 1, 3 at 2, 3 at 3, 2 at 4, two copies each. */
const STARTER_CURVE: [number, number][] = [[1, 3], [2, 3], [3, 3], [4, 2]];
export const STARTER_SIZE = 24;

/** R-R2: two copies of the lead, then along the curve the units with the most power plus health, two each. */
export function starterDeck(f: FactionId): string[] {
  const lead = LEADS[f];
  const deck = [lead, lead];
  const units = collectible().filter((c) => c.faction === f && c.type === 'unit');
  for (const [cost, n] of STARTER_CURVE) {
    const best = units.filter((c) => c.cost === cost)
      .sort((a, b) => (b.power ?? 0) + (b.health ?? 0) - ((a.power ?? 0) + (a.health ?? 0)) || a.id.localeCompare(b.id))
      .slice(0, n);
    for (const c of best) deck.push(c.id, c.id);
  }
  // a faction short of units at some cost fills up with its cheapest remaining cards (still deterministic)
  const rest = collectible().filter((c) => c.faction === f && c.type !== 'hero' && !deck.includes(c.id)).map((c) => c.id).sort(byCost);
  for (const id of rest) {
    if (deck.length >= STARTER_SIZE) break;
    deck.push(id, id);
  }
  return deck.slice(0, STARTER_SIZE);
}

/** R-R6: a random sample of a curve-built deck from the given factions. Bosses keep every hero copy; patrols and
 *  elites keep one hero, two copies (BALANCE R-1). */
function foeDeck(r: RunState, a: FactionId, b: FactionId, size: number, boss: boolean): string[] {
  const full = autoDeck(a, b);
  const allHeroes = full.filter((id) => def(id).type === 'hero');
  const one = allHeroes[0];
  const heroes = boss ? allHeroes : one ? [one, one] : [];
  const rest = shuffled(r, full.filter((id) => def(id).type !== 'hero'));
  return [...heroes, ...rest].slice(0, size);
}

// ---------- map ----------
/** R-R3/R-R4: floors 1-6 of 2-4 nodes, every node reachable, floor 7 the boss. */
export function makeMap(r: RunState, act: number): ActMap {
  const floors: MapNode[][] = [];
  for (let f = 1; f < FLOORS; f++) {
    const n = 2 + int(r, 3);
    const row: MapNode[] = [];
    for (let i = 0; i < n; i++) {
      let kind: NodeKind = 'skirmish';
      if (f > 1) {
        const x = next(r);
        kind = x < 0.42 ? 'skirmish' : x < 0.56 && f > 2 ? 'elite' : x < 0.7 ? 'rest' : x < 0.84 ? 'supply' : 'event';
      }
      row.push({ id: `a${act}f${f}n${i}`, floor: f, kind, links: [] });
    }
    if (f === FLOORS - 1 && !row.some((x) => x.kind === 'rest')) row[int(r, row.length)].kind = 'rest';
    floors.push(row);
  }
  floors.push([{ id: `a${act}f${FLOORS}n0`, floor: FLOORS, kind: 'boss', links: [] }]);
  for (let f = 0; f < floors.length - 1; f++) {
    const cur = floors[f], nxt = floors[f + 1];
    cur.forEach((node, i) => {
      // the node "below" in proportion, and sometimes one beside it
      const j = Math.min(nxt.length - 1, Math.round((i * (nxt.length - 1)) / Math.max(1, cur.length - 1)));
      node.links = [nxt[j].id];
      const k = j + (next(r) < 0.5 ? -1 : 1);
      if (k >= 0 && k < nxt.length && next(r) < 0.6) node.links.push(nxt[k].id);
    });
    // every next-floor node has a way in
    for (const target of nxt) {
      if (!cur.some((c) => c.links.includes(target.id))) {
        const nearest = cur[Math.min(cur.length - 1, Math.round((nxt.indexOf(target) * (cur.length - 1)) / Math.max(1, nxt.length - 1)))];
        nearest.links.push(target.id);
      }
    }
  }
  return { act, floors };
}

export function node(r: RunState, id: string): MapNode {
  for (const row of r.map.floors) for (const n of row) if (n.id === id) return n;
  throw new Error(`run: no node ${id}`);
}

/** Nodes the player may move to now (R-R3). */
export function choices(r: RunState): MapNode[] {
  if (r.phase !== 'map') return [];
  if (r.at === null) return r.map.floors[0];
  const here = node(r, r.at);
  return here.links.map((id) => node(r, id));
}

// ---------- run ----------
export function newRun(faction: FactionId, seed: number): RunState {
  const r: RunState = {
    v: 1, seed, rng: seed >>> 0 || 1, faction, deck: starterDeck(faction), crystal: LIMITS.spire, scrip: 0, act: 1,
    map: { act: 1, floors: [] }, at: null, phase: 'map', battle: null, offer: null, shop: null, wins: 0, log: [],
  };
  r.map = makeMap(r, 1);
  r.log.push(`The march begins in ${ACT_NAMES[0]}.`);
  return r;
}

function foeFor(r: RunState, kind: 'skirmish' | 'elite' | 'boss'): Battle {
  const act = r.act - 1;
  const [size, foeCrystal, level] = FOES[kind][act];
  let a: FactionId, b: FactionId;
  if (kind === 'boss') {
    a = BOSS_FACTIONS[act].find((f) => f !== r.faction)!;
    b = a;
  } else {
    const others = ALL.filter((f) => f !== r.faction);
    a = pick(r, others);
    b = next(r) < 0.5 ? a : pick(r, others);
  }
  const deck = foeDeck(r, a, b, size, kind === 'boss');
  const seed = int(r, 0x7fffffff);
  const setup: Setup = { seed, decks: [[...r.deck], deck], startSpire: [r.crystal, foeCrystal] };
  const names = [...new Set([a, b])].map((f) => FACTION_NAMES[f]);
  const foeName = kind === 'boss' ? `${FACTION_NAMES[a]} warlord` : `${names.join(' and ')} ${kind === 'elite' ? 'elite' : 'patrol'}`;
  return { setup, foeName, level, kind };
}

export const FACTION_NAMES: Record<FactionId, string> = {
  prism: 'Dominion', ember: 'Ashen Choir', tide: 'Gale Exchange', coil: 'Sedgekin', storm: 'Free Gauge', under: 'Blackwick',
};

/** Move to a node and start what it holds (R-R4). */
export function enter(r: RunState, id: string): void {
  if (!choices(r).some((n) => n.id === id)) throw new Error(`run: ${id} is not reachable from here`);
  r.at = id;
  const n = node(r, id);
  if (n.kind === 'skirmish' || n.kind === 'elite' || n.kind === 'boss') {
    r.battle = foeFor(r, n.kind);
    r.phase = 'battle';
    r.log.push(`Floor ${n.floor}: battle with a ${r.battle.foeName}.`);
  } else if (n.kind === 'rest') {
    r.phase = 'rest';
    r.log.push(`Floor ${n.floor}: a rest stop.`);
  } else if (n.kind === 'event') {
    const ev = EVENTS[int(r, EVENTS.length)];
    r.event = { id: ev.id, result: [] };
    r.phase = 'event';
    r.log.push(`Floor ${n.floor}: ${ev.title.toLowerCase()}.`);
  } else {
    r.shop = makeShop(r);
    r.phase = 'supply';
    r.log.push(`Floor ${n.floor}: a supply depot.`);
  }
}

function rewardPool(faction: FactionId | null, minCost: number): string[] {
  return collectible().filter((c) => c.type !== 'hero' && (faction === null || c.faction === faction) && c.cost >= minCost).map((c) => c.id);
}

/** R-R5/R-R7: the battle is over; write the Crystal back and offer the reward. */
export function finishBattle(r: RunState, winner: Seat | 'draw' | null, myCrystal: number): void {
  if (r.phase !== 'battle' || !r.battle) throw new Error('run: no battle to finish');
  const kind = r.battle.kind as 'skirmish' | 'elite' | 'boss';
  r.crystal = Math.max(0, Math.min(LIMITS.spire, myCrystal));
  r.battle = null;
  if (winner !== 0 || r.crystal <= 0) {
    // RULING: a draw is not a win; the run ends as a defeat.
    r.phase = 'lost';
    r.log.push(winner === 'draw' ? 'The battle ended in a draw: the march is over.' : 'The Crystal fell: the march is over.');
    return;
  }
  r.wins += 1;
  r.crystal = Math.min(LIMITS.spire, r.crystal + FIELD_REPAIR);
  if (kind === 'boss' && r.act === ACTS) {
    r.phase = 'won';
    r.log.push('Vaskor has fallen silent. The march is won.');
    return;
  }
  const min = kind === 'skirmish' ? 0 : 3;
  const mine = shuffled(r, rewardPool(r.faction, min)).slice(0, 2);
  const any = shuffled(r, rewardPool(null, min).filter((id) => !mine.includes(id)));
  r.offer = { cards: [...mine, any[0]], scrip: SCRIP[kind] };
  r.scrip += SCRIP[kind];
  r.phase = 'reward';
}

/** Take one offered card, or none (R-R7). After a boss, the next act begins. */
export function takeReward(r: RunState, card: string | null): void {
  if (r.phase !== 'reward' || !r.offer) throw new Error('run: no reward to take');
  if (card !== null) {
    if (!r.offer.cards.includes(card)) throw new Error(`run: ${card} was not offered`);
    r.deck.push(card);
    r.log.push(`Took ${def(card).name}.`);
  } else r.log.push('Took no card.');
  r.offer = null;
  afterNode(r);
}

function afterNode(r: RunState): void {
  const here = r.at ? node(r, r.at) : null;
  if (here?.kind === 'boss') {
    r.act += 1;
    r.map = makeMap(r, r.act);
    r.at = null;
    r.log.push(`Act ${r.act}: ${ACT_NAMES[r.act - 1]}.`);
  }
  r.phase = 'map';
}

/** R-R4 Rest: repair, or remove one card (the deck never drops below MIN_DECK). */
export function rest(r: RunState, choice: { kind: 'repair' } | { kind: 'remove'; card: string }): void {
  if (r.phase !== 'rest') throw new Error('run: not at a rest stop');
  if (choice.kind === 'repair') {
    const before = r.crystal;
    r.crystal = Math.min(LIMITS.spire, r.crystal + REST_REPAIR);
    r.log.push(`Repaired the Crystal by ${r.crystal - before}.`);
  } else {
    // RULING: removal is refused below MIN_DECK cards, so a run can never draw out on its first rounds.
    if (r.deck.length <= MIN_DECK) throw new Error(`run: the deck cannot go below ${MIN_DECK} cards`);
    const i = r.deck.indexOf(choice.card);
    if (i < 0) throw new Error(`run: ${choice.card} is not in the deck`);
    r.deck.splice(i, 1);
    r.log.push(`Removed ${def(choice.card).name}.`);
  }
  afterNode(r);
}

function makeShop(r: RunState): Shop {
  const mine = shuffled(r, collectible().filter((c) => c.faction === r.faction).map((c) => c.id)).slice(0, 2);
  const any = shuffled(r, collectible().map((c) => c.id).filter((id) => !mine.includes(id))).slice(0, 2);
  return { cards: [...mine, ...any].map((id) => ({ id, price: def(id).type === 'hero' ? 30 : 15, sold: false })), repairSold: false };
}

/** R-R8 Supply: buy a card or the repair. Refused (with a reason) when scrip is short or it is sold. */
export function buy(r: RunState, what: string): string | null {
  if (r.phase !== 'supply' || !r.shop) throw new Error('run: not at a supply depot');
  if (what === 'repair') {
    if (r.shop.repairSold) return 'The repair is already used.';
    if (r.scrip < SUPPLY_REPAIR_PRICE) return `Needs ${SUPPLY_REPAIR_PRICE} scrip.`;
    r.scrip -= SUPPLY_REPAIR_PRICE;
    r.crystal = Math.min(LIMITS.spire, r.crystal + SUPPLY_REPAIR);
    r.shop.repairSold = true;
    return null;
  }
  const item = r.shop.cards.find((c) => c.id === what && !c.sold);
  if (!item) return 'That card is not for sale.';
  if (r.scrip < item.price) return `Needs ${item.price} scrip.`;
  r.scrip -= item.price;
  item.sold = true;
  r.deck.push(item.id);
  r.log.push(`Bought ${def(item.id).name}.`);
  return null;
}

/** R-R11: take one of the event's choices. Returns why it was refused, or null. A "remove" outcome waits for the
 *  player to pick the card (phase eventRemove); the deck never drops below MIN_DECK, so that outcome is skipped then. */
export function chooseEvent(r: RunState, index: number): string | null {
  if (r.phase !== 'event' || !r.event) throw new Error('run: no event here');
  const ev = EVENTS.find((e) => e.id === r.event!.id);
  if (!ev) throw new Error(`run: unknown event ${r.event.id}`);
  const ch = ev.choices[index];
  if (!ch) throw new Error(`run: event ${ev.id} has no choice ${index}`);
  if (ch.costScrip && r.scrip < ch.costScrip) return `Needs ${ch.costScrip} scrip.`;
  if (ch.costScrip) r.scrip -= ch.costScrip;
  const result: string[] = [];
  let remove = false;
  for (const o of ch.outcomes) {
    if (o.kind === 'scrip') { r.scrip += o.n; result.push(`+${o.n} scrip`); }
    else if (o.kind === 'crystal') {
      const before = r.crystal;
      r.crystal = eventCrystal(r.crystal, o.n);
      result.push(`Crystal ${r.crystal - before >= 0 ? '+' : ''}${r.crystal - before}`);
    } else if (o.kind === 'card') {
      const id = cardFor(o.pool, r.faction, o.minCost ?? 0, next(r));
      r.deck.push(id);
      result.push(`gained ${def(id).name}`);
    } else if (o.kind === 'remove') {
      if (r.deck.length > MIN_DECK) remove = true;
      else result.push(`no card removed (the deck is at ${MIN_DECK})`);
    }
  }
  r.event.result = result;
  r.log.push(`${ev.title.charAt(0)}${ev.title.slice(1).toLowerCase()}: ${result.join(', ') || 'nothing happened'}.`);
  if (remove) r.phase = 'eventRemove';
  else { r.event = null; afterNode(r); }
  return null;
}

export function removeForEvent(r: RunState, card: string): void {
  if (r.phase !== 'eventRemove') throw new Error('run: no card to remove');
  const i = r.deck.indexOf(card);
  if (i < 0) throw new Error(`run: ${card} is not in the deck`);
  r.deck.splice(i, 1);
  r.log.push(`Left ${def(card).name} behind.`);
  r.event = null;
  afterNode(r);
}

export function leaveSupply(r: RunState): void {
  if (r.phase !== 'supply') throw new Error('run: not at a supply depot');
  r.shop = null;
  afterNode(r);
}
