# Taxonomy / Catalog Management Page — /taxonomy

Source: https://app.nfcdental.com/taxonomy?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/taxonomy-main.png

## Route

`/taxonomy?branchId=<branchId>` → redirects to `/taxonomy/service?branchId=<branchId>`

## Sub-Routes (11 catalog types, shown as horizontal nav links)

| # | Label (VI) | URL slug | English |
|---|-----------|----------|---------|
| 1 | Dịch vụ | service (default) | Services / Dental Procedures |
| 2 | Chẩn đoán | diagnosis | Diagnoses |
| 3 | Loại thuốc | medicine | Medicine types |
| 4 | Dữ liệu tư vấn | consulting | Consulting data |
| 5 | Nguồn đến | source | Patient source channels |
| 6 | Lịch sử bệnh | history | Disease history |
| 7 | Đơn thuốc mẫu | prescription-template | Prescription templates |
| 8 | Bệnh án mẫu | medical-record-template | Medical record templates |
| 9 | Thẻ hồ sơ | tags | Patient tags |
| 10 | Phương thức thanh toán | payment-method | Payment methods |
| 11 | Nghề nghiệp | occupation | Occupations |

## Default: /taxonomy/service (Dịch vụ / Services)

### Layout

Two-panel layout:
- **Left panel**: Service group sidebar
- **Right main panel**: Service items table

### Left Panel — Service Groups

| Component | Details |
|-----------|---------|
| Header | "Nhóm dịch vụ" + count ("5 nhóm") |
| Subtitle | "Chọn nhóm để xem dịch vụ bên trong" |
| Search | "Tìm nhóm..." textbox |
| Add button | Icon button (add new group — UNKNOWN_REFERENCE_BEHAVIOR) |
| Groups list | Draggable list with "Kéo để sắp xếp" drag handle |

**Service Groups observed (5 groups with drag sort + more actions button):**
| Group Name (VI) | English | Item count |
|----------------|---------|-----------|
| PHẪU THUẬT NHA CHU | Periodontal Surgery | 0 (selected by default) |
| NHA KHOA TỔNG QUÁT | General Dentistry | 26 (from API) |
| NHA KHOA THẨM MỸ | Aesthetic Dentistry | 24 (from API) |
| CHỈNH NHA | Orthodontics | 10 (from API) |
| CẤY GHÉP IMPLANT | Implant | 8 (from API) |

Each group has:
- Clickable name button (selects group)
- "Thêm thao tác" (more actions) button — UNKNOWN_REFERENCE_BEHAVIOR
- "Kéo để sắp xếp" (drag to sort) handle

### Right Panel — Toolbar

| Control | Type | Notes |
|---------|------|-------|
| Heading | "PHẪU THUẬT NHA CHU" (h1) + "0 bản ghi" | Current group name + count |
| Subtitle | "Quản lý các mục thuộc nhóm {group}" | |
| Xuất | Button | Export — UNKNOWN |
| Thêm dịch vụ | Button | Add service — UNKNOWN |
| Tìm theo tên dịch vụ... | Textbox | Search within group |

### Service Table Columns (6 columns)

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 0 | [drag handle] | Sort handle | |
| 1 | Tên dịch vụ | Service name | |
| 2 | Nhóm phân loại | Category group | |
| 3 | Giá | Price | VND |
| 4 | Cập nhật gần nhất | Last updated | Date |
| 5 | Thao tác | Actions | |

Pagination text: "Hiển thị 0 trên 0 bản ghi"

## API Reference

```
GET /api/v1/taxonomy/?group=care_service&branchId=<id>&perPage=50
```
Fields: id, name, alias, color, description, group, subGroup, ownerType,
        clinicId, branchId, isSystem, order, itemCount

## /taxonomy/diagnosis — Chẩn đoán

**Layout**: Two-panel (1 group "Chuẩn Đoán")
**Table columns**: [drag], Tên chẩn đoán, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Total**: 14 records

**Real records (all):**
S Sâu mặt nhai, T Tẩy trắng răng, V Viêm nướu, V Viêm tủy, N Nứt răng, M Mòn cổ răng, T Thiếu răng, C Cắn ngược, K Khớp cắn sâu, R Răng khôn mọc lệch, T Tiêu xương ổ răng, L Lệch lạc răng, N Nha chu, H Hở kẽ răng

---

## /taxonomy/medicine — Loại thuốc

**Layout**: Two-panel with 6 groups
**Table columns**: [drag], Tên loại thuốc, Nhóm phân loại, Giá, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm loại thuốc"

**Groups (6):**
| Group | Records |
|-------|---------|
| Thuốc Kháng Viêm | 13 |
| Thuốc Giãn Cơ | unknown |
| Thuốc Hạ Áp | unknown |
| Thuốc Viêm Dạ Dày | unknown |
| Thuốc Giảm Đau | unknown |
| Thuốc Kháng Sinh | unknown |

**Sample records in Thuốc Kháng Viêm:**
Medrol 4Mg, Loxoprofen 60Mg, Meloxicam 7.5 Mg, Prednisolon 5Mg, Methylprednisolone 8mg, Methylprednisolone 16Mg, Medrol 16Mg, Ibuprofen 400Mg, Ibuprofen 200Mg, Diclofenac 50Mg, Alphachymotrypsin 8.4mg, Alphachymotrypsin 4.2mg, Alpha Choay

**Price field**: shown as "0 đ" for all sample records — prices not entered

---

## /taxonomy/consulting — Dữ liệu tư vấn

**Layout**: Two-panel (0 nhóm, empty)
**Table columns**: [drag], Tên dữ liệu tư vấn, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm dữ liệu tư vấn"
**State**: No data

---

## /taxonomy/source — Nguồn đến

**Layout**: Two-panel with 2 groups
**Table columns**: [drag], Tên nguồn đến, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm nguồn đến"

**Groups (2):**
| Group | Records |
|-------|---------|
| Offline | 1 |
| Online | unknown |

**Record in Offline**: "V Vãng lai tự tìm đến"

---

## /taxonomy/history — Lịch sử bệnh

**Layout**: Two-panel with 8 groups
**Table columns**: [drag], Tên lịch sử bệnh, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm lịch sử bệnh"

**Groups (8):**
| Group | Records visible |
|-------|----------------|
| Bệnh Hô Hấp | 3 (Bệnh Phổi Tắc Nghẽn Mãn Tính, Hen Suyễn, Lao) |
| Bệnh Ung Thư | unknown |
| Bệnh Tim Mạch | unknown |
| Bệnh Thận | unknown |
| Bệnh Huyết Áp | unknown |
| Bệnh Đường Huyết | unknown |
| Dị Ứng Thuốc | unknown |
| Chưa Ghi Nhận Bất Thường | unknown |

---

## /taxonomy/tags — Thẻ hồ sơ

**Layout**: Single table (NO two-panel)
**Heading**: "Quản lý Thẻ hồ sơ"
**Table columns**: Tên tag, Màu, Thao tác
**Add button**: "Thêm tag"
**Search**: "Tìm tag theo tên hoặc mã màu..."

**Real records (4 tags):**
| Tag name | Color hex |
|----------|-----------|
| Tư Vấn Chỉnh Nha | #EF4444 (red) |
| Implant | #3B82F6 (blue) |
| Tổng quát | #10B981 (green) |
| Chỉnh Nha | #F59E0B (amber) |

---

## /taxonomy/payment-method — Phương thức thanh toán

**Layout**: Single table with 2 tabs (MoMo / Ngân hàng)
**Heading**: "Quản lý phương thức thanh toán"
**Subtitle**: "Tạo và quản lý tài khoản MoMo, ngân hàng dùng khi thanh toán."
**Add button**: "Thêm phương thức"

**MoMo tab columns:**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Số điện thoại | Phone number |
| 2 | Tên chủ tài khoản | Account holder name |
| 3 | Lần cập nhật cuối | Last updated |
| 4 | Thao tác | Actions |

**Ngân hàng tab**: columns unknown (not clicked)

Empty state: "Không có phương thức MoMo"

---

## /taxonomy/prescription-template — Đơn thuốc mẫu

**Layout**: Single table (NO two-panel, NO group sidebar)
**Table columns**: [drag], Tên đơn thuốc mẫu, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm đơn thuốc mẫu"
**Search**: "Tìm theo tên đơn thuốc..."
**State**: 0 records

---

## /taxonomy/medical-record-template — Bệnh án mẫu

**Layout**: Two-panel with 1 group
**Table columns**: [drag], Tên bệnh án mẫu, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm bệnh án mẫu"

**Groups (1):** Mẫu Bệnh Án Chỉnh Nha (1 record)

**Real record**: "B Bệnh Án Chỉnh Nha"

---

## /taxonomy/occupation — Nghề nghiệp

**Layout**: Two-panel (0 nhóm, empty — same pattern as consulting)
**Table columns**: [drag], Tên nghề nghiệp, Nhóm phân loại, Cập nhật gần nhất, Thao tác
**Add button**: "Thêm nghề nghiệp"
**State**: No data

---

## Layout Patterns Summary

| Sub-route | Layout type | Has groups |
|-----------|-------------|-----------|
| service | Two-panel | 5 groups |
| diagnosis | Two-panel | 1 group |
| medicine | Two-panel | 6 groups |
| consulting | Two-panel | 0 (empty) |
| source | Two-panel | 2 groups |
| history | Two-panel | 8 groups |
| prescription-template | Single table | None |
| medical-record-template | Two-panel | 1 group |
| tags | Single flat table | None (color field) |
| payment-method | Tabbed (MoMo/Bank) | None |
| occupation | Two-panel | 0 (empty) |

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Thêm dịch vụ" form fields | Not opened |
| 2 | "Thêm thao tác" group actions | Not clicked |
| 3 | Service item price/alias/color fields | Not observed |
| 4 | Ngân hàng tab columns (payment-method) | Not clicked |
| 5 | Medicine group record counts (except Kháng Viêm) | Not navigated |
| 6 | Drag-to-sort behavior | Not tested |
| 7 | "Thêm tag" form fields | Not opened |
| 8 | "Tạo nhà cung cấp" / "Tạo vật liệu" forms | Not opened |
