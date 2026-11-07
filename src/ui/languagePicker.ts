import { SUPPORTED_LANGS, type Lang } from '../data/types';
import { t } from '../i18n/i18n';
import { LANG_NATIVE_NAMES } from '../i18n/strings';
import type { AppState } from '../state/appState';
import type { Store } from '../state/store';

export interface LanguagePicker {
  open(): void;
  dispose(): void;
}

let nextId = 0;

/**
 * Language picker modal (spec §3.2): one button per supported locale, labelled with its
 * native name; a bottom sheet on the mobile layout, a centred dialog on desktop. It never
 * touches the selection or the tour: choosing a locale calls `onSelect` and closes, and
 * closing returns focus to the element that opened it.
 */
export function createLanguagePicker(
  root: HTMLElement,
  store: Store<AppState>,
  onSelect: (lang: Lang) => void,
): LanguagePicker {
  const titleId = `lang-picker-title-${nextId++}`;
  const overlay = document.createElement('div');
  overlay.className = 'lang-overlay';
  overlay.setAttribute('data-testid', 'lang-picker');
  overlay.hidden = true;
  const dialog = document.createElement('div');
  dialog.className = 'lang-dialog glass';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  const title = document.createElement('h2');
  title.className = 'lang-title';
  title.id = titleId;
  const list = document.createElement('div');
  list.className = 'lang-list';

  const options = new Map<Lang, HTMLButtonElement>();
  for (const lang of SUPPORTED_LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctl-btn glass lang-option';
    b.setAttribute('data-testid', `lang-option-${lang}`);
    b.lang = lang;
    const name = document.createElement('span');
    name.textContent = LANG_NATIVE_NAMES[lang];
    const mark = document.createElement('span');
    mark.className = 'lang-check';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✓';
    b.append(name, mark);
    b.addEventListener('click', () => choose(lang));
    options.set(lang, b);
    list.append(b);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ctl-btn glass lang-close';
  close.setAttribute('data-testid', 'lang-close');
  dialog.append(title, list, close);
  overlay.append(dialog);
  root.append(overlay);

  const render = (): void => {
    const { lang, layout } = store.get();
    overlay.dataset.layout = layout;
    title.textContent = t(lang, 'lang.title');
    close.textContent = t(lang, 'lang.close');
    for (const [code, b] of options) {
      if (code === lang) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
  };
  render();

  let opener: Element | null = null;
  const hide = (): void => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    if (opener instanceof HTMLElement) opener.focus();
    opener = null;
  };
  const show = (): void => {
    if (!overlay.hidden) return;
    opener = document.activeElement;
    render();
    overlay.hidden = false;
    (options.get(store.get().lang) ?? close).focus();
  };
  function choose(lang: Lang): void {
    const changed = lang !== store.get().lang;
    hide();
    if (changed) onSelect(lang);
  }

  const focusables = (): HTMLElement[] => [...dialog.querySelectorAll<HTMLElement>('button')];
  const onKey = (e: KeyboardEvent): void => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    } else if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const onOverlayClick = (e: MouseEvent): void => {
    if (e.target === overlay) hide();
  };
  close.addEventListener('click', hide);
  overlay.addEventListener('click', onOverlayClick);
  window.addEventListener('keydown', onKey);
  const unsub = store.subscribe((s, prev) => {
    if (s.lang !== prev.lang || s.layout !== prev.layout) render();
  });

  return {
    open: show,
    dispose() {
      unsub();
      window.removeEventListener('keydown', onKey);
      overlay.remove();
    },
  };
}
