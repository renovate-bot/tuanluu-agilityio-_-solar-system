import type { BodyContent, ContentId, Lang } from '../types';
import { CONTENT_DE } from './de';
import { CONTENT_EN } from './en';
import { CONTENT_JA } from './ja';
import { CONTENT_VI } from './vi';

export { CONTENT_DE, CONTENT_EN, CONTENT_JA, CONTENT_VI };

const CONTENT: Record<Lang, Record<ContentId, BodyContent>> = {
  vi: CONTENT_VI,
  en: CONTENT_EN,
  ja: CONTENT_JA,
  de: CONTENT_DE,
};

export function getContent(id: ContentId, lang: Lang): BodyContent {
  return CONTENT[lang][id];
}
