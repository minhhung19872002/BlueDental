# Report Page — /report

Source: https://app.nfcdental.com/report?branchId=<id>
Observed: 2026-08-22, 2026-09-03 (dialogs, tab 2/3/4 structure)
Screenshots: reference-private/survey/report-main.png

## Route

`/report?branchId=<branchId>&report_dateMode=day&report_date=2026-08-22`

URL params:
- `report_dateMode`: `day` | `week` | `month` | `year`
- `report_date`: ISO date string (YYYY-MM-DD)
- `reportTab`: `expense` (Doanh số — default) | `cashflow` (Quản lý thu chi) | `result` (Kết quả kinh doanh) | `cashflow-v2` (Luân chuyển dòng tiền V2)
- `salesTab`: only ever `real-revenue` (sub-tab "Doanh số thực" of tab 1); the
  other five sub-pills write nothing (observed 2026-09-22).

Observed 2026-09-22: opening a bare `/report` immediately rewrites the URL to
`/report?reportTab=expense&branchId=…&report_dateMode=day&report_date=<today>`
— the period is always written, and every Ngày / Tuần / Tháng / Năm click
writes its value. Local mirrors this minus `branchId` (branch comes from the
session) and minus the default `reportTab`.

## Tabs (4 main tabs)

| # | Tab (VI) | English | `reportTab` value |
|---|---------|---------|-------------------|
| 1 | Doanh số và lượt khách | Revenue & Patient Visits | `expense` (default) |
| 2 | Quản lý thu chi | Income/Expense Management | `cashflow` |
| 3 | Kết quả kinh doanh | Business Results | `result` |
| 4 | Luân chuyển dòng tiền V2 | Cash Flow V2 | `cashflow-v2` |

## Shared Toolbar (all tabs)

| Control | Type | Notes |
|---------|------|-------|
| Ngày/Tuần/Tháng/Năm | Tab group | Date period filter |
| Date picker | Button + prev/next | Shows period label (e.g. "08/2026") |
| Bác sĩ điều trị | Combobox | Filter by treating doctor |

Note: "Luân chuyển dòng tiền V2" tab shows "Tổng" (disabled) instead of a date picker.

---

## Tab 1: Doanh số và lượt khách (`reportTab=expense`)

### Sub-filter buttons (view toggle)

| # | Button (VI) | English |
|---|------------|---------|
| 1 | Khách hàng phát sinh dịch vụ | Customers with services |
| 1b | Doanh số thực | Actual revenue (observed 2026-09-22 on the reference, view only: URL gains `salesTab=real-revenue`; one stat block "Doanh số thực <amount>" and a table with columns Ngày, Tên khách hàng, Kế hoạch điều trị, Nhân sự tư vấn, Bác sĩ tiếp nhận, Dịch vụ điều trị, Số lượng, Thành tiền; no overview charts below it — "Thực thu và công nợ" is absent, like Dư nợ / Tạm ứng) |
| 2 | Thanh toán | Payments |
| 3 | Hoàn tiền | Refunds |
| 4 | Dư nợ | Outstanding debt |
| 5 | Tạm ứng | Prepaid deposits (observed 2026-09-04 on staging: 4 tiles — Tạm ứng phát sinh, Tiêu dùng tạm ứng, Hoàn tiền tạm ứng, Số dư tạm ứng hiện tại — a green "Tạm ứng" pill, no Xuất Excel, no overview charts; table columns Ngày, Khách hàng, Loại sự kiện, Dịch vụ, Phiếu thanh toán, Bác sĩ điều trị, Số tiền, Số dư sau). Row formatting seen on the owner's staging screenshot 2026-09-22 (year view) — see §"Đợt đồng bộ staging 2026-09-22 (3)" |

### Quick Stats Bar
- "Doanh số": current revenue value (orange solid block, label left / value right)
- "Xuất Excel" button (outlined, download icon) — same row as the sub-filter pills

#### Excel export (sub-filter 1) — observed 2026-09-04 from a reference-produced file
One flat row per service line (no grouped/merged cells). 12 columns, header row
plain text, amounts written as raw numbers (no thousands separator, no "đ"):

| # | Header (VI) | Value |
|---|-------------|-------|
| 1 | Ngày | `dd/MM/yyyy` |
| 2 | Mã khách hàng | patient code |
| 3 | Tên khách hàng | name only (no `[code] -` prefix) |
| 4 | Nhân sự tư vấn | counselor |
| 5 | Bác sĩ tiếp nhận | doctor |
| 6 | Dịch vụ điều trị | service name; cancelled lines get " (Đã hủy)" appended (red text in the reference file) |
| 7 | Số lượng | number |
| 8 | Thành tiền | raw number, negative for cancelled lines |
| 9 | Đã thanh toán | raw number |
| 10 | Mã phiếu điều trị | treatment ticket code (`DT05`) |
| 11 | Trạng thái dịch vụ | `đã tạo` / `đang điều trị` / `hoàn thành` / `đã hủy` |
| 12 | Chi nhánh | branch name |

File name and sheet name: UNKNOWN_REFERENCE_BEHAVIOR (not captured).

### Xuất Excel — sub-tab "Thanh toán" (observed from a reference download, 2026-09-04)

The workbook is wider than the on-screen table. Sheet has one header row then
one row per payment voucher, 15 columns in this exact order. Amounts are plain
numeric cells (e.g. `500000`), not formatted text. Dates are `dd/MM/yyyy`.

| # | Column (VI) | Notes |
|---|------------|-------|
| 1 | Ngày tạo | `dd/MM/yyyy` |
| 2 | Mã thanh toán | `THANHTOAN-NN/DTNN/yyyy` |
| 3 | Người tạo | Display name of the user who created the voucher (e.g. "Admin") |
| 4 | Mã khách hàng | Patient code only (table shows `[code] - name` as one link) |
| 5 | Tên khách hàng | Patient name only |
| 6 | Mã phiếu điều trị | Treatment ticket code (`DTNN`) |
| 7 | Chi nhánh | Branch name |
| 8 | Dịch vụ điều trị | |
| 9 | Tổng tiền phiếu | number |
| 10 | Thanh toán | number |
| 11 | Tổng tạm ứng còn lại | number — note: precedes "Thực thu" here, opposite of the table |
| 12 | Thực thu | number — the table calls this column "Tổng thực thu" |
| 13 | Phương thức thanh toán | "Tiền mặt" / "Chuyển khoản" / ... |
| 14 | Thông tin thanh toán | Bank/account text for transfers, empty for cash |
| 15 | Ghi chú | Free text, usually empty |

Columns 3, 4, 6, 7, 14 and 15 are not shown in the table at all.
UNKNOWN_REFERENCE_BEHAVIOR: whether the file name / sheet name follow a fixed
pattern (only the cell contents were observed).

### Xuất Excel — sub-tab "Hoàn tiền" (observed from a reference download, 2026-09-04)

One header row, 7 columns in this exact order. The on-screen table heads the
code column "Mã thanh toán" and places it after the patient; the workbook heads
it "Mã hoàn tiền" and places it right after the date. Only an empty export was
observed (no refunds in the period), so cell formats are inferred from the
"Thanh toán" workbook.

| # | Column (VI) | Notes |
|---|------------|-------|
| 1 | Ngày tạo | `dd/MM/yyyy` (inferred) |
| 2 | Mã hoàn tiền | The table's "Mã thanh toán" value (`HOANTIEN-NN/yyyy`) |
| 3 | Mã khách hàng | Patient code only |
| 4 | Tên khách hàng | Patient name only |
| 5 | Dịch vụ điều trị | |
| 6 | Tổng hoàn | number (inferred) |
| 7 | Ghi chú | |

### Table Columns (8 columns)

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | Ngày | Date | |
| 2 | Tên khách hàng | Patient name | Links to patient detail |
| 3 | Nhân sự tư vấn | Counselor staff | |
| 4 | Bác sĩ tiếp nhận | Receiving doctor | |
| 5 | Dịch vụ điều trị | Treatment service | Can show "(đã hủy)" badge inline |
| 6 | Số lượng | Quantity | |
| 7 | Thành tiền | Total amount | VND, negative for cancelled |
| 8 | Đã thanh toán | Paid amount | VND |

Pagination text: "Hiển thị 1–N trên N dòng"
Per-page options: 5, 10, 20 (default), 25, 50, 100

### Summary Cards (always visible at bottom, 4 cards)

Each card shows Hôm nay / Tuần này / Tháng này / Năm nay / Toàn bộ

| Card | Vietnamese | Format |
|------|-----------|--------|
| Thông tin lượt khách | Patient visit stats | N lượt khách |
| Thông tin lịch hẹn | Appointment stats | N lịch hẹn |
| Thông tin thanh toán | Payment stats | N đ |
| Thông tin thu chi | Income/Expense | income đ / expense đ |

---

## Tab 2: Quản lý thu chi (`reportTab=cashflow`)

### Sub-filter buttons (view toggle)

| # | Button (VI) | English |
|---|------------|---------|
| 1 | Thu nhập | Income |
| 2 | Chi phí | Expense |
| 3 | Danh mục | Categories |

### Toolbar (right side)
- Xuất Excel button
- Thêm mới button

### Quick Stat
- "Tổng doanh thu" (Total revenue): single value above table

### Table Columns (8 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày tạo | Created date |
| 2 | Khách hàng | Customer |
| 3 | Nội dung thu | Income description |
| 4 | Nhân viên thu | Staff who collected |
| 5 | Mục thu | Income category |
| 6 | Doanh thu | Revenue |
| 7 | Hình thức | Payment method |
| 8 | Thao tác | Actions |

Pagination text: "Hiển thị N trên N phiếu"

### Summary Card
- "Thông tin thu chi" — same format as tab 1 bottom card (Hôm nay/Tuần này/Tháng này/Năm nay/Toàn bộ)
- Values: "income đ / expense đ"

---

## Tab 3: Kết quả kinh doanh (`reportTab=result`)

**Layout**: Summary list (no table — pure stat list)

### Items (6 rows, vertical list)

| # | Label (VI) | English |
|---|-----------|---------|
| 1 | Doanh thu tổng | Total revenue |
| 2 | Thu từ dịch vụ điều trị | Revenue from treatment services |
| 3 | Thu khác | Other revenue |
| 4 | Hoàn tiền từ dịch vụ điều trị | Refunds from treatment services |
| 5 | Chi phí | Expenses |
| 6 | Kết quả kinh doanh | Business result (= total - expenses) |

Note: No date filter, no table, no pagination — pure summary view.

---

## Tab 4: Luân chuyển dòng tiền V2 (`reportTab=cashflow-v2`)

### Sub-filter buttons (view toggle, left)

| # | Button (VI) | English |
|---|------------|---------|
| 1 | Tổng quan | Overview |
| 2 | Danh mục | Categories |

### Toolbar (right side)
- Xuất Excel button
- Luân chuyển button
- Nạp button
- Rút button

### Summary Stats (4 panels)

| Label (VI) | English |
|-----------|---------|
| Tổng Tiền | Total money |
| Tổng Tiền Mặt | Total cash |
| Tổng Chuyển Khoản | Total bank transfer |
| Đang Giữ Hộ Khách | Held on behalf of customer |

Also shows: "Doanh thu dịch vụ" (Service revenue) label + value

### Table Columns (8 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày | Date |
| 2 | Loại giao dịch | Transaction type |
| 3 | Hình thức | Payment method |
| 4 | Danh mục | Category |
| 5 | Số tiền | Amount |
| 6 | Người tạo | Creator |
| 7 | Ghi chú | Notes |
| 8 | Thao tác | Actions |

Pagination text: "Hiển thị N trên N giao dịch"

---

## UNKNOWN_REFERENCE_BEHAVIOR

Đã quan sát thêm 2026-09-03 (chỉ mở dialog rồi đóng, không nhập/không lưu):
mục 1, 3, 4, 5, 6 của bảng cũ đã có cấu trúc — xem `docs/clone/unknowns.md`
(khối "Page: /report") cho phần còn mờ.

| # | Control | Reason |
|---|---------|--------|
| 1 | Week/Month/Year view table structure | Not switched |
| 2 | Patient name links from report rows | Not clicked |
| 3 | Row actions (Chỉnh sửa / Xóa / Duyệt / Từ chối) — dialog và validate | Mutation, không bấm |
| 4 | Nút Lưu ở mọi dialog — validate lỗi phía server | Mutation, không bấm |
| 5 | ~~Tab Chi phí: dialog "Thêm mới"~~ | ĐÃ GIẢI ĐÁP 2026-09-21 — xem §Dialogs bên dưới |
| 6 | ~~Tab 4 → Danh mục → "Thêm mục"~~ | ĐÃ GIẢI ĐÁP 2026-09-21 — xem §Dialogs bên dưới |
| 7 | Validate lỗi phía server, hộp xác nhận Xóa / Duyệt / Từ chối, toast sau khi Lưu | Mutation, không bấm |
| 8 | Xuất Excel tab 2 (Thu nhập / Chi phí) và tab 4 với dữ liệu thật | Bản gốc không có dòng nào trong kỳ quan sát → chỉ thấy toast "Không có dữ liệu để xuất"; cấu trúc file lấy từ bundle JS |

## Dialogs (quan sát bản gốc 2026-09-21 — chỉ mở rồi đóng bằng Escape, không nhập, không Lưu)

Bảy dialog của tab 2 và tab 4. Chiều rộng đọc từ DOM (`w`). Dấu `*` là
nhãn bắt buộc của bản gốc. Mọi dialog chỉ có **một** nút `Lưu` ở chân, không
có `Huỷ` (đóng bằng ✕ hoặc Escape).

### Tab 2 — Quản lý thu chi

| Dialog | Mở từ | Rộng | Trường theo thứ tự |
|---|---|---|---|
| Thêm khoản thu | Thu nhập → Thêm mới | 772 | Ngày tạo (khóa, hôm nay) · Ngày thực thu* · Chọn nhân viên · Chọn khách hàng · Số tiền* (hàng riêng) · Hình thức [Tiền mặt] · Người nộp · Mục thu* · Nội dung thu (textarea) |
| Thêm chi phí | Chi phí → Thêm mới | 772 | Ngày tạo (khóa, hôm nay) · Ngày thực chi* · Chọn nhân viên · Người nhận · Số tiền* · Hình thức [Tiền mặt] · Mục chi* (ba cột một hàng) · Nội dung chi (textarea rows=4) |
| Thêm danh mục thu nhập | Danh mục → Danh mục thu nhập → Thêm mục | 500 | Tên phân loại* · Mức độ ưu tiên [0] |

Hình thức của cả hai phiếu (mở dropdown 2026-09-22): ô "Tìm kiếm" ở đầu, rồi
**Tiền mặt / Chuyển khoản / Quẹt thẻ / Dư nợ** — không có Ví điện tử. Không
có request nào bắn ra khi mở → danh sách tĩnh, không lấy từ danh mục
"Phương thức thanh toán".

Danh mục chi phí dùng cùng khuôn dialog với tiêu đề "Thêm danh mục chi phí"
(suy ra từ bundle, chưa mở riêng).

### Tab 4 — Luân chuyển dòng tiền V2

| Dialog | Mở từ | Rộng | Trường theo thứ tự |
|---|---|---|---|
| Tạo giao dịch nạp | Nạp | 772 | Hình thức* [Tiền mặt] · Số tiền (VNĐ)* · Ngày thực hiện* (khóa) · Danh mục · Ghi chú (textarea rows=3) · dòng "Số dư khả dụng (Cà thẻ chờ đối soát): 0 đ" **chỉ khi** Hình thức = Cà thẻ (đối soát); Tiền mặt / Chuyển khoản không có dòng này |
| Tạo giao dịch rút | Rút | 772 | Hình thức* [Tiền mặt] · Số tiền (VNĐ)* · Ngày thực hiện* (khóa) · Danh mục · Ghi chú · dòng "Số dư khả dụng (Tiền mặt): 0 đ" — nhãn trong ngoặc đổi theo Hình thức ("(Chuyển khoản)") |
| Tạo giao dịch luân chuyển | Luân chuyển | 772 | Hình thức* [Tiền mặt] · Luân chuyển đến* [Chuyển khoản] · Số tiền (VNĐ)* · Ngày thực hiện* (khóa) · Ghi chú · "Số dư khả dụng (<Hình thức>)" — **không có** Danh mục |
| Thêm danh mục sổ quỹ mới | Danh mục → Thêm mục | 500 | Tên danh mục sổ quỹ · Ghi chú (không bắt buộc) · Màu: 8 ô `#2671D8 #EF4444 #10B981 #F59E0B #6366F1 #EC4899 #14B8A6 #64748B` + ô màu tuỳ chỉnh · "Xem trước" hiện chip "Danh mục sổ quỹ" · `Lưu` **disabled** tới khi có tên |

Danh sách "Hình thức" của tab 4 (mở dropdown 2026-09-22, không có ô tìm
kiếm) khác nhau theo dialog:

| Dialog | Hình thức | Luân chuyển đến |
|---|---|---|
| Nạp | Tiền mặt / Chuyển khoản / **Cà thẻ (đối soát)** | — |
| Rút | Tiền mặt / Chuyển khoản | — |
| Luân chuyển | Tiền mặt / Chuyển khoản | Tiền mặt / Chuyển khoản (liệt kê cả hai, không lọc bỏ nguồn) |

"Luân chuyển đến" mặc định là giá trị còn lại. Hai ô này không bao giờ báo
lỗi (quan sát 2026-09-22, chỉ đổi lựa chọn, không Lưu): đổi Hình thức sang
đúng kho đang là nơi nhận → nơi nhận tự lật sang kho kia; chọn nơi nhận trùng
Hình thức → **Hình thức** tự lật (nơi nhận giữ nguyên), dòng "Số dư khả dụng"
đổi theo Hình thức mới. Local làm y vậy, chỉ giữ validator trùng kho làm chốt
chặn (không bao giờ tới được bằng UI). Escape đóng cả dropdown lẫn dialog. Local: `CashHolding.Card = 4`, số nạp vào đó cộng vào dòng "Cà thẻ
(đối soát)" chứ không vào "Tổng Tiền" (ASSUMPTION — bản gốc ghi 0 suốt kỳ
quan sát). Bundle: Nạp tone `success`, Rút tone
`danger`, Luân chuyển icon `RefreshCw`; dưới 769px bốn nút xếp lưới 2 cột
rộng hết hàng.

## Xuất Excel tab 2 và tab 4 (đọc từ bundle JS, 2026-09-21)

Cả ba file được sinh **phía trình duyệt** (SheetJS) qua một component chung:
dòng 1 = tiêu đề gộp ô hết chiều rộng, dòng 2 trống, dòng 3 = header, dữ liệu
từ dòng 4; độ rộng cột ghi vào `!cols`. Không có dòng → toast "Không có dữ
liệu để xuất"; xong → toast "Xuất Excel thành công". Trong kỳ quan sát bản
gốc không có dòng nào nên **chỉ thấy toast rỗng**; nội dung ô bên dưới là
mapper trong bundle, chưa đối chiếu với file thật.

| Sub-tab | File | Sheet | Tiêu đề dòng 1 | Nguồn dòng |
|---|---|---|---|---|
| Thu nhập | `thu-nhap.xlsx` | Thu nhập | Báo cáo thu nhập | `GET /sales?type=income&orderBy=date:desc&page=1&perPage=100` (tối đa 100 dòng, không theo trang đang xem) |
| Chi phí | `chi-phi.xlsx` | Chi phí | Báo cáo chi phí | như trên với `type=expense` |
| Tổng quan (tab 4) | `luan-chuyen-dong-tien.xlsx` | Luân chuyển dòng tiền | Báo cáo luân chuyển dòng tiền | **trang đang xem** của bảng |

Cột và độ rộng:

| File | Cột (độ rộng) |
|---|---|
| thu-nhap | Ngày tạo (16) · Khách hàng (22) · Nội dung thu (28) · Nhân viên thu (18) · Mục thu (18) · Doanh thu (18, ô số) · Hình thức (16) |
| chi-phi | Ngày tạo (16) · Ngày thực chi (16) · Nội dung (28) · Khách hàng (18) · Nhân viên (18) · Mục chi (18) · Tổng tiền (18, ô số) · Hình thức (16) · Trạng thái (14) |
| luan-chuyen-dong-tien | Ngày (16) · Loại giao dịch (18) · Hình thức (20) · Danh mục (18) · Số tiền (18, ô số, Rút ghi âm) · Người tạo (18) · Ghi chú (28) |

Mapper từng ô (bundle):

- Ngày: `DD/MM/YYYY`.
- Khách hàng: `patient.name` → nếu không có, `Người nộp` (thu) / `Người nhận` (chi) → nếu vẫn không, `—`.
- Nội dung: `note.trim()` hoặc `—`. Nhân viên: `name` → `email` → `Không xác định`. Mục: `taxonomy.name` hoặc `—`.
- Hình thức tab 2: `cash` Tiền mặt · `banking` Chuyển khoản · `card` Quẹt thẻ · `outstanding-debt` Dư nợ · khác `—`.
- Chi phí: Ngày thực chi trống nếu không có; Trạng thái `pending` Dự chi · `approved` Đã duyệt.
- Tab 4: Loại giao dịch `income` Thu · `expense` Chi · `deposit` Nạp · `withdraw` Rút · `rotation` Luân chuyển; Danh mục / Ghi chú trống nếu không có; Người tạo `Không xác định` nếu không có.

## Local implementation — 2026-09-21 (API thật, thay cho bản mock 2026-09-04)

Toàn bộ `/report` nay đọc/ghi qua BE thật; `reportMockData.ts` và
`reportMockQueries.ts` đã xoá, `notifyDemoAction` không còn. Chrome của hệ
thống (pill tabs, `reception-card`, `DataTable`, `AppDialog`, `SearchSelect`,
`CurrencyInput`, `DateNavigator`, pager dùng chung) thay cho Tailwind của bản
gốc; responsive 1280 / 1100 / 640.

| Tab | Đọc | Ghi |
|---|---|---|
| 1 Doanh số | `clinic-reports/{service-lines, payment-lines, refund-lines, debt-lines, prepaid-lines, sales-summary, overview-stats, payment-stat}` | — |
| 1 Xuất Excel | `clinic-reports/{patient-history, business-result}/excel` (server sinh file: Thanh toán 15 cột, Hoàn tiền 7 cột — đúng thứ tự file gốc) | — |
| 2 Thu nhập / Chi phí | `sales?clinicBranchId&type&fromDate&toDate`, `sales/stats` | `POST sales`, `PUT sales/{id}`, `POST sales/{id}/approve`, `POST sales/{id}/reject`, `DELETE sales/{id}` |
| 2 Danh mục | `cashflow-categories?clinicBranchId&type` | `POST/PUT/DELETE cashflow-categories[/{id}]` |
| 3 Kết quả kinh doanh | `clinic-reports/business-result` | — |
| 4 Tổng quan | `cash-management/{balance, cashflow-overview, cashflow-entries}` | `POST/PUT/DELETE cash-management/cashflow-entries[/{id}]` |
| 4 Danh mục | `cashflow-categories?type=cashbook` | như tab 2 |

Xuất Excel tab 2 / 4 dựng phía trình duyệt bằng `src/utils/exportExcel.ts`
(tiêu đề gộp dòng 1, dòng 2 trống, header dòng 3, `!cols`) với đúng tên file /
sheet / tiêu đề / cột / độ rộng / mapper như bảng trên; tab 4 xuất trang đang
xem; toast rỗng và toast thành công cùng chữ.

### Đợt đồng bộ 2026-09-22 — đã khớp bản gốc

Chủ dự án yêu cầu bỏ hết khác biệt ("làm cho giống ref app, không cần hỏi").
Những mục dưới đây trước ghi là "khác biệt đã biết", nay đã dựng và có test:

- Mã phiếu thanh toán `THANHTOAN-NN/DTNN/yyyy`, hoàn tiền `HOANTIEN-NN/yyyy`
  (`PatientPayment.FormatCode`, bộ đếm theo chi nhánh / năm / loại). Phần
  "DT" là **mã phiếu điều trị** (FACT 2026-09-22 (3): `THANHTOAN-31/DT32/2026`
  với DT32 = phiếu "Test DV" của HN8521) — local tra `TreatmentPlan.Code`
  khi sinh mã; dữ liệu đã phát hành trước đó (`…/DT27/…` trùng số phiếu thu)
  giữ nguyên. Nạp tạm ứng ngoài phiếu điều trị bản gốc chưa thấy mã →
  `TAMUNG-NN/yyyy` vẫn là GIẢ ĐỊNH theo mẫu hoàn tiền.
- Danh mục sổ quỹ lưu `ColorCode` (`#rrggbb`, cột mới, migration
  `20260922000000_AddCategoryColorAndPayerName`).
- Phiếu thu / chi lưu `PayerName` (Người nộp / Người nhận, ≤ 200 ký tự).
- Tab 4: kho `Cà thẻ (đối soát)` (`CashHolding.Card = 4`) chỉ xuất hiện ở
  dialog Nạp; "Cà thẻ chờ đối soát" = thanh toán bệnh nhân kênh thẻ (trừ hoàn)
  + nạp vào kho thẻ; "Doanh thu dịch vụ" = thanh toán bệnh nhân trừ hoàn (mọi
  kênh). Công thức là GIẢ ĐỊNH — bản gốc hiện 0 ở cả hai dòng.
- Kỳ mặc định là ngày; URL luôn ghi `report_dateMode` + `report_date` như
  bản gốc (`/report` → `?report_dateMode=day&report_date=<hôm nay>`); tab 4
  dùng nút "Tổng" disabled thay bộ chọn kỳ.
- Pager 5 / 10 / 20 / 25 / 50 / 100.
- Tab 1 có sub-tab "Doanh số thực" (`salesTab=real-revenue`, 8 cột, không có
  khối biểu đồ bên dưới — giống Dư nợ / Tạm ứng); các sub-tab khác không ghi
  URL, giữ trong state.
- Dialog: Hình thức phiếu thu / chi là danh sách tìm kiếm 4 mục (Tiền mặt /
  Chuyển khoản / Quẹt thẻ / Dư nợ); Rút và "Luân chuyển đến" liệt kê Tiền mặt /
  Chuyển khoản, nơi nhận mặc định là kho còn lại, chọn trùng thì bên kia tự
  lật (không có lỗi — bản gốc quan sát 2026-09-22, xem §Dialogs).
- Dòng "Số dư khả dụng": Nạp chỉ hiện với Cà thẻ (đối soát) và ghi "(Cà thẻ
  chờ đối soát)"; Rút / Luân chuyển hiện theo Hình thức đang chọn.

### Đợt đồng bộ staging 2026-09-22 — thao tác thật trên staging.nfcdental.com

Chủ dự án cho phép thao tác trên staging (chi nhánh A, tài khoản "BS NFC"),
nên các luồng ghi của tab 2 được bấm thật (tạo / sửa / duyệt / xoá phiếu,
tạo / sửa / xoá danh mục, in phiếu) và bản local dựng lại theo đúng những gì
thấy. Bản ghi thử nghiệm để lại trên staging đều ghi chú
"BlueDental clone test … - se xoa".

**Tab 2 — hành động trên dòng** (4 nút tròn 32px, icon, tooltip):

| Dòng | Nút | Ghi chú |
|---|---|---|
| Chi phí đang "Dự chi" | Duyệt chi (xanh lá) · Chỉnh sửa · Xoá (đỏ) · In | Không có "Từ chối" |
| Chi phí "Đã duyệt" | In | Không sửa, không xoá |
| Thu nhập | Chỉnh sửa · In | Không xoá |

- Duyệt chi → hộp "Xác nhận duyệt": "Bạn có chắc muốn duyệt phiếu chi
  **{nội dung}** không?" / "Hành động này không thể hoàn tác." / Huỷ / Duyệt.
  API `PUT /sales/{id}/approve` **không body** → 200. Toast sau duyệt không
  bắt được (UNKNOWN); local không toast.
- Xoá → hộp "Xác nhận xoá": "Bạn có chắc muốn xoá phiếu chi **{nội dung}**
  không?" / cùng dòng phụ / Huỷ / Xoá. `DELETE /sales/{id}` xoá mềm; toast
  "Đã xoá phiếu thu chi".
- Chỉnh sửa → dialog "Chỉnh sửa khoản thu" / "Chỉnh sửa chi phí"; toast
  "Cập nhật phiếu thu chi thành công". Tạo mới: "Tạo phiếu thu chi thành công".
- In → modal "Chi tiết phiếu" (1024px, không gọi API): khối THÔNG TIN PHÒNG
  KHÁM (Phòng khám / Địa chỉ / ĐT / Email) và KHÁCH HÀNG (Mã, Tên, SĐT, Địa
  chỉ, Ngày sinh — "Không có" khi trống), bảng CHI TIẾT một dòng (Ngày tạo,
  [Ngày thực chi], Khách hàng, Nội dung, Nhân viên, Mục, Hình thức, Tổng tiền),
  dòng "Tổng cộng", nút "In chi phí" (nhãn cho phiếu thu chưa thấy — local
  dùng "In thu nhập"). Tờ in ẩn ngoài màn hình: "PHIẾU CHI" / "PHIẾU THU",
  "Ngày D tháng M năm YYYY", "Số: <mã>", chữ ký "Người lập phiếu / (Ký, họ
  tên) / <nhân viên>". Cơ chế in (window.print hay khác) chưa quan sát —
  local gọi `window.print()`.
- Validate dialog: "Vui lòng nhập số tiền", "Mục thu là trường bắt buộc." /
  "Mục chi là trường bắt buộc."; chưa chọn chi nhánh → "Vui lòng chọn chi nhánh".
- Thẻ số: "Tổng chi phí" = tổng **đã duyệt**; "Đang dự chi" = tổng dự chi.
- Cột Khách hàng: tên bệnh nhân (link) hoặc Người nộp / Người nhận
  (`payerName`), trống → "Không có"; file Excel ghi `payerName` hoặc "—".
- URL: `cashflowTab=income|expense|category` (xoá khi rời tab 2).

**Danh mục thu / chi**: toast "Tạo nhóm thành công" / "Cập nhật nhóm thành
công" / "Đã xoá nhóm"; hộp xoá "Bạn có chắc muốn xoá danh mục **{tên}**
không?" / Huỷ / Xoá. Validate "Tên phân loại là trường bắt buộc.". Xoá được
cả danh mục đang có phiếu: phiếu và dòng con tab 3 vẫn hiện tên (local: đọc
tên qua bộ lọc xoá mềm — `SalesEntryAppService`, `ClinicReportAppService`).
Danh mục sổ quỹ (tab 4) giữ toast "… danh mục …".

**Tab 1 — Tạm ứng** (staging có dữ liệu): 4 thẻ Tạm ứng phát sinh / Tiêu
tạm ứng (âm) / Hoàn tiền (âm) / Số dư; pill = phát sinh − tiêu − hoàn. Loại
sự kiện: "Tạm ứng phát sinh", "Tiêu tạm ứng theo tiến độ", "Hoàn tiền" (bản
gốc còn "Chuyển tạm ứng sang dịch vụ mới", "Xóa tạm ứng dịch vụ cũ (thay
thế)", "Hủy dịch vụ - xóa tạm ứng" — local chưa có sự kiện tương ứng). Cột
Phiếu thanh toán ghi mã THANHTOAN hoặc "-"; gộp ô Ngày → Khách hàng → Số dư
sau. Sub-tab Thanh toán có thêm thẻ "Tạm ứng" (6 thẻ).

**Tab 3**: thứ tự dòng Doanh thu tổng (xanh đậm) → Thu từ dịch vụ điều trị →
Thu khác → dòng con theo danh mục → Hoàn tiền (đỏ đậm) → Chi phí (đỏ đậm) →
dòng con → Kết quả kinh doanh (đậm, nền xám); Chi phí chỉ đếm đã duyệt.

### Đợt đồng bộ staging 2026-09-22 (2) — đối chiếu lại toàn bộ 4 tab

Nguồn: bundle JS của staging (`reference-private/report/bundle/`), DOM của
staging (cho phép thao tác) và app.nfcdental.com (chỉ xem). Mỗi mục ghi FACT
(thấy trong bundle/DOM) hay ASSUMPTION.

**Tab 2 — Quản lý thu chi**

- FACT `ev(type)`: nhãn theo loại phiếu — thu nhập: "Ngày thực thu", "Nội dung
  thu", "Mục thu", "Người nộp", "In khoản thu", tiêu đề in "PHIẾU THU"; chi phí:
  "Ngày thực chi", "Nội dung chi", "Mục chi", "Người nhận", "In chi phí",
  "PHIẾU CHI". Local: `voucherLabels(type)` dùng cho cột bảng, dialog, modal
  chi tiết, tờ in và `aria-label` nút in trên dòng (trước đây nút thu nhập ghi
  "In thu nhập" — sai).
- FACT modal "Chi tiết phiếu": bảng 8 cột Ngày tạo 130 / Ngày thực thu|chi
  140 / Khách hàng 150 / Nội dung 220 / Nhân viên 140 / Mục 140 / Hình thức
  130 / Số tiền 140 (phải, đậm); "Tổng cộng:" dưới bảng. Local dựng đúng.
- FACT tờ in A4 ẩn: 7 cột (không có Khách hàng — khách nằm ở khối đầu trang),
  Số tiền canh phải đậm, "Số: <mã phiếu>", chữ ký "Người lập phiếu (Ký, họ
  tên)". ASSUMPTION: `@page { size: A4; margin: 10mm }` — bundle không lộ CSS
  in, chọn theo khổ tờ.
- FACT cột Thao tác: 4 nút tròn; staging đặt cột 70px sticky rồi để tràn.
  Local đặt 180 (chi phí) / 100 (thu nhập) để 4 nút không gãy dòng — khác số
  nhưng cùng hình.
- FACT phân quyền: bundle gate từng nút bằng `usePermission("income.create")`,
  `cost.approve`, `cost.delete`, `transfer.deposit`… Local: hook
  `useReportPermissions.ts` ánh xạ sang permission ABP (`BlueDental.Finance.*`)
  và ẩn nút/sub-tab tương ứng; admin có đủ quyền nên spec không thấy khác.
- FACT tiêu đề dialog sửa danh mục: "Chỉnh sửa danh mục thu nhập" / "… chi
  phí" / "… sổ quỹ" (local từng ghi "Sửa danh mục …"). Cột Thao tác bảng danh
  mục 70 (sổ quỹ, có màu) / 120; mã màu in HOA (`text-transform: uppercase`).
- UNKNOWN giữ nguyên: toast sau Duyệt; cơ chế in (window.print hay PDF);
  tiêu đề hộp xoá danh mục thu/chi (local dùng chung "Xác nhận xoá danh mục"
  của sổ quỹ).

**Tab 4 — Luân chuyển dòng tiền V2**

- FACT 4 ô số dư: tone xanh dương (Tổng Tiền) / xanh lá (Tiền Mặt) / vàng
  (Chuyển Khoản) / tím (Giữ Hộ Khách); hai dòng dưới: "Doanh thu dịch vụ" xanh
  lá, "Cà thẻ chờ đối soát" tím. Local thêm tone `violet` cho
  `ReportStatCards` / `ReportStatsBar`.
- FACT nút dòng: Xem chi tiết (mắt) / Chỉnh sửa (bút, gate `transfer.update`)
  / Hủy (thùng rác đỏ, gate `transfer.delete`). Local trước chỉ có bút + thùng.
- FACT modal "Chi tiết phiếu" (tab 4): tiêu đề in PHIẾU THU (nạp) / PHIẾU CHI
  (rút) / PHIẾU LUÂN CHUYỂN DÒNG TIỀN (luân chuyển); cột trái Ngày thực hiện /
  Ngày tạo / Người tạo / Phương thức; cột phải Tài khoản / Số tiền (đậm) /
  Bằng chữ / Ghi chú; bảng STT / Nội dung / Tài khoản / Số tiền; "Tổng tiền:";
  chữ ký "Người lập phiếu"; nút "In Hoá Đơn". Local: `CashflowEntryVoucher`
  + `CashflowEntryDetailModal`, `moneyInWords` cho Bằng chữ, `creationTime`
  thêm vào DTO cho "Ngày tạo". ASSUMPTION: "Nội dung" trong bảng = ghi chú
  (bundle chỉ có một trường note).
- FACT ô danh mục trên dòng: pill nền theo `categoryColor`, fallback xám.
  Local: BE trả `categoryColor`, FE `--pill-color`.
- FACT bundle có nhãn "Nạp vào dư nợ" / "Rút dư nợ" (`debt-topup` /
  `debt-withdraw`) — local không có kênh tương ứng, chưa dựng (ghi UNKNOWN).
- UNKNOWN giữ nguyên: chữ trong hộp xác nhận Hủy (không bấm trên staging vì
  dòng tab 4 là tiền thật); công thức 6 ô (bundle chỉ hiện field).

**Tab 1 — Doanh số và lượt khách**

- FACT Dư nợ: cột 130/190/170/180/190/120; cạnh tên dịch vụ có chip "(đã
  hủy)" đỏ hoặc "(thay thế)" xanh theo trạng thái dịch vụ; ô đếm "dòng"; 3 thẻ
  tone blue/green/red. Local: BE `DebtLineDto.Status`, FE `STATUS_CHIP`.
- FACT Thanh toán: dịch vụ đã huỷ ghi đỏ "(đã huỷ)" ngay sau tên; đếm
  "phiếu". Local: BE `PaymentLineDto.CancelledServiceNames`, FE `ServiceList`.
  Chữ đỏ trong file Excel vẫn không tái tạo được (`xlsx` community không ghi
  rich text) — file Excel staging của tab 1 vẫn chưa tải.
- FACT Chi phí (tab 2) cột 130/190/170/180/190/120/140/160 — local chỉnh.

**DTO thêm (BE)**: `SalesEntryDto.PatientCode`, `CashflowEntryDto.CategoryColor`
+ `CreationTime`, `DebtLineDto.Status`, `PaymentLineDto.CancelledServiceNames`.
Không có migration.

### Chủ dự án chốt các UNKNOWN (2026-09-22, sau đợt (2))

| UNKNOWN | Quyết định | Local |
|---|---|---|
| Toast sau Duyệt | "tự bạn nghĩ đi" → DECISION: "Duyệt chi phí thành công" (cùng khuôn "Tạo / Cập nhật phiếu thu chi thành công" của bản gốc) | `CashflowRowActions` toast sau `PUT sales/{id}/approve` |
| Cơ chế in | FACT (chủ dự án): `window.print` | Đã đúng từ trước; bố cục tờ in vẫn lấy từ bundle, `@page` A4 10mm còn là giả định — chủ dự án sẵn sàng chụp màn hình in nếu cần so |
| Tiêu đề hộp xoá danh mục thu/chi | FACT (ảnh staging 2026-09-22, Danh mục thu nhập): tiêu đề **"Xác nhận xoá"**, "Bạn có chắc muốn xoá danh mục **abc** không?", "Hành động này không thể hoàn tác.", Huỷ / Xoá (đỏ, icon thùng) | `CashflowCategoryManager` truyền `title="Xác nhận xoá"` cho thu/chi; sổ quỹ giữ "Xác nhận xoá danh mục" (bundle) |
| Hộp Hủy tab 4 | "tùy b nghĩ đi" → DECISION: tiêu đề "Xác nhận hủy giao dịch", "Bạn có chắc muốn hủy giao dịch **{ghi chú}** không?" (không ghi chú → "… giao dịch này …"), dòng phụ, Huỷ / **Hủy giao dịch** (đỏ), toast "Đã hủy giao dịch" | `CashflowV2Overview` + prop `confirmLabel` mới của `ConfirmDeleteDialog` |
| Công thức 6 ô tab 4 | "b nghĩ như nào" → DECISION giữ công thức local: Tổng Tiền Mặt / Tổng Chuyển Khoản / Đang Giữ Hộ Khách = tổng tác động của mọi giao dịch (thanh toán bệnh nhân theo kênh, nạp +, rút −, luân chuyển ±) lên kho đó, mọi kỳ; Tổng Tiền = Tiền mặt + Chuyển khoản (không tính tiền giữ hộ và thẻ chưa đối soát); Doanh thu dịch vụ = thanh toán bệnh nhân trừ hoàn tiền, không tính tạm ứng; Cà thẻ chờ đối soát = thanh toán thẻ trừ hoàn tiền + số dư kho "Cà thẻ (đối soát)" (nạp về ngân hàng thì giảm) | `CashManagementAppService.BuildBalance` — không đổi |
| "Nạp vào dư nợ" / "Rút dư nợ" | "chưa rõ" → vẫn UNKNOWN | Không dựng |

Ảnh staging cũng khớp với local ở: tiêu đề "Danh mục thu nhập" + mô tả "Dùng
làm hình thức / mục khi tạo phiếu thu chi.", ô tìm "Tìm kiếm danh mục", nút
"+ Thêm mục", cột "Tên hình thức" / "Thao tác" (bút + thùng), pager "20 /
trang · Hiển thị 1 trên 1 mục · Trước 1 Sau".

### Đợt đồng bộ staging 2026-09-22 (3) — sub-tab Tạm ứng (ảnh chủ dự án)

Ảnh chụp staging, chế độ **Năm** 2026, chi nhánh A (`salesTab=prepaid`).
Không thao tác thêm trên staging; ảnh gốc nằm trong `reference-private/`.

**Thẻ (4) + pill** — FACT:

| Ô | Màu | Giá trị trong ảnh |
|---|---|---|
| Tạm ứng phát sinh | xanh dương | 17.800.000 đ |
| Tiêu dùng tạm ứng | vàng | −10.730.000 đ (âm) |
| Hoàn tiền tạm ứng | đỏ | −1.500.000 đ (âm) |
| Số dư tạm ứng hiện tại | tím | 10.070.000 đ |
| pill "Tạm ứng" | xanh lá | 5.570.000 đ = 17.800.000 − 10.730.000 − 1.500.000 |

Pill = phát sinh − tiêu dùng − hoàn của kỳ; ô "hiện tại" ≠ pill → là số
đang giữ ở thời điểm xem, không theo kỳ (ASSUMPTION về công thức, chỉ suy từ
hai con số khác nhau).

**Bảng** — FACT:

- Gộp ô: Ngày → Khách hàng (trong ngày) → Số dư sau (theo khách trong ngày,
  ví dụ hai dòng "Tiêu tạm ứng theo tiến độ" của cùng khách chung một ô
  −300.000 đ). Thứ tự ngày giảm dần.
- Khách hàng: `[HN8521] - TÊN` chữ xanh đậm (link).
- Loại sự kiện thấy trong ảnh: "Tạm ứng phát sinh", "Tiêu tạm ứng theo tiến
  độ", "Chuyển tạm ứng sang dịch vụ mới", "Xóa tạm ứng dịch vụ cũ (thay
  thế)". "Tạm ứng phát sinh" có thể **âm** (−4.500.000 đ, số dư sau 0 đ) và
  "Tiêu tạm ứng theo tiến độ" có thể **dương** (+700.000 đ) — bản gốc ghi
  cả chiều đảo của sự kiện.
- Dịch vụ: tên dịch vụ của phiếu điều trị trên mọi dòng (kể cả phát sinh).
- Phiếu thanh toán: dòng "Tạm ứng phát sinh" ghi mã `THANHTOAN-34/DT33/2026`
  (chữ xanh); các loại khác ghi "-" (cũng xanh). ⇒ tạm ứng trên bản gốc là
  **phiếu thu thường** trên một phiếu điều trị, phần chưa tiêu theo tiến độ
  được tính là tạm ứng; phần DT = mã phiếu điều trị (DT32 = "Test DV" của
  HN8521, khớp `patient-detail.md`), không phải số phiếu thu.
- Bác sĩ điều trị: bác sĩ của phiếu điều trị, nhiều người nối bằng ", ".
- Số tiền: có dấu, `+1.000.000 đ` xanh lá / `-500.000 đ` đỏ — màu theo
  **dấu**, không theo loại sự kiện. Số dư sau: chữ xanh dương, không dấu.

**Local sau đợt (3)** (`PrepaidSubTab`, `ClinicReportAppService`,
`PatientPayment.FormatCode`):

- 4 thẻ đúng nhãn + màu, pill xanh lá; "Số dư tạm ứng hiện tại" = tổng tạm
  ứng mọi kỳ theo chi nhánh (local chưa có tiêu dùng / hoàn tạm ứng nên
  bằng tổng nạp).
- Cột Phiếu thanh toán hiện mã của phiếu (chữ xanh); Số tiền tô theo dấu;
  Số dư sau xanh dương; nhãn 4 loại sự kiện có sẵn trong `EVENT_LABELS`.
- Mã phiếu thu: `THANHTOAN-NN/<mã phiếu điều trị>/yyyy`.
- **Khác mô hình**: local "Tạm ứng" = nạp tiền giữ hộ ngoài phiếu điều trị
  (`PatientPaymentKind.Prepaid`, không `TreatmentPlanId`), nên chỉ có sự kiện
  "Tạm ứng phát sinh", cột Dịch vụ trống, Bác sĩ điều trị "-", mã `TAMUNG`
  (giả định). Sự kiện tiêu dùng theo tiến độ / chuyển / thay thế cần mô hình
  tạm ứng theo phiếu điều trị — ghi ở `unknowns.md`, không dựng trong /report.

### Còn khác bản gốc

- Tab 1 Tạm ứng: local không có "Tiêu tạm ứng theo tiến độ" / "Chuyển tạm
  ứng sang dịch vụ mới" / "Xóa tạm ứng dịch vụ cũ (thay thế)" vì tạm ứng
  local không gắn phiếu điều trị (xem đợt (3)); hai thẻ Tiêu dùng / Hoàn
  luôn 0.
- Tab 1 Excel của staging chưa tải để so; chữ đỏ "(Đã hủy)" trong file tab 1
  chưa tái tạo (`xlsx` community không ghi rich text) — trên màn hình đã có.
- Tab 4: chữ hộp Hủy và công thức 6 ô là quyết định của chủ dự án (bảng
  trên), không phải quan sát; nhãn "Nạp vào dư nợ" / "Rút dư nợ" của bundle
  chưa có kênh local.
- Cột Thao tác tab 2 rộng 180/100 thay vì 70 sticky (cùng 4 nút, không gãy
  dòng). `@page` A4 10mm là giả định.
- Local xoá cứng dòng tab 4 nên không có kiểu "dòng đã xoá" như staging.
