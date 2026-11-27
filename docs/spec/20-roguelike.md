# Magitek Wars: the campaign run (spec 20)

The roguelike mode (PLAN D18): one run is a march across Ardenmoor with a single growing deck, fighting the card
battles of spec 10 against the AI. Rule ids (R-R...) are cited in code and tests. Ambiguities become `RULING:` lines.

## Run (R-R)
- **R-R1 Start.** The player picks one of the six factions. The run deck is that faction's starter list (R-R2) and
  the Boiler starts at 20. The run has a seed; every random choice in the run comes from it, so a run replays.
- **R-R2 Starter deck.** 24 cards from the chosen faction: 2 copies of its lead hero (the WORLD character), then two
  copies each of its units with the most power plus health at each cost: 3 at cost 1, 3 at 2, 3 at 3, 2 at 4 (ids break
  ties; a faction short of units fills with its cheapest other cards). No tokens. (BALANCE R-1.)
- **R-R3 Map.** Three acts: **Thrumhollow** (act 1), **the Rimeglass Flats** (act 2), **Vaskor** (act 3). Each act is
  7 floors. Floors 1-6 have 2 to 4 nodes; each node links to 1 or 2 nodes on the next floor, so there is always a path.
  Floor 7 is the act's boss. The player starts each act choosing any floor-1 node, then must follow links.
- **R-R4 Node kinds.** **Skirmish** (a battle), **Elite** (a harder battle, better reward; floor 3 and up), **Rest**
  (repair the Boiler by 6, or remove one card; never below 10 cards), **Supply** (spend scrip on cards or repairs), **Boss** (floor 7).
  Floor 1 is always skirmishes; floor 6 always holds at least one Rest.
- **R-R5 Boiler.** The run's Boiler carries between battles: a battle starts with the run's Boiler for the player
  (cap 20) and ends by writing the player's Boiler back. A run Boiler at 0 ends the run in defeat.
- **R-R6 Foes.** A skirmish or elite foe uses one or two random factions other than the player's; a boss uses the
  act's ruling faction (act 1 the Free Gauge, act 2 the Gale Exchange, act 3 the Dominion; the next one on a fixed list
  when that is the player's own). The foe deck is a random sample of the curve-built deck for those factions
  (autoDeck), cut to the foe's deck size; a boss keeps every hero copy, other foes keep one hero (two copies). Foe deck size, foe Boiler and AI level rise with act and node kind:

  | | Act 1 | Act 2 | Act 3 |
  |---|---|---|---|
  | Skirmish | 20 cards, Boiler 10, Recruit | 24, Boiler 14, Veteran | 28, Boiler 18, Veteran |
  | Elite | 24, Boiler 14, Veteran | 28, Boiler 18, Veteran | 30, Boiler 20, Marshal |
  | Boss | 30, Boiler 20, Veteran (the act's ruling faction) | 30, 20, Marshal | 34, 20, Marshal |

- **R-R7 Rewards.** Winning a battle gives scrip (skirmish 10, elite 25, boss 50) and a choice of 3 non-hero cards
  (or none): two from the player's faction, one from any faction. A draw is not a win: it ends the run. Elite and boss offers draw only from
  cards of cost 3 or more. A run deck may hold any number of copies and any number of factions.
- **R-R8 Supply.** A Supply node offers 4 cards at 15 scrip each (30 for a hero) and a repair of 5 for 20 scrip.
- **R-R9 Winning.** Beating the act 3 boss wins the run.
- **R-R10 Saving.** The run saves after every node and every battle move (KB rule 22) in its own slot, separate from
  the single-battle save.

## Engine support
- **R-X3 Starting Boiler.** `Setup.startSpire` (optional) sets each side's starting Integrity, 1 to 20; omitted means
  20 (R-G2). Used by runs only.
