import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { createGame, applyAction } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { face } from '../src/engine/query';
import { chooseAction } from '../src/ai/ai';
import { canDraw } from '../src/font';
import { premadeDecks } from '../src/data/decks';
import { END_REASONS, LOG_LINES, lineText } from '../src/match/text';
import { wrap } from '../src/gallery-text';

// The match screen prints every log line in the house font (src/match/text.ts). An unknown kind would throw.
describe('match text', () => {
  it('has a line for every log kind the engine emits', () => {
    const src = readFileSync('src/engine/rules.ts', 'utf8');
    const kinds = new Set([...src.matchAll(/\bk: '([a-zA-Z]+)'/g)].map((m) => m[1]));
    expect(kinds.size).toBeGreaterThan(30);
    for (const k of kinds) expect(LOG_LINES[k], k).toBeDefined();
  });

  it('every end reason is printable', () => {
    for (const r of Object.values(END_REASONS)) expect(canDraw(r.toUpperCase()), r).toBe(true);
  });

  it('every log line of real AI games is printable in the house font', () => {
    const decks = premadeDecks();
    for (let g = 0; g < 4; g++) {
      const s = createGame({ seed: 100 + g, decks: [decks[g * 2].cards, decks[g * 2 + 1].cards] });
      let n = 0;
      let rnd = 7 + g;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      while (s.phase !== 'over' && n++ < 3000) {
        const seat = s.priority;
        expect(applyAction(s, chooseAction(view(s, seat), seat, 'easy', r)).ok).toBe(true);
      }
      for (const e of s.log) {
        const line = lineText(e, (id) => face(s, e.seat ?? 0, id).name).toUpperCase();
        for (const l of wrap(line, 34)) expect(canDraw(l), l).toBe(true);
      }
    }
  });
});
