// The guided first match, replayed headless against the real engine: this is the proof that the script is consistent.
import './helpers';
import { describe, expect, it } from 'vitest';
import type { Action, GameState } from '../src/engine/types';
import { applyAction, createGame, legalActions } from '../src/engine/rules';
import { checkDeck } from '../src/engine/validate';
import { LIMITS } from '../src/engine/types';
import { TUTORIAL_DECK_FOE, TUTORIAL_DECK_YOU, TUTORIAL_HERO, TUTORIAL_STEPS, TutorialFlow, tutorialSetup } from '../src/data/tutorial';

const same = (a: Action, b: Action): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Run the opponent's queued replies; every one must be a legal action for seat 1 at that moment. */
function drainOpp(s: GameState, flow: TutorialFlow, where: string): void {
  let guard = 0;
  while (flow.queue.length > 0) {
    if (guard++ > 20) throw new Error(`${where}: opponent loop`);
    expect(s.priority, `${where}: it must be the opponent's priority to play ${JSON.stringify(flow.queue[0])}`).toBe(1);
    const a = flow.nextOpp(s)!;
    expect(legalActions(s).some((x) => same(x, a)), `${where}: opponent action ${JSON.stringify(a)} is legal`).toBe(true);
    const r = applyAction(s, a);
    expect(r.ok, `${where}: ${r.error ?? ''}`).toBe(true);
  }
}

describe('tutorial script', () => {
  it('both decks are legal 40-card decks and the setup is fixed', () => {
    expect(checkDeck(TUTORIAL_DECK_YOU).ok).toBe(true);
    expect(checkDeck(TUTORIAL_DECK_FOE).ok).toBe(true);
    expect(TUTORIAL_DECK_YOU).toHaveLength(LIMITS.deck);
    const st = tutorialSetup();
    expect(st.noShuffle).toBe(true);
    expect(st.skipMulligan).toBe(true);
    expect(st.first).toBe(0);
    // the first card listed is the first card drawn (4 in hand plus the round-1 draw)
    const g = createGame(st);
    expect(g.players[0].hand.map((h) => h.card)).toEqual(TUTORIAL_DECK_YOU.slice(0, 5));
  });

  it('replays end to end: every scripted action is legal, the hero Ascends on the last step, the game is not over', () => {
    const s = createGame(tutorialSetup());
    const flow = new TutorialFlow();
    expect(s.priority).toBe(0);
    let n = 0;
    while (flow.step) {
      const step = flow.step;
      const where = `step ${flow.idx + 1} (${step.id})`;
      expect(s.phase, `${where}: game over too early`).not.toBe('over');
      expect(s.priority, `${where}: it must be your move`).toBe(0);
      expect(s.players[0].ascended, `${where}: Ascended too early`).not.toContain(TUTORIAL_HERO);
      const legal = legalActions(s);
      const allowed = legal.filter((a) => step.allow(a, s));
      expect(allowed.length, `${where}: the allowed action must be legal`).toBeGreaterThan(0);
      // the gate refuses everything else, with the step's hint
      const others = legal.filter((a) => !step.allow(a, s));
      for (const a of others.slice(0, 40)) {
        const g = flow.gate(a, s);
        expect(g.ok).toBe(false);
        if (!g.ok) expect(g.why.length).toBeGreaterThan(5);
      }
      expect(flow.gate(allowed[0], s).ok).toBe(true);
      const r = applyAction(s, allowed[0]);
      expect(r.ok, `${where}: ${r.error ?? ''}`).toBe(true);
      flow.accepted();
      n += 1;
      if (flow.step) drainOpp(s, flow, where);
      else drainOpp(s, flow, where); // the last step's reply (a pass), if any
    }
    expect(n).toBe(TUTORIAL_STEPS.length);
    expect(s.players[0].ascended).toContain(TUTORIAL_HERO);
    expect(s.phase).not.toBe('over');
    expect(s.winner).toBeNull();
    expect(s.players[0].seen.spireDamage ?? 0).toBeGreaterThanOrEqual(8);
    expect(s.log.some((e) => e.k === 'ascend' && e.seat === 0 && e.card === TUTORIAL_HERO)).toBe(true);
  });

  it('every step has coach text of at most three short sentences, a hint, and a topic', () => {
    for (const st of TUTORIAL_STEPS) {
      expect(st.hint.length).toBeGreaterThan(5);
      expect(st.topic.length).toBeGreaterThan(2);
      const sentences = st.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, st.id).toBeLessThanOrEqual(3);
      expect(sentences.length, st.id).toBeGreaterThanOrEqual(2);
      expect(st.text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('covers the topics the owner asked for, in order', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.topic);
    const first = (t: string): number => ids.indexOf(t);
    const order = ['Charge', 'Priority', 'Attack', 'Block', 'Flash glyph', 'Swift glyph', 'The stack', 'Reserve', 'Ascend'];
    for (const t of order) expect(first(t), t).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < order.length; i++) expect(first(order[i]), `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(first(order[i - 1]));
  });

  it('the gate refuses a concede and waits while the opponent has queued actions', () => {
    const s = createGame(tutorialSetup());
    const flow = new TutorialFlow();
    expect(flow.gate({ type: 'concede' }, s).ok).toBe(false);
    flow.queue = [{ t: 'pass' }];
    expect(flow.gate({ type: 'pass' }, s).ok).toBe(false);
  });
});
