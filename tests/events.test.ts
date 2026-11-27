import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { canDraw } from '../src/font';
import { def } from '../src/engine/query';
import { BOSS_INTRO, EVENTS, cardFor, eventBoiler } from '../src/run/events';
import { MIN_DECK, chooseEvent, newRun, removeForEvent, type RunState } from '../src/run/run';

function atEvent(id: string, seed = 4): RunState {
  const r = newRun('storm', seed);
  r.phase = 'event';
  r.event = { id, result: [] };
  return r;
}

describe('spec 20 R-R11: events', () => {
  it('every title, line and choice label is printable in the house font', () => {
    for (const e of EVENTS) {
      expect(canDraw(e.title), e.id).toBe(true);
      for (const l of e.text) expect(canDraw(l.toUpperCase()), l).toBe(true);
      for (const c of e.choices) expect(canDraw(c.label), c.label).toBe(true);
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every boss introduction is printable, one for each faction', () => {
    expect(Object.keys(BOSS_INTRO).sort()).toEqual(['coil', 'ember', 'prism', 'storm', 'tide', 'under']);
    for (const b of Object.values(BOSS_INTRO)) for (const l of [b.who, ...b.lines]) expect(canDraw(l), l).toBe(true);
  });

  it('every choice prints the scrip price it charges', () => {
    for (const e of EVENTS) for (const c of e.choices) if (c.costScrip) expect(c.label, c.label).toContain(String(c.costScrip));
  });

  it('a priced choice is refused without the scrip, and paid with it', () => {
    const r = atEvent('broker-kite');
    r.scrip = 10;
    expect(chooseEvent(r, 0)).toMatch(/scrip/);
    expect(r.phase).toBe('event');
    r.scrip = 30;
    const before = r.deck.length;
    expect(chooseEvent(r, 0)).toBeNull();
    expect(r.scrip).toBe(10);
    expect(r.deck.length).toBe(before + 1);
    expect(def(r.deck[r.deck.length - 1]).cost).toBeGreaterThanOrEqual(3);
    expect(r.phase).toBe('map');
  });

  it('an event never takes the Boiler below 1 or above 20', () => {
    expect(eventBoiler(2, -4)).toBe(1);
    expect(eventBoiler(19, 6)).toBe(20);
    const r = atEvent('gloam-seep');
    r.boiler = 3;
    chooseEvent(r, 0);
    expect(r.boiler).toBe(1);
  });

  it('a remove outcome waits for the player to pick, and respects the minimum deck', () => {
    const r = atEvent('grey-chapel');
    chooseEvent(r, 0);
    expect(r.phase).toBe('eventRemove');
    const card = r.deck[3];
    const n = r.deck.length;
    removeForEvent(r, card);
    expect(r.deck.length).toBe(n - 1);
    expect(r.phase).toBe('map');
    const s = atEvent('grey-chapel');
    s.deck = s.deck.slice(0, MIN_DECK);
    chooseEvent(s, 0);
    expect(s.phase).toBe('map');
    expect(s.deck.length).toBe(MIN_DECK);
  });

  it('event cards are never heroes or tokens, and respect their pool', () => {
    for (let i = 0; i < 50; i++) {
      const roll = i / 50;
      const mine = cardFor('mine', 'coil', 0, roll);
      expect(def(mine).faction).toBe('coil');
      const other = cardFor('other', 'coil', 0, roll);
      expect(def(other).faction).not.toBe('coil');
      for (const id of [mine, other, cardFor('any', 'coil', 4, roll)]) {
        expect(def(id).type).not.toBe('hero');
        expect(def(id).token ?? false).toBe(false);
      }
    }
  });
});
