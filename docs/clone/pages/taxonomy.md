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

## 2026-08-24 — Redesigned reference layout (staging.nfcdental.com)

The reference has since been rebuilt. Observed on `staging.nfcdental.com`
(read-only, no writes), 1800×1000, with computed styles read from DevTools.
BlueDental's `/taxonomy` is now cloned against **this** layout.

### Shell

```
main
└─ div  h-[calc(100vh-62px)] flex flex-col overflow-hidden
   ├─ tab strip   shrink-0 border-b border-[#DCE3EE] bg-white px-5   (h 50)
   ├─ aside       w-[272px] border-r border-[#DCE3EE] bg-white       (group panel)
   └─ main        flex-1 overflow-hidden bg-[#F6F8FB]                (entry panel)
```

### Design tokens (from the reference `:root`)

| Role | Value | BlueDental token |
|------|-------|------------------|
| Primary | `#2671D8` | `--color-app-primary` — **not adopted**, see below |
| Primary hover/dark | `#1E5BB0` | `--color-app-primary-dark` — not adopted |
| Primary soft | `#E7F0FB` | `--color-app-primary-soft` — not adopted |
| Ink | `#1B2A41` | `--color-app-ink` |
| Label / muted | `#5A6B82` | `--color-app-label` |
| Line | `#DCE3EE` | `--color-app-line` |
| Line hover | `#C8D3E4` | `--color-app-line-strong` |
| Surface | `#F6F8FB` | `--color-app-surface` |
| Icon ghost | `#C5D0DE` | `--color-app-icon` |
| Danger | `#E5484D` | `--color-app-danger` |

Font: `"Google Sans", sans-serif`.

**Accent is BlueDental's, not the reference's.** The layout, geometry and
neutrals are cloned, but the primary colour follows BlueDental's own sidebar
navy rather than the reference's blue, so the catalog screens sit inside the
product's brand instead of next to it:

| Role | BlueDental | Reference |
|------|-----------|-----------|
| `--color-app-primary` | `#1C3566` (= `--bd-primary`) | `#2671D8` |
| `--color-app-primary-dark` | `#142A54` | `#1E5BB0` |
| `--color-app-primary-soft` | `#EAF0FA` | `#E7F0FB` |

The neutrals (`ink`, `label`, `line`, `surface`, `icon`, `danger`) are taken
from the reference unchanged — they are greys, and matching them is what keeps
the two layouts measurably identical.

### Tab strip

- Container `border-b border-[#DCE3EE] bg-white px-5`, `h 50`.
- Tab `px-4 py-3.5 text-[14px] font-semibold`, `h 49`, `whitespace-nowrap`.
- Inactive `text-[#475569]`; active `bg-[#E7F0FB] text-[#2671D8]` plus an
  absolutely positioned `h-[2px] rounded-t-full bg-[#2671D8]` at the bottom.
- Each tab is a **link** to `/taxonomy/<slug>`, not a client-side tab control.

### Group panel (left, `w-[272px]`)

- Header `h-[134px] p-4 border-b`: title `text-[16px] font-semibold`, count
  `text-[12px]` right-aligned on the same baseline, subtitle `text-[14px]`,
  then a search field and a `size-10 rounded-lg bg-[#2671D8]` add button.
- Search input carries a **floating label**: it rests inside the field beside
  the magnifier and lifts onto the border on focus or when filled.
- Row `flex items-center gap-2.5 rounded-lg px-3 py-2.5`, folder icon,
  `text-[14px] font-medium`, plus an overflow button and a drag grip that both
  appear on hover. **No item count is shown per row.**
- Active row `border-l-[3px] border-[#2671D8] bg-[#E7F0FB]
  pl-[calc(0.75rem-3px)] text-[#1E5BB0]`, name `font-semibold`.
- Empty: centred `folder-open` icon `size-8 text-[#C5D0DE]` + "Chưa có nhóm nào".

### Entry panel (right)

- Header `border-b bg-white px-4 py-4 md:min-h-[134px]`:
  `h1 text-[18px] font-bold md:text-[20px]`, a `h-5 rounded-full
  bg-[#E7F0FB] px-2 text-[11px] font-semibold text-[#2671D8]` count badge,
  subtitle "Quản lý các mục thuộc nhóm **{group}**", then `Xuất` (outline,
  download icon) and `Thêm {noun}` (primary, plus icon), both `h-10 rounded-lg`.
- Search field below, `md:max-w-[360px]`, same floating label.
- Body `p-3 md:p-5` holding one card: `rounded-[16px] border border-[#DCE3EE]
  bg-white shadow-[0_2px_6px_rgba(27,42,65,0.06)]`.

### Table

- `border-separate border-spacing-0`.
- `th` `h-10 sticky top-0 bg-[#F6F8FB] px-4 text-[14px] font-medium
  text-[#5A6B82]`.
- `td` `h-14 border-b border-[#DCE3EE] px-4 py-3 text-[14px] text-[#1B2A41]`;
  measured row pitch 57 px.
- Columns: `[grip] · Tên {noun} · Nhóm phân loại · [Giá] · Cập nhật gần nhất ·
  Thao tác`. **Giá appears only on priced catalogs** (dịch vụ, loại thuốc).
- Name cell: `size-8 rounded-lg` initial square + `truncate font-medium` name.
- Nhóm phân loại: `h-6 rounded-md bg-[#F6F8FB] px-2.5 text-[12px]` badge.
- Giá: right-aligned, `font-semibold`, formatted `35.000.000 đ`.
- Cập nhật gần nhất: `dd/MM/yyyy HH:mm`, `text-[#5A6B82]`.
- Thao tác: `sticky right-0` with
  `shadow-[-4px_0_6px_-2px_rgba(27,42,65,0.06)]`; a `size-7` pencil
  (`text-[#5A6B82]`) and a `size-7` trash (`text-[#E5484D]`).
- Empty: one `h-32` centred cell reading "Không có dữ liệu".

### Pagination footer (inside the same card)

`border-t bg-[#F6F8FB] p-3 md:flex-row md:justify-between`

- Left: `h-8 rounded-lg` native `<select>` with `5/10/20/25/50/100 / trang`
  (default 20), then "Hiển thị **1**–**5** trên **5** bản ghi".
- Right: `Trước` and `Sau` (`h-8 px-3 rounded-md text-[13px]`, disabled at the
  ends) around `size-8` page buttons; the current page is
  `bg-[#2671D8] text-white font-semibold`.
- When the list is empty the page-size select is not rendered.

### Initial keyboard/mobile shape

- Below `md` the group panel is hidden and reached through a "Chọn nhóm"
  disclosure in a bar above the entry header.
- The reference opens on the **first group**, not on a combined "all groups"
  view.

---

### Flat sub-routes (no group panel)

Three sub-routes are one table with no `aside` at all. Observed 2026-08-24 on
staging, read-only.

**`/taxonomy/prescription-template`** — still taxonomy-backed, but the panel and
the "Nhóm phân loại" column are dropped; the title is the tab label and there is
no subtitle. Columns: `[grip] · Tên đơn thuốc mẫu · Cập nhật gần nhất · Thao tác`.
Its closest sibling `/taxonomy/medical-record-template` **keeps** its groups, so
this is per-catalog, not a rule about templates.

**`/taxonomy/tags`** — own record shape.

- Header `border-b bg-white px-4 py-4`: `lucide-tag size-5` + `h1 text-[20px]
  font-bold` "Quản lý Thẻ hồ sơ", subtitle "Tạo và quản lý danh mục thẻ hồ sơ.",
  and a `h-9` primary "Thêm tag" on the right. Search below, `md:max-w-[360px]`,
  "Tìm tag theo tên hoặc mã màu...".
- Columns: `Tên tag · Màu · Thao tác`. Empty: "Không tìm thấy tag nào".
- Footer counts "thẻ hồ sơ" rather than "bản ghi".
- Dialog "Thêm thẻ hồ sơ mới": one required name, a row of eight `size-10
  rounded-full` swatches (`#EF4444 #F59E0B #10B981 #3B82F6 #6366F1 #A855F7
  #EC4899 #64748B`, default `#3B82F6`, selected gets `ring-2 ring-offset-2
  ring-[#1B2A41]`), a pipette button wrapping `<input type="color">`, and a live
  preview badge in a `rounded-xl bg-[#F6F8FB] p-4` box.

### Dialog "Tạo nhóm" (nhóm phân loại) — observed 2026-08-24

Title `Tạo nhóm`, an X at the top right, a hairline under the header and another
above the footer. The body is two floating-label fields side by side:

| Field | Notes |
|---|---|
| `Tên phân loại` | required, red asterisk after the label |
| `Mức độ ưu tiên` | numeric, prefilled `0` |

The footer holds a single right-aligned primary button, `Lưu`, with a
floppy-disk icon; it renders pale while the name is empty. There is no `Huỷ`
button and no description line — the X is the way out.

`Mức độ ưu tiên` is the group's sort order: the panel lists groups by it and
falls back to the name on a tie. Dragging a group rewrites it, because the
position in the panel *is* the priority.

### Reordering — group panel and entry table (2026-08-24)

A drag lifts the row and it follows the pointer on **both** axes, while the rows
it passes move out of its way as it goes; the order is not settled on release.
Releasing sends **one** request carrying the whole list — see the payload in
`docs/clone/api.md`. BlueDental matches all of it.

Searching the group panel is a server query (`filter=`), not a filter over the
rows already on screen, so it finds groups that are not in the current page.
The term is trimmed and case-folded, and each word is matched against every
column the row shows, in any order — `TRÁM RĂNG` and `răng trám` both find
"Trám răng composite". A row has to carry every word.
While a search is active the grip is disabled: positions in a filtered list are
not positions in the catalog.

**`/taxonomy/payment-method`** — own record shape, two tabs over one list.

- Header as above with `lucide-credit-card`, "Quản lý phương thức thanh toán",
  subtitle "Tạo và quản lý tài khoản MoMo, ngân hàng dùng khi thanh toán.", and a
  `h-10` primary "Thêm phương thức". **No search box.**
- Body `space-y-4`; a segmented MoMo / Ngân hàng control sits above the card.
- MoMo columns: `Số điện thoại · Tên chủ tài khoản · Lần cập nhật cuối · Thao tác`;
  empty "Không có phương thức MoMo".
- Bank columns: `Tên ngân hàng · Tên chủ tài khoản · Số tài khoản · Lần cập nhật
  cuối · Thao tác`.
- Table is `min-w-[760px]`; the date column shows `dd/MM/yyyy` only.
- Dialogs: MoMo asks Số điện thoại* + Tên chủ tài khoản*; Bank asks Tên ngân
  hàng* + Tên chủ tài khoản* + Số tài khoản*. Both also offer "Tải ảnh QR".
- "Tải ảnh QR" is built (2026-08-24): a dashed drop box until an image is
  chosen, then a `size-24` preview with "Đổi ảnh" / "Xoá ảnh". The image is a
  second call — `POST|DELETE /api/v1/app/payment-accounts/{id}/qr-image`, bytes
  in MinIO — because a new account has no id to attach bytes to until it has
  been created. Accepted types, size cap and the absence of a QR table column
  are BlueDental's assumptions; see `docs/clone/unknowns.md`.
- The footer sentence carries **no** counted noun — "Hiển thị 0 trên 0".

### Empty-list footer

With zero rows the reference still renders the page-size select, drops the page
number buttons, and switches the sentence from a range to a count:
"Hiển thị **0** trên **0** bản ghi".

---

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
| Thêm dịch vụ | Button | Opens the service dialog — see "Dialog Thêm dịch vụ" below (staging, 2026-09-24) |
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

### Dialog "Thêm dịch vụ" / "Sửa dịch vụ" — staging, 2026-09-24

Observed on staging.nfcdental.com after the owner reported the dialog had
changed (screenshot supplied). Nothing was saved there; the fields were only
opened and read. The earlier version of this dialog (documented in
`docs/testing/03-regression-log.md` R-42…R-91) is superseded by this one.

Header row (unchanged): `Dịch vụ *` · `Phân loại dịch vụ *` · `Tên chi tiết`,
then the `Đang hoạt động` / `Đã xoá` pair, `Mô tả`, `Mức độ ưu tiên`.
**The `Mã dịch vụ` box is gone** — the code is generated by the server and is
never editable. The "Cấu hình giá & thuế" block is unchanged (% thuế, Trước
thuế / Sau thuế, Giá, % / VNĐ, Giảm giá, Giá sau giảm, Đơn vị, Thực thu từ
khách).

**`Giá sau giảm` and `Thực thu từ khách (Đã gồm VAT)` are computed live** —
every keystroke in Giá / Giảm giá, and every change of % thuế or the
Trước thuế / Sau thuế toggle, updates both read-only boxes at once; a new
dialog starts at `0` / `0`. Formula, measured on staging 2026-09-24 by typing
into the dialog (whole-đồng rounding on screen):

```
net  = discountIsPercent ? price × (1 − d/100) : price − d      (never below 0)
rate = 5 | 8 | 10 for "5%" / "8%" / "10%", else 0 (KCT, KKKNT, 0%)
Trước thuế:  Giá sau giảm = net              Thực thu = net × (1 + rate/100)
Sau thuế:    Giá sau giảm = net ÷ (1 + rate/100)   Thực thu = net
```

| Giá | Giảm giá | % thuế | Toggle | Giá sau giảm | Thực thu |
|---|---|---|---|---|---|
| 1.000.001 | 33 % | KCT | Trước | 670.001 | 670.001 |
| 1.000.001 | 33 % | 10% | Trước | 670.001 | 737.001 |
| 1.000.001 | 33 % | 10% | Sau | 609.092 | 670.001 |
| 1.000.001 | 150.000 VNĐ | 10% | Sau | 772.728 | 850.001 |
| 1.000.001 | 150.000 VNĐ | 10% | Trước | 850.001 | 935.001 |
| 909.091 | 20.000.000 VNĐ | 10% | Trước | 0 | 0 |
| 1.000.000 | 5 % | 10% | Sau | 863.636 | 950.000 |

The last row was saved once (then soft-deleted): the API stored the typed
price and `taxConfig: "afterTax"` unchanged and answered
`priceAfterDiscount: 863636.36`, `actualCustomerPayment: 950000` — two
decimals server-side, whole đồng in the dialog. Nothing is normalised on save.

Also seen on that save: staging **keeps the dialog open** after a create
(title still "Thêm dịch vụ", `Lưu` disabled, a new `Đồng bộ dịch vụ này`
button beside it). BlueDental closes the dialog on save; not adopted in this
pass (`reference-private/staging-service-after-save.png`).

Four tabs — the fourth is new:

| Tab | Content |
|---|---|
| Cài đặt | four checkboxes (unchanged) |
| Công đoạn | see below |
| Bảo hành | unchanged |
| **Labo** | one multi-select `Nhà cung cấp Labo` (search icon 20px at the left, a × "Xóa lựa chọn" and a chevron at the right) whose box shows a count, `Đã chọn N nhà cung cấp`, instead of tags. The picks sit **under** the box as a wrapping row of pills (12px below, 8px apart): 29px tall, `padding 6px 12px`, radius 9999px, 1px border + text in link blue (`#2671d8` / `#2f66e7`) on `#f3f8ff`, 10px/600, name truncated at 150px, a 14px × ("Bỏ chọn nhà cung cấp", red on hover) after the name. Then, 12px lower, the amber note (13px, `#d97706`) with a 16px info-circle icon 6px before the text: "Để trống nếu dịch vụ này được chọn tất cả nhà cung cấp khi tạo phiếu labo." Options come from `GET /v1/labos/?branchId=…&perPage=100&orderBy=name:asc` (branch's suppliers). Measured on staging 2026-09-24 (`reference-private/staging-service-labo-tags.png`). |

**Công đoạn tab**

- `Tính doanh số trên công đoạn` — hint "Bác sĩ sẽ nhận hoa hồng trên toàn bộ công đoạn được hoàn thành".
- `Yêu cầu tuần tự công đoạn` — two hint lines: "Tắt: Bác sĩ chỉ nhận hoa hồng trên các công đoạn dịch vụ đã hoàn thành" and "Bật: Bác sĩ sẽ nhận hoa hồng trên các công đoạn dịch vụ đã hoàn thành theo thứ tự".
- A floating-label text box `Công đoạn` (max 100 chars) with a primary `+ Công đoạn` button beside it; Enter in the box adds the row too. The box is emptied after each add.
- Table, 13 px text, header 40 px, rows 56 px:

| Column | Width | Content |
|---|---|---|
| STT | 60 | 1-based, muted |
| Tên công đoạn | fill | plain text; becomes an inline text box while the pencil is active (Enter / blur commits, empty is ignored) |
| Giá trị | 260 | a `%` / `VNĐ` two-way toggle **and** a number box. A new row starts on `%`. `%` is capped at 100; switching an amount to `%` clamps it to 100. `VNĐ` stops accepting keystrokes after ten digits (9.999.999.999) — observed on staging 2026-09-24 by typing digits into the box; a pasted longer value is rejected whole and the box keeps its old value. |
| Thao tác | 124, centred | pencil "Sửa tên công đoạn", star "Tính lương cho phòng MKT" (filled amber when on), red bin |

- Footer: `Hiển thị a trên b` · page-size menu 5 / 10 / 20 / 25 / 50 / 100 (20 by default) · prev / page / next.
- Empty table shows "Chưa có công đoạn nào".

Wire shape (structure only) on `care-service` items:

```json
{
  "laboIds": ["<uuid>"],
  "stages": [
    { "id": "<uuid>", "name": "<string>", "value": 30,
      "valueType": "percentage" | "value", "isMarketingSalary": true }
  ]
}
```

BlueDental: `ServiceConfigDto.laboSupplierIds: Guid[]`,
`ServiceStageDto.valueType: 0 = Percentage, 1 = Amount`,
`ServiceStageDto.isMarketingSalary`. A supplier id outside the branch is refused
with `BlueDental:Catalogs:0025`; a percentage above 100 with `Catalogs:0021`.
Components: `ServiceDialog` → `ServiceStageTable` (table) + `ServiceLaboTab`.

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
| 1 | "Thêm dịch vụ" form fields | Resolved 2026-09-24 on staging — see "Dialog Thêm dịch vụ" |
| 2 | "Thêm thao tác" group actions | Not clicked |
| 3 | Service item price/alias/color fields | Not observed |
| 4 | Ngân hàng tab columns (payment-method) | Not clicked |
| 5 | Medicine group record counts (except Kháng Viêm) | Not navigated |
| 6 | Drag-to-sort behavior | Not tested |
| 7 | "Thêm tag" form fields | Not opened |
| 8 | "Tạo nhà cung cấp" / "Tạo vật liệu" forms | Not opened |

### Bệnh án mẫu — tờ A4 (quan sát kỹ 2026-08-25)

Dialog `Thêm mẫu bệnh án` chứa **ba trang A4** rời nhau, mỗi trang `794 × 1053px`
(A4 ở 96dpi), vùng nội dung rộng `703px`, chữ `14px/19.6px`. Không phải biểu mẫu
bệnh án nội trú của Bộ Y tế như đoán ban đầu — đây là **bệnh án ngoại trú chuyên
khoa răng hàm mặt**.

**Trang 1**
- Đầu trang 3 cột: `Sở Y Tế TP.HCM / PK RHM Thuộc Công Ty TNHH / **Nha Khoa NFC Dental**`
  · giữa `**BỆNH ÁN NGOẠI TRÚ**` (18px) + `**CHUYÊN KHOA RĂNG HÀM MẶT**`
  · phải `Số ngoại trú: ......... / Số lưu trữ: ...........`
- `I. HÀNH CHÍNH:` 13 mục, dùng ba loại ô in sẵn:
  `.grid-box` 20×20 viền liền (ô ghi chữ số ngày sinh, tuổi, mã tỉnh/huyện) ·
  `.box` 15×15 (ô tích) · `.dotted-line` gạch chân chấm 1px.
  Mục 9 có 4 ô tích `1. BHYT · 2. Thu Phí · 3. Miễn · 4. Khác`; mục 13 có
  `1. Y tế ☐ 2. Tự đến ☑` (mặc định tích "Tự đến").
- `II. LÝ DO VÀO VIỆN:` · `III. HỎI BỆNH:` (1. Quá trình bệnh lý, 2. Tiền sử bệnh
  → + Bản thân, + Gia đình)
- `IV. KHÁM BỆNH:` — sinh hiệu nằm trong **hộp có viền bên phải**, không phải một
  hàng ngang dưới tiêu đề: `Mạch: … lần/phút`, `Nhiệt độ: … °C`, `Huyết áp: … mmHg`,
  `Nhịp thở: … lần/phút`, `Cân nặng: … Kg`, mỗi dòng một gạch chân và đơn vị bên phải.
  `1. Toàn thân:` cùng ô nhập và hai gạch chân của nó nằm ở cột trái, cạnh hộp đó
  (trong DOM bản gốc là `.vital-signs` thả float phải, đóng lại bằng `div.clear`).
- `2. Bệnh chuyên khoa:` bắt đầu bên dưới, trải hết bề ngang

**Trang 2** — `TỔNG KẾT BỆNH ÁN:` 6 mục (mục 3 tách `- Bệnh chính` và
`- Bệnh kèm theo`), rồi bảng `Hồ sơ, phim, ảnh | Người giao hồ sơ | Ngày ... tháng
... năm ... / Bác sỹ điều trị` với các dòng `Loại | Số tờ`: X-quang · CT Scanner ·
Siêu âm · Xét nghiệm · Khác · Toàn bộ hồ sơ.

Cột `Người giao hồ sơ` chứa `Người giao hồ sơ:` / `Họ tên:` **có gạch chân** /
`Người nhận hồ sơ:` / `Họ tên:` **có gạch chân** — hai tiêu đề này nằm trọn một
dòng, nên cột phải đủ rộng (~24% bề ngang bảng, cột `Loại` ~38%, `Số tờ` ~14%).
Cột cuối chỉ có `Họ tên:` kèm gạch chân, **căn giữa theo chiều dọc**.

**Trang 3** — `3. Hình vẽ mô tả tổn thương khi vào viện` (khung vẽ tay, nhãn
`Phải · Thẳng · Trái · Hàm trên và Họng · Hàm dưới`) + chú giải
`Phân loại khe hở môi vòm miệng` 5 dòng · mục 4–7 · hai khối ký
`ĐẠI DIỆN CƠ SỞ KHÁM CHỮA BỆNH` và `BÁC SỸ KHÁM BỆNH`.

**Ô nhập được: đúng 17**, tô nền vàng `#FFFDE7` kèm gạch chân chấm. Mọi gạch chân
khác là để viết tay, không lưu gì. Danh sách placeholder theo thứ tự:

`Nhập thông tin người nhà...` · `Nhập chẩn đoán nơi giới thiệu...` ·
`Nhập lý do vào viện...` · `Nhập quá trình bệnh lý...` (III.1) ·
`Nhập tiền sử bản thân...` · `Nhập tiền sử gia đình...` · `Nhập khám toàn thân...` ·
`Nhập khám chuyên khoa...` · `Nhập quá trình bệnh lý...` (tổng kết 1) ·
`Nhập kết quả xét nghiệm...` · `Nhập bệnh chính...` · `Nhập bệnh kèm theo...` ·
`Nhập phương pháp điều trị...` · `Nhập tình trạng ra viện...` ·
`Nhập hướng điều trị tiếp...` · `Nhập tóm tắt bệnh án...` ·
`Nhập chẩn đoán khoa khám bệnh...`

Dòng gợi ý trên đầu: `💡 Nhấp vào các ô [nền vàng] để chỉnh sửa trực tiếp trên bệnh án`
— chữ "nền vàng" nằm trong một chip tô đúng màu đang nói tới. Thanh zoom bên phải
cùng hàng: `−  90%  Fit  +`.

### Hộp xác nhận xoá (quan sát 2026-08-25)

Tiêu đề `Xác nhận xoá nhóm` + nút `X`. Câu hỏi:
`Bạn có chắc muốn xoá nhóm **{tên}** không?` — tên bản ghi **in đậm** ngay trong câu.
Dòng dưới, chữ nhỏ màu xám: `Hành động này không thể hoàn tác.`
Chân hộp: `Huỷ` nền xanh nhạt chữ xanh, và `Xoá` **nền đỏ** có icon thùng rác.

BlueDental dùng chung `ConfirmDeleteDialog` cho nhóm, mục danh mục, thẻ hồ sơ và
phương thức thanh toán. Chỉ hộp của *nhóm* được quan sát; các danh mục khác dùng
lại đúng khung đó với danh từ tương ứng — ghi nhận là suy diễn.

### Thứ tự danh sách

Nhóm và mục danh mục sắp theo `Mức độ ưu tiên` tăng dần, **rồi theo thời gian tạo
giảm dần**. Nghĩa là bản ghi vừa thêm (mang mức ưu tiên mặc định 0) hiện ngay đầu
danh sách, còn ai đặt mức ưu tiên rõ ràng thì mức ưu tiên vẫn thắng. Thẻ hồ sơ
sắp thuần theo thời gian tạo giảm dần. Điều này khớp với danh sách dịch vụ quan sát
được trên bản gốc, nơi bản ghi cập nhật gần nhất nằm trên.

## Nhập từ Excel — BlueDental riêng (2026-09-24)

Không có trên bản gốc; thêm theo yêu cầu BA (xem `docs/clone/unknowns.md` và
`docs/testing/features/taxonomy.md` § Nhập từ Excel). Nút "Nhập" (icon upload)
đứng giữa "Xuất" và "Thêm …" trên 8 tab: Dịch vụ, Chẩn đoán, Loại thuốc, Dữ
liệu tư vấn, Nguồn đến, Lịch sử bệnh, Đơn thuốc mẫu, Nghề nghiệp. Ẩn khi tài
khoản không có quyền `create` của tab; disabled khi header đang ở "Tất cả chi
nhánh". Dialog: Steps (Chọn file → Kiểm tra → Hoàn tất), `Upload.Dragger`
nhận `.xlsx`, link "Tải file mẫu"; bước Kiểm tra là dry-run trên server, bảng
xem trước ảo hoá (không giới hạn dòng), lọc "Chỉ hiện dòng lỗi", "Tải file
lỗi"; nút "Nhập N dòng" chỉ mở khi 0 lỗi và N > 0 (N = thêm mới + cập nhật +
khôi phục). Cột "Kết quả" đứng cuối và ghim bên phải (sau cột "Lỗi"), cột
"Dòng" ghim bên trái; kéo ngang chỉ cuộn các cột giá trị. Cột "Kết quả" có 6 tag: Thêm mới (xanh lá), Cập nhật (cam — dòng
đã có nhưng khác cột khác), Khôi phục (xanh dương), Bỏ qua (không thay đổi),
Dòng thuốc, Lỗi (đỏ).


## Đồng bộ danh mục dịch vụ — staging, 2026-09-25

Nút mới trên tab Dịch vụ, gửi danh mục sang **hệ thống đối tác** mà chi nhánh
đã kết nối (trong bundle gọi là "System"; mục đích ghi ngay trong dialog sửa:
"để các hoá đơn phát sinh sau đó lấy đúng thông tin dịch vụ mới bên đối tác").
Quan sát chỉ đọc: mở trang, mở dialog, mở rộng một nhóm, mở dialog sửa — không
tick để gửi, không bấm "Đồng bộ", không bấm "Lưu". Hành vi sau khi bấm đọc từ
bundle (`06cb92cc3a716474.js`, `1771691db5e52bda.js`). Ảnh:
`reference-private/sync-catalog/01…04` (bản gốc) và `local-01…08` (BlueDental).

### Khi nào có nút

- `GET /v1/clinic-integration/sync/{branchId}/flags` lúc vào trang; nút chỉ
  render khi `serviceCatalogSyncEnabled === true`
  (`isClinicIntegrationSyncEnabled(flags, "service-catalog")`).
- Vị trí: đầu hàng nút, trước "Xuất". Icon database 16px + "Đồng bộ danh mục
  dịch vụ". Đang gửi: icon giữ nguyên, chữ thay bằng spinner, nút bị khoá.
- BlueDental: thêm điều kiện tài khoản có `catalogService.update` (bản gốc
  không gate theo quyền — xem unknowns); khoá khi header đang "Tất cả chi nhánh".

### Dialog "Chọn danh mục dịch vụ cần đồng bộ"

- Rộng tối đa 672px (`sm:max-w-2xl`), cao tối đa 85vh, danh sách cuộn bên trong.
- Header: tiêu đề + mô tả "Chọn cả taxonomy hoặc mở rộng để chọn từng dịch vụ.";
  bên phải nút "Chọn tất cả" ↔ "Bỏ chọn tất cả" (khoá khi đang tải hoặc không
  có dịch vụ nào có mã). Header chừa `pr-8` cho nút X.
- Ô tìm "Tìm theo tên hoặc mã dịch vụ..." — lọc **trên trình duyệt**, không
  phân biệt hoa thường, theo tên hoặc mã dịch vụ (không theo tên nhóm); nhóm
  không còn dịch vụ khớp thì ẩn; đang tìm thì mọi nhóm còn lại tự mở. Khoá khi
  đang tải.
- Danh sách lấy từ `GET …/service-catalog-groups` **mỗi lần mở dialog**. Trạng
  thái: spinner (cao 160px) · "Chưa có taxonomy dịch vụ." · "Không tìm thấy dịch
  vụ phù hợp.".
- Mỗi nhóm: hàng cao ≥48px, padding ngang 16px, gap 12px: checkbox
  (aria-label "Chọn taxonomy {tên}", trạng thái nửa chừng khi chọn một phần,
  khoá khi nhóm không có dịch vụ nào có mã) · tên nhóm đậm 14px · "đã chọn /
  số dịch vụ có mã" 12px · chevron xoay 180° khi mở. Nhóm mở: nền xám nhạt,
  "Taxonomy này chưa có dịch vụ." nếu rỗng.
- Mỗi dịch vụ: hàng cao ≥40px — checkbox, tên (cắt …), bên phải mã (mono 12px)
  hoặc "Chưa có mã" (cam 12px). Dịch vụ chưa có mã mờ 60%, không tick được.
  **Dịch vụ đã xoá mềm vẫn được liệt kê và chọn được.**
- Tick nhóm = chọn/bỏ mọi dịch vụ có mã **của cả nhóm** (kể cả khi đang lọc).
- Footer: trái "Đã chọn N dịch vụ"; phải "Huỷ" và "Đồng bộ" (khoá khi N = 0).
  Bấm "Đồng bộ" gửi rồi **đóng dialog ngay**, trạng thái chờ hiện trên nút ở
  thanh công cụ. **BlueDental lệch có chủ ý (yêu cầu chủ dự án 2026-09-25,
  CLAUDE.md §16.18):** dialog giữ nguyên, nút thành "Đang đồng bộ..." + spinner
  và bị khoá, ô tìm / checkbox / "Chọn tất cả" / "Huỷ" khoá theo; có kết quả mới
  đóng và mở dialog kết quả; lỗi API thì dialog ở lại để thử lại.
- Danh sách nhóm được ảo hoá (`@tanstack/react-virtual`, CLAUDE.md §16.9): chỉ
  render các hàng đang thấy; nhóm gập không render lại khi tick ở nhóm khác. Đóng dialog xoá hết lựa chọn, ô tìm và nhóm đang mở.
- Payload: nhóm được tick đủ → `taxonomyIds`; nhóm tick một phần → từng id
  trong `serviceIds`. Mỗi khoá chỉ gửi khi có phần tử.

### Sau khi gửi

Toast theo thứ tự (đọc từ bundle):

1. Có dịch vụ bị bỏ qua **kèm lý do** → warning "{n} dịch vụ bị bỏ qua khi đồng
   bộ", mô tả là các lý do nối bằng "; ".
2. Rồi đúng một trong: `sent = 0` và `skipped = 0` và `total > 0` → error
   "Đồng bộ thất bại: 0/{total} dịch vụ được ghi nhận" · `sent = 0`, không lý do
   nào, `skipped > 0` → success "Không có thay đổi — {skipped}/{total} dịch vụ đã
   đồng bộ từ trước" · `sent > 0` → success "Đã đồng bộ {sent}/{total} dịch vụ".
3. Lỗi API → toast lỗi API (fallback "Đồng bộ danh mục dịch vụ thất bại").

Rồi mở dialog **"Kết quả đồng bộ danh mục dịch vụ"** (rộng tối đa 768px, không có
footer):

- Nếu có `batchErrors`: hộp đỏ "Lỗi trong quá trình đồng bộ", mỗi dòng
  "{reason} — {message}".
- 7 ô số (lưới 2 → 4 → 7 cột): Tổng cộng (mực) · Đã gửi (xanh lá) · Cập nhật
  (xanh dương) · Thất bại (đỏ) · Trùng mã (hổ phách) · Cảnh báo (hổ phách) · Bỏ
  qua (xám).
- Tab: Trùng mã · Cảnh báo · Đã đồng bộ trước · Đã cập nhật. Mở trên tab đầu
  tiên có dữ liệu theo thứ tự Trùng mã → Cảnh báo → Đã cập nhật → Đã đồng bộ
  trước.
- Bảng: Trùng mã = Mã dịch vụ · Tên bên Dental · Tên trùng bên System; Đã cập
  nhật = Mã dịch vụ · Mã bên Dental · Ghi chú ("Đã liên kết lại với bản ghi có
  sẵn bên Dental" màu hổ phách khi `relinked`, "—" nếu không); Cảnh báo / Đã
  đồng bộ trước = Mã dịch vụ · Lý do. Rỗng: "Không có dữ liệu".

### Khi đối tác từ chối — ảnh chủ dự án gửi, staging 2026-09-25

Chủ dự án bấm "Đồng bộ" trên staging (không phải phiên quan sát này) khi đối tác
không còn nhận kết nối của phòng khám. Cùng lúc đó `flags` của staging **vẫn** trả
`status: "active"` và cả hai cờ bật — tức lỗi đến từ phía đối tác, không phải từ
phía Dental. Hành vi:

- Request thành công (không có toast lỗi API); mọi dịch vụ được chọn tính là
  **Thất bại** (6/6 trong ảnh, `Đã gửi` 0, `Bỏ qua` 0).
- Toast: "Đồng bộ thất bại: 0/{total} dịch vụ được ghi nhận".
- Dialog kết quả vẫn mở, trên cùng là hộp đỏ "Lỗi trong quá trình đồng bộ" với
  một dòng `CLINIC_CONN_0001 — Kết nối không tồn tại hoặc chưa được kích hoạt.` —
  tức `batchErrors[0] = { reason: <mã lỗi của đối tác>, message: <thông điệp> }`;
  tab mở ở "Trùng mã", bảng "Không có dữ liệu".
- Đồng bộ đơn lẻ từ dialog sửa: cùng toast "Đồng bộ thất bại: 0/1 dịch vụ được ghi
  nhận"; dialog vẫn đóng (bundle đóng dialog khi request thành công, bất kể kết quả).

BlueDental: khi đối tác trả lỗi (HTTP không 2xx, hoặc 2xx không có `results`) kèm
body `{ code, message }` / `{ errorCode, message }` / `{ error: { code, message } }`,
`reason` là mã đó và `message` là thông điệp đó; không có body như vậy thì
`reason` = "Không gửi được lô n/m", `message` = status + đoạn đầu body.

### Trong dialog sửa / thêm dịch vụ (khi cờ đồng bộ bật)

- Chế độ sửa: hộp cảnh báo vàng trên cùng, tam giác ⚠ + "**Lưu ý:**", dòng dưới
  "Sau khi cập nhật, hãy bấm "Đồng bộ dịch vụ này" để các hoá đơn phát sinh sau
  đó lấy đúng thông tin dịch vụ mới bên đối tác."
- Lưu (thêm hoặc sửa) thành công → dialog **không đóng**; "Lưu" bị khoá; bên
  trái nó hiện nút viền "Đồng bộ dịch vụ này" (icon refresh, tooltip "Đồng bộ
  dịch vụ này tới đối tác"). Bấm → gửi `{ serviceIds: [id] }`, cùng các toast ở
  trên, **không** mở dialog kết quả, thành công thì đóng dialog.
- Cờ tắt → dialog giữ hành vi cũ (đóng khi lưu). Đây là lý do ghi chú 2026-09-24
  ở trên thấy staging giữ dialog mở sau khi tạo.

### Mã dịch vụ

Bản gốc sinh mã phía server (5 ký tự chữ + số, ví dụ `VLE8y`). Trước đây
BlueDental chỉ ghi mã client gửi, nên dịch vụ tạo từ dialog không có mã và
không đồng bộ được. Nay server sinh mã khi tạo dịch vụ (dialog và nhập Excel)
nếu không có mã; nhập Excel để trống ô "Mã dịch vụ" không xoá mã đã có.
Dịch vụ cũ không có mã giữ nguyên ("Chưa có mã"), như bản gốc.

### Cấu hình kết nối

Không có màn nào trên staging (xem unknowns). BlueDental có API
`api/v1/app/connections` (quyền `BlueDental.ClinicIntegration.ManageConnections`),
chưa có giao diện. Hợp đồng với đối tác: docs/clone/api.md § Clinic integration.

Components: `ServiceCatalogSyncButton` → `ServiceCatalogSyncDialog`
(+ `ServiceSyncGroupRow`, `useServiceSyncSelection`) → `ServiceCatalogSyncResultDialog`
(+ `ServiceSyncResultTable`); `ServiceDialog` + `useServiceDialogSync`; logic chọn
thuần trong `features/taxonomy/serviceCatalogSync.ts`.
