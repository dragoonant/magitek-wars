// The hero campaign (docs/spec/20-roguelike.md, PLAN D32). Pure data and rules: no DOM, no storage. Everything random
// comes from the run's own seeded generator, stored in the run, so a run replays from its seed (R-R1).
import type { FactionId, Fitting, Order, Seat, Setup } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def } from '../engine/query';
import { autoDeck, collectible } from '../data/decks';
import type { Difficulty } from '../ai/ai';
import { EVENTS, cardFor, eventCrystal } from './events';
import { HEROES, RANK_FIELD, RANK_REST, RANK_SCRIP, XP, hero, starterList } from './heroes';
import { ORDERS, OFFERABLE, order, type RunOrder } from './orders';
import { OFFERABLE_FITTINGS, canFit, engineFitting, fitting } from './fittings';
import { expedition, stopOf, type Expedition, type Foe, type Stop, type StopKind } from './expeditions';

export type BattleKind = 'battle' | 'elite' | 'boss';
export interface Battle { setup: Setup; foeName: string; level: Difficulty; kind: BattleKind; orders: string[]; faction: FactionId }
export interface Offer { bundles: string[][]; scrip: number; xp: number }
export interface Shop {
  cards: { id: string; price: number; sold: boolean }[];
  fitting: { id: string; price: number; sold: boolean };
  order: { id: string; price: number; sold: boolean } | null;
  repairSold: boolean;
}
export type PickKind = 'order' | 'fitting' | 'recruit';
export interface Pick { kind: PickKind; options: string[] }

export type RunPhase = 'map' | 'battle' | 'reward' | 'pick' | 'fit' | 'rest' | 'depot' | 'event' | 'eventRemove' | 'won' | 'lost';

export interface RunState {
  v: 2;
  seed: number;
  rng: number;
  /** The lead hero's card id (R-R1). */
  hero: string;
  faction: FactionId;
  expedition: string;
  /** The lead's rank when the run began: its unlocks apply to the whole run (R-R13). */
  rank: number;
  deck: string[];
  crystal: number;
  scrip: number;
  /** Order ids, in the order gained (R-R7). */
  orders: string[];
  /** Card id -> Fitting id (R-R8). */
  fittings: Record<string, string>;
  /** Heroes who joined at Recruit stops (R-R9). */
  recruits: string[];
  /** Stop the player stands on (null before the first). */
  at: string | null;
  visited: string[];
  phase: RunPhase;
  battle: Battle | null;
  offer: Offer | null;
  shop: Shop | null;
  pick: Pick | null;
  /** A Fitting waiting for its card, and where to go after (R-R8). */
  fitWith: { id: string; back: 'map' | 'depot' } | null;
  event?: { id: string; result: string[] } | null;
  /** Rank XP earned this run, and how much of it the profile already holds (R-R13). */
  xp: number;
  xpBanked: number;
  wins: number;
  log: string[];
}

export const MIN_DECK = 12;
export const REST_REPAIR = 6;
/** R-R5 field repairs after every won battle (BALANCE R-2). */
export const FIELD_REPAIR = 3;
export const DEPOT = { card: 15, hero: 30, fitting: 25, order: 40, repair: 5, repairPrice: 20 } as const;
const SCRIP: Record<BattleKind, number> = { battle: 10, elite: 25, boss: 50 };

export const FACTION_NAMES: Record<FactionId, string> = {
  prism: 'Dominion', ember: 'Ashen Choir', tide: 'Gale Exchange', coil: 'Sedgekin', storm: 'Free Gauge', under: 'Blackwick',
};

// ---------- random ----------
function next(r: RunState): number {
  r.rng = (r.rng + 0x6d2b79f5) >>> 0;
  let t = r.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (r: RunState, n: number): number => Math.floor(next(r) * n);
function shuffled<T>(rand: () => number, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const rr = (r: RunState) => () => next(r);

/** A generator fixed by a name, so a stop's foe deck is the same every time (R-R6). */
function fixedRandom(name: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  let a = h || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the run's numbers ----------
const runOrders = (r: RunState): RunOrder[] => r.orders.map(order);
export function fieldRepair(r: RunState): number {
  return FIELD_REPAIR + (r.rank >= 7 ? RANK_FIELD : 0) + runOrders(r).reduce((n, o) => n + (o.run?.fieldRepair ?? 0), 0);
}
export function restRepair(r: RunState): number {
  return REST_REPAIR + (r.rank >= 4 ? RANK_REST : 0);
}
export function battleScrip(r: RunState, kind: BattleKind): number {
  return SCRIP[kind] + runOrders(r).reduce((n, o) => n + (o.run?.battleScrip ?? 0), 0);
}
/** Every hero in the run: the lead, then recruits. */
export const runHeroes = (r: RunState): string[] => [r.hero, ...r.recruits];
/** The factions the faction bundle draws from (R-R12). */
export const runFactions = (r: RunState): FactionId[] => [...new Set(runHeroes(r).map((h) => hero(h).faction))];

// ---------- start (R-R1, R-R2, R-R13) ----------
export function newRun(heroId: string, expeditionId: string, seed: number, rank = 1): RunState {
  const h = hero(heroId);
  expedition(expeditionId);
  const r: RunState = {
    v: 2, seed, rng: seed >>> 0 || 1, hero: h.id, faction: h.faction, expedition: expeditionId, rank,
    deck: starterList(h), crystal: LIMITS.spire, scrip: 0, orders: [], fittings: {}, recruits: [],
    at: null, visited: [], phase: 'map', battle: null, offer: null, shop: null, pick: null, fitWith: null, event: null,
    xp: 0, xpBanked: 0, wins: 0, log: [],
  };
  if (rank >= 2) r.scrip += RANK_SCRIP;
  if (rank >= 3) r.orders.push(h.signatureOrder);
  if (rank >= 5) r.fittings[h.id] = h.signatureFitting;
  if (rank >= 6) {
    const commons = ORDERS.filter((o) => o.rarity === 'common' && !r.orders.includes(o.id));
    r.orders.push(commons[int(r, commons.length)].id);
  }
  if (rank >= 8) r.orders.push(h.masteryOrder);
  r.log.push(`${def(h.id).name} sets out on ${expedition(expeditionId).name}.`);
  return r;
}

export const exp = (r: RunState): Expedition => expedition(r.expedition);
export const stop = (r: RunState, id: string): Stop => stopOf(exp(r), id);

/** Stops the player may move to now (R-R3). */
export function choices(r: RunState): Stop[] {
  if (r.phase !== 'map') return [];
  if (r.at === null) return exp(r).stops.filter((s) => s.row === 0);
  return stop(r, r.at).to.map((id) => stop(r, id));
}

// ---------- foes (R-R6) ----------
export function foeFaction(r: RunState, foe: Foe, kind: StopKind): [FactionId, FactionId] {
  const [a, b] = [foe.factions[0], foe.factions[1] ?? foe.factions[0]];
  if (kind === 'boss' && a === r.faction) {
    if (!foe.alt) throw new Error(`run: boss ${foe.name} needs an alt faction`);
    return [foe.alt, foe.alt];
  }
  return [a, b];
}

export function foeDeck(r: RunState, s: Stop): string[] {
  const foe = s.foe!;
  const [a, b] = foeFaction(r, foe, s.kind);
  const full = autoDeck(a, b);
  const heroes = full.filter((id) => def(id).type === 'hero');
  const keep = s.kind === 'boss' ? heroes : heroes.length ? [heroes[0], heroes[0]] : [];
  const rest = shuffled(fixedRandom(`${r.expedition}:${s.id}:${a}:${b}`), full.filter((id) => def(id).type !== 'hero'));
  return [...keep, ...rest].slice(0, foe.size);
}

/** The boss is named for the faction it fields (R-R6): its alt faction brings that faction's leader. */
export function foeName(r: RunState, s: Stop): string {
  return s.kind === 'boss' ? bossName(r.faction, s.foe!) : s.foe!.name;
}

/** The boss a hero of this faction meets (R-R6): the alt faction's leader when the boss would be the hero's own. */
export function bossName(heroFaction: FactionId, foe: Foe): string {
  return foe.factions[0] === heroFaction && foe.alt ? BOSS_NAMES[foe.alt] : foe.name;
}
const BOSS_NAMES: Record<FactionId, string> = {
  storm: 'Foreman Otto Brandt', coil: 'Speaker Ulla of the Ninth Root', under: 'Mother Agna Vell', tide: 'Captain Dasha Quill',
  ember: 'Cantor Ebbe', prism: 'Marshal Ilse Corrow',
};

const engineOrder = (o: RunOrder): Order => ({
  id: o.id, name: o.name, text: o.text,
  ...(o.auras ? { auras: o.auras } : {}), ...(o.costAuras ? { costAuras: o.costAuras } : {}), ...(o.abilities ? { abilities: o.abilities } : {}),
});

/** The run's Fittings as the engine reads them (R-X5): only cards still in the deck. */
export function deckFittings(r: RunState): Record<string, Fitting> {
  const out: Record<string, Fitting> = {};
  for (const [card, fit] of Object.entries(r.fittings)) if (r.deck.includes(card)) out[card] = engineFitting(fit);
  return out;
}

/** The engine setup for a stop's battle: both decks, both Crystals, both sides' gear (R-X3 to R-X6). */
function battleFor(r: RunState, s: Stop): Battle {
  const foe = s.foe!;
  const deck = foeDeck(r, s);
  const fits = deckFittings(r);
  const early = runHeroes(r).filter((h) => r.deck.includes(h));
  const setup: Setup = {
    seed: int(r, 0x7fffffff), decks: [[...r.deck], deck], startSpire: [r.crystal, foe.crystal],
    gear: [
      { early, fittings: fits, orders: runOrders(r).filter((o) => o.auras || o.costAuras || o.abilities).map(engineOrder) },
      { orders: (foe.orders ?? []).map((id) => engineOrder(order(id))) },
    ],
  };
  return { setup, foeName: foeName(r, s), level: foe.level, kind: s.kind as BattleKind, orders: foe.orders ?? [], faction: foeFaction(r, foe, s.kind)[0] };
}

// ---------- moving (R-R3, R-R4) ----------
export function enter(r: RunState, id: string): void {
  if (!choices(r).some((s) => s.id === id)) throw new Error(`run: ${id} is not reachable from here`);
  r.at = id;
  r.visited.push(id);
  const s = stop(r, id);
  const row = `Stop ${s.row + 1}`;
  if (s.kind === 'battle' || s.kind === 'elite' || s.kind === 'boss') {
    r.battle = battleFor(r, s);
    r.phase = 'battle';
    r.log.push(`${row}: battle with ${r.battle.foeName}.`);
  } else if (s.kind === 'rest') {
    r.phase = 'rest';
    r.log.push(`${row}: a rest stop.`);
  } else if (s.kind === 'event') {
    const ev = EVENTS[int(r, EVENTS.length)];
    r.event = { id: ev.id, result: [] };
    r.phase = 'event';
    r.log.push(`${row}: ${ev.title.toLowerCase()}.`);
  } else if (s.kind === 'depot') {
    r.shop = makeShop(r);
    r.phase = 'depot';
    r.log.push(`${row}: a supply depot.`);
  } else if (s.kind === 'order') {
    r.pick = { kind: 'order', options: orderChoices(r, 3) };
    r.phase = 'pick';
    r.log.push(`${row}: a command post.`);
  } else if (s.kind === 'cache') {
    r.pick = { kind: 'fitting', options: fittingChoices(r, 3) };
    r.phase = 'pick';
    r.log.push(`${row}: a parts cache.`);
  } else {
    const open = HEROES.map((h) => h.id).filter((h) => !runHeroes(r).includes(h));
    r.pick = { kind: 'recruit', options: shuffled(rr(r), open).slice(0, 2) };
    r.phase = 'pick';
    r.log.push(`${row}: a recruiting post.`);
  }
}

function afterStop(r: RunState): void {
  r.phase = 'map';
}

// ---------- battles and rewards (R-R5, R-R12, R-R13) ----------
function cardPool(factions: FactionId[] | null, minCost: number, ids?: string[]): string[] {
  const all = ids ? ids.map(def) : collectible();
  return all.filter((c) => c.type !== 'hero' && !c.token && (factions === null || factions.includes(c.faction)) && c.cost >= minCost).map((c) => c.id);
}
function bundle(r: RunState, pool: string[], fallback: string[], n: number, avoid: Set<string>): string[] {
  const fresh = (list: string[]) => shuffled(rr(r), list.filter((id) => !avoid.has(id)));
  const out = fresh(pool).slice(0, n);
  for (const id of fresh(fallback)) if (out.length < n && !out.includes(id)) out.push(id);
  for (const id of out) avoid.add(id);
  return out;
}

export function finishBattle(r: RunState, winner: Seat | 'draw' | null, myCrystal: number): void {
  if (r.phase !== 'battle' || !r.battle) throw new Error('run: no battle to finish');
  const kind = r.battle.kind;
  r.crystal = Math.max(0, Math.min(LIMITS.spire, myCrystal));
  r.battle = null;
  if (winner !== 0 || r.crystal <= 0) {
    r.phase = 'lost';
    r.log.push(winner === 'draw' ? 'The battle ended in a draw: the expedition is over.' : 'The Crystal fell: the expedition is over.');
    return;
  }
  r.wins += 1;
  const xp = XP[kind];
  r.xp += xp;
  r.crystal = Math.min(LIMITS.spire, r.crystal + fieldRepair(r));
  if (kind === 'boss') {
    const bonus = XP.perStar * exp(r).stars;
    r.xp += bonus;
    r.phase = 'won';
    r.log.push(`${exp(r).name} is won. ${def(r.hero).name} earns ${xp + bonus} rank XP for the final battle.`);
    return;
  }
  const n = kind === 'battle' ? 2 : 3;
  const min = kind === 'battle' ? 0 : 3;
  const avoid = new Set<string>();
  const h = hero(r.hero);
  const bundles = [
    bundle(r, cardPool(null, min, h.pool), cardPool(null, 0, h.pool), n, avoid),
    bundle(r, cardPool(runFactions(r), min), cardPool(runFactions(r), 0), n, avoid),
    bundle(r, cardPool(null, min), cardPool(null, 0), n, avoid),
  ];
  const scrip = battleScrip(r, kind);
  r.scrip += scrip;
  r.offer = { bundles, scrip, xp };
  r.phase = 'reward';
}

/** Take one bundle by index, or none (R-R12). After an elite, a Fitting pick follows (R-R8). */
export function takeReward(r: RunState, index: number | null): void {
  if (r.phase !== 'reward' || !r.offer) throw new Error('run: no reward to take');
  if (index !== null) {
    const b = r.offer.bundles[index];
    if (!b) throw new Error(`run: no bundle ${index}`);
    r.deck.push(...b);
    r.log.push(`Took ${b.map((id) => def(id).name).join(' and ')}.`);
  } else r.log.push('Took no cards.');
  r.offer = null;
  const here = r.at ? stop(r, r.at) : null;
  if (here?.kind === 'elite') {
    r.pick = { kind: 'fitting', options: fittingChoices(r, 3) };
    r.phase = 'pick';
  } else afterStop(r);
}

// ---------- Orders, Fittings, Recruits (R-R7 to R-R9) ----------
function orderChoices(r: RunState, n: number): string[] {
  return shuffled(rr(r), OFFERABLE.filter((id) => !r.orders.includes(id))).slice(0, n);
}
function fittingChoices(r: RunState, n: number): string[] {
  return shuffled(rr(r), [...OFFERABLE_FITTINGS]).slice(0, n);
}

/** Cards in the deck a Fitting can go on (R-R8). */
export function fitTargets(r: RunState, fitId: string): string[] {
  return [...new Set(r.deck)].filter((id) => canFit(fitId, id));
}

/** Take one of the offered options, or none. A Fitting then waits for its card (phase 'fit'). */
export function choosePick(r: RunState, option: string | null): void {
  if (r.phase !== 'pick' || !r.pick) throw new Error('run: nothing to pick');
  const p = r.pick;
  if (option !== null && !p.options.includes(option)) throw new Error(`run: ${option} was not offered`);
  r.pick = null;
  if (option === null) {
    r.log.push(p.kind === 'recruit' ? 'Nobody joined.' : `Took no ${p.kind === 'order' ? 'Order' : 'Fitting'}.`);
    afterStop(r);
    return;
  }
  if (p.kind === 'order') {
    r.orders.push(option);
    r.log.push(`New Order: ${order(option).name}.`);
    afterStop(r);
  } else if (p.kind === 'fitting') {
    r.fitWith = { id: option, back: 'map' };
    r.phase = 'fit';
  } else {
    const h = hero(option);
    const support = Object.keys(h.starter).filter((id) => id !== h.id).slice(0, 2);
    r.recruits.push(h.id);
    r.deck.push(h.id, h.id, ...support.flatMap((id) => [id, id]));
    r.log.push(`${def(h.id).name} joins the expedition.`);
    afterStop(r);
  }
}

/** Fit the waiting Fitting on a card (all copies), or give it up. A card's old Fitting is replaced (R-R8). */
export function fit(r: RunState, card: string | null): void {
  if (r.phase !== 'fit' || !r.fitWith) throw new Error('run: no Fitting waiting');
  const { id, back } = r.fitWith;
  if (card !== null) {
    if (!r.deck.includes(card)) throw new Error(`run: ${card} is not in the deck`);
    if (!canFit(id, card)) throw new Error(`run: ${fitting(id).name} cannot go on ${card}`);
    r.fittings[card] = id;
    r.log.push(`Fitted ${def(card).name} with ${fitting(id).name}.`);
  } else r.log.push(`Left ${fitting(id).name} behind.`);
  r.fitWith = null;
  r.phase = back === 'depot' ? 'depot' : 'map';
}

// ---------- rest, depot, events ----------
/** RULING: the lead hero cannot be removed from its own expedition. */
function whyNotRemove(r: RunState, card: string): string | null {
  if (r.deck.length <= MIN_DECK) return `The deck cannot go below ${MIN_DECK} cards.`;
  if (card === r.hero) return 'Your lead hero stays with the expedition.';
  if (!r.deck.includes(card)) return 'That card is not in the deck.';
  return null;
}
export const canRemove = (r: RunState, card: string): boolean => whyNotRemove(r, card) === null;

function removeCard(r: RunState, card: string): void {
  const why = whyNotRemove(r, card);
  if (why) throw new Error(`run: ${why}`);
  r.deck.splice(r.deck.indexOf(card), 1);
  if (!r.deck.includes(card)) delete r.fittings[card];
}

/** R-R4 Rest: repair, or remove one card. */
export function rest(r: RunState, choice: { kind: 'repair' } | { kind: 'remove'; card: string }): void {
  if (r.phase !== 'rest') throw new Error('run: not at a rest stop');
  if (choice.kind === 'repair') {
    const before = r.crystal;
    r.crystal = Math.min(LIMITS.spire, r.crystal + restRepair(r));
    r.log.push(`Repaired the Crystal by ${r.crystal - before}.`);
  } else {
    removeCard(r, choice.card);
    r.log.push(`Removed ${def(choice.card).name}.`);
  }
  afterStop(r);
}

function makeShop(r: RunState): Shop {
  const mine = shuffled(rr(r), cardPool(runFactions(r), 0)).slice(0, 2);
  const any = shuffled(rr(r), collectible().filter((c) => !c.token && !mine.includes(c.id)).map((c) => c.id)).slice(0, 1);
  const cards = [...mine, ...any].map((id) => ({ id, price: def(id).type === 'hero' ? DEPOT.hero : DEPOT.card, sold: false }));
  const ord = orderChoices(r, 1)[0];
  return {
    cards, fitting: { id: fittingChoices(r, 1)[0], price: DEPOT.fitting, sold: false },
    order: ord ? { id: ord, price: DEPOT.order, sold: false } : null, repairSold: false,
  };
}

/** R-R10: buy 'card:<id>', 'fitting', 'order' or 'repair'. Returns why it was refused, or null. */
export function buy(r: RunState, what: string): string | null {
  if (r.phase !== 'depot' || !r.shop) throw new Error('run: not at a supply depot');
  const sh = r.shop;
  const pay = (price: number): string | null => (r.scrip < price ? `Needs ${price} scrip.` : null);
  if (what === 'repair') {
    if (sh.repairSold) return 'The repair is already used.';
    const why = pay(DEPOT.repairPrice);
    if (why) return why;
    r.scrip -= DEPOT.repairPrice;
    r.crystal = Math.min(LIMITS.spire, r.crystal + DEPOT.repair);
    sh.repairSold = true;
    r.log.push(`Bought a repair.`);
    return null;
  }
  if (what === 'order') {
    if (!sh.order || sh.order.sold) return 'That Order is not for sale.';
    const why = pay(sh.order.price);
    if (why) return why;
    r.scrip -= sh.order.price;
    sh.order.sold = true;
    r.orders.push(sh.order.id);
    r.log.push(`Bought the Order ${order(sh.order.id).name}.`);
    return null;
  }
  if (what === 'fitting') {
    if (sh.fitting.sold) return 'That Fitting is not for sale.';
    if (fitTargets(r, sh.fitting.id).length === 0) return 'No card in your deck can take it.';
    const why = pay(sh.fitting.price);
    if (why) return why;
    r.scrip -= sh.fitting.price;
    sh.fitting.sold = true;
    r.fitWith = { id: sh.fitting.id, back: 'depot' };
    r.phase = 'fit';
    return null;
  }
  const id = what.startsWith('card:') ? what.slice(5) : what;
  const item = sh.cards.find((c) => c.id === id && !c.sold);
  if (!item) return 'That card is not for sale.';
  const why = pay(item.price);
  if (why) return why;
  r.scrip -= item.price;
  item.sold = true;
  r.deck.push(item.id);
  r.log.push(`Bought ${def(item.id).name}.`);
  return null;
}

export function leaveDepot(r: RunState): void {
  if (r.phase !== 'depot') throw new Error('run: not at a supply depot');
  r.shop = null;
  afterStop(r);
}

/** R-R11: take one of the event's choices. Returns why it was refused, or null. */
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
  else { r.event = null; afterStop(r); }
  return null;
}

export function removeForEvent(r: RunState, card: string): void {
  if (r.phase !== 'eventRemove') throw new Error('run: no card to remove');
  removeCard(r, card);
  r.log.push(`Left ${def(card).name} behind.`);
  r.event = null;
  afterStop(r);
}
