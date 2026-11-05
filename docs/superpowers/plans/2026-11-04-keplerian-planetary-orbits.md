# Keplerian Planetary Orbits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace coplanar circular planet paths with inclined Keplerian ellipses and improve planet visibility while keeping the solar system readable.

**Architecture:** Add typed, fixed J2000 orbital elements and a Three.js-free Kepler solver. Planet rigs and their orbit ribbons consume the same orbit-shape and mean-anomaly calculations; display distances remain compressed, while planet diameter ratios become linear and overview boosts preserve legibility.

**Tech Stack:** Strict TypeScript, Three.js 0.186, Vitest, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-11-04-planetary-orbits-design.md`

## Global Constraints

- Windows 11, Node 24, npm 11, Python 3.14; every npm script must run on Windows.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; no `any` without an eslint-disable comment explaining why.
- No UI framework, state library, backend, or runtime network dependency.
- Body data ONLY in `src/data/`; scale/time constants ONLY in `src/config/scale.ts`; quality numbers ONLY in `src/quality/tiers.ts`.
- Every user-visible string goes through `t()` or content modules and exists in both `vi` and `en`; this feature adds no user-visible strings.
- Earth year = 60 s display time. Axial tilt remains separate from orbital inclination.
- Keep textured bodies + Sun light + Sun bloom as the quality floor.
- Keep all changes and commits on `feat/t36-keplerian-orbits` in `.worktrees/t36`; open a PR for review, but do not merge it into `main`.

## Review Focus

1. **Eccentricity and solver boundaries:** e=0, Pluto's e≈0.252, e near 1, and negative/large mean anomalies must produce finite, periodic positions and a converged Kepler solution. Pin in Task 1.
2. **Coordinate conventions:** a zero-inclination circle must preserve the existing XZ plane and prograde direction; nonzero inclination/node/perihelion must move the orbit into the expected plane without changing its radius. Pin in Task 1.
3. **Body/ribbon phase agreement:** a planet at high eccentricity must sit on its ribbon head, and the ribbon tangent must follow the ellipse at perihelion and aphelion. Pin in Task 2.
4. **Earth and Moon hierarchy:** moving Earth to an eccentric orbit must not change the Moon's 4-display-unit Earth-relative radius or tidal lock. Pin in Task 2.
5. **Overview extremes:** Pluto's apoapsis must fit in portrait and landscape, while small planets get a bounded, radius-scaled screen-space boost and Saturn's rings, pick proxies, labels and focused-body framing remain usable. Pin in Task 3 and the visual pass.

---

## Branch and delivery

- After this plan is approved, fetch `origin/main` and create `git worktree add .worktrees/t36 -b feat/t36-keplerian-orbits origin/main`.
- Run `npm ci` in `.worktrees/t36`. Copy the approved design and implementation plan into that worktree so the branch contains its own specification and checklist.
- Implement and commit the tasks below on that branch. Push the branch and open a PR for review, but leave the PR and branch unmerged. Keep the worktree available for the user to run.

### Task 1: Add orbital data and pure Kepler math

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/bodies.ts`
- Modify: `src/config/scale.ts`
- Create: `src/bodies/kepler.ts`
- Test: `tests/unit/bodies.test.ts`
- Test: `tests/unit/kepler.test.ts`
- Test: `tests/unit/scale.test.ts`

**Interfaces:**
- Produces `OrbitalElements` in `src/data/types.ts` with `semiMajorAxisAu`, `eccentricity`, `inclinationDeg`, `longitudeOfAscendingNodeDeg`, `argumentOfPerihelionDeg`, and `meanAnomalyAtEpochDeg`; add optional `BodyDef.orbit`.
- Add elements for Mercury through Neptune and Pluto. Use JPL approximate elements at J2000 for the eight planets (Earth-Moon barycenter for Earth); normalize Pluto's JPL SBDB mean anomaly to J2000. Sun and Moon have no `orbit`.
- Add `displaySemiMajorAxis(semiMajorAxisAu: number): number` in `src/config/scale.ts`, converting AU to million km with `149.5978707` million km per AU and passing it through the existing nonlinear `displayOrbitRadius`.
- Create `KeplerOrbitShape` with `semiMajorAxisDisplay`, `eccentricity`, `inclinationRad`, `ascendingNodeRad`, and `argumentOfPerihelionRad`.
- Create `solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number` and `positionAtMeanAnomaly(shape: KeplerOrbitShape, meanAnomalyRad: number): readonly [x: number, y: number, z: number]` in `src/bodies/kepler.ts`. Solve the wrapped equation with 48 bisection iterations over `[-π, π]`; the returned tuple uses the app's world axes (Y up, the ecliptic in XZ). Keep the module free of Three.js.

- [x] **Step 1: Write failing data and math tests.** Assert all nine orbiting bodies have finite elements with `a > 0` and `0 <= e < 1`, while Sun and Moon do not. In `kepler.test.ts`, cover a circular orbit matching the existing XZ/prograde convention, perihelion and aphelion radii `a(1-e)` and `a(1+e)`, nonzero inclination, equation residuals for Pluto and a near-parabolic test case, periodicity for negative and large mean anomalies, and `RangeError` for invalid eccentricity.
- [x] **Step 2: Run the tests and verify RED.**

  Run: `npm test -- tests/unit/bodies.test.ts tests/unit/kepler.test.ts tests/unit/scale.test.ts`

  Expected: new element and Kepler assertions fail because the data and module are not implemented.

- [x] **Step 3: Implement typed J2000 elements and the pure solver.** Keep source units explicit in the data fields; convert degrees to radians at the math boundary; wrap the mean anomaly before solving; reject non-finite inputs and eccentricity outside `[0, 1)`. Calculate orbital-plane coordinates as `x = a(cos(E) - e)`, `y = a * sqrt(1 - e²) * sin(E)`, rotate by argument of perihelion, inclination and ascending node in J2000 order, then map to world `(x, z, -y)`. Keep AU conversion in `config/scale.ts`.
- [x] **Step 4: Run the focused suite and verify GREEN.**

  Run: `npm test -- tests/unit/bodies.test.ts tests/unit/kepler.test.ts tests/unit/scale.test.ts`

  Expected: all three files pass; the pure Kepler module imports no Three.js module.

- [x] **Step 5: Commit.**

  ```text
  feat(t36): add J2000 orbit elements and Kepler math
  ```

### Task 2: Drive planet rigs and ribbons from Kepler orbits

**Files:**
- Modify: `src/bodies/planet.ts`
- Modify: `src/bodies/orbitLine.ts`
- Modify: `src/scene/solarSystem.ts`
- Test: `tests/unit/orbitLine.test.ts`
- Test: `tests/unit/solarSystem.test.ts`
- Test: `tests/unit/picker.test.ts`

**Interfaces:**
- Consumes Task 1's `KeplerOrbitShape`, `positionAtMeanAnomaly`, `BodyDef.orbit`, and `displaySemiMajorAxis`.
- Add `orbitShape: KeplerOrbitShape | null` to `PlanetRig`; `update(tSec: number): number` returns the rig's current mean anomaly. Moon has no `orbitShape` and keeps its current circular rig motion.
- Change `createOrbitLine` to accept `(shape: KeplerOrbitShape, color: THREE.ColorRepresentation)` and expose `setPlanetMeanAnomaly(meanAnomalyRad: number): void`.

- [x] **Step 1: Write failing rig and ribbon tests.** Update the `solarSystem.test.ts` orbit tests to assert each body is at the J2000 Kepler position at `t=0`, Earth returns to its position after 60 seconds, and the Moon stays 4 display units from Earth and tidal-locked. Update `orbitLine.test.ts` to assert sampled vertices follow a known inclined ellipse, preserve phase values around the closed seam, and retain the existing shader/material/disposal guarantees. Update the `picker.test.ts` label fixture to use the actual overview framing so the always-visible labels remain tested against the J2000 Pluto position.
- [x] **Step 2: Run the focused tests and verify RED.**

  Run: `npm test -- tests/unit/orbitLine.test.ts tests/unit/solarSystem.test.ts`

  Expected: the existing circular-line and pivot-angle expectations fail against the new ellipse interface.

- [x] **Step 3: Update planet rigs.** Build each planet's `KeplerOrbitShape` from its typed data; use `orbitalAngle(period, tSec, meanAnomalyAtEpoch)` as mean anomaly; set the translated offset from `positionAtMeanAnomaly`; keep axial-tilt and spin handling unchanged. Keep the Moon's relative radius and tidal-lock behavior unchanged.
- [x] **Step 4: Update orbit ribbons and scene wiring.** Sample the ellipse at `ORBIT_STYLE.segments` mean-anomaly intervals using `positionAtMeanAnomaly`. Store phase and a finite-difference tangent per station for the shader; derive the screen-space width from that tangent. Feed the line the mean anomaly returned by the same rig update, not `orbitPivot.rotation.y`. Preserve color, focus dimming, viewport handling, trail direction, and allocation-free frame updates.
- [x] **Step 5: Run the focused tests and verify GREEN.**

  Run: `npm test -- tests/unit/orbitLine.test.ts tests/unit/solarSystem.test.ts tests/unit/kepler.test.ts`

  Expected: all focused tests pass, including the zero-allocation update test and the unchanged Moon assertions.

- [x] **Step 6: Commit.**

  ```text
  feat(t36): render inclined Keplerian orbit paths
  ```

### Task 3: Align planet sizing and overview framing

**Files:**
- Modify: `src/config/scale.ts`
- Modify: `src/bodies/planet.ts`
- Modify: `src/camera/framing.ts`
- Test: `tests/unit/scale.test.ts`
- Test: `tests/unit/framing.test.ts`
- Test: `tests/unit/solarSystem.test.ts`
- Verify: `tests/visual/screenshots.spec.ts`
- Update as needed: `docs/screenshots/`
- Create: `docs/progress/t36.md`

**Interfaces:**
- Consumes Task 1's orbital elements and Task 2's orbit shapes and scene update.
- Add `displayPlanetRadius(diameterKm: number): number` in `src/config/scale.ts`; Earth is the reference body and planet radii preserve linear physical diameter ratios under one shared display coefficient. Keep the existing `displayRadius` for the Sun and Moon.
- Compute `OVERVIEW_FIT_RADIUS` from the maximum displayed apoapsis of bodies with orbital elements, plus the existing safety margin.

- [x] **Step 1: Write failing size, fit and overview tests.** Assert Jupiter/Earth and Pluto/Earth display-radius ratios match their physical diameter ratios, and the existing Sun/Moon display radii remain unchanged. Assert the fit radius contains the largest apoapsis. Add a portrait/landscape overview test that computes each projected body's radius and verifies the radius-scaled minimum from `overviewMinPx` is achievable within the configured boost cap; retain focused-body boost=1, picking, Moon-visibility and Saturn-ring synchronization checks.
- [x] **Step 2: Run the focused tests and verify RED.**

  Run: `npm test -- tests/unit/scale.test.ts tests/unit/framing.test.ts tests/unit/solarSystem.test.ts`

  Expected: the new linear-radius, apoapsis-fit and minimum-pixel assertions fail.

- [x] **Step 3: Implement the planet-only display scale.** Use a single shared coefficient for linear diameter ratios; keep the Sun's compressed radius and Moon's current radius on `displayRadius`. Select the coefficient by checking the rendered body/ring clearances against the compressed orbit gaps; do not tune individual planet ratios.
- [x] **Step 4: Fit and boost the overview.** Include eccentric apoapsis in the camera fit. Set the overview minimum to 6 CSS px for an Earth-radius body, retaining the existing square-root scaling by body radius so physical size ordering is not flattened. Raise the shared boost cap only to the smallest value that satisfies the portrait/landscape test; preserve unboosted radii in focused views and keep pick proxies and Saturn ring shadow scaling in sync.
- [x] **Step 5: Run focused unit tests and verify GREEN.**

  Run: `npm test -- tests/unit/scale.test.ts tests/unit/framing.test.ts tests/unit/solarSystem.test.ts tests/unit/labelLayout.test.ts`

  Expected: all pass; every planet meets the overview pixel floor in portrait and landscape and focus views use the base radius.

- [x] **Step 6: Run the visual review and inspect the changed captures.** Run `npm run test:visual` alone (do not run e2e at the same time because both use port 4173). Inspect desktop and iPhone overview, low-angle, Jupiter, Saturn, Earth and Pluto captures; update only screenshots whose appearance intentionally changed. If the screen-space boost obscures labels, rings or nearby bodies, adjust the shared coefficient/floor/cap and repeat the focused tests and visual review.
- [x] **Step 7: Commit the implementation and progress record.**

  ```text
  feat(t36): improve planetary scale and overview fit
  ```

  Record the final coefficient, overview floor/cap, source/accuracy caveat, verification commands, visual findings and reviewer verdict in `docs/progress/t36.md`.

## Final branch verification and handoff

- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then `npm run check:budget`.
- Review the complete branch diff against the design and this plan; run a fresh code review. Fix issues and rerun the affected tests.
- Push `feat/t36-keplerian-orbits`, open a PR, and wait for CI. Keep the PR unmerged and the worktree at `.worktrees/t36` available. Report the branch/worktree path and `npm run dev` command so the user can review and run it there.
