import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUR_STOPS } from '../../src/data/tour/stops';
import de from '../../src/data/tour/de.json';
import en from '../../src/data/tour/en.json';
import ja from '../../src/data/tour/ja.json';
import vi_ from '../../src/data/tour/vi.json';
import type { ContentId } from '../../src/data/types';
import type { AppState } from '../../src/state/appState';
import { createStore, type Store } from '../../src/state/store';
import {
  createTourController,
  NARRATION_STALL_GRACE_MS,
  type TourDeps,
} from '../../src/tour/tourController';
import { estimateDurationMs, type NarrationManifest } from '../../src/tour/narration';
import { TOUR_GAP_MS, initialTour } from '../../src/tour/tourMachine';
import { NARRATION_LOAD_TIMEOUT_MS, type NarrationResult } from '../../src/audio/audioEngine';

const scripts = { vi: vi_, en, ja, de } as TourDeps['scripts'];

function makeStore(muted: boolean): Store<AppState> {
  return createStore<AppState>({
    lang: 'en',
    muted,
    selected: null,
    view: 'overview',
    layout: 'desktop',
    quality: 'medium',
    tour: initialTour(TOUR_STOPS.length),
    ready: true,
  });
}

interface Pending<T> {
  resolve: (v: T) => void;
}

function makeRig() {
  const flights: { target: string; done: Pending<void> }[] = [];
  const interact = new Set<() => void>();
  const rig = {
    flyTo: vi.fn((t: { object: { name: string } }) => {
      return new Promise<void>((resolve) =>
        flights.push({ target: t.object.name, done: { resolve } }),
      );
    }),
    flyToOverview: vi.fn(() => {
      return new Promise<void>((resolve) =>
        flights.push({ target: 'overview', done: { resolve } }),
      );
    }),
    setAutoOrbit: vi.fn(),
    onUserInteract: vi.fn((cb: () => void) => {
      interact.add(cb);
      return () => interact.delete(cb);
    }),
  };
  return { rig, flights, interact };
}

function makeAudio() {
  const plays: { url: string; done: Pending<NarrationResult> }[] = [];
  const audio = {
    playNarration: vi.fn(
      (url: string) =>
        new Promise<NarrationResult>((resolve) => plays.push({ url, done: { resolve } })),
    ),
    stopNarration: vi.fn(),
    narrationTimeMs: 0,
  };
  return { audio, plays };
}

const system = {
  getFocusTarget: (id: ContentId) => ({ object: { name: id }, radius: 1 }),
};

const timers: TourDeps['timers'] = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
  now: () => Date.now(),
};

function manifestFor(durationMs: number): NarrationManifest {
  const segments = {} as NarrationManifest['segments'];
  for (const stop of TOUR_STOPS) {
    segments[stop.id] = {
      en: {
        file: `audio/narration/${stop.id}.en.mp3`,
        durationMs,
        cues: [
          { startMs: 0, endMs: durationMs / 2, text: `${stop.id} first` },
          { startMs: durationMs / 2, endMs: durationMs, text: `${stop.id} second` },
        ],
      },
    };
  }
  return { version: 1, segments };
}

function setup(opts: { muted: boolean; manifest: NarrationManifest | null }) {
  const store = makeStore(opts.muted);
  const r = makeRig();
  const a = makeAudio();
  const tour = createTourController({
    rig: r.rig as unknown as TourDeps['rig'],
    system: system as unknown as TourDeps['system'],
    audio: a.audio,
    store,
    manifest: opts.manifest,
    scripts,
    timers,
  });
  return { store, tour, ...r, ...a };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('tour controller (muted, subtitle-only timing)', () => {
  it('flies, narrates for durationMs, waits the gap, then flies to the next stop', async () => {
    const t = setup({ muted: true, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    expect(t.store.get().tour.status).toBe('flying');
    expect(t.rig.flyToOverview).toHaveBeenCalledTimes(1);
    expect(t.store.get()).toMatchObject({ selected: null, view: 'overview' });

    t.flights[0]!.done.resolve();
    await flush();
    expect(t.store.get().tour.status).toBe('narrating');
    expect(t.rig.setAutoOrbit).toHaveBeenLastCalledWith(true);
    expect(t.audio.playNarration).not.toHaveBeenCalled();
    expect(t.tour.currentCue()?.text).toBe('intro first');

    await vi.advanceTimersByTimeAsync(6_000);
    expect(t.tour.currentCue()?.text).toBe('intro second');
    await vi.advanceTimersByTimeAsync(4_000);
    expect(t.store.get().tour.status).toBe('gap');
    expect(t.tour.currentCue()).toBeNull();

    await vi.advanceTimersByTimeAsync(TOUR_GAP_MS - 1);
    expect(t.store.get().tour.status).toBe('gap');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.store.get().tour).toMatchObject({ status: 'flying', index: 1 });
    expect(t.flights[1]!.target).toBe('sun');
    expect(t.store.get()).toMatchObject({ selected: 'sun', view: 'focus' });
  });

  it('uses estimateDurationMs and proportional cues without a manifest', async () => {
    const t = setup({ muted: false, manifest: null });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    expect(t.audio.playNarration).not.toHaveBeenCalled();
    expect(t.tour.currentCue()?.text.length).toBeGreaterThan(0);
    const d = estimateDurationMs(en.intro.text, 'en');
    await vi.advanceTimersByTimeAsync(d - 1);
    expect(t.store.get().tour.status).toBe('narrating');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.store.get().tour.status).toBe('gap');
  });

  it('runs to finished and mirrors the snapshot into the store', async () => {
    const t = setup({ muted: true, manifest: manifestFor(5_000) });
    t.tour.dispatch({ type: 'START' });
    for (let i = 0; i < TOUR_STOPS.length; i++) {
      expect(t.store.get().tour).toMatchObject({ status: 'flying', index: i });
      t.flights[i]!.done.resolve();
      await flush();
      await vi.advanceTimersByTimeAsync(5_000 + TOUR_GAP_MS);
    }
    expect(t.store.get().tour.status).toBe('finished');
    expect(t.store.get()).toMatchObject({ selected: null, view: 'overview' });
    expect(t.rig.setAutoOrbit).toHaveBeenLastCalledWith(false);
  });
});

describe('tour controller (audio)', () => {
  it('plays the stop audio and advances on ended', async () => {
    const t = setup({ muted: false, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    expect(t.plays[0]!.url).toBe('audio/narration/intro.en.mp3');
    t.audio.narrationTimeMs = 7_000;
    expect(t.tour.currentCue()?.text).toBe('intro second');
    t.plays[0]!.done.resolve('ended');
    await flush();
    expect(t.store.get().tour.status).toBe('gap');
  });

  it('Review Focus 4: an error at 100 ms still waits until durationMs', async () => {
    const t = setup({ muted: false, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(100);
    t.plays[0]!.done.resolve('error');
    await flush();
    expect(t.store.get().tour.status).toBe('narrating');
    // Subtitles keep running on the clock after the error.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.tour.currentCue()?.text).toBe('intro second');
    await vi.advanceTimersByTimeAsync(4_899);
    expect(t.store.get().tour.status).toBe('narrating');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.store.get().tour.status).toBe('gap');
  });

  it('ends a clip that stalls after it started (watchdog)', async () => {
    const t = setup({ muted: false, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(
      10_000 + NARRATION_LOAD_TIMEOUT_MS + NARRATION_STALL_GRACE_MS - 1,
    );
    expect(t.store.get().tour.status).toBe('narrating');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.store.get().tour.status).toBe('gap');
    expect(t.audio.stopNarration).toHaveBeenCalled();
    // A late 'ended' from the abandoned clip does nothing.
    t.plays[0]!.done.resolve('ended');
    await flush();
    expect(t.store.get().tour.status).toBe('gap');
  });

  it('ignores a stopped result and a late ended after the user paused', async () => {
    const t = setup({ muted: false, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    t.tour.dispatch({ type: 'USER_INTERACTED' });
    expect(t.store.get().tour.status).toBe('paused');
    expect(t.audio.stopNarration).toHaveBeenCalled();
    t.plays[0]!.done.resolve('ended');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.store.get().tour.status).toBe('paused');
    expect(t.tour.currentCue()).toBeNull();
  });

  it('restarts the narration in the new language on LANG_CHANGED', async () => {
    const t = setup({ muted: false, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    t.store.set({ lang: 'vi' });
    // No vi entry in this manifest: subtitle-only fallback with the vi script.
    expect(t.audio.stopNarration).toHaveBeenCalled();
    expect(t.store.get().tour.status).toBe('narrating');
    expect(vi_.intro.text).toContain(t.tour.currentCue()!.text);
    t.plays[0]!.done.resolve('stopped');
    await flush();
    expect(t.store.get().tour.status).toBe('narrating');
  });

  it('switching to Japanese mid-stop replays the same stop with the ja clip and cues', async () => {
    const manifest = manifestFor(10_000);
    for (const stop of TOUR_STOPS) {
      manifest.segments[stop.id].ja = {
        file: `audio/narration/${stop.id}.ja.mp3`,
        durationMs: 12_000,
        cues: [{ startMs: 0, endMs: 12_000, text: `${stop.id} 日本語。` }],
      };
    }
    const t = setup({ muted: false, manifest });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    t.plays[0]!.done.resolve('ended');
    await vi.advanceTimersByTimeAsync(TOUR_GAP_MS);
    t.flights[1]!.done.resolve(); // second stop: the Sun
    await flush();
    expect(t.store.get().tour).toMatchObject({ status: 'narrating', index: 1 });
    expect(t.audio.playNarration).toHaveBeenLastCalledWith('audio/narration/sun.en.mp3');

    t.store.set({ lang: 'ja' });
    expect(t.audio.playNarration).toHaveBeenLastCalledWith('audio/narration/sun.ja.mp3');
    expect(t.store.get().tour).toMatchObject({ status: 'narrating', index: 1 });
    expect(t.tour.currentCue()?.text).toBe('sun 日本語。');
    expect(t.rig.flyTo).toHaveBeenCalledTimes(1); // no new flight: same stop
  });

  it('switching to Japanese while muted shows Japanese subtitles without audio', async () => {
    const t = setup({ muted: true, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    t.store.set({ lang: 'ja' });
    expect(t.audio.playNarration).not.toHaveBeenCalled();
    expect(t.store.get().tour).toMatchObject({ status: 'narrating', index: 0 });
    const cue = t.tour.currentCue()!.text;
    expect(ja.intro.text.startsWith(cue)).toBe(true);
    expect(cue.length).toBeLessThan(ja.intro.text.length); // split on 。！？, not one cue
    expect(cue.endsWith('！') || cue.endsWith('。') || cue.endsWith('？')).toBe(true);
  });

  it('starts the audio when the user unmutes during a subtitle-only stop', async () => {
    const t = setup({ muted: true, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    expect(t.audio.playNarration).not.toHaveBeenCalled();
    t.store.set({ muted: false });
    expect(t.audio.playNarration).toHaveBeenCalledWith('audio/narration/intro.en.mp3');
    // The old subtitle-only timer no longer ends the stop.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.store.get().tour.status).toBe('narrating');
    t.plays[0]!.done.resolve('ended');
    await flush();
    expect(t.store.get().tour.status).toBe('gap');
  });
});

describe('tour controller (flights and interaction)', () => {
  it('ignores a stale FLIGHT_DONE from a superseded flight', async () => {
    const t = setup({ muted: true, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.tour.dispatch({ type: 'NEXT' });
    expect(t.flights.map((f) => f.target)).toEqual(['overview', 'sun']);
    t.flights[0]!.done.resolve();
    await flush();
    expect(t.store.get().tour).toMatchObject({ status: 'flying', index: 1 });
    t.flights[1]!.done.resolve();
    await flush();
    expect(t.store.get().tour).toMatchObject({ status: 'narrating', index: 1 });
  });

  it('ignores a flight that completes after the user paused, then resume re-flies', async () => {
    const t = setup({ muted: true, manifest: manifestFor(10_000) });
    t.tour.dispatch({ type: 'START' });
    t.tour.dispatch({ type: 'NEXT' });
    t.interact.forEach((cb) => cb());
    expect(t.store.get().tour).toMatchObject({ status: 'paused', index: 1 });
    t.flights[1]!.done.resolve();
    await flush();
    expect(t.store.get().tour.status).toBe('paused');
    t.tour.dispatch({ type: 'RESUME' });
    expect(t.flights[2]!.target).toBe('sun');
    t.flights[2]!.done.resolve();
    await flush();
    expect(t.store.get().tour.status).toBe('narrating');
  });

  it('cancels the gap timer on EXIT', async () => {
    const t = setup({ muted: true, manifest: manifestFor(5_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.store.get().tour.status).toBe('gap');
    t.tour.dispatch({ type: 'EXIT' });
    await vi.advanceTimersByTimeAsync(TOUR_GAP_MS * 2);
    expect(t.store.get().tour.status).toBe('idle');
    expect(t.flights).toHaveLength(1);
  });

  it('dispose stops listening and clears timers', async () => {
    const t = setup({ muted: true, manifest: manifestFor(5_000) });
    t.tour.dispatch({ type: 'START' });
    t.flights[0]!.done.resolve();
    await flush();
    t.tour.dispose();
    expect(t.interact.size).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.store.get().tour.status).toBe('narrating');
  });
});
