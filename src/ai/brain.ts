// The utility AI. It is only ever given view(state, seat) (R-V1): unknown cards are '?' and are never read.
// Method: every candidate action is played out on a copy until the board is quiet (stack and combat resolved,
// with the other side blocking greedily), then scored against doing nothing at the same horizon. Passing is
// the fallback, never a candidate that can win on points (card-games.md section 4).
import type { Action, GameState, Seat, Unit } from '../engine/types';
import { applyAction, cloneState, legalActions } from '../engine/rules';
import { def, isAscended, other, stats } from '../engine/query';
import type { Difficulty } from './ai';

/** WHY each weight exists is noted beside it; change one only with a bench result in BALANCE.md. */
const W = {
  win: 10000,
  spire: 1.0, // one Integrity
  spireLow: 2.0, // each point at or under 6 counts extra: racing to 0 loses the game
  power: 1.0,
  health: 0.8, // health trades slightly worse than power wins races
  hero: 2.5, // a hero on the Line is the deck's plan
  card: 1.2, // a card in hand; also what casting a glyph must beat
  maxCharge: 1.5, // ramp is worth more than a card early
  reserve: 0.4,
  progress: 5, // a hero one step from ascending is nearly ascended
  ascended: 6,
  kw: { aerial: 1.5, pierce: 0.8, vanguard: 0.7, plated: 1.2, siphon: 1.0, ward: 1.5, dueler: 0.8, dread: 1.0, mend: 0.8, corrosive: 1.5, spotter: 0.3, unstable: 0 } as Record<string, number>,
  unstable: 0.25, // an Unstable unit is gone at Dusk: only its strike this round matters
  eps: 0.05,
  // Boards stall when both sides only take attacks that win outright (10 of 60 mirror games ended by empty deck,
  // BALANCE B-1). The first attacker of a round gets a bonus that grows with the round and with a full Line.
  tempoBase: 0.3,
  tempoPerRound: 0.08,
  tempoFullLine: 1.0,
};

function unitValue(s: GameState, u: Unit): number {
  // Lasting worth only: this-round buffs and Stasis show up through the combat they change, not here.
  const round = u.mods.filter((m) => m.dur === 'round');
  let st = stats(s, u);
  if (round.length) {
    const keep = u.mods;
    u.mods = keep.filter((m) => m.dur !== 'round');
    st = stats(s, u);
    u.mods = keep;
  }
  let v = st.power * W.power + Math.max(0, st.hp) * W.health;
  for (const k of st.keywords) v += W.kw[k] ?? 0;
  if (def(u.card).type === 'hero') v += W.hero;
  if (st.keywords.includes('unstable')) v *= W.unstable;
  return v;
}

function sideScore(s: GameState, seat: Seat): number {
  const p = s.players[seat];
  let v = p.spire * W.spire - Math.max(0, 7 - p.spire) * W.spireLow;
  for (const u of p.line) v += unitValue(s, u);
  v += p.hand.length * W.card + p.maxCharge * W.maxCharge + p.reserve * W.reserve;
  for (const hid of p.heroes) {
    if (isAscended(s, seat, hid)) { v += W.ascended; continue; }
    const lv = def(hid).level;
    if (!lv) continue;
    const have = lv.who === 'you'
      ? p.seen[lv.stat] ?? 0
      : Math.max(0, ...p.line.filter((u) => u.card === hid).map((u) => u.seen[lv.stat] ?? 0));
    v += W.progress * Math.min(1, have / lv.n);
  }
  return v;
}

/** Positive is good for `seat`. */
export function evaluate(s: GameState, seat: Seat): number {
  if (s.phase === 'over') {
    if (s.winner === seat) return W.win;
    if (s.winner === other(seat)) return -W.win;
    return 0;
  }
  return sideScore(s, seat) - sideScore(s, other(seat));
}

function sim(base: GameState, ...acts: Action[]): GameState | null {
  const c = cloneState(base);
  for (const a of acts) if (!applyAction(c, a).ok) return null;
  return c;
}

/** Greedy blocks for whoever is defending in `s` (phase 'block'): add the best single block until none helps. */
function nextBlock(s: GameState, seat: Seat, noise: () => number): Action {
  const lock: Action = { type: 'blocks' };
  const settle = (c: GameState | null): number => {
    if (!c) return -Infinity;
    quiet(c, false);
    return evaluate(c, seat) + noise();
  };
  let best: Action = lock;
  let bestV = settle(sim(s, lock));
  for (const a of legalActions(s)) {
    if (a.type !== 'block') continue;
    const v = settle(sim(s, a, lock));
    if (v > bestV + W.eps) { bestV = v; best = a; }
  }
  return best;
}

/**
 * Play a copy forward until nothing is waiting: blocks are chosen greedily for whoever defends, glyphs on the
 * stack resolve, combat strikes. Nobody plays a new card in here.
 */
function quiet(c: GameState, planBlocks = true): void {
  for (let i = 0; i < 40 && c.phase !== 'over'; i++) {
    if (c.phase === 'declare') { applyAction(c, { type: 'attack' }); continue; }
    if (c.phase === 'block') {
      applyAction(c, planBlocks ? nextBlock(c, c.priority, () => 0) : { type: 'blocks' });
      continue;
    }
    if (c.stack.length > 0 || c.phase === 'combat') { applyAction(c, { type: 'pass' }); continue; }
    return;
  }
}

function after(base: GameState, seat: Seat, ...acts: Action[]): number {
  const c = sim(base, ...acts);
  if (!c) return -Infinity;
  quiet(c);
  return evaluate(c, seat);
}

/**
 * If the opponent may still attack this round, how bad is their best greedy attack into this board?
 * Used by Archon so that it keeps blockers and does not tap out into an attack. Returns my evaluation after it.
 */
function afterEnemyAttack(c: GameState, seat: Seat): number {
  const foe = other(seat);
  if (c.phase !== 'main' || c.stack.length > 0 || !c.players[foe].canAttack) return evaluate(c, seat);
  const w = cloneState(c);
  w.priority = foe;
  w.passes = 0;
  let cur = evaluate(w, foe);
  for (let i = 0; i < 6; i++) {
    let best: Action | null = null;
    let bestV = cur;
    for (const a of legalActions(w)) {
      if (a.type !== 'declare') continue;
      const v = after(w, foe, a);
      if (v > bestV + W.eps) { bestV = v; best = a; }
    }
    if (!best) break;
    applyAction(w, best);
    cur = bestV;
  }
  quiet(w);
  return evaluate(w, seat);
}

export function decide(v: GameState, seat: Seat, level: Difficulty, rnd: () => number): Action {
  const acts = legalActions(v);
  if (acts.length === 0) throw new Error('no legal action: the game is over');
  if (acts.length === 1) return acts[0];
  const noiseAmp = level === 'easy' ? 9 : 0; // Apprentice misjudges by up to 9 points: roughly a 4-cost unit
  const noise = (): number => (noiseAmp ? (rnd() - 0.5) * 2 * noiseAmp : 0);

  if (v.phase === 'mulligan') {
    // Keep cheap cards and cheap heroes; send back anything that cannot be played in the first three rounds.
    const replace = v.players[seat].hand.filter((h) => h.card !== '?' && def(h.card).cost > 3).map((h) => h.iid);
    return { type: 'mulligan', replace };
  }

  const base = cloneState(v);
  base.log = []; // copies stay small

  if (v.phase === 'block') return nextBlock(base, seat, noise);

  if (v.phase === 'declare') {
    // Add the attacker that helps most; lock in when none does.
    let best: Action = { type: 'attack' };
    let bestV = after(base, seat, best) + noise();
    for (const a of acts) {
      if (a.type !== 'declare') continue;
      const val = after(base, seat, a) + noise();
      if (val > bestV + W.eps) { bestV = val; best = a; }
    }
    return best;
  }

  // main or combat window: score every play against doing nothing at the same horizon.
  const hold = sim(base);
  if (hold) quiet(hold);
  const reply = level === 'hard' && v.phase === 'main' && v.stack.length === 0;
  const score = (c: GameState | null): number => {
    if (!c) return -Infinity;
    quiet(c);
    return (reply ? afterEnemyAttack(c, seat) : evaluate(c, seat)) + noise();
  };
  const baseline = hold ? (reply ? afterEnemyAttack(hold, seat) : evaluate(hold, seat)) : -Infinity;

  let best: Action = { type: 'pass' };
  let bestGain = W.eps;
  const mayAttack = acts.some((a) => a.type === 'declare');
  for (const a of acts) {
    if (a.type === 'pass' || a.type === 'concede' || a.type === 'declare') continue;
    let gain = score(sim(base, a)) - baseline;
    if (a.type === 'play') {
      const hc = v.players[seat].hand.find((h) => h.iid === a.iid);
      // Develop before attacking: a unit played now can attack this round (R-U3).
      if (mayAttack && hc && hc.card !== '?' && def(hc.card).type !== 'glyph' && gain > W.eps) gain += 3;
    }
    if (gain > bestGain) { bestGain = gain; best = a; }
  }
  if (mayAttack) {
    // An attack is judged by its first attacker; the rest are added in the declare phase.
    for (const a of acts) {
      if (a.type !== 'declare') continue;
      const raw = after(base, seat, a) + noise() - baseline;
      if (raw >= W.win / 2) return a; // lethal: take it now
      if (raw <= -W.win / 2) continue;
      const full = v.players[seat].line.length >= 6 ? W.tempoFullLine : 0;
      const gain = raw + W.tempoBase + W.tempoPerRound * v.round + full;
      if (gain > bestGain) { bestGain = gain; best = a; }
    }
  }
  if (level === 'easy' && best.type === 'play' && v.phase === 'main' && rnd() < 0.2) return { type: 'pass' }; // and sometimes dawdles
  if (level === 'easy' && best.type === 'pass' && rnd() < 0.15) {
    // The Apprentice sometimes fires off whatever it can.
    const plays = acts.filter((a) => a.type === 'play');
    if (plays.length) return plays[Math.floor(rnd() * plays.length)];
  }
  return best;
}
