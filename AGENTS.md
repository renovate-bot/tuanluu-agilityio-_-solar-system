# AGENTS.md

Single source of truth for every AI agent working in this repo (Claude Code, Codex, others). `CLAUDE.md` only imports this file.

## Purpose

Solar System Explorer: a mobile-first, multilingual (vi/en/ja/de) three.js web app showing a realistic, animated Solar System with fly-to inspection, info panels, ambient audio and a narrated auto Tour Guide. Stack: Vite, strict TypeScript, vanilla DOM UI, Vitest, Playwright. Pure logic (scale math, tour state machine, i18n, prefs, quality tiers) lives in three.js-free modules that are unit-tested; rendering modules consume it. Pre-generated assets (WebP textures, Edge TTS mp3 + cue manifest) are committed, so build and CI need no network.

## Key documents

- Spec (Vietnamese): `docs/superpowers/specs/2026-10-29-solar-system-explorer-design.md`. "§3.8" style references point here.
- Plan: `docs/superpowers/plans/2026-10-29-solar-system-explorer.md` (tasks, Wave Plan, Branch Map, Global Constraints, Review Focus).

## Commands

- `npm ci` install; `npm run dev` dev server; `npm run build` typecheck + build (set `BASE_PATH=/solar-system/` to mimic Pages).
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright). CI (`verify` job) runs all four, then `check:budget` on the e2e build.
- `npm run format` always writes (the script is `prettier --write .`, so `-- --check` still writes). Verify with `npx prettier --check .` (on a Windows checkout with `core.autocrlf=true` add `--end-of-line auto`, else every file reports CRLF). Never run `format` on the whole repo for a docs or small change.
- `npm run fetch:textures` (`scripts/fetch-textures.mjs`, needs network, writes `public/textures/{low,high}` + `manifest.json`).
- `npm run narration` (`scripts/generate-narration.py` in `.venv`, needs network for Edge TTS; regenerates only changed text).
- `npm run check:budget` (`scripts/check-budget.mjs`, run after `npm run build`; initial payload and JS gzip budgets).
- `npm run test:visual` (`playwright.visual.config.ts`): refreshes `docs/screenshots/`, one worker.
- `npm run test:perf` (`playwright.perf.config.ts`): headed real-GPU FPS, port 4179, writes `docs/perf-results.json` (ADR 0005).
- Port 4173 is shared: `test:e2e` and `test:visual` both start a preview server on it. Never run them (or two worktrees' e2e) at the same time.
- E2E is slow under software GL (SwiftShader). `playwright.config.ts` uses `workers: 2`, `retries: 1`, 60 s timeout on purpose; run a single spec/project while iterating.

## Folder map

- `.claude/` settings, hooks (`session-start.mjs`, `stop-check.mjs`), `agents/`, `commands/`.
- `.github/workflows/` `ci.yml` (PR checks) and `deploy.yml` (GitHub Pages on each merge to `main`).
- `docs/` progress (`progress/t<NN>.md`), `decisions/` (ADRs), `KNOWN_ISSUES.md`, `BACKLOG.md`, `HUMAN_REVIEW.md`, `ai-setup.md` (both Vietnamese), `screenshots/`, `perf-results.json`, `superpowers/` (spec, plan).
- `scripts/` texture fetch, narration generation (+ its pytest), budget check.
- `src/config/` scale and time constants; `src/data/` body data, localized content (vi/en/ja/de), tour stops (see `src/data/CLAUDE.md` to add a body); `src/i18n/`; `src/state/` store and prefs; `src/quality/` tiers and FPS monitor.
- `src/tour/` state machine, narration, controller; `src/scene/` renderer, sky, postfx, textures, loop; `src/bodies/` planets, sun, earth, rings, belt, orbits.
- `src/camera/` framing and rig; `src/ui/labelLayout.ts` label placement; `src/interaction/` picker; `src/audio/` engine, ambient, whoosh; `src/ui/` layout, styles, panels, controls; `src/debug/` e2e API.
- `public/textures/`, `public/audio/narration/` committed assets and manifests.
- `tests/unit/`, `tests/e2e/`, `tests/visual/`, `tests/perf/`.

## Invariants (Global Constraints)

- Windows 11, Node 24, npm 11, Python 3.14. Every npm script must run on Windows; use cross-platform Node scripts, not bash-only syntax.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` without an eslint-disable comment explaining why.
- No UI framework, no state library, no backend.
- Body data ONLY in `src/data/`. Scale/time constants ONLY in `src/config/scale.ts`. Quality numbers ONLY in `src/quality/tiers.ts`.
- Supported locales are exactly `SUPPORTED_LANGS` in `src/data/types.ts`: `vi`, `en`, `ja`, `de` (Korean and Russian are deferred until requested). A locale ships only when its UI strings, every `ContentId`, all 14 tour scripts, subtitles and narration are complete.
- Every user-visible string goes through `t()` or the content modules and exists in every supported locale. English is the canonical translation source; the Japanese and German texts are AI-translated and not yet proofread by native speakers.
- Language: a valid saved `sse.lang` wins; otherwise the first `navigator.languages` entry whose primary subtag is supported (case-insensitive, `ja-JP` -> `ja`), else `en`. The `文A` button opens the language picker modal (`src/ui/languagePicker.ts`).
- Sound is muted by default (`sse.muted` absent means muted). Audio starts only after a user gesture.
- Tour autostarts once: only when `sse.tourSeen` is absent; the flag is set at tour start.
- All audio goes through Web Audio `GainNode`s. Never set `HTMLAudioElement.volume`.
- Earth year = 60 s display time. Real axial tilts. Venus and Uranus rotate retrograde (negative rotation period).
- Layout is `mobile` if `width < 768` OR `height > width`, else `desktop`.
- Tap targets are at least 44x44 CSS px.
- Performance: at least 30 FPS on a mid-range phone, 55 FPS on a laptop iGPU; initial load (JS + low textures + sky) at most 8 MB; JS at most 800 KB gzip; pixel ratio at most 2 (1.5 on `low`).
- Quality never drops below: textured bodies + sun light + sun bloom.
- Voices: `vi-VN-HoaiMyNeural`, `en-US-AvaNeural`, `ja-JP-NanamiNeural`, `de-DE-KatjaNeural` (Edge TTS, verified with `edge_tts.list_voices()`).
- Credits must show: "Textures: Solar System Scope (CC BY 4.0)" linking https://www.solarsystemscope.com/textures/; NASA as data source; "Narration voice generated with Microsoft Edge TTS".
- UI disclaimer in every language: sizes and distances are not to scale.
- Code, comments, commits, `AGENTS.md`/`CLAUDE.md` are English. `docs/ai-setup.md` and `docs/HUMAN_REVIEW.md` are Vietnamese.

## Workflow (one branch + one PR per task)

1. Prepare: `git fetch origin`, then `git worktree add .worktrees/t<NN> -b <branch> origin/main` (branch from the plan's Branch Map), `npm ci` inside it.
2. Implement with TDD (failing test, minimal code, pass). Commit with Conventional Commits, e.g. `feat(t04): add display scale math`, ending with the `Co-Authored-By` trailer.
3. Verify: re-run the task's verification commands plus lint, typecheck, test.
4. Review: `reviewer` does spec compliance then code quality; at most 2 fix rounds, then escalate one model tier and log `DECISION:`.
5. Record: tick the task's checkboxes in the plan; write `docs/progress/t<NN>.md` (status, summary, verification, `DECISION:` lines, review); commit `docs(t<NN>): record progress`.
6. PR: push the branch, `gh pr create --base main`.
7. CI: `gh pr checks <n> --watch --fail-fast`; fix failures on the branch (2 rounds max).
8. Merge: `gh pr merge <n> --merge --delete-branch`, remove the worktree (`git worktree remove`; on Windows it can fail with `Permission denied` while a dev server or editor holds the folder: stop it, retry, else leave it and run `git worktree prune` later), pull `main`.
9. Blocked: leave the PR open with the `blocked` label and a comment, add a `docs/KNOWN_ISSUES.md` entry, skip dependent tasks, continue independent ones.

- Branch Map and Wave Plan live in the plan. Waves: A (1-4 serial), B (5, 6, 9-13 parallel, at most 3 at once), C (7 and 8 in parallel, then 14), D (15-32 serial).
- Never ask the user mid-run. For an unspecified detail pick the option most faithful to the spec and log `DECISION: ...` in the progress file (architectural: write an ADR).
- Auto mode blocks `npx --yes <external package>`; use only locally installed tools.
- Extra tasks may be inserted (Task 28b fixed the visual issues from Task 28): they get their own `t28b.md` and PR.
- Never: push to `main` or force-push; merge a PR with failing checks; edit `.claude/settings.json` after Task 1; delete or weaken a passing test to get green.
- Model tiers: `implementer-light` (haiku), `implementer` (sonnet), `implementer-heavy` (opus), `reviewer` (sonnet), `final-reviewer` (opus). If a task fails twice on its tier, go one tier up.

## How to resume

Run `/resume-work` (Claude Code), or read the session-start summary and reconcile `git worktree list`, `gh pr list --state open` and the plan's checkboxes. The first unticked task of the earliest unfinished wave is current. A branch without a PR resumes at step 3; a PR with passing checks resumes at step 8. `/status` prints progress.

## Where things go

- Architectural decisions: `docs/decisions/NNNN-title.md` (Context, Decision, Consequences).
- Small per-task choices: `DECISION:` lines in `docs/progress/t<NN>.md`.
- Bugs or blocks you cannot fix now: `docs/KNOWN_ISSUES.md` (a `## ` heading per open issue).
- Ideas and out-of-scope work: `docs/BACKLOG.md`.
