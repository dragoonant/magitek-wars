// Card art jobs (ART-STYLE section 5: 64 x 48, x2 in the viewer) from the per-faction manifests in tools/art/cards/.
// Every card gets two seeds; ascended heroes get their own art (id + '@asc').
import * as dominion from './cards/dominion.mjs';
import * as choir from './cards/choir.mjs';
import * as gale from './cards/gale.mjs';
import * as sedgekin from './cards/sedgekin.mjs';
import * as gauge from './cards/gauge.mjs';
import * as blackwick from './cards/blackwick.mjs';
import { RETRY } from './card-retry.mjs';

export const FACTIONS = [dominion, choir, gale, sedgekin, gauge, blackwick];
const F = 'mkw16 pixel art, a 16-bit game cutscene, close view, full frame, ';
const end = (s) => (s.trim().endsWith('.') ? s.trim() : s.trim() + '.');
export const JOBS = [];
let n = 0;
for (const f of FACTIONS) {
  for (const c of f.CARDS) {
    const base = 7000 + n++ * 10;
    const retry = RETRY[c.id];
    if (retry?.subject) {
      // the reworded subject gets its own seeds; the first two stay as rendered from the old wording
      JOBS.push({ id: c.id, w: 1024, h: 768, seeds: [base, base + 1], text: F + end(c.subject) });
      JOBS.push({ id: c.id, w: 1024, h: 768, seeds: [base + 2, base + 3, base + 4], text: F + end(retry.subject) });
    } else {
      JOBS.push({ id: c.id, w: 1024, h: 768, seeds: retry ? [base, base + 1, base + 2, base + 3, base + 4] : [base, base + 1], text: F + end(c.subject) });
    }
    if (c.ascendedSubject) JOBS.push({ id: `${c.id}@asc`, w: 1024, h: 768, seeds: [base + 5, base + 6], text: F + end(c.ascendedSubject) });
  }
}
