# CSKH — Tin nhắn chăm sóc (BA P2110)

BlueDental riêng, `app.nfcdental.com` không có các màn này. Không có trang
tham chiếu để quan sát.

Nguồn:

- `P2110.drawio` của BA (ảnh img_01..img_08);
- mock HTML `3 · Gửi tin nhắn` (`Send.dc.html`, dùng cho đợt 2).

Mọi thứ BA chưa nói và chủ dự án chưa chốt nằm trong `../unknowns.md` (F-76).

| Đợt | Màn | Feature |
|---|---|---|
| 1 | Tab "Template tin nhắn" + trang Tạo/Sửa mẫu | F-76 (`../../testing/features/cskh-message-template.md`) |
| 2 | Gửi tin nhắn (`Send.dc.html`) | F-77 (`../../testing/features/cskh-message-send.md`) |
| 3 | Thống kê CSKH | F-78 |

Giữ thiết kế v2: token `--bd-*` và các component dùng chung (`PageHeader`,
`PillTabs`, `CountPill`, bảng có đường kẻ dọc). Không dùng bảng màu riêng
trong ảnh BA.

## Tab "Template tin nhắn" (`/cskh-grouping?tab=template`)

Là tab thứ ba của /cskh-grouping, sau "Chăm sóc khách hàng" và "Phân nhóm
CSKH". Chỉ hiện khi có `cskhTemplate.read`.

- **Thanh lọc**:
  - chip kênh: Tất cả / SMS / Zalo / Email, mỗi chip có số đếm;
  - chọn Mục đích (10 loại CSKH);
  - ô tìm theo tên hoặc nội dung, không phân biệt dấu;
  - nút "Tạo mẫu mới" (quyền create).
- **Bố cục**: hai cột, `minmax(0, 1fr) 340px`. Dưới 1100 px chồng thành một cột.
  - Trái: bảng Tên mẫu · Kênh · Mục đích · Số biến · Đã gửi · Trạng thái.
  - Phải: thẻ xem trước của dòng đang chọn, gồm nội dung có tô biến, các biến trong mẫu và nút Chỉnh sửa / Nhân bản.
- **Trạng thái**: Nháp · Sẵn sàng · Chờ duyệt · Zalo từ chối · Ngừng dùng.
- **Sắp xếp**: theo kênh, rồi trạng thái, rồi tên.
- **Mở tab**: tự đồng bộ trạng thái các mẫu Zalo với Zalo. Không đọc được Zalo
  thì giữ trạng thái cũ và báo trên tab.

## Trang Tạo / Sửa mẫu (`/cskh-grouping/templates/new`, `/:id`) — img_08

- **Đầu trang**:
  - breadcrumb "Mẫu tin nhắn / Tạo mẫu mới" hoặc "Mẫu tin nhắn / Sửa mẫu"; bấm "Mẫu tin nhắn" thì về tab;
  - tiêu đề sr-only (R-993);
  - nút Lưu nháp và Lưu mẫu (primary). Nút loading và disabled khi đang lưu.
- **Bố cục**: hai cột, `minmax(0, 1fr) 360px`. Ở 1280 px cột phải còn 320 px;
  dưới 1100 px chồng thành một cột.
- **Cột trái**:
  1. **Chọn kênh**: 3 thẻ SMS / Zalo / Email. SMS và Email có pill "Chưa kết nối
     gửi". Đổi kênh khi đã soạn nội dung thì hỏi lại, vì mỗi kênh chỉ giữ trường
     của mình. Khi sửa mẫu thì không đổi được kênh.
  2. **Thông tin mẫu**: Tên mẫu, Mục đích (bắt buộc khi Lưu mẫu).
  3. **Soạn nội dung**:
     - SMS / Email:
       - ô nội dung (SMS tối đa 1000 ký tự), chân ô ghi "N ký tự sau khi thay biến" theo bản xem trước;
       - Email có thêm Tiêu đề;
       - SMS có ô "Tự bỏ dấu tiếng Việt";
       - chip biến hay dùng ("+ Họ và tên", …);
       - gõ `{` mở listbox gợi ý "Thư viện biến": ↑↓ chọn, Enter / Tab chèn, Esc đóng;
       - kéo-thả biến vào ô.
     - Zalo:
       - chọn mẫu ZNS đã duyệt;
       - bảng tham số: mỗi tham số một ô giá trị, điền sẵn biến khớp tên;
       - chi nhánh chưa nối OA thì báo cần kết nối và khoá ô chọn.
     - **Biến trong mẫu**: các biến đang dùng, kèm cách xử lý khi trống ("trống:
       Quý khách" / "bỏ qua khách" / "luôn có"). Có nút gỡ biến.
- **Cột phải**:
  1. **Thư viện biến**:
     - ô tìm;
     - nhóm Tất cả / Khách hàng / Lịch hẹn / Điều trị / Hệ thống, dạng PillTabs xuống dòng, có số đếm;
     - danh sách cao tối đa 480 px (khoảng 8 biến);
     - mỗi dòng: tên, ví dụ, `{key}`, nút + (✓ nếu đã dùng).
  2. **Xem trước**: dùng khách mẫu thật của chi nhánh (ưu tiên khách có lịch hẹn
     sắp tới), có nút "Đổi khách".
  3. **Quy tắc kênh**: các lưu ý theo kênh.
- **Rời trang khi chưa lưu**: dialog "Ở lại" / "Bỏ thay đổi".

### Tìm biến (R-1008)

Gợi ý `{`, ô tìm của Thư viện biến và ô tham số ZNS dùng chung
`matchesVariable`.

- Truy vấn được bỏ dấu, rồi phải khớp **đầu một từ** của key hoặc tên biến.
- Ví dụ: `ng` → Ngày sinh, Ngày hẹn, Ngày điều trị. **Không** ra
  `{ten_khach_hang}`, vì "ng" chỉ nằm giữa từ "khang".
- `ngay_h`, `ngày h`, `ngay hen`, `hen` đều ra `{ngay_hen}`.

## Công cụ › Tin nhắn

Bỏ sub-tab "Mẫu tin nhắn" (quyết định 6). Mẫu nay quản lý ở CSKH ›
Template tin nhắn. Hai sub-tab Cấu hình / Danh sách tin nhắn giữ nguyên.

## Visual parity với img_08 (2026-10-22, 1440 px, build production)

So ảnh local `local-editor3-new.png` (scratchpad, không commit vì có tên khách
của DB develop) với img_08:

| Điểm | Kết quả |
|---|---|
| Bố cục 2 cột, thứ tự thẻ | khớp |
| `{ng` chỉ gợi ý Ngày … | khớp (R-1008, trước đó ra cả Họ và tên) |
| Nhóm biến | khớp: xuống dòng, trước đó là thanh cuộn ngang |
| Số biến thấy được trong thư viện | khoảng 8, khớp (trước 340 px, nay 480 px) |
| Pill "Chưa kết nối gửi" trên SMS / Email | khác, cố ý (quyết định 1) |
| Số biến: 16 so với 29 của BA, không có "Tên gọi ngắn" | khác, cố ý (quyết định 3, bộ biến cố định) |
| Nhãn nhỏ "SMS" trên ô nội dung | khác, chưa làm |
| Thứ tự gợi ý: Ngày sinh trước Ngày hẹn | khác: theo thứ tự thư viện (nhóm Khách hàng trước Lịch hẹn) |
| Màu, font | theo v2 (quyết định 9), không theo ảnh BA |

## Gửi tin nhắn (`/cskh-grouping/send`) — `Send.dc.html` (F-77)

Chủ dự án yêu cầu ưu tiên đúng bố cục mock này (2026-10-22). Chỉ có Xem
(`cskhSend.read`) thì vẫn mở được màn, nhưng không có nút gửi.

- **Đầu trang**: breadcrumb "Chăm sóc khách hàng / Gửi tin nhắn"; bấm "Chăm sóc
  khách hàng" thì về đúng tab và ngày đang xem. Tiêu đề sr-only (R-993).
- **Bố cục**: hai cột như mock. Trái là 3 bước đánh số; phải là cột kiểm tra.
- **Cột trái**:
  1. **Kênh gửi**:
     - 3 thẻ SMS / Zalo / Email, mỗi thẻ ghi "N mẫu sẵn sàng";
     - nhãn "Chỉ chọn 1 kênh";
     - SMS / Email có pill "Chưa kết nối gửi";
     - dòng ghi chú "Mỗi lần gửi dùng 1 kênh và 1 mẫu…" nằm dưới thẻ kênh (mock đặt dưới tiêu đề trang).
  2. **Mẫu {kênh}**:
     - ô chọn mẫu có tên, mục đích, "đã gửi N", "dùng lần cuối";
     - pill trạng thái;
     - link "+ Tạo mẫu {kênh} mới".
  3. **Gửi tới**:
     - nguồn Danh sách CSKH / Khách lẻ;
     - Ngày / Tuần / Tháng + chọn ngày (cùng kiểu thanh ngày của bảng CSKH);
     - "Chọn 1 danh sách chăm sóc": 10 chip có số đếm;
     - dải thống kê: N khách · chưa nhận · đã nhận · không có SĐT · thiếu dữ liệu biến;
     - ô "Tìm tên, SĐT";
     - bảng # · Khách hàng (tên + mã) · SĐT / Zalo / Email · Bác sĩ · Đã nhận mẫu này · Xóa;
     - ô "Không gửi lại cho khách đã nhận mẫu này trong 30 ngày".
- **Cột phải**:
  1. **Kiểm tra trước khi gửi**: Kênh gửi · Mẫu thuộc kênh · N khách sẽ nhận · Dữ liệu biến · Chống gửi trùng. Dòng chưa ổn có dấu ! và nói lý do.
  2. **Xem trước · {kênh}**: "Ví dụ với {khách}". Zalo hiện từng tham số ZNS = giá trị.
  3. **Tóm tắt lần gửi**:
     - Kênh · Mẫu, Người nhận, Số tin sẽ gửi, Chi phí dự kiến;
     - hộp vàng "N khách sẽ không nhận tin lần này…";
     - Hẹn giờ gửi;
     - nút "Gửi N tin {kênh}" và "Gửi thử {kênh} tới tôi".
  4. **Lịch gửi đã hẹn**: các lượt đang chờ, có nút Huỷ hẹn.
- **Xóa** một khách: dialog "Bạn có chắc chắn muốn xóa khách hàng này ra khỏi
  danh sách chăm sóc" (chữ của BA). Chỉ bỏ khỏi lần gửi này, có "Hoàn tác N khách đã xóa".

### Visual parity với `Send.dc.html` (2026-10-22, 1440 px, build production)

So `send-ba.png` với `send-local.png` / `send-tall-local.png` (scratchpad,
không commit vì có tên khách của DB develop):

| Điểm | Kết quả |
|---|---|
| Hai cột; thứ tự 3 bước bên trái, 3 thẻ bên phải | khớp |
| Thẻ kênh có radio, "N mẫu sẵn sàng", "Chỉ chọn 1 kênh" | khớp; thêm icon kênh và pill "Chưa kết nối gửi" (quyết định 1) |
| Ô chọn mẫu: tên, mục đích, đã gửi, lần cuối, pill Sẵn sàng | khớp |
| Chip 10 danh sách có số đếm | khớp; "Complain" đã đổi thành "Khiếu nại" (BA P2110) |
| Dải thống kê, ô tìm, bảng, nút Xóa, ô 30 ngày | khớp; thêm chip "thiếu dữ liệu biến" (quyết định 3) |
| Kiểm tra trước khi gửi | khớp; thêm dòng "Dữ liệu biến" |
| Tóm tắt + Hẹn giờ + 2 nút | khớp; thêm tiêu đề "Tóm tắt lần gửi" |
| Tiêu đề trang | khác: sr-only (R-993), có breadcrumb |
| Thanh ngày | khác: Ngày / Tuần / Tháng + ngày, mock chỉ có Tháng |
| Nguồn "Tệp tải lên" | không có (quyết định 7) |
| Link "Tạo lần gửi khác cho nhóm này bằng kênh khác" | không có |
| Màu, font | theo v2 (quyết định 9) |
