// Art manifest: Cindral Dominion (re-skin of Annals' Prismguard, PLAN D12).
// One entry per card in src/data/cards/prism.ts, in file order. Names are proposals.
// `subject` is what the 64 x 48 illustration shows (plain words, no proper nouns, no lettering).

export const FACTION = 'dominion';

export const CARDS = [
  // ---------- heroes ----------
  {
    id: 'prism-ysolde', kind: 'hero', name: 'Archwright Tobias Venn',
    subject: 'Grey-whiskered engineer in a soot-stained red lacquer coat and brass goggles, holding one long iron spanner, beside a dented strider leg in a smoky depot.',
    ascendedName: 'Venn, Master of the Works',
    ascendedSubject: 'Grey-whiskered engineer on an iron gantry, holding one glowing teal boiler core aloft, pale teal light spreading over a row of black iron walking boilers below.',
  },
  {
    id: 'prism-oren', kind: 'hero', name: 'Sovereign Maudrey Hale',
    subject: 'Ageing stern woman in heavy black iron-plated robes with red lacquer and brass trim, holding one brass seal-stamp, standing firm on a citadel balcony amid falling ash.',
    ascendedName: 'Maudrey Hale, the Unbowed',
    ascendedSubject: 'Ageing stern woman in scorched iron-plated robes, holding one brass sceptre crackling teal, standing unbowed before a cracked tower wall, a bolt of gloam striking outward.',
  },
  // ---------- units ----------
  {
    id: 'prism-glasswarden', kind: 'unit', name: 'Ironclad Sentry',
    subject: 'Young soldier in black iron breastplate and red lacquer pauldrons, holding one tall riveted tower shield, braced low on a frosted rampart.',
  },
  {
    id: 'prism-lampkeeper', kind: 'unit', name: 'Lantern Picket',
    subject: 'Night sentry in a red greatcoat and iron helm, holding one brass lantern glowing teal, peering up at a dark smoky sky from a wall walk.',
  },
  {
    id: 'prism-facet-initiate', kind: 'unit', name: 'Rivet Apprentice',
    subject: 'Young apprentice in soot-stained red overalls, holding one rivet hammer, fastening an extra iron plate onto a seated soldier\'s shoulder, sparks.',
  },
  {
    id: 'prism-tierguard', kind: 'unit', name: 'Citadel Guard',
    subject: 'Guard in a red lacquer coat with brass buttons and black iron helm, holding one halberd upright, a faint teal shimmer hanging in front of him.',
  },
  {
    id: 'prism-bracewright', kind: 'unit', name: 'Brace Fitter',
    subject: 'Burly engineer in a leather apron over iron plates, holding one heavy pipe wrench, squared up to a foe, a patched pipe hissing steam on his shoulder.',
  },
  {
    id: 'prism-pane-mender', kind: 'unit', name: 'Field Boilerwright',
    subject: 'Kneeling engineer in brass goggles and red work jacket, holding one gloam cutting torch, welding a dented iron plate on a walking boiler\'s leg, teal sparks.',
  },
  {
    id: 'prism-crystal-bulwark', kind: 'unit', name: 'Bulwark Strider',
    subject: 'Squat two-legged walking boiler in thick black iron plating with a broad front shield plate, enclosed cab with a round brass porthole, steam venting.',
  },
  {
    id: 'prism-chorus-warden', kind: 'unit', name: 'Shield Caster',
    subject: 'Caster officer in a long red greatcoat, frost on her sleeves, both arms raised, veins glowing teal, a pale dome of light over soldiers behind her.',
  },
  {
    id: 'prism-sentinel-lens', kind: 'unit', name: 'Searchlight Walker',
    subject: 'Lean two-legged walking boiler with a large brass searchlight lens on its cab, casting a teal beam over a soldier, porthole cab, dusk haze.',
  },
  {
    id: 'prism-aegis-colossus', kind: 'unit', name: 'Siege Strider',
    subject: 'Heavy two-legged walking boiler in black iron and red lacquer, riveted ram plate on its front, stomping forward through mud, enclosed cab with a porthole.',
  },
  {
    id: 'prism-vault-captain', kind: 'unit', name: 'Legion Captain',
    subject: 'Officer in black iron cuirass and red sash with brass trim, holding one drawn sabre pointed forward, a line of soldiers advancing behind him.',
  },
  {
    id: 'prism-spire-keeper', kind: 'unit', name: 'Rampart Keeper',
    subject: 'Grey-bearded veteran in heavy black iron plate, holding one riveting hammer, patching a cracked fortress wall at dusk, embers drifting.',
  },
  {
    id: 'prism-lightwall-matron', kind: 'unit', name: 'Colonel of the Wall',
    subject: 'Stern older woman officer in a long red lacquer coat with brass epaulettes, holding one brass spyglass, on a parapet above ranked troops.',
  },
  {
    id: 'prism-tier-sovereign', kind: 'unit', name: 'High Castellan',
    subject: 'Towering commander in full black iron plate and red lacquer cloak, holding one great tower shield, pale teal light spilling over the ranks behind him.',
  },
  // ---------- glyphs ----------
  {
    id: 'prism-hold-the-line', kind: 'glyph', name: 'Brace Ranks',
    subject: 'Row of black iron tower shields locked edge to edge, a shell bursting against them, sparks and soot scattering, frosted mud below.',
  },
  {
    id: 'prism-mirror-ward', kind: 'glyph', name: 'Caster\'s Ward',
    subject: 'Dome of pale teal light around a lone soldier in red, a bullet flattening against its curve, frost forming where it struck.',
  },
  {
    id: 'prism-choir-of-facets', kind: 'glyph', name: 'Massed Anthem',
    subject: 'Regiment in red coats and iron helms singing with chins raised, breath steaming in cold air, brass horns gleaming, faint teal glow over them.',
  },
  {
    id: 'prism-patch-the-pane', kind: 'glyph', name: 'Hot Rivet',
    subject: 'Close view of a gloved hand holding one hammer, driving a glowing rivet into a dented black iron plate, sparks flying.',
  },
  {
    id: 'prism-call-out', kind: 'glyph', name: 'Gauntlet Thrown',
    subject: 'Red lacquered iron gauntlet lying on frosted ground between two distant battle lines, steam drifting across the gap.',
  },
  {
    id: 'prism-lightwall-oath', kind: 'glyph', name: 'Iron Oath',
    subject: 'Soldier kneeling in a candlelit armoury, fist pressed to a new black iron breastplate, a brass medal on a red ribbon at his chest.',
  },
  {
    id: 'prism-spire-mantle', kind: 'glyph', name: 'Citadel Aegis',
    subject: 'Stepped iron fortress tower wrapped in a shimmering teal dome, scaffolds and workers repairing its cracked walls, smokestacks behind.',
  },
  {
    id: 'prism-tier-rally', kind: 'glyph', name: 'Rally the Legion',
    subject: 'Column of soldiers in red lacquer and black iron raising rifles in a cheer beneath smokestacks, ash falling.',
  },
  {
    id: 'prism-crystal-dawn', kind: 'glyph', name: 'Ember Dawn',
    subject: 'Sun breaking over a smokestack city, teal steam glowing, ranks of soldiers and walking boilers lit gold, repaired plates shining.',
  },
  // ---------- First Light additions ----------
  {
    id: 'prism-tamsin', kind: 'hero', name: 'Marshal Ilse Corrow',
    subject: 'Lean woman marshal in a black iron cuirass and red lacquer greatcoat with brass trim, holding one leather ledger, conscripts drilling in ranks behind her.',
    ascendedName: 'Ilse Corrow, the Iron Tide',
    ascendedSubject: 'Woman marshal in brass-trimmed black iron plate, holding one raised sabre, a vast tide of conscripts and walking boilers marching past her through smoke.',
  },
  {
    id: 'prism-orrin', kind: 'hero', name: 'Lieutenant Senna Kale',
    subject: 'Pale caster officer in a red lacquer coat, frost on her collar, veins glowing teal, holding one long rifle with a brass scope, aimed at the sky.',
    ascendedName: 'Senna Kale, Rimefall',
    ascendedSubject: 'Pale caster officer in a frosted red coat, holding one long rifle skyward, a burst of ice shards tearing through airships above.',
  },
  {
    id: 'prism-tier-recruit', kind: 'unit', name: 'Conscript',
    subject: 'Young conscript in an oversized black iron helmet and plain red tunic, holding one bolt rifle, standing at attention in falling ash.',
  },
  {
    id: 'prism-shieldline-cadet', kind: 'unit', name: 'Drill Cadet',
    subject: 'Cadet in a faded red training jacket, holding one wooden practice shield, saluting a column of arriving soldiers on a parade ground.',
  },
  {
    id: 'prism-glint-scout', kind: 'unit', name: 'Picket Walker',
    subject: 'Small two-legged walking boiler about a man\'s height, brass periscope on its porthole cab, a single swivel gun aimed skyward, soot on frost.',
  },
  {
    id: 'prism-rank-drummer', kind: 'unit', name: 'Legion Drummer',
    subject: 'Young drummer in a red lacquer jacket with brass buttons, holding one drumstick raised, snare drum slung at the hip, ranks forming behind.',
  },
  {
    id: 'prism-lens-fitter', kind: 'unit', name: 'Scope Fitter',
    subject: 'Artificer in a leather apron and brass goggles, holding one brass rifle scope, fitting it onto a soldier\'s rifle at a field bench.',
  },
  {
    id: 'prism-shield-sergeant', kind: 'unit', name: 'Line Sergeant',
    subject: 'Sergeant in an iron helm and red coat, holding one short sabre raised, mouth open in a shout, soldiers charging behind him.',
  },
  {
    id: 'prism-flak-tripod', kind: 'unit', name: 'Flak Stand',
    subject: 'Three-legged black iron gun mount with one short brass flak gun aimed upward, smoke puffs bursting in a dusk sky.',
  },
  {
    id: 'prism-range-warden', kind: 'unit', name: 'Range Officer',
    subject: 'Officer in a red coat holding one brass rangefinder to her eye, pointing gunners toward an airship silhouette in a grey sky.',
  },
  {
    id: 'prism-rampart-herald', kind: 'unit', name: 'Colour Sergeant',
    subject: 'Sergeant in black iron half-plate, holding one plain red pennant on a brass pole, striding ahead of a cheering line.',
  },
  {
    id: 'prism-tier-pikeman', kind: 'unit', name: 'Legion Pikeman',
    subject: 'Pikeman in black iron half-plate and red sash, holding one long steel pike levelled, packed shoulder to shoulder in a dense pike block.',
  },
  {
    id: 'prism-lens-battery', kind: 'unit', name: 'Rail Battery',
    subject: 'Long-barrelled artillery gun on an armoured railway flatcar, brass rangefinder lenses on its side, steam venting, rails running into smoke.',
  },
  {
    id: 'prism-cohort-drillmaster', kind: 'unit', name: 'Drillmaster',
    subject: 'Grizzled instructor in a red coat with brass buttons, holding one iron-tipped baton, barking orders at ranked conscripts on a sooty parade ground.',
  },
  {
    id: 'prism-skylens-bastion', kind: 'unit', name: 'Skyguard Strider',
    subject: 'Heavy two-legged walking boiler in black iron plate with one long cannon on its back pointed skyward, porthole cab, flak smoke at dusk.',
  },
  {
    id: 'prism-muster-bell', kind: 'unit', name: 'Muster Whistle',
    subject: 'Tall brass steam whistle on an iron tower venting a white plume, conscripts running out of soot-dark barracks below.',
  },
  {
    id: 'prism-gilded-phalanx', kind: 'unit', name: 'Brass Phalanx',
    subject: 'Elite soldiers in brass-trimmed black iron full plate with red lacquer crests, each holding one tower shield, locked and advancing through smoke.',
  },
  {
    id: 'prism-steady-aim', kind: 'glyph', name: 'Held Breath',
    subject: 'Close view of a gloved finger on a rifle trigger, frost on the brass scope, a plume of breath fog in cold air.',
  },
  {
    id: 'prism-lock-shields', kind: 'glyph', name: 'Shield Lock',
    subject: 'Row of young conscripts crouched behind overlapping iron shields, shrapnel raining against them, sparks on the rims.',
  },
  {
    id: 'prism-flak-burst', kind: 'glyph', name: 'Flak Barrage',
    subject: 'Black flak bursts blooming around a kite-winged airship at dusk, torn burning canvas falling.',
  },
  {
    id: 'prism-covering-fire', kind: 'glyph', name: 'Covering Fire',
    subject: 'Muzzle flashes from a ridge line of riflemen in red coats, firing down over a melee on a pale salt plain below.',
  },
  {
    id: 'prism-shoulder-to-shoulder', kind: 'glyph', name: 'Close the Ranks',
    subject: 'Tight ranks of soldiers in red coats and iron helms, shoulders touching, bayonets levelled forward, steam drifting past.',
  },
  {
    id: 'prism-field-glazing', kind: 'glyph', name: 'Field Refit',
    subject: 'Mobile workshop wagon beside a battered walking boiler, glowing new iron plates bolted over its dents, sparks and lantern light.',
  },
  {
    id: 'prism-cut-the-sky', kind: 'glyph', name: 'Skyfall Salvo',
    subject: 'Rail artillery salvo lighting the night sky, airships breaking apart overhead, shrapnel raining on the ground below.',
  },
  {
    id: 'prism-focused-volley', kind: 'glyph', name: 'Converging Fire',
    subject: 'Tracer lines from many gun positions converging on one point in a smoky dusk, an explosion where they meet.',
  },
  {
    id: 'prism-grand-muster', kind: 'glyph', name: 'General Muster',
    subject: 'Parade ground with long ranks of red-coated troops and two walking boilers under smokestacks, steam rising in dawn light.',
  },
];
