import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../src/data/tour/en.json';
import de from '../../src/data/tour/de.json';
import ja from '../../src/data/tour/ja.json';
import vi from '../../src/data/tour/vi.json';
import { SUPPORTED_LANGS, type Lang } from '../../src/data/types';
import type { NarrationManifest } from '../../src/tour/narration';

const PUBLIC_DIR = resolve(__dirname, '../../public');
const MANIFEST_PATH = resolve(PUBLIC_DIR, 'audio/narration/manifest.json');
const STOP_IDS = [
  'intro',
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'asteroid-belt',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'outro',
];
// German narration clips arrive in the next task; Task 2 removes this constant.
const LANGS_WITHOUT_AUDIO_YET: readonly Lang[] = ['de'];
const LANGS: readonly Lang[] = SUPPORTED_LANGS.filter((l) => !LANGS_WITHOUT_AUDIO_YET.includes(l));
const SCRIPTS: Record<Lang, Record<string, { text: string }>> = { vi, en, ja, de };
const VOICE_PREFIX: Record<Lang, string> = {
  vi: 'vi-VN-',
  en: 'en-US-',
  ja: 'ja-JP-',
  de: 'de-DE-',
};

// The generated assets are build inputs committed to git. This suite only runs
// meaningful checks once the manifest exists (after `npm run narration`).
describe.runIf(existsSync(MANIFEST_PATH))('narration assets', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as NarrationManifest;

  it('has a locale-matched voice for every language', () => {
    const voices = (manifest as unknown as { voices: Record<string, string> }).voices;
    expect(Object.keys(voices).sort()).toEqual([...LANGS].sort());
    expect(voices.vi).toBe('vi-VN-HoaiMyNeural');
    expect(voices.en).toBe('en-US-AvaNeural');
    for (const lang of LANGS) {
      expect(voices[lang], lang).toMatch(new RegExp(`^${VOICE_PREFIX[lang]}\\w+Neural$`));
    }
  });

  it('has 42 stop/language segments, each file named for its stop and language', () => {
    let count = 0;
    for (const id of STOP_IDS) {
      for (const lang of LANGS) {
        const seg = manifest.segments[id as keyof typeof manifest.segments]?.[lang];
        if (!seg) continue;
        count++;
        expect(seg.file).toBe(`audio/narration/${id}.${lang}.mp3`);
      }
    }
    expect(count).toBe(STOP_IDS.length * LANGS.length);
    expect(count).toBe(42);
  });

  it('cues spell out exactly the tour script of the same language', () => {
    const squash = (s: string): string => s.replace(/\s+/g, '');
    for (const id of STOP_IDS) {
      for (const lang of LANGS) {
        const seg = manifest.segments[id as keyof typeof manifest.segments]?.[lang];
        if (!seg) continue;
        const spoken = squash(seg.cues.map((c) => c.text).join(''));
        expect(spoken, `${id}.${lang}`).toBe(squash(SCRIPTS[lang][id]?.text ?? ''));
      }
    }
  });

  it('has every stop in every language', () => {
    expect(manifest.version).toBe(1);
    expect(Object.keys(manifest.segments).sort()).toEqual([...STOP_IDS].sort());
    for (const id of STOP_IDS) {
      for (const lang of LANGS) {
        expect(
          manifest.segments[id as keyof typeof manifest.segments]?.[lang],
          `${id}.${lang}`,
        ).toBeDefined();
      }
    }
  });

  it('references an existing mp3 with a 10-50 s duration for every entry', () => {
    for (const id of STOP_IDS) {
      for (const lang of LANGS) {
        const seg = manifest.segments[id as keyof typeof manifest.segments]?.[lang];
        expect(seg, `${id}.${lang}`).toBeDefined();
        if (!seg) continue;
        expect(existsSync(resolve(PUBLIC_DIR, seg.file)), seg.file).toBe(true);
        expect(seg.file.endsWith('.mp3'), seg.file).toBe(true);
        expect(seg.durationMs, `${id}.${lang}`).toBeGreaterThanOrEqual(10000);
        expect(seg.durationMs, `${id}.${lang}`).toBeLessThanOrEqual(50000);
      }
    }
  });

  it('has contiguous cues that cover the segment', () => {
    for (const id of STOP_IDS) {
      for (const lang of LANGS) {
        const seg = manifest.segments[id as keyof typeof manifest.segments]?.[lang];
        if (!seg) continue;
        const cues = seg.cues;
        expect(cues.length, `${id}.${lang} cues`).toBeGreaterThan(0);
        expect(cues[0]?.startMs, `${id}.${lang} first`).toBe(0);
        for (let i = 1; i < cues.length; i++) {
          expect(cues[i]?.startMs, `${id}.${lang} cue ${i}`).toBe(cues[i - 1]?.endMs);
        }
        expect(cues[cues.length - 1]?.endMs, `${id}.${lang} last`).toBe(seg.durationMs);
      }
    }
  });
});
