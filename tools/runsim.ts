// Campaign bench (spec 20): play many expeditions with the AI standing in for the player, report how far they get.
//   npx tsx tools/runsim.ts [runs per hero=6] [player AI level=normal] [rank=1] [expedition=all]
import '../src/data/cards/index';
import { createGame, applyAction } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { chooseAction, type Difficulty } from '../src/ai/ai';
import {
  buy, choices, chooseEvent, choosePick, enter, finishBattle, fit, fitTargets, leaveDepot, newRun, removeForEvent, rest, takeReward,
  canRemove, restRepair, type RunState,
} from '../src/run/run';
import { HEROES } from '../src/run/heroes';
import { EXPEDITIONS } from '../src/run/expeditions';
import { def } from '../src/engine/query';

const per = Number(process.argv[2] ?? 6);
const me = (process.argv[3] ?? 'normal') as Difficulty;
const rank = Number(process.argv[4] ?? 1);
const only = process.argv[5];

/** Stand-in policy: rest when hurt, otherwise prefer battles; take the hero bundle, the first offer, fit the hero. */
function play(r: RunState, seed: number): { battles: number; stopsSeen: number } {
  let battles = 0, guard = 0;
  while (r.phase !== 'lost' && r.phase !== 'won' && guard++ < 60) {
    if (r.phase === 'map') {
      const opts = choices(r);
      const pick = (r.crystal < 12 && opts.find((s) => s.kind === 'rest')) || opts.find((s) => s.kind === 'battle')
        || opts.find((s) => s.kind !== 'elite') || opts[0];
      enter(r, pick.id);
    }
    if (r.phase === 'battle') {
      const s = createGame(r.battle!.setup);
      let x = seed + battles * 31;
      const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
      let n = 0;
      while (s.phase !== 'over' && n++ < 5000) {
        const seat = s.priority;
        applyAction(s, chooseAction(view(s, seat), seat, seat === 0 ? me : r.battle!.level, rnd));
      }
      battles++;
      finishBattle(r, s.winner, s.players[0].spire);
      if ((r.phase as string) === 'reward') takeReward(r, 0);
    } else if (r.phase === 'rest') {
      const weakest = [...new Set(r.deck)].filter((id) => canRemove(r, id)).sort((a, b) => def(a).cost - def(b).cost)[0];
      if (r.crystal + restRepair(r) <= 20 || !weakest) rest(r, { kind: 'repair' });
      else rest(r, { kind: 'remove', card: weakest });
    } else if (r.phase === 'depot') {
      buy(r, 'order');
      if ((r.phase as string) === 'depot') leaveDepot(r);
    } else if (r.phase === 'event') {
      chooseEvent(r, 0);
      if ((r.phase as string) === 'eventRemove') removeForEvent(r, r.deck[r.deck.length - 1]);
    }
    if ((r.phase as string) === 'pick') choosePick(r, r.pick!.options[0] ?? null);
    if ((r.phase as string) === 'fit') {
      const t = fitTargets(r, r.fitWith!.id);
      fit(r, t.includes(r.hero) ? r.hero : t[0] ?? null);
    }
  }
  return { battles, stopsSeen: r.visited.length };
}

const table: string[] = [];
for (const e of EXPEDITIONS.filter((x) => !only || x.id === only)) {
  let won = 0, total = 0;
  const deaths: Record<string, number> = {};
  const byHero: string[] = [];
  for (const h of HEROES) {
    let hw = 0;
    for (let i = 0; i < per; i++) {
      const seed = 1000 + i * 97 + h.id.length;
      const r = newRun(h.id, e.id, seed, rank);
      const res = play(r, seed);
      total++;
      if (r.phase === 'won') { won++; hw++; }
      const at = r.at ? r.visited.length : 0;
      if (r.phase === 'lost' && r.at) deaths[`${r.at}:${r.visited.length}`] = (deaths[`${r.at}:${r.visited.length}`] ?? 0) + 1;
      if (process.env.VERBOSE) console.log(e.id, h.id, i, r.phase, 'stops', at, 'battles', res.battles, 'crystal', r.crystal, 'deck', r.deck.length, 'xp', r.xp);
    }
    byHero.push(`${def(h.id).name} ${hw}/${per}`);
  }
  table.push(`${e.name} (rank ${rank}, player ${me}): won ${won}/${total}. ${byHero.join(', ')}. Lost at (stop:steps): ${JSON.stringify(deaths)}`);
}
console.log(table.join('\n'));
