import type { BodyId } from '../data/types';

/** Real seconds for one Earth orbit. */
export const EARTH_YEAR_SECONDS = 60;
/** Real seconds for one Earth rotation. */
export const EARTH_DAY_SECONDS = 20;
/** Moon orbit radius in display units from Earth's centre. */
export const MOON_ORBIT_DISPLAY = 4;
/** Asteroid belt extent, million km from the Sun. */
export const ASTEROID_BELT_MKM = { inner: 329, outer: 479 } as const;
/** Asteroid belt orbital period in Earth years. */
export const ASTEROID_BELT_PERIOD_YEARS = 4.6;

/** Earth orbital period in days used by the orbit maths (a 60 s display year). */
export const EARTH_YEAR_DAYS = 365.25;
const EARTH_DAY_HOURS = 23.93;
const TWO_PI = 2 * Math.PI;
const AU_MKM = 149.5978707;

/** Compressed (non-linear) body radius in display units. */
export function displayRadius(diameterKm: number): number {
  return 1.2 * (diameterKm / 12756) ** 0.45;
}

/** Compressed orbit radius in display units; Mercury lands near 48. */
export function displayOrbitRadius(distanceMkm: number): number {
  return 20 + 28 * Math.sqrt(distanceMkm / 57.9);
}

/** Compressed display distance for a semi-major axis given in astronomical units. */
export function displaySemiMajorAxis(semiMajorAxisAu: number): number {
  return displayOrbitRadius(semiMajorAxisAu * AU_MKM);
}

/** Orbital angle in radians at time tSeconds. */
export function orbitalAngle(periodDays: number, tSeconds: number, phase: number): number {
  return phase + (TWO_PI * tSeconds) / ((EARTH_YEAR_SECONDS * periodDays) / EARTH_YEAR_DAYS);
}

/** Spin angle in radians; negative for retrograde (negative period). */
export function rotationAngle(rotationPeriodHours: number, tSeconds: number): number {
  return (TWO_PI * tSeconds) / ((EARTH_DAY_SECONDS * rotationPeriodHours) / EARTH_DAY_HOURS);
}

/** Starting orbital phase (radians), spread so no two planets line up at t=0. */
export const INITIAL_PHASE: Record<BodyId, number> = {
  sun: 0,
  mercury: 0.6,
  venus: 2.1,
  earth: 3.6,
  moon: 0,
  mars: 5.0,
  jupiter: 1.2,
  saturn: 4.3,
  uranus: 2.8,
  neptune: 5.7,
  pluto: 0.1,
};

/**
 * Overview legibility (spec 3.2 "pretty and easy to see"): a far body is drawn at least this
 * many CSS px in radius when it has Earth's display radius; the minimum grows with the square
 * root of the display radius, so the size order between bodies is kept.
 */
export const OVERVIEW_MIN_BODY_PX = 5;
/** Upper bound of that screen-space scale-up. */
export const OVERVIEW_MAX_BOOST = 8;
