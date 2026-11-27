// Hero portraits (ART-STYLE section 5: 48 x 48, crown to collarbone). The card subjects describe whole scenes, which
// rendered as small full figures; here only the appearance part of each subject is kept (text before its first comma
// or pose word) and the frame is a close-up.
import { FACTIONS } from './jobs-cards.mjs';
const P = 'mkw16 pixel art, a 16-bit game character portrait, close-up of the face, head and shoulders filling the frame, plain dark background, ';
const STOP = /,|\b(standing|holding|kneeling|sitting|walking|riding|beside|among|leaning|raising|reaching|pointing|in front of|on a|on an|at the|above|below|over a)\b/i;
export function appearance(subject) {
  const cut = subject.split(STOP)[0].trim().replace(/\.$/, '');
  return cut.split(/\s+/).slice(0, 16).join(' ');
}
export const JOBS = [];
let n = 0;
for (const f of FACTIONS) {
  for (const c of f.CARDS.filter((x) => x.kind === 'hero')) {
    const base = 23000 + n++ * 10;
    JOBS.push({ id: `pt-${c.id}`, w: 768, h: 768, seeds: [base, base + 1], text: `${P}${appearance(c.subject)}.` });
    // the ascended face: the same person, lit by gloam (their ascended scene descriptions cut down to too little)
    if (c.ascendedSubject) JOBS.push({ id: `pt-${c.id}@asc`, w: 768, h: 768, seeds: [base + 5, base + 6], text: `${P}${appearance(c.subject)}, eyes glowing teal, a faint teal aura of power.` });
  }
}
