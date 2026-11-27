// Deck builder editing logic (R-G1): pure functions behind src/deckbuilder/screen.ts. No DOM except browserStore.
// Every add goes through the model's whyNotAdd, so the screen can never build past a limit, and every refusal comes
// back with its reason (never a silent no-op). A saved card id the data no longer has is kept and reported.
import type { CardDef, CardType, DeckList, FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, hasCard } from '../engine/query';
import { checkDeck } from '../engine/validate';
import { autoDeck, collectible } from '../data/decks';
import { FACTIONS } from '../data/factions';
import { countOf, loadDecks, sortDeck, whyNotAdd, type Storage as DeckStore } from './model';

/** Cost buckets 0..6 and 7+ (index 7), the same as deckStats' curve. */
export const COST_BUCKETS = 8;
export const NAME_MAX = 24;

export const costLabel = (bucket: number): string => (bucket >= COST_BUCKETS - 1 ? `${COST_BUCKETS - 1}+` : String(bucket));
export const bucketOf = (cost: number): number => Math.min(COST_BUCKETS - 1, cost);

/** The engine's card types in screen words (docs/RESKIN.md: a glyph is a tactic). */
export const TYPE_LABEL: Record<CardType, string> = { unit: 'UNIT', hero: 'HERO', glyph: 'TACTIC' };

/** Known cards in deck order, then any unknown ids in the order they were saved (kept, never dropped). */
export function orderDeck(cards: string[]): string[] {
  return [...sortDeck(cards.filter(hasCard)), ...cards.filter((c) => !hasCard(c))];
}

/** Why this card cannot be added now, or null. The model's rules, safe for decks holding unknown ids (R-G1). */
export function canAdd(cards: string[], id: string): string | null {
  if (cards.length >= LIMITS.deck) return `The deck is full (${LIMITS.deck} cards)`;
  return whyNotAdd(cards.filter(hasCard), id);
}

export interface Edit { cards: string[]; problem: string | null }

export function addOne(cards: string[], id: string): Edit {
  const why = canAdd(cards, id);
  return why ? { cards, problem: why } : { cards: orderDeck([...cards, id]), problem: null };
}

export function removeOne(cards: string[], id: string): Edit {
  const i = cards.lastIndexOf(id);
  if (i < 0) return { cards, problem: `${hasCard(id) ? def(id).name : id} is not in the deck` };
  return { cards: [...cards.slice(0, i), ...cards.slice(i + 1)], problem: null };
}

// ---------- the card pool ----------

export interface PoolFilter {
  faction: FactionId | null;
  /** Cost bucket 0..7 (7 = 7+), or null for any cost. */
  cost: number | null;
  type: CardType | null;
}

const FACTION_ORDER = FACTIONS.map((f) => f.engine as FactionId);

/** Collectible cards matching the filter, by faction (screen order), then heroes first, cost and name. */
export function poolCards(f: PoolFilter): CardDef[] {
  return collectible()
    .filter((c) => (f.faction === null || c.faction === f.faction) && (f.cost === null || bucketOf(c.cost) === f.cost) && (f.type === null || c.type === f.type))
    .sort((a, b) => FACTION_ORDER.indexOf(a.faction) - FACTION_ORDER.indexOf(b.faction)
      || Number(b.type === 'hero') - Number(a.type === 'hero') || a.cost - b.cost || a.name.localeCompare(b.name));
}

// ---------- the deck list ----------

export interface DeckRow { id: string; name: string; n: number; type: CardType | null; known: boolean }
export interface DeckGroup { label: string; total: number; rows: DeckRow[] }

/** The deck grouped by cost (0..6, 7+), counts per card; unknown ids in a last group labelled UNKNOWN. */
export function groupDeck(cards: string[]): DeckGroup[] {
  const groups: DeckGroup[] = [];
  const byBucket = new Map<number, DeckGroup>();
  for (const id of orderDeck(cards)) {
    const known = hasCard(id);
    const b = known ? bucketOf(def(id).cost) : COST_BUCKETS;
    let g = byBucket.get(b);
    if (!g) {
      g = { label: known ? `COST ${costLabel(b)}` : 'UNKNOWN CARDS', total: 0, rows: [] };
      byBucket.set(b, g);
    }
    g.total += 1;
    const row = g.rows.find((r) => r.id === id);
    if (row) row.n += 1;
    else g.rows.push({ id, name: known ? def(id).name : id, n: 1, type: known ? def(id).type : null, known });
  }
  for (const b of [...byBucket.keys()].sort((x, y) => x - y)) groups.push(byBucket.get(b)!);
  return groups;
}

/** Legal or not, with the first reason, for the LOAD list and the save message. */
export function deckStatus(cards: string[]): { legal: boolean; label: 'LEGAL' | 'ILLEGAL'; reason: string; errors: string[] } {
  const c = checkDeck(cards);
  return { legal: c.ok, label: c.ok ? 'LEGAL' : 'ILLEGAL', reason: c.errors[0] ?? '', errors: c.errors };
}

// ---------- fill ----------

/**
 * The factions FILL builds from: the deck's own, plus the faction tab the player picked while the deck has room for
 * another faction. A problem (and no factions) when there is nothing to go on.
 */
export function fillFactions(cards: string[], tab: FactionId | null): { factions: FactionId[]; problem: string | null } {
  const own = checkDeck(cards).factions;
  if (own.length > LIMITS.factions) return { factions: [], problem: `This deck already has ${own.length} factions (at most ${LIMITS.factions})` };
  const out = [...own];
  if (tab && !out.includes(tab) && out.length < LIMITS.factions) out.push(tab);
  if (!out.length) return { factions: [], problem: 'Add a card or pick a faction tab first, so FILL knows which factions to use' };
  return { factions: out, problem: null };
}

export interface Fill { cards: string[]; added: string[]; problem: string | null }

/**
 * Fill the deck to 40 with autoDeck-style curve picks from these factions (R-G1). Every card already in the deck stays.
 * Pass 1 follows autoDeck's own list for the factions (heroes, then cheapest first, alternating factions); pass 2 adds
 * cards by cost up to autoDeck's copy curve (3 cheap, 2 at cost 4-5, 1 at 6+); pass 3 any card up to the copy limit.
 * Every add is checked by canAdd, so the result never breaks a limit the deck did not already break.
 */
export function fillDeck(cards: string[], factions: FactionId[]): Fill {
  if (!factions.length || factions.length > LIMITS.factions) return { cards, added: [], problem: `FILL needs 1 or ${LIMITS.factions} factions` };
  let cur = [...cards];
  const added: string[] = [];
  const tryAdd = (id: string): void => {
    if (cur.length >= LIMITS.deck || canAdd(cur, id)) return;
    cur.push(id);
    added.push(id);
  };
  const seen = new Map<string, number>();
  for (const id of autoDeck(factions[0], factions[1] ?? factions[0])) {
    const k = (seen.get(id) ?? 0) + 1;
    seen.set(id, k);
    if (countOf(cur, id) < k) tryAdd(id);
  }
  const pool = collectible().filter((c) => factions.includes(c.faction)).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  const want = (c: CardDef): number => Math.min(LIMITS.copies, c.cost >= 6 ? 1 : c.cost >= 4 ? 2 : 3);
  for (const c of pool) if (c.type !== 'hero') while (countOf(cur, c.id) < want(c) && cur.length < LIMITS.deck && !canAdd(cur, c.id)) tryAdd(c.id);
  for (const c of pool) while (countOf(cur, c.id) < LIMITS.copies && cur.length < LIMITS.deck && !canAdd(cur, c.id)) tryAdd(c.id);
  cur = orderDeck(cur);
  if (cur.length < LIMITS.deck) {
    const why = added.length ? `FILL added ${added.length} but the deck still has ${cur.length}/${LIMITS.deck}` : 'FILL could not add a card';
    const block = pool.map((c) => canAdd(cur, c.id)).find((r) => r) ?? 'no card of these factions can be added';
    return { cards: cur, added, problem: `${why}: ${block}` };
  }
  return { cards: cur, added, problem: null };
}

// ---------- names ----------

const NOUNS = ['VANGUARD', 'LEDGER', 'RAMPART', 'EXPRESS', 'FORGE', 'BULWARK', 'GAMBIT', 'ENGINE', 'CHORUS', 'LANTERN'];
const factionWord = (f: FactionId): string => FACTIONS.find((x) => x.engine === f)!.key.toUpperCase();

/** Generated deck names for the SAVE prompt, from the deck's factions, none already taken. Never empty. */
export function nameIdeas(cards: string[], taken: string[]): string[] {
  const facs = checkDeck(cards).factions.filter((f) => FACTION_ORDER.includes(f)).slice(0, LIMITS.factions);
  const words = facs.map(factionWord);
  const ideas: string[] = [];
  if (words.length === 2) ideas.push(`${words[0]} AND ${words[1]}`);
  for (const n of NOUNS) {
    if (!words.length) ideas.push(`IRON ${n}`);
    for (const w of words) ideas.push(`${w} ${n}`);
  }
  const used = new Set(taken.map((t) => t.toUpperCase()));
  const free = ideas.filter((n) => n.length <= NAME_MAX && !used.has(n));
  if (free.length) return free;
  for (let k = 2; ; k++) {
    const n = `${ideas[0].slice(0, NAME_MAX - 4)} ${k}`;
    if (!used.has(n)) return [n];
  }
}

/** A key press applied to a deck name being typed: A-Z, digits and space, Backspace erases. Null for other keys. */
export function editName(name: string, code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (code === 'Backspace') return name.slice(0, -1);
  const ch = letter?.[1] ?? digit?.[1] ?? (code === 'Space' ? ' ' : null);
  if (ch === null) return null;
  if (ch === ' ' && (!name || name.endsWith(' '))) return name;
  return name.length >= NAME_MAX ? name : name + ch;
}

/** The name as it is saved: trimmed, single spaces. */
export const finalName = (name: string): string => name.trim().replace(/\s+/g, ' ');

// ---------- saved decks ----------

/** Save or replace by exact name. `replaced` says whether a deck of that name was there. */
export function upsertDeck(decks: DeckList[], deck: DeckList): { decks: DeckList[]; replaced: boolean } {
  const i = decks.findIndex((d) => d.name === deck.name);
  const copy = { name: deck.name, cards: [...deck.cards] };
  if (i < 0) return { decks: [...decks, copy], replaced: false };
  return { decks: decks.map((d, j) => (j === i ? copy : d)), replaced: true };
}

export function removeDeck(decks: DeckList[], name: string): DeckList[] {
  return decks.filter((d) => d.name !== name);
}

/** localStorage behind the model's Storage shape; a browser that refuses storage throws, and the model reports it. */
export function browserStore(): DeckStore {
  return {
    getItem: (k) => globalThis.localStorage.getItem(k),
    setItem: (k, v) => { globalThis.localStorage.setItem(k, v); },
  };
}

/** Saved decks that pass checkDeck (R-G1), for QUICK BATTLE. Unreadable storage gives an empty list. */
export function savedLegalDecks(store: DeckStore = browserStore()): { name: string; cards: string[] }[] {
  return loadDecks(store).decks.filter((d) => checkDeck(d.cards).ok).map((d) => ({ name: d.name, cards: [...d.cards] }));
}
