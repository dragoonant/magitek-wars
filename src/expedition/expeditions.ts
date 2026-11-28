// The handmade expeditions (spec 21 R-E3, R-E6, R-E14). Every stop, link and foe is fixed; only rewards, events and
// shops are rolled from the run's seed. Places follow docs/WORLD.md.
import type { FactionId } from '../engine/types';
import type { Difficulty } from '../ai/ai';
import type { Field } from '../ui';

export type StopKind = 'battle' | 'elite' | 'boss' | 'rest' | 'depot' | 'event' | 'order' | 'cache' | 'recruit';

export interface Foe {
  name: string;
  factions: [FactionId] | [FactionId, FactionId];
  size: number;
  crystal: number;
  level: Difficulty;
  orders?: string[];
  /** Boss only: the faction used when the first is the player hero's (R-E6). */
  alt?: FactionId;
}

export interface Stop {
  id: string;
  row: number;
  /** Across the map, 0 (left) to 1 (right). */
  x: number;
  kind: StopKind;
  to: string[];
  foe?: Foe;
}

export interface Expedition {
  id: string;
  name: string;
  stars: number;
  blurb: string;
  field: Field;
  stops: Stop[];
}

const S = (id: string, row: number, x: number, kind: StopKind, to: string[], foe?: Foe): Stop => ({ id, row, x, kind, to, ...(foe ? { foe } : {}) });

export const EXPEDITIONS: Expedition[] = [
  {
    id: 'thrumhollow', name: 'The Thrumhollow Road', stars: 1, field: 'thrumhollow',
    blurb: 'Down the rail line to the humming mines, where the union boss sets the toll.',
    stops: [
      S('a', 0, 0.5, 'battle', ['b', 'c'], { name: 'Free Gauge rail patrol', factions: ['storm'], size: 24, crystal: 8, level: 'easy' }),
      S('b', 1, 0.28, 'event', ['d', 'e']),
      S('c', 1, 0.72, 'battle', ['e', 'f'], { name: 'Sedgekin marsh scouts', factions: ['coil'], size: 24, crystal: 8, level: 'easy' }),
      S('d', 2, 0.15, 'order', ['g']),
      S('e', 2, 0.5, 'battle', ['g', 'h'], { name: 'Blackwick toll gang', factions: ['under'], size: 24, crystal: 10, level: 'easy' }),
      S('f', 2, 0.85, 'depot', ['h']),
      S('g', 3, 0.3, 'elite', ['i'], { name: 'Union strikebreakers', factions: ['storm', 'ember'], size: 26, crystal: 14, level: 'normal', orders: ['foe-bulwark'] }),
      S('h', 3, 0.7, 'recruit', ['i']),
      S('i', 4, 0.5, 'rest', ['j', 'k']),
      S('j', 5, 0.3, 'cache', ['z']),
      S('k', 5, 0.7, 'battle', ['z'], { name: 'Pump-house guards', factions: ['storm', 'tide'], size: 24, crystal: 10, level: 'easy' }),
      S('z', 6, 0.5, 'boss', [], { name: 'Foreman Otto Brandt', factions: ['storm'], alt: 'coil', size: 26, crystal: 14, level: 'normal', orders: ['foe-council'] }),
    ],
  },
  {
    id: 'rimeglass', name: 'Across the Rimeglass', stars: 2, field: 'rimeglass',
    blurb: 'Over the salt-white flats of shattered crystal, under the guns of the sky-guilds.',
    stops: [
      S('a', 0, 0.5, 'battle', ['b', 'c'], { name: 'Gale Exchange hired guns', factions: ['tide', 'storm'], size: 26, crystal: 14, level: 'normal' }),
      S('b', 1, 0.25, 'depot', ['d']),
      S('c', 1, 0.75, 'event', ['d', 'e']),
      S('d', 2, 0.4, 'battle', ['f', 'g'], { name: 'Ashen Choir pilgrims', factions: ['ember'], size: 28, crystal: 16, level: 'normal' }),
      S('e', 2, 0.82, 'order', ['g']),
      S('f', 3, 0.25, 'elite', ['h'], { name: 'Dominion strider crew', factions: ['prism', 'ember'], size: 30, crystal: 18, level: 'hard', orders: ['foe-bulwark'] }),
      S('g', 3, 0.7, 'battle', ['h', 'i'], { name: 'Salt-flat scavengers', factions: ['under', 'coil'], size: 28, crystal: 16, level: 'normal' }),
      S('h', 4, 0.3, 'cache', ['j']),
      S('i', 4, 0.75, 'recruit', ['j']),
      S('j', 5, 0.5, 'rest', ['k', 'l']),
      S('k', 6, 0.3, 'elite', ['z'], { name: 'Kitebarrow marines', factions: ['tide', 'storm'], size: 30, crystal: 18, level: 'hard', orders: ['foe-council'] }),
      S('l', 6, 0.7, 'event', ['z']),
      S('z', 7, 0.5, 'boss', [], { name: 'Captain Dasha Quill', factions: ['tide', 'storm'], alt: 'ember', size: 30, crystal: 20, level: 'hard', orders: ['foe-banner'] }),
    ],
  },
  {
    id: 'vaskor', name: 'The Gates of Vaskor', stars: 3, field: 'vaskor',
    blurb: 'Through the Greying to the ring city, where the Marshal guards the Great Crystal.',
    stops: [
      S('a', 0, 0.5, 'battle', ['b', 'c'], { name: 'Blackwick press gang', factions: ['under'], size: 26, crystal: 12, level: 'easy' }),
      S('b', 1, 0.3, 'battle', ['d', 'e'], { name: 'Choir of the Hush', factions: ['ember', 'under'], size: 30, crystal: 16, level: 'normal' }),
      S('c', 1, 0.75, 'event', ['e']),
      S('d', 2, 0.18, 'order', ['f']),
      S('e', 2, 0.6, 'depot', ['f', 'g']),
      S('f', 3, 0.3, 'elite', ['h'], { name: "Lieutenant Kale's casters", factions: ['prism', 'tide'], size: 32, crystal: 18, level: 'hard', orders: ['foe-mend'] }),
      S('g', 3, 0.75, 'battle', ['h', 'i'], { name: 'Strider column', factions: ['prism'], size: 30, crystal: 16, level: 'normal' }),
      S('h', 4, 0.3, 'rest', ['j']),
      S('i', 4, 0.75, 'cache', ['j']),
      S('j', 5, 0.5, 'battle', ['k', 'l'], { name: 'Gear Citadel guard', factions: ['prism', 'storm'], size: 32, crystal: 18, level: 'normal' }),
      S('k', 6, 0.3, 'rest', ['z']),
      S('l', 6, 0.7, 'elite', ['z'], { name: "The Archwright's strider", factions: ['prism', 'coil'], size: 34, crystal: 18, level: 'hard', orders: ['foe-champions'] }),
      S('z', 7, 0.5, 'boss', [], { name: 'Marshal Ilse Corrow', factions: ['prism'], alt: 'under', size: 36, crystal: 20, level: 'hard', orders: ['foe-banner', 'foe-mend'] }),
    ],
  },
];

export function expedition(id: string): Expedition {
  const e = EXPEDITIONS.find((x) => x.id === id);
  if (!e) throw new Error(`run: no expedition ${id}`);
  return e;
}

export function stopOf(e: Expedition, id: string): Stop {
  const s = e.stops.find((x) => x.id === id);
  if (!s) throw new Error(`run: expedition ${e.id} has no stop ${id}`);
  return s;
}

export const rows = (e: Expedition): number => Math.max(...e.stops.map((s) => s.row)) + 1;
