# F-61 — Chuyển dữ liệu hệ thống cũ (Excel)

Status: `VERIFIED` · Verified commit: chưa commit · See `01-feature-verification-registry.md`

## Scope

BlueDental riêng, yêu cầu BA 2026-10-08 (Nha Khoa Đức Hạnh): đưa khách hàng và
lịch sử điều trị của hệ thống cũ vào một chi nhánh bằng một file Excel, chạy một
lần. Chỉ có endpoint (Swagger/curl), không có màn hình. API: `docs/clone/api.md`,
mục "Chuyển dữ liệu hệ thống cũ". Mẫu trống: `docs/migration/BlueDental_Migration.xlsx`
(3 sheet: Khách hàng, Điều trị, Hướng dẫn — sheet Danh mục đã bỏ theo chủ dự án, R-846).
File mẫu không chứa dữ liệu của DB nào (R-850).

Quyết định chủ dự án:

1. Mẫu đủ mọi cột khách hàng, không xuất dữ liệu sẵn có.
2. Không chuyển thanh toán — dòng điều trị giá 0, không sinh công nợ.
3. Dịch vụ / bác sĩ không có trong danh mục chi nhánh = lỗi, chặn cả file.
4. Cho trùng SĐT, trùng CCCD, dưới 16 tuổi không có giám hộ.
5. Chỉ endpoint.

## Luật nhập

- Đọc + kiểm toàn bộ file trước; `dryRun=true` hoặc có bất kỳ lỗi nào → không ghi gì.
- Khách hàng bắt buộc Mã KH, Họ và tên, và SĐT hoặc Email (R-834).
- Mã KH đã là bệnh nhân đang hoạt động của chi nhánh → bỏ qua bệnh nhân và mọi dòng
  điều trị của mã đó (chạy lại cùng file an toàn). Mã thuộc chi nhánh khác hoặc bệnh
  nhân đã xoá → lỗi.
- Dòng điều trị gộp phiếu theo (bệnh nhân, Mã phiếu), trống thì theo (bệnh nhân, ngày);
  mã DT01, DT02… theo ngày. Tiêu đề "Kế hoạch điều trị" (+ " (Mã phiếu)").
  Số lượng = max(1, số răng), giá 0. Phiếu có mọi công đoạn Hoàn thành → trạng thái Hoàn thành.
- Thời gian lùi về ngày trong file theo giờ phòng khám (UTC+7): hồ sơ 08:00, công
  đoạn 09:00 + 1 phút mỗi dòng cùng ngày.
- Bác sĩ khớp theo tên đăng nhập hoặc họ tên; trùng họ tên → lỗi "mơ hồ". Tài khoản bị
  khoá (đã nghỉ) vẫn khớp; tài khoản đã xoá thì không (R-837).
- Ngày: ô Date thật, số serial, hoặc chữ `dd/MM/yyyy`; sau hôm nay → lỗi; chỉ có năm → lỗi (R-838).
- Sheet tìm theo tên, không có mới theo vị trí; file lỗi luôn [Khách hàng, Điều trị] + cột "Lỗi" (R-839).
- Mã KH, mã phiếu không phân biệt hoa thường (R-840). Răng phải là số FDI thật (R-841),
  hoặc "Hàm trên / Hàm dưới / Nguyên hàm" = đủ 16 / 16 / 32 răng vĩnh viễn (R-847).
- Dropdown chỉ trên cột lựa chọn cố định: Giới tính, Quan hệ GH, Trạng thái (R-850).
  Cột danh mục / nhân sự không có dropdown — chủ dự án: file điền ở nơi khác với server
  nhập, list từ một DB sẽ chặn tên đúng ở DB kia; `dryRun` kiểm các tên đó.
  Dán dữ liệu bỏ qua validation của Excel nên vẫn chạy `dryRun`.
- Ghi DB: 200 bệnh nhân/lần, chung một transaction, không xếp event "created" của ABP (R-843).

## Evidence (2026-10-08)

Build production `vite preview` :8187 → host :5000 → PostgreSQL thật, đăng nhập
qua màn login, không chặn API.

| Kiểm tra | Kết quả |
|---|---|
| Backend API (HTTP thật) | `e2e/data-migration-api.spec.ts` **14/14** (R-850) |
| Mẫu | 200, spreadsheetml, 3 sheet, đúng tiêu đề 24 + 11 cột (BA bỏ Nhóm máu, Cảnh báo y tế — R-851) |
| Dropdown | Chỉ KH D (Giới tính), X (Quan hệ), ĐT K (Trạng thái), kiểu Stop, mọi giá trị list dry-run 0 lỗi, file lỗi giữ list |
| Dry run | Báo 2 khách / 2 phiếu / 3 công đoạn, DB không đổi |
| Lưu DB | Đọc lại bệnh nhân (tên, SĐT, email, ngày sinh, ghi chú, ngày tạo 08:00 +7, lý do khám), phiếu (DT01 "(PX01)" Hoàn thành SL 2, DT02), công đoạn (trạng thái, răng, ngày bắt đầu/xong, bác sĩ), giám hộ; công nợ = 0 |
| Chạy lại | 0 tạo, 2 bỏ qua, vẫn 2 phiếu |
| Lỗi | Dịch vụ / bác sĩ lạ, thiếu liên hệ, mã KH không có → 4 lỗi, không ghi gì; `import-errors` trả cột "Lỗi" đúng dòng |
| Thiếu cột | `fileErrors` nêu "Mã KH" |
| Cách ly chi nhánh | User chi nhánh 2 → 403 cả import lẫn template chi nhánh 1 |
| Đủ cột Khách hàng | SĐT/CCCD dạng số lấy lại số 0 đầu, ngày sinh Date thật, danh mục, nghề nghiệp tự do, giới tính, ngày tạo |
| Lịch sử | Mã không phân biệt hoa thường, 3 phiếu, trạng thái, SL = số răng, 6 mốc thời gian |
| Lỗi từng ô | 13 dòng KH + 6 dòng điều trị, mỗi dòng đúng câu, không ghi gì |
| Đảo sheet | File lỗi đúng thứ tự, đúng dòng |
| Bác sĩ bị khoá | Có trong mẫu, khớp `staffId` |
| File sai | Không phải .xlsx → 4xx có `error.message`; file rỗng → `fileErrors` |
| Mức retest | 2, cộng mức 3 một phần cho `BlueDentalDbContext` (R-844) |

## Ghi chú

- Quyền mới `BlueDental.SystemAdmin.DataMigration`: sau DbMigrator phải xoá cache quyền Redis (R-827).
- Không có UI nên không có kiểm tra trực quan.

## Hiệu năng (R-843, lưu thật, máy dev + PostgreSQL docker)

| Khối lượng | Trước | Sau |
|---|---|---|
| Dry run 5.000 KH / 20.000 dòng | ~0,7 s | ~0,7 s |
| Lưu 1.000 / 4.000 | 12,6 s | 5,4 s |
| Lưu 5.000 / 20.000 | 510 s | 11,6 s |
| Lưu 10.000 / 40.000 | — | 22,5 s |

Nguyên nhân cũ: một `SaveChanges` cho mọi entity + ABP 9.3.7 gộp event lúc complete
unit of work theo O(n²) (`UnitOfWork.GetEventsRecords`).

## Giới hạn đã biết (R-845)

- nginx `/api/`: body 20 MB, timeout 120 s → mỗi file nên ≤ ~10.000 khách hàng
  (file SheetJS 10.000 KH / 40.000 dòng = 19 MB; Excel thật nén nên nhỏ hơn).
- Chỉ `.xlsx`. Ngày sinh chỉ có năm → lỗi.
- Dịch vụ đã ngừng / bác sĩ đã xoá không khớp.
- Mã KH đã có → bỏ qua cả lịch sử, không nhập bổ sung.
- Liên hệ khẩn cấp lưu DB nhưng chưa hiển thị ở đâu. Nhóm máu, Cảnh báo y tế không còn
  trong mẫu (BA, R-851).
- SĐT khách hàng và SĐT người giám hộ theo luật form hồ sơ (`PATIENT_PHONE_PATTERN`):
  8–15 chữ số sau khi bỏ dấu cách / chấm / gạch; sai → lỗi dòng (R-851). SĐT liên hệ
  khẩn cấp không kiểm tra, như UI.
- Khác UI giữ nguyên theo quyết định trước: nhập cần SĐT **hoặc** email (form bắt SĐT),
  dưới 16 tuổi không giám hộ vẫn nhập được (form chặn).
- Bệnh nhân nhập vào trùng SĐT/CCCD: sửa hồ sơ sau này vẫn bị chặn trùng cho tới khi
  đổi giá trị — chủ dự án quyết giữ kiểm tra (2026-10-08).
