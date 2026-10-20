# F-74 — Ghi chú nhanh ở header ("Thêm ghi chú", Alt+N)

BA mock (2 screenshots), owner approved the plan 2026-10-19. BlueDental-local;
the reference has no such dialog. Regression id R-990; accentless search R-992.

Status: `VERIFIED` (2026-10-19).

## What it does

- **Opening it**: a clipboard icon in the header, just before the branch picker.
  Its tooltip names the shortcut. **Alt+N** opens it from any screen. If the
  dialog is already open, Alt+N puts the cursor in its search box instead.
  - The shortcut is matched on `event.code === "KeyN"`, not on `key`. On a Mac,
    Option+N types "˜", and a Vietnamese keyboard layout may remap the letter.
  - Ctrl+Shift was ruled out because UniKey uses it to switch language.
    Ctrl+N was ruled out because it opens a new browser window.
- **A dialog that floats beside the work**:
  - No backdrop. The page behind stays clickable and typable, so a note can be
    copied straight into a form.
  - The title row drags the dialog, which stays inside the window. Reopening
    centres it again.
  - Only X ("Đóng") and "Hủy" close it. A click outside or Esc does not.
  - It lives in `AppLayout`, so it stays open, draft and all, while the user
    moves between screens.
- **Search + Chung / Cá nhân**: the search runs on the server, debounced at
  300 ms. Every word must match, and case does not matter.
  - Vietnamese marks do not matter either, on what is typed or on what was
    written (R-992): "goi lai duc" finds "Gọi lại BS Đức", and "đặt vật tư"
    finds "dat vat tu". "đ" counts as "d", and a decomposed mark (a letter
    followed by a combining accent) folds the same as a precomposed one.
  - Folding is exact, not fuzzy: "duk" does not find "Đức".
- **Thêm mới**: a block that is folded by default.
  - It holds a "Ghi chú" textarea (up to 2000 characters, with a counter) and a
    "Thêm" button; ^ folds and unfolds it.
  - "Sửa" on a row loads that note into the block and opens it. The block then
    shows "Lưu" and "Hủy sửa".
- **List**: columns STT / Nội dung / Thao tác, newest first, using the shared
  pagination (`useTablePagination.buildConfig`).
  - The content is clamped to 2 lines; the full text is in the cell's tooltip.
  - Sửa and Xóa appear for the author only. Copy appears for everyone and
    toasts "Đã sao chép".
  - Xóa goes through `ConfirmDeleteDialog` and is a soft delete.
  - Empty state: "Chưa có ghi chú nào".
- **Chung**: the notes of the branch picked in the header. With "Tất cả chi
  nhánh", the list shows every branch the account may open. Adding is locked in
  that mode, with the hint to pick a branch first.
- **Cá nhân**: the caller's own notes. They have no branch, so they show
  whichever branch is picked.
- **Access**: any signed-in account. There is no permission of its own.

## API

`api/v1/app/staff-notes`:

| Endpoint | Purpose |
|----------|---------|
| `GET ?scope=1\|2&filter=&skipCount=&maxResultCount=` | One page. Chung follows the `X-Clinic-Branch-Id` header; with no header it covers every allowed branch. |
| `POST { scope, content }` | Chung lands in the header's branch, or the account's own branch when no header is sent. |
| `PUT {id} { content }` | Author only. |
| `DELETE {id}` | Author only. Soft delete; returns 204. |

The DTO carries `creatorName`, `creationTime` and `canEdit`. The UI shows
nothing else about authorship.

Refusals:

| Case | Response |
|------|----------|
| Another user's Cá nhân note | **404**. It does not exist as far as the caller can tell. |
| A Chung note in a branch the account may not open | **403** (`BranchAccessChecker`) |
| Another author's Chung note | `StaffNote:0004` |
| Blank content | `StaffNote:0001` |
| Content over 2000 characters | `StaffNote:0002` |
| No branch | `StaffNote:0003` |
| Unknown scope | `StaffNote:0005` |

Storage: table `bd_staff_notes` (`FullAuditedAggregateRoot`), migration
`20261019120529_StaffNotes`.

Accentless search (R-992): both the column and each typed word go through
PostgreSQL's `unaccent()`, so the database's folding rules apply on both
sides. LINQ reaches it through `DbText.Unaccent` (Domain), mapped as a built-in
DB function in `ConfigureTextSearch`. Migration `20261020020811_UnaccentSearch`
runs `CREATE EXTENSION IF NOT EXISTS unaccent;`. The extension is trusted since
PG 13 and ships in `postgres:15-alpine`. DbMigrator must run before the new
host serves a search. There is no new column and no backfill.

Indexes:
- `(Scope, ClinicBranchId, CreationTime)`
- `(Scope, CreatorId, CreationTime)`

## Owner decisions (2026-10-19, plan approved as proposed)

1. Chung is shared within a branch. In Tất cả chi nhánh mode it shows every
   accessible branch, and adding is disabled.
2. Cá nhân is private to the author and has no branch.
3. Only the author may edit or delete. Copy is open to everyone.
4. Delete is soft and asks for confirmation.
5. The dialog has no backdrop and is draggable. Only X and Hủy close it.
6. The shortcut is Alt+N. When the dialog is open, Alt+N focuses search.
7. Any logged-in account may use it.
8. Content is limited to 2000 characters, clamped to 2 lines in the list, with
   the full text on hover.

Taken during the build (not asked), to revisit if the owner disagrees:

- On Chung, each row shows "author · time" under the content, because a shared
  list with no names left readers guessing. Cá nhân rows leave it out, since the
  author is always the viewer.
- A Chung note created with no branch header falls back to the account's own
  branch. If the account has no own branch either, the request is refused with
  `StaffNote:0003`.

## Tests

- **Domain**: `test/BlueDental.Domain.Tests/StaffNotes/StaffNoteTests.cs`, 11/11.
  It covers:
  - branch rules, including `0003` for an empty branch
  - content trim and cap
  - author-only edit
- **Application**: `StaffNoteAppServiceContractTests`, 3/3.
  - It checks that `[Authorize]` is present with no permission attached.
  - It checks that the branch scope goes through `BranchAccessChecker`.
- **API, real host + PostgreSQL**: `e2e/staff-notes-api.spec.ts`, 9/9.
  - Cá nhân is the author's alone (404 for anyone else) under every branch header.
  - Chung is visible in its branch only. A write to a foreign branch is refused
    with 403 (`branch2`).
  - With no header, a new Chung note lands in the account's own branch.
  - A non-author can read a Chung note but cannot edit or delete it.
  - Content rules and an invalid scope are refused.
  - Search is server-side; every word must match and case does not matter.
  - Search ignores Vietnamese marks both ways. đ = d, decomposed marks fold
    too, and the match is not fuzzy (R-992).
  - Pages come newest first with the full count.
  - A deleted note is gone from the list and can no longer be edited.
- **UI, production build** (`vite preview`, real login, no interception):
  `e2e/staff-notes.spec.ts`, 5/5.
  - It opens from the icon and from Alt+N, has no backdrop, and Esc and outside
    clicks leave it open.
  - Dragging by the title moves it, and reopening centres it.
  - Add, copy (clipboard), edit, delete, then reload — the note persists.
    Searching without marks finds the marked note (R-992).
  - A Cá nhân note is visible to its author only.
  - In Tất cả chi nhánh mode, Chung waits for a branch and Cá nhân does not.
- **Persistence**: after the runs, the test rows in `bd_staff_notes` carry
  `IsDeleted = true`, with `DeletionTime` and `DeleterId` set. The delete is
  soft, not a row removal.
- **Layout**: measured, not eyeballed.
  - Column widths STT / Nội dung / Thao tác: 64 / 454 / 120 at 1440px, and
    40 / 188 / 120 at 390px.
  - On a phone, Chung / Cá nhân split the row.
- **Level 3 regression**, because the header is shared chrome: 45/48 across
  - `auth`
  - `branch-code-url`
  - `branch-switcher`
  - `header-navigation`
  - `patient-back-origin`
  - `popup-placement`
  - `routes`

  The 3 reds are all in `header-navigation`. They fail the same way on a clean
  HEAD build, so they predate F-74:
  - the `/reception$` assertion versus `?branch=BD-001`
  - a drawer count of 17 versus 14
  - the "Tiếng Việt" label

## Coverage gap

`StaffNote:0003` cannot be reached over HTTP with the seeded accounts, because
each of them has an own branch. Only the domain test covers it.
