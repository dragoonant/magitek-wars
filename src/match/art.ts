// Card art and emblems for the match, loaded on demand. A missing file is remembered and reported as such.
import { loadImage } from '../scene';

const BASE = import.meta.env.BASE_URL;
const cache = new Map<string, HTMLImageElement | 'loading' | 'missing'>();

function get(path: string): HTMLImageElement | null {
  const have = cache.get(path);
  if (have instanceof HTMLImageElement) return have;
  if (have) return null;
  cache.set(path, 'loading');
  loadImage(`${BASE}${path}`).then((img) => cache.set(path, img), () => cache.set(path, 'missing'));
  return null;
}

/** Card art: 64 x 48, or 128 x 96 with x2. `ascended` picks the hero's ascended art. */
export function cardArt(id: string, ascended = false, x2 = false): HTMLImageElement | null {
  return get(`art/cards/${x2 ? 'x2/' : ''}${id}${ascended ? '.asc' : ''}.png`);
}

export function isMissing(id: string, ascended = false, x2 = false): boolean {
  return cache.get(`art/cards/${x2 ? 'x2/' : ''}${id}${ascended ? '.asc' : ''}.png`) === 'missing';
}

export function emblem(key: string): HTMLImageElement | null {
  return get(`art/emblems/${key}.png`);
}

export function field(key: string): HTMLImageElement | null {
  return get(`art/fields/${key}.png`);
}
