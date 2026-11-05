import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_MAX_MOVE_PX, TAP_MAX_MS, createPicker, isTap } from '../../src/interaction/picker';
import { createLabels } from '../../src/ui/labels';
import { createSolarSystem } from '../../src/scene/solarSystem';
import { OVERVIEW_FIT_RADIUS, overviewFrame, overviewPolar } from '../../src/camera/framing';
import { tierSettings } from '../../src/quality/tiers';
import type { BodyId } from '../../src/data/types';

const p = (x: number, y: number, t: number) => ({ x, y, t });

describe('isTap', () => {
  it('accepts a short, small gesture', () => {
    expect(isTap(p(0, 0, 0), p(3, 4, 200))).toBe(true);
  });
  it('rejects a move of 8 px or more', () => {
    expect(TAP_MAX_MOVE_PX).toBe(8);
    expect(isTap(p(0, 0, 0), p(10, 0, 100))).toBe(false);
  });
  it('rejects a long press', () => {
    expect(TAP_MAX_MS).toBe(350);
    expect(isTap(p(0, 0, 0), p(0, 0, 400))).toBe(false);
  });
});

function pointer(type: string, id: number, x: number, y: number): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: id });
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  return e;
}

function setup() {
  const dom = document.createElement('canvas');
  document.body.append(dom);
  dom.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 400,
    right: 400,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const hit = new THREE.Mesh();
  hit.userData.bodyId = 'earth';
  // A pickable whose raycast always hits.
  hit.raycast = (_rc, out) => {
    out.push({ distance: 1, point: new THREE.Vector3(), object: hit });
  };
  const onPick = vi.fn<(id: BodyId) => void>();
  const picker = createPicker(dom, camera, [hit], onPick);
  return { dom, onPick, picker };
}

describe('createPicker', () => {
  let cleanup: (() => void) | null = null;
  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('selects on a tap', () => {
    const { dom, onPick, picker } = setup();
    cleanup = picker.dispose;
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 102, 101));
    expect(onPick).toHaveBeenCalledWith('earth');
  });

  it('does not select when a drag ends over a body', () => {
    const { dom, onPick, picker } = setup();
    cleanup = picker.dispose;
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointermove', 1, 130, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 130, 100));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('does not select when a drag wanders past 8 px and returns to the start', () => {
    const { dom, onPick, picker } = setup();
    cleanup = picker.dispose;
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointermove', 1, 130, 100));
    dom.dispatchEvent(pointer('pointermove', 1, 101, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 101, 100));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('does not select when a second pointer joined the gesture', () => {
    const { dom, onPick, picker } = setup();
    cleanup = picker.dispose;
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointerdown', 2, 120, 100));
    dom.dispatchEvent(pointer('pointerup', 2, 120, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 100, 100));
    expect(onPick).not.toHaveBeenCalled();
    // A fresh single-pointer tap afterwards works again.
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('stops listening after dispose', () => {
    const { dom, onPick, picker } = setup();
    picker.dispose();
    dom.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    dom.dispatchEvent(pointer('pointerup', 1, 100, 100));
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('createPicker with overlapping enlarged proxies', () => {
  function proxy(id: BodyId, x: number, z: number, proxyR: number, shown: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(proxyR, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    m.position.set(x, 0, z);
    m.userData.bodyId = id;
    m.userData.shownRadius = shown;
    m.updateMatrixWorld(true);
    return m;
  }
  function tapAt(world: THREE.Vector3, others: THREE.Mesh[]): BodyId | undefined {
    const dom = document.createElement('canvas');
    document.body.append(dom);
    dom.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
      }) as DOMRect;
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const onPick = vi.fn<(id: BodyId) => void>();
    const picker = createPicker(dom, camera, others, onPick);
    const s = world.clone().project(camera);
    const x = ((s.x + 1) / 2) * 400;
    const y = ((1 - s.y) / 2) * 400;
    dom.dispatchEvent(pointer('pointerdown', 1, x, y));
    dom.dispatchEvent(pointer('pointerup', 1, x, y));
    picker.dispose();
    dom.remove();
    return onPick.mock.calls[0]?.[0];
  }

  it('picks the body whose visible disc is under the tap, not a nearer enlarged proxy', () => {
    const earth = proxy('earth', 0, 0, 3, 1);
    const mars = proxy('mars', 2.5, -5, 2, 1.2);
    expect(tapAt(mars.position, [earth, mars])).toBe('mars');
  });

  it('a nearer body whose visible disc covers the tap wins over one behind it', () => {
    const earth = proxy('earth', 0, 0, 3, 2.5);
    const mars = proxy('mars', 1, -5, 2, 1.2);
    expect(tapAt(mars.position, [earth, mars])).toBe('earth');
  });

  it('a tap that misses every visible disc picks the proxy centred closest to it', () => {
    const earth = proxy('earth', 0, 0, 3, 0.5);
    const mars = proxy('mars', 2.5, -5, 3, 0.5);
    const between = new THREE.Vector3(2.4, 0.8, -5);
    expect(tapAt(between, [earth, mars])).toBe('mars');
  });
});

describe('createLabels', () => {
  function labelSetup(getLang: () => 'vi' | 'en' = () => 'en', isMobile = false) {
    const tex = new Map<string, THREE.Texture>();
    const solar = createSolarSystem(tex, tierSettings('low'));
    solar.root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
    const polar = overviewPolar(camera.aspect);
    const frame = overviewFrame(OVERVIEW_FIT_RADIUS, camera.fov, camera.aspect, polar);
    camera.position.setFromSphericalCoords(frame.distance, polar, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const container = document.createElement('div');
    const onSelect = vi.fn<(id: BodyId) => void>();
    const labels = createLabels(container, solar.bodies, camera, getLang, {
      onSelect,
      isMobile: () => isMobile,
    });
    const el = (id: string) => container.querySelector<HTMLElement>(`[data-body="${id}"]`);
    return { container, labels, el, camera, onSelect };
  }

  it('shows the always-visible set in overview and hides the rest on desktop', () => {
    const { labels, el } = labelSetup();
    labels.update();
    expect(el('earth')?.hidden).toBe(false);
    expect(el('pluto')?.hidden).toBe(false);
    expect(el('jupiter')?.hidden).toBe(true);
  });

  it('shows every label on mobile and the hovered one on desktop', () => {
    const m = labelSetup(() => 'en', true);
    m.labels.update();
    expect(m.el('jupiter')?.hidden).toBe(false);
    const d = labelSetup();
    d.labels.setHovered('jupiter');
    d.labels.update();
    expect(d.el('jupiter')?.hidden).toBe(false);
  });

  it('hides all labels when not visible (focus view)', () => {
    const { labels, el } = labelSetup();
    labels.setVisible(false);
    labels.update();
    expect(el('earth')?.hidden).toBe(true);
  });

  it('hides labels behind the camera', () => {
    const { labels, el, camera } = labelSetup();
    camera.position.set(0, 0, -500);
    camera.lookAt(0, 0, -1000);
    camera.updateMatrixWorld(true);
    labels.update();
    expect(el('earth')?.hidden).toBe(true);
  });

  it('uses the current language and selects on click', () => {
    let lang: 'vi' | 'en' = 'en';
    const { labels, el, onSelect } = labelSetup(() => lang);
    labels.update();
    expect(el('earth')?.textContent).toBe('Earth');
    lang = 'vi';
    labels.update();
    expect(el('earth')?.textContent).toBe('Trái Đất');
    el('earth')?.click();
    expect(onSelect).toHaveBeenCalledWith('earth');
  });

  it('hides labels that would overlap a higher-priority one; Earth always stays', () => {
    const w = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(60);
    const h = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(16);
    try {
      const { labels, el, camera, container } = labelSetup(() => 'en', true);
      // Far away: the inner bodies crowd around the Sun.
      camera.position.set(0, 1200, 2000);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      labels.update();
      const shown = [...container.querySelectorAll<HTMLElement>('.body-label')].filter(
        (e) => !e.hidden,
      );
      expect(el('earth')?.hidden).toBe(false);
      expect(shown.length).toBeLessThan(11);
      const rects = shown.map((e) => {
        const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(e.style.transform)!;
        return { x: Number(m[1]), y: Number(m[2]) };
      });
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = Math.abs(a.x - b.x) < 60 && Math.abs(a.y - b.y) < 16;
          expect(overlap).toBe(false);
        }
    } finally {
      w.mockRestore();
      h.mockRestore();
    }
  });
});
