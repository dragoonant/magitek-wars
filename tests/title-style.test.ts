import { describe, expect, it } from 'vitest';
import { ADVANCE, GLYPHS, GLYPH_H, GLYPH_W, canDraw, textWidth } from '../src/font';
import { GLOAM_CYCLE, PALETTE, WINDOW_CYCLE } from '../src/palette';
import { ALL_SPRITES } from '../src/sprites';
import * as S from '../src/strings';

// docs/ART-STYLE.md section 2: 15-bit colour, house palette of at most 31 colours plus transparent.
describe('ART-STYLE 2 palette', () => {
  it('every channel is a multiple of 8', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(hex, name).toMatch(/^#[0-9a-f]{6}$/);
      for (let i = 1; i < 7; i += 2) expect(parseInt(hex.slice(i, i + 2), 16) % 8, `${name} ${hex}`).toBe(0);
    }
  });
  it('has at most 31 colours and no duplicates', () => {
    const values = Object.values(PALETTE);
    expect(values.length).toBeLessThanOrEqual(31);
    expect(new Set(values).size).toBe(values.length);
  });
  it('palette cycles only use house colours', () => {
    for (const c of [...GLOAM_CYCLE, ...WINDOW_CYCLE]) expect(PALETTE[c]).toBeDefined();
  });
});

describe('ART-STYLE 2 sprites', () => {
  for (const s of ALL_SPRITES) {
    it(`${s.name}: at most 15 colours, every character has a colour`, () => {
      const used = new Set<string>();
      for (const row of s.map) for (const ch of row) if (ch !== '.') used.add(ch);
      for (const ch of used) expect(s.legend[ch], `${s.name} '${ch}'`).toBeDefined();
      expect(new Set([...used].map((ch) => s.legend[ch])).size).toBeLessThanOrEqual(15);
    });
  }
});

describe('ART-STYLE 5 font', () => {
  it('every glyph is 5x7 of 0 and 1', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows.length, ch).toBe(GLYPH_H);
      for (const r of rows) expect(r, ch).toMatch(new RegExp(`^[01]{${GLYPH_W}}$`));
    }
  });
  it('draws every string on the title screen', () => {
    const all = [S.TITLE_TOP, S.TITLE_BOTTOM, S.SUBTITLE, S.PRESS_START, S.CREDIT, S.VERSION, S.DIALOG_CLOSE,
      ...S.MENU.map((m) => m.label), ...Object.values(S.DIALOGS).flat(), ...Object.values(S.GALLERY)];
    for (const s of all) expect(canDraw(s), s).toBe(true);
  });
  it('dialogue lines fit the dialog window (192 px of text)', () => {
    for (const line of Object.values(S.DIALOGS).flat()) expect(textWidth(line), line).toBeLessThanOrEqual(192);
    expect(ADVANCE).toBe(6);
  });
  it('the credit names evilgouki', () => {
    expect(S.CREDIT).toContain('EVILGOUKI');
  });
});
