// Overnight art (PLAN D19): hero portraits (ART-STYLE section 5: 48 x 48, crown to collarbone), the two cards with
// no clean render, and re-renders of cards that drifted to modern-war looks, with a steam-age cue.
import { FACTIONS } from './jobs-cards.mjs';
const T = 'mkw16 pixel art, ';
const P = T + 'a 16-bit game character portrait, head and shoulders, facing the viewer, plain dark background, ';
const C = T + 'a 16-bit game cutscene, close view, full frame, ';
const ERA = ' Steam age, nineteenth-century uniforms and riveted iron, no modern weapons or vehicles.';
const end = (s) => (s.trim().endsWith('.') ? s.trim() : s.trim() + '.');
const seeds = (a, n) => Array.from({ length: n }, (_, i) => a + i);
export const JOBS = [];
let n = 0;
for (const f of FACTIONS) {
  for (const c of f.CARDS.filter((x) => x.kind === 'hero')) {
    const base = 20000 + n++ * 10;
    JOBS.push({ id: `pt-${c.id}`, w: 768, h: 768, seeds: seeds(base, 3), text: P + end(c.subject) });
    if (c.ascendedSubject) JOBS.push({ id: `pt-${c.id}@asc`, w: 768, h: 768, seeds: seeds(base + 5, 3), text: P + end(c.ascendedSubject) });
  }
}
const byId = new Map(FACTIONS.flatMap((f) => f.CARDS.map((c) => [c.id, c])));
// both cards whose every earlier render carried interface lettering: reworded as a still moment, more seeds
JOBS.push({ id: 'ember-meltdowngolem', w: 1024, h: 768, seeds: seeds(21001, 6), text: C + 'a towering effigy of burning wicker and iron bands collapsing inward in a shower of sparks, dusk sky, dust.' });
JOBS.push({ id: 'storm-steepdive', w: 1024, h: 768, seeds: seeds(21011, 6), text: C + 'a patched canvas glider diving steeply over a black steam locomotive on a mountain rail line, smoke trailing, evening sky.' });
// modern-war drift (picked by eye from the card contact sheets)
const DRIFT = ['prism-facet-initiate', 'prism-lens-battery', 'prism-lock-shields', 'prism-steady-aim', 'prism-shieldline-cadet',
  'storm-glidetutor', 'storm-tailrunner', 'storm-closeechelon', 'storm-wingcadet', 'tide-corra'];
DRIFT.forEach((id, i) => JOBS.push({ id, w: 1024, h: 768, seeds: seeds(22000 + i * 10, 4), text: C + end(byId.get(id).subject) + ERA }));
