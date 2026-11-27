// Cut a sprite sheet (flat ground, two rows of nine) into one 512x512 training image per sprite.
// Slivers of neighbouring sprites that poke into a cell are painted out with the ground colour.
// usage: node cut.mjs <sheet> <prefix> <outdir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [sheet, prefix, outdir] = process.argv.slice(2);
const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
const border = [];
for (let x = 0; x < W; x += 4) border.push(px(x, 2), px(x, H - 3));
const med = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
const fg = (x, y) => { const p = px(x, y); return Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) > 60; };
const rowSum = Array.from({ length: H }, (_, y) => { let s = 0; for (let x = 0; x < W; x++) s += fg(x, y); return s; });
const bands = [];
let start = -1;
for (let y = 0; y < H; y++) {
  const on = rowSum[y] > 2;
  if (on && start < 0) start = y;
  if ((!on || y === H - 1) && start >= 0) { if (y - start > 40) bands.push([start, y]); start = -1; }
}
const N = 9, S = 512, M = 10;
let n = 0;
for (const [y0, y1] of bands) {
  for (let i = 0; i < N; i++) {
    const cx0 = Math.floor((i * W) / N), cx1 = Math.floor(((i + 1) * W) / N) - 1;
    const cw = cx1 - cx0 + 1, ch = y1 - y0;
    const lab = new Int32Array(cw * ch).fill(-1);
    const comps = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (lab[y * cw + x] !== -1 || !fg(cx0 + x, y0 + y)) continue;
      const id = comps.length, st = [[x, y]], c = { area: 0, edge: false, x0: x, x1: x, y0: y, y1: y };
      lab[y * cw + x] = id;
      while (st.length) {
        const [a, b] = st.pop();
        c.area++; if (a === 0 || a === cw - 1) c.edge = true;
        c.x0 = Math.min(c.x0, a); c.x1 = Math.max(c.x1, a); c.y0 = Math.min(c.y0, b); c.y1 = Math.max(c.y1, b);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const u = a + dx, v = b + dy;
          if (u < 0 || v < 0 || u >= cw || v >= ch || lab[v * cw + u] !== -1 || !fg(cx0 + u, y0 + v)) continue;
          lab[v * cw + u] = id; st.push([u, v]);
        }
      }
      comps.push(c);
    }
    if (!comps.length) continue;
    const big = Math.max(...comps.map((c) => c.area));
    const keep = comps.map((c) => c.area >= 20 && !(c.edge && c.area < big * 0.25));
    let bx0 = cw, bx1 = 0, by0 = ch, by1 = 0;
    comps.forEach((c, k) => { if (keep[k]) { bx0 = Math.min(bx0, c.x0); bx1 = Math.max(bx1, c.x1); by0 = Math.min(by0, c.y0); by1 = Math.max(by1, c.y1); } });
    bx0 = Math.max(0, bx0 - M); by0 = Math.max(0, by0 - M); bx1 = Math.min(cw - 1, bx1 + M); by1 = Math.min(ch - 1, by1 + M);
    const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
    const out = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = lab[(by0 + y) * cw + bx0 + x];
      const p = l >= 0 && !keep[l] ? med : px(cx0 + bx0 + x, y0 + by0 + y);
      out.set(p, (y * w + x) * 3);
    }
    const k = Math.max(1, Math.floor(Math.min((S * 0.86) / w, (S * 0.86) / h)));
    const crop = await sharp(out, { raw: { width: w, height: h, channels: 3 } }).resize(w * k, h * k, { kernel: 'nearest' }).png().toBuffer();
    const name = `${prefix}-${String(++n).padStart(2, '0')}`;
    await sharp({ create: { width: S, height: S, channels: 3, background: { r: med[0], g: med[1], b: med[2] } } })
      .composite([{ input: crop, left: Math.round((S - w * k) / 2), top: Math.round((S - h * k) / 2) }]).png().toFile(`${outdir}/${name}.png`);
  }
}
console.log(sheet, 'ground', med, 'sprites', n);
