import './style.css';
import { drawText } from './font';
import { Gfx, H, W } from './gfx';
import { Scene } from './scene';
import { Title } from './title';
import { Gallery } from './gallery';
import { SAVE_KEY } from './engine/save';

function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

const canvas = document.getElementById('screen');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('main: no #screen canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('main: no 2d context');
ctx.imageSmoothingEnabled = false;
const g = new Gfx(ctx);
const scene = new Scene();
const title = new Title(hasSave());
const gallery = new Gallery();
let screen: 'title' | 'gallery' = 'title';
let failed = '';
Promise.all([scene.load(), title.load(), gallery.load()]).catch((e: unknown) => {
  failed = e instanceof Error ? e.message : String(e);
  console.error(e);
});

/** Integer scale only (ART-STYLE section 1). */
function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  canvas!.style.width = `${W * s}px`;
  canvas!.style.height = `${H * s}px`;
}
window.addEventListener('resize', fit);
fit();

function logical(e: PointerEvent): [number, number] {
  const r = canvas!.getBoundingClientRect();
  return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)];
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab', 'PageUp', 'PageDown'].includes(e.code)) e.preventDefault();
  if (screen === 'gallery') gallery.key(e.code);
  else title.key(e.code);
  route();
});
canvas.addEventListener('pointermove', (e) => {
  if (screen === 'title') title.pointerMove(...logical(e));
});
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (screen === 'gallery') gallery.pointerDown(...logical(e));
  else title.pointerDown(...logical(e));
  route();
});
/** Move between screens when one asks to. */
function route(): void {
  if (title.open === 'cards') {
    title.open = null;
    screen = 'gallery';
  }
  if (gallery.exit) {
    gallery.exit = false;
    screen = 'title';
  }
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
  if (screen === 'gallery') gallery.draw(g, t);
  else {
    scene.draw(g, t);
    title.draw(g, t, scene.emblem);
  }
  if (failed) drawText(g, 'ART FAILED TO LOAD', 4, 4, { color: 'emberGlow', outline: 'ink' });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only hook for end-to-end checks.
(window as unknown as { __mkw: object }).__mkw = { mode: () => title.mode.kind, cursor: () => title.cursor, ready: () => scene.ready, failed: () => failed, screen: () => screen, gallery: () => ({ faction: gallery.faction, index: gallery.index, view: gallery.view.kind }) };
