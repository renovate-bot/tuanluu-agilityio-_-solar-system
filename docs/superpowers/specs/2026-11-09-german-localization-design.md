# Bổ sung tiếng Đức — Tài liệu thiết kế

- **Ngày:** 2026-11-09
- **Trạng thái:** Chờ duyệt
- **Người đặt yêu cầu:** Tuan Luu
- **Tiền lệ:** `docs/superpowers/specs/2026-11-05-japanese-localization-design.md` và `docs/progress/t37.md`

## 1. Mục đích

Người dùng nói tiếng Đức có trải nghiệm Solar System Explorer đầy đủ như người dùng tiếng Việt, Anh và Nhật. Yêu cầu của người đặt: tiếng Đức áp dụng cho **tất cả text và giọng đọc**.

Một ngôn ngữ chỉ được xem là hoàn chỉnh khi giao diện, thông tin thiên thể, kịch bản và phụ đề tour, giọng đọc đều có cùng ngôn ngữ (`AGENTS.md`, Invariants).

## 2. Mục tiêu, không-mục-tiêu và phản-mục-tiêu

### Mục tiêu

- Hỗ trợ đầy đủ `vi`, `en`, `ja`, `de`.
- Dịch mọi chuỗi giao diện, mọi nội dung thiên thể và cả 14 kịch bản tour sang tiếng Đức, gồm disclaimer "không đúng tỉ lệ" và credits.
- Có phụ đề và clip giọng đọc tiếng Đức cho cả 14 điểm tour.
- Chọn được tiếng Đức, lưu lựa chọn, tự nhận diện trình duyệt, đổi ngôn ngữ khi tour đang chạy.

### Không-mục-tiêu

- Thêm tiếng Hàn hoặc tiếng Nga.
- Sửa bản dịch tiếng Nhật, kể cả các điểm còn tồn trong `t37.md`.
- Thay đổi dữ liệu khoa học gốc, chức năng tour, hành vi âm thanh hoặc thiết kế bộ chọn ngôn ngữ.
- Gọi dịch vụ dịch hoặc tổng hợp giọng đọc lúc runtime.

### Phản-mục-tiêu

- Tiếng Đức có chữ nhưng thiếu phụ đề hoặc giọng đọc, hoặc còn sót chuỗi tiếng Anh.
- Phụ đề tiếng Đức bị ngắt câu sai tại chữ viết tắt hoặc số thứ tự.
- Chữ tiếng Đức dài làm tràn hoặc cắt nút, panel trên điện thoại.
- Âm thanh, cue hoặc giao diện của `vi`, `en`, `ja` bị thay đổi.

## 3. Hành vi sản phẩm

### 3.1 Locale

Mã `de`, nhãn **Deutsch**, định dạng số `de-DE`. Quy tắc nhận diện giữ nguyên: `sse.lang` hợp lệ được ưu tiên; nếu không, chọn mục đầu tiên trong `navigator.languages` có subtag chính được hỗ trợ (không phân biệt hoa thường, nên `de-DE`, `de-AT`, `de-CH` đều ra `de`); còn lại dùng `en`.

### 3.2 Bộ chọn ngôn ngữ

Modal `文A` hiện có thêm mục thứ tư. Mọi hành vi đã có giữ nguyên: đánh dấu mục hiện tại, bẫy focus, các cách đóng, trả focus, cuộn được trên màn hình thấp, vùng chạm tối thiểu 44×44 CSS px.

### 3.3 Nội dung và tour

- Chuỗi UI trong `src/i18n/strings.ts`, `BodyContent` cho mọi `ContentId`, 14 kịch bản tour.
- Manifest có 14 cặp mới, tổng 56 cặp điểm dừng/ngôn ngữ.
- Đổi sang tiếng Đức khi đang thuyết minh sẽ phát lại cùng điểm dừng bằng clip và phụ đề tiếng Đức, giữ trạng thái tour và lựa chọn hiện tại.
- Clip chỉ tải khi tour cần, không tính vào tải ban đầu.

## 4. Bản dịch

- Tiếng Anh là nguồn chuẩn. Bản dịch do AI tạo, phải tự nhiên và đúng ngữ pháp, không dịch sát từng chữ.
- **Xưng hô: "du"** ở mọi chỗ gọi trực tiếp người xem, nhất quán giữa giao diện và lời dẫn (người đặt đã chọn).
- Dùng đúng ä, ö, ü, ß và tên thiên thể tiếng Đức chuẩn (ví dụ Erde, Mond, Sonne, Merkur, Saturn).
- Số trong văn bản viết theo kiểu Đức: dấu phẩy thập phân, `Mrd.`/`Mio.` hoặc viết đủ `Milliarden`/`Millionen`. Lưu ý "billion" tiếng Anh là `Milliarde`, không phải `Billion`.
- Mọi dữ kiện, số liệu và đơn vị phải khớp bản tiếng Anh.
- Người đặt không có người bản ngữ hiệu đính. Bản dịch phải được ghi rõ là chưa được người bản ngữ xác nhận, và thêm việc cần làm vào `docs/HUMAN_REVIEW.md`.

## 5. Giọng đọc

- Giọng nữ, đồng bộ với `vi-VN-HoaiMyNeural`, `en-US-AvaNeural`, `ja-JP-NanamiNeural` (quyết định của người viết spec).
- Dự kiến `de-DE-KatjaNeural`, phải xác minh bằng `edge_tts.list_voices()`. Nếu không có, chọn giọng nữ Neural `de-DE` gần nhất và ghi `DECISION:`.
- Tạo bằng pipeline Edge TTS hiện có; MP3 và manifest được commit. Clip, cue của `vi`, `en`, `ja` phải giữ nguyên.
- Chưa có `.venv` trong repo; lần trước dùng Python toàn cục 3.14.7 với edge_tts 7.3.1, lần này làm tương tự.

## 6. Rủi ro riêng của tiếng Đức

### 6.1 Ngắt câu phụ đề

Tiếng Đức có dấu chấm giữa câu: `z. B.`, `ca.`, `d. h.`, `u. a.`, `Mrd.`, `Mio.` và số thứ tự như `8. Planet`. Bộ ngắt câu hiện có chỉ xử lý dấu chấm giữa hai chữ số.

**Cách làm (quyết định của người viết spec):** kịch bản tour tiếng Đức viết tránh các cấu trúc này (`zum Beispiel`, `etwa`, `Milliarden`, `der achte Planet`), và một unit test chặn chúng xuất hiện trong `de.json`. Không đổi bộ ngắt câu, nhờ đó loại bỏ rủi ro thay đổi cue của ba ngôn ngữ cũ và không phải giữ hai bản TS/Python đồng bộ thêm. Viết đủ chữ cũng giúp giọng đọc đọc đúng hơn.

Nếu Edge TTS đổi dấu câu trong cue, `align_cue_text()` hiện có phải đưa phụ đề về khớp kịch bản; kiểm tra bằng test tài nguyên.

### 6.2 Từ dài

Kiểm tra control bar, nút, panel, nhãn thiên thể, UI tour và bộ chọn ngôn ngữ bằng tiếng Đức ở iPhone 13, Pixel 7 và chiều rộng 320 px. Ưu tiên rút gọn câu chữ; chỉ thêm `hyphens`/`overflow-wrap` khi cần và không làm đổi giao diện ngôn ngữ khác. Đặt `lang="de"` trên tài liệu nếu dùng ngắt âm tiết tự động.

## 7. Ràng buộc kỹ thuật

- Tuân thủ Invariants trong `AGENTS.md`; không thêm framework, backend hay dependency.
- Build và CI không cần mạng. Initial load ≤ 8 MB, JS ≤ 800 KB gzip.
- Regex không dùng lookbehind (Safari 16.0–16.3 không parse được, xem `t37.md`).
- Cập nhật `AGENTS.md` (locale, giọng đọc, Đức không còn bị hoãn, Hàn và Nga vẫn hoãn) và `src/data/CLAUDE.md`.
- Một nhánh và một PR: `feat/t38-german-support`, tiến độ ghi ở `docs/progress/t38.md`.

## 8. Tiêu chí hoàn thành

1. Bốn ngôn ngữ có cùng tập khóa UI và placeholder; nội dung đủ mọi `ContentId`; mỗi tour có đúng 14 điểm dừng.
2. Tiếng Đức không có placeholder, TODO hoặc chuỗi tiếng Anh sót; số dữ kiện khớp tiếng Anh; `de.json` qua được test chặn viết tắt.
3. Manifest đủ 56 cặp; mỗi clip tồn tại với thời lượng và cue hợp lệ; 14 clip tiếng Đức dùng giọng Đức; cue khớp kịch bản.
4. `git diff` xác nhận MP3 `vi`, `en`, `ja` không đổi và cue của chúng trong manifest không đổi.
5. Đổi sang tiếng Đức khi tour đang chạy phát lại đúng điểm dừng; panel và thiên thể đang chọn được giữ.
6. `de`, `de-DE`, `de-AT`, `de-CH` nhận diện đúng; `sse.lang = de` được giữ sau khi tải lại; số hiển thị theo `de-DE`.
7. Không tràn hoặc cắt chữ ở iPhone 13, Pixel 7, 320 px; vùng chạm vẫn ≥ 44×44 CSS px.
8. Lint, typecheck, unit test, Python test, build, budget và các e2e liên quan (`controls`, `flows`, `panel`, `tour`) đều đạt.

## 9. Phần để người xây dựng quyết định

- Cách tổ chức dữ liệu tiếng Đức theo pattern typed hiện có.
- Câu chữ cụ thể, miễn đáp ứng mục 4 và mục 6.
- Hình thức kiểm tra tràn chữ (assertion e2e hoặc ảnh chụp), miễn đạt tiêu chí 7.
- Giới hạn độ dài kịch bản tiếng Đức, căn theo giới hạn hiện có trong `tests/unit/tourScripts.test.ts`, ghi `DECISION:` nếu cần nới.
