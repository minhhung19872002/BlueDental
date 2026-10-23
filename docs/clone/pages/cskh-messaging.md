# CSKH — Tin nhắn chăm sóc (BA P2110)

BlueDental riêng, `app.nfcdental.com` không có các màn này. Không có trang
tham chiếu để quan sát.

Nguồn:

- `P2110.drawio` của BA (ảnh img_01..img_08, img_31..img_33 cho đợt 3);
- mock HTML `3 · Gửi tin nhắn` (`Send.dc.html`, dùng cho đợt 2).

Mọi thứ BA chưa nói và chủ dự án chưa chốt nằm trong `../unknowns.md` (F-76, F-77, F-78).

| Đợt | Màn | Feature |
|---|---|---|
| 1 | Tab "Template tin nhắn" + trang Tạo/Sửa mẫu | F-76 (`../../testing/features/cskh-message-template.md`) |
| 2 | Gửi tin nhắn (`Send.dc.html`) | F-77 (`../../testing/features/cskh-message-send.md`) |
| 3 | Thống kê CSKH (`/dashboard/cskh`) | F-78 (`../../testing/features/cskh-message-stats.md`) |

Giữ thiết kế v2: token `--bd-*` và các component dùng chung (`PageHeader`,
`PillTabs`, `CountPill`, bảng có đường kẻ dọc). Không dùng bảng màu riêng
trong ảnh BA.

## Hộp thư Zalo + Lịch sử chăm sóc (BA P2210, F-79)

Nguồn: `P2210.drawio`, các ảnh "Hộp thư Zalo" và "Lịch sử chăm sóc khách hàng".

- Tab "Hộp thư Zalo" (`/cskh-grouping?tab=inbox`) là tab thứ ba, sau Phân nhóm CSKH, có badge số chưa trả lời. Cần `cskhInbox.read`.
- 3 cột như mock: danh sách (tìm, 4 chip, màu chờ), chat (Nhận xử lý, mẫu ZNS, trả lời), khách (tag, lịch hẹn, dịch vụ, công nợ, ghi chú).
- Tab Chăm sóc KH của hồ sơ: nút Mở chat Zalo / Gửi tin, khối Lịch sử chăm sóc khách hàng dưới bảng.
- Chi tiết và kiểm thử: `../../testing/features/zalo-inbox.md`. Điểm tự chọn: `../unknowns.md` (F-79).
- Không theo mock: không có Lịch sử chăm sóc ở cột phải hộp thư, không có nút Gọi điện; mẫu ZNS hiện thành thẻ xem trước thay vì chèn vào ô soạn tin. Màu, font theo v2.

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

## Thống kê CSKH (`/dashboard/cskh`) — img_31 / img_32 (F-78)

Chủ dự án: "Thống kê mới nằm ở sub menu Thống kê CSKH, còn thống kê hiện tại
nằm ở sub menu Tổng quan" (img_33). Nhóm header "Tổng quan" có 2 mục ribbon:
Tổng quan (`/dashboard`, trang cũ) và Thống kê CSKH. Cần `cskhStats.read`.

- **Đầu trang**: tiêu đề sr-only (R-993), nút "Xuất báo cáo Excel" bên phải (`cskhStats.export`).
- **Bộ lọc** (một hàng, như img_31): Thời gian (`PeriodRangePicker`, mặc định đầu tháng → hôm nay,
  ô ghi đơn vị "Theo ngày" trên khoảng ngày) · Tất cả / SMS / Zalo / Email · Mẫu.
- **Thẻ số**: Tin đã gửi · Gửi thành công · Thất bại (`KpiCard`, như trang Tổng quan).
- **Hàng 2**: Tin đã gửi theo ngày (trái) · Theo kênh (phải), tỉ lệ 1,85 : 1 (1,4 : 1 dưới 1280 px). Dưới 1100 px chồng thành một cột.
- **Hiệu suất theo mẫu**, **Lịch sử gửi**, **Người nhận**: bảng có đường kẻ dọc và phân trang
  dùng chung (`useTablePagination`).

Chi tiết số liệu, quyền và API: `../../testing/features/cskh-message-stats.md`.

### Visual parity với img_31 / img_32 (2026-10-22, 1440 px, build production)

So `stats-1440-tall2.png` (và `stats-390*.png` cho điện thoại; `.playwright-mcp/`,
không commit vì có tên khách của DB develop) với img_31 / img_32:

| Điểm | Kết quả |
|---|---|
| Thứ tự khối: bộ lọc → thẻ số → theo ngày + Theo kênh → mẫu → Lịch sử gửi → Người nhận | khớp |
| Bộ lọc một hàng: Thời gian, nút kênh dạng segmented, Mẫu | khớp; ô thời gian thêm dòng "Theo ngày" của `PeriodRangePicker` |
| Nút "Xuất báo cáo Excel" góc phải trên | khớp; tiêu đề "Theo dõi & thống kê" và dòng mô tả là sr-only (R-993) |
| Cột theo ngày: hôm nay đậm màu, các cột khác nhạt, số trên đầu cột | khớp một phần: chỉ cột cao nhất và cột hôm nay có số (BA ghi số mọi cột); có trục Y và đường lưới |
| Dòng phụ biểu đồ | khác: ghi khoảng ngày đang lọc ("01/10/2026 – 22/10/2026 · hôm nay đậm màu"), BA ghi "14 ngày gần nhất" |
| Theo kênh: tên, số tin, thanh, "Thành công N%" | khớp; không có "Đã xem / Đã mở / Không đo được lượt xem" bên phải (quyết định 8) |
| Thẻ số | khác, cố ý: 3 thẻ thay cho 5, không có Đã xem / mở và Khách phản hồi (quyết định 8); icon góc phải và viền thường của `KpiCard` v2, không có viền xanh / đỏ |
| Hiệu suất theo mẫu: Mẫu · Kênh · Lần dùng · Đã gửi · Thành công (thanh + %) · Lần cuối | khớp; không có cột Xem / mở, Phản hồi (quyết định 8); tên mẫu chữ đậm, không gạch chân / không phải link |
| Lịch sử gửi: 7 cột, Kết quả có thanh + "N thành công · N lỗi" / "N / M đã gửi" / "Chưa gửi" | khớp; thêm trạng thái "Đã huỷ" (huỷ hẹn ở F-77) |
| Tệp khách hàng | khác: "{tab CSKH} · {ngày}" hoặc "Khách lẻ"; không có tên file `.xlsx` (quyết định 7) |
| Người gửi | khác: họ tên tài khoản, không có tiền tố vai trò ("Lễ tân · …") |
| Người nhận: tìm + lọc trạng thái ở đầu thẻ | khớp; ô tìm "Tên hoặc SĐT" (BA "Tên, SĐT hoặc email"), thêm sắp xếp ở cột Khách hàng / Thời gian |
| SĐT ở Người nhận | khác: che theo quyền "Ẩn số điện thoại" như mọi màn khác, không che cố định "0912 *** 678" |
| Trạng thái người nhận | khác, cố ý: Đã nhận / Thất bại / Đang gửi / Đã hẹn giờ, không có Đã xem / Đã mở (quyết định 8); lý do thất bại cùng dòng như BA |
| Phân trang | khác: mọi bảng có phân trang chung (`10 / trang`), BA chỉ có ở Người nhận |
| Màu, font | theo v2 (quyết định 9): tím `--bd-primary`, không theo bảng màu ảnh BA |
| 390 px | các khối chồng một cột, bảng cuộn ngang trong thẻ, không cuộn ngang cả trang |

## Chiến dịch đã gửi (`/cskh-grouping?tab=campaign`) + Kết quả lần gửi (`/cskh-grouping/campaigns/:id`) — P2210 phần B (F-79)

BA P2210 (`P2210.drawio`, phần B): "Thêm tab mới giúp anh" cạnh Phân nhóm CSKH. Thứ tự tab:
Chăm sóc khách hàng · Phân nhóm CSKH · **Chiến dịch đã gửi** · Template tin nhắn. Cần `cskhSend.read`;
"+ Tạo chiến dịch" và "Tạm dừng" cần `cskhSend.create`.

- **Danh sách** (mỗi lần bấm Gửi là một dòng): Template · Khách hàng / Tệp khách hàng · Lần chạy gần nhất ·
  Trạng thái · Thao tác. BA bỏ 2 cột "Chiến dịch" / "Tên chiến dịch" và đưa Template lên đầu (2026-10-23).
- **Kết quả lần gửi**: đường dẫn + tiêu đề + chips · 7 thẻ số (+ Đã dừng khi > 0) · thanh chồng
  "Từ N khách đến M tin thành công" + chú thích + Lý do · bảng từng khách có 4 tab lọc.

Chi tiết số liệu, quyền và API: `../../testing/features/cskh-message-campaigns.md`.

### Visual parity với ảnh P2210 phần B (2026-10-23, 1440 px, build production)

So `local-list.png` / `local-result.png` (scratchpad của phiên, không commit vì có tên khách của DB develop)
với 2 ảnh BA. Lượt so đầu tìm ra 9 điểm lệch (a)–(i), đã sửa hết rồi chụp lại:

| # | Điểm | Trước | Sau sửa |
|---|---|---|---|
| a | Dòng phụ Lần chạy gần nhất khi không có lỗi | "1/1 thành công · 0 lỗi" | "1/1 thành công" như BA; còn lỗi thì "4/5 thành công · 1 lỗi" |
| b | Ngày giờ ở danh sách | "23/10/2026 10:22" | "23/10 10:22" như BA; năm chỉ hiện khi khác năm nay |
| c | Cột Thao tác | nút có icon, canh trái | nút thường không icon, canh phải |
| d | Tên cột bảng từng khách | "Khách hàng", "SĐT" | "Khách", "Số điện thoại" |
| e | Tab lọc | "Tất cả (4)" | "Tất cả · 4" |
| f | Tiêu đề thanh kết quả | "Kết quả theo khách đã chọn" | "Từ 4 khách đến 1 tin thành công" |
| g | Màu Bị loại | vàng cam | xám nhạt ở thanh, chú thích, nhãn trong bảng và icon thẻ số |
| h | Màu Đã dừng | chữ xám nhạt, khó đọc | xám đậm (`--bd-muted`), tách được với Bị loại khi cùng có |
| i | "Về danh sách CSKH" | nút thường | nút chính |

Các điểm khác so với ảnh BA còn giữ (cố ý):

| Điểm | Lý do |
|---|---|
| Thẻ số dùng `KpiCard` (icon góc phải, viền thường) | giao diện chung của hệ thống (Match system style), như Thống kê CSKH |
| Thanh kết quả có chú thích dưới, không ghi chữ trong thanh | phần nhỏ không đủ chỗ cho chữ; chú thích luôn đọc được |
| Lý do bị loại hiện dạng chip kèm số | cùng kiểu chip của CSKH |
| Thẻ "Đã nhận", không có "/ Đã xem" | Zalo không báo về lượt xem (quyết định 7) |
| Không có cột "Xử lý tiếp" / nút "Gọi điện" | BA bỏ (2026-10-23); R13 còn chờ chủ dự án |
| "300 đ" có khoảng trắng | cách viết tiền chung của app (`formatMoneyUnit`) |
| Đường dẫn không có mã lần gửi | lần gửi không có mã riêng; tiêu đề ghi tên mẫu |
| "Xuất Excel danh sách lỗi" viền xanh | cùng kiểu `cskh-excel-btn` của các nút Excel khác trong CSKH |
| Màu, font | theo v2 (`--bd-*`), không theo bảng màu ảnh BA |
