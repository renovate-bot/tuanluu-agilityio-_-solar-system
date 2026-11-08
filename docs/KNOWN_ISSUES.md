# Known issues

Open issues are `## ` headings. Append `(resolved)` to the heading when fixed.

Entry format (copy this block, do not use a `## ` heading for the template):

    ## <title>
    Task: <task number>
    Symptom: <what goes wrong>
    Tried: <what was attempted>
    Status: <open | blocked | resolved>

## Mobile tour stop: subtitles dock covers the focused planet (resolved)
Task: 28 (carried over from 26)
Symptom: on a phone during a tour stop the dock (unmute hint, subtitles, tour controls, about 190 px) fills most of the 50 dvh above the peek sheet, so the planet (centred at about 27 % of the height, about 190 px wide) is almost fully covered (see `docs/screenshots/iphone13-tour-subtitle.png`, Venus). Non-tour focus views are fine.
Tried: analysed `focusScreenOffset` (y 0.45) and the CSS dock; a larger offset alone cannot help because the free band above the dock is only about 40-100 px. A real fix needs a tour-aware mobile layout (shorter peek sheet during the tour, compact subtitles, tour-specific smaller `fill` and offset passed to the rig), which is more than the 30 min budget and needs several screenshot rounds.
Fix: fixed in t28b: during a tour on a phone the peek sheet is 22 dvh, the dock is compact (caption above one row with an icon-only unmute button and the tour controls) and the rig uses `focusFill('mobile', true)` 0.3 and `focusScreenOffset('mobile', true)` y 0.38, so the body sits fully in the band between the top bar and the dock (`docs/screenshots/iphone13-tour-subtitle.png`).
Status: resolved

## Milky Way band not visible in the sky (resolved)
Task: 28
Symptom: the overview and focus screenshots show a starfield with only a faint cloud texture; no clear Milky Way band.
Tried: reviewed screenshots only (sky brightness is a tuning change, not a quick fix).
Fix: fixed in t28b: the committed sky maps are very dark (band texels 3-10 of 255) and the band lay along the horizon just above the downward-looking overview. `src/scene/sky.ts` now uses a shader with a black point, gain and a soft shoulder below the bloom threshold (`SKY_TONE`), and tilts the sphere 60.2 degrees about z (the real galactic-ecliptic angle) plus a -22 degree turn, so the band crosses the overview on desktop and phone.
Status: resolved

## Overview labels overlap near the Sun (resolved)
Task: 28
Symptom: in the overview the Mercury, Venus, Earth and Moon labels (and "The Sun" on mobile) overlap around the Sun; they are not readable until the user zooms in.
Tried: not attempted (needs label collision logic).
Fix: fixed in t28b: `placeLabels` (`src/ui/labelLayout.ts`, unit-tested) places labels in priority order below/above/right/left of each projected disc and drops one that would overlap another label or cover another body; the Moon label only shows when the Moon is shown.
Status: resolved

## Overview planets are only 1-2 px dots (resolved)
Task: 28
Symptom: at overview (desktop 1280x720 and iPhone 13) every planet is a 1-2 px dot on a thin orbit ring; textures and sizes are not discernible, so the "beautiful, easy to see everything" overview goal is not met (see `docs/screenshots/desktop-overview.png`). Only the Sun and the labels are visible.
Tried: reviewed screenshots only (needs a larger overview display size for bodies or a closer overview camera).
Fix: fixed in t28b: `overviewFrame` fits the projected orbit disc (desktop camera at 561 instead of 740 units, 1.3x closer), portrait looks down at 45 degrees, and `overviewBoost` draws each far body at least `OVERVIEW_MIN_BODY_PX * sqrt(r / r_earth)` px in radius (size order kept, never applied near the camera).
Status: resolved

## Desktop `high` tier overview below 55 FPS on the test laptop
Task: 29
Symptom: `npm run test:perf` (headed, real GPU: Intel Arc iGPU via ANGLE D3D11, 1440x900, 120 Hz display) measured the desktop overview at 45.3 to 54.1 FPS on the `high` tier, below the 55 FPS laptop target. The Saturn focus view measured 41.2 to 57.7 FPS. The phone emulation (Pixel 7, CPU x4, `medium`) passes at 45 FPS or more.
Tried: forced `medium` (56.3 / 56.8); `high` with bloom scale 0.75 (overview 38.9 to 53.1); `high` with 4000 asteroids (overview 45.3 to 50.5). The run-to-run noise (about ±8 FPS on a shared, busy machine) is larger than any of these effects, so `src/quality/tiers.ts` was left unchanged (ADR 0005). The controller re-measure on a quieter machine still gave 47.2 (overview) / 42.2 (Saturn), and the runtime FPS monitor downgraded `high` to `medium` during the run, so the app recovers by itself. Re-confirmed as open in the Task 32 final review (`docs/FINAL_REVIEW.md`). The Task 35 re-measure on an idle machine (after the orbit ribbons) gave 60 / 60 FPS with `high` kept to the end; one good run within the noise band does not close the issue.
Status: open (re-measure on an idle laptop; if it is confirmed, lower the `high` bloom scale to 0.75 first)

## `flows` e2e "tapping Mars then immediately Jupiter" is flaky (resolved)
Task: 38 (found there, pre-existing)
Symptom: the `flows` e2e test "tapping Mars then immediately Jupiter" fails locally on the `pixel7` project and is flaky on `iphone13`: `projectBody('mars')` returns null. It also fails at bffbeaa, before the German work, so it is not caused by Task 38.
Tried: the retry never left the focus view after a mis-pick (a tap landing on Mercury), so Mars stayed unprojectable. The test now returns to the overview before retrying; passed 4 of 4 runs each on `pixel7` and `iphone13` without Playwright retries.
Status: resolved
