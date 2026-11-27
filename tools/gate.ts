// One command for every gate. Prints one line per step; stops at the first failure.
import { spawnSync } from 'node:child_process';

const steps: [string, string, string[]][] = [
  ['typecheck', 'npx', ['tsc', '--noEmit']],
  ['unit + card + sim tests', 'npx', ['vitest', 'run']],
  ['audit selftest', 'npx', ['tsx', 'tools/audit.ts', '--selftest']],
  ['audit: printed text vs data, every card face', 'npx', ['tsx', 'tools/audit.ts']],
  ['mutation: every card neutered in turn must fail its own tests', 'npx', ['tsx', 'tools/mutate.ts', '--jobs', '8']],
  ['bench: AI vs random, 60 games', 'npx', ['tsx', 'tools/sim.ts', '--games', '60', '--a', 'normal', '--b', 'random', '--allpairs', '--replay']],
  ['build', 'npx', ['vite', 'build']],
];
for (const [name, cmd, args] of steps) {
  const t0 = Date.now();
  // Windows finds npx (npx.cmd) only through a shell; no argument here contains a space.
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  const ok = r.status === 0;
  const tail = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`.trim().split('\n').slice(ok ? -1 : -25).join('\n');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}s)  ${ok ? tail.slice(0, 160) : `\n${tail}`}`);
  if (!ok) process.exit(1);
}
console.log('All gates passed.');
