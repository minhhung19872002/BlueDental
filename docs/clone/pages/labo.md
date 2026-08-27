# Labo — /labo

Reference: `https://app.nfcdental.com/labo/mau-labo?branchId=<id>`
Observed: 2026-08-27 (read-only session; no production record was created, edited or deleted)
Screenshots + extracted bundles: `reference-private/survey-labo/`

Every fact below is either seen in the running page or read out of the shipped
client bundle (`_next/static/chunks/fdc1fdcd4a190d4f.js`, which holds all six
Labo sub-pages, plus `2678e47ff7b8593c.js` for the tab table and
`371d50d53d0310c9.js` for the print sheet). Where a behaviour could only be
proven by mutating production it is marked `UNKNOWN_REFERENCE_BEHAVIOR`.

---

## 1. Route & shell

`/labo` redirects to `/labo/mau-labo`. Six sub-routes, each its own URL:

| # | id | Label | Permission subject |
|---|----|-------|--------------------|
| 1 | `mau-labo` | Mẫu Labo | `laboTemplate` |
| 2 | `supplier` | Nhà cung cấp Labo | `laboSupplier` |
| 3 | `bite` | Khớp cắn Labo | `laboBite` |
| 4 | `finish-line` | Đường hoàn tất | `laboFinishLine` |
| 5 | `nhip` | Kiểu nhịp Labo | `laboRhythm` |
| 6 | `service-material` | Dịch vụ - vật liệu | `laboMaterial` |

- A tab is rendered **only** when `can(policySubject, "read")`. Tabs are not
  disabled — they are absent.
- Each tab link carries the **whole current query string** forward, so
  `branchId` and the date-mode params survive a tab switch.
- Tab bar: `border-b #DCE3EE`, white, `px-5`; tab `px-4 py-3.5`, `13.5px`,
  `font-medium`; active = `bg #E7F0FB`, `text #2671D8`, `font-semibold`, plus a
  2px bottom bar `#2671D8` with rounded top corners. Row scrolls horizontally.

---

## 2. `/labo/mau-labo` — Mẫu Labo

The reference has **no create button on this screen.** Labo orders are created
from the patient's Labo tab / treatment plan. This screen lists, filters,
exports, and lets you open one order to change its status and attach photos.

### 2.1 Toolbar

Left: `Ngày | Tuần | Tháng` segmented switch + period control.
Right: `Xuất Excel` — rendered only when `can("laboTemplate","export")`.

The period control has two states:

- **No mode chosen** (default): a single disabled button reading
  `Chọn thời gian`, no date filter is sent.
- **A mode chosen**: replaced by a stepper — `‹` · `<calendar icon> label` · `›`.
  Labels: `27/08/2026` (day), the week range (week), `08/2026` (month).
  Arrow aria-labels: `Ngày trước`/`Ngày kế tiếp`, `Tuần …`, `Tháng …`.

Mode + anchor live in the URL, namespaced by tab id:
`?mau-labo_dateMode=day&mau-labo_date=2026-08-27`.
Page and page size use the same `mau-labo_`-prefixed convention.

### 2.2 Status filter tabs

| Tab | value | sent as |
|-----|-------|---------|
| Tất Cả Mẫu | `all` | *(no `status` param)* |
| Mẫu Chưa Nhận | `chua-nhan` | `status=created` |
| Mẫu Giao Trễ | `giao-tre` | `status=lateDelivery` |
| Mẫu Đã Nhận Hàng | `da-nhan` | `status=delivered` |

Beside them, two 240px comboboxes:

- **Chọn khách hàng** — server-searched, paged (`hasNext`), clearable, search
  icon; option label is `[<patientCode>] - <name>`; sends `patientId`.
- **Chọn bác sĩ** — clearable; sends `staffId`.

Both use the floating-label outlined field: the placeholder rises into the
border as a legend when the field is focused or filled, and the dropdown has
its own `Tìm kiếm` box at the top.

### 2.3 List request

```
GET /api/v1/orders
  ?page=1&perPage=20
  &branchId=<id>
  &orderBy=createdAt:desc            # availableOrderBy: createdAt, updatedAt, estimatedDeliveryDate
  [&status=created|lateDelivery|delivered]
  [&patientId=<id>] [&staffId=<id>]
  [&startTime=<iso>&toTime=<iso>]
```

Date-range construction (exactly as the bundle builds it):

| mode | startTime | toTime |
|------|-----------|--------|
| day | the anchor date, `toISOString()` | the **same** value |
| week | start of week | end of week (`23:59:59.999` local) |
| month | 1st of month, local midnight | last day of month, local midnight |

Day mode really does send an identical `startTime` and `toTime`; month mode
really does end at the last day's midnight rather than its end. Both are
reference quirks, not transcription mistakes.

### 2.4 Table — 9 columns

`min-width: 1400px`; the `Thao tác` column is sticky to the right (width 80,
centred) and cannot be hidden. Column settings are disabled on this table.

| # | Header | minWidth | Content |
|---|--------|----------|---------|
| 1 | Nhà cung cấp / Ngày tạo | 180 | `labo.name` (medium, `#1B2A41`) over `createdAt` as `DD/MM/YYYY` (12px, muted) |
| 2 | Tên khách hàng | 200 | `[code] - name`, a link to the patient, primary colour, underline on hover |
| 3 | Ngày gửi / Tình trạng mẫu | 200 | `createdAt` as `DD/MM/YYYY HH:mm` over the **sample** status badge |
| 4 | Ngày giao / Trạng thái Labo | 200 | `estimatedDeliveryDate` as `DD/MM/YYYY HH:mm` over the **labo** status badge |
| 5 | Bác sĩ chỉ định | 160 | `staff.name` |
| 6 | Vật liệu | 140 | `material.name` |
| 7 | Răng | 120 | `toothContents[]` joined, run through the FDI display formatter |
| 8 | File phòng khám gửi về | 200 | A folder button, gold `#F5C518` (filled, stroke 1.5, size 24), disabled when the order has no images; opens a lightbox gallery over `order.images[]` |
| 9 | Thao tác | 80 | **View only** — edit and delete are explicitly hidden |

Note: "Ngày gửi" is `createdAt`, not a separate sent-date field.

Empty state: `Không có dữ liệu`.
Pagination: page sizes 5 / 10 / 20 (default) / 25 / 50 / 100; footer reads
`Hiển thị <from>–<to> trên <count> mẫu labo`; `Trước` / page numbers / `Sau`.

### 2.5 The two status dimensions

The reference tracks **two** independent statuses over the same ten codes.

| code | `status` → Trạng thái Labo | `statusClinic` → Tình trạng mẫu |
|------|---------------------------|--------------------------------|
| `created` | Đơn hàng mới | Mẫu mới |
| `received` | Đã nhận | Đã nhận |
| `processing` | Đang xử lý | Đang xử lý |
| `completed` | Hoàn thành | Đã hoàn thành |
| `delivered` | Đã nhận hàng | Đã giao |
| `canceled` | Đã huỷ | Đã huỷ |
| `guarantee` | Bảo hành | Bảo hành |
| `continue` | Tiếp tục công đoạn | Tiếp tục công đoạn |
| `lateDelivery` | Giao trễ | Giao trễ |
| `replaced` | Đã thay thế | Đã thay thế |

Badge tone (the two columns use **different** rules):

| column | red | green | grey |
|--------|-----|-------|------|
| Tình trạng mẫu (`statusClinic`) | guarantee, replaced, canceled | completed, delivered, continue, lateDelivery | the rest |
| Trạng thái Labo (`status`) | canceled, guarantee | created, received, completed | the rest |

Badge palette: red `bg #FCE9EC / text #E5484D`, green `bg #E6F4EA / text
#1F9254`, grey `bg #F0F2F5 / text #1B2A41`.

Both default to `created` when the field is null.

### 2.6 Order detail modal — "Thông tin chung"

Opened by the row's view action. Size `md`, header has a bottom rule.
Section headings are 16px, semibold, **uppercase**, `#1B2A41`. Each row is a
label/value pair with a fixed 140px label column at 14px.

Two-column grid of four blocks:

1. **Thông tin chung** — Bác sĩ chỉ định · Khách hàng · Ngày sinh
2. **Thông tin labo** — Nhà cung cấp · Ngày gửi · Ngày nhận dự kiến
3. **Thông số labo** — Vật liệu · Đường hoàn tất · Khớp cắn · Kiểu nhịp ·
   Chỉ định · Ghi chú
4. **Chi tiết phiếu** — Dịch vụ điều trị · Loại phục hình · Răng · Màu chi tiết
   · Số lượng, then a **Trạng thái** heading and a select

The **Trạng thái** select offers only five of the ten codes:

`created` Đơn hàng mới · `delivered` Đã nhận hàng · `canceled` Đã huỷ ·
`lateDelivery` Giao trễ · `replaced` Đã thay thế

It is disabled unless `can("laboTemplate","update")`.

Below the grid, a photo area: a 110×110 dashed `#2671D8` tile labelled
`Tải ảnh` (`Đang tải` while uploading), then a removable thumbnail grid.
Upload folder `labo/mau-labo`, **max 5 images, max 5 MB each**, `image/*`,
multiple. Files are uploaded first and only then saved with the order.

Footer, right-aligned:

| Button | Style | Gate |
|--------|-------|------|
| In Phiếu Labo | outline, printer icon | always |
| Tạo Lịch Hẹn Mới | secondary, calendar icon | `can("appointment","create")` |
| Lưu | primary, save icon, min-width 100, spinner while saving | `can("laboTemplate","update")` |

Save sends `PUT /v1/orders/{id}` with body `{ status, imageLaboIds }` — **only**
the status and the attachments; nothing else on this screen is editable. Toast
`Cập nhật phiếu Labo thành công`. Full contract in `docs/clone/api.md` §Labo.

**Cancel guard:** choosing `canceled` when the order's current labo status is
not `Đơn hàng mới` is refused client-side with the toast
`Chỉ được huỷ đơn hàng mới`. The check compares the *displayed label*, so it
only passes for an order still in `created`.

"Tạo Lịch Hẹn Mới" opens the schedule modal pre-filled with the order's
patient (`[code] - name`), its doctor, and now as the start time.

### 2.7 Print sheet — PHIẾU ĐẶT HÀNG LABO

`react-to-print`, document title `phieu-labo-<orderNumber>`, rendered from a
hidden off-screen node. `orderNumber` is derived, not stored:
`LABO_` + the last 8 characters of the id, uppercased.

Header: title, the code, `Ngày D tháng M năm YYYY`, a clinic block
(Phòng khám · Địa chỉ · ĐT · Email, taken from the print-info store) and a
customer block (Mã KH · Khách hàng · Ngày sinh · Bác sĩ chỉ định).

Body, two columns:

- **Thông tin đơn hàng** — Nhà cung cấp · Ngày gửi · Ngày nhận dự kiến
- **Thông số chung** — Lựa chọn dịch vụ · Dịch vụ điều trị · Loại phục hình

Then **Chi tiết phục hình**, itself two columns:

- Vật liệu · Đường hoàn tất · Khớp cắn · Kiểu nhịp
- Số răng · Màu sắc chi tiết · Số lượng · Nội dung chỉ định

Footer: a right-aligned signature block — `Người đặt hàng` / `(Ký xác nhận)` /
64px of space / the name. Missing values print as `—`.

Section headings: 13px, bold, uppercase, `letter-spacing .04em`, 1px bottom
rule `#e2e8f0`. Label/value rows: bold label with a colon, 8px gap.

Two further print titles exist in the locale bundle but are not reachable from
this screen: `PHIẾU TIẾP TỤC CÔNG ĐOẠN LABO` and `PHIẾU BẢO HÀNH LABO`.

### 2.8 Excel export

`Xuất Excel` re-requests the list **without** `page`/`perPage` (all rows, same
filters) and writes file `mau-labo`, sheet `Mẫu Labo`, with **10** columns —
the paired columns split apart, and no file/action column:

Nhà cung cấp · Ngày tạo · Tên khách hàng · Ngày gửi · Tình trạng mẫu ·
Ngày giao · Trạng thái Labo · Bác sĩ chỉ định · Vật liệu · Răng

---

## 3. `/labo/supplier` — Nhà cung cấp Labo

### 3.1 List

```
GET /api/v1/labos/list?branchId=<id>&search=<q>&orderBy=updatedAt:desc&page=1&perPage=20
```

Search is **server-side**, debounced 400 ms, capped at 100 characters, and
resets to page 1. Previous data is kept while refetching.

Row DTO: `id, name, phoneNumber, contactPerson, email, taxCode, address, city,
district, ward, addressFull, code, logoFileId, logoPath, clinicId, branchId,
isDeleted, createdAt/By, updatedAt/By`.

`city`/`district`/`ward` are Vietnamese administrative **codes** as strings
(e.g. `79`, `766`, `27001`); `addressFull` is composed by the server.

### 3.2 Toolbar & table

Search box max-width 320px, placeholder `Tìm kiếm Labo`, search icon.
`Tạo nhà cung cấp` (primary, plus icon) — only when
`can("laboSupplier","create")`, and a branch must be selected.

Table `min-width: 1100px`, actions sticky right, width 70, centred.

| Header | minWidth | Notes |
|--------|----------|-------|
| Tên labo | 240 | muted colour when `isDeleted` |
| Số điện thoại | 160 | `-` when empty |
| Email | 220 | `-` when empty |
| Địa chỉ | 320 | `addressFull` falling back to `address`, else `-` |
| Lần cập nhật cuối | 170 | `DD/MM/YYYY` — **date only** |
| Thao tác | 70 | Chỉnh sửa + Xoá; **both hidden when `isDeleted`** |

Empty state: `Không tìm thấy nhà cung cấp Labo`.
Footer noun: `nhà cung cấp`.

### 3.3 Dialog — Tạo / Sửa nhà cung cấp

Titles: `Tạo nhà cung cấp` / `Sửa nhà cung cấp`. Size `md`, ruled header.

- A 96px round avatar (`bg #D6DCE5`, user glyph when empty) with
  `Tải ảnh lên` / `Thay ảnh`, plus a red `Xóa ảnh` once set.
  Upload: folder `labo/supplier`, **1 image, 5 MB**, type `avatar`.
- Row of 3: **Tên nhà cung cấp\*** · **Email\*** · Số điện thoại
- Row of 2: Người liên hệ · Mã số thuế
- Row of 3: Tỉnh/ Thành phố · Quận/ Huyện · Xã/ Phường — searchable selects
  with a search icon; district disabled until a province is picked, ward until
  a district is; changing a province clears district **and** ward, changing a
  district clears the ward.
- Full width: Địa chỉ (street only — the table's column concatenates the rest)

Validation:

| Field | Rule |
|-------|------|
| name | trim, 2–100, **required** |
| email | trim, valid email (TLD not checked), ≤100, **required** |
| phone | sanitised on input, max 15, numeric input mode, pattern-checked, optional |
| contactPerson | trim, 2–100, optional |
| taxCode | ≤100, optional |
| address | ≤100, optional |
| province/district/ward | optional |

`Lưu` is disabled while busy or while name **or** email is blank — which is why
it is grey on a fresh Create dialog.

Address cascade endpoints:
`GET /api/v1/country/province`,
`GET /api/v1/country/province/{code}/district`,
`GET /api/v1/country/district/{code}/ward`.

### 3.4 Delete

Confirm modal titled `Xác nhận`, body
`Bạn có chắc muốn xoá nhà cung cấp này không?`

Toasts: `Tạo nhà cung cấp labo thành công` · `Cập nhật nhà cung cấp labo thành
công` · `Đã xoá nhà cung cấp labo`; failures use
`Không thể tạo/cập nhật/xoá nhà cung cấp labo`.

---

## 4. `/labo/bite`, `/labo/finish-line`, `/labo/nhip`

These three are **one component** with different parameters, and they are
backed by the shared taxonomy collection — the same one `/taxonomy` uses.

| Route | categoryLabel | `group` | label (lowercase) | subject |
|-------|---------------|---------|-------------------|---------|
| bite | Khớp cắn Labo | `joint` | khớp cắn | `laboBite` |
| finish-line | Đường hoàn tất | `line` | đường hoàn tất | `laboFinishLine` |
| nhip | Kiểu nhịp Labo | `bridge` | kiểu nhịp | `laboRhythm` |

Every string is derived from those two words:

- search placeholder `Tìm kiếm {label}`
- create button `Tạo {label}`
- dialog title `Tạo {label}` / `Sửa {label}`, field label `Tên {label}`
- empty state `Không tìm thấy {categoryLabel lowercased}`

### 4.1 List

```
GET /api/v1/taxonomy/list?group=<group>&branchId=<id>&search=<q>&orderBy=createdAt:desc&page=1&perPage=20
```

Newest first — the `order` field is stored but **not** used to sort this
screen, and there is no drag-reordering here (unlike `/taxonomy`).

### 4.2 Table — 3 columns

`min-width: 600px`, actions sticky right, width 70, centred.

| Header | minWidth |
|--------|----------|
| *(categoryLabel)* | 280 |
| Cập nhật gần nhất | 200 — `DD/MM/YYYY HH:mm`, **with time** |
| Thao tác | 70 — Chỉnh sửa + Xoá |

Footer noun: `mục`.

### 4.3 Dialog

Size `sm`, one required text field, max 100 characters, `Lưu` disabled while
blank. Errors: `Tên phân loại là bắt buộc`,
`Tên phân loại không được vượt quá 100 ký tự`.

Create sends `{ name, group, branchId, order: max(order on page) + 1 }`.
Update sends `{ taxonomyId, name, group, branchId, order: <unchanged> }`.

Delete confirm: title `Xác nhận`, body `Bạn có chắc muốn xoá mục này không?`

---

## 5. `/labo/service-material` — Dịch vụ - vật liệu

Two panes: `grid-cols-[280px_1fr]`, 16px gap. Below the `lg` breakpoint the
left pane collapses into a 300px left drawer opened by a `Chọn nhóm` link
(align-left icon, primary, 13.5px semibold).

### 5.1 Left pane — classification groups

```
GET /api/v1/taxonomy/?group=serviceMaterial&branchId=<id>&orderBy=order:asc&perPage=20&includeCount=true
```

Cursor-paged and **infinite-scrolled** — more load when the scroll position is
within 80px of the bottom. Deleted groups (`isDeleted`) are filtered out
entirely. Groups are then sorted by `order` ascending client-side.

Panel: `rounded-xl`, `border-line`, white, scrolls. A sticky `Thêm Mới` primary
button spans the full width at the top (only with `laboMaterial.create`).
A translucent spinner covers the panel while it loads.

Group row: 36px tall, `rounded-lg`, `px-3`, 13px medium, folder icon + truncated
name. Active row `bg #E7F0FB` / `text #2671D8`; otherwise hover `bg #F6F8FB`.
Pencil and bin icons are `opacity-0` until hover, and pinned visible on the
active row; pencil needs `laboMaterial.update`, bin needs `laboMaterial.delete`.

Clicking the active group **deselects** it and shows all materials again.

Group dialog is the shared category-group modal with the branch field hidden —
two fields, `Tên phân loại*` and `Mức độ ưu tiên` (default `0`). Titles are just
`Tạo` and `Sửa`.

Group delete confirm: `Bạn có chắc muốn xoá nhóm <b>{name}</b> không?`

### 5.2 Right pane — materials

```
GET /api/v1/taxonomy/service-materials/list?branchId=<id>[&taxonomyId=<groupId>]&search=<q>&page=1&perPage=20
```

Search debounced 400 ms, max 100 characters, resets to page 1.

Item DTO: `id, name, alias, taxonomyId, taxonomy { id, name }, taxonomyName,
clinicId, order, isDeleted, createdAt/By, updatedAt/By`.

Toolbar: `Tạo vật liệu` (primary, plus) then a search box, max-width 360px,
placeholder `Tìm kiếm`.

| Header | minWidth | Notes |
|--------|----------|-------|
| Vật liệu | 220 | muted when `isDeleted` |
| Nhóm phân loại | 200 | group name, `-` if the group is gone |
| Cập nhật gần nhất | 180 | `DD/MM/YYYY HH:mm` |
| Thao tác | 70 | sticky right; tooltip'd round icon buttons `Chỉnh sửa` / `Xoá` |

Deleted materials **stay in the table**, greyed and inert:
`bg #F6F8FB opacity-55 pointer-events-none`, with no action buttons.

Empty state: `Không có dữ liệu`. Footer noun: `vật liệu`.

Material dialog: size `sm`, two columns — `Vật liệu*` (max 100) and
`Phân loại dịch vụ*` (searchable select over the groups, pre-filled with the
selected group). `Lưu` needs both. Titles `Tạo vật liệu` / `Sửa vật liệu`.
This one `Lưu` carries no save icon.

Material delete confirm: `Bạn có chắc muốn xoá vật liệu <b>{name}</b> không?`

Toasts: `Tạo dịch vụ vật liệu thành công` · `Cập nhật dịch vụ vật liệu thành
công` · `Đã xoá dịch vụ vật liệu`.

---

## 6. Cross-cutting behaviour

- **Branch scope.** Every request carries `branchId` from the URL. Before any
  create/update the app runs a "a branch must be selected" guard and aborts if
  none is.
- **Permissions** gate tab visibility, the create buttons, the row actions, the
  status select and the save button — per subject, per action
  (`read`/`create`/`update`/`delete`/`export`).
- **Soft delete** is visible, not hidden: suppliers and materials keep their
  rows and lose their buttons. Only service-material *groups* disappear.
- **Search** is always a server round-trip, debounced 400 ms, capped at 100
  characters, and always resets to page 1.
- After any mutation the labo caches **and** the shared select-option cache are
  invalidated, so pickers elsewhere pick the change up.
- Two taxonomy groups exist for labo that this screen never shows:
  `material` (Vật liệu Labo) and `tooth` (Màu răng).

---

## 7. Vocabulary from the locale bundle

Validation messages the order form uses (patient-side, listed here because they
define the field set behind the read-only detail modal):

| Key | VI |
|-----|-----|
| `labo.validation.providerRequired` | Vui lòng chọn nhà cung cấp. |
| `labo.validation.materialRequired` | Vui lòng chọn vật liệu. |
| `labo.validation.doctorRequired` | Vui lòng chọn bác sĩ chỉ định. |
| `labo.validation.serviceRequired` | Vui lòng chọn dịch vụ Labo. |
| `labo.validation.treatmentPlanRequired` | Vui lòng chọn kế hoạch điều trị. |
| `labo.validation.treatmentServiceRequired` | Vui lòng chọn dịch vụ điều trị. |
| `labo.validation.teethRequired` | Vui lòng chọn ít nhất một răng. |
| `labo.validation.toothColorRequired` | Vui lòng nhập màu răng. |
| `labo.validation.quantityRequired` | Vui lòng nhập số lượng. |
| `labo.validation.sentTimeRequired` | Vui lòng chọn giờ gửi. |
| `labo.validation.receiveTimeRequired` | Vui lòng chọn giờ nhận. |
| `labo.validation.expectedDateRequired` | Vui lòng chọn ngày nhận dự kiến. |
| `labo.validation.expectedDateTimeAfterSent` | Ngày và giờ nhận dự kiến phải sau ngày và giờ gửi. |
| `labo.validation.contentMax` | Nội dung không được vượt quá 1000 ký tự. |

Order kinds (`labo.tab.*`): Tất cả · Đơn hàng mới · Tiếp tục công đoạn ·
Bảo hành — matching the local `LaboOrderKind` enum.

English labels exist for the whole `labo.*` namespace and are extracted to
`reference-private/survey-labo/locale-labo-keys.json` for the i18n work.

---

## 8. UNKNOWN_REFERENCE_BEHAVIOR

| # | Page | Control | Reason | Action taken |
|---|------|---------|--------|--------------|
| 1 | mau-labo | Row view action, detail modal with real data | The surveyed branch has zero labo orders; the layout above is read from the bundle, never seen rendered | NONE |
| 2 | mau-labo | The file-gallery lightbox | Needs an order with images | NONE |
| 3 | mau-labo | `Xuất Excel` output | Downloading would be safe but the branch has no rows to export | NONE |
| 4 | mau-labo | What the server does when `status` is set to `replaced`/`lateDelivery` | Would require mutating a production order | NONE |
| 5 | all tabs | Delete behaviour and whether a deleted row can be restored | Deleting is forbidden on the reference | NONE |
| 6 | supplier | Server-side validation messages | Would require submitting the form | NONE |
| 7 | service-material | Whether the group panel supports drag-reordering | Dragging would persist a new order; the group dialog's `Mức độ ưu tiên` field suggests ordering is numeric only | NONE |
| 8 | mau-labo | Whether the order create/edit form lives only on the patient screen | Not opened this session | NONE |

---

## 9. BlueDental implementation

Built 2026-08-27. `/labo/:section` is six real routes, the tab row is
`PageTabBar`, and each tab brings its own screen in
`features/labo/components/`. The page component is the tab row and nothing else.

### Shared chrome

Every Labo table is the catalog chrome the Danh mục and Vật tư screens already
wear — `.bd-cat-body` / `.bd-cat-card` in `src/styles/index.css`, the shared
`DataTable`, `LetterAvatar` rows, group chips, and a pager pinned to the bottom
of the card with `countedTotal`. Labo grew no table style of its own, so a row,
a pinned action column and a footer pager behave the same on every screen.

`countedTotal` moved from `features/taxonomy/` to `utils/` on the way: three
features now count with it, and a feature may not reach into another feature's
folder.

### What each tab does

| Tab | Data | State |
|-----|------|-------|
| Mẫu Labo | `/v1/app/labo-orders` | Period picker, four filters, patient and doctor pickers, Xuất Excel — all applied by the server. No create button, as the reference has none |
| Nhà cung cấp Labo | `/v1/app/labo-suppliers` | Full dialog, server-side search, composed address column |
| Khớp cắn Labo | taxonomy `labo_bite` | Done |
| Đường hoàn tất | taxonomy `labo_finish_line` | Done |
| Kiểu nhịp Labo | taxonomy `labo_rhythm` | Done |
| Dịch vụ - vật liệu | taxonomy `labo_material` + `/v1/app/labo-materials` | Group panel beside the material table, both server-driven |

The three simple catalogs are one component, `LaboCatalogScreen`, parameterised
by the group and the noun — the way the reference builds them. Their rows carry
no priority, so the server's "priority, then newest first" ordering resolves to
newest first, which is the order the reference lists them in.

**Every search on every tab is a server round-trip**, debounced 400 ms, capped
at 100 characters, and resets to page one. Nothing is filtered in the browser:
a client-side filter would only ever search the page already fetched.

### The period picker

`LaboPeriodPicker` has the reference's two states: until a mode is chosen there
is one disabled `Chọn thời gian` button and no date filter is sent; choosing
Ngày / Tuần / Tháng swaps it for a stepper around the period, whose label is the
picker's own input so clicking it opens a calendar.

The window is sent as `fromDate` / `toDate` in whole local days, both inclusive.
This is deliberately **not** the reference's own construction: its day mode
sends an identical `startTime` and `toTime`, and its month mode stops at the
last day's midnight, so both drop part of the range they name. §2.3 records what
the reference does; BlueDental sends the window the label promises.

### Defects this work found and fixed

- `labo-suppliers` and `labo-materials` had no HTTP route at all. ABP's
  conventional controllers do not produce the `api/v1/app/...` prefix the client
  uses, so both tabs were answering 404 to the browser.
- `GetLaboOrderListInput.SampleFilter` was declared but never applied, so the
  four filters above the table did nothing, and `GetStatsAsync` counted by a
  different rule again. Both now read the same two rules.
- `LaboOrder` was missing seven properties that migration `ExpandLaboOrder` had
  already created columns for (`Kind`, the five catalog ids, `AttachmentUrl`).
- `LaboBiteType`, `LaboFinishLine`, `LaboRhythmType`, `LaboSupplier` and
  `LaboMaterial` all carried **no `ClinicBranchId`**, so a row created in one
  branch was visible from every other. The first three are gone, replaced by the
  branch-scoped taxonomy; the other two gained one.
- `LaboMaterial` hung off a supplier and carried a free-text `Category`. The
  reference's item hangs off a classification group and carries only
  `taxonomyId` — its groups are named after labs but are separate records from
  the supplier list, which the differing spellings on the reference prove.
- Every dialog in the app clipped the focus ring under its last field: the modal
  body scrolls and had no bottom padding, so a focused field read as cut in
  half. It now keeps 4px, and the footer gives the same 4px back so nothing
  else moved.
- The supplier logo had columns but no way to fill them. It now uploads to
  MinIO through `POST /v1/app/labo-suppliers/{id}/logo` and is served back
  through the API rather than by a public URL — the shape the staff avatar
  already uses. The record saves first, because a new supplier has no id to
  hang a file off yet.
- The Mẫu Labo table read "—" for the customer, the dentist and the material on
  every row. An order stores ids and the DTO's name fields were never filled, so
  the filters above the table worked — they filter by id — while the columns
  they filter on stayed empty. `LaboAppService` now resolves all four names in
  one read per kind, and the seeded orders point at their supplier and material
  records rather than only carrying a name in free text.

### Deliberate divergences

| Reference | BlueDental | Why |
|-----------|------------|-----|
| Underlined tab row | Pill tabs (`PageTabBar`) | The app switches sub-screens with pills everywhere else |
| Group panel is a bare list under a full-width "Thêm Mới" | The shared `GroupPanel` — title, count, search, "+" | Danh mục and Vật tư use it; a third kind of group panel would be the odd one out. It also gains a server-side group search the reference's panel has not got |
| Rows carry a square initial | No avatar column | Asked for: the reference's Labo tables carry none, and the name reads cleaner without one |
| Logo well is the reference's own | The staff dialog's well — round preview that is itself the picker, "Tải ảnh lên" + "Xóa ảnh" under it | Asked for: one upload affordance across the app beats a second one that only Labo wears |
| Address is province → district → ward | Province → ward | `new-vn-provinces`, which the whole app is already on, is the post-merger two-level division. There is no district level to offer |
| `Bạn có chắc muốn xoá mục này không?` | The row's name in bold, plus "không thể hoàn tác" | The shared `ConfirmDeleteDialog` — and what the reference itself asks on its material and group deletes |
| Tab links carry the whole query string | Links carry only the path | The branch is restored from app state on arrival, so the behaviour matches |
| Ten status codes in two dimensions | The existing six-value `LaboStatus` | Next piece of work; see below |

### Still to build

1. **Mẫu Labo** — the second status dimension (`statusClinic` → "Tình trạng
   mẫu") with its ten codes and its own badge-tone rule, the returned-files
   column and its lightbox, the detail modal with its five-value status select
   and photo upload, the print sheet, and the permission gates. Most of it waits
   on the order growing the ten codes in both dimensions, a migration that
   touches other features.
2. **Dịch vụ - vật liệu** — soft-deleted materials staying in the table, greyed
   and inert, the way the reference leaves them.

### Known, not fixed

`FloatingField` passes `onOpenChange` to every child, which React warns about
when the child is a plain `Input`. It predates this work, fires on every dialog
in the app that pairs the two, and the component is shared with the finished
Danh mục screen — so it wants its own change with that screen's suite run
against it.
