# Magitek Wars: rules (spec 10)

> Copied from Annals of Scrivenearth at 8b4ebac (PLAN D4). Faction, card and hero names are Annals' until the
> re-skin (PLAN D12); the rules and numbers carry over as they are.

An original ruleset. **The spec is the product**: the engine implements these rules by id, tests are named by id,
and a balance change needs a sim or bench result recorded in `BALANCE.md`. Ambiguities are logged at the end as
`RULING: <rule> | <what we did> | <why>`.

Scrivenearth is a city of cut crystal. Each player commands a **Spire** and fields **units**, **heroes** and
**glyphs** from two of the city's six factions.

## Game (R-G)
- **R-G1 Decks.** Exactly 40 cards, at most 3 copies of a card, cards from at most 2 factions, at most 6 hero cards.
  Tokens and disabled cards cannot be in a deck.
- **R-G2 Start.** Each Spire has 20 Integrity. Each player shuffles and draws 4.
- **R-G3 Initiative.** One player holds the Initiative each round; it alternates every round. Round 1 is decided at random.
- **R-G4 Mulligan.** Once, before round 1, each player may replace any of their 4 cards: draw that many, then shuffle the
  returned cards into the deck.
- **R-G5 Winning.** A Spire at 0 Integrity loses. Both at 0 at the same check is a draw. After round 45 the game is a draw.
- **R-G6 Empty deck.** A player who must draw from an empty deck loses.
- **R-G7 Hand limit.** 10 cards. A card drawn or returned beyond that is burned (put in the Scrap, shown to both).
- **R-G8 Negate.** A negated glyph leaves the stack for its owner's Scrap and does nothing.
- **R-G9 Fizzle.** A glyph that chose targets does nothing if every one of them is gone when it resolves; if some remain it
  resolves and the missing ones are skipped. A target that left the Line and came back is a new object and is gone.
- **R-G10 Targets.** A card that asks for targets must be given one for every slot that has a legal choice, each a
  different object. A glyph needs at least its first target to be cast; later slots with no legal choice are left
  empty and that part of the effect is skipped. A glyph that makes two units fight needs both. A unit may always be played;
  its Deploy skips empty slots.

## Charge (R-C)
- **R-C1.** At the start of each round your maximum Charge rises by 1 (cap 10) and your Charge refills.
- **R-C2.** Units and heroes are paid with Charge only. Glyphs spend Reserve first, then Charge.
- **R-C3.** A card's cost is read through one door (`costOf`); effects may change it; it never goes below 0.
- **R-C4.** At the end of a round your unspent Charge becomes Reserve (cap 3). Reserve stays until spent.

## Priority (R-P)
- **R-P1.** One player has priority. Playing a unit, casting a Swift or Ritual glyph, or finishing an attack passes
  priority to the opponent. The Initiative holder has priority first each round.
- **R-P2 Speeds.** **Ritual**: only with an empty stack and no attack under way. **Swift**: any time you have priority
  outside attacker/blocker selection; it waits on the stack. **Flash**: same timing as Swift, but see R-P3.
- **R-P3.** A Flash glyph resolves at once, cannot be answered, and its caster keeps priority. Channel (R-H7) is Flash speed.
- **R-P4 Stack.** Swift and Ritual glyphs wait on the stack. The opponent may answer with Swift or Flash glyphs. When a
  player passes with glyphs waiting, the whole stack resolves, newest first. Then the opponent of whoever started the
  stack has priority (during a combat window, the attacker).
- **R-P5 Round end.** With an empty stack and no attack, two passes in a row end the round. A Flash glyph between them
  does not break the chain.
- **R-P6.** Units and heroes can be played only in the main phase with an empty stack.

## Units (R-U)
- **R-U1 Line.** At most 6 units a side. To play a unit onto a full Line you choose one of your own units to scrap:
  it is destroyed first (its Shatter fires and it counts as destroyed), then the new unit arrives. A summon by an effect
  onto a full Line is lost.
- **R-U2.** Every unit enters through one door (`summon`). **Deploy** abilities fire only when the unit is played from hand.
- **R-U3.** Units can attack on the round they arrive.
- **R-U4 Return to hand.** A returned unit goes to its owner's hand as a fresh card (damage, buffs and counters are
  gone). A token is not a card: returned, it vanishes. Returned to a full hand, the card is burned (R-G7).

## Battle (R-B)
- **R-B1.** The Initiative holder may declare one attack a round, in the main phase with an empty stack. A **rally**
  effect always gives one more attack this round: if the round's attack is still unused the extra one is banked
  (and it lets a player without the Initiative attack).
- **R-B2 Declare.** The attacker picks any of their units not in Stasis, in order; that order is the strike order.
  Attackers may be withdrawn until the attack is locked in. Assault abilities fire when it is locked in.
- **R-B3 Block.** The defender assigns at most one blocker to each attacker; a unit blocks one attacker. Units in Stasis
  cannot block. Aerial (R-K3) and Dread (R-K9) restrict blockers. Blocks may be changed until locked in.
- **R-B4 Combat window.** If no block is possible the defender is not asked. After blocks lock, the attacker has priority;
  both players may cast Swift and Flash glyphs. Two passes in a row with an empty stack resolve the strikes.
- **R-B5 Strikes.** Pairs resolve left to right. An unblocked attacker strikes the enemy Spire.
- **R-B6.** A blocked attacker and its blocker strike each other at the same time, each for its power as read before either
  strike. A unit with 0 power does not strike.
- **R-B7.** If the blocker is gone when the pair resolves, the attacker deals no damage, unless it has Pierce, in which
  case it strikes the Spire for its full power.
- **R-B8.** A unit put in Stasis during an attack leaves the fight: an attacker is removed; a blocker stops blocking
  but its attacker stays blocked.
- **R-B9.** After the strikes the defender has priority.

## Damage and state (R-D, R-S)
- **R-D1.** All damage goes through one door (`damage`). **R-D5.** Damage on a unit stays until repaired.
- **R-D7 Drain.** "Drain N from X" deals N damage to X, then repairs your Spire by the damage dealt. Damage dealt is
  the full amount that landed (after Ward and Plated), even if the unit had less health left.
- **R-D8 Stasis.** Putting a unit that is already in Stasis into Stasis does nothing and is not counted.
- **R-S1 Stats.** Printed face, then lasting and this-round buffs, then auras that apply to everyone they name, then
  auras with a condition on the unit (such as "allies with 5+ power"), which read the stats so far. Power is never below 0.
- **R-S2 State check.** After every effect, and before any waiting triggered ability resolves: units with 0 or less health, or marked destroyed, are destroyed (the acting
  player's first, left to right); then "survived damage" is noted; then heroes are checked for ascension; then Spires.
  This repeats until nothing changes.
- **R-S3 Triggers.** Triggered abilities resolve immediately, in the order they were caused, with no stack and no answer.
- **R-S4.** When a this-round health buff ends, or a unit is silenced, damage is reduced so the unit keeps at least 1 health.

## Keywords (R-K)
| Id | Keyword | Rule |
|---|---|---|
| R-K1 | **Vanguard** | When attacking, strikes before its blocker. If the blocker is destroyed it does not strike back. |
| R-K2 | **Pierce** | Strike damage beyond the blocker's remaining health hits the enemy Spire. The excess is counted from the damage that lands: a blocker's Ward negates the whole strike, and Plated takes 1 off it. |
| R-K3 | **Aerial** | Can be blocked only by Aerial or Spotter units. |
| R-K4 | **Spotter** | Can block Aerial units. |
| R-K5 | **Plated** | Takes 1 less damage from every source. |
| R-K6 | **Siphon** | Damage its strikes deal repairs its owner's Spire by that much. |
| R-K7 | **Ward** | Negates the next damage it would take, then is used up. Granted Ward lasts until used. |
| R-K8 | **Dueler** | When declared as an attacker, may name one enemy unit not in Stasis, which must block it. |
| R-K9 | **Dread** | Cannot be blocked by units with 2 or less power. |
| R-K10 | **Unstable** | Destroyed at the end of the round. |
| R-K11 | **Mend** | Fully repaired at the start of each round. |
| R-K12 | **Corrosive** | Any damage it deals to a unit destroys that unit. |
| R-K13 | **Veiled** (set x1) | Cannot be chosen as a target by the enemy's glyphs or Deploy abilities. Effects that pick by themselves (strongest, random, all) still reach it. It loses Veiled the first time it strikes. |
| R-K14 | **Reprise** (set x1, glyphs) | After it resolves, a Glimmer copy of it without Reprise goes to its caster's hand. A negated Reprise glyph makes no copy. |

Status **Stasis**: the unit cannot attack or block for the rest of the round (R-B8).

Ability words: **Deploy** (played from hand), **Shatter** (destroyed), **Strike** (it struck), **Assault** (declared as an
attacker), **Dawn** (round start), **Dusk** (round end), **Ascend** (the hero just ascended on the Line),
**Resonant** (see R-H6).

## Sets (R-E)
Rules that arrive with an expansion (docs/SETS.md). Cards that do not use them are unaffected.
- **R-E1 Glimmer** (set x1). A Glimmer card in hand is burned at the end of the round if it is still there (after Dusk
  abilities). Glimmer is shown on the card and is open information, even on a hidden hand card.
- **R-E2 Copy** (set x1). "Copy X" puts a new card with X's card id into a hand (the caster's unless it says otherwise):
  X is a unit on a Line or a glyph on the stack. The copy is a fresh card: no damage, buffs or counters. A token is not a
  card and cannot be copied; the copy is skipped and logged. A hand at 10 burns the copy (R-G7).
- **R-E3 Foe glyph** (set x1). Trigger: the opponent cast a glyph (when it goes on the stack, or resolves at Flash speed).

## Heroes (R-H)
- **R-H1.** A hero is a unit with a **level condition** and an **Ascended** face.
- **R-H3.** The engine counts what each player has done all game (units destroyed, glyphs cast, Spire damage and so on)
  and what each unit has done while on the Line. Conditions read those counters, so they progress while the hero is
  still in hand or deck (player counters) or only while it is on the Line (the hero's own counters).
- **R-H4.** When the condition is met the hero **ascends**: every copy of that card, in every zone, uses its Ascended
  face for the rest of the game.
- **R-H5.** A copy on the Line when it ascends is fully repaired and its **Ascend** ability fires.
- **R-H6 Resonant.** A Resonant bonus applies while you have an Ascended hero on your Line.
- **R-H7 Channel.** You cannot play a hero while the same hero is on your Line. Instead, for 1 Charge at Flash speed,
  discard the spare copy: the hero on the Line is fully repaired and gets +1|+1.

## Hidden information (R-V)
- **R-V1.** Hands and deck order are hidden; the Scrap, the Line, the stack, counters, hero progress, hand and deck
  sizes are open. The AI is only ever given `view(state, seat)`.

## Engine contract (R-X)
- **R-X1.** `legalActions` is never empty before the game ends; `applyAction` never throws on a bad action and changes
  nothing when it refuses one. State is plain JSON. The same seed and actions give the same game.
- **R-X2.** The engine records how many actions each seat took each round, for AI behaviour counters.

## Rulings
- RULING: R-S3 | Triggered abilities never take chosen targets; only Deploy abilities and glyphs do | keeps "never assume a
  choice" true without a mid-resolution prompt system; revisit after the owner's playtest. Status: open.
- RULING: R-K6 | Siphon counts strike damage only | Siphon plus a drain ability double-counted (Vex test). Status: settled.
- RULING: R-B8/R-P3 | If a Flash glyph removes the last attacker, the attack is over and the defender has priority, although a Flash normally keeps priority | the attack was the attacker's action for that turn (R-P1). Status: settled.
- RULING: R-B4 | The attacker, not the defender, acts first after blocks | one combat window is easier to read. Status: open.
