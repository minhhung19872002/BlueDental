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
3. `AppointmentAppService.UpdateAsync` called `Reschedule` and **dropped
   `ChiefComplaint`**, and neither create nor update ever carried `Notes`. The
   booking dialog appeared to save and changed nothing. Both now go through a
   new `Appointment.SetDetails(chiefComplaint, notes, color)`.
4. The editor called `create` even in edit mode, so saving an edit **booked a
   second appointment**. It now calls `update`.
5. `Appointment` had no colour. Added `AppointmentColor` (Default / Green /
   Orange / Red) with migration `20260828090000_AddAppointmentColor`.
6. `usePrescriptionTemplateList` and `useConsultingDataList` called
   `/v1/app/prescription-templates` and `/v1/app/consulting-data`, routes that do
   not exist — both 404'd on every visit and their pickers were permanently
   empty. Both now read `/v1/app/catalog-entries` with their group, and
   `CatalogOption` carries `content` so a picked template still fills the note.

### Deliberate divergences

- **`Chi nhánh` is disabled.** The server books into the branch the session is
  scoped to (`ICurrentClinicBranchResolver`), so an enabled select would offer a
  move that could not take effect.
- **`Ghi chú` holds one note**, not a list: `Appointment.Notes` is a single
  string. `+ Thêm ngay` reveals the field; the list shape is left for when there
  is an endpoint behind it.
- **`Đổi cách xem`** is implemented as one shared lane against one lane per
  doctor. The reference's two layouts were observed only as an icon change and a
  ~200px left gutter appearing, with no appointments on the day to tell them
  apart — see `docs/clone/unknowns.md`.
- **No drag handle** on the consulting sheet: reordering advises is not
  implemented, and a handle that does nothing is worse than none.
- **`Lịch sử thay đổi`** lists the patient's appointments with the audit stamps
  the API returns. The reference reads a real `schedule-logs` collection;
  BlueDental has no per-change log yet.
