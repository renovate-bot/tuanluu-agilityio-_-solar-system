import { describe, expect, it } from 'vitest';
import {
  ASTEROID_BELT_MKM,
  EARTH_DAY_SECONDS,
  INITIAL_PHASE,
  displayPlanetRadius,
  displaySemiMajorAxis,
  displayOrbitRadius,
  displayRadius,
  orbitalAngle,
  rotationAngle,
} from '../../src/config/scale';
import { BODIES } from '../../src/data/bodies';
import { BODY_IDS } from '../../src/data/types';

const DIAMETER = {
  sun: 1392700,
  jupiter: 139820,
  saturn: 116460,
  uranus: 50724,
  neptune: 49244,
  earth: 12756,
  venus: 12104,
  mars: 6792,
  mercury: 4879,
  moon: 3475,
  pluto: 2376,
} as const;

const ORBIT_MKM = {
  mercury: 57.9,
  venus: 108.2,
  earth: 149.6,
  mars: 228,
  jupiter: 778.5,
  saturn: 1432,
  uranus: 2867,
  neptune: 4515,
  pluto: 5906.4,
} as const;

describe('displayRadius', () => {
  it('is strictly increasing in the expected body order', () => {
    const order = [
      'sun',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'earth',
      'venus',
      'mars',
      'mercury',
      'moon',
      'pluto',
    ] as const;
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i]!;
      const b = order[i + 1]!;
      expect(displayRadius(DIAMETER[a])).toBeGreaterThan(displayRadius(DIAMETER[b]));
    }
  });

  it('keeps the Sun from swallowing Mercury', () => {
    expect(displayRadius(1392700)).toBeLessThan(displayOrbitRadius(57.9) - 5);
  });
});

describe('displayPlanetRadius', () => {
  it('uses a shared linear coefficient relative to Earth', () => {
    const earth = displayPlanetRadius(BODIES.earth.physical.diameterKm);
    expect(displayPlanetRadius(BODIES.jupiter.physical.diameterKm) / earth).toBeCloseTo(
      BODIES.jupiter.physical.diameterKm / BODIES.earth.physical.diameterKm,
      10,
    );
    expect(displayPlanetRadius(BODIES.pluto.physical.diameterKm) / earth).toBeCloseTo(
      BODIES.pluto.physical.diameterKm / BODIES.earth.physical.diameterKm,
      10,
    );
  });

  it('keeps Jupiter and Saturn with its rings clear across their eccentric orbit gap', () => {
    const jupiter = BODIES.jupiter.orbit!;
    const saturn = BODIES.saturn.orbit!;
    const jupiterApoapsis =
      displaySemiMajorAxis(jupiter.semiMajorAxisAu) * (1 + jupiter.eccentricity);
    const saturnPeriapsis =
      displaySemiMajorAxis(saturn.semiMajorAxisAu) * (1 - saturn.eccentricity);
    const jupiterOuterEdge =
      jupiterApoapsis + displayPlanetRadius(BODIES.jupiter.physical.diameterKm);
    const saturnRingInnerEdge =
      saturnPeriapsis - 2.3 * displayPlanetRadius(BODIES.saturn.physical.diameterKm);

    expect(jupiterOuterEdge).toBeLessThan(saturnRingInnerEdge);
  });
});

describe('displayOrbitRadius', () => {
  it('maps Mercury to about 48', () => {
    expect(displayOrbitRadius(57.9)).toBeCloseTo(48, 5);
  });

  it('keeps Neptune inside Pluto', () => {
    expect(displayOrbitRadius(4515)).toBeLessThan(displayOrbitRadius(5906.4));
  });

  it('preserves planet orbit order', () => {
    const values = Object.values(ORBIT_MKM).map(displayOrbitRadius);
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i]!).toBeLessThan(values[i + 1]!);
    }
  });

  it('fits the Saturn ring inside half the Saturn-Jupiter gap', () => {
    const ringOuter = 2.3 * displayRadius(120536);
    const gap = displayOrbitRadius(1432) - displayOrbitRadius(778.5);
    expect(ringOuter).toBeLessThan(gap / 2);
  });

  it('places the asteroid belt strictly between Mars and Jupiter', () => {
    const mars = displayOrbitRadius(ORBIT_MKM.mars);
    const jupiter = displayOrbitRadius(ORBIT_MKM.jupiter);
    const inner = displayOrbitRadius(ASTEROID_BELT_MKM.inner);
    const outer = displayOrbitRadius(ASTEROID_BELT_MKM.outer);
    expect(inner).toBeGreaterThan(mars);
    expect(outer).toBeGreaterThan(inner);
    expect(outer).toBeLessThan(jupiter);
  });
});

describe('displaySemiMajorAxis', () => {
  it('converts an AU to million kilometres before applying orbit compression', () => {
    expect(displaySemiMajorAxis(1)).toBeCloseTo(65.00714405559911, 10);
  });
});

describe('orbitalAngle', () => {
  it('completes one revolution per Earth year (60 s)', () => {
    expect(orbitalAngle(365.25, 60, 0)).toBeCloseTo(2 * Math.PI, 6);
  });

  it('scales inversely with period', () => {
    const ratio = orbitalAngle(687, 30, 0) / orbitalAngle(365.25, 30, 0);
    expect(ratio).toBeCloseTo(365.25 / 687, 6);
  });

  it('adds the phase offset', () => {
    expect(orbitalAngle(365.25, 0, 1.25)).toBeCloseTo(1.25, 10);
  });
});

describe('rotationAngle', () => {
  it('is negative for retrograde rotation', () => {
    expect(rotationAngle(-5832.5, 10)).toBeLessThan(0);
  });

  it('completes one turn per Earth day (20 s)', () => {
    expect(rotationAngle(23.93, EARTH_DAY_SECONDS)).toBeCloseTo(2 * Math.PI, 6);
  });
});

describe('INITIAL_PHASE', () => {
  it('has a finite phase for every body', () => {
    for (const id of BODY_IDS) {
      expect(Number.isFinite(INITIAL_PHASE[id])).toBe(true);
    }
  });

  it('gives every planet a distinct phase', () => {
    const planets = BODY_IDS.filter((id) => id !== 'sun' && id !== 'moon');
    const phases = planets.map((id) => INITIAL_PHASE[id]);
    expect(new Set(phases).size).toBe(planets.length);
    const sorted = [...phases].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i + 1]! - sorted[i]!).toBeGreaterThan(0.2);
    }
  });
});
