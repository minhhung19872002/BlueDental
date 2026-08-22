# Labo Page — /labo

Source: https://app.nfcdental.com/labo?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/labo-main.png

## Route

`/labo?branchId=<branchId>` → redirects to `/labo/mau-labo?branchId=<branchId>`

## Sub-Routes (6 sections, shown as horizontal nav links)

| # | Label (VI) | URL |
|---|-----------|-----|
| 1 | Mẫu Labo | /labo/mau-labo (default) |
| 2 | Nhà cung cấp Labo | /labo/supplier |
| 3 | Khớp cắn Labo | /labo/bite |
| 4 | Đường hoàn tất | /labo/finish-line |
| 5 | Kiểu nhịp Labo | /labo/nhip |
| 6 | Dịch vụ - vật liệu | /labo/service-material |

## Default Sub-Route: /labo/mau-labo (Labo Samples)

### Toolbar

**Left:**
| Control | Type | Notes |
|---------|------|-------|
| Ngày/Tuần/Tháng | Tab group | Date period filter (disabled when not set) |
| Chọn thời gian | Button | Date picker — disabled by default |
| Xuất Excel | Button | Export to Excel |

**Filter tabs (status):**
| # | Tab (VI) | English |
|---|---------|---------|
| 1 | Tất Cả Mẫu | All Samples (default) |
| 2 | Mẫu Chưa Nhận | Unreceived Samples |
| 3 | Mẫu Giao Trễ | Late Delivery |
| 4 | Mẫu Đã Nhận Hàng | Received Samples |

**Right filters:**
| Control | Type |
|---------|------|
| Chọn khách hàng | Combobox (patient search) |
| Chọn bác sĩ | Combobox (doctor filter) |

### Table Columns (9 columns)

| # | Column Header (VI) | Notes |
|---|-------------------|-------|
| 1 | Nhà cung cấp / Ngày tạo | Supplier name + creation date (combined) |
| 2 | Tên khách hàng | Patient name |
| 3 | Ngày gửi / Tình trạng mẫu | Send date + sample condition (combined) |
| 4 | Ngày giao / Trạng thái Labo | Delivery date + labo status (combined) |
| 5 | Bác sĩ chỉ định | Prescribing doctor |
| 6 | Vật liệu | Material type |
| 7 | Răng | Tooth numbers |
| 8 | File phòng khám gửi về | File returned from lab |
| 9 | Thao tác | Action buttons |

Note: Patient detail Labo tab has 10 columns (includes "Số lượng" quantity). Main labo page has 9 columns (no quantity, no "Nhà cung cấp" as own column — merged with date).

Empty state: "Không có dữ liệu"

### Pagination

Options: 5, 10, 20 (default), 25, 50, 100 per page
Text: "Hiển thị 0 trên 0 mẫu labo"

## /labo/supplier — Nhà cung cấp Labo

Screenshots: reference-private/survey/labo-supplier.png

### Toolbar
| Control | Type |
|---------|------|
| Tìm kiếm Labo | Textbox |
| Tạo nhà cung cấp | Button |

### Table Columns (6 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Tên labo | Lab name |
| 2 | Số điện thoại | Phone number |
| 3 | Email | Email |
| 4 | Địa chỉ | Address |
| 5 | Lần cập nhật cuối | Last updated |
| 6 | Thao tác | Actions (Chỉnh sửa + Xoá) |

**Real records (4 suppliers):**
| Tên labo | Phone | Email |
|---------|-------|-------|
| Lab Minh Phong - Chỉnh nha | 0985832517 | labminhphong@gmail.com |
| Lab Việt Tiên - Răng sứ | 0946436869 | info@laboviettien.net |
| Smile Lab - Răng sứ | 0972477020 | smilelabtvq@gmail.com |
| Labo Kim Chi - Tháo lắp | 0855558723 | labokimchi@gmail.com |

Pagination: "Hiển thị 1–4 trên 4 nhà cung cấp"

---

## /labo/bite — Khớp cắn Labo

### Toolbar
| Control | Type |
|---------|------|
| Tìm kiếm khớp cắn | Textbox |
| Tạo khớp cắn | Button |

### Table Columns (3 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Khớp cắn Labo | Bite type name |
| 2 | Cập nhật gần nhất | Last updated |
| 3 | Thao tác | Actions (Chỉnh sửa + Xoá) |

**Real records (5 items):**
- Khớp cắn chéo
- Khớp cắn hở
- Khớp cắn hạng I
- Khớp cắn hạng II
- Khớ cắn hạng III *(typo in source)*

Pagination: "Hiển thị 1–5 trên 5 mục"

---

## /labo/finish-line — Đường hoàn tất

### Toolbar
| Control | Type |
|---------|------|
| Tìm kiếm đường hoàn tất | Textbox |
| Tạo đường hoàn tất | Button |

### Table Columns (3 columns — same pattern as bite)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Đường hoàn tất | Finish line name |
| 2 | Cập nhật gần nhất | Last updated |
| 3 | Thao tác | Actions |

**Real records (5 items):**
- Bờ nghiêng
- Bờ xuôi
- Bờ cong
- Bờ vai
- Bờ vai vát

---

## /labo/nhip — Kiểu nhịp Labo

### Toolbar
| Control | Type |
|---------|------|
| Tìm kiếm kiểu nhịp | Textbox |
| Tạo kiểu nhịp | Button |

### Table Columns (3 columns — same pattern)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Kiểu nhịp Labo | Pontic type name |
| 2 | Cập nhật gần nhất | Last updated |
| 3 | Thao tác | Actions |

**Real records (4 items):**
- Nhịp bán yên ngựa
- Nhịp yên ngựa
- Nhịp hình trứng
- Nhịp thoát

---

## /labo/service-material — Dịch vụ - vật liệu

### Layout
Two-panel:
- **Left panel**: Supplier list (4 suppliers)
- **Right panel**: Material items table

### Left Panel
| Component | Details |
|-----------|---------|
| "Thêm Mới" button | Add new supplier group |
| Supplier list | Click to filter materials by supplier |
| Each row | Supplier name + 2 action buttons (edit/delete) |

**Suppliers in left panel:**
- Lab Minh Phong - Chỉnh nha
- Lab Kim Chi - Tháo Lắp
- Lab Smile - Răng Sứ
- Lab Việt Tiên - Răng sứ

### Right Panel Toolbar
| Control | Type |
|---------|------|
| Tạo vật liệu | Button |
| Tìm kiếm | Textbox |

### Table Columns (4 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Vật liệu | Material name |
| 2 | Nhóm phân loại | Category (= supplier) |
| 3 | Cập nhật gần nhất | Last updated |
| 4 | Thao tác | Actions |

**Total: 40 materials (2 pages of 20)**

**Sample material names observed:**
Răng Composite, Răng nhựa Mỹ, Nền tạm gối sáp, Sứ Titan/Implant, Sứ titan, Răng nhựa tạm PMMA, Sứ Lava Plus/Implant, Sứ Cercon HT/Implant, Sứ Ziconia/implant, Sứ Lava Plus, Sứ Cercon HT, Sứ Zirconia, Veneer - Emax, Wax up, Abutment, Khay cá nhân, Răng nhựa Việt Nam, Răng nhựa PMMA, Veneer - Emax, Sứ Emax

Pagination: "Hiển thị 1–20 trên 40 vật liệu"

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | Row action buttons in mau-labo | No data rows |
| 2 | Labo status badge values (mau-labo) | No data |
| 3 | Sample condition (Tình trạng mẫu) values | Not observed |
| 4 | "Tạo nhà cung cấp" form fields | Not opened |
| 5 | "Tạo vật liệu" form fields | Not opened |
