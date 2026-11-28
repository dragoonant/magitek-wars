// The Order catalog (spec 21 R-E7, engine R-X6): powers that last the whole run. Every Order prints everything it does.
// Run-level Orders (`run`) change the march itself rather than the battles; the engine never sees them.
import type { Order } from '../engine/types';

export type Rarity = 'common' | 'rare' | 'signature' | 'foe';

export interface RunOrder extends Order {
  rarity: Rarity;
  /** Changes to the march itself (R-E7), read by src/expedition/run.ts. */
  run?: { battleScrip?: number; fieldRepair?: number };
}

const hero = { from: 'allies', filter: { hero: true } } as const;

export const ORDERS: RunOrder[] = [
  // ---------- common ----------
  { id: 'forward-drill', name: 'Forward Drill', rarity: 'common', text: 'Start of battle: draw 1.',
    abilities: [{ on: 'start', ops: [{ op: 'draw', n: 1 }] }] },
  { id: 'spare-cells', name: 'Spare Cells', rarity: 'common', text: 'Start of battle: gain 2 Reserve.',
    abilities: [{ on: 'start', ops: [{ op: 'reserve', n: 2 }] }] },
  { id: 'riveted-plates', name: 'Riveted Plates', rarity: 'common', text: 'Your units have +0|+1.',
    auras: [{ to: 'allies', health: 1 }] },
  { id: 'iron-discipline', name: 'Iron Discipline', rarity: 'common', text: 'Your units with 2 or less power have +1|+0.',
    auras: [{ to: 'allies', filter: { maxPower: 2 }, power: 1 }] },
  { id: 'heros-banner', name: "Hero's Banner", rarity: 'common', text: 'Your heroes have +1|+1.',
    auras: [{ to: 'allies', filter: { hero: true }, power: 1, health: 1 }] },
  { id: 'second-wind', name: 'Second Wind', rarity: 'common', text: 'Dusk: repair every ally by 1.',
    abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'allies', n: 1 }] }] },
  { id: 'quick-muster', name: 'Quick Muster', rarity: 'common', text: 'Start of battle: summon a 1|1 Conscript.',
    abilities: [{ on: 'start', ops: [{ op: 'summon', card: 'prism-tier-recruit' }] }] },
  { id: 'war-chest', name: 'War Chest', rarity: 'common', text: 'Every won battle gives 8 more scrip.', run: { battleScrip: 8 } },
  { id: 'field-surgeons', name: 'Field Surgeons', rarity: 'common', text: 'Every won battle repairs your Crystal by 2 more.', run: { fieldRepair: 2 } },
  { id: 'opening-volley', name: 'Opening Volley', rarity: 'common', text: 'Start of battle: deal 2 to the enemy Crystal.',
    abilities: [{ on: 'start', ops: [{ op: 'damage', to: 'enemySpire', n: 2 }] }] },
  // ---------- rare ----------
  { id: 'overcharged-cells', name: 'Overcharged Cells', rarity: 'rare', text: 'Start of battle: raise your maximum Charge by 1.',
    abilities: [{ on: 'start', ops: [{ op: 'maxCharge', n: 1 }, { op: 'charge', n: 1 }] }] },
  { id: 'drilled-crews', name: 'Drilled Crews', rarity: 'rare', text: 'Your tactics cost 1 less.',
    costAuras: [{ type: 'glyph', n: -1 }] },
  { id: 'veteran-cadre', name: 'Veteran Cadre', rarity: 'rare', text: 'While you have 3 or more units, your units have +1|+0.',
    auras: [{ to: 'allies', power: 1, cond: { c: 'count', of: 'allies', gte: 3 } }] },
  { id: 'crystal-tap', name: 'Crystal Tap', rarity: 'rare', text: 'Dusk: if your Crystal is 10 or less, repair it by 1.',
    abilities: [{ on: 'dusk', cond: { c: 'spire', who: 'you', lte: 10 }, ops: [{ op: 'heal', to: 'mySpire', n: 1 }] }] },
  { id: 'hero-guard', name: 'Hero Guard', rarity: 'rare', text: 'Dawn: give your heroes +1|+0 this round.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: hero, power: 1, dur: 'round' }] }] },
  { id: 'sapper-teams', name: 'Sapper Teams', rarity: 'rare', text: 'Dawn: deal 1 to the strongest enemy unit.',
    abilities: [{ on: 'dawn', ops: [{ op: 'damage', to: 'strongestEnemy', n: 1 }] }] },

  // ---------- hero signature and mastery Orders (R-E13 ranks 3 and 8) ----------
  { id: 'sig-drill-square', name: 'Drill Square', rarity: 'signature', text: 'Your units with 2 or less power have +0|+1.',
    auras: [{ to: 'allies', filter: { maxPower: 2 }, health: 1 }] },
  { id: 'mst-muster-call', name: 'Muster Call', rarity: 'signature', text: 'Start of battle: summon two 1|1 Conscripts.',
    abilities: [{ on: 'start', ops: [{ op: 'summon', card: 'prism-tier-recruit', n: 2 }] }] },
  { id: 'sig-kindled-sparks', name: 'Kindled Sparks', rarity: 'signature', text: 'Start of battle: summon a Votive Spark.',
    abilities: [{ on: 'start', ops: [{ op: 'summon', card: 'ember-sparkbot' }] }] },
  { id: 'mst-choir-fire', name: 'Choir Fire', rarity: 'signature', text: 'Start of battle: raise your maximum Charge by 1.',
    abilities: [{ on: 'start', ops: [{ op: 'maxCharge', n: 1 }, { op: 'charge', n: 1 }] }] },
  { id: 'sig-tide-charts', name: 'Tide Charts', rarity: 'signature', text: 'Start of battle: draw 1.',
    abilities: [{ on: 'start', ops: [{ op: 'draw', n: 1 }] }] },
  { id: 'mst-quick-hands', name: 'Quick Hands', rarity: 'signature', text: 'Your tactics cost 1 less.',
    costAuras: [{ type: 'glyph', n: -1 }] },
  { id: 'sig-deep-roots', name: 'Deep Roots', rarity: 'signature', text: 'Start of battle: raise your maximum Charge by 1.',
    abilities: [{ on: 'start', ops: [{ op: 'maxCharge', n: 1 }, { op: 'charge', n: 1 }] }] },
  { id: 'mst-old-growth', name: 'Old Growth', rarity: 'signature', text: 'Your units with 5 or more power have +1|+1.',
    auras: [{ to: 'allies', filter: { minPower: 5 }, power: 1, health: 1 }] },
  { id: 'sig-tailwind-orders', name: 'Tailwind Orders', rarity: 'signature', text: 'Your units with Vanguard have +1|+0.',
    auras: [{ to: 'allies', filter: { kw: 'vanguard' }, power: 1 }] },
  { id: 'mst-first-blood', name: 'First Blood', rarity: 'signature', text: 'Start of battle: deal 3 to the enemy Crystal.',
    abilities: [{ on: 'start', ops: [{ op: 'damage', to: 'enemySpire', n: 3 }] }] },
  { id: 'sig-ledger-ink', name: 'Ledger Ink', rarity: 'signature', text: 'Start of battle: gain 2 Reserve.',
    abilities: [{ on: 'start', ops: [{ op: 'reserve', n: 2 }] }] },
  { id: 'mst-bleed-ledger', name: 'Bleed Ledger', rarity: 'signature', text: 'Start of battle: drain 3 from the enemy Crystal.',
    abilities: [{ on: 'start', ops: [{ op: 'drain', to: 'enemySpire', n: 3 }] }] },

  // ---------- foe Orders (bosses and elites, R-E6) ----------
  { id: 'foe-banner', name: "Warlord's Banner", rarity: 'foe', text: 'Your units have +1|+0.',
    auras: [{ to: 'allies', power: 1 }] },
  { id: 'foe-bulwark', name: 'Bulwark Drill', rarity: 'foe', text: 'Your units have +0|+1.',
    auras: [{ to: 'allies', health: 1 }] },
  { id: 'foe-council', name: 'War Council', rarity: 'foe', text: 'Start of battle: draw 2.',
    abilities: [{ on: 'start', ops: [{ op: 'draw', n: 2 }] }] },
  { id: 'foe-mend', name: 'Crystal Menders', rarity: 'foe', text: 'Dusk: repair your Crystal by 1.',
    abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'mySpire', n: 1 }] }] },
  { id: 'foe-rush', name: 'Forced March', rarity: 'foe', text: 'Start of battle: raise your maximum Charge by 1.',
    abilities: [{ on: 'start', ops: [{ op: 'maxCharge', n: 1 }, { op: 'charge', n: 1 }] }] },
  { id: 'foe-shelling', name: 'Long Guns', rarity: 'foe', text: 'Dusk: deal 1 to the enemy Crystal.',
    abilities: [{ on: 'dusk', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }] },
  { id: 'foe-champions', name: 'Chosen Champions', rarity: 'foe', text: 'Your heroes have +2|+2.',
    auras: [{ to: 'allies', filter: { hero: true }, power: 2, health: 2 }] },
];

export function order(id: string): RunOrder {
  const o = ORDERS.find((x) => x.id === id);
  if (!o) throw new Error(`run: no order ${id}`);
  return o;
}

/** Orders the march can offer (R-E7): common and rare, never signature or foe Orders. */
export const OFFERABLE = ORDERS.filter((o) => o.rarity === 'common' || o.rarity === 'rare').map((o) => o.id);
