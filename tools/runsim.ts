// Campaign bench (spec 20): play many runs with the AI standing in for the player, report how far they get.
//   npx tsx tools/runsim.ts [runs per faction=6] [player AI level=normal]
import '../src/data/cards/index';
import { createGame, applyAction } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { chooseAction, type Difficulty } from '../src/ai/ai';
import type { FactionId } from '../src/engine/types';
import { choices, chooseEvent, enter, finishBattle, leaveSupply, newRun, removeForEvent, rest, takeReward, type RunState } from '../src/run/run';

const per = Number(process.argv[2] ?? 6);
const me = (process.argv[3] ?? 'normal') as Difficulty;
const FACTIONS: FactionId[] = ['prism', 'ember', 'tide', 'coil', 'storm', 'under'];
const firstFights: number[] = [];
const reach: Record<string, number> = {};
let wins = 0;
for (const f of FACTIONS) {
  for (let i = 0; i < per; i++) {
    const r: RunState = newRun(f, 1000 + i * 97 + f.length);
    let battles = 0;
    let guard = 0;
    while (r.phase !== 'lost' && r.phase !== 'won' && guard++ < 80) {
      const opts = choices(r);
      // stand-in policy: prefer rest when hurt, else the first battle node
      const pick = (r.boiler < 10 && opts.find((n) => n.kind === 'rest')) || opts.find((n) => n.kind !== 'supply') || opts[0];
      enter(r, pick.id);
      if (r.phase === 'battle') {
        const s = createGame(r.battle!.setup);
        let x = 1 + i;
        const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
        let n = 0;
        while (s.phase !== 'over' && n++ < 5000) {
          const seat = s.priority;
          applyAction(s, chooseAction(view(s, seat), seat, seat === 0 ? me : r.battle!.level, rnd));
        }
        if (battles === 0) firstFights.push(s.winner === 0 ? 1 : 0);
        battles++;
        finishBattle(r, s.winner, s.players[0].spire);
        if ((r.phase as string) === 'reward') takeReward(r, r.offer!.cards[0]);
      } else if (r.phase === 'rest') rest(r, { kind: 'repair' });
      else if (r.phase === 'supply') leaveSupply(r);
      else if (r.phase === 'event') { chooseEvent(r, 0); if ((r.phase as string) === 'eventRemove') removeForEvent(r, r.deck[r.deck.length - 1]); }
    }
    const key = r.phase === 'won' ? 'won' : `act ${r.act}`;
    reach[key] = (reach[key] ?? 0) + 1;
    if (r.phase === 'won') wins++;
    const where = r.at ? r.map.floors.flat().find((n) => n.id === r.at) : null;
    console.log(f, i, r.phase, 'act', r.act, 'wins', r.wins, 'boiler', r.boiler, 'deck', r.deck.length, 'at', where ? `floor ${where.floor} ${where.kind}` : '-');
  }
}
const fw = firstFights.reduce((a, b) => a + b, 0);
console.log(`first battle won ${fw}/${firstFights.length}; runs reaching: ${JSON.stringify(reach)}; runs won ${wins}`);
