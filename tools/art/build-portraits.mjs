// Snap the picked hero portraits (tools/art/jobs-portraits.mjs) to 48 x 48 (ART-STYLE section 5): the central 80% of
// the render, most common colour per cell, at most 32 colours. Picks: seed index 0 unless tools/art/portrait-picks.txt
// says "<job id> <seed>". Output: public/art/portraits/<card id>.png and <card id>.asc.png.
// usage: node tools/art/build-portraits.mjs <render dir>
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JOBS } from './jobs-portraits.mjs';
import { snapScene } from './snap.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [dir] = process.argv.slice(2);
const picks = new Map();
if (existsSync('tools/art/portrait-picks.txt')) {
  for (const line of readFileSync('tools/art/portrait-picks.txt', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const [id, seed] = t.split(/\s+/); picks.set(id, seed); }
  }
}
mkdirSync('public/art/portraits', { recursive: true });
mkdirSync('scratch', { recursive: true });
let n = 0;
for (const j of JOBS) {
  const seed = picks.get(j.id) ?? String(j.seeds[0]);
  const src = `${dir}/${j.id}-s${seed}.png`;
  if (!existsSync(src)) throw new Error(`build-portraits: missing render ${src}`);
  const crop = `scratch/portrait-crop.png`;
  await sharp(src).extract({ left: 77, top: 40, width: 614, height: 614 }).toFile(crop);
  const out = j.id.replace(/^pt-/, '').replace('@asc', '.asc');
  await snapScene(crop, `public/art/portraits/${out}.png`, 48, 48, 32);
  n++;
}
console.log('portraits', n);
