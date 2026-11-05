# Planetary Orbit Geometry and Display Scale

## Intent

Replace the planets' coplanar circular paths and constant angular motion with readable, tilted Keplerian ellipses. Improve the relative display sizes of the planets without pretending that the compressed distances and enlarged bodies share one physical scale.

## Current behavior

- `src/bodies/planet.ts` moves each planet on a circle in the XZ plane at a constant angular rate.
- `src/bodies/orbitLine.ts` draws a circular, screen-space ribbon; its trail is driven by the planet's circular angle.
- `src/config/scale.ts` compresses orbit distances and uses a power curve for all body radii. That curve makes Jupiter roughly three Earth radii on screen rather than roughly eleven.
- `src/scene/solarSystem.ts` applies a screen-space boost in overview; `src/camera/framing.ts` fits a circular outer orbit.
- `src/data/bodies.ts` has physical diameters, average distances and periods, but no orbital elements. Axial tilt is present and must remain distinct from orbital inclination.

## Goals

- Give Mercury through Neptune and Pluto individual orbital eccentricities and orientations: inclination, ascending node and argument of perihelion, plus a reference mean anomaly.
- Advance each body by mean anomaly at its existing orbital period, solve Kepler's equation for eccentric anomaly, and place it on the resulting ellipse.
- Render the ribbon on the same ellipse and in the same inclined plane as the body; preserve its glowing, constant-screen-width style and moving trail.
- Keep one Earth year equal to 60 display seconds, preserve nonlinear orbit-distance compression and the existing Moon orbit, and remain deterministic and offline.
- Make the planets' base display radii linear in their physical diameters relative to Earth. Keep the Sun's deliberately compressed display radius and the Moon's current display size separate from this planet scale. Retain overview-only enlargement for legibility.

## Non-goals

- Runtime NASA/JPL requests, numerical N-body integration, mutual perturbations, or claims of precise ephemeris positions.
- Physical scaling of all distances and diameters on one common scale.
- Changing the Moon's circular orbit, asteroid-belt motion, axial tilts, labels, or user-facing copy.

## Data and accuracy boundary

- Store orbital elements with explicit units and typed fields under `src/data/`; keep display-scale constants and conversion rules in `src/config/scale.ts`.
- Use NASA/JPL's J2000 ecliptic frame and a single J2000.0 reference epoch. Use the JPL approximate elements for the eight planets (the source represents Earth with the Earth-Moon barycenter); use JPL SBDB elements for Pluto and normalize its initial mean anomaly to the same epoch.
- Hold the chosen elements fixed during the animation. This is an intentionally simplified two-body visualization: it captures each orbit's shape, plane and Keplerian speed but not secular precession or perturbations. JPL's approximate-position formula is stated to cover 1800–2050; do not extend that formula's claimed ephemeris accuracy beyond its stated range.
- Use NASA's Planetary Fact Sheet for diameters. Keep the Earth-Moon-barycenter approximation explicit in the data documentation; its difference is negligible at the app's compressed overview scale.

## Approaches

1. **Fixed Keplerian elements (selected).** Solve the two-body orbit locally from an epoch and orbital elements. This meets the geometry and speed goals, keeps builds offline, and needs little runtime work. It intentionally omits perturbations.
2. **Interpolated JPL ephemeris.** This could better represent actual positions, including perturbations, but needs a bounded date range and packaged samples or a network dependency. It adds substantial data and interpolation complexity and does not fit the app's current offline model.
3. **Tilted/elliptical appearance with uniform angular motion.** This is cheaper, but contradicts the requested Keplerian speed variation and is not selected.

## Design

### Orbit calculation and scene graph

- Add pure, Three.js-free math for Kepler's equation and conversion from orbital-plane coordinates to the app's world axes (Y up, ecliptic in XZ). For mean anomaly `M`, solve `M = E - e sin(E)` with a bounded, convergent method; calculate the focus-centered position from `a`, `e` and `E`, then rotate by the argument of perihelion, inclination and ascending node.
- Advance `M` by `2π * elapsedSeconds / displayPeriodSeconds`, wrapping angles safely. Continue to use the existing orbital periods and exact 60-second Earth year.
- Change each planet rig from rotating a circular pivot to positioning its orbit offset from the calculated 3D point. Keep the Moon attached to Earth's translated orbit offset, outside Earth's axial-tilt group, so its current relative circular motion remains intact.
- Generate each orbit ribbon from samples of the same Kepler ellipse and plane. Adapt its shader tangent and trail-progress inputs to the sampled curve; retain constant pixel width, depth testing, color, focus dimming and allocation-free per-frame updates.
- Fit the overview to the maximum displayed apoapsis, including eccentricity, rather than only Pluto's mean circular radius. Keep orbit ribbons synchronized with their planet phase.

### Planet display sizes

- Replace the planets' power-curve relative sizing with a linear diameter ratio to Earth using one shared display coefficient. Start from an Earth radius near the current display radius, then choose the final coefficient against the radial clearance of Jupiter, Saturn and Saturn's rings. Record that any remaining mismatch to real distances is intentional.
- Do not apply this new planet sizing rule to the Sun or Moon. Preserve their current display treatment to avoid making the Sun engulf inner orbits or changing the Moon outside scope.
- Keep overview enlargement screen-space-only. Re-evaluate the minimum visible size and maximum boost for small planets, while checking orbit/label overlap and confirming focused bodies return to their unboosted base radius.
- Recheck consequences of the new base radii for focus framing, pick proxies, Saturn/Uranus rings, atmospheres, labels and overview fit.

## Constraints

- Keep all user-visible strings in the existing bilingual content/i18n modules; this change adds none.
- Pure orbital math must be testable without importing Three.js. Do not add a runtime network dependency or change the project's existing visual quality floor.
- Respect the existing body-data, scale-constant and TypeScript strictness rules.

## Verification expectations

- Unit tests cover circular-orbit behavior at `e = 0`, perihelion/aphelion distances, inclination/orientation, epoch positions, period closure, Kepler's equation convergence, and faster perihelion than aphelion motion.
- Scene tests verify each planet's position lies on its corresponding inclined ellipse, ribbons use the same path and phase, the Moon remains at its existing distance from Earth, and no per-frame vector/color allocations are introduced.
- Scale and framing tests verify planet diameter ordering/ratios, Sun and Moon display sizes remain unchanged, overview-fit includes apoapsis, focused bodies are not overview-boosted, and size changes do not break picking or rings.
- Run the focused unit tests, then the project's typecheck, lint and unit suite. Use an overview visual check on portrait and landscape layouts to tune the one display coefficient and overview minimum/cap; do not weaken existing tests.

## Builder decisions

- Choose the shared planet display coefficient and overview pixel floor/cap from measured clearance and legibility, keeping linear interplanet diameter ratios.
- Choose a bounded Newton or bisection-based Kepler solver and sample count that preserve existing visual quality and performance; cover high eccentricity with unit tests.
- Keep the orbit phase parameterization consistent between sampled ribbons and the Kepler solver so the trail remains at the moving planet.
