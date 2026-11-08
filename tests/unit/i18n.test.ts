import { describe, expect, it } from 'vitest';
import { formatNumber, t } from '../../src/i18n/i18n';

describe('t', () => {
  it('interpolates params', () => {
    const s = t('vi', 'tour.progress', { current: 5, total: 14 });
    expect(s).toContain('5');
    expect(s).toContain('14');
    expect(s).not.toContain('{');
  });
  it('leaves unknown params as-is', () => {
    expect(t('en', 'tour.progress', { current: 2 })).toBe('Stop 2 of {total}');
  });
  it('works without params', () => {
    expect(t('en', 'tour.progress')).toBe('Stop {current} of {total}');
  });
});

describe('formatNumber', () => {
  it('vi uses dots', () => expect(formatNumber('vi', 1392700)).toBe('1.392.700'));
  it('en uses commas', () => expect(formatNumber('en', 1392700)).toBe('1,392,700'));
  it('ja uses ja-JP grouping', () => expect(formatNumber('ja', 1392700)).toBe('1,392,700'));
  it('ja keeps the decimal point', () => expect(formatNumber('ja', 1.23456, 2)).toBe('1.23'));
  it('de uses a decimal comma and dot grouping', () => {
    expect(formatNumber('de', 1234.5, 1)).toBe('1.234,5');
    expect(formatNumber('de', 1392700)).toBe('1.392.700');
  });
  it('de interpolates tour.progress', () => {
    const s = t('de', 'tour.progress', { current: 3, total: 14 });
    expect(s).toContain('3');
    expect(s).toContain('14');
    expect(s).not.toContain('{');
  });
  it('ja interpolates tour.progress', () => {
    const s = t('ja', 'tour.progress', { current: 3, total: 14 });
    expect(s).toContain('3');
    expect(s).toContain('14');
    expect(s).not.toContain('{');
  });
  it('respects max fraction digits', () => expect(formatNumber('en', 1.23456, 2)).toBe('1.23'));
});
