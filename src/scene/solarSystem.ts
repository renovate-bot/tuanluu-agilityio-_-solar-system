import * as THREE from 'three';
import { BODIES } from '../data/bodies';
import { BODY_IDS, type BodyId, type ContentId } from '../data/types';
import type { TierSettings } from '../quality/tiers';
import {
  ASTEROID_BELT_MKM,
  MOON_ORBIT_DISPLAY,
  displayOrbitRadius,
  displayRadius,
} from '../config/scale';
import { overviewBoost } from '../camera/framing';
import {
  PICK_MIN_RADIUS,
  PICK_SCALE,
  createPickProxy,
  createPlanet,
  sphereSegments,
  type BodyObject,
  type PlanetRig,
} from '../bodies/planet';
import {
  CLOUD_SPIN_FACTOR,
  createAtmosphere,
  createCloudLayer,
  createEarthMaterial,
} from '../bodies/earth';
import { createRing } from '../bodies/rings';
import { createAsteroidBelt } from '../bodies/asteroidBelt';
import { createOrbitLine, type OrbitLine } from '../bodies/orbitLine';
import { ORBIT_STYLE, stepEmphasis } from '../bodies/orbitMath';
import { isFallbackTexture, makeFallbackTexture } from './textures';

export type { BodyObject };

export interface FocusTarget {
  object: THREE.Object3D;
  radius: number;
}

export interface SolarSystem {
  root: THREE.Group;
  bodies: Map<BodyId, BodyObject>;
  pickables: THREE.Object3D[];
  update(tSec: number): void;
  getFocusTarget(id: ContentId): FocusTarget;
  setTierSettings(s: TierSettings): void;
  /** Swaps in higher-resolution maps; fallback stand-ins are ignored. */
  upgradeTextures(id: BodyId, tex: Map<string, THREE.Texture>): void;
  /**
   * Screen-space minimum size: scales each far body up (`overviewBoost`) so it stays
   * visible on a view `viewH` CSS px tall; a body the camera is near keeps its true size.
   * Hides the Moon while a boosted Earth would cover its orbit.
   */
  applyOverviewBoost(camera: THREE.PerspectiveCamera, viewH: number): void;
  /** Keeps the orbit ribbons a constant pixel width: drawing-buffer size and pixel ratio. */
  setViewport(drawingWidthPx: number, drawingHeightPx: number, pixelRatio: number): void;
  /** Dims the orbit ribbons while the camera is focused on a body. */
  setOrbitFocus(focused: boolean): void;
}

const BELT_FOCUS_RADIUS = 12;

/**
 * Texture keys per body, first available wins. Venus shows its cloud deck (the atmosphere
 * map), falling back to the surface map.
 */
const TEXTURE_KEYS: Partial<Record<BodyId, string[]>> = {
  venus: ['venus_atmosphere', 'venus_surface'],
  earth: ['earth_day'],
};

const EARTH_ATMOSPHERE = { color: '#4da6ff', intensity: 1.0 };
const VENUS_ATMOSPHERE = { color: '#ffe9b0', intensity: 0.6 };
const SATURN_RING = { inner: 1.24, outer: 2.3, opacity: 0.9, plainOpacity: 0.35 };
const URANUS_RING = { inner: 1.6, outer: 2.0, opacity: 0.12 };
/** The Moon hides while Earth's and its own shown radii would cover this share of its orbit. */
const MOON_CLEARANCE = 0.8;
/** A boosted pick proxy stays this much larger than the shown body. */
const PICK_BOOST_MARGIN = 1.2;
/** Layer the raycaster never tests: a hidden Moon cannot be picked. */
const UNPICKABLE_LAYER = 1;
/** The sun is the world origin. */
const SUN_WORLD_POS = new THREE.Vector3(0, 0, 0);

function bodyTexture(tex: Map<string, THREE.Texture>, id: BodyId): THREE.Texture {
  const keys = TEXTURE_KEYS[id] ?? [id];
  for (const k of keys) {
    const t = tex.get(k);
    if (t) return t;
  }
  return makeFallbackTexture(keys[0] ?? id);
}

function texOrFallback(tex: Map<string, THREE.Texture>, key: string): THREE.Texture {
  return tex.get(key) ?? makeFallbackTexture(key);
}

function materialsOf(o: THREE.Object3D): THREE.Material[] {
  const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  return m ? (Array.isArray(m) ? m : [m]) : [];
}

function usesTexture(m: THREE.Material, t: THREE.Texture): boolean {
  if ((m as THREE.MeshStandardMaterial).map === t) return true;
  const u = (m as THREE.ShaderMaterial).uniforms as
    Record<string, THREE.IUniform<unknown>> | undefined;
  return u !== undefined && Object.values(u).some((x) => x.value === t);
}

/** Extra layers: Earth clouds and atmospheres, Saturn and Uranus rings. */
interface Decorations {
  update(): void;
  /** Swaps the cloud map and the Saturn ring strip when `tex` has real ones. */
  upgrade(tex: Map<string, THREE.Texture>): void;
  apply(s: TierSettings): void;
  /** Keeps the ring shadow in step with Saturn's overview boost. */
  setSaturnScale(k: number): void;
}

function decorate(
  bodies: Map<BodyId, BodyObject>,
  tex: Map<string, THREE.Texture>,
  s: TierSettings,
): Decorations {
  const get = (id: BodyId): BodyObject => {
    const b = bodies.get(id);
    if (!b) throw new Error(`Missing body ${id}`);
    return b;
  };
  const segments = sphereSegments(s);
  const atmospheres: THREE.Mesh[] = [];
  const shadowedRings: THREE.ShaderMaterial[] = [];

  const earth = get('earth');
  const cloudTex = tex.get('earth_clouds');
  // A solid fallback colour would be an opaque shell hiding Earth: no real map, no clouds.
  const clouds =
    cloudTex && !isFallbackTexture(cloudTex)
      ? createCloudLayer(cloudTex, earth.radius, segments)
      : null;
  if (clouds) {
    clouds.name = 'earth-clouds';
    earth.tiltGroup.add(clouds);
  }

  for (const [id, a] of [
    ['earth', EARTH_ATMOSPHERE],
    ['venus', VENUS_ATMOSPHERE],
  ] as const) {
    const body = get(id);
    const atmo = createAtmosphere(body.radius, a.color, a.intensity, segments);
    atmo.name = `${id}-atmosphere`;
    body.tiltGroup.add(atmo);
    atmospheres.push(atmo);
  }

  const saturn = get('saturn');
  // Without the real alpha strip, a plain faint band beats an opaque solid disc.
  const ringTex = tex.get('saturn_ring');
  const hasRingMap = ringTex !== undefined && !isFallbackTexture(ringTex);
  const sRing = createRing(
    saturn.radius * SATURN_RING.inner,
    saturn.radius * SATURN_RING.outer,
    hasRingMap ? ringTex : null,
    hasRingMap ? SATURN_RING.opacity : SATURN_RING.plainOpacity,
  );
  sRing.name = 'saturn-ring';
  const sMat = sRing.material as THREE.ShaderMaterial;
  (sMat.uniforms.uPlanetRadius as THREE.IUniform<number>).value = saturn.radius;
  shadowedRings.push(sMat);
  saturn.tiltGroup.add(sRing);

  // In Uranus' tilt group, so the ring stands almost vertical.
  const uranus = get('uranus');
  const uRing = createRing(
    uranus.radius * URANUS_RING.inner,
    uranus.radius * URANUS_RING.outer,
    null,
    URANUS_RING.opacity,
  );
  uRing.name = 'uranus-ring';
  uranus.tiltGroup.add(uRing);

  const deco: Decorations = {
    update() {
      if (clouds) clouds.rotation.y = earth.mesh.rotation.y * CLOUD_SPIN_FACTOR;
    },
    upgrade(next) {
      const cloudMat = clouds?.material as THREE.MeshStandardMaterial | undefined;
      const hiClouds = next.get('earth_clouds');
      if (cloudMat && hiClouds && !isFallbackTexture(hiClouds)) {
        cloudMat.map = hiClouds;
        cloudMat.needsUpdate = true;
      }
      const hiRing = next.get('saturn_ring');
      if (hiRing && !isFallbackTexture(hiRing)) {
        const u = sMat.uniforms;
        (u.uMap as THREE.IUniform<THREE.Texture | null>).value = hiRing;
        (u.uHasMap as THREE.IUniform<boolean>).value = true;
        (u.uOpacity as THREE.IUniform<number>).value = SATURN_RING.opacity;
      }
    },
    setSaturnScale(k) {
      (sMat.uniforms.uPlanetRadius as THREE.IUniform<number>).value = saturn.radius * k;
    },
    apply(next) {
      for (const a of atmospheres) a.visible = next.atmosphere;
      const shadow = next.ringShadow ? 1 : 0;
      for (const m of shadowedRings) (m.uniforms.uShadow as THREE.IUniform<number>).value = shadow;
    },
  };
  deco.apply(s);
  return deco;
}

/**
 * The sun's visible surface, light and bloom come from `createSun`. Here it only needs a
 * body entry so it can be focused and picked: a hidden stand-in sphere at the origin.
 */
function createSunStandIn(root: THREE.Group): BodyObject {
  const radius = displayRadius(BODIES.sun.physical.diameterKm);
  const orbitPivot = new THREE.Group();
  orbitPivot.name = 'sun-orbit';
  const tiltGroup = new THREE.Group();
  tiltGroup.name = 'sun-tilt';
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.name = 'sun';
  const pickProxy = createPickProxy('sun', radius);
  tiltGroup.add(mesh, pickProxy);
  orbitPivot.add(tiltGroup);
  root.add(orbitPivot);
  return { id: 'sun', orbitPivot, tiltGroup, mesh, radius, pickProxy };
}

export function createSolarSystem(tex: Map<string, THREE.Texture>, s: TierSettings): SolarSystem {
  const root = new THREE.Group();
  root.name = 'solar-system';
  const bodies = new Map<BodyId, BodyObject>();
  const rigs = new Map<BodyId, PlanetRig>();
  const orbitLines: OrbitLine[] = [];
  const orbitLineByBody = new Map<BodyId, OrbitLine>();

  bodies.set('sun', createSunStandIn(root));

  // BODY_IDS lists Earth before the Moon, which hangs off Earth's offset node.
  for (const id of BODY_IDS) {
    if (id === 'sun') continue;
    const texture = bodyTexture(tex, id);
    const parent = id === 'moon' ? rigs.get('earth')?.offset : root;
    if (!parent) throw new Error('Earth must be created before the Moon');
    const material =
      id === 'earth'
        ? createEarthMaterial(texture, texOrFallback(tex, 'earth_night'), SUN_WORLD_POS)
        : undefined;
    const rig = createPlanet(id, texture, s, parent, material);
    rigs.set(id, rig);
    bodies.set(id, rig.body);
    // One orbit ribbon per planet and Pluto; the Moon's tiny orbit stays unmarked.
    const orbitColor = BODIES[id].orbitColor;
    if (orbitColor && rig.orbitShape) {
      const line = createOrbitLine(rig.orbitShape, orbitColor);
      orbitLines.push(line);
      orbitLineByBody.set(id, line);
      root.add(line.object);
    }
  }

  // Focus anchor for the asteroid belt: mid-belt, kept on Earth's side of the Sun.
  const beltMid = (ASTEROID_BELT_MKM.inner + ASTEROID_BELT_MKM.outer) / 2;
  const beltAnchor = new THREE.Object3D();
  beltAnchor.name = 'asteroid-belt-focus';
  beltAnchor.position.x = displayOrbitRadius(beltMid);
  root.add(beltAnchor);

  const belt = createAsteroidBelt(s.asteroidCount);
  root.add(belt.mesh);

  const deco = decorate(bodies, tex, s);
  const pickables = [...bodies.values()].map((b) => b.pickProxy);
  const camPos = new THREE.Vector3();
  const bodyPos = new THREE.Vector3();
  const boosts = new Map<BodyId, number>();
  let emphasis = 1;
  let emphasisTarget = 1;
  let lastT: number | null = null;

  const solar: SolarSystem = {
    root,
    bodies,
    pickables,
    update(tSec) {
      for (const rig of rigs.values()) {
        const meanAnomaly = rig.update(tSec);
        orbitLineByBody.get(rig.body.id)?.setPlanetMeanAnomaly(meanAnomaly);
      }
      const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, tSec - lastT));
      lastT = tSec;
      emphasis = stepEmphasis(emphasis, emphasisTarget, dt);
      for (const line of orbitLines) line.setEmphasis(emphasis);
      deco.update();
      belt.update(tSec);
      const earthPosition = rigs.get('earth')!.offset.position;
      const earthDistance = Math.hypot(earthPosition.x, earthPosition.y, earthPosition.z);
      const beltRadius = displayOrbitRadius(beltMid);
      beltAnchor.position.set(
        (earthPosition.x / earthDistance) * beltRadius,
        (earthPosition.y / earthDistance) * beltRadius,
        (earthPosition.z / earthDistance) * beltRadius,
      );
    },
    getFocusTarget(id) {
      if (id === 'asteroid-belt') return { object: beltAnchor, radius: BELT_FOCUS_RADIUS };
      const b = bodies.get(id);
      if (!b) throw new Error(`Unknown body ${id}`);
      return { object: b.mesh, radius: b.radius };
    },
    upgradeTextures(id, next) {
      const body = bodies.get(id);
      if (!body) return;
      const real = (key: string): THREE.Texture | undefined => {
        const t = next.get(key);
        return t && !isFallbackTexture(t) ? t : undefined;
      };
      const replaced: THREE.Texture[] = [];
      const mat = body.mesh.material as THREE.Material;
      if (mat instanceof THREE.ShaderMaterial) {
        // Earth: day/night shader.
        for (const [key, uniform] of [
          ['earth_day', 'uDay'],
          ['earth_night', 'uNight'],
        ] as const) {
          const t = real(key);
          const u = mat.uniforms[uniform] as THREE.IUniform<THREE.Texture> | undefined;
          if (t && u) {
            replaced.push(u.value);
            u.value = t;
          }
        }
      } else {
        const key = (TEXTURE_KEYS[id] ?? [id]).find((k) => real(k));
        const t = key ? real(key) : undefined;
        const std = mat as THREE.MeshStandardMaterial;
        if (t && std.map) {
          replaced.push(std.map);
          std.map = t;
          std.needsUpdate = true;
        }
      }
      const cloudMat = root.getObjectByName('earth-clouds');
      if (id === 'earth' && cloudMat) {
        replaced.push(
          ...materialsOf(cloudMat).flatMap((m) =>
            (m as THREE.MeshStandardMaterial).map
              ? [(m as THREE.MeshStandardMaterial).map as THREE.Texture]
              : [],
          ),
        );
      }
      const ringMat = root.getObjectByName('saturn-ring');
      if (id === 'saturn' && ringMat) {
        for (const m of materialsOf(ringMat)) {
          const v = (m as THREE.ShaderMaterial).uniforms.uMap?.value as THREE.Texture | null;
          if (v) replaced.push(v);
        }
      }
      if (id === 'earth' || id === 'saturn') deco.upgrade(next);
      // Free the low maps only when nothing in the scene still samples them.
      for (const old of new Set(replaced)) {
        let used = false;
        root.traverse((o) => {
          if (!used) used = materialsOf(o).some((m) => usesTexture(m, old));
        });
        if (!used) old.dispose();
      }
    },
    applyOverviewBoost(camera, viewH) {
      camera.getWorldPosition(camPos);
      for (const b of bodies.values()) {
        if (b.id === 'sun') continue;
        b.mesh.getWorldPosition(bodyPos);
        const k = overviewBoost(b.radius, bodyPos.distanceTo(camPos), camera.fov, viewH);
        boosts.set(b.id, k);
        b.tiltGroup.scale.setScalar(k);
        const proxyR = Math.max(b.radius * PICK_SCALE, PICK_MIN_RADIUS);
        b.pickProxy.scale.setScalar(Math.max(1, (b.radius * k * PICK_BOOST_MARGIN) / proxyR));
        // The picker prefers the body whose visible disc is under the tap.
        b.pickProxy.userData.shownRadius = b.radius * k;
      }
      deco.setSaturnScale(boosts.get('saturn') ?? 1);
      const earth = bodies.get('earth');
      const moon = bodies.get('moon');
      if (earth && moon) {
        const shown =
          earth.radius * (boosts.get('earth') ?? 1) + moon.radius * (boosts.get('moon') ?? 1);
        const visible = shown < MOON_ORBIT_DISPLAY * MOON_CLEARANCE;
        moon.tiltGroup.visible = visible;
        moon.pickProxy.layers.set(visible ? 0 : UNPICKABLE_LAYER);
      }
    },
    setViewport(w, h, pixelRatio) {
      for (const line of orbitLines) line.setViewport(w, h, pixelRatio);
    },
    setOrbitFocus(focused) {
      emphasisTarget = focused ? ORBIT_STYLE.focusEmphasis : 1;
    },
    setTierSettings(next) {
      for (const rig of rigs.values()) rig.setSegments(next);
      deco.apply(next);
      belt.setCount(next.asteroidCount);
    },
  };
  solar.update(0);
  return solar;
}
