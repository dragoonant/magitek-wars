# Art style: illustrated steam and brass

**PLAN D25 (2026-11-28) changes the interface:** owner, "The game screens look too 8-bit ... move away from that
look ... Base it more on the new art style that we've trained, not pixelated or 8/16-bit." The trained LoRA art is
the anchor. Everything drawn in code is now drawn smoothly at the screen's own resolution: real type (section 5),
smoked-glass panels in brass frames (section 7), gradients, soft shadows and glows. The house palette still names
every colour; gradients and transparency blend between house colours. The 16-bit rules below (grid, sub-palettes,
dithering, sprite sizes) now apply only to the snapped PIXEL art and the old code-drawn sprites, not to the interface.

This is the house style for Magitek Wars (PLAN D1, D5). It describes a home-console look from the 16-bit era in
plain measurements, so any art (hand-drawn, code-drawn or generated and cleaned) can be checked against numbers.
It copies no published game: no sprites, tiles, palettes, fonts, menus or character designs are taken from one.

Presentation concept (D5, revised by D25): **field dispatches from a war of steam and crystal**, illustrated: painted
battlefields behind smoked glass and brass, not a 16-bit cartridge.

## 1. Screen and grid
| Item | Rule |
|---|---|
| Logical resolution | **256 x 224** pixels. Every screen is composed at this size. |
| Art detail | Rendered art is drawn in full detail by default, or snapped to the grid with ART: PIXEL (PLAN D22). The interface is drawn at the screen's resolution in both (PLAN D25): logical coordinates, sub-pixel positions allowed. |
| Display | The frame fills the window (PLAN D21); its logical width follows the window from 512 to 1280 at a height of 448 (PLAN D23). Battles use the whole width; 512-wide screens sit in the middle with a blurred copy of themselves at the sides. A whole-number scale is drawn nearest-neighbour; any other scale is drawn nearest-neighbour at the next whole number up and smoothly reduced to fit (sharp bilinear), at one backing pixel per device pixel, so pixel columns stay even. Square pixels; we do not emulate the 8:7 stretch. Letterbox the rest in ink (`#080810`). |
| Tile | **8 x 8**. Backgrounds and UI snap to the 8 px grid. Metatiles are 16 x 16. |
| Positions | Whole pixels only. No sub-pixel sprite movement, no rotation or scaling of sprites at run time (rotation is drawn as frames). |
| Frame | 60 logical frames per second. Animation frames are held 6-12 frames; palette cycles step every 4-12 frames. |

## 2. Colour
| Item | Rule |
|---|---|
| Colour depth | 15-bit: each channel is a multiple of 8 (0-248). `tests/title-style.test.ts` checks it. Gradients, shadows and transparency (`rgba()` in `src/palette.ts`) blend house colours and are allowed in the interface (PLAN D25). |
| House palette | 31 colours plus transparent, in `src/palette.ts` (table below), for everything drawn in code. New colours need a PLAN decision. Rendered art keeps its own reduced palette (section 9, PLAN D14). |
| Per sprite | At most **15 colours plus transparent** (one 4-bit sub-palette). |
| Per background tile | At most 15 colours plus transparent; aim for no more than 128 colours on screen at once. |
| Large art (bosses, key portraits) | Up to two sub-palettes (30 colours). |
| Ramps | 3-4 tones per material: shadow, base, light, glint. Hue-shift: shadows lean cool (toward violet), lights lean warm (toward yellow). |
| Extremes | No pure black and no pure white. Darkest is ink `#080810`, lightest is steam white `#e8e8e0`. |
| Light | Key light from the top left; rim light from the sun or a crystal source where a scene has one. |

### House palette (`src/palette.ts`)
| Group | Colours |
|---|---|
| Ink and iron | ink `#080810`, iron night `#181828`, iron dark `#283040`, iron `#485060`, iron light `#788090`, steam `#b0b8c0`, steam white `#e8e8e0` |
| Brass | brass shadow `#382010`, brass dark `#704818`, brass `#b07828`, brass light `#e0b040`, brass glint `#f8e898` |
| Ember | ember night `#401020`, ember deep `#782028`, ember `#c04028`, ember bright `#f07830`, ember glow `#f8b848` |
| Dusk | dusk zenith `#100828`, dusk high `#201848`, dusk mid `#402860`, dusk low `#704070` |
| Crystal (magic) | crystal deep `#083830`, crystal dark `#107058`, crystal `#20b088`, crystal bright `#60f0c0`, crystal white `#d0f8e8` |
| Earth and skin | moss dark `#283018`, moss `#506030`, verdigris `#387068`, skin shadow `#a86848`, skin `#e8a878` |

## 3. Outlines
- Sprites: **1 px** outline. Outer edge in ink; interior lines in the darkest tone of the local colour (selective
  outline). On sprites 32 px or taller, the top-left lit edge of the outline may lift to the local shadow tone.
- Backgrounds have no outer outlines; shapes read by value (far layers lighter and lower contrast).
- Lines step in even runs (1-1-1, 2-2-2, 1-2-4); no doubled corners, no stray single pixels on a curve.

## 4. Dithering
- Only on backgrounds and large art. Two patterns: **50% checker** and **25% ordered** (one pixel in four).
- At most two dithered bands, each 2 px tall, between two tones of a gradient.
- Never on sprites under 32 px tall, never on faces, never random noise.
- Hand anti-aliasing only on art 48 px or taller, using tones already in the ramp, one intermediate pixel per step.

## 4a. Character sprites (owner's reference, PLAN D11)
The owner chose a reference sheet of 18 standing character sprites on a flat navy ground (2026-11-26: "here's the
art style i want you to use"). What we take from it is **how the sprites are drawn**, measured here; none of its
characters, costumes or creatures are reproduced, and the sheet is not used as LoRA training data (PLAN D3).
- **Proportions:** about 2.8 head-heights; the head (hair included) is about 35% of the sprite's height; shoulders
  about 1.4 times the head's width; legs about one head long; hands and boots drawn large and solid (about a third
  of a head each) so they read at small size.
- **Pose:** standing three-quarter view facing the viewer's left or right, feet planted, weapon or prop held at the
  side; one sprite per character on a flat ground, about one sprite-width of space between sprites.
- **Faces:** serious and readable: eyes 2 px tall with a 1 px highlight, brows drawn, nose by a single shadow pixel,
  mouth 1-2 px. No oversized eyes.
- **Outline:** a 1 px dark outline all round, in a near-black tone of the local colour (ink on armour, dark brown on
  skin and leather); interior lines in the material's darkest tone.
- **Shading:** strong top-left key light, 3-4 tones per material plus a 1 px specular glint on metal; hair in
  clumped locks with 2-3 tones; no dithering on characters.
- **Colour:** saturated, one or two dominant hues per character (red cape on grey plate, green hood on brown
  leather, gold plate with red cloth), within the 15-colour sprite limit.
- **Contact sheets** for owner review use the same layout: two rows of nine on a flat dusk-zenith or deep-navy
  ground, labelled underneath.

## 5. Sizes
| Asset | Size (px) | Notes |
|---|---|---|
| Field sprite (walking) | 16 x 24 | Head 9 tall (about 2.7 head-heights), the section 4a look simplified. 3-frame walk per facing, 4 facings. |
| Battle sprite (person) | 24-32 x 32 | The section 4a look: head about 11 tall (about 2.8 head-heights, 35% of height), shoulders about 15 wide. Idle 2 frames, act 4 frames, hurt 1. Large creatures up to 32 x 40. |
| Battle sprite (crystalwork machine) | 48 x 48 | Pilot always enclosed behind a porthole; never an open saddle seat. |
| Dialogue portrait | 48 x 48 | Crown to collarbone, face 20 tall, one sub-palette, framed by a 2 px brass bevel. |
| Card or plate art (if D4 keeps cards) | 64 x 48 | Shown inside a 72 x 104 frame at logical size; x2 in the card viewer. |
| Boss and key art | 128 x 128 to 192 x 160 | Two sub-palettes, dithering and hand anti-aliasing allowed. |
| Item and status icons | 8 x 8 or 16 x 16 | One sub-palette shared per icon sheet. |
| Type | Fonts, not pixels (PLAN D25) | `src/font.ts`: **Cinzel** Bold for the wordmark, headings and buttons (capitals); **Fira Sans** Medium/Bold for everything read (card text, the log, descriptions) in sentence case. Both SIL OFL 1.1, bundled. Body size 9.4 logical px; lines 10 px apart. |

## 6. Backgrounds
- Built from 8 x 8 tiles in up to **three parallax layers**: far (sky and mountains), middle (city or terrain),
  near (ground, rail, foreground rocks). Each layer has its own flat value; farther is lighter and lower contrast.
- Skies are horizontal bands 8-28 px tall with dithered transitions (section 4).
- Life comes from **palette cycling** (window lights, furnace glow, crystal beacons, water) and a few small sprites
  (smoke, airships, birds), not from redrawing the layer.

## 7. Interface
The kit is `src/ui.ts` (PLAN D25); screens use it rather than drawing their own frames.
- Windows (`panel`): rounded 4 px corners, a soft drop shadow, a smoked-glass interior (dusk high to ink, about 90%
  opaque, with a faint sheen across the top), a 1.5 px brass frame lit from the top, a hairline inner edge and a
  brass stud in each corner. Text inset 8 px. `tone: 'dark'` for panels that sit over busy art.
- Buttons (`button`): rounded brass with a top highlight and an ink edge, Cinzel capitals in brass shadow; `hot` glows,
  `off` is iron, `danger` is ember, `picked` is the chosen option of a set.
- The picked row of a list (`highlight`) is a brass wash fading to the right with a bright left edge; the item under
  the pointer or keyboard glows. No pixel cursor.
- Cards and pictures sit in rounded frames (`frame`, `clipRound`) with the art cropped to the frame; numbers sit in
  round badges (cost in crystal, power in brass, health in iron, hurt health in ember).
- Menu screens sit on a painted backdrop (`backdrop`): a battlefield render, softened and darkened, with a vignette.
- Disabled items are drawn in iron; they are still visible (open information).
- No native tooltips; every number shown comes from the engine.

## 8. Must not look like
- **Annals of Scrivenearth** (our previous game): cut crystal, cyan conduits, glassy frames, serif type.
- **Xross Forge** and **Shadowforge** (sibling projects): broadcast-stage neon, filigree frames.
- **Any published 16-bit RPG:** no blue gradient window with a white border, no recreated sprites, tiles, fonts,
  monsters, airships or armour designs, no recognisable character silhouettes or hairstyles.
- **The figures on the owner's reference sheet** (section 4a): we take its drawing style, not its characters. In
  particular no winged white cat-creature with a pom-pom antenna, no horned blue dragoon armour, no white horned yeti.

## 9. Generated art (PLAN D14)
Scene and character art is rendered with the house style LoRA (shown in full detail, or fixed to the grid for ART:
PIXEL); interface pieces (windows, buttons, type) are drawn in code from the house palette (section 7).
1. Render on EVILAEGIS with `tools/art/render.mjs` (distilled FLUX.2 klein, `mkw16_v2` at 1.0, 4 steps), a
   plain-measurement prompt (owner's banned-word list, PLAN D7) and several seeds. No lettering.
2. Pick on a labelled contact sheet: no lettering or logos, no doubled props or extra limbs, the subject as asked.
3. Snap with `tools/art/snap.mjs`: a scene becomes exactly its logical size (most common colour per cell, at most 96
   colours); a figure is cut from its flat ground and reduced to its logical height (at most 32 colours, hard 1-bit
   transparency).
4. Record the render id and seed of every shipped piece in `tools/art/picks.md`.
5. The owner sees every shipped piece in the game and the candidates on contact sheets; anything the owner rejects
   is re-rendered or removed.
