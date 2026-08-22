# Operations Management Page — /operations

Source: https://app.nfcdental.com/operations?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/operations-main.png

## Route

`/operations?branchId=<branchId>` → redirects to
`/operations/overview?branchId=<branchId>&overviewSubTab=home`

## Sub-Routes (8 department sections, horizontal nav links)

| # | Label (VI) | URL slug | English |
|---|-----------|----------|---------|
| 1 | Quản trị vận hành | overview (default) | Operations overview |
| 2 | Khối trợ lý | assistant | Assistant department |
| 3 | Khối lễ tân | reception | Reception department |
| 4 | Khối CSKH | cskh | Customer care department |
| 5 | Khối Marketing | marketing | Marketing department |
| 6 | Khối bảo vệ | security | Security department |
| 7 | Khối điều trị | treatment | Treatment department |
| 8 | Khối tài chính | finance | Finance department |

## URL Param Pattern

URL params accumulate as you navigate between sub-routes:
```
/operations/finance?branchId=...
  &assistantSubTab=home
  &receptionSubTab=home
  &overviewSubTab=home
  &cskhSubTab=home
  &marketingSubTab=home
  &securitySubTab=home
  &financeTab=overview
  &financeSubTab=home
```

Each department appends its own `{dept}SubTab=home` param. Treatment and Finance additionally have a top-level `{dept}Tab=overview` param.

## Department Sub-Tab Counts

| Department | Sub-tabs | URL param key | Sub-tab param values |
|------------|----------|---------------|---------------------|
| overview | 6 | `overviewSubTab` | `home`, `process`, `task`, `report`, `untreated`, `prescription` |
| assistant | 3 | `assistantSubTab` | `home`, `process`, `task` |
| reception | 4 | `receptionSubTab` | `home`, `process`, `task`, `report` |
| cskh | 4 | `cskhSubTab` | `home`, `process`, `task`, `report` |
| marketing | 4 | `marketingSubTab` | `home`, `process`, `task`, `report` |
| security | 4 | `securitySubTab` | `home`, `process`, `task`, `report` |
| treatment | 4 + top-level tabs (Tổng quan/Truy cập) | `treatmentSubTab` + `treatmentTab` | sub: `home`, `process`, `task`, `report`; top: `overview`, `access` |
| finance | 6 + top-level tabs (Tổng quan/Truy cập) | `financeSubTab` + `financeTab` | sub: `home`, +5 more; top: `overview`, `access` |

---

## /operations/overview — Quản trị vận hành

### Sub-Tabs (6)

| # | Label (VI) | English |
|---|-----------|---------|
| 1 | Trang chủ | Home (default) |
| 2 | Quy trình | Processes |
| 3 | Công việc | Tasks/Work |
| 4 | Báo cáo | Reports |
| 5 | Chẩn đoán chưa điều trị | Untreated Diagnoses |
| 6 | Đơn thuốc | Prescriptions |

### "Trang chủ" (Home) Layout

Left sidebar: "Thêm Mới" button + article list
Right area toolbar: "Tạo Bài Viết" (disabled) + search textbox

**Table columns (4):**
| Column (VI) | English |
|------------|---------|
| Tiêu đề | Title |
| Ngày tạo | Created date |
| Ngày cập nhật | Updated date |
| Thao tác | Actions |

Empty state: "Không có dữ liệu"

---

## /operations/assistant — Khối trợ lý

### Sub-Tabs (3)
Trang chủ | Quy trình | Công việc

Same layout as overview "Trang chủ" tab.

---

## /operations/reception — Khối lễ tân

### Sub-Tabs (4)
Trang chủ | Quy trình | Công việc | Báo cáo

URL param: `receptionSubTab=home`

Same "Trang chủ" layout as other departments.

---

## /operations/cskh — Khối CSKH

### Sub-Tabs (4)
Trang chủ | Quy trình | Công việc | Báo cáo

URL param: `cskhSubTab=home`

---

## /operations/marketing — Khối Marketing

### Sub-Tabs (4)
Trang chủ | Quy trình | Công việc | Báo cáo

URL param: `marketingSubTab=home`

---

## /operations/security — Khối bảo vệ

### Sub-Tabs (4)
Trang chủ | Quy trình | Công việc | Báo cáo

URL param: `securitySubTab=home`

---

## /operations/treatment — Khối điều trị

**Special**: Has TWO levels of tabs (like finance).

### Top-level tabs (2)
| Tab | Param |
|-----|-------|
| Tổng quan | `treatmentTab=overview` |
| Truy cập | `treatmentTab=access` |

### Sub-tabs under Tổng quan (4)
Trang chủ | Quy trình | Công việc | Báo cáo

URL param: `treatmentSubTab=home`

---

## /operations/finance — Khối tài chính

**Special**: Has TWO levels of tabs (like treatment), but MORE sub-tabs.

### Top-level tabs (2)
| Tab | Param |
|-----|-------|
| Tổng quan | `financeTab=overview` |
| Truy cập | `financeTab=access` |

### Sub-tabs under Tổng quan (6)

| # | Label (VI) | English |
|---|-----------|---------|
| 1 | Trang chủ | Home |
| 2 | Khách hàng phát sinh | Customers with activity |
| 3 | Quy trình | Processes |
| 4 | Công việc | Tasks |
| 5 | Hóa đơn | Invoices |
| 6 | Hoàn thành theo dịch vụ | Completion by service |

URL param: `financeSubTab=home`

Note: Finance has unique sub-tabs "Hóa đơn" and "Hoàn thành theo dịch vụ" not present in other departments.

### Confirmed `financeSubTab` param values
| Sub-tab | `financeSubTab` value |
|---------|----------------------|
| Trang chủ | `home` |
| Khách hàng phát sinh | `customer-report` |
| Quy trình | `process` |
| Công việc | `task` |
| Hóa đơn | `invoice` |
| Hoàn thành theo dịch vụ | `service-complete` |

---

## Department Sub-Tab Comparison

| Sub-tab | overview | assistant | reception | cskh | marketing | security | treatment | finance |
|---------|:--------:|:---------:|:---------:|:----:|:---------:|:--------:|:---------:|:-------:|
| Trang chủ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quy trình | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Công việc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Báo cáo | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Chẩn đoán chưa điều trị | ✓ | — | — | — | — | — | — | — |
| Đơn thuốc | ✓ | — | — | — | — | — | — | — |
| Khách hàng phát sinh | — | — | — | — | — | — | — | ✓ |
| Hóa đơn | — | — | — | — | — | — | — | ✓ |
| Hoàn thành theo dịch vụ | — | — | — | — | — | — | — | ✓ |
| Top-level tabs (Tổng quan/Truy cập) | — | — | — | — | — | — | ✓ | ✓ |

---

## Sub-Tab Layouts — Confirmed

### Article-list layout (Trang chủ, Quy trình, Công việc)
Same layout for all three:
- Left sidebar: "Thêm Mới" button + article list
- Right area: "Tạo Bài Viết" (disabled) + search textbox
- Table: Tiêu đề | Ngày tạo | Ngày cập nhật | Thao tác
- Empty state: "Không có dữ liệu"
- `overviewSubTab` values: `home`, `process`, `task`

### Báo cáo sub-tab (`overviewSubTab=report`)
**Different layout** — activity/audit log, not article list.

**Toolbar:**
- Date period tabs: Ngày/Tuần/Tháng/Năm + date picker (prev/next)
- Filters: "Người tạo" combobox, "Hành động" combobox, "Tìm kiếm khách hàng" textbox
- Quick stat: "Doanh số chốt kế hoạch" value

**"Hành động" dropdown options (confirmed):**
Chẩn đoán, Tư vấn, Điều trị, Công đoạn, Tái khám, Thanh toán, Hoàn tiền, Hủy dịch vụ, Chuyển đổi dịch vụ, Lịch hẹn, Tiếp nhận

**Table Columns (6 columns):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày / Khách hàng | Date + customer (combined) |
| 2 | Nhân sự | Staff |
| 3 | Hành động | Action type |
| 4 | Điều trị / Dịch vụ / Lịch hẹn | Treatment/service/appointment |
| 5 | Nội dung / Ghi chú | Content/notes |
| 6 | Doanh số | Revenue |

Pagination: "Hiển thị N trên N công việc"

### Chẩn đoán chưa điều trị (`overviewSubTab=untreated`)
**Has date filter** (Ngày/Tuần/Tháng/Năm + date picker)
**Filter**: "Người tạo" combobox

**Table Columns (6 columns):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày | Date |
| 2 | Khách hàng | Customer |
| 3 | Nhân sự | Staff |
| 4 | Răng | Tooth |
| 5 | Chẩn đoán | Diagnosis |
| 6 | Nội dung / Ghi chú | Content/notes |

### Đơn thuốc (`overviewSubTab=prescription`)
**State**: "Nội dung đang được xây dựng." — feature not yet implemented.

---

---

## "Khách hàng phát sinh" sub-tab (`financeSubTab=customer-report`)

Title: "Báo cáo khách hàng phát sinh"

**Toolbar:**
- Date period tabs: Ngày / Tuần / Tháng (no Năm)
- Date picker: prev/next buttons + current date
- "Nhân sự tư vấn" combobox filter

**Table Columns (7):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Nhân sự tư vấn | Counselor staff |
| 2 | Tư vấn khách mới | New patient consultations |
| 3 | Tư vấn khách cũ | Returning patient consultations |
| 4 | Doanh thu khách mới | Revenue from new patients |
| 5 | Doanh thu khách cũ | Revenue from returning patients |
| 6 | Tổng lượt tư vấn | Total consultations |
| 7 | Doanh thu từ tư vấn | Revenue from consultations |

**Right sidebar — "Tổng quan tài chính" (Financial overview):**
Same 4 summary cards as Report Tab 1: Thông tin lượt khách, Thông tin lịch hẹn, Thông tin thanh toán, Thông tin thu chi (Hôm nay / Tuần này / Tháng này / Năm nay / Toàn bộ).

---

## "Hóa đơn" sub-tab (`financeSubTab=invoice`)

**Toolbar (top-level):**
- Date period tabs: Ngày / Tuần / Tháng
- Date picker

**Filter:**
- "Tất cả trạng thái" combobox

**Table Columns (12):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày tạo | Created date |
| 2 | Số hóa đơn | Invoice number |
| 3 | Tên bệnh nhân | Patient name |
| 4 | Tên đơn vị | Organization name |
| 5 | Hình thức thanh toán | Payment method |
| 6 | Trạng thái hóa đơn | Invoice status |
| 7 | Trạng thái | Status |
| 8 | Tổng trước VAT | Total before VAT |
| 9 | Tổng VAT | Total VAT |
| 10 | Tổng tiền | Total amount |
| 11 | Nhà cung cấp | Provider (e.g. MISA) |
| 12 | Thao tác | Actions |

Empty state: "Không có dữ liệu"

---

## "Hoàn thành theo dịch vụ" sub-tab (`financeSubTab=service-complete`)

**Toolbar:**
- Date period tabs: Ngày / Tuần / Tháng / Năm (all 4 — defaults to Tháng)
- Date picker
- Filters: "Tìm khách hàng, dịch vụ" textbox + "Bác sĩ điều trị" combobox + "Nhóm dịch vụ" combobox
- Buttons: "Đồng bộ phần mềm bán hàng" (disabled) + "Xuất Excel"

**Summary cards (4):**
| Label (VI) | English |
|-----------|---------|
| Thực thu | Actual collected |
| Tổng doanh thu | Total revenue |
| Dịch vụ hoàn thành | Completed services (+ "X% đúng tiến độ") |
| Dịch vụ doanh số riêng | Services with separate quota ("Tính theo định mức riêng") |

**Table Columns (21):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày thao tác | Action date |
| 2 | Khách hàng | Customer (link + created date) |
| 3 | Chi nhánh | Branch |
| 4 | Dịch vụ | Service |
| 5 | Nhóm dịch vụ | Service group |
| 6 | Phân loại | Classification (e.g. "Dịch vụ đã hoàn thành") |
| 7 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 |
| 8 | Chẩn đoán 2 | Diagnosis 2 |
| 9 | Nhân sự tư vấn 1 | Counselor 1 |
| 10 | Nhân sự tư vấn 2 | Counselor 2 |
| 11 | Bác sĩ điều trị | Treating doctor |
| 12 | Răng | Tooth |
| 13 | Chi tiết phiếu | Plan slip (linked — e.g. "DT02") |
| 14 | Giá dịch vụ | Service price |
| 15 | Số lượng | Quantity |
| 16 | Tổng giảm giá | Total discount |
| 17 | Giá điều trị bác sĩ | Doctor treatment price |
| 18 | Ghi chú | Notes |
| 19 | Loại thuế | Tax type |
| 20 | % Thuế | Tax % |
| 21 | Thao tác | Actions (sync checkbox) |

Last column: checkbox "Chọn đồng bộ {service name}" — used with "Đồng bộ phần mềm bán hàng" sync button.

---

## "Truy cập" top-level tab (Treatment & Finance) (`treatmentTab=access` / `financeTab=access`)

Both Treatment and Finance share the **same layout** under "Truy cập" tab.

**Toolbar:**
- Date period tabs: Ngày / Tuần / Tháng (defaults to Tháng)
- Date picker
- "Bộ lọc" filter button
- "Đồng bộ phần mềm bán hàng" (disabled) + "Xuất Excel"

**Filters (Finance "Truy cập"):**
- "Tìm khách hàng, dịch vụ" textbox
- "Phân loại dịch vụ" combobox
- "BS điều trị" combobox
- "Nhóm dịch vụ" combobox

**Filters (Treatment "Truy cập"):**
- "Phân loại" combobox (options: "Tổng doanh số" default visible)

**Summary stats (Treatment):**
- Tổng doanh số
- Dịch vụ đã hoàn thành
- Dịch vụ tính doanh số riêng

**Table Columns (27 — same for both Treatment and Finance "Truy cập"):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | (checkbox) | Select all |
| 2 | Ngày thao tác | Action date |
| 3 | Khách hàng | Customer (link + created date) |
| 4 | Nghề nghiệp | Occupation |
| 5 | Chi nhánh | Branch |
| 6 | Dịch vụ | Service |
| 7 | Tên chi tiết | Detail name |
| 8 | Nhóm dịch vụ | Service group |
| 9 | Phân loại | Classification |
| 10 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 |
| 11 | Chẩn đoán 2 | Diagnosis 2 |
| 12 | Nhân sự tư vấn 1 | Counselor 1 |
| 13 | Nhân sự tư vấn 2 | Counselor 2 |
| 14 | Bác sĩ điều trị | Treating doctor |
| 15 | Bác sĩ hỗ trợ | Supporting doctor |
| 16 | Phụ tá | Assistant |
| 17 | Răng | Tooth |
| 18 | Ghi chú dịch vụ | Service notes |
| 19 | Nội dung điều trị | Treatment content |
| 20 | Giá dịch vụ | Service price |
| 21 | Số lượng | Quantity |
| 22 | Tổng giảm giá | Total discount |
| 23 | Giá điều trị bác sĩ | Doctor treatment price |
| 24 | Hình ảnh sau điều trị | Post-treatment images |
| 25 | Công đoạn | Treatment step |
| 26 | Loại thuế | Tax type |
| 27 | % Thuế | Tax % |

Note: "Truy cập" has **more columns** than "Hoàn thành theo dịch vụ" — adds Nghề nghiệp, Tên chi tiết, Bác sĩ hỗ trợ, Phụ tá, Ghi chú dịch vụ, Nội dung điều trị, Hình ảnh sau điều trị, Công đoạn.

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Thêm Mới" button in article sidebar | Not clicked (may be mutating) |
| 2 | Article content format | No articles to observe |
| 3 | "Đồng bộ phần mềm bán hàng" button | Disabled in prod |
| 4 | Treatment "Truy cập" — "Bộ lọc" expanded filter | Not clicked |

## Notes

- Operations = internal process documentation + task management per department
- Each department has a shared "article list" pattern in its "Trang chủ" tab
- Treatment and Finance are the most complex departments (top-level tabs + extra sub-tabs)
- Finance has invoice and service completion tracking not in other departments
