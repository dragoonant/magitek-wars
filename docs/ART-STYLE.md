# Art style: an original 16-bit console look

This is the house style for Magitek Wars (PLAN D1, D5). It describes a home-console look from the 16-bit era in
plain measurements, so any art (hand-drawn, code-drawn or generated and cleaned) can be checked against numbers.
It copies no published game: no sprites, tiles, palettes, fonts, menus or character designs are taken from one.

Presentation concept (D5): **field dispatches from a war of steam and gloam, on a 16-bit cartridge.**

## 1. Screen and grid
| Item | Rule |
|---|---|
| Logical resolution | **256 x 224** pixels. Every screen is composed at this size. |
| Display | Integer scale only (x2, x3, x4 ...), nearest-neighbour (`image-rendering: pixelated`). Square pixels; we do not emulate the 8:7 stretch. Letterbox the rest in ink (`#080810`). |
| Tile | **8 x 8**. Backgrounds and UI snap to the 8 px grid. Metatiles are 16 x 16. |
| Positions | Whole pixels only. No sub-pixel sprite movement, no rotation or scaling of sprites at run time (rotation is drawn as frames). |
| Frame | 60 logical frames per second. Animation frames are held 6-12 frames; palette cycles step every 4-12 frames. |

## 2. Colour
| Item | Rule |
|---|---|
| Colour depth | 15-bit: each channel is a multiple of 8 (0-248). `tests/palette.test.ts` checks it. |
| House palette | 31 colours plus transparent, in `src/palette.ts` (table below). New colours need a PLAN decision. |
| Per sprite | At most **15 colours plus transparent** (one 4-bit sub-palette). |
| Per background tile | At most 15 colours plus transparent; aim for no more than 128 colours on screen at once. |
| Large art (bosses, key portraits) | Up to two sub-palettes (30 colours). |
| Ramps | 3-4 tones per material: shadow, base, light, glint. Hue-shift: shadows lean cool (toward violet), lights lean warm (toward yellow). |
| Extremes | No pure black and no pure white. Darkest is ink `#080810`, lightest is steam white `#e8e8e0`. |
| Light | Key light from the top left; rim light from the sun or a gloam source where a scene has one. |

### House palette (`src/palette.ts`)
| Group | Colours |
|---|---|
| Ink and iron | ink `#080810`, iron night `#181828`, iron dark `#283040`, iron `#485060`, iron light `#788090`, steam `#b0b8c0`, steam white `#e8e8e0` |
| Brass | brass shadow `#382010`, brass dark `#704818`, brass `#b07828`, brass light `#e0b040`, brass glint `#f8e898` |
| Ember | ember night `#401020`, ember deep `#782028`, ember `#c04028`, ember bright `#f07830`, ember glow `#f8b848` |
| Dusk | dusk zenith `#100828`, dusk high `#201848`, dusk mid `#402860`, dusk low `#704070` |
| Gloam (magic) | gloam deep `#083830`, gloam dark `#107058`, gloam `#20b088`, gloam bright `#60f0c0`, gloam white `#d0f8e8` |
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

## 5. Sizes
| Asset | Size (px) | Notes |
|---|---|---|
| Field sprite (walking) | 16 x 24 | Head 8 wide x 9 tall (about 2.7 head-heights). 3-frame walk per facing, 4 facings. |
| Battle sprite (person) | 32 x 48 | Head 12 tall (4 head-heights), shoulders 14 wide. Idle 2 frames, act 4 frames, hurt 1. |
| Battle sprite (gloamwork machine) | 48 x 48 | Pilot always enclosed behind a porthole; never an open saddle seat. |
| Dialogue portrait | 48 x 48 | Crown to collarbone, face 20 tall, one sub-palette, framed by a 2 px brass bevel. |
| Card or plate art (if D4 keeps cards) | 64 x 48 | Shown inside a 72 x 104 frame at logical size; x2 in the card viewer. |
| Boss and key art | 128 x 128 to 192 x 160 | Two sub-palettes, dithering and hand anti-aliasing allowed. |
| Item and status icons | 8 x 8 or 16 x 16 | One sub-palette shared per icon sheet. |
| Font | 5 x 7 in a 6 x 8 cell | House bitmap font (`src/font.ts`), upper case, digits, punctuation. About 40 characters per line. Wordmarks use it at x3. |

## 6. Backgrounds
- Built from 8 x 8 tiles in up to **three parallax layers**: far (sky and mountains), middle (city or terrain),
  near (ground, rail, foreground rocks). Each layer has its own flat value; farther is lighter and lower contrast.
- Skies are horizontal bands 8-28 px tall with dithered transitions (section 4).
- Life comes from **palette cycling** (window lights, furnace glow, gloam beacons, water) and a few small sprites
  (smoke, airships, birds), not from redrawing the layer.

## 7. Interface
- Windows: 1 px ink edge, 2 px brass bevel (light top-left, dark bottom-right), 1 px ink inner edge, a rivet at each
  corner, smoked-glass interior (dusk zenith with a 25% gloam-deep dither). Text inset 8 px.
- Cursor: a 7 x 7 brass pointer that bobs 1 px every 16 frames.
- Disabled items are drawn in iron; they are still visible (open information).
- Screen changes: palette fade or mosaic over 16 frames.
- No native tooltips; every number shown comes from the engine.

## 8. Must not look like
- **Annals of Scrivenearth** (our previous game): cut crystal, cyan conduits, glassy frames, serif type.
- **Xross Forge** and **Shadowforge** (sibling projects): broadcast-stage neon, filigree frames.
- **Any published 16-bit RPG:** no blue gradient window with a white border, no recreated sprites, tiles, fonts,
  monsters, airships or armour designs, no recognisable character silhouettes or hairstyles.

## 9. Generated art
Flux renders are not pixel art until they are cleaned:
1. Render at 1024 px with a plain-measurement prompt (owner's banned-word list applies, PLAN D7). No lettering.
2. Downscale to the target size with a box filter, then quantize to the house palette (or a 15-colour subset), no
   dithering.
3. Fix by hand: outlines (section 3), stray pixels, faces.
4. Check: colour count per sprite (section 2), every pixel on the house palette, no text or logos.
5. The owner approves contact sheets before anything ships or enters the LoRA dataset (`docs/LORA.md`).
