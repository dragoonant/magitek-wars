// Deck builder model: pure functions, no DOM. The screen in src/client renders from these.
import type { CardDef, DeckList, FactionId } from '../engine/types';
import { LIMITS } from '../engine/types';
import { def, hasCard } from '../engine/query';
import { checkDeck, type DeckCheck } from '../engine/validate';

export const DECKS_KEY = 'magitek-wars.decks';

export function countOf(cards: string[], id: string): number {
  let n = 0;
  for (const c of cards) if (c === id) n += 1;
  return n;
}

/** Why this card cannot be added to the deck right now, or null. Player-facing (R-G1). */
export function whyNotAdd(cards: string[], id: string): string | null {
  if (!hasCard(id)) return 'Unknown card';
  const d = def(id);
  if (d.token) return 'Tokens are made by other cards and cannot be put in a deck';
  if (d.unimplemented) return 'This card is disabled';
  if (cards.length >= LIMITS.deck) return `The deck is full (${LIMITS.deck} cards)`;
  if (countOf(cards, id) >= LIMITS.copies) return `At most ${LIMITS.copies} copies of a card`;
  const factions = new Set(cards.map((c) => def(c).faction));
  if (!factions.has(d.faction) && factions.size >= LIMITS.factions) {
    return `A deck uses at most ${LIMITS.factions} factions; remove one faction's cards first`;
  }
  if (d.type === 'hero' && cards.filter((c) => def(c).type === 'hero').length >= LIMITS.heroCards) {
    return `At most ${LIMITS.heroCards} hero cards in a deck`;
  }
  return null;
}

export function addCard(cards: string[], id: string): string[] {
  return whyNotAdd(cards, id) ? cards : sortDeck([...cards, id]);
}
export function removeCard(cards: string[], id: string): string[] {
  const i = cards.lastIndexOf(id);
  return i < 0 ? cards : [...cards.slice(0, i), ...cards.slice(i + 1)];
}

export function sortDeck(cards: string[]): string[] {
  return [...cards].sort((a, b) => {
    const x = def(a), y = def(b);
    return Number(y.type === 'hero') - Number(x.type === 'hero') || x.cost - y.cost || x.name.localeCompare(y.name);
  });
}

export interface DeckStats {
  check: DeckCheck;
  /** Cards at cost 0,1,...,6 and 7+ (index 7). */
  curve: number[];
  units: number;
  glyphs: number;
  heroes: number;
  factions: FactionId[];
  /** Distinct cards with their counts, in deck order. */
  rows: { card: CardDef; n: number }[];
}

export function deckStats(cards: string[]): DeckStats {
  const curve = Array<number>(8).fill(0);
  let units = 0, glyphs = 0, heroes = 0;
  const rows: { card: CardDef; n: number }[] = [];
  for (const id of sortDeck(cards.filter(hasCard))) {
    const d = def(id);
    curve[Math.min(7, d.cost)] += 1;
    if (d.type === 'glyph') glyphs += 1; else if (d.type === 'hero') heroes += 1; else units += 1;
    const row = rows.find((r) => r.card.id === id);
    if (row) row.n += 1; else rows.push({ card: d, n: 1 });
  }
  const check = checkDeck(cards);
  return { check, curve, units, glyphs, heroes, factions: check.factions, rows };
}

export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Saved custom decks. Unreadable data is reported, never silently dropped. */
export function loadDecks(store: Storage): { decks: DeckList[]; problem: string | null } {
  let text: string | null;
  try { text = store.getItem(DECKS_KEY); } catch { return { decks: [], problem: 'This browser is not storing decks.' }; }
  if (text === null) return { decks: [], problem: null };
  try {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) throw new Error('not a list');
    const decks = raw.filter((d): d is DeckList => !!d && typeof d.name === 'string' && Array.isArray(d.cards) && d.cards.every((c: unknown) => typeof c === 'string'));
    const dropped = raw.length - decks.length;
    return { decks, problem: dropped ? `${dropped} saved deck(s) could not be read.` : null };
  } catch {
    return { decks: [], problem: 'Your saved decks are unreadable (damaged data).' };
  }
}

export function saveDecks(store: Storage, decks: DeckList[]): string | null {
  try { store.setItem(DECKS_KEY, JSON.stringify(decks)); return null; } catch { return 'This browser is not storing decks.'; }
}

/** A deck as a short text code for sharing: "name|id*n,id*n". */
export function exportDeck(d: DeckList): string {
  const st = deckStats(d.cards);
  return `${d.name.replace(/[|]/g, ' ')}|${st.rows.map((r) => `${r.card.id}*${r.n}`).join(',')}`;
}
export function importDeck(code: string): { deck: DeckList | null; problem: string | null } {
  const [name, body] = code.trim().split('|');
  if (!name || !body) return { deck: null, problem: 'That is not a deck code.' };
  const cards: string[] = [];
  for (const part of body.split(',')) {
    const [id, n] = part.split('*');
    const k = Number(n);
    if (!hasCard(id) || !Number.isInteger(k) || k < 1 || k > LIMITS.copies) return { deck: null, problem: `Unknown or invalid entry "${part}".` };
    for (let i = 0; i < k; i++) cards.push(id);
  }
  return { deck: { name: name.slice(0, 40), cards: sortDeck(cards) }, problem: null };
}
