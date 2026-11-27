# Magitek Wars

An original 16-bit-style game of steam and gloam for the browser. An empire runs on gloamsteam drawn from the glass
roots under the continent, and the land above them is dying. Everything here (world, names, story, rules, sprites,
palette and font) is our own; it is not based on any published game.

**Play:** https://dragoonant.github.io/magitek-wars/ (title screen only for now)

## Status
The game runs on a copy of the Annals of Scrivenearth card engine (300 cards, AI, full test suite), being re-skinned for this world. The first clickable is a title screen drawn entirely in code at 256 x 224 (house palette, house bitmap font, a dusk city,
a gloamwork strider, a riveted menu window). Keyboard (arrows, Enter, Esc) and touch or mouse. See `STATUS.md`.

## Docs
| File | What it holds |
|---|---|
| `PLAN.md` | Every decision, and the open questions for the owner |
| `STATUS.md` | Where the project stands now |
| `docs/ART-STYLE.md` | The 16-bit house style in plain measurements: grid, palette, outlines, dithering, sizes |
| `docs/LORA.md` | Plan for a style LoRA trained on our own approved renders and recorded CC0 art |
| `docs/WORLD.md` | The world sketch: factions, places, characters |

## Develop
```
npm install
npm run dev        # local server
npm run gate       # typecheck, tests, build
```
Push to `main` runs the gates and deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`).

## Credits
Design and code: **evilgouki**. All art is drawn in code for now; no external art, fonts or sounds.
