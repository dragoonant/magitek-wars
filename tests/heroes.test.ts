// One behaviour test per hero: the level condition, the Ascend moment and the ascended face (R-H1..R-H7).
import { describe, expect, it } from 'vitest';
import { act, attack, board, pass, place, play, resolveCombat, st, unit, kinds, applyAction } from './helpers';
import { costOf, face, isAscended } from '../src/engine/query';

describe('heroes', () => {
  it('R-H4 ascension applies to every copy in every zone, even with no copy on the Line', () => {
    const s = board({ hand: [['tide-maren', 'zz-zap', 'zz-zap', 'zz-zap', 'zz-zap', 'zz-zap', 'zz-zap'], []], line: [[], ['zz-wall']] });
    s.players[0].heroes = ['tide-maren'];
    const w = unit(s, 1, 'zz-wall');
    for (let i = 0; i < 6; i++) play(s, 'zz-zap', [w.iid]);
    expect(isAscended(s, 0, 'tide-maren')).toBe(true);
    expect(face(s, 0, 'tide-maren').name).toBe('Maren, Voice of the Canals');
    play(s, 'tide-maren');
    expect(st(s, unit(s, 0, 'tide-maren')).power).toBe(3);
  });

  it('R-H7 Channel: a spare copy repairs the hero and gives +1|+1; a second copy cannot be played', () => {
    const s = board({ hand: [['tide-maren'], []], line: [['tide-maren'], []] });
    const m = unit(s, 0, 'tide-maren');
    m.dmg = 3;
    const iid = s.players[0].hand[0].iid;
    expect(applyAction(s, { type: 'play', iid }).error).toMatch(/Channel/);
    act(s, { type: 'channel', iid });
    expect(st(s, m)).toMatchObject({ power: 3, health: 5, hp: 5 });
    expect(s.players[0].charge).toBe(9);
    expect(s.priority).toBe(0);
  });

  it('prism-ysolde: Dusk repair; ascends on 6 ally survivals; aura +1|+1 and Ward for all', () => {
    const s = board({ line: [['prism-ysolde', 'zz-ogre'], []] });
    s.players[0].heroes = ['prism-ysolde'];
    const o = unit(s, 0, 'zz-ogre');
    o.dmg = 2;
    s.players[0].seen.allySurvivals = 5;
    pass(s); pass(s);
    expect(o.dmg).toBe(1);
    expect(isAscended(s, 0, 'prism-ysolde')).toBe(false);
    s.players[0].seen.allySurvivals = 6;
    pass(s); pass(s);
    expect(isAscended(s, 0, 'prism-ysolde')).toBe(true);
    expect(st(s, o)).toMatchObject({ power: 6, health: 6 });
    expect(st(s, o).keywords).toContain('ward');
    expect(st(s, unit(s, 0, 'prism-ysolde'))).toMatchObject({ power: 3, health: 5 });
  });

  it('prism-oren: grows when he survives; ascends on his 3rd survival and repairs the Spire by 4', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap', 'zz-zap'], []], line: [['zz-grunt'], ['prism-oren']], first: 0 });
    s.players[1].heroes = ['prism-oren'];
    s.players[1].spire = 10;
    const o = unit(s, 1, 'prism-oren');
    for (let i = 0; i < 3; i++) play(s, 'zz-zap', [o.iid]);
    expect(isAscended(s, 1, 'prism-oren')).toBe(true);
    expect(s.players[1].spire).toBe(14);
    expect(o.dmg).toBe(0); // R-H5 repaired on ascending
    expect(st(s, o).power).toBe(5 + 3);
    expect(st(s, o).keywords).toContain('plated');
  });

  it('ember-kessa: deploy pings; ascends at 8 glyph damage, hits every enemy for 2, then glyphs burn the Spire', () => {
    const s = board({ hand: [['ember-kessa', 'zz-zap'], ['zz-grunt']], line: [[], ['zz-wall', 'zz-grunt']] });
    s.players[0].heroes = ['ember-kessa'];
    s.players[0].seen.glyphDamage = 6;
    play(s, 'ember-kessa', ['spire1']);
    expect(s.players[1].spire).toBe(19);
    expect(isAscended(s, 0, 'ember-kessa')).toBe(false);
    pass(s);
    play(s, 'zz-zap', [unit(s, 1, 'zz-wall').iid]); // 8th point of damage
    expect(isAscended(s, 0, 'ember-kessa')).toBe(true);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']); // grunt took 2
    expect(unit(s, 1, 'zz-wall').dmg).toBe(3);
    expect(kinds(s)).toContain('ascend');
  });

  it('ember-kessa ascended: casting a glyph deals 2 to the enemy Spire', () => {
    const s = board({ hand: [['zz-pump'], []], line: [['ember-kessa'], []] });
    s.players[0].heroes = ['ember-kessa'];
    s.players[0].ascended = ['ember-kessa'];
    play(s, 'zz-pump', [unit(s, 0, 'ember-kessa').iid]);
    expect(s.players[1].spire).toBe(18);
  });

  it('ember-crucible: Dawn Sparkbot; ascends at 10 summons with 2 Slaglings; allies dying burn the Spire', () => {
    const s = board({ line: [['ember-crucible'], []] });
    s.players[0].heroes = ['ember-crucible'];
    s.players[0].seen.unitsSummoned = 8;
    pass(s); pass(s); // dawn: sparkbot (9)
    expect(s.players[0].line.map((u) => u.card)).toEqual(['ember-crucible', 'ember-sparkbot']);
    pass(s); pass(s); // sparkbot dies at dusk, dawn: sparkbot (10) -> ascend -> 2 slaglings
    expect(isAscended(s, 0, 'ember-crucible')).toBe(true);
    expect(s.players[0].line.map((u) => u.card)).toEqual(['ember-crucible', 'ember-sparkbot', 'ember-slagling', 'ember-slagling']);
    pass(s); pass(s); // three unstable allies die at dusk: 3 damage
    expect(s.players[1].spire).toBe(17);
    expect(st(s, unit(s, 0, 'ember-crucible')).keywords).toContain('pierce');
  });

  it('tide-maren: glyphs pump her; ascended she makes glyphs cost 1 less and draws 2', () => {
    const s = board({ hand: [['zz-pump', 'zz-pump'], []], line: [['tide-maren'], []] });
    s.players[0].heroes = ['tide-maren'];
    s.players[0].seen.glyphsCast = 4;
    const m = unit(s, 0, 'tide-maren');
    play(s, 'zz-pump', [m.iid]);
    expect(st(s, m).power).toBe(3);
    const hand = s.players[0].hand.length;
    play(s, 'zz-pump', [m.iid]);
    expect(isAscended(s, 0, 'tide-maren')).toBe(true);
    expect(s.players[0].hand.length).toBe(hand - 1 + 2);
    expect(costOf(s, 0, 'zz-rite')).toBe(2);
    expect(costOf(s, 0, 'zz-ogre')).toBe(5);
  });

  it('tide-ilvane: deploy Stasis stops an attacker; ascends at 4 and freezes every enemy; Dawn freezes the strongest', () => {
    const s = board({ hand: [['tide-ilvane'], []], line: [[], ['zz-ogre', 'zz-grunt']] });
    s.players[0].heroes = ['tide-ilvane'];
    s.players[0].seen.stasisApplied = 3;
    play(s, 'tide-ilvane', [unit(s, 1, 'zz-grunt').iid]);
    expect(isAscended(s, 0, 'tide-ilvane')).toBe(true);
    expect(s.players[1].line.every((u) => u.stasis)).toBe(true);
    pass(s); pass(s);
    expect(unit(s, 1, 'zz-ogre').stasis).toBe(true); // dawn
    expect(unit(s, 1, 'zz-grunt').stasis).toBe(false);
    expect(applyAction(s, { type: 'declare', unit: unit(s, 1, 'zz-ogre').iid }).error).toMatch(/Stasis/);
  });

  it('coil-aruvi: big allies arrive bigger; ascends at 3 big summons: +2|+2 to all and Pierce for 5+ power', () => {
    const s = board({ hand: [['zz-ogre'], []], line: [['coil-aruvi'], []] });
    s.players[0].heroes = ['coil-aruvi'];
    s.players[0].seen.bigSummoned = 2;
    play(s, 'zz-ogre');
    const o = unit(s, 0, 'zz-ogre');
    expect(isAscended(s, 0, 'coil-aruvi')).toBe(true);
    expect(st(s, o)).toMatchObject({ power: 8, health: 8 });
    expect(st(s, o).keywords).toContain('pierce');
    expect(st(s, unit(s, 0, 'coil-aruvi'))).toMatchObject({ power: 6, health: 8 });
  });

  it('coil-brakk: ascends after dealing 10 damage, mid-attack, and may attack again', () => {
    const s = board({ line: [['coil-brakk'], ['zz-wall']] });
    s.players[0].heroes = ['coil-brakk'];
    const b = unit(s, 0, 'coil-brakk');
    b.seen.damageDealt = 4;
    attack(s, [b]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(14);
    expect(isAscended(s, 0, 'coil-brakk')).toBe(true);
    expect(s.players[0].canAttack).toBe(true);
    pass(s); // defender
    attack(s, [b], [[unit(s, 1, 'zz-wall'), b]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(14 - 2); // 8 power into a 6-health wall, Pierce 2
    expect(st(s, b)).toMatchObject({ power: 9, health: 9 }); // Strike: +1|+1
  });

  it('under-sable: ascends when 4 allies have died, summons 2 Wire Rats, then drains on each ally death', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['zz-wall'], ['under-sable', 'zz-grunt']], first: 0 });
    s.players[1].heroes = ['under-sable'];
    s.players[1].seen.alliesDied = 3;
    s.players[1].spire = 15;
    const g = unit(s, 1, 'zz-grunt');
    g.dmg = 1;
    play(s, 'zz-zap', [g.iid]);
    expect(isAscended(s, 1, 'under-sable')).toBe(true);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['under-sable', 'under-wirerat', 'under-wirerat']);
    expect(st(s, unit(s, 1, 'under-sable')).keywords).toEqual(expect.arrayContaining(['dread', 'corrosive']));
    unit(s, 1, 'under-wirerat').doomed = true;
    pass(s);
    expect(s.players[0].spire).toBe(19);
    expect(s.players[1].spire).toBe(16);
  });

  it('under-vex: Siphon; ascends at 8 Spire repaired, drains 3 from every enemy, then 2 from the Spire each Dusk', () => {
    const s = board({ line: [['under-vex'], ['zz-grunt', 'zz-ogre']] });
    s.players[0].heroes = ['under-vex'];
    s.players[0].spire = 5;
    s.players[0].seen.spireHealed = 4;
    attack(s, [unit(s, 0, 'under-vex')]); // unblocked? defender may block; none assigned
    resolveCombat(s);
    expect(isAscended(s, 0, 'under-vex')).toBe(true);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-ogre']);
    expect(s.players[0].spire).toBe(5 + 4 + 6);
    pass(s); pass(s);
    expect(s.players[1].spire).toBe(20 - 4 - 2);
  });

  it('storm-jax: ascends at 8 Spire damage and rallies; then grows on each Spire strike', () => {
    const s = board({ line: [['storm-jax'], []] });
    s.players[0].heroes = ['storm-jax'];
    s.players[0].seen.spireDamage = 5;
    const j = unit(s, 0, 'storm-jax');
    attack(s, [j]);
    resolveCombat(s);
    expect(isAscended(s, 0, 'storm-jax')).toBe(true);
    expect(s.players[0].canAttack).toBe(true);
    pass(s);
    attack(s, [j]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 3 - 4);
    expect(st(s, j).power).toBe(5);
    expect(st(s, j).keywords).toEqual(expect.arrayContaining(['aerial', 'vanguard']));
  });

  it('storm-corvane: Assault pumps attackers; ascends at 10 declared attackers and summons 2 Wingmates', () => {
    const s = board({ line: [['storm-corvane', 'zz-grunt'], []] });
    s.players[0].heroes = ['storm-corvane'];
    s.players[0].seen.attackersDeclared = 8;
    attack(s, [unit(s, 0, 'storm-corvane'), unit(s, 0, 'zz-grunt')]);
    expect(isAscended(s, 0, 'storm-corvane')).toBe(true);
    expect(s.players[0].line.map((u) => u.card)).toEqual(['storm-corvane', 'zz-grunt', 'storm-wingmate', 'storm-wingmate']);
    resolveCombat(s);
    // Base assault fired before ascending: +1|+0 each -> (4+1 as base face... ascended face 5 +1) + (2+1)
    expect(s.players[1].spire).toBe(20 - 6 - 3);
    place(s, 0, 'zz-grunt');
  });

  it('R-S1 a conditional aura reads power after plain auras (audit: Aruvi + an ally raised to 5 by another aura)', () => {
    const s = board({ line: [['coil-aruvi', 'prism-ysolde', 'zz-grunt'], []] });
    s.players[0].ascended = ['coil-aruvi', 'prism-ysolde'];
    const g = unit(s, 0, 'zz-grunt');
    g.mods.push({ power: 2, health: 0, dur: 'perm' }); // 4 power on its own
    expect(st(s, g).power).toBe(5); // +1 from Ysolde's aura
    expect(st(s, g).keywords).toContain('pierce');
    s.players[0].ascended = ['coil-aruvi'];
    expect(st(s, g).keywords).not.toContain('pierce');
  });

  it('R-S2 a Strike buff cannot save a unit that took lethal damage (audit: Brakk Apex)', () => {
    const s = board({ line: [['coil-brakk'], ['zz-ogre']] });
    s.players[0].heroes = ['coil-brakk'];
    s.players[0].ascended = ['coil-brakk'];
    const b = unit(s, 0, 'coil-brakk');
    b.dmg = 7; // 1 health left
    attack(s, [b], [[unit(s, 1, 'zz-ogre'), b]]);
    resolveCombat(s);
    expect(s.players[0].line.length).toBe(0);
    expect(s.players[1].line.length).toBe(0);
  });
});
