# Patient List Page — /patient

Source: https://app.nfcdental.com/patient?branchId=<id>
Observed: 2026-08-21

## Purpose

Patient registry with treatment status and financial summary.
Second item in sidebar, under "Danh sách bệnh nhân".

## Route

`/patient?branchId=<branchId>`

Patient detail: `/patient/:patientId?branchId=<branchId>`

## Page Layout (top to bottom)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                    │
│           │─────────────────────────────────────────────────────────────│
│           │ [Toolbar]                                                    │
│           │ Ngày|Tuần|Tháng  📅Chọn thời gian  🔍Tìm kiếm              │
│           │                              [Xuất file] [+Tạo hồ sơ]       │
│           │─────────────────────────────────────────────────────────────│
│           │ [Filter Row]                                                 │
│           │ Tất cả|Điều trị hoàn tất|Đang điều trị|Chưa phát sinh       │
│           │ 🔍Bác sĩ ▼  🔍Phân loại dịch vụ ▼  🔍Phân loại theo Tag ▼  │
│           │─────────────────────────────────────────────────────────────│
│           │ [Data Table]                                                 │
│           │ Ngày tạo | Họ tên | Ngày sinh | SĐT | Trạng thái | ...     │
│           │ ────────────────────────────────────────────────────────     │
│           │ 17/08/26 | [DH26012] - LÊ THI LIÊN | ... | Chưa phát sinh  │
│           │ 15/08/26 | [DH2609] - CAO THỊ THANH... | ... | Đang điều trị│
│           │ ...                                                          │
│           │─────────────────────────────────────────────────────────────│
│           │ [Pagination]                                                 │
│           │ 20/trang ▼   Hiển thị 1-11 trên 11   < Trước [1] Sau >     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Toolbar

**Left group:**
- Time period tablist: `Ngày` | `Tuần` | `Tháng` (same as reception)
- Date picker button: calendar icon + "Chọn thời gian"

**Center:**
- Search textbox: placeholder "Tìm kiếm", type="search", floating label

**Right group:**
- "Xuất file" button — secondary style (outline/ghost), download icon + text
- "Tạo hồ sơ" button — primary blue, plus icon + text

### 2. Filter Row

**Left group:**
- Status tabs: `Tất cả` | `Điều trị hoàn tất` | `Đang điều trị` | `Chưa phát sinh`
  - NO counts in parentheses (unlike reception page)

**Right group:**
- 3 filter dropdowns (combobox type, each with search icon):
  - "Bác sĩ" (Doctor)
  - "Phân loại dịch vụ" (Service category)
  - "Phân loại theo Tag" (Tag category)

### 3. Data Table

13 columns total:

| # | Header (VI) | Header (EN) | Type | Format / Notes |
|---|---|---|---|---|
| 1 | Ngày tạo hồ sơ | Record Date | Date | DD/MM/YYYY |
| 2 | Họ và tên | Full Name | Link | `[CODE] - FULL NAME` → `/patient/:id` |
| 3 | Ngày sinh | DOB | Date | DD/MM/YYYY, can be "—" when missing |
| 4 | Số điện thoại | Phone | Text | 10-digit, no formatting |
| 5 | Trạng thái | Status | Badge | Colored tag component |
| 6 | Dịch vụ | Service | Text | Service name, "—" when none |
| 7 | Bác sĩ | Doctor | Text | Doctor name, "—" when none |
| 8 | Số tiền | Amount | Currency | VND with dot separators (24.000.000) |
| 9 | Thực thu | Collected | Currency | Green text for amounts > 0 |
| 10 | Công nợ | Debt | Currency | Green/colored for outstanding |
| 11 | Lịch hẹn gần nhất | Next Appointment | DateTime | DD/MM/YYYY HH:mm |
| 12 | Lần khám cuối | Last Visit | DateTime | DD/MM/YYYY HH:mm |
| 13 | Thao tác | Actions | Buttons | View (eye icon) + Edit (pencil icon) |

**Table styling:**
- Header: light gray background, bold text
- Rows: white background, alternating or hover highlight
- Patient name: blue link text, bold patient code in brackets
- Status badge: rounded tag/pill
- Currency: right-aligned, dot-separated thousands, green for financial amounts
- Horizontal scrolling for overflow columns

### 4. Pagination

- Page size dropdown: options 5, 10, 20 (default), 25, 50, 100
- Display text: "Hiển thị {start}–{end} trên {total} bệnh nhân"
- Navigation: "Trước" (Previous) | page number buttons | "Sau" (Next)
- Active page: blue circle

## Patient Code Format

Pattern: `[DH{YY}{SEQ}]`
- DH = clinic prefix
- YY = 2-digit year (26 = 2026)
- SEQ = sequence number (001, 002, ... 012)
- Examples: [DH26001], [DH2609], [DH26012]

Note: Sequence is NOT zero-padded consistently — DH2609 vs DH26012.

## Status Badge Mapping

| Value | Vietnamese | Color | Background |
|---|---|---|---|
| NOT_STARTED | Chưa phát sinh | Gray | Light gray |
| IN_TREATMENT | Đang điều trị | Blue | Light blue |
| COMPLETED | Hoàn tất | Green | Light green |

## Currency Format

- Vietnamese Dong (VND)
- Dot as thousands separator (24.000.000)
- No currency symbol displayed
- Zero displayed as "0"
- Amounts right-aligned in columns

## Observed Data Characteristics

- 11 patients total in this branch
- Patient names: uppercase Vietnamese names
- Phone: 10-digit, starts with 0
- Doctors observed: "BS Hương", "BS Tới" (prefix "BS" = Bác sĩ)
- Services observed: "Niềng răng mắc cài kim loại", "Cạo vôi, đánh bóng", "Nhổ răng hàm", "Chữa tủy răng lại", "Niềng răng mắc cài sứ tự khóa rãnh kim loại"
