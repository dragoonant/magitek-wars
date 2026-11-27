// Headless games with invariants after every action. Used by tests, tools/sim.ts and tools/bench.ts.
import type { Action, GameState, Seat, Setup } from '../engine/types';
import { LIMITS } from '../engine/types';
import { applyAction, cloneState, createGame, legalActions } from '../engine/rules';
import { view } from '../engine/view';
import { replay } from '../engine/save';
import { stats } from '../engine/query';

export type Policy = (v: GameState, seat: Seat, rnd: () => number) => Action;

export interface GameResult {
  winner: Seat | 'draw' | null;
  reason: string | null;
  rounds: number;
  actions: number;
  /** Rounds in which a seat took no action at all. */
  emptyRounds: [number, number];
  roundsPlayed: [number, number];
  /** Empty rounds in which the seat could have played a card or attacked (the behaviour to drive to zero). */
  idleRounds: [number, number];
  ascensions: [number, number];
  attacks: [number, number];
  blocksMade: [number, number];
  glyphs: [number, number];
  firstSeat: Seat;
  problems: string[];
  ms: number;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everything that must hold after every action (60-testing). Returns problems found. */
export function invariants(s: GameState): string[] {
  const out: string[] = [];
  const bad = (m: string): void => { out.push(`r${s.round} ${s.phase}: ${m}`); };
  s.players.forEach((p, seat) => {
    for (const [k, n] of Object.entries({ spire: p.spire, charge: p.charge, maxCharge: p.maxCharge, reserve: p.reserve })) {
      if (!Number.isFinite(n)) bad(`seat ${seat} ${k} is ${String(n)}`);
    }
    if (p.charge < 0) bad(`seat ${seat} negative Charge`);
    if (p.reserve < 0 || p.reserve > LIMITS.reserve) bad(`seat ${seat} Reserve ${p.reserve}`);
    if (p.maxCharge > LIMITS.maxCharge) bad(`seat ${seat} max Charge ${p.maxCharge}`);
    if (p.spire > LIMITS.spire) bad(`seat ${seat} Spire ${p.spire}`);
    if (p.line.length > LIMITS.line) bad(`seat ${seat} Line ${p.line.length}`);
    if (p.hand.length > LIMITS.hand) bad(`seat ${seat} hand ${p.hand.length}`);
    for (const u of p.line) {
      const st = stats(s, u);
      if (![st.power, st.health, st.hp].every(Number.isFinite)) bad(`${u.card} has a non-number stat`);
      if (s.phase !== 'over' && (st.hp <= 0 || u.doomed)) bad(`${u.card} should have been destroyed`);
      if (st.power < 0) bad(`${u.card} negative power`);
      if (u.owner !== seat) bad(`${u.card} on the wrong Line`);
    }
  });
  if (s.phase !== 'over') {
    if (s.players.some((p) => p.spire <= 0)) bad('a Spire is at 0 but the game goes on');
    if (legalActions(s).length === 0) bad('no legal action');
    if ((s.phase === 'declare' || s.phase === 'block' || s.phase === 'combat') && !s.combat) bad('combat phase without combat');
    if (s.phase === 'main' && s.combat) bad('main phase with combat');
  }
  const ids = new Set<string>();
  for (const p of s.players) for (const x of [...p.line, ...p.hand]) {
    if (ids.has(x.iid)) bad(`duplicate id ${x.iid}`);
    ids.add(x.iid);
  }
  return out;
}

export function playGame(setup: Setup, policies: [Policy, Policy], opts: { maxActions?: number; checkReplay?: boolean } = {}): GameResult {
  const t0 = Date.now();
  const s = createGame(setup);
  const rnd = mulberry((setup.seed ^ 0x9e3779b9) >>> 0);
  const actions: Action[] = [];
  const problems: string[] = [];
  const res: GameResult = {
    winner: null, reason: null, rounds: 0, actions: 0, emptyRounds: [0, 0], roundsPlayed: [0, 0], idleRounds: [0, 0], ascensions: [0, 0],
    attacks: [0, 0], blocksMade: [0, 0], glyphs: [0, 0], firstSeat: 0, problems, ms: 0,
  };
  let lastRound = 0;
  let acted: [number, number] = [0, 0];
  let could: [boolean, boolean] = [false, false];
  const closeRound = (): void => {
    if (lastRound === 0) return;
    for (const seat of [0, 1] as Seat[]) {
      res.roundsPlayed[seat] += 1;
      if (acted[seat] === 0) { res.emptyRounds[seat] += 1; if (could[seat]) res.idleRounds[seat] += 1; }
    }
  };
  const max = opts.maxActions ?? 4000;
  while (s.phase !== 'over' && actions.length < max) {
    if (s.round !== lastRound) {
      closeRound();
      if (lastRound === 0 && s.round === 1) res.firstSeat = s.initiative;
      lastRound = s.round;
      could = [false, false];
    }
    acted = [s.acted[0], s.acted[1]];
    const seat = s.priority;
    const v = view(s, seat);
    if (legalActions(s).some((x) => x.type === 'play' || x.type === 'declare')) could[seat] = true;
    let a: Action;
    try {
      a = policies[seat](v, seat, rnd);
    } catch (e) {
      problems.push(`policy threw: ${(e as Error).message}`);
      break;
    }
    const before = cloneState(s);
    const r = applyAction(s, a);
    if (!r.ok) {
      problems.push(`illegal ${JSON.stringify(a)}: ${r.error}`);
      if (JSON.stringify(before) !== JSON.stringify(s)) problems.push('a refused action changed the state');
      break;
    }
    actions.push(a);
    if (s.round === lastRound) acted = [s.acted[0], s.acted[1]];
    for (const e of r.events) {
      if (e.k === 'ascend' && e.seat !== undefined) res.ascensions[e.seat] += 1;
      if (e.k === 'attack' && e.seat !== undefined) res.attacks[e.seat] += 1;
      if (e.k === 'blocks' && e.seat !== undefined && (e.n ?? 0) > 0) res.blocksMade[e.seat] += 1;
      if (e.k === 'cast' && e.seat !== undefined) res.glyphs[e.seat] += 1;
    }
    const inv = invariants(s);
    if (inv.length) { problems.push(...inv.slice(0, 3)); break; }
  }
  closeRound();
  if (s.phase !== 'over') problems.push(problems.length ? 'stopped early' : `not finished after ${max} actions`);
  if (opts.checkReplay && problems.length === 0) {
    const rp = replay(setup, actions);
    if (rp.failedAt !== null) problems.push(`replay refused action ${rp.failedAt}`);
    else if (JSON.stringify(rp.state) !== JSON.stringify(s)) problems.push('replay diverged from the live game');
  }
  res.winner = s.winner;
  res.reason = s.endReason;
  res.rounds = s.round;
  res.actions = actions.length;
  res.ms = Date.now() - t0;
  return res;
}
