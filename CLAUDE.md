# Magitek Wars: agent orientation

An **original** illustrated browser card game set in a steam-and-magic empire (PLAN D1). Nothing from Final Fantasy or
any other published game, book or show: no names, characters, places, story, cards, music, sprites or art.

## Regime
0. The engine is a copy of Annals of Scrivenearth's (PLAN D4), re-skinned per D12. **The spec is the product**:
   rules live in `docs/spec/10-rules.md` with ids; code comments and test names cite them; ambiguities become
   `RULING:` lines. Balance changes need a sim result in `BALANCE.md` (negative results kept). One door per rule in
   the engine (`damage`, `summon`, `draw`, `stats`, `costOf`, `stateCheck`); no silent fallbacks. The AI only ever
   receives `view(state, seat)`. Card authoring: `docs/AUTHORING.md`.
1. `PLAN.md` is the only place a decision lives. `STATUS.md` is rewritten, not appended.
2. Art follows `docs/ART-STYLE.md`. The trained LoRA art is the look; the interface is drawn smoothly at screen
   resolution with the `src/ui.ts` kit and real type (Cinzel, Fira Sans), never as 8/16-bit pixels (PLAN D25).
   Every colour drawn in code is a house colour from `src/palette.ts` (gradients and transparency blend them).
3. The LoRA dataset (`docs/LORA.md`) is only our own approved renders or CC0/permissive art with a recorded licence.
   Never ripped or copyrighted game art.
4. Image prompts follow the owner's banned-word list (tabletop-kb `rules.md` rule 23); describe figures in plain
   measurements and materials.

## Hard rules (dragoonant/tabletop-kb `rules.md`)
- Playable first; every stage ends in something clickable on Pages.
- No native tooltips; prompts name what they decide; open information; every displayed number from the engine.
- Autosave with Continue (rule 22); no text selection on long press (rule 24); this game has its own look (rule 21).
- Credit "evilgouki". Never a real name, email or home path in the repo. Grep before every commit.

## Layout
- `src/engine/` rules (`types.ts` is the contract), `src/data/cards/` one file per faction, `src/ai/`,
  `src/deckbuilder/`; screens: `src/main.ts` (one 512 x 448 canvas), `title.ts`, `scene.ts`, `gallery.ts`,
  `src/match/` (battle screen, deck select, session, log text), `src/run/` (campaign rules and screens, spec 20),
  `src/expedition/` (Hero Expeditions, the Path of Champions-style mode, spec 21).
- Card names and words follow `docs/RESKIN.md` (Crystal, tactic); art pipeline in `tools/art/`, LoRA in `tools/lora/`.
- `tests/` Vitest (rule-id tests, one behaviour test per card and hero); `tools/sim.ts` arena; `tools/runsim.ts`
  campaign bench; `tools/expsim.ts` Expeditions bench; `tools/gate.ts`. `?auto&fast` in the URL lets the AI play both seats of a battle.

## Commands
`npm run dev` · `npm test` · `npm run typecheck` · `npm run sim -- --games 100 --a normal --b random` · `npx tsx tools/cardstats.ts` (per-card value, BALANCE B-6) · `npx tsx tools/tourney.ts` (premade band, PLAN D31) · `npm run gate`

## Deploy
Push to `main` runs the gates and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
