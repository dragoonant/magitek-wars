// Title screen art (PLAN D13): a backdrop at the 256 x 224 aspect (8:7) and the six faction leads for the lineup.
const T = 'mkw16 pixel art, ';
const CH = 'a 16-bit game character sprite, standing, three-quarter view, plain navy background, ';
const SC = 'a 16-bit game background scene, wide view, no characters, ';
const seeds = (a, n) => Array.from({ length: n }, (_, i) => a + i);
export const JOBS = [
  { id: 'bg-night', w: 1024, h: 896, seeds: seeds(3001, 8), text: T + SC + 'a night sky full of stars over a deep gorge, a tall rocky cliff at the far left edge and another at the far right edge, flat cliff tops in the lower third, far below between them an industrial city of smokestacks glowing orange, a large pale moon, the upper half is open starry sky.' },
  { id: 'bg-dusk', w: 1024, h: 896, seeds: seeds(3101, 8), text: T + SC + 'a dusk sky of deep purple fading to ember orange over a wide valley, a rocky cliff at the far left edge and another at the far right edge, flat cliff tops in the lower third, in the distance a ring city of smokestacks around a stepped tower with a brass wheel, steam rising, the upper half is open sky with a few stars.' },
  { id: 'ch-ilse', w: 768, h: 768, seeds: seeds(3201, 4), text: T + CH + 'a tall stern woman marshal with short black hair in a long black iron-plated greatcoat with red lacquer panels and brass trim, a sabre at her hip, hands at her sides.' },
  { id: 'ch-wren', w: 768, h: 768, seeds: seeds(3301, 4), text: T + CH + 'a young woman courier with short brown hair in a patched moss-green canvas jacket, brass goggles on her forehead, a leather satchel across her body, hands at her sides.' },
  { id: 'ch-ulla', w: 768, h: 768, seeds: seeds(3401, 4), text: T + CH + 'a tall bark-skinned woman elder with moss on her shoulders and faint teal glowing lines on her arms, holding a wooden staff tipped with a teal glass shard.' },
  { id: 'ch-dasha', w: 768, h: 768, seeds: seeds(3501, 4), text: T + CH + 'a woman sky-ship captain with a long dark braid in a long white coat with brass buttons and a dusk-blue tricorn hat, holding a brass spyglass.' },
  { id: 'ch-ebbe', w: 768, h: 768, seeds: seeds(3601, 4), text: T + CH + 'a thin man preacher in ash-grey robes with a white veil over his lower face, holding a lantern of flame.' },
  { id: 'ch-vell', w: 768, h: 768, seeds: seeds(3701, 4), text: T + CH + 'a hooded woman smuggler in a long soot-black coat with verdigris trim, holding a lantern glowing sickly green.' },
];
