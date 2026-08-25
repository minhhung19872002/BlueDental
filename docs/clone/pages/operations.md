# /operations — Quản trị vận hành

Observed read-only on `staging.nfcdental.com`, 2026-08-25, at 1600×1000.
Nothing on the reference was created, edited or deleted; dialogs were opened
and closed without typing or saving.

## Shape

Three tab levels, not two:

1. **Divisions** — eight underlined tabs, each its own route `/operations/<key>`.
2. **Middle row** — `Tổng quan` / `Truy cập`, on **Khối điều trị** and **Khối
   tài chính** only, in the same underlined style as the divisions.
3. **Sub-tabs** — rounded pills. **The set differs per division.**

| Division | Route | Middle row | Sub-tabs |
|---|---|---|---|
| Quản trị vận hành | `overview` | — | Trang chủ, Quy trình, Công việc, Báo cáo, Chẩn đoán chưa điều trị, Đơn thuốc |
| Khối trợ lý | `assistant` | — | Trang chủ, Quy trình, Công việc |
| Khối lễ tân | `reception` | — | Trang chủ, Quy trình, Công việc, Báo cáo |
| Khối CSKH | `cskh` | — | Trang chủ, Quy trình, Công việc, Báo cáo |
| Khối Marketing | `marketing` | — | Trang chủ, Quy trình, Công việc, Báo cáo |
| Khối bảo vệ | `security` | — | Trang chủ, Quy trình, Công việc |
| Khối điều trị | `treatment` | Tổng quan, Truy cập | Trang chủ, Quy trình, Công việc, Báo cáo |
| Khối tài chính | `finance` | Tổng quan, Truy cập | Trang chủ, Khách hàng phát sinh, Quy trình, Công việc, Hóa đơn, Hoàn thành theo dịch vụ |

### Sub-tab keys

`home`, `process`, `task`, `report`, `untreated`, `prescription`,
`customer-report`, `invoice`, `service-complete`. Middle row: `overview`,
`access`.

### One query parameter per division

Each division carries its own: `overviewSubTab`, `assistantSubTab`,
`receptionSubTab`, `cskhSubTab`, `marketingSubTab`, `securitySubTab`,
`treatmentSubTab`, `financeSubTab`; plus `treatmentTab` / `financeTab` for the
middle row. **They accumulate** — every division visited leaves its parameter in
the URL, so leaving a division and coming back returns to the sub-tab it was
left on.

## Only three sub-tabs are the article screen

`Trang chủ`, `Quy trình` and `Công việc` show the category panel + article
table. **Every other sub-tab is a report** with its own columns, no category
panel and no "Tạo Bài Viết":

| Sub-tab | Columns observed |
|---|---|
| overview / Báo cáo | Ngày / Khách hàng, Nhân sự, Hành động, Điều trị / Dịch vụ / Lịch hẹn, Nội dung / Ghi chú, Doanh số |
| overview / Chẩn đoán chưa điều trị | Ngày, Khách hàng, Nhân sự, Răng, Chẩn đoán, Nội dung / Ghi chú |
| overview / Đơn thuốc | no table — layout not observed |
| finance / Khách hàng phát sinh | Nhân sự tư vấn, Tư vấn khách mới, Tư vấn khách cũ, Doanh thu khách mới, Doanh thu khách cũ, Tổng lượt tư vấn, Doanh thu từ tư vấn |
| finance / Hóa đơn | Ngày tạo, Số hóa đơn, Tên bệnh nhân, Tên đơn vị, Hình thức thanh toán, Trạng thái hóa đơn, Trạng thái, Tổng trước VAT, Tổng VAT, Tổng tiền, Nhà cung cấp, Thao tác |
| finance / Hoàn thành theo dịch vụ | Ngày thao tác, Khách hàng, Chi nhánh, Dịch vụ, Nhóm dịch vụ, Phân loại, Bác sĩ chẩn đoán 1, Chẩn đoán 2, Nhân sự tư vấn 1, Nhân sự tư vấn 2, Bác sĩ điều trị, Răng, Chi tiết phiếu, Giá dịch vụ, Số lượng, Tổng giảm giá, Giá điều trị bác sĩ, Ghi chú, Loại thuế, % Thuế, Thao tác |
| treatment / Truy cập, finance / Truy cập | Ngày/Tuần/Tháng toggle, month picker, a `Phân loại` select, three stat cards (Tổng doanh số, Dịch vụ đã hoàn thành, Dịch vụ tính doanh số riêng), then a wide table with row checkboxes |

## The article screen

### Category panel (left, ~265px)

A white card holding **only** a sticky, full-width blue `+ Thêm Mới` and a flat
list. Each row is a folder icon, the name (`line-clamp: 2`), and two commands
held at `opacity: 0` until the row is hovered or selected.

**No** heading, **no** count, **no** description line, **no** search box and
**no** drag handle — unlike the Danh mục group panel it resembles. Selected row:
pale blue fill, blue left border, blue text, commands shown. An empty panel
shows nothing at all below the button.

Below `lg`, the panel becomes a left sheet opened by a `☰ Chọn nhóm` link.

### Toolbar and table

`⊕ Tạo Bài Viết` sits **left** of a wide search box (magnifier prefix,
placeholder `Tìm kiếm`). No page title, no article count.

Columns: `Tiêu đề` | `Ngày tạo` (date) | `Ngày cập nhật` (date + time) |
`Thao tác` (pencil, red trash — icons only).

Empty state is the words `Không có dữ liệu`, nothing else.

Footer: page-size `<select>` (5/10/20/25/50/100, default **20**), then
`Hiển thị 1–11 trên 11` — **no unit noun**, and `Hiển thị 0 trên 0` when empty —
then `‹ Trước` / pages / `Sau ›`.

### Selection rules

- **No category selected** → the table lists every article in the sub-tab, and
  `Tạo Bài Viết` is **disabled**.
- **A category selected** → the table is filtered to it and `Tạo Bài Viết`
  enables.

## Dialogs

| | Category | Article |
|---|---|---|
| Title (create) | `Tạo` | `Tiêu đề bài viết` |
| Title (edit) | `Sửa` | `Sửa bài viết` |
| Width | 500px | 772px |
| Fields | `Tên phân loại*`, `Mức độ ưu tiên` (default `0`) — side by side | `Tiêu đề*`, then a `Nội dung bài viết` label over the editor |
| Buttons | one `💾 Lưu`, right | one `💾 Lưu`, right |

Neither has a Huỷ button, and neither has an "Đã xoá" checkbox.

The article editor is Quill with `min-height: 320px`, placeholder
`Nhập nội dung tư vấn...` (reused from the consulting dialog), and this toolbar,
which BlueDental's `RichTextField` already matches exactly:

```
font size | header | bold italic underline strike | list list | indent indent
script script | blockquote direction | align | color background
link image video formula code-block | clean
```

## API

| Call | Meaning |
|---|---|
| `GET /api/v1/taxonomy/?group=<division>&subGroup=<subTab>&perPage=20` | the categories |
| `GET /api/v1/posts/list?page=1&perPage=20&group=<division>&type=<subTab>` | the articles |
| `…&taxonomyId=<id>` | filtered to one category |

`group` is the division key; `overview` sends `group=all`. On
`overview` + `home` the article call carries neither parameter.

A post carries `title`, `content` (HTML), `taxonomyId`, `mainImageId`,
`imageIds[]`, `isDeleted` and the audit stamps.

`branchId` on a category came back **null**, so the reference keeps these
clinic-wide. BlueDental scopes them to a branch anyway — see below.

## What BlueDental does

Built from the pieces Danh mục already uses: `PageTabBar` for the divisions,
`DataTable` + `useTablePagination` for the articles, `AppDialog` +
`FloatingField` for both dialogs, `RichTextField` for the body,
`ConfirmDeleteDialog` for both deletes.

The category panel is **its own component** (`OperationCategoryPanel`,
`bd-ops-*`), not the Danh mục group panel — the reference draws them
differently, as set out above.

Two deliberate departures:

- **Rows are scoped to a clinic branch.** The reference keeps them clinic-wide;
  every other business row here belongs to a branch, and mixing the two rules
  in one database is worse than the difference.
- **Images live beside the article, not inside it.** The reference's payload has
  image fields that were never populated in anything observable. Quill's default
  is to embed a picked image as a base64 data URL inside the stored HTML, which
  put the bytes in the row and broke the column outright (Postgres 22001). They
  go to blob storage and the body links to them.

Sub-tabs that are reports render `OperationReportPanel`, which says the report
is not built rather than showing the article screen and implying it works.

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: the report sub-tabs and the Truy cập tab
Reason: mọi bảng quan sát được đều rỗng hoặc gần rỗng, và các số liệu đằng sau
        (hoá đơn, dịch vụ hoàn thành, lượt tư vấn, doanh số) chưa có trong
        BlueDental, nên không suy ra được quy tắc lọc, cách tính hay phân trang.
        Cột thì đã ghi lại ở trên.
Action taken: BlueDental dựng khung tab đúng như bản gốc và nói rõ báo cáo chưa
        được dựng. Cần quan sát lại khi có dữ liệu và khi BE có các bảng này.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: nút xoá trên hàng phân loại và hàng bài viết
Reason: không bấm trên bản gốc — nếu nó xoá thẳng thay vì hỏi lại thì đã sửa
        dữ liệu production.
Action taken: BlueDental hỏi lại bằng `ConfirmDeleteDialog` như các màn khác.
```
