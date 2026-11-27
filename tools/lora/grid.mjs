// usage: node grid.mjs out.png cols tile files...
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [out, cols, tile, ...files] = process.argv.slice(2);
const C = +cols, T = +tile, R = Math.ceil(files.length / C);
const tiles = await Promise.all(files.map((f) => sharp(f).resize(T, T).png().toBuffer()));
await sharp({ create: { width: C * T, height: R * T, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % C) * T, top: Math.floor(i / C) * T }))).png().toFile(out);
