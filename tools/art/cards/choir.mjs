// Art manifest: the Ashen Choir (re-skin of the Emberworks file src/data/cards/ember.ts, PLAN D12).
// One entry per card object, in file order. `subject` is what the 64 x 48 illustration shows.
export const FACTION = 'choir';

export const CARDS = [
  // ---------- heroes and tokens ----------
  {
    id: 'ember-kessa', kind: 'hero', name: 'Sister Maren, Kindler',
    subject: 'A young veiled woman in ash-grey robes and a white veil, one hand raised throwing a bright ember, holding one iron taper, soot on her sleeves, burned trees behind.',
    ascendedName: 'Maren, the Lit Wick',
    ascendedSubject: 'The same young woman, veil lifted by heat, ember light pouring from her raised hands, fire falling like rain over a burned field, holding one iron taper.',
  },
  {
    id: 'ember-crucible', kind: 'hero', name: 'Cantor Ebbe',
    subject: 'A gentle grey-bearded preacher in white veils standing on a great brass reliquary engine with an open firebox and hanging bells, holding one hand bell, singing.',
    ascendedName: 'Ebbe, the Last Hymn',
    ascendedSubject: 'The grey-bearded preacher standing calm inside the blazing firebox of a huge brass bell engine, white veils burning at the edges, arms open, embers rising.',
  },
  {
    id: 'ember-sparkbot', kind: 'unit', name: 'Votive Spark',
    subject: 'A small woven wicker figure the size of a cat, burning from inside with a steady orange flame, walking on twig legs across grey ash.',
  },
  {
    id: 'ember-slagling', kind: 'unit', name: 'Wicker Martyr',
    subject: 'A person-sized wicker frame wrapped in white cloth strips, fully ablaze, charging forward with arms out, trailing smoke and sparks over scorched ground.',
  },

  // ---------- collectible units ----------
  {
    id: 'ember-cinderscamp', kind: 'unit', name: 'Kindling Censer',
    subject: 'A knee-high brass censer automaton on three jointed legs, smoke curling from its lid, dropping a small burning wicker figure onto the ash beside it.',
  },
  {
    id: 'ember-kilnhand', kind: 'unit', name: 'Ash Novice',
    subject: 'A thin young novice in a plain grey robe and white veil, eyes closed, holding one lit taper close to the chest, faint embers already rising from the hem.',
  },
  {
    id: 'ember-ashrunner', kind: 'unit', name: 'Cinder Runner',
    subject: 'A lean iron brazier on long jointed legs sprinting forward, coals glowing in its open bowl, sparks streaming behind, soot-black plates and brass rivets.',
  },
  {
    id: 'ember-slagsmith', kind: 'unit', name: 'Coal Flinger',
    subject: 'A broad veiled woman in a soot-stained leather apron mid-throw, a red-hot coal leaving her hand, holding one pair of iron tongs, ash drifting around her.',
  },
  {
    id: 'ember-sparkforge', kind: 'unit', name: 'Wicker Loom',
    subject: 'A squat brass and timber weaving machine with a small furnace at its base, wicker strands feeding through its arms, a lit wicker figure stepping out.',
  },
  {
    id: 'ember-fuseguard', kind: 'unit', name: 'Ember Reliquary',
    subject: 'A small brass reliquary box on four short iron legs, its lid cracked open with white-hot light leaking out, a fuse of smoke rising from its top.',
  },
  {
    id: 'ember-furnacebrute', kind: 'unit', name: 'Brazen Effigy',
    subject: 'A heavy hollow brass statue of a kneeling penitent, fire glowing through its eye slits and ribs, rising to its feet with fists clenched, soot-streaked.',
  },
  {
    id: 'ember-arcwelder', kind: 'unit', name: 'Flame Cantor',
    subject: 'A tall veiled singer in grey and white robes, mouth open in song, a ribbon of fire streaming from one outstretched palm toward the right.',
  },
  {
    id: 'ember-furnacetender', kind: 'unit', name: 'Martyr Weaver',
    subject: 'An older veiled woman in an ash-grey robe kneeling to bind a person-sized wicker frame, holding one coil of white cloth, a brazier glowing nearby.',
  },
  {
    id: 'ember-blastminer', kind: 'unit', name: 'Burning Penitent',
    subject: 'A barefoot man in a white veil and grey shift walking calmly into a wall of flame, arms spread wide, fire bursting outward around him.',
  },
  {
    id: 'ember-pyrelancer', kind: 'unit', name: 'Censer Lancer',
    subject: 'A tall soot-black iron automaton charging forward, a swinging brass censer for a head, holding one long lance with a burning tip, embers trailing.',
  },
  {
    id: 'ember-moltenwarden', kind: 'unit', name: 'Tolling Engine',
    subject: 'A wheeled brass reliquary engine carrying a great hanging bell, the bell glowing orange as it swings, a wave of fire rolling out from its mouth.',
  },
  {
    id: 'ember-crucibleherald', kind: 'unit', name: 'Precentor of Pyres',
    subject: 'A stern veiled choir leader in long grey robes holding one tall iron staff, leading three burning wicker frames forward through drifting smoke.',
  },
  {
    id: 'ember-foundrytitan', kind: 'unit', name: 'The Great Effigy',
    subject: 'A towering brass effigy of a veiled figure, furnace fire roaring through its chest grille, one huge foot crushing down as flames spread across the ground.',
  },

  // ---------- collectible glyphs ----------
  {
    id: 'ember-overdrive', kind: 'glyph', name: 'Fervour',
    subject: 'A clenched fist wrapped in white cloth bursting into bright orange flame, sparks flying upward, dark ash-grey background.',
  },
  {
    id: 'ember-pinprick', kind: 'glyph', name: 'Cinder Flick',
    subject: 'A single glowing ember flicked through dark air, leaving a thin orange trail, a tiny burst of sparks where it lands on grey stone.',
  },
  {
    id: 'ember-ventburst', kind: 'glyph', name: 'Censer Burst',
    subject: 'A brass censer on a chain bursting open mid-swing, a cone of fire and white smoke blasting outward, scattered coals in the air.',
  },
  {
    id: 'ember-slagbolt', kind: 'glyph', name: 'Brand',
    subject: 'A spear-shaped bolt of white-hot fire streaking across a smoky battlefield, glowing orange at its edges, ash swirling in its wake.',
  },
  {
    id: 'ember-scrapburst', kind: 'glyph', name: 'Willing Pyre',
    subject: 'A veiled figure seen from behind stepping onto a tall pyre of stacked timber, flames climbing, a column of fire and ash rising into a grey sky.',
  },
  {
    id: 'ember-heatlance', kind: 'glyph', name: 'Searing Hymn',
    subject: 'A straight beam of searing orange light cutting through smoke, heat shimmer around it, a melted glowing groove in the stone below.',
  },
  {
    id: 'ember-cinderhail', kind: 'glyph', name: 'Ash Rain',
    subject: 'Glowing cinders and grey ash falling thickly from a dark smoky sky over a battlefield, small fires catching where they land.',
  },
  {
    id: 'ember-sparkcascade', kind: 'glyph', name: 'Votive Procession',
    subject: 'A line of small burning wicker figures walking in single file across grey ash at dusk, each glowing from inside, smoke trailing above them.',
  },
  {
    id: 'ember-firestorm', kind: 'glyph', name: 'The Great Burning',
    subject: 'A vast wall of fire sweeping across a plain under a black and orange sky, burned trees silhouetted, embers swirling like snow.',
  },
  // ---------- base set, second wave ----------
  {
    id: 'ember-torva', kind: 'hero', name: 'Brother Hask, Unburnt',
    subject: 'A scarred broad-shouldered monk in a grey shift and white veil, forearms wrapped in smouldering cloth, fists raised in a fighting stance, holding one iron chain.',
    ascendedName: 'Hask, Ember Penitent',
    ascendedSubject: 'The scarred monk wreathed in steady flame that does not burn him, veil gone to ash, striking forward through a ring of smoke and sparks.',
  },
  {
    id: 'ember-yarrow', kind: 'hero', name: 'Deacon Oriel Tamm',
    subject: 'A lean older deacon in grey robes and a white veil, kneeling by a banked bed of glowing coals in a stone hearth, holding one long iron poker.',
    ascendedName: 'Oriel, the Banked Fire',
    ascendedSubject: 'The lean deacon standing as the banked coals erupt into a roaring pillar of fire, robes billowing, holding one long iron poker raised high.',
  },
  // units
  {
    id: 'ember-valvetapper', kind: 'unit', name: 'Coal Keeper',
    subject: 'A small veiled acolyte in grey sitting cross-legged, holding one clay pot of glowing coals in both hands, breath of smoke rising.',
  },
  {
    id: 'ember-ringcrier', kind: 'unit', name: 'Bell Novice',
    subject: 'A young novice in a grey robe and white veil ringing one brass hand bell overhead, mouth open in a shout, smoke drifting behind.',
  },
  {
    id: 'ember-flarebot', kind: 'unit', name: 'Wicker Lamp',
    subject: 'A waist-high wicker figure with a glass lantern for a head, flame burning bright inside, wicker body already charring at the edges.',
  },
  {
    id: 'ember-pitbrawler', kind: 'unit', name: 'Ash Zealot',
    subject: 'A wiry zealot smeared head to foot in grey ash, white veil tied around the brow, lunging forward with fists raised, eyes fixed on one foe.',
  },
  {
    id: 'ember-gaugewatcher', kind: 'unit', name: 'Coal Vigil',
    subject: 'A hooded watcher in grey sitting still beside an iron brazier at night, holding one brass rod pointed at the fire, embers drifting upward.',
  },
  {
    id: 'ember-scrapreclaimer', kind: 'unit', name: 'Ash Gatherer',
    subject: 'A stooped veiled figure in grey sweeping warm ash into a small brass urn, holding one straw broom, scorched ground around.',
  },
  {
    id: 'ember-pitpromoter', kind: 'unit', name: 'Ordeal Keeper',
    subject: 'A stern robed elder in a white veil standing between two fighters at the edge of a ring of fire, holding one iron rod raised.',
  },
  {
    id: 'ember-rivethurler', kind: 'unit', name: 'Choirmaster',
    subject: 'A veiled choirmaster in grey with arms raised conducting, holding one thin iron baton, a stream of fire rising from the singers behind.',
  },
  {
    id: 'ember-meltdowngolem', kind: 'unit', name: 'Burning Frame',
    subject: 'A hulking wicker and iron frame twice a person\'s height, fully on fire, collapsing forward while hurling a burst of flame, smoke pouring off it.',
  },
  {
    id: 'ember-slaggladiator', kind: 'unit', name: 'Brazen Penitent',
    subject: 'A soot-streaked brass automaton shaped like a kneeling monk now rising to fight, fire behind its face grille, holding one heavy iron flail.',
  },
  {
    id: 'ember-steamcondenser', kind: 'unit', name: 'Swinging Censer',
    subject: 'A tall iron frame automaton swinging a large brass censer on a chain from its single arm, thick white smoke spilling, coals glowing inside.',
  },
  {
    id: 'ember-pitboss', kind: 'unit', name: 'Abbess of Brands',
    subject: 'A tall severe abbess in grey robes and a long white veil, holding one glowing branding iron raised, sparks at its tip, smoke behind her.',
  },
  {
    id: 'ember-forgemarshal', kind: 'unit', name: 'Pyre Marshal',
    subject: 'A veteran commander in ash-grey robes over soot-black mail, white veil, holding one burning standard pole without any cloth, smoke-hazed ranks behind.',
  },
  {
    id: 'ember-boilercolossus', kind: 'unit', name: 'Reliquary Colossus',
    subject: 'An immense walking brass reliquary with bells hung along its sides, its open furnace heart roaring, smoke stacks venting, scorched earth under its feet.',
  },
  // glyphs
  {
    id: 'ember-stoketheboiler', kind: 'glyph', name: 'Feed the Censer',
    subject: 'A burning wicker figure stepping into the open mouth of a huge brass censer, the fire inside flaring white, smoke pouring from the vents.',
  },
  {
    id: 'ember-hotrivets', kind: 'glyph', name: 'Brand of Zeal',
    subject: 'A glowing red-hot iron brand pressed onto a soot-black iron breastplate, bright sparks bursting, smoke curling up.',
  },
  {
    id: 'ember-cheapshot', kind: 'glyph', name: 'Blow in the Smoke',
    subject: 'A burning fist striking out of thick grey smoke into the side of a shadowed armoured figure, sparks and ash bursting at the impact.',
  },
  {
    id: 'ember-shrapneltoss', kind: 'glyph', name: 'Flung Effigy',
    subject: 'A burning wicker figure hurled through the air in a high arc, trailing fire and smoke, about to burst against a dark shape below.',
  },
  {
    id: 'ember-sparkgap', kind: 'glyph', name: 'Kindle',
    subject: 'A burst of flame on scorched ground, and from the falling sparks a small wicker figure stands up already alight.',
  },
  {
    id: 'ember-clearthering', kind: 'glyph', name: 'Sweep the Ashes',
    subject: 'A wide arc of fire sweeping low across the ground, scattering small dark shapes and grey ash in a spinning ring.',
  },
  {
    id: 'ember-overpressure', kind: 'glyph', name: 'Debt of Fire',
    subject: 'A cracked teal glass root bursting into orange flame underground, fire jetting up through split earth, glowing resin boiling away to smoke.',
  },
  {
    id: 'ember-titlebout', kind: 'glyph', name: 'Another Verse',
    subject: 'A row of veiled singers seen from behind, mouths open, as a burning figure ahead of them turns back toward a smoky battle line.',
  },
  {
    id: 'ember-moltentorrent', kind: 'glyph', name: 'Burning Ground',
    subject: 'Cracked grey earth splitting open with fire racing along every crack, one fissure erupting in a tall column of flame.',
  },
];
