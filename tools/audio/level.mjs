#!/usr/bin/env node
// Trims, levels and encodes the audio masters into the delivery files, and measures the result. Needs ffmpeg + ffprobe.
//   node tools/audio/level.mjs [--dry-run] [--only id,id] [--kind music|sfx|voice]
// Reads audio-masters/<id>.flac|wav (from gen.mjs), writes public/audio/<id>.ogg (Opus: music 96 kbps stereo, effects
// and voice 80 kbps mono), public/audio/manifest.json (the ids present, in manifest order) and audio-masters/measure.json.
// Levelling (HANDOFF-GPU.md section 2): effects to one loudness so they sit within about +-15% RMS of each other, voice
// lines normalised, music 6 dB under the effects; a limiter at -1 dBFS catches peaks. One-shots and voice lose leading
// silence over 30 ms (10 ms kept) and trailing silence over 100 ms (30 ms kept); music is not trimmed. A master under
// SILENT_LUFS is a failed generation and is flagged for a re-roll instead of being lifted.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SILENT_LUFS, SR, measureFile, round } from './measure-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(ROOT, 'tools', 'audio', 'manifest.json');
const MASTERS_DEFAULT = path.join(ROOT, 'audio-masters');
const PUBLIC = path.join(ROOT, 'public', 'audio');
/** Loudness targets (LUFS estimate from measure-lib): effects and voice at one level, music 6 dB under. */
export const TARGET_LUFS = { sfx: -18, voice: -18, music: -24 };
const LIMIT = 0.891; // -1 dBFS

let v;
try {
  v = parseArgs({ args: process.argv.slice(2), strict: true, allowPositionals: false, options: { 'dry-run': { type: 'boolean' }, only: { type: 'string' }, kind: { type: 'string' }, masters: { type: 'string' }, help: { type: 'boolean' } } }).values;
} catch (e) { console.error(`error: ${e.message}`); process.exit(2); }
if (v.help) { console.log('Usage: node tools/audio/level.mjs [--dry-run] [--only id,id] [--kind music|sfx|voice] [--masters dir]   (dir defaults to audio-masters; eleven.mjs writes audio-masters/eleven)'); process.exit(0); }
const MASTERS = v.masters ? path.resolve(ROOT, v.masters) : MASTERS_DEFAULT;
for (const bin of ['ffmpeg', 'ffprobe']) if (spawnSync(bin, ['-version'], { stdio: 'ignore' }).status !== 0) { console.error(`error: ${bin} is not on PATH (winget install Gyan.FFmpeg).`); process.exit(2); }

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const entries = [
  ...manifest.music.map((m) => ({ kind: 'music', ...m })),
  ...manifest.sfx.map((s) => ({ kind: 'sfx', ...s })),
  ...manifest.voice.map((x) => ({ kind: 'voice', ...x })),
].filter((e) => !v.kind || e.kind === v.kind);
const only = v.only ? new Set(v.only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
// gen.mjs (Audio Studio) writes flac/wav; eleven.mjs writes mp3. The first that exists is the master.
const masterOf = (e) => ['flac', 'wav', 'mp3'].map((x) => path.join(MASTERS, `${e.id}.${x}`)).find((p) => existsSync(p)) ?? path.join(MASTERS, `${e.id}.flac`);
const outOf = (e) => path.join(PUBLIC, `${e.id}.ogg`);

const prev = existsSync(path.join(MASTERS, 'measure.json')) ? JSON.parse(readFileSync(path.join(MASTERS, 'measure.json'), 'utf8')).files ?? {} : {};
const report = { ...prev };
const flags = [];
let n = 0;
for (const e of entries) {
  const src = masterOf(e);
  if (!existsSync(src)) continue;
  if (only && !only.has(e.id)) continue;
  n++;
  const m = measureFile(src);
  const silent = !Number.isFinite(m.lufs) || m.lufs < SILENT_LUFS;
  if (silent) flags.push(`${e.id}: ${Number.isFinite(m.lufs) ? m.lufs.toFixed(1) : '-inf'} LUFS is near silent; re-roll it (gen.mjs --force --reroll 1 --only ${e.id})`);
  // trim: one-shots and voice close to the event; music only loses dead air over 0.1 s at the head and 0.5 s at the tail
  // (a looping track must end where the sound ends, or the loop holds a pause).
  let start = 0;
  let end = m.samples;
  if (m.bounds) {
    const [lead, keepLead, tail, keepTail] = e.kind === 'music' ? [0.1, 0.05, 0.5, 0.3] : [0.03, 0.01, 0.1, 0.03];
    if (m.bounds.start > lead * SR) start = Math.max(0, m.bounds.start - Math.round(keepLead * SR));
    if (m.samples - m.bounds.end > tail * SR) end = Math.min(m.samples, m.bounds.end + Math.round(keepTail * SR));
  }
  // A looping track is made seamless: its first `xfade` seconds are lifted off the head and crossfaded over its tail, so the
  // file ends in the material that leads back into its own start. The loop point is then sample 0. The crossfade is four
  // beats at the manifest's bpm, which hides a phrase joint without being heard as a dip.
  const xfade = e.loop && e.kind === 'music' && e.bpm ? round(240 / e.bpm, 3) : 0;
  const trimmedMs = Math.round(((m.samples - (end - start)) / SR) * 1000);
  const gainDb = silent ? 0 : round(TARGET_LUFS[e.kind] - m.lufs);
  const line = `${e.id.padEnd(22)} master peak ${String(round(m.peakDb)).padStart(6)} dB  lufs ${String(round(m.lufs)).padStart(6)}  crest ${String(round(m.crest)).padStart(5)}  ${round(m.seconds, 2)} s${trimmedMs ? `  trim ${trimmedMs} ms` : ''}  gain ${gainDb > 0 ? '+' : ''}${gainDb} dB`;
  if (v['dry-run']) { console.log(line); continue; }
  const out = outOf(e);
  mkdirSync(path.dirname(out), { recursive: true });
  // Mono delivery is mixed inside the chain as the plain channel average, before the gain and the limiter. Left to
  // `-ac 1`, ffmpeg rematrixes after the filters with -3 dB coefficients, which lifted effects 3 dB past the ceiling.
  // The resample to 48 kHz also runs first, so the limiter sees the samples that are encoded.
  const front = ['aresample=48000'];
  if (e.kind !== 'music' && m.channels === 2) front.push('pan=mono|c0=0.5*c0+0.5*c1');
  const encode = (filters, dest, codec = true) => {
    const args = ['-y', '-v', 'error'];
    if (start > 0 || end < m.samples) args.push('-ss', (start / SR).toFixed(4), '-t', ((end - start) / SR).toFixed(4));
    args.push('-i', src);
    if (xfade) {
      const graph = `[0:a]asplit[h][b];[h]atrim=0:${xfade},asetpts=PTS-STARTPTS[head];[b]atrim=${xfade},asetpts=PTS-STARTPTS[body];[body][head]acrossfade=d=${xfade}:c1=tri:c2=tri,${filters.join(',')}[out]`;
      args.push('-filter_complex', graph, '-map', '[out]');
    } else args.push('-af', filters.join(','));
    args.push('-ac', e.kind === 'music' ? '2' : '1', '-ar', '48000');
    if (codec) args.push('-c:a', 'libopus', '-b:a', e.kind === 'music' ? '96k' : '80k');
    args.push(dest);
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    if (r.status !== 0) { console.error(`ffmpeg failed for ${e.id}: ${(r.stderr ?? '').slice(0, 300)}`); process.exit(1); }
  };
  const limiter = `alimiter=limit=${LIMIT}:attack=5:release=50:level=false`;
  encode([...front, `volume=${gainDb}dB`, limiter], out);
  let o = measureFile(out);
  let compressed = false;
  // A one-shot that is all transient (a card slide, a click of glass) cannot reach the target through a limiter alone:
  // the ceiling stops the lift while the gated loudness stays low. Only then, a fast compressor tames the peak first and the
  // gain is re-measured on the compressed sound. Music and anything already near target are never compressed.
  if (e.kind !== 'music' && !silent && o.lufs < TARGET_LUFS[e.kind] - 1.5 && o.peakDb > -2) {
    const comp = 'acompressor=threshold=-20dB:ratio=6:attack=0.3:release=40:knee=4:makeup=1';
    const tmp = out.replace(/\.ogg$/, '.comp.wav');
    encode([...front, comp], tmp, false);
    const c = measureFile(tmp);
    const g2 = round(TARGET_LUFS[e.kind] - c.lufs);
    encode([...front, comp, `volume=${g2}dB`, limiter], out);
    o = measureFile(out);
    compressed = true;
    spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', '/q', tmp] : ['-f', tmp]);
  }
  report[e.id] = { kind: e.kind, master: { peakDb: round(m.peakDb), lufs: round(m.lufs), rmsDb: round(m.rmsDb), crest: round(m.crest), seconds: round(m.seconds, 2) },
    delivered: { peakDb: round(o.peakDb), lufs: round(o.lufs), rmsDb: round(o.rmsDb), crest: round(o.crest), seconds: round(o.seconds, 2) }, trimmedMs, gainDb, compressed, silent, ...(xfade ? { loopCrossfadeS: xfade } : {}), source: path.basename(src) };
  console.log(`${line}  ->  ${round(o.lufs)} LUFS, peak ${round(o.peakDb)} dB, crest ${round(o.crest)}, ${round(o.seconds, 2)} s${compressed ? '  (compressed)' : ''}${xfade ? `  (loop, ${xfade} s crossfade)` : ''}`);
}
for (const f of flags) console.error(`FLAG ${f}`);
console.log(`${n} master(s) processed${n === 0 ? ' (nothing generated yet)' : ''}.`);
if (v['dry-run'] || n === 0) process.exit(0);

// spread of the effects, the voice lines, and music against effects: gated loudness (what was levelled) and whole-file RMS
const by = (k, f) => Object.values(report).filter((x) => x.kind === k && !x.silent).map((x) => x.delivered[f]);
const span = (xs) => (xs.length ? round(Math.max(...xs) - Math.min(...xs)) : null);
const mean = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const summary = {
  sfxLufsSpanDb: span(by('sfx', 'lufs')), sfxLufsMean: mean(by('sfx', 'lufs')), sfxRmsSpanDb: span(by('sfx', 'rmsDb')), sfxRmsMeanDb: mean(by('sfx', 'rmsDb')),
  voiceLufsSpanDb: span(by('voice', 'lufs')), voiceLufsMean: mean(by('voice', 'lufs')), musicLufsMean: mean(by('music', 'lufs')), musicRmsMeanDb: mean(by('music', 'rmsDb')),
};
console.log(`effects: gated loudness spread ${summary.sfxLufsSpanDb} dB (mean ${summary.sfxLufsMean} LUFS), whole-file RMS spread ${summary.sfxRmsSpanDb} dB (about +-15% RMS is +-1.2 dB); voice spread ${summary.voiceLufsSpanDb} dB (mean ${summary.voiceLufsMean} LUFS); music mean ${summary.musicLufsMean} LUFS against effects ${summary.sfxLufsMean} LUFS.`);
writeFileSync(path.join(MASTERS, 'measure.json'), JSON.stringify({ generatedAt: new Date().toISOString(), targets: TARGET_LUFS, summary, flags, files: report }, null, 1));
const ids = [...manifest.music, ...manifest.sfx, ...manifest.voice].map((x) => x.id).filter((id) => existsSync(path.join(PUBLIC, `${id}.ogg`)));
writeFileSync(path.join(PUBLIC, 'manifest.json'), JSON.stringify(ids));
console.log(`public/audio/manifest.json lists ${ids.length} ids; measurements in ${path.relative(ROOT, path.join(MASTERS, "measure.json")).split(path.sep).join("/")}. NOT VERIFIED BY EAR.`);
