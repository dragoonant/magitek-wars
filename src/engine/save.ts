// Rule 22: one versioned envelope per save. The snapshot is what reopens; the action list rides
// along so a bug report still replays from the seed.
import type { Action, GameState, Setup } from './types';
import { applyAction, createGame } from './rules';
import { hasCard } from './query';

export const SAVE_KEY = 'magitek-wars.save';
export const SAVE_VERSION = 1;
export const GAME_ID = 'magitek-wars';

export interface SaveMeta {
  /** Deck names, seat 0 first. */
  deckNames: [string, string];
  difficulty: string;
  /** Free-form interface extras (never the presentation cursor). */
  ui?: Record<string, unknown>;
}

export interface SaveEnvelope {
  game: typeof GAME_ID;
  version: number;
  savedAt: string;
  setup: Setup;
  meta: SaveMeta;
  actions: Action[];
  snapshot: GameState;
}

export function makeSave(setup: Setup, meta: SaveMeta, actions: Action[], snapshot: GameState, now = new Date()): SaveEnvelope {
  return { game: GAME_ID, version: SAVE_VERSION, savedAt: now.toISOString(), setup, meta, actions, snapshot };
}

export type ReadResult = { ok: true; save: SaveEnvelope } | { ok: false; reason: string };

/** Never silent: a save that cannot be opened says why. */
export function readSave(text: string | null): ReadResult {
  if (text === null) return { ok: false, reason: 'none' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The saved game is unreadable (damaged data).' };
  }
  const e = raw as Partial<SaveEnvelope>;
  if (!e || typeof e !== 'object' || e.game !== GAME_ID) return { ok: false, reason: 'The saved data belongs to a different game.' };
  if (e.version !== SAVE_VERSION) return { ok: false, reason: `The saved game is from version ${String(e.version)} and this build reads version ${SAVE_VERSION}.` };
  const st = e.snapshot;
  if (!st || !Array.isArray(st.players) || st.players.length !== 2 || !e.setup || !Array.isArray(e.actions) || !e.meta) {
    return { ok: false, reason: 'The saved game is missing parts of its state.' };
  }
  const ids = new Set<string>();
  for (const p of st.players) {
    for (const c of [...p.deck, ...p.scrap, ...p.deckList]) ids.add(c);
    for (const h of p.hand) ids.add(h.card);
    for (const u of p.line) ids.add(u.card);
  }
  for (const it of st.stack) ids.add(it.card);
  const missing = [...ids].filter((id) => !hasCard(id));
  if (missing.length) return { ok: false, reason: `The saved game uses a card that is no longer in the game (${missing[0]}).` };
  if (st.phase === 'over') return { ok: false, reason: 'The saved game had already finished.' };
  return { ok: true, save: e as SaveEnvelope };
}

/** Rebuild a state from the seed and the action list (bug reports, replay test). */
export function replay(setup: Setup, actions: Action[]): { state: GameState; failedAt: number | null } {
  const state = createGame(setup);
  for (let i = 0; i < actions.length; i++) {
    if (!applyAction(state, actions[i]).ok) return { state, failedAt: i };
  }
  return { state, failedAt: null };
}
