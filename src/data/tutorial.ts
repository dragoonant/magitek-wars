// The guided first match: a fixed Setup and an ordered list of steps. The player may take exactly one action per
// step; the opponent never uses the AI here, it plays the scripted actions listed after each step.
// tests/tutorial.test.ts replays the whole script against the real engine.
import type { Action, GameState, Seat, Setup } from '../engine/types';

// ---------- the decks, in exact draw order (first = the card drawn first) ----------
// Opening hand = the first 4. Then one card per round: round 1 draws card 5, round 2 card 6, and so on.
// Cards are timed to arrive just before they are taught: Tailwind (round 3), Slag Bolt (4), Gale Surge (5).
export const TUTORIAL_DECK_YOU: string[] = [
  'storm-signalkite', 'storm-jax', 'storm-thunderkite', 'ember-moltenwarden',
  'storm-stormcaller', 'ember-pyrelancer', 'storm-tailwind', 'ember-slagbolt', 'storm-galesurge',
  'ember-ashrunner', 'ember-cinderscamp', 'ember-kilnhand', 'ember-overdrive', 'storm-flagbearer', 'storm-tickettaker',
  'ember-fuseguard', 'ember-pinprick', 'ember-scrapburst', 'ember-slagsmith', 'ember-sparkforge', 'storm-dispatcher',
  'storm-gustcaller', 'storm-railglider', 'storm-updraft', 'ember-arcwelder', 'ember-furnacebrute', 'ember-furnacetender',
  'ember-heatlance', 'ember-sparkcascade', 'ember-ventburst', 'storm-airmail', 'storm-crosswind', 'storm-galecourier',
  'storm-reroute', 'storm-skyhook', 'storm-sparkrider', 'storm-squadcaller', 'ember-blastminer', 'ember-cinderhail', 'storm-jetstream',
];

export const TUTORIAL_DECK_FOE: string[] = [
  'prism-lampkeeper', 'prism-tier-sovereign', 'coil-domewyrm', 'prism-crystal-dawn',
  'coil-canopy-titan', 'coil-spearhorn', 'prism-spire-mantle', 'prism-patch-the-pane',
  'coil-rootling', 'coil-sap-surge', 'coil-sprout-tender', 'coil-thornback-cub', 'prism-facet-initiate', 'prism-glasswarden',
  'prism-hold-the-line', 'coil-bristle', 'coil-duel-of-thorns', 'coil-hothouse-bloom', 'coil-sap-engine', 'coil-vinewhip',
  'prism-bracewright', 'prism-call-out', 'prism-mirror-ward', 'prism-pane-mender', 'prism-tierguard', 'coil-bloomcaller',
  'coil-crownmaw', 'coil-lash-out', 'coil-lashvine', 'coil-overgrowth', 'prism-choir-of-facets', 'prism-chorus-warden',
  'prism-crystal-bulwark', 'prism-lightwall-oath', 'prism-sentinel-lens', 'coil-grafting', 'coil-spore-herald', 'coil-tuskhide',
  'prism-aegis-colossus', 'prism-tier-rally',
];

export const TUTORIAL_NAMES: [string, string] = ['Foundry Squall (tutorial)', 'Practice opponent'];
export const TUTORIAL_HERO = 'storm-jax';

/** The engine takes the top of a deck from the END of the list, so the draw order is reversed. */
export function tutorialSetup(): Setup {
  return {
    seed: 4242,
    decks: [[...TUTORIAL_DECK_YOU].reverse(), [...TUTORIAL_DECK_FOE].reverse()],
    noShuffle: true,
    skipMulligan: true,
    first: 0,
  };
}

// ---------- script types ----------
/** A unit named by its card (there is never more than one of a card on a Line in this script). */
export interface Ref {
  card: string;
  seat: Seat;
}

/** What the player has to click, in order. The coach highlights the next click. */
export type Click =
  | { kind: 'play'; card: string; target?: Ref } // arm a hand card, then (if it has one) its target, else press Play
  | { kind: 'declare'; unit: Ref } // click one of your units to add it to the attack
  | { kind: 'block'; unit: Ref; att: Ref } // click your unit, then the attacker it blocks
  | { kind: 'button'; action: 'pass' | 'attack' | 'blocks' };

export type Focus = 'charge' | 'reserve' | 'initiative' | 'hero' | 'stack' | 'foe-spire';

export type OppAct =
  | { t: 'play'; card: string; targets?: Ref[] }
  | { t: 'declare'; card: string }
  | { t: 'attack' }
  | { t: 'blocks' }
  | { t: 'pass' };

export interface Step {
  id: string;
  topic: string;
  /** 2-3 short sentences. */
  text: string;
  click: Click;
  /** Things to point at that are not clicks (the Reserve cells, the stack, the hero chip). */
  focus?: Focus[];
  /** The ONE player action that is allowed at this step. */
  allow: (a: Action, s: GameState) => boolean;
  /** What to do instead, shown when the player does something else. */
  hint: string;
  /** The opponent's scripted actions that follow, in order. */
  after: OppAct[];
}

// ---------- lookups ----------
export function unitIid(s: GameState, ref: Ref): string | undefined {
  return s.players[ref.seat].line.find((u) => u.card === ref.card)?.iid;
}
export function handIid(s: GameState, seat: Seat, card: string): string | undefined {
  return s.players[seat].hand.find((h) => h.card === card)?.iid;
}
const cardOfHand = (s: GameState, seat: Seat, iid: string): string | undefined => s.players[seat].hand.find((h) => h.iid === iid)?.card;

// ---------- predicates over Action ----------
const playsCard =
  (card: string, target?: Ref) =>
  (a: Action, s: GameState): boolean => {
    if (a.type !== 'play' || cardOfHand(s, 0, a.iid) !== card) return false;
    if (!target) return (a.targets ?? []).length === 0;
    return (a.targets ?? []).length === 1 && a.targets![0] === unitIid(s, target);
  };
const declares =
  (unit: Ref) =>
  (a: Action, s: GameState): boolean =>
    a.type === 'declare' && a.duel === undefined && a.unit === unitIid(s, unit);
const blocks =
  (unit: Ref, att: Ref) =>
  (a: Action, s: GameState): boolean =>
    a.type === 'block' && a.unit === unitIid(s, unit) && a.att === unitIid(s, att);
const presses =
  (type: 'pass' | 'attack' | 'blocks') =>
  (a: Action): boolean =>
    a.type === type;

const me = (card: string): Ref => ({ card, seat: 0 });
const foe = (card: string): Ref => ({ card, seat: 1 });

const KITE = 'storm-signalkite';
const JAX = TUTORIAL_HERO;
const LAMP = 'prism-lampkeeper';
const HORN = 'coil-spearhorn';

export const TUTORIAL_STEPS: Step[] = [
  // ----- round 1: you hold the Initiative, 1 Charge -----
  {
    id: 'play-unit', topic: 'Charge',
    text: 'Welcome to Scrivenearth. The cyan Charge cells pay for units, and this round you have 1. Click Signal Kite in your hand, then press Play.',
    click: { kind: 'play', card: KITE }, focus: ['charge'], allow: playsCard(KITE),
    hint: 'Click Signal Kite in your hand, then press its Play button.',
    after: [{ t: 'play', card: LAMP }],
  },
  {
    id: 'pass-1', topic: 'Priority',
    text: 'Priority is the right to act, and it passes back and forth: you played, the opponent answered with a unit, and now it is yours again. Press Pass. When both of you pass in a row, the round ends.',
    click: { kind: 'button', action: 'pass' }, allow: presses('pass'),
    hint: 'Nothing else is worth doing this round. Press Pass.',
    after: [{ t: 'pass' }, { t: 'play', card: HORN }],
  },
  // ----- round 2: the opponent holds the Initiative, 2 Charge -----
  {
    id: 'play-hero', topic: 'Heroes',
    text: 'Round 2: you have 2 Charge. Jax Windlash is a hero with a goal, shown in the chip on your side: deal 8 damage to the enemy Spire and he Ascends into something stronger. Play him now.',
    click: { kind: 'play', card: JAX }, focus: ['hero'], allow: playsCard(JAX),
    hint: 'Click Jax Windlash in your hand, then press Play.',
    after: [{ t: 'pass' }],
  },
  {
    id: 'end-round-2', topic: 'Priority',
    text: 'The opponent passed, so your Pass now ends the round, and the button says so. Next round you hold the Initiative.',
    click: { kind: 'button', action: 'pass' }, allow: presses('pass'),
    hint: 'You have nothing to play. Press End round.',
    after: [],
  },
  // ----- round 3: your Initiative, 3 Charge -----
  {
    id: 'declare-jax', topic: 'Attack',
    text: 'Round 3: you hold the Initiative, so you may attack once this round. Click Jax to put him in the battle row.',
    click: { kind: 'declare', unit: me(JAX) }, focus: ['initiative'], allow: declares(me(JAX)),
    hint: 'Click Jax, your hero on the Line, to attack with him.',
    after: [],
  },
  {
    id: 'lock-attack', topic: 'Attack',
    text: 'Lock the attack in. The opponent then decides whether to block, and this opponent has two units that could.',
    click: { kind: 'button', action: 'attack' }, allow: presses('attack'),
    hint: 'Press the Attack button to lock in Jax.',
    after: [{ t: 'blocks' }],
  },
  {
    id: 'strike-1', topic: 'Combat window',
    text: 'The opponent chose not to block, so Jax will hit their Spire. Before strikes land both of you may cast glyphs; you have none worth casting, so press No response: strike.',
    click: { kind: 'button', action: 'pass' }, focus: ['foe-spire'], allow: presses('pass'),
    hint: 'Press No response: strike.',
    after: [{ t: 'pass' }, { t: 'pass' }],
  },
  {
    id: 'end-round-3', topic: 'Unspent Charge',
    text: 'Jax hit for 3, and his chip now shows 3 of 8. You still hold 3 unspent Charge. Pass to end the round: Charge you do not spend turns into Reserve, up to 3.',
    click: { kind: 'button', action: 'pass' }, focus: ['hero', 'charge'], allow: presses('pass'),
    hint: 'Press End round and watch your Reserve fill.',
    after: [{ t: 'declare', card: HORN }, { t: 'attack' }],
  },
  // ----- round 4: the opponent attacks -----
  {
    id: 'block', topic: 'Block',
    text: 'The opponent attacks with Spearhorn, a 2/2. Click Jax, then click Spearhorn in the battle row to block it. Left alone they would trade blows, but you have a trick.',
    click: { kind: 'block', unit: me(JAX), att: foe(HORN) }, allow: blocks(me(JAX), foe(HORN)),
    hint: 'Click Jax, then click Spearhorn in the battle row.',
    after: [],
  },
  {
    id: 'lock-blocks', topic: 'Block',
    text: 'The forecast under the pair shows who would fall. Press Lock blocks to continue.',
    click: { kind: 'button', action: 'blocks' }, allow: presses('blocks'),
    hint: 'Press Lock blocks.',
    after: [{ t: 'pass' }],
  },
  {
    id: 'flash', topic: 'Flash glyph',
    text: 'The window before the strikes is open to glyphs. A Flash glyph resolves at once and cannot be answered. Cast Tailwind on Jax: +1|+1 lets him win the fight, and it is paid from your amber Reserve.',
    click: { kind: 'play', card: 'storm-tailwind', target: me(JAX) }, focus: ['reserve'], allow: playsCard('storm-tailwind', me(JAX)),
    hint: 'Click Tailwind in your hand, then click Jax.',
    after: [],
  },
  {
    id: 'strike-2', topic: 'Combat window',
    text: 'Tailwind resolved immediately, and you kept priority. Press No response: strike and watch Jax win.',
    click: { kind: 'button', action: 'pass' }, allow: presses('pass'),
    hint: 'Press No response: strike.',
    after: [],
  },
  {
    id: 'swift', topic: 'Swift glyph',
    text: 'Swift glyphs wait on the stack, and the opponent may answer them. Cast Slag Bolt at their Lampkeeper to clear the way for your next attack.',
    click: { kind: 'play', card: 'ember-slagbolt', target: foe(LAMP) }, allow: playsCard('ember-slagbolt', foe(LAMP)),
    hint: 'Click Slag Bolt in your hand, then click the opponent\'s Lampkeeper.',
    after: [{ t: 'play', card: 'prism-patch-the-pane', targets: [foe(LAMP)] }],
  },
  {
    id: 'resolve', topic: 'The stack',
    text: 'The opponent answered with a glyph of their own, and it sits on top. When you pass with glyphs waiting, the whole stack resolves, newest first. Press Let it resolve.',
    click: { kind: 'button', action: 'pass' }, focus: ['stack'], allow: presses('pass'),
    hint: 'Press Let it resolve.',
    after: [{ t: 'pass' }],
  },
  {
    id: 'end-round-4', topic: 'Reserve',
    text: 'Both glyphs resolved and the Lampkeeper is gone. Reserve stays until a glyph spends it, and the Charge you leave over refills it, so pass and look at your Reserve next round.',
    click: { kind: 'button', action: 'pass' }, focus: ['reserve'], allow: presses('pass'),
    hint: 'Press End round.',
    after: [],
  },
  // ----- round 5: your Initiative, the finish -----
  {
    id: 'surge', topic: 'Reserve',
    text: 'Round 5: you hold the Initiative with 3 Reserve and 5 Charge. Gale Surge gives your units +2|+0 this round, and glyphs spend Reserve first, so it costs you no Charge. Cast it.',
    click: { kind: 'play', card: 'storm-galesurge' }, focus: ['reserve'], allow: playsCard('storm-galesurge'),
    hint: 'Click Gale Surge in your hand, then press Play.',
    after: [{ t: 'pass' }, { t: 'pass' }],
  },
  {
    id: 'declare-jax-2', topic: 'Ascend',
    text: 'Jax needs 5 more Spire damage to Ascend, and the surge gives him 5 power. Click Jax, then Signal Kite, to attack with both.',
    click: { kind: 'declare', unit: me(JAX) }, focus: ['hero'], allow: declares(me(JAX)),
    hint: 'Click Jax to add him to the attack.',
    after: [],
  },
  {
    id: 'declare-kite', topic: 'Ascend',
    text: 'Signal Kite is Aerial, so only Aerial or Spotter units could block it. Add it to the attack too.',
    click: { kind: 'declare', unit: me(KITE) }, allow: declares(me(KITE)),
    hint: 'Click Signal Kite to add it to the attack.',
    after: [],
  },
  {
    id: 'lock-attack-2', topic: 'Ascend',
    text: 'Lock in the attack. The opponent has no units left to block with.',
    click: { kind: 'button', action: 'attack' }, allow: presses('attack'),
    hint: 'Press Attack with 2.',
    after: [],
  },
  {
    id: 'strike-3', topic: 'Ascend',
    text: 'Press No response: strike. Eight damage in total is the line: when Jax crosses it he Ascends, right on the Line.',
    click: { kind: 'button', action: 'pass' }, focus: ['foe-spire'], allow: presses('pass'),
    hint: 'Press No response: strike.',
    after: [{ t: 'pass' }],
  },
];

// ---------- resolving the opponent's script ----------
export function resolveOpp(s: GameState, a: OppAct): Action | null {
  switch (a.t) {
    case 'pass': return { type: 'pass' };
    case 'attack': return { type: 'attack' };
    case 'blocks': return { type: 'blocks' };
    case 'declare': {
      const unit = unitIid(s, foe(a.card));
      return unit ? { type: 'declare', unit } : null;
    }
    case 'play': {
      const iid = handIid(s, 1, a.card);
      if (!iid) return null;
      const out: Action = { type: 'play', iid };
      if (a.targets?.length) {
        const ids = a.targets.map((r) => unitIid(s, r));
        if (ids.some((x) => x === undefined)) return null;
        out.targets = ids as string[];
      }
      return out;
    }
  }
}

// ---------- the flow: which step we are on, who acts next ----------
export type Gate = { ok: true } | { ok: false; why: string };

export class TutorialFlow {
  idx = 0;
  /** Scripted opponent actions waiting to be played. */
  queue: OppAct[] = [];
  steps: Step[];
  constructor(steps: Step[] = TUTORIAL_STEPS) {
    this.steps = steps;
  }
  get step(): Step | null {
    return this.steps[this.idx] ?? null;
  }
  get finished(): boolean {
    return this.idx >= this.steps.length;
  }
  /** May the player take this action now? */
  gate(a: Action, s: GameState): Gate {
    const st = this.step;
    if (!st) return { ok: false, why: 'The tutorial is over.' };
    if (this.queue.length > 0) return { ok: false, why: 'Wait for the opponent to finish.' };
    if (a.type === 'concede') return { ok: false, why: 'There is no conceding in the tutorial: use Skip tutorial.' };
    return st.allow(a, s) ? { ok: true } : { ok: false, why: st.hint };
  }
  /** The player's action went through: move on and queue the opponent's reply. */
  accepted(): void {
    const st = this.step;
    if (!st) return;
    this.queue = [...st.after];
    this.idx += 1;
  }
  /** The next scripted opponent action as a real Action, or null when there is none to play. */
  nextOpp(s: GameState): Action | null {
    if (this.queue.length === 0) return null;
    const a = resolveOpp(s, this.queue[0]);
    if (!a) throw new Error(`Tutorial script: the opponent cannot do ${JSON.stringify(this.queue[0])} right now`);
    this.queue.shift();
    return a;
  }
}
