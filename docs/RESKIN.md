# Re-skin guide (PLAN D12, D16, D24)

The card data came from Annals of Scrivenearth. Magitek Wars keeps every number and every rule, and replaces the
names and words. This guide is what every card edit follows.

## What changes
| Engine / Annals word | Printed in Magitek Wars | Notes |
|---|---|---|
| Spire | **Crystal** | Each nation's heart crystal, the 20-point thing it defends (D24; was "Boiler" under D16). Internal ids (`spire0`, `mySpire`, `enemySpire`) and card ids stay. `tools/audit.ts` checks the word, so no card name may start with "Crystal" if another card's text names it. |
| glyph | **tactic** | The card type id stays `'glyph'`; text says "tactic" ("When you play a tactic", "Negate a tactic"). |
| cast (a glyph) | **play** (a tactic) | |
| Prismguard, Emberworks, Tidewardens, Verdant Coil, Stormrail, Undervolt | Cindral Dominion, Ashen Choir, Gale Exchange, Sedgekin, Free Gauge, the Blackwick | D12. Faction ids (`prism`, ...) stay. |
| Card and hero names | The proposed names in `tools/art/cards/<faction>.mjs` (`name`, `ascendedName`) | Text that names another card (a token it summons, a hero) uses that card's new name. |
| Tribe words in text ("Wardens", "Constructs") | A word that fits the faction | Only the printed word changes; the `tribe` field stays as it is, because filters read it. |

## What stays
Every keyword (Vanguard, Pierce, Aerial, Spotter, Plated, Siphon, Ward, Dueler, Dread, Unstable, Mend, Corrosive),
every trigger word (Deploy:, Shatter:, Strike:, Assault:, Dawn:, Dusk:, Ascend:, When ...), Charge, Reserve, Line,
Scrap, Initiative, Stasis, Resonant, Channel, Ascend and Ascended. Every number. Card ids.

## Rules for the text
- The text must still say exactly what the data does: `npx tsx tools/audit.ts` must report 0 FAIL for your cards.
- Keep the sentence shapes the audit knows ("Deploy: deal 2 to an enemy unit."); change setting words, not grammar.
- Never use these words: chibi, MGSD, SD, super-deformed, Master Grade SD, Gundam, Nendoroid, cute, kawaii, toy,
  cartoony, stubby, tiny legs. No published game, book, film or show names.
- `level.text` (the Ascend condition) uses the new words too ("Your tactics and abilities have dealt 8+ damage").
