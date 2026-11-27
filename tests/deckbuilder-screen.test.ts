import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { LIMITS } from '../src/engine/types';
import { def } from '../src/engine/query';
import { checkDeck } from '../src/engine/validate';
import { autoDeck, collectible } from '../src/data/decks';
import { canDraw } from '../src/font';
import { DECKS_KEY, countOf, loadDecks, saveDecks } from '../src/deckbuilder/model';
import {
  NAME_MAX, addOne, bucketOf, canAdd, deckStatus, editName, fillDeck, fillFactions, finalName, groupDeck, nameIdeas,
  orderDeck, poolCards, removeDeck, removeOne, savedLegalDecks, upsertDeck,
} from '../src/deckbuilder/edit';

const memStore = () => {
  const mem = new Map<string, string>();
  return { mem, store: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } } };
};

describe('deck builder editing (R-G1)', () => {
  it('add and remove one copy, with the reason when refused', () => {
    let cards: string[] = [];
    for (let i = 0; i < LIMITS.copies; i++) {
      const r = addOne(cards, 'tide-maren');
      expect(r.problem).toBeNull();
      cards = r.cards;
    }
    const over = addOne(cards, 'tide-maren');
    expect(over.problem).toMatch(/copies/);
    expect(over.cards).toBe(cards);
    expect(removeOne(cards, 'tide-maren').cards).toHaveLength(LIMITS.copies - 1);
    expect(removeOne(cards, 'storm-jax').problem).toMatch(/not in the deck/);
    expect(addOne(cards, 'under-wirerat').problem).toMatch(/Tokens/);
  });

  it('a saved id the data no longer has is kept, reported, and does not crash adds', () => {
    const cards = ['zz-gone', 'tide-maren'];
    expect(orderDeck(cards)).toEqual(['tide-maren', 'zz-gone']);
    expect(canAdd(cards, 'tide-maren')).toBeNull();
    const r = addOne(cards, 'tide-sluicepage');
    expect(r.cards).toContain('zz-gone');
    const groups = groupDeck(r.cards);
    expect(groups.at(-1)!.label).toBe('UNKNOWN CARDS');
    expect(groups.at(-1)!.rows[0]).toMatchObject({ id: 'zz-gone', known: false, n: 1 });
    expect(deckStatus(r.cards).errors.some((e) => /Unknown card zz-gone/.test(e))).toBe(true);
    expect(removeOne(r.cards, 'zz-gone').cards).not.toContain('zz-gone');
  });

  it('a full deck refuses with the size reason even with unknown ids', () => {
    const full = [...autoDeck('tide', 'under').slice(0, LIMITS.deck - 1), 'zz-gone'];
    expect(canAdd(full, 'tide-maren')).toMatch(/full/);
  });

  it('the pool filters by faction, cost bucket and type, collectible only', () => {
    const all = poolCards({ faction: null, cost: null, type: null });
    expect(all.length).toBe(collectible().length);
    expect(all.every((c) => !c.token && !c.unimplemented)).toBe(true);
    const f = poolCards({ faction: 'coil', cost: null, type: 'hero' });
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((c) => c.faction === 'coil' && c.type === 'hero')).toBe(true);
    const big = poolCards({ faction: null, cost: 7, type: null });
    expect(big.every((c) => c.cost >= 7)).toBe(true);
    expect(poolCards({ faction: null, cost: 2, type: 'glyph' }).every((c) => c.cost === 2 && c.type === 'glyph')).toBe(true);
    const buckets = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => poolCards({ faction: null, cost: b, type: null }).length);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(all.length);
  });

  it('groups the deck by cost with counts that add up', () => {
    const cards = autoDeck('prism', 'coil');
    const groups = groupDeck(cards);
    expect(groups.reduce((a, g) => a + g.total, 0)).toBe(cards.length);
    for (const g of groups) {
      expect(g.rows.reduce((a, r) => a + r.n, 0)).toBe(g.total);
      for (const r of g.rows) {
        expect(r.n).toBe(countOf(cards, r.id));
        expect(g.label).toBe(`COST ${bucketOf(def(r.id).cost) === 7 ? '7+' : bucketOf(def(r.id).cost)}`);
      }
    }
  });

  it('fill completes a legal deck from the chosen factions and keeps every card already there', () => {
    let start: string[] = [];
    for (const id of ['tide-ilvane', 'tide-ilvane', 'coil-tuskhide', 'coil-tuskhide', 'coil-tuskhide']) start = addOne(start, id).cards;
    const f = fillFactions(start, null);
    expect(f.problem).toBeNull();
    expect([...f.factions].sort()).toEqual(['coil', 'tide']);
    const r = fillDeck(start, f.factions);
    expect(r.problem).toBeNull();
    expect(r.cards).toHaveLength(LIMITS.deck);
    expect(checkDeck(r.cards).ok).toBe(true);
    for (const id of new Set(start)) expect(countOf(r.cards, id)).toBeGreaterThanOrEqual(countOf(start, id));
    expect(r.added).toHaveLength(LIMITS.deck - start.length);
  });

  it('fill from empty matches autoDeck; one faction works; the tab adds a second faction', () => {
    const r = fillDeck([], ['storm', 'ember']);
    expect([...r.cards].sort()).toEqual([...autoDeck('storm', 'ember')].sort());
    const one = fillDeck([], ['under']);
    expect(checkDeck(one.cards).ok).toBe(true);
    expect(checkDeck(one.cards).factions).toEqual(['under']);
    expect(fillFactions([], null).problem).toMatch(/faction tab/);
    expect(fillFactions(['tide-maren'], 'coil').factions).toEqual(['tide', 'coil']);
    expect(fillFactions(['tide-maren', 'coil-aruvi'], 'storm').factions).toEqual(['tide', 'coil']);
  });

  it('fill on a deck already over the faction limit refuses with the reason', () => {
    const bad = ['tide-maren', 'coil-aruvi', 'storm-jax'];
    expect(fillFactions(bad, null).problem).toMatch(/3 factions/);
  });

  it('fill around six foreign hero cards still reaches 40 without breaking a limit', () => {
    let start: string[] = [];
    for (const id of ['tide-sefa', 'tide-sefa', 'tide-sefa', 'tide-corra', 'tide-corra', 'tide-corra']) start = addOne(start, id).cards;
    const r = fillDeck(start, ['tide']);
    expect(r.problem).toBeNull();
    expect(checkDeck(r.cards).ok).toBe(true);
  });

  it('name ideas are drawable, short enough, and avoid taken names', () => {
    const cards = autoDeck('prism', 'under');
    const ideas = nameIdeas(cards, []);
    expect(ideas.length).toBeGreaterThan(3);
    for (const n of ideas) {
      expect(canDraw(n), n).toBe(true);
      expect(n.length).toBeLessThanOrEqual(NAME_MAX);
    }
    const next = nameIdeas(cards, [ideas[0]]);
    expect(next).not.toContain(ideas[0]);
    expect(nameIdeas([], []).length).toBeGreaterThan(0);
    const allTaken = nameIdeas([], nameIdeas([], []));
    expect(allTaken).toHaveLength(1);
    expect(canDraw(allTaken[0])).toBe(true);
  });

  it('typing a name: letters, digits, single spaces, backspace, length cap', () => {
    let n = '';
    for (const code of ['KeyI', 'KeyR', 'Space', 'Space', 'KeyO', 'Digit7', 'Numpad2', 'ShiftLeft']) n = editName(n, code) ?? n;
    expect(n).toBe('IR O72');
    expect(editName(n, 'Backspace')).toBe('IR O7');
    expect(editName('', 'Space')).toBe('');
    expect(editName(n, 'Enter')).toBeNull();
    expect(editName('A'.repeat(NAME_MAX), 'KeyB')).toHaveLength(NAME_MAX);
    expect(finalName('  IRON   GATE ')).toBe('IRON GATE');
  });

  it('saved decks: upsert replaces by name, delete removes, illegal ones are saved and listed as ILLEGAL', () => {
    const legal = autoDeck('tide', 'under');
    let decks = upsertDeck([], { name: 'A', cards: legal }).decks;
    const again = upsertDeck(decks, { name: 'A', cards: legal.slice(1) });
    expect(again.replaced).toBe(true);
    expect(again.decks).toHaveLength(1);
    decks = upsertDeck(again.decks, { name: 'B', cards: legal }).decks;
    expect(removeDeck(decks, 'A').map((d) => d.name)).toEqual(['B']);
    expect(deckStatus(legal.slice(1))).toMatchObject({ legal: false, label: 'ILLEGAL' });
    expect(deckStatus(legal.slice(1)).reason).toMatch(/exactly 40/);
  });

  it('savedLegalDecks lists only saved decks that pass checkDeck, through the model storage key', () => {
    const { mem, store } = memStore();
    expect(savedLegalDecks(store)).toEqual([]);
    const legal = autoDeck('coil', 'storm');
    expect(saveDecks(store, [{ name: 'GOOD', cards: legal }, { name: 'SHORT', cards: legal.slice(5) }, { name: 'GONE', cards: [...legal.slice(1), 'zz-gone'] }])).toBeNull();
    expect(mem.has(DECKS_KEY)).toBe(true);
    expect(loadDecks(store).decks).toHaveLength(3);
    expect(savedLegalDecks(store)).toEqual([{ name: 'GOOD', cards: legal }]);
    mem.set(DECKS_KEY, '{oops');
    expect(savedLegalDecks(store)).toEqual([]);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(savedLegalDecks(broken)).toEqual([]);
  });

  it('every pool name and rule line the screen shows is drawable', () => {
    for (const c of collectible()) expect(canDraw(c.name.toUpperCase()), c.id).toBe(true);
  });
});
