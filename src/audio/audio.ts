// One module owns every audio decision (adapted from Annals of Scrivenearth, PLAN D19). Sounds ride the structured
// log: the battle screen hands each new event over as it appears. Generated samples (tools/audio, the local Audio
// Studio) play when present; every other kind plays a synthesized brass-and-steam voice. NOT VERIFIED BY EAR.
import type { LogEntry, Seat } from '../engine/types';

type Voice = (ctx: AudioContext, out: AudioNode, t: number, e: LogEntry, mine: boolean) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.6;
let muted = false;
const lastAt = new Map<string, number>();
let live = 0;
const MAX_LIVE = 8; // rate limit: a wide board must not become a wall of noise
const MIN_GAP = 0.07; // seconds between two voices of the same kind

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

/** Phones only start audio inside a gesture, and may park it again: keep listening and retry for the session. */
export function installAudioUnlock(): void {
  const wake = (): void => {
    const c = ensure();
    if (c && c.state !== 'running') void c.resume();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, wake, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = muted ? 0 : volume;
}
export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = muted ? 0 : volume;
}
export function isMuted(): boolean {
  return muted;
}

// ---------- building blocks ----------
function tone(c: AudioContext, out: AudioNode, t: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  live += 1;
  o.onended = () => { live -= 1; };
}
function noise(c: AudioContext, out: AudioNode, t: number, dur: number, gain: number, hp: number, lp = 16000): void {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f1 = c.createBiquadFilter();
  f1.type = 'highpass';
  f1.frequency.value = hp;
  const f2 = c.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.value = lp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f1).connect(f2).connect(g).connect(out);
  src.start(t);
  live += 1;
  src.onended = () => { live -= 1; };
}
/** A struck brass bell: a triangle with harmonic partials (Annals used inharmonic crystal partials). */
function chime(c: AudioContext, out: AudioNode, t: number, freq: number, dur: number, gain: number): void {
  tone(c, out, t, freq, dur, gain, 'triangle');
  tone(c, out, t, freq * 2, dur * 0.7, gain * 0.3, 'triangle');
  tone(c, out, t, freq * 3, dur * 0.4, gain * 0.12);
}

const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880]; // A minor pentatonic, a darker brass

// ---------- the voice table: one entry per log kind that should be heard ----------
const VOICES: Record<string, Voice> = {
  round: (c, o, t) => { tone(c, o, t, 110, 0.9, 0.22, 'triangle'); chime(c, o, t + 0.12, 659.25, 0.9, 0.1); },
  draw: (c, o, t) => noise(c, o, t, 0.06, 0.12, 3000),
  play: (c, o, t, _e, mine) => { chime(c, o, t, mine ? 659.25 : 440, 0.5, 0.2); noise(c, o, t, 0.08, 0.1, 1500, 6000); },
  summon: (c, o, t) => chime(c, o, t, 783.99, 0.3, 0.12),
  cast: (c, o, t) => { tone(c, o, t, 300, 0.35, 0.14, 'sawtooth', 1400); noise(c, o, t, 0.3, 0.06, 4000); },
  resolve: (c, o, t) => chime(c, o, t, 1046.5, 0.35, 0.12),
  fizzle: (c, o, t) => tone(c, o, t, 500, 0.3, 0.1, 'triangle', 180),
  negate: (c, o, t) => { tone(c, o, t, 900, 0.25, 0.16, 'square', 200); noise(c, o, t, 0.15, 0.12, 2000); },
  strike: (c, o, t) => { noise(c, o, t, 0.09, 0.3, 300, 2500); tone(c, o, t, 160, 0.12, 0.25, 'triangle', 70); },
  dmg: (c, o, t) => noise(c, o, t, 0.07, 0.22, 2500),
  spireDmg: (c, o, t, e) => {
    // a struck crystal (PLAN D27): a low thud, a glassy crack, then inharmonic ringing partials
    const big = Math.min(1, (e.n ?? 1) / 6);
    tone(c, o, t, 80, 0.3, 0.25 + 0.15 * big, 'sine', 50);
    noise(c, o, t, 0.08, 0.18 + 0.1 * big, 3000);
    chime(c, o, t + 0.01, 1200, 0.9, 0.12);
    chime(c, o, t + 0.01, 2806, 0.7, 0.08);
    chime(c, o, t + 0.02, 6661, 0.4, 0.04);
  },
  ward: (c, o, t) => { chime(c, o, t, 1318.5, 0.5, 0.16); chime(c, o, t + 0.05, 1975.5, 0.4, 0.08); },
  absorb: (c, o, t) => tone(c, o, t, 220, 0.12, 0.15, 'square'),
  heal: (c, o, t) => { chime(c, o, t, 587.33, 0.3, 0.1); chime(c, o, t + 0.09, 880, 0.4, 0.1); },
  spireHeal: (c, o, t) => { chime(c, o, t, 523.25, 0.4, 0.12); chime(c, o, t + 0.1, 783.99, 0.5, 0.12); },
  buff: (c, o, t) => chime(c, o, t, 987.77, 0.25, 0.1),
  grant: (c, o, t) => chime(c, o, t, 1174.7, 0.25, 0.09),
  stasis: (c, o, t) => { tone(c, o, t, 1400, 0.6, 0.12, 'sine', 500); chime(c, o, t + 0.1, 2093, 0.5, 0.06); },
  silence: (c, o, t) => tone(c, o, t, 400, 0.4, 0.12, 'triangle', 120),
  recall: (c, o, t) => tone(c, o, t, 400, 0.25, 0.12, 'sine', 1200),
  die: (c, o, t) => {
    noise(c, o, t, 0.35, 0.28, 3500);
    for (let i = 0; i < 4; i++) chime(c, o, t + 0.03 * i + Math.random() * 0.03, 1500 + Math.random() * 2500, 0.25, 0.05);
  },
  attack: (c, o, t) => { noise(c, o, t, 0.35, 0.16, 600, 3000); tone(c, o, t, 196, 0.4, 0.16, 'sawtooth', 392); },
  blocks: (c, o, t) => tone(c, o, t, 196, 0.18, 0.18, 'square'),
  rally: (c, o, t) => { chime(c, o, t, 783.99, 0.3, 0.14); chime(c, o, t + 0.1, 1046.5, 0.4, 0.14); },
  charge: (c, o, t) => tone(c, o, t, 660, 0.2, 0.1, 'triangle', 990),
  maxCharge: (c, o, t) => { tone(c, o, t, 440, 0.3, 0.12, 'triangle', 880); chime(c, o, t + 0.15, 1318.5, 0.4, 0.08); },
  channel: (c, o, t) => { chime(c, o, t, 659.25, 0.5, 0.14); chime(c, o, t + 0.12, 987.77, 0.6, 0.12); },
  pass: (c, o, t) => tone(c, o, t, 330, 0.06, 0.06, 'triangle'),
  ascend: (c, o, t) => {
    // The big moment: a rising surge, then a chord of struck crystal with a sparkle on top.
    tone(c, o, t, 80, 1.6, 0.3, 'sawtooth', 320);
    noise(c, o, t, 1.4, 0.1, 5000);
    for (const [i, f] of [261.63, 392, 523.25, 659.25, 783.99].entries()) chime(c, o, t + 1.2 + i * 0.06, f, 2.6, 0.16);
    for (let i = 0; i < 8; i++) chime(c, o, t + 1.5 + i * 0.09, SCALE[i % SCALE.length] * 2, 0.5, 0.06);
  },
  over: (c, o, t, e, mine) => {
    const won = mine && e.seat !== undefined;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 293.66, 196];
    notes.forEach((f, i) => chime(c, o, t + i * 0.22, f, 1.2, 0.16));
  },
};

/** Log kinds that are deliberately silent. A kind in neither table fails tests/audio-map.test.ts. */
export const SILENT_KINDS = ['mulligan', 'burn', 'lineFull', 'destroy', 'create', 'reserve', 'combatEnd', 'order'];
export const VOICED_KINDS = Object.keys(VOICES);

// ---------- generated samples (from EVILAEGIS, HANDOFF-GPU.md) ----------
// public/audio/manifest.json lists the sample ids that exist. A kind with a sample plays it; a kind without one
// plays the synthesized voice above. Which one is in use is shown on the sound test in Settings (never silent).
const samples = new Map<string, AudioBuffer>();
let sampleIds: string[] = [];
export function sampleStatus(): { loaded: string[]; listed: string[] } {
  return { loaded: [...samples.keys()], listed: sampleIds };
}
export async function loadSamples(base = './audio/'): Promise<void> {
  musicBase = base;
  const r = await fetch(`${base}manifest.json`).catch(() => null);
  // no generated audio delivered yet (a static host may answer a missing file with the page itself)
  if (!r || !r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return;
  sampleIds = (await r.json()) as string[];
  const c = ensure();
  if (!c) return;
  await Promise.all(sampleIds.filter((id) => id.startsWith('sfx/') || id.startsWith('voice/') || id === 'music/ascend-sting').map(async (id) => {
    const f = await fetch(`${base}${id}.ogg`);
    if (!f.ok) throw new Error(`audio manifest lists ${id} but ${id}.ogg is missing`);
    samples.set(id, await c.decodeAudioData(await f.arrayBuffer()));
  }));
}
/**
 * Variants (PLAN D28): `sfx/<kind>-<n>` files are alternatives to `sfx/<kind>`. Each play picks one at random,
 * never the one heard last, so a sound that repeats (every Crystal hit) does not sound the same each time.
 */
const lastVariant = new Map<string, string>();
export function variantsOf(id: string, ids: readonly string[]): string[] {
  return ids.filter((x) => x === id || (x.startsWith(`${id}-`) && /^\d+$/.test(x.slice(id.length + 1))));
}
function pickVariant(id: string): string {
  const all = variantsOf(id, [...samples.keys()]);
  if (all.length <= 1) return id;
  const pool = all.filter((x) => x !== lastVariant.get(id));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastVariant.set(id, pick);
  return pick;
}
function playSample(c: AudioContext, id: string, gain = 1): boolean {
  const buf = samples.get(id);
  if (!buf || !master) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start();
  live += 1;
  src.onended = () => { live -= 1; };
  return true;
}

// ---------- music (generated tracks; silent until they are delivered) ----------
export type MusicMood = 'title' | 'calm' | 'battle' | 'tense' | 'victory' | 'defeat' | 'none';
const tracks = new Map<string, AudioBuffer>();
let musicGain: GainNode | null = null;
let musicSrc: AudioBufferSourceNode | null = null;
let mood: MusicMood = 'none';
let musicVolume = 0.5;
let musicBase = './audio/';
export function setMusicVolume(v: number): void {
  musicVolume = Math.max(0, Math.min(1, v));
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.2);
}
export function currentMood(): MusicMood { return mood; }
/** Crossfade to a mood's track. One-shots (victory, defeat) do not loop. Safe to call every render. */
export async function setMusic(next: MusicMood): Promise<void> {
  if (next === mood) return;
  mood = next;
  const c = ensure();
  if (!c || !master) return;
  if (musicSrc && musicGain) {
    const old = musicSrc; const g = musicGain;
    g.gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(() => { try { old.stop(); } catch { /* already stopped */ } }, 2000);
    musicSrc = null; musicGain = null;
  }
  const id = `music/${next}`;
  if (next === 'none' || !sampleIds.includes(id)) return;
  let buf = tracks.get(id);
  if (!buf) {
    const f = await fetch(`${musicBase}${id}.ogg`);
    if (!f.ok) throw new Error(`audio manifest lists ${id} but ${id}.ogg is missing`);
    buf = await c.decodeAudioData(await f.arrayBuffer());
    tracks.set(id, buf);
  }
  if (mood !== next) return; // the mood changed while this track was loading
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = next !== 'victory' && next !== 'defeat';
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(musicVolume, c.currentTime, 0.6);
  src.connect(g).connect(master);
  src.start();
  musicSrc = src; musicGain = g;
}

/** Play the sound for one event, now. `seat` is the listener's seat (so "mine" can sound brighter). */
export function playEvent(e: LogEntry, seat: Seat): void {
  const voice = VOICES[e.k];
  if (!voice || muted) return;
  const c = ensure();
  if (!c || !master || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  const last = lastAt.get(e.k) ?? -1;
  if (t - last < MIN_GAP) return;
  if (live >= MAX_LIVE && e.k !== 'ascend' && e.k !== 'over') return;
  lastAt.set(e.k, t);
  if (e.k === 'ascend' && e.card) { playSample(c, 'music/ascend-sting', 1.4); playSample(c, `voice/${e.card}`, 1.6); } // sting, then the hero's line over it
  if (playSample(c, pickVariant(`sfx/${e.k}`))) return;
  voice(c, master, t, e, e.seat === seat);
}

/** For the sound test page in Settings: play one kind by name. */
export function audition(kind: string): void {
  const c = ensure();
  if (c && c.state !== 'running') void c.resume();
  playEvent({ k: kind, r: 0, seat: 0, n: 3 }, 0);
}
