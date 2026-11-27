import './style.css';
import './data/cards/index';
import { drawText } from './font';
import { Gfx, H, W } from './gfx';
import { Scene } from './scene';
import { Title } from './title';
import { Gallery } from './gallery';
import { HH, HW, Match } from './match/board';
import { BattleSetup, type DeckOption } from './match/setup';
import { Session, readStoredSave, clearSave } from './match/session';
import type { Difficulty } from './ai/ai';
import { RunScreen } from './run/screen';
import { DeckBuilder } from './deckbuilder/screen';
import { installAudioUnlock, isMuted, loadSamples, setMusic, setMuted, type MusicMood } from './audio/audio';

// One canvas at the SNES hi-res size (512 x 448). The title and the gallery are drawn at 256 x 224 into an offscreen
// canvas and doubled; the battle screens draw at full size (PLAN D17).

const canvas = document.getElementById('screen');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('main: no #screen canvas');
canvas.width = HW;
canvas.height = HH;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('main: no 2d context');
ctx.imageSmoothingEnabled = false;
const hi = new Gfx(ctx);
const loCanvas = document.createElement('canvas');
loCanvas.width = W;
loCanvas.height = H;
const loCtx = loCanvas.getContext('2d');
if (!loCtx) throw new Error('main: no 2d context');
const lo = new Gfx(loCtx);

function hasSave(): boolean {
  return readStoredSave().kind === 'ok';
}

// Sound (PLAN D19): unlocked by the first gesture; M mutes, remembered in this browser.
installAudioUnlock();
try {
  setMuted(localStorage.getItem('magitek-wars.muted') === '1');
} catch {
  /* no storage: sound starts on */
}
loadSamples(`${import.meta.env.BASE_URL}audio/`).catch((e: unknown) => console.error(e));

/** Music follows the screen: title, menus and the map are calm, a battle drives, a boss is tense. */
function moodNow(): MusicMood {
  const m = screen === 'match' ? match : screen === 'run' ? run?.match ?? null : null;
  if (m) {
    const st = m.session.state;
    if (st.phase === 'over') return st.winner === 0 ? 'victory' : 'defeat';
    return m.mood;
  }
  return screen === 'title' || screen === 'gallery' ? 'title' : 'calm';
}

const scene = new Scene();
const title = new Title(hasSave);
const gallery = new Gallery();
let setup: BattleSetup | null = null;
let match: Match | null = null;
let run: RunScreen | null = null;
let builder: DeckBuilder | null = null;
let lastBattle: { mine: DeckOption; foe: DeckOption; level: Difficulty } | null = null;
type Screen = 'title' | 'gallery' | 'setup' | 'match' | 'run' | 'decks';
let screen: Screen = 'title';
let failed = '';
Promise.all([scene.load(), title.load(), gallery.load()]).catch((e: unknown) => {
  failed = e instanceof Error ? e.message : String(e);
  console.error(e);
});

/** Integer scale only (ART-STYLE section 1). */
function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / HW, window.innerHeight / HH)));
  canvas!.style.width = `${HW * s}px`;
  canvas!.style.height = `${HH * s}px`;
}
window.addEventListener('resize', fit);
fit();

const isLo = (): boolean => screen === 'title' || screen === 'gallery';

function logical(e: PointerEvent): [number, number] {
  const r = canvas!.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * HW;
  const y = ((e.clientY - r.top) / r.height) * HH;
  return isLo() ? [Math.floor(x / 2), Math.floor(y / 2)] : [Math.floor(x), Math.floor(y)];
}

function startBattle(mine: DeckOption, foe: DeckOption, level: Difficulty): void {
  lastBattle = { mine, foe, level };
  const seed = (Math.random() * 0x7fffffff) >>> 0;
  const session = Session.start({ seed, decks: [mine.cards, foe.cards] }, { deckNames: [mine.name, foe.name], difficulty: level });
  match = new Match(session, `${mine.name} vs ${foe.name}`);
  screen = 'match';
}

function continueBattle(): void {
  const r = readStoredSave();
  if (r.kind !== 'ok') return;
  const session = Session.fromSave(r.save);
  match = new Match(session, `${r.save.meta.deckNames[0]} vs ${r.save.meta.deckNames[1]}`);
  screen = 'match';
}

/** Move between screens when one asks to. */
function route(): void {
  if (title.open) {
    const o = title.open;
    title.open = null;
    if (o === 'cards') screen = 'gallery';
    else if (o === 'new') {
      setup = new BattleSetup();
      screen = 'setup';
    } else if (o === 'continue') continueBattle();
    else if (o === 'decks') {
      builder = new DeckBuilder();
      screen = 'decks';
    } else if (o === 'run') {
      run = new RunScreen();
      screen = 'run';
    }
  }
  if (builder?.result) {
    builder = null;
    screen = 'title';
  }
  if (run?.exit) {
    run.exit = false;
    run = null;
    screen = 'title';
  }
  if (gallery.exit) {
    gallery.exit = false;
    screen = 'title';
  }
  if (setup?.result) {
    const r = setup.result;
    setup.result = null;
    if (r.kind === 'back') screen = 'title';
    else startBattle(r.mine, r.foe, r.level);
  }
  if (match?.exit) {
    const e = match.exit;
    match.exit = null;
    if (e === 'rematch' && lastBattle) startBattle(lastBattle.mine, lastBattle.foe, lastBattle.level);
    else if (e === 'rematch') {
      clearSave();
      setup = new BattleSetup();
      screen = 'setup';
    } else {
      match = null;
      screen = 'title';
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    try {
      localStorage.setItem('magitek-wars.muted', isMuted() ? '1' : '0');
    } catch {
      /* not remembered */
    }
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab', 'PageUp', 'PageDown'].includes(e.code)) e.preventDefault();
  if (screen === 'gallery') gallery.key(e.code);
  else if (screen === 'setup') setup?.key(e.code);
  else if (screen === 'match') match?.key(e.code);
  else if (screen === 'run') run?.key(e.code);
  else if (screen === 'decks') builder?.key(e.code);
  else title.key(e.code);
  route();
});
canvas.addEventListener('pointermove', (e) => {
  if (screen === 'title') title.pointerMove(...logical(e));
  else if (screen === 'match') match?.pointerMove(...logical(e));
  else if (screen === 'run') run?.pointerMove(...logical(e));
  else if (screen === 'decks') builder?.pointerMove(...logical(e));
});
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const [x, y] = logical(e);
  if (screen === 'gallery') gallery.pointerDown(x, y);
  else if (screen === 'setup') setup?.pointerDown(x, y);
  else if (screen === 'match') match?.pointerDown(x, y);
  else if (screen === 'run') run?.pointerDown(x, y);
  else if (screen === 'decks') builder?.pointerDown(x, y, e.button);
  else title.pointerDown(x, y);
  route();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (screen !== 'decks' || !builder) return;
  e.preventDefault();
  builder.wheel(e.deltaY, ...logical(e as unknown as PointerEvent));
}, { passive: false });

const STEP = 1000 / 60;
let t = 0;
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) {
    t++;
    acc -= STEP;
  }
  void setMusic(moodNow()).catch((e: unknown) => console.error(e));
  try {
    drawFrame(now);
  } catch (e) {
    // never silent: the error is shown on screen and in the console, and the loop keeps running
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== crash) console.error(e);
    crash = msg;
  }
  if (crash) {
    ctx!.fillStyle = '#080810';
    ctx!.fillRect(0, HH - 12, HW, 12);
    drawText(hi, `ERROR: ${crash}`.toUpperCase().replace(/[^A-Z0-9 .,:'()/+|-]/g, ' ').slice(0, 84), 2, HH - 10, { color: 'emberGlow' });
  }
  requestAnimationFrame(frame);
}
let crash = '';
function drawFrame(now: number): void {
  if (screen === 'match' && match) {
    match.update(now);
    match.draw(hi, t);
    route();
  } else if (screen === 'run' && run) {
    run.update(now);
    run.draw(hi, t);
    route();
  } else if (screen === 'decks' && builder) {
    builder.draw(hi, t);
    route();
  } else if (screen === 'setup' && setup) setup.draw(hi);
  else {
    if (screen === 'gallery') gallery.draw(lo, t);
    else {
      scene.draw(lo, t);
      title.draw(lo, t, scene.emblem);
    }
    if (failed) drawText(lo, 'ART FAILED TO LOAD', 4, 4, { color: 'emberGlow', outline: 'ink' });
    ctx!.drawImage(loCanvas, 0, 0, HW, HH);
  }
}
requestAnimationFrame(frame);

// Read-only hook for end-to-end checks.
(window as unknown as { __mkw: object }).__mkw = {
  mode: () => title.mode.kind,
  cursor: () => title.cursor,
  ready: () => scene.ready,
  failed: () => failed,
  crash: () => crash,
  screen: () => screen,
  gallery: () => ({ faction: gallery.faction, index: gallery.index, view: gallery.view.kind }),
  /** Play-test hook: start a battle between two deck indices of the setup list (used with ?auto&fast). */
  battle: (mine: number, foe: number) => {
    const s = new BattleSetup();
    startBattle(s.decks[mine], s.decks[foe], 'normal');
    return s.decks.length;
  },
  run: () => (run ? { phase: run.run?.phase ?? 'pick', act: run.run?.act, boiler: run.run?.boiler, deck: run.run?.deck.length, inBattle: !!run.match } : null),
  ui: () => (match ? match.debug() : null),
  match: () => (match ? { phase: match.session.state.phase, round: match.session.state.round, priority: match.session.state.priority, winner: match.session.state.winner, actions: match.session.actions.length } : null),
};
