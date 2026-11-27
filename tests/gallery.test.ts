import { describe, expect, it } from 'vitest';
import { canDraw } from '../src/font';
import { ALL_CARDS } from '../src/data/cards/index';
import { CARD_ART } from '../src/data/cardart';
import { FACTIONS } from '../src/data/factions';
import { wrap } from '../src/gallery-text';

// The card gallery shows every card's proposed name and engine text in the house font (ART-STYLE section 5).
describe('card gallery data', () => {
  it('every card has a manifest entry in its faction, and nothing else does', () => {
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    for (const c of ALL_CARDS) {
      const a = CARD_ART[c.id];
      expect(a, c.id).toBeDefined();
      expect(FACTIONS.find((f) => f.engine === c.faction)?.key, c.id).toBe(a.faction);
      expect(Boolean(a.ascendedName), c.id).toBe(Boolean(c.ascended));
    }
    for (const id of Object.keys(CARD_ART)) expect(ids.has(id), id).toBe(true);
  });
  it('the font draws every name and every line of text', () => {
    for (const c of ALL_CARDS) {
      const a = CARD_ART[c.id];
      for (const s of [a.name, a.ascendedName ?? '', c.text, c.ascended?.text ?? '']) {
        for (const line of wrap(s.toUpperCase(), 40)) expect(canDraw(line), `${c.id}: ${line}`).toBe(true);
      }
    }
  });
  it('the font draws every faction name', () => {
    for (const f of FACTIONS) expect(canDraw(f.name), f.name).toBe(true);
  });
  it('wrap keeps every line within the width and loses no words', () => {
    for (const c of ALL_CARDS) {
      const lines = wrap(c.text.toUpperCase(), 40);
      for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(40);
      expect(lines.join(' ').split(/\s+/).filter(Boolean)).toEqual(c.text.toUpperCase().split(/\s+/).filter(Boolean));
    }
  });
});
