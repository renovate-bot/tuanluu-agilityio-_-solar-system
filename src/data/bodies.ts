import type { BodyDef, BodyId, BodyKind, OrbitalElements, PhysicalData } from './types';

// Source: NASA Planetary Fact Sheet (massEarths = 10^24 kg / 5.97).
// knownMoons as of 2026-10-29 (NASA Science moons pages; JPL counts as of Aug 2026)

// JPL approximate planetary elements at J2000.0, in the mean ecliptic and equinox of J2000.
// Argument of perihelion = longitude of perihelion - ascending node; mean anomaly =
// mean longitude - longitude of perihelion. These fixed elements are a visualization model;
// JPL's approximate-position formula is fit for 1800-2050, not a long-term ephemeris.
// Earth uses the Earth-Moon barycenter elements from the source table.
// Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
const PLANETARY_ORBITS: Record<Exclude<BodyId, 'sun' | 'moon'>, OrbitalElements> = {
  mercury: {
    semiMajorAxisAu: 0.38709927,
    eccentricity: 0.20563593,
    inclinationDeg: 7.00497902,
    longitudeOfAscendingNodeDeg: 48.33076593,
    argumentOfPerihelionDeg: 29.12703035,
    meanAnomalyAtEpochDeg: 174.79252722,
  },
  venus: {
    semiMajorAxisAu: 0.72333566,
    eccentricity: 0.00677672,
    inclinationDeg: 3.39467605,
    longitudeOfAscendingNodeDeg: 76.67984255,
    argumentOfPerihelionDeg: 54.92262463,
    meanAnomalyAtEpochDeg: 50.37663232,
  },
  earth: {
    semiMajorAxisAu: 1.00000261,
    eccentricity: 0.01671123,
    inclinationDeg: -0.00001531,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPerihelionDeg: 102.93768193,
    meanAnomalyAtEpochDeg: -2.47311027,
  },
  mars: {
    semiMajorAxisAu: 1.52371034,
    eccentricity: 0.0933941,
    inclinationDeg: 1.84969142,
    longitudeOfAscendingNodeDeg: 49.55953891,
    argumentOfPerihelionDeg: -73.5031685,
    meanAnomalyAtEpochDeg: 19.39019754,
  },
  jupiter: {
    semiMajorAxisAu: 5.202887,
    eccentricity: 0.04838624,
    inclinationDeg: 1.30439695,
    longitudeOfAscendingNodeDeg: 100.47390909,
    argumentOfPerihelionDeg: -85.74542926,
    meanAnomalyAtEpochDeg: 19.66796068,
  },
  saturn: {
    semiMajorAxisAu: 9.53667594,
    eccentricity: 0.05386179,
    inclinationDeg: 2.48599187,
    longitudeOfAscendingNodeDeg: 113.66242448,
    argumentOfPerihelionDeg: -21.06354617,
    meanAnomalyAtEpochDeg: -42.64463408,
  },
  uranus: {
    semiMajorAxisAu: 19.18916464,
    eccentricity: 0.04725744,
    inclinationDeg: 0.77263783,
    longitudeOfAscendingNodeDeg: 74.01692503,
    argumentOfPerihelionDeg: 96.93735127,
    meanAnomalyAtEpochDeg: 142.28382821,
  },
  neptune: {
    semiMajorAxisAu: 30.06992276,
    eccentricity: 0.00859048,
    inclinationDeg: 1.77004347,
    longitudeOfAscendingNodeDeg: 131.78422574,
    argumentOfPerihelionDeg: -86.81946347,
    meanAnomalyAtEpochDeg: -100.08479196,
  },
  // SBDB elements at JD 2457588.5; M is back-propagated to J2000 using the listed mean
  // motion (0.003956838955553025 deg/day), yielding 14.770507245297133 deg.
  // Source: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=134340&full-prec=1
  pluto: {
    semiMajorAxisAu: 39.58862938517124,
    eccentricity: 0.2518378778576892,
    inclinationDeg: 17.14771140999114,
    longitudeOfAscendingNodeDeg: 110.2923840543057,
    argumentOfPerihelionDeg: 113.7090015158565,
    meanAnomalyAtEpochDeg: 14.770507245297133,
  },
};

const ORBIT_COLORS: Partial<Record<BodyId, string>> = {
  mercury: '#c9bfb3',
  venus: '#f3d58a',
  earth: '#6fb6ff',
  mars: '#ff8a5c',
  jupiter: '#e8c9a0',
  saturn: '#f0dca0',
  uranus: '#8fe3ea',
  neptune: '#6f8cff',
  pluto: '#c9b8d9',
};

function def(
  id: BodyId,
  kind: BodyKind,
  parent: BodyId | null,
  orderFromSun: number | null,
  physical: PhysicalData,
): BodyDef {
  const orbitColor = ORBIT_COLORS[id];
  const orbit = id === 'sun' || id === 'moon' ? undefined : PLANETARY_ORBITS[id];
  return {
    id,
    kind,
    parent,
    orderFromSun,
    physical,
    ...(orbit ? { orbit } : {}),
    ...(orbitColor ? { orbitColor } : {}),
  };
}

export const BODIES: Record<BodyId, BodyDef> = {
  sun: def('sun', 'star', null, null, {
    diameterKm: 1392700,
    massEarths: 333000,
    surfaceGravity: 274,
    rotationPeriodHours: 609.12,
    axialTiltDeg: 7.25,
    meanTempC: 5500,
  }),
  mercury: def('mercury', 'terrestrial', 'sun', 1, {
    diameterKm: 4879,
    massEarths: 0.0553,
    surfaceGravity: 3.7,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    meanTempC: 167,
    distanceFromParentMkm: 57.9,
    orbitalPeriodDays: 88.0,
    knownMoons: 0,
  }),
  venus: def('venus', 'terrestrial', 'sun', 2, {
    diameterKm: 12104,
    massEarths: 0.815,
    surfaceGravity: 8.9,
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.4,
    meanTempC: 464,
    distanceFromParentMkm: 108.2,
    orbitalPeriodDays: 224.7,
    knownMoons: 0,
  }),
  earth: def('earth', 'terrestrial', 'sun', 3, {
    diameterKm: 12756,
    massEarths: 1,
    surfaceGravity: 9.8,
    rotationPeriodHours: 23.9,
    axialTiltDeg: 23.4,
    meanTempC: 15,
    distanceFromParentMkm: 149.6,
    orbitalPeriodDays: 365.2,
    knownMoons: 1,
  }),
  moon: def('moon', 'moon', 'earth', null, {
    diameterKm: 3475,
    massEarths: 0.0123,
    surfaceGravity: 1.6,
    rotationPeriodHours: 655.7,
    axialTiltDeg: 6.7,
    meanTempC: -20,
    distanceFromParentMkm: 0.3844,
    orbitalPeriodDays: 27.3,
  }),
  mars: def('mars', 'terrestrial', 'sun', 4, {
    diameterKm: 6792,
    massEarths: 0.107,
    surfaceGravity: 3.7,
    rotationPeriodHours: 24.6,
    axialTiltDeg: 25.2,
    meanTempC: -65,
    distanceFromParentMkm: 228.0,
    orbitalPeriodDays: 687.0,
    knownMoons: 2,
  }),
  jupiter: def('jupiter', 'gas-giant', 'sun', 5, {
    diameterKm: 142984,
    massEarths: 317.8,
    surfaceGravity: 23.1,
    rotationPeriodHours: 9.9,
    axialTiltDeg: 3.1,
    meanTempC: -110,
    distanceFromParentMkm: 778.5,
    orbitalPeriodDays: 4331,
    knownMoons: 115,
  }),
  saturn: def('saturn', 'gas-giant', 'sun', 6, {
    diameterKm: 120536,
    massEarths: 95.2,
    surfaceGravity: 9.0,
    rotationPeriodHours: 10.7,
    axialTiltDeg: 26.7,
    meanTempC: -140,
    distanceFromParentMkm: 1432.0,
    orbitalPeriodDays: 10747,
    knownMoons: 293,
  }),
  uranus: def('uranus', 'ice-giant', 'sun', 7, {
    diameterKm: 51118,
    massEarths: 14.5,
    surfaceGravity: 8.7,
    rotationPeriodHours: -17.2,
    axialTiltDeg: 97.8,
    meanTempC: -195,
    distanceFromParentMkm: 2867.0,
    orbitalPeriodDays: 30589,
    knownMoons: 29,
  }),
  neptune: def('neptune', 'ice-giant', 'sun', 8, {
    diameterKm: 49528,
    massEarths: 17.1,
    surfaceGravity: 11.0,
    rotationPeriodHours: 16.1,
    axialTiltDeg: 28.3,
    meanTempC: -200,
    distanceFromParentMkm: 4515.0,
    orbitalPeriodDays: 59800,
    knownMoons: 16,
  }),
  pluto: def('pluto', 'dwarf-planet', 'sun', 9, {
    diameterKm: 2376,
    massEarths: 0.0022,
    surfaceGravity: 0.7,
    rotationPeriodHours: -153.3,
    axialTiltDeg: 122.5,
    meanTempC: -225,
    distanceFromParentMkm: 5906.4,
    orbitalPeriodDays: 90560,
    knownMoons: 5,
  }),
};

export const PLANET_ORDER: BodyId[] = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];
