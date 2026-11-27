// v2 candidates: subjects v1 lacks (scenes, buildings, machines, creatures, items, people in motion).
// Each entry: [id, width, height, framing, subject]. Caption = 'mkw16 pixel art, ' + framing + ', ' + subject.
const SCENE = 'a 16-bit game background scene, wide view, no characters';
const BUILD = 'a 16-bit game building, side view, plain navy background';
const MACH = 'a 16-bit game machine sprite, three-quarter view, plain navy background';
const BEAST = 'a 16-bit game creature sprite, three-quarter view, plain navy background';
const ITEM = 'a 16-bit game item icon, centred, plain navy background';
const ACT = 'a 16-bit game character sprite, side view, plain navy background';
const W = 1024, H = 576, S = 768;
export const V2 = [
  // scenes (wide)
  ['sc-01', W, H, SCENE, 'an industrial city at dusk, tall brick smokestacks and riveted iron towers, orange sky, lit windows, steam rising'],
  ['sc-02', W, H, SCENE, 'a snowy plain at night under a teal aurora, a rail line crossing it, distant mountains'],
  ['sc-03', W, H, SCENE, 'a misty marsh at dawn, reeds, still water, wooden stilt houses, pale green light'],
  ['sc-04', W, H, SCENE, 'a sky of pink and gold clouds with two wooden airships with brass propellers'],
  ['sc-05', W, H, SCENE, 'a stone fortress on a cliff above a dark sea, storm clouds, lightning'],
  ['sc-06', W, H, SCENE, 'inside a mine tunnel, timber supports, rail tracks, lanterns, glowing teal crystals in the rock'],
  ['sc-07', W, H, SCENE, 'a rail bridge of iron girders over a deep canyon, a steam train crossing, sunset'],
  ['sc-08', W, H, SCENE, 'a cobbled town square with timber houses, a clock tower and gas lamps, evening'],
  ['sc-09', W, H, SCENE, 'a factory interior, huge brass gears, pipes, furnaces glowing orange, catwalks'],
  ['sc-10', W, H, SCENE, 'a ruined chapel in a pine forest, broken stained glass, moonlight, fog'],
  ['sc-11', W, H, SCENE, 'a desert of grey ash with half-buried giant iron machines, a red sun'],
  ['sc-12', W, H, SCENE, 'a harbour at night, iron steamships, cranes, lanterns reflected on black water'],
  ['sc-13', W, H, SCENE, 'rolling green hills, a windmill and a dirt road, blue sky with white clouds'],
  ['sc-14', W, H, SCENE, 'a throne hall with red banners, marble pillars and a long carpet, torchlight'],
  // buildings
  ['bd-01', S, S, BUILD, 'a tall riveted iron watchtower with a glowing teal lamp at the top'],
  ['bd-02', S, S, BUILD, 'a small timber cottage with a stone chimney and a smoking pipe'],
  ['bd-03', S, S, BUILD, 'a brick factory with three smokestacks and arched windows'],
  ['bd-04', S, S, BUILD, 'a wooden railway station with a clock and a slate roof'],
  ['bd-05', S, S, BUILD, 'a domed stone chapel with a bell tower'],
  ['bd-06', S, S, BUILD, 'a market stall with a striped awning, crates of fruit and hanging lanterns'],
  // machines
  ['mc-01', S, S, MACH, 'a tall two-legged walking war machine with an iron cockpit, a boiler on its back and a cannon arm'],
  ['mc-02', S, S, MACH, 'a wooden airship with a canvas balloon and brass propellers'],
  ['mc-03', S, S, MACH, 'a black steam locomotive with red wheels and a brass bell'],
  ['mc-04', S, S, MACH, 'a brass field cannon on wooden wheels'],
  ['mc-05', S, S, MACH, 'a small round flying drone with a propeller and one glowing teal eye'],
  ['mc-06', S, S, MACH, 'an armoured steam tractor with tank treads and a tall chimney'],
  ['mc-07', S, S, MACH, 'a spider-like six-legged iron machine with a glowing orange furnace core'],
  ['mc-08', S, S, MACH, 'a steam motorcycle with a sidecar, brass pipes and leather seat'],
  ['mc-09', S, S, MACH, 'a hulking iron golem with riveted plates and steam venting from its shoulders'],
  ['mc-10', S, S, MACH, 'a mining drill cart with a huge spiral drill bit'],
  // creatures
  ['cr-01', S, S, BEAST, 'a brass clockwork owl with spread wings'],
  ['cr-02', S, S, BEAST, 'a large grey wolf with glowing teal eyes, snarling'],
  ['cr-03', S, S, BEAST, 'a heavy draft horse wearing iron barding'],
  ['cr-04', S, S, BEAST, 'a giant marsh toad with mossy skin'],
  ['cr-05', S, S, BEAST, 'a black raven perched on a fence post'],
  ['cr-06', S, S, BEAST, 'a shadowy wraith of dark smoke with glowing teal eyes'],
  ['cr-07', S, S, BEAST, 'a red winged wyvern with a long tail'],
  ['cr-08', S, S, BEAST, 'a large armoured beetle with a bronze shell'],
  ['cr-09', S, S, BEAST, 'a sea serpent rising from waves'],
  ['cr-10', S, S, BEAST, 'a mechanical brass hound with gears visible in its chest'],
  ['cr-11', S, S, BEAST, 'a giant bat with torn wings'],
  ['cr-12', S, S, BEAST, 'a stone gargoyle crouching'],
  // items
  ['it-01', S, S, ITEM, 'a brass oil lantern with a glowing flame'],
  ['it-02', S, S, ITEM, 'a glass potion bottle with red liquid and a cork'],
  ['it-03', S, S, ITEM, 'a long rifle with a wooden stock and brass fittings'],
  ['it-04', S, S, ITEM, 'a steel sword with a gold hilt'],
  ['it-05', S, S, ITEM, 'a wooden supply crate with iron bands'],
  ['it-06', S, S, ITEM, 'a large brass gear'],
  ['it-07', S, S, ITEM, 'a leather-bound book with a metal clasp'],
  ['it-08', S, S, ITEM, 'a glowing teal crystal shard'],
  ['it-09', S, S, ITEM, 'an iron key with an ornate bow'],
  ['it-10', S, S, ITEM, 'a pile of gold coins'],
  ['it-11', S, S, ITEM, 'a round wooden shield with an iron boss'],
  ['it-12', S, S, ITEM, 'a pocket watch on a chain'],
  ['it-13', S, S, ITEM, 'a heavy steel wrench'],
  ['it-14', S, S, ITEM, 'a rolled paper map tied with string'],
  // people in motion (break the standing pose)
  ['ac-01', S, S, ACT, 'a soldier in a grey greatcoat running with a rifle'],
  ['ac-02', S, S, ACT, 'a woman in a blue coat casting a spell, teal light from her hands'],
  ['ac-03', S, S, ACT, 'a knight in silver armour swinging a sword'],
  ['ac-04', S, S, ACT, 'an old engineer kneeling to repair a pipe with a wrench'],
  ['ac-05', S, S, ACT, 'a hooded thief leaping'],
  ['ac-06', S, S, ACT, 'a woman in a red dress sitting on a crate'],
  ['ac-07', S, S, ACT, 'a soldier lying wounded on the ground'],
  ['ac-08', S, S, ACT, 'a rider on a brown horse'],
];
