// Read-only doors: every number the game shows or uses comes from here (rule 8).
import type {
  Aura, CardDef, CardFace, Cond, Filter, GameState, Keyword, Seat, TargetSpec, Unit, Ability, CostAura,
} from './types';
import { spireId } from './types';

const REG = new Map<string, CardDef>();

export function registerCards(defs: CardDef[]): void {
  for (const d of defs) {
    if (REG.has(d.id)) throw new Error(`duplicate card id ${d.id}`);
    REG.set(d.id, d);
  }
}
export function allCards(): CardDef[] {
  return [...REG.values()];
}
export function hasCard(id: string): boolean {
  return REG.has(id);
}
export function def(id: string): CardDef {
  const d = REG.get(id);
  if (!d) throw new Error(`unknown card id ${id}`);
  return d;
}

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

export function isAscended(s: GameState, seat: Seat, cardId: string): boolean {
  return s.players[seat].ascended.includes(cardId);
}

export interface Face {
  name: string;
  power: number;
  health: number;
  keywords: Keyword[];
  abilities: Ability[];
  auras: Aura[];
  costAuras: CostAura[];
  text: string;
  ascended: boolean;
}

/** The face a card shows for this player right now (heroes switch face when Ascended, R-H4). */
export function face(s: GameState | null, seat: Seat, cardId: string): Face {
  const d = def(cardId);
  const asc = !!s && d.type === 'hero' && !!d.ascended && isAscended(s, seat, cardId);
  const f: CardFace | CardDef = asc ? d.ascended! : d;
  return {
    name: f.name ?? d.name,
    power: f.power ?? 0,
    health: f.health ?? 0,
    keywords: f.keywords ?? [],
    abilities: f.abilities ?? [],
    auras: f.auras ?? [],
    costAuras: f.costAuras ?? [],
    text: f.text,
    ascended: asc,
  };
}

export function findUnit(s: GameState, iid: string): Unit | undefined {
  for (const p of s.players) for (const u of p.line) if (u.iid === iid) return u;
  return undefined;
}
export function onLine(s: GameState, u: Unit): boolean {
  return s.players[u.owner].line.includes(u);
}

export interface Stats {
  power: number;
  /** Maximum health. */
  health: number;
  /** Health left. */
  hp: number;
  keywords: Keyword[];
}

function baseStats(s: GameState, u: Unit): Stats {
  const f = face(s, u.owner, u.card);
  let power = f.power;
  let health = f.health;
  const kws = new Set<Keyword>(u.silenced ? [] : f.keywords);
  for (const m of u.mods) {
    power += m.power;
    health += m.health;
    if (m.kw) for (const k of m.kw) kws.add(k);
  }
  kws.delete('ward');
  if (u.ward) kws.add('ward');
  return { power, health, hp: health - u.dmg, keywords: [...kws] };
}

/** The one stat door (R-S1): printed face, then lasting and round buffs, then auras. Power never goes below 0. */
export function stats(s: GameState, u: Unit): Stats {
  const st = baseStats(s, u);
  const kws = new Set(st.keywords);
  // Two passes so "allies with 5+ power have ..." sees power from plain auras: unfiltered auras first, then
  // filtered auras, whose filters read the stats after the first pass (they never see each other).
  for (const filtered of [false, true]) {
    const before: Stats = { ...st, keywords: [...kws] };
    for (const p of s.players) {
      for (const src of p.line) {
        if (src.silenced) continue;
        for (const a of face(s, src.owner, src.card).auras) {
          if (!!a.filter !== filtered) continue;
          if (!auraHits(s, src, a, u, before)) continue;
          st.power += a.power ?? 0;
          st.health += a.health ?? 0;
          if (a.kw) for (const k of a.kw) kws.add(k);
        }
      }
    }
  }
  st.power = Math.max(0, st.power);
  st.hp = st.health - u.dmg;
  st.keywords = [...kws];
  return st;
}

function auraHits(s: GameState, src: Unit, a: Aura, u: Unit, before: Stats): boolean {
  if (a.to === 'self' && u !== src) return false;
  if (a.to === 'allies' && u.owner !== src.owner) return false;
  if (a.to === 'otherAllies' && (u.owner !== src.owner || u === src)) return false;
  if (a.to === 'enemies' && u.owner === src.owner) return false;
  if (a.filter && !matches(s, u, a.filter, true, before)) return false;
  if (a.cond && !evalCond(s, src.owner, a.cond, src)) return false;
  return true;
}

export function hasKw(s: GameState, u: Unit, kw: Keyword): boolean {
  return stats(s, u).keywords.includes(kw);
}

/** Does a unit match a filter? `noAura` reads stats before auras (used inside aura evaluation). */
export function matches(s: GameState, u: Unit, f: Filter, noAura = false, given?: Stats): boolean {
  const st = given ?? (noAura ? baseStats(s, u) : stats(s, u));
  const d = def(u.card);
  if (f.maxPower !== undefined && st.power > f.maxPower) return false;
  if (f.minPower !== undefined && st.power < f.minPower) return false;
  if (f.maxCost !== undefined && d.cost > f.maxCost) return false;
  if (f.minCost !== undefined && d.cost < f.minCost) return false;
  if (f.kw && !st.keywords.includes(f.kw)) return false;
  if (f.notKw && st.keywords.includes(f.notKw)) return false;
  if (f.damaged !== undefined && u.dmg > 0 !== f.damaged) return false;
  if (f.hero !== undefined && (d.type === 'hero') !== f.hero) return false;
  if (f.stasis !== undefined && u.stasis !== f.stasis) return false;
  if (f.tribe && d.tribe !== f.tribe) return false;
  if (f.faction && d.faction !== f.faction) return false;
  if (f.card && d.id !== f.card) return false;
  return true;
}

/** R-H6: you control an Ascended hero on your Line. */
export function resonant(s: GameState, seat: Seat): boolean {
  return s.players[seat].line.some((u) => def(u.card).type === 'hero' && isAscended(s, seat, u.card));
}

export function evalCond(s: GameState, seat: Seat, c: Cond, self?: Unit): boolean {
  const p = s.players[seat];
  switch (c.c) {
    case 'resonant':
      return resonant(s, seat);
    case 'count': {
      const n = countSel(s, seat, c.of, self);
      return (c.gte === undefined || n >= c.gte) && (c.lte === undefined || n <= c.lte);
    }
    case 'seen':
      return (p.seen[c.stat] ?? 0) >= c.gte;
    case 'seenRound':
      return (p.seenRound[c.stat] ?? 0) >= c.gte;
    case 'reserve':
      return p.reserve >= c.gte;
    case 'spire': {
      const v = s.players[c.who === 'you' ? seat : other(seat)].spire;
      return (c.gte === undefined || v >= c.gte) && (c.lte === undefined || v <= c.lte);
    }
    case 'hasInitiative':
      return s.initiative === seat;
    case 'not':
      return !evalCond(s, seat, c.x, self);
  }
}

/** Count for conditions; group selectors only (no randomness, no targets). */
function countSel(s: GameState, seat: Seat, sel: import('./types').Sel, self?: Unit): number {
  if (typeof sel === 'object') {
    return groupOf(s, seat, sel.from, self).filter((u) => matches(s, u, sel.filter, true)).length;
  }
  return groupOf(s, seat, sel, self).length;
}
function groupOf(s: GameState, seat: Seat, sel: import('./types').Sel, self?: Unit): Unit[] {
  const mine = s.players[seat].line;
  const theirs = s.players[other(seat)].line;
  switch (sel) {
    case 'allies':
      return mine;
    case 'otherAllies':
      return mine.filter((u) => u !== self);
    case 'enemies':
      return theirs;
    case 'all':
      return [...mine, ...theirs];
    case 'others':
      return [...mine, ...theirs].filter((u) => u !== self);
    case 'self':
      return self && onLine(s, self) ? [self] : [];
    default:
      throw new Error(`selector ${JSON.stringify(sel)} cannot be counted`);
  }
}

/** The one cost door (R-C3). */
export function costOf(s: GameState, seat: Seat, cardId: string): number {
  const d = def(cardId);
  let c = d.cost;
  for (const u of s.players[seat].line) {
    if (u.silenced) continue;
    for (const ca of face(s, seat, u.card).costAuras) {
      if (ca.type !== 'any' && (ca.type === 'glyph') !== (d.type === 'glyph')) continue;
      if (ca.cond && !evalCond(s, seat, ca.cond, u)) continue;
      c += ca.n;
    }
  }
  return Math.max(0, c);
}

/** Charge (plus Reserve for glyphs) this player can spend on this card (R-C2). */
export function budget(s: GameState, seat: Seat, cardId: string): number {
  const p = s.players[seat];
  return p.charge + (def(cardId).type === 'glyph' ? p.reserve : 0);
}

export function inCombat(s: GameState, iid: string): boolean {
  return !!s.combat && s.combat.pairs.some((pr) => pr.att === iid || pr.blk === iid);
}

/** Legal choices for one target slot. `except` is the unit being played (a deploy cannot target itself). */
export function legalTargets(s: GameState, seat: Seat, spec: TargetSpec, except?: string): string[] {
  const out: string[] = [];
  if (spec.what === 'glyph') {
    for (const it of s.stack) {
      if (spec.side === 'ally' && it.owner !== seat) continue;
      if (spec.side === 'enemy' && it.owner === seat) continue;
      out.push(it.sid);
    }
    return out;
  }
  const seats: Seat[] = spec.side === 'ally' ? [seat] : spec.side === 'enemy' ? [other(seat)] : [seat, other(seat)];
  for (const st of seats) {
    for (const u of s.players[st].line) {
      if (u.iid === except) continue;
      if (spec.filter && !matches(s, u, spec.filter)) continue;
      if (spec.inCombat && !inCombat(s, u.iid)) continue;
      out.push(u.iid);
    }
  }
  if (spec.what === 'unitOrSpire') for (const st of seats) out.push(spireId(st));
  return out;
}

/** Target slots a card asks for when played: a glyph's own, or a unit's deploy ability. */
export function targetSpecs(s: GameState, seat: Seat, cardId: string): TargetSpec[] {
  const d = def(cardId);
  if (d.type === 'glyph') return d.targets ?? [];
  const dep = face(s, seat, cardId).abilities.find((a) => a.on === 'deploy' && a.targets?.length);
  return dep?.targets ?? [];
}

/** Can `blocker` legally block `attacker`? Returns a reason when it cannot (R-B3). */
export function whyNotBlock(s: GameState, blocker: Unit, attacker: Unit): string | null {
  if (blocker.stasis) return 'In Stasis: cannot block this round';
  const a = stats(s, attacker);
  const b = stats(s, blocker);
  if (a.keywords.includes('aerial') && !b.keywords.includes('aerial') && !b.keywords.includes('spotter')) {
    return 'Only Aerial or Spotter units can block an Aerial attacker';
  }
  if (a.keywords.includes('dread') && b.power <= 2) return 'Dread: blockers need 3 or more power';
  return null;
}
