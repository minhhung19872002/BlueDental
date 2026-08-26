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

### The report sub-tabs

All of them are built, against tables the clinic already keeps:

| Sub-tab | Reads |
|---|---|
| Báo cáo | diagnoses, consulting lines, service lines, stages and payments, unioned into one activity log and filtered by action |
| Chẩn đoán chưa điều trị | `bd_patient_diagnoses` where `HasTreatmentService` is false |
| Đơn thuốc | nothing — the reference has not built it either, and says so |
| Khách hàng phát sinh | `bd_patient_advises` grouped by consultant; "new" means the clinic had not consulted that patient before the window opened. **The reference also puts a `Tổng quan tài chính` dashboard below the table — four panels (lượt khách, lịch hẹn, thanh toán, thu chi), each a Hôm nay/Tuần này/Tháng này/Năm nay/Toàn bộ list beside a chart. Not built yet.** |
| Hóa đơn | `bd_invoices` |
| Hoàn thành theo dịch vụ | service lines, with five figures over them |
| Truy cập | the same service lines through every column, with three figures that double as the filter |

`GET /api/v1/app/operations/reports/{work-log,untreated-diagnoses,consultant-summary,invoices,service-completion,sales-access}`,
all read-only, all branch-scoped, all windowed by `Period` (1 Ngày, 2 Tuần,
3 Tháng, 4 Năm) and an `Anchor` date the server squares to that period.

Đơn thuốc renders the reference's own words — `Nội dung đang được xây dựng.` —
rather than a report the reference does not have.

### Filters above each report

| Sub-tab | Filters | Figures |
|---|---|---|
| Báo cáo | `Người tạo`, `Hành động` (multi, **all selected by default**), `Tìm kiếm khách hàng` | one card: `Doanh số chốt kế hoạch` |
| Chẩn đoán chưa điều trị | `Người tạo` | — |
| Khách hàng phát sinh | `Nhân sự tư vấn`, beside the period bar; the screen is titled `Báo cáo khách hàng phát sinh` | — (see below) |
| Hóa đơn | `Tất cả trạng thái` | — |
| Hoàn thành theo dịch vụ | search, `Bác sĩ điều trị`, `Nhóm dịch vụ`, and two buttons | five cards |
| Truy cập | `Phân loại` | three cards, which are also the filter |

### Báo cáo is a different screen on each division

Swept all five on 2026-08-26. The table and its visit grouping are identical
everywhere; what changes is above it.

| Division | Filters | Figure | Pager |
|---|---|---|---|
| Quản trị vận hành | `Người tạo`, `Hành động` (all selected), `Tìm kiếm khách hàng` | far right | `… công việc` |
| Khối CSKH | identical to Quản trị vận hành | far right | `… công việc` |
| Khối lễ tân | `Người tạo` only | immediately beside that filter | **no noun** |
| Khối điều trị | **none** | alone on the left | `… công việc` |
| Khối Marketing | **a different report entirely** — see below | — | — |

Khối lễ tân's rows also name actions the others do not (`Đặt lịch`, `Tới khám`)
and Khối điều trị adds `Điều trị mới` with a code beneath it; those come from
the reference's own vocabulary, and BlueDental names its rows after the tables
it actually keeps.

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/marketing?marketingSubTab=report
Control: toàn bộ tab Báo cáo của Khối Marketing
Reason: đây là một báo cáo khác hẳn: có thêm **hàng tab thứ tư** dạng segmented
        — `Lọc theo nguồn đến` / `Lọc theo địa chỉ` / `Lọc theo dịch vụ` /
        `Báo cáo lịch tạm` — và bên dưới là một thẻ tiêu đề kiểu
        "Phân bổ khách hàng theo địa chỉ" chứa biểu đồ. Chi nhánh quan sát được
        không có dữ liệu nên không thấy được biểu đồ vẽ ra sao, trục nào,
        chú giải nào.
Action taken: chưa dựng. Khối Marketing hiện dùng chung màn Báo cáo đầy đủ.
        Cần quan sát lại khi bản gốc có dữ liệu.
```

### Báo cáo is grouped, not flat

Rows are drawn in blocks. The `Ngày / Khách hàng` cell spans the whole visit and
holds the date, `[MÃ] - Tên`, and a three-step progress line — `Đã đến`,
`Đang khám`, `Hoàn tất` — each with a time under it, or `--:--` where the step
has not been reached. Inside the block the `Hành động` cell spans its group and
reads `Chẩn đoán (4)`, `Tư vấn (10)` — the label and how many rows are under it.

An empty note reads `(Trống)` and an empty amount reads `---`.

Paging is by **item**, not by block: the reference's own footer counts
`công việc`, so a block can be cut across a page boundary and the spans are
computed over whatever is on screen.

The period and the anchor date also live in the URL, per division:
`ops_<division>_dateMode` and `ops_<division>_date`.

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: cách bản gốc tính các con số trên thẻ, và vài cột luôn rỗng
Reason: cột và nhãn thì quan sát được đầy đủ, nhưng bản gốc không lộ công thức:
        "Thực thu" so với "Tổng doanh thu", "% đúng tiến độ", "Doanh thu từ KH
        tạm ứng" (luôn 0 ở chi nhánh quan sát được), và các cột Nghề nghiệp,
        Chẩn đoán 2, Bác sĩ hỗ trợ, Phụ tá, Tên chi tiết, Công đoạn, % Thuế đều
        trống ở mọi dòng thấy được.
Action taken: BlueDental tính theo cách hợp lý nhất với dữ liệu của mình —
        "Thực thu"/"Dịch vụ hoàn thành" là tổng các dòng đã xong, "% đúng tiến
        độ" là tỉ lệ dòng đã xong, "tạm ứng" để 0 — và các cột chưa có nguồn thì
        hiện "—" đúng như bản gốc. Cần đối chiếu lại khi bản gốc có dữ liệu ở
        những cột đó.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: nút xoá trên hàng phân loại và hàng bài viết
Reason: không bấm trên bản gốc — nếu nó xoá thẳng thay vì hỏi lại thì đã sửa
        dữ liệu production.
Action taken: BlueDental hỏi lại bằng `ConfirmDeleteDialog` như các màn khác.
```
