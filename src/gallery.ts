import { def } from './engine/query';
import type { CardDef } from './engine/types';
import { ALL_CARDS } from './data/cards/index';
import { CARD_ART } from './data/cardart';
import { FACTIONS, type Faction } from './data/factions';
import { drawText, drawTextCentred, drawTextRight, textWidth, wrapPx } from './font';
import { Gfx, H, W } from './gfx';
import { PALETTE, rgba } from './palette';
import { clipRound, fillRound, frame, panel, rule } from './ui';
import { drawPic, isDetail, loadArt } from './detail';
import { GALLERY } from './strings';

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
    if (y < 15 && x >= W - 4 - textWidth(GALLERY.factionKeys, 0.85)) {
      this.switchFaction(x < W - 4 - textWidth(GALLERY.factionKeys, 0.85) / 2 ? -1 : 1);
      return;
    }
    if (y >= 15 && y < 30 && x >= W - 4 - textWidth(GALLERY.back, 0.85)) {
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
    const ctx = g.ctx;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, rgba('ink', 0.75));
    gr.addColorStop(0.3, rgba('ink', 0.45));
    gr.addColorStop(0.8, rgba('ink', 0.55));
    gr.addColorStop(1, rgba('ink', 0.85));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  draw(g: Gfx, t: number): void {
    this.backdrop(g);
    if (this.view.kind === 'detail') this.drawDetail(g, this.view.ascended);
    else this.drawGrid(g, t);
  }

  private drawGrid(g: Gfx, t: number): void {
    const emblem = this.emblems.get(this.f.key);
    if (emblem) drawPic(g, emblem, 4, 0);
    drawText(g, this.f.name.toUpperCase(), 40, 5, { color: 'brassGlint', face: 'display', scale: 1.2, shadow: 'ink' });
    const count = `${this.index + 1} of ${this.cards.length}`;
    drawText(g, count, 40, 18, { color: 'steam', shadow: 'ink', scale: 0.85 });
    drawTextRight(g, GALLERY.factionKeys, W - 5, 5, { color: 'brassGlint', shadow: 'ink', scale: 0.85 });
    drawTextRight(g, GALLERY.back, W - 5, 16, { color: 'steam', shadow: 'ink', scale: 0.85 });

    const page = Math.floor(this.index / PAGE) * PAGE;
    for (let i = 0; i < PAGE && page + i < this.cards.length; i++) {
      const c = this.cards[page + i];
      const gx = GRID.x + (i % COLS) * GRID.dx, gy = GRID.y + Math.floor(i / COLS) * GRID.dy;
      const on = page + i === this.index;
      const ctx = g.ctx;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      fillRound(g, gx, gy, 64, 48, 'ironNight', 1, 2.5);
      ctx.restore();
      const img = CARD_ART[c.id].art ? this.art(c.id, false) : null;
      const unclip = clipRound(g, gx, gy, 64, 48, 2.5);
      if (img) drawPic(g, img, gx, gy, 64, 48);
      else drawTextCentred(g, this.artLabel(c.id, false), gx + 32, gy + 20, { color: 'iron', scale: 0.85 });
      if (!on) g.wash(gx, gy, 64, 48, 'ink', 0.15);
      unclip();
      frame(g, gx, gy, 64, 48, on ? 'brassGlint' : 'brassDark', 2.5, on);
      costGem(g, gx + 5, gy + 5, c.cost);
    }
    if (page > 0) drawText(g, GALLERY.pageLeft, 6, 203, { color: 'brassGlint', face: 'display', scale: 1.4, shadow: 'ink', alpha: 0.6 + 0.4 * Math.sin(t / 12) });
    if (page + PAGE < this.cards.length) drawTextRight(g, GALLERY.pageRight, W - 6, 203, { color: 'brassGlint', face: 'display', scale: 1.4, shadow: 'ink', alpha: 0.6 + 0.4 * Math.sin(t / 12) });

    const c = this.card;
    drawTextCentred(g, CARD_ART[c.id].name, W / 2, 196, { color: 'steamWhite', face: 'bold', shadow: 'ink' });
    drawTextCentred(g, statLine(c), W / 2, 208, { color: 'brassLight', shadow: 'ink', scale: 0.85 });
  }

  private drawDetail(g: Gfx, ascended: boolean): void {
    const c = this.card;
    const a = ascended && c.ascended ? c.ascended : null;
    const artId = a ? `${c.id}@asc` : c.id;
    panel(g, 3, 3, W - 6, H - 6, { tone: 'dark' });
    const img = CARD_ART[c.id].art ? this.art(artId, true) : null;
    const unclip = clipRound(g, 8, 8, 128, 96, 3);
    if (img) drawPic(g, img, 8, 8, 128, 96);
    else drawTextCentred(g, this.artLabel(artId, true), 72, 52, { color: 'iron' });
    unclip();
    frame(g, 8, 8, 128, 96, 'brassDark', 3);

    const name = a ? CARD_ART[c.id].ascendedName ?? c.ascended?.name ?? '' : CARD_ART[c.id].name;
    const nameLines = wrapPx(name, 106, 1.05, 'bold');
    nameLines.forEach((l, i) => drawText(g, l, 143, 10 + i * 11, { color: 'brassGlint', face: 'bold', scale: 1.05 }));
    let y = 14 + nameLines.length * 11;
    drawText(g, (c.type === 'glyph' ? 'Tactic' : c.type === 'hero' ? 'Hero' : 'Unit') + (c.token ? GALLERY.token : ''), 143, y, { color: 'steam', scale: 0.9 });
    y += 12;
    drawText(g, `Cost ${c.cost}`, 143, y, { color: 'steamWhite' });
    if (c.type !== 'glyph') {
      const power = a ? a.power : c.power;
      const health = a ? a.health : c.health;
      drawText(g, `Power ${power}`, 143, y + 10, { color: 'steamWhite' });
      drawText(g, `Health ${health}`, 143, y + 20, { color: 'steamWhite' });
    }
    if (c.ascended) drawText(g, a ? GALLERY.toBase : GALLERY.toAscended, 143, 90, { color: 'brassLight', scale: 0.9 });

    rule(g, 8, 109, W - 16);
    const text = a ? a.text : c.text;
    const lines = wrapPx(text, W - 22, 0.95);
    lines.forEach((l, i) => drawText(g, l, 11, 115 + i * 10, { color: 'steamWhite', scale: 0.95 }));
    if (c.level && !a) wrapPx(`${GALLERY.ascendsWhen}${c.level.text}`, W - 22, 0.95)
      .forEach((l, i) => drawText(g, l, 11, 119 + (lines.length + i) * 10, { color: 'crystalBright', scale: 0.95 }));
  }
}

/** The cost in a small crystal disc. */
function costGem(g: Gfx, cx: number, cy: number, n: number): void {
  const ctx = g.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  const gr = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 0.3, cx, cy, 4.5);
  gr.addColorStop(0, PALETTE.crystal);
  gr.addColorStop(1, PALETTE.crystalDeep);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = PALETTE.crystalWhite;
  ctx.stroke();
  ctx.restore();
  drawTextCentred(g, String(n), cx, cy - 2.7, { color: 'steamWhite', face: 'bold', scale: 0.78 });
}

function statLine(c: CardDef): string {
  return c.type === 'glyph' ? `Tactic · cost ${c.cost}` : `Cost ${c.cost} · power ${c.power} · health ${c.health}`;
}
