import { t } from '../i18n/i18n';
import type { AppState } from '../state/appState';
import type { Store } from '../state/store';

export interface ControlActions {
  openLanguagePicker(): void;
  toggleMute(): void;
  toggleTour(): void;
  openCredits(): void;
}

/** A press on the canvas counts as a drag once the pointer moved this far. */
const DRAG_DISMISS_PX = 8;

function button(testId: string, text = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ctl-btn glass';
  b.setAttribute('data-testid', testId);
  b.textContent = text;
  return b;
}

/**
 * Title, top-right control cluster, bottom hint and the "not to scale" note.
 * All text re-renders on store changes; the hint also follows `layout` and hides after
 * the first selection or drag.
 */
export function createControlBar(
  root: HTMLElement,
  store: Store<AppState>,
  actions: ControlActions,
): { dispose(): void } {
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.setAttribute('data-testid', 'title');

  const cluster = document.createElement('div');
  cluster.className = 'control-cluster';
  const lang = button('lang', '文A');
  lang.setAttribute('aria-haspopup', 'dialog');
  const sound = button('sound');
  const tour = button('tour');
  const tourIcon = document.createElement('span');
  tourIcon.setAttribute('aria-hidden', 'true');
  const tourText = document.createElement('span');
  tourText.className = 'ctl-label';
  tour.append(tourIcon, tourText);
  const credits = button('credits', 'ⓘ');
  cluster.append(lang, sound, tour, credits);

  const hint = document.createElement('p');
  hint.className = 'hint glass';
  hint.setAttribute('data-testid', 'hint');
  const note = document.createElement('p');
  note.className = 'not-to-scale';
  note.setAttribute('data-testid', 'not-to-scale');
  root.append(title, cluster, hint, note);

  let hintDismissed = false;
  const render = (): void => {
    const s = store.get();
    document.documentElement.lang = s.lang;
    title.textContent = t(s.lang, 'appTitle');
    lang.setAttribute('aria-label', t(s.lang, 'lang.switch'));
    // The label names the action, like `tour.start`: muted -> "Sound on".
    sound.textContent = s.muted ? '🔇' : '🔊';
    sound.setAttribute('aria-label', t(s.lang, s.muted ? 'sound.on' : 'sound.off'));
    sound.setAttribute('aria-pressed', String(!s.muted));
    const running = s.tour.status !== 'idle' && s.tour.status !== 'finished';
    const tourLabel = t(s.lang, running ? 'tour.stop' : 'tour.start');
    tourIcon.textContent = running ? '■' : '▶';
    tourText.textContent = tourLabel;
    tour.setAttribute('aria-label', tourLabel);
    credits.setAttribute('aria-label', t(s.lang, 'credits.title'));
    hint.textContent = t(s.lang, s.layout === 'mobile' ? 'hintMobile' : 'hintDesktop');
    hint.hidden = hintDismissed;
    note.textContent = t(s.lang, 'notToScale');
  };
  render();

  const dismissHint = (): void => {
    if (hintDismissed) return;
    hintDismissed = true;
    hint.hidden = true;
  };
  lang.addEventListener('click', () => actions.openLanguagePicker());
  sound.addEventListener('click', () => actions.toggleMute());
  tour.addEventListener('click', () => actions.toggleTour());
  credits.addEventListener('click', () => actions.openCredits());

  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent): void => {
    down = e.target instanceof HTMLCanvasElement ? { x: e.clientX, y: e.clientY } : null;
  };
  const onMove = (e: PointerEvent): void => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_DISMISS_PX) {
      dismissHint();
    }
  };
  const onUp = (): void => {
    down = null;
  };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  const unsub = store.subscribe((s, prev) => {
    if (s.selected !== null && s.selected !== prev.selected) dismissHint();
    render();
  });

  return {
    dispose() {
      unsub();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      title.remove();
      cluster.remove();
      hint.remove();
      note.remove();
    },
  };
}
