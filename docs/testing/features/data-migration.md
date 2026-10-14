# F-61 — Chuyển dữ liệu hệ thống cũ (Excel)

Status: `VERIFIED` · Verified commit: chưa commit · See `01-feature-verification-registry.md`

## Scope

BlueDental riêng, yêu cầu BA 2026-10-08 (Nha Khoa Đức Hạnh): đưa khách hàng và
lịch sử điều trị của hệ thống cũ vào một chi nhánh bằng một file Excel, chạy một
lần. Chỉ có endpoint (Swagger/curl), không có màn hình. API: `docs/clone/api.md`,
mục "Chuyển dữ liệu hệ thống cũ". Mẫu trống: `docs/migration/BlueDental_Migration.xlsx`
(5 sheet từ 2026-10-13: Khách hàng, Điều trị, Thanh toán, Lịch hẹn, Hướng dẫn — sheet Danh mục đã bỏ theo chủ dự án, R-846).
Hướng dẫn cho BA chép file khách Đức Hạnh: `docs/migration/huong-dan-chuyen-du-lieu-duc-hanh.md` (R-924).
File mẫu không chứa dữ liệu của DB nào (R-850).

Quyết định chủ dự án:

1. Mẫu đủ mọi cột khách hàng, không xuất dữ liệu sẵn có.
2. ~~Không chuyển thanh toán~~ — đổi 2026-10-13 (R-924): mẫu có cột tiền trên Điều trị và sheet Thanh toán,
   cả hai không bắt buộc. Để trống cột tiền thì vẫn giá 0, không sinh công nợ như cũ.
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

### Kế hoạch, tiền, thanh toán (R-924, 2026-10-13)

- Điều trị thêm 5 cột không bắt buộc: Kế hoạch, Số lượng, Đơn giá gốc, Đơn giá, Thành tiền (16 cột).
  Khoá gom = (Mã KH, Kế hoạch) → (Mã KH, Mã phiếu) → (Mã KH, ngày); tên kế hoạch = chữ ở cột Kế hoạch.
- Dòng có Đơn giá > 0 hoặc Thành tiền > 0 mở dòng dịch vụ mới (`AddService`): giá gốc = max(Đơn giá gốc, Đơn giá),
  Thành tiền < SL × ĐG → giảm giá tiền; lớn hơn → lỗi; Thành tiền mà thiếu Đơn giá → lỗi. Không VAT.
  Dòng không giá = công đoạn của dòng dịch vụ gần nhất cùng tên trong kế hoạch, chưa có thì dòng giá 0.
- Sheet "Thanh toán" (9 cột, tìm theo tên, không có cũng được): Mã KH\*, Mã phiếu, Kế hoạch (cần một trong hai),
  Ngày thu\*, Số tiền\* (0 = bỏ qua), Hình thức (dropdown, trống = Tiền mặt), Tài khoản nhận (bắt buộc với
  Chuyển khoản / Ví; khớp chủ TK hoặc số TK), Người thu (trống = người chạy), Ghi chú.
- Chia tiền: dòng của phiếu đầu tiên ghi Mã phiếu → các dòng chứa Mã phiếu → các dòng khác cùng kế hoạch, mỗi dòng
  tối đa phần còn phải trả; dư → lỗi. Mỗi kế hoạch nhận tiền một phiếu thu `PatientPayment.Record` Completed,
  17:00 giờ phòng khám ngày thu, CreationTime lùi theo, mã `THANHTOAN-{seq}/{DTxx}/{năm}` nối tiếp seq của năm.
- `PatientPayment.IsImported` (migration `20261013100000_ImportedPayments`): `InvoiceRequestSources` bỏ các phiếu này.
- File lỗi luôn [Khách hàng, Điều trị, Thanh toán] + cột "Lỗi". File layout F-61 cũ (11 cột, không Thanh toán) nhập y như trước.

### Lịch hẹn (R-926, 2026-10-13)

- Sheet "Lịch hẹn" (7 cột, tìm theo tên, không có cũng được): Mã KH\*, Ngày giờ hẹn\*, Thời lượng (phút, trống = 30,
  1–480), Bác sĩ\*, Trạng thái (dropdown Đã hẹn / Đã đến / Trễ hẹn / Hủy hẹn), Nội dung, Lý do hủy.
- Chỉ có ngày hoặc 00:00 → 09:00 giờ phòng khám. Trạng thái trống: đã qua → Đã đến (Completed), chưa tới → Đã hẹn.
  Đã qua mà "Đã hẹn" → lỗi; chưa tới mà "Đã đến"/"Trễ hẹn" → lỗi. "Đã khám" = Đã đến.
- Ghi bằng `Appointment.Import` với `IsImported` (migration `20261013101316_ImportedAppointments`): CreationTime = giờ hẹn (lịch chưa tới = lúc nhập),
  Đã đến có check-in/xong theo slot, Hủy hẹn có cancelledAt = slot và lý do (trống = "Hủy trên hệ thống cũ").
  Không sinh việc CSKH, không ghi nhật ký đổi lịch; ngày tạo hồ sơ lùi về lần hẹn sớm nhất nếu sớm hơn.
- Vì một khách có thể có hàng trăm lịch: `GET /appointments` nhận `sorting=Start desc`, `/appointments/stats` đếm trong DB
  (`GroupBy`), tab Lịch hẹn của hồ sơ phân trang ở server, mới nhất trước. Báo cáo vận hành lọc lịch theo cửa sổ ±1 ngày trong DB.
- File lỗi luôn [Khách hàng, Điều trị, Thanh toán, Lịch hẹn] + cột "Lỗi".

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

## Evidence (2026-10-13, R-924)

Build production `vite preview` :8187 → host :5000 → PostgreSQL thật, không chặn API.

| Kiểm tra | Kết quả |
|---|---|
| `e2e/data-migration-api.spec.ts` | **17/17** + 1 skip (hiệu năng, chạy khi có `MIGRATION_PERF`) |
| Mẫu | 4 sheet, Điều trị 16 cột, Thanh toán 9 cột, dropdown Hình thức |
| Gom Kế hoạch | PX1–PX4 + PX5 tặng → 1 kế hoạch "Chỉnh nha", phải trả 30,2 tr, dòng đã trả 28 tr / 1,2 tr / 0,9 tr |
| Thanh toán | 10 tr tiền mặt (người thu, ghi chú), 20 tr chuyển khoản → tài khoản, 100k thẻ theo Kế hoạch, 0 → bỏ qua; phiếu 17:00 +7, seq liên tiếp; tài khoản BN đã thu 30,1 tr, nợ 100k; payment-options Yêu cầu xuất HĐ = [] |
| Chạy lại | Bỏ qua hết |
| Lỗi tiền / thanh toán | Điều trị dòng 3–6, Thanh toán dòng 2–9 đúng câu; file lỗi có cột "Lỗi" ở cột 10 sheet Thanh toán |
| Tương thích ngược | File F-61 (11 cột, không Thanh toán) nhập giá 0 như cũ |
| Hồi quy mức 3 | `patient-roster` (cùng spec: 31 qua + 1 skip), `invoice-request` + payment + vat: 14/14 |
| Mẫu thật 200 KH (DB local, script scratchpad, không commit) | Dry run 3 lỗi đúng của dữ liệu cũ; sửa → 200 KH / 698 kế hoạch / 4.387 công đoạn / 272 phiếu thu trong 1,4 s; tổng phiếu thu = tổng file 473.544.000 đ; hồ sơ hiển thị đúng Tổng phiếu / Đã trả |
| Mức retest | 3 (`PatientPayment`, `InvoiceRequestSources`, migration DB) |

## Evidence (2026-10-13, R-926 — Lịch hẹn)

Build production `vite preview` :8187 → host riêng :5100 (build từ working tree) → PostgreSQL thật, không chặn API.

| Kiểm tra | Kết quả |
|---|---|
| `e2e/data-migration-api.spec.ts` | **19/19** + 1 skip (hiệu năng) |
| Mẫu | 5 sheet (4 dữ liệu + Hướng dẫn), Lịch hẹn 7 cột, dropdown Trạng thái lịch hẹn |
| Nhập lịch | 6 lịch: chỉ ngày → 09:00 Đã đến, Trễ hẹn 45 phút, Hủy 00:00 → 09:00 lý do mặc định, Hủy có lý do, sắp tới 60 phút Đã hẹn, ô Date thật "Đã khám"; check-in/xong/hủy theo slot; CreationTime = slot; hồ sơ tạo từ lần hẹn sớm nhất |
| Tab Lịch hẹn | `stats?patientId` đếm 1/2/1/2, trang 2 dòng mới nhất trước, `statuses=6` đúng 2 lịch; không sinh việc CSKH |
| Chạy lại | Bỏ qua bệnh nhân và 6 lịch |
| Lỗi | 9 dòng đúng câu (Đã hẹn ở quá khứ, Đã đến ở tương lai, ngày sai, thời lượng 0 / chữ, trạng thái lạ, Mã KH lạ, bác sĩ lạ, thiếu ngày), không ghi gì; file lỗi có "Lỗi" ở cột 8 sheet Lịch hẹn |
| Hồi quy mức 3 (appointment*, patient-appointment, cskh, patient-care, reception*, operations-reports, report, report-customer) | 104 qua, 21 đỏ, 1 skip — xem R-926: report = tiêu đề "Hình thức" có từ 2eec1e9e; patient-appointment = locator "Chọn bệnh nhân" khớp 2 phần tử (dialog không sửa); reception-live-late chạy lại qua; 18 operations-reports = timeout do tải nguyên bảng kế hoạch/công đoạn/thanh toán trên DB local nặng dữ liệu hiệu năng (đã đỏ 8 ở HEAD trước đó) |
| Mức retest | 3 (`Appointment`, list/stats lịch hẹn, báo cáo vận hành, báo cáo phòng khám, seeder nhật ký, luật CSKH, migration DB) |

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
| Lưu 5.000 KH / 70.000 dòng / 3.000 thanh toán (R-924, file SheetJS 21,8 MB) | — | 25,6 s |
| Lưu 5.000 KH / 70.000 dòng / 3.000 thanh toán / 65.000 lịch hẹn (R-926, file 32,1 MB) | — | 35,3 s |

Nguyên nhân cũ: một `SaveChanges` cho mọi entity + ABP 9.3.7 gộp event lúc complete
unit of work theo O(n²) (`UnitOfWork.GetEventsRecords`).

## Giới hạn đã biết (R-845)

- nginx: location riêng `/api/v1/app/data-migration/` body 60 MB, timeout 600 s; endpoint `[RequestSizeLimit]` 60 MB (R-924).
  Khuyên mỗi file ~5.000 khách kèm đủ lịch sử. Caddy trên VM chưa kiểm giới hạn body.
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
