import '@fontsource/cinzel/700.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/700.css';
import type { Gfx } from './gfx';
import { PALETTE, rgba, type Ink } from './palette';

// Type (PLAN D25): real fonts drawn at the screen's own resolution, replacing the 5x7 bitmap font. Cinzel (display:
// titles, headings, buttons) and Fira Sans (body: card text, the log, descriptions), both SIL OFL 1.1, bundled
// with the game. The calls keep the old shape: (x, y) is the top of a capital letter, `scale` 1 is the body size
// (capitals 7 logical px apart from their line, lines 9 to 10 px apart), 2 and 3 are headings.

export type Face = 'body' | 'bold' | 'display';

/** Logical font size per unit of scale, and how far below y the baseline sits. */
const SIZE: Record<Face, number> = { body: 9.4, bold: 9.4, display: 8.6 };
const CAP = 7;

export function fontOf(face: Face, scale: number): string {
  const px = (face === 'display' && scale >= 2 ? 10 : SIZE[face]) * scale;
  if (face === 'display') return `700 ${px}px Cinzel, Georgia, serif`;
  return `${face === 'bold' ? 700 : 500} ${px}px "Fira Sans", "Segoe UI", sans-serif`;
}

/** Headings (scale 2+) are Cinzel; scale 1 is the body face unless the style names one. */
function faceOf(style: { scale?: number; face?: Face } | undefined): Face {
  return style?.face ?? ((style?.scale ?? 1) >= 2 ? 'display' : 'body');
}

/** Load the fonts before the first frame, so widths measured for layout are the real ones. */
export async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([fontOf('display', 1), fontOf('body', 1), fontOf('bold', 1)].map((f) => document.fonts.load(f, 'Aa')));
  widths.clear();
}

/** Every printable character can be drawn (a real font has them all); control characters cannot. */
export function canDraw(text: string): boolean {
  return !/[\u0000-\u001f\u007f]/.test(text);
}

// Widths come from the browser's own measurement. Outside a browser (the unit tests) a fixed estimate stands in:
// half an em per character, which is wider than the real body face, so layouts checked there are never too tight.
let probe: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
function measure(text: string, face: Face, scale: number): number {
  if (probe === undefined) probe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!probe) return text.length * (face === 'display' && scale >= 2 ? 10 : SIZE[face]) * scale * (face === 'display' ? 0.75 : 0.5);
  const font = fontOf(face, scale);
  const key = `${font}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    probe.font = font;
    w = probe.measureText(text).width;
    if (widths.size > 4000) widths.clear();
    widths.set(key, w);
  }
  return w;
}

export function textWidth(text: string, scale = 1, face?: Face): number {
  return text.length === 0 ? 0 : measure(text, faceOf({ scale, face }), scale);
}

export interface TextStyle {
  color: Ink;
  scale?: number;
  face?: Face;
  /** A colour per height band 0 (top) to 6 (baseline), for wordmarks: drawn as a gradient. Overrides `color`. */
  rowColor?: (row: number) => Ink;
  /** A dark edge around the letters, for text over pictures. */
  outline?: Ink;
  /** A soft drop shadow. */
  shadow?: Ink;
  /** A soft glow in this colour. */
  glow?: Ink;
  alpha?: number;
}

/** Draw text; (x, y) is the top of the capitals. */
export function drawText(g: Gfx, text: string, x: number, y: number, style: TextStyle): void {
  if (!text) return;
  const s = style.scale ?? 1;
  const face = faceOf(style);
  const ctx = g.ctx;
  ctx.save();
  ctx.font = fontOf(face, s);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (style.alpha !== undefined) ctx.globalAlpha = style.alpha;
  const by = y + CAP * s;
  let fill: string | CanvasGradient = PALETTE[style.color];
  if (style.rowColor) {
    const gr = ctx.createLinearGradient(0, y, 0, by);
    for (let r = 0; r <= 6; r++) gr.addColorStop(r / 6, PALETTE[style.rowColor(r)]);
    fill = gr;
  }
  if (style.shadow) {
    ctx.shadowColor = rgba(style.shadow, 0.85);
    ctx.shadowBlur = 2.5 * s;
    ctx.shadowOffsetY = 1 * s;
  }
  if (style.outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 * Math.min(s, 2);
    ctx.strokeStyle = rgba(style.outline, 0.9);
    ctx.strokeText(text, x, by);
    ctx.shadowColor = 'transparent';
  }
  if (style.glow) {
    ctx.shadowColor = rgba(style.glow, 0.9);
    ctx.shadowBlur = 4 * s;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, by);
  ctx.restore();
}

/** Draw text centred on x. */
export function drawTextCentred(g: Gfx, text: string, cx: number, y: number, style: TextStyle): void {
  drawText(g, text, cx - textWidth(text, style.scale ?? 1, style.face) / 2, y, style);
}

/** Draw text ending at x. */
export function drawTextRight(g: Gfx, text: string, rx: number, y: number, style: TextStyle): void {
  drawText(g, text, rx - textWidth(text, style.scale ?? 1, style.face), y, style);
}

/**
 * Word-wrap to lines no wider than `maxW` logical px in a face. A word wider than the line is split by characters
 * (never dropped).
 */
export function wrapPx(text: string, maxW: number, scale = 1, face?: Face): string[] {
  const out: string[] = [];
  let line = '';
  const fits = (s: string) => textWidth(s, scale, face) <= maxW;
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (!fits(word)) {
      if (line) { out.push(line); line = ''; }
      let n = word.length - 1;
      while (n > 1 && !fits(word.slice(0, n))) n--;
      out.push(word.slice(0, n));
      word = word.slice(n);
    }
    if (!line) line = word;
    else if (fits(`${line} ${word}`)) line += ` ${word}`;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

/** Cut text with an ellipsis so it fits `maxW`. */
export function fitText(text: string, maxW: number, scale = 1, face?: Face): string {
  if (textWidth(text, scale, face) <= maxW) return text;
  let n = text.length;
  while (n > 1 && textWidth(`${text.slice(0, n)}…`, scale, face) > maxW) n--;
  return `${text.slice(0, n).trimEnd()}…`;
}
