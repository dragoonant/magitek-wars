// Build dataset/v2-gen (trained beside the 51 v1 sprites): the picked v2 candidates snapped to a 3 px grid
// (64 colours, no dithering), each with its prompt as caption.
// usage: node assemble-v2.mjs <picks file: one candidate name per line, e.g. sc-01-s2002>
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { V2 } from './v2-prompts.mjs';
import { clean } from './clean.mjs';
const picks = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
const out = 'dataset/v2-gen';
mkdirSync(out, { recursive: true });
const byId = new Map(V2.map((e) => [e[0], e]));
for (const line of picks) {
  // "name" or "name | subject" when the render differs from its prompt and the caption must say what is there
  const [name, override] = line.split('|').map((s) => s.trim());
  const id = name.replace(/-s\d+$/, '');
  const e = byId.get(id);
  if (!e) throw new Error('unknown candidate ' + name);
  const r = await clean(`cand-v2/${name}.png`, `${out}/v2-${name}.png`, 64, 3);
  writeFileSync(`${out}/v2-${name}.txt`, `mkw16 pixel art, ${e[3]}, ${override || e[4]}.`);
  console.log(name, r.cols + 'x' + r.rows);
}
console.log('picked', picks.length, 'total', readdirSync(out).filter((f) => f.endsWith('.png')).length);
