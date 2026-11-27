# Card authoring guide

> Copied from Annals of Scrivenearth at 8b4ebac (PLAN D4). Faction, card and hero names are Annals' until the
> re-skin (PLAN D12); the rules and numbers carry over as they are.

Cards are data (`CardDef` in `src/engine/types.ts`; read that file first, it is the contract). One file per
faction in `src/data/cards/<faction>.ts`, one test file per faction in `tests/cards/<faction>.test.ts`.
The two heroes and their tokens at the top of each faction file are worked examples: copy their shape.

## Hard rules
1. **Text matches data exactly.** `text` is our own wording of what the data does: every number, keyword, trigger and
   target. Start with the keywords ("Plated, Spotter."), then abilities by ability word ("Deploy:", "Shatter:",
   "Strike:", "Assault:", "Dawn:", "Dusk:"), or a plain "When ..." sentence for the other triggers. Stats are written
   `+1|+1` (power|health). Use "this round" for `dur: 'round'`. Use "Resonant:" for `{ c: 'resonant' }`.
2. **Never invent a primitive.** If a design needs something `Op`, `Sel`, `Cond`, `Trigger` or `Amount` cannot say,
   redesign the card so the data can say it. Do not edit `src/engine/**`. Note the wish in your hand-back file.
3. **Triggered abilities never choose targets.** Only `deploy` abilities and glyphs take `targets`. Other triggers use
   selectors such as `strongestEnemy`, `randomEnemy`, `enemies`, `opposing`, `trigger`.
4. **Original content only.** Names, text and ideas are ours. No names, characters, card text or card designs taken
   from any published game, book, film or show. No real people.
5. **One behaviour test per card**, driving the real engine through `tests/helpers.ts` (`board`, `play`, `attack`,
   `resolveCombat`, `pass`, `unit`, `st`). Put the card on a board, play it through `applyAction`, and assert the side
   effect (a stat, a Spire total, a hand size, a log kind), not the data. Test names start with the card id. A test
   must be able to fail: check a number that would be different if the ability did nothing.
6. Ids are `<faction>-<slug>`. Tokens (`token: true`) are only made by other cards and need no test of their own.
7. No silent fallbacks, no `any`, no `// @ts-ignore`.

## Stat budget (starting point; the bench decides later)
A unit with no text has power + health = 2 x cost + 1 (cost 1: 2|1 or 1|2; cost 3: 3|4; cost 5: 5|6).
A keyword costs about 1 point (Aerial, Corrosive, Pierce on a big body: 2). An ability costs 1-3 points.
Cost 7+ units should end games. Glyph rates: 1 Charge is about 2 damage to a unit at Swift, 1 less at Flash,
1 more at Ritual; damage that can hit a Spire costs 1 more; drawing a card is about 1.5 Charge;
+2|+2 this round is about 2 Charge at Flash.

## Shape of a faction's 50 collectible cards (base set, docs/SETS.md)
4 heroes, 28 units, 18 glyphs: the original 25 plus 25 added in the same shape:
2 heroes, 14 units, 9 glyphs.
- Units by cost: three at 1, three at 2, three at 3, two at 4, one at 5, one at 6, one at 7 or 8.
- Glyphs: three Flash, four Swift, two Ritual; costs spread 1-6.
- At least 4 cards that advance each hero's level condition, and at least 2 with a **Resonant** bonus.
- Every card should make a player decide something. No two cards that differ only by a number, and no card that is
  an existing card with a number changed.
- Card art: every card (and every hero's `--ascended` face) needs a subject in `tools/art/subjects/<faction>.ts`:
  one person, creature or object and one scene, never a scene clause another card already uses.
  `npx tsx tools/art/build-prompts.ts` lints them.

## Worked examples
```ts
// A unit with a targeted Deploy and a Resonant aura.
{
  id: 'tide-lockkeeper', name: 'Lock-Keeper', faction: 'tide', type: 'unit', cost: 3, power: 2, health: 4, tribe: 'mage',
  text: 'Deploy: return an enemy unit with 2 or less power to its owner\'s hand. Resonant: I have +1|+1.',
  abilities: [{ on: 'deploy', targets: [{ what: 'unit', side: 'enemy', filter: { maxPower: 2 } }], ops: [{ op: 'recall', to: 'target0' }] }],
  auras: [{ to: 'self', power: 1, health: 1, cond: { c: 'resonant' } }],
},
// A Swift glyph with two targets.
{
  id: 'ember-crossfire', name: 'Crossfire', faction: 'ember', type: 'glyph', cost: 3, speed: 'swift',
  text: 'Deal 2 to an enemy unit and 1 to another enemy unit.',
  targets: [{ what: 'unit', side: 'enemy' }, { what: 'unit', side: 'enemy' }],
  ops: [{ op: 'damage', to: 'target0', n: 2 }, { op: 'damage', to: 'target1', n: 1 }],
},
// A counter-glyph.
{
  id: 'tide-unwrite', name: 'Unwrite', faction: 'tide', type: 'glyph', cost: 3, speed: 'swift',
  text: 'Negate an enemy glyph.',
  targets: [{ what: 'glyph', side: 'enemy' }], ops: [{ op: 'negate', to: 'target0' }],
},
```
```ts
// tests/cards/tide.test.ts
import { describe, expect, it } from 'vitest';
import { board, play, unit, st } from '../helpers';

describe('tide cards', () => {
  it('tide-lockkeeper: Deploy returns a small enemy to hand; Resonant gives +1|+1', () => {
    const s = board({ hand: [['tide-lockkeeper'], []], line: [['tide-maren'], ['zz-grunt']] });
    play(s, 'tide-lockkeeper', [unit(s, 1, 'zz-grunt').iid]);
    expect(s.players[1].line.length).toBe(0);
    expect(s.players[1].hand.length).toBe(0); // zz test cards are tokens: a recalled token vanishes (use a real card to test the hand)
    const k = unit(s, 0, 'tide-lockkeeper');
    expect(st(s, k)).toMatchObject({ power: 2, health: 4 });
    s.players[0].ascended = ['tide-maren']; // Maren on the Line is now Ascended
    expect(st(s, k)).toMatchObject({ power: 3, health: 5 });
  });
});
```
Helper notes: `board()` gives both players 10 Charge, seat 0 the Initiative and priority, round 1. `line` units are
placed directly (no Deploy, no counters). Test cards: `zz-grunt` 2|2, `zz-wall` 0|6, `zz-ogre` 5|5, `zz-filler` 1|1
(cost 10), `zz-bolt` (Swift, 2 to a unit or Spire), `zz-zap` (Flash, 1 to an enemy unit), `zz-pump` (Flash, +0|+3 this
round), `zz-rite` (Ritual, draw 1), `zz-deny` (Swift negate), and `zz-<keyword>` 3|3 units. After a Swift or Ritual
glyph, the opponent must `pass(s)` for it to resolve. `attack(s, [attackers], [[blocker, attacker]])` then
`resolveCombat(s)`. Two `pass(s)` in a row end the round. To set a hero Ascended in a test:
`s.players[seat].ascended = ['<hero id>']`. To pre-load a counter: `s.players[seat].seen.<stat> = n`.

Run `npx vitest run tests/cards/<faction>.test.ts` and `npx tsc --noEmit` until both are clean.
