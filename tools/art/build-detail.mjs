// Full-detail art (PLAN D22): the same picked renders as the pixel art, smoothly resized instead of snapped to the
// grid. Each file is an exact multiple of its pixel file's size, so the game draws it into the same rectangle:
//   cards      public/art/hd/cards/<file>.webp      384 x 288 (6 x the 64 x 48 card, 3 x the 128 x 96 view)
//   portraits  public/art/hd/portraits/<id>.webp    288 x 288 (6 x 48)
//   fields     public/art/hd/fields/<key>.webp      1024 x 896 (4 x 256 x 224, the render's own size)
//   emblems    public/art/hd/emblems/<key>.webp     6 x the snapped sprite, cut out with the same mask
//   title      public/art/hd/title/backdrop.webp    4 x; the emblem and the six leads 6 x
// Picks: the same as the pixel art (tools/art/picks.md, card-picks.txt, portrait-picks.txt).
// usage: node tools/art/build-detail.mjs <lora-trainer art dir>   (holds cards/, portraits/, title/, world/)
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { JOBS as CARD_JOBS } from './jobs-cards.mjs';
import { JOBS as PORTRAIT_JOBS } from './jobs-portraits.mjs';
import { detailScene, detailSprite } from './snap.mjs';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('usage: node tools/art/build-detail.mjs <art dir>');
const OUT = 'public/art/hd';
for (const d of ['cards', 'portraits', 'fields', 'emblems', 'title']) mkdirSync(`${OUT}/${d}`, { recursive: true });

function picks(file) {
  const m = new Map();
  if (!existsSync(file)) return m;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const [id, seed] = t.split(/\s+/); m.set(id, seed); }
  }
  return m;
}
function need(src) {
  if (!existsSync(src)) throw new Error(`build-detail: missing render ${src}`);
  return src;
}

// Title, emblems and battlefields: the seeds in tools/art/picks.md.
const TITLE = [['backdrop', 'bg-dusk', 3106]];
const TITLE_SPRITES = [
  ['emblem', 'emblem', 3804, 40, false], ['wren', 'ch-wren', 3301, 48, true], ['ilse', 'ch-ilse', 3201, 48, true],
  ['ulla', 'ch-ulla', 3403, 48, true], ['vell', 'ch-vell', 3701, 48, false], ['ebbe', 'ch-ebbe', 3601, 48, false],
  ['dasha', 'ch-dasha', 3503, 48, false],
];
const EMBLEMS = [['dominion', 5002], ['gauge', 5404], ['sedgekin', 5304], ['gale', 5204], ['choir', 5101], ['blackwick', 5501]];
const FIELDS = [['vaskor', 5603], ['thrumhollow', 5702], ['sedgemere', 6002], ['kitebarrow', 5902], ['hush', 6101], ['greying', 6202], ['rimeglass', 5802]];

let n = 0;
for (const [out, job, seed] of TITLE) { await detailScene(need(`${dir}/title/${job}-s${seed}.png`), `${OUT}/title/${out}.webp`, 1024, 896); n++; }
for (const [out, job, seed, h, flip] of TITLE_SPRITES) { await detailSprite(need(`${dir}/title/${job}-s${seed}.png`), `${OUT}/title/${out}.webp`, h, 6, flip); n++; }
for (const [key, seed] of EMBLEMS) { await detailSprite(need(`${dir}/world/em-${key}-s${seed}.png`), `${OUT}/emblems/${key}.webp`, 32, 6); n++; }
for (const [key, seed] of FIELDS) { await detailScene(need(`${dir}/world/bf-${key}-s${seed}.png`), `${OUT}/fields/${key}.webp`, 1024, 896); n++; }

const cardPicks = picks('tools/art/card-picks.txt');
for (const j of CARD_JOBS) {
  const p = cardPicks.get(j.id);
  if (p === 'none') continue;
  const seed = p ? Number(p) : j.seeds[0];
  await detailScene(need(`${dir}/cards/${j.id}-s${seed}.png`), `${OUT}/cards/${j.id.replace('@asc', '.asc')}.webp`, 384, 288);
  n++;
}

const portraitPicks = picks('tools/art/portrait-picks.txt');
for (const j of PORTRAIT_JOBS) {
  const seed = portraitPicks.get(j.id) ?? String(j.seeds[0]);
  const out = j.id.replace(/^pt-/, '').replace('@asc', '.asc');
  await detailScene(need(`${dir}/portraits/${j.id}-s${seed}.png`), `${OUT}/portraits/${out}.webp`, 288, 288, { left: 77, top: 40, width: 614, height: 614 });
  n++;
}
console.log('detail art', n);
