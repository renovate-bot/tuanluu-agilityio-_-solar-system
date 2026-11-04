# TokenEconomizer Installation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install TokenEconomizer as a Copilot CLI plugin and make it available while working in the current Solar System Explorer repository.

**Architecture:** Keep a persistent clone at `%USERPROFILE%\TokenEconomizer`, register its marketplace with Copilot CLI, and install the plugin. The plugin learns repository-specific state locally; no application code or dependencies change.

**Tech Stack:** Git, GitHub Copilot CLI, Python 3.14.

**Spec:** `docs/superpowers/specs/2026-11-04-token-economizer-design.md`

## Global Constraints

- Keep the plugin clone outside this project repository to avoid a nested Git checkout.
- Preserve existing workspace changes.
- Do not modify application dependencies or source code.
- Do not run the plugin's in-session setup commands without the user's approval in Copilot.
- Copilot CLI 1.0.105 is outside TokenEconomizer's listed tested range of 1.0.83–1.0.102; runtime compatibility is not guaranteed.

## Review Focus

- Existing clone at the target path: stop instead of overwriting it.
- Marketplace or plugin already registered: inspect and avoid duplicate or destructive setup.
- Copilot CLI compatibility: report installation success separately from runtime verification.
- Plugin permission prompts: allow the user to approve script execution in Copilot.
- Tool pruning changes: explain that it is reversible and must be confirmed from the new Copilot session.

---

### Task 1: Install TokenEconomizer for Copilot CLI

**Files:**
- External clone: `%USERPROFILE%\TokenEconomizer`
- Copilot CLI user configuration: marketplace and plugin registration
- No application files or dependencies

**Interfaces:**
- Consumes: Copilot CLI 1.0.105, Python 3.14, Git, and the approved installation design.
- Produces: a persistent local clone, registered `tokeneconomizer` marketplace, and enabled `tokeneconomizer@tokeneconomizer` plugin.

- [x] **Step 1: Check that `%USERPROFILE%\TokenEconomizer` does not already exist.** If it exists, inspect it and stop before cloning over it.
- [x] **Step 2: Clone `https://github.com/microsoft/TokenEconomizer.git` to `%USERPROFILE%\TokenEconomizer`.**
- [x] **Step 3: Register the clone as a Copilot CLI marketplace using its absolute Windows path.**
- [x] **Step 4: Install `tokeneconomizer@tokeneconomizer` from that marketplace.**
- [x] **Step 5: Run `copilot plugin marketplace list` and `copilot plugin list`; confirm the marketplace and enabled plugin appear.**
- [x] **Step 6: Report the unsupported-version caveat and instruct the user to start a new trusted Copilot session in this repository, then run `/tokeneconomizer:status` and `/tokeneconomizer:toolprune refresh-catalog`, approving the plugin script when prompted.**
