// Seeded RNG kept in the state (mulberry32), so a seed plus an action list replays exactly.
import type { GameState } from './types';

export function nextRandom(s: Pick<GameState, 'rng'>): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle<T>(s: Pick<GameState, 'rng'>, list: T[]): void {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
