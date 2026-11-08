# Giải thích phần setup cho AI agent

Tài liệu này giải thích từng phần của bộ khung (harness) giúp AI tự xây dựng dự án này: nó là gì, vì sao có, nằm ở đâu và chỉnh thế nào. Quy tắc chung: file dành cho AI viết bằng tiếng Anh (ít token hơn), file dành cho người viết bằng tiếng Việt (như file này).

## 1. `AGENTS.md` và `CLAUDE.md`

- **Là gì:** `AGENTS.md` là nguồn duy nhất về ngữ cảnh dự án: mục đích, lệnh, cấu trúc thư mục, quy tắc bất biến, quy trình làm việc. `CLAUDE.md` chỉ có dòng `@AGENTS.md` (import) cộng vài ghi chú riêng cho Claude Code (model, command, hook).
- **Vì sao:** Codex, Cursor, Copilot đọc `AGENTS.md`; Claude Code đọc `CLAUDE.md`. Nếu chép nội dung ở cả hai nơi thì sẽ lệch nhau (xem `docs/decisions/0002-agents-md-single-source.md`). Dòng `@AGENTS.md` làm Claude Code nạp luôn file kia.
- **File:** `AGENTS.md`, `CLAUDE.md` ở gốc repo. Giữ `AGENTS.md` dưới 150 dòng vì nó được nạp mỗi phiên.
- **Cách chỉnh:** sửa quy tắc/lệnh trong `AGENTS.md`; chỉ thêm vào `CLAUDE.md` những thứ riêng của Claude. Chi tiết dài thì đưa vào `docs/` và chỉ trỏ tới.

## 2. CLAUDE.md lồng nhau

- **Là gì:** file ngữ cảnh đặt trong thư mục con, chỉ được nạp khi agent làm việc trong thư mục đó. Hiện có `src/data/CLAUDE.md`: danh sách việc phải làm khi thêm một thiên thể (dữ liệu, nội dung vi/en/ja/de, tour, khoá texture, nguồn trong `fetch-textures`, sinh lại giọng đọc, test cần cập nhật).
- **Vì sao:** quy ước riêng của một thư mục không cần tốn token ở mọi phiên.
- **Cách chỉnh:** sửa trực tiếp file đó khi cấu trúc code đổi (ví dụ đổi tên hàm hay thêm nơi phải khai báo). Có thể thêm file tương tự ở thư mục khác.

## 3. `.claude/settings.json` (quyền)

- **Là gì:** danh sách quyền cho phép/chặn lệnh, để lần chạy tự động không bị hỏi giữa chừng. File này bị "đóng băng" từ Task 1: agent không được sửa (có quy tắc `deny` cho chính nó). Chỉ người mới sửa.
- **Quyền cho phép (`allow`):**
  - `npm install`, `npm ci`, `npm run *`: cài và chạy mọi script (lint, test, build, fetch textures, narration...).
  - `npx playwright|vitest|tsc|eslint|prettier *`: các công cụ đã cài trong dự án. Cố ý không cho `npx` tuỳ ý; chế độ auto còn chặn `npx --yes <gói ngoài>`.
  - `python -m venv .venv`, `.venv/Scripts/python *`, `.venv/Scripts/pip install *`: Python chỉ trong venv của repo (để cài `edge-tts`).
  - `node scripts/*`, `node .claude/hooks/*`: script của dự án và hook.
  - `git` an toàn: `init, add, commit, status, diff, log, branch, checkout, switch, stash, rev-parse, show, merge, fetch, worktree`, `pull --ff-only`; `git push` chỉ cho nhánh có tiền tố `feat|fix|chore|docs|test|perf|ci|refactor/t...`.
  - `gh pr create|checks|merge|view|list|edit|comment|update-branch`, `gh run view|list`, `gh label create`, `gh api .../pages*`: toàn bộ luồng PR và bật Pages.
  - `Read, Edit, Write, Glob, Grep`: đọc/ghi file trong repo.
  - `WebFetch` chỉ tới các domain: `www.solarsystemscope.com`, `nasa.gov` và subdomain, `nssdc.gsfc.nasa.gov`, `science.nasa.gov`, `code.claude.com`, `registry.npmjs.org`, `pypi.org`.
- **Quyền chặn (`deny`):** push lên `main`, force-push, xoá nhánh remote, `git remote`, `reset --hard`, `clean`, `branch -D`, `rebase`, `gh repo delete`, merge bằng `--admin`, `gh api -X DELETE`, cài gói toàn cục (`npm install -g`, `pip install` ngoài venv), `rm -rf /` hoặc `~`, và sửa `.claude/settings.json`.
- **Cách siết lại sau khi chạy xong:** xoá các dòng `allow` không còn cần (ví dụ `git push`, `gh pr merge` nếu muốn tự tay merge; `.venv/Scripts/pip install *`; các `WebFetch(...)`; giới hạn `Edit`/`Write` theo thư mục). Thêm vào `deny` những thứ muốn cấm hẳn. Có thể dùng `.claude/settings.local.json` (không commit) để thử trước khi sửa file chính.
- **Lưu ý:** nếu một lệnh vẫn bị hỏi quyền do cú pháp rule không khớp, ghi vào `docs/KNOWN_ISSUES.md`; agent không tự nới quyền.

## 4. Hooks

- **Là gì:** script Node (chạy được trên Windows) do Claude Code tự gọi, khai báo trong `settings.json`.
  - `SessionStart` chạy `.claude/hooks/session-start.mjs`: in tóm tắt ngắn gồm plan hiện tại, task chưa tick đầu tiên (`Current: Task NN`), 5 file tiến độ gần nhất, PR đang mở, worktree, vấn đề còn mở trong KNOWN_ISSUES, nhánh và `git status`.
  - `Stop` chạy `.claude/hooks/stop-check.mjs`: khi agent kết thúc lượt, nếu có file `.ts` thay đổi thì chạy `npm run typecheck` và in lỗi nếu có. Chỉ thông báo, không chặn (luôn `exit 0`).
- **Vì sao:** phiên mới biết ngay đang dở việc gì mà không phải đọc cả plan; typecheck bắt lỗi sớm.
- **Cách chỉnh:** sửa file `.mjs` (không cần đụng `settings.json`). Muốn thêm/bớt hook thì phải sửa `settings.json` bằng tay.

## 5. Subagent và phân bổ model

- **Là gì:** các file trong `.claude/agents/` định nghĩa subagent kèm model (bảng §12.5 của spec):

| Bước | Subagent / model |
|---|---|
| Brainstorm, spec, plan, kịch bản thuyết minh | Opus (phiên của người dùng) |
| Điều phối khi thực thi plan | Sonnet (chọn bằng `/model sonnet`) |
| Task máy móc: tải texture, chạy TTS, tài liệu khung | `implementer-light` (haiku) |
| Task thường: UI, i18n, test, cấu hình, setup AI | `implementer` (sonnet) |
| Task khó: shader, camera, máy trạng thái tour, AudioEngine, hiệu năng | `implementer-heavy` (opus) |
| Review từng task (đúng spec, rồi chất lượng code) | `reviewer` (sonnet) |
| Review tổng thể cuối (Task 32) | `final-reviewer` (opus) |

- **Vì sao:** model mạnh ở chỗ sai một ly đi một dặm, model rẻ cho việc lặp lại. Mỗi subagent chỉ nhận nội dung task và các đoạn spec liên quan, không nhận cả spec, để tiết kiệm token. Task hỏng 2 lần ở bậc đã gán thì nâng một bậc và ghi `DECISION:`.
- **Cách chỉnh:** đổi dòng `model:` trong frontmatter của file agent, hoặc sửa nhãn `Model:` của task trong plan.

## 6. Command

- **Là gì:** các file markdown trong `.claude/commands/`, gõ bằng `/tên`.
  - `/resume-work`: làm tiếp sau gián đoạn (mục 9).
  - `/status`: báo cáo ngắn tiến độ (task xong/tổng, đợt hiện tại, PR, vấn đề mở).
  - `/add-body <tên>`: các bước TDD để thêm một thiên thể (đọc `src/data/CLAUDE.md`).
- **Cách chỉnh:** sửa nội dung file; thêm file mới là có command mới. `$ARGUMENTS` là phần người dùng gõ sau tên command.

## 7. Plan, tiến độ, KNOWN_ISSUES, ADR, BACKLOG

- **Plan** (`docs/superpowers/plans/...md`): danh sách task chính thức dạng checkbox, kèm Wave Plan, Branch Map, ràng buộc chung. Tick `- [x]` khi xong; hook SessionStart dựa vào đó để biết task hiện tại.
- **Tiến độ** (`docs/progress/t<NN>.md`): mỗi task một file (Status, Summary, Verification, `DECISION:`, Review) để task song song không ghi đè nhau. Task chèn thêm có tên riêng (ví dụ `t28b.md`).
- **KNOWN_ISSUES** (`docs/KNOWN_ISSUES.md`): mỗi vấn đề một tiêu đề `## `; thêm `(resolved)` khi xong, hook chỉ liệt kê mục chưa resolved.
- **ADR** (`docs/decisions/NNNN-tên.md`): quyết định kỹ thuật lớn (bối cảnh, quyết định, hệ quả). Hiện có 0001-0005 (ADR, AGENTS.md, WebP, bloom, kết quả hiệu năng).
- **BACKLOG** (`docs/BACKLOG.md`): ý tưởng ngoài phạm vi v1.
- **Cách chỉnh:** thêm file/mục mới theo mẫu có sẵn; không sửa lại lịch sử đã ghi.

## 8. Luồng nhánh, PR, CI, merge và Wave Plan

- **Mỗi task một nhánh và một PR:** tạo worktree riêng `git worktree add .worktrees/tNN -b <type>/tNN-<slug> origin/main`, `npm ci`, làm TDD, commit Conventional Commits (`feat(t07): ...`), tick plan, ghi `docs/progress/tNN.md`, push, `gh pr create`, chờ CI (job `verify` trong `.github/workflows/ci.yml`: lint, typecheck, unit, e2e), rồi `gh pr merge --merge --delete-branch`. CI lỗi quá 2 vòng: gắn nhãn `blocked`, ghi KNOWN_ISSUES, bỏ qua task phụ thuộc.
- **Vì sao:** lịch sử gọn (xem `git log --first-parent main`), mỗi task được review và hoàn tác độc lập, máy tắt giữa chừng chỉ mất một task.
- **Wave Plan:** Đợt A (1-4) tuần tự vì dựng nền. Đợt B (5, 6, 9-13) song song tối đa 3 agent vì là logic thuần/script độc lập, không đụng chung file. Đợt C (7 và 8 song song, rồi 14). Đợt D (15-32) tuần tự vì các task đồ hoạ/UI cùng sửa `main.ts` và dễ xung đột.
- **Thực tế khi chạy:**
  - Có task chèn thêm (28b, sửa các lỗi hình ảnh phát hiện ở Task 28).
  - E2E chậm và hay chập chờn khi render bằng phần mềm (SwiftShader), nên `playwright.config.ts` đặt `workers: 2`, `retries: 1`, timeout 60 giây.
  - `test:e2e` và `test:visual` dùng chung cổng 4173 nên không chạy cùng lúc; `test:perf` dùng cổng 4179 riêng.
  - Trên Windows `git worktree remove` đôi khi báo `Permission denied` (thư mục đang bị tiến trình giữ): tắt tiến trình rồi thử lại, hoặc để đó và chạy `git worktree prune` sau.
  - Chế độ auto chặn `npx --yes <gói ngoài>`: chỉ dùng công cụ đã cài.
- **Cách chỉnh:** sửa Wave Plan/Branch Map trong plan; sửa quy trình trong `AGENTS.md`.

## 9. Làm tiếp sau gián đoạn (từng bước)

1. Mở phiên mới. Hook SessionStart tự in trạng thái (hoặc chạy `node .claude/hooks/session-start.mjs`).
2. Gõ `/resume-work` (hoặc `claude --continue` rồi `/resume-work`).
3. Agent chạy `git worktree list`, `gh pr list --state open`, `git branch --no-merged origin/main` để thấy việc dở.
4. Với mỗi task dở, xác định bước theo luồng: chưa có PR thì kiểm tra lại (bước 3); PR có CI chưa xong/lỗi thì xử lý CI (bước 7); PR đã xanh thì merge (bước 8).
5. Thay đổi chưa commit trong worktree: commit nếu test của task pass, nếu không thì `git stash push -m "tNN-partial"` rồi làm lại phần cài đặt.
6. Tiếp tục theo Wave Plan: task chưa tick đầu tiên của đợt chưa xong sớm nhất là task hiện tại.

Lý do cách này hoạt động: trạng thái nằm trên đĩa (checkbox, progress, PR), không nằm trong "trí nhớ" của agent, nên tối đa mất một task dở.

## 10. Thêm tính năng trong tương lai: brainstorm, spec, plan, run

1. **Brainstorm** (skill `superpowers:brainstorming`, nên dùng Opus): nói ý tưởng, trả lời câu hỏi, chọn hướng. Ý tưởng cũ nằm sẵn ở `docs/BACKLOG.md`.
2. **Spec:** lưu thiết kế vào `docs/superpowers/specs/<ngày>-<tên>-design.md`, đọc lại và duyệt.
3. **Plan** (skill `superpowers:writing-plans`, Opus): sinh `docs/superpowers/plans/<ngày>-<tên>.md` với task nhỏ (5-15 phút), nhãn model, checkbox, Wave Plan, Branch Map.
4. **Run:** `/model sonnet`, rồi yêu cầu thực thi plan (skill `superpowers:subagent-driven-development`); dùng `/status` và `/resume-work` khi cần. Hook SessionStart chọn plan mới nhất theo thời gian sửa file.

Riêng việc thêm một thiên thể thì không cần cả quy trình này: dùng `/add-body <tên>`.
