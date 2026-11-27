// Art manifest: the Free Gauge (re-skin of the engine's Stormrail cards, PLAN D12).
// One entry per card in src/data/cards/storm.ts, in file order. `subject` is what the 64 x 48 card art shows.
export const FACTION = 'gauge';

export const CARDS = [
  // ---------- heroes and token ----------
  {
    id: 'storm-jax', kind: 'hero', name: 'Wren Ashby',
    subject: 'Young woman courier in patched moss-green canvas coat and brass goggles, holding one teal-glowing stolen engine core, crouched on a moving freight car roof at night.',
    ascendedName: 'Wren, Ghost of the Line',
    ascendedSubject: 'Young woman in patched moss-green coat gliding on a canvas wing harness above night rails, holding one teal-glowing engine core, coat tails streaming, sparks below.',
  },
  {
    id: 'storm-corvane', kind: 'hero', name: 'Kitemaster Ada Rusk',
    subject: 'Weathered woman in quilted moss flight coat and leather helm, holding one brass flare pistol, standing on a timber launch ramp beside patched canvas gliders at dusk.',
    ascendedName: 'Ada Rusk, Canopy of Night',
    ascendedSubject: 'Weathered woman in leather helm riding a lead canvas glider at night, holding one raised brass flare pistol, two glider crews close behind her, red flare light.',
  },
  {
    id: 'storm-wingmate', kind: 'unit', name: 'Patch Glider',
    subject: 'Miner in leather cap and goggles hanging beneath a patched canvas glider wing with brass struts, holding one short carbine, sweeping low over a dark rail cutting.',
  },

  // ---------- collectible units ----------
  {
    id: 'storm-signalkite', kind: 'unit', name: 'Lamp Kite',
    subject: 'Small patched canvas box kite carrying a hooded green lantern, tethered by a long cord, flying over a dark mine valley with distant pithead lights.',
  },
  {
    id: 'storm-tickettaker', kind: 'unit', name: 'Mailbag Cutter',
    subject: 'Teenage runner in flat cap and moss scarf, holding one hooked knife, leaping onto a black iron freight car at night to cut loose a mailbag.',
  },
  {
    id: 'storm-flagbearer', kind: 'unit', name: 'Shift Whistler',
    subject: 'Miner in dented helmet and coal-dusted overalls blowing one brass whistle, free arm flung forward, pithead smoke and lamplight behind him.',
  },
  {
    id: 'storm-railglider', kind: 'unit', name: 'Trestle Jumper',
    subject: 'Lean pilot in goggles leaping off a timber rail trestle under a patched canvas glider wing, holding one short boarding axe, gorge and river far below.',
  },
  {
    id: 'storm-gustcaller', kind: 'unit', name: 'Dawn Stoker',
    subject: 'Sweat-streaked stoker in a moss vest heaving coal into a glowing firebox, holding one long iron shovel, grey dawn light through the cab window.',
  },
  {
    id: 'storm-dispatcher', kind: 'unit', name: 'Winch Launcher',
    subject: 'Stocky woman in canvas apron cranking a brass winch, a taut cable hurling a canvas glider skyward off a slag ridge, holding one winch handle.',
  },
  {
    id: 'storm-galecourier', kind: 'unit', name: 'Satchel Dropper',
    subject: 'Glider pilot in leather goggles holding one lit satchel charge, swooping low over a black iron supply depot at night, fuse sparks trailing.',
  },
  {
    id: 'storm-sparkrider', kind: 'unit', name: 'Draisine Raider',
    subject: 'Raider in patched greatcoat crouched behind the brass-plated shield of an armoured draisine, holding one carbine, speeding along night rails with sparks at the wheels.',
  },
  {
    id: 'storm-squadcaller', kind: 'unit', name: 'Canvas Rigger',
    subject: 'Older mechanic in oil-stained overalls holding one sail needle, stitching a patch onto a canvas glider wing inside a lamp-lit mine shed.',
  },
  {
    id: 'storm-railmarshal', kind: 'unit', name: 'Cell Leader',
    subject: 'Grizzled woman in a patched moss greatcoat holding one open pocket watch, crouched beside a rail switch at night, two shadowed raiders waiting behind.',
  },
  {
    id: 'storm-thunderkite', kind: 'unit', name: 'Gunner Kite',
    subject: 'Large patched canvas war kite lifting a harnessed gunner, holding one long rifle, towed by a cable from a moving train through coal smoke.',
  },
  {
    id: 'storm-stormcaller', kind: 'unit', name: 'Launch Chief',
    subject: 'Burly union man in moss coat on a ridge launch ramp, holding one lit red signal flare high, a line of gliders tipping off the edge behind him.',
  },
  {
    id: 'storm-cyclonebarge', kind: 'unit', name: 'Balloon Raft',
    subject: 'Three patched hot-air balloons lifting a timber deck with glider launch rails, a glider dropping off its edge, night sky, furnace glow beneath the envelopes.',
  },
  {
    id: 'storm-tempestliner', kind: 'unit', name: 'Captured Skyfreighter',
    subject: 'Black iron cargo airship half repainted moss green, patched canvas over torn hull ribs, gondola cannon firing, diving through smoke over a burning rail yard.',
  },

  // ---------- collectible glyphs ----------
  {
    id: 'storm-tailwind', kind: 'glyph', name: 'Field Patch',
    subject: 'Gloved hands slapping a riveted brass patch over a bullet hole in a canvas glider wing, sparks and smoke drifting past, night.',
  },
  {
    id: 'storm-updraft', kind: 'glyph', name: 'Slag Thermal',
    subject: 'Shimmering hot air rising off a glowing orange slag heap at night, lifting a patched canvas glider sharply upward on the heat.',
  },
  {
    id: 'storm-crosswind', kind: 'glyph', name: 'Grit in the Gears',
    subject: 'A gloved hand pouring black grit from a sack into the exposed brass gears of a black iron walking machine knee joint, gears jamming.',
  },
  {
    id: 'storm-galesurge', kind: 'glyph', name: 'All Out',
    subject: 'A crowd of miners with picks and lamps pouring out of a timbered mine mouth at night, coal dust and lamplight swirling around them.',
  },
  {
    id: 'storm-reroute', kind: 'glyph', name: 'Throw the Points',
    subject: 'Close view of an iron rail switch lever thrown hard over, a stolen engine veering onto a side track, sparks from the wheels, night.',
  },
  {
    id: 'storm-skyhook', kind: 'glyph', name: 'Snatch Line',
    subject: 'A grappling hook on a taut cable from a glider above yanking a black-coated officer off a flatcar into the dark, cap flying.',
  },
  {
    id: 'storm-jetstream', kind: 'glyph', name: 'Mass Launch',
    subject: 'A row of patched canvas gliders leaping together off a mine ridge into a red dusk sky, coal smoke drifting below.',
  },
  {
    id: 'storm-airmail', kind: 'glyph', name: 'Dead Drop',
    subject: 'A loose brick pulled from a sooty wall, revealing rolled maps and folded plans tied with string inside, lit by a shuttered lamp.',
  },
  {
    id: 'storm-skyraid', kind: 'glyph', name: 'Midnight Raid',
    subject: 'Masked raiders in patched canvas with lanterns swarming over a black iron freight train under moonlight, gliders overhead.',
  },

  // ---------- First Light additions ----------
  {
    id: 'storm-odile', kind: 'hero', name: 'Loftkeeper Hettie Calloway',
    subject: 'Middle-aged woman in patched canvas coat and knitted scarf, holding one grey homing pigeon on her wrist, rooftop pigeon loft and kites behind at dawn.',
    ascendedName: 'Hettie, Mother of the Lofts',
    ascendedSubject: 'Middle-aged woman in patched canvas coat on a rooftop, holding one grey homing pigeon aloft, a wide flock of pigeons and kites rising around her at dawn.',
  },
  {
    id: 'storm-ness', kind: 'hero', name: 'Foreman Otto Brandt',
    subject: 'Broad bearded union foreman in moss canvas coat and miner helmet, holding one brass-banded pickaxe, riding the front of a speeding wooden handcar at night.',
    ascendedName: 'Otto Brandt, the Whole Union',
    ascendedSubject: 'Broad bearded foreman holding one raised pickaxe at the head of a long column of handcars packed with miners, lamps streaming back along night rails.',
  },
  {
    id: 'storm-ribbonkite', kind: 'unit', name: 'Post Pigeon',
    subject: 'Grey homing pigeon with a small brass message tube on its leg, flying fast through coal smoke at dusk toward a patched glider.',
  },
  {
    id: 'storm-wingcadet', kind: 'unit', name: 'Slag-Heap Cadet',
    subject: 'Teenage apprentice in an oversized leather flight cap, holding one wooden wing strut, watching gliders launch from a slag heap at dusk.',
  },
  {
    id: 'storm-tailrunner', kind: 'unit', name: 'Handcar Pumper',
    subject: 'Wiry miner in rolled sleeves and moss cap gripping the see-saw lever of a wooden handcar, racing along night rails behind other handcars.',
  },
  {
    id: 'storm-skirmishkite', kind: 'unit', name: 'Rocket Kite',
    subject: 'Narrow patched canvas kite with a small brass rocket tube lashed under its spar, rocket flame firing, cutting through night smoke.',
  },
  {
    id: 'storm-signaller', kind: 'unit', name: 'Siding Watchman',
    subject: 'Old stationmaster in a worn moss greatcoat holding one hooded green lantern, standing on a dark siding platform as raiders rush past.',
  },
  {
    id: 'storm-windrigger', kind: 'unit', name: 'Wing Fitter',
    subject: 'Mechanic in leather apron tightening straps of a canvas glider harness onto a miner, holding one brass buckle tool, inside a lamp-lit shed.',
  },
  {
    id: 'storm-gyrekite', kind: 'unit', name: 'Flare Kite',
    subject: 'Patched canvas kite circling high at night, dropping a bright magnesium flare that lights a black iron convoy on the rails below.',
  },
  {
    id: 'storm-veteranrunner', kind: 'unit', name: 'Old Brakeman',
    subject: 'Grey-bearded brakeman in oil-stained overalls holding one iron brake club, leaping between freight car roofs at night, coat flapping.',
  },
  {
    id: 'storm-mastlookout', kind: 'unit', name: 'Headframe Lookout',
    subject: 'Lookout in patched canvas coat perched atop a timber mine winding tower, holding one brass spyglass trained on the night sky.',
  },
  {
    id: 'storm-switchforeman', kind: 'unit', name: 'Yard Boss',
    subject: 'Stout yardwoman in canvas apron holding one large iron wrench, waving a second stolen engine out of a smoky roundhouse under arc lamps.',
  },
  {
    id: 'storm-glidetutor', kind: 'unit', name: 'Flight Teacher',
    subject: 'Grey-haired woman in patched flight jacket holding one small wooden glider model, young pilots gathered around her in a mine shed.',
  },
  {
    id: 'storm-breakneck', kind: 'unit', name: 'Runaway Engine',
    subject: 'Driverless stolen locomotive with patched moss-green boiler, throttle chained open, sparks and steam bursting, racing toward a black iron barricade at night.',
  },
  {
    id: 'storm-aeriecarrier', kind: 'unit', name: 'Repair Dirigible',
    subject: 'Patched canvas dirigible with a workshop gondola, mechanics on its rails mending glider wings mid-air, gliders docked alongside, smoky night sky.',
  },
  {
    id: 'storm-bellexpress', kind: 'unit', name: 'Union Express',
    subject: 'Stolen armoured locomotive plated in scavenged brass, iron ram at the front, miners crowding its roof, charging a fortified station at night.',
  },
  {
    id: 'storm-anchorleg', kind: 'glyph', name: 'Union Grip',
    subject: 'Two coal-dusted gloved hands clasped forearm to forearm above a rail, lamplight on brass knuckle guards.',
  },
  {
    id: 'storm-sinkingair', kind: 'glyph', name: 'Bleed the Valve',
    subject: 'A gloved hand wrenching open a brass valve on a black iron boiler, steam venting hard, needle falling on a blank pressure dial.',
  },
  {
    id: 'storm-closeechelon', kind: 'glyph', name: 'Close Formation',
    subject: 'Three patched canvas gliders flying wingtip to wingtip in a tight wedge through bursting flak smoke at dusk.',
  },
  {
    id: 'storm-parceldrop', kind: 'glyph', name: 'Bundle Drop',
    subject: 'A canvas supply bundle swinging under a small patched parachute, falling into a lamp-lit mine yard at night.',
  },
  {
    id: 'storm-loopback', kind: 'glyph', name: 'Second Pass',
    subject: 'A stolen engine swinging round a tight looping spur line for a second run, a smoke trail curling behind it, night.',
  },
  {
    id: 'storm-steepdive', kind: 'glyph', name: 'Plunge',
    subject: 'Patched canvas glider in a near-vertical dive at a black iron walking boiler, a lit charge falling ahead of it.',
  },
  {
    id: 'storm-gliderdrop', kind: 'glyph', name: 'Cut the Tow',
    subject: 'Two patched canvas gliders released from a snapped tow cable behind a balloon, peeling away over a dark valley.',
  },
  {
    id: 'storm-flightdrill', kind: 'glyph', name: 'Ridge Drill',
    subject: 'Patched canvas gliders circling a slag ridge in morning haze, practice targets of straw and sacking on the slope below.',
  },
  {
    id: 'storm-doubledeparture', kind: 'glyph', name: 'Double Header',
    subject: 'Two stolen steam engines side by side bursting out of a tunnel mouth together, smoke and sparks pouring, night.',
  },
];
