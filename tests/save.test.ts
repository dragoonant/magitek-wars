// Owner rule 22: the save envelope round-trips, replays, and refuses bad data with a reason.
import { describe, expect, it } from 'vitest';
import './helpers';
import type { Action } from '../src/engine/types';
import { applyAction, cloneState, createGame, legalActions } from '../src/engine/rules';
import { GAME_ID, makeSave, readSave, replay } from '../src/engine/save';

const deck = [...Array<string>(20).fill('zz-grunt'), ...Array<string>(10).fill('zz-ogre'), ...Array<string>(10).fill('zz-bolt')];
const setup = { seed: 42, decks: [deck, deck] as [string[], string[]] };
const meta = { deckNames: ['A', 'B'] as [string, string], difficulty: 'normal' };

function playSome(n: number): { state: ReturnType<typeof createGame>; actions: Action[] } {
  const state = createGame(setup);
  const actions: Action[] = [];
  let x = 7;
  while (actions.length < n && state.phase !== 'over') {
    const acts = legalActions(state);
    x = (x * 1103515245 + 12345) >>> 0;
    const a = acts[x % acts.length];
    applyAction(state, a);
    actions.push(a);
  }
  return { state, actions };
}

describe('save (rule 22)', () => {
  it('round-trips through JSON and reopens on the same spot', () => {
    const { state, actions } = playSome(60);
    const text = JSON.stringify(makeSave(setup, meta, actions, state));
    const r = readSave(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.save.snapshot)).toBe(JSON.stringify(state));
  });
  it('the seed and action list replay to the snapshot', () => {
    const { state, actions } = playSome(80);
    const rp = replay(setup, actions);
    expect(rp.failedAt).toBeNull();
    expect(JSON.stringify(rp.state)).toBe(JSON.stringify(state));
  });
  it('playing on from a reopened snapshot matches never having saved', () => {
    const a = playSome(40);
    const reopened = cloneState(a.state);
    const b = playSome(90);
    let x = 0;
    for (const act of b.actions.slice(40)) { applyAction(reopened, act); x++; }
    expect(x).toBeGreaterThan(0);
    expect(JSON.stringify(reopened)).toBe(JSON.stringify(b.state));
  });
  it('refuses bad saves with a reason', () => {
    const { state, actions } = playSome(10);
    const good = makeSave(setup, meta, actions, state);
    expect(readSave(null)).toEqual({ ok: false, reason: 'none' });
    expect(readSave('{not json')).toMatchObject({ ok: false, reason: expect.stringMatching(/unreadable/) });
    expect(readSave(JSON.stringify({ ...good, game: 'other' }))).toMatchObject({ ok: false, reason: expect.stringMatching(/different game/) });
    expect(readSave(JSON.stringify({ ...good, version: 99 }))).toMatchObject({ ok: false, reason: expect.stringMatching(/version 99/) });
    const missing = cloneState(state);
    missing.players[0].deck.push('gone-card');
    expect(readSave(JSON.stringify({ ...good, snapshot: missing }))).toMatchObject({ ok: false, reason: expect.stringMatching(/gone-card/) });
    const done = cloneState(state);
    done.phase = 'over';
    expect(readSave(JSON.stringify({ ...good, snapshot: done }))).toMatchObject({ ok: false, reason: expect.stringMatching(/finished/) });
    expect(good.game).toBe(GAME_ID);
  });
});
