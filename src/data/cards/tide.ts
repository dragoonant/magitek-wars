// Gale Exchange: merchant sky-guilds on kite-borne airships. Card draw, Stasis, recall, tactic synergy.
import type { CardDef } from '../../engine/types';

export const tide: CardDef[] = [
  {
    id: 'tide-maren', name: 'Captain Dasha Quill', faction: 'tide', type: 'hero', cost: 3, power: 2, health: 4,
    tribe: 'mage',
    text: 'When you play a tactic, I get +1|+0 this round.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'buff', to: 'self', power: 1, dur: 'round' }] }],
    level: { who: 'you', stat: 'glyphsCast', n: 6, text: "You've played 6+ tactics" },
    ascended: {
      name: 'Quill, Broker of Skies', power: 3, health: 5,
      text: 'Your tactics cost 1 less. When you play a tactic, I get +1|+1. Ascend: draw 2.',
      costAuras: [{ type: 'glyph', n: -1 }],
      abilities: [
        { on: 'glyphCast', ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] },
        { on: 'ascend', ops: [{ op: 'draw', n: 2 }] },
      ],
    },
  },
  {
    id: 'tide-ilvane', name: 'Harbourmaster Oren Vey', faction: 'tide', type: 'hero', cost: 5, power: 3, health: 6,
    tribe: 'mage',
    text: 'Deploy: put an enemy unit in Stasis.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }] }],
    level: { who: 'you', stat: 'stasisApplied', n: 4, text: "You've put enemy units in Stasis 4+ times" },
    ascended: {
      name: 'Vey, Master of Moorings', power: 4, health: 7,
      text: 'Deploy: put an enemy unit in Stasis. Dawn: put the strongest enemy in Stasis. Ascend: put every enemy unit in Stasis.',
      abilities: [
        { on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }] },
        { on: 'dawn', ops: [{ op: 'stasis', to: 'strongestEnemy' }] },
        { on: 'ascend', ops: [{ op: 'stasis', to: 'enemies' }] },
      ],
    },
  },

  // ---------- units ----------
  {
    id: 'tide-sluicepage', name: 'Dispatch Runner', faction: 'tide', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'mage',
    text: 'Deploy: draw 1.',
    abilities: [{ on: 'deploy', ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'tide-ripplescribe', name: 'Deal Clerk', faction: 'tide', type: 'unit', cost: 1, power: 1, health: 2, tribe: 'mage',
    text: 'When you play a tactic, I get +1|+0 this round.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'buff', to: 'self', power: 1, dur: 'round' }] }],
  },
  {
    id: 'tide-mirroreel', name: 'Cable Swift', faction: 'tide', type: 'unit', cost: 1, power: 1, health: 1, tribe: 'beast',
    text: 'Deploy: put an enemy unit with 2 or less power in Stasis.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { maxPower: 2 } }], ops: [{ op: 'stasis', to: 'target0' }] }],
  },
  {
    id: 'tide-wardtender', name: 'Canvas Shieldhand', faction: 'tide', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'mage',
    keywords: ['ward'],
    text: 'Ward.',
  },
  {
    id: 'tide-eddycourier', name: 'Winch Courier', faction: 'tide', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'mage',
    text: 'Deploy: return another allied unit to your hand.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'recall', to: 'target0' }] }],
  },
  {
    id: 'tide-driftseer', name: 'Cloud Reader', faction: 'tide', type: 'unit', cost: 2, power: 1, health: 2, tribe: 'mage',
    text: 'Dusk: if you played 2 or more tactics this round, draw 1.',
    abilities: [{ on: 'dusk', cond: { c: 'seenRound', stat: 'glyphsCast', gte: 2 }, ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'tide-lockkeeper', name: 'Gaff-Hook Bosun', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 4, tribe: 'mage',
    text: 'Deploy: return an enemy unit with 2 or less power to its owner\'s hand. Resonant: I have +1|+1.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { maxPower: 2 } }], ops: [{ op: 'recall', to: 'target0' }] }],
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'tide-hushwateradept', name: 'Tangle Netter', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'mage',
    text: 'When you play a tactic, put the weakest enemy in Stasis. If it is already in Stasis, nothing happens.',
    abilities: [{ on: 'glyphCast', ops: [{ op: 'stasis', to: 'weakestEnemy' }] }],
  },
  {
    id: 'tide-glassarchivist', name: 'Chart Broker', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'mage',
    text: 'Deploy: draw 1. Resonant: draw 2 instead.',
    abilities: [{
      on: 'deploy',
      ops: [{ op: 'if', cond: { c: 'resonant' }, then: [{ op: 'draw', n: 2 }], else: [{ op: 'draw', n: 1 }] }],
    }],
  },
  {
    id: 'tide-stillwaterbailiff', name: 'Impound Bailiff', faction: 'tide', type: 'unit', cost: 4, power: 3, health: 4, tribe: 'mage',
    text: 'Deploy: put an enemy unit in Stasis.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }] }],
  },
  {
    id: 'tide-pearlsentinel', name: 'Hull Warden', faction: 'tide', type: 'unit', cost: 4, power: 2, health: 5, tribe: 'construct',
    keywords: ['ward'],
    text: 'Ward. Resonant: I have +1|+1.',
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'tide-deepwateroracle', name: 'Whisper Broker', faction: 'tide', type: 'unit', cost: 5, power: 3, health: 5, tribe: 'mage',
    text: 'Deploy: draw 2.',
    abilities: [{ on: 'deploy', ops: [{ op: 'draw', n: 2 }] }],
  },
  {
    id: 'tide-frostmeremagistrate', name: 'Toll Magistrate', faction: 'tide', type: 'unit', cost: 6, power: 4, health: 6, tribe: 'mage',
    text: 'Deploy: put up to two enemy units in Stasis.',
    abilities: [{
      on: 'deploy',
      targets: [{ what: 'unit', side: 'enemy' }, { what: 'unit', side: 'enemy' }],
      ops: [{ op: 'stasis', to: 'target0' }, { op: 'stasis', to: 'target1' }],
    }],
  },
  {
    id: 'tide-gateleviathan', name: 'Squall Ray', faction: 'tide', type: 'unit', cost: 7, power: 5, health: 7, tribe: 'beast',
    text: 'Deploy: return all enemy units to their owners\' hands.',
    abilities: [{ on: 'deploy', ops: [{ op: 'recall', to: 'enemies' }] }],
  },

  // ---------- tactics ----------
  {
    id: 'tide-slipunder', name: 'Haul Aboard', faction: 'tide', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Return an allied unit to your hand.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'recall', to: 'target0' }],
  },
  {
    id: 'tide-heldbreath', name: 'Grapple Shot', faction: 'tide', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Put an enemy unit in Stasis.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'stasis', to: 'target0' }],
  },
  {
    id: 'tide-tidalveil', name: 'Steam Screen', faction: 'tide', type: 'glyph', cost: 2, speed: 'flash',
    text: 'An allied unit gains Ward.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['ward'] }],
  },
  {
    id: 'tide-quickcurrent', name: 'Pneumatic Post', faction: 'tide', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Draw 1.',
    ops: [{ op: 'draw', n: 1 }],
  },
  {
    id: 'tide-unwrite', name: 'Quiet Payment', faction: 'tide', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Negate an enemy tactic.',
    targets: [{ what: 'glyph', side: 'enemy' }], ops: [{ op: 'negate', to: 'target0' }],
  },
  {
    id: 'tide-backwash', name: 'Prop Wash', faction: 'tide', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Return an enemy unit to its owner\'s hand.',
    targets: [{ what: 'unit', side: 'enemy' }], ops: [{ op: 'recall', to: 'target0' }],
  },
  {
    id: 'tide-sluiceclose', name: 'Impound Chains', faction: 'tide', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Put up to two enemy units in Stasis.',
    targets: [{ what: 'unit', side: 'enemy' }, { what: 'unit', side: 'enemy' }],
    ops: [{ op: 'stasis', to: 'target0' }, { op: 'stasis', to: 'target1' }],
  },
  {
    id: 'tide-deepstudy', name: 'The Chart Room', faction: 'tide', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Draw 3.',
    ops: [{ op: 'draw', n: 3 }],
  },
  {
    id: 'tide-floodtide', name: 'Net from Above', faction: 'tide', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Put every enemy unit in Stasis. Draw 1.',
    ops: [{ op: 'stasis', to: 'enemies' }, { op: 'draw', n: 1 }],
  },

  // ---------- First Light additions (docs/SETS.md): the ledger-keeper and the winchmaster ----------
  {
    id: 'tide-sefa', name: 'Tamsin Rook, Ledger-Keeper', faction: 'tide', type: 'hero', cost: 4, power: 2, health: 5,
    tribe: 'mage',
    text: 'Strike: draw 1.',
    abilities: [{ on: 'strike', ops: [{ op: 'draw', n: 1 }] }],
    level: { who: 'you', stat: 'cardsDrawn', n: 14, text: "You've drawn 14+ cards" },
    ascended: {
      name: 'Rook, Keeper of Debts', power: 4, health: 7,
      text: 'Strike: draw 1. Dusk: draw 1. Ascend: deal damage to the strongest enemy equal to the cards in your hand.',
      abilities: [
        { on: 'strike', ops: [{ op: 'draw', n: 1 }] },
        { on: 'dusk', ops: [{ op: 'draw', n: 1 }] },
        { on: 'ascend', ops: [{ op: 'damage', to: 'strongestEnemy', n: { count: 'hand' } }] },
      ],
    },
  },
  {
    id: 'tide-corra', name: 'Bram Tollhook, Winchmaster', faction: 'tide', type: 'hero', cost: 4, power: 3, health: 4,
    tribe: 'mage',
    text: 'Deploy: return another allied unit to your hand and put an enemy unit in Stasis.',
    abilities: [{
      on: 'deploy',
      targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
      ops: [{ op: 'recall', to: 'target0' }, { op: 'stasis', to: 'target1' }],
    }],
    level: { who: 'you', stat: 'recalled', n: 5, text: "You've returned 5+ units to a hand" },
    ascended: {
      name: 'Tollhook, Lord of Winches', power: 4, health: 6,
      text: 'Your units cost 1 less. Deploy: return another allied unit to your hand and put an enemy unit in Stasis. ' +
        "Ascend: return every enemy unit with 3 or less power to its owner's hand.",
      costAuras: [{ type: 'unit', n: -1 }],
      abilities: [
        {
          on: 'deploy',
          targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
          ops: [{ op: 'recall', to: 'target0' }, { op: 'stasis', to: 'target1' }],
        },
        { on: 'ascend', ops: [{ op: 'recall', to: { from: 'enemies', filter: { maxPower: 3 } } }] },
      ],
    },
  },
  {
    id: 'tide-siltnewt', name: 'Carrier Tern', faction: 'tide', type: 'unit', cost: 1, power: 0, health: 3, tribe: 'beast',
    text: 'Shatter: draw 1.',
    abilities: [{ on: 'shatter', ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'tide-marginclerk', name: 'Junior Ledger-Hand', faction: 'tide', type: 'unit', cost: 2, power: 1, health: 1, tribe: 'mage',
    text: 'Deploy: I get +1|+1 for each card in your hand, up to +2|+2.',
    abilities: [{
      on: 'deploy',
      ops: [{ op: 'buff', to: 'self', power: { count: 'hand', mul: 1, max: 2 }, health: { count: 'hand', mul: 1, max: 2 } }],
    }],
  },
  {
    id: 'tide-lockhound', name: 'Impound Hound', faction: 'tide', type: 'unit', cost: 1, power: 2, health: 1, tribe: 'beast',
    text: "Deploy: return an enemy unit in Stasis to its owner's hand.",
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { stasis: true } }], ops: [{ op: 'recall', to: 'target0' }] }],
  },
  {
    id: 'tide-undertowsprite', name: 'Rigging Ferret', faction: 'tide', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'beast',
    text: 'When another ally is summoned, if you sent a unit back to a hand this round, I get +1|+1.',
    abilities: [{ on: 'allySummoned', cond: { c: 'seenRound', stat: 'recalled', gte: 1 }, ops: [{ op: 'buff', to: 'self', power: 1, health: 1 }] }],
  },
  {
    id: 'tide-tallyframe', name: 'Tally Engine', faction: 'tide', type: 'unit', cost: 2, power: 1, health: 3, tribe: 'construct',
    text: 'When I take damage and survive, draw 1.',
    abilities: [{ on: 'survive', ops: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'tide-reedmarshheron', name: 'Masthead Heron', faction: 'tide', type: 'unit', cost: 2, power: 2, health: 2, tribe: 'beast',
    keywords: ['spotter'],
    text: 'Spotter. Resonant: I have +1|+2.',
    auras: [{ to: 'self', power: 1, health: 2, cond: { c: 'resonant' } }],
  },
  {
    id: 'tide-tidemarkreader', name: 'Manifest Purser', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'mage',
    text: 'Deploy: if you sent a unit back to a hand this round, I get +2|+2.',
    abilities: [{ on: 'deploy', cond: { c: 'seenRound', stat: 'recalled', gte: 1 }, ops: [{ op: 'buff', to: 'self', power: 2, health: 2 }] }],
  },
  {
    id: 'tide-shelfwarden', name: 'Strongbox Frame', faction: 'tide', type: 'unit', cost: 3, power: 1, health: 5, tribe: 'construct',
    text: 'Dawn: I get +1|+0 this round for each card in your hand, up to +3|+0.',
    abilities: [{ on: 'dawn', ops: [{ op: 'buff', to: 'self', power: { count: 'hand', mul: 1, max: 3 }, dur: 'round' }] }],
  },
  {
    id: 'tide-backflowlancer', name: 'Hook Lancer', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 3, tribe: 'mage',
    text: "Assault: return the weakest enemy to its owner's hand.",
    abilities: [{ on: 'assault', ops: [{ op: 'recall', to: 'weakestEnemy' }] }],
  },
  {
    id: 'tide-weirgolem', name: 'Dock Crane Hulk', faction: 'tide', type: 'unit', cost: 4, power: 2, health: 5, tribe: 'construct',
    text: "Strike: return the unit I fought to its owner's hand.",
    abilities: [{ on: 'strike', ops: [{ op: 'recall', to: 'opposing' }] }],
  },
  {
    id: 'tide-brineboundsage', name: 'Bounty Broker', faction: 'tide', type: 'unit', cost: 4, power: 3, health: 4, tribe: 'mage',
    text: 'Deploy: if an enemy unit is in Stasis, draw 2.',
    abilities: [{
      on: 'deploy',
      cond: { c: 'count', of: { from: 'enemies', filter: { stasis: true } }, gte: 1 },
      ops: [{ op: 'draw', n: 2 }],
    }],
  },
  {
    id: 'tide-sluicegatebehemoth', name: 'Cable Ox', faction: 'tide', type: 'unit', cost: 5, power: 4, health: 5, tribe: 'beast',
    text: 'Assault: put the strongest enemy in Stasis. Resonant: I have +1|+1.',
    abilities: [{ on: 'assault', ops: [{ op: 'stasis', to: 'strongestEnemy' }] }],
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'tide-floodwallcolossus', name: 'Anchor Colossus', faction: 'tide', type: 'unit', cost: 6, power: 4, health: 6, tribe: 'construct',
    keywords: ['plated'],
    text: "Plated. Shatter: return every enemy unit to its owner's hand.",
    abilities: [{ on: 'shatter', ops: [{ op: 'recall', to: 'enemies' }] }],
  },
  {
    id: 'tide-lorewhale', name: 'High Hauler', faction: 'tide', type: 'unit', cost: 8, power: 6, health: 7, tribe: 'beast',
    keywords: ['aerial'],
    text: 'Aerial. Assault: draw 2.',
    abilities: [{ on: 'assault', ops: [{ op: 'draw', n: 2 }] }],
  },
  {
    id: 'tide-boundvolume', name: 'Stopped by the Ledger', faction: 'tide', type: 'glyph', cost: 1, speed: 'flash',
    text: 'An allied unit gets +0|+1 this round for each card in your hand.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'buff', to: 'target0', health: { count: 'hand', mul: 1 }, dur: 'round' }],
  },
  {
    id: 'tide-pulloftheweir', name: 'Snatch Line', faction: 'tide', type: 'glyph', cost: 2, speed: 'flash',
    text: "Return a unit in combat with 3 or less power to its owner's hand.",
    targets: [{ what: 'unit', side: 'any', filter: { maxPower: 3 }, inCombat: true }],
    ops: [{ op: 'recall', to: 'target0' }],
  },
  {
    id: 'tide-mooringline', name: 'Tether Shot', faction: 'tide', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Put an enemy unit in combat in Stasis and draw 1.',
    targets: [{ what: 'unit', side: 'enemy', inCombat: true }],
    ops: [{ op: 'stasis', to: 'target0' }, { op: 'draw', n: 1 }],
  },
  {
    id: 'tide-readthecurrent', name: 'Read the Wind', faction: 'tide', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Draw 1. If you sent a unit back to a hand this round, draw 1 more.',
    ops: [{ op: 'draw', n: 1 }, { op: 'if', cond: { c: 'seenRound', stat: 'recalled', gte: 1 }, then: [{ op: 'draw', n: 1 }] }],
  },
  {
    id: 'tide-rifflethestacks', name: "Broker's Drawers", faction: 'tide', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Draw 2. Resonant: draw 3 instead.',
    ops: [{ op: 'if', cond: { c: 'resonant' }, then: [{ op: 'draw', n: 3 }], else: [{ op: 'draw', n: 2 }] }],
  },
  {
    id: 'tide-lockandrelease', name: 'Cargo Swap', faction: 'tide', type: 'glyph', cost: 4, speed: 'swift',
    text: "Return an allied unit to your hand and an enemy unit to its owner's hand.",
    targets: [{ what: 'unit', side: 'ally' }, { what: 'unit', side: 'enemy' }],
    ops: [{ op: 'recall', to: 'target0' }, { op: 'recall', to: 'target1' }],
  },
  {
    id: 'tide-sluicesweep', name: 'Downdraft', faction: 'tide', type: 'glyph', cost: 5, speed: 'swift',
    text: "Return up to two enemy units with 3 or less power to their owners' hands.",
    targets: [{ what: 'unit', side: 'enemy', filter: { maxPower: 3 } }, { what: 'unit', side: 'enemy', filter: { maxPower: 3 } }],
    ops: [{ op: 'recall', to: 'target0' }, { op: 'recall', to: 'target1' }],
  },
  {
    id: 'tide-homewardcurrent', name: 'Homeward Flare', faction: 'tide', type: 'glyph', cost: 3, speed: 'ritual',
    text: 'Return an allied unit to your hand and draw 2.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'recall', to: 'target0' }, { op: 'draw', n: 2 }],
  },
  {
    id: 'tide-turnofthelocks', name: 'Cast Off', faction: 'tide', type: 'glyph', cost: 6, speed: 'ritual',
    text: "Return every unit to its owner's hand, then draw 2.",
    ops: [{ op: 'recall', to: 'all' }, { op: 'draw', n: 2 }],
  },
];
