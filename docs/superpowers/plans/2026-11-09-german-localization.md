# German Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete German (`de`) support, on every text surface and in the narration, alongside `vi`, `en` and `ja`.

**Architecture:** Add typed German UI, body and tour data to the existing static locale tables; the language picker, detection and tour controller are already generic over `SUPPORTED_LANGS`. Generate and commit 14 Edge TTS clips, loaded per tour stop. Subtitle safety comes from writing the German scripts without mid-sentence dots, guarded by a test, so the shared sentence splitter does not change.

**Tech Stack:** Vite, strict TypeScript, vanilla DOM, Vitest, Playwright, Python `unittest`, existing Edge TTS generator (no new dependency).

**Spec:** [2026-11-09-german-localization-design.md](../specs/2026-11-09-german-localization-design.md)

**Branch and worktree:** `feat/t38-german-support` in `.worktrees/t38` (already exists at `origin/main` bffbeaa; run `npm ci` there first). One PR. Progress file: `docs/progress/t38.md`. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Global Constraints

- Supported locales are exactly `vi`, `en`, `ja`, `de`, in that order. Do not add `ko` or `ru`.
- A locale ships only complete: UI strings, every `ContentId`, all 14 tour scripts, subtitles, narration. Tasks 1-3 land on one branch and only merge together.
- English is the canonical source. German is AI-translated and documented as not natively proofread.
- German addresses the viewer with informal "du" everywhere. Use real ä, ö, ü, ß. English "billion" is `Milliarde`, never `Billion`. Facts, numbers and units match English.
- `vi`, `en`, `ja` MP3s and manifest cues do not change.
- All user-visible text goes through `t()` or content modules. No new dependency, backend or runtime translation/TTS.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, no `any`. No regex lookbehind (Safari 16.0-16.3 fails to parse the bundle).
- Tap targets at least 44x44 CSS px. Initial load at most 8 MB, JS at most 800 KB gzip. Audio stays muted by default and goes through `GainNode`s.
- Never run `npm run format` on the whole repo; check with `npx prettier --check --end-of-line auto .`. Never run two e2e runs at once (port 4173). Do not delete or weaken a passing test.

## Review Focus

1. **Austrian/Swiss and mixed browser language lists:** `de-AT`, `de-CH`, `DE`, and `['fr-FR', 'de-DE']` must give German; an English-first list stays English. Pinned in Task 1, Step 1.
2. **Leftover English in German UI:** a key copied from English would pass parity checks yet show English to a German reader. Pinned by the allowlist test in Task 1, Step 1.
3. **"Billion" mistranslation and number drift:** a wrong `Billion` is a factor-of-1000 error. Pinned by the `de.json`/content guard in Task 1, Step 1.
4. **Switching to German mid-tour with sound on:** the same stop restarts with the German clip and cues, and a panel stays open. Pinned in Task 3, Step 1.
5. **Smallest phone with the longest strings:** at 320 px no page overflow or clipped control. Pinned in Task 3, Step 1.

---

### Task 1: German locale type, UI strings, body content and tour scripts

**Files:**
- Create: `src/data/content/de.ts`, `src/data/tour/de.json`
- Modify: `src/data/types.ts:2`, `src/data/content/index.ts`, `src/i18n/i18n.ts:13`, `src/i18n/strings.ts`, `src/main.ts:26,387`, `src/state/prefs.ts:20` (comment)
- Test: `tests/unit/prefs.test.ts`, `tests/unit/i18n.test.ts`, `tests/unit/content.test.ts`, `tests/unit/tourScripts.test.ts`, `tests/unit/languagePicker.test.ts`, `tests/unit/narrationAssets.test.ts` (only the `SCRIPTS` / `VOICE_PREFIX` records, so it typechecks)

**Interfaces:**
- Produces: `SUPPORTED_LANGS = ['vi', 'en', 'ja', 'de'] as const`; `CONTENT_DE` exported from `src/data/content/de.ts`; `UI_STRINGS.de`; `LANG_NATIVE_NAMES.de = 'Deutsch'`; `NUMBER_LOCALES.de = 'de-DE'`; `src/data/tour/de.json` with the 14 stop keys, shape `{ "<stopId>": { "text": string } }`.

- [ ] **Step 1: Write the failing tests**

`prefs.test.ts`:
```ts
it.each(['de', 'de-DE', 'de-AT', 'de-CH', 'DE'])('%s gives German', (tag) =>
  expect(detectLang([tag])).toBe('de'));
it('takes the first supported entry', () => {
  expect(detectLang(['fr-FR', 'de-DE'])).toBe('de');
  expect(detectLang(['en-US', 'de-DE'])).toBe('en');
});
it('a saved de wins over the browser languages', () =>
  expect(loadPrefs(mem({ [PREF_KEYS.lang]: 'de' }), ['ja']).lang).toBe('de'));
```
The exact-list test (line 54) becomes `['vi', 'en', 'ja', 'de']`. German is now supported, so lines 46, 47 and 78 swap their "unsupported" sample from `de` to `fr` (`['ko-KR', 'fr-FR', 'ja-JP']`, `['ko', 'fr', 'ru']`, `['fr']`); the assertions stay as they are.

`i18n.test.ts`: German number formatting uses a decimal comma, for example the existing number-format helper on `1234.5` for `de` returns `1.234,5`.

`content.test.ts`:
```ts
// Keys whose German value may equal English: proper names only.
const DE_SAME_AS_EN = new Set(['credits.support' /* extend only for brand names */]);
it('German UI is translated', () => {
  for (const [key, value] of Object.entries(UI_STRINGS.de)) {
    if (!DE_SAME_AS_EN.has(key)) expect(value, `de.${key}`).not.toBe(UI_STRINGS.en[key as keyof typeof UI_STRINGS.en]);
  }
});
expect(UI_STRINGS.de.notToScale.toLowerCase()).toContain('maßstab');
expect(UI_STRINGS.de['credits.voice']).toContain('Microsoft Edge TTS');
expect(UI_STRINGS.de['credits.textures']).toContain('Solar System Scope (CC BY 4.0)');
expect(UI_STRINGS.de['credits.support']).toBe('Buy me a coffee');
expect(getContent('earth', 'de').name).toBe('Erde');
expect(getContent('pluto', 'de').kindLabel.toLowerCase()).toContain('zwergplanet');
```
A key that is legitimately the same word in both languages (a cognate such as `Tour`) goes into `DE_SAME_AS_EN` with a comment naming why. Add `de` to the Ceres check at line 78 (`/Ceres/`), and add `de` wherever the file lists locales for parity.

`tourScripts.test.ts`: add `de` to `SCRIPTS`; `LENGTH_LIMITS.de = [45, 105]` (German packs meaning into fewer, longer words); add:
```ts
describe('German tour script', () => {
  it.each(EXPECTED_IDS)('%s has no mid-sentence dots', (id) => {
    const text = (de as Script)[id]?.text ?? '';
    expect(text).not.toMatch(/\b[a-zA-Z]\.\s?[a-zA-Z]\./); // z. B., d. h., u. a.
    expect(text).not.toMatch(/\b(ca|bzw|usw|etc|ggf|vgl|Mrd|Mio|Nr|Dr|St)\./i);
    expect(text).not.toMatch(/\d\.\s/); // ordinals; also rules out a sentence ending in a digit
  });
  it.each(EXPECTED_IDS)('%s does not mistranslate billion', (id) =>
    expect((de as Script)[id]?.text ?? '').not.toMatch(/\bBillion/));
  it('addresses the viewer informally', () => {
    const all = Object.values(de as Script).map((s) => s.text).join(' ');
    // Not "Ihre": at a sentence start it also means "its/their" for a planet.
    expect(all).not.toMatch(/\b(Sie sehen|Schauen Sie|Stellen Sie|Fliegen Sie)\b/);
  });
});
```
Also assert in `content.test.ts` that no German body string matches `/\bBillion/`.

`languagePicker.test.ts`: four options, including `Deutsch`; selecting it calls `onSelect('de')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/unit/prefs.test.ts tests/unit/i18n.test.ts tests/unit/content.test.ts tests/unit/tourScripts.test.ts tests/unit/languagePicker.test.ts`
Expected: FAIL (missing `de.json` import and `de` tables).

- [ ] **Step 3: Add the locale and German data**

Add `'de'` to `SUPPORTED_LANGS`, then satisfy every `Record<Lang, ...>`. Translate `UI_STRINGS.de`, `CONTENT_DE` and `de.json` from English, following the Global Constraints. Script style: `zum Beispiel`, `etwa`, `das heißt`, `Milliarden`, `Millionen`, `der achte Planet`; rephrase so no sentence ends in a digit. Keep UI labels short from the start (mobile buttons). Update the `prefs.ts:20` comment, whose `de` example is stale.

- [ ] **Step 4: Run to verify they pass**

Run: same command as Step 2, then `npm run typecheck`.
Expected: PASS, including the unchanged `vi`, `en`, `ja` cases.

- [ ] **Step 5: Commit** `feat(t38): add German UI, content and tour scripts` with the source and test files.

### Task 2: German narration

**Files:**
- Modify: `scripts/generate-narration.py:3,20`, `scripts/test_generate_narration.py:134-141`, `tests/unit/narrationAssets.test.ts`, `tests/unit/narration.test.ts`, `public/audio/narration/manifest.json`
- Create: 14 `public/audio/narration/<stopId>.de.mp3`

**Interfaces:**
- Consumes: `src/data/tour/de.json` from Task 1.
- Produces: `VOICES["de"]`, and a manifest with 56 stop/locale segments.

- [ ] **Step 1: Confirm the voice**

Run: `python -c "import asyncio, edge_tts; print([(v['ShortName'], v['Gender']) for v in asyncio.run(edge_tts.list_voices()) if v['Locale']=='de-DE'])"`
Expected: `de-DE-KatjaNeural` listed as Female. If it is not, use the closest female `de-DE` Neural voice and log a `DECISION:`.

- [ ] **Step 2: Write the failing tests**

Python: `list(gn.VOICES) == ["vi", "en", "ja", "de"]` and `gn.VOICES["de"]` matches `^de-DE-[A-Za-z]+Neural$`.

`narrationAssets.test.ts`: add `de` with `VOICE_PREFIX.de = 'de-DE-'`; the existing per-locale checks then cover 14 x 4 = 56 entries, files, duration and contiguous cues. Add an assertion that joined German cue text, whitespace-normalized, equals the `de.json` text.

`narration.test.ts`: `estimateDurationMs` on a German sentence counts whole words (umlauts and `ß` do not split a word); `resolveSegment(null, 'earth', 'de', 'Erster Satz. Zweiter Satz mit 4,6 Milliarden Jahren.')` returns exactly 2 cues, with `4,6` intact.

- [ ] **Step 3: Run to verify they fail**

Run: `python scripts/test_generate_narration.py`; `npm test -- tests/unit/narrationAssets.test.ts`
Expected: FAIL on the missing `de` voice and manifest entries. The `narration.test.ts` cases may already pass, because the code is generic; they stay as regression pins and that is noted in the progress file.

- [ ] **Step 4: Add the voice and generate**

Add `"de"` to `VOICES` and update the docstring. There is no `.venv`, so run `python scripts/generate-narration.py` with global Python 3.14 from the worktree.
Expected: 14 German clips created; unchanged text not regenerated.

- [ ] **Step 5: Verify nothing else changed, and tests pass**

Run: `git status --short public/audio/narration`
Expected: only `manifest.json` modified plus 14 new `.de.mp3` files.

Run from the worktree, saved as a scratch script outside the repo: compare `segments[stop][lang]` for `vi`, `en`, `ja` between `git show origin/main:public/audio/narration/manifest.json` and the working file with `assert.deepStrictEqual`.
Expected: no assertion error.

Run: `python scripts/test_generate_narration.py`; `npm test -- tests/unit/narration.test.ts tests/unit/narrationAssets.test.ts tests/unit/tourController.test.ts`
Expected: PASS. If a cue mismatch appears, fix the punctuation in `de.json` or rely on the existing `align_cue_text()`, then regenerate the affected stops.

- [ ] **Step 6: Commit** `feat(t38): add German narration`.

### Task 3: Mobile fit, mid-tour switch, docs and verification

**Files:**
- Create: `tests/e2e/german-fit.spec.ts`, `docs/progress/t38.md`
- Modify: `tests/unit/tourController.test.ts`, `tests/e2e/controls.spec.ts`, `tests/e2e/flows.spec.ts`, `tests/e2e/panel.spec.ts`, `src/ui/styles.css` and `src/i18n/strings.ts` (only if the fit test fails), `AGENTS.md`, `src/data/CLAUDE.md`, `docs/HUMAN_REVIEW.md`

**Interfaces:**
- Consumes: the complete `de` locale and manifest from Tasks 1-2; the existing e2e helpers and selectors in `panel.spec.ts` and `controls.spec.ts`.

- [ ] **Step 1: Write the tests**

`tourController.test.ts`: switching to `de` during an unmuted stop restarts the same stop with the `de` segment.

`controls.spec.ts`: choose `Deutsch` in the picker while the tour plays unmuted: same stop, German clip requested, `sse.lang === 'de'` after reload, `<html lang="de">`. `panel.spec.ts`: choosing `Deutsch` keeps the open panel and selected body. `flows.spec.ts`: extend the language cycle to `vi→en→ja→de`.

`german-fit.spec.ts`: with `sse.lang = 'de'` set through `addInitScript`, at 320x568 and on the `iphone13` and `pixel7` projects, with each of these open in turn (control bar, body info panel, tour UI, language picker, credits):
```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
// every visible button and label: no clipped text, and tap size
expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
expect(box.width).toBeGreaterThanOrEqual(44);
expect(box.height).toBeGreaterThanOrEqual(44);
```

- [ ] **Step 2: Run them**

Run: `npx playwright test tests/e2e/german-fit.spec.ts --project=desktop` first, then `--project=iphone13` and `--project=pixel7`, one at a time. Then the same for `controls`, `panel`, `flows`, `tour`.
Expected: note every failure. Behaviour tests that pass at once stay as regression pins.

- [ ] **Step 3: Fix any overflow**

Shorten the German string first. Only if that cannot work, add `overflow-wrap: anywhere` or `hyphens: auto` scoped to `:lang(de)` so other locales keep their exact look.

- [ ] **Step 4: Update the docs**

`AGENTS.md`: purpose line and `src/data` folder note list vi/en/ja/de; supported locales add `de` with only Korean and Russian deferred; AI-translation note covers Japanese and German; add `de-DE-<voice>` to Voices. `src/data/CLAUDE.md`: same locale and proofreading note. `docs/HUMAN_REVIEW.md` (Vietnamese): add a to-do for a native German speaker to proofread UI, body content and tour scripts.

- [ ] **Step 5: Full verification**

Run: `npm run lint`; `npm run typecheck`; `npm test`; `python scripts/test_generate_narration.py`; `npx prettier --check --end-of-line auto .`; `npm run build`; `npm run check:budget`
Expected: all pass, JS gzip at most 800 KB, initial payload at most 8 MB.

- [ ] **Step 6: Commit** `feat(t38): verify German on mobile and update docs`, together with this plan and the spec.

- [ ] **Step 7: Review.** Run `reviewer` on the branch diff (spec compliance, then code quality, and a fact check of German against English on a sample of stops). At most 2 fix rounds, with new commits.

- [ ] **Step 8: Record.** Write `docs/progress/t38.md` in the style of `t37.md`, tick this plan, commit `docs(t38): record progress`.

- [ ] **Step 9: Ask the user before going outward.** Report results and get approval, then push, `gh pr create --base main`, `gh pr checks <n> --watch --fail-fast` (2 fix rounds at most). Merging deploys to GitHub Pages: `gh pr merge <n> --merge --delete-branch`, `git worktree remove .worktrees/t38`, pull `main`.
