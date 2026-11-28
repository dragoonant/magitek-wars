# Magitek Wars

An original illustrated card battler of steam and crystal for the browser. An empire runs on crystal grown from the
glass roots under the continent, and the land above them is dying. Everything here (world, names, story, card text,
art direction) is our own; it is not based on any published game.

**Play:** https://dragoonant.github.io/magitek-wars/

## What is in it
- **Campaign:** a roguelike march across three acts: pick a faction, grow one deck through skirmishes, elites, events,
  rest stops, supply depots and bosses, with a Crystal that carries its damage (`docs/spec/20-roguelike.md`).
- **Quick battle:** any of 24 premade decks, six single-faction decks or your own, against the AI at three levels.
- **Deck builder** and **card gallery** for all 300 cards and 24 heroes.
- Art in full detail or as snapped pixel art (ART on the title menu, or P); the interface is drawn smoothly either way.
- Keyboard (arrows, Enter, Esc, L for the log, M for sound, P for the art) and mouse or touch. Saves itself after every move.

## Docs
| File | What it holds |
|---|---|
| `PLAN.md` | Every decision, and the open questions for the owner |
| `STATUS.md` | Where the project stands now |
| `docs/spec/10-rules.md` | The battle rules, with rule ids |
| `docs/spec/20-roguelike.md` | The campaign rules |
| `docs/RESKIN.md` | The words this game prints (Crystal, tactic) over the engine's |
| `docs/ART-STYLE.md` | The house style: the interface kit and type, the palette, and how rendered art is snapped for ART: PIXEL |
| `docs/LORA.md`, `lora/RUNS.md` | The style LoRA: data, settings, results |
| `docs/WORLD.md` | The world: factions, places, characters |
| `BALANCE.md` | Every balance question asked, with its sim result |

## Develop
```
npm install
npm run dev        # local server
npm run gate       # typecheck, tests, card audit, mutation pass, AI bench, build
```
Push to `main` runs the gates and deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`). `?auto&fast` in
the URL lets the AI play both seats of a battle.

## Credits and licence
Design and code: **evilgouki**. The card engine comes from Annals of Scrivenearth, also by evilgouki. Art is rendered
on our own machine with FLUX.2 klein and our own style LoRA, then fixed to the pixel grid in code. Title type: Cinzel
(SIL Open Font License, see `NOTICE.md`).

Copyright evilgouki. **All rights reserved** (PLAN D19): the code and art may be read and played here, not reused.
