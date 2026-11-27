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

export async function snapSprite(inFile, outFile, height, colours = 32, flip = false) {
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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

if (process.argv[1] && process.argv[1].endsWith('snap.mjs')) {
  const [kind, i, o, a, b, c] = process.argv.slice(2);
  if (kind === 'scene') console.log(JSON.stringify(await snapScene(i, o, Number(a), Number(b), Number(c ?? 96))));
  else if (kind === 'sprite') console.log(JSON.stringify(await snapSprite(i, o, Number(a), Number(b ?? 32), c === 'flip')));
  else throw new Error('snap: scene or sprite');
}
