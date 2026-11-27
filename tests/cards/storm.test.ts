import { describe, expect, it } from 'vitest';
import { act, applyAction, attack, board, pass, play, resolveCombat, st, unit } from '../helpers';
import type { GameState } from '../../src/engine/types';
import { face, isAscended } from '../../src/engine/query';

const names = (s: GameState, seat: 0 | 1): string[] => s.players[seat].line.map((u) => u.card);
const resonant = (s: GameState): void => { s.players[0].ascended = ['storm-jax']; };

describe('storm cards', () => {
  it('storm-signalkite: Aerial, so a ground blocker is never offered the chance to block', () => {
    const s = board({ line: [['storm-signalkite'], ['zz-grunt']] });
    const k = unit(s, 0, 'storm-signalkite');
    act(s, { type: 'declare', unit: k.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('combat'); // no block phase: nothing can legally block it
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-grunt').iid, att: k.iid }).ok).toBe(false);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(19);
    // contrast: a ground attacker does get blocked
    const t = board({ line: [['zz-grunt'], ['zz-grunt']] });
    act(t, { type: 'declare', unit: unit(t, 0, 'zz-grunt').iid });
    act(t, { type: 'attack' });
    expect(t.phase).toBe('block');
  });

  it('storm-tickettaker: Vanguard kills a 1-health blocker first; Spire strike draws a card', () => {
    const s = board({ line: [['storm-tickettaker'], ['ember-sparkbot']] });
    const k = unit(s, 0, 'storm-tickettaker');
    attack(s, [k], [[unit(s, 1, 'ember-sparkbot'), k]]);
    resolveCombat(s);
    expect(names(s, 1)).toEqual([]);
    expect(k.dmg).toBe(0); // without Vanguard the Sparkbot strikes back and kills it
    expect(s.players[0].hand.length).toBe(0); // blocked: no Spire strike, no draw
    const t = board({ line: [['storm-tickettaker'], []] });
    const before = t.players[0].hand.length;
    attack(t, [unit(t, 0, 'storm-tickettaker')]);
    resolveCombat(t);
    expect(t.players[0].hand.length).toBe(before + 1);
    expect(t.players[1].spire).toBe(19);
  });

  it('storm-flagbearer: Assault gives attacking allies +1|+0 this round', () => {
    const s = board({ line: [['storm-flagbearer', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-flagbearer'), unit(s, 0, 'zz-grunt')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 2 - 3);
  });

  it('storm-railglider: Vanguard kills a 2-health Aerial blocker before it strikes; Aerial dodges ground blockers', () => {
    const s = board({ line: [['storm-railglider'], ['storm-wingmate']] });
    const g = unit(s, 0, 'storm-railglider');
    attack(s, [g], [[unit(s, 1, 'storm-wingmate'), g]]);
    resolveCombat(s);
    expect(names(s, 1)).toEqual([]);
    expect(g.dmg).toBe(0); // without Vanguard the Wingmate (2 power) kills the 1-health glider
    const t = board({ line: [['storm-railglider'], ['zz-grunt']] });
    act(t, { type: 'declare', unit: unit(t, 0, 'storm-railglider').iid });
    act(t, { type: 'attack' });
    expect(t.phase).toBe('combat');
  });

  it('storm-gustcaller: Dawn gives another random ally +1|+0 this round, never itself', () => {
    const lone = board({ line: [['storm-gustcaller'], []] });
    pass(lone); pass(lone);
    expect(lone.round).toBe(2);
    expect(st(lone, unit(lone, 0, 'storm-gustcaller')).power).toBe(1); // no other ally: nobody gets it
    const got = [0, 0];
    for (let seed = 1; seed <= 30; seed++) {
      const s = board({ seed, line: [['storm-gustcaller', 'zz-wall', 'zz-grunt'], []] });
      pass(s); pass(s);
      expect(s.round).toBe(2);
      expect(st(s, unit(s, 0, 'storm-gustcaller')).power).toBe(1);
      const w = st(s, unit(s, 0, 'zz-wall')).power;
      const g = st(s, unit(s, 0, 'zz-grunt')).power;
      expect((w - 0) + (g - 2)).toBe(1); // exactly one +1 handed out
      got[w === 1 ? 0 : 1] += 1;
    }
    expect(got[0]).toBeGreaterThan(0);
    expect(got[1]).toBeGreaterThan(0);
  });

  it('storm-dispatcher: Deploy gives an ally +2|+0 and Aerial this round; the target must be an ally', () => {
    const s = board({ hand: [['storm-dispatcher'], []], line: [['zz-grunt'], ['zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt');
    const hand = s.players[0].hand[0].iid;
    expect(applyAction(s, { type: 'play', iid: hand, targets: [unit(s, 1, 'zz-grunt').iid] }).ok).toBe(false);
    play(s, 'storm-dispatcher', [g.iid]);
    expect(st(s, g)).toMatchObject({ power: 4 });
    expect(st(s, g).keywords).toContain('aerial');
    expect(st(s, unit(s, 1, 'zz-grunt')).power).toBe(2);
    resolveCombat(s);
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, g).power).toBe(2); // "this round": fades
    expect(st(s, g).keywords).not.toContain('aerial');
  });

  it('storm-galecourier: Aerial; Spire strike adds 1 more Spire damage', () => {
    const s = board({ line: [['storm-galecourier'], []] });
    attack(s, [unit(s, 0, 'storm-galecourier')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 3 - 1);
  });

  it('storm-sparkrider: Assault gives me +1|+0 this round', () => {
    const s = board({ line: [['storm-sparkrider'], []] });
    attack(s, [unit(s, 0, 'storm-sparkrider')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(16);
  });

  it('storm-squadcaller: Deploy summons a Wingmate', () => {
    const s = board({ hand: [['storm-squadcaller'], []] });
    play(s, 'storm-squadcaller');
    expect(names(s, 0)).toEqual(['storm-squadcaller', 'storm-wingmate']);
  });

  it('storm-railmarshal: Assault rallies when 2 or fewer attackers are declared, not when 3 or more', () => {
    const s = board({ line: [['storm-railmarshal'], []] });
    attack(s, [unit(s, 0, 'storm-railmarshal')]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(true);
    pass(s);
    act(s, { type: 'declare', unit: unit(s, 0, 'storm-railmarshal').iid }); // the extra attack is really usable
    const u = board({ line: [['storm-railmarshal', 'zz-grunt'], []] });
    attack(u, [unit(u, 0, 'storm-railmarshal'), unit(u, 0, 'zz-grunt')]);
    resolveCombat(u);
    expect(u.players[0].canAttack).toBe(true); // 2 declared: still rallies
    pass(u);
    attack(u, [unit(u, 0, 'storm-railmarshal')]);
    resolveCombat(u);
    expect(u.players[0].canAttack).toBe(false); // 3 declared this round, cumulative: no further rally
    const t = board({ line: [['storm-railmarshal', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [unit(t, 0, 'storm-railmarshal'), unit(t, 0, 'zz-grunt', 0), unit(t, 0, 'zz-grunt', 1)]);
    resolveCombat(t);
    expect(t.players[0].canAttack).toBe(false);
    expect(t.players[0].extraAttacks).toBe(0);
  });

  it('storm-thunderkite: Aerial and Vanguard 4|3', () => {
    const s = board({ line: [['storm-thunderkite'], ['zz-grunt']] });
    const k = unit(s, 0, 'storm-thunderkite');
    act(s, { type: 'declare', unit: k.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('combat'); // Aerial: the ground blocker cannot block
    resolveCombat(s);
    expect(s.players[1].spire).toBe(16);
    const t = board({ line: [['storm-thunderkite'], ['storm-wingmate']] });
    const u = unit(t, 0, 'storm-thunderkite');
    attack(t, [u], [[unit(t, 1, 'storm-wingmate'), u]]);
    resolveCombat(t);
    expect(names(t, 1)).toEqual([]);
    expect(u.dmg).toBe(0); // Vanguard: the 2-power Wingmate died before striking
  });

  it('storm-stormcaller: Assault gives attacking allies +1|+0 and Aerial this round', () => {
    const s = board({ line: [['storm-stormcaller', 'zz-grunt'], ['zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt');
    attack(s, [g]); // grunt alone: Stormcaller is not attacking
    resolveCombat(s);
    expect(s.players[1].spire).toBe(18); // not buffed
    const t = board({ line: [['storm-stormcaller', 'zz-grunt'], ['zz-grunt']] });
    attack(t, [unit(t, 0, 'storm-stormcaller'), unit(t, 0, 'zz-grunt')]);
    expect(st(t, unit(t, 0, 'zz-grunt'))).toMatchObject({ power: 3 });
    expect(st(t, unit(t, 0, 'zz-grunt')).keywords).toContain('aerial');
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20 - 5 - 3);
  });

  it('storm-cyclonebarge: Dawn summons a Wingmate; Resonant gives +1|+1', () => {
    const s = board({ line: [['storm-cyclonebarge', 'storm-jax'], []] });
    const b = unit(s, 0, 'storm-cyclonebarge');
    expect(st(s, b)).toMatchObject({ power: 5, health: 5 });
    pass(s); pass(s);
    expect(names(s, 0)).toEqual(['storm-cyclonebarge', 'storm-jax', 'storm-wingmate']);
    resonant(s);
    expect(st(s, b)).toMatchObject({ power: 6, health: 6 });
  });

  it('storm-tempestliner: Aerial, Vanguard; Spire strike adds 2 Spire damage', () => {
    const s = board({ line: [['storm-tempestliner'], []] });
    attack(s, [unit(s, 0, 'storm-tempestliner')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 6 - 2);
  });

  it('storm-tailwind: an ally gets +1|+1 this round, then it fades', () => {
    const s = board({ hand: [['storm-tailwind'], []], line: [['zz-grunt'], ['zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'storm-tailwind', [g.iid]);
    expect(st(s, g)).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 1, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    pass(s); pass(s);
    expect(st(s, g)).toMatchObject({ power: 2, health: 2 });
  });

  it('storm-updraft: an ally gets +1|+0 and Aerial this round', () => {
    const s = board({ hand: [['storm-updraft'], []], line: [['zz-grunt'], ['zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'storm-updraft', [g.iid]);
    expect(st(s, g).power).toBe(3);
    expect(st(s, g).keywords).toContain('aerial');
    act(s, { type: 'declare', unit: g.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('combat'); // the ground Grunt is not offered a block
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-grunt').iid, att: g.iid }).ok).toBe(false);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(17);
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, g).power).toBe(2); // fades with the round
    expect(st(s, g).keywords).not.toContain('aerial');
  });

  it('storm-crosswind: an enemy unit in Stasis cannot block (and the other still can)', () => {
    const s = board({ hand: [['storm-crosswind'], []], line: [['zz-grunt'], ['zz-grunt', 'zz-wall']] });
    const e = unit(s, 1, 'zz-grunt');
    const w = unit(s, 1, 'zz-wall');
    play(s, 'storm-crosswind', [e.iid]);
    expect(e.stasis).toBe(true);
    expect(w.stasis).toBe(false);
    const a = unit(s, 0, 'zz-grunt');
    act(s, { type: 'declare', unit: a.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('block');
    expect(applyAction(s, { type: 'block', unit: e.iid, att: a.iid }).ok).toBe(false);
    expect(applyAction(s, { type: 'block', unit: w.iid, att: a.iid }).ok).toBe(true);
    // with the only blocker in Stasis there is no block phase and the Spire is hit
    const t = board({ hand: [['storm-crosswind'], []], line: [['zz-grunt'], ['zz-grunt']] });
    play(t, 'storm-crosswind', [unit(t, 1, 'zz-grunt').iid]);
    act(t, { type: 'declare', unit: unit(t, 0, 'zz-grunt').iid });
    act(t, { type: 'attack' });
    expect(t.phase).toBe('combat');
    resolveCombat(t);
    expect(t.players[1].spire).toBe(18);
  });

  it('storm-crosswind: Stasis on a blocker mid-combat leaves the attacker blocked and no damage is dealt either way', () => {
    const s = board({ hand: [['storm-crosswind'], []], line: [['zz-grunt'], ['zz-grunt']] });
    const a = unit(s, 0, 'zz-grunt');
    const b = unit(s, 1, 'zz-grunt');
    attack(s, [a], [[b, a]]);
    play(s, 'storm-crosswind', [b.iid]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20);
    expect(a.dmg + b.dmg).toBe(0);
  });

  it('storm-galesurge: allies get +2|+0 this round', () => {
    const s = board({ hand: [['storm-galesurge'], []], line: [['zz-grunt', 'zz-wall'], []] });
    play(s, 'storm-galesurge');
    pass(s);
    expect(st(s, unit(s, 0, 'zz-grunt')).power).toBe(4);
    expect(st(s, unit(s, 0, 'zz-wall')).power).toBe(2);
  });

  it('storm-reroute: after attacking, you may attack again', () => {
    const s = board({ hand: [['storm-reroute'], []], line: [['zz-grunt'], []] });
    const g = unit(s, 0, 'zz-grunt');
    attack(s, [g]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    expect(applyAction(s, { type: 'declare', unit: g.iid }).ok).toBe(false);
    pass(s); // defender passes priority back
    play(s, 'storm-reroute');
    pass(s);
    expect(s.players[0].canAttack).toBe(true);
    pass(s); // the opponent holds priority after the glyph resolves
    act(s, { type: 'declare', unit: g.iid });
    act(s, { type: 'attack' });
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 2 - 2);
  });

  it('storm-reroute: cast before attacking it still grants one more attack this round (R-B1)', () => {
    const s = board({ hand: [['storm-reroute'], []], line: [['zz-grunt', 'zz-grunt'], []] });
    play(s, 'storm-reroute');
    pass(s);
    expect(s.players[0].extraAttacks).toBe(1);
    pass(s);
    attack(s, [unit(s, 0, 'zz-grunt', 0)]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(true); // the banked attack is now available
    pass(s);
    attack(s, [unit(s, 0, 'zz-grunt', 1)]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    expect(s.players[1].spire).toBe(16);
  });

  it('storm-skyhook: returns an enemy unit to its owner\'s hand', () => {
    const s = board({ hand: [['storm-skyhook'], []], line: [[], ['ember-ashrunner']] });
    play(s, 'storm-skyhook', [unit(s, 1, 'ember-ashrunner').iid]);
    pass(s);
    expect(names(s, 1)).toEqual([]);
    expect(s.players[1].hand.map((h) => h.card)).toEqual(['ember-ashrunner']);
  });

  it('storm-jetstream: allies gain Aerial this round; no extra attack unless Resonant', () => {
    const s = board({ hand: [['storm-jetstream'], []], line: [['zz-grunt'], ['zz-grunt']] });
    play(s, 'storm-jetstream');
    pass(s);
    expect(st(s, unit(s, 0, 'zz-grunt')).keywords).toContain('aerial');
    expect(s.players[0].extraAttacks).toBe(0); // not Resonant: nothing banked
    pass(s); // priority comes back to the Initiative holder
    const g = unit(s, 0, 'zz-grunt');
    act(s, { type: 'declare', unit: g.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('combat'); // Aerial really applies
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    // after attacking, not Resonant: still no second attack
    const u = board({ hand: [['storm-jetstream'], []], line: [['zz-grunt'], []] });
    attack(u, [unit(u, 0, 'zz-grunt')]);
    resolveCombat(u);
    pass(u);
    play(u, 'storm-jetstream');
    pass(u);
    expect(u.players[0].canAttack).toBe(false);
  });

  it('storm-jetstream: Resonant also lets you attack again (after attacking, and banked before)', () => {
    const t = board({ hand: [['storm-jetstream'], []], line: [['storm-jax', 'zz-grunt'], []] });
    resonant(t);
    attack(t, [unit(t, 0, 'zz-grunt')]);
    resolveCombat(t);
    expect(t.players[0].canAttack).toBe(false);
    pass(t);
    play(t, 'storm-jetstream');
    pass(t);
    expect(t.players[0].canAttack).toBe(true);
    const b = board({ hand: [['storm-jetstream'], []], line: [['storm-jax', 'zz-grunt'], []] });
    resonant(b);
    play(b, 'storm-jetstream');
    pass(b);
    expect(b.players[0].extraAttacks).toBe(1);
  });

  it('storm-airmail: Ritual draws 2 cards', () => {
    const s = board({ hand: [['storm-airmail'], []] });
    play(s, 'storm-airmail');
    pass(s);
    expect(s.players[0].hand.length).toBe(2);
  });

  it('storm-skyraid: Ritual gives allies +2|+0 and Vanguard this round and draws a card', () => {
    const s = board({ hand: [['storm-skyraid'], []], line: [['zz-grunt'], []] });
    play(s, 'storm-skyraid');
    pass(s);
    const g = unit(s, 0, 'zz-grunt');
    expect(st(s, g).power).toBe(4);
    expect(st(s, g).keywords).toContain('vanguard');
    expect(s.players[0].hand.length).toBe(1);
  });

  it('storm-corvane: base Assault gives attacking allies (itself included) +1|+0, non-attackers nothing', () => {
    const s = board({ line: [['storm-corvane', 'zz-grunt', 'zz-wall'], []] });
    attack(s, [unit(s, 0, 'storm-corvane'), unit(s, 0, 'zz-grunt')]);
    expect(st(s, unit(s, 0, 'storm-corvane')).power).toBe(5);
    expect(st(s, unit(s, 0, 'zz-grunt')).power).toBe(3);
    expect(st(s, unit(s, 0, 'zz-wall')).power).toBe(0);
    expect(st(s, unit(s, 0, 'zz-grunt')).keywords).not.toContain('vanguard');
  });

  it('storm-corvane: ascended Assault gives attacking allies +2|+0 and Vanguard this round (not to non-attackers)', () => {
    const s = board({ line: [['storm-corvane', 'zz-grunt', 'zz-wall'], ['zz-grunt']] });
    s.players[0].heroes = ['storm-corvane'];
    s.players[0].ascended = ['storm-corvane'];
    const g = unit(s, 0, 'zz-grunt');
    const c = unit(s, 0, 'storm-corvane');
    attack(s, [c, g]);
    expect(st(s, g).power).toBe(4);
    expect(st(s, g).keywords).toContain('vanguard');
    expect(st(s, c).power).toBe(7);
    expect(st(s, unit(s, 0, 'zz-wall')).power).toBe(0);
    expect(st(s, unit(s, 0, 'zz-wall')).keywords).not.toContain('vanguard');
    resolveCombat(s);
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, g).power).toBe(2); // "this round"
    expect(st(s, g).keywords).not.toContain('vanguard');
  });

  it('storm-corvane: ascended Vanguard really strikes first', () => {
    const s = board({ line: [['storm-corvane', 'zz-grunt'], ['zz-grunt']] });
    s.players[0].heroes = ['storm-corvane'];
    s.players[0].ascended = ['storm-corvane'];
    const g = unit(s, 0, 'zz-grunt');
    attack(s, [unit(s, 0, 'storm-corvane'), g], [[unit(s, 1, 'zz-grunt'), g]]);
    resolveCombat(s);
    expect(names(s, 1)).toEqual([]);
    expect(g.dmg).toBe(0); // Vanguard killed the blocker before it struck back
  });

  it('storm-jax: Ascend lets you attack again even if the owner has not attacked yet (R-B1)', () => {
    const s = board({ hand: [['zz-bolt'], []], line: [['storm-jax', 'zz-grunt'], []] });
    s.players[0].heroes = ['storm-jax'];
    s.players[0].seen.spireDamage = 7;
    play(s, 'zz-bolt', ['spire1']);
    pass(s);
    expect(s.players[0].ascended).toContain('storm-jax');
    expect(s.players[0].extraAttacks).toBe(1);
  });

  // ---------- First Light additions ----------
  it('storm-odile: Dawn gives other Aerial allies +1|+0 this round, not ground allies or herself', () => {
    const s = board({ line: [['storm-odile', 'zz-aerial', 'zz-grunt'], []] });
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, unit(s, 0, 'zz-aerial')).power).toBe(4);
    expect(st(s, unit(s, 0, 'zz-grunt')).power).toBe(2);
    expect(st(s, unit(s, 0, 'storm-odile')).power).toBe(2);
    expect(s.players[0].seen.buffsGiven).toBe(1);
  });

  it('storm-odile: ascends on the 16th buff; Ascend gives Aerial allies +2|+2; ascended Dawn gives +1|+1', () => {
    const s = board({ hand: [['storm-tailwind', 'storm-tailwind'], []], line: [['storm-odile', 'zz-aerial', 'zz-grunt'], []] });
    s.players[0].heroes = ['storm-odile'];
    s.players[0].seen.buffsGiven = 14;
    const a = unit(s, 0, 'zz-aerial');
    const o = unit(s, 0, 'storm-odile');
    play(s, 'storm-tailwind', [a.iid]);
    expect(isAscended(s, 0, 'storm-odile')).toBe(false);
    play(s, 'storm-tailwind', [a.iid]);
    expect(isAscended(s, 0, 'storm-odile')).toBe(true);
    expect(face(s, 0, 'storm-odile').name).toBe('Hettie, Mother of the Lofts');
    expect(st(s, o)).toMatchObject({ power: 5, health: 7 });
    expect(st(s, a)).toMatchObject({ power: 3 + 2 + 2, health: 3 + 2 + 2 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, a)).toMatchObject({ power: 3 + 2 + 1, health: 3 + 2 + 1 }); // Tailwinds faded, ascended Dawn +1|+1
  });

  it('storm-ness: Assault gives attacking allies +1|+0 this round once 3+ attackers are declared this round', () => {
    const s = board({ line: [['storm-ness', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-ness'), unit(s, 0, 'zz-grunt')]);
    expect(st(s, unit(s, 0, 'zz-grunt')).power).toBe(2); // only 2 declared
    const t = board({ line: [['storm-ness', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [unit(t, 0, 'storm-ness'), unit(t, 0, 'zz-grunt', 0), unit(t, 0, 'zz-grunt', 1)]);
    expect(st(t, unit(t, 0, 'zz-grunt')).power).toBe(3);
    expect(st(t, unit(t, 0, 'storm-ness')).power).toBe(4);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20 - 4 - 3 - 3);
  });

  it('storm-ness: ascends on the 16th attacker; Ascend buffs the attack and grants another; ascended Assault gives +2|+0', () => {
    const s = board({ line: [['storm-ness', 'zz-grunt'], []] });
    s.players[0].heroes = ['storm-ness'];
    s.players[0].seen.attackersDeclared = 14;
    const n = unit(s, 0, 'storm-ness');
    const g = unit(s, 0, 'zz-grunt');
    attack(s, [n, g]);
    expect(isAscended(s, 0, 'storm-ness')).toBe(true);
    expect(face(s, 0, 'storm-ness').name).toBe('Otto Brandt, the Whole Union');
    expect(st(s, g).power).toBe(3); // Ascend: +1|+0 this round
    expect(st(s, n).power).toBe(5);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 5 - 3);
    expect(s.players[0].canAttack).toBe(true); // Ascend: attack again
    pass(s);
    attack(s, [n, g]); // 4 declared this round: ascended Assault +2|+0
    expect(st(s, g).power).toBe(2 + 1 + 2);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(12 - 7 - 5);
  });

  it('storm-ribbonkite: Deploy gives an Aerial ally +1|+1; a ground ally cannot be chosen', () => {
    const s = board({ hand: [['storm-ribbonkite'], []], line: [['zz-aerial', 'zz-grunt'], []] });
    const hand = s.players[0].hand[0].iid;
    expect(applyAction(s, { type: 'play', iid: hand, targets: [unit(s, 0, 'zz-grunt').iid] }).ok).toBe(false);
    play(s, 'storm-ribbonkite', [unit(s, 0, 'zz-aerial').iid]);
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 });
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 }); // lasting
  });

  it('storm-wingcadet: another Aerial ally entering the Line gets +1|+0; a ground ally does not', () => {
    const s = board({ hand: [['storm-signalkite', 'storm-tickettaker'], []], line: [['storm-wingcadet'], []] });
    play(s, 'storm-signalkite');
    pass(s);
    play(s, 'storm-tickettaker');
    expect(st(s, unit(s, 0, 'storm-signalkite')).power).toBe(2);
    expect(st(s, unit(s, 0, 'storm-tickettaker')).power).toBe(1);
    expect(st(s, unit(s, 0, 'storm-wingcadet')).power).toBe(1);
  });

  it('storm-tailrunner: Assault gives me +2|+0 this round only when 3+ attackers are declared this round', () => {
    const s = board({ line: [['storm-tailrunner', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-tailrunner'), unit(s, 0, 'zz-grunt')]);
    expect(st(s, unit(s, 0, 'storm-tailrunner')).power).toBe(1);
    const t = board({ line: [['storm-tailrunner', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [unit(t, 0, 'storm-tailrunner'), unit(t, 0, 'zz-grunt', 0), unit(t, 0, 'zz-grunt', 1)]);
    expect(st(t, unit(t, 0, 'storm-tailrunner')).power).toBe(3);
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20 - 3 - 2 - 2);
  });

  it('storm-skirmishkite: Aerial 2|1; Resonant gives +1|+1 and Vanguard', () => {
    const s = board({ line: [['storm-skirmishkite', 'storm-jax'], ['zz-grunt']] });
    const k = unit(s, 0, 'storm-skirmishkite');
    expect(st(s, k)).toMatchObject({ power: 2, health: 1 });
    expect(st(s, k).keywords).toContain('aerial');
    expect(st(s, k).keywords).not.toContain('vanguard');
    resonant(s);
    expect(st(s, k)).toMatchObject({ power: 3, health: 2 });
    expect(st(s, k).keywords).toContain('vanguard');
  });

  it('storm-signaller: Dusk draws a card if 4+ attackers were declared this round, not with 3', () => {
    const s = board({ line: [['storm-signaller', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-signaller'), unit(s, 0, 'zz-grunt', 0), unit(s, 0, 'zz-grunt', 1), unit(s, 0, 'zz-grunt', 2)]);
    resolveCombat(s);
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(s.players[0].hand.length).toBe(2); // Dusk draw + the round's draw
    const t = board({ line: [['storm-signaller', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [unit(t, 0, 'storm-signaller'), unit(t, 0, 'zz-grunt', 0), unit(t, 0, 'zz-grunt', 1)]);
    resolveCombat(t);
    pass(t); pass(t);
    expect(t.players[0].hand.length).toBe(1);
  });

  it('storm-windrigger: Deploy gives an Aerial ally +1|+1, or a ground ally lasting Aerial', () => {
    const s = board({ hand: [['storm-windrigger'], []], line: [['zz-aerial'], []] });
    play(s, 'storm-windrigger', [unit(s, 0, 'zz-aerial').iid]);
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 });
    const t = board({ hand: [['storm-windrigger'], []], line: [['zz-grunt'], []] });
    const g = unit(t, 0, 'zz-grunt');
    play(t, 'storm-windrigger', [g.iid]);
    expect(st(t, g)).toMatchObject({ power: 2, health: 2 });
    expect(st(t, g).keywords).toContain('aerial');
    pass(t); pass(t);
    expect(t.round).toBe(2);
    expect(st(t, g).keywords).toContain('aerial'); // lasting
  });

  it('storm-gyrekite: Strike gives other Aerial allies +1|+0 this round, so a later attacker hits harder', () => {
    const s = board({ line: [['storm-gyrekite', 'zz-aerial', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-gyrekite'), unit(s, 0, 'zz-aerial'), unit(s, 0, 'zz-grunt')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 3 - 4 - 2);
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'zz-aerial')).power).toBe(3); // this round only
  });

  it('storm-veteranrunner: Vanguard; Strike gives me a lasting +1|+1 when 3+ attackers are declared this round', () => {
    const s = board({ line: [['storm-veteranrunner'], []] });
    attack(s, [unit(s, 0, 'storm-veteranrunner')]);
    resolveCombat(s);
    expect(st(s, unit(s, 0, 'storm-veteranrunner'))).toMatchObject({ power: 3, health: 2 });
    const t = board({ line: [['storm-veteranrunner', 'zz-grunt', 'zz-grunt'], []] });
    const v = unit(t, 0, 'storm-veteranrunner');
    attack(t, [v, unit(t, 0, 'zz-grunt', 0), unit(t, 0, 'zz-grunt', 1)]);
    resolveCombat(t);
    pass(t); pass(t);
    expect(st(t, v)).toMatchObject({ power: 4, health: 3 });
  });

  it('storm-mastlookout: Spotter blocks an Aerial attacker; Resonant gives +2|+0 and Aerial', () => {
    const s = board({ line: [['zz-aerial'], ['storm-mastlookout']] });
    const a = unit(s, 0, 'zz-aerial');
    const m = unit(s, 1, 'storm-mastlookout');
    attack(s, [a], [[m, a]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20);
    expect(m.dmg).toBe(3);
    const t = board({ line: [['storm-mastlookout', 'storm-jax'], []] });
    const k = unit(t, 0, 'storm-mastlookout');
    expect(st(t, k).keywords).not.toContain('aerial');
    resonant(t);
    expect(st(t, k)).toMatchObject({ power: 4, health: 4 });
    expect(st(t, k).keywords).toContain('aerial');
  });

  it('storm-switchforeman: Deploy after an attack lets you attack again; before any attack it banks nothing', () => {
    const s = board({ hand: [['storm-switchforeman'], []], line: [['zz-grunt'], []] });
    attack(s, [unit(s, 0, 'zz-grunt')]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    pass(s);
    play(s, 'storm-switchforeman');
    expect(s.players[0].canAttack).toBe(true);
    const t = board({ hand: [['storm-switchforeman'], []] });
    play(t, 'storm-switchforeman');
    expect(t.players[0].extraAttacks).toBe(0);
  });

  it('storm-glidetutor: Dawn gives other Aerial allies with 2 or less power a lasting +1|+1', () => {
    const s = board({ line: [['storm-glidetutor', 'storm-signalkite', 'zz-aerial', 'zz-grunt'], []] });
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'storm-signalkite'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 3, health: 3 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'storm-signalkite'))).toMatchObject({ power: 3, health: 3 });
    pass(s); pass(s);
    expect(st(s, unit(s, 0, 'storm-signalkite'))).toMatchObject({ power: 3, health: 3 }); // 3 power: no longer trained
  });

  it('storm-breakneck: Shatter lets you attack again this round', () => {
    const s = board({ hand: [['zz-bolt'], []], line: [['storm-breakneck', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'zz-grunt')]);
    resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    pass(s);
    const b = unit(s, 0, 'storm-breakneck');
    b.dmg = 2;
    play(s, 'zz-bolt', [b.iid]);
    pass(s);
    expect(names(s, 0)).toEqual(['zz-grunt']);
    expect(s.players[0].canAttack).toBe(true);
  });

  it('storm-aeriecarrier: Deploy gives Aerial allies (itself included) +1|+1, ground allies nothing', () => {
    const s = board({ hand: [['storm-aeriecarrier'], []], line: [['zz-aerial', 'zz-grunt'], []] });
    play(s, 'storm-aeriecarrier');
    expect(st(s, unit(s, 0, 'storm-aeriecarrier'))).toMatchObject({ power: 6, health: 5 });
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
  });

  it('storm-bellexpress: Assault deals 4 to the enemy Spire once 5+ attackers are declared this round', () => {
    const s = board({ line: [['storm-bellexpress', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(s, [unit(s, 0, 'storm-bellexpress'), unit(s, 0, 'zz-grunt', 0), unit(s, 0, 'zz-grunt', 1), unit(s, 0, 'zz-grunt', 2)]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(20 - 6 - 6);
    const t = board({ line: [['storm-bellexpress', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [unit(t, 0, 'storm-bellexpress'), ...[0, 1, 2, 3].map((i) => unit(t, 0, 'zz-grunt', i))]);
    expect(t.players[1].spire).toBe(16); // before the strikes
    resolveCombat(t);
    expect(t.players[1].spire).toBe(16 - 6 - 8);
  });

  it('storm-anchorleg: an ally gets +1|+0 this round, and +1|+1 more with 3+ attackers declared this round', () => {
    const s = board({ hand: [['storm-anchorleg'], []], line: [['zz-grunt'], []] });
    play(s, 'storm-anchorleg', [unit(s, 0, 'zz-grunt').iid]);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 3, health: 2 });
    const t = board({ hand: [['storm-anchorleg'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    const g = unit(t, 0, 'zz-grunt', 0);
    attack(t, [g, unit(t, 0, 'zz-grunt', 1), unit(t, 0, 'zz-grunt', 2)]);
    play(t, 'storm-anchorleg', [g.iid]); // combat window, attacker has priority
    expect(st(t, g)).toMatchObject({ power: 4, health: 3 });
    resolveCombat(t);
    expect(t.players[1].spire).toBe(20 - 4 - 2 - 2);
  });

  it('storm-sinkingair: an enemy unit gets -2|+0 this round', () => {
    const s = board({ hand: [['storm-sinkingair'], []], line: [['zz-grunt'], ['zz-ogre']] });
    const hand = s.players[0].hand[0].iid;
    expect(applyAction(s, { type: 'play', iid: hand, targets: [unit(s, 0, 'zz-grunt').iid] }).ok).toBe(false);
    const o = unit(s, 1, 'zz-ogre');
    play(s, 'storm-sinkingair', [o.iid]);
    expect(st(s, o)).toMatchObject({ power: 3, health: 5 });
    pass(s); pass(s);
    expect(st(s, o).power).toBe(5);
  });

  it('storm-closeechelon: Aerial allies get +1|+1 this round, ground allies nothing', () => {
    const s = board({ hand: [['storm-closeechelon'], []], line: [['zz-aerial', 'zz-grunt'], ['zz-aerial']] });
    play(s, 'storm-closeechelon');
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 });
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    expect(st(s, unit(s, 1, 'zz-aerial'))).toMatchObject({ power: 3, health: 3 });
  });

  it('storm-parceldrop: draws a card, two with 3+ attackers declared this round', () => {
    const s = board({ hand: [['storm-parceldrop'], []] });
    play(s, 'storm-parceldrop');
    pass(s);
    expect(s.players[0].hand.length).toBe(1);
    const t = board({ hand: [['storm-parceldrop'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [0, 1, 2].map((i) => unit(t, 0, 'zz-grunt', i)));
    resolveCombat(t);
    pass(t);
    play(t, 'storm-parceldrop');
    pass(t);
    expect(t.players[0].hand.length).toBe(2);
  });

  it('storm-loopback: castable only after 4+ attackers this round, then you may attack again', () => {
    const s = board({ hand: [['storm-loopback'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(s, [0, 1, 2].map((i) => unit(s, 0, 'zz-grunt', i)));
    resolveCombat(s);
    pass(s);
    expect(applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid }).ok).toBe(false); // only 3 declared
    const t = board({ hand: [['storm-loopback'], []], line: [['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt'], []] });
    attack(t, [0, 1, 2, 3].map((i) => unit(t, 0, 'zz-grunt', i)));
    resolveCombat(t);
    pass(t);
    expect(t.players[0].canAttack).toBe(false);
    play(t, 'storm-loopback');
    pass(t);
    expect(t.players[0].canAttack).toBe(true);
  });

  it('storm-steepdive: an Aerial ally strikes an enemy unit one way; a ground ally cannot be the striker', () => {
    const s = board({ hand: [['storm-steepdive'], []], line: [['zz-aerial', 'zz-grunt'], ['zz-grunt']] });
    const e = unit(s, 1, 'zz-grunt');
    const hand = s.players[0].hand[0].iid;
    expect(applyAction(s, { type: 'play', iid: hand, targets: [unit(s, 0, 'zz-grunt').iid, e.iid] }).ok).toBe(false);
    play(s, 'storm-steepdive', [unit(s, 0, 'zz-aerial').iid, e.iid]);
    pass(s);
    expect(names(s, 1)).toEqual([]);
    expect(unit(s, 0, 'zz-aerial').dmg).toBe(0);
  });

  it('storm-gliderdrop: summons 2 Wingmates; Resonant also gives Aerial allies +1|+1 this round', () => {
    const s = board({ hand: [['storm-gliderdrop'], []] });
    play(s, 'storm-gliderdrop');
    pass(s);
    expect(names(s, 0)).toEqual(['storm-wingmate', 'storm-wingmate']);
    expect(st(s, unit(s, 0, 'storm-wingmate'))).toMatchObject({ power: 2, health: 2 });
    const t = board({ hand: [['storm-gliderdrop'], []], line: [['storm-jax'], []] });
    resonant(t);
    play(t, 'storm-gliderdrop');
    pass(t);
    expect(st(t, unit(t, 0, 'storm-wingmate', 1))).toMatchObject({ power: 3, health: 3 });
  });

  it('storm-flightdrill: Aerial allies get a lasting +1|+1 and you draw a card', () => {
    const s = board({ hand: [['storm-flightdrill'], []], line: [['zz-aerial', 'zz-grunt'], []] });
    play(s, 'storm-flightdrill');
    pass(s);
    expect(s.players[0].hand.length).toBe(1);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 2, health: 2 });
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(st(s, unit(s, 0, 'zz-aerial'))).toMatchObject({ power: 4, health: 4 });
  });

  it('storm-doubledeparture: allies get +2|+1 this round and an extra attack is banked', () => {
    const s = board({ hand: [['storm-doubledeparture'], []], line: [['zz-grunt'], []] });
    play(s, 'storm-doubledeparture');
    pass(s);
    expect(st(s, unit(s, 0, 'zz-grunt'))).toMatchObject({ power: 4, health: 3 });
    expect(s.players[0].extraAttacks).toBe(1);
  });
});
