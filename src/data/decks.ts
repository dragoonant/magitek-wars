// Deck helpers and the premade decks.
import './cards/index';
import type { CardDef, DeckList, FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { allCards } from '../engine/query';
import { checkDeck } from '../engine/validate';

export const FACTION_INFO: Record<FactionId, { name: string; blurb: string; hue: number }> = {
  prism: { name: 'Prismguard', blurb: 'Wardens of the upper tiers. Plated walls, Ward, and allies that grow together.', hue: 48 },
  ember: { name: 'Emberworks', blurb: 'The foundry district. Direct damage and swarms of short-lived constructs.', hue: 14 },
  tide: { name: 'Tidewardens', blurb: 'The canal mages. Card draw, Stasis and a glyph for every moment.', hue: 205 },
  coil: { name: 'Verdant Coil', blurb: 'The rooftop biodomes. Extra Charge and enormous beasts with Pierce.', hue: 135 },
  under: { name: 'Undervolt', blurb: 'The undercity syndicate. Drain, Dread and profit from every unit lost.', hue: 285 },
  storm: { name: 'Stormrail', blurb: 'The sky couriers. Aerial strikes, Vanguard and second attacks.', hue: 180 },
};

export function collectible(): CardDef[] {
  return allCards().filter((c) => !c.token && !c.unimplemented && !c.id.startsWith('zz-'));
}

/**
 * Build a legal 40-card deck from two factions by curve: 3 copies of each of up to two heroes, then units and
 * glyphs cheapest first, alternating factions. Deterministic. Used for "Surprise me" and until decks are hand-tuned.
 */
export function autoDeck(a: FactionId, b: FactionId): string[] {
  const pool = collectible().filter((c) => c.faction === a || c.faction === b);
  const heroes = pool.filter((c) => c.type === 'hero').sort((x, y) => x.cost - y.cost || x.id.localeCompare(y.id));
  const pickHeroes = [heroes.find((h) => h.faction === a), heroes.find((h) => h.faction === b && b !== a) ?? heroes.find((h) => h.faction === a && h !== heroes.find((x) => x.faction === a))]
    .filter((h): h is CardDef => !!h);
  const deck: string[] = [];
  for (const h of pickHeroes) for (let i = 0; i < LIMITS.copies; i++) deck.push(h.id);
  const rest = pool.filter((c) => c.type !== 'hero').sort((x, y) => x.cost - y.cost || x.id.localeCompare(y.id));
  const byFaction = [rest.filter((c) => c.faction === a), rest.filter((c) => c.faction === b && b !== a)];
  let copies = LIMITS.copies;
  while (deck.length < LIMITS.deck && copies > 0) {
    let i = 0;
    let added = false;
    while (deck.length < LIMITS.deck && (i < byFaction[0].length || i < byFaction[1].length)) {
      for (const list of byFaction) {
        const c = list[i];
        if (!c || deck.length >= LIMITS.deck) continue;
        const have = deck.filter((id) => id === c.id).length;
        const want = c.cost >= 6 ? 1 : c.cost >= 4 ? 2 : 3;
        if (have < Math.min(want, LIMITS.copies) && have < LIMITS.copies - copies + 1) { deck.push(c.id); added = true; }
      }
      i += 1;
    }
    copies -= 1;
    if (!added) break;
  }
  return deck;
}

/**
 * The first five premades, as autoDeck built them from the original 150-card pool (frozen 2026-11-26, PLAN D26, so that
 * new cards do not change decks players already know).
 */
const CURVE: { name: string; cards: Record<string, number> }[] = [
  { name: 'Wall of Thorns', cards: { 'prism-ysolde': 3, 'coil-aruvi': 3, 'prism-facet-initiate': 1, 'coil-rootling': 1, 'prism-glasswarden': 1, 'coil-sap-surge': 1, 'prism-hold-the-line': 1, 'coil-sprout-tender': 1, 'prism-lampkeeper': 1, 'coil-thornback-cub': 1, 'prism-patch-the-pane': 1, 'coil-bristle': 1, 'prism-bracewright': 1, 'coil-duel-of-thorns': 1, 'prism-call-out': 1, 'coil-hothouse-bloom': 1, 'prism-mirror-ward': 1, 'coil-sap-engine': 1, 'prism-pane-mender': 1, 'coil-spearhorn': 1, 'prism-tierguard': 1, 'coil-vinewhip': 1, 'prism-choir-of-facets': 1, 'coil-bloomcaller': 1, 'prism-chorus-warden': 1, 'coil-crownmaw': 1, 'prism-crystal-bulwark': 1, 'coil-lash-out': 1, 'prism-lightwall-oath': 1, 'coil-lashvine': 1, 'prism-sentinel-lens': 1, 'coil-overgrowth': 1, 'prism-aegis-colossus': 1, 'coil-grafting': 1, 'prism-tier-rally': 1, 'coil-spore-herald': 1 } },
  { name: 'Foundry Squall', cards: { 'ember-kessa': 3, 'storm-jax': 3, 'ember-ashrunner': 1, 'storm-flagbearer': 1, 'ember-cinderscamp': 1, 'storm-signalkite': 1, 'ember-kilnhand': 1, 'storm-tailwind': 1, 'ember-overdrive': 1, 'storm-tickettaker': 1, 'ember-fuseguard': 1, 'storm-dispatcher': 1, 'ember-pinprick': 1, 'storm-gustcaller': 1, 'ember-scrapburst': 1, 'storm-railglider': 1, 'ember-slagbolt': 1, 'storm-updraft': 1, 'ember-slagsmith': 1, 'storm-airmail': 1, 'ember-sparkforge': 1, 'storm-crosswind': 1, 'ember-arcwelder': 1, 'storm-galecourier': 1, 'ember-furnacebrute': 1, 'storm-galesurge': 1, 'ember-furnacetender': 1, 'storm-reroute': 1, 'ember-heatlance': 1, 'storm-skyhook': 1, 'ember-sparkcascade': 1, 'storm-sparkrider': 1, 'ember-ventburst': 1, 'storm-squadcaller': 1, 'ember-blastminer': 1, 'storm-jetstream': 1 } },
  { name: 'Cold Current', cards: { 'tide-maren': 3, 'under-sable': 3, 'tide-mirroreel': 1, 'under-burnoutrunner': 1, 'tide-ripplescribe': 1, 'under-fuserunner': 1, 'tide-slipunder': 1, 'under-leechtick': 1, 'tide-sluicepage': 1, 'under-pullplug': 1, 'tide-driftseer': 1, 'under-acidbath': 1, 'tide-eddycourier': 1, 'under-acidlamplighter': 1, 'tide-heldbreath': 1, 'under-burnledger': 1, 'tide-quickcurrent': 1, 'under-pitaccountant': 1, 'tide-tidalveil': 1, 'under-ratwrangler': 1, 'tide-wardtender': 1, 'under-siphontap': 1, 'tide-backwash': 1, 'under-backalleyenforcer': 1, 'tide-glassarchivist': 1, 'under-furnacehand': 1, 'tide-hushwateradept': 1, 'under-leechwiresurgeon': 1, 'tide-lockkeeper': 1, 'under-snuffedfuse': 1, 'tide-unwrite': 1, 'under-wiremarket': 1, 'tide-pearlsentinel': 1, 'under-bleeddry': 1, 'tide-sluiceclose': 1, 'under-leechharvest': 1 } },
  { name: 'Skywatch', cards: { 'storm-jax': 3, 'prism-ysolde': 3, 'storm-flagbearer': 1, 'prism-facet-initiate': 1, 'storm-signalkite': 1, 'prism-glasswarden': 1, 'storm-tailwind': 1, 'prism-hold-the-line': 1, 'storm-tickettaker': 1, 'prism-lampkeeper': 1, 'storm-dispatcher': 1, 'prism-patch-the-pane': 1, 'storm-gustcaller': 1, 'prism-bracewright': 1, 'storm-railglider': 1, 'prism-call-out': 1, 'storm-updraft': 1, 'prism-mirror-ward': 1, 'storm-airmail': 1, 'prism-pane-mender': 1, 'storm-crosswind': 1, 'prism-tierguard': 1, 'storm-galecourier': 1, 'prism-choir-of-facets': 1, 'storm-galesurge': 1, 'prism-chorus-warden': 1, 'storm-reroute': 1, 'prism-crystal-bulwark': 1, 'storm-skyhook': 1, 'prism-lightwall-oath': 1, 'storm-sparkrider': 1, 'prism-sentinel-lens': 1, 'storm-squadcaller': 1, 'prism-aegis-colossus': 1, 'storm-jetstream': 1, 'prism-tier-rally': 1 } },
  { name: 'Wildfire Garden', cards: { 'coil-aruvi': 3, 'ember-kessa': 3, 'coil-rootling': 1, 'ember-ashrunner': 1, 'coil-sap-surge': 1, 'ember-cinderscamp': 1, 'coil-sprout-tender': 1, 'ember-kilnhand': 1, 'coil-thornback-cub': 1, 'ember-overdrive': 1, 'coil-bristle': 1, 'ember-fuseguard': 1, 'coil-duel-of-thorns': 1, 'ember-pinprick': 1, 'coil-hothouse-bloom': 1, 'ember-scrapburst': 1, 'coil-sap-engine': 1, 'ember-slagbolt': 1, 'coil-spearhorn': 1, 'ember-slagsmith': 1, 'coil-vinewhip': 1, 'ember-sparkforge': 1, 'coil-bloomcaller': 1, 'ember-arcwelder': 1, 'coil-crownmaw': 1, 'ember-furnacebrute': 1, 'coil-lash-out': 1, 'ember-furnacetender': 1, 'coil-lashvine': 1, 'ember-heatlance': 1, 'coil-overgrowth': 1, 'ember-sparkcascade': 1, 'coil-grafting': 1, 'ember-ventburst': 1, 'coil-spore-herald': 1, 'ember-blastminer': 1 } },
];

type HandDeck = { name: string; about: string; cards: Record<string, number> };

/**
 * Blackwater keeps its slot (sixth) but is built by hand: as autoDeck('under', 'tide') it was card for card the same
 * deck as Cold Current, because autoDeck does not depend on the order of its two factions.
 */
export const BLACKWATER: HandDeck = {
  name: 'Blackwater', about: "Freeze the enemy's blockers and leech their units dry; Vex ascends as your Spire heals.",
  cards: {
    'under-vex': 3, 'tide-ilvane': 3,
    'under-leechtick': 3, 'under-siphontap': 3, 'under-leechwiresurgeon': 3, 'under-acidlamplighter': 2, 'under-snuffedfuse': 2, 'under-vaultpawnbroker': 2, 'under-bleeddry': 1, 'under-leechoverseer': 1,
    'tide-mirroreel': 3, 'tide-wardtender': 2, 'tide-heldbreath': 3, 'tide-quickcurrent': 2, 'tide-lockkeeper': 2, 'tide-glassarchivist': 2, 'tide-stillwaterbailiff': 2, 'tide-frostmeremagistrate': 1,
  },
};

/**
 * The twelve newer premade decks, built by hand around one plan each (card id: copies). With the first six they
 * cover all 15 faction pairs plus two single-faction decks, and every hero leads at least two premades.
 * Win rates: BALANCE.md B-4.
 */
export const HAND_BUILT: HandDeck[] = [
  {
    name: 'Kiln Bastion', about: 'Plated walls soak the hits that grow Oren while the foundry fills the Line with constructs.',
    cards: {
      'prism-oren': 3, 'ember-crucible': 2,
      'prism-glasswarden': 3, 'prism-tierguard': 2, 'prism-pane-mender': 2, 'prism-crystal-bulwark': 3, 'prism-aegis-colossus': 2, 'prism-vault-captain': 2, 'prism-lightwall-matron': 1,
      'ember-cinderscamp': 3, 'ember-slagsmith': 3, 'ember-sparkforge': 2, 'ember-furnacebrute': 3, 'ember-furnacetender': 2, 'ember-arcwelder': 2, 'ember-slagbolt': 2, 'ember-cinderhail': 2, 'ember-crucibleherald': 1,
    },
  },
  {
    name: 'Stillglass', about: 'Freeze the biggest threats in Stasis while Ysolde keeps a wall of Wardens repaired.',
    cards: {
      'prism-ysolde': 3, 'tide-ilvane': 3,
      'prism-glasswarden': 3, 'prism-lampkeeper': 2, 'prism-tierguard': 3, 'prism-bracewright': 2, 'prism-crystal-bulwark': 2, 'prism-sentinel-lens': 2, 'prism-chorus-warden': 2, 'prism-spire-keeper': 1, 'prism-tier-sovereign': 1,
      'tide-mirroreel': 3, 'tide-heldbreath': 3, 'tide-lockkeeper': 2, 'tide-glassarchivist': 1, 'tide-stillwaterbailiff': 2, 'tide-pearlsentinel': 2, 'tide-sluiceclose': 1, 'tide-frostmeremagistrate': 1, 'tide-floodtide': 1,
    },
  },
  {
    name: 'Tithe Wall', about: 'Drain the enemy a little every turn behind Plated walls; every repair to your Spire brings Vex closer.',
    cards: {
      'prism-oren': 3, 'under-vex': 3,
      'prism-glasswarden': 3, 'prism-lampkeeper': 2, 'prism-tierguard': 2, 'prism-pane-mender': 2, 'prism-crystal-bulwark': 3, 'prism-sentinel-lens': 2, 'prism-chorus-warden': 2, 'prism-aegis-colossus': 2, 'prism-spire-keeper': 2, 'prism-spire-mantle': 1,
      'under-leechtick': 3, 'under-siphontap': 3, 'under-leechwiresurgeon': 3, 'under-bleeddry': 1, 'under-vaultpawnbroker': 2, 'under-leechoverseer': 1,
    },
  },
  {
    name: 'Scaldwater', about: 'A glyph every turn: cheap burn and card draw, made cheaper by an ascended Maren and sharper by Kessa.',
    cards: {
      'ember-kessa': 3, 'tide-maren': 3,
      'ember-sparkforge': 3, 'ember-arcwelder': 2, 'ember-pinprick': 3, 'ember-slagbolt': 3, 'ember-ventburst': 2, 'ember-heatlance': 3, 'ember-cinderhail': 2,
      'tide-sluicepage': 2, 'tide-ripplescribe': 3, 'tide-driftseer': 2, 'tide-quickcurrent': 3, 'tide-heldbreath': 2, 'tide-hushwateradept': 2, 'tide-glassarchivist': 1, 'tide-deepwateroracle': 1,
    },
  },
  {
    name: 'Slag Market', about: 'Spend your own units: tokens and fuses that pay out on the way to the Scrap, and Sable grows on every loss.',
    cards: {
      'under-sable': 3, 'ember-crucible': 3,
      'under-fuserunner': 3, 'under-burnoutrunner': 2, 'under-ratwrangler': 3, 'under-pitaccountant': 3, 'under-furnacehand': 2, 'under-wiremarket': 2, 'under-leechharvest': 1, 'under-syndicatebroker': 1, 'under-pullplug': 1,
      'ember-cinderscamp': 3, 'ember-kilnhand': 2, 'ember-fuseguard': 3, 'ember-scrapburst': 2, 'ember-furnacetender': 2, 'ember-sparkcascade': 2, 'ember-blastminer': 1, 'ember-crucibleherald': 1,
    },
  },
  {
    name: 'Deep Roots', about: 'Ramp your Charge early, hold the enemy in Stasis, then land beasts too big to answer.',
    cards: {
      'tide-ilvane': 3, 'coil-aruvi': 3,
      'coil-sprout-tender': 3, 'coil-rootling': 2, 'coil-sap-engine': 3, 'coil-hothouse-bloom': 2, 'coil-spearhorn': 2, 'coil-crownmaw': 2, 'coil-tuskhide': 3, 'coil-canopy-titan': 2, 'coil-behemoth': 1, 'coil-domewyrm': 1,
      'tide-mirroreel': 2, 'tide-heldbreath': 3, 'tide-lockkeeper': 2, 'tide-glassarchivist': 1, 'tide-stillwaterbailiff': 2, 'tide-sluiceclose': 2, 'tide-frostmeremagistrate': 1,
    },
  },
  {
    name: 'Crosscurrent', about: 'Fly over the Line and bounce blockers away; Jax ascends on Spire hits and attacks twice.',
    cards: {
      'storm-jax': 3, 'tide-maren': 3,
      'storm-signalkite': 2, 'storm-tickettaker': 3, 'storm-railglider': 3, 'storm-dispatcher': 2, 'storm-updraft': 2, 'storm-galecourier': 3, 'storm-sparkrider': 2, 'storm-reroute': 1, 'storm-thunderkite': 2,
      'tide-sluicepage': 3, 'tide-ripplescribe': 2, 'tide-heldbreath': 3, 'tide-quickcurrent': 2, 'tide-backwash': 2, 'tide-lockkeeper': 2,
    },
  },
  {
    name: 'Rot Canopy', about: 'Big beasts that heal as they hit and leeches that drain; an ascended Brakk attacks twice.',
    cards: {
      'coil-brakk': 3, 'under-vex': 3,
      'coil-thornback-cub': 3, 'coil-sprout-tender': 2, 'coil-sap-engine': 3, 'coil-spearhorn': 2, 'coil-vinewhip': 3, 'coil-crownmaw': 2, 'coil-tuskhide': 3, 'coil-canopy-titan': 2, 'coil-domewyrm': 1,
      'under-leechtick': 3, 'under-burnoutrunner': 2, 'under-siphontap': 2, 'under-leechwiresurgeon': 2, 'under-backalleyenforcer': 2, 'under-snuffedfuse': 1, 'under-leechoverseer': 1,
    },
  },
  {
    name: 'Thunderhide', about: 'Heavy beasts given wings: Pierce from the air, and extra attacks from Brakk and Reroute.',
    cards: {
      'coil-brakk': 2, 'storm-corvane': 3,
      'coil-rootling': 2, 'coil-sap-engine': 3, 'coil-spearhorn': 3, 'coil-crownmaw': 2, 'coil-bristle': 2, 'coil-tuskhide': 2, 'coil-canopy-titan': 1,
      'storm-signalkite': 2, 'storm-tailwind': 1, 'storm-updraft': 2, 'storm-railglider': 3, 'storm-gustcaller': 2, 'storm-galecourier': 2, 'storm-sparkrider': 2, 'storm-thunderkite': 2, 'storm-stormcaller': 2, 'storm-reroute': 1, 'storm-cyclonebarge': 1,
    },
  },
  {
    name: 'Blackout Post', about: 'Go wide and fast with Dread runners and rats, then swing everything at once for Corvane.',
    cards: {
      'under-sable': 3, 'storm-corvane': 2,
      'under-burnoutrunner': 3, 'under-fuserunner': 2, 'under-ratwrangler': 3, 'under-acidlamplighter': 2, 'under-backalleyenforcer': 3, 'under-wiremarket': 2, 'under-snuffedfuse': 2, 'under-syndicatebroker': 1,
      'storm-tickettaker': 2, 'storm-flagbearer': 3, 'storm-railglider': 3, 'storm-sparkrider': 2, 'storm-squadcaller': 2, 'storm-galesurge': 2, 'storm-stormcaller': 2, 'storm-skyraid': 1,
    },
  },
  {
    name: 'Foundry Floor', about: 'Emberworks alone: burn every blocker, push damage at the Spire, finish with Firestorm.',
    cards: {
      'ember-kessa': 3, 'ember-crucible': 3,
      'ember-cinderscamp': 3, 'ember-ashrunner': 3, 'ember-kilnhand': 2, 'ember-slagsmith': 3, 'ember-sparkforge': 2, 'ember-slagbolt': 3, 'ember-furnacebrute': 3, 'ember-arcwelder': 2,
      'ember-furnacetender': 2, 'ember-heatlance': 2, 'ember-sparkcascade': 1, 'ember-pyrelancer': 2, 'ember-cinderhail': 2, 'ember-moltenwarden': 2, 'ember-firestorm': 1, 'ember-foundrytitan': 1,
    },
  },
  {
    name: 'Floodgate', about: 'Tidewardens alone: draw deep, freeze or bounce whatever attacks, and win the long game.',
    cards: {
      'tide-maren': 3, 'tide-ilvane': 3,
      'tide-sluicepage': 3, 'tide-mirroreel': 3, 'tide-wardtender': 2, 'tide-heldbreath': 3, 'tide-quickcurrent': 1, 'tide-lockkeeper': 3, 'tide-hushwateradept': 2, 'tide-glassarchivist': 3,
      'tide-backwash': 1, 'tide-stillwaterbailiff': 3, 'tide-pearlsentinel': 3, 'tide-sluiceclose': 1, 'tide-deepwateroracle': 2, 'tide-frostmeremagistrate': 2, 'tide-floodtide': 1, 'tide-gateleviathan': 1,
    },
  },
];

/**
 * Six premades led by the twelve First Light heroes (PLAN D26), two new heroes each, built from the faction's new cards.
 * Win rates: BALANCE.md B-5.
 */
export const NEW_HERO_DECKS: HandDeck[] = [
  {
    name: 'Banner Wing', about: 'Drill a wide line of small wardens and kites, buffing them every round until both captains ascend.',
    cards: {
      'prism-tamsin': 3, 'storm-odile': 3,
      'prism-shieldline-cadet': 3, 'prism-rank-drummer': 2, 'prism-shield-sergeant': 2, 'prism-rampart-herald': 2, 'prism-tier-pikeman': 2, 'prism-cohort-drillmaster': 2, 'prism-gilded-phalanx': 1, 'prism-lock-shields': 2, 'prism-grand-muster': 1,
      'storm-ribbonkite': 3, 'storm-wingcadet': 2, 'storm-skirmishkite': 2, 'storm-windrigger': 2, 'storm-gyrekite': 2, 'storm-glidetutor': 2, 'storm-aeriecarrier': 1, 'storm-closeechelon': 2, 'storm-flightdrill': 1,
    },
  },
  {
    name: 'Hunting Lens', about: 'Spotters pick off whatever flies while the pack runs down every wounded enemy.',
    cards: {
      'prism-orrin': 3, 'coil-nyra': 3,
      'prism-glint-scout': 2, 'prism-lens-fitter': 2, 'prism-flak-tripod': 2, 'prism-range-warden': 2, 'prism-lens-battery': 2, 'prism-skylens-bastion': 1, 'prism-steady-aim': 2, 'prism-covering-fire': 2, 'prism-focused-volley': 1,
      'coil-carrion-beetle': 1, 'coil-thicket-jackal': 2, 'coil-snare-trapper': 3, 'coil-ridgeback': 2, 'coil-tusk-challenger': 2, 'coil-bloodtrail': 2, 'coil-ridge-howler': 2, 'coil-horncrown': 1, 'coil-run-down': 2, 'coil-cull-the-wounded': 1,
    },
  },
  {
    name: 'Bloodsand Pit', about: 'Force the fights you want: duellists and Dread enforcers grind the enemy Line down one bout at a time.',
    cards: {
      'ember-torva': 3, 'under-marrow': 3,
      'ember-ringcrier': 2, 'ember-pitbrawler': 3, 'ember-pitpromoter': 2, 'ember-slaggladiator': 2, 'ember-pitboss': 2, 'ember-forgemarshal': 1, 'ember-hotrivets': 2, 'ember-cheapshot': 2, 'ember-titlebout': 1,
      'under-kneecapper': 3, 'under-wireboundthug': 2, 'under-vattailor': 2, 'under-grudgekeeper': 2, 'under-persuasionengine': 2, 'under-noticeserver': 1, 'under-calledtoaccount': 2, 'under-backalleylesson': 2, 'under-blackgatejuggernaut': 1,
    },
  },
  {
    name: 'Redline Express', about: 'Flood the rails with cheap runners, swing with all of them at once, then attack again.',
    cards: {
      'ember-yarrow': 3, 'storm-ness': 3,
      'ember-flarebot': 3, 'ember-cinderscamp': 2, 'ember-slagsmith': 2, 'ember-meltdowngolem': 2, 'ember-arcwelder': 2, 'ember-steamcondenser': 1, 'ember-boilercolossus': 1, 'ember-sparkgap': 2, 'ember-slagbolt': 2,
      'storm-tailrunner': 3, 'storm-flagbearer': 2, 'storm-tickettaker': 2, 'storm-veteranrunner': 2, 'storm-switchforeman': 2, 'storm-breakneck': 2, 'storm-bellexpress': 1, 'storm-anchorleg': 2, 'storm-doubledeparture': 1,
    },
  },
  {
    name: 'Ledger of Tides', about: 'Keep a full hand and a busy round: every glyph you cast taxes the enemy Spire a little more.',
    cards: {
      'tide-sefa': 3, 'under-penn': 3,
      'tide-siltnewt': 2, 'tide-marginclerk': 2, 'tide-tallyframe': 2, 'tide-shelfwarden': 2, 'tide-brineboundsage': 2, 'tide-lorewhale': 1, 'tide-boundvolume': 2, 'tide-readthecurrent': 2, 'tide-rifflethestacks': 2,
      'under-skimclerk': 2, 'under-bagman': 2, 'under-interestcollector': 2, 'under-debtassessor': 2, 'under-taplinecolossus': 1, 'under-skimtop': 3, 'under-protectionfee': 2, 'under-streettax': 2, 'under-foreclosure': 1,
    },
  },
  {
    name: 'Tidal Garden', about: 'Replay your best Deploys and send blockers home while a garden of Saplings grows behind them.',
    cards: {
      'tide-corra': 3, 'coil-halcy': 3,
      'tide-lockhound': 2, 'tide-undertowsprite': 2, 'tide-tidemarkreader': 2, 'tide-backflowlancer': 2, 'tide-weirgolem': 2, 'tide-sluicegatebehemoth': 1, 'tide-floodwallcolossus': 1, 'tide-pulloftheweir': 2, 'tide-homewardcurrent': 2, 'tide-lockandrelease': 1,
      'coil-furrow-hand': 3, 'coil-seed-drill': 2, 'coil-grove-keeper': 2, 'coil-seed-thresher': 2, 'coil-bloomwood-shepherd': 1, 'coil-quickening-rain': 2, 'coil-thorn-volley': 2, 'coil-sow-the-rooftops': 1, 'coil-transplant': 1, 'coil-compost-heap': 1,
    },
  },
];

/** A premade deck; `about` is the one-line plan shown on the New game screen (hand-built decks only). */
export interface PremadeDeck extends DeckList { about?: string }

const expand = (cards: Record<string, number>): string[] => Object.entries(cards).flatMap(([id, n]) => Array<string>(n).fill(id));

/**
 * Premade decks: the original six first, in their old order (so `?decks=` indices stay the same), then the twelve
 * hand-built ones, then the six led by the First Light heroes. Only decks that pass checkDeck are offered (a deck is never silently patched);
 * tests/decks.test.ts fails if any is dropped.
 */
export function premadeDecks(): PremadeDeck[] {
  const curve: PremadeDeck[] = CURVE.map((d) => ({ name: d.name, cards: expand(d.cards) }));
  const hand = [BLACKWATER, ...HAND_BUILT, ...NEW_HERO_DECKS].map((d) => ({ name: d.name, about: d.about, cards: expand(d.cards) }));
  return [...curve, ...hand].filter((d) => checkDeck(d.cards).ok);
}
