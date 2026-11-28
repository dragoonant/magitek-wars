// Ashen Choir (faction id `ember`, PLAN D12): censers, wicker effigies and willing pyres. Direct damage, Unstable effigies, Vanguard.
import type { CardDef } from '../../engine/types';

export const ember: CardDef[] = [
  {
    id: 'ember-kessa', name: 'Sister Maren, Kindler', faction: 'ember', type: 'hero', cost: 2, power: 2, health: 3,
    tribe: 'artificer',
    text: 'Deploy: deal 1 to an enemy unit or the enemy Crystal.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unitOrSpire', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }] }],
    level: { who: 'you', stat: 'glyphDamage', n: 8, text: 'Your tactics and abilities have dealt 8+ damage' },
    ascended: {
      name: 'Maren, the Lit Wick', power: 3, health: 4,
      text: 'Deploy: deal 1 to an enemy unit or the enemy Crystal. When you play a tactic, deal 2 to the enemy Crystal. Ascend: deal 2 to every enemy unit.',
      abilities: [
        { on: 'deploy', targets: [{ what: 'unitOrSpire', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }] },
        { on: 'glyphCast', ops: [{ op: 'damage', to: 'enemySpire', n: 2 }] },
        { on: 'ascend', ops: [{ op: 'damage', to: 'enemies', n: 2 }] },
      ],
    },
  },
  {
    id: 'ember-crucible', name: 'Cantor Ebbe', faction: 'ember', type: 'hero', cost: 6, power: 5, health: 6,
    tribe: 'construct',
    text: 'Dawn: summon a Votive Spark.',
    abilities: [{ on: 'dawn', ops: [{ op: 'summon', card: 'ember-sparkbot' }] }],
    level: { who: 'you', stat: 'unitsSummoned', n: 10, text: "You've summoned 10+ units" },
    ascended: {
      name: 'Ebbe, the Last Hymn', power: 7, health: 7, keywords: ['pierce'],
      text: 'Pierce. Dawn: summon a Wicker Martyr. When another ally is destroyed, deal 1 to the enemy Crystal. Ascend: summon 2 Wicker Martyrs.',
      abilities: [
        { on: 'dawn', ops: [{ op: 'summon', card: 'ember-slagling' }] },
        { on: 'allyDied', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] },
        { on: 'ascend', ops: [{ op: 'summon', card: 'ember-slagling', n: 2 }] },
      ],
    },
  },
  {
    id: 'ember-sparkbot', name: 'Votive Spark', faction: 'ember', type: 'unit', cost: 1, power: 1, health: 1, token: true,
    keywords: ['unstable'], tribe: 'construct', text: 'Unstable.',
  },
  {
    id: 'ember-slagling', name: 'Wicker Martyr', faction: 'ember', type: 'unit', cost: 2, power: 3, health: 1, token: true,
    keywords: ['unstable', 'vanguard'], tribe: 'construct', text: 'Unstable, Vanguard.',
  },

  // ---------- collectible units ----------
  {
    id: 'ember-cinderscamp', name: 'Kindling Censer', faction: 'ember', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'construct',
    text: 'Deploy: summon a Votive Spark.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'ember-sparkbot' }] }],
  },
  {
    id: 'ember-kilnhand', name: 'Ash Novice', faction: 'ember', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'smith',
    text: 'Shatter: deal 1 to the enemy Crystal.',
    abilities: [{ on: 'shatter', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'ember-ashrunner', name: 'Cinder Runner', faction: 'ember', type: 'unit', cost: 1, power: 2, health: 1, tribe: 'construct',
    keywords: ['vanguard'], text: 'Vanguard.',
  },
  {
    id: 'ember-slagsmith', name: 'Coal Flinger', faction: 'ember', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'smith',
    text: 'Deploy: deal 1 to an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }] }],
  },
  {
    id: 'ember-sparkforge', name: 'Wicker Loom', faction: 'ember', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'construct',
    text: 'When you play a tactic, summon a Votive Spark.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'summon', card: 'ember-sparkbot' }] }],
  },
  {
    id: 'ember-fuseguard', name: 'Ember Reliquary', faction: 'ember', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'construct',
    text: 'Shatter: deal 2 to a random enemy unit.',
    abilities: [{ on: 'shatter', ops: [{ op: 'damage', to: 'randomEnemy', n: 2 }] }],
  },
  {
    id: 'ember-furnacebrute', name: 'Brazen Effigy', faction: 'ember', type: 'unit', cost: 3, power: 3, health: 3, tribe: 'construct',
    keywords: ['vanguard'], text: 'Vanguard. Resonant: I have +1|+1.',
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'ember-arcwelder', name: 'Flame Cantor', faction: 'ember', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'smith',
    text: 'Deploy: deal 2 to an enemy unit. Resonant: deal 3 instead.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }],
      ops: [{ op: 'if', cond: { c: 'resonant' }, then: [{ op: 'damage', to: 'target0', n: 3 }], else: [{ op: 'damage', to: 'target0', n: 2 }] }],
    }],
  },
  {
    id: 'ember-furnacetender', name: 'Martyr Weaver', faction: 'ember', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'smith',
    text: 'Deploy: summon a Wicker Martyr.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'ember-slagling' }] }],
  },
  {
    id: 'ember-blastminer', name: 'Burning Penitent', faction: 'ember', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'smith',
    text: 'Shatter: deal 2 to every enemy unit.',
    abilities: [{ on: 'shatter', ops: [{ op: 'damage', to: 'enemies', n: 2 }] }],
  },
  {
    id: 'ember-pyrelancer', name: 'Censer Lancer', faction: 'ember', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'construct',
    keywords: ['vanguard'], text: 'Vanguard. Assault: deal 1 to the enemy Crystal.',
    abilities: [{ on: 'assault', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'ember-moltenwarden', name: 'Tolling Engine', faction: 'ember', type: 'unit', cost: 5, power: 4, health: 4, tribe: 'construct',
    text: 'Deploy: deal 3 to an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 3 }] }],
  },
  {
    id: 'ember-crucibleherald', name: 'Precentor of Pyres', faction: 'ember', type: 'unit', cost: 6, power: 3, health: 5, tribe: 'smith',
    text: 'Deploy: summon 3 Wicker Martyrs.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'ember-slagling', n: 3 }] }],
  },
  {
    id: 'ember-foundrytitan', name: 'The Great Effigy', faction: 'ember', type: 'unit', cost: 7, power: 6, health: 7, tribe: 'construct',
    keywords: ['pierce'], text: 'Pierce. Deploy: deal 2 to every enemy unit.',
    abilities: [{ on: 'deploy', ops: [{ op: 'damage', to: 'enemies', n: 2 }] }],
  },
  // ---------- collectible glyphs ----------
  {
    id: 'ember-overdrive', name: 'Fervour', faction: 'ember', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An ally gets +2|+0 this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 2, dur: 'round' }],
  },
  {
    id: 'ember-pinprick', name: 'Cinder Flick', faction: 'ember', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Deal 1 to an enemy unit or the enemy Crystal.',
    targets: [{ what: 'unitOrSpire', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }],
  },
  {
    id: 'ember-ventburst', name: 'Censer Burst', faction: 'ember', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Deal 2 to an enemy unit and 1 to the enemy Crystal.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 2 }, { op: 'damage', to: 'enemySpire', n: 1 }],
  },
  {
    id: 'ember-slagbolt', name: 'Brand', faction: 'ember', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Deal 3 to an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 3 }],
  },
  {
    id: 'ember-scrapburst', name: 'Willing Pyre', faction: 'ember', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Destroy an ally. Deal 3 to the enemy Crystal.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'destroy', to: 'target0' }, { op: 'damage', to: 'enemySpire', n: 3 }],
  },
  {
    id: 'ember-heatlance', name: 'Searing Hymn', faction: 'ember', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Deal 3 to an enemy unit or the enemy Crystal.',
    targets: [{ what: 'unitOrSpire', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 3 }],
  },
  {
    id: 'ember-cinderhail', name: 'Ash Rain', faction: 'ember', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Deal 2 to every enemy unit.',
    ops: [{ op: 'damage', to: 'enemies', n: 2 }],
  },
  {
    id: 'ember-sparkcascade', name: 'Votive Procession', faction: 'ember', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Summon 2 Votive Sparks. Resonant: summon 2 more.',
    ops: [{ op: 'summon', card: 'ember-sparkbot', n: 2 }, { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'summon', card: 'ember-sparkbot', n: 2 }] }],
  },
  {
    id: 'ember-firestorm', name: 'The Great Burning', faction: 'ember', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Deal 3 to every enemy unit and 2 to the enemy Crystal.',
    ops: [{ op: 'damage', to: 'enemies', n: 3 }, { op: 'damage', to: 'enemySpire', n: 2 }],
  },

  // ---------- base set, second wave (docs/SETS.md): pit-fighter and overcharger ----------
  {
    id: 'ember-torva', name: 'Brother Hask, Unburnt', faction: 'ember', type: 'hero', cost: 3, power: 2, health: 3,
    keywords: ['vanguard', 'dueler'], tribe: 'smith',
    text: 'Vanguard, Dueler. Strike: I get +0|+1.',
    abilities: [{ on: 'strike', ops: [{ op: 'buff', to: 'self', health: 1 }] }],
    level: { who: 'self', stat: 'strikes', n: 3, text: "I've struck 3+ times" },
    ascended: {
      name: 'Hask, Ember Penitent', power: 4, health: 5, keywords: ['vanguard', 'dueler'],
      text: 'Vanguard, Dueler. Strike: deal 1 to the enemy Crystal. Ascend: I strike every enemy unit.',
      abilities: [
        { on: 'strike', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] },
        { on: 'ascend', ops: [{ op: 'strike', from: 'self', to: 'enemies' }] },
      ],
    },
  },
  {
    id: 'ember-yarrow', name: 'Deacon Oriel Tamm', faction: 'ember', type: 'hero', cost: 4, power: 3, health: 4,
    tribe: 'artificer',
    text: 'Dawn: gain 1 Reserve.',
    abilities: [{ on: 'dawn', ops: [{ op: 'reserve', n: 1 }] }],
    level: { who: 'you', stat: 'chargeSpent', n: 24, text: "You've spent 24+ Charge" },
    ascended: {
      name: 'Oriel, the Banked Fire', power: 5, health: 6,
      text: 'Dawn: gain 1 Reserve, then gain Charge equal to your Reserve. Ascend: gain 4 Charge.',
      abilities: [
        { on: 'dawn', ops: [{ op: 'reserve', n: 1 }, { op: 'charge', n: { count: 'reserve' } }] },
        { on: 'ascend', ops: [{ op: 'charge', n: 4 }] },
      ],
    },
  },
  // units
  {
    id: 'ember-valvetapper', name: 'Coal Keeper', faction: 'ember', type: 'unit', cost: 1, power: 0, health: 2, tribe: 'artificer',
    text: 'Deploy: gain 1 Reserve.',
    abilities: [{ on: 'deploy', ops: [{ op: 'reserve', n: 1 }] }],
  },
  {
    id: 'ember-ringcrier', name: 'Bell Novice', faction: 'ember', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'smith',
    text: 'Deploy: give an ally Vanguard.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['vanguard'] }] }],
  },
  {
    id: 'ember-flarebot', name: 'Wicker Lamp', faction: 'ember', type: 'unit', cost: 1, power: 2, health: 2, tribe: 'construct',
    keywords: ['unstable'], text: 'Unstable. Shatter: gain 1 Reserve.',
    abilities: [{ on: 'shatter', ops: [{ op: 'reserve', n: 1 }] }],
  },
  {
    id: 'ember-pitbrawler', name: 'Ash Zealot', faction: 'ember', type: 'unit', cost: 2, power: 3, health: 1, tribe: 'smith',
    keywords: ['dueler'], text: 'Dueler.',
  },
  {
    id: 'ember-gaugewatcher', name: 'Coal Vigil', faction: 'ember', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'artificer',
    text: 'Dawn: if you have 2+ Reserve, deal 1 to the enemy Crystal.',
    abilities: [{ on: 'dawn', cond: { c: 'reserve', gte: 2 }, ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'ember-scrapreclaimer', name: 'Ash Gatherer', faction: 'ember', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'artificer',
    text: 'When another ally is destroyed, gain 1 Charge.',
    abilities: [{ on: 'allyDied', ops: [{ op: 'charge', n: 1 }] }],
  },
  {
    id: 'ember-pitpromoter', name: 'Ordeal Keeper', faction: 'ember', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'smith',
    text: 'Deploy: an ally and an enemy unit strike each other.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
      ops: [{ op: 'duel', a: 'target0', b: 'target1' }],
    }],
  },
  {
    id: 'ember-rivethurler', name: 'Choirmaster', faction: 'ember', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'smith',
    text: 'Deploy: deal 1 to an enemy unit for each other ally you have (at most 4).',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }],
      ops: [{ op: 'damage', to: 'target0', n: { count: 'otherAllies', mul: 1, max: 4 } }],
    }],
  },
  {
    id: 'ember-meltdowngolem', name: 'Burning Frame', faction: 'ember', type: 'unit', cost: 3, power: 4, health: 4, tribe: 'construct',
    keywords: ['unstable'], text: 'Unstable. Deploy: deal 2 to an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 2 }] }],
  },
  {
    id: 'ember-slaggladiator', name: 'Brazen Penitent', faction: 'ember', type: 'unit', cost: 4, power: 3, health: 4, tribe: 'construct',
    keywords: ['vanguard'], text: 'Vanguard. Strike: I get +1|+0. Resonant: I have Dueler.',
    abilities: [{ on: 'strike', ops: [{ op: 'buff', to: 'self', power: 1 }] }],
    auras: [{ to: 'self', kw: ['dueler'], cond: { c: 'resonant' } }],
  },
  {
    id: 'ember-steamcondenser', name: 'Swinging Censer', faction: 'ember', type: 'unit', cost: 4, power: 2, health: 5, tribe: 'artificer',
    text: 'When you play a tactic, gain 1 Reserve.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'reserve', n: 1 }] }],
  },
  {
    id: 'ember-pitboss', name: 'Abbess of Brands', faction: 'ember', type: 'unit', cost: 5, power: 4, health: 4, tribe: 'smith',
    text: 'Deploy: give an ally with Vanguard +2|+1, then it strikes an enemy unit.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally', filter: { kw: 'vanguard' } }, { what: 'unit', side: 'enemy' }],
      ops: [{ op: 'buff', to: 'target0', power: 2, health: 1 }, { op: 'strike', from: 'target0', to: 'target1' }],
    }],
  },
  {
    id: 'ember-forgemarshal', name: 'Pyre Marshal', faction: 'ember', type: 'unit', cost: 6, power: 5, health: 5, tribe: 'smith',
    text: 'Allies with Vanguard have +1|+1. Resonant: they also have Pierce.',
    auras: [
      { to: 'allies', filter: { kw: 'vanguard' }, power: 1, health: 1 },
      { to: 'allies', filter: { kw: 'vanguard' }, kw: ['pierce'], cond: { c: 'resonant' } },
    ],
  },
  {
    id: 'ember-boilercolossus', name: 'Reliquary Colossus', faction: 'ember', type: 'unit', cost: 8, power: 7, health: 7, tribe: 'construct',
    keywords: ['pierce'], text: 'Pierce. Deploy: gain 3 Charge.',
    abilities: [{ on: 'deploy', ops: [{ op: 'charge', n: 3 }] }],
  },
  // glyphs
  {
    id: 'ember-stoketheboiler', name: 'Feed the Censer', faction: 'ember', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Destroy an ally with Unstable. Gain 2 Charge.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'unstable' } }],
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'charge', n: 2 }],
  },
  {
    id: 'ember-hotrivets', name: 'Brand of Zeal', faction: 'ember', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Give an ally with Vanguard +2|+2 this round. Resonant: it also gets Pierce this round.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'vanguard' } }],
    ops: [
      { op: 'buff', to: 'target0', power: 2, health: 2, dur: 'round' },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'grant', to: 'target0', kw: ['pierce'], dur: 'round' }] },
    ],
  },
  {
    id: 'ember-cheapshot', name: 'Blow in the Smoke', faction: 'ember', type: 'glyph', cost: 3, speed: 'flash',
    text: 'An ally in combat strikes an enemy unit in combat.', needsAllTargets: true,
    targets: [{ what: 'unit', side: 'ally', inCombat: true }, { what: 'unit', side: 'enemy', inCombat: true }],
    ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
  },
  {
    id: 'ember-shrapneltoss', name: 'Flung Effigy', faction: 'ember', type: 'glyph', cost: 2, speed: 'swift',
    text: "Choose an ally with Unstable and an enemy unit. Deal damage equal to the ally's power to the enemy unit, then destroy the ally.",
    needsAllTargets: true,
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'unstable' } }, { what: 'unit', side: 'enemy' }],
    ops: [{ op: 'damage', to: 'target1', n: { count: 'target0Power' } }, { op: 'destroy', to: 'target0' }],
  },
  {
    id: 'ember-sparkgap', name: 'Kindle', faction: 'ember', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Deal 2 to an enemy unit. Summon a Votive Spark.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'damage', to: 'target0', n: 2 }, { op: 'summon', card: 'ember-sparkbot' }],
  },
  {
    id: 'ember-clearthering', name: 'Sweep the Ashes', faction: 'ember', type: 'glyph', cost: 4, speed: 'swift',
    text: 'An ally with Vanguard strikes each enemy unit with 2 or less power.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'vanguard' } }],
    ops: [{ op: 'strike', from: 'target0', to: { from: 'enemies', filter: { maxPower: 2 } } }],
  },
  {
    id: 'ember-overpressure', name: 'Debt of Fire', faction: 'ember', type: 'glyph', cost: 6, speed: 'swift',
    text: 'Deal 4 to an enemy unit or the enemy Crystal. Gain 3 Charge.',
    targets: [{ what: 'unitOrSpire', side: 'enemy' }],
    ops: [{ op: 'damage', to: 'target0', n: 4 }, { op: 'charge', n: 3 }],
  },
  {
    id: 'ember-titlebout', name: 'Another Verse', faction: 'ember', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Give an ally with Vanguard +1|+1. You may attack again this round.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'vanguard' } }],
    ops: [{ op: 'buff', to: 'target0', power: 1, health: 1 }, { op: 'rally' }],
  },
  {
    id: 'ember-moltentorrent', name: 'Burning Ground', faction: 'ember', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Deal 2 to every enemy unit, then 3 more to an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'damage', to: 'enemies', n: 2 }, { op: 'damage', to: 'target0', n: 3 }],
  },
];
