# Vật tư — /materials

Reference: `https://staging.nfcdental.com/materials/clinic?branchId=<id>`
Observed: 2026-08-26 (read-only; an earlier pass on `app.nfcdental.com` was
2026-08-22 and agreed on every point re-checked)
Screenshots: `reference-private/materials/` (not committed)

> The reference branch holds **no materials, no allocation vouchers and no
> departments**. Every table was observed empty. Structure below is observed;
> anything that only appears once a row exists is listed under
> UNKNOWN_REFERENCE_BEHAVIOR and was not invented.

## Routes

| # | Label | Route |
|---|-------|-------|
| 1 | Vật tư phòng khám | `/materials/clinic` (default) |
| 2 | Phân bổ vật tư | `/materials/allocation` |
| 3 | Phòng ban | `/materials/department` |

`/materials` opens the first section. The three are underlined tabs, not a
segmented control.

## API

| Purpose | Reference call |
|---------|----------------|
| Material groups | `GET /api/v1/taxonomy/?group=supplies&includeCount=true` |
| Materials | `GET /api/v1/supplies/list` |
| Departments | `GET /api/v1/departments/list?perPage=20&branchId=…&orderBy=order&page=1` |
| Allocation vouchers | `useSupplyAllocationList({ branchId, departmentId?, search?, orderBy: "createdAt", perPage })` |
| Stock-take confirmations | `useSupplyAllocationConfirmList({ branchId, departmentId?, status?, orderBy: "createdAt", perPage })` |

The department response advertises `availableOrderBy: ["name","order","createdAt","updatedAt"]`
and is requested with `orderBy=order`, so a department carries a position of its
own — which is why BlueDental gives `Department` a `SortOrder` column and orders
the panel by it. Its dialog collects that as "Số thứ tự".

The groups are ordinary taxonomy groups under the `supplies` slug — the same
collection Danh mục's panel reads — which is why BlueDental shares one panel and
one hook (`src/hooks/useTaxonomyGroups.ts`) between the two screens.

## Vật tư phòng khám

Panel on the left, table on the right.

### Panel

| Part | Observed |
|------|----------|
| Title / count | "Nhóm vật tư" · "1 nhóm" |
| Subtitle | "Chọn nhóm để xem vật tư" |
| Search | "Tìm nhóm vật tư..." |
| Add | Square blue "+" beside the search |
| Rows | One: "Hệ thống" |

"Hệ thống" is a **system group**: its row is tinted amber and carries an ⓘ
where an ordinary row keeps its ⋯ menu — it is neither renamed nor deleted.
BlueDental seeds one per branch (`Taxonomy.IsSystem`), and `GroupPanel` draws
any system row that way.

### Toolbar

`＋ Thêm vật tư` (primary) · `Tìm kiếm` · then, pushed to the far right,
`⟳ Sync data hệ thống` (**disabled on the reference**).

"Thêm vật tư" is offered whether or not a group is selected — the dialog's
required "Nhóm phân loại" is where the group is chosen.

### Table — 12 columns behind a leading checkbox

Checkbox · Tên vật liệu · Nhóm phân loại · Nhập kho · Hạn sử dụng ·
Cảnh báo hết hạn · Tồn kho · Trạng thái · Nhà cung cấp · Xuất xứ · Giá nhập ·
Giá bán · Thao tác

Empty: "Không có dữ liệu". Footer: "Hiển thị 0 trên 0".

### "Thêm vật tư" dialog — 770px, two columns

| Left | Right |
|------|-------|
| Tên vật tư * | Nhóm phân loại * |
| Số lượng | Cảnh báo hết hạn (ngày) — prefilled 15 |
| Nhà sản xuất | Xuất xứ |
| Giá nhập | Giá bán |
| Ngày nhập kho — prefilled today | Hạn sử dụng |

One `Lưu`. No material-code field: BlueDental derives `ItemCode` rather than
asking for one the reference never asks for.

### Group dialog — 500px

"Tạo" / "Sửa", `Tên phân loại *` and `Mức độ ưu tiên`. Identical to Danh mục's.

## Phân bổ vật tư

No panel — the section takes the full width.

Toolbar: `Tìm phiếu phân bổ...` on the left, `Lịch sử kiểm kho` (outlined,
**enabled on the reference**) on the right.

Columns: Thời gian phân bổ · Mã phân bổ · Vật tư · SL được phân bổ ·
SL confirm còn lại · Phòng ban · Người thực hiện · Ghi chú · Thao tác

Empty: "Chưa có phiếu phân bổ".

## Phòng ban

Panel on the left, table on the right.

| Part | Observed |
|------|----------|
| Title / count | "Phòng ban" · "0 phòng ban" |
| Subtitle | "Chọn phòng ban để xem vật tư đã phát và kiểm kho" |
| Search | "Tìm phòng ban..." |
| Add | Square blue "+" |
| Empty | "Chưa có phòng ban" |

Toolbar: `Tìm vật tư...` on the left; at the far right an **icon-only outlined
button** (a stacked-layers glyph) whose `aria-label` reads "Gộp số lượng vật tư".
The "+" beside the panel search is labelled "Tạo phòng ban".

Columns: Thời gian phân bổ · Mã phân bổ · Vật tư · SL được phát ·
SL còn lại (đã duyệt) · Kiểm kho · Người thực hiện · Ghi chú · Thao tác

Empty: "Chọn phòng ban để xem vật tư đã phân bổ".

Department dialog — 500px: `Tên phòng ban *` and `Số thứ tự`, one `Lưu`.

## How the three sections hang together

Read out of the reference's own client bundle (`_next/static/chunks/…`), which
is a static asset and needs no interaction to read. This is the shape BlueDental
does **not** yet have, and it is what makes the three tabs one feature rather
than three lists.

**A voucher carries many materials.** An allocation is
`{ id, code, departmentId, departmentName, branchId, userName, note, createdAt,
items: [{ supplyId, name, qty, confirmedQty }] }` — one voucher, one department,
**several supply lines**. That is why Phân bổ vật tư renders "Vật tư" as
`items.map(i => i.name).join(", ")` and "SL được phân bổ" as
`items.map(i => `${i.name}: ${i.qty}`).join(", ")`, each clamped to one line
with the full string on the `title`.

**Kiểm kho is a separate collection.** Confirmations are their own records,
keyed by `allocationId:supplyId`, carrying a `status` (`"pending"` among them)
and a `createdAt`. The screen keeps only the latest per pair. From that fall out:

- the "Kiểm kho" column on Phòng ban (a status tone per line),
- `confirmedQty`, which is what "SL còn lại (đã duyệt)" shows and why it reads
  "—" until a confirmation is approved,
- a `pendingCount` per material and a `${n} vật tư chờ duyệt` amber pill above
  the department table,
- a badge on each voucher's action icon in Phân bổ vật tư,
- and `Lịch sử kiểm kho`, which opens that queue: tabs with counts, an
  infinite-scrolling list of `ConfirmCard`s (`max-h-[420px]`), and the empty
  wordings "Không có xác nhận nào chờ duyệt" and "Chưa có phòng ban nào gửi xác
  nhận kiểm kho". The button turns amber when something is pending and the
  account holds `materials:approve`.

**Built 2026-08-27.** A `MaterialAllocation` now carries a
`MaterialAllocationItem` per material, so a voucher issues a whole selection at
once. Issuing takes the material off the clinic's shelf and cancelling the
voucher puts it back. Codes follow the reference's shape — `PB` + the date + a
counter that restarts each day, e.g. `PB202608270001`.

**Still not built**: the confirmation records themselves. BlueDental stores a
`ConfirmedQuantity` per line and no history of how it got there, so there is no
pending state, no approval step, and no queue for `Lịch sử kiểm kho` to open.
The "Kiểm kho" column therefore reads "Chưa kiểm" until a remaining figure comes
back for that line, rather than showing the reference's status tones.

## Phân bổ — the flow

Ticking materials in Vật tư phòng khám raises a bar over the table:

- an X labelled "Bỏ chọn", then "{n} vật tư đã chọn" with the first two names
  and `, +N` for the rest;
- the receiving department (the reference also names a branch here; BlueDental
  issues within the branch already showing in the header, so it does not repeat
  the question);
- "Phân bổ", disabled until a department is named;
- an ⓘ labelled "Lưu ý phân bổ" carrying two notes verbatim: *"Vật tư sẽ được
  phân bổ trực tiếp từ kho tổng về chi nhánh hoặc phòng ban nhận."* and *"Số
  lượng phân bổ tối đa dựa trên số lượng còn lại chưa phân bổ của vật tư."*

"Phân bổ" opens **"Phân bổ vật tư" / "Nhập số lượng phân bổ cho từng vật tư"**
(1100px, body capped at `42vh`): one row per material showing "Tồn kho: {n}" and
a − / input / + stepper starting at 1, a "Ghi chú đợt phân bổ..." for the whole
issue, and a footer reading "{n} vật tư" against "Huỷ" and "Xác nhận".

Each line is capped at what the clinic holds. Below one it says "SL phải ≥ 1";
above stock, "Vượt tồn kho ({n})" — and "Xác nhận" stays disabled while any line
is wrong.

## Gộp số lượng vật tư

A pure view toggle — `onClick: () => setMerged(v => !v)`, no request. It swaps
the **whole column set**, rather than folding the detail rows:

| Column | Alignment | Notes |
|--------|-----------|-------|
| Vật tư | left | material name |
| Tổng SL phân bổ | right | teal `#107569`, semibold |
| Tổng còn lại (đã duyệt) | right | amber `#B45309`; "—" when nothing confirmed; a `${n} chờ duyệt` pill when any are pending |
| Số lần phân bổ | right | rendered `{n} lần` |
| Lần phân bổ gần nhất | left | formatted datetime, or "—" |
| Chi nhánh | left | only in the multi-branch view |

Active, the button turns teal (`border-[#107569] bg-[#E6F4F2] text-[#107569]`)
and its tooltip becomes "Xem chi tiết phân bổ".

BlueDental draws the first five; the pending pill and the branch column wait on
the confirmation records and the multi-branch view respectively.

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Control / behaviour | Reason | Action taken |
|---|---------------------|--------|--------------|
| 1 | What the leading checkbox enables once rows are ticked | No rows on the reference; no bulk bar appeared with the header checkbox alone | Column drawn, selection tracked, no bulk action invented |
| 2 | Status badge — **resolved 2026-08-27** | Read out of the bundle: the reference derives it from quantity alone — `≤0` "Hết hàng", `≤50` "Sắp hết", otherwise "Còn hàng" — and treats expiry as a separate flag | BlueDental keeps its own rule (`InventoryItem.StatusAsOf`), which folds expiry into the same column and uses each material's reorder level rather than a fixed 50. Same three labels, different thresholds — recorded as a divergence rather than changed, because the reorder level is a column the user sets |
| 3 | How "Cảnh báo hết hạn" renders when a material is near expiry | No rows | Shown as the plain day count |
| 4 | Row action buttons | No rows | Edit + delete, as every other BlueDental table |
| 5 | `Sync data hệ thống` | Disabled on the reference too | Offered, disabled |
| 6 | `Lịch sử kiểm kho` destination | Enabled on the reference, but not followed — clicking could not be shown to be read-only | Offered, disabled. BlueDental records no stock-take at all — confirming usage moves a number and writes no history — so there is nothing for it to show. The reason is on a tooltip, because a disabled button swallows its own |
| 7 | ~~`Gộp số lượng vật tư`~~ — **resolved 2026-08-27** | Read out of the reference's client bundle rather than clicked | Built to match: a view toggle that swaps the column set. See "Gộp số lượng vật tư" above |
| 8 | `Kiểm kho` status tones — **partly resolved 2026-08-27** | The shape is known (a confirmation record per `allocationId:supplyId` with a status) and "Chưa kiểm" was seen on a real row, but no confirmation with data was ever observed, so the remaining tones and wordings are unknown | Reads "Chưa kiểm" until a remaining figure comes back for the line, then "Đã kiểm" |
| 9 | Whether the reference pages materials on the server | Never more than zero rows | BlueDental pages on the server |

## Local sample data

The reference branch is empty on all three sections, so nothing there can be
copied and nothing here would be visible either. `BlueDentalMaterialsDemoSeeder`
fills a development database with invented Vietnamese supplies: three groups,
five departments, thirteen materials and twenty vouchers.

Stock and expiry are picked so Trạng thái shows all five of its values, and the
vouchers go round-robin over the departments drawing on two materials each — so
every department has rows and "Gộp số lượng vật tư" always has something to
fold. Deterministic ids and a fixed RNG seed, so a re-run changes nothing.

## Known divergences

| # | Difference | Why |
|---|-----------|-----|
| 1 | Table footer reads `Hiển thị … ` then `20 / trang`; the reference puts the page-size select first and labels its pager `‹ Trước` / `Sau ›` | Comes from the shared `DataTable` footer every BlueDental screen uses, including the accepted Danh mục screen (CLAUDE.md §17). Not changed for one screen. |
