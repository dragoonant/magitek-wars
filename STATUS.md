# Status (2026-11-28)

**Live:** https://dragoonant.github.io/magitek-wars/ is playable: battles against the AI with every deck, a
roguelike campaign, Hero Expeditions in the shape of Path of Champions, a deck builder and the card gallery, with music and sound.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
  Licence: all rights reserved (PLAN D19).
- **Engine (PLAN D4):** Annals of Scrivenearth's engine, AI and card data (300 cards, 24 heroes, 6 factions), copied at
  8b4ebac, plus one setup field for runs (`startSpire`, R-X3). `npm run gate` passes: 498 tests, the card audit (332
  faces), the mutation pass, the AI bench and the build.
- **Balance (D30, D31; BALANCE B-6, B-7):** eight overvalued cards toned down (Ironclad Sentry 1|2 Plated, Junior
  Ledger-Hand costs 2, Launch Chief 6, Cantor Ebbe ascends later and smaller, and four more), then every premade
  deck retuned by decklist into a 45-55% band: on fresh seeds all 24 sit at 45.7-53.7% (`tools/tourney.ts`,
  about 1240 games a deck). `tools/cardstats.ts` measures each card's value. Campaign bench unchanged.
- **Heroes (D32):** every hero's level condition is measured with `npm run herosim`: a hero that reaches the Line
  ascends in 50-96% of its games, around round 6-9, on a counter its own nation feeds (before: 11 of 24 under half,
  Otto Brandt 10%, Maudrey Hale 8%). The value pass rerun shrank Hoarhorn's and Maudrey's ascended faces, and 13
  premades swapped cards to stay in D31's band: on fresh seeds 23 of 24 sit at 47.7-53.5% and Floodgate at about
  46-47% (BALANCE B-8). **Not yet played by the owner.**
- **Re-skin (D12, D16, D24):** every card and hero has its Magitek Wars name and text; the Spire is printed as the
  Crystal (each nation's heart crystal) and a glyph as a tactic; the magic substance is crystal, not "gloam"
  (`docs/RESKIN.md`, audit-checked). Card ids and the spec's internal words are unchanged.
- **Title (D13):** Vaskor at dusk with the six faction leads; menu CAMPAIGN, QUICK BATTLE, CONTINUE, DECK BUILDER,
  CARD GALLERY, CREDITS.
- **Quick battle (D17):** 24 premade decks, six single-faction decks and any saved legal deck, against a chosen or
  random foe deck at three AI levels. The 512 x 448 battle screen draws attack and block lines, floating damage and
  repair numbers, a log viewer (LOG or L) and a Scrap viewer (click a Scrap count). Autosaves after every move;
  CONTINUE reopens it. `?auto&fast` lets the AI play both seats: all 30 decks played a full battle this way with no
  error.
- **Deck builder (D19):** build and save decks from the 300 cards with the engine's deck rules; legal decks show up in
  QUICK BATTLE.
- **Campaign (D18, spec 20):** pick a faction, then three acts of seven floors (skirmish, elite, event, rest, supply
  depot, boss) with one growing deck and a Crystal that carries its damage; a won battle repairs it by 3. Eight events
  (R-R11), a briefing before each battle with the foe's deck (R-R12), boss intros with the boss's portrait. Balance
  R-2: 7 of 18 stand-in runs get past act 1 and 2 win. Kept as it was by D34.
- **Expeditions (D33, D34, spec 21; EXPEDITIONS on the title menu):** pick one of the six faction-lead heroes and a handmade
  expedition (The Thrumhollow Road 1 star, Across the Rimeglass 2, The Gates of Vaskor 3; each opens when the one
  before is won). A 24-card starter built around the hero, who is always drawn early (engine R-X4); the Crystal carries
  between battles. Stops: battle, elite, boss, rest, depot, event, command post (pick 1 of 3 **Orders**, powers for the
  whole run, engine R-X6), parts cache (1 of 3 **Fittings** on every copy of one card, R-X5) and recruiting post (a
  second hero joins). Rewards are card bundles (hero, faction, wild). Each hero keeps a **rank** between runs (XP,
  ranks 1-8: starting scrip, a signature Order, better rests, a signature Fitting, an extra Order, better field
  repairs, a mastery Order). Bosses and elites carry their own Orders, shown in the briefing; in battle each side's
  Orders sit on its bar (hover or hold to read). Its own save slot. Balance R-3.
- **Look (D25):** the interface no longer looks 8/16-bit: real type (Cinzel headings and buttons, Fira Sans text,
  sentence case), smoked-glass panels in brass frames, brass buttons, rounded card frames with stat badges, a crystal gem
  for each Crystal and painted, darkened battlefields behind the menu screens (`src/ui.ts`, ART-STYLE section 7). The
  trained LoRA art is unchanged. **Not yet seen by the owner.**
- **Screen (D21-D23):** the frame fills the window at any size and shape, sharp at in-between scales; battles spread across wide screens, other screens sit in the middle with a soft fill at the sides. Art is drawn in full detail by default; ART: PIXEL on the title menu (or P) brings back the snapped 16-bit art. **Phone:** a tap acts on release and a 400 ms hold inspects a card. Checked at 390 x 844.
- **Art (D3, D14, D15, D20):** style LoRAs `mkw16_v1`-`v3` (v3 is the house LoRA, `lora/RUNS.md`); card art for all
  332 faces, 48 hero portraits (base and ascended), six emblems, seven battlefields; picks in `tools/art/picks.md`.
- **Sound (D20):** seven music tracks (title, calm, battle, tense, victory, defeat, ascend) and twelve effects
  rendered on the local Audio Studio, levelled to one loudness (`tools/audio/`, `public/audio/`); M mutes. Kinds
  without a sample keep their synthesized voice. Measured and decoded in the browser, **not yet heard by anyone**.
- **Elsewhere:** KB entry `magitek-wars.md` in `dragoonant/tabletop-kb`. Flux Studio LoRA support on branch
  `feat/flux-studio-lora` of `dragoonant/local-ai-studio` (not merged).

## Waiting on the owner
- Listen to the music and effects; play-test the B-6 card changes and the retuned premades (B-7), whether heroes now ascend often enough (D32), the battles, the campaign's difficulty (R-2), the new Expeditions mode (D33: difficulty R-3, the six starters and the Order and Fitting lists) and the deck builder.
- Q2 interface concept and Q5 re-skin map (`PLAN.md`), kept as built for now.
- ElevenLabs: its CLI sign-in needs the owner's approval in the browser before it can replace the local sound.
- Flux Studio: merge `feat/flux-studio-lora` (fast-forward) and restart the studio.
- Verdict on LoRA v3 (`lora/runs/v3-compare.webp`).

## Next
1. Expeditions: owner play-test of D33; Captain Dasha Quill (Gale Exchange) is far the hardest hero (R-3); more
   expeditions and hero-specific level-up powers once the owner has played the first three. Campaign: act 1 elites
   (24 cards, Veteran) are still its main wall (R-2).
2. Art: a prompt pass for cards that drifted to modern-war looks, now with v3.
3. Sound: hero voice lines (the manifest's voice list is empty), once the owner picks ElevenLabs or local voices.
