# Reception Page — /reception

Source: https://app.nfcdental.com/reception?branchId=<id>
Observed: 2026-08-21 (updated 2026-08-22 with screenshot comparison + local clone analysis)

## Purpose

Daily reception/visit tracking. Shows the list of patient visits for a
selected day, week, or month. This is the default/first page in the sidebar.

## Route

`/reception?branchId=<branchId>`

branchId is a 24-character hex string (MongoDB ObjectId format).

## Page Layout (top to bottom)

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  HEADER                                                     │
│ ~70-80px │  [toggle] [logo img] CLINIC NAME    [search Ctrl+K]         │
│          │          tagline                 [branch ▼][🌐][🔔][avatar]│
│ ┌──────┐ ├──────────────────────────────────────────────────────────────┤
│ │NFClog│ │  TOOLBAR ROW 1                                              │
│ └──────┘ │  [Ngày|Tuần|Tháng]  [< 📅 22/08/2026 >]  [🔍 Tìm bệnh    │
│ Tiếp nhận│  nhân...]                         [📋 Tạo tiếp nhận]       │
│ *active* ├──────────────────────────────────────────────────────────────┤
│          │  TOOLBAR ROW 2 / FILTER BAR                                 │
│ DS bệnh  │  [Tất cả(5)] [Chờ khám(2)] [Đang khám(2)] [Hoàn thành(1)] │
│ nhân     │  [🔍 Bác sĩ ▼]      [12 Đã hẹn][5 Đã đến][1 Huỷ]        │
│          │                       [0 Trễ hẹn][0 Lịch tạm][0 Chuyển]   │
│ Lịch hẹn ├──────────────────────────────────────────────────────────────┤
│          │  CONTENT AREA                                               │
│ CSKH-    │                                                             │
│ Phân nhóm│  ┌─────────────────────────────────────────────────────┐    │
│          │  │ SỐ PHIẾU │ BỆNH NHÂN │ BÁC SĨ │ ... │ THAO TÁC   │    │
│ Labo     │  ├─────────────────────────────────────────────────────┤    │
│          │  │ TN-xxx   │ Name [Mới]│ BS...  │ ... │ [Tiếp nhận] │    │
│ Quản trị │  │ TN-xxx   │ Name [Cũ] │ BS...  │ ... │ [Xong]  ⋮  │    │
│ vận hành │  │ TN-xxx   │ Name [Mới]│ BS...  │ ... │         ⋮  │    │
│          │  ├─────────────────────────────────────────────────────┤    │
│ Báo cáo  │  │ Tổng số N hồ sơ tiếp nhận  10/trang ▼   < 1 >    │    │
│          │  └─────────────────────────────────────────────────────┘    │
│ Nhân viên│                                                             │
└──────────┴─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Header Bar (~55px height)

**Left section (inside header, right of sidebar):**
- Sidebar toggle button — panel/layout icon, controls sidebar collapse/expand
- Clinic logo image — circular branded image (~45px), NOT a text avatar. Dynamic per clinic.
- Clinic name — bold text (e.g. "NHA KHOA ĐỨC HẠNH PREMIUM")
- Tagline — smaller lighter text (e.g. "Kiến Tạo Nụ Cười - Giá Trị Bền Vững")

**Center section:**
- Global search — styled as button/input
- Placeholder: "Tìm kiếm khách hàng, lịch hẹn, nhân viên..."
- "Ctrl K" keyboard shortcut badge on right

**Right section:**
- Branch selector — green dot indicator + branch name + dropdown chevron
- Language button — globe icon
- Notification button — bell icon with count badge
- User menu — circular avatar image + user display name + dropdown chevron

### 2. Sidebar (two states)

- Position: fixed left, full viewport height
- Background: white
- Active item: blue background (~#e6f4ff), blue icon, blue text, rounded corners
- Inactive items: gray icon, dark text
- Bottom-pinned: "Hướng dẫn & hỗ trợ" separated from main nav

**Collapsed state:**
- Width: ~70-80px
- Each item: icon centered above label text, stacked vertically
- Labels: small text (~11px), may wrap to 2 lines
- No section headings

**Expanded state (via sidebar toggle button in header):**
- Width: ~180px
- Each item: icon left + label text right, horizontal layout
- Section heading "MENU" (blue uppercase, ~11px) above main nav
- Section heading "KHÁC" (blue uppercase) above "Hướng dẫn & hỗ trợ"
- Top area shows NFC Dental logo + "NFC Dental" bold + "Phần Mềm Quản Trị Vận Hành" subtitle

**Navigation items:**

| # | Label (VI) | Route |
|---|-----------|-------|
| 1 | Tiếp nhận | /reception |
| 2 | Danh sách bệnh nhân | /patient |
| 3 | Lịch hẹn | /calendar |
| 4 | CSKH - Phân nhóm | /cskh-grouping |
| 5 | Labo | /labo |
| 6 | Quản trị vận hành | /operations |
| 7 | Báo cáo | /report |
| 8 | Nhân viên | /staff |
| 9 | Vật tư | /materials |
| 10 | Danh mục | /taxonomy |
| 11 | Công cụ | /tools |
| — | Hướng dẫn & hỗ trợ | external: https://nfcdental.com/ |

### 3. Toolbar Row 1

**Left group:**
- Time period tablist: `Ngày` | `Tuần` | `Tháng`
  - Active: blue background (#1677ff), white text, rounded pill (~60w x 32h px)
  - Inactive: transparent background, dark text
- Date navigator:
  - Left chevron button `<` (previous day/week/month)
  - Calendar icon (📅) + date text "22/08/2026" (DD/MM/YYYY format)
  - Right chevron button `>` (next day/week/month)
- Patient search: magnifying glass prefix + placeholder "Tìm bệnh nhân..."
  - Width ~200-240px

**Right group:**
- Primary action button: clipboard/document icon (NOT a "+" plus icon) + "Tạo tiếp nhận"
  - Style: blue primary button, white text, rounded
  - Dimensions: ~150w x 36-40h px
  - UNKNOWN_REFERENCE_BEHAVIOR: opens form/drawer — not clicked

### 4. Toolbar Row 2 / Filter Bar

**Left group:**
- Status filter tabs (pill style):
  - `Tất cả (N)` — All
  - `Chờ khám (N)` — Waiting
  - `Đang khám (N)` — In Progress
  - `Hoàn thành (N)` — Completed
  - Active: solid blue pill, white text
  - Inactive: plain text, no background
  - Count shown in parentheses
- Doctor filter combobox:
  - Magnifying glass icon + "Bác sĩ" label + dropdown chevron
  - Width ~180px

**Right group — 6 Status Counter Cards (OBSERVED):**

| # | Label (VI) | Label (EN) | Top Border Color | Number Color | BG Color |
|---|-----------|-----------|-----------------|-------------|---------|
| 1 | Đã hẹn | Scheduled | Blue (#1E70E6) | Blue | #EBF3FE |
| 2 | Đã đến | Arrived | Green (#10B981) | Green | #E6F4EA |
| 3 | Huỷ hẹn | Cancelled | Red (#EF4444) | Red | #FCE8E6 |
| 4 | Trễ hẹn | Late | Amber (#F59E0B) | Amber | #FEF3C7 |
| 5 | Lịch tạm | Temporary | Orange (#F97316) | Orange | #FFEDD5 |
| 6 | Chuyển đổi | Converted | Cyan (#06B6D4) | Cyan | #CFFAFE |

Card style:
- White/tinted background (color-tinted)
- Rounded corners (~8px border-radius)
- Colored top border (~3px solid)
- Number: large bold centered, colored to match border
- Label: below number, smaller ~12px, gray text
- Dimensions: ~70w x 55h px each
- Horizontal row, right-aligned

UNKNOWN_REFERENCE_BEHAVIOR: Whether counter cards are clickable for filtering.

### 5. Content Area — Empty State (OBSERVED)

Container: light blue-gray background (#f0f5ff), rounded corners (~12px), full width with padding.

Centered content:
- Person outline icon (user silhouette, blue/gray, ~48px)
- Heading: "Không có lượt tiếp nhận phù hợp" (bold, dark, ~16px)
- Subtitle: "Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu." (lighter, ~14px)

### 6. Content Area — Populated Table

OBSERVED via reference screenshots (date 22/08/2026 with 5 records):

**Table columns:**

| # | Column Header (VI) | Content | Width |
|---|-------------------|---------|-------|
| 1 | Số phiếu | TN-YYYYMMDD-NN (blue link) | ~130px |
| 2 | Bệnh nhân | Name + [Mới/Cũ] badge + phone number (second line) | ~200px |
| 3 | Bác sĩ tiếp nhận | Doctor full name | ~150px |
| 4 | Nhân sự tư vấn | Staff name (lighter text) | ~150px |
| 5 | Nguồn tiếp nhận | Colored badge (see below) | ~100px |
| 6 | Trạng thái | Badge with icon (see below) | ~120px |
| 7 | Dịch vụ điều trị | Service name(s), multiple shown as chips | ~200px |
| 8 | Tổng tiền | Amount in VND (e.g. "1.500.000 đ") | ~120px |
| 9 | Thao tác | Action button + ⋮ menu | ~100px |

**Ticket number format:** `TN-{YYYYMMDD}-{NN}` (e.g. TN-20260821-01)

**Patient column content:**
- Line 1: Full name + [Mới] or [Cũ] badge
- Line 2: Phone number (smaller, lighter text)
- "Mới" (New patient): green tag
- "Cũ" (Returning patient): gray/default tag

**Source badges (Nguồn tiếp nhận):**
| Value | Label | Color |
|-------|-------|-------|
| SELF | Tự đến | Blue |
| MEDICAL | Y tế | Purple |
| MARKETING | Marketing | Green (geekblue) |
| REFERRAL | Giới thiệu | Cyan/Orange |

**Status badges (Trạng thái):**
| Value | Label | Color | Icon |
|-------|-------|-------|------|
| WAITING | Chờ khám | Blue | Clock icon |
| IN_PROGRESS | Đang khám | Orange | Sync/spinner icon |
| COMPLETED | Hoàn thành | Green | Checkmark icon |

**Action column (Thao tác):**
| Status | Button shown | Style |
|--------|-------------|-------|
| Chờ khám | "Tiếp nhận" | Blue primary button |
| Đang khám | "Xong" | Green primary button |
| Hoàn thành | (none) | Only ⋮ menu |

Three-dot menu (⋮): UNKNOWN_REFERENCE_BEHAVIOR — not clicked.

**Pagination:**
- Left: "Tổng số N hồ sơ tiếp nhận"
- Center: page size dropdown "10 / trang" (options: unknown)
- Right: `<` [1] `>` page navigation

### 7. Detail Card View (OBSERVED from reference screenshot 2026-08-20)

When clicking on a reception record (appears as a card overlay or expanded row):

```
┌─────────────────────────────────────────────────────────┐
│ 📁 DH2609        [Trễ hẹn] badge              [📅 icon] │
│ 👤 CAO THỊ THANH TUYẾT (2001)                          │
│ ⚙️  BS Hương                                            │
│ 🏷️  Khách cũ                                           │
│ 🕐  15:00                                               │
│ 📝  gmc 2h, chụp lại phim                              │
│                                                         │
│    [──1──]────[──2──]────[──3──]                       │
│     Đã đến   Đang khám   Hoàn tất                      │
│     --:--     --:--       --:--                         │
│                                                         │
│    [🔍 BS Hương              ▼]                        │
│                                                         │
│  ○ Kết thúc điều trị  (radio selected)                 │
│  ○ Đã hẹn tiếp                                         │
│  ○ Chuyển bác sĩ                                       │
│  ○ Hẹn tái khám                                        │
└─────────────────────────────────────────────────────────┘
```

**Card fields observed:**
- Patient code (e.g. DH2609) + status badge (e.g. "Trễ hẹn")
- Calendar icon button (top right) — UNKNOWN_REFERENCE_BEHAVIOR
- Patient full name + birth year in parentheses
- Doctor name (with person/doctor icon)
- Patient type (Khách cũ / Khách mới)
- Appointment time (HH:mm format)
- Notes text (free text field)

**Progress stepper (3 steps):**
1. Đã đến (Arrived) — shows timestamp or --:--
2. Đang khám (In progress) — shows timestamp or --:--
3. Hoàn tất (Completed) — shows timestamp or --:--

**Doctor selector:** Dropdown to select/change doctor

**Outcome radio buttons (Kết quả):**
- Kết thúc điều trị (End treatment) — default selected
- Đã hẹn tiếp (Next appointment booked)
- Chuyển bác sĩ (Transfer to doctor)
- Hẹn tái khám (Follow-up appointment)

## API Observations

Reference uses Next.js RSC — no traditional REST endpoints observed.
Route prefetch: `GET /reception?branchId=<id>&_rsc=<token>` → HTTP 200

Local BlueDental BE endpoints designed (not reverse-engineered from reference):
- `GET /v1/app/appointments` — list receptions
- `POST /v1/app/appointments` — create reception
- `POST /v1/app/appointments/{id}/check-in` — check-in (step 1)
- `POST /v1/app/appointments/{id}/start` — start exam (step 2)
- `POST /v1/app/appointments/{id}/complete` — complete (step 3)

## Status Flow

```
Chờ khám (WAITING)
    ↓ [Tiếp nhận button]
Đã đến / Đang khám (IN_PROGRESS)
    ↓ [Xong button]
Hoàn thành (COMPLETED)
    ↓ [Kết quả radio]
    ├─ Kết thúc điều trị
    ├─ Đã hẹn tiếp
    ├─ Chuyển bác sĩ
    └─ Hẹn tái khám
```

Counter cards track appointment-level statuses (different from reception status):
- Đã hẹn (Scheduled appointment) → Trạng thái trong hệ thống lịch hẹn
- Đã đến (Arrived)
- Huỷ hẹn (Cancelled)
- Trễ hẹn (Late/No-show)
- Lịch tạm (Temporary schedule)
- Chuyển đổi (Converted)

## Dimensions (Estimated from reference at ~1920x948 viewport)

| Element | Estimated Size |
|---------|---------------|
| Sidebar width (collapsed) | ~70-80px |
| Sidebar width (expanded) | ~180px |
| Header height | ~55px |
| Toolbar Row 1 height | ~48px |
| Toolbar Row 2 height | ~48px |
| Counter card | ~70w x 55h px |
| Time tab pill (active) | ~55w x 32h px |
| Status tab pill | ~110w x 32h px |
| Patient search input | ~200w x 36h px |
| Primary button | ~150w x 40h px |
| Date navigator | ~180w x 36h px |

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Tạo tiếp nhận" button | Opens form to create — mutating |
| 2 | Three-dot (⋮) menu per row | Unknown menu items — could be mutating |
| 3 | "Tiếp nhận" action button | Transitions status — mutating |
| 4 | "Xong" action button | Transitions status — mutating |
| 5 | Counter cards click | Unknown if filters the list |
| 6 | Date picker popup | Full calendar picker UI unknown |
| 7 | "Tuần" and "Tháng" views | Layout change when switching |
| 8 | Calendar icon in detail card | Unknown action |
| 9 | Doctor selector in detail | Whether changing doctor mutates data |
| 10 | Outcome radio buttons (save) | How/when outcome is saved |
