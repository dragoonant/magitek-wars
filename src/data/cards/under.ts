// The Blackwick (faction id 'under'): the undercity syndicate. Siphon, Corrosive, Dread, Shatter effects, drain.
import type { CardDef } from '../../engine/types';

export const under: CardDef[] = [
  {
    id: 'under-sable', name: 'Corva Lusk, Tunnel Fence', faction: 'under', type: 'hero', cost: 2, power: 2, health: 2,
    keywords: ['dread'], tribe: 'syndicate',
    text: 'Dread. When another ally is destroyed, I get +1|+0 this round.',
    abilities: [{ on: 'allyDied', ops: [{ op: 'buff', to: 'self', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'alliesDied', n: 4, text: '4+ of your units have been destroyed' },
    ascended: {
      name: 'Corva Lusk, Queen of the Runs', power: 4, health: 3, keywords: ['dread', 'corrosive'],
      text: 'Dread, Corrosive. When another ally is destroyed, drain 1 from the enemy Crystal. Ascend: summon 2 Shard Rats.',
      abilities: [
        { on: 'allyDied', ops: [{ op: 'drain', to: 'enemySpire', n: 1 }] },
        { on: 'ascend', ops: [{ op: 'summon', card: 'under-wirerat', n: 2 }] },
      ],
    },
  },
  {
    id: 'under-vex', name: 'Doctor Hollis Grane, Drawer', faction: 'under', type: 'hero', cost: 5, power: 4, health: 5,
    keywords: ['siphon'], tribe: 'syndicate',
    text: 'Siphon.',
    level: { who: 'you', stat: 'spireHealed', n: 5, text: "You've repaired your Crystal by 5+" },
    ascended: {
      name: 'Grane, Who Never Cools', power: 5, health: 6, keywords: ['siphon'],
      text: 'Siphon. Dusk: drain 2 from the enemy Crystal. Ascend: drain 3 from every enemy unit.',
      abilities: [
        { on: 'dusk', ops: [{ op: 'drain', to: 'enemySpire', n: 2 }] },
        { on: 'ascend', ops: [{ op: 'drain', to: 'enemies', n: 3 }] },
      ],
    },
  },
  {
    id: 'under-wirerat', name: 'Shard Rat', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, token: true,
    tribe: 'vermin', text: '',
  },

  // ---------- units ----------
  {
    id: 'under-fuserunner', name: 'Fog Runner', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'syndicate',
    text: 'Shatter: drain 1 from the enemy Crystal.',
    abilities: [{ on: 'shatter', ops: [{ op: 'drain', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'under-leechtick', name: 'Pipe Leech', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'vermin',
    keywords: ['siphon'],
    text: 'Siphon.',
  },
  {
    id: 'under-burnoutrunner', name: 'Burnt Wick', faction: 'under', type: 'unit', cost: 1, power: 2, health: 1, tribe: 'syndicate',
    keywords: ['dread', 'unstable'],
    text: 'Dread, Unstable.',
  },
  {
    id: 'under-ratwrangler', name: 'Rat Herder', faction: 'under', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'syndicate',
    text: 'Deploy: summon a Shard Rat. Resonant: summon 2 Shard Rats instead.',
    abilities: [{
      on: 'deploy',
      ops: [{
        op: 'if', cond: { c: 'resonant' },
        then: [{ op: 'summon', card: 'under-wirerat', n: 2 }],
        else: [{ op: 'summon', card: 'under-wirerat', n: 1 }],
      }],
    }],
  },
  {
    id: 'under-pitaccountant', name: 'Pit Tallyman', faction: 'under', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'syndicate',
    text: 'When another ally is destroyed, deal 1 damage to the enemy Crystal. Resonant: I have +1|+1.',
    abilities: [{ on: 'allyDied', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'under-acidlamplighter', name: 'Crystal Lamplighter', faction: 'under', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'syndicate',
    keywords: ['corrosive'],
    text: 'Corrosive.',
  },
  {
    id: 'under-furnacehand', name: 'Cinder Stoker', faction: 'under', type: 'unit', cost: 3, power: 4, health: 4, tribe: 'syndicate',
    text: 'Deploy: destroy another allied unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'destroy', to: 'target0' }] }],
  },
  {
    id: 'under-backalleyenforcer', name: 'Alley Heavy', faction: 'under', type: 'unit', cost: 3, power: 3, health: 2, tribe: 'syndicate',
    keywords: ['dread'],
    text: 'Dread.',
  },
  {
    id: 'under-leechwiresurgeon', name: 'Back-Room Surgeon', faction: 'under', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'syndicate',
    text: 'Deploy: drain 2 from an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'drain', to: 'target0', n: 2 }] }],
  },
  {
    id: 'under-vaultpawnbroker', name: 'Deep Vault Broker', faction: 'under', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'syndicate',
    text: 'When an enemy unit is destroyed, drain 1 from the enemy Crystal.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'drain', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'under-powdercourier', name: 'Blast Courier', faction: 'under', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'syndicate',
    text: 'Shatter: deal 3 damage to the strongest enemy.',
    abilities: [{ on: 'shatter', ops: [{ op: 'damage', to: 'strongestEnemy', n: 3 }] }],
  },
  {
    id: 'under-syndicatebroker', name: 'Cage Fence', faction: 'under', type: 'unit', cost: 5, power: 3, health: 5, tribe: 'syndicate',
    text: 'Deploy: summon 2 Shard Rats.',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'under-wirerat', n: 2 }] }],
  },
  {
    id: 'under-leechoverseer', name: 'Drawhouse Overseer', faction: 'under', type: 'unit', cost: 6, power: 4, health: 6, tribe: 'syndicate',
    keywords: ['siphon', 'corrosive'],
    text: 'Siphon, Corrosive.',
  },
  {
    id: 'under-mainlinedynamo', name: 'Great Draw Engine', faction: 'under', type: 'unit', cost: 7, power: 5, health: 6, tribe: 'construct',
    keywords: ['dread'],
    text: 'Dread. Deploy: drain 2 from every enemy unit.',
    abilities: [{ on: 'deploy', ops: [{ op: 'drain', to: 'enemies', n: 2 }] }],
  },

  // ---------- tactics (type 'glyph') ----------
  {
    id: 'under-pullplug', name: 'Pull the Bung', faction: 'under', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Destroy an allied unit. Drain 2 from the enemy Crystal.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'drain', to: 'enemySpire', n: 2 }],
  },
  {
    id: 'under-siphontap', name: 'Quiet Draw', faction: 'under', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Drain 2 from an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'drain', to: 'target0', n: 2 }],
  },
  {
    id: 'under-acidbath', name: 'Crystal Acid', faction: 'under', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An allied unit gains Corrosive this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['corrosive'], dur: 'round' }],
  },
  {
    id: 'under-burnledger', name: 'Torch the Books', faction: 'under', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Destroy an allied unit. Draw 2.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'destroy', to: 'target0' }, { op: 'draw', n: 2 }],
  },
  {
    id: 'under-snuffedfuse', name: 'Pinch the Wick', faction: 'under', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Choose an enemy unit with 3 or less power. Destroy it.',
    targets: [{ what: 'unit', side: 'enemy', filter: { maxPower: 3 } }], ops: [{ op: 'destroy', to: 'target0' }],
  },
  {
    id: 'under-bleeddry', name: 'Wrung Dry', faction: 'under', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Drain 4 from an enemy unit or Crystal.',
    targets: [{ what: 'unitOrSpire', side: 'enemy' }], ops: [{ op: 'drain', to: 'target0', n: 4 }],
  },
  {
    id: 'under-chainoverload', name: 'Undertow', faction: 'under', type: 'glyph', cost: 6, speed: 'swift',
    text: 'Drain 3 from every enemy unit.',
    ops: [{ op: 'drain', to: 'enemies', n: 3 }],
  },
  {
    id: 'under-wiremarket', name: 'Open the Grates', faction: 'under', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Summon 3 Shard Rats.',
    ops: [{ op: 'summon', card: 'under-wirerat', n: 3 }],
  },
  {
    id: 'under-leechharvest', name: 'Collect the Dues', faction: 'under', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Drain 2 from the enemy Crystal for each of your units destroyed this round.',
    ops: [{ op: 'drain', to: 'enemySpire', n: { count: 'alliesDiedThisRound', mul: 2 } }],
  },

  // ---------- First Light additions (docs/SETS.md): the strongarm (Graff) and the debtholder (Vell) ----------
  {
    id: 'under-marrow', name: 'Dunstan Graff, Strongarm', faction: 'under', type: 'hero', cost: 3, power: 2, health: 3,
    keywords: ['dread'], tribe: 'syndicate',
    text: 'Dread. Assault: deal 1 damage to the weakest enemy.',
    abilities: [{ on: 'assault', ops: [{ op: 'damage', to: 'weakestEnemy', n: 1 }] }],
    level: { who: 'you', stat: 'enemiesDied', n: 6, text: '6+ enemy units have been destroyed' },
    ascended: {
      name: 'Graff, the Last Knock', power: 4, health: 5, keywords: ['dread'],
      text: 'Dread. Assault: deal 2 damage to the weakest enemy. Ascend: destroy every damaged enemy unit.',
      abilities: [
        { on: 'assault', ops: [{ op: 'damage', to: 'weakestEnemy', n: 2 }] },
        { on: 'ascend', ops: [{ op: 'destroy', to: { from: 'enemies', filter: { damaged: true } } }] },
      ],
    },
  },
  {
    id: 'under-penn', name: 'Mother Agna Vell', faction: 'under', type: 'hero', cost: 3, power: 2, health: 4,
    tribe: 'syndicate',
    text: 'Dusk: drain 1 from the enemy Crystal for each tactic you play this round (at most 2).',
    abilities: [{ on: 'dusk', ops: [{ op: 'drain', to: 'enemySpire', n: { count: 'glyphsThisRound', mul: 1, max: 2 } }] }],
    level: { who: 'you', stat: 'glyphDamage', n: 10, text: 'Your tactics and abilities have dealt 10+ damage' },
    ascended: {
      name: 'Agna Vell, Whom Every House Owes', power: 4, health: 6,
      text: 'Dusk: drain 1 from the enemy Crystal for each tactic you play this round (at most 4). Ascend: drain 1 from the enemy Crystal for each card in your hand (at most 4).',
      abilities: [
        { on: 'dusk', ops: [{ op: 'drain', to: 'enemySpire', n: { count: 'glyphsThisRound', mul: 1, max: 4 } }] },
        { on: 'ascend', ops: [{ op: 'drain', to: 'enemySpire', n: { count: 'hand', mul: 1, max: 4 } }] },
      ],
    },
  },
  {
    id: 'under-skimclerk', name: 'Thumb-Scale Clerk', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'syndicate',
    text: 'Dusk: if you play 2+ tactics this round, deal 1 damage to the enemy Crystal.',
    abilities: [{ on: 'dusk', cond: { c: 'seenRound', stat: 'glyphsCast', gte: 2 }, ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'under-blisterrat', name: 'Seep Rat', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'vermin',
    keywords: ['corrosive', 'unstable'],
    text: 'Corrosive, Unstable.',
  },
  {
    id: 'under-tollrat', name: 'Coin Rat', faction: 'under', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'vermin',
    text: 'Strike: deal 1 damage to the enemy Crystal.',
    abilities: [{ on: 'strike', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'under-kneecapper', name: 'Door-Knocker', faction: 'under', type: 'unit', cost: 2, power: 2, health: 1, tribe: 'syndicate',
    keywords: ['dread'],
    text: 'Dread. Deploy: deal 1 damage to an enemy unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: 1 }] }],
  },
  {
    id: 'under-bagman', name: 'Satchel Man', faction: 'under', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'syndicate',
    text: 'Deploy: deal 1 damage to the enemy Crystal for each tactic you play this round.',
    abilities: [{ on: 'deploy', ops: [{ op: 'damage', to: 'enemySpire', n: { count: 'glyphsThisRound', mul: 1 } }] }],
  },
  {
    id: 'under-wireboundthug', name: 'Tankbound Bruiser', faction: 'under', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'syndicate',
    keywords: ['dread'],
    text: 'Dread. Resonant: I have Corrosive.',
    auras: [{ to: 'self', kw: ['corrosive'], cond: { c: 'resonant' } }],
  },
  {
    id: 'under-vattailor', name: 'Crystal Dyer', faction: 'under', type: 'unit', cost: 3, power: 3, health: 3, tribe: 'syndicate',
    text: 'Deploy: an allied hero gains Corrosive.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally', filter: { hero: true } }], ops: [{ op: 'grant', to: 'target0', kw: ['corrosive'] }] }],
  },
  {
    id: 'under-interestcollector', name: 'Interest Man', faction: 'under', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'syndicate',
    text: 'Dusk: deal 1 damage to every damaged enemy unit.',
    abilities: [{ on: 'dusk', ops: [{ op: 'damage', to: { from: 'enemies', filter: { damaged: true } }, n: 1 }] }],
  },
  {
    id: 'under-grudgekeeper', name: 'Notch-Keeper', faction: 'under', type: 'unit', cost: 3, power: 2, health: 4, tribe: 'syndicate',
    text: 'When an enemy unit is destroyed, I get +1|+0.',
    abilities: [{ on: 'enemyDied', ops: [{ op: 'buff', to: 'self', power: 1 }] }],
  },
  {
    id: 'under-persuasionengine', name: 'Cellar Press', faction: 'under', type: 'unit', cost: 4, power: 3, health: 4, tribe: 'construct',
    text: 'Deploy: an allied unit with Dread and an enemy unit strike each other.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally', filter: { kw: 'dread' } }, { what: 'unit', side: 'enemy' }],
      ops: [{ op: 'duel', a: 'target0', b: 'target1' }],
    }],
  },
  {
    id: 'under-debtassessor', name: 'Lien Assessor', faction: 'under', type: 'unit', cost: 4, power: 3, health: 3, tribe: 'syndicate',
    text: 'Deploy: deal 1 damage to an enemy unit for each card in your hand (at most 3).',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'damage', to: 'target0', n: { count: 'hand', mul: 1, max: 3 } }] }],
  },
  {
    id: 'under-noticeserver', name: 'Lantern Hanger', faction: 'under', type: 'unit', cost: 5, power: 4, health: 4, tribe: 'syndicate',
    text: 'Deploy: destroy a damaged enemy unit. Resonant: I have Dread.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { damaged: true } }], ops: [{ op: 'destroy', to: 'target0' }] }],
    auras: [{ to: 'self', kw: ['dread'], cond: { c: 'resonant' } }],
  },
  {
    id: 'under-taplinecolossus', name: 'Root-Tap Colossus', faction: 'under', type: 'unit', cost: 6, power: 4, health: 6, tribe: 'construct',
    keywords: ['siphon'],
    text: 'Siphon. When you play a tactic, deal 1 damage to the enemy Crystal.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }],
  },
  {
    id: 'under-blackgatejuggernaut', name: 'Soot Juggernaut', faction: 'under', type: 'unit', cost: 7, power: 5, health: 6, tribe: 'construct',
    keywords: ['dread'],
    text: 'Dread. Allied units with Dread have Corrosive.',
    auras: [{ to: 'allies', filter: { kw: 'dread' }, kw: ['corrosive'] }],
  },
  {
    id: 'under-skimtop', name: 'Light Fingers', faction: 'under', type: 'glyph', cost: 1, speed: 'flash',
    text: "Drain 1 from an enemy unit or the enemy Crystal. If you've played 2+ tactics this round, drain 2 instead.",
    targets: [{ what: 'unitOrSpire', side: 'enemy' }],
    ops: [{
      op: 'if', cond: { c: 'seenRound', stat: 'glyphsCast', gte: 2 },
      then: [{ op: 'drain', to: 'target0', n: 2 }],
      else: [{ op: 'drain', to: 'target0', n: 1 }],
    }],
  },
  {
    id: 'under-calledtoaccount', name: 'Called In', faction: 'under', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An allied hero gains Dueler and Corrosive this round.',
    targets: [{ what: 'unit', side: 'ally', filter: { hero: true } }],
    ops: [{ op: 'grant', to: 'target0', kw: ['dueler', 'corrosive'], dur: 'round' }],
  },
  {
    id: 'under-protectionfee', name: 'Lantern Rent', faction: 'under', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Drain 1 from every enemy unit and from the enemy Crystal.',
    ops: [{ op: 'drain', to: 'enemies', n: 1 }, { op: 'drain', to: 'enemySpire', n: 1 }],
  },
  {
    id: 'under-makeexample', name: 'Sent Ahead', faction: 'under', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Destroy an allied unit and deal damage equal to its power to an enemy unit.',
    targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }], needsAllTargets: true,
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'damage', to: 'target1', n: { count: 'target0Power' } }],
  },
  {
    id: 'under-streettax', name: 'Gutter Toll', faction: 'under', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Drain 1 from the enemy Crystal for each enemy unit, at most 4.',
    ops: [{ op: 'drain', to: 'enemySpire', n: { count: 'enemies', mul: 1, max: 4 } }],
  },
  {
    id: 'under-backalleylesson', name: 'Alley Schooling', faction: 'under', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Each allied unit with Dread strikes an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'strike', from: { from: 'allies', filter: { kw: 'dread' } }, to: 'target0' }],
  },
  {
    id: 'under-foreclosure', name: 'Seized', faction: 'under', type: 'glyph', cost: 5, speed: 'swift',
    text: 'Drain 2 from every damaged enemy unit and 2 from the enemy Crystal.',
    ops: [{ op: 'drain', to: { from: 'enemies', filter: { damaged: true } }, n: 2 }, { op: 'drain', to: 'enemySpire', n: 2 }],
  },
  {
    id: 'under-lightsout', name: 'Kill the Lamps', faction: 'under', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Allied units gain Dread this round. Resonant: they also gain Corrosive this round.',
    ops: [
      { op: 'grant', to: 'allies', kw: ['dread'], dur: 'round' },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'grant', to: 'allies', kw: ['corrosive'], dur: 'round' }] },
    ],
  },
  {
    id: 'under-hostiletakeover', name: 'Repossessed', faction: 'under', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Destroy an enemy unit. Drain 2 from the enemy Crystal.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'destroy', to: 'target0' }, { op: 'drain', to: 'enemySpire', n: 2 }],
  },
];
