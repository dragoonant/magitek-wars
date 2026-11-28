import './style.css';
import './data/cards/index';
import { drawText, loadFonts } from './font';
import { Gfx, H, W } from './gfx';
import { Scene } from './scene';
import { Title } from './title';
import { Gallery } from './gallery';
import { BASE_W, HH, Match, WIDE_MAX, setHW } from './match/board';
import { BattleSetup, type DeckOption } from './match/setup';
import { Session, readStoredSave, clearSave } from './match/session';
import type { Difficulty } from './ai/ai';
import { RunScreen } from './run/screen';
import { ExpeditionScreen } from './expedition/screen';
import { DeckBuilder } from './deckbuilder/screen';
import { isDetail, onDetailChange, setDetail } from './detail';
import { installAudioUnlock, isMuted, loadSamples, setMusic, setMuted, type MusicMood } from './audio/audio';

// The game draws into one offscreen canvas in logical pixels at the SNES hi-res size (512 x 448). The title and the
// gallery are drawn at 256 x 224 into another and doubled; the battle screens draw at full size (PLAN D17). The page's
// #screen canvas only shows that frame, scaled to fill the window (PLAN D21). With FULL DETAIL art (PLAN D22) both
// offscreen canvases have a whole number of backing pixels per logical pixel, so rendered art keeps its detail while
// everything drawn in code stays on the logical grid.
// The frame's logical width FW follows the window's shape (PLAN D23): a battle lays itself out across all of it;
// screens built for 512 are drawn into a 512-wide canvas, centred, with a soft blurred copy of themselves at the sides.

const screenEl = document.getElementById('screen');
if (!(screenEl instanceof HTMLCanvasElement)) throw new Error('main: no #screen canvas');
const canvas: HTMLCanvasElement = screenEl;
const shown = canvas.getContext('2d');
if (!shown) throw new Error('main: no 2d context');
/** Logical width of the whole frame (even, 512 to WIDE_MAX); the height is always HH. */
let FW = BASE_W;
const game = document.createElement('canvas');
const ctx = game.getContext('2d');
if (!ctx) throw new Error('main: no 2d context');
const hi = new Gfx(ctx);
const midCanvas = document.createElement('canvas');
const midCtx = midCanvas.getContext('2d');
if (!midCtx) throw new Error('main: no 2d context');
const mid = new Gfx(midCtx);
const tiny = document.createElement('canvas');
tiny.width = 24;
tiny.height = 21;
const tinyCtx = tiny.getContext('2d');
if (!tinyCtx) throw new Error('main: no 2d context');
const loCanvas = document.createElement('canvas');
const loCtx = loCanvas.getContext('2d');
if (!loCtx) throw new Error('main: no 2d context');
const lo = new Gfx(loCtx);
/** Backing pixels per logical pixel of the game canvas: 1 for PIXEL art, the next whole display scale for DETAIL. */
let gameScale = 0;
let gameW = 0;
function sizeOffscreen(k: number): void {
  if (k === gameScale && FW === gameW) return;
  gameScale = k;
  gameW = FW;
  game.width = FW * k;
  game.height = HH * k;
  ctx!.setTransform(k, 0, 0, k, 0, 0);
  ctx!.imageSmoothingEnabled = false;
  midCanvas.width = BASE_W * k;
  midCanvas.height = HH * k;
  midCtx!.setTransform(k, 0, 0, k, 0, 0);
  midCtx!.imageSmoothingEnabled = false;
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
/** The roguelike campaign (spec 20) or Hero Expeditions (spec 21): the same screen slot, one at a time. */
let run: RunScreen | ExpeditionScreen | null = null;
let builder: DeckBuilder | null = null;
let lastBattle: { mine: DeckOption; foe: DeckOption; level: Difficulty } | null = null;
type Screen = 'title' | 'gallery' | 'setup' | 'match' | 'run' | 'decks';
let screen: Screen = 'title';
let failed = '';
Promise.all([loadFonts(), scene.load(), title.load(), gallery.load()]).catch((e: unknown) => {
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
 * The frame fills the window (PLAN D21, D23): its logical width follows the window's shape, so only a window
 * narrower than 8:7 or wider than WIDE_MAX:448 leaves bars. The shown canvas has one backing pixel per device
 * pixel. A whole-number scale is drawn with hard pixel edges; any other scale is drawn with hard edges at the next
 * whole number up, then smoothly reduced to fit ("sharp bilinear"), so pixel columns stay even and edges stay crisp.
 */
const up = document.createElement('canvas');
const upCtx = up.getContext('2d');
if (!upCtx) throw new Error('main: no 2d context');
let devScale = 1;
function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  FW = Math.max(BASE_W, Math.min(WIDE_MAX, 2 * Math.round((HH * aspect) / 2)));
  const s = Math.min(window.innerWidth / FW, window.innerHeight / HH);
  const w = Math.max(1, Math.floor(FW * s));
  const h = Math.max(1, Math.floor(HH * s));
  canvas!.style.width = `${w}px`;
  canvas!.style.height = `${h}px`;
  canvas!.width = Math.max(1, Math.round(w * dpr));
  canvas!.height = Math.max(1, Math.round(h * dpr));
  devScale = canvas!.width / FW;
  const k = Math.max(1, Math.ceil(devScale - 0.001));
  up.width = FW * k;
  up.height = HH * k;
  sizeOffscreen(k); // PLAN D25: the interface is always drawn at the screen's resolution, whatever the art
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
/** A battle uses the whole width; every other screen is 512 wide, centred. */
const isWide = (): boolean => screen === 'match' || (screen === 'run' && !!run?.match);
const offsetX = (): number => (isWide() ? 0 : (FW - BASE_W) / 2);

function logical(e: PointerEvent): [number, number] {
  const r = canvas!.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * FW - offsetX();
  const y = ((e.clientY - r.top) / r.height) * HH;
  return isLo() ? [Math.floor(x / 2), Math.floor(y / 2)] : [Math.floor(x), Math.floor(y)];
}

/** Put the 512-wide frame in the middle; the sides show it again, blurred and darkened, instead of bars. */
function compose(): void {
  const ox = offsetX();
  if (ox > 0) {
    tinyCtx!.imageSmoothingEnabled = true;
    tinyCtx!.drawImage(midCanvas, 0, 0, tiny.width, tiny.height);
    const ch = (HH * FW) / BASE_W;
    ctx!.imageSmoothingEnabled = true;
    ctx!.drawImage(tiny, 0, (HH - ch) / 2, FW, ch);
    ctx!.fillStyle = 'rgba(8, 8, 16, 0.55)';
    ctx!.fillRect(0, 0, FW, HH);
    ctx!.imageSmoothingEnabled = false;
    hi.rect(ox - 2, 0, 2, HH, 'ink');
    hi.rect(ox + BASE_W, 0, 2, HH, 'ink');
  }
  ctx!.imageSmoothingEnabled = false;
  ctx!.drawImage(midCanvas, ox, 0, BASE_W, HH);
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
    } else if (o === 'expedition') {
      run = new ExpeditionScreen();
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
/** The battle screen in play (a quick battle, or a campaign battle): it takes raw pointer events for drag and hold. */
const liveMatch = (): Match | null => (screen === 'match' ? match : screen === 'run' ? run?.match ?? null : null);
canvas.addEventListener('pointermove', (e) => {
  const m = liveMatch();
  if (m) { m.pointerMove(...logical(e), e.pointerType === 'touch'); return; }
  if (screen === 'title') title.pointerMove(...logical(e));
  else if (screen === 'match') match?.pointerMove(...logical(e));
  else if (screen === 'run') run?.pointerMove(...logical(e));
  else if (screen === 'decks') builder?.pointerMove(...logical(e));
});
// Touch: a tap acts on pointer-up; a press held 400 ms inspects instead (the hover detail), and does not act.
let touchHold: { x: number; y: number; timer: number; held: boolean } | null = null;
canvas.addEventListener('pointerup', (e) => {
  const m = liveMatch();
  if (m) { m.pointerUp(...logical(e)); route(); return; }
  if (e.pointerType !== 'touch' || !touchHold) return;
  clearTimeout(touchHold.timer);
  const t0 = touchHold;
  touchHold = null;
  if (!t0.held) press(t0.x, t0.y, 0);
});
canvas.addEventListener('pointercancel', () => liveMatch()?.pointerCancel());
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') liveMatch()?.pointerLeave(); });
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const [x, y] = logical(e);
  const m = liveMatch();
  if (m) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    canvas.setPointerCapture(e.pointerId);
    m.pointerDown(x, y, e.pointerType === 'touch');
    route();
    return;
  }
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
  const lm = liveMatch();
  if (lm) {
    e.preventDefault();
    lm.wheel(e.deltaY, ...logical(e as unknown as PointerEvent));
    return;
  }
  if (screen === 'run' && run) { e.preventDefault(); run.wheel(e.deltaY); return; }
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
    ctx!.fillRect(0, HH - 12, FW, 12);
    drawText(hi, `Error: ${crash}`.slice(0, 140), 4, HH - 10, { color: 'emberGlow' });
  }
  present();
  requestAnimationFrame(frame);
}
let crash = '';
function drawFrame(now: number): void {
  if (screen === 'match' && match) match.update(now);
  if (screen === 'run' && run) run.update(now);
  const wide = isWide();
  setHW(wide ? FW : BASE_W);
  const g = wide ? hi : mid;
  if (screen === 'match' && match) {
    match.draw(g, t);
    route();
  } else if (screen === 'run' && run) {
    run.draw(g, t);
    route();
  } else if (screen === 'decks' && builder) {
    builder.draw(g, t);
    route();
  } else if (screen === 'setup' && setup) setup.draw(g);
  else {
    if (screen === 'gallery') gallery.draw(lo, t);
    else {
      scene.draw(lo, t);
      title.draw(lo, t, scene.emblem);
    }
    if (failed) drawText(lo, 'ART FAILED TO LOAD', 4, 4, { color: 'emberGlow', outline: 'ink' });
    midCtx!.imageSmoothingEnabled = false;
    midCtx!.drawImage(loCanvas, 0, 0, BASE_W, HH);
  }
  if (!wide) compose();
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
  run: () => {
    if (!run) return null;
    const common = { phase: run.run?.phase ?? 'pick', crystal: run.run?.crystal, deck: run.run?.deck.length, inBattle: !!run.match };
    if (run instanceof ExpeditionScreen) return { mode: 'expedition', expedition: run.run?.expedition, hero: run.run?.hero, ...common };
    return { mode: 'campaign', act: run.run?.act, ...common };
  },
  ui: () => (match ? match.debug() : null),
  match: () => (match ? { phase: match.session.state.phase, round: match.session.state.round, priority: match.session.state.priority, winner: match.session.state.winner, actions: match.session.actions.length } : null),
};
