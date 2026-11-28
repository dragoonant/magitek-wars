// Sedgekin (faction id 'coil'): the peat marshes of green glass root. Big beasts, extra Charge, Mend, Pierce.
import type { CardDef } from '../../engine/types';

export const coil: CardDef[] = [
  {
    id: 'coil-aruvi', name: 'Speaker Ulla', faction: 'coil', type: 'hero', cost: 4, power: 3, health: 5,
    keywords: ['mend'], tribe: 'warden',
    text: 'Mend. When you summon another ally with 5+ power, it gets +1|+1.',
    abilities: [{ on: 'allySummoned', ops: [{ op: 'buff', to: { from: 'trigger', filter: { minPower: 5 } }, power: 1, health: 1 }] }],
    level: { who: 'you', stat: 'bigSummoned', n: 3, text: "You've summoned 3+ units with 5+ power" },
    ascended: {
      name: 'Ulla, Voice of the Root', power: 4, health: 6, keywords: ['mend'],
      text: 'Mend. Allies with 5+ power have Pierce. Ascend: give every ally +2|+2.',
      auras: [{ to: 'allies', filter: { minPower: 5 }, kw: ['pierce'] }],
      abilities: [{ on: 'ascend', ops: [{ op: 'buff', to: 'allies', power: 2, health: 2 }] }],
    },
  },
  {
    id: 'coil-brakk', name: 'Hoarhorn, the Old Bull', faction: 'coil', type: 'hero', cost: 6, power: 6, health: 6,
    keywords: ['pierce'], tribe: 'beast',
    text: 'Pierce.',
    level: { who: 'self', stat: 'damageDealt', n: 10, text: "I've dealt 10+ damage" },
    ascended: {
      name: 'Hoarhorn Unbowed', power: 8, health: 8, keywords: ['pierce', 'mend'],
      text: 'Pierce, Mend. Strike: I get +1|+1. Ascend: you get one extra attack: you may attack again this round, banked until used.',
      abilities: [
        { on: 'strike', ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] },
        { on: 'ascend', ops: [{ op: 'rally' }] },
      ],
    },
  },
  // ---------- units ----------
  {
    id: 'coil-sprout-tender', name: 'Dawn Tender', faction: 'coil', type: 'unit', cost: 1, power: 0, health: 2,
    tribe: 'gardener', text: 'Dawn: gain 1 Charge.',
    abilities: [{ on: 'dawn', ops: [{ op: 'charge', n: 1 }] }],
  },
  {
    id: 'coil-thornback-cub', name: 'Mossback Calf', faction: 'coil', type: 'unit', cost: 1, power: 1, health: 2,
    keywords: ['mend'], tribe: 'beast', text: 'Mend.',
  },
  {
    id: 'coil-rootling', name: 'Seep Sprout', faction: 'coil', type: 'unit', cost: 1, power: 1, health: 1,
    tribe: 'machine', text: 'Deploy: raise your maximum Charge by 1.',
    abilities: [{ on: 'deploy', ops: [{ op: 'maxCharge', n: 1 }] }],
  },
  {
    id: 'coil-spearhorn', name: 'Spearbill Wader', faction: 'coil', type: 'unit', cost: 2, power: 2, health: 2,
    keywords: ['pierce'], tribe: 'beast', text: 'Pierce.',
  },
  {
    id: 'coil-vinewhip', name: 'Ambush Eel', faction: 'coil', type: 'unit', cost: 2, power: 2, health: 1,
    tribe: 'beast', text: 'Deploy: I strike an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'strike', from: 'self', to: 'target0' }] }],
  },
  {
    id: 'coil-sap-engine', name: 'Root Tap', faction: 'coil', type: 'unit', cost: 2, power: 1, health: 2,
    tribe: 'machine', text: 'Deploy: gain 2 Charge.',
    abilities: [{ on: 'deploy', ops: [{ op: 'charge', n: 2 }] }],
  },
  {
    id: 'coil-crownmaw', name: 'Chorus Toad', faction: 'coil', type: 'unit', cost: 3, power: 3, health: 3,
    tribe: 'beast', text: 'I have +2|+0 while you control 2 or more other allies.',
    auras: [{ to: 'self', power: 2, cond: { c: 'count', of: 'otherAllies', gte: 2 } }],
  },
  {
    id: 'coil-bloomcaller', name: 'Reed Piper', faction: 'coil', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'gardener', text: 'Dawn: give another random ally +1|+0.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: 'randomAlly', power: 1 }] }],
  },
  {
    id: 'coil-lashvine', name: 'Snapjaw', faction: 'coil', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'beast', text: 'Assault: I strike the weakest enemy (lowest power).',
    abilities: [{ on: 'assault', ops: [{ op: 'strike', from: 'self', to: 'weakestEnemy' }] }],
  },
  {
    id: 'coil-tuskhide', name: 'Glasstusk Boar', faction: 'coil', type: 'unit', cost: 4, power: 5, health: 3,
    keywords: ['pierce'], tribe: 'beast', text: 'Pierce. Resonant: I have +0|+2.',
    auras: [{ to: 'self', health: 2, cond: { c: 'resonant' } }],
  },
  {
    id: 'coil-spore-herald', name: 'Spore Caller', faction: 'coil', type: 'unit', cost: 4, power: 3, health: 4,
    tribe: 'gardener', text: 'Deploy: give every other ally +1|+1.',
    abilities: [{ on: 'deploy', ops: [{ op: 'buff', to: 'otherAllies', power: 1, health: 1 }] }],
  },
  {
    id: 'coil-canopy-titan', name: 'Rootback Hulk', faction: 'coil', type: 'unit', cost: 5, power: 5, health: 5,
    keywords: ['pierce', 'mend'], tribe: 'beast', text: 'Pierce, Mend.',
  },
  {
    id: 'coil-behemoth', name: 'Copper-Bound Hulk', faction: 'coil', type: 'unit', cost: 6, power: 5, health: 5,
    keywords: ['pierce'], tribe: 'machine', text: 'Pierce. Deploy: I strike an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'strike', from: 'self', to: 'target0' }] }],
  },
  {
    id: 'coil-domewyrm', name: 'Elder Mire-Eel', faction: 'coil', type: 'unit', cost: 7, power: 8, health: 7,
    keywords: ['pierce', 'mend'], tribe: 'beast', text: 'Pierce, Mend.',
  },
  // ---------- tactics (type 'glyph') ----------
  {
    id: 'coil-sap-surge', name: 'Crystal Spring', faction: 'coil', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Gain 2 Charge.', ops: [{ op: 'charge', n: 2 }],
  },
  {
    id: 'coil-bristle', name: 'Raised Hackles', faction: 'coil', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Give an ally +3|+0 this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 3, dur: 'round' }],
  },
  {
    id: 'coil-overgrowth', name: 'Sudden Growth', faction: 'coil', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Give an ally +3|+3 and Pierce this round.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'buff', to: 'target0', power: 3, health: 3, dur: 'round' }, { op: 'grant', to: 'target0', kw: ['pierce'], dur: 'round' }],
  },
  {
    id: 'coil-duel-of-thorns', name: 'Locked Antlers', faction: 'coil', type: 'glyph', cost: 2, speed: 'swift',
    text: 'An ally and an enemy unit strike each other.', needsAllTargets: true,
    targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
    ops: [{ op: 'duel', a: 'target0', b: 'target1' }],
  },
  {
    id: 'coil-lash-out', name: 'Tongue Lash', faction: 'coil', type: 'glyph', cost: 3, speed: 'swift',
    text: 'An ally strikes an enemy unit.', needsAllTargets: true,
    targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
    ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
  },
  {
    id: 'coil-grafting', name: 'Root Graft', faction: 'coil', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Give an ally +2|+2 and Mend.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'buff', to: 'target0', power: 2, health: 2 }, { op: 'grant', to: 'target0', kw: ['mend'] }],
  },
  {
    id: 'coil-canopy-rampage', name: 'Mire Stampede', faction: 'coil', type: 'glyph', cost: 5, speed: 'swift',
    text: 'Each ally with 4+ power strikes the strongest enemy (highest power), picked once when this resolves.',
    ops: [{ op: 'strike', from: { from: 'allies', filter: { minPower: 4 } }, to: 'strongestEnemy' }],
  },
  {
    id: 'coil-hothouse-bloom', name: 'Root Swell', faction: 'coil', type: 'glyph', cost: 2, speed: 'ritual',
    text: 'Raise your maximum Charge by 1 and gain 1 Reserve. Resonant: raise your maximum Charge by 1 more.',
    ops: [
      { op: 'maxCharge', n: 1 }, { op: 'reserve', n: 1 },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'maxCharge', n: 1 }] },
    ],
  },
  {
    id: 'coil-verdant-surge', name: 'The Mere Wakes', faction: 'coil', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Give every ally +3|+3.',
    ops: [{ op: 'buff', to: 'allies', power: 3, health: 3 }],
  },

  // ========== First Light additions (docs/SETS.md): seed-sower (Oda) and pack hunter (Sefa) ==========
  // ---------- tokens ----------
  {
    id: 'coil-sapling', name: 'Glass Sapling', faction: 'coil', type: 'unit', cost: 1, power: 0, health: 1, token: true,
    tribe: 'plant', text: 'Dawn: if I have 2 or less power, I get +1|+1.',
    // grows 0|1 -> 1|2 -> 2|3 -> 3|4, then stops (the cap reads printed stats and buffs, not auras)
    abilities: [{ on: 'dawn', cond: { c: 'count', of: { from: 'self', filter: { maxPower: 2 } }, gte: 1 }, ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] }],
  },
  {
    id: 'coil-thornwood', name: 'Glasswood', faction: 'coil', type: 'unit', cost: 5, power: 5, health: 5, token: true,
    tribe: 'plant', text: '',
  },
  {
    id: 'coil-packwolf', name: 'Reed-Hound', faction: 'coil', type: 'unit', cost: 2, power: 2, health: 1, token: true,
    tribe: 'beast', text: '',
  },
  // ---------- heroes ----------
  {
    id: 'coil-halcy', name: 'Oda, Seed-Sower', faction: 'coil', type: 'hero', cost: 3, power: 1, health: 3,
    tribe: 'gardener',
    text: 'Deploy: summon a Glass Sapling. Dusk: summon a Glass Sapling.',
    abilities: [
      { on: 'deploy', ops: [{ op: 'summon', card: 'coil-sapling' }] },
      { on: 'dusk', ops: [{ op: 'summon', card: 'coil-sapling' }] },
    ],
    level: { who: 'you', stat: 'tokensSummoned', n: 7, text: "You've summoned 7+ tokens" },
    ascended: {
      name: 'Oda of the Seedbeds', power: 2, health: 5,
      text: 'Dusk: summon a Glass Sapling. Your Glass Saplings have +1|+1. Ascend: summon two Glass Saplings, then give every allied Glass Sapling +2|+2.',
      auras: [{ to: 'allies', filter: { card: 'coil-sapling' }, power: 1, health: 1 }],
      abilities: [
        { on: 'dusk', ops: [{ op: 'summon', card: 'coil-sapling' }] },
        {
          on: 'ascend',
          ops: [
            { op: 'summon', card: 'coil-sapling', n: 2 },
            { op: 'buff', to: { from: 'allies', filter: { card: 'coil-sapling' } }, power: 2, health: 2 },
          ],
        },
      ],
    },
  },
  {
    id: 'coil-nyra', name: 'Sefa Reedwhistle', faction: 'coil', type: 'hero', cost: 4, power: 3, health: 4,
    tribe: 'warden',
    text: 'When an enemy unit is destroyed, I get +1|+0.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'buff', to: 'self', power: 1 }] }],
    level: { who: 'you', stat: 'enemiesDied', n: 6, text: '6+ enemy units have been destroyed' },
    ascended: {
      name: 'Sefa, Pack-Mother', power: 5, health: 5, keywords: ['pierce'],
      text: 'Pierce. When an enemy unit is destroyed, every ally gets +1|+0 this round. Ascend: summon two Reed-Hounds, then give every ally +1|+1.',
      abilities: [
        { on: 'enemyDied', ops: [{ op: 'buff', to: 'allies', power: 1, dur: 'round' }] },
        {
          on: 'ascend',
          ops: [{ op: 'summon', card: 'coil-packwolf', n: 2 }, { op: 'buff', to: 'allies', power: 1, health: 1 }],
        },
      ],
    },
  },
  // ---------- units ----------
  {
    id: 'coil-furrow-hand', name: 'Peat Planter', faction: 'coil', type: 'unit', cost: 1, power: 1, health: 1,
    tribe: 'gardener', text: 'Deploy: summon a Glass Sapling.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'coil-sapling' }] }],
  },
  {
    id: 'coil-thicket-jackal', name: 'Blood-Scent Fox', faction: 'coil', type: 'unit', cost: 1, power: 1, health: 1,
    tribe: 'beast', text: 'Assault: if an enemy unit was destroyed this round, I get +2|+0 this round.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'enemiesDied', gte: 1 }, ops: [{ op: 'buff', to: 'self', power: 2, dur: 'round' }] }],
  },
  {
    id: 'coil-carrion-beetle', name: 'Peat Beetle', faction: 'coil', type: 'unit', cost: 1, power: 0, health: 2,
    tribe: 'beast', text: 'When an enemy unit is destroyed, gain 1 Charge.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'charge', n: 1 }] }],
  },
  {
    id: 'coil-seed-drill', name: 'Seedback Toad', faction: 'coil', type: 'unit', cost: 2, power: 1, health: 3,
    tribe: 'machine', text: 'Assault: summon a Glass Sapling.',
    abilities: [{ on: 'assault', ops: [{ op: 'summon', card: 'coil-sapling' }] }],
  },
  {
    id: 'coil-ridgeback', name: 'Reed Lynx', faction: 'coil', type: 'unit', cost: 2, power: 2, health: 2,
    tribe: 'beast', text: 'Strike: if an enemy unit was destroyed this round, I get +1|+1.',
    abilities: [{ on: 'strike', cond: { c: 'seenRound', stat: 'enemiesDied', gte: 1 }, ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] }],
  },
  {
    id: 'coil-snare-trapper', name: 'Reed Trapper', faction: 'coil', type: 'unit', cost: 2, power: 2, health: 1,
    tribe: 'gardener', text: 'Deploy: deal 1 to an enemy unit. Resonant: deal 2 instead.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }],
      ops: [{ op: 'if', cond: { c: 'resonant' }, then: [{ op: 'damage', to: 'target0', n: 2 }], else: [{ op: 'damage', to: 'target0', n: 1 }] }],
    }],
  },
  {
    id: 'coil-grove-keeper', name: 'Seedbed Warden', faction: 'coil', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'gardener', text: 'When another ally is summoned, if it is a Glass Sapling, it gets +1|+1.',
    abilities: [{ on: 'allySummoned', ops: [{ op: 'buff', to: { from: 'trigger', filter: { card: 'coil-sapling' } }, power: 1, health: 1 }] }],
  },
  {
    id: 'coil-tusk-challenger', name: 'Bellowing Stag', faction: 'coil', type: 'unit', cost: 3, power: 3, health: 4,
    tribe: 'beast', text: 'Deploy: I and an enemy unit strike each other.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'duel', a: 'self', b: 'target0' }] }],
  },
  {
    id: 'coil-bloodtrail', name: 'Mire Stalker', faction: 'coil', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'beast', text: 'When an enemy unit is destroyed, I strike a random enemy unit.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'strike', from: 'self', to: 'randomEnemy' }] }],
  },
  {
    id: 'coil-ridge-howler', name: 'Pack Howler', faction: 'coil', type: 'unit', cost: 4, power: 3, health: 3,
    tribe: 'beast', text: 'When an enemy unit is destroyed, summon a Reed-Hound.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'summon', card: 'coil-packwolf' }] }],
  },
  {
    id: 'coil-seed-thresher', name: 'Pod Hulk', faction: 'coil', type: 'unit', cost: 4, power: 3, health: 4,
    tribe: 'machine', text: 'Deploy: summon a Glass Sapling for each enemy unit (at most 3).',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'coil-sapling', n: { count: 'enemies', max: 3 } }] }],
  },
  {
    id: 'coil-horncrown', name: 'Glasshorn Matriarch', faction: 'coil', type: 'unit', cost: 5, power: 5, health: 5,
    tribe: 'beast', text: 'Assault: I and the strongest enemy (highest power) strike each other. Resonant: I have Pierce.',
    abilities: [{ on: 'assault', ops: [{ op: 'duel', a: 'self', b: 'strongestEnemy' }] }],
    auras: [{ to: 'self', kw: ['pierce'], cond: { c: 'resonant' } }],
  },
  {
    id: 'coil-bloomwood-shepherd', name: 'Sapling Shepherd', faction: 'coil', type: 'unit', cost: 6, power: 4, health: 6,
    tribe: 'gardener', text: 'Deploy: summon two Glass Saplings. Your Glass Saplings have +2|+0.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'coil-sapling', n: 2 }] }],
    auras: [{ to: 'otherAllies', filter: { card: 'coil-sapling' }, power: 2 }],
  },
  {
    id: 'coil-bramblehulk', name: 'Grandmother Toad', faction: 'coil', type: 'unit', cost: 7, power: 5, health: 5,
    keywords: ['pierce'], tribe: 'beast', text: 'Pierce. Deploy: I get +1|+1 for each other ally.',
    abilities: [{ on: 'deploy', ops: [{ op: 'buff', to: 'self', power: { count: 'otherAllies', mul: 1 }, health: { count: 'otherAllies', mul: 1 } }] }],
  },
  // ---------- tactics (type 'glyph') ----------
  {
    id: 'coil-snaring-vine', name: 'Grasping Roots', faction: 'coil', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Give an enemy unit -2|+0 this round.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'buff', to: 'target0', power: -2, dur: 'round' }],
  },
  {
    id: 'coil-quickening-rain', name: 'Crystal Rain', faction: 'coil', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Give every allied Glass Sapling +1|+1. Resonant: give them +1|+1 more.',
    ops: [
      { op: 'buff', to: { from: 'allies', filter: { card: 'coil-sapling' } }, power: 1, health: 1 },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'buff', to: { from: 'allies', filter: { card: 'coil-sapling' } }, power: 1, health: 1 }] },
    ],
  },
  {
    id: 'coil-scent-of-blood', name: 'Blood on the Mist', faction: 'coil', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Give every ally +1|+0 this round. If an enemy unit was destroyed this round, give every ally +1|+1 more this round.',
    ops: [
      { op: 'buff', to: 'allies', power: 1, dur: 'round' },
      { op: 'if', cond: { c: 'seenRound', stat: 'enemiesDied', gte: 1 }, then: [{ op: 'buff', to: 'allies', power: 1, health: 1, dur: 'round' }] },
    ],
  },
  {
    id: 'coil-compost-heap', name: 'Back to the Peat', faction: 'coil', type: 'glyph', cost: 1, speed: 'swift',
    text: 'Destroy an allied Glass Sapling and gain 3 Charge.',
    targets: [{ what: 'unit', side: 'ally', filter: { card: 'coil-sapling' } }],
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'charge', n: 3 }],
  },
  {
    id: 'coil-run-down', name: 'Run to Ground', faction: 'coil', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Each ally strikes a damaged enemy unit.',
    targets: [{ what: 'unit', side: 'enemy', filter: { damaged: true } }],
    ops: [{ op: 'strike', from: 'allies', to: 'target0' }],
  },
  {
    id: 'coil-thorn-volley', name: 'Glass Thorns', faction: 'coil', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Each allied Glass Sapling strikes an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'strike', from: { from: 'allies', filter: { card: 'coil-sapling' } }, to: 'target0' }],
  },
  {
    id: 'coil-transplant', name: 'Take Root', faction: 'coil', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Destroy an allied Glass Sapling and summon a Glasswood (5|5).',
    targets: [{ what: 'unit', side: 'ally', filter: { card: 'coil-sapling' } }],
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'summon', card: 'coil-thornwood' }],
  },
  {
    id: 'coil-cull-the-wounded', name: 'Cull the Lame', faction: 'coil', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Your strongest ally (highest power) strikes every damaged enemy unit.',
    ops: [{ op: 'strike', from: 'strongestAlly', to: { from: 'enemies', filter: { damaged: true } } }],
  },
  {
    id: 'coil-sow-the-rooftops', name: 'Sow the Mere', faction: 'coil', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Summon three Glass Saplings, then give every allied Glass Sapling +1|+1.',
    ops: [
      { op: 'summon', card: 'coil-sapling', n: 3 },
      { op: 'buff', to: { from: 'allies', filter: { card: 'coil-sapling' } }, power: 1, health: 1 },
    ],
  },
];
