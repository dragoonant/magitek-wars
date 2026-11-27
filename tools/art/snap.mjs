// Turn LoRA renders into game pixels (ART-STYLE section 9).
//   scene:  node tools/art/snap.mjs scene  <in.png> <out.png> <w> <h> [colours=96]
//           the whole render becomes exactly w x h logical pixels (most common colour of each cell).
//   sprite: node tools/art/snap.mjs sprite <in.png> <out.png> <height> [colours=32] [flip]
//           the flat ground is removed (flood fill from the border), the figure is cropped and reduced so it
//           stands <height> logical pixels tall, with hard 1-bit transparency.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const key = (d, i) => ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);

/** Most common colour among the given pixel indices (5-bit buckets, the bucket's first pixel wins). */
function mode(d, idx) {
  const votes = new Map();
  let best = -1, bestN = 0;
  for (const i of idx) {
    const k = key(d, i), n = (votes.get(k) ?? 0) + 1;
    votes.set(k, n);
    if (n > bestN) { bestN = n; best = i; }
  }
  return best;
}

async function quantize(raw, w, h, channels, colours) {
  return sharp(raw, { raw: { width: w, height: h, channels } }).png({ palette: true, colours, dither: 0 }).toBuffer();
}

export async function snapScene(inFile, outFile, w, h, colours = 96) {
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const kx = info.width / w, ky = info.height / h;
  const out = Buffer.alloc(w * h * 3);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const x0 = Math.round(cx * kx), x1 = Math.round((cx + 1) * kx), y0 = Math.round(cy * ky), y1 = Math.round((cy + 1) * ky);
    const idx = [];
    const m = x1 - x0 >= 4 ? 1 : 0;
    for (let y = y0 + m; y < y1 - m; y++) for (let x = x0 + m; x < x1 - m; x++) idx.push((y * info.width + x) * 3);
    const i = mode(data, idx);
    out.set([data[i], data[i + 1], data[i + 2]], (cy * w + cx) * 3);
  }
  await sharp(await quantize(out, w, h, 3, colours)).png().toFile(outFile);
  return { w, h };
}

/** The figure in a sprite render: ground-coloured pixels connected to the border are background. */
function figure(data, info, inFile) {
  const W = info.width, H = info.height;
  const at = (x, y) => (y * W + x) * 3;
  const border = [];
  for (let x = 0; x < W; x += 3) border.push(at(x, 0), at(x, H - 1));
  for (let y = 0; y < H; y += 3) border.push(at(0, y), at(W - 1, y));
  const bg = [0, 1, 2].map((c) => border.map((i) => data[i + c]).sort((a, b) => a - b)[border.length >> 1]);
  const near = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) < 46;
  // Background = ground-coloured pixels connected to the border.
  const isBg = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) st.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) st.push([0, y], [W - 1, y]);
  while (st.length) {
    const [x, y] = st.pop();
    if (x < 0 || y < 0 || x >= W || y >= H || isBg[y * W + x] || !near(at(x, y))) continue;
    isBg[y * W + x] = 1;
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isBg[y * W + x]) {
    bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
  }
  if (bx1 < 0) throw new Error('snap: no figure in ' + inFile);
  return { isBg, bx0, bx1, by0, by1 };
}

export async function snapSprite(inFile, outFile, height, colours = 32, flip = false) {
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const at = (x, y) => (y * W + x) * 3;
  const { isBg, bx0, bx1, by0, by1 } = figure(data, info, inFile);
  const k = (by1 - by0 + 1) / height;
  const w = Math.ceil((bx1 - bx0 + 1) / k), h = height;
  const out = Buffer.alloc(w * h * 4);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const x0 = bx0 + Math.round(cx * k), x1 = Math.min(W, bx0 + Math.round((cx + 1) * k));
    const y0 = by0 + Math.round(cy * k), y1 = Math.min(H, by0 + Math.round((cy + 1) * k));
    const fg = [];
    let total = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { total++; if (!isBg[y * W + x]) fg.push(at(x, y)); }
    if (total === 0 || fg.length / total < 0.5) continue;
    const i = mode(data, fg);
    const ox = flip ? w - 1 - cx : cx;
    out.set([data[i], data[i + 1], data[i + 2], 255], (cy * w + ox) * 4);
  }
  await sharp(await quantize(out, w, h, 4, colours)).png().toFile(outFile);
  return { w, h, cell: +k.toFixed(2) };
}

/**
 * Full-detail art (PLAN D22): the same figure as snapSprite, cut out with the same mask and framed to exactly
 * factor x the snapped sprite's size, smoothly resized, with soft transparency. The game draws it into the snapped
 * sprite's logical rectangle.
 */
export async function detailSprite(inFile, outFile, height, factor, flip = false) {
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const { isBg, bx0, bx1, by0, by1 } = figure(data, info, inFile);
  const k = (by1 - by0 + 1) / height;
  const w = Math.ceil((bx1 - bx0 + 1) / k), h = height;
  const rw = Math.round(w * k), rh = by1 - by0 + 1;
  const out = Buffer.alloc(rw * rh * 4);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const sx = bx0 + x, sy = by0 + y;
    if (sx >= W || isBg[sy * W + sx]) continue;
    const i = (sy * W + sx) * 3;
    out.set([data[i], data[i + 1], data[i + 2], 255], (y * rw + x) * 4);
  }
  let img = sharp(out, { raw: { width: rw, height: rh, channels: 4 } }).resize(w * factor, h * factor, { fit: 'fill', kernel: 'lanczos3' });
  if (flip) img = img.flop();
  await img.webp({ quality: 88, alphaQuality: 90 }).toFile(outFile);
  return { w, h };
}

/** Full-detail art for a scene: the whole render resized to exactly w x h (it is drawn into w / factor logical pixels). */
export async function detailScene(inFile, outFile, w, h, extract) {
  let img = sharp(inFile).removeAlpha();
  if (extract) img = img.extract(extract);
  await img.resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 84 }).toFile(outFile);
}

if (process.argv[1] && process.argv[1].endsWith('snap.mjs')) {
  const [kind, i, o, a, b, c] = process.argv.slice(2);
  if (kind === 'scene') console.log(JSON.stringify(await snapScene(i, o, Number(a), Number(b), Number(c ?? 96))));
  else if (kind === 'sprite') console.log(JSON.stringify(await snapSprite(i, o, Number(a), Number(b ?? 32), c === 'flip')));
  else throw new Error('snap: scene or sprite');
}
