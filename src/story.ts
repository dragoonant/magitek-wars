// The story of the Crystal War (PLAN D27, docs/WORLD.md): the world's introduction for the attract mode, and for each
// nation why it marches on Vaskor in the campaign (spec 20, R-R13). Prose is sentence case (PLAN D25); headings are
// capitals. Every name here is ours (PLAN D1).
import type { FactionId } from './engine/types';
import type { Field } from './ui';
import { FACTIONS } from './data/factions';

/** One page of the attract mode: a painted field behind a heading and a few paragraphs. */
export interface StoryPage {
  field: Field;
  heading: string;
  /** A line under the heading (the nation's lead, or a place). */
  sub?: string;
  paragraphs: readonly string[];
  /** The nation this page is about: its emblem and its lead's art are shown. */
  nation?: FactionId;
}

/** The world before the nations: what crystal is, what the heart crystals are, and why the war began. */
export const WORLD_PAGES: readonly StoryPage[] = [
  {
    field: 'sedgemere', heading: 'ARDENMOOR', sub: 'A continent above the Underroot',
    paragraphs: [
      'Under the continent of Ardenmoor runs the Underroot: a buried lattice of ancient roots turned to green glass. Where a root runs close to the soil, it grows crystal.',
      'Burned in a furnace, crystal gives a steam that drives engines harder than coal ever could. Breathed in by a trained caster, it becomes fire, frost and light, at the price of the caster’s own warmth.',
    ],
  },
  {
    field: 'rimeglass', heading: 'THE HEART CRYSTALS', sub: 'One great stone for every nation',
    paragraphs: [
      'Every nation keeps a heart crystal: one great stone, grown for centuries over the deepest root it can claim. It feeds the nation’s engines and its casters.',
      'In battle, each side stands in front of its own. A nation whose crystal is shattered goes dark.',
    ],
  },
  {
    field: 'greying', heading: 'THE GREYING', sub: 'The dead lands around Vaskor',
    paragraphs: [
      'The Great Crystal of Vaskor, heart of the Cindral Dominion, is the largest ever grown. It drinks the Underroot faster than the roots refill, and where a root dies the land above goes grey and silent.',
      'The Dominion says the Great Crystal keeps forty million people fed. The towns above the dying roots say it is killing them. Both are right.',
    ],
  },
  {
    field: 'thrumhollow', heading: 'THE SURVEY', sub: 'Eleven years',
    paragraphs: [
      'Then a rebel raid on the northern line carried off a sealed survey written by the Dominion’s own Archwright, Tobias Venn. His numbers say the Underroot dies in eleven years at the present draw.',
      'Six nations have read it, or heard what it says. Every one of them is marching on Vaskor.',
    ],
  },
];

/** What a nation's story holds: who it is (attract mode), and why it marches (campaign prologue, acts, ending). */
export interface NationStory {
  /** Two short paragraphs for the attract mode: who they are, and what the Greying means to them. */
  who: readonly [string, string];
  /** The lead's name and title, as the attract mode and the prologue print it. */
  lead: string;
  /** The campaign prologue's heading. */
  title: string;
  /** Why this nation marches from Thrumhollow across the Flats to Vaskor (R-R13). */
  prologue: readonly string[];
  /** One line for each act (Thrumhollow, the Rimeglass Flats, Vaskor), shown as the act begins (R-R13). */
  acts: readonly [string, string, string];
  /** How this nation's march ends, shown when the run is won (R-R13). */
  ending: string;
}

export const NATIONS: Record<FactionId, NationStory> = {
  prism: {
    lead: 'Marshal Ilse Corrow',
    who: [
      'The empire, built on crystal steam: engine legions, rail artillery, and caster officers who run cold to the touch. From the Gear Citadel, Sovereign Maudrey Hale rules by decrees stamped in brass.',
      'The Dominion holds the Great Crystal, and forty million people who eat because it burns.',
    ],
    title: 'THE MARSHAL’S LEDGER',
    prologue: [
      'The northern line is cut. The Free Gauge holds the pumps at Thrumhollow, and Archwright Venn’s survey is passing from hand to hand across Ardenmoor. In the Gear Citadel the Sovereign has not been seen for forty days, and the undercity has bought the city watch.',
      'Marshal Ilse Corrow turns her strider legions for home. She will retake Thrumhollow’s pumps, hold the Rimeglass Flats, and walk into Vaskor before the Great Crystal falls into anyone else’s keeping.',
      'She has not read the survey. She keeps a ledger of every town she has burned, and lately she has started to wonder what the last page will say.',
    ],
    acts: [
      'Retake the pumps. Every day Thrumhollow stands idle, a Dominion city goes without bread.',
      'On the Flats the sky-guilds sell the Marshal’s marching orders to whoever pays. The legions march anyway.',
      'The Citadel’s gates are shut against its own Marshal, and green lanterns hang all along the ring road.',
    ],
    ending: 'Corrow stands before the Great Crystal with Venn’s survey open in her hands. She orders the draw cut by a third and writes the order in her ledger, on the last clean page. It will be a hungry decade. It will not be the last one.',
  },
  storm: {
    lead: 'Wren Ashby',
    who: [
      'A rebel network of rail and mine towns, run by unions and runaway engineers. They fight with stolen engines and patched canvas, and they know every siding on the northern line.',
      'Their towns sit above the roots the Great Crystal is drinking first.',
    ],
    title: 'THE STOLEN SURVEY',
    prologue: [
      'Wren Ashby went into the northern line for a strider’s crystal core. She came out with the core, and with a sealed survey from Archwright Venn that says the Underroot dies in eleven years.',
      'In Thrumhollow the union wants to sell the survey back to the Dominion for a truce. Wren thinks a truce bought with eleven years is no truce at all.',
      'She means to carry it to Vaskor and read it aloud from the steps of the Gear Citadel, where the whole ring city can hear.',
    ],
    acts: [
      'Get out of Thrumhollow before the union locks the yards. The Sedgekin have come up the seam to stop the pumps, and they are not asking.',
      'Every broker on the Flats has heard what Wren is carrying. An airship has been following the line for three days.',
      'The strider legions ring the Great Crystal. The Citadel steps are a mile past them.',
    ],
    ending: 'Wren reads the survey from the Citadel steps, and the ring city goes quiet enough to hear the pumps. By morning the yards have stopped. Nobody knows yet who runs Ardenmoor, but everyone knows how long it has left, and that is a start.',
  },
  coil: {
    lead: 'Speaker Ulla of the Ninth Root',
    who: [
      'Tall, bark-skinned people who lived along the surfacing roots long before the Dominion came. They sing to the Underroot, and sometimes it answers: marsh ground, grasping vines, beasts that grow out of the peat.',
      'They have listened to the roots dying for a generation.',
    ],
    title: 'THE NINTH ROOT',
    prologue: [
      'Speaker Ulla can hear a root dying a hundred miles away. This year she heard the Ninth Root, the one under Sedgemere, begin to go quiet.',
      'The root runs north under Thrumhollow’s pumps, across the Rimeglass Flats, and ends in the Great Crystal at Vaskor. Everything along it is drinking.',
      'The clans have waited a generation for the Dominion to stop. Ulla will not wait any longer. She leads them up the root to sing the Great Crystal to sleep.',
    ],
    acts: [
      'Thrumhollow’s pumps drink from the Ninth Root. The union calls it a living. The clans call it theft.',
      'The Flats were a living root once. Ulla walks over the shattered crystal and hears nothing at all.',
      'Under Vaskor the Ninth Root still sings, very faintly. The strider legions stand on top of it.',
    ],
    ending: 'Ulla sings at the foot of the Great Crystal until its light goes dim and slow, like a fire banked for the night. Vaskor’s furnaces go cold. Under Sedgemere, for the first time in years, the Ninth Root answers her.',
  },
  tide: {
    lead: 'Captain Dasha Quill',
    who: [
      'Merchant sky-guilds on kite-borne airships, moored at the floating harbour of Kitebarrow. They sell maps, guns and news to every side.',
      'Their harbour stays up on crystal lift. If the roots die, Kitebarrow falls.',
    ],
    title: 'THE PRICE OF ELEVEN YEARS',
    prologue: [
      'Captain Dasha Quill sells maps to both armies and keeps the best one. She knows what Venn’s survey is worth: whoever holds it names the price of every crystal shard in Ardenmoor for eleven years.',
      'She also knows what it means for Kitebarrow. The harbour floats on crystal lift. When the roots go, it comes down.',
      'So the Halcyon Debt sets course for Vaskor. Quill means to buy the survey, sell the Dominion the time it needs, and make sure Kitebarrow is still in the sky to collect.',
    ],
    acts: [
      'Thrumhollow has the survey, or knows who does. The union is open to offers. Its foreman is not.',
      'The Ashen Choir is crossing the Flats, burning the crystal fields as it goes. Burned crystal sells for nothing.',
      'The Great Crystal is the largest asset in Ardenmoor. Marshal Corrow has not agreed to sell.',
    ],
    ending: 'Quill brokers the bargain of the age: the Dominion halves its draw, the guilds carry its grain, and every nation pays Kitebarrow a fee for the privilege. Eleven years become thirty. The Halcyon Debt is, at last, out of debt.',
  },
  ember: {
    lead: 'Cantor Ebbe',
    who: [
      'Ascetics who believe crystal is a debt the world owes, and that it must be burned away. They cast fire, walk into it singing, and leave the ground behind them black.',
      'They call the Greying the debt being collected.',
    ],
    title: 'THE LAST HYMN',
    prologue: [
      'Cantor Ebbe has read Venn’s survey, or a copy of a copy. Eleven years. To the Choir it is not a warning. It is a date.',
      'If the debt must be paid, the Choir would rather pay it now, in one fire, than watch the Greying take a town at a time. Ebbe leads them out of the Hush toward the largest debt in the world: the Great Crystal of Vaskor.',
      'They mean to shatter it. They sing as they go, softly, so as not to frighten the children.',
    ],
    acts: [
      'Thrumhollow’s seam is the richest in Ardenmoor. The Choir lights its first pyres at the pithead.',
      'On the Flats the Choir walks through fields of broken crystal. The sky-guilds’ kites hang overhead, waiting to see who wins.',
      'The Great Crystal fills the caldera with green light. Ebbe has never seen anything so beautiful, or so heavy.',
    ],
    ending: 'The Great Crystal breaks with a sound like a bell, and Vaskor goes dark. The Choir kneels in the ash and sings. The roots will grow back in a hundred years, the Cantor says, if nobody takes from them. Whether anyone listens is for the next generation to see.',
  },
  under: {
    lead: 'Mother Agna Vell',
    who: [
      'Crystal smugglers, fences and debt-collectors from Vaskor’s undercity. They buy whatever the war spends and lend against whatever is left.',
      'A green lantern hung at a door means the house owes them. Nobody takes it down.',
    ],
    title: 'EVERY HOUSE OWES',
    prologue: [
      'Mother Agna Vell holds the undercity’s debts, and for twenty years the Dominion has borrowed from the undercity to pay for its war. The collateral, stamped in brass, is a share of the Great Crystal’s light.',
      'Venn’s survey says that light goes out in eleven years. A debt secured on nothing is worth nothing.',
      'So Mother Vell is calling in what she is owed, house by house, from the pumps of Thrumhollow to the Gear Citadel itself, before there is nothing left to collect.',
    ],
    acts: [
      'The Thrumhollow union borrowed for every pump it runs. The foreman says he will pay with what he has: rifles.',
      'The sky-guilds owe Vell a winter’s worth of crystal. They would rather fight than pay, which will cost them more.',
      'Vaskor, home. The green lanterns light Vell’s way up the ring road. The Marshal’s legions hold the last step.',
    ],
    ending: 'The Sovereign signs the Great Crystal over to the undercity in brass, and Mother Vell hangs a green lantern on the Gear Citadel. Then she does what nobody expected: she rations the light. Collateral is worth more if it lasts.',
  },
};

/** The attract mode's last page: the choice the war comes down to. */
export const CLOSING_PAGE: StoryPage = {
  field: 'vaskor', heading: 'THE CRYSTAL WAR', sub: 'Six nations, one Great Crystal, eleven years',
  paragraphs: [
    'Starve the Great Crystal, shatter it, or bargain for time. Every nation has its answer, and its reasons.',
    'Choose one, and march on Vaskor.',
  ],
};

/** Every page of the attract mode, in order: the world, then the nations in the title menu's order, then the close. */
export function attractPages(): StoryPage[] {
  return [
    ...WORLD_PAGES,
    ...FACTIONS.map((f): StoryPage => ({
      field: f.field as Field, heading: f.name, sub: NATIONS[f.engine].lead, paragraphs: NATIONS[f.engine].who, nation: f.engine,
    })),
    CLOSING_PAGE,
  ];
}
