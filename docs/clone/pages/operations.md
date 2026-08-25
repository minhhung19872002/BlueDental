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

`branchId` on a category came back **null**, so these are clinic-wide rather
than branch-scoped — unlike the Danh mục catalogs.

"Tạo Bài Viết" is **disabled** while no category is selected.

## What BlueDental does

Same two rows of tabs, same panes, built from the pieces Danh mục already uses:
`PageTabBar` for the divisions, `DataTable` + `useTablePagination` for the
articles, `AppDialog` + `FloatingField` for both dialogs, `RichTextField` for
the body, `ConfirmDeleteDialog` for both deletes, and the `bd-group-*` panel
styling for the categories.

BlueDental keeps its own `OperationCategory` / `OperationArticle` tables rather
than filing these under the taxonomy collection, because its taxonomy is scoped
to a clinic branch and these are not.

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
        và không mở được form soạn bài trên bản gốc để xem nó đính ảnh ra sao.
Action taken: BlueDental lưu tiêu đề và nội dung rich-text, chưa dựng phần ảnh.
```
