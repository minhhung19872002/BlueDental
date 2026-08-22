# CSKH / Customer Care Page — /cskh-grouping

Source: https://app.nfcdental.com/cskh-grouping?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/cskh-grouping.png

## Route

`/cskh-grouping?branchId=<branchId>`

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                     │
│           │ TOP TABS: [Chăm sóc khách hàng] [Phân nhóm CSKH]           │
│           │──────────────────────────────────────────────────────────── │
│           │ TOOLBAR ROW 1 (date filters)                                  │
│           │ [Ngày|Tuần|Tháng]  < 22/08/2026 >                           │
│           │──────────────────────────────────────────────────────────── │
│           │ STATUS COUNTER BUTTONS (5, act as filters)                   │
│           │ [0 Tổng khách][0 Thành công][0 Thất bại]                    │
│           │ [0 Chưa CS][0 Đã gửi Zalo]                                  │
│           │──────────────────────────────────────────────────────────── │
│           │ CARE TYPE TABS                                                │
│           │ [Sau điều trị][Chúc mừng sinh nhật][Nhắc lịch hẹn]         │
│           │ [CSKH định kì][CSKH đặc biệt]                               │
│           │──────────────────────────────────────────────────────────── │
│           │ TOOLBAR ROW 2                                                 │
│           │ [Xuất Excel] [🔍 Tìm kiếm] [Bác sĩ điều trị ▼]            │
│           │──────────────────────────────────────────────────────────── │
│           │ TABLE (8 columns)                                             │
│           │ Ngày chăm sóc | Họ và tên | SĐT | Bác sĩ | Lịch hẹn sắp  │
│           │ tới | Trạng thái | Ghi chú | Thao tác                       │
│           │──────────────────────────────────────────────────────────── │
│           │ PAGINATION: 20/trang  Hiển thị 0/0 khách  < Trước | Sau > │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Top-Level Tabs (2 tabs)

| Tab | Vietnamese | Notes |
|-----|-----------|-------|
| 1 | Chăm sóc khách hàng | Customer care (default) |
| 2 | Phân nhóm CSKH | Customer care grouping |

### 2. View Mode / Date Tabs

- Ngày (Day) | Tuần (Week) | Tháng (Month)
- Date navigation: < prev | 22/08/2026 | next >

### 3. Status Counter Buttons (5 — act as filters)

| # | Label (VI) | English | Default state |
|---|-----------|---------|---------------|
| 1 | Tổng khách | Total customers | [pressed/active] |
| 2 | Thành công | Successful | — |
| 3 | Thất bại | Failed | — |
| 4 | Chưa CS | Not yet cared | — |
| 5 | Đã gửi Zalo | Sent Zalo | — |

### 4. Care Type Tabs (5 tabs)

| # | Label (VI) | English |
|---|-----------|---------|
| 1 | Sau điều trị | After treatment (default) |
| 2 | Chúc mừng sinh nhật | Birthday greetings |
| 3 | Nhắc lịch hẹn | Appointment reminders |
| 4 | CSKH định kì | Periodic customer care |
| 5 | CSKH đặc biệt | Special customer care |

### 5. Toolbar Row 2

| Control | Type | Notes |
|---------|------|-------|
| Xuất Excel | Button | Export to Excel |
| Tìm kiếm | Searchbox | Search by patient name |
| Bác sĩ điều trị | Combobox | Filter by treating doctor |

### 6. Table Columns (8 columns)

| # | Header (VI) | Notes |
|---|------------|-------|
| 1 | Ngày chăm sóc | Care date |
| 2 | Họ và tên | Patient full name |
| 3 | Số điện thoại | Phone number |
| 4 | Bác sĩ điều trị | Treating doctor |
| 5 | Lịch hẹn sắp tới | Upcoming appointment |
| 6 | Trạng thái | Status badge |
| 7 | Ghi chú | Notes |
| 8 | Thao tác | Action buttons |

Empty state: "Không có dữ liệu"

### 7. Pagination

Options: 5, 10, 20 (default), 25, 50, 100
Text: "Hiển thị 0 trên 0 khách"

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Phân nhóm CSKH" tab content | Not clicked |
| 2 | Status badge values for CSKH | No data |
| 3 | Row action buttons (Thao tác column) | No data rows |
| 4 | "Sau điều trị" vs other care type tabs — different columns? | Not observed |
| 5 | Zalo send button behavior | Not clicked |
