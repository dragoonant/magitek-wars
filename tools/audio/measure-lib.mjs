// Audio measurement shared by gen.mjs (choosing a take) and level.mjs (trim, level, report). Adapted from
// dragoonant/StellarDerelict tools/audio/measure-lib.mjs. Needs ffmpeg and ffprobe on PATH. Samples are decoded to
// mono Float32 at 48 kHz (the K-weighting coefficients below are for 48 kHz); the peak is read per channel.
import { spawnSync } from 'node:child_process';

export const SR = 48000;
/** A file this quiet is a failed generation, not a quiet sound. */
export const SILENT_LUFS = -42;
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

function biquad(x, b, a) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = b[0] * xi + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    y[i] = yi;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
  }
  return y;
}

/** ITU-R BS.1770 K-weighting (high shelf, then high-pass), 48 kHz coefficients. */
export function kWeight(x) {
  const shelf = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  return biquad(shelf, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
}

export function channelsOf(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const n = Number((r.stdout ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Decode at the file's own channel count (ffmpeg's rematrixing shifts levels by about 3 dB): mono mix plus the true peak over channels. */
export function decode(file) {
  const ch = channelsOf(file);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}`);
  const b = r.stdout;
  const frame = 4 * ch;
  const all = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength - (b.byteLength % frame)));
  const mono = new Float32Array(all.length / ch);
  let peak = 0;
  for (let i = 0; i < mono.length; i++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) {
      const s = all[i * ch + c];
      sum += s;
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
    mono[i] = sum / ch;
  }
  return { mono, peak, channels: ch };
}

/**
 * Peak, RMS, integrated loudness and crest factor (peak / RMS, linear).
 * `lufs` follows ITU-R BS.1770-4: K-weighted 400 ms blocks at 75% overlap, an absolute gate at -70 LUFS and a relative
 * gate 10 LU under the gated mean, so a short effect surrounded by near-silence is measured by the event, not the file.
 * `lufsUngated` is the plain K-weighted mean square over the whole file.
 */
export function analyse(samples, peak) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = samples.length ? Math.sqrt(sum / samples.length) : 0;
  const k = kWeight(samples);
  let ks = 0;
  for (let i = 0; i < k.length; i++) ks += k[i] * k[i];
  const lufsUngated = k.length && ks > 0 ? -0.691 + 10 * Math.log10(ks / k.length) : -Infinity;
  const toL = (ms) => -0.691 + 10 * Math.log10(ms);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const blocks = [];
  if (k.length >= block) {
    for (let s = 0; s + block <= k.length; s += hop) {
      let e = 0;
      for (let i = s; i < s + block; i++) e += k[i] * k[i];
      blocks.push(e / block);
    }
  } else if (k.length) {
    blocks.push(ks / k.length);
  }
  const abs = blocks.filter((ms) => ms > 0 && toL(ms) > -70);
  let lufs = -Infinity;
  if (abs.length) {
    const rel = toL(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const gated = abs.filter((ms) => toL(ms) > rel);
    if (gated.length) lufs = toL(gated.reduce((a, b) => a + b, 0) / gated.length);
  }
  return { peakDb: db(peak), rmsDb: db(rms), lufs, lufsUngated, crest: rms > 0 ? peak / rms : 0, seconds: samples.length / SR };
}

/** First and last sample above `thresholdDb`, or null when the file is silent. */
export function silenceBounds(samples, thresholdDb = -50) {
  const t = 10 ** (thresholdDb / 20);
  let a = -1;
  let b = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > t) {
      if (a < 0) a = i;
      b = i;
    }
  }
  return a < 0 ? null : { start: a, end: b + 1 };
}

export function measureFile(file) {
  const d = decode(file);
  return { ...analyse(d.mono, d.peak), channels: d.channels, bounds: silenceBounds(d.mono), samples: d.mono.length };
}

export const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);
