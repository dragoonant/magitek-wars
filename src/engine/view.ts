// R-V1: what one seat is allowed to know. The AI only ever receives this (leak test: tests/view.test.ts).
import type { GameState, Seat } from './types';
import { other } from './query';

export function view(s: GameState, seat: Seat): GameState {
  const v = JSON.parse(JSON.stringify(s)) as GameState;
  const foe = v.players[other(seat)];
  foe.hand = foe.hand.map((h) => ({ iid: h.iid, card: '?' }));
  foe.deckList = [];
  for (const p of v.players) p.deck = p.deck.map(() => '?');
  v.rng = 1;
  return v;
}
