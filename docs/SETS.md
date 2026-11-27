# Card sets

> Copied from Annals of Scrivenearth at 8b4ebac (PLAN D4). Faction, card and hero names are Annals' until the
> re-skin (PLAN D12); the rules and numbers carry over as they are.

The plan for the card pool (PLAN D26). The owner asked for "the base set to be about 300 cards" and "the first two
expansions to build upon those to make the game more exciting". Every name, keyword and card here is our own. The
structure is the genre's usual one: a base set where every faction has its full identity, then expansions that each
bring one new faction, a few new keywords that the older factions also pick up, and new heroes for every faction.

All sets are one pool. A card's `set` field says where it came from (no field means the base set); the deck builder
can filter by set. Deck rules (R-G1) do not change: 40 cards, at most 2 factions.

| Set | Id | Cards | Heroes | Factions | New rules |
|---|---|---|---|---|---|
| First Light (base) | `base` | 300 | 24 | Prismguard, Emberworks, Tidewardens, Verdant Coil, Undervolt, Stormrail | three counters for hero conditions, one count |
| The Mirror Quarter | `x1` | 124 | 10 | + **Mirrorwatch** | Glimmer, Reprise, Veiled, copies |
| The Starward Rise | `x2` | 124 | 11 | + **Orrery Conclave** | Chart, Unfold, Conjunction |
| Total | | 548 | 45 | 8 | |

## First Light (base set, 300)

Each of the six factions has **50 collectible cards: 4 heroes, 28 units, 18 glyphs**. The first 25 of each faction
are the original pool; the other 25 deepen what the faction already does and give each of its two new heroes an
archetype of its own. No new keywords: the base set uses the twelve in R-K.

Shape of a faction's 25 added cards: 2 heroes, 14 units, 9 glyphs.
- Units by cost: three at 1, three at 2, three at 3, two at 4, one at 5, one at 6, one at 7 or 8.
- Glyphs: three Flash, four Swift, two Ritual.
- At least 4 cards that advance each new hero's condition, and 3 more with a Resonant bonus.

| Faction | Existing archetypes | New hero A | New hero B |
|---|---|---|---|
| Prismguard | survive damage (Ysolde), the unbreakable wall (Oren) | **formation**: many small wardens buffed together (`buffsGiven`) | **lens-gunner**: a Spotter that shoots down Aerial units and grows on kills (`kills`) |
| Emberworks | burn (Kessa), construct swarm (Crucible) | **pit-fighter**: Vanguard duels, grows on its own strikes (`strikes`) | **overcharger**: big Charge turns and heavy glyphs (`chargeSpent`) |
| Tidewardens | glyph count (Maren), Stasis lock (Ilvane) | **archivist**: card draw and big hands (`cardsDrawn`, count `hand`) | **tide-turner**: returning units to hand, own and enemy, for value (`recalled`) |
| Verdant Coil | big beasts (Aruvi), the alpha that fights (Brakk) | **seed-sower**: tokens that grow (`tokensSummoned`) | **pack hunter**: units that win fights and feed on enemy losses (`enemiesDied`) |
| Undervolt | sacrifice (Sable), drain (Vex) | **enforcer**: Dread and Corrosive removal on bodies (`kills`) | **racketeer**: drain glyphs and abilities that tax the enemy Spire (`glyphDamage`) |
| Stormrail | face damage (Jax), wide attacks (Corvane) | **wingleader**: Aerial squadrons buffed together (`buffsGiven`) | **rail-runner**: second attacks and rally (`attackersDeclared`, a higher bar than Corvane's) |

New engine pieces for the base set (spec R-H3 counters and the Amount list):
- counters `buffsGiven` (you buffed an allied unit), `recalled` (you returned a unit to a hand), `tokensSummoned`;
- count `hand` (cards in your hand).

## The Mirror Quarter (expansion 1, 124)

The city's mirrored quarter opens its doors: illusionists, spies and glassmakers who copy what they see.

- **Mirrorwatch** (40: 4 heroes, 22 units, 14 glyphs): copies of enemy and allied cards, short-lived Glimmer cards,
  glyphs that repeat themselves, Veiled units that cannot be singled out.
- Each original faction gets **14: 1 hero, 8 units, 5 glyphs**, using at least one of the new keywords where it fits
  the faction (Tidewardens Reprise glyphs, Stormrail Veiled couriers, Undervolt copies of enemy units and so on).

New rules:
- **Glimmer** (a card in hand): burned at the end of the round if it is still in your hand. Most copies are Glimmer.
- **Reprise** (glyph): after it resolves, a Glimmer copy of it without Reprise goes to your hand.
- **Veiled** (unit, R-K13): cannot be chosen as a target by enemy glyphs or Deploy abilities. A Veiled unit loses
  Veiled when it strikes.
- **Copy** (op): put a copy of a unit's card, or of a glyph on the stack, into a hand, optionally Glimmer.
- Trigger **foeGlyph**: the opponent cast a glyph.

## The Starward Rise (expansion 2, 124)

The astronomers of the highest spire come down with their instruments: foresight, patience and enormous
constructs of starlight.

- **Orrery Conclave** (40: 4 heroes, 22 units, 14 glyphs): reading the top of the deck, units that Unfold after
  rounds on the Line, late-game constructs.
- Each of the seven earlier factions gets **12: 1 hero, 7 units, 4 glyphs**, using Chart, Unfold or Conjunction where it
  fits the faction.

New rules:
- **Chart** (op): "Chart a unit (4)": look at the top 4 cards of your deck and draw the first that matches; the others
  stay in order. No choice is asked (spec RULING R-S3).
- **Unfold** (unit): a non-hero unit with a condition and a second face, like a small hero. It reads the unit's own
  counters, including the new unit counter `dawns` (rounds it started on the Line). Only that unit unfolds, not every
  copy.
- **Conjunction** (condition word, like Resonant): this round you have played a unit and cast a glyph.

## Order of work
1. Base set: engine counters, then the 150 new cards with a behaviour test and an art subject each, then a sim and
   balance pass (`BALANCE.md`). Merged to `main` on its own.
2. Expansion 1: the rules above in the spec and engine with tests, the Mirrorwatch faction (look, hue, blurb),
   its cards, the 84 cards for the older factions, the set filter in the deck builder, and a premade deck or two.
3. Expansion 2: the same.

Card art: every new card gets a hand-written subject (`tools/art/subjects/`), so prompts are ready for the next GPU
batch; until then new cards show their procedural sigil.
