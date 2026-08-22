# Report Page — /report

Source: https://app.nfcdental.com/report?branchId=<id>
Observed: 2026-08-22
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
- "Doanh số": current revenue value
- "Xuất Excel" button

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

| # | Control | Reason |
|---|---------|--------|
| 1 | Sub-filter buttons behavior (all tabs) | No data to filter |
| 2 | Week/Month/Year view table structure | Not switched |
| 3 | "Thêm mới" form fields (cashflow tab) | Not opened |
| 4 | "Luân chuyển/Nạp/Rút" button forms | Not opened |
| 5 | "Danh mục" sub-filter content | Not clicked |
| 6 | Chart/graph elements | Not visible (no data) |
| 7 | Patient name links from report rows | Not clicked |
