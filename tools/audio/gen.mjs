#!/usr/bin/env node
// Generates the game's music, sound effects and hero voice lines on the local Audio Studio (port 7890) from
// tools/audio/manifest.json. Adapted from dragoonant/StellarDerelict tools/audio (gen-audio.mjs, lib.mjs, studio.mjs).
// Runs on the studio PC only. One GPU job at a time. Idempotent: an id whose master exists is skipped.
//   node tools/audio/gen.mjs [--dry-run] [--only id,id] [--kind music|sfx|voice] [--limit n] [--force] [--reroll n]
//                            [--base http://127.0.0.1:7890] [--timeout 900]
// Masters (FLAC/WAV exactly as the studio made them) go to audio-masters/<id>.<ext> (gitignored). Effects are rendered
// as a batch of two takes, kept as <id>.take1.flac / <id>.take2.flac, and the better take is copied to <id>.flac
// (the loudest take that is not near silent; among takes within 6 dB of it, the one with the sharper transient).
// A re-render archives the old master. Then: node tools/audio/level.mjs (trim, level, encode public/audio/*.ogg).
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SILENT_LUFS, measureFile, round } from './measure-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(ROOT, 'tools', 'audio', 'manifest.json');
const MASTERS = path.join(ROOT, 'audio-masters');
const LOG = path.join(MASTERS, 'log.json');
const KINDS = ['music', 'sfx', 'voice'];
const HELP = 'Usage: node tools/audio/gen.mjs [--dry-run] [--only id,id] [--kind music|sfx|voice] [--limit n] [--force] [--reroll n] [--base url] [--timeout sec]';

let v;
try {
  v = parseArgs({ args: process.argv.slice(2), strict: true, allowPositionals: false, options: {
    'dry-run': { type: 'boolean' }, only: { type: 'string' }, kind: { type: 'string' }, limit: { type: 'string' }, force: { type: 'boolean' },
    reroll: { type: 'string' }, base: { type: 'string' }, timeout: { type: 'string' }, help: { type: 'boolean' },
  } }).values;
} catch (e) { console.error(`error: ${e.message}\n${HELP}`); process.exit(2); }
if (v.help) { console.log(HELP); process.exit(0); }
if (v.kind && !KINDS.includes(v.kind)) { console.error(`error: --kind must be one of ${KINDS.join(', ')}`); process.exit(2); }
const reroll = Number(v.reroll ?? 0);
if (!Number.isInteger(reroll) || reroll < 0) { console.error('error: --reroll takes a whole number (1, 2, ...)'); process.exit(2); }
if (reroll > 0 && !v.force) { console.error('error: --reroll only makes sense with --force'); process.exit(2); }
const BASE = String(v.base ?? process.env.AUDIO_STUDIO_URL ?? 'http://127.0.0.1:7890').replace(/\/+$/, '');
const TIMEOUT_MS = Number(v.timeout ?? 900) * 1000;

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const entries = [
  ...manifest.music.map((m) => ({ kind: 'music', ...m })),
  ...manifest.sfx.map((s) => ({ kind: 'sfx', ...s })),
  ...manifest.voice.map((x) => ({ kind: 'voice', ...x })),
];
const only = v.only ? new Set(v.only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
if (only) {
  const known = new Set(entries.map((e) => e.id));
  const bad = [...only].filter((i) => !known.has(i));
  if (bad.length || !only.size) { console.error(`error: unknown id(s): ${bad.join(', ') || '(none given)'}`); process.exit(2); }
}
const extOf = (e) => (e.kind === 'voice' ? 'wav' : 'flac');
const masterOf = (e) => path.join(MASTERS, `${e.id}.${extOf(e)}`);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** A stable seed from the id so a re-run reproduces the same take; `reroll` offsets it for another take. */
function seedOf(id, offset = 0) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h + offset) % 2147483647;
}

function bodyOf(e) {
  const seed = seedOf(e.id, reroll);
  if (e.kind === 'music') {
    return { mode: 'music', prompt: e.prompt, lyrics: '[Instrumental]', duration: clamp(Math.round(e.duration), 10, 240), steps: 8,
      bpm: clamp(Math.round(e.bpm), 10, 300), key: e.key ?? 'C minor', timesig: '4', language: 'en', batch: 1, seed };
  }
  if (e.kind === 'sfx') {
    return { mode: 'sfx', prompt: e.prompt, negative: e.negative ?? 'music, voices, speech', seconds: clamp(Math.ceil(e.seconds), 1, 47),
      steps: 50, guidance: 5, batch: 2, seed };
  }
  return { mode: 'voice', model: 'qwen-design', text: e.text, language: 'English', instruct: e.instruct, temperature: 0.8, seed };
}

let todo = entries.filter((e) => (!v.kind || e.kind === v.kind) && (!only || only.has(e.id)) && (v.force || !existsSync(masterOf(e))));
todo = todo.slice(0, Number(v.limit ?? 9999));
console.log(`${entries.length} entries in the manifest; ${todo.length} to render${v.force ? ` (force${reroll ? `, take ${reroll + 1}` : ''})` : ''}; masters that exist are skipped.`);
for (const e of todo) console.log(`  ${e.kind.padEnd(5)} ${e.id.padEnd(22)} -> ${path.relative(ROOT, masterOf(e))}${v['dry-run'] ? `\n        POST ${BASE}/api/jobs ${JSON.stringify(bodyOf(e))}` : ''}`);
if (v['dry-run']) { console.log('dry run: nothing was sent.'); process.exit(0); }
if (!todo.length) process.exit(0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(method, route, { body, timeoutMs = 30000, raw = false } = {}) {
  const res = await fetch(BASE + route, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return raw ? Buffer.from(await res.arrayBuffer()) : await res.json().catch(() => ({}));
}
const DONE = ['done', 'completed', 'complete', 'succeeded', 'success', 'finished', 'ready'];
const FAILED = ['error', 'failed', 'failure', 'cancelled', 'canceled'];
function fileNames(job, fallback) {
  for (const key of ['audios', 'files', 'outputs', 'audio', 'results']) {
    const list = job?.[key];
    if (Array.isArray(list) && list.length) {
      const names = list.map((x) => (typeof x === 'string' ? x : (x?.name ?? x?.file ?? x?.filename ?? ''))).map((s) => String(s).split(/[\\/]/).pop()).filter(Boolean);
      if (names.length) return names;
    }
  }
  return fallback;
}
/** Post one job, poll until it finishes, download up to `want` files. Cancels the job on timeout. */
async function runJob(body, want, fallbackNames) {
  const created = await http('POST', '/api/jobs', { body });
  const id = created?.id ?? created?.jobId;
  if (!id) throw new Error(`the studio did not return a job id: ${JSON.stringify(created).slice(0, 200)}`);
  const t0 = Date.now();
  let wait = 2000;
  let job = {};
  for (;;) {
    await sleep(wait);
    wait = Math.min(Math.round(wait * 1.5), 10000);
    job = await http('GET', `/api/jobs/${encodeURIComponent(id)}`);
    const s = String(job?.status ?? job?.state ?? '').toLowerCase();
    if (DONE.includes(s)) break;
    if (FAILED.includes(s)) throw new Error(`job ${id} ${s}: ${String(job.error ?? job.message ?? '').slice(0, 300)}`);
    if (Date.now() - t0 > TIMEOUT_MS) {
      await http('POST', `/api/jobs/${encodeURIComponent(id)}/cancel`, { body: {}, timeoutMs: 10000 }).catch(() => {});
      throw new Error(`job ${id} did not finish within ${Math.round(TIMEOUT_MS / 1000)} s (cancelled)`);
    }
  }
  const files = [];
  for (const name of fileNames(job, fallbackNames).slice(0, want)) {
    files.push({ name, data: await http('GET', `/files/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, { raw: true, timeoutMs: 120000 }) });
  }
  return { id, files, seconds: (Date.now() - t0) / 1000, params: job.params ?? body };
}

/** The better of two effect takes: the loudest that is not near silent; among takes within 6 dB of it, the sharper transient. */
function pickTake(paths) {
  const m = paths.map((p) => ({ p, ...measureFile(p) }));
  const live = m.filter((x) => Number.isFinite(x.lufs) && x.lufs >= SILENT_LUFS);
  if (!live.length) return { pick: paths[0], takes: m, note: 'both takes near silent' };
  const loudest = Math.max(...live.map((x) => x.lufs));
  const close = live.filter((x) => x.lufs >= loudest - 6);
  close.sort((a, b) => b.crest - a.crest);
  return { pick: close[0].p, takes: m, note: '' };
}

const st = await http('GET', '/api/status', { timeoutMs: 10000 }).catch((e) => { console.error(`error: the Audio Studio is not answering at ${BASE} (${e.message}). Start it with node server.js in audio-studio/.`); process.exit(2); });
console.log(`Audio Studio: comfy ${st.comfy}, GPU ${st.gpu?.name ?? '?'} ${st.gpu?.usedMB ?? '?'} / ${st.gpu?.totalMB ?? '?'} MB. GPU WORK STARTS: ${todo.length} job(s), one at a time.`);
mkdirSync(path.join(MASTERS, 'archive'), { recursive: true });
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};
let failed = 0;
let streak = 0;
try {
  for (const [n, e] of todo.entries()) {
    const body = bodyOf(e);
    process.stdout.write(`[${n + 1}/${todo.length}] ${e.kind} ${e.id} (seed ${body.seed}) ... `);
    try {
      const want = e.kind === 'sfx' ? 2 : 1;
      const r = await runJob(body, want, e.kind === 'voice' ? ['voice.wav'] : ['audio_0.flac', 'audio_1.flac']);
      if (!r.files.length) throw new Error('the job finished with no files');
      const dest = masterOf(e);
      mkdirSync(path.dirname(dest), { recursive: true });
      if (existsSync(dest)) renameSync(dest, path.join(MASTERS, 'archive', `${e.id.replace('/', '--')}-${Date.now()}.${extOf(e)}`));
      let kept = '';
      let takes = [];
      if (e.kind === 'sfx') {
        const paths = r.files.map((f, i) => { const p = dest.replace(/\.flac$/, `.take${i + 1}.flac`); writeFileSync(p, f.data); return p; });
        const choice = pickTake(paths);
        copyFileSync(choice.pick, dest);
        kept = path.basename(choice.pick) + (choice.note ? ` (${choice.note})` : '');
        takes = choice.takes.map((t) => ({ file: path.basename(t.p), lufs: round(t.lufs), crest: round(t.crest), peakDb: round(t.peakDb) }));
      } else {
        writeFileSync(dest, r.files[0].data);
      }
      log[e.id] = { kind: e.kind, job: r.id, seed: body.seed, reroll, seconds: round(r.seconds, 1), kept, takes, at: new Date().toISOString() };
      writeFileSync(LOG, JSON.stringify(log, null, 1));
      console.log(`ok in ${Math.round(r.seconds)} s${kept ? `, kept ${kept}` : ''}`);
      streak = 0;
    } catch (err) {
      failed++; streak++;
      console.log(`FAILED: ${err.message}`);
      if (streak >= 2) { console.error('two failures in a row: stopping so the GPU is not hammered; run again, finished ids are skipped.'); break; }
    }
  }
} finally {
  await http('POST', '/api/backend/free', { body: {}, timeoutMs: 15000 }).then(() => console.log('freed the studio backend.'), () => console.error('warning: could not free the backend.'));
}
console.log(`${todo.length - failed} rendered, ${failed} failed. Next: node tools/audio/level.mjs`);
process.exitCode = failed ? 1 : 0;
