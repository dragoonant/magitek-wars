# Plan and decisions

The only place a decision lives. `by` is `owner` (with the owner's words) or `default` (stated, correctable in a word).
A `default` that waits on an open question is marked **pending Q<n>**; work continues on the default (KB rule 20).

| # | Date | Decision | By |
|---|---|---|---|
| D1 | 2026-11-26 | **An original 16-bit game called Magitek Wars.** Owner: "Original 16-bit direction is fine ... public repo, lets call it Magitek Wars." The world (steam-and-magic empire), names, characters, places, story, cards, music, sprites and art are all written and drawn fresh. Nothing from Final Fantasy or any other published game, book or show: no names, characters, places, story beats, cards, music, sprites, art or recognisable designs. The title is the owner's choice. | owner |
| D2 | 2026-11-26 | Its own **public** repository, `dragoonant/magitek-wars`, separate from Annals of Scrivenearth; GitHub Pages deployed by GitHub Actions from `main`. | owner |
| D3 | 2026-11-26 | **A style LoRA for the 16-bit look**, trained on EVILAEGIS. Dataset: only our own Flux renders, cleaned to the pixel grid and approved by the owner, or CC0 / permissively licensed pixel art with every licence checked and recorded. Never ripped or copyrighted game art, never "in the style of" a published game or artist. Plan: `docs/LORA.md`. | owner |
| D4 | 2026-11-26 | **Engine: start from a copy of Annals of Scrivenearth's engine, AI, tests and tooling and re-skin it** (our own code, fully tested), rather than a fresh design. Nothing has been copied yet. **pending Q1** | default |
| D5 | 2026-11-26 | Presentation concept (KB rule 21): **"Field dispatches from a war of steam and gloam, on a 16-bit cartridge."** Riveted iron-and-brass window frames, smoked-glass panels, amber pixel type, palette-cycled gloam glow, dusk skies over smokestack cities. Must not look like: Annals of Scrivenearth (cut crystal, cyan conduits, glassy frames), Xross Forge, Shadowforge, or any published 16-bit RPG's blue gradient menu window. Style guide: `docs/ART-STYLE.md`. **pending Q2** | default |
| D6 | 2026-11-26 | Stack: Vite + TypeScript strict, plain DOM plus one 256x224 canvas drawn at integer scale, no framework; Vitest. | default |
| D7 | 2026-11-26 | Image prompts follow the owner's banned-word list (tabletop-kb `rules.md` rule 23) and describe figures in plain measurements and materials. | owner |
| D8 | 2026-11-26 | In the world, gloam-driven machines are called **gloamwork**; "Magitek" is the game's title only, so in-world text never leans on another game's term. | default |
| D9 | 2026-11-26 | Credit "evilgouki" everywhere; never a real name, email or home path in the repo. | owner |
| D10 | 2026-11-26 | The first clickable is a title screen drawn entirely in code (no external art, no fonts): a 5x7 house bitmap font, the house palette, a dusk city, a gloamwork strider and a riveted menu window. Continue is shown greyed until a save exists (KB rule 22). | default |

## Open questions for the owner
1. **Engine (D4):** copy Annals of Scrivenearth's engine, AI, tests and tooling and re-skin it (recommended: ours, fully
   tested), or start a fresh design? Nothing is copied until you answer.
2. **Look (D5):** is "field dispatches from a war of steam and gloam" the presentation concept? The live title screen
   shows it.
3. **LoRA base model (`docs/LORA.md`):** FLUX.2 klein (Apache-2.0, already in Flux Studio; recommended) or FLUX.1 dev
   (non-commercial licence)?
4. **Licence for the public repo:** none chosen yet (all rights reserved by default). Pick one, or keep it closed?
