# Status (2026-11-26)

**Live:** https://dragoonant.github.io/magitek-wars/ shows the title screen in the LoRA look and a card gallery.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
- **Engine (PLAN D4):** Annals of Scrivenearth's engine, AI, card data (300 cards, 24 heroes, 6 factions), deck
  builder model, tests and tools, copied at 8b4ebac. `npm run gate` passes here: 460 tests, the card audit (332
  faces), the mutation pass (every card's test bites), the AI bench and the build. Save and deck storage use this
  game's own keys.
- **Not yet re-skinned:** card, hero and faction names, card text and the tutorial are still Annals' (D12 is the map).
  There is no match client yet: the Annals client stayed behind (rule 21), and with it the client-text, audio-map
  and forecast tests.
- **Title screen (D13, done):** 256 x 224. Vaskor's Gear Citadel at dusk between two cliffs and the six faction leads
  on the cliff tops (rendered with `mkw16_v2`, snapped by `tools/art/snap.mjs`), a winged gear emblem, a Cinzel
  wordmark reduced to pixels and coloured in code, twinkling stars. NEW GAME and CREDITS open dialogs; CARD GALLERY opens the gallery; CONTINUE is
  greyed until a save exists.
- **Card gallery (D15):** all 308 cards and 24 ascended forms by faction, with art (330 of 332 faces; two cards say
  NO ART because every render had stray lettering), the proposed name (D12, pending Q5), and the engine's cost,
  power, health, text and ascend condition. Six faction emblems and seven battlefields (one per WORLD place) are in
  `public/art/`. Render picks: `tools/art/picks.md`, `tools/art/card-picks.txt`.
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
0. Art still to do: hero portraits (48 x 48) and board sprites for the match client; re-render the two cards without
   art (`ember-meltdowngolem`, `storm-steepdive`); a prompt pass for the Dominion and Free Gauge cards that drifted
   to modern-war looks (steel helmets, a tank). The owner reviews the gallery; rejected art is re-rendered.
1. Re-skin the card data per D12: new names, text and heroes per faction; ids renamed with the factions; audit and
   mutation stay green.
2. The match client in this game's look (board, hand, HUD, prompts, log), so NEW GAME starts a match against the AI.
3. Art audition on EVILAEGIS: a contact sheet of 18 faction characters in the section 4a style (FLUX.2 klein,
   cleaned to the grid), to the owner before any batch; the approved ones seed the LoRA dataset.
4. KB: a `magitek-wars.md` entry in `dragoonant/tabletop-kb` (rule 19).

Not verified: the title screen has been checked in headless Chromium at 1024 x 896 only, not on a phone.
