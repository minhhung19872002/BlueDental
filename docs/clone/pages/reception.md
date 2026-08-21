# Reception Page — /reception

Source: https://app.nfcdental.com/reception?branchId=<id>
Observed: 2026-08-21 (updated with screenshot comparison)

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
│ └──────┘ │  [Ngày|Tuần|Tháng]  [< 📅 21/08/2026 >]  [🔍Tìm bệnh     │
│ Tiếp nhận│  nhân...]                         [📋 Tạo tiếp nhận]       │
│ *active* ├──────────────────────────────────────────────────────────────┤
│          │  TOOLBAR ROW 2 / FILTER BAR                                 │
│ DS bệnh  │  [Tất cả(0)] Chờ khám(0) Đang khám(0) Hoàn thành(0)       │
│ nhân     │  [🔍 Bác sĩ ▼]            [counter][counter][counter]      │
│          │                            [counter][counter][counter]      │
│ Lịch hẹn ├──────────────────────────────────────────────────────────────┤
│          │  CONTENT AREA                                               │
│ CSKH-    │                                                             │
│ Phân nhóm│  ┌─────────────────────────────────────────────────────┐    │
│          │  │                                                     │    │
│ Labo     │  │          👤 (person outline icon)                   │    │
│          │  │      Không có lượt tiếp nhận phù hợp               │    │
│ Quản trị │  │  Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm        │    │
│ vận hành │  │  để xem thêm dữ liệu.                             │    │
│          │  │                                                     │    │
│ Báo cáo  │  └─────────────────────────────────────────────────────┘    │
│          │                                                             │
│ Nhân viên│  OR (when populated):                                       │
│          │                                                             │
│ Vật tư   │  ┌──────────────────────────────────────────────────────┐   │
│          │  │ SỐ PHIẾU │ BỆNH NHÂN │ BÁC SĨ │ ... │ THAO TÁC   │   │
│ Danh mục │  ├──────────────────────────────────────────────────────┤   │
│          │  │ TN-xxx   │ Name Mới  │ BS...  │ ... │ [Tiếp nhận]  │   │
│ Công cụ  │  │ TN-xxx   │ Name Cũ   │ BS...  │ ... │ [Xong] ⋮    │   │
│          │  ├──────────────────────────────────────────────────────┤   │
│ Hướng dẫn│  │ Tổng số N hồ sơ tiếp nhận  10/trang ▼   < 1 >     │   │
│ & hỗ trợ │  └──────────────────────────────────────────────────────┘   │
└──────────┴─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Header Bar (~55px height)

**Left section (inside sidebar area):**
- NFC logo icon (small blue/gold mark) — top of sidebar

**Left section (inside header, right of sidebar):**
- Sidebar toggle button — panel/layout icon, controls sidebar collapse/expand
- Clinic logo image — circular branded image (~45px), NOT a text avatar
- Clinic name — bold text (e.g. "NHA KHOA ĐỨC HẠNH PREMIUM")
- Tagline — smaller lighter text (e.g. "Kiến Tạo Nụ Cười - Giá Trị Bền Vững")

**Center section:**
- Global search — styled as button/input, placeholder "Tìm kiếm khách hàng, lịch hẹn, nhân viên...", "Ctrl K" keyboard shortcut badge on right

**Right section:**
- Branch selector — green dot indicator + branch name + dropdown chevron
- Language button — globe icon
- Notification button — bell icon with count badge
- User menu — circular avatar image + user display name + dropdown chevron

### 2. Sidebar (two states)

- Position: fixed left, full viewport height
- Background: white
- Active item: blue background highlight (#e6f4ff-ish), blue icon, blue text, rounded corners
- Inactive items: gray icon, dark text
- Bottom-pinned: "Hướng dẫn & hỗ trợ" separated from main nav

**Collapsed state (default):**
- Width: ~70-80px
- Each item: icon centered above label text, stacked vertically
- Labels: small text (~11px), may wrap to 2 lines
- No section headings

**Expanded state (via sidebar toggle button in header):**
- Width: ~180px
- Each item: icon left + label text right, horizontal layout
- Section heading "MENU" (blue uppercase, ~11px) above main nav
- Section heading "KHÁC" (blue uppercase) above bottom "Hướng dẫn & hỗ trợ"
- Top area: "NFC Dental" bold + "Phần Mềm Quản Trị Vận Hành" subtitle

**Navigation items (top to bottom):**

| # | Icon | Label (VI) | Route |
|---|------|-----------|-------|
| 1 | calendar-clipboard | Tiếp nhận | /reception |
| 2 | person | Danh sách bệnh nhân | /patient |
| 3 | calendar | Lịch hẹn | /calendar |
| 4 | people-group | CSKH - Phân nhóm | /cskh-grouping |
| 5 | flask | Labo | /labo |
| 6 | settings-sliders | Quản trị vận hành | /operations |
| 7 | bar-chart | Báo cáo | /report |
| 8 | person-badge | Nhân viên | /staff |
| 9 | package | Vật tư | /materials |
| 10 | document-list | Danh mục | /taxonomy |
| 11 | wrench | Công cụ | /tools |
| — | help-circle | Hướng dẫn & hỗ trợ | external: nfcdental.com |

### 3. Toolbar Row 1

**Left group:**
- Time period tablist: `Ngày` | `Tuần` | `Tháng`
  - Active tab: blue background (#1677ff-ish), white text, rounded pill (~60w x 32h px)
  - Inactive tabs: transparent background, dark text
- Date navigator:
  - Left chevron button (previous day/week/month)
  - Calendar icon (📅) + date text "21/08/2026" (DD/MM/YYYY)
  - Right chevron button (next day/week/month)
- Patient search: magnifying glass prefix + placeholder "Tìm bệnh nhân..."

**Right group:**
- Primary action button: clipboard/form icon (📋) + "Tạo tiếp nhận"
  - Style: blue primary button, white text, rounded, ~150w x 36h px
  - Icon is a clipboard/document icon, NOT a "+" plus sign

### 4. Toolbar Row 2 / Filter Bar

**Left group:**
- Status filter tabs:
  - `Tất cả (N)` — All — active: blue pill badge
  - `Chờ khám (N)` — Waiting
  - `Đang khám (N)` — In Progress
  - `Hoàn thành (N)` — Completed
  - Each shows count in parentheses
  - Active: solid blue pill, white text
  - Inactive: plain text, no background
- Doctor filter: combobox with magnifying glass icon + "Bác sĩ" label + dropdown chevron

**Right group — 6 Status Counter Cards:**

| # | Label (VI) | Label (EN) | Top Border Color | Number Color |
|---|-----------|-----------|-----------------|-------------|
| 1 | Đã hẹn | Scheduled | Green/teal | Green/teal |
| 2 | Đã đến | Arrived | Blue | Blue |
| 3 | Huỷ hẹn | Cancelled | Yellow/amber | Yellow/amber |
| 4 | Trễ hẹn | Late | Red/coral | Red/coral |
| 5 | Lịch tạm | Temporary | Orange | Orange |
| 6 | Chuyển đổi | Converted | Light blue | Light blue |

Card style:
- White background
- Rounded corners (~8px border-radius)
- Colored top border (~3px)
- Number displayed large and centered (bold, colored to match border)
- Label below number (smaller, gray text)
- Estimated dimensions: ~70w x 55h px
- Horizontal row, right-aligned
- Cards have subtle shadow or border

### 5. Content Area — Empty State (OBSERVED)

- Container: light blue-gray background (#f0f5ff or similar), rounded corners (~12px)
- Full width of content area with padding/margin
- Vertically centered content:
  - Person outline icon (user silhouette, blue/gray, ~48px)
  - Heading: "Không có lượt tiếp nhận phù hợp" (bold, dark text, ~16px)
  - Subtitle: "Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu." (lighter text, ~14px)
- All text centered horizontally

### 6. Content Area — Populated State (INFERRED from local implementation)

UNKNOWN_REFERENCE_BEHAVIOR — The reference showed empty state (0 receptions).
The populated table layout below is from the LOCAL implementation and has NOT
been verified against the reference.

**Table columns (local implementation):**

| # | Column Header (VI) | Column Header (EN) | Content |
|---|-------------------|-------------------|---------|
| 1 | SỐ PHIẾU | Ticket No. | TN-YYYYMMDD-NN format |
| 2 | BỆNH NHÂN | Patient | Name + "Mới"/"Cũ" badge + phone |
| 3 | BÁC SĨ TIẾP NHẬN | Receiving Doctor | Doctor name |
| 4 | NHÂN SỰ TƯ VẤN | Counselor | Staff name |
| 5 | NGUỒN TIẾP NHẬN | Source | Badge: Y tế/Tự đến/Marketing/Giới thiệu |
| 6 | TRẠNG THÁI | Status | Badge: Chờ khám/Đang khám/Hoàn thành |
| 7 | DỊCH VỤ ĐIỀU TRỊ | Treatment Services | Comma-separated service names |
| 8 | TỔNG TIỀN | Total | VND formatted (e.g. 1.500.000 đ) |
| 9 | THAO TÁC | Actions | [Tiếp nhận]/[Xong] button + ⋮ menu |

**Patient badge types (local):**
- "Mới" (New) — blue badge
- "Cũ" (Existing) — gray badge

**Source badge types (local):**
- "Y tế" — blue
- "Tự đến" — default/gray
- "Marketing" — green
- "Giới thiệu" — orange

**Status badge types (local):**
- "Chờ khám" — blue dot + blue text
- "Đang khám" — orange dot + orange text
- "Hoàn thành" — green checkmark + green text

**Action buttons (local):**
- "Tiếp nhận" — blue outlined button (shown for Chờ khám status)
- "Xong" — green solid button (shown for Đang khám status)
- ⋮ (three-dot menu) — additional actions

**Pagination (local):**
- Left: "Tổng số N hồ sơ tiếp nhận"
- Center: "10 / trang" page size dropdown
- Right: < [page numbers] > navigation

## Layout Mismatches — Reference vs Local

### MISMATCH 1: Header — Sidebar Toggle Button
- **Reference**: Has a panel/layout toggle button in the header, left of the clinic logo
- **Local**: Missing this toggle button
- **Impact**: Medium — affects sidebar collapse/expand functionality

### MISMATCH 2: Header — Clinic Logo Image
- **Reference**: Shows a circular crop of the clinic's brand logo (~45px). The full logo is a gold tooth/implant icon with "ĐỨC HẠNH — PREMIUM DENTAL CENTER" text on navy background. In the header it renders as a small circular image.
- **Local**: Uses a simple "BD" text-avatar circle as the app logo; no separate clinic logo image
- **Impact**: Medium — the header component must support an `imageUrl` for the clinic logo, not just text initials. Each clinic has its own branded logo loaded from the backend.

### MISMATCH 3: "Tạo tiếp nhận" Button Icon
- **Reference**: Uses a clipboard/document icon (📋)
- **Local**: Uses a "+" plus icon
- **Impact**: Low — visual detail, easy fix

### MISMATCH 4: Date Navigator — Calendar Icon
- **Reference**: Shows a calendar icon (📅) before the date text "21/08/2026"
- **Local**: Shows just the date text between arrows, no calendar icon
- **Impact**: Low — visual detail

### MISMATCH 5: Counter Card Colors (needs verification)
- **Reference**: Card 1 "Đã hẹn" appears to use green/teal border
- **Local**: Card 1 "Đã hẹn" appears to use blue border
- **Impact**: Low-Medium — may just be screenshot rendering; needs pixel-level comparison

### MISMATCH 6: Populated Table State
- **Reference**: NOT OBSERVED (showed empty state)
- **Local**: Shows full data table with 9 columns
- **Status**: UNKNOWN_REFERENCE_BEHAVIOR — cannot verify table column layout, row layout, action buttons, or pagination format against reference

## Dimensions (Estimated from reference at ~1920x948 viewport)

| Element | Estimated Size |
|---------|---------------|
| Sidebar width | ~70-80px (collapsed/icon mode) |
| Header height | ~55px |
| Toolbar Row 1 height | ~48px |
| Toolbar Row 2 height | ~48px |
| Content area top offset | ~155px (header + toolbar rows) |
| Content area | remaining viewport height |
| Counter card | ~70w x 55h px |
| Time tab pill | ~55w x 32h px |
| Status tab pill (active) | ~110w x 32h px |
| Patient search input | ~200w x 36h px |
| Primary button | ~150w x 40h px |
| Date navigator | ~180w x 36h px |

## Responsive Behavior

Observed viewport: ~1920x948

Previous accessibility snapshots revealed duplicate toolbar elements in the DOM,
suggesting responsive variants — different toolbar layouts rendered for
different breakpoints, with CSS showing/hiding the appropriate version.

At least 3 responsive breakpoints appear to exist for the toolbar area.

## Accessibility

- Proper landmark roles: complementary (sidebar), banner (header), main (content), navigation
- Tab lists use proper `tablist` + `tab` roles
- Buttons have descriptive labels
- Search inputs have associated labels
- Notification region with keyboard shortcut Alt+T

## Technology (Reference)

- Next.js with React Server Components (RSC)
- MongoDB (branchId is 24-char ObjectId)
- Route prefetching via RSC (`_rsc` query parameter)
