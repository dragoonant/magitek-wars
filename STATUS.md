# Status (2026-11-26)

**Live:** https://dragoonant.github.io/magitek-wars/ shows the placeholder title screen.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
- **Engine (PLAN D4):** Annals of Scrivenearth's engine, AI, card data (300 cards, 24 heroes, 6 factions), deck
  builder model, tests and tools, copied at 8b4ebac. `npm run gate` passes here: 458 tests, the card audit (332
  faces), the mutation pass (every card's test bites), the AI bench and the build. Save and deck storage use this
  game's own keys.
- **Not yet re-skinned:** card, hero and faction names, card text and the tutorial are still Annals' (D12 is the map).
  There is no match client yet: the Annals client stayed behind (rule 21), and with it the client-text, audio-map
  and forecast tests.
- **Title screen:** 256 x 224, drawn in code (house palette, 5x7 font, Vaskor at dusk, a gloamwork strider, riveted
  menu). NEW GAME and CREDITS open dialogs; CONTINUE is greyed until a save exists.
- **Art:** `docs/ART-STYLE.md` section 4a records the owner's reference sheet as the character style (D11), drawing
  style only. LoRA base is FLUX.2 klein (D3).
- Docs: `PLAN.md`, `docs/ART-STYLE.md`, `docs/LORA.md`, `docs/WORLD.md`, plus the inherited `docs/spec/10-rules.md`,
  `docs/AUTHORING.md`, `docs/SETS.md`, `BALANCE.md`.

## Waiting on the owner
- Q2 interface concept, Q4 licence, Q5 re-skin map (`PLAN.md`).

## Next
1. Re-skin the card data per D12: new names, text and heroes per faction; ids renamed with the factions; audit and
   mutation stay green.
2. The match client in this game's look (board, hand, HUD, prompts, log), so NEW GAME starts a match against the AI.
3. Art audition on EVILAEGIS: a contact sheet of 18 faction characters in the section 4a style (FLUX.2 klein,
   cleaned to the grid), to the owner before any batch; the approved ones seed the LoRA dataset.
4. KB: a `magitek-wars.md` entry in `dragoonant/tabletop-kb` (rule 19).

Not verified: the title screen has been checked in headless Chromium at desktop size only, not on a phone.
