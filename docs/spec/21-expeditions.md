# Magitek Wars: Hero Expeditions (spec 21)

Hero Expeditions (PLAN D33, D34) is its own mode on the title menu, beside the roguelike campaign of spec 20, which
stays as it is. It follows the shape of Path of Champions: you lead one hero on a
handmade expedition, grow a deck, an arsenal of Orders and Fittings along the way, and the hero keeps a rank between
runs. Only the mechanics are borrowed; every name, card, map and word is ours. The battles are the spec 10 battles
against the AI. Rule ids (R-E...) are cited in code and tests. Ambiguities become `RULING:` lines.

## Run (R-E)
- **R-E1 Start.** The player picks one of the six heroes (the faction leads of WORLD) and an expedition they have
  unlocked (R-E14). The run has a seed; every random choice in the run comes from it, so a run replays.
- **R-E2 Starter deck.** Each hero has a hand-built 24-card starter in `src/expedition/heroes.ts`: 3 copies of the hero and
  21 cards of the hero's faction that feed the hero's level condition. No tokens. In every battle of the run the
  player's heroes are drawn early (R-X4).
- **R-E3 Expeditions.** An expedition is a handmade map in `src/expedition/expeditions.ts`: stops on rows, each linked to one
  or two stops on the next row, ending in a boss. The player starts on any stop of the first row, then must follow
  links. Every battle stop names its foe (R-E6), the same every time the expedition is played.
- **R-E4 Stop kinds.** **Battle**, **Elite** (a harder battle; its reward adds a Fitting, R-E8), **Boss** (the end),
  **Rest** (repair the Crystal by 6, or remove one card; never below 12 cards), **Depot** (R-E10), **Event** (R-E11),
  **Order** (pick 1 of 3 Orders, R-E7), **Cache** (pick 1 of 3 Fittings, R-E8) and **Recruit** (R-E9).
- **R-E5 Crystal.** The run's Crystal carries between battles: a battle starts with the run's Crystal for the player
  (cap 20) and ends by writing the player's Crystal back; a won battle then repairs it by 3 (field repairs, cap 20). A
  run Crystal at 0 ends the run in defeat. RULING: a draw is not a win; it ends the run.
- **R-E6 Foes.** Each battle stop names its foe: one or two factions, deck size, Crystal, AI level and any Orders. The
  foe deck is the curve-built deck for those factions (`autoDeck`), with its other cards in an order fixed by the
  expedition and stop, cut to the deck size; a boss keeps every hero copy, other foes keep one hero (two copies). A
  boss whose faction is the player hero's uses the expedition's other boss faction.
- **R-E7 Orders.** An Order is a power for the rest of the run (R-X6): it works in every later battle. Orders are
  picked 1 of 3 at Order stops and after a boss that is not the last, and bought at Depots. A run never offers an Order
  it already holds. The catalog is `src/expedition/orders.ts`; each Order prints everything it does.
- **R-E8 Fittings.** A Fitting is an upgrade fitted to every copy of one card in the run deck (R-X5): more power or
  health, a keyword, or a lower cost. A card holds one Fitting; a new one replaces the old. Stat and keyword Fittings go
  on units and heroes only; a cost Fitting goes on any card that costs 2 or more. Fittings are picked 1 of 3 at Caches
  and after Elites, and bought at Depots; the player then picks the card. The catalog is `src/expedition/fittings.ts`.
- **R-E9 Recruit.** A Recruit stop offers two other heroes (never one already in the run): the one taken joins with two
  copies of itself and two copies each of the first two cards of its starter. Its faction then joins the reward
  bundles (R-E12). Only the run's lead hero earns rank (R-E13).
- **R-E10 Depot.** Offers 3 cards (15 scrip; 30 for a hero), 1 Fitting (25), 1 Order (40) and a repair of 5 (20).
- **R-E11 Events.** An event stop draws one of the scenes in `src/run/events.ts`: two or three choices, each printing
  everything it does. A choice with a scrip price is refused without the scrip. An event never takes the Crystal below
  1 and never removes a card below the 12-card minimum. Random cards are never heroes or tokens.
- **R-E12 Rewards.** Winning a battle gives scrip (battle 10, elite 25, boss 50), rank XP (R-E13) and a choice of one
  of three **bundles**, or none: a **hero bundle** from the lead hero's reward pool, a **faction bundle** from the
  run's factions (the lead's and any recruit's) and a **wild bundle** from any faction. A bundle holds 2 cards after a
  battle and 3 after an elite or boss; elite and boss bundles draw only cards of cost 3 or more where the pool allows.
  No bundle holds a hero or a token. A run deck may hold any number of copies.
- **R-E13 Hero rank.** Each hero keeps XP between runs (the profile, R-E15). A won battle gives 10 XP (elite 20, boss
  40); winning the expedition gives 30 more per star. XP earned in a lost run is kept. Ranks need 0, 30, 80, 150, 250,
  380, 540 and 750 XP (rank 1 to 8). Each rank unlocks, for every later run with that hero:
  2: start with 15 scrip. 3: start with the hero's signature Order. 4: rests repair 3 more. 5: the hero's signature
  Fitting on the hero card. 6: start with one more Order, picked at random from the common Orders. 7: field repairs
  2 more. 8: start with the hero's mastery Order.
- **R-E14 Expeditions unlocked.** The first expedition is open; each later one opens once any hero wins the one before.
- **R-E15 Briefing.** Before a battle the player sees the foe's name, factions, deck size, Crystal, AI level and
  Orders, and can look at the foe's whole deck (open information); a boss gets an introduction.
- **R-E16 Saving.** The run saves after every stop and every battle move (KB rule 22) in its own slot, separate from
  the single-battle save and from the campaign's (spec 20). The profile saves whenever XP or an unlock changes.

## Engine support
- **R-X3 Starting Crystal** (spec 20) is used here too.
- **R-X4 Early cards.** `Setup.gear[seat].early` lists card ids; after the shuffle, one copy of each is moved to a
  seeded place among the top 6 cards of that deck. A listed card that is not in the deck is refused at setup.
- **R-X5 Fittings.** `Setup.gear[seat].fittings` maps a card id to a Fitting. Every copy of that card, in every zone,
  for that side, has the Fitting: `face` adds its power, health and keywords (both faces of a hero) and adds its words
  to the card text; `costOf` adds its cost change (never below 0). Fittings are open information.
- **R-X6 Orders.** `Setup.gear[seat].orders` lists Orders for that side. An Order can hold auras (to that side's units
  or the other side's, through `stats`), cost changes (through `costOf`) and abilities that run at **start** (round 1,
  after the mulligan, before Dawn triggers), **dawn** (every round, before Dawn triggers) or **dusk** (every round,
  before Dusk triggers). The Initiative holder's Orders run first. Order abilities choose no targets and have no
  source unit, so they may not use `self`, `target0`, `target1`, `trigger`, `opposing` or `others`; such an Order is
  refused at setup. Each firing is logged with the Order's name. Orders are open information.
