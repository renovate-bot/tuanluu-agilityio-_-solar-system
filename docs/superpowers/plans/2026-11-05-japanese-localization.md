# Japanese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete Japanese support alongside the existing Vietnamese and English experience; defer Korean, German, and Russian until the user reviews this phase and requests them.

**Architecture:** Add typed Japanese UI/body/tour data to the existing static locale tables. Generate and commit the 14 Japanese Edge TTS clips, loading them only when their tour stop plays. Replace the two-way toggle with an accessible three-choice modal that preserves the current app view.

**Tech Stack:** Vite, strict TypeScript, vanilla DOM, Vitest, Playwright, Python `unittest`, existing Edge TTS generator.

**Spec:** [2026-11-05-japanese-localization-design.md](../specs/2026-11-05-japanese-localization-design.md)

## Global Constraints

- This phase supports exactly `vi`, `en`, and `ja`; do not add or expose `ko`, `de`, or `ru`.
- A valid saved `sse.lang` takes priority. Otherwise choose the first supported primary language in `navigator.languages`, then fall back to `en`.
- Japanese UI, every `ContentId`, all 14 tour scripts, subtitles, and narration must ship together as a complete locale.
- English is the canonical translation source. Japanese text is AI-generated and must be documented as not natively proofread.
- All user-visible UI text goes through `t()` or content modules; no UI framework, state library, backend, runtime translation/TTS service, or new dependency.
- TypeScript remains `strict: true` and `noUncheckedIndexedAccess: true`; do not use `any`.
- Audio remains muted by default, starts only after user interaction, and flows through Web Audio `GainNode`s.
- Narration assets are pre-generated and committed; builds and CI do not need network access. Load clips by tour segment, not all at startup.
- Tap targets remain at least 44×44 CSS px. Mobile layout remains `mobile` when `width < 768` or `height > width`.
- Keep initial load at most 8 MB, JS at most 800 KB gzip, pixel ratio at most 2 (1.5 on `low`), and the existing minimum quality features.
- Every npm script must run on Windows 11 with Node 24/npm 11; Python is 3.14.

## Review Focus

1. **Browser locale order and invalid saved values:** region tags `ja-JP`, unsupported `ko`/`de` entries, and invalid `sse.lang` must resolve to the first currently supported locale or English. Pin in `tests/unit/prefs.test.ts` (Steps 1–2).
2. **Japanese text completeness and punctuation:** all UI keys, body IDs, placeholders, and 14 tour stops must exist; `。！？` sentence boundaries must not produce empty or one-sentence scripts. Pin in `tests/unit/content.test.ts` and `tests/unit/tourScripts.test.ts` (Steps 3–6).
3. **Missing/mismatched narration:** all 42 existing/new stop-locale entries must reference real files, and Japanese fallback cues/duration must work if a clip is unavailable. Pin in `tests/unit/narration.test.ts`, `tests/unit/narrationAssets.test.ts`, and `scripts/test_generate_narration.py` (Steps 7–14).
4. **Language change during narration:** restarting an unmuted tour stop must use the Japanese clip/cues while preserving the stop; muted behavior remains unchanged. Pin in `tests/unit/tourController.test.ts` and `tests/e2e/controls.spec.ts` (Steps 15–18).
5. **Small mobile viewport with an open body panel:** the three-choice picker must fit 320px width and short height, be keyboard dismissible, return focus, and preserve the selected body/panel. Pin in `tests/unit/languagePicker.test.ts` and `tests/e2e/panel.spec.ts` (Steps 16–18).

---

### Task 33: Add complete Japanese support

This phase is one atomic task and PR. Do not expose Japanese until its UI, body content, subtitles, and voice assets are complete. Do not implement Korean, German, or Russian in this phase.

**Preparation:** Fetch `origin`, create `.worktrees/t33` on `feat/t33-japanese-support` from `origin/main`, carry the approved Japanese spec and plan into the worktree, and run `npm ci` there before Step 1.

**Files:**
- Create: `src/data/content/ja.ts`
- Create: `src/data/tour/ja.json`
- Create: `src/ui/languagePicker.ts`
- Create: `tests/unit/languagePicker.test.ts`
- Create: `docs/progress/t33.md`
- Modify: `src/data/types.ts`, `src/data/content/index.ts`
- Modify: `src/state/prefs.ts`, `src/i18n/i18n.ts`, `src/i18n/strings.ts`
- Modify: `src/tour/narration.ts`, `src/tour/tourController.ts`, `src/main.ts`
- Modify: `src/ui/controlBar.ts`, `src/ui/styles.css`
- Modify: `scripts/generate-narration.py`
- Modify: `tests/unit/prefs.test.ts`, `tests/unit/i18n.test.ts`, `tests/unit/content.test.ts`, `tests/unit/tourScripts.test.ts`
- Modify: `tests/unit/narration.test.ts`, `tests/unit/narrationAssets.test.ts`, `scripts/test_generate_narration.py`
- Modify: `tests/unit/tourController.test.ts`, `tests/e2e/controls.spec.ts`, `tests/e2e/panel.spec.ts`
- Modify: `public/audio/narration/manifest.json` and add 14 generated Japanese MP3 files
- Modify: `AGENTS.md`, `src/data/CLAUDE.md`

**Interfaces:**
- Consumes: `Store<AppState>`, `t()`, `getContent()`, `NarrationManifest`, `TourController`, `createCredits()` modal conventions, and the current Edge TTS generator.
- Produces:
  - `SUPPORTED_LANGS` in `src/data/types.ts`, exactly `['vi', 'en', 'ja']`, with `Lang` derived from that tuple.
  - `detectLang(languages: readonly string[]): Lang`, matching the first currently supported primary language in browser order, case-insensitively, with `en` fallback.
  - `estimateDurationMs(text: string, lang: Lang): number`, using locale-aware word segmentation.
  - `createLanguagePicker(root: HTMLElement, store: Store<AppState>, onSelect: (lang: Lang) => void): { open(): void; dispose(): void }`.
  - `ControlActions.openLanguagePicker(): void` in place of `toggleLang()`.
  - Three complete UI/content/tour tables and a 42-entry manifest.

- [x] **Step 1: Add failing preference tests** for saved `vi`, `en`, and `ja`; `ja-JP` matching; supported-language order; unsupported `ko`/`de` tags; invalid saved values; and English fallback.
- [x] **Step 2: Run the preference tests and confirm they fail** because locale detection and saved values currently support only Vietnamese and English.

  Run: `npm test -- tests/unit/prefs.test.ts`
  Expected: FAIL for Japanese detection/persistence and the revised supported-language ordering.

- [x] **Step 3: Add failing Japanese number-format tests** and six-key parity/completeness checks for `vi`, `en`, and `ja`, covering every UI key, placeholder, `ContentId`, and tour stop.
- [x] **Step 4: Run localization tests and confirm they fail** because the Japanese tables and `ja-JP` number locale do not exist yet.

  Run: `npm test -- tests/unit/i18n.test.ts tests/unit/content.test.ts tests/unit/tourScripts.test.ts`
  Expected: FAIL for the missing Japanese locale data and formatting.

- [x] **Step 5: Implement the three-locale type, preference, formatting, and translation tables.** Use `SUPPORTED_LANGS = ['vi', 'en', 'ja']`; preserve valid saved locale; select the first currently supported browser locale; format with `ja-JP`; add non-empty Japanese strings, all body content, and all 14 tour scripts translated from English without changing factual claims.
- [x] **Step 6: Run locale/content/tour tests** and correct missing keys, placeholders, body names, Japanese sentence punctuation, and script validation until all pass.

  Run: `npm test -- tests/unit/prefs.test.ts tests/unit/i18n.test.ts tests/unit/content.test.ts tests/unit/tourScripts.test.ts`
  Expected: PASS for `vi`, `en`, and `ja`.

- [x] **Step 7: Add failing TypeScript and Python tests** for Japanese sentence splitting (`。！？`), contiguous proportional cues, and realistic subtitle-only duration for Japanese text.
- [x] **Step 8: Run cue tests and confirm they fail** because fallback splitting recognizes only ASCII terminators and whitespace-delimited words.

  Run: `npm test -- tests/unit/narration.test.ts`; `python scripts/test_generate_narration.py`
  Expected: FAIL for Japanese sentence boundaries and duration.

- [x] **Step 9: Implement locale-aware narration fallback.** Pass `lang` into `estimateDurationMs`; use `Intl.Segmenter(lang, { granularity: 'word' })`; recognize `。`, `！`, and `？` in TypeScript proportional cues and Python fallback cues.
- [x] **Step 10: Run narration fallback tests** and confirm existing Vietnamese/English behavior remains unchanged and Japanese cues cover all sentences.

  Run: `npm test -- tests/unit/narration.test.ts`; `python scripts/test_generate_narration.py`
  Expected: PASS.

- [x] **Step 11: Add failing generator tests** requiring Japanese source JSON and a locale-matched Edge TTS Neural voice while retaining current Vietnamese/English voice IDs.
- [x] **Step 12: Run generator tests and confirm they fail** because `VOICES` and source loading currently omit `ja`.

  Run: `python scripts/test_generate_narration.py`
  Expected: FAIL for the missing Japanese voice/source.

- [x] **Step 13: Extend narration generation and create the Japanese audio assets.** Add one supported Japanese Neural voice; preserve hash-based reuse, retries, cues, and existing assets. Run the existing generator to create 14 Japanese MP3s and update the manifest.

  Run: `npm run narration`
  Expected: Generate the Japanese clip for every one of the 14 stops without regenerating unchanged Vietnamese/English clips.

- [x] **Step 14: Strengthen narration asset tests** to assert all 14 stops × three locales exist, files exist, duration is 10–50 seconds, cues are contiguous and cover each segment, and all three voice entries are present.

  Run: `npm test -- tests/unit/narration.test.ts tests/unit/narrationAssets.test.ts tests/unit/tourController.test.ts`
  Expected: PASS with 42 stop/locale segments and no language mismatch.

- [x] **Step 15: Add failing language-picker unit and e2e tests** for three native-name labels, current locale indication, Japanese selection/persistence, close/Escape/backdrop, focus return, 44px targets, 320px/short viewport, and preserving an open body panel.

  Run: `npm test -- tests/unit/languagePicker.test.ts`; `npm run test:e2e -- tests/e2e/controls.spec.ts tests/e2e/panel.spec.ts`
  Expected: FAIL because the app still has a two-language toggle.

- [x] **Step 16: Implement the responsive language modal and wire app state.** Add a compact `文A` opener; show only `Tiếng Việt`, `English`, and `日本語`; identify the active locale; trap Tab focus; close on selection/Escape/backdrop/close button; return focus to opener. Save the choice, update `document.documentElement.lang` and all content, close the modal, and preserve panel/tour state. On mobile, use a bottom-aligned sheet that respects safe areas and long labels.
- [x] **Step 17: Run picker unit and targeted e2e tests** at 320px width and short mobile height; verify an open info panel remains selected and an active narration restarts at the same stop in Japanese.

  Run: `npm test -- tests/unit/languagePicker.test.ts tests/unit/infoPanel.test.ts tests/unit/tourController.test.ts`; `npm run test:e2e -- tests/e2e/controls.spec.ts tests/e2e/panel.spec.ts`
  Expected: PASS; Japanese choice persists across reload and no mobile overflow or focus loss occurs.

- [x] **Step 18: Update project guidance.** Update `AGENTS.md` to the current supported locale set and verified voice IDs. Update `src/data/CLAUDE.md` so English is the canonical translation source and Japanese AI translation is identified as not natively proofread.
- [x] **Step 19: Run complete verification and inspect payload budgets.**

  Run: `npm run lint`; `npm run typecheck`; `npm test`; `python scripts/test_generate_narration.py`; `npm run build`; `npm run check:budget`
  Expected: All commands pass; initial and JS gzip budgets stay within existing limits; builds do not fetch locale or audio services.

- [x] **Step 20: Commit the verified Japanese feature** with the approved spec and plan, using a Conventional Commit and required co-author trailer.

  ```powershell
  git add src tests scripts public/audio/narration docs/superpowers/specs/2026-11-05-japanese-localization-design.md docs/superpowers/plans/2026-11-05-japanese-localization.md AGENTS.md src/data/CLAUDE.md
  git commit -m "feat(t33): add Japanese support" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

- [x] **Step 21: Request a fresh reviewer check** for spec compliance and code quality. Fix required issues (up to two rounds), rerunning affected tests and full verification after the final fix; make new commits rather than amending.
- [x] **Step 22: Record Task 33 progress** in `docs/progress/t33.md` with status, summary, verification commands/results, `DECISION:` lines, and reviewer outcome; tick completed steps in this plan.

  ```powershell
  git add docs/progress/t33.md docs/superpowers/plans/2026-11-05-japanese-localization.md
  git commit -m "docs(t33): record progress" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

- [ ] **Step 23: Push the feature branch and open a PR** with `gh pr create --base main`.
- [ ] **Step 24: Wait for CI** with `gh pr checks <number> --watch --fail-fast`; do not merge while any required check fails.
- [ ] **Step 25: Merge only after required checks pass**, using `gh pr merge <number> --merge --delete-branch`; remove the worktree and pull `main`.

After this Japanese phase is complete, stop. Do not begin Korean, German, or Russian until the user reviews the Japanese result and explicitly requests the next phase.
