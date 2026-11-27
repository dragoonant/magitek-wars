// AI entry point. The AI is only ever given view(state, seat) (R-V1).
import type { Action, GameState, Seat } from '../engine/types';
import { legalActions } from '../engine/rules';
import { decide } from './brain';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Apprentice', blurb: 'Plays its cards but trades poorly and rarely holds glyphs back.' },
  { id: 'normal', name: 'Adept', blurb: 'Weighs every attack and block and builds toward its heroes.' },
  { id: 'hard', name: 'Archon', blurb: 'Looks a move further ahead and plays around your open Charge.' },
];

/** A uniformly random legal action (never concedes). The control for benches and flow tests. */
export function randomAction(v: GameState, rnd: () => number): Action {
  const acts = legalActions(v);
  if (acts.length === 0) throw new Error('no legal action: the game is over');
  return acts[Math.floor(rnd() * acts.length)];
}

/** The AI's move for `seat`, given only that seat's view. */
export function chooseAction(v: GameState, seat: Seat, level: Difficulty, rnd: () => number = Math.random): Action {
  return decide(v, seat, level, rnd);
}
