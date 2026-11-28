// The campaign's heroes (spec 21 R-E2, R-E9, R-E12, R-E13): the six faction leads of docs/WORLD.md, each with a
// hand-built starter deck that feeds its level condition, a reward pool, and the unlocks its rank gives.
import type { FactionId } from '../engine/types';

export interface RunHero {
  id: string;
  faction: FactionId;
  /** One line on how the hero plays, shown on the hero pick. */
  plan: string;
  /** R-E2: 3 copies of the hero, then 21 cards of its faction. */
  starter: Record<string, number>;
  /** R-E12: the hero bundle draws from these. */
  pool: string[];
  /** R-E13: rank 3, rank 5 and rank 8 unlocks. */
  signatureOrder: string;
  signatureFitting: string;
  masteryOrder: string;
}

export const HEROES: RunHero[] = [
  {
    id: 'prism-tamsin', faction: 'prism',
    plan: 'Fields a wall of small soldiers and keeps building them up.',
    starter: {
      'prism-tamsin': 3, 'prism-facet-initiate': 2, 'prism-lampkeeper': 2, 'prism-shield-sergeant': 2, 'prism-lock-shields': 2,
      'prism-rampart-herald': 2, 'prism-chorus-warden': 1, 'prism-sentinel-lens': 2, 'prism-tier-rally': 2, 'prism-crystal-bulwark': 2,
      'prism-tierguard': 2, 'prism-vault-captain': 2,
    },
    pool: [
      'prism-grand-muster', 'prism-lens-battery', 'prism-cohort-drillmaster', 'prism-shoulder-to-shoulder', 'prism-choir-of-facets',
      'prism-muster-bell', 'prism-gilded-phalanx', 'prism-lightwall-matron', 'prism-aegis-colossus', 'prism-call-out', 'prism-crystal-dawn',
      'prism-pane-mender',
    ],
    signatureOrder: 'sig-drill-square', signatureFitting: 'sig-bastion-plate', masteryOrder: 'mst-muster-call',
  },
  {
    id: 'ember-crucible', faction: 'ember',
    plan: 'Floods the Line with sparks and martyrs, then lands a heavy hero.',
    starter: {
      'ember-crucible': 3, 'ember-cinderscamp': 2, 'ember-sparkforge': 2, 'ember-furnacetender': 2, 'ember-sparkgap': 2,
      'ember-sparkcascade': 2, 'ember-kilnhand': 2, 'ember-scrapreclaimer': 1, 'ember-slagbolt': 2, 'ember-arcwelder': 2, 'ember-fuseguard': 2, 'ember-furnacebrute': 2,
    },
    pool: [
      'ember-crucibleherald', 'ember-cinderhail', 'ember-moltenwarden', 'ember-rivethurler', 'ember-blastminer', 'ember-heatlance',
      'ember-ventburst', 'ember-flarebot', 'ember-pitpromoter', 'ember-overpressure', 'ember-firestorm', 'ember-foundrytitan',
    ],
    signatureOrder: 'sig-kindled-sparks', signatureFitting: 'sig-choir-bell', masteryOrder: 'mst-choir-fire',
  },
  {
    id: 'tide-maren', faction: 'tide',
    plan: 'Plays a stream of cheap tactics, freezing and drawing as she goes.',
    starter: {
      'tide-maren': 3, 'tide-wardtender': 2, 'tide-reedmarshheron': 2, 'tide-heldbreath': 2, 'tide-mooringline': 2,
      'tide-lockkeeper': 2, 'tide-stillwaterbailiff': 2, 'tide-pearlsentinel': 2, 'tide-sluicegatebehemoth': 2, 'tide-mirroreel': 2,
      'tide-siltnewt': 2, 'tide-frostmeremagistrate': 1,
    },
    pool: [
      'tide-rifflethestacks', 'tide-backwash', 'tide-unwrite', 'tide-sluiceclose', 'tide-glassarchivist', 'tide-hushwateradept',
      'tide-weirgolem', 'tide-tidemarkreader', 'tide-backflowlancer', 'tide-deepwateroracle', 'tide-ripplescribe',
      'tide-sluicesweep',
    ],
    signatureOrder: 'sig-tide-charts', signatureFitting: 'sig-captains-ward', masteryOrder: 'mst-quick-hands',
  },
  {
    id: 'coil-aruvi', faction: 'coil',
    plan: 'Ramps Charge early to drop big Pierce beasts ahead of the curve.',
    starter: {
      'coil-aruvi': 3, 'coil-sprout-tender': 2, 'coil-rootling': 2, 'coil-sap-engine': 2, 'coil-hothouse-bloom': 1,
      'coil-spearhorn': 2, 'coil-crownmaw': 2, 'coil-tuskhide': 2, 'coil-tusk-challenger': 2, 'coil-canopy-titan': 2, 'coil-thornback-cub': 2, 'coil-spore-herald': 2,
    },
    pool: [
      'coil-behemoth', 'coil-horncrown', 'coil-domewyrm', 'coil-bramblehulk', 'coil-transplant', 'coil-grafting', 'coil-overgrowth',
      'coil-sap-surge', 'coil-verdant-surge', 'coil-ridge-howler', 'coil-canopy-rampage', 'coil-bristle',
    ],
    signatureOrder: 'sig-deep-roots', signatureFitting: 'sig-heartwood', masteryOrder: 'mst-old-growth',
  },
  {
    id: 'storm-jax', faction: 'storm',
    plan: 'Races in with fast flyers and Vanguard couriers to hit the Crystal early.',
    starter: {
      'storm-jax': 3, 'storm-tickettaker': 2, 'storm-flagbearer': 2, 'storm-signalkite': 2, 'storm-railglider': 2,
      'storm-tailwind': 2, 'storm-skirmishkite': 2, 'storm-galecourier': 2, 'storm-sparkrider': 2, 'storm-galesurge': 1, 'storm-veteranrunner': 2, 'storm-tailrunner': 2,
    },
    pool: [
      'storm-thunderkite', 'storm-reroute', 'storm-mastlookout', 'storm-gyrekite', 'storm-closeechelon', 'storm-breakneck',
      'storm-skyraid', 'storm-tempestliner', 'storm-railmarshal', 'storm-dispatcher', 'storm-updraft', 'storm-doubledeparture',
    ],
    signatureOrder: 'sig-tailwind-orders', signatureFitting: 'sig-racing-harness', masteryOrder: 'mst-first-blood',
  },
  {
    id: 'under-penn', faction: 'under',
    plan: 'Bleeds the enemy Crystal a point at a time with tactics and drains.',
    starter: {
      'under-penn': 3, 'under-skimtop': 2, 'under-skimclerk': 2, 'under-fuserunner': 2, 'under-siphontap': 2,
      'under-bagman': 2, 'under-leechwiresurgeon': 2, 'under-protectionfee': 2, 'under-kneecapper': 2, 'under-tollrat': 1, 'under-backalleyenforcer': 2, 'under-interestcollector': 2,
    },
    pool: [
      'under-bleeddry', 'under-streettax', 'under-foreclosure', 'under-noticeserver', 'under-debtassessor', 'under-snuffedfuse',
      'under-chainoverload', 'under-taplinecolossus', 'under-vaultpawnbroker', 'under-leechoverseer', 'under-hostiletakeover',
      'under-grudgekeeper',
    ],
    signatureOrder: 'sig-ledger-ink', signatureFitting: 'sig-ledger-seal', masteryOrder: 'mst-bleed-ledger',
  },
];

export function hero(id: string): RunHero {
  const h = HEROES.find((x) => x.id === id);
  if (!h) throw new Error(`run: no hero ${id}`);
  return h;
}

/** R-E2: the starter as a card list, hero copies first. */
export function starterList(h: RunHero): string[] {
  return Object.entries(h.starter).flatMap(([id, n]) => Array<string>(n).fill(id));
}

// ---------- rank (R-E13) ----------
/** XP needed for ranks 1 to 8. */
export const RANK_XP = [0, 30, 80, 150, 250, 380, 540, 750];
export const MAX_RANK = RANK_XP.length;
export const XP = { battle: 10, elite: 20, boss: 40, perStar: 30 } as const;

export function rankOf(xp: number): number {
  let r = 1;
  for (let i = 0; i < RANK_XP.length; i++) if (xp >= RANK_XP[i]) r = i + 1;
  return r;
}

/** What each rank unlocks, in the words the hero screen prints. */
export function rankUnlock(h: RunHero, rank: number, names: { order: (id: string) => string; fitting: (id: string) => string }): string {
  switch (rank) {
    case 1: return 'Starter deck';
    case 2: return 'Start every run with 15 scrip';
    case 3: return `Signature Order: ${names.order(h.signatureOrder)}`;
    case 4: return 'Rest stops repair 3 more';
    case 5: return `Signature Fitting on the hero: ${names.fitting(h.signatureFitting)}`;
    case 6: return 'Start with one more common Order, at random';
    case 7: return 'Won battles repair 2 more';
    case 8: return `Mastery Order: ${names.order(h.masteryOrder)}`;
    default: throw new Error(`run: no rank ${rank}`);
  }
}

export const RANK_SCRIP = 15;
export const RANK_REST = 3;
export const RANK_FIELD = 2;
