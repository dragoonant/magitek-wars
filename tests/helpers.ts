// Test helpers: build a board directly, then drive the real applyAction (never hand-built contexts).
import '../src/data/cards/index';
import type { Action, CardDef, GameState, Seat, Unit } from '../src/engine/types';
import { applyAction, createGame, legalActions } from '../src/engine/rules';
import { face, hasCard, registerCards, stats } from '../src/engine/query';

/** Plain cards for engine tests. Not collectible. */
const TEST_CARDS: CardDef[] = [
  { id: 'zz-grunt', name: 'Grunt', faction: 'prism', type: 'unit', cost: 1, power: 2, health: 2, token: true, text: '' },
  { id: 'zz-wall', name: 'Wall', faction: 'prism', type: 'unit', cost: 2, power: 0, health: 6, token: true, text: '' },
  { id: 'zz-ogre', name: 'Ogre', faction: 'prism', type: 'unit', cost: 5, power: 5, health: 5, token: true, text: '' },
  { id: 'zz-bolt', name: 'Bolt', faction: 'prism', type: 'glyph', cost: 2, speed: 'swift', token: true, text: 'Deal 2 to a unit or Spire.', targets: [{ what: 'unitOrSpire', side: 'any' }], ops: [{ op: 'damage', to: 'target0', n: 2 }] },
  { id: 'zz-zap', name: 'Zap', faction: 'prism', type: 'glyph', cost: 1, speed: 'flash', token: true, text: 'Deal 1 to an enemy unit.', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }] },
  { id: 'zz-rite', name: 'Rite', faction: 'prism', type: 'glyph', cost: 3, speed: 'ritual', token: true, text: 'Draw 1.', ops: [{ op: 'draw', n: 1 }] },
  { id: 'zz-deny', name: 'Deny', faction: 'prism', type: 'glyph', cost: 2, speed: 'swift', token: true, text: 'Negate an enemy glyph.', targets: [{ what: 'glyph', side: 'enemy' }], ops: [{ op: 'negate', to: 'target0' }] },
  { id: 'zz-pump', name: 'Pump', faction: 'prism', type: 'glyph', cost: 1, speed: 'flash', token: true, text: 'Give an ally +0|+3 this round.', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', health: 3, dur: 'round' }] },
  ...(['vanguard', 'pierce', 'aerial', 'spotter', 'plated', 'siphon', 'ward', 'dueler', 'dread', 'unstable', 'mend', 'corrosive'] as const).map(
    (kw): CardDef => ({ id: `zz-${kw}`, name: kw, faction: 'prism', type: 'unit', cost: 3, power: 3, health: 3, keywords: [kw], token: true, text: kw }),
  ),
  { id: 'zz-filler', name: 'Filler', faction: 'prism', type: 'unit', cost: 10, power: 1, health: 1, token: true, text: '' },
];
if (!hasCard('zz-grunt')) registerCards(TEST_CARDS);

export interface BoardOpts {
  seed?: number;
  /** Cards in hand, per seat. */
  hand?: [string[], string[]];
  /** Units on the Line, per seat, left to right. */
  line?: [string[], string[]];
  charge?: number;
  reserve?: number;
  /** Who holds the Initiative (and acts first). Default seat 0. */
  first?: Seat;
  /** Top of the deck is the LAST id. Default: 20 fillers each. */
  deck?: [string[], string[]];
}

/**
 * A round-1 game with the given hands and Lines, 10 Charge each by default, seat `first` to act.
 * Units are placed directly (no deploy triggers, no summon counters).
 */
export function board(o: BoardOpts = {}): GameState {
  const filler = Array<string>(20).fill('zz-filler');
  const s = createGame({
    seed: o.seed ?? 7, decks: [o.deck?.[0] ?? filler, o.deck?.[1] ?? filler], first: o.first ?? 0,
    noShuffle: true, skipMulligan: true,
  });
  for (const seat of [0, 1] as Seat[]) {
    const p = s.players[seat];
    p.hand = (o.hand?.[seat] ?? []).map((card) => ({ iid: `h${s.nextId++}`, card }));
    p.charge = o.charge ?? 10;
    p.maxCharge = o.charge ?? 10;
    p.reserve = o.reserve ?? 0;
    for (const card of o.line?.[seat] ?? []) place(s, seat, card);
  }
  s.log = [];
  return s;
}

export function place(s: GameState, seat: Seat, card: string): Unit {
  const u: Unit = {
    iid: `u${s.nextId++}`, card, owner: seat, dmg: 0, mods: [], stasis: false, ward: false, silenced: false,
    doomed: false, seen: {}, summonRound: s.round,
  };
  s.players[seat].line.push(u);
  u.ward = face(s, seat, card).keywords.includes('ward');
  return u;
}

/** Apply and require success. */
export function act(s: GameState, a: Action): void {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`refused ${JSON.stringify(a)}: ${r.error}`);
}
/** Play the first hand card with this card id. Targets are unit iids / 'spire0' / 'spire1' / stack sids. */
export function play(s: GameState, card: string, targets?: string[]): void {
  const seat = s.priority;
  const hc = s.players[seat].hand.find((h) => h.card === card);
  if (!hc) throw new Error(`${card} is not in seat ${seat}'s hand`);
  act(s, targets?.length ? { type: 'play', iid: hc.iid, targets } : { type: 'play', iid: hc.iid });
}
export const pass = (s: GameState): void => act(s, { type: 'pass' });
/** Declare these attackers (seat with priority), lock in, and let the defender block as listed. */
export function attack(s: GameState, attackers: Unit[], blocks: [Unit, Unit][] = []): void {
  for (const u of attackers) act(s, { type: 'declare', unit: u.iid });
  act(s, { type: 'attack' });
  if (s.phase === 'block') {
    for (const [blocker, att] of blocks) act(s, { type: 'block', unit: blocker.iid, att: att.iid });
    act(s, { type: 'blocks' });
  }
}
/** Both players pass until the current combat (and any stack) has resolved. */
export function resolveCombat(s: GameState): void {
  let guard = 0;
  while (s.phase === 'combat' && guard++ < 10) pass(s);
}
export function unit(s: GameState, seat: Seat, card: string, nth = 0): Unit {
  const u = s.players[seat].line.filter((x) => x.card === card)[nth];
  if (!u) throw new Error(`no ${card} #${nth} on seat ${seat}'s Line`);
  return u;
}
export const st = (s: GameState, u: Unit) => stats(s, u);
export const kinds = (s: GameState): string[] => s.log.map((e) => e.k);
export { legalActions, applyAction, stats };
