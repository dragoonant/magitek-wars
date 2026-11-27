# Status (2026-11-27)

**Live:** https://dragoonant.github.io/magitek-wars/ is playable: battles against the AI with every deck, a
campaign run, and the card gallery.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
- **Engine (PLAN D4):** Annals of Scrivenearth's engine, AI and card data (300 cards, 24 heroes, 6 factions), copied at
  8b4ebac, plus one setup field for runs (`startSpire`, R-X3). `npm run gate` passes: 472 tests, the card audit (332
  faces), the mutation pass, the AI bench and the build.
- **Re-skin (D12, D16):** every card and hero has its Magitek Wars name and text; the Spire is printed as the Boiler
  and a glyph as a tactic (`docs/RESKIN.md`, audit-checked). Faction names, the 24 premade decks and the AI levels
  (Recruit, Veteran, Marshal) use this world's words. Card ids and the rules spec's internal words are unchanged.
- **Title (D13):** Vaskor at dusk with the six faction leads, rendered with the `mkw16_v2` style LoRA; menu CAMPAIGN,
  QUICK BATTLE, CONTINUE, CARD GALLERY, CREDITS.
- **Quick battle (D17):** deck select (24 premade decks plus one single-faction deck per faction, a chosen or random
  foe deck, three AI levels), then the battle screen at 512 x 448: both Lines, Boilers, Charge and Reserve, hero
  progress, the stack, the log, the hand, hover to inspect any card, every choice drawn from the engine's legal
  actions. Autosaves after every move; CONTINUE reopens it. `?auto` lets the AI play both seats; all 30 decks played a
  full battle through the screen this way with no error (13-17 by seat).
- **Campaign (D18, spec 20):** pick a faction, then three acts of seven floors (skirmish, elite, rest, supply depot,
  boss) with one growing deck, a Boiler that carries its damage, card rewards and scrip. Saves after every node and
  move in its own slot. Balance R-1: an AI stand-in wins every first battle; 4 of 18 runs get past act 1, none won yet.
- **Art (D3, D14, D15):** style LoRAs `mkw16_v1` and `mkw16_v2`; card art for 330 of 332 faces, six emblems, seven
  battlefields; picks in `tools/art/picks.md`.

## Waiting on the owner
- Play-test: the battles (every deck), the campaign's difficulty (R-1), and the card art and names.
- Q2 interface concept, Q4 licence, Q5 re-skin map (`PLAN.md`).

## Next
1. Campaign: events, a deck view before each battle, boss intros, and a second balance pass once the owner has played
   a few runs.
2. Battle screen: attack and block arrows, strike animations, a full log viewer, the Scrap viewer.
3. Art: hero portraits; re-render the two cards without art (`ember-meltdowngolem`, `storm-steepdive`); a prompt pass
   for cards that drifted to modern-war looks.
4. KB: a `magitek-wars.md` entry in `dragoonant/tabletop-kb` (rule 19).

Not verified: the screens have been checked in headless Chromium at 1024 x 896 only, not on a phone (the battle screen
needs at least 512 x 448 CSS pixels).
