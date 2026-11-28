// The rules engine. Pure data in, data out: applyAction never throws on a bad action and changes
// nothing when it refuses one. One door per rule: damage(), heal(), summon(), draw(), kill via
// stateCheck(), stats()/costOf() in query.ts. Rule ids refer to docs/spec/10-rules.md.
import type {
  Ability, Action, Amount, CombatPair, Fitting, GameState, Gear, LogEntry, Op, Order, OrderAbility, PlayerState, Result, Seat,
  SeenStat, Sel, Setup, StackItem, Unit, Keyword,
} from './types';
import { LIMITS, spireId } from './types';
import {
  budget, costOf, def, evalCond, face, findUnit, hasCard, legalTargets, matches, onLine, other, stats, targetSpecs,
  whyNotBlock,
} from './query';
import { nextRandom, shuffle } from './rng';

// ---------- transient run state (never saved; apply is synchronous) ----------
interface Pending {
  unit: Unit;
  ability: Ability;
  trigger?: Unit;
  targets: string[];
}
let queue: Pending[] = [];
/** Units hurt since the last state check -> iid of the unit that hurt them (or ''). */
let hurt = new Map<string, string>();

interface Ctx {
  seat: Seat;
  self?: Unit;
  trigger?: Unit;
  targets: string[];
  via: string;
}
type Hit = { unit: Unit } | { spire: Seat };

// ---------- small helpers ----------
function log(s: GameState, e: Omit<LogEntry, 'r'>): void {
  s.log.push({ ...e, r: s.round });
}
function bump(s: GameState, seat: Seat, stat: SeenStat, n = 1): void {
  const p = s.players[seat];
  p.seen[stat] = (p.seen[stat] ?? 0) + n;
  p.seenRound[stat] = (p.seenRound[stat] ?? 0) + n;
}
function bumpUnit(u: Unit, stat: SeenStat, n = 1): void {
  u.seen[stat] = (u.seen[stat] ?? 0) + n;
}
function newId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}
const over = (s: GameState): boolean => s.phase === 'over';

function finish(s: GameState, winner: Seat | 'draw', reason: string): void {
  if (over(s)) return;
  s.winner = winner;
  s.endReason = reason;
  s.phase = 'over';
  s.stack = [];
  s.combat = null;
  queue = [];
  log(s, { k: 'over', seat: winner === 'draw' ? undefined : winner, s: reason });
}

// ---------- setup ----------
function newPlayer(deck: string[], spire: number = LIMITS.spire): PlayerState {
  const heroes = [...new Set(deck.filter((id) => hasCard(id) && def(id).type === 'hero'))];
  return {
    spire, charge: 0, maxCharge: 0, reserve: 0, deck: [...deck], hand: [], line: [], scrap: [],
    seen: {}, seenRound: {}, ascended: [], heroes, canAttack: false, extraAttacks: 0, mulliganed: false,
    deckList: [...deck].sort(),
  };
}

export function createGame(setup: Setup): GameState {
  for (const d of setup.decks) for (const id of d) def(id); // unknown ids throw at load (no silent fallback)
  // R-X3: a run may start a side below 20 Integrity; anything outside 1..20 is refused, never clamped silently.
  const start = setup.startSpire ?? [LIMITS.spire, LIMITS.spire];
  for (const n of start) if (!Number.isInteger(n) || n < 1 || n > LIMITS.spire) throw new Error(`startSpire must be 1-${LIMITS.spire}, got ${n}`);
  const s: GameState = {
    v: 1, rng: setup.seed >>> 0 || 1, round: 0, initiative: 0, priority: 0, phase: 'mulligan', passes: 0,
    stack: [], stackStarter: null, combat: null, players: [newPlayer(setup.decks[0], start[0]), newPlayer(setup.decks[1], start[1])],
    nextId: 1, winner: null, endReason: null, log: [], acted: [0, 0],
  };
  if (!setup.noShuffle) for (const p of s.players) shuffle(s, p.deck);
  if (setup.gear) for (const seat of [0, 1] as Seat[]) fitGear(s, seat, setup.gear[seat]);
  // R-G3: the Initiative for round 1 is decided by the seed unless the setup names a seat.
  const first: Seat = setup.first ?? (nextRandom(s) < 0.5 ? 0 : 1);
  s.initiative = other(first); // startRound flips it
  for (const seat of [0, 1] as Seat[]) {
    for (let i = 0; i < LIMITS.openingHand; i++) {
      const c = s.players[seat].deck.pop();
      if (c) s.players[seat].hand.push({ iid: newId(s, 'h'), card: c });
    }
  }
  if (setup.skipMulligan) {
    for (const p of s.players) p.mulliganed = true;
    startRound(s);
  } else {
    s.priority = 0;
  }
  return s;
}

/** Selectors an Order ability cannot use: it has no source unit and chooses no targets (R-X6). */
const NO_ORDER_SEL = new Set(['self', 'target0', 'target1', 'trigger', 'opposing', 'others']);
function checkOrderOps(o: Order, ops: Op[]): void {
  const sel = (x: Sel): void => {
    if (typeof x === 'object') return sel(x.from);
    if (NO_ORDER_SEL.has(x)) throw new Error(`order ${o.id}: an order cannot use the selector ${x}`);
  };
  for (const op of ops) {
    if (op.op === 'negate') throw new Error(`order ${o.id}: an order cannot negate`);
    if ('to' in op) sel(op.to);
    if (op.op === 'strike') { sel(op.from); sel(op.to); }
    if (op.op === 'duel') { sel(op.a); sel(op.b); }
    if (op.op === 'if') { checkOrderOps(o, op.then); checkOrderOps(o, op.else ?? []); }
  }
}

/** R-X4 to R-X6: copy a side's campaign gear into the game, refusing anything the engine cannot run. */
function fitGear(s: GameState, seat: Seat, gear: Gear): void {
  const p = s.players[seat];
  for (const id of Object.keys(gear.fittings ?? {})) def(id);
  for (const o of gear.orders ?? []) {
    for (const a of o.auras ?? []) if (a.to !== 'allies' && a.to !== 'enemies') throw new Error(`order ${o.id}: an order aura goes to allies or enemies, not ${a.to}`);
    for (const ab of o.abilities ?? []) checkOrderOps(o, ab.ops);
  }
  if (gear.fittings && Object.keys(gear.fittings).length) p.fittings = JSON.parse(JSON.stringify(gear.fittings)) as Record<string, Fitting>;
  if (gear.orders?.length) p.orders = JSON.parse(JSON.stringify(gear.orders)) as Order[];
  // R-X4: each early card moves to a seeded place among the top cards (the top is the end of the array).
  for (const id of gear.early ?? []) {
    const i = p.deck.lastIndexOf(id);
    if (i < 0) throw new Error(`early card ${id} is not in the deck`);
    p.deck.splice(i, 1);
    const depth = Math.floor(nextRandom(s) * Math.min(LIMITS.early, p.deck.length + 1));
    p.deck.splice(p.deck.length - depth, 0, id);
  }
}

/** R-X6: run one side's Order abilities for a moment of the round. */
function runOrders(s: GameState, seat: Seat, on: OrderAbility['on']): void {
  for (const o of s.players[seat].orders ?? []) {
    for (const ab of o.abilities ?? []) {
      if (ab.on !== on || over(s)) continue;
      if (ab.cond && !evalCond(s, seat, ab.cond)) continue;
      log(s, { k: 'order', seat, s: o.name });
      runOps(s, { seat, targets: [], via: `order:${o.name}` }, ab.ops);
    }
  }
}

// ---------- doors ----------
function draw(s: GameState, seat: Seat, n: number): void {
  const p = s.players[seat];
  for (let i = 0; i < n && !over(s); i++) {
    const c = p.deck.pop();
    if (c === undefined) {
      // R-G6: drawing from an empty deck loses the game.
      finish(s, other(seat), 'deck');
      return;
    }
    bump(s, seat, 'cardsDrawn');
    if (p.hand.length >= LIMITS.hand) {
      p.scrap.push(c);
      log(s, { k: 'burn', seat, card: c });
    } else {
      p.hand.push({ iid: newId(s, 'h'), card: c });
      log(s, { k: 'draw', seat, n: 1 });
    }
  }
}

function healSpire(s: GameState, seat: Seat, n: number, via: string): void {
  const p = s.players[seat];
  const got = Math.min(n, LIMITS.spire - p.spire);
  if (got <= 0) return;
  p.spire += got;
  bump(s, seat, 'spireHealed', got);
  log(s, { k: 'spireHeal', seat, n: got, via });
}

function healUnit(s: GameState, u: Unit, n: number, via: string): void {
  const got = Math.min(n, u.dmg);
  if (got <= 0) return;
  u.dmg -= got;
  log(s, { k: 'heal', seat: u.owner, tunit: u.iid, tcard: u.card, n: got, via });
}

/** The one damage door (R-D1..R-D6). Returns the damage actually dealt. */
function damage(s: GameState, src: { seat: Seat; unit?: Unit; via: string }, to: Hit, n: number, strike: boolean): number {
  if (n <= 0 || over(s)) return 0;
  const srcKw = src.unit ? stats(s, src.unit).keywords : [];
  if ('spire' in to) {
    const p = s.players[to.spire];
    p.spire -= n;
    log(s, { k: 'spireDmg', seat: to.spire, n, via: src.via, unit: src.unit?.iid });
    if (src.seat !== to.spire) {
      bump(s, src.seat, 'spireDamage', n);
      if (src.unit) {
        bumpUnit(src.unit, 'damageDealt', n);
        if (strike) emit(s, 'spireHit', src.unit); // strikes only, so a spireHit ability cannot feed itself
      }
    }
    if (!strike) bump(s, src.seat, 'glyphDamage', n);
    if (strike && srcKw.includes('siphon')) healSpire(s, src.seat, n, src.via); // R-K6: strikes only
    return n;
  }
  const u = to.unit;
  if (!onLine(s, u)) return 0;
  if (u.ward) {
    u.ward = false; // R-K7
    log(s, { k: 'ward', seat: u.owner, tunit: u.iid, tcard: u.card, via: src.via });
    return 0;
  }
  if (stats(s, u).keywords.includes('plated')) n -= 1; // R-K5
  if (n <= 0) {
    log(s, { k: 'absorb', seat: u.owner, tunit: u.iid, tcard: u.card, via: src.via });
    return 0;
  }
  u.dmg += n;
  hurt.set(u.iid, src.unit?.iid ?? '');
  log(s, { k: 'dmg', seat: u.owner, tunit: u.iid, tcard: u.card, n, via: src.via, unit: src.unit?.iid });
  if (src.unit) bumpUnit(src.unit, 'damageDealt', n);
  if (!strike) bump(s, src.seat, 'glyphDamage', n);
  if (strike && srcKw.includes('siphon')) healSpire(s, src.seat, n, src.via); // R-K6: strikes only
  if (srcKw.includes('corrosive')) u.doomed = true; // R-K12
  return n;
}

/** The one door that puts a unit on a Line (R-U2). Returns null when the Line is full. */
function summon(s: GameState, seat: Seat, cardId: string, via: string): Unit | null {
  const p = s.players[seat];
  if (p.line.length >= LIMITS.line) {
    log(s, { k: 'lineFull', seat, card: cardId, via });
    return null;
  }
  const d = def(cardId);
  if (d.type === 'hero' && !p.heroes.includes(cardId)) p.heroes.push(cardId);
  const u: Unit = {
    iid: newId(s, 'u'), card: cardId, owner: seat, dmg: 0, mods: [], stasis: false,
    ward: face(s, seat, cardId).keywords.includes('ward'), silenced: false, doomed: false, seen: {},
    summonRound: s.round,
  };
  p.line.push(u);
  bump(s, seat, 'unitsSummoned');
  if (d.token) bump(s, seat, 'tokensSummoned');
  if (stats(s, u).power >= 5) bump(s, seat, 'bigSummoned');
  log(s, { k: 'summon', seat, card: cardId, unit: u.iid, via });
  for (const ally of p.line) if (ally !== u) emit(s, 'allySummoned', ally, u);
  return u;
}

function emit(s: GameState, on: Ability['on'], unit: Unit, trigger?: Unit, targets: string[] = []): void {
  if (unit.silenced || over(s)) return;
  for (const ability of face(s, unit.owner, unit.card).abilities) {
    if (ability.on === on) queue.push({ unit, ability, trigger, targets });
  }
}

/** One unit strikes a unit or a Spire (R-B6). */
function strike(s: GameState, from: Unit, to: Hit, power = stats(s, from).power): number {
  if (power <= 0 || !onLine(s, from)) return 0;
  log(s, {
    k: 'strike', seat: from.owner, unit: from.iid, card: from.card, n: power,
    tunit: 'unit' in to ? to.unit.iid : spireId(to.spire), tcard: 'unit' in to ? to.unit.card : undefined,
  });
  const dealt = damage(s, { seat: from.owner, unit: from, via: from.card }, to, power, true);
  bumpUnit(from, 'strikes');
  emit(s, 'strike', from);
  return dealt;
}

// ---------- state check (R-S2) ----------
function removeFromLine(s: GameState, u: Unit): void {
  const line = s.players[u.owner].line;
  const i = line.indexOf(u);
  if (i >= 0) line.splice(i, 1);
}

function checkAscend(s: GameState): boolean {
  let changed = false;
  for (const seat of [s.priority, other(s.priority)] as Seat[]) {
    const p = s.players[seat];
    for (const hid of p.heroes) {
      if (p.ascended.includes(hid)) continue;
      const lv = def(hid).level;
      if (!lv) continue;
      const met = lv.who === 'you'
        ? (p.seen[lv.stat] ?? 0) >= lv.n
        : p.line.some((u) => u.card === hid && !u.silenced && (u.seen[lv.stat] ?? 0) >= lv.n);
      if (!met) continue;
      p.ascended.push(hid); // R-H4: every copy, in every zone
      changed = true;
      const here = p.line.filter((u) => u.card === hid);
      log(s, { k: 'ascend', seat, card: hid, n: here.length });
      for (const u of here) {
        u.dmg = 0; // R-H5: an ascending hero on the Line is fully repaired
        if (face(s, seat, hid).keywords.includes('ward')) u.ward = true;
        emit(s, 'ascend', u);
      }
    }
  }
  return changed;
}

function stateCheck(s: GameState): boolean {
  let changed = false;
  for (const seat of [s.priority, other(s.priority)] as Seat[]) {
    for (const u of [...s.players[seat].line]) {
      if (!u.doomed && stats(s, u).hp > 0) continue;
      const killer = hurt.get(u.iid);
      if (killer) {
        const k = findUnit(s, killer);
        if (k) bumpUnit(k, 'kills');
      }
      hurt.delete(u.iid);
      removeFromLine(s, u);
      if (!def(u.card).token) s.players[seat].scrap.push(u.card);
      bump(s, seat, 'alliesDied');
      bump(s, other(seat), 'enemiesDied');
      log(s, { k: 'die', seat, card: u.card, unit: u.iid });
      emit(s, 'shatter', u);
      for (const ally of s.players[seat].line) emit(s, 'allyDied', ally, u);
      for (const foe of s.players[other(seat)].line) emit(s, 'enemyDied', foe, u);
      changed = true;
    }
  }
  for (const iid of hurt.keys()) {
    const u = findUnit(s, iid);
    if (!u) continue;
    bumpUnit(u, 'survivals');
    bump(s, u.owner, 'allySurvivals');
    emit(s, 'survive', u);
    changed = true;
  }
  hurt.clear();
  if (checkAscend(s)) changed = true;
  const dead0 = s.players[0].spire <= 0;
  const dead1 = s.players[1].spire <= 0;
  if (dead0 && dead1) finish(s, 'draw', 'spires');
  else if (dead0) finish(s, 1, 'spire');
  else if (dead1) finish(s, 0, 'spire');
  return changed;
}

/** Run every waiting trigger and state check until nothing changes (R-S2, R-S3). */
function settle(s: GameState): void {
  let guard = 0;
  for (;;) {
    if (over(s)) { queue = []; hurt.clear(); return; }
    if (++guard > 500) throw new Error('settle did not finish (trigger loop)');
    // R-S2: destruction is checked before any waiting trigger runs, so a "Strike: I get +1|+1" cannot save a unit
    // that has already taken lethal damage.
    const changed = stateCheck(s);
    if (over(s)) { queue = []; hurt.clear(); return; }
    const next = queue.shift();
    if (next) {
      const seat = next.unit.owner;
      if (next.ability.cond && !evalCond(s, seat, next.ability.cond, next.unit)) continue;
      runOps(s, { seat, self: next.unit, trigger: next.trigger, targets: next.targets, via: next.unit.card }, next.ability.ops);
      continue;
    }
    if (!changed) return;
  }
}

// ---------- effect executor ----------
function amount(s: GameState, ctx: Ctx, a: Amount | undefined, dflt = 0): number {
  if (a === undefined) return dflt;
  if (typeof a === 'number') return a;
  const p = s.players[ctx.seat];
  let n = 0;
  switch (a.count) {
    case 'allies': n = p.line.length; break;
    case 'otherAllies': n = p.line.filter((u) => u !== ctx.self).length; break;
    case 'enemies': n = s.players[other(ctx.seat)].line.length; break;
    case 'reserve': n = p.reserve; break;
    case 'selfPower': n = ctx.self && onLine(s, ctx.self) ? stats(s, ctx.self).power : 0; break;
    case 'target0Power': { const u = findUnit(s, ctx.targets[0] ?? ''); n = u ? stats(s, u).power : 0; break; }
    case 'glyphsThisRound': n = p.seenRound.glyphsCast ?? 0; break;
    case 'alliesDiedThisRound': n = p.seenRound.alliesDied ?? 0; break;
    case 'ascendedHeroes': n = p.ascended.length; break;
    case 'hand': n = p.hand.length; break;
  }
  n = n * (a.mul ?? 1) + (a.plus ?? 0);
  if (a.max !== undefined) n = Math.min(n, a.max);
  return n;
}

function pick<T>(s: GameState, list: T[]): T[] {
  if (list.length === 0) return [];
  return [list[Math.floor(nextRandom(s) * list.length)]];
}
function extreme(s: GameState, list: Unit[], hi: boolean): Unit[] {
  let best: Unit | undefined;
  let bp = 0;
  for (const u of list) {
    const p = stats(s, u).power;
    if (!best || (hi ? p > bp : p < bp)) { best = u; bp = p; }
  }
  return best ? [best] : [];
}

function resolve(s: GameState, ctx: Ctx, sel: Sel): Hit[] {
  const mine = s.players[ctx.seat].line;
  const theirs = s.players[other(ctx.seat)].line;
  const units = (us: Unit[]): Hit[] => us.map((unit) => ({ unit }));
  if (typeof sel === 'object') {
    return resolve(s, ctx, sel.from).filter((h) => 'unit' in h && matches(s, h.unit, sel.filter));
  }
  switch (sel) {
    case 'self': return ctx.self && onLine(s, ctx.self) ? units([ctx.self]) : [];
    case 'target0':
    case 'target1': {
      const id = ctx.targets[sel === 'target0' ? 0 : 1];
      if (id === 'spire0') return [{ spire: 0 }];
      if (id === 'spire1') return [{ spire: 1 }];
      const u = id ? findUnit(s, id) : undefined;
      return u ? units([u]) : [];
    }
    case 'trigger': return ctx.trigger && onLine(s, ctx.trigger) ? units([ctx.trigger]) : [];
    case 'allies': return units([...mine]);
    case 'otherAllies': return units(mine.filter((u) => u !== ctx.self));
    case 'enemies': return units([...theirs]);
    case 'all': return units([...mine, ...theirs]);
    case 'others': return units([...mine, ...theirs].filter((u) => u !== ctx.self));
    case 'randomEnemy': return units(pick(s, theirs));
    case 'randomAlly': return units(pick(s, mine.filter((u) => u !== ctx.self)));
    case 'strongestEnemy': return units(extreme(s, theirs, true));
    case 'weakestEnemy': return units(extreme(s, theirs, false));
    case 'strongestAlly': return units(extreme(s, mine, true));
    case 'weakestAlly': return units(extreme(s, mine, false));
    case 'attackers':
      return s.combat && s.combat.attacker === ctx.seat
        ? units(s.combat.pairs.map((p) => findUnit(s, p.att)).filter((u): u is Unit => !!u))
        : [];
    case 'opposing': {
      if (!s.combat || !ctx.self) return [];
      const me = ctx.self.iid;
      const pr = s.combat.pairs.find((p) => p.att === me || p.blk === me);
      const id = pr ? (pr.att === me ? pr.blk : pr.att) : null;
      const u = id ? findUnit(s, id) : undefined;
      return u ? units([u]) : [];
    }
    case 'mySpire': return [{ spire: ctx.seat }];
    case 'enemySpire': return [{ spire: other(ctx.seat) }];
  }
}
const unitsOf = (hits: Hit[]): Unit[] => hits.flatMap((h) => ('unit' in h ? [h.unit] : []));

function runOps(s: GameState, ctx: Ctx, ops: Op[]): void {
  for (const op of ops) {
    if (over(s)) return;
    runOp(s, ctx, op);
  }
}

function runOp(s: GameState, ctx: Ctx, op: Op): void {
  const p = s.players[ctx.seat];
  const src = { seat: ctx.seat, unit: ctx.self && onLine(s, ctx.self) ? ctx.self : undefined, via: ctx.via };
  switch (op.op) {
    case 'damage': {
      const n = amount(s, ctx, op.n);
      for (const h of resolve(s, ctx, op.to)) damage(s, src, h, n, false);
      return;
    }
    case 'drain': {
      const n = amount(s, ctx, op.n);
      let got = 0;
      for (const h of resolve(s, ctx, op.to)) got += damage(s, src, h, n, false);
      healSpire(s, ctx.seat, got, ctx.via);
      return;
    }
    case 'heal': {
      const n = amount(s, ctx, op.n);
      for (const h of resolve(s, ctx, op.to)) {
        if ('unit' in h) healUnit(s, h.unit, n, ctx.via);
        else healSpire(s, h.spire, n, ctx.via);
      }
      return;
    }
    case 'buff': {
      const power = amount(s, ctx, op.power);
      const health = amount(s, ctx, op.health);
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        u.mods.push({ power, health, dur: op.dur ?? 'perm' });
        if (u.owner === ctx.seat && (power > 0 || health > 0)) bump(s, ctx.seat, 'buffsGiven');
        log(s, { k: 'buff', seat: u.owner, tunit: u.iid, tcard: u.card, n: power, m: health, via: ctx.via, s: op.dur ?? 'perm' });
      }
      return;
    }
    case 'grant': {
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        const kw = op.kw.filter((k) => k !== 'ward');
        if (op.kw.includes('ward')) u.ward = true; // R-K7: Ward lasts until it is used
        if (kw.length) u.mods.push({ power: 0, health: 0, kw, dur: op.dur ?? 'perm' });
        log(s, { k: 'grant', seat: u.owner, tunit: u.iid, tcard: u.card, via: ctx.via, s: op.kw.join(',') });
      }
      return;
    }
    case 'stasis': {
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        if (u.stasis) continue;
        u.stasis = true;
        if (u.owner !== ctx.seat) bump(s, ctx.seat, 'stasisApplied');
        log(s, { k: 'stasis', seat: u.owner, tunit: u.iid, tcard: u.card, via: ctx.via });
        // R-B8: a unit put in Stasis leaves the fight it was in.
        if (s.combat) {
          s.combat.pairs = s.combat.pairs.filter((pr) => pr.att !== u.iid);
          for (const pr of s.combat.pairs) if (pr.blk === u.iid) pr.blk = '';
        }
      }
      return;
    }
    case 'destroy': {
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        u.doomed = true;
        log(s, { k: 'destroy', seat: u.owner, tunit: u.iid, tcard: u.card, via: ctx.via });
      }
      return;
    }
    case 'recall': {
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        removeFromLine(s, u);
        bump(s, ctx.seat, 'recalled');
        const owner = s.players[u.owner];
        log(s, { k: 'recall', seat: u.owner, tunit: u.iid, tcard: u.card, via: ctx.via });
        if (def(u.card).token) continue; // tokens are not cards: they vanish
        if (owner.hand.length >= LIMITS.hand) {
          owner.scrap.push(u.card);
          log(s, { k: 'burn', seat: u.owner, card: u.card });
        } else {
          owner.hand.push({ iid: newId(s, 'h'), card: u.card }); // a new object with a new id
        }
      }
      return;
    }
    case 'silence': {
      for (const u of unitsOf(resolve(s, ctx, op.to))) {
        const hpBefore = stats(s, u).hp;
        u.silenced = true;
        u.mods = [];
        u.ward = false;
        const st = stats(s, u);
        if (hpBefore > 0 && st.hp <= 0) u.dmg = st.health - 1; // losing a health buff never kills (R-S4)
        log(s, { k: 'silence', seat: u.owner, tunit: u.iid, tcard: u.card, via: ctx.via });
      }
      return;
    }
    case 'draw':
      draw(s, op.who === 'foe' ? other(ctx.seat) : ctx.seat, amount(s, ctx, op.n));
      return;
    case 'summon': {
      const n = amount(s, ctx, op.n, 1);
      for (let i = 0; i < n; i++) summon(s, op.who === 'foe' ? other(ctx.seat) : ctx.seat, op.card, ctx.via);
      return;
    }
    case 'create': {
      const seat = op.who === 'foe' ? other(ctx.seat) : ctx.seat;
      const pl = s.players[seat];
      for (let i = 0; i < (op.n ?? 1); i++) {
        if (pl.hand.length >= LIMITS.hand) { log(s, { k: 'burn', seat, card: op.card }); continue; }
        pl.hand.push({ iid: newId(s, 'h'), card: op.card });
        if (def(op.card).type === 'hero' && !pl.heroes.includes(op.card)) pl.heroes.push(op.card);
        log(s, { k: 'create', seat, card: op.card, via: ctx.via });
      }
      return;
    }
    case 'charge': {
      const n = amount(s, ctx, op.n);
      if (n > 0) { p.charge += n; log(s, { k: 'charge', seat: ctx.seat, n, via: ctx.via }); }
      return;
    }
    case 'maxCharge': {
      const got = Math.min(op.n, LIMITS.maxCharge - p.maxCharge);
      if (got > 0) { p.maxCharge += got; log(s, { k: 'maxCharge', seat: ctx.seat, n: got, via: ctx.via }); }
      return;
    }
    case 'reserve': {
      const got = Math.min(amount(s, ctx, op.n), LIMITS.reserve - p.reserve);
      if (got > 0) { p.reserve += got; log(s, { k: 'reserve', seat: ctx.seat, n: got, via: ctx.via }); }
      return;
    }
    case 'rally':
      // R-B1: a rally is always one more attack, even if this round's attack has not been used yet.
      if (p.canAttack) p.extraAttacks += 1; else p.canAttack = true;
      log(s, { k: 'rally', seat: ctx.seat, via: ctx.via });
      return;
    case 'strike': {
      const tos = resolve(s, ctx, op.to);
      for (const f of unitsOf(resolve(s, ctx, op.from))) for (const t of tos) strike(s, f, t);
      return;
    }
    case 'duel': {
      const a = unitsOf(resolve(s, ctx, op.a))[0];
      const b = unitsOf(resolve(s, ctx, op.b))[0];
      if (!a || !b) return;
      const pa = stats(s, a).power;
      const pb = stats(s, b).power;
      strike(s, a, { unit: b }, pa);
      strike(s, b, { unit: a }, pb);
      return;
    }
    case 'negate': {
      const sid = ctx.targets[op.to === 'target0' ? 0 : 1];
      const i = s.stack.findIndex((it) => it.sid === sid);
      if (i < 0) return;
      const [it] = s.stack.splice(i, 1);
      s.players[it.owner].scrap.push(it.card);
      log(s, { k: 'negate', seat: it.owner, card: it.card, via: ctx.via });
      return;
    }
    case 'if':
      if (evalCond(s, ctx.seat, op.cond, ctx.self)) runOps(s, ctx, op.then);
      else if (op.else) runOps(s, ctx, op.else);
      return;
  }
}

// ---------- rounds ----------
function startRound(s: GameState): void {
  s.round += 1;
  if (s.round > LIMITS.roundCap) { finish(s, 'draw', 'rounds'); return; }
  s.initiative = other(s.initiative);
  s.acted = [0, 0];
  log(s, { k: 'round', seat: s.initiative, n: s.round });
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) {
    const p = s.players[seat];
    if (s.round > 1) p.reserve = Math.min(LIMITS.reserve, p.reserve + p.charge); // R-C4
    p.maxCharge = Math.min(LIMITS.maxCharge, p.maxCharge + 1);
    p.charge = p.maxCharge;
    p.canAttack = seat === s.initiative;
    p.extraAttacks = 0;
    p.seenRound = {};
  }
  s.priority = s.initiative;
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) draw(s, seat, 1);
  if (over(s)) return;
  // R-X6: Orders run before Dawn triggers, the Initiative holder's first; start Orders only in round 1.
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) {
    if (s.round === 1) runOrders(s, seat, 'start');
    runOrders(s, seat, 'dawn');
  }
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) {
    for (const u of s.players[seat].line) {
      if (u.dmg > 0 && stats(s, u).keywords.includes('mend')) healUnit(s, u, u.dmg, u.card); // R-K11
      emit(s, 'dawn', u);
    }
  }
  s.passes = 0;
  s.phase = 'main';
  settle(s);
}

function endRound(s: GameState): void {
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) runOrders(s, seat, 'dusk'); // R-X6
  for (const seat of [s.initiative, other(s.initiative)] as Seat[]) {
    for (const u of s.players[seat].line) emit(s, 'dusk', u);
  }
  settle(s);
  if (over(s)) return;
  for (const p of s.players) {
    for (const u of p.line) {
      if (stats(s, u).keywords.includes('unstable')) { // R-K10
        u.doomed = true;
        log(s, { k: 'destroy', seat: u.owner, tunit: u.iid, tcard: u.card, via: u.card, s: 'unstable' });
      }
    }
  }
  settle(s);
  if (over(s)) return;
  for (const p of s.players) {
    for (const u of p.line) {
      const hpBefore = stats(s, u).hp;
      u.mods = u.mods.filter((m) => m.dur !== 'round');
      const st = stats(s, u);
      if (hpBefore > 0 && st.hp <= 0) u.dmg = st.health - 1; // R-S4
      u.stasis = false;
    }
  }
  settle(s);
  if (!over(s)) startRound(s);
}

// ---------- glyph stack ----------
function targetAlive(s: GameState, id: string): boolean {
  return id === 'spire0' || id === 'spire1' || !!findUnit(s, id) || s.stack.some((it) => it.sid === id);
}

function resolveGlyph(s: GameState, it: StackItem): void {
  const d = def(it.card);
  // R-G9: a glyph whose every target is gone does nothing.
  if (it.targets.length > 0 && !it.targets.some((t) => targetAlive(s, t))) {
    log(s, { k: 'fizzle', seat: it.owner, card: it.card });
  } else {
    log(s, { k: 'resolve', seat: it.owner, card: it.card });
    runOps(s, { seat: it.owner, targets: it.targets, via: it.card }, d.ops ?? []);
  }
  s.players[it.owner].scrap.push(it.card);
  settle(s);
}

function resolveStack(s: GameState): void {
  const starter = s.stackStarter ?? s.priority;
  while (s.stack.length > 0 && !over(s)) {
    const it = s.stack.pop()!; // last in, first out (R-P4)
    resolveGlyph(s, it);
  }
  if (over(s)) return;
  s.stackStarter = null;
  s.passes = 0;
  if (s.phase === 'combat') {
    pruneCombat(s);
    if (s.combat) s.priority = s.combat.attacker;
  } else {
    s.priority = other(starter);
  }
}

// ---------- combat ----------
function pruneCombat(s: GameState): void {
  if (!s.combat) return;
  s.combat.pairs = s.combat.pairs.filter((pr) => findUnit(s, pr.att));
  if (s.combat.pairs.length === 0) endCombat(s);
}

function endCombat(s: GameState): void {
  if (!s.combat) return;
  const defender = other(s.combat.attacker);
  s.combat = null;
  s.phase = 'main';
  s.priority = defender;
  s.passes = 0;
  log(s, { k: 'combatEnd' });
}

function resolveCombat(s: GameState): void {
  const c = s.combat!;
  const defender = other(c.attacker);
  for (const pr of [...c.pairs]) {
    if (over(s)) return;
    const att = findUnit(s, pr.att);
    if (!att) continue;
    const aSt = stats(s, att);
    if (pr.blk === null) {
      strike(s, att, { spire: defender }); // R-B5: unblocked
      settle(s);
      continue;
    }
    const blk = findUnit(s, pr.blk);
    if (!blk) {
      // R-B7: the blocker is gone: only Pierce gets through.
      if (aSt.keywords.includes('pierce')) strike(s, att, { spire: defender });
      settle(s);
      continue;
    }
    const bSt = stats(s, blk);
    const hitBlocker = (): void => {
      const eff = blk.ward ? 0 : Math.max(0, aSt.power - (bSt.keywords.includes('plated') ? 1 : 0));
      const excess = aSt.keywords.includes('pierce') ? Math.max(0, eff - bSt.hp) : 0;
      strike(s, att, { unit: blk }, aSt.power);
      if (excess > 0) damage(s, { seat: att.owner, unit: att, via: att.card }, { spire: defender }, excess, true); // R-K2
    };
    if (aSt.keywords.includes('vanguard')) {
      hitBlocker(); // R-K1
      settle(s);
      if (over(s)) return;
      if (onLine(s, blk) && onLine(s, att)) strike(s, blk, { unit: att });
    } else {
      hitBlocker();
      strike(s, blk, { unit: att }, bSt.power); // simultaneous: power read before either strike
    }
    settle(s);
  }
  if (!over(s)) endCombat(s);
}

// ---------- legality ----------
function handCard(s: GameState, seat: Seat, iid: string) {
  return s.players[seat].hand.find((h) => h.iid === iid);
}

/** Why this hand card cannot be played right now (ignoring target choice), or null. Player-facing. */
export function whyNotPlay(s: GameState, seat: Seat, iid: string): string | null {
  if (over(s)) return 'The game is over';
  const hc = handCard(s, seat, iid);
  if (!hc) return 'That card is not in your hand';
  if (hc.card === '?') return 'Hidden card';
  if (s.priority !== seat) return 'Not your turn to act';
  const d = def(hc.card);
  if (d.unimplemented) return 'This card is disabled';
  const cost = costOf(s, seat, hc.card);
  const have = budget(s, seat, hc.card);
  if (d.type !== 'glyph') {
    if (s.phase !== 'main') return 'Units cannot be played during an attack';
    if (s.stack.length > 0) return 'Units cannot be played while tactics are waiting to resolve';
    if (d.type === 'hero' && s.players[seat].line.some((u) => u.card === hc.card)) {
      return 'That hero is already on your Line: Channel this copy instead';
    }
    if (have < cost) return `Needs ${cost} Charge (you have ${have}; Reserve only pays for tactics)`;
    return null;
  }
  if (s.phase !== 'main' && s.phase !== 'combat') return 'Tactics cannot be played while attackers or blockers are being chosen';
  if (d.speed === 'ritual') {
    if (s.phase !== 'main') return 'Ritual tactics cannot be played during an attack';
    if (s.stack.length > 0) return 'Ritual tactics cannot answer another tactic';
  }
  if (have < cost) return `Needs ${cost} Charge (you have ${have} with Reserve)`;
  if (d.castIf && !evalCond(s, seat, d.castIf)) return 'Its condition is not met';
  if ((d.targets?.length ?? 0) > 0 && targetChoices(s, seat, iid).length === 0) return 'No legal target';
  return null;
}

/** Every legal target list for a playable card: one array per complete choice. */
export function targetChoices(s: GameState, seat: Seat, iid: string): string[][] {
  const hc = handCard(s, seat, iid);
  if (!hc || hc.card === '?') return [[]];
  const d = def(hc.card);
  const specs = targetSpecs(s, seat, hc.card);
  let combos: string[][] = [[]];
  for (const spec of specs) {
    const legal = legalTargets(s, seat, spec);
    const next: string[][] = [];
    for (const c of combos) for (const t of legal) if (!c.includes(t)) next.push([...c, t]);
    if (next.length === 0) {
      // R-G10: fill as many target slots as have a legal target. A unit may be played with none (its deploy then
      // does nothing for the missing slots); a glyph needs at least its first.
      return d.type === 'glyph' && (combos[0].length === 0 || d.needsAllTargets) ? [] : combos;
    }
    combos = next;
    if (combos.length > 400) break;
  }
  return combos;
}

function whyNotTargets(s: GameState, seat: Seat, iid: string, targets: string[]): string | null {
  const choices = targetChoices(s, seat, iid);
  if (choices.some((c) => c.length === targets.length && c.every((t, i) => t === targets[i]))) return null;
  if (choices.length && choices[0].length > 0) return targets.length < choices[0].length ? `Choose ${choices[0].length} target${choices[0].length > 1 ? 's' : ''}` : 'Choose a legal target';
  return 'This card takes no target';
}

export function whyNotDeclare(s: GameState, seat: Seat, unitId: string, duel?: string): string | null {
  if (s.priority !== seat) return 'Not your turn to act';
  if (s.phase !== 'main' && s.phase !== 'declare') return 'An attack is already under way';
  if (s.phase === 'main' && s.stack.length > 0) return 'Cannot attack while tactics are waiting to resolve';
  const p = s.players[seat];
  if (s.phase === 'main' && !p.canAttack) return s.initiative === seat ? 'You have already attacked this round' : 'You do not hold the Initiative this round';
  const u = p.line.find((x) => x.iid === unitId);
  if (!u) return 'That unit is not on your Line';
  if (u.stasis) return 'In Stasis: cannot attack this round';
  if (s.combat?.pairs.some((pr) => pr.att === unitId)) return 'Already attacking';
  if (duel !== undefined) {
    if (!stats(s, u).keywords.includes('dueler')) return 'Only a Dueler can force a blocker';
    const t = s.players[other(seat)].line.find((x) => x.iid === duel);
    if (!t) return 'That unit is not on the enemy Line';
    if (t.stasis) return 'A unit in Stasis cannot be forced to block';
    if (s.combat?.pairs.some((pr) => pr.blk === duel)) return 'That unit is already forced to block';
  }
  return null;
}

export function whyNotBlockAction(s: GameState, seat: Seat, unitId: string, attId: string): string | null {
  if (s.phase !== 'block' || s.priority !== seat || !s.combat) return 'There is nothing to block right now';
  const u = s.players[seat].line.find((x) => x.iid === unitId);
  if (!u) return 'That unit is not on your Line';
  if (s.combat.pairs.some((pr) => pr.blk === unitId)) return 'Already blocking';
  const pr = s.combat.pairs.find((x) => x.att === attId);
  if (!pr) return 'That unit is not attacking';
  if (pr.blk !== null) return 'That attacker is already blocked';
  const att = findUnit(s, attId);
  if (!att) return 'That attacker is gone';
  return whyNotBlock(s, u, att);
}

/** Every action the acting player may take. Never empty unless the game is over (R-X1). */
export function legalActions(s: GameState): Action[] {
  if (over(s)) return [];
  const seat = s.priority;
  const p = s.players[seat];
  const out: Action[] = [];
  if (s.phase === 'mulligan') {
    const ids = p.hand.map((h) => h.iid);
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      out.push({ type: 'mulligan', replace: ids.filter((_, i) => mask & (1 << i)) });
    }
    return out;
  }
  if (s.phase === 'main' || s.phase === 'combat') {
    for (const hc of p.hand) {
      if (hc.card === '?') continue;
      if (whyNotPlay(s, seat, hc.iid) === null) {
        const full = def(hc.card).type !== 'glyph' && p.line.length >= LIMITS.line;
        for (const replace of full ? p.line.map((u) => u.iid) : [undefined]) {
          for (const targets of targetChoices(s, seat, hc.iid)) {
            if (replace && targets.includes(replace)) continue;
            const a: Action = { type: 'play', iid: hc.iid };
            if (targets.length) a.targets = targets;
            if (replace) a.replace = replace;
            out.push(a);
          }
        }
      }
      if (whyNotChannel(s, seat, hc.iid) === null) out.push({ type: 'channel', iid: hc.iid });
    }
  }
  if (s.phase === 'main' || s.phase === 'declare') {
    for (const u of p.line) {
      if (whyNotDeclare(s, seat, u.iid) !== null) continue;
      out.push({ type: 'declare', unit: u.iid });
      if (stats(s, u).keywords.includes('dueler')) {
        for (const t of s.players[other(seat)].line) {
          if (whyNotDeclare(s, seat, u.iid, t.iid) === null) out.push({ type: 'declare', unit: u.iid, duel: t.iid });
        }
      }
    }
  }
  if (s.phase === 'declare' && s.combat) {
    for (const pr of s.combat.pairs) out.push({ type: 'undeclare', unit: pr.att });
    out.push({ type: 'attack' });
  }
  if (s.phase === 'block' && s.combat) {
    for (const u of p.line) {
      for (const pr of s.combat.pairs) {
        if (whyNotBlockAction(s, seat, u.iid, pr.att) === null) out.push({ type: 'block', unit: u.iid, att: pr.att });
      }
    }
    for (const pr of s.combat.pairs) if (pr.blk && !pr.forced) out.push({ type: 'unblock', unit: pr.blk });
    out.push({ type: 'blocks' });
  }
  if (s.phase === 'main' || s.phase === 'combat') out.push({ type: 'pass' });
  return out;
}

export function whyNotChannel(s: GameState, seat: Seat, iid: string): string | null {
  if (over(s) || s.priority !== seat) return 'Not your turn to act';
  if (s.phase !== 'main' && s.phase !== 'combat') return 'Cannot Channel while attackers or blockers are being chosen';
  const hc = handCard(s, seat, iid);
  if (!hc || hc.card === '?') return 'That card is not in your hand';
  if (def(hc.card).type !== 'hero') return 'Only a hero card can be Channelled';
  const p = s.players[seat];
  if (!p.line.some((u) => u.card === hc.card)) return 'Channel needs the same hero on your Line';
  if (p.charge < LIMITS.channelCost) return `Channel costs ${LIMITS.channelCost} Charge`;
  return null;
}

// ---------- apply ----------
function refuse(error: string): Result {
  return { ok: false, error, events: [] };
}

export function applyAction(s: GameState, a: Action): Result {
  if (over(s)) return refuse('The game is over');
  const seat = s.priority;
  const p = s.players[seat];
  const start = s.log.length;
  queue = [];
  hurt = new Map();
  const done = (): Result => ({ ok: true, events: s.log.slice(start) });

  switch (a.type) {
    case 'concede':
      finish(s, other(seat), 'concede');
      return done();

    case 'mulligan': {
      if (s.phase !== 'mulligan') return refuse('The opening hand is already kept');
      if (new Set(a.replace).size !== a.replace.length || !a.replace.every((id) => handCard(s, seat, id))) {
        return refuse('Choose cards from your hand');
      }
      const back: string[] = [];
      for (const id of a.replace) {
        const i = p.hand.findIndex((h) => h.iid === id);
        back.push(p.hand.splice(i, 1)[0].card);
      }
      // R-G4: draw replacements first, then shuffle the returned cards in.
      for (let i = 0; i < back.length; i++) {
        const c = p.deck.pop();
        if (c) p.hand.push({ iid: newId(s, 'h'), card: c });
      }
      p.deck.push(...back);
      if (back.length) shuffle(s, p.deck);
      p.mulliganed = true;
      log(s, { k: 'mulligan', seat, n: back.length });
      if (s.players.every((x) => x.mulliganed)) startRound(s);
      else s.priority = other(seat);
      return done();
    }

    case 'play': {
      const why = whyNotPlay(s, seat, a.iid);
      if (why) return refuse(why);
      const targets = a.targets ?? [];
      const whyT = whyNotTargets(s, seat, a.iid, targets);
      if (whyT) return refuse(whyT);
      const hc = handCard(s, seat, a.iid)!;
      const d = def(hc.card);
      // R-U1: a unit played onto a full Line replaces one of your own units, which is destroyed first.
      const full = d.type !== 'glyph' && p.line.length >= LIMITS.line;
      const scrapped = a.replace !== undefined ? p.line.find((u) => u.iid === a.replace) : undefined;
      if (full && !scrapped) return refuse(`Your Line is full (${LIMITS.line} units): choose one of your units to scrap`);
      if (!full && a.replace !== undefined) return refuse('Nothing needs to be scrapped');
      if (scrapped && targets.includes(scrapped.iid)) return refuse('The scrapped unit cannot be a target');
      const cost = costOf(s, seat, hc.card);
      // R-C2: glyphs spend Reserve first, then Charge.
      let left = cost;
      if (d.type === 'glyph') { const r = Math.min(p.reserve, left); p.reserve -= r; left -= r; }
      p.charge -= left;
      bump(s, seat, 'chargeSpent', cost);
      p.hand.splice(p.hand.indexOf(hc), 1);
      s.acted[seat] += 1;
      if (d.type !== 'glyph') {
        log(s, { k: 'play', seat, card: hc.card, n: cost });
        if (scrapped) {
          scrapped.doomed = true;
          log(s, { k: 'destroy', seat, tunit: scrapped.iid, tcard: scrapped.card, via: hc.card, s: 'replaced' });
          settle(s);
          if (over(s)) return done();
        }
        const u = summon(s, seat, hc.card, hc.card);
        if (u) emit(s, 'deploy', u, undefined, targets);
        settle(s);
        if (!over(s)) { s.passes = 0; s.priority = other(seat); }
        return done();
      }
      bump(s, seat, 'glyphsCast');
      log(s, { k: 'cast', seat, card: hc.card, n: cost, tunit: targets[0], s: d.speed });
      for (const u of p.line) emit(s, 'glyphCast', u);
      const item: StackItem = { sid: newId(s, 's'), card: hc.card, owner: seat, targets };
      if (d.speed === 'flash') {
        settle(s); // glyphCast triggers first
        if (!over(s)) resolveGlyph(s, item); // R-P3: resolves at once, the caster keeps priority
        if (!over(s) && s.phase === 'combat') pruneCombat(s);
        return done();
      }
      if (s.stack.length === 0) s.stackStarter = seat;
      s.stack.push(item);
      settle(s);
      if (!over(s)) { s.passes = 0; s.priority = other(seat); }
      return done();
    }

    case 'channel': {
      const why = whyNotChannel(s, seat, a.iid);
      if (why) return refuse(why);
      const hc = handCard(s, seat, a.iid)!;
      p.charge -= LIMITS.channelCost;
      bump(s, seat, 'chargeSpent', LIMITS.channelCost);
      p.hand.splice(p.hand.indexOf(hc), 1);
      p.scrap.push(hc.card);
      s.acted[seat] += 1;
      const u = p.line.find((x) => x.card === hc.card)!;
      log(s, { k: 'channel', seat, card: hc.card, tunit: u.iid, tcard: u.card });
      healUnit(s, u, u.dmg, hc.card);
      u.mods.push({ power: 1, health: 1, dur: 'perm' }); // R-H7
      settle(s);
      return done();
    }

    case 'declare': {
      const why = whyNotDeclare(s, seat, a.unit, a.duel);
      if (why) return refuse(why);
      if (!s.combat) s.combat = { attacker: seat, pairs: [] };
      s.phase = 'declare';
      const pair: CombatPair = { att: a.unit, blk: a.duel ?? null, forced: a.duel !== undefined };
      s.combat.pairs.push(pair);
      return done();
    }

    case 'undeclare': {
      if (s.phase !== 'declare' || !s.combat) return refuse('No attack is being declared');
      const i = s.combat.pairs.findIndex((pr) => pr.att === a.unit);
      if (i < 0) return refuse('That unit is not attacking');
      s.combat.pairs.splice(i, 1);
      if (s.combat.pairs.length === 0) { s.combat = null; s.phase = 'main'; }
      return done();
    }

    case 'attack': {
      if (s.phase !== 'declare' || !s.combat || s.combat.pairs.length === 0) return refuse('Choose at least one attacker');
      if (p.extraAttacks > 0) p.extraAttacks -= 1; else p.canAttack = false;
      s.acted[seat] += 1;
      bump(s, seat, 'attackersDeclared', s.combat.pairs.length);
      log(s, { k: 'attack', seat, n: s.combat.pairs.length });
      s.phase = 'block';
      for (const pr of s.combat.pairs) {
        const u = findUnit(s, pr.att);
        if (u) emit(s, 'assault', u);
      }
      settle(s);
      if (over(s)) return done();
      pruneCombat(s);
      if (!s.combat) return done();
      for (const pr of s.combat.pairs) if (pr.blk && !findUnit(s, pr.blk)) { pr.blk = null; pr.forced = false; }
      s.priority = other(seat);
      s.passes = 0;
      // R-B4: with no possible block the defender is not asked.
      if (!legalActions(s).some((x) => x.type === 'block')) lockBlocks(s);
      return done();
    }

    case 'block': {
      const why = whyNotBlockAction(s, seat, a.unit, a.att);
      if (why) return refuse(why);
      s.combat!.pairs.find((pr) => pr.att === a.att)!.blk = a.unit;
      return done();
    }

    case 'unblock': {
      if (s.phase !== 'block' || !s.combat) return refuse('There is nothing to block right now');
      const pr = s.combat.pairs.find((x) => x.blk === a.unit);
      if (!pr) return refuse('That unit is not blocking');
      if (pr.forced) return refuse('A Dueler forced this block');
      pr.blk = null;
      return done();
    }

    case 'blocks': {
      if (s.phase !== 'block' || !s.combat) return refuse('There is nothing to block right now');
      s.acted[seat] += s.combat.pairs.some((pr) => pr.blk && !pr.forced) ? 1 : 0;
      lockBlocks(s);
      return done();
    }

    case 'pass': {
      if (s.phase !== 'main' && s.phase !== 'combat') return refuse('Finish choosing first');
      settle(s);
      if (over(s)) return done();
      log(s, { k: 'pass', seat });
      if (s.stack.length > 0) { resolveStack(s); return done(); } // R-P4
      s.passes += 1;
      if (s.passes < 2) { s.priority = other(seat); return done(); }
      if (s.phase === 'combat') resolveCombat(s); // R-B5
      else endRound(s); // R-P5
      return done();
    }
  }
}

function lockBlocks(s: GameState): void {
  const c = s.combat!;
  log(s, { k: 'blocks', seat: other(c.attacker), n: c.pairs.filter((pr) => pr.blk).length });
  s.phase = 'combat';
  s.priority = c.attacker; // R-B4: the attacker acts first in the combat window
  s.passes = 0;
}

export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

export type { Keyword };
