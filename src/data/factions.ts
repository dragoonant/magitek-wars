// The six Magitek Wars factions over the engine's six (PLAN D12, pending Q5), with their emblem and home field.
import type { FactionId } from '../engine/types';

export interface Faction {
  engine: FactionId;
  key: string;
  name: string;
  field: string;
}

export const FACTIONS: readonly Faction[] = [
  { engine: 'prism', key: 'dominion', name: 'CINDRAL DOMINION', field: 'vaskor' },
  { engine: 'storm', key: 'gauge', name: 'THE FREE GAUGE', field: 'thrumhollow' },
  { engine: 'coil', key: 'sedgekin', name: 'THE SEDGEKIN', field: 'sedgemere' },
  { engine: 'tide', key: 'gale', name: 'THE GALE EXCHANGE', field: 'kitebarrow' },
  { engine: 'ember', key: 'choir', name: 'THE ASHEN CHOIR', field: 'hush' },
  { engine: 'under', key: 'blackwick', name: 'THE BLACKWICK', field: 'greying' },
];
