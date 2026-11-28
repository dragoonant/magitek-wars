// Magitek Wars: engine contract (copied from Annals of Scrivenearth at 8b4ebac, PLAN D4).
// Everything here is plain JSON (rule 22: the save is a snapshot of GameState).
// Rule ids (R-...) refer to docs/spec/10-rules.md.

export type Seat = 0 | 1;
export type FactionId = 'prism' | 'ember' | 'tide' | 'coil' | 'under' | 'storm';
export type CardType = 'unit' | 'hero' | 'glyph';
export type Speed = 'flash' | 'swift' | 'ritual';
export type CardSet = 'base' | 'x1' | 'x2';

export type Keyword =
  | 'vanguard' // R-K1 strikes first when attacking
  | 'pierce' // R-K2 excess strike damage on a blocker hits the Spire
  | 'aerial' // R-K3 only Aerial or Spotter units can block it
  | 'spotter' // R-K4 can block Aerial units
  | 'plated' // R-K5 takes 1 less damage from every source
  | 'siphon' // R-K6 damage its strikes deal repairs its owner's Spire
  | 'ward' // R-K7 negates the next damage it would take
  | 'dueler' // R-K8 when it attacks, may force one enemy unit to block it
  | 'dread' // R-K9 cannot be blocked by units with 2 or less power
  | 'unstable' // R-K10 destroyed at the end of the round
  | 'mend' // R-K11 heals fully at the start of each round
  | 'corrosive'; // R-K12 any damage it deals to a unit destroys that unit

/** When a unit ability fires. */
export type Trigger =
  | 'deploy' // played from hand (not when summoned by an effect); may use chosen targets
  | 'shatter' // this unit was destroyed
  | 'strike' // this unit struck (attacking, blocking or by a strike/duel op)
  | 'assault' // this unit was declared as an attacker
  | 'dawn' // start of round
  | 'dusk' // end of round
  | 'allySummoned' // another allied unit entered your Line ('trigger' = that unit)
  | 'allyDied' // another allied unit was destroyed ('trigger' = that unit, last known)
  | 'enemyDied' // an enemy unit was destroyed ('trigger' = that unit, last known)
  | 'glyphCast' // you cast a glyph
  | 'survive' // this unit took damage and survived
  | 'spireHit' // this unit dealt damage to the enemy Spire
  | 'ascend'; // this hero just Ascended while on the Line

/** Who or what an op applies to. Unit selectors only ever return units on a Line. */
export type Sel =
  | 'self' // the unit that owns the ability
  | 'target0' // first chosen target (deploy abilities and glyphs only)
  | 'target1' // second chosen target
  | 'trigger' // the unit that caused an allySummoned / allyDied / enemyDied trigger
  | 'allies'
  | 'otherAllies'
  | 'enemies'
  | 'all'
  | 'others' // every unit but self
  | 'randomEnemy'
  | 'randomAlly' // a random ally other than self
  | 'strongestEnemy' // highest power, leftmost on ties
  | 'weakestEnemy' // lowest power, leftmost on ties
  | 'strongestAlly'
  | 'weakestAlly'
  | 'attackers' // allied units in the current attack
  | 'opposing' // the unit facing self in the current combat
  | 'mySpire'
  | 'enemySpire'
  | { from: Sel; filter: Filter };

export interface Filter {
  maxPower?: number;
  minPower?: number;
  maxCost?: number;
  minCost?: number;
  kw?: Keyword;
  notKw?: Keyword;
  damaged?: boolean;
  hero?: boolean;
  stasis?: boolean;
  tribe?: string;
  faction?: FactionId;
  card?: string;
}

/** A number, or a count read from the game when the op resolves. */
export type Amount =
  | number
  | {
      count:
        | 'allies' // units on your Line
        | 'otherAllies'
        | 'enemies'
        | 'reserve' // your Reserve
        | 'selfPower'
        | 'target0Power'
        | 'glyphsThisRound' // glyphs you cast this round
        | 'alliesDiedThisRound'
        | 'ascendedHeroes' // your heroes that have Ascended
        | 'hand'; // cards in your hand
      mul?: number;
      plus?: number;
      max?: number;
    };

export type Cond =
  | { c: 'resonant' } // you control an Ascended hero on your Line (R-H6)
  | { c: 'count'; of: Sel; gte?: number; lte?: number }
  | { c: 'seen'; stat: SeenStat; gte: number } // your game-long counter
  | { c: 'seenRound'; stat: SeenStat; gte: number } // your counter for this round
  | { c: 'reserve'; gte: number }
  | { c: 'spire'; who: 'you' | 'foe'; lte?: number; gte?: number }
  | { c: 'hasInitiative' }
  | { c: 'not'; x: Cond };

export type Dur = 'round' | 'perm';

export type Op =
  | { op: 'damage'; to: Sel; n: Amount }
  | { op: 'drain'; to: Sel; n: Amount } // damage, then heal your Spire by the damage dealt
  | { op: 'heal'; to: Sel; n: Amount }
  | { op: 'buff'; to: Sel; power?: Amount; health?: Amount; dur?: Dur } // dur defaults to 'perm'
  | { op: 'grant'; to: Sel; kw: Keyword[]; dur?: Dur }
  | { op: 'stasis'; to: Sel } // cannot attack or block for the rest of this round
  | { op: 'destroy'; to: Sel }
  | { op: 'recall'; to: Sel } // return to its owner's hand
  | { op: 'silence'; to: Sel } // loses abilities, keywords and buffs
  | { op: 'draw'; n: Amount; who?: 'you' | 'foe' }
  | { op: 'summon'; card: string; n?: Amount; who?: 'you' | 'foe' }
  | { op: 'create'; card: string; n?: number; who?: 'you' | 'foe' } // add to hand
  | { op: 'charge'; n: Amount } // gain Charge this round (may exceed your maximum)
  | { op: 'maxCharge'; n: number } // permanently raise maximum Charge (cap 10)
  | { op: 'reserve'; n: Amount } // gain Reserve (cap 3)
  | { op: 'rally' } // you may attack again this round
  | { op: 'strike'; from: Sel; to: Sel } // each 'from' unit strikes 'to' (one way)
  | { op: 'duel'; a: Sel; b: Sel } // a and b strike each other at the same time
  | { op: 'negate'; to: 'target0' | 'target1' } // remove a glyph from the stack
  | { op: 'if'; cond: Cond; then: Op[]; else?: Op[] };

export interface Ability {
  on: Trigger;
  ops: Op[];
  cond?: Cond;
  /** Deploy only: targets chosen when the unit is played. */
  targets?: TargetSpec[];
}

export interface Aura {
  /** Units that receive the bonus. 'self' is allowed (e.g. a Resonant bonus). */
  to: 'self' | 'allies' | 'otherAllies' | 'enemies';
  filter?: Filter;
  power?: number;
  health?: number;
  kw?: Keyword[];
  cond?: Cond;
}

export interface CostAura {
  /** Changes what YOUR cards cost while this unit is on your Line. */
  type: 'glyph' | 'unit' | 'any';
  n: number; // negative = cheaper
  cond?: Cond;
}

export interface TargetSpec {
  what: 'unit' | 'unitOrSpire' | 'glyph';
  side: 'ally' | 'enemy' | 'any';
  filter?: Filter;
  /** Only a unit that is attacking or blocking right now. */
  inCombat?: boolean;
  /** For deploy abilities: not the unit being played (always true for deploy). */
}

/** Counters the engine keeps for hero conditions and card text (R-H3). */
export type SeenStat =
  | 'alliesDied'
  | 'enemiesDied'
  | 'glyphsCast'
  | 'glyphDamage' // damage your glyphs and abilities dealt (not strikes)
  | 'spireDamage' // damage you dealt to the enemy Spire
  | 'spireHealed' // Integrity you restored to your own Spire
  | 'unitsSummoned'
  | 'bigSummoned' // allied units with 5+ power that entered your Line
  | 'stasisApplied'
  | 'attackersDeclared'
  | 'allySurvivals' // times an allied unit took damage and survived
  | 'cardsDrawn'
  | 'chargeSpent'
  | 'buffsGiven' // times you gave an allied unit a stat buff (one per unit buffed)
  | 'recalled' // units you returned to a hand, yours or the enemy's
  | 'tokensSummoned' // allied tokens that entered your Line
  // unit-level only:
  | 'strikes'
  | 'damageDealt'
  | 'survivals'
  | 'kills';

export interface HeroLevel {
  /** 'you' reads your game-long counter; 'self' reads this hero's own counter while on the Line. */
  who: 'you' | 'self';
  stat: SeenStat;
  n: number;
  /** Player-facing wording of the condition, e.g. "You've cast 6+ glyphs". */
  text: string;
}

export interface CardFace {
  name?: string;
  power: number;
  health: number;
  keywords?: Keyword[];
  abilities?: Ability[];
  auras?: Aura[];
  costAuras?: CostAura[];
  text: string;
}

export interface CardDef {
  id: string; // '<faction>-<slug>', e.g. 'tide-maren'
  name: string;
  faction: FactionId;
  type: CardType;
  cost: number;
  /** Rules text in our own words, written to match the data exactly. */
  text: string;
  flavor?: string;
  tribe?: string;
  /** The set the card belongs to (docs/SETS.md). Omitted = the base set, First Light. */
  set?: CardSet;
  /** Not collectible: only made by other cards (summon/create). */
  token?: boolean;
  // units and heroes
  power?: number;
  health?: number;
  keywords?: Keyword[];
  abilities?: Ability[];
  auras?: Aura[];
  costAuras?: CostAura[];
  // heroes
  level?: HeroLevel;
  ascended?: CardFace;
  // glyphs
  speed?: Speed;
  targets?: TargetSpec[];
  ops?: Op[];
  /** Glyph needs a legal target for EVERY slot (a fight needs both fighters); default is R-G10 partial targets. */
  needsAllTargets?: boolean;
  /** Glyph may only be cast if this holds. */
  castIf?: Cond;
  /** A clause the data cannot express yet. A card with this set is refused by every deck (never playable). */
  unimplemented?: string;
}

// ---------- state ----------

export interface Mod {
  power: number;
  health: number;
  kw?: Keyword[];
  dur: Dur;
}

export interface Unit {
  iid: string;
  card: string;
  owner: Seat;
  dmg: number;
  mods: Mod[];
  stasis: boolean;
  /** Ward is live (R-K7). */
  ward: boolean;
  silenced: boolean;
  /** Marked for destruction; removed at the next state check. */
  doomed: boolean;
  seen: Partial<Record<SeenStat, number>>;
  summonRound: number;
}

export interface HandCard {
  iid: string;
  /** Card id, or '?' in a view where it is hidden. */
  card: string;
}

export interface PlayerState {
  spire: number;
  charge: number;
  maxCharge: number;
  reserve: number;
  /** Top of the deck is the END of the array. '?' entries in a view. */
  deck: string[];
  hand: HandCard[];
  line: Unit[];
  /** The Scrap: every card of yours that was played, destroyed or burned, oldest first. Public. */
  scrap: string[];
  seen: Partial<Record<SeenStat, number>>;
  seenRound: Partial<Record<SeenStat, number>>;
  /** Hero card ids that have Ascended for this player (every copy, in every zone). */
  ascended: string[];
  /** Hero card ids in this player's deck list (public once the game starts). */
  heroes: string[];
  /** May declare an attack this round. */
  canAttack: boolean;
  /** Further attacks banked by rally effects while an attack was still available (R-B1). */
  extraAttacks: number;
  mulliganed: boolean;
  /** Full deck list, sorted, for the deck viewer (your own only in a view). */
  deckList: string[];
  /** R-X5: campaign Fittings by card id (public). Absent outside campaign runs. */
  fittings?: Record<string, Fitting>;
  /** R-X6: campaign Orders (public). Absent outside campaign runs. */
  orders?: Order[];
}

export interface StackItem {
  sid: string;
  card: string;
  owner: Seat;
  targets: string[];
}

export interface CombatPair {
  att: string; // attacker iid
  blk: string | null; // blocker iid
  /** The blocker was forced by Dueler and cannot be changed. */
  forced: boolean;
}

export interface Combat {
  attacker: Seat;
  pairs: CombatPair[];
}

export type Phase =
  | 'mulligan'
  | 'main' // a player has priority; stack may be non-empty
  | 'declare' // the attacker is choosing attackers
  | 'block' // the defender is choosing blockers
  | 'combat' // blocks are locked; swift/flash window before strikes
  | 'over';

export interface LogEntry {
  /** Event kind; every kind has a player-facing line in src/client/text.ts (gated). */
  k: string;
  /** Round number. */
  r: number;
  seat?: Seat;
  card?: string;
  unit?: string;
  /** Target of the event: a unit iid and its card id, or a spire id in `tunit`. */
  tunit?: string;
  tcard?: string;
  n?: number;
  m?: number;
  /** Free detail: keyword list, end reason. */
  s?: string;
  /** Card id of the ability/glyph that caused this, when it is a consequence. */
  via?: string;
}

export interface GameState {
  v: 1;
  rng: number;
  round: number;
  /** Who holds the Initiative this round. */
  initiative: Seat;
  /** Who must act now. */
  priority: Seat;
  phase: Phase;
  /** Consecutive passes with nothing in between (R-P5). */
  passes: number;
  stack: StackItem[];
  /** Who put the first glyph on the current stack. */
  stackStarter: Seat | null;
  combat: Combat | null;
  players: [PlayerState, PlayerState];
  nextId: number;
  winner: Seat | 'draw' | null;
  /** Why the game ended, for the end screen. */
  endReason: string | null;
  log: LogEntry[];
  /** Per round, per seat: how many non-pass actions were taken (AI behaviour counters, R-X2). */
  acted: [number, number];
}

export interface DeckList {
  name: string;
  cards: string[]; // 40 card ids
}

export interface Setup {
  seed: number;
  decks: [string[], string[]];
  /** Who holds the Initiative in round 1. Omit to decide by seed. */
  first?: Seat;
  /** Test hook: do not shuffle decks (top of deck = end of the list as given). */
  noShuffle?: boolean;
  /** Test hook: skip the mulligan phase. */
  skipMulligan?: boolean;
  /** R-X3 (spec 20): each side's starting Integrity, 1-20. Omitted = 20. Campaign runs only. */
  startSpire?: [number, number];
  /** R-X4 to R-X6 (spec 20): each side's campaign gear. Omitted = none. Campaign runs only. */
  gear?: [Gear, Gear];
}

/** R-X5: an upgrade on every copy of one card for one side (campaign Fittings). */
export interface Fitting {
  name: string;
  /** Player-facing words, added to the card text, e.g. "+0|+2". */
  text: string;
  power?: number;
  health?: number;
  kw?: Keyword[];
  /** Change to the card's cost (negative = cheaper). */
  cost?: number;
}

/** R-X6: an Order ability. Runs with no source unit and no chosen targets. */
export interface OrderAbility {
  on: 'start' | 'dawn' | 'dusk';
  ops: Op[];
  cond?: Cond;
}

/** R-X6: a power for one side for the whole battle (campaign Orders). */
export interface Order {
  id: string;
  name: string;
  /** Player-facing words of everything it does. */
  text: string;
  /** 'allies' = this side's units, 'enemies' = the other side's. */
  auras?: Aura[];
  costAuras?: CostAura[];
  abilities?: OrderAbility[];
}

export interface Gear {
  /** R-X4: one copy of each is placed among the top cards after the shuffle. */
  early?: string[];
  /** R-X5: card id -> its Fitting. */
  fittings?: Record<string, Fitting>;
  /** R-X6 */
  orders?: Order[];
}

export type Action =
  | { type: 'mulligan'; replace: string[] } // hand iids to swap
  | { type: 'play'; iid: string; targets?: string[]; replace?: string } // replace: your unit to scrap when your Line is full (R-U1)
  | { type: 'channel'; iid: string } // R-H7: spend a spare hero copy on the one in play
  | { type: 'declare'; unit: string; duel?: string } // add an attacker (and a Dueler's forced blocker)
  | { type: 'undeclare'; unit: string }
  | { type: 'attack' } // lock in the declared attackers
  | { type: 'block'; unit: string; att: string }
  | { type: 'unblock'; unit: string }
  | { type: 'blocks' } // lock in the blocks
  | { type: 'pass' }
  | { type: 'concede' };

export interface Result {
  ok: boolean;
  /** Why the action was refused (player-facing). Never thrown. */
  error?: string;
  /** Log entries this action produced, in order. */
  events: LogEntry[];
}

/** Target ids: a unit iid ('u12'), a stack item sid ('s3'), or 'spire0' / 'spire1'. */
export const spireId = (seat: Seat): string => `spire${seat}`;

export const LIMITS = {
  spire: 20,
  maxCharge: 10,
  reserve: 3,
  line: 6,
  hand: 10,
  deck: 40,
  copies: 3,
  factions: 2,
  heroCards: 6,
  openingHand: 4,
  channelCost: 1,
  roundCap: 45,
  /** R-X4: early cards land among this many top cards. */
  early: 6,
} as const;
