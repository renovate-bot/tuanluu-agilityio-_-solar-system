import { isLang, type Lang } from '../data/types';

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export interface Prefs {
  lang: Lang;
  muted: boolean;
  tourSeen: boolean;
}
export const PREF_KEYS = {
  lang: 'sse.lang',
  muted: 'sse.muted',
  tourSeen: 'sse.tourSeen',
} as const;

/**
 * First supported primary language in browser order (case-insensitive, region ignored:
 * `ja-JP` -> `ja`), else English. Unsupported entries such as `ko` or `fr` are skipped.
 */
export function detectLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLang(primary)) return primary;
  }
  return 'en';
}

function read(storage: KeyValueStorage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function loadPrefs(storage: KeyValueStorage | null, languages: readonly string[]): Prefs {
  const storedLang = read(storage, PREF_KEYS.lang);
  const lang: Lang = isLang(storedLang) ? storedLang : detectLang(languages);
  return {
    lang,
    muted: read(storage, PREF_KEYS.muted) !== 'false',
    tourSeen: read(storage, PREF_KEYS.tourSeen) === 'true',
  };
}

export function savePref<K extends keyof Prefs>(
  storage: KeyValueStorage | null,
  key: K,
  value: Prefs[K],
): void {
  if (!storage) return;
  try {
    storage.setItem(PREF_KEYS[key], String(value));
  } catch {
    // storage unavailable or full: ignore
  }
}
