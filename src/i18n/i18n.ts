import type { Lang } from '../data/types';
import { UI_STRINGS, type UiKey } from './strings';

export function t(lang: Lang, key: UiKey, params?: Record<string, string | number>): string {
  const s = UI_STRINGS[lang][key];
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : String(v);
  });
}

const NUMBER_LOCALES: Record<Lang, string> = { vi: 'vi-VN', en: 'en-US', ja: 'ja-JP' };

export function formatNumber(lang: Lang, value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(NUMBER_LOCALES[lang], {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}
