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
| 2 | Thanh toán | Payments |
| 3 | Hoàn tiền | Refunds |
| 4 | Dư nợ | Outstanding debt |

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
| 5 | Tab Chi phí: nhãn field của dialog "Thêm mới" (bản thu: "Người nộp"; bản chi chưa mở) | Không mở thêm để tránh nhầm sang thao tác ghi |
| 6 | Tab 4 → Danh mục → "Thêm mục": các field | Không mở |

## Local implementation — 2026-09-04

- FE-only, mock data (`features/report/api/reportMockData.ts`,
  `reportMockQueries.ts`). Mọi nút Lưu / Duyệt / Từ chối / Xóa chỉ hiện toast
  "… — bản demo, chưa lưu dữ liệu" (`notifyDemoAction`), KHÔNG gọi API ghi.
- Backend cho tab 2 & 4 (`financeApi.ts`) vẫn còn nhưng không được UI dùng —
  sẽ nối lại khi BE hoàn thiện.
- Dùng chrome của hệ thống (pill tabs, `reception-card`, `DataTable`,
  `FormModal`, `SearchSelect`, `CurrencyInput`, `DateNavigator`) thay vì
  copy Tailwind của bản gốc; responsive tại 1280 / 1100 / 640.
- Xuất Excel tab 1 (`components/serviceExport.ts`): đúng 12 cột phẳng như bản
  gốc (xem bảng trên), số tiền ghi số thô. Cột "Chi nhánh" lấy
  `MOCK_BRANCH_NAME` vì dữ liệu còn là mock; chữ đỏ "(Đã hủy)" trong file gốc
  chưa tái tạo (thư viện `xlsx` bản community không ghi rich text).
