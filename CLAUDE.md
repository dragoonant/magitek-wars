# Magitek Wars: agent orientation

An **original** 16-bit-style browser game set in a steam-and-magic empire (PLAN D1). Nothing from Final Fantasy or
any other published game, book or show: no names, characters, places, story, cards, music, sprites or art.

## Regime
1. `PLAN.md` is the only place a decision lives. `STATUS.md` is rewritten, not appended.
2. Art follows `docs/ART-STYLE.md` (256 x 224, house palette, 15 colours per sprite). Every displayed pixel colour
   comes from `src/palette.ts`.
3. The LoRA dataset (`docs/LORA.md`) is only our own approved renders or CC0/permissive art with a recorded licence.
   Never ripped or copyrighted game art.
4. Image prompts follow the owner's banned-word list (tabletop-kb `rules.md` rule 23); describe figures in plain
   measurements and materials.

## Hard rules (dragoonant/tabletop-kb `rules.md`)
- Playable first; every stage ends in something clickable on Pages.
- No native tooltips; prompts name what they decide; open information; every displayed number from the engine.
- Autosave with Continue (rule 22); no text selection on long press (rule 24); this game has its own look (rule 21).
- Credit "evilgouki". Never a real name, email or home path in the repo. Grep before every commit.

## Commands
`npm run dev` · `npm test` · `npm run typecheck` · `npm run gate`

## Deploy
Push to `main` runs the gates and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
