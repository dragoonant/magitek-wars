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
import { isDetail, onDetailChange, setDetail } from './detail';
import { installAudioUnlock, isMuted, loadSamples, setMusic, setMuted, type MusicMood } from './audio/audio';

// The game draws into one offscreen canvas in logical pixels at the SNES hi-res size (512 x 448). The title and the
// gallery are drawn at 256 x 224 into another and doubled; the battle screens draw at full size (PLAN D17). The page's
// #screen canvas only shows that frame, scaled to fill the window (PLAN D21). With FULL DETAIL art (PLAN D22) both
// offscreen canvases have a whole number of backing pixels per logical pixel, so rendered art keeps its detail while
// everything drawn in code stays on the logical grid.

const screenEl = document.getElementById('screen');
if (!(screenEl instanceof HTMLCanvasElement)) throw new Error('main: no #screen canvas');
const canvas: HTMLCanvasElement = screenEl;
const shown = canvas.getContext('2d');
if (!shown) throw new Error('main: no 2d context');
const game = document.createElement('canvas');
game.width = HW;
game.height = HH;
const ctx = game.getContext('2d');
if (!ctx) throw new Error('main: no 2d context');
ctx.imageSmoothingEnabled = false;
const hi = new Gfx(ctx);
const loCanvas = document.createElement('canvas');
const loCtx = loCanvas.getContext('2d');
if (!loCtx) throw new Error('main: no 2d context');
const lo = new Gfx(loCtx);
/** Backing pixels per logical pixel of the game canvas: 1 for PIXEL art, the next whole display scale for DETAIL. */
let gameScale = 0;
function sizeOffscreen(k: number): void {
  if (k === gameScale) return;
  gameScale = k;
  game.width = HW * k;
  game.height = HH * k;
  ctx!.setTransform(k, 0, 0, k, 0, 0);
  ctx!.imageSmoothingEnabled = false;
  loCanvas.width = W * 2 * k;
  loCanvas.height = H * 2 * k;
  loCtx!.setTransform(2 * k, 0, 0, 2 * k, 0, 0);
  loCtx!.imageSmoothingEnabled = false;
}
sizeOffscreen(1);

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
// Switching the art (PLAN D22) reloads the art loaded up front and resizes the offscreen canvases; the rest loads on
// demand. The old art stays on screen until the new art has arrived.
onDetailChange(() => {
  fit();
  Promise.all([scene.load(), gallery.load()]).catch((e: unknown) => {
    failed = e instanceof Error ? e.message : String(e);
    console.error(e);
  });
});

/**
 * The frame fills the window, keeping its 8:7 shape (PLAN D21). The shown canvas has one backing pixel per device
 * pixel. A whole-number scale is drawn with hard pixel edges; any other scale is drawn with hard edges at the next
 * whole number up, then smoothly reduced to fit ("sharp bilinear"), so pixel columns stay even and edges stay crisp.
 */
const up = document.createElement('canvas');
const upCtx = up.getContext('2d');
if (!upCtx) throw new Error('main: no 2d context');
let devScale = 1;
function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(window.innerWidth / HW, window.innerHeight / HH);
  const w = Math.max(1, Math.floor(HW * s));
  const h = Math.max(1, Math.floor(HH * s));
  canvas!.style.width = `${w}px`;
  canvas!.style.height = `${h}px`;
  canvas!.width = Math.max(1, Math.round(w * dpr));
  canvas!.height = Math.max(1, Math.round(h * dpr));
  devScale = canvas!.width / HW;
  const k = Math.max(1, Math.ceil(devScale - 0.001));
  up.width = HW * k;
  up.height = HH * k;
  sizeOffscreen(isDetail() ? k : 1);
}
window.addEventListener('resize', fit);
fit();
function present(): void {
  const c = canvas!;
  if (gameScale > 1) {
    // DETAIL: the frame is already drawn at the next whole scale; reduce it smoothly.
    shown!.imageSmoothingEnabled = true;
    shown!.imageSmoothingQuality = 'high';
    shown!.drawImage(game, 0, 0, c.width, c.height);
    return;
  }
  if (Math.abs(devScale - Math.round(devScale)) < 0.01 || devScale < 1) {
    shown!.imageSmoothingEnabled = devScale < 1;
    shown!.drawImage(game, 0, 0, c.width, c.height);
    return;
  }
  upCtx!.imageSmoothingEnabled = false;
  upCtx!.drawImage(game, 0, 0, up.width, up.height);
  shown!.imageSmoothingEnabled = true;
  shown!.imageSmoothingQuality = 'high';
  shown!.drawImage(up, 0, 0, c.width, c.height);
}

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

/** Single-key switches (M sound, P art) are off while a deck name is being typed, so those letters can be typed. */
const typing = (): boolean => screen === 'decks' && builder?.debug().mode === 'name';

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyP' && !typing()) {
    setDetail(!isDetail());
    return;
  }
  if (e.code === 'KeyM' && !typing()) {
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
// Touch: a tap acts on pointer-up; a press held 400 ms inspects instead (the hover detail), and does not act.
let touchHold: { x: number; y: number; timer: number; held: boolean } | null = null;
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch' || !touchHold) return;
  clearTimeout(touchHold.timer);
  const t0 = touchHold;
  touchHold = null;
  if (!t0.held) press(t0.x, t0.y, 0);
});
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const [x, y] = logical(e);
  if (e.pointerType === 'touch') {
    const hold = { x, y, held: false, timer: 0 };
    hold.timer = window.setTimeout(() => {
      hold.held = true;
      if (screen === 'match') match?.pointerMove(x, y);
      else if (screen === 'run') run?.pointerMove(x, y);
      else if (screen === 'decks') builder?.pointerMove(x, y);
    }, 400);
    touchHold = hold;
    return;
  }
  press(x, y, e.button);
});
function press(x: number, y: number, button: number): void {
  if (screen === 'gallery') gallery.pointerDown(x, y);
  else if (screen === 'setup') setup?.pointerDown(x, y);
  else if (screen === 'match') match?.pointerDown(x, y);
  else if (screen === 'run') run?.pointerDown(x, y);
  else if (screen === 'decks') builder?.pointerDown(x, y, button);
  else title.pointerDown(x, y);
  route();
}
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
  present();
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
