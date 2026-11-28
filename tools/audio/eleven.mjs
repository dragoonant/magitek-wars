#!/usr/bin/env node
// Generates the game's music and sound effects with ElevenLabs (music: /v1/music, effects: /v1/sound-generation) from
// tools/audio/manifest.json, the same prompts the local Audio Studio uses (gen.mjs). Runs anywhere with network access.
//   node tools/audio/eleven.mjs [--dry-run] [--only id,id] [--kind music|sfx] [--takes n] [--force]
//   node tools/audio/eleven.mjs --keep sfx/round=3,sfx/strike=1   (make a given take the master, for a choice by ear)
// The key: ELEVENLABS_API_KEY, sent as the xi-api-key header (in a cloud session the network proxy supplies the real key,
// so any placeholder value works; run Node with NODE_USE_ENV_PROXY=1 so fetch goes through it). Masters go to audio-masters/eleven/<id>.mp3 (gitignored); every take is kept as
// <id>.take<n>.mp3 and the chosen one is copied to <id>.mp3: for effects, the loudest take that is not near silent and,
// among takes within 6 dB of it, the sharper transient (as gen.mjs); for music, the take with the most even loudness
// (smallest spread of short-term loudness), so a loop does not dip. Idempotent: an id whose master exists is skipped.
// An effect with `layers` ([{ prompt, seconds, at, gainDb, promptInfluence }]) is built from parts: each layer is generated
// on its own and the parts are mixed by ffmpeg, each starting `at` seconds in and turned by `gainDb`, so a short sound
// can hold two events (a ratchet, then a chime) that one prompt of that length tends to drop.
// Then: node tools/audio/level.mjs --masters audio-masters/eleven (trim, level, encode public/audio/*.ogg).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SILENT_LUFS, SR, decode, measureFile, round } from './measure-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(ROOT, 'tools', 'audio', 'manifest.json');
const OUT = path.join(ROOT, 'audio-masters', 'eleven');
const LOG = path.join(OUT, 'log.json');
const API = 'https://api.elevenlabs.io';
const HELP = 'Usage: node tools/audio/eleven.mjs [--dry-run] [--only id,id] [--kind music|sfx] [--takes n] [--force] | --keep id=n,id=n';

let v;
try {
  v = parseArgs({ args: process.argv.slice(2), strict: true, allowPositionals: false, options: {
    'dry-run': { type: 'boolean' }, only: { type: 'string' }, kind: { type: 'string' }, takes: { type: 'string' }, force: { type: 'boolean' }, keep: { type: 'string' }, help: { type: 'boolean' },
  } }).values;
} catch (e) { console.error(`error: ${e.message}\n${HELP}`); process.exit(2); }
if (v.help) { console.log(HELP); process.exit(0); }
if (v.kind && !['music', 'sfx'].includes(v.kind)) { console.error('error: --kind must be music or sfx'); process.exit(2); }
const TAKES = Number(v.takes ?? 2);
if (!Number.isInteger(TAKES) || TAKES < 1 || TAKES > 6) { console.error('error: --takes takes a whole number from 1 to 6'); process.exit(2); }
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY && !v['dry-run'] && !v.keep) { console.error('error: ELEVENLABS_API_KEY is not set (in a cloud session, set it to proxy-injected).'); process.exit(2); }

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const entries = [...manifest.music.map((m) => ({ kind: 'music', ...m })), ...manifest.sfx.map((s) => ({ kind: 'sfx', ...s }))];
const only = v.only ? new Set(v.only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
if (only) {
  const bad = [...only].filter((i) => !entries.some((e) => e.id === i));
  if (bad.length || !only.size) { console.error(`error: unknown id(s): ${bad.join(', ') || '(none given)'}`); process.exit(2); }
}
const masterOf = (e) => path.join(OUT, `${e.id}.mp3`);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

if (v.keep) {
  const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};
  for (const pair of v.keep.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [id, n] = pair.split('=');
    const e = entries.find((x) => x.id === id);
    const take = e && path.join(OUT, `${id}.take${n}.mp3`);
    if (!take || !existsSync(take)) { console.error(`error: no take ${n} of ${id}`); process.exit(2); }
    copyFileSync(take, masterOf(e));
    log[id] = { ...(log[id] ?? {}), kept: path.basename(take), keptBy: 'chosen with --keep' };
    console.log(`${id}: master is now ${path.basename(take)}`);
  }
  writeFileSync(LOG, JSON.stringify(log, null, 1));
  process.exit(0);
}

/** The request for one take. Music carries the manifest's tempo and key in words; effects their length in seconds. */
function requestOf(e) {
  if (e.kind === 'music') {
    const prompt = `${e.prompt}, ${e.bpm} BPM, ${e.key}${e.loop ? ', steady to the last bar so it loops' : ''}`;
    return { route: '/v1/music', body: { prompt, music_length_ms: clamp(Math.round(e.duration * 1000), 3000, 300000), model_id: 'music_v1', force_instrumental: true } };
  }
  return sfxRequest(e.prompt, e.seconds, e.promptInfluence);
}
const sfxRequest = (text, seconds, influence) => ({ route: '/v1/sound-generation', body: { text, duration_seconds: clamp(seconds, 0.5, 30), prompt_influence: influence ?? 0.6 } });

/** Mixes layer files into one mp3: each delayed by its `at` and turned by its `gainDb`; the mix is as long as the longest part. */
function mixLayers(e, files, dest) {
  const args = ['-y', '-v', 'error'];
  for (const f of files) args.push('-i', f);
  const parts = e.layers.map((l, k) => {
    const ms = Math.round((l.at ?? 0) * 1000);
    return `[${k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${l.gainDb ?? 0}dB[l${k}]`;
  });
  const graph = `${parts.join(';')};${e.layers.map((_, k) => `[l${k}]`).join('')}amix=inputs=${e.layers.length}:normalize=0:duration=longest[out]`;
  args.push('-filter_complex', graph, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '320k', dest);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg could not mix ${e.id}: ${(r.stderr ?? '').slice(0, 300)}`);
}

async function post(route, body) {
  const res = await fetch(`${API}${route}?output_format=mp3_44100_192`, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(600000) });
  if (!res.ok) throw new Error(`POST ${route} -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 400)}`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length < 1000) throw new Error(`POST ${route} returned only ${data.length} bytes`);
  return data;
}

/** Spread (dB) of 3 s loudness windows over the middle of a track, ignoring the first and last 3 s: a smaller spread is steadier. */
function evenness(file) {
  const samples = decode(file).mono;
  const w = 3 * SR;
  const db = [];
  for (let i = w; i + w <= samples.length - w; i += w) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += samples[j] * samples[j];
    db.push(10 * Math.log10(s / w + 1e-12));
  }
  if (db.length < 2) return 0;
  db.sort((a, b) => a - b);
  return db[Math.floor(db.length * 0.9)] - db[Math.floor(db.length * 0.1)];
}

function pickTake(e, paths) {
  const m = paths.map((p) => ({ p, ...measureFile(p), even: e.kind === 'music' ? evenness(p) : 0 }));
  const live = m.filter((x) => Number.isFinite(x.lufs) && x.lufs >= SILENT_LUFS);
  if (!live.length) return { pick: paths[0], takes: m, note: 'every take near silent' };
  if (e.kind === 'music') return { pick: [...live].sort((a, b) => a.even - b.even)[0].p, takes: m, note: '' };
  const loudest = Math.max(...live.map((x) => x.lufs));
  const close = live.filter((x) => x.lufs >= loudest - 6).sort((a, b) => b.crest - a.crest);
  return { pick: close[0].p, takes: m, note: '' };
}

const todo = entries.filter((e) => (!v.kind || e.kind === v.kind) && (!only || only.has(e.id)) && (v.force || !existsSync(masterOf(e))));
console.log(`${entries.length} music and effect entries; ${todo.length} to generate, ${TAKES} take(s) each; masters that exist are skipped.`);
for (const e of todo) {
  const rs = e.layers ? e.layers.map((l) => sfxRequest(l.prompt, l.seconds, l.promptInfluence)) : [requestOf(e)];
  console.log(`  ${e.kind.padEnd(5)} ${e.id.padEnd(22)} ${rs.map((r) => `POST ${r.route} ${v['dry-run'] ? JSON.stringify(r.body) : ''}`).join(' + ')}`);
}
if (v['dry-run'] || !todo.length) process.exit(0);

mkdirSync(OUT, { recursive: true });
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};
let failed = 0;
for (const [n, e] of todo.entries()) {
  const r = requestOf(e);
  const dest = masterOf(e);
  mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write(`[${n + 1}/${todo.length}] ${e.kind} ${e.id} ... `);
  try {
    const paths = [];
    for (let t = 1; t <= TAKES; t++) {
      const p = dest.replace(/\.mp3$/, `.take${t}.mp3`);
      if (e.layers) {
        const parts = [];
        for (const [k, l] of e.layers.entries()) {
          const q = dest.replace(/\.mp3$/, `.take${t}.layer${k + 1}.mp3`);
          const lr = sfxRequest(l.prompt, l.seconds, l.promptInfluence);
          writeFileSync(q, await post(lr.route, lr.body));
          parts.push(q);
        }
        mixLayers(e, parts, p);
      } else writeFileSync(p, await post(r.route, r.body));
      paths.push(p);
    }
    const choice = pickTake(e, paths);
    copyFileSync(choice.pick, dest);
    const kept = path.basename(choice.pick) + (choice.note ? ` (${choice.note})` : '');
    log[e.id] = { kind: e.kind, route: r.route, request: e.layers ? { layers: e.layers } : r.body, kept, at: new Date().toISOString(),
      takes: choice.takes.map((t) => ({ file: path.basename(t.p), lufs: round(t.lufs), crest: round(t.crest), peakDb: round(t.peakDb), seconds: round(t.seconds, 2), ...(e.kind === 'music' ? { evennessDb: round(t.even) } : {}) })) };
    writeFileSync(LOG, JSON.stringify(log, null, 1));
    console.log(`ok, kept ${kept}`);
  } catch (err) {
    failed++;
    console.log(`FAILED: ${err.message}`);
  }
}
console.log(`${todo.length - failed} generated, ${failed} failed. Next: node tools/audio/level.mjs --masters audio-masters/eleven`);
process.exitCode = failed ? 1 : 0;
