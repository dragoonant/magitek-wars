// Validation that refuses to run: content is checked at load, and a card the data cannot express
// (unimplemented) can never reach a deck.
import type { Ability, CardDef, Cond, FactionId, Keyword, Op, Sel, TargetSpec } from './types';
import { LIMITS } from './types';
import { def, hasCard } from './query';

export const FACTIONS: FactionId[] = ['prism', 'ember', 'tide', 'coil', 'under', 'storm'];
export const KEYWORDS: Keyword[] = [
  'vanguard', 'pierce', 'aerial', 'spotter', 'plated', 'siphon', 'ward', 'dueler', 'dread', 'unstable', 'mend', 'corrosive',
];
const TRIGGER_UNIT = new Set(['allySummoned', 'allyDied', 'enemyDied']);

export function validateCards(defs: CardDef[]): string[] {
  const errs: string[] = [];
  const ids = new Set(defs.map((d) => d.id));
  for (const d of defs) {
    const e = (m: string): void => { errs.push(`${d.id}: ${m}`); };
    if (!FACTIONS.includes(d.faction)) e(`unknown faction ${String(d.faction)}`);
    if (!d.id.startsWith(`${d.faction}-`)) e('id must start with its faction');
    if (!/^[a-z]+-[a-z0-9-]+$/.test(d.id)) e('id must be lowercase letters, digits and dashes');
    if (!d.name) e('name is required');
    if (!d.text && (d.type === 'glyph' || d.keywords?.length || d.abilities?.length || d.auras?.length)) e('text is required');
    if (!Number.isInteger(d.cost) || d.cost < 0 || d.cost > 12) e('cost must be an integer 0-12');
    for (const k of d.keywords ?? []) if (!KEYWORDS.includes(k)) e(`unknown keyword ${k}`);
    const sels = (ops: Op[] | undefined, ctx: { targets: TargetSpec[]; unit: boolean; trig?: string }): void => {
      for (const op of ops ?? []) checkOp(op, ctx);
    };
    const checkSel = (sel: Sel, ctx: { targets: TargetSpec[]; unit: boolean; trig?: string }): void => {
      if (typeof sel === 'object') { checkSel(sel.from, ctx); return; }
      if (sel === 'target0' && ctx.targets.length < 1) e('uses target0 but declares no target');
      if (sel === 'target1' && ctx.targets.length < 2) e('uses target1 but declares fewer than two targets');
      if (sel === 'trigger' && !TRIGGER_UNIT.has(ctx.trig ?? '')) e("'trigger' is only set for allySummoned, allyDied and enemyDied");
      if (!ctx.unit && ['self', 'otherAllies', 'others', 'opposing'].includes(sel)) e(`a glyph cannot use '${sel}'`);
    };
    const checkCond = (c: Cond | undefined, ctx: { targets: TargetSpec[]; unit: boolean; trig?: string }): void => {
      if (!c) return;
      if (c.c === 'not') checkCond(c.x, ctx);
      if (c.c === 'count') {
        const base = typeof c.of === 'object' ? c.of.from : c.of;
        if (!['allies', 'otherAllies', 'enemies', 'all', 'others', 'self'].includes(base as string)) e('count conditions take a group selector');
      }
    };
    const checkOp = (op: Op, ctx: { targets: TargetSpec[]; unit: boolean; trig?: string }): void => {
      switch (op.op) {
        case 'summon':
        case 'create':
          if (!ids.has(op.card)) e(`${op.op} names unknown card ${op.card}`);
          else if (op.op === 'summon' && defs.find((x) => x.id === op.card)!.type === 'glyph') e('cannot summon a glyph');
          break;
        case 'strike': checkSel(op.from, ctx); checkSel(op.to, ctx); break;
        case 'duel': checkSel(op.a, ctx); checkSel(op.b, ctx); break;
        case 'negate': {
          const i = op.to === 'target0' ? 0 : 1;
          if (ctx.targets[i]?.what !== 'glyph') e('negate needs a glyph target');
          break;
        }
        case 'if': checkCond(op.cond, ctx); sels(op.then, ctx); sels(op.else, ctx); break;
        case 'draw': case 'charge': case 'maxCharge': case 'reserve': case 'rally': break;
        default: checkSel(op.to, ctx);
      }
      if ('to' in op && op.op !== 'negate') {
        const base = typeof op.to === 'object' ? op.to.from : op.to;
        const spire = base === 'mySpire' || base === 'enemySpire';
        if (spire && !['damage', 'drain', 'heal'].includes(op.op)) e(`${op.op} cannot apply to a Spire`);
      }
    };
    const checkAbilities = (abs: Ability[] | undefined): void => {
      for (const a of abs ?? []) {
        if (a.targets && a.on !== 'deploy') e('only deploy abilities may have chosen targets');
        if ((a.targets?.length ?? 0) > 2) e('at most two targets');
        for (const t of a.targets ?? []) if (t.what === 'glyph') e('a deploy cannot target a glyph');
        checkCond(a.cond, { targets: a.targets ?? [], unit: true, trig: a.on });
        sels(a.ops, { targets: a.targets ?? [], unit: true, trig: a.on });
      }
    };
    if (d.type === 'glyph') {
      if (!d.speed) e('glyph needs a speed');
      if (!d.ops?.length && !d.unimplemented) e('glyph needs ops');
      if ((d.targets?.length ?? 0) > 2) e('at most two targets');
      if (d.power !== undefined || d.health !== undefined || d.abilities) e('glyph cannot have unit fields');
      if (d.speed === 'flash' && d.ops?.some((o) => o.op === 'negate')) e('negate must be Swift so the caster can answer');
      sels(d.ops, { targets: d.targets ?? [], unit: false });
    } else {
      if (!Number.isInteger(d.power) || d.power! < 0) e('unit needs power >= 0');
      if (!Number.isInteger(d.health) || d.health! < 1) e('unit needs health >= 1');
      if (d.speed || d.ops || d.targets) e('unit cannot have glyph fields');
      checkAbilities(d.abilities);
      if ((d.abilities ?? []).filter((a) => a.on === 'deploy' && a.targets?.length).length > 1) e('one targeted deploy ability at most');
      if (d.auras?.some((a) => a.kw?.includes('ward'))) e('auras cannot grant Ward');
    }
    if (d.type === 'hero') {
      if (!d.level || !d.ascended) e('hero needs level and ascended');
      if (d.token) e('a hero cannot be a token');
      if (d.ascended) {
        checkAbilities(d.ascended.abilities);
        if (!d.ascended.text) e('ascended face needs text');
        if (d.ascended.abilities?.some((a) => a.on === 'deploy' && a.targets?.length) !== d.abilities?.some((a) => a.on === 'deploy' && a.targets?.length)) {
          // allowed, but both faces must then agree on having a targeted deploy or the prompt changes shape
        }
      }
    } else if (d.level || d.ascended) e('only heroes level up');
    if (d.abilities?.some((a) => a.on === 'ascend')) e("'ascend' abilities belong on the ascended face");
  }
  return errs;
}

export interface DeckCheck {
  ok: boolean;
  errors: string[];
  factions: FactionId[];
  heroCards: number;
  size: number;
}

/** R-G1 deck rules. Used by the deck builder, the premade decks and the save loader. */
export function checkDeck(cards: string[]): DeckCheck {
  const errors: string[] = [];
  const counts = new Map<string, number>();
  const factions = new Set<FactionId>();
  let heroCards = 0;
  for (const id of cards) {
    if (!hasCard(id)) { errors.push(`Unknown card ${id}`); continue; }
    const d = def(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    factions.add(d.faction);
    if (d.type === 'hero') heroCards += 1;
    if (d.token) errors.push(`${d.name} is a token and cannot be put in a deck`);
    if (d.unimplemented) errors.push(`${d.name} is disabled`);
  }
  if (cards.length !== LIMITS.deck) errors.push(`A deck has exactly ${LIMITS.deck} cards (this one has ${cards.length})`);
  for (const [id, n] of counts) if (n > LIMITS.copies && hasCard(id)) errors.push(`At most ${LIMITS.copies} copies of ${def(id).name} (${n})`);
  if (factions.size > LIMITS.factions) errors.push(`At most ${LIMITS.factions} factions (this one has ${factions.size})`);
  if (heroCards > LIMITS.heroCards) errors.push(`At most ${LIMITS.heroCards} hero cards (this one has ${heroCards})`);
  return { ok: errors.length === 0, errors: [...new Set(errors)], factions: [...factions], heroCards, size: cards.length };
}
