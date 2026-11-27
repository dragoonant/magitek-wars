// Card art and emblems for the match, loaded on demand in the current detail mode (PLAN D22). A missing file is
// remembered and reported as such. Draw them with drawPic (src/detail.ts), which keeps the pixel file's size.
import { isDetail, loadArt } from '../detail';

const cache = new Map<string, HTMLImageElement | 'loading' | 'missing'>();

const keyOf = (path: string): string => `${isDetail() ? 'hd' : 'px'}:${path}`;

function get(path: string): HTMLImageElement | null {
  const key = keyOf(path);
  const have = cache.get(key);
  if (have instanceof HTMLImageElement) return have;
  if (have) return null;
  cache.set(key, 'loading');
  loadArt(path).then((img) => cache.set(key, img), () => cache.set(key, 'missing'));
  return null;
}

const cardPath = (id: string, ascended: boolean, x2: boolean): string =>
  `art/cards/${x2 ? 'x2/' : ''}${id}${ascended ? '.asc' : ''}.png`;

/** Card art: 64 x 48, or 128 x 96 with x2. `ascended` picks the hero's ascended art. */
export function cardArt(id: string, ascended = false, x2 = false): HTMLImageElement | null {
  return get(cardPath(id, ascended, x2));
}

export function isMissing(id: string, ascended = false, x2 = false): boolean {
  return cache.get(keyOf(cardPath(id, ascended, x2))) === 'missing';
}

/** Hero portrait, 48 x 48 (ART-STYLE section 5); `ascended` picks the ascended face. */
export function portrait(id: string, ascended = false): HTMLImageElement | null {
  return get(`art/portraits/${id}${ascended ? '.asc' : ''}.png`);
}

export function emblem(key: string): HTMLImageElement | null {
  return get(`art/emblems/${key}.png`);
}

export function field(key: string): HTMLImageElement | null {
  return get(`art/fields/${key}.png`);
}
