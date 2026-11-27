# Status (2026-11-26)

**Live:** https://dragoonant.github.io/magitek-wars/ shows the title screen in the LoRA look.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
- **Engine (PLAN D4):** Annals of Scrivenearth's engine, AI, card data (300 cards, 24 heroes, 6 factions), deck
  builder model, tests and tools, copied at 8b4ebac. `npm run gate` passes here: 456 tests, the card audit (332
  faces), the mutation pass (every card's test bites), the AI bench and the build. Save and deck storage use this
  game's own keys.
- **Not yet re-skinned:** card, hero and faction names, card text and the tutorial are still Annals' (D12 is the map).
  There is no match client yet: the Annals client stayed behind (rule 21), and with it the client-text, audio-map
  and forecast tests.
- **Title screen (D13, done):** 256 x 224. Vaskor's Gear Citadel at dusk between two cliffs and the six faction leads
  on the cliff tops (rendered with `mkw16_v2`, snapped by `tools/art/snap.mjs`), a winged gear emblem, a Cinzel
  wordmark reduced to pixels and coloured in code, twinkling stars. NEW GAME and CREDITS open dialogs; CONTINUE is
  greyed until a save exists.
- **Art:** `docs/ART-STYLE.md` section 4a records the owner's reference sheet as the character style (D11). Two style
  LoRAs are trained on EVILAEGIS (D3, `lora/RUNS.md`): **`mkw16_v1`** (51 sprites from the owner's three Gemini
  sheets) and **`mkw16_v2`** (those plus 121 of our own renders of scenes, buildings, machines, creatures, items and
  people in motion, 3000 steps in 50 minutes). Both work on the distilled klein in ComfyUI. v2 fixes v1's prop
  confusion (the owl on a lamp post) and is otherwise level with it; both still double a held prop now and then, and
  neither renders a true pixel grid, so `tools/lora/clean.mjs` snaps renders afterwards. Flux Studio's API has no LoRA
  field yet; `tools/lora/test-v2.mjs` and `gen-v2.mjs` drive ComfyUI directly.
- Docs: `PLAN.md`, `docs/ART-STYLE.md`, `docs/LORA.md`, `docs/WORLD.md`, plus the inherited `docs/spec/10-rules.md`,
  `docs/AUTHORING.md`, `docs/SETS.md`, `BALANCE.md`.

## Waiting on the owner
- Q2 interface concept, Q4 licence, Q5 re-skin map (`PLAN.md`).

## Next
0. Art for the rest of the game (owner, 2026-11-26: "work the art for everything else"): the asset list in
   `docs/ART-STYLE.md`, rendered and snapped the same way.
1. Re-skin the card data per D12: new names, text and heroes per faction; ids renamed with the factions; audit and
   mutation stay green.
2. The match client in this game's look (board, hand, HUD, prompts, log), so NEW GAME starts a match against the AI.
3. Art audition on EVILAEGIS: a contact sheet of 18 faction characters in the section 4a style (FLUX.2 klein,
   cleaned to the grid), to the owner before any batch; the approved ones seed the LoRA dataset.
4. KB: a `magitek-wars.md` entry in `dragoonant/tabletop-kb` (rule 19).

Not verified: the title screen has been checked in headless Chromium at 1024 x 896 only, not on a phone.
