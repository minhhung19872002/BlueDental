# Patient Detail Page — /patient/:id

Source: https://app.nfcdental.com/patient/:patientId?branchId=<id>
Observed: 2026-08-28
Patient observed: existing record (identifiers omitted; no production PHI is recorded here)

## Route

`/patient/:patientId?branchId=<branchId>&tab=<tabKey>`

Tab query params (CONFIRMED from network capture + JS bundle):
- (default/none) → Hồ sơ
- `?tab=consulting` → Chẩn đoán & Tư vấn
- `?tab=treatment-plan` → Kế hoạch điều trị
- `?tab=appointment` → Lịch hẹn
- `?tab=image` → Hình ảnh
- `?tab=labo` → Labo
- `?tab=prescription` → Đơn thuốc
- `?tab=care` → Chăm sóc KH
- `?tab=invoice` → Hóa đơn
- `?tab=debt-history` → Lịch sử dư nợ

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                     │
│           │──────────────────────────────────────────────────────────── │
│           │ BREADCRUMB                                                    │
│           │ ← Quay lại  /  [PATIENT_CODE] - PATIENT_NAME                │
│           │──────────────────────────────────────────────────────────── │
│           │ TABS                                                          │
│           │ [Hồ sơ][Chẩn đoán & Tư vấn][Kế hoạch điều trị][Lịch hẹn] │
│           │ [Hình ảnh][Labo][Đơn thuốc][Chăm sóc KH][Hóa đơn]         │
│           │ [Lịch sử dư nợ]                                              │
│           │──────────────────────────────────────────────────────────── │
│           │ TAB CONTENT (varies per tab)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Breadcrumb Navigation

- Back link: "Quay lại" → `/patient?branchId=<id>`
- Separator: `/`
- Current page: `[PATIENT_CODE] - PATIENT_NAME` (patient code + full name)

## Tab List (10 tabs in order)

| # | Label (VI) | Tab Key | Status |
|---|-----------|---------|--------|
| 1 | Hồ sơ | (default) | OBSERVED |
| 2 | Chẩn đoán & Tư vấn | consulting | OBSERVED |
| 3 | Kế hoạch điều trị | treatment-plan | OBSERVED |
| 4 | Lịch hẹn | appointment | OBSERVED |
| 5 | Hình ảnh | image | OBSERVED |
| 6 | Labo | labo | OBSERVED |
| 7 | Đơn thuốc | prescription | OBSERVED |
| 8 | Chăm sóc KH | care | OBSERVED |
| 9 | Hóa đơn | invoice | OBSERVED (not implemented — "đang hoàn thiện") |
| 10 | Lịch sử dư nợ | debt-history | OBSERVED |

---

## Tab 1: Hồ sơ (Profile)

### Top card — three columns

- Left: patient code/name with edit and tag controls; date of birth + age,
  phone, email, gender, national ID, occupation, and full-width address.
- Middle: `LÝ DO ĐẾN KHÁM`, disease history, customer/national-ID information,
  and acquisition source.
- Right: `LỊCH HẸN GẦN NHẤT` with a circular create button and an empty state
  when there is no upcoming appointment.

### Financial cards

Six equal cards in one row: `Tổng dự kiến thu`, `Đã thu`,
`Dự kiến thu còn lại`, `Dư nợ`, `Phải thu`, and `Đã hoàn`.

### Treatment table

Filter pills: Tất cả, Điều trị hoàn tất, Đang điều trị, Các chẩn đoán,
Tái khám, Bảo hành. Actions: Tạo Tái khám and Thanh toán.

Columns: Ngày, Dịch vụ, Nội dung điều trị, Răng, SL, Bác sĩ điều trị,
Bác sĩ hỗ trợ, Công đoạn, Thao tác. Empty state: `Chưa có điều trị`.

---

## Tab 2: Chẩn đoán & Tư vấn (Diagnosis & Consulting)

URL: `?tab=consulting`
Status: OBSERVED

### Default layout — two-column split

- Left: fixed-width image drop/gallery area with zoom/grid/list controls.
- Right: `Tạo chẩn đoán` card. The diagnosis editor is collapsed by default;
  its plus button reveals the doctor fields, tooth chart, diagnosis and note
  controls. The diagnosis records table remains below the header.
- Full width below: `Phiếu tư vấn`, summary totals, doctor selector, and plan /
  quotation / print actions.

### Expanded diagnosis editor (hidden state)
- Header text: "Bác sĩ có trách nhiệm thông báo / Những vấn đề răng miệng đang gặp phải – Hiểu về tiến trình của bệnh lý"
- "Đóng" button (collapse panel)

**Diagnosis form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Bác sĩ chẩn đoán 1* | Combobox | Required |
| "Thêm bác sĩ chẩn đoán" | Button | Add second diagnosing doctor |
| Chẩn đoán 2 | Combobox | Optional; "Tắt Chẩn đoán 2" toggle button |

**Dental Chart (Sơ đồ răng) — interactive tooth selector:**

Chart view tabs (4):
- "Chọn Răng" (default) — select individual teeth
- "Hàm Trên" — upper jaw
- "Hàm Dưới" — lower jaw
- "Nguyên Hàm" — full jaw

Tooth type radio:
- "Răng vĩnh viễn" (Permanent teeth) — default selected
- "Răng sữa" (Baby teeth)

Tooth layout: FDI numbering system
- Upper jaw: 18, 17, 16, 15, 14, 13, 12, 11 (left half) | 21, 22, 23, 24, 25, 26, 27, 28 (right half)
- Lower jaw: 48, 47, 46, 45, 44, 43, 42, 41 (left half) | 31, 32, 33, 34, 35, 36, 37, 38 (right half)

Each tooth has:
- Tooth button (clickable) with type label ("Răng hàm" / "Răng trước") and FDI number
- 5 surface buttons around each tooth (mesial, distal, buccal, lingual, occlusal surfaces)

**Diagnosis service form (below chart):**

| Field | Type | Required |
|-------|------|----------|
| Chẩn đoán* | Combobox | Yes |
| Ghi chú | Textbox | No |
| Răng đã chọn | Display | Shows selected teeth or "Chưa chọn răng" |

Action buttons (disabled until form filled):
- "Thêm chẩn đoán"
- "Tạo dịch vụ"
- "Lưu Chẩn Đoán"

**Right column — Diagnosis records table (Phiếu chẩn đoán)**

Table columns (6):

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | Số phiếu | Diagnosis slip no. | e.g. "CD01" |
| 2 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 | Doctor name + date |
| 3 | Chẩn đoán 2 | Diagnosis 2 | Doctor name + date (or "Chưa cập nhật") |
| 4 | Răng | Tooth(teeth) | e.g. "Nguyên hàm" + diagnosis label |
| 5 | Ghi chú | Notes | Free text |
| 6 | Thao tác | Actions | "Tạo Dịch Vụ" + edit + "Xoá" |

Pagination: 20/page default; "Hiển thị 1 trên 1 chẩn đoán"

---

**Section 2: Phiếu tư vấn (Consultation slips)**

Header: "Phiếu tư vấn" button + description text:
"Bác sĩ đưa ra các phương pháp can thiệp điều trị. Từ tốt nhất để phù hợp nhất với từng vấn đề đang gặp phải"

Toolbar: "Cột hiển thị" (column visibility toggle)

Consultation table columns (14):

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | (expand) | Row expand | Toggle details |
| 2 | (checkbox) | Select | Multi-select |
| 3 | Ngày | Date | DD/MM/YYYY |
| 4 | Dịch vụ | Service | Service name |
| 5 | Chẩn đoán | Diagnosis | Tooth + diagnosis; notes in parentheses button |
| 6 | Nhân sự tư vấn 1 | Counselor 1 | Staff name |
| 7 | Nhân sự tư vấn 2 | Counselor 2 | "-" if none |
| 8 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 | |
| 9 | Chẩn đoán 2 | Diagnosis 2 | "-" if none |
| 10 | Số lượng | Quantity | Integer |
| 11 | Đơn giá | Unit price | VND |
| 12 | Giảm giá | Discount | VND |
| 13 | Thành tiền | Total | VND |
| 14 | Ghi chú tư vấn | Consultation notes | "---" if empty |
| 15 | Thao tác | Actions | "Xoá" |

Pagination: 20/page default; "Hiển thị 1 trên 1 dịch vụ"

**Summary bar (bottom):**
- "TỔNG KẾ HOẠCH"
- "Tổng thành tiền: 0 đ"
- "Tổng tiền: 0 đ"
- "Chọn bác sĩ điều trị" combobox
- Buttons: "Thêm kế hoạch điều trị", "Tạo báo giá", third button (disabled)

---

## Tab 3: Kế hoạch điều trị (Treatment Plan)

URL: `?tab=treatment-plan`
Status: OBSERVED

### Toolbar (top-right, 2 buttons)

| Button | Notes |
|--------|-------|
| Tạo kế hoạch mới | Create new treatment plan — UNKNOWN_REFERENCE_BEHAVIOR (not clicked) |
| Xem tất cả dịch vụ | View all services |

### Summary widgets (2 cards above table)

**Card 1: Dịch vụ đang điều trị** (Services under treatment)
- Count badge: "1"
- Shows: service name + patient code + date
- Shows a count and the current in-treatment services.

**Card 2: Dịch vụ có công đoạn gần nhất** (Service with most recent step)
- Shows: service name + plan code + step description
- Shows the most recently staged service, or an empty state.

### Treatment Plan Table

Toolbar: "Cột hiển thị" (column visibility toggle)

Table columns (14):

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | Thêm công đoạn | Add step | Button to add treatment step |
| 2 | Số phiếu | Plan slip no. | e.g. "DT01" — clickable |
| 3 | (unnamed) | Service name | Expand/info icon |
| 4 | Bác sĩ tiếp nhận | Receiving doctor | |
| 5 | Trạng thái - Tiến độ | Status - Progress | e.g. "Đang điều trị" |
| 6 | Ngày tạo | Created date | DD/MM/YYYY |
| 7 | Tổng phiếu | Plan total | VND |
| 8 | Giảm giá | Discount | VND |
| 9 | Thành tiền | Final amount | VND |
| 10 | Đã trả | Paid | VND |
| 11 | Hoàn tiền | Refunded | VND |
| 12 | Còn lại | Remaining | VND |
| 13 | Phải thu | To collect | VND |
| 14 | Thao tác | Actions | 2 icon buttons |

Pagination: 20/page default; "Hiển thị 1 trên 1 kế hoạch"

---

## Tab 4: Lịch hẹn (Appointments)

URL: `?tab=appointment`
Screenshot: reference-private/survey/patient-detail-appointment.png

### Counter Cards (4 cards, top of tab)

| Card | Vietnamese | Value observed |
|------|-----------|----------------|
| 1 | Đã hẹn | 0 |
| 2 | Đã đến | 0 |
| 3 | Đã huỷ | 0 |
| 4 | Trễ hẹn | 0 |

### Toolbar Buttons (top right)

| Button | Style | Notes |
|--------|-------|-------|
| Lịch sử thay đổi | Secondary/outline | View change history |
| Tạo lịch hẹn mới | Primary blue | UNKNOWN_REFERENCE_BEHAVIOR — opens create form |

### Table Columns (6 columns)

| # | Column Header (VI) | Notes |
|---|-------------------|-------|
| 1 | Ngày/ Giờ | Date + time of appointment |
| 2 | Bác sĩ phụ trách | Assigned doctor |
| 3 | Nội dung | Appointment content/purpose |
| 4 | Ghi chú | Notes |
| 5 | Trạng thái | Status badge |
| 6 | Thao tác | Action buttons |

Empty state: "Không có dữ liệu"

### Pagination

Options: 5, 10, 20 (default), 25, 50, 100 per page
Text: "Hiển thị 0 trên 0 lịch hẹn"

---

## Tab 5: Hình ảnh (Images)

URL: `?tab=image`
Screenshot: reference-private/survey/patient-detail-image.png

### Toolbar

| Control | Type | Notes |
|---------|------|-------|
| Giai đoạn điều trị | Combobox/dropdown | Filter by treatment phase |
| Tải ảnh | Button | Upload image — UNKNOWN_REFERENCE_BEHAVIOR (mutating — not clicked) |

### Content Area

Empty state text: "Không có ảnh trong bộ lọc đã chọn"
Empty state subtext: "Hãy đổi bộ lọc hoặc tải thêm ảnh để tiếp tục."

Image gallery layout when populated: UNKNOWN_REFERENCE_BEHAVIOR

---

---

## Tab 6: Labo

URL: `?tab=labo`
API: `GET /api/v1/clinic-orders?patientId=...&branchId=...&page=1&perPage=20&orderBy=createdAt:desc`
Status API: `GET /api/v1/clinic-order-status?patientId=...&branchId=...`

### Counter Buttons (3, top-left — function as filter + count display)

| Label (VI) | API field | Color |
|-----------|-----------|-------|
| {N} Đơn hàng mới | `created` | Green |
| {N} Tiếp tục công đoạn | `continue` | Orange |
| {N} Bảo hành | `guarantee` | Red/Pink |

Total count from API: `{ created: 0, guarantee: 0, continue: 0, total: 0 }`

### Toolbar (top-right)

| Button | Style |
|--------|-------|
| Tạo phiếu Labo | Primary blue with icon — UNKNOWN_REFERENCE_BEHAVIOR (form not opened) |

### Table Columns (10 columns)

| # | Column Header (VI) | Notes |
|---|-------------------|-------|
| 1 | Mã phiếu labo | Labo order code |
| 2 | Ngày gửi / Tình trạng mẫu | Send date + sample status |
| 3 | Ngày giao / Trạng thái Labo | Delivery date + labo status |
| 4 | Bác sĩ chỉ định | Prescribing doctor |
| 5 | Nhà cung cấp | Supplier/Lab name |
| 6 | Vật liệu | Material type |
| 7 | Số răng | Tooth number(s) |
| 8 | Số lượng | Quantity |
| 9 | File Labo gửi về | Returned file from lab |
| 10 | Thao tác | Action buttons |

Empty state: "Không có dữ liệu"

### Pagination

Options: 5, 10, 20 (default), 25, 50, 100 per page
Text: "Hiển thị 0 trên 0 phiếu labo"

---

## Tab 7: Đơn thuốc (Prescriptions)

URL: `?tab=prescription`

### Toolbar
| Control | Type |
|---------|------|
| Tạo đơn thuốc | Button (primary) |

### Table Columns (6 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Mã đơn thuốc | Prescription code |
| 2 | Bác sĩ | Doctor |
| 3 | Chẩn đoán | Diagnosis |
| 4 | Tái khám | Follow-up date |
| 5 | Ngày tạo | Created date |
| 6 | Thao tác | Actions |

Empty state: "Không có dữ liệu"
Pagination text: "Hiển thị 0 trên 0"

---

## Tab 8: Chăm sóc KH (Customer Care)

URL: `?tab=care`

### Top Summary Bar — Care Status Counters (8 filter buttons)

| # | Button (VI) | English |
|---|------------|---------|
| 1 | N Đã chăm sóc | N Cared for |
| 2 | N Tốt | N Good |
| 3 | N Khá | N Fairly good |
| 4 | N Bình thường | N Normal |
| 5 | N Khiếu nại | N Complaints |
| 6 | N Đặc biệt | N Special |
| 7 | N Định kỳ | N Periodic |
| 8 | N Cơ bản | N Basic |

Button top-right: "CSKH đặc biệt" — UNKNOWN_REFERENCE_BEHAVIOR

### Table Columns (9 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày chăm sóc | Care date |
| 2 | Trạng thái CSKH | Care status |
| 3 | Nhóm | Group/category |
| 4 | Dịch vụ | Service |
| 5 | Nội dung | Content (with "Chi tiết" expand button) |
| 6 | Bác sĩ điều trị | Treating doctor |
| 7 | Nhân viên chăm sóc | Care staff |
| 8 | Đánh giá | Rating |
| 9 | Thao tác | Actions (Chỉnh sửa + Xoá) |

Pagination text: "Hiển thị N–N trên N nhật ký"

**Care groups (Nhóm) observed from real data:**
- Chúc mừng sinh nhật (Birthday greeting)
- Nhắc lịch hẹn (Appointment reminder)
- Sau điều trị (Post-treatment)

**Care status values observed:**
- Chưa chăm sóc (Not yet cared for)
- (Others: Đã chăm sóc presumed)

**Rating values (Đánh giá) observed:**
- Khá (Fairly good)
- (Others: Tốt, Bình thường, Khiếu nại, Đặc biệt, Định kỳ, Cơ bản)

---

## Tab 9: Hóa đơn (Invoices)

URL: `?tab=invoice`

**State observed**: "Nội dung đang được hoàn thiện." — feature not yet implemented in production.

---

## Tab 10: Lịch sử dư nợ (Debt History)

URL: `?tab=debt-history`

Note: URL param is `debt-history`, not `debt`.

### Table Columns (5 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày giao dịch | Transaction date |
| 2 | Loại | Type |
| 3 | Số tiền | Amount |
| 4 | Nhân viên | Staff |
| 5 | Ghi chú | Notes |

Empty state: "Chưa có lịch sử dư nợ"
Pagination text: "Hiển thị 0 trên 0 giao dịch"

---

## UNKNOWN_REFERENCE_BEHAVIOR Summary

| # | Item | Reason |
|---|------|--------|
| 1 | Tab 2 (Chẩn đoán) "Tạo Dịch Vụ" button in diagnosis row | Would create a service — mutating |
| 2 | Tab 2 (Tư vấn) expanded row content | Not clicked |
| 3 | Tab 3 "Tạo kế hoạch mới" form fields | Form not opened — mutating |
| 4 | Tab 3 "Thêm công đoạn" button action | Not clicked — mutating |
| 5 | Tab 3 "DT01" plan slip click — detail view | Not clicked (read-only observation only) |
| 3 | Edit patient button | Mutating — not clicked |
| 4 | "Tạo lịch hẹn mới" form fields | Form not opened |
| 5 | "Tải ảnh" behavior | File upload — mutating |
| 6 | "Lịch sử thay đổi" modal content | Not clicked |
| 7 | Image gallery layout | No images to observe |
| 8 | Dental chart SVG in tab 2 | Not captured in snapshot |
| 9 | "Tạo phiếu Labo" form fields | Form not opened |
| 10 | Labo row action buttons | No data rows to observe |
| 11 | "Tạo đơn thuốc" form fields | Form not opened |
| 12 | "CSKH đặc biệt" button behavior | Not clicked |
| 13 | Hóa đơn tab actual content | Feature not yet implemented ("đang hoàn thiện") |
| 14 | Debt history transaction types (Loại column) | No data rows |

---

## Survey pass 2026-08-28 — what still differs

Reference re-surveyed read-only on a patient with real treatment data.
Screenshots in `reference-private/survey-patient/`.

### Fixed in this pass

- **The app did not build.** `AppointmentEditorModal` had been deleted while six
  files still imported it — Dashboard, the appointment calendar and list, and
  two patient-detail tabs. Restored, and given the prefill props those callers
  were already passing (`initialPatientId`, `initialDoctorId`, `initialEndTime`,
  `initialReason`, `initialNotes`). It now seeds the form **on open** rather
  than once at mount, so reopening it for a different patient or slot no longer
  shows whichever one it saw first — `initialTime` was declared and dropped on
  the floor before this.
- **Lý do đến khám** stated its three notes as stacked label-over-value with
  BlueDental's own wording. The reference writes them on one line in its own
  words: `Tiểu sử bệnh:`, `Về KH:`, `Nguồn đến:`. Matched, and the reason
  itself now carries the accent the reference gives it.
- **Lịch hẹn gần nhất** showed a compact block and, worse, filtered to
  *future* appointments only — so the card was empty for every patient between
  visits. The reference asks for `/schedules/latest` (ascending, no date
  filter) and shows the nearest appointment whether or not it has passed. Now
  matched, laid out as labelled rows (Ngày / Giờ hẹn / Bác sĩ / Nội dung) with
  the **Tiếp nhận** stepper under it: Đã đến → Đang khám → Hoàn tất.

### Reference layout, for the record

| Area | What it holds |
|------|---------------|
| Header | `‹ Quay lại / [code] - NAME`, and on the right a two-way switch: **Chi tiết hồ sơ** (the tabbed detail) / **Bệnh án** |
| Tabs (10) | Hồ sơ · Chẩn đoán & Tư vấn · Kế hoạch điều trị · Lịch hẹn · Hình ảnh · Labo · Đơn thuốc · Chăm sóc KH · Hóa đơn · Lịch sử dư nợ |
| Hồ sơ | Identity card · Lý do đến khám · Lịch hẹn gần nhất; six money tiles; a treatment table under six filter chips |
| Endpoints | `GET /v1/patients/{id}`, `/v1/schedules/latest`, `/v1/patient-timeline`, `/v1/staff/list?isDoctor=true` |

The treatment table is fed by `patient-timeline`, whose rows are **treatment
stages**, not service lines: `patientTreatment.code` gives the `DT…` shown,
`note` carries the stage names that fill "Nội dung điều trị", and
`treatmentService.serviceStages` is that service's own stage list — confirming
công đoạn are per-service and declared in Danh mục → Dịch vụ.

### Still to build

1. **Bệnh án** — a whole second view behind the header switch: a "Mục lục bệnh
   án" index of numbered form templates (Bia hồ sơ, Bệnh án ngoại trú RHM, Bệnh
   án chỉnh nha, Phiếu tư vấn tổng quát, …), each with `+ Thêm`, an A4 canvas,
   and a bottom bar of `Từng phiếu` / `Toàn bộ`, zoom, `In biểu mẫu`, `Lưu`.
2. **Chăm sóc sau điều trị** column on the Hồ sơ treatment table. Left out
   rather than faked: it needs care records tied to a treatment stage
   (`care.status` / `stageIds` on the reference's timeline row), which
   BlueDental does not model yet — a column that could only ever say
   "Chưa chăm sóc" would state something it cannot know.
3. **Date on the visit reason.** The reference dates that line from the visit
   that raised it; BlueDental keeps the reason on the patient with no date of
   its own.
4. **Tiếp nhận times.** The three steps draw `--:--`: an appointment records
   when it was booked for, not when the patient walked in. The reference fills
   these from reception.
5. **Bác sĩ select** under the stepper — it reassigns the visit's doctor on the
   reference; left out until there is an endpoint behind it.
6. The remaining tabs were surveyed only far enough to map them; Chẩn đoán &
   Tư vấn in particular is large (image dropzone with three view modes, a
   diagnosis table with per-row `Tạo Dịch Vụ`, an advise table with drag
   handles and column settings, and a totals footer with a %/VNĐ discount
   toggle, `Thêm kế hoạch điều trị` and `Tạo báo giá`).

---

## Survey pass 2026-08-28 (2) — Tạo lịch hẹn, Chẩn đoán & Tư vấn, table chrome

Observed read-only against
`https://app.nfcdental.com/patient/<id>?branchId=<id>&tab=appointment|consulting`.
Screenshots and network captures stay in `reference-private/survey-patient/`.

### 1. Lịch hẹn tab

| Area | Reference |
|------|-----------|
| Counters | Four chips, left: `Đã hẹn` (blue), `Đã đến` (green), `Đã huỷ` (red), `Trễ hẹn` (amber) |
| Commands | `Lịch sử thay đổi` (outline, history icon), `Tạo lịch hẹn mới` (primary, calendar icon) |
| Columns | Ngày/ Giờ · Bác sĩ phụ trách · Nội dung · Ghi chú · Trạng thái · Thao tác |
| Empty | `Không có dữ liệu`, then `20 / trang` + `Hiển thị 0 trên 0 lịch hẹn` + Trước/Sau |

Endpoints the tab loads:

```
GET /api/v1/schedules?patientId=&branchId=&page=1&take=20&sortBy=startTime&sortDirection=desc&rootSchedule=true
GET /api/v1/schedules/schedule_stats?patientId=&branchId=&rootSchedule=true&startTime=2000-01-01&toTime=2099-12-31
GET /api/v1/schedules/stats-by-time?...&dataType=logs
GET /api/v1/schedule-logs?patientId=&page=1&take=20&fromDate=&toDate=
GET /api/v1/schedule-logs/stats?patientId=&fromDate=&toDate=
```

### 2. "Tạo lịch hẹn" dialog

Title is **Tạo lịch hẹn** (not "… mới"); the trigger button is the one that says
"mới". Shell measured at **1240 × 857**, radius 16, header 61px, scrolling body,
footer 69px with a single right-aligned `Lưu` carrying a save icon.
**No cancel button** — the X is the only way out.

Body is `flex flex-col gap-5`: a `grid-cols-3 gap-5` form (three 382px columns,
each `space-y-3`) over a bordered `rounded-xl … p-4` agenda card.

| Column | Fields |
|--------|--------|
| 1 | `Chọn bệnh nhân*` (floating-label select, **disabled** when opened from a patient) · `Chi nhánh` · `Ngày hẹn` (masked DD/MM/YYYY + calendar popover) · `Giờ hẹn` (HH:mm + clock popover) and `Phút` (duration, defaults 30) side by side |
| 2 | `Chọn bác sĩ*` (search select, magnifier prefix; its panel has a `Tìm kiếm` box then plain names) · `Nội dung đặt lịch` (textarea, `min-h-16`) · `Màu lịch hẹn` |
| 3 | `Ghi chú` card: title, `+ Thêm ngay` link, body `Chưa có ghi chú` |

`Màu lịch hẹn` — four 36px circles, `border-2`, unselected `opacity-80`,
selected `scale-110 ring-2 ring-offset-1`:

| title | fill | border |
|-------|------|--------|
| Mặc định | `#E3F2FD` | `#1565C0` |
| Xanh lá | `#E8F5E9` | `#2E7D32` |
| Cam | `#FFF3E0` | `#EF6C00` |
| Đỏ | `#FFEBEE` | `#C62828` |

**Lịch đã hẹn** — the branch's whole diary, not the patient's:

- Header: `h3` 15px/600 plus a 36px round `Đổi cách xem` button (day mode only),
  then `Ngày | Tuần | Tháng` (h-10, radius 8, p-1, border `#DCE3EE`) and a
  `‹ [calendar] date ›` nav in a 230px-min bordered group.
- Body: `h-[460px] overflow-auto rounded-lg border`.
- **Ngày**: horizontal axis 06:00 → 24:00, 60px per half hour (2160px wide),
  sticky tick row; empty reads `Chưa có lịch hẹn ngày DD/MM/YYYY`.
  `Đổi cách xem` swaps to a layout with a ~200px label gutter down the left.
- **Tuần**: seven columns, day number over `Thứ 2 … Chủ nhật`; today's column is
  blue with an underline; an empty day shows a dashed placeholder box. Range
  label `24/08 - 30/08/2026`.
- **Tháng**: 7-column grid, out-of-month days greyed on a tint; a day with
  appointments prints three tallies — `Đã đến (n)` with a green check,
  `Đã huỷ (n)` with a red slash, `Đã hẹn (n)` with a blue clock. Label `08/2026`.

Loads: `GET /api/v1/time-keepings/doctors/work-status?branchId=&date=` (the
doctor list, each row carrying `canBookAppointment`, `hasCheckedIn`, `checkIn`)
and `GET /api/v1/schedules?branchId=&page=1&take=100&startTime=&toTime=`.

### 3. Chẩn đoán & Tư vấn

Top row is a fixed ~605px band: a 350px image panel on the left, the diagnosis
card filling the rest. The consulting sheet runs full width underneath and the
page scrolls.

**The three buttons over the drop zone** (36px, stacked, 4px apart, dark navy):

| aria-label | Behaviour |
|------------|-----------|
| `Thêm ảnh` | Opens the OS file chooser directly |
| `Danh sách ảnh` | Dialog **Chọn ảnh hiển thị** — grid of the patient's images, footer `Chọn tất cả` + `Xong`, empty `Chưa có ảnh nào.` |
| `Danh mục` | Popover **Dữ liệu tư vấn**, from `GET /api/v1/taxonomy/?group=consulting_data&perPage=20&branchId=`, empty `Không có danh mục.` |

**Tạo chẩn đoán** card — title plus a round `+`, and on the right two blue lines:
`Bác sĩ có trách nhiệm thông báo` /
`Những vấn đề răng miệng đang gặp phải – Hiểu về tiến trình của bệnh lý`.

Columns: `Số phiếu` (blue) · `Bác sĩ chẩn đoán 1` (name over date) ·
`Chẩn đoán 2` (second doctor, or **`Chưa cập nhật` in red**, over date) ·
`Răng` (teeth in blue over the diagnosis name) · `Ghi chú` · `Thao tác`
(`Tạo Dịch Vụ` primary, a calendar icon, a red trash).

`GET /api/v1/patient-diagnoses?patientId=&page=1&take=20` returns
`{ id, patientId, staffId, staffSecondId, diagnosisId, content:[{code,selected}],
note, code, status, hasTreatmentService, staff{id,name,isResigned}, staffSecond,
diagnosis{id,name,isDeleted,content} }`.

**Phiếu tư vấn** card — a primary `Phiếu tư vấn` button on the left, blue helper
text centred, then a right-aligned `Cột hiển thị` on its own row. That opens
**Cấu hình cột**: a scrollable list of drag handle + label + toggle rows with a
full-width blue `Lưu`.

Thirteen columns: [drag] [checkbox] `Ngày` · `Dịch vụ` · `Chẩn đoán` ·
`Nhân sự tư vấn 1` · `Nhân sự tư vấn 2` · `Bác sĩ chẩn đoán 1` · `Chẩn đoán 2` ·
`Số lượng` · `Đơn giá` · `Giảm giá` · `Thành tiền` · `Ghi chú tư vấn` ·
`Thao tác`. Empty reads `Chưa có kế hoạch`; the pager says
`Hiển thị 0 trên 0 dịch vụ`.

Footer **TỔNG KẾ HOẠCH**, in the right half of the card, one fact per line:
`Tổng thành tiền` · `Giảm giá:` with a `%` / `VNĐ` toggle and a number box ·
`Tổng giảm giá` and `Tổng tiền` on one line · then a `Chọn bác sĩ điều trị`
select, `+ Thêm kế hoạch điều trị`, `+ Tạo báo giá` (primary) and a print icon.

Loads: `patient-images`, `patient-diagnoses`, `patient-advises?…status=created
&sortBy=sortOrder&sortDirection=asc`, `advise-groups`, `voucher/available`.

### 4. Table chrome

Every table's scroller in the reference is
`relative w-full min-h-0 flex-1 overflow-auto`, with `sticky top-0` headers —
the same shape as BlueDental's own `.bd-cat-card`.

---

## What BlueDental now does

### Applied

- **`.pd-page` owns the viewport height** (`calc(100vh - header - 32px)`,
  `overflow: hidden`), `.pd-pane` is the scrolling pane, and `.pd-pane--fill`
  hands the height down to the card. Every table tab — Chẩn đoán & Tư vấn, Kế
  hoạch điều trị, Lịch hẹn, Hình ảnh, Labo, Đơn thuốc, Chăm sóc KH, Hóa đơn,
  Lịch sử dư nợ — now uses the app's own `.bd-cat-card`, so the header stays
  put, the rows scroll and the pager sits on the card's bottom edge **even with
  no rows**. The bespoke `.pd-table-card` chrome is gone from those tabs.
- **Tạo lịch hẹn** rebuilt to the layout above, including the colour swatches,
  the note card and the three-mode agenda drawn from the branch's real diary.
- **Chẩn đoán & Tư vấn** rebuilt: the three image commands with the reference's
  labels and dialogs, the paired-fact diagnosis columns with their three row
  actions, the thirteen-column consulting sheet behind `Cấu hình cột`, and the
  TỔNG KẾ HOẠCH block with its %/VNĐ toggle and four commands.

### Backend defects this pass turned up

1. `PatientDiagnosisDto.StaffName` and `DiagnosisName` were declared and **never
   filled**, so `Bác sĩ chẩn đoán 1`, `Chẩn đoán 2` and the diagnosis name under
   `Răng` always read an em dash. Now resolved in one read per kind, alongside a
   new `SecondStaffName`.
2. `PatientAdviseDto` likewise: `ServiceName` and `StaffName` unfilled, and no
   `SecondStaffName` or `DiagnosisName` at all — four of the reference's columns
   could not be drawn. Fixed the same way.
3. `usePrescriptionTemplateList` and `useConsultingDataList` called
   `/v1/app/prescription-templates` and `/v1/app/consulting-data`, routes that do
   not exist — both 404'd on every visit and their pickers were permanently
   empty. Both now read `/v1/app/catalog-entries` with their group, and
   `CatalogOption` carries `content` so a picked template still fills the note.

### Superseded by main (rebase 2026-08-31)

Three more defects were found and fixed on this branch, then **dropped when it
was rebased onto `main`** — `main` had solved all three independently, and
better:

- `AppointmentAppService.UpdateAsync` dropped `ChiefComplaint`, and neither
  create nor update carried `Notes`. `main` now routes both through
  `Appointment.UpdateDetails(chiefComplaint, notes, color)`.
- The editor called `create` even in edit mode, so saving an edit booked a
  second appointment. `main`'s editor branches on `appointmentId`.
- The appointment had no colour. This branch added an `AppointmentColor` enum
  and migration `20260828090000_AddAppointmentColor`; `main` had already added
  `Color` as a **nullable `varchar(20)`** in `20260829173829_AddAppointmentColor`,
  which is the shape that survives. The swatch key travels as the stored string.

The whole booking dialog likewise came from `main`
(`AppointmentEditorModal` + `AppointmentFormLeft/Center/Right` +
`AppointmentColorPicker` + `AppointmentMiniCalendar`), so this branch's own
`AppointmentAgenda` and `appointment.css` were deleted rather than merged. Two
optional props were added to `main`'s dialog for the patient screen:
`initialPatientId` / `initialReason` seed it, and `lockPatient` greys the
patient field out the way the reference greys it.

`main`'s day view also answers the `Đổi cách xem` question this branch had
logged as unknown: it toggles between "Xem theo giờ" and "Xem theo bác sĩ".

### Deliberate divergences

- **No drag handle** on the consulting sheet: reordering advises is not
  implemented, and a handle that does nothing is worse than none.
- **`Lịch sử thay đổi`** lists the patient's appointments with the audit stamps
  the API returns. The reference reads a real `schedule-logs` collection;
  BlueDental has no per-change log yet.

---

## Survey pass 2026-08-31 — the whole record, tab by tab

Every one of the ten tabs was captured on the reference at 1600×900 and set
beside the local screen. Captures are in `reference-private/survey-patient/`.

### Header

The tab row is a flat 40px row, not pills: `padding: 2px 16px`, `14px/600`,
inactive `#475569`, active `#2671D8` on `#E7F0FB` with a 2px `#1B2A41` rule
under it. On its right sits a two-way switch, 125×32, radius 6, `13px/500`:
**Chi tiết hồ sơ** / **Bệnh án**. Both are now built; the view rides in the URL
as `?view=medical-record`, so a bệnh án can be linked to.

### Bệnh án

| Area | Reference |
|------|-----------|
| Left | Card "Mục lục bệnh án" / "N biểu mẫu", then nine numbered rows, each a tinted card with an icon chip and a coloured `+ Thêm` |
| Right | The sheet being worked on; empty reads `Chưa có phiếu bệnh án. Chọn "Thêm" ở mục lục để tạo phiếu mới.` |
| Bottom | `Từng phiếu` / `Toàn bộ` · `Zoom` − 100% + · `In biểu mẫu` · `Đồng bộ phiếu` · `Lưu` |

The nine forms, with the tint / accent / icon background measured off the
reference's own computed styles (rows 8 and 9 repeat rows 1 and 2):

| # | Form | tint | accent |
|---|------|------|--------|
| 1 | Bìa hồ sơ bệnh án | `#F4F8FF` | `#3075CC` |
| 2 | Bệnh án ngoại trú Răng Hàm Mặt | `#F0FBF9` | `#22B5A6` |
| 3 | Bệnh án chỉnh nha | `#FFF7F1` | `#D97A40` |
| 4 | Phiếu Tư Vấn Tổng Quát | `#FAF6FF` | `#A174E0` |
| 5 | Phiếu tư vấn và xác nhận đồng ý điều trị | `#FFF9EF` | `#E2A32A` |
| 6 | Giấy đồng ý thực hiện phẫu thuật/thủ thuật | `#F2FCF5` | `#18AA65` |
| 7 | Phiếu phẫu thuật/thủ thuật | `#FFF5F7` | `#F05D79` |
| 8 | Phiếu theo dõi điều trị | `#F4F8FF` | `#3075CC` |
| 9 | Phiếu chăm sóc | `#F0FBF9` | `#22B5A6` |

Reads `GET /api/v1/patient-medical-record/files/{patientId}`, which answers a
list of *files* — several sheets of the same form may sit on one record.

### Kế hoạch điều trị

Two commands: `+ Tạo kế hoạch mới` (primary) and `👁 Xem tất cả dịch vụ`
(outlined, eye icon). Then two summary cards, each a tinted icon chip, an
UPPERCASE title with its detail under it, and the count as a round red badge on
the far right: `DỊCH VỤ ĐANG ĐIỀU TRỊ` and `DỊCH VỤ CÓ CÔNG ĐOẠN GẦN NHẤT`.
`Cột hiển thị` sits right-aligned above the table.

### The remaining tabs

| Tab | Reference | Local |
|---|---|---|
| Hình ảnh | `Giai đoạn điều trị` select + `Tải ảnh`; dashed gallery card, "Không có ảnh trong bộ lọc đã chọn" | matches |
| Labo | three chips (Đơn hàng mới / Tiếp tục công đoạn / Bảo hành), `Tạo phiếu Labo`, ten columns | matches |
| Đơn thuốc | `+ Tạo đơn thuốc`; Mã đơn thuốc · Bác sĩ · Chẩn đoán · Tái khám · Ngày tạo · Thao tác | matches |
| Chăm sóc KH | eight chips, `+ CSKH đặc biệt`, nine columns, pager counts "nhật ký" | matches |
| Lịch sử dư nợ | Ngày giao dịch · Loại · Số tiền · Nhân viên · Ghi chú | matches |
| **Hóa đơn** | **`Nội dung đang được hoàn thiện.`** — not built on the reference | BlueDental already has a real invoice table, so it is **ahead**; left as it is |

---

## What BlueDental now does (pass 2)

### Bệnh án — built end to end

- New aggregate `PatientMedicalRecord` (patient, branch, form, title, sort
  order, JSON content) with `MedicalRecordForm` naming the nine printed forms,
  migration `20260831060000_AddPatientMedicalRecord`, an app service and an
  explicit controller at `api/v1/app/patient-medical-records`.
- A new ability subject `patientMedicalRecord` (read/create/update/delete/print)
  in the catalog and in the role-permission tree.
- The view reuses what the app already has rather than growing a second
  implementation: **`MedicalRecordSheet`** — the A4 form Danh mục draws for
  "Bệnh án mẫu" — plus `SegmentedTabs` and `ConfirmDeleteDialog`.
- Only the filled cells are stored. The printed layout lives on the client, so
  changing a form never migrates anyone's record.

### Everything else

- The tab row is the reference's flat row, scoped to this page so the shared
  pill switcher used by Danh mục and Labo is untouched.
- Kế hoạch điều trị's summary cards rebuilt to the reference's shape; the eye
  icon added to `Xem tất cả dịch vụ`.
- Chăm sóc KH's pager counts "nhật ký", as the reference counts them.

### Still divergent, on purpose

1. **Only form 2 is drawn to the reference's layout.** "Bệnh án ngoại trú Răng
   Hàm Mặt" is the one printed form BlueDental has, because it is the one Danh
   mục already builds. The other eight could only have been seen by pressing
   "Thêm" on the reference, which writes, so their layouts were never observed
   and are not reproduced. Adding one of them opens a plain A4 sheet of the
   clinic's own instead — the form's title, a ruled body, and a
   "Bắt đầu từ mẫu" picker that drops in one of the clinic's own
   **Danh mục → Bệnh án mẫu** entries. Every index row therefore produces a
   sheet that can be written on and saved; none of them claims to be the
   reference's printed form.
2. **No `Đồng bộ phiếu`.** The reference's button copies patient details into
   the sheet's header cells. What it copies was not observed, so it is left out
   rather than guessed — see `docs/clone/unknowns.md`.
3. **Table headers are uppercase.** `index.css` uppercases every table header in
   the app; the reference uses sentence case at 14px/500. Changing it would
   touch every screen including the frozen `/taxonomy`, so it is left alone and
   noted here.
4. **The tab row wears the app's pills.** The reference draws a flat underlined
   row here. BlueDental switches screens with pills everywhere else — Danh mục,
   Labo, Vật tư — and staying consistent inside the application was chosen over
   matching the reference on this one row. It sits on the same white strip
   `/materials` uses, sharing the card with the Chi tiết hồ sơ / Bệnh án switch.
5. **Hình ảnh fills the tab.** The reference's gallery is a short box with white
   space under it; here it takes the rest of the screen, which is what was asked
   for and what every other tab now does.
6. **`Chăm sóc sau điều trị`** column on the Hồ sơ table still needs care
   records tied to a treatment stage, which BlueDental does not model. A column
   that could only ever say "Chưa chăm sóc" would state something it cannot know.
7. **Hóa đơn** is ahead of the reference, not behind it.

### The hồ sơ dialog

`Chỉnh sửa hồ sơ` on the record opens the **same** `PatientEditorDialog` the
list opens — one dialog, 1240px, seventeen fields across three columns,
including **Thẻ hồ sơ**. It once looked like a different screen here: the
dialog's styling lives in `patient-management/components/patient.css`, which
only `PatientManagementPage` imported, so opening it from a record produced an
unstyled form whose tag field was invisible. The dialog imports its own
stylesheet now. `patient.spec.ts › the record opens the same hồ sơ dialog the
list opens` holds the two entry points to the same field list.

Beside the patient's name sits the tag chip: 32×24, `#E7F0FB` on `#2671D8`,
4px radius, no border — measured off the reference's computed styles.

---

## Survey pass 2026-08-31 (tối) — Bệnh án, đọc từ phiếu thật

Lần khảo sát trước tôi ghi "tám biểu mẫu không quan sát được vì bấm *Thêm* là
ghi". Nay trên bản gốc **đã có sẵn ba phiếu**, nên đọc được mà không cần ghi gì.
Toàn bộ phần dưới đây đo trên phiếu có thật, chỉ đọc.

### Mục lục — phiếu nằm **lồng trong hàng biểu mẫu**

Đây là điểm tôi dựng sai trước đó: tôi để phiếu thành hàng chip phía trên khung
giấy, còn bản gốc **nhét mỗi phiếu thành một thẻ ngay dưới biểu mẫu sinh ra nó**.

| Thành phần | Bản gốc |
|---|---|
| Panel | 320px, `rounded-xl`, viền `--bd-line`, dính `top: 132px` |
| Đầu panel | Icon + "Mục lục bệnh án" + "N biểu mẫu" (**đếm phiếu**, không phải biểu mẫu) + nút thu gọn |
| Hàng biểu mẫu | `rounded-2xl`, nền tint riêng, `padding: 8px 10px` |
| Thẻ phiếu | 268x113, `rounded-xl`, viền 2px `#D7E0ED`, nền trắng, `shadow-sm`; hover nhấc `-2px` |
| Thẻ đang mở | viền `#2671D8`, nền `#EAF2FD`, quầng `ring-2` 20% |
| Trong thẻ | chip icon 36px, tiêu đề (2 dòng, 14px/500 `#1B2A41`), huy hiệu `Bản 01` + `Tạo: dd/MM/yyyy HH:mm` |
| Huy hiệu | `#E5F0FF` trên `#1769E0`, 11px/700, bo 6px |
| Bên phải thẻ | ô tích (góc trên) và ba nút in / sửa / xoá, `#53657D` |

`Bản NN` đánh số **trong phạm vi từng biểu mẫu**, đệm hai chữ số.

Panel phải: `Bản NN` (12px/400 `#1B2A41`) trên tên biểu mẫu (16px/500 `#2671D8`).

Thanh dưới **nổi giữa trên tờ giấy**, bo tròn, có đổ bóng — không phải footer
chạy hết chiều ngang.

### Ba biểu mẫu đọc được

Bản gốc dựng mỗi tờ A4 trong **`<iframe>`** (cách ly để in). BlueDental dựng
thẳng trong trang; khác kiến trúc nhưng cùng kết quả in.

**1. Bìa hồ sơ bệnh án** — mẫu bìa chuẩn Bộ Y tế. Đếm được **20 checkbox** và
**36 ô contenteditable**:

- 2 checkbox giới tính (Nam/Nữ)
- 15 checkbox trong bảng "Phần kiểm soát", 3 checkbox ở ba dòng kết quả
- Bảng kiểm soát là **hai cột `Nội dung` / `Đầy đủ / Đạt` cạnh nhau**, mục ghép
  đôi theo hàng; ô nhãn phải để trống **vẫn có** ô tích; nhóm
  "6. Thanh toán ra viện" tích ngay trên **dòng tiêu đề** và không có mục con
- Hai cột `Số lượng (ngày)` của bảng thành phần **không điền được** — là chỗ
  trắng in ra viết tay
- Mã bệnh nhân, họ tên, ngày sinh, tuổi, địa chỉ **được mồi từ hồ sơ nhưng vẫn
  sửa được**

**4. Phiếu Tư Vấn Tổng Quát** — **không có ô nhập nào**. In ra rồi điền tay, nên
không có gì để lưu.

**2. Bệnh án ngoại trú Răng Hàm Mặt** — đã dựng từ trước, dùng chung tờ A4 mà
Danh mục vẽ cho "Bệnh án mẫu".

### BlueDental làm theo

- Mục lục dựng lại đúng: thẻ phiếu lồng trong hàng biểu mẫu, đủ huy hiệu
  `Bản NN`, ngày tạo, ô tích, in / đổi tên / xoá.
- Dựng mới `MedicalRecordCoverSheet` (biểu mẫu 1, 2 mặt, 20 ô tích) và
  `MedicalRecordConsultationSheet` (biểu mẫu 4, chỉ để in — nút **Lưu** khoá lại
  vì không có gì để lưu).
- Thanh dưới nổi giữa trên giấy như bản gốc.
- Sáu biểu mẫu còn lại vẫn mở tờ A4 trắng của phòng khám, bắt đầu được từ
  "Bệnh án mẫu" — bố cục in của chúng vẫn chưa quan sát được.

### Còn khác, có chủ ý

1. **View Bệnh án nằm trong URL của BlueDental** (`?view=medical-record`), bản
   gốc giữ nguyên `?tab=...` và không ghi view vào URL. Giữ bản của tôi: có thế
   mới gửi link thẳng tới bệnh án được, và test dựa vào đó.
2. **Không có `Đồng bộ phiếu`.** Bản gốc có nút này; nó chép thông tin bệnh nhân
   vào các ô đầu phiếu. Chép những gì thì chưa quan sát được — xem
   `docs/clone/unknowns.md`.
3. **Letterhead phòng khám để trống.** Bản gốc in tên/địa chỉ/điện thoại chi
   nhánh lên biểu mẫu 1 và 4. Lấy được dữ liệu đó phải import chéo feature
   (`organizations`), mà CLAUDE.md muc 4.2 cấm. Cần một hook dùng chung cho
   thông tin chi nhánh rồi mới nối vào — chưa làm trong đợt này.
4. **Ô tích trên thẻ phiếu** dùng để chọn phiếu đem in / xem ở chế độ "Toàn bộ".
   Bản gốc dùng nó làm gì thì chưa quan sát được; đây là suy đoán, đã ghi vào
   `unknowns.md`.

---

## Đối chiếu ảnh chụp — tab Chẩn đoán & Tư vấn (2026-08-31)

Chụp bản gốc và local **cùng khung 1920x900**, đặt cạnh nhau. Ảnh nằm trong
`reference-private/survey-patient/` (có dữ liệu bệnh nhân thật, không commit).

Lần chụp đầu tôi rơi vào một bệnh nhân **do e2e tạo** nên tab trống trơn —
danh sách sắp mới nhất trước, mà 20 bệnh nhân mới nhất đều là rác test hôm nay
(`BD260044`–`BD260055`, 0 chẩn đoán). Trong 63 bệnh nhân thì **43 có dữ liệu
lâm sàng**; seeder không thiếu. Đã chụp lại trên bệnh nhân có dữ liệu thật.

### Khớp

Panel ảnh bên trái (ba nút icon xếp dọc, vùng thả ảnh gạch đứt, đúng câu chữ),
thẻ "Tạo chẩn đoán" + nút tròn xanh, hai dòng chữ xanh bên phải, sáu cột, cụm
thao tác `Tạo Dịch Vụ` + lịch + thùng rác, nút "Phiếu tư vấn" và dòng chữ xanh
dưới cùng.

### Lệch, đã sửa

| Chỗ | Bản gốc | Local (trước) |
|---|---|---|
| Số phiếu | `#2671D8`, 14px/**700** | navy `#1c3566`, 600 |
| Răng | `#2671D8`, 14px/**700** | **không xanh được** |
| "Chưa cập nhật" | `#E5484D`, 500 | `#d4380d`, 600 |

Ô "Răng" là **lỗi độ đặc hiệu CSS**: `.pd-cell-link` đặt trên cùng thẻ `<b>` mà
`.pd-cell-stack > b` nhắm tới, mà selector sau đặc hiệu hơn (0,1,1 so với 0,1,0)
— nên màu xanh **chưa bao giờ hiện ra** kể từ khi viết.

Thêm token dùng chung `--bd-link: #2671d8` vào `:root`. Nó **không phải**
`--bd-blue` (`#1c3566`) — token kia là navy thương hiệu của app. Bản gốc dùng
`#2671D8` cho link và viền chrome đang chọn; trước đây màu này nằm rải rác dạng
hex thô trong `calendar.css`. Chỉ áp token vào **bốn chỗ đã đo được** là màu đó:
số phiếu, ô răng, tiêu đề panel phiếu bệnh án, viền thẻ phiếu đang mở, và chip
thẻ hồ sơ.

### Lệch, **không** sửa — vì thống nhất nội bộ thắng

| Chỗ | Bản gốc | BlueDental | Lý do giữ |
|---|---|---|---|
| Header bảng | `text-transform: none`, 14px/500, nền `#F6F8FB`, padding `8px 16px` | `uppercase`, 11.5px/700, nền `#FAFBFD` | `index.css` viết hoa header **toàn ứng dụng**. Sửa là đụng mọi màn, kể cả `/taxonomy` đang đóng băng |
| Phân trang | ô "20 / trang" **trước**, rồi "Hiển thị …" | "Hiển thị …" trước, rồi ô chọn | Thứ tự do AntD `showTotal`/`showSizeChanger` qua `useTablePagination` dùng chung |
| Cỡ chữ ô | 14px | 13px (dòng chính) / 12px (dòng phụ) | Cùng thang chữ với mọi bảng khác trong app |
| Hàng tab | gạch chân phẳng | pill | Đã chốt ở lần trước theo yêu cầu đồng bộ với `/materials` |

Ba dòng đầu là **một quyết định**: đổi thang chữ và kiểu header cho khớp bản gốc
thì phải đổi toàn ứng dụng. Cần anh chốt trước khi làm.

### Còn tồn — rác dữ liệu test

E2E tạo bệnh nhân mới mỗi lần chạy và **không dọn**, nên đầu danh sách bệnh nhân
ngày càng nhiều hồ sơ rỗng. Không phải lỗi sản phẩm nhưng làm demo khó xem và
làm chính việc đối chiếu ảnh bị sai lần đầu. Nên cho các spec đó dọn hồ sơ chúng
tạo ra, hoặc seed lại DB trước mỗi đợt đối chiếu.

---

## Đối chiếu cột từng tab (2026-08-31) — sau khi seed đủ dữ liệu

Trước đợt này bốn tab không so được vì local trống: **Hình ảnh** 0 dòng,
**Hóa đơn** 71 dòng nhưng dồn hết vào **một** bệnh nhân, **Labo** 5 bệnh nhân,
**Chăm sóc KH** 11. Nay cả bốn phủ **63/63** bệnh nhân chi nhánh 1.

Cột local đối chiếu với bản ghi khảo sát bản gốc ở trên:

| Tab | Bản gốc | Local | Kết quả |
|---|---|---|---|
| Labo | 3 chip + `Tạo phiếu Labo`, 10 cột | 3 chip + nút, 10 cột đúng tên | khớp |
| Đơn thuốc | Mã đơn thuốc · Bác sĩ · Chẩn đoán · Tái khám · Ngày tạo · Thao tác | y hệt | khớp |
| Chăm sóc KH | 8 chip, `CSKH đặc biệt`, 9 cột, phân trang đếm "nhật ký" | 8 chip **có số thật**, đủ nút, 9 cột, đếm "nhật ký" | khớp |
| Lịch sử dư nợ | Ngày giao dịch · Loại · Số tiền · Nhân viên · Ghi chú | y hệt | khớp |
| Hình ảnh | select `Giai đoạn điều trị` + `Tải ảnh`, thẻ gallery | y hệt, nay có ảnh thật | khớp |
| Hóa đơn | **`Nội dung đang được hoàn thiện.`** trên bản gốc | bảng thật, 7 cột | BlueDental **đi trước** |

Hai chỗ số đếm trông sai nhưng **kiểm tra ra là đúng**:

- Chip Lịch hẹn đọc `319 Đã hẹn / 80 Đã đến / 3 Đã huỷ / 4 Trễ hẹn`. Trông như
  đếm toàn chi nhánh, nhưng bệnh nhân demo này thật sự có **406 lịch hẹn**
  (319+80+3+4). Seeder lịch hẹn dồn nhiều lịch vào một hồ sơ — lệch dữ liệu,
  không phải lỗi giao diện.
- Chip CSKH từng đọc 0 hết dù có 3 dòng. Ba dòng đó do seeder cũ tạo, đều ở
  trạng thái *chưa chăm sóc* — nên **0 là đúng**. Đã xử lý ở phần seed bên dưới.

### Seed lại cho bốn tab

Seeder mới `BlueDentalPatientTabsDemoSeeder` chạy **theo từng bệnh nhân**:
3 ảnh, 2 hóa đơn (một đã thu đủ, một thu 40% để tab dư nợ có số dư), 1 phiếu
labo, 2 lượt CSKH (một đã hoàn thành và có đánh giá, một còn mở).

Hai điều đáng ghi:

1. **Ảnh phải có file thật.** `PatientImage` giữ `BlobName`; seed suông thì
   thumbnail vỡ. `DemoPngWriter` sinh PNG gradient ngay trong code (tự dựng
   IHDR/IDAT/IEND, CRC32 trên `ZLibStream`) — không commit file nhị phân, không
   thêm thư viện ảnh. Kéo theo: **DbMigrator nay phải cấu hình MinIO** như
   HttpApi.Host, nếu không `IBlobContainer` không resolve được.
2. **Phiếu labo phải trỏ vào bản ghi supplier/material**, không chỉ tên. Seeder
   cũ đã cố ý làm vậy và có comment giải thích; bản đầu của tôi để null nên cột
   Nhà cung cấp / Vật liệu ở `/labo/mau-labo` thành "—" và test canh đúng chỗ đó
   đỏ ngay.

Điều kiện idempotent kiểm **theo đúng id sẽ tạo**, không phải "bệnh nhân này đã
có bản ghi nào chưa". Hỏi kiểu sau thì bản ghi của seeder khác chặn mất seeder
này — đó chính là lý do tab CSKH của bệnh nhân demo chính vẫn đọc 0 hết. Chạy
migrator hai lần liên tiếp cho ra **đúng cùng số dòng**.

---

## Nút tag và bảng chọn tag — đo trên bản gốc (2026-09-03)

Khảo sát **chỉ đọc**: đăng nhập, mở popover, đo, đóng. **Không bấm vào tag nào**
— bấm là gắn tag thật vào hồ sơ bệnh nhân trên production.

| Thành phần | Bản gốc |
|---|---|
| Nút | `aria-label="Thêm tag"`, **32×24**, nền `#DCEBFA`, icon `#2671D8`, bo 4px, không viền |
| Bảng | **258px**, mở **dưới nút, mép trái thẳng mép nút** (không phải canh phải), hở **9px**, **không có mũi tên** |
| Ô tìm | đặt trong khối `padding: 12px`, gạch dưới `#DCE3EE`, placeholder `Tìm tag` |
| Dòng tag | cao **40px**, `padding: 8px 12px`, `gap: 8px` |
| Chip | chữ **12px/700** trắng, nền lấy theo màu tag |
| Đang gắn | có **dấu tích** ở mép phải |

BlueDental đã chỉnh theo đúng các số này: đổi `bottomRight` → `bottomLeft`, tắt
mũi tên (chính nó tạo ra khoảng hở 16px thay vì 9px), panel 258px, dòng 40px,
chip 12px/700, nút đổi nền `#e7f0fb` → `#dcebfa`.

Đo lại sau khi sửa: rộng **258** (gốc 258), hở **8** (gốc 9), lệch trái **4**
(gốc 1), dòng **40** (gốc 40).

Một điểm **bản gốc cũng bị**: ở cửa sổ hẹp, cột `Thao tác` ghim phải của bảng
che mất phần đuôi tiêu đề `Phương thức thanh toán`. Không phải chuyện BlueDental
làm sai — nên test đo phần này chạy ở khổ đủ rộng chứ không khẳng định điều mà
bản gốc cũng không giữ.

## Chẩn đoán & Tư vấn — đo lại panel ảnh và nút "+" (2026-09-03)

Khảo sát **chỉ đọc** ở 1600×950. **Không bấm nút "Thêm ảnh"** — nó mở hộp chọn
file và dẫn tới upload thật.

### Nút "Tạo chẩn đoán +"

Cả cụm là **một** `<button>` 146×28 chứa nhãn và vòng tròn:

| Phần | Bản gốc |
|---|---|
| Nhãn | **16px/700**, `#1B2A41` |
| Vòng "+" | `<span>` **28×28**, tròn, nền `#2671D8`, icon **16px** trắng |
| Thanh đầu thẻ | `sticky top-0 z-30`, nền trắng, gạch dưới `#DCE3EE`, cao 67px |

BlueDental trước đó dùng nút tròn mặc định của AntD (**32px**) nên nhìn nặng
hơn tiêu đề. Đã ép về 28px, icon 16px, và nhãn đổi 600 → **700**.

### Panel ảnh — ba nút và hành vi

| Nút | Icon | Bấm vào ra gì |
|---|---|---|
| `Thêm ảnh` | `lucide-zoom-in` | Mở hộp chọn file để tải ảnh (**không thử**) |
| `Danh sách ảnh` | `lucide-grid-2x2` | Modal **"Chọn ảnh hiển thị"**, rỗng ghi "Chưa có ảnh nào.", footer `Chọn tất cả` + `Xong` |
| `Danh mục` | `lucide-list` | Popover **"Dữ liệu tư vấn"**, rỗng ghi "Không có danh mục." |

Lưu ý: icon nút đầu là kính lúp nhưng **chức năng là tải ảnh**, không phải zoom.

| Thành phần | Bản gốc | BlueDental |
|---|---|---|
| Thẻ ảnh | 350px, trắng, viền 1px `#DCE3EE`, bo 12, đệm 8 | khớp |
| Vùng thả | `#E6EAF0`, bo 12, cao 240, rộng 332 | khớp |
| Ba nút | 36×36, `rgba(0,0,0,.8)`, bo 6, cách 4px, icon trắng | khớp |
| Chữ vùng thả | 14px/500 `#5A6B82` | khớp |

Ba hành vi và toàn bộ số đo panel ảnh **vốn đã đúng** và đã có test từ trước;
lần này chỉ nút "+" phải sửa.

### Còn khác, có chủ ý

Vòng "+" ở bản gốc là `#2671D8`; BlueDental vẽ bằng màu primary của **v2**
(indigo `#6366f1`) cho thống nhất với toàn ứng dụng sau đợt restyle. Kích thước
thì đã khớp.

### Panel ảnh — cách ảnh được chọn và xem (đo 2026-09-03)

Bên bản gốc nay đã có ảnh thật nên quan sát được đầy đủ. **Không bấm "Thêm
ảnh"** (mở hộp chọn file).

**Ngoài panel.** Ảnh được chọn xếp **dọc**, mỗi tấm bọc trong `<a>` cao 240px,
`object-fit: cover`, bo 12px, cách nhau 8px, rộng hết thẻ (332px). Bấm vào mở
**overlay xem ảnh** — bản gốc dùng lightGallery (`lg-react-element`).

**Modal "Chọn ảnh hiển thị".**

| Thành phần | Bản gốc |
|---|---|
| Modal | rộng **1024px** |
| Tiêu đề nhóm | ngày chụp, **12px/600** `#5A6B82` |
| Thẻ | **280px**, bo **22px**, đệm **12px**, nền trắng, đổ bóng `0 10px 24px rgba(15,23,42,.05)`, **viền xanh khi được chọn** |
| Ảnh trong thẻ | **254×190**, `object-fit: cover`, bo **18px** |
| Ô tích | đè lên góc trên trái của ảnh |
| Dưới ảnh | tên file, rồi `dd/MM/yyyy HH:mm` |
| Góc dưới phải | hai nút tròn: **kéo sắp xếp** và **xoá** (đỏ) |
| Footer | `Chọn tất cả` + `Xong` |

**BlueDental làm theo**, với ba điểm hành vi anh yêu cầu:

1. **Ảnh mới tải lên hiện ngay.** Trạng thái lưu là danh sách *bị ẩn*, không
   phải danh sách *được chọn* — nên một tấm vừa có là hiện luôn, không phải vào
   chọn thủ công. `Chọn tất cả` xoá sạch danh sách ẩn.
2. **Tải ảnh có loading**: nút "Thêm ảnh" quay, vùng thả đổi thành `Spin`.
3. **Bấm ảnh mở overlay**: dùng `Image.PreviewGroup` của AntD — có đếm `1 / 3`,
   nút chuyển ảnh, xoay/lật/zoom, nền mờ `rgba(0,0,0,.45)`. Dùng component sẵn
   có của app thay vì thêm lightGallery.

Nút xoá trên thẻ nối vào `useDeletePatientImage` đã có sẵn.

**Chưa làm:** nút kéo sắp xếp mới chỉ có hình. Bản gốc lưu thứ tự ở đâu thì chưa
quan sát được — ghi vào `unknowns.md`.

