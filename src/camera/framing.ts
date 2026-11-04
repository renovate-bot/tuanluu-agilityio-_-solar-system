import {
  OVERVIEW_MAX_BOOST,
  OVERVIEW_MIN_BODY_PX,
  displaySemiMajorAxis,
  displayPlanetRadius,
} from '../config/scale';
import { BODIES } from '../data/bodies';
import type { Layout } from '../ui/layout';

const MAX_DISPLAYED_APOAPSIS = Object.values(BODIES).reduce((largest, body) => {
  const orbit = body.orbit;
  if (!orbit) return largest;
  return Math.max(largest, displaySemiMajorAxis(orbit.semiMajorAxisAu) * (1 + orbit.eccentricity));
}, 0);

export const OVERVIEW_FIT_RADIUS = MAX_DISPLAYED_APOAPSIS + 10;
/** The part of the view (NDC half-extents) the overview disc may use; the rest is UI chrome. */
export const OVERVIEW_SAFE_NDC = { x: 1, y: 0.78 } as const;
/**
 * Overview polar angle from the zenith: oblique on a landscape screen; steeper on a portrait
 * one, where the width limits the zoom anyway and the taller ellipse spreads the inner
 * orbits (and their labels) apart.
 */
export function overviewPolar(aspect: number): number {
  return aspect < 1 ? Math.PI / 4 : Math.PI / 3;
}
/** Default share of the limiting half view angle a focused body fills. */
export const FOCUS_FILL = 0.35;
const MOBILE_TOUR_FILL = 0.3;
const EARTH_DISPLAY_RADIUS = displayPlanetRadius(BODIES.earth.physical.diameterKm);

/** Distance at which a sphere of `radius` fills `fill` of the limiting view dimension. */
export function focusDistance(
  radius: number,
  fovDeg: number,
  aspect: number,
  fill = FOCUS_FILL,
): number {
  const halfFov = (fovDeg * Math.PI) / 360;
  const limitingHalf = Math.atan(Math.tan(halfFov) * Math.min(1, aspect));
  const d = radius / Math.sin(limitingHalf * fill);
  return Math.max(d, radius * 1.6);
}

/**
 * NDC shift that keeps the focused body clear of the info panel. During a mobile tour the
 * peek sheet is shorter and the subtitle dock sits above it, so the body goes to the middle
 * of the band between the top bar and the dock.
 */
export function focusScreenOffset(layout: Layout, tour = false): { x: number; y: number } {
  if (layout === 'desktop') return { x: 0.25, y: 0 };
  return tour ? { x: 0, y: 0.38 } : { x: 0, y: 0.45 };
}

/** The `fill` passed to `focusDistance`: a little smaller on a mobile tour stop. */
export function focusFill(layout: Layout, tour = false): number {
  return layout === 'mobile' && tour ? MOBILE_TOUR_FILL : FOCUS_FILL;
}

export interface OverviewFrame {
  /** Camera distance from the origin. */
  distance: number;
  /** NDC shift (+ moves the picture up) that centres the projected disc vertically. */
  offsetY: number;
}

/**
 * Overview framing for the orbit circle of `radius` (in the y = 0 plane, seen from polar
 * angle `polar` towards the origin): the smallest distance at which the projected disc,
 * shifted to be vertically centred, fits inside OVERVIEW_SAFE_NDC. Fitting the disc instead
 * of its bounding sphere brings a landscape view much closer.
 */
export function overviewFrame(
  radius: number,
  fovDeg: number,
  aspect: number,
  polar: number,
): OverviewFrame {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const c = Math.cos(polar);
  const s = Math.sin(polar);
  const extent = (d: number): { x: number; yMin: number; yMax: number } | null => {
    let x = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * 2 * Math.PI;
      const qx = radius * Math.cos(a);
      const qz = radius * Math.sin(a);
      // Camera at (0, d cos, d sin): depth along the view axis and the camera-up component.
      const vy = -d * c;
      const vz = qz - d * s;
      const depth = -c * vy - s * vz;
      if (depth <= 0) return null;
      const y = (s * vy - c * vz) / (depth * t);
      x = Math.max(x, Math.abs(qx / (depth * t * aspect)));
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    return { x, yMin, yMax };
  };
  const fits = (d: number): boolean => {
    const e = extent(d);
    return e !== null && e.x <= OVERVIEW_SAFE_NDC.x && (e.yMax - e.yMin) / 2 <= OVERVIEW_SAFE_NDC.y;
  };
  let lo = radius;
  let hi = radius * 2;
  while (!fits(hi)) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  const e = extent(hi);
  return { distance: hi, offsetY: e ? -(e.yMax + e.yMin) / 2 : 0 };
}

/** Minimum on-screen radius (CSS px) of a body of display `radius` in a far view. */
export function overviewMinPx(radius: number): number {
  return OVERVIEW_MIN_BODY_PX * Math.sqrt(radius / EARTH_DISPLAY_RADIUS);
}

/**
 * Scale factor (>= 1) that draws a body of display `radius` at `distance` from the camera at
 * least `overviewMinPx(radius)` CSS px in radius on a view `viewH` px tall. It falls back to 1
 * as the camera closes in, so a focused body is never enlarged.
 */
export function overviewBoost(
  radius: number,
  distance: number,
  fovDeg: number,
  viewH: number,
): number {
  const px = (radius / (distance * Math.tan((fovDeg * Math.PI) / 360))) * (viewH / 2);
  if (!(px > 0)) return OVERVIEW_MAX_BOOST;
  return Math.min(OVERVIEW_MAX_BOOST, Math.max(1, overviewMinPx(radius) / px));
}
