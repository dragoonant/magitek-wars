import { describe, expect, it } from 'vitest';
import { act, applyAction, attack, board, kinds, pass, play, resolveCombat, st, unit } from '../helpers';
import { isAscended } from '../../src/engine/query';

type G = ReturnType<typeof board>;
const tryPlay = (s: G, card: string, targets: string[] = [], replace?: string) => {
  const hc = s.players[s.priority].hand.find((h) => h.card === card);
  if (!hc) throw new Error(`${card} not in hand`);
  return applyAction(s, { type: 'play', iid: hc.iid, ...(targets.length ? { targets } : {}), ...(replace ? { replace } : {}) });
};
const endRound = (s: G): void => { pass(s); pass(s); };
/** Declare the attacker and lock in, leaving the defender in the block phase (no blocks assigned yet). */
const declare = (s: G, iid: string): void => { act(s, { type: 'declare', unit: iid }); act(s, { type: 'attack' }); };

const cards = (s: ReturnType<typeof board>, seat: 0 | 1): string[] => s.players[seat].line.map((u) => u.card);

describe('under cards', () => {
  it('under-fuserunner: Shatter drains 1 from the enemy Spire', () => {
    const s = board({ hand: [[], ['zz-zap']], line: [['under-fuserunner'], []], first: 1 });
    s.players[0].spire = 15;
    play(s, 'zz-zap', [unit(s, 0, 'under-fuserunner').iid]);
    expect(cards(s, 0)).toEqual([]);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(16);
  });

  it('under-leechtick: Siphon repairs the Spire by its strike damage', () => {
    const s = board({ line: [['under-leechtick'], []] });
    s.players[0].spire = 10;
    attack(s, [unit(s, 0, 'under-leechtick')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(11);
  });

  it('under-burnoutrunner: Dread dodges small blockers; Unstable dies at Dusk', () => {
    const s = board({ line: [['under-burnoutrunner'], ['zz-grunt']] });
    attack(s, [unit(s, 0, 'under-burnoutrunner')]);
    expect(s.phase).toBe('combat'); // the grunt (2 power) cannot block a Dread unit
    resolveCombat(s);
    expect(s.players[1].spire).toBe(18);
    pass(s); pass(s);
    expect(cards(s, 0)).toEqual([]);
    expect(s.players[0].seen.alliesDied).toBe(1);
  });

  it('under-ratwrangler: Deploy summons a Wire Rat; Resonant summons 2', () => {
    const plain = board({ hand: [['under-ratwrangler'], []] });
    play(plain, 'under-ratwrangler');
    expect(cards(plain, 0)).toEqual(['under-ratwrangler', 'under-wirerat']);
    const res = board({ hand: [['under-ratwrangler'], []], line: [['under-vex'], []] });
    res.players[0].ascended = ['under-vex'];
    play(res, 'under-ratwrangler');
    expect(cards(res, 0)).toEqual(['under-vex', 'under-ratwrangler', 'under-wirerat', 'under-wirerat']);
  });

  it('under-pitaccountant: drains 1 when another ally is destroyed; Resonant gives +1|+1', () => {
    const s = board({ hand: [[], ['zz-zap']], line: [['under-pitaccountant', 'zz-grunt', 'under-vex'], []], first: 1 });
    s.players[0].spire = 15;
    unit(s, 0, 'zz-grunt').dmg = 1;
    expect(st(s, unit(s, 0, 'under-pitaccountant'))).toMatchObject({ power: 1, health: 3 });
    play(s, 'zz-zap', [unit(s, 0, 'zz-grunt').iid]);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(16);
    s.players[0].ascended = ['under-vex'];
    expect(st(s, unit(s, 0, 'under-pitaccountant'))).toMatchObject({ power: 2, health: 4 });
  });

  it('under-acidlamplighter: Corrosive destroys a much bigger blocker', () => {
    const s = board({ line: [['under-acidlamplighter'], ['zz-ogre']] });
    const l = unit(s, 0, 'under-acidlamplighter');
    const o = unit(s, 1, 'zz-ogre');
    attack(s, [l], [[o, l]]);
    resolveCombat(s);
    expect(cards(s, 1)).toEqual([]);
  });

  it('under-furnacehand: Deploy destroys an allied unit', () => {
    const s = board({ hand: [['under-furnacehand'], []], line: [['zz-grunt'], []] });
    play(s, 'under-furnacehand', [unit(s, 0, 'zz-grunt').iid]);
    expect(cards(s, 0)).toEqual(['under-furnacehand']);
    expect(s.players[0].seen.alliesDied).toBe(1);
    expect(st(s, unit(s, 0, 'under-furnacehand'))).toMatchObject({ power: 4, health: 4 });
  });

  it('under-backalleyenforcer: Dread cannot be blocked by units with 2 or less power', () => {
    const s = board({ line: [['under-backalleyenforcer'], ['zz-grunt', 'zz-wall']] });
    attack(s, [unit(s, 0, 'under-backalleyenforcer')]);
    expect(s.phase).toBe('combat');
    resolveCombat(s);
    expect(s.players[1].spire).toBe(17);
  });

  it('under-leechwiresurgeon: Deploy drains 2 from an enemy unit and repairs the Spire', () => {
    const s = board({ hand: [['under-leechwiresurgeon'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-leechwiresurgeon', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(s.players[0].spire).toBe(12);
    expect(s.players[0].seen.spireHealed).toBe(2);
  });

  it('under-vaultpawnbroker: an enemy unit dying drains 1 from the enemy Spire', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['under-vaultpawnbroker'], ['zz-grunt']] });
    s.players[0].spire = 14;
    unit(s, 1, 'zz-grunt').dmg = 1;
    play(s, 'zz-zap', [unit(s, 1, 'zz-grunt').iid]);
    expect(cards(s, 1)).toEqual([]);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(15);
  });

  it('under-powdercourier: Shatter deals 3 damage to the strongest enemy', () => {
    const s = board({ hand: [[], ['zz-zap']], line: [['under-powdercourier'], ['zz-grunt', 'zz-ogre']], first: 1 });
    unit(s, 0, 'under-powdercourier').dmg = 2;
    play(s, 'zz-zap', [unit(s, 0, 'under-powdercourier').iid]);
    expect(cards(s, 0)).toEqual([]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(3);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
  });

  it('under-syndicatebroker: Deploy summons 2 Wire Rats', () => {
    const s = board({ hand: [['under-syndicatebroker'], []] });
    play(s, 'under-syndicatebroker');
    expect(cards(s, 0)).toEqual(['under-syndicatebroker', 'under-wirerat', 'under-wirerat']);
  });

  it('under-leechoverseer: Siphon repairs the Spire by damage to a blocker, and Corrosive destroys it', () => {
    const s = board({ line: [['under-leechoverseer'], ['zz-ogre']] });
    s.players[0].spire = 10;
    const v = unit(s, 0, 'under-leechoverseer');
    const o = unit(s, 1, 'zz-ogre');
    attack(s, [v], [[o, v]]);
    resolveCombat(s);
    expect(cards(s, 1)).toEqual([]);
    expect(s.players[0].spire).toBe(14);
    expect(unit(s, 0, 'under-leechoverseer').dmg).toBe(5);
  });

  it('under-mainlinedynamo: Deploy drains 2 from every enemy unit', () => {
    const s = board({ hand: [['under-mainlinedynamo'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-mainlinedynamo');
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(s.players[0].spire).toBe(14);
    expect(st(s, unit(s, 0, 'under-mainlinedynamo')).keywords).toContain('dread');
  });

  it('under-pullplug: Flash destroys an ally and drains 2 from the enemy Spire', () => {
    const s = board({ hand: [['under-pullplug'], []], line: [['zz-grunt'], []] });
    s.players[0].spire = 10;
    play(s, 'under-pullplug', [unit(s, 0, 'zz-grunt').iid]);
    expect(cards(s, 0)).toEqual([]);
    expect(s.players[1].spire).toBe(18);
    expect(s.players[0].spire).toBe(12);
  });

  it('under-siphontap: Flash drains 2 from an enemy unit', () => {
    const s = board({ hand: [['under-siphontap'], []], line: [[], ['zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-siphontap', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(s.players[0].spire).toBe(12);
  });

  it('under-acidbath: Flash gives an ally Corrosive this round so it destroys its blocker', () => {
    const s = board({ hand: [['under-acidbath'], []], line: [['zz-grunt'], ['zz-ogre']] });
    const g = unit(s, 0, 'zz-grunt');
    const o = unit(s, 1, 'zz-ogre');
    attack(s, [g], [[o, g]]);
    play(s, 'under-acidbath', [g.iid]);
    expect(st(s, g).keywords).toContain('corrosive');
    resolveCombat(s);
    expect(cards(s, 1)).toEqual([]);
  });

  it('under-burnledger: Swift destroys an ally and draws 2', () => {
    const s = board({ hand: [['under-burnledger'], []], line: [['zz-grunt'], []] });
    play(s, 'under-burnledger', [unit(s, 0, 'zz-grunt').iid]);
    pass(s);
    expect(cards(s, 0)).toEqual([]);
    expect(s.players[0].hand.length).toBe(2);
  });

  it('under-snuffedfuse: Swift destroys an enemy with 3 or less power only', () => {
    const s = board({ hand: [['under-snuffedfuse'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    const hc = s.players[0].hand[0];
    expect(applyAction(s, { type: 'play', iid: hc.iid, targets: [unit(s, 1, 'zz-ogre').iid] }).ok).toBe(false);
    play(s, 'under-snuffedfuse', [unit(s, 1, 'zz-grunt').iid]);
    pass(s);
    expect(cards(s, 1)).toEqual(['zz-ogre']);
  });

  it('under-bleeddry: Swift drains 4 from an enemy unit or from the Spire', () => {
    const u = board({ hand: [['under-bleeddry'], []], line: [[], ['zz-ogre']] });
    u.players[0].spire = 10;
    play(u, 'under-bleeddry', [unit(u, 1, 'zz-ogre').iid]);
    pass(u);
    expect(unit(u, 1, 'zz-ogre').dmg).toBe(4);
    expect(u.players[0].spire).toBe(14);
    const sp = board({ hand: [['under-bleeddry'], []] });
    sp.players[0].spire = 10;
    play(sp, 'under-bleeddry', ['spire1']);
    pass(sp);
    expect(sp.players[1].spire).toBe(16);
    expect(sp.players[0].spire).toBe(14);
  });

  it('under-chainoverload: Swift drains 3 from every enemy unit', () => {
    const s = board({ hand: [['under-chainoverload'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-chainoverload');
    pass(s);
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(3);
    expect(s.players[0].spire).toBe(16);
  });

  it('under-wiremarket: Ritual summons 3 Wire Rats', () => {
    const s = board({ hand: [['under-wiremarket'], []] });
    play(s, 'under-wiremarket');
    pass(s);
    expect(cards(s, 0)).toEqual(['under-wirerat', 'under-wirerat', 'under-wirerat']);
  });

  it('under-leechharvest: Ritual drains 2 per ally destroyed this round', () => {
    const s = board({ hand: [['under-pullplug', 'under-pullplug', 'under-leechharvest'], []], line: [['zz-grunt', 'zz-grunt'], []] });
    s.players[0].spire = 10;
    play(s, 'under-pullplug', [unit(s, 0, 'zz-grunt', 0).iid]);
    play(s, 'under-pullplug', [unit(s, 0, 'zz-grunt', 0).iid]);
    expect(s.players[1].spire).toBe(16);
    play(s, 'under-leechharvest');
    pass(s);
    expect(s.players[1].spire).toBe(12);
    expect(s.players[0].spire).toBe(18);
  });

});

describe('under cards (strict)', () => {
  it('under-sable: unascended +1|+0 when ANOTHER ally is destroyed, stacking, gone next round; her own death gives nothing', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [[], ['under-sable', 'under-wirerat', 'under-wirerat']] });
    const sab = unit(s, 1, 'under-sable');
    expect(st(s, sab)).toMatchObject({ power: 2, health: 2 });
    play(s, 'zz-zap', [unit(s, 1, 'under-wirerat').iid]);
    expect(st(s, sab).power).toBe(3);
    play(s, 'zz-zap', [unit(s, 1, 'under-wirerat').iid]);
    expect(st(s, sab).power).toBe(4);
    expect(st(s, sab).health).toBe(2);
    expect(st(s, sab).keywords).toContain('dread');
    expect(st(s, sab).keywords).not.toContain('corrosive');
    endRound(s);
    expect(st(s, sab).power).toBe(2);
    // an enemy unit dying does not buff her
    const o = board({ hand: [[], ['zz-zap']], line: [['zz-grunt'], ['under-sable']], first: 1 });
    unit(o, 0, 'zz-grunt').dmg = 1;
    play(o, 'zz-zap', [unit(o, 0, 'zz-grunt').iid]);
    expect(st(o, unit(o, 1, 'under-sable')).power).toBe(2);
  });

  it('under-sable: ascended drains exactly 1 per other ally destroyed and Ascend summons 2 rats', () => {
    const s = board({ hand: [['zz-zap'], []], line: [[], ['under-sable', 'under-wirerat']] });
    s.players[1].heroes = ['under-sable'];
    s.players[1].ascended = ['under-sable'];
    s.players[1].spire = 15;
    expect(st(s, unit(s, 1, 'under-sable'))).toMatchObject({ power: 4, health: 3 });
    play(s, 'zz-zap', [unit(s, 1, 'under-wirerat').iid]);
    expect(s.players[0].spire).toBe(19);
    expect(s.players[1].spire).toBe(16);
    expect(st(s, unit(s, 1, 'under-sable')).power).toBe(4); // no +1|+0 on the ascended face
    const a = board({ hand: [['zz-zap'], []], line: [[], ['under-sable', 'zz-grunt']] });
    a.players[1].heroes = ['under-sable'];
    a.players[1].seen.alliesDied = 3;
    unit(a, 1, 'zz-grunt').dmg = 1;
    play(a, 'zz-zap', [unit(a, 1, 'zz-grunt').iid]);
    expect(isAscended(a, 1, 'under-sable')).toBe(true);
    expect(cards(a, 1)).toEqual(['under-sable', 'under-wirerat', 'under-wirerat']);
  });

  it('under-vex: unascended Siphon heals by strike damage only; ascended Dusk drains 2 and Ascend drains 3 from each enemy, exact totals', () => {
    const s = board({ line: [['under-vex'], []] });
    s.players[0].spire = 10;
    attack(s, [unit(s, 0, 'under-vex')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(16);
    expect(s.players[0].spire).toBe(14);
    expect(isAscended(s, 0, 'under-vex')).toBe(false);
    // Ascend: Spire 5, nothing repaired yet -> the strike heals 4 (the level) and ascends: 3 drained from a grunt (heals 3, full amount) and from the ogre (3)
    const a = board({ line: [['under-vex'], ['zz-grunt', 'zz-ogre']] });
    a.players[0].heroes = ['under-vex'];
    a.players[0].spire = 5;
    attack(a, [unit(a, 0, 'under-vex')]);
    resolveCombat(a);
    expect(isAscended(a, 0, 'under-vex')).toBe(true);
    expect(cards(a, 1)).toEqual(['zz-ogre']);
    expect(unit(a, 1, 'zz-ogre').dmg).toBe(3);
    expect(a.players[0].spire).toBe(5 + 4 + 3 + 3);
    expect(a.players[1].spire).toBe(16);
    endRound(a);
    expect(a.players[1].spire).toBe(14);
    expect(a.players[0].spire).toBe(5 + 4 + 3 + 3 + 2);
  });

  it('under-fuserunner: Shatter drains exactly 1 only when it is destroyed, not before', () => {
    const s = board({ hand: [[], ['zz-zap']], line: [['under-fuserunner'], []], first: 1 });
    s.players[0].spire = 15;
    expect(s.players[1].spire).toBe(20);
    play(s, 'zz-zap', [unit(s, 0, 'under-fuserunner').iid]);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(16);
  });

  it('under-leechtick: Siphon heals 0 when its strike is absorbed by Ward', () => {
    const s = board({ line: [['under-leechtick'], ['zz-ward']] });
    s.players[0].spire = 10;
    const t = unit(s, 0, 'under-leechtick');
    const w = unit(s, 1, 'zz-ward');
    attack(s, [t], [[w, t]]);
    resolveCombat(s);
    expect(w.dmg).toBe(0);
    expect(s.players[0].spire).toBe(10);
  });

  it('under-burnoutrunner: a 2-power blocker is refused, a 3-power blocker is accepted; Unstable dies at Dusk', () => {
    const s = board({ line: [['under-burnoutrunner'], ['zz-grunt', 'zz-vanguard']] });
    const r = unit(s, 0, 'under-burnoutrunner');
    declare(s, r.iid);
    expect(s.phase).toBe('block');
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-grunt').iid, att: r.iid }).ok).toBe(false);
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-vanguard').iid, att: r.iid }).ok).toBe(true);
    const lone = board({ line: [['under-burnoutrunner'], ['zz-grunt']] });
    declare(lone, unit(lone, 0, 'under-burnoutrunner').iid);
    expect(lone.phase).toBe('combat'); // nobody may block: no block phase
    resolveCombat(lone);
    expect(lone.players[1].spire).toBe(18);
    endRound(lone);
    expect(cards(lone, 0)).toEqual([]);
  });

  it('under-backalleyenforcer: a 2-power blocker is refused, a 3-power blocker is accepted', () => {
    const s = board({ line: [['under-backalleyenforcer'], ['zz-grunt', 'zz-vanguard']] });
    const e = unit(s, 0, 'under-backalleyenforcer');
    declare(s, e.iid);
    expect(s.phase).toBe('block');
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-grunt').iid, att: e.iid }).ok).toBe(false);
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-vanguard').iid, att: e.iid }).ok).toBe(true);
  });

  it('under-ratwrangler: exactly 1 rat without Resonant, never 2 or 0', () => {
    const plain = board({ hand: [['under-ratwrangler'], []], line: [['under-vex'], []] });
    play(plain, 'under-ratwrangler');
    expect(cards(plain, 0).filter((c) => c === 'under-wirerat').length).toBe(1);
  });

  it('under-pitaccountant: drains 1 for another ally only, never for its own death; Resonant +1|+1 absent without a hero', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [[], ['under-pitaccountant', 'zz-grunt']] });
    s.players[1].spire = 15;
    unit(s, 1, 'zz-grunt').dmg = 1;
    expect(st(s, unit(s, 1, 'under-pitaccountant'))).toMatchObject({ power: 1, health: 3 });
    play(s, 'zz-zap', [unit(s, 1, 'zz-grunt').iid]);
    expect(s.players[0].spire).toBe(19);
    expect(s.players[1].spire).toBe(16);
    unit(s, 1, 'under-pitaccountant').dmg = 2;
    play(s, 'zz-zap', [unit(s, 1, 'under-pitaccountant').iid]);
    expect(cards(s, 1)).toEqual([]);
    expect(s.players[0].spire).toBe(19);
    expect(s.players[1].spire).toBe(16);
  });

  it('under-acidlamplighter: Corrosive does not get through a Ward blocker (Ward is spent)', () => {
    const s = board({ line: [['under-acidlamplighter'], ['zz-ward']] });
    const l = unit(s, 0, 'under-acidlamplighter');
    const w = unit(s, 1, 'zz-ward');
    attack(s, [l], [[w, l]]);
    resolveCombat(s);
    expect(cards(s, 1)).toEqual(['zz-ward']);
    expect(w.ward).toBe(false);
  });

  it('under-furnacehand: destroys another allied unit only; alone it survives; it cannot target an enemy; full Line replace works', () => {
    const alone = board({ hand: [['under-furnacehand'], []] });
    play(alone, 'under-furnacehand');
    expect(cards(alone, 0)).toEqual(['under-furnacehand']);
    expect(alone.players[0].seen.alliesDied ?? 0).toBe(0);
    const s = board({ hand: [['under-furnacehand'], []], line: [['zz-grunt'], ['zz-grunt']] });
    expect(tryPlay(s, 'under-furnacehand', [unit(s, 1, 'zz-grunt').iid]).ok).toBe(false);
    play(s, 'under-furnacehand', [unit(s, 0, 'zz-grunt').iid]);
    expect(cards(s, 0)).toEqual(['under-furnacehand']);
    expect(s.players[1].line.length).toBe(1);
    const f = board({ hand: [['under-furnacehand'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-ogre'], []] });
    expect(tryPlay(f, 'under-furnacehand', [unit(f, 0, 'zz-ogre').iid], unit(f, 0, 'zz-grunt', 0).iid).ok).toBe(true);
    expect(cards(f, 0).filter((c) => c === 'zz-ogre').length).toBe(0);
    expect(f.players[0].line.length).toBe(5);
  });

  it('under-leechwiresurgeon: a unit with less health left is still drained for the full 2, repairing 2 (R-D7)', () => {
    const s = board({ hand: [['under-leechwiresurgeon'], []], line: [[], ['zz-grunt']] });
    s.players[0].spire = 10;
    unit(s, 1, 'zz-grunt').dmg = 1;
    play(s, 'under-leechwiresurgeon', [unit(s, 1, 'zz-grunt').iid]);
    expect(cards(s, 1)).toEqual([]);
    expect(s.players[0].spire).toBe(12);
    expect(s.players[0].seen.spireHealed).toBe(2);
    expect(s.players[1].spire).toBe(20);
  });

  it('under-vaultpawnbroker: drains 1 per enemy unit destroyed (tokens too), exactly once per kill', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [['under-vaultpawnbroker', 'zz-grunt'], ['under-wirerat']] });
    s.players[0].spire = 10;
    play(s, 'zz-zap', [unit(s, 1, 'under-wirerat').iid]);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(11);
    expect(s.players[0].line.length).toBe(2);
  });

  it('under-powdercourier: Shatter hits only the strongest enemy and does nothing with no enemy', () => {
    const s = board({ hand: [[], ['zz-zap']], line: [['under-powdercourier'], []], first: 1 });
    unit(s, 0, 'under-powdercourier').dmg = 2;
    play(s, 'zz-zap', [unit(s, 0, 'under-powdercourier').iid]);
    expect(cards(s, 0)).toEqual([]);
    expect(s.players[1].spire).toBe(20);
  });

  it('under-syndicatebroker: Deploy summons exactly 2 rats, no more', () => {
    const s = board({ hand: [['under-syndicatebroker'], []] });
    play(s, 'under-syndicatebroker');
    expect(cards(s, 0).filter((c) => c === 'under-wirerat').length).toBe(2);
    expect(s.players[0].line.length).toBe(3);
  });

  it('under-mainlinedynamo: exact totals (a 2-health grunt repairs the full 2, the ogre 2); 2-power blockers are refused', () => {
    const s = board({ hand: [['under-mainlinedynamo'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-mainlinedynamo');
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    expect(s.players[0].spire).toBe(10 + 2 + 2);
    expect(s.players[0].seen.spireHealed).toBe(4);
    const d = board({ line: [['under-mainlinedynamo'], ['zz-grunt', 'zz-vanguard']] });
    const m = unit(d, 0, 'under-mainlinedynamo');
    declare(d, m.iid);
    expect(applyAction(d, { type: 'block', unit: unit(d, 1, 'zz-grunt').iid, att: m.iid }).ok).toBe(false);
    expect(applyAction(d, { type: 'block', unit: unit(d, 1, 'zz-vanguard').iid, att: m.iid }).ok).toBe(true);
  });

  it('under-pullplug: destroys only an allied unit and drains exactly 2; an enemy is not a legal target', () => {
    const s = board({ hand: [['under-pullplug'], []], line: [['zz-grunt'], ['zz-grunt']] });
    s.players[0].spire = 10;
    expect(tryPlay(s, 'under-pullplug', [unit(s, 1, 'zz-grunt').iid]).ok).toBe(false);
    play(s, 'under-pullplug', [unit(s, 0, 'zz-grunt').iid]);
    expect(s.players[0].line.length).toBe(0);
    expect(s.players[1].line.length).toBe(1);
    expect(s.players[1].spire).toBe(18);
    expect(s.players[0].spire).toBe(12);
    expect(s.players[0].seen.alliesDied).toBe(1);
  });

  it('under-siphontap: Ward absorbs (repairs 0), Plated repairs 1, a unit with 1 health left repairs the full 2, full Spire stays 20', () => {
    const s = board({ hand: [['under-siphontap', 'under-siphontap', 'under-siphontap'], []], line: [[], ['zz-ward', 'zz-plated', 'zz-grunt']] });
    s.players[0].spire = 10;
    play(s, 'under-siphontap', [unit(s, 1, 'zz-ward').iid]);
    expect(s.players[0].spire).toBe(10);
    expect(unit(s, 1, 'zz-ward').ward).toBe(false);
    play(s, 'under-siphontap', [unit(s, 1, 'zz-plated').iid]);
    expect(unit(s, 1, 'zz-plated').dmg).toBe(1);
    expect(s.players[0].spire).toBe(11);
    unit(s, 1, 'zz-grunt').dmg = 1;
    play(s, 'under-siphontap', [unit(s, 1, 'zz-grunt').iid]);
    expect(cards(s, 1)).not.toContain('zz-grunt');
    expect(s.players[0].spire).toBe(13);
    const f = board({ hand: [['under-siphontap'], []], line: [[], ['zz-ogre']] });
    play(f, 'under-siphontap', [unit(f, 1, 'zz-ogre').iid]);
    expect(unit(f, 1, 'zz-ogre').dmg).toBe(2);
    expect(f.players[0].spire).toBe(20);
    expect(f.players[0].seen.spireHealed ?? 0).toBe(0);
  });

  it('under-acidbath: Corrosive lasts only this round and only an ally can be chosen', () => {
    const s = board({ hand: [['under-acidbath'], ['zz-zap']], line: [['zz-grunt'], ['zz-ogre']] });
    const g = unit(s, 0, 'zz-grunt');
    expect(tryPlay(s, 'under-acidbath', [unit(s, 1, 'zz-ogre').iid]).ok).toBe(false);
    expect(st(s, g).keywords).not.toContain('corrosive');
    play(s, 'under-acidbath', [g.iid]);
    expect(st(s, g).keywords).toContain('corrosive');
    endRound(s);
    expect(st(s, g).keywords).not.toContain('corrosive');
  });

  it('under-burnledger: destroys the chosen ally, draws exactly 2 on resolution, enemy not targetable', () => {
    const s = board({ hand: [['under-burnledger'], []], line: [['zz-grunt'], ['zz-grunt']] });
    expect(tryPlay(s, 'under-burnledger', [unit(s, 1, 'zz-grunt').iid]).ok).toBe(false);
    const d0 = s.players[0].deck.length;
    play(s, 'under-burnledger', [unit(s, 0, 'zz-grunt').iid]);
    expect(s.players[0].hand.length).toBe(0);
    pass(s);
    expect(s.players[0].line.length).toBe(0);
    expect(s.players[1].line.length).toBe(1);
    expect(s.players[0].hand.length).toBe(2);
    expect(s.players[0].deck.length).toBe(d0 - 2);
    expect(s.players[0].seen.alliesDied).toBe(1);
  });

  it('under-snuffedfuse: a 3-power target is accepted, a 4-power refused; the power check is made only when cast', () => {
    const s = board({ hand: [['under-snuffedfuse'], []], line: [[], ['zz-vanguard', 'zz-ogre']] });
    expect(tryPlay(s, 'under-snuffedfuse', [unit(s, 1, 'zz-ogre').iid]).ok).toBe(false);
    play(s, 'under-snuffedfuse', [unit(s, 1, 'zz-vanguard').iid]);
    pass(s);
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    // pumped past 3 in response: it is still destroyed
    const r = board({ hand: [['under-snuffedfuse'], ['zz-pump', 'zz-pump', 'zz-pump']], line: [[], ['tide-ripplescribe']] });
    const sc = unit(r, 1, 'tide-ripplescribe');
    play(r, 'under-snuffedfuse', [sc.iid]);
    for (let i = 0; i < 3; i++) play(r, 'zz-pump', [sc.iid]);
    expect(st(r, sc).power).toBe(4);
    pass(r);
    expect(cards(r, 1)).toEqual([]);
  });

  it('under-bleeddry: drains exactly 4 from a unit (full amount even on a 2-health unit) or from the Spire, and can win the game', () => {
    const g = board({ hand: [['under-bleeddry'], []], line: [[], ['zz-grunt']] });
    g.players[0].spire = 10;
    play(g, 'under-bleeddry', [unit(g, 1, 'zz-grunt').iid]);
    pass(g);
    expect(cards(g, 1)).toEqual([]);
    expect(g.players[0].spire).toBe(14);
    expect(g.players[1].spire).toBe(20);
    const sp = board({ hand: [['under-bleeddry'], []] });
    sp.players[0].spire = 10;
    sp.players[1].spire = 3;
    play(sp, 'under-bleeddry', ['spire1']);
    pass(sp);
    expect(sp.winner).toBe(0);
    expect(sp.players[0].spire).toBe(14);
  });

  it('under-chainoverload: exact totals, every enemy unit and no ally is drained', () => {
    const s = board({ hand: [['under-chainoverload'], []], line: [['zz-grunt'], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-chainoverload');
    pass(s);
    expect(unit(s, 0, 'zz-grunt').dmg).toBe(0);
    expect(s.players[0].spire).toBe(10 + 3 + 3);
    expect(s.players[1].spire).toBe(20);
  });

  it('under-wiremarket: summons 3 rats; on a Line with 5 units only 1 fits and the rest are lost', () => {
    const s = board({ hand: [['under-wiremarket'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    play(s, 'under-wiremarket');
    pass(s);
    expect(s.players[0].line.length).toBe(6);
    expect(cards(s, 0).filter((c) => c === 'under-wirerat').length).toBe(1);
    expect(kinds(s)).toContain('lineFull');
  });

  it('under-leechharvest: drains 0 with no ally destroyed; counts tokens; the count is per round', () => {
    const z = board({ hand: [['under-leechharvest'], []], line: [['under-wirerat'], []] });
    z.players[0].spire = 10;
    play(z, 'under-leechharvest');
    pass(z);
    expect(z.players[1].spire).toBe(20);
    expect(z.players[0].spire).toBe(10);
    const t = board({ hand: [['under-pullplug', 'under-leechharvest'], []], line: [['under-wirerat', 'under-wirerat'], []] });
    t.players[0].spire = 10;
    play(t, 'under-pullplug', [unit(t, 0, 'under-wirerat').iid]);
    play(t, 'under-leechharvest');
    pass(t);
    expect(t.players[1].spire).toBe(20 - 2 - 2);
    expect(t.players[0].spire).toBe(10 + 2 + 2);
  });
});

describe('under cards (First Light additions)', () => {
  it('under-marrow: Dread; Assault deals 1 to the weakest enemy; the 6th enemy destroyed ascends him and Ascend destroys every damaged enemy', () => {
    const s = board({ line: [['under-marrow'], ['zz-ogre', 'zz-grunt']] });
    const m = unit(s, 0, 'under-marrow');
    expect(st(s, m)).toMatchObject({ power: 2, health: 3 });
    expect(st(s, m).keywords).toContain('dread');
    declare(s, m.iid);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(1); // Assault: the grunt is the weakest
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(0);
    // level: 5 enemies destroyed so far; the Assault ping finishes a grunt (the 6th); Ascend destroys the damaged ogre
    const a = board({ line: [['under-marrow'], ['zz-grunt', 'zz-ogre', 'zz-vanguard']] });
    a.players[0].heroes = ['under-marrow'];
    const h = unit(a, 0, 'under-marrow');
    a.players[0].seen.enemiesDied = 5;
    h.dmg = 2;
    unit(a, 1, 'zz-grunt').dmg = 1;
    unit(a, 1, 'zz-ogre').dmg = 1;
    declare(a, h.iid);
    expect(isAscended(a, 0, 'under-marrow')).toBe(true);
    expect(cards(a, 1)).toEqual(['zz-vanguard']);
    expect(h.dmg).toBe(0);
    expect(st(a, h)).toMatchObject({ power: 4, health: 5 });
    // ascended Assault deals 2 to the weakest enemy
    const b = board({ line: [['under-marrow'], ['zz-ogre', 'zz-wall']] });
    b.players[0].heroes = ['under-marrow'];
    b.players[0].ascended = ['under-marrow'];
    declare(b, unit(b, 0, 'under-marrow').iid);
    expect(unit(b, 1, 'zz-wall').dmg).toBe(2);
    expect(unit(b, 1, 'zz-ogre').dmg).toBe(0);
  });

  it('under-marrow: every enemy destroyed counts, by him or by anything else of yours, even with him off the Line', () => {
    const s = board({ line: [['under-marrow'], ['zz-grunt', 'zz-ogre']] });
    s.players[0].heroes = ['under-marrow'];
    s.players[0].seen.enemiesDied = 4;
    unit(s, 1, 'zz-grunt').dmg = 1;
    declare(s, unit(s, 0, 'under-marrow').iid); // his Assault finishes the grunt: 5
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    expect(isAscended(s, 0, 'under-marrow')).toBe(false);
    const t = board({ hand: [['zz-zap', 'under-marrow'], []], line: [[], ['zz-grunt']] });
    t.players[0].heroes = ['under-marrow'];
    t.players[0].seen.enemiesDied = 5;
    unit(t, 1, 'zz-grunt').dmg = 1;
    play(t, 'zz-zap', [unit(t, 1, 'zz-grunt').iid]); // a tactic, with Graff still in hand: 6
    expect(isAscended(t, 0, 'under-marrow')).toBe(true);
  });

  it('under-penn: Dusk drains 1 per glyph cast this round (at most 2); 10 glyph damage ascends her; Ascend drains 1 per card in hand (at most 4); ascended Dusk drains up to 4', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [['under-penn'], ['zz-wall']] });
    s.players[0].heroes = ['under-penn'];
    s.players[0].spire = 10;
    expect(st(s, unit(s, 0, 'under-penn'))).toMatchObject({ power: 2, health: 4 });
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]);
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]);
    endRound(s);
    expect(s.players[1].spire).toBe(18);
    expect(s.players[0].spire).toBe(12);
    expect(isAscended(s, 0, 'under-penn')).toBe(false);
    const a = board({ hand: [['zz-zap', 'zz-zap', 'zz-filler', 'zz-filler', 'zz-filler'], []], line: [['under-penn'], ['zz-wall']] });
    a.players[0].heroes = ['under-penn'];
    a.players[0].spire = 10;
    a.players[0].seen.glyphDamage = 8;
    play(a, 'zz-zap', [unit(a, 1, 'zz-wall').iid]);
    expect(isAscended(a, 0, 'under-penn')).toBe(false);
    play(a, 'zz-zap', [unit(a, 1, 'zz-wall').iid]);
    expect(isAscended(a, 0, 'under-penn')).toBe(true);
    expect(a.players[1].spire).toBe(17); // 3 cards left in hand
    expect(a.players[0].spire).toBe(13);
    expect(st(a, unit(a, 0, 'under-penn'))).toMatchObject({ power: 4, health: 6 });
    endRound(a);
    expect(a.players[1].spire).toBe(15); // 2 glyphs this round, 1 drain each
    expect(a.players[0].spire).toBe(15);
    const c = board({ hand: [['zz-zap', 'zz-zap', 'zz-zap'], []], line: [['under-penn'], ['zz-wall']] });
    c.players[0].heroes = ['under-penn'];
    for (let i = 0; i < 3; i++) play(c, 'zz-zap', [unit(c, 1, 'zz-wall').iid]);
    endRound(c);
    expect(c.players[1].spire).toBe(18); // 3 glyphs, but the base face drains at most 2
  });

  it('under-skimclerk: Dusk deals 1 to the enemy Spire only after 2+ glyphs this round', () => {
    const one = board({ hand: [['zz-zap'], []], line: [['under-skimclerk'], ['zz-wall']] });
    play(one, 'zz-zap', [unit(one, 1, 'zz-wall').iid]);
    endRound(one);
    expect(one.players[1].spire).toBe(20);
    const two = board({ hand: [['zz-zap', 'zz-zap'], []], line: [['under-skimclerk'], ['zz-wall']] });
    play(two, 'zz-zap', [unit(two, 1, 'zz-wall').iid]);
    play(two, 'zz-zap', [unit(two, 1, 'zz-wall').iid]);
    endRound(two);
    expect(two.players[1].spire).toBe(19);
  });

  it('under-blisterrat: Corrosive destroys its blocker; Unstable destroys it at the end of the round', () => {
    const s = board({ line: [['under-blisterrat'], ['zz-wall']] });
    const r = unit(s, 0, 'under-blisterrat');
    const w = unit(s, 1, 'zz-wall');
    attack(s, [r], [[w, r]]);
    resolveCombat(s);
    expect(cards(s, 1)).toEqual([]);
    expect(cards(s, 0)).toEqual(['under-blisterrat']); // the wall has 0 power
    endRound(s);
    expect(cards(s, 0)).toEqual([]);
  });

  it('under-tollrat: Strike deals 1 more to the enemy Spire, even when blocked', () => {
    const s = board({ line: [['under-tollrat'], []] });
    attack(s, [unit(s, 0, 'under-tollrat')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(18);
    const b = board({ line: [['under-tollrat'], ['zz-wall']] });
    const r = unit(b, 0, 'under-tollrat');
    attack(b, [r], [[unit(b, 1, 'zz-wall'), r]]);
    resolveCombat(b);
    expect(unit(b, 1, 'zz-wall').dmg).toBe(1);
    expect(b.players[1].spire).toBe(19);
  });

  it('under-kneecapper: Dread; Deploy deals 1 to an enemy unit', () => {
    const s = board({ hand: [['under-kneecapper'], []], line: [[], ['zz-grunt', 'zz-ogre']] });
    play(s, 'under-kneecapper', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(1);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(st(s, unit(s, 0, 'under-kneecapper')).keywords).toContain('dread');
  });

  it('under-bagman: Deploy deals 1 to the enemy Spire per glyph cast this round', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap', 'under-bagman'], []], line: [[], ['zz-wall']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]);
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]);
    play(s, 'under-bagman');
    expect(s.players[1].spire).toBe(18);
    const none = board({ hand: [['under-bagman'], []] });
    play(none, 'under-bagman');
    expect(none.players[1].spire).toBe(20);
  });

  it('under-wireboundthug: Dread; Resonant gives it Corrosive, which destroys its blocker', () => {
    const s = board({ line: [['under-wireboundthug'], []] });
    expect(st(s, unit(s, 0, 'under-wireboundthug')).keywords).toContain('dread');
    expect(st(s, unit(s, 0, 'under-wireboundthug')).keywords).not.toContain('corrosive');
    const r = board({ line: [['under-wireboundthug', 'under-vex'], ['zz-ogre']] });
    r.players[0].ascended = ['under-vex'];
    const t = unit(r, 0, 'under-wireboundthug');
    expect(st(r, t).keywords).toContain('corrosive');
    attack(r, [t], [[unit(r, 1, 'zz-ogre'), t]]);
    resolveCombat(r);
    expect(cards(r, 1)).toEqual([]);
  });

  it('under-vattailor: Deploy gives an allied hero Corrosive for good; a non-hero ally cannot be chosen', () => {
    const s = board({ hand: [['under-vattailor'], []], line: [['under-marrow', 'zz-grunt'], []] });
    expect(tryPlay(s, 'under-vattailor', [unit(s, 0, 'zz-grunt').iid]).ok).toBe(false);
    const m = unit(s, 0, 'under-marrow');
    play(s, 'under-vattailor', [m.iid]);
    expect(st(s, m).keywords).toContain('corrosive');
    endRound(s);
    expect(st(s, m).keywords).toContain('corrosive');
  });

  it('under-interestcollector: Dusk deals 1 to every damaged enemy unit', () => {
    const s = board({ line: [['under-interestcollector'], ['zz-ogre', 'zz-wall']] });
    unit(s, 1, 'zz-ogre').dmg = 1;
    endRound(s);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0);
  });

  it('under-grudgekeeper: gets +1|+0 for good when an enemy unit is destroyed', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['under-grudgekeeper', 'zz-grunt'], ['zz-grunt']] });
    unit(s, 1, 'zz-grunt').dmg = 1;
    play(s, 'zz-zap', [unit(s, 1, 'zz-grunt').iid]);
    const k = unit(s, 0, 'under-grudgekeeper');
    expect(st(s, k)).toMatchObject({ power: 3, health: 4 });
    endRound(s);
    expect(st(s, k).power).toBe(3);
  });

  it('under-persuasionengine: Deploy makes an allied Dread unit and an enemy unit strike each other', () => {
    const s = board({ hand: [['under-persuasionengine'], []], line: [['zz-dread', 'zz-grunt'], ['zz-grunt', 'zz-wall']] });
    expect(tryPlay(s, 'under-persuasionengine', [unit(s, 0, 'zz-grunt').iid, unit(s, 1, 'zz-grunt').iid]).ok).toBe(false);
    const d = unit(s, 0, 'zz-dread');
    play(s, 'under-persuasionengine', [d.iid, unit(s, 1, 'zz-grunt').iid]);
    expect(cards(s, 1)).toEqual(['zz-wall']);
    expect(d.dmg).toBe(2);
    expect(d.seen.kills).toBe(1);
  });

  it('under-debtassessor: Deploy deals 1 to an enemy unit per card left in hand, at most 3', () => {
    const s = board({ hand: [['under-debtassessor', 'zz-filler', 'zz-filler', 'zz-filler', 'zz-filler'], []], line: [[], ['zz-ogre']] });
    play(s, 'under-debtassessor', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(3);
  });

  it('under-noticeserver: Deploy destroys a damaged enemy unit only; Resonant gives it Dread', () => {
    const s = board({ hand: [['under-noticeserver'], []], line: [['under-vex'], ['zz-ogre', 'zz-grunt']] });
    unit(s, 1, 'zz-ogre').dmg = 1;
    expect(tryPlay(s, 'under-noticeserver', [unit(s, 1, 'zz-grunt').iid]).ok).toBe(false);
    play(s, 'under-noticeserver', [unit(s, 1, 'zz-ogre').iid]);
    expect(cards(s, 1)).toEqual(['zz-grunt']);
    const n = unit(s, 0, 'under-noticeserver');
    expect(st(s, n).keywords).not.toContain('dread');
    s.players[0].ascended = ['under-vex'];
    expect(st(s, n).keywords).toContain('dread');
  });

  it('under-taplinecolossus: Siphon; casting a glyph deals 1 to the enemy Spire', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['under-taplinecolossus'], ['zz-wall']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]);
    expect(s.players[1].spire).toBe(19);
    const a = board({ line: [['under-taplinecolossus'], []] });
    a.players[0].spire = 10;
    attack(a, [unit(a, 0, 'under-taplinecolossus')]);
    resolveCombat(a);
    expect(a.players[1].spire).toBe(16);
    expect(a.players[0].spire).toBe(14);
  });

  it('under-blackgatejuggernaut: Dread; allied units with Dread have Corrosive, others do not', () => {
    const s = board({ line: [['under-blackgatejuggernaut', 'under-backalleyenforcer', 'zz-grunt'], ['zz-ogre']] });
    expect(st(s, unit(s, 0, 'under-blackgatejuggernaut')).keywords).toEqual(expect.arrayContaining(['dread', 'corrosive']));
    expect(st(s, unit(s, 0, 'zz-grunt')).keywords).not.toContain('corrosive');
    const e = unit(s, 0, 'under-backalleyenforcer');
    attack(s, [e], [[unit(s, 1, 'zz-ogre'), e]]);
    resolveCombat(s);
    expect(cards(s, 1)).toEqual([]);
  });

  it('under-skimtop: Flash drains 1 from an enemy unit or Spire, 2 if you have cast 2+ glyphs this round', () => {
    const s = board({ hand: [['under-skimtop'], []] });
    s.players[0].spire = 10;
    play(s, 'under-skimtop', ['spire1']);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(11);
    const t = board({ hand: [['zz-zap', 'under-skimtop'], []], line: [[], ['zz-wall', 'zz-ogre']] });
    t.players[0].spire = 10;
    play(t, 'zz-zap', [unit(t, 1, 'zz-wall').iid]);
    play(t, 'under-skimtop', [unit(t, 1, 'zz-ogre').iid]);
    expect(unit(t, 1, 'zz-ogre').dmg).toBe(2);
    expect(t.players[0].spire).toBe(12);
  });

  it('under-calledtoaccount: Flash gives an allied hero Dueler and Corrosive this round; it forces a blocker and destroys it', () => {
    const s = board({ hand: [['under-calledtoaccount'], []], line: [['under-marrow', 'zz-grunt'], ['zz-wall', 'zz-ogre']] });
    expect(tryPlay(s, 'under-calledtoaccount', [unit(s, 0, 'zz-grunt').iid]).ok).toBe(false);
    const m = unit(s, 0, 'under-marrow');
    play(s, 'under-calledtoaccount', [m.iid]);
    expect(st(s, m).keywords).toEqual(expect.arrayContaining(['dueler', 'corrosive']));
    const w = unit(s, 1, 'zz-wall');
    act(s, { type: 'declare', unit: m.iid, duel: w.iid });
    act(s, { type: 'attack' });
    if (s.phase === 'block') act(s, { type: 'blocks' });
    resolveCombat(s);
    expect(cards(s, 1)).toEqual(['zz-ogre']);
    expect(m.seen.kills).toBe(1);
    endRound(s);
    expect(st(s, m).keywords).not.toContain('corrosive');
    expect(st(s, m).keywords).not.toContain('dueler');
  });

  it('under-protectionfee: Flash drains 1 from every enemy unit and 1 from the enemy Spire', () => {
    const s = board({ hand: [['under-protectionfee'], []], line: [['zz-grunt'], ['zz-grunt', 'zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-protectionfee');
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(1);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(1);
    expect(unit(s, 0, 'zz-grunt').dmg).toBe(0);
    expect(s.players[1].spire).toBe(19);
    expect(s.players[0].spire).toBe(13);
  });

  it('under-makeexample: Swift destroys an allied unit and deals its power to an enemy unit', () => {
    const s = board({ hand: [['under-makeexample'], []], line: [['zz-ogre'], ['zz-wall']] });
    play(s, 'under-makeexample', [unit(s, 0, 'zz-ogre').iid, unit(s, 1, 'zz-wall').iid]);
    pass(s);
    expect(cards(s, 0)).toEqual([]);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(5);
    expect(s.players[0].seen.alliesDied).toBe(1);
  });

  it('under-streettax: Swift drains 1 from the enemy Spire per enemy unit, at most 4', () => {
    const s = board({ hand: [['under-streettax'], []], line: [[], ['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt']] });
    s.players[0].spire = 10;
    play(s, 'under-streettax');
    pass(s);
    expect(s.players[1].spire).toBe(16);
    expect(s.players[0].spire).toBe(14);
    const two = board({ hand: [['under-streettax'], []], line: [[], ['zz-grunt', 'zz-grunt']] });
    play(two, 'under-streettax');
    pass(two);
    expect(two.players[1].spire).toBe(18);
  });

  it('under-backalleylesson: Swift makes every allied Dread unit strike the chosen enemy unit', () => {
    const s = board({ hand: [['under-backalleylesson'], []], line: [['zz-dread', 'zz-grunt'], ['zz-wall']] });
    play(s, 'under-backalleylesson', [unit(s, 1, 'zz-wall').iid]);
    pass(s);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(3); // the grunt has no Dread
    const k = board({ hand: [['under-backalleylesson'], []], line: [['zz-dread', 'under-backalleyenforcer'], ['zz-wall']] });
    play(k, 'under-backalleylesson', [unit(k, 1, 'zz-wall').iid]);
    pass(k);
    expect(cards(k, 1)).toEqual([]);
  });

  it('under-foreclosure: Swift drains 2 from every damaged enemy unit and 2 from the enemy Spire', () => {
    const s = board({ hand: [['under-foreclosure'], []], line: [[], ['zz-ogre', 'zz-wall']] });
    s.players[0].spire = 10;
    unit(s, 1, 'zz-ogre').dmg = 1;
    play(s, 'under-foreclosure');
    pass(s);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(3);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0);
    expect(s.players[1].spire).toBe(18);
    expect(s.players[0].spire).toBe(14);
  });

  it('under-lightsout: Ritual gives allies Dread this round; Resonant adds Corrosive', () => {
    const s = board({ hand: [['under-lightsout'], []], line: [['zz-grunt'], []] });
    play(s, 'under-lightsout');
    pass(s);
    const g = unit(s, 0, 'zz-grunt');
    expect(st(s, g).keywords).toContain('dread');
    expect(st(s, g).keywords).not.toContain('corrosive');
    endRound(s);
    expect(st(s, g).keywords).not.toContain('dread');
    const r = board({ hand: [['under-lightsout'], []], line: [['zz-grunt', 'under-vex'], []] });
    r.players[0].ascended = ['under-vex'];
    play(r, 'under-lightsout');
    pass(r);
    expect(st(r, unit(r, 0, 'zz-grunt')).keywords).toEqual(expect.arrayContaining(['dread', 'corrosive']));
  });

  it('under-hostiletakeover: Ritual destroys an enemy unit and drains 2 from the enemy Spire', () => {
    const s = board({ hand: [['under-hostiletakeover'], []], line: [[], ['zz-ogre']] });
    s.players[0].spire = 10;
    play(s, 'under-hostiletakeover', [unit(s, 1, 'zz-ogre').iid]);
    pass(s);
    expect(cards(s, 1)).toEqual([]);
    expect(s.players[1].spire).toBe(18);
    expect(s.players[0].spire).toBe(12);
  });
});
