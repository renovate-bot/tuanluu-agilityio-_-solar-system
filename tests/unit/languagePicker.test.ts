import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '../../src/data/types';
import { UI_STRINGS } from '../../src/i18n/strings';
import type { AppState } from '../../src/state/appState';
import { createStore, type Store } from '../../src/state/store';
import { initialTour } from '../../src/tour/tourMachine';
import { createControlBar } from '../../src/ui/controlBar';
import { createLanguagePicker } from '../../src/ui/languagePicker';

function makeStore(lang: Lang = 'en'): Store<AppState> {
  return createStore<AppState>({
    lang,
    muted: true,
    selected: 'earth',
    view: 'focus',
    layout: 'mobile',
    quality: 'medium',
    tour: initialTour(14),
    ready: true,
  });
}

let root: HTMLElement;
let opener: HTMLButtonElement;

beforeEach(() => {
  root = document.createElement('div');
  opener = document.createElement('button');
  root.append(opener);
  document.body.append(root);
});
afterEach(() => {
  root.remove();
});

function setup(lang: Lang = 'en') {
  const store = makeStore(lang);
  const onSelect = vi.fn((l: Lang) => store.set({ lang: l }));
  const picker = createLanguagePicker(root, store, onSelect);
  const overlay = () => root.querySelector<HTMLElement>('[data-testid="lang-picker"]')!;
  const dialog = () => overlay().querySelector<HTMLElement>('[role="dialog"]')!;
  const option = (l: Lang) =>
    overlay().querySelector<HTMLButtonElement>(`[data-testid="lang-option-${l}"]`)!;
  const close = () => overlay().querySelector<HTMLButtonElement>('[data-testid="lang-close"]')!;
  const openIt = () => {
    opener.focus();
    picker.open();
  };
  return { store, onSelect, picker, overlay, dialog, option, close, openIt };
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));

describe('language picker', () => {
  it('starts hidden and opens as a labelled modal dialog', () => {
    const p = setup();
    expect(p.overlay().hidden).toBe(true);
    p.openIt();
    expect(p.overlay().hidden).toBe(false);
    expect(p.dialog().getAttribute('aria-modal')).toBe('true');
    expect(p.dialog().getAttribute('aria-labelledby')).toBeTruthy();
    const titleId = p.dialog().getAttribute('aria-labelledby')!;
    expect(document.getElementById(titleId)?.textContent).toBe(UI_STRINGS.en['lang.title']);
  });

  it('lists exactly vi, en, ja by native name, each tagged with its own lang', () => {
    const p = setup();
    const options = [...p.overlay().querySelectorAll('[data-testid^="lang-option-"]')];
    expect(options.map((o) => o.getAttribute('data-testid'))).toEqual([
      'lang-option-vi',
      'lang-option-en',
      'lang-option-ja',
    ]);
    expect(p.option('vi').textContent).toContain('Tiếng Việt');
    expect(p.option('en').textContent).toContain('English');
    expect(p.option('ja').textContent).toContain('日本語');
    expect(p.option('ja').getAttribute('lang')).toBe('ja');
    expect(p.overlay().textContent).not.toMatch(/한국어|Deutsch|Русский/);
  });

  it('marks the current locale and moves focus to it on open', () => {
    const p = setup('ja');
    p.openIt();
    expect(p.option('ja').getAttribute('aria-current')).toBe('true');
    expect(p.option('en').hasAttribute('aria-current')).toBe(false);
    expect(document.activeElement).toBe(p.option('ja'));
  });

  it('selecting Japanese calls onSelect, closes, and returns focus to the opener', () => {
    const p = setup('en');
    p.openIt();
    p.option('ja').click();
    expect(p.onSelect).toHaveBeenCalledWith('ja');
    expect(p.overlay().hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('re-renders texts and the current mark in the new language', () => {
    const p = setup('en');
    p.store.set({ lang: 'ja' });
    expect(p.close().textContent).toBe(UI_STRINGS.ja['lang.close']);
    expect(p.option('ja').getAttribute('aria-current')).toBe('true');
    expect(p.option('en').hasAttribute('aria-current')).toBe(false);
  });

  it('selecting the current locale just closes', () => {
    const p = setup('vi');
    p.openIt();
    p.option('vi').click();
    expect(p.onSelect).not.toHaveBeenCalled();
    expect(p.overlay().hidden).toBe(true);
  });

  it('closes on Escape, the close button and a backdrop click, without selecting', () => {
    const p = setup();
    p.openIt();
    key('Escape');
    expect(p.overlay().hidden).toBe(true);
    expect(document.activeElement).toBe(opener);

    p.openIt();
    p.close().click();
    expect(p.overlay().hidden).toBe(true);
    expect(document.activeElement).toBe(opener);

    p.openIt();
    p.dialog().click(); // inside the dialog: stays open
    expect(p.overlay().hidden).toBe(false);
    p.overlay().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(p.overlay().hidden).toBe(true);
    expect(p.onSelect).not.toHaveBeenCalled();
  });

  it('keeps the app selection while opening and closing', () => {
    const p = setup();
    p.openIt();
    key('Escape');
    expect(p.store.get()).toMatchObject({ selected: 'earth', view: 'focus' });
  });

  it('traps Tab focus inside the dialog', () => {
    const p = setup('en');
    p.openIt();
    p.close().focus();
    const last = [...p.dialog().querySelectorAll<HTMLElement>('button')].at(-1)!;
    const first = p.dialog().querySelector<HTMLElement>('button')!;
    last.focus();
    key('Tab');
    expect(document.activeElement).toBe(first);
    first.focus();
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('ignores Escape and Tab while closed', () => {
    const p = setup();
    opener.focus();
    key('Escape');
    key('Tab');
    expect(document.activeElement).toBe(opener);
    expect(p.overlay().hidden).toBe(true);
  });

  it('follows the store layout for the mobile sheet', () => {
    const p = setup();
    expect(p.overlay().dataset.layout).toBe('mobile');
    p.store.set({ layout: 'desktop' });
    expect(p.overlay().dataset.layout).toBe('desktop');
  });

  it('dispose removes the overlay and its key listener', () => {
    const p = setup();
    p.picker.dispose();
    expect(root.querySelector('[data-testid="lang-picker"]')).toBeNull();
    expect(() => key('Escape')).not.toThrow();
  });
});

describe('control bar language opener', () => {
  it('is a compact 文A button that opens the picker', () => {
    const store = makeStore('ja');
    const actions = {
      openLanguagePicker: vi.fn(),
      toggleMute: vi.fn(),
      toggleTour: vi.fn(),
      openCredits: vi.fn(),
    };
    const bar = createControlBar(root, store, actions);
    const btn = root.querySelector<HTMLButtonElement>('[data-testid="lang"]')!;
    expect(btn.textContent).toBe('文A');
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn.getAttribute('aria-label')).toBe(UI_STRINGS.ja['lang.switch']);
    btn.click();
    expect(actions.openLanguagePicker).toHaveBeenCalledTimes(1);
    expect(store.get().lang).toBe('ja'); // opening alone changes nothing
    expect(document.documentElement.lang).toBe('ja');
    bar.dispose();
  });
});
