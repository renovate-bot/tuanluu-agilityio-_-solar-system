import { describe, expect, it } from 'vitest';
import {
  positionAtMeanAnomaly,
  solveEccentricAnomaly,
  type KeplerOrbitShape,
} from '../../src/bodies/kepler';

const CIRCULAR_ORBIT = {
  semiMajorAxisDisplay: 10,
  eccentricity: 0,
  inclinationRad: 0,
  ascendingNodeRad: 0,
  argumentOfPerihelionRad: 0,
} satisfies KeplerOrbitShape;

function expectResidual(meanAnomalyRad: number, eccentricity: number, eccentricAnomalyRad: number) {
  const wrappedMeanAnomaly =
    (((((meanAnomalyRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) + Math.PI) %
      (2 * Math.PI)) -
    Math.PI;
  expect(
    eccentricAnomalyRad - eccentricity * Math.sin(eccentricAnomalyRad) - wrappedMeanAnomaly,
  ).toBeCloseTo(0, 12);
}

describe('positionAtMeanAnomaly', () => {
  it('matches the existing XZ-plane prograde convention for a circular orbit', () => {
    const start = positionAtMeanAnomaly(CIRCULAR_ORBIT, 0);
    expect(start[0]).toBeCloseTo(10, 12);
    expect(start[1]).toBeCloseTo(0, 12);
    expect(start[2]).toBeCloseTo(0, 12);
    const quarterOrbit = positionAtMeanAnomaly(CIRCULAR_ORBIT, Math.PI / 2);
    expect(quarterOrbit[0]).toBeCloseTo(0, 12);
    expect(quarterOrbit[1]).toBeCloseTo(0, 12);
    expect(quarterOrbit[2]).toBeCloseTo(-10, 12);
  });

  it('places an eccentric orbit at its perihelion and aphelion distances', () => {
    const shape = { ...CIRCULAR_ORBIT, eccentricity: 0.2 };
    const perihelion = positionAtMeanAnomaly(shape, 0);
    const aphelion = positionAtMeanAnomaly(shape, Math.PI);
    expect(Math.hypot(...perihelion)).toBeCloseTo(8, 12);
    expect(Math.hypot(...aphelion)).toBeCloseTo(12, 12);
  });

  it('rotates an inclined orbit out of the ecliptic plane', () => {
    const shape = { ...CIRCULAR_ORBIT, inclinationRad: Math.PI / 3 };
    const position = positionAtMeanAnomaly(shape, Math.PI / 2);
    expect(position[0]).toBeCloseTo(0, 12);
    expect(position[1]).toBeCloseTo(10 * Math.sin(Math.PI / 3), 12);
    expect(position[2]).toBeCloseTo(-10 * Math.cos(Math.PI / 3), 12);
  });

  it('rejects non-finite orbit inputs', () => {
    expect(() => positionAtMeanAnomaly(CIRCULAR_ORBIT, Number.NaN)).toThrow(RangeError);
    expect(() =>
      positionAtMeanAnomaly(
        { ...CIRCULAR_ORBIT, semiMajorAxisDisplay: Number.POSITIVE_INFINITY },
        0,
      ),
    ).toThrow(RangeError);
    expect(() =>
      positionAtMeanAnomaly({ ...CIRCULAR_ORBIT, inclinationRad: Number.NaN }, 0),
    ).toThrow(RangeError);
  });
});

describe('solveEccentricAnomaly', () => {
  it('solves Pluto’s J2000 Kepler equation to a small residual', () => {
    const meanAnomaly = (14.770507245297133 * Math.PI) / 180;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, 0.2518378778576892);
    expectResidual(meanAnomaly, 0.2518378778576892, eccentricAnomaly);
  });

  it('converges for a near-parabolic orbit', () => {
    const meanAnomaly = 0.000001;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, 0.999999);
    expectResidual(meanAnomaly, 0.999999, eccentricAnomaly);
  });

  it('is periodic for negative and large mean anomalies', () => {
    const shape = { ...CIRCULAR_ORBIT, eccentricity: 0.7 };
    const negativePhase = -0.72;
    const negativeBase = positionAtMeanAnomaly(shape, negativePhase);
    const negativeWrapped = positionAtMeanAnomaly(shape, negativePhase - 4 * 2 * Math.PI);
    const largePhase = 0.42;
    const largeWrapped = positionAtMeanAnomaly(shape, largePhase + 1000 * 2 * Math.PI);
    const largeBase = positionAtMeanAnomaly(shape, largePhase);

    negativeWrapped.forEach((value, index) => expect(value).toBeCloseTo(negativeBase[index]!, 9));
    largeWrapped.forEach((value, index) => expect(value).toBeCloseTo(largeBase[index]!, 8));
  });

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid eccentricity %s',
    (eccentricity) => {
      expect(() => solveEccentricAnomaly(0, eccentricity)).toThrow(RangeError);
    },
  );

  it('rejects a non-finite mean anomaly', () => {
    expect(() => solveEccentricAnomaly(Number.NEGATIVE_INFINITY, 0.2)).toThrow(RangeError);
  });
});
