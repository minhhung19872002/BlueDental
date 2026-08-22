# Patient Detail Page — /patient/:id

Source: https://app.nfcdental.com/patient/:patientId?branchId=<id>
Observed: 2026-08-22
Patient observed: DH26012 — LÊ THI LIÊN (6a826ca096965840407319df)

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
- `?tab=debt` → Lịch sử dư nợ

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                     │
│           │──────────────────────────────────────────────────────────── │
│           │ BREADCRUMB                                                    │
│           │ ← Quay lại  /  [DH26012] - LÊ THI LIÊN                     │
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
- Current page: `[DH26012] - LÊ THI LIÊN` (patient code + full name)
- Page title (browser tab): `DH26012 - LÊ THI LIÊN`

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

### Left Column — Patient Info Card

| Field | Vietnamese | Type | Notes |
|-------|-----------|------|-------|
| Patient Code | Mã bệnh nhân | Text | Format: [DH26012] |
| Full Name | Họ và tên | Text | Uppercase Vietnamese |
| Date of Birth | Ngày sinh | Date | DD/MM/YYYY |
| Gender | Giới tính | Text | Nam/Nữ |
| Phone | Số điện thoại | Text | 10-digit |
| Email | Email | Text | Optional |
| Address | Địa chỉ | Text | Full address |
| Occupation | Nghề nghiệp | Text | Optional |
| Source | Nguồn tiếp nhận | Text | How they found the clinic |
| Tags | Nhãn/Tag | Tags | Colored tag pills |
| Notes | Ghi chú | Text area | Free text |

Action buttons in card:
- Edit button (pencil icon) — UNKNOWN_REFERENCE_BEHAVIOR (mutating, not clicked)

### Right Column — Financial Summary

Financial overview widget with 3 key metrics:
| Metric | Vietnamese | Color |
|--------|-----------|-------|
| Total billed | Tổng chi phí | Neutral |
| Collected | Thực thu | Green |
| Outstanding debt | Công nợ | Red/Orange |

### Bottom Section — Treatment History Table

Columns (observed):
| # | Column | Notes |
|---|--------|-------|
| 1 | Ngày | Date DD/MM/YYYY |
| 2 | Dịch vụ/Thủ thuật | Service name |
| 3 | Bác sĩ | Doctor name |
| 4 | Trạng thái | Status badge |
| 5 | Số tiền | Amount VND |

---

## Tab 2: Chẩn đoán & Tư vấn (Diagnosis & Consulting)

URL: `?tab=consulting`
Status: OBSERVED

### Layout — Two-column split

**Left column — Dental Chart (Sơ đồ răng)**

Top toolbar (3 buttons):
- "Thêm ảnh" — add patient photo
- "Danh sách ảnh" — view photo list
- "Danh mục" — categories

Image gallery: horizontal scrolling thumbnail strip of patient photos (stored at Cloudflare R2 CDN).

Below gallery — Diagnosis form panel:
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

Real data row observed:
- Số phiếu: CD01
- Bác sĩ chẩn đoán 1: BS Tới / 11/08/2026
- Chẩn đoán 2: Chưa cập nhật / 11/08/2026
- Răng: Nguyên hàm — Khám - tư vấn niềng răng
- Ghi chú: "hô 2 hàm"
- Thao tác: "Tạo Dịch Vụ" | edit icon | "Xoá"

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

Real data row observed:
- Ngày: 11/08/2026
- Dịch vụ: Niềng răng mắc cài kim loại
- Chẩn đoán: Nguyên hàm - Khám - tư vấn niềng răng + "(hô 2 hàm)" button
- Nhân sự tư vấn 1: BS Tới
- Nhân sự tư vấn 2: -
- Bác sĩ chẩn đoán 1: BS Tới
- Chẩn đoán 2: -
- Số lượng: 1
- Đơn giá: 24.000.000 đ
- Giảm giá: 0 đ
- Thành tiền: 24.000.000 đ
- Ghi chú tư vấn: ---

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
- Real data: "Niềng răng mắc cài kim loại" / DH26001 / 11/08/2026

**Card 2: Dịch vụ có công đoạn gần nhất** (Service with most recent step)
- Shows: service name + plan code + step description
- Real data: "Niềng răng mắc cài kim loại" / DT01 / "2H: KTV Pano cepha, (đã chụp hình) +LD CVR ĐTTK (36,46)"

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

Real data row observed:
- Số phiếu: DT01 (clickable button)
- Bác sĩ tiếp nhận: BS Tới
- Trạng thái - Tiến độ: Đang điều trị
- Ngày tạo: 11/08/2026
- Tổng phiếu: 24.000.000 đ
- Giảm giá: 0 đ
- Thành tiền: 24.000.000 đ
- Đã trả: 500.000 đ
- Hoàn tiền: 0 đ
- Còn lại: 23.500.000 đ
- Phải thu: 0 đ

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
