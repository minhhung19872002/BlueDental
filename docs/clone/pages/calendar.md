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

**No page title (BlueDental BA requirement 2026-10-20, R-993):**

- BlueDental used to show a "Lịch hẹn khách hàng" title above the tabs, on both tabs. The BA asked for it to go, to give the calendar more room.
- The tabs now start right under the header, as in the layout above.
- A visually hidden `<h1 class="bd-sr-only">` keeps the page name for screen readers.
- `/calendar/list` (Lịch đã hẹn) keeps its title.

**Toolbar in one row (BlueDental BA requirement 2026-10-20, R-999):**

The reference has three bands: tabs, then Ngày/Tuần/Tháng + date + counters, then search + buttons. The BA asked for two bands, on both tabs:

| Band | Lịch hẹn khách hàng | Lịch làm việc |
|---|---|---|
| Tab row | pills on the left, the 6 status counters on the right | pills on the left, the 6 KPI chips on the right |
| Toolbar row | Ngày/Tuần/Tháng, date, Tìm kiếm, Bác sĩ, then Xuất File, Tạo lịch hẹn mới, Lịch tạm, ≡, ⏱, ⛶ on the right | Ngày/Tuần/Tháng, date, Tìm kiếm, ⓘ, then the Lịch làm việc button on the right |

When the toolbar row does not fit:

- 1366px and wider: one line. Search shrinks from 220 to 140px and Bác sĩ from 280 to 170px before anything wraps.
- Narrower: the button group drops to its own line, right-aligned, and the fields go back to full width.
- Tablet: the counters drop under the pills.
- Phone (≤760px): pills, counters (horizontal scroll), the two create buttons, Ngày/Tuần/Tháng full width, date full width, then Bác sĩ + slot buttons.
- Fullscreen hides both bands, as before.
- The work-schedule builder (Lịch làm việc → button) has no counters on the tab row.

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

### 6b. Local Day View — horizontal doctor timeline (BA 2026-10-03, NOT reference behaviour)

BlueDental deliberately departs from the reference grid above, at the BA's request
(mockup "Lịch bác sĩ hôm nay"):

- Rows = doctors working that day (doctors registered OFF are left out; an OFF doctor
  who still has bookings keeps a row). Row header = doctor name only.
- Horizontal time axis 07:00–20:00 (constant until shift master data exists), ticks
  every 30 min, sticky names and axis, red "now" line + badge on today.
- Mouse drag scrolls sideways only; bookings cannot be moved by dragging.
- Block colours: booked purple, waiting (checked in, not started) dashed amber,
  in progress amber, nearly done (≤10 min left) blue, overdue red, done grey,
  no-show muted + strikethrough. Cancelled bookings are not drawn at all (BA).
- Empty slot click → "Tạo lịch hẹn" with doctor + time; block click → "Cập nhật lịch hẹn".
- Not built: "Nhận khách mới" column, room, specialty, KPI cards, banners.

Code: `BlueDental.FE/src/features/appointments/components/day-timeline/`.
Test: `BlueDental.FE/e2e/appointment-day-timeline.spec.ts`.

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
