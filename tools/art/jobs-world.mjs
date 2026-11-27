// Faction emblems and battlefields (docs/WORLD.md). Emblems snap to 32 px tall; battlefields to 256 x 224.
const T = 'mkw16 pixel art, ';
const EM = T + 'a 16-bit game item icon, centred, plain navy background, ';
const BF = T + 'a 16-bit game background scene, wide view, no characters, ';
const seeds = (a, n) => Array.from({ length: n }, (_, i) => a + i);
const OPEN = ', a broad open stretch of plain ground across the lower half';
export const JOBS = [
  { id: 'em-dominion', w: 768, h: 768, seeds: seeds(5001, 4), text: EM + 'a black iron shield emblem with a red lacquered gear wheel at its centre and brass rivets around the rim.' },
  { id: 'em-choir', w: 768, h: 768, seeds: seeds(5101, 4), text: EM + 'a bronze bell emblem draped with a white veil, one ember flame burning above it.' },
  { id: 'em-gale', w: 768, h: 768, seeds: seeds(5201, 4), text: EM + 'a brass compass rose emblem with one white canvas kite wing behind it.' },
  { id: 'em-sedgekin', w: 768, h: 768, seeds: seeds(5301, 4), text: EM + 'a round emblem of a knot of glowing teal glass roots inside a ring of green reeds and verdigris copper.' },
  { id: 'em-gauge', w: 768, h: 768, seeds: seeds(5401, 4), text: EM + 'a round moss green patched canvas badge with a brass spanner crossed over an iron rail spike.' },
  { id: 'em-blackwick', w: 768, h: 768, seeds: seeds(5501, 4), text: EM + 'a black iron ring of old keys around one small lantern glowing sickly green.' },
  { id: 'bf-vaskor', w: 1024, h: 896, seeds: seeds(5601, 4), text: BF + 'a cobbled plaza at the edge of a ring city of smokestacks at dusk, a stepped tower with a brass wheel in the far distance, steam' + OPEN + '.' },
  { id: 'bf-thrumhollow', w: 1024, h: 896, seeds: seeds(5701, 4), text: BF + 'a mining town at night, timber headframes, pump houses with glowing furnaces, rail tracks and coal heaps' + OPEN + '.' },
  { id: 'bf-rimeglass', w: 1024, h: 896, seeds: seeds(5801, 4), text: BF + 'a salt-white plain crusted with teal crystals under a pale cold sky, distant broken iron machines' + OPEN + '.' },
  { id: 'bf-kitebarrow', w: 1024, h: 896, seeds: seeds(5901, 4), text: BF + 'the wooden deck of a floating harbour high in the clouds, moored to green hills by long cables, airships at the piers' + OPEN + '.' },
  { id: 'bf-sedgemere', w: 1024, h: 896, seeds: seeds(6001, 4), text: BF + 'a misty marsh at night where glowing teal glass roots break the surface of black water, reeds and stilt huts' + OPEN + ' of peat and moss.' },
  { id: 'bf-hush', w: 1024, h: 896, seeds: seeds(6101, 4), text: BF + 'a burned forest of black trunks and grey ash, a stone cloister with white veils hanging in the far distance, embers drifting' + OPEN + '.' },
  { id: 'bf-greying', w: 1024, h: 896, seeds: seeds(6201, 4), text: BF + 'dead grey grassland under an overcast sky, a silent abandoned village of grey houses, a withered tree' + OPEN + '.' },
];
