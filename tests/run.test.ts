import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { createGame, applyAction } from '../src/engine/rules';
import { view } from '../src/engine/view';
import { def, face } from '../src/engine/query';
import { chooseAction } from '../src/ai/ai';
import { canDraw } from '../src/font';
import {
  DEPOT, FIELD_REPAIR, MIN_DECK, REST_REPAIR, buy, canRemove, choices, chooseEvent, choosePick, enter, finishBattle, fit, fitTargets,
  foeDeck, foeName, leaveDepot, newRun, removeForEvent, rest, stop, takeReward, type RunState,
} from '../src/run/run';
import { HEROES, MAX_RANK, RANK_XP, XP, hero, rankOf, rankUnlock, starterList } from '../src/run/heroes';
import { ORDERS, OFFERABLE, order } from '../src/run/orders';
import { FITTINGS, canFit, engineFitting, fitting } from '../src/run/fittings';
import { EXPEDITIONS, expedition, rows } from '../src/run/expeditions';
import { addXp, heroRank, markWon, newProfile, parseProfile, toNextRank, unlocked } from '../src/run/profile';

const firstBattle = (r: RunState): void => enter(r, choices(r).find((s) => s.kind === 'battle')!.id);

describe('spec 20: the hero campaign', () => {
  it('R-R1/R-R2 every hero starts with 24 cards of its faction, 3 copies of itself, no tokens', () => {
    expect(HEROES.length).toBe(6);
    for (const h of HEROES) {
      const d = starterList(h);
      expect(d.length, h.id).toBe(24);
      expect(d.filter((id) => id === h.id).length, h.id).toBe(3);
      expect(def(h.id).type).toBe('hero');
      for (const id of d) {
        expect(def(id).faction, id).toBe(h.faction);
        expect(def(id).token ?? false, id).toBe(false);
        expect(def(id).unimplemented, id).toBeUndefined();
      }
      for (const id of h.pool) {
        expect(def(id).faction, id).toBe(h.faction);
        expect(def(id).type, id).not.toBe('hero');
        expect(def(id).token ?? false, id).toBe(false);
      }
      expect(new Set(h.pool).size, h.id).toBe(h.pool.length);
    }
  });

  it('R-R1 a run replays from its seed', () => {
    const a = newRun('coil-aruvi', 'thrumhollow', 42);
    const b = newRun('coil-aruvi', 'thrumhollow', 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    firstBattle(a);
    firstBattle(b);
    expect(JSON.stringify(a.battle)).toBe(JSON.stringify(b.battle));
  });

  it('R-R3 every expedition is linked: every stop reachable, every path ends at its one boss', () => {
    for (const e of EXPEDITIONS) {
      const ids = new Set(e.stops.map((s) => s.id));
      expect(ids.size).toBe(e.stops.length);
      const bosses = e.stops.filter((s) => s.kind === 'boss');
      expect(bosses.length, e.id).toBe(1);
      expect(bosses[0].row, e.id).toBe(rows(e) - 1);
      expect(bosses[0].to).toEqual([]);
      for (const s of e.stops) {
        for (const t of s.to) {
          expect(ids.has(t), `${e.id}:${s.id}->${t}`).toBe(true);
          expect(e.stops.find((x) => x.id === t)!.row, `${e.id}:${s.id}->${t}`).toBe(s.row + 1);
        }
        if (s.kind !== 'boss') expect(s.to.length, `${e.id}:${s.id}`).toBeGreaterThan(0);
        if (s.row > 0) expect(e.stops.some((p) => p.to.includes(s.id)), `${e.id}:${s.id} has a way in`).toBe(true);
        const battle = s.kind === 'battle' || s.kind === 'elite' || s.kind === 'boss';
        expect(!!s.foe, `${e.id}:${s.id}`).toBe(battle);
      }
      expect(e.stops.filter((s) => s.row === 0).every((s) => s.kind === 'battle'), e.id).toBe(true);
      for (const l of [e.name.toUpperCase(), e.blurb.toUpperCase()]) expect(canDraw(l), l).toBe(true);
    }
  });

  it('R-R3 only linked stops can be entered', () => {
    const r = newRun('prism-tamsin', 'thrumhollow', 2);
    expect(() => enter(r, 'z')).toThrow();
    firstBattle(r);
    expect(() => enter(r, 'b')).toThrow(); // in battle: no moving
  });

  it('R-R5 a battle starts both Crystals from the run, with both sides\' gear (R-X3 to R-X6)', () => {
    const r = newRun('storm-jax', 'thrumhollow', 7);
    r.crystal = 13;
    r.orders.push('riveted-plates');
    r.orders.push('war-chest');
    r.fittings['storm-tickettaker'] = 'brass-plating';
    firstBattle(r);
    const s = createGame(r.battle!.setup);
    expect(s.players[0].spire).toBe(13);
    expect(s.players[1].spire).toBe(stop(r, r.at!).foe!.crystal);
    expect(s.players[0].orders!.map((o) => o.id)).toEqual(['riveted-plates']);
    expect(face(s, 0, 'storm-tickettaker').health).toBe(def('storm-tickettaker').health! + 2);
    expect(face(s, 1, 'storm-tickettaker').health).toBe(def('storm-tickettaker').health!);
    // the run-only War Chest never reaches the engine; it pays out after a win instead
    finishBattle(r, 0, 13);
    expect(r.scrip).toBe(10 + 8);
  });

  it('R-R5/R-R12/R-R13 a win pays scrip, XP and repairs, then offers three bundles; a draw ends the run', () => {
    const r = newRun('under-penn', 'thrumhollow', 3);
    firstBattle(r);
    finishBattle(r, 0, 15);
    expect(r.phase).toBe('reward');
    expect(r.scrip).toBe(10);
    expect(r.xp).toBe(XP.battle);
    expect(r.crystal).toBe(15 + FIELD_REPAIR);
    const o = r.offer!;
    expect(o.bundles.length).toBe(3);
    for (const b of o.bundles) {
      expect(b.length).toBe(2);
      for (const id of b) { expect(def(id).type).not.toBe('hero'); expect(def(id).token ?? false).toBe(false); }
    }
    for (const id of o.bundles[0]) expect(hero('under-penn').pool).toContain(id);
    for (const id of o.bundles[1]) expect(def(id).faction).toBe('under');
    expect(new Set(o.bundles.flat()).size).toBe(6);
    const took = o.bundles[1];
    takeReward(r, 1);
    for (const id of took) expect(r.deck).toContain(id);
    expect(r.deck.length).toBe(26);
    expect(r.phase).toBe('map');
    const l = newRun('under-penn', 'thrumhollow', 3);
    firstBattle(l);
    finishBattle(l, 'draw', 4);
    expect(l.phase).toBe('lost');
    const z = newRun('under-penn', 'thrumhollow', 3);
    firstBattle(z);
    finishBattle(z, 1, 0);
    expect(z.phase).toBe('lost');
    expect(z.xp).toBe(0);
  });

  it('R-R8 an elite win adds a Fitting pick; the Fitting goes on every copy of one card', () => {
    const r = newRun('coil-aruvi', 'thrumhollow', 4);
    r.at = 'e';
    r.visited = ['a', 'c', 'e'];
    enter(r, 'g');
    expect(r.battle!.kind).toBe('elite');
    finishBattle(r, 0, 12);
    expect(r.offer!.bundles.every((b) => b.length === 3)).toBe(true);
    for (const b of r.offer!.bundles) for (const id of b) expect(def(id).cost).toBeGreaterThanOrEqual(3);
    takeReward(r, null);
    expect(r.phase).toBe('pick');
    expect(r.pick!.kind).toBe('fitting');
    r.pick!.options = ['brass-plating'];
    choosePick(r, 'brass-plating');
    expect(r.phase).toBe('fit');
    expect(() => fit(r, 'coil-hothouse-bloom')).toThrow(); // a tactic cannot take a stat Fitting
    fit(r, 'coil-spearhorn');
    expect(r.fittings['coil-spearhorn']).toBe('brass-plating');
    expect(r.phase).toBe('map');
    // replaced by a newer Fitting
    r.phase = 'fit';
    r.fitWith = { id: 'honed-edge', back: 'map' };
    fit(r, 'coil-spearhorn');
    expect(r.fittings['coil-spearhorn']).toBe('honed-edge');
  });

  it('R-R8 which cards a Fitting can go on', () => {
    expect(canFit('brass-plating', 'prism-glasswarden')).toBe(true);
    expect(canFit('brass-plating', 'prism-lock-shields')).toBe(false);
    expect(canFit('light-frame', 'prism-lock-shields')).toBe(true); // cost 2 tactic
    expect(canFit('light-frame', 'prism-glasswarden')).toBe(false); // cost 1
    expect(canFit('iron-shell', 'prism-glasswarden')).toBe(false); // already Plated
    expect(canFit('iron-shell', 'prism-tamsin')).toBe(true);
    const r = newRun('prism-tamsin', 'thrumhollow', 1);
    for (const id of fitTargets(r, 'light-frame')) expect(def(id).cost).toBeGreaterThanOrEqual(2);
  });

  it('R-R7 Order and Cache stops offer three new choices; an Order joins every later battle', () => {
    const r = newRun('tide-maren', 'thrumhollow', 8);
    r.at = 'b';
    r.visited = ['a', 'b'];
    enter(r, 'd');
    expect(r.phase).toBe('pick');
    expect(r.pick!.kind).toBe('order');
    expect(r.pick!.options.length).toBe(3);
    for (const id of r.pick!.options) expect(OFFERABLE).toContain(id);
    const pick = r.pick!.options[0];
    choosePick(r, pick);
    expect(r.orders).toEqual([pick]);
    // never offered again
    for (let i = 0; i < 20; i++) {
      r.phase = 'map'; r.at = 'b';
      enter(r, 'd');
      expect(r.pick!.options).not.toContain(pick);
      choosePick(r, null);
    }
  });

  it('R-R9 a recruit adds two copies of another hero and two pairs of its cards', () => {
    const r = newRun('storm-jax', 'thrumhollow', 5);
    r.at = 'e';
    r.visited = ['a', 'c', 'e'];
    enter(r, 'h');
    expect(r.pick!.kind).toBe('recruit');
    expect(r.pick!.options.length).toBe(2);
    expect(r.pick!.options).not.toContain('storm-jax');
    const id = r.pick!.options[0];
    const before = r.deck.length;
    choosePick(r, id);
    expect(r.recruits).toEqual([id]);
    expect(r.deck.length).toBe(before + 6);
    expect(r.deck.filter((x) => x === id).length).toBe(2);
    // both heroes are drawn early (R-X4) and the recruit's faction joins the faction bundle
    r.at = 'i'; r.phase = 'map';
    enter(r, 'k');
    expect(r.battle!.setup.gear![0].early).toEqual(['storm-jax', id]);
    finishBattle(r, 0, 10);
    const facs = new Set(r.offer!.bundles[1].map((c) => def(c).faction));
    for (const f of facs) expect(['storm', hero(id).faction]).toContain(f);
  });

  it('R-R4 rest repairs up to 20 or removes a card; never the lead hero, never below the minimum', () => {
    const r = newRun('tide-maren', 'thrumhollow', 5);
    r.phase = 'rest';
    r.crystal = 10;
    rest(r, { kind: 'repair' });
    expect(r.crystal).toBe(10 + REST_REPAIR);
    r.phase = 'rest';
    expect(() => rest(r, { kind: 'remove', card: 'tide-maren' })).toThrow(/lead hero/);
    expect(canRemove(r, 'tide-maren')).toBe(false);
    r.phase = 'rest';
    rest(r, { kind: 'remove', card: 'tide-wardtender' });
    expect(r.deck.length).toBe(23);
    r.deck = r.deck.slice(0, MIN_DECK);
    r.phase = 'rest';
    expect(() => rest(r, { kind: 'remove', card: r.deck[5] })).toThrow();
  });

  it('R-R10 the depot sells cards, a Fitting, an Order and one repair, refusing what cannot be paid', () => {
    const r = newRun('ember-crucible', 'thrumhollow', 9);
    r.phase = 'depot';
    r.shop = {
      cards: [{ id: 'ember-kilnhand', price: DEPOT.card, sold: false }], fitting: { id: 'honed-edge', price: DEPOT.fitting, sold: false },
      order: { id: 'forward-drill', price: DEPOT.order, sold: false }, repairSold: false,
    };
    expect(buy(r, 'card:ember-kilnhand')).toMatch(/scrip/);
    expect(buy(r, 'order')).toMatch(/40 scrip/);
    r.scrip = 100;
    r.crystal = 10;
    expect(buy(r, 'card:ember-kilnhand')).toBeNull();
    expect(buy(r, 'card:ember-kilnhand')).toMatch(/not for sale/);
    expect(buy(r, 'order')).toBeNull();
    expect(r.orders).toContain('forward-drill');
    expect(buy(r, 'repair')).toBeNull();
    expect(r.crystal).toBe(15);
    expect(buy(r, 'repair')).toMatch(/already/);
    expect(buy(r, 'fitting')).toBeNull();
    expect(r.phase).toBe('fit');
    fit(r, 'ember-kilnhand');
    expect(r.phase).toBe('depot');
    expect(r.scrip).toBe(100 - 15 - 40 - 20 - 25);
    leaveDepot(r);
    expect(r.phase).toBe('map');
  });

  it('R-R6 foe decks are fixed by expedition and stop; a boss of the hero\'s own faction is swapped', () => {
    const a = newRun('prism-tamsin', 'thrumhollow', 1);
    const b = newRun('prism-tamsin', 'thrumhollow', 999);
    for (const s of expedition('thrumhollow').stops.filter((x) => x.foe)) {
      expect(foeDeck(a, s)).toEqual(foeDeck(b, s));
      expect(foeDeck(a, s).length).toBe(s.foe!.size);
    }
    const boss = expedition('thrumhollow').stops.find((s) => s.kind === 'boss')!;
    const own = newRun('storm-jax', 'thrumhollow', 1);
    expect(new Set(foeDeck(own, boss).map((id) => def(id).faction))).toEqual(new Set([boss.foe!.alt]));
    expect(foeName(own, boss)).not.toBe(boss.foe!.name);
    expect(foeName(a, boss)).toBe(boss.foe!.name);
    const heroes = foeDeck(a, boss).filter((id) => def(id).type === 'hero');
    expect(heroes.length).toBeGreaterThan(2);
  });

  it('R-R6 every foe Order and every catalog Order runs in a real battle', () => {
    let seed = 1;
    for (const o of ORDERS) {
      const r = newRun('coil-aruvi', 'thrumhollow', seed++);
      r.orders = o.rarity === 'foe' ? [] : [o.id];
      firstBattle(r);
      if (o.rarity === 'foe') r.battle!.setup.gear![1].orders = [{ id: o.id, name: o.name, text: o.text, auras: o.auras, costAuras: o.costAuras, abilities: o.abilities }];
      const s = createGame(r.battle!.setup);
      let x = seed;
      const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
      let n = 0;
      while (s.phase !== 'over' && n++ < 4000) {
        const seat = s.priority;
        expect(applyAction(s, chooseAction(view(s, seat), seat, 'easy', rnd)).ok, o.id).toBe(true);
      }
      expect(s.phase, o.id).toBe('over');
      if (o.abilities && !o.abilities.some((a) => a.cond)) expect(s.log.some((e) => e.k === 'order' && e.s === o.name), o.id).toBe(true);
      expect(canDraw(o.name.toUpperCase()) && canDraw(o.text.toUpperCase()), o.id).toBe(true);
    }
  });

  it('R-R13 ranks: thresholds, unlocks applied at the start of a run', () => {
    expect(RANK_XP.length).toBe(MAX_RANK);
    expect(rankOf(0)).toBe(1);
    expect(rankOf(29)).toBe(1);
    expect(rankOf(30)).toBe(2);
    expect(rankOf(10_000)).toBe(MAX_RANK);
    const h = hero('prism-tamsin');
    const r1 = newRun(h.id, 'thrumhollow', 3, 1);
    expect(r1.scrip).toBe(0);
    expect(r1.orders).toEqual([]);
    expect(r1.fittings).toEqual({});
    const r8 = newRun(h.id, 'thrumhollow', 3, 8);
    expect(r8.scrip).toBe(15);
    expect(r8.orders[0]).toBe(h.signatureOrder);
    expect(r8.orders).toContain(h.masteryOrder);
    expect(r8.orders.length).toBe(3);
    expect(order(r8.orders[1]).rarity).toBe('common');
    expect(r8.fittings[h.id]).toBe(h.signatureFitting);
    r8.phase = 'rest';
    r8.crystal = 5;
    rest(r8, { kind: 'repair' });
    expect(r8.crystal).toBe(5 + REST_REPAIR + 3);
    for (const hh of HEROES) for (let i = 1; i <= MAX_RANK; i++) {
      const line = rankUnlock(hh, i, { order: (id) => order(id).name, fitting: (id) => fitting(id).name });
      expect(canDraw(line.toUpperCase()), line).toBe(true);
    }
  });

  it('R-R13/R-R14 the profile: XP kept, ranks gained, expeditions unlocked in order', () => {
    const p = newProfile();
    expect(unlocked(p, 'thrumhollow')).toBe(true);
    expect(unlocked(p, 'rimeglass')).toBe(false);
    expect(addXp(p, 'storm-jax', 85)).toEqual([2, 3]);
    expect(heroRank(p, 'storm-jax')).toBe(3);
    expect(toNextRank(p, 'storm-jax')).toEqual({ have: 5, need: 70 });
    markWon(p, 'storm-jax', 'thrumhollow');
    expect(unlocked(p, 'rimeglass')).toBe(true);
    expect(unlocked(p, 'vaskor')).toBe(false);
    const back = parseProfile(JSON.stringify(p));
    expect(back.problem).toBeNull();
    expect(back.profile.xp['storm-jax']).toBe(85);
    expect(parseProfile('{oops').problem).toMatch(/damaged/);
    expect(parseProfile(null).problem).toBeNull();
  });

  it('R-R13 winning the expedition pays the boss XP and the star bonus', () => {
    const r = newRun('ember-crucible', 'rimeglass', 6);
    r.at = 'k';
    r.visited = ['a', 'c', 'e', 'g', 'i', 'j', 'k'];
    enter(r, 'z');
    finishBattle(r, 0, 3);
    expect(r.phase).toBe('won');
    expect(r.xp).toBe(XP.boss + XP.perStar * 2);
  });

  it('every Fitting is printable and the engine copy carries only engine fields', () => {
    for (const f of FITTINGS) {
      expect(canDraw(`${f.name}: ${f.text}`.toUpperCase()), f.id).toBe(true);
      expect(Object.keys(engineFitting(f.id))).not.toContain('rarity');
    }
  });

  it('a whole expedition plays out with the AI on both seats', () => {
    const r: RunState = newRun('coil-aruvi', 'thrumhollow', 11, 8);
    let guard = 0;
    while (r.phase !== 'lost' && r.phase !== 'won' && guard++ < 30) {
      if (r.phase === 'map') enter(r, choices(r)[0].id);
      if (r.phase === 'battle') {
        const s = createGame(r.battle!.setup);
        let n = 0;
        let x = 1;
        const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
        while (s.phase !== 'over' && n++ < 4000) {
          const seat = s.priority;
          expect(applyAction(s, chooseAction(view(s, seat), seat, seat === 0 ? 'hard' : r.battle!.level, rnd)).ok).toBe(true);
        }
        finishBattle(r, s.winner, s.players[0].spire);
        if ((r.phase as string) === 'reward') takeReward(r, 0);
      } else if (r.phase === 'rest') rest(r, { kind: 'repair' });
      else if (r.phase === 'depot') leaveDepot(r);
      else if (r.phase === 'event') { chooseEvent(r, 0); if ((r.phase as string) === 'eventRemove') removeForEvent(r, r.deck[r.deck.length - 1]); }
      if ((r.phase as string) === 'pick') choosePick(r, r.pick!.options[0] ?? null);
      if ((r.phase as string) === 'fit') fit(r, fitTargets(r, r.fitWith!.id)[0] ?? null);
    }
    expect(['lost', 'won']).toContain(r.phase);
  });
});
