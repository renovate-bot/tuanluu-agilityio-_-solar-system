---
description: Print Solar System Explorer project status
---

Print a concise status report:

1. Done/total task counts: a task is done when all its checkboxes in `docs/superpowers/plans/2026-10-29-solar-system-explorer.md` are ticked (`- [x]`). Also run `node .claude/hooks/session-start.mjs`.
2. The current wave (per the Wave Plan) and the in-flight tasks (`git worktree list`, `git branch --no-merged origin/main`).
3. Open PRs with check status: `gh pr list --state open`, then `gh pr checks <n>` for each.
4. Open issues: `gh issue list --state open` plus open `## ` headings in `docs/KNOWN_ISSUES.md`.
5. The latest 5 files in `docs/progress/` (name and Status line).
