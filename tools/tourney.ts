// Premade round robin for the 45-55% band (PLAN D25): every pair of premades, both seats, `--rounds` times on fresh
// seeds, Adept vs Adept. Shards run in parallel and are merged; the table counts decisive games only.
//   npx tsx tools/tourney.ts --rounds 9 --seed 30000 --shard 0/4 --out s0.json     (one shard)
//   npx tsx tools/tourney.ts --merge s0.json s1.json ...                            (deck table, band check)
//   npx tsx tools/tourney.ts --rounds 9 --only "Cold Ledger" --out c.json            (one deck against the field)
// About 400 games a deck (9 rounds) puts each deck's rate within about +-5 points (95%).
import { readFileSync, writeFileSync } from 'node:fs';
import '../src/data/cards/index';
import { playGame, type Policy } from '../src/ai/arena';
import { chooseAction } from '../src/ai/ai';
import { premadeDecks } from '../src/data/decks';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const ai: Policy = (v, seat, rnd) => chooseAction(v, seat, 'normal', rnd);

/** wins[a][b] = games deck a won against deck b (decisive only). */
type Table = Record<string, Record<string, number>>;

function run(): void {
  const rounds = Number(arg('rounds', '9'));
  const seed0 = Number(arg('seed', '30000'));
  const only = arg('only', '');
  const [k, m] = arg('shard', '0/1').split('/').map(Number);
  const decks = premadeDecks();
  const t: Table = {};
  let n = 0;
  for (let r = 0; r < rounds; r++) for (let i = 0; i < decks.length; i++) for (let j = i + 1; j < decks.length; j++) {
    if (only && decks[i].name !== only && decks[j].name !== only) continue;
    if (n++ % m !== k) continue;
    const seed = seed0 + r * 1000 + i * 31 + j;
    for (const [a, b] of [[i, j], [j, i]]) {
      const g = playGame({ seed, decks: [decks[a].cards, decks[b].cards] }, [ai, ai]);
      if (g.problems.length) throw new Error(`${decks[a].name} vs ${decks[b].name} seed ${seed}: ${g.problems.join('; ')}`);
      if (g.winner !== 0 && g.winner !== 1) continue;
      const [w, l] = g.winner === 0 ? [a, b] : [b, a];
      ((t[decks[w].name] ??= {})[decks[l].name] ??= 0);
      t[decks[w].name][decks[l].name] += 1;
    }
  }
  const out = arg('out', '');
  if (out) writeFileSync(out, JSON.stringify(t)); else print(t);
}

function print(t: Table): void {
  const names = [...new Set([...Object.keys(t), ...Object.values(t).flatMap((x) => Object.keys(x))])];
  const won = (a: string, b: string): number => t[a]?.[b] ?? 0;
  const rows = names.map((a) => {
    const w = names.reduce((s, b) => s + won(a, b), 0), l = names.reduce((s, b) => s + won(b, a), 0);
    // worst and best matchups with at least 8 games, to see what a deck loses to
    const mu = names.filter((b) => b !== a && won(a, b) + won(b, a) >= 8).map((b) => ({ b, p: won(a, b) / (won(a, b) + won(b, a)) })).sort((x, y) => x.p - y.p);
    return { a, w, l, p: w / Math.max(1, w + l), worst: mu.slice(0, 2), best: mu.slice(-2).reverse() };
  }).sort((x, y) => y.p - x.p);
  const pc = (x: number): string => `${(100 * x).toFixed(0)}%`;
  let inBand = 0;
  for (const r of rows) {
    const flag = r.p > 0.55 ? 'HIGH' : r.p < 0.45 ? 'LOW ' : '    ';
    if (flag === '    ') inBand += 1;
    console.log(`${flag} ${r.a.padEnd(18)} ${String(r.w).padStart(4)}-${String(r.l).padEnd(4)} ${(100 * r.p).toFixed(1).padStart(5)}%   worst ${r.worst.map((x) => `${x.b} ${pc(x.p)}`).join(', ')}; best ${r.best.map((x) => `${x.b} ${pc(x.p)}`).join(', ')}`);
  }
  console.log(`${inBand} of ${rows.length} decks inside 45-55%; spread ${(100 * rows[rows.length - 1].p).toFixed(1)}-${(100 * rows[0].p).toFixed(1)}%`);
}

if (process.argv.includes('--merge')) {
  const t: Table = {};
  for (const f of process.argv.slice(process.argv.indexOf('--merge') + 1)) {
    for (const [a, row] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Table)) for (const [b, n] of Object.entries(row)) {
      ((t[a] ??= {})[b] ??= 0);
      t[a][b] += n;
    }
  }
  print(t);
} else run();
