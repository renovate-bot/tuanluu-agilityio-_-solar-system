import { describe, expect, it } from 'vitest';
import {
  FOCUS_FILL,
  focusDistance,
  focusFill,
  focusScreenOffset,
  OVERVIEW_FIT_RADIUS,
  OVERVIEW_SAFE_NDC,
  overviewBoost,
  overviewFrame,
  overviewMinPx,
  overviewPolar,
} from '../../src/camera/framing';
import {
  displaySemiMajorAxis,
  displayOrbitRadius,
  displayPlanetRadius,
  OVERVIEW_MAX_BOOST,
  OVERVIEW_MIN_BODY_PX,
} from '../../src/config/scale';
import { BODIES } from '../../src/data/bodies';

const earthPlanetRadius = displayPlanetRadius(BODIES.earth.physical.diameterKm);

describe('focusDistance', () => {
  it('grows linearly with radius', () => {
    const a = focusDistance(2, 50, 1.5);
    const b = focusDistance(4, 50, 1.5);
    expect(b / a).toBeCloseTo(2, 6);
  });
  it('narrower aspect gives larger distance', () => {
    expect(focusDistance(1, 50, 0.5)).toBeGreaterThan(focusDistance(1, 50, 1.5));
  });
  it('stays outside the body', () => {
    expect(focusDistance(1, 50, 1)).toBeGreaterThan(1);
    expect(focusDistance(1, 50, 1)).toBeGreaterThanOrEqual(1.6);
  });
});

describe('focusScreenOffset', () => {
  it('mobile shifts up', () => expect(focusScreenOffset('mobile')).toEqual({ x: 0, y: 0.45 }));
  it('desktop shifts right', () => expect(focusScreenOffset('desktop')).toEqual({ x: 0.25, y: 0 }));
});

describe('OVERVIEW_FIT_RADIUS', () => {
  it('contains the largest displayed apoapsis plus the existing safety margin', () => {
    const largestApoapsis = Object.values(BODIES).reduce((largest, body) => {
      const orbit = body.orbit;
      if (!orbit) return largest;
      return Math.max(
        largest,
        displaySemiMajorAxis(orbit.semiMajorAxisAu) * (1 + orbit.eccentricity),
      );
    }, 0);

    expect(OVERVIEW_FIT_RADIUS).toBeCloseTo(largestApoapsis + 10, 9);
    expect(OVERVIEW_FIT_RADIUS).toBeGreaterThan(displayOrbitRadius(5906.4) + 10);
  });
});

/** Projects the overview orbit circle of `radius`: max |NDC x| and the NDC y range. */
function circleExtent(
  radius: number,
  distance: number,
  fovDeg: number,
  aspect: number,
  polar: number,
): { x: number; yMin: number; yMax: number } {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const c = Math.cos(polar);
  const s = Math.sin(polar);
  let x = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * 2 * Math.PI;
    const qx = radius * Math.cos(a);
    const qz = radius * Math.sin(a);
    // Camera at (0, d cos, d sin) looking at the origin.
    const vy = -distance * c;
    const vz = qz - distance * s;
    const depth = -c * vy - s * vz;
    const up = s * vy - c * vz;
    x = Math.max(x, Math.abs(qx / (depth * t * aspect)));
    yMin = Math.min(yMin, up / (depth * t));
    yMax = Math.max(yMax, up / (depth * t));
  }
  return { x, yMin, yMax };
}

describe('overviewFrame', () => {
  const polar = Math.PI / 3;
  const sphereFit = (aspect: number): number => {
    const half = Math.atan(Math.tan((50 * Math.PI) / 360) * Math.min(1, aspect));
    return OVERVIEW_FIT_RADIUS / Math.sin(half);
  };

  it('keeps the whole orbit disc inside the safe frame once shifted (desktop and phone)', () => {
    for (const aspect of [1280 / 720, 390 / 664, 1]) {
      const f = overviewFrame(OVERVIEW_FIT_RADIUS, 50, aspect, polar);
      const e = circleExtent(OVERVIEW_FIT_RADIUS, f.distance, 50, aspect, polar);
      expect(e.x).toBeLessThanOrEqual(OVERVIEW_SAFE_NDC.x + 1e-3);
      expect(e.yMax + f.offsetY).toBeLessThanOrEqual(OVERVIEW_SAFE_NDC.y + 1e-3);
      expect(e.yMin + f.offsetY).toBeGreaterThanOrEqual(-OVERVIEW_SAFE_NDC.y - 1e-3);
      // The shift centres the disc vertically (the near rim projects larger).
      expect(e.yMax + f.offsetY).toBeCloseTo(-(e.yMin + f.offsetY), 2);
      expect(f.offsetY).toBeGreaterThan(0);
      // Tight: one of the two limits is touched.
      const yHalf = (e.yMax - e.yMin) / 2;
      expect(Math.max(e.x / OVERVIEW_SAFE_NDC.x, yHalf / OVERVIEW_SAFE_NDC.y)).toBeGreaterThan(
        0.99,
      );
    }
  });

  it('a landscape screen gets clearly closer than a bounding-sphere fit', () => {
    const aspect = 1280 / 720;
    expect(overviewFrame(OVERVIEW_FIT_RADIUS, 50, aspect, polar).distance).toBeLessThan(
      sphereFit(aspect) * 0.8,
    );
  });

  it('a portrait phone is no farther than a bounding-sphere fit', () => {
    const aspect = 390 / 664;
    expect(overviewFrame(OVERVIEW_FIT_RADIUS, 50, aspect, polar).distance).toBeLessThanOrEqual(
      sphereFit(aspect),
    );
  });
});

describe('tour framing', () => {
  it('outside a tour the offsets are unchanged', () => {
    expect(focusScreenOffset('mobile', false)).toEqual(focusScreenOffset('mobile'));
    expect(focusScreenOffset('desktop', false)).toEqual(focusScreenOffset('desktop'));
    expect(focusFill('mobile', false)).toBe(FOCUS_FILL);
    expect(focusFill('desktop', true)).toBe(FOCUS_FILL);
  });
  it('desktop is unchanged during a tour', () =>
    expect(focusScreenOffset('desktop', true)).toEqual(focusScreenOffset('desktop')));
  it('a mobile tour stop centres the body in the band above the dock, a bit smaller', () => {
    const o = focusScreenOffset('mobile', true);
    expect(o.x).toBe(0);
    // Body centre in CSS px from the top on a 664 px tall phone: about the middle of the
    // band between the top bar (~60 px) and the dock top (~370 px).
    const centreY = ((1 - o.y) / 2) * 664;
    expect(centreY).toBeGreaterThan(190);
    expect(centreY).toBeLessThan(240);
    expect(focusFill('mobile', true)).toBeLessThan(FOCUS_FILL);
  });
});

describe('overviewBoost', () => {
  const px = (radius: number, distance: number, fovDeg: number, viewH: number): number =>
    (radius / (distance * Math.tan((fovDeg * Math.PI) / 360))) * (viewH / 2);

  it('is 1 when the body is already larger than its minimum size', () => {
    expect(overviewBoost(1.2, 10, 50, 720)).toBe(1);
  });
  it('scales a far body up to its minimum on-screen radius', () => {
    const b = overviewBoost(1.2, 600, 50, 720);
    expect(b).toBeGreaterThan(1);
    expect(px(1.2 * b, 600, 50, 720)).toBeCloseTo(overviewMinPx(1.2), 6);
  });
  it('never exceeds the maximum boost', () => {
    expect(overviewBoost(0.5, 1e6, 50, 720)).toBe(OVERVIEW_MAX_BOOST);
  });
  it('keeps the size order: a larger body is never drawn smaller', () => {
    const radii = [0.57, 0.78, 1.15, 1.2, 0.64, 3.3, 3.55, 1.9, 1.85];
    for (const a of radii)
      for (const b of radii) {
        if (a >= b) continue;
        expect(a * overviewBoost(a, 800, 50, 664)).toBeLessThanOrEqual(
          b * overviewBoost(b, 800, 50, 664) + 1e-9,
        );
      }
  });
  it('the minimum radius grows with the body radius and is Earth-sized at OVERVIEW_MIN_BODY_PX', () => {
    expect(OVERVIEW_MIN_BODY_PX).toBe(6);
    expect(overviewMinPx(earthPlanetRadius)).toBeCloseTo(6, 6);
    expect(overviewMinPx(earthPlanetRadius * 3)).toBeGreaterThan(overviewMinPx(earthPlanetRadius));
  });
});

describe('overviewPolar', () => {
  it('looks obliquely down at 60 degrees from the zenith on a landscape screen', () =>
    expect(overviewPolar(16 / 9)).toBeCloseTo(Math.PI / 3, 9));
  it('looks more steeply down on a portrait phone, which spreads the inner orbits', () => {
    const p = overviewPolar(390 / 664);
    expect(p).toBeLessThan(Math.PI / 3);
    expect(p).toBeGreaterThanOrEqual(Math.PI / 5);
  });
});
