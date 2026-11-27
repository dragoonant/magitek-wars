// Event stops (spec 20, R-R11): a short scene from the Gloam War and two or three choices. Every outcome is printed on
// its button before the player picks it (open information), and every one is applied by applyChoice below.
import type { FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def } from '../engine/query';
import { collectible } from '../data/decks';

export type Outcome =
  | { kind: 'scrip'; n: number }
  | { kind: 'boiler'; n: number } // negative = damage; never below 1 from an event (RULING)
  | { kind: 'card'; pool: 'mine' | 'any' | 'other'; minCost?: number } // a random card of that pool joins the deck
  | { kind: 'remove' } // the player picks a card to remove
  | { kind: 'nothing' };

export interface Choice { label: string; outcomes: Outcome[]; costScrip?: number }
export interface RunEvent { id: string; title: string; text: string[]; choices: Choice[] }

export const EVENTS: RunEvent[] = [
  {
    id: 'stalled-train', title: 'A STALLED SUPPLY TRAIN',
    text: ['A Dominion freight engine sits cold on a siding.', 'Its guards are gone. Its boiler is not.'],
    choices: [
      { label: 'STRIP IT FOR PARTS: +25 SCRIP, -3 BOILER', outcomes: [{ kind: 'scrip', n: 25 }, { kind: 'boiler', n: -3 }] },
      { label: 'BANK ITS FIRE INTO YOURS: +4 BOILER', outcomes: [{ kind: 'boiler', n: 4 }] },
      { label: 'LEAVE IT', outcomes: [{ kind: 'nothing' }] },
    ],
  },
  {
    id: 'deserter', title: 'A DESERTER IN THE REEDS',
    text: ['A young soldier in torn red lacquer begs for passage.', 'She knows the patrol routes.'],
    choices: [
      { label: 'TAKE HER IN: A RANDOM CARD FROM ANY FACTION', outcomes: [{ kind: 'card', pool: 'other' }] },
      { label: 'SELL HER ROUTE MAPS ON: +15 SCRIP', outcomes: [{ kind: 'scrip', n: 15 }] },
    ],
  },
  {
    id: 'grey-chapel', title: 'THE GREY CHAPEL',
    text: ['The Greying has reached this chapel. The bell still hangs.', 'Something in your column is not worth carrying.'],
    choices: [
      { label: 'LEAVE A CARD BEHIND: REMOVE ONE CARD', outcomes: [{ kind: 'remove' }] },
      { label: 'RING THE BELL: +2 BOILER', outcomes: [{ kind: 'boiler', n: 2 }] },
    ],
  },
  {
    id: 'gloam-seep', title: 'A GLOAM SEEP',
    text: ['Teal resin wells from a cracked root.', 'Boiled, it would drive anything. Breathed, it burns.'],
    choices: [
      { label: 'TAP IT: A RANDOM CARD OF YOURS COSTING 4+, -4 BOILER', outcomes: [{ kind: 'card', pool: 'mine', minCost: 4 }, { kind: 'boiler', n: -4 }] },
      { label: 'SEAL IT: NOTHING', outcomes: [{ kind: 'nothing' }] },
    ],
  },
  {
    id: 'broker-kite', title: 'A BROKER ON A KITE',
    text: ['A Gale Exchange broker drops a ladder from her kite.', '"Everything is for sale. Even loyalty."'],
    choices: [
      { label: 'PAY 20 SCRIP: A RANDOM CARD COSTING 3+', costScrip: 20, outcomes: [{ kind: 'card', pool: 'any', minCost: 3 }] },
      { label: 'PAY 15 SCRIP: +6 BOILER', costScrip: 15, outcomes: [{ kind: 'boiler', n: 6 }] },
      { label: 'WAVE HER OFF', outcomes: [{ kind: 'nothing' }] },
    ],
  },
  {
    id: 'union-hall', title: 'A UNION HALL',
    text: ['The miners of a pump town share their coal and their stew.', 'They ask only that you remember them.'],
    choices: [
      { label: 'REST HERE: +5 BOILER', outcomes: [{ kind: 'boiler', n: 5 }] },
      { label: 'RECRUIT: A RANDOM CARD OF YOURS', outcomes: [{ kind: 'card', pool: 'mine' }] },
    ],
  },
  {
    id: 'ash-procession', title: 'AN ASH PROCESSION',
    text: ['Veiled singers walk toward a burning field.', 'They offer to carry your burdens into the fire.'],
    choices: [
      { label: 'GIVE THEM A CARD: REMOVE ONE CARD, +10 SCRIP', outcomes: [{ kind: 'remove' }, { kind: 'scrip', n: 10 }] },
      { label: 'WALK WITH THEM: -2 BOILER, A RANDOM CARD FROM ANY FACTION', outcomes: [{ kind: 'boiler', n: -2 }, { kind: 'card', pool: 'any' }] },
      { label: 'PASS BY', outcomes: [{ kind: 'nothing' }] },
    ],
  },
  {
    id: 'debt-lantern', title: 'A GREEN LANTERN AT THE DOOR',
    text: ['The inn where you stopped owes the Blackwick.', 'A collector waits by the green lantern.'],
    choices: [
      { label: 'PAY THE INN\'S DEBT: -15 SCRIP, +5 BOILER', costScrip: 15, outcomes: [{ kind: 'boiler', n: 5 }] },
      { label: 'RUN THE COLLECTOR OFF: -3 BOILER, +20 SCRIP', outcomes: [{ kind: 'boiler', n: -3 }, { kind: 'scrip', n: 20 }] },
    ],
  },
];

/** The random card an outcome grants, chosen with the run's own generator (R-R1). Never a hero or token. */
export function cardFor(pool: 'mine' | 'any' | 'other', faction: FactionId, minCost: number, roll: number): string {
  const list = collectible().filter((c) => c.type !== 'hero' && c.cost >= minCost && (pool === 'any' || (pool === 'mine' ? c.faction === faction : c.faction !== faction)));
  if (list.length === 0) throw new Error(`events: no card in pool ${pool} at cost ${minCost}+`);
  return list[Math.floor(roll * list.length)].id;
}

/** Boiler after an event change: events never take the Boiler below 1 or above the cap. */
export function eventBoiler(boiler: number, n: number): number {
  return Math.max(1, Math.min(LIMITS.spire, boiler + n));
}

export function describeCard(id: string): string {
  return def(id).name;
}

/** Boss introductions (R-R12): the faction's leader in WORLD.md, by the boss deck's faction. */
export const BOSS_INTRO: Record<string, { who: string; lines: string[] }> = {
  storm: { who: 'FOREMAN OTTO BRANDT', lines: ['THE PUMPS OF THRUMHOLLOW ANSWER TO THE UNION.', '"YOU WALK OUR RAILS, YOU PAY OUR TOLL."'] },
  coil: { who: 'SPEAKER ULLA OF THE NINTH ROOT', lines: ['THE ROOTS BENEATH YOU ARE DYING.', '"I HAVE HEARD YOUR BOILER FROM A HUNDRED MILES."'] },
  under: { who: 'MOTHER AGNA VELL', lines: ['A GREEN LANTERN HANGS AT EVERY DOOR YOU PASSED.', '"EVERY HOUSE OWES. NOW, SO DO YOU."'] },
  tide: { who: 'CAPTAIN DASHA QUILL', lines: ['THE HALCYON DEBT DROPS ITS CABLES OVER THE FLATS.', '"I SOLD THEM YOUR MAP. I KEPT THE BETTER ONE."'] },
  ember: { who: 'CANTOR EBBE', lines: ['A CHOIR WALKS OUT OF THE FIRE, STILL SINGING.', '"ALL DEBTS ARE PAID IN ASH."'] },
  prism: { who: 'MARSHAL ILSE CORROW', lines: ['THE STRIDER LEGIONS RING THE GREAT BOILERS.', '"I KEEP A LEDGER OF EVERY TOWN I BURN. ADD YOURS."'] },
};
