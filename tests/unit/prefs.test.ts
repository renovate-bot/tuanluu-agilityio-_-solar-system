import { describe, expect, it } from 'vitest';
import {
  detectLang,
  loadPrefs,
  savePref,
  PREF_KEYS,
  type KeyValueStorage,
} from '../../src/state/prefs';
import { SUPPORTED_LANGS } from '../../src/data/types';

function mem(
  init: Record<string, string> = {},
): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? (data[k] as string) : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}
const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('detectLang', () => {
  it('vi when any entry starts with vi', () => expect(detectLang(['vi-VN', 'en'])).toBe('vi'));
  it('vi when vi is the first supported entry', () =>
    expect(detectLang(['fr-FR', 'vi'])).toBe('vi'));
  it('en otherwise', () => expect(detectLang(['en-US'])).toBe('en'));
  it('en for empty', () => expect(detectLang([])).toBe('en'));
  it('matches a ja-JP region tag', () => expect(detectLang(['ja-JP'])).toBe('ja'));
  it('is case-insensitive', () => expect(detectLang(['JA'])).toBe('ja'));
  it('picks the first supported language in browser order', () => {
    expect(detectLang(['en-US', 'vi'])).toBe('en');
    expect(detectLang(['ja', 'vi-VN'])).toBe('ja');
    expect(detectLang(['vi', 'ja'])).toBe('vi');
  });
  it('skips unsupported ko/de/ru entries', () => {
    expect(detectLang(['ko-KR', 'de-DE', 'ja-JP'])).toBe('ja');
    expect(detectLang(['ko', 'de', 'ru'])).toBe('en');
  });
  it('does not match a tag that merely starts with a supported code', () =>
    expect(detectLang(['jam', 'vin'])).toBe('en'));
});

describe('SUPPORTED_LANGS', () => {
  it('is exactly vi, en, ja in this phase', () =>
    expect([...SUPPORTED_LANGS]).toEqual(['vi', 'en', 'ja']));
});

describe('loadPrefs', () => {
  it('defaults with empty storage', () => {
    expect(loadPrefs(mem(), ['vi'])).toEqual({ lang: 'vi', muted: true, tourSeen: false });
  });
  it('stored muted=false', () => {
    expect(loadPrefs(mem({ [PREF_KEYS.muted]: 'false' }), ['en']).muted).toBe(false);
  });
  it('stored tourSeen=true and lang=en', () => {
    const p = loadPrefs(mem({ [PREF_KEYS.tourSeen]: 'true', [PREF_KEYS.lang]: 'en' }), ['vi']);
    expect(p).toEqual({ lang: 'en', muted: true, tourSeen: true });
  });
  it('a saved ja wins over the browser languages', () => {
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'ja' }), ['vi']).lang).toBe('ja');
  });
  it('saved vi and en are kept', () => {
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'vi' }), ['ja']).lang).toBe('vi');
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'en' }), ['ja']).lang).toBe('en');
  });
  it('unsupported saved values (ko, JA, ja-JP) fall back to detection', () => {
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'ko' }), ['ja-JP']).lang).toBe('ja');
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'ja-JP' }), ['de']).lang).toBe('en');
  });
  it('detects Japanese with empty storage', () => {
    expect(loadPrefs(mem(), ['ja-JP', 'en']).lang).toBe('ja');
  });
  it('invalid stored lang falls back to detected', () => {
    expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'xx' }), ['vi']).lang).toBe('vi');
  });
  it('throwing storage yields defaults', () => {
    expect(loadPrefs(throwing, ['en'])).toEqual({ lang: 'en', muted: true, tourSeen: false });
  });
  it('null storage yields defaults', () => {
    expect(loadPrefs(null, ['vi'])).toEqual({ lang: 'vi', muted: true, tourSeen: false });
  });
});

describe('savePref', () => {
  it('writes string values', () => {
    const s = mem();
    savePref(s, 'muted', false);
    savePref(s, 'lang', 'en');
    expect(s.data['sse.muted']).toBe('false');
    expect(s.data['sse.lang']).toBe('en');
  });
  it('does not throw when setItem throws', () => {
    expect(() => savePref(throwing, 'muted', true)).not.toThrow();
  });
  it('does not throw with null storage', () => {
    expect(() => savePref(null, 'tourSeen', true)).not.toThrow();
  });
});
