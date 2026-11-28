// Card value bench: how much does each card move a game when its owner draws it?
// For every card, "drawn" games (it reached its owner's hand at least once, opening hand included) are compared with
// "not drawn" games of the same deck appearance. The gap (IWD, improvement when drawn) is the card's value over an
// average card of that deck. Decks: the premades plus random two-faction decks so every card is measured.
//   npx tsx tools/cardstats.ts --games 2000 --seed 20000 [--shard 0/4] [--out file.json]
//   npx tsx tools/cardstats.ts --merge a.json b.json ...        (prints the table)
//   npx tsx tools/cardstats.ts --budget                         (stat budget of every unit, docs/AUTHORING.md)
// Read IWD against cards of the same cost: a cheap card drawn late is weak, so cheap cards sit lower as a group.
import { readFileSync, writeFileSync } from 'node:fs';
import '../src/data/cards/index';
import type { FactionId, GameState, Seat } from '../src/engine/types';
import { applyAction, createGame } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { allCards, def } from '../src/engine/query';
import { chooseAction } from '../src/ai/ai';
import { collectible, premadeDecks } from '../src/data/decks';
import { checkDeck, FACTIONS } from '../src/engine/validate';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

type Tally = Record<string, { dw: number; dl: number; nw: number; nl: number }>;

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

/** A random legal two-faction deck: two heroes x2, then 18 more cards x2, cheaper cards more likely. */
function randomDeck(rnd: () => number): string[] {
  const fs = [...FACTIONS].sort(() => rnd() - 0.5).slice(0, 2) as FactionId[];
  const pool = collectible().filter((c) => fs.includes(c.faction));
  const pick = <T,>(xs: T[], w: (x: T) => number): T => {
    const tot = xs.reduce((n, x) => n + w(x), 0);
    let r = rnd() * tot;
    for (const x of xs) { r -= w(x); if (r <= 0) return x; }
    return xs[xs.length - 1];
  };
  const heroes = pool.filter((c) => c.type === 'hero');
  const rest = pool.filter((c) => c.type !== 'hero');
  const deck: string[] = [];
  const chosen = new Set<string>();
  while (chosen.size < 2) chosen.add(pick(heroes, () => 1).id);
  for (const id of chosen) deck.push(id, id);
  while (deck.length < 40) {
    const c = pick(rest.filter((x) => !chosen.has(x.id)), (x) => 1 / (1 + Math.max(0, x.cost - 3)));
    chosen.add(c.id);
    deck.push(c.id, c.id);
  }
  return deck;
}

function playTracked(seed: number, decks: [string[], string[]]): { winner: Seat | 'draw' | null; seen: [Set<string>, Set<string>] } {
  const s: GameState = createGame({ seed, decks });
  const rnd = mulberry((seed ^ 0x9e3779b9) >>> 0);
  const seen: [Set<string>, Set<string>] = [new Set(), new Set()];
  const note = (): void => { for (const seat of [0, 1] as Seat[]) for (const h of s.players[seat].hand) seen[seat].add(h.card); };
  let n = 0;
  while (s.phase !== 'over' && n++ < 4000) {
    if (s.phase !== 'mulligan') note(); // a card thrown back in the mulligan was not drawn
    const seat = s.priority;
    const a = chooseAction(view(s, seat), seat, 'normal', rnd);
    if (!applyAction(s, a).ok) break;
  }
  return { winner: s.winner, seen };
}

function run(): void {
  const games = Number(arg('games', '400'));
  const seed0 = Number(arg('seed', '20000'));
  const [k, m] = arg('shard', '0/1').split('/').map(Number);
  const premade = premadeDecks().map((d) => d.cards);
  const t: Tally = {};
  for (let g = k; g < games; g += m) {
    const rnd = mulberry(seed0 * 7919 + g);
    // half the games use premades, half random decks; every game is played on its seat-swapped twin too
    const pair = (): string[] => (rnd() < 0.5 ? premade[Math.floor(rnd() * premade.length)] : randomDeck(rnd));
    const d0 = pair(), d1 = pair();
    if (!checkDeck(d0).ok || !checkDeck(d1).ok) throw new Error('bench built an illegal deck');
    for (const swap of [false, true]) {
      const decks: [string[], string[]] = swap ? [d1, d0] : [d0, d1];
      const r = playTracked(seed0 + g, decks);
      if (r.winner === 'draw' || r.winner === null) continue;
      for (const seat of [0, 1] as Seat[]) {
        const won = r.winner === seat;
        for (const id of new Set(decks[seat])) {
          const e = (t[id] ??= { dw: 0, dl: 0, nw: 0, nl: 0 });
          if (r.seen[seat].has(id)) { if (won) e.dw++; else e.dl++; } else if (won) e.nw++; else e.nl++;
        }
      }
    }
  }
  const out = arg('out', '');
  if (out) writeFileSync(out, JSON.stringify(t)); else print(t);
}

function print(t: Tally): void {
  const rows = Object.entries(t).map(([id, e]) => {
    const d = e.dw + e.dl, nd = e.nw + e.nl;
    const gih = d ? e.dw / d : 0, gns = nd ? e.nw / nd : 0;
    const se = Math.sqrt((gih * (1 - gih)) / Math.max(1, d) + (gns * (1 - gns)) / Math.max(1, nd));
    return { id, d, nd, gih, iwd: gih - gns, se };
  }).sort((a, b) => b.iwd - a.iwd);
  const p = (x: number): string => `${(100 * x).toFixed(1)}`.padStart(5);
  console.log('   IWD   +-    GIH  drawn  card');
  for (const r of rows) {
    const c = def(r.id);
    const shape = c.type === 'glyph' ? `tactic ${c.speed}` : `${c.power}|${c.health}${c.type === 'hero' ? ' hero' : ''}`;
    console.log(`${p(r.iwd)} ${p(r.se)} ${p(r.gih)} ${String(r.d).padStart(6)}  ${r.id} (${c.cost}, ${shape}) ${c.name}: ${c.text}`);
  }
}

/** Power + health against 2 x cost + 1, plus rough keyword values; abilities are not priced (V marks a vanilla unit). */
function budget(): void {
  const KW: Record<string, number> = { aerial: 1.5, pierce: 1, corrosive: 1.5, plated: 1, ward: 1, spotter: 0.5, vanguard: 1, siphon: 1, dueler: 0.5, dread: 1, mend: 1, unstable: -2 };
  const units = allCards().filter((c) => (c.type === 'unit' || c.type === 'hero') && !c.token && !c.id.startsWith('zz-'));
  for (const c of units.sort((a, b) => a.faction.localeCompare(b.faction) || a.cost - b.cost)) {
    const over = (c.power ?? 0) + (c.health ?? 0) - (2 * c.cost + 1) + (c.keywords ?? []).reduce((n, k) => n + (KW[k] ?? 0), 0);
    const plain = !(c.abilities?.length || c.auras?.length || c.costAuras?.length);
    console.log(`${over.toFixed(1).padStart(5)} ${plain ? 'V' : ' '} ${c.cost} ${c.power}|${c.health} ${c.id} ${c.name}: ${c.text}`);
  }
}

if (process.argv.includes('--budget')) budget();
else if (process.argv.includes('--merge')) {
  const files = process.argv.slice(process.argv.indexOf('--merge') + 1);
  const t: Tally = {};
  for (const f of files) for (const [id, e] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Tally)) {
    const x = (t[id] ??= { dw: 0, dl: 0, nw: 0, nl: 0 });
    x.dw += e.dw; x.dl += e.dl; x.nw += e.nw; x.nl += e.nl;
  }
  print(t);
} else run();
