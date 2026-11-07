import { describe, expect, it } from 'vitest';
import { CONTENT_EN, CONTENT_JA, CONTENT_VI, getContent } from '../../src/data/content';
import { BODY_IDS, SUPPORTED_LANGS, type ContentId, type Lang } from '../../src/data/types';
import { UI_STRINGS } from '../../src/i18n/strings';

const CONTENT_IDS: ContentId[] = [...BODY_IDS, 'asteroid-belt'];
const LANGS: readonly Lang[] = SUPPORTED_LANGS;

/**
 * Counts sentences: runs of text ending in . ! or ? followed by whitespace, or ending in
 * a Japanese terminator (no following space needed), or the end of the string.
 */
function countSentences(text: string): number {
  return text
    .trim()
    .split(/(?<=[.!?])\s+|(?<=[。！？])\s*/)
    .filter((s) => s.trim().length > 0).length;
}

describe('body content', () => {
  it('has an entry for exactly every ContentId in every language', () => {
    expect(Object.keys(CONTENT_VI).sort()).toEqual([...CONTENT_IDS].sort());
    expect(Object.keys(CONTENT_EN).sort()).toEqual([...CONTENT_IDS].sort());
    expect(Object.keys(CONTENT_JA).sort()).toEqual([...CONTENT_IDS].sort());
  });

  it('Japanese facts match the English fact count for every body', () => {
    for (const id of CONTENT_IDS) {
      expect(CONTENT_JA[id].facts.length, id).toBe(CONTENT_EN[id].facts.length);
    }
  });

  for (const lang of LANGS) {
    for (const id of CONTENT_IDS) {
      it(`${lang}/${id} has complete, well-shaped content`, () => {
        const c = getContent(id, lang);
        expect(c.name.trim()).not.toBe('');
        expect(c.kindLabel.trim()).not.toBe('');
        expect(c.description.trim()).not.toBe('');
        const sentences = countSentences(c.description);
        expect(sentences).toBeGreaterThanOrEqual(2);
        expect(sentences).toBeLessThanOrEqual(4);
        expect(c.facts.length).toBeGreaterThanOrEqual(3);
        expect(c.facts.length).toBeLessThanOrEqual(5);
        for (const value of [c.name, c.kindLabel, c.description, ...c.facts]) {
          expect(value.trim()).not.toBe('');
          expect(value).not.toMatch(/TODO/);
        }
      });
    }
  }

  it('getContent returns the table for the requested language', () => {
    expect(getContent('earth', 'vi')).toBe(CONTENT_VI.earth);
    expect(getContent('earth', 'en')).toBe(CONTENT_EN.earth);
    expect(getContent('earth', 'ja')).toBe(CONTENT_JA.earth);
  });

  it('labels Pluto as a dwarf planet and explains the 2006 reclassification', () => {
    expect(getContent('pluto', 'vi').kindLabel.toLowerCase()).toContain('hành tinh lùn');
    expect(getContent('pluto', 'en').kindLabel.toLowerCase()).toContain('dwarf planet');
    expect(getContent('pluto', 'ja').kindLabel).toContain('準惑星');
    for (const lang of LANGS) {
      const c = getContent('pluto', lang);
      const text = [c.description, ...c.facts].join(' ');
      expect(text).toContain('2006');
      expect(text).toMatch(/IAU/);
    }
  });

  it('describes the asteroid belt location, Ceres and its small total mass', () => {
    for (const lang of LANGS) {
      const c = getContent('asteroid-belt', lang);
      const text = [c.description, ...c.facts].join(' ');
      expect(text).toMatch(/2[.,]2/);
      expect(text).toMatch(/3[.,]2/);
      expect(text).toMatch(/AU|au|đơn vị thiên văn|天文単位/);
      expect(text).toMatch(lang === 'ja' ? /ケレス/ : /Ceres/);
    }
    expect(
      [CONTENT_EN['asteroid-belt'].description, ...CONTENT_EN['asteroid-belt'].facts].join(' '),
    ).toMatch(/Moon/);
    expect(
      [CONTENT_VI['asteroid-belt'].description, ...CONTENT_VI['asteroid-belt'].facts].join(' '),
    ).toMatch(/Mặt Trăng/);
    expect(
      [CONTENT_JA['asteroid-belt'].description, ...CONTENT_JA['asteroid-belt'].facts].join(' '),
    ).toMatch(/月/);
  });
});

describe('UI strings', () => {
  const REQUIRED_KEYS = [
    'appTitle',
    'hintDesktop',
    'hintMobile',
    'backToOverview',
    'notToScale',
    'sound.on',
    'sound.off',
    'tour.start',
    'tour.stop',
    'tour.pause',
    'tour.resume',
    'tour.next',
    'tour.prev',
    'tour.exit',
    'tour.progress',
    'tour.unmuteHint',
    'credits.title',
    'credits.textures',
    'credits.data',
    'credits.voice',
    'credits.close',
    'loading',
    'webglUnsupported',
    'field.kind',
    'field.order',
    'field.diameter',
    'field.mass',
    'field.distance',
    'field.orbitalPeriod',
    'field.rotationPeriod',
    'field.meanTemp',
    'field.moons',
    'field.gravity',
    'kind.star',
    'kind.terrestrial',
    'kind.gas-giant',
    'kind.ice-giant',
    'kind.dwarf-planet',
    'kind.moon',
    'lang.switch',
  ];

  it('every language has the same key set as en', () => {
    for (const lang of LANGS) {
      expect(Object.keys(UI_STRINGS[lang]).sort(), lang).toEqual(Object.keys(UI_STRINGS.en).sort());
    }
  });

  it('every translation has the same {placeholders} as en', () => {
    const placeholders = (v: string): string[] => (v.match(/\{\w+\}/g) ?? []).sort();
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(UI_STRINGS.en)) {
        const translated = UI_STRINGS[lang][key as keyof typeof UI_STRINGS.en];
        expect(placeholders(translated), `${lang}.${key}`).toEqual(placeholders(value));
      }
    }
  });

  it('Japanese strings are written in Japanese, except brand names and km', () => {
    const SAME_AS_EN = new Set(['credits.support', 'unit.km']);
    for (const [key, value] of Object.entries(UI_STRINGS.ja)) {
      if (SAME_AS_EN.has(key)) continue;
      expect(value, `ja.${key}`).toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
    }
  });

  it('contains every required key', () => {
    for (const key of REQUIRED_KEYS) {
      expect(Object.keys(UI_STRINGS.en)).toContain(key);
    }
  });

  it('has no empty or TODO values', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(UI_STRINGS[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe('');
        expect(value, `${lang}.${key}`).not.toMatch(/TODO/);
      }
    }
  });

  it('tour.progress has {current} and {total} placeholders in every language', () => {
    for (const lang of LANGS) {
      expect(UI_STRINGS[lang]['tour.progress']).toContain('{current}');
      expect(UI_STRINGS[lang]['tour.progress']).toContain('{total}');
    }
  });

  it('notToScale is a not-to-scale disclaimer in both languages', () => {
    expect(UI_STRINGS.en.notToScale.toLowerCase()).toContain('not to scale');
    expect(UI_STRINGS.vi.notToScale.toLowerCase()).toContain('tỉ lệ');
    expect(UI_STRINGS.ja.notToScale).toContain('縮尺');
  });

  it('credits carry the required attributions', () => {
    for (const lang of LANGS) {
      expect(UI_STRINGS[lang]['credits.textures']).toContain('Solar System Scope (CC BY 4.0)');
      expect(UI_STRINGS[lang]['credits.data']).toContain('NASA');
      expect(UI_STRINGS[lang]['credits.voice']).toContain('Microsoft Edge TTS');
    }
    expect(UI_STRINGS.en['credits.textures']).toBe('Textures: Solar System Scope (CC BY 4.0)');
    expect(UI_STRINGS.en['credits.voice']).toBe(
      'Narration voice generated with Microsoft Edge TTS',
    );
  });

  it('support call to action keeps its English label in both locales', () => {
    expect(UI_STRINGS.en['credits.support']).toBe('Buy me a coffee');
    expect(UI_STRINGS.vi['credits.support']).toBe('Buy me a coffee');
    expect(UI_STRINGS.ja['credits.support']).toBe('Buy me a coffee');
  });
});
