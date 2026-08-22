# Calendar Page — /calendar

Source: https://app.nfcdental.com/calendar?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/calendar-main.png

## Route

`/calendar?branchId=<branchId>`

## Page Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                      │
│           │─────────────────────────────────────────────────────────────  │
│           │ TABS (top-level): [Lịch hẹn khách hàng] [Lịch làm việc]     │
│           │─────────────────────────────────────────────────────────────  │
│           │ TOOLBAR ROW 1                                                  │
│           │ [Ngày|Tuần|Tháng]  < 22/08/2026 >                            │
│           │─────────────────────────────────────────────────────────────  │
│           │ STATUS COUNTER BUTTONS (6 buttons, act as filters)            │
│           │ [0 Đã hẹn][0 Đã đến][0 Huỷ hẹn][0 Trễ hẹn][0 Lịch tạm]   │
│           │ [0 Chuyển đổi]                                                │
│           │─────────────────────────────────────────────────────────────  │
│           │ TOOLBAR ROW 2                                                  │
│           │ [🔍 Tìm kiếm]  [Chọn bác sĩ ▼]    [Xuất File][Tạo lịch hẹn │
│           │  mới][Tạo lịch tạm][Xem theo giờ][Toàn màn hình]            │
│           │─────────────────────────────────────────────────────────────  │
│           │ CALENDAR GRID (Day view default)                               │
│           │ Giờ/Nhân viên | BS Khanh | BS Tiên | BS Hương 4 | BS Hương  │
│           │              | BS Tới 10 | BS Tới 3 | BS Tới 1 | BS Tới     │
│           │ 06:00  ─────────────────────────────────────────────────────  │
│           │ 06:30  ─────────────────────────────────────────────────────  │
│           │ ...    (30-min slots from 06:00 to 23:30)                     │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Top-Level Tabs (2 tabs)

| Tab | Vietnamese | Notes |
|-----|-----------|-------|
| 1 | Lịch hẹn khách hàng | Patient appointment calendar (default) |
| 2 | Lịch làm việc | Staff work schedule |

### 2. View Mode Tabs (3 options)

| Tab | Vietnamese | URL param |
|-----|-----------|-----------|
| Ngày | Day | (default, current) |
| Tuần | Week | UNKNOWN |
| Tháng | Month | UNKNOWN |

### 3. Date Navigation

- Previous: "Ngày trước" button (←)
- Current: "22/08/2026" button (opens date picker — UNKNOWN behavior)
- Next: "Ngày kế tiếp" button (→)

### 4. Status Counter Buttons (6 — act as filters)

| # | Label (VI) | Notes |
|---|-----------|-------|
| 1 | Đã hẹn | Scheduled |
| 2 | Đã đến | Checked In |
| 3 | Huỷ hẹn | Cancelled |
| 4 | Trễ hẹn | Late |
| 5 | Lịch tạm | Tentative Schedule |
| 6 | Chuyển đổi | Transferred/Converted |

All show count (0 for today with no data). Clicking filters the grid.

### 5. Toolbar Row 2

**Left:**
- Search textbox: "Tìm kiếm" (search by patient name?)
- "Chọn bác sĩ" dropdown — filters grid columns by doctor

**Right (action buttons):**
| Button | Vietnamese | Notes |
|--------|-----------|-------|
| Xuất File | Export | File export — UNKNOWN format |
| Tạo lịch hẹn mới | New Appointment | Opens create form — UNKNOWN |
| Tạo lịch tạm | Create Tentative | Opens create tentative form — UNKNOWN |
| Xem theo giờ | View by Hour | Toggles compact/expanded time slots |
| Toàn màn hình | Full Screen | Maximizes calendar grid |

### 6. Calendar Grid (Day View)

**Grid Structure:**
- Columns: "Giờ /Nhân viên" header + one column per doctor
- Rows: 30-minute time slots from 06:00 to 23:30 (36 slots × 2 = ~72 rows including sub-rows)
- Each slot has a "main" row and a sub-row (for stacking appointments)

**Doctor columns observed (8 doctors for this clinic):**
| Column Header | Count |
|--------------|-------|
| BS Khanh | (0) |
| BS Tiên | (0) |
| BS Hương 4 | (0) |
| BS Hương | (0) |
| BS Tới 10 | (0) |
| BS Tới 3 | (0) |
| BS Tới 1 | (0) |
| BS Tới | (0) |

Note: "(0)" shows appointment count for that doctor for the day.

**Navigation button:** "Hiển thị nhóm bác sĩ sau" (Show next doctor group) — horizontal scroll through doctors.

**Time range:** 06:00 to 23:30, 30-minute slots.

## Appointment Card in Grid (UNKNOWN_REFERENCE_BEHAVIOR)

When appointments exist, each cell shows a colored card. Content/colors UNKNOWN — no appointments visible on 2026-08-22.

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | Appointment card appearance | No data to observe |
| 2 | "Tạo lịch hẹn mới" form fields | Form not opened |
| 3 | "Tạo lịch tạm" form fields | Form not opened |
| 4 | Week view layout | Not switched to |
| 5 | Month view layout | Not switched to |
| 6 | "Xem theo giờ" toggle behavior | Not clicked |
| 7 | Click on grid cell behavior | Not clicked |
| 8 | Appointment card click behavior | No data |
| 9 | "Lịch làm việc" tab content | Not clicked |
| 10 | Date picker popup | Not observed |
