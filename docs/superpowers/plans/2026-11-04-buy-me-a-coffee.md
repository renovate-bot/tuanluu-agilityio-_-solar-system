# Buy Me a Coffee CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localized support link to the “Thông tin” credits dialog that opens the provided MoMo page in a new tab.

**Architecture:** Extend the existing DOM-based credits modal with a semantic external anchor placed between its credits list and close button. Keep the English CTA label in both locale tables through the existing `t()` localization system and style it using the modal's existing CSS.

**Tech Stack:** TypeScript, vanilla DOM, Vite, Playwright, Vitest.

**Spec:** [2026-11-04-buy-me-a-coffee-design.md](../specs/2026-11-04-buy-me-a-coffee-design.md); base application requirements: [2026-10-29-solar-system-explorer-design.md](../specs/2026-10-29-solar-system-explorer-design.md).

## Global Constraints

- Every user-visible string goes through `t()` or the content modules and exists in both `vi` and `en`.
- Tap targets are at least 44x44 CSS px.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` without an eslint-disable comment explaining why.
- No UI framework, no state library, no backend.
- Credits must show: "Textures: Solar System Scope (CC BY 4.0)" linking https://www.solarsystemscope.com/textures/; NASA as data source; "Narration voice generated with Microsoft Edge TTS".
- Every npm script must run on Windows; use cross-platform Node scripts, not bash-only syntax.

## Review Focus

- Switching the app language must preserve the English CTA label `Buy me a coffee`; assert the accessible name in both languages in the credits-modal browser test.
- The link must use the exact supplied destination, not a generic donation homepage; assert its `href` is `https://me.momo.vn/bbk9x`.
- Opening an external destination in a new tab must not grant access to the opener; assert `target="_blank"` and `rel="noopener noreferrer"`.
- The CTA must remain easy to tap on desktop and a narrow mobile viewport; assert both dimensions are at least 44 CSS px in each viewport.
- Adding the CTA must not replace the required attributions or prevent the dialog from closing; retain the current attribution and close assertions.

---

### Task 1: Add a localized support link to the credits dialog

**Files:**
- Modify: `src/ui/credits.ts`
- Modify: `src/i18n/strings.ts`
- Modify: `src/ui/styles.css`
- Test: `tests/e2e/controls.spec.ts`
- Test: `tests/unit/content.test.ts`

**Interfaces:**
- Consumes: `createCredits(root: HTMLElement, store: Store<AppState>): Credits`; `t(lang, key)` and the existing `UiKey` type.
- Produces: the `credits.support` UI string (`Buy me a coffee` in both locales) and an anchor with `data-testid="credits-support"` pointing to `https://me.momo.vn/bbk9x`.

- [x] **Step 1: Write the failing browser test**

Add a test named `credits modal shows a safe support link with an English label across languages` in `tests/e2e/controls.spec.ts`. Open the dialog and assert that the accessible link named `Buy me a coffee` has the exact MoMo `href`, `target="_blank"`, and `rel="noopener noreferrer"`. Assert its bounding box is at least 44 by 44 CSS px at the default desktop viewport and at a 390x844 viewport. Close the dialog, switch to Vietnamese, reopen it, and assert the accessible link name remains `Buy me a coffee`. Keep the existing test's required-credit and close assertions.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/controls.spec.ts`
Expected: FAIL because the Vietnamese locale still translates the CTA label.

- [x] **Step 3: Implement the CTA**

Add `credits.support` to both locale tables in `src/i18n/strings.ts` with the exact label `Buy me a coffee`. In `src/ui/credits.ts`, create an anchor to `https://me.momo.vn/bbk9x`, set `target="_blank"`, `rel="noopener noreferrer"`, and `data-testid="credits-support"`, render its text through `t()`, and append it after the credits list and before the close button. Ensure language changes rerender the label. In `src/ui/styles.css`, give the CTA a distinct treatment consistent with the modal and at least a 44x44 CSS-pixel hit area.

- [ ] **Step 4: Run focused and project checks**

Run: `npm run test:e2e -- tests/e2e/controls.spec.ts`
Expected: PASS, including desktop/mobile hit-area, URL, safe-link, localization, existing credits, and close assertions.
Per user instruction, do not rerun this e2e command locally for the label correction; verify it in the pull request's CI.

Run: `npm run typecheck`, `npm run lint`, and `npm test`.
Expected: all checks pass.

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-11-04-buy-me-a-coffee.md docs/superpowers/specs/2026-11-04-buy-me-a-coffee-design.md
git add src/i18n/strings.ts tests/e2e/controls.spec.ts tests/unit/content.test.ts
git commit -m "fix(ui): keep support CTA label in English" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
