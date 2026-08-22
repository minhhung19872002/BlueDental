# Tools Page — /tools

Source: https://app.nfcdental.com/tools?branchId=<id>
Observed: 2026-08-22
Screenshots: reference-private/survey/tools-main.png

## Route

`/tools?branchId=<branchId>` → redirects to `/tools/call?branchId=<branchId>`

## Sub-Routes (4 tool categories, shown as horizontal nav links)

| # | Label (VI) | URL slug | English |
|---|-----------|----------|---------|
| 1 | Gọi thoại | call (default) | Voice calls |
| 2 | Tin nhắn | message | Messages (SMS?) |
| 3 | Zalo OA | zalo-oa | Zalo Official Account |
| 4 | Hóa đơn | invoice | Invoice tools |

## Default: /tools/call (Gọi thoại / Voice Calls)

### Sub-Tabs (3 tabs within call tool)

| # | Tab (VI) | English |
|---|---------|---------|
| 1 | Cấu Hình | Configuration (default) |
| 2 | Phân Công Gọi | Call Assignment |
| 3 | Danh Sách Cuộc Gọi | Call List |

### "Cấu Hình" (Configuration) Tab

**Toolbar:**
| Control | Type | Notes |
|---------|------|-------|
| Tìm kiếm | Textbox | Search configurations |
| Tạo cấu hình | Button | Create config — UNKNOWN_REFERENCE_BEHAVIOR |

**Table Columns (6 columns):**
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Tên | Name |
| 2 | Chi nhánh | Branch |
| 3 | Loại cài đặt | Setting type |
| 4 | Nhà cung cấp | Provider (call provider) |
| 5 | Trạng thái | Status |
| 6 | Thao tác | Actions |

Empty state: "Chưa có cấu hình nào" (No configurations yet)
Pagination text: "Hiển thị 0 trên 0" (no per-page dropdown visible)

## /tools/message — Tin nhắn (SMS)

### Sub-Tabs (3 tabs)
| # | Tab (VI) | English |
|---|---------|---------|
| 1 | Cấu Hình | Configuration (default) |
| 2 | Mẫu Tin Nhắn | Message templates |
| 3 | Danh Sách Tin Nhắn | Message list |

### "Cấu Hình" tab — Table Columns (4 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Tên | Name |
| 2 | Nhà cung cấp | Provider |
| 3 | Trạng thái | Status |
| 4 | Thao tác | Actions |

**Note**: Fewer columns than Call config (4 vs 6) — no "Chi nhánh" or "Loại cài đặt" columns.

Empty state: "Chưa có cấu hình nào"

---

## /tools/zalo-oa — Zalo OA

### Sub-Tabs (3 tabs)
| # | Tab (VI) | English |
|---|---------|---------|
| 1 | Cấu Hình | Configuration (default) |
| 2 | Mẫu ZBS | ZBS templates |
| 3 | Danh sách Tin Nhắn | Message list |

### Default State (Cấu Hình tab)
Shows connection status panel:
- "OA" avatar indicator
- Text: "Chưa kết nối Zalo OA"
- Status badge: "Chưa kích hoạt"
- Button: "Kết nối Zalo OA" — UNKNOWN_REFERENCE_BEHAVIOR (would connect to Zalo OA account)

---

## /tools/invoice — Hóa đơn (Invoice Integration)

### Layout: Single tab "Cấu Hình"

### Toolbar
| Control | Type |
|---------|------|
| Tìm kiếm | Textbox |
| Tạo cấu hình | Button |

### Table Columns (6 columns)
| # | Column (VI) | English |
|---|------------|---------|
| 1 | Tên | Name |
| 2 | Tên chi nhánh | Branch name |
| 3 | Mô đun | Module |
| 4 | Nhà cung cấp | Provider |
| 5 | Trạng thái | Status |
| 6 | Thao tác | Actions (Chỉnh sửa + Xoá) |

**Real records (2 configurations):**
| Tên | Chi nhánh | Mô đun | Nhà cung cấp | Trạng thái |
|-----|-----------|--------|-------------|-----------|
| Quang Vinh | Chi nhánh Quang Vinh | Hóa đơn | MISA | Đã kích hoạt |
| Thuế Hố Nai | Chi nhánh Hố Nai | Hóa đơn | MISA | Đã kích hoạt |

**Note**: Invoice integration uses MISA (Vietnamese accounting software).

---

## Sub-Tab Summary Per Tool

| Tool | Sub-tabs |
|------|---------|
| Gọi thoại (/call) | Cấu Hình, Phân Công Gọi, Danh Sách Cuộc Gọi |
| Tin nhắn (/message) | Cấu Hình, Mẫu Tin Nhắn, Danh Sách Tin Nhắn |
| Zalo OA (/zalo-oa) | Cấu Hình, Mẫu ZBS, Danh sách Tin Nhắn |
| Hóa đơn (/invoice) | Cấu Hình only |

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control | Reason |
|---|---------|--------|
| 1 | "Phân Công Gọi" tab (call) | Not clicked |
| 2 | "Danh Sách Cuộc Gọi" tab (call) | Not clicked |
| 3 | "Mẫu Tin Nhắn" tab (message) | Not clicked |
| 4 | "Danh Sách Tin Nhắn" tab (message) | Not clicked |
| 5 | "Mẫu ZBS" tab (zalo-oa) | Not clicked |
| 6 | "Kết nối Zalo OA" button | Not clicked (would mutate) |
| 7 | Call provider options | Not observed |
| 8 | "Tạo cấu hình" form (invoice) | Not opened |

## Notes

- "Công cụ" (Tools) = integrations and communication tools
- Focus on VOIP/call integration, messaging, Zalo OA (Vietnam messaging platform), and invoice tools
- Not core medical functionality — likely advanced/optional features
