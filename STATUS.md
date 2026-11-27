# Status (2026-11-26)

**Live:** https://dragoonant.github.io/magitek-wars/ shows the placeholder title screen.

## What exists
- Public repo `dragoonant/magitek-wars`; push to `main` runs typecheck, tests and build, then deploys to Pages.
- Title screen at 256 x 224, integer-scaled, drawn entirely in code: house palette (`src/palette.ts`), 5x7 house
  font (`src/font.ts`), Vaskor at dusk with palette-cycled windows and beacon, rising smoke, a drifting airship, a
  gloamwork strider, rotating brass gears, a riveted menu window. NEW GAME and CREDITS open dialogs; CONTINUE is
  greyed until a save exists.
- Docs: `PLAN.md`, `docs/ART-STYLE.md`, `docs/LORA.md`, `docs/WORLD.md`.
- Tests (`tests/style.test.ts`): palette is 15-bit, sprites stay within 15 colours, every on-screen string is
  drawable by the house font and fits its window.

## Waiting on the owner
- **Q1, engine:** copy Annals of Scrivenearth's engine, AI, tests and tooling and re-skin it (recommended), or a fresh
  design. Nothing has been copied.
- Q2 look, Q3 LoRA base model, Q4 licence (`PLAN.md`).

## Next
1. After Q1: bring in the engine (or start the fresh design) and get a first playable match on Pages.
2. LoRA: first dataset batch of 12 renders on EVILAEGIS, cleaned per ART-STYLE section 9, contact sheet to the owner.
3. KB: add a `magitek-wars.md` entry to `dragoonant/tabletop-kb` (rule 19).

Not verified: the title screen has been checked in headless Chromium at desktop size only, not on a phone.
