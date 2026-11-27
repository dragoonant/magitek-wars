// Build the v3 extra set (docs/LORA.md section 2d): picked card art, already snapped to a true grid (128 x 96 in
// public/art/cards/x2), enlarged x6 with nearest neighbour to 768 x 576 so the model sees exact pixel blocks, each
// captioned with its art subject. Run from the magitek-wars repo root.
// usage: node tools/lora/assemble-v3.mjs <out dir> <count> [seed]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { FACTIONS } from '../art/jobs-cards.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [out, countArg, seedArg] = process.argv.slice(2);
const count = Number(countArg);
let seed = Number(seedArg ?? 7);
const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
mkdirSync(out, { recursive: true });
const faces = [];
for (const f of FACTIONS) {
  for (const c of f.CARDS) {
    faces.push({ file: c.id, subject: c.subject });
    if (c.ascendedSubject) faces.push({ file: `${c.id}.asc`, subject: c.ascendedSubject });
  }
}
const have = faces.filter((x) => existsSync(`public/art/cards/x2/${x.file}.png`));
for (let i = have.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [have[i], have[j]] = [have[j], have[i]];
}
const picked = have.slice(0, count);
for (const x of picked) {
  await sharp(`public/art/cards/x2/${x.file}.png`).resize(768, 576, { kernel: 'nearest' }).png().toFile(`${out}/v3-${x.file}.png`);
  const s = x.subject.trim().endsWith('.') ? x.subject.trim() : `${x.subject.trim()}.`;
  writeFileSync(`${out}/v3-${x.file}.txt`, `mkw16 pixel art, a 16-bit game cutscene, close view, full frame, ${s}`);
}
console.log('picked', picked.length, 'of', have.length);
