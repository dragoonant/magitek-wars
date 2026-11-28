// The Fitting catalog (spec 21 R-E8, engine R-X5): an upgrade on every copy of one card in the run deck.
import type { Fitting } from '../engine/types';
import { def } from '../engine/query';
import type { Rarity } from './orders';

export interface RunFitting extends Fitting {
  id: string;
  rarity: Exclude<Rarity, 'foe'>;
}

export const FITTINGS: RunFitting[] = [
  { id: 'brass-plating', name: 'Brass Plating', rarity: 'common', text: '+0|+2', health: 2 },
  { id: 'honed-edge', name: 'Honed Edge', rarity: 'common', text: '+1|+0', power: 1 },
  { id: 'charge-spurs', name: 'Charge Spurs', rarity: 'common', text: 'Vanguard', kw: ['vanguard'] },
  { id: 'spotting-lens', name: 'Spotting Lens', rarity: 'common', text: 'Spotter', kw: ['spotter'] },
  { id: 'ward-charm', name: 'Ward Charm', rarity: 'common', text: 'Ward', kw: ['ward'] },
  { id: 'piercing-rounds', name: 'Piercing Rounds', rarity: 'common', text: 'Pierce', kw: ['pierce'] },
  { id: 'crystal-core', name: 'Crystal Core', rarity: 'rare', text: '+1|+1', power: 1, health: 1 },
  { id: 'iron-shell', name: 'Iron Shell', rarity: 'rare', text: 'Plated', kw: ['plated'] },
  { id: 'leech-coil', name: 'Leech Coil', rarity: 'rare', text: 'Siphon', kw: ['siphon'] },
  { id: 'glider-wings', name: 'Glider Wings', rarity: 'rare', text: 'Aerial', kw: ['aerial'] },
  { id: 'light-frame', name: 'Light Frame', rarity: 'rare', text: 'costs 1 less', cost: -1 },
  // hero signature Fittings (R-E13 rank 5)
  { id: 'sig-bastion-plate', name: 'Bastion Plate', rarity: 'signature', text: '+0|+2', health: 2 },
  { id: 'sig-choir-bell', name: 'Choir Bell', rarity: 'signature', text: 'costs 1 less', cost: -1 },
  { id: 'sig-captains-ward', name: "Captain's Ward", rarity: 'signature', text: 'Ward', kw: ['ward'] },
  { id: 'sig-heartwood', name: 'Heartwood', rarity: 'signature', text: '+1|+1', power: 1, health: 1 },
  { id: 'sig-racing-harness', name: 'Racing Harness', rarity: 'signature', text: '+1|+1', power: 1, health: 1 },
  { id: 'sig-ledger-seal', name: 'Ledger Seal', rarity: 'signature', text: 'Ward', kw: ['ward'] },
];

export function fitting(id: string): RunFitting {
  const f = FITTINGS.find((x) => x.id === id);
  if (!f) throw new Error(`run: no fitting ${id}`);
  return f;
}

/** Fittings the march can offer (R-E8): common and rare. */
export const OFFERABLE_FITTINGS = FITTINGS.filter((f) => f.rarity !== 'signature').map((f) => f.id);

/** R-E8: stat and keyword Fittings go on units and heroes; a cost Fitting on any card that costs 2 or more. */
export function canFit(fitId: string, card: string): boolean {
  const f = fitting(fitId);
  const d = def(card);
  if (f.cost !== undefined) return d.cost >= 2;
  if (d.type === 'glyph') return false;
  // a keyword the card already prints adds nothing
  if (f.kw && !f.power && !f.health && f.kw.every((k) => (d.keywords ?? []).includes(k))) return false;
  return true;
}

/** What the engine gets (R-X5): the Fitting without the run's own fields. */
export function engineFitting(id: string): Fitting {
  const { name, text, power, health, kw, cost } = fitting(id);
  return { name, text, ...(power ? { power } : {}), ...(health ? { health } : {}), ...(kw ? { kw: [...kw] } : {}), ...(cost ? { cost } : {}) };
}
