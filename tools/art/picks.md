# Shipped art: render picks

Every piece in `public/art/` with the job and seed it came from (`tools/art/jobs-*.mjs`, rendered by
`tools/art/render.mjs` with `mkw16_v2` at 1.0) and how it was snapped (`tools/art/snap.mjs`).

## Title (PLAN D13)
| File | Render | Snap |
|---|---|---|
| `art/title/backdrop.png` | `bg-dusk` seed 3106 (of 8 dusk, 8 night) | scene 256 x 224, 96 colours |
| `art/title/emblem.png` | `emblem` seed 3804 (of 6) | sprite 40 tall, 32 colours |
| `art/title/wren.png` | `ch-wren` seed 3301 (of 4) | sprite 48 tall, flipped |
| `art/title/ilse.png` | `ch-ilse` seed 3201 (of 4) | sprite 48 tall, flipped |
| `art/title/ulla.png` | `ch-ulla` seed 3403 (of 4) | sprite 48 tall, flipped |
| `art/title/vell.png` | `ch-vell` seed 3701 (of 4; 3703 held two lanterns) | sprite 48 tall |
| `art/title/ebbe.png` | `ch-ebbe` seed 3601 (of 4) | sprite 48 tall |
| `art/title/dasha.png` | `ch-dasha` seed 3503 (of 4) | sprite 48 tall |

## Faction emblems (`tools/art/jobs-world.mjs`, sprite 32 tall)
| File | Render |
|---|---|
| `art/emblems/dominion.png` | `em-dominion` seed 5002 (of 4) |
| `art/emblems/gauge.png` | `em-gauge` seed 5404 (of 4; the others drew two spanners) |
| `art/emblems/sedgekin.png` | `em-sedgekin` seed 5304 (of 4) |
| `art/emblems/gale.png` | `em-gale` seed 5204 (of 4) |
| `art/emblems/choir.png` | `em-choir` seed 5101 (of 4) |
| `art/emblems/blackwick.png` | `em-blackwick` seed 5501 (of 4) |

## Battlefields (`tools/art/jobs-world.mjs`, scene 256 x 224, 96 colours)
| File | Render |
|---|---|
| `art/fields/vaskor.png` | `bf-vaskor` seed 5603 (of 4) |
| `art/fields/thrumhollow.png` | `bf-thrumhollow` seed 5702 (of 4) |
| `art/fields/sedgemere.png` | `bf-sedgemere` seed 6002 (of 4) |
| `art/fields/kitebarrow.png` | `bf-kitebarrow` seed 5902 (of 4) |
| `art/fields/hush.png` | `bf-hush` seed 6101 (of 4) |
| `art/fields/greying.png` | `bf-greying` seed 6202 (of 4) |
| `art/fields/rimeglass.png` | `bf-rimeglass` seed 5802 (of 4) |

## Cards (`tools/art/jobs-cards.mjs`, scene 64 x 48 and 128 x 96)
Subjects and proposed names per faction in `tools/art/cards/*.mjs`; two seeds per card. The first seed ships unless
`tools/art/card-picks.txt` names the other one (or `none`, which shows NO ART). `tools/art/build-cards.mjs` snaps
the picks and regenerates `src/data/cardart.ts`.
