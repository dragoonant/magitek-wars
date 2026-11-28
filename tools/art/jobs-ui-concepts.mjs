// Battle screen layout concepts (five proposals, 2026-11-27). Concept images only: nothing here ships in the game.
// usage: node tools/art/render.mjs tools/art/jobs-ui-concepts.mjs art-out/ui-concepts none
// Rendered without the house LoRA (it is trained on figures and scenes, not interfaces). No lettering (ART-STYLE 9).
const B = 'A top-down screenshot of a digital card battle game board seen straight from above, widescreen, clean and readable, '
  + 'painted brass, blackened iron, warm amber lamplight and glowing teal crystal, a steam age empire, polished game interface art, no text, no letters, no numbers, no logos, ';
const seeds = (a, n) => Array.from({ length: n }, (_, i) => a + i);
const W = 1344, H = 768;
export const JOBS = [
  {
    id: 'ui1-gauge-table', w: W, h: H, seeds: seeds(9101, 4),
    text: B + 'one long dark iron table across the middle holds two rows of five illustrated cards, an empty lane between the rows, '
      + 'on the left edge two large round glowing crystal orbs set in brass rings, a red ember orb above for the opponent and a teal crystal orb below for the player, '
      + 'on the right edge a tall brass pressure gauge with a column of round glowing lamp segments and two small separate lamps beside it, '
      + 'a fan of cards at the bottom edge and a row of face-down card backs at the top edge, a big round brass valve wheel button on the right.',
  },
  {
    id: 'ui2-engine-hearth', w: W, h: H, seeds: seeds(9201, 4),
    text: B + 'a framed board like an ornate brass engine casing with riveted iron panels, a pale smooth plate in the centre for the cards, '
      + 'a round porthole window at the top centre showing a glowing ember crystal with a red droplet gem beside it, '
      + 'a matching porthole at the bottom centre showing a glowing teal crystal with a red droplet gem beside it, '
      + 'a row of ten small diamond shaped teal crystal pips along the bottom right edge, half of them lit, '
      + 'a stack of face-down cards on a brass rail at the right side, a large oval brass push button on the right middle, decorative pipes and gears in the four corners.',
  },
  {
    id: 'ui3-twin-boilers', w: W, h: H, seeds: seeds(9301, 4),
    text: B + 'a dark minimal board with two rows of illustrated cards, on the far left two upright glass tubes framed in brass, '
      + 'the top tube filled two thirds with glowing red ember liquid, the bottom tube filled with glowing teal liquid, '
      + 'beside each tube a round brass pressure dial with a needle, thin glowing teal lines framing the player row, '
      + 'a fan of cards along the bottom edge, plenty of empty dark space, soft steam drifting across the edges.',
  },
  {
    id: 'ui4-clockface', w: W, h: H, seeds: seeds(9401, 4),
    text: B + 'a round brass clock dial at the bottom centre with a glowing teal crystal at its hub and a ring of lit segments around it, '
      + 'a matching dial with a red ember crystal hub at the top centre, two rows of illustrated cards curving gently between the two dials, '
      + 'a wide clear lane in the middle with faint brass engraved lines, the hand of cards fanned below the bottom dial, '
      + 'dark iron background with subtle rivets, symmetrical composition.',
  },
  {
    id: 'ui5-workbench', w: W, h: H, seeds: seeds(9501, 4),
    text: B + 'a wooden and brass map table seen from above, illustrated cards lying on green felt in two rows, '
      + 'two glass jars of glowing liquid on the left side of the table, one red and one teal, '
      + 'a small brass tray on the right holding round glowing teal tokens in a row, a stack of cards on a leather pad, '
      + 'scattered brass tools and a lamp at the edges, warm cosy light, tactile tabletop feel.',
  },
];
