// Printed-vs-data auditor: every card face's text is checked against its own data, offline.
// FAIL = a number, keyword, trigger word or effect word is in the text but not the data, or the reverse.
// It cannot judge meaning (that is what the per-card behaviour tests and docs/audit/ reviews are for).
//   npx tsx tools/audit.ts            exit 1 on any FAIL
//   npx tsx tools/audit.ts --selftest proves the auditor still fails on known-bad cards
import '../src/data/cards/index';
import type { CardDef, CardFace } from '../src/engine/types';
import { allCards, def, hasCard } from '../src/engine/query';
import { KEYWORDS } from '../src/engine/validate';

const WORD: Record<string, string> = { deploy: 'Deploy:', shatter: 'Shatter:', strike: 'Strike:', assault: 'Assault:', dawn: 'Dawn:', dusk: 'Dusk:', ascend: 'Ascend:' };
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twice: 2, both: 2 };

interface FaceData { id: string; name: string; text: string; data: unknown; keywords: string[]; cost: number; type: string }

function faces(c: CardDef): FaceData[] {
  const base = { keywords: c.keywords, abilities: c.abilities, auras: c.auras, costAuras: c.costAuras, targets: c.targets, ops: c.ops, castIf: c.castIf };
  const out: FaceData[] = [{ id: c.id, name: c.name, text: c.text, data: base, keywords: c.keywords ?? [], cost: c.cost, type: c.type }];
  if (c.ascended) {
    const a: CardFace = c.ascended;
    out.push({ id: `${c.id}--ascended`, name: a.name ?? c.name, text: a.text, data: { keywords: a.keywords, abilities: a.abilities, auras: a.auras, costAuras: a.costAuras }, keywords: a.keywords ?? [], cost: c.cost, type: c.type });
  }
  return out;
}

function walk(x: unknown, f: (key: string, v: unknown, parent: Record<string, unknown>) => void): void {
  if (Array.isArray(x)) { for (const v of x) walk(v, f); return; }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) { f(k, v, x as Record<string, unknown>); walk(v, f); }
  }
}

export function auditFace(fd: FaceData): { fails: string[]; warns: string[] } {
  const fails: string[] = [];
  const warns: string[] = [];
  const text = fd.text;
  const low = text.toLowerCase();
  const json = JSON.stringify(fd.data ?? {});
  const has = (re: RegExp): boolean => re.test(text);

  // keywords: printed keywords must be named; a keyword named in the text must exist somewhere in the data
  const dataKws = new Set<string>(fd.keywords);
  walk(fd.data, (k, v) => { if ((k === 'kw' || k === 'notKw') && v) for (const x of Array.isArray(v) ? v : [v]) dataKws.add(String(x)); });
  for (const k of fd.keywords) if (!new RegExp(`\\b${k}\\b`, 'i').test(text)) fails.push(`has ${k} but the text does not say so`);
  for (const k of KEYWORDS) if (new RegExp(`\\b${k[0].toUpperCase()}${k.slice(1)}\\b`).test(text) && !dataKws.has(k)) fails.push(`text names ${k} but the data has no ${k}`);

  // ability words
  const trig = new Set<string>();
  walk(fd.data, (k, v) => { if (k === 'on') trig.add(String(v)); });
  for (const [t, w] of Object.entries(WORD)) {
    if (trig.has(t) && !text.includes(w)) fails.push(`has a ${t} ability but the text lacks "${w}"`);
    if (!trig.has(t) && text.includes(w)) fails.push(`text says "${w}" but there is no ${t} ability`);
  }
  for (const t of trig) if (!(t in WORD) && !/\bWhen\b|\bWhenever\b/.test(text)) fails.push(`has a ${t} ability but the text has no "When ..." sentence`);

  // effect words, both directions
  const ops = new Set<string>();
  const sels = new Set<string>();
  walk(fd.data, (k, v) => {
    if (k === 'op') ops.add(String(v));
    if (['to', 'from', 'a', 'b', 'of'].includes(k) && typeof v === 'string') sels.add(v);
  });
  const pair = (label: string, inData: boolean, inText: boolean): void => {
    if (inData && !inText) fails.push(`data does "${label}" but the text does not say so`);
    if (!inData && inText) fails.push(`text says "${label}" but the data does not do it`);
  };
  pair('this round', json.includes('"dur":"round"') || json.includes('ThisRound') || json.includes('"c":"seenRound"') || ops.has('rally'), /this round/i.test(text));
  pair('Resonant', json.includes('"c":"resonant"'), /\bResonant\b/.test(text));
  pair('Stasis', ops.has('stasis') || json.includes('"stasis":'), /\bStasis\b/.test(text));
  pair('draw', ops.has('draw'), /\bdraws?\b/i.test(text));
  pair('summon', ops.has('summon'), /\bsummon/i.test(text) && !/when you summon|you've summoned|When another ally is summoned/i.test(text) || (ops.has('summon') && /\bsummon/i.test(text)));
  pair('negate', ops.has('negate'), /\bnegate\b/i.test(text));
  pair('drain', ops.has('drain'), /\bdrain/i.test(text));
  pair('silence', ops.has('silence'), /\bsilence/i.test(text));
  pair('return to hand', ops.has('recall'), /\breturn\b/i.test(text));
  pair('repair', ops.has('heal'), /\brepair/i.test(text));
  pair('destroy', ops.has('destroy'), /\bdestroy\b|\bscrap\b/i.test(text) && !/is destroyed|are destroyed|been destroyed/i.test(text) || (ops.has('destroy') && /\bdestroy|\bscrap/i.test(text)));
  pair('attack again', ops.has('rally'), /attack again/i.test(text));
  pair('random', [...sels].some((s) => s.startsWith('random')), /\brandom\b/i.test(text));
  pair('strongest', [...sels].some((s) => s.startsWith('strongest')), /\bstrongest\b/i.test(text));
  pair('weakest', [...sels].some((s) => s.startsWith('weakest')), /\bweakest\b/i.test(text));
  pair('Reserve', ops.has('reserve') || json.includes('"count":"reserve"') || json.includes('"c":"reserve"'), /\bReserve\b/.test(text));
  pair('Charge', ops.has('charge') || ops.has('maxCharge'), /\bCharge\b/.test(text));
  pair('cost less/more', json.includes('"costAuras"') && !json.includes('"costAuras":null') && /"costAuras":\[/.test(json), /\bcosts?\b/i.test(text));
  const spire = sels.has('mySpire') || sels.has('enemySpire') || json.includes('unitOrSpire') || json.includes('"c":"spire"') || trig.has('spireHit');
  pair('Boiler', spire, /\bBoiler\b/.test(text)); // the engine's Spire is printed as the Boiler (PLAN D16)
  if (fd.type === 'glyph') {
    const enemyOnly = json.includes('"side":"enemy"') || sels.has('enemies') || [...sels].some((s) => /Enemy$/.test(s)) || sels.has('enemySpire');
    if (enemyOnly && !/\benem/i.test(text)) fails.push('data targets enemies but the text never says enemy');
  }

  // numbers, both directions
  const dataNums = new Set<number>();
  const allowed = new Set<number>(); // a summoned token's stats may be printed but need not be
  walk(fd.data, (k, v) => {
    if (typeof v === 'number' && ['n', 'power', 'health', 'mul', 'plus', 'max', 'gte', 'lte', 'maxPower', 'minPower', 'maxCost', 'minCost'].includes(k)) dataNums.add(Math.abs(v));
    if (k === 'card' && typeof v === 'string' && hasCard(v)) { const t = def(v); if (t.power !== undefined) { allowed.add(t.power); allowed.add(t.health ?? 0); } }
  });
  const textNums = new Set<number>();
  for (const m of text.matchAll(/\d+/g)) textNums.add(Number(m[0]));
  const wordNums = new Set<number>();
  for (const w of low.split(/[^a-z]+/)) if (w in NUMBER_WORDS) wordNums.add(NUMBER_WORDS[w]);
  const cmp = /or fewer|or less|or more|fewer than|less than|more than|at least|at most/i.test(text);
  for (const n of textNums) {
    if (dataNums.has(n) || allowed.has(n) || n === 0) continue;
    if (cmp && (dataNums.has(n + 1) || dataNums.has(n - 1))) { warns.push(`text number ${n} is a comparison against ${dataNums.has(n + 1) ? n + 1 : n - 1}: check the boundary`); continue; }
    fails.push(`text has the number ${n} but the data does not`);
  }
  for (const n of dataNums) {
    if (n === 0 || textNums.has(n) || wordNums.has(n)) continue;
    if (n >= 99 && /\bfully\b/i.test(text)) continue;
    if (cmp && (textNums.has(n + 1) || textNums.has(n - 1))) continue;
    // "N or less" filters are sometimes worded as "less than N+1"
    if (textNums.has(n + 1) && /fewer than|less than|more than/i.test(text)) { warns.push(`data number ${n} appears only as a comparison`); continue; }
    fails.push(`data has the number ${n} but the text does not`);
  }
  if (!text && json !== '{}' && Object.values(fd.data as Record<string, unknown>).some((v) => Array.isArray(v) && v.length)) fails.push('has data but no text');
  if (has(/\b(may|up to|choose)\b/i) && fd.type !== 'glyph' && !json.includes('"targets"')) warns.push('text offers a choice but the ability takes no target');
  return { fails, warns };
}

if (process.argv.includes('--selftest')) {
  const bad: FaceData[] = [
    { id: 'x1', name: 'X', text: 'Deal 3 to an enemy unit.', data: { ops: [{ op: 'damage', to: 'target0', n: 2 }], targets: [{ what: 'unit', side: 'enemy' }] }, keywords: [], cost: 1, type: 'glyph' },
    { id: 'x2', name: 'X', text: 'Plated.', data: { keywords: [] }, keywords: [], cost: 1, type: 'unit' },
    { id: 'x3', name: 'X', text: 'Deploy: draw 1.', data: { abilities: [{ on: 'shatter', ops: [{ op: 'draw', n: 1 }] }] }, keywords: [], cost: 1, type: 'unit' },
    { id: 'x4', name: 'X', text: 'Give an ally +2|+2.', data: { ops: [{ op: 'buff', to: 'target0', power: 2, health: 2, dur: 'round' }], targets: [{ what: 'unit', side: 'ally' }] }, keywords: [], cost: 1, type: 'glyph' },
  ];
  const missed = bad.filter((b) => auditFace(b).fails.length === 0).map((b) => b.id);
  if (missed.length) { console.error(`audit selftest FAILED: known-bad cards passed: ${missed.join(', ')}`); process.exit(1); }
  console.log('audit selftest: 4 known-bad cards all fail.');
  process.exit(0);
}

let nf = 0, nw = 0, n = 0;
for (const c of allCards().filter((x) => !x.id.startsWith('zz-'))) {
  for (const fd of faces(c)) {
    n += 1;
    const { fails, warns } = auditFace(fd);
    for (const f of fails) { nf += 1; console.log(`FAIL ${fd.id}: ${f}\n       "${fd.text}"`); }
    if (process.argv.includes('--warn')) for (const w of warns) { nw += 1; console.log(`WARN ${fd.id}: ${w}`); }
  }
}
console.log(`audit: ${n} card faces, ${nf} FAIL${process.argv.includes('--warn') ? `, ${nw} WARN` : ''}.`);
if (nf) process.exit(1);
