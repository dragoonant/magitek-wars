// The campaign profile (spec 20 R-R13, R-R14, R-R16): each hero's rank XP and the expeditions won, kept between runs.
// Pure functions here; the screen reads and writes the browser copy.
import { HEROES, MAX_RANK, RANK_XP, rankOf } from './heroes';
import { EXPEDITIONS } from './expeditions';

export const PROFILE_KEY = 'magitek-wars.profile';

export interface Profile {
  game: 'magitek-wars.profile';
  v: 1;
  /** Hero card id -> rank XP. */
  xp: Record<string, number>;
  /** Expedition ids won with any hero. */
  won: string[];
  /** Hero card id -> expedition ids that hero has won. */
  heroWon: Record<string, string[]>;
}

export function newProfile(): Profile {
  return { game: 'magitek-wars.profile', v: 1, xp: Object.fromEntries(HEROES.map((h) => [h.id, 0])), won: [], heroWon: {} };
}

/** Never silent: a profile that cannot be read says why, and a fresh one is used. */
export function parseProfile(text: string | null): { profile: Profile; problem: string | null } {
  if (text === null) return { profile: newProfile(), problem: null };
  try {
    const p = JSON.parse(text) as Partial<Profile>;
    if (p.game !== 'magitek-wars.profile' || p.v !== 1 || typeof p.xp !== 'object' || !Array.isArray(p.won)) {
      return { profile: newProfile(), problem: 'The saved hero ranks are from another version; ranks start again.' };
    }
    const fresh = newProfile();
    return { profile: { ...fresh, ...p, xp: { ...fresh.xp, ...p.xp }, heroWon: p.heroWon ?? {} } as Profile, problem: null };
  } catch {
    return { profile: newProfile(), problem: 'The saved hero ranks are damaged; ranks start again.' };
  }
}

export const heroXp = (p: Profile, hero: string): number => p.xp[hero] ?? 0;
export const heroRank = (p: Profile, hero: string): number => rankOf(heroXp(p, hero));

/** XP still needed for the next rank, or null at the top rank. */
export function toNextRank(p: Profile, hero: string): { have: number; need: number } | null {
  const r = heroRank(p, hero);
  if (r >= MAX_RANK) return null;
  return { have: heroXp(p, hero) - RANK_XP[r - 1], need: RANK_XP[r] - RANK_XP[r - 1] };
}

/** R-R14: the first expedition is open; each later one opens once any hero wins the one before. */
export function unlocked(p: Profile, expeditionId: string): boolean {
  const i = EXPEDITIONS.findIndex((e) => e.id === expeditionId);
  if (i < 0) throw new Error(`profile: no expedition ${expeditionId}`);
  return i === 0 || p.won.includes(EXPEDITIONS[i - 1].id);
}

/** Add XP to a hero; returns the ranks gained (for the level-up line). */
export function addXp(p: Profile, hero: string, n: number): number[] {
  const before = heroRank(p, hero);
  p.xp[hero] = heroXp(p, hero) + n;
  const after = heroRank(p, hero);
  const gained: number[] = [];
  for (let r = before + 1; r <= after; r++) gained.push(r);
  return gained;
}

export function markWon(p: Profile, hero: string, expeditionId: string): void {
  if (!p.won.includes(expeditionId)) p.won.push(expeditionId);
  const list = (p.heroWon[hero] ??= []);
  if (!list.includes(expeditionId)) list.push(expeditionId);
}
