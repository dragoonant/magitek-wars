// Art manifest: the Blackwick (re-skin of src/data/cards/under.ts, PLAN D12).
// One entry per card in file order. `subject` is what the 64 x 48 illustration shows.
export const FACTION = 'blackwick';

export const CARDS = [
  // ---------- heroes and token ----------
  {
    id: 'under-sable', kind: 'hero', name: 'Corva Lusk, Tunnel Fence',
    subject: 'Lean woman in soot-black oilskin coat and verdigris rings, crouched on a tunnel ledge, holding one hooked lamp-pole, sewer rats gathered at her boots, green glow',
    ascendedName: 'Corva Lusk, Queen of the Runs',
    ascendedSubject: 'Lean woman in soot-black oilskin coat standing on stacked pawned crates, holding one hooked lamp-pole raised, a tide of green-eyed rats pouring around her',
  },
  {
    id: 'under-vex', kind: 'hero', name: 'Doctor Hollis Grane, Drawer',
    subject: 'Gaunt man in stained leather apron and brass goggles, glass-tank apparatus on his back, holding one glass draw-tube glowing green, lamplit cellar',
    ascendedName: 'Grane, Who Never Cools',
    ascendedSubject: 'Gaunt man in leather apron, arms spread, streams of green light flowing into the glowing glass tanks on his back from all sides, dark cellar',
  },
  {
    id: 'under-wirerat', kind: 'unit', name: 'Gloam Rat',
    subject: 'Soot-black sewer rat with gloam-green glowing eyes and a blank brass tag on a wire collar, on a wet brick tunnel ledge',
  },

  // ---------- units ----------
  {
    id: 'under-fuserunner', kind: 'unit', name: 'Fog Runner',
    subject: 'Young runner in soot-black hood and scarf darting through fog, holding one sealed oilcloth parcel, a faint green light trailing behind',
  },
  {
    id: 'under-leechtick', kind: 'unit', name: 'Pipe Leech',
    subject: 'Glossy black tunnel leech clinging to a corroded brass pipe, its body swelling with green light drawn from a cracked gloam seam',
  },
  {
    id: 'under-burnoutrunner', kind: 'unit', name: 'Burnt Wick',
    subject: 'Wiry gloam-addled thug in a torn shirt, veins glowing green, wide staring eyes, sprinting, holding one iron bar, green vapour pouring off him',
  },
  {
    id: 'under-ratwrangler', kind: 'unit', name: 'Rat Herder',
    subject: 'Old woman in a patched soot-black coat and verdigris earrings, holding one long hooked pole, a pack of rats swarming around her boots, sewer tunnel',
  },
  {
    id: 'under-pitaccountant', kind: 'unit', name: 'Pit Tallyman',
    subject: 'Hunched clerk in sleeve garters and soot-black waistcoat at a lamplit tunnel desk, holding one closed ledger, a green lantern beside him',
  },
  {
    id: 'under-acidlamplighter', kind: 'unit', name: 'Gloam Lamplighter',
    subject: 'Lamplighter in a long soot-black coat, holding one long pole whose tip burns with caustic dripping green gloam, foggy street lamp above',
  },
  {
    id: 'under-furnacehand', kind: 'unit', name: 'Cinder Stoker',
    subject: 'Broad stoker in leather apron and smoked goggles, holding one coal shovel, an open furnace mouth roaring green behind him, iron boiler room',
  },
  {
    id: 'under-backalleyenforcer', kind: 'unit', name: 'Alley Heavy',
    subject: 'Big man in a long soot-black coat and bowler hat, face shadowed, holding one iron cosh, green lantern glowing behind him in alley fog',
  },
  {
    id: 'under-leechwiresurgeon', kind: 'unit', name: 'Back-Room Surgeon',
    subject: 'Woman in a leather surgical apron and brass loupe, holding one brass hand-pump whose glass bulb fills with green light, lamplit back room',
  },
  {
    id: 'under-vaultpawnbroker', kind: 'unit', name: 'Deep Vault Broker',
    subject: 'Stout broker in a waistcoat and verdigris spectacles, holding one heavy iron key ring, before a round vault door and shelves of pawned brass',
  },
  {
    id: 'under-powdercourier', kind: 'unit', name: 'Blast Courier',
    subject: 'Courier in a soot-black cap and oilskin coat, holding one satchel of blasting charges with a hissing green fuse, running down a tunnel',
  },
  {
    id: 'under-syndicatebroker', kind: 'unit', name: 'Cage Fence',
    subject: 'Grinning fence in a fur-collared coat at a tunnel market stall, holding one brass rat cage, stacked cages of rats behind, green lanterns',
  },
  {
    id: 'under-leechoverseer', kind: 'unit', name: 'Drawhouse Overseer',
    subject: 'Towering overseer in a rubberised coat and brass rebreather mask, holding one hose-lance dripping caustic green gloam, pump hall with glass tanks',
  },
  {
    id: 'under-mainlinedynamo', kind: 'unit', name: 'Great Draw Engine',
    subject: 'Hulking soot-black gloamwork pump engine on four iron legs, glass tanks on its back, streams of green light pulled into it through fog',
  },
  // ---------- glyphs ----------
  {
    id: 'under-pullplug', kind: 'glyph', name: 'Pull the Bung',
    subject: 'Gloved hand pulling a brass plug from a riveted gloam tank, green light pouring out and streaming away into fog',
  },
  {
    id: 'under-siphontap', kind: 'glyph', name: 'Quiet Draw',
    subject: 'Thin stream of green light drawn from an armoured soldier\'s chest plate into a corked glass flask, dark alley',
  },
  {
    id: 'under-acidbath', kind: 'glyph', name: 'Gloam Dip',
    subject: 'Iron blade lifted out of a vat of bubbling caustic green gloam, smoking and dripping, by iron tongs',
  },
  {
    id: 'under-burnledger', kind: 'glyph', name: 'Torch the Books',
    subject: 'Closed leather ledger burning in green flame on an iron grate, sparks rising, dark brick room',
  },
  {
    id: 'under-snuffedfuse', kind: 'glyph', name: 'Pinch the Wick',
    subject: 'Two fingers pinching out a candle wick, a curl of smoke, the shadow of a man filling the doorway behind',
  },
  {
    id: 'under-bleeddry', kind: 'glyph', name: 'Wrung Dry',
    subject: 'A tall column of green light pulled out of a brass boiler tower, coiling down into a dark tunnel mouth, the tower going grey',
  },
  {
    id: 'under-chainoverload', kind: 'glyph', name: 'Undertow',
    subject: 'Green light drawn out of a line of soldiers in fog, streams converging into a single hanging green lantern',
  },
  {
    id: 'under-wiremarket', kind: 'glyph', name: 'Open the Grates',
    subject: 'A flood of green-eyed rats pouring from an open iron sewer grate under green lantern light, wet cobbles',
  },
  {
    id: 'under-leechharvest', kind: 'glyph', name: 'Collect the Dues',
    subject: 'Small green lights rising from empty coats on a tunnel floor, gathered into one glass jar on a stone ledge',
  },
  // ---------- second wave: the collector and the debtholder ----------
  {
    id: 'under-marrow', kind: 'hero', name: 'Dunstan Graff, Strongarm',
    subject: 'Broad-shouldered collector in a soot-black greatcoat and iron-shod boots, holding one heavy iron cudgel, looming at a doorway lit green',
    ascendedName: 'Graff, the Last Knock',
    ascendedSubject: 'Broad-shouldered collector in a soot-black greatcoat striding down a foggy street, holding one iron cudgel, green lanterns burning at every door behind him',
  },
  {
    id: 'under-penn', kind: 'hero', name: 'Mother Agna Vell',
    subject: 'Old woman in black lace and a verdigris shawl, seated in a high-backed chair, holding one green lantern in her lap, pawn vault shadows',
    ascendedName: 'Agna Vell, Whom Every House Owes',
    ascendedSubject: 'Old woman in black lace and verdigris shawl standing on a balcony over the undercity, holding one green lantern high, green lanterns glowing at countless doors below',
  },
  {
    id: 'under-skimclerk', kind: 'unit', name: 'Thumb-Scale Clerk',
    subject: 'Young clerk in a green eyeshade weighing gloam vials on a brass counter scale, one thumb resting on the pan, lamplit pawn counter',
  },
  {
    id: 'under-blisterrat', kind: 'unit', name: 'Seep Rat',
    subject: 'Mangy rat with fur crusted in caustic green gloam, smoking faintly, scrabbling over a rusted pipe in a dark tunnel',
  },
  {
    id: 'under-tollrat', kind: 'unit', name: 'Coin Rat',
    subject: 'Lean soot-black rat carrying one blank brass coin in its teeth along a tunnel ledge, green lantern light behind',
  },
  {
    id: 'under-kneecapper', kind: 'unit', name: 'Door-Knocker',
    subject: 'Lean thug in a flat cap and soot-black waistcoat, holding one short iron crowbar against his palm, beside a door with a green lantern',
  },
  {
    id: 'under-bagman', kind: 'unit', name: 'Satchel Man',
    subject: 'Nervous man in a long grey coat clutching one heavy leather satchel of coin to his chest, glancing back, foggy lamplit street',
  },
  {
    id: 'under-wireboundthug', kind: 'unit', name: 'Tankbound Bruiser',
    subject: 'Bruiser with brass braces strapped to his arms, green-glowing tubes running from a back canister, holding one iron knuckle-duster, tunnel',
  },
  {
    id: 'under-vattailor', kind: 'unit', name: 'Gloamdye Tailor',
    subject: 'Tailor in a leather apron and verdigris thimbles, holding one pair of iron tongs, lifting a long coat from a vat of smoking green gloam',
  },
  {
    id: 'under-interestcollector', kind: 'unit', name: 'Interest Man',
    subject: 'Thin collector in a black frock coat and tall hat, holding one open pocket watch, under a row of green lanterns at dusk',
  },
  {
    id: 'under-grudgekeeper', kind: 'unit', name: 'Notch-Keeper',
    subject: 'Grizzled old bruiser in a soot-black greatcoat, holding one iron cudgel scored with many notches, seated on a crate in lamplit fog',
  },
  {
    id: 'under-persuasionengine', kind: 'unit', name: 'Cellar Press',
    subject: 'Squat gloamwork iron press with two clamping arms and a green-glowing boiler belly, chains hanging, in a low brick cellar',
  },
  {
    id: 'under-debtassessor', kind: 'unit', name: 'Lien Assessor',
    subject: 'Precise woman in a high-collared soot-black coat and pince-nez, holding one closed ledger, appraising coldly, lamplit doorway',
  },
  {
    id: 'under-noticeserver', kind: 'unit', name: 'Lantern Hanger',
    subject: 'Grim man in a long soot-black coat, holding one green lantern up to hang it on a debtor\'s door hook, foggy street',
  },
  {
    id: 'under-taplinecolossus', kind: 'unit', name: 'Root-Tap Colossus',
    subject: 'Huge soot-black gloamwork construct, its drill arm plunged into a glowing green glass root, cavern, green light flowing up its pipes',
  },
  {
    id: 'under-blackgatejuggernaut', kind: 'unit', name: 'Soot Juggernaut',
    subject: 'Massive soot-black armoured two-legged walking boiler with an iron ram prow and green lamps, verdigris rivets, striding through a tunnel gate',
  },

  // ---------- second wave glyphs ----------
  {
    id: 'under-skimtop', kind: 'glyph', name: 'Light Fingers',
    subject: 'Gloved hand lifting one blank coin off a tall coin stack on a pawn counter, green lamplight',
  },
  {
    id: 'under-calledtoaccount', kind: 'glyph', name: 'Called In',
    subject: 'Heavy gloved fist knocking on a wooden door, a green lantern hanging above, fog at the threshold',
  },
  {
    id: 'under-protectionfee', kind: 'glyph', name: 'Lantern Rent',
    subject: 'A foggy street of narrow houses, a green lantern lit at every door, green light leaking from the windows',
  },
  {
    id: 'under-makeexample', kind: 'glyph', name: 'Sent Ahead',
    subject: 'Burly thug in soot-black coat shoved hurtling into an armoured soldier, green sparks bursting where they meet, tunnel',
  },
  {
    id: 'under-streettax', kind: 'glyph', name: 'Gutter Toll',
    subject: 'Coins sliding from many leather purses into one iron strongbox, green glow rising from the box, cobbled gutter',
  },
  {
    id: 'under-backalleylesson', kind: 'glyph', name: 'Alley Schooling',
    subject: 'Three shadowed thugs in long coats closing in on a lone armoured soldier, foggy alley lit by one green lamp',
  },
  {
    id: 'under-foreclosure', kind: 'glyph', name: 'Seized',
    subject: 'Heavy iron padlock and chain snapped shut across a door, green lantern hanging above, green light fading from the windows',
  },
  {
    id: 'under-lightsout', kind: 'glyph', name: 'Kill the Lamps',
    subject: 'Street lamps going dark one by one down a foggy street, rows of green eyes glinting in the shadows',
  },
  {
    id: 'under-hostiletakeover', kind: 'glyph', name: 'Repossessed',
    subject: 'Two-legged walking boiler in heavy chains being dragged into a tunnel by coated collectors, green lantern hung on its cab',
  },
];
