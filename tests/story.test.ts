import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../src/data/cards/index';
import { canDraw, wrapPx } from '../src/font';
import { FACTIONS } from '../src/data/factions';
import { Attract, TEXT_W, pageFrames } from '../src/attract';
import { CLOSING_PAGE, NATIONS, WORLD_PAGES, attractPages } from '../src/story';
import { ATTRACT } from '../src/strings';

// Outside a browser textWidth is a deliberately wide estimate (half an em a character), so these fits are cautious.
const ENGINE = ['coil', 'ember', 'prism', 'storm', 'tide', 'under'];

describe('spec 20 R-R13: each nation’s story', () => {
  it('every nation has a lead, a prologue, a line for each of the three acts and an ending', () => {
    expect(Object.keys(NATIONS).sort()).toEqual(ENGINE);
    for (const [f, n] of Object.entries(NATIONS)) {
      expect(n.prologue.length, f).toBeGreaterThanOrEqual(2);
      expect(n.acts, f).toHaveLength(3);
      for (const s of [n.lead, n.title, ...n.who, ...n.prologue, ...n.acts, n.ending]) {
        expect(s.trim().length, f).toBeGreaterThan(0);
        expect(canDraw(s), s).toBe(true);
      }
    }
  });

  it('a prologue fits between its heading and the buttons (168 px at 11.5 a line)', () => {
    for (const [f, n] of Object.entries(NATIONS)) {
      const h = n.prologue.reduce((y, p) => y + wrapPx(p, 440).length * 11.5 + 5, 0);
      expect(h, f).toBeLessThanOrEqual(168);
    }
  });

  it('an act line fits the act card (3 lines) and an ending fits the end panel (6 lines)', () => {
    for (const n of Object.values(NATIONS)) {
      for (const a of n.acts) expect(wrapPx(a, 380, 1.1).length, a).toBeLessThanOrEqual(3);
      expect(wrapPx(n.ending, 330).length, n.ending).toBeLessThanOrEqual(6);
    }
  });
});

describe('PLAN D27: the attract mode', () => {
  const pages = attractPages();

  it('introduces the world, then every nation once in the title menu’s order, then closes', () => {
    expect(pages.slice(0, WORLD_PAGES.length)).toEqual(WORLD_PAGES);
    expect(pages.filter((p) => p.nation).map((p) => p.nation)).toEqual(FACTIONS.map((f) => f.engine));
    expect(pages[pages.length - 1]).toBe(CLOSING_PAGE);
  });

  it('every page is painted over a field that has art in both modes, and every string can be drawn', () => {
    for (const p of pages) {
      expect(existsSync(`public/art/fields/${p.field}.png`), p.field).toBe(true);
      expect(existsSync(`public/art/hd/fields/${p.field}.webp`), p.field).toBe(true);
      for (const s of [p.heading, p.sub ?? '', ...p.paragraphs]) expect(canDraw(s), s).toBe(true);
    }
    expect(canDraw(ATTRACT.hint)).toBe(true);
  });

  it('every page’s text ends above the page dots', () => {
    for (const p of pages) {
      const top = p.nation ? 230 : 232;
      const end = top + 26 + (p.sub ? 14 : 0) + 10 + p.paragraphs.reduce((y, s) => y + wrapPx(s, TEXT_W).length * 12.5 + 6, 0);
      expect(end, p.heading).toBeLessThanOrEqual(448 - 34);
      expect(pageFrames(p)).toBeGreaterThan(300);
    }
  });

  it('left and right page through; past the last page, or on any other key, it returns', () => {
    const a = new Attract('idle');
    a.key('ArrowLeft');
    expect(a.page).toBe(0);
    for (let i = 1; i < a.pages.length; i++) a.key('ArrowRight');
    expect(a.page).toBe(a.pages.length - 1);
    expect(a.exit).toBe(false);
    a.key('ArrowRight');
    expect(a.exit).toBe(true);
    const b = new Attract('menu');
    b.pointerDown(500, 200);
    b.pointerDown(500, 200);
    b.pointerDown(10, 200);
    expect(b.page).toBe(1);
    b.key('Space');
    expect(b.exit).toBe(true);
    const c = new Attract('idle');
    c.pointerDown(256, 200);
    expect(c.exit).toBe(true);
  });
});
