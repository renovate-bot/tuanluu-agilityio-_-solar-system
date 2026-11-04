import { describe, expect, it } from 'vitest';
import { BODIES, PLANET_ORDER } from '../../src/data/bodies';
import type { BodyId, BodyKind } from '../../src/data/types';

// id, diameterKm, massEarths, gravity, rotH, tilt, tempC, distMkm, orbitDays
const ROWS: [BodyId, number, number, number, number, number, number, number?, number?][] = [
  ['sun', 1392700, 333000, 274, 609.12, 7.25, 5500],
  ['mercury', 4879, 0.0553, 3.7, 1407.6, 0.034, 167, 57.9, 88.0],
  ['venus', 12104, 0.815, 8.9, -5832.5, 177.4, 464, 108.2, 224.7],
  ['earth', 12756, 1, 9.8, 23.9, 23.4, 15, 149.6, 365.2],
  ['moon', 3475, 0.0123, 1.6, 655.7, 6.7, -20, 0.3844, 27.3],
  ['mars', 6792, 0.107, 3.7, 24.6, 25.2, -65, 228.0, 687.0],
  ['jupiter', 142984, 317.8, 23.1, 9.9, 3.1, -110, 778.5, 4331],
  ['saturn', 120536, 95.2, 9.0, 10.7, 26.7, -140, 1432.0, 10747],
  ['uranus', 51118, 14.5, 8.7, -17.2, 97.8, -195, 2867.0, 30589],
  ['neptune', 49528, 17.1, 11.0, 16.1, 28.3, -200, 4515.0, 59800],
  ['pluto', 2376, 0.0022, 0.7, -153.3, 122.5, -225, 5906.4, 90560],
];

const KINDS: Record<BodyId, BodyKind> = {
  sun: 'star',
  mercury: 'terrestrial',
  venus: 'terrestrial',
  earth: 'terrestrial',
  mars: 'terrestrial',
  jupiter: 'gas-giant',
  saturn: 'gas-giant',
  uranus: 'ice-giant',
  neptune: 'ice-giant',
  pluto: 'dwarf-planet',
  moon: 'moon',
};

describe('BODIES', () => {
  it.each(ROWS)('%s matches the fact sheet', (id, d, m, g, rot, tilt, temp, dist, orbit) => {
    const p = BODIES[id].physical;
    expect(BODIES[id].id).toBe(id);
    expect(p.diameterKm).toBe(d);
    expect(p.massEarths).toBeCloseTo(m, 2);
    expect(p.surfaceGravity).toBe(g);
    expect(p.rotationPeriodHours).toBe(rot);
    expect(p.axialTiltDeg).toBe(tilt);
    expect(p.meanTempC).toBe(temp);
    expect(p.distanceFromParentMkm).toBe(dist);
    expect(p.orbitalPeriodDays).toBe(orbit);
  });

  it('has kinds', () => {
    for (const id of Object.keys(KINDS) as BodyId[]) expect(BODIES[id].kind).toBe(KINDS[id]);
  });

  it('has parents', () => {
    expect(BODIES.sun.parent).toBeNull();
    expect(BODIES.moon.parent).toBe('earth');
    for (const id of Object.keys(BODIES) as BodyId[]) {
      if (id !== 'sun' && id !== 'moon') expect(BODIES[id].parent).toBe('sun');
    }
  });

  it('has finite J2000 orbital elements for every planet and Pluto only', () => {
    for (const id of PLANET_ORDER) {
      const orbit = BODIES[id].orbit;
      expect(orbit, id).toBeDefined();
      if (!orbit) continue;

      expect(orbit.semiMajorAxisAu, id).toBeGreaterThan(0);
      expect(orbit.eccentricity, id).toBeGreaterThanOrEqual(0);
      expect(orbit.eccentricity, id).toBeLessThan(1);
      expect(
        [
          orbit.semiMajorAxisAu,
          orbit.eccentricity,
          orbit.inclinationDeg,
          orbit.longitudeOfAscendingNodeDeg,
          orbit.argumentOfPerihelionDeg,
          orbit.meanAnomalyAtEpochDeg,
        ].every(Number.isFinite),
        id,
      ).toBe(true);
    }

    expect(BODIES.sun.orbit).toBeUndefined();
    expect(BODIES.moon.orbit).toBeUndefined();
  });

  it('has planet order and orderFromSun', () => {
    expect(PLANET_ORDER).toEqual([
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]);
    PLANET_ORDER.forEach((id, i) => expect(BODIES[id].orderFromSun).toBe(i + 1));
    expect(BODIES.sun.orderFromSun).toBeNull();
    expect(BODIES.moon.orderFromSun).toBeNull();
  });

  it('has non-negative integer moon counts for planets', () => {
    for (const id of PLANET_ORDER) {
      expect(Number.isInteger(BODIES[id].physical.knownMoons)).toBe(true);
    }
  });

  it('gives the 8 planets and Pluto a hex orbitColor, and the Sun and Moon none', () => {
    for (const id of Object.keys(BODIES) as BodyId[]) {
      if (id === 'sun' || id === 'moon') expect(BODIES[id].orbitColor, id).toBeUndefined();
      else expect(BODIES[id].orbitColor, id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
