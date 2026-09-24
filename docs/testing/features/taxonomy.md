# F-02 — Danh mục (taxonomy + catalog entries)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The single screen behind all twelve "Danh mục" sub-routes of the reference: a
group list on the left, the entries of the selected group on the right.

## API surface

```
GET    /api/v1/app/taxonomies?clinicBranchId&group&includeCount
POST   /api/v1/app/taxonomies
PUT    /api/v1/app/taxonomies/{id}
DELETE /api/v1/app/taxonomies/{id}
GET    /api/v1/app/catalog-entries?clinicBranchId&group&taxonomyId&filter
POST   /api/v1/app/catalog-entries
PUT    /api/v1/app/catalog-entries/{id}
DELETE /api/v1/app/catalog-entries/{id}
```

## Rules under test

- A group belongs to one catalog (`group` slug); entries inherit it from the
  group and can only move between groups of the same catalog.
- Price is accepted only for `care_service`, `medication_type`, `supplies`.
- Template content is accepted only for `prescription_template` and
  `medical_record_template`.
- System groups cannot be renamed, deactivated or deleted.
- A group with entries cannot be deleted.
- Each catalog is guarded by its own ability subject via `TaxonomyGroupAbilities`.

## Acceptance evidence

`e2e/taxonomy.spec.ts`:

1. creates a group, creates a 180.000 đ service inside it, asserts the row shows
   the price and the group, then reloads and asserts it is still there
2. asserts the selected catalog lives in the URL
3. asserts the two unmodelled catalogs say why they are empty

## Not covered yet

- Editing and deleting entries through the UI (server rules are unit-tested)
- Reordering (`sortOrder`) — no drag handle wired
- `Thẻ hồ sơ` and `Phương thức thanh toán`: the reference models these outside
  the taxonomy pattern; BlueDental has no entity for them yet

## Nhập từ Excel (added 2026-09-24, BlueDental-only)

Not on the reference: a BA requirement to bulk-load catalog data into the new
system. Owner decisions, all implemented:

- 8 catalogs: service, diagnosis, medicine, consulting, source, history,
  occupation, prescription-template (2-sheet file; medicines looked up by
  name in Loại thuốc of the branch, missing → error). Bệnh án mẫu deferred;
  Thẻ hồ sơ and Phương thức thanh toán not needed.
- "Nhóm phân loại" column: group exists in the branch → add into it; missing
  → created on commit. Same name twice in the file (same group) → error;
  same name as an active row → **update** when any other imported column
  differs, **skip** when nothing differs (owner, 2026-09-24: "update nếu có
  thay đổi trường nào khác, bỏ qua nếu không thay đổi gì"); same name as a
  soft-deleted row → restore, taking the file's values. On an update or
  restore a blank cell keeps the stored value, so a field cannot be cleared
  by import. Updating needs the tab's `edit` right; without it the row is an
  error and the file is refused. Blank priority → file row order. Rich text in a
  cell → HTML for "Nội dung" (diagnosis/consulting). Money accepts numbers and
  "1.000.000".
- The whole file is refused on any error; the preview names every row and its
  error; "Tải file lỗi" returns the original rows + a "Lỗi" column. No inline
  edit, no import history, no size/row limit (preview table is virtualised).
- Permission: the tab's own `create` ability (no new leaf). Read-only accounts
  do not see the button; a direct call is 403. Import lands in the branch the
  header points at; "Tất cả chi nhánh" disables the button. A missing required
  column rejects the file; extra columns are ignored.

Endpoints: `GET /catalog-entries/import-template?group=`,
`POST /catalog-entries/import` (multipart file/group/clinicBranchId/dryRun),
`POST /catalog-entries/import-errors` — see `docs/clone/api.md`.

Acceptance evidence (real stack, preview build on 8080 + API on 5000):

- `e2e/taxonomy-import-api.spec.ts` (9 tests): template per catalog, dry run
  vs commit, create/skip/restore, update when a column differs (priority,
  price/unit with blank cells kept, prescription lines) and skip on the
  identical file again, restore carrying the file's priority, in-file duplicate, missing required column,
  branch scoping, 403 for a read-only account, two-sheet prescription
  template with missing medicine / missing template errors, error file with
  the "Lỗi" column readable by SheetJS.
- `e2e/taxonomy-import.spec.ts` (4 tests): good file previewed → imported →
  toast → rows visible after reload → same file again is all "Bỏ qua (không
  thay đổi)" and the import button is disabled → one changed priority shows
  one "Cập nhật" tag, "Nhập 1 dòng" imports it and the table still has two
  rows; bad file refused with the row named, only-errors
  filter, error file download, nothing saved after reload; the 20-column
  Dịch vụ preview is grabbed and dragged sideways like every other table
  (header follows, scrollLeft moves) while the pinned "Kết quả" column stays
  put; template download and no "Nhập" button
  on the three catalogs without import.
- `BlueDental.Application.Tests` `CatalogImportAppServiceContractTests` (13).

Regression log: R-553..R-558, R-559..R-561 (update-if-changed), R-562 (preview
table is no longer virtual, so the app-wide grab-to-scroll and the native
horizontal bar work on it), R-563 ("Kết quả" pinned right, moved after "Lỗi").

## Dialog Thêm dịch vụ — công đoạn %/VNĐ và tab Labo (2026-09-24)

Staging changed the service dialog: no `Mã dịch vụ` box, a new stage table
(value type toggle, marketing-salary star, inline rename, paging) and a fourth
tab, **Labo**, that picks the branch's labo suppliers.

Rules under test:

- `stages[].valueType` is `0` (Percentage, the default for a new row) or `1`
  (Amount); a percentage above 100 or a negative value → `Catalogs:0021`.
- `serviceConfig.laboSupplierIds` must all belong to the entry's branch →
  otherwise `Catalogs:0025`. Empty means "every supplier".
- Existing stage rows were migrated as Amount, since their values were money.
- `Giá sau giảm` / `Thực thu từ khách` follow the inputs live and use the
  formula measured on staging (R-573): net = price − discount, never below
  0; Trước thuế → net / net × (1 + rate); Sau thuế → net ÷ (1 + rate) / net.
  The domain (`CatalogServiceConfig`) and `servicePricing.ts` share it.

Acceptance evidence (real stack, preview build on 8080 + API on 5000):

- `e2e/taxonomy-dialogs.spec.ts` "a service keeps its price configuration,
  stages, warranty and labo suppliers": four tabs, no code box, one % stage
  with the star on, one VNĐ stage, rename by pencil, "Hiển thị 2 trên 2",
  one supplier picked ("Đã chọn 1 nhà cung cấp" plus its pill under the box;
  the pill's × takes it out, picking again brings it back), a VNĐ stage value
  typed past ten digits stops at 9.999.999.999 and a % value past 100 stops
  at 100, the two price boxes read 900 / 990 before any save and 818 / 900
  after switching to "Sau thuế", everything back after reload.
- `e2e/taxonomy-dialogs.spec.ts` "the API refuses a labo supplier from
  another branch and a share over 100 %": real HTTP from the logged-in page,
  `0025`, `0021`, and a typed amount stage stored.
- `BlueDental.Domain.Tests` `CatalogStageSyncTests` (value type / star kept
  through `SyncStages`).

Regression log: R-565..R-573.
