// PLAN D22: every pixel art file has a full-detail file that is an exact multiple of its size, so the game can draw
// either into the same logical rectangle.
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { detailOf } from '../src/detail';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as (f: string) => { metadata(): Promise<{ width?: number; height?: number }> };

const FOLDERS = ['cards', 'cards/x2', 'portraits', 'fields', 'emblems', 'title'];

describe('full-detail art (PLAN D22)', () => {
  it('maps pixel paths to full-detail files with their scale', () => {
    expect(detailOf('art/cards/storm-jax.png')).toEqual({ path: 'art/hd/cards/storm-jax.webp', factor: 6 });
    expect(detailOf('art/cards/x2/storm-jax.asc.png')).toEqual({ path: 'art/hd/cards/storm-jax.asc.webp', factor: 3 });
    expect(detailOf('art/fields/vaskor.png')).toEqual({ path: 'art/hd/fields/vaskor.webp', factor: 4 });
    expect(detailOf('art/title/backdrop.png').factor).toBe(4);
    expect(detailOf('art/title/wren.png').factor).toBe(6);
  });

  it('refuses a path it has no full-detail file for', () => {
    expect(() => detailOf('art/other/thing.png')).toThrow(/no full-detail art/);
  });

  it('has a full-detail file at an exact multiple of every pixel file', async () => {
    let n = 0;
    for (const folder of FOLDERS) {
      for (const f of readdirSync(`public/art/${folder}`).filter((x) => x.endsWith('.png'))) {
        const path = `art/${folder}/${f}`;
        const d = detailOf(path);
        const px = await sharp(`public/${path}`).metadata();
        const hd = await sharp(`public/${d.path}`).metadata();
        expect([hd.width, hd.height], path).toEqual([px.width! * d.factor, px.height! * d.factor]);
        n++;
      }
    }
    expect(n).toBeGreaterThan(700);
  }, 60000);
});
