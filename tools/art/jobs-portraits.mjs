// Hero portraits (ART-STYLE section 5: 48 x 48, crown to collarbone). The card subjects describe whole scenes, which
// rendered as small full figures; here only the appearance part of each subject is kept (text before its first comma
// or pose word) and the frame is a close-up.
import { FACTIONS } from './jobs-cards.mjs';
const P = 'mkw16 pixel art, a 16-bit game character portrait, close-up of the face, head and shoulders filling the frame, plain dark background, ';
const STOP = /,|\b(standing|holding|kneeling|sitting|walking|riding|beside|among|leaning|raising|reaching|pointing|in front of|on a|on an|at the|above|below|over a)\b/i;
// Faces whose card subject is all pose (the cut left a full figure); written out by hand.
const FACE = {
  'coil-nyra': 'Lean bark-skinned huntress with reed-woven hair and a calm, watchful face',
  'under-marrow': 'Broad-shouldered collector with a heavy jaw and short dark hair, the high collar of a soot-black greatcoat',
  'coil-brakk': 'Head of a huge moss-backed elk bull with wide antlers, facing the viewer',
};
export function appearance(subject) {
  const cut = subject.split(STOP)[0].trim().replace(/\.$/, '');
  return cut.split(/\s+/).slice(0, 16).join(' ');
}
export const JOBS = [];
let n = 0;
for (const f of FACTIONS) {
  for (const c of f.CARDS.filter((x) => x.kind === 'hero')) {
    const base = 23000 + n++ * 10;
    const face = FACE[c.id];
    if (face) {
      JOBS.push({ id: `pt-${c.id}`, w: 768, h: 768, seeds: [base + 300, base + 301], text: `${P}${face}.` });
      if (c.ascendedSubject) JOBS.push({ id: `pt-${c.id}@asc`, w: 768, h: 768, seeds: [base + 305, base + 306], text: `${P}${face}, eyes glowing teal, a faint teal aura of power.` });
      continue;
    }
    JOBS.push({ id: `pt-${c.id}`, w: 768, h: 768, seeds: [base, base + 1], text: `${P}${appearance(c.subject)}.` });
    // the ascended face: the same person, lit by gloam (their ascended scene descriptions cut down to too little)
    if (c.ascendedSubject) JOBS.push({ id: `pt-${c.id}@asc`, w: 768, h: 768, seeds: [base + 5, base + 6], text: `${P}${appearance(c.subject)}, eyes glowing teal, a faint teal aura of power.` });
  }
}
