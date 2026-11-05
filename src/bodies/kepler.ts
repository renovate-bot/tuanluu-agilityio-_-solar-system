export interface KeplerOrbitShape {
  semiMajorAxisDisplay: number;
  eccentricity: number;
  inclinationRad: number;
  ascendingNodeRad: number;
  argumentOfPerihelionRad: number;
}

export interface KeplerPositionBuffer {
  x: number;
  y: number;
  z: number;
}

const TWO_PI = 2 * Math.PI;
const BISECTION_ITERATIONS = 48;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function wrapMeanAnomaly(meanAnomalyRad: number): number {
  let wrapped = meanAnomalyRad % TWO_PI;
  if (wrapped > Math.PI) wrapped -= TWO_PI;
  if (wrapped < -Math.PI) wrapped += TWO_PI;
  return wrapped;
}

export function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  assertFinite(meanAnomalyRad, 'meanAnomalyRad');
  assertFinite(eccentricity, 'eccentricity');
  if (eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError('eccentricity must be in [0, 1)');
  }

  const meanAnomaly = wrapMeanAnomaly(meanAnomalyRad);
  let lower = -Math.PI;
  let upper = Math.PI;

  for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration++) {
    const midpoint = (lower + upper) / 2;
    if (midpoint - eccentricity * Math.sin(midpoint) < meanAnomaly) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }

  return (lower + upper) / 2;
}

export function positionAtMeanAnomaly(
  shape: KeplerOrbitShape,
  meanAnomalyRad: number,
): readonly [x: number, y: number, z: number] {
  const position = { x: 0, y: 0, z: 0 };
  writePositionAtMeanAnomaly(shape, meanAnomalyRad, position);
  return [position.x, position.y, position.z];
}

export function writePositionAtMeanAnomaly(
  shape: KeplerOrbitShape,
  meanAnomalyRad: number,
  output: KeplerPositionBuffer,
): void {
  assertFinite(shape.semiMajorAxisDisplay, 'semiMajorAxisDisplay');
  assertFinite(shape.inclinationRad, 'inclinationRad');
  assertFinite(shape.ascendingNodeRad, 'ascendingNodeRad');
  assertFinite(shape.argumentOfPerihelionRad, 'argumentOfPerihelionRad');
  if (shape.semiMajorAxisDisplay <= 0) {
    throw new RangeError('semiMajorAxisDisplay must be positive');
  }

  const eccentricAnomaly = solveEccentricAnomaly(meanAnomalyRad, shape.eccentricity);
  const xOrbit = shape.semiMajorAxisDisplay * (Math.cos(eccentricAnomaly) - shape.eccentricity);
  const yOrbit =
    shape.semiMajorAxisDisplay *
    Math.sqrt(1 - shape.eccentricity * shape.eccentricity) *
    Math.sin(eccentricAnomaly);

  const argumentCos = Math.cos(shape.argumentOfPerihelionRad);
  const argumentSin = Math.sin(shape.argumentOfPerihelionRad);
  const xPerihelion = argumentCos * xOrbit - argumentSin * yOrbit;
  const yPerihelion = argumentSin * xOrbit + argumentCos * yOrbit;

  const inclinationCos = Math.cos(shape.inclinationRad);
  const inclinationSin = Math.sin(shape.inclinationRad);
  const yInclined = inclinationCos * yPerihelion;
  const zInclined = inclinationSin * yPerihelion;

  const nodeCos = Math.cos(shape.ascendingNodeRad);
  const nodeSin = Math.sin(shape.ascendingNodeRad);
  const xEcliptic = nodeCos * xPerihelion - nodeSin * yInclined;
  const yEcliptic = nodeSin * xPerihelion + nodeCos * yInclined;

  // Map J2000 ecliptic (x, y, z) into the app's XZ ecliptic plane with Y up.
  output.x = xEcliptic;
  output.y = zInclined;
  output.z = -yEcliptic;
}
