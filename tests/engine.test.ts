// Engine rules, named by rule id (docs/spec/10-rules.md). Every test drives the real applyAction.
import { describe, expect, it } from 'vitest';
import { act, attack, board, kinds, legalActions, pass, play, resolveCombat, st, unit, applyAction } from './helpers';
import { createGame } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { costOf } from '../src/engine/query';

describe('game flow', () => {
  it('R-G2/R-G4 opening hand of 4, mulligan swaps the chosen cards, then round 1 starts with a draw', () => {
    const deck = Array<string>(40).fill('zz-grunt');
    const s = createGame({ seed: 3, decks: [deck, deck] });
    expect(s.phase).toBe('mulligan');
    expect(s.players[0].hand.length).toBe(4);
    expect(legalActions(s).length).toBe(16);
    act(s, { type: 'mulligan', replace: [s.players[0].hand[0].iid, s.players[0].hand[1].iid] });
    expect(s.players[0].hand.length).toBe(4);
    act(s, { type: 'mulligan', replace: [] });
    expect(s.phase).toBe('main');
    expect(s.round).toBe(1);
    expect(s.players[0].hand.length).toBe(5);
    expect(s.players[0].deck.length).toBe(35);
    expect(s.players[0].charge).toBe(1);
  });

  it('R-C1/R-C4 Charge grows by 1 a round and unspent Charge banks into Reserve (cap 3)', () => {
    const s = board({ charge: 2 });
    pass(s); pass(s);
    expect(s.round).toBe(2);
    expect(s.players[0].maxCharge).toBe(3);
    expect(s.players[0].charge).toBe(3);
    expect(s.players[0].reserve).toBe(2);
    pass(s); pass(s);
    expect(s.players[0].reserve).toBe(3);
  });

  it('R-C2 Reserve pays for glyphs first and never for units', () => {
    const s = board({ hand: [['zz-rite', 'zz-ogre'], []], charge: 4, reserve: 2 });
    expect(applyAction(s, { type: 'play', iid: s.players[0].hand[1].iid }).ok).toBe(false); // 5-cost unit, 4 Charge
    play(s, 'zz-rite');
    expect(s.players[0].reserve).toBe(0);
    expect(s.players[0].charge).toBe(3);
  });

  it('R-P1 playing a unit hands priority over; R-P5 two passes in a row end the round', () => {
    const s = board({ hand: [['zz-grunt'], []] });
    play(s, 'zz-grunt');
    expect(s.priority).toBe(1);
    pass(s);
    expect(s.priority).toBe(0);
    expect(s.round).toBe(1);
    pass(s);
    expect(s.round).toBe(2);
    expect(s.initiative).toBe(1);
  });

  it('R-P2/R-P4 a swift glyph waits on the stack; the reply resolves first', () => {
    const s = board({ hand: [['zz-bolt'], ['zz-bolt']], line: [['zz-grunt'], ['zz-grunt']] });
    const mine = unit(s, 0, 'zz-grunt');
    const theirs = unit(s, 1, 'zz-grunt');
    play(s, 'zz-bolt', [theirs.iid]);
    expect(s.stack.length).toBe(1);
    expect(s.priority).toBe(1);
    play(s, 'zz-bolt', [mine.iid]);
    expect(s.stack.length).toBe(2);
    pass(s); // seat 0 has no answer: everything resolves, newest first
    expect(s.stack.length).toBe(0);
    expect(s.players[0].line.length).toBe(0);
    expect(s.players[1].line.length).toBe(0);
    const resolves = s.log.filter((e) => e.k === 'resolve').map((e) => e.seat);
    expect(resolves).toEqual([1, 0]);
    expect(s.priority).toBe(1); // the starter took their action
  });

  it('R-P3 a flash glyph resolves at once and keeps priority', () => {
    const s = board({ hand: [['zz-zap'], []], line: [[], ['zz-grunt']] });
    play(s, 'zz-zap', [unit(s, 1, 'zz-grunt').iid]);
    expect(unit(s, 1, 'zz-grunt').dmg).toBe(1);
    expect(s.priority).toBe(0);
    expect(s.stack.length).toBe(0);
  });

  it('R-P6 a ritual glyph cannot answer a glyph or be cast in combat; a unit cannot be played over a stack', () => {
    const s = board({ hand: [['zz-bolt'], ['zz-rite', 'zz-grunt']] });
    play(s, 'zz-bolt', ['spire1']);
    for (const hc of s.players[1].hand) expect(applyAction(s, { type: 'play', iid: hc.iid }).ok).toBe(false);
    expect(s.stack.length).toBe(1);
  });

  it('R-G8 negate removes a glyph from the stack; R-G9 a glyph with no target left fizzles', () => {
    const s = board({ hand: [['zz-bolt', 'zz-bolt'], ['zz-deny', 'zz-zap']], line: [['zz-grunt'], []] });
    play(s, 'zz-bolt', ['spire1']);
    play(s, 'zz-deny', [s.stack[0].sid]);
    pass(s);
    expect(s.players[1].spire).toBe(20);
    expect(kinds(s)).toContain('negate');
    // fizzle: seat 1 acts now; hand priority back, then bolt own grunt... use seat 0 bolt on own grunt, seat 1 zaps it first
    pass(s); // seat 1 passes
    const g = unit(s, 0, 'zz-grunt');
    g.dmg = 1;
    play(s, 'zz-bolt', [g.iid]);
    play(s, 'zz-zap', [g.iid]); // kills it in response
    pass(s);
    pass(s);
    expect(kinds(s)).toContain('fizzle');
  });

  it('R-G10 a two-target glyph can be cast with one legal target; the empty slot is skipped', () => {
    const s = board({ hand: [['tide-sluiceclose'], []], line: [[], ['zz-ogre']] });
    const o = unit(s, 1, 'zz-ogre');
    expect(legalActions(s).filter((a) => a.type === 'play').length).toBe(1);
    play(s, 'tide-sluiceclose', [o.iid]);
    pass(s);
    expect(o.stasis).toBe(true);
    const s2 = board({ hand: [['tide-sluiceclose'], []], line: [[], []] });
    expect(applyAction(s2, { type: 'play', iid: s2.players[0].hand[0].iid }).error).toMatch(/No legal target/);
  });

  it('R-G6 drawing from an empty deck loses', () => {
    const s = board({ deck: [Array<string>(5).fill('zz-filler'), Array<string>(10).fill('zz-filler')] });
    pass(s); pass(s);
    expect(s.winner).toBe(1);
    expect(s.endReason).toBe('deck');
  });

  it('R-G7 hand limit 10: the extra card is burned to the Scrap', () => {
    const s = board({ hand: [Array<string>(10).fill('zz-grunt'), []] });
    pass(s); pass(s);
    expect(s.players[0].hand.length).toBe(10);
    expect(s.players[0].scrap).toEqual(['zz-filler']);
  });

  it('R-U1 the Line holds 6 units; a unit played onto a full Line replaces one of yours, which is destroyed', () => {
    const s = board({ hand: [['zz-ogre'], []], line: [Array<string>(6).fill('zz-grunt'), []] });
    const iid = s.players[0].hand[0].iid;
    const r = applyAction(s, { type: 'play', iid });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/full.*scrap/);
    expect(legalActions(s).filter((a) => a.type === 'play').length).toBe(6);
    act(s, { type: 'play', iid, replace: s.players[0].line[2].iid });
    expect(s.players[0].line.map((u) => u.card)).toEqual(['zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-grunt', 'zz-ogre']);
    expect(s.players[0].seen.alliesDied).toBe(1);
    const s2 = board({ hand: [['zz-ogre'], []], line: [['zz-grunt'], []] });
    expect(applyAction(s2, { type: 'play', iid: s2.players[0].hand[0].iid, replace: s2.players[0].line[0].iid }).ok).toBe(false);
  });

  it('R-X1 a refused action changes nothing', () => {
    const s = board({ hand: [['zz-ogre'], []], charge: 1 });
    const before = JSON.stringify(s);
    expect(applyAction(s, { type: 'play', iid: s.players[0].hand[0].iid }).ok).toBe(false);
    expect(applyAction(s, { type: 'attack' }).ok).toBe(false);
    expect(applyAction(s, { type: 'block', unit: 'u1', att: 'u2' }).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('combat', () => {
  it('R-B1 only the Initiative holder may attack, once a round', () => {
    const s = board({ line: [['zz-grunt'], ['zz-grunt']] });
    attack(s, [unit(s, 0, 'zz-grunt')]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(18);
    expect(s.priority).toBe(1); // R-B9 the defender acts next
    expect(applyAction(s, { type: 'declare', unit: unit(s, 1, 'zz-grunt').iid }).ok).toBe(false);
    pass(s);
    expect(applyAction(s, { type: 'declare', unit: unit(s, 0, 'zz-grunt').iid }).error).toMatch(/already attacked/);
  });

  it('R-B1 a rally before the first attack banks a second attack', () => {
    const s = board({ hand: [['storm-reroute'], []], line: [['zz-grunt'], []] });
    play(s, 'storm-reroute');
    while (s.stack.length) pass(s);
    expect(s.players[0].extraAttacks).toBe(1);
    if (s.priority !== 0) pass(s);
    attack(s, [unit(s, 0, 'zz-grunt')]); resolveCombat(s);
    expect(s.players[0].canAttack).toBe(true);
    pass(s);
    attack(s, [unit(s, 0, 'zz-grunt')]); resolveCombat(s);
    expect(s.players[0].canAttack).toBe(false);
    expect(s.players[1].spire).toBe(16);
  });

  it('R-B5/R-B6 blocked units strike each other at the same time; damage stays', () => {
    const s = board({ line: [['zz-ogre'], ['zz-grunt', 'zz-wall']] });
    const o = unit(s, 0, 'zz-ogre');
    attack(s, [o], [[unit(s, 1, 'zz-grunt'), o]]);
    resolveCombat(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
    expect(o.dmg).toBe(2);
    expect(s.players[1].spire).toBe(20);
    pass(s); pass(s);
    expect(o.dmg).toBe(2); // R-D5 damage does not heal between rounds
  });

  it('R-B4 the attacker acts first in the combat window; swift glyphs resolve before strikes', () => {
    const s = board({ hand: [[], ['zz-bolt']], line: [['zz-grunt'], ['zz-grunt']] });
    const a = unit(s, 0, 'zz-grunt');
    attack(s, [a]);
    expect(s.phase).toBe('combat');
    expect(s.priority).toBe(0);
    pass(s);
    play(s, 'zz-bolt', [a.iid]);
    pass(s); // seat 0 lets it resolve: the attacker dies, combat ends
    expect(s.phase).toBe('main');
    expect(s.players[1].spire).toBe(20);
  });

  it('R-B7 a blocked attacker whose blocker is gone deals no damage unless it has Pierce', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [['zz-grunt', 'zz-pierce'], ['zz-grunt', 'zz-grunt']] });
    const g = unit(s, 0, 'zz-grunt');
    const p = unit(s, 0, 'zz-pierce');
    const b0 = unit(s, 1, 'zz-grunt', 0);
    const b1 = unit(s, 1, 'zz-grunt', 1);
    b0.dmg = 1; b1.dmg = 1;
    attack(s, [g, p], [[b0, g], [b1, p]]);
    play(s, 'zz-zap', [b0.iid]);
    play(s, 'zz-zap', [b1.iid]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(17); // only the Pierce unit's 3
  });
});

describe('keywords', () => {
  it('R-K1 Vanguard strikes first when attacking', () => {
    const s = board({ line: [['zz-vanguard'], ['zz-ogre']] });
    const v = unit(s, 0, 'zz-vanguard');
    const o = unit(s, 1, 'zz-ogre');
    o.dmg = 2;
    attack(s, [v], [[o, v]]);
    resolveCombat(s);
    expect(s.players[1].line.length).toBe(0);
    expect(v.dmg).toBe(0);
  });
  it('R-K2 Pierce sends excess damage to the Spire', () => {
    const s = board({ line: [['zz-pierce'], ['zz-grunt']] });
    const p = unit(s, 0, 'zz-pierce');
    attack(s, [p], [[unit(s, 1, 'zz-grunt'), p]]);
    resolveCombat(s);
    expect(s.players[1].spire).toBe(19);
  });
  it('R-K3/R-K4 Aerial is blocked only by Aerial or Spotter', () => {
    const s = board({ line: [['zz-aerial'], ['zz-grunt', 'zz-spotter']] });
    const a = unit(s, 0, 'zz-aerial');
    act(s, { type: 'declare', unit: a.iid });
    act(s, { type: 'attack' });
    expect(applyAction(s, { type: 'block', unit: unit(s, 1, 'zz-grunt').iid, att: a.iid }).ok).toBe(false);
    act(s, { type: 'block', unit: unit(s, 1, 'zz-spotter').iid, att: a.iid });
  });
  it('R-K5 Plated takes 1 less from every source', () => {
    const s = board({ hand: [['zz-bolt', 'zz-zap'], []], line: [[], ['zz-plated']] });
    const p = unit(s, 1, 'zz-plated');
    play(s, 'zz-zap', [p.iid]);
    expect(p.dmg).toBe(0);
    play(s, 'zz-bolt', [p.iid]);
    pass(s);
    expect(p.dmg).toBe(1);
  });
  it('R-K6 Siphon heals its owner by the damage dealt', () => {
    const s = board({ line: [['zz-siphon'], []] });
    s.players[0].spire = 10;
    attack(s, [unit(s, 0, 'zz-siphon')]);
    resolveCombat(s);
    expect(s.players[0].spire).toBe(13);
    expect(s.players[1].spire).toBe(17);
  });
  it('R-K7 Ward negates the next damage, once', () => {
    const s = board({ hand: [['zz-zap', 'zz-zap'], []], line: [[], ['zz-ward']] });
    const w = unit(s, 1, 'zz-ward');
    play(s, 'zz-zap', [w.iid]);
    expect(w.dmg).toBe(0);
    expect(st(s, w).keywords).not.toContain('ward');
    play(s, 'zz-zap', [w.iid]);
    expect(w.dmg).toBe(1);
  });
  it('R-K8 Dueler forces a chosen enemy to block it', () => {
    const s = board({ line: [['zz-dueler'], ['zz-grunt', 'zz-wall']] });
    const d = unit(s, 0, 'zz-dueler');
    const g = unit(s, 1, 'zz-grunt');
    act(s, { type: 'declare', unit: d.iid, duel: g.iid });
    act(s, { type: 'attack' });
    expect(s.phase).toBe('combat'); // the only attacker is already blocked, so the defender is not asked
    expect(s.combat!.pairs[0]).toMatchObject({ blk: g.iid, forced: true });
    resolveCombat(s);
    expect(s.players[1].line.map((u) => u.card)).toEqual(['zz-wall']);
  });
  it('R-K9 Dread cannot be blocked by units with 2 or less power', () => {
    const s = board({ line: [['zz-dread'], ['zz-grunt']] });
    const d = unit(s, 0, 'zz-dread');
    attack(s, [d]); // no legal block, so the defender is not asked (R-B4)
    expect(s.phase).toBe('combat');
  });
  it('R-K10 Unstable is destroyed at the end of the round', () => {
    const s = board({ line: [['zz-unstable'], []] });
    pass(s); pass(s);
    expect(s.players[0].line.length).toBe(0);
  });
  it('R-K11 Mend heals fully at the start of the round', () => {
    const s = board({ line: [['zz-mend'], []] });
    unit(s, 0, 'zz-mend').dmg = 2;
    pass(s); pass(s);
    expect(unit(s, 0, 'zz-mend').dmg).toBe(0);
  });
  it('R-K12 Corrosive destroys any unit it damages', () => {
    const s = board({ line: [['zz-corrosive'], ['zz-wall']] });
    const c = unit(s, 0, 'zz-corrosive');
    attack(s, [c], [[unit(s, 1, 'zz-wall'), c]]);
    resolveCombat(s);
    expect(s.players[1].line.length).toBe(0);
  });
  it('R-S4 a round health buff ending never destroys the unit', () => {
    const s = board({ hand: [['zz-pump', 'zz-bolt'], []], line: [['zz-grunt'], []] });
    const g = unit(s, 0, 'zz-grunt');
    play(s, 'zz-pump', [g.iid]);
    play(s, 'zz-bolt', [g.iid]);
    pass(s);
    expect(st(s, g).hp).toBe(3);
    pass(s); pass(s);
    expect(st(s, g).hp).toBe(1);
  });
});

describe('hidden information', () => {
  it('R-V1 a view never holds the opponent hand, either deck order, or the seed', () => {
    const deck0 = Array<string>(40).fill('zz-grunt');
    const deck1 = Array<string>(40).fill('zz-ogre');
    const s = createGame({ seed: 5, decks: [deck0, deck1], skipMulligan: true });
    const v = view(s, 0);
    const text = JSON.stringify({ ...v, players: [{ ...v.players[0], deckList: [], hand: [] }, v.players[1]] });
    expect(text).not.toContain('zz-ogre');
    expect(text).not.toContain('zz-grunt');
    expect(v.rng).not.toBe(s.rng);
    expect(v.players[0].hand[0].card).toBe('zz-grunt');
    expect(legalActions(v).length).toBeGreaterThan(0);
  });
  it('R-C3 cost reads through the one cost door', () => {
    const s = board({ hand: [['zz-rite'], []] });
    expect(costOf(s, 0, 'zz-rite')).toBe(3);
  });
});
