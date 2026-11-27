// Labelled contact sheet, images fitted (not squashed) into tiles.
// usage: node grid2.mjs out.png cols tileW tileH files...
import { createRequire } from 'node:module';
import { basename } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [out, cols, tw, th, ...files] = process.argv.slice(2);
const C = +cols, TW = +tw, TH = +th, L = 18, R = Math.ceil(files.length / C);
const parts = [];
for (const [i, f] of files.entries()) {
  const img = await sharp(f).resize(TW, TH, { fit: 'contain', background: '#000', kernel: 'nearest' }).png().toBuffer();
  const x = (i % C) * TW, y = Math.floor(i / C) * (TH + L);
  const label = Buffer.from(`<svg width="${TW}" height="${L}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="13" font-family="monospace" font-size="13" fill="#ddd">${basename(f, '.png')}</text></svg>`);
  parts.push({ input: label, left: x, top: y }, { input: img, left: x, top: y + L });
}
await sharp({ create: { width: C * TW, height: R * (TH + L), channels: 3, background: '#000' } }).composite(parts).png().toFile(out);
