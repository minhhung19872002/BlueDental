# Patient List Page — /patient

Source: https://app.nfcdental.com/patient?branchId=<id>
Observed: 2026-08-21
Updated: 2026-08-22

## Purpose

Patient registry with full treatment history, financial summary, and appointment tracking.
Second item in sidebar navigation.

## Route

`/patient?branchId=<branchId>`

Patient detail: `/patient/:patientId?branchId=<branchId>`

Example detail URL: `/patient/6a826ca096965840407319df?branchId=6a7909122bbcbb000133e6bb`

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                    │
│           │─────────────────────────────────────────────────────────────│
│           │ TOOLBAR                                                      │
│           │ [Ngày|Tuần|Tháng]  📅 Chọn thời gian   🔍 Tìm kiếm        │
│           │                              [Xuất file]  [+ Tạo hồ sơ]    │
│           │─────────────────────────────────────────────────────────────│
│           │ FILTER ROW                                                   │
│           │ [Tất cả] [Điều trị hoàn tất] [Đang điều trị] [Chưa phát sinh]│
│           │ [🔍 Bác sĩ ▼] [🔍 Phân loại dịch vụ ▼] [🔍 Phân loại Tag ▼]│
│           │─────────────────────────────────────────────────────────────│
│           │ DATA TABLE (13 columns)                                      │
│           │ Ngày tạo | Họ tên | Ngày sinh | SĐT | Trạng thái | ...    │
│           │ ─────────────────────────────────────────────────────────── │
│           │ 17/08/26  [DH26012] - LÊ THI LIÊN  ...  Chưa phát sinh    │
│           │ 15/08/26  [DH2609] - CAO THỊ THANH... ...  Đang điều trị  │
│           │ ...                                                          │
│           │─────────────────────────────────────────────────────────────│
│           │ PAGINATION                                                   │
│           │ 20/trang ▼    Hiển thị 1-11 trên 11    < Trước [1] Sau >  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Toolbar

**Left group:**
- Time period tablist: `Ngày` | `Tuần` | `Tháng` (same styling as reception)
- Date picker button: calendar icon (📅) + "Chọn thời gian" text

**Center:**
- Search textbox: placeholder "Tìm kiếm", magnifying glass icon, type="search"

**Right group:**
- "Xuất file" button — secondary/outline style, download icon + text
  - UNKNOWN_REFERENCE_BEHAVIOR: file format (Excel/PDF/CSV) and exact behavior
- "Tạo hồ sơ" button — primary blue, plus icon + text
  - UNKNOWN_REFERENCE_BEHAVIOR: opens form — not clicked

### 2. Filter Row

**Left — Status tabs:**
| Tab label (VI) | Tab label (EN) | Note |
|---------------|---------------|------|
| Tất cả | All | No count in parentheses |
| Điều trị hoàn tất | Treatment completed | No count |
| Đang điều trị | In treatment | No count |
| Chưa phát sinh | No activity | No count |

Note: Unlike Reception page, Patient list tabs do NOT show counts.

**Right — 3 filter dropdowns:**
- "Bác sĩ" (Doctor) — with search icon, dropdown chevron
- "Phân loại dịch vụ" (Service category) — with search icon, dropdown chevron
  - UNKNOWN_REFERENCE_BEHAVIOR: available options
- "Phân loại theo Tag" (Tag category) — with search icon, dropdown chevron
  - UNKNOWN_REFERENCE_BEHAVIOR: available options

### 3. Data Table (OBSERVED — 13 columns)

| # | Header (VI) | Header (EN) | Type | Format / Notes |
|---|---|---|---|---|
| 1 | Ngày tạo hồ sơ | Record Date | Date | DD/MM/YYYY |
| 2 | Họ và tên | Full Name | Link | `[CODE] - FULL NAME` → `/patient/:id` |
| 3 | Ngày sinh | DOB | Date | DD/MM/YYYY, can be "—" when missing |
| 4 | Số điện thoại | Phone | Text | 10-digit, no formatting |
| 5 | Trạng thái | Status | Badge | Colored tag component |
| 6 | Dịch vụ | Service | Text | Service name, "—" when none |
| 7 | Bác sĩ | Doctor | Text | Doctor name (prefix BS.), "—" when none |
| 8 | Số tiền | Amount | Currency | VND dot-separated (e.g. 24.000.000) |
| 9 | Thực thu | Collected | Currency | Green text for amounts > 0 |
| 10 | Công nợ | Debt | Currency | Colored for outstanding balance |
| 11 | Lịch hẹn gần nhất | Next Appointment | DateTime | DD/MM/YYYY HH:mm |
| 12 | Lần khám cuối | Last Visit | DateTime | DD/MM/YYYY HH:mm |
| 13 | Thao tác | Actions | Buttons | Eye icon (👁) + Pencil icon (✏) |

**Table styling:**
- Header: light gray background, bold uppercase text
- Rows: white background, hover highlight
- Patient name: blue link text, bold patient code in brackets
- Status badge: rounded tag/pill
- Currency: dot-separated thousands (e.g. 24.000.000), green for positive financial amounts
- Right-aligned currency columns
- Horizontal scrolling for overflow (table is wide, 13 columns)

### 4. Patient Code Format

Pattern: `[DH{YY}{SEQ}]`
- `DH` = clinic prefix (Đức Hạnh)
- `YY` = 2-digit year (26 = 2026)
- `SEQ` = sequence number (NOT zero-padded consistently)
- Examples observed: [DH26001], [DH2609], [DH26012]

Note: Reference does not zero-pad consistently — DH2609 vs DH26012.
Each clinic likely has its own prefix.

### 5. Status Badge Mapping

| Vietnamese | English | Tag Color | Background |
|-----------|---------|-----------|------------|
| Chưa phát sinh | No Activity | Gray | Light gray |
| Đang điều trị | In Treatment | Blue | Light blue |
| Hoàn tất | Completed | Green | Light green |

### 6. Currency Format

- Vietnamese Dong (VND)
- Dot as thousands separator: 24.000.000
- No currency symbol displayed in table
- Zero displayed as "0"
- Amounts right-aligned
- Positive collected amounts in green text
- Outstanding debt in colored (likely red/orange) text

### 7. Action Buttons per Row

| Button | Icon | Style | Behavior |
|--------|------|-------|----------|
| Xem | Eye icon (👁) | Icon-only, outline | Navigate to patient detail `/patient/:id` |
| Chỉnh sửa | Pencil icon (✏) | Icon-only, outline | UNKNOWN — opens edit form (mutating, not clicked) |

### 8. Pagination

- Page size dropdown: options 5, 10, 20 (default), 25, 50, 100
- Display text: "Hiển thị {start}–{end} trên {total} bệnh nhân"
- Navigation: "Trước" (Previous) | page number buttons (1, 2, ...) | "Sau" (Next)
- Active page: blue circle/highlight
- 11 patients total observed in this clinic branch

## Observed Patient Data Characteristics

Sample data from reference (anonymized structure):
- Names: uppercase Vietnamese names (ĐỖ VĂN ANH, LÊ THỊ LIÊN, CAO THỊ THANH TUYẾT, etc.)
- Phones: 10-digit, starting with 0 (e.g. 0902xxxxxx, 0336xxxxxx)
- Doctors: prefix "BS." or "BS " (e.g. BS Hương, BS Tới)
- Services: free text (e.g. "Niềng răng mắc cài kim loại", "Cạo vôi, đánh bóng", "Nhổ răng hàm")
- Financial: amounts range from 0 to 24.000.000+ VND
- Date range: records from 2025 through 2026

## Patient Detail Page

OBSERVED — 2026-08-22. See: docs/clone/pages/patient-detail.md

Confirmed:
- URL: `/patient/:patientId?branchId=<id>&tab=<tabKey>`
- 10 tabs: Hồ sơ, Chẩn đoán & Tư vấn, Kế hoạch điều trị, Lịch hẹn, Hình ảnh, Labo, Đơn thuốc, Chăm sóc KH, Hóa đơn, Lịch sử dư nợ
- Breadcrumb navigation back to /patient list
- Financial summary (Tổng chi phí, Thực thu, Công nợ)
- 6-column appointment table (Ngày/Giờ, Bác sĩ phụ trách, Nội dung, Ghi chú, Trạng thái, Thao tác)
- 4 appointment counter cards (Đã hẹn, Đã đến, Đã huỷ, Trễ hẹn)
- Image tab with "Giai đoạn điều trị" filter dropdown

## API Observations

Reference uses Next.js RSC — no traditional REST endpoints observed.
Route prefetch: `GET /patient?branchId=<id>&_rsc=<token>` → HTTP 200

## Patient Create Form (from JS bundle analysis — CONFIRMED structure)

Opened via "Tạo hồ sơ" button. Layout: **3-column grid modal**.

### Column 1 — Contact & Source

| Field | Vietnamese | Type | Required | Validation |
|-------|-----------|------|----------|-----------|
| Patient Code | Mã khách hàng | Prefix + numeric input | No | Digits only /^\d+$/ |
| Full Name | Họ và tên | Text + "IN HOA" checkbox | Yes | max 50 chars |
| Phone | Điện thoại | Tel input | Yes | /^\d{8,15}$/, duplicate check |
| Source type | Chọn loại nguồn đến | SelectCustomAPI + "+" button | No | — |
| Channel | Kênh kết nối | SelectCustomAPI | No | Disabled until source selected |
| Created date | Ngày tạo | Read-only | — | Auto-set |
| Exam reason | Lý do đến khám | Textarea | No | max 1000 chars |

### Column 2 — Two sub-tabs: "Thông tin cơ bản" / "Tiểu sử bệnh"

**Sub-tab: Thông tin cơ bản**

| Field | Vietnamese | Type | Required | Validation |
|-------|-----------|------|----------|-----------|
| Gender | Giới tính | Radio: Nam/Nữ/Khác | No | values: male/female/other |
| Date of birth | Ngày sinh | Date picker | No | No future dates |
| Email | Email | Email input | No | valid email format |
| Notes | Ghi chú | Textarea | No | — |
| Occupation | Nghề nghiệp | SelectCustomAPI + search | No | "Khác" → free text |

**Sub-tab: Tiểu sử bệnh**
- Expandable disease history groups (checkbox tree)
- IDs stored in `diseaseHistoryIds[]`

### Column 3 — Insurance & Address

| Field | Vietnamese | Type | Required | Validation |
|-------|-----------|------|----------|-----------|
| Insurance number | Số thẻ BHYT | Text | No | min 10, max 15 chars |
| Country | Quốc gia | Fixed: "Việt Nam" | — | Disabled |
| Street | Số nhà/ Đường | Text | No | — |
| Province | Tỉnh/ Thành phố | Searchable select | No | — |
| District | Quận/ Huyện | Searchable select | No | Disabled until province |
| Ward | Xã/ Phường | Searchable select | No | Disabled until district |

### Form Footer
- Save button: "Lưu" with save icon
- Disabled when form invalid or loading

---

## Patient Tags (CONFIRMED)

Tags from API `/api/v1/patients/tags`. Sample tags for this clinic:
| Name | Color |
|------|-------|
| Chỉnh Nha | #F59E0B (amber) |
| Implant | #3B82F6 (blue) |
| Tư Vấn Chỉnh Nha | #EF4444 (red) |
| Tổng quát | #10B981 (green) |

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Tạo hồ sơ" form visual layout | Structure confirmed from JS bundle, visual not seen |
| 2 | "Xuất file" button | File export — unknown format and trigger |
| 3 | "Chỉnh sửa" (pencil) per row | Opens edit form — mutating |
| 4 | "Phân loại dịch vụ" dropdown options | Dropdown content not observed |
| 5 | "Phân loại theo Tag" dropdown options | Now known from /patients/tags API |
| 6 | "Tuần" and "Tháng" view changes | Layout change when switching time period |
| 7 | Date picker popup content | Calendar picker UI not observed |
| 8 | "Nguồn tiếp nhận" options | SelectCustomAPI content not observed |
| 9 | "Kênh kết nối" options | Depends on source type selected |
