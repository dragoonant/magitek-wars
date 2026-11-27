import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { addCard, deckStats, exportDeck, importDeck, loadDecks, removeCard, saveDecks, whyNotAdd, DECKS_KEY } from '../src/deckbuilder/model';
import { autoDeck } from '../src/data/decks';

describe('deck builder model (R-G1)', () => {
  it('enforces copies, factions, hero cards and deck size with reasons', () => {
    let d: string[] = [];
    for (let i = 0; i < 3; i++) d = addCard(d, 'tide-maren');
    expect(whyNotAdd(d, 'tide-maren')).toMatch(/3 copies/);
    d = addCard(d, 'under-sable');
    expect(whyNotAdd(d, 'storm-jax')).toMatch(/2 factions/);
    d = addCard(addCard(d, 'under-sable'), 'under-sable');
    expect(whyNotAdd(d, 'tide-ilvane')).toMatch(/6 hero cards/);
    expect(whyNotAdd(d, 'under-wirerat')).toMatch(/Tokens/);
    expect(removeCard(d, 'tide-maren').length).toBe(5);
    const full = autoDeck('tide', 'under');
    expect(whyNotAdd(full, 'tide-ilvane')).toMatch(/full/);
  });
  it('stats and export/import round trip', () => {
    const cards = autoDeck('prism', 'coil');
    const st = deckStats(cards);
    expect(st.check.ok).toBe(true);
    expect(st.curve.reduce((a, b) => a + b, 0)).toBe(40);
    expect(st.units + st.glyphs + st.heroes).toBe(40);
    const back = importDeck(exportDeck({ name: 'Wall', cards }));
    expect(back.problem).toBeNull();
    expect([...back.deck!.cards].sort()).toEqual([...cards].sort());
    expect(importDeck('junk').problem).toMatch(/not a deck code/);
    expect(importDeck('x|nope-card*2').problem).toMatch(/invalid/);
  });
  it('saved decks: reads, reports damage, reports refused storage', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(loadDecks(store)).toEqual({ decks: [], problem: null });
    expect(saveDecks(store, [{ name: 'A', cards: ['tide-maren'] }])).toBeNull();
    expect(loadDecks(store).decks[0].name).toBe('A');
    mem.set(DECKS_KEY, '{oops');
    expect(loadDecks(store).problem).toMatch(/unreadable/);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadDecks(broken).problem).toMatch(/not storing/);
    expect(saveDecks(broken, [])).toMatch(/not storing/);
  });
});
