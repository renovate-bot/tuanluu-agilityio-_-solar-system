import * as THREE from 'three';
import { BODIES } from '../data/bodies';
import type { BodyId } from '../data/types';
import type { TierSettings } from '../quality/tiers';
import {
  EARTH_YEAR_DAYS,
  INITIAL_PHASE,
  MOON_ORBIT_DISPLAY,
  displaySemiMajorAxis,
  displayRadius,
  orbitalAngle,
  rotationAngle,
} from '../config/scale';
import { writePositionAtMeanAnomaly, type KeplerOrbitShape } from './kepler';

export interface BodyObject {
  id: BodyId;
  orbitPivot: THREE.Object3D;
  tiltGroup: THREE.Object3D;
  mesh: THREE.Mesh;
  radius: number;
  pickProxy: THREE.Mesh;
}

/** Internal handle: the public BodyObject plus what `update` and parenting need. */
export interface PlanetRig {
  body: BodyObject;
  /** Child of `orbitPivot`, positioned at the current orbit point. Moons attach here. */
  offset: THREE.Object3D;
  orbitShape: KeplerOrbitShape | null;
  update(tSec: number): number;
  setSegments(s: TierSettings): void;
}

export const PICK_SCALE = 1.8;
export const PICK_MIN_RADIUS = 2.5;
/** Turning the sphere by PI points its texture centre (u = 0.5, +x) back toward the planet. */
const MOON_NEAR_SIDE_YAW = Math.PI;

/** Low tier is the only one capped at pixel ratio 1.5 (see Global Constraints). */
export function sphereSegments(s: TierSettings): number {
  return s.pixelRatioCap <= 1.5 ? 32 : 64;
}

function orbitPeriodDays(id: BodyId): number {
  // The Earth year is exactly 60 s of display time.
  if (id === 'earth') return EARTH_YEAR_DAYS;
  return BODIES[id].physical.orbitalPeriodDays ?? EARTH_YEAR_DAYS;
}

function orbitShapeOf(id: BodyId): KeplerOrbitShape | null {
  const orbit = BODIES[id].orbit;
  if (!orbit) return null;
  return {
    semiMajorAxisDisplay: displaySemiMajorAxis(orbit.semiMajorAxisAu),
    eccentricity: orbit.eccentricity,
    inclinationRad: THREE.MathUtils.degToRad(orbit.inclinationDeg),
    ascendingNodeRad: THREE.MathUtils.degToRad(orbit.longitudeOfAscendingNodeDeg),
    argumentOfPerihelionRad: THREE.MathUtils.degToRad(orbit.argumentOfPerihelionDeg),
  };
}

function makeGeometry(radius: number, s: TierSettings): THREE.SphereGeometry {
  const seg = sphereSegments(s);
  return new THREE.SphereGeometry(radius, seg, seg / 2);
}

/** Enlarged invisible (but raycastable) tap target, spec 3.3. */
export function createPickProxy(id: BodyId, radius: number): THREE.Mesh {
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(radius * PICK_SCALE, PICK_MIN_RADIUS), 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  proxy.name = `${id}-pick`;
  proxy.userData.bodyId = id;
  // Radius of the visible body (updated by the overview boost); the picker prefers it.
  proxy.userData.shownRadius = radius;
  return proxy;
}

/**
 * Builds one textured body (everything except the sun, whose surface is its own shader).
 * `material` overrides the default lit material (Earth's day/night shader).
 */
export function createPlanet(
  id: BodyId,
  texture: THREE.Texture,
  s: TierSettings,
  parent: THREE.Object3D,
  material?: THREE.Material,
): PlanetRig {
  const phys = BODIES[id].physical;
  const radius = displayRadius(phys.diameterKm);
  const isMoon = id === 'moon';
  const orbitShape = orbitShapeOf(id);
  if (!isMoon && !orbitShape) throw new Error(`Missing orbit elements for ${id}`);

  const orbitPivot = new THREE.Group();
  orbitPivot.name = `${id}-orbit`;
  parent.add(orbitPivot);

  const offset = new THREE.Group();
  offset.name = `${id}-offset`;
  if (isMoon) offset.position.x = MOON_ORBIT_DISPLAY;
  orbitPivot.add(offset);

  const tiltGroup = new THREE.Group();
  tiltGroup.name = `${id}-tilt`;
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(phys.axialTiltDeg);
  offset.add(tiltGroup);

  const mesh = new THREE.Mesh(
    makeGeometry(radius, s),
    material ?? new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 }),
  );
  mesh.name = id;
  if (isMoon) mesh.rotation.y = MOON_NEAR_SIDE_YAW;
  tiltGroup.add(mesh);

  const pickProxy = createPickProxy(id, radius);
  offset.add(pickProxy);

  // A tilt above 90 deg already flips the spin axis, which renders the retrograde direction.
  // Data keeps the negative period; using it here too would double-count and spin prograde.
  const spinHours =
    phys.axialTiltDeg > 90 ? Math.abs(phys.rotationPeriodHours) : phys.rotationPeriodHours;
  const period = orbitPeriodDays(id);
  const phase = isMoon
    ? INITIAL_PHASE[id]
    : THREE.MathUtils.degToRad(BODIES[id].orbit!.meanAnomalyAtEpochDeg);
  return {
    body: { id, orbitPivot, tiltGroup, mesh, radius, pickProxy },
    offset,
    orbitShape,
    update(tSec) {
      const meanAnomaly = orbitalAngle(period, tSec, phase);
      if (orbitShape) {
        writePositionAtMeanAnomaly(orbitShape, meanAnomaly, offset.position);
      } else {
        orbitPivot.rotation.y = meanAnomaly;
      }
      // The Moon is tidally locked: its fixed yaw rides along with the rotating pivot.
      if (!isMoon) mesh.rotation.y = rotationAngle(spinHours, tSec);
      return meanAnomaly;
    },
    setSegments(next) {
      const old = mesh.geometry;
      mesh.geometry = makeGeometry(radius, next);
      old.dispose();
    },
  };
}
