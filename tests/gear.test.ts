import { describe, expect, it } from 'vitest';
import './helpers';
import { createGame, applyAction } from '../src/engine/rules';
import { costOf, face, stats } from '../src/engine/query';
import { view } from '../src/engine/view';
import type { Gear, Order, Setup } from '../src/engine/types';
import { LIMITS } from '../src/engine/types';

// spec 20 engine support: campaign gear (R-X4 early cards, R-X5 Fittings, R-X6 Orders).
const filler = (n = 20): string[] => Array<string>(n).fill('zz-filler');
const game = (gear: [Gear, Gear], extra: Partial<Setup> = {}) =>
  createGame({ seed: 5, decks: [filler(), filler()], first: 0, skipMulligan: true, gear, ...extra });
const unit = (s: ReturnType<typeof createGame>, seat: 0 | 1, card: string) => {
  const u = { iid: `t${s.nextId++}`, card, owner: seat, dmg: 0, mods: [], stasis: false, ward: false, silenced: false, doomed: false, seen: {}, summonRound: 1 };
  s.players[seat].line.push(u);
  return u;
};

describe('R-X4 early cards', () => {
  it('one copy of each early card lands among the top cards, whatever the seed', () => {
    for (let seed = 1; seed < 60; seed++) {
      const deck = [...filler(19), 'zz-ogre'];
      deck.unshift(deck.pop()!); // the Ogre starts at the bottom
      const s = createGame({ seed, decks: [deck, filler()], gear: [{ early: ['zz-ogre'] }, {}] });
      const p = s.players[0];
      // opening hand (4) plus the top of the deck: the Ogre is in one of the first LIMITS.early cards
      const top = [...p.hand.map((h) => h.card), ...p.deck.slice(-(LIMITS.early - LIMITS.openingHand)).reverse()];
      expect(top, String(seed)).toContain('zz-ogre');
    }
  });

  it('an early card that is not in the deck is refused at setup', () => {
    expect(() => game([{ early: ['zz-ogre'] }, {}])).toThrow(/not in the deck/);
  });
});

describe('R-X5 Fittings', () => {
  it('a Fitting changes every copy of the card for its side only: stats, keywords, text and cost', () => {
    const fit = { name: 'Test Rig', text: '+1|+2, Vanguard, costs 1 less', power: 1, health: 2, kw: ['vanguard' as const], cost: -1 };
    const s = game([{ fittings: { 'zz-ogre': fit } }, {}]);
    const f = face(s, 0, 'zz-ogre');
    expect([f.power, f.health]).toEqual([6, 7]);
    expect(f.keywords).toContain('vanguard');
    expect(f.text).toContain('Test Rig');
    expect(costOf(s, 0, 'zz-ogre')).toBe(4);
    expect(face(s, 1, 'zz-ogre').power).toBe(5);
    expect(costOf(s, 1, 'zz-ogre')).toBe(5);
    const u = unit(s, 0, 'zz-ogre');
    expect(stats(s, u).power).toBe(6);
    expect(stats(s, u).keywords).toContain('vanguard');
  });

  it('a cost Fitting never takes a cost below 0', () => {
    const s = game([{ fittings: { 'zz-grunt': { name: 'Cheap', text: 'costs 3 less', cost: -3 } } }, {}]);
    expect(costOf(s, 0, 'zz-grunt')).toBe(0);
  });

  it('Fittings and Orders are open information in a view', () => {
    const o: Order = { id: 'o', name: 'Shown', text: 'Your units have +0|+1.', auras: [{ to: 'allies', health: 1 }] };
    const s = game([{ fittings: { 'zz-ogre': { name: 'Rig', text: '+1|+0', power: 1 } }, orders: [o] }, {}]);
    const v = view(s, 1);
    expect(v.players[0].fittings).toEqual(s.players[0].fittings);
    expect(v.players[0].orders).toEqual(s.players[0].orders);
  });
});

describe('R-X6 Orders', () => {
  it('an Order aura reaches its side\'s units (allies) or the other side\'s (enemies), filters included', () => {
    const o: Order = { id: 'o', name: 'Drill', text: '', auras: [{ to: 'allies', power: 1 }, { to: 'enemies', health: -1, filter: { minPower: 5 } }] };
    const s = game([{ orders: [o] }, {}]);
    const mine = unit(s, 0, 'zz-grunt');
    const ogre = unit(s, 1, 'zz-ogre');
    const grunt = unit(s, 1, 'zz-grunt');
    expect(stats(s, mine).power).toBe(3);
    expect(stats(s, ogre).health).toBe(4);
    expect(stats(s, grunt).health).toBe(2);
    expect(stats(s, grunt).power).toBe(2);
  });

  it('an Order cost change works through costOf', () => {
    const o: Order = { id: 'o', name: 'Crews', text: '', costAuras: [{ type: 'glyph', n: -1 }] };
    const s = game([{ orders: [o] }, {}]);
    expect(costOf(s, 0, 'zz-bolt')).toBe(1);
    expect(costOf(s, 0, 'zz-ogre')).toBe(5);
    expect(costOf(s, 1, 'zz-bolt')).toBe(2);
  });

  it('start Orders run once in round 1, dawn Orders every round, dusk Orders at each end of round, each logged', () => {
    const start: Order = { id: 's', name: 'Start', text: '', abilities: [{ on: 'start', ops: [{ op: 'damage', to: 'enemySpire', n: 2 }] }] };
    const dawn: Order = { id: 'd', name: 'Dawn', text: '', abilities: [{ on: 'dawn', ops: [{ op: 'damage', to: 'enemySpire', n: 1 }] }] };
    const dusk: Order = { id: 'k', name: 'Dusk', text: '', abilities: [{ on: 'dusk', ops: [{ op: 'heal', to: 'mySpire', n: 1 }] }] };
    const s = game([{ orders: [start, dawn] }, { orders: [dusk] }], { startSpire: [20, 10] });
    expect(s.round).toBe(1);
    expect(s.players[1].spire).toBe(10 - 2 - 1);
    expect(s.log.filter((e) => e.k === 'order').map((e) => e.s)).toEqual(['Start', 'Dawn']);
    // both pass: the round ends, dusk repairs seat 1, round 2's dawn hits it again
    expect(applyAction(s, { type: 'pass' }).ok).toBe(true);
    expect(applyAction(s, { type: 'pass' }).ok).toBe(true);
    expect(s.round).toBe(2);
    expect(s.players[1].spire).toBe(7 + 1 - 1);
    expect(s.log.filter((e) => e.k === 'order').length).toBe(4);
    expect(s.log.some((e) => e.via === 'order:Dawn')).toBe(true);
  });

  it('an Order whose condition fails does nothing', () => {
    const o: Order = { id: 'c', name: 'Low', text: '', abilities: [{ on: 'dawn', cond: { c: 'spire', who: 'you', lte: 10 }, ops: [{ op: 'heal', to: 'mySpire', n: 1 }] }] };
    const s = game([{ orders: [o] }, {}], { startSpire: [15, 20] });
    expect(s.players[0].spire).toBe(15);
    expect(s.log.some((e) => e.k === 'order')).toBe(false);
  });

  it('an Order that needs a source unit or a target is refused at setup', () => {
    for (const to of ['self', 'target0', 'trigger', 'opposing', 'others'] as const) {
      const o: Order = { id: 'bad', name: 'Bad', text: '', abilities: [{ on: 'dawn', ops: [{ op: 'damage', to, n: 1 }] }] };
      expect(() => game([{ orders: [o] }, {}]), to).toThrow(/selector/);
    }
    const aura: Order = { id: 'bad', name: 'Bad', text: '', auras: [{ to: 'self', power: 1 }] };
    expect(() => game([{ orders: [aura] }, {}])).toThrow(/allies or enemies/);
  });
});
