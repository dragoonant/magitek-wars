import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { createGame, applyAction } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { def } from '../src/engine/query';
import { chooseAction } from '../src/ai/ai';
import type { FactionId } from '../src/engine/types';
import { FLOORS, LEADS, MIN_DECK, STARTER_SIZE, buy, choices, enter, finishBattle, leaveSupply, newRun, rest, starterDeck, takeReward, type RunState } from '../src/run/run';

const FACTIONS: FactionId[] = ['prism', 'ember', 'tide', 'coil', 'storm', 'under'];

describe('spec 20: the campaign run', () => {
  it('R-R2 every starter deck is 24 cards of its faction with two copies of the lead', () => {
    for (const f of FACTIONS) {
      const d = starterDeck(f);
      expect(d.length, f).toBe(STARTER_SIZE);
      expect(d.filter((id) => id === LEADS[f]).length, f).toBe(2);
      for (const id of d) expect(def(id).faction, id).toBe(f);
      for (const id of d) expect(def(id).token ?? false, id).toBe(false);
    }
  });

  it('R-R1 a run replays from its seed', () => {
    const a = newRun('coil', 42);
    const b = newRun('coil', 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    enter(a, a.map.floors[0][0].id);
    enter(b, b.map.floors[0][0].id);
    expect(JSON.stringify(a.battle)).toBe(JSON.stringify(b.battle));
  });

  it('R-R3 every node of every floor can be reached, and floor 7 is the boss', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = newRun('prism', seed);
      const f = r.map.floors;
      expect(f.length).toBe(FLOORS);
      expect(f[FLOORS - 1].map((n) => n.kind)).toEqual(['boss']);
      expect(f[0].every((n) => n.kind === 'skirmish')).toBe(true);
      expect(f[FLOORS - 2].some((n) => n.kind === 'rest')).toBe(true);
      for (let i = 1; i < f.length; i++) {
        for (const n of f[i]) expect(f[i - 1].some((p) => p.links.includes(n.id)), n.id).toBe(true);
      }
      for (let i = 0; i < f.length - 1; i++) for (const n of f[i]) expect(n.links.length, n.id).toBeGreaterThan(0);
      for (const n of f[1]) expect(n.kind, n.id).not.toBe('elite');
    }
  });

  it('R-R3 only linked nodes can be entered', () => {
    const r = newRun('prism', 2);
    expect(() => enter(r, r.map.floors[2][0].id)).toThrow();
  });

  it('R-R5 a battle starts both Boilers from the run, and the engine accepts the setup (R-X3)', () => {
    const r = newRun('storm', 7);
    r.boiler = 13;
    enter(r, r.map.floors[0][0].id);
    const s = createGame(r.battle!.setup);
    expect(s.players[0].spire).toBe(13);
    expect(s.players[1].spire).toBe(10);
    expect(() => createGame({ ...r.battle!.setup, startSpire: [0, 10] })).toThrow();
    expect(() => createGame({ ...r.battle!.setup, startSpire: [21, 10] })).toThrow();
  });

  it('R-R7 a win pays scrip and offers three cards; a draw ends the run', () => {
    const r = newRun('under', 3);
    enter(r, r.map.floors[0][0].id);
    finishBattle(r, 0, 15);
    expect(r.phase).toBe('reward');
    expect(r.scrip).toBe(10);
    expect(r.boiler).toBe(15);
    expect(r.offer!.cards.length).toBe(3);
    for (const id of r.offer!.cards) expect(def(id).type).not.toBe('hero');
    const card = r.offer!.cards[0];
    takeReward(r, card);
    expect(r.deck).toContain(card);
    expect(r.deck.length).toBe(STARTER_SIZE + 1);
    expect(r.phase).toBe('map');
    const l = newRun('under', 3);
    enter(l, l.map.floors[0][0].id);
    finishBattle(l, 'draw', 4);
    expect(l.phase).toBe('lost');
  });

  it('R-R4 rest repairs up to 20 or removes a card, never below the minimum deck', () => {
    const r = newRun('tide', 5);
    r.phase = 'rest';
    r.boiler = 17;
    rest(r, { kind: 'repair' });
    expect(r.boiler).toBe(20);
    r.phase = 'rest';
    rest(r, { kind: 'remove', card: r.deck[5] });
    expect(r.deck.length).toBe(STARTER_SIZE - 1);
    r.deck = r.deck.slice(0, MIN_DECK);
    r.phase = 'rest';
    expect(() => rest(r, { kind: 'remove', card: r.deck[0] })).toThrow();
  });

  it('R-R8 supply sells cards and one repair for scrip, refusing what cannot be paid', () => {
    const r = newRun('ember', 9);
    r.phase = 'supply';
    r.shop = { cards: [{ id: 'ember-kilnhand', price: 15, sold: false }], repairSold: false };
    expect(buy(r, 'ember-kilnhand')).toMatch(/scrip/);
    r.scrip = 40;
    r.boiler = 10;
    expect(buy(r, 'ember-kilnhand')).toBeNull();
    expect(buy(r, 'ember-kilnhand')).toMatch(/not for sale/);
    expect(buy(r, 'repair')).toBeNull();
    expect(r.boiler).toBe(15);
    expect(r.scrip).toBe(5);
    expect(buy(r, 'repair')).toMatch(/already/);
    leaveSupply(r);
    expect(r.phase).toBe('map');
  });

  it('a whole first act plays out with the AI on both seats', () => {
    const r: RunState = newRun('coil', 11);
    let guard = 0;
    while (r.act === 1 && r.phase !== 'lost' && guard++ < 20) {
      const opts = choices(r);
      expect(opts.length).toBeGreaterThan(0);
      enter(r, opts[0].id);
      if (r.phase === 'battle') {
        const s = createGame(r.battle!.setup);
        let n = 0;
        let x = 1;
        const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
        while (s.phase !== 'over' && n++ < 4000) {
          const seat = s.priority;
          expect(applyAction(s, chooseAction(view(s, seat), seat, seat === 0 ? 'hard' : r.battle!.level, rnd)).ok).toBe(true);
        }
        finishBattle(r, s.winner, s.players[0].spire);
        if ((r.phase as string) === 'reward') takeReward(r, r.offer!.cards[0]);
      } else if (r.phase === 'rest') rest(r, { kind: 'repair' });
      else if (r.phase === 'supply') leaveSupply(r);
    }
    expect(['lost', 'map']).toContain(r.phase);
    if (r.phase === 'map') expect(r.act).toBe(2);
  });
});
