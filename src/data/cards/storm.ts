// The Free Gauge (faction id 'storm'): union raiders with patched gliders and stolen engines.
// Aerial, Vanguard, extra attacks, fast pressure.
import type { CardDef } from '../../engine/types';

export const storm: CardDef[] = [
  {
    id: 'storm-jax', name: 'Wren Ashby', faction: 'storm', type: 'hero', cost: 2, power: 3, health: 2,
    keywords: ['vanguard'], tribe: 'courier',
    text: 'Vanguard.',
    level: { who: 'you', stat: 'spireDamage', n: 8, text: "You've dealt 8+ damage to the enemy Crystal" },
    ascended: {
      name: 'Wren, Ghost of the Line', power: 4, health: 3, keywords: ['vanguard', 'aerial'],
      text: 'Vanguard, Aerial. When I strike the enemy Crystal, I get +1|+0. Ascend: you may attack again this round.',
      abilities: [
        { on: 'spireHit', ops: [{ op: 'buff', to: 'self', power: 1 }] },
        { on: 'ascend', ops: [{ op: 'rally' }] },
      ],
    },
  },
  {
    id: 'storm-corvane', name: 'Kitemaster Ada Rusk', faction: 'storm', type: 'hero', cost: 6, power: 4, health: 5,
    keywords: ['aerial'], tribe: 'courier',
    text: 'Aerial. Assault: attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'attackersDeclared', n: 10, text: "You've declared 10+ attackers" },
    ascended: {
      name: 'Ada Rusk, Canopy of Night', power: 5, health: 6, keywords: ['aerial'],
      text: 'Aerial. Assault: attacking allies get +2|+0 and Vanguard this round. Ascend: summon 2 Patch Gliders.',
      abilities: [
        { on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 2, dur: 'round' }, { op: 'grant', to: 'attackers', kw: ['vanguard'], dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'summon', card: 'storm-wingmate', n: 2 }] },
      ],
    },
  },
  {
    id: 'storm-wingmate', name: 'Patch Glider', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 2, token: true,
    keywords: ['aerial'], tribe: 'courier', text: 'Aerial.',
  },

  // ---------- collectible units ----------
  {
    id: 'storm-signalkite', name: 'Lamp Kite', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial.',
  },
  {
    id: 'storm-tickettaker', name: 'Mailbag Cutter', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. When I strike the enemy Crystal, draw a card.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-flagbearer', name: 'Shift Whistler', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    text: 'Assault: attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-railglider', name: 'Trestle Jumper', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'courier',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard.',
  },
  {
    id: 'storm-gustcaller', name: 'Dawn Stoker', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
    text: 'Dawn: another random ally gets +1|+0 this round.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: 'randomAlly', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-dispatcher', name: 'Winch Launcher', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
    text: 'Deploy: an ally gets +2|+0 and Aerial this round.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }],
      ops: [{ op: 'buff', to: 'target0', power: 2, dur: 'round' }, { op: 'grant', to: 'target0', kw: ['aerial'], dur: 'round' }],
    }],
  },
  {
    id: 'storm-galecourier', name: 'Satchel Dropper', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. When I strike the enemy Crystal, deal 1 to the enemy Crystal.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'storm-sparkrider', name: 'Draisine Raider', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Assault: I get +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'self', power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-squadcaller', name: 'Canvas Rigger', faction: 'storm', type: 'unit', cost: 3, power: 1, health: 2, tribe: 'courier',
    text: 'Deploy: summon a Patch Glider.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'storm-wingmate' }] }],
  },
  {
    id: 'storm-railmarshal', name: 'Cell Leader', faction: 'storm', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'courier',
    text: 'Assault: if you have declared 2 or fewer attackers this round, you may attack again.',
    abilities: [{ on: 'assault', cond: { c: 'not', x: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 } }, ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-thunderkite', name: 'Gunner Kite', faction: 'storm', type: 'unit', cost: 4, power: 4, health: 3, tribe: 'kite',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard.',
  },
  {
    id: 'storm-stormcaller', name: 'Launch Chief', faction: 'storm', type: 'unit', cost: 5, power: 4, health: 5, tribe: 'courier',
    text: 'Assault: attacking allies get +1|+0 and Aerial this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }, { op: 'grant', to: 'attackers', kw: ['aerial'], dur: 'round' }] }],
  },
  {
    id: 'storm-cyclonebarge', name: 'Balloon Raft', faction: 'storm', type: 'unit', cost: 6, power: 5, health: 5, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. Dawn: summon a Patch Glider. Resonant: I have +1|+1.',
    abilities: [{ on: 'dawn', ops: [{ op: 'summon', card: 'storm-wingmate' }] }],
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-tempestliner', name: 'Captured Skyfreighter', faction: 'storm', type: 'unit', cost: 7, power: 6, health: 6, tribe: 'courier',
    keywords: ['aerial', 'vanguard'], text: 'Aerial, Vanguard. When I strike the enemy Crystal, deal 2 to the enemy Crystal.',
    abilities: [{ on: 'spireHit', ops: [{ op: 'damage', to: 'enemySpire', n: 2 }] }],
  },
  // ---------- collectible tactics (type 'glyph') ----------
  {
    id: 'storm-tailwind', name: 'Field Patch', faction: 'storm', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An ally gets +1|+1 this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 1, health: 1, dur: 'round' }],
  },
  {
    id: 'storm-updraft', name: 'Slag Thermal', faction: 'storm', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An ally gets +1|+0 and Aerial this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', power: 1, dur: 'round' }, { op: 'grant', to: 'target0', kw: ['aerial'], dur: 'round' }],
  },
  {
    id: 'storm-crosswind', name: 'Grit in the Gears', faction: 'storm', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Put an enemy unit in Stasis.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }],
  },
  {
    id: 'storm-galesurge', name: 'All Out', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Allies get +2|+0 this round.',
    ops: [{ op: 'buff', to: 'allies', power: 2, dur: 'round' }],
  },
  {
    id: 'storm-reroute', name: 'Throw the Points', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'You may attack again this round.',
    ops: [{ op: 'rally' }],
  },
  {
    id: 'storm-skyhook', name: 'Snatch Line', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Return an enemy unit to its owner\'s hand.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'recall', to: 'target0' }],
  },
  {
    id: 'storm-jetstream', name: 'Mass Launch', faction: 'storm', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Allies gain Aerial this round. Resonant: you may attack again this round.',
    ops: [{ op: 'grant', to: 'allies', kw: ['aerial'], dur: 'round' }, { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-airmail', name: 'Dead Drop', faction: 'storm', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Draw 2 cards.',
    ops: [{ op: 'draw', n: 2 }],
  },
  {
    id: 'storm-skyraid', name: 'Midnight Raid', faction: 'storm', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Allies get +2|+0 and Vanguard this round. Draw a card.',
    ops: [{ op: 'buff', to: 'allies', power: 2, dur: 'round' }, { op: 'grant', to: 'allies', kw: ['vanguard'], dur: 'round' }, { op: 'draw', n: 1 }],
  },

  // ---------- First Light additions (docs/SETS.md): loft-keeper and union foreman ----------
  {
    id: 'storm-odile', name: 'Loftkeeper Hettie Calloway', faction: 'storm', type: 'hero', cost: 3, power: 2, health: 3,
    keywords: ['aerial'], tribe: 'courier',
    text: 'Aerial. Dawn: other Aerial allies get +1|+0 this round.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'buffsGiven', n: 16, text: "You've buffed allies 16+ times" },
    ascended: {
      name: 'Hettie, Mother of the Lofts', power: 3, health: 5, keywords: ['aerial'],
      text: 'Aerial. Dawn: other Aerial allies get +1|+1 this round. Ascend: Aerial allies get +2|+2.',
      abilities: [
        { on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 2, health: 2 }] },
      ],
    },
  },
  {
    id: 'storm-ness', name: 'Foreman Otto Brandt', faction: 'storm', type: 'hero', cost: 4, power: 3, health: 4,
    keywords: ['vanguard'], tribe: 'courier',
    text: 'Vanguard. Assault: if you have declared 3 or more attackers this round, attacking allies get +1|+0 this round.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'attackersDeclared', n: 16, text: "You've declared 16+ attackers" },
    ascended: {
      name: 'Otto Brandt, the Whole Union', power: 4, health: 5, keywords: ['vanguard'],
      text: 'Vanguard. Assault: if you have declared 3 or more attackers this round, attacking allies get +2|+0 this round. Ascend: attacking allies get +1|+0 this round, and you may attack again this round.',
      abilities: [
        { on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'attackers', power: 2, dur: 'round' }] },
        { on: 'ascend', ops: [{ op: 'buff', to: 'attackers', power: 1, dur: 'round' }, { op: 'rally' }] },
      ],
    },
  },
  // units
  {
    id: 'storm-ribbonkite', name: 'Post Pigeon', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'kite',
    text: 'Deploy: an Aerial ally gets +1|+1.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally', filter: { kw: 'aerial' } }], ops: [{ op: 'buff', to: 'target0', power: 1, health: 1 }] }],
  },
  {
    id: 'storm-wingcadet', name: 'Slag-Heap Cadet', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'courier',
    text: 'When another Aerial ally enters your Line, it gets +1|+0.',
    abilities: [{ on: 'allySummoned', ops: [{ op: 'buff', to: { from: 'trigger', filter: { kw: 'aerial' } }, power: 1 }] }],
  },
  {
    id: 'storm-tailrunner', name: 'Handcar Pumper', faction: 'storm', type: 'unit', cost: 1, power: 1, health: 2, tribe: 'courier',
    text: 'Assault: if you have declared 3 or more attackers this round, I get +2|+0 this round.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'self', power: 2, dur: 'round' }] }],
  },
  {
    id: 'storm-skirmishkite', name: 'Rocket Kite', faction: 'storm', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial. Resonant: I have +1|+1 and Vanguard.',
    auras: [{ to: 'self', power: 1, health: 1, kw: ['vanguard'], cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-signaller', name: 'Siding Watchman', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'courier',
    text: 'Dusk: if you have declared 4 or more attackers this round, draw a card.',
    abilities: [{ on: 'dusk', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 4 }, ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-windrigger', name: 'Wing Fitter', faction: 'storm', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'courier',
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
    id: 'storm-gyrekite', name: 'Flare Kite', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'kite',
    keywords: ['aerial'], text: 'Aerial. Strike: other Aerial allies get +1|+0 this round.',
    abilities: [{ on: 'strike', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial' } }, power: 1, dur: 'round' }] }],
  },
  {
    id: 'storm-veteranrunner', name: 'Old Brakeman', faction: 'storm', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Strike: if you have declared 3 or more attackers this round, I get +1|+1.',
    abilities: [{ on: 'strike', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] }],
  },
  {
    id: 'storm-mastlookout', name: 'Headframe Lookout', faction: 'storm', type: 'unit', cost: 3, power: 2, health: 4, tribe: 'courier',
    keywords: ['spotter'], text: 'Spotter. Resonant: I have +2|+0 and Aerial.',
    auras: [{ to: 'self', power: 2, kw: ['aerial'], cond: { c: 'resonant' } }],
  },
  {
    id: 'storm-switchforeman', name: 'Yard Boss', faction: 'storm', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'courier',
    text: 'Deploy: if you have declared an attacker this round, you may attack again this round.',
    abilities: [{ on: 'deploy', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 1 }, ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-glidetutor', name: 'Flight Teacher', faction: 'storm', type: 'unit', cost: 4, power: 2, health: 4, tribe: 'courier',
    text: 'Dawn: other Aerial allies with 2 or less power get +1|+1.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: { from: 'otherAllies', filter: { kw: 'aerial', maxPower: 2 } }, power: 1, health: 1 }] }],
  },
  {
    id: 'storm-breakneck', name: 'Runaway Engine', faction: 'storm', type: 'unit', cost: 5, power: 5, health: 4, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Shatter: you may attack again this round.',
    abilities: [{ on: 'shatter', ops: [{ op: 'rally' }] }],
  },
  {
    id: 'storm-aeriecarrier', name: 'Repair Dirigible', faction: 'storm', type: 'unit', cost: 6, power: 5, health: 4, tribe: 'courier',
    keywords: ['aerial'], text: 'Aerial. Deploy: Aerial allies get +1|+1.',
    abilities: [{ on: 'deploy', ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1 }] }],
  },
  {
    id: 'storm-bellexpress', name: 'Union Express', faction: 'storm', type: 'unit', cost: 7, power: 6, health: 6, tribe: 'courier',
    keywords: ['vanguard'], text: 'Vanguard. Assault: if you have declared 5 or more attackers this round, deal 4 to the enemy Crystal.',
    abilities: [{ on: 'assault', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 5 }, ops: [{ op: 'damage', to: 'enemySpire', n: 4 }] }],
  },
  // tactics
  {
    id: 'storm-anchorleg', name: 'Union Grip', faction: 'storm', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An ally gets +1|+0 this round. If you have declared 3 or more attackers this round, it gets +1|+1 more this round.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [
      { op: 'buff', to: 'target0', power: 1, dur: 'round' },
      { op: 'if', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, then: [{ op: 'buff', to: 'target0', power: 1, health: 1, dur: 'round' }] },
    ],
  },
  {
    id: 'storm-sinkingair', name: 'Bleed the Valve', faction: 'storm', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An enemy unit gets -2|+0 this round.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'buff', to: 'target0', power: -2, dur: 'round' }],
  },
  {
    id: 'storm-closeechelon', name: 'Close Formation', faction: 'storm', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Aerial allies get +1|+1 this round.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }],
  },
  {
    id: 'storm-parceldrop', name: 'Bundle Drop', faction: 'storm', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Draw a card. If you have declared 3 or more attackers this round, draw another.',
    ops: [{ op: 'draw', n: 1 }, { op: 'if', cond: { c: 'seenRound', stat: 'attackersDeclared', gte: 3 }, then: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'storm-loopback', name: 'Second Pass', faction: 'storm', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Play only if you have declared 4 or more attackers this round. You may attack again this round.',
    castIf: { c: 'seenRound', stat: 'attackersDeclared', gte: 4 },
    ops: [{ op: 'rally' }],
  },
  {
    id: 'storm-steepdive', name: 'Plunge', faction: 'storm', type: 'glyph', cost: 3, speed: 'swift',
    text: 'An Aerial ally strikes an enemy unit.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'aerial' } }, { what: 'unit', side: 'enemy' }], needsAllTargets: true,
    ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
  },
  {
    id: 'storm-gliderdrop', name: 'Cut the Tow', faction: 'storm', type: 'glyph', cost: 5, speed: 'swift',
    text: 'Summon 2 Patch Gliders. Resonant: Aerial allies get +1|+1 this round.',
    ops: [
      { op: 'summon', card: 'storm-wingmate', n: 2 },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1, dur: 'round' }] },
    ],
  },
  {
    id: 'storm-flightdrill', name: 'Ridge Drill', faction: 'storm', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Aerial allies get +1|+1. Draw a card.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { kw: 'aerial' } }, power: 1, health: 1 }, { op: 'draw', n: 1 }],
  },
  {
    id: 'storm-doubledeparture', name: 'Double Header', faction: 'storm', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Allies get +2|+1 this round. You may attack again this round.',
    ops: [{ op: 'buff', to: 'allies', power: 2, health: 1, dur: 'round' }, { op: 'rally' }],
  },
];
