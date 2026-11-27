// The premade decks (src/data/decks.ts): legal, distinct, covering the pool, and playable end to end.
import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import type { FactionId } from '../src/engine/types';
import { playGame, type Policy } from '../src/ai/arena';
import { chooseAction } from '../src/ai/ai';
import { BLACKWATER, collectible, HAND_BUILT, NEW_HERO_DECKS, premadeDecks } from '../src/data/decks';
import { def } from '../src/engine/query';
import { checkDeck, FACTIONS } from '../src/engine/validate';

const ai: Policy = (v, seat, rnd) => chooseAction(v, seat, 'normal', rnd);
const HAND = [BLACKWATER, ...HAND_BUILT, ...NEW_HERO_DECKS];
const handBuilt = (): ReturnType<typeof premadeDecks> => premadeDecks().filter((d) => HAND.some((h) => h.name === d.name));

describe('premade decks', () => {
  it('R-G1 every hand-built deck is legal (none is dropped by the filter)', () => {
    for (const d of HAND) {
      const cards = Object.entries(d.cards).flatMap(([id, n]) => Array<string>(n).fill(id));
      expect(checkDeck(cards).errors, d.name).toEqual([]);
    }
    expect(handBuilt().length).toBe(HAND.length);
    expect(HAND_BUILT.length).toBe(12);
    expect(NEW_HERO_DECKS.length).toBe(6);
  });
  it('the first six keep their names and old order (?decks= indices rely on it)', () => {
    expect(premadeDecks().slice(0, 6).map((d) => d.name)).toEqual(['Wall of Thorns', 'Foundry Squall', 'Cold Current', 'Skywatch', 'Wildfire Garden', 'Blackwater']);
  });
  it('names are unique, and every hand-built deck has a one-line plan with no numbers in it (rule 8)', () => {
    const names = premadeDecks().map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    for (const d of HAND) {
      expect(d.about.length, d.name).toBeGreaterThan(20);
      expect(d.about, d.name).not.toMatch(/\d/);
    }
  });
  it('no two premade decks share the same card list', () => {
    const keys = premadeDecks().map((d) => [...d.cards].sort().join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('all 15 faction pairs and at least one single-faction deck are offered', () => {
    const seen = new Set(premadeDecks().map((d) => checkDeck(d.cards).factions.sort().join('+')));
    for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) {
      expect(seen.has([FACTIONS[i], FACTIONS[j]].sort().join('+')), `${FACTIONS[i]}+${FACTIONS[j]}`).toBe(true);
    }
    expect([...seen].some((k) => !k.includes('+'))).toBe(true);
  });
  it('every hero leads a premade deck, and each of the original twelve leads at least two', () => {
    const originals = new Set(premadeDecks().slice(0, 18).flatMap((d) => d.cards));
    for (const h of collectible().filter((c) => c.type === 'hero')) {
      const n = premadeDecks().filter((d) => d.cards.includes(h.id)).length;
      expect(n, h.name).toBeGreaterThanOrEqual(originals.has(h.id) ? 2 : 1);
    }
  });
  it('hand-built decks use only cards of their own factions and carry at least 14 units', () => {
    for (const d of handBuilt()) {
      const fac = new Set<FactionId>(d.cards.map((id) => def(id).faction));
      expect(fac.size, d.name).toBeLessThanOrEqual(2);
      expect(d.cards.filter((id) => def(id).type !== 'glyph').length, d.name).toBeGreaterThanOrEqual(14);
    }
  });
  it('each hand-built deck plays a full AI game against the next one: invariants hold and it replays from the seed', () => {
    const decks = handBuilt();
    decks.forEach((d, i) => {
      const foe = decks[(i + 1) % decks.length];
      const r = playGame({ seed: 7000 + i, decks: [d.cards, foe.cards] }, [ai, ai], { checkReplay: true });
      expect(r.problems, `${d.name} vs ${foe.name}`).toEqual([]);
      expect(r.winner, `${d.name} vs ${foe.name}`).not.toBeNull();
    });
  }, 60_000);
});
