// Art detail (PLAN D22): FULL DETAIL draws the rendered art from public/art/hd/ at the screen's own resolution; PIXEL
// draws the 16-bit snapped files. Windows, type and everything drawn in code are the same in both. The choice is kept
// in this browser. Every picture keeps the logical size of its pixel file, so layouts do not change.
import type { Gfx } from './gfx';

const KEY = 'magitek-wars.art';
let detail = true;
try {
  detail = localStorage.getItem(KEY) !== 'pixel';
} catch {
  /* no storage: full detail */
}
const listeners: (() => void)[] = [];

export function isDetail(): boolean {
  return detail;
}

export function setDetail(on: boolean): void {
  if (on === detail) return;
  detail = on;
  try {
    localStorage.setItem(KEY, on ? 'detail' : 'pixel');
  } catch {
    /* not kept */
  }
  for (const f of listeners) f();
}

/** Called when the choice changes (screens that load their art up front reload it). */
export function onDetailChange(f: () => void): void {
  listeners.push(f);
}

/**
 * The full-detail file for a pixel art path, and how many times larger it is than that pixel file
 * (tools/art/build-detail.mjs). Throws for a path with no full-detail file: no silent fallback.
 */
export function detailOf(path: string): { path: string; factor: number } {
  const m = /^art\/(cards\/x2|cards|portraits|fields|emblems|title)\/([^/]+)\.png$/.exec(path);
  if (!m) throw new Error(`detail: no full-detail art for ${path}`);
  const [, folder, file] = m;
  const factor = folder === 'cards/x2' ? 3 : folder === 'fields' || (folder === 'title' && file === 'backdrop') ? 4 : 6;
  return { path: `art/hd/${folder === 'cards/x2' ? 'cards' : folder}/${file}.webp`, factor };
}

/** Logical size of a full-detail picture (its pixel file's size); pixel pictures are their own size. */
const logical = new WeakMap<object, { w: number; h: number }>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`art: could not load ${src}`));
    img.src = src;
  });
}

/** Load a picture by its pixel art path (relative to the site base), in the current detail mode. */
export async function loadArt(path: string): Promise<HTMLImageElement> {
  const base = import.meta.env.BASE_URL;
  if (!detail) return loadImage(`${base}${path}`);
  const d = detailOf(path);
  const img = await loadImage(`${base}${d.path}`);
  logical.set(img, { w: img.naturalWidth / d.factor, h: img.naturalHeight / d.factor });
  return img;
}

/** Logical width and height of a picture. */
export function picSize(img: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  return logical.get(img) ?? { w: img.width, h: img.height };
}

/**
 * Draw a picture at logical (x, y), by default at its logical size. A full-detail picture is drawn smoothly; a pixel
 * picture with hard edges. `src` crops in logical pixels of the picture.
 */
export function drawPic(
  g: Gfx, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w?: number, h?: number,
  src?: { x: number; y: number; w: number; h: number },
): void {
  const size = picSize(img);
  const smooth = logical.has(img);
  const ctx = g.ctx;
  ctx.imageSmoothingEnabled = smooth;
  if (smooth) ctx.imageSmoothingQuality = 'high';
  const dw = w ?? size.w, dh = h ?? size.h;
  if (src) {
    const k = img.width / size.w;
    ctx.drawImage(img, src.x * k, src.y * k, src.w * k, src.h * k, x, y, dw, dh);
  } else ctx.drawImage(img, x, y, dw, dh);
  ctx.imageSmoothingEnabled = false;
}
