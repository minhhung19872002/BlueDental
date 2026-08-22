# Materials / Inventory Page — /materials

Source: https://app.nfcdental.com/materials?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/materials-main.png

## Route

`/materials?branchId=<branchId>` → redirects to `/materials/clinic?branchId=<branchId>`

## Sub-Routes (3 sections, shown as horizontal nav links)

| # | Label (VI) | URL | English |
|---|-----------|-----|---------|
| 1 | Vật tư phòng khám | /materials/clinic (default) | Clinic materials |
| 2 | Phân bổ vật tư | /materials/allocation | Material allocation |
| 3 | Phòng ban | /materials/department | Departments |

## Default Sub-Route: /materials/clinic (Vật tư phòng khám)

### Layout

Two-panel layout:
- **Left panel**: Material group list (sidebar)
- **Right panel**: Material items table

### Left Panel — Material Groups

| Component | Details |
|-----------|---------|
| Header | "Nhóm vật tư" + count (e.g. "1 nhóm") |
| Subtitle | "Chọn nhóm để xem vật tư" |
| Search | "Tìm nhóm vật tư..." textbox |
| Add button | "Thêm Mới" — UNKNOWN_REFERENCE_BEHAVIOR |
| Groups list | Shows group names (observed: "Hệ thống") |

### Right Panel — Toolbar

| Control | Type | Notes |
|---------|------|-------|
| Thêm vật tư | Button | Add material — UNKNOWN_REFERENCE_BEHAVIOR |
| Tìm kiếm | Textbox | Search materials |
| Sync data hệ thống | Button | Disabled — sync from system |

### Right Panel — Table Columns (12 columns + checkbox)

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 0 | [checkbox] | Select all | Bulk select |
| 1 | Tên vật liệu | Material name | |
| 2 | Nhóm phân loại | Category group | |
| 3 | Nhập kho | Stock-in date | Import/receipt date |
| 4 | Hạn sử dụng | Expiry date | |
| 5 | Cảnh báo hết hạn | Expiry warning | Alert indicator |
| 6 | Tồn kho | Stock quantity | Current inventory |
| 7 | Trạng thái | Status | Stock status badge |
| 8 | Nhà cung cấp | Supplier | |
| 9 | Xuất xứ | Origin/Country | |
| 10 | Giá nhập | Purchase price | VND |
| 11 | Giá bán | Sale price | VND |
| 12 | Thao tác | Actions | |

Empty state: "Không có dữ liệu"
Pagination text: "Hiển thị 0 trên 0"

## /materials/allocation — Phân bổ vật tư

### Toolbar
| Control | Type |
|---------|------|
| Tìm phiếu phân bổ... | Textbox |
| Lịch sử kiểm kho | Button |

### Table Columns (9 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Thời gian phân bổ | Allocation time |
| 2 | Mã phân bổ | Allocation code |
| 3 | Vật tư | Material |
| 4 | SL được phân bổ | Allocated quantity |
| 5 | SL confirm còn lại | Confirmed remaining |
| 6 | Phòng ban | Department |
| 7 | Người thực hiện | Person who performed |
| 8 | Ghi chú | Notes |
| 9 | Thao tác | Actions |

Empty state: "Chưa có phiếu phân bổ"

---

## /materials/department — Phòng ban

### Layout: Two-panel
- **Left panel**: Department list (0 departments)
- **Right panel**: Material allocation table per department

### Left Panel
| Component | Details |
|-----------|---------|
| Header | "Phòng ban" + "0 phòng ban" count |
| Subtitle | "Chọn phòng ban để xem vật tư đã phát và kiểm kho" |
| Search | "Tìm phòng ban..." |
| Add button | "Tạo phòng ban" |

### Right Panel Toolbar
| Control | Type |
|---------|------|
| Tìm vật tư... | Textbox |
| Gộp số lượng vật tư | Button |

### Table Columns (9 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Thời gian phân bổ | Allocation time |
| 2 | Mã phân bổ | Allocation code |
| 3 | Vật tư | Material |
| 4 | SL được phát | Distributed quantity |
| 5 | SL còn lại (đã duyệt) | Remaining (approved) |
| 6 | Kiểm kho | Inventory check |
| 7 | Người thực hiện | Person who performed |
| 8 | Ghi chú | Notes |
| 9 | Thao tác | Actions |

Empty state: "Chọn phòng ban để xem vật tư đã phân bổ"

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | Material status badge values | No data rows |
| 2 | "Thêm vật tư" form fields | Not opened |
| 3 | "Thêm Mới" group form fields | Not opened |
| 4 | Row action buttons | No data rows |
| 5 | Expiry warning indicator appearance | No data |
| 6 | Stock status color coding | No data |
| 7 | "Lịch sử kiểm kho" page | Not navigated to |
| 8 | "Gộp số lượng vật tư" behavior | Not tested |
