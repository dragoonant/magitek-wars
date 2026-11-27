// Mutation hook for tools/mutate.ts: with MUTATE=<card id>, that card is neutered after load (no keywords,
// abilities, auras or ops, on both faces). Its behaviour test must then FAIL, which proves the test bites.
import '../src/data/cards/index';
import { def, hasCard } from '../src/engine/query';

const id = process.env.MUTATE;
if (id) {
  if (!hasCard(id)) throw new Error(`MUTATE: unknown card ${id}`);
  const d = def(id);
  for (const f of [d, d.ascended]) {
    if (!f) continue;
    f.keywords = [];
    f.abilities = [];
    f.auras = [];
    f.costAuras = [];
  }
  if (d.ops) d.ops = [];
}
