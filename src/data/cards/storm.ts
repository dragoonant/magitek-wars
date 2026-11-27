// Stormrail: the sky couriers. Aerial, Vanguard, extra attacks, fast pressure.
import type { CardDef } from '../../engine/types';

export const storm: CardDef[] = [
  {
    id: 'storm-jax', name: 'Jax Windlash', faction: 'storm', type: 'hero', cost: 2, power: 3, health: 2,
    keywords: ['vanguard'], tribe: 'courier',
    text: 'Vanguard.',
    level: { who: 'you', stat: 'spireDamage', n: 8, text: "You've dealt 8+ damage to the enemy Spire" },
    ascended: {
      name: 'Jax, Thunderhead', power: 4, health: 3, keywords: ['vanguard', 'aerial'],
      text: 'Vanguard, Aerial. When I strike the enemy Spire, I get +1|+0. Ascend: you may attack again this round.',
      abilities: [
        { on: 'spireHit', ops: [{ op: 'buff', to: 'self', power: 1 }] },
        { on: 'ascend', ops: [{ op: 'rally' }] },
      ],
    },
  },
  {
    id: 'storm-corvane', name: 'Admiral Corvane', faction: 'storm', type: 'hero', cost: 6, power: 4, health: 5,
    keywords: ['aerial'], tribe: 'courier',
    text: 'Aerial. Assault: attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'attackersDeclared', n: 10, text: "You've declared 10+ attackers" },
    ascended: {
      name: 'Corvane, Lord of the Gale', power: 5, health: 6, keywords: ['aerial'],
      text: 'Aerial. Assault: attacking allies get +2|+0 and Vanguard this round. Ascend: summon 2 Wingmates.',
      abilities: [
        { on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 2, dur: 'round' }, { op: 'grant', to: 'attackers', kw: ['vanguard'], dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'summon', card: 'storm-wingmate', n: 2 }] },
      ],
    },
  },
  {
    id: 'storm-wingmate', name: 'Wingmate', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 2, token: true,
    keywords: ['aerial'], tribe: 'courier', text: 'Aerial.',
  },

  // ---------- collectible units ----------
  {
    id: 'storm-signalkite', name: 'Signal Kite', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial.',
  },
  {
    id: 'storm-tickettaker', name: 'Ticket Taker', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. When I strike the enemy Spire, draw a card.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-flagbearer', name: 'Flag Bearer', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    text: 'Assault: attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-railglider', name: 'Rail Glider', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'courier',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard.',
  },
  {
    id: 'storm-gustcaller', name: 'Gust Caller', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
    text: 'Dawn: another random ally gets +1|+0 this round.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: 'randomAlly', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-dispatcher', name: 'Rail Dispatcher', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
    text: 'Deploy: an ally gets +2|+0 and Aerial this round.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }],
      ops: [{ op: 'buff', to: 'target0', power: 2, dur: 'round' }, { op: 'grant', to: 'target0', kw: ['aerial'], dur: 'round' }],
    }],
  },
  {
    id: 'storm-galecourier', name: 'Gale Courier', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. When I strike the enemy Spire, deal 1 to the enemy Spire.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'storm-sparkrider', name: 'Spark Rider', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Assault: I get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'self', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-squadcaller', name: 'Squad Caller', faction: 'storm', type: 'unit', cost: 3, power: 1, health: 2, tribe: 'courier',
    text: 'Deploy: summon a Wingmate.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'storm-wingmate' }] }],
  },
  {
    id: 'storm-railmarshal', name: 'Rail Marshal', faction: 'storm', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'courier',
    text: 'Assault: if you have declared 2 or fewer attackers this round, you may attack again.',
    abilities: [{ on: 'assault', cond: { c: 'not', x: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 } }, ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-thunderkite', name: 'Thunder Kite', faction: 'storm', type: 'unit', cost: 4, power: 4, health: 3, tribe: 'kite',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard.',
  },
  {
    id: 'storm-stormcaller', name: 'Storm Caller', faction: 'storm', type: 'unit', cost: 5, power: 4, health: 5, tribe: 'courier',
    text: 'Assault: attacking allies get +1|+0 and Aerial this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }, { op: 'grant', to: 'attackers', kw: ['aerial'], dur: 'round' }] }],
  },
  {
    id: 'storm-cyclonebarge', name: 'Cyclone Barge', faction: 'storm', type: 'unit', cost: 6, power: 5, health: 5, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. Dawn: summon a Wingmate. Resonant: I have +1|+1.',
    abilities: [{ on: 'dawn', ops: [{ op: 'summon', card: 'storm-wingmate' }] }],
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-tempestliner', name: 'Tempest Liner', faction: 'storm', type: 'unit', cost: 7, power: 6, health: 6, tribe: 'courier',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard. When I strike the enemy Spire, deal 2 to the enemy Spire.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'damage', to: 'enemySpire', n: 2 }] }],
  },
  // ---------- collectible glyphs ----------
  {
    id: 'storm-tailwind', name: 'Tailwind', faction: 'storm', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An ally gets +1|+1 this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 1, health: 1, dur: 'round' }],
  },
  {
    id: 'storm-updraft', name: 'Updraft', faction: 'storm', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An ally gets +1|+0 and Aerial this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 1, dur: 'round' }, { op: 'grant', to: 'target0', kw: ['aerial'], dur: 'round' }],
  },
  {
    id: 'storm-crosswind', name: 'Crosswind', faction: 'storm', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Put an enemy unit in Stasis.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }],
  },
  {
    id: 'storm-galesurge', name: 'Gale Surge', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Allies get +2|+0 this round.',
    ops: [{ op: 'buff', to: 'allies', power: 2, dur: 'round' }],
  },
  {
    id: 'storm-reroute', name: 'Reroute', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'You may attack again this round.',
    ops: [{ op: 'rally' }],
  },
  {
    id: 'storm-skyhook', name: 'Skyhook', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Return an enemy unit to its owner\'s hand.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'recall', to: 'target0' }],
  },
  {
    id: 'storm-jetstream', name: 'Jetstream', faction: 'storm', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Allies gain Aerial this round. Resonant: you may attack again this round.',
    ops: [{ op: 'grant', to: 'allies', kw: ['aerial'], dur: 'round' }, { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-airmail', name: 'Airmail', faction: 'storm', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Draw 2 cards.',
    ops: [{ op: 'draw', n: 2 }],
  },
  {
    id: 'storm-skyraid', name: 'Sky Raid', faction: 'storm', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Allies get +2|+0 and Vanguard this round. Draw a card.',
    ops: [{ op: 'buff', to: 'allies', power: 2, dur: 'round' }, { op: 'grant', to: 'allies', kw: ['vanguard'], dur: 'round' }, { op: 'draw', n: 1 }],
  },

  // ---------- First Light additions (docs/SETS.md): wingleader and rail-runner ----------
  {
    id: 'storm-odile', name: 'Wing-Captain Odile Varro', faction: 'storm', type: 'hero', cost: 3, power: 2, health: 3,
    keywords: ['aerial'], tribe: 'courier',
    text: 'Aerial. Dawn: other Aerial allies get +1|+0 this round.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'buffsGiven', n: 16, text: "You've buffed allies 16+ times" },
    ascended: {
      name: 'Odile, Crown of the Squadron', power: 3, health: 5, keywords: ['aerial'],
      text: 'Aerial. Dawn: other Aerial allies get +1|+1 this round. Ascend: Aerial allies get +2|+2.',
      abilities: [
        { on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 2, health: 2 }] },
      ],
    },
  },
  {
    id: 'storm-ness', name: 'Ness Harrow, Rail-Runner', faction: 'storm', type: 'hero', cost: 4, power: 3, health: 4,
    keywords: ['vanguard'], tribe: 'courier',
    text: 'Vanguard. Assault: if you have declared 3 or more attackers this round, attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'attackersDeclared', n: 16, text: "You've declared 16+ attackers" },
    ascended: {
      name: 'Ness, the Endless Line', power: 4, health: 5, keywords: ['vanguard'],
      text: 'Vanguard. Assault: if you have declared 3 or more attackers this round, attacking allies get +2|+0 this round. Ascend: attacking allies get +1|+0 this round, and you may attack again this round.',
      abilities: [
        { on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'attackers', power: 2, dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }, { op: 'rally' }] },
      ],
    },
  },
  // units
  {
    id: 'storm-ribbonkite', name: 'Ribbon Kite', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'kite',
    text: 'Deploy: an Aerial ally gets +1|+1.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally', filter: { kw: 'aerial' } }], ops: [{ op: 'buff', to: 'target0', power: 1, health: 1 }] }],
  },
  {
    id: 'storm-wingcadet', name: 'Wing Cadet', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    text: 'When another Aerial ally enters your Line, it gets +1|+0.',
    abilities: [{ on: 'allySummoned', ops: [{ op: 'buff', to: { from: 'trigger', filter: { kw: 'aerial' } }, power: 1 }] }],
  },
  {
    id: 'storm-tailrunner', name: 'Tail Runner', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 2, tribe: 'courier',
    text: 'Assault: if you have declared 3 or more attackers this round, I get +2|+0 this round.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'self', power: 2, dur: 'round' }] }],
  },
  {
    id: 'storm-skirmishkite', name: 'Skirmish Kite', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial. Resonant: I have +1|+1 and Vanguard.',
    auras: [{ to: 'self', power: 1, health: 1, kw: ['vanguard'], cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-signaller', name: 'Platform Signaller', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'courier',
    text: 'Dusk: if you have declared 4 or more attackers this round, draw a card.',
    abilities: [{ on: 'dusk', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 4 }, ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-windrigger', name: 'Wind Rigger', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
    text: 'Deploy: choose an ally. If it has Aerial, it gets +1|+1; otherwise it gains Aerial.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }],
      ops: [
        { op: 'buff', to: { from: 'target0', filter: { kw: 'aerial' } }, power: 1, health: 1 },
        { op: 'grant', to: { from: 'target0', filter: { notKw: 'aerial' } }, kw: ['aerial'] },
      ],
    }],
  },
  {
    id: 'storm-gyrekite', name: 'Gyre Kite', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial. Strike: other Aerial allies get +1|+0 this round.',
    abilities: [{ on: 'strike', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-veteranrunner', name: 'Veteran Runner', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Strike: if you have declared 3 or more attackers this round, I get +1|+1.',
    abilities: [{ on: 'strike', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] }],
  },
  {
    id: 'storm-mastlookout', name: 'Mast Lookout', faction: 'storm', type: 'unit', cost: 3, power: 2, health: 4, tribe: 'courier',
    keywords: ['spotter'], text: 'Spotter. Resonant: I have +2|+0 and Aerial.',
    auras: [{ to: 'self', power: 2, kw: ['aerial'], cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-switchforeman', name: 'Switchyard Foreman', faction: 'storm', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'courier',
    text: 'Deploy: if you have declared an attacker this round, you may attack again this round.',
    abilities: [{ on: 'deploy', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 1 }, ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-glidetutor', name: 'Glide Tutor', faction: 'storm', type: 'unit', cost: 4, power: 2, health: 4, tribe: 'courier',
    text: 'Dawn: other Aerial allies with 2 or less power get +1|+1.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial', maxPower: 2 } }, power: 1, health: 1 }] }],
  },
  {
    id: 'storm-breakneck', name: 'Breakneck Courier', faction: 'storm', type: 'unit', cost: 5, power: 5, health: 4, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Shatter: you may attack again this round.',
    abilities: [{ on: 'shatter', ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-aeriecarrier', name: 'Aerie Carrier', faction: 'storm', type: 'unit', cost: 6, power: 5, health: 4, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. Deploy: Aerial allies get +1|+1.',
    abilities: [{ on: 'deploy', ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1 }] }],
  },
  {
    id: 'storm-bellexpress', name: 'Ninth-Bell Express', faction: 'storm', type: 'unit', cost: 7, power: 6, health: 6, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Assault: if you have declared 5 or more attackers this round, deal 4 to the enemy Spire.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 5 }, ops: [{ op: 'damage', to: 'enemySpire', n: 4 }] }],
  },
  // glyphs
  {
    id: 'storm-anchorleg', name: 'Anchor Leg', faction: 'storm', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An ally gets +1|+0 this round. If you have declared 3 or more attackers this round, it gets +1|+1 more this round.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [
      { op: 'buff', to: 'target0', power: 1, dur: 'round' },
      { op: 'if', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, then: [{ op: 'buff', to: 'target0', power: 1, health: 1, dur: 'round' }] },
    ],
  },
  {
    id: 'storm-sinkingair', name: 'Sinking Air', faction: 'storm', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An enemy unit gets -2|+0 this round.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'buff', to: 'target0', power: -2, dur: 'round' }],
  },
  {
    id: 'storm-closeechelon', name: 'Close Echelon', faction: 'storm', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Aerial allies get +1|+1 this round.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }],
  },
  {
    id: 'storm-parceldrop', name: 'Parcel Drop', faction: 'storm', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Draw a card. If you have declared 3 or more attackers this round, draw another.',
    ops: [{ op: 'draw', n: 1 }, { op: 'if', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, then: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-loopback', name: 'Loop Back', faction: 'storm', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Cast only if you have declared 4 or more attackers this round. You may attack again this round.',
    castIf: { c: 'seenRound', stat: 'attackersDeclared', gte: 4 },
    ops: [{ op: 'rally' }],
  },
  {
    id: 'storm-steepdive', name: 'Steep Dive', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'An Aerial ally strikes an enemy unit.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'aerial' } }, { what: 'unit', side: 'enemy' }], needsAllTargets: true,
    ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
  },
  {
    id: 'storm-gliderdrop', name: 'Glider Drop', faction: 'storm', type: 'glyph', cost: 5, speed: 'swift',
    text: 'Summon 2 Wingmates. Resonant: Aerial allies get +1|+1 this round.',
    ops: [
      { op: 'summon', card: 'storm-wingmate', n: 2 },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }] },
    ],
  },
  {
    id: 'storm-flightdrill', name: 'Flight Drill', faction: 'storm', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Aerial allies get +1|+1. Draw a card.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1 }, { op: 'draw', n: 1 }],
  },
  {
    id: 'storm-doubledeparture', name: 'Double Departure', faction: 'storm', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Allies get +2|+1 this round. You may attack again this round.',
    ops: [{ op: 'buff', to: 'allies', power: 2, health: 1, dur: 'round' }, { op: 'rally' }],
  },
];
