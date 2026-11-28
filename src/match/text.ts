// Every player-facing sentence of the match that is not card text: log lines, keyword help, prompts, end reasons.
// Adapted from Annals of Scrivenearth's client text with this game's words (PLAN D16, D24: Crystal, tactic).
// An unknown log kind throws (no silent fallback); tests/match-text.test.ts checks every kind the engine emits.
import type { Keyword, LogEntry, Seat, TargetSpec } from '../engine/types';

const who = (s?: Seat): string => (s === 0 ? 'You' : 'Foe');
const whose = (s?: Seat): string => (s === 0 ? 'your' : "the foe's");
const plural = (n: number | undefined, one: string, many: string): string => (n === 1 ? one : many);

type Name = (id: string) => string;
type LineFn = (e: LogEntry, name: Name) => string;

function req(id: string | undefined): string {
  if (!id) throw new Error('log line needs a card id');
  return id;
}
const via = (e: LogEntry, name: Name): string => (e.via ? ` (${name(e.via)})` : '');
function kwNames(list: string | undefined): string {
  if (!list) return 'a keyword';
  return list.split(',').map((k) => KEYWORD_HELP[k as Keyword]?.name ?? k).join(', ');
}

export const LOG_LINES: Record<string, LineFn> = {
  absorb: (e, n) => `${n(req(e.tcard))} shrugged the hit off (Plated).`,
  ascend: (e, n) => (e.n && e.n > 0 ? `${n(req(e.card))} has Ascended on the Line.` : `${n(req(e.card))} has Ascended in ${whose(e.seat)} deck.`),
  attack: (e) => `${who(e.seat)} attacked with ${e.n ?? 0} ${plural(e.n, 'unit', 'units')}.`,
  blocks: (e) => `${who(e.seat)} locked blocks: ${e.n ?? 0} ${plural(e.n, 'attacker', 'attackers')} blocked.`,
  buff: (e, n) => `${n(req(e.tcard))} got ${(e.n ?? 0) >= 0 ? '+' : ''}${e.n ?? 0}|${(e.m ?? 0) >= 0 ? '+' : ''}${e.m ?? 0}${e.s === 'round' ? ' for the round' : ''}${via(e, n)}.`,
  burn: (e, n) => `${n(req(e.card))} was burned: ${whose(e.seat)} hand is full.`,
  cast: (e, n) => `${who(e.seat)} played ${n(req(e.card))} (${e.n ?? 0}).`,
  channel: (e, n) => `${who(e.seat)} Channelled ${n(req(e.card))}: repaired and +1|+1.`,
  charge: (e, n) => `${who(e.seat)} gained ${e.n ?? 0} Charge${via(e, n)}.`,
  combatEnd: () => 'The attack is over.',
  create: (e, n) => `${n(req(e.card))} was added to ${whose(e.seat)} hand${via(e, n)}.`,
  destroy: (e, n) => (e.s === 'unstable'
    ? `${n(req(e.tcard))} burned out (Unstable).`
    : e.s === 'replaced' ? `${n(req(e.tcard))} was scrapped to make room${via(e, n)}.`
    : `${n(req(e.tcard))} was marked for destruction${via(e, n)}.`),
  die: (e, n) => `${n(req(e.card))} was destroyed.`,
  dmg: (e, n) => `${n(req(e.tcard))} took ${e.n ?? 0} damage${via(e, n)}.`,
  draw: (e) => `${who(e.seat)} drew ${e.n ?? 1} ${plural(e.n ?? 1, 'card', 'cards')}.`,
  fizzle: (e, n) => `${n(req(e.card))} fizzled: every target was gone.`,
  grant: (e, n) => `${n(req(e.tcard))} gained ${kwNames(e.s)}${via(e, n)}.`,
  heal: (e, n) => `${n(req(e.tcard))} was repaired by ${e.n ?? 0}${via(e, n)}.`,
  lineFull: (e, n) => `${n(req(e.card))} was lost: ${whose(e.seat)} Line is full.`,
  maxCharge: (e, n) => `${e.seat === 0 ? 'Your' : "The foe's"} maximum Charge rose by ${e.n ?? 1}${via(e, n)}.`,
  mulligan: (e) => ((e.n ?? 0) === 0 ? `${who(e.seat)} kept the opening hand.` : `${who(e.seat)} replaced ${e.n} ${plural(e.n, 'card', 'cards')}.`),
  negate: (e, n) => `${n(req(e.card))} was negated${via(e, n)}.`,
  over: (e) => (e.seat === undefined ? 'The battle ended in a draw.' : e.seat === 0 ? 'You won the battle.' : 'The foe won the battle.'),
  pass: (e) => `${who(e.seat)} passed.`,
  play: (e, n) => `${who(e.seat)} played ${n(req(e.card))} (${e.n ?? 0} Charge).`,
  rally: (e, n) => `${who(e.seat)} may attack again${via(e, n)}.`,
  recall: (e, n) => `${n(req(e.tcard))} returned to ${whose(e.seat)} hand${via(e, n)}.`,
  reserve: (e, n) => `${who(e.seat)} gained ${e.n ?? 0} Reserve${via(e, n)}.`,
  resolve: (e, n) => `${n(req(e.card))} resolved.`,
  round: (e) => `Round ${e.n ?? 0}: ${e.seat === 0 ? 'you hold' : 'the foe holds'} the Initiative.`,
  silence: (e, n) => `${n(req(e.tcard))} was silenced${via(e, n)}.`,
  spireDmg: (e, n) => `${e.seat === 0 ? 'Your' : "The foe's"} Crystal took ${e.n ?? 0} damage${via(e, n)}.`,
  spireHeal: (e, n) => `${e.seat === 0 ? 'Your' : "The foe's"} Crystal was repaired by ${e.n ?? 0}${via(e, n)}.`,
  stasis: (e, n) => `${n(req(e.tcard))} is in Stasis for the round${via(e, n)}.`,
  strike: (e, n) => `${n(req(e.card))} struck ${e.tcard ? n(e.tcard) : e.tunit === 'spire0' ? 'your Crystal' : "the foe's Crystal"} for ${e.n ?? 0}.`,
  summon: (e, n) => `${n(req(e.card))} joined ${whose(e.seat)} Line.`,
  ward: (e, n) => `${n(req(e.tcard))}'s Ward absorbed the damage.`,
};

export function lineText(e: LogEntry, name: Name): string {
  const fn = LOG_LINES[e.k];
  if (!fn) throw new Error(`No player-facing line for log kind "${e.k}" (add it to LOG_LINES in src/match/text.ts)`);
  return fn(e, name);
}

export const KEYWORD_HELP: Record<Keyword, { name: string; text: string }> = {
  vanguard: { name: 'Vanguard', text: 'When attacking, strikes before its blocker. If the blocker is destroyed it does not strike back.' },
  pierce: { name: 'Pierce', text: "Strike damage beyond the blocker's health hits the enemy Crystal. If the blocker is gone, it strikes the Crystal." },
  aerial: { name: 'Aerial', text: 'Can be blocked only by Aerial or Spotter units.' },
  spotter: { name: 'Spotter', text: 'Can block Aerial units.' },
  plated: { name: 'Plated', text: 'Takes 1 less damage from every source.' },
  siphon: { name: 'Siphon', text: "Damage its strikes deal repairs its owner's Crystal by that much." },
  ward: { name: 'Ward', text: 'Negates the next damage it would take, then is used up.' },
  dueler: { name: 'Dueler', text: 'When declared as an attacker, may name one enemy unit not in Stasis, which must block it.' },
  dread: { name: 'Dread', text: 'Cannot be blocked by units with 2 or less power.' },
  unstable: { name: 'Unstable', text: 'Destroyed at the end of the round.' },
  mend: { name: 'Mend', text: 'Fully repaired at the start of each round.' },
  corrosive: { name: 'Corrosive', text: 'Any damage it deals to a unit destroys that unit.' },
};

export const END_REASONS: Record<string, string> = {
  spire: 'A Crystal fell to 0.',
  spires: 'Both Crystals fell at the same moment.',
  deck: 'A player had to draw from an empty deck.',
  rounds: 'Round 45 passed without a winner.',
  concede: 'A player conceded.',
};

function specWords(s: TargetSpec): string {
  const side = s.side === 'ally' ? 'a friendly' : s.side === 'enemy' ? 'an enemy' : 'any';
  if (s.what === 'glyph') return s.side === 'ally' ? 'one of your tactics on the stack' : s.side === 'enemy' ? 'an enemy tactic on the stack' : 'a tactic on the stack';
  const base = s.what === 'unitOrSpire' ? 'unit or Crystal' : 'unit';
  return `${side}${s.filter?.hero ? ' hero' : ''} ${base}${s.inCombat ? ' in the attack' : ''}`;
}

export function targetPrompt(cardName: string, slot: number, total: number, spec: TargetSpec): string {
  if (total === 1) return `Choose ${specWords(spec)} for ${cardName}`;
  return `Target ${slot + 1} of ${total} for ${cardName}: ${specWords(spec)}`;
}
