import * as THREE from 'three';
import './ui/styles.css';
import { createStore } from './state/store';
import type { ContentId } from './data/types';
import type { AppState } from './state/appState';
import { loadPrefs, savePref } from './state/prefs';
import { getLayout } from './ui/layout';
import { initialTier, tierSettings, type QualityTier } from './quality/tiers';
import { createFpsMonitor } from './quality/fpsMonitor';
import { createRuntimeQuality, isSoftwareRenderer } from './quality/runtime';
import {
  autostartStillWanted,
  initialTour,
  shouldAutostart,
  type TourEvent,
} from './tour/tourMachine';
import {
  TOUR_AUTOSTART_DELAY_MS,
  createTourController,
  type TourController,
  type TourDeps,
} from './tour/tourController';
import { createScaledTimers } from './tour/scaledTimers';
import type { NarrationManifest } from './tour/narration';
import tourScriptsEn from './data/tour/en.json';
import tourScriptsJa from './data/tour/ja.json';
import tourScriptsVi from './data/tour/vi.json';
import { TOUR_STOPS } from './data/tour/stops';
import {
  applyRendererSettings,
  createRenderer,
  getRendererName,
  isWebGLAvailable,
} from './scene/renderer';
import {
  listTextureKeys,
  loadHighTextures,
  loadTextureSet,
  makeFallbackTexture,
} from './scene/textures';
import { aggregateProgress, skyKey, skySet } from './scene/textureKeys';
import { createSky } from './scene/sky';
import { startLoop } from './scene/loop';
import { createPostFX } from './scene/postfx';
import { createSun } from './bodies/sun';
import { createSolarSystem } from './scene/solarSystem';
import { createPicker } from './interaction/picker';
import { createLabels } from './ui/labels';
import { createCameraRig } from './camera/cameraRig';
import { createLoadingScreen, showBootError, showWebglUnsupported } from './ui/loadingScreen';
import { createControlBar } from './ui/controlBar';
import { createCredits } from './ui/credits';
import { createLanguagePicker } from './ui/languagePicker';
import { createInfoPanel } from './ui/infoPanel';
import { createTourControls, isTourActive } from './ui/tourControls';
import { createSubtitles } from './ui/subtitles';
import { installE2EApi } from './debug/e2eApi';
import { createAudioEngine } from './audio/audioEngine';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function pickTier(search: string): QualityTier {
  const q = new URLSearchParams(search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return initialTier({
    isMobile: window.matchMedia('(pointer:coarse)').matches,
    dpr: window.devicePixelRatio || 1,
    cores: navigator.hardwareConcurrency || 4,
  });
}

async function loadNarrationManifest(): Promise<NarrationManifest | null> {
  // A missing or broken manifest only costs the audio: every stop falls back to
  // estimated timing with subtitles (Review Focus 4).
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/narration/manifest.json`);
    return res.ok ? ((await res.json()) as NarrationManifest) : null;
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const prefs = loadPrefs(safeStorage(), navigator.languages ?? [navigator.language]);
  document.documentElement.lang = prefs.lang;

  if (!isWebGLAvailable()) {
    showWebglUnsupported(root, prefs.lang);
    return;
  }

  const store = createStore<AppState>({
    lang: prefs.lang,
    muted: prefs.muted,
    selected: null,
    view: 'overview',
    layout: getLayout(window.innerWidth, window.innerHeight),
    quality: pickTier(window.location.search),
    tour: initialTour(TOUR_STOPS.length),
    ready: false,
  });
  const settings = tierSettings(store.get().quality);

  const storage = safeStorage();
  const params = new URLSearchParams(window.location.search);
  const isE2E = params.has('e2e');
  const manifestPromise = loadNarrationManifest();
  // Tour timers and camera-rig time; the e2e `setTimeScale` speeds both up.
  let rigTimeScale = 1;
  const tourTimers = createScaledTimers({
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    now: () => performance.now(),
  });
  // Created once the solar system exists; the loading screen covers the UI until then.
  let tour: TourController | null = null;
  const dispatchTour = (e: TourEvent): void => tour?.dispatch(e);
  // A manual tap, drag, zoom, selection or back pauses a running tour (spec §3.8),
  // and also cancels a pending first-visit autostart.
  let userInteracted = false;
  const interruptTour = (): void => {
    userInteracted = true;
    dispatchTour({ type: 'USER_INTERACTED' });
  };
  let tourSeen = prefs.tourSeen;
  const startTour = (): void => {
    // The "seen" flag is set when a tour starts, so autostart happens at most once.
    tourSeen = true;
    savePref(storage, 'tourSeen', true);
    dispatchTour({ type: 'START' });
  };
  // Audio starts only after a user gesture (spec §3.7). Every pointerdown re-runs the
  // idempotent unlock, which also resumes a context iOS suspended after an interruption.
  const audio = createAudioEngine();
  audio.setMuted(store.get().muted);
  window.addEventListener('pointerdown', () => void audio.unlock(), { capture: true });
  const setMuted = (muted: boolean): void => {
    // unlock() creates/resumes the context synchronously inside this click.
    void audio.unlock();
    audio.setMuted(muted);
    savePref(storage, 'muted', muted);
    store.set({ muted });
  };
  const credits = createCredits(root, store);
  // Only the language changes: selection, panel and tour state stay as they are.
  const languagePicker = createLanguagePicker(root, store, (lang) => {
    savePref(storage, 'lang', lang);
    store.set({ lang });
  });
  createControlBar(root, store, {
    openLanguagePicker: () => languagePicker.open(),
    toggleMute: () => setMuted(!store.get().muted),
    toggleTour() {
      if (isTourActive(store.get().tour.status)) dispatchTour({ type: 'EXIT' });
      else startTour();
    },
    openCredits: () => credits.open(),
  });

  createTourControls(root, store, dispatchTour);
  const subtitles = createSubtitles(root, store, {
    currentCue: () => tour?.currentCue() ?? null,
    onUnmute: () => setMuted(false),
  });

  const loading = createLoadingScreen(root, prefs.lang);
  const canvas = document.createElement('canvas');
  canvas.id = 'scene';
  root.prepend(canvas);
  // camera-controls reports drags (controlstart) but not taps or wheel zoom.
  canvas.addEventListener('pointerdown', interruptTour);
  canvas.addEventListener('wheel', interruptTour, { passive: true });

  const renderer = createRenderer(canvas, settings);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    20000,
  );
  const rig = createCameraRig(camera, canvas);
  rig.setLayout(store.get().layout);
  // Tour stops on a phone are framed above the compact subtitle dock.
  store.subscribe((s, prev) => {
    if (s.tour.status !== prev.tour.status) rig.setTourMode(isTourActive(s.tour.status));
  });
  const postfx = createPostFX(renderer, scene, camera, settings);

  // Runtime quality: the FPS monitor downgrades a tier; software rendering disables it (spec §11.4).
  let solarRef: ReturnType<typeof createSolarSystem> | null = null;
  // Orbit ribbons keep a constant pixel width: tell them the drawing buffer and pixel ratio.
  const drawingSize = new THREE.Vector2();
  const syncOrbitViewport = (): void => {
    renderer.getDrawingBufferSize(drawingSize);
    solarRef?.setViewport(drawingSize.x, drawingSize.y, renderer.getPixelRatio());
  };
  const rendererName = getRendererName(renderer);
  const software = isSoftwareRenderer(rendererName);
  console.info(
    `[quality] tier ${store.get().quality}, renderer ${rendererName ?? 'unknown'}${software ? ' (software: FPS monitor off)' : ''}`,
  );
  const runtimeQuality = createRuntimeQuality({
    monitor: createFpsMonitor(),
    software,
    getTier: () => store.get().quality,
    onDowngrade(next) {
      store.set({ quality: next });
      const s = tierSettings(next);
      // The loaded sky and textures stay; antialias is fixed at renderer creation.
      applyRendererSettings(renderer, s);
      syncOrbitViewport();
      postfx.setSettings(s);
      solarRef?.setTierSettings(s);
      console.info(`[quality] downgraded to ${next}`);
    },
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    postfx.setSize(window.innerWidth, window.innerHeight);
    syncOrbitViewport();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    const layout = getLayout(window.innerWidth, window.innerHeight);
    store.set({ layout });
    // Every resize (not only a layout switch) changes the aspect, so re-frame each time.
    rig.setLayout(layout);
  });

  // Selection flow; `selectBody` is replaced once the solar system exists.
  let selectBody = async (id: ContentId): Promise<void> => {
    store.set({ selected: id, view: 'focus' });
  };
  const userSelect = (id: ContentId): Promise<void> => {
    interruptTour();
    return selectBody(id);
  };
  const backToOverview = async (): Promise<void> => {
    interruptTour();
    store.set({ selected: null, view: 'overview' });
    audio.playWhoosh();
    await rig.flyToOverview();
  };
  createInfoPanel(root, store, () => void backToOverview());
  let cameraTargetId = (): ContentId | null => null;
  let projectBody: (id: ContentId) => { x: number; y: number } | null = () => null;

  installE2EApi({
    getState: () => store.get(),
    select: userSelect,
    overview: backToOverview,
    cameraTargetId: () => cameraTargetId(),
    projectBody: (id) => projectBody(id),
    tour: dispatchTour,
    pixelRatio: () => renderer.getPixelRatio(),
    downgradeQuality: () => runtimeQuality.downgrade(),
    orbitViewport: () => {
      const mesh = solarRef?.root.getObjectByName('orbit-line') as THREE.Mesh | undefined;
      const u = (mesh?.material as THREE.ShaderMaterial | undefined)?.uniforms;
      if (!u) return null;
      const v = u.uViewport?.value as THREE.Vector2;
      return { width: v.x, height: v.y, pixelRatio: u.uPixelRatio?.value as number };
    },
    // Read the belt fresh: it can be swapped for a bigger InstancedMesh on growth.
    asteroidCount: () =>
      (
        solarRef?.root.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as
          THREE.InstancedMesh | undefined
      )?.count ?? 0,
    // e2e only: speeds up the tour timers (narration, gap) and camera-rig time (flights,
    // auto-orbit), which is frame-bound and slow on software GL. Orbits keep real time.
    setTimeScale: (n) => {
      if (!Number.isFinite(n) || n <= 0) return;
      tourTimers.setScale(n);
      rigTimeScale = n;
    },
  });

  const lowKeys = (await listTextureKeys('low')).filter((k) => !k.startsWith('sky'));
  const parts = [
    { loaded: 0, total: lowKeys.length },
    { loaded: 0, total: 1 },
  ];
  const report = (): void => loading.setProgress(aggregateProgress(parts));
  const sky = settings.skySize;
  const [lowTex, skyTex, manifest] = await Promise.all([
    loadTextureSet('low', lowKeys, (loaded, total) => {
      parts[0] = { loaded, total };
      report();
    }),
    loadTextureSet(skySet(sky), [skyKey(sky)], (loaded, total) => {
      parts[1] = { loaded, total };
      report();
    }),
    manifestPromise,
  ]);
  const skyTexture = skyTex.get(skyKey(sky));
  if (skyTexture) scene.add(createSky(skyTexture));
  const sun = createSun(lowTex.get('sun') ?? makeFallbackTexture('sun'));
  scene.add(sun.group);
  const solar = createSolarSystem(lowTex, tierSettings(store.get().quality));
  solarRef = solar;
  scene.add(solar.root);
  syncOrbitViewport();
  solar.setOrbitFocus(store.get().view !== 'overview');

  selectBody = async (id) => {
    store.set({ selected: id, view: 'focus' });
    audio.playWhoosh();
    await rig.flyTo(solar.getFocusTarget(id));
    upgradeOnArrival(id);
  };
  // Only the high tier swaps in the large maps, and only once the camera has arrived.
  // A superseded flight resolves early, so also check the camera really is on this body.
  const upgradeOnArrival = (id: ContentId): void => {
    const s = store.get();
    const arrived = s.selected === id && s.view === 'focus' && cameraTargetId() === id;
    if (arrived && id !== 'asteroid-belt' && tierSettings(s.quality).textureSet === 'high') {
      loadHighTextures(id)
        .then((tex) => solar.upgradeTextures(id, tex))
        .catch(() => undefined);
    }
  };
  const select = (id: ContentId): void => void userSelect(id);
  const contentIds: ContentId[] = [...solar.bodies.keys(), 'asteroid-belt'];
  cameraTargetId = () => {
    const t = rig.getTarget();
    return t
      ? (contentIds.find((id) => solar.getFocusTarget(id).object === t.object) ?? null)
      : null;
  };
  const projected = new THREE.Vector3();
  projectBody = (id) => {
    solar.getFocusTarget(id).object.getWorldPosition(projected);
    camera.updateMatrixWorld();
    projected.project(camera);
    if (Math.abs(projected.z) > 1) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
  };
  const labels = createLabels(root, solar.bodies, camera, () => store.get().lang, {
    onSelect: select,
    isMobile: () => store.get().layout === 'mobile',
  });
  createPicker(canvas, camera, solar.pickables, select, (id) => labels.setHovered(id));
  labels.setVisible(store.get().view === 'overview');
  store.subscribe((s, prev) => {
    if (s.view !== prev.view) {
      labels.setVisible(s.view === 'overview');
      solar.setOrbitFocus(s.view !== 'overview');
    }
  });

  // Tour flights get the same whoosh and high-res upgrade as a manual selection.
  const tourRig: TourDeps['rig'] = {
    async flyTo(target) {
      audio.playWhoosh();
      await rig.flyTo(target);
      const id = cameraTargetId();
      if (id) upgradeOnArrival(id);
    },
    flyToOverview() {
      audio.playWhoosh();
      return rig.flyToOverview();
    },
    setAutoOrbit: (on) => rig.setAutoOrbit(on),
    onUserInteract: (cb) => rig.onUserInteract(cb),
  };
  tour = createTourController({
    rig: tourRig,
    system: solar,
    audio,
    store,
    manifest,
    scripts: { vi: tourScriptsVi, en: tourScriptsEn, ja: tourScriptsJa },
    timers: tourTimers,
    audioUrl: (file) => `${import.meta.env.BASE_URL}${file}`,
  });
  const scheduleAutostart = (): void => {
    if (!shouldAutostart(tourSeen, isE2E, params.has('autostart'))) return;
    window.setTimeout(() => {
      // Skip if the user started a tour, touched the scene or selected a body meanwhile.
      if (autostartStillWanted({ tourSeen, userInteracted, selected: store.get().selected })) {
        startTour();
      }
    }, TOUR_AUTOSTART_DELAY_MS);
  };

  startLoop((dt, tSec) => {
    runtimeQuality.frame(dt * 1000, {
      visible: !document.hidden,
      transitioning: rig.isFlying(),
    });
    sun.update(tSec);
    solar.update(tSec);
    rig.update(dt * rigTimeScale);
    solar.applyOverviewBoost(camera, canvas.clientHeight || window.innerHeight);
    labels.update();
    subtitles.update();
    postfx.render();
    if (!store.get().ready) {
      store.set({ ready: true });
      loading.hide();
      scheduleAutostart();
    }
  });
}

boot().catch((err: unknown) => {
  console.warn('Boot failed', err);
  const root = document.getElementById('app');
  if (root) showBootError(root, loadPrefs(safeStorage(), navigator.languages ?? []).lang);
});
