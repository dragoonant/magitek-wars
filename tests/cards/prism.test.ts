// Behaviour tests for every Prismguard collectible card (heroes: both faces). Each one fails if the mechanic is removed,
// hits the wrong side or uses the wrong number.
import { describe, expect, it } from 'vitest';
import { act, applyAction, attack, board, pass, place, play, resolveCombat, st, unit } from '../helpers';
import type { GameState } from '../../src/engine/types';

/** The seat with priority casts zz-bolt (2 damage, Swift) on a unit and the other seat lets it resolve. */
function bolt(s: GameState, iid: string): void {
  if (!s.players[s.priority].hand.some((h) => h.card === 'zz-bolt')) pass(s);
  play(s, 'zz-bolt', [iid]);
  pass(s);
}
const resonant = (s: GameState): void => {
  s.players[0].ascended = ['prism-oren'];
};
/** Play through to the start of the next round. */
function nextRound(s: GameState): void {
  const r = s.round;
  let guard = 0;
  while (s.round === r && guard++ < 10) pass(s);
  expect(s.round).toBe(r + 1);
}
const BOLTS: [string[], string[]] = [['zz-bolt', 'zz-bolt', 'zz-bolt'], ['zz-bolt', 'zz-bolt', 'zz-bolt']];

describe('prism heroes', () => {
  it('prism-ysolde: base face is Plated and Dusk repairs every ally by 1, herself included', () => {
    const s = board({ hand: BOLTS, line: [['prism-ysolde', 'zz-ogre', 'zz-grunt'], ['zz-ogre']] });
    const y = unit(s, 0, 'prism-ysolde'), o = unit(s, 0, 'zz-ogre'), g = unit(s, 0, 'zz-grunt'), e = unit(s, 1, 'zz-ogre');
    y.dmg = 2; o.dmg = 3; g.dmg = 1; e.dmg = 3;
    expect(st(s, y)).toMatchObject({ power: 2, health: 4 });
    expect(st(s, o)).toMatchObject({ power: 5, health: 5 }); // no aura on the base face
    pass(s); pass(s);
    expect([y.dmg, o.dmg, g.dmg]).toEqual([1, 2, 0]);
    expect(e.dmg).toBe(3); // the enemy is not repaired
    bolt(s, y.iid);
    expect(y.dmg).toBe(2); // 1 + (2 - 1 Plated)
  });

  it('prism-ysolde: ascends on 2 ally survivals; herself Ward, other allies Ward and +1|+1, Plated, Dusk repair', () => {
    const s = board({ hand: BOLTS, line: [['prism-ysolde', 'zz-grunt'], ['zz-grunt']] });
    s.players[0].heroes = ['prism-ysolde'];
    s.players[0].seen.allySurvivals = 2;
    pass(s); pass(s);
    expect(s.players[0].ascended).toContain('prism-ysolde');
    const y = unit(s, 0, 'prism-ysolde'), g = unit(s, 0, 'zz-grunt');
    expect(y.ward).toBe(true);
    expect(g.ward).toBe(true);
    expect(unit(s, 1, 'zz-grunt').ward).toBe(false);
    expect(st(s, g)).toMatchObject({ power: 3, health: 3 });
    expect(st(s, y)).toMatchObject({ power: 3, health: 5 }); // the aura skips herself
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    y.ward = false;
    bolt(s, y.iid);
    expect(y.dmg).toBe(1); // Plated
    g.dmg = 2;
    nextRound(s);
    expect(y.dmg).toBe(0);
    expect(g.dmg).toBe(1); // Dusk repair by exactly 1
  });

  it('prism-oren: base Spotter blocks Aerial; surviving gives +1|+0 and nothing else; lethal damage gives nothing', () => {
    const s = board({ hand: BOLTS, line: [['zz-aerial'], ['prism-oren']] });
    attack(s, [unit(s, 0, 'zz-aerial')], [[unit(s, 1, 'prism-oren'), unit(s, 0, 'zz-aerial')]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20); // blocked: Oren has Spotter

    const t = board({ hand: BOLTS, line: [['prism-oren'], ['zz-ogre']] });
    const o = unit(t, 0, 'prism-oren');
    bolt(t, o.iid);
    expect(st(t, o)).toMatchObject({ power: 4, health: 7 });
    expect(unit(t, 1, 'zz-ogre').dmg).toBe(0); // base face deals no 2 damage
    o.dmg = 6;
    bolt(t, o.iid); // lethal: no survival
    expect(t.players[0].line.length).toBe(0);
    expect(unit(t, 1, 'zz-ogre').dmg).toBe(0);
  });

  it('prism-oren: ascended survival gives +1|+0 and 2 damage to the enemy with the highest power; Plated and Spotter', () => {
    const s = board({ hand: BOLTS, line: [['prism-oren'], ['zz-grunt', 'zz-ogre', 'zz-wall']] });
    s.players[0].ascended = ['prism-oren'];
    const o = unit(s, 0, 'prism-oren');
    expect(st(s, o).keywords).toEqual(expect.arrayContaining(['spotter', 'plated']));
    bolt(s, o.iid);
    expect(o.dmg).toBe(1); // Plated
    expect(st(s, o).power).toBe(6);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(2);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0);
    bolt(s, o.iid);
    expect(st(s, o).power).toBe(7);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(4);
    // lethal damage does not trigger it
    o.dmg = 7;
    bolt(s, o.iid);
    expect(s.players[0].line.length).toBe(0);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(4);
  });

  it('prism-oren: the third survival by any of your units ascends her and repairs the Spire by 4', () => {
    const s = board({ hand: BOLTS, line: [['prism-oren', 'zz-wall'], []] });
    s.players[0].heroes = ['prism-oren'];
    s.players[0].spire = 10;
    const o = unit(s, 0, 'prism-oren');
    const w = unit(s, 0, 'zz-wall');
    bolt(s, w.iid); bolt(s, o.iid);
    expect(s.players[0].ascended).not.toContain('prism-oren');
    expect(s.players[0].spire).toBe(10);
    bolt(s, w.iid);
    expect(s.players[0].ascended).toContain('prism-oren');
    expect(s.players[0].spire).toBe(14);
  });
});

describe('prism units', () => {
  it('prism-glasswarden: Plated takes 1 less damage', () => {
    const s = board({ hand: [['zz-bolt', 'zz-bolt'], []], line: [['prism-glasswarden', 'zz-wall'], []] });
    const u = unit(s, 0, 'prism-glasswarden');
    bolt(s, u.iid);
    expect(u.dmg).toBe(1);
    bolt(s, unit(s, 0, 'zz-wall').iid);
    expect(unit(s, 0, 'zz-wall').dmg).toBe(2); // control: unplated
  });

  it('prism-lampkeeper: Spotter blocks Aerial; Dusk repairs the ally with the lowest power by 1, nobody else', () => {
    const s = board({ line: [['zz-aerial'], ['prism-lampkeeper']] });
    attack(s, [unit(s, 0, 'zz-aerial')], [[unit(s, 1, 'prism-lampkeeper'), unit(s, 0, 'zz-aerial')]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20);

    const t = board({ line: [['zz-ogre', 'zz-wall', 'prism-lampkeeper', 'zz-grunt'], ['zz-wall']] });
    const o = unit(t, 0, 'zz-ogre'), w = unit(t, 0, 'zz-wall'), g = unit(t, 0, 'zz-grunt');
    o.dmg = 3; w.dmg = 3; g.dmg = 1;
    unit(t, 1, 'zz-wall').dmg = 3;
    pass(t); pass(t);
    expect(w.dmg).toBe(2); // the wall has power 0: the lowest
    expect(o.dmg).toBe(3);
    expect(g.dmg).toBe(1);
    expect(unit(t, 1, 'zz-wall').dmg).toBe(3);
    // power 1 (itself) is the lowest once the wall is gone; a damaged strong ally is still ignored
    const u = board({ line: [['prism-lampkeeper', 'zz-ogre'], []] });
    unit(u, 0, 'zz-ogre').dmg = 3;
    unit(u, 0, 'prism-lampkeeper').dmg = 1;
    pass(u); pass(u);
    expect(unit(u, 0, 'prism-lampkeeper').dmg).toBe(0);
    expect(unit(u, 0, 'zz-ogre').dmg).toBe(3);
  });

  it('prism-facet-initiate: Deploy gives the chosen ally +0|+1 and nobody else', () => {
    const s = board({ hand: [['prism-facet-initiate'], []], line: [['zz-wall', 'zz-grunt'], ['zz-grunt']] });
    play(s, 'prism-facet-initiate', [unit(s, 0, 'zz-wall').iid]);
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 7 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'prism-facet-initiate'))).toMatchObject({ power: 1, health: 2 });
    const t = board({ hand: [['prism-facet-initiate'], []] });
    play(t, 'prism-facet-initiate'); // no ally: still plays
    expect(t.players[0].line.length).toBe(1);
  });

  it('prism-tierguard: Ward negates the first damage only; Resonant gives +1|+1', () => {
    const s = board({ hand: BOLTS, line: [['prism-tierguard', 'prism-oren'], []] });
    const u = unit(s, 0, 'prism-tierguard');
    expect(u.ward).toBe(true);
    bolt(s, u.iid);
    expect(u.dmg).toBe(0);
    expect(u.ward).toBe(false);
    expect(st(s, u)).toMatchObject({ power: 2, health: 2 });
    resonant(s);
    expect(st(s, u)).toMatchObject({ power: 3, health: 3 });
    bolt(s, u.iid);
    expect(u.dmg).toBe(2); // Ward is not renewed
  });

  it('prism-bracewright: Dueler forces a block; surviving damage repairs it by 1; lethal damage is not undone', () => {
    const s = board({ hand: BOLTS, line: [['prism-bracewright'], ['zz-wall', 'zz-filler']] });
    const u = unit(s, 0, 'prism-bracewright');
    act(s, { type: 'declare', unit: u.iid, duel: unit(s, 1, 'zz-filler').iid });
    act(s, { type: 'attack' });
    if (s.phase === 'block') act(s, { type: 'blocks' });
    resolveCombat(s);
    expect(s.players[1].line.map((x) => x.card)).toEqual(['zz-wall']); // the filler was forced to block and died
    expect(s.players[1].spire).toBe(20);
    expect(u.dmg).toBe(0); // took 1, repaired 1

    const t = board({ hand: BOLTS, line: [['prism-bracewright'], []] });
    const b = unit(t, 0, 'prism-bracewright');
    bolt(t, b.iid);
    expect(b.dmg).toBe(1); // 2 damage, 1 repaired
    bolt(t, b.iid); // 1 + 2 = 3 >= 3: destroyed, the survive repair does not save it
    expect(t.players[0].line.length).toBe(0);
  });

  it('prism-pane-mender: Deploy repairs the chosen ally by 4 and nobody else', () => {
    const s = board({ hand: [['prism-pane-mender'], []], line: [['zz-wall', 'zz-ogre'], []] });
    const w = unit(s, 0, 'zz-wall'), o = unit(s, 0, 'zz-ogre');
    w.dmg = 5; o.dmg = 3;
    play(s, 'prism-pane-mender', [w.iid]);
    expect(w.dmg).toBe(1);
    expect(o.dmg).toBe(3);
    const t = board({ hand: [['prism-pane-mender'], []], line: [['zz-wall'], []] });
    unit(t, 0, 'zz-wall').dmg = 3;
    play(t, 'prism-pane-mender', [unit(t, 0, 'zz-wall').iid]);
    expect(unit(t, 0, 'zz-wall').dmg).toBe(0); // never below 0
  });

  it('prism-crystal-bulwark: Plated takes 1 less damage', () => {
    const s = board({ hand: [['zz-bolt', 'zz-bolt'], []], line: [['prism-crystal-bulwark', 'zz-ogre'], []] });
    const u = unit(s, 0, 'prism-crystal-bulwark');
    bolt(s, u.iid);
    expect(u.dmg).toBe(1);
    bolt(s, unit(s, 0, 'zz-ogre').iid);
    expect(unit(s, 0, 'zz-ogre').dmg).toBe(2);
  });

  it('prism-chorus-warden: other allies get +0|+1 (not the enemy, not itself); Resonant gives itself +1|+1', () => {
    const s = board({ line: [['prism-chorus-warden', 'zz-grunt', 'prism-oren'], ['zz-grunt']] });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 3 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'prism-chorus-warden'))).toMatchObject({ power: 2, health: 3 });
    resonant(s);
    expect(st(s, unit(s, 0, 'prism-chorus-warden'))).toMatchObject({ power: 3, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 3 });
  });

  it('prism-sentinel-lens: Spotter blocks Aerial; Deploy gives the chosen ally Ward and nobody else', () => {
    const s = board({ hand: [['prism-sentinel-lens', 'zz-bolt'], []], line: [['zz-grunt', 'zz-wall'], []] });
    const g = unit(s, 0, 'zz-grunt');
    expect(g.ward).toBe(false);
    play(s, 'prism-sentinel-lens', [g.iid]);
    expect(g.ward).toBe(true);
    expect(unit(s, 0, 'zz-wall').ward).toBe(false);
    expect(unit(s, 0, 'prism-sentinel-lens').ward).toBe(false);
    pass(s);
    bolt(s, g.iid);
    expect(g.dmg).toBe(0);
    expect(g.ward).toBe(false);

    const t = board({ line: [['zz-aerial'], ['prism-sentinel-lens']] });
    attack(t, [unit(t, 0, 'zz-aerial')], [[unit(t, 1, 'prism-sentinel-lens'), unit(t, 0, 'zz-aerial')]]);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20);
  });

  it('prism-aegis-colossus: Dueler forces a block, and Plated reduces what it takes', () => {
    const s = board({ line: [['prism-aegis-colossus'], ['zz-wall', 'zz-grunt']] });
    const a = unit(s, 0, 'prism-aegis-colossus');
    const g = unit(s, 1, 'zz-grunt');
    act(s, { type: 'declare', unit: a.iid, duel: g.iid });
    act(s, { type: 'attack' });
    if (s.phase === 'block') act(s, { type: 'blocks' });
    resolveCombat(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
    expect(a.dmg).toBe(1); // grunt power 2, Plated -1
    expect(s.players[1].spire).toBe(20);
  });

  it('prism-vault-captain: other allies have +1|+0 (not enemies), and it is Plated', () => {
    const s = board({ hand: [['zz-bolt'], []], line: [['prism-vault-captain', 'zz-grunt'], ['zz-grunt']] });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 2 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const c = unit(s, 0, 'prism-vault-captain');
    expect(st(s, c)).toMatchObject({ power: 2, health: 4 });
    bolt(s, c.iid);
    expect(c.dmg).toBe(1);
  });

  it('prism-spire-keeper: Plated; Dusk repairs your Spire by 2 and not the enemy Spire', () => {
    const s = board({ hand: [['zz-bolt'], []], line: [['prism-spire-keeper'], []] });
    s.players[0].spire = 10;
    s.players[1].spire = 10;
    const u = unit(s, 0, 'prism-spire-keeper');
    bolt(s, u.iid);
    expect(u.dmg).toBe(1);
    pass(s); pass(s);
    expect(s.players[0].spire).toBe(12);
    expect(s.players[1].spire).toBe(10);
  });

  it('prism-lightwall-matron: Spotter; other allies have +1|+1, enemies and itself do not', () => {
    const s = board({ line: [['prism-lightwall-matron', 'zz-grunt'], ['zz-grunt']] });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'prism-lightwall-matron'))).toMatchObject({ power: 3, health: 6 });
    const t = board({ line: [['zz-aerial'], ['prism-lightwall-matron']] });
    attack(t, [unit(t, 0, 'zz-aerial')], [[unit(t, 1, 'prism-lightwall-matron'), unit(t, 0, 'zz-aerial')]]);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20);
  });

  it('prism-tier-sovereign: Plated; Deploy gives every other ally Ward, not itself and not the enemy', () => {
    const s = board({ hand: [['prism-tier-sovereign', 'zz-bolt'], []], line: [['zz-grunt', 'zz-wall'], ['zz-grunt']] });
    play(s, 'prism-tier-sovereign');
    expect(unit(s, 0, 'zz-grunt').ward).toBe(true);
    expect(unit(s, 0, 'zz-wall').ward).toBe(true);
    expect(unit(s, 0, 'prism-tier-sovereign').ward).toBe(false);
    expect(unit(s, 1, 'zz-grunt').ward).toBe(false);
    bolt(s, unit(s, 0, 'prism-tier-sovereign').iid);
    expect(unit(s, 0, 'prism-tier-sovereign').dmg).toBe(1);
  });
});

describe('prism glyphs', () => {
  it('prism-hold-the-line: the chosen ally is Plated this round only', () => {
    const s = board({ hand: [['prism-hold-the-line', 'zz-bolt'], ['zz-bolt']], line: [['zz-wall', 'zz-grunt'], []] });
    const w = unit(s, 0, 'zz-wall'), g = unit(s, 0, 'zz-grunt');
    play(s, 'prism-hold-the-line', [w.iid]);
    expect(st(s, w).keywords).toContain('plated');
    expect(st(s, g).keywords).not.toContain('plated');
    bolt(s, w.iid);
    expect(w.dmg).toBe(1);
    nextRound(s);
    expect(st(s, w).keywords).not.toContain('plated');
    bolt(s, w.iid);
    expect(w.dmg).toBe(3);
  });

  it('prism-mirror-ward: gives the chosen ally Ward until it is used, and nobody else', () => {
    const s = board({ hand: [['prism-mirror-ward', 'zz-bolt'], ['zz-bolt']], line: [['zz-wall', 'zz-grunt'], []] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'prism-mirror-ward', [g.iid]);
    expect(g.ward).toBe(true);
    expect(unit(s, 0, 'zz-wall').ward).toBe(false);
    nextRound(s);
    expect(g.ward).toBe(true); // not a this-round effect
    bolt(s, g.iid);
    expect(g.dmg).toBe(0);
    expect(g.ward).toBe(false);
  });

  it('prism-choir-of-facets: +1|+1 to every ally this round only; Resonant also repairs every ally by 2', () => {
    const s = board({ hand: [['prism-choir-of-facets'], []], line: [['zz-ogre', 'zz-grunt'], ['zz-ogre']] });
    const o = unit(s, 0, 'zz-ogre'), g = unit(s, 0, 'zz-grunt');
    o.dmg = 3;
    play(s, 'prism-choir-of-facets');
    g.dmg = 2; // lethal on the 2 health it has without the buff
    expect(st(s, o)).toMatchObject({ power: 6, health: 6 });
    expect(st(s, g)).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 1, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
    expect([o.dmg, g.dmg]).toEqual([3, 2]); // no repair without Resonant
    nextRound(s);
    expect(st(s, o)).toMatchObject({ power: 5, health: 5 });
    expect(s.players[0].line.length).toBe(2); // R-S4: the damaged grunt is kept at 1 health
    expect(st(s, g)).toMatchObject({ power: 2, health: 2, hp: 1 });

    const r = board({ hand: [['prism-choir-of-facets'], []], line: [['zz-ogre', 'zz-grunt', 'prism-oren'], ['zz-ogre']] });
    resonant(r);
    const o2 = unit(r, 0, 'zz-ogre'), g2 = unit(r, 0, 'zz-grunt');
    o2.dmg = 3; g2.dmg = 1; unit(r, 1, 'zz-ogre').dmg = 3;
    play(r, 'prism-choir-of-facets');
    expect([o2.dmg, g2.dmg]).toEqual([1, 0]);
    expect(unit(r, 1, 'zz-ogre').dmg).toBe(3);
  });

  it('prism-patch-the-pane: repairs the chosen ally by 4 and nobody else', () => {
    const s = board({ hand: [['prism-patch-the-pane'], []], line: [['zz-wall', 'zz-ogre'], []] });
    const w = unit(s, 0, 'zz-wall'), o = unit(s, 0, 'zz-ogre');
    w.dmg = 5; o.dmg = 3;
    play(s, 'prism-patch-the-pane', [w.iid]);
    pass(s);
    expect(w.dmg).toBe(1);
    expect(o.dmg).toBe(3);
    const t = board({ hand: [['prism-patch-the-pane'], []], line: [['zz-wall'], []] });
    unit(t, 0, 'zz-wall').dmg = 2;
    play(t, 'prism-patch-the-pane', [unit(t, 0, 'zz-wall').iid]);
    pass(t);
    expect(unit(t, 0, 'zz-wall').dmg).toBe(0);
  });

  it('prism-call-out: the ally gets Dueler (forces a block) and +0|+2 this round only', () => {
    const s = board({ hand: [['prism-call-out'], []], line: [['zz-grunt', 'zz-ogre'], ['zz-wall', 'zz-ogre']] });
    const g = unit(s, 0, 'zz-grunt');
    expect(applyAction(s, { type: 'declare', unit: g.iid, duel: unit(s, 1, 'zz-wall').iid }).ok).toBe(false);
    play(s, 'prism-call-out', [g.iid]);
    pass(s);
    pass(s); // seat 1 yields, seat 0 holds priority again
    expect(st(s, g)).toMatchObject({ power: 2, health: 4 });
    expect(st(s, unit(s, 0, 'zz-ogre')).keywords).not.toContain('dueler');
    expect(st(s, unit(s, 0, 'zz-ogre')).health).toBe(5);
    act(s, { type: 'declare', unit: g.iid, duel: unit(s, 1, 'zz-wall').iid });
    act(s, { type: 'attack' });
    if (s.phase === 'block') act(s, { type: 'blocks' });
    resolveCombat(s);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(2); // forced to block the grunt
    expect(s.players[1].spire).toBe(20);
    nextRound(s);
    expect(st(s, g).keywords).not.toContain('dueler');
    expect(st(s, g)).toMatchObject({ power: 2, health: 2 });
  });

  it('prism-lightwall-oath: the chosen ally gets a lasting +0|+2 and Plated', () => {
    const s = board({ hand: [['prism-lightwall-oath', 'zz-bolt', 'zz-bolt'], []], line: [['zz-grunt', 'zz-wall'], []] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'prism-lightwall-oath', [g.iid]);
    pass(s);
    expect(st(s, g)).toMatchObject({ power: 2, health: 4 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 6 });
    pass(s); // seat 1 yields, so seat 0 holds priority again
    bolt(s, g.iid);
    expect(g.dmg).toBe(1);
    expect(st(s, unit(s, 0, 'zz-wall')).keywords).not.toContain('plated');
    nextRound(s);
    expect(st(s, g)).toMatchObject({ health: 4 });
    expect(st(s, g).keywords).toContain('plated');
  });

  it('prism-spire-mantle: repairs your Spire by 5 (capped at 20) and gives every ally Ward, not the enemy', () => {
    const s = board({ hand: [['prism-spire-mantle'], []], line: [['zz-grunt', 'zz-wall'], ['zz-grunt']] });
    s.players[0].spire = 10;
    s.players[1].spire = 10;
    play(s, 'prism-spire-mantle');
    pass(s);
    expect(s.players[0].spire).toBe(15);
    expect(s.players[1].spire).toBe(10);
    expect(s.players[0].line.every((u) => u.ward)).toBe(true);
    expect(unit(s, 1, 'zz-grunt').ward).toBe(false);
    const t = board({ hand: [['prism-spire-mantle'], []], line: [['zz-grunt'], []] });
    t.players[0].spire = 18;
    play(t, 'prism-spire-mantle');
    pass(t);
    expect(t.players[0].spire).toBe(20);
  });

  it('prism-tier-rally: every ally gets a lasting +1|+1, the enemy does not', () => {
    const s = board({ hand: [['prism-tier-rally'], []], line: [['zz-grunt', 'zz-wall'], ['zz-grunt']] });
    play(s, 'prism-tier-rally');
    pass(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 1, health: 7 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
  });

  it('prism-crystal-dawn: +2|+2 (lasting), full repair of every ally and Spire by 3, not the enemy', () => {
    const s = board({ hand: [['prism-crystal-dawn'], []], line: [['zz-ogre', 'zz-grunt'], ['zz-ogre']] });
    const o = unit(s, 0, 'zz-ogre'), g = unit(s, 0, 'zz-grunt');
    o.dmg = 4; g.dmg = 1; unit(s, 1, 'zz-ogre').dmg = 4;
    s.players[0].spire = 10;
    s.players[1].spire = 10;
    play(s, 'prism-crystal-dawn');
    pass(s);
    expect(st(s, o)).toMatchObject({ power: 7, health: 7 });
    expect(st(s, g)).toMatchObject({ power: 4, health: 4 });
    expect([o.dmg, g.dmg]).toEqual([0, 0]);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(4);
    expect(st(s, unit(s, 1, 'zz-ogre')).power).toBe(5);
    expect(s.players[0].spire).toBe(13);
    expect(s.players[1].spire).toBe(10);
    nextRound(s);
    expect(st(s, o)).toMatchObject({ power: 7, health: 7 });
  });
});

/** Try to play a hand card with these targets; returns whether the engine accepted it. */
function tryPlay(s: GameState, card: string, targets: string[]): boolean {
  const hc = s.players[s.priority].hand.find((h) => h.card === card);
  if (!hc) throw new Error(`${card} not in hand`);
  return applyAction(s, { type: 'play', iid: hc.iid, targets }).ok;
}

describe('prism heroes (First Light additions)', () => {
  it('prism-tamsin: Dusk gives every ally with 2 or less power +0|+1, herself included; stronger allies and enemies get nothing', () => {
    const s = board({ line: [['prism-tamsin', 'zz-grunt', 'zz-ogre'], ['zz-grunt']] });
    s.players[0].heroes = ['prism-tamsin'];
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'prism-tamsin'))).toMatchObject({ power: 2, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 3 });
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(s.players[0].seen.buffsGiven).toBe(2);
    expect(s.players[0].ascended).not.toContain('prism-tamsin');
    expect(st(s, unit(s, 0, 'prism-tamsin')).keywords).not.toContain('plated');
  });

  it('prism-tamsin: the 10th buff ascends her; Ascend fills the Line with 1|1 Tier Recruits; Plated 3|5 face', () => {
    const s = board({ line: [['prism-tamsin', 'zz-grunt'], ['zz-grunt']] });
    s.players[0].heroes = ['prism-tamsin'];
    s.players[0].seen.buffsGiven = 8;
    pass(s); pass(s); // Dusk buffs two allies: 10
    expect(s.players[0].ascended).toContain('prism-tamsin');
    const line = s.players[0].line;
    expect(line.length).toBe(6);
    expect(line.filter((u) => u.card === 'prism-tier-recruit').length).toBe(4);
    expect(st(s, line[5])).toMatchObject({ power: 1, health: 1 });
    const t = unit(s, 0, 'prism-tamsin');
    expect(st(s, t)).toMatchObject({ power: 3, health: 6 }); // 3|5 face plus the base Dusk's +0|+1
    expect(st(s, t).keywords).toContain('plated');
    expect(s.players[1].line.length).toBe(1);
  });

  it('prism-tamsin: ascended Dusk gives +1|+1 to allies with 2 or less power, and stops once they reach 3', () => {
    const s = board({ line: [['prism-tamsin', 'zz-grunt', 'zz-ogre'], ['zz-grunt']] });
    s.players[0].ascended = ['prism-tamsin'];
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
    expect(st(s, unit(s, 0, 'prism-tamsin'))).toMatchObject({ power: 3, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
  });

  it('prism-orrin: Deploy deals 1 to the enemy, 3 in all to an Aerial one (an enemy destroyed counts); Spotter blocks Aerial', () => {
    const s = board({ hand: [['prism-orrin'], []], line: [[], ['zz-aerial', 'zz-ogre']] });
    play(s, 'prism-orrin', [unit(s, 1, 'zz-aerial').iid]);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-ogre']);
    const o = unit(s, 0, 'prism-orrin');
    expect(s.players[0].seen.enemiesDied).toBe(1);
    expect(st(s, o)).toMatchObject({ power: 2, health: 4 }); // the base face does not grow

    const t = board({ hand: [['prism-orrin'], []], line: [[], ['zz-ogre']] });
    play(t, 'prism-orrin', [unit(t, 1, 'zz-ogre').iid]);
    expect(unit(t, 1, 'zz-ogre').dmg).toBe(1);

    const u = board({ line: [['zz-aerial'], ['prism-orrin']] });
    attack(u, [unit(u, 0, 'zz-aerial')], [[unit(u, 1, 'prism-orrin'), unit(u, 0, 'zz-aerial')]]);
    resolveCombat(u);
    expect(u.players[1].spire).toBe(20);
    expect(unit(u, 0, 'zz-aerial').dmg).toBe(2);
  });

  it('prism-orrin: the 5th enemy unit destroyed ascends him; Ascend deals 2 to every enemy and 2 more to Aerial ones, and he grows', () => {
    const s = board({ line: [['prism-orrin'], ['zz-grunt', 'zz-aerial', 'zz-wall']] });
    s.players[0].heroes = ['prism-orrin'];
    const o = unit(s, 0, 'prism-orrin');
    s.players[0].seen.enemiesDied = 4;
    attack(s, [o], [[unit(s, 1, 'zz-grunt'), o]]);
    resolveCombat(s);
    expect(s.players[0].ascended).toContain('prism-orrin');
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(2);
    expect(o.dmg).toBe(0);
    expect(st(s, o)).toMatchObject({ power: 5, health: 6 }); // 4|6 and +1|+0 for the Aerial unit destroyed after he ascended
  });

  it('prism-orrin: ascended, every enemy unit destroyed gives him +1|+0', () => {
    const s = board({ hand: BOLTS, line: [['prism-orrin'], ['zz-grunt', 'zz-grunt']] });
    s.players[0].ascended = ['prism-orrin'];
    const o = unit(s, 0, 'prism-orrin');
    expect(st(s, o)).toMatchObject({ power: 4, health: 6 });
    bolt(s, unit(s, 1, 'zz-grunt').iid);
    expect(st(s, o).power).toBe(5);
    bolt(s, unit(s, 1, 'zz-grunt').iid);
    expect(st(s, o).power).toBe(6);
    expect(st(s, o).keywords).toContain('spotter');
  });
});

describe('prism units (First Light additions)', () => {
  it('prism-shieldline-cadet: another warden that is summoned gets +0|+1; a construct does not', () => {
    const s = board({ hand: [['prism-glasswarden', 'prism-crystal-bulwark'], []], line: [['prism-shieldline-cadet'], []] });
    play(s, 'prism-glasswarden');
    pass(s);
    play(s, 'prism-crystal-bulwark');
    expect(st(s, unit(s, 0, 'prism-glasswarden'))).toMatchObject({ power: 1, health: 4 });
    expect(st(s, unit(s, 0, 'prism-crystal-bulwark'))).toMatchObject({ power: 2, health: 4 });
    expect(st(s, unit(s, 0, 'prism-shieldline-cadet'))).toMatchObject({ power: 1, health: 1 });
    expect(s.players[0].seen.buffsGiven).toBe(1);
  });

  it('prism-glint-scout: Deploy deals 1 to an enemy Aerial unit only; Spotter blocks Aerial', () => {
    const s = board({ hand: [['prism-glint-scout'], []], line: [[], ['zz-grunt', 'zz-aerial']] });
    expect(tryPlay(s, 'prism-glint-scout', [unit(s, 1, 'zz-grunt').iid])).toBe(false);
    play(s, 'prism-glint-scout', [unit(s, 1, 'zz-aerial').iid]);
    expect(unit(s, 1, 'zz-aerial').dmg).toBe(1);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);

    const t = board({ line: [['zz-aerial'], ['prism-glint-scout']] });
    attack(t, [unit(t, 0, 'zz-aerial')], [[unit(t, 1, 'prism-glint-scout'), unit(t, 0, 'zz-aerial')]]);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20);
  });

  it('prism-rank-drummer: Deploy gives every other ally +0|+1 only with 3 or more other allies', () => {
    const s = board({ hand: [['prism-rank-drummer'], []], line: [['zz-grunt', 'zz-grunt', 'zz-wall'], ['zz-grunt']] });
    play(s, 'prism-rank-drummer');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 3 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 7 });
    expect(st(s, unit(s, 0, 'prism-rank-drummer'))).toMatchObject({ power: 1, health: 1 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const t = board({ hand: [['prism-rank-drummer'], []], line: [['zz-grunt', 'zz-wall'], []] });
    play(t, 'prism-rank-drummer');
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('prism-lens-fitter: Spotter itself; Deploy gives the chosen ally a lasting Spotter', () => {
    const s = board({ hand: [['prism-lens-fitter'], []], line: [['zz-ogre', 'zz-grunt'], []] });
    play(s, 'prism-lens-fitter', [unit(s, 0, 'zz-ogre').iid]);
    expect(st(s, unit(s, 0, 'zz-ogre')).keywords).toContain('spotter');
    expect(st(s, unit(s, 0, 'zz-grunt')).keywords).not.toContain('spotter');
    expect(st(s, unit(s, 0, 'prism-lens-fitter')).keywords).toContain('spotter');
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-ogre')).keywords).toContain('spotter');
  });

  it('prism-shield-sergeant: Assault gives every attacker with 2 or less power +1|+0 this round', () => {
    const s = board({ line: [['prism-shield-sergeant', 'zz-grunt', 'zz-ogre', 'zz-wall'], []] });
    attack(s, [unit(s, 0, 'prism-shield-sergeant'), unit(s, 0, 'zz-grunt'), unit(s, 0, 'zz-ogre')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 3 - 3 - 5);
    expect(st(s, unit(s, 0, 'zz-wall')).power).toBe(0); // not attacking
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt')).power).toBe(2);
  });

  it('prism-flak-tripod: Spotter blocks Aerial; when it strikes it deals 1 to every enemy Aerial unit', () => {
    const s = board({ line: [['zz-aerial', 'zz-aerial', 'zz-grunt'], ['prism-flak-tripod']] });
    const a0 = unit(s, 0, 'zz-aerial', 0), a1 = unit(s, 0, 'zz-aerial', 1);
    attack(s, [a0], [[unit(s, 1, 'prism-flak-tripod'), a0]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20);
    expect(s.players[0].line.map((u) => u.card)).toEqual(['zz-aerial', 'zz-grunt']); // 2 strike + 1
    expect(a1.dmg).toBe(1);
    expect(unit(s, 0, 'zz-grunt').dmg).toBe(0);
  });

  it('prism-range-warden: Deploy makes an allied Spotter strike an enemy Aerial unit, one way', () => {
    const s = board({ hand: [['prism-range-warden'], []], line: [['zz-spotter', 'zz-grunt'], ['zz-aerial', 'zz-grunt']] });
    const sp = unit(s, 0, 'zz-spotter');
    expect(tryPlay(s, 'prism-range-warden', [unit(s, 0, 'zz-grunt').iid, unit(s, 1, 'zz-aerial').iid])).toBe(false);
    play(s, 'prism-range-warden', [sp.iid, unit(s, 1, 'zz-aerial').iid]);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-grunt']);
    expect(sp.dmg).toBe(0);
    expect(sp.seen.kills).toBe(1);
    expect(st(s, unit(s, 0, 'prism-range-warden'))).toMatchObject({ power: 2, health: 4 });
  });

  it('prism-rampart-herald: Deploy gives the chosen ally +1|+1; Resonant also gives it Ward', () => {
    const s = board({ hand: [['prism-rampart-herald'], []], line: [['zz-grunt', 'zz-wall'], []] });
    play(s, 'prism-rampart-herald', [unit(s, 0, 'zz-grunt').iid]);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 6 });
    expect(unit(s, 0, 'zz-grunt').ward).toBe(false);
    const r = board({ hand: [['prism-rampart-herald'], []], line: [['zz-grunt', 'prism-oren'], []] });
    resonant(r);
    play(r, 'prism-rampart-herald', [unit(r, 0, 'zz-grunt').iid]);
    expect(st(r, unit(r, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(unit(r, 0, 'zz-grunt').ward).toBe(true);
    expect(unit(r, 0, 'prism-oren').ward).toBe(false);
  });

  it('prism-tier-pikeman: with 4 or more allies it has +2|+1 and Plated', () => {
    const s = board({ line: [['prism-tier-pikeman', 'zz-grunt', 'zz-grunt'], ['zz-grunt']] });
    const k = unit(s, 0, 'prism-tier-pikeman');
    expect(st(s, k)).toMatchObject({ power: 2, health: 2 });
    expect(st(s, k).keywords).not.toContain('plated');
    place(s, 0, 'zz-wall');
    expect(st(s, k)).toMatchObject({ power: 4, health: 3 });
    expect(st(s, k).keywords).toContain('plated');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('prism-lens-battery: Spotter; other allied Spotters have +1|+1, others and enemies do not', () => {
    const s = board({ line: [['prism-lens-battery', 'zz-spotter', 'zz-grunt'], ['zz-spotter']] });
    expect(st(s, unit(s, 0, 'zz-spotter'))).toMatchObject({ power: 4, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 1, 'zz-spotter'))).toMatchObject({ power: 3, health: 3 });
    const b = unit(s, 0, 'prism-lens-battery');
    expect(st(s, b)).toMatchObject({ power: 2, health: 5 });
    expect(st(s, b).keywords).toContain('spotter');
  });

  it('prism-cohort-drillmaster: Deploy gives the ally +1|+0 per other ally, at most 4', () => {
    const s = board({ hand: [['prism-cohort-drillmaster'], []], line: [['zz-grunt', 'zz-wall', 'zz-grunt'], []] });
    play(s, 'prism-cohort-drillmaster', [unit(s, 0, 'zz-wall').iid]);
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 3, health: 6 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const t = board({ hand: [['prism-cohort-drillmaster'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    play(t, 'prism-cohort-drillmaster', [unit(t, 0, 'zz-grunt').iid]);
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 6, health: 2 });
  });

  it('prism-skylens-bastion: Spotter, Plated; Dusk deals 2 to every enemy Aerial unit, not to others or allies', () => {
    const s = board({ hand: BOLTS, line: [['prism-skylens-bastion', 'zz-aerial'], ['zz-aerial', 'zz-grunt']] });
    const b = unit(s, 0, 'prism-skylens-bastion');
    bolt(s, b.iid);
    expect(b.dmg).toBe(1);
    expect(st(s, b).keywords).toContain('spotter');
    nextRound(s);
    expect(unit(s, 1, 'zz-aerial').dmg).toBe(2);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 0, 'zz-aerial').dmg).toBe(0);
  });

  it('prism-muster-bell: Deploy summons one 1|1 Tier Recruit plus one per enemy unit, at most 4', () => {
    const s = board({ hand: [['prism-muster-bell'], []], line: [[], ['zz-grunt', 'zz-grunt']] });
    play(s, 'prism-muster-bell');
    expect(s.players[0].line.filter((u) => u.card === 'prism-tier-recruit').length).toBe(3);
    expect(st(s, unit(s, 0, 'prism-tier-recruit'))).toMatchObject({ power: 1, health: 1 });
    expect(s.players[1].line.length).toBe(2);
    const t = board({ hand: [['prism-muster-bell'], []], line: [[], ['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt']] });
    play(t, 'prism-muster-bell');
    expect(t.players[0].line.filter((u) => u.card === 'prism-tier-recruit').length).toBe(4);
  });

  it('prism-gilded-phalanx: Plated; Deploy gives every other ally +1|+1, or +2|+2 when Resonant', () => {
    const s = board({ hand: [['prism-gilded-phalanx', 'zz-bolt'], []], line: [['zz-grunt'], ['zz-grunt']] });
    play(s, 'prism-gilded-phalanx');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const p = unit(s, 0, 'prism-gilded-phalanx');
    expect(st(s, p)).toMatchObject({ power: 5, health: 7 });
    bolt(s, p.iid);
    expect(p.dmg).toBe(1);
    const r = board({ hand: [['prism-gilded-phalanx'], []], line: [['zz-grunt', 'prism-oren'], []] });
    resonant(r);
    play(r, 'prism-gilded-phalanx');
    expect(st(r, unit(r, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 4 });
  });
});

describe('prism glyphs (First Light additions)', () => {
  it('prism-steady-aim: an allied Spotter only gets +2|+0 this round', () => {
    const s = board({ hand: [['prism-steady-aim'], []], line: [['zz-spotter', 'zz-grunt'], []] });
    expect(tryPlay(s, 'prism-steady-aim', [unit(s, 0, 'zz-grunt').iid])).toBe(false);
    play(s, 'prism-steady-aim', [unit(s, 0, 'zz-spotter').iid]);
    expect(st(s, unit(s, 0, 'zz-spotter'))).toMatchObject({ power: 5, health: 3 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-spotter'))).toMatchObject({ power: 3, health: 3 });
  });

  it('prism-lock-shields: every ally with 2 or less power gets +0|+2 this round', () => {
    const s = board({ hand: [['prism-lock-shields'], []], line: [['zz-grunt', 'zz-ogre', 'zz-wall'], ['zz-grunt']] });
    play(s, 'prism-lock-shields');
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 4 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 8 });
    expect(st(s, unit(s, 0, 'zz-ogre'))).toMatchObject({ power: 5, health: 5 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('prism-flak-burst: 1 to every enemy Aerial unit, 2 when Resonant; others untouched', () => {
    const s = board({ hand: [['prism-flak-burst'], []], line: [['zz-aerial'], ['zz-aerial', 'zz-grunt']] });
    play(s, 'prism-flak-burst');
    expect(unit(s, 1, 'zz-aerial').dmg).toBe(1);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(0);
    expect(unit(s, 0, 'zz-aerial').dmg).toBe(0);
    const r = board({ hand: [['prism-flak-burst'], []], line: [['prism-oren'], ['zz-aerial']] });
    resonant(r);
    play(r, 'prism-flak-burst');
    expect(unit(r, 1, 'zz-aerial').dmg).toBe(2);
  });

  it('prism-covering-fire: an allied Spotter strikes an enemy that is fighting, one way', () => {
    const s = board({ hand: [[], ['prism-covering-fire']], line: [['zz-grunt', 'zz-ogre'], ['zz-spotter', 'zz-wall']] });
    const g = unit(s, 0, 'zz-grunt');
    attack(s, [g], [[unit(s, 1, 'zz-wall'), g]]);
    pass(s); // the attacker yields the combat window
    const sp = unit(s, 1, 'zz-spotter');
    expect(tryPlay(s, 'prism-covering-fire', [sp.iid, unit(s, 0, 'zz-ogre').iid])).toBe(false); // not in combat
    play(s, 'prism-covering-fire', [sp.iid, g.iid]);
    pass(s);
    resolveCombat(s);
    expect(s.players[0].line.map((u) => u.card)).toEqual(['zz-ogre']);
    expect(sp.dmg).toBe(0);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(0);
  });

  it('prism-shoulder-to-shoulder: +2|+2 this round, or lasting with 4 or more allies', () => {
    const s = board({ hand: [['prism-shoulder-to-shoulder'], []], line: [['zz-grunt', 'zz-wall'], []] });
    play(s, 'prism-shoulder-to-shoulder', [unit(s, 0, 'zz-grunt').iid]);
    pass(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 4 });
    expect(st(s, unit(s, 0, 'zz-wall'))).toMatchObject({ power: 0, health: 6 });
    nextRound(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    const t = board({ hand: [['prism-shoulder-to-shoulder'], []], line: [['zz-grunt', 'zz-wall', 'zz-wall', 'zz-wall'], []] });
    play(t, 'prism-shoulder-to-shoulder', [unit(t, 0, 'zz-grunt').iid]);
    pass(t);
    nextRound(t);
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 4 });
  });

  it('prism-field-glazing: damaged allies get +1|+1, then every ally is repaired by 2', () => {
    const s = board({ hand: [['prism-field-glazing'], []], line: [['zz-grunt', 'zz-ogre', 'zz-wall'], ['zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt'), o = unit(s, 0, 'zz-ogre'), w = unit(s, 0, 'zz-wall'), e = unit(s, 1, 'zz-grunt');
    g.dmg = 1; w.dmg = 3; e.dmg = 1;
    play(s, 'prism-field-glazing');
    pass(s);
    expect(st(s, g)).toMatchObject({ power: 3, health: 3 });
    expect(st(s, o)).toMatchObject({ power: 5, health: 5 });
    expect(st(s, w)).toMatchObject({ power: 1, health: 7 });
    expect([g.dmg, w.dmg, e.dmg]).toEqual([0, 1, 1]);
    expect(st(s, e)).toMatchObject({ power: 2, health: 2 });
  });

  it('prism-cut-the-sky: 3 to every enemy Aerial unit and 1 to every other enemy unit; allies untouched', () => {
    const s = board({ hand: [['prism-cut-the-sky'], []], line: [['zz-aerial'], ['zz-aerial', 'zz-grunt', 'zz-ogre']] });
    play(s, 'prism-cut-the-sky');
    pass(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-grunt', 'zz-ogre']);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(1);
    expect(unit(s, 1, 'zz-ogre').dmg).toBe(1);
    expect(unit(s, 0, 'zz-aerial').dmg).toBe(0);
  });

  it('prism-focused-volley: every allied Spotter strikes the chosen enemy, one way; other allies do not', () => {
    const s = board({ hand: [['prism-focused-volley'], []], line: [['zz-spotter', 'zz-grunt'], ['zz-wall']] });
    play(s, 'prism-focused-volley', [unit(s, 1, 'zz-wall').iid]);
    pass(s);
    expect(unit(s, 1, 'zz-wall').dmg).toBe(3);
    const t = board({ hand: [['prism-focused-volley'], []], line: [['zz-spotter', 'zz-spotter'], ['zz-ogre']] });
    play(t, 'prism-focused-volley', [unit(t, 1, 'zz-ogre').iid]);
    pass(t);
    expect(t.players[1].line.length).toBe(0);
    expect(unit(t, 0, 'zz-spotter').dmg).toBe(0);
  });

  it('prism-grand-muster: summons two 1|1 Tier Recruits, then every ally gets +1|+1', () => {
    const s = board({ hand: [['prism-grand-muster'], []], line: [['zz-grunt'], ['zz-grunt']] });
    play(s, 'prism-grand-muster');
    pass(s);
    expect(s.players[0].line.length).toBe(3);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'prism-tier-recruit', 1))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });
});
