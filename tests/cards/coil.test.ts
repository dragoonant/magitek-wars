// Behaviour tests for every Verdant Coil collectible card (heroes: both faces). Each one fails if the mechanic is removed,
// hits the wrong side or uses the wrong number.
import { describe, expect, it } from 'vitest';
import { attack, board, pass, play, resolveCombat, st, unit } from '../helpers';
import { applyAction } from '../../src/engine/rules';
import type { GameState } from '../../src/engine/types';

/** Play through to the start of the next round. */
function nextRound(s: GameState): void {
  const r = s.round;
  let guard = 0;
  while (s.round === r && guard++ < 10) pass(s);
  expect(s.round).toBe(r + 1);
}
const strikes = (s: GameState) => s.log.filter((e) => e.k === 'strike');

describe('coil heroes', () => {
  it('coil-aruvi: Mend; a summoned ally with 5+ power gets +1|+1 (aura power counts), others get nothing', () => {
    const s = board({ hand: [['zz-ogre', 'zz-grunt', 'coil-crownmaw'], []], line: [['coil-aruvi', 'zz-grunt', 'zz-grunt'], []] });
    const a = unit(s, 0, 'coil-aruvi');
    a.dmg = 3;
    play(s, 'zz-ogre');
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 6, health: 6 });
    pass(s);
    play(s, 'zz-grunt'); // 2 power: nothing
    expect(st(s, unit(s, 0, 'zz-grunt', 2))).toMatchObject({ power: 2, health: 2 });
    pass(s);
    play(s, 'coil-crownmaw'); // 3 + 2 (aura, 3+ other allies) = 5 power
    expect(st(s, unit(s, 0, 'coil-crownmaw'))).toMatchObject({ power: 6, health: 4 });
    expect(s.players[0].seen.bigSummoned).toBe(2);
    nextRound(s);
    expect(a.dmg).toBe(0); // Mend
  });

  it('coil-aruvi: the enemy summoning a 5-power unit gets nothing', () => {
    const s = board({ hand: [[], ['zz-ogre']], line: [['coil-aruvi'], []], first: 1 });
    play(s, 'zz-ogre');
    expect(st(s, unit(s, 1, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
  });

  it('coil-aruvi: ascends on the 3rd big summon; +2|+2 to every ally, Pierce to allies with 5+ power (aura power counts)', () => {
    const s = board({ hand: [['zz-ogre'], []], line: [['coil-aruvi', 'zz-grunt'], ['zz-grunt']] });
    s.players[0].heroes = ['coil-aruvi'];
    s.players[0].seen.bigSummoned = 2;
    play(s, 'zz-ogre');
    expect(s.players[0].ascended).toContain('coil-aruvi');
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 8, health: 8 }); // 5 +1|+1 +2|+2
    expect(st(s, unit(s, 0, 'zz-ogre')).keywords).toContain('pierce');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt')).keywords).not.toContain('pierce');
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'coil-aruvi'))).toMatchObject({ power: 6, health: 8 });
    expect(st(s, unit(s, 0, 'coil-aruvi')).keywords).toEqual(expect.arrayContaining(['mend', 'pierce']));
    // power that arrives through an aura counts: Crownmaw 3 + 2 = 5
    const t = board({ line: [['coil-aruvi', 'coil-crownmaw', 'zz-grunt', 'zz-grunt'], []] });
    t.players[0].ascended = ['coil-aruvi'];
    expect(st(t, unit(t, 0, 'coil-crownmaw')).power).toBe(5);
    expect(st(t, unit(t, 0, 'coil-crownmaw')).keywords).toContain('pierce');
    // and the Pierce really sends the excess to the Spire
    const u = board({ line: [['coil-aruvi', 'zz-ogre'], ['zz-filler']] });
    u.players[0].ascended = ['coil-aruvi'];
    attack(u, [unit(u, 0, 'zz-ogre')], [[unit(u, 1, 'zz-filler'), unit(u, 0, 'zz-ogre')]]);
    resolveCombat(u);
    expect(u.players[1].spire).toBe(16);
  });

  it('coil-aruvi: ascended Mend repairs at the start of the round', () => {
    const s = board({ line: [['coil-aruvi'], []] });
    s.players[0].ascended = ['coil-aruvi'];
    unit(s, 0, 'coil-aruvi').dmg = 4;
    nextRound(s);
    expect(unit(s, 0, 'coil-aruvi').dmg).toBe(0);
  });

  it('coil-brakk: base face has Pierce but no Mend and no Strike growth; dealing 10 damage ascends it mid-attack', () => {
    const s = board({ line: [['coil-brakk'], ['zz-filler']] });
    const b = unit(s, 0, 'coil-brakk');
    expect(st(s, b)).toMatchObject({ power: 6, health: 6 });
    expect(st(s, b).keywords).toEqual(['pierce']);
    attack(s, [b], [[unit(s, 1, 'zz-filler'), b]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(15); // 6 - 1 health = 5 through
    expect(st(s, b)).toMatchObject({ power: 6, health: 6 });
    expect(s.players[0].ascended).not.toContain('coil-brakk'); // 6 damage dealt: not yet 10
    nextRound(s);
    b.dmg = 3;
    nextRound(s);
    expect(b.dmg).toBe(3); // no Mend on the base face

    const t = board({ line: [['coil-brakk'], ['zz-wall']] });
    t.players[0].heroes = ['coil-brakk'];
    unit(t, 0, 'coil-brakk').seen.damageDealt = 4;
    attack(t, [unit(t, 0, 'coil-brakk')]);
    resolveCombat(t);
    expect(t.players[0].ascended).toContain('coil-brakk');
  });

  it('coil-brakk: ascending gives one more attack, even if the round attack was unused; the extra one is banked', () => {
    const s = board({ hand: [['coil-lash-out'], []], line: [['coil-brakk'], ['zz-grunt']] });
    s.players[0].heroes = ['coil-brakk'];
    const b = unit(s, 0, 'coil-brakk');
    b.seen.damageDealt = 9;
    play(s, 'coil-lash-out', [b.iid, unit(s, 1, 'zz-grunt').iid]);
    pass(s); pass(s);
    expect(s.players[0].ascended).toContain('coil-brakk');
    attack(s, [b]);
    resolveCombat(s);
    pass(s);
    expect(s.players[0].canAttack).toBe(true); // the banked extra attack
    attack(s, [b]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 8 - 9); // 8 power, then 9 after the first attack's Strike
  });

  it('coil-brakk: ascended Pierce, Strike +1|+1 (lasting) and Mend', () => {
    const s = board({ line: [['coil-brakk'], ['zz-filler']] });
    s.players[0].ascended = ['coil-brakk'];
    const b = unit(s, 0, 'coil-brakk');
    expect(st(s, b)).toMatchObject({ power: 8, health: 8 });
    attack(s, [b], [[unit(s, 1, 'zz-filler'), b]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(13); // 8 - 1 = 7 through
    expect(st(s, b)).toMatchObject({ power: 9, health: 9 });
    b.dmg = 5;
    nextRound(s);
    expect(b.dmg).toBe(0); // Mend
    expect(st(s, b)).toMatchObject({ power: 9, health: 9 }); // the growth is lasting
  });

  it('coil-brakk: ascended Strike +1|+1 cannot save a unit that took lethal damage', () => {
    const s = board({ line: [['coil-brakk'], ['zz-ogre']] });
    s.players[0].ascended = ['coil-brakk'];
    const b = unit(s, 0, 'coil-brakk');
    b.dmg = 7;
    attack(s, [b], [[unit(s, 1, 'zz-ogre'), b]]);
    resolveCombat(s);
    expect(s.players[0].line.length).toBe(0);
    expect(s.players[1].line.length).toBe(0);
  });
});

describe('coil units', () => {
  it('coil-sprout-tender: Dawn gains 1 Charge for you only', () => {
    const s = board({ line: [['coil-sprout-tender'], ['zz-grunt']] });
    nextRound(s);
    expect(s.round).toBe(2);
    expect(s.players[0].charge).toBe(s.players[0].maxCharge + 1);
    expect(s.players[1].charge).toBe(s.players[1].maxCharge);
    nextRound(s);
    expect(s.players[0].charge).toBe(s.players[0].maxCharge + 1);
  });

  it('coil-thornback-cub: Mend repairs it fully at the start of the round (a plain unit is not repaired)', () => {
    const s = board({ line: [['coil-thornback-cub', 'zz-grunt'], []] });
    const c = unit(s, 0, 'coil-thornback-cub');
    c.dmg = 1;
    unit(s, 0, 'zz-grunt').dmg = 1;
    nextRound(s);
    expect(c.dmg).toBe(0);
    expect(unit(s, 0, 'zz-grunt').dmg).toBe(1);
  });

  it('coil-rootling: Deploy raises your maximum Charge by 1 (not the current Charge, not the enemy)', () => {
    const s = board({ hand: [['coil-rootling'], []] });
    s.players[0].maxCharge = 5;
    s.players[0].charge = 5;
    s.players[1].maxCharge = 5;
    play(s, 'coil-rootling');
    expect(s.players[0].maxCharge).toBe(6);
    expect(s.players[0].charge).toBe(4); // paid 1, none added
    expect(s.players[1].maxCharge).toBe(5);
  });

  it('coil-spearhorn: Pierce sends excess damage to the Spire; nothing past a big blocker', () => {
    const s = board({ line: [['coil-spearhorn'], ['zz-filler']] });
    attack(s, [unit(s, 0, 'coil-spearhorn')], [[unit(s, 1, 'zz-filler'), unit(s, 0, 'coil-spearhorn')]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(19);
    const t = board({ line: [['coil-spearhorn'], ['zz-wall']] });
    attack(t, [unit(t, 0, 'coil-spearhorn')], [[unit(t, 1, 'zz-wall'), unit(t, 0, 'coil-spearhorn')]]);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20);
  });

  it('coil-vinewhip: Deploy strikes the chosen enemy for 2 and takes no damage back', () => {
    const s = board({ hand: [['coil-vinewhip'], []], line: [[], ['zz-wall', 'zz-ogre']] });
    play(s, 'coil-vinewhip', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0);
    expect(unit(s, 0, 'coil-vinewhip').dmg).toBe(0); // the ogre has 5 power
    const t = board({ hand: [['coil-vinewhip'], []] });
    play(t, 'coil-vinewhip'); // no enemy: still plays
    expect(t.players[0].line.length).toBe(1);
    expect(strikes(t).length).toBe(0);
  });

  it('coil-sap-engine: Deploy gains 2 Charge for you only', () => {
    const s = board({ hand: [['coil-sap-engine'], []] });
    s.players[0].charge = 5;
    s.players[1].charge = 5;
    play(s, 'coil-sap-engine');
    expect(s.players[0].charge).toBe(5); // 5 - 2 + 2
    expect(s.players[1].charge).toBe(5);
  });

  it('coil-crownmaw: +2|+0 only with 2 or more other allies (enemies do not count); it counts as a big summon', () => {
    const s = board({ hand: [['coil-crownmaw'], []], line: [['zz-grunt', 'zz-grunt'], []] });
    play(s, 'coil-crownmaw');
    expect(st(s, unit(s, 0, 'coil-crownmaw'))).toMatchObject({ power: 5, health: 3 });
    expect(s.players[0].seen.bigSummoned).toBe(1);
    const t = board({ line: [['coil-crownmaw', 'zz-grunt'], ['zz-grunt', 'zz-grunt', 'zz-grunt']] });
    expect(st(t, unit(t, 0, 'coil-crownmaw')).power).toBe(3);
    t.players[0].line.pop();
    t.players[0].line.push(...[unit(s, 0, 'zz-grunt'), unit(s, 0, 'zz-grunt', 1)]);
    expect(st(t, unit(t, 0, 'coil-crownmaw')).power).toBe(5);
    t.players[0].line.pop(); // back to one other ally
    expect(st(t, unit(t, 0, 'coil-crownmaw')).power).toBe(3);
  });

  it('coil-bloomcaller: Dawn gives one random OTHER ally +1|+0 (both candidates are chosen over many seeds)', () => {
    let grunt = 0, wall = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = board({ seed, line: [['coil-bloomcaller', 'zz-grunt', 'zz-wall'], ['zz-grunt']] });
      nextRound(s);
      const g = st(s, unit(s, 0, 'zz-grunt')), w = st(s, unit(s, 0, 'zz-wall'));
      expect(g.health).toBe(2);
      expect(w.health).toBe(6);
      expect(st(s, unit(s, 0, 'coil-bloomcaller')).power).toBe(2);
      expect(st(s, unit(s, 1, 'zz-grunt')).power).toBe(2);
      expect(g.power - 2 + w.power).toBe(1); // exactly one +1 in total
      if (g.power === 3) grunt++; else wall++;
    }
    expect(grunt).toBeGreaterThan(3);
    expect(wall).toBeGreaterThan(3);
  });

  it('coil-lashvine: Assault strikes the enemy with the lowest power (leftmost on ties), for 2', () => {
    const s = board({ line: [['coil-lashvine'], ['zz-ogre', 'zz-grunt', 'zz-wall', 'zz-filler']] });
    attack(s, [unit(s, 0, 'coil-lashvine')]);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(2); // power 0, not the one with the lowest health
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(0);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 1, 'zz-filler').dmg).toBe(0);
    expect(unit(s, 0, 'coil-lashvine').dmg).toBe(0);
    const t = board({ line: [['coil-lashvine'], ['zz-grunt', 'zz-grunt']] });
    unit(t, 1, 'zz-grunt', 1).dmg = 1;
    attack(t, [unit(t, 0, 'coil-lashvine')]);
    expect(t.players[1].line.length).toBe(1);
    expect(unit(t, 1, 'zz-grunt').dmg).toBe(1); // the left one (full health) was struck
  });

  it('coil-tuskhide: Pierce sends the excess to the Spire; Resonant gives +0|+2', () => {
    const s = board({ line: [['coil-tuskhide', 'coil-aruvi'], ['zz-grunt']] });
    attack(s, [unit(s, 0, 'coil-tuskhide')], [[unit(s, 1, 'zz-grunt'), unit(s, 0, 'coil-tuskhide')]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(17);
    expect(st(s, unit(s, 0, 'coil-tuskhide'))).toMatchObject({ power: 5, health: 3 });
    s.players[0].ascended = ['coil-aruvi'];
    expect(st(s, unit(s, 0, 'coil-tuskhide'))).toMatchObject({ power: 5, health: 5 });
  });

  it('coil-spore-herald: Deploy gives every other ally a lasting +1|+1, not itself and not the enemy', () => {
    const s = board({ hand: [['coil-spore-herald'], []], line: [['zz-grunt', 'zz-wall'], ['zz-grunt']] });
    play(s, 'coil-spore-herald');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 1, health: 7 });
    expect(st(s, unit(s, 0, 'coil-spore-herald'))).toMatchObject({ power: 3, health: 4 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
  });

  it('coil-canopy-titan: Mend repairs it; Pierce hits the Spire past a blocker', () => {
    const s = board({ line: [['coil-canopy-titan'], ['zz-grunt']] });
    const t = unit(s, 0, 'coil-canopy-titan');
    attack(s, [t], [[unit(s, 1, 'zz-grunt'), t]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(17);
    expect(t.dmg).toBe(2);
    pass(s); pass(s);
    expect(t.dmg).toBe(0);
  });

  it('coil-behemoth: Pierce past a blocker; Deploy strikes the chosen enemy for 5, takes nothing back, no overflow', () => {
    const s = board({ hand: [['coil-behemoth'], []], line: [[], ['zz-wall', 'zz-ogre']] });
    play(s, 'coil-behemoth', [unit(s, 1, 'zz-ogre').iid]);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
    expect(unit(s, 0, 'coil-behemoth').dmg).toBe(0);
    expect(s.players[1].spire).toBe(20);
    const t = board({ hand: [['coil-behemoth'], []], line: [[], ['zz-wall', 'zz-ogre']] });
    play(t, 'coil-behemoth', [unit(t, 1, 'zz-wall').iid]);
    expect(unit(t, 1, 'zz-wall').dmg).toBe(5);
    expect(unit(t, 1, 'zz-ogre').dmg).toBe(0);
    const u = board({ line: [['coil-behemoth'], ['zz-filler']] });
    attack(u, [unit(u, 0, 'coil-behemoth')], [[unit(u, 1, 'zz-filler'), unit(u, 0, 'coil-behemoth')]]);
    resolveCombat(u);
    expect(u.players[1].spire).toBe(16);
  });

  it('coil-domewyrm: 8 power Pierce hits the Spire past a blocker; Mend repairs it', () => {
    const s = board({ line: [['coil-domewyrm'], ['zz-grunt']] });
    const d = unit(s, 0, 'coil-domewyrm');
    attack(s, [d], [[unit(s, 1, 'zz-grunt'), d]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(14);
    d.dmg = 3;
    pass(s); pass(s);
    expect(d.dmg).toBe(0);
  });
});

describe('coil glyphs', () => {
  it('coil-sap-surge: gain 2 Charge (you only)', () => {
    const s = board({ hand: [['coil-sap-surge'], []] });
    s.players[0].charge = 5;
    s.players[1].charge = 5;
    play(s, 'coil-sap-surge');
    expect(s.players[0].charge).toBe(6); // 5 - 1 + 2
    expect(s.players[1].charge).toBe(5);
  });

  it('coil-bristle: +3|+0 to the chosen ally this round only', () => {
    const s = board({ hand: [['coil-bristle'], []], line: [['zz-grunt', 'zz-wall'], []] });
    play(s, 'coil-bristle', [unit(s, 0, 'zz-grunt').iid]);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 5, health: 2 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 6 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('coil-overgrowth: +3|+3 and Pierce to the chosen ally this round only', () => {
    const s = board({ hand: [['coil-overgrowth'], []], line: [['zz-grunt', 'zz-ogre'], ['zz-filler']] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'coil-overgrowth', [g.iid]);
    expect(st(s, g)).toMatchObject({ power: 5, health: 5 });
    expect(st(s, g).keywords).toContain('pierce');
    expect(st(s, unit(s, 0, 'zz-ogre')).keywords).not.toContain('pierce');
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
    attack(s, [g], [[unit(s, 1, 'zz-filler'), g]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(16);
    nextRound(s);
    expect(st(s, g)).toMatchObject({ power: 2, health: 2 });
    expect(st(s, g).keywords).not.toContain('pierce');
  });

  it('coil-duel-of-thorns: the ally and the enemy strike each other, nobody else is touched', () => {
    const s = board({ hand: [['coil-duel-of-thorns'], []], line: [['zz-ogre', 'zz-wall'], ['zz-grunt', 'zz-ogre']] });
    play(s, 'coil-duel-of-thorns', [unit(s, 0, 'zz-ogre').iid, unit(s, 1, 'zz-grunt').iid]);
    pass(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-ogre']);
    expect(unit(s, 0, 'zz-ogre').dmg).toBe(2);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(0);
    expect(unit(s, 0, 'zz-wall').dmg).toBe(0);
    const t = board({ hand: [['coil-duel-of-thorns'], []], line: [['zz-ogre'], ['zz-ogre']] });
    play(t, 'coil-duel-of-thorns', [unit(t, 0, 'zz-ogre').iid, unit(t, 1, 'zz-ogre').iid]);
    pass(t);
    expect(t.players[0].line.length + t.players[1].line.length).toBe(0); // both strike for 5
  });

  it('coil-duel-of-thorns: needs both fighters: it cannot be cast with no enemy unit (R-G10)', () => {
    const s = board({ hand: [['coil-duel-of-thorns'], []], line: [['zz-ogre'], []] });
    const r = applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid, targets: [unit(s, 0, 'zz-ogre').iid] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No legal target/);
    expect(s.players[0].hand.length).toBe(1);
  });

  it('coil-lash-out: the ally strikes the enemy and takes nothing back; nobody else is touched', () => {
    const s = board({ hand: [['coil-lash-out'], []], line: [['zz-grunt', 'zz-wall'], ['zz-grunt', 'zz-ogre']] });
    play(s, 'coil-lash-out', [unit(s, 0, 'zz-grunt').iid, unit(s, 1, 'zz-ogre').iid]);
    pass(s);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(unit(s, 0, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 0, 'zz-wall').dmg).toBe(0);
    const t = board({ hand: [['coil-lash-out'], []], line: [['zz-ogre'], ['zz-grunt']] });
    play(t, 'coil-lash-out', [unit(t, 0, 'zz-ogre').iid, unit(t, 1, 'zz-grunt').iid]);
    pass(t);
    expect(t.players[1].line.length).toBe(0);
    expect(unit(t, 0, 'zz-ogre').dmg).toBe(0);
  });

  it('coil-lash-out: needs both units: it cannot be cast with no enemy unit (R-G10)', () => {
    const s = board({ hand: [['coil-lash-out'], []], line: [['zz-ogre'], []] });
    const r = applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid, targets: [unit(s, 0, 'zz-ogre').iid] });
    expect(r.ok).toBe(false);
    expect(s.players[0].hand.length).toBe(1);
  });

  it('coil-grafting: a lasting +2|+2 and Mend for the chosen ally only', () => {
    const s = board({ hand: [['coil-grafting'], []], line: [['zz-grunt', 'zz-wall'], []] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'coil-grafting', [g.iid]);
    pass(s);
    expect(st(s, g)).toMatchObject({ power: 4, health: 4 });
    expect(st(s, g).keywords).toContain('mend');
    expect(st(s, unit(s, 0, 'zz-wall')).keywords).not.toContain('mend');
    g.dmg = 2;
    unit(s, 0, 'zz-wall').dmg = 2;
    nextRound(s);
    expect(g.dmg).toBe(0);
    expect(unit(s, 0, 'zz-wall').dmg).toBe(2);
    expect(st(s, g)).toMatchObject({ power: 4, health: 4 });
  });

  it('coil-canopy-rampage: each ally with 4+ power (exactly 4 counts, 3 does not) strikes the enemy with the highest power', () => {
    const s = board({
      hand: [['coil-canopy-rampage'], []],
      line: [['zz-ogre', 'zz-grunt', 'zz-grunt'], ['zz-wall', 'zz-ogre', 'zz-grunt']],
    });
    unit(s, 1, 'zz-ogre').mods.push({ power: 0, health: 8, dur: 'perm' }); // 5|13
    unit(s, 0, 'zz-grunt', 0).mods.push({ power: 2, health: 0, dur: 'perm' }); // 4 power
    unit(s, 0, 'zz-grunt', 1).mods.push({ power: 1, health: 0, dur: 'perm' }); // 3 power
    play(s, 'coil-canopy-rampage');
    pass(s);
    expect(strikes(s).length).toBe(2);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(9); // 5 + 4
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0); // the wall has the highest health, not the highest power
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(s.players[0].line.every((u) => u.dmg === 0)).toBe(true);
  });

  it('coil-canopy-rampage: the target is picked once when it resolves; later strikers hit the same unit', () => {
    const s = board({
      hand: [['coil-canopy-rampage'], []],
      line: [['coil-tuskhide', 'coil-tuskhide'], ['zz-ogre', 'zz-grunt']],
    });
    play(s, 'coil-canopy-rampage');
    pass(s);
    expect(strikes(s).map((e) => e.tcard)).toEqual(['zz-ogre', 'zz-ogre']);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-grunt']);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
  });

  it('coil-hothouse-bloom: raises max Charge and Reserve by 1; Resonant raises max Charge by 1 more', () => {
    const s = board({ hand: [['coil-hothouse-bloom'], []] });
    s.players[0].maxCharge = 5;
    s.players[0].charge = 5;
    s.players[1].maxCharge = 5;
    play(s, 'coil-hothouse-bloom');
    pass(s);
    expect(s.players[0].maxCharge).toBe(6);
    expect(s.players[0].reserve).toBe(1);
    expect(s.players[1].maxCharge).toBe(5);
    expect(s.players[1].reserve).toBe(0);
    const r = board({ hand: [['coil-hothouse-bloom'], []], line: [['coil-aruvi'], []] });
    r.players[0].ascended = ['coil-aruvi'];
    r.players[0].maxCharge = 5;
    r.players[0].charge = 5;
    play(r, 'coil-hothouse-bloom');
    pass(r);
    expect(r.players[0].maxCharge).toBe(7);
    expect(r.players[0].reserve).toBe(1);
  });

  it('coil-verdant-surge: every ally gets a lasting +3|+3, the enemy does not', () => {
    const s = board({ hand: [['coil-verdant-surge'], []], line: [['zz-ogre', 'zz-grunt'], ['zz-grunt']] });
    play(s, 'coil-verdant-surge');
    pass(s);
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 8, health: 8 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 5, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 5, health: 5 });
  });
});

// ---------- First Light additions: seed-sower (Halcy) and pack hunter (Nyra) ----------
const saplings = (s: GameState, seat: 0 | 1 = 0) => s.players[seat].line.filter((u) => u.card === 'coil-sapling');

describe('coil heroes (First Light)', () => {
  it('coil-halcy: Deploy and Dusk each summon a Sapling; Saplings grow at Dawn; not yet ascended at 2 tokens', () => {
    const s = board({ hand: [['coil-halcy'], []] });
    play(s, 'coil-halcy');
    expect(saplings(s).length).toBe(1);
    expect(st(s, unit(s, 0, 'coil-halcy'))).toMatchObject({ power: 1, health: 3 });
    nextRound(s); // Dusk: a second Sapling; Dawn: both grow
    expect(saplings(s).length).toBe(2);
    for (const p of saplings(s)) expect(st(s, p)).toMatchObject({ power: 1, health: 2 });
    expect(s.players[0].seen.tokensSummoned).toBe(2);
    expect(s.players[0].ascended).not.toContain('coil-halcy');
  });

  it('coil-halcy: ascends on the 7th token; Ascend summons two Saplings and gives every Sapling +2|+2 (plus the +1|+1 aura)', () => {
    const s = board({ hand: [['coil-halcy'], []], line: [['zz-grunt'], ['zz-grunt']] });
    s.players[0].seen.tokensSummoned = 6;
    play(s, 'coil-halcy'); // Deploy Sapling = 7th token
    expect(s.players[0].ascended).toContain('coil-halcy');
    expect(saplings(s).length).toBe(3);
    for (const p of saplings(s)) expect(st(s, p)).toMatchObject({ power: 3, health: 4 }); // 0|1 +2|+2 +1|+1
    expect(st(s, unit(s, 0, 'coil-halcy'))).toMatchObject({ power: 2, health: 5 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('coil-halcy: ascended face keeps Dusk: summon a Sapling, and its aura gives only Saplings +1|+1', () => {
    const s = board({ line: [['coil-halcy', 'coil-sapling', 'zz-grunt'], []] });
    s.players[0].ascended = ['coil-halcy'];
    expect(st(s, unit(s, 0, 'coil-sapling'))).toMatchObject({ power: 1, health: 2 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(saplings(s).length).toBe(2);
    expect(st(s, unit(s, 0, 'coil-sapling', 0))).toMatchObject({ power: 2, health: 3 }); // grew at Dawn, +aura
    expect(st(s, unit(s, 0, 'coil-sapling', 1))).toMatchObject({ power: 2, health: 3 }); // summoned at Dusk, grew at Dawn
  });

  it('coil-nyra: grows +1|+0 when an enemy unit is destroyed, not when an ally is', () => {
    const s = board({ hand: [['zz-bolt', 'zz-bolt'], []], line: [['coil-nyra', 'zz-grunt'], ['zz-grunt']] });
    const n = unit(s, 0, 'coil-nyra');
    play(s, 'zz-bolt', [unit(s, 1, 'zz-grunt').iid]);
    pass(s);
    expect(st(s, n)).toMatchObject({ power: 4, health: 4 });
    pass(s);
    play(s, 'zz-bolt', [unit(s, 0, 'zz-grunt').iid]);
    pass(s);
    expect(s.players[0].line.length).toBe(1);
    expect(st(s, n)).toMatchObject({ power: 4, health: 4 });
    expect(st(s, n).keywords).not.toContain('pierce');
  });

  it('coil-nyra: ascends on the 6th enemy destroyed; Ascend summons two Pack Wolves and gives every ally +1|+1', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['coil-nyra', 'zz-grunt'], ['zz-filler', 'zz-grunt']] });
    s.players[0].heroes = ['coil-nyra'];
    s.players[0].seen.enemiesDied = 5;
    play(s, 'zz-zap', [unit(s, 1, 'zz-filler').iid]);
    expect(s.players[0].ascended).toContain('coil-nyra');
    const wolves = s.players[0].line.filter((u) => u.card === 'coil-packwolf');
    expect(wolves.length).toBe(2);
    for (const w of wolves) expect(st(s, w)).toMatchObject({ power: 3, health: 2 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const n = st(s, unit(s, 0, 'coil-nyra'));
    expect(n).toMatchObject({ power: 7, health: 6 }); // 5|5, +1|+0 from the base-face trigger already queued, +1|+1
    expect(n.keywords).toContain('pierce');
  });

  it('coil-nyra: ascended, an enemy destroyed gives every ally +1|+0 this round only', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['coil-nyra', 'zz-grunt'], ['zz-filler', 'zz-grunt']] });
    s.players[0].ascended = ['coil-nyra'];
    play(s, 'zz-zap', [unit(s, 1, 'zz-filler').iid]);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 2 });
    expect(st(s, unit(s, 0, 'coil-nyra'))).toMatchObject({ power: 6, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'coil-nyra'))).toMatchObject({ power: 5, health: 5 });
  });
});

describe('coil units (First Light)', () => {
  it('coil-furrow-hand: Deploy summons a Sapling that grows +1|+1 each Dawn up to 3|4', () => {
    const s = board({ hand: [['coil-furrow-hand'], []] });
    play(s, 'coil-furrow-hand');
    expect(saplings(s).length).toBe(1);
    expect(s.players[0].seen.tokensSummoned).toBe(1);
    expect(saplings(s, 1).length).toBe(0);
    const p = saplings(s)[0];
    expect(st(s, p)).toMatchObject({ power: 0, health: 1 });
    for (const want of [[1, 2], [2, 3], [3, 4], [3, 4]]) {
      nextRound(s);
      expect(st(s, p)).toMatchObject({ power: want[0], health: want[1] });
    }
  });

  it('coil-thicket-jackal: Assault gives +2|+0 this round only if an enemy unit was destroyed this round', () => {
    const s = board({ line: [['coil-thicket-jackal'], ['zz-wall']] });
    attack(s, [unit(s, 0, 'coil-thicket-jackal')]);
    expect(st(s, unit(s, 0, 'coil-thicket-jackal')).power).toBe(1);
    const t = board({ hand: [['zz-zap'], []], line: [['coil-thicket-jackal'], ['zz-filler', 'zz-wall']] });
    play(t, 'zz-zap', [unit(t, 1, 'zz-filler').iid]);
    const j = unit(t, 0, 'coil-thicket-jackal');
    expect(st(t, j).power).toBe(1); // nothing until it attacks
    attack(t, [j]);
    expect(st(t, j)).toMatchObject({ power: 3, health: 1 });
    resolveCombat(t);
    nextRound(t);
    expect(st(t, j).power).toBe(1);
  });

  it('coil-carrion-beetle: gains 1 Charge when an enemy unit is destroyed, not when an ally is', () => {
    const s = board({ hand: [['zz-zap', 'zz-bolt'], []], line: [['coil-carrion-beetle', 'zz-grunt'], ['zz-filler']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-filler').iid]);
    expect(s.players[0].charge).toBe(10); // 10 - 1 + 1
    play(s, 'zz-bolt', [unit(s, 0, 'zz-grunt').iid]);
    pass(s);
    expect(s.players[0].line.length).toBe(1);
    expect(s.players[0].charge).toBe(8); // 10 - 2, nothing back
    expect(s.players[1].charge).toBe(10);
  });

  it('coil-seed-drill: Assault summons a Sapling (it can join the next attack, not this one)', () => {
    const s = board({ line: [['coil-seed-drill'], []] });
    attack(s, [unit(s, 0, 'coil-seed-drill')]);
    expect(saplings(s).length).toBe(1);
    expect(s.players[0].seen.tokensSummoned).toBe(1);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(19);
  });

  it('coil-ridgeback: Strike gives a lasting +1|+1 only if an enemy unit was destroyed this round', () => {
    const s = board({ line: [['coil-ridgeback'], ['zz-wall']] });
    const r = unit(s, 0, 'coil-ridgeback');
    attack(s, [r], [[unit(s, 1, 'zz-wall'), r]]);
    resolveCombat(s);
    expect(st(s, r)).toMatchObject({ power: 2, health: 2 });
    const t = board({ line: [['coil-ridgeback'], ['zz-filler']] });
    const q = unit(t, 0, 'coil-ridgeback');
    attack(t, [q], [[unit(t, 1, 'zz-filler'), q]]);
    resolveCombat(t);
    expect(t.players[1].line.length).toBe(0);
    expect(st(t, q)).toMatchObject({ power: 3, health: 3 });
    nextRound(t);
    expect(st(t, q)).toMatchObject({ power: 3, health: 3 });
  });

  it('coil-snare-trapper: Deploy deals 1 to the chosen enemy; Resonant deals 2', () => {
    const s = board({ hand: [['coil-snare-trapper'], []], line: [[], ['zz-ogre', 'zz-grunt']] });
    play(s, 'coil-snare-trapper', [unit(s, 1, 'zz-ogre').iid]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(1);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    const r = board({ hand: [['coil-snare-trapper'], []], line: [['coil-aruvi'], ['zz-ogre']] });
    r.players[0].ascended = ['coil-aruvi'];
    play(r, 'coil-snare-trapper', [unit(r, 1, 'zz-ogre').iid]);
    expect(unit(r, 1, 'zz-ogre').dmg).toBe(2);
  });

  it('coil-grove-keeper: another ally summoned gets +1|+1 only if it is a Sapling', () => {
    const s = board({ hand: [['coil-furrow-hand'], []], line: [['coil-grove-keeper'], []] });
    play(s, 'coil-furrow-hand');
    expect(st(s, saplings(s)[0])).toMatchObject({ power: 1, health: 2 });
    expect(st(s, unit(s, 0, 'coil-furrow-hand'))).toMatchObject({ power: 1, health: 1 });
    expect(st(s, unit(s, 0, 'coil-grove-keeper'))).toMatchObject({ power: 2, health: 3 });
  });

  it('coil-tusk-challenger: Deploy makes it and the chosen enemy strike each other', () => {
    const s = board({ hand: [['coil-tusk-challenger'], []], line: [['zz-wall'], ['zz-grunt', 'zz-ogre']] });
    play(s, 'coil-tusk-challenger', [unit(s, 1, 'zz-grunt').iid]);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-ogre']);
    expect(unit(s, 0, 'coil-tusk-challenger').dmg).toBe(2);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(0);
    expect(unit(s, 0, 'zz-wall').dmg).toBe(0);
  });

  it('coil-bloodtrail: each enemy destroyed makes it strike a random enemy (kills chain); ally deaths do nothing', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['coil-bloodtrail'], ['zz-filler', 'zz-filler']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-filler').iid]);
    expect(s.players[1].line.length).toBe(0); // the second filler was struck for 2
    expect(unit(s, 0, 'coil-bloodtrail').dmg).toBe(0);
    const t = board({ hand: [['zz-bolt'], []], line: [['coil-bloodtrail', 'zz-grunt'], ['zz-wall']] });
    play(t, 'zz-bolt', [unit(t, 0, 'zz-grunt').iid]);
    pass(t);
    expect(unit(t, 1, 'zz-wall').dmg).toBe(0);
  });

  it('coil-ridge-howler: summons a Pack Wolf (2|1) when an enemy unit is destroyed', () => {
    const s = board({ hand: [['zz-zap'], []], line: [['coil-ridge-howler'], ['zz-filler']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-filler').iid]);
    const w = unit(s, 0, 'coil-packwolf');
    expect(st(s, w)).toMatchObject({ power: 2, health: 1 });
    expect(s.players[0].seen.tokensSummoned).toBe(1);
    expect(s.players[1].line.length).toBe(0);
  });

  it('coil-seed-thresher: Deploy summons a Sapling for each enemy unit, at most 3', () => {
    const s = board({ hand: [['coil-seed-thresher'], []], line: [[], ['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt']] });
    play(s, 'coil-seed-thresher');
    expect(saplings(s).length).toBe(3);
    const t = board({ hand: [['coil-seed-thresher'], []], line: [[], ['zz-grunt']] });
    play(t, 'coil-seed-thresher');
    expect(saplings(t).length).toBe(1);
    expect(t.players[0].seen.tokensSummoned).toBe(1);
  });

  it('coil-horncrown: Assault makes it and the strongest enemy strike each other; Resonant gives Pierce', () => {
    const s = board({ line: [['coil-horncrown'], ['zz-wall', 'zz-grunt']] });
    const h = unit(s, 0, 'coil-horncrown');
    expect(st(s, h).keywords).not.toContain('pierce');
    attack(s, [h]);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
    expect(h.dmg).toBe(2);
    const r = board({ line: [['coil-horncrown', 'coil-aruvi'], []] });
    r.players[0].ascended = ['coil-aruvi'];
    expect(st(r, unit(r, 0, 'coil-horncrown')).keywords).toContain('pierce');
  });

  it('coil-bloomwood-shepherd: Deploy summons two Saplings; Saplings (only) have +2|+0', () => {
    const s = board({ hand: [['coil-bloomwood-shepherd'], []], line: [['zz-grunt'], []] });
    play(s, 'coil-bloomwood-shepherd');
    expect(saplings(s).length).toBe(2);
    for (const p of saplings(s)) expect(st(s, p)).toMatchObject({ power: 2, health: 1 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'coil-bloomwood-shepherd'))).toMatchObject({ power: 4, health: 6 });
  });

  it('coil-bramblehulk: Deploy gives it +1|+1 for each other ally (not enemies); Pierce', () => {
    const s = board({ hand: [['coil-bramblehulk'], []], line: [['zz-grunt', 'zz-grunt', 'zz-wall'], ['zz-grunt']] });
    play(s, 'coil-bramblehulk');
    const b = st(s, unit(s, 0, 'coil-bramblehulk'));
    expect(b).toMatchObject({ power: 8, health: 8 });
    expect(b.keywords).toContain('pierce');
  });
});

describe('coil glyphs (First Light)', () => {
  it('coil-snaring-vine: the chosen enemy gets -2|+0 this round only', () => {
    const s = board({ hand: [['coil-snaring-vine'], []], line: [[], ['zz-ogre', 'zz-grunt']] });
    play(s, 'coil-snaring-vine', [unit(s, 1, 'zz-ogre').iid]);
    expect(st(s, unit(s, 1, 'zz-ogre'))).toMatchObject({ power: 3, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 1, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
  });

  it('coil-quickening-rain: every allied Sapling gets a lasting +1|+1 (others do not); Resonant doubles it', () => {
    const s = board({ hand: [['coil-quickening-rain'], []], line: [['coil-sapling', 'coil-sapling', 'zz-grunt'], ['coil-sapling']] });
    play(s, 'coil-quickening-rain');
    for (const p of saplings(s)) expect(st(s, p)).toMatchObject({ power: 1, health: 2 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, saplings(s, 1)[0])).toMatchObject({ power: 0, health: 1 });
    const r = board({ hand: [['coil-quickening-rain'], []], line: [['coil-aruvi', 'coil-sapling'], []] });
    r.players[0].ascended = ['coil-aruvi'];
    play(r, 'coil-quickening-rain');
    expect(st(r, saplings(r)[0])).toMatchObject({ power: 2, health: 3 });
  });

  it('coil-scent-of-blood: every ally +1|+0 this round, +2|+1 if an enemy unit was destroyed this round', () => {
    const s = board({ hand: [['coil-scent-of-blood'], []], line: [['zz-grunt'], ['zz-grunt']] });
    play(s, 'coil-scent-of-blood');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 2 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const t = board({ hand: [['zz-zap', 'coil-scent-of-blood'], []], line: [['zz-grunt'], ['zz-filler']] });
    play(t, 'zz-zap', [unit(t, 1, 'zz-filler').iid]);
    play(t, 'coil-scent-of-blood');
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 3 });
    nextRound(t);
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('coil-compost-heap: destroy your Sapling, gain 3 Charge; it can only target a Sapling', () => {
    const s = board({ hand: [['coil-compost-heap'], []], line: [['coil-sapling', 'zz-grunt'], []] });
    const bad = applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid, targets: [unit(s, 0, 'zz-grunt').iid] });
    expect(bad.ok).toBe(false);
    play(s, 'coil-compost-heap', [unit(s, 0, 'coil-sapling').iid]);
    pass(s);
    expect(saplings(s).length).toBe(0);
    expect(s.players[0].charge).toBe(12); // 10 - 1 + 3
  });

  it('coil-run-down: every ally strikes the chosen damaged enemy and takes nothing back; undamaged enemies are not legal', () => {
    const s = board({ hand: [['coil-run-down'], []], line: [['zz-grunt', 'zz-grunt', 'zz-wall'], ['zz-ogre', 'zz-grunt']] });
    const bad = applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid, targets: [unit(s, 1, 'zz-ogre').iid] });
    expect(bad.ok).toBe(false);
    unit(s, 1, 'zz-ogre').dmg = 1;
    play(s, 'coil-run-down', [unit(s, 1, 'zz-ogre').iid]);
    pass(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-grunt']); // 1 + 2 + 2 = 5
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(s.players[0].line.every((u) => u.dmg === 0)).toBe(true);
  });

  it('coil-thorn-volley: each allied Sapling (only) strikes the chosen enemy', () => {
    const s = board({ hand: [['coil-thorn-volley'], []], line: [['coil-sapling', 'coil-sapling', 'zz-grunt'], ['zz-ogre', 'zz-grunt']] });
    for (const p of saplings(s)) p.mods.push({ power: 2, health: 2, dur: 'perm' });
    play(s, 'coil-thorn-volley', [unit(s, 1, 'zz-ogre').iid]);
    pass(s);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(4);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(s.players[0].line.every((u) => u.dmg === 0)).toBe(true);
  });

  it('coil-transplant: destroy your Sapling and summon a 5|5 Thornwood (a token and a big summon)', () => {
    const s = board({ hand: [['coil-transplant'], []], line: [['coil-sapling'], []] });
    play(s, 'coil-transplant', [unit(s, 0, 'coil-sapling').iid]);
    pass(s);
    expect(s.players[0].line.map((u) => u.card)).toEqual(['coil-thornwood']);
    expect(st(s, unit(s, 0, 'coil-thornwood'))).toMatchObject({ power: 5, health: 5 });
    expect(s.players[0].seen.tokensSummoned).toBe(1);
    expect(s.players[0].seen.bigSummoned).toBe(1);
  });

  it('coil-cull-the-wounded: your strongest ally strikes every damaged enemy unit, not the undamaged ones', () => {
    const s = board({ hand: [['coil-cull-the-wounded'], []], line: [['zz-grunt', 'zz-ogre'], ['zz-grunt', 'zz-wall', 'zz-ogre']] });
    unit(s, 1, 'zz-grunt').dmg = 1;
    unit(s, 1, 'zz-wall').dmg = 1;
    play(s, 'coil-cull-the-wounded');
    pass(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-ogre']); // grunt 1+5, wall 1+5
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(0);
    expect(strikes(s).every((e) => e.card === 'zz-ogre')).toBe(true);
    expect(strikes(s).length).toBe(2);
  });

  it('coil-sow-the-rooftops: summon three Saplings, then every allied Sapling gets +1|+1', () => {
    const s = board({ hand: [['coil-sow-the-rooftops'], []], line: [['coil-sapling', 'zz-grunt'], []] });
    play(s, 'coil-sow-the-rooftops');
    pass(s);
    expect(saplings(s).length).toBe(4);
    for (const p of saplings(s)) expect(st(s, p)).toMatchObject({ power: 1, health: 2 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(s.players[0].seen.tokensSummoned).toBe(3);
  });
});
