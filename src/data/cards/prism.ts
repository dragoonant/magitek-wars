// Prismguard: the wardens of the upper tiers. Plated, Ward, Spotter, wide buffs, repair.
import type { CardDef } from '../../engine/types';

export const prism: CardDef[] = [
  {
    id: 'prism-ysolde', name: 'Ysolde, Shield-Captain', faction: 'prism', type: 'hero', cost: 3, power: 2, health: 4,
    keywords: ['plated'], tribe: 'warden',
    text: 'Plated. Dusk: repair every ally by 1.',
    abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'allies', n: 1 }] }],
    level: { who: 'you', stat: 'allySurvivals', n: 6, text: 'Your units have survived damage 6+ times' },
    ascended: {
      name: 'Ysolde, Aegis of the Tiers', power: 3, health: 5, keywords: ['plated'],
      text: 'Plated. Other allies have +1|+1. Dusk: repair every ally by 1. Ascend: give every ally Ward.',
      auras: [{ to: 'otherAllies', power: 1, health: 1 }],
      abilities: [
        { on: 'dusk', ops: [{ op: 'heal', to: 'allies', n: 1 }] },
        { on: 'ascend', ops: [{ op: 'grant', to: 'allies', kw: ['ward'] }] },
      ],
    },
  },
  {
    id: 'prism-oren', name: 'Oren Halvard, the Lightwall', faction: 'prism', type: 'hero', cost: 5, power: 3, health: 7,
    keywords: ['spotter'], tribe: 'warden',
    text: 'Spotter. When I survive damage, I get +1|+0.',
    abilities: [{ on: 'survive', ops: [{ op: 'buff', to: 'self', power: 1 }] }],
    level: { who: 'self', stat: 'survivals', n: 3, text: "I've survived damage 3+ times" },
    ascended: {
      name: 'Oren, Unbroken', power: 5, health: 8, keywords: ['spotter', 'plated'],
      text: 'Spotter, Plated. When I survive damage, I get +1|+0 and deal 2 to the strongest enemy (highest power). Ascend: repair your Spire by 4.',
      abilities: [
        { on: 'survive', ops: [{ op: 'buff', to: 'self', power: 1 }, { op: 'damage', to: 'strongestEnemy', n: 2 }] },
        { on: 'ascend', ops: [{ op: 'heal', to: 'mySpire', n: 4 }] },
      ],
    },
  },
  // ---------- units ----------
  {
    id: 'prism-glasswarden', name: 'Glass Warden', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 3,
    keywords: ['plated'], tribe: 'warden', text: 'Plated.',
  },
  {
    id: 'prism-lampkeeper', name: 'Lamp-Keeper', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 2,
    keywords: ['spotter'], tribe: 'warden', text: 'Spotter. Dusk: repair the weakest ally (lowest power) by 1.',
    abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'weakestAlly', n: 1 }] }],
  },
  {
    id: 'prism-facet-initiate', name: 'Facet Initiate', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 2,
    tribe: 'lens-wright', text: 'Deploy: give an ally +0|+1.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'buff', to: 'target0', health: 1 }] }],
  },
  {
    id: 'prism-tierguard', name: 'Tier Guard', faction: 'prism', type: 'unit', cost: 2, power: 2, health: 2,
    keywords: ['ward'], tribe: 'warden', text: 'Ward. Resonant: I have +1|+1.',
    auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
  },
  {
    id: 'prism-bracewright', name: 'Bracewright', faction: 'prism', type: 'unit', cost: 2, power: 1, health: 3,
    keywords: ['dueler'], tribe: 'lens-wright', text: 'Dueler. When I survive damage, repair me by 1.',
    abilities: [{ on: 'survive', ops: [{ op: 'heal', to: 'self', n: 1 }] }],
  },
  {
    id: 'prism-pane-mender', name: 'Pane-Mender', faction: 'prism', type: 'unit', cost: 2, power: 1, health: 3,
    tribe: 'lens-wright', text: 'Deploy: repair an ally by 4.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'heal', to: 'target0', n: 4 }] }],
  },
  {
    id: 'prism-crystal-bulwark', name: 'Crystal Bulwark', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 4,
    keywords: ['plated'], tribe: 'construct', text: 'Plated.',
  },
  {
    id: 'prism-chorus-warden', name: 'Chorus Warden', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'warden', text: 'Other allies have +0|+1. Resonant: I have +1|+1.',
    auras: [
      { to: 'otherAllies', health: 1 },
      { to: 'self', power: 1, health: 1, cond: { c: 'resonant' } },
    ],
  },
  {
    id: 'prism-sentinel-lens', name: 'Sentinel Lens', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 3,
    keywords: ['spotter'], tribe: 'construct', text: 'Spotter. Deploy: give an ally Ward.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['ward'] }] }],
  },
  {
    id: 'prism-aegis-colossus', name: 'Aegis Colossus', faction: 'prism', type: 'unit', cost: 4, power: 3, health: 4,
    keywords: ['plated', 'dueler'], tribe: 'construct', text: 'Plated, Dueler.',
  },
  {
    id: 'prism-vault-captain', name: 'Vault Captain', faction: 'prism', type: 'unit', cost: 4, power: 2, health: 4,
    keywords: ['plated'], tribe: 'warden', text: 'Plated. Other allies have +1|+0.',
    auras: [{ to: 'otherAllies', power: 1 }],
  },
  {
    id: 'prism-spire-keeper', name: 'Spire Keeper', faction: 'prism', type: 'unit', cost: 5, power: 3, health: 5,
    keywords: ['plated'], tribe: 'warden', text: 'Plated. Dusk: repair your Spire by 2.',
    abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'mySpire', n: 2 }] }],
  },
  {
    id: 'prism-lightwall-matron', name: 'Lightwall Matron', faction: 'prism', type: 'unit', cost: 6, power: 3, health: 6,
    keywords: ['spotter'], tribe: 'warden', text: 'Spotter. Other allies have +1|+1.',
    auras: [{ to: 'otherAllies', power: 1, health: 1 }],
  },
  {
    id: 'prism-tier-sovereign', name: 'Tier Sovereign', faction: 'prism', type: 'unit', cost: 7, power: 5, health: 8,
    keywords: ['plated'], tribe: 'warden', text: 'Plated. Deploy: give every other ally Ward.',
    abilities: [{ on: 'deploy', ops: [{ op: 'grant', to: 'otherAllies', kw: ['ward'] }] }],
  },
  // ---------- glyphs ----------
  {
    id: 'prism-hold-the-line', name: 'Hold the Line', faction: 'prism', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Give an ally Plated this round.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['plated'], dur: 'round' }],
  },
  {
    id: 'prism-mirror-ward', name: 'Mirror Ward', faction: 'prism', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Give an ally Ward.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['ward'] }],
  },
  {
    id: 'prism-choir-of-facets', name: 'Choir of Facets', faction: 'prism', type: 'glyph', cost: 3, speed: 'flash',
    text: 'Give every ally +1|+1 this round. Resonant: also repair every ally by 2.',
    ops: [
      { op: 'buff', to: 'allies', power: 1, health: 1, dur: 'round' },
      { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'heal', to: 'allies', n: 2 }] },
    ],
  },
  {
    id: 'prism-patch-the-pane', name: 'Patch the Pane', faction: 'prism', type: 'glyph', cost: 1, speed: 'swift',
    text: 'Repair an ally by 4.',
    targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'heal', to: 'target0', n: 4 }],
  },
  {
    id: 'prism-call-out', name: 'Call Out', faction: 'prism', type: 'glyph', cost: 2, speed: 'swift',
    text: 'Give an ally Dueler and +0|+2 this round.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'grant', to: 'target0', kw: ['dueler'], dur: 'round' }, { op: 'buff', to: 'target0', health: 2, dur: 'round' }],
  },
  {
    id: 'prism-lightwall-oath', name: 'Lightwall Oath', faction: 'prism', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Give an ally +0|+2 and Plated.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{ op: 'buff', to: 'target0', health: 2 }, { op: 'grant', to: 'target0', kw: ['plated'] }],
  },
  {
    id: 'prism-spire-mantle', name: 'Spire Mantle', faction: 'prism', type: 'glyph', cost: 5, speed: 'swift',
    text: 'Repair your Spire by 5 and give every ally Ward.',
    ops: [{ op: 'heal', to: 'mySpire', n: 5 }, { op: 'grant', to: 'allies', kw: ['ward'] }],
  },
  {
    id: 'prism-tier-rally', name: 'Tier Rally', faction: 'prism', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Give every ally +1|+1.',
    ops: [{ op: 'buff', to: 'allies', power: 1, health: 1 }],
  },
  {
    id: 'prism-crystal-dawn', name: 'Crystal Dawn', faction: 'prism', type: 'glyph', cost: 6, speed: 'ritual',
    text: 'Give every ally +2|+2, then repair every ally fully. Repair your Spire by 3.',
    ops: [{ op: 'buff', to: 'allies', power: 2, health: 2 }, { op: 'heal', to: 'allies', n: 99 }, { op: 'heal', to: 'mySpire', n: 3 }],
  },
  // ---------- First Light additions (docs/SETS.md): formation (Tamsin) and lens-gunner (Orrin) ----------
  {
    id: 'prism-tamsin', name: 'Tamsin Vey, Drill-Marshal', faction: 'prism', type: 'hero', cost: 3, power: 2, health: 3,
    tribe: 'warden',
    text: 'Dusk: give every ally with 2 or less power +0|+1.',
    abilities: [{ on: 'dusk', ops: [{ op: 'buff', to: { from: 'allies', filter: { maxPower: 2 } }, health: 1 }] }],
    level: { who: 'you', stat: 'buffsGiven', n: 15, text: "You've given allies a stat buff 15+ times" },
    ascended: {
      name: 'Tamsin, the Living Formation', power: 3, health: 5, keywords: ['plated'],
      text: 'Plated. Dusk: give every ally with 2 or less power +1|+1. Ascend: summon 1|1 Tier Recruits until you have 6 units.',
      abilities: [
        { on: 'dusk', ops: [{ op: 'buff', to: { from: 'allies', filter: { maxPower: 2 } }, power: 1, health: 1 }] },
        { on: 'ascend', ops: [{ op: 'summon', card: 'prism-tier-recruit', n: { count: 'allies', mul: -1, plus: 6 } }] },
      ],
    },
  },
  {
    id: 'prism-orrin', name: 'Davit Orrin, Lens-Gunner', faction: 'prism', type: 'hero', cost: 4, power: 2, health: 4,
    keywords: ['spotter'], tribe: 'warden',
    text: 'Spotter. Deploy: deal 1 to an enemy unit, then 2 more to it if it is Aerial.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }],
      ops: [{ op: 'damage', to: 'target0', n: 1 }, { op: 'damage', to: { from: 'target0', filter: { kw: 'aerial' } }, n: 2 }],
    }],
    level: { who: 'self', stat: 'kills', n: 3, text: "I've destroyed 3+ enemy units" },
    ascended: {
      name: 'Orrin, Skybreaker', power: 4, health: 6, keywords: ['spotter'],
      text: 'Spotter. Deploy: deal 1 to an enemy unit, then 2 more to it if it is Aerial. When an enemy unit is destroyed, I get +1|+0. Ascend: deal 2 to every enemy unit, then 2 more to every enemy Aerial unit.',
      abilities: [
        {
          on: 'deploy', targets: [{ what: 'unit', side: 'enemy' }],
          ops: [{ op: 'damage', to: 'target0', n: 1 }, { op: 'damage', to: { from: 'target0', filter: { kw: 'aerial' } }, n: 2 }],
        },
        { on: 'enemyDied', ops: [{ op: 'buff', to: 'self', power: 1 }] },
        { on: 'ascend', ops: [{ op: 'damage', to: 'enemies', n: 2 }, { op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 2 }] },
      ],
    },
  },
  {
    id: 'prism-tier-recruit', name: 'Tier Recruit', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 1, token: true,
    tribe: 'warden', text: '',
  },
  {
    id: 'prism-shieldline-cadet', name: 'Shieldline Cadet', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 1,
    tribe: 'warden', text: 'When another ally is summoned, give it +0|+1 if it is a warden.',
    abilities: [{ on: 'allySummoned', ops: [{ op: 'buff', to: { from: 'trigger', filter: { tribe: 'warden' } }, health: 1 }] }],
  },
  {
    id: 'prism-glint-scout', name: 'Glint Scout', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 1,
    keywords: ['spotter'], tribe: 'construct', text: 'Spotter. Deploy: deal 1 to an enemy Aerial unit.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { kw: 'aerial' } }], ops: [{ op: 'damage', to: 'target0', n: 1 }] }],
  },
  {
    id: 'prism-rank-drummer', name: 'Rank Drummer', faction: 'prism', type: 'unit', cost: 1, power: 1, health: 1,
    tribe: 'warden', text: 'Deploy: if you have 3 or more other allies, give every other ally +0|+1.',
    abilities: [{ on: 'deploy', cond: { c: 'count', of: 'otherAllies', gte: 3 }, ops: [{ op: 'buff', to: 'otherAllies', health: 1 }] }],
  },
  {
    id: 'prism-lens-fitter', name: 'Lens-Fitter', faction: 'prism', type: 'unit', cost: 2, power: 1, health: 3,
    keywords: ['spotter'], tribe: 'lens-wright', text: 'Spotter. Deploy: give an ally Spotter.',
    abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'ally' }], ops: [{ op: 'grant', to: 'target0', kw: ['spotter'] }] }],
  },
  {
    id: 'prism-shield-sergeant', name: 'Shield Sergeant', faction: 'prism', type: 'unit', cost: 2, power: 2, health: 2,
    tribe: 'warden', text: 'Assault: give every attacking ally with 2 or less power +1|+0 this round.',
    abilities: [{ on: 'assault', ops: [{ op: 'buff', to: { from: 'attackers', filter: { maxPower: 2 } }, power: 1, dur: 'round' }] }],
  },
  {
    id: 'prism-flak-tripod', name: 'Flak Tripod', faction: 'prism', type: 'unit', cost: 2, power: 2, health: 1,
    keywords: ['spotter'], tribe: 'construct', text: 'Spotter. Strike: deal 1 to every enemy Aerial unit.',
    abilities: [{ on: 'strike', ops: [{ op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 1 }] }],
  },
  {
    id: 'prism-range-warden', name: 'Range Warden', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 4,
    tribe: 'warden', text: 'Deploy: an allied Spotter strikes an enemy Aerial unit.',
    abilities: [{
      on: 'deploy',
      targets: [{ what: 'unit', side: 'ally', filter: { kw: 'spotter' } }, { what: 'unit', side: 'enemy', filter: { kw: 'aerial' } }],
      ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
    }],
  },
  {
    id: 'prism-rampart-herald', name: 'Rampart Herald', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 3,
    tribe: 'warden', text: 'Deploy: give an ally +1|+1. Resonant: also give it Ward.',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }],
      ops: [
        { op: 'buff', to: 'target0', power: 1, health: 1 },
        { op: 'if', cond: { c: 'resonant' }, then: [{ op: 'grant', to: 'target0', kw: ['ward'] }] },
      ],
    }],
  },
  {
    id: 'prism-tier-pikeman', name: 'Tier Pikeman', faction: 'prism', type: 'unit', cost: 3, power: 2, health: 2,
    tribe: 'warden', text: 'While you have 4 or more allies, I have +2|+1 and Plated.',
    auras: [{ to: 'self', power: 2, health: 1, kw: ['plated'], cond: { c: 'count', of: 'allies', gte: 4 } }],
  },
  {
    id: 'prism-lens-battery', name: 'Lens Battery', faction: 'prism', type: 'unit', cost: 4, power: 2, health: 5,
    keywords: ['spotter'], tribe: 'construct', text: 'Spotter. Other allies with Spotter have +1|+1.',
    auras: [{ to: 'otherAllies', filter: { kw: 'spotter' }, power: 1, health: 1 }],
  },
  {
    id: 'prism-cohort-drillmaster', name: 'Cohort Drillmaster', faction: 'prism', type: 'unit', cost: 4, power: 3, health: 4,
    tribe: 'warden', text: 'Deploy: give an ally +1|+0 for each other ally you have (at most 4).',
    abilities: [{
      on: 'deploy', targets: [{ what: 'unit', side: 'ally' }],
      ops: [{ op: 'buff', to: 'target0', power: { count: 'otherAllies', mul: 1, max: 4 } }],
    }],
  },
  {
    id: 'prism-skylens-bastion', name: 'Skylens Bastion', faction: 'prism', type: 'unit', cost: 5, power: 3, health: 5,
    keywords: ['spotter', 'plated'], tribe: 'construct', text: 'Spotter, Plated. Dusk: deal 2 to every enemy Aerial unit.',
    abilities: [{ on: 'dusk', ops: [{ op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 2 }] }],
  },
  {
    id: 'prism-muster-bell', name: 'Muster Bell', faction: 'prism', type: 'unit', cost: 6, power: 2, health: 5,
    tribe: 'construct', text: 'Deploy: summon a 1|1 Tier Recruit, plus one for each enemy unit (at most 4).',
    abilities: [{ on: 'deploy', ops: [{ op: 'summon', card: 'prism-tier-recruit', n: { count: 'enemies', mul: 1, plus: 1, max: 4 } }] }],
  },
  {
    id: 'prism-gilded-phalanx', name: 'Gilded Phalanx', faction: 'prism', type: 'unit', cost: 7, power: 5, health: 7,
    keywords: ['plated'], tribe: 'warden', text: 'Plated. Deploy: give every other ally +1|+1. Resonant: give them +2|+2 instead.',
    abilities: [{
      on: 'deploy',
      ops: [{
        op: 'if', cond: { c: 'resonant' },
        then: [{ op: 'buff', to: 'otherAllies', power: 2, health: 2 }],
        else: [{ op: 'buff', to: 'otherAllies', power: 1, health: 1 }],
      }],
    }],
  },
  {
    id: 'prism-steady-aim', name: 'Steady Aim', faction: 'prism', type: 'glyph', cost: 1, speed: 'flash',
    text: 'Give an allied Spotter +2|+0 this round.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'spotter' } }],
    ops: [{ op: 'buff', to: 'target0', power: 2, dur: 'round' }],
  },
  {
    id: 'prism-lock-shields', name: 'Lock Shields', faction: 'prism', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Give every ally with 2 or less power +0|+2 this round.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { maxPower: 2 } }, health: 2, dur: 'round' }],
  },
  {
    id: 'prism-flak-burst', name: 'Flak Burst', faction: 'prism', type: 'glyph', cost: 2, speed: 'flash',
    text: 'Deal 1 to every enemy Aerial unit. Resonant: deal 2 instead.',
    ops: [{
      op: 'if', cond: { c: 'resonant' },
      then: [{ op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 2 }],
      else: [{ op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 1 }],
    }],
  },
  {
    id: 'prism-covering-fire', name: 'Covering Fire', faction: 'prism', type: 'glyph', cost: 3, speed: 'swift',
    text: 'An allied Spotter strikes an enemy unit that is attacking or blocking.',
    targets: [{ what: 'unit', side: 'ally', filter: { kw: 'spotter' } }, { what: 'unit', side: 'enemy', inCombat: true }],
    needsAllTargets: true,
    ops: [{ op: 'strike', from: 'target0', to: 'target1' }],
  },
  {
    id: 'prism-shoulder-to-shoulder', name: 'Shoulder to Shoulder', faction: 'prism', type: 'glyph', cost: 3, speed: 'swift',
    text: 'Give an ally +2|+2 this round, or a lasting +2|+2 if you have 4 or more allies.',
    targets: [{ what: 'unit', side: 'ally' }],
    ops: [{
      op: 'if', cond: { c: 'count', of: 'allies', gte: 4 },
      then: [{ op: 'buff', to: 'target0', power: 2, health: 2 }],
      else: [{ op: 'buff', to: 'target0', power: 2, health: 2, dur: 'round' }],
    }],
  },
  {
    id: 'prism-field-glazing', name: 'Field Glazing', faction: 'prism', type: 'glyph', cost: 4, speed: 'swift',
    text: 'Give every damaged ally +1|+1, then repair every ally by 2.',
    ops: [{ op: 'buff', to: { from: 'allies', filter: { damaged: true } }, power: 1, health: 1 }, { op: 'heal', to: 'allies', n: 2 }],
  },
  {
    id: 'prism-cut-the-sky', name: 'Cut the Sky', faction: 'prism', type: 'glyph', cost: 6, speed: 'swift',
    text: 'Deal 3 to every enemy Aerial unit and 1 to every other enemy unit.',
    ops: [
      { op: 'damage', to: { from: 'enemies', filter: { kw: 'aerial' } }, n: 3 },
      { op: 'damage', to: { from: 'enemies', filter: { notKw: 'aerial' } }, n: 1 },
    ],
  },
  {
    id: 'prism-focused-volley', name: 'Focused Volley', faction: 'prism', type: 'glyph', cost: 4, speed: 'ritual',
    text: 'Every allied Spotter strikes an enemy unit.',
    targets: [{ what: 'unit', side: 'enemy' }],
    ops: [{ op: 'strike', from: { from: 'allies', filter: { kw: 'spotter' } }, to: 'target0' }],
  },
  {
    id: 'prism-grand-muster', name: 'Grand Muster', faction: 'prism', type: 'glyph', cost: 5, speed: 'ritual',
    text: 'Summon two 1|1 Tier Recruits, then give every ally +1|+1.',
    ops: [{ op: 'summon', card: 'prism-tier-recruit', n: 2 }, { op: 'buff', to: 'allies', power: 1, health: 1 }],
  },
];
