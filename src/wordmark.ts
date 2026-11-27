import '@fontsource/cinzel/700.css';
import { PALETTE, type Ink } from './palette';

// The wordmark (PLAN D13): Cinzel Bold (SIL OFL 1.1) drawn large off screen, reduced to whole pixels by coverage,
// then coloured in code with the house brass ramp, a 1 px ink outline and a 1 px ember shadow.

const SS = 8; // supersampling per logical pixel

/** Brass ramp from the top of the letters to the baseline. */
function rampAt(f: number): Ink {
  if (f < 0.16) return 'brassGlint';
  if (f < 0.42) return 'brassLight';
  if (f < 0.72) return 'brass';
  return 'brassDark';
}

export async function buildWordmark(text: string, capPx: number): Promise<HTMLCanvasElement> {
  // Cinzel caps are about 0.7 em tall.
  const fontPx = Math.round((capPx / 0.7) * SS);
  const font = `700 ${fontPx}px Cinzel`;
  await document.fonts.load(font, text);
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('wordmark: no 2d context');
  probe.font = font;
  probe.letterSpacing = `${SS}px`;
  const m = probe.measureText(text);
  const w = Math.ceil(m.width / SS) + 4, h = capPx + 6;
  const big = document.createElement('canvas');
  big.width = w * SS;
  big.height = h * SS;
  const bx = big.getContext('2d', { willReadFrequently: true });
  if (!bx) throw new Error('wordmark: no 2d context');
  bx.font = font;
  bx.letterSpacing = `${SS}px`;
  bx.fillStyle = '#fff';
  bx.textBaseline = 'alphabetic';
  bx.fillText(text, 2 * SS, (2 + capPx) * SS);
  const a = bx.getImageData(0, 0, big.width, big.height).data;
  const on = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) s += a[(((y * SS + j) * big.width) + x * SS + i) * 4 + 3];
    on[y * w + x] = s / (SS * SS * 255) >= 0.45 ? 1 : 0;
  }
  const out = document.createElement('canvas');
  out.width = w + 1;
  out.height = h + 1;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('wordmark: no 2d context');
  const put = (x: number, y: number, c: Ink) => { ctx.fillStyle = PALETTE[c]; ctx.fillRect(x, y, 1, 1); };
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && on[y * w + x] === 1;
  // shadow, then outline, then fill
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) put(x + 1, y + 1, 'emberNight');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y)) continue;
    let edge = false;
    for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j)) { edge = true; break; }
    if (edge) put(x, y, 'ink');
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    const f = (y - 2) / capPx;
    // a lit top edge on every stroke
    put(x, y, !at(x, y - 1) && f < 0.8 ? 'brassGlint' : rampAt(f));
  }
  return out;
}
