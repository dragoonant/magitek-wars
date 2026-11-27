// Snap a render to a true pixel grid: find the pitch and phase of its pseudo-pixels on each axis, take the most
// common colour in each cell, cut to at most N colours without dithering, and enlarge back with nearest neighbour.
// usage: node clean.mjs <in.png> <out.png> [colours=48] [force pitch]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

// Colour edges along one axis: list of positions (between pixel p-1 and p) where the colour jumps.
function edges(data, W, H, horizontal) {
  const at = (x, y) => (y * W + x) * 3;
  const out = [];
  const [L, M] = horizontal ? [H, W] : [W, H];
  for (let a = 0; a < L; a += 2) for (let b = 1; b < M; b++) {
    const i = horizontal ? at(b, a) : at(a, b), j = horizontal ? at(b - 1, a) : at(a, b - 1);
    if (Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]), Math.abs(data[i + 2] - data[j + 2])) > 28) out.push(b);
  }
  return out;
}
// Pitch k and phase p such that edges sit on p + m*k; score = share on the grid times k (1 = chance).
function fit(pos, lo = 2.5, hi = 9, force = 0) {
  let best = { k: 4, p: 0, s: -1 };
  for (let k = force || lo; k <= (force || hi) + 1e-9; k += 0.05) {
    for (let p = 0; p < k; p += 0.25) {
      let on = 0;
      for (const x of pos) { const r = (((x - p) % k) + k) % k; if (r < 0.5 || r > k - 0.5) on++; }
      const s = (on / pos.length) * k - 0.08 * k; // ties go to the finer grid
      if (s > best.s) best = { k, p, s };
    }
  }
  return best;
}

export async function clean(inFile, outFile, colours = 48, force = 0) {
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const sample = (a) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / 6000)) === 0);
  const fx = fit(sample(edges(data, W, H, true)), 2.5, 9, force);
  const fy = fit(sample(edges(data, W, H, false)), 2.5, 9, force || 0);
  const cols = Math.floor((W - fx.p) / fx.k), rows = Math.floor((H - fy.p) / fy.k);
  const small = Buffer.alloc(cols * rows * 3);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x0 = Math.round(fx.p + cx * fx.k), x1 = Math.round(fx.p + (cx + 1) * fx.k);
    const y0 = Math.round(fy.p + cy * fy.k), y1 = Math.round(fy.p + (cy + 1) * fy.k);
    const m = x1 - x0 >= 4 ? 1 : 0, n = y1 - y0 >= 4 ? 1 : 0; // inner part of the cell only
    const votes = new Map();
    let bestN = 0, bestPix = (y0 * W + x0) * 3;
    for (let y = y0 + n; y < y1 - n; y++) for (let x = x0 + m; x < x1 - m; x++) {
      const i = (y * W + x) * 3;
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      const c = (votes.get(key) ?? 0) + 1;
      votes.set(key, c);
      if (c > bestN) { bestN = c; bestPix = i; }
    }
    small.set([data[bestPix], data[bestPix + 1], data[bestPix + 2]], (cy * cols + cx) * 3);
  }
  const quant = await sharp(small, { raw: { width: cols, height: rows, channels: 3 } })
    .png({ palette: true, colours, dither: 0 }).toBuffer();
  const s = Math.max(1, Math.round((fx.k + fy.k) / 2));
  await sharp(quant).resize(cols * s, rows * s, { kernel: 'nearest' }).png().toFile(outFile);
  return { kx: +fx.k.toFixed(2), ky: +fy.k.toFixed(2), sx: +fx.s.toFixed(2), sy: +fy.s.toFixed(2), cols, rows, scale: s };
}

if (process.argv[1] && process.argv[1].endsWith('clean.mjs')) {
  const [i, o, c, f] = process.argv.slice(2);
  console.log(JSON.stringify(await clean(i, o, Number(c ?? 48), Number(f ?? 0))));
}
