// Hero level bench: how often, and how soon, each hero ascends in real games (BALANCE.md B-6).
//   npx tsx tools/herosim.ts --games 600 --level normal          (every premade against every other, both seats)
//   npx tsx tools/herosim.ts --hero storm-ness                    (one hero's counter curve in detail)
// For every hero in a seat's deck it records, per game: whether a copy reached the Line, the round its level counter
// first reached each value (player counter, or the best single copy's own counter for 'self' conditions), whether it
// ascended, and whether a copy was on the Line when it did. From the curve it prints, for the current n and for nearby
// values, the share of games that reach n and the median round they do.
import '../src/data/cards/index';
import { spawn } from 'node:child_process';
import type { GameState, Seat } from '../src/engine/types';
import { playGame, type Policy } from '../src/ai/arena';
import { chooseAction, type Difficulty } from '../src/ai/ai';
import { premadeDecks } from '../src/data/decks';
import { def } from '../src/engine/query';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const games = Number(arg('games', '552'));
const level = arg('level', 'normal') as Difficulty;
const seed0 = Number(arg('seed', '9000'));
const only = arg('hero', '');
const jobs = Number(arg('jobs', '4'));
const alt = process.argv.includes('--alt'); // with --hero: also curve every other counter in the games the hero was played
const PSTATS = ['alliesDied', 'enemiesDied', 'glyphsCast', 'glyphDamage', 'spireDamage', 'spireHealed', 'unitsSummoned', 'bigSummoned',
  'stasisApplied', 'attackersDeclared', 'allySurvivals', 'cardsDrawn', 'chargeSpent', 'buffsGiven', 'recalled', 'tokensSummoned'] as const;
const USTATS = ['strikes', 'damageDealt', 'survivals', 'kills'] as const;
const part = arg('part', ''); // 'k/m': this process plays games g with g % m === k and prints its records as JSON

const decks = premadeDecks();
const pol: Policy = (v, seat, rnd) => chooseAction(v, seat, level, rnd);

interface Rec { games: number; played: number; asc: number; ascPlayed: number; ascOnLine: number; ascRound: number[]; rounds: number[]; reach: number[][]; playRound: number[]; alt: Record<string, number[][]>; byDeck: Record<string, [number, number]> }
const recs: Record<string, Rec> = {};
let totalRounds = 0;
const deckWins: Record<string, [number, number]> = {};

const pairs: [number, number][] = [];
for (let i = 0; i < decks.length; i++) for (let j = 0; j < decks.length; j++) if (i !== j) pairs.push([i, j]);

// Spread the pairings so a short run still meets every deck: stride through the list by a step coprime to its length.
const step = ((): number => { let k = 97; const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x); while (gcd(k, pairs.length) !== 1) k += 1; return k; })();

function play(k: number, m: number): void {
for (let g = k; g < games; g += m) {
  const [a, b] = pairs[(g * step) % pairs.length];
  const seatDecks: [string[], string[]] = [decks[a].cards, decks[b].cards];
  // per seat, per hero: round each counter value was first reached; round a copy first hit the Line
  const reach: Record<string, number[]>[] = [{}, {}];
  const firstLine: Record<string, number>[] = [{}, {}];
  const ascAt: Record<string, { round: number; onLine: boolean }>[] = [{}, {}];
  const altReach: Record<string, Record<string, number[]>>[] = [{}, {}];
  const tracked = (hid: string): boolean => alt && only.split(',').includes(hid);
  const heroesOf = seatDecks.map((d) => [...new Set(d.filter((id) => def(id).type === 'hero'))]);
  const observe = (s: GameState): void => {
    for (const seat of [0, 1] as Seat[]) {
      const p = s.players[seat];
      for (const hid of heroesOf[seat]) {
        const lv = def(hid).level!;
        const v = lv.who === 'you'
          ? p.seen[lv.stat] ?? 0
          : Math.max(0, ...p.line.filter((u) => u.card === hid).map((u) => u.seen[lv.stat] ?? 0));
        const r = (reach[seat][hid] ??= []);
        for (let k = r.length + 1; k <= v; k++) r[k - 1] = s.round;
        if (tracked(hid)) {
          const ar = (altReach[seat][hid] ??= {});
          const vals: [string, number][] = [
            ...PSTATS.map((st): [string, number] => [`you ${st}`, p.seen[st] ?? 0]),
            ...USTATS.map((st): [string, number] => [`self ${st}`, Math.max(0, ...p.line.filter((u) => u.card === hid).map((u) => u.seen[st] ?? 0))]),
          ];
          for (const [key, val] of vals) { const x = (ar[key] ??= []); for (let k = x.length + 1; k <= val; k++) x[k - 1] = s.round; }
        }
        if (p.line.some((u) => u.card === hid) && firstLine[seat][hid] === undefined) firstLine[seat][hid] = s.round;
        if (p.ascended.includes(hid) && !ascAt[seat][hid]) ascAt[seat][hid] = { round: s.round, onLine: p.line.some((u) => u.card === hid) };
      }
    }
  };
  const res = playGame({ seed: seed0 + g, decks: seatDecks }, [pol, pol], { observe });
  totalRounds += res.rounds;
  if (res.winner === 0 || res.winner === 1) {
    (deckWins[decks[res.winner === 0 ? a : b].name] ??= [0, 0])[0] += 1;
    (deckWins[decks[res.winner === 0 ? b : a].name] ??= [0, 0])[1] += 1;
  }
  for (const seat of [0, 1] as Seat[]) for (const hid of heroesOf[seat]) {
    const rec = (recs[hid] ??= { games: 0, played: 0, asc: 0, ascPlayed: 0, ascOnLine: 0, ascRound: [], rounds: [], reach: [], playRound: [], alt: {}, byDeck: {} });
    rec.games += 1;
    rec.rounds.push(res.rounds);
    const dk = (rec.byDeck[decks[seat === 0 ? a : b].name] ??= [0, 0]);
    if (firstLine[seat][hid] !== undefined) { dk[0] += 1; if (ascAt[seat][hid]) dk[1] += 1; }
    if (firstLine[seat][hid] !== undefined) { rec.played += 1; rec.playRound.push(firstLine[seat][hid]); }
    if (ascAt[seat][hid]) { rec.asc += 1; if (firstLine[seat][hid] !== undefined) rec.ascPlayed += 1; rec.ascRound.push(ascAt[seat][hid].round); if (ascAt[seat][hid].onLine) rec.ascOnLine += 1; }
    rec.reach.push(reach[seat][hid] ?? []);
    if (tracked(hid) && firstLine[seat][hid] !== undefined) for (const [key, x] of Object.entries(altReach[seat][hid] ?? {})) (rec.alt[key] ??= []).push(x);
  }
}
}

async function main(): Promise<void> {
  if (part) {
    const [k, m] = part.split('/').map(Number);
    play(k, m);
    process.stdout.write(JSON.stringify({ recs, totalRounds, deckWins }));
    return;
  }
  const outs = await Promise.all(Array.from({ length: jobs }, (_, k) => new Promise<string>((ok, fail) => {
    const args = process.argv.slice(1);
    const c = spawn(process.execPath, [...process.execArgv, ...args, '--part', `${k}/${jobs}`], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    c.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    c.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`part ${k} exited ${code}`))));
  })));
  for (const o of outs) {
    const r = JSON.parse(o) as { recs: Record<string, Rec>; totalRounds: number; deckWins: Record<string, [number, number]> };
    totalRounds += r.totalRounds;
    for (const [dn, [w, l]] of Object.entries(r.deckWins)) { const d = (deckWins[dn] ??= [0, 0]); d[0] += w; d[1] += l; }
    for (const [hid, x] of Object.entries(r.recs)) {
      const t = (recs[hid] ??= { games: 0, played: 0, asc: 0, ascPlayed: 0, ascOnLine: 0, ascRound: [], rounds: [], reach: [], playRound: [], alt: {}, byDeck: {} });
      t.games += x.games; t.played += x.played; t.asc += x.asc; t.ascPlayed += x.ascPlayed; t.ascOnLine += x.ascOnLine;
      t.ascRound.push(...x.ascRound); t.rounds.push(...x.rounds); t.reach.push(...x.reach); t.playRound.push(...x.playRound);
      for (const [dn, [pl, as]] of Object.entries(x.byDeck)) { const d = (t.byDeck[dn] ??= [0, 0]); d[0] += pl; d[1] += as; }
      for (const [key, v] of Object.entries(x.alt)) (t.alt[key] ??= []).push(...v);
    }
  }
  report();
}

const med = (xs: number[]): string => {
  if (!xs.length) return '-';
  const s = [...xs].sort((x, y) => x - y);
  return String(s[Math.floor(s.length / 2)]);
};
const pct = (n: number, d: number): string => (d ? `${Math.round((100 * n) / d)}%` : '-');

function report(): void {
  if (process.argv.includes('--decks')) {
    console.log('deck win rates:');
    for (const [n, [w, l]] of Object.entries(deckWins).sort((x, y) => y[1][0] / (y[1][0] + y[1][1]) - x[1][0] / (x[1][0] + x[1][1]))) console.log(`  ${n.padEnd(18)} ${w}-${l} ${pct(w, w + l)}`);
  }
console.log(`${games} games, ${level} vs ${level}, ${decks.length} premades, avg ${(totalRounds / games).toFixed(1)} rounds`);
console.log('hero              cond                       n   decks  played  ascended (if played) on-Line  med round  | reach n-: share/median round');
for (const [hid, r] of Object.entries(recs).sort()) {
  if (only && !only.split(',').includes(hid)) continue;
  const lv = def(hid).level!;
  const curve = (k: number): string => {
    const hit = r.reach.map((x) => x[k - 1]).filter((x) => x !== undefined);
    return `${k}:${pct(hit.length, r.games)}/${med(hit)}`;
  };
  const ks = [Math.max(1, Math.round(lv.n * 0.5)), Math.round(lv.n * 0.67), Math.round(lv.n * 0.83), lv.n].filter((k, i, a) => k > 0 && a.indexOf(k) === i);
  console.log(
    `${hid.padEnd(17)} ${(lv.who + ' ' + lv.stat).padEnd(26)} ${String(lv.n).padStart(2)}  ${String(r.games).padStart(5)}  ${pct(r.played, r.games).padStart(6)}  ` +
    `${pct(r.asc, r.games).padStart(5)} (${pct(r.ascPlayed, r.played).padStart(4)})   ${pct(r.ascOnLine, r.asc).padStart(5)}  ${med(r.ascRound).padStart(6)}     | ${ks.map(curve).join('  ')}`,
  );
  if (process.argv.includes('--by-deck')) console.log(`    by deck (ascended, if played): ${Object.entries(r.byDeck).map(([dn, [pl, as]]) => `${dn} ${pct(as, pl)}`).join(', ')}`);
  if (only) {
    const top = Math.max(lv.n + 4, ...r.reach.map((x) => x.length));
    for (let k = 1; k <= top; k++) console.log(`  ${String(k).padStart(2)}: ${curve(k)}`);
    console.log(`  played round median ${med(r.playRound)}, game length median ${med(r.rounds)}`);
    if (alt) {
      // For each counter: the n that 50% / 65% / 80% of the games the hero was played reach, with the median round
      console.log('  other counters, games the hero was played: n reached by 80% / 65% / 50% of them (median round)');
      for (const [key, xs] of Object.entries(r.alt)) {
        const all = [...xs, ...Array<number[]>(r.played - xs.length).fill([])];
        const at = (q: number): string => {
          let n = 0;
          while (all.filter((x) => x[n] !== undefined).length >= q * all.length) n += 1;
          return n ? `${n} (r${med(all.map((x) => x[n - 1]).filter((x) => x !== undefined))})` : '0';
        };
        console.log(`    ${key.padEnd(24)} ${at(0.8).padEnd(9)} ${at(0.65).padEnd(9)} ${at(0.5)}`);
      }
    }
  }
}
}

void main();
