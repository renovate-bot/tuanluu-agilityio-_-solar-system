# Task 1: Orbital Data and Pure Kepler Math

## Result

Implemented typed J2000 orbital elements for Mercury through Neptune and Pluto, AU-to-display semi-major-axis conversion, and a Three.js-free Kepler solver. The Earth orbital data uses the Earth-Moon barycenter; orbital inclination is stored separately from axial tilt. The Sun and Moon have no orbital elements.

## Implementation

- Added `OrbitalElements` with explicitly unit-tagged fields and optional `BodyDef.orbit`.
- Added JPL approximate elements at J2000 for the eight planets. Argument of perihelion and mean anomaly were derived from the JPL table's longitudes. Pluto uses JPL SBDB elements; its mean anomaly was normalized from JD 2457588.5 to J2000 using the listed mean motion, giving `14.770507245297133°`.
- Added `displaySemiMajorAxis`, converting AU to million kilometres with `149.5978707` before applying the existing compressed orbit-radius curve.
- Added `KeplerOrbitShape`, `solveEccentricAnomaly`, and `positionAtMeanAnomaly`. The solver wraps mean anomaly, validates finite inputs and elliptic eccentricity, then performs 48 bisection iterations over `[-π, π]`. The position calculation applies perihelion, inclination, and ascending-node rotations and maps ecliptic coordinates to world `(x, z, -y)`.
- Kepler math imports no Three.js module.

Sources:

- JPL approximate planetary elements: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JPL SBDB Pluto elements: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=134340&full-prec=1

## TDD and Verification

1. Added data, scaling, and Kepler tests before implementation.
2. RED: the first `npm` invocation was blocked by the Windows PowerShell execution policy for `npm.ps1`; running the same command with `npm.cmd` produced the expected failures: missing Mercury orbital data, missing `displaySemiMajorAxis`, and unresolved `kepler.ts` import (30 existing/new tests passed).
3. GREEN: after implementation and a precision-tolerant circular-position assertion, the focused suite passed: 3 test files, 44 tests.
4. Final verification:
   - `npm.cmd test -- tests/unit/bodies.test.ts tests/unit/kepler.test.ts tests/unit/scale.test.ts` — 3 files, 44 tests passed.
   - `npm.cmd test` — 39 files, 516 tests passed.
   - `npm.cmd run typecheck` — passed.
   - ESLint on all seven changed source/test files — passed.
   - Prettier check on all seven changed source/test files — passed.
   - `git diff --check` — passed.

## Accuracy Boundary

The planetary values are fixed J2000 elements for this deterministic two-body visualization, not a runtime ephemeris. JPL states that its approximate-position formula is fit for 1800–2050; the implementation does not claim precise long-term positions. Pluto's J2000 mean anomaly is a two-body back-propagation from the SBDB epoch.

## Commit

Planned subject: `feat(t36): add J2000 orbit elements and Kepler math`
