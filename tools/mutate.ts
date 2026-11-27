// Proves every card's behaviour test bites: neuter one card at a time (tests/setup-mutate.ts) and run the tests
// whose names start with its id. A card whose tests still pass has a test that proves nothing.
//   npx tsx tools/mutate.ts [--faction tide] [--only tide-maren] [--jobs 6]
import '../src/data/cards/index';
import { spawn } from 'node:child_process';
import { allCards } from '../src/engine/query';

const val = (n: string, d: string): string => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const only = val('only', '');
const faction = val('faction', '');
const jobs = Number(val('jobs', '6'));
const cards = allCards().filter((c) => !c.token && !c.id.startsWith('zz-') && (!only || c.id === only) && (!faction || c.faction === faction))
  // a card with nothing to remove cannot be mutated
  .filter((c) => c.keywords?.length || c.abilities?.length || c.auras?.length || c.costAuras?.length || c.ops?.length || c.ascended);

function run(id: string, fac: string, hero: boolean): Promise<{ id: string; survived: boolean; ran: boolean }> {
  return new Promise((resolve) => {
    const files = hero ? ['tests/heroes.test.ts', `tests/cards/${fac}.test.ts`] : [`tests/cards/${fac}.test.ts`];
    const p = spawn('npx', ['vitest', 'run', ...files, '-t', id, '--reporter=dot'], { env: { ...process.env, MUTATE: id }, shell: process.platform === 'win32' }); // npx.cmd needs a shell on Windows
    let out = '';
    p.stdout.on('data', (d) => { out += String(d); });
    p.stderr.on('data', (d) => { out += String(d); });
    p.on('close', (code) => {
      const ran = /Tests\s+.*\d+ (passed|failed)/.test(out) && !/No test files found|0 passed/.test(out.replace(/\d+ skipped/g, '')) ;
      const anyRan = /(\d+) (passed|failed)/.test(out);
      resolve({ id, survived: code === 0, ran: anyRan && ran });
    });
  });
}

const queue = [...cards];
const results: { id: string; survived: boolean; ran: boolean }[] = [];
await Promise.all(Array.from({ length: jobs }, async () => {
  for (;;) {
    const c = queue.shift();
    if (!c) return;
    results.push(await run(c.id, c.faction, c.type === 'hero'));
  }
}));
const survived = results.filter((r) => r.survived).map((r) => r.id).sort();
console.log(`mutation: ${results.length} cards neutered one at a time; ${results.length - survived.length} caught by their tests; ${survived.length} survived.`);
if (survived.length) { console.log(`SURVIVED (the test passes with the card doing nothing, or no test is named for it):\n  ${survived.join('\n  ')}`); process.exit(1); }
