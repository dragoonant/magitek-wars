import './style.css';
import { Gfx, H, W } from './gfx';
import { Scene } from './scene';
import { Title } from './title';

const SAVE_KEY = 'magitek-wars.save';

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
  if (['ArrowUp', 'ArrowDown', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
  title.key(e.code);
});
canvas.addEventListener('pointermove', (e) => title.pointerMove(...logical(e)));
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  title.pointerDown(...logical(e));
});
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
    scene.step(t);
    acc -= STEP;
  }
  ctx!.drawImage(scene.bg, 0, 0);
  scene.draw(g, t);
  title.draw(g, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only hook for end-to-end checks.
(window as unknown as { __mkw: object }).__mkw = { mode: () => title.mode.kind, cursor: () => title.cursor };
