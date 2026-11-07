# Bổ sung tiếng Nhật — Tài liệu thiết kế

- **Ngày:** 2026-11-05
- **Trạng thái:** Chờ duyệt — phạm vi giai đoạn 1
- **Người đặt yêu cầu:** Tuan Luu

## 1. Mục đích

Hoàn thiện trải nghiệm tiếng Nhật cho người dùng mobile-first của Solar System Explorer, bên cạnh tiếng Việt và tiếng Anh hiện có. Một ngôn ngữ chỉ được xem là hoàn chỉnh khi giao diện, thông tin thiên thể, kịch bản/phụ đề tour và giọng đọc đều có cùng ngôn ngữ.

Đây là giai đoạn đầu: chỉ bổ sung tiếng Nhật. Tiếng Hàn, Đức và Nga được hoãn đến khi người yêu cầu xem xét kết quả tiếng Nhật và ra lệnh tiếp.

## 2. Mục tiêu, không-mục-tiêu và phản-mục-tiêu

### Mục tiêu

- Hỗ trợ đầy đủ `vi`, `en` và `ja`.
- Dịch mọi chuỗi giao diện, mọi nội dung thiên thể và cả 14 kịch bản tour sang tiếng Nhật.
- Cung cấp phụ đề và clip giọng đọc tiếng Nhật cho cả 14 điểm tour.
- Cho phép chọn tiếng Nhật, lưu lựa chọn, tự nhận diện trình duyệt và đổi ngôn ngữ khi tour đang chạy.
- Dùng bộ chọn phù hợp mobile, không làm mất thiên thể/bảng thông tin đang xem.

### Không-mục-tiêu của giai đoạn này

- Thêm, dịch, tạo giọng đọc hoặc hiển thị lựa chọn tiếng Hàn, Đức hay Nga.
- Thay đổi dữ liệu khoa học gốc, chức năng tour hay hành vi âm thanh không liên quan.
- Gọi dịch vụ dịch hoặc tổng hợp giọng đọc lúc runtime.

### Phản-mục-tiêu

- Tiếng Nhật có giao diện hoặc nội dung nhưng thiếu phụ đề hay giọng đọc.
- Tự rơi về ngôn ngữ khác khi đã chọn tiếng Nhật, phát sai ngôn ngữ clip, hoặc làm mất lựa chọn thiên thể.
- Làm tràn UI trên mobile hoặc yêu cầu backend/mạng để hiển thị tài nguyên đã đóng gói.

## 3. Hành vi sản phẩm

### 3.1 Locale và mặc định

Giai đoạn này hỗ trợ các mã `vi`, `en`, `ja`; nhãn hiển thị là **Tiếng Việt**, **English**, **日本語**. Dùng `vi-VN`, `en-US`, `ja-JP` để định dạng số.

Ngôn ngữ đã lưu hợp lệ trong `sse.lang` được ưu tiên. Nếu chưa có, dò `navigator.languages` theo thứ tự, không phân biệt hoa thường, và chọn ngôn ngữ đang được hỗ trợ đầu tiên. Nếu không khớp, dùng tiếng Anh. Các locale chưa được triển khai chưa xuất hiện trong bộ chọn.

### 3.2 Bộ chọn ngôn ngữ

- Dùng thiết kế **C — bảng chọn riêng** mà người yêu cầu đã chọn, trong giai đoạn này hiển thị ba locale đang hỗ trợ.
- Trên mobile, mở modal dạng bottom sheet; trên desktop, dùng hộp thoại thích hợp với màn hình rộng.
- Modal đánh dấu locale hiện tại, có vùng chạm tối thiểu 44×44 CSS px, cuộn được trên màn hình thấp, đóng được bằng lựa chọn/nút đóng/Escape/backdrop và trả focus về nút mở.
- Mở hoặc đóng modal không làm thay đổi thiên thể/bảng thông tin đang mở. Chọn ngôn ngữ cập nhật nội dung tại chỗ rồi đóng modal.

### 3.3 Nội dung và tour tiếng Nhật

- Bổ sung chuỗi UI và `BodyContent` tiếng Nhật cho mọi `ContentId`.
- Bổ sung kịch bản tiếng Nhật cho đủ 14 điểm tour.
- Manifest có đủ 14 clip tiếng Nhật, cue được tạo từ đúng kịch bản đó; cùng 28 clip Việt/Anh hiện có tạo thành 42 cặp điểm dừng/ngôn ngữ.
- Đổi ngôn ngữ khi đang thuyết minh sẽ phát lại cùng điểm dừng bằng clip/phụ đề của locale mới, giữ nguyên trạng thái tour và lựa chọn hiện tại.
- Tạo 14 MP3 tiếng Nhật bằng pipeline Edge TTS hiện có, commit tài nguyên; chỉ tải clip khi tour cần.

## 4. Bản dịch và độ chính xác

Tiếng Anh là nguồn chuẩn để dịch: bảng UI dùng `EN` làm tập khóa, `CONTENT_EN` dựa trên NASA Science, và `tour/en.json` là kịch bản tiếng Anh gốc. Người yêu cầu không có người bản ngữ hiệu đính; bản dịch tiếng Nhật sẽ do AI tạo và phải được ghi rõ là chưa được người bản ngữ xác nhận.

Kiểm tra phải bảo đảm đầy đủ khóa/placeholder/ID, tên riêng, ý khoa học, số liệu và đơn vị khớp nguồn tiếng Anh; cue phụ đề phải khớp kịch bản và clip. Các kiểm tra này không thay thế hiệu đính ngôn ngữ của người bản ngữ.

## 5. Ràng buộc kỹ thuật

- Tiếp tục dùng Vite, strict TypeScript, DOM thuần, Vitest/Playwright và Python `unittest`; không thêm framework, backend hay dependency.
- Mọi chuỗi UI đi qua `t()` hoặc content modules; `Lang` và bảng dữ liệu trong giai đoạn này chỉ có `vi`, `en`, `ja`.
- Giữ khóa lưu `sse.lang`, âm thanh mặc định tắt và quy tắc chỉ phát sau tương tác người dùng.
- Build/CI không cần mạng; Edge TTS chỉ dùng khi tạo asset trước, MP3/manifest được commit.
- Âm thanh vẫn đi qua Web Audio `GainNode`; không tải cả bộ clip lúc khởi động.
- Giữ vùng chạm tối thiểu 44×44 CSS px, layout mobile theo quy tắc hiện tại, initial load ≤ 8 MB, JS ≤ 800 KB gzip, pixel ratio ≤ 2 (1.5 ở `low`).
- Mở rộng `AGENTS.md` và `src/data/CLAUDE.md` để phản ánh locale/giọng đọc hiện có và ghi rõ nguồn tiếng Anh, bản dịch AI chưa được hiệu đính bản ngữ.

## 6. Phương án

### A. Tài nguyên tĩnh cùng ứng dụng — được chọn

Thêm locale data tiếng Nhật vào các bảng typed hiện có và tạo sẵn 14 clip trong thư mục audio đã commit. Clip tải theo tour, không ảnh hưởng tải khởi động. Cách này tương thích ứng dụng tĩnh, quy trình build không mạng, test typed và yêu cầu ghép phụ đề/giọng đọc. Đổi lại, repository tăng dung lượng do 14 MP3 mới.

### B. Tải locale khi người dùng chọn

Giảm một phần nội dung tải ban đầu, nhưng cần luồng chuyển ngôn ngữ bất đồng bộ và trạng thái chờ/lỗi, trong khi lượng dữ liệu tiếng Nhật còn nhỏ. Không chọn vì độ phức tạp không xứng đáng.

### C. Dịch/TTS qua dịch vụ runtime — loại

Không phù hợp với app không backend, build không mạng và yêu cầu tài nguyên có sẵn tại runtime.

## 7. Phạm vi dự kiến thay đổi

- Locale type, phát hiện/lưu locale và định dạng số trong `src/data/types.ts`, `src/state/prefs.ts`, `src/i18n/`.
- Bảng UI và content tiếng Nhật trong `src/i18n/strings.ts`, `src/data/content/ja.ts`, `src/data/content/index.ts`.
- Kịch bản tiếng Nhật, fallback cue/duration và controller trong `src/data/tour/ja.json`, `src/tour/`, `src/main.ts`.
- Bộ chọn mobile trong `src/ui/languagePicker.ts`, `src/ui/controlBar.ts`, `src/ui/styles.css`.
- Pipeline, manifest và 14 clip tiếng Nhật trong `scripts/generate-narration.py` và `public/audio/narration/`.
- Kiểm thử locale/content/tour/audio/modal; cập nhật `AGENTS.md`, `src/data/CLAUDE.md` và progress của Task 33.

## 8. Tiêu chí hoàn thành

1. Cả `vi`, `en`, `ja` có cùng tập khóa UI; bảng nội dung đủ mọi `ContentId`; mỗi tour script có đúng 14 stop.
2. Japanese UI/content/tour đầy đủ, không có placeholder/TODO; tên thiên thể trong script khớp bản địa hóa.
3. Manifest có đủ 42 cặp stop/locale; mỗi clip tồn tại, có thời lượng/cue hợp lệ; 14 clip tiếng Nhật dùng voice Nhật.
4. Đổi locale trong khi đang tour phát lại tiếng Nhật đúng điểm dừng; đổi lựa chọn không làm mất panel/thiên thể.
5. Locale đã lưu và nhận diện trình duyệt đúng trong ba ngôn ngữ; locale chưa hỗ trợ hoặc giá trị lưu sai fallback sang tiếng Anh.
6. Modal dùng được bằng bàn phím và chạm, có vùng chạm đủ lớn, không tràn ở 320px/viewport thấp và giữ nguyên nội dung đang xem.
7. Kiểm tra bản dịch tiếng Nhật theo tiêu chí đối chiếu dữ kiện và ghi nhận rõ chưa có native proofreading.
8. Lint, typecheck, unit tests, Python tests, build và budget check hiện có đều đạt; runtime không cần gọi dịch vụ locale/TTS.

## 9. Phần để người xây dựng quyết định

- Chọn và xác minh một Edge TTS Neural voice tiếng Nhật; giữ nguyên hai voice Việt/Anh hiện tại và ghi ID tiếng Nhật vào manifest/tài liệu hướng dẫn.
- Chọn cách tổ chức data tiếng Nhật theo pattern typed hiện tại.
- Chọn chi tiết layout modal desktop/mobile, miễn đáp ứng hành vi, focus, cuộn, safe area và vùng chạm đã nêu.
