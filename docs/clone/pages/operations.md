# Vận hành — `/operations`

Reference: `https://staging.nfcdental.com/operations/<division>?branchId=…&overviewSubTab=<sub>`

Observed read-only on 2026-08-25: DOM, computed styles and the responses the
page itself fetched. Nothing was typed into, saved or deleted on the reference.

## Shape

Two rows of tabs, then the same two-pane screen Danh mục uses.

1. **Khối (division)** — eight, each a **link** to its own route:
   `overview` (Quản trị vận hành), `assistant`, `reception`, `cskh`,
   `marketing`, `security`, `treatment`, `finance`.
2. **Sub-tab** — **buttons**, carried in the query string. Every division has
   Trang chủ / Quy trình / Công việc; most add Báo cáo; `overview` adds
   Chẩn đoán chưa điều trị and Đơn thuốc.
3. **Left panel** — "Thêm Mới" over a list of categories, each row revealing its
   own commands.
4. **Right** — "Tạo Bài Viết", a search box, a table
   (Tiêu đề | Ngày tạo | Ngày cập nhật | Thao tác, two row actions) and a pager
   offering 5/10/20/25/50/100 per page.

## What the reference's own calls say

| Call | Meaning |
|---|---|
| `GET /api/v1/taxonomy/?group=all&subGroup=all&perPage=20` | the left panel is the **same taxonomy collection** the Danh mục screen uses, under `group=all` |
| `GET /api/v1/posts/list?page=1&perPage=20` | the articles |

A post carries `title`, `content` (HTML), `taxonomyId`, `mainImageId`,
`imageIds[]`, `isDeleted` and the audit stamps. So an article is a title and a
rich-text body filed under one category.

`branchId` on a category came back **null**, so on the reference these are
clinic-wide rather than branch-scoped — unlike the Danh mục catalogs.

"Tạo Bài Viết" is **disabled** while no category is selected.

## What BlueDental does

Same two rows of tabs, same panes, built from the pieces Danh mục already uses:
`PageTabBar` for the divisions, `DataTable` + `useTablePagination` for the
articles, `AppDialog` + `FloatingField` for both dialogs, `RichTextField` for
the body, `ConfirmDeleteDialog` for both deletes, and the `bd-group-*` panel
styling for the categories.

BlueDental keeps its own `OperationCategory` / `OperationArticle` tables rather
than filing these under the taxonomy collection.

### Deliberate divergence: these rows belong to a branch

The reference leaves `branchId` null here. BlueDental does not: every business
row in this codebase carries a `ClinicBranchId` and is filtered by it, and an
unscoped table would be the one hole in that. Two branches of the same clinic
also plainly want their own vận hành notes.

Existing rows were handed to the seeded main branch by the migration rather than
left at `Guid.Empty`, which would have hidden them from every branch at once.

### Images in an article

The body is rich text and the editor can take an image. Quill's own handler
embeds the file in the HTML as a base64 data URL, which is what the Dữ liệu tư
vấn dialog gets — the image appears the instant it is picked, and the bytes end
up in the row. That capped column is what raised `22001` here.

So Vận hành stores the file and keeps a link to it:

| | |
|---|---|
| `POST /api/v1/app/operations/article-images` | multipart; the bytes go to blob storage, the row records where |
| `GET /api/v1/app/operations/article-images/{id}` | serves them back, guarded by branch like any other read |

The body carries a **relative** URL, because it is stored with the article and a
host baked into it would break the moment the app moved.

The editor still behaves the way the consulting dialog does — the picked file
goes in as a data URL immediately, dimmed, and its `src` is swapped for the
stored one when the upload lands. Nothing keeps a data URL by the time the
article is saved.

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: sub-tabs other than "Trang chủ" — Quy trình, Công việc, Báo cáo,
         Chẩn đoán chưa điều trị, Đơn thuốc
Reason: mỗi sub-tab của bản gốc đều mở ra cùng một khung "phân loại + bài viết",
        nhưng chi nhánh quan sát được chỉ có dữ liệu ở "Trang chủ", nên không
        thấy được các tab kia có cột hay hành vi riêng gì không.
Action taken: BlueDental dựng cả sáu sub-tab bằng cùng một khung, mỗi tab giữ
        phân loại và bài viết riêng. Cần quan sát lại khi bản gốc có dữ liệu.
```

```
UNKNOWN_REFERENCE_BEHAVIOR
Page: /operations/<division>
Control: ảnh trong bài viết (mainImageId, imageIds)
Reason: payload có hai trường ảnh nhưng mọi bài viết quan sát được đều để trống,
        và không mở được form soạn bài trên bản gốc để xem nó đính ảnh ra sao —
        không biết bản gốc phân biệt "ảnh đại diện" với "ảnh trong nội dung" thế
        nào, cũng không biết giới hạn kích thước/định dạng của nó.
Action taken: BlueDental lưu ảnh ra blob storage và để nội dung trỏ link tới,
        một loại ảnh duy nhất là ảnh nằm trong nội dung. Giới hạn tự đặt: 5MB,
        png/jpeg/webp/gif. Cần quan sát lại khi mở được form soạn bài.
```
