import { def } from './engine/query';
import type { CardDef } from './engine/types';
import { ALL_CARDS } from './data/cards/index';
import { CARD_ART } from './data/cardart';
import { FACTIONS, type Faction } from './data/factions';
import { drawText, drawTextCentred, textWidth } from './font';
import { Gfx, H, W, drawSprite } from './gfx';
import { wrap } from './gallery-text';
import { drawPic, isDetail, loadArt } from './detail';
import { CURSOR, CURSOR_LEGEND } from './sprites';
import { GALLERY } from './strings';
import { drawWindow } from './title';

// Card gallery: every card's art (PLAN D13/D14 pipeline), its proposed name (D12) and its engine numbers and text.
// Every number shown comes from the card definition (KB rule 8).

const COLS = 3;
const ROWS = 3;
const PAGE = COLS * ROWS;
const GRID = { x: 20, y: 40, dx: 76, dy: 52 };
const fileOf = (id: string) => id.replace('@asc', '.asc');

type View = { kind: 'grid' } | { kind: 'detail'; ascended: boolean };

export class Gallery {
  faction = 0;
  index = 0;
  view: View = { kind: 'grid' };
  /** Set when the player leaves the gallery; main.ts switches back to the title. */
  exit = false;
  private readonly thumbs = new Map<string, HTMLImageElement | 'loading' | 'missing'>();
  private readonly fields = new Map<string, HTMLImageElement>();
  private readonly emblems = new Map<string, HTMLImageElement>();

  private get f(): Faction {
    return FACTIONS[this.faction];
  }

  private get cards(): CardDef[] {
    return ALL_CARDS.filter((c) => c.faction === this.f.engine);
  }

  private get card(): CardDef {
    return def(this.cards[this.index].id);
  }

  async load(): Promise<void> {
    await Promise.all(FACTIONS.map(async (f) => {
      const [field, emblem] = await Promise.all([
        loadArt(`art/fields/${f.field}.png`),
        loadArt(`art/emblems/${f.key}.png`),
      ]);
      this.fields.set(f.key, field);
      this.emblems.set(f.key, emblem);
    }));
  }

  /** Card art loads on demand; a card without art says so instead of showing a stand-in. */
  private art(id: string, x2: boolean): HTMLImageElement | null {
    const file = `${x2 ? 'x2/' : ''}${fileOf(id)}`;
    const key = `${isDetail() ? 'hd' : 'px'}:${file}`;
    const have = this.thumbs.get(key);
    if (have instanceof HTMLImageElement) return have;
    if (have) return null;
    this.thumbs.set(key, 'loading');
    loadArt(`art/cards/${file}.png`).then(
      (img) => this.thumbs.set(key, img),
      () => this.thumbs.set(key, 'missing'),
    );
    return null;
  }

  /** What to print where art is not drawn: still loading, or no art for this card. */
  private artLabel(id: string, x2: boolean): string {
    if (!CARD_ART[id.replace('@asc', '')].art) return GALLERY.noArt;
    return this.thumbs.get(`${x2 ? 'x2/' : ''}${fileOf(id)}`) === 'missing' ? GALLERY.noArt : GALLERY.loading;
  }

  private move(d: number): void {
    const n = this.cards.length;
    this.index = (this.index + d + n) % n;
  }

  private switchFaction(d: number): void {
    this.faction = (this.faction + d + FACTIONS.length) % FACTIONS.length;
    this.index = 0;
  }

  key(code: string): void {
    if (this.view.kind === 'detail') {
      if ((code === 'KeyA' || code === 'Tab') && this.card.ascended) this.view = { kind: 'detail', ascended: !this.view.ascended };
      else if (code === 'ArrowRight') { this.move(1); this.view = { kind: 'detail', ascended: false }; }
      else if (code === 'ArrowLeft') { this.move(-1); this.view = { kind: 'detail', ascended: false }; }
      else if (code === 'Escape' || code === 'KeyX' || code === 'Enter' || code === 'Space' || code === 'KeyZ') this.view = { kind: 'grid' };
      return;
    }
    if (code === 'ArrowRight') this.move(1);
    else if (code === 'ArrowLeft') this.move(-1);
    else if (code === 'ArrowDown') this.move(COLS);
    else if (code === 'ArrowUp') this.move(-COLS);
    else if (code === 'KeyE' || code === 'PageDown') this.switchFaction(1);
    else if (code === 'KeyQ' || code === 'PageUp') this.switchFaction(-1);
    else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') this.view = { kind: 'detail', ascended: false };
    else if (code === 'Escape' || code === 'KeyX') this.exit = true;
  }

  pointerDown(x: number, y: number): void {
    if (this.view.kind === 'detail') {
      if (this.card.ascended && x >= 136 && y >= 84 && y < 100) this.view = { kind: 'detail', ascended: !this.view.ascended };
      else this.view = { kind: 'grid' };
      return;
    }
    if (y < 15 && x >= W - 4 - textWidth(GALLERY.factionKeys)) {
      this.switchFaction(x < W - 4 - textWidth(GALLERY.factionKeys) / 2 ? -1 : 1);
      return;
    }
    if (y >= 15 && y < 30 && x >= W - 4 - textWidth(GALLERY.back)) {
      this.exit = true;
      return;
    }
    const page = Math.floor(this.index / PAGE) * PAGE;
    for (let i = 0; i < PAGE; i++) {
      const gx = GRID.x + (i % COLS) * GRID.dx, gy = GRID.y + Math.floor(i / COLS) * GRID.dy;
      if (x >= gx - 2 && x < gx + 66 && y >= gy - 2 && y < gy + 50 && page + i < this.cards.length) {
        if (this.index === page + i) this.view = { kind: 'detail', ascended: false };
        else this.index = page + i;
        return;
      }
    }
    if (y > 196 && x < 40) this.move(-PAGE);
    else if (y > 196 && x > W - 40) this.move(PAGE);
  }

  private backdrop(g: Gfx): void {
    const field = this.fields.get(this.f.key);
    if (field) drawPic(g, field, 0, 0, W, H);
    else g.rect(0, 0, W, H, 'duskZenith');
    g.dither50(0, 0, W, H, 'ink');
  }

  draw(g: Gfx, t: number): void {
    this.backdrop(g);
    if (this.view.kind === 'detail') this.drawDetail(g, this.view.ascended);
    else this.drawGrid(g, t);
  }

  private drawGrid(g: Gfx, t: number): void {
    const emblem = this.emblems.get(this.f.key);
    if (emblem) drawPic(g, emblem, 4, 0);
    drawText(g, this.f.name, 40, 6, { color: 'brassLight', outline: 'ink' });
    const count = `${this.index + 1}/${this.cards.length}`;
    drawText(g, count, 40, 17, { color: 'steam', outline: 'ink' });
    drawText(g, GALLERY.factionKeys, W - 4 - textWidth(GALLERY.factionKeys), 6, { color: 'brassGlint', outline: 'ink' });
    drawText(g, GALLERY.back, W - 4 - textWidth(GALLERY.back), 17, { color: 'steam', outline: 'ink' });

    const page = Math.floor(this.index / PAGE) * PAGE;
    for (let i = 0; i < PAGE && page + i < this.cards.length; i++) {
      const c = this.cards[page + i];
      const gx = GRID.x + (i % COLS) * GRID.dx, gy = GRID.y + Math.floor(i / COLS) * GRID.dy;
      const on = page + i === this.index;
      g.rect(gx - 2, gy - 2, 68, 52, on ? 'brassGlint' : 'ink');
      g.rect(gx - 1, gy - 1, 66, 50, on ? 'brass' : 'ironDark');
      const img = CARD_ART[c.id].art ? this.art(c.id, false) : null;
      if (img) drawPic(g, img, gx, gy, 64, 48);
      else {
        g.rect(gx, gy, 64, 48, 'ironNight');
        drawTextCentred(g, this.artLabel(c.id, false), gx + 32, gy + 20, { color: 'iron' });
      }
      g.rect(gx, gy, 9, 9, 'ink');
      drawText(g, String(c.cost), gx + 2, gy + 1, { color: 'brassGlint' });
    }
    if (page > 0) drawText(g, GALLERY.pageLeft, 6, 205, { color: 'brassGlint', outline: 'ink' });
    if (page + PAGE < this.cards.length) drawText(g, GALLERY.pageRight, W - 11, 205, { color: 'brassGlint', outline: 'ink' });

    const c = this.card;
    const name = CARD_ART[c.id].name.toUpperCase();
    drawTextCentred(g, name, W / 2, 198, { color: 'steamWhite', outline: 'ink' });
    drawTextCentred(g, statLine(c), W / 2, 210, { color: 'brassLight', outline: 'ink' });
    const bob = (t >> 4) % 2;
    const cx = GRID.x + (this.index % PAGE % COLS) * GRID.dx, cy = GRID.y + Math.floor((this.index % PAGE) / COLS) * GRID.dy;
    drawSprite(g, CURSOR, CURSOR_LEGEND, cx - 11 + bob, cy + 20);
  }

  private drawDetail(g: Gfx, ascended: boolean): void {
    const c = this.card;
    const a = ascended && c.ascended ? c.ascended : null;
    const artId = a ? `${c.id}@asc` : c.id;
    drawWindow(g, 2, 2, W - 4, H - 4);
    g.rect(7, 7, 130, 98, 'ink');
    const img = CARD_ART[c.id].art ? this.art(artId, true) : null;
    if (img) drawPic(g, img, 8, 8, 128, 96);
    else drawTextCentred(g, this.artLabel(artId, true), 72, 52, { color: 'iron' });

    const name = (a ? CARD_ART[c.id].ascendedName ?? c.ascended?.name ?? '' : CARD_ART[c.id].name).toUpperCase();
    const nameLines = wrap(name, 18);
    nameLines.forEach((l, i) => drawText(g, l, 142, 10 + i * 10, { color: 'brassGlint' }));
    let y = 14 + nameLines.length * 10;
    drawText(g, c.type.toUpperCase() + (c.token ? GALLERY.token : ''), 142, y, { color: 'steam' });
    y += 12;
    drawText(g, `COST ${c.cost}`, 142, y, { color: 'steamWhite' });
    if (c.type !== 'glyph') {
      const power = a ? a.power : c.power;
      const health = a ? a.health : c.health;
      drawText(g, `POWER ${power}`, 142, y + 10, { color: 'steamWhite' });
      drawText(g, `HEALTH ${health}`, 142, y + 20, { color: 'steamWhite' });
    }
    if (c.ascended) drawText(g, a ? GALLERY.toBase : GALLERY.toAscended, 142, 88, { color: 'brassLight' });

    const text = (a ? a.text : c.text).toUpperCase();
    const lines = wrap(text, 39);
    lines.forEach((l, i) => drawText(g, l, 10, 112 + i * 10, { color: 'steamWhite' }));
    if (c.level && !a) wrap(`${GALLERY.ascendsWhen}${c.level.text}`.toUpperCase(), 39)
      .forEach((l, i) => drawText(g, l, 10, 116 + (lines.length + i) * 10, { color: 'crystalBright' }));
  }
}

function statLine(c: CardDef): string {
  return c.type === 'glyph' ? `GLYPH  COST ${c.cost}` : `COST ${c.cost}  POWER ${c.power}  HEALTH ${c.health}`;
}
