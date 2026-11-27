// A match: setup, live state, the action list, autosave after every move (rule 22), and the AI's turn loop.
// The human is seat 0. The AI (seat 1) only ever receives view(state, 1) (CLAUDE.md).
import type { Action, GameState, Result, Seat, Setup } from '../engine/types';
import { applyAction, createGame } from '../engine/rules';
import { view } from '../engine/view';
import { makeSave, readSave, SAVE_KEY, type SaveEnvelope, type SaveMeta } from '../engine/save';
import { chooseAction, type Difficulty } from '../ai/ai';

export type StoredSave = { kind: 'none' } | { kind: 'ok'; save: SaveEnvelope } | { kind: 'bad'; reason: string } | { kind: 'nostorage' };

export function readStoredSave(): StoredSave {
  let text: string | null;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch {
    return { kind: 'nostorage' };
  }
  if (text === null) return { kind: 'none' };
  const r = readSave(text);
  return r.ok ? { kind: 'ok', save: r.save } : { kind: 'bad', reason: r.reason };
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* no storage: nothing to clear */
  }
}

/** Seeded RNG for the AI's own choices, so a match replays the same way from its seed. */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Session {
  storageOk = true;
  private readonly rnd: () => number;
  /** Set when the match belongs to a roguelike run: never written to the match save slot. */
  ephemeral = false;

  private constructor(public setup: Setup, public meta: SaveMeta, public actions: Action[], public state: GameState) {
    // a resumed match reseeds from its length: the AI's later choices need not match an unbroken game
    this.rnd = rngFrom((setup.seed ^ 0x9e3779b9 ^ actions.length) >>> 0);
  }

  static start(setup: Setup, meta: SaveMeta, ephemeral = false): Session {
    const s = new Session(setup, meta, [], createGame(setup));
    s.ephemeral = ephemeral;
    s.persist();
    return s;
  }

  static fromSave(env: SaveEnvelope): Session {
    return new Session(env.setup, env.meta, env.actions, env.snapshot);
  }

  get difficulty(): Difficulty {
    return this.meta.difficulty as Difficulty;
  }

  /** Apply an action for whoever has priority. A refused action changes nothing and is not recorded. */
  apply(a: Action): Result {
    const r = applyAction(this.state, a);
    if (!r.ok) return r;
    this.actions.push(a);
    if (this.state.phase === 'over') {
      if (!this.ephemeral) clearSave();
    } else this.persist();
    return r;
  }

  /** The AI's move for a seat: chosen from that seat's view only. Seat 0 only in play-test mode. */
  aiAction(seat: Seat = 1): Action {
    return chooseAction(view(this.state, seat), seat, this.difficulty, this.rnd);
  }

  persist(): void {
    if (this.ephemeral) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave(this.setup, this.meta, this.actions, this.state)));
    } catch {
      this.storageOk = false;
    }
  }
}
