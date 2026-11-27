// Headless arena. Examples:
//   npm run sim -- --games 100 --a normal --b random          (AI vs the random control)
//   npm run sim -- --games 200 --a normal --b normal --mirror (seat balance: same deck both sides)
import '../src/data/cards/index';
import type { FactionId, Seat } from '../src/engine/types';
import { playGame, type Policy } from '../src/ai/arena';
import { chooseAction, randomAction, type Difficulty } from '../src/ai/ai';
import { autoDeck, premadeDecks } from '../src/data/decks';
import { checkDeck, FACTIONS } from '../src/engine/validate';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const policy = (name: string): Policy =>
  name === 'random' ? (v, _s, rnd) => randomAction(v, rnd) : (v, seat, rnd) => chooseAction(v, seat, name as Difficulty, rnd);

const games = Number(arg('games', '40'));
const A = arg('a', 'normal');
const B = arg('b', 'random');
const seed0 = Number(arg('seed', '1000'));
let decks = premadeDecks();
if (flag('allpairs')) {
  decks = [];
  for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) {
    const cards = autoDeck(FACTIONS[i] as FactionId, FACTIONS[j] as FactionId);
    if (checkDeck(cards).ok) decks.push({ name: `${FACTIONS[i]}+${FACTIONS[j]}`, cards });
  }
}
if (decks.length < 2) { console.error('fewer than 2 legal decks: the card pool is not ready'); process.exit(2); }

let aWins = 0, bWins = 0, draws = 0, firstWins = 0, decisive = 0, rounds = 0, capped = 0, ms = 0;
const idle = [0, 0], empty = [0, 0], played = [0, 0], asc = [0, 0], att = [0, 0], blk = [0, 0], gly = [0, 0];
const byReason: Record<string, number> = {};
const deckWins: Record<string, [number, number]> = {};
const problems: string[] = [];
for (let g = 0; g < games; g++) {
  const aSeat: Seat = g % 2 === 0 ? 0 : 1; // every pairing is played in both seats
  const d0 = decks[Math.floor(g / 2) % decks.length];
  const d1 = flag('mirror') ? d0 : decks[(Math.floor(g / 2) + 1 + Math.floor(g / (2 * decks.length))) % decks.length];
  const pols: [Policy, Policy] = aSeat === 0 ? [policy(A), policy(B)] : [policy(B), policy(A)];
  const seatDecks: [string[], string[]] = aSeat === 0 ? [d0.cards, d1.cards] : [d1.cards, d0.cards];
  const r = playGame({ seed: seed0 + Math.floor(g / 2), decks: seatDecks }, pols, { checkReplay: flag('replay') });
  if (r.problems.length) problems.push(`game ${g} (seed ${seed0 + Math.floor(g / 2)}): ${r.problems.join('; ')}`);
  rounds += r.rounds; ms += r.ms;
  byReason[r.reason ?? 'none'] = (byReason[r.reason ?? 'none'] ?? 0) + 1;
  if (r.reason === 'rounds') capped += 1;
  if (r.winner === 'draw' || r.winner === null) draws += 1;
  else {
    decisive += 1;
    if (r.winner === aSeat) aWins += 1; else bWins += 1;
    if (r.winner === r.firstSeat) firstWins += 1;
    const wn = (r.winner === aSeat ? d0 : d1).name, ln = (r.winner === aSeat ? d1 : d0).name;
    (deckWins[wn] ??= [0, 0])[0] += 1; (deckWins[ln] ??= [0, 0])[1] += 1;
  }
  const bSeat = aSeat === 0 ? 1 : 0;
  idle[0] += r.idleRounds[aSeat]; idle[1] += r.idleRounds[bSeat];
  empty[0] += r.emptyRounds[aSeat]; empty[1] += r.emptyRounds[bSeat];
  played[0] += r.roundsPlayed[aSeat]; played[1] += r.roundsPlayed[bSeat];
  asc[0] += r.ascensions[aSeat]; asc[1] += r.ascensions[bSeat];
  att[0] += r.attacks[aSeat]; att[1] += r.attacks[bSeat];
  blk[0] += r.blocksMade[aSeat]; blk[1] += r.blocksMade[bSeat];
  gly[0] += r.glyphs[aSeat]; gly[1] += r.glyphs[bSeat];
}
const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
console.log(`${games} games, ${A} vs ${B}, ${decks.length} decks${flag('mirror') ? ' (mirror)' : ''}: ${A} ${aWins} / ${B} ${bWins} / draws ${draws} (decisive only: ${pct(aWins, decisive)})`);
console.log(`first player wins ${pct(firstWins, decisive)} of decisive games; avg ${(rounds / games).toFixed(1)} rounds; capped ${capped}; ${(ms / games).toFixed(0)} ms/game; ends: ${JSON.stringify(byReason)}`);
console.log(`per game  ${A}: empty rounds ${pct(empty[0], played[0])} (idle with options ${pct(idle[0], played[0])}), ascensions ${(asc[0] / games).toFixed(2)}, attacks ${(att[0] / games).toFixed(1)}, blocks ${(blk[0] / games).toFixed(1)}, glyphs ${(gly[0] / games).toFixed(1)}`);
console.log(`per game  ${B}: empty rounds ${pct(empty[1], played[1])} (idle with options ${pct(idle[1], played[1])}), ascensions ${(asc[1] / games).toFixed(2)}, attacks ${(att[1] / games).toFixed(1)}, blocks ${(blk[1] / games).toFixed(1)}, glyphs ${(gly[1] / games).toFixed(1)}`);
if (flag('decks')) for (const [n, [w, l]] of Object.entries(deckWins).sort((x, y) => y[1][0] / (y[1][0] + y[1][1]) - x[1][0] / (x[1][0] + x[1][1]))) console.log(`  ${n.padEnd(18)} ${w}-${l} ${pct(w, w + l)}`);
if (problems.length) { console.log(`PROBLEMS (${problems.length}):\n${problems.slice(0, 10).join('\n')}`); process.exit(1); }
