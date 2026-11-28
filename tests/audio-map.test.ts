import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SILENT_KINDS, VOICED_KINDS, variantsOf } from '../src/audio/audio';

// Every log kind the engine emits either has a voice or is deliberately silent (never forgotten).
describe('audio map', () => {
  it('covers every log kind', () => {
    const src = readFileSync('src/engine/rules.ts', 'utf8');
    const kinds = new Set([...src.matchAll(/\bk: '([a-zA-Z]+)'/g)].map((m) => m[1]));
    for (const k of kinds) expect(VOICED_KINDS.includes(k) || SILENT_KINDS.includes(k), k).toBe(true);
  });

  it('every sound in the generation list is a known kind or a music track', () => {
    const m = JSON.parse(readFileSync('tools/audio/manifest.json', 'utf8')) as { music: { id: string }[]; sfx: { id: string }[] };
    // a variant (sfx/<kind>-<n>, PLAN D28) belongs to its kind
    for (const s of m.sfx) expect(VOICED_KINDS, s.id).toContain(s.id.replace('sfx/', '').replace(/-\d+$/, ''));
    for (const t of m.music) expect(t.id, t.id).toMatch(/^music\/(title|calm|battle|tense|victory|defeat|ascend-sting)$/);
  });

  it('PLAN D28: variants of a sound are found by id, and only its own', () => {
    const ids = ['sfx/spireDmg', 'sfx/spireDmg-1', 'sfx/spireDmg-6', 'sfx/spireHeal', 'sfx/dmg', 'sfx/spireDmg-x'];
    expect(variantsOf('sfx/spireDmg', ids)).toEqual(['sfx/spireDmg', 'sfx/spireDmg-1', 'sfx/spireDmg-6']);
    expect(variantsOf('sfx/dmg', ids)).toEqual(['sfx/dmg']);
    const live = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as string[];
    expect(variantsOf('sfx/spireDmg', live)).toHaveLength(6);
  });
});
