# Regression Log

Defects found by running the real stack, and what stops them coming back.

## 2026-08-23 — first real acceptance run

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-01 | Patient list crashed with `Cannot read properties of undefined (reading 'toLocaleString')` as soon as one patient existed | Screen unusable — it only "worked" while empty | The table bound the server DTO directly while expecting UI field names and a financial rollup the API never sends | `PatientDto` now mirrors the server; `adaptPatientListItem` produces the row shape | F-06 |
| R-02 | Create-patient form could never be submitted | No patient could be registered through the UI | One "Họ và tên" input was bound to `lastName` while the schema also required `firstName`; validation failed with no visible error | Single full-name field, split into họ/tên on submit | F-06 |
| R-03 | Create-patient request 400'd | Registration failed even after R-02 | FE sent `phone` instead of `phoneNumber`, an empty `dateOfBirth`, and no `branchId` | Request type mirrors `RegisterPatientDto`; date of birth is required | F-06 |
| R-04 | Duplicate `PatientCode` — 500 on the second registration of the day | Registration failed intermittently, looked random | Code used six characters of a **sequential** GUID; those are high-order timestamp bits and barely change | Per-branch, per-year sequence with a uniqueness walk | F-06 (spec creates a new patient every run) |
| R-05 | Enter inside the patient dialog submitted the form twice | Duplicate registration attempt; the save button hung in a loading state | Enter commits a typed value in antd's DatePicker and also submits the surrounding form | The form ignores Enter from inputs; submitting stays on the Lưu button | F-06 |
| R-06 | Newly created catalog group was not selected, so the next entry landed in the wrong group | Silent mis-filing of catalog data | The "fall back to all groups" effect ran while the group refetch was still in flight and cleared the fresh selection | Select the created group, and only fall back once the list has settled | F-02 |
| R-07 | Finance tables showed "—" for category and staff | Data existed but was invisible | `SalesEntryDto` / `CashflowEntryDto` never hydrated `categoryName` / staff name | Both app services resolve the names | F-04, F-05 |
| R-08 | Two `[Authorize]` attributes on one method | Reflection-based contract tests threw `AmbiguousMatchException`; endpoints were double-gated against a legacy permission the admin may not hold | Ability attributes were added on top of the older hand-rolled ones | Consolidated on the ability model | `BlueDental.Application.Tests` |
| R-12 | Not one business error code was localized | Every BusinessException in the app reached the user as "Có một lỗi nội bộ xảy ra" | ABP looks the code up in a localization resource; the resource had none of them | All 112 codes carry an English and a Vietnamese message | Every spec that asserts a refusal |
| R-13 | Patient search never worked | Typing a name filtered nothing | The browser sent "keyword" while the server reads "filter", and the server matched the name halves separately so a typed full name never hit | Request mirrors the contract; the server also matches the concatenation and the phone | F-06, and every spec that finds a patient |
| R-14 | The patient list came back in arbitrary order | A record just created could land on any page | No ordering was applied | Newest first | F-06, F-21 |
| R-15 | The whole appointment feature spoke a contract the server never had | Nothing it sent could be stored | doctorId / startTime / lowercase status against DentistId / SlotStart / numeric enum | The translation lives in the api layer | F-10 |
| R-16 | The appointment list ignored its own date filter | Each calendar grid was fed every appointment the clinic has ever had | The filter existed in the DTO and was never applied | Date and a from/to range are honoured | F-10 |
| R-17 | Every booking 500'd | No appointment could be created from the UI | The browser sent local wall-clock time and Npgsql refuses a +07:00 offset | Times are converted to a UTC instant | F-10 |
| R-18 | The reception board fell back to a local store | The screen looked like it worked while nothing was persisted | A try/catch around every call swallowed the failure | Every call goes to the real API | F-11 |
| R-19 | The staff screen rendered a hard-coded list | Its Create / Edit / Delete buttons did nothing | The server only had GetList and Get | Full CRUD over identity accounts | F-25 |
| R-20 | The image URL was prefixed twice | Uploaded images never rendered | The server returns an app-relative path and the component prefixed the API root again | The path is used as-is | F-24 |
| R-10 | Every treatment-stage request 500'd | The whole công đoạn panel was dead on arrival | The entity was mapped in `ModelCreatingExtensions` but had no `DbSet` on the DbContext, so ABP registered no default repository and the app service could not be activated | Added `DbSet<TreatmentStage>` | F-19 |
| R-11 | An accepted service line could never be produced through the UI | Công đoạn was unreachable: only accepted advises become service lines, and nothing accepted them | The advise table had no action column, though `useAcceptAdvise` already existed | Added the "Chấp nhận" action | F-09, F-19 |
| R-09 | Stale ReceptionPage tests | Suite was red, so it stopped being run | Assertions still expected "Khách đến" and a dialog title that had changed | Updated to the current UI wording | `BlueDental.FE` Vitest |

## Notes

- R-01 through R-05 were all in one feature and all invisible to the existing
  unit/mocked tests — they only appeared once a browser talked to a real API and
  a real database. That is the reason `00-test-policy.md` refuses to count
  mocked tests as acceptance.
- R-12 through R-20 all came out of wiring group A and B. Every one of them was
  invisible to the type checker and to the unit tests: the code compiled, the
  migrations applied, and the screens rendered. Only a browser talking to a real
  API and a real database showed that nothing was being stored.
- R-10 is the same lesson as R-01: the code compiled, the migration applied, and
  the unit tests passed. Only a browser hitting the real DI container found it.
- R-04 only reproduces on the *second* write in a period. Specs that create data
  every run are what catch this class of defect; a fixture that reuses one record
  would not.

## 2026-08-24 — merging origin/main into the design branch

Three defects that only a running browser would have shown. None were type
errors, so neither branch's typecheck had caught them.

| What broke | Why | Fix |
|---|---|---|
| Every screen answered 403 | The merged services authorise against the ability catalogue, but the merge kept only main's permission definition provider, which does not declare it. ABP refuses a permission that was never defined, so no grant could help. | Registered the ability catalogue alongside main's permissions again, and made the seeder grant whatever the definitions declare rather than naming one catalogue. |
| Every screen then answered `BlueDental:Organizations:0005` | main's resolver takes the clinic from a `ClinicBranchId` claim, which the claims contributor reads off the user's extra properties. The `admin` account had none. | The seeder now sets that property (and the assignment row) for admin, the demo dentists and the branch-two account. |
| Labo crashed on render | `LABO_STATUS_CONFIG` was keyed by a string union (`"New"`, `"Warranty"`) the server never sends — `LaboStatus` is a numeric enum. `CONFIG[1]` was undefined and reading `.color` threw. Pre-existing on main. | Keyed the config by the server's enum and pointed the filter chips at Sent / InProgress / Received. |

Caught by `e2e/screen-sweep.mjs`, which walks every route and fails on an
application console error or an empty page.

## 2026-08-25 — first pass over the deployed production build

Both found by using the deployed app at `bluedental.bluestar.com.vn` rather
than a local one. Neither is a type error and neither shows up on a seeded
local database, which is why they had survived every earlier run.

| What broke | Why | Fix |
|---|---|---|
| A refused login told the user `InvalidUserNameOrPassword` | That is ABP's `LoginResultType` enum name. The account endpoint returns it in `description`, the login form printed `description` as-is, and ABP never localizes it — so the screen quoted an internal identifier at whoever mistyped a password. | The four refusal codes carry their own Vietnamese wording; a lockout also says how many minutes are left when the server sends `lockoutMinutes`. |
| `/patient/<unknown id>` rendered a blank page | `if (!patient) return null` — a fetch that 404s left the route with nothing to draw. A stale bookmark, a record moved to another branch, or a mistyped id all landed on white. | The route shows the empty state and a way back to the list. |

The second one only appears where no patient exists, so a seeded local database
hides it: every local run had a first row to click. Production was empty on its
first day, and `e2e/screen-sweep.mjs` walked into `/patient/undefined` and
reported 0 characters — the same signal that caught the 2026-08-24 defects.
## 2026-08-24 — cloning the redesigned Danh mục screen

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-30 | Tailwind never compiled | Every utility class in the codebase — including all of `components/ui` (shadcn) — was inert; screens only looked right where hand-written CSS in `styles/index.css` happened to cover them | `@tailwindcss/vite` was a dependency and `styles/index.css` began with `@import "tailwindcss"`, but the plugin was never added to `vite.config.ts`, so nothing scanned the sources | Registered `tailwindcss()` in `vite.config.ts`; the reference palette is now declared as `--color-app-*` tokens in the `@theme` block | Full suite (46 specs) re-run after the change |
| R-31 | Modals, sheets, popovers and dropdowns rendered **underneath** the fixed navigation rail | A left-anchored sheet was half hidden; dialogs sat next to, not above, the rail | Radix overlay layers ship at `z-index: 50`; `.app-sidebar` is `z-index: 100` | One rule in `styles/index.css` lifts every `[data-slot=…-overlay|content]` to `z-index: 110` | F-02 mobile group sheet; every spec that opens a dialog |
| R-32 | Form labels in the catalog entry modal were not associated with their inputs | Screen readers announced unlabelled fields, and `getByLabel` could not find them | `<label>` elements carried no `htmlFor` and the inputs no `id` | A local `Field` wrapper renders `<Label htmlFor>` and links the validation message with `aria-describedby` + `role="alert"` | F-02 (`e2e/taxonomy.spec.ts` fills every field by label) |
| R-33 | Reloading Danh mục dropped the selected group and briefly listed **every** entry in the catalog | The table flashed the wrong rows on each load, and the flash was wide enough to make assertions pass against the wrong data | The selection lived in component state, so on mount `taxonomyId` was undefined and the query fetched the whole catalog before the first group was picked | The selected group lives in `?group=<id>`; the entry query stays disabled until a group is known | F-02 (`reorders entries from the keyboard and keeps the new order` reloads and re-asserts) |

| R-34 | `PatientTag` was not scoped to a clinic branch | Every branch would have seen and edited every other branch's record labels | The entity predates the branch rule in CLAUDE.md §3.3 and had no `ClinicBranchId`; its AppService filtered on nothing | `ClinicBranchId` added, colour made required, and the service now resolves and checks the branch like every other catalog service | F-29 |
| R-35 | `bd_payment_methods` was a code/name lookup no screen ever read | Dead table; the real screen manages MoMo wallets and bank accounts, which it could not represent | Placeholder written before the reference screen was observed | Replaced by `bd_payment_accounts` (kind, holder, phone / bank + account number), branch-scoped | F-29 |
| R-36 | The EF model snapshot has drifted from the database for unrelated entities | Any scaffolded migration carries phantom drops of prescription and treatment-plan columns that are already applied | A merge lost the snapshot updates that went with `ReshapePrescription` and the treatment-plan work; the database is correct, the snapshot is not | **Not fixed here.** This migration was hand-written so it carries only its own changes, and the snapshot was edited by hand for just the two entities it touches. The drift needs its own pass | — |

## 2026-08-24 — branch switcher and BlueDental's own accent

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-37 | The header's branch switcher did nothing | Every screen was pinned to one hard-coded branch id, whoever was signed in; a second-branch account was looking at a branch it does not belong to until the server refused a call | `useCurrentBranchId()` returned a constant, and the popover listed two hard-coded rows | A persisted store holds the selection, the header fills it from the real branch list, and screens read `useBranchFilter()` for lists and `useCurrentBranchId()` for writes | F-30 |
| R-38 | `GET /clinic-branches` returned every branch to every account | The switcher offered branches the account cannot read, so picking one produced a wall of 403s — and it enumerated other branches to a branch-scoped user | The list was not narrowed by `BranchAccessChecker` | New `accessibleOnly` flag, used by the switcher; the branch-administration screens still get the full list | F-30 |
| R-39 | `Taxonomy` and `CatalogEntry` reads ignored the requested branch | Switching branches could not change what the catalog screens showed — they always filtered by the caller's own claim | `GetListAsync` used `ICurrentClinicBranchResolver` instead of `BranchAccessChecker.ResolveFilterAsync(input.ClinicBranchId)` | Both now resolve the requested branch through the checker, and `GetAsync`/`Update`/`Delete` check the record's own branch | F-30, F-02 |
| R-40 | A catalog entry took its branch from the caller, not from its group | An entry could be written into a different branch from the group it belongs to | `CreateAsync` used the claim branch and ignored the group's | The entry now inherits `taxonomy.ClinicBranchId`, checked first | F-02 |
| R-41 | Switching branches left a stale `?group=` in the URL | The entry query fired with another branch's group id and returned 403 | The effect only replaced the group when the list was non-empty | The parameter is dropped when the new branch has no matching group | F-30 |

## 2026-08-24 — QR ảnh phương thức thanh toán + dữ liệu hai chi nhánh

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-42 | The branch popover stayed open after a branch was picked | The menu covered the screen the user had just switched, and a second switch needed a stray click to dismiss it first | The `Popover` was uncontrolled, so selecting an item changed the store without ever closing the menu | The header owns `branchMenuOpen`; picking a branch selects it and closes | F-30 |
| R-43 | Only the first branch had catalog data | Every "Danh mục" tab looked identical (empty) in the second branch, so branch scoping could be neither demonstrated nor seen to fail | The dev seed filled one branch with three rows; the second branch was created but never populated | `BlueDentalTaxonomyDemoSeedContributor` seeds every catalog, tag and payment account in both branches, with deliberately different contents, under deterministic ids so re-running tops up rather than duplicates | F-30 |
| R-44 | No account could switch branches at all | The switcher could not be exercised end to end: `admin` is assigned to branch 1 and `branch2` to branch 2, so neither is ever offered a second branch | Both seeded accounts carry a `StaffBranchAssignment`, and an assignment is what restricts an account | A third dev account, `manager`, is seeded with no assignment — which `BranchAccessChecker` already reads as clinic-wide | F-30 |

### Suite state after this pass (2026-08-24)

Full run: **55 passed, 30 failed** in 14.5 min (85 tests).

The blast radius of this pass is green — `branch-isolation`, `branch-switcher`,
`payment-qr`, `taxonomy` and `taxonomy-flat`: **20/20**.

The 30 failures are **pre-existing and unrelated**: those specs were written
against an Ant Design UI that no longer exists. They wait on selectors that
appear nowhere in `src` — `.ant-picker-input`, `tr.ant-table-row`,
`span.anticon-global` — and `antd` is not even a dependency any more. Affected:
`patient`, `prescription`, `treatment-plan`, `treatment-stage`, `voucher`,
`staff`, `timekeeping`, `finance`, `materials`, `operations`, `patient-image`,
`reception`, `sidebar-navigation`, `export`, `appointment`. Rewriting them
against the current DOM needs its own pass — they are stale specs, not
regressions.

`branch-isolation.spec.ts` was the one genuine stale spec inside this pass's
radius and was rewritten: it encoded the older contract where naming another
branch was silently narrowed. Since R-39 the server refuses it, so the spec now
asserts **403** — a stricter assertion, not a relaxed one — and uses the new
clinic-wide `manager` account for the case that really is clinic-wide.

## 2026-08-24 — nhóm phân loại: dialog, tìm kiếm, kéo-thả, reorder

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-45 | The "Tạo nhóm" dialog had no `Mức độ ưu tiên` field | The reference asks for a priority when a group is created; BlueDental invented one (`sortOrder = groups.length`) and never showed it, so a group could not be placed deliberately | The field was not noticed when the dialog was first cloned | The dialog now matches what the reference draws: `Tên phân loại` + `Mức độ ưu tiên` side by side, prefilled `0`, one `Lưu` button with a save icon and no `Huỷ` | F-32 |
| R-46 | Searching the group panel filtered the rows already on screen | A group outside the fetched page could not be found, and the count in the header disagreed with the list | The panel held its own `keyword` state and ran `Array.filter` | The container owns the term, debounces it and sends `filter=` to `GET /taxonomies`; the panel renders what comes back | F-32 |
| R-47 | Reordering wrote one PUT per moved row | N requests for one drag, and a failure part-way left the catalog half-sorted with no way to tell | There was no reorder endpoint, so the client updated each row | New `POST /taxonomies/reorder` and `POST /catalog-entries/reorder` take the whole list (`items: [{id, order}]`) and apply it in one transaction, checking branch access and that every row belongs to the catalog named | F-32, F-02 |
| R-48 | Drag felt late and was locked to the vertical axis | The row never followed the pointer, so the gesture read as "nothing is happening" until it snapped | HTML5 drag-and-drop: `draggable` was only set on mousedown, the browser decided when a drag began, and the drop target was merely highlighted | `useDragReorder` — pointer events, the lifted row's `transform` written straight to the DOM so it follows the pointer on both axes, and the list reordered as it passes each row. Shared by the group panel and the entry table | F-32, F-02 |
| R-49 | Opening a dialog re-rendered every row of the group panel | Added to the dev-server cost of opening a dialog, which reads as jank | The panel rendered its rows inline and the container passed fresh closures each render | Rows are a memoised `GroupRow`; the container's row handlers are `useCallback`; the drag hook caches its per-row ref and grip props. Measured on the group dialog: dev **~120ms → ~86ms** of script, production build **~13ms** (`Performance.getMetrics`, ScriptDuration). Most of what is left is React dev-mode + StrictMode double-render, not the app | F-32 |
| R-50 | Search was case-sensitive and looked at one or two columns | "trám" found nothing when the row read "Trám"; a trailing space from a paste found nothing at all; and a service could not be found by its description | `Contains` maps to a case-sensitive `LIKE` on PostgreSQL, and each service filtered on `Name` (plus `Code` on entries) only | `SearchTerms` folds case and splits on whitespace; every catalog service now matches each term against every text column it shows — groups (name/alias/description), entries (name/code/description), tags (name/colour/description), payment accounts (holder/phone/bank/account). A row must carry **all** terms, in any order. Verified against `lower()` under the `en_US.utf8` collation, so Vietnamese folds the same on both sides | F-32 |

## 2026-08-25 — rà soát parity toàn bộ tab Danh mục (P1 + P2)

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-51 | Mọi dialog danh mục dùng khung riêng của shadcn, không phải khung của bản gốc | Nhãn nằm trên ô thay vì nổi trên viền, có nút `Huỷ` mà bản gốc không có, thiếu hai đường kẻ — đủ để đọc ra là một ứng dụng khác | Các dialog được dựng rời rạc trước khi khung chung của bản gốc được ghi nhận | `AppDialog` dùng chung + `FloatingField`/`FloatingSelect`; ba dialog đã chuyển sang | F-32, F-29 |
| R-52 | Menu hàng nhóm có 4 mục, bản gốc có 2 | Lệch thấy được ngay | `Di chuyển lên/xuống` được thêm để có đường bàn phím | Menu còn `Chỉnh sửa` · `Xoá`; grip đổi thành `<button>` nhận `↑`/`↓` nên đường bàn phím vẫn còn | F-32 |
| R-53 | Bảy tab taxonomy dùng chung một dialog với bộ field bịa | Ví dụ Nguồn đến hỏi giá và mã — bản gốc chỉ hỏi tên, nhóm, trạng thái, ưu tiên | Một `CatalogEntryModal` dùng cho mọi danh mục | `SimpleCatalogDialog` cho 3 tab đơn giản; 4 tab còn lại theo P3–P5 | F-32 |
| R-54 | Tab Nghề nghiệp có nút `Xuất` mà bản gốc không có | Lệch thấy được | Header dùng chung luôn vẽ nút | Cờ `exportable` trên cấu hình tab | F-32 |

## 2026-08-25 — dialog theo từng danh mục (P3 → P7)

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-55 | Bảy tab taxonomy dùng chung một dialog với bộ field bịa | Dịch vụ thiếu ~20 field bản gốc có (thuế, giảm giá, công đoạn, bảo hành); thuốc thiếu hoạt chất và giá mua; đơn thuốc mẫu lưu một chuỗi thay vì các dòng thuốc | `CatalogEntryModal` được viết trước khi các dialog của bản gốc được quan sát | Mỗi danh mục có dialog riêng: `ServiceDialog`, `MedicineDialog`, `RichCatalogDialog`, `PrescriptionTemplateDialog`, `MedicalRecordTemplateDialog`, `SimpleCatalogDialog`. `CatalogEntryModal` đã xoá | F-34 |
| R-56 | `Select` mở trong dialog vẽ **dưới** lớp phủ của dialog | Không bấm được lựa chọn nào — mọi dialog có select đều hỏng | Quy tắc z-index của R-31 liệt kê sheet/dialog/alert-dialog/dropdown/popover nhưng **thiếu** `select-content` | Thêm `[data-slot="select-content"]` và `tooltip-content` vào cùng quy tắc | F-34 (test dịch vụ chọn "% thuế") |
| R-57 | Refetch danh sách nhóm xoá sạch form đang gõ dở | Đang nhập một dịch vụ mà query nhóm refetch (đổi tab cửa sổ, invalidate) là mất hết | Effect khởi tạo form để `groups` và `defaultTaxonomyId` trong dependency list; React Query trả mảng mới mỗi lần fetch | Đọc qua `useRef`; effect chỉ chạy theo `[open, entry]` | F-34 |
| R-58 | `IsImageRequired` nằm trên bảng dùng chung | Cờ chỉ có nghĩa với dịch vụ lại nằm cùng chỗ với chẩn đoán, nghề nghiệp… | Đặt vào `bd_catalog_entries` từ đầu | Chuyển sang `bd_catalog_service_configs` cùng ba cờ cài đặt khác; migration mang dữ liệu cũ theo | F-34, F-19 |
| R-59 | Migration đầu tiên thêm `ExtraProperties`/`ConcurrencyStamp` cho bảng con | `INSERT` chết với `null value in column "ExtraProperties"` | Sao chép mẫu cột từ bảng aggregate root; entity con là `Entity<Guid>` nên không có hai cột đó — giống `bd_prescription_items` | Bỏ hai cột khỏi migration và snapshot | F-34 |

## 2026-08-25 — tờ A4 bệnh án mẫu dựng lại theo bản gốc

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-60 | Tờ A4 dựng sai biểu mẫu | Dựng theo bệnh án **nội trú** của Bộ Y tế với các textarea rời, trong khi bản gốc in **bệnh án ngoại trú chuyên khoa răng hàm mặt** ba trang, dày đặc ô vuông và gạch chân | Lần quan sát đầu chỉ đọc cây accessibility của iframe nên mất hết bố cục, kích thước và các khối in sẵn | Đọc thẳng DOM + computed style của iframe: 3 trang `794×1053`, `.grid-box` 20×20, `.box` 15×15, ô nhập nền `#FFFDE7`. Dựng lại đủ 17 ô nhập đúng placeholder, hàng sinh hiệu, bảng hồ sơ phim ảnh, khung hình vẽ tổn thương và hai khối ký | F-34 |
| R-61 | `Cell` khai báo bên trong `MedicalRecordSheet` | Mỗi lần render là một component type mới → React unmount/remount, con trỏ nhảy ra khỏi ô ngay ký tự đầu tiên | Viết component con ngay trong thân hàm render | Đưa ra ngoài module, nhận `value`/`onChange` qua props | F-34 |
| R-62 | Tờ A4 dính lề trái, chừa khoảng xám bên phải | Thu phóng càng nhỏ càng lệch | `transform: scale` không đổi hộp layout, nên khối vẫn chiếm trọn bề ngang A4 và nằm sát trái | Bọc thêm một hộp đúng kích thước sau khi thu phóng (`width/height × zoom`) rồi `mx-auto`; khoảng cách giữa các trang chuyển sang `gap` của cột flex thay vì margin từng trang | F-34 (test đo hai lề, chênh < 6px) |
| R-63 | Hộp xác nhận xoá không giống bản gốc | Không nêu bật tên bản ghi đang xoá, và nút xoá dùng đúng màu primary như nút "Lưu" — một hành động không hoàn tác được lại trông như một hành động bình thường | Ba màn hình tự dựng `AlertDialog` riêng, không đối chiếu bản gốc | `ConfirmDeleteDialog` dùng chung: tiêu đề `Xác nhận xoá {noun}`, tên bản ghi **in đậm** trong câu hỏi, dòng `Hành động này không thể hoàn tác.`, nút `Huỷ` nền xanh nhạt và nút `Xoá` **đỏ** có icon thùng rác | F-32 (test đo màu nền nút) |
| R-64 | Thả item sau khi kéo thì danh sách nháy về thứ tự cũ rồi mới sang thứ tự mới | Đo bằng bộ ghi theo từng khung hình: **467ms** hiện thứ tự cũ, **590ms** mới sang thứ tự mới — nháy ~123ms | Thứ tự tạm trong lúc kéo bị xoá ngay khi mutation kết thúc, mà cache của React Query lúc đó vẫn giữ dữ liệu cũ, phải chờ refetch mới đúng | Cập nhật cache lạc quan trong `onMutate` (áp `items[{id, order}]` vào mọi list đang cache rồi sắp lại), khôi phục nguyên trạng trong `onError`, `invalidateQueries` chuyển sang `onSettled`. Đo lại: chỉ còn 2 mốc (9ms, 45ms) rồi đứng yên | F-32 (test ghi 120 khung hình quanh lúc thả, khẳng định hàng đầu không đổi) |
| R-65 | Bản ghi vừa tạo không nằm ở đầu danh sách | Thêm một nhóm hay một mục xong phải đi tìm nó giữa danh sách | Thứ tự phụ là `ThenBy(Name)` — xếp theo bảng chữ cái, nên vị trí phụ thuộc vào cái tên chứ không phải vào việc vừa mới tạo | Thứ tự phụ đổi thành `ThenByDescending(CreationTime)` cho nhóm và mục danh mục, `OrderByDescending(CreationTime)` cho thẻ hồ sơ. `Mức độ ưu tiên` vẫn thắng — mới chỉ quyết định thứ tự giữa các bản ghi *cùng* mức ưu tiên | F-32 (test dựng hai nhóm rồi khẳng định cái mới ở đầu, và ưu tiên vẫn thắng) |
| R-66 | Lưu/xoá trong dialog không có dấu hiệu đang chạy | Nút chỉ mờ đi — người dùng không biết là đang chạy hay là bị chặn | `AppDialog` và `ConfirmDeleteDialog` chỉ `disabled` khi đang gửi | Nút đổi sang spinner kèm chữ `Đang lưu…` / `Đang xoá…`. Test làm chậm đường truyền bằng CDP (API vẫn trả lời thật, chỉ thêm độ trễ) nên khẳng định không còn đua với tốc độ mạng | F-32 |

### Ghi nhận: panel nhóm cắt ở 200 dòng

`useTaxonomyGroups` gọi với `maxResultCount: 200` và panel không phân trang, nên
một chi nhánh có hơn 200 nhóm sẽ **mất phần đuôi mà không báo gì**. DB dev đang có
213 nhóm `care_service` do các lần chạy E2E tích lại, và chính điều đó làm hai test
đỏ khi thứ tự đổi sang newest-first (nhóm ưu tiên cao rơi khỏi 200 dòng đầu).

Hai test đã sửa để không phụ thuộc số lượng (dùng tìm kiếm để thu hẹp, và tạo nhóm
ở mức ưu tiên mặc định để chúng nằm đầu danh sách). **Giới hạn 200 thì chưa xử lý** —
bản gốc chỉ có 9 nhóm nên chưa quan sát được nó phân trang hay cuộn vô hạn.
| R-67 | Tờ A4: sinh hiệu và bảng bàn giao hồ sơ vẽ sai bố cục | Sinh hiệu xếp thành một hàng ngang dưới `IV. KHÁM BỆNH` thay vì nằm trong hộp có viền bên phải; các ô `Họ tên` trong bảng bàn giao thiếu gạch chân, cột quá hẹp làm `Người giao hồ sơ:` xuống dòng, cột bác sỹ căn đáy thay vì căn giữa | Lần dựng trước đọc cấu trúc mà bỏ qua `div.clear` — dấu hiệu của một khối float phải; và bảng thì dựng theo trí nhớ chứ chưa soi lại ảnh | Cột trái giữ `1. Toàn thân` cùng hai gạch chân, cột phải là hộp viền chứa 5 dòng sinh hiệu; bảng chia lại tỉ lệ cột 38/14/24/24, mỗi `Họ tên` có gạch chân, cột cuối `align-middle` | F-34 (test đo hộp sinh hiệu nằm bên phải ô khám toàn thân và có viền, đồng thời khẳng định hai tiêu đề cột bàn giao không xuống dòng) |
| R-68 | Bảng dữ liệu vẫn nháy khi thả, dù panel nhóm đã hết | Đo theo từng khung hình: **47ms** quay về thứ tự cũ, **285ms** mới sang thứ tự mới, rồi **443–593ms** phủ thêm lớp loading — nặng hơn cả lỗi cũ của panel nhóm | Hai nguyên nhân chồng lên nhau. Một: bảng truyền `onReorder={(from, to) => void reorderEntries(from, to)}` — `void` vứt mất promise nên hook `await` phải `undefined`, xoá thứ tự tạm ngay lập tức trong khi cache chưa kịp cập nhật lạc quan. Panel nhóm truyền thẳng hàm nên không dính. Hai: `isLoading={entriesQuery.isFetching}` bật lớp phủ cho cả lần refetch sau khi lưu, phủ lên đúng dữ liệu đã đúng sẵn | Truyền thẳng `onReorder={reorderEntries}` (bọc `useCallback` để bảng memo hoá còn tác dụng), và tắt lớp phủ khi đang có mutation sắp xếp: `entriesQuery.isFetching && !reorderEntriesMutation.isPending`. Panel nhóm cũng bỏ mờ trong lúc đó. Đo lại: **một trạng thái duy nhất** suốt 2,5s | F-02 (test ghi 120 khung hình quanh lúc thả, khẳng định bảng chỉ có đúng một trạng thái và không có lớp phủ) |


## 2026-08-25 — rebase lên `main` và chuyển sang Ant Design

`main` đã đổi thư viện UI sang **Ant Design 6** và **gỡ hẳn Tailwind** khỏi build.
15 commit của nhánh này rebase sạch, nhưng phần giao diện thì phải dựng lại: 245
lớp utility của Tailwind trong màn hình Danh mục không còn sinh ra CSS nào.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-69 | Backend không build được sau rebase | Toàn bộ BE đứng — không chạy được test thật nào | Hai dấu `>>>>>>> 6c3bd52` còn sót trong `BlueDentalDbContextModelSnapshot.cs` (dòng 700 và 1398): nửa `<<<<<<<`/`=======` đã bị xoá nên `git` không báo còn xung đột | Xoá hai dòng thừa; `dotnet build` sạch, 0 warning | `dotnet build BlueDental.sln` |
| R-70 | 245 lớp Tailwind trong Danh mục không còn tác dụng | Bảng, panel nhóm, tờ A4, các dialog mất toàn bộ khoảng cách, viền, màu | `main` gỡ Tailwind nhưng để lại các chuỗi class trong những component nhánh này đã viết | Đặt tên ngữ nghĩa cho từng khối (`bd-cat-*`, `bd-a4-*`, `bd-group-*`, `bd-pager-*`, `bd-search-*`, `bd-tab*`) và viết CSS thật trong `src/styles/index.css`, theo đúng lối `main` đang dùng (`page-header`, `app-popover-*`) | `vite build` + toàn bộ E2E Danh mục |
| R-71 | Thanh tab của trang Danh mục đè lên nội dung | Không bấm được sang catalog khác — Playwright báo `bd-group-headrow ... intercepts pointer events` | `PageTabBar` mất `shrink-0`, nên là flex item co lại dưới chiều cao nội dung và phần tràn bị anh em phía sau vẽ đè | `PageTabBar` chuyển sang class ngữ nghĩa, `.bd-tabbar { flex-shrink: 0 }` | F-31 (test "gives every catalog its own URL") |
| R-72 | Nhóm vừa tạo không được chọn | Tiêu đề panel vẫn là nhóm cũ, bảng bên dưới là dữ liệu nhóm khác | Effect dự phòng "selection không còn trong danh sách thì quay về nhóm đầu" chạy trước khi **URL** kịp mang id mới *và* trước khi danh sách nhóm kịp refetch, nên cướp lại selection vĩnh viễn | Ghi id đang chờ vào ref; effect bỏ qua cho tới khi **cả hai** đuổi kịp rồi mới xoá ref | F-31, F-32 |
| R-73 | Dialog "Tạo nhóm" đôi khi kẹt mở sau khi lưu | Lưu xong nhưng dialog vẫn đứng đó | `onCreated()` gọi trước `onClose()`, nên bất kỳ trục trặc nào trong lúc cha chuyển selection cũng chặn luôn việc đóng | Đóng trước, báo cho cha sau | F-31 |
| R-74 | Mọi tài khoản ngoài chi nhánh 1 gặp 403 hàng loạt | Tài khoản `branch2` mở màn hình nào cũng 403, tạo nhóm thì `POST /app/taxonomies → 403` | `useCurrentBranchId()` trả về hằng `DEFAULT_BRANCH_ID` (chi nhánh 1) mỗi khi header đang ở "Tất cả chi nhánh" — mà "tất cả" là một *bộ lọc*, không phải một nơi để ghi vào | Dự phòng đổi thành **chi nhánh của chính tài khoản** (`user.clinicId`). Store khởi tạo bằng `null`, và `initBranchForSession()` chốt chi nhánh **ngay khi phiên đăng nhập được thiết lập**, trước khi màn hình đầu tiên gọi API | F-33 (branch-switcher, branch-isolation) |
| R-75 | Bộ chọn chi nhánh mời cả chi nhánh không được phép | Chọn phải là 403 toàn bộ màn hình | `AppLayout` gọi `useClinicBranches()` không tham số → liệt kê mọi chi nhánh | Gọi `useClinicBranches(true)` (`accessibleOnly`) | F-33 |
| R-76 | Chọn chi nhánh xong menu không đóng | Danh sách nằm đè lên trang vừa tải lại | antd `Popover` không kiểm soát thì click bên trong không tự đóng, khác với Radix | `Popover` chuyển sang có kiểm soát; `handleBranchChange` đóng menu | F-33 |

### Ghi nhận: flake chỉ có ở dev server

Ba test Danh mục thỉnh thoảng đỏ khi chạy với `vite dev`, và đo được nguyên nhân:
`onClick` của React **không hề chạy** dù Playwright báo click thành công. Log
mount/unmount cho thấy cả cây màn hình mount → unmount → mount một lần sau khi
tải — đúng hành vi **StrictMode** ở chế độ dev. Cú click rơi trúng lúc remount thì
mất.

Chạy cùng bộ test trên **bản build production** (`vite preview`, không StrictMode):
36/36 xanh, lặp lại 5 lần một test hay đỏ nhất cũng 5/5. Đây là hiện tượng của môi
trường dev, không phải lỗi sản phẩm — nhưng nó nói rằng **acceptance test phải chạy
trên bản build**, nên `vite.config.ts` được thêm khối `preview` (cổng 8080, proxy
API giống `server`) đúng bằng `baseURL` mặc định trong `playwright.config.ts`.

### Ghi nhận: `/app/visits` trả 500

Mỗi lần vào trang sau đăng nhập, `GET /api/v1/app/visits?keyword=&maxResultCount=50`
và `GET /api/v1/app/visits?maxResultCount=200` đều **500**. Thuộc màn hình Tiếp nhận,
nằm ngoài phạm vi lần rebase này, **chưa xử lý**.

### Selector đổi theo Ant Design

Các test thật phải bám vào DOM mà antd thực sự dựng ra:

- Nút có icon mang tên `"save Lưu"`, `"delete Xoá"` — icon của `@ant-design/icons`
  góp `aria-label` vào accessible name, nên `{ name: "Lưu", exact: true }` đổi thành
  `{ name: /Lưu$/ }`.
- `Segmented` là nhóm radio với input ẩn kích thước 0 — click vào
  `.ant-segmented-item`, không click vào `role=radio`.
- `Select` giữ một **bản sao ẩn** `role="listbox"` cho trình đọc màn hình, chỉ chứa
  vài mục đầu và text là *giá trị* chứ không phải nhãn. Mục người dùng thật sự bấm
  là `.ant-select-item-option`.
- `Modal` đặt tiêu đề trong một `div` thường — `AppDialog` và `ConfirmDeleteDialog`
  bọc lại bằng `<h2>` để tiêu đề dialog vẫn là một heading thật.

## 2026-08-25 — Danh mục dùng lại component sẵn có của app

Sau khi chuyển sang Ant Design, các màn hình Danh mục vẫn còn tự dựng bảng, ô tìm
kiếm, nút và thanh phân trang của riêng mình. Nay chúng dùng đúng những thứ app đã
có — `DataTable`, `useTablePagination`, `Input` + `SearchOutlined`, `Button` — như
màn hình Nhân sự vẫn làm.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-77 | Bảng cao vống lên theo cột nhóm dù chỉ có một dòng | Đo được: `body` cao **9498px**, thẻ bảng **9129px** trong khi bảng chỉ **163px**. Panel nhóm 200 dòng cao 9214px kéo cả trang theo | `.bd-taxonomy-page` đặt `height: 100%`, mà `main` chỉ cho `.app-main` một `min-height` — nên `100%` rơi về chiều cao nội dung, và nội dung cao nhất chính là danh sách nhóm | Trang chốt chiều cao thật: `calc(100vh - var(--bd-header-height) - 32px)`. Panel nhóm cuộn trong lòng nó, bảng cuộn trong thẻ của nó | F-31 |
| R-78 | Thanh phân trang trôi lửng giữa thẻ bảng | Bản gốc ghim nó ở đáy thẻ; bản mình để nó dính ngay dưới dòng cuối, chừa 292px trắng bên dưới | Chuỗi flex bị đứt: antd 6 lồng bảng dưới `.ant-spin`, không phải `.ant-spin-nested-loading` như CSS đang nhắm | Chuỗi `min-height: 0` chạy đủ từ thẻ xuống `.ant-table-content`; phân trang `flex-shrink: 0` | F-31 |
| R-79 | Danh mục tự dựng bảng/ô tìm kiếm/nút/phân trang riêng | Hai lối viết song song trong cùng một app, và bảng của Danh mục không có gì của `DataTable` (cột cố định, cỡ trang, tổng số dòng) | Các component này ra đời khi app còn dùng Tailwind + shadcn, trước khi `main` đổi sang antd | Bảng dựng trên `DataTable` + `ColumnsType`, phân trang trên `useTablePagination`, tìm kiếm trên `Input prefix={<SearchOutlined/>} allowClear`, nút trên `Button`. `SearchField` và `TablePaginationBar` không còn ai dùng nên xoá hẳn | F-31…F-34 |
| R-80 | Hai cảnh báo deprecated của antd ở console | `Drawer.width` và `Modal.maskClosable` | API đổi tên ở antd 6 | `size` và `mask={{ closable: false }}` | — |

### Tỉ lệ cột lấy theo bản gốc

Đo trên bảng rộng 1490px của bản gốc: tay kéo 48px, tên 567, nhóm phân loại 300,
giá 207 (canh phải), cập nhật 277, thao tác 90. Cột của mình chỉnh theo đúng tỉ lệ
đó — trước đó giá 160 và cập nhật 200 nên hai cột dính vào nhau.

### Còn khác bản gốc, và vì sao giữ nguyên

Tiêu đề cột của app **in hoa** (`.ant-table-thead th`), bản gốc thì không. Đây là
quy ước chung cho mọi bảng trong app; sửa riêng cho Danh mục sẽ làm nó lệch với
Nhân sự và các màn hình khác, còn sửa toàn cục thì đổi luôn những màn hình không
thuộc phạm vi lần này. Ưu tiên dùng lại component sẵn có nên **giữ theo app**.

### Selector đổi theo antd Table

- `tbody tr` giờ khớp cả **hàng đo** ẩn antd chèn đầu tbody — dùng `tr.ant-table-row`,
  và `:nth-of-type` thì đếm lệch một hàng nên chuyển sang `.nth(index)`.
- Nút "Thêm …" mang icon nên accessible name có tiền tố (`plus Thêm dịch vụ`) —
  neo đuôi chuỗi, đừng neo đầu.

## 2026-08-25 — lề mặc định của trình duyệt quay lại sau khi gỡ Tailwind

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-81 | Ô tìm nhóm và nút `+` đè lên dòng nhóm đầu tiên | Rõ nhất ở tab có tên dài (`bệnh án mẫu`): đo được header nhóm cao đúng `134px` nhưng nội dung cần **152px**, nên hàng tìm kiếm tràn xuống 18px và nằm chồng lên danh sách | Hai nguyên nhân chồng nhau. Một: `.bd-group-head` đặt `height` cứng `134px` — bản gốc cũng vậy, nhưng phụ đề của bản gốc **luôn ghi "dịch vụ"** ở mọi tab nên không bao giờ xuống dòng, còn mình ghép đúng tên danh mục nên tab tên dài thì xuống 2 dòng. Hai: preflight của Tailwind từng xoá lề mặc định của `<p>`/`<hN>`; Tailwind đi rồi mà reset của `main` chỉ có `box-sizing` và `body`, nên riêng tiêu đề nhóm đã âm thầm cõng thêm `16px` trên và `16px` dưới | Reset lề bằng `:where(...)` (độ ưu tiên bằng 0, không đè rule nào) cho các nhánh của Danh mục; `height` đổi thành `min-height` để nếu còn thứ gì nở ra thì nó **đẩy** danh sách xuống chứ không đè lên; phụ đề gói gọn một dòng, cắt bằng `…`, câu đầy đủ nằm ở `title` | F-31…F-34 |

Đo lại trên cả 8 tab có panel nhóm: header **135px** (bản gốc 134), không tràn,
không đè. Reset này cũng trả lại khoảng cách đúng cho tờ A4 — các `<p>` in sẵn
trong đó cũng đang cõng lề mặc định kể từ lúc Tailwind bị gỡ.

## 2026-08-25 — dialog Danh mục dùng đúng form của app

Các dialog vẫn tự dựng field riêng trong khi app đã có sẵn `FloatingField` —
đúng thứ dialog "Thêm nhân viên" đang dùng. Nay tất cả chạy trên antd `Form` +
`FloatingField`, và những chỗ dựng tay còn lại (bảng dòng thuốc, bảng công đoạn,
tab, nút zoom) chuyển sang `Table`, `Tabs`, `Button`.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-82 | Dialog Danh mục không dùng field của app | Nhãn nằm **trên** ô nhập, trong khi mọi dialog khác của app nhãn nổi **trên viền** — hai lối trình bày trong cùng một sản phẩm | `LabeledField`/`FloatingSelect` ra đời vì các dialog này giữ state React riêng, còn `FloatingField` cần một antd `Form` | Mỗi dialog có `Form` của mình; `LabeledField` và `FloatingSelect` không còn ai dùng nên xoá | F-31…F-34 |
| R-83 | Dòng thuốc trong đơn thuốc mẫu có nhãn thừa trong ô | Cột đã tên là "Tên thuốc" rồi mà trong ô lại in "Tên thuốc *" một lần nữa, đẩy lệch cả hàng | Cell dùng `FloatingSelect`, mà component đó luôn tự vẽ nhãn | Bảng dựng bằng antd `Table`; trong cell chỉ còn control trần, tên cột lo phần đặt tên | F-34 |
| R-84 | Bệnh án mẫu có hai nhãn cho một ô | "Tiêu đề bệnh án:" nằm bên trái, "Nhập tên mẫu bệnh án... *" nằm trên — cùng trỏ vào một input | Một `<span>` dựng tay đặt cạnh một `LabeledField` vốn đã có nhãn | Một `FloatingField` duy nhất, nhãn "Tiêu đề bệnh án" | F-34 |
| R-85 | Mọi field dựng trên `FloatingField` đều **không có tên** với trình đọc màn hình | `<label for>` bị đánh `aria-hidden`, mà `Form.Item` thì không vẽ nhãn nào khác — nên input không có accessible name nào cả. Ảnh hưởng cả dialog Nhân viên của `main` | `aria-hidden` có lẽ thêm vào để tránh đọc trùng, nhưng ở đây không có gì trùng để tránh | Bỏ `aria-hidden` | F-31…F-34, và `getByLabel` trong mọi test |

### Ghi nhận: 5 test đỏ sẵn, không phải do lần này

`staff`, `sidebar-navigation` và `reception` có 5 test đỏ. Đã kiểm chứng bằng
cách `git stash` toàn bộ thay đổi rồi chạy lại trên cây trước khi sửa: **vẫn đúng
5 test đó đỏ**. Nguyên nhân nằm ngoài phạm vi lần này — `/app/visits` trả 500,
selector `.sidebar-nav-item[aria-label=…]` không khớp markup sidebar hiện tại, và
`getByPlaceholder("Họ và tên")` không thể khớp vì `FloatingField` luôn ghi đè
placeholder thành `" "`.

### Selector đổi theo antd

- `check()` không dùng được cho nhóm checkbox kiểu radio (chọn cái này thì cái kia
  tắt): nó đọc `input.checked` ngay sau cú click, trước khi React kịp render lại
  nhóm. Dùng `click()` rồi `toBeChecked()`.
- Nút mang icon thì accessible name có tiền tố, kể cả nút "Công đoạn" trong dialog.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-86 | Các item trong dialog dính sát nhau, không có khoảng cách dọc | Ô nhập, editor, hàng checkbox nằm đè lên nhau về mặt thị giác — không đọc ra được đâu là một nhóm | `main` chủ động đặt `.ant-modal .ant-form-item { margin-bottom: 0 }` và để **gutter dọc của `Row`** lo khoảng cách — dialog Nhân viên truyền `[16, 12]`. Lần chuyển sang `Form` mình truyền `[16, 0]`, và những field đứng một mình (không nằm trong `Row`) thì không có gutter nào để thừa hưởng | Gutter đổi thành `[16, 12]` theo đúng dialog Nhân viên; thêm rule cho con trực tiếp của `Form` trong `.app-dialog` để field đứng một mình cũng giữ đúng nhịp | F-31…F-34 |

Đo lại trên dialog Chẩn đoán: khoảng cách giữa mọi khối là **12px** đều nhau.

## 2026-08-25 — xoá mềm cho các danh mục có cặp "Đang hoạt động" / "Đã xoá"

Quan sát trên bản gốc (chỉ đọc, không gửi request thay đổi gì):

- API `GET /api/v1/care-service/list` của bản gốc **trả về cả bản ghi đã xoá**:
  hai dòng `"isDeleted": true` và một dòng `"isDeleted": false`.
- Đúng hai dòng `isDeleted: true` đó chỉ có **1 nút** ở cột Thao tác, dòng còn
  lại có **2 nút**. Tức là dòng đã xoá mất đúng nút "Xoá".
- Payload **không hề có `isActive`**. Nên "Đang hoạt động" và "Đã xoá" của bản
  gốc là **một trạng thái**, không phải hai cờ — đó là lý do một lúc chỉ tick
  được một cái.

Mở dialog "Thêm …" của cả 11 tab để biết tab nào có cặp checkbox:

| Có cặp (xoá mềm) | Không có |
|---|---|
| Dịch vụ, Chẩn đoán, Dữ liệu tư vấn, Nguồn đến, Lịch sử bệnh, Nghề nghiệp | Loại thuốc, Đơn thuốc mẫu, Bệnh án mẫu, Thẻ hồ sơ, Phương thức thanh toán |

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-87 | "Đã xoá" xoá thẳng, không lấy lại được | Tick "Đã xoá" rồi lưu là gọi `DELETE`, dòng biến mất khỏi danh sách. Bản gốc thì giữ dòng lại, chỉ bỏ nút xoá, và tick "Đang hoạt động" là quay về | Lần dựng đầu đọc cặp checkbox thành hai cờ rời, và hiểu "Đã xoá" là một lệnh xoá | Cặp checkbox điều khiển **một** giá trị `isDeleted`; lưu là đặt hoặc gỡ cờ chứ không xoá. Danh sách của 6 danh mục đó tắt filter `ISoftDelete` để dòng đã xoá vẫn hiện; bảng ẩn nút xoá khi `isDeleted`; tên dòng gạch ngang cho dễ nhận ra | F-31, F-32 |
| R-88 | `MapToDto` không mang cờ `isDeleted` sang DTO | Bảng luôn nhận `isDeleted: false`, nên nút xoá không bao giờ ẩn — lỗi này chỉ lộ ra khi chạy thật | DTO kế thừa `FullAuditedEntityDto` (đã có sẵn ô `IsDeleted`) nhưng hàm map viết tay không gán | Gán `IsDeleted` và `DeletionTime` trong `MapToDto` | F-32 |

Hai test mới đi hết vòng: tạo → tick "Đã xoá" → lưu → dòng **vẫn còn**, mất nút
xoá, reload vẫn thế → tick "Đang hoạt động" → lưu → nút xoá quay lại. Và một test
nữa cho nút thùng rác ngoài bảng: cũng là xoá mềm, dòng vẫn ở đó.

BE: 686/686 xanh. FE: 37/37 trên bản build production.

## 2026-08-25 — "Sử dụng" chốt bằng nút Lưu, và mô tả nhóm hiện đủ

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-89 | Chọn cách dùng là cập nhật ngay từng lần tick | Tick nửa chừng đã ghi vào dòng thuốc phía sau; không có bước xác nhận, cũng không bỏ ngang được | Popover gọi thẳng `onChange` mỗi lần đổi checkbox | Popover sửa trên một bản nháp, chỉ `onChange` khi bấm **Lưu**; mở lại thì nháp lấy từ giá trị đang lưu chứ không phải lần bỏ dở trước | F-34 |
| R-90 | Tick "Khác" nhưng không nhập được gì | Bản gốc mở ô nhập bắt buộc ngay khi tick "Khác" (`Vui lòng nhập*`, lỗi `Vui lòng nhập giá trị!`); bản mình chỉ có mỗi cái cờ, không chỗ nào ghi nội dung | Enum `PrescriptionUsage.Other` có sẵn nhưng dòng thuốc không có ô nào để chứa chữ | Thêm `OtherUsage` (200 ký tự) vào `bd_prescription_template_lines` + migration; entity bắt buộc có chữ khi cờ `Other` bật, và **bỏ chữ đi** khi cờ tắt để không còn giá trị mồ côi; nhãn trên nút hiện đúng chữ đã nhập thay cho "Khác" | F-34 (3 test domain + 1 test E2E đi hết vòng, có reload) |
| R-91 | Mô tả cột nhóm bị cắt bằng `…` | "Chọn nhóm để xem bệnh án mẫu bên trong" chỉ hiện được một phần | Lần sửa tràn trước đó chọn cách kẹp một dòng để hai header hai bên bằng nhau | Cho xuống dòng thoải mái; hai header dùng chung biến `--bd-catalog-header-height` (158px, đủ hai dòng) nên vẫn thẳng hàng. Đo lại 5 tab: `clipped: false`, `aligned: true`, không đè | F-31 |

BE: 689/689 (thêm 3 test domain cho quy tắc của "Khác"). FE: 38/38 trên bản build
production.

## 2026-08-25 — khối "Cấu hình giá & thuế" chồng dòng

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-92 | Hai hàng trong khối giá & thuế dính sát, nhãn đè lên hàng trên | Đo được: hàng 1 kết thúc ở **485px**, hàng 2 bắt đầu đúng **485px** — không có khe nào. Nhãn nổi nằm *trên* viền ô nên bị vẽ đè lên control của hàng trước, nhìn như chữ chồng chữ | Rule khoảng cách chỉ nhắm con **trực tiếp** của `Form` (`.app-dialog .ant-form > .ant-row`), mà hai hàng này nằm trong `.bd-dialog-section` nên không dính rule. Gutter dọc của `Row` chỉ có tác dụng giữa các item **bên trong** một Row, không phải giữa hai Row anh em | Hàng trong section tự mang `margin-bottom: 18px` (rộng hơn 12px thường dùng, vì nhãn nổi ăn lên trên viền ~8px); tiêu đề section cách hàng đầu 16px; `Segmented` nâng lên 42px cho bằng ô nhập bên cạnh | F-34 (đo lại: không còn nhãn nào đè hàng trên) |

Chốt màn hình: **Danh mục coi như hoàn thiện.** Đã ghi vào `CLAUDE.md` mục 17 và
đánh dấu trên F-31…F-34 để người sau không dựng lại.

## 2026-08-25 — Vận hành: chi nhánh, thứ tự, hành động, tìm kiếm, ảnh, layout

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-93 | Phân loại và bài viết Vận hành không theo chi nhánh | Mọi chi nhánh nhìn thấy chung một đống dữ liệu; đây là chỗ duy nhất trong hệ thống còn hở, mọi bảng nghiệp vụ khác đều đã lọc theo `ClinicBranchId` | Hai bảng dựng theo đúng bản gốc — bản gốc trả `branchId: null` nên coi như dùng chung cả phòng khám | Thêm `ClinicBranchId` vào cả hai entity, lọc bằng `BranchAccessChecker` như các màn khác, `CheckAsync` trước mỗi lần ghi/xoá. Migration `20260825110000` backfill dữ liệu cũ về chi nhánh chính — để `Guid.Empty` thì **không** chi nhánh nào thấy | F-35 |
| R-94 | Mục phân loại mới rơi xuống cuối danh sách | Tạo xong phải cuộn đi tìm; trang Danh mục thì đưa lên đầu | Chỉ sắp theo `SortOrder`, mà bản ghi mới nhận `SortOrder = 0` giống mọi bản ghi chưa kéo-thả bao giờ | `.OrderBy(SortOrder).ThenByDescending(CreationTime)` — kéo-thả vẫn thắng, còn trong cùng một mức thì mới nhất lên trước | F-35 (test tạo hai mục, khẳng định mục sau nằm trên) |
| R-95 | Hai lệnh của hàng phân loại nằm trong menu ba chấm | Sửa/xoá phải hai lần bấm | Bê nguyên `Dropdown` từ bản dựng đầu | Hai nút nằm thẳng trên hàng (`.bd-ops-rowactions`) | F-35 |
| R-96 | Chèn ảnh vào bài viết là lỗi "Lỗi hệ thống" | Không lưu được bài nào có ảnh | Quill nhúng ảnh thành base64 ngay trong HTML, mà cột `Content` giới hạn 10.000 ký tự → Postgres `22001: value too long`. Ảnh nằm trong hàng còn có nghĩa là mỗi lần đọc danh sách lại tải kèm cả ảnh | Ảnh đi ra blob storage (`bd_operation_article_images` + hai endpoint), nội dung chỉ giữ link **tương đối**; cột `Content` chuyển sang `text` vì rich-text không có trần hợp lý nào | F-35 |
| R-97 | Ảnh chỉ hiện sau khi tải xong | Chọn ảnh xong màn hình không đổi gì trong lúc chờ, đọc như hỏng — bên Dữ liệu tư vấn thì ảnh hiện ra ngay | Đổi sang lưu ngoài nghĩa là phải chờ một vòng mạng rồi mới chèn | Chèn ngay chính file đó dưới dạng data URL (đúng cách Quill vẫn làm), làm mờ, rồi thay `src` bằng link đã lưu khi tải xong; hỏng thì gỡ ảnh tạm đi. Thử `blob:` trước — **không dùng được**: blot ảnh của Quill chỉ nhận `http`/`https`/`data`, thứ khác bị viết lại thành `//:0` | F-35 (test khẳng định không còn `img[src^="data:"]` lúc lưu) |
| R-98 | Tìm kiếm bài viết phân biệt hoa thường và dính khoảng trắng | Dán tên bài từ chỗ khác vào là không ra | Lọc bằng `Contains` thẳng trên chuỗi người dùng gõ | Dùng `SearchTerms.From` như trang Danh mục: cắt khoảng trắng, hạ chữ thường, tách theo từ | F-35 |
| R-99 | Đổi tên mục phân loại trả về **405** | Dialog sửa mở ra, điền xong bấm Lưu thì đứng im | `UpdateCategoryAsync` có trong AppService và interface nhưng controller chưa có route `PUT categories/{id}` — ABP không tự sinh route cho controller viết tay | Thêm `[HttpPut("categories/{id}")]` | F-35 |

FE: 7/7 `operations.spec.ts` trên bản build production. tsc sạch.

## 2026-08-25 — Vận hành: rà soát lại toàn bộ tab theo bản gốc

Quan sát lại `staging.nfcdental.com/operations` ở 1600×1000, chỉ đọc: đi hết 8
khối, mọi sub-tab, và mở cả hai dialog (không gõ, không lưu). Bản dựng trước đó
đoán sai cấu trúc ở nhiều chỗ.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-93 | Sub-tab dựng sai cho 2 khối | Khối bảo vệ thừa "Báo cáo"; Khối tài chính hiện 4 tab chung trong khi bản gốc có 6 tab riêng (Khách hàng phát sinh, Hóa đơn, Hoàn thành theo dịch vụ) | Lần dựng trước suy ra "mọi khối đều có 3 tab chung + Báo cáo" từ **một** khối quan sát được, không đi hết 8 khối | Bảng tab lấy đúng từng khối; `operationsTabs.ts` giữ cả `kind` của từng sub-tab | F-35 (test so khớp đúng danh sách của 3 khối) |
| R-94 | Chỉ có **một** tham số `?subTab=` | Rời khối rồi quay lại là mất sub-tab đang xem; link chia sẻ không giống bản gốc | Bản gốc cho **mỗi khối một tham số riêng** (`overviewSubTab`, `financeSubTab`…) và để chúng cộng dồn trong URL | Tham số đặt theo khối, link khối mang theo toàn bộ tham số cũ (trừ `category`, vì nó là id của riêng một sub-screen) | F-35 (test đi 2 khối rồi quay lại) |
| R-95 | Thiếu hẳn hàng tab giữa | Khối điều trị và Khối tài chính có thêm hàng "Tổng quan / Truy cập" (`treatmentTab`/`financeTab`) — bản mình không có | Không quan sát tới hai khối này | Dựng hàng tab giữa, kiểu gạch chân như hàng khối, chỉ ở hai khối đó | F-35 |
| R-96 | 6 sub-tab báo cáo bị dựng thành màn "phân loại + bài viết" | Báo cáo, Chẩn đoán chưa điều trị, Đơn thuốc, Khách hàng phát sinh, Hóa đơn, Hoàn thành theo dịch vụ **không phải** màn bài viết — mỗi cái là một báo cáo với bộ cột riêng, không có panel phân loại. Dựng như cũ là **bịa hành vi**: người dùng tạo bài viết trong tab Hóa đơn | Lần trước ghi `UNKNOWN` rồi vẫn dựng cả 6 tab bằng một khung | Chỉ Trang chủ/Quy trình/Công việc là màn bài viết; còn lại render `OperationReportPanel` nói thẳng là chưa dựng. Cột của từng báo cáo đã ghi vào `docs/clone/pages/operations.md` | F-35 (test khẳng định tab báo cáo **không** có "Tạo Bài Viết" / "Thêm Mới") |
| R-97 | Panel phân loại dùng lại nguyên khối của Danh mục | Bản gốc panel này **không có** tiêu đề, số đếm, dòng mô tả, ô tìm kiếm hay tay kéo — chỉ một nút "Thêm Mới" dính trên đỉnh và danh sách thư mục; hành động chỉ hiện khi rê chuột | Suy diễn "hai màn giống nhau nên dùng chung" thay vì đo | Tách `bd-ops-panel` riêng: nút sticky, hàng có icon thư mục, tên `line-clamp: 2`, hai nút ẩn ở `opacity: 0` cho tới khi hover/chọn/focus | F-35 |
| R-98 | Dialog sai chữ và sai trường | Nhóm: bản gốc là "Tạo"/"Sửa" với **hai** trường `Tên phân loại*` + `Mức độ ưu tiên`; bản mình là "Thêm mục mới" một trường `Tên mục`. Bài viết: bản gốc "Tiêu đề bài viết"/"Sửa bài viết", rộng 772, có nhãn `Nội dung bài viết`, editor cao 320px, placeholder `Nhập nội dung tư vấn...` | Chưa mở dialog của bản gốc lần nào | Sửa đúng cả hai theo số đo đọc từ DOM | F-35 |

Phụ: chân bảng bài viết của bản gốc **không có** đơn vị đếm — `Hiển thị 1–11
trên 11`, và `Hiển thị 0 trên 0` khi rỗng (không phải `0–0`). Tách thành
`operationsTotal` thay vì dùng `countedTotal("bài viết")`.

FE: **10/10** `operations.spec.ts` + **17/17** hai bộ `taxonomy` trên bản build
production. Toàn bộ suite 102/110 — 7 lỗi còn lại (cskh, labo ×2, patient,
sidebar-navigation ×2, staff) đã **đo là có sẵn trên nhánh**: stash hết thay đổi
rồi chạy lại vẫn đỏ đúng 7 test đó.

## 2026-08-26 — Vận hành: dựng nốt 7 màn báo cáo

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-99 | Seeder chết vì trùng khoá chính, im lặng | Toàn bộ chuỗi lâm sàng (chẩn đoán → tư vấn → kế hoạch → dịch vụ → công đoạn → đơn thuốc) **rỗng** trên máy dev, nên mọi màn báo cáo đều trắng và không dựng được. Đo được: `bd_catalog_entries` có 63 dòng đã xoá mềm | Seeder hỏi "id này có chưa?" bằng `AnyAsync`, mà bộ lọc xoá mềm giấu mất dòng đã xoá — dòng vẫn giữ khoá chính. Chính e2e của mình xoá mềm các dòng seed, nên sau lần chạy test đầu tiên là seeder hỏng vĩnh viễn | Hỏi lại với `IDataFilter<ISoftDelete>.Disable()` trong cả hai seeder | Chạy lại DbMigrator: chuỗi lâm sàng lên đủ |
| R-100 | Không có dữ liệu để lọc theo kỳ | Mọi dòng seed đều đóng dấu **đúng lúc chạy seeder**, nên Ngày/Tuần/Tháng cho ra cùng một danh sách và "% so với kỳ trước" không có gì để so | ABP đóng dấu `CreationTime` khi insert | `BlueDentalReportsDemoSeeder`: 120 ca rải trên 75 ngày. Đặt dấu thời gian **trước** khi insert — ABP chỉ ghi khi giá trị còn `default` nên nó giữ nguyên. Ghi sau không được: các entity này sở hữu răng dạng JSON, update làm EF báo sửa khoá ngoài định danh | 90 dịch vụ / 3 tháng, 38 chẩn đoán chưa điều trị |
| R-101 | Một `ToothSelection` dùng chung cho 4 chủ sở hữu | Seeder chết: EF theo dõi giá trị sở hữu **theo tham chiếu**, một đối tượng đưa cho chẩn đoán + tư vấn + dòng dịch vụ + công đoạn thành 4 dòng tranh nhau | Tiết kiệm một dòng khởi tạo | Mỗi chủ sở hữu một thực thể riêng | Seeder chạy sạch |
| R-102 | `ResolveFilterAsync(null)` trả về rỗng bị hiểu là "không chi nhánh nào" | Mọi báo cáo trả 0 dòng cho tài khoản không gán chi nhánh — tức là admin | Danh sách rỗng ở `BranchAccessChecker` nghĩa là **không bị giới hạn**, nhưng `branchIds.Contains(...)` đọc thành "không có gì" | Một hàm `InScope` duy nhất, theo đúng quy ước phần còn lại của ứng dụng đang dùng (`Count > 0` mới lọc) | 6/6 endpoint trả dữ liệu thật |
| R-103 | Controller mới thiếu `[RemoteService]` / `[Authorize]` | 2 test quy ước controller đỏ | Viết mới không theo mẫu sẵn có | Thêm cả hai | `ControllerConventionTests` 15/15 |

Bảy màn dựng xong: Báo cáo, Chẩn đoán chưa điều trị, Khách hàng phát sinh, Hóa
đơn, Hoàn thành theo dịch vụ, Truy cập (dùng chung cho hai khối) — và Đơn thuốc
giữ nguyên câu của bản gốc, *"Nội dung đang được xây dựng."*, vì bản gốc cũng
chưa dựng.

BE: **694/696** (2 lỗi `BlueDentalAbilitiesTests` đã đo là có sẵn — stash hết
thay đổi vẫn đỏ y hệt). FE: **35/35** trên bản build production
(`operations` 10, `operations-reports` 8, `taxonomy` 17).

## 2026-08-26 — Vận hành: xoá nhóm, bộ lọc thời gian, và dựng lại Báo cáo

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-104 | Xoá nhóm nhưng bài viết ở lại | Bài viết chỉ tới được qua nhóm của nó, nên xoá nhóm là bỏ lại những dòng **không thể liệt kê, sửa hay xoá** — mà màn hình vẫn đếm chúng | `DeleteCategoryAsync` chỉ xoá đúng một dòng | Xoá nhóm kéo theo bài viết của nó | F-35 (test tạo nhóm + bài viết, xoá nhóm, reload — bài viết không còn) |
| R-105 | Chữ trên nút kỳ đang chọn tối lại khi rê chuột | Nút đang chọn là chữ trắng trên nền xanh; rule hover sơn đè bằng màu chữ lúc nghỉ nên gần như không đọc được | Rule hover không loại trừ trạng thái active | Chỉ các nút **chưa** chọn mới đổi màu khi hover | F-36 (test đo `getComputedStyle().color` trước và trong khi hover) |
| R-106 | Bấm vào ngày không xổ lịch | Ngày chỉ là chữ chết giữa hai mũi tên, nên chỉ đi được từng kỳ một — muốn về tháng 1 phải bấm 7 lần | Dựng bằng `<span>` | Thay bằng `DatePicker` mở đúng cấp của kỳ đang xem: Ngày→ngày, Tuần→tuần, Tháng→tháng, Năm→năm | F-36 (test mở cả ba cấp) |
| R-107 | Báo cáo dựng phẳng, không giống bản gốc | Bản gốc gom theo **lượt khám** rồi theo **hành động**: ô ngày/khách hàng trải hết khối và có 3 bước Đã đến/Đang khám/Hoàn tất, ô hành động trải hết nhóm và ghi `Chẩn đoán (4)`. Thiếu 2 bộ lọc (`Người tạo`, `Tìm kiếm khách hàng`), thiếu thẻ `Doanh số chốt kế hoạch`, và `Hành động` phải chọn sẵn tất cả | Lần dựng trước chỉ đọc được cột, chưa quan sát được bản gốc lúc có dữ liệu | Dựng lại theo đúng khối: server trả `visitKey` + mốc thời gian của lượt khám, FE tính rowspan **trên trang đang hiện** vì bản gốc phân trang theo dòng chứ không theo khối | F-36 (test rowspan > 1, 3 bước, `Nhãn (n)`) |
| R-108 | Ba tab báo cáo thiếu bộ lọc | `Chẩn đoán chưa điều trị` thiếu `Người tạo`; `Hóa đơn` thiếu `Tất cả trạng thái`; `Khách hàng phát sinh` thiếu `Nhân sự tư vấn` và tiêu đề | Chưa quan sát tới phần trên bảng của từng tab | Thêm cả ba, kèm `StaffFilter` dùng chung đặt ở `src/hooks` + `reports/` (không import chéo feature) | F-36 |

Còn thiếu: bản gốc có thêm khối **"Tổng quan tài chính"** (4 panel kèm biểu đồ)
dưới bảng của Khách hàng phát sinh — đã ghi vào `docs/clone/pages/operations.md`,
chưa dựng.

BE: **694/696** (2 lỗi `BlueDentalAbilitiesTests` có sẵn). FE: **40/40** trên
bản build production.

## 2026-08-26 — Vận hành: rà 12 trang bản gốc, Báo cáo khác nhau theo từng khối

Đi hết 12 URL người dùng đưa. Phát hiện chính: **Báo cáo không phải một màn dùng
chung** — mỗi khối một kiểu.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-109 | Báo cáo dựng một kiểu cho mọi khối | Khối lễ tân bị thêm 2 bộ lọc bản gốc không có và pager thừa chữ "công việc"; Khối điều trị bị thêm cả 3 bộ lọc và đặt thẻ sai chỗ | Lần trước chỉ quan sát Quản trị vận hành rồi suy ra phần còn lại | `workLogVariants.ts`: mỗi khối khai báo bộ lọc nào, thẻ đặt đâu, pager có đếm bằng chữ không | F-36 (test đi cả 4 khối, khẳng định đúng bộ lọc / vị trí thẻ / pager) |
| R-110 | Không có dòng thứ hai dưới tên mục | Bản gốc ghi giờ dưới tên (`09:00 17/05`, `Thời lượng: 15 phút`), bản mình chỉ một dòng | Chưa quan sát tới | Thêm `SubjectDetail`, đổ giờ cho lượt tiếp nhận và thanh toán | F-36 |

**Đo sai một lần và đã sửa cách đo:** lần đầu quét reception/marketing tôi đọc
DOM ngay sau `goto`, trang chưa render xong nên trả về rỗng và tôi suýt kết luận
"reception chỉ có 1 filter" vì lý do sai. Đã đổi sang chờ bảng xuất hiện rồi mới
đọc, và xác nhận lại bằng ảnh chụp — reception đúng là 1 filter, nhưng vì bản gốc
làm vậy chứ không phải vì trang chưa tải.

Chưa dựng, đã ghi lại đầy đủ: **Báo cáo của Khối Marketing** (hàng tab thứ 4 +
biểu đồ phân bổ) và **Tổng quan tài chính** dưới Khách hàng phát sinh (4 panel
kèm biểu đồ). Cả hai đều không có dữ liệu trên bản gốc để quan sát biểu đồ.

BE: **694/696**. FE: **41/41** trên bản build production.

## 2026-08-26 — Vận hành: chỗ đặt bộ lọc kỳ, căn ô, và bảng không cuộn được

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-111 | Cụm Ngày/Tuần/Tháng/Năm nằm ở hàng riêng | Bản gốc đặt nó ở **cuối hàng tab** — hàng giữa nếu khối có, không thì hàng tab con. Bản mình đẩy xuống một dải riêng, tốn một hàng và lệch bản gốc | Bộ lọc kỳ là state của màn báo cáo, còn hàng tab thuộc về trang — nên lần đầu tôi dựng nó ở nơi có state | Trang chừa một chỗ trống (`PERIOD_SLOT_ID`) ở cuối hàng tab, màn báo cáo `createPortal` vào đó. State ở đâu vẫn ở đó, DOM nằm đúng chỗ bản gốc | F-36 (test khối không có hàng giữa → ở hàng tab con; khối có → ở hàng giữa, và **không** ở hàng tab con) |
| R-112 | Ô Ngày/Khách hàng căn trên | Ô này trải cả khối lượt khám (có khi 14 dòng); căn trên làm nội dung trôi lên đỉnh, bản gốc căn giữa | Tôi đặt `vertical-align: top` khi dựng rowspan | Trả về `middle` cho cả ô lượt khám lẫn ô nhóm hành động | F-36 (đo `getComputedStyle().verticalAlign`) |
| R-113 | **Bảng không cuộn được để xem phần dưới** | Đo được: `.bd-cat-card` cao 626px, `overflow: hidden`, trong khi nội dung cần 1005px — dòng cuối nằm ở 1346px trong khung 1000px, **không cách nào tới được**. Phân trang cũng bị cắt | `.bd-cat-card` được dựng cho Danh mục: lấp đầy khung rồi cắt. Trong báo cáo, thứ duy nhất cuộn được lại nằm chôn bên trong nó | Trong màn báo cáo, card cao theo nội dung (`flex: none; overflow: visible`) và **cả màn** cuộn — bộ lọc, thẻ số, bảng cuộn cùng nhau. Bảng rộng vẫn cuộn ngang trong card | F-36 (test cuộn tới đáy rồi khẳng định dòng cuối và pager **nằm trong khung nhìn**) |

Đo lại sau khi sửa: dọc `scrollHeight 1200 > clientHeight 757`, cuộn tới đáy thì
dòng cuối ở 903px và pager ở 968px — trong khung 1000px. Ngang: màn Truy cập
`scrollWidth 3600 > clientWidth 1280`, vẫn cuộn ngang bình thường.

FE: **44/44** trên bản build production.

## 2026-08-26 — Ảnh trong rich text: một kho dùng chung cho mọi trình soạn

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-114 | Vận hành: ảnh hiện rõ → mất → hiện lại | Đổi placeholder sang URL mà trình duyệt **chưa từng tải**, nên thẻ `<img>` trống cho tới khi ảnh về | Đổi ngay khi upload trả về | Tải ảnh trước rồi mới đổi, nên lúc đổi là đổi sang thứ đã có trong cache | `rich-image.spec.ts` theo dõi editor bằng `requestAnimationFrame`, **đỏ nếu ảnh rời khỏi DOM dù một frame** |
| R-115 | Danh mục: ảnh mờ vĩnh viễn | Lớp mờ nghĩa "đang gửi lên", gắn theo điều kiện `src` là data URL — đúng với ảnh đang bay, nhưng editor đó nhúng ảnh và **giữ luôn**, nên mờ mãi | Selector theo `src` thay vì theo trạng thái | Chỉ editor **có upload** mới làm mờ placeholder | `rich-image.spec.ts` |
| R-116 | Hai trình soạn giống hệt nhau nhưng **lưu ảnh khác nhau** | Vận hành đẩy bytes ra blob, Danh mục nhúng base64 vào cột `Content`. Cột là `text` nên không sập như lỗi 22001 trước đó, nhưng **mỗi lần đọc danh sách danh mục vẫn kéo theo toàn bộ bytes ảnh** | Kho ảnh được dựng riêng cho Vận hành | Gom thành một: `RichTextImage` trong `FileManagement`, bảng `bd_rich_text_images`, endpoint `/api/v1/app/rich-text-images`, hook `useUploadRichTextImage` dùng chung. Migration chỉ **đổi tên bảng** nên mọi id giữ nguyên, và route cũ vẫn trả ảnh vì link cũ đã nằm sẵn trong nội dung bài viết | `rich-image.spec.ts` khẳng định **cả hai** chốt ở link đã lưu và **không còn** `img[src^="data:"]` |
| R-117 | **Phòng ban và Phân bổ vật tư trả 404** | `DepartmentAppService` và `MaterialAllocationAppService` đã viết xong từ lâu nhưng **không có controller nào trỏ tới**. Trình duyệt gọi `/api/v1/app/departments` và `/api/v1/app/material-allocations` đều 404, hai tab hiện rỗng mà không báo lỗi gì | Dự án khai báo route bằng controller tường minh, không dùng auto-API của ABP; hai service này bị bỏ sót | Thêm `DepartmentController` và `MaterialAllocationController` | `materials.spec.ts` (`assertRealApiTraffic` trên đúng hai endpoint đó) |
| R-118 | **Cột Trạng thái sai trên mọi dòng vật tư** | `Status` không phải cột lưu trong DB — thực thể tính ra bằng `StatusAsOf(today)`. AutoMapper không thấy thuộc tính nào tên `Status` nên để nguyên **số 0**, mà `SupplyStatus` bắt đầu từ 1 → mọi dòng mang một giá trị không có tên. `TaxonomyName` cũng không bao giờ được điền, nên cột "Nhóm phân loại" luôn là "—" | Map thẳng thực thể sang DTO, không ai kiểm lại hai trường không nằm trên thực thể | `ToDtosAsync` đóng dấu `Status` bằng `StatusAsOf` và tra tên nhóm theo lô sau khi map | `materials.spec.ts` khẳng định dòng vừa tạo mang **đúng tên nhóm** đã chọn |
| R-119 | Thiếu cột chọn, nút "Thêm vật tư" bị khoá, thiếu nhóm "Hệ thống" | Đối chiếu ảnh bản gốc: bảng bản gốc mở đầu bằng ô tick; nút "Thêm vật tư" **luôn bật** (nhóm chọn trong dialog); panel có sẵn một nhóm hệ thống nền hổ phách kèm ⓘ thay cho menu ⋯ | Dựng theo trí nhớ khảo sát thay vì soi lại ảnh | Thêm `rowSelection`, bỏ `disabled`, seed `Taxonomy(IsSystem: true)` tên "Hệ thống" cho mỗi chi nhánh, `GroupPanel` vẽ dòng hệ thống theo kiểu đó | `materials.spec.ts` + chạy lại **31 test Danh mục** vì `GroupPanel` dùng chung |
| R-120 | **Thêm vật tư báo lỗi `BlueDental:Inventory:0004`** | Ô "Số lượng" để trống là hợp lệ trên bản gốc, nhưng về tới `CreateAsync` nó thành 0 và bị đẩy thẳng vào `ReceiveStock` → `AddStock` từ chối nhập 0 → **hỏng cả lần lưu** vì một ô người dùng cố ý bỏ trống | Nhập kho lúc tạo được viết như thể lần nào cũng có hàng về | Tách phần ngày của `ReceiveStock` ra `SetShelfLife`; lúc tạo chỉ cộng kho khi thực sự có số lượng, còn ngày thì luôn ghi. Endpoint nhập kho riêng vẫn giữ nguyên ràng buộc | `materials.spec.ts` ("saves a material with no quantity") |
| R-121 | Tìm vật tư phân biệt hoa thường, và chết khi có dấu cách | `Contains()` trên PostgreSQL chạy **phân biệt hoa thường**, nên gõ "gang tay" không ra "Găng Tay". Cụm có dấu cách lại càng không ra, vì cả cụm phải khớp nguyên văn | Viết bộ lọc riêng thay vì dùng helper đã có | Dùng `SearchTerms` — đúng helper mà tìm kiếm bên Danh mục đã dùng: trim, hạ chữ thường, tách từ, mỗi từ phải xuất hiện đâu đó trong tên hoặc mã | `materials.spec.ts` (tìm bằng chuỗi có đệm khoảng trắng, chữ thường, **sai thứ tự từ**) |
| R-122 | Xoá nhóm vật tư / phòng ban **không hỏi lại** | Từ menu ⋯ bấm "Xoá" là xoá luôn, trong khi xoá một nhóm là kéo theo cả vật tư trong nhóm. Mọi chỗ xoá khác trên các màn này đều hỏi qua `ConfirmDeleteDialog` | Dựng panel dùng chung nhưng nối thẳng `onDelete` vào mutation | Cả hai tab hỏi lại, nêu đúng tên bản ghi, nút xác nhận đỏ; xoá đúng mục đang chọn thì bỏ chọn luôn | `materials.spec.ts` (huỷ thì còn, xác nhận thì mất và mất cả sau khi tải lại — cho cả nhóm vật tư lẫn phòng ban) |
| R-123 | **Phòng ban và phiếu phân bổ không lọc theo chi nhánh** | `DepartmentAppService.GetListAsync` và `MaterialAllocationAppService.GetListAsync` đọc toàn bộ bảng: chi nhánh nào cũng thấy phòng ban và phiếu của chi nhánh khác. `CreateAsync` của phòng ban lại không gán `BranchId` nào cả | Hai service này viết trước khi có `ICurrentClinicBranchResolver`, và không có test nào chạm tới chúng | Cả hai lọc theo chi nhánh hiện tại; sửa/xoá một bản ghi của chi nhánh khác trả `EntityNotFound` thay vì cho qua | `materials.spec.ts`; `branch-isolation.spec.ts` giữ nguyên |
| R-124 | **Phiếu phân bổ bị đóng dấu bằng id người dùng thay cho id chi nhánh** | `new MaterialAllocation(..., CurrentUser.Id ?? Guid.Empty, ...)` — tham số thứ 5 của constructor là `branchId`. Mọi phiếu tạo qua API mang id người lập ở cột chi nhánh, nên không thuộc chi nhánh nào | Hai `Guid` cạnh nhau trong danh sách tham số, không có tên gọi ở chỗ gọi | Truyền `_branchResolver.GetRequiredClinicBranchId()` | `materials.spec.ts` (danh sách lọc theo chi nhánh nên phiếu sai chi nhánh sẽ biến mất) |
| R-125 | "Số thứ tự" của phòng ban bị ghi vào cột mô tả | Bản gốc gọi `/departments/list?orderBy=order` và trả `availableOrderBy: ["name","order",...]` — phòng ban **có** thứ tự riêng. Bản mình không có cột đó nên nhét con số vào `Description`: không sắp xếp được, và sẽ lòi ra ở bất cứ chỗ nào hiện mô tả | Dựng dialog trước khi soi kỹ API bản gốc | Thêm cột `SortOrder` (migration `20260827090000`), danh sách sắp theo `SortOrder` rồi tới tên, và panel kéo-thả được như panel nhóm vật tư | `materials.spec.ts` ("keeps a department's position as a position") |
| R-126 | Seeder chết vì trùng khoá chính sau khi xoá mềm | `BlueDentalOperationsDemoSeeder` kiểm tra bằng `AnyAsync` thuần — không thấy dòng đã xoá mềm nên báo "chưa seed" rồi insert lại đúng khoá cũ. Xoá "Kho vật tư" trên giao diện là lần seed sau hỏng hẳn | Đúng cái bẫy đã sửa ở các seeder khác, còn sót lại ở đây (9 chỗ) | Gom về `AnySeededAsync` có tắt bộ lọc xoá mềm | Chạy lại `DbMigrator` trên DB đang có dòng bị xoá mềm |
| R-127 | **Bảng Phân bổ vật tư không giới hạn chiều cao** | Tab này không có panel nên không đi qua `.bd-taxonomy-shell` (chỗ duy nhất đặt `height: 100%`). `.bd-materials-plain` vì thế cao theo nội dung: đo được **1406px nằm trong khung 726px**, mà trang thì `overflow: hidden` → phần dưới bị nuốt, không thanh cuộn, không cách nào tới. Đúng loại lỗi R-113 | Chép layout từ tab có panel nhưng bỏ mất chỗ nhận chiều cao | `.bd-materials-plain` tự nhận `height: 100%` | `materials.spec.ts` ("scrolls inside its table") — đo `plain <= parent`, cuộn tới đáy rồi khẳng định **dòng cuối và pager nằm trong khung nhìn** |
| R-128 | "Gộp số lượng vật tư" gộp sai kiểu | Tôi đoán nó gộp các dòng chi tiết lại và cộng số lượng, giữ nguyên bộ cột. Đọc thẳng bundle của bản gốc thì nó **đổi hẳn bộ cột**: Vật tư / Tổng SL phân bổ / Tổng còn lại (đã duyệt) / Số lần phân bổ / Lần phân bổ gần nhất | Không quan sát được vì bản gốc không có dữ liệu, và không dám bấm một nút tên "Gộp" trên production | Đọc `_next/static/chunks/*.js` — tài nguyên tĩnh, chỉ GET, không tương tác. Dựng lại đúng bộ cột đó, đúng màu (xanh mòng két `#107569` / hổ phách `#B45309`), tooltip đổi thành "Xem chi tiết phân bổ" khi bật | `materials.spec.ts` ("swaps the table for a per-material summary" — khẳng định **đúng 5 tiêu đề cột**, tổng không đổi khi đổi khung nhìn, tắt đi thì dòng chi tiết quay lại) |
| R-129 | **Ba tab Vật tư không nối với nhau** | Bản gốc: một phiếu phân bổ mang **nhiều** vật tư, xuất đi là **trừ tồn kho**, và cùng dữ liệu đó hiện ở cả ba tab. Bản mình: mỗi phiếu đúng một vật tư, tạo phiếu không đụng gì tới tồn kho, và không có đường nào từ màn vật tư sang phân bổ — ba cái bảng rời nhau | Dựng ba tab theo thứ tự bản gốc vẽ, nhưng chưa bóc được luồng nối chúng vì bản gốc không có dữ liệu | Thêm `MaterialAllocationItem` (migration `20260827100000`, chuyển dữ liệu cũ sang thành phiếu một dòng). Tick vật tư → thanh nổi chọn phòng ban → dialog nhập số lượng từng thứ, chặn ở mức tồn kho → tạo phiếu, **trừ kho**; xoá phiếu thì **hoàn kho**. Mã phiếu theo đúng bản gốc: `PB` + ngày + số đếm reset mỗi ngày | `materials.spec.ts` ("issues a material to a department, and it lands on all three tabs" — đi hết một vòng: tạo vật tư 40, xuất 15, kho còn 25, phiếu hiện ở tab phân bổ dạng `tên: 15`, và ở tab phòng ban kèm "Chưa kiểm", còn sau khi tải lại) |
| R-130 | **Mã phiếu phân bổ đụng nhau, tạo phiếu là hỏng** | `NextCodeAsync` lấy số kế tiếp bằng cách **đếm** số phiếu trong ngày. Đếm chỉ đúng khi dãy số liền mạch từ 1 — mà phiếu seed mang dãy số riêng, phiếu bị xoá để lại lỗ hổng, nên số trả về là số đã có → `23505` trên `IX_bd_material_allocations_AllocationCode` | Viết mới, chưa nghĩ tới trường hợp dãy số không liền | Lấy theo **số lớn nhất đã dùng**, và đọc kèm cả dòng đã xoá mềm (khoá unique vẫn tính chúng) | `materials.spec.ts` ("issues a material...") — chạy trên DB đã có sẵn phiếu seed nên trúng đúng ca này |
| R-131 | Tooltip nút gộp khi đang bật ghi sai | Bản gốc: `i ? "Xem chi tiết phân bổ" : "Gộp số lượng vật tư"`. Tôi để "Bỏ gộp số lượng vật tư" — và ở lượt trước còn nói là "đã khớp" mà không kiểm lại | Đọc được đúng chuỗi trong bundle nhưng không đối chiếu với code đã viết | Trả về đúng chuỗi bản gốc | — (chuỗi tĩnh) |
| R-132 | **Ba ô tìm kiếm chỉ lọc trên trình duyệt** | "Tìm phiếu phân bổ...", "Tìm phòng ban..." và "Tìm vật tư..." (tab Phòng ban) đều gọi API **không kèm** `Filter` rồi lọc mảng đã tải. Hệ quả: chỉ tìm được trong những gì tình cờ nằm ở trang đầu — thứ nằm ngoài thì gõ đúng tên cũng không ra. Ô chọn phòng ban trên thanh phân bổ cũng vậy: tải 200 dòng rồi lọc bằng `optionFilterProp` | Dựng nhanh khi endpoint chưa có tham số tìm kiếm; sau đó backend đã có `Filter` nhưng FE không được nối lại | Cả bốn gửi `Filter` lên server (đã có `SearchTerms`: trim, hạ chữ thường, tách từ). Ô chọn phòng ban đặt `filterOption={false}` — server đã lọc thì trình duyệt không được lọc chồng lên | `materials.spec.ts` ("every search asks the server, not the browser" — bắt **request thật** mang đúng từ khoá cho cả 5 ô tìm kiếm của màn Vật tư) |
| R-133 | Panel phòng ban báo sai danh từ | Tìm không ra thì hiện "Không tìm thấy **nhóm** phù hợp" trong khi đang tìm phòng ban | `GroupPanel` dùng chung, chuỗi này bị hard-code | Thêm `notFoundText`, mặc định giữ nguyên chuỗi cũ nên Danh mục không đổi | `materials.spec.ts` |

**Đính chính một điều tôi từng nói sai:** trong các commit trước tôi ghi hai test
`BlueDentalAbilitiesTests` là "lỗi có sẵn trên nhánh". Đo lại lần này: chúng
**xanh** trên cả cây hiện tại lẫn cây đã stash sạch thay đổi. Nhiều khả năng lần
đo trước tôi chạy trên bản build cũ. BE hiện **696/696**, không còn lỗi nào đã
biết.

FE: **43/43** (rich-image, operations, taxonomy ×3) trên bản build production.

Vật tư (2026-08-26): **35/35** trên bản build production — 4 test `materials.spec.ts`
cộng **31 test Danh mục** chạy lại vì `GroupPanel` nay dùng chung cho cả hai màn.

Sau khi sửa R-120…R-133: `materials.spec.ts` lên **11/11**, và **21/21** cho Danh mục
(`taxonomy` + `taxonomy-groups`) vì `GroupPanel` dùng chung, và chạy kèm
`operations.spec.ts` + `taxonomy-groups.spec.ts` (**29/30**) vì phần phòng ban
và bộ lọc chi nhánh dùng chung.

Một test đỏ, **không phải do đợt sửa này**: `branch-isolation.spec.ts:54` bắt
`admin` phải bị từ chối chi nhánh 2 (403), nhưng seeder **cố ý** không gán
`StaffBranchAssignment` cho `admin` — có ghi rõ lý do trong
`BlueDentalDataSeedContributor.AssignAdminToDefaultBranchAsync`: gán vào là bộ
chuyển chi nhánh trên header chỉ còn một chi nhánh. Tiền đề của test mâu thuẫn
với seeder; để nguyên, vì quyết định `admin` có bị giới hạn chi nhánh hay không
là chuyện sản phẩm, không phải chuyện của màn Vật tư. BE `Domain.Tests`
**195/196** — test đỏ duy nhất là `BlueDentalAbilitiesTests` đã đỏ sẵn từ `main`
(commit `4cb0e1f` thêm subject `chatbotKnowledge` mà không nâng con số 84).
Không đụng tới nó: test đó tồn tại để khoá danh sách quyền theo đúng những gì
quan sát được trên bản gốc, mà `chatbotKnowledge` thì không có trong
`docs/clone/permissions.md`.

Còn một test chập chờn, cũng không phải do đợt này: `operations.spec.ts` —
"an image in an article is stored beside it, not inside it" đỏ khi chạy chung cả
ba bộ, xanh khi chạy riêng. Nhiều khả năng là thời gian upload lên MinIO; đợt sửa
này không đụng tới rich text.

## 2026-08-26 — Chạy toàn bộ suite: dữ liệu demo mòn dần, và 10 spec lạc hậu

Chạy đủ 29 suite lần đầu: 136 pass / 14 fail. Điều tra từng lỗi thay vì sửa mù:

**Nhóm 1 — dữ liệu demo bị bào mòn (7 lỗi operations-reports + patient +
rich-image + cskh):** database dev đã sống qua hàng trăm lượt e2e; các test
xoá mềm/sửa dần dữ liệu seed nên nhiều màn không còn gì để hiện. Dựng lại
sạch: `DROP DATABASE` → `CREATE` → DbMigrator. Sau khi dựng lại, cả nhóm xanh
mà **không sửa một dòng code nào** — đúng là data, không phải regression.

**Bẫy đo được khi dựng lại:** `BlueDentalBranchSeedContributor` và
`BlueDentalDemoSeedContributor` kiểm tra `ASPNETCORE_ENVIRONMENT == "Development"`
— chạy DbMigrator **không đặt biến này** thì chi nhánh 2 và tài khoản
branch2/manager bị bỏ qua **im lặng**, và 8 test cụm chi nhánh chết ở màn login.
Phải chạy: `$env:ASPNETCORE_ENVIRONMENT = "Development"; dotnet run --project
src/BlueDental.DbMigrator`. Seeder idempotent nên chạy lại an toàn.

**Nhóm 2 — spec lạc hậu so với thay đổi đã commit có chủ đích (9 lỗi, sửa spec
chứ không sửa app):**

| # | Spec | Vì sao đỏ | Sửa |
|---|------|-----------|-----|
| R-134 | `branch-isolation` :54 | Commit `4cb0e1f` chủ đích cho admin **toàn phòng khám** (seeder xoá hết assignment; tập rỗng = không giới hạn) — test còn chờ 403 khi admin hỏi chi nhánh 2 | Viết lại thành guard cho hành vi mới: admin phải nhận **200**; đường 403 vẫn được canh bởi các test dùng `branch2` |
| R-135 | `branch-switcher` ×3 | Commit `bdb9e3f` đổi tên chi nhánh seed thành "Nha Khoa Đức Hạnh Premium" (± " - Chi nhánh 2"). Tên chi nhánh 1 là **tiền tố** của tên chi nhánh 2, nên mọi `getByText` phải `exact: true` kẻo trúng cả hai. Test "menu bị giới hạn" phải chuyển sang đăng nhập `branch2` vì admin giờ thấy cả hai | Hằng tên + `exact: true` toàn spec; test đầu đổi tài khoản |
| R-136 | `labo` ×2 | Pill lọc render `role="tab"` trong `role="tablist"`, không phải button | `getByRole("tab")` |
| R-137 | `sidebar-navigation` ×2 | Sidebar giờ mở rộng mặc định — biến thể mở rộng chỉ có `title`, không có `aria-label`; nhãn cũng đổi ("Danh sách bệnh nhân"→"Bệnh nhân", "Nhân viên"→"Nhân sự") | Selector theo `[title=…]`, nhãn mới |
| R-138 | `staff` | Dialog dựng lại bằng `FloatingField`: không còn placeholder, thêm 2 select bắt buộc (Nhóm quyền, Chi nhánh); xoá đi qua `ConfirmDeleteDialog` | Viết lại spec: `getByLabel` theo `<label htmlFor>`; chọn option theo `[title=…]` vì dropdown đã đóng có thể còn nằm trong DOM không mang class `-hidden`; nút xoá có accessible name **"delete Xoá"** (alt của icon dính vào) nên khớp bằng `/Xoá$/` |
| R-139 | `patient` :41 | Trang hồ sơ giờ lặp tên bệnh nhân 3 chỗ (breadcrumb `[MRN] – TÊN`, header, bảng lượt khám) → `getByText(tên)` vi phạm strict mode | Khẳng định vào `.pt-head-name` — chỗ duy nhất |

Kết quả cuối, trên bản build production (`vite preview` 8080), backend thật cổng
5000, PostgreSQL sạch vừa seed: **152 pass / 0 fail / 1 skip** trên đủ 29 suite
(chạy làm hai nửa 77 + 76 vì giới hạn thời gian một lệnh). BE giữ **696/696**
từ lần đo gần nhất.

---

## 2026-08-27 — Labo dựng lại theo bản gốc (đợt 1)

Khảo sát bản gốc `app.nfcdental.com/labo` (chỉ đọc), rồi dựng lại khung 6
sub-route + 3 tab danh mục. Xem `docs/clone/pages/labo.md` và mục Labo trong
`docs/clone/api.md`.

| # | Suite | Nguyên nhân | Cách sửa |
|---|------|-----------|-----|
| R-140 | `labo` ×2 | Đợt trước (R-136) đổi selector sang `getByRole("tab")`. Dãy lọc giờ dùng `SegmentedTabs` dùng chung — render `<button aria-pressed>`, không phải `role="tab"` | Viết lại spec theo `getByRole("button", { name })`; đồng thời mở rộng suite từ 2 lên 7 test |
| R-141 | `labo` — xoá | Nút xác nhận trong `ConfirmDeleteDialog` có accessible name **"delete Xoá"** (alt của icon dính vào), giống R-138 | Khớp bằng `/Xoá$/`, giới hạn trong `getByRole("dialog")` vì nút xoá của dòng cũng tên "Xoá" |

Lỗi thật tìm được khi dựng (không phải rot của test):

- `labo-suppliers` và `labo-materials` **không có route HTTP nào** — controller
  quy ước của ABP không sinh tiền tố `api/v1/app/...` mà client gọi, nên hai tab
  này trả 404 cho trình duyệt. Đã thêm controller khai báo tường minh.
- `GetLaboOrderListInput.SampleFilter` khai báo nhưng **không được áp dụng** —
  4 chip lọc trên bảng Mẫu Labo không làm gì cả. `GetStatsAsync` lại đếm theo
  luật khác. Nay cả hai đọc chung một cặp luật.
- `LaboOrder` thiếu 7 thuộc tính mà migration `ExpandLaboOrder` đã tạo cột
  (`Kind`, 5 khoá danh mục, `AttachmentUrl`) → entity, snapshot và DB lệch nhau.
  Đã bổ sung; snapshot sửa tay theo đúng lệ của repo.
- `LaboBiteType` / `LaboFinishLine` / `LaboRhythmType` **không có
  `ClinicBranchId`** — bản ghi tạo ở chi nhánh này nhìn thấy từ mọi chi nhánh
  khác. Đã bỏ 3 bảng, chuyển sang taxonomy dùng chung (`labo_bite`,
  `labo_finish_line`, `labo_rhythm`) vốn đã có sẵn nhóm và ability subject.

Kết quả, trên bản build production (`vite preview` 8080), backend thật cổng
5019, PostgreSQL đã chạy migration mới:

- `labo` **7/7 pass** — định tuyến sub-route + reload, lọc phía server, tìm kiếm
  phía server, và vòng tạo → sửa → reload → xoá của Khớp cắn.
- Hồi quy mức 3 (phụ thuộc dùng chung: định tuyến, taxonomy):
  `routes` + `sidebar-navigation` + `taxonomy` + `taxonomy-groups` = **41/41
  pass**. Màn Danh mục không hề hấn.
- BE `Application.Tests` **484/484 pass**. FE `vitest` 3/3, `tsc` sạch,
  `oxlint` sạch trong `features/labo`.

---

## 2026-08-27 (chiều) — Labo đợt 2: chỉnh theo 9 điểm phản hồi

| # | Điểm | Đã làm |
|---|------|--------|
| 1 | Thanh công cụ Mẫu Labo thiếu ô/nút | Thêm `LaboPeriodPicker` (Ngày/Tuần/Tháng + "Chọn thời gian" disabled → stepper), nút Xuất Excel, hai combobox Chọn khách hàng / Chọn bác sĩ. BE nhận thêm `FromDate`/`ToDate`/`DentistId` |
| 2 | Dialog tạo NCC không giống bản gốc | Dựng lại đúng bố cục: ô ảnh tròn + "Tải ảnh lên", hàng 3 (Tên*, Email*, SĐT), hàng 2 (Người liên hệ, Mã số thuế), hàng địa giới, Địa chỉ full width, Lưu khoá tới khi có đủ tên + email |
| 3, 4 | Đường hoàn tất / Kiểu nhịp không có dữ liệu | Seed 5 đường hoàn tất + 4 kiểu nhịp (và 5 khớp cắn) cho chi nhánh 1, bộ khác cho chi nhánh 2 để còn đo cách ly |
| 5 | Dịch vụ - vật liệu chưa giống bản gốc | Hai panel: `GroupPanel` dùng chung bên trái, bảng vật liệu bên phải. Vật liệu treo vào **nhóm phân loại**, không treo vào nhà cung cấp |
| 6 | Pagination | Dùng `pagination.buildConfig` + `countedTotal` như /taxonomy, neo dưới đáy thẻ |
| 7 | Ô input bị cắt khi focus | `.ant-modal-body` chừa 4px dưới cho vòng focus; footer bớt 4px nên không xê dịch gì. Sửa cho **mọi dialog** trong app |
| 8 | Style bảng khác các trang khác | Dùng `.bd-cat-body`/`.bd-cat-card` + `DataTable` + `LetterAvatar` + chip nhóm y hệt Danh mục |
| 9 | Tìm kiếm phải gọi backend | NCC và Vật liệu chuyển sang lọc phía server (`Filter=`, debounce 400ms, reset về trang 1). Ba tab danh mục vốn đã gọi server từ đợt 1 |

Lỗi thật tìm thêm được ở đợt này:

- `LaboSupplier` và `LaboMaterial` **không có `ClinicBranchId`** — giống ba bảng
  đã bỏ ở đợt 1. Nay cả hai đều phân quyền theo chi nhánh, có kiểm tra
  `BranchAccessChecker` ở cả đọc lẫn ghi.
- `LaboMaterial` treo vào `SupplierId` + `Category` dạng chuỗi. Bản gốc treo vào
  nhóm phân loại (`taxonomyId`) — nhóm của họ đặt tên theo lab nhưng là bản ghi
  khác với danh sách nhà cung cấp (chính tả khác nhau chứng minh điều đó).
- Migration `20260827120000` **xoá sạch 3 bảng demo labo** (vật liệu không có
  nhóm để trỏ tới, NCC không có chi nhánh để thuộc về). DbMigrator seed lại.
  Lưu ý: DbMigrator phải chạy với `ASPNETCORE_ENVIRONMENT=Development` thì seeder
  demo mới chạy — chạy thiếu biến này là DB không có dữ liệu mẫu.

Kết quả, trên bản build production (`vite preview` 8080), backend thật 5019:

- `labo` **12/12 pass** (từ 7 lên 12: thêm period picker, dialog NCC, hai panel
  Dịch vụ - vật liệu, tìm kiếm server ở NCC và vật liệu, và ô input không bị cắt).
- Hồi quy mức 3: `taxonomy` + `taxonomy-groups` + `taxonomy-dialogs` +
  `taxonomy-flat` = **31/31 pass**; `payment-qr` + `branch-isolation` +
  `routes` = pass (một lần `/staff` đỏ do chờ, chạy lại xanh).
- BE `Application.Tests` **484/484**, `tsc` sạch, `oxlint` sạch trong
  `features/labo`.

| # | Suite | Nguyên nhân | Trạng thái |
|---|------|-----------|-----------|
| R-142 | `materials` :303 | `bd_departments` đã tích 78 dòng do các lần chạy E2E trước (mỗi lần tạo một `PB PHÒNG <id>`). Select "Phòng ban nhận" tìm phía server; khi danh sách dài, Enter rơi vào option đang active cũ ("Lễ tân") chứ không phải option vừa lọc ra | **Chưa sửa — có sẵn, không do đợt này.** Đã dựng lại bản build với `src/styles/index.css` trả về nguyên trạng rồi chạy lại: vẫn đỏ y hệt. Cần dọn dữ liệu E2E hoặc sửa spec chờ đúng option, thuộc phạm vi Vật tư |

### 2026-08-27 (tối) — 3 điểm chỉnh tiếp

| # | Điểm | Đã làm |
|---|------|--------|
| 1 | Ô ảnh trong dialog NCC xấu, không cách phần dưới | 88px, nền `--bd-bg`, viền nhạt, thêm đường kẻ + 20px cách hàng field đầu tiên |
| 2 | Lọc khách hàng / bác sĩ chạy nhưng cột trong bảng trống | **Lỗi thật**: `LaboOrderDto.PatientName` bị `Ignore()` trong AutoMapper, `DentistName`/`SupplierName`/`MaterialName` không ai gán. Lọc chạy vì lọc theo id, còn cột thì rỗng. `LaboAppService.FillNamesAsync` giờ giải tên cả 4 loại, mỗi loại một truy vấn. Seeder cũng gán `SupplierId`/`MaterialId` cho phiếu thay vì chỉ ghi tên dạng chuỗi |
| 3 | Bảng không cần ô vuông chữ cái đầu | Bỏ `LetterAvatar` khỏi cả 5 bảng Labo |

Thêm test canh điểm 2 (`a row names its customer, dentist and material`) — đọc
thẳng ô trong bảng, đỏ ngay nếu tên lại rỗng.

Kết quả: `labo` **13/13**; hồi quy `taxonomy` + `taxonomy-groups` +
`appointment` = **24/24** (appointment dùng chung cách giải tên); BE
**484/484**; `tsc` và `oxlint` sạch.

### 2026-08-27 (tối, tiếp) — logo nhà cung cấp

Ô ảnh trong dialog NCC trước đó chỉ là chỗ trống bị khoá. Nay dựng đúng như
dialog thêm nhân viên (`/staff`): ô tròn 96px chính là nút chọn ảnh, dưới có
"Tải ảnh lên" + "Xóa ảnh". Ảnh lưu thật lên MinIO qua
`POST /v1/app/labo-suppliers/{id}/logo`, đọc lại qua chính API chứ không phải
URL công khai — cùng cách staff avatar đang làm. Lưu bản ghi trước rồi mới tải
ảnh, vì NCC mới chưa có id để treo file.

Nhân tiện sửa: endpoint trả ảnh trước đây khai `image/jpeg` cho mọi file; nay
lấy theo đuôi file đã lưu (PNG trả `image/png`). Trước đó chỉ chạy được vì
trình duyệt tự đoán kiểu.

`labo` **14/14** (thêm test tải ảnh → lưu → reload → đọc lại → xoá). BE
**484/484**, `tsc` và `oxlint` sạch.

| # | Suite | Nguyên nhân | Trạng thái |
|---|------|-----------|-----------|
| R-143 | `staff` :19 | Spec chờ option chi nhánh tên `Nha Khoa Đức Hạnh Premium`, nhưng DB local đang là `BlueDental - Chi nhánh chính` / `Chi nhánh 2`. Seeder chi nhánh có guard theo id nên lần đổi tên ở R-135 không cập nhật dòng đã tồn tại | **Chưa sửa — có sẵn, không do đợt này.** Không đụng gì tới màn Nhân viên; tên chi nhánh này đã hiện như vậy trong mọi ảnh chụp từ đầu phiên. Cần seed lại DB sạch hoặc cho seeder đổi tên dòng cũ |

---

### 2026-09-01 — Đức Hạnh Premium v2 (restyle giao diện)

Đổi lớp giao diện toàn bộ FE theo `BlueDental v2.dc.html` (đọc qua Claude Design
MCP). Không đụng logic nghiệp vụ, route hay API. Token `--bd-*` và `brand` đổi
sang indigo/cyan, khung đổi từ rail `position: fixed` + `margin-left` sang flex
row (rail nổi bo 24px, header kính bo 18px, nền mesh), sơ đồ răng vẽ lại theo
hình giải phẫu, bảng màu trạng thái lịch hẹn theo `statusColor` của design.

Hai bảng màu **cố ý không đổi** vì chúng được ghi xuống DB, không phải đọc từ
stylesheet: `APPT_COLORS` (màu lịch hẹn) và bảng màu Thẻ hồ sơ trong
`PatientTagModal`. Đổi sẽ làm mọi bản ghi cũ mồ côi khỏi picker. Bảng thứ hai
còn nằm trong `/taxonomy` (mục 17).

Đã verify: `tsc -b --noEmit` sạch, `oxlint` 0 error, `vitest` 3/3, build
production sạch, và soi thật trên trình duyệt sau khi đăng nhập (Tổng quan,
Tiếp nhận, Lịch hẹn, Bệnh nhân + hồ sơ, Thanh toán, Labo, Voucher, Báo cáo,
Cài đặt, Danh mục).

| # | Suite | Nguyên nhân | Trạng thái |
|---|------|-----------|-----------|
| R-144 | tất cả e2e chạy qua `127.0.0.1:8080` | Một ứng dụng khác (FoodSafe) đang bind `127.0.0.1:8080` (IPv4) trong khi `vite preview` của BlueDental nằm ở `localhost` → `::1` (IPv6). Playwright lấy `baseURL` mặc định là `127.0.0.1:8080` nên đăng nhập vào **nhầm ứng dụng**; cả 31 test taxonomy fail giống hệt nhau ở ~21,6s (timeout của `login`) | **Không phải lỗi mã.** Chạy lại với `E2E_BASE_URL` trỏ cổng trống thì đăng nhập được. Khi chạy e2e cần kiểm cổng trước |
| R-145 | `taxonomy*` (31), `payment-qr` (3) | Nút "Thêm …" bị `disabled` với title "Chọn một chi nhánh cụ thể trước khi thêm". Tài khoản `admin` sau `DbMigrator` **không có** dòng nào trong `bd_staff_branch_assignments` → là tài khoản toàn phòng khám → header mặc định "Tất cả chi nhánh". Các spec đăng nhập rồi thêm ngay, không chọn chi nhánh | **Chưa sửa — có sẵn, không do đợt này.** Guard này vào từ `baf5934` (25/08), trước đợt restyle. Đã kiểm bằng tay: chọn chi nhánh xong thì nút bật và `/taxonomy` chạy đúng. Cần spec tự chọn chi nhánh, hoặc seed cho `admin` một phân công chi nhánh |
| R-146 | `branch-isolation` :40, `branch-switcher` :35 | Spec dùng tài khoản `manager`; DB local chỉ có `admin` và `branch2` | **Chưa sửa — thiếu seed.** `MANAGER_USER` trong `e2e/fixtures/auth.ts` chưa được `DbMigrator` tạo |

Ghi chú: R-143 (tên chi nhánh lệch) nay đã hết — sau lần migrate này DB đã có
đúng `Nha Khoa Đức Hạnh Premium` và `… - Chi nhánh 2`.
| R-147 | `report.spec.ts` (đọc file Excel tải về) | `TypeError: XLSX.readFile is not a function` — bản ESM của `xlsx` chạy trong Node (Playwright) không gắn `fs`, nên không có `readFile` | Đọc bytes bằng `node:fs` rồi `XLSX.read(buf, { type: "buffer" })` (helper `workbookRows` trong spec). Dùng cách này cho mọi spec cần soi nội dung workbook |

> **Trùng số hiệu:** nhánh này và `main` cùng đánh số từ R-144 một cách độc lập.
> Mục R-144/R-145/R-146 **ngay bên trên** là của `main` (restyle v2). Các mục
> R-144→R-156 trong những phần bên dưới là của nhánh chi tiết bệnh nhân và nói
> về chuyện khác. Chưa đánh số lại để không làm sai lệch các commit đã tham
> chiếu tới chúng.

| R-143 (ĐÃ SỬA 2026-08-31) | `staff` :19 | Spec chờ option chi nhánh tên `Nha Khoa Đức Hạnh Premium`, nhưng DB local đang là `BlueDental - Chi nhánh chính` / `Chi nhánh 2`. Seeder chi nhánh có guard theo id nên lần đổi tên ở R-135 không cập nhật dòng đã tồn tại | **Chưa sửa — có sẵn, không do đợt này.** Không đụng gì tới màn Nhân viên; tên chi nhánh này đã hiện như vậy trong mọi ảnh chụp từ đầu phiên. Cần seed lại DB sạch hoặc cho seeder đổi tên dòng cũ |

### 2026-08-28 — chi tiết bệnh nhân: dialog lịch hẹn, tab Chẩn đoán & Tư vấn, khung bảng chung

Rà soát bản gốc ở chế độ **chỉ đọc** (`?tab=appointment`, `?tab=consulting`),
ghi lại trong `docs/clone/pages/patient-detail.md` và `docs/clone/api.md`.
Không tạo/sửa/xoá bất cứ bản ghi nào trên bản gốc; các nút ghi dữ liệu ghi vào
`docs/clone/unknowns.md`.

**Retest level 3** — thay đổi chạm vào layer dùng chung (`useCatalogOptions`,
`.pd-page` / `.pd-pane`, hợp đồng `AppointmentDto`).

#### Đã dựng

| Việc | Nội dung |
|---|---|
| Khung bảng | `.pd-page` giữ chiều cao khung nhìn, `.pd-pane` cuộn, `.pd-pane--fill` truyền chiều cao xuống thẻ. **Cả 9 tab có bảng** chuyển sang `.bd-cat-card` — đúng khung bảng của `/taxonomy` và `/labo`: tiêu đề dính, dòng cuộn, phân trang neo đáy thẻ **kể cả khi không có dữ liệu** |
| Tạo lịch hẹn | Dựng lại theo bản gốc: 1240px, 3 cột form, `Màu lịch hẹn` 4 ô, thẻ `Ghi chú` với `+ Thêm ngay`, và khối "Lịch đã hẹn" đọc lịch thật của chi nhánh theo Ngày / Tuần / Tháng |
| Chẩn đoán & Tư vấn | 3 nút trên ô ảnh đúng nhãn và đúng hành vi bản gốc; bảng chẩn đoán ghép đôi dữ liệu mỗi ô và có đủ 3 nút thao tác; phiếu tư vấn đủ 13 cột sau `Cấu hình cột`; khối TỔNG KẾ HOẠCH với %/VNĐ và 4 lệnh |

#### Lỗi thật tìm được và đã sửa

| # | Lỗi | Cách sửa |
|---|-----|----------|
| 1 | Sửa lịch hẹn rồi bấm Lưu **tạo thêm một lịch mới** — modal luôn gọi `create` | Gọi `update` khi có `appointmentId`; có test canh |
| 2 | `AppointmentAppService.UpdateAsync` chỉ gọi `Reschedule`, **bỏ rơi `ChiefComplaint`** | Thêm `Appointment.SetDetails(chiefComplaint, notes, color)` |
| 3 | `Notes` chưa bao giờ được gửi lên ở cả create lẫn update — ô Ghi chú lưu xong là mất | Đưa vào cả 2 DTO và cả 2 adapter |
| 4 | Lịch hẹn không có màu | Thêm enum `AppointmentColor` + migration `20260828090000_AddAppointmentColor` (viết tay theo lệ của repo) |
| 5 | `PatientDiagnosisDto.StaffName` / `DiagnosisName` khai mà **không ai gán** → 3 cột luôn hiện dấu gạch | `FillNamesAsync`, mỗi loại một truy vấn; thêm `SecondStaffName` |
| 6 | `PatientAdviseDto` tương tự, lại thiếu hẳn `SecondStaffName` / `DiagnosisName` → 4 cột của bản gốc không vẽ được | Như trên |
| 7 | `/v1/app/consulting-data` và `/v1/app/prescription-templates` **không tồn tại** — 404 mỗi lần vào tab, hai picker luôn rỗng | Đọc qua `/v1/app/catalog-entries` theo group; `CatalogOption` thêm `content` để mẫu đơn thuốc vẫn điền được |
| 8 | `prescription.spec.ts` và `patient-image.spec.ts` còn dùng `role="tab"` — thanh tab của chi tiết bệnh nhân là link từ lần dựng lại `/patient` | Sửa selector sang link + kiểm tra `aria-current`, thêm test bảng/gallery chiếm hết trang |

#### Kết quả chạy thật (bản build production, `vite preview` :8080, API :5019)

- `patient` **13/13** (thêm test layout tab Chẩn đoán & Tư vấn)
- `patient-appointment` **3/3** (mới)
- `appointment` **3/3**, `patient-image` **3/3**, `prescription` **3/3**
- `labo` **14/14**, `finance` pass
- Quét cả 10 tab chi tiết bệnh nhân: 0 lỗi console, không tràn ngang, thẻ bảng
  chạm đáy trang ở mọi tab có bảng
- `tsc` sạch; `oxlint` sạch trong `features/appointments` và
  `features/patient-management`

| # | Suite | Nguyên nhân | Trạng thái |
|---|------|-----------|-----------|
| R-144 | `cskh` :166 và :210 | Dialog "Tạo công việc mới" không tìm thấy combobox `Chọn khách hàng`; dialog file-heart tương tự | **Chưa sửa — có sẵn, không do đợt này.** Đã dựng worktree ở đúng commit `87d2314`, build lại và chạy: **đỏ y hệt 2 test đó**. Nằm ngoài phạm vi đợt này (màn CSKH), cần rà riêng |
| R-145 | `Domain.Tests` — `PatientTests.FullName_Should_Combine_First_And_Last`, `…Register_Should_Throw_When_FirstName_Empty` | Hai assertion cũ còn theo luật trước lần dựng lại `/patient` (commit `87d2314`): `FullName` nay là **họ trước tên sau** (`Nguyễn Văn An`), và chỉ **họ** là bắt buộc — dialog chỉ có một ô "Họ và tên", tên một chữ là một cái tên trọn vẹn | **Đã sửa.** Sửa assertion cho khớp hành vi đã chốt, thêm một test cho tên một chữ. `Domain.Tests` **200/200** |
| R-146 | `HttpApi.Host.Tests` — `ControllerConventionTests.All_Routes_Should_Start_With_Api_V1_App` | `MessagingController` khai route đúng bằng `api/v1/app`, không có phần đuôi | **Chưa sửa — có sẵn, không do đợt này.** Không đụng gì tới Messaging trong đợt này |

### 2026-08-31 — rebase nhánh lên `main` (`ed46cfb`)

`main` đi trước 17 commit và **đã tự làm phần lịch hẹn**: `Color` (chuỗi
`varchar(20)` cho phép null, migration `20260829173829_AddAppointmentColor`),
`Notes` ở cả create lẫn update, `Appointment.UpdateDetails`, lịch hẹn tạm,
`Outcome`, và dựng lại nguyên dialog "Tạo lịch hẹn" kèm "Lịch đã hẹn".

Xử lý khi rebase:

| Của nhánh này | Quyết định |
|---|---|
| `AppointmentColor` (enum) + migration `20260828090000_AddAppointmentColor` | **Bỏ.** Trùng chức năng với main, lại trùng cả tên class migration nên không build được. Local DB phải `DROP COLUMN "Color"` và xoá dòng lịch sử migration của mình thì migration của main mới chạy |
| `Appointment.SetDetails` | **Bỏ** — main có `UpdateDetails` |
| `AppointmentEditorModal` (bản dựng lại), `AppointmentAgenda`, `appointment.css` | **Bỏ** — main đã có bản tương đương, tách component gọn hơn |
| Prop `initialPatientId` / `initialReason` / `lockPatient` | **Giữ**, thêm vào dialog của main để mở từ màn bệnh nhân (ô bệnh nhân bị khoá đúng như bản gốc) |
| Điền tên ở `PatientDiagnosisAppService` / `PatientAdviseAppService` | **Giữ** — main không đụng |
| Toàn bộ phần chi tiết bệnh nhân (khung bảng chung, tab Chẩn đoán & Tư vấn, Hồ sơ) | **Giữ** |

Nhân tiện: `main` lúc đó **không build được** — 8 lỗi `TS6133` (biến/import khai
mà không dùng) ở `CalendarToolbarRow1`, `MiniCalDayView`, `MiniCalWeekView`,
`TempFormCenter`/`TempAppointmentForm`, `timekeepingQueries`,
`WorkScheduleBuilder`, `WorkScheduleTable`, cộng lỗi generic resolver của
`react-hook-form` trong `AppointmentEditorModal`. Đã vá hết vì không build được
thì không verify được gì.

Kết quả chạy thật sau rebase (bản build production, `vite preview` :8080, API
:5019): `patient` 12/12, `patient-appointment` 3/3, `appointment` 3/3,
`patient-image` 3/3, `prescription` 3/3, `treatment-plan` 4/4,
`treatment-stage` 2/2, `labo` 14/14 — **45/45**. `tsc` sạch, build xanh.
BE: `Domain.Tests` 193/193, `EntityFrameworkCore.Tests` 35/35.

| # | Suite | Nguyên nhân | Trạng thái |
|---|------|-----------|-----------|
| R-147 | `Application.Tests` — 6 test (`CrossBranchDenialTests` cho `CustomerCareAppService`, `PatientAppServiceContractTests.GetPatientListInput_Should_Filter_Without_Accepting_A_Branch`) | Hai service này do `main` sửa | **Chưa sửa — có sẵn trên `main`.** Đã dựng worktree ở đúng `main` và chạy: **đỏ y hệt 6 test đó** |

### 2026-08-31 (chiều) — hoàn tất chi tiết bệnh nhân

Rà **cả 10 tab** của bản gốc ở chế độ chỉ đọc, chụp từng tab ở 1600×900 rồi đặt
cạnh bản local. Ảnh nằm trong `reference-private/survey-patient/`.

**Retest level 3** — chạm vào layer dùng chung (thanh tab của trang, khung bảng,
ma trận quyền).

#### Đã dựng

| Việc | Nội dung |
|---|---|
| Thanh tab | Đổi sang kiểu phẳng của bản gốc (nền tint + gạch chân), **chỉ trong `.pd-page`** để không đụng pill dùng chung ở Danh mục / Labo |
| Công tắc `Chi tiết hồ sơ` / `Bệnh án` | Dựng bằng `SegmentedTabs` sẵn có; chế độ xem nằm trong URL (`?view=medical-record`) |
| **Bệnh án** | Aggregate `PatientMedicalRecord` + migration `20260831060000_AddPatientMedicalRecord` + app service + controller `api/v1/app/patient-medical-records` + subject quyền `patientMedicalRecord`. Mục lục 9 biểu mẫu đúng thứ tự, chữ và **màu đo từ computed style của bản gốc**; khung giấy **dùng lại `MedicalRecordSheet`** — tờ A4 mà Danh mục đã dựng cho "Bệnh án mẫu" — thay vì viết lại |
| Kế hoạch điều trị | Hai thẻ tổng kết dựng lại theo bản gốc (ô icon tint + tiêu đề IN HOA + badge đỏ bên phải); thêm icon mắt cho `Xem tất cả dịch vụ` |
| Chăm sóc KH | Phân trang đếm "nhật ký" như bản gốc |

Nguyên tắc "dùng lại component có sẵn" được giữ: `MedicalRecordSheet`,
`SegmentedTabs`, `ConfirmDeleteDialog`, `DataTable`, `.bd-cat-card`, và dialog
lịch hẹn thì lấy nguyên của `main`.

#### Kết quả chạy thật (bản build production, `vite preview` :8080, API :5019)

`patient` 13/13 · `patient-medical-record` **2/2 (mới)** · `patient-appointment`
3/3 · `appointment` 3/3 · `patient-image` 3/3 · `prescription` 3/3 ·
`treatment-plan` 4/4 · `treatment-stage` 2/2 · `labo` 14/14 → **47/47**.
`tsc` sạch, `oxlint` sạch, build xanh.
BE: `Domain.Tests` **193/193**, `EntityFrameworkCore.Tests` 35/35.

`BlueDentalAbilitiesTests.Catalog_Should_Cover_Every_Observed_Subject` đổi từ
85 → 86 subject vì thêm `patientMedicalRecord`; đã ghi rõ trong test là subject
do BlueDental đặt, chưa đối chiếu được với ma trận quyền của bản gốc.

#### Chưa làm, cố ý

1. Chỉ vẽ được biểu mẫu số 2 (Bệnh án ngoại trú RHM) — tờ duy nhất Danh mục đã
   dựng. 8 tờ còn lại có trong mục lục và báo rõ là chưa có bản in.
2. Không có nút `Đồng bộ phiếu` — chưa quan sát được nó chép gì.
3. Tiêu đề cột vẫn IN HOA (quy ước toàn app trong `index.css`), bản gốc để chữ
   thường. Đổi sẽ đụng cả `/taxonomy` đang đóng băng.
4. Tab Hình ảnh chiếm hết chiều cao, bản gốc để hộp ngắn — theo yêu cầu.
5. Cột `Chăm sóc sau điều trị` ở tab Hồ sơ — cần model care gắn công đoạn.
6. Tab Hóa đơn: **bản gốc chưa làm** ("Nội dung đang được hoàn thiện."), local
   đang đi trước.

`CrossBranchDenialTests` vẫn đỏ 6 test (R-147, có sẵn trên `main`, do
`CustomerCareAppService` mất `GuardBranchAccess`). Service mới
`PatientMedicalRecordAppService` theo đúng khuôn đó — `GuardBranchAccessAsync`
private, nhận entity, ném `EntityNotFoundException` — nhưng không thêm vào danh
sách của test vì test đó đang hỏng sẵn và việc CustomerCare có còn cần guard hay
không là quyết định của người sửa `main`.

### 2026-08-31 (tối) — chi nhánh 2 không có dữ liệu mẫu

Anh báo `/patient?branchId=2222…` trống trơn. Không phải lỗi phân tách chi
nhánh — seeder demo **chỉ gieo bệnh nhân cho chi nhánh 1**; chi nhánh 2 trước
giờ chỉ có vật tư.

| Việc | Nội dung |
|---|---|
| Bệnh nhân chi nhánh 2 | Gieo 8 hồ sơ tổng hợp, mã `CN26xxxx` để phân biệt với `BD26xxxx` của chi nhánh 1. Chỉ bệnh nhân — lịch hẹn, hoá đơn và chuỗi lâm sàng vẫn ở chi nhánh 1, nên hồ sơ chi nhánh 2 hiện lịch sử trống một cách trung thực chứ không mượn dữ liệu |
| Tên chi nhánh (R-143) | Seeder chặn bằng `AnyAsync(id)` rồi `return`, nên lần đổi tên trước không bao giờ tới được DB đã có sẵn dòng đó. Nay **sửa tên dòng cũ** thay vì bỏ qua |

#### Lỗi thật lộ ra khi sửa xong tên

`GET /account/me` chỉ đọc chi nhánh từ header `x-branch-id`. Nhưng lần gọi đầu
tiên của một phiên thì client **chưa chọn chi nhánh nào** nên không có header —
kết quả là `clinicId` trả về `null`, tài khoản gắn chi nhánh 2 hiện
"Tất cả chi nhánh" trên header, và `useCurrentBranchId()` rơi về
`DEFAULT_BRANCH_ID` (chi nhánh 1). Nghĩa là **mọi thao tác ghi của tài khoản
chi nhánh 2 đều nhắm vào chi nhánh 1** và bị server từ chối 403.

Sửa: thêm `ICurrentClinicBranchResolver.OwnClinicBranchId` (đọc claim của tài
khoản, không phụ thuộc request); `AccountAppService` dùng
`ClinicBranchId ?? OwnClinicBranchId`. Lỗi này trước bị che vì
`branch-switcher.spec.ts` đã đỏ sẵn ở bước kiểm tra tên chi nhánh, chưa chạy
tới assertion đó.

#### Kết quả chạy thật

`branch-switcher` **3/3** và `branch-isolation` **5/5** (trước đó 3 đỏ) ·
`staff` 1/1 (R-143 cũng chặn nó) · `patient` 13/13 ·
`patient-medical-record` 2/2 · `patient-appointment` 3/3 · `appointment` 3/3 ·
`patient-image` 3/3 · `prescription` 3/3 · `treatment-plan` 4/4 ·
`treatment-stage` 2/2 · `labo` 14/14 → **48/48**.
BE: `Domain.Tests` 193/193, `EntityFrameworkCore.Tests` 35/35.

R-142 và R-143 **đóng**. R-144 / R-146 / R-147 vẫn mở (có sẵn trên `main`).

### 2026-08-31 (khuya) — 4 điểm anh chỉ ra

| # | Điểm | Nguyên nhân / cách sửa |
|---|------|------------------------|
| 1 | Cột đầu của bảng sát mép thẻ | Bảng ở chi tiết bệnh nhân truyền `size="small"`, các trang khác (`/labo`, `/materials`, `/taxonomy`) thì không — antd ghi đè lề 20px của `index.css` bằng 8px. **Bỏ `size="small"` ở toàn bộ 10 bảng**, không thêm CSS đè |
| 2 | Thanh tab không đồng bộ với source | Đổi lại đúng pill của `PageTabBar` như `/materials`. Bản gốc dùng hàng gạch chân phẳng — **chọn đồng bộ nội bộ**, ghi rõ là điểm cố ý khác bản gốc |
| 3 | Một số tab chưa có dữ liệu | Seeder lâm sàng dùng `patients.Take(8/10/12)` trên danh sách **không sắp xếp**, lại chặn theo mức chi nhánh (`AnyAsync` rồi `return`) nên chạy lại không bổ sung gì. Mở hồ sơ nào cũng có thể rơi vào 1 trong ~35 bệnh nhân trống. Nay **sắp xếp theo mã, phủ hết bệnh nhân, và bỏ qua theo từng bệnh nhân** thay vì theo chi nhánh — chạy lại là bổ sung cho bệnh nhân mới. Id của dòng demo đổi sang **suy ra từ id bệnh nhân** (`DemoIdFor`) thay vì theo vị trí trong danh sách, nếu không danh sách dài thêm là id nhảy sang bệnh nhân khác. 43/43 bệnh nhân chi nhánh 1 giờ đều có chẩn đoán, kế hoạch và thanh toán |
| 4 | Mục lục bệnh án chưa dựng cho các mục | 8/9 biểu mẫu không quan sát được bản in trên bản gốc (phải bấm "Thêm" — là thao tác ghi). Nay mỗi mục đều tạo ra **một tờ A4 thật, viết và lưu được**: tiêu đề biểu mẫu, thân có dòng kẻ, và ô "Bắt đầu từ mẫu" lấy nội dung từ **Danh mục → Bệnh án mẫu**. Không tờ nào mạo nhận là bản in của bản gốc |

Kết quả chạy thật: **56/56** (`patient` 13 · `patient-medical-record` **3** ·
`patient-appointment` 3 · `appointment` 3 · `patient-image` 3 · `prescription` 3
· `treatment-plan` 4 · `treatment-stage` 2 · `labo` 14 · `branch-switcher` 3 ·
`branch-isolation` 5). `tsc` sạch, `oxlint` sạch, build xanh.

### 2026-08-31 (khuya, tiếp) — 2 điểm nữa

| # | Điểm | Nguyên nhân / cách sửa |
|---|------|------------------------|
| 1 | Thanh tab dôi khoảng trên | `.bd-tabbar` vốn có `padding: 12px 20px` vì nó là **dải trắng** trên mọi màn khác. Bản trước tôi bỏ nền và viền nhưng giữ padding, lại cộng thêm `gap: 16px` của `page-container` và `margin-bottom: 10px` của breadcrumb → dôi ~38px. Nay trả lại đúng dải trắng như `/materials`, gộp luôn công tắc Chi tiết hồ sơ / Bệnh án vào cùng thẻ, và bỏ margin thừa của breadcrumb |
| 2 | Modal chỉnh sửa hồ sơ ở trang chi tiết khác trang list | **Lỗi thật**: `PatientEditorDialog` dùng class `.bd-patient-dialog` nằm trong `components/patient.css`, mà file đó **chỉ được import từ trang list**. Mở từ hồ sơ bệnh nhân thì dialog không có style. Nay dialog **tự import CSS của chính nó**, nên dùng ở đâu cũng đúng. Ô "Thẻ hồ sơ" vốn đã có trong dialog — nó chỉ không hiện ra vì mất style |
| — | Nút tag cạnh tên | Dựng lại đúng bản gốc: chip 32×24, nền `#E7F0FB`, icon `#2671D8`, bo 4px (đo từ computed style), thay cho nút viền mặc định của AntD |

Thêm test `patient.spec.ts › the record opens the same hồ sơ dialog the list
opens`: mở dialog từ list, ghi lại nhãn 17 field, rồi mở từ hồ sơ bệnh nhân và
**so khớp đúng danh sách nhãn đó** — mất CSS hay lệch field là đỏ ngay.

Kết quả: **32/32** (`patient` 14 · `patient-medical-record` 3 ·
`patient-appointment` 3 · `treatment-plan` 4 · `treatment-stage` 2 ·
`prescription` 3 · `patient-image` 3). `tsc` sạch, `oxlint` sạch.

Còn tồn (không sửa đợt này): `FloatingField` clone `onOpenChange` xuống mọi
child, nên React cảnh báo `Unknown event handler property onOpenChange` khi
child là `<Input>` thường. Là component dùng chung với `/taxonomy` đang đóng
băng nên để nguyên, chỉ ghi lại.

### 2026-08-31 (khuya, tiếp 2) — R-148, R-149

| # | Việc | Kết luận |
|---|------|----------|
| R-148 | `cskh :297` — tạo chéo chi nhánh trả **403**, test đòi **404** | **Do tôi, và là sửa đúng.** `c37d9ee` (`OwnClinicBranchId`) làm tài khoản gắn chi nhánh **thật sự** mang chi nhánh của nó. Nay `BranchAccessChecker` chặn **trước khi** đọc hàng bệnh nhân → 403. Kỳ vọng 404 cũ chính là *dấu vết của lỗi*: hồi đó tài khoản chi nhánh 2 hiện như "tất cả chi nhánh" nên qua được cửa kiểm tra, rồi mới chết ở bước so `patient.BranchId`. 403 **rò rỉ ít hơn** 404: nó không nói gì về việc bệnh nhân đó có tồn tại hay không. Test nay đòi **một trong hai mã từ chối** và **thêm** phần chứng minh không có bản ghi nào được tạo — kiểm tra ở **cả hai** chi nhánh. Đồng thời sửa một lỗi có sẵn trong chính test: `${runId}` nội suy **hàm**, không phải giá trị |
| R-149 | Chạy gộp 9 file thì có **một** test vô can đỏ, mỗi lần một test khác | **Chưa sửa — có sẵn, không do đợt này.** Ba lần chạy gộp: lần 1 `cskh :297`, lần 2 `materials :303`, lần 3 `patient :340`. **Từng cái chạy riêng đều xanh** (`materials` trọn file 11/11; `patient :340` lặp 3 lần đều xanh). Hằng số duy nhất là 2 test đỏ sẵn của R-144. Nghi vấn: test đỏ bỏ dở để lại dữ liệu/hộp thoại, làm lệch số đếm của file chạy kế tiếp — Playwright chạy 1 worker tuần tự. Cần rà riêng phần cách ly dữ liệu giữa các file, không thuộc phạm vi màn bệnh nhân |

Chạy gộp `patient` · `patient-medical-record` · `patient-appointment` · `cskh` ·
`appointment` · `branch-switcher` · `branch-isolation` · `materials` · `labo`:
**61 xanh**, đỏ đúng 2 test R-144 (`cskh :166`, `:210` — cả hai đỏ **cả khi
chạy riêng**, tức hỏng thật, có sẵn) cộng 1 test vô can theo R-149.

`patient.css` cũng được siết lại: ba luật `.floating-field:has(.ss-wrapper)`
trong đó vốn **không có tiền tố**. File này đóng gói thành chunk riêng
(`PatientEditorDialog-*.css`), nên luật không tiền tố sẽ đổi dáng mọi
`FloatingField` toàn ứng dụng — nhưng **chỉ sau khi** ai đó mở một màn bệnh
nhân. Nay cả ba đều nằm dưới `.bd-patient-dialog`. Hiện chưa màn nào khác ghép
`FloatingField` với `SearchSelect` nên không có lỗi nhìn thấy được; đây là bịt
trước.

### 2026-08-31 (tối) — rà soát lại Bệnh án theo phiếu thật

| # | Việc | Kết luận |
|---|------|----------|
| R-150 | **Đổi tên phiếu xoá sạch nội dung phiếu** | **Lỗi thật, đã sửa.** `PatientMedicalRecordAppService.UpdateAsync` gọi `record.Fill(input.Content)` **vô điều kiện**. Đổi tên chỉ gửi `{title}`, nên `Content` về `null` và toàn bộ nội dung đã viết bị ghi đè thành rỗng. Nay chỉ fill khi caller thực sự gửi content; muốn xoá thì gửi tài liệu rỗng, không phải bỏ trống trường. Có test `renaming a sheet keeps what is written on it` canh lại |
| — | Mục lục dựng sai kiểu | Phiếu vốn được tôi để thành hàng chip trên khung giấy; bản gốc lồng mỗi phiếu thành thẻ **ngay dưới biểu mẫu sinh ra nó**. Dựng lại đúng, kèm huy hiệu `Bản NN`, ngày tạo, ô tích và ba nút in/sửa/xoá |
| — | Thiếu hai biểu mẫu | Bản gốc nay có phiếu thật nên đọc được: dựng mới **Bìa hồ sơ bệnh án** (2 mặt, đúng 20 ô tích, bảng kiểm soát hai cột) và **Phiếu Tư Vấn Tổng Quát** (không ô nhập nào — in ra điền tay, nên **Lưu** khoá) |
| — | Thanh dưới | Đổi từ footer chạy hết chiều ngang sang **pill nổi giữa trên tờ giấy**, như bản gốc |

Ba bẫy trong chính test, đã sửa (không phải lỗi sản phẩm):

- Đếm thẻ ngay sau `POST` là đua với refetch. Mọi thẻ dưới cùng một biểu mẫu có
  **cùng tiêu đề**, nên `expect(last).toContainText(tiêu đề)` không chứng minh
  được gì — nó khớp sẵn từ trước. Nay đếm theo mốc trước/sau.
- Test đổi tên bấm `.last()` **trước khi** thẻ mới kịp hiện, nên đổi tên nhầm
  thẻ cũ. Nay chờ số thẻ tăng rồi mới thao tác.
- `openMedicalRecord` chờ đúng response `GET` của danh sách, vì tab chỉ mount khi
  mở view — đếm trước đó đọc ra 0 trên bệnh nhân đã có phiếu.

Kết quả: **41 xanh** (`patient` 14, `patient-medical-record` **7**,
`patient-appointment` 3, `treatment-plan` 4, `treatment-stage` 2,
`prescription` 3, `patient-image` 3, `branch-isolation` 5). `tsc` sạch,
`oxlint` sạch. `Application.Tests` **475/481** — 6 đỏ là R-147 có sẵn
(`CustomerCareAppService` / `PatientAppService`), không đụng đợt này.

### 2026-08-31 (tối, tiếp) — đối chiếu ảnh tab Chẩn đoán & Tư vấn

| # | Việc | Kết luận |
|---|------|----------|
| R-151 | Ô "Răng" không bao giờ hiện màu xanh | **Lỗi thật, đã sửa.** `.pd-cell-link` đặt trên cùng thẻ `<b>` mà `.pd-cell-stack > b` nhắm tới; selector sau đặc hiệu hơn nên đè mất. Nâng lên `.pd-cell-stack > b.pd-cell-link` |
| R-152 | Màu link sai tông | **Đã sửa.** Bản gốc dùng `#2671D8` cho số phiếu và ô răng; local lấy `var(--bd-blue)` = navy `#1c3566`. Thêm token `--bd-link: #2671d8` vào `:root`, áp vào **bốn chỗ đã đo**, không quét đại toàn bộ 28 chỗ dùng `--bd-blue` |
| R-153 | "Chưa cập nhật" lệch màu | **Đã sửa.** `#d4380d`/600 sang `#E5484D`/500, đúng số đo bản gốc |
| — | Header viết hoa, thứ tự phân trang, cỡ chữ ô | **Không sửa.** Cả ba đều là quy ước dùng chung toàn app; sửa riêng một màn là phá thống nhất nội bộ mà anh đã yêu cầu. Đã ghi số đo chính xác vào `docs/clone/pages/patient-detail.md` chờ chốt |
| — | Rác dữ liệu test | E2E tạo bệnh nhân và không dọn; 20 hồ sơ mới nhất đều rỗng, làm lần chụp đối chiếu đầu tiên bị sai. Ghi nhận, chưa sửa |

Kết quả: **46 xanh** (`patient` 14, `patient-medical-record` 7,
`patient-appointment` 3, `treatment-plan` 4, `treatment-stage` 2,
`prescription` 3, `patient-image` 3, `taxonomy` 10). `tsc` sạch.
Token `--bd-link` là **thêm mới**, chưa nơi nào khác dùng, nên không đổi giao
diện ngoài màn chi tiết bệnh nhân — `taxonomy` xanh xác nhận điều đó.

### 2026-08-31 (tối, tiếp 2) — seed đủ dữ liệu bốn tab + đối chiếu cột

| # | Việc | Kết luận |
|---|------|----------|
| R-154 | Bốn tab của hồ sơ bệnh nhân trống hoặc lệch | **Đã sửa.** Ảnh 0 → 189, hóa đơn 71 dòng/1 bệnh nhân → 197/63, labo 8/5 → 71/63, CSKH 31/11 → 161/63. Seeder mới chạy theo từng bệnh nhân thay vì theo bảng |
| R-155 | Phiếu labo seed thiếu `SupplierId`/`MaterialId` | **Lỗi tôi tự tạo rồi tự sửa.** Cột Nhà cung cấp / Vật liệu ở `/labo/mau-labo` đọc theo id; để null thì thành "—" và `labo.spec.ts:138` đỏ. Seeder cũ đã có comment nói đúng điều này, tôi bỏ qua nó |
| R-156 | Điều kiện idempotent sai câu hỏi | **Đã sửa.** Hỏi "bệnh nhân này đã có bản ghi nào chưa" khiến bản ghi của seeder khác chặn mất seeder này — tab CSKH của bệnh nhân demo chính vẫn đọc 0 hết. Nay kiểm **theo đúng id sẽ tạo**. Chạy migrator hai lần cho ra cùng số dòng |
| — | `patient-image.spec.ts` khẳng định trạng thái rỗng | Chỉ đúng khi phòng khám chưa có ảnh nào. Viết lại: kiểm đúng thứ gallery đang hiện, và **ảnh phải decode được** (`naturalWidth > 0`), tức blob có thật chứ không chỉ có dòng dữ liệu |

Đối chiếu cột: **Labo 10 cột · Đơn thuốc 6 · CSKH 9 (8 chip, đếm "nhật ký") ·
Dư nợ 5** — khớp bản ghi khảo sát bản gốc. Hai chỗ số đếm nghi sai đã kiểm với
DB và **đúng cả hai** (bệnh nhân demo thật sự có 406 lịch hẹn; chip CSKH 0 vì
các bản ghi cũ đều chưa chăm sóc).

Kết quả: **64 xanh** (`patient` 14, `patient-image` 3, `patient-medical-record`
7, `patient-appointment` 3, `prescription` 3, `treatment-plan` 4,
`treatment-stage` 2, `labo` 9, `billing` 5, `cskh` 8/10, `branch-isolation` 5,
`branch-switcher` 3). Đỏ đúng 2 test R-144 có sẵn.

### 2026-09-03 — rebase nhánh lên `main` (`1558c26`)

`main` đi trước **26 commit**, trong đó có đợt **restyle v2 "Đức Hạnh Premium"**
(indigo/cyan): `--bd-blue` đổi từ navy `#1c3566` sang indigo `#6366f1`, khung
đổi sang rail nổi + header kính, bảng màu lịch hẹn đổi màu đầu.

Cách làm: gộp 11 commit của nhánh thành **một** rồi mới rebase. Main đã tự sửa
lại đúng những component tôi dựng lại (`TreatmentPlanPanel`,
`PrescriptionPanel`, `PatientProfilePage`, `AppointmentEditorModal`), nên replay
từng commit là phải giải cùng một file 11 lần. Một lần giải, rồi để bộ test bảo
chứng — an toàn hơn nhiều so với giữ lịch sử vụn.

Cách giải từng xung đột:

| File | Quyết định |
|---|---|
| `index.css` | **Giữ bảng màu v2 của main.** Đó là quyết định thiết kế mới của team, không đè lên. Chỉ giữ thêm token `--bd-link: #2671d8` vì nó là *bổ sung* và CSS chi tiết bệnh nhân trỏ vào nó |
| `PatientProfilePage` | Lấy bản của nhánh. Main vẫn đang phát triển **trang cũ** (một trang khổng lồ, `PillTabs`); bản dựng lại theo bản gốc là thứ được yêu cầu |
| `TreatmentPlanPanel`, `PrescriptionPanel` | Lấy bản của nhánh — là superset (phân trang, cột ẩn/hiện, nhãn theo bản gốc) |
| `AppointmentEditorModal` | Lấy bản của nhánh — mồi sẵn bệnh nhân / lý do / giờ khi mở từ hồ sơ |
| `.gitignore`, `PatientTests.cs` | Hai bên chỉ thêm, giữ cả hai |
| `03-regression-log.md` | Giữ cả hai phần. **Trùng số hiệu**: cả hai nhánh cùng đánh số từ R-144 độc lập; đã ghi chú ngay tại chỗ thay vì đánh số lại |

**Không mất việc của người khác.** `origin/wip/patient` có 4 commit mà local
không có; `b33dc5a` (mobile full-screen modal/drawer, 29 dòng CSS) **chưa có
trong main** nên đã cherry-pick sang, giữ nguyên tác giả. `89a6ecd` (lockPatient)
đã kiểm: bản trên nhánh này nối `disabled={lockPatient}` trên **file mới của
main**, không thiếu gì so với bản cũ.

Một test phải đổi theo: `patient-appointment` khẳng định swatch đầu tên
"Xanh dương", nhưng v2 đổi màu đầu thành indigo "Tím". Nay kiểm **theo vị trí**
(swatch đầu được chọn sẵn, và chỉ một swatch được chọn) — bảng màu là quyết định
thiết kế, còn hành vi mới là thứ test cần giữ.

Kết quả sau rebase: `tsc` sạch, `oxlint` 0 error, build production sạch,
`dotnet build` sạch. **E2E 55/55**. **Domain.Tests 194/194**,
**Application.Tests 485/485** — 6 test đỏ của R-147 nay đã hết, `main` sửa rồi.

### 2026-09-03 — bốn điểm anh chỉ ra

| # | Điểm | Nguyên nhân / cách sửa |
|---|------|------------------------|
| R-157 | Modal tạo lịch hẹn ở trang hồ sơ bệnh nhân hỏng: rộng hết màn, ba cột sập thành một, swatch màu thành vạch xám | **Lỗi thật.** Toàn bộ class `.appt-*` nằm trong `calendar.css`, mà file đó **chỉ trang lịch import**. Mở từ hồ sơ bệnh nhân là không có style. Nay modal **tự import CSS của nó** — đúng cách đã áp cho `PatientEditorDialog` ở R-1xx trước |
| R-158 | Dialog "Thêm loại nguồn đến" thiếu Mức độ ưu tiên | Thêm field (mặc định 0) và nối `sortOrder` qua `useCreateTaxonomyGroupOption` xuống API. DTO backend `CreateTaxonomyDto.SortOrder` vốn đã có |
| R-159 | Bỏ tick IN HOA vẫn để nguyên "LÊ THỊ LIÊN" | Nay chuẩn hoá về "Lê Thị Liên". Quan trọng: chỉ làm khi **chuyển trạng thái** tick → bỏ tick. Bản đầu tôi để effect chạy mỗi lần gõ, nó ghi đè tên lễ tân đang nhập và làm đỏ hai test đăng ký |
| R-160 | Dialog có field "Thẻ hồ sơ" mà trang đích không có | Bỏ field. Tag nay do **nút tag trên hồ sơ** quản, nên khi sửa hồ sơ phải **giữ nguyên** tag cũ (`patient?.tagIds`) chứ không xoá |
| R-161 | Select nghề nghiệp thiếu option "Khác" | Thêm slot `footer` cho `SearchSelect` dùng chung, và dựng "Khác" + ô nhập tự do ghi vào `occupationOther`. Hai bẫy: field chỉ **đăng ký** khi ô hiện ra nên `useWatch` không thể là nguồn của tick (vòng lặp) — nay tick là state cục bộ, field luôn đăng ký qua `hidden`; và submit phải chịu được field vắng mặt (`values.occupationOther?.trim()`), nếu không `undefined.trim()` làm chết cả nút Lưu |
| R-162 | Nút tag: rà soát logic | **Lỗi thật.** Picker lấy tag theo **bộ lọc header**; với tài khoản toàn phòng khám header là "Tất cả chi nhánh" nên nó chào cả tag của chi nhánh khác — gắn nhầm được. Nay lấy theo `patient.branchId` |
| R-163 | Ô "Thêm lý do đến khám" quá thấp | `rows={8}` vô tác dụng: `index.css` ghim mọi textarea trong modal ở `min-height: 42px`. Thêm nữa, `showCount` khiến `className` rơi vào **wrapper** chứ không phải `<textarea>`. Nhắm qua wrapper xuống textarea, cao 180px |

Ghi chú không sửa lần này: danh sách tag và nghề nghiệp đầy bản ghi rác do e2e
tạo ("Thẻ E2E …", "Thợ …") — các spec tạo dữ liệu và không dọn. Không phải lỗi
sản phẩm nhưng làm dropdown khó nhìn.

Thêm 6 test canh: modal lịch hẹn **có style khi mở từ hồ sơ** (ba cột nằm ngang,
không xếp chồng), IN HOA đi và về, dialog nguồn đến có Mức độ ưu tiên, dropdown
nghề nghiệp có Khác và mở được ô nhập, ô lý do cao > 140px, và request tag mang
đúng chi nhánh của bệnh nhân. Test cũ đòi field "Thẻ hồ sơ" nay đảo lại: dialog
**không được** có field đó.

Kết quả: **49 xanh** (`patient` 19, `patient-appointment` 4,
`patient-medical-record` 7, `patient-image` 3, `appointment` 5,
`treatment-plan` 4, `treatment-stage` 2, `prescription` 3, `taxonomy-flat` 2).
`tsc` sạch, build sạch.

### 2026-09-03 (tiếp) — ba điểm nữa

| # | Điểm | Nguyên nhân / cách sửa |
|---|------|------------------------|
| R-164 | Hai field ở dialog "Thêm loại nguồn đến" xếp dọc | Dựng lại theo đúng cách Danh mục bố trí dialog nhóm của nó (`Row gutter={[16, 12]}`, `Col span 15/9`), và nới dialog 420 → 520 cho đủ chỗ |
| R-165 | Modal Thanh toán: tiêu đề cột xuống hàng | Hai cột hẹp hơn chính tiêu đề của nó (`Mã thanh toán` 130, `Phương thức thanh toán` 180). Nới lên 150/215 **và** cấm xuống hàng ở `th`. Nhưng chỉ nới thôi thì cột `Thao tác` ghim phải đè lên và **cắt** tiêu đề cuối — nên nới luôn modal lên `min(1320px, 100vw - 48px)` cho tổng 1260px của tám cột vừa đủ |
| R-166 | Nút tag: chưa thấy UI chọn tag | **Không tái hiện được.** Thử trên bản build production **và** dev server :5173, cả chi nhánh 1 (53 tag) lẫn chi nhánh 2 (4 tag) — popover mở đúng cả bốn lần. Nghi bundle cũ ở máy anh. Nhưng đối chiếu lại ảnh bản gốc thì thấy một thiếu sót thật: tag đang gắn chỉ đổi nền, **không có dấu tích** như bản gốc. Đã thêm |

Thêm 3 test: hai field nguồn đến **cùng hàng** (so toạ độ, không chỉ so sự tồn
tại), mọi tiêu đề cột modal Thanh toán **một dòng và không bị cắt**
(`scrollWidth > clientWidth`), và tag đã gắn **hiện dấu tích**.

Một bẫy trong test: nút "Thanh toán" trùng tên với mục sidebar, `.last()` bắt
nhầm. Nay nhắm đúng nút của hồ sơ (`.pd-page .pd-btn-outline`).

Kết quả: **46 xanh** (`patient` 22, `patient-appointment` 4,
`patient-medical-record` 7, `patient-image` 3, `appointment` 5,
`treatment-plan` 4, `taxonomy-flat` 5, `billing` 5). `tsc` sạch, `oxlint` 0 lỗi.

### 2026-09-03 (tiếp 2) — R-166 đóng: đo bảng chọn tag trên bản gốc

Trước đó tôi không tái hiện được và đoán là bundle cũ. Nay đã đăng nhập bản gốc
và **đo thật** (chỉ đọc, không bấm tag nào). Popover ở bản gốc mở bình thường —
nên phần "bấm ra trống" vẫn không tái hiện được. Nhưng đo xong thì lộ **bốn
khác biệt thật**, đã sửa:

| Chỗ | Bản gốc | BlueDental (trước) |
|---|---|---|
| Hướng mở | `bottomLeft`, mép trái thẳng mép nút | `bottomRight` — mở lệch hẳn sang trái |
| Khoảng hở | 9px, **không mũi tên** | 16px, AntD chừa chỗ cho mũi tên |
| Bề rộng / dòng | 258px / 40px | 260px / 34px |
| Nền nút | `#DCEBFA` | `#e7f0fb` |

Đo lại sau khi sửa: **258 / 8 / lệch 4 / dòng 40** so với **258 / 9 / lệch 1 /
40** của bản gốc.

Hai bẫy trong test đo, đã sửa:

- Đo ngay khi popover *visible* thì đọc ra **206px** — AntD phóng popover từ
  `scale(0.8)`, và 258 × 0.8 = 206. Nay `expect.poll` cho tới khi nó đứng yên.
- Test tiêu đề cột modal Thanh toán đỏ khi chạy chung: viewport mặc định hẹp hơn
  1260px nên cột `Thao tác` ghim phải che tiêu đề cuối. **Bản gốc cũng vậy** —
  nên test cố định khổ đủ rộng thay vì khẳng định điều bản gốc không giữ.

Kết quả: **42 xanh** (`patient` 22, `patient-appointment` 4,
`patient-medical-record` 7, `patient-image` 3, `appointment` 5,
`taxonomy-flat` 5 và `billing` 5 — trừ vài test trùng). `tsc` sạch, `oxlint` 0 lỗi.

### 2026-09-03 (tiếp 3) — soi lại tab Chẩn đoán & Tư vấn trên bản gốc

| # | Điểm | Kết luận |
|---|------|----------|
| R-167 | Nút "+" của "Tạo chẩn đoán" to quá | **Đã sửa.** Bản gốc: vòng **28×28**, icon **16px**, nhãn **16px/700**. BlueDental dùng nút tròn mặc định AntD (32px) và nhãn 600. Ép về đúng số đo |
| — | Hành vi panel ảnh | **Không phải lỗi.** Ba nút (`Thêm ảnh` → chọn file, `Danh sách ảnh` → modal "Chọn ảnh hiển thị" với `Chọn tất cả`/`Xong`, `Danh mục` → popover "Dữ liệu tư vấn") **đã dựng đúng từ trước**, nối dữ liệu thật, và **đã có test** từ trước. Đo lại toàn bộ số đo panel (thẻ 350px, vùng thả `#E6EAF0` 240px, nút 36×36 bo 6 cách 4px) — **khớp hết** |
| — | `.pd-card-title` bị tách rời | Luật của nó nằm ở hai chỗ cách nhau 500 dòng (một khối dùng chung ở trên, một override ở dưới), nên nửa trên là code chết với selector này. Gộp về một chỗ tự đủ |

Thêm phép đo vào test có sẵn: nút "+" phải **28×28**, tiêu đề **700**, thẻ ảnh
**350px**, vùng thả **240px** nền `rgb(230,234,240)`, nút công cụ **36px**.

Ghi rõ một chỗ **cố ý khác**: vòng "+" bản gốc `#2671D8`, BlueDental dùng indigo
primary của v2 cho thống nhất sau đợt restyle — chỉ khác màu, kích thước đã khớp.

Kết quả: **41 xanh** (`patient` 22, `patient-appointment` 4, `patient-image` 3,
`patient-medical-record` 7, `treatment-plan` 4, `treatment-stage` 2 — trừ trùng).
`tsc` sạch, `oxlint` 0 lỗi.

### 2026-09-03 (tiếp 4) — panel ảnh tab Chẩn đoán & Tư vấn

| # | Điểm | Cách sửa |
|---|------|----------|
| R-168 | Ảnh tải lên xong không hiện | Trạng thái đổi từ "danh sách được chọn" sang **"danh sách bị ẩn"**. Mặc định rỗng nên ảnh vừa có là hiện ngay; `Chọn tất cả` xoá danh sách ẩn |
| R-169 | Modal "Chọn ảnh hiển thị" sai hoàn toàn | Trước là lưới `Checkbox.Group` thả ảnh nguyên cỡ, tràn ra ngoài. Dựng lại theo số đo bản gốc: nhóm theo ngày chụp, thẻ **280px** bo 22 đệm 12 viền xanh khi chọn, ảnh **254×190** `cover` bo 18, ô tích đè góc ảnh, tên + giờ, hai nút tròn kéo/xoá |
| R-170 | Ảnh được chọn không hiện ngoài panel | Xếp dọc, mỗi tấm **240px** `object-fit: cover` bo 12, cách 8px — đúng tile của bản gốc |
| R-171 | Tải ảnh không có loading | Nút "Thêm ảnh" quay, vùng thả đổi thành `Spin` khi `uploadImage.isPending` |
| R-172 | Bấm ảnh không xem được | Dùng `Image.PreviewGroup` của AntD: overlay có đếm `1 / 3`, chuyển ảnh, xoay/lật/zoom. Bản gốc dùng lightGallery; ở đây dùng component sẵn có của app thay vì thêm thư viện |

Ba bẫy khi viết test, đã sửa:

- Bệnh nhân đầu danh sách **không có ảnh** (là hồ sơ do e2e tạo, seeder chạy
  trước đó). Helper nay hỏi API lấy một ảnh bất kỳ rồi mở đúng hồ sơ ấy.
- Hồ sơ đó có thể ở **chi nhánh khác** → thiếu `branchId` là 404 và trang không
  vẽ panel. Lấy `clinicBranchId` ngay trong DTO ảnh mang theo.
- Đo bề rộng thẻ ngay khi modal *visible* đọc ra **56px** — AntD phóng modal từ
  `scale(0.2)`, mà 280 × 0.2 = 56. Nay `expect.poll` cho tới khi đứng yên.

Kết quả: **41 xanh**. Hai test đỏ khi chạy gộp (`patient-appointment` :161 và
`patient` :215) **xanh khi chạy riêng** — đúng kiểu nhiễu giữa file đã ghi ở
R-149, không do đợt này. `tsc` sạch, `oxlint` 0 lỗi.

### 2026-09-03 (tiếp 5) — gộp thành `feat(wip)` và rebase lên `main` (`8e470e9`)

`main` đi trước **15 commit**. Gộp 8 commit của nhánh thành **một** `feat(wip)`
rồi rebase — như lần trước, để chỉ phải giải xung đột một lần thay vì tám.

Chỉ **một** file xung đột, 3 chỗ, đều ở `AppointmentEditorModal`: main thêm
`initialDoctorId` (mở từ cột bác sĩ trên lịch thì mồi sẵn bác sĩ), nhánh này
thêm `initialPatientId` / `initialReason` / `lockPatient` (mở từ hồ sơ bệnh nhân
thì mồi sẵn bệnh nhân và khoá ô lại). Hai bên **bổ sung cho nhau** nên giữ cả
bốn: hàm `reset` khi tạo mới nay mồi cả bác sĩ, bệnh nhân lẫn lý do.

Commit gộp giữ `Co-Authored-By` của anh Danh — nó bao gồm cả commit mobile
full-screen styles (`b33dc5a`) đã cherry-pick từ lần rebase trước.

Kiểm chứng sau rebase: `tsc` sạch, `oxlint` 0 lỗi, build FE sạch,
`dotnet build` sạch, migration chạy xong (main không thêm migration nào).
**E2E 46/46**. **Domain.Tests 194/194**, **Application.Tests 485/485**.


### 2026-09-05 — dựng lại tab Hình ảnh theo bản gốc (F-24)

Người dùng báo tab `/patient/:id?tab=image` không giống staging. Đo lại bản
gốc (đọc-chỉ, không bấm gì có thể ghi) và ghi vào `patient-detail.md` Tab 5,
rồi dựng lại từ đầu:

- **BE**: `PatientImage` thêm `Type` (`Before`/`After`) và `Ordering`; migration
  `20260905100000_AddPatientImageTypeAndOrdering`; list lọc theo `type`, sắp
  `Ordering desc, TakenAt desc`; thêm `PUT /patient-images/reorder`. Domain
  test 11, mapping test 3 — xanh.
- **Lỗi tìm thấy khi chạy e2e**: nút "Tải ảnh" không hiện vì
  `GET /account/current-user` luôn trả `permissions: []` — trước giờ không màn
  nào dùng `hasPermission` nên không ai thấy. `AccountAppService` giờ hỏi
  `IPermissionChecker` cho toàn bộ quyền đã định nghĩa. Đây là thay đổi dùng
  chung → chạy thêm Level 3 (auth, branch-isolation, rich-image, patient).
- **FE**: xoá `PatientImagePanel`; thêm `components/patient-detail/image/`
  (toolbar, timeline theo ngày, card, viewer tự dựng thay lightGallery vì bản
  thương mại, lớp vẽ chú thích canvas) + hooks `usePatientImageGallery`
  / `Upload` / `Reorder` / `Permissions` / `useImageViewer`; kéo-thả bằng
  `@dnd-kit` trong cùng ngày. CSS riêng `patient-image.css`, tab không còn
  kéo giãn hết màn hình (bản gốc là hộp ngắn).
- **Playwright** `patient-image.spec.ts` viết lại: 5/5 xanh trên `vite preview`
  8080 với backend thật. Lỗi vặt khi viết test: option của AntD Select phải
  bấm qua `.ant-select-dropdown .ant-select-item-option` (list `role=option`
  bị ẩn); toast "Đã xoá ảnh" xuất hiện hai lần → `.first()`; test cách ly chi
  nhánh không dùng biến chung vì worker khởi động lại sau test đỏ.
- Bản gốc: "Giai đoạn điều trị" là hằng 2 giá trị trong bundle, không phải
  danh mục — giữ nguyên hằng ở FE.

### 2026-09-05 — viewer tab Hình ảnh: bảng màu, zoom/kéo, nét vẽ theo ảnh (F-24)

Ba báo cáo nối tiếp của người dùng sau khi nghiệm thu F-24:

- **"Đổi màu hoặc độ dày nét vẽ" bấm không thấy gì**: Popover AntD gắn vào
  `body` ở z-index 1030, viewer ở 1100 nên bảng màu nằm dưới nền đen. Đo bằng
  `elementFromPoint` để xác nhận, sửa bằng `getPopupContainer` gắn vào
  `.pi-viewer`. Bảng màu theo bản gốc: 6 màu cố định + ô cuối là ô chọn màu
  tự do (`<input type="color">`), và "Tắt chế độ vẽ" xoá toàn bộ nét đã vẽ.
- **Chưa xử lý zoom**: thêm zoom bằng bánh xe (bước 0.25, chặn cuộn trang
  bằng listener native `passive: false` vì `onWheel` của React là passive),
  double-click 2×/về 1×, kéo ảnh khi đã phóng (`useViewerPan`, kẹp trong
  khung, reset offset khi về 1×). Con trỏ `grab`/`grabbing`, tắt transition
  khi đang kéo.
- **Nét vẽ không phóng theo ảnh**: canvas nằm ngoài khung nên đứng yên khi
  ảnh phóng/xoay. Chuyển canvas vào trong `.pi-viewer-frame`, toạ độ con trỏ
  đổi về pixel ảnh bằng nghịch đảo `DOMMatrix` của khung quanh tâm; tách
  `useViewerAnnotation` (state nét vẽ, màu, độ dày) + `ViewerAnnotationCanvas`
  + `ViewerPenTools`. Kiểm bằng ảnh chụp: nét vẽ khi đã phóng 2× và xoay vẫn
  nằm đúng dưới con trỏ.
- **Lỗi vặt khi viết test**: ảnh PNG 16 px phóng 4× vẫn lọt trong khung nên
  không kéo được → test vẽ PNG 1600×1200 ngay trong trình duyệt; ở viewport
  1280×720 ảnh 4:3 chỉ tràn theo chiều dọc nên phải kéo lên/xuống (kéo ngang
  bị kẹp về 0 là đúng); phải chờ `<img>` decode xong và transform ổn định
  trước khi kéo vì khung chưa có ảnh đo ra 0×0. Không được bấm Escape để đóng
  bảng màu — Escape đóng cả viewer. Sau mỗi lần test đỏ, ảnh `truoc-a/b-*` còn
  sót trên bệnh nhân đầu tiên phải xoá qua UI local trước khi chạy lại.
- **Bấm vùng đen chưa đóng viewer**: thêm `onClick` ở gốc `.pi-viewer`, bỏ
  qua khi mục tiêu nằm trong khung ảnh, thanh trên, mũi tên, thanh bút, dải
  thumbnail hay popover; test bấm vào ảnh (còn mở) rồi bấm góc sân khấu (đóng).
- `patient-image.spec.ts` 5/5 xanh trên `vite preview` 8080, backend thật.

## 2026-09-05 — Đơn thuốc: dựng lại tab theo bản gốc staging

Người dùng báo tab "Đơn thuốc" của hồ sơ bệnh nhân làm sai. Soi bản gốc
(staging, chỉ đọc: mở dialog, không lưu) rồi hỏi chủ sản phẩm ba điểm không
quan sát được (Thao tác = Sửa/Xóa; tích "Lưu đơn thuốc mẫu" hiện ô "Tên đơn
thuốc mẫu"; phạm vi = tạo/sửa/xoá). Dựng lại cả BE lẫn FE.

| # | Điểm | Cách sửa |
|---|------|----------|
| R-173 | Dòng thuốc cũ chỉ có tên + số lượng + cách dùng tự do | `bd_prescription_items` dựng lại: `TimesPerDay` · `AmountPerTime` · `Days` · `Usage` (cờ) · `OtherUsage`; `Quantity` là tích ba số, tính ở domain. Migration `20260905120000_RebuildPrescriptionLines` |
| R-174 | Không có cách lưu đơn thành mẫu | `saveAsTemplate` + `templateName` trên POST/PUT: tạo `CatalogEntry` nhóm `prescription_template` mang dòng thuốc và lời dặn; `e2e/prescription.spec.ts` (real stack) khẳng định mẫu xuất hiện trong danh mục và chọn lại được prefill đủ dòng thuốc + lời dặn |
| R-175 | Dialog cũ không giống bản gốc | `PrescriptionDialog` mới: khối bệnh nhân (tên · giới tính/ngày sinh/tuổi · tiểu sử bệnh · liên hệ), chọn mẫu + "Thêm loại thuốc", bác sĩ bắt buộc, chẩn đoán, lời dặn, tích mẫu → ô tên, Điều trị, Tái khám, bảng dòng thuốc có phân trang |
| R-176 | Dialog đóng mở không theo URL | Bản gốc gắn `&create=true`; local `useSearchParams` set/xoá cờ, mở thẳng URL thì dialog hiện, link các tab khác không mang cờ theo |
| R-177 | Widget dòng thuốc nằm kẹt trong dialog Đơn thuốc mẫu | Nhấc ra `src/components/prescription-lines/` (`PrescriptionLineEditor`, `PrescriptionLineCard`, `UsagePicker`), dialog danh mục dùng lại — không đụng hành vi, 38 spec taxonomy/payment-qr/branch chạy lại xanh trên bản build |
| R-178 | Bảng rỗng mất dòng "Hiển thị 0 trên 0" | antd giấu pager khi `total = 0`; tab tự vẽ `Pagination` dưới bảng rỗng cho khớp bản gốc |
| R-179 | Widget dòng thuốc vẽ **cả** bảng desktop lẫn thẻ mobile rồi giấu một bên bằng CSS → mỗi dòng có hai ô "Tên thuốc"/"Ngày uống"… trong DOM, Playwright strict mode đỏ ở cả spec Đơn thuốc lẫn `taxonomy-dialogs` | `useMediaQuery("(max-width: 640px)")` (hook mới `src/hooks/useMediaQuery.ts`): chỉ dựng bảng **hoặc** thẻ, không cả hai. Bỏ luôn 11 `style={{ width: "100%" }}` thừa kế từ dialog Đơn thuốc mẫu → class `bd-rx-full` |

Bẫy khi viết test, đã sửa:

- Mỗi dòng thuốc từng vẽ **hai lần** (hàng bảng cho desktop, thẻ cho màn hẹp)
  nên `getByLabel("Tên thuốc")` trúng hai combobox → sửa tận gốc ở R-179,
  spec chỉ cần `{ exact: true }`.
- Nút xác nhận xoá có icon nên tên truy cập là `"delete Xoá"` → regex `/Xoá$/`,
  giống nút Lưu (`"save Lưu"`).
- Bấm mở combobox rồi chờ option thỉnh thoảng đỏ (dropdown đóng lại kịp trước
  khi click); gõ tên vào ô tìm kiếm rồi mới chọn thì ổn định — 3 lần chạy liên
  tiếp đều 5/5.
- Test đỏ giữa chừng để lại đơn thuốc trên bệnh nhân đầu danh sách; xoá qua UI
  local trước khi chụp ảnh so sánh.

Kết quả: `prescription.spec.ts` **5/5** (×3 lần), 38 spec danh mục xanh; BE
Domain 250 · Application 508 · EF 51 xanh; DbMigrator áp migration thành công.
Ảnh so sánh: `reference-private/survey/staging/prescription-*.png` vs
`reference-private/survey/local/prescription-*.png` — lệch còn lại là quy tắc
toàn app (màu primary, cỡ tiêu đề AppDialog, nút Lưu bị khoá khi thiếu dữ liệu),
ghi ở `docs/clone/pages/patient-detail.md`.

### 2026-09-05 (tiếp) — chạy lại đủ bộ danh mục sau R-179

Bộ `taxonomy*.spec.ts` + `payment-qr` + `branch-*` trên bản build production
(`vite preview`, cổng 8080): **42 test: 39 xanh, 3 đỏ** (lần chạy cuối 38 xanh + `taxonomy-groups.spec.ts:163`
"says it is saving" đỏ vì máy đang chạy song song bộ test BE của phiên khác,
chạy lại riêng `--repeat-each 3` → 3/3 xanh). Ba test đỏ chạy lại
riêng vẫn đỏ, nên đã dựng bản build sạch của `HEAD` (`20c4815`, `git archive`
ra scratchpad, bundle `index-DGvaXNg9.js` khác bundle của nhánh làm việc)
và chạy đúng ba test đó trên bản HEAD: **cả ba vẫn đỏ y hệt** → đỏ từ trước,
không do Đơn thuốc. Ghi lại để không ai sửa nhầm vào spec đã chốt:

| Test | Lý do đo được | Thuộc về |
|------|---------------|----------|
| `taxonomy-dialogs.spec.ts:152` "stores its lines and works out the quantity" và `:207` "Khác asks for the usage in words" | `page.locator(".ant-select-item-option", { hasText })` bấm **ngay** sau khi mở combobox Tên thuốc; danh sách thuốc chi nhánh 1 đã dồn hơn 40 dòng (cặn e2e) nên rc-virtual-list bật, Playwright `scrollIntoView` trong lúc dropdown còn đang animate làm list cuộn qua item 9–15 rồi lặp "element is outside of the viewport" đến hết 30 s. Thử cùng flow nhưng chờ 500 ms sau khi mở (spec probe, đã xoá) → bấm trúng, test xanh | Bẫy timing trong spec + cặn dữ liệu e2e; **không** phải widget dòng thuốc (Select giống hệt bản cũ, đỏ cả ở HEAD) |
| `taxonomy.spec.ts:277` "a phone-width window scrolls the page" | Spec đòi `document.documentElement.scrollHeight > innerHeight`, nhưng từ shell v2 (`f7b5993`, 2026-09-02) `.app-content` là scroller (`overflow-y: auto`) nên document không cuộn nữa | Shell CSS toàn app, ngoài phạm vi Đơn thuốc |

Không sửa hai spec chốt trong đợt này (mục 17 CLAUDE.md); cách sửa hợp lý khi
tới lượt: dropdown thuốc → gõ tên vào ô tìm kiếm rồi mới chọn (như spec Đơn
thuốc), và xoá cặn thuốc e2e; phone-width → đo `main.app-content` thay cho
`documentElement`.

### 2026-09-05 — dựng lại tab Chăm sóc KH trong hồ sơ bệnh nhân (F-37)

Khảo sát chỉ đọc trên staging (`?tab=care`, chủ dự án cho phép bấm Xoá để xem
dialog, **không** bấm xác nhận) rồi dựng lại tab theo bản gốc + 5 câu trả lời
của chủ dự án: NV chăm sóc = người đăng nhập (khoá), Họ và tên khoá, bản ghi
đã đóng vẫn sửa, 4 mức hài lòng mặc định Khá, payload lưu theo PUT của bản gốc.

Mức retest: **2** (BE + FE của một feature; `ConfirmDeleteDialog` dùng lại,
không đổi). Kết quả:

- BE: `Application.Tests` lọc CustomerCare + Patient **70/70** xanh (thêm
  filter `outcome`, stats theo loại, `DELETE` soft delete có guard chi nhánh).
- FE: `tsc -b` + eslint sạch, `vite build` OK.
- `e2e/patient-care.spec.ts` trên bản build production (:8080 → :5000 →
  PostgreSQL): **2/2** xanh (16,2 s lần đầu, 13,0 s sau khi chỉnh CSS).

Bẫy gặp phải, ghi để khỏi lặp:

- AntD ẩn pager khi `total = 0` → assertion "nhật ký" phải nằm sau khi đã có
  dòng, không đặt ở test trang trống.
- Nút đóng modal AntD dưới locale vi tên là **"Đóng"**, không phải "Close".
- Test dài (tạo → lọc → xem → sửa → reload → xoá → reload) cần
  `test.setTimeout(120_000)`; lần đỏ để lại dòng "E2E chăm sóc …" nên spec
  có `deleteLeftovers()` chạy trước khi đo counter.
- CSS toàn app: th viết hoa 11.5px và pager đặt `total-text` order -2 /
  `options` order -1 → tab phải override trong `patient-care.css`; tiêu đề
  modal chung 16px → tab đặt 22px/700 cho hai dialog của mình.

Ảnh đối chiếu: `reference-private/survey/staging/patient-care-2026-09-05/0[1-6]-*.png`
vs ảnh local chụp cùng viewport 1600×900. Lệch còn lại: chrome chung (sidebar,
màu primary) và dialog xoá dùng chung 440px/14px so với ~380px/16px.

### 2026-09-06 — DbMigrator chết trên database trống: ba bảng mất trong merge

Chạy `dotnet run --project src/BlueDental.DbMigrator` trên DB rỗng thì hỏng.
Log mở đầu bằng một loạt `[ERR] relation "AbpSettingDefinitions" does not exist`
— **nhiễu**, không phải lỗi: ABP khởi tạo application (lưu setting/permission/
feature tĩnh xuống DB, quét background job) *trước* khi `MigrateAsync()` chạy,
nên trên DB trống mấy truy vấn đó luôn đỏ; ABP nuốt exception và đi tiếp.

Lỗi thật nằm ở dòng cuối, `[ERR] Hosting failed to start`:

```
ALTER TABLE bd_care_records ADD "CareServiceId" uuid;
42P01: relation "bd_care_records" does not exist
```

Nguyên nhân: `20260822235823_MergeConflictResolve` được commit với `Up()` **rỗng**.
Designer snapshot của chính nó vẫn mô tả `bd_care_records` và `bd_labo_orders`,
mọi migration sau đó đều coi hai bảng này đã có (`ExpandCustomerCare` thêm 7 cột,
`ExpandLaboOrder` thêm 7 cột), nhưng không migration nào tạo chúng — bước gỡ
xung đột giữ snapshot và bỏ mất phần operations. Bảng thứ ba, `bd_visits`, mất
cùng kiểu: `20260830070759_AddAppointmentOutcome` `DropTable` một bảng chưa từng
được tạo.

Vì vậy DB đã cài từ trước vẫn chạy tốt (bảng có từ trước lúc merge, migration đã
ghi vào `__EFMigrationsHistory`), còn **mọi lần cài mới đều chết** — kể cả CI và
test DB dùng một lần.

Cách sửa (giữ nguyên chuỗi migration, không squash):

- Trả lại hai `CreateTable` + 4 index vào `Up()` của `MergeConflictResolve`,
  lấy nguyên hình dạng từ designer snapshot của chính migration đó. Đặt ở đây
  chứ không tạo migration mới là có chủ đích: DB cũ đã ghi migration này nên bỏ
  qua, DB mới thì có bảng trước khi có ai `ALTER`.
- `DropTable("bd_visits")` → `Sql("DROP TABLE IF EXISTS bd_visits;")`, đúng cho
  cả hai phía.

Kiểm chứng: script replay toàn bộ 51 migration theo thứ tự, dựng tập bảng và soi
mọi thao tác trỏ vào bảng chưa tồn tại → sạch. Chạy thật trên DB rỗng:
51/51 migration, 101 bảng, seed đầy đủ (23 tài khoản, 60 `bd_care_records`,
32 `bd_labo_orders`), `Successfully completed all database migrations.`

Mức retest: **3** (đụng schema dùng chung). Chưa chạy lại bộ e2e — schema sau
migration khớp model như trước, thay đổi chỉ ảnh hưởng đường cài mới.

### 2026-09-06 — hồ sơ bệnh nhân: tag, lý do đến khám, ô Tạm ứng (F-?)

Khảo sát chỉ đọc trên staging (`/patient/<id>?branchId=…`, tài khoản chủ dự án
cấp) — chỉ mở popover/dialog và đo DOM + computed styles, không bấm Lưu ở bất
kỳ form nào. Ba lệch so với bản gốc, do chủ dự án chỉ ra:

| ID | Lệch | Sửa |
|---|---|---|
| R-180 | Bấm chọn tag không tích, cũng không hiện nhãn cạnh tên | Dấu ✓ (`CheckOutlined`) render ra `<span>` trần nên **trúng luôn** rule chip của hàng picker (`.pd-tag-options button > span`) — nền trắng, chữ trắng, có cả đệm 3/7px. Chip tách thành class riêng `.pd-tag-chip` (dùng chung cho picker và cạnh tên), rule cũ bỏ. Nhãn của hồ sơ nay vẽ cạnh tên theo thứ tự danh mục, cùng một hàng `flex-wrap` với tên + bút chì (6px ngang / 8px dọc, đúng bản gốc), nút picker ghim phải |
| R-181 | Lý do đến khám chỉ là một chuỗi, không ngày | Bản gốc trả mảng `{id,isRoot,createdAt,content,note}` và in mỗi dòng một ngày. Cột `bd_patients.ExaminationReason` chuyển sang bảng `bd_patient_examination_reasons` (migration `20260906000000_AddPatientExaminationReasons`, mang mọi giá trị cũ sang làm dòng gốc, ngày lấy từ `CreationTime` của hồ sơ). Thẻ in danh sách mới-trước, `grid 88px / 1fr`, gap 12px, ngày `#171c33` 500, nội dung `#e5484d` 600 — số đo lấy từ bản gốc. Nút **+** mở "Thêm lý do đến khám" (500px, ô trống) và **thêm** dòng qua `POST /api/v1/app/patients/{id}/examination-reasons`; dialog "Chỉnh sửa hồ sơ" vẫn sửa **đúng dòng gốc** tại chỗ, y như bản gốc |
| R-182 | Thiếu ô **Tạm ứng** | Hàng tiền lên 7 ô (`repeat(7, minmax(0,1fr))`, bản gốc `xl:grid-cols-7`). `payment.prepaid` đã có sẵn trên DTO và đã được BE cộng — chỉ thiếu ô |

Bẫy gặp phải, ghi để khỏi lặp:

- `Input.TextArea` + `showCount`: `className` rơi vào **affix wrapper**, không
  phải `<textarea>`. Rule cao 180px vẫn đúng, nhưng AntD zoom modal vào nên đo
  ngay lúc `toBeVisible()` đọc ra **36px** — assertion kích thước phải
  `expect.poll`. Đã sửa test cũ "the lý do đến khám box has room to write in".
- Lọc chip theo `hasText` là so **chuỗi con**: `"Chỉnh Nha"` nằm trong
  `"Tư Vấn Chỉnh Nha"`. Test so nguyên nhãn đã `trim()` (`chipLabels()`).
- `Patient` là aggregate có con mới → phải khai `DefaultWithDetailsFunc`
  (`.Include(x => x.ExaminationReasons)`) trong `BlueDentalEntityFrameworkCoreModule`,
  nếu không `GetAsync` đọc về danh sách rỗng rồi `UpdateAsync` ghi đè mất sạch.
- `Application.Contracts` không tham chiếu `Domain` → hằng độ dài phải nằm ở
  `Domain.Shared` (`PatientExaminationReasonConsts`).

Mức retest: **2** (BE + FE của một feature; `PatientDto` dùng chung với
Tiếp nhận nên soi thêm mức 3). Kết quả — bản build production `:8080` →
API `:5019` → PostgreSQL thật, không chặn API nào:

- BE: `Domain.Tests` lọc PatientManagement **18/18**, `EntityFrameworkCore.Tests`
  lọc PatientMapping **5/5**, migration chạy thật trên DB đang dùng.
- FE: `tsc --noEmit` sạch, `vite build` OK.
- `e2e/patient*.spec.ts`: **41/41** xanh (3 spec mới: danh sách lý do có ngày và
  sống qua reload; nhãn hiện cạnh tên và sống qua reload; 7 ô tiền, `Tạm ứng`
  khớp con số server trả). Test cũ đếm 6 ô tiền đã đổi thành 7.
- Mức 3: `branch-isolation` 5/5 xanh.

**Đỏ có sẵn, KHÔNG do đợt này** (đã kiểm: không file nào của đợt này dính tới):

- `reception.spec.ts` 2 test chờ `GET /api/v1/app/visits` — endpoint đó không
  còn tồn tại ở FE (`grep` cả `src/` không ra), selector cũ.
- `cskh.spec.ts` "creates a special care task" tìm combobox có chữ
  "Chọn khách hàng"; trong `CareCreateDialog` chuỗi đó là nhãn `MessageField`
  bọc ngoài, không nằm trong combobox — selector cũ sau đợt dựng lại CSKH.

Ảnh đối chiếu: `reference-private/survey/staging/patient-detail-2026-09-06/` —
`ref-patient-detail.png`, `ref-dh26003.png`, `ref-tag-dropdown.png`,
`ref-reason-dialog.png`, `ref-edit-patient.png` (staging) vs `local-after-1.png`,
`local-after-tick.png`, `local-reason-added.png`, `local-wide.png`, `local-final.png`.

Lệch còn lại, chưa sửa (ngoài phạm vi yêu cầu, ghi để chủ dự án quyết):

- Tên bệnh nhân: bản gốc `18px/700` **viết hoa** `#2671D8`; local `16px`, không
  viết hoa. Không đụng vì màn này đã được nghiệm thu ở kích thước hiện tại.
- Ô nhập "Thêm lý do đến khám": bản gốc cao 140px, local 180px (test cũ R-… đòi
  `> 140`).
- Hàng tiền dưới 1280px: bản gốc 2 cột, local 3 cột.

### 2026-09-06 (tiếp) — bảng điều trị, modal thanh toán, filter tag, chọn bác sĩ

Bốn lệch nữa chủ dự án chỉ ra sau đợt trước. Khảo sát chỉ đọc trên staging
(`/patient`, `/patient/6a93fcc4ffbf57994e7b54e4` — hồ sơ **có** dòng điều trị):
chỉ mở popover/dialog và đo DOM, không bấm Lưu ở form nào.

| ID | Lệch | Sửa |
|---|---|---|
| R-183 | Lý do đến khám chữ to hơn phần còn lại của cột | Bản gốc để 14px, nhưng **cả cột** của bản gốc lớn hơn ta một nấc (tiêu đề 16 so với 14, dòng fact 14 so với 13.5). Hạ xuống 13.5px/20 cho bằng dòng fact, cột ngày co 88 → **85px** để hai cột vẫn khít như bản gốc |
| R-184 | Filter "Phân loại theo Tag" vẽ chip màu | Chip đó là **bịa**, không quan sát được. Hai filter "Phân loại" của bản gốc là cùng một widget, giống nhau tới từng thẻ HTML: ô tìm kiếm trên các dòng chữ thuần. Bỏ hẳn hàm render chip khỏi `SearchSelect` (kéo theo filter tag ở Phân nhóm CSKH) và bỏ `color` khỏi `SearchSelectOption`; chip màu chỉ còn ở đúng chỗ đã thấy — picker tag của hồ sơ |
| R-185 | Thẻ "Lịch hẹn gần nhất" thiếu ô chọn bác sĩ | Bản gốc có combobox tìm kiếm **trong** khối Tiếp nhận, ngay dưới 3 bước: đổi bác sĩ của chính lịch hẹn đang hiện, không cần mở dialog. Thêm `AppointmentDoctorPicker`. Phải gửi **nguyên** lịch hẹn lên: `AppointmentAppService.UpdateAsync` dựng lại slot và `UpdateDetails(...)` từ request, gửi mỗi `doctorId` sẽ xoá sạch ghi chú/màu/giờ |
| R-186 | Bảng điều trị sai định dạng lẫn hành vi | Xem bảng đo đầy đủ trong `docs/clone/pages/patient-detail.md`. Trước: th viết hoa 11.5px, không kẻ ô, **9** cột (thiếu "Chăm sóc sau điều trị"), tên dịch vụ in **hai lần** (Dịch vụ và Nội dung điều trị), chữ thuần chỗ bản gốc gắn chip, `0/0` chỗ bản gốc để nút **+** xanh, và cây bút mở tab kế hoạch chỗ bản gốc mở modal thanh toán. Dựng lại đủ 10 cột, tách sang `treatmentColumns.tsx` |
| R-187 | Thao tác không mở modal thanh toán | `CreatePaymentDialog` — 1024px, hai cột, dựng theo bản gốc: NỘI DUNG THANH TOÁN · DỊCH VỤ có checkbox + chip "Còn nợ" + Chọn Tất Cả · TỔNG TIỀN THEO KẾ HOẠCH · Chia Tiền Tự Động/Thủ Công · Số tiền · Ghi chú 0/500 · PHƯƠNG THỨC THANH TOÁN · dòng nhắc 7 ngày + Lưu. Mỗi dòng dịch vụ là **một** `POST patient-payments` mang `treatmentServiceId`, nên "Còn nợ" của đúng dòng đó mới nhúc nhích chứ không chỉ tổng phiếu |

Việc kéo theo ở BE (`TreatmentServiceDto`): thêm `stageNotes` (Nội dung điều trị
= note của **công đoạn**, không phải tên dịch vụ), `paidAmount` /
`outstandingAmount` (đã thu / còn nợ **của riêng dòng**, chỉ tính phiếu có ghi
`TreatmentServiceId`), `afterCareStatus` (`CareStatus?` suy từ phiếu CSKH phủ
lên công đoạn của dòng — `CareRecord.StageIds` × `TreatmentStage.TreatmentServiceId`).

Chốt được nhờ đọc `GET /api/v1/patient-timeline`: **mỗi dòng của bảng bản gốc là
một công đoạn** (`type: "stage"`, `code: "STG24"`), không phải dòng dịch vụ.
Vì thế cột 3 là `note` của công đoạn, và `assistantStaffId` (Phụ tá) với
`subStaffId` (Bác sĩ hỗ trợ) là **hai** ô nhân sự khác nhau. Ta giữ một dòng =
một dịch vụ (dòng chưa tách công đoạn thì bảng theo công đoạn sẽ không hiện gì),
ghi rõ chỗ lệch trong page doc.

Bẫy gặp phải, ghi để khỏi lặp:

- Dòng cao lên ~81px thì `.pd-profile > .bd-cat-card` (đang `flex: 1` trong pane
  cao cố định) chỉ còn 240px → **cắt cụt dòng đầu tiên**. Cho card co theo nội
  dung, pane tự cuộn — đúng như bản gốc.
- `th` của app viết hoa 11.5px; bảng này phải override trong CSS của feature,
  y như tab Chăm sóc KH đã làm.
- `Ví momo` là phương thức thứ 5 của bản gốc, nhưng rollup tiền của chính bản
  gốc chỉ chia bốn (cash/banking/card/outstandingDebt) → giữ bốn, ghi vào
  `unknowns.md` thay vì thêm enum tạo ra một rổ mà báo cáo không cộng được.
- Dữ liệu seed có phiếu hoàn 18.5tr mà không có phiếu thu → `totalDue` của kế
  hoạch lớn hơn `totalPrice`. Không phải lỗi công thức (`totalDue = totalPrice −
  (paid − refund)`, đúng của bản gốc), là dữ liệu demo lệch.

Mức retest: **2** cho hồ sơ bệnh nhân, **3** cho `SearchSelect` (dùng chung).
Kết quả — bản build production `:8080` → API `:5019` → PostgreSQL thật:

- BE: `Domain.Tests` **250/250**, `Application.Tests` **516/516**,
  `EntityFrameworkCore.Tests` **51/51**.
- FE: `tsc --noEmit` sạch, `oxlint` 0 lỗi, `vite build` OK.
- `e2e/patient*.spec.ts` **50/50** xanh, gồm 4 spec mới: bảng đủ 10 cột đúng
  sentence case + chip + nút thanh toán; Thao tác → modal → thu tiền thật →
  "Còn nợ" của dòng giảm đúng và sống qua reload (+ chặn "chưa chọn dịch vụ");
  filter tag ra dòng chữ thuần; đổi bác sĩ trên thẻ lịch hẹn (PUT thật) sống
  qua reload.
- Mức 3: `treatment-plan` 4/4, `treatment-stage` 2/2, `branch-isolation` 5/5.

Hai đỏ có sẵn của `reception.spec.ts` và `cskh.spec.ts` (ghi ở mục trước) vẫn
nguyên, không liên quan đợt này.

Ảnh đối chiếu: `reference-private/survey/staging/patient-detail-2026-09-06/` —
`ref-hn8521.png`, `ref-payment-modal.png`, `ref-payment-list.png`,
`ref-appt-doctor-select.png`, `ref-tag-filter.png`, `ref-service-filter.png`,
`ref-patient-list.png` vs `local-table4.png`, `local-newpay.png`,
`local-paid.png`, `local-tagfilter.png`.

### 2026-09-06 (tiếp 2) — dialog công đoạn, và soi lại chi tiết modal thanh toán

Chủ dự án chỉ ra hai chỗ nữa: nút trong cột **Công đoạn** phải mở dialog thêm
công đoạn (chưa có), và modal thanh toán **chưa khớp chi tiết** với trang đích
(thiếu Ví momo, sai một số field). Soi lại chỉ đọc trên staging một hồ sơ trên staging —
mở dialog, đo DOM + computed styles, đổi tab / chọn thẻ dịch vụ / gõ số tiền để
đọc hành vi, **không bấm Lưu ở bất kỳ form nào**.

| ID | Lệch | Sửa |
|---|---|---|
| R-188 | Nút Công đoạn không mở gì | Bản gốc mở **"Chi tiết phiếu"** — modal `calc(100vw - 32px)`, thẻ nền `#F7FAFF` gồm dải 2 tab `THÊM CÔNG ĐOẠN ⟨n⟩` / `TIẾP TỤC CÔNG ĐOẠN ⟨n⟩` có badge đếm, hai nút `Thanh toán` (viền xanh lá) + `In lịch sử điều trị`, 4 tiêu đề cột `Chi tiết · Ngày - Nhân sự · Dịch vụ đã chọn · Nội dung điều trị`, và bảng `LỊCH SỬ ĐIỀU TRỊ` kẻ ô `190px 1fr 1.15fr .7fr .7fr` bên dưới. Dựng `TreatmentStageDialog` theo đúng số đo; chọn thẻ dịch vụ → hiện form (Ngày tạo/Dịch vụ **disabled**, Bác sĩ/Phụ tá/Bác sĩ hỗ trợ, chip răng, Nội dung điều trị) → Lưu gọi `POST treatment-stages` thật |
| R-189 | Modal thanh toán sai chi tiết | Đo lại từng phần: tiêu đề section 14px/600 **viết hoa** + icon xanh; hàng fact `150px / 1fr` gap 40, giá trị **canh trái** (trước canh phải), `Còn lại` 16px/700; header DỊCH VỤ có nút bật ô `Tìm dịch vụ`; dòng dịch vụ = checkbox · (tên / pill `Còn nợ` bo tròn / `Số lượng`) · số tiền bên phải; lỗi "Bạn cần chọn ít nhất 1 dịch vụ" hiện **ngay** khi chưa tích chứ không đợi bấm Lưu; hai chế độ chia tiền là **radio** 230×40 bo 8; `Số tiền thanh toán` và `Ghi chú` dùng nhãn nổi, đếm `0/500`; phương thức là **pill bo tròn** 12px/600 có badge icon tròn 24px. Bỏ ô "Số tiền của phiếu" (tôi tự bịa ở đợt trước) |
| R-190 | Thiếu **Ví momo** | Bản gốc có 5 phương thức. Thêm `PaymentMethodKind.EWallet = 5`; để tiền ví không rơi ra khỏi báo cáo, `PaymentStatSummaryDto` thêm `ByEWallet` / `RefundByEWallet` và `ClinicReportAppService` cộng thêm hai rổ đó. Nhãn cũng đổi về đúng chữ bản gốc: `Ngân hàng` (trước "Chuyển khoản"), `Dư nợ` (trước "Trừ quỹ khách") |
| R-191 | `Còn lại` là số tĩnh | Bản gốc tính **sống**: `còn lại của kế hoạch − số tiền đang nhập` (gõ 100.000 vào khoản còn nợ 409.091 → hiện ngay 309.091). `Đã thanh toán` phía trên vẫn là số đã lưu |
| R-192 | Chia Tiền Thủ Công không có ô riêng | Bản gốc thay ô tiền chung bằng **một dòng cho mỗi dịch vụ đã tích** ở cột phải, mỗi ô mồi sẵn số Còn nợ của dòng đó |

Việc kéo theo:

- `UploadPatientImageInput` thêm `treatmentStageId` (BE đã nhận sẵn từ trước),
  để nút "Tải ảnh" trong Lịch sử điều trị gắn ảnh vào đúng công đoạn.
- `useStageMutation` invalidate thêm namespace `patient-treatments`: bảng điều
  trị đọc số công đoạn và Nội dung điều trị từ rollup đó, không invalidate thì
  dòng phải reload mới đổi.

Bẫy gặp phải, ghi để khỏi lặp:

- Cột `Thao tác` ghim phải **đè lên** ô Công đoạn ở viewport hẹp → Playwright
  báo "intercepts pointer events". Spec phải cuộn ngang bảng trước khi bấm.
- Tab mặc định của dialog công đoạn không được `setState` một lần trong effect:
  danh sách công đoạn về **sau** khi dialog mở, nên tab phải **suy ra**
  (`chosenTab ?? …`) chứ không thì luôn rơi vào tab rỗng.
- `toHaveText` đọc text trong DOM, mà chữ hoa ở đây là `text-transform` — bản
  gốc cũng vậy. Assertion phải so text thường và kiểm `text-transform` riêng.
- Ô tiền của chế độ Tự động nằm trong `FloatingLabel` nên mất class; phải đặt
  lại class riêng cho spec bám vào (selector chung `input` trúng radio).

Mức retest: **2** cho hồ sơ bệnh nhân, **3** cho `PaymentMethodKind` (enum dùng
chung với Billing/Reporting). Kết quả — bản build production `:8080` → API
`:5019` → PostgreSQL thật:

- BE: `Domain.Tests` **250/250**, `Application.Tests` **516/516**,
  `EntityFrameworkCore.Tests` **51/51**.
- FE: `tsc --noEmit` sạch, `oxlint` 0 lỗi, `vite build` OK.
- e2e **67/67** xanh trên `patient*`, `treatment-plan`, `treatment-stage`,
  `report`, `branch-isolation`. Hai spec mới: modal thanh toán có đủ 5 phương
  thức + 5 tiêu đề section + 7 hàng fact, `Còn lại` giảm sống theo số nhập, Thủ
  công ra ô riêng mồi sẵn, `Tìm dịch vụ` là nút bật/tắt; nút Công đoạn mở
  "Chi tiết phiếu" đủ 2 tab / 2 lệnh / 4 tiêu đề cột / 5 cột lịch sử, thêm công
  đoạn thật (POST) rồi ghi chú của nó hiện lên đúng cột "Nội dung điều trị" của
  bảng phía sau.

**Đỏ có sẵn, KHÔNG do đợt này** — `finance.spec.ts` 2 test. Đã đọc code để
khẳng định chứ không đoán: `ReportPage` giữ tab bằng `useState("expense")` và
**không hề đọc `?tab=` từ URL**, nên `/report?tab=cashflow-v2` luôn mở tab đầu.
Hai đỏ của `reception.spec.ts` và `cskh.spec.ts` (ghi ở hai mục trước) cũng vẫn
nguyên.

Ảnh đối chiếu: `reference-private/survey/staging/patient-detail-2026-09-06/` —
`ref-stage-dialog.png`, `ref-stage-tab2.png`, `ref-stage-selected.png`,
`ref-pay-search.png`, `ref-pay-manual.png` vs `local-stage.png`,
`local-stage-added.png`, `local-newpay2.png`, `local-newpay-manual.png`.

### 2026-09-06 (tiếp 3) — đọc hợp đồng API từ bundle bản gốc, không ghi một byte nào

Chủ dự án cho phép thao tác thật trên staging rồi hoàn tác. Kiểm tra đường hoàn
tác **trước** khi ghi thì phát hiện hai chuyện, nên cuối cùng **không ghi gì**:

- Tài khoản khảo sát **không có ability `payment`** — `GET /v1/payment-v2` trả
  **403**. Dialog thanh toán của bản gốc có bấm Lưu cũng không lưu được.
- `treatmentStage` có `read, create, update, continue, complete, print` —
  **không có `delete`**. Một công đoạn tạo ra trên staging sẽ **không hoàn tác
  được** bằng tài khoản này.

Thay vào đó đọc **static asset** (rule 00 cho phép rõ ràng: "static assets") —
bundle Next.js chứa nguyên schema Joi và bảng endpoint. Thu được nhiều hơn hẳn
so với việc bấm Lưu, và không đụng vào dữ liệu ai.

| ID | Lệch | Sửa |
|---|---|---|
| R-193 | Thiếu hẳn field `paymentAccountId` | Schema bản gốc: `paymentAccountId` **bắt buộc khi** `paymentMethod` là `bank` hoặc `momo`. Chọn Ngân hàng / Ví momo mở một bảng chọn dưới hàng pill — Ngân hàng: `Chọn · Tên ngân hàng · Số tài khoản`; MoMo: `Chọn · Số điện thoại · Tên chủ tài khoản`. Đó chính là danh mục `PaymentAccount` (`/taxonomy/payment-method`) ta đã có. Thêm hook chung `usePaymentAccountOptions`, cột `PatientPayment.PaymentAccountId` (migration `20260906120000_AddPaymentAccountOnPatientPayment`) và guard trong aggregate |
| R-194 | Ô "Số tiền thanh toán" để trống | Bản gốc **mồi sẵn**: `outstanding-debt` → `min(dư nợ đang giữ, tổng đã chọn)`, còn lại → `tổng đã chọn`. Đã áp dụng đúng công thức |
| R-195 | Thông báo vượt quá sai chữ | Dùng đúng câu của bản gốc: "Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán" |
| R-196 | Công đoạn: note/răng không bắt buộc | Schema bản gốc bắt buộc `doctorId`, `selectedContent` (min 1) và `treatmentContent` (max 1000). Đã enforce cả ba |

Hợp đồng đọc được, ghi vào `docs/clone/pages/patient-detail.md`:

- **Thanh toán** — `/v1/payment-v2` có `create · update(PATCH) · void · finalize
  · export`; `void` chính là đường hoàn tác của bản gốc, và `status` chạy
  `pending → finalized`.
- **Công đoạn** — `/v1/patient-stages` có `create · update · continue ·
  re-examination · updateStatus · revertStatus · updateStageServiceItems`.
  "Thêm" và "Tiếp tục" là **hai** endpoint khác nhau (khớp với hai ability
  riêng). Payload lộ ra rằng *Phụ tá* là `subStaffId` còn *Bác sĩ hỗ trợ* là
  `assistantStaffId` — ngược với cảm giác từ tên gọi.
- `Danh sách công đoạn` là **checklist công đoạn của danh mục dịch vụ**
  (`stageServiceItems`), rỗng trên staging vì dịch vụ khảo sát không khai công
  đoạn nào.

**Một lệch còn mở** (đã đóng cùng ngày, xem mục R-197 bên dưới): bản gốc POST
**một** phiếu mang `treatmentServiceIds[]` (và `items[]` khi chia thủ công); ta
POST **một phiếu cho mỗi dòng** vì `RecordPatientPaymentDto` chỉ mang một
`treatmentServiceId`.

Mức retest: **3** (`PaymentMethodKind` + `PatientPayment` dùng chung với
Billing/Reporting). Kết quả — bản build production `:8080` → API `:5019` →
PostgreSQL thật:

- BE: Domain **250/250**, Application **516/516**, EF **51/51**.
- FE: `tsc` sạch, `oxlint` 0 lỗi.
- e2e **68/68** trên `patient*`, `treatment-plan`, `treatment-stage`, `report`,
  `branch-isolation`. Spec mới: Tiền mặt không đòi tài khoản; Ngân hàng ra đúng
  cột `Tên ngân hàng / Số tài khoản`, Ví momo ra `Số điện thoại / Tên chủ tài
  khoản`; bấm Lưu khi chưa chọn tài khoản bị chặn; chọn rồi thì POST đi kèm
  `method: 5` và `paymentAccountId`. Spec cũ bổ sung: ô tiền mồi sẵn đúng bằng
  Còn nợ của dòng, và `Còn lại` trừ sống theo số nhập.

**Đỏ có sẵn — đã kiểm bằng cách stash toàn bộ thay đổi, build lại rồi chạy**,
không phải đoán:

- `taxonomy.spec.ts` "a phone-width window scrolls the page" — **đỏ y hệt trên
  bản sạch**. Không phải do đợt này.
- `taxonomy.spec.ts` "reorders entries from the keyboard" — xanh khi chạy riêng
  cả trước lẫn sau thay đổi; chỉ đỏ khi chạy trong lô lớn vì spec khác trước đó
  đã đổi thứ tự cùng bộ dữ liệu. Phụ thuộc thứ tự, không phải hồi quy.
- `finance.spec.ts` 2 test và `reception.spec.ts` / `cskh.spec.ts` — như đã ghi
  ở các mục trước.

Ảnh đối chiếu: `reference-private/survey/staging/patient-detail-2026-09-06/` —
`ref-pay-bank.png` vs `local-pay-bank.png`, `local-pay-momo.png`.

## 2026-09-06 (chiều) — Một phiếu thu, nhiều dịch vụ

Lệch cuối cùng của "Tạo phiếu thanh toán" — mục còn mở ở đợt sáng — đã đóng.

| # | Defect | Fix |
|---|--------|-----|
| R-197 | Ta ghi **một phiếu cho mỗi dịch vụ**; bản gốc ghi **một phiếu mang nhiều dịch vụ**. Tiền vào giống nhau nhưng lịch sử thanh toán hiện N dòng chỗ bản gốc hiện 1 | `PatientPayment` có bảng con `PatientPaymentLine` — mỗi dòng là `(treatmentServiceId, amount)` — cùng cột `SplitMode` (`1` Tự động / `2` Thủ công). Bỏ `PatientPayment.TreatmentServiceId`. Migration `20260906140000_AddPatientPaymentLines` tạo bảng, backfill mỗi phiếu cũ thành một dòng rồi mới drop cột; phiếu hoàn tiền không ghi dịch vụ thì không có dòng nào |
| R-198 | Ai chia tiền: FE hay BE | Theo đúng bản gốc — **Tự động** chỉ gửi tổng, server rải từ dòng cũ nhất, chặn ở đúng số Còn nợ từng dòng; **Thủ công** gửi `items[]` và server lấy nguyên. Helper `splitAcross` bên FE bỏ hẳn: chỉ server biết mỗi dòng còn nợ bao nhiêu tại thời điểm ghi |
| R-199 | Bất biến của phiếu | Aggregate từ chối dòng bằng 0 và từ chối phiếu có tổng các dòng khác tổng phiếu (`BlueDental:Billing:0091`) — nếu không, "Còn nợ" từng dòng sẽ nói dối. Vượt quá số còn nợ vẫn báo đúng câu của bản gốc |
| R-200 | Rollup `paidAmount` đọc theo phiếu | Nay đọc theo **dòng phiếu**; hoàn tiền vẫn trừ đúng dòng của nó |

**Không ghi gì lên bản gốc.** Hợp đồng `create` lấy từ chính bundle JS của bản
gốc (tài sản tĩnh — rule 00 cho phép), không phải bằng cách gửi request. Hai chỗ
đáng ghi: tài khoản khảo sát **không có** ability `payment` (`GET /v1/payment-v2`
trả 403) nên dù được chủ dự án cho phép cũng không lưu được phiếu trên staging;
và `treatmentStage` có `create`/`continue`/`complete` nhưng **không có delete**,
nên một công đoạn tạo trên staging sẽ không hoàn lại được. Đó là lý do đợt này
xác minh bằng dữ liệu local chứ không bằng thao tác trên bản gốc.

**Ba spec đỏ sau khi đổi schema — nguyên nhân chung, không phải hồi quy**: dữ
liệu demo bây giờ có phiếu nhiều dòng, nên "dòng đầu bảng" không còn là "dòng
vừa bấm". Đã sửa cho spec độc lập với thứ tự:

- helper mở hồ sơ trả về luôn `serviceId` của dòng còn nợ, spec bấm đúng
  `tr[data-row-key]` đó thay vì `.first()`;
- `lineDue()` cộng các dòng **đang tích** thay vì đọc dòng đầu;
- spec một-phiếu-nhiều-dịch-vụ mở dialog trên đúng phiếu nó chọn (một bệnh nhân
  có thể có nhiều phiếu, dialog thì theo phiếu);
- đọc lại phiếu **theo id dịch vụ** chứ không theo thứ tự dòng — PostgreSQL trả
  các dòng con không có thứ tự, và điều cần khẳng định là *dịch vụ nào nhận bao
  nhiêu*, không phải chúng về theo thứ tự nào.

Mức retest: **3** (`PatientPayment` dùng chung với Billing/Reporting). Kết quả —
bản build production `:8080` → API `:5019` → PostgreSQL thật:

- BE: Domain **262/262**, Application **516/516**, EF **51/51**.
- FE: `tsc` sạch.
- e2e **49/49** trên `patient`, `patient-images`, `treatment-plan`,
  `treatment-stage`, `report`, `branch-isolation`.
- Spec mới "one receipt covers several services, split by the server": dựng một
  phiếu hai dòng bằng chính API của app, thu một phần, rồi khẳng định **một**
  request POST mang `treatmentServiceIds` đủ cả hai dịch vụ, `splitMode: 1`,
  không có `items`; đọc lại thì đúng **một** phiếu, dòng một trả hết, phần dư
  sang dòng hai, và `paidAmount` từng dịch vụ nhích đúng bằng phần của nó.

Ảnh: `reference-private/survey/staging/patient-detail-2026-09-06/local-pay-multi.png`.

## 2026-09-06 (tối) — "Chi tiết phiếu": rà từng nút, từng modal ẩn

Khảo sát lại toàn bộ dialog công đoạn trên staging, **chỉ đọc**: mở dialog, mở
các modal ẩn rồi đóng, đọc bốn request GET dialog tự gọi và đọc thẳng markup.
Không lưu bất cứ form nào — nút Lưu của "Đặt mới" và ô "Hoàn thành" không hề
được bấm.

| # | Defect | Fix |
|---|--------|-----|
| R-201 | Field trong form công đoạn **không kín cột** (ảnh chủ dự án gửi) | Bản gốc mọi control rộng đúng bằng cột — đo được **366px** ở khung nhìn 1600. Nguyên nhân: `Select` của AntD co theo nội dung. Thêm rule `width: 100%` cho `.floating-field`/`.ant-select`/`.ant-input`/textarea trong `.pd-stage-form` |
| R-202 | Form chỉ có 3 cột hoặc 1 cột | Bản gốc: 3 cột từ 1280, **2 cột** ở khoảng 1024–1279 với "Nội dung điều trị" trải hết hàng, 1 cột dưới 1024. Đã dựng đúng ba nấc |
| R-203 | "Răng" là chữ chạy dòng, "Hình ảnh: (Trống)" nằm cùng dòng | Bản gốc: nhãn ở trên, răng là **chip xanh đặc** (disabled, opacity .7); "Hình ảnh:" và "(Trống)" là **hai dòng** |
| R-204 | `Tải Ảnh` trong form bị disable | Bản gốc **không** disable — card form có input file riêng. Nay chọn ảnh trước, lưu công đoạn xong mới upload kèm `treatmentStageId` |
| R-205 | Nhãn "Nội dung điều trị *" | Bản gốc không có dấu sao (vẫn bắt buộc khi lưu). Bỏ dấu sao |
| R-206 | Lịch sử điều trị là bảng phẳng, ngày `dd/MM/yyyy` | Bản gốc **gộp theo ngày**: ô Ngày trải hết các công đoạn trong ngày (grid lồng grid `190px minmax(0,1fr)` rồi `1fr 1.15fr .7fr .7fr`), và in `d/M/yyyy` không đệm số 0 |
| R-207 | Ghi chú không sửa được | Bản gốc có **bút chì** góc phải, bấm là đổi ghi chú thành textarea tại chỗ với Hủy/Lưu. Nối vào `PUT /treatment-stages/{id}` |
| R-208 | Bác sĩ / Phụ tá / Bác sĩ hỗ trợ xếp ba dòng, luôn "(Trống)" | Bản gốc: cột {Bác sĩ, Bác sĩ hỗ trợ} rồi Phụ tá bên cạnh. Và **cả hai suất phụ đều được lưu**: `subStaffId`=Phụ tá, `assistantStaffId`=Bác sĩ hỗ trợ. Thêm cột `TreatmentStage.SubStaffId` (migration `20260906160000_AddStageSubStaff`) + `subStaffName`/`secondStaffName` trên DTO |
| R-209 | Ảnh của công đoạn không hiện | Bản gốc in ảnh thành ô **68px** trong cột "Dịch vụ & răng", có dải chú thích "Ảnh điều trị", bấm mở viewer (xoay ×2, lật ×2, zoom ±, đếm `n / m`) |
| R-210 | **In lịch sử điều trị** chỉ gọi `window.print()` | Bản gốc mở **modal thứ hai**: khối chi nhánh + khách hàng, bảng 6 cột, nút "In Phiếu"; kèm **tờ A4 ẩn** (tiêu đề canh giữa, "Ngày … tháng … năm …", hai ô ký "Người lập phiếu" / "Khách hàng"). Đã dựng cả hai |
| R-211 | **Thanh toán** mở modal thanh toán | Bản gốc **rời dialog**, điều hướng sang `/treatment-plan/{planId}?planTab=detail`. Ta đổi sang mở tab Kế hoạch điều trị |
| R-212 | **Tạo Labo** nhảy sang tab Labo | Bản gốc mở dialog **"Đặt mới"** ngay tại chỗ, mồi sẵn từ công đoạn. Đã dựng: `LaboOrder` thêm `ToothShade`/`Quantity`/`TreatmentServiceId`/`TreatmentStageId` (migration `20260906170000_AddLaboOrderTreatmentLink`), thêm `GET /labo-orders/next-code` sinh `LABO-yyyyMMddN` theo chi nhánh |
| R-213 | Ô "Công đoạn" của dòng **đã hoàn thành** vẫn bấm được | Picker của bản gốc đọc `status=created,inProgress,guarantee`, nên dòng đã xong hiện chip xám `briefcase-medical` không bấm được. Đã dựng `.pd-tr-nostage` |
| R-214 | Danh sách công đoạn lọc ở trình duyệt | Bản gốc lọc theo phiếu ở server (`patientTreatmentId`). Ta truyền `treatmentId` xuống `GET /treatment-stages` |

**Không ghi gì lên bản gốc.** Mở dialog/modal là thao tác đọc; hợp đồng lấy từ
markup và từ bốn GET dialog tự gọi. Ảnh và HTML đã lưu trong
`reference-private/survey/staging/stage-dialog-2026-09-06/` (không commit).

Mức retest: **3** (`TreatmentStage` dùng chung với Kế hoạch điều trị, và
`LaboOrder` với Labo). Kết quả — bản build production `:8080` → API `:5019` →
PostgreSQL thật:

- BE: Domain **264/264**, Application **516/516**, EF **51/51**.
- FE: `tsc` sạch.
- e2e **69/69** trên `patient`, `patient-images`, `treatment-plan`,
  `treatment-stage`, `labo`, `report`, `branch-isolation`.
- Sáu spec mới: form kín cột (đo 3 cột × 366px và cả bốn field bằng đúng bề
  rộng cột) và `Tải Ảnh` bật sẵn; bút chì sửa ghi chú → `PUT` thật → sống qua
  reload; "In lịch sử điều trị" ra đủ hai khối fact, 6 tiêu đề cột, "In Phiếu"
  và tờ A4 với hai ô ký; "Thanh toán" đóng dialog và đổi URL sang
  `tab=treatment-plan`; "Tạo Labo" mở "Đặt mới" với 4 ô khoá đã điền và số phiếu
  `LABO-…`; dòng đã hoàn thành không còn nút công đoạn.

**Chưa khớp, đã ghi vào unknowns**: `Danh sách công đoạn` (checklist của danh
mục dịch vụ) vẫn "(Trống)"; `Giờ nhận` của phiếu Labo thu nhưng không lưu; nút
chính vẫn màu chàm `--bd-primary` của BlueDental chứ không phải xanh `#2671D8`
của bản gốc (đó là màu thương hiệu của bản clone, dùng toàn hệ thống).

## 2026-09-06 (khuya) — Bảng điều trị là công đoạn, và "Đặt mới" dựng bằng field của source

Đợt rà thứ ba trên staging, vẫn **chỉ đọc**: đọc `GET /v1/patient-timeline`, đọc
`aria-disabled` trên từng dòng lịch sử, và đọc markup của "Đặt mới". Không lưu
form nào.

| # | Defect | Fix |
|---|--------|-----|
| R-215 | Bảng điều trị của ta là **một dòng cho mỗi dịch vụ**; bản gốc là **một dòng cho mỗi công đoạn** | `/v1/patient-timeline` trả các dòng `type: "stage"` — một dịch vụ làm 3 lần là 3 dòng. Thêm `buildTreatmentRows` ghép phiếu điều trị với danh sách công đoạn; mỗi dòng in ghi chú, răng và bộ ba bác sĩ của **chính công đoạn đó** |
| R-216 | Cột Ngày lặp lại ở mọi dòng | Bản gốc dùng `rowSpan`: một ô ngày trải hết các công đoạn trong ngày. Dựng bằng `onCell` của AntD, và tính lại span sau khi lọc (nếu không, ô ngày sẽ nuốt mất ngày kế tiếp) |
| R-217 | Ô "Công đoạn" hiện `đã xong/tổng` khi dòng có công đoạn | Con số của bản gốc là `completedStageCount/totalStageCount` của **checklist danh mục** (`stageServiceItems`) chứ không phải số công đoạn — ta không mô hình hoá cái đó, và bây giờ mỗi công đoạn đã là một dòng. Nên chỉ còn hai trạng thái: nút **+** xanh, hoặc chip xám khi dịch vụ đã kết thúc |
| R-218 | Thêm công đoạn mới nhưng công đoạn cũ vẫn thao tác được | Bản gốc đặt cờ `disabled` ngay trên dòng timeline: công đoạn **mới nhất** của một dịch vụ là `false`, mọi cái cũ hơn là `true`. Trong dialog, dòng cũ mang `aria-disabled="true"` + `pointer-events-none bg-[#F6F8FB]/60 opacity-50`, ô Hoàn thành bị disable, và **không có nút Tạo Labo**. Đã dựng đúng cả ba |
| R-219 | "Đặt mới" tự dựng field, không giống bản gốc | Dựng lại **bằng chính field component của source**: `SearchSelect` (hộp tìm kiếm trên danh sách dòng chữ thuần — đúng widget bản gốc dùng) đặt trong `FloatingLabel`, và `FloatingLabel` nay nhận `required` để in dấu sao đỏ **bên trong nhãn** như bản gốc. 11 field bắt buộc, đúng bằng số dấu sao của bản gốc |
| R-220 | Thứ tự và cách nhóm field sai | Theo đúng bản gốc: lưới 2 cột cho 4 ô khoá + Số phiếu Labo + cặp `Ngày gửi / Giờ gửi` (`minmax(0,1fr) 140px`) + Nhà cung cấp + cặp `Ngày nhận dự kiến / Giờ nhận`; rồi hai dải chip `Lựa chọn dịch vụ` / `Vật liệu` (pill viền đứt khi rỗng: "Không có dữ liệu" / "Chọn dịch vụ trước"); rồi hàng `Răng:*` có "Chọn tất cả"; rồi 2 cột {Màu răng, Số lượng, Khớp cắn} và {Đường hoàn tất, Kiểu nhịp}; rồi Nội dung; rồi **ô vuông 80px** Tải ảnh |

**Không ghi gì lên bản gốc.** Cờ `disabled` và cấu trúc timeline đọc từ chính
response của bản gốc; layout "Đặt mới" đọc từ markup sau khi mở dialog rồi đóng.

Mức retest: **3**. Kết quả — bản build production `:8080` → API `:5019` →
PostgreSQL thật:

- BE: Domain **264/264**, Application **516/516**, EF **51/51** (không đổi phía BE đợt này).
- FE: `tsc` sạch, `oxlint` không thêm cảnh báo mới.
- e2e **72/72** trên `patient`, `patient-images`, `treatment-plan`,
  `treatment-stage`, `labo`, `report`, `branch-isolation`.
- Ba spec mới: bảng ra đúng một dòng cho mỗi công đoạn và tổng `rowSpan` của các
  ô ngày bằng đúng số dòng (nếu lệch là mất ngày); chỉ **một** dòng lịch sử
  `aria-disabled="false"`, chỉ dòng đó có Tạo Labo, dòng cũ có `pointer-events:
  none` và ô tích bị disable; "Đặt mới" có 11 dấu sao đỏ trong nhãn, 4 `SearchSelect`,
  hai dải chip với pill rỗng, hàng răng "Chọn tất cả" và ô vuông Tải ảnh.

**Sửa hai spec cũ cho đúng cấu trúc mới**: `treatmentRow()` tìm theo tiền tố
`data-row-key` (một dịch vụ giờ có nhiều dòng), và spec "Tạo Labo" bỏ qua input
file ẩn khi lấy ô nhập đầu tiên.

## 2026-09-06 (đêm) — Bảo hành, tiếp nhận, tái khám

Đợt rà thứ tư trên staging, **chỉ đọc**: đọc `/v1/patient-timeline`, đọc tooltip
của ô Công đoạn, đọc markup của stepper Tiếp nhận và của "Tạo tái khám". Không
bấm bước tiếp nhận nào trên bản gốc (bấm là ghi), không lưu form nào.

| # | Defect | Fix |
|---|--------|-----|
| R-221 | Ta suy trạng thái ô Công đoạn từ **dòng dịch vụ** | Bản gốc suy từ **chính công đoạn** của dòng: ba công đoạn của một dịch vụ có thể hiện "Hoàn thành / Đang điều trị / Đang điều trị". Chip trạng thái và ô Công đoạn nay đọc `stageDone` của từng dòng |
| R-222 | Thêm công đoạn mới làm mất nút + của các công đoạn cũ | Sai — bản gốc chỉ mờ dòng cũ **trong dialog** (cờ `disabled`); ở bảng, mọi công đoạn **chưa hoàn thành** vẫn còn nút + và vẫn mở được Chi tiết phiếu. Đã tách hai chỗ ra |
| R-223 | Không có trạng thái **Bảo hành** | Công đoạn đã hoàn thành đổi ô Công đoạn thành nút hổ phách `bg-[#FFF4E5]/text-amber-600`; trong dialog, nút **Tạo Labo** đổi thành **Bảo hành** xanh lá |
| R-224 | Không phân biệt dịch vụ không có bảo hành | Bản gốc hiện chip xám `cursor-not-allowed` với tooltip **"Không bảo hành"** khi dịch vụ không khai kỳ bảo hành. `TreatmentServiceDto` thêm `WarrantyDays` đọc từ `CatalogServiceConfig`; seed demo nay có 5 dịch vụ có bảo hành và 3 dịch vụ không, để cả hai nhánh đều chạm được |
| R-225 | Thiếu dialog **"Tạo bảo hành"** | Dựng theo bản gốc, cùng bố cục với form công đoạn, footer **Đóng** / **Lưu bảo hành**. Ghi một công đoạn `isGuarantee: true` (cột mới `TreatmentStage.IsGuarantee`, migration `20260906180000_AddStageGuarantee`) — đúng cách bản gốc lưu, và cũng là cách bộ lọc "Bảo hành" tìm lại chúng |
| R-226 | Ba bước **Tiếp nhận** chỉ để đọc | Bản gốc là ba nút, **chỉ bước kế tiếp** bấm được, hai bước kia `disabled`. Nối vào `check-in` / `start` / `complete` của lịch hẹn; giờ hiện ra từ `CheckedInAt`/`StartedAt`/`CompletedAt` (DTO đã có sẵn, FE chưa đọc). Thêm `statusCode` thô lên view model vì từ vựng UI gộp CheckedIn vào "đang khám" |
| R-227 | **"Tạo tái khám"** luôn rỗng | Bản gốc liệt kê các công đoạn **đã hoàn thành**; mỗi dòng có ngày + nhân sự, dịch vụ + răng, ghi chú, ô Hoàn thành đã tích và khoá, **Tải Ảnh** mờ, **Tái Khám** và **Chi Tiết** |
| R-228 | Seed demo ghi phiếu ngân hàng không kèm tài khoản | Lỗi do chính đợt R-193 gây ra, chỉ lộ khi chạy migrator với `ASPNETCORE_ENVIRONMENT=Development`: aggregate từ chối phiếu bank/ví không có `paymentAccountId`. Seeder nay lấy tài khoản ngân hàng của chi nhánh, không có thì thu bằng tiền mặt |
| R-229 | Tab **Kế hoạch điều trị** không giống bản gốc | Dựng lại toàn bộ tab: toolbar `Tạo kế hoạch mới` / `Xem tất cả dịch vụ`, hai thẻ tóm tắt, bảng 14 cột với `Cột hiển thị` (bật/tắt, kéo sắp xếp, chỉ giữ trong bộ nhớ), tiền luôn có đơn vị `đ`, pill `Đã tạo` suy ra ở FE khi mọi dòng còn Created, các modal "Danh sách dịch vụ - DT", "Danh sách dịch vụ", "Chi tiết phiếu", "Hóa đơn". Màu primary của app theo yêu cầu chủ dự án |
| R-230 | Thiếu dialog **"Tạo phiếu dịch vụ"** và **"Chọn răng"** | Dialog tạo phiếu: ô tìm dịch vụ / nhóm dịch vụ dùng lại `PlanServicePicker` theo mẫu voucher, đơn giá / số lượng / giảm giá `%`·`đ`, bác sĩ, chẩn đoán, ghi chú, khối Thông tin thanh toán tự tính. Sơ đồ răng FDI 32 răng (20 răng sữa) với vòng 5 mặt, tab Hàm trên / Hàm dưới / Toàn hàm — tách thành `src/components/ToothChart` dùng chung |
| R-231 | Bảng tràn ngang ở màn ≤640px | Bảng phiếu và hai danh sách dịch vụ gập thành thẻ `RecordCard` (mẫu "Thêm đơn thuốc"): mã + pill, `Xem thêm` / `Rút gọn`, bốn nút thao tác, pager chung bên dưới |
| R-232 | Pager riêng của tab (Trước/Sau viền, "Hiển thị a–b trên n kế hoạch") | Chủ dự án yêu cầu "dùng pagination có sẵn": gỡ `planPager.tsx`, mọi bảng/thẻ dùng `useTablePagination.buildConfig` (`Hiển thị a-b/n`); spec kiểm tra theo định dạng đó |
| R-233 | Mục trong hai thẻ **Dịch vụ đang điều trị** / **Dịch vụ có công đoạn gần nhất** là ô xám, không hover | Đo lại trên staging: ô trắng viền `--tp-line` bo 8px, padding 8×12, cao 57.5px; tên dịch vụ 13/600, dòng hai mã phiếu xanh (500 + ngày 11px ở thẻ đang điều trị; 600 + ghi chú công đoạn mới nhất cắt `…` ở thẻ công đoạn) và `ChevronRight` 16px bên phải; hover nền `--tp-ground` (#F6F8FB như bản gốc). Bản gốc bấm mục thì sang trang chi tiết kế hoạch (chưa dựng) nên giữ con trỏ, không điều hướng. Mức retest 1: đo computed style trùng bản gốc trừ màu primary; spec `treatment-plan` chạy lại xanh |

Mức retest: **3**. Kết quả — bản build production `:8080` → API `:5019` →
PostgreSQL thật:

- BE: Domain **264/264**, Application **516/516**, EF **51/51**.
- FE: `tsc` sạch.
- e2e **78/78** trên `patient`, `patient-images`, `treatment-plan`,
  `treatment-stage`, `labo`, `report`, `branch-isolation`, `appointment`.
- Năm spec mới: tích Hoàn thành đổi Tạo Labo thành Bảo hành ngay trong dialog và
  đổi ô Công đoạn ngoài bảng thành chip hổ phách, cả hai mở cùng một form; hoàn
  thành **một** công đoạn không đóng các công đoạn còn lại (số nút + giảm đúng
  1, và vẫn bấm mở được); "Tạo Tái khám" liệt kê công đoạn đã hoàn thành với ô
  tích khoá + Tái Khám + Chi Tiết; bước Tiếp nhận chỉ cho bấm bước kế tiếp, bấm
  xong đóng dấu giờ và sống qua reload; dịch vụ không bảo hành thì công đoạn đã
  xong không hiện gì cả.

**Hai spec cũ phải sửa, không phải hồi quy**: "a finished line offers no công
đoạn" đổi tiền đề sang "công đoạn đã hoàn thành trên dịch vụ không bảo hành" và
tự dựng trạng thái đó; và `Còn lại` của dialog thanh toán nay đo bằng **hiệu**
giữa hai số nhập thay vì so với số mở đầu — con số đó chạm sàn 0 khi các dòng
đã chọn còn nợ nhiều hơn cả kế hoạch.

Ghi chú kỹ thuật cho spec: ô "Hoàn thành" do server điều khiển, nên
`locator.check()` của Playwright (đòi ô lật ngay khi bấm) luôn báo lỗi giả —
helper `finishLiveStage` bấm rồi chờ `POST …/complete`.

## 2026-09-07 — Khoá đăng nhập 10 lần, và ba thứ chặn deploy

Đợt này không đụng bản gốc. Bắt đầu từ một yêu cầu vận hành trên prod của
mình (`bluedental.bluestar.com.vn`): tài khoản `admin` bị khoá vì gõ sai mật
khẩu, và phòng khám muốn nới ngưỡng lên 10 lần, giữ thời gian khoá 5 phút.

Đo trạng thái cũ bằng chính sự cố đó, đọc `AbpAuditLogs` trên prod (chỉ đọc):
5 request `/api/account/login` lúc 04:21:13 → 04:22:05 rồi `LockoutEnd =
04:27:05`, tức **5 lần sai / khoá 300 giây** — đúng mặc định ABP, dự án chưa
từng cấu hình đè (không có dòng nào chạm `IdentityOptions`, bảng `AbpSettings`
rỗng phần `Abp.Identity.*`).

| # | Defect | Fix |
|---|--------|-----|
| R-229 | Ngưỡng khoá 5 lần là mặc định ABP, không ai chọn nó | `BlueDentalIdentitySettingDefinitionProvider` đè **default của chính setting ABP**: `Lockout.MaxFailedAccessAttempts = 10`, `Lockout.LockoutDuration = 300`. Không dùng `Configure<IdentityOptions>` — ABP đọc lockout từ Setting rồi ghi đè `IdentityOptions` mỗi request, set ở options sẽ bị nuốt. Đè ở tầng definition nên giá trị ghi qua Setting Management (bảng `AbpSettings`) vẫn thắng |
| R-230 | Màn login có nhánh "thử lại sau {0} phút" không bao giờ chạy | `LoginForm` đọc `result.lockoutMinutes`, nhưng `/api/account/login` là controller sẵn của ABP Account và `AbpLoginResult` chỉ có `result` + `description`. **Chưa sửa** — muốn hiện số phút còn lại thì phải override `AccountController`. Ghi lại để khỏi tưởng là lỗi hiển thị |
| R-231 | `ReceptionPage.test.tsx` đỏ, chặn CD ba lần liên tiếp | Hai lỗi cùng một chỗ: `jsdom` không cài `Element.scrollTo` nên effect cuộn tab đang chọn ném `container.scrollTo is not a function` và kéo sập cả render; và toolbar nay dựng ô tìm kiếm **hai** lần (inline cho màn rộng, block cho màn hẹp) nên `getByPlaceholderText` số ít thấy 2 phần tử. Stub `scrollTo`/`scrollIntoView` trong `src/test/setup.ts` — vá ở môi trường test, không bắt component nghi ngờ một hàm mọi browser đều có — và assert bằng `getAllByPlaceholderText` với đúng 2 ô |
| R-232 | `deploy.sh` chết ngay bước build: `service "api" has neither an image nor a build context` | Commit `eea8ffc` comment cả ba service `migrator` / `api` / `frontend` trong `docker-compose.yml` để compose chỉ dựng hạ tầng khi dev chạy `dotnet run` + `npm run dev`. Trên server thì `deploy.sh` build và start chúng **theo tên**. Khôi phục nguyên văn ba service, thêm comment chỉ cách chạy hạ tầng riêng (`docker compose up -d postgres redis minio clamav`). CI không thấy vì job build image đọc thẳng Dockerfile, không đọc file compose |
| R-233 | Migrator không compile **chỉ trên server**: `CS0234: 'Minio' does not exist in 'Volo.Abp.BlobStoring'` | Không có `.dockerignore`. Dockerfile restore NuGet trong image rồi mới `COPY . .`, mà server còn `bin/`, `obj/` từ **24/08** (root-owned, `git reset --hard` không xoá), nên `obj/project.assets.json` cũ đè lên kết quả restore mới và `dotnet publish --no-restore` build theo nó — trong khi csproj tham chiếu `Volo.Abp.BlobStoring.Minio` từ `eea8ffc`. Thêm `.dockerignore` cho BE (`**/bin/`, `**/obj/`, `appsettings.secrets.json`) và FE (`node_modules`, `dist`, ...). CI xanh suốt vì checkout của runner sạch |

Mức retest: **3** — lockout nằm ở tầng xác thực, dùng chung cho mọi màn.

Kết quả:

- BE: Domain **267/267** (3 test mới trong `Settings/IdentityLockoutSettingsTests`:
  10 lần, 300 giây, không vỡ khi thiếu setting), build Release sạch.
- FE: `oxlint` không thêm cảnh báo mới, `tsc -b` sạch, Vitest **3/3**,
  `vite build` xanh.
- CD [34085952529](https://github.com/minhhung19872002/BlueDental/actions/runs/34085952529)
  xanh cả bốn job, deploy + smoke test qua. Prod chạy `5b847fb` (trước đó
  đứng ở `1558c26` từ 03/09 vì R-232 và R-233).

**Kiểm chứng runtime trên prod**, 10 request thật vào
`https://bluedental.bluestar.com.vn/api/account/login` với mật khẩu cố tình sai:

```
lần 1..9  -> {"result":2,"description":"InvalidUserNameOrPassword"}
lần 10    -> {"result":4,"description":"LockedOut"}

LockoutEnd = 2026-09-07 05:25:11 UTC
now        = 2026-09-07 05:20:18 UTC     → đúng 300 giây
```

Đo xong xoá lockout ngay (`LockoutEnd = NULL`, `AccessFailedCount = 0`), `admin`
đăng nhập lại được bình thường.

Chưa có spec giữ hành vi này: e2e mà khoá tài khoản thật sẽ làm hỏng các spec
chạy song song, nên bằng chứng runtime nằm ở đợt đo trên, còn `IdentityLockoutSettingsTests`
giữ phần con số khỏi trôi khi nâng cấp gói ABP.

## 2026-09-07 (chiều) — Trang chi tiết kế hoạch điều trị (F-39)

Trang `/patient/:id/treatment-plan/:planId` dựng mới theo **production**
(khảo sát chỉ đọc: mở dialog Tạo phiếu thanh toán / Hoàn tiền / In hóa đơn tổng
rồi đóng, không bấm Lưu), chỉ FE theo quyết định của chủ dự án. Các lệch tìm
thấy khi so ảnh chụp bản gốc với bản local ở 1440 và 640, sửa cùng ngày. Số
R- tiếp theo số cuối của mục trên (mục "Khoá đăng nhập" và mục "Kế hoạch điều
trị" cùng ngày đều dùng đến R-233).

| ID | Defect | Fix |
|----|--------|-----|
| R-234 | Bốn tab của trang dựng bằng tab gạch chân, bản gốc là **pill xám** | `.pdt-tab`: padding 8×16, 14/500, nền `--tp-ground`, pill đang chọn nền primary chữ trắng; hover của pill đang chọn giữ nền primary (trước đó rule hover chung đè, chữ trắng trên nền nhạt). Xuống 640 các pill xuống dòng |
| R-235 | Tab Thanh toán / Hoàn tiền đặt nút tạo bên phải | Bản gốc: `Tạo Phiếu Thanh Toán` / `Hoàn Tiền` bên **trái**, `In hóa đơn tổng` bên phải — `.pdt-toolbar` thay cho toolbar canh phải |
| R-236 | Dialog phiếu thu là một tờ hoá đơn tự bịa (số tiền bằng chữ, chữ ký) | Dựng lại **"Chi tiết phiếu"** đúng bản gốc: hai khối CHI TIẾT PHIẾU (Mã thanh toán / Ngày tạo / Phương thức / Ghi chú) và THÔNG TIN KHÁCH HÀNG (Mã KH / Khách hàng / SĐT / Địa chỉ / Ngày sinh), bảng CHI TIẾT DỊCH VỤ 7 cột có pager riêng, khối TỔNG THANH TOÁN DỊCH VỤ 380px canh phải (Tổng phí / Giảm giá / Đã trả trước đó / Số tiền TT / Tổng còn nợ đỏ), footer chỉ còn `In Hoá Đơn`. Bản tổng hợp in `Mã thanh toán: Tổng hợp`, `Ngày d tháng m năm y`, ba tổng Doanh thu dự kiến / Đã thanh toán / Công nợ. `receiptView.ts` viết lại thành `ReceiptView { code, createdLabel, methodLabel, note, lines, totals }`; xoá `utils/moneyWords.ts` |
| R-237 | Cột Chẩn đoán của bảng dịch vụ trong phiếu để trống | Tra `sourceAdviseId` của dòng vào danh sách `patient-advises` (`usePatientAdvises`) — dialog nhận `advises` từ tab |
| R-238 | Dialog Hoàn tiền xếp field theo lưới 3 cột, ô Nội dung một dòng | Bản gốc: Loại / Hình thức / (tài khoản) / Ngày tạo **xếp dọc bên trái**, Nội dung là textarea cao 152px bên phải có `0/500`. Textarea của antd `showCount` bọc trong affix wrapper nên vẫn cao 40px — wrapper `flex: 1 1 auto; align-items: stretch`, `textarea { min-height: 152px }`. Ngày tạo là Input disabled có icon lịch; footer chỉ còn `Lưu` |
| R-239 | Bảng hoàn tiền: thiếu cột **Đã thanh toán**, không pager, placeholder sai | Thêm cột, `useTablePagination(20)` + `Pagination` dùng chung, placeholder "Nhập số tiền hoàn", `Tổng tiền trả:` canh phải chữ primary đậm cách 40px |
| R-240 | **Trừ hoàn tiền hai lần**: ô nhập bị chặn ở `paidAmount − refunded` | `TreatmentServiceDto.paidAmount` đã **trừ sẵn** hoàn tiền (BE ghi dòng hoàn âm). `useRefundForm`: `refundable = max(0, paidAmount)`, cột Đã thanh toán hiện tổng thu gộp `paidAmount + refunded`; dòng chỉ hiện khi tổng thu gộp > 0. Spec: hoàn 500.000 trên dòng đã thu 1.500.000 → `Đã hoàn` nhích, `Đã thanh toán` giảm |
| R-241 | Mã phiếu / số tiền in đậm trong bảng Thanh toán, Hoàn tiền; Dư nợ có cột Ghi chú và ô in đậm | Bản gốc mọi ô chữ thường, chỉ Thành tiền của bảng dịch vụ đậm; Dư nợ 8 cột không Ghi chú, bề rộng cột rút để cột Tổng tiền không trôi ra ngoài khung |
| R-242 | Bảng Chi tiết mặc định 20 dòng, đầu thẻ 640 in tên dịch vụ / mã phiếu | Bản gốc 10 / trang cho bảng dịch vụ (20 cho ba tab kia); đầu `RecordCard` chỉ in **số thứ tự** của dòng (`skipCount + vị trí + 1`), bỏ prop `unit` thừa (`TS6133`) |
| R-244 | Dialog Hoàn tiền: `Hình thức` liệt kê bốn kênh thu tiền và bắt chọn **tài khoản** ngân hàng / ví khi chọn Ngân hàng / Ví momo | Chủ dự án gửi ảnh bản gốc: đúng **ba** lựa chọn `Tiền mặt` / `Chuyển khoản` / `Quẹt thẻ` (có icon kính lúp), chỉ để ghi kênh, **không** chọn tài khoản. FE: `REFUND_METHODS` + `refundMethodLabels` riêng trong `useRefundForm.ts`, bỏ hẳn state / picker tài khoản; `Ngày tạo` in `d/M/yyyy` (`formatShortDate`) như bản gốc. BE: guard `PaymentAccountRequired` trong `PatientPayment.Record` chỉ áp cho tiền **vào** (`kind != Refund`) — trước đó một phiếu hoàn "Chuyển khoản" không có tài khoản sẽ bị từ chối `BlueDental:Billing:0090`. Test domain mới: hoàn tiền ngân hàng lưu `PaymentAccountId = null`, `SignedAmount` âm. Spec chọn Chuyển khoản, khẳng định không có ô "Tài khoản…", POST thật qua |
| R-245 | Bảng trong dialog Hoàn tiền: tiêu đề cột canh trái, số bên dưới canh phải nên lệch nhau; ô nhập 160px canh phải dưới tiêu đề canh trái | `.pdt-refund-table th { text-align: left }` (0,1,1) thắng `.pdt-num` (0,1,0) — thêm `.pdt-refund-table th.pdt-num { text-align: right }`; cột cuối bỏ `pdt-num`, rộng 250px, ô nhập `width: 100%` nên tiêu đề "Nhập số tiền hoàn" nằm đúng mép trái của ô, như bản gốc |
| R-248 | Icon máy in ở toolbar tab Chi tiết **tải file PDF** của kế hoạch — bản gốc mở modal **"Chi tiết phiếu"** của phiếu (Thông tin chi nhánh: Phòng khám / Địa chỉ / ĐT / Email; Thông tin khách hàng: Mã KH / Họ và tên; bảng Chi tiết dịch vụ 20/trang; Tổng phí / Đã trả trước đó / Tổng còn nợ; nút `In Phiếu`) | Thêm `PlanSlipDialog.tsx` + `slipView.ts`; `PlanServicesTab` mở dialog thay vì `downloadFile(planPdfUrl)`. Tách `ReceiptFacts` / `ReceiptTotals` (`ReceiptParts.tsx`) và `printSheet.ts` dùng chung với "Chi tiết phiếu" của phiếu thu. Spec 1 mở dialog, kiểm tra 4 tiêu đề, tên phòng khám, một dòng, ba dòng tổng và không có sự kiện download |
| R-249 | `In Phiếu` phải in tờ **PHIẾU ĐIỀU TRỊ** (phòng khám trái, tiêu đề + ngày giữa, Mã KH / Họ và tên phải, bảng kẻ ô Dịch vụ / Trạng thái / Bác sĩ / Đơn giá `x SL` / Thành tiền, tổng bên phải, hai ô ký *(Ký, họ tên)*); bản in còn header/footer trình duyệt (giờ, tiêu đề tab, URL, số trang) | Thêm `PlanSlipSheet.tsx` ẩn trong modal, class `pdt-print-dialog` / `pdt-screen` dùng chung cho hai dialog in; `@page { margin: 0 }` trong `@media print` để trình duyệt không in header/footer, tờ tự chừa lề 12mm/15mm |
| R-246 | Dialog "Tạo phiếu thanh toán" mở từ trang chi tiết kế hoạch **không có style** (nhãn dính giá trị, nút phương thức thành text) | CSS `.pd-newpay-*` nằm trong `patient-detail.css`, chỉ `PatientProfilePage` import; route `/treatment-plan/:planId` lazy-load không kéo file đó. `CreatePaymentDialog.tsx` nay `import "./patient-detail.css"` (cùng tiền lệ `PatientProfileDialogs.tsx`, `PatientEditorDialog.tsx`) nên dialog dùng chung đủ style ở mọi route |
| R-247 | `In Hoá Đơn` in **cả modal "Chi tiết phiếu"** (bảng dịch vụ, tổng) — bản gốc in tờ **BIÊN LAI THU TIỀN** A4 (letterhead phòng khám, tiêu đề, Ngày / Nhân viên, Khách hàng / ĐT / Địa chỉ, Thành tiền / Số tiền bằng chữ / Phương thức TT / Dịch vụ / Nội dung TT, hai ô ký) | Thêm `ReceiptSheet.tsx` nằm ẩn trong modal, `@media print` với `html.pdt-printing` chỉ hiện tờ này (ẩn `.pdt-receipt`, mask, header, footer; nền body trắng). `ReceiptView` thêm `sheetDateLabel` / `staffName` / `amount`; `utils/moneyWords.ts` đọc số thành chữ (`300000` → `Ba trăm nghìn đồng`, khớp bản gốc). Letterhead lấy từ `useBranchInfo(branchId)` (đã có cho "In lịch sử điều trị"). Spec 2 kiểm tra tờ ẩn có tiêu đề, tên phòng khám, dòng tiền bằng chữ và hai ô ký |
| R-243 | Tab Kế hoạch điều trị: mã DT và mục trong hai thẻ tóm tắt không điều hướng | Nối `planColumns.tsx`, `PlanSummaryCards.tsx`, `PlanCardList.tsx` sang route mới `patient/:id/treatment-plan/:planId` (lazy trong `router.tsx`); mục unknowns "In bệnh án / mã phiếu" cập nhật |

Mức retest: **2** (một feature) + `treatment-plan.spec.ts` vì link của tab
đổi. Bản build production `vite preview --strictPort` cổng **8093** (cổng 8080
đang thuộc một checkout khác), API `:5000`, PostgreSQL thật, không `page.route`:

- `e2e/treatment-plan-detail.spec.ts` **6/6** (44s; chạy lại **6/6**, 53s, sau
  R-244/R-245 trên API build lại — `PatientPaymentTests` **13/13**; **6/6**, 42s, sau R-246/R-247; **6/6**, 43s, sau R-248/R-249): tạo phiếu → link → trang;
  thu tiền → phiếu `Hoàn tất` + "Chi tiết phiếu" + bản tổng hợp; hoàn tiền →
  dòng hoàn + `Đã hoàn` nhích; reload giữ `planTab`, Dư nợ trống, Hoàn thành
  sống qua reload; 640 gập thẻ; tài khoản chi nhánh 2 bị từ chối.
- `e2e/treatment-plan.spec.ts` chạy lại xanh.
- `tsc --noEmit -p tsconfig.app.json` sạch, `oxlint` không cảnh báo mới,
  `vite build` xanh.

Giới hạn còn lại (ghi ở `docs/clone/unknowns.md`): `Thêm dịch vụ mới` và
`Chuyển đổi` dừng ở toast; server từ chối hoàn tiền trên dòng đã thu đủ
(`Manual` item phải ≤ Còn nợ) — muốn cho phép thì phải sửa guard ở BE, ngoài
phạm vi đợt FE-only này. Chưa commit theo yêu cầu.

## 2026-09-07 (tối) — Chi tiết kế hoạch: đơn thuốc mất CSS, thẻ hoàn tiền dưới 640

Chủ dự án chỉ ba lệch trên trang chi tiết kế hoạch (F-39), kèm ảnh bản gốc
của dialog "Hoàn tiền" ở khổ hẹp.

| # | Lệch | Sửa |
|---|---|---|
| R-248 | Modal **"Thêm đơn thuốc"** mở từ nút `Tạo Đơn Thuốc` mất hết style (khối bệnh nhân, lưới hai cột, padding header/footer) — `prescription.css` chỉ được import ở `PrescriptionPanel`, còn `PlanServicesTab` gọi thẳng `PrescriptionDialog` | `PrescriptionDialog.tsx` tự import `./prescription.css` (như `InvoiceModal`), nên mọi nơi dùng dialog đều có style; toàn bộ rule đã scope `.rx-*` |
| R-249 | Dialog **Hoàn tiền** dưới 640px gập bảng bằng CSS `td::before`, thiếu đầu thẻ số thứ tự và nếp "Xem thêm" như bản gốc; ô "Nhập số tiền hoàn" chỉ 140px | `RefundLinesTable` đổi sang `RefundLineCards` khi `(max-width: 640px)`: `RecordCard` dùng chung, số thứ tự trên đầu, 4 hàng đầu hiện sẵn, `Đã hoàn` + ô tiền sau "Xem thêm"; `RecordCardRow` thêm `stacked` (nhãn trên, control trải hết bề rộng thẻ — `.bd-rc-row--stacked`); pager `tp-card-pager` như các tab khác. Bỏ khối CSS gập bảng và `data-label` không còn dùng |
| R-250 | Ô **Nội dung** ở khổ hẹp cao đúng 40px (một dòng) — rule `.ant-modal.tp-dialog .ant-input-affix-wrapper { height: 40px }` thắng `min-height` của textarea khi form còn một cột | `.ant-modal.tp-dialog .pdt-refund-note .ant-input-affix-wrapper { height: auto; min-height: 152px }`; ở hai cột vẫn kéo bằng cột trái |

Mức retest: **2** (R-248 chỉ import CSS — Level 1; R-249 chạm `RecordCard`
dùng chung nhưng chỉ thêm prop tuỳ chọn, các thẻ hiện có không đổi markup).
Bản build production `vite build --outDir` riêng + `vite preview --strictPort`
cổng **8097** (8080 và 8093 đang thuộc checkout khác; preview chỉ lắng nghe
IPv6 nên `E2E_BASE_URL=http://localhost:8097`), API `:5000`, PostgreSQL thật:

- `e2e/treatment-plan-detail.spec.ts` **6/6**, 41s. Test 640 mở thêm dialog
  Hoàn tiền: không còn `.pdt-refund-table`, thẻ đầu tiêu đề `1`, pager
  "Hiển thị 1–1 trên 1 dịch vụ", ô Nội dung ≥ 120px, sau "Xem thêm" ô tiền
  rộng bằng thân thẻ (đo 536/536 ở 600px).
- Đơn thuốc: đăng nhập thật ở dev :5185, mở đúng URL kế hoạch, `Tạo Đơn Thuốc`
  → `.rx-grid` là `display: grid`, gap `24px 20px`, body `24px 24px 4px`.
- `tsc --noEmit -p tsconfig.app.json` sạch, eslint sạch. Chưa commit.

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-251 | Tabs, dãy số tiền, toolbar và bảng nằm rời trên nền xám; bản gốc bọc cả ba trong một khối trắng (`rounded-xl border border-[#DCE3EE] bg-white p-4`, cách breadcrumb 16px) ở cả bốn tab và cả khổ 640 | `TreatmentPlanDetailPage` bọc `PlanDetailHead` + pane đang mở trong `<section class="pdt-body">`; CSS: viền `--tp-line`, bo 12px, padding 16px, cột gap 16px. Test đầu của spec kiểm tra tablist, `.pdt-toolbar`, `.tp-table` cùng nằm trong `.pdt-body` và `border-radius` 12px |

Retest R-251: Level 1 (chỉ bọc thêm một khối, không đổi hành vi). Build
production riêng, `vite preview` cổng **8098**, API `:5000`:
`e2e/treatment-plan-detail.spec.ts` **6/6**, 44s; tsc + eslint sạch. Chưa
commit; chưa chụp ảnh đối chiếu (chủ dự án xác nhận bằng mắt).

---

## 2026-09-07 — Chạy lại đủ bộ sau bàn giao, và soi "Đặt mới" trên staging

Đợt này làm nốt hai việc còn treo trong `save/patient-detail-handoff.md`:
chạy lại **cả** bộ test sau ba lần chỉnh spec cuối, và **soi mắt thường** modal
"Đặt mới". Chủ dự án đưa tài khoản staging và yêu cầu mở bản gốc lên đo.

Bản gốc vẫn **chỉ đọc**: đăng nhập, mở trang, mở dialog, đọc `getComputedStyle`
và `getBoundingClientRect`. **Không** đính file vào form Labo của bản gốc —
chọn file có thể kích hoạt upload ngay, mà `.claude/rules/00-reference-readonly.md`
cấm ghi. Không lưu form nào, không bấm bước tiếp nhận nào.

### Chạy lại đủ bộ đã lộ 4 spec đỏ

Lần chạy đầy đủ trước ghi "78/78". Chạy lại trên máy sạch: **79 pass, 4 fail,
1 skip**. Bốn spec đỏ chia làm hai loại — không cái nào là lỗi ứng dụng:

| # | Spec | Nguyên nhân |
|---|------|-------------|
| R-229 | `the payment dialog carries the reference's fields, momo included` | **Lỗi spec.** `Còn lại` = `planDue − total`, đường thẳng, **có** xuống số âm. Hàm đọc số của spec dùng `replace(/[^\d]/g, "")` nên **ăn mất dấu trừ**: gõ 100.000 khi kế hoạch chỉ còn nợ 80.000 in ra `-20.000 đ` mà spec đọc thành `20000`, nên phép hiệu sai. Đo được: `Tổng tiền 5.180.000 − Đã thanh toán 5.100.000 = 80.000`. Đã cho hàm đọc **giữ dấu**; và sửa luôn lời chú thích cũ nói "chạm sàn 0" — code không hề kẹp sàn |
| R-230 | `the appointment card reassigns its doctor without opening the editor` | **Lỗi spec.** PUT trả **409 `BlueDental:Appointment:0002`** — "Khung giờ này đã có lịch". Spec chọn bác sĩ **đầu bảng chữ cái** khác người đang giữ lịch, mà người đó (`BS. Lê Thu Hà`) đã có lịch trùng đúng khung giờ ấy. Máy chủ chặn là **đúng**. Spec nay tự dựng tập bác sĩ **rảnh** theo đúng luật của `AppointmentConflictChecker`: cùng bác sĩ, khác phiếu, trạng thái không phải Cancelled(6)/NoShow(7), và hai khung giờ giao nhau |
| R-231 | `the treatment table is one row per công đoạn, grouped by day` · `finishing a công đoạn swaps its action for Bảo hành` | **Nhiễm dữ liệu giữa các spec** — chạy riêng thì **xanh**, chạy cả bộ thì đỏ. `openPatientWithTreatment(page, "warrantable")` chỉ lọc `warrantyDays > 0`, **không** lọc trạng thái dòng, nên bắt phải dòng mà spec trước đã đẩy sang Hoàn thành — dòng đó không còn ô Công đoạn nào để với tới. Nay đòi thêm `status ∈ {1,2}` như nhánh `stageable` |

### Soi bản gốc: nhãn field, và ô Tải ảnh

Đo trên form đăng nhập (an toàn tuyệt đối) rồi đo lại trong chính modal
"Đặt mới". Bản gốc dùng **một** màu slate cho nhãn, đổi **alpha** theo trạng thái:

| Trạng thái nhãn | Bản gốc | Ta (trước) | Ta (sau) |
|---|---|---|---|
| Nằm trong ô (chưa nổi) | `rgba(90,107,130,.8)` 14px/500 | `#99a0bd` 14px | **khớp** |
| Đã nổi, ô sống | `rgb(90,107,130)` | `--bd-muted #5c6484` | **khớp** |
| Đã nổi, ô khoá | `rgba(90,107,130,.5)` trên nền `#F6F8FB` | `opacity:.5` | khớp (đã đúng) |
| Đang focus | `#2671D8` | `--bd-link #2671d8` | khớp (đã đúng) |

`#5a6b82` đúng là màu tab Hình ảnh đã đo từ trước (`--pi-muted`) — hai đợt khảo
sát độc lập ra cùng một con số.

| # | Defect | Fix |
|---|--------|-----|
| R-232 | Nhãn field trong hai dialog lệch màu | Gom về **một** channel triple `--pd-field-label: 90 107 130` dùng cho cả ba trạng thái, thay vì bẻ token `--bd-muted` (đọc bluer hơn bản gốc) |
| R-233 | Ô **Tải ảnh** xám, hover không đổ nền | Bản gốc: 80×80, `border-dashed #B9C4D4`, chữ **xanh `#2671D8`** 14px/500, hover đổ nền `#E7F0FB` — đúng cách nút Tải ảnh của tab Hình ảnh đã dựng. Đã đổi theo |
| R-234 | Pill viền đứt dùng `--bd-border #e7eaf6` | Bản gốc `#DCE3EE`, chữ `#5A6B82`. Và bản gốc **canh giữa** pill rỗng trên cả dải; ta canh trái. Đã sửa cả hai (chỉ canh giữa lúc rỗng — có chip thì vẫn canh trái) |
| R-235 | Dialog rộng **880px** | Bản gốc **772px**: nội dung 718px, hai cột 349px ở x=24 / x=393, khoảng cách **20px** cả hai chiều, ô cao 40px, bước hàng 60px. Cặp ngày/giờ trong một cột là 193px + 16px + 140px. Đã đổi `width={772}` và `gap: 20px`; đo lại local lệch **1–4px** ở mọi mục |
| R-236 | **`.pd-labo-grid` khai hai lần trong cùng một file** — dòng 1316 ba cột, dòng 3248 hai cột | Bản sau **đè** bản trước, nên dialog "Tạo phiếu Labo" (`PatientRecordDialogs`, rộng 1180px, có `.pd-labo-wide` trải hết hàng) bị bóp còn hai cột. Đây là hồi quy do chính đợt "Đặt mới" gây ra. Đã **thu hẹp** rule mới thành `.pd-labo-dialog .pd-labo-grid` để trả lại ba cột cho dialog kia |
| R-237 | Ảnh nháp tạo blob URL **mỗi lần render**, không bao giờ `revoke` | `URL.createObjectURL(file)` gọi thẳng trong JSX: mỗi ký tự gõ vào ô Nội dung sinh thêm một URL cho **mỗi** ảnh nháp và giữ luôn. Nay `useMemo` theo danh sách file + cleanup `revokeObjectURL` |

### Vẫn chưa quan sát được

- **Ảnh nháp của bản gốc**: `UNKNOWN_REFERENCE_BEHAVIOR`. Vào trạng thái đó
  buộc phải đính file vào form production; và **cả 20 phiếu Labo** trên staging
  đều rỗng ô "File Labo gửi về", nên cũng không đọc ngược được từ form đã lưu.
  Ta cho ảnh nháp **80×80** cho bằng ô Tải ảnh ngay bên cạnh (số đo thật), thay
  cho 160px vốn là con số tự đặt. Đây là **giả định**, đã ghi vào `unknowns.md`.
- **Kính lúp** cạnh nhãn `Lựa chọn dịch vụ*` / `Vật liệu*`: bản gốc có, mở
  popover "Tìm dịch vụ" (đã ghi ở `pages/patient-detail.md` mục 989). Clone
  **chưa dựng** — ghi nhận, chưa làm.
- **Ô Công đoạn khi dòng dịch vụ ở trạng thái "Chuyển đổi"**: bản gốc vẫn vẽ
  nút `+` nhưng **disabled** (`bg #F6F8FB`, chữ `#98A2B3`, `opacity .5`,
  `cursor-not-allowed`, có tooltip). Ta không có nhánh này — dòng như vậy vẫn
  hiện `+` bấm được. Ghi nhận, chưa làm.

### Xác nhận ngược lại — những chỗ đã dựng đúng

Đo trên staging (bệnh nhân `HN8516`, 4 dòng điều trị) khẳng định lại:

- **Một dòng cho mỗi công đoạn**, ô Ngày `rowSpan` trải hết ngày ✓
- Ô Công đoạn: `Đang điều trị` → `+` `bg #E6F8EE` / `#12A960` 32×32 tròn 18px/600 ✓ ·
  `Hoàn thành` → nút hổ phách `bg #FFF4E5` / `#D97706`, icon **lucide
  `briefcase-medical` 16px** — sáu path của ta **trùng khít** bản gốc ✓
- Lịch sử điều trị: gộp theo ngày, in `6/8/2026` không đệm 0, cột
  `Ngày | Dịch vụ & răng | Ghi chú | Công đoạn | Hành động`,
  `Bác sĩ:` / `Bác sĩ hỗ trợ: (Trống)` / `Phụ tá: (Trống)` ✓
- Công đoạn **đã** hoàn thành → `Tải ảnh` + **Bảo hành**; **chưa** hoàn thành →
  `Tải ảnh` + **Tạo Labo** ✓
- Chip răng 36×30, `#2671D8`, chữ trắng, bo 4px, 13px/600 ✓
- Thứ tự khối trong "Đặt mới", kể cả hai cột {Màu răng, Số lượng, Khớp cắn} /
  {Đường hoàn tất, Kiểu nhịp} ✓
- `input[type=file]` của bản gốc là `accept="image/*"` **multiple** ✓ — nhiều
  file là đúng

Mức retest: **3** (đụng CSS dùng chung của hai dialog + sửa spec).

### 2026-09-07 (tiếp) — hai lỗi thật lộ ra khi chạy lại đủ bộ

Chạy lại sau R-229…R-231 còn 2 đỏ. Cả hai **không** phải nhiễu spec:

| # | Defect | Fix |
|---|--------|-----|
| R-238 | **Ô Ngày mất/trải lố khi bảng điều trị sang trang 2** | `regroupByDay` chạy trên danh sách **đã lọc** rồi mới `slice` theo trang, mà `daySpan` là **theo vị trí**. Hệ quả: ngày nào có ô Ngày rơi trước `skipCount` thì các dòng của nó ở trang sau **không có ô Ngày nào**, và ô Ngày cuối trang claim luôn số dòng nằm ở trang kế — AntD nuốt mất ngày tiếp theo. Spec bắt đúng bằng bất biến "tổng `rowSpan` = số dòng đang vẽ": đo được **20 ≠ 23**. Nay gộp ngày **sau** khi cắt trang (`pageRows`), đúng chỗ `regroupByDay` vốn được viết ra để dùng |
| R-239 | **`rowKey="id"` trùng khoá** | Một dòng là một **công đoạn**, mà `id` là id **dòng dịch vụ**, nên mọi công đoạn của cùng một dịch vụ dùng chung một khoá React. Nay `rowKey` là `` `${row.id}:${row.stageId ?? "none"}` `` — vẫn **mang tiền tố** id dịch vụ để 4 chỗ trong spec địa chỉ hoá dòng theo `data-row-key^=` không phải sửa |

Và một spec nữa phải sửa tiền đề, không phải hồi quy:

| # | Defect | Fix |
|---|--------|-----|
| R-240 | `the appointment card reassigns its doctor` đỏ vì **0006**, không phải 0002 | Đổi bác sĩ trên thẻ lịch hẹn còn vướng guard thứ hai: `BlueDental:Appointment:0006` — *"Bệnh nhân đã có lịch hẹn vào khung giờ này."* Seeder demo xếp cho **một** bệnh nhân **ba** lịch hẹn trùng đúng khung `2026-08-21T02:30`, nên mọi lần sửa một trong ba đều đụng hai cái còn lại — đổi bác sĩ nào cũng bị chặn. `HasPatientConflictAsync` **có** loại trừ chính phiếu đang sửa, tức là guard đúng; **dữ liệu seed mới là chỗ sai** (giống lỗi R-228: seeder ghi được trạng thái mà đường update từ chối). Spec nay **đi tìm** bệnh nhân có **đúng một** lịch hẹn còn sống + có bác sĩ rảnh trong khung đó; như vậy cũng khỏi phải dựng lại luật chọn "lịch hẹn đang hiện" của thẻ |

Ghi chú kỹ thuật, dễ vấp lại:

- **Thẻ "Lịch hẹn gần nhất" chọn phía client trên một trang 50 dòng.**
  `useAppointmentList({ patientId, maxResultCount: 50 })` rồi mới chọn "sớm nhất
  còn ở tương lai, không thì gần nhất trong quá khứ". Bệnh nhân demo có **405**
  lịch hẹn, nên 50 dòng đầu có thể không chứa cái đúng — thẻ hiện sai lịch hẹn.
  Bản gốc hỏi server đúng một cái (`/schedules/latest`, ascending). **Chưa sửa** —
  ghi nhận để chủ dự án quyết.
- Khi hai lịch hẹn **trùng `slotStart`**, luật của thẻ (`sort` giảm dần rồi lấy
  `[0]`) và luật "sắp tăng dần rồi lấy phần tử cuối" ra **hai phiếu khác nhau**,
  vì `Array.sort` ổn định nên hoà nhau thì giữ thứ tự đầu vào. Spec nào cần biết
  thẻ đang sửa phiếu nào thì phải dùng **đúng** comparator của component, hoặc
  chọn dữ liệu không có hoà — cách sau đang dùng.

| # | Defect | Fix |
|---|--------|-----|
| R-241 | **Seeder demo xếp một bệnh nhân vào nhiều ghế cùng một khung giờ** | `BlueDentalDemoSeedContributor` chỉ giữ `HashSet<(Dentist, Slot)>`, còn bệnh nhân thì **bốc ngẫu nhiên sau đó** — nên cùng một bệnh nhân rơi vào nhiều bác sĩ ở cùng khung giờ. Đo trên DB vừa seed: **206 cặp trùng trên 5 bệnh nhân** / 641 lịch hẹn còn sống. Đúng cái mà `HasPatientConflictAsync` chặn khi ghi, nên **thẻ lịch hẹn của 5 bệnh nhân đó không sửa được gì** — đây là nguyên nhân gốc của R-240. Nay giữ chỗ theo **cả hai** chiều (bác sĩ **và** bệnh nhân), và ca dài 2 slot giữ chỗ đủ hai slot thay vì chỉ slot đầu (trước đây cũng bỏ sót chỗ này) |

> ⚠️ R-241 chỉ có tác dụng khi **seed lại từ đầu**; DB đang dùng để nghiệm thu
> đợt này vẫn còn 206 cặp cũ. Đã build sạch `BlueDental.Application` (0 error)
> nhưng **chưa** chạy trên DB mới — lần seed sạch kế tiếp cần kiểm lại bằng
> chính câu đếm ở trên (kỳ vọng 0 cặp). Spec R-240 không phụ thuộc vào việc này:
> nó tự đi tìm bệnh nhân chỉ có một lịch hẹn còn sống.

### 2026-09-07 (tiếp 2) — bộ test không ổn định: mỗi lần chạy đỏ một chỗ khác

Sau R-238…R-241 bộ chạy được **83 xanh / 1 skip**. Chạy lại lần nữa: **79 xanh /
4 đỏ**, nhưng là **bốn spec khác**. Đó là dấu hiệu bộ test dùng chung một mớ dữ
liệu demo và **tự làm bẩn nó** — mỗi lần chạy lại đẩy trạng thái đi một bước, nên
"xanh một lần" không có nghĩa gì. Bốn nguyên nhân, cả bốn đều ở phía spec:

| # | Defect | Fix |
|---|--------|-----|
| R-242 | `finishLiveStage` bấm **ô Hoàn thành của dòng khác** | Helper lấy `.pd-stage-histrow[aria-disabled="false"]`**`.first()`**, mà một **phiếu** có nhiều **dòng dịch vụ** và **mỗi dòng giữ một công đoạn còn sống của riêng nó** — đúng như đo được trên bản gốc ngày 07/09 (hai dòng cùng `aria-disabled="false"`). Nên helper có thể đóng công đoạn của dòng *khác* dòng đang test, rồi spec đi tìm nút "Bảo hành" trên dòng đó và không thấy. Dòng lịch sử nay in `data-line-id` / `data-stage-id` (bảng điều trị vốn cũng địa chỉ hoá bằng `data-row-key`), `finishLiveStage(page, dialog, lineId)` nhận thêm tham số, và 6 chỗ gọi đều truyền dòng của mình |
| R-243 | Spec "only a line's newest công đoạn stays workable" đếm **sai phạm vi** | Nó đòi `toHaveCount(1)` trên **cả dialog**. Bản gốc cho **mỗi dòng** một công đoạn còn sống, nên số dòng sống bằng số dòng dịch vụ đang mở — không phải 1. Nay đếm **trong phạm vi một dòng** (`data-line-id`) |
| R-244 | `/complete` trả **403 `BlueDental:Treatment:0019`** | *"Dịch vụ này cần đính kèm ảnh trước khi hoàn thành công đoạn."* `addStage` để `isImageRequired` trống nên công đoạn **thừa hưởng** cấu hình của danh mục dịch vụ; gặp dịch vụ bắt buộc ảnh là không đóng được, và ba spec đỏ theo. `CreateTreatmentStageDto.IsImageRequired` là `bool?` **đúng để caller tự khai**, nên fixture nay khai `false`. Không mất độ phủ: luật bắt buộc ảnh đã có test riêng ở `TreatmentStageTests` (Domain) |
| R-245 | Spec momo/ngân hàng gõ cứng **10.000 đ** | Dialog chặn **vượt số còn nợ** ngay ở client nên không POST, và `waitForRequest` treo tới hết 30s. Các spec trước trong cùng file **thu tiền dần** làm Còn nợ của phiếu demo tụt xuống dưới 10.000. Nay đọc `lineDue(dialog)` rồi trả `min(10.000, còn nợ)`, và khẳng định còn nợ > 0 |

Nguyên tắc rút ra, cho các đợt sau:

- **Một spec không được giả định dữ liệu demo còn nguyên.** Nó phải **tự đi tìm**
  bản ghi thoả điều kiện mình cần (còn nợ > 0, dòng còn mở, bệnh nhân chỉ có một
  lịch hẹn…), chứ không lấy "cái đầu bảng" rồi gõ cứng con số.
- **Xanh một lần không phải bằng chứng.** Chạy **hai lần liên tiếp** mới thấy
  loại lỗi này; lần chạy nghiệm thu cuối của đợt này chạy đúng hai lượt.

### 2026-09-07 (tiếp 3) — bỏ nốt hai chỗ spec tự bỏ qua chính mình

Chạy hai lượt liên tiếp còn lộ thêm hai chỗ, đều là spec **tự skip** nên trước
đây không ai thấy — mà skip nghĩa là **hành vi đó không được kiểm**:

| # | Defect | Fix |
|---|--------|-----|
| R-246 | `finishLiveStage` đua với `waitForResponse` | Helper chờ đúng cái `POST …/complete`. Trong một lượt chạy dài, có lần cú bấm không sinh request kịp và spec treo tới hết 30 giây. Nay chờ **kết quả nhìn thấy được** — ô Hoàn thành **trở thành đã tích** (`toBeChecked`, 15s) — vốn cũng chỉ đúng sau khi server đồng ý. Đúng tinh thần CLAUDE.md §16.17: kiểm hành vi, không kiểm đường truyền. `page` không còn cần nên bỏ khỏi chữ ký |
| R-247 | `one receipt covers several services` **tự skip** | `test.skip(count < 2, …)` — nghĩa là tính năng cốt lõi R-197…R-200 (một phiếu thu, nhiều dịch vụ, server tự rải) **âm thầm không được kiểm** ở những lượt dữ liệu đã trôi. Hai lỗi trong phần dựng dữ liệu: (1) nó đếm "dòng còn nợ" từ `patient-treatments`, còn dialog đọc từ **payment account** — hai nguồn lệch nhau sau khi có phiếu thu; (2) đường **tự dựng phiếu** không kiểm kết quả `POST …/accept`, một lần accept thất bại là ra phiếu **một** dòng. Nay đếm bằng chính nguồn của dialog, mỗi bước dựng đều kiểm, dựng xong **đọc lại** phiếu qua account trước khi trả về, và thử lần lượt nhiều bệnh nhân. `test.skip` đổi thành `expect` — thà đỏ còn hơn im lặng |

Cùng đợt, dọn một chỗ trùng lặp: `buildTreatmentRows` vẫn tính `daySpan` dù
`regroupByDay` **luôn** tính lại trên đúng trang đang vẽ (R-238), nên vòng lặp
đó là code chết — đã bỏ, và ghi rõ trong doc comment rằng span là việc của
`regroupByDay`.

### 2026-09-07 (tiếp 4) — hai fixture tự cạn, và một helper không nói được lý do

| # | Defect | Fix |
|---|--------|-----|
| R-248 | Fixture của "một phiếu, nhiều dịch vụ" **cạn dần theo số lần chạy** | Nó đi **mượn** các advise chưa vào kế hoạch của dữ liệu demo. Mỗi lượt chạy *tiêu* hai cái, nên sau vài lượt hết sạch và `slip` ra `null`. Nay spec **tự dựng** advise: lấy id thật (`patientDiagnosisId` / `diagnosisId` / `serviceId` / `staffId` / `teeth`) từ một advise có sẵn, `POST` **hai** advise mới trên **hai dịch vụ khác nhau** của cùng bệnh nhân (1.200.000 và 800.000), accept cả hai rồi mở phiếu — kiểm từng bước, và đọc lại phiếu qua account trước khi trả về. Chú ý: **`teeth` là bắt buộc**, thiếu là 403 `BlueDental:Treatment:0007` *"Select at least one tooth or surface."* |
| R-249 | `finishLiveStage` chờ ô tích mà **không nói được vì sao không tích** | Bản R-246 chỉ chờ `toBeChecked` nên khi server từ chối, spec chỉ báo "vẫn chưa tích" sau 15 giây — đúng là chỗ đã ngốn hai lượt chạy để tìm ra 403 `Treatment:0019`. Nay **vẫn** lắng nghe `POST …/complete` song song: response không `ok` thì **ném ngay** kèm status + body của server; điều kiện pass vẫn là ô tích (hành vi), không phải cái request |

| # | Defect | Fix |
|---|--------|-----|
| R-250 | Cú bấm ô **Hoàn thành** có thể bị **mất trắng** | Dialog "Chi tiết phiếu" refetch danh sách công đoạn, và cú bấm rơi đúng lúc component render lại thì **không có request nào rời máy** — ô vẫn trắng, không toast, không lỗi. Đã xác nhận không phải guard phía client: `useStageComposer.finish` gọi `completeStage.mutateAsync` ngay, không kiểm gì trước. Spec nay bấm **tối đa 3 lần**, mỗi lần chờ 5 giây xem có request không, và **không** bấm lại khi server đã trả lời (trả lời mà không `ok` thì ném luôn kèm status + body) |

> Ghi nhận phía ứng dụng, **chưa sửa**: người dùng bấm đúng khoảnh khắc đó cũng
> sẽ thấy "bấm mà không có gì xảy ra" và phải bấm lại. Không phải lỗi dữ liệu —
> trạng thái vẫn đúng — nên để lại cho chủ dự án quyết có cần khoá hàng trong
> lúc refetch hay không.

### Kết quả nghiệm thu đợt 2026-09-07

Bản build production `:8080` → API `:5019` → PostgreSQL thật, không chặn API nào.

- FE e2e: **84 / 84 xanh, 0 đỏ, 0 skip** trên `patient`, `patient-image`,
  `treatment-plan`, `treatment-stage`, `labo`, `report`, `branch-isolation`,
  `appointment`. Chạy **hai lượt liên tiếp** (7.6 và 7.5 phút) rồi **một lượt
  nữa** sau R-251 (7.7 phút) — tổng ba lượt đủ bộ, cùng một kết quả. Riêng
  `patient.spec.ts` chạy thêm một lượt sau R-251: **47 / 47**.
  Trước đợt này: 79 xanh / 4 đỏ / 1 skip.
- Một lần đỏ giả cần biết để khỏi mất thời gian: `page.evaluate: TypeError:
  Failed to fetch` giữa lượt chạy — do chính `dotnet test` (không có
  `--no-build`) build lại solution **khi host đang phục vụ**. Host vẫn sống,
  chạy lại là xanh. Muốn chạy test BE trong lúc e2e đang chạy thì dùng
  `--no-build`.
- BE: Domain **264 / 264**, Application **516 / 516**, EF **51 / 51**.
- `tsc` sạch (`npm run build`).

Số spec tăng từ 83 lên 84 vì hai spec vốn **tự skip** nay chạy thật (R-240,
R-247), và một spec bị bỏ qua âm thầm được mở lại (bước Tiếp nhận).

Mức retest: **3** — đụng CSS dùng chung của hai dialog (`.pd-labo-*` /
`.pd-stage-*`), `PatientProfileTab`, `StageHistory`, và seeder demo.

Còn treo, **chưa làm**, đã ghi `docs/clone/unknowns.md`: kính lúp "Tìm dịch vụ"
của hai dải chip; ô Công đoạn khi dòng ở trạng thái "Chuyển đổi"; ảnh nháp của
bản gốc (không quan sát được mà không ghi lên production); thẻ "Lịch hẹn gần
nhất" chọn phía client trên trang 50 dòng; màu nút chính chàm vs xanh; và R-241
cần một lần seed sạch để kiểm lại.

| # | Defect | Fix |
|---|--------|-----|
| R-251 | Guard cuối cùng còn `test.skip` | `a finished công đoạn on a service with no warranty offers nothing` bỏ qua chính nó khi không tìm được dòng dịch vụ **không bảo hành và còn mở**. Mà chính spec này hoàn thành công đoạn trên các dòng đó, nên qua nhiều lượt chạy cả ba dịch vụ không-bảo-hành của seeder đều có thể thành Hoàn thành — rồi spec im lặng biến mất. Đổi thành `expect`: `patient.spec.ts` nay **không còn `test.skip` nào** |

---

## 2026-09-07 (tiếp 5) — Bỏ tick "Hoàn thành": dựng revert

Chủ dự án chỉ ra: bỏ tick được để quay về "chưa hoàn thành". Đo lại thì **clone
làm ngược lại** — ô tick bị `disabled` cứng sau khi hoàn thành, không bỏ được:

```
Gắn sứ                     checked=true  boxDisabled=true
Trám bít hố rãnh R16, R26  checked=true  boxDisabled=true
Tiểu phẫu nhổ răng 38      checked=true  boxDisabled=true
```

Bản gốc thì **có** revert — `PUT /v1/patient-stages/{id}/revert-status`, đọc
được từ bundle ở đợt khảo sát 4 và đã ghi trong `api.md` kèm chú "no revert yet".
Chủ dự án chốt: **làm theo bản gốc**, cho bỏ tick.

| # | Defect | Fix |
|---|--------|-----|
| R-252 | Không có đường **mở lại** công đoạn | `TreatmentStage.Revert()`: chỉ nhận công đoạn đang `Completed`, đưa về **`InProgress`** (không phải `Pending` — ca đó đã làm, chỉ là chưa xong) và xoá `CompletedAt`; `StartedAt` giữ nguyên. Thêm `POST /api/v1/app/treatment-stages/{id}/revert-status`, **cùng** ability `treatmentStage.complete` — danh sách ability của bản gốc cho subject này là read/create/update/continue/complete/print, **không** có quyền riêng cho revert |
| R-253 | `MoveServiceLineAsync` **một chiều** | Nó `return` sớm khi dòng đã `Done`, nên mở lại công đoạn sẽ để dòng dịch vụ kẹt ở "Hoàn thành" — hàng vẫn xanh "Hoàn thành" trên một công đoạn đang mở. Nay tính trạng thái đích **từ các công đoạn cùng dòng** chứ không từ hành động vừa làm, nên hoàn thành và mở lại về cùng một đáp số. Thêm `TreatmentService.Reopen()` (Done → InProgress; Cancelled/Replaced vẫn đóng vì đó là quyết định về **dòng**, không phải tiến độ) và `TreatmentPlan.ReopenIfAnyServiceActive()` (đối xứng với `CloseIfAllServicesDone`) |
| R-254 | Ô tick khoá cứng | `disabled={!live \|\| stage.completedAt !== null \|\| …}` → `disabled={!live \|\| completingId === stage.id}`. Chỉ công đoạn **cũ** của dòng, hoặc đang có request, mới khoá. `finish()` nay là **toggle**: đã xong thì gọi revert, chưa thì gọi complete; toast "Đã mở lại công đoạn" (thêm bản dịch en) |

Kiểm thật, bản dev `:5173` → API `:5019` → PostgreSQL thật:

- Vòng tròn đầy đủ trên UI: `revert-status` **200** → ô nhả tick, `Tạo Labo`
  quay lại thay `Bảo hành`; `complete` **200** → tick lại; `revert-status`
  **200** lần nữa. Sau **reload**, ô Công đoạn ngoài bảng trở lại nút **+**
  xanh — nghĩa là dòng dịch vụ cũng đã rời "Hoàn thành".
- Dòng chỉ có **một** công đoạn (Trám bít hố rãnh): dòng `Done(3)` →
  mở lại → `InProgress(2)` → hoàn thành lại → `Done(3)`. Phiếu vẫn
  `InProgress(4)` vì còn dòng khác đang mở — đúng.
- BE: Domain **272/272** (thêm 8: revert của công đoạn ×3, `Reopen` của dòng ×3,
  re-open/stay-closed của phiếu ×2), Application **516/516**, EF **51/51**.
- FE: `tsc` sạch; spec mới `Hoàn thành un-ticks again, and the line follows it
  back` xanh — nó khẳng định cả ô tick, cả nút trong dialog, **và** ô Công đoạn
  ngoài bảng sau reload.

Ghi chú: `TreatmentPlan.Open()` đã vào thẳng `InProgress`, không qua
Approve/Start — hai test phiếu đầu tiên viết sai vì tưởng có bước duyệt.

| # | Defect | Fix |
|---|--------|-----|
| R-255 | `openPatientWithTreatment` mở hồ sơ **không kèm chi nhánh** | Tài khoản toàn phòng khám thấy phiếu của **mọi** chi nhánh trong `/patient-treatments`, nên helper có thể bắt phải một phiếu ở chi nhánh khác rồi mở `/patient/{id}` mà không nói chi nhánh nào — bảng điều trị rỗng, ba spec thanh toán đỏ ngay ở dòng chờ hàng đầu tiên. Lộ ra khi dữ liệu demo có phiếu ở chi nhánh 2. Nay helper mang `branchId` **của chính phiếu** ra và mở `/patient/{id}?branchId=…` |
| R-256 | `addStage` không gửi header chi nhánh | Nó đọc `branchId` từ URL rồi nhét vào **body**, mà máy chủ lấy chi nhánh từ **header `X-Clinic-Branch-Id`** (xem `src/lib/axios.ts`), không đọc body. Trước đây vô hại vì mọi thứ chạy ở chi nhánh mặc định; sau R-255 thì spec có thể ở chi nhánh 2 nên công đoạn sẽ bị ghi lệch chi nhánh. Nay gửi đúng header, lấy từ `line.branchId` |

> Bài học chung: **máy chủ lấy chi nhánh từ header, không từ body.** Mọi `fetch`
> thô trong spec (và mọi script seed) đều phải gửi `X-Clinic-Branch-Id`; đặt
> `clinicBranchId` trong body mà thiếu header thì bản ghi rơi vào chi nhánh mặc
> định, âm thầm.

| # | Defect | Fix |
|---|--------|-----|
| R-257 | Spec bước **Tiếp nhận** cũng cạn dần | Nó đi tìm bệnh nhân "chỉ có một lịch hẹn và chưa đến", rồi **check-in** chính lịch hẹn đó — nên mỗi lượt chạy tiêu một cái. Xanh vài lượt rồi hết, và trước R-247 nó còn tự `skip` nên chẳng ai thấy. Nay spec **tự đặt** một lịch hẹn mới: chọn bệnh nhân **chưa có** lịch hẹn còn sống, một khung giờ cách 120 ngày (không phiếu seed nào với tới, nên không đụng cả guard bác sĩ 0002 lẫn guard bệnh nhân 0006) và một bác sĩ rảnh khung đó, `POST /appointments` kèm header chi nhánh. Chạy hai lượt liên tiếp đều xanh |

### Kết quả nghiệm thu — revert công đoạn (2026-09-07, R-252…R-257)

Bản build production `:8080` → API `:5019` → PostgreSQL thật.

- FE e2e: **85 / 85 xanh, 0 đỏ, 0 skip**, chạy **hai lượt liên tiếp**
  (7.2 và 7.3 phút). Số spec lên 85 vì thêm
  `Hoàn thành un-ticks again, and the line follows it back`.
- BE: Domain **272 / 272**, Application **516 / 516**, EF **51 / 51**.
- `tsc` sạch.

Mức retest: **3** — đụng `TreatmentStage` / `TreatmentService` / `TreatmentPlan`
(cả ba aggregate của luồng điều trị), `MoveServiceLineAsync` nay chạy hai chiều,
cộng helper dùng chung của bộ spec.

---

## 2026-09-07 (tiếp 6) — Danh sách bệnh nhân, và hai modal của "Tạo tái khám"

Chủ dự án chỉ ra ba chỗ. Soi bản gốc (chỉ đọc: đăng nhập, mở trang, đổi trang,
mở dialog, đọc `getComputedStyle`; **không lưu form nào**) rồi sửa.

### Cột Dịch vụ / Bác sĩ — bản gốc chỉ in **một** cái

Đo trên bản gốc 2026-09-07, đọc **40 trong 54** bệnh nhân (trang 1 qua response
thật, trang 2 qua DOM): **không ô nào có tên thứ hai** — kể cả `HN8516`, bệnh
nhân có **hai phiếu** và nhiều dòng dịch vụ, tổng 19.5 triệu, mà `serviceNames`
vẫn đúng một phần tử. `staffNames` cũng vậy. Hai cột này đi cùng nhau: bệnh nhân
không có dòng nào còn sống thì **cả hai** là em dash.

| # | Defect | Fix |
|---|--------|-----|
| R-258 | **Bảng danh sách không bao giờ có dữ liệu ở Dịch vụ / Bác sĩ / Số tiền / Thực thu / Công nợ** | `PatientAppService.BuildRowsAsync` nạp phiếu bằng `GetQueryableAsync()`, **không** `WithDetailsAsync(p => p.Services)`. Navigation `plan.Services` rỗng, nên `PatientListRollupCalculator` đọc ra 0 dòng: hàng nào có phiếu vẫn hiện "Chưa phát sinh", em dash và số 0. Đúng cái chủ dự án thấy. Nay dùng `WithDetailsAsync`. Đo lại: 12/14 hàng có dịch vụ, bác sĩ và tiền thật |
| R-259 | Rollup gộp **mọi** dịch vụ của mọi phiếu | `ServiceCatalogIds` là `SelectMany(...).Distinct()`, `DentistIds` cũng vậy — bệnh nhân ba dịch vụ sẽ in ba tên, cách nhau bằng dấu phẩy. Bản gốc chỉ in **một**. Nay lấy **dòng mới nhất** (`CreationTime` giảm dần) và bác sĩ của **phiếu chứa dòng đó**, để hai cột nói về cùng một việc; không có dòng nào thì cả hai rỗng. Bốn test Domain mới |

### Hai modal của "Tạo tái khám"

Nút **Tái Khám** và **Chi Tiết** trong modal "Tạo tái khám" trước đây mở sai chỗ:
Tái Khám mở form **đặt lịch hẹn**, Chi Tiết mở **"Chi tiết phiếu"**. Bản gốc mở
hai modal khác:

| # | Defect | Fix |
|---|--------|-----|
| R-260 | **Tái Khám** mở dialog lịch hẹn | Bản gốc thay danh sách bằng **form "Tạo tái khám"** ngay tại chỗ (cùng tiêu đề, `Đóng` quay lại danh sách) — và form đó **chính là form công đoạn**: Ngày tạo (khoá) · Bác sĩ · Phụ tá · Bác sĩ hỗ trợ ‖ Dịch vụ (khoá) · Răng · Hình ảnh · Tải Ảnh ‖ Nội dung điều trị · Danh sách công đoạn, footer `Đóng` / **`Lưu`**. Đo được: dialog 1202px, hai cột 571px cách nhau 12px, bước hàng 52px. `WarrantyDialog` gộp thành **`StageFollowUpDialog`** dùng chung cho cả Bảo hành và Tái khám — chỉ khác tiêu đề, nhãn nút và cờ |
| R-261 | **Chi Tiết** mở "Chi tiết phiếu" | Bản gốc mở **"Chi tiết dịch vụ"**, chồng **lên** danh sách (`Đóng` trả về danh sách, không đóng hết). Đo được: **772px**, grid 2 cột `gap-x-12`/`gap-y-8` (48/32px), mỗi khối một `<h3>` 16px **bold uppercase** màu `#2671D8`, các dòng `nhãn: giá trị` 15px màu `#5A6B82` với giá trị `font-weight 500` màu `#1B2A41`. Bốn khối: CHI TIẾT KẾ HOẠCH · THÔNG TIN KHÁCH HÀNG · THÔNG TIN NHÂN VIÊN · THÔNG TIN THANH TOÁN, footer chỉ `Đóng`. Dựng mới `ServiceDetailDialog`; đo lại local khớp từng con số |
| R-262 | Không có chỗ ghi **tái khám** | Bản gốc raise qua `POST /patient-stages/{id}/re-examination` và stage có cờ `hasReExamination`. Ta thêm `TreatmentStage.IsReExamination` (đúng khuôn `IsGuarantee`), migration `20260907000000_AddStageReExamination`, DTO hai chiều. Form Tái khám ghi một công đoạn `isReExamination: true` trên cùng dòng dịch vụ |

### Dữ liệu chi nhánh 2

Trước: 14 bệnh nhân, 1 phiếu, **0 lịch hẹn** — nên bảng trắng trơn. Nay seed
thêm 6 bệnh nhân và 10 phiếu ở các mức khác nhau, kèm lịch hẹn quá khứ/tương
lai. Đo lại: **Hoàn tất 5 · Đang điều trị 7 · Chưa phát sinh 2**, 12/14 hàng có
dịch vụ + bác sĩ + tiền, 7 hàng có Lịch hẹn gần nhất, **không** ô nào hai dịch vụ.

Ghi chú cho lần seed sau: **tạo công đoạn không làm dòng dịch vụ khởi động** —
chỉ `continue` / `complete` / `revert-status` gọi `MoveServiceLineAsync`. Muốn
hàng đọc "Đang điều trị" thì phải `continue` một công đoạn.

### Kết quả nghiệm thu đợt R-258…R-262

Bản build production `:8080` → API `:5019` → PostgreSQL thật.

- FE e2e **85 / 85 xanh, 0 đỏ, 0 skip**.
- BE: Domain **276 / 276** (thêm 4 test cho rollup của danh sách),
  Application **516 / 516**, EF **51 / 51**.
- `tsc` sạch.
- Đo tay trên bản dev: "Chi tiết dịch vụ" ra **772px**, grid `32px 48px`,
  `<h3>` `rgb(38,113,216)` 16px/700 uppercase, dòng fact `rgb(90,107,130)` 15px,
  giá trị `#1b2a41` weight 500 — khớp bản gốc từng con số. Form Tái khám ra đúng
  6 nhãn (Ngày tạo · Bác sĩ · Phụ tá · Bác sĩ hỗ trợ · Dịch vụ · Nội dung điều
  trị) và footer `Đóng` / `Lưu`, `Đóng` quay lại danh sách.

Mức retest: **3** — đụng `PatientAppService` (đường đọc của danh sách),
`PatientListRollupCalculator`, `TreatmentStage`, và gộp `WarrantyDialog` thành
`StageFollowUpDialog` (dùng ở cả bảng điều trị và "Chi tiết phiếu").

**Chưa làm, ghi nhận:** ba chip lọc `Các chẩn đoán` / `Tái khám` / `Bảo hành`
của bảng điều trị vẫn **không lọc gì** — `visibleRows` chỉ xử lý `all`/`done`/
`active`. Giờ đã có `IsGuarantee` và `IsReExamination` nên hai chip sau dựng được;
chưa nằm trong phạm vi đợt này.

---

## 2026-09-07 (tiếp 7) — Thanh Tiếp nhận: ba màu, và bước 3 bấm không được

Chủ dự án chỉ hai chỗ trên thẻ "Lịch hẹn gần nhất".

| # | Defect | Fix |
|---|--------|-----|
| R-263 | **Bước 3 (Hoàn tất) không bấm được** | `ReceptionSteps` gọi `api.post(.../${step})` **không kèm body** cho cả ba bước. Nhưng `complete` bind một body — `CompleteAsync(Guid id, [FromBody] CompleteAppointmentDto input)` — nên bước 3 rớt model binding và **chưa bao giờ** đi được; `check-in` và `start` không nhận tham số nên vẫn chạy. Nay bước 3 gửi `{ notes }`, và **gửi lại đúng ghi chú đang có**: `Appointment.Complete(notes)` gán `Notes = notes` vô điều kiện, gửi rỗng là **xoá mất** ghi chú của lịch hẹn |
| R-264 | Ba trạng thái **cùng một màu** | Mọi bước đã đi qua đều dùng `var(--bd-blue)`. Bản gốc cho mỗi bước một màu riêng, và **đoạn ray dẫn vào** bước nào thì mang màu bước đó. Nay: bước 1 `#2671D8` xanh dương · bước 2 `#F59E0B` hổ phách · bước 3 `#12A960` xanh lá; ô tròn đổ màu và mang dấu **tích** thay cho số, nhãn đổi theo, ray tô cùng màu |

Trạng thái **chưa đi qua** đo được trên bản gốc (2026-09-07, bệnh nhân `HN8521`):
ô tròn **32px** nền trắng in **số**, viền `1px #DCE3EE`, chữ 13px/600; ray **2px**
`#DCE3EE` chia hai nửa, hai đầu ngoài cùng `invisible`; nhãn 12px/600 và giờ 12px,
cả hai `#1B2A41`. Đã dựng đúng từng con số (trước đó ô tròn 26px, ray 1px).

Đo lại trên local sau khi sửa — đi hết ba bước:

```
step 1  check-in 200  dot rgb(38,113,216)   nhãn rgb(38,113,216)   ray rgb(38,113,216)
step 2  start    200  dot rgb(245,158,11)   nhãn rgb(245,158,11)   ray rgb(245,158,11)
step 3  complete 200  dot rgb(18,169,96)    nhãn rgb(18,169,96)    ray rgb(18,169,96)
```

Cả ba đều có dấu tích và đóng dấu giờ; ba màu khác nhau.

> **Màu của trạng thái đã đi qua là giả định** — bấm thử stepper của bản gốc là
> **ghi** lên production nên không đo được. Ba màu lấy từ đúng những tông bản gốc
> có ở chỗ khác: primary `#2671D8` (đo được), `amber-500 #F59E0B` (chính class
> `hover:bg-amber-500` của nút Bảo hành bản gốc), và `#12A960` (nút + xanh của ô
> Công đoạn). Đã ghi `docs/clone/unknowns.md`.

Spec `the Tiếp nhận steps advance one at a time` nay đi **hết ba bước** (trước
chỉ đi bước 1) và khẳng định **ba ô tròn ba màu khác nhau** — đọc sau khi
transition đổ màu kết thúc, nếu không sẽ bắt được màu đang nội suy giữa trắng và
màu đích.

### Kết quả nghiệm thu R-263…R-264

- FE e2e **85 / 85 xanh** trên tám file quen thuộc (`patient`, `patient-image`,
  `treatment-plan`, `treatment-stage`, `labo`, `report`, `branch-isolation`,
  `appointment`). `tsc` sạch.
- Spec `the Tiếp nhận steps advance one at a time` chạy **hai lượt liên tiếp**
  đều xanh sau khi mở rộng qua cả ba bước.

**Hai file ngoài phạm vi, đỏ sẵn từ trước — không phải do đợt này.** Lần đầu
chạy kèm `reception.spec.ts` và `cskh.spec.ts` (hai file **chưa** nằm trong bộ
nghiệm thu của F-38) thì có 4 đỏ. Đã truy nguyên bằng cách `git stash` toàn bộ
thay đổi của đợt, build lại **bản gốc** rồi chạy đúng hai file đó:

| | Bản gốc (đã stash) | Có thay đổi của đợt này |
|---|---|---|
| `reception` + `cskh` | **4 đỏ** / 6 xanh | **3 đỏ** / 7 xanh |

Nên bốn spec đó đỏ **trước** đợt này, và đợt này thực ra làm bớt một cái. Nguyên
nhân bề mặt: `assertRealApiTraffic` đăng ký `waitForResponse` **sau** `page.goto`,
nên request đã xong trước khi bắt đầu chờ là hết 20 giây — cùng loại đua đã gặp ở
R-246. Chưa sửa: hai file này ngoài phạm vi đợt này, ghi lại để đợt sau xử lý.

---

## 2026-09-07 (tiếp 8) — Tái khám: chọn răng, list ảnh, và **một row của riêng nó**

Chủ dự án chỉ bốn chỗ trên modal "Tạo tái khám", kèm link bản gốc
`/patient/69d315447b2db7404471a619?...&tab=profile`.

| # | Defect | Fix |
|---|--------|-----|
| R-265 | Răng **mặc định tick sẵn tất cả** | Form dựng lại danh sách răng của công đoạn nguồn rồi đánh dấu `selected: true` cho mọi cái. Bản gốc mở ra **không tick cái nào**: nó giữ **hai** danh sách — `content` (răng của công đoạn nguồn, chỉ để hiển thị) và `selectedContent` (răng người dùng tick). Nay răng là nút bật/tắt (`aria-pressed`), bắt đầu tắt hết, và chỉ những cái đã tick mới đi vào payload |
| R-266 | Tải ảnh lên **không hiện list** | Ảnh chọn xong chỉ nằm trong state, không vẽ ra. Bản gốc hiện **thumbnail** kèm nút xoá từng cái và nhãn đếm ("2 ảnh"). Nay `.pd-stage-shots` vẽ list, mỗi ảnh một nút xoá; `previews` bọc `useMemo` + `revokeObjectURL` khi unmount để không rò blob URL |
| R-267 | Tái khám lưu xuống **thành một công đoạn** | **Sai mô hình.** Lượt đầu tôi thêm cờ `IsReExamination` vào `TreatmentStage` — tức tái khám là một công đoạn có cờ. Timeline bản gốc phủ định điều đó (xem dưới): tái khám là **row riêng**, `type: "re_examination"`, mã `REX001`. Nay có aggregate `PatientReExamination` riêng, bảng `bd_patient_re_examinations`, endpoint `api/v1/app/patient-re-examinations` |
| R-268 | Accent trong modal dùng **`#2671D8` của bản gốc** | Modal trộn chip/nhãn `#2671D8` với nút Lưu indigo → đọc ra **hai** accent khác nhau. Chủ dự án yêu cầu theo primary của clone. Nay **17** accent trong `.pd-labo-dialog` / `.pd-stage-dialog` đổi từ `var(--bd-link)` sang `var(--bd-primary)` |

### R-267 — bằng chứng đọc được, và cái đã phải rút lại

Timeline bệnh nhân của bản gốc trả về **hai** loại row:

```
{ type: "stage",          code: "CD26-0001", ... }
{ type: "re_examination", code: "REX001",
  patientStageId, patientStage, treatmentServiceDetails, serviceId,
  staffId, subStaffId, assistantStaffId, note,
  content, selectedContent, images, dateTime }
```

và công đoạn **nguồn** lật `hasReExamination`. Row tái khám **không có** status,
không có quantity riêng, và bản gốc để trống hai ô **Công đoạn** với **Chăm sóc
sau điều trị** trên đúng row đó — nên nó không thể là một công đoạn.

Lượt sai đã **áp** migration vào DB rồi mới phát hiện, nên phải rút lại bằng tay:
`DROP COLUMN "IsReExamination"` + xoá dòng tương ứng trong
`__EFMigrationsHistory`, rồi viết lại `20260907000000_AddStageReExamination` cho
đúng — thêm `HasReExamination` (cờ **trên công đoạn nguồn**) và
`CreateTable("bd_patient_re_examinations")`. `BlueDentalDbContextModelSnapshot.cs`
vá tay cả block entity và block `Teeth` `ToJson` (khoá `PatientReExaminationId`).

`SL` trên row lấy từ `Quantity` của **service line** mà công đoạn nguồn thuộc về;
mã chạy `REX{n:D3}` theo **từng bệnh nhân**, như DT của phiếu.

Đo lại trên local sau khi sửa — một vòng tạo tái khám đầy đủ:

```
TEETH_CHIPS=1 ; không răng nào tick sẵn (aria-pressed=false)
SHOTS=2, nhãn đếm "2 ảnh", xoá từng cái chạy
CREATE_STATUS=200 ; CREATED={"code":"REX01","teeth":1,"qty":1}
ROW={"found":true,"count":7,"service":"REX01 - Nhổ răng khôn mọc lệchTái khám",
     "note":"Tái khám sau 1 tuần","teeth":"38","sl":"1",
     "doctor":"BS. Mai Anh Phương","second":"BS. Đinh Thành Long",
     "stageCell":"","careCell":""}
```

Hai ô cuối rỗng, và row không có dòng **Phụ tá** — đúng như bản gốc.

### R-268 — và cái spec ghim màu cũ

Chip răng đã tick đo được `rgb(99, 102, 241)` = `#6366f1` = `--bd-primary`.

> **Đã đọc sai màu này bốn lần trước khi đọc đúng.** Mấy lượt probe đầu đều ra
> trắng; tôi đã kiểm CSS có trong bundle, `el.matches()` khớp, không `!important`
> nào chặn — rồi chụp cả trang thì thấy **modal còn đang chạy animation mở**.
> Thêm chờ settle là ra ngay indigo. Bài học: đọc computed style trong modal
> phải chờ animation xong, giống R-264 phải chờ transition đổ màu.

`patient.spec.ts` có một spec cũ ghim `rgb(38, 113, 216)` cho nhãn floating khi
focus — R-268 làm nó đỏ, **đúng như nó nên đỏ**. Đã sửa kỳ vọng sang
`APP_PRIMARY` (hằng mới ở đầu file) kèm chú thích **vì sao** chỗ này cố ý lệch
bản gốc, để lần sau không ai "sửa lại cho giống gốc".

### Test mới

`a tái khám picks its teeth, lists its images, and lands as its own row` —
spec thường trú, đi hết vòng: thêm công đoạn → hoàn thành → mở form tái khám →
khẳng định răng bắt đầu **chưa** tick → tick một cái → khẳng định chip mang màu
primary → nạp hai ảnh, khẳng định **2 thumbnail** + nhãn đếm, xoá một cái →
lưu, khẳng định POST vào `/patient-re-examinations` và mã khớp `^REX\d+$` →
reload, khẳng định bảng **tăng đúng một row**, row đó có chip `Tái khám`, mã
`REX`, và **không** có nút thêm công đoạn / bảo hành / chăm sóc / dòng phụ tá.

Domain: `PatientReExaminationTests` (6 test) chốt các invariant — phải có ≥1
răng (`EmptyToothSelection`, vì form mở ra trắng nên submit rỗng **không** được
ngầm hiểu là "tất cả răng"), không trùng răng, phải có mã, ảnh giữ thứ tự và
không vào hai lần. `TreatmentStageTests` thêm một test cho `MarkReExamined()`
idempotent. Application: `PatientReExaminationAppServiceContractTests` (11 test)
chốt ba method đều bị gác bởi **ability của công đoạn** (`read` / `complete` /
`update` — bản gốc không có ability riêng cho tái khám), và chốt DTO **không**
có `Content` lẫn `Status`.

### Kết quả nghiệm thu R-265…R-268

- BE: Domain **283**, Application **528**, EF **51**, HttpApi.Host **14** — 0 đỏ, 0 skip.
- Đã xoá hai file spec chẩn đoán dùng một lần (`zz-check-recall`, `zz-diag-chip`).

---

## 2026-09-07 (tiếp 9) — Trang chi tiết bệnh nhân trắng màn: **lỗi do tôi gây ra khi ghi file**

Chủ dự án báo `/patient/{id}` hiện "Đã xảy ra lỗi ngoài dự kiến". Không phải lỗi
tính năng — là **cache của Vite dev server** bị tôi làm bẩn.

| # | Defect | Fix |
|---|--------|-----|
| R-269 | `/patient/{id}` rơi vào `ErrorBoundary` trên **dev server** (5173) trong khi bản build (8080) vẫn xanh | `SyntaxError: … StageFollowUpDialog.tsx … does not provide an export named 'StageFollowUpDialog'`. Hỏi thẳng dev server thì nó trả về **module rỗng 183 byte** (`sourcesContent: [""]`). Nguyên nhân: tôi ghi lại file bằng `cat > file <<EOF` — lệnh này **truncate về 0 byte trước** rồi mới ghi, watcher của Vite bắt được đúng khoảnh khắc file rỗng, transform ra module không export gì, rồi **cache lại**. `tsc` sạch và file trên đĩa đúng, nên không có gì trên đĩa để sửa. `touch` lại 4 file mới là Vite transform lại (21658 / 16231 / 6563 / 9711 byte) và trang chạy lại ngay |

Đo lại sau khi sửa, trên dev server, **không** còn console error nào:

```
rows=8  recalls=2   (hai row tái khám REX vẫn đúng chỗ)
teeth=1  pressedBefore=false  pressedAfter=true
```

> **Bài học quy trình.** `cat > <file>` vào một file **đang được dev server
> theo dõi** có thể để lại transform rỗng trong cache — build và `tsc` đều không
> phát hiện được, chỉ dev server bị. Sau khi ghi đè file kiểu này, hoặc `touch`
> lại, hoặc khởi động lại dev server. Ghi file mới thì không sao; chỉ ghi **đè**
> mới có cửa sổ 0 byte đó.

### Và lần thứ ba đọc sai màu chip răng

Lần này đo được cả nguyên nhân, không còn phải suy: chip có
`transition: background-color 0.12s`, nên đọc **ngay sau** cú click ra
`rgb(255, 255, 255)`, chờ 1200ms ra `rgb(99, 102, 241)`.

```
immediate = rgb(255, 255, 255)
settled   = rgb(99, 102, 241)   ← --bd-primary
transition = background-color 0.12s, border-color 0.12s, color 0.12s
```

Spec dùng `toHaveCSS` nên **tự retry** và luôn đọc giá trị đã đứng — chỉ probe
một-phát của tôi là sai. Ba lần đọc sai cùng một chỗ đều do đọc computed style
mà không chờ animation/transition; đã ghi thành cảnh báo ở R-268.

### Dọn theo §16.1 — `StageFollowUpDialog` 346 dòng

Quá hạn 150 dòng của CLAUDE.md §16.1, và là code mới của đợt này nên phải tách
ngay: `useFollowUpForm.ts` (state + nhánh ghi bảo hành / tái khám),
`FollowUpTeeth.tsx` (hàng Răng, toggle hay chip tĩnh tuỳ loại),
`FollowUpShots.tsx` (dòng đếm + thumbnail + Tải Ảnh). Dialog còn **177** dòng
chỉ còn layout. `tsc` sạch. Đây cũng chính là refactor đã kích hoạt R-269.

---

## 2026-09-07 (tiếp 10) — Nhãn tái khám, validate tại field, list ảnh công đoạn

Chủ dự án chỉ ba chỗ, kèm ảnh bản gốc.

| # | Defect | Fix |
|---|--------|-----|
| R-270 | Chip **Tái khám** trên row tô màu primary | Bản gốc để chip này **xám** — nó là *nhãn*, không phải *trạng thái*, và để mã `REX002` của row giữ màu. Nay `.pd-tr-chip--recall` dùng `var(--bd-bg-head)` trên `#667085` |
| R-271 | Thiếu răng / thiếu nội dung báo bằng **toast** | Toast không nói là thiếu ô nào, và biến mất trước khi kịp nhìn. Nay báo **ngay dưới từng field** (`.pd-stage-error`) kèm `status="error"` của AntD. Hai điểm cố ý: **báo hết các ô trống một lượt** (không bắt bấm Lưu ba lần để lần ra), và **xoá thông báo ngay khi sửa đúng ô đó**, không đợi lần submit sau. Toast chỉ còn cho lưu thành công và lỗi thật từ server |
| R-272 | "Tiếp tục công đoạn" chỉ hiện **số** ảnh, không hiện ảnh | Ảnh được chọn **trước khi** công đoạn tồn tại rồi mới đính sau khi lưu, nên không thấy ảnh thì không biết đã chọn lẫn file. Tách `StageShots` dùng chung cho cả hai form (tái khám + công đoạn), có preview blob (`useMemo` + `revokeObjectURL`) và nút xoá từng ảnh, số đếm đi theo |

### R-273 — lỗi thật, lộ ra nhờ hai spec đỏ

Hai spec đỏ **không** phải lỗi spec: `POST /treatment-stages` trả **200** hai
lần mà tổng bảng điều trị vẫn đứng ở **233** — công đoạn mới không xuất hiện ở
**bất kỳ trang nào**.

Nguyên nhân: `PatientProfileTab` gọi `maxResultCount: 200`, còn server sắp xếp
công đoạn theo `(TreatmentServiceId, SequenceNumber)` — **không** theo ngày. Quá
mức 200, cả những service line nằm cuối thứ tự đó rụng khỏi kết quả, nên công
đoạn vừa thêm biến mất im lặng. Nay nâng cả hai query lên **1000** (đúng
`MaxMaxResultCount` của ABP) và hai spec xanh lại.

> **Đây là lỗi có từ trước, không phải do đợt này** — mức 200 nằm đó từ lâu.
> Cái làm nó lộ ra là bệnh nhân fixture nay mang **233 dòng** tích lại qua các
> lượt chạy test.
>
> **1000 vẫn là một mức chặn.** Vượt qua nó thì lỗi cắt cụt quay lại. Cách sửa
> đúng là endpoint timeline phân trang phía server như bản gốc; bảng của ta chưa
> phân trang server được vì nó **trộn hai collection** (công đoạn + tái khám)
> thành một thứ tự rồi mới cắt trang phía client — không thể phân trang độc lập
> hai nguồn rồi trộn. Đã ghi `docs/clone/unknowns.md`, chưa làm.

### Spec không còn khẳng định trên **một trang**

Ba spec trước đây đếm dòng trên trang 1 của một bảng phân trang 20 dòng:

- Đếm chuyển sang `treatmentTotal()` — đọc tổng bảng tự báo ("Hiển thị a–b trên
  N điều trị"). Lý do: **một trang đã đầy thì không bao giờ thấy được việc thêm
  một dòng**, dòng mới rơi đầu nào cũng vậy, vì số dòng trên trang luôn bằng
  page size.
- Tra dòng chuyển sang `findStageRow()` — đi lần lượt các trang, và `addStage()`
  nay trả về **id** của công đoạn vừa tạo để khoá đúng `serviceId:stageId`.

Chỗ này bắt được một spec **xanh vì lý do sai**: "a finished công đoạn on a
service with no warranty offers nothing" dùng `.first()` nên đang đọc một dòng
**cũ, khác** của cùng service line — dòng đó cũng có `.pd-tr-nostage` nên spec
vẫn xanh dù dòng cần kiểm tra không hề tồn tại trên bảng.

---

## 2026-09-07 (tiếp 11) — Màu trạng thái đo lại từ bản gốc, và In Phiếu chưa bao giờ in được

Chủ dự án đưa link bản gốc và yêu cầu **rà soát lấy đúng màu**. Đã mở
`/patient/6a63420446313e3468182c81?tab=profile` (chỉ đọc: đăng nhập, mở dialog,
`getComputedStyle`, đọc lại **response đã có** trong network log — không gửi
request ghi nào).

### Đo được gì

Row của bảng điều trị mang **status của chính nó**, không phải của service line.
Đọc `GET /api/v1/patient-timeline` (response đã có sẵn trong network log, không
gọi thêm) — 4 row, khớp 1:1 với 4 chip đọc trên DOM theo đúng thứ tự:

```
STG21 status=replaced  → Chuyển đổi
STG20 status=replaced  → Chuyển đổi
STG19 status=done      → Hoàn thành
STG18 status=created   → Đang điều trị      ← không phải "Chưa điều trị"
```

Hai row của **cùng** một line (DT21) đọc ra "Hoàn thành" và "Đang điều trị" cùng
lúc — đó là bằng chứng status thuộc **row**, không thuộc line.

Màu, đo trên bệnh nhân HN8516:

| | Bảng điều trị (32px, radius 8px, 12px/**600**) | Tờ in (26px, radius **9999px**, 12px/**500**) |
|---|---|---|
| Đang điều trị | `#EFF6FF` / `#1D4ED8` | `#D9EEFF` / `#2671D8` |
| Hoàn thành | `#E7F8EF` / `#12A960` | `#DDF6E8` / `#10A861` |
| Chuyển đổi | `#E6F8FB` / `#1A606B` | *(không quan sát được)* |

**Hai bộ màu khác nhau, cố ý** — bản gốc không dùng lại màu bảng cho tờ in, và
hình dạng cũng khác (chip bo 8px vs pill bo tròn hẳn).

| # | Defect | Fix |
|---|--------|-----|
| R-274 | Chip trên bảng chỉ có **hai** trạng thái | Code cũ chọn `row.stageDone ? Done : InProgress`, nên **Chuyển đổi** không bao giờ hiện, và màu lấy từ `--bd-blue-pale`/`--bd-green-pale` của app chứ không phải màu bản gốc. Nay có `stageRowStatus.ts` làm một nguồn duy nhất cho cả bảng và tờ in: `replaced`/`cancelled` đọc từ line (BlueDental giữ hai trạng thái đó trên line, không trên từng công đoạn), `done`/`active` đọc từ chính công đoạn. Chip cao 32px cho khớp (trước 28px) |
| R-275 | Nhãn `created` in ra **"Chưa điều trị"** | Bản gốc in **"Đang điều trị"**. Nhãn `Replaced` cũng sai: app ghi "Đã thay thế", bản gốc ghi **"Chuyển đổi"**. Nay `stageRowStatusLabel` dùng đúng chữ bản gốc; spec khẳng định "Chưa điều trị" **không** xuất hiện trên bảng |
| R-276 | Pill trên modal in mang màu **primary indigo** | Đổi sang đúng hai cặp đo được, và tách hẳn khỏi bộ màu của bảng (spec khẳng định pill **không** mang màu chip của bảng, để không ai gộp lại) |

### R-277 — In Phiếu chưa bao giờ ra print preview

`@media print` cũ làm thế này:

```css
body.pd-printing > *          { display: none !important; }
body.pd-printing .pd-print-sheet { display: block !important; }
```

Tờ A4 nằm **trong** Modal của AntD, tức nằm dưới div portal mà AntD gắn vào
body. Rule đầu ẩn luôn div portal đó, và rule sau **không cứu được** — một phần
tử con không thể tự hiện lên khi tổ tiên nó `display: none`. Mấy rule
`.ant-modal-*` thêm vào sau cũng không tới được div portal (nó không mang class
nào). Kết quả: preview trắng.

Nay tờ A4 `createPortal(..., document.body)` nên nó là **con trực tiếp của
body**, và print rule chỉ cần:

```css
body.pd-printing > *:not(.pd-print-sheet) { display: none !important; }
body.pd-printing > .pd-print-sheet        { display: block !important; }
```

Kèm hai chỗ nữa: `article` chốt `max-width: 794px; margin: 0 auto` (A4 ở 96dpi,
đúng `max-w-[794px] mx-auto` của bản gốc — không có nó thì ba cột đầu trang dãn
ra theo bề rộng cửa sổ), và class `pd-printing` nay bỏ ở **`afterprint`** chứ
không bỏ ngay dòng sau `window.print()` — `window.print()` không chắc chắn chặn
tới khi đóng preview, bỏ sớm là trả trang về trước khi kịp render.

Đo lại trên bản build, dưới `emulateMedia({ media: "print" })`:

```
PRINT CALL      {"calls":1,"bodyClass":"pd-printing"}
UNDER PRINT     sheet display=block h=980   screenBody h=0
                title="Chi tiết phiếu"
                signs=["Người lập phiếu","(Ký, họ tên)","BS. …",
                       "Khách hàng","(Ký, họ tên)","Lý Thị Mai"]
article width   794px
```

### Test mới

Hai spec thường trú. `status chips carry the reference's own colours, table and
printed sheet apart` chốt từng cặp màu **đo được** (hằng `REFERENCE_STATUS` ghi
rõ là màu của bản gốc, không phải palette app), chốt hình dạng của cả hai, chốt
"Chưa điều trị" không xuất hiện, và chốt pill **khác** chip. `In Phiếu prints
the A4 sheet, not the dialog` chốt tờ in là `body > .pd-print-sheet`, chốt
`window.print()` được gọi **một** lần với `pd-printing` đang bật (stub
`window.print` — là API của browser, không phải API của BlueDental, nên không
vi phạm luật cấm mock), rồi dưới print media chốt tờ in hiện, bản trên màn ẩn,
có hai ô ký, và `article` rộng đúng 794px.

> **Còn treo:** cặp màu **Chuyển đổi** trên *tờ in* không quan sát được — phiếu
> mở được trên staging không có row `replaced` nào. Tạm dùng lại cặp teal của
> bảng; đã ghi `docs/clone/unknowns.md`. Cặp **Đã huỷ** cũng chưa quan sát được
> ở cả hai chỗ.

---

## 2026-09-07 (tiếp 12) — "Danh sách công đoạn": chọn ở form, tick ở bảng

Chủ dự án yêu cầu rà soát rồi làm. Đã soi bản gốc **chỉ đọc** — đăng nhập, mở
dialog, đổi tab, đọc DOM, đọc lại **response đã có** trong network log, và đọc
**bundle JS** (static asset, rule 00 cho phép). **Không tick một ô nào trên bản
gốc**: tick là ghi, và toast "Cập nhật thành công" chứng minh nó ghi thật.

### Mô hình đo được — ba tầng

| Tầng | Thứ gì | Ghi ở đâu |
|---|---|---|
| Dịch vụ (Danh mục) | `service.stages[]` = `{ id, name, value, valueType }` | Mình **đã có**: `CatalogServiceStage(Name, Value, SortOrder)` |
| Công đoạn | `stageServiceItems[]` = `{ stageServiceId, isCompleted, completedAt, staffId }` | **Mới**: `TreatmentStage.ServiceItems` |
| Dòng dịch vụ | `treatmentLineItems[]` thêm `earningId` / `earningAmount` / `isCreatedEarning`, và `progress` | **Chưa làm** — xem dưới |

Dịch vụ đọc được có 2 bước: `công d1` (100.000, `valueType: "value"`) và `2`
(20, `valueType: "percentage"`).

API, đọc từ bundle:

    GET  /v1/patient-stages                 PUT  /v1/patient-stages/{id}/status
    POST /v1/patient-stages                 PUT  /v1/patient-stages/{id}/revert-status
    PUT  /v1/patient-stages/{id}            PUT  /v1/patient-stages/{id}/stage-service-items   <- tick
    POST /v1/patient-stages/{id}/continue
    POST /v1/patient-stages/{id}/re-examination

Mutation của cái PUT đó invalidate `patientTreatments`, `treatmentLines`,
`patientStages`, `patientTimeline` **và** các query thanh toán — vì tiền công
thay đổi theo. Toast: **"Cập nhật thành công"**; lỗi: **"Không thể cập nhật công
đoạn"**.

Giao diện đo được: list `space-y-3`, mỗi dòng một label `flex gap-3` 14px +
checkbox **20px** bo **4px** viền `slate-400`, tick rồi thì nền + viền
`#2671D8` chữ trắng. Form mở ra **không tick sẵn** ô nào.

| # | Việc | Đã làm |
|---|------|--------|
| R-278 | Form chỉ in `Danh sách công đoạn` → `(Trống)` cho có | `StageStepList` dùng chung cho **hai** chỗ: ở form nó chọn công đoạn này gồm những bước nào, ở bảng lịch sử nó tick từng bước đã xong. Bước lấy từ dịch vụ nên đổi tên trong Danh mục là hiện ra ngay — không copy tên xuống công đoạn |
| R-279 | Công đoạn không lưu được bước nào | `TreatmentStage.ServiceItems` (owned `ToJson` như `Teeth`, migration `20260907120000_AddStageServiceItems`), `SetServiceItems` lúc tạo — **luôn lưu chưa tick** — và `UpdateServiceItems` để tick/bỏ tick. Bước không thuộc công đoạn thì **từ chối** (`BlueDental:Treatment:0025`) chứ không âm thầm thêm vào |
| R-280 | Không có chỗ tick | `PUT api/v1/app/treatment-stages/{id}/service-items` gác bởi ability `treatmentStage.update`. Payload là **cả danh sách** — bước không gửi lên coi như bỏ tick, đó là cách một endpoint làm được cả hai chiều, đúng như tên endpoint của bản gốc |
| R-281 | Cột **Công đoạn** ở bảng lịch sử chỉ in tên công đoạn | Nay là list checkbox của chính công đoạn đó; tick/bỏ tick gọi PUT rồi toast **"Cập nhật thành công"** — đúng chữ bản gốc |

Tick lần hai **không** ghi đè `completedAt` / `staffId` của lần đầu; bỏ tick thì
xoá cả hai.

### Đo lại trên bản build — một vòng đầy đủ

    FORM STEPS 1 | labels: abc          none ticked: true
    CREATED 200  -> [{ isCompleted: false }]
    HIST STEPS 1 -> ticked before: 0
    PUT 200      -> [{ isCompleted: true, completedAt: 2026-09-07T11:06:25Z, staffId: 3a2344c2... }]
    TOAST: Cập nhật thành công          ticked after: 1

Seeder demo nay khai bước cho **Điều trị tủy** (3 bước), **Bọc răng sứ Zirconia**
(3) và **Niềng răng mắc cài** (2), còn dịch vụ một lần khám thì **không** — bản
gốc để trống với loại đó và màn hình phải chịu được cả hai trạng thái.

### Test

Spec thường trú `Danh sách công đoạn picks the service's steps, then ticks them
off from the row`: khẳng định form hiện đúng số bước của dịch vụ và **không**
tick sẵn; tick một bước rồi lưu → công đoạn giữ bước đó ở trạng thái **chưa
tick**; bảng lịch sử hiện bước đó; tick → PUT trả `isCompleted: true` có đóng
dấu **ai** và **khi nào**, kèm toast; bỏ tick → PUT trả `false` và `completedAt`
**null** (chứng minh chạy **cả hai chiều**); reload vẫn còn. Domain thêm 5 test
(chọn lúc tạo thì chưa tick, không trùng bước, tick đóng dấu ai/khi nào và bỏ
tick xoá sạch, bước lạ bị từ chối, tick hai lần giữ mốc đầu). Application thêm 8
test contract (DTO, ability, và **payload là cả danh sách** chứ không phải một
bước).

> **Chưa làm, đã ghi `unknowns.md`:** phần **tiền công** (`earningId`,
> `earningAmount`, `isCreatedEarning`, `valueType`, `isMarketingSalary`) và
> `progress` của dòng dịch vụ. Nó kéo sang lương nên để ngoài phạm vi đợt này —
> chủ dự án đã được báo trước khi làm.
>
> **Hai thứ không quan sát được** vì phải ghi lên production: payload chính xác
> của cái PUT (tên endpoint + response cho thấy là cả danh sách, nên gửi cả
> danh sách), và ở bảng lịch sử có tick được bước **chưa** chọn lúc tạo hay
> không (mọi công đoạn đọc được chỉ liệt kê bước nó đã có → mô hình "chọn lúc
> tạo, tick sau").

### R-282 — `WithDetailsAsync` chỉ include một navigation, làm rụng `warrantyDays`

Chạy cả bộ sau khi làm xong "Danh sách công đoạn": **5 đỏ**, cả 5 đều chết ở
cùng một chỗ — `openPatientWithTreatment(page, "warrantable")` trả **null**.

Tôi đã chẩn đoán **sai** lần đầu: kết luận là "fixture cạn kiệt" (mấy spec đó
hoàn thành dòng bảo hành nên dùng hết), rồi viết thêm ~100 dòng fixture tự dựng
dòng có bảo hành qua chuỗi advise → accept → open plan. Nó vẫn đỏ. Đo tiếp thì
chuỗi chạy **200 cả ba bước** mà dòng tạo ra vẫn `warrantyDays: 0`:

```
raise 200 · accept 200 · open 200
fromPost [{ w: 0 }]      fromList [{ w: 0, st: 1 }]
catalog: 10 dịch vụ có warrantyDays 365, cùng branch với advise
```

Nguyên nhân thật là **lỗi tôi vừa gây ra ngay trong đợt này**. Chỗ đó vốn là một
**projection**, nên EF tự nạp `ServiceConfig`:

```csharp
var catalogQuery = await _catalogRepository.GetQueryableAsync();
var catalogRows = catalogQuery.Where(...)
    .Select(c => new { c.Id, c.Name, Warranty = c.ServiceConfig == null ? 0 : c.ServiceConfig.WarrantyDays })
```

Để lấy thêm `Stages` cho form, tôi đổi sang `WithDetailsAsync(c => c.Stages)` và
đọc `c.ServiceConfig?.WarrantyDays ?? 0`. `WithDetailsAsync` include **đúng
những gì được kể tên**, nên `ServiceConfig` là `null` với **mọi** entry →
`warrantyDays` = 0 khắp nơi → **không dòng nào còn mời Bảo hành**, và fixture
`warrantable` không tìm thấy gì.

Sửa: include **cả hai** navigation.

```csharp
var catalogQuery = await _catalogRepository.WithDetailsAsync(
    c => c.Stages,
    c => c.ServiceConfig);
```

Đã bỏ luôn phần fixture tự dựng — nó sinh ra từ chẩn đoán sai, và việc tìm dòng
sẵn có vốn không có vấn đề gì.

> **Bài học.** `?.` trên một navigation **chưa** include thì im lặng ra
> `null`, và `?? 0` biến nó thành một con số **trông có vẻ hợp lệ**. Không có
> exception, không có log — chỉ có một cột đọc ra 0. Khi đổi một projection sang
> `WithDetailsAsync`, phải kể tên **mọi** navigation mà đoạn code phía sau đọc
> tới. `TreatmentStageAppService` cũng include một mình `c => c.Stages` nhưng
> chỗ đó chỉ đọc `Name` với `Stages` nên không sao — đã kiểm lại.

---

## 2026-09-07 (tối) — Thanh toán nhảy đúng phiếu, và "Danh sách công đoạn" trên tái khám

> **Đánh số**: hai mục dưới đây lấy R-274, R-275 — số kế tiếp của dãy nhánh
> (cao nhất trước đó là R-273). Khối F-39 lấy từ `main` khi rebase **vẫn đang
> trùng** dải R-234…R-251 với đợt 9/10 của nhánh; khi đánh số lại khối đó, phải
> chọn dải **trên** R-275 để khỏi đụng tiếp. Xem phần rebase cùng ngày.

Cả hai lệch đều do chủ dự án chỉ ra. Soi lại bản gốc trên staging, **chỉ đọc**:
đăng nhập, mở trang, mở dialog rồi đóng bằng nút Đóng, đọc DOM + `getComputedStyle`
+ React fiber, và đọc **bundle** tĩnh (`chunk 0568b3ed70779de1.js` — rule 00 cho
phép đọc static asset). Kiểm lại network sau khi xong: **không một request
POST/PUT/PATCH/DELETE nghiệp vụ nào**, chỉ `auth/refresh` và socket.io polling.

| # | Lệch | Sửa |
|---|---|---|
| R-274 | Nút **Thanh toán** trong "Chi tiết phiếu" nhảy về `?tab=treatment-plan` — danh sách **mọi** phiếu, không phải phiếu của dòng vừa bấm | Nhảy đúng `/patient/{id}/treatment-plan/{planId}?planTab=detail&branchId=` |
| R-275 | "Danh sách công đoạn" trên "Tạo tái khám" luôn in `(Trống)` | Dựng đúng mục bản gốc sinh ra |

### R-274 — Thanh toán đi đâu

Đo trên bản gốc: bấm Thanh toán trong "Chi tiết phiếu" điều hướng tới

    /patient/{patientId}/treatment-plan/{planId}?planTab=detail&branchId={branchId}

`planTab` đứng **trước** `branchId`. Đối chứng ngay cạnh: chip mã **DT** ở tab
Kế hoạch điều trị đi tới cùng trang nhưng **không** kèm `planTab` (`?branchId=`
thôi, để trang tự rơi về Chi tiết). Hai đường khác nhau thật, nên
`planDetailPath` nhận `tab` là **tham số tuỳ chọn** — mặc định giữ nguyên hành
vi cũ của chip DT, chỉ đường Thanh toán mới truyền `PLAN_TAB.detail`.

Sửa ở ba chỗ mở `TreatmentStageDialog`: `PatientProfileTab` và
`TreatmentPlanPanel` nay `navigate` tới trang phiếu; `PlanServicesTab` vẫn chỉ
đóng dialog vì nó **đã** ở chính trang đó.

Doc `patient-detail.md` mô tả đúng hành vi này từ trước (mục "The three hidden
modals, and Thanh toán") — chỉ code là lệch, còn một dòng ghi chú cũ ở phần khác
vẫn viết `?tab=treatment-plan`; đã sửa.

### R-275 — "Danh sách công đoạn" trên tái khám **không** phải công đoạn của dịch vụ

Đây là chỗ dễ hiểu nhầm nhất, và bundle nói dứt điểm:

```js
a = l5(e.content)            // trim; riêng "—" coi như rỗng
stageChecklist: a ? [{ id: `${e.id}-re-examination-stage`, label: a, checked: !1 }] : []
```

Nhãn checkbox là **Nội dung điều trị** của chính công đoạn đã hoàn tất, không
bao giờ là tên một step trong Danh mục, và **nhiều nhất một mục**. Trước đó tưởng
là trùng hợp vì trên máy khảo sát note và tên step tình cờ giống nhau ("123"); key
React `...-re-examination-stage` mới là thứ lật lại được.

Hai nơi vẽ khác nhau:

| Nơi | Tick | Bấm được | Nhãn |
|---|---|---|---|
| Dòng trong dialog "Tạo tái khám" | không bao giờ | **disabled** | `font-semibold text-primary` = **#2671D8**, weight 600 |
| Form sau khi bấm `Tái Khám` | bắt đầu chưa tick | **tick được** | chữ thường |

Rỗng thì in `(Trống)`. Form giữ nhãn của công đoạn nguồn dù ô Nội dung điều trị
của nó để trống — vì item được **clone** từ dòng listing chứ không dựng lại.
"Tạo bảo hành" đi nhánh còn lại của cùng mapper (`stageChecklist: []`), nên
**luôn** `(Trống)` — phần này ta đã đúng sẵn.

Dựng: `stage/reExaminationChecklist.ts` sinh mục, `StageStepList` nhận thêm
`tone` (`accent` = #2671D8/600 cho dòng read-only, và **không** để AntD làm mờ
nhãn theo ô disabled). `useFollowUpForm` giữ `pickedSteps` cục bộ. Việc tick có
gửi gì lên server hay không **chưa quan sát được** (phải bấm Lưu trên bản gốc mới
biết, tức là ghi thật) — đã ghi `unknowns.md`.

### Chạy thật

Bản build production, `vite preview` cổng **8098**, API `:5019`, Postgres/Redis/
MinIO docker thật. `tsc --noEmit` 0 lỗi, `oxlint` 0 lỗi.

- 4 spec liên quan xanh: Thanh toán nhảy đúng URL + tab Chi tiết đang mở; nhãn
  checklist = note trên **cả hai** màn tái khám, đúng màu #2671D8, disabled ở
  listing và tick được ở form; bảo hành vẫn `(Trống)`.
- Một spec cũ phải sửa vì thay đổi này là **đúng**: "Tạo Tái khám lists the công
  đoạn that are finished" dùng `row.getByRole("checkbox")`, nay dòng có **hai**
  checkbox nên strict mode gãy — thu hẹp về `.pd-recall-actions`.
- Bộ đầy đủ `patient` + `treatment-plan` + `treatment-plan-detail` +
  `treatment-stage`: **61 xanh / 2 đỏ**, cả hai đỏ **không phải** do đợt này —
  đã xác minh bằng cách `git stash` toàn bộ thay đổi, build lại và chạy lại:

  1. `treatment-plan-detail.spec.ts` — "the slip code opens the detail page…"
     đỏ ở `Doanh thu dự kiến > 0`. **Đỏ y hệt trên baseline.** Nguyên nhân là
     **rác dữ liệu test**: `createSlip()` chọn dịch vụ **đầu tiên** trong
     dropdown, mà đầu bảng giờ là catalog sót lại từ e2e taxonomy
     (`A 280044`, `ROW A 250361`) có `Price = 0.00`. Thuộc F-39 (đang `DIRTY`);
     cách sửa bền là spec tự tạo/chọn dịch vụ có giá.
  2. `patient.spec.ts` — "the Tiếp nhận steps advance one at a time" đỏ ở
     `booked === null`. Đúng cái chính comment của spec cảnh báo: nó **tiêu thụ**
     một lịch hẹn demo mỗi lượt. Xanh ở lượt chạy đầu phiên, đỏ sau khi chạy
     suite lần thứ ba. Cần seed lại, không phải lỗi code.

### R-283 — công đoạn đã Hoàn thành vẫn nằm trong "TIẾP TỤC CÔNG ĐOẠN"

Chủ dự án soi lại `Chi tiết phiếu` trên bản gốc (staging, chỉ đọc): tick
`Hoàn thành` một công đoạn thì dòng dịch vụ **rời khỏi** tab
`TIẾP TỤC CÔNG ĐOẠN`. Ta thì vẫn để nguyên — `useStageComposer` chia hai tab
bằng đúng một câu hỏi "dòng này đã có công đoạn nào chưa":

```ts
const inTab = (line) =>
  tab === "add" ? !stagedLineIds.has(line.id) : stagedLineIds.has(line.id);
```

nên một dòng đã đóng vẫn được mời tiếp tục, mãi mãi.

| # | Đo được | Đã làm |
|---|---|---|
| R-283 | Dòng đã đóng vẫn ở tab 2, vẫn tính vào badge, và vẫn mở được form | `closedLineIds` — dòng có công đoạn **live** đang `Completed` — bị loại khỏi tab 2 và khỏi badge. **Không** bị đẩy sang tab 1: tab 1 là "chưa có công đoạn nào", dòng này có lịch sử. Nó chỉ còn ở LỊCH SỬ ĐIỀU TRỊ bên dưới |
| R-284 | Form vẫn đứng sau dòng vừa bị loại | `line` nay tra trong `offered` chứ trong cả phiếu, nên tick `Hoàn thành` lúc form đang mở thì form đóng lại về câu nhắc `Chọn công đoạn ở cột chi tiết…` thay vì cho ghi thêm một công đoạn vào dòng vừa đóng |

**Chọn "công đoạn live" chứ không phải "tất cả công đoạn" — có lý do.**
Lần đầu tôi viết theo luật của server (`MoveServiceLineAsync`: dòng dịch vụ
đóng khi **mọi** công đoạn của nó đóng). Viết xong mới thấy nó bít đường:
`StageHistory` để `disabled={!live}` trên ô `Hoàn thành`, tức là **chỉ** công
đoạn mới nhất tick được. Một dòng có công đoạn cũ còn mở — mà spec
"finishing one công đoạn leaves the others open" dựng ra đúng tình huống đó —
sẽ không bao giờ tick hết được, nên sẽ **mắc kẹt** trong tab 2 vĩnh viễn. Luật
theo công đoạn live thì đảo được cả hai chiều: tick thì mất, bỏ tick thì về.

Hệ quả là ở trạng thái đó tab 2 nói khác trạng thái dòng dịch vụ (server vẫn
để `InProgress` vì còn công đoạn cũ mở). Đó là **cố ý**: tab là "còn gì để làm
tiếp không", và câu trả lời do bước đang làm quyết định.

### R-285 — "thêm/tiếp tục công đoạn" báo lỗi bằng toast, không báo dưới ô

Cùng đợt soi: form tái khám (R-274…R-276) đã báo lỗi **dưới từng ô**, còn form
công đoạn — cùng ba ô bắt buộc, cùng một layout — vẫn `toast.error` và vẫn báo
**lần lượt** (ba lần bấm mới biết hết ba ô trống).

| # | Đo được | Đã làm |
|---|---|---|
| R-285 | Ba `if` + `toast.error` nối tiếp trong `save()` | Rút luật ra `stage/stageFieldErrors.ts`: một hàm trả về cả ba thông báo một lượt. Cả form công đoạn và `useFollowUpForm` dùng chung — `FollowUpErrors` bỏ, đổi thành `StageFieldErrors` |
| R-286 | Không biết ô nào sai | `StageForm` nhận `errors`, in `.pd-stage-error` 12px đỏ dưới Bác sĩ / Răng / Nội dung điều trị, và đặt `status="error"` cho chính ô đó. Sửa ô nào thì thông báo ô đó tắt; đổi dòng dịch vụ thì sạch hết |

Ô `Răng` ở form công đoạn kế thừa răng của dòng dịch vụ nên trên thực tế không
sai được — nhưng thông báo vẫn có chỗ đứng dưới nó, đúng chỗ bản gốc để, thay
vì im lặng nếu dữ liệu dòng hỏng.

### Chạy thật

Bản build production, `vite preview` cổng **8080**, API `:5019`,
Postgres/Redis/MinIO docker thật. `tsc -b` 0 lỗi, `oxlint` 0 lỗi.

Hai spec mới trong `e2e/patient.spec.ts`, cả hai đi thẳng API thật:

- *a công đoạn marked Hoàn thành leaves TIẾP TỤC CÔNG ĐOẠN* — mở tab 2, thấy
  dòng (khoá theo `data-line-id` mới trên nút chọn), chọn nó để mở form, tick
  `Hoàn thành`, rồi đo: nút chọn mất, badge giảm đúng 1, form đóng về câu nhắc,
  **và** tab 1 cũng không có nó trong khi dòng lịch sử của nó vẫn còn. Bỏ tick →
  `POST …/revert-status` 200 → dòng và badge trở lại. Reload rồi mở lại: vẫn
  đúng, tức là trạng thái nằm ở server chứ không ở state của dialog.
- *the công đoạn form reports its empty fields under them, not in a toast* —
  bấm lưu với ô trống: thông báo hiện trong `.pd-stage-error`, **không** có
  toast nào, và `POST /treatment-stages` **không** hề rời trình duyệt (bắt bằng
  `page.on("request")`). Gõ nội dung → thông báo tắt → bấm lại thì lưu 200 và
  ghi chú xuất hiện trong lịch sử.

Cả bộ `patient.spec.ts` (Level 2 cho F-38, gồm cả các spec tái khám/bảo hành vì
`useFollowUpForm` dùng chung `stageFieldErrors`): **56 xanh / 1 đỏ**. Đỏ là
*"the Tiếp nhận steps advance one at a time"* — `booked === null`, đúng cái đỏ
đã ghi ở phần "Chạy thật" của R-282: spec tự **tiêu thụ** một lịch hẹn demo mỗi
lượt và hết chỗ đặt. Nó chết ở bước dựng dữ liệu, trước khi có UI nào được vẽ,
và nằm ở nhánh `.pd-appt-steps` mà đợt này không chạm tới — cần seed lại, không
phải lỗi code.

### R-287 — luật "phải có ảnh mới hoàn thành được" là do tôi bịa

Chủ dự án bấm `Hoàn thành` trên bản gốc và báo: **không** cần tải ảnh. Bên ta thì
toast đỏ *"Dịch vụ này cần đính kèm ảnh trước khi hoàn thành công đoạn."*
(`403 BlueDental:Treatment:0019`).

Truy lại thì luật này chưa bao giờ được **quan sát**. Nó ra đời ở commit
`e835c45`, và chính commit đó đã tự khai là phỏng đoán:

> The reference never exposed a stage payload that could be read without
> mutating production. […] A service whose catalog entry requires an image
> refuses completion until one is attached.

Cái **cờ** thì thật — `"Yêu cầu hình ảnh khi điều trị"` có trong dialog Dịch vụ
của bản gốc và đi kèm payload (`service.isImageRequired`). Cái **hệ quả** thì
tôi tự suy ra, rồi `TreatmentStage.Complete()` chặn thật.

| # | Đo được | Đã làm |
|---|---|---|
| R-287 | `Complete()` throw `StageImageRequired` khi `IsImageRequired` và chưa có ảnh | Bỏ hẳn guard. Xoá luôn hằng `StageImageRequired` (không tái sử dụng mã 0019, để log cũ còn đọc được) và hai dòng vi/en. Cờ vẫn được **ghi** lên công đoạn vì đó là cờ của danh mục, nhưng không chặn gì |
| R-288 | Test domain khoá luật sai | `A_service_that_requires_an_image_refuses_completion_without_one` → đổi thành `..._still_completes_without_one`: bật cờ, không ảnh, vẫn `Completed` |
| R-289 | Fixture e2e phải nói dối để chạy được | `addStage` từng ép `isImageRequired: false` để né 403 (chính là R-244). Nay để trống — công đoạn thừa hưởng danh mục — và nhận thêm tham số `imageRequired` cho spec nào cần bật cờ |
| R-290 | Ba tài liệu chép lại luật sai | `docs/testing/features/treatment-stage.md`, `docs/clone/business-features.md` sửa thành "ghi nhận, không cưỡng chế"; thêm mục `UNKNOWN_REFERENCE_BEHAVIOR` cho câu hỏi **cờ đó thực sự làm gì** — muốn biết phải tick `Hoàn thành` trên công đoạn thật của bản gốc, tức là ghi, nên không làm |

Hai chỗ FE còn đọc cờ đều chỉ là **gợi ý**, không chặn, nên giữ nguyên: tag
`Cần ảnh` ở `TreatmentStagePanel` và `Alert` ở `AdviseModal`.

**Về hai toast trùng nhau trong ảnh chủ dự án gửi:** ô `Hoàn thành` được điều
khiển bởi câu trả lời của server, không bởi cú click — thất bại thì ô không tick,
nên bấm lại là phản xạ tự nhiên, và mỗi lần bấm là một toast. Không phải lỗi phát
hai lần; hết luật sai thì hết cả toast.

### Chạy thật

- Backend: `dotnet build` 0 lỗi/0 warning; **893 test xanh** (Domain 292,
  Application 536, EF Core 51, HttpApi.Host 14).
- Spec mới `Hoàn thành ticks with no image, even on a service that asks for one`
  — bật `isImageRequired: true` ngay trên công đoạn để không phụ thuộc danh mục
  demo, xác nhận dòng **không** có ảnh, rồi đóng qua `finishLiveStage` (helper
  này throw kèm nguyên body của server nếu bị từ chối, nên 403 sẽ đỏ rất rõ),
  đo ô đã tick, đo **không** có chữ "cần đính kèm ảnh", reload rồi đọc chip của
  dòng ngoài bảng = `Hoàn thành`. Chạy `--repeat-each=3`: xanh cả ba.
- Lần viết đầu tôi tự cầm cú click và `waitForResponse` → đỏ một lượt vì đúng cái
  race mà `finishLiveStage` đã ghi chú dài dòng (click rơi vào giữa lượt refetch
  thì bị nuốt, không có request nào rời trình duyệt). Đã bỏ, dùng lại helper.
- `patient.spec.ts` + `treatment-stage.spec.ts` trên bản build production
  (`vite preview` 8080, API `:5019` đã build lại, DB thật): **59 xanh / 1 đỏ**.
  Đỏ vẫn đúng một cái đã ghi ở R-282 — *"the Tiếp nhận steps advance one at a
  time"*, `booked === null`: spec tự tiêu thụ một lịch hẹn demo mỗi lượt và hết
  chỗ đặt. Chết ở bước dựng dữ liệu, nhánh `.pd-appt-steps`, không liên quan
  `Complete()`.
- Phải **dừng API đang chạy** (PID 26596) mới build lại được — nó giữ khoá các
  DLL trong `bin`. Đã build lại và bật lại trên đúng `:5019`.

### R-291 — "Ghi chú" ở Chi tiết dịch vụ nối hết note của mọi công đoạn

Chủ dự án mở "Chi tiết dịch vụ" và thấy ô `Ghi chú` dài một đoạn:

> Ghi chú: e2e ghi chú …, e2e nhóm A …, e2e nhóm B …, e2e cũ …, e2e mới …,
> e2e labo …, e2e màu …, e2e in phiếu …, e2e dưới ô …, e2e không bảo hành …,
> e2e không cần ảnh … (×5)

**Vì sao dài:** đó là rác e2e, và ô đó in **mọi** note. Query DB local: dòng
`DT03-01` có **15 công đoạn**, tất cả tạo trong ngày bởi chính các lượt chạy
acceptance (6 dòng do đợt hôm nay). Toàn DB demo cũng vậy — `DT17-02` 81 công
đoạn / 79 note `e2e%`. Chủ dự án chọn **chưa dọn**.

**Nhưng cái dài là lỗi thật, không phải chỉ do rác.** Code nối hết:

```tsx
[t("Ghi chú"), (line?.stageNotes ?? []).join(", ")],
```

nên nó dài thêm một đoạn sau **mỗi** công đoạn — dữ liệu thật của phòng khám
cũng sẽ như vậy. Và cái `join` này tôi **tự đoán**: R-261 đo dialog tới từng
pixel nhưng không hề ghi ô `Ghi chú` chứa gì.

**Đã soi lại bản gốc** (staging, chỉ đọc, tài khoản chủ dự án cấp; không mở form
Tái Khám, không submit, không ghi gì). Dialog gọi
`GET /v1/treatment-services/{id}` — **một** document dịch vụ, không phải list đã
lọc — và document đó mang:

| Trường | Ý nghĩa |
|---|---|
| `note` ở top level | note **của chính dòng dịch vụ** |
| `patientStages[]` | mỗi công đoạn có `note` **riêng** |

Dòng được soi có **3** công đoạn hoàn tất. Giá trị in ra bằng đúng `note` của
document, và **không** note nào của 3 công đoạn xuất hiện — không nối, không lấy
mẫu. Note của công đoạn có chỗ riêng: cột **Nội dung điều trị** của chính dòng
`Tạo tái khám` mà dialog được mở từ đó.

| # | Đo được | Đã làm |
|---|---|---|
| R-291 | `Ghi chú` = `stageNotes.join(", ")` | Đổi thành `line.note` — trường vốn đã có sẵn trên DTO (`TreatmentService.Note`, từ "Thêm dịch vụ mới") mà ô này không dùng. Rỗng thì in em dash như mọi fact rỗng khác |
| R-292 | Không có cách khoá đúng một dòng trong listing Tái khám | `.pd-recall-row` thêm `data-line-id` / `data-stage-id`, cùng khuôn với `.pd-stage-histrow` và `data-row-key` của bảng điều trị |

`stageNotes` **giữ lại** trên DTO: `PlanSummaryCards` dùng `stageNotes.at(-1)`
cho cột "Nội dung điều trị" của kế hoạch, chỗ đó đúng là stage-driven.

Bonus đo được cùng lượt: `staffDiagnosisId` / `staffDiagnosisSecondId` /
`adviseStaffId` / `adviseStaffSecondId` là bốn ô nhân sự của khối
`THÔNG TIN NHÂN VIÊN`, và cả bốn đọc `—` trên dòng được soi — nên bốn em dash
của ta ở đó là **parity**, không phải lỗ hổng. Đã ghi vào
`docs/clone/pages/patient-detail.md` (chỉ cấu trúc, không giá trị — theo
`01-production-data.md`; bản capture nằm trong `reference-private/`, đã gitignore).

### Chạy thật

- Spec mới `Chi tiết dịch vụ prints the line's own Ghi chú, not its công đoạn's`:
  tạo công đoạn với note biết trước, đóng nó, mở `Tạo tái khám`, khoá **đúng**
  dòng bằng `data-stage-id`, xác nhận dòng đó **có** in note công đoạn (cột Nội
  dung điều trị), rồi mở `Chi Tiết` và đo ô `Ghi chú` **không** chứa note đó.
  Với code cũ spec này sẽ đỏ.
- Lần viết đầu đỏ ở `.pd-recall-row[data-line-id=…].first()`: dòng dịch vụ này
  đã có nhiều công đoạn hoàn tất từ các lượt trước nên `.first()` không phải cái
  vừa thêm. Đổi sang khoá theo `data-stage-id`.
- `patient.spec.ts` + `treatment-stage.spec.ts` trên bản build production
  (`vite preview` 8080, API `:5019`, DB thật): **60 xanh / 1 đỏ**. Đỏ vẫn đúng
  một cái đã ghi ở R-282 — *"the Tiếp nhận steps advance one at a time"*,
  `booked === null`, spec tự tiêu thụ lịch hẹn demo. `tsc` sạch, `oxlint` sạch.

---

## 2026-09-07 (đêm) — Chẩn đoán & Tư vấn: form chẩn đoán tại chỗ, chân phiếu theo staging

Chỉ FE. Xem `docs/clone/pages/patient-detail.md` mục 2026-09-07.

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-252 | Chuỗi răng trong bảng chẩn đoán/tư vấn không đúng dạng bản gốc; mặt răng gọi chung một tên không theo góc phần tư | `formatTeeth` / `toothLabels` trong `consultingApi.ts` dùng `surfaceLabel` của `ToothChart` dùng chung → "18, 16 - Mặt ngoài, Mặt nhai"; áp dụng cho mọi nơi gọi `formatTeeth` |
| R-253 | Chip "Răng đã chọn" bị cắt chữ và nút X tràn ra ngoài khi nhãn dài ("16 - Mặt ngoài, Mặt nhai") | `.pd-tooth-chip` `white-space: nowrap`, padding `6px 16px 6px 12px`; hộp chip `padding: 4px 8px 0 0`; đo 43×28 và 175×28 |
| R-254 | Hàng lệnh chân "Phiếu tư vấn" rớt hai dòng ở 1600px, nút in cao 40px | `.pd-plan-summary` cột `minmax(0,1fr) minmax(0,1.45fr)`, `.pd-plan-print` 36×36; select 296, nút 200/131 như staging |
| R-255 | Chân phiếu có công tắc giảm giá %/VNĐ nhưng staging không có; thiếu khối "Voucher áp dụng" | Bỏ công tắc; thêm `AdviseVoucherPicker` (popover tìm voucher, trạng thái rỗng của bản gốc) |
| R-256 | `treatment-plan.spec.ts` "tạo kế hoạch" đếm số dòng +1 nhưng danh sách đã đủ 20/trang → "Expected 21 Received 20" | Test chờ `expect.poll` thấy **mã mới** không có trong danh sách trước, thay vì đếm |
| R-257 | `treatment-stage.spec.ts` hai test đầu tìm nút "Chọn Răng"/"Hàm Trên" bằng `role=button` và chữ "Răng đã chọn: —" của form cũ → không tìm thấy | Đổi sang `role=tab`, kiểm tra chip qua `data-testid=selected-teeth`, chọn "Hàm Trên" thì một chip "Hàm trên" và sơ đồ răng gập |

Mức retest: **2** cho F-09, thêm **3** một phần vì `ToothPickerTabs` /
`DentitionRadio` chuyển sang `src/components/ToothChart` (dialog chọn răng
của kế hoạch dùng chung). Bản build production `vite build` + `vite preview
--strictPort` cổng **8081** (8080 là preview cũ của checkout khác), API
`:5000`, PostgreSQL thật, đăng nhập thật, không chặn API:

- `e2e/patient.spec.ts` (nhóm Chẩn đoán & Tư vấn) **4/4** — gồm test mới
  "Lưu Chẩn Đoán": chọn bác sĩ, chẩn đoán, răng 18 + hai mặt răng 16, chờ
  `POST /api/v1/app/patient-diagnoses` 2xx, dòng đầu ghi
  "18, 16 - Mặt ngoài, Mặt nhai", mã `CDxx-xxxx`, reload vẫn còn.
- `e2e/treatment-stage.spec.ts` **2/2**, 16s.
- `e2e/treatment-plan.spec.ts` **5/5**; `e2e/treatment-plan-detail.spec.ts`
  **6/6** (dialog chọn răng dùng component chuyển đi).
- `tsc --noEmit`, eslint (file đã sửa) và `vite build` sạch. **Chưa commit.**

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-258 | Bấm ảnh trên panel tư vấn chỉ mở preview mặc định của AntD (`Image.PreviewGroup`), không có các thao tác như tab Hình ảnh (xoay, lật, zoom, vẽ chú thích, dải thumbnail) | Panel dùng lại `PatientImageViewer` của tab Hình ảnh; ảnh về `PatientImageViewModel` qua `adaptPatientImage` ngay trong `useConsultingData`; mỗi ô ảnh là `button.pd-image-tile`; dialog "Chọn ảnh hiển thị" tách ra `ConsultingImagePicker` (nhóm ngày bằng `groupImagesByDay`) |

Retest R-258: Level 2. Build production, `vite preview` cổng 8081, API `:5000`:
nhóm Chẩn đoán & Tư vấn trong `e2e/patient.spec.ts` **5/5** — test ảnh giờ
kiểm tra viewer `patient-image-viewer`, bộ đếm "1 / N", thanh công cụ "Công cụ
xem ảnh" (Vẽ chú thích, Xoay phải, Lật ngang, Zoom gần, Đóng), dải thumbnail,
xoay ghi `--pi-rotate: 90deg` lên khung, Escape đóng. tsc, eslint, build sạch.
Chưa commit.

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-259 | Có ảnh rồi mà ô xám "Kéo ảnh vào hoặc bấm nút để tải lên" vẫn nằm trên panel, ảnh xếp phía dưới — staging thay ô đó bằng ảnh, xếp từ trên xuống ngay dưới ba nút | `.pd-image-drop` chỉ vẽ khi chưa có ảnh; cả panel nhận kéo-thả file (`pd-image-panel--over`); ảnh xếp theo thứ tự của dialog (ngày mới nhất trước, trong ngày theo `ordering`) |
| R-260 | Nút kẹp (trước nút xoá) trên thẻ ảnh trong "Chọn ảnh hiển thị" chưa làm gì | Kéo bằng `@dnd-kit` như tab Hình ảnh: `ConsultingImageCard` dùng `useSortable`, kẹp là activator; `usePatientImageReorder` tách phần lõi `useReorderWithCache` (ghi cache lạc quan, `PUT /reorder`, rollback + toast) rồi thêm `useConsultingImageReorder` vá cache `patientImageKeys.list`; chỉ hiện kẹp khi `canSort` |
| R-261 | Thẻ trong dialog xuống dòng thành lưới, staging xếp một hàng ngang cuộn ngang | `.pd-image-cards` `flex-wrap: nowrap; overflow-x: auto`, thẻ `flex: 0 0 280px`; chiến lược kéo đổi sang `horizontalListSortingStrategy` |
| R-262 | Hai nút tròn trên thẻ bị dẹt 40×34 — AntD `.ant-btn-circle` đặt `min-width` bằng chiều cao control với độ ưu tiên cao hơn rule cũ | Rule `.pd-image-card-actions .ant-btn.ant-btn-circle.ant-btn-circle` ghim 34×34, `padding: 0`, `border-radius: 50%` |

Retest R-259/R-260/R-261: Level 2, build production, `vite preview` 8081, API
`:5000`: nhóm Chẩn đoán & Tư vấn trong `e2e/patient.spec.ts` **6/6**, gồm test
mới kéo kẹp thẻ thứ hai lên thẻ đầu trong dialog (chờ `PUT …/reorder` ok, tên
đổi chỗ, panel phía sau đổi theo, reload vẫn giữ, rồi kéo trả lại). Tab Hình
ảnh không chạy lại (chủ dự án tự kiểm tra). R-262 chỉ sửa CSS sau lượt test
đó — chủ dự án tự kiểm tra, không đo lại. tsc, build sạch. **Chưa commit.**

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-263 | "Tổng thành tiền" ở chân "Phiếu tư vấn" cộng cả bảng (`patient-advises/summary`), staging chỉ cộng các dòng đã tick: chưa tick đọc "0 đ" | `usePlanVoucher(rows, selected, branchId)` cộng `effectiveAmount` của các dòng trong `selected`; `PatientAdviseCard` nhận một prop `plan` thay cho `summary`; `useConsultingData` bỏ query summary |
| R-264 | Popover "Chọn voucher" chưa tải voucher — luôn hiện câu rỗng; ô tìm thiếu placeholder "Tìm voucher theo mã hoặc tên..." của staging; popover 280px, staging ~520px | `useAvailableVouchers` (`GET /api/v1/app/vouchers/available?orderAmount=…`, BE đã có) thêm vào `voucherApi`; hook lọc `scopeTarget = treatment`, tìm mã/tên tại chỗ, chọn/bỏ từng dòng, voucher độc quyền đứng một mình, voucher không còn đủ điều kiện khi tổng đổi thì tự rớt; "Tổng tiền" = tổng − giảm giá (`calculateVoucherDiscount` cùng công thức BE); mã đã chọn thay câu nghiêng dưới nút; CSS `.pd-voucher-popover` 520px, `.pd-voucher-search`, `.pd-voucher-list`, `.pd-voucher-row` |

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-265 | Dialog "Tạo dịch vụ" cũ là form một dịch vụ, staging là dialog "Chọn Dịch Vụ": răng/bác sĩ đọc từ phiếu, nhân sự tư vấn 1–2, nút nhóm dịch vụ, tìm kiếm, bảng tick nhiều dịch vụ với giá/số lượng/giảm giá/ghi chú từng hàng, thẻ tổng kết và Lưu | `AdviseModal` dựng lại trên `.tp-dialog` + `advise/advise-modal.css` (màu qua `--tp-accent` = `--bd-primary`); `useAdviseSelection` giữ draft từng dòng (Map theo id, sống qua lọc), `useCreateAdvises` gửi `POST patient-advises` lần lượt từng dòng tick, dừng và báo dòng lỗi; `toothSelectionsToValue` (ToothChart) đổi răng của phiếu về `ToothPickerValue`; dải nhóm một hàng cuộn ngang |

Retest R-265: không đo (chủ dự án tự kiểm tra, không viết test theo yêu cầu).
tsc, eslint, `vite build` sạch; mở thử trên preview 8081 với API `:5000`:
dialog mở đúng phiếu, tick một dòng hiện editor và tổng kết, không lỗi
console. **Chưa commit.**

Retest R-263 → R-264 (2026-09-07, Level 2, build production `vite preview`
cổng 8083 vì 8080/8081/8082 đang có tiến trình khác, API thật :5000, DB thật):
`patient.spec.ts` nhóm Chẩn đoán & Tư vấn 6/6 — gồm test mới "the plan total
counts only the ticked rows and a plan voucher comes off it" (chưa tick → "0 đ";
tick một dòng → tổng = "Thành tiền" dòng đó; tìm mã trong popover, bấm chọn →
"Đã chọn: 1", mã hiện dưới nút, "Tổng tiền" trừ đúng 10% có trần
`maxDiscountAmount`; bỏ tick → "0 đ", voucher không có đơn tối thiểu vẫn giữ).
Test "panels, columns" đổi cách ép trạng thái rỗng: gõ mã không tồn tại thay vì
trông chờ không có voucher (voucher e2e vừa phát hành không có đơn tối thiểu nên
đủ điều kiện cho 0 đ). Cả file `patient.spec.ts` 44/50: 2 test đỏ do song song
("offers a priority", "momo included") xanh khi chạy `--workers=1`; 4 test công
đoạn ("stage is added there", hai "finishing a công đoạn", "Tạo Tái khám lists")
đỏ cả trên build cũ ở :8081 — BE trả 403 `BlueDental:Treatment:0019` "Dịch vụ
này cần đính kèm ảnh trước khi hoàn thành công đoạn", luật mới của phiên khác
(care-record), không liên quan R-263/R-264, chờ phiên đó cập nhật test. tsc,
eslint, prettier, build sạch. **Chưa commit.**

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-265 | Dòng voucher trong popover vẽ một hàng phẳng (mã · tên · "-10%" · check) và mã đã chọn ghi thay câu nghiêng dưới nút; ảnh staging 2026-09-08: mỗi voucher là một thẻ có vòng chọn, mã đơn cách, chip "10đ", tag "Kế hoạch", tên, "≈ giảm 10đ"; thẻ chọn viền + nền xanh lá; ngoài nút đổi thành "Voucher (1)", câu nghiêng mất | `AdviseVoucherPicker`: thẻ `.pd-voucher-row` (flex, viền `--bd-line`, bo 10px; `--on` viền `--bd-success` nền `--bd-green-pale`, `CheckCircleFilled`), `__code` monospace, `__value` chip viền (`formatVoucherValue` thay `formatVoucherDiscount`, bỏ dấu trừ), `__scope` "Kế hoạch", `__saving` = `calculateVoucherDiscount(voucher, gross)`; nút "Chọn voucher" → "Voucher (n)" khi n > 0, `<em>` chỉ khi n = 0 |

Retest R-265 (2026-09-08, Level 2, build production cổng 8083, API :5000, DB
thật): `patient.spec.ts` "plan total" + "panels, columns" 2/2 — test sửa kỳ vọng
sau khi chọn: nút "Voucher (1)" hiện, `<em>` không còn. Ảnh chụp local (popover
mở, một voucher đã chọn) đối chiếu ảnh staging: cùng bố cục thẻ, màu xanh lá,
chip, tag, dòng "≈ giảm", nút "Voucher (1)"; chưa đo pixel. tsc, eslint,
prettier, build sạch. **Chưa commit.**

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-266 | Nút máy in ở chân "Phiếu tư vấn" chỉ gọi `window.print()` cả trang; bản gốc mở dialog "Chi tiết phiếu" (ảnh chẩn đoán chọn để in, thông tin chi nhánh/khách hàng, bảng dịch vụ đã tick, tổng tiền) với hai nút "In hóa đơn kèm chẩn đoán" và "In Hoá Đơn" mở bản xem trước rồi mới in | Thư mục `patient-detail/quote/`: `QuoteDetailModal` (+ `QuoteImageAside`, `QuoteImageListDialog`, `QuoteFacts`, `QuoteServiceTable`), `QuotePreviewModal` với `QuoteSheet` ("Phiếu Báo Giá") và `DiagnosisInvoiceSheet` ("Hóa Đơn Kèm Chẩn Đoán": ảnh tick, mục theo chẩn đoán, thẻ bác sĩ sửa tại chỗ bằng `RichTextField`, bảng dịch vụ, chữ ký); in bằng `printQuoteSheet` (`body.pq-printing` + `@media print` chỉ giữ `.pq-preview-body`); nút máy in có tooltip "In Báo giá" và mờ khi chưa tick |

Retest R-266 (2026-09-08): không đo, chủ dự án tự kiểm tra (không viết test
theo yêu cầu). Smoke tay trên build production cổng 8081: tick 2 dòng → dialog
đủ 3 khối; "In Hoá Đơn" ra phiếu báo giá; tick 1 ảnh + "In hóa đơn kèm chẩn
đoán" ra phiếu có mục I ảnh, II/III chẩn đoán, bảng dịch vụ, chữ ký; nút "Sửa"
mở editor. tsc, eslint, build sạch. **Chưa commit.**

Sửa thêm R-266 (2026-09-08, sáng): ảnh trong cột "Ảnh chẩn đoán" bị ép thành
dải ~60px vì danh sách là flex column có `max-height` nên các mục co lại;
bản gốc xếp khối thường (`space-y-2`) với ảnh `aspect-[4/3] object-cover`.
Đổi `.pq-aside-list` sang block, mục `display:block` + `margin-top: 8px`;
đo lại trên :8081 mỗi ảnh cao 207px (4:3), cuộn trong 480px. Chưa đo pixel.

Sửa thêm R-266 (2026-09-08, sáng, lần 2): (a) "Phiếu Báo Giá" bỏ khối chữ ký
"Người lập phiếu"/"Khách hàng" vì ảnh production không có; (b) thêm
`@page { margin: 0 }` vào khối `@media print` toàn cục của `styles/index.css`
để mọi lệnh in trong app không kèm ngày giờ / tiêu đề / URL / số trang của
trình duyệt; `.pq-sheet`/`.pq-dx` khi in tự đệm 12mm × 15mm (cùng cách với
`plan-detail.css`). Chủ dự án tự in kiểm tra.

Sửa thêm R-266 (2026-09-08, sáng, lần 3): (a) bỏ luôn chữ ký "Bác sĩ chẩn
đoán"/"Khách hàng" ở "Hóa Đơn Kèm Chẩn Đoán" (chủ dự án xác nhận production
không có); (b) sau khi "Sửa" nội dung chẩn đoán bằng RichTextField, đoạn văn
không ngắt dòng được và "Sao chép" ra chuỗi đầy `&nbsp;` — Quill 2.0.3
(`getSemanticHTML`) đổi mọi dấu cách thành `&nbsp;`; thêm `normalizeEditorHtml`
(mỗi chuỗi dấu cách giữ n-1 `&nbsp;` + 1 dấu cách thường) áp khi "Lưu lại", và
`htmlToPlainText` (DOMParser, mỗi khối một dòng) cho nút "Sao chép". Chỉ sửa
trong thư mục quote, không đụng `RichTextField` dùng chung. Chủ dự án tự thử.

## 2026-09-08 (trưa) — Chẩn đoán & Tư vấn: nút "Danh mục" mở Thư viện ảnh lâm sàng

| ID | Sai lệch | Sửa |
|---|---|---|
| R-293 | Nút "Danh mục" trên panel ảnh chỉ mở một Popover "Dữ liệu tư vấn" liệt kê tên mục; bản gốc (cả staging lẫn production, đối chiếu bằng bundle JS tĩnh — không bấm gì trên production) mở dialog toàn khung **"Thư viện ảnh lâm sàng"**: cột trái nhóm chủ đề (`consulting_data`, tìm trên server, đếm "n nhóm chủ đề"), header breadcrumb chủ đề › nội dung + badge `i/n` + "Toàn màn hình", tờ nội dung HTML zoom 125% (±25, 50–300) có đảo tương phản, vẽ chú thích, hoàn tác; dải chip "Nội dung tư vấn" có avatar chữ cái + số thứ tự, cuộn ngang tải thêm 20/lần; chế độ toàn màn hình với panel nổi | Thư mục mới `patient-detail/library/` (`ConsultingLibraryDialog`, `ConsultingTopicAside`, `ConsultingContentStrip`, `ConsultingLibrarySheet`, `ConsultingLibraryToolbar`, `useConsultingLibrary`, `consulting-library.css`); Popover và `.pd-catalog-*` bỏ; `useConsultingData` không còn tải `consultingData`, panel nhận `branchId`; `PenPalette` của viewer Hình ảnh được export để dùng chung. Chưa làm nút "Cuộn / Space + kéo" (pan) của chế độ toàn màn hình — ghi ở unknowns.md |

Retest R-293 (2026-09-08): không đo, chủ dự án tự kiểm tra (không viết test
theo yêu cầu). tsc + eslint (thư mục mới) + build production sạch; preview
cổng 8081 đã build lại; mở thử dialog + toàn màn hình trên preview: thanh công cụ nằm trên khay "Nội dung tư vấn" (fixed, bottom 144px như bản gốc) và hạ xuống 24px khi gập khay, nút mở lại khay là nút tròn ArrowUpFromLine bên phải thanh công cụ. Màu nhấn dùng `--bd-primary`, không dùng xanh
#2671D8 của bản gốc. **Chưa commit.**

## 2026-09-08 (chiều) — Chẩn đoán & Tư vấn: phản hồi chủ dự án sau R-293

| ID | Sai lệch | Sửa |
|---|---|---|
| R-294 | Click dòng "Phiếu tư vấn" không làm gì; bản gốc mở "Cập nhật phiếu dịch vụ" | `PatientAdviseCard.onEdit` → `CreatePlanDialog advise={row}` dùng lại (không tạo modal mới); bỏ qua click vào checkbox / nút thao tác |
| R-295 | Form "Tạo chẩn đoán" chèn vào bảng nên cuộn xuống mất bảng; nút "Cột hiển thị" dính sát bảng | Form thành `children` của `PatientDiagnosisCard` nằm ngoài `.pd-diagnosis-table`, thẻ tự cuộn với header sticky; `.pd-advise-tools` gap 8px, nút 32px, bảng có viền |
| R-296 | Click dòng "Phiếu chẩn đoán" không mở cập nhật; tooltip/hành động toolbar thư viện thiếu | `useDiagnosisEditor` (expanded/editing/edit/submit), form prefill + `PUT patient-diagnoses/{id}` + toast, select Chẩn đoán khoá (server); toolbar: `Tool` có `Tooltip`, bút mở popover `PenPalette` dùng chung, Đặt lại về zoom nghỉ |
| R-297 | Popover bút lệch ~200px xuống dưới khi mở trong dialog (hết motion mới nhảy); nghi do tooltip nhưng click JS không hover vẫn lệch | Nguyên nhân: rc-trigger đo lại lúc popup còn scale 0.8 của motion `zoom-big-fast` (`inset` ≈ 878/0.8 = 1097.5px). Tắt motion: `motion={NO_MOTION}` trên Popover bút; đo trên :8081 ổn định 12s, gap 12px, canh giữa bút |
| R-298 | Chưa vẽ được trong thư viện khi rỗng (canvas chỉ mount trong `.pd-lib-sheet` có HTML); chưa có nút X đỏ "Tắt chế độ vẽ" khi đóng popover; nét vẽ lệch khi tờ zoom 125% (`pointOf` không biết CSS `zoom`) | Canvas đặt thêm lên `.pd-lib-body` rỗng; `Tool danger` X đỏ hiện khi `drawing && !paletteOpen` (theo bundle bản gốc `eP && !eE`), `.pd-lib-tool--danger` màu `--bd-red` 10%/20%; `pointOf` chia offset con trỏ cho hệ số zoom suy từ `box.width / (clientWidth·|a| + clientHeight·|b|)` |
| R-299 | Click dòng chẩn đoán (hoặc nút "+" header) khi thẻ đã cuộn xuống: form mở ở trên nhưng không thấy | `revealForm(card)`: `scrollTo({top:0})` + `scrollIntoView({block:"nearest"})` trong `PatientDiagnosisCard` cho cả click dòng và nút "+" |
| R-300 | Bấm mũi tên ‹ › trên tờ thư viện: nút "nhảy" | Rule toàn cục `button:active { transform: scale(.97) }` đè `translateY(-50%)` của `.pd-lib-arrow` → tụt 22px rồi bật lại. `.pd-lib-arrow:active` giữ translate, `transition:none` |

Retest R-294…R-300 (2026-09-08): không đo, chủ dự án tự kiểm tra (không viết
test theo yêu cầu). Smoke bằng script trên build production cổng 8081: mở thư
viện rỗng → bút → dispatch pointer events lên `.pi-annotation--active` vẽ được
(1097 px có alpha, "Hoàn tác" bật), đóng popover → X đỏ (`Tắt chế độ vẽ`, nền
`--bd-red` 10%), bấm X → bút về "Bật chế độ vẽ", canvas hết active; cuộn thẻ
chẩn đoán 400px + pane 300px rồi click dòng / nút "+" → cả hai về 0, mép trên
form trùng mép dưới header sticky (300.56px); kiểm tra maths zoom bằng canvas
thử `zoom:1.25` (box 250 / layout 200). Chưa vẽ thử trên tờ có HTML vì dữ liệu
seed local hai nội dung đều rỗng. tsc, eslint, prettier, build sạch.
**Chưa commit.**

## 2026-09-08 (tối) — "Chọn ảnh hiển thị": kéo sắp xếp bị giật

| ID | Sai lệch | Sửa |
|---|---|---|
| R-301 | Kéo thẻ trong modal "Chọn ảnh hiển thị" (tab Chẩn đoán & Tư vấn) thấy giật lúc thả; cùng thao tác trên tab Hình ảnh thì mượt. Đo trên build :8081 (tab foreground): pointerup → +6.5ms commit A (dnd-kit reset `--pd-drag-transform:none`, `transition 200ms`) → long task 56ms (render lại cả tab: 2 DataTable antd + panel + modal, do `setQueryData` lạc quan báo qua `notifyManager` setTimeout 0) → +63ms commit B (đổi chỗ DOM, transition 0ms). Trong ~56ms đó thẻ bên cạnh trượt về chỗ cũ ~⅓ đường (88px → 309px) rồi bị đổi chỗ trong DOM → nhảy. Tab Hình ảnh render commit B rẻ nên A và B cùng một frame, không thấy. Không phải do CSS/sensor/key/network (PUT reorder 7–28ms, GET 97–112ms) | `hooks/useDraggedOrder.ts` giữ thứ tự vừa thả cục bộ (state `{ base, ids }`, chỉ áp khi `base === day.images`, không dùng effect) và `ConsultingImageDay.tsx` tách từ `ConsultingImagePicker` (mỗi ngày một `DndContext`, `SortableContext items` lấy từ `ordered`). `move()` chạy cùng batch với `onDragEnd` nên `items` đổi cùng commit với reset của dnd-kit → nhánh `itemsHaveChanged` tắt transition, thẻ đổi chỗ tức thì; cache về sau render cùng thứ tự (không đổi DOM); rollback đổi identity `day.images` → bỏ thứ tự cục bộ. `onReorder` nhận `{ ...day, images: ordered }` để kéo lần hai trước khi cache kịp vẫn đúng chỉ số |

Retest R-301 (2026-09-08, build production :8081, tab foreground, script dispatch
pointer events lên grip "Sắp xếp" thẻ 0 → thẻ 1): reset dnd-kit và `childList`
đổi chỗ DOM cùng mốc +5.2ms sau pointerup, 20 frame sau thẻ bên cạnh đứng yên
(left 37px), PUT `patient-images/reorder` +5→30ms, GET refetch +57→72ms không
đổi DOM; reload → mở lại modal, thứ tự 7 thẻ giữ nguyên. Không viết test theo
yêu cầu, chủ dự án tự kiểm tra bằng tay. tsc, eslint, prettier, build sạch.
Chưa sửa tab Hình ảnh (`PatientImageDayRow`) — cùng race tiềm ẩn nhưng render
nhẹ nên không thấy; chưa memo `ConsultingImageCard`; chưa tách
`usePatientImages` khỏi `useConsultingData` (nguyên nhân cả tab render 56ms).
**Chưa commit.**

## 2026-09-08 (tối) — Tab Labo hồ sơ bệnh nhân: Làm tiếp công đoạn / Bảo hành

| ID | Sai lệch | Sửa |
|---|---|---|
| R-302 | Tab Labo chỉ có một dialog "Tạo phiếu Labo" tự chế; bản gốc là dialog 3 pill Đặt mới / Làm tiếp công đoạn / Bảo hành, tab và phiếu gốc nằm trên URL (`?laboModal=…&laboRowId=…`), nút Tiếp tục công đoạn / Bảo hành trên dòng mở thẳng tab tương ứng với phiếu đó | Thư mục mới `patient-detail/labo/`: `LaboOrderTabsDialog` (PillTabs dùng chung, đọc/ghi URL bằng `replace`), `LaboNewOrderTab` (chọn kế hoạch → dịch vụ đang điều trị), `LaboChildForm` + `LaboChildHeader` + `LaboMaterialChoice` (chọn phiếu gốc, khoá mã/kế hoạch/dịch vụ, radio Theo vật liệu cũ / Thay đổi vật liệu mới), `useLaboOrderForm` + `LaboOrderFields` + `LaboChipStrips` tách từ dialog công đoạn để hai đường vào dùng chung một form. `PatientRecordDialogs.tsx` bỏ |
| R-303 | Server không có khái niệm phiếu con: mã phiếu unique tuyệt đối nên không tạo được phiếu Bảo hành cùng mã; DTO thiếu kế hoạch/dịch vụ/khớp cắn/đường hoàn tất/kiểu nhịp/màu răng/số lượng nên bảng và header con không điền được | `LaboOrder.CreateChild` chép mã, nội dung, dịch vụ/công đoạn, vật liệu (`materialId ?? parent.MaterialId`, thiếu → `Labo:0011`); `ParentOrderId`, index unique mã chỉ khi `ParentOrderId IS NULL`; `CreateLaboOrderDto.Kind/ParentOrderId`; `LaboAppService.CreateChildAsync` tải phiếu gốc theo id + chi nhánh (`Labo:0009`), từ chối khi dịch vụ đã hoàn tất (`Labo:0010`). Migration `20260908090000_AddLaboOrderParent` |
| R-304 | Lưu lỗi hiện **hai** toast cùng nội dung ("Vui lòng chọn vật liệu." ×2) — phát hiện khi spec thật fail strict mode | `MutationCache.onError` toàn cục đã toast cho mutation không có `onError` riêng; hai form Labo còn `toast.error(extractApiError)` trong `catch` → bỏ, `catch` chỉ giữ dialog mở |
| R-305 | Test cũ "Tạo Labo opens Đặt mới" lấy `histrow` đầu tiên; sau khi spec Bảo hành công đoạn chạy, dòng đó đã hoàn tất nên chỉ còn nút Bảo hành → đỏ vì dữ liệu | Lọc dòng còn nút "Tạo Labo", không có thì thêm công đoạn mới rồi mới bấm |
| R-306 | Chủ dự án soi lại: dialog local khoá nhiều ô mà bản gốc cho chọn/nhập. Đặt mới từ tab: Bác sĩ chỉ định là input khoá (gốc: select), Dịch vụ điều trị khoá tới khi chọn kế hoạch (gốc: chọn được trước, chọn xong tự điền kế hoạch); ngược lại Số phiếu Labo và Số lượng local cho gõ (gốc: khoá, số lượng = số răng tick). Tab con: Nội dung không điền từ phiếu gốc. Footer Lưu trôi theo body (gốc: dính đáy) | Tách `LaboSourcePickers` (3 `SearchSelect`: kế hoạch / dịch vụ gom mọi dòng đang mở của mọi kế hoạch, chọn dòng → set kế hoạch chủ + bác sĩ của dòng/kế hoạch / bác sĩ từ `useDentistList`); `LaboNewOrderTab` giữ planId/lineId/dentistId, `source.dentistId` lấy theo bác sĩ đã chọn. Số phiếu và Số lượng → `Input disabled`; `seedFromParent` thêm `notes`; `.pd-labo-footer` sticky, margin âm bù padding body. Dialog từ công đoạn giữ nguyên 4 ô khoá (docs dòng 523). Test: `labo-warranty.spec.ts` chọn Dịch vụ trước rồi assert Kế hoạch tự nổi label, Bác sĩ là `.ss-trigger`, mã + số lượng disabled; `patient.spec.ts` "Tạo Labo opens" đếm ô khoá theo label thay vì `toHaveCount(4)` |
| R-307 | Chủ dự án soi lại (ảnh bản gốc bấm Lưu khi form trống): bản gốc validate **từng ô** — viền đỏ + dòng helper đỏ dưới ô ("Vui lòng chọn kế hoạch điều trị.", "…dịch vụ điều trị.", "…bác sĩ chỉ định.", "…nhà cung cấp.", "…ngày nhận dự kiến.", "…giờ nhận.", "…dịch vụ Labo.", "…vật liệu."), nhãn dải chip đỏ, Số lượng hiện 0 khi chưa chọn dịch vụ, Lưu vẫn bật. Local lại gom lỗi thành một toast (`laboOrderProblem`) và không tô ô nào — trong khi app đã có sẵn hệ validate AntD Form + `FloatingField rules` | Bỏ `laboOrderProblem`/toast. `useLaboOrderForm` nhận `FormInstance<LaboOrderValues>` (giá trị nằm trong AntD Form, `useLaboValue` = `Form.useWatch(preserve)`), `fromSeed` điền ngày/giờ gửi = now, `laboOrderBody` ghép Dayjs. Mọi ô bắt buộc → `FloatingField rules={requiredRule(...)}` với đúng thông điệp bản gốc: `LaboSourcePickers` (kế hoạch / dịch vụ / bác sĩ, chọn dịch vụ → `setFields` kế hoạch + bác sĩ và xoá lỗi hai ô đó), `LaboDeliveryFields` mới (ngày/giờ gửi, nhà cung cấp, ngày/giờ nhận), `LaboChildHeader` (bác sĩ). Dải chip: `ChipStrip` bọc `Form.Item` (`serviceGroupId`, `materialId`), `Form.Item.useStatus()` → `.pd-labo-strip--error` tô nhãn đỏ. `LaboNewOrderForm`/`LaboChildForm` render `<Form onFinish scrollToFirstError>`, Lưu `htmlType=submit`. CSS: `.ant-form-item-has-error .ss-wrapper .ss-trigger` viền đỏ (index.css, dùng chung), `.pd-labo-dialog/.pd-stage-dialog .floating-field:has(.ant-form-item-has-error) .floating-field-label` đỏ (rule nghỉ của dialog Labo đặc hiệu hơn rule chung nên phải thêm), `.pd-labo-form .ant-form-item {margin-bottom:0}`. Test: Lưu trống → Số lượng "0", 8 dòng helper, 2 dải đỏ, nhãn Nhà cung cấp `rgb(229,72,77)`, dialog mở; chọn dịch vụ → 3 lỗi đầu tắt; Bảo hành Lưu trống → 2 lỗi ngày/giờ nhận. Bỏ bước "Theo vật liệu cũ trên phiếu gốc không vật liệu" (Đặt mới giờ bắt chọn vật liệu nên phiếu gốc luôn có) |
| R-308 | Chủ dự án: dialog Labo bị cuộn ngang. Đo trên :5173: `.ant-modal-body` client 770 / scroll 774 — footer `.pd-labo-footer` margin âm 24px hai bên nhưng body chỉ có padding 20px (rule AntD `.ant-modal .ant-modal-body` thắng rule global 12/20/4), nên footer rộng hơn body 8px | `.pd-labo-dialog { --pd-labo-body-x: 24px }`, `.ant-modal.pd-labo-dialog .ant-modal-body { padding: 12px var(--pd-labo-body-x) 24px; overflow-x: hidden }` (đúng số đo bản gốc `12px 24px 24px`; ≤640px → 16px + top 20px như bản gốc), footer margin/padding dùng cùng biến. Tiện thể `.pd-labo-dialog .pd-labo-grid` (0,2,0) đè media 900px `.pd-labo-grid` (0,1,0) nên lưới không về 1 cột trên màn hẹp → thêm selector vào media query |
| R-309 | Chủ dự án (ảnh dialog sau khi chọn dịch vụ): (a) lộ ô "Choose Files / No file chosen" giữa Vật liệu và Răng; (b) bỏ tick "Chọn tất cả" mà Số lượng vẫn 1; (c) hỏi Khớp cắn / Đường hoàn tất / Kiểu nhịp có lấy từ dữ liệu màn `/labo` không. (a) do form thành `<Form>` AntD: reset `.ant-form input[type="file"] { display: block }` (0,2,1) đè `[hidden]` của trình duyệt; (b) `setPicked` giữ giá trị cũ khi picked rỗng, `fromSeed`/`pickLine` dùng `teeth.length \|\| 1` — "1 khi không có răng" là giả định, không đo được trên bản gốc; (c) đúng: cùng group taxonomy `labo_bite` / `labo_finish_line` / `labo_rhythm` (`LABO_GROUP` ở `features/labo/laboTabs.ts` = `LABO_TAXONOMY` ở `hooks/useLaboPickers.ts`), lọc theo `ClinicBranchId` của hồ sơ | (a) `.pd-labo-form input[type="file"][hidden] { display: none }` (0,3,1). (b) Số lượng = `String(picked.length)` ở mọi chỗ (0 khi bỏ tick hết, bản gốc chưa đo → UNKNOWN); gửi lên vẫn `\|\| 1` vì server clamp `< 1 → 1`. (c) không đổi. Test: sau khi chọn dịch vụ, Số lượng = số chip răng, click "Chọn tất cả" → "0" rồi click lại → số cũ (dùng `click()` + assertion retry, `uncheck()` đọc trạng thái ngay sau click nên đỏ giả vì checkbox controlled theo watch); `input[type=file]` hidden, nút "Tải ảnh" hiện |
| R-310 | Chủ dự án (3 ảnh bản gốc): (a) chọn Dịch vụ điều trị rồi bỏ chọn, hàng Răng vẫn giữ "Chọn tất cả" thay vì về `Chọn dịch vụ điều trị trước` như bản gốc; (b) ô Nội dung thấp; (c) bản gốc cho bấm lại chip Lựa chọn dịch vụ / Vật liệu để bỏ chọn, và mỗi dải có hai nút tròn trượt ngang. Đo bundle staging: dải chip là lưới 2 hàng `grid-auto-flow: column; grid-template-rows: repeat(2, max-content)`, gap 8, min-height 40, ẩn scrollbar, snap-x; nút 32 px tròn, viền `--pd-dash-soft`, disabled opacity .45, `scrollBy(±280, smooth)` rồi đo lại sau 260 ms; chip 13/500 nền `--bd-bg-soft`, padding `6px 16px`; chưa có răng → `<p>` 14/400 màu nhãn, không checkbox; textarea Nội dung 92 px, padding 12 | (a) `pickLine` khi bỏ chọn → `setFieldsValue({ teeth: [], picked: [], quantity: "0" })`; `LaboNewOrderForm` truyền `emptyTeeth` = `.pd-labo-teeth-hint` "Chọn dịch vụ điều trị trước" (dialog con giữ pill "(Trống)"). (b) `.pd-labo-notes textarea { min-height: 92px; padding: 12px }`. (c) `ChipStrip` tách file, `pick` = `onChange(v === value ? undefined : v)`; `useChipScroller` (ref, canPrev/canNext, ResizeObserver, STEP 280, SETTLE 260) + hai `.pd-labo-arrow` (lucide Chevron 16, `aria-label` "Trượt {0} sang trái/phải") quanh `.pd-labo-chips` lưới 2 hàng. Test: xoá dịch vụ bằng `.ss-icon--clear` → hàng Răng chứa hint, 0 checkbox, 0 chip, Số lượng "0", chọn lại → chip về; chip dịch vụ `aria-pressed` true → click → false và Vật liệu về "Chọn dịch vụ trước"; mỗi dải 2 `.pd-labo-arrow` |
| R-311 | Chủ dự án (ảnh Số lượng 0 + toast đỏ "Lỗi hệ thống"): "chưa chọn răng mà vẫn submit được". Hai chuyện: (1) FE không có rule cho hàng Răng nên bỏ tick hết vẫn gửi `quantity 1`; (2) toast đỏ là 500 Postgres `23505 IX_bd_labo_orders_OrderCode` — dialog giữ mã kế tiếp từ lúc mở, một phiên e2e tạo phiếu chiếm đúng mã đó, `LaboAppService.CreateAsync` dùng `OrderCode` client gửi mà không kiểm trùng (`Labo:0003` "Mã phiếu labo đã tồn tại." có sẵn nhưng không dùng). Chủ dự án chọn "FE là được" → BE giữ nguyên, ghi nợ. Kèm câu hỏi "handle hình ảnh chưa": ảnh chọn ở dialog chỉ upload khi phiếu tạo từ công đoạn (`if (treatmentStageId)`), tạo từ tab Labo thì bị bỏ rơi | (1) `LaboToothRow` mới là control của `Form.Item name="picked"` với rule: có răng mà `picked` rỗng → "Vui lòng chọn răng." (không răng / chưa chọn dịch vụ → bỏ qua để Lưu trống vẫn đúng 8 dòng R-307; câu chữ UNKNOWN_REFERENCE_BEHAVIOR); `Form.Item.useStatus()` → `.pd-labo-teeth--error > p` đỏ; `setPicked` dùng `setFields(errors: [])` nên tick lại là hết lỗi. (2) `LaboOrderSource` thêm `treatmentPlanId` (`sourceFromStage`/`sourceFromLine`), `UploadPatientImageInput.treatmentPlanId` append vào FormData (BE `UploadPatientImageDto.TreatmentPlanId` đã có), `LaboNewOrderForm`/`LaboChildForm` upload mọi ảnh với plan + stage (nếu có) → vào tab Hình ảnh của hồ sơ. Test: bỏ tick hết → Lưu → helper "Vui lòng chọn răng." + 1 `.pd-labo-teeth--error`, tick lại → ẩn; `setInputFiles` 1 PNG → 1 `.pd-labo-drafts > div`; sau Lưu `totalCount` `/v1/app/patient-images?patientId=` tăng 1 |
| R-312 | Chủ dự án tự chạy host, Lưu Đặt mới → log `23505 IX_bd_labo_orders_OrderCode` ("lỗi nè"): mã phiếu dialog giữ từ lúc mở đã bị phiếu khác chiếm (e2e của phiên này), `LaboAppService.CreateAsync` ghi thẳng `OrderCode` client gửi → 500. Nợ BE ghi ở R-311 nay phải trả. Soi thêm: `NextOrderCodeAsync` lọc theo chi nhánh trong khi unique index là toàn bảng → chi nhánh thứ hai tạo phiếu đầu ngày cũng sẽ 500 | BE: `ResolveOrderCodeAsync` — mã gửi lên đã có phiếu gốc (`ParentOrderId IS NULL`) dùng thì cấp mã kế tiếp (mã là server cấp, ô bị khoá nên người dùng không tự gõ → không trả `Labo:0003`); mã trống → mã kế tiếp. `NextOrderCodeAsync` bỏ lọc chi nhánh, chỉ đếm phiếu gốc cùng prefix ngày, dùng `AsyncExecuter`. `GetNextOrderCodeAsync` vẫn đòi branch header. e2e: sau khi đọc mã trong dialog, POST thật `/v1/app/labo-orders` với đúng mã đó (cookie + XSRF của trình duyệt) rồi mới Lưu → toast "Đã tạo phiếu Labo", bảng +2 hàng, hàng dialog mang mã +1 (`bumpOrderCode`), Bảo hành tiếp trên hàng đó. Lọc hàng theo ô `td` khớp `^code$` (`rowsWithCode`) vì textContent hàng nối cột không có dấu cách — `LABO-…14` dính `08/09/2026` nên lookahead "không phải chữ số" trượt |
| R-313 | Chủ dự án (ảnh staging tab Labo cạnh ảnh local tab Lịch hẹn): ba ô đếm trên bảng Labo là chip tròn `.pd-counter` (cao 32px, viền tròn 18px, số nằm ngang nhãn) trong khi bản gốc vẽ chúng như card thống kê của tab Lịch hẹn (ô đứng, số trên nhãn, viền + nền nhạt theo màu). Phải "dùng style giống ở lịch hẹn" | Tab Labo dùng lại đúng markup + class của tab Lịch hẹn: `.pd-stat-row` / `.pd-stat pd-stat--{green,amber,red}` (`<strong>` số 18px, `<span>` nhãn 10.5px, cao 58px, radius 8px, `aria-pressed`, `.active` viền trong). Xoá cả cụm `.pd-counter*` (và `.pd-counter.active` lạc ở giữa file) vì chỉ Labo dùng; `.pd-counter-row` rút khỏi selector gộp. Không đổi hành vi lọc (bấm lại thì bỏ lọc) |
| R-314 | Chủ dự án: "làm table bên dưới cũng giống đi, các action button thì làm cho giống các table khác". Bảng Labo local: mã phiếu xuống hai dòng, ngày thiếu giờ, File Labo là link chữ "Xem file", Thao tác là hai nút text trần không tooltip (`.pd-labo-actions`), và có thanh cuộn ngang vì tổng width cột (th min-width 100) vượt thẻ ~1352px | `patientLaboColumns`: mã phiếu `.pd-labo-code` nowrap (150); hai cột ngày dùng `formatDateTime` `DD/MM/YYYY HH:mm` + pill xếp dưới (`DatePill`, gap 6px) như bản gốc; Vật liệu bỏ width để co giãn; Số răng / Số lượng 100; File Labo gửi về là nút icon thư mục vàng `FolderFilled` (`.pd-labo-file`, `--bd-gold`, `href` mở tab mới, xám mờ khi chưa có file — với href AntD render `<a>` nên phải chọn `.ant-btn-disabled` chứ không phải `:disabled`); Thao tác `align: center` + `.pd-icon-actions` + Tooltip + `type="text"` đúng mẫu bảng Lịch hẹn / Đơn thuốc, giữ `aria-label` "Tiếp tục công đoạn" / "Bảo hành" cho e2e. Xoá `.pd-labo-actions`. Chưa có nút Xem chi tiết (mắt) vì modal chi tiết + phiếu in vẫn hoãn |
| R-315 | Chủ dự án (ảnh dialog Đặt mới): "khi tạo phiếu t thấy đang có 2 api riêng, tạo labo với upload image nữa à, gộp chung lại dùng formdata được k". Lưu gửi một `POST /labo-orders` JSON rồi N `POST /patient-images` multipart, mỗi ảnh một request, phiếu đã tạo dù ảnh lỗi | Gộp thành **một** `POST /api/v1/app/labo-orders` multipart: `CreateLaboOrderDto` thêm `Pictures: List<IRemoteStreamContent>`; `LaboController` có hai action cùng route tách bằng `[Consumes("application/json")]` (giữ cho client JSON và e2e `claimOrderCode`) / `[Consumes("multipart/form-data")]` (`[FromForm]` DTO + `List<IFormFile> pictures` bọc `RemoteStreamContent` như `PatientImageController`); `LaboAppService.AttachPicturesAsync` gọi `IPatientImageAppService.UploadAsync` ngay sau `InsertAsync` trong cùng unit of work — plan lấy server-side từ `TreatmentServiceId` (FE bỏ `treatmentPlanId` khỏi input), công đoạn từ `TreatmentStageId`; quyền + chi nhánh do image service tự kiểm. FE: `useCreateLaboOrder` dựng `FormData` (`toOrderForm`, field undefined không append để server giữ default, file dưới khoá `pictures`), hai form bỏ vòng `useUploadPatientImage`, nút Lưu chỉ `create.isPending`. Ghi chú: MinIO không rollback cùng DB nếu insert ảnh sau đó lỗi |
| R-316 | Chủ dự án (ảnh Bảo hành + Làm tiếp công đoạn): "tại sao lúc thêm công đoạn, bảo hành Dịch vụ điều trị, Dịch vụ hiện tại k được auto fill". Kế hoạch điều trị ra `DT30 - BS…` nhưng Dịch vụ điều trị trống và Dịch vụ hiện tại `—` | Hai lỗi server-side ở `FillNamesAsync`: (1) `TreatmentServiceName` tra `line.ServiceId` trong `DentalProcedure`, nhưng dòng dịch vụ của plan trỏ `CatalogEntry` (Danh mục → Dịch vụ, đúng như `PatientTreatmentAppService` dùng) → luôn null; đổi repo sang `IRepository<CatalogEntry, Guid>`. (2) "Dịch vụ hiện tại" theo khảo sát staging là **dịch vụ Labo** (nhóm `labo_material` của vật liệu, `serviceId` trong payload bản gốc) chứ không phải dịch vụ điều trị — local đang render `treatmentServiceName`; thêm `LaboOrderDto.LaboServiceName` lấy từ `LaboMaterial.TaxonomyId` (gộp vào lượt đọc taxonomy sẵn có), `LaboMaterialChoice` đọc trường đó. Contract test thêm `LaboServiceName`; e2e Bảo hành assert Dịch vụ điều trị khác rỗng và hai dòng tóm tắt đúng tên nhóm / vật liệu đã seed (`seedCatalog` trả thêm `groupName`) |
| R-318 | Chủ dự án (hai ảnh staging: modal "Thông tin chung" và bản in "PHIẾU ĐẶT HÀNG LABO"): "ok tiếp theo làm chi tiết và phiếu in đi". Nút mắt Xem chi tiết trên tab Labo của bệnh nhân chưa có (R-314 để lại) | Dựng `LaboDetailDialog` (modal 772px chỉ đọc, bốn khối + pill TRẠNG THÁI, footer `In Phiếu Labo` outline có icon máy in + `Đóng` primary, không select trạng thái, không Lưu — đúng biến thể tab bệnh nhân), `LaboDetailFacts` (khối/hàng), `laboOrderFacts.ts` (đọc DTO ra chuỗi: khách hàng `code - tên`, nhà cung cấp `supplierName ?? labProviderName`, chỉ định `workDescription ?? notes`, thiếu → rỗng trên màn / `—` trên giấy), `LaboPrintSheet` portal lên `<body>` (bài học R-277), tiêu đề tài liệu `phieu-labo-<mã>`, `body.pd-printing` + `window.print()`, `afterprint` trả lại; cột Thao tác thêm mắt (`pd-labo-act--info`, width 130). CSS trong `patient-detail.css` theo số đo staging (2×350px cách 24, nhãn 140px, hàng cách 8, pill 32px). Không đổi BE. Sự cố: file `laboDetailFacts.ts` cạnh `LaboDetailFacts.tsx` chỉ khác hoa/thường → TS1149 trên Windows, đổi tên helper thành `laboOrderFacts.ts`; nút ✕ của AntD cũng mang `aria-label="Đóng"` nên spec phải trỏ nút primary ở footer. Chủ dự án xem bản in thật: "tăng font weight cho text Người đặt hàng" → dòng đầu khối ký 13px/700 |

Retest R-302…R-305 (2026-09-08, build production `vite preview` :8083 — 8080/8081
đang bị phiên khác chiếm; host :5000 chạy lại với code mới): `e2e/labo-warranty.spec.ts`
2/2 — đăng nhập thật, seed nhà cung cấp + nhóm `labo_material` + vật liệu qua API thật
vì DB local trống, Đặt mới từ tab (chọn kế hoạch, dịch vụ, nhà cung cấp, ngày nhận) →
toast + dòng "Mẫu mới" + URL sạch; bấm Bảo hành trên dòng → `laboModal=warranty&laboRowId=…`,
mã khoá đúng, "Ngày bảo hành", radio "Theo vật liệu cũ" mặc định; Lưu khi phiếu gốc không
có vật liệu → toast "Vui lòng chọn vật liệu." (403 BusinessException), dialog vẫn mở;
đổi tab giữ `laboRowId`; "Thay đổi vật liệu mới" chọn chip → dòng con cùng mã, pill Bảo hành,
vật liệu mới; reload đọc lại 2 dòng cùng mã; đóng dialog xoá cả hai param. PostgreSQL:
`LABO-202609082` ×2 (Kind 1 không ParentOrderId, Kind 3 có ParentOrderId + MaterialId).
`e2e/patient.spec.ts -g Labo` 1/1, `e2e/labo.spec.ts` 14/14. BE: Domain 7/7, EF 6/6,
Application 32/32. tsc, eslint, prettier, build sạch. Chưa dựng "Xem chi tiết" + tờ in.

Retest R-306 (2026-09-08, cùng build/host): `labo-warranty.spec.ts` 2/2, `labo.spec.ts`
14/14, `patient.spec.ts -g Labo` 1/1 (17/17). Ảnh local `reference-private/survey/local/
labo-tab-new-picked-v2.png`, `labo-tab-new-dentist-open.png`, `labo-tab-warranty-v2.png`
đối chiếu `reference-private/labo/ref-tab-new-service-picked.png`: chọn "DT06-01" trước
→ Kế hoạch tự "DT06", Bác sĩ select mở được 8 bác sĩ, mã và số lượng khoá, Lưu dính đáy.
tsc, eslint, prettier, build sạch. **Chưa commit.**

Retest R-307 (2026-09-08, build production `vite build --outDir dist-labo` + `vite preview`
:8084 — `dist/` có file bị khoá EPERM không xoá được; host :5000 giữ nguyên): `labo-warranty.spec.ts`
2/2, `labo.spec.ts` 14/14, `patient.spec.ts -g Labo` 1/1 (17/17). Ảnh local
`reference-private/survey/local/labo-tab-new-errors.png` đối chiếu ảnh bản gốc chủ dự án gửi:
8 ô viền đỏ + helper đỏ cùng câu chữ, nhãn "Lựa chọn dịch vụ *" / "Vật liệu *" đỏ, pill
"Chọn dịch vụ trước", Số lượng 0, Lưu bật, footer dính. Khác: bản gốc có icon ⓘ trước
helper (app dùng `.ant-form-item-explain-error` trơn toàn hệ thống, giữ); câu cho Ngày gửi /
Giờ gửi tự đặt ("Vui lòng chọn ngày gửi.") vì luôn điền sẵn nên bản gốc không lộ ra
(UNKNOWN_REFERENCE_BEHAVIOR); Enter trong DatePicker/TimePicker submit form (mặc định AntD)
→ `fillDueTime` bấm OK của picker thay vì Enter. tsc, eslint, prettier, build sạch.
**Chưa commit.**

Retest R-308, R-309 (2026-09-08, build production `dist-labo` + preview :8084, host :5000):
đo lại `.ant-modal-body` client = scroll = 770 (trống / lỗi) và 638 ở viewport 640; padding
computed `12px 24px 24px`, footer margin `20px -24px -24px`. Ảnh `reference-private/survey/local/
labo-overflow-errors.png`, `labo-overflow-640.png`, `labo-tab-new-picked-v3.png` (không còn
"Choose Files", Số lượng 0 sau khi bỏ tick). `labo-warranty.spec.ts` 2/2, `labo.spec.ts` 14/14,
`patient.spec.ts -g Labo` 1/1. tsc, eslint, prettier, build sạch. **Chưa commit.**

Retest R-310, R-311 (2026-09-08, build production `vite build --outDir dist-labo` + preview
:8084, host :5000 giữ nguyên): `labo-warranty.spec.ts` 2/2, `labo.spec.ts` 14/14 (16 passed,
1.7m), `patient.spec.ts -g Labo` 1/1. Ảnh `reference-private/survey/local/labo-tab-new-empty-v4.png`,
`labo-tab-new-picked-v4.png` (hai mũi tên mỗi dải, lưới 2 hàng, Nội dung 92 px),
`labo-tab-new-cleared-v4.png` (hint "Chọn dịch vụ điều trị trước", Số lượng 0),
`labo-tab-new-teeth-error-v4.png` (nhãn Răng đỏ + helper). Migration `AddLaboOrderParent` đã áp
vào DB local (`__EFMigrationsHistory` dòng đầu, cột `ParentOrderId`, unique index lọc
`ParentOrderId IS NULL`), chưa lên prod. tsc, prettier sạch; eslint còn 2 lỗi cũ ngoài phạm vi
(`PatientProfileTab.tsx:273`, `stage/useStageComposer.ts:182` — rule
`react-hooks/exhaustive-deps` không có trong config). Nợ BE: trùng `OrderCode` khi tạo phiếu →
cấp mã kế tiếp hoặc trả `Labo:0003` thay vì 500. **Chưa commit.**

Retest R-312 (2026-09-08, host `dotnet run` :5000 build Debug mới, `vite build --outDir dist-labo` + preview :8084): `labo-warranty.spec.ts` 2/2 (lần 1 đỏ vì lookahead, sửa `rowsWithCode` → xanh), `labo.spec.ts` 14/14, `patient.spec.ts -g Labo` 1/1; host log 0 dòng `23505`. DB local sau chạy: cặp mã 11/12 và 13/14 cùng ngày (mã bị chiếm + mã kế tiếp dialog nhận). `dotnet build` host xanh (5 warning cũ). Cấp độ retest 2 (một feature). **Chưa commit.**

Retest R-313 (2026-09-08, cấp độ 1 — chỉ CSS/markup, không đổi hành vi): host Debug :5000 + `vite build --outDir dist-labo` preview :8084, đăng nhập thật, mở tab Labo bệnh nhân e2e 16 phiếu: ba card đo 84.6×58 / 113.8×58 / 76×58, nền `--bd-green-pale` / `--bd-amber-pale` / `--bd-red-pale`, chữ `--bd-green` / `--bd-gold-deep` / `--bd-red`, số 18px, nhãn 10.5px — cùng số đo với card tab Lịch hẹn. `tsc` + eslint + prettier xanh; e2e không tham chiếu `pd-counter` nên không chạy lại. Chênh còn lại so với bản gốc (chưa động): bản gốc ba card cùng rộng ~112–115px và cao ~48px; nút Tạo phiếu Labo dùng icon hộp chứ không phải dấu cộng; bảng local đang có thanh cuộn ngang vì cột Mã phiếu xuống dòng. **Chưa commit.**

Retest R-314 (2026-09-08, cấp độ 1 — cột/CSS, không đổi hành vi; chủ dự án nói "t sẽ tự test" nên không chạy e2e): preview :8084 build production trên host :5000 của phiên khác (PID 20528, chỉ đọc), tab Labo bệnh nhân e2e 16 phiếu: `scrollWidth == clientWidth` 1353 (hết cuộn ngang), width cột 154/175/175/140/140/131/100/100/130/108, mỗi hàng 2 nút thao tác, 16 nút thư mục đều `ant-btn-disabled` (chưa phiếu nào có file). `tsc` + eslint + prettier xanh. Đo lại sau khi sửa selector: thư mục rỗng `color` = `--bd-muted`, `opacity` 0.45. Chủ dự án hỏi thêm "3 card này cho width bằng width của card lớn nhất được k" → `.pd-stat-row--equal` (`inline-grid`, `grid-auto-flow: column`, `grid-auto-columns: 1fr` — track 1fr trong grid co theo nội dung nên cả ba lấy bề rộng của nhãn dài nhất; là flex item nên computed display thành `grid`, không sao) chỉ gắn ở tab Labo: ba card đo 113.8 / 113.8 / 113.8px. Tab Lịch hẹn giữ nguyên co theo nhãn. Tiếp: "button Thêm công đoạn style icon color màu primary, bảo hành màu xanh success đi" → `.pd-labo-act--primary` (`--bd-primary`) trên nút dấu cộng, `.pd-labo-act--success` (`--bd-green`) trên nút Bảo hành; lần đầu chỉ đặt `color` ở trạng thái thường nên "kh hover bị mất màu" — AntD 6 đổi màu text button qua `.ant-btn:not(:disabled):not(.ant-btn-disabled):hover` (0,4,0) mạnh hơn class (0,3,0); sửa bằng cách lặp lại màu ở `:not(:disabled):hover` và `:active` (0,5,0). `tsc` + eslint + prettier xanh; chưa đo lại trên preview — chủ dự án tự kiểm. **Chưa commit.**

Retest R-315 (2026-09-08, cấp độ 2 — một feature, đổi API contract): host build ra scratchpad chạy :5001 (host :5000 là của chủ dự án, không đụng), `vite build --outDir dist-labo` + preview :8084 (config tạm proxy → :5001; preview chỉ bind `[::1]` nên `E2E_BASE_URL=http://localhost:8084`, `127.0.0.1` không tới). `labo.spec.ts` 14/14, `labo-warranty.spec.ts` 1/2: test Đặt mới → Bảo hành đỏ ở `laboRows toHaveCount(rowsBefore + 2)` — bảng tab Labo phân trang 20 dòng và bệnh nhân e2e đã tích hơn 20 phiếu sau nhiều lần chạy, không phải lỗi gộp; sửa test đếm `totalCount` qua `GET /labo-orders?patientId=…&maxResultCount=1` (phiếu mới nhất lên đầu nên hai mã vẫn ở trang 1). Log host xác nhận Lưu chỉ gửi **một** `POST /labo-orders` `multipart/form-data` → 200 (2,1 s có ảnh; 45 ms cho Bảo hành), không còn `POST /patient-images` riêng; `POST` JSON của `claimOrderCode` vẫn 200. Contract tests 9/9 rồi 33/33 (sau R-316). Sự cố trong phiên: script Python sửa spec gọi `write_text(newline="\\n")` (hai gạch chéo) → `ValueError` **sau khi** đã mở file ghi, `labo-warranty.spec.ts` bị cắt về 0 dòng; khôi phục bằng `git checkout --` từ bản đã stage (453 dòng) rồi áp lại sửa đổi. Bài học: viết script bằng Write tool với `newline="\n"` một gạch, hoặc ghi ra file tạm rồi đổi tên. Chủ dự án: "k cần test, t sẽ tự test" nên sau R-316 **chưa** build lại host / chưa chạy lại e2e; host :5001 và preview :8084 đã tắt, `dist-labo` + config tạm đã xoá. **Chưa commit.**

Retest R-316 (2026-09-08, cấp độ 2): chỉ `dotnet test --filter Labo` 33/33 + `tsc` + eslint + prettier xanh; chưa chạy host mới và e2e (chủ dự án tự test). Khi chạy lại: `labo-warranty.spec.ts` test "Đặt mới, then Bảo hành" giờ assert thêm ba dòng tên (Dịch vụ điều trị, Dịch vụ hiện tại, Vật liệu) trên dialog Bảo hành. **Chưa commit.**

R-317 (2026-09-08, cấp độ 2 — F-13, tab Labo của bệnh nhân): chủ dự án chỉ ra tab **chưa phân trang ở server**. Đúng: `usePatientLaboOrders` kéo cố định `maxResultCount: 50` rồi `slice` theo trang và đếm ba counter trên mảng đó ở client — bệnh nhân quá 50 phiếu thì mất phiếu và counter sai, trong khi BE đã nhận `skipCount`/`maxResultCount`/`kind` và có `GET labo-orders/stats`. Sửa: hook nhận `{ patientId, kind, skipCount, maxResultCount }` và trả `PagedResult` (giữ `placeholderData`), thêm `useLaboStats` (key `["labo-orders","stats",…]` để mọi mutation labo invalidate cùng), tab đọc `totalCount` từ server, counter đọc `stats.new/continueStage/guarantee` (đếm cả hồ sơ, không theo trang hay counter đang bấm — khớp `/clinic-order-status` của bản gốc), bấm counter gửi `kind=` và về trang 1; `LaboOrderTabsDialog` tự lấy danh sách phiếu cha (`maxResultCount: 200`, chỉ khi mở tab con) thay vì nhận `orders` từ tab. Spec mới `labo-warranty.spec.ts › pages, counts and filters on the server, not on the page` (nạp đủ 11 phiếu qua API, đổi 10/trang → request `skipCount=0&maxResultCount=10`, trang 2 → `skipCount=10`, counter → `kind=1&skipCount=0`, pill cột 2 toàn "Mẫu mới", counter không đổi, bấm lại thì bỏ lọc). Chạy một lượt trên build production (preview :8084, host :5000 của chủ dự án, chỉ đọc + 0 phiếu nạp thêm vì bệnh nhân đã có 26): xanh tới bước cuối, đỏ vì spec chờ request khi bỏ lọc trong khi trang không lọc về từ cache TanStack (đúng như bản gốc "no new request") — đã bỏ chờ ở bước đó; chủ dự án bảo "k cần test, t sẽ tự test" nên **chưa chạy lại**. Lưu ý: cùng lúc phiên khác đang dựng `LaboDetailDialog`/`LaboPrintSheet`/`laboDetailFacts` (đã nối `onDetail` lên bản tab mới); phiên đó đã đổi helper thành `laboOrderFacts.ts` nên `tsc -b` xanh lại trên cả FE. **Chưa commit.**

Retest R-318 (2026-09-08, cấp độ 2 — chỉ FE): `tsc -b` + oxlint + prettier xanh; `vite build --outDir` ra scratchpad, `vite preview` :8087 (proxy → host :5000 của chủ dự án, chỉ thêm một phiếu e2e + có thể một nhà cung cấp; preview chỉ bind `[::1]` nên `E2E_BASE_URL=http://localhost:8087`). `e2e/labo-detail.spec.ts` 1/1 thật: nạp phiếu qua `POST /labo-orders` JSON với cookie + XSRF của trình duyệt, mắt là nút đầu Thao tác, năm tiêu đề khối đúng thứ tự, giá trị theo nhãn, Kiểu nhịp rỗng trên màn, pill "Đơn hàng mới", không Lưu / không select, tờ in nằm trên `<body>` ẩn với `Số:`/`Mã KH:`/`Kiểu nhịp: —`, bấm in → `body.pd-printing` + title `phieu-labo-<mã>`, `afterprint` trả lại, Đóng gỡ cả tờ in. Ảnh modal và PDF (`page.pdf` A4 với `pd-printing`) đối chiếu bằng mắt với ảnh staging: bố cục khớp; tiêu đề dialog giữ 16px của app. Preview đã tắt, `dist-labo-detail` nằm trong scratchpad. **Chưa commit.**

R-319 (2026-09-08, cấp độ 1 — F-13, i18n tab Labo): chủ dự án yêu cầu rà text chưa i18n ở tab Labo. Rà 23 file trong `patient-detail/labo/` + `laboApi.ts`: mọi text hiển thị đã qua `t()` (các hằng nhãn `LABO_KIND_CONFIG`/`LABO_STATUS_CONFIG`/`LABO_MODAL_LABELS`/`SENT_LABELS`/`COUNTERS` được bọc `t()` tại nơi dùng), nhưng **42/106 key chưa có bản dịch** trong `en.json` (tiếng Việt là nguồn nên bật EN vẫn hiện tiếng Việt): counter/nút tab, tiêu đề cột, ba pill Đặt mới/Làm tiếp công đoạn/Mẫu mới/Đang xử lý, nhãn form (Số phiếu Labo, Giờ gửi/Giờ nhận/Ngày+Giờ bảo hành, Màu răng, Tải ảnh, Chọn tất cả, Theo vật liệu cũ/Thay đổi vật liệu mới…), text rỗng (Chưa có phiếu Labo, Chọn dịch vụ (điều trị) trước, Không có vật liệu, (Trống)), aria-label mũi tên chip, toast "Đã tạo phiếu Labo", 11 câu "Vui lòng chọn …" của rule, và đơn vị pager "phiếu labo". Đã thêm đủ 42 key vào `BlueDental.Domain.Shared/Localization/BlueDental/en.json` (giữ BOM, wording theo key sẵn có: "Ordering dentist", "Labo models"). Tiện tay bọc `t()` cho hai chỗ `LABO_STATUS_CONFIG[…].label` chưa dịch ở màn Mẫu Labo (`LaboOrdersScreen.tsx`: pill cột Ngày giao và cột Trạng thái khi xuất Excel; prettier đồng thời gói lại hai block đã lệch format sẵn). `tsc -b` xanh. File JSON là EmbeddedResource nên host :5000 phải build + chạy lại mới trả overlay mới; chủ dự án tự test. Còn lại ngoài phạm vi: `PatientRecordTabs.tsx` thiếu "Chưa có hóa đơn"/"hóa đơn" trong `en.json`. **Chưa commit.**


> **Ghi chú rebase 2026-09-08** — nhánh này rebase lên `main` (7 commit) sau khi
> viết mục dưới đây. `main` đã tự dựng **cùng hai tính năng**: modal "Dữ liệu tư
> vấn" (`library/ConsultingLibraryDialog`) và kéo thả trong "Chọn ảnh hiển thị"
> (`ConsultingImageDay` + `useDraggedOrder`). Theo quyết định của chủ dự án, giữ
> bản của `main` cho hai chỗ đó; bản của nhánh này (`ConsultingLibraryModal`,
> `ConsultingStage`, `ConsultingTopicList`, `ConsultingContentBar`,
> `consulting.css`) đã **xoá**. Vì vậy:
>
> - **R-319** (ảnh chiếm thân thẻ, vùng thả chỉ khi rỗng): vẫn đúng, nhưng do
>   `PatientConsultingImagePanel` của `main` thực hiện — lớp `.pd-image-tile`,
>   không phải `.pd-image-shot`.
> - **R-320**: dialog dùng `ConsultingImageDay` của `main`.
>   `PatientImageSortableRow` vẫn còn và vẫn dùng cho **tab Hình ảnh**.
> - **R-321**: do `library/` của `main` thực hiện.
> - **R-322**, **R-325**: nguyên vẹn của nhánh này (`DiagnosisPrintDialog` +
>   `PUT …/print-content`) — icon lịch là "In chẩn đoán" theo quyết định của chủ
>   dự án, nên `AppointmentEditorModal` mở từ dòng chẩn đoán của `main` đã bỏ.
> - **R-323**: `draggable={false}` đã mang sang panel của `main` (panel của
>   `main` chưa có) — xem `PatientConsultingImagePanel`.
> - **R-324**: `PatientImageSortableRow` vẫn giữ (tab Hình ảnh); dialog dựa vào
>   `useDraggedOrder` của `main`.
> - **R-326**: typography `.cl-sheet-body` đi cùng `consulting.css` đã xoá.
>   `RichTextView` và `.bd-rich-view` vẫn còn (tờ in dùng). **Còn treo**:
>   `library/ConsultingLibrarySheet` của `main` render bằng
>   `dangerouslySetInnerHTML` — trái §5 CLAUDE.md; chưa sửa trong đợt rebase này.
>
> Các con số "chạy thật" trong mục dưới đo trên bản **trước** rebase. Cần retest
> lại — xem mục cuối tài liệu này.

## 2026-09-08 — Chẩn đoán & Tư vấn: ảnh lên trên, kéo thả có lưu, "Danh mục" là modal, và "In chẩn đoán"

Chủ dự án chỉ ra bốn chỗ lệch bản gốc trên tab **Chẩn đoán & Tư vấn**, kèm ảnh
chụp đối chiếu. Đã soi lại `staging.nfcdental.com` (chỉ đọc, tài khoản chủ dự án
cấp; chỉ mở dialog, không submit form nào) và đo đủ trước khi sửa — chi tiết
trong `docs/clone/pages/patient-detail.md`, mục **2026-09-08**.

| # | Đo được | Đã làm |
|---|---|---|
| R-319 | Panel ảnh của bản gốc vẽ **hoặc** ảnh **hoặc** vùng thả — vùng xám là chỗ đứng thay, không nằm đè trên ảnh. Ta vẽ cả hai, vùng thả luôn ở trên | `PatientConsultingImagePanel` xếp ảnh chiếm cả thân thẻ; vùng thả chỉ còn hiện khi `shown.length === 0`. Kéo file vào bất kỳ đâu trên thẻ vẫn tải lên: viền đổi thành `#2671D8` nét đứt, phủ `bg-[#2671D8]/10` + **"Thả ảnh để tải lên"**, đúng như bản gốc |
| R-320 | Nút kéo sắp xếp trong "Chọn ảnh hiển thị" của ta **chỉ có hình** (ghi ở `unknowns.md` từ 2026-09-03). Bản gốc kéo thả thật, `PUT /v1/patient-images/reorder` `{id, ordering}`, phạm vi **một ngày** | Dialog dùng lại đúng thẻ của tab Hình ảnh. `PatientImageCard` nhận thêm `checked` / `onCheckedChange` / `showView`; phần kéo thả tách ra `PatientImageSortableRow` cho cả hai màn dùng chung. Lưu qua `usePatientImageReorder` sẵn có |
| R-321 | `Danh mục` mở **modal toàn khung** (`aria-label="Thư viện ảnh lâm sàng"`), không phải popover. Hai đợt đo trước (2026-08-28, 2026-09-03) đều ghi sai | `ConsultingLibraryModal` + `ConsultingTopicList` / `ConsultingContentBar` / `ConsultingStage`, đọc `taxonomies` và `catalog-entries` nhóm `consulting_data`. Sửa lại hai bảng cũ trong tài liệu |
| R-322 | Nút giữa cột `Thao tác` của Tạo chẩn đoán vẽ bằng `lucide-calendar-days` **nhưng tooltip là "In chẩn đoán"** và mở dialog in. Ta gán nhầm cho `Đặt lịch hẹn` | `PatientDiagnosisCard` đổi hành động; `DiagnosisPrintDialog` + `DiagnosisPrintSheet` + `DiagnosisPrintImages` dựng tờ A4 của bản gốc |

### Backend đi kèm

Tờ in mang một khối tư vấn **lưu được**, mà `PatientDiagnosis` chưa có chỗ chứa.

- `PatientDiagnosis.ContentDiagnosis` (`text`) + `UpdatePrintContent(...)`.
- `PUT /v1/app/patient-diagnoses/{id}/print-content` với `{contentDiagnosis, note}`.
- Migration `20260908000000_AddDiagnosisPrintContent`, viết tay và vá snapshot
  bằng tay — cùng lý do đã ghi ở `AddStageServiceItems`. Lần này `dotnet ef
  migrations add` cũng **không chạy được**: snapshot đã có sẵn lỗi thứ tự
  (`b.Navigation("ExaminationReasons")` đứng trước quan hệ dựng ra nó), có từ
  trước đợt này.

Endpoint riêng chứ không dùng `PUT /{id}`: DTO cập nhật đầy đủ bắt gửi lại bác
sĩ và răng, và `UpdateNote` đi qua `GuardEditable` — mà tờ này thường viết **sau
khi** đã có dịch vụ, nên một chẩn đoán `Treated` vẫn phải in được. Chỉ
`Cancelled` bị chặn.

### Một quyết định về XSS

Thân bài "Dữ liệu tư vấn" và khối tư vấn của tờ in đều là HTML người dùng soạn.
Bản gốc đổ thẳng bằng `dangerouslySetInnerHTML`; §5 CLAUDE.md cấm. Thêm
`src/components/RichTextView.tsx` — Quill ở chế độ chỉ đọc — nên markup đi qua
đúng bộ parse của trình soạn thảo đã ghi nó, và chỉ những thẻ Quill biết mới
sống sót. Không chỗ nào trong app dùng `dangerouslySetInnerHTML`.

### Chạy thật

Bản build production (`vite preview` :8080), API `:5019`, PostgreSQL thật, đăng
nhập qua màn hình thật, không chặn request nào.

- 5 spec mới/viết lại trong `patient.spec.ts` — **xanh**:
  - ảnh nằm trên cùng, không còn `.pd-image-drop`, tấm đầu cách mép thẻ < 24px,
    cao 240 `cover`, bấm vào mở `PatientImageViewer` với đếm `1 / N`;
  - "Chọn ảnh hiển thị" nhóm theo ngày, thẻ 280px, tích/bỏ tích đổi panel;
  - **kéo thẻ đầu sang cuối** → chờ đúng `PUT /reorder`, thứ tự đổi, **reload**
    vẫn giữ nguyên (thứ tự của server, không phải của trình duyệt);
  - `Danh mục` mở `[data-testid=consulting-library]`, có breadcrumb `n/N`,
    `Toàn màn hình` (đổi zoom 125% → 75%), `Esc` bước ra rồi mới đóng;
  - `In chẩn đoán` mở tờ, tích ảnh làm khối `I. HÌNH ẢNH CHẨN ĐOÁN` mọc ra và
    khối tư vấn đánh số lại thành `II`, `Cập nhật` → sửa → `Lưu chẩn đoán` chờ
    đúng `PUT …/print-content` 200, và **reload** vẫn đọc lại lời tư vấn đó.
- `Chẩn đoán & Tư vấn carries the reference's panels…` viết lại cho hợp hành vi
  mới (vùng thả chỉ khi không có ảnh; `Danh mục` mở modal) — xanh.
- `patient.spec.ts` (62), `patient-image.spec.ts`, `rich-image.spec.ts`,
  `treatment-stage.spec.ts`, `patient-medical-record.spec.ts`: xanh.
- `taxonomy*` + `payment-qr` + `branch-*` (42): **39 xanh / 3 đỏ**;
  `treatment-plan-detail.spec.ts`: 1 đỏ. Cả 4 cái đỏ **đỏ y hệt trên bản build
  sạch** (stash toàn bộ thay đổi, build lại, chạy lại) — đã có từ trước, không
  phải do đợt này:
  - `taxonomy-dialogs` × 2 — option "Tên thuốc" nằm ngoài viewport khi click;
  - `taxonomy` "a phone-width window…" — `.bd-cat-card` cao 0;
  - `treatment-plan-detail` "the slip code opens…" — `Doanh thu dự kiến` = 0,
    phụ thuộc dữ liệu.
- `tsc --noEmit` sạch, `eslint` sạch trên mọi file đã đụng.

### Một cái bẫy gặp lại

Ghi file đang được Vite theo dõi bằng `cat > …` làm dev server phục vụ module
rỗng: `does not provide an export named …` trong khi đĩa, `tsc` và `build` đều
sạch. Khởi động lại dev server là xong. Đây đúng là ghi chú đã có trong bộ nhớ
dự án — lần này nó dính vào ba file cùng lúc.

### 2026-09-08 (tiếp) — bốn lỗi chủ dự án bắt được khi dùng tay

| # | Lỗi | Nguyên nhân | Đã sửa |
|---|---|---|---|
| R-323 | Kéo một tấm ảnh **trong panel** lại tải lên thêm một bản sao | Chrome trả tấm ảnh kéo ra khỏi trang về qua `dataTransfer.files`, nên thả lại lên chính panel nó vừa rời khỏi trông y hệt một lần thả file từ ngoài vào | `<img>` trong `.pd-image-shot` đặt `draggable={false}`. Panel không có chuyện sắp xếp — chỗ đó nằm trong "Chọn ảnh hiển thị" |
| R-324 | Kéo đổi vị trí trong "Chọn ảnh hiển thị" bị **giật về chỗ cũ** một nhịp rồi mới nhảy sang chỗ mới | dnd-kit bỏ `transform` ngay khi thả, nhưng query cache báo cho observer ở tick sau — nên có đúng một frame thẻ đã hết transform mà thứ tự DOM thì chưa đổi | `PatientImageSortableRow` **tự giữ thứ tự vừa thả** (`dropped`) và render theo nó cho tới khi store đồng ý, rồi mới nhả. Thất bại thì store rollback và thắng |
| R-325 | Modal "In chẩn đoán": `Cập nhật` → sửa → `Lưu` xong thì nội dung **quay về bản cũ**, phải mở lại modal mới thấy bản mới | `useEffect` reset tờ phụ thuộc vào `clinic` / `patient` — hai object literal dựng mới mỗi lần cha render. Lưu xong `invalidateQueries` làm cha render lại → effect chạy → ghi đè `fields` bằng dòng chẩn đoán **cũ** | Effect reset khoá theo `diagnosis.id`, đọc props qua ref; letterhead có effect riêng và không bao giờ đè lên thứ đang sửa. Cha `useMemo` hai object đó |
| R-326 | Nội dung trong "Danh mục" trình bày xấu | `RichTextView` chỉ bỏ viền Quill, không có typography; `.ql-container` của Quill là `height: 100%` nên tờ giấy kéo dài quá nội dung | Thêm typography cho `.cl-sheet-body .ql-editor` (heading bậc thang, giãn khối, list, blockquote, ảnh, bảng, code), sân khấu thành mặt bàn `#F6F8FB` với tờ trắng đổ bóng như bản gốc, và `.bd-rich-view .ql-container` đổi `height: auto` |

**Chạy thật:** `patient-image.spec.ts` + `patient.spec.ts` trên bản build production
(`vite preview` :8080, API :5019, DB thật) — **66 xanh / 1 skip / 0 đỏ**. Spec kéo
thả thêm một khẳng định mới: đọc thứ tự **ngay sau `mouse.up()`**, trước khi
`PUT /reorder` trả về, đã phải đúng thứ tự mới — đó là chốt chặn cho R-324.
`tsc` sạch, `eslint` sạch.

---

## 2026-09-08 (chiều) — Kế hoạch tư vấn: voucher chi nhánh 2, kéo thả phiếu tư vấn, chân trang hai tờ in

Năm việc chủ dự án nêu trên `/patient/…?tab=consulting&branchId=2222…`. Chạy
thật trên bản build production (`vite preview` :8080), API :5019, PostgreSQL
thật, đăng nhập qua màn hình thật, **không chặn request nào**.

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-327 | Picker "Voucher áp dụng" trống trên chi nhánh 2: toàn bộ voucher seed đều thuộc chi nhánh 1, mà picker chỉ hỏi đúng chi nhánh trong URL | `SeedVouchersAsync` nhận `branchId` và được gọi cho **cả hai** chi nhánh. Chi nhánh 2 có danh sách riêng (`SecondBranchVouchers`): tiền/phần trăm, có/không ngưỡng tối thiểu, một cái độc quyền, một cái hết hạn — đo cho kế hoạch cỡ vài trăm nghìn, vì list của chi nhánh 1 đặt ngưỡng gấp 4 lần giá trị nên kế hoạch một dịch vụ không với tới |
| R-328 | Panel ảnh nháy ô xám "Kéo ảnh vào" trước khi ảnh về — đọc như hồ sơ không có ảnh | `useConsultingData` trả thêm `imagesLoading`; panel giữ `Spin` trong ô đó cho tới khi đọc xong. "Chưa đọc" và "không có ảnh" là hai chuyện khác nhau |
| R-329 | Bảng phiếu tư vấn không kéo thả được (ghi nhận cũ: "không có endpoint reorder") | `PUT /v1/app/patient-advises/reorder` `{id, sortOrder}` — đánh số lại 1..N quanh dòng được chuyển nên `SortOrder` không còn hòa/thủng (4 dòng của hồ sơ mẫu đều đang `SortOrder = 0`). FE dùng lại **đúng** `useDragReorder` + `bd-grip` của Danh mục, kèm mũi lên/xuống cho bàn phím |
| R-330 | Cột Dịch vụ mang cả răng, cột Chẩn đoán chỉ có tên — bản gốc gộp răng vào chẩn đoán | Dịch vụ chỉ còn tên (`.pd-cell-strong`); Chẩn đoán vẽ "28 - âsasa" màu link kèm `(ghi chú của phiếu chẩn đoán)` bên dưới, tra theo `patientDiagnosisId` |
| R-331 | Chẩn đoán dưới số răng ở bảng Tạo chẩn đoán vẽ màu xám | `.pd-cell-diagnosis` màu **#12A960** như bản gốc (chủ dự án chốt) |
| R-332 | Chọn voucher / Thêm kế hoạch điều trị / Tạo báo giá / In báo giá bấm được khi chưa tick dòng nào — không có số tiền nào để tính | Cả bốn `disabled` tới khi có ít nhất một dòng được tick. Dòng chữ nghiêng đổi thành "Chọn ít nhất một dịch vụ để áp dụng voucher." |
| R-333 | "Thêm kế hoạch điều trị" đi luôn khi chưa chọn bác sĩ điều trị | Chặn tại chỗ, `status="error"` trên select và `.pd-plan-dentist-error` **dưới ô** (không phải toast); chọn bác sĩ thì lỗi mất và lệnh đi kèm `dentistId` |
| R-334 | "Tạo báo giá" gọi `window.print()` — in nguyên trang app | Mở đúng modal "Chi tiết phiếu" như nút máy in |
| R-335 | Hai tờ in con ("In Hoá Đơn", "In hóa đơn kèm chẩn đoán") **thiếu chân trang chữ ký** — ghi nhận cũ "bản gốc không in chữ ký" là sai, bản in của chủ dự án có | `QuoteSignatures` dùng chung: báo giá là "Người lập phiếu / Khách hàng" + "(Ký, ghi rõ họ tên)", chỗ ký nằm trên tên; hóa đơn kèm chẩn đoán là "Bác sĩ chẩn đoán / Khách hàng" + "(Ký, họ tên)", tên trên chú thích. `break-inside: avoid` để không bị cắt sang trang |

### Kiểm chứng thật

- **API thật, có đăng nhập** (`/api/account/login`, cookie thật):
  `GET vouchers/available?clinicBranchId=2222…` trả **2 / 3 / 4** voucher ở mức
  0 / 1.000.000 / 3.000.000 đ — ngưỡng tối thiểu lọc đúng, cái hết hạn không bao
  giờ hiện, tất cả đều `scope=treatment`.
  `PUT patient-advises/reorder` → **204**, dòng cuối lên đầu và 4 dòng đánh số
  lại 1..4; đọc lại bằng request riêng thấy đúng. Đổi header sang chi nhánh 1 →
  **403** `BlueDental:Treatment:0015` (không phân biệt được "không có" với "của
  chi nhánh khác").
- **`e2e/consulting-plan.spec.ts` mới — 7/7 xanh**: panel spin tới khi có ảnh;
  cột chẩn đoán "răng - tên" màu link và dịch vụ đứng một mình; bốn lệnh khoá
  tới khi tick; thiếu bác sĩ thì báo lỗi dưới ô rồi chọn xong đi được; picker
  liệt kê `CN2WELCOME` và trừ vào tổng; **kéo grip đổi thứ tự và reload vẫn
  giữ**; hai tờ in đều có chân chữ ký.
- `patient.spec.ts` **63/63 xanh** sau khi sửa 4 chỗ còn sót từ đợt rebase sáng
  nay: `getByTestId("consulting-library")` → dialog "Thư viện ảnh lâm sàng" của
  `main`; `.pi-card` → `.pd-image-card` trong "Chọn ảnh hiển thị"; nhãn
  "In phiếu tư vấn" → "In Báo giá"; và setup của test voucher giờ hỏi
  `clinicBranchId` như giao diện (không hỏi thì tài khoản toàn hệ thống được
  trả voucher của **mọi** chi nhánh và test bắt phải một cái màn hình không có).
- BE: `dotnet build` sạch; Application.Tests 73 xanh, Domain.Tests (Voucher) 22
  xanh. `tsc -b` sạch, `eslint` sạch, `vite build` sạch.

### Còn đỏ, **không** thuộc đợt này

`patient-image.spec.ts` 3 đỏ (`the eye opens the viewer…`, `dragging a card by
its grip…`, `deleting asks first…`) — tab **Hình ảnh**, không phải màn này, và
không file nào của nó bị đợt này sửa. Đỏ ổn định cả khi chạy riêng. Đã loại được
hai giả thuyết: quyền (admin có đủ `treatmentImage.*`) và MinIO (đang chạy). Dấu
vết còn lại: spec dùng **một** `runId` ở scope module cho cả bốn test và mở
"bệnh nhân dòng đầu tiên" ở mỗi test, trong khi DB đã tích **80** ảnh `truoc-%`
rác trên **ba** bệnh nhân khác nhau từ các lần chạy trước — nên test sau có thể
mở hồ sơ khác hồ sơ mà test đầu vừa tải ảnh lên. Cần một đợt riêng: dọn ảnh rác
và cho spec tự tạo/khoá hồ sơ của nó thay vì "dòng đầu tiên".

### UNKNOWN còn treo

"Tạo báo giá" giờ mở "Chi tiết phiếu" giống nút máy in. Bản gốc có **lưu** một
bản báo giá (số phiếu, trạng thái) khi bấm nút đó hay không thì chưa soi được —
xem `docs/clone/unknowns.md`. Không có entity báo giá nên chưa thể clone phần lưu.

---

## 2026-09-08 (tối) — Bốn chỗ chủ dự án bắt tiếp trên Chẩn đoán & Tư vấn

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-336 | Panel ảnh **trắng** một lúc rồi ảnh mới hiện. Đợt chiều đo sai chỗ: `imagesLoading` chỉ phủ lúc đọc **danh sách**, mà danh sách về rất nhanh — chỗ chậm là **tải file ảnh**, nên thẻ đã dựng đủ 240px nhưng chưa vẽ gì | Mỗi thẻ giữ `pd-image-tile--loading` cho tới khi chính `<img>` của nó `load` (hoặc `error`, kẻo ảnh hỏng shimmer mãi): nền `#E6EAF0` + một vệt sáng chạy qua, `img` ẩn tới lúc đó. `prefers-reduced-motion` thì bỏ animation. Phần `imagesLoading` của đợt chiều vẫn giữ — hai pha khác nhau |
| R-337 | Biểu tượng kéo nằm **sau** ô tick. AntD luôn chèn cột chọn lên đầu, bất kể thứ tự `columns` | Khai báo `Table.SELECTION_COLUMN` **sau** cột grip trong mảng `columns` — antd đọc placeholder đó làm vị trí cột chọn. Grip thành ô ngoài cùng bên trái như bản gốc |
| R-338 | Tên bác sĩ ở chân "In hóa đơn kèm chẩn đoán" chỉ đọc, bản gốc **sửa được ngay trên tờ** (ô nền vàng nhạt) | `QuoteSignatures` nhận `onLeftNameChange`; có thì cột trái vẽ `<input class="pq-signs__name--edit">` nền `#FDF6E0`. Giá trị giữ dạng "chưa sửa" (`null`) rồi hiển thị `signedBy ?? diagnosingDoctor` — **không** dùng effect để seed, đúng bài học R-325. Khi in thì input mất viền/nền, in ra là một cái tên |
| R-339 | `Tạo báo giá` mở luôn "Chi tiết phiếu". Bản gốc hỏi xác nhận trước, rồi mở một **tab "BG 1"** cạnh "Phiếu tư vấn" chứa các dòng vừa tick, có ✕ đỏ để bỏ | `ConfirmDialog` dùng chung (Không / Có) — dialog yes/no đầu tiên của app, khác `ConfirmDeleteDialog` màu đỏ. `useAdviseQuotes` giữ danh sách báo giá; `AdviseQuoteTabs` vẽ dải tab. Tab đang mở quyết định bảng vẽ gì; chân TỔNG KẾ HOẠCH chỉ có ở tab kế hoạch. Grip trên tab báo giá đổi thứ tự **trong** bản báo giá đó (khách quan: chưa có endpoint nào để lưu) |

### Ghi chú clone

- Câu trong hộp xác nhận sao y bản gốc, **kể cả chỗ lặp** "đã chọn đã chọn".
  Giữ nguyên theo quy tắc clone 1:1; nếu chủ dự án muốn sửa thì đổi một chỗ.
- Dải tab thay đúng chỗ nút `Phiếu tư vấn` cũ. Khi chưa có báo giá nào, tab kế
  hoạch là tab đang mở nên vẫn xanh primary — trông y như cái nút trước đây.
  Bấm vào nó lúc đang mở thì mở "Tạo phiếu tư vấn", tức là giữ nguyên việc mà
  cái nút vẫn làm. Đây là **suy luận**, không phải đo được: bản gốc có thể tạo
  phiếu tư vấn từ chỗ khác.
- `<footer hidden>` không ăn vì `.pd-plan-summary` có `display` riêng — đổi sang
  không render. Ghi lại vì dễ dính lại.

### Chạy thật

`e2e/consulting-plan.spec.ts` **10/10 xanh** (thêm 3 test: thẻ ảnh shimmer tới
khi vẽ xong; grip là ô đầu tiên, trước ô tick; `Tạo báo giá` hỏi rồi mở tab BG 1
đúng các dòng đã tick, ✕ bỏ được, chân kế hoạch không lặp lại trên tab báo giá —
và test tờ in thêm phần sửa tên bác sĩ, và khẳng định tên khách hàng **không**
sửa được). `patient.spec.ts` + `treatment-stage.spec.ts` **65/65 xanh** (sửa một
chỗ trong `treatment-stage`: "Phiếu tư vấn" giờ là `role=tab`, không còn
`role=button`). `treatment-plan.spec.ts` 5/5 xanh. `tsc -b`, `eslint`,
`vite build` sạch.

### Còn đỏ, **không** thuộc đợt này

- `patient-image.spec.ts` 3 đỏ — như đã ghi ở mục 2026-09-08 (chiều).
- `treatment-plan-detail.spec.ts` "under 640px every tab folds into cards…" —
  ô "Nội dung" của `RefundDialog` cao 29.76px thay vì ≥120. Nguyên nhân đo được:
  `plan-detail.css` đặt `min-height: 152px` lên `.ant-input-affix-wrapper`, mà
  `Input.TextArea` + `showCount` của **antd 6** không còn dựng class đó nữa. Một
  dòng CSS là xong nhưng thuộc màn Chi tiết kế hoạch điều trị, cần đo lại ở
  600px — để đợt riêng.

---

## 2026-09-08 (khuya) — Ba chỗ chỉnh tiếp sau khi xem lại

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-340 | Ô tên bác sĩ ở chân tờ in **không chừa chỗ ký**: nó dán ngay dưới chữ "Bác sĩ chẩn đoán", lệch hẳn so với cột khách hàng bên cạnh. `.pq-signs__name` giữ khoảng ký bằng `padding-top: 46px`, mà shorthand `padding` của biến thể `--edit` reset mất — và padding trong một `<input>` chỉ làm ô cao thêm, không chừa chỗ | Biến thể `--edit` giữ khoảng ký bằng `margin-top: 46px`, và `align-self: center` để ô nằm giữa cột chứ không dán mép trái |
| R-341 | Cột grip rộng quá | `width: 28`, thêm class `pd-grip-cell` để cắt padding của antd (`padding-left: 8px`, `padding-right: 0`) — nếu chỉ đặt `width` thì padding mặc định vẫn giữ cột rộng gần bằng một cột thường |
| R-342 | Panel "Cột hiển thị" chưa giống bản gốc: thiếu ✕ đóng, các dòng **không kéo được**, và thiếu nút **Lưu** — tức là thứ tự cột cũng do người dùng, và bật/tắt chỉ áp dụng khi bấm Lưu | `adviseColumns.ts` (danh sách + nhãn + `ColumnSetting`), `AdviseColumnConfig.tsx` (head có ✕, mỗi dòng một `bd-grip` dùng lại `useDragReorder`, nút `Lưu` full-width). Panel sửa **bản nháp**; đóng bằng ✕ hoặc bấm ra ngoài là bỏ nháp. Bảng dựng cột theo **đúng thứ tự** panel để lại. Cùng khuôn với `Cột hiển thị` của Kế hoạch điều trị (`.tp-columns-save`) đã có sẵn |

### Hai cái bẫy khi viết test (đã ghi vào chính spec)

- **Hộp `<p>` gồm cả padding, ô `<input>` thì không.** So sánh mép trên của hai
  ô đọc ra 51px với 6px và kết luận sai là CSS lỗi. Phải đo ở **chữ**:
  `box.y + parseFloat(paddingTop)`. CSS vốn đúng — cả hai cột đặt chữ ở y 953/954.
- **AntD phóng popover từ 0.2.** Đo `boundingBox()` ngay khi panel vừa visible
  cho toạ độ chưa ổn định, nên `mouse.down()` bấm trượt cái grip và kéo không
  chạy — y hệt bẫy đã ghi cho modal "Chọn ảnh hiển thị". Phải `expect.poll` tới
  khi bề rộng dòng ổn định (≥240px) rồi mới đo.

### Chạy thật

`e2e/consulting-plan.spec.ts` **11/11**; `patient.spec.ts` + `treatment-stage`
+ `treatment-plan` cùng chạy: **81/81 xanh** trên bản build production (:8080,
API :5019, DB thật). Sửa một chỗ trong `patient.spec.ts`: panel cột giờ cần
`Lưu` mới áp dụng, nên test bật/tắt cột phải bấm Lưu. `tsc -b`, `eslint`,
`vite build` sạch.

---

## 2026-09-09 — Tab báo giá: giữ chân kế hoạch, và "Sao chép báo giá"

Ba chỗ đo lại từ ảnh chụp chủ dự án cung cấp, sửa lại chỗ đợt trước làm sai.

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-318 | Cột grip vẫn hơi sát lề | `width` 28 → **34**, `padding-left` 8 → **14px** (`padding-right: 2px`). Grip cách mép bảng ~16px thay vì ~12px |
| R-319 | Đợt trước **ẩn** chân TỔNG KẾ HOẠCH trên tab báo giá — sai. Bản gốc giữ nguyên khối đó, tính theo **các dòng đã tick của chính bản báo giá**, chỉ đổi lệnh giữa | Chân phiếu hiện ở mọi tab. Trạng thái báo giá dời từ `PatientAdviseCard` **lên** `PatientConsultingTab`, vì `usePlanVoucher` phải nhận đúng bộ dòng + tick của tab đang mở. Mỗi bản báo giá giữ `selected` riêng, khởi tạo bằng chính các dòng nó được tạo từ |
| R-320 | Thiếu nút **`Sao chép báo giá`**; và bản sao phải là một bản báo giá mới (`BG 1` → `BG 2`) | Trên tab báo giá, `Tạo báo giá` (primary) đổi thành `Sao chép báo giá` (viền, icon copy). `useAdviseQuotes.duplicate(id)` tạo bản mới mang **cùng dòng và cùng tick**, đánh số tiếp và mở luôn |
| R-321 | Thứ tự tab và chỗ đặt ✕ chưa đúng: ảnh 2 cho thấy `Phiếu tư vấn \| BG 2 \| BG 1` — bản **mới nhất đứng trước**, và ✕ chỉ có ở tab **đang mở** | `create`/`duplicate` **prepend** thay vì append; `AdviseQuoteTabs` chỉ vẽ ✕ khi `open`. Số thứ tự vẫn chỉ tăng, nên bỏ `BG 1` không làm `BG 2` đổi tên |

### Chưa đo được

Voucher: `usePlanVoucher` tính lại `gross` theo tab đang mở nên số tiền đúng,
nhưng **id voucher đã chọn** vẫn dùng chung giữa các tab — chọn voucher ở `BG 1`
rồi sang `BG 2` thì vẫn thấy chọn. Hai ảnh chụp đều ở trạng thái "Chọn voucher"
chưa chọn gì nên không biết bản gốc tách riêng hay không. Chưa làm state voucher
riêng cho từng bản báo giá; nếu đo lại thấy cần thì chỗ nối nằm gọn trong
`useAdviseQuotes` (thêm `voucherIds` vào `AdviseQuote`).

### Chạy thật

`e2e/consulting-plan.spec.ts` **11/11** — test tab báo giá mở rộng: chân phiếu
còn đó và có `Thêm kế hoạch điều trị` + `In Báo giá`, `Tạo báo giá` biến mất,
`Sao chép báo giá` tạo `BG 2` **đứng trước** `BG 1` và mở luôn, ✕ chỉ có ở tab
đang mở, và ✕ bỏ đúng bản của nó. `patient.spec.ts` + `treatment-stage` +
`treatment-plan`: **70/70**. Tổng **81/81** xanh trên bản build production
(:8080, API :5019, DB thật). `tsc -b`, `eslint`, `vite build` sạch.

---

## 2026-09-09 (tối) — Báo giá bị nhân đôi: một updater không thuần khiết

| # | Hiện tượng | Xử lý |
|---|---|---|
| R-322 | Tạo/sao chép báo giá ra **hai tab trùng nhau**, nhãn lặp (`BG 1 \| BG 2 \| BG 2 \| BG 1 \| BG 1`) và **ba tab cùng vẽ như đang mở**, cùng có ✕ | `useAdviseQuotes.add` gọi `setQuotes` và `setActiveId` **bên trong** updater của `setRaised`. Updater phải thuần khiết — StrictMode gọi nó **hai lần**, nên mỗi lần tạo chèn hai bản mang **cùng một `id`**, và cả hai đều khớp `activeId === quote.id` nên đều vẽ như tab đang mở. Đổi bộ đếm sang `useRef` và gọi mọi setter từ chính handler |
| R-323 | Thứ tự tab phải giảm dần theo thời gian tạo | Thêm `createdAt` và `ordinal` vào `AdviseQuote`, sắp theo **`ordinal` giảm dần** (không theo `createdAt`: hai bản tạo trong cùng một milli-giây sẽ bằng nhau ở đồng hồ, không bao giờ bằng nhau ở `ordinal`) |

### Bài học về chỗ chạy test

**Bản build production che đúng loại lỗi này.** StrictMode chỉ gọi updater hai
lần ở **development**, nên `consulting-plan.spec.ts` xanh 11/11 trên `:8080`
trong khi dev server `:5173` — chỗ chủ dự án thật sự dùng — thì nhân đôi tab.
Mục 17 CLAUDE.md cảnh báo chiều ngược lại (StrictMode gây **đỏ giả** trên dev);
chiều này thì nó gây **xanh giả** trên prod.

Đã làm hai việc:

1. Test khẳng định luôn cái bất biến bị vỡ: `toHaveCount(1)` cho mỗi nhãn tab và
   `.pd-advise-tab--on` phải đúng **một** cái. Đã dựng lại đúng phiên bản lỗi để
   chứng minh test bắt được (đỏ với bản cũ, xanh với bản đã sửa) rồi mới bỏ đi.
2. Từ giờ chạy spec này trên **cả hai**: `:8080` (bản nghiệm thu) và `:5173`
   (StrictMode). Ba chỗ trong spec phải thêm `:visible` mới chạy được trên dev,
   vì antd **giữ nội dung popover/modal đã đóng** trong DOM: `.pd-column-popover`,
   `.pd-column-close`, `.pq-sheet` / `.pq-dx` — không có `:visible` thì locator
   trúng bản ẩn của lần mở trước (đo lệch 914px ở chân tờ in). Cùng lý do
   `patient-image.spec.ts` đã dùng `.ant-popover:visible`.
   Cũng bỏ luôn bước "kéo trả lại thứ tự cột" ở cuối test cột: cấu hình cột là
   state của card, test sau điều hướng lại là tự về mặc định — kéo lần hai chỉ
   thêm chỗ vỡ (popover đóng giữa lúc kéo trên dev).

### Chạy thật

`consulting-plan.spec.ts` **11/11 trên `:5173`** và **11/11 trên `:8080`**.
`patient.spec.ts` + `treatment-stage` + `treatment-plan`: **69/69** trên `:8080`.
`tsc -b`, `eslint`, `vite build` sạch.

### Còn treo: báo giá **chưa lưu**

Chủ dự án cũng nhận ra "hình như nó không lưu luôn thì phải" — đúng. Tab báo giá
giữ trong bộ nhớ trình duyệt, tải lại trang là mất, vì BlueDental **chưa có**
aggregate báo giá nào. Xem `docs/clone/unknowns.md`. Dựng phần server là một đợt
riêng và cần biết bản gốc lưu những gì (số phiếu? trạng thái? có nằm cùng bảng
với `TreatmentPlan` không?).

---

## 2026-09-09 (khuya) — Hai việc server: mở kế hoạch điều trị, và lưu báo giá

### R-324 — "Thêm kế hoạch điều trị" tạo thật

Trước đó nút này chỉ **điều hướng** sang tab kế hoạch, không tạo gì. Endpoint
đã có sẵn từ trước: `POST /api/v1/app/patient-treatments`
(`PatientTreatmentAppService.OpenAsync`). Đã nối:

- `useConsultingActions.addToPlan(dentistId, rows, voucherDiscountAmount)`:
  **accept** các dòng còn `Created` rồi mới `openPlan`. Chỉ accept dòng
  `Created` — `PatientAdvise.Accept()` từ chối mọi trạng thái khác, nên accept
  bừa sẽ ném lỗi ở dòng đã accept trước đó. Dòng đã `Converted` thì bỏ ra (đã
  thuộc một kế hoạch khác), không có dòng nào dùng được thì báo lỗi rõ ràng.
- Chỉ đổi tab **sau khi** server nhận, để lần mở thất bại còn thấy toast.
- Voucher của chân phiếu đi kèm: thêm `VoucherDiscountAmount` vào
  `OpenTreatmentPlanDto` và `TreatmentPlan.ApplyVoucher(decimal?)` — trường này
  đã **được map từ trước nhưng chưa có chỗ nào gán**. `PlanDiscountAmount` cộng
  nó vào giảm giá phiếu rồi chặn trên tổng, nên "Tổng tiền" trên màn khớp với
  tổng của phiếu vừa mở.

Kiểm chứng thật: slip `DT02` được tạo, mang đúng dòng đã tick
(`sourceAdviseId`), advise chuyển `Converted` kèm `TreatmentPlanId`.

### R-325 — Báo giá lưu xuống server

Aggregate mới `PatientQuote` (`bd_patient_quotes`), migration
`20260908103740_AddPatientQuotes`, endpoint `api/v1/app/patient-quotes`
(list / create / duplicate / update / delete).

Quan trọng về thiết kế: **báo giá chỉ lưu tập dòng, thứ tự và tick — không lưu
giá**. Tiền tính lại từ chính các dòng tư vấn mỗi lần đọc, nên sửa giá một dịch
vụ không để lại số cũ trên báo giá. Có test chặn: `PatientQuoteLineDto` chỉ được
có đúng ba thuộc tính.

- Số "BG n" do server đánh, đếm **kể cả bản đã xoá mềm** (đếm với filter
  soft-delete tắt), nên xoá "BG 1" không làm bản sau lấy lại số 1.
- Danh sách trả về mới nhất trước.
- `PUT` nhận **cả tập** (tick + thứ tự) chứ không phải diff; server đánh số lại
  1..N.
- Cách ly chi nhánh: báo giá của chi nhánh khác trả cùng "not found" như báo giá
  không tồn tại (403 `BlueDental:Treatment:0026`).
- Mọi dòng phải là dòng tư vấn **của chính bệnh nhân và chi nhánh đó** — chặn
  việc một báo giá trỏ vào hồ sơ người khác.

FE: `patientQuoteApi.ts` + `useAdviseQuotes` viết lại thành server-backed
(TanStack Query). Hook nhận thêm `adviseRows` để phân giải `adviseId` thành
dòng; dòng nào mất thì bỏ khỏi khung, không vẽ rỗng.

### Về snapshot EF — đã sửa được chỗ chặn `migrations add`

`dotnet ef migrations add` **trước giờ không chạy được** trong dự án này (ghi ở
`AddStageServiceItems`, `AddDiagnosisPrintContent`): snapshot gọi
`b.Navigation("ExaminationReasons")` ở khối owned-types (dòng ~7628), **trước**
khối quan hệ tạo ra navigation đó (~7808). Đã chuyển lời gọi đó xuống mục
navigations ở cuối — một chỗ, và `migrations add` chạy lại được. Từ giờ không
cần viết migration bằng tay nữa.

Nhưng migration sinh ra vẫn phải **cắt bằng tay**: EF còn dồn thêm 7 `AddColumn`
trên `bd_treatment_services`, 3 `AlterColumn` và một `DropColumn`
`ExtraProperties` trên `bd_appointment_change_logs` — đó là drift tích từ các
migration viết tay trước đây. **Cả 7 cột đó đã có trong DB** (kiểm bằng
`information_schema`), nên áp vào sẽ lỗi "column already exists", còn
`DropColumn` thì xoá mất một cột đang sống. Chỉ giữ lại `CreateTable` +
`CreateIndex`; drift để nguyên như trạng thái ứng dụng vẫn đang chạy. Ghi rõ
trong chính file migration.

### Chạy thật

- API thật có đăng nhập: create → ordinal 1, duplicate → ordinal 2, list mới
  nhất trước, `PUT` đổi thứ tự + bỏ tick đọc lại thấy đúng, header chi nhánh
  khác → **403**, `DELETE` → 204, và tạo lại sau khi xoá cho **ordinal 3** (số
  chỉ tăng).
- `e2e/consulting-plan.spec.ts` **12/12 trên `:8080` và 12/12 trên `:5173`** —
  thêm hai test: "Thêm kế hoạch điều trị" tự tạo dòng tư vấn của nó qua API rồi
  kiểm slip + `Converted` (tự cấp dữ liệu vì mở slip **converts** dòng, dùng lại
  dòng seed thì chỉ chạy được một lần); và tab báo giá **sống qua reload**, xoá
  rồi reload vẫn mất. Test cũng tự dọn báo giá cũ của bệnh nhân trước khi chạy,
  và không đoán số "BG n" nữa — số là của server.
- BE: Domain.Tests **310/310**, Application.Tests **556/556**.
- FE khác: `patient` + `treatment-stage` + `treatment-plan` +
  `treatment-plan-detail` **74/75**; một đỏ là lỗi `RefundDialog` đã báo từ
  trước (min-height đặt lên `.ant-input-affix-wrapper` mà antd 6 không còn dựng
  cho `Input.TextArea showCount`) — không thuộc đợt này.
- `tsc -b`, `eslint`, `vite build` sạch.

### Còn treo

Việc bản gốc lưu gì cho một báo giá thì vẫn **chưa soi được** — shape ở đây là
của BlueDental, ghi trong `docs/clone/unknowns.md`. Nếu bản gốc có số phiếu hay
trạng thái riêng thì thêm vào aggregate này.
## 2026-09-08 — Design v2: bỏ sidebar, menu nhóm nằm trên header

(Ghi ngày làm là 08/09, nhưng nằm sau hai mục 09/09 vì nhánh này rebase lên
`6d6f267` sau khi làm xong.)

Bản `BlueDental v2.dc.html` trên claude.ai/design đã đổi sau ngày 01/09: bỏ hẳn
rail bên trái, header chạy full width `top: 0`, bốn nhóm menu kiểu Outlook mở
ribbon ngang ngay dưới header. Bản `.design-ref/` trong repo còn là bản cũ (có
`<aside>`), nên đã kéo bản mới về qua `claude_design` MCP trước khi code — diff
chỉ chạm khối style toàn cục, khung shell và phần `navGroups` của script; toàn bộ
thân trang không đổi, nên các màn hình dựng ở đợt v2 trước giữ nguyên.

| # | Defect | Fix |
|---|--------|-----|
| R-234 | Ô tìm kiếm co thành "Tìm…" và nút chi nhánh thành "N…" trong dải 1101–1240px | Đúng lỗi ghi trong checklist của design. Header ở dải này vừa còn thanh nhóm (426px) vừa còn đủ nút phải, nên ô tìm kiếm nằm đúng sàn `min-width: 150px` của design. Thêm media query `(min-width: 1101px) and (max-width: 1240px)` thu ô tìm kiếm về nút icon 38px — dưới 1100 thanh nhóm biến mất nên chỗ trống quay lại và ô tìm kiếm mở lại bình thường |
| R-235 | Chuông thông báo đếm sai: mọi thông báo đều tính là chưa đọc | `NotificationDto` phía FE không khớp DTO của BE. FE khai `{ message, isRead, creationTime, entityId }`, BE trả `{ subject, body, deliveryStatus, sentAt, referenceEntityId }` — `!undefined` luôn bằng `true` nên badge đếm cả danh sách. Viết lại type theo đúng `NotificationDto`/`DeliveryStatus` của BE, thêm adapter ở tầng `api/` (`deliveryStatus === Read`, thời gian tương đối, route theo `NotificationType`) |
| R-236 | `/settings` trong `routes.spec.ts` đỏ sau khi bỏ rail | Marker cũ là `/cài đặt|setting/i`, trước đây khớp **mục menu của sidebar** chứ không phải nội dung trang — trang tự đặt tiêu đề là "Hồ sơ". Đổi marker sang `/hồ sơ|thông tin cá nhân/i`. "Cài đặt" nay nằm trong dropdown tài khoản, đúng như design v2 (đã bỏ `settings` khỏi `navDef`) |

Lệch có chủ ý so với design, ghi lại để khỏi tưởng là thiếu:

- **"Điều trị"** trong nhóm Phòng khám bị bỏ. Design cho nó trỏ về hồ sơ bệnh
  nhân ở tab điều trị; ở đây điều trị cũng nằm trong hồ sơ bệnh nhân nhưng không
  có route danh sách riêng, nên drawer có **14** mục thay vì 15. Thêm một link
  không đi đâu thì tệ hơn.
- **"Cài đặt"** và **bộ chuyển ngôn ngữ** đưa vào dropdown tài khoản. Design bỏ
  `settings` khỏi menu, còn nút VI bị ẩn từ 1040px xuống — nếu không đưa vào
  dropdown thì màn hình nhỏ mất hẳn đường đổi ngôn ngữ.
- Dropdown thông báo trong file design còn sót màu của bản nền tối
  (`border-bottom: #232a56`, hover `rgba(255,255,255,.06)`) — dùng
  `--bd-divider` / `--bd-surface-3` thay, đúng ý bản sáng.

Mức retest: **3** — shell dùng chung cho mọi màn.

Kết quả (chạy trên bản build production, `vite preview`, BE thật + PostgreSQL thật):

- `e2e/header-navigation.spec.ts` (mới, thay `sidebar-navigation.spec.ts`):
  **9/9** — bốn nhóm, ribbon đúng thành viên, nhóm-có-route thì điều hướng thay
  vì mở, chọn item thì đóng, đổi nhóm thì ribbon đổi ngay, bấm lại chính nhóm đó
  vẫn mở, Escape và click ra ngoài đều đóng, backdrop không phủ lên thanh menu,
  dưới 1100px hiện drawer 14 mục, đổi ngôn ngữ.
- `auth`, `branch-switcher`, `routes`: **21/23**. Hai lỗi còn lại có sẵn từ
  trước, không liên quan: tài khoản `manager` chưa được seed vào DB local
  (`branch-switcher`), và `/timekeeping` không còn là route riêng từ `185a179`
  (đã gộp vào `/calendar?tab=timekeeping`) nhưng `routes.spec.ts` chưa bỏ dòng đó.
- Bộ Danh mục (`taxonomy`, `taxonomy-groups`, `taxonomy-flat`,
  `taxonomy-dialogs`, `payment-qr`): **32/34**. Hai lỗi đã **đối chứng bằng
  `git stash`**: chạy lại trên cây gốc vẫn đỏ y hệt, tức có sẵn từ trước.
- `tsc -b` sạch, `oxlint` không thêm cảnh báo, `vite build` xanh.

Kiểm chứng runtime thật của chuông thông báo: chèn 3 bản ghi vào
`bd_notifications` của DB dev, mở panel thấy badge **2** chưa đọc, bấm vào dòng
"Đã ghi nhận thanh toán" → điều hướng sang `/billing` và DB đổi
`DeliveryStatus 2 → 4`, `ReadAt` có giá trị. Không mock request nào.

## 2026-09-09 — Design v2: tiêu đề trang trên mọi màn, và khoảng hở dưới thanh nhóm

Chủ dự án chỉ ra hai chỗ sau khi áp design v2: màn Bệnh nhân **không có tiêu đề**
như bản thiết kế, và có **một dải trống** giữa thanh nhóm và thanh công cụ.

| ID | Triệu chứng | Nguyên nhân & cách xử lý |
|---|--------|-----|
| R-237 | Dải trống ~26px dưới thanh nhóm ở `/patient` | Hai phần tử rỗng vẫn nằm trong cột flex `gap: 12px` của `.bd-patient-page`: thanh công cụ thu gọn khi chưa hiện (`height: 0` + 2px viền trong suốt) và ô mốc `sentinel` của `useScrolledPast`. Không cao nhưng mỗi cái vẫn ăn một khoảng `gap`. Thanh thu gọn chuyển sang `display: none` khi chưa vào, `sentinel` chuyển sang `position: absolute` — cả hai không còn chiếm chỗ |
| R-238 | 9 màn không có tiêu đề trang; 5 màn có tiêu đề nhưng lệch chữ so với design | Bổ sung `PageHeader` (tiêu đề 23px/700/-.6px + phụ đề 13px, đúng thông số design) cho Tiếp nhận, Lịch hẹn, Bệnh nhân, Labo, Vật tư, Vận hành, Báo cáo, Danh mục, Cài đặt phòng khám; sửa chữ cho Nhân sự, CSKH, Voucher, Công cụ theo đúng design |
| R-239 | Tiêu đề Labo/Vật tư/Vận hành/Danh mục nằm **trong** khối trắng | Bốn màn này có thân là một khối trắng cao hết màn (`height: calc(100vh - …)`). Đặt `PageHeader` vào trong khối làm tiêu đề nằm trên nền trắng, sai với design (tiêu đề nằm trên nền trang). Thêm `.bd-shell-page` bọc ngoài: khối bọc giữ ngân sách chiều cao, khối trắng nhận `flex: 1` — không phải trừ tay chiều cao của tiêu đề |

Lưu ý:

- Đây là thay đổi **thuần UI**: không đụng logic nghiệp vụ, không đổi API,
  không đổi DTO. Chỉ thêm component tiêu đề và sửa khoảng cách.
- Phần diff lớn ở `OperationsPage.tsx` (262 dòng) **chỉ là thụt lề** do lồng
  thêm một cấp. `git diff -w` cho thấy toàn bộ thay đổi thật là 121 dòng thêm /
  12 dòng bớt trên 16 file.
- `AppointmentCalendarPage` chạy toàn màn hình được, nên thêm luật ẩn tiêu đề
  trong `body.cal-fullscreen`.

Mức retest: **1** (thị giác) cho 14 màn, **3** cho `/taxonomy` vì nằm trong
phạm vi khoá của mục 17 CLAUDE.md.

Kết quả (chạy trên bản build production, `vite preview` cổng 8081, BE thật +
PostgreSQL thật, đăng nhập qua màn hình đăng nhập thật, không chặn request nào):

- Bộ khoá của Danh mục (`taxonomy`, `taxonomy-groups`, `taxonomy-flat`,
  `taxonomy-dialogs`, `payment-qr`, `branch-isolation`, `branch-switcher`):
  **38/42**. Bốn lỗi còn lại đã **đối chứng trên cây gốc** (`git checkout` về
  HEAD, build lại, chạy lại): đỏ y hệt, tức có sẵn từ trước —
  `branch-isolation:40`, `branch-switcher:35` (tài khoản `manager`/`branch2`
  chưa seed), `taxonomy:277` (khối `.bd-cat-card` ở bề ngang 430px),
  `taxonomy-dialogs:207` (chập chờn — chạy riêng bộ dialogs thì **6/6** xanh).
- Chụp lại 15 màn ở 1440×900 sau khi đăng nhập thật: mọi màn đều có tiêu đề,
  nội dung bắt đầu đúng ở mốc 80px, không màn nào tràn ngang
  (`scrollWidth === clientWidth`), console không có lỗi.
- `tsc -b` sạch, `oxlint` không thêm cảnh báo, `vite build` xanh.

## 2026-09-21 — Báo cáo: nối API thật cho cả bốn tab, đối chiếu dialog và file Excel với bản gốc

Yêu cầu: bỏ hẳn mock ở `/report`, kiểm kỹ với bản gốc (mở dialog, không lưu)
và làm các file Excel giống hệt. Chạy lại mức **2** trên bản build production
(`vite preview` :8080, API :5000, PostgreSQL thật, không chặn request nào):
`report.spec.ts` **5/5**, `finance.spec.ts` **2/2**.

| ID | Triệu chứng | Nguyên nhân & cách xử lý |
|---|--------|-----|
| R-343 | Xoá `useClientPaging.ts` cùng lúc với mock thì **8 component** mất import | Hook không phải mock — tám bảng của tab 1/2/4 vẫn phân trang phía trình duyệt bằng nó. Lấy lại bằng `git checkout --`. Bài học: `grep` chỗ dùng trước khi xoá file |
| R-344 | Sửa một giao dịch ở tab 4 tạo **thêm một dòng** thay vì sửa | BE chỉ có `POST cashflow-entries`; modal sửa gọi lại create. Thêm `PUT /cash-management/cashflow-entries/{id}` (đọc bản ghi theo chi nhánh, đổi holding / số tiền / danh mục / ghi chú, số dư tính lại), hook `useUpdateCashflowEntry`, modal rẽ nhánh theo `entry` |
| R-345 | Cột "Người tạo" tab 4 ghi "Không xác định" cho mọi dòng | `CreatedByStaffName` không bao giờ được gán. Tra tên qua `IIdentityUserRepository.GetListByIdsAsync` một lần cho cả trang rồi gán vào DTO |
| R-346 | Thẻ "Thông tin thu chi" ở tab 1 không đổi sau khi thêm phiếu ở tab 2 | Mutation của `sales` chỉ invalidate key của chính nó. Invalidate thêm `clinicReportKeys.all` sau mọi ghi ở tab 2 / 4 |
| R-347 | Gửi ngày dạng ISO đầy đủ tới tham số `DateOnly` → 400 | Mọi ngày lên API đi qua `API_DATE_FORMAT` (`YYYY-MM-DD`) |
| R-348 | Tổng theo ngày ở tab 1 **nhảy mất một ngày** trên trình duyệt múi giờ âm (và eslint `prefer-const`) | Vòng lặp cộng mili-giây UTC rồi cắt `toISOString`. Đi theo ngày lịch bằng `dayjs(...).add(1, "day")`, chốt 400 ngày |
| R-349 | Tạo phiếu thứ hai trong cùng giây → Postgres 23505 trùng mã | Sinh mã bằng max-suffix trong chi nhánh thay vì đếm số dòng |
| R-350 | Tab 2 / 4: thêm / sửa / xoá danh mục và giao dịch **không có** toast, người dùng không biết đã lưu | Chữ lấy từ bundle gốc chỗ nào có, còn lại theo khuôn của app: "Tạo/Cập nhật danh mục thành công", "Đã xoá danh mục", "Tạo/Cập nhật giao dịch thành công", "Đã xoá giao dịch". Phiếu thu/chi giữ **không** toast (bản gốc UNKNOWN) |
| R-351 | Xuất Excel tab 2 / 4 chỉ có header, không có tiêu đề, độ rộng cột mặc định | Bundle gốc ghi tiêu đề gộp dòng 1, dòng 2 trống, header dòng 3 và `!cols`. `exportToExcel` nhận `{ sheetName, title, columnWidths }`; ba file dùng đúng tên file / sheet / tiêu đề / cột / mapper của bundle (`pages/report.md`) |
| R-352 | Spec đọc file tải về thấy `!cols` **rỗng** dù file có độ rộng | SheetJS chỉ nạp `!cols` khi `XLSX.read(..., { cellStyles: true })` |
| R-353 | Spec kỳ vọng mã `THANHTOAN-…` nhưng file local ghi `PT26-0027` | Mã phiếu là bộ đếm của Billing, không phải định dạng của bản gốc — khác biệt đã nêu, spec so `/^PT\d{2}-\d{4}$/` |
| R-354 | `getByRole("button", { name: "Nạp", exact: true })` không tìm thấy nút | AntD ghép tên icon vào tên truy cập: "vertical-align-bottom Nạp", "vertical-align-top Rút", "swap Luân chuyển", "download Xuất Excel". Dùng `/Nạp$/`, không `exact` |
| R-355 | `git worktree add` và host :5000 chết vì phiên khác dùng chung checkout | Chạy host bằng `dotnet run --no-build` ghi log ra scratchpad, preview `--strictPort`; dừng host trước `dotnet build` (MSB3027 khoá DLL) |

Đã đối chiếu với bản gốc (chỉ mở, không lưu): bảy dialog của tab 2 / 4 khớp
trường và chiều rộng (772 / 500); nút Lưu "Thêm danh mục sổ quỹ mới" disabled
tới khi có tên — local cũng vậy. File Excel tab 2 / 4 của bản gốc **chưa tải
được với dữ liệu** (chi nhánh gốc không có dòng nào, chỉ thấy toast rỗng) —
cấu trúc lấy từ bundle, ghi ở `pages/report.md`.

Chưa có test HTTP thật phía BE cho `ClinicReport` / `SalesEntry` /
`CashManagement` — `HttpApi.Host.Tests` chưa có hạ tầng WebApplicationFactory
/ Testcontainers; bằng chứng runtime là hai spec trình duyệt trên. Chưa commit.

## 2026-09-22 — Báo cáo: bỏ hết khác biệt với bản gốc (mã phiếu, màu danh mục, người nộp, kho thẻ, option dialog, kỳ mặc định)

Chủ dự án: "Làm cho giống ref App đi k cần hỏi" và "check lại toàn bộ option của
modal". Bảy dialog của bản gốc được mở lại (không lưu) để đối chiếu từng danh
sách chọn; kết quả và giả định ghi ở `docs/clone/pages/report.md` §"Đợt đồng bộ
2026-09-22". Retest mức 2, `report.spec.ts` + `finance.spec.ts` 7/7 xanh.

| ID | Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|---|
| R-356 | `DbMigrator` báo `Failed to connect to 127.0.0.1:15432` dù PostgreSQL đang chạy | `DbMigrator/appsettings.json` trỏ cổng 15432, còn container và host dùng 5432. Không sửa file; chạy với biến môi trường `ConnectionStrings__Default="Host=localhost;Port=5432;…"` |
| R-357 | `browser_click` (Playwright MCP) báo `expected string, received undefined → target` | Tool nhận `target` (ref từ snapshot) chứ không phải `ref`; truyền `target` + `element` |
| R-358 | Dialog phiếu thu/chi cần Hình thức 4 mục có ô tìm kiếm như bản gốc nhưng `SearchSelect` chỉ nhận `string` | Không ép kiểu: bọc `ChannelSelect` chuyển số ↔ chuỗi qua tra cứu option (`SalesEntryModal.tsx`) — `PaymentChannel` giữ là số trong form và DTO |
| R-359 | Nạp của bản gốc có "Cà thẻ (đối soát)" nhưng enum local chỉ có Cash / Bank / CustomerPrepaid | Thêm `CashHolding.Card = 4`; `cashHoldingsFor(type)` trả 3 kho cho Nạp, 2 kho cho Rút / Luân chuyển; balance tính `cardPending` từ kho này + thanh toán kênh thẻ (GIẢ ĐỊNH, bản gốc hiện 0) |
| R-360 | "Luân chuyển đến" của bản gốc liệt kê cả hai kho (mặc định kho còn lại), local lọc bỏ kho nguồn | Bỏ lọc, thêm validator "Nơi nhận phải khác hình thức chuyển" + `dependencies={["holding"]}`, effect đặt lại nơi nhận khi trùng |
| R-361 | Sau khi thêm `salesTab=real-revenue`, bấm "Thanh toán" / "Hoàn tiền"… lại nhảy về "Khách hàng phát sinh dịch vụ" | Sub-pill đọc thuần từ URL mà chỉ "Doanh số thực" có giá trị URL → các pill khác luôn về mặc định. Giữ pill trong `useState`, URL chỉ ghi/đọc `real-revenue` (`useReportUrlState.ts`) |
| R-362 | Bản gốc `/report` tự ghi `?report_dateMode=day&report_date=<hôm nay>` khi mở, local xoá tham số khi là mặc định | `useEffect` ghi cả hai tham số (`replace: true`) khi thiếu / sai; `setViewMode` luôn ghi. Spec: mode loop kết thúc ở Tháng để file Thanh toán có dòng (mặc định ngày → hôm nay rỗng) |
| R-363 | `vite build` chết `EPERM … dist/assets/stethoscope-*.js` rồi `Access is denied` — file không xoá / đổi tên được | Một tiến trình khác giữ file trong `dist` (phiên khác dùng chung checkout). Build sang `--outDir dist-preview` và chạy `vite preview --outDir dist-preview --port 8080 --strictPort` |
| R-364 | Escape để đóng dropdown `SearchSelect` trong modal làm đóng luôn modal → bước sau timeout | `SearchSelect` không chặn keydown, AntD Modal bắt Escape. Trong spec đóng list bằng click ra ngoài (`.ant-modal-title`); AntD `Select` không bị (dừng ở dropdown) |
| R-365 | Spec kỳ vọng `THANHTOAN-…` nhưng dữ liệu demo cũ vẫn `PT26-0027` / `TT26-…` / `HT26-…` | Dòng tạo trước khi đổi `FormatCode`. Đánh số lại trong DB local bằng SQL (row_number theo chi nhánh / loại / năm) — 27 THANHTOAN, 12 HOANTIEN, 5 TAMUNG, không trùng; `GenerateCodeAsync` đếm dòng nên số mới nối tiếp |
| R-366 | "Doanh số thực" local vẫn hiện khối biểu đồ Thực thu / Công nợ bên dưới | Bản gốc (mở pill, chỉ xem) chỉ có ô tổng + bảng 8 cột. Thêm `actual` vào `TABLE_ONLY_SUBS` (`ExpenseTab.tsx`) |
| R-367 | Luân chuyển: đổi Hình thức trùng nơi nhận → nơi nhận đã tự lật nhưng lỗi "Nơi nhận phải khác hình thức chuyển" vẫn đỏ (chủ dự án báo) | Race của AntD Form: `dependencies={["holding"]}` re-validate "toHolding" đồng bộ trong `updateValue` (đã bắt giá trị trùng), kết quả về bất đồng bộ **sau** khi effect xoá lỗi bằng `setFields` → lỗi cũ đè lên. Sửa: lật trong `onValuesChange` (không dùng effect) + `form.validateFields(["toHolding"])` ngay sau `setFieldValue` (validatePromise mới thay promise cũ) + rule đọc `getFieldValue("holding")` lúc validate thay vì closure render |
| R-368 | Dialog Nạp local không có dòng "Số dư khả dụng"; bản gốc có khi chọn Cà thẻ (đối soát), nhãn "(Cà thẻ chờ đối soát)" | Quan sát bản gốc 2026-09-22 (chỉ đổi select): Nạp hiện dòng này **chỉ** với kho Cà thẻ, Rút / Luân chuyển hiện theo Hình thức. `CashflowEntryModal`: `showBalanceHint = !isDeposit \|\| holding === Card`, nhãn qua `balanceHintLabelsFor()` (Card → "Cà thẻ chờ đối soát", còn lại = nhãn kho) |
| R-369 | Luân chuyển: chọn "Luân chuyển đến" trùng Hình thức local báo lỗi khi Lưu; bản gốc lật **Hình thức** sang kho kia (nơi nhận giữ nguyên), không có lỗi | `handleValuesChange` đối xứng: bên nào vừa đổi trùng bên kia thì lật bên kia (`otherHolding`), re-validate; validator giữ làm chốt chặn không tới được bằng UI. Spec tab 4 kiểm tra cả hai chiều lật + dòng số dư đổi theo nguồn (thay bước "Lưu → lỗi") |

## 2026-09-22 (tối) — Báo cáo: tab 2 dựng lại theo thao tác thật trên staging

Chủ dự án: "làm local luôn đi hãy làm cho hoàn toàn giống ở ref app 100%". Các
luồng ghi của tab Quản lý thu chi được bấm thật trên staging.nfcdental.com
(được phép; bản ghi thử ghi chú "BlueDental clone test … - se xoa"), rồi local
dựng lại: nút trên dòng, hộp xác nhận, modal in, toast, validate, xoá mềm,
duyệt không body, xoá danh mục đang dùng, `cashflowTab`, sub-tab Tạm ứng. Retest
mức 2, `report.spec.ts` + `finance.spec.ts` 7/7 xanh trên preview :8080 (1,3 phút).

| ID | Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|---|
| R-370 | Spec tab 4 chờ toast "Đã xoá nhóm" sau khi xoá danh mục sổ quỹ nhưng không thấy | Staging: danh mục thu / chi gọi là "nhóm" ("Tạo nhóm thành công", "Đã xoá nhóm"), danh mục sổ quỹ vẫn là "danh mục". `deleteCategory(page, name, toast)` nhận chữ toast; `CategoryFormModal` / `CashflowCategoryManager` rẽ theo `isCashbook` |
| R-371 | `getByRole("button", { name: "Close" })` trong modal "Chi tiết phiếu" timeout | App đặt aria-label nút đóng AntD Modal là "Đóng" (snapshot: `button "Đóng"` > `img "close"`). Spec bấm `.ant-modal-close` |
| R-372 | `dotnet build` HttpApi.Host báo MSB3021 không copy được `BlueDental.HttpApi.dll` (6 lỗi) | Host đang chạy `dotnet run --no-build` giữ file trong `HttpApi.Host/bin`. Chỉ là lỗi copy — kiểm tra biên dịch bằng `dotnet build src/BlueDental.Application` (0 lỗi); muốn host nhận code mới thì TaskStop rồi build + run lại |
| R-373 | Local duyệt chi bằng `POST /sales/{id}/approve { staffId }`; staging là `PUT /sales/{id}/approve` **không body** → 200 | `ApproveAsync(Guid id)` lấy người duyệt từ `CurrentUser.GetId()`; controller `[HttpPut("{id:guid}/approve")]`; DTO `ApproveSalesEntryInput` xoá. `SalesEntryAppServiceContractTests` chỉ soi attribute nên không đổi. `RejectAsync` giữ trên API (test contract) nhưng không còn UI |
| R-374 | Local chặn xoá danh mục đang có phiếu (`CategoryInUse`); staging xoá được, phiếu và dòng con tab 3 vẫn hiện tên | `CashflowCategoryAppService.DeleteAsync` chỉ chặn `IsSystem`; tra tên danh mục trong `SalesEntryAppService.MapToDtosAsync` và `ClinicReportAppService.CategoryNamesAsync` bọc `IDataFilter<ISoftDelete>.Disable()`. Spec tab 2 và `finance.spec.ts` xoá danh mục ở cuối rồi khẳng định dòng phiếu vẫn mang tên |
| R-375 | Thẻ "Tổng chi phí" local cộng cả dự chi; staging chỉ cộng đã duyệt | `CashflowExpenseView`: `sum(approved)`; spec khẳng định thẻ không đổi khi thêm phiếu dự chi và tăng đúng sau duyệt |
| R-376 | Spec tạo "Mục tạm E2E …" xong không thấy dòng (timeout 5 s) — dòng nằm trang 2 | Bảng danh mục phân trang 20; các lần chạy trước để lại 35 danh mục `Mục … E2E` (BE cũ không cho xoá danh mục có phiếu). Xoá mềm 35 dòng bằng SQL trên DB local; hai spec nay tự xoá danh mục của mình ở cuối (R-374) nên bảng ở lại trang 1 |
| R-377 | Dòng thu nhập local có nút xoá, dòng chi phí dự chi có nút Từ chối (modal lý do); staging: 4 nút tròn 32px Duyệt chi / Chỉnh sửa / Xoá / In, đã duyệt chỉ còn In, thu nhập chỉ Chỉnh sửa + In, không có Từ chối | `CashflowRowActions` viết lại (aria-label = tooltip), `ConfirmApproveDialog` ("Xác nhận duyệt"), `ConfirmDeleteDialog` với `title="Xác nhận xoá"` + câu "Bạn có chắc muốn xoá phiếu chi **{nội dung}** không?", `SalesEntryDetailModal` ("Chi tiết phiếu", 1024px) + `SalesEntryPrintSheet` (tờ A4 ẩn, `@media print`); `RejectReasonModal.tsx` xoá; CSS trong `report.css` (`.report-row-action`, `.report-print-*`) |
| R-378 | Sub-tab Tạm ứng local có nhãn / thẻ số khác staging; cột Phiếu thanh toán trống với dòng tạm ứng | Staging: 4 thẻ Tạm ứng phát sinh / Tiêu tạm ứng (âm) / Hoàn tiền (âm) / Số dư, pill = phát sinh − tiêu − hoàn, gộp ô Ngày → Khách hàng → Số dư sau, mã THANHTOAN hoặc "-". `PrepaidSubTab` viết lại với `groupSpans` / `spanCell`; BE `PaymentCode = "-"` cho dòng tạm ứng; `PaymentSubTab` thêm thẻ "Tạm ứng" (6 thẻ). Sub-tab tab 2 ghi URL `cashflowTab=income|expense|category` (`useReportUrlState`), xoá khi rời tab |
| R-379 | `tsc --noEmit` báo 2 lỗi ngoài feature report: `AppLayout.tsx(18)` TS6133 `NotificationBell` không dùng, `ReceptionPage.tsx(164)` TS2322 `ViewMode` / `DateNavigatorMode` | Hai file sạch trong git (HEAD 8c4e430) và thuộc phiên khác đang làm chung checkout — không sửa. `eslint src/features/report` 0 lỗi, `vite build` thành công; báo lại chủ dự án |

## 2026-09-22 (tối, 2) — Báo cáo: soát lại 4 tab theo bundle staging

Chủ dự án: "Kiểm tra kỹ trang /report … hoàn thiện cho giống 100%". Bundle JS
của staging (`reference-private/report/bundle/`) được đọc lại hàm theo hàm
(`ev(type)`, cột modal, tờ in, gate quyền, modal tab 4) rồi so với local từng
tab; app.nfcdental.com chỉ xem. Spec chạy trên bản build production
(`vite preview` :8080, API :5000 build lại với DTO mới, PostgreSQL thật).

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-380 | Nút in trên dòng thu nhập ghi "In thu nhập"; modal "Chi tiết phiếu" thiếu cột Khách hàng và cột ngày thứ hai, độ rộng khác bundle | Nhãn và bảng khác bản gốc, spec tìm nút "In" chung chung | Nhãn dựng tay thay vì theo `ev(type)` của bundle ("In khoản thu" / "In chi phí", Ngày thực thu / chi, Nội dung thu / chi, Người nộp / nhận) | `voucherLabels(type)` dùng chung cho cột, dialog, modal, tờ in, `aria-label`; modal 8 cột 130/140/150/220/140/140/130/140, Số tiền phải đậm | F-17 (`report.spec.ts` bấm "In khoản thu" / "In chi phí") |
| R-381 | Tờ in A4 có cột Khách hàng, Số tiền không canh phải, thiếu "Số: <mã>" | In khác bản gốc | Tờ in copy bảng trên màn hình thay vì mảng cột riêng của bundle (7 cột, khách ở khối đầu trang) | `SalesEntryPrintSheet` 7 cột + `.report-print-cell--amount`; `@page` A4 10mm (giả định, ghi rõ) | F-17 |
| R-382 | Mọi nút thêm / duyệt / xoá / nạp / rút / luân chuyển / xuất Excel hiện với mọi tài khoản; sub-tab tab 4 không theo quyền | Người không có quyền vẫn thấy nút (server vẫn chặn) | Bundle gate từng nút bằng `usePermission("income.create")`, `cost.approve`, `transfer.deposit`…; local chưa ánh xạ | `useReportPermissions.ts` ánh xạ sang `BlueDental.Finance.*`; `CashflowV2Tab`, `CashflowV2Overview`, `CategoryPanel`, `cashflowLedgerColumns` ẩn nút / sub-tab theo quyền | F-17 (admin đủ quyền nên spec thấy đủ nút; quyền từng vai chưa có spec) |
| R-383 | Dialog sửa danh mục ghi "Sửa danh mục …", cột Thao tác bảng danh mục 120 cho cả sổ quỹ, mã màu in thường | Chữ và độ rộng khác staging | Tiêu đề và độ rộng dựng theo suy đoán | "Chỉnh sửa danh mục thu nhập / chi phí / sổ quỹ"; Thao tác 70 khi có màu, 120 khi không; `.report-color-code` uppercase; nút "Thêm mục" gate theo quyền tạo | F-17 (`report.spec.ts` đọc "Chỉnh sửa danh mục chi phí") |
| R-384 | Tab 4: dòng chỉ có bút + thùng, không có Xem chi tiết; ô số dư cùng tone; pill danh mục không màu; hai dòng dưới ô cùng màu | Thiếu modal "Chi tiết phiếu" / "In Hoá Đơn" của bản gốc, màu khác | Bundle có nút mắt mở voucher (PHIẾU THU / CHI / LUÂN CHUYỂN DÒNG TIỀN, Bằng chữ, Người lập phiếu) và tone blue/green/gold/violet; `CashflowEntryDto` không mang màu danh mục / ngày tạo | BE `CashflowEntryDto.CategoryColor` + `CreationTime`; FE `CashflowEntryVoucher`, `CashflowEntryDetailModal`, `cashflowLedgerColumns` (Xem chi tiết / Chỉnh sửa / Hủy có gate), tone `violet` mới, `--pill-color` | F-17 (`report.spec.ts` mở modal, đọc "Chi tiết phiếu", "Bằng chữ", "In Hoá Đơn") |
| R-385 | Tab 1 Dư nợ không có chip "(đã hủy)" / "(thay thế)"; Thanh toán không ghi đỏ "(đã huỷ)"; độ rộng cột Dư nợ / Chi phí và đơn vị đếm khác | Bảng khác bản gốc | BE không trả trạng thái dịch vụ cho dòng dư nợ, không trả tên dịch vụ đã huỷ cho dòng thanh toán | BE `DebtLineDto.Status`, `PaymentLineDto.CancelledServiceNames`; FE `STATUS_CHIP`, `ServiceList`, cột 130/190/170/180/190/120 và 130/190/170/180/190/120/140/160, `countUnit` "dòng" / "phiếu", tone blue/green/red | F-17 (`report.spec.ts` tab 1 đọc bảng thật; chip cần dữ liệu huỷ — chưa có case trong spec) |
| R-386 | `report.spec.ts` / `finance.spec.ts` tìm nút theo tên icon AntD (`delete`, `edit`, "In") | Đỏ ngay khi nút mang `aria-label` bản gốc | Spec viết trước khi nút có nhãn | Spec bấm "Hủy", "Chỉnh sửa", "Xem chi tiết", "In khoản thu" / "In chi phí"; helper `expectVoucherPreview` | F-17 |
| R-387 | `vite build` sập (stack trace) khi chạy song song `dotnet build`; `dotnet run --no-build` báo "Couldn't find a project to run" | Mất một vòng build, host không lên | Hai build cùng lúc tranh CPU/tệp; cwd của shell nhảy sang `BlueDental.FE` giữa các lệnh | Chạy tuần tự; luôn `dotnet run --no-build --project <đường dẫn csproj tuyệt đối>` — ghi để phiên sau khỏi lặp | — (thao tác) |

## 2026-09-22 (tối, 3) — Báo cáo: chủ dự án chốt các UNKNOWN còn lại

Chủ dự án trả lời từng mục: toast sau Duyệt và chữ hộp Hủy tab 4 "tự nghĩ",
in = window.print, hộp xoá danh mục thu/chi gửi kèm ảnh staging, công thức
6 ô "b nghĩ như nào", "Nạp vào dư nợ" chưa rõ. Spec chạy trên
`dist-preview4` :8080, API :5000 không đổi.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-388 | Hộp xoá danh mục thu/chi local tiêu đề "Xác nhận xoá danh mục"; ảnh staging (Danh mục thu nhập) là "Xác nhận xoá" + "Bạn có chắc muốn xoá danh mục **abc** không?" | Chữ khác bản gốc | Ba biến thể danh mục dùng chung một tiêu đề lấy từ bundle của sổ quỹ | `CashflowCategoryManager` truyền `title="Xác nhận xoá"` cho thu/chi, sổ quỹ giữ "Xác nhận xoá danh mục"; spec đọc tiêu đề bằng `.bd-modal-title` để phân biệt hai chuỗi lồng nhau | F-17 (`report.spec.ts` `deleteCategory(title)`, `finance.spec.ts`) |
| R-389 | Không có toast sau Duyệt chi | Người dùng không biết duyệt xong (chỉ thấy badge đổi) | Bản gốc chưa bắt được toast; chủ dự án chốt tự chọn | Toast "Duyệt chi phí thành công" trong `onSuccess` của `useApproveSalesEntry` (cùng khuôn "Tạo phiếu thu chi thành công") | F-17 (`report.spec.ts` + `finance.spec.ts` chờ toast) |
| R-390 | Hộp Hủy tab 4 hỏi chung "hủy giao dịch này", nút đỏ ghi "Xoá", toast "Đã xoá giao dịch" — trong khi bản gốc gọi hành động là Hủy | Chữ nút trái với tên hành động | `ConfirmDeleteDialog` không cho đổi nhãn nút xác nhận | Prop `confirmLabel?` (tuỳ chọn, mặc định "Xoá" — 27 nơi khác không đổi); `CashflowV2Overview`: ghi chú in đậm trong câu hỏi, nút "Hủy giao dịch", toast "Đã hủy giao dịch" (quyết định chủ dự án) | F-17 (`report.spec.ts` `deleteLedgerEntry`, `finance.spec.ts`) |

## 2026-09-22 (tối, 4) — Báo cáo: sub-tab Tạm ứng theo ảnh staging của chủ dự án

Chủ dự án gửi ảnh staging (chế độ Năm, chi nhánh A, `salesTab=prepaid`) —
lần đầu thấy dòng dữ liệu của sub-tab này (trước chỉ thấy trạng thái
rỗng). Host build lại, spec chạy trên `dist-preview5` :8080, API :5000.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-391 | Mã phiếu thu local lặp số phiếu ở phần "DT" (`THANHTOAN-27/DT27/2026`); ảnh staging: `THANHTOAN-31/DT32/2026` với DT32 = phiếu "Test DV" của HN8521 (khớp `patient-detail.md`), phiếu kế tiếp DT33 → `THANHTOAN-34/DT33/2026` | Mã in trên phiếu / báo cáo không trỏ đúng phiếu điều trị | Giả định cũ "hai nửa cùng một bộ đếm" (bản gốc trước đó chỉ thấy các mã trùng số) | `PatientPayment.FormatCode(kind, seq, year, planCode)` — phiếu thu bắt buộc có mã phiếu điều trị; `PatientPaymentAppService.GenerateCodeAsync` tra `TreatmentPlan.Code`; seeder truyền mã. Mã đã phát hành trong DB giữ nguyên (định danh đã in) | F-17 (`report.spec.ts` regex `THANHTOAN-\d+/DT\d+/\d{4}` trên file Excel Thanh toán) |
| R-392 | Cột Phiếu thanh toán tab Tạm ứng luôn "-" (giả định "tạm ứng không có phiếu"); staging ghi mã `THANHTOAN…` chữ xanh trên dòng "Tạm ứng phát sinh", các loại khác "-" | Không tra được phiếu từ sổ tạm ứng | Chưa từng thấy dòng dữ liệu | `GetPrepaidLinesAsync`: `PaymentCode = p.Code`; FE `.report-voucher-code` xanh; cột Bác sĩ điều trị "-" (staging = bác sĩ của phiếu điều trị; nạp tạm ứng local không có phiếu, trước hiện nhầm tên người thu) | F-17 (`report.spec.ts`: ô mã khớp `^(THANHTOAN\|TAMUNG)-\d{2,}/`) |
| R-393 | Thẻ tab Tạm ứng: nhãn "Tiêu tạm ứng theo tiến độ" / "Hoàn tiền", tông xanh lá / vàng / xanh dương / đen; số tiền tô theo loại sự kiện; Số dư sau đen. Staging: "Tiêu dùng tạm ứng" / "Hoàn tiền tạm ứng", tông xanh dương / vàng / đỏ / tím; số tiền `+…` xanh lá / `-…` đỏ theo dấu; Số dư sau xanh dương | Khác bản gốc về chữ và màu | Dựng từ trạng thái rỗng 2026-09-04 | `PrepaidSubTab`: 4 thẻ đổi nhãn + tông, `renderSignedAmount` theo dấu, Số dư sau `report-money--blue`, `EVENT_LABELS` có thêm "Chuyển tạm ứng sang dịch vụ mới" / "Xóa tạm ứng dịch vụ cũ (thay thế)" | F-17 (`report.spec.ts`: 4 nhãn thẻ, `+…` xanh, số dư xanh) |
| R-394 | "Số dư tạm ứng hiện tại" local = tổng nạp trong kỳ (luôn bằng pill); staging ô 10.070.000 ≠ pill 5.570.000 → ô là số đang giữ hiện tại | Ô thẻ vô nghĩa khi đổi kỳ | Chưa có dữ liệu để phân biệt | `GetSalesSummaryAsync`: `PrepaidBalance` = tổng tạm ứng mọi kỳ theo chi nhánh (ASSUMPTION công thức; local chưa có tiêu dùng / hoàn tạm ứng) | F-17 (`report.spec.ts` thẻ hiển thị; giá trị không khẳng định) |

Không dựng (ghi `unknowns.md`): sự kiện "Tiêu tạm ứng theo tiến độ" /
"Chuyển tạm ứng sang dịch vụ mới" / "Xóa tạm ứng dịch vụ cũ (thay thế)" —
tạm ứng bản gốc gắn phiếu điều trị và tiêu theo tiến độ, tạm ứng local là
tiền giữ hộ ngoài phiếu.

## 2026-09-22 — Phân quyền theo vai trò (BA feedback #3, F-40)

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-395 | User vai trò `dentist` với 0/378 quyền vẫn thấy đủ menu và mở được mọi màn hình | Phân quyền trên Cài đặt không có tác dụng gì ở giao diện | FE chưa bao giờ đọc `user.permissions`: `nav.ts` tĩnh, router không bọc, `/account/me` trả quyền về rồi bỏ đó | `routePermissions.ts` (route → quyền, "any of"), `useVisibleNav` ẩn mục/nhóm không có quyền, `PermissionRoute` + `ForbiddenResult` cho địa chỉ gõ tay; Tổng quan mở cho mọi người (quyết định chủ dự án) | F-40 (`role-permissions.spec.ts`: 1 nhóm menu, 403 Result, cấp `patient.read` → Phòng khám hiện đúng 1 mục) |
| R-396 | `GET role-permission/permission-tree` chỉ `[Authorize]` | Mọi tài khoản đăng nhập tải được toàn bộ cây quyền | Controller viết tay, không đi qua AppService có ability | `[Authorize(BlueDentalAbilityPermissions.RolePermission.Read)]` | `ControllerConventionTests.RolePermissionController_Should_Require_RolePermission_Read`; F-40 (dentist → 403 trước và sau khi cấp `patient.read`) |
| R-397 | `FileAttachmentAppService` không có ability nào | Ảnh X-quang / tài liệu đọc, tạo, xoá được bởi bất kỳ ai đăng nhập | Service viết trước khi có cây ability, chưa gắn subject | Gắn `treatmentImage.read/create/delete` (ASSUMPTION — `features/role-permissions.md`) | `FileAttachmentAppServiceContractTests.Methods_Should_Require_TreatmentImage_Ability` |
| R-398 | `NotificationAppService.MarkReadAsync` nhận id bất kỳ | Đoán id là đánh dấu đã đọc thông báo của người khác | Không so `RecipientUserId` với người gọi | Ném `AbpAuthorizationException` khi không phải người nhận | Review mã; chưa có spec runtime cho user bị chặn |
| R-399 | Danh sách Vận hành "tất cả khối" (không truyền `department`) không kiểm quyền | User không có quyền khối nào vẫn xem toàn bộ bài viết / công việc | `GetListAsync` / `QueryAsync` chỉ check khi có `department`; nhánh còn lại đi thẳng xuống query | Thu hẹp về các cặp khối+mục người gọi được đọc; không đọc được cặp nào → 403 thay vì trang rỗng | F-15 (`operations.spec.ts`, đường admin); chưa có spec runtime cho user bị chặn |
| R-400 | Nhân viên tạo qua dialog Nhân sự, sau khi vai trò được cấp `patient.read`, vào Bệnh nhân vẫn 403 `BlueDental:Organizations:0005` | Cấp quyền xong vẫn không dùng được — đúng ca của BA (user tạo bằng dialog) | Dialog chỉ ghi `StaffBranchAssignment`, không ghi extra property chi nhánh nhà → không có claim; `/account/me` trả `clinicId: null` → FE không gửi `X-Clinic-Branch-Id` → `GetRequiredClinicBranchId()` ném | `AccountAppService.GetCurrentUserAsync`: không có header lẫn claim thì lấy `Min()` của các chi nhánh được phân công (ASSUMPTION chi nhánh nhà = id nhỏ nhất) | F-40 (`assertRealApiTraffic` trên `/api/v1/app/patients` sau khi cấp quyền) |

Không sửa, chỉ ghi nhận: `routes.spec.ts` → `/timekeeping loads without error`
đỏ **trước và sau** thay đổi này, và đỏ cả trên build của phiên khác (cổng
8080): router đã cam kết không có route `/timekeeping` (chấm công nằm ở
`/calendar?tab=timekeeping`), dòng smoke đó đã cũ. Còn lại 25/26 xanh.

## 2026-09-22 — Phân quyền vòng 2: quyền hiện có phải có tác dụng thật (F-40)

Chủ dự án: "b đã handle các quyền hiện có chưa". Kiểm tra bằng tài khoản
`dentist` tạo qua dialog Nhân sự, phiên cookie thật, gọi thẳng API.

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-401 | `[Authorize(...)]` trên mọi `*AppService` **chưa từng** được thực thi: dentist 0/378 quyền gọi `GET /api/v1/app/dental-procedures`, `/patients`, `/operations/reports/work-log` đều 200 | Toàn bộ phân quyền phía server chỉ còn lại attribute trên controller; cây 378 quyền vô nghĩa với API | Host đăng ký assembly Application làm conventional (auto API) controllers **đồng thời** HttpApi có controller viết tay cho từng service → ABP coi mỗi service là controller, đưa vào `DynamicProxyIgnoreTypes`, Autofac không bọc proxy → không có `AuthorizationInterceptor` | Bỏ `ConventionalControllers.Create(...)` khỏi `BlueDentalHttpApiHostModule`; thêm `AccountController` (`api/v1/app/account`), `FileAttachmentController`, `InsurancePlanController`, `InsuranceClaimController`; 8 contract taxonomy không có màn hình nào gọi → `[RemoteService(IsEnabled = false)]` | `ApplicationServiceInterceptionTests` (service resolve ra phải là proxy có `AuthorizationInterceptor`), `HostModuleConfigurationTests` (không conventional controller; mọi contract bật đều có controller); F-40 (`role-permissions-abilities.spec.ts`: 403 khi chưa cấp) |
| R-402 | Cấp đủ lá Danh mục trên Phân quyền vẫn bị từ chối ở route cần `BlueDental.Catalogs.View` (và mọi policy module cũ khác) | Vai trò tự tạo không bao giờ dùng được các màn hình còn giữ tên quyền cũ | Hai hệ tên quyền song song: `BlueDentalPermissions.*` (seed cho 3 vai trò tĩnh) và lá `BlueDental.<subject>.<action>` (thứ duy nhất tab Phân quyền ghi) | `BlueDentalPermissionBridge` (tên cũ → "any of" các lá; `SystemAdministration.*` cố ý không bắc cầu — ASSUMPTION các cặp ghi trong file) + `AbilityBridgePermissionValueProvider` ("AB") | `PermissionBridgeTests`, `AbilityBridgePermissionValueProviderTests`; F-40 (`catalogService.read` → `dental-procedures` 200) |
| R-403 | Sau R-401, `GET /api/v1/app/clinic-branches/accessible` 403 cho dentist dù method chỉ `[Authorize]` | Popover chi nhánh trống với mọi user hạn chế | ABP **hợp** policy class-level và method-level (method `[Authorize]` trần không ghi đè `[Authorize(Organizations.Default)]` ở class) | `ClinicBranchAppService`: class chỉ `[Authorize]`, từng method tự nêu policy Organizations | `ControllerConventionTests.ClinicBranchController_Should_Expose_An_Accessible_Route`; F-40 (accessible 200, danh sách quản trị 403) |
| R-404 | `/api/app/account/current-user` 404 sau khi bỏ conventional controllers | Không đăng nhập được | Route đó do auto API sinh ra | `AccountController` tại `api/v1/app/account/current-user` + `change-password`; `features/auth/api` trỏ theo | `login.spec.ts`, `auth`, mọi spec đăng nhập |
| R-405 | `GET /api/v1/app/insurance-claims` 500 với admin: `42703: column b.BranchId does not exist` | Chưa màn hình nào gọi; lộ ra vì giờ mới có route | Commit `72194d7` thêm `BranchId` vào entity và snapshot nhưng **không sinh migration** → bảng thiếu cột | Migration viết tay `20260922100000_AddInsuranceClaimBranchId` (cột + backfill từ `bd_invoices.BranchId` + index), đã chạy DbMigrator | F-40 (`role-permissions-abilities.spec.ts`: admin GET claims 200) |
| R-406 | `tsc --noEmit` đỏ ở `ReceptionPage.tsx:164` (`setViewMode` không nhận `"year"`) | Build type-check toàn dự án không sạch | `ReceptionToolbar` khai `ViewMode = DateNavigatorMode` (có `year`) trong khi Segmented chỉ có Ngày/Tuần/Tháng | `ViewMode = Exclude<DateNavigatorMode, "year">` ở toolbar; không đổi hành vi | `tsc --noEmit` sạch |

Đã làm thêm trong vòng này (Phase 2 hoãn từ vòng 1): `src/hooks/useAbility.ts`
gate nút trên Bệnh nhân ("Tạo hồ sơ" ← `patient.create`, "Xuất file" ←
`patient.export`), Nhân sự, Thanh toán, Lịch hẹn; popover chi nhánh đọc
`clinic-branches/accessible`. Phase 4 (seed mặc định) vẫn hoãn theo quyết
định D. Host.Tests 19/19, Application.Tests 588/588, Domain.Tests 310/310.


Hồi quy vòng 2 (preview 8082, host 5000, sau khi bật thực thi `[Authorize]`):
`role-permissions*`, `header-navigation`, `routes`, `branch-*`, `taxonomy*`,
`payment-qr`, `login`, `auth` — **69 xanh / 4 đỏ**, cả 4 đều là lỗi cũ đã ghi:
`routes` "/timekeeping" (route không tồn tại), `taxonomy-dialogs` :152 và :207
(option Tên thuốc ngoài viewport, cặn e2e), `taxonomy` :277 (document không
cuộn từ shell v2). Không có màn hình nào của admin bị 403 mới.
---

## 2026-09-09 — Cột tiền của phiếu điều trị bị trừ giảm giá hai lần

Chủ dự án hỏi vì sao thẻ tóm tắt, bảng phiếu và "Xem tất cả dịch vụ" hiện dữ
liệu khác nhau; trả lời xong thì thấy hàng DT05 không cân: một dịch vụ đơn giá
`2.500.000`, thành tiền `2.400.000`, mà hàng in `Tổng phiếu 1.580.000 / Giảm giá
920.000 / Thành tiền 660.000`.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-343 | `Thành tiền` của hàng phiếu trừ giảm giá **hai lần**, và `Tổng phiếu` in số đã trừ chứ không phải số gộp | `payment.totalPrice` mà API trả **đã** net cả chiết khấu dòng lẫn chiết khấu phiếu (`TreatmentPlan.TotalAmount = ServicesTotal − PlanDiscountAmount`), còn `payment.discount` là **tổng hai tầng** — nên `totalPrice − discount` trừ lần nữa. `planMoney()` đổi thành `total = totalPrice + discount` (gộp) và `amount = totalPrice`; đẳng thức `Tổng phiếu − Giảm giá = Thành tiền` nay đúng theo cấu trúc, không còn tự định nghĩa vòng quanh. Tờ in "Chi tiết phiếu" (`receiptView.receiptOf`) cũng lấy số gộp cho dòng `Tổng phí` vì ngay dưới nó là `Giảm giá` |
| R-344 | `Giảm giá` của rollup cộng cả chiết khấu của **dòng đã huỷ** | `PatientMoneyCalculator` cộng `plan.Services.Sum(s => s.DiscountAmount)` trên **mọi** dòng, trong khi `ServicesTotal` chỉ tính dòng còn sống — dòng huỷ chưa từng bị thu tiền thì cũng không được giảm giá. Thêm `TreatmentPlan.ServicesDiscountAmount` (chỉ `CountedServices`) và dùng nó ở cả `ForPlan` lẫn `ForPatient` |

Chỗ **không** đụng, vì không có dòng `Giảm giá` bên cạnh nên không cộng dồn sai:
`PatientAccountPanel` (`Tổng phiếu` = số còn phải thu), `PlanDetailHead` và
`slipView` (`Doanh thu dự kiến` / `Tổng phí` = `totalAmount`), `PatientProfileTab`
(`Tổng dự kiến thu`).

Mức retest: **2** — Kế hoạch điều trị (F-21) và Chi tiết kế hoạch (F-39).

Kết quả — BE thật (`:5019`, build lại sau khi sửa), PostgreSQL thật, không mock:

- Domain **312** / Application **556** xanh. Hai test mới trong
  `TreatmentPlanSlipTests`: rollup cộng lại ra đúng số gộp `2.500.000`, và dòng
  huỷ không giảm giá gì. Test thứ hai **đã đối chứng**: hoàn nguyên bản sửa BE
  thì đỏ.
- `e2e/treatment-plan.spec.ts` **6/6** trên **cả** bản build production
  (`vite preview` :8080) **và** dev server :5173. Spec mới
  *"a discounted slip prints the gross, the discount and what is owed"* tự đặt
  đơn giá `2.500.000` + giảm `100.000 VNĐ` rồi đối chiếu ba ô tiền của hàng với
  hai ô của chính dòng dịch vụ trong modal. **Đã đối chứng**: hoàn nguyên
  `planMoney` thì ô `Tổng phiếu` trả về `2.400.000` và spec đỏ.
- `treatment-plan-detail` **4/5**, `treatment-stage` **2/2**. Một đỏ là
  `under 640px…` (chiều cao ô `Nội dung` trong dialog Hoàn tiền, dòng 374) —
  **có sẵn từ trước**, chứng minh bằng `git stash` toàn bộ thay đổi rồi build
  lại và chạy: đỏ y hệt cùng dòng.
- `tsc --noEmit` sạch.


## 2026-09-09 — Tooltip hàng phiếu, modal "In bệnh án", và nhãn ô của modal Hóa đơn

Ba việc chủ dự án chỉ ra trên tab **Kế hoạch điều trị**. Khảo sát bản gốc trên
`staging.nfcdental.com` — **chỉ đọc**: mở modal, đổi file, bấm zoom, đọc
`getComputedStyle`. Không bấm nút in, không lưu, không gửi POST/PUT/DELETE nào.
Ảnh chụp và bản bắt `clinic-files` để trong `reference-private/` (rule 01).

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-345 | Hai nút cột **Thao tác** (và nút mắt) hover không hiện tooltip | Bản gốc bọc cả ba bằng `tooltip-trigger`: `In bệnh án` · `Hóa đơn` · `Danh sách dịch vụ`. Nút `+` thì **không** có — giữ nguyên. Thêm tooltip ở cả bảng (`planColumns`) lẫn thẻ ≤640px (`PlanCardList`) |
| R-346 | **Tooltip nuốt phím `Esc`.** Bọc bằng `<Tooltip>` trần làm hỏng một hành vi đang chạy: hover nút mắt → bấm → tooltip vẫn mở đè lên mask, `Esc` đầu tiên đóng **tooltip** chứ không đóng dialog, người dùng phải bấm hai lần | `ActionTooltip`: `open` do component giữ, `onPointerDownCapture` đóng tooltip **trước** click của nút và **giữ khoá** (con trỏ vẫn nằm trên trigger nên rc-trigger sẽ xin mở lại ngay), khoá nhả khi con trỏ rời. Đây là lỗi **do đợt này gây ra** — chứng minh bằng cách gỡ riêng tooltip nút mắt thì spec xanh lại, và đo trực tiếp: trước `Esc` DOM có `.ant-tooltip` với `hidden=false`; sau khi vá thì không còn tooltip nào |
| R-347 | Nút **In bệnh án** không có hành vi (comment cũ: "để dành đợt sau") | `PrintMedicalRecordDialog` dựng theo bản gốc: chọn file (chín biểu mẫu, mở sẵn **Bìa hồ sơ bệnh án**), dòng nhắc "ô nền vàng vẫn có thể chỉnh trước khi in", zoom **40–120% bước 5%**, **`Fit` = reset về 85%** (đo ở ba bề rộng khung, không phải fit-width), khung xem trước xám `#F5F5F5` bo 16 viền `#E0E0E0`, chân `Đóng` / `🖨 In bệnh án`. Modal theo **bệnh nhân**, không theo phiếu — bản gốc mở ra cũng chỉ gọi `clinic-files` + đọc lại bệnh nhân. Dùng lại `MedicalRecordSheetView` của tab Bệnh án; sửa trong modal **không lưu**, đúng như bản gốc nói |
| R-348 | Modal **Hóa đơn** để nhãn tĩnh phía trên ô, lệch với mọi form khác trong source | `FloatingLabel` cho cả 13 ô (không phải `FloatingField` — modal này không nằm trong `Form`), `floated` theo ô có giá trị hay không. Kèm ba số đo lại từ bản gốc: gap hai cột 32→**20px**, tiêu đề mục 15/600→**16/700**, và `Mẫu` chuyển kính lúp từ `suffixIcon` sang **`prefix`** (bản gốc để bên trái, chevron vẫn bên phải) |

Hai chỗ tiện tay sửa vì đợt này làm lộ:

- **Zoom của tờ xem trước.** Ba trong bốn kiểu tờ (`cover`, `consultation`,
  `free`) đặt `width: PAGE_WIDTH * zoom + 34` và biến `--sheet-zoom`, nhưng chỉ
  `.pd-a4-free-page` thực sự dùng biến đó — nên ở zoom ≠ 1 tờ bìa bị **cắt cụt**
  chứ không thu nhỏ (ở tab Bệnh án zoom mặc định là 1 nên chưa ai thấy). Modal in
  không dùng `zoom` của tờ nữa: truyền `zoom={1}` và tự thu bằng CSS `zoom` ở
  `.pmr-scale` — `zoom` co cả hộp layout nên khung cuộn đo đúng cỡ tờ đang vẽ.
- **Giới tính trên tờ bìa.** Bản gốc tick sẵn Nam/Nữ từ hồ sơ
  (`cover.patient.gender-male` / `-female`); ta để trống. `tick()` của
  `MedicalRecordCoverSheet` nhận thêm `seed`, cùng luật với `cell()`: ô chưa ai
  đụng thì lấy hồ sơ, ô đã bấm thì giữ nguyên — kể cả khi bấm cho **bỏ** tick.

Mức retest: **2** cho F-21, **3** cho `MedicalRecordCoverSheet` (dùng chung với
tab Bệnh án).

Kết quả — BE thật (`:5019`), PostgreSQL thật, đăng nhập thật, không chặn API:

- `e2e/treatment-plan.spec.ts` **6/6** trên **cả** build production
  (`vite preview` :8080) **và** dev :5173. Spec cũ mở rộng: modal In bệnh án mở
  ở 85% với mã bệnh nhân đã điền, `+` → 90%, `Fit` → 85%, đổi sang *Bệnh án
  ngoại trú* thì tờ vẽ lại; và modal Hóa đơn phải có đúng 13 `.inv-field`
  floating, ô đã có giá trị thì `--floated`, ô rỗng thì không.
- `e2e/patient-medical-record.spec.ts` **7/7** (bao gồm spec tờ bìa) trên build
  production — đây là bộ bảo vệ chỗ sửa `MedicalRecordCoverSheet`.
- `tsc --noEmit` sạch; eslint sạch trên các file đã đụng.
- `treatment-plan-detail` còn **1 đỏ** (`under 640px…`, chiều cao ô `Nội dung`
  của dialog Hoàn tiền) — **có sẵn từ trước**, chứng minh bằng `git stash` toàn
  bộ thay đổi của đợt này, build lại rồi chạy: đỏ y hệt cùng dòng.

Còn treo (`unknowns.md`): bản gốc điền danh tính bệnh nhân cho **tám trên chín**
biểu mẫu; BlueDental mới điền cho tờ bìa. Tờ *Bệnh án ngoại trú* nằm trong
`features/taxonomy/` (mục 17 CLAUDE.md — sửa phải chạy lại 38 spec Danh mục),
nên tách thành việc riêng thay vì kèm vào đợt này.

## 2026-09-09 — Bệnh án: dựng chín tờ A4 từ chính bản in

Chủ dự án yêu cầu tab Bệnh án phải **giống 100%** bản gốc, cả chữ, bố cục lẫn ô
nhập. Khảo sát chỉ đọc trên staging (mở tab, đổi tờ, bấm zoom, đọc computed
style và **bundle tĩnh** — rule 00 cho phép). Không bấm In, không tick "có tem",
không chọn bác sĩ, không ghi gì lên bản gốc.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-349 | **Chín biểu mẫu không thể vẽ bằng component.** BlueDental vẽ tay ba tờ (Bìa, Ngoại trú, Tư vấn) và cho sáu tờ còn lại một trang kẻ dòng trống. Đo bản gốc: chín tờ là **801 ô nhập, 155 ô tick, 17 trang A4** | Chuyển sang đúng kiến trúc bản gốc: mỗi biểu mẫu là **một tài liệu HTML** với ô `data-medical-record-field`, render trong `<iframe srcdoc>` cùng bộ style của chính nó. Một đường code cho cả chín tờ: `medical-record/templates/*.ts` (chín bản trắng), `sheetCss.ts` (bộ style đo nguyên văn), `renderSheet.ts` (điền ô + token qua DOM, không qua chuỗi), `MedicalRecordDocument.tsx` (khung + bắt sự kiện sửa). Ba component vẽ tay và `coverSheetRows.ts` bị gỡ |
| R-350 | Ô nhập bị **đóng băng dữ liệu hồ sơ**: lượt lưu đầu ghi cả 56 ô của tờ Bìa, kể cả những ô do hồ sơ điền | Chỉ lưu ô **khác** với câu trả lời của hồ sơ. Đối chứng chạy thật: bỏ tick "Nữ" → khoá `cover.patient.gender-female` xuất hiện trong `fieldValues`; tick lại → khoá **biến mất**. Nhờ vậy sửa hồ sơ bệnh nhân sau này vẫn hiện lên phiếu |
| R-351 | Ô tick trong tờ lưu thành `""` chứ không phải `true`/`false` | `instanceof HTMLInputElement` **luôn sai** ở đây: tờ là một tài liệu riêng, có bản sao lớp DOM của chính nó, nên checkbox trong iframe không phải instance của lớp bên ngoài. Đọc bằng `tagName` |
| R-352 | Tờ dựng ra **trắng** dù đã lưu | Tài liệu được dựng trong `useMemo` ở lần render đầu, còn giá trị đã lưu lại được nạp bằng `useEffect` — chậm một nhịp, mà memo thì không dựng lại (dựng lại khi đang gõ sẽ mất con trỏ). Bỏ effect: bản nháp giữ theo từng phiếu (`edits[sheetId]`) và giá trị hiển thị tính ngay trong render |
| R-353 | Tên phiếu trong mục lục **cắt giữa chữ** ("Bệnh án chỉnh nh\|a") | Ba nút hành động nằm trong luồng flex nên cột chữ chỉ còn **121px**. Bản gốc đặt chúng **tuyệt đối** ở giữa cạnh phải, chừa `padding-right` 40px cho tên và 84px cho hàng meta |
| R-354 | Thanh dưới có nút **"Xoá phiếu"** mà bản gốc không có, và thiếu **"Đồng bộ phiếu"** | Bỏ "Xoá phiếu" (xoá nằm ở icon thùng rác trên thẻ, đúng như bản gốc), thêm "Đồng bộ phiếu" — luôn disabled, vì đọc bundle thấy bản gốc cũng **chưa nối handler** cho nó |
| R-355 | Thiếu ô chọn **"Bác sĩ"** ở đầu khung xem trước; zoom sai dải | Thêm ô chọn (chưa nối — `unknowns.md`); zoom đổi từ 50–200% bước 10 sang **60–140% bước 10**, đúng số đo |
| R-356 | "In biểu mẫu" chỉ có một dạng | Ở `Toàn bộ` bản gốc đổi nó thành **popover "Chọn phiếu in"**: dòng nhắc, ô "Tất cả phiếu" có trạng thái indeterminate, danh sách phiếu kèm pill `Bản NN`, nút `In` primary. Dựng lại đúng vậy |
| R-357 | Phiếu mở mặc định là phiếu **API trả về đầu tiên**, không phải thẻ đầu mục lục | Sắp phiếu theo thứ tự mục lục (biểu mẫu, rồi ngày tạo) để hai bên khớp nhau — nếu không, tải lại trang có thể mở nhầm tờ |
| R-358 | "Phiếu Tư Vấn Tổng Quát" bị khoá nút Lưu (`fillable: false`) | Tờ đó có **23 ô nhập** trên bản in thật; cờ `fillable` là kết luận sai từ bản vẽ tay cũ. Cả chín tờ nay đều ghi được. Bỏ luôn `kind` — nó dùng để chọn component vẽ, mà không còn component nào để chọn |

Mức retest: **2** cho Bệnh án, **3** cho `medicalRecordDraft` (dùng chung với
modal "In bệnh án" ở Kế hoạch điều trị).

Kết quả — BE thật (`:5019`), PostgreSQL thật, đăng nhập thật, không chặn API:

- `e2e/patient-medical-record.spec.ts` viết lại cho kiến trúc mới (đọc vào
  `frameLocator` của tờ): **7/7** trên **cả** build production (`vite preview`
  :8080) **và** dev :5173. Trong đó có spec đếm đúng **ô nhập / ô tick / số
  trang của cả chín tờ** (56/20/3 … 118/2/1), spec ghi–lưu–tải lại, và spec
  chứng minh ô trùng với hồ sơ thì không bị lưu đè.
- `e2e/treatment-plan.spec.ts` **6/6** trên build production sau khi sửa spec
  modal in trỏ vào tài liệu của tờ.
- `tsc --noEmit` sạch, eslint sạch trên các file đã đụng.

Còn treo, đã ghi `unknowns.md`: ô chọn **Bác sĩ** (chưa biết nó điền ô nào),
ô tick **"có tem"** và nút **"Đồng bộ phiếu"** (bản gốc cũng chưa nối), và chế
độ **"Toàn bộ"** (mới dựng, chưa đối chiếu ảnh chụp bản gốc). Bản in ra giấy
mới có CSS `@media print`, **chưa đối chiếu** với bản in của bản gốc.

Dữ liệu cũ: phiếu lưu trước đợt này dùng bộ tên ô khác (`nextOfKin`,
`illnessHistory`, …) — không phải ô nào trên chín bản in, nên bị bỏ lại thay vì
đổ vào ô không đúng nghĩa.

## 2026-09-09 (chiều) — Bệnh án: hình vẽ, sửa dòng, và bản in

Năm chỗ chủ dự án chỉ ra trên các tờ, cộng phần in. Khảo sát bản gốc bằng
**asset tĩnh** (bundle JS + hai ảnh của biểu mẫu) và **ảnh chụp** — rule 00 cho
phép. Xem thêm mục sự cố ở `unknowns.md`: một cú bấm sai selector đã tạo một
phiếu trên staging.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-359 | **Bệnh án 2, mục IV-3 thiếu hình.** Template trỏ `/medical-record-templates/outpatient-dental-{diagram,legend}.png` — đường dẫn của bản gốc, ta không có file | Tải hai ảnh về `BlueDental.FE/public/medical-record-templates/`, giữ nguyên đường dẫn trong template. Tờ nằm trong `srcdoc` nhưng `baseURI` thừa hưởng từ trang cha nên đường dẫn tuyệt đối vẫn phân giải đúng; đo lại `naturalWidth` 1094×244 và 171×80 |
| R-360 | **Bệnh án 8 "Số ngoại trú" bám mã bệnh nhân.** Số ngoại trú là số chạy của phòng khám, không phải mã hồ sơ | Bản gốc **bỏ `data-field-source="patient.code"`** khỏi các span `treatment-tracking.page-N.patient.code` khi render (đọc được trong bundle). Làm y hệt, ở bước điền — bỏ nguồn chứ không bỏ ô, nên vẫn còn chỗ để viết |
| R-361 | **Bệnh án 5 thiếu nút `+` khi hover** để thêm dòng ở "IV - Chi phí điều trị" | Dựng `rowEditing.ts` + `rowHandles.ts` theo đúng bundle: nút tròn 20px, `+` xanh `#16a34a` đặt ở `right+4`, `−` đỏ `#dc2626` đặt ở `right-10`, cả hai `position:fixed` trong tài liệu của tờ. Thêm dòng = nhân bản dòng dưới con trỏ, đánh số lại quá dòng cao nhất, bỏ `data-field-source`, xoá nội dung, đánh dấu `data-medical-record-generated-row`. Bảng chi phí nhận ra qua `consultation.text.21…44` (8 dòng in sẵn, 3 ô một dòng) nên dòng thêm là `consultation.treatment-cost.row-9.{serial,service,amount}` |
| R-362 | **Bệnh án 8 và 9 thiếu cả `+` và `−`** — kể cả cụm MS / tờ điều trị số / số ngoại trú | Bundle cho biết `−` chỉ có ở `file-7` và `file-9`, `+` có ở `file-4`/`file-7`/`file-9`, và **cả hai chỉ dành cho quản trị phòng khám**. Đưa vào `medicalRecordForms` thành `canAddRows`/`canDeleteRows`, gác bằng role `admin`. Xoá dòng = bỏ `<tr>` và để lại một ô ẩn `custom.deleted-table-row.<hash>` — hash 32-bit của id ô đầu dòng, đúng thuật toán bản gốc — nên ghi chú sống lâu hơn chính cái dòng nó nói về |
| R-363 | Dòng thêm/xoá **không sống qua lần lưu** | `applyStoredRows` dựng lại hình dạng đã lưu trước khi điền ô: mọc thêm dòng cho mọi `row-N` có trong dữ liệu, rồi bỏ những dòng có ghi chú xoá. Và `collect` **luôn** lưu ô của dòng do người dùng thêm, kể cả khi rỗng — ở đó sự rỗng chính là thông tin, nó là thứ nói rằng dòng đó tồn tại |
| R-364 | **Viền thẻ phiếu đang mở luôn xanh**, kể cả trong biểu mẫu màu cam | Ăn màu của biểu mẫu: viền, nền, chip icon (đặc + chữ trắng) và pill `Bản NN` đều lấy `--form-accent`. Kèm một lỗi thứ tự CSS: `:hover` khai sau `--active` nên hover vào thẻ đang mở làm viền nhạt đi — thêm `.pd-sheet-card--active:hover` |
| R-365 | **Bản in bệnh án ra giấy trắng.** Class `pd-printing` mang hợp đồng cũ *"ẩn mọi con của body trừ `.pd-print-sheet`"* của ba dialog in trước đây — nó ẩn luôn cả tờ bệnh án | Tách class riêng `mr-printing`. Không thể portal bản sao: tờ là iframe, chuyển chỗ là nó tải lại và mất chữ vừa gõ. Cũng không thể chỉ `visibility:hidden`: hộp vô hình vẫn chiếm giấy, đo được tờ bắt đầu ở **y=946px** — in ra một trang trắng trước. `printing.ts` đi từ body xuống, gỡ khỏi layout mọi nhánh **không** chứa `.mr-doc` (nên chế độ"Toàn bộ" giữ đủ các tờ), và trả lại nguyên trạng ở `afterprint`. Đo lại: tờ nằm ở **(1, 1)** đúng cỡ 834×2693 |

Mức retest: **2** cho Bệnh án, **3** cho đường in (dùng chung với modal
"In bệnh án" ở Kế hoạch điều trị).

Kết quả — BE thật (`:5019`), PostgreSQL thật, đăng nhập thật, không chặn API:

- `patient-medical-record.spec.ts` **12/12** và `treatment-plan.spec.ts` **6/6**
  trên bản build production (`vite preview` :8080); bộ bệnh án cũng **12/12**
  trên dev :5173. Năm spec mới: hai hình của tờ ngoại trú thật sự tải được
  (`naturalWidth > 0`), số ngoại trú rỗng và không còn `data-field-source`,
  thêm một dòng chi phí rồi tải lại vẫn còn, xoá một dòng của phiếu chăm sóc
  thì mất hẳn, và viền thẻ đang mở trùng màu nút "Thêm" của biểu mẫu.
- Vòng đời sửa dòng đo trực tiếp trên máy: hover ra `−` ở `right-10` và `+` ở
  `right+4`; `+` cho 28→29 dòng, id mới `…row-27.*`, lưu ra đúng **4** khoá;
  tải lại dựng lại dòng; `−` cho 29→28 và để lại đúng một ghi chú
  `custom.deleted-table-row.nbbbnz`.
- `tsc --noEmit` sạch, eslint sạch trên các file đã đụng.

Còn treo: ô chọn **Bác sĩ** vẫn chưa nối (chưa đo được nó điền ô nào), tick
**"có tem"** và **"Đồng bộ phiếu"** vẫn chỉ sống trong phiên (bản gốc cũng chưa
nối), và chế độ **"Toàn bộ"** chưa đối chiếu ảnh chụp bản gốc.

## 2026-09-09 (chiều muộn) — Bệnh án: tên bị cắt, và responsive

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-366 | **Tên phiếu bị cắt giữa chữ** ("Bệnh án ngoại trú Răng Hà…") dù đã có `-webkit-line-clamp: 2` | Thẻ nằm trong `<button>`, và `white-space: nowrap` của button **thừa hưởng** xuống khối chữ — nên tên chỉ có **một** dòng để clamp, phần còn lại bị `overflow: hidden` cắt. Đo được `scrollHeight` = 20px = một dòng. Đặt `white-space: normal` cho khối chữ, và `nowrap` cho pill + ngày (chúng xuống dòng theo cụm, không ngắt giữa) |
| R-367 | **Responsive dưới breakpoint sai**: mục lục vẫn mở và bị cắt ngang thẻ, thẻ thấp và bị kéo ngang, thanh dưới lệch | Dựng theo đúng số đo bản gốc: breakpoint **1024px**; dưới nó bỏ hẳn `height: calc(100dvh − 180px)` + `overflow: hidden` (đây là thứ bóp thẻ và tờ thành một dải thấp), gập một cột, mục lục **tự thu về thanh tiêu đề**, khung tờ cao tự nhiên và trang cuộn |
| R-368 | Thanh dưới canh bằng `left: calc(50% + 168px)` — một con số chặn cứng, lệch khi mục lục thu | Dựng lại cấu trúc của bản gốc: một khối bọc trong suốt `pointer-events: none` trải hết cột tờ, thanh trắng canh giữa trong đó, `flex-wrap` để tự xuống hai hàng khi hẹp; `absolute` trong cột tờ ở desktop, `fixed inset 12px` khi gập. Đo lại: tâm thanh **961** = tâm cột tờ **961** |
| R-369 | **Dòng "THUỘC" của letterhead trống** ở lần vẽ đầu | Tờ được dựng một lần theo `documentKey`, còn tên chi nhánh là một request riêng và về **sau** đó. Thêm tên chi nhánh vào `documentKey` — nó chỉ đổi trước khi ai kịp gõ, nên không có nguy cơ mất con trỏ |

| R-370 | **Mục lục và khung tờ vẫn thấp** ở khổ hẹp dù đã gập cột đúng | Thứ chặn nằm **ngoài** CSS của tab: vỏ trang `.pd-page` tự khoá mình ở chiều cao cửa sổ (`height: 520px; overflow: hidden` ở khổ 768×604), và `flex: 1` của lưới bên trong bị thuật toán flex co theo — nên `height: auto` khai ở lưới không có tác dụng. Đo được mục lục **148px** / khung tờ **181px**. Dưới breakpoint nhấc chính cái chặn đó bằng `.pd-page:has(.pd-medical)`, và đổi `flex` của lưới + khung tờ sang `0 0 auto`. Đo lại cùng khổ: khung tờ **2856px**, mục lục mở **1561px**, trang cuộn, app không trượt ngang. Khoảng chừa 132px cho thanh dưới chuyển từ khung tờ sang **đáy cả vùng**, vì khi gập một cột thì mục lục có thể là thứ cuộn tới cuối |

Kết quả: `patient-medical-record.spec.ts` **14/14** trên bản build production
:8080 (và 14/14 trên dev :5173), `treatment-plan.spec.ts` **6/6**. Hai spec mới:
không tờ nào bị cắt tên (`scrollHeight`/`scrollWidth` không vượt hộp), và hợp
đồng gập cột — 1440px: hai cột `320px …`, mục lục mở, thanh `absolute` canh giữa
cột tờ; 900px: một cột, mục lục thu, thanh `fixed`; 640px: chỉ khung tờ trượt
ngang, cả app thì không.

## 2026-09-09 (tối) — Bệnh án: ô ngày của từng mẫu, và chỗ cuộn khi hẹp

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-371 | **Thiếu ô ngày** ở các mẫu 4, 5, 6, 8, 9 | Đọc bảng cấu hình trong bundle bản gốc: bốn mẫu khai trực tiếp (`file-8`, `file-4`, `file-5`, `file-9`) cộng `file-7` bật qua cờ riêng — ra đúng năm mẫu anh chỉ. Nhãn cũng theo bản gốc: **"Ngày tư vấn"** riêng cho mẫu 5, còn lại "Ngày thực hiện". Hai mẫu có ô in ngày (`dateFieldKeys`), ba mẫu không |
| R-372 | Chọn ngày mà **ô in trên tờ chưa đổi** cho tới khi tải lại | Tài liệu chỉ dựng lại theo `documentKey`, nên một giá trị ghi từ bên ngoài không tới được nó. Thêm một đường ghi vào **tài liệu đang mở**: bỏ qua ô đang có con trỏ và bỏ qua ô đã trùng giá trị, nên không bao giờ tranh với người đang gõ |
| R-373 | **Cuộn khi hẹp sai kiểu**: lần trước tôi cho mọi thứ cao tự nhiên và chỉ để trang cuộn | Bản gốc cho cột tờ scroller riêng ở **mọi** bề rộng: `h-[calc(100dvh-180px)] min-h-[560px] overflow-y-auto pb-20`. Sàn 560px là thứ quan trọng trên cửa sổ thấp — 100dvh−180px chỉ còn ~400px trên màn 600px. Đo lại ở 768×604: cột 560px, cuộn nội dung của nó, tờ bên trong 2800px, app không trượt ngang |

Ba chỗ sửa trong chính bộ test, vì suite đã tự làm bẩn dữ liệu dev:

- `openFreshSheet` trước đây **thêm** một phiếu mỗi lần gọi. Sau vài lượt chạy,
  mục lục có hàng chục bản (dọn ra **122** bản rác, giữ 22) và assert số tuyệt
  đối bắt đầu đỏ. Nay nó **xoá trắng bản đầu của mẫu** thay vì thêm bản mới, và
  khoá theo **số hiệu mẫu** chứ không theo tên (phiếu đổi tên được).
- Phát hiện một hành vi API đáng ghi: `PUT { content: null }` nghĩa là **"đừng
  đổi"**, không phải "xoá" — `if (input.Content is not null)` ở app service,
  đúng thứ cho phép lệnh đổi tên chỉ gửi `title`. Muốn xoá trắng phải gửi giá
  trị rỗng tường minh (`{"fieldValues":{}}`).
- Spec đếm ô của cả chín mẫu nay xoá trắng từng mẫu trước khi đếm, nên một dòng
  do spec khác thêm vào và lưu không còn làm sai số đếm; kèm `test.slow()`.

Kết quả: `patient-medical-record.spec.ts` **16/16** trên **cả** bản build
production :8080 và dev :5173; `treatment-plan.spec.ts` **6/6**. Hai spec mới:
năm mẫu có ô ngày với đúng nhãn (bốn mẫu còn lại không có), và chọn ngày thì in
ngay lên tờ rồi sống qua lần tải lại.

## 2026-09-09 (khuya) — Bệnh án: đầu phiếu dính, mục lục có scroller, khe ô tích

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-374 | **Đầu khung tờ cuộn theo tờ**: `Bản NN`, tên phiếu và ô ngày trôi mất khi cuộn A4 | Đọc bản gốc (chỉ đọc layout, không bấm): đầu thẻ của nó là `header.sticky.z-10` cao 65px, nền trắng, bóng `0 8px 16px -14px rgba(27,42,65,.45)`, và **vùng cuộn là cả cột** (`clientH 720 / scrollH 4146`). Thanh dưới neo vào một lớp `relative` **bọc ngoài** vùng cuộn — nếu để trong, hộp `absolute` sẽ neo vào padding box của scroller và trôi theo giấy. Dựng lại đúng ba lớp: `.pd-medical-canvas` (neo thanh, không cuộn) › `.pd-medical-canvas-scroll` (cuộn) › `.pd-medical-canvas-head` (sticky) + `.pd-medical-paper` (cao theo tờ, giữ cuộn ngang của riêng nó) |
| R-375 | **Mục lục không có scroller riêng khi hẹp** — mở ra là phải cuộn cả app qua nó | Chặn panel vào một khung `calc(100dvh − 180px)` sàn 560px, `overflow: hidden`; thứ cuộn bên trong là `.pd-medical-forms` (vốn đã là scroller), nên thanh tiêu đề đứng yên. Đây là chỗ **thêm** so với bản gốc: dưới breakpoint bản gốc ẩn hẳn danh sách (`display: none`, panel còn 70px) nên không gặp ca này, còn ta cho mở lại. Bản thu gọn phải nhả cả `min-height`, không thì panel giữ 560px trống |
| R-376 | **Ô tích dính ba nút chức năng** khi mục lục rộng ra | Đo bản gốc: thẻ **268×93** (113 khi tên hai dòng), ô tích 16px ở `top/right: 10`, hàng nút **82×26** ở `right: 8` canh giữa → khe **7,5px**. Thẻ của ta chỉ ~65px khi mục lục rộng — vì lúc đó dòng meta gộp lại **một** hàng — nên hàng nút canh giữa dạt lên ngang ô tích. Đặt sàn `min-height: 93px` cho thẻ (đúng chiều cao bản gốc, không phải số tự nghĩ) và `line-height: 16.5px` cho dòng meta như bản gốc: thẻ ra đúng **93 / 113px**, meta **41px**. Nút cũng cố định **26×26** cho khớp |

Hai chỗ lệch còn lại, đã đo và cố ý giữ:

- Ô tích của ta là AntD 6 — hộp **20px**, bản gốc 16px. Giữ cỡ tích chung của
  app và đặt **tâm** trùng tâm bản gốc (`top/right: 6px` + 2px viền thẻ), nên
  khe còn **5,5px** thay vì 7,5px.
- Khoảng chừa đáy vùng khi hẹp giảm **132px → 24px**. Cột tờ giờ là hộp có
  chặn và kết thúc bằng 76px trống của giấy, nên chỗ thanh dưới che vốn đã
  rỗng; giữ 132px chỉ làm trang cuộn đủ xa để đẩy đầu phiếu dính ra khỏi mép
  trên cửa sổ (đo được −120px, nay −12px).

Đo lại ở 768×604: mục lục **560px** với danh sách cuộn trong nó (client 454 /
scroll 1648, tiêu đề đứng yên), cột tờ **560px** với scroller riêng (client 558
/ scroll 2870), đầu phiếu `sticky` đứng yên khi tờ chạy 1200px, giấy trượt ngang
(789 > 712) mà app thì không, thẻ **93px**. Vùng cuộn thật của app là
`main.app-content` (client 542 / scroll 1455), không phải `documentElement`.

Đường in kiểm lại bằng script riêng (media `print` + đúng bước cô lập của app):
tờ bìa bắt đầu ở **y=18**, `zoom: 1`, **7** nhánh ngoài tờ bị gỡ khỏi layout
(có cả `pd-medical-canvas-head`), scroller mới được `@media print` trung hoà về
`height: auto; overflow: visible` — thiếu dòng đó thì nó chặn ở 678px và in ra
một trang.

Kết quả: `patient-medical-record.spec.ts` **18/18** trên **cả** dev :5173 và bản
build production :8080; `treatment-plan.spec.ts` **6/6** → **24/24**. Hai spec
mới: đầu phiếu đứng yên khi cuộn tờ 600px ở cả 1440px và 900px (tờ đi đúng
600px, đầu phiếu 0px), và ô tích cách hàng nút ≥4px trên **mọi** thẻ ở cả hai
bề rộng, thẻ ≥93px, không nút nào tràn khỏi thẻ. Test responsive cũ cập nhật
sang scroller mới (`.pd-medical-canvas-scroll`) và kiểm thêm scroller của mục
lục.

`tsc -b --noEmit` sạch; oxlint không thêm cảnh báo nào ở các file đã đụng.

### Rebase lên `origin/main` (13 commit mới, trong đó có Design v2)

Một xung đột đáng ghi ở `patient-detail.css`: main mới có khối
`@media (max-width: 640px)` chỉnh `.pd-medical-bar` (`left`, `right`,
`transform`, `white-space`, `flex-wrap`) — viết cho **thanh dưới cũ**, hồi nó
là một hộp `absolute` đặt tay bằng `left: calc(50% + 168px)` + `translateX` và
`white-space: nowrap`. Cấu trúc mới không còn thuộc tính nào trong đó có tác
dụng: thanh là con flex canh giữa trong `.pd-medical-barwrap` (trải hết cột,
`inset` 12px khi gập) và tự xuống hàng bằng `flex-wrap` của chính nó. Bỏ khối
đó, thay bằng một ghi chú để không ai thêm lại — kèm số đo trên bản build sau
rebase:

| Khổ | Thanh dưới | Ghi chú |
|---|---|---|
| 375×700 | `left 12 / right 363`, **4 hàng** (154px), **mọi** nút trong khung nhìn | giấy trượt ngang, app không |
| 640×800 | `left 12 / right 628`, 2 hàng (106px), không nút nào bị cắt | mục lục thu về **78px** (nhả cả `min-height`), đầu phiếu `sticky` |

Chạy lại sau rebase trên bản build production: `patient-medical-record` **18/18**
+ `treatment-plan` **6/6** = **24/24**. Domain.Tests **312/312**.

Một lỗi **có sẵn trên `origin/main`**, không phải của đợt này: `npm run build`
đứt ở `tsc` vì `ReceptionPage.tsx` khai `type ViewMode = "day" | "week" |
"month"` rồi truyền `setViewMode` vào `onViewModeChange` của `DateNavigator`,
mà `DateNavigatorMode` đã thêm `"year"` (commit `c8e129d`). Đối chứng: đọc
thẳng hai file **tại `origin/main`** — lệch sẵn ở đó, và không file nào nằm
trong bốn commit của đợt này. Chưa sửa: đó là feature đang làm của người khác,
sửa kiểu cho hết đỏ có thể chặn đúng cái "year" họ đang thêm. Cách chặn tối
thiểu nếu cần gấp: `onViewModeChange={(mode) => mode !== "year" && setViewMode(mode)}`.

## 2026-09-10 — Bệnh án: nút `+` không bấm được, bản in cụt một trang; và một bản vá kiểu của main

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-377 | **`+` trên hàng bảng không bấm được** ở mẫu 5, 8, 9: hover thì hiện ở cuối hàng, rê tới thì mất | `−` nằm ở `right − 10` (đè mép hàng) nên đi tới được; `+` ở `right + 4` — **ngoài** hàng — nên phải băng qua 4px trống, và phần tử bên kia khoảng trống là trang giấy, không phải nút. Cách ẩn cũ nghe `mouseout` của hàng nên tắt nút ngay dưới bàn tay. Nay ẩn theo **toạ độ con trỏ**: giữ nút khi con trỏ còn trong hàng nới thêm 44px sang phải hoặc đang trên nút; thêm `mouseleave` ở `documentElement` cho ca rời hẳn tờ |
| R-378 | **In ra chỉ một trang**, và bản xem trước có cả thanh cuộn của app | Máy in phân trang theo cái mà gốc tài liệu dàn ra; từ `.app-shell` xuống tới vùng cuộn của cột tờ, mỗi lớp là một hộp cao cố định và cắt. Bước cô lập cũ chỉ **ẩn** nhánh ngoài tờ, không **mở** các lớp tờ treo vào. Nay đánh dấu cả hai loại và `@media print` mở hết đường đi, cộng `html`/`body`. Đo mẫu 5 (tờ 2312px): không mở → **1 trang**, gốc tài liệu 900px; có mở → **2 trang**, gốc 2312px, tờ bắt đầu ở y=0 |
| R-379 | Dấu in bị **mất giữa chừng**: mục lục in cả vào giấy | Dấu đặt bằng `class`, mà `className` là prop React dựng — một lần render đè lên. Đổi sang `data-mr-print` (không ai dựng nên không ai đè). Đo lại: dấu còn nguyên, tờ ở y=0, gốc tài liệu đúng bằng chiều cao tờ, không lớp nào còn cắt |

Kèm bản vá cho lỗi **có sẵn trên `origin/main`** đã báo ở đợt trước:
`ReceptionPage` khai `ViewMode = "day" | "week" | "month"` rồi truyền
`setViewMode` vào `onViewModeChange`, trong khi `DateNavigatorMode` đã thêm
`"year"` — `npm run build` đứt ở `tsc`. Sửa ở chỗ đúng của nó: thanh công cụ
Tiếp nhận chỉ có **ba** nút (đo trên máy: `Ngày`, `Tuần`, `Tháng`) nên
`labelToViewMode` không bao giờ trả `"year"`; khai `Exclude<DateNavigatorMode,
"year">` cho đúng sự thật, thay vì chặn `mode !== "year"` ở chỗ gọi — làm vậy
là giấu đi, và khi ai đó thêm "Năm" thật thì lỗi biên dịch phải nổ ở
`ReceptionPage`, đúng nơi cần biết. `npm run build` xanh trở lại; kiểm tay:
chọn "Tuần" ra `07/09 - 13/09/2026`.

Ba spec mới, và cả ba đều đã **soi đỏ trên code cũ** trước khi nhận:

- `+` sống sót khi con trỏ **đi từng bước** tới nó (3px một nhịp) rồi bấm ra
  dòng mới. Test cũ không bắt được vì `locator.click()` nhảy thẳng vào nút.
- In từ tab: bấm nút thật (chỉ chặn hộp thoại `window.print`), rồi ở media
  `print` khẳng định tờ ở y=0, gốc tài liệu **bằng** chiều cao tờ, không tổ
  tiên nào còn `overflow` khác `visible`, và mục lục mang dấu `hide`.
- In từ modal "In bệnh án" — nơi có thêm bốn lớp modal — cùng bộ khẳng định,
  thêm `zoom: 1` để bản xem trước phóng to không theo vào giấy.

Kết quả: `patient-medical-record.spec.ts` **21/21** trên cả dev :5173 và bản
build production :8080; `treatment-plan.spec.ts` **6/6** → **27/27**.
`tsc -b --noEmit` sạch.

Còn đỏ và **không** phải của đợt này: `reception.spec.ts` 2/2 đỏ vì
`assertRealApiTraffic(page, "/api/v1/app/visits")` chờ một endpoint màn Tiếp
nhận **không còn gọi**. Bắt mạng trên bản build: màn này nay gọi
`/api/v1/app/appointments` và `/api/v1/app/appointments/stats`. Đó là hệ quả
của đợt sửa Tiếp nhận trên main (`35c653f`, `c8e129d`), không phải của bản vá
kiểu ở trên — sửa kiểu bị xoá lúc biên dịch, JS sinh ra y hệt. Chưa đụng spec
vì phải biết ý đồ: màn thực sự chuyển sang `appointments`, hay chính việc mất
`visits` mới là lỗi.

## 2026-09-21 — Bệnh án: popover "Chọn phiếu in" bị chật, và bản in bị rách giữa trang

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-380 | **Popover "Chọn phiếu in" chật hơn bản gốc** | Thẻ ngoài chỉ có **padding 4px**: luật cũ nhắm `.ant-popover-inner-content`/`.ant-popover-inner`, mà AntD 6 dựng `.ant-popover-container` nên không trúng đâu cả. Nhắm đúng class, cộng viền 1px + bo 16px + bóng `0 6px 16px rgba(27,42,65,.08)`, panel 294 — đúng số đo bản gốc (thẻ 320×408, dòng 54, bước dòng 62). Thêm `line-height: 20px` cho dòng "Tất cả phiếu", vốn thừa hưởng 22.6px của AntD |
| R-381 | **Bản in rách giữa trang**: một dải nội dung chồng lên nhau, cắt ngang hàng "Giấy cam kết chấp thuận phẫu thuật…" | Ta in **tài liệu của app**, mà tờ nằm trong iframe — với máy in, iframe là **một khối**, bị cắt đúng chỗ hết trang, bất kể `break-after:page` và `tr{break-inside:avoid}` bên trong nó. Bản gốc chép nội dung tờ vào một khối ẩn trong chính trang rồi in khối đó; làm theo (`copySheetsForPrint`), khối là con trực tiếp của `<body>` nên cô lập chỉ còn **một** luật thay cho cả bộ đánh dấu đường đi của R-374/R-378 |
| R-382 | **Chỉ trang đầu có lề**, các trang sau chạy sát mép giấy | Đọc stylesheet bản gốc: `@page{size:A4;margin:5mm;@bottom-right{content:counter(page)}}` — lề **5mm cho mọi trang** và **số trang góc dưới phải**. Ta đang để `margin:0`, mà 12mm padding của tờ nằm trên cả khối chứ không trên từng trang, nên chỉ trang đầu có mép. Lấy đúng 5mm của họ, cộng 7mm của tờ để trang đầu vẫn ra 12mm như bản xem trước |

Hai lỗi cùng đường đi, lộ ra khi sửa:

- **Ô tích trong "Chọn phiếu in" không có tác dụng** — `printSheets` chỉ kiểm
  tra danh sách rỗng rồi in tất cả những gì đang vẽ. Nay chỉ chép đúng các tờ
  được tick.
- **"In nhanh" từ thẻ phiếu in nhầm tờ trước đó** — nó in ngay sau
  `setActiveId`, trước khi React vẽ tờ mới. Nay chờ khung của đúng tờ xuất hiện
  và tải xong rồi mới in.

Cách đo, vì chỉ số đầu tiên tôi dùng đã **sai**: đếm "hàng nằm vắt qua ranh giới
trang" trên layout chưa phân trang là một **dự đoán**, nó bỏ qua việc Chrome tự
đẩy hàng sang trang nhờ `break-inside:avoid` — chỉ số đó vẫn báo đỏ cả khi bản
in đã đúng. Phải nhìn trang in thật: xuất PDF rồi **dựng ảnh từng trang bằng
pdf.js** (máy không có `pdftoppm`/Ghostscript). Tờ Bìa sau khi sửa: **3 trang**,
trang 2 và 3 liền lạc, không hàng nào bị cắt, có số trang góc dưới phải; chữ và
số ô tích của bản chép trùng khít bản đang mở.

Một điều đáng ghi về công cụ: `page.pdf()` của Playwright **bắn sự kiện
`afterprint`**, và app dọn bản chép ngay khi nhận sự kiện đó — nên mọi phép đo
trên bản chép phải làm **trước** khi gọi `page.pdf()`.

Kết quả: `patient-medical-record.spec.ts` **22/22**, `treatment-plan.spec.ts`
**6/6** trên dev :5173 (bản preview :8080 không chạy trong phiên này — máy đang
do chủ dự án tự chạy FE/BE). Hai spec mới: bản in là **bản chép** mang đủ chữ
đã gõ và ô đã tick, và trên giấy chỉ còn `.mr-print-copy`; ô tích của popover
quyết định đúng số tờ được chép. Spec in của modal "In bệnh án" cập nhật sang
cùng hợp đồng. `tsc -b --noEmit` sạch.

### Ô tick phải giữ màu xanh trên giấy (cùng đợt R-380…R-382)

Chủ dự án lưu ý: chỗ có dấu tick trong bản in phải **xanh** như trang đích.

Đo trước khi sửa: bản in của ta **đã xanh sẵn**, kể cả khi tắt "Background
graphics" trong hộp thoại in (đo bằng `page.pdf({printBackground:false})` rồi
dựng ảnh trang 1) — Chrome vẽ `accent-color` của ô tích bất kể tuỳ chọn đó.
Bản gốc cũng không ép gì: đọc stylesheet của họ chỉ có
`accent-color:#2671d8`, `print-color-adjust` để mặc định (`economy`).

Dù vậy vẫn ghim màu lại cho chắc — máy in hoặc driver đặt ở chế độ tiết kiệm có
thể bỏ màu giao diện:

```css
@media print{ .nfc-tpl .nfc-medical-record-checkbox{
  accent-color:#2671d8;print-color-adjust:exact} }
```

Chỉ ghim **ô tích**: màu xanh của ô đã điền và viền hổ phách của ô gợi ý là thứ
**cố ý** phẳng về đen khi in. Spec in kiểm thêm hai điều này ở media `print`.

### Tick ở "Toàn bộ" bị xám, và popover nên tick sẵn tất cả

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-383 | **Ô tích ở chế độ "Toàn bộ" không xanh** (bên "Từng phiếu" thì xanh), và bản in từ đó cũng xám | `renderSheet` đặt `node.disabled = !editable`, mà ở "Toàn bộ" mọi tờ đều không cho sửa — trình duyệt tô xám ô bị vô hiệu hoá, tick và tất cả. Bỏ hẳn `disabled`; tờ chỉ-đọc nay mang `data-readonly="true"` và giữ yên bằng `pointer-events: none` trong stylesheet của tờ. Đo lại ở "Toàn bộ": `disabled: false`, `accent-color: rgb(38,113,216)`, `pointer-events: none`, không ô chữ nào sửa được |
| R-384 | Popover "Chọn phiếu in" mở ra **chưa tick gì** | Mỗi lần mở panel là tick sẵn toàn bộ — in cả bệnh án là việc người ta mở nó ra để làm; bỏ tick vài tờ nhẹ hơn là tick từng tờ |

Một điều đo được trên bản gốc và **cố ý không theo**: ở "Toàn bộ" bản gốc
**không khoá gì cả** — ô tích `disabled: false`, ô chữ vẫn `contenteditable`,
`pointer-events: auto`. Ta giữ chỉ-đọc vì nút **"Lưu" của ta chỉ lưu tờ đang
mở**, nên cho sửa mọi tờ ở đó là mời người dùng gõ vào chỗ sẽ mất. Muốn theo
đúng bản gốc thì phải mở rộng đường lưu trước.

Chưa chạy lại e2e cho hai mục này — chủ dự án nói để tự thao tác kiểm cho nhanh.
Hai spec liên quan đã sửa theo hợp đồng mới (tờ chỉ-đọc không dùng `disabled`;
popover mở ra tick sẵn, bỏ bớt còn hai tờ thì chỉ hai tờ ra giấy). `tsc` sạch.

---

## 2026-09-21 — Kế hoạch điều trị: "Còn lại" và "Phải thu" bị đảo, và một vòng rà soát lại cả tab

Rà soát lại tab `?tab=treatment-plan` với bản gốc (staging). Ngoài soi DOM và
computed style như thường lệ, lần này đọc thẳng **component của bản gốc trong
gói JavaScript đã publish** (`fetch` một file tĩnh trang đã tải sẵn — không gọi
API, không ghi gì), nên danh sách cột, công thức tiền, màu nền dòng và bảng màu
pill dưới đây là số của chính nó, rồi đối chiếu lại với trang đã render.

### Tiền: hai cột bị đảo nghĩa

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-385 | **`Còn lại` hiện 0 đ trên phiếu chưa điều trị gì**, còn `Phải thu` in số **âm** khi khách trả trước | `PaymentSummary.From` gán ngược: ta để `debt = max(receivable, 0)` và `totalDue = totalPrice − netPaid`, trong khi bản gốc là `debt = totalPrice − netPaid` (tất cả những gì phiếu còn nợ) và `receivable = completedValue − netPaid` (chỉ phần việc đã xong mà chưa thu). Đo trên ba payload: phiếu DT33 có một dòng 1.000.000 đ chưa ai đụng trả về `debt: 1000000, receivable: 0`; DT32 và rollup của bệnh nhân khớp cùng công thức. Đổi lại đúng nghĩa; `totalDue` nay lặp lại `receivable` như payload gốc (chính bản gốc không đọc trường này bao giờ) |
| R-386 | `Phải thu` in `-6.000.000 đ` | Bản gốc kẹp ở 0 bằng `resolveReceivable` của nó. `planMoney()` nay trả `Math.max(0, receivable)`; `PatientProfileTab` và `PatientAccountPanel` kẹp y hệt |
| R-387 | Dòng **`Chuyển đổi`** vẫn được tính tiền trên phiếu | DT33 giữ một dòng 1.000.000 đ và một dòng `replaced` 909.091 đ, mà `totalPrice` chỉ là 1.000.000. `TreatmentPlan.CountedServices` nay loại cả `Replaced` và `Transferred` bên cạnh `Cancelled` — việc đó được tính ở dòng khác hoặc phiếu khác |
| R-388 | Bốn màn khác đọc rollup theo nghĩa cũ | `PatientAccountPanel` ("Còn lại"/"Phải thu" đang đảo để bù trừ), `PatientDebtHistoryPanel` (cũng đảo), `CreatePaymentDialog` (`planDue`), `PatientProfileTab` ("Dự kiến thu còn lại" nay tự tính `max(totalPrice − totalPaid, 0)` như bản gốc). Sửa hết theo nghĩa mới |

`Tổng phiếu / Giảm giá / Thành tiền / Đã trả / Hoàn tiền` không đổi — đối chiếu
lại với adapter của bản gốc thì đã đúng từng trường.

### Bảng: cỡ chữ, màu theo giá trị, nền dòng, cột ghim

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-389 | Ô tiền **14px**, bản gốc **13px** | `.tp-cell-money` thêm `font-size: 13px` |
| R-390 | `Còn lại` **luôn đỏ**, `Phải thu` **luôn xám** | Bản gốc: cả hai đỏ **chỉ khi > 0**, còn lại về `text-label`. Gom một `moneyCellClass(field, value)` dùng chung cho bảng và cho card ≤640 |
| R-391 | Phiếu **Hoàn thành không có nền xanh** | Bản gốc tô cả dòng `bg-green-default-50/60`; ô "Thao tác" ghim vẫn trắng. Thêm `tp-row--done` qua `rowClassName` |
| R-392 | Cột "Thao tác" ghim **không có nền trắng, không có bóng** | Luật cũ nhắm `.ant-table-cell-fix-right…`, AntD 6 đổi tên thành `.ant-table-cell-fix-end` / `-fix-end-shadow` nên không trúng gì cả (cùng họ lỗi với R-380). Nhắm cả hai tên |
| R-393 | Nền dải tiêu đề bảng `#F6F8FB` | Bảng phiếu của bản gốc để **trắng** (dải xám chỉ dùng trong dialog). Đổi lại |
| R-394 | Icon con mắt 18px | Bản gốc `size-4` = 16px |
| R-395 | Pill sai màu ở ba trạng thái | `Đang điều trị` và `Bảo hành` là `#EFF6FF`/`#1D4ED8`, `Đã chuyển` là `#F5F3FF`/`#6D28D9` — ta đang dùng chung màu cyan của `Chuyển đổi` cho cả ba. Thêm `tp-pill--progress`, `tp-pill--transferred`. Nhãn dòng dịch vụ bị huỷ cũng đổi thành "Hủy dịch vụ" ("Huỷ phiếu" là chữ dành cho cả phiếu) |

### Thẻ tóm tắt, hai danh sách dịch vụ, hoá đơn, form tạo

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-396 | Thẻ tóm tắt **liệt kê hết** mọi dòng | Bản gốc cắt **4 mục** mỗi thẻ, còn huy hiệu đếm **toàn bộ** số dòng đang điều trị chứ không phải 4 mục đang hiện. `summariseServices` trả thêm `activeCount` |
| R-397 | Thẻ "công đoạn gần nhất" để trống khi công đoạn không có ghi chú | Bản gốc in dấu gạch ngang |
| R-398 | "Danh sách dịch vụ - DT<n>" **thiếu mã phiếu** trước tên dịch vụ | Chỉ bản một-phiếu mới in mã (và mã bấm được, mở màn chi tiết phiếu); bản "Xem tất cả dịch vụ" thì không. Thêm `showCode` |
| R-399 | Cột `Bác sĩ` lấy bác sĩ **của phiếu** | Bản gốc lấy bác sĩ **của chính dòng dịch vụ** |
| R-400 | Cột `Đơn giá` lấy `price` thô | Bản gốc lấy `round(thành tiền / số lượng)` — đơn giá **sau giảm**, nên với số lượng 1 nó bằng đúng `Thành tiền`. Sửa cả bảng lẫn card ≤640; chữ rỗng đổi thành "Không có dữ liệu" |
| R-401 | "Hóa đơn" liệt kê **từng dịch vụ** | Bản gốc lập hoá đơn cho **cả phiếu**: một dòng `Kế hoạch điều trị DT<n>`, đơn vị `Răng`, số lượng 1, đơn giá = `Thành tiền` của phiếu. Tiêu đề bảng cũng để sentence case 14/500 thay vì chữ hoa 11.5px của nhà |
| R-402 | Form "Tạo phiếu dịch vụ" mở ra bằng chip **"Người tạo"** | Bản gốc bỏ chip đó; nay cả hai chế độ đều mở bằng `Nhân sự tư vấn 1*` kèm nút `+` thêm người thứ hai — đúng hàng mà bản cập nhật đang dùng. Advisor được gửi lên làm `staffId` của advise. `Ghi chú` chốt 255 ký tự |
| R-403 | Thẻ tóm tắt xuống **một cột** ở ≤640 | Bản gốc giữ hai cột ở mọi bề ngang, để chữ tự cắt |

### Kiểm thử

- `dotnet test BlueDental.Domain.Tests --filter TreatmentManagement`: **126 pass**.
  `PaymentSummaryTests` và `TreatmentPlanSlipTests` viết lại theo nghĩa mới,
  thêm hai ca: phiếu chưa điều trị gì vẫn nợ nguyên, và dòng
  `Chuyển đổi`/`Đã chuyển` không được tính tiền.
- Playwright trên **bản build production** (`vite preview`, cổng 8080):
  `treatment-plan` **6/6**, `treatment-plan-detail` **6/6**, `consulting-plan`
  **12/12**. Ba spec tạo phiếu phải thêm bước chọn `Nhân sự tư vấn 1`;
  assertion của hoá đơn đổi sang dòng `Kế hoạch điều trị DT<n>`; assertion đơn
  giá của dòng dịch vụ đổi sang số sau giảm.
- `patient.spec.ts` 64/66, `finance.spec.ts` 0/2 — **bốn ca đỏ này đỏ sẵn trên
  `main`**, đã dựng lại bản build từ `git stash` để đối chứng: `finance` cả hai
  ca không nhận được GET `/api/v1/app/sales`, `patient` "the appointment card
  reassigns its doctor" và (không ổn định) "Tạo bảo hành builds no checklist".
  Không liên quan tới thay đổi lần này.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-404 | `treatment-plan-detail` — ca ≤640 đỏ sẵn trên `main` | Đo `boundingBox()` của ô "Nội dung" **một lần** ngay khi dialog vừa mở, mà AntD mở bằng `ant-zoom` từ `scale(0.2)` — đọc trúng khung hình đầu nên nhận 29.8px thay vì 152px. Đổi sang `expect.poll` |

### Còn treo

- Bản gốc chỉ còn **chín** tab hồ sơ bệnh nhân, không có "Hóa đơn"; ta vẫn giữ
  tab thứ mười. Không tự bỏ — chờ chủ dự án quyết (ghi ở `unknowns.md`).
- `Bác sĩ chẩn đoán 1` / `Chẩn đoán 2` bên bản gốc là ô **khoá, không sao đỏ**,
  lấy từ chẩn đoán của dịch vụ; ta vẫn để mở và bắt buộc vì chuỗi tạo phiếu của
  ta (chẩn đoán → tư vấn → duyệt → phiếu) cần một chẩn đoán.
- Dòng phiếu **đã huỷ**: bản gốc gọi tên lớp `bg-red-default-50/60` nhưng lớp đó
  không có trong stylesheet của chính nó, nên dòng không được tô. Ta cũng để
  không tô, theo cái nó **render** chứ không theo cái nó định làm.

---

## 2026-09-21 (đợt 2) — Tìm kiếm phải gọi API, và các thao tác còn thiếu của tab Kế hoạch điều trị

Chủ dự án chỉ ra tám điểm sau đợt rà soát đầu. Vẫn soi bản gốc **chỉ đọc** (mở
trang, mở dialog, gõ vào ô tìm kiếm — chỉ sinh GET — và đọc component trong gói
JavaScript đã publish).

### Lỗi chặn: "Không thể thực hiện thao tác này trên kế hoạch điều trị"

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-405 | Thêm dịch vụ vào **phiếu đã Hoàn thành** trả lỗi `BlueDental:Treatment:0002` | Log của API chỉ đúng chỗ: `AddService` chặn phiếu `Completed`/`Cancelled`. Soi bản gốc thì trên phiếu `done` **không có ô "Thêm dịch vụ mới"** trong thanh công cụ (DT32 chỉ còn `Thêm công đoạn` · `Tạo Đơn Thuốc` · `In Hóa Đơn`), trong khi phiếu đang mở thì có. Ẩn ô picker khi phiếu đã đóng — đúng bản gốc, và đường sinh lỗi biến mất |

### Tìm kiếm: lọc trên FE → gọi API

Đo trên bản gốc: gõ vào "Thêm dịch vụ mới" sinh
`GET /v1/care-service/list?search=rang&page=1&perPage=20`, và component của nó
nhận `fetchServices/fetchGroups/fetchGroupServices`, cuộn tới đâu tải tiếp tới
đó (IntersectionObserver). Ta đang nạp sẵn một trang 200 dòng rồi lọc trong
trình duyệt — phòng khám nào có danh mục dài hơn một trang thì gõ không ra.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-406 | Picker **dịch vụ** (cả form Tạo phiếu lẫn thanh công cụ trang chi tiết) lọc trên FE | `useCatalogOptionSearch` — `useInfiniteQuery` gửi `filter` + `skipCount`, 20 dòng một trang, `keepPreviousData` để popup không nháy trắng giữa hai phím; `useLoadMoreSentinel` xin trang kế khi cuộn tới đáy. Bảng dịch vụ trong panel nhóm cũng vậy (`taxonomyId` + `filter`). Debounce 300ms, có spinner |
| R-407 | Picker **nhóm dịch vụ** lọc trên FE | `useTaxonomyGroupSearch` gửi `filter` lên `/taxonomies` |
| R-408 | Picker **nhân sự / bác sĩ / chẩn đoán** lọc trên FE | Thêm `ServerSearchSelect` (dùng chung, `src/components/`) + `usePickerOptions` (`useDentistOptions`, `useStaffOptionsSearch`, `useDiagnosisOptions`). Áp cho: `Nhân sự tư vấn 1/2`, `Bác sĩ chẩn đoán 1`, `Chẩn đoán 2`, hàng nhập liệu của trang chi tiết (6 ô), form công đoạn (`Bác sĩ` · `Phụ tá` · `Bác sĩ hỗ trợ`), form tái khám (3 ô), `Chọn bác sĩ` của Đơn thuốc |
| R-409 | **Tìm nhân sự phân biệt hoa thường**: gõ "thu" không ra "Lê Thu Hà", gõ "Thu" thì ra | Lộ ra ngay khi tìm kiếm chạm tới server. `filter` của `IIdentityUserRepository` so sánh phân biệt hoa thường trên PostgreSQL; `StaffAppService` nay tự khớp (`MatchesTerm`) trên UserName / Name / Surname / họ-tên ghép / Email / PhoneNumber, không phân biệt hoa thường — giống cách danh mục vẫn khớp |

`ServerSearchSelect` chuyển tiếp `id` / `placeholder` / `onFocus` / `onBlur` /
`onOpenChange` mà `FloatingField` gán vào con của nó — thiếu cái này thì nhãn
nổi mất liên kết `htmlFor` và spec không tìm thấy ô nữa (bắt được bằng e2e).

### Tab Thanh toán: thiếu thao tác

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-410 | Cột "Thao tác" chỉ có **con mắt**; bản gốc có **ba** nút: `Xem` · `Chỉnh sửa` · `Huỷ` (nút cuối màu đỏ `#E5484D`) | Dựng đủ ba, nút 28px ghost đúng kiểu bản gốc. `Chỉnh sửa` mở dialog mới sửa **cách thu tiền** (hình thức, tài khoản, ngày, ghi chú) — số tiền và phần chia theo dịch vụ **không** đổi được, vì rollup của phiếu và "Còn nợ" từng dòng dựng từ đó; muốn sửa số thì `Huỷ` rồi thu lại. `Huỷ` hỏi xác nhận rồi gọi delete (aggregate là `FullAuditedAggregateRoot` nên đây là xoá mềm) |
| R-411 | BE không có đường cập nhật phiếu thu | Thêm `PatientPayment.Revise(...)` (giữ nguyên guard tài khoản cho Ngân hàng/Ví momo), `UpdatePatientPaymentDto`, `PatientPaymentAppService.UpdateAsync` (quyền `payment.update`, có `BranchAccessChecker`), và `PUT api/v1/app/patient-payments/{id}`. Controller của module này viết tay chứ không dựng theo quy ước, nên phải khai cả ở `IPatientPaymentAppService` **và** `PatientPaymentController` — thiếu một trong hai là 405 |

### Giao diện

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-412 | Modal **Hóa đơn**: ô tích ở tiêu đề lệch ô tích của dòng 7px | Tiêu đề bảng (luật mới của đợt trước) padding `8px 16px`, còn ô dòng vẫn nhận `padding-left: 20px` của luật `td:first-child` toàn app. Cho đầu bảng và thân bảng dùng chung padding ngang 16px |
| R-413 | Modal **Hoàn tiền**: không có dữ liệu thì bảng biến mất, chỉ còn một câu | Giữ nguyên khung bảng, in "Không có dữ liệu" trong một ô trải hết 6 cột; bản ≤640 cũng vậy. Pager ẩn khi rỗng |
| R-414 | Modal **In bệnh án**: thừa một thanh cuộn dọc cho cả dialog | `.pmr-body` cao `78vh` cộng 12px padding của `.ant-modal-body` vượt chiều cao antd chốt cho modal đúng 11px. Cho thân modal thành flex column có `overflow: hidden`, `.pmr-body` `flex: 1 1 auto` để co lại khi cửa sổ không đủ chỗ; chỉ còn thanh cuộn của chính tờ giấy |

### Kiểm thử

- Domain **314**, Application **556** xanh.
- Playwright trên bản build production (`vite preview` :8080, API :5019, DB
  thật): `treatment-plan` **6/6**, `treatment-plan-detail` **6/6**,
  `consulting-plan` **12/12**, `prescription` + `treatment-stage` + phần còn
  lại của `patient` — **80 xanh / 2 đỏ**.
- Hai ca đỏ đã đối chứng bằng `git stash` + build lại là **đỏ sẵn trên `main`**:
  `the appointment card reassigns its doctor` và `the công đoạn form reports its
  empty fields` (ca sau chết ở bước dựng dữ liệu — bệnh nhân demo không còn dòng
  dịch vụ nào thêm công đoạn được).
- Kiểm tay trên trình duyệt: gõ "nhổ" ở picker dịch vụ →
  `catalog-entries?...&filter=nhổ&skipCount=0&maxResultCount=20` trả đúng 2
  dòng; gõ "thu" ở picker nhân sự → `staff?...&Filter=thu` nay ra "BS. Lê Thu
  Hà"; sửa ghi chú phiếu thu → `PUT patient-payments/{id}` 200 và ô Ghi chú đổi
  ngay trên bảng; phiếu `Hoàn thành` không còn ô "Thêm dịch vụ mới".

### Còn treo

- Picker **đơn thuốc mẫu** và **tên thuốc** trong dialog Đơn thuốc vẫn nạp sẵn
  danh mục: cả hai được tra ngược theo id để đổ nội dung mẫu và để hiện tên
  thuốc của những dòng đã lưu, nên đổi sang tìm kiếm cần mang theo cả bản ghi
  đã chọn — làm riêng, không ghép vào đợt này.
- `useCatalogOptions` / `useDentistList` / `useStaffOptions` (bản nạp sẵn) vẫn
  còn cho các màn ngoài phạm vi đợt này.

---

## 2026-09-22 (đợt 3) — Chuyển đổi dịch vụ, Tạm ứng, kéo thả dòng, và cuộn ngang không mở modal

Chủ dự án chỉ ra bốn điểm. Vẫn soi bản gốc **chỉ đọc**: mở trang, mở menu trạng
thái, mở dialog "Chuyển đổi dịch vụ" (chỉ dựng giao diện, không bấm Lưu), đọc
`GET /patient-treatments/{id}` và `GET /treatment-services?...` đã có sẵn trong
Network, và đọc component trong gói JavaScript đã publish. **Không** gửi
POST/PUT/PATCH/DELETE nào tới bản gốc.

### Chuyển đổi dịch vụ

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-415 | Menu trạng thái của dòng dịch vụ có "Chuyển đổi" nhưng bấm vào chỉ hiện toast "Chức năng đang phát triển" | Dựng đủ modal **"Chuyển đổi dịch vụ"** của bản gốc (rộng 1024, hai cột `grid gap-8 lg:grid-cols-2`): cột trái là dòng đang đóng (5 dòng dữ kiện + pill trạng thái) rồi "THÔNG TIN THANH TOÁN HIỆN TẠI" (Tổng tiền / Giảm giá / Đã thanh toán / Công nợ / Còn lại); cột phải là "DỊCH VỤ MỚI" — cặp radio `Thay thế` · `Dịch vụ cũ`, ô chọn dịch vụ (tìm kiếm bằng API như mọi picker khác), ô `Thanh toán`, `Ghi chú*` cao 112px, hộp nhân sự `#F8FAFD`/`#E7EDF6` bo 12 có nút `+` thêm người thứ hai và `×` đỏ bỏ đi, rồi `Răng: …` với nút chọn răng, cuối cùng là "THÔNG TIN THANH TOÁN" có dòng **Hoàn trả chênh lệch**. Chân modal một nút `Lưu` |
| R-416 | BE chưa có đường chuyển đổi | `TreatmentService.ReplacedId` + `MarkReplaced()`, `TreatmentPlan.ConvertService(...)`, `PatientPayment.Redirect(...)`, `ConvertTreatmentServiceDto`, `PatientTreatmentAppService.ConvertServiceAsync` và `POST api/v1/app/patient-treatments/{id}/services/{serviceLineId}/convert`. Dòng cũ sang trạng thái `Replaced` (bản gốc gọi là `replaced`, in ra là "Chuyển đổi"), dòng mới được ghi mới hoàn toàn, hai dòng trỏ vào nhau qua `replacedId` — đúng như payload `treatment-services` của bản gốc |
| R-417 | Tiền đã thu nằm lại ở dòng đã đóng | Tiền đi theo dịch vụ: phần chia của dòng cũ trong từng phiếu thu được chuyển sang dòng mới, tối đa bằng số tiền tính cho dịch vụ mới (phiếu thu **không** đổi tổng, chỉ đổi phần chia). Phần dư xử lý theo lựa chọn `Xử lý chênh lệch` của bản gốc: `Hoàn tiền` sinh một phiếu hoàn `HT…` cho dòng cũ, `Dư nợ` để nguyên làm tiền giữ hộ khách |
| R-418 | Số tiền `Thanh toán` nhập tay nhỏ hơn giá dịch vụ mới thì mất chỗ ghi | Ghi thành **giảm giá tiền** trên dòng mới, nên "Đơn giá" vẫn là giá niêm yết còn "Thành tiền" đúng bằng số đã nhập — giống cách bản gốc in dòng sau chuyển đổi |

### Tạm ứng

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-419 | Bảng dịch vụ của trang chi tiết thiếu **một cột**: bản gốc có `Tạm ứng` giữa `Thành tiền` và `Ghi chú` (16 cột, ta đang có 15) | Thêm cột, canh phải, rộng 160 |
| R-420 | Ô "Tạm ứng" ở đầu trang đọc `prepaid`, mà `ForPlan` không bao giờ tính trường này nên luôn ra `0 đ` | Đọc `paidUncompleted` — tiền đã thu của phần việc chưa hoàn tất. Trên phiếu quan sát được, bản gốc trả `paidUncompleted` và `prepaid` **bằng nhau**, nên không phân biệt được nó in trường nào; ghi vào `unknowns.md` |

### Kéo thả dòng dịch vụ

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-421 | Cái tay cầm (grip) ở cột đầu bảng dịch vụ chỉ là hình vẽ, không kéo được | `TreatmentService.SortOrder` + migration, `TreatmentPlan.ReorderService(...)` (kẹp vị trí rồi đánh số lại cả phiếu, y như `PatientAdviseAppService.ReorderAsync`), `POST .../services/reorder`, và `useDragReorder` + `DragContext`/`DraggableRow` ở FE. Grip là **nút thật**: kéo được bằng chuột, và mũi tên lên/xuống cũng đổi chỗ được, nên thứ tự không chỉ với tới bằng con trỏ |
| R-422 | Thứ tự mặc định của bảng dịch vụ đang là theo mã tăng dần | Bản gốc gọi `treatment-services?...&sortBy=createdAt&sortDirection=desc` — **mới nhất trước**. Đổi thành `OrderBy(SortOrder).ThenByDescending(CreationTime)`; dòng chưa từng bị kéo đều mang `SortOrder = 0` nên giữ đúng thứ tự bản gốc cho tới khi phòng khám tự sắp |
| R-424 | Lượt đầu, `AddService` gán luôn `SortOrder = số dòng + 1`, thành ra phiếu mới lại xếp **cũ trước** — đúng cái vừa sửa ở R-422 | Dòng mới sinh ra **không có vị trí** (`SortOrder = 0`); chỉ cú kéo đầu tiên mới đánh số cả phiếu. `ReorderService` cũng đổi tiêu chí phụ sang `ThenByDescending(CreationTime)` cho khớp đúng thứ tự người dùng đang nhìn — lệch nhau là thả một đằng, lưu một nẻo (e2e bắt được: kéo xong mà bảng không đổi) |
| R-425 | Tiền không đi theo dịch vụ khi chuyển đổi | `GetListAsync(predicate)` của ABP mặc định `includeDetails: false`, nên `Lines` của phiếu thu về rỗng và `Redirect` không có gì để chuyển. Đổi sang `WithDetailsAsync(x => x.Lines)` rồi lọc. Test domain không bắt được (dựng aggregate trong bộ nhớ) và e2e đầu tiên cũng không (phiếu chưa thu đồng nào) — ca e2e thứ ba, thu đủ rồi mới chuyển đổi, mới lộ ra |

### Cuộn ngang bảng

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-423 | Kéo ngang bảng rồi thả chuột trên một dòng/nút thì nó mở modal | Sau một cú kéo đã đi quá `4px`, nuốt **một** click kế tiếp ở pha capture rồi gỡ listener ngay frame sau, nên click bình thường không bị ảnh hưởng. Đo tay: kéo kết thúc trên nút "Thêm công đoạn" → không mở gì; click thẳng vào đúng nút đó → mở bình thường |

### Sửa tiếp sau khi chủ dự án xem (cùng ngày)

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-426 | Ô radio "Loại chuyển đổi": chữ không căn giữa theo chiều dọc | `ant-radio-wrapper` của AntD mặc định `align-items: baseline`; đổi sang `center`. Đo lại: tâm chữ lệch tâm ô **0px** |
| R-427 | Dialog có thanh cuộn dọc riêng, cắt mất nội dung | Dialog này đọc như một tờ, nên **không cuộn bên trong**: bỏ trần chiều cao và `overflow` của thân, để nó cao bằng đúng nội dung; cửa sổ không đủ chỗ thì lớp phủ cuộn. `margin-block: auto` giữ dialog ở giữa khi vừa và thả xuống mép trên khi không vừa — với `align-items: center` thì phần đầu bị cắt lên trên gốc cuộn, không kéo tới được. Đo: ở 1000px không chỗ nào cuộn; ở 900px thân dialog vẫn không cuộn, chỉ lớp phủ |
| R-428 | Ô Ghi chú cao 67px thay vì **112px** như bản gốc | `.cvt-note.ant-input` (0,2,0) thua luật `.ant-modal.tp-dialog .ant-input` (0,3,0) đặt `min-height: 42px`; nâng lên `.cvt-dialog .cvt-note.ant-input`. Tiện thể hạ `line-height` của tiêu đề khối và nhãn về 20/18 như bản gốc |

Hai điểm đầu có test giữ: ca `Chuyển đổi closes a line…` nay đo cả độ lệch tâm
của chữ trong ô radio và `scrollHeight − clientHeight` của thân dialog.

### Tìm thấy thêm, chưa sửa trong đợt này

- Menu trạng thái của dòng `Đã tạo` trên bản gốc chỉ có **hai** mục — `Chuyển
  đổi` và `Hủy dịch vụ`, **không** có `Hoàn thành`; bản của ta luôn hiện đủ ba.
  Mới quan sát được đúng một trạng thái nên chưa đủ để chốt luật; ghi vào
  `unknowns.md`.

### Kiểm thử

- Domain **323** (thêm 9 ca: đánh số dòng, kéo thả, chuyển đổi, tiền đi theo
  dịch vụ), Application **556**, HttpApi.Host **16** (thêm một ca quét: mọi
  method của `IPatientTreatmentAppService` / `IPatientPaymentAppService` phải có
  route trên controller viết tay — đúng cái bẫy 405 của đợt trước) — tất cả xanh.
- Playwright trên bản build production (`vite preview` :8080, API :5019, DB
  thật): `treatment-plan-detail` **9/9** (thêm 3 ca: kéo dòng, chuyển đổi, và
  chuyển đổi có tiền — thu đủ rồi chuyển sang "Dịch vụ cũ" tính 1 đ, kiểm
  đúng 1 đ theo sang dòng mới và phần còn lại thành phiếu hoàn), `treatment-plan`
  **6/6**, `consulting-plan` **12/12**, `prescription` **5/5**,
  `treatment-stage` **2/2**, `patient` **62 xanh / 1 đỏ** — ca đỏ
  (`the appointment card reassigns its doctor`) đã ghi từ đợt trước là **đỏ sẵn
  trên `main`**.
- Ca `both printed sheets end on the reference's signature strip` của
  `consulting-plan` đỏ khi chạy riêng bằng `--grep` nhưng **xanh khi chạy cả
  bộ**: nó ăn theo dữ liệu mấy ca trước dựng. Đã đối chứng thêm bằng cách tắt
  hẳn đoạn nuốt click của `useDragScroll` rồi chạy lại — vẫn đỏ, tức là không
  liên quan tới đợt này.
- Kiểm tay trên trình duyệt: kéo dòng đầu xuống cuối → `POST .../services/reorder`
  200, `SortOrder` trong DB thành 1·2·3 và thứ tự giữ nguyên sau khi tải lại;
  chuyển "Nhổ răng khôn mọc lệch" (3.500.000) sang "Trám bít hố rãnh" (400.000)
  → dòng cũ thành "Chuyển đổi", dòng mới `DT01-04` với `ReplacedId` trỏ ngược,
  và "Doanh thu dự kiến" xuống đúng 6.800.000.

---

## 2026-09-22 (đợt 4) — Hai tab còn lại: Hóa đơn và Lịch sử dư nợ

Chủ dự án yêu cầu clone nốt hai tab cuối của hồ sơ bệnh nhân. Tab **Hóa đơn**
chỉ có trên **bản production** (`app.nfcdental.com`), tab **Lịch sử dư nợ** vẫn
đo được trên staging.

Trên production chỉ: đăng nhập, mở trang, đọc DOM / `getComputedStyle`, đọc gói
JavaScript tĩnh. **Không bấm một nút nghiệp vụ nào**, không mở dialog nào,
không sinh POST/PUT/PATCH/DELETE nào.

### Tab Hóa đơn — bản gốc chưa dựng

| ID | Phát hiện | Xử lý |
|---|--------|-----|
| R-429 | Tab "Hóa đơn" của bản gốc **không có nội dung**: bộ chuyển tab là một chuỗi ternary qua 9 khoá, `invoice` không khớp cái nào nên rơi vào nhánh mặc định — khung viền đứt `#DCE3EE` bo 16, padding 40, chữ 16/400 `#5A6B82`, in "Nội dung đang được hoàn thiện." | Không có gì để clone. Hỏi chủ dự án và **giữ bảng hóa đơn của ta** (quyết định 2026-09-22), ghi rõ trong `unknowns.md` rằng đây là phần mở rộng chứ không phải clone |

### Tab Lịch sử dư nợ — dựng lại đúng bản gốc

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-430 | Tab đang đọc **danh sách phiếu thu** (`usePatientAccount().payments`) — sai hẳn khái niệm: nó phải là sổ các lần dư nợ của bệnh nhân | Thêm `GET api/v1/app/patient-payments/debt-history`. Sổ này **suy ra** chứ không lưu: `Nạp dư nợ` ← phiếu Prepaid, `Sử dụng dư nợ` ← phiếu thu phương thức Dư nợ, `Hoàn trả dư nợ` ← phiếu hoàn, `Huỷ dịch vụ - Cộng dư nợ` ← tiền còn nằm trên dòng đã huỷ, `Thay thế dịch vụ` ← tiền còn nằm trên dòng vừa bị chuyển đổi |
| R-431 | Cột "Loại" in nhãn của ta ("Thu tiền" / "Hoàn tiền" / "Nạp quỹ") | Dùng đúng sáu nhãn của bản gốc, đọc từ gói đã publish: `topup` Nạp dư nợ · `use` Sử dụng dư nợ · `withdraw` Rút dư nợ · `replace` Thay thế dịch vụ · `refund` Hoàn trả dư nợ · `cancel` Huỷ dịch vụ - Cộng dư nợ |
| R-432 | Cột "Số tiền" in số trần, không dấu, không màu | Tiền vào tài khoản in `+` màu `#1F9254`, tiền ra in `-` màu `#E5484D`, đều 14px/500. Ba loại vào là `topup` · `refund` · `cancel`; riêng `replace` tự đọc dấu của chính nó và in `|amount|` — luật lấy nguyên từ component của bản gốc |
| R-433 | Ô trống in `—` (em dash) | Bản gốc in `-` (gạch nối thường), và chuỗi rỗng thì để trống hẳn |
| R-434 | Đầu bảng viết hoa 11.5px/700, ô đầu thụt 20px | Về đúng số đo bản gốc: đầu bảng 14/500 `#5A6B82` nền `#F6F8FB` padding `8px 16px` không viết hoa; ô 14px `#1B2A41` padding `12px 16px`, cao 56, kẻ dưới `#DCE3EE`; cột đầu cũng 16 chứ không 20 |
| R-435 | Không có bản thu gọn cho màn hẹp | Dưới **769px** (không phải 640 như các bảng khác của hồ sơ) gập thành thẻ dùng chung: số thứ tự trên đầu xanh, 4 dòng hiện, Ghi chú nằm sau "Xem thêm" |

### Kiểm thử

- Domain **323**, Application **556**, HttpApi.Host **16** xanh (ca quét route
  của controller viết tay tự bắt luôn endpoint mới).
- Playwright trên bản build production: `debt-history` **3/3** — ca đầu tự dựng
  dữ liệu bằng đường thật (mở phiếu → thu tiền → hoàn một phần) rồi mới đọc tab,
  kiểm đúng nhãn "Hoàn trả dư nợ", dấu `+`, màu `rgb(31,146,84)` và câu đếm
  "giao dịch"; ca hai kiểm bản thẻ dưới 769px; ca ba kiểm tài khoản chi nhánh
  khác không đọc được sổ của bệnh nhân này.

---

## 2026-09-22 (đợt 5) — Hoàn tiền trên dòng đã trả đủ, và toast báo lỗi nhân đôi

Chủ dự án bấm "Hoàn tiền" trên một phiếu mà **cả hai dòng đã trả đủ** (Còn lại
0 đ) thì nhận "Có một lỗi nội bộ xảy ra…" — và câu đó hiện **hai lần**. Ba lỗi
riêng biệt nằm sau một cú bấm.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-436 | **Hoàn tiền trên dòng đã trả đủ luôn bị từ chối.** `AllocateAsync` áp một luật cho cả tiền vào lẫn tiền ra: mỗi dòng không được vượt quá **Còn nợ**. Dòng trả đủ thì Còn nợ = 0, nên mọi khoản hoàn đều lớn hơn 0 → chặn | Trần phụ thuộc chiều đi của tiền: tiền vào chặn ở **Còn nợ**, tiền ra chặn ở **số đã thu trên chính dòng đó** (trừ phần đã hoàn). `OutstandingByServiceAsync` thành `CapByServiceAsync(..., refunding)` |
| R-437 | **Câu báo lỗi của server không bao giờ tới người dùng.** ABP in chuỗi trong tài nguyên ngôn ngữ **theo mã lỗi**, không in câu truyền vào `BusinessException`. Mã `BlueDental:Billing:0091` không có trong `vi.json` nên ABP rơi về câu mặc định "Có một lỗi nội bộ xảy ra…" | Tách hai mã riêng cho hai lý do tiền (`0092` vượt Còn nợ, `0093` vượt số đã thu) và khai câu tiếng Việt cho chúng. Rà luôn cả bảng mã: **22 mã** khác cũng không có chữ — mọi lỗi của Ảnh, Labo, Chấm công, Công cụ, Quản lý chi nhánh… đều đang hiện "lỗi nội bộ". Đã bổ sung đủ cả `vi.json` và `en.json` |
| R-438 | **Toast lỗi hiện hai lần.** `MutationCache.onError` bắn một toast chung, còn màn hình lại `catch` rồi `toast.error(extractApiError(e))` thêm một cái nữa. Toast chung có `id` nên không tự nhân đôi, toast của màn hình thì không có `id` → hai toast cùng nội dung | Một kênh lỗi dùng chung: thêm `notifyError()` trong `lib/notify.tsx` dùng đúng `id` mà bộ xử lý chung dùng, và đổi **60 chỗ** `toast.error(extractApiError(...))` ở 38 tệp sang nó. Cùng một câu thì sonner gộp làm một |

### Kiểm thử

- Domain **323**, Application **556** xanh.
- Playwright trên bản build production: `debt-history` **4/4** (thêm ca
  *a line paid in full can still be refunded* — dựng đúng tình huống chủ dự án
  gặp, và đếm luôn số toast), `treatment-plan-detail` **9/9**.
- Kiểm tay: hoàn 150.000 + 120.000 trên phiếu hai dòng đã trả đủ → `HT26-0059`
  với đúng hai dòng; hoàn quá số đã thu → **403** kèm câu
  "Số tiền hoàn của dịch vụ không được vượt quá số tiền đã thanh toán." thay vì
  "lỗi nội bộ".

### Hai ca đỏ do **dữ liệu** của DB dev, không phải do đợt này

- `taxonomy` *a phone-width window scrolls the page*: ca này đòi trang cao hơn
  780px, tức là nhóm đầu tiên phải đủ nhiều dòng. DB dev nay đầy **nhóm rỗng do
  chính e2e để lại** ("NHÓM CN2 958480", "NHÓM CN2 390746"…), nhóm đầu 0 dòng
  nên trang vừa khít màn hình. Không có gì trong đợt này đụng tới giao diện
  Danh mục.
- `treatment-plan-detail` ca đầu từng đỏ vì `createSlip` bốc trúng **dịch vụ giá
  0** trong danh mục (rác e2e đã ghi từ F-39), làm "Doanh thu dự kiến" bằng 0.
  Đã sửa spec: chọn mục đầu tiên **còn giá** (`pickPricedService`), dùng chung
  cho cả `debt-history`.

---

## 2026-09-22 (đợt 6) — Báo giá hỏi trước khi xoá, và form "Tạo phiếu dịch vụ"

Sáu điểm chủ dự án chỉ ra, gộp hai lượt.

### Tab Chẩn đoán & Tư vấn

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-439 | ✕ trên tab báo giá **xoá ngay**, không hỏi | Hỏi bằng `ConfirmDeleteDialog` như mọi chỗ xoá khác: tiêu đề "Xóa báo giá", câu "Phiếu báo giá BG n sẽ bị xoá và thao tác này không thể khôi phục.", dòng phụ "Hành động này không thể hoàn tác.", nút `Xoá` đỏ. Xoá là ghi xuống server, không lấy lại được |
| R-440 | Bấm tab **"Phiếu tư vấn"** lúc nó đang mở thì bật dialog "Tạo phiếu tư vấn" | Bỏ hẳn. Hành vi đó là do **ta tự nghĩ ra** — `unknowns.md` đã ghi rõ là suy luận chứ không đo được — và chủ dự án xác nhận bản gốc không làm vậy. Nay bấm vào chỉ quay về danh sách; đang mở thì không có gì xảy ra. Phiếu tư vấn vẫn tạo từ dòng chẩn đoán như bản gốc |

### Form "Tạo phiếu dịch vụ"

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-441 | Thiếu răng thì báo bằng **toast** | In **dưới ô Răng**: "Vui lòng chọn ít nhất 1 răng", và tự mất khi chọn răng. Toast bay đi trước khi đọc kịp |
| R-442 | "Đơn giá" và "Số lượng" sửa được sau khi chọn dịch vụ | **Khoá cả hai**: giá là của danh mục, để gõ đè thì phiếu lên sổ với cái giá danh mục không biết. Chỉ "Giảm giá" còn sửa được |
| R-443 | "Bác sĩ chẩn đoán 1" và "Chẩn đoán 2" bắt buộc chọn | **Khoá cả hai**, bỏ luôn dấu sao và luật bắt buộc. Bác sĩ của phiếu lấy theo "Nhân sự tư vấn 1" khi không có ai được chỉ định |
| R-444 | Lưu xong sinh thêm **một phiếu chẩn đoán (CD)** | Bỏ bước `createDiagnosis`: lưu nay chỉ ghi **phiếu dịch vụ + phiếu DT**. Kéo theo sửa BE — `PatientAdvise.DiagnosisId` và `PatientDiagnosisId` thành **nullable** (migration `AdviseDiagnosisOptional`), `CreateAsync` chỉ kiểm chẩn đoán khi có, và các chỗ đọc tên chẩn đoán chịu được null |

### Kiểm thử

- Domain **323**, Application **556** xanh.
- Playwright trên bản build production: `treatment-plan` **7/7** (thêm ca
  *the form says what is missing under the field…* giữ cả bốn điểm trên),
  `treatment-plan-detail` **9/9**, `debt-history` **4/4**,
  `consulting-plan` **12/12** (ca báo giá nay trả lời hộp xác nhận, và kiểm
  luôn rằng bấm "Phiếu tư vấn" không mở dialog nào).
- Đối chứng bằng dữ liệu: đếm `bd_patient_diagnoses` trước và sau khi chạy cả
  bộ — **529 → 529**, không sinh CD nào; hai dòng tư vấn mới nhất mang
  `PatientDiagnosisId` và `DiagnosisId` đều `NULL`.

### Hai ca e2e vốn mong manh, đã làm chắc lại

- Bộ `treatment-plan`/`debt-history` từng bốc trúng **dịch vụ giá 0** trong danh
  mục (rác e2e) làm "Doanh thu dự kiến" bằng 0 → nay chọn mục đầu tiên **còn
  giá** (`pickPricedService`).
- `consulting-plan` ca voucher tick "dòng đầu tiên", mà dòng đầu nay là một
  dòng giá 0 → nay tìm dòng đầu tiên **có tiền** rồi mới tick.

---

## 2026-09-22 (đợt 7) — Ô "Chẩn đoán" của bảng Phiếu tư vấn

Chủ dự án chỉ ra ô này in `11 - Mặt nhai - —`, đúng ra chỉ là số răng rồi tới
một đoạn chữ. Đo lại trên staging (chỉ đọc: mở trang, đọc DOM và đọc chính
payload `patient-advises` đã có sẵn trong Network).

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-445 | Ô in **kèm mặt răng** (`formatTeeth`) | Bản gốc chỉ in **số răng**. Đối chứng chắc: dòng `TV26` có răng 22 `top`, 23 `right`, 24 `center` — mặt răng chọn hẳn hoi — mà ô vẫn in `12, 11, 22, 23, 24 - vôi răng`. Thêm `formatToothCodes` |
| R-446 | Không có chẩn đoán thì in `- —` | Bản gốc **dừng ở số răng**: `13, 12`, `12`, `11`. Nay nối ` - ` chỉ khi có tên chẩn đoán |
| R-447 | Cột **"Bác sĩ chẩn đoán 1"** đọc `staffName` — trùng y hệt cột "Nhân sự tư vấn 1" | Bản gốc đọc **bác sĩ của phiếu CD**. Đối chứng: ba dòng cuối của bệnh nhân quan sát được có người tư vấn nhưng `patientDiagnosis: null` → cột này in `-` trong khi "Nhân sự tư vấn 1" vẫn có tên. BE thêm `diagnosisStaffName` lên `PatientAdviseDto` |
| R-448 | Cột **"Chẩn đoán 2"** đọc `diagnosisName` — in lại đúng tên chẩn đoán đã có ở cột "Chẩn đoán" | Bản gốc đọc **bác sĩ thứ hai của phiếu CD**. BE thêm `diagnosisSecondStaffName` |
| R-449 | Ô rỗng in `—` (em dash) | Bảng này dùng `-` (gạch nối), giống sổ dư nợ. "Nhân sự tư vấn 2" cũng thôi in "Chưa cập nhật" |

### Kiểm thử

- Application **556** xanh.
- Playwright trên bản build production: `consulting-plan` **12/12** (ca
  *the diagnosis cell…* nay soi từng ô theo `^\d+(, \d+)*( - .+)?$`, tức là bắt
  được cả mặt răng lẫn dấu `-` thừa), `treatment-plan` **7/7**,
  `patient` **62/63**.
- Hai ca đỏ khi chạy gộp đều đã ghi từ trước: `both printed sheets…` của
  `consulting-plan` chỉ đỏ khi chạy sau bộ khác (chạy riêng bộ đó thì 12/12), và
  `the appointment card reassigns its doctor` là đỏ sẵn trên `main`.

## 2026-09-22 (đợt 8) — Sửa được chẩn đoán, và hai ô đọc nhầm người trong "Cập nhật phiếu dịch vụ"

Chủ dự án đưa hai ảnh cạnh ảnh trang đích: (1) mở "Cập nhật Chẩn Đoán" thì ô
"Chẩn đoán" khoá cứng, không sửa được cái đã chọn sai; (2) mở "Cập nhật phiếu
dịch vụ" từ một dòng dịch vụ thì ô "Chẩn đoán 2" đang đổ **tên chẩn đoán**, còn
trang đích để trống.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-450 | Ô "Chẩn đoán" của form CD `disabled` khi đang sửa — ghi chú cũ nói server không cho đổi | Bản gốc cho đổi. Bỏ `disabled={Boolean(editing)}`; BE thêm `PatientDiagnosis.ChangeDiagnosis(Guid)` đi qua `GuardEditable()` (phiếu đã huỷ / đã điều trị vẫn khoá), `UpdatePatientDiagnosisDto` thêm `DiagnosisId`, `UpdateAsync` chỉ áp khi id khác `Guid.Empty` |
| R-451 | "Bác sĩ chẩn đoán 1" đổ `staffId` (người tư vấn) | Đổ `diagnosisStaffId` — đúng bác sĩ của phiếu CD, cùng nguồn với cột bảng đã sửa ở R-447 |
| R-452 | "Chẩn đoán 2" đổ `diagnosisId` (tên chẩn đoán) | Đổ `diagnosisSecondStaffId`. Trang đích để trống vì phiếu CD quan sát được không có bác sĩ thứ hai — không phải vì ô này in chẩn đoán |
| R-453 | "Chẩn đoán 2" lấy danh sách chẩn đoán | Lấy `useDentistOptions` — ô này là **người**, không phải bệnh |
| R-454 | "Tình trạng răng:" in kèm một giá trị | Bản gốc để trống sau dấu hai chấm |

Hai ô "Bác sĩ chẩn đoán 1" và "Chẩn đoán 2" **luôn** `disabled` (đợt 6, R-441) —
đợt này chỉ sửa chúng đọc gì, không mở lại.

### Kiểm thử

- Domain **323** xanh, Application **556** xanh.
- Playwright trên bản build production: `consulting-plan` **13/13** (thêm ca
  *Cập nhật Chẩn Đoán may correct the condition it found*: đổi "Sâu ngà" →
  "Sai khớp cắn hạng II", chờ toast, tải lại trang rồi đọc lại ô "Chẩn đoán"
  của dòng CD).
- Ca `both printed sheets end on the reference's signature strip` lại đỏ một lần
  ở lần chạy gộp đầu (`|leftGap - rightGap| = 920.5`), rồi xanh khi chạy lại cả
  bộ — đúng kiểu phụ thuộc thứ tự đã ghi ở đợt 7, không phải do đợt này.

### Đã đo trên trang đích (chỉ đọc)

Mở `staging.nfcdental.com/patient/…?tab=consulting`, đọc DOM và payload
`patient-advises` đã có sẵn trong Network. Không bấm nút nào có thể ghi.

## 2026-09-22 (đợt 9) — Select của dòng thêm mới bị co lại, và hỏi trước khi bỏ công đoạn đang nhập

Chủ dự án đưa hai ảnh: (1) thêm dịch vụ mới ở trang Chi tiết phiếu thì ô chọn
"Chẩn đoán" và "Bác sĩ điều trị" chỉ còn bằng cái icon, danh sách xổ ra cũng bị
cắt (`Sai …`, `Sâu …`, `Răn…`); (2) đang nhập công đoạn mà bấm đóng thì bản gốc
hỏi lại bằng dialog "Hủy thay đổi".

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-455 | Sáu ô chọn của dòng nhập mới co về **71px** trong ô bảng **200px** | `.pdt-draft-select` rộng 100% nhưng `Select` của AntD tự co theo nội dung, mà ô rỗng thì chỉ có icon kính lúp + mũi tên. Thêm `.pdt-draft-select .ant-select { width: 100% }` — cùng một luật đã có ở `.cvt-staff-row`. Đo lại: **168px** trong ô 200px, **148px** trong ô 180px; popover xổ ra rộng theo nên thôi cắt chữ |
| R-456 | Đang nhập công đoạn, bấm ✕ hoặc "Hủy" là mất trắng, không hỏi | Dựng dialog **"Hủy thay đổi"** đúng bản gốc |
| R-457 | Nút chính của tab "THÊM CÔNG ĐOẠN" ghi "Thêm công đoạn" | Bản gốc ghi **"Lưu công đoạn"** (`add`); `continue` → "Tiếp tục công đoạn", `continueWarranty` → "Tiếp tục bảo hành" |
| R-458 | "Hủy" của form chỉ bỏ chọn dòng | Bản gốc gắn **cùng một** hàm đóng cho ✕ và "Hủy", nên "Hủy" rời hẳn "Chi tiết phiếu" |

### Đã đo trên bản gốc (chỉ đọc)

Không bấm gì, không gõ gì vào form của bản gốc — chỉ mở trang đã đăng nhập sẵn
rồi `fetch` các file `.js` **đã nạp** (tài nguyên tĩnh, GET) và đọc:

```js
e1 = useMemo(() => [...ex, ...eb].some(
       e => (e.treatmentContent ?? "").trim().length > 0 || (e.imageIds?.length ?? 0) > 0
     ), [ex, eb]);
e2 = useCallback(() => { e1 ? eG(!0) : k() }, [e1, k]);
// <Modal show={e} onClose={e2} …>            ← ✕ của dialog
// <StageDetailBlock … onCancel={e2} …>        ← nút "Hủy" của form
```

Rút ra ba điều:

- **"Bẩn" chỉ tính nội dung điều trị và ảnh.** Chọn bác sĩ / phụ tá / bác sĩ hỗ
  trợ hay tích công đoạn **không** tính — nên mở ra, chọn bác sĩ rồi đổi ý vẫn
  đóng thẳng, không bị hỏi.
- ✕ và "Hủy" dùng **chung một** hàm đóng.
- Nhãn nút lưu đổi theo tab (R-457).

Nội dung dialog lấy nguyên văn: tiêu đề `"Hủy thay đổi"`, câu hỏi
`"Bạn có chắc muốn hủy? Dữ liệu vừa nhập sẽ không được lưu."`, nút
`"Xác nhận hủy"` / `"Tiếp tục chỉnh sửa"`. Dòng
`"Hành động này không thể hoàn tác."` nằm sẵn trong component xác nhận dùng
chung của bản gốc — giống hệt `ConfirmDeleteDialog` của ta, vốn đã clone từ nó;
component đó cũng nhận `confirmLabel` / `cancelLabel`, nên ta thêm đúng hai prop
ấy thay vì dựng dialog thứ hai.

### Kiểm thử

- Real-stack Playwright, DB + API thật, không chặn request nào:
  `treatment-plan` + `treatment-plan-detail` **17/17** trên bản build production
  (`vite preview` :8080, API :5019), và `treatment-plan` **8/8** chạy lại trên
  dev :5173 (StrictMode — bản build che được lỗi updater không thuần khiết).
- Hai ca mới: *leaving Công đoạn with something written asks before it throws it
  away* (đi đủ ba nhánh: sạch thì đóng thẳng, "Tiếp tục chỉnh sửa" trả lại
  nguyên chữ đã gõ, ✕ cũng hỏi, "Xác nhận hủy" đóng hết và **không** tạo công
  đoạn nào), và phần đo bề rộng sáu ô chọn trong ca kéo thả dòng dịch vụ.
- `tsc` sạch, `npm run lint` không thêm cảnh báo.

## 2026-09-22 (đợt 10) — Giá lẻ trên cột "Phải thu", và đo lại chuyện bảng cuộn ngang

Chủ dự án chỉ vào dòng `DT01` của `/patient/…?tab=treatment-plan`: cột cuối in
`204.545,455 đ` giữa toàn số tròn, và kèm một câu "table không scroll ngang đc".

### Giá lẻ — có thật, sửa tận gốc

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-459 | `TreatmentPlan.CompletedValue` chia tiền mà **không làm tròn** | Giảm giá mức phiếu được rải theo tỉ lệ: `completed − PlanDiscountAmount × completed / ServicesTotal`. Với phiếu 2.750.000, giảm 500.000, dòng đã xong 250.000 → `204545,4545…`. Thêm `BlueDental.Values.Vnd.Round` và bọc phép chia |
| R-460 | Ba chỗ chia tiền khác cũng không làm tròn | `TreatmentPlan.PlanDiscountAmount`, `TreatmentService.DiscountAmount`, `PatientAdvise.DiscountAmount` — nhánh `Percentage` của cả ba |
| R-461 | `formatVND` in tới **3 số lẻ** | `toLocaleString(locale)` mặc định `maximumFractionDigits: 3`, khác hẳn `formatCurrency` ngay bên trên vốn đặt `0`. Nay đặt `0` — lớp chắn cuối, số phải tròn từ BE |

`Vnd.Round` dùng `MidpointRounding.AwayFromZero`: `Math.Round` mặc định là làm
tròn ngân hàng, `0,5` sẽ về `0`.

Kiểm lại trên trình duyệt, đúng dòng bản gốc chỉ ra: `DT01` nay in
**`204.545 đ`**, và không còn ô tiền nào khớp `/\d\.\d{3},\d/` trên cả trang.

### Cuộn ngang — hỏng thật, nhưng không phải ở chỗ tưởng

Vòng đo đầu chưa ra: kéo và lăn ngang đều chạy ở mọi bề rộng có tràn
(1280 → tràn 563, kéo 360; 1440 → 403; 1600 → 243; 1728 → 115), còn từ ~1850px
trở lên bảng vừa khít nên không còn gì để cuộn. Chủ dự án gửi thêm ảnh cắt
cột "Phải thu" bị cột "Thao tác" đè lên, và đo lại ở **1860px** thì ra:

| | trước | sau |
|---|---|---|
| Bảng rộng | 1795 | 1789 |
| Khung cuộn | 1789 | 1789 |
| **Tràn** | **6px** | **0** |
| Cột ghim đè lên "Phải thu" | **6px** | 0 |
| Cột con mắt (khai báo 48) | **100px** | 49px |

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-462 | Luật chung `min-width: 100px` cho **mọi** `th` thổi cột con mắt từ 48 lên 100, và cột "Thao tác" thoát luôn phần miễn trừ của chính nó vì **AntD 6 đổi tên** `…-fix-right` → `…-fix-end` | Thêm `…-fix-end` vào phần miễn trừ, và thêm `.bd-col-icon` cho cột chỉ có icon. Bảng hết dôi 77px so với tổng bề rộng khai báo (1718) |
| R-462b | `useDragScroll` cũng chỉ biết tên cũ | Thêm `…-fix-start` / `…-fix-end` vào danh sách ô không được kéo |

Chỗ chết người là **6px**: cột ghim `position: sticky; right: 0` luôn nổi trên
phần chưa cuộn tới — đúng bản chất của cột ghim — nhưng tràn 6px thì không ai
kéo nổi 6px đó ra, nên nhìn như "bị đè mà không cuộn được". Có test mới chốt
lại: hoặc vừa khít (tràn 0), hoặc tràn > 20px — không được rơi vào khoảng giữa.

Cũng đối chiếu bản gốc (chỉ đọc, đo DOM): nó **cũng** đặt bảng trong một khối
`min-h-0 flex-1 overflow-auto` cao cố định, trang không cuộn dọc
(`docScrollH === docClientH`), y hệt `.pd-pane--fill` của ta — nên "bảng cao cố
định, cuộn bên trong, dòng cuối bị cắt ngang" không phải sai lệch.

### Kiểm thử

- Domain **325** (thêm 2 ca: `Phai_thu_stays_a_whole_dong_when_the_discount_does_not_divide`
  và `A_percentage_discount_is_rounded_to_a_whole_dong`), Application **556**.
- Host bị khoá DLL khi build (đang chạy) → dừng, build lại, chạy test, bật lại.

## 2026-09-22 (đợt 11) — Dòng dịch vụ không "vào điều trị", và ô tích công đoạn không đổ nội dung

Ba việc chủ dự án nêu từ trang đích
`staging.nfcdental.com/patient/…/treatment-plan/…`. Hai việc đã xong, một việc
mới dựng xong phần đo.

### Đã sửa

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-463 | `DT01` mang pill "Đang điều trị" mà thẻ **DỊCH VỤ ĐANG ĐIỀU TRỊ** vẫn rỗng (badge 0) | Thẻ đó lọc **dòng dịch vụ** `status === InProgress`, mà dòng không bao giờ tới trạng thái đó: `MoveServiceLineAsync` được gọi ở `ContinueAsync` / `CompleteAsync` / `RevertAsync` nhưng **không** ở `CreateAsync`. Đối chứng trên DB thật: dòng "Tẩy trắng răng tại phòng" có **2** công đoạn mà vẫn `Created`. Nay tạo công đoạn đầu tiên cũng gọi `MoveServiceLineAsync`, đúng như `Start()` tự mô tả ("the first công đoạn moved it") |
| R-464 | Tích một công đoạn trong **Danh sách công đoạn** không đổ gì vào **Nội dung điều trị** | Bản gốc chạy `syncTreatmentContentWithStages` trên **mỗi** lần tích, ở cả form công đoạn lẫn "Tạo tái khám" (hai chỗ dùng chung một block). Clone thành `syncStageContent` |

Hàm của bản gốc, đọc nguyên văn từ chunk đã publish (GET file tĩnh):

```js
function L(content, checklist) {
  const a = checklist.filter(e => e.checked).map(e => e.label.trim()).filter(Boolean);
  const r = new Set(checklist.map(e => e.label.trim()).filter(Boolean));
  return [...a, ...content.split("\n").map(e => e.trim()).filter(e => e && !r.has(e))].join("\n");
}
```

Ba điều rút ra, và cả ba đều quan trọng:

- Tên các mục **đã tích** đứng **trước**, theo thứ tự danh sách, trên phần gõ tay.
- Mọi dòng trùng với **bất kỳ** tên nào trong danh sách bị gỡ khỏi phần gõ tay
  trước khi ghép lại — nên bỏ tích là mất dòng đó, và tích hai lần không nhân đôi.
- Dòng nào cũng được trim, dòng trắng bị bỏ.

### Còn lại — tab "TIẾP TỤC BẢO HÀNH" (chưa dựng)

Bản gốc có **ba** tab trong "Chi tiết phiếu", ta mới có hai. Đã đo xong luật,
chưa viết code:

```js
e5 = useMemo(() => {
  const e = [];
  Y && e.push({ value: "add",              label: "THÊM CÔNG ĐOẠN",      count: ex.length });
  Q && e.push({ value: "continue",         label: "TIẾP TỤC CÔNG ĐOẠN",  count: eb.length });
  J && e.push({ value: "continueWarranty", label: "TIẾP TỤC BẢO HÀNH",   count: eq.length });
  return e;
}, [ex.length, Q, J, Y, eb.length, eq.length]);
```

- Mỗi tab chỉ hiện khi **có quyền** tương ứng (`Y` / `Q` / `J`), không phải khi
  có dữ liệu. Tab đang chọn mà mất quyền thì rơi về `add` → `continue` →
  `continueWarranty`.
- Nhãn nút lưu theo tab: `add` → `Lưu công đoạn`, `continue` →
  `Tiếp tục công đoạn`, `continueWarranty` → `Tiếp tục bảo hành` (R-457).
- Lưu xong, các dòng vừa lưu được **dọn tại chỗ** chứ không đóng form:
  `treatmentContent: ""`, `imageIds: []`, `images: []`, `imageLabel: "(Trống)"`,
  và **bỏ tích toàn bộ** `stageChecklist`.
- Đáng chú ý: phép kiểm "bẩn" của bản gốc (`e1`) chỉ gộp `[...ex, ...eb]` —
  **không** gộp danh sách bảo hành `eq`. Ghi lại nguyên trạng, chưa bắt chước.

Hành vi "tích Hoàn thành → lưu → bỏ tích" mà chủ dự án dặn soi kỹ thuộc phần
này; `MoveServiceLineAsync` của ta đã suy trạng thái dòng **từ các công đoạn anh
em** (`allDone` → `Complete`, ngược lại `Reopen`/`Start`) nên bỏ tích đã đưa dòng
về `InProgress` đúng chiều — nhưng chưa đối chứng được với tab bảo hành.

### Kiểm thử

- Domain **325**, Application **556**.
- `patient` **61/63** trên bản build production. Hai ca đỏ: `the appointment card
  reassigns its doctor` (đỏ sẵn trên `main`, đã ghi từ đợt 3) và
  `dragging a card by its grip…` (chạy riêng thì **xanh** — phụ thuộc thứ tự).
- Ca `Danh sách công đoạn carries…` được nối thêm phần kiểm binding: tích thì ô
  nội dung nhận đúng chữ, bỏ tích thì mất chữ đó mà **giữ** phần gõ tay, tích lại
  thì không nhân đôi.

### Ba chỗ fixture phải sửa (không phải lỗi sản phẩm)

Chạy đi chạy lại các bộ test làm trôi dữ liệu: mỗi lần chạy lại đẻ thêm phiếu,
mà fixture chỉ đọc **50** phiếu mới nhất nên các phiếu seed có bảo hành rơi ra
ngoài cửa sổ — đo được 125 dòng bảo hành còn mở nhưng **0** dòng trong 50 phiếu
đầu. Đã nới cả ba chỗ lên 300. Đồng thời tách `stageable` thành hai chế độ:
`stageable` (dòng còn mở) và `freshLine` (còn mở **và chưa có công đoạn** — thứ
tab THÊM CÔNG ĐOẠN thực sự liệt kê), vì một dòng chưa có công đoạn vẫn chiếm
**một** dòng giữ chỗ trong bảng điều trị, làm lệch các ca đếm dòng.

## 2026-09-22 (đợt 12) — Chuyển đổi dịch vụ phải từ chối dòng đã có công đoạn hoàn thành

Chủ dự án dặn: dịch vụ nào đã có công đoạn hoàn thành thì bấm Lưu ở modal
"Chuyển đổi dịch vụ" phải báo rõ, và bảo rà soát trang đích cho đúng.

### Đã đo trên bản gốc (chỉ đọc)

Câu báo **không** nằm trong bundle dưới dạng chữ cứng — nó là **khoá i18n**, tức
là server từ chối và client in lại. Đọc được đủ bốn khoá của luồng chuyển đổi
(GET file tĩnh, không bấm gì trên bản gốc):

| Khoá | Tiếng Việt của bản gốc |
|---|---|
| `treatment.validation.convertNotAllowed` | **Dịch vụ đã hoàn thành/huỷ không được phép chuyển đổi.** |
| `treatment.validation.convertNoteRequired` | Vui lòng nhập lý do chuyển đổi dịch vụ. |
| `treatment.validation.convertDifferenceRequired` | Bạn chưa chọn phương thức xử lý tiền chênh lệch. |
| `treatment.validation.convertTypeUnsupported` | Loại chuyển đổi này chưa được hỗ trợ. |
| `treatment.validation.selectNewService` | Vui lòng chọn dịch vụ mới |

Đáng chú ý: luật của bản gốc tính theo **trạng thái dòng** (hoàn thành / huỷ),
không phải theo "đã có công đoạn hoàn thành". Hai cái trùng nhau khi **mọi**
công đoạn đã xong — lúc đó dòng thành `Done`. Nhưng dòng mới xong **một phần**
(có công đoạn đã hoàn thành, còn công đoạn khác dở) thì bản gốc **vẫn cho**
chuyển đổi. Luật chủ dự án yêu cầu chặt hơn, và chặt hơn là đúng: phần việc đó
đã làm và đã tính tiền vào chính dịch vụ này.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-465 | Dòng đã hoàn thành/huỷ/đã chuyển bị chặn bằng `GuardOpen` với mã chung `InvalidPlanTransition`, nên màn hình chỉ thấy câu chung chung | Mã riêng `BlueDental:Treatment:0027` + bản dịch **đúng câu của bản gốc**. Kiểm ở tầng AppService trước khi vào aggregate để lý do ra được tới màn hình |
| R-466 | Dòng còn mở mà đã có công đoạn hoàn thành vẫn chuyển đổi được | Mã riêng `BlueDental:Treatment:0028` — *"Dịch vụ đã có công đoạn hoàn thành, không được chuyển đổi."* Công đoạn là aggregate khác nên câu hỏi phải đặt ở AppService |

Nhắc lại vì đã mất một vòng: ABP in **bản dịch của mã lỗi**, không in câu truyền
vào `BusinessException`. Thiếu entry trong `vi.json` là ra "Có một lỗi nội bộ".

### Kiểm thử

Ca real-stack mới, `a line with a finished công đoạn refuses to be converted,
and says why`: tạo **hai** công đoạn rồi chỉ hoàn thành **một** — đó mới là ca
cần đo, vì dòng vẫn `Đang điều trị` nên còn menu trạng thái để mở được modal;
hoàn thành công đoạn duy nhất thì dòng đóng luôn và **không còn menu** (đường đó
ca này cũng phủ, bằng cách gọi thẳng API và đọc mã `0027`).

Ca kiểm: server trả lỗi, câu tiếng Việt hiện trên màn hình, **không** có chữ
"lỗi nội bộ", và tải lại thì phiếu vẫn đúng **một** dòng — không có gì bị chuyển.

`treatment-plan-detail` + `treatment-plan` **19/19** trên bản build production.

## 2026-09-22 (đợt 13) — Nút "Tạo kế hoạch mới" biến mất sau khi nhập main

Sau khi đưa nhánh làm việc lên `origin/main` (commit phân quyền `3747b2c`), tab
**Kế hoạch điều trị** của hồ sơ bệnh nhân mất hẳn nút **"Tạo kế hoạch mới"** —
với **mọi** tài khoản, kể cả `admin`.

Không phải lỗi hợp nhất. Commit phân quyền bọc nút lại:

```tsx
const ability = useAbility("treatmentPlan");
onCreate={ability.canCreate ? () => setCreateOpen(true) : undefined}
```

nhưng **`treatmentPlan` không phải là một subject của cây quyền**. Đối chiếu 24
subject phía giao diện gọi với 86 subject `BlueDentalAbilityPermissions` định
nghĩa: `treatmentPlan` là cái **duy nhất** không tồn tại. `useAbility` chỉ tra
`Set` các lá đã cấp, nên một subject bịa ra cho `canCreate = false` vĩnh viễn —
không ai cấp được lá không có trong cây.

Quyền đúng đọc từ **đường đi thật của nút**: `POST patient-advises` →
`accept` → `POST patient-treatments`. Khâu cuối (`PatientTreatmentAppService
.OpenAsync`) gác bằng `TreatmentConsultation.Create`; policy module cũ của
advise cũng quy về `treatmentConsultation` / `treatmentStage` /
`treatmentDiagnosis` qua `BlueDentalPermissionBridge`. Ràng buộc chặt nhất là
`treatmentConsultation.create` — đúng lá mà nút "Thêm kế hoạch điều trị" ở tab
Chẩn đoán & Tư vấn đang dùng cho cùng một việc.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-467 | `TreatmentPlanPanel` gác nút bằng `useAbility("treatmentPlan")`, một subject không có trong cây quyền → nút ẩn với mọi user | Đổi sang `useAbility("treatmentConsultation")`, đúng lá server kiểm ở `OpenAsync` |

Bài học để khỏi lặp: **subject truyền vào `useAbility` là chuỗi tự do** — gõ sai
không ai báo, và triệu chứng là nút lặng lẽ biến mất chứ không phải 403. Khi
thêm một chỗ gác quyền, đọc `[Authorize]` của chính endpoint mà nút gọi, đừng
đặt tên subject theo tên màn hình. Lệnh soát nhanh:

```
# subject giao diện gọi mà backend không định nghĩa — phải rỗng
grep -rhon 'useAbility("[a-zA-Z]*")' BlueDental.FE/src | sed 's/.*useAbility("\(.*\)")/\1/' | sort -u > /tmp/fe.txt
grep -o 'Subject = "[a-zA-Z]*"' BlueDental.BE/src/BlueDental.Domain.Shared/Permissions/BlueDentalAbilityPermissions.cs | sed 's/Subject = "\(.*\)"/\1/' | sort -u > /tmp/be.txt
comm -23 /tmp/fe.txt /tmp/be.txt
```

### Kiểm thử

Chạy thật trên dev server :5173 + API :5019 + DB thật, đăng nhập qua màn hình
login (không nhét token): nút hiện lại trên tab Kế hoạch điều trị, bấm vào mở
đúng dialog **"Tạo phiếu dịch vụ"**. Quét lại toàn bộ: không còn subject nào
giao diện gọi mà backend không có. `tsc -b --noEmit` sạch.

## 2026-09-22 (đợt 14) — Rà hết phân quyền của màn Bệnh nhân

Sau R-467, soát **toàn bộ** chỗ giao diện đọc quyền trong phạm vi hồ sơ bệnh
nhân: 24 subject giao diện gọi, đối chiếu từng nút với `[Authorize]` của đúng
endpoint mà nút đó bắn. Cách soát: dựng bảng *method → quyền* cho mọi
`*AppService` liên quan, rồi lần ngược từ nút → mutation → endpoint.

Hai điều phải biết trước khi đọc bảng dưới:

- **Không có tên `Delete` ở lớp quyền cũ.** `BlueDentalPermissions
  .TreatmentManagement.TreatmentPlans` chỉ có `View` / `Create` / `Edit` /
  `Approve`, `CustomerCare` chỉ có `View` / `Create` / `Manage`. Nên
  `DeleteAsync` của phiếu tư vấn, chẩn đoán và CSKH đều gác bằng **Edit /
  Manage**, và cầu nối quy chúng về `.update`. Lá **`.delete`** của
  `treatmentConsultation` / `treatmentDiagnosis` / `treatmentCskh` trên màn
  Phân quyền **không được server đọc ở đâu cả** — xem "Còn treo".
- **Cầu nối là "bất kỳ lá nào"**, không phải "đủ mọi lá": một quyền cũ coi như
  được cấp khi **một** trong các lá nó liệt kê được cấp. Nên gate của tab
  Chẩn đoán & Tư vấn phải là *hoặc*, không phải *và*.

### Tab bị thiếu hẳn gate đọc

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-468 | Tab **Lịch sử dư nợ** không ẩn khi thiếu `payment.read`, trong khi tab **Hóa đơn** — cùng một quyền — thì có. Mở tab là 403 | Cùng gate với Hóa đơn |
| R-469 | Tab **Kế hoạch điều trị** không ẩn khi thiếu `treatmentConsultation.read`, dù `GET patient-treatments` kiểm đúng lá đó | Ẩn theo `treatmentConsultation.read` |
| R-470 | Tab **Chẩn đoán & Tư vấn** không ẩn khi không đọc được gì | Ẩn khi **cả ba** lá đọc (`treatmentStage` / `treatmentDiagnosis` / `treatmentConsultation`) đều thiếu — đúng ngữ nghĩa "bất kỳ" của cầu nối |

### Nút hiện ra rồi mới bị server từ chối

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-471 | Nút xoá phiếu chẩn đoán gác bằng `treatmentDiagnosis.delete`, server đọc `TreatmentRecords.Edit` ← `.update` | Gác bằng `.canUpdate` |
| R-472 | Nút xoá phiếu tư vấn gác bằng `treatmentConsultation.delete`, server đọc `TreatmentPlans.Edit` ← `.update` | Gác bằng `.canUpdate` |
| R-473 | Nút xoá phiếu CSKH gác bằng `treatmentCskh.delete`, server đọc `CustomerCare.Manage` ← `.update` | Gác bằng `.canUpdate` |
| R-474 | **"Tạo Tái khám"** gác bằng `treatmentStage.create`, nhưng `POST patient-re-examinations` đọc `treatmentStage.complete` — tái khám đi sau một công đoạn đã xong, nên là quyền *hoàn thành* chứ không phải *thêm* | `can("complete")` |
| R-475 | Cột thao tác của bảng **Công đoạn điều trị** gác bằng `treatmentStage.update`, nhưng hai nút trong đó là **Tiếp tục** (`.continue`) và **Hoàn thành** (`.complete`) — `.update` không gác cái nào | Mỗi nút theo lá của nó; cột chỉ hiện khi còn ít nhất một nút |
| R-476 | Tab **Thanh toán** của phiếu điều trị chỉ gác nút *Tạo Phiếu Thanh Toán*; hai thao tác trên dòng — **Chỉnh sửa** (`payment.update`) và **Huỷ** (`payment.delete`) — không gác gì, ai đọc được phiếu cũng thấy | `onEdit` / `onCancel` thành optional, truyền theo đúng lá; bản thẻ ≤640 vốn đã optional sẵn |
| R-477 | Bảng **dịch vụ** của phiếu điều trị không gác gì: menu trạng thái (Hoàn thành / Chuyển đổi / Hủy dịch vụ), ô thêm dịch vụ và kéo thả đều hiện với người chỉ có quyền đọc. Cả năm thao tác đều là `treatmentConsultation.update` | Một cờ `canEditLines` cho cả năm; dòng không còn lệnh nào thì pill in ra chữ thường như dòng đã đóng |

### Đã soát và **đúng** (không đụng)

`patient.update` (sửa hồ sơ) · `appointment.create/update/delete` (tab Lịch hẹn)
· `patientMedicalRecord.create/update/delete` (Bệnh án) · `prescription.*` (Đơn
thuốc) · `treatmentImage.create/update/delete` (`usePatientImagePermissions`) ·
`payment.create` (Thu tiền, Tạo phiếu thanh toán, Hoàn tiền) ·
`treatmentLabo.create` (Labo: *Tiếp tục quy trình* và *Bảo hành* đều **tạo
phiếu mới**, nên `.create` là đúng).

### Kiểm thử

Spec mới `e2e/patient-permission-gates.spec.ts` — thật từ đầu đến cuối: admin
tạo nha sĩ qua dialog Nhân sự, bật từng lá trên màn Phân quyền, nha sĩ đăng
nhập ở **phiên cookie riêng**, không nhét token, không chặn API nào.

Bốn bước, mỗi bước một lá: chỉ `patient.read` → hồ sơ mở được nhưng **không**
có Hóa đơn, Lịch sử dư nợ, Kế hoạch điều trị, Chẩn đoán & Tư vấn; thêm
`payment.read` → **cả hai** tab tiền hiện ra; thêm `treatmentConsultation.read`
→ hai tab phiếu hiện, vẫn **chưa** có "Tạo kế hoạch mới"; thêm
`treatmentConsultation.create` → nút hiện.

Một chỗ suýt sai khi viết spec, ghi lại: lấy hồ sơ bằng `page.request.get`
**không dùng được** — chỉ axios của ứng dụng mới gắn `X-Clinic-Branch-Id`, gọi
thô thì danh sách theo chi nhánh trả 403 bất kể quyền. Phải lấy qua trang thật.

Trên bản build production (`vite preview` :8080, API :5019, DB thật):
`patient-permission-gates` **1/1**, `treatment-plan-detail` **11/11**,
`treatment-plan` **8/8** — 20/20. `patient-permission-gates` cũng chạy lại trên
dev :5173 (StrictMode) và xanh. `tsc` sạch, lint chỉ còn warning ở file không
liên quan.

### Hai bộ đỏ **không** do đợt này — đã đo để loại trừ

- `role-permissions-abilities` đỏ ở chốt R-405: `GET insurance-claims` trả
  **500**. DB dev **chưa chạy** migration `20260922100000_AddInsuranceClaimBranchId`
  mà merge mang về — truy vấn `information_schema.columns` cho `BranchId`
  của `AppInsuranceClaims` trả 0, và `__EFMigrationsHistory` không có bản ghi
  đó. Chạy DbMigrator là hết; chưa màn hình nào gọi endpoint này.
- `consulting-plan` đỏ 2 ca ("…and one comes off the total", "signature
  strip"). Ban đầu **tưởng** do đợt này: baseline xanh 13/13, bản sửa đỏ. Đo
  tiếp mới ra: khoảng trống chữ ký đọc được 15.5 → 19.0 → 12.4 → 920.9 qua các
  lượt, tức là **theo dữ liệu**, không theo mã. Probe xác nhận lúc đo chỉ có
  **một** tờ (`dx-visible 1, cols 2`), nên không phải chồng hai bản in. Cất
  toàn bộ thay đổi đi (`git stash`), build lại **baseline** và chạy lại: baseline
  **cũng đỏ đúng hai ca đó**. Kết luận: dữ liệu của DB dev đã trôi sau nhiều
  lượt chạy spec này lên cùng một hồ sơ seed; tờ in dài ra thì dải chữ ký bị
  ép. Không sửa spec trong đợt này — cần seed lại rồi đo, xem "Còn treo".

### Còn treo

- **Lá `.delete` của ba subject kia là lá chết.** `treatmentConsultation
  .delete`, `treatmentDiagnosis.delete`, `treatmentCskh.delete` bật hay tắt
  đều không đổi gì, vì lớp quyền cũ không có tên `Delete` để gác. Giao diện
  nay bám theo đúng cái server đọc (`.update`), nên **không còn 403**, nhưng
  người quản trị tick "Xoá" thì vẫn không có tác dụng. Sửa cho đúng là việc
  **backend**: thêm `TreatmentPlans.Delete` / `TreatmentRecords.Delete` /
  `CustomerCare.Delete`, nối cầu sang `.delete`, rồi đổi `[Authorize]` của
  `DeleteAsync`. Việc này **siết** quyền lại (ai đang chỉ có `.update` sẽ mất
  quyền xoá) nên chờ chủ dự án quyết.
- **`PatientAppService.ExportAsync` gác bằng `Patient.Read`**, không phải
  `Patient.Export`. Giao diện vẫn ẩn nút "Xuất file" theo `patient.export`
  (chặt hơn, không gây 403), nhưng ai đọc được danh sách thì gọi thẳng
  endpoint vẫn xuất được cả danh sách bệnh nhân. Cần chốt.
- `consulting-plan` cần **seed lại dữ liệu** rồi chạy lại để chốt hai ca đỏ ở
  trên; hai ca đó đo theo chiều dài tờ in nên phải chạy trên dữ liệu sạch.

## 2026-09-23 — Đã đăng nhập nhưng mở lại /login thì đứng ở trang login

Chủ dự án báo: "đã login rồi nhưng khi vào lại thì nó vẫn ở trang login".

Đo trước khi sửa — gọi thẳng API **từ chính trang `/login`** đang hiện form:

```
GET /api/v1/app/account/current-user  →  200 OK,  userName: "admin"
```

Nên **không phải mất phiên**. Cookie còn nguyên và server vẫn nhận. Router chỉ
bảo vệ **một chiều**: `PrivateRoute` đá người chưa đăng nhập ra `/login`, còn
`/login` thì render `LoginPage` vô điều kiện, không ai hỏi phiên hiện tại.

Không đọc phiên từ auth store được: store **không persist**, nó rỗng cho tới khi
`PrivateRoute` đổ vào — mà `PrivateRoute` không chạy trên route này. Guard phải
tự hỏi server.

Đây **không phải lỗi mới**: bản trước commit phân quyền (`3747b2c^`) route
`/login` cũng y hệt. Chỉ là mở thẳng URL `/login` sau khi restart server thì mới
gặp.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-478 | `/login` render form cho cả người đang có phiên hợp lệ → mở lại URL đăng nhập là kẹt ở đó | `PublicOnlyRoute` bọc route `/login`: hỏi `current-user` dưới **đúng** `queryKey` mà `PrivateRoute` dùng (vào từ trong app thì đọc cache, không tốn request; mở nguội mới gọi một lần), 200 thì `Navigate` về `state.from` nếu có, không thì `/`. Trong lúc kiểm hiện spinner "Đang xác thực phiên đăng nhập" như `PrivateRoute`, để người đã đăng nhập không thấy form loé lên |

401 ở đây là ca bình thường và **không** gây nhiễu: interceptor của `lib/axios`
chỉ `clearAuth()` chứ không điều hướng khi đang ở `/login`, cũng không toast.

### Kiểm thử

Thật trên dev server :5173 + API :5019 + DB thật, đăng nhập qua màn hình login,
không nhét token:

| Tình huống | Kết quả |
|---|---|
| Đang đăng nhập, mở `/login` | vào thẳng `/dashboard`, không còn form |
| Đăng xuất rồi mở `/login` | `current-user` 401, form hiện bình thường |
| Điền form đăng nhập | vào `/dashboard` như cũ |

Thêm một ca vào `e2e/auth.spec.ts` giữ **cả hai** chiều. `auth` **5/5** trên
:5173 (có StrictMode — bản dev mới là bản chặt hơn cho loại lỗi này). `tsc`
sạch, lint không phát sinh gì mới. **Chưa** chạy trên bản build production: làm
vậy phải bật thêm một preview server trong khi chủ dự án đang tự chạy máy.

## 2026-09-23 (đợt 2) — i18n trang Bệnh nhân, và hậu quả của đợt đổi key hàng loạt

Rà soát đầy đủ ở [i18n-audit-patient.md](i18n-audit-patient.md). Phạm vi gồm 386 file đi tới được từ `/patient`,
`/patient/:id` và `/patient/:id/treatment-plan/:planId`.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-479 | 14 key namespace (`Patient:VoucherCount`, `Patient:Diagnosis:PrintTitle`, `Patient:Image:DayCount`…) được code dùng nhưng không có trong `vi.json` lẫn `en.json` → hiện key thô ở **cả hai** ngôn ngữ | Thêm entry; giá trị `vi` lấy đúng câu gốc từ diff `2eec1e9e` |
| R-480 | `dayjs().format("Patient:Misc:DateFormat")` (6 chỗ) — đợt đổi key thay luôn chuỗi định dạng ngày → in rác `Pamtient:8i0c:…`; `PatientMedicalRecordTab` còn **lưu** chuỗi rác vào tờ bệnh án | Khôi phục `"DD/MM/YYYY"` / `"DD/MM/YYYY HH:mm:ss"` |
| R-481 | ~150 nhãn còn là `t("câu tiếng Việt")` hoặc tiếng Việt viết cứng (ô tiền, bộ lọc, cột, trạng thái labo/lịch hẹn, tab kế hoạch, `VNĐ`, "Thu Ngân / Bác Sĩ", nút −/+ tờ bệnh án, tab `BG n`…) → English vẫn hiện tiếng Việt | Đổi sang key namespace (140 key mới, `vi` = câu gốc). Số tiền bằng chữ đọc tiếng Anh khi giao diện là English |
| R-482 | `Common:ConfirmDelete` / `Common:PleaseEnter` có `{0}` nhưng gọi không tham số → hiện "Xác nhận xoá {0}", "Vui lòng nhập {0}" | Key riêng mang đúng câu gốc (`Treatment:Service:DiscardTitle/Question`, `Common:PleaseEnterPlain`) |
| R-483 | Giới tính ở English ra "Male" / "Nữ" (chỉ `"Nam"` có bản dịch) | Dùng `Common:Gender:*` ở cả 3 map |
| R-484 | `planCardRows.tsx` import `t` thừa → `tsc -b` đỏ, CI Typecheck của `890c266a` fail | Bỏ import |
| R-485 | Sau `2eec1e9e` + `890c266a`, giá trị `vi` của 89 key khác câu gốc mà chúng thay ("Tạo hồ sơ" → "Tạo bệnh nhân", tab "Kế hoạch điều trị" → "Kế hoạch", "Phân loại theo Tag" → "Nhãn", tờ in chẩn đoán ghi mục II là "I. HÌNH ẢNH CHẨN ĐOÁN") | Đưa giá trị `vi` về câu gốc, viết lại `en` theo cùng nghĩa |
| R-486 | Key dùng chung bị gán cho những chỗ vốn ghi câu khác ("Huỷ"/"Hủy", "Xong"/"Đóng", bộ lọc thẻ báo "Không tìm thấy bác sĩ", pill "Hủy dịch vụ"/"Chuyển đổi" lấy nhãn "Đã huỷ"/"Đã thay thế" của API) | 46 vị trí sang key riêng (12 key mới, còn lại dùng lại key sẵn có đúng câu); giá trị key dùng chung giữ nguyên |
| R-487 | `ConvertStaffBox` mất tham số: `t("Thêm {0}", label)` bị đổi thành `t("Common:Add")` | `Treatment:Convert:AddStaff` / `RemoveStaff` có `{0}` |

Giữ tiếng Việt ở cả hai ngôn ngữ theo quyết định của chủ dự án: 9 mẫu tờ bệnh án in và tên của chúng.
Tên cũng là tiêu đề được lưu khi tạo tờ, nên bỏ `t()`.

Trong phạm vi trang này không còn câu nào lệch so với câu gốc. Ngoài phạm vi còn 64 vị trí **chưa sửa** (lịch hẹn, báo cáo, CSKH,
vận hành, và `TaxonomyPage.tsx:411`) — xem §I.3 của báo cáo.

### Kiểm thử

Bản build production, BE build từ working tree, PostgreSQL local thật, đăng nhập qua màn hình login. Chạy trên cổng riêng
(FE 8081 → BE 5020) để không đụng phiên 5173/5019 của chủ dự án. Mốc so sánh là HEAD `890c266a`, cũng build
production (8082 → BE 5021), chạy cùng 17 file spec (167 test):

| Bản | Xanh | Đỏ | Không chạy |
|---|---|---|---|
| HEAD `890c266a` | 100 | 44 | 23 |
| Sau R-479…R-484 | 103 | 41 | 23 |
| Sau R-485…R-487 | **159** | **8** | 0 |

- 0 test đỏ mới.
- 3 test hết đỏ: `patient-medical-record` "picking the day prints it on the sheet" (R-480),
  `consulting-plan` "both printed sheets end on the reference's signature strip", `patient` "records tooth surfaces".
- Sau R-485…R-487: 7/8 test đỏ còn lại cũng đỏ ở HEAD và không liên quan chữ. Đó là voucher picker không có dòng có giá,
  cột labo hiện "—", bảng màu viewer có 2 nút đang bấm, 2 test ảnh đỏ theo test trước trong cùng nhóm, đăng nhập lần 2 bằng
  tài khoản chi nhánh, và lưu đổi bác sĩ lịch hẹn. Chưa điều tra.
- Test thứ 8, `patient-medical-record` "the index lists the reference's nine forms…", **phụ thuộc thứ tự**: nó mở bệnh nhân đầu danh sách.
  Ở HEAD, test đăng ký bệnh nhân đỏ nên bệnh nhân đầu vẫn là người có sẵn tờ bệnh án. Nay test đăng ký chạy được, bệnh nhân mới
  (chưa có tờ) lên đầu, nên ô chọn bác sĩ không hiện. Chạy riêng file: lần đầu 21/22, lần sau 22/22.
- Taxonomy + payment-qr + branch (42 test, bản production): 38 xanh / 4 đỏ, **trùng khớp HEAD** (4 test đỏ ở cả hai bản).

Quét DOM runtime: ở English chỉ còn dữ liệu và 9 tên biểu mẫu là tiếng Việt; ở tiếng Việt có 0 key thô và 0 lỗi JS.
Kiểm tra tay ở English trên dev server :5174 (StrictMode): nút voucher, tiêu đề in chẩn đoán, đoạn giải thích mặc định,
tab kế hoạch, số tiền bằng chữ. `tsc -b`, `npm run lint` và `npm test` đều xanh.


## 2026-09-24 — Mẫu Labo: cột Thao tác và ba dialog (Xem / Tiếp tục công đoạn / Bảo hành)

Chủ dự án chụp màn `/labo/mau-labo` trên staging: bảng thiếu cột thao tác, và
ba dialog mở từ hàng (Xem chi tiết, Làm tiếp công đoạn, Bảo hành) "chưa giống".
Rà lại trên staging (được phép bấm) tới từng điều khiển, đo computed style.

| ID | Sai lệch | Sửa |
|---|---|---|
| R-500 | Bảng Mẫu Labo có 9 cột, ô Thao tác chỉ một nút mắt; staging có **11** cột (thêm Mã phiếu labo, Phiếu điều trị) và **ba** nút: mắt "Xem", dấu cộng "Tiếp tục công đoạn", khiên "Bảo hành" | `laboOrderColumns.tsx` dựng đủ 11 cột; `LaboRowActions` dùng chung với tab Labo của bệnh nhân, thêm `detailLabel` để mắt tên "Xem" ở đây và "Xem chi tiết" ở tab |
| R-501 | Không rõ khi nào staging ẩn dấu cộng | Đối chiếu 20 hàng staging với JSON: ẩn **khi và chỉ khi** `treatmentService.status === "done"`. Local: DTO thêm `treatmentServiceStatus`, `canContinueLaboOrder` ẩn khi `=== 3` (Completed) |
| R-502 | Dialog Tiếp tục công đoạn / Bảo hành mở từ Mẫu Labo còn mang ba pill và ô chọn phiếu cha của tab bệnh nhân; staging mở thẳng vào form với hàng là phiếu cha | Tách `LaboChildDialog` (không pill, không picker) khỏi form dùng chung; cả bộ dialog dời sang `features/labo/components/order-dialogs/`, tab bệnh nhân import lại từ đó. Mở qua `?laboModal=…&laboRowId=` như tab |
| R-503 | Modal "Thông tin chung" ở Mẫu Labo chỉ đọc (Đóng); staging có select Trạng thái 5 giá trị, ô Tải ảnh có xoá, "Tạo Lịch Hẹn Mới", "Lưu" | `LaboDetailDialog` thêm `editable` (theo `canUpdate`): `LaboStatusSelect`, `LaboPictureWell`, `AppointmentEditorModal` điền sẵn bệnh nhân + bác sĩ, Lưu = **một** `PUT …/labo-orders/{id}/detail` multipart (`status`, `keepImageIds[]`, `pictures[]`). Tab bệnh nhân giữ Đóng |
| R-504 | `LaboStatus` chỉ 6 giá trị, thiếu Giao trễ / Đã thay thế của select | Thêm `LateDelivery = 7`, `Replaced = 8`; `ChangeStatus` từ chối huỷ phiếu không còn "Đơn hàng mới" bằng `Labo:0012`, FE chặn trước bằng toast "Chỉ được huỷ đơn hàng mới" như staging |
| R-505 | Ảnh phiếu Labo không có chỗ đứng: `PatientImage` không biết phiếu nào | Cột `LaboOrderId` + migration `20260923172959_AddLaboOrderIdToPatientImages`; DTO trả `images[] {id,url,fileName}`, cột "File phòng khám gửi về" và ô Tải ảnh cùng đọc từ đó |
| R-506 | Ô "Tên khách hàng" của dialog con là `Input` disabled thường; staging là **picker** bị khoá (kính lúp, chevron, chữ xám 50%) | `LaboChildHeader` dùng `SearchSelect disabled` với option `code - name` |
| R-507 | Ô nhập bị khoá hiện mực AntD 25% trên nền trong; staging chữ rgb(90 107 130) đậm đủ, nền `#f3f6fa`, viền `#cbd5e1`, opacity 1 | Rule `.pd-labo-dialog .ant-input-disabled` + `.ss-wrapper--disabled .ss-trigger` trong `labo-order-dialog.css` |
| R-508 | Rule màu cho giá trị picker khoá đặt ở `.ss-value` **không ăn** | Span con `.ss-value--selected` có rule màu riêng đè lên — phải nhắm thẳng `.ss-value--selected` |
| R-509 | "Chọn tất cả" hiện ô tick trước chữ, 14px; staging chữ trước ô 20×20, 13px, cách 8 | `.pd-labo-select-all { flex-direction: row-reverse }`, bỏ padding-inline-start của span chữ |
| R-510 | Tóm tắt "Dịch vụ hiện tại / Vật liệu" dính sát radio (12/4px); staging 24 trên, 16 giữa hai dòng, giá trị cách nhãn 16 | Giá trị bọc `<span>`; `.pd-labo-summary` mt 24, `p + p` 16, `span` ml 16 |
| R-511 | Nhãn "Giờ gửi" / "Giờ nhận" rớt vào trong ô khi trống; staging nhãn luôn nổi trên viền, trong ô là gợi ý `HH:mm` | `FloatingField` thêm `alwaysFloat` (giữ placeholder của control), hai `TimePicker` dùng nó với `placeholder="HH:mm"` |

Cố ý giữ khác: tiêu đề modal 16px (quy ước app, `patient-detail.md`), màu nhấn
indigo thay vì xanh staging (chủ dự án 2026-09-07). Chưa đo được: tone badge
Giao trễ / Đã thay thế (staging không có phiếu nào ở hai mã đó) — ghi ở
`unknowns.md`.

### Kiểm thử

Thật, không chặn API, không nhét token: bản build production
(`vite preview` 127.0.0.1:8080, `dist-preview`) + host API :5000 + PostgreSQL
thật; đăng nhập qua màn login. Chạy đủ bốn spec Labo, **17/17 xanh** (2,4 phút):

| Spec | Ca | Kết quả |
|---|---|---|
| `e2e/labo-orders-actions.spec.ts` (mới) | 11 cột, link bệnh nhân + kế hoạch, ba nút (mắt "Xem"), dấu cộng ẩn theo dòng dịch vụ; dialog Tiếp tục: picker khoá `code - name`, `.ss-wrapper--disabled`, "Giờ nhận" nổi + `HH:mm` + rỗng; dialog Bảo hành; modal chi tiết: đổi trạng thái + thêm 2 ảnh + xoá 1 → Lưu → reload → đọc lại từ API và bảng | 2/2 |
| `e2e/labo-detail.spec.ts` | tab bệnh nhân: modal chỉ đọc, phiếu in | xanh |
| `e2e/labo-warranty.spec.ts` | Đặt mới rồi Bảo hành từ hàng, mã cha giữ nguyên | xanh |
| `e2e/labo.spec.ts` | 6 sub-route Labo, tìm kiếm server-side, lọc kỳ | xanh |

Đối chiếu computed style local vs staging sau khi build lại: bốn ô khoá và
trigger picker cùng rgb(90,107,130) / rgb(243,246,250) / rgb(203,213,225),
opacity 1; giá trị picker rgba(90,107,130,.5) weight 400; hàng Răng gap 12, chữ
trước ô 20×20; chip min-w 36, padding 4/13, radius 4; tóm tắt mt 24 / 16 / ml
16. Ảnh: `reference-private/survey/local/labo-mau-labo-{continue,warranty,detail}-dialog-local-2026-09-24*.png`
so với `reference-private/survey/staging/labo-mau-labo-*-dialog-2026-09-23.png`.

**Chưa có** test host cho `SaveDetailAsync` ở BE (chỉ được phủ qua spec
Playwright ở trên). Host API :5000 là tiến trình của chủ dự án, đã nạp BE mới
từ đợt trước; không khởi động lại trong đợt này.

## 2026-09-24 — Mẫu Labo: rà lại từng field, i18n và API (sau R-500..R-511)

Chủ dự án: "check kỹ lại từng field, i18n đã handle hết chưa? api nữa check
kỹ với". Rà `laboApi.ts`, ba dialog, `ILaboAppService` / `LaboAppService` /
`LaboOrder` và bảng khoá locale `reference-private/survey-labo/locale-labo-keys.json`.

| ID | Sai lệch | Sửa |
|---|---|---|
| R-512 | 3 nhãn loại phiếu (`LABO_KIND_CONFIG`) và 8 nhãn trạng thái (`LABO_STATUS_CONFIG`) là chuỗi tiếng Việt cứng — chế độ English vẫn hiện tiếng Việt | Khoá `Patient:Labo:Sample:New/Continue/Warranty` và `Patient:Labo:Status:Draft…Replaced` trong `vi.json` + `en.json`; chữ Việt giữ nguyên nên các assert e2e không đổi |
| R-513 | Câu "Ngày {0} tháng {1} năm {2}" trên phiếu in ghép cứng trong `LaboPrintSheet` | Khoá có tham số `Patient:Labo:LongDate` (en `{0}/{1}/{2}`) |
| R-514 | "Giờ nhận" nhập trên dialog nhưng chỉ ngày được gửi đi: DTO/entity là `DueDate: DateOnly`, giờ bị vứt; cột, tóm tắt, phiếu in chỉ có ngày trong khi staging hiện `DD/MM/YYYY HH:mm` | `DueDate` → `DueAt: DateTimeOffset?` trên entity, 3 DTO, 2 seeder; FE `stamp(dueDate, dueTime)` gộp thành một ISO như `sentAt`; cột, facts, print, Excel qua `formatDateTime`; migration `20260923232410_RenameLaboDueDateToDueAt` viết tay `RenameColumn + AlterColumn` (ngày cũ giữ ở 00:00, không DropColumn mất dữ liệu) |
| R-515 | Luật staging `labo.validation.expectedDateTimeAfterSent` không có ở local: nhận trước gửi vẫn lưu được | FE `dueAfterSentRule` trên cả Ngày nhận dự kiến và Giờ nhận (`dependencies` bốn ô ngày/giờ); BE `LaboOrder.SetDueAt` ném `Labo:0013 DueBeforeSent` ở ctor, `CreateChild` và `Update` — khoá lỗi vi/en |
| R-516 | `PUT …/labo-orders/{id}/detail` nhận **mọi** `LaboStatus`: gửi `status=2` (Sent) là qua mặt guard của Send / Receive / Complete | `ChangeStatus` chỉ nhận 5 giá trị của select (Draft, Received, Rejected, LateDelivery, Replaced), giá trị khác → `Labo:0002`; Received qua dialog đóng dấu `ReceivedAt` nếu chưa có |
| R-517 | Mọi endpoint theo id (`GET {id}`, `PUT {id}`, `PUT detail`, send / receive / complete / reject) nạp phiếu **không kiểm tra chi nhánh** — chỉ danh sách được lọc | `GetInBranchAsync` gọi `BranchAccessChecker.CheckAsync(order.BranchId)` trước mọi thao tác theo id |
| R-518 | Bỏ ảnh trong dialog chi tiết chỉ xoá dòng `PatientImage`; blob MinIO nằm lại | `SaveDetailAsync` nạp các ảnh bị bỏ, `DeleteManyAsync` rồi `IBlobContainer.DeleteAsync(BlobName)` từng ảnh |
| R-519 | `labo-warranty.spec.ts:315` đỏ sau R-510: assert `"Dịch vụ hiện tại: <nhóm>"` nhưng nhãn và giá trị giờ là hai phần tử (`<b>` + `<span>` cách 16px) nên text ghép không có khoảng trắng | Spec đọc từng dòng `.pd-labo-summary > p`: nhãn `toContainText`, `span` `toHaveText` |

Đã rà mà đúng sẵn: nhãn 14 ô của dialog con, thông báo bắt buộc
(`Patient:Labo:*` ↔ `labo.validation.*` của staging), toast tạo / cập nhật,
tiêu đề tab, cột bảng, sheet in — tất cả đã qua `t()` từ các đợt trước.

### Kiểm thử

- Domain `LaboOrderTests` 16/16 (thêm 6: due giữ giờ; due ≤ sent bị từ chối ở
  ctor và ở `Update`; `ChangeStatus` từ chối Sent / InProgress / Completed; chỉ
  huỷ phiếu mới; 5 giá trị dialog nhận được từ Draft). Contract 11/11
  (`SaveDetailAsync` có trên interface; `DueAt` là `DateTimeOffset?` trên 3
  DTO, `DueDate` không còn).
- Host build lại; DbMigrator **phải build lại trước** — lần đầu chạy
  `--no-build` là dll cũ, "Successfully completed" nhưng migration không áp,
  host 500 `column b.DueAt does not exist`. Chạy lại sau build: migration áp
  lên DB :5432, host mới trên :5000.
- HTTP thật bằng cookie đăng nhập: `PUT detail status=2` → 422 `Labo:0002`;
  `status=4` → 200, `receivedAt` được đóng dấu; `status=6` từ Received → 403
  `Labo:0012`; `PUT {id}` với `dueAt` trước `sentAt` → 403 `Labo:0013`, message
  tiếng Việt với `Accept-Language: vi`. `GET labo-orders` trả `dueAt`
  `2026-10-01T00:00:00+00:00` cho phiếu có ngày cũ (giữ nguyên ngày).
- Playwright bản build production (:8080, host :5000, không chặn API):
  `labo-orders-actions` 2/2, `labo-detail`, `labo-warranty`, `labo` — **20/20**.
- `tsc --noEmit`, eslint (labo, patient labo tab, `useLaboPickers`) xanh.

### Còn treo

- Excel "Ngày nhận dự kiến" xuất `DueAt.DateTime` theo UTC (cùng cách export
  hoá đơn); "Mẫu chưa nhận" quá hạn tính theo ngày UTC (giữ ngữ nghĩa cột ngày
  cũ).
- Cross-branch 403 chưa đo bằng HTTP (admin thấy mọi chi nhánh) — dựa vào
  `BranchAccessChecker` dùng chung đã có test ở `branch-*`.
- Vẫn chưa có host test cho `SaveDetailAsync`; `statusClinic` chưa dựng.

## 2026-09-24 — Mẫu Labo: "File phòng khám gửi về" mở chậm ~2 giây

| # | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-520 | Bấm folder "File phòng khám gửi về" (và mọi ảnh bệnh nhân, avatar, logo Labo) chờ ~2,3 giây mới hiện, kể cả file 70 byte; `GET /api/v1/app/patient-images/{id}/content` đo bằng curl: ttfb 2,26–2,29 s cho mọi kích thước | Không phải ảnh nặng. `BlobStorage:Endpoint` = `localhost:9000`; trên Windows `localhost` phân giải `::1` trước, MinIO trong Docker chỉ bind `127.0.0.1:9000`, kết nối `[::1]:9000` treo đúng ~2,02 s rồi mới rơi về IPv4 — HttpClient của Minio SDK thử tuần tự nên mỗi lần đọc blob trả giá 2 s (curl nhanh vì Happy Eyeballs). Đổi endpoint thành `127.0.0.1:9000` ở `HttpApi.Host/appsettings.json` và `DbMigrator/appsettings.json`: cùng ảnh còn 0,02 s. Docker compose dùng `minio:9000` nên prod không bị. |

### Kiểm thử

- curl có cookie đăng nhập, cùng 3 ảnh (324 KB, 465 KB, 70 B): host cũ
  (`localhost:9000`) 2,26–2,29 s mỗi request; host chạy lại với
  `127.0.0.1:9000` 0,02–0,03 s (lần đầu 0,29 s do mở kết nối).
- `curl http://[::1]:9000/minio/health/live` → 2,02 s rồi lỗi;
  `127.0.0.1:9000` → 0,002 s. `getaddrinfo('localhost')` trả `::1` trước.

### Còn treo

- Endpoint content trả `Content-Type: application/octet-stream` và không có
  `Cache-Control`, nên mở lại cùng ảnh vẫn tải lại; nên trả `image.ContentType`
  và `private, max-age` (đổi contract `GetContentAsync` sang `IRemoteStreamContent`).
- Provider Minio của ABP đọc trọn blob vào `MemoryStream` trước khi trả về, nên
  ảnh điện thoại nhiều MB vẫn sẽ có TTFB bằng thời gian tải xong từ MinIO.

## 2026-09-24 — Mẫu Labo: đóng các mục "còn treo" của đợt rà (R-512..R-519)

Chủ dự án hỏi "những cái này có cái nào b handle được" về bốn mục còn treo.
Ba mục xử lý được ngay; `statusClinic` cần khảo sát staging riêng (xem cuối).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-521 | Excel "Mẫu Labo" xuất tiêu đề **khoá thô** `BE:Field:RecordNo`, `BE:LaboField:DueBack`… thay vì "Mã phiếu", "Hẹn trả" — cả qua curl `Accept-Language: vi` lẫn qua phiên đăng nhập của trình duyệt; export hoá đơn (`/api/v1/app/invoices/excel`) cũng vậy | `LaboAppService : ApplicationService` không đặt `LocalizationResource`, nên `L[...]` đi qua đường "default resource" của ABP — trên host này đường đó trả về đúng cái khoá dù `AbpLocalizationOptions.DefaultResourceType = BlueDentalResource` và `/api/abp/application-localization` vẫn dịch được cùng khoá. Gán tường minh `LocalizationResource = typeof(BlueDentalResource)` trong ctor: tiêu đề thành "Mẫu Labo, Mã phiếu, Khách hàng, Nhà cung cấp, Răng, Hẹn trả, Chi phí, Trạng thái, Trễ hẹn". Sáu service khác cùng kiểu (Invoice, SalesEntry, OperationsReport, Patient, ClinicReport, PatientTreatment) **chưa sửa** — xem Còn treo. |
| R-522 | Cột "Hẹn trả" trong Excel ghi giờ UTC; "Mẫu chưa nhận" tính quá hạn theo nửa đêm UTC, tức 07:00 sáng giờ phòng khám | Theo quy ước sổ hẹn (`AppointmentAppService`): `ClinicUtcOffset = +7`. `StartOfToday()` lấy nửa đêm của ngày UTC+7 rồi đổi về UTC (Npgsql timestamptz cần offset 0); Excel ghi `DueAt.ToOffset(+7).DateTime`. Đo: phiếu hẹn 02:30Z → ô Excel `46291.3958` = 26/09/2026 09:30. |
| R-523 | Cross-branch 403 chưa đo bằng HTTP | `e2e/labo-api.spec.ts` (HTTP thật từ trang đã đăng nhập, cookie + `RequestVerificationToken`, không chặn): tài khoản `branch2` đọc `GET {id}` phiếu chi nhánh 1 → 403, `PUT {id}/detail` → 403, `GET labo-orders` không chứa id; phiếu vẫn `status=1` sau lượt ghi bị từ chối. |
| R-524 | Chưa có host test cho `SaveDetailAsync` | Cùng spec, qua pipeline thật: `status=2` → 422 `Labo:0002`; `status=4` → 200 + `receivedAt`; `status=6` sau đó → 403 `Labo:0012`; thêm 2 ảnh PNG multipart → `images` 2, mỗi `/content` 200; `keepImageIds=[ảnh 1]` → còn 1, ảnh bỏ trả 403 `Patient:0008` ("Không tìm thấy ảnh" — quy ước F-24, không phải 404), MinIO `ls -R` không còn blob của ảnh bỏ, blob giữ vẫn còn; `dueAt` trước `sentAt` → 403 `Labo:0013`, `dueAt` hợp lệ giữ nguyên giờ khi đọc lại. |

### Kiểm thử

- `labo-api` 4/4; toàn bộ `e2e/labo*` **24/24** trên bản build production
  (:8080, host :5000 build lại sau R-521/R-522, không chặn API). Một lần
  `labo-orders-actions` đỏ trong lượt chạy gộp rồi xanh 2/2 khi chạy riêng và
  xanh trong lượt gộp chạy lại — chưa bắt được thông báo lỗi, ghi nhận là
  chập chờn.
- Domain.Tests Labo 16/16, Application.Tests Labo 35/35. `tsc`, eslint xanh
  (spec mới sửa một `no-useless-assignment`).
- `export.spec.ts` 1/3 và `report.spec.ts` "Doanh số" đỏ vì locator
  `Chưa phát sinh` và nhãn "Phương thức thanh toán" → "Hình thức" sau đợt đổi
  key hàng loạt của chủ dự án — ngoài phạm vi labo, không sửa.

### Còn treo

Cả ba mục dưới đã đóng cùng ngày ("làm luôn đi") — xem R-525..R-529.

- ~~Sáu app service khác dùng `L[...]` mà không đặt `LocalizationResource`~~ → R-525.
- ~~Cột "Trạng thái" của Excel labo ghi tên enum tiếng Anh~~ → R-526.
- ~~`statusClinic` chưa dựng~~ → khảo sát staging + dựng, R-527..R-529.

## 2026-09-24 — Mẫu Labo: `statusClinic` và hai mục treo còn lại (R-525..R-529)

Chủ dự án: "làm luôn đi". Khảo sát ghi trên staging (bệnh nhân DEV TEST, capture
trong `reference-private/survey/staging/labo-statusclinic-cancel-2026-09-24.json`)
cho thấy `statusClinic` không có màn hình riêng: bản gốc **chặn huỷ / chuyển đổi
dòng dịch vụ** khi còn phiếu Labo chưa xong, và khối "Hủy phiếu Labo" trong dialog
Chuyển đổi mới là nơi đổi nó (`PUT /api/v1/orders/{id}/update-status
{"status":"canceled","statusClinic":"canceled"}` cho từng phiếu).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-525 | Sáu app service export tiêu đề khoá thô `BE:*` (cùng gốc R-521) | Thêm `BlueDentalAppService : ApplicationService` đặt `LocalizationResource = typeof(BlueDentalResource)` trong ctor; bảy service (Labo, Invoice, SalesEntry, OperationsReport, Patient, ClinicReport, PatientTreatment) đổi base sang nó. Thay đổi dùng chung mức 3 nhưng chỉ chạm cách tra `L[]`, không đổi hành vi nào khác; contract tests xanh. |
| R-526 | Cột "Trạng thái" của Excel Mẫu Labo in tên enum tiếng Anh (`Draft`, `Sent`…) | Export tra `L["Patient:Labo:Status:<enum>"]` như pill trên giao diện → "Đơn hàng mới", "Đã gửi", …, và theo `Accept-Language`. |
| R-527 | Huỷ / chuyển đổi một dòng dịch vụ còn phiếu Labo chưa xong được cho qua, trong khi staging trả 400 "Dịch vụ có đơn labo chưa hoàn tất, không thể huỷ." (toast, dialog xác nhận vẫn mở) | `LaboOrder.IsUnfinished` = status ∉ {Received, Completed, Rejected, Replaced}; `PatientTreatmentAppService.CancelServiceAsync` / `ConvertServiceAsync` gọi `GuardNoOpenLaboOrderAsync` → `BusinessException("BlueDental:Treatment:0029")` cùng câu chữ của bản gốc (vi/en). `TreatmentServiceDto` mang `labOrders[] {id, orderCode, status, kind, isUnfinished}` — bản gốc gửi `include=labOrders[id,statusClinic,status]` cho trang kế hoạch. |
| R-528 | Dialog Chuyển đổi thiếu khối "Dịch vụ đang có **phiếu Labo**, vui lòng **hủy phiếu Labo** trước khi thay đổi dịch vụ." + nút "Hủy phiếu Labo"; Lưu không bị khoá | `ConvertLaboBlock` ở cuối cột trái khi dòng còn phiếu chưa xong, Lưu `disabled`; nút mở dialog "Xác nhận hủy phiếu Labo" (500px, hai dòng chữ, Đóng / Xác nhận); Xác nhận → `POST /api/v1/app/patient-treatments/{id}/services/{lineId}/cancel-labo-orders` → mọi phiếu chưa xong của dòng `CancelForServiceChange()` (Kind = `Canceled` (4), Status = `Rejected`) — bỏ qua chốt "chỉ huỷ đơn mới" của dialog chi tiết, đúng như staging; khối biến mất, **không** toast (khớp snapshot staging). `LaboOrderKind.Canceled` phản ánh `statusClinic: canceled`; pill "Tình trạng mẫu" đọc "Đã huỷ", ba bộ đếm bỏ phiếu đó, không cần migration (short). |
| R-529 | Dòng dịch vụ mở trong dialog là snapshot nên sau khi huỷ phiếu khối vẫn hiện | `useConvertServiceForm` giữ `laboCleared`, reset khi đổi dòng; `hasOpenLabo = !laboCleared && labOrders.some(isUnfinished)`. |
| R-532 | Điều kiện hiện nút chưa giống staging 100% (ba khe): (A) dấu cộng / khiên trên Mẫu Labo gate theo `laboTemplate:create` trong khi staging gate theo `treatmentLabo:create`; (B) dialog "Thông tin chung" gộp `laboTemplate:update` + `appointment:create` thành một cờ `editable`, không có quyền update thì **ẩn** select Trạng thái (staging vẫn hiện, chỉ disabled) và hiện nút Đóng mà staging không có; (C) "In Phiếu Labo" phụ thuộc `GET clinic-branches/{id}` — endpoint này đòi `Organizations.View` (= `branchManager.read`) nên user chỉ có quyền Labo bị disabled nút in | Đọc lại bundle staging `cf971421de158bad.js` (2026-09-24): export = `can("laboTemplate","export")`; hàng: mắt luôn, `can("treatmentLabo","create")` → khiên luôn + cộng khi dòng chưa done; dialog `N({canUpdate: laboTemplate:update, canCreateAppointment: appointment:create})` → footer In Phiếu Labo luôn, Tạo Lịch Hẹn Mới theo canCreateAppointment, Lưu theo canUpdate, **không có Đóng**; select luôn render với `disabled: !canUpdate`; ô Tải ảnh và nút xoá ảnh chỉ khi canUpdate. Sửa: `LaboOrdersScreen` gate cộng/khiên bằng `useAbility("treatmentLabo").canCreate`, đọc thêm `useAbility("appointment").canCreate`; `LaboDetailDialog` nhận `mode: LaboDetailMode` (`{variant:"patient"}` \| `{variant:"orders", canUpdate, canCreateAppointment}`), `LaboStatusSelect` thêm `disabled`, `LaboPictureWell` thêm `readOnly` (giữ dải ảnh, bỏ ô Tải ảnh + nút xoá), footer tách ra `LaboDetailFooter` (Đóng chỉ ở variant patient); `useBranchInfo` đổi sang `GET clinic-branches/accessible` (chỉ cần đăng nhập) rồi `select` theo id — ảnh hưởng mọi tờ in dùng letterhead, dữ liệu trả về giống hệt. |
| R-531 | Cột Thao tác chưa xét điều kiện hiện nút: tab Labo của bệnh nhân luôn hiện đủ mắt + cộng + khiên kể cả khi dịch vụ điều trị đã hoàn thành (Mẫu Labo thì đã ẩn dấu cộng theo `treatmentServiceStatus === 3` từ R-500) | Đọc bundle + DOM staging trên cả hai bảng (2026-09-24, `reference-private/survey/staging/labo-actions-snapshot-2026-09-24.md`): mắt luôn hiện; nếu `can("treatmentLabo","create")` thì khiên luôn hiện và dấu cộng chỉ ẩn khi `treatmentService.status === "done"`; status/statusClinic của phiếu **không** ảnh hưởng — phiếu "Đã huỷ" (LABO-202609241) vẫn đủ ba nút, phiếu trên dòng đã hoàn thành (LABO-202609192/191/181 của DT48) chỉ còn mắt + khiên; không nút nào bị disable. Sửa: đưa `canContinueLaboOrder` vào chính `LaboRowActions` (`order-dialogs/laboOrderCells.tsx`) để hai bảng dùng một luật, `laboOrderColumns.tsx` bỏ gate riêng; quyền `treatmentLabo:create` vẫn gate cả hai handler ở container như cũ. |
| R-530 | Ba tab lọc "Mẫu chưa nhận / giao trễ / đã nhận hàng" gần như trống: chi nhánh demo 156 phiếu mà tab chưa nhận chỉ 1, giao trễ 1, đã nhận 25 — 110 phiếu "Đơn hàng mới" (Draft) không nằm dưới tab nào ngoài Tất cả, vì `ApplySampleFilter` chỉ nhận Sent/InProgress/LateDelivery là "chưa nhận" trong khi FE không bao giờ gọi `/send` (mọi phiếu tạo ra đều Draft); "giao trễ" còn tự suy từ `DueAt < nửa đêm` (R-522) | Bấm thật ba tab trên staging (2026-09-24, bodies trong `reference-private/survey/staging/labo-filter-*.json`): mỗi tab là **một status đúng bằng** — `status=created` 14/24 phiếu, gồm cả phiếu hẹn trả từ 30/03 (không hề rơi sang giao trễ); `status=lateDelivery` 0; `status=delivered` 3; canceled/replaced chỉ hiện dưới Tất cả. Sửa `LaboAppService`: chưa nhận = Draft ∪ Sent ∪ InProgress, giao trễ = LateDelivery **đúng một status**, đã nhận = Received ∪ Completed; `IsAwaitingReturn`/`IsOverdue`/`IsReturned` dùng chung cho list, `stats` và cột Excel "Giao trễ"; bỏ `StartOfToday()` (rút lại phần "quá hạn từ nửa đêm" của R-522 — `ClinicUtcOffset` vẫn dùng cho cột Hẹn trả). Đo lại chi nhánh demo: 0→156, 1→110 (toàn status 1), 2→1, 3→25; `stats {awaitingReturn 110, overdue 1, returned 25}`. |

### Kiểm thử

- `e2e/labo-api.spec.ts` +1 ("an unfinished order blocks its service line until
  Hủy phiếu Labo"): thêm dòng dịch vụ mới qua `POST …/services` để không tiêu
  dữ liệu seed, tạo phiếu với `treatmentServiceId`, `POST …/cancel` → 403
  `Treatment:0029`, `POST …/cancel-labo-orders` → 200 với `labOrders[]` đều
  `isUnfinished=false`, đọc lại phiếu `kind 4 / status 6`, rồi `POST …/cancel`
  → 200 và dòng `status 4`. 5/5.
- `e2e/treatment-plan-detail.spec.ts` +1 ("a line with an open Labo slip must
  cancel it before it converts"): trình duyệt thật, phiếu tạo qua API từ trang
  đã đăng nhập, khối + Lưu khoá, Đóng không đổi gì, Xác nhận → khối mất, Lưu
  mở, không toast; reload tab Labo của bệnh nhân thấy "Đã huỷ", mở lại dialog
  không còn khối. 14/14 cả file.
- R-532: `e2e/labo-orders-permissions.spec.ts` mới (1 test, ~35 s): admin tạo
  bác sĩ role `dentist` qua dialog Nhân sự, cấp từng lá quyền trên Cài đặt →
  Phân quyền, bác sĩ đăng nhập bằng context riêng và mở lại Mẫu Labo sau mỗi lần
  cấp. Chỉ `laboTemplate.read`: nút hàng ["Xem"], không Xuất Excel, select
  Trạng thái hiện + disabled, không ô Tải ảnh, footer ["In Phiếu Labo"] (enabled
  — letterhead lấy từ `/accessible`); + `treatmentLabo.create` → ["Xem","Tiếp tục
  công đoạn","Bảo hành"]; + `appointment.create` → footer ["In Phiếu Labo","Tạo
  Lịch Hẹn Mới"], select vẫn disabled; + `laboTemplate.update` → select enabled,
  ô Tải ảnh, footer đủ ba. Fixture dùng chung `e2e/fixtures/restrictedDentist.ts`
  (tách từ `role-permissions-abilities.spec.ts`). Gotcha: subject `appointment`
  nằm dưới hai nhóm của cây quyền (Điều trị → Lịch hẹn và Lịch hẹn → Lịch hẹn
  khách hàng) nên `appointment.create` khớp 2 `.perm-leaf` cùng id — fixture bấm
  ô đầu và kiểm tra mọi ô cùng đổi. Trọn bộ `e2e/labo`: **28/28**,
  `role-permissions-abilities` 1/1, `tsc` app + root sạch.
- R-531: `e2e/labo-orders-actions.spec.ts` +1 ("the plus follows the treatment
  line, not the order, on both tables"): fixture `addPlanLine`/`driveLine`
  (`e2e/fixtures/laboSeed.ts`) thêm hai dòng dịch vụ thật vào một phiếu điều
  trị, gắn mỗi dòng một phiếu Labo, rồi `/complete` dòng thứ nhất và
  `/cancel-labo-orders` + `/cancel` dòng thứ hai qua API thật. Tab Labo bệnh
  nhân: dòng hoàn thành → ["Xem chi tiết","Bảo hành"], dòng huỷ (hai cột "Đã
  huỷ") → đủ ba; Mẫu Labo: ["Xem","Bảo hành"] / đủ ba; bấm khiên trên dòng hoàn
  thành mở dialog "Bảo hành". Lỗi gặp khi viết: `POST …/complete` 422
  `Treatment:0002` vì fixture lấy `services[last]` làm dòng mới trong khi phiếu
  trả dòng theo thứ tự riêng (trúng dòng đã đóng) — sửa bằng cách so id trước/sau
  POST. Trọn bộ `e2e/labo`: **27/27** (2,6 phút), `tsc` app + root sạch.
- R-530: `e2e/labo-api.spec.ts` +1 ("the Mẫu Labo filters are exact status
  filters"): phiếu vừa tạo nằm dưới `sampleFilter=1` và không dưới 2/3,
  `stats.awaitingReturn` > 0; dialog đặt `status=7` → sang tab 2, rời tab 1,
  `awaitingReturn` −1 / `overdue` +1; `status=4` → chỉ tab 3, `overdue` về cũ,
  `returned` +1. `e2e/labo.spec.ts` "the three sample filters re-query the
  server by status" thay test cũ (chỉ kiểm URL có `sampleFilter=1`): đọc
  response thật của từng tab — tab 1 `totalCount` > 0 và mọi dòng status ∈
  {1,2,3}, tab 2 toàn 7, tab 3 ∈ {4,5}. Trọn bộ `e2e/labo`: **26/26** (2,5 phút).
- `e2e/labo*` chạy gộp theo thứ tự file trên bản build production: **25/25** (2,7 phút). Khi chạy tách
  file (`labo.spec` sau `labo-detail`/`labo-orders-actions`), "a row names its
  customer, dentist and material" đỏ vì dòng mới nhất là đơn seed không có vật
  liệu — lỗi thứ tự dữ liệu có từ trước, không phải do đợt này; chạy trọn bộ
  `e2e/labo` thì dòng mới nhất là đơn của `labo-warranty` và xanh.
- Domain.Tests Labo 23/23 (+3: `IsUnfinished` theo status, phiếu đã gửi vẫn
  "chưa xong", `CancelForServiceChange` đóng cả hai chiều); Application.Tests
  Labo + TreatmentPlan 40/40. `tsc`, eslint xanh; prettier chỉ chạy trên file
  đã chạm (`laboApi.ts`), các file convert còn lại vốn đã lệch prettier từ
  HEAD (CRLF), không format lại để tránh diff ngoài phạm vi.

### Còn treo

- CSS của khối và nút "Hủy phiếu Labo" trên staging **chưa đo** (chỉ có
  snapshot chữ); local dùng `tp-btn tp-btn--danger`, chữ 14px/22px, gap 12px —
  ghi UNKNOWN trong `docs/clone/pages/labo.md` §8.
- Chưa rõ với bản gốc phiếu `delivered` / `replaced` có tính là "đã xong" để qua
  chốt không (local: Received, Completed, Rejected, Replaced qua chốt), và lưu
  Chuyển đổi thành công có đụng `statusClinic` không.
- Gotcha sửa file: phần lớn file convert / spec dùng CRLF — script sửa phải
  chuẩn hoá CRLF→LF khi khớp chuỗi và ghi lại CRLF; heredoc python trong Git
  Bash bẻ `\r\n` thành xuống dòng thật, dùng Write/Edit tool cho script.

## 2026-09-24 — Chi tiết phiếu: nhiều công đoạn một lúc, răng theo công đoạn, Tiếp tục bảo hành, sửa dòng kế hoạch

Đối chiếu staging (`staging.nfcdental.com`, bản ghi HN8510 theo chủ dự án cho phép thao tác) và chunk Next.js đã publish.
Chi tiết: [pages/patient-detail.md](../clone/pages/patient-detail.md) (Survey 2026-09-24),
[pages/treatment-plan-detail.md](../clone/pages/treatment-plan-detail.md), [features/treatment-stage.md](features/treatment-stage.md).

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-533 | Dialog "Chi tiết phiếu" chỉ chọn được **một** thẻ; bản gốc chọn nhiều, mỗi thẻ một form xếp chồng, một nút lưu | `useStageComposer` giữ `selectedIds` + draft theo thẻ; lưu **tuần tự** (song song vấp concurrency stamp của phiếu → 409) |
| R-534 | Công đoạn mới luôn lấy **toàn bộ** răng của dịch vụ | Chọn/bỏ răng theo từng công đoạn (`StageTeethPicker`, sơ đồ "Chọn răng" có răng ngoài dịch vụ bị khoá); răng còn lại ở lại THÊM CÔNG ĐOẠN; BE `StageTeethPolicy` từ chối răng ngoài dịch vụ (0030) / đã có công đoạn (0031) / rỗng (0032) |
| R-535 | "Tiếp tục công đoạn" sửa đè công đoạn cũ | Như bản gốc: `POST /treatment-stages/{id}/continue` tạo công đoạn mới cùng răng, công đoạn cũ `IsSuperseded` (xám, không tick/tải ảnh/sửa); migration `AddStageContinuationChain` đánh dấu dữ liệu cũ |
| R-536 | Thiếu tab **TIẾP TỤC BẢO HÀNH** và chuỗi bảo hành | Tab thứ ba; bảo hành lấy răng của công đoạn **gốc** (`WarrantyRootStageId`); còn bảo hành mở → nút Bảo hành bị khoá kèm tooltip (0033); hết hạn (0035); dịch vụ không bảo hành → nút xám "Không bảo hành" |
| R-537 | Cột Răng in "11 - Mặt ngoài" (bảng hồ sơ, lịch sử, kế hoạch) | Chỉ số răng: "11, 12, 13" (`formatToothCodes`) |
| R-538 | Kế hoạch điều trị: cột Thao tác không có "Chỉnh sửa" | Bút chì theo bản gốc (sửa được khi dòng chưa xong/huỷ và chưa thu tiền); dòng đang điều trị khoá chẩn đoán/giá và răng đã có công đoạn (0037–0039) |
| R-539 | Form "Tiếp tục" của công đoạn trên dịch vụ không gắn răng báo "Vui lòng chọn răng" | Luật răng chỉ áp khi thẻ có răng để chọn — BE cũng bỏ qua dòng không gắn răng |
| R-540 | e2e: fixture chọn dòng "đang làm" nhưng đã hết răng trống sau vài lượt chạy → 0032 | `openPatientWithTreatment` chỉ lấy dòng còn răng chưa có công đoạn (`stagedTeeth`); `createSlip` của plan-detail nhận danh sách răng |

### Kiểm thử

Dev server :5173 (StrictMode) → API :5019 → PostgreSQL local, đăng nhập qua màn login, không chặn request.

- BE: Domain **157/157**, Application **599/599**, EntityFrameworkCore **54/54**.
- `treatment-stage-chain.spec.ts` (mới) **5/5**: nhiều thẻ + răng từng phần + 0031; tiếp tục làm xám công đoạn cũ; chuỗi bảo hành
  (răng gốc, 0033, hoàn thành, bảo hành lại); sửa dòng kế hoạch (0038/0039); tài khoản chi nhánh 2 → 403.
- `patient.spec.ts` **45/63** (+ chain 5 = 50/68). Toàn bộ test công đoạn/bảo hành xanh. 18 ca đỏ **ngoài phạm vi** (chưa sửa):
  mở hồ sơ bằng click tên trong danh sách nên rơi vào tab Chẩn đoán & Tư vấn (mặc định từ `86ccaf00`) — thẻ hồ sơ, nhãn, nghề nghiệp,
  lý do đến khám; `?tab=consulting`; phiếu thu gộp (3 phiếu thay vì 1); ô tiền; lưu lịch hẹn.
- `treatment-plan-detail` **10/10**, `treatment-plan`, `treatment-stage`, `labo-detail` xanh; `consulting-plan` 1 đỏ (không tìm được
  dịch vụ có giá), `labo-warranty` 2 đỏ (đếm phiếu labo qua API không gửi chi nhánh → 0). Ba ca này không đụng code đã sửa; chưa
  đối chứng với HEAD.
- `tsc -b`, eslint các file đã sửa, `vitest` xanh.
- Chưa chạy trên bản build production (`vite preview` :8080).

## 2026-09-24 (đợt 2) — "Thêm chẩn đoán" và thu gọn "Mục lục bệnh án"

Hai hành vi đọc từ chunk đã publish của bản gốc (file tĩnh, không bấm gì trên staging/production).

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-541 | "Thêm chẩn đoán" trong form "Tạo chẩn đoán" luôn bị disable | Bật theo cùng điều kiện với "Lưu Chẩn Đoán"; lưu một chẩn đoán rồi làm trống form và giữ form mở (`intent: "add"`, `blankCount`). Unknown cũ đã đóng |
| R-542 | Thu gọn "Mục lục bệnh án" chỉ ẩn danh sách, cột vẫn 320px và header vẫn đủ chữ | Màn rộng (> 1024px): cột 64px, panel giữ chiều cao, chỉ còn nút `PanelLeftOpen` căn giữa; aria-label/title theo bản gốc. Màn hẹp giữ hành vi cũ |

### Kiểm thử

Stack phụ: FE dev :5174 → API :5020 (BE build ra thư mục riêng, cùng PostgreSQL local), đăng nhập thật, không chặn request.

- `patient.spec` "Thêm chẩn đoán files the slip and leaves a blank form for the next one" (mới) **xanh**: hai lần thêm liên tiếp,
  mỗi lần đúng một `POST`, form vẫn mở và trống, DB tăng đúng 2.
- `patient-medical-record.spec` **22/23**: có test mới "the index folds to a rail on a wide window and opens again" và 3 test đổi
  tên nút sang "Mở rộng mục lục bệnh án". Ca đỏ là "the index lists the reference's nine forms…", **phụ thuộc thứ tự** như đã ghi
  ở R-487: bệnh nhân đầu danh sách không có tờ bệnh án nào.
- `consulting-plan` 10/13: 3 ca đỏ (dịch vụ có giá, tab báo giá còn sót, khoảng chữ ký bản in) không đụng file đã sửa. Hai ca
  sau lần đầu đỏ sau khi dọn DB còn 15 bệnh nhân; chưa điều tra.
- Key i18n mới (`Patient:MedicalRecord:ExpandIndexAria` / `CollapseIndexAria`) nằm ở BE. API đang chạy phải build lại mới thấy.

## 2026-09-24 (đợt 3) — Chẩn đoán & Tư vấn: cột răng, thanh cuộn, "Chọn Dịch Vụ", xoá

Đọc từ chunk đã publish của bản gốc. Trên staging chỉ mở form "Tạo chẩn đoán" (chỉ đổi trạng thái giao diện) và đọc stylesheet.
Không lưu, không xoá gì.

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-543 | Cột Răng của bảng chẩn đoán in cả mặt răng ("14, 13 - Mặt gần, …") | Chỉ số răng (`formatToothCodes`); chip trong form vẫn giữ mặt răng |
| R-544 | Mở form chẩn đoán thì thêm một thanh cuộn 15px sát thanh cuộn của pane | Card vẫn tự cuộn như bản gốc (`max-h-600 overflow-auto`), nhưng thanh cuộn vẽ như staging: 6px, thumb rgba(27,42,65,.12). Nguyên nhân: `scrollbar-color` khai báo trên `html` bị kế thừa, khiến Chrome bỏ qua `::-webkit-scrollbar` và vẽ thanh cổ điển 15px |
| R-545 | "Chọn Dịch Vụ": thanh nhóm khác bản gốc (nút "Tất cả dịch vụ", một hàng, ô tìm bên phải) | `AdviseGroupPicker` theo component chip của bản gốc: nhãn + ô tìm 260px, chip 2 hàng giữa hai mũi tên, bấm lại để bỏ chọn, nhóm 20/trang và cuộn thì tải thêm. `useChipScroller` chuyển lên `src/hooks` để dùng chung với Labo |
| R-546 | Lọc theo nhóm ra "Không có dịch vụ phù hợp" dù nhóm có dịch vụ (NHÓM KEO 560646) | Modal tải **200 dòng đầu** một lần rồi lọc ở trình duyệt, và chỉ lấy `isActive=true`. Nay lọc ở server theo `taxonomyId` + tìm kiếm, 20/trang, cuộn thì tải thêm, lọc `isDeleted=false` như bản gốc (BE thêm tham số tuỳ chọn `IsDeleted` cho list catalog). Dòng đã tick giữ luôn dịch vụ của nó nên đổi nhóm không mất lựa chọn |
| R-547 | Xoá chẩn đoán / xoá dịch vụ tư vấn chỉ đổi trạng thái (Cancel / Reject): toast "Đã từ chối…", dòng vẫn nằm trong bảng | Gọi `DELETE` như bản gốc; toast "Đã xoá chẩn đoán" / "Đã xoá dịch vụ". Domain `EnsureDeletable`: từ chối phiếu đã điều trị (0010) và dòng đã vào kế hoạch (0011 → 422) |
| R-548 | `DELETE`/`GET`/`PUT` theo id của phiếu chẩn đoán và dịch vụ tư vấn **không kiểm chi nhánh**: biết id là xoá được bản ghi của chi nhánh khác | `GetInBranchAsync` cho mọi method theo id của `PatientDiagnosisAppService` và `PatientAdviseAppService`; id của chi nhánh khác trả 404 |

### Kiểm thử

Stack phụ: FE :5174 → API :5020 (build từ working tree), PostgreSQL local, đăng nhập thật, không chặn request.

- Domain: `ConsultingDeleteTests` (4 test mới) **xanh**. Toàn bộ 348/349; ca đỏ `Catalog_Should_Cover_Every_Observed_Subject` (86 vs 87)
  đã đỏ sẵn trên code đã commit (`dd268809` thêm subject mà không cập nhật số đếm).
- `consulting-delete-and-picker.spec.ts` (mới) **3/3**: xoá chẩn đoán (DELETE, toast, mất khỏi bảng, reload, chi nhánh 2 → 404);
  xoá tư vấn (không còn "đã từ chối", reload, chi nhánh 2 → 404, dòng đã vào kế hoạch → 422 và vẫn còn); "Chọn Dịch Vụ" (layout,
  không có chip "Tất cả", chip gửi `taxonomyId`, dịch vụ cuối catalog hiện ra, tick giữ qua lần bỏ chọn nhóm, tìm gửi `filter`, Lưu ghi đúng phiếu).
- Kiểm tay: NHÓM KEO 560646 hiện đủ ROW A (đang tắt) và ROW B.
- Hồi quy: `labo` + `labo-detail` + `labo-warranty` + `consulting-plan` + spec mới **30/34**. 4 ca đỏ đều đã đỏ trước đợt này:
  voucher không có dịch vụ có giá, 2 ca labo-warranty đếm phiếu qua API ra 0, cột labo "—" (R-487).
  `patient.spec` nhóm chẩn đoán/tư vấn **4/6**. 2 ca đỏ ở bước `toHaveURL(/tab=consulting/)` sau reload, cũng đỏ sẵn (18 ca ghi ở
  đợt 2026-09-24). Ca "Lưu Chẩn Đoán" đã qua bước kiểm cột Răng mới "18, 16" rồi mới đỏ ở bước URL.
- Chưa chạy trên bản build production.

## 2026-09-24 (đợt 4) — Kế hoạch điều trị: dịch vụ mới phải có răng

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-549 | Hàng "Thêm dịch vụ mới" trên chi tiết kế hoạch lưu được dòng không có răng (cột Răng "—") | Lưu khi chưa chọn răng: hiện "Vui lòng chọn ít nhất 1 răng" (`Treatment:Tooth:ToothRequired`) dưới nút răng, không gửi request; chọn răng xong thì lỗi mất. Theo schema "create" của bản gốc (`selectedTeeth` ≥ 1); khi sửa dòng thì không bắt buộc. Chỉ chặn ở FE; BE vẫn nhận dòng không răng vì domain coi đó là dịch vụ toàn hàm |

Kiểm thử: `treatment-plan-detail` **10/10** (dev :5173 → API :5019, stack thật). Test kéo-thả nay kiểm luôn lỗi và việc không có POST.

## 2026-09-24 (đợt 5) — "Tạo bảo hành" có checkbox trống; sơ đồ răng ở "Tạo tái khám"

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-550 | "Tạo bảo hành" (và lịch sử điều trị) hiện checkbox không có chữ ở "Danh sách công đoạn" | Gốc ở BE: lưu dịch vụ trong Danh mục (`ReplaceStages`) tạo lại **mọi** bước với id mới, nên công đoạn đã tick bước trỏ vào id không còn tồn tại, tên trả về rỗng. Nay `CatalogEntry.SyncStages` giữ id của các bước dialog gửi lại (sửa tại chỗ), bước mới mới có id mới, bước bị bỏ thì xoá. Migration `RepairOrphanedStageSteps` trỏ lại các bước mồ côi khi **toàn bộ** bước của công đoạn đều mất và dịch vụ hiện có đúng bằng số bước đó (trỏ theo thứ tự); dữ liệu local có đúng 1 công đoạn như vậy và đã sửa. FE bỏ qua bước không còn tên thay vì vẽ ô trống (`namedSteps`), nhưng khi lưu vẫn gửi đủ |
| R-551 | "Tạo tái khám" chỉ có chip răng, không có nút sơ đồ như form công đoạn | `FollowUpTeeth` thêm nút "Xem sơ đồ răng" mở `StageTeethDialog`: răng ngoài công đoạn gốc bị làm xám; "Chọn răng" trả lựa chọn về chip |

### Kiểm thử

- Domain `CatalogStageSyncTests` (3 test mới) xanh; Domain 351/352 (ca đỏ sẵn có về đếm quyền). EF 54/54.
- `treatment-stage-chain` "re-saving a service keeps its steps' ids" (mới, API thật) xanh.
- Danh mục trên **bản build production** (`vite preview` :8081 → API :5020): `taxonomy*` + `payment-qr` + `branch-*` **38/42**, bằng mức nền đã
  ghi ở R-487 (38/4). 4 ca đỏ: đăng nhập tài khoản chi nhánh (`branch-switcher`), dropdown thuốc của đơn thuốc mẫu (×2), bảng ở độ rộng điện thoại.
- `patient.spec` "a tái khám picks its teeth…" xanh (dev :5173 → API :5019). Thêm bước kiểm sơ đồ; sửa 2 chỗ test không ổn định:
  đóng dialog bằng ✕ vì tooltip Bảo hành nuốt Escape, và poll tổng số dòng sau reload.

## 2026-09-24 (đợt 6) — "Răng đã chọn" tràn khỏi cột

| ID | Sai lệch | Sửa |
|---|--------|-----|
| R-552 | Form "Tạo chẩn đoán": chip của răng có nhiều mặt ("45 - Mặt gần, Mặt xa, Mặt ngoài, Mặt nhai") tràn khỏi cột 260px, che mất nút ✕ | `.pd-tooth-chip` bỏ `white-space: nowrap`, thêm `max-width: 100%` + `overflow-wrap: anywhere`, padding phải 20px như `pr-5` của bản gốc: chip tự xuống dòng trong hộp |

Kiểm thử: `patient.spec` "records tooth surfaces on the consulting chart" thêm bước kiểm răng 45 đủ 4 mặt, chip và nút ✕ phải nằm trong hộp. Xanh (dev :5173 → API :5019); đã chụp ảnh đối chiếu.

## 2026-09-24 — Danh mục: nhập từ Excel (R-553..R-558)

> Ba muc nhap Excel duoi day mang so R-533..R-543 trong commit `1337000`; khi merge voi
> `origin/main` (bd09dac) cung ngay, nhanh kia da dung R-533..R-552 cho cong doan / tu van,
> nen doi thanh R-553..R-563 va sua moi tham chieu (features/taxonomy.md, registry, spec, tsx).

Yêu cầu BA qua chủ dự án: thêm "Nhập" cho Danh mục để nạp dữ liệu vào hệ thống
mới. **Không có trên bản gốc** → không so ảnh; phạm vi và từng case do chủ dự án
chốt (8 tab; Bệnh án mẫu làm sau; Thẻ hồ sơ / Phương thức thanh toán không cần;
nhóm thiếu thì tạo; trùng file = lỗi, trùng đang hoạt động = bỏ qua, trùng đã
xoá = khôi phục; từ chối cả file khi có lỗi, có tải file lỗi; không giới hạn
dòng; quyền = `create` của tab). Chi tiết ở `docs/testing/features/taxonomy.md`
§ Nhập từ Excel và `docs/clone/api.md`.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-553 | File lỗi (`import-errors`) mở trong SheetJS/Excel thiếu cột "Lỗi" dù server đã ghi ô | ClosedXML giữ nguyên `<dimension ref>` cũ của sheet khi lưu lại workbook nạp từ upload, nên cột thêm sau cột cuối nằm ngoài vùng khai báo. Xử lý: `sheet.CopyTo(freshWorkbook, name)` sang workbook mới rồi lưu workbook đó (`CatalogImportAppService.DownloadErrorsAsync`). |
| R-554 | Spec màn hình không tìm thấy nút "Nhập" (`getByRole("button", {name: "Nhập", exact: true})` timeout) và "Đóng" vi phạm strict mode | Nút icon AntD có accessible name = `aria-label` của icon + chữ ("upload Nhập", "download Xuất", "plus Thêm nguồn đến"); Modal AntD dưới locale vi đặt tên nút X cũng là "Đóng". Xử lý trong spec: tên regex (`/^upload Nhập$/`, `/Kiểm tra file$/`, `/Nhập 2 dòng$/`) và scope nút chân dialog qua `.bd-modal-foot`. Áp dụng cho mọi spec sau này bấm nút có icon. |
| R-555 | Trọn bộ Danh mục trên bản build production 50/54: `branch-switcher:93`, `taxonomy-dialogs:152` + `:207`, `taxonomy:277` đỏ **trước** khi có đợt này (đã ghi "đỏ trên bản build sạch" ở đoạn 2026-09-02 / 2026-09-23 của log) | Ba nguyên nhân cũ, sửa đúng theo cách log đã kê: (1) `1e8e172` làm `/login` đưa phiên đang mở vào lại app nên `goto("/login") + localStorage.clear()` không còn là đăng xuất → đăng xuất qua `.app-header-user` → "Đăng xuất", **rồi** `localStorage.clear()` vì lựa chọn chi nhánh nhớ theo trình duyệt chứ không theo tài khoản (thiếu bước này header vẫn ở chi nhánh 2 sau khi admin đăng nhập lại); (2) danh sách thuốc của chi nhánh đã dài (rác e2e) nên Select AntD là virtual list, bấm option ngoài màn lặp "outside of the viewport" → gõ tên vào ô "Tên thuốc" rồi bấm option trong `.ant-select-dropdown:visible` (cách của `prescription.spec.ts`); (3) từ shell v2 `main.app-content` là scroller, document không cuộn → đo `scrollHeight > clientHeight` trên `main.app-content`. |
| R-556 | Script sửa `taxonomy-dialogs.spec.ts` / `taxonomy.spec.ts` báo xong nhưng `git status` không đổi | Hai file CRLF, `str.replace` với chuỗi `
` không khớp; lỗi assert bị nuốt vì output script đi qua cùng bộ lọc grep của lần chạy test. Xử lý: helper đọc bytes → chuẩn hoá LF → thay → ghi lại CRLF; không lọc output của script sửa. Sau khi chèn dòng, selector `spec:line` của test phía dưới trôi (`:207` → `:211`) — lần chạy "3 passed" thiếu một test, phải chạy lại cả file. |
| R-557 | Dialog nhập không hiện ở "Tất cả chi nhánh"; tài khoản chỉ đọc không thấy nút | Đúng chủ ý: import ghi vào đúng chi nhánh header đang chọn (`clinicBranchId` bắt buộc), nút disabled khi `isAllBranches`; nút gate bằng `useAbility(tab).canCreate`, server `[Authorize(Catalogs.Create)]` → gọi thẳng 403 (`taxonomy-import-api.spec.ts`). |
| R-558 | `lib/download.ts` được sửa (thêm `downloadPostedFile`) — mọi nút "Xuất" là Level 3 | Chữ ký `downloadFile` giữ nguyên, phần lưu blob tách thành `saveBlob`/`fileNameFrom` dùng chung; các spec bấm "Xuất" trong bộ Danh mục (`taxonomy-groups`) xanh; các spec Xuất ngoài bộ này (cskh, export, labo-orders-permissions, materials, operations-reports, report, role-permissions-abilities) chưa chạy lại trong đợt này. |

Bằng chứng:

- BE: `BlueDental.Application.Tests` `CatalogImportAppServiceContractTests` 11/11
  (layout từng tab, cột bắt buộc, parse tiền "1.000.000", cờ có/không, thuế,
  công đoạn, template không có sheet Thuốc → lỗi file).
- API thật: `e2e/taxonomy-import-api.spec.ts` **9/9** — file mẫu từng tab
  (header có `*`), dry-run không ghi, commit ghi và lần hai toàn Skip, xoá mềm
  rồi nhập lại → Restore, trùng trong file → lỗi và không ghi gì, thiếu cột
  bắt buộc → `fileErrors`, nhập bằng `BRANCH2_USER` nằm trong chi nhánh 2 và
  admin ở chi nhánh 1 không thấy, tài khoản chỉ đọc → 403, đơn thuốc mẫu 2
  sheet (thuốc không có → lỗi, template không khớp → lỗi), file lỗi có cột
  "Lỗi" đọc được bằng SheetJS.
- Màn hình thật: `e2e/taxonomy-import.spec.ts` **3/3** (~1 phút) — xem
  `features/taxonomy.md`.
- Trọn bộ Danh mục (`e2e/taxonomy* payment-qr branch-*`, 38 test cũ + 12 mới)
  trên bản build production cổng 8080: **54/54** (5,9 phút) — trước đợt này
  là 50/54 (R-555).
- `tsc -b --noEmit`, `oxlint` sạch; BE build sạch (host chạy từ bin Debug).

### Còn treo

- Bệnh án mẫu: chủ dự án "làm sau" — chưa có layout import cho tab này.
- Các spec "Xuất" ngoài bộ Danh mục chưa chạy lại sau khi tách `saveBlob`
  (R-558) — Level 3 còn nợ, cần chạy khi rảnh host.

## 2026-09-24 — Danh mục: nhập từ Excel, dòng đã có mà khác cột → Cập nhật (R-559..R-561)

Chủ dự án hỏi "nếu đã có mà có cập nhật các trường khác thì vẫn là update chứ"
và chốt: **update nếu có thay đổi trường nào khác, bỏ qua nếu không thay đổi
gì**. Trước đó tên trùng dòng đang hoạt động luôn là Skip và không ghi gì.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-559 | Nhập lại file đã sửa giá / ưu tiên / dòng thuốc của một mục đã có → server báo "Bỏ qua (đã có)", dữ liệu mới không vào | Luật cũ. Thêm hành động `Update = 5` (`CatalogImportRowAction`, **nối sau `Error`** để số của FE không đổi) và `UpdateCount` trên kết quả. Với mỗi dòng trùng tên đang hoạt động, `EntryMerge.Merge` ghép ô trong file lên bản ghi rồi `EntryMerge.Differs` so từng trường (tên, ưu tiên, mã, giá, nội dung, mô tả/lời dặn, tên chi tiết, ghi chú, đơn vị, 11 trường cấu hình dịch vụ, 5 trường thuốc, dãy công đoạn, dãy dòng thuốc theo thuốc/liều/ngày/cách dùng). Khác → `Update` (cần quyền `Catalogs.Edit`, thiếu → dòng `Error` "Taxonomy:Import:Err:NoUpdatePermission" và từ chối cả file như mọi lỗi khác); không khác → `Skip`. Vì kết luận phụ thuộc sheet "Thuốc", việc phân loại dời ra `ResolveExistingAsync` chạy **sau** `PlanLinesAsync`. Khôi phục dòng đã xoá giờ cũng lấy giá trị trong file (trước đây giữ nguyên dữ liệu cũ). Commit: `UpdateManyAsync` cho cả hai nhóm, vẫn một unit of work. |
| R-560 | Lúc đầu mọi dòng đã có đều bị coi là "khác" | `LoadEntriesAsync` đọc bằng `GetListAsync` nên `ServiceConfig`/`Medicine`/`Stages`/`PrescriptionLines` rỗng, so với file lúc nào cũng lệch → đổi sang `WithDetailsAsync()` (dùng `DefaultWithDetailsFunc` của `CatalogEntry`). Kèm quy tắc **ô trống = giữ giá trị đang lưu** khi cập nhật/khôi phục (`EntryDraft.Given` = tập cột có ô không trống, `ImportRowReader.GivenColumns`); trên dòng tạo mới ô trống vẫn là mặc định (Không / KCT / 0). Hệ quả đã chấp nhận: **không xoá trắng được một trường bằng import**; muốn xoá thì sửa trên dialog. |
| R-561 | Chuỗi tóm tắt "N dòng: a thêm mới, b khôi phục, c bỏ qua, d lỗi" không có chỗ cho cập nhật; nhãn "Bỏ qua (đã có)" sai nghĩa | `Taxonomy:Import:Summary` thành 6 chỗ trống (thêm mới, cập nhật, khôi phục, bỏ qua, lỗi), nhãn Skip → "Bỏ qua (không thay đổi)", thêm `Action:Update` = "Cập nhật" (tag cam), `GuideIntro` nêu luật mới; nút "Nhập N dòng" và toast đếm cả cập nhật (`importableCount`). Hai spec đổi chuỗi theo. |

Bằng chứng (host build Debug trên 5000, preview bản build production trên 8080):

- `CatalogImportAppServiceContractTests` **13/13** (thêm test khoá số enum
  0..5 khớp `IMPORT_ROW_ACTION` của FE và `UpdateCount` trên DTO).
- `e2e/taxonomy-import-api.spec.ts` **9/9** — mở rộng: Nguồn đến nhập lại với
  ưu tiên 42 ở một dòng → dry-run `[5, 1]`, `updateCount 1`, commit giữ đúng
  `id`, `sortOrder` 42, dòng kia không đổi; xoá mềm rồi nhập lại với ưu tiên 7
  → Restore mang 7; thuốc nhập lại giá bán "1.600.000", đơn vị "Hộp", để trống
  giá mua và hoạt chất → Update, giá mua vẫn 1.000.000, hoạt chất vẫn
  Paracetamol, nhập file y hệt lần nữa → Skip; đơn thuốc mẫu đổi số ngày 5 → 7
  → template Update, dòng thuốc thay bằng dòng trong file, nhập lại → Skip.
- `e2e/taxonomy-import.spec.ts` **3/3** — thêm bước: file đổi ưu tiên một dòng
  → alert "2 dòng: 0 thêm mới, 1 cập nhật, 0 khôi phục, 1 bỏ qua, 0 lỗi", một
  tag "Cập nhật" + một "Bỏ qua (không thay đổi)", nút "Nhập 1 dòng" mở, toast
  "Đã nhập 1 dòng vào Nguồn đến", sau reload vẫn đúng 2 dòng.
- `tsc -b --noEmit`, `oxlint` sạch; BE build sạch.

### Còn treo

- Nhánh "có quyền tạo, không có quyền sửa" (`Err:NoUpdatePermission`) chưa có
  spec: chưa có vai trò seed nào tách hai quyền này. Kiểm bằng code + contract.
- 38 spec Danh mục cũ không chạy lại đợt này: thay đổi nằm trong importer và
  thêm `CatalogEntry.ChangeCode` chưa ai khác gọi → Level 2.

## 2026-09-24 — Danh mục: bảng xem trước import không kéo ngang được (R-562, R-563)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-563 | Kéo sang phải xem giá trị thì mất cột "Kết quả", không biết dòng sẽ thêm / cập nhật / lỗi | Chủ dự án yêu cầu ghim cột Kết quả. AntD chỉ ghim đúng khi cột `fixed: "right"` nằm cuối, nên đổi thứ tự: … → Lỗi → **Kết quả (ghim phải)**. Cột "Dòng" vẫn ghim trái. Kéo-cuộn toàn cục bỏ qua mousedown trên ô ghim (`.ant-table-cell-fix-end`) — hành vi sẵn có, không đổi. |
| R-562 | Xem trước file Dịch vụ (20 cột, rộng hơn dialog 960): cột bên phải bị cắt từ "% THUẾ", **nắm bảng kéo chuột không cuộn ngang** như mọi bảng khác, cũng không thấy thanh cuộn | Bảng này là bảng `virtual` duy nhất trong app. Kéo-cuộn toàn cục (`initTableGrabScroll` trong `hooks/useDragScroll.ts`) chỉ bám `.ant-table-content` / `.ant-table-body` và cuộn bằng `scrollLeft`; thân bảng virtual là `.ant-table-tbody-virtual-holder` với `overflow-x: hidden`, vị trí ngang nằm trong state React (`offsetLeft`) và vẽ bằng `transform`, thanh cuộn tự vẽ bị inline `visibility: hidden` cho đến khi lăn con lăn. Thử đầu tiên (ép thanh cuộn ảo luôn hiện bằng CSS) chỉ cho kéo thanh, không cho nắm bảng → bỏ. Sửa: **bỏ `virtual`** khỏi `CatalogImportPreview.tsx`, giữ `scroll={{x, y}}` + `pagination={false}`; thân bảng thành `.ant-table-body` thường nên nắm-kéo, thanh cuộn gốc và Shift+lăn đều chạy, không cần CSS riêng. Đổi lại mọi dòng của file đều render (không cửa sổ hoá); file vài nghìn dòng vẫn chấp nhận được vì chỉ xem trước một lần, ghi nhận để theo dõi. |

Bằng chứng: `e2e/taxonomy-import.spec.ts` **4/4** trên bản build production
(preview 8083 riêng vì 8080 đang có phiên khác dùng, host 5000) — spec mới
"a wide sheet scrolls sideways by grabbing the table, like every other table":
nhập file Dịch vụ 2 cột, `.ant-table-body` có class `has-horizontal-scroll`,
nắm một ô giá trị kéo sang trái 400 px thì tiêu đề cột "Lỗi" dịch trái > 200 px
và `scrollLeft` > 200; tiêu đề "Kết quả" có class `ant-table-cell-fix-end`, giữ
nguyên toạ độ x sau khi kéo và tag "Thêm mới" vẫn trong khung nhìn (R-563). `tsc -b` và `oxlint` sạch. Level 2 (đổi props bảng
trong một feature, spec màn hình chạy lại đủ).

## 2026-09-24 — Hồ sơ bệnh nhân: CCCD chưa unique (R-564)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-564 | Chủ dự án: "hiện tại CCCD chưa unique theo từng user đó" — hai hồ sơ bệnh nhân có thể mang cùng một CCCD, tạo mới hay sửa đều không chặn | BE chỉ kiểm tra **định dạng** CCCD (`Patient.SetNationalId`, 12 chữ số, `Patient:0011`), không nơi nào kiểm tra trùng; dữ liệu local có 35 hồ sơ, chưa hồ sơ nào có CCCD. Sửa ở tầng AppService như kiểm mã bệnh nhân (`EnsureCodeIsFreeAsync`): `EnsureNationalIdIsFreeAsync` chạy trong `RegisterAsync` và `UpdateAsync` (sau `SetNationalId`, loại chính hồ sơ đang sửa), CCCD trống bỏ qua. **Phạm vi theo chi nhánh** — cùng phạm vi với cảnh báo trùng điện thoại `check-phone`: một người khám ở hai chi nhánh có một hồ sơ ở mỗi nơi, nhưng trong một chi nhánh không bao giờ có hai. Trùng → `BusinessException` `BlueDental:Patient:0012` (403), thông điệp chỉ nói "CCCD này đã được sử dụng" — **không tiết lộ hồ sơ nào đang giữ** (chủ dự án yêu cầu vì lý do bảo mật). Không thêm unique index DB: PatientCode cũng không có, và index có thể làm migration hỏng trên prod nếu đã lỡ trùng — kiểm ở app đủ cho quy mô này. FE (`PatientEditorDialog`): bắt `code === Patient:0012` trong catch → chuyển về tab Cơ bản, `form.setFields([{ name: "nationalId", errors: [message] }])`, dialog giữ nguyên, **không toast** (R-307); lỗi khác vẫn `notifyError`. |

Bằng chứng: `e2e/patient-national-id.spec.ts` **3/3** trên bản build production
(preview 8084 riêng vì 8080/8082 đang có phiên khác dùng, host 5000 build lại
sau khi dừng tiến trình cũ) — HTTP thật từ trang đã đăng nhập (cookie + header
`RequestVerificationToken`, `X-Clinic-Branch-Id` chi nhánh 1): POST hồ sơ thứ hai
cùng CCCD → 403 `Patient:0012`, message KHÔNG chứa mã hồ sơ hay tên bệnh nhân
(bảo mật); PUT hồ sơ khác sang CCCD đã có → 403 cùng mã; PUT chính hồ sơ giữ với
CCCD của nó → 200; hai hồ sơ CCCD trống / rỗng → 200 cả hai; đăng nhập `branch2`
(chi nhánh theo claim, không header) tạo cùng CCCD → 200 (phạm vi chi nhánh);
dialog "Tạo hồ sơ" nhập CCCD đã có → dialog còn mở, `.ant-form-item-explain-error`
dưới ô CCCD chỉ nói "CCCD này đã được sử dụng", đổi CCCD trống khác → lưu được,
tên hiện trên danh sách. `e2e/patient.spec.ts` lọc "hồ sơ|Chỉnh sửa" chạy lại xanh (xem kết
quả bên dưới). Domain.Tests 368/368, Application.Tests 614/614; `tsc -b`,
`oxlint` sạch (một cảnh báo `no-invalid-fetch-options` giả — method là biến
POST/PUT). Level 2 (một feature: contract + AppService + dialog), F-06 giữ
`DIRTY` vì phần TagIds 2026-08-27 vẫn chưa retest đủ.

## 2026-09-24 — Dialog Thêm dịch vụ theo staging mới: tab Labo, công đoạn %/VNĐ (R-565..R-569)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-565 | Chủ dự án: "modal Thêm dịch vụ ở staging mới update nè và có thêm tab Labo" — bản gốc bỏ ô `Mã dịch vụ`, dựng lại bảng công đoạn (STT / Tên công đoạn / Giá trị %‑VNĐ / Thao tác bút‑sao‑thùng rác, phân trang 20/trang) và thêm tab **Labo** (chọn nhiều nhà cung cấp, ô hiện "Đã chọn N nhà cung cấp", ghi chú vàng). | Quan sát trên staging (không lưu gì). `ServiceDialog` tách thêm hai presenter: `ServiceStageTable` (bảng công đoạn, `useTablePagination` 20 với menu 5/10/20/25/50/100, sửa tên tại chỗ, `Segmented` %/VNĐ + `CurrencyInput`, sao MKT `aria-pressed`) và `ServiceLaboTab` (`Select mode="multiple" maxTagCount={0}` + `maxTagPlaceholder` để hiện đếm thay vì tag). Ô `Mã dịch vụ` bị bỏ — an toàn vì `UpdateAsync` không đụng `Code` và chỉ `CatalogEntry.Create` nhận mã (server sinh). Field mới `laboSupplierIds` nằm trong Form, `stageDraft` là ô nhập tên công đoạn (floating label "Công đoạn"). Chuỗi mới ở `vi.json`/`en.json` (`Taxonomy:Service:TabLabo`, `LaboSupplierLabel`, `LaboSelectedCount`, `LaboHint`, `StageRename*`, `StageMarketing*`, `RequireStageSequenceHintOn`) — host phải build lại rồi khởi động lại mới phục vụ key mới. |
| R-566 | Công đoạn có hai kiểu giá trị (% / VNĐ) và cờ "Tính lương cho phòng MKT"; dữ liệu cũ chỉ có một số. | `CatalogServiceStage.ValueType` (`ServiceStageValueType { Percentage = 0, Amount = 1 }`, smallint) + `IsMarketingSalary`; migration `AddStageValueTypeAndLaboSuppliers` gán **dòng cũ = Amount (1)** vì trước đây giá trị là tiền, còn DTO/FE mặc định dòng mới = Percentage như staging. Guard domain: giá trị âm hoặc % > 100 → `Catalogs:0021`; đổi VNĐ → % trên FE tự kẹp về 100. Nhập từ Excel (`ImportRowReader`) tạo công đoạn kiểu Amount. `SyncStages` nhận `CatalogStageRow` (record struct) thay vì 3 list song song. |
| R-567 | Nhà cung cấp Labo chọn trong dialog phải thuộc chi nhánh của dịch vụ. | `CatalogServiceConfig.LaboSupplierIds` (uuid[]), `CatalogEntryAppService.CheckLaboSuppliersAsync` chạy trước Apply ở cả Create/Update: id không thuộc `ClinicBranchId` → `BlueDental:Catalogs:0025` (403). Tuỳ chọn tab Labo lấy từ `useLaboSupplierOptions` (`/labo-suppliers`, cần chi nhánh hiện tại), chỉ fetch khi dialog mở. |
| R-568 | `taxonomy-dialogs.spec.ts` "a medicine keeps both prices" đỏ sẵn từ trước: mong `"8000"` nhưng ô hiện `"8.000"`. | Commit `d25d3c7` đổi `MedicineDialog` sang `CurrencyInput` (hiển thị nhóm nghìn kiểu VN) mà spec chưa cập nhật. Sửa spec mong `"8.000"` / `"12.000"`. |
| R-569 | Locator `getByRole("textbox", { name: "Công đoạn" })` vi phạm strict mode: khớp cả ô giá trị `aria-label="Giá trị công đoạn Lấy dấu"` (tên chứa "công đoạn"). | Dùng `exact: true`. Ghi thêm: `cat <<'EOF'` vẫn hỏng trên shell này, nhưng `python - <<'PY'` chạy được — viết script sửa file qua heredoc python thay vì Write tool. |

Bằng chứng: `e2e/taxonomy-dialogs.spec.ts` **7/7** trên bản build production
(preview 8080 `dist-preview`, host 5000 build lại) — spec dịch vụ: dialog không
còn ô "Mã dịch vụ", đúng 4 tab `Cài đặt / Công đoạn / Bảo hành / Labo`; bật
"Tính doanh số trên công đoạn" hiện dòng "Bật: …"; thêm "Lấy dấu" (mặc định %),
nhập 30, bấm sao → `aria-pressed=true`; thêm "Gắn sứ" bằng Enter, chuyển VNĐ,
nhập 250000 → ô hiện "250.000"; bút đổi tên thành "Lấy dấu răng"; footer
"Hiển thị 2 trên 2"; tab Labo chọn nhà cung cấp (seed qua HTTP thật
`/labo-suppliers` nếu chi nhánh chưa có) → "Đã chọn 1 nhà cung cấp"; lưu, reload,
mở lại: tên/kiểu/giá trị/sao của cả hai dòng và đếm Labo giữ nguyên. Spec HTTP
thật mới: POST catalog-entries với supplier lạ → 403 `Catalogs:0025`; % = 120 →
403 `Catalogs:0021`; VNĐ = 120 + sao → 200, trả `valueType: 1, isMarketingSalary: true`.
Domain.Tests 368/368, Application.Tests 614/614; `tsc -b`, `oxlint` sạch.
Bộ `taxonomy* / payment-qr / branch-*` chạy lại trên bản build production:
**54/56** (6,8 phút), 2 đỏ đều trong `taxonomy.spec.ts` và đều do chính thay đổi
này — xem R-570; sau khi sửa spec và thêm kẹp giá trị, kết quả ghi ở mục
R-570..R-572. Level 2 (một feature: contract + AppService + dialog);
ảnh hưởng gián tiếp: nhập Excel (công đoạn = Amount), phiếu Labo sau này sẽ lọc
nhà cung cấp theo `laboSupplierIds` (chưa làm — hiện phiếu labo vẫn cho chọn
tất cả).

## 2026-09-24 — Dịch vụ: kẹp giá trị công đoạn, thẻ nhà cung cấp Labo, giá tính ngay (R-570..R-573)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-570 | Chủ dự án: "chỗ field giá trị ở table handle max_value à sao t nhập được 5.555.555.555.555.555.000 luôn v" — ô VNĐ của công đoạn nhận số dài vô hạn. Cùng lúc `taxonomy.spec.ts` đỏ 2 ca: "creates a group and a priced service" chờ ô `Mã dịch vụ` (đã bỏ theo staging, R-567) rồi timeout; "pages the entry list on the server" đỏ dây chuyền vì nhóm rỗng ca trước để lại được chọn sẵn nên bảng không có footer. | `ServiceStageTable` truyền `isAllowed` riêng cho `CurrencyInput` nên **thay thế luôn** cái kẹp `MAX_VND` mặc định của component chung (chỉ file này ghi đè). Đo trên staging: ô VNĐ ngừng nhận phím sau **10 chữ số** (9.999.999.999), dán chuỗi dài hơn thì bị từ chối cả cụm — trùng đúng `MAX_VND`. Sửa: `CurrencyInput` export `MAX_VND`, `isAllowed` của bảng kẹp `floatValue <= (isPercent ? 100 : MAX_VND)`. Spec dịch vụ gõ 19 số 5 → ô hiện `5.555.555.555`, gõ `300` ở ô % → `30`. `taxonomy.spec.ts` bỏ dòng điền `Mã dịch vụ`; ca phân trang xanh theo. `taxonomy` + `taxonomy-dialogs` 17/17. |
| R-571 | Chủ dự án (ảnh staging): tab Labo hiện **thẻ** từng nhà cung cấp đã chọn dưới ô, và câu "Để trống nếu…" có icon cảnh báo phía trước — bản local chỉ có ô đếm và câu chữ. | Đo staging (Escape khi dropdown mở đóng luôn cả dialog — bấm vào tiêu đề dialog để đóng dropdown): ô có icon kính lúp trái + nút × "Xóa lựa chọn"; dưới ô 12px là hàng pill 29px (`6px 12px`, bo tròn, viền + chữ xanh link, nền `#f3f8ff`, 10px/600, cắt tên ở 150px, × 14px đỏ khi hover, aria "Bỏ chọn nhà cung cấp"); câu chú 13px cam có icon info-circle 16px cách chữ 6px. `ServiceLaboTab` đọc `laboSupplierIds` qua `Form.useWatch`, vẽ `.bd-labo-chip` từ options, × gọi `setFieldValue` bỏ id; `Select` thêm `allowClear` + `prefix={<SearchOutlined />}`; `.bd-labo-hint` thành flex với `InfoCircleOutlined`. Token mới `--bd-link-pale: #f3f8ff` cạnh `--bd-link`. Key mới `Taxonomy:Service:LaboRemoveAria` (host build lại + khởi động lại). Spec: sau khi chọn có pill, bấm × → mất pill và mất "Đã chọn 1", chọn lại → pill về; mở lại sau lưu vẫn có pill. |
| R-572 | `vite build --outDir dist-preview` sập `EPERM lstat …/assets/PageHeader-*.js` — tệp trong `dist-preview` thuộc user khác, `rm` bị từ chối (phiên khác dùng chung checkout, xem R-355). | Build sang thư mục mới `dist-preview-stage`, preview `--port 8086 --strictPort`, chạy spec với `E2E_BASE_URL=http://127.0.0.1:8086`. `dist-preview*` đã nằm trong `.gitignore`. |

| R-573 | Chủ dự án (ảnh local vs staging): "b chưa handle tính giá trị ở field Giá sau giảm và thực thu từ khách như ở staging à" — local hiện "—" ở hai ô cho tới khi lưu; staging tính ngay khi gõ. | Đo staging bằng cách gõ vào dialog (7 tổ hợp, bảng ở `docs/clone/pages/taxonomy.md`) và lưu **một** bản ghi tạm rồi xoá mềm: `net = giá − giảm` (không âm); Trước thuế → `Giá sau giảm = net`, `Thực thu = net × (1+thuế)`; Sau thuế → `Giá sau giảm = net ÷ (1+thuế)`, `Thực thu = net`. Server lưu `price` và `taxConfig` như đã chọn, trả `priceAfterDiscount` 2 số lẻ (863636.36), dialog làm tròn đồng. Giả định cũ sai ở nhánh Sau thuế (đã coi Giá sau giảm = net). Sửa: `CatalogServiceConfig.PriceAfterDiscount/AmountCollected` theo công thức đo, làm tròn 2 số lẻ `AwayFromZero`, xoá ghi chú UNKNOWN; theory Domain thêm dãy số đo thật (15/15). FE: `api/servicePricing.ts` (hàm thuần, cùng công thức) + `hooks/useServicePricePreview.ts` (`Form.useWatch` 5 trường) — hai ô `readOnly` hiện `formatVND(...)` ngay, bỏ nhánh `saved ? … : "—"`. Spec: sau khi gõ 1000 / 10 % / 10% VAT chờ `900`/`990` **trước khi lưu**, bấm "Sau thuế" → `818`/`900`, bấm lại → `900`; sau khi mở lại vẫn `900`/`990`. Quan sát thêm, chưa làm: staging giữ dialog mở sau khi tạo (nút `Đồng bộ dịch vụ này`). |

Bằng chứng (preview `dist-preview-stage` :8086 + host :5000, `E2E_BASE_URL=http://127.0.0.1:8086`):

- Sau R-571 (thẻ Labo): `taxonomy-dialogs.spec.ts` **7/7** (1,2 phút).
- Sau R-573 (giá tính ngay): lần đầu 6/7 — ca "Khác" của đơn thuốc mẫu quá 30 s
  ngay ở `createGroup` vì `dotnet test` Application.Tests đang biên dịch song
  song và host vừa khởi động lại (không liên quan thay đổi); chạy lại riêng
  ca đó **1/1** (12 s). Domain.Tests `TaxonomyTests` 15/15, Application.Tests
  lọc `Catalog` 61/61.
- Bộ đầy đủ `taxonomy* / payment-qr / branch-*`: FULLSET_RESULT

## 2026-09-24 — Danh sách bệnh nhân: Quét CCCD (R-565)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-565 | Chủ dự án (đặc tả 17): thêm "Quét CCCD" — CCCD đã có thì lọc danh sách, chưa có thì mở Tạo hồ sơ điền sẵn; địa chỉ cũ lưu trường riêng | Tính năng mới, không có trên bản gốc — xem `docs/clone/pages/patient-list.md` § Quét CCCD. BE: `Patient.OldAddress` (+ `SetOldAddress`, migration `20260924150018_AddPatientOldAddress`, 500 ký tự) đi qua Register/Update/PatientDto; `GET api/v1/app/patients/by-national-id` (Patient.Read, phạm vi chi nhánh) trả **chỉ** `{exists}` để giữ nguyên quyết định R-564 không lộ hồ sơ; tìm kiếm danh sách khớp thêm `NationalId`. FE: `NationalIdScanDialog` + `QrCameraView` (`qr-scanner`), `useNationalIdScan`, `utils/cccdQr.ts`, `utils/cardAddress.ts` (bảng sáp nhập tỉnh 63→34), `PatientEditorDialog.prefill`, ô "Địa chỉ cũ". Nhãn ô cố ý **không** chứa chữ "CCCD": bản nháp "Địa chỉ cũ (theo CCCD)" làm locator `textbox "CCCD"` bắt trùng hai ô. |

Bằng chứng (bản build production `vite preview` :8080, API :5019, DB thật, không chặn
request): `e2e/patient-scan-id.spec.ts` **3/3** — quét chuỗi QR địa chỉ cũ → dialog điền
đúng tên/CCCD/số nhà/địa chỉ cũ, lưu, đọc lại bằng request riêng thấy `dateOfBirth`,
`gender`, `provinceCode 79`, `wardCode 26743`, `oldAddress`; reload, quét lại → toast,
ô tìm kiếm = CCCD, đúng dòng hiện, địa chỉ cũ còn khi mở sửa; chuỗi không phải thẻ →
báo lỗi trong modal; `by-national-id` trả đúng `{exists:false}`/`{exists:true}` và chi
nhánh 2 thấy `false`. `e2e/patient-national-id.spec.ts` 3/3. Domain.Tests 368/368,
Application.Tests 614/614; `tsc -b` sạch. Camera thật chưa kiểm tự động (Chromium
headless không có camera — modal hiện thông báo và vẫn dùng được máy quét/ảnh).
Level 2.

Regression `e2e/patient.spec.ts` (cùng DB, cùng API): bản có Quét CCCD **43/62**, bản
gốc HEAD `73fc62f` build riêng ở :8081 **42/62** — 18 test đỏ trùng nhau ở cả hai
(trang chi tiết mở tab Chẩn đoán & Tư vấn thay vì Hồ sơ, tag, thanh toán, công đoạn…),
tức đỏ sẵn trước tính năng này. Ca đỏ riêng ở bản mới ("the Tiếp nhận steps advance
one at a time") chạy lại một mình thì xanh — phụ thuộc thứ tự/dữ liệu, không do thay
đổi. Hai ca chỉ đỏ ở bản gốc cũng cùng loại. F-06 giữ `DIRTY`.


## 2026-09-24 (tối) — Quét CCCD: camera không đọc, ảnh bị lật, xem trước (R-566)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-566 | Chủ dự án: đưa thẻ vào khung không quét được, camera sau điện thoại (dùng làm webcam) hiện **ngược**; muốn địa chỉ cũ tự quy ra xã/tỉnh mới và form quét có xem trước | (1) `qr-scanner` cắt vùng giữa rồi thu về **400×400 px** trước khi giải mã — mã QR CCCD dày, còn ~0,6 px/ô nên không đọc được; (2) nó đặt `scaleX(-1)` khi track báo `facingMode: user`, Windows báo vậy cho camera ảo. Thay bằng **zxing-wasm** trong Web Worker (`utils/qr/`), đọc khung gốc ≤1920 px, `tryHarder`, UTF-8, tự đọc mã lật gương; camera xin 1920×1080, không bao giờ lật ảnh. Địa chỉ: `cardAddress.ts` viết lại theo dữ liệu (`oldWardMap.json` từ `vietnam-address-database`), nhận địa chỉ không có chữ "Xã/Huyện". Modal mới hai cột + `CccdPreviewCard`, xác nhận bằng nút theo kết quả (`Lọc hồ sơ trong danh sách` / `Tạo hồ sơ`). |

Bằng chứng (build production :8080, API :5019, DB thật): `e2e/patient-scan-id.spec.ts`
**5/5** — Chromium chạy **camera giả** phát video thẻ có QR nhỏ **bị lật gương** ở góc
trên phải (`e2e/fixtures/cccdQr.ts` sinh QR thật bằng ZXing writer + Y4M): đọc được,
`video` có `transform: none`, xem trước "Xã Vạn Tường, Tỉnh Quảng Ngãi" từ địa chỉ cũ
"Thôn Đông, Bình Thuận, Bình Sơn, Quảng Ngãi", tạo hồ sơ → DB có `provinceCode 51`,
`wardCode 21061`, `oldAddress`; reload, camera đọc lại → "Đã có hồ sơ trong chi nhánh"
→ lọc danh sách. Ảnh QR tải lên (địa chỉ cũ Q.1 → Phường Bến Thành `26743`); máy quét
cầm tay với địa chỉ mới "Hòa Long, Đồng Tháp" → `30208`, `oldAddress null`; chuỗi không
phải thẻ bị từ chối; tra CCCD có/không theo chi nhánh. `patient-national-id.spec.ts` 3/3.
Camera điện thoại thật chưa kiểm tự động — cần chủ dự án thử lại.


## 2026-09-24 (khuya) — Quét CCCD: khung tự bám mã QR, bỏ ô nhập, modal không cuộn (R-567)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-567 | Chủ dự án: khung ngắm quá to, muốn khung tự detect và bo vào mã QR như Zalo; bỏ ô nhập số CCCD; modal nhỏ phải cuộn | Worker bật `returnErrors` để có **vị trí** mã ZXing thấy nhưng chưa đọc được; trả 4 góc về camera; `QrBox` vẽ ngoặc góc bằng SVG cùng hệ toạ độ khung hình (`xMidYMid meet` ↔ `object-fit: contain`), vàng khi đang đọc, xanh trên ảnh dừng khi đã đọc. Mã thấy mà chưa đọc → cắt vùng quanh mã, phóng lên ~640px, đọc lần hai. Bỏ ô nhập + nhánh "12 số" trong `parseCccdQr`. Modal `min(1240px, 100vw-48px)`, `centered`; khung camera `clamp(260px, 100vh-350px, 620px)`; thẻ xem trước thu gọn. |

Bằng chứng: `e2e/patient-scan-id.spec.ts` **5/5**, `patient-national-id.spec.ts` 3/3 (build
production :8080, API :5019, DB thật). Ca camera kiểm thêm: modal không có ô nhập nào,
`.ant-modal-body` không cuộn ở 1280×720 cả trước lẫn sau khi đọc, ảnh dừng + khung xanh
hiện sau khi đọc. Khung vàng bám mã kiểm bằng ảnh chụp với camera giả phát mã QR hỏng
(thấy được, không đọc được).

Bổ sung R-567: chủ dự án thấy khung xanh trên ảnh dừng **lệch** khỏi mã QR → bỏ hẳn khung
trên ảnh dừng (chỉ còn khung vàng khi đang quét); `useQrCamera.capture` chỉ giữ ảnh.
`patient-scan-id.spec.ts` 5/5 — ca camera kiểm ảnh dừng hiện và **không** có `.bd-idscan-box`.


## 2026-09-24 (khuya) — Quét CCCD: khung bám chưa khớp/mượt; CCCD đã có thì lọc luôn (R-568)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-568 | Chủ dự án: khung bám không bao quanh mã QR đúng, không mượt như Zalo; CCCD đã có thì lọc luôn, khỏi hiện thông tin | Đo: giải mã chỉ 3–14 ms, nên cái chậm là vòng quét nghỉ 100 ms/khung, việc chép khung 1920 px trên luồng trang, khung nới 18% và nhảy cóc. Sửa: đọc khung liên tiếp theo `requestAnimationFrame`; khung chuyển sang worker bằng `ImageBitmap` (không chép); worker dò nhanh trên bản ≤1280 px mỗi khung, chỉ đọc kỹ toàn khung khi đang mất mã hoặc thấy mà chưa đọc được (kèm lượt phóng to); toạ độ góc chuẩn hoá 0–1; `useSmoothedCorners` làm mượt 60 fps (hằng số 70 ms, nhảy xa thì bắt ngay); khung chỉ nới 5%. TH1: `useNationalIdScan.check` tra trước, có hồ sơ thì gọi lọc + đóng modal ngay; thẻ xem trước chỉ hiện khi đã biết là hồ sơ mới. |

Bằng chứng: `e2e/patient-scan-id-tracking.spec.ts` **1/1** — camera giả phát mã QR lật gương
thấy-được-không-đọc-được, đo khung vẽ so với vị trí thật của mã trên màn hình: lệch **2 px**
mỗi cạnh (mã ~80 px, ngưỡng 4,6 px). `e2e/patient-scan-id.spec.ts` **5/5** — ca TH1 giờ tự
đóng modal và lọc danh sách, không bấm nút.

Bổ sung R-568: chủ dự án — không cần bấm "Mở camera quét", mở modal là quét. Camera bật
cùng modal (`cameraOn` mặc định bật); nút thành "Dừng camera"; camera bị từ chối / không có
thì nút "Mở camera quét" **thử lại** (`useQrCamera.attempt`) thay vì tắt. Spec tách:
`patient-scan-id-camera.spec.ts` (camera giả, không bấm nút nào), `patient-scan-id.spec.ts`
(chỉ ảnh — trình duyệt không có camera), `patient-scan-id-tracking.spec.ts` (+ dừng/mở lại).
Tổng 9/9 cùng `patient-national-id.spec.ts`.

## 2026-09-24 (khuya) — Quét CCCD: khung lúc nhỏ lúc vừa (R-569)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-569 | Chủ dự án: khung bám vẫn không khớp mã QR, lúc nhỏ lúc vừa | Tái hiện bằng khung hình tổng hợp (mã CCCD 41 ô, 3 px/ô, mờ 3×3, nhiễu ±18, nghiêng nhẹ): kết quả **đọc được** luôn cho viền đúng (1,00), nhưng kết quả ZXing **thấy mà chưa đọc được** (ChecksumError, `returnErrors`) thỉnh thoảng báo một vùng con **0,26–0,43** kích thước thật — 6/60 khung. Sửa: `utils/qr/sightingFilter.ts` — kết quả đọc được luôn tin; chưa đọc được chỉ tin khi gần vuông (cạnh ≤1,4×, đường chéo ≤1,3×) và cỡ lệch ≤25% so với lần tin gần nhất (≤1,5 s); chưa có gì để so thì phải hai khung liền nhau khớp (≤15% cỡ, tâm lệch ≤½ cạnh). Khung bị loại coi như không thấy (khung cũ giữ 300 ms). |

Bằng chứng: chạy bộ lọc trên chính 60 khung đó — sai cỡ **6 → 0**, không khung đúng nào bị bỏ.
`patient-scan-id-tracking` (khung lệch 2 px), `-camera`, `patient-scan-id.spec.ts`: **6/6**.
Camera điện thoại thật chưa kiểm tự động.

## 2026-09-25 — Quét CCCD: webcam laptop hơi mờ thì không nhận mã (R-570)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-570 | Chủ dự án: quét bằng cam laptop, hình hơi mờ nhưng vẫn thấy QR, không detect được; modal lại cuộn khi có 2 camera | Ảnh chụp của chủ dự án: mã nhoè ~1 ô trở lên (webcam lấy nét cố định, thẻ đưa quá gần) — không bộ đọc nào đọc được khung đó, kể cả khi làm nét / đổi kênh màu / đổi binarizer (đã thử trên chính ảnh, chỉ trong scratchpad, không lưu vào repo). Đo trên mã tổng hợp: ZXing đọc tới σ≈0,4 ô; làm nét (unsharp mask) đẩy lên σ≈0,5 ô. Sửa: worker thêm `sharpened()` (3 box blur ≈ Gauss) — vùng mã phóng to chưa đọc được thì làm nét theo cỡ ô rồi đọc lại; khung không thấy gì thì thử bản làm nét với binarizer LocalAverage rồi GlobalHistogram. Camera có `focusMode: continuous` thì bật (`keepFocusing`). Lời nhắc màu hổ phách: thấy mã mà >2,5 s chưa đọc → "Hình đang mờ — đưa thẻ ra xa camera (20–30 cm)…"; >4 s không thấy mã → "Chưa thấy mã QR — …". Ô chọn camera chuyển lên cùng hàng nút (hết cuộn). |

Bằng chứng: `e2e/patient-scan-id-soft.spec.ts` — camera giả phát thẻ mờ 0,55 ô (ZXing không làm nét
chỉ "thấy", không đọc được — kiểm trong Node) → app đọc ra số CCCD và tên. **Kiểm đảo**: tạm tắt
`sharpened()` → spec này **đỏ**; bật lại → xanh. `-tracking` thêm kiểm lời nhắc "Hình đang mờ".
Cả bộ Quét CCCD **7/7**. Khung mờ ~1 ô trở lên (như ảnh chủ dự án) vẫn không đọc được — giới hạn
quang học; cách xử lý là đưa thẻ ra xa, dùng camera điện thoại, hoặc "Tải ảnh" chụp bằng điện thoại.

## 2026-09-25 — Đồng bộ danh mục dịch vụ, mã dịch vụ tự sinh, dữ liệu cũ giữa các màn (R-571..R-576)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-571 | Chủ dự án: sửa giá dịch vụ ở Danh mục, sang màn bệnh nhân chọn dịch vụ vẫn ra giá cũ | Cache 5 phút; Danh mục chỉ invalidate `["taxonomy"]`, picker đọc `["catalog-options", …]`. Rà cả source ra thêm 16 chỗ cùng kiểu. Sửa tận gốc: `lib/queryEntities.ts` + `meta.invalidates` trên mutation, `MutationCache.onSuccess` làm mới mọi query của thực thể (không chờ refetch, để nút không quay lâu hơn). `cross-screen-freshness` 2/2 |
| R-572 | Nút "Nhập" hiện key `Taxonomy:Import:Btn` | Không phải thiếu migration: API chạy `--no-build` sau khi chỉ build DbMigrator, bin của Host còn Domain.Shared.dll hôm trước. Build lại Host → hết. Ghi vào memory |
| R-573 | Dịch vụ tạo mới không có mã → không đồng bộ được | Tài liệu và comment nói server sinh mã nhưng `CreateAsync` chỉ nhận mã từ client. Nay sinh 5 ký tự như bản gốc (dialog + nhập Excel); ô mã trống trong file không xoá mã đã có |
| R-574 | `taxonomy.spec` kéo-thả đỏ sau R-573 | Bảng vốn hiện mã dưới tên; selector `td:nth-child(2) p` bắt cả hai. Thu về `p.bd-cat-name`. `taxonomy*`+`payment-qr`+`branch-*` 63/63 trên production |
| R-575 | Dialog đồng bộ: nút X đè "Chọn tất cả"; "Lưu ý:" không đúng màu; bảng kết quả 2 dòng đã có thanh cuộn | `pr-8` như bản gốc; selector `.bd-sync-notice.ant-alert .ant-alert-title` thắng CSS-in-JS; `scroll.y` thay `sticky` |
| R-576 | Regression cấp 3 sau R-571: 39 test đỏ | Chạy lại đúng các spec đó trên bản build **HEAD** (cùng BE, cùng DB): 40 đỏ, cùng các test (selector trang bệnh nhân `.pd-profile-card`, `reception.spec` chờ `/visits` đã bỏ từ lâu…). 3 test chỉ đỏ ở bản mới chạy riêng: 2 xanh ở cả hai bản, 1 đỏ ở cả hai. Không regression; các spec rot đó chưa sửa |
| R-577 | Chủ dự án gửi ảnh staging: đồng bộ thất bại hiện `CLINIC_CONN_0001 — Kết nối không tồn tại hoặc chưa được kích hoạt.`, 6/6 thất bại; đồng bộ đơn lẻ toast "Đồng bộ thất bại: 0/1" | `flags` staging vẫn `active` → lỗi của đối tác, được chuyển nguyên mã + thông điệp vào `batchErrors`. Local trước đó ghi "Không gửi được lô 1/1 — HTTP 401: {…}". `HttpClinicPartnerClient.ReadPartnerError` đọc `{code,message}` / `{errorCode,message}` / `{error:{…}}` (kể cả 2xx không có `results`) → `reason` = mã. Sandbox thêm công tắc từ chối; `taxonomy-service-sync` 8/8 trên :5173 và production (test mới: hộp lỗi, 7 ô, toast 0/3 và 0/1, dialog sửa đóng, không dịch vụ nào thành "đã đồng bộ"); contract `PartnerErrorBodyTests` 8 ca |
| R-578 | Chủ dự án: tick checkbox trong dialog đồng bộ bị trễ; bấm "Đồng bộ" không thấy loading | Đo: 1.066 nhóm (phần lớn nhóm e2e để lại) — mỗi tick 300–550 ms vì mọi hàng nhận cả tập "đã chọn" nên render lại hết. Sửa: danh sách ảo hoá (`ServiceSyncGroupList`, `@tanstack/react-virtual`), hàng nhận số đếm / trạng thái, tập chỉ đưa cho nhóm đang mở → 11–31 ms, ~12 hàng render. Loading: bản gốc đóng dialog ngay, sandbox trả lời tức thì nên spinner trên thanh công cụ không kịp thấy; nay dialog ở lại với "Đang đồng bộ..." khoá đến khi có kết quả (`AppDialog.savingLabel`). Sandbox thêm trả lời chậm; `taxonomy-service-sync` kiểm tra trạng thái chờ. `taxonomy*`+`payment-qr`+`branch-*` 64/64 trên production. Lưu ý: khi chi nhánh 1 đang bật đồng bộ (demo), `taxonomy-dialogs` đỏ **đúng thiết kế** — dialog dịch vụ ở lại sau khi lưu; chạy các spec Danh mục khi cờ tắt |
| R-579 | Chủ dự án: tự dọn nhóm rác do test tạo; bảng kết quả đồng bộ sát lề trái | `e2e/fixtures/cleanup.ts` `purgeRunGroups`: sau mỗi spec, xoá qua API thật (từng dịch vụ còn sống, rồi nhóm) mọi nhóm `care_service` tên `<tiền tố> <6 số>` — chỉ dạng mà `runId()` sinh ra. Gắn vào `taxonomy`, `taxonomy-groups`, `taxonomy-dialogs`, `taxonomy-import`, `branch-switcher`, `taxonomy-service-sync`. Chạy 6 spec đó: 43/43, 13 nhóm được tạo và xoá hết, còn lại 0. Trước đó đã xoá mềm 1.106 nhóm tồn đọng bằng SQL (mốc `DeletionTime = 2026-09-25 20:00:00+07` để hoàn tác). Bảng kết quả: ô bảng small của antd chỉ 8px → 16px mỗi bên (selector phải có `.ant-table.ant-table-small` mới thắng CSS-in-JS) |
| R-580 | CD 2026-09-25: CI Backend đỏ, deploy bị bỏ qua — `PermissionBridgeTests.Every_Legacy_Policy_In_Use_Outside_SystemAdmin_Should_Be_Bridged`: `ClinicConnectionAppService -> BlueDental.ClinicIntegration.ManageConnections` | Mọi quyền legacy dùng trong `[Authorize]` phải bridge sang ability, trừ nhóm SystemAdmin. Kết nối đối tác ở bản gốc thuộc SuperAdmin và không ability nào tương ứng → chuyển thành `BlueDental.SystemAdmin.ClinicConnections` (không bridge, như các quyền SystemAdmin khác). Lúc trước chỉ chạy test theo bộ lọc nên không thấy; nay chạy đúng lệnh CI (`dotnet test BlueDental.sln -c Release`): 1.103/1.103 |

## 2026-09-25 — Thêm đơn thuốc: ô bắt buộc chưa có tên và dấu * (R-581)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-581 | Chủ dự án (mục 21 danh sách lỗi): trong dialog "Thêm đơn thuốc", ô chọn bác sĩ trống trơn (chỉ kính lúp), ô thuốc trong bảng ghi "Chọn thuốc"; bản gốc ghi "Chọn bác sĩ*" và "Tên thuốc*" ngay trong placeholder, có kính lúp, dấu * đỏ | `ServerSearchSelect` chưa được truyền placeholder; select thuốc dùng key `Common:Rx:SelectMedicine` và không có prefix. Sửa: component chung `RequiredPlaceholder` (chữ + `<span.bd-required-mark>*`, token đỏ cùng `.floating-field-required`), `ServerSearchSelect.placeholder` nhận `ReactNode`; ô bác sĩ và ô thuốc (bảng desktop, dùng chung với Đơn thuốc mẫu ở `/taxonomy`) đặt placeholder này, ô thuốc thêm `prefix` kính lúp; card mobile đánh `required` cho FloatingField "Tên thuốc". `aria-label` giữ nguyên nên các spec định vị bằng `getByLabel` không đổi. Xoá `.rx-required` không dùng trong `prescription.css`. |

Bằng chứng: bản build production (`vite preview` cổng 8091, API thật 5000) —
`e2e/prescription.spec.ts` 5/5 và `taxonomy-dialogs.spec.ts` "a prescription template stores
its lines…" 1/1 → **6/6**. Ảnh chụp local đối chiếu với
`reference-private/plan-detail/ref-detail-prescription-dialog.png`: hai ô khớp chữ, dấu *, kính lúp.
Retest level 2 (một feature) + spec Đơn thuốc mẫu vì dùng chung bảng dòng thuốc.

## 2026-09-25 — Màn hình đợi: dựng lại theo BA mục 22 (R-582..R-583)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-582 | BA mục 22: "Lấy số mới" bắt chọn bệnh nhân và quầy trong khi khách vãng lai chưa có hồ sơ; màn chính không có khối quầy tiếp nhận, chỉ một nút "Gọi số tiếp theo" chung ở header, bảng có cột Bệnh nhân; `call-next` chỉ lấy số đã gắn quầy. | BE: `QueueTicket.PatientId` thành `Guid?` (migration `MakeQueueTicketPatientOptional`), guard trùng số chỉ chạy khi có PatientId; `CallNextAsync` bắt buộc `counterId` (`Queue:0004`), quầy tạm ngưng bị từ chối (`Queue:0005`), lấy số **Waiting** đầu tiên trong hàng chờ chung (`CounterId == null` hoặc `== counterId`, ưu tiên trước rồi số nhỏ), tự `Complete()` các số Called/Serving còn ở quầy đó; thêm `GET counters/board` và `GET display/board?branchId` (ẩn danh) trả `current`/`next` theo quầy — quầy tạm ngưng `next = null`. FE: `CreateTicketModal` chỉ còn Độ ưu tiên / Loại dịch vụ / Ghi chú; `CounterBoard` + `CounterBoardCard` (thẻ theo quầy, badge trạng thái, số đang phục vụ + "Gọi lúc HH:mm", số tiếp theo + tag Ưu tiên, nút gọi riêng, quầy tạm ngưng mờ và khoá nút); bỏ nút gọi ở header; bảng bỏ cột Bệnh nhân (bảng này bỏ hẳn ở R-583); TV `/queue/display` dùng `DisplayCounterCard` (số đang phục vụ + Tiếp theo); mọi inline style của feature chuyển sang class trong `queue.css`. Quyết định chủ dự án: cùng một số "Tiếp theo" trên mọi thẻ; gọi số mới tự hoàn thành số cũ; quầy tạm ngưng vẫn hiện; ẩn cột Bệnh nhân; số bỏ qua chỉ gọi lại thủ công. |
| R-583 | Chủ dự án (ảnh chat với BA, mockup thẻ quầy): "là thay thế hoàn toàn card thống kê với table đó" — khối thẻ quầy phải **thay thế** 4 thẻ KPI, bộ lọc ngày/quầy và bảng số thứ tự, không đặt phía trên chúng. | `QueuePage` chỉ còn PageHeader (Lấy số mới / Quản lý quầy / Mở màn hình TV) + `CounterBoard` + 2 modal; xoá `QueueStatsBar`, `QueueTicketTable`, `useTicketRowActions`, `useWaitingTimer`, `utils/waitingTime` và các block CSS KPI/bảng; `api/` giữ nguyên (`useQueueList`, `useQueueStats`, serve/complete/skip/recall) vì endpoint vẫn sống. Thẻ dựng theo mockup: avatar tròn + tên quầy + badge trạng thái; "Đang phục vụ" số 30px màu accent + loại dịch vụ bên cạnh (BE thêm `ServiceType` vào `BoardTicketDto`), icon đồng hồ + HH:mm; "Tiếp theo" số + loại dịch vụ; nút full-width icon loa "Gọi số tiếp theo" cùng màu accent; accent xoay xanh dương / tím / xanh lá theo vị trí (`queue-counter--accent-{i%3}` đặt `--counter-accent`, không hex trong tsx). Lưới `minmax(300px, 1fr)` — 240px làm tên quầy và loại dịch vụ bị cắt. **Hệ quả cần chủ dự án biết:** màn hình không còn nút Phục vụ / Hoàn thành / Bỏ qua / Gọi lại trên từng số — số bị bỏ qua (Skipped) hiện chỉ gọi lại được qua API `tickets/{id}/recall`, chưa có chỗ bấm trên UI. Spec UI: bỏ assert cột Bệnh nhân và dòng bảng "Hoàn thành" → assert không có `table`, có heading "Các quầy tiếp nhận", `.queue-counter__meta` khớp `/\d{2}:\d{2}/`, số ưu tiên đã tự hoàn thành đọc qua `GET tickets?status=4`. |

Bằng chứng: build production (`vite preview` cổng 8083, host 5000 build mới, DB thật) —
`e2e/queue-api.spec.ts` 9/9 (HTTP thật từ trang đã đăng nhập: lấy số không bệnh nhân,
thứ tự ưu tiên → số nhỏ, tự hoàn thành, 0004/0005, bỏ qua không bị lấy, board quầy tạm
ngưng, TV ẩn danh, chi nhánh 2 không thấy quầy và bị 404) và `e2e/queue.spec.ts` 1/1
(UI thật: không còn bảng, thêm 2 quầy, lấy 3 số có 1 ưu tiên, gọi theo từng thẻ, số
ưu tiên tự hoàn thành, reload giữ nguyên, tạm ngưng khoá nút, TV hiện đúng). Sau R-583
chạy lại đủ 10/10 với host build mới (`ServiceType`) và bundle mới. Cả hai spec xả hàng chờ chung qua `call-next` thật
trước khi đo. Lần chạy đầu đỏ giả vì `getByRole("cell", { name })` khớp cả ô trạng thái
(Switch mang `aria-label` = tên quầy) → `exact: true`. Retest level 2 (một feature).

## 2026-09-28 — Tab Hồ sơ: mã phiếu chuyển thẳng tới chi tiết phiếu (BA mục 24, R-584)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-584 | BA mục 24 "Chuyển hướng tái khám": ở bảng lịch sử điều trị tab Hồ sơ, bấm mã phiếu (REX001 trên dòng Tái khám, DTxx trên dòng công đoạn) phải chuyển thẳng tới chi tiết **đúng phiếu đó** — breadcrumb kết thúc bằng mã phiếu (ảnh: `[BD260026] - … > Kế hoạch điều trị > DT06`). Local chỉ mở `?tab=treatment-plan` (danh sách mọi phiếu). | `treatmentColumns.onOpenPlan` nay nhận dòng; `PatientProfileTab` điều hướng `planDetailPath(patient.id, row.treatmentPlanId, branchId)` — cùng trang dialog công đoạn đã dùng từ 2026-09-07, nhưng **không** kèm `planTab`, giống chip DT ở tab Kế hoạch điều trị (R-274) để trang tự rơi về Chi tiết. Dòng tái khám không có trang riêng nên REX đưa về phiếu chứa nó (`treatmentPlanId` kế thừa từ service line). Chip "Tái khám" giữ là nhãn, không phải link. |

Bằng chứng: bản build production (`vite preview --host 127.0.0.1` cổng 8091, API thật 5000, DB thật) —
`e2e/patient.spec.ts` "a tái khám picks its teeth…" 1/1, thêm assert cuối: bấm `.pd-tr-code` của
dòng tái khám → URL `/treatment-plan/<guid>?branchId=`, `.pdt-crumb--current` = mã phiếu.
`tsc` sạch. Retest level 2 (một feature); không spec nào khác bấm mã phiếu ở tab Hồ sơ.

## 2026-09-28 — Thanh toán phiếu có voucher/giảm giá: thu đúng số sau giảm (BA mục 23, R-585..R-588)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-585 | BA mục 23 "Check lại phần thanh toán khi đã sử dụng voucher": phiếu 3.400.000 đ có voucher 1.800.000 đ (Thành tiền 1.600.000 đ) nhưng dialog Tạo phiếu thanh toán đề xuất và server chấp nhận thu **3.400.000 đ** → Còn lại của phiếu in `−1.800.000 đ`. | Mức giảm ở cấp phiếu (voucher + `%`/tiền trên phiếu, cùng một con số `PlanDiscountAmount`) chưa bao giờ được chia xuống dòng dịch vụ: `Còn nợ` từng dòng = `EffectiveAmount − paid` (chỉ trừ giảm giá của dòng) và trần thu ở server (`CapByServiceAsync`) cũng đọc con số đó. Domain `TreatmentPlan` thêm `DiscountShares()` (chia `PlanDiscountAmount` theo tỉ lệ `EffectiveAmount` của các dòng còn tính tiền, làm tròn đồng, phần lẻ dồn vào dòng cuối để tổng luôn khớp `TotalAmount`), `ChargedAmountOf(line)` và `CompletedValue` trừ phần chia đó. `TreatmentServiceDto.ChargedAmount` + `OutstandingAmount = max(charged − paid, 0)`; `CapByServiceAsync` kẹp theo `ChargedAmountOf` nên vượt → `Billing:0092` (403). Dialog in `Còn nợ` và số bên phải dòng theo `chargedAmount`, ô tiền vượt trần báo đỏ "Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán". `GetAccountAsync` dựng `Plans` qua `_treatments.GetListAsync` nên dialog và trần server cùng một nguồn. **Lưu ý cho BA:** phiếu đã thu dư trước bản sửa vẫn in `−1.800.000 đ` cho tới khi lập phiếu hoàn 1.800.000 đ — mã không tự sửa dữ liệu cũ. |
| R-586 | Chủ dự án (ảnh dòng Đơn giá 250.000 / Tổng giảm giá 50.000 / Thành tiền 200.000): khối "Tổng tiền theo kế hoạch" của dialog in Tổng tiền 200.000 / Giảm giá 0 / Tổng tiền sau giảm 200.000 — "Tổng tiền phải là 250k và giảm giá 50k". | `Tổng tiền` từng lấy `servicesTotal` (đã trừ giảm giá dòng) và `Giảm giá` chỉ lấy `planDiscountAmount`, nên giảm giá của dòng biến mất khỏi khối. Domain thêm `ServicesGrossTotal` (Σ `GrossAmount` các dòng còn tính tiền) và `TotalDiscountAmount = ServicesDiscountAmount + PlanDiscountAmount`; `TreatmentPlanSlipDto` thêm `servicesGrossTotal`, `servicesDiscountAmount`, `totalDiscountAmount`. Dialog: Tổng tiền = gross, Giảm giá = **mọi** mức giảm (dòng + phiếu/voucher), Tổng tiền sau giảm = `totalAmount` → 250.000 / 50.000 / 200.000. `TreatmentPlanSlipTests` thêm ca gross − mọi giảm = TotalAmount (dòng Cancelled không tính). |
| R-587 | Trong lúc chạy lại `treatment-plan-detail.spec.ts`, hai ca cũ (kéo sắp xếp dòng, Chuyển đổi) đỏ: picker dịch vụ chào cả dịch vụ đã xoá mềm ("DV CACHE …"), thêm dòng bằng id đó bị 403 `Catalogs:CatalogEntryNotFound`. | `CatalogEntryAppService.GetListAsync` tắt filter xoá mềm với nhóm soft-deletable (để màn Danh mục hiện dòng "Đã xoá") và chỉ lọc `IsDeleted` khi có tham số — `useCatalogOptionSearch` (hook dùng chung, 6 nơi gọi) chưa gửi. Hook nay gửi `isDeleted: false` luôn, `isActive: true` trừ khi `includeInactive`. Level 3 vì hook dùng chung → chạy lại các spec dùng picker (bên dưới). Ca e2e mới của R-586 cũng lấy `care_service` còn sống từ API thay vì `serviceId` của phiếu mẫu (phiếu mẫu trỏ vào dịch vụ đã xoá mềm). |
| R-588 | Chủ dự án (ảnh dev :5173, phiếu 180.000 − 50.000, đã thu 120.000): mở dialog từ trang phiếu, gõ 2.000 → đỏ cả "Bạn cần chọn ít nhất 1 dịch vụ" lẫn "Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán", "k tạo được". | Không phải lỗi tiền: dialog mở từ trang phiếu **không tick sẵn** dòng nào (đúng bản gốc, `focusServiceId=null`), nên trần thu = 0 và mọi số gõ vào đều "vượt quá" — thông báo thứ hai gây hiểu nhầm là bị chặn. `overpaid` nay chỉ tính khi đã chọn dịch vụ (`!noService && total > chosenDue`); tick dòng rồi 2.000 ≤ Còn nợ 10.000 đi qua bình thường. Spec R-586 thêm: bỏ tick Chọn Tất Cả → chỉ còn một dòng đỏ "Bạn cần chọn ít nhất 1 dịch vụ"; tick lại → số gross lại bị "vượt quá". |

Sửa spec kèm theo (đỏ sẵn, không liên quan tiền): `patient.spec.ts` "cột Thanh toán…" bấm link
"Hồ sơ" trước khi tìm nút (bấm bệnh nhân rơi vào tab Chẩn đoán & Tư vấn); "one receipt covers
several services…" so phần chia theo **id dịch vụ đã POST** + số phiếu thu tăng 1 (phiếu DT08 dùng
chung đã có phiếu thu, thứ tự dòng dialog ≠ thứ tự plan) và mở rộng bảng lên 100 dòng trước khi
tìm hàng (bệnh nhân e2e đã quá 20 dòng).

Bằng chứng: Domain.Tests **407/407**, Application.Tests **626/626**, `tsc` sạch. Real-stack trên bản
build production (`vite build --outDir dist-preview-r584`, `vite preview` :8081, host build lại :5000,
PostgreSQL thật): `treatment-plan-detail` + `consulting-delete-and-picker` **15/15** — ca mới "a
discounted slip is collected at its after-discount price, never the gross one": giảm 10% phiếu qua
`POST …/discount`, thêm dòng 250.000 − 50.000 qua `POST …/services`, đọc `servicesGrossTotal` /
`servicesDiscountAmount` / `planDiscountAmount` / `totalDiscountAmount` / `totalAmount` và Σ
`chargedAmount` = `totalAmount`; UI: Doanh thu dự kiến = số sau giảm, hai dòng dialog in đúng
`chargedAmount`, "Chọn Tất Cả" điền số sau giảm, khối Tổng tiền/Giảm giá/Tổng tiền sau giảm/Còn lại
= gross / mọi giảm / sau giảm / 0 đ, gõ số gross → lỗi đỏ, POST gross thẳng API → **403
`Billing:0092`**, thu số sau giảm → Đã thanh toán = số đó, Công nợ 0, reload giữ nguyên, dialog
`.pd-newpay-empty`. `debt-history` + `cross-screen` **6/6**; `patient.spec` nhóm thanh toán **6/6**
(ca split chạy lại riêng sau khi mở rộng bảng). Retest level 2 (F-22) + level 3 cho hook picker
dùng chung. Chưa commit. R-588: build lại bundle, ca "a discounted slip…" **1/1** trên :8081 + host :5000, `tsc` sạch.

## 2026-09-28 — Tab Hồ sơ: chip "Các chẩn đoán" liệt kê phiếu chẩn đoán (BA mục 25, R-589)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-589 | BA mục 25 "Chưa cập nhật dữ liệu tab chuẩn đoán": ở bảng lịch sử điều trị tab Hồ sơ, chip **Các chẩn đoán** luôn in `Chưa có điều trị` dù tab Chẩn đoán & Tư vấn có phiếu CD. Staging (bệnh nhân HN8509, phiếu CD05) in một dòng cho mỗi phiếu: Ngày = ngày lập phiếu, Dịch vụ = **tên chẩn đoán** in đậm **không** kèm mã bấm được + chip xám "Chẩn đoán", Nội dung điều trị = ghi chú của phiếu, chip Răng, SL 1, Bác sĩ điều trị = bác sĩ chẩn đoán 1 (không dòng "Phụ tá:"), Bác sĩ hỗ trợ = bác sĩ 2 hoặc "Không có", Công đoạn / Chăm sóc trống, Thao tác giữ icon tiền nhưng **mờ**. | Chip là một bộ lọc thuần client trên các dòng công đoạn + tái khám (`visibleRows`), và nhánh `filter === "diagnosis"` chưa từng có — mọi dòng bị loại; tab Hồ sơ cũng không tải phiếu chẩn đoán (nợ ghi ở mục "2026-09-07 (tiếp 6)", sau R-262: "ba chip lọc … vẫn không lọc gì"). Nay `TreatmentRow.kind` thêm `"diagnosis"`, `buildTreatmentRows` nhận thêm `diagnoses` (`usePatientDiagnoses`, cùng `maxResultCount: 1000` như hai truy vấn kia) và dựng mỗi phiếu thành một dòng qua `diagnosisRow()` (các cột tiền/công đoạn của `TreatmentServiceDto` điền giá trị rỗng, id dòng = id phiếu); cột Dịch vụ bỏ `.pd-tr-code` và in chip `.pd-tr-chip--diagnosis` (xám như Tái khám), cột Bác sĩ/Công đoạn/Chăm sóc chuyển điều kiện từ `kind === "reExamination"` sang `kind !== "stage"`, nút tiền `disabled`. Dòng chẩn đoán **chỉ** hiện dưới chip của nó — "Tất cả" và các chip khác giữ nguyên danh sách điều trị vì việc staging có gộp phiếu CD vào "Tất cả" hay không **chưa quan sát** (`unknowns.md`, cùng câu hỏi icon tiền mờ có bấm được không). |

Bằng chứng: bản build production (`vite build --outDir dist-preview-r589`, `vite preview --host 127.0.0.1` cổng 8091,
API thật 5000, DB thật) — spec mới `e2e/patient.spec.ts` "Các chẩn đoán lists the patient's diagnosis slips as their
own rows" **1/1**: lập phiếu qua form thật (POST `patient-diagnoses`, ghi chú `e2e chẩn đoán <runId>`, răng 18), sang
Hồ sơ → chip → đúng một dòng mang ghi chú; mọi dòng dưới chip đều có `.pd-tr-chip--diagnosis`; tên chẩn đoán khớp
`.pd-cell-diagnosis` của bảng bên tab kia, không `.pd-tr-code`, không chứa mã CD, chip "Chẩn đoán" nền
`rgb(247,248,253)`, răng "18", SL 1, Bác sĩ điều trị khớp bác sĩ 1 và không `.pd-tr-sub`, "Không có", không
`.pd-tr-addstage`/`.pd-tr-warranty`/`.pd-tr-care`, `.pd-tr-pay` disabled; chip "Tất cả" **không** có dòng đó; reload
→ chip lại → vẫn đủ. Chạy kèm "a tái khám picks its teeth…" **1/1**; "Lưu Chẩn Đoán files a slip…" đỏ ở
`toHaveURL(/tab=consulting/)` sau reload — **đỏ sẵn** từ đợt 2026-09-24/25 (ghi ở mục "2026-09-24 (đợt 3)", sau R-548), qua bước
kiểm răng "18, 16" rồi mới đỏ, không thuộc nhánh này. `tsc` sạch. Retest level 2 (F-38). Chưa commit.

## 2026-09-28 — Voucher: "Lượt dùng" nhích khi mở kế hoạch điều trị (BA mục 24, R-590)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-590 | BA mục 24 "Xem lại khi nào kích hoạt số lượt sử dụng voucher": chọn voucher ở chân Chẩn đoán & Tư vấn rồi Thêm kế hoạch điều trị, sang `/voucher` cột **Lượt dùng** vẫn `0 / 100`. Staging (voucher mới + kế hoạch mới, 2026-09-28): tick voucher không gửi gì; nút Thêm kế hoạch gửi `POST /patient-treatments` rồi **`POST /voucher/apply`** cho từng coupon → `usedCount + 1` ngay lúc **tạo kế hoạch** (không phải lúc thanh toán), server tự tính tiền, kế hoạch mang `appliedCoupons[]`; huỷ dòng dịch vụ không hoàn lượt. | Local chỉ gửi `voucherDiscountAmount` do client tính — `Voucher.Redeem` chưa ai gọi, `usageLimit`/`perCustomerLimit` không được kiểm, kế hoạch không biết mình dùng voucher nào. Sửa: `OpenTreatmentPlanDto.VoucherIds: List<Guid>` thay `VoucherDiscountAmount`; Domain `TreatmentPlan.RedeemVouchers(vouchers, priorUsesByPatient, clinicDay, newId)` kiểm **trước** (Active, còn lượt, trong hạn theo ngày **UTC+7**, ≥ `minOrderValue`, scope `Treatment`, cùng chi nhánh hoặc không chi nhánh, không trùng, exclusive đứng một mình, phiếu chỉ redeem một lần → `Promotions:0007`; `perCustomerLimit` đếm từ `bd_treatment_plan_vouchers` của bệnh nhân → mã mới **`Promotions:0010`** VoucherPerCustomerLimitReached, en/vi) rồi mới `Voucher.Redeem` từng cái, tự tính tiền (Money = mệnh giá, Percentage = % × tổng dịch vụ cap `maxDiscountAmount`), cộng vào `VoucherDiscountAmount`, cap tổng phiếu, ghim snapshot `TreatmentPlanVoucher` (bảng mới `bd_treatment_plan_vouchers`, migration `20260928063433_AddTreatmentPlanVouchers`, cascade, field-backed). AppService redeem **cùng unit of work** với mở phiếu: phiếu không ghi được → không mất lượt; voucher từ chối → không mở phiếu. `TreatmentPlanSlipDto.appliedVouchers[]` (= `appliedCoupons` + `discountAmount`) trả về ở mọi lần đọc phiếu. FE: gửi `voucherIds` (`useConsultingActions.addToPlan`, `PatientConsultingTab`), số ở chân phiếu chỉ còn là **xem trước**; thêm entity `voucher` vào `ENTITY_QUERY_ROOTS`, `useOpenTreatmentPlan` invalidate `["vouchers"]` để bảng `/voucher` và picker đọc lại. |

Bằng chứng: Domain `TreatmentPlanVoucherTests` **12/12** (đốt một lượt mỗi voucher + snapshot 200k + 10 % cap 250k trên 3M
→ 450k / 2.55M; lượt cuối → `OutOfUses`; một voucher từ chối → không cái nào mất lượt; chưa publish / dưới ngưỡng / hết hạn;
chi nhánh khác từ chối, không chi nhánh áp được; scope Service từ chối; exclusive đứng một mình; cùng voucher hai lần;
`perCustomerLimit` → `Promotions:0010`; phiếu redeem một lần; giảm không vượt tổng phiếu; danh sách rỗng no-op),
Application `PatientTreatmentVoucherContractTests` 3/3, EF `ClinicalMappingTests` +2 (bảng, navigation Field + Cascade).
FE `tsc`/eslint sạch. Bản build production (`vite build --outDir dist-preview-voucher`, `vite preview` cổng **8090**, host
build lại cổng **5019**, DB thật, migration đã apply): `consulting-plan.spec.ts` ca mới "Thêm kế hoạch điều trị raises a slip
off the ticked line, converts it, and burns the picked voucher's use" **1/1, chạy hai lần** — ca **tự tạo dữ liệu** trên chi
nhánh 1 qua API thật (phiếu CD + dòng tư vấn 800.000, voucher `VC<runId>` fixed_amount 200.000 scope treatment
usageLimit 100, publish), tick dòng → `GET vouchers/available?orderAmount=800000`, chọn voucher → `usedCount` **vẫn 0**
(tick không đốt), Thêm kế hoạch → body `voucherIds = [id]` và **không** có `voucherDiscountAmount`, response
`voucherDiscountAmount 200.000`, `totalAmount 600.000`, `appliedVouchers[0] = {voucherId, code, 200.000}`, URL
`tab=treatment-plan`, advise `status 3` trỏ `treatmentPlanId` = phiếu, `usedCount` **0 → 1**, `GET patient-treatments/{id}`
đọc lại vẫn có coupon, `/voucher` dòng voucher in **`1 / 100`**. DB: `bd_treatment_plan_vouchers` một dòng 200.000 nối
`bd_vouchers.UsedCount = 1` và `bd_treatment_plans.VoucherDiscountAmount = 200000`. **12 ca còn lại của
`consulting-plan.spec.ts` đỏ sẵn trên máy này, không do nhánh này**: cả 12 dừng ở màn "Không tìm thấy hồ sơ bệnh nhân"
vì spec ghim cứng `PATIENT = 3a238cc0-…` chi nhánh 2 mà DB local không có (chi nhánh 2 chỉ có 2 bệnh nhân, 0 dòng tư vấn,
0 voucher `CN2*` — bước seed voucher bị bỏ qua vì chi nhánh 1 đã có voucher); cần seed lại chi nhánh 2 (DbMigrator) rồi
chạy lại, không sửa spec theo. Retest level **2** (F-09) + **3** cho F-08 (voucher list đọc `usedCount`) và F-22 (số tiền
phiếu không đổi cách tính, chỉ đổi nơi tính). Chưa commit.

## 2026-09-28 — Zalo OA integration (F-16, R-591..R-603)

| ID | Hiện tượng / Hạng mục | Nguyên nhân / xử lý |
|---|---|---|
| R-591 | Zalo OA domain entities and EF mapping: `ZaloOaConnection`, `ZaloMessageLog` persisted to `bd_zalo_oa_connections` and `bd_zalo_message_logs`; migrations `AddZaloOaIntegration` applied via DbMigrator. | New bounded-context folder `Domain/Zalo/`, EF mapping in `BlueDentalDbContextModelCreatingExtensions`, `DbSet` entries on `BlueDentalDbContext`. |
| R-592 | ZaloOaAppService OAuth flow: `GetConnectUrlAsync` returns the Zalo OAuth authorization URL with correct scopes; `OAuthCallbackAsync` exchanges the code, stores access + refresh token encrypted; `BootstrapImportAsync` seeds the OA name and avatar from the Zalo API; connection is branch-scoped and 403 on cross-branch access. | `Application/Zalo/ZaloOaAppService.cs`; `IZaloApiClient` in `Application.Contracts/Zalo/`; AES token encryption via `IZaloTokenEncryptor`. |
| R-593 | ZaloOaAppService template listing: `GetTemplatesAsync` calls the Zalo API and returns ZNS templates with status (`pending_review` / `enable` / `disable` / `reject`) and parameter list; templates cached 5 minutes per branch. | `ZaloApiClient.GetTemplatesAsync` calls `https://business.zalo.me/v2/template/all`; cache key `["zalo-templates", branchId]`. |
| R-594 | ZaloOaAppService send ZNS message: `SendMessageAsync` sends a ZNS via the Zalo API and persists a `ZaloMessageLog` with status `sent` or `failed`; failed messages store the error code and message from Zalo. | `ZaloOaAppService.SendMessageAsync`; `ZaloMessageLog` aggregate with `Outcome` enum; `MessageLog.cs` extended for Zalo source type. |
| R-595 | ZaloOaAppService messages list and stats: `GetMessagesAsync` returns paged message history filtered by status/date; `GetStatsAsync` returns sent/failed/total counts for the branch. | `ZaloOaAppService.GetMessagesAsync` / `GetStatsAsync`; `ZaloMessageLogDto`; branch-scoped filter applied at AppService layer. |
| R-596 | ZaloWebhookController GET probe returns 200 with the Zalo verification token; POST verifies the HMAC-SHA256 signature header before processing OA events (follow / unfollow / user-send-text). | `BlueDental.HttpApi/Zalo/ZaloWebhookController.cs` `[AllowAnonymous]`; `IZaloSignatureVerifier` computes `HMAC-SHA256(appSecretKey, rawBody)`; unknown event types are acknowledged and ignored. |
| R-597 | ZaloTokenRefreshWorker background job: refreshes the access token before it expires (sliding 90-day window), stores the new token; logs a warning if refresh fails but does not crash the worker. | `Application/Zalo/ZaloTokenRefreshWorker.cs` registered as ABP `IBackgroundWorker`; scheduled every 60 minutes via `PeriodicBackgroundWorkerBase`; reads connections due for refresh via `IZaloOaConnectionRepository`. |
| R-598 | FE ZaloConfigView: connected state shows OA name, avatar, enabled toggle and "Ngắt kết nối" button; disconnected state shows "Kết nối Zalo OA" button that navigates to the OAuth URL; toggle calls `PUT /api/v1/app/zalo/enabled`; disconnect shows a confirm dialog then calls `DELETE /api/v1/app/zalo/connection`. | `src/features/tools/components/ZaloConfigView.tsx`; hooks `useZaloStatus`, `useZaloConnectUrl`, `useToggleZalo`, `useDisconnectZalo` in `features/tools/api/zaloApi.ts`. |
| R-599 | FE ZaloTemplateView: table lists ZNS templates with columns Tên mẫu / Mã mẫu / Trạng thái (tag: xanh=enable, vàng=pending, đỏ=reject, xám=disable) / Tham số; server-side pager 10/20/50 rows. | `src/features/tools/components/ZaloTemplateView.tsx`; `useZaloTemplates` hook; status tag strategy map at module scope. |
| R-600 | FE ZaloMessageView: table lists sent ZNS messages with columns Số điện thoại / Mẫu / Thời gian / Kết quả (Thành công / Thất bại); counters Tổng / Thành công / Thất bại from `GET /stats`; status filter chip. | `src/features/tools/components/ZaloMessageView.tsx`; `useZaloMessages`, `useZaloStats` hooks; date-range filter and status filter combined in query params. |
| R-601 | FE SendZaloDialog: selects a template, fills required parameters, sends via `mutateAsync`, shows success toast or inline error from Zalo API; button disabled and loading while sending. | `src/features/cskh/components/SendZaloDialog.tsx` updated; `useSendZaloMessage` mutation in `features/cskh/api/messageApi.ts`; Zod schema per-template parameter validation. |
| R-602 | i18n keys vi/en for all Zalo UI strings: `Zalo:ConnectBtn`, `Zalo:DisconnectBtn`, `Zalo:EnableToggle`, `Zalo:SendSuccess`, `Zalo:SendFailed`, `Zalo:TemplateStatus.*`, `Zalo:WebhookVerified` added to `en.json` and `vi.json`. | `BlueDental.Domain.Shared/Localization/BlueDental/en.json` and `vi.json`; all user-visible strings in Zalo components use `L[]` via `BlueDentalAppService` base (R-525 pattern). |
| R-603 | `e2e/zalo-oa.spec.ts` — 13 real-HTTP tests on the production build: GET status returns shape with `isConnected`; connect-url returns an https Zalo URL; bootstrap-import 400 when no connection; send ZNS 400 without connection; webhook GET probe 200; webhook POST with wrong signature 401; webhook POST with correct signature 200; template list 200 shape when connected; messages list paged; stats counts; branch-2 account gets 403 on branch-1 connection; config sub-tab renders three panels; message sub-tab renders counter tiles. | `e2e/zalo-oa.spec.ts`; real ASP.NET Core pipeline, real PostgreSQL, no API interception; fixture seeds a mock Zalo connection for branch-1. |

## 2026-09-28 — Chi tiết kế hoạch: dòng dịch vụ không thấy giảm giá voucher (R-604)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-604 | Chủ dự án (ảnh dev :5173, bệnh nhân `[BD260225]`): danh sách kế hoạch in DT03 Tổng phiếu 32.000.000 / Giảm giá **3.200.000** / Thành tiền 28.800.000, đầu trang chi tiết Doanh thu dự kiến 28.800.000, nhưng bảng dịch vụ của DT03 in Tổng giảm giá **0 đ** / Thành tiền **32.000.000 đ**. | DT03 mang voucher `E2EKH268999` 10 % = 3.200.000 ở **cấp phiếu** (`VoucherDiscountAmount`, R-590). Server đã chia phần đó xuống từng dòng từ R-585 (`chargedAmount`), nhưng cột "Tổng giảm giá" vẫn đọc `discountAmount` (chỉ giảm giá của dòng) và "Thành tiền" đọc `effectiveAmount`. FE `planDetailTypes.ts` thêm `slipDiscountShare` (= `effectiveAmount − chargedAmount`, 0 trên dòng Huỷ/Thay thế/Đã chuyển), `lineTotalDiscount`, `lineNetAmount`; bảng (`serviceColumns.tsx`) và thẻ màn hẹp (`ServiceCardList.tsx`) in hai số đó. Tooltip "Tổng giảm giá" nay liệt kê từng nguồn: quy tắc giảm của dòng (nếu có), "Giảm giá kế hoạch / voucher chia cho dòng: … đ", "Voucher: <mã>" — khoá mới `Treatment:Pricing:SlipDiscountShare`, `Treatment:Pricing:SlipVouchers` (vi/en). Server không đổi. |

Bằng chứng: dev :5173 + host build lại cổng 5019, DB thật, trình duyệt thật (script Playwright chỉ đọc, không chặn API):
DT03 dòng "Cấy ghép Implant Thuỵ Sĩ" → Đơn giá 32.000.000 / Tổng giảm giá **3.200.000** / Thành tiền **28.800.000**, tooltip
"Giảm giá kế hoạch / voucher chia cho dòng: 3.200.000 đ / Voucher: E2EKH268999"; DT02 (giảm 20 % trên dòng, không voucher)
vẫn 500.000 / 100.000 / 400.000, tooltip "Giảm 20% trên đơn giá". `tsc -b` và oxlint sạch. Chưa chạy
`treatment-plan-detail.spec.ts` (spec chỉ kiểm tiêu đề cột "Tổng giảm giá"). Retest level 2 (plan detail). Chưa commit.

**Cập nhật (R-605):** tooltip hai dòng của R-604 ("Giảm giá kế hoạch / voucher chia cho dòng", "Voucher: <mã>") đã được
thay bằng bốn dòng của bản gốc; khoá `Treatment:Pricing:SlipDiscountShare` / `SlipVouchers` đã xoá.

## 2026-09-28 — Dòng dịch vụ: giá gốc, sửa đơn giá, bốn khoản giảm (R-605, R-606)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-605 | Chủ dự án (ảnh staging, dòng "Trồng Răng loại 2"): bảng in Đơn giá **1.000.000** (giá gốc), Tổng giảm giá 190.000, Thành tiền 810.000; tooltip bốn dòng "Giảm dịch vụ: 90.000 đ / Voucher dịch vụ: 0 đ / Giảm KHDT: 0 đ / Voucher KHDT: 100.000 đ"; bút sửa mở ô Đơn giá = **910.000** (đơn giá đã hạ); gõ 1.100.000 → "Đơn giá không được lớn hơn giá gốc của dịch vụ.". Local in Đơn giá = đơn giá thực thu, không có giá gốc, không chặn giá vượt, tooltip khác. | Khảo sát chỉ đọc (GET + bộ dựng cột/handler ✓ trong JS công khai, không gõ/lưu) — `docs/clone/pages/treatment-plan-detail.md` "giá gốc và bốn khoản giảm". Domain `TreatmentService.OriginalPrice` (+ migration `20260928094604_AddTreatmentServiceOriginalPrice`, dòng cũ = đơn giá hoặc giá niêm yết cao hơn của dòng tư vấn: 330 = đơn giá, 1 lấy giá tư vấn), `ListAmount`, `ServiceDiscountAmount` = (gốc − đơn giá) × SL + giảm dòng cũ; `FromAdvise`/`AddService` nhận `originalPrice` (tư vấn → `advise.OriginalPrice`, hàng mới → giá danh mục, chuyển đổi → đơn giá); `Revise`/`FromAdvise` chặn giá > gốc → mã mới **`Treatment:0040`** (vi/en). `TreatmentPlan.ServicesGrossTotal`/`ServicesDiscountAmount` tính theo giá gốc (tổng phải trả không đổi), `PlanVoucherAmount`, `DiscountShareParts()` tách phần chia của mỗi dòng thành Giảm KHDT / Voucher KHDT mà không đổi `chargedAmount`. DTO: `originalPrice`, `serviceDiscountAmount`, `planDiscountShare`, `planVoucherShare`. FE: `DiscountBreakdown` (bảng, thẻ ≤640, hàng mới), tooltip bốn dòng `placement="left"` với bong bóng đo từ bản gốc (nền `--bd-tooltip-bg` #1b2a41, bo 6, đệm 6/12, chữ 12/16, bước 20px — khớp từng dòng 295/315/335/355px), Đơn giá = giá gốc, Thành tiền sau mọi giảm; hàng sửa giữ Tổng giảm giá/Thành tiền đã lưu khi gõ (bỏ `amount` khỏi `EDITABLE_COLUMNS`), hàng mới tính Giảm dịch vụ theo giá đang gõ; ✓ chặn giá > gốc trên cả hàng mới và hàng sửa (ô đỏ + icon + câu lỗi, tự tắt khi giá về dưới trần). Không chép: Voucher dịch vụ luôn 0 và không có badge mã voucher của dòng (BlueDental chỉ đốt voucher cấp phiếu, R-590). |
| R-606 | Trong lúc chạy hồi quy, `treatment-stage-chain.spec.ts` "Chỉnh sửa rewrites a saved line…" đỏ 2/4 lần: PUT sửa dòng trả **200** nhưng ghi chú không có trong DB (`LastModificationTime` rỗng). | Có từ trước, không do R-605. Log host: "Executing ObjectResult…" → "An error occurred using a transaction." → "An exception occurred, but response has already started!". Mã nguồn ABP 9.3: dưới `app.UseUnitOfWork()`, `AbpUowActionFilter` chỉ `SaveChangesAsync`, còn `AbpUnitOfWorkMiddleware` **commit sau khi response đã ghi**, trên token huỷ của request — client rời trang ngay khi nhận 200 → commit bị huỷ → rollback, người dùng vẫn thấy toast thành công. **Đã sửa 2026-09-28 (chủ dự án duyệt):** `BlueDentalHttpApiHostModule.ConfigureUnitOfWork()` thêm `/api` vào `AbpAspNetCoreUnitOfWorkOptions.IgnoredUrls` — request `/api` không còn UoW của middleware, `AbpUowActionFilter` tự mở UoW và **commit xong trước khi ghi kết quả**; lỗi lúc commit nay trả về lỗi thật thay vì 200. Mọi endpoint `/api` đều là controller action (không có middleware/filter/minimal API tự viết), `/connect/*`, `/signalr/*`, `/health*` giữ nguyên middleware. |

Bằng chứng R-605: Domain **425/425** (+6 ca trong `TreatmentServiceReviseTests`: hạ giá là Giảm dịch vụ, không vượt giá gốc,
hàng mới không mở trên giá gốc, không có giá gốc thì lấy đơn giá, bốn phần cộng đúng 190.000/810.000 như staging, tách
Giảm KHDT/Voucher KHDT không đổi phần chia), Application **629/629**, EF **56/56**. E2E thật (login thật, API thật, PostgreSQL
thật, không chặn request): ca mới `treatment-plan-detail.spec.ts` "Đơn giá reads the giá gốc…" — tạo phiếu, giảm phiếu 20.000
qua API, Đơn giá = giá gốc, bút sửa mở đúng đơn giá, gõ trên giá gốc → câu lỗi, **0** PUT, số đã lưu giữ nguyên; PUT thẳng
→ 403 `Treatment:0040` câu tiếng Việt; hạ 10 % → Đơn giá giữ giá gốc, Tổng giảm giá = cắt + 20.000, Thành tiền và Doanh thu
dự kiến sau giảm, tooltip đúng bốn dòng; reload vẫn vậy, bút sửa mở giá đã hạ — đạt trên bản build production (`vite preview`
:8091) **và** dev :5173. Toàn bộ `treatment-plan-detail.spec.ts` **13/13** trên production build; `labo-api`, `debt-history`,
`treatment-stage-chain` (trừ R-606), `consulting-plan` "burns the picked voucher" 1/1, `patient.spec` "Hoàn thành ticks…" +
"one receipt covers…" 2/2. Sửa spec kèm theo: ca R-586 dùng giá danh mục thật thay 250.000 cố định (hàng mới không được vượt
giá danh mục); helper `labo-api`/`patient` thêm dòng với giá 0 (chỉ cần dòng tồn tại; dòng nguồn có thể cao hơn giá danh mục
hiện tại — 41 dòng như vậy trong DB local); ca kéo-thả và Chuyển đổi chọn dịch vụ **khác tên** dòng đầu thay `.nth(1)` (danh
mục bị ca `treatment-stage-chain` thêm dịch vụ giá 0 lên đầu → hai dòng trùng tên, kiểm tra "đã đổi chỗ" đúng ngay từ đầu).
`tsc`/oxlint sạch. Retest level **3** (tiền phiếu dùng chung: F-39, F-22, F-21, F-09). Chưa commit.

Bằng chứng R-606: phép thử HTTP thật (dev :5173 → host :5019 → PostgreSQL), PUT sửa ghi chú một dòng rồi **ngắt kết nối
ngay khi có header** (như reload), đọc lại bằng request riêng, 20 lượt: **host chưa sửa 0/20 giữ được** (20 lỗi "response has
already started" trong log), **host đã sửa 20/20** (0 lỗi) — cả qua dev :5173 lẫn build production :8091. Host test mới
`HostModuleConfigurationTests.Api_Requests_Commit_Before_Their_Response_Is_Written` (22/22). Retest level **3** — đổi cách
commit của mọi API ghi: xem kết quả chạy toàn bộ e2e bên dưới.


## 2026-09-28 — Thành tiền theo đơn giá khi sửa; đăng xuất xoá cache (R-607, R-608)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-607 | Chủ dự án (ảnh dev :5173, "Bọc răng sứ Zirconia" đang sửa, Đơn giá 3.600.000): "khi chỉnh sửa đơn giá, onChange thì column thành tiền cũng phải cập nhật giá theo luôn" — Thành tiền vẫn in 3.050.000 đã lưu. | R-605 đọc sai bản gốc: kết luận "Thành tiền giữ nguyên khi gõ" chỉ dựa vào ảnh chụp lúc **chưa gõ**. Đọc lại `onDraftChange` trong JS công khai của staging: thay đổi đầu tiên ở đơn giá / số lượng / răng đặt `total = unitPrice × quantity`, và cột Thành tiền của hàng đang sửa in `total`; Tổng giảm giá vẫn in `serviceDiscount` đã lưu. FE: `amount` trở lại `EDITABLE_COLUMNS`; `DraftServiceController.savedAmount` = Thành tiền đã lưu cho tới lần đổi đầu (`useEditServiceRow` cờ `repriced`, bật ở price/quantity/teeth), sau đó ô in đơn giá × số lượng. `docs/clone/pages/treatment-plan-detail.md` sửa lại đoạn "Edit mode". |
| R-608 | Khi chạy toàn bộ e2e: `auth.spec.ts` "logs out successfully" và "an open session opening /login…" đỏ — bấm Đăng xuất về `/` rồi `/dashboard`, vẫn đăng nhập. | Có từ `1e8e1728` (2026-09-23), không do R-606: `GET /api/account/logout` xoá cookie đúng (204, `Set-Cookie` xoá `.AspNetCore.Identity.Application`), nhưng `PublicOnlyRoute` hỏi phiên qua cache TanStack Query `["auth","current-user"]` (`staleTime` 60 s) mà `clearAuth()` không đụng tới → `/login` thấy user cũ và đẩy vào app. `AppLayout` logout nay `queryClient.clear()` (cũng để dữ liệu bệnh nhân của phiên cũ không nằm lại trong bộ nhớ). `auth.spec.ts` **5/5** trên dev :5173. |

## 2026-09-29 — Tiếp nhận: tiến trình ↔ kết quả, "Đã hẹn tiếp" có lịch thật (R-609 … R-612)

Yêu cầu của chủ dự án (ảnh chú thích trên bảng Tiếp nhận). Không phải hành vi đo từ bản gốc — `UNKNOWN_REFERENCE_BEHAVIOR` không áp dụng, đây là thay đổi theo yêu cầu.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-609 | Modal "Tạo tiếp nhận": ô "Bác sĩ điều trị" bắt buộc (báo "Vui lòng chọn bác sĩ") nhưng không có dấu `*`. | `FloatingField` chỉ vẽ `*` khi có prop `required`; ô bác sĩ chỉ có `rules`. Thêm `required`. |
| R-610 | Bấm "Đang khám" trên thanh tiến trình không tích "Chuyển bác sĩ"; bấm "Hoàn tất" không tích "Kết thúc điều trị". Ngược lại, tích "Chuyển bác sĩ" khi lượt đã vào khám thì lại **hoàn tất** lượt. | Hai cột tính riêng. Quy tắc chung đưa vào `reception/utils/receptionFlow.ts`: `planStepClick` (Đang khám → start + TransferDoctor khi chưa có kết quả; Hoàn tất → complete + EndTreatment trừ khi đã là Đã hẹn tiếp / Hẹn tái khám) và `planOutcomeClick` (Chuyển bác sĩ → start nếu chưa vào khám, còn không chỉ lưu kết quả; Kết thúc điều trị → complete nếu chưa xong). Server đã tự check-in / start khi cần (`Appointment.Start/Complete`). |
| R-611 | "Đã hẹn tiếp" lưu kết quả ngay, không có ngày hẹn nào phía sau. | Mới: `Appointment.BookFollowUp` tạo lịch hẹn tiếp (cùng bệnh nhân, chi nhánh; bác sĩ của lượt nếu không chọn khác; `Type = FollowUp`) và ghi `Outcome = FollowUp` + `FollowUpAppointmentId` trong một lần lưu — `POST /api/v1/app/appointments/{id}/follow-up`, migration `20260929072852_AddAppointmentFollowUpLink`. Một lượt chỉ có **một** lịch hẹn tiếp còn sống; lịch đã huỷ/xoá thì được đặt lại. `AppointmentDto.FollowUpAt` đọc giờ của lịch đó (bỏ qua lịch đã huỷ). FE: panel `FollowUpScheduler` dưới thẻ — chọn nhanh +1 tuần / +2 tuần / +1 tháng (chỉ một, tự chọn ô trống đầu tiên), tuần T2 → CN, ô 30 phút 08:00–11:00 và 13:30–16:30, giờ bận của bác sĩ đã chọn bị khoá, bác sĩ không bắt buộc. Dưới "Đã hẹn tiếp" hiện "Cần chọn ngày giờ hẹn" hoặc giờ đã hẹn. |
| R-612 | Khi làm migration: snapshot EF thiếu bảng `bd_electronic_invoices` (migration `20260928085453_AddElectronicInvoices` đã tạo bảng, nhưng snapshot mất nó ở một commit sau) → `migrations add` sinh lại `CreateTable`. | Giữ snapshot mới (đã có lại bảng), bỏ `CreateTable` khỏi migration R-611 — migration chỉ thêm cột. |

Kiểm chứng: `e2e/reception-follow-up.spec.ts` **5/5** trên dev :5173 (lặp 3 lần, 15/15) và trên bản build :8080 — full stack thật, đăng nhập thật, không chặn API; đọc lại trạng thái bằng request riêng, tải lại trang, cách ly chi nhánh (`branch2` nhận 404), chặn trùng giờ bác sĩ (`BlueDental:Appointment:0002`), chặn lịch hẹn tiếp thứ hai (`0003`), đặt lại sau khi huỷ. Domain: 5 test `BookFollowUp_*` xanh. Còn đỏ, có từ trước và không liên quan: `AppointmentTests.Should_Throw_When_Invalid_Transition` (`Start()` giờ tự check-in) và `e2e/reception.spec.ts` (chờ `/api/v1/app/visits`, trang không còn gọi endpoint này).

## 2026-09-30 — Rà soát P2909 (phần từ "Lịch tạm" trở xuống) (R-613 … R-626)

Yêu cầu của chủ dự án trong `save/P2909.drawio`, phần từ ghi chú "Cái "Lịch tạm" em làm cái tag…" trở xuống; phần phía trên do người khác làm. Đây là thay đổi theo yêu cầu, không phải hành vi đo từ bản gốc. Ở R-624 và R-626, BlueDental cố ý **khác** bản gốc (bản gốc: nhiều thẻ mở cùng lúc, một thẻ cho mỗi chuỗi công đoạn).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-613 | Tiếp nhận: "Lịch tạm" là huy hiệu cạnh mã phiếu, không giống ảnh tham khảo, nơi nó là tab nằm vắt trên mép trên của thẻ. | `.rc-temp-tab` (nền `#ddd0ff`, chữ `#5a4dc1`, cao 24px, `top:-12px`, `left:14px`) hiện khi `isTemporary`. Huy hiệu cạnh mã phiếu in trạng thái của lượt (`visitStatus`, ví dụ "Đã hẹn"), như bản gốc. Bộ đếm và chế độ lưới vẫn dùng `counterStatus`. |
| R-614 | Bấm tên trên thẻ Lịch tạm không mở gì, vì lịch tạm chưa có hồ sơ. | Mở "Tạo hồ sơ" (`TemporaryPatientDialog` bọc `PatientEditorDialog`) điền sẵn tên và SĐT (`PatientPrefill.phone`; `nationalId` không còn bắt buộc). Lưu xong gọi `POST /appointments/{id}/attach-patient` (mới): `Appointment.AttachPatient` gắn lịch hẹn vào bệnh nhân vừa tạo, bỏ cờ tạm và xoá tên/SĐT tạm. Nếu lịch hẹn không phải lịch tạm → `BlueDental:Appointment:0007`. Bệnh nhân khác chi nhánh, hoặc lịch hẹn của chi nhánh khác → 404. Kiểm tra trùng giờ bỏ qua chính lịch hẹn đó. Nếu không gắn, bấm lần hai sẽ tạo hồ sơ thứ hai. |
| R-615 | Chẩn đoán & Tư vấn: bấm vào khung "Kéo ảnh vào hoặc bấm nút để tải lên" không tải được ảnh. | Khung chỉ nhận thả file, bấm vào thì không có gì xảy ra. Khung nay là `<button>` mở cùng hộp chọn file với "Thêm ảnh", và bị khoá khi đang tải. |
| R-616 | Cuộn thẻ "Tạo chẩn đoán": nhãn nổi của "Bác sĩ chẩn đoán 1 / 2" đè lên thanh tiêu đề dính. | Nhãn `.floating-field-label` có `z-index: 5`, cao hơn thanh (`4`). Nâng `.pd-diagnosis-card > .pd-card-head` lên `6`. |
| R-617 | Ô chọn và tiêu đề cột ghi "Chẩn đoán 2". | `Patient:Diagnosis:Doctor2` = "Bác sĩ chẩn đoán 2" (en "Diagnosing doctor 2"), dùng cho cả ô chọn và tiêu đề cột bảng chẩn đoán, khớp với "Bác sĩ chẩn đoán 1". Bảng Phiếu tư vấn và các màn khác giữ key riêng, không đổi. |
| R-618 | Không có bác sĩ 2 thì hiện "Chưa cập nhật" màu đỏ. | In "-", bỏ luôn ngày. |
| R-619 | Nút in chẩn đoán dùng icon lịch (`CalendarDays`). | Đổi sang `Printer` (lucide). |
| R-620 | Tổng kế hoạch: nhãn "Tổng thành tiền" / "Tổng tiền" không nói rõ đó là số nào. | Bốn dòng, nhãn bên trái, số căn phải: **Tổng cộng** (Σ đơn giá × SL), **Giảm giá** (Σ giảm giá dịch vụ), **Voucher** (logic cũ), **Thành tiền** = Tổng cộng − Giảm giá − Voucher (in đậm, 18px). Key mới `Patient:PlanTotals:*`. `usePlanVoucher` thêm `subtotal` và `serviceDiscount`; voucher vẫn tính trên tổng sau giảm giá dịch vụ. |
| R-621 | Dialog "Chi tiết phiếu" và hai bản in dùng nhãn khác ("TỔNG TIỀN / Giá dịch vụ / Giảm giá dịch vụ / Giảm giá bác sĩ / Báo giá"). | Cùng tiêu đề "TỔNG KẾ HOẠCH" và cùng bốn nhãn. Bản in viết hoa có dấu hai chấm (`sheetLabel`). |
| R-622 | `quoteModel.toQuoteRow` tính voucher của dòng hai lần: `discountAmount` từ server đã cộng `voucherDiscountAmount`, rồi `rowDiscount` lại cộng thêm. | `clinicDiscount = discountAmount − voucherDiscountAmount`. |
| R-623 | Chỉnh giảm giá trên tab BG 1 làm đổi cả Phiếu tư vấn và mọi BG khác, vì báo giá chỉ lưu danh sách dòng, còn giá đọc từ dòng tư vấn. | `PatientQuoteLine` có giá riêng (`Price/Quantity/DiscountType/DiscountValue`, nằm trong JSON `Lines`). Giá được chụp từ dòng tư vấn lúc tạo báo giá, được sao theo khi Sao chép, và được giữ khi tích/kéo lại. `PUT /patient-quotes/{id}/lines/{adviseId}` (mới) đổi giá của riêng báo giá đó. Server trả số tiền đã tính (`PatientQuoteLineReadDto`). Quy tắc tiền của dòng tư vấn tách ra `AdvisePricing` để hai bên dùng chung. Dòng lưu trước đây chưa có giá thì vẫn lấy giá dòng tư vấn. Migration `20260930015215_AddPatientQuoteLinePricing` rỗng (cột JSON), chỉ để đồng bộ snapshot. FE: tab BG định giá theo báo giá, "Cập nhật phiếu dịch vụ" mở trên tab BG ghi giá vào báo giá (ghi chú vẫn ghi vào dòng tư vấn), "In Báo giá" in các dòng đang tích của tab đang mở (trước đây luôn in Phiếu tư vấn). |
| R-624 | Chi tiết phiếu → THÊM CÔNG ĐOẠN: răng đã lưu công đoạn biến mất khỏi thẻ và form. | Thẻ và form in **mọi** răng của dịch vụ (`StageItem.shownTeeth`). Răng đã có công đoạn thì mờ (`.pd-stage-tooth--done`, opacity 0.35) và không bấm được. |
| R-625 | Lịch sử điều trị chỉ in răng của công đoạn. | In mọi răng của dịch vụ. Răng làm trong công đoạn đó tô xanh (`.pd-stage-histtooth--worked`), còn lại để trắng. Công đoạn cũ không có răng thì coi như cả dịch vụ. |
| R-626 | TIẾP TỤC CÔNG ĐOẠN: một dịch vụ có hai chuỗi hiện thành hai thẻ trùng tên. Chọn nhiều thẻ thì các form xếp chồng, không rõ nội dung điều trị thuộc dịch vụ nào. | Mỗi dịch vụ một thẻ trên mọi tab (`id` là `"continue:<line>"` / `"continueWarranty:<line>"`, `stages` là các chuỗi đang mở). Form chọn răng theo **cả chuỗi**: bấm một răng thì vào/ra cả chuỗi (`toggleTooth`, `snapToChains`). Lưu thì tiếp tục mỗi chuỗi đã chọn bằng một request, ảnh gắn vào công đoạn đầu. Chỉ có một chuỗi thì răng khoá như cũ. Cột Chi tiết mỗi lần chỉ mở **một** thẻ, nháp của thẻ khác vẫn giữ. |

Kiểm chứng (full stack thật: đăng nhập thật, API thật, PostgreSQL thật, không chặn request), trên bản build production :8080 **và** dev :5173:
`e2e/reception-temporary.spec.ts` **3/3** (tab, huy hiệu, Tạo hồ sơ điền sẵn → lịch hẹn gắn vào hồ sơ mới, đọc lại bằng request riêng, reload, lần gắn thứ hai → `0007`, chi nhánh khác → 404);
`e2e/consulting-review.spec.ts` **3/3** (cột "Bác sĩ chẩn đoán 2", "-", icon máy in, thanh dính che nhãn khi cuộn, khung ảnh mở chọn file → upload 200 → reload; báo giá độc lập: sửa giảm giá BG 1 → BG 2 và dòng tư vấn không đổi theo API, ba tab in đúng số sau reload, Chi tiết phiếu đúng bốn nhãn);
`e2e/treatment-stage-chain.spec.ts` **7/7** (viết lại ca "nhiều thẻ" thành một thẻ/giữ nháp/răng mờ; ca mới gộp hai chuỗi + tô răng lịch sử);
`patient.spec.ts` "the plan total…" (sửa theo nhãn mới), cùng 10 ca công đoạn khác, xanh;
`consulting-plan.spec.ts` 10/13 (3 ca đỏ: "voucher picker offers…" và "signature strip" đỏ y hệt trên bản build HEAD sạch; "tile shimmers" chập chờn trên cả hai bản).
BE: Domain 52/52 (`AttachPatient_*`, `RepriceLine_*`, `SetLines_And_CopyLines_Should_Keep_Each_Lines_Price`…), Application contract 33/33.
Còn đỏ, có từ trước và không liên quan: `patient.spec.ts` "the stage form fills its columns" (mong "Nội dung điều trị" không có `*`, trong khi c5b52d52 cố ý thêm `*`), "Danh sách công đoạn picks…" (DB dev không còn dòng có bước công đoạn), `reception.spec.ts` 2 ca (chờ `/visits`).
Retest level **3** (quy tắc tiền dùng chung `AdvisePricing`, `PatientEditorDialog` dùng chung, `StageTeethPicker` dùng chung với Tái khám / Bảo hành).

## 2026-09-30 — Rà soát tiếp theo sau P2909 (R-627 … R-633)

Chủ dự án yêu cầu sau khi xem lại trên :5173. Đều là thay đổi theo yêu cầu, không phải đo từ bản gốc.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-627 | Tiếp nhận: nhãn "Lịch tạm" (R-613) chạm vào thẻ ở hàng trên. | Khoảng cách giữa các hàng của lưới `.reception-card-grid` tăng lên 24px; giữa các cột vẫn 12px. Không cho thẻ lịch tạm margin riêng, vì thẻ sẽ lệch so với thẻ bên cạnh cùng hàng. |
| R-628 | "Chọn ảnh hiển thị": bấm thùng rác là xoá ngay, không hỏi. | Mở `ConfirmDeleteDialog` "Xác nhận xoá ảnh", dùng chung với tab Hình ảnh. Nút Xoá hiện "Đang xoá…" có vòng xoay tới khi server trả lời. Nếu server từ chối thì hộp vẫn mở (`removeImage` trả `boolean`). |
| R-629 | Chẩn đoán & Tư vấn có hai thanh cuộn: khung tab tự cuộn, trong khi vùng ngoài cũng cuộn. | `.pd-page` được ghim cao bằng màn hình. Tab dạng tài liệu (không có `--fill`) giờ để `.pd-page` cao theo nội dung (`:has`), chỉ vùng ngoài cuộn. Tab dạng bảng giữ chiều cao cố định. Chiều cao trừ đủ phần đệm của `.app-content` (58px, dưới 900px là 46px) thay cho 32px, nên hết 26px cuộn thừa ở mọi tab bảng. |
| R-630 | Sau R-629, "Cột hiển thị" mở ở nửa dưới màn hình thì bị lật lên trên, nút ✕ nằm ngoài khung nhìn (e2e "Cột hiển thị drags its rows" đỏ). | Luôn mở xuống dưới nút, dịch lên vừa đủ để nằm trong khung nhìn (`autoAdjustOverflow` với `shiftY`; kiểu của antd thiếu `shiftY` dù lúc chạy vẫn đọc). Đã thử neo popover vào `.pd-page` / `.app-content`: rc-trigger bù độ cuộn hai lần, nên bỏ. |
| R-631 | Khối Tổng kế hoạch: bố cục theo ảnh mẫu của chủ dự án. | Các dòng tiền gom trong cột rộng tối đa 460px. Giảm giá màu xanh lá. "Voucher áp dụng" có nút bên phải. Mỗi voucher đã chọn là một ô viền nét đứt: mã, "Giảm {x} trên tổng thành tiền", số tiền, nút × để bỏ. Dòng phụ dưới Giảm giá trong ảnh mẫu không làm, vì không có dữ liệu tương ứng. |
| R-632 | "Chọn Dịch Vụ" lấy giá danh mục 300.000, trong khi "Cập nhật dịch vụ" đã giảm 10% còn 270.000. Giảm giá nhập tay tính trên 300.000. | `CatalogOption.salePrice` = `serviceConfig.priceAfterDiscount` (Giá sau giảm, chưa gồm VAT). Dòng mới lấy giá này làm đơn giá và giá gốc, nên Giảm giá của Phiếu tư vấn chỉ còn phần nhập trong dialog. "Tạo phiếu dịch vụ" và dòng thêm mới ở Chi tiết kế hoạch điều trị vẫn lấy `price`, chưa đổi. |
| R-633 | Chọn voucher ở BG 1 thì Phiếu tư vấn và BG 2 cũng tick theo. | `usePlanVoucher` giữ lựa chọn theo từng tab (`scope` = id báo giá hoặc `"advise"`). Bước tự bỏ voucher không còn đủ điều kiện chờ tới khi có danh sách thật của số tiền mới (`isPlaceholderData`), để không bỏ nhầm lựa chọn của tab mới dựa trên danh sách của tab trước. Lựa chọn vẫn chỉ nằm trên trình duyệt, như trước. |

Kiểm chứng (full stack thật, không chặn request), trên :8080 **và** :5173:
- `consulting-review.spec.ts` 7/7: thêm các ca xác nhận xoá ảnh có "Đang xoá…", Giá sau giảm → 270.000 / giảm 54.000, voucher riêng theo tab.
- `patient.spec.ts` "the plan total…" (ô voucher, bỏ bằng ×).
- `consulting-plan.spec.ts` 20/22: ca voucher đỏ y hệt trên HEAD sạch, ca ảnh shimmer chập chờn trên cả hai bản.
- `patient-appointment`, `treatment-stage-chain`, `consulting-delete-and-picker` xanh.

Mỗi tab của hồ sơ bệnh nhân đo lại còn đúng một khung cuộn. Retest level **3**: bố cục `.pd-page` dùng chung cho mọi tab của hồ sơ.

## 2026-10-01 — Hóa đơn: rà soát toàn bộ + cấu hình theo chi nhánh (R-634 … R-638)

Chủ dự án yêu cầu sau buổi rà soát các chỗ xử lý hóa đơn. Tính năng riêng của BlueDental, không đo từ bản gốc.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-634 | Chỉ có một tài khoản EasyInvoice cho toàn hệ thống (appsettings). | Bảng `EInvoiceBranchConfigs` + `api/v1/app/e-invoice-configs`; màn Công cụ › Hóa đơn › Cấu hình chuyển từ dữ liệu giả sang API thật. Chọn tài khoản: cấu hình active của chi nhánh → appsettings → `EInvoicing:0001`. |
| R-635 | Mật khẩu nhà cung cấp có thể lộ qua API cấu hình. | DTO chỉ trả `hasPassword`; PUT với mật khẩu rỗng giữ mật khẩu cũ. Spec kiểm cả response lẫn danh sách không chứa mật khẩu. |
| R-636 | Billing: Huỷ hoá đơn không cần lý do (trái quy tắc "Voided: phải có lý do"). | `Invoice.Void(reason)` từ chối lý do rỗng (`Billing:0008`), lý do lưu vào `Notes`; `VoidInvoiceDto.Reason` `[Required]`. Thêm `VoidInvoiceDialog`. |
| R-637 | Billing: hóa đơn Nháp không có cách chuyển sang Đã phát hành, nên không thu tiền được. | Nút "Phát hành" (Draft → Issued, nội bộ — **không** liên quan EasyInvoice) + ConfirmDialog; hành động dòng tách ra `InvoiceRowActions`. |
| R-638 | Locator Playwright `getByLabel("Tên")` không khớp FloatingField bắt buộc. | Tên accessible của ô bắt buộc có hậu tố ` *` → dùng `getByRole("textbox", { name: "Tên *", exact: true })`. |

Kiểm chứng (full stack thật, không chặn request) trên build production :8080: `einvoice-api.spec.ts` 5/5,
`treatment-plan-detail.spec.ts` + `payment-qr.spec.ts` 16/16. BE: Domain Billing 18/18 (thêm `InvoiceVoidTests`).
Retest level **3** (Billing dùng chung với báo cáo, InvoiceModal nằm trong Chi tiết kế hoạch).

## 2026-10-01 (2) — Hóa đơn: giữ UI cũ, tài liệu DLL EasyInvoice (R-639 … R-643)

Chủ dự án: "logic có thể đổi nhưng UI/form vẫn như cũ", rồi đưa tài liệu tích hợp DLL (Scribd, không chính thức).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-639 | Vòng trước đổi lớn UI InvoiceModal (Spin, khối thông báo, bỏ ô Mẫu/Ký hiệu/Tiền tệ) và form Cấu hình (URL, mẫu, VAT). | Trả UI về bản cũ. Form Cấu hình giữ đúng trường gốc (App ID, 2 switch thuế lưu nhưng chưa dùng); URL/VAT từ appsettings. Mẫu/Ký hiệu nhập ở hộp thoại HĐ, server nhớ cặp gần nhất (`LastPattern/LastSerial`, `draft.numberings`). Tiền tệ/Tỷ giá sửa được nhưng chỉ phát hành VND tỷ giá 1 (`0015`). Giữ: ConfirmDialog Phát Hành, EInvoiceBadge, Phát hành/Huỷ ở Billing, xác nhận xoá cấu hình. |
| R-640 | e2e cấu hình trả 500 "column AppId … does not exist". | Migration `EInvoiceConfigOriginalForm` đã thêm nhưng DB local chưa chạy. `dotnet build` DbMigrator rồi `dotnet run --no-build` — chạy `--no-build` trên dll cũ sẽ bỏ qua migration mới. |
| R-641 | Mọi HĐ đã có số đều hiện "Đã phát hành", kể cả HĐ đã hủy/thay thế ở nhà cung cấp. | Ánh xạ `InvoiceStatus` theo tài liệu DLL: 5 → Đã hủy, 3 → Bị thay thế, 4 → Bị điều chỉnh (enum mới 3/4 + nhãn vi/en), 1/2/6 → Đã phát hành, chưa có số → Nháp. Báo cáo coi HĐ đã hủy là "chưa xuất". Mã 2–6 chưa thấy trên REST. |
| R-642 | Tên dịch vụ > 300 ký tự sẽ bị nhà cung cấp từ chối với lỗi khó hiểu. | `ElectronicInvoiceDraft.MaxLineNameLength = 300`, từ chối trước khi gọi (`EInvoicing:0005` kèm lý do). |
| R-643 | Thiếu tài liệu chính thức cho hủy/thay thế/điều chỉnh. | Ghi khung từ tài liệu DLL vào `docs/clone/integrations/easyinvoice.md` (đánh dấu chưa kiểm chứng). Chưa làm chức năng — cần HĐ đã ký, sandbox không có HSM. |

Kiểm chứng: Domain `ElectronicInvoiceTests` 21/21 (thêm 9 ca ánh xạ trạng thái + giới hạn 300 ký tự), toàn bộ filter EInvoicing 51/51. tsc sạch.
Build production (:8080, host :5000, DB thật, không chặn request): `einvoice-api` 5/5, `treatment-plan-detail` + `payment-qr` 16/16 (tổng 21/21).
Retest level **2** (trong tính năng F-46; báo cáo vận hành chỉ đổi cách đọc trạng thái).

## 2026-10-01 (3) — Hóa đơn: rà soát toàn bộ lần cuối (R-644 … R-649)

Chủ dự án: "check kỹ toàn bộ … chạy 100%". Rà lại mọi luồng xuất hóa đơn, chạy lại toàn bộ test.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-644 | Phiếu điều trị đã xuất cả phiếu rồi HĐ bị **hủy** ở nhà cung cấp vẫn chặn xuất theo phiếu thu (`0012`), và ngược lại. | Điều kiện chặn đưa vào domain `ElectronicInvoice.BillsSlipOtherWay(planId, wholeSlip)`, bỏ qua HĐ `Cancelled`. Domain test `A_Slip_Billed_One_Way_Blocks_The_Other_Way_Until_That_Invoice_Is_Cancelled`. |
| R-645 | Nút "Xuất HĐ" ở dòng phiếu thu vẫn hiện khi server chắc chắn từ chối (HĐ của phiếu thu đã ký, hoặc phiếu điều trị đã xuất cả phiếu) → bấm mới thấy lỗi. | `isReceiptInvoiceable` (FE, phản chiếu `0004`/`0012`) → `canIssueInvoice` ở `paymentColumns` + `PaymentCardList`. Chưa tải danh sách thì để server quyết. Không đổi UI khác. |
| R-646 | Kiểm toán báo controller HĐĐT thiếu `[Authorize(permission)]`. | Báo động giả: quyền nằm ở AppService, controller chỉ cần `[Authorize]` (R-401). Chứng minh bằng `ApplicationServiceInterceptionTests` thêm `IElectronicInvoiceAppService`, `IEInvoiceConfigAppService`. |
| R-647 | `treatment-plan.spec.ts:199` đỏ: hộp thoại HĐ của cả phiếu ra dòng "Thanh toán phiếu điều trị DT09 … Lần" thay vì "Kế hoạch điều trị DT09". | Vòng trước chuyển dòng mặc định sang server (`draft.lines`) và đổi cách tách dòng cho cả phiếu. Trả về đúng bản gốc (đo 2026-09-21): cả phiếu = **một** dòng "Kế hoạch điều trị {mã}", ĐVT "Răng", SL 1, đơn giá = Thành tiền. Phiếu thu vẫn tách theo dịch vụ. Bỏ `SlipParts`. |
| R-648 | ESLint `no-useless-assignment` ở `einvoice-api.spec.ts`. | `let body: unknown;`. 3 lỗi "rule react-hooks/exhaustive-deps not found" còn lại là comment có sẵn ở HEAD (config chưa nạp plugin) — không thuộc phạm vi. |
| R-649 | 51 e2e đỏ ở consulting-plan (12), operations-reports (8), operations (2), patient (27), report (1), routes (1) — nghi do thay đổi hóa đơn. | **Không phải.** Chạy cùng 6 spec trên bản HEAD sạch (`git archive`, BE+FE build riêng, cùng DB): đúng 51 test đó cũng đỏ, danh sách trùng 100%. Nguyên nhân có sẵn: consulting-plan dùng BN cứng `3a238cc0…` không có trong seed local (R-590); operations/report lệch UI (thiếu tab kỳ "Ngày", heading "Báo cáo khách hàng phát sinh"); host không có lỗi 500. Cần xử lý riêng, ngoài phạm vi hóa đơn. |

Kết quả: BE build 0 lỗi 0 cảnh báo; BE test 1271/1271 (Domain 535, Application 653, EF 60, Host 23); FE `tsc` sạch; Vitest 3/3; e2e hóa đơn + liên quan (`einvoice-api`, `payment-qr`, `treatment-plan-detail`, `treatment-plan`) 30/30 trên bản build production, API thật, không chặn request.

## 2026-10-02 — Lịch làm việc: chỉ tự đánh X của chính mình (R-650 … R-653)

BA: "khóa hết tương tác trên grid", làm rõ sau: không ai (kể cả admin) đụng ô V/L hay dòng của người khác; user chỉ bấm ô trống trên dòng của mình để thành X. Vẫn cần quyền Lịch làm việc → Sửa. Logic hiển thị V/L/X giữ nguyên.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-650 | Admin bỏ được chữ "L" của người khác hôm nay → mất luôn chấm công của họ. | FE cho bấm ô L đã chấm công; BE `BulkRegisterAsync` không kiểm tra chủ dòng/ngày/chấm công và gọi `force: true` xoá ca. Server từ chối cả lô nếu có ô: của người khác, ngày đã qua, đăng ký L, hoặc ô đã chấm công / đã là L (`Timekeeping:0013`, 403). Bỏ `force`. |
| R-651 | Grid cho chọn dòng người khác (checkbox, "Nghỉ (n)", lịch nghỉ nhiều ngày). | Khoá cho mọi vai trò (vẫn hiển thị). Ô chỉ bấm được khi là dòng của mình + ngày ≥ hôm nay + chưa chấm công + không phải L — hook `useOwnDayOffDraft`. Ô khoá giữ màu, chỉ đổi con trỏ. |
| R-652 | — | Bấm lại X đã lưu của mình → về trống (BA đồng ý). Hôm nay chưa chấm công vẫn đánh X được. |
| R-653 | `doctor-day-off-pickers` (3) + `staff-day-off-api` (3) đỏ: seed ngày nghỉ/L cho bác sĩ khác bằng admin qua `bulk-register`. | Đúng theo luật mới — spec chưa commit của phiên khác. Cần seed bằng cách đăng nhập chính bác sĩ đó đánh X của mình; L ngày tương lai không còn đường ghi. Chưa sửa (file của phiên khác). |

Kiểm chứng: BE build sạch; FE `tsc` + ESLint timekeeping sạch. Build production (:8093, host :5000 build mới, DB thật, không chặn request): `work-schedule-own-dayoff` 3/3, `timekeeping-api` 3/3, `timekeeping` 4/5 — ca KPI đỏ có sẵn ở HEAD (`timekeeping-kpis` không còn trong `src`, commit 4cb33646 bỏ thanh KPI).
Retest level **2** (F-03).

## 2026-10-02 — Bảng ngày đồng bộ X của grid Lịch làm việc (R-654)

BA: grid Lịch làm việc chỉ để đăng ký nghỉ; "Lưu thay đổi" = nghỉ nguyên ngày; thẻ trên bảng ngày phải tự về OFF ngày user nghỉ.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-654 | Đánh X cho ngày mai rồi lưu, mở bảng ngày mai: thẻ vẫn ở nút giữa (Không điểm danh), không về OFF. | `TimekeepingStaffCard` chỉ xét có chấm công / ngày tương lai, bỏ qua `registration`. Thêm trạng thái `dayOff` cho `WorkStatusToggle` (vị trí OFF, nhãn "Nghỉ"), ưu tiên sau "đã chấm công". Dữ liệu đã đúng sẵn: `bulk-register` ghi `DayOff` cho cả bản ghi ngày (không có nửa buổi), cache `timekeepingKeys.all` được làm mới sau khi lưu. |

Kiểm chứng: `tsc` + ESLint sạch. Build production (:8093, host :5000, DB thật): `work-schedule-own-dayoff` 3/3 (ca UI thêm bước mở bảng ngày → thẻ của mình "Nghỉ" + `tk-toggle--off`, thẻ người khác "Không điểm danh"), `timekeeping-api` 3/3.

## 2026-10-02 — Lịch làm việc: popup "Đăng ký nghỉ" (R-655 … R-659)

Chủ dự án (ảnh thiết kế): nút lịch cạnh tên nhân viên phải mở popup chọn nhiều ngày nghỉ; "thông tin nào có thì hiển thị, không có thì ẩn" (ví dụ Phép còn lại).
Đây là yêu cầu của BlueDental, không phải hành vi quan sát từ bản gốc.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-655 | Nút lịch ở cột Nhân viên của bảng Lịch làm việc bấm không được. | Nút bị `disabled` cứng, chưa nối gì. Giờ mở `LeaveRegistrationDialog` — chỉ trên **dòng của chính mình** (theo luật R-650/R-651: không ai đụng dòng người khác, kể cả admin); server cũng từ chối `staffId` khác người đăng nhập (`0013`). |
| R-656 | Backend chỉ có nghỉ **cả ngày**, không lưu được ca nghỉ (Sáng/Chiều/Cả ngày) và giờ nghỉ như thiết kế. | `TimeKeepingRecord.RegisterLeave(LeaveWindow, reason)` + cột `LeaveShift/LeaveStart/LeaveEnd` (migration `TimeKeepingLeaveWindow`). Cả ngày = DayOff; nửa ngày = vẫn Working (làm ca còn lại). Giờ phải nằm trong ca; ngày đã vào ca thì từ chối. Endpoint `POST /api/v1/app/time-keepings/register-leave` (một nhân viên, nhiều ngày, tất cả hoặc không): kiểm tra nhân viên thuộc chi nhánh hiện tại, không cho ngày quá khứ. Ngày mới mở theo giờ ca riêng của nhân viên (Nhân viên → giờ làm). Bật/tắt ô trên lưới xoá ca nghỉ. |
| R-657 | Mã NV, Bộ phận, Phép còn lại trong thiết kế không có trên hồ sơ nhân viên. | Ẩn hẳn theo yêu cầu, chỉ hiện avatar, tên, vai trò. |
| R-658 | "Cả ngày 08:00–17:00" tính 9 giờ. | Chỉ tính phần nằm trong ca (bỏ giờ nghỉ trưa) → 8 giờ. |
| R-659 | Ngày nghỉ nửa buổi không có ô hiển thị trên lưới dù chú thích có "Làm nửa buổi". | Thêm ô `half-morning` / `half-afternoon` (icon mặt trời / mặt trăng). Gỡ cấu hình EF trùng của `TimeKeepingRecord` trong `ConfigureCustomerCare` (giống hệt bản trong `ConfigureTimekeeping`, migration không đổi gì ngoài 3 cột mới). |

Kiểm chứng: Domain `TimeKeepingRecordTests` 18/18 (+5 ca nghỉ), contract `TimeKeepingAppServiceContractTests` 24/24, EF Timekeeping 5/5; FE `tsc` sạch.
E2E thật trên dev :5173 + host :5000 + PostgreSQL, không chặn request: `timekeeping-leave.spec.ts` **2/2**. Test chọn 3 ngày, kiểm tra nút xác nhận bị khoá khi còn ngày chưa chọn ca, dùng "Áp dụng cho tất cả", đổi ca từng ngày, bỏ một ngày rồi lưu. Sau đó đọc lại response, reload và thấy ô nửa buổi trên lưới.
`timekeeping.spec.ts`: 1/3. Hai test đỏ có từ trước, **không** do thay đổi lần này: spec tìm `data-testid="timekeeping-kpis"` và nút "Mở ngày làm việc", nhưng cả hai đã không còn trong source.
Retest level **2** (F-03).

## 2026-10-03 — Chi tiết phiếu: tiếp tục công đoạn theo từng răng (R-660)

Chủ dự án (ảnh): ở TIẾP TỤC CÔNG ĐOẠN không chọn được răng, nhưng nhập nội dung điều trị thì vẫn lưu được. Muốn: răng chưa hoàn thành vẫn chọn được; chỉ răng đã hoàn thành mới bị khoá (như răng 46).
**Cố ý khác bản gốc**: bản gốc khoá cả chuỗi (`docs/clone/pages/patient-detail.md` mục 5).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-660 | Form tiếp tục khoá hết răng khi thẻ chỉ có một chuỗi; có nhiều chuỗi thì bấm một răng là vào/ra cả chuỗi. | FE: chọn từng răng trên mọi tab (`toggleTooth`, `keepOffered`), bỏ `locked`. Răng đưa ra = răng **còn mở** của các công đoạn đang mở (`openTeeth`). Răng của công đoạn đã Hoàn thành vẫn mờ, không bấm được. BE: `ContinueTreatmentStageDto.ToothCodes`; nếu rỗng thì mang hết răng như cũ. `TreatmentStage.ContinueAs` chỉ mang những răng được chọn, và ghi chúng vào `ContinuedToothCodes` (cột `integer[]`, migration `StagePartialContinue`). Công đoạn cũ vẫn **mở** với số răng còn lại, chỉ thành `IsSuperseded` (xám) khi đã hết răng. `Teeth` của công đoạn cũ giữ nguyên, nên lịch sử vẫn tô đủ răng đã làm. Răng đã chuyển đi hoặc không thuộc công đoạn bị từ chối với mã `0041`. |

Kiểm chứng: Domain `StageChainAndWarrantyTests` 15/15 (+2 ca: tiếp tục một phần rồi phần còn lại; từ chối răng đã chuyển hoặc ngoài công đoạn). Application Stage 20/20. FE `tsc` sạch.
E2E thật (dev :5173, host :5000, PostgreSQL, không chặn request): `treatment-stage-chain.spec.ts` **7/7**. Ca tiếp tục được viết lại: bỏ răng 32 rồi tiếp tục với 31; công đoạn cũ vẫn mở và vẫn tô 31·32. Reload, thẻ đưa ra lại 31·32; gửi lại 31 bị từ chối `0041`; tiếp tục 32 xong thì công đoạn cũ mới xám. `patient.spec.ts`: 3 ca Chi tiết phiếu/tiếp tục xanh.
Retest level **2** (F-19).

## 2026-10-03 (2) — Tiếp tục công đoạn: một lần khám = một công đoạn (R-661)

Chủ dự án: chọn 11 và 21 ở TIẾP TỤC CÔNG ĐOẠN, nhưng dưới lịch sử chỉ thấy một răng.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-661 | 11 và 21 nằm ở hai chuỗi công đoạn khác nhau. Lưu một lần thì gửi hai request `continue`, tạo **hai** công đoạn (11 riêng, 21 riêng), nên lịch sử thành hai dòng. | `ContinueTreatmentStageDto.AlsoFrom` (`[{ stageId, toothCodes }]`): một request gom răng từ mọi chuỗi đã chọn của cùng dịch vụ và cùng loại (thường/bảo hành) vào **một** công đoạn mới, với `continuedFromId` là chuỗi đầu tiên. Mỗi chuỗi nguồn ghi lại răng đã chuyển đi, và thành xám khi hết răng. Chuỗi khác dịch vụ hoặc khác loại bị từ chối với mã `0018`. FE gửi đúng một request cho mỗi form; ảnh gắn vào công đoạn đó. |

Kiểm chứng: Domain `StageChainAndWarrantyTests` 17/17 (+2 ca: gộp hai chuỗi; từ chối gộp khác loại), Application Stage 20/20, FE `tsc` sạch.
E2E thật: `treatment-stage-chain.spec.ts` **7/7**. Ca hai chuỗi giờ chọn 11 + 21 thì chỉ có 1 request, công đoạn mới có `[11, 21]`, dòng lịch sử tô cả 11 và 21, chuỗi 21 cũ chuyển xám.
`patient.spec.ts`: "Công đoạn cell…" và "continued công đoạn greys…" xanh. "Hoàn thành leaves TIẾP TỤC" đỏ ở fixture vì DB demo local đã hết dòng còn răng trống (cùng loại với R-540), không liên quan thay đổi này.
Retest level **2** (F-19).

## 2026-10-03 — Tiếp nhận: đồng hồ thời gian chờ trên thẻ (R-662 … R-664)

Yêu cầu BA, **không** phải hành vi quan sát từ bản gốc. Ngưỡng theo câu chữ của BA:

- dưới 5 phút: xanh;
- từ 5 phút: vàng;
- từ 10 phút: đỏ, kèm chữ "Chờ quá lâu".

Ảnh thiết kế ghi 15/30 phút, nhưng chủ dự án chốt theo câu chữ 5/10 phút. Chỉ làm ở dạng thẻ; badge "Đến trễ" không làm. Backend không đổi: DTO đã có sẵn `checkedInAt` và `startedAt`.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-662 | Chip "Đang chờ" đè lên vòng tròn bước 1–2 khi cột tiến trình hẹp. Ở 1280–1600px, `.rc-steps` chỉ rộng 194–354px. | Khi đang chờ, `.rc-steps--waiting` thêm một cột lưới riêng cho chip (rộng `max-content`). Dưới 340px (container query `rc-progress` trên `.rc-col-progress`), chip nổi lên trên đường nối. Đã đối chiếu ảnh chụp ở 1920/1600/1440/1280/390: không còn đè. |
| R-663 | Chọn "Hẹn tái khám" ngay khi đang chờ thì bước 2 "Đã hẹn lại" hiện "· chờ 0p". | Server đóng dấu `startedAt` khi đặt tái khám, nhưng bệnh nhân chưa hề vào ghế. Nhánh `revisitAtStep2` giờ bỏ phần ghi chú. Thẻ đã vào ghế rồi mới huỷ thì vẫn giữ "chờ Np", và spec kiểm tra đúng chuỗi đó. |
| R-664 | `reception-follow-up.spec.ts` báo `runId is not defined` sau khi tách helper ra `e2e/fixtures/receptionBoard.ts`. | Import `runId` từ `fixtures/auth`. Test so giờ bước 2 với chuỗi `HH:mm · chờ Np`, trong đó N tính từ hai dấu thời gian của server. |

Kiểm chứng trên bản build production (`vite preview` :8093) + host :5000 + PostgreSQL, không chặn request:

- `reception-wait-time.spec.ts` **1/1**. Test dùng `page.clock` để vượt ngưỡng 5 và 10 phút. Nó kiểm tra màu chip và viền thẻ, reload vẫn còn đỏ, vào ghế thì đồng hồ biến mất và hiện "chờ Np", reload lại vẫn đúng.
- `reception-follow-up.spec.ts` + `reception-temporary.spec.ts` **14/14**.
- `reception.spec.ts` 1/3, đỏ **từ trước**: hai test chờ `GET /api/v1/app/visits`, nhưng board đã gọi `/v1/app/appointments` từ trước thay đổi này.
- Vitest `ReceptionPage.test.tsx` 3/3; `tsc` và eslint sạch.

Retest level **2** (F-11).

## 2026-10-03 — Chẩn đoán & Tư vấn: bác sĩ chẩn đoán mặc định theo lịch hẹn (R-665)

Yêu cầu BA, **không** phải hành vi quan sát từ bản gốc.

- Form "Tạo chẩn đoán" mở mới thì ô "Bác sĩ chẩn đoán 1" tự điền bác sĩ của lịch hẹn **hôm nay**, tức bác sĩ đang hiện trên thẻ Tiếp nhận. Người dùng vẫn đổi được.
- Không có lịch hẹn hôm nay thì ô để trống như trước (chủ dự án chốt).
- "Thêm chẩn đoán" không còn xoá bác sĩ: cả bác sĩ 1 và bác sĩ 2 đều giữ nguyên. Chỉ chẩn đoán, ghi chú và răng được làm mới.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-665 | Bấm "Thêm chẩn đoán" thì form xoá luôn bác sĩ, phải chọn lại cho từng phiếu. Form mở mới cũng không điền sẵn bác sĩ hẹn. | Hook mới `useAppointmentDoctor`: `GET appointments?patientId&date=hôm nay` (server cắt ngày theo UTC+7), bỏ lịch Huỷ/Không đến. Nếu có nhiều lịch thì ưu tiên lịch Đã đến/Đang khám, sau đó tới lịch gần giờ hiện tại nhất. `PatientDiagnosisForm` gán `staffId` khi form trống và ô chưa có giá trị, nên lịch hẹn tải sau vẫn được điền. Khi `blankCount` tăng, form chỉ `resetFields(["diagnosisId","note"])` và reset răng. Bác sĩ hẹn đang nghỉ hôm nay vẫn được thêm tên vào options (`withNamedDoctors`). Mở phiếu cũ để sửa thì giữ bác sĩ của phiếu. |

Kiểm chứng: `tsc` và eslint sạch. Kiểm tra tay trên dev :5173 + host :5000, đăng nhập admin, bệnh nhân có lịch hôm nay: form mở ra đã chọn sẵn bác sĩ hẹn, dropdown vẫn liệt kê đủ 8 bác sĩ không nghỉ hôm nay. Không viết spec mới (chủ dự án tự test).
Lưu ý: `GET /v1/app/staff` cần quyền `Staff.View`. Tài khoản thiếu quyền này nhận 403 → danh sách rỗng → dropdown chỉ còn đúng bác sĩ hẹn. Đây là lỗ hổng có từ trước; trước R-665 dropdown sẽ trống hẳn.
Retest level **2** (Chẩn đoán & Tư vấn).

## 2026-10-03 — Chấm công: `POST time-keepings/open-day` trả 500 trên local (R-666)

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-666 | Mở ngày làm việc (check-in trên thẻ ảo, lưu thông tin chấm công, bật lịch ở thẻ nhân viên) trả 500, body ABP chung "Có một lỗi nội bộ xảy ra…". | Migration `20261002094459_TimeKeepingLeaveWindow` (commit `815724ed`, thêm `LeaveShift`/`LeaveStart`/`LeaveEnd`) có trong code nhưng chưa áp vào DB local. Host mới INSERT cả 3 cột → PostgreSQL báo cột không tồn tại. Không sửa code: chạy lại DbMigrator (`dotnet run`, build trước). Sau đó `open-day` trả 200. Môi trường nào pull `815724ed` cũng phải migrate (prod: chạy DbMigrator khi deploy). |


## 2026-10-03 — Lịch hẹn: view Ngày thành timeline ngang theo bác sĩ (R-667 … R-669, R-673)

Yêu cầu BA (ảnh mẫu "Lịch bác sĩ hôm nay"), **không** phải hành vi quan sát từ bản gốc.

- View Ngày: mỗi bác sĩ một hàng, trục giờ chạy ngang 07:00–20:00 (hằng `WORKING_HOURS` trong `day-timeline/timelineLayout.ts` — chờ master data ca làm). Lịch hẹn ngoài khung thì khung nới ra tới giờ chẵn.
- Kéo chuột chỉ cuộn ngang, **không** đổi giờ lịch hẹn. Cột tên chỉ còn tên bác sĩ. Bác sĩ đăng ký OFF ngày đó không có hàng (`useDentistList(availableOn)`); bác sĩ OFF mà vẫn còn lịch thì giữ hàng để lịch không biến mất.
- Màu khối: lịch hẹn tím nhạt, khách đang chờ viền đứt vàng, đang khám vàng, sắp xong (≤10 phút trước giờ kết thúc) xanh, quá giờ đỏ, đã khám xám, huỷ/trễ hẹn mờ + gạch ngang.
- Bấm ô trống → "Tạo lịch hẹn" điền sẵn bác sĩ + giờ; bấm khối → "Cập nhật lịch hẹn"; ⋮ dùng chung menu với thẻ tuần (`appointmentCardMenu.tsx`).
- Bỏ `DayViewGrid.tsx`, `DayViewHeader.tsx`. Header, tab, toolbar, 6 bộ đếm, view Tuần/Tháng giữ nguyên.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-667 | Viết hook cuộn kéo riêng vào `src/hooks/useDragScroll.ts` làm mất `initTableGrabScroll` toàn app (`main.tsx` import). | Khôi phục file từ HEAD. Cuộn kéo của timeline chỉ cần thêm `.dtl-scroll` vào `GRAB_SCROLL_SELECTORS` + hai rule con trỏ trong `index.css`. Kéo bắt đầu từ khối (`role="button"`) không cuộn — đúng thiết kế của helper. |
| R-668 | Khối 15 phút (~60–80px) chỉ hiện "[...": mã khách chiếm hết chỗ, nút ⋮ (opacity 0) vẫn giữ 20px. | Nhãn hiển thị chỉ còn tên khách; mã + giờ + lý do nằm trong tooltip và `aria-label`. Nút ⋮ chuyển `position: absolute`, nền `inherit`, phủ lên đuôi nhãn khi hover. Ô góc "Bác sĩ" thêm ellipsis. |
| R-669 | 9 test đỏ ở `appointment.spec.ts` (2), `appointment-history.spec.ts` (4), `patient-appointment.spec.ts` (3): `fill()` vào ô ngày có mask để lại "03/10/2026". | **Có sẵn từ trước**: cùng đúng tập đó đỏ trên bản build HEAD (git archive + junction node_modules, preview :8092). Không do thay đổi này. Chưa sửa. |
| R-673 | Lịch đã huỷ vẫn nằm trên timeline (mờ, gạch ngang), chiếm tầng và che ô trống — bấm vào mở lịch huỷ thay vì tạo lịch mới. | BA chốt "đã hủy không hiện ở đây". `timelineRows.timelineBookings` bỏ `cancelled` ngay ở nguồn: không vẽ khối, không giữ hàng cho bác sĩ OFF, không nới khung giờ. Trễ hẹn vẫn hiện mờ; trạng thái khối đổi tên `cancelled` → `noShow`, key `Appointment:Timeline:NoShow` ("Trễ hẹn" / "No-show"). Bộ đếm "Huỷ hẹn" trên toolbar vẫn đếm như cũ; bấm vào thì timeline trống. Spec test 1 thêm một lịch huỷ lúc 10:00 và kiểm tra hàng chỉ còn 1 khối. |

Kiểm chứng: `tsc` sạch; `e2e/appointment-day-timeline.spec.ts` 4/4 xanh trên bản build production (preview :8091, host thật :5000, DB thật): bác sĩ OFF không có hàng, lịch nằm đúng hàng và còn sau reload, trục 07:00…19:30, bấm ô 08:00 mở form điền sẵn, kéo chuột cuộn >300px mà không mở dialog và `slotStart` không đổi, check-in → viền chờ, start → đang khám, có vạch "bây giờ". "calendar grids read their own date range" và 3 test doctor-day-off-pickers vẫn xanh. Ảnh chụp 1600×900 và 390×844: không tràn ngang trang.
Lưu ý: nhãn legend/ô góc hiện key thô (`Appointment:Timeline:*`) cho tới khi **khởi động lại API host** để nạp 8 key mới trong `vi.json`/`en.json`.
Retest level **2** (Lịch hẹn) + Level 3 nhẹ cho helper cuộn kéo dùng chung (chỉ thêm selector).


## 2026-10-03 — Hồ sơ bệnh nhân › Lịch hẹn: icon đồng hồ xem lịch sử từng lịch hẹn (R-670 … R-672)

Yêu cầu BA (ảnh chú thích), **không** có trên bản gốc. Cột Thao tác mỗi dòng thêm icon đồng hồ (giống nút toolbar) → mở hộp thoại "Lịch sử thay đổi lịch hẹn" chỉ của lịch hẹn đó, mọi thay đổi (không giới hạn tuần), để biết khách có đổi lịch hay không. Chỉ đổi FE + 2 key i18n (`Patient:Appt:History`, `Appointment:History:ModalSubtitleOne`); API `appointment-change-log` đã nhận `appointmentId` từ trước.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-670 | Spec mới: hộp thoại theo dòng chỉ có 1 dòng "Tạo mới", không có "Cập nhật" dù PUT đổi giờ thành công (DB có log `startTime,toTime`). | Hai lịch hẹn của test cùng nội dung `E2E lịch sử ${id}` → `findAppointmentRow` bấm nhầm dòng của lịch hẹn kia. `bookAppointment` nhận thêm `label` (" dời" / " giữ"). |
| R-671 | `getByRole("button", { name: "Lịch sử thay đổi", exact: true })` không tìm thấy nút toolbar. | Tên truy cập của nút AntD có cả nhãn icon: "history Lịch sử thay đổi". Dùng `/Lịch sử thay đổi$/` — vẫn loại được icon dòng ("…lịch hẹn"). |
| R-672 | 3 đỏ có sẵn trong `patient-appointment.spec.ts` + 5 đỏ trong `appointment-history.spec.ts` (R-669): `fill()` vào ô ngày mask. | Sửa helper `chooseSlot` của hai spec: click vào ô ngày ở mép trái (`position {x:4,y:8}`), `pressSequentially` chữ số, Enter. `appointment.spec.ts` (2 đỏ của R-669) **chưa sửa**. |

Kiểm chứng (build production `vite preview` :8091, host thật :5000 Development, DB thật): `appointment-history.spec.ts` **5/5** — test mới đặt 2 lịch, dời 1 lịch qua dialog Cập nhật thật, icon dòng đọc `appointmentId=` không `fromDate=`, đúng 2 dòng (Cập nhật `ngày giờ → ngày giờ` + Tạo mới), không lẫn lịch kia, không có `.ah-week`, toolbar vẫn có tuần, reload rồi kiểm lại; `patient-appointment.spec.ts` **6/6**. `tsc` sạch.
Retest level **2** (Lịch hẹn của hồ sơ bệnh nhân + hộp thoại lịch sử).


## 2026-10-05 — Header: ribbon sub-function luôn hiện (R-674 … R-677)

Yêu cầu BA (ảnh chú thích): hàng sub-function dưới header lúc nào cũng hiện; nhóm không có sub-function (Tổng quan) thì hàng để trống; bấm nhóm nào thì đổi sub-function của nhóm đó. Chỉ đổi FE (`AppLayout`, `HeaderNav`, hook mới `useRibbonGroup`, CSS).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-674 | Ribbon chỉ mở khi bấm nhóm, tự đóng khi đổi trang / Esc / bấm ra ngoài. | `useRibbonGroup`: mặc định hiện nhóm chứa trang đang mở; bấm nhóm → hiện nhóm đó (gắn với `pathname`, đổi trang thì tự hết hiệu lực); Esc → về nhóm của trang. Bỏ tấm chặn click (`.app-nav-backdrop`) cho ribbon — nó giờ là một phần của thanh, không phải popup; tấm chặn chỉ còn cho chuông thông báo. Dưới 1100px ribbon ẩn cùng nhóm (drawer giữ menu). |
| R-675 | Owner: bấm sub item của nhóm khác thì ribbon nháy về nhóm cũ một nhịp rồi mới qua nhóm mới. | `handleSelectEntry` reset ribbon trước khi router commit trang mới (router chạy trong transition, chậm hơn một nhịp). Bỏ reset ở đó; nhóm đang xem tự hết hiệu lực khi `pathname` đổi. Nhóm dạng link (Tổng quan) cũng `browse` trước khi navigate thay vì reset. Bỏ luôn `key` + animation `popIn` trên ribbon — trên một thanh luôn hiện, trượt 10px mỗi lần đổi nhóm trông như nháy. Spec có MutationObserver bắt nhóm cũ hiện lại dù chỉ 1 frame; đã xác nhận spec **đỏ** khi đưa lại dòng reset cũ. |
| R-676 | Ribbon trống thấp hơn ribbon có item (chiều cao item phụ thuộc line box của font, đo lẻ 48.3–49.3px). | Item ribbon cố định `height: 34px`; token `--bd-ribbon-height: 49px` (= 7 + 34 + 7 + 1) làm `min-height`. Thêm `--bd-topbar-height` (header + ribbon, ribbon = 0 dưới 1100px) và đổi các trang tự tính chiều cao theo cửa sổ (`labo.css`, `patient-detail.css`, 3 chỗ trong `index.css`) từ `--bd-header-height` sang token này — nếu không các trang đó dư 49px và cuộn. |
| R-677 | 3 test đỏ trong `header-navigation.spec.ts`: URL `/reception$` (nhận thêm `?branchId=`), drawer 15 mục (spec chờ 14), menu ngôn ngữ không có mục "Tiếng Việt" khi đang ở tiếng Anh. | **Không do thay đổi này**: phần đỏ nằm ở dòng spec không sửa, code liên quan (`nav.ts`, `HomeRedirect`, i18n) không đổi so với HEAD. Chưa sửa. Trang Labo dư 26px cuộn cũng có sẵn (phép tính cũ cho ra đúng 26px). |

Kiểm chứng (dev server :5173, host thật :5000, DB thật, đăng nhập thật): `header-navigation.spec.ts` 7/10 xanh (3 đỏ = R-677), `role-permissions.spec.ts` 1/1 xanh (dentist chỉ thấy "Bệnh nhân" trong ribbon). Đo trên trình duyệt 1440×900: ribbon 49px cả khi có item (/reception, /labo) lẫn khi trống (/dashboard). `tsc` + eslint sạch.
Retest level **3** (thanh header dùng chung mọi trang).


## 2026-10-05 — Lịch sử thay đổi lịch hẹn: tên trường tiếng Việt (R-678)

Yêu cầu owner (ảnh chú thích): chip "Các trường bị ảnh hưởng" hiện `Status` thay vì "Trạng thái". Chỉ đổi FE. Ghi chú "Loại: Người dùng" owner chưa hiểu — **để sau**, chưa đổi.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-678 | Tên trường hiện bằng khóa thô của server ở 3 chỗ: chip "Các trường bị ảnh hưởng" (`Status`), cột bảng "Thay đổi" (`status`, `content`), ô Before → After của dòng Tạo mới (`+ startTime`). Chỉ "So sánh trước / sau" và file xuất là đã dịch. | Cả 3 chỗ đi qua `fieldLabel()` (bản dịch `Appointment:History:Field:*` có sẵn). Thêm `id` → key có sẵn `Appointment:History:AppointmentId` ("Mã số lịch"). Bản gốc in khóa thô ở cột "Thay đổi" — lệch có chủ ý theo yêu cầu owner; spec đổi từ `content` sang "Nội dung". |

Kiểm chứng (build production `vite preview` :8080, host thật :5000, DB thật): `appointment-history.spec.ts` **5/5**. `tsc` sạch.
Retest level **2** (hộp thoại lịch sử lịch hẹn).


## 2026-10-05 — Lịch sử thay đổi lịch hẹn: cột bảng theo BA (R-679 … R-682)

Yêu cầu BA (ảnh chú thích tab "Bảng"): đổi tiêu đề "Người" → "Người thay đổi"; bỏ cột "Thay đổi"; bỏ cột "Nguồn"; thay "Before → After" bằng 2 cột "Giá trị cũ" / "Giá trị mới". Cột "Trạng thái": đã giải thích logic (gộp 7 trạng thái thành 4 nhóm Đã hẹn / Đã đến / Đã huỷ / Trễ hẹn; cùng nhóm thì in một chữ, khác nhóm in "A → B") — BA chốt **giữ nguyên**. Chỉ đổi FE + chuỗi i18n (vi/en, nhúng trong `Domain.Shared` nên phải build lại và khởi động lại host).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-679 | Cột "Thay đổi", "Nguồn" và ô "Before → After" khó đọc; dòng Tạo mới in `+ Mã số lịch · + Giờ bắt đầu …`. | Component mới `HistoryValueList`: mỗi trường một dòng "Tên trường: giá trị", cùng thứ tự ở 2 cột. Phía không có lịch hẹn (trước khi tạo, sau khi xoá) chỉ in một "—". Dòng Tạo mới bỏ `id`, `duration`, `color`, `patientName`, `patientPhone` (`tableChanges()`). Key `Table:Changes`, `Table:BeforeAfter` bỏ; thêm `Table:OldValue`, `Table:NewValue`; `Table:Person` = "Người thay đổi" / "Changed by". |
| R-680 | Đổi trạng thái trong cùng một nhóm hiện "Đã đến → Đã đến" (vd Đã đến → Đang khám). | `formatFieldValue("status")` dùng đúng tên trạng thái (Đã hẹn, Đã xác nhận, Đã đến, Đang khám, Hoàn thành, Đã huỷ, Trễ hẹn) thay vì tên nhóm. Ảnh hưởng cả panel chi tiết "So sánh trước / sau" và file xuất — đúng ý. Cột "Trạng thái" và bộ lọc trạng thái vẫn theo 4 nhóm. `statusGroupOfName` không còn dùng → bỏ. |
| R-681 | Bỏ cột "Nguồn" nhưng bộ lọc "Tất cả nguồn" còn (mọi dòng hiện đều là Web). | Owner chốt bỏ luôn: bỏ khỏi `HistoryFilterBar`, `useHistoryFilters`, `HistoryFilter.sources`, `toServerListParams`. API BE vẫn nhận `sources` (không đổi). Nguồn vẫn hiện ở tab Dòng thời gian và file xuất. |
| R-682 | Owner báo vẫn thấy tiêu đề "Người". | Chuỗi tải từ API host mỗi lần mở trang (FE không cache); tab mở trước khi host khởi động lại giữ bản cũ — tải lại trang là thấy "Người thay đổi". Spec kiểm tiêu đề `exact`. |

Kiểm chứng (dev server :5173, host thật :5000 đã build lại, DB thật, đăng nhập thật): `appointment-history.spec.ts` **5/5** — tiêu đề cột đúng 6 cột và không còn cột cũ, bộ lọc còn 2 ô, dòng Tạo mới "Giá trị cũ" = "—" và "Giá trị mới" có "Nội dung: …", "Trạng thái: Đã hẹn"; dòng sửa nội dung: cũ/mới đúng một dòng "Nội dung: …"; dời lịch: giờ cũ/mới nằm đúng cột. `tsc` + eslint sạch.
Retest level **2** (hộp thoại lịch sử lịch hẹn).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-683 | Owner: trường "Màu" hiện mã hex (`#EF4444`) thay vì màu. | `HistoryFieldValue` (trong `HistoryValueList.tsx`) vẽ chấm tròn đúng màu đó (`.ah-color-swatch`, màu qua `--ah-swatch`), tên màu của bộ chọn ("Đỏ", "Xanh lá"…) ở `title` / `aria-label`; màu ngoài bộ chọn thì tooltip là mã hex. Dùng cho cả 2 cột Giá trị cũ / mới lẫn panel "So sánh trước / sau". Dòng Tạo mới giờ hiện cả "Màu". File xuất giữ mã hex (là text). Spec: sửa lịch hẹn đổi màu Đỏ → cột Giá trị mới có ảnh tên "Đỏ", dòng không chứa "#". `appointment-history.spec.ts` 5/5. |

## 2026-10-05 — Tiếp nhận: tự lọc theo bác sĩ đăng nhập, tên bệnh nhân mở tab Hồ sơ (R-684 … R-686)

Yêu cầu BA (owner, kèm ảnh): (1) tài khoản là bác sĩ thì danh sách Tiếp nhận tự lọc bác sĩ = chính mình; (2) bấm tên bệnh nhân trên thẻ thì mở tab "Hồ sơ". Owner chốt: "bác sĩ" = ô tick **Bác sĩ** trên form Cập nhật nhân viên (`IsDentist`), không theo tên vai trò; chỉ chọn sẵn — bác sĩ bấm X để xem tất cả (không chặn ở BE); chỉ chọn sẵn **một lần** khi vào trang, đổi ngày/tuần/tháng giữ lựa chọn hiện tại.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-684 | Ô lọc "Bác sĩ" đã có sẵn nhưng luôn trống khi bác sĩ mở trang. | Danh sách bác sĩ của trang (`useReceptionDoctors`, toàn bộ nhân viên chi nhánh) giữ thêm `isDentist`. Hook `useOwnDoctorDefault` (reception/hooks): khi danh sách tải xong lần đầu, nếu user đăng nhập (staffId = userId) có trong danh sách và `isDentist` → `setSelectedDoctorId(user.id)`; `useRef` đảm bảo chỉ quyết định một lần (đổi chi nhánh cũng không chọn lại). Chỉ FE, không đổi BE / current-user DTO. Danh sách không lọc có thể chớp một lần trước khi chọn sẵn (chờ danh sách bác sĩ). |
| R-685 | Bấm tên bệnh nhân mở tab Lịch hẹn. | `ReceptionCard.handlePatientClick` → `?tab=profile`. Lịch tạm vẫn mở dialog "Tạo hồ sơ". |
| R-686 | Spec mới: quay lại hôm nay sau khi bỏ lọc không phát request. | Danh sách hôm nay không lọc đã nằm trong cache TanStack (request đầu tiên trước khi chọn sẵn). Spec sang một ngày chưa tải thay vì quay lại. |

Kiểm chứng (bản build production `vite preview` :8080, host thật :5000, DB thật, đăng nhập thật): `reception-own-doctor.spec.ts` **3/3** — `bs.anh` mở trang → request danh sách có `dentistId` = id của chính mình, mọi dòng trả về là của bác sĩ đó, ô lọc hiện "BS. Trần Quốc Anh"; sang ngày khác vẫn giữ; bấm X → request không `dentistId`, sang ngày khác vẫn trống; tải lại trang → chọn sẵn lại. `lt.huong` (không tick Bác sĩ) → không lọc. Bấm tên bệnh nhân → `/patient/{id}?tab=profile`, tab đang chọn "Hồ sơ". Spec reception cũ: follow-up / temporary / wait-time xanh hết; `reception.spec.ts` 2 đỏ có sẵn (chờ `/visits`, đã ghi ở F-11). `tsc` sạch.
Retest level **2** (Tiếp nhận).

## 2026-10-05 — "Chọn Dịch Vụ": bảng dịch vụ rộng và dài theo màn hình (R-687)

Owner (kèm ảnh): kéo dài dialog để bảng hiện hết thông tin — cột Ghi chú bị cắt, bảng cuộn ngang.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-687 | Bảng "Chọn Dịch Vụ" cuộn ngang, cột Ghi chú bị cắt; danh sách chỉ cao 400px cố định. | Bảng `min-width: 1190px` = đúng tổng 7 cột, nhưng thanh cuộn dọc của khung bảng ăn ~8px và dialog 1240px chỉ còn ~1182px → luôn tràn. Dialog lên `min(1760px, 100vw - 32px)` + `centered` (owner: rộng hơn nữa); các cột thành tỉ lệ (Đơn giá 11%, Số lượng 8%, Giảm giá 20%, Thành tiền 12%, Ghi chú 17%), cột Dịch vụ nhận phần còn lại, ô tick giữ 52px — dialog rộng thì mọi cột cùng giãn; `min-width` bảng 1131px. Khung bảng `max-height: max(240px, 100dvh - 600px)` (phần còn lại đo được ~534px + lề ~64px). Đo thật: 1920×1080 → dialog 1760, cột 52/490/186/136/339/203/288, bảng 480px, không cuộn ngang, thân dialog không cuộn; 1366×768 → không cuộn ngang, bảng 240px, thân cuộn ~70px (màn quá thấp). `consulting-delete-and-picker` + `consulting-review` (các test "Chọn Dịch Vụ") 3/3; test "Xoá phiếu chẩn đoán" đỏ một lần, chạy lại xanh (chập chờn, không đụng dialog). Retest level **1**. |

## 2026-10-05 — Tên bệnh nhân mở "Chẩn đoán & Tư vấn" cho bác sĩ / phụ tá / y sĩ (Tiếp nhận + Lịch hẹn) (R-688 … R-690)

BA đổi yêu cầu của R-685 (owner chuyển ảnh chat): tài khoản có **một trong 3** tick Bác sĩ / Phụ tá / Y sĩ trên form nhân viên → bấm tên bệnh nhân mở tab **Chẩn đoán & Tư vấn**; không tick nào → tab **Hồ sơ** (ai cũng vào được hồ sơ, vd kế toán vào thu tiền). Owner bổ sung: áp dụng tương tự bên Lịch hẹn. Tự lọc bác sĩ (R-684) **giữ chỉ tick Bác sĩ** (owner chốt).

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-688 | Tiếp nhận: tên bệnh nhân luôn mở "Hồ sơ" (R-685), BA muốn nhân sự lâm sàng vào thẳng "Chẩn đoán & Tư vấn". | Hook dùng chung `src/hooks/usePatientLinkTab.ts`: đọc hồ sơ nhân viên của chính user (`GET /api/v1/app/staff/{userId}`, staffId = userId) → `consulting` nếu `isDentist || isAssistant || isHygienist`, ngược lại `profile`. Chưa tải xong / không đọc được (403) → `profile` (không toast). `ReceptionPage` truyền `patientTab` xuống `ReceptionCard`. |
| R-689 | Lịch hẹn (chế độ Tuần): tên bệnh nhân trên thẻ mở `/patient/{id}` không có `tab` → trang hồ sơ rơi về tab mặc định. | `EventCard` dùng cùng hook → `?tab=consulting` / `?tab=profile`. Chế độ Ngày bấm khối mở dialog sửa lịch, chế độ Tháng không có link — không đổi. Hook nằm ở `src/hooks/` vì 2 feature cùng dùng (feature không import chéo). |
| R-690 | Spec Lịch hẹn: `click()` vào tên bệnh nhân trên thẻ tuần bị thẻ khác chặn. | Các lần chạy e2e trước đặt nhiều lịch cùng khung giờ, thẻ chồng lên nhau. Spec mở link bằng bàn phím (`press("Enter")`, thẻ có hỗ trợ sẵn). |

Kiểm chứng (bản build production `vite preview` :8080, host thật :5000, DB thật, đăng nhập thật): `reception-own-doctor.spec.ts` **6/6** (lọc bác sĩ 2 test + mở hồ sơ: `bs.anh`, `pt.linh`, `ys.trang` → `?tab=consulting`, tab active "Chẩn đoán & Tư vấn"; `lt.huong` → `?tab=profile`, "Hồ sơ"); `appointment-patient-link.spec.ts` (mới) **2/2** (`pt.linh` → Chẩn đoán & Tư vấn, `lt.huong` → Hồ sơ, từ thẻ chế độ Tuần). `tsc` + `eslint` sạch.
Chạy hồi quy `e2e/reception*` + `appointment.spec` + `appointment-day-timeline` sau đó: 17 pass / 13 đỏ — **dữ liệu local cạn**: chỉ còn 3/88 bệnh nhân không có lịch trong 40 ngày tới, fixture `bookVisitToday` / đặt lịch báo "no visit could be booked" (kể cả các test vừa xanh ở trên). 2 đỏ của `reception.spec.ts` là có sẵn (F-11). Chưa dọn DB chung — cần dọn lịch e2e cũ rồi chạy lại.
Retest level **2** (Tiếp nhận, Lịch hẹn).

## 2026-10-05 — Ô "Phụ tá" của công đoạn lấy thêm Y sĩ (R-691)

BA (ảnh chú thích trên dialog "Chi tiết phiếu" → Tiếp tục công đoạn): "Danh sách phụ tá — lấy thêm Y sĩ".

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-691 | Ô "Phụ tá" (Thêm / Tiếp tục công đoạn, dialog tái khám công đoạn) chỉ liệt kê nhân viên tick "Phụ tá". | `useAssistantSearch` (`src/hooks/useStaffOptions.ts`) lọc `isAssistant`; nay lọc `isAssistant \|\| isHygienist` (`StaffDto.IsHygienist` đã có sẵn, BE không đổi). Vẫn giữ lọc OFF hôm nay (`AvailableOn`) và fallback "không ai được tick → mọi nhân viên". Hook chỉ dùng cho `StageForm` + `StageFollowUpDialog`. |

Kiểm chứng: `tsc` sạch. **Chưa chạy runtime** (host :5000 đang tắt) — cần mở dialog công đoạn với seed `ys.trang` để thấy tên Y sĩ trong ô Phụ tá. Retest level **2** (công đoạn điều trị).

## 2026-10-05 — Tab mở hồ sơ không còn phụ thuộc quyền "Nhân viên – xem" (R-692)

Review lại R-688: hook đọc tick từ `GET /api/v1/app/staff/{userId}`, endpoint này đòi quyền `Staff.View`.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-692 | Tài khoản bác sĩ / phụ tá / y sĩ **không có** quyền "Nhân viên – xem" → `/staff/{id}` trả 403 → tên bệnh nhân mở "Hồ sơ" thay vì "Chẩn đoán & Tư vấn". Ngoài ra, bấm trước khi request đó về cũng mở "Hồ sơ". | 3 tick đưa vào `CurrentUserDto` (`IsDentist`, `IsAssistant`, `IsHygienist`, đọc từ `ExtraProperties` của user trong `AccountAppService`). `current-user` chỉ cần đăng nhập và đã được tải lúc vào app → lưu vào `useAuthStore` (`PrivateRoute`, `LoginForm`). `usePatientLinkTab` chỉ đọc store: không chờ request, không cần quyền. Thay thế cách đọc `/staff/{userId}` mô tả ở R-688. Tự lọc bác sĩ (R-684) vẫn dựa vào danh sách bác sĩ của Tiếp nhận (dropdown cần danh sách đó để hiện tên) — không đổi. |

Kiểm chứng (host thật :5000 build lại, bản build production `vite preview` :8080, DB thật):
- `e2e/current-user-ticks-api.spec.ts` (mới, HTTP thật) **4/4**: tạo nhân viên tạm với từng tick (Bác sĩ / Phụ tá / Y sĩ / không tick, không role), đăng nhập bằng chính tài khoản đó → `current-user` 200 trả đúng 3 tick, còn `/staff/{id}` trả **403** (đúng trường hợp lỗi cũ); xoá nhân viên tạm sau test.
- `reception-own-doctor.spec.ts` lọc bác sĩ **2/2**.
- 4 test mở hồ sơ ở Tiếp nhận và 2 test ở Lịch hẹn **đỏ ở bước đặt lịch** (`bookVisitToday`: không còn bệnh nhân trống lịch, chưa gửi POST nào). Dữ liệu cạn như ở R-688, không do code.
- Kiểm tay trên trình duyệt thật (không tạo dữ liệu, bấm thẻ đã có sẵn trên bảng hôm nay): `pt.linh` → `?tab=consulting`, tab active "Chẩn đoán & Tư vấn"; `lt.huong` (`current-user` trả 3 tick false) → `?tab=profile`, "Hồ sơ".
- `tsc -b` + `eslint` sạch, BE build 0 lỗi.

Retest level **3** (đổi DTO `current-user` dùng chung — các nơi khác gọi `setAuth` đều spread `...user` nên không ảnh hưởng). Phải dọn lịch e2e cũ trong DB local rồi chạy lại 6 test mở hồ sơ.

## 2026-10-05 — Tiếp nhận: danh sách bác sĩ đủ cả chi nhánh, không dừng ở 50 người (R-693)

Review R-684: ô lọc bác sĩ (và ô chọn bác sĩ khi tạo phiếu, danh sách bác sĩ theo ngày) lấy `/staff?MaxResultCount=50` → chi nhánh hơn 50 nhân viên đang làm thì ai đứng sau 50 người đầu (xếp theo tên) không chọn được, bác sĩ đó đăng nhập cũng không được tự lọc. Owner chốt: lấy đủ, nhưng phải giữ tốt hiệu năng. Tài khoản không có quyền "Nhân viên – xem" giữ nguyên (ô trống) — owner: bác sĩ thường có quyền này.

| ID | Hiện tượng | Nguyên nhân / xử lý |
|---|---|---|
| R-693 | Bác sĩ ngoài 50 nhân viên đầu của chi nhánh: không có trong ô lọc / ô chọn bác sĩ, không được tự lọc. | FE: `fetchReceptionDoctors` lấy `MaxResultCount=1000` (trần của ABP). BE: `StaffAppService.GetListAsync` trước map **2 query cho mỗi nhân viên** (`GetRolesAsync` + phân công chi nhánh) — Tiếp nhận gọi danh sách này cho mỗi ngày có lịch trên bảng (tháng ~30 lần), nên lấy đủ mà không sửa thì hàng nghìn query. Nay `MapListAsync`: role của cả trang bằng `IIdentityUserRepository.GetRoleNamesAsync(ids)` (1 query; dự án không gán role qua organization unit, test so khớp với `GetRolesAsync` từng dòng), chi nhánh bằng 1 query `StaffId IN (...)`. `GetAsync` / tạo / sửa vẫn map một người như cũ. |

Kiểm chứng (host thật :5000 build lại, bản build production `vite preview` :8080, DB thật):
- `e2e/reception-doctor-list.spec.ts` (mới) **2/2**. Tạo 52 nhân viên tạm "Aaa E2E …" (role xen kẽ: không role / `dentist` / `Quản lý chi nhánh`+`dentist`) và 1 bác sĩ tạm "Bác sĩ E2E …" (role `Quản lý chi nhánh`) → kiểm tra trước: bác sĩ **không** có trong `MaxResultCount=50` (đúng ca lỗi). `MaxResultCount=1000` trả đủ (`items = totalCount`), role + chi nhánh **từng dòng** khớp `GET /staff/{id}` (đường map một người cũ), có cả bản `AvailableOn`. Đăng nhập bằng bác sĩ tạm → bảng gọi `dentistId` = chính họ, ô lọc hiện tên họ. `afterAll` xoá theo tiền tố tên (dọn cả lần chạy bị ngắt giữa chừng).
- Thời gian (log host): danh sách ~78 nhân viên **~20 ms** mỗi lần.
- Spec tạo nhân viên song song bị `Volo.Abp.Identity:ConcurrencyFailure` (cùng role) → tạo tuần tự.
- Hồi quy: `staff.spec`, `staff-day-off-api` 3/3, `role-permissions`, `reception-temporary` 3/3, `current-user-ticks-api` 4/4, `reception-own-doctor` lọc bác sĩ 2/2 — xanh. `reception-follow-up.spec.ts` 11 đỏ, cả 11 là "no visit could be booked for today" (DB local cạn bệnh nhân trống lịch, như R-688/R-692).
- BE build 0 lỗi, `tsc -b` + `eslint` sạch.

Retest level **3** (đổi `StaffAppService.GetListAsync` dùng chung với màn Nhân viên và các ô chọn nhân viên).

### 2026-10-05 — dọn lịch e2e cũ trong DB local, chạy lại các test đỏ vì cạn dữ liệu (R-688 / R-692 / R-693)

Owner duyệt dọn. Chỉ **xoá mềm** (`IsDeleted = true`) trong DB local, chỉ các lịch từ hôm nay trở đi, tạo trước đó hơn 30 phút (để không đụng test của session khác đang chạy):
- lịch có `ChiefComplaint` bắt đầu `e2e-` (`searchKey` của `bookVisitToday` và các spec khác);
- lịch tái khám (Type 5) mà một lịch `e2e-` trỏ tới qua `FollowUpAppointmentId`, với `Notes` rỗng.

Tổng **104 lịch**. Không đụng 24 lịch khác do admin tạo (không có dấu e2e, không rõ nguồn) và 1 lịch tái khám có ghi chú tay. Sau khi dọn, chi nhánh 1 có **70** bệnh nhân không có lịch trong 40 ngày tới (trước là 0); chi nhánh 2 vẫn 3.

Chạy lại trên bản build production (`vite preview`, thư mục riêng, cổng 8094 — cổng 8080 đang có preview của session khác) với host thật :5000:
`reception-own-doctor` + `appointment-patient-link` + `reception-follow-up` + `reception-doctor-list` → **21/21 xanh**. Trong đó có 6 test mở hồ sơ của R-692 và 11 test của `reception-follow-up` trước đây đỏ ở bước đặt lịch.

Dữ liệu sẽ lại cạn sau vài chục lần chạy, vì fixture không dọn lịch nó tạo. Chưa sửa fixture.

## 2026-10-05 — Khách hàng › Thanh toán: ẩn các nút thanh toán khi thiếu quyền (R-694 / R-695 / R-698)

Owner: "Nếu user không có quyền thanh toán → ẩn các nút thanh toán". Mỗi nút gác theo đúng lá mà endpoint nó gọi kiểm ở server.

| ID | Lỗi | Sửa |
|---|---|---|
| R-694 | Nha sĩ không có lá Thanh toán nào vẫn thấy: icon "Hóa đơn" ở dòng phiếu (Kế hoạch điều trị), "In Hóa Đơn" ở Chi tiết phiếu điều trị, "Thanh toán" trong hộp "Chi tiết phiếu", "Tạo phiếu thanh toán" ở dòng bảng điều trị (Hồ sơ), và 3 tab Thanh toán / Hoàn tiền / Dư nợ của trang chi tiết phiếu. Bấm vào thì server trả 403. | Hai nút hoá đơn điện tử (`TreatmentPlanPanel`/`planColumns`/`PlanCardList`, `PlanServicesToolbar`) gác `payment.finalize`, vì `IssueAsync`/`IssueFromPaymentAsync` đòi Chốt phiếu. Hai nút thu tiền (`TreatmentStageDialog`, `treatmentColumns` qua `PatientProfileTab`) gác `payment.create`. Ba tab tiền (`TreatmentPlanDetailPage` → `PlanDetailHead.tabs`) gác `payment.read`; nếu `?planTab=` trỏ vào tab bị ẩn thì quay về Chi tiết. |
| R-695 | (Phát hiện khi test) Thiếu `payment.read` thì bảng điều trị ở tab Hồ sơ trống ("Chưa có điều trị"): các dòng dựng từ `GET patient-account` (`PatientPaymentAppService.GetAccountAsync`, `[Authorize(Payment.Read)]`). Có từ trước thay đổi này. | Owner (2026-10-05): "vẫn xem được data điều trị, chỉ ẩn nút thanh toán". `PatientProfileTab` dựng dòng từ `useTreatmentPlans` (`GET patient-treatments`, chỉ cần `treatmentConsultation.read`). `usePatientAccount` nhận thêm `enabled`, và chỉ gọi khi có `payment.read`. `useTreatmentPlans` lấy 100 phiếu (trước 50), bằng số patient-account lấy. Không có read thì các ô tiền ở Hồ sơ hiện 0; owner đã xác nhận không cần ẩn ô tiền. |
| R-698 | Màn Thanh toán & hoá đơn: nút "Thu tiền" gác `payment.create`, nhưng `InvoiceAppService.RecordPaymentAsync` lại đòi `Payment.Update`. Kết quả là người có Thêm thấy nút nhưng bấm thì bị 403, còn người có Sửa thì không thấy nút. | Owner: "sửa cho khớp". BE đổi sang `[Authorize(Payment.Create)]`, giống `PatientPaymentAppService.RecordAsync` (thu tiền là Thêm). FE giữ nguyên. |

Kiểm chứng: bản build production `vite preview` :8093 (thư mục riêng), host thật :5000, PostgreSQL thật, không chặn request.
- `e2e/payment-permission-buttons.spec.ts` (mới) **1/1**, 1,1 phút. Admin tạo nha sĩ thật và bật lá trên tab Phân quyền; nha sĩ đăng nhập ở phiên riêng. Kiểm 5 nấc:
  1. Không lá nào: mọi nút ẩn, `?planTab=payment-v2` về Chi tiết.
  2. Chỉ Xem: hiện 3 tab tiền, chưa có nút nào.
  3. Thêm: hiện 3 nút thu tiền (2 điểm vào hộp "Chi tiết phiếu" + dòng và toolbar Hồ sơ).
  4. Chốt phiếu: hiện "Hóa đơn" và "In Hóa Đơn".
  5. Chốt phiếu không có Thêm: hoá đơn hiện, nút thu tiền ẩn.
  
  Mọi locator "ẩn" đều có ít nhất một nấc phải hiện, nên không pass rỗng. Lá được trả về và nha sĩ bị xoá sau test.
- `patient-permission-gates.spec.ts` **1/1**, `treatment-plan-detail.spec.ts` **15/15** (lần chạy đầu đỏ 1 test 640px, chạy lại xanh).
- `treatment-plan.spec.ts:199` **đỏ**: `<th>` "Thêm công đoạn" chặn click vào nút "+" ở viewport 1280×720, vì thân bảng co về 0px khi bệnh nhân fixture đã có 11 phiếu. Bản build baseline (working tree **trừ** 9 file của thay đổi này) đỏ **y hệt**, nên đây là lỗi có sẵn. 6 test sau nó trong describe serial không chạy.
- `tsc -b` + `eslint` sạch.

Retest level **2** (FE của tính năng Thanh toán / Kế hoạch điều trị; không đổi BE).

Đợt 2 (R-695 sửa, R-698):
- Spec có thêm test 2: "payment.create alone collects on an invoice; read alone cannot". Admin tạo và phát hành hoá đơn. Nha sĩ chỉ có Xem thì không thấy "Thu tiền" và POST `/payment` trả 403. Bật Thêm thì thu được 40.000. Admin đọc lại thấy `paidAmount` 40000, `balanceDue` 60000. Cuối test hoá đơn bị huỷ. Test 2 xanh khi chạy riêng trên :8093 (host có thay đổi BE).
- Nấc "không lá nào" của test 1 có thêm câu kiểm: dòng điều trị Hồ sơ vẫn hiện, không có nút thu tiền.
- Lượt chạy chung `patient` + `treatment-stage-chain` + spec này (20,8 phút): 48 xanh, 28 đỏ. Trong đó 26 đỏ ở `patient.spec`, khớp nhóm đỏ có sẵn ở HEAD (xem e2e pre-existing reds 2026-10-01), cộng test 1 của spec này hết giờ 420 s trong lượt chung.
- **Chưa đối chiếu xong với baseline.** Owner dừng các lượt Playwright ("không cần playwright"). Đã kiểm `tsc -b` sạch, `eslint` sạch (chỉ còn lỗi `react-hooks/exhaustive-deps` có sẵn ở HEAD), build `BlueDental.Application` thành công.
- Trạng thái: chưa VERIFIED lại cho đợt 2.

Retest level **3** (đổi quyền BE của Billing).

## 2026-10-05 — Chi tiết phiếu › Lịch sử điều trị: răng đã hoàn thành tô xanh lá (R-696 / R-697)

Quy tắc do BA đưa ra (2026-10-05), **không lấy từ bản gốc**: bản gốc không tô màu "đã hoàn thành" cho răng. Owner đã xác nhận ba điểm:
- "ngày hoàn thành" là ngày của dòng công đoạn (`creationTime`);
- ở dòng bảo hành, răng đang làm lại hiện xanh tím;
- chip xanh lá có viền và nền cùng màu như chip xanh tím.

| ID | Thay đổi / lỗi | Sửa |
|---|---|---|
| R-696 | Bảng lịch sử chỉ có hai trạng thái răng: xanh tím (dòng này làm) và trắng. Không nhìn ra răng nào đã xong. | Thêm `historyTeeth` (`stage/stageModel.ts`): mỗi chip là `idle` / `worked` / `done`. Thứ tự xét: (1) công đoạn của dòng đã hoàn thành và còn giữ răng (`openTeeth`, tức răng chưa giao sang công đoạn sau) thì là done; (2) dòng này làm răng đó thì là worked; (3) có công đoạn hoàn thành của cùng dịch vụ với `creationTime <=` dòng này giữ răng đó thì là done; (4) còn lại là idle. Vậy một răng làm ngày 11-12-13 và xong ngày 13 thì xanh tím ở ngày 11, 12, xanh lá từ ngày 13 trở đi. Dòng bảo hành làm lại răng thì răng đó lại xanh tím ở dòng ấy. Bỏ tick Hoàn thành (`revert-status`) thì màu về như cũ vì màu được tính ra, không lưu. `StageHistory` dùng map `TOOTH_CLASS`. CSS `.pd-stage-histtooth--done` dùng viền và nền `--bd-success`, chữ trắng. Không đổi BE. |
| R-697 | (Test) Lượt chạy cả file đỏ ở test mới, chạy riêng lại xanh. (a) `click({ force: true })` vào ô Hoàn thành chạy 32 ms sau khi mở modal, lúc AntD còn chạy hiệu ứng phóng to. `force` bỏ qua bước chờ phần tử đứng yên nên cú click rơi xuống mask, modal đóng, `waitForResponse` hết giờ. (b) Câu kiểm "không có chip xanh lá" quét cả hộp thoại, mà lịch sử liệt kê cả phiếu fixture dùng chung, đã có công đoạn hoàn thành của test bảo hành. | Bỏ `force`. Thu câu kiểm về `.pd-stage-histrow[data-line-id=<dòng của test>]`. |

Kiểm chứng: bản build production `vite preview` :8080 (thư mục riêng `dist-tooth-done`, đã xoá sau khi chạy), host thật :5000, PostgreSQL thật, không chặn request.
- `e2e/treatment-stage-chain.spec.ts` **8/8**, 1,2 phút. Test mới "a finished tooth is green…" chạy thêm `--repeat-each=3` **3/3**. Test mới đi qua chuỗi sau:
  - dòng 11·12, rồi tiếp tục 11 sang dòng thứ hai, rồi dòng 13;
  - tick Hoàn thành dòng thứ hai: dòng đó 11 xanh lá, dòng đầu 11·12 xanh tím, dòng sau 11 xanh lá cạnh 13 xanh tím;
  - reload, kiểm lại cùng kết quả;
  - bỏ tick, 11 về xanh tím và không còn chip xanh lá nào trên dịch vụ.
- Test bảo hành có thêm câu kiểm:
  - răng gốc 11·21·22 xanh lá;
  - dòng bảo hành 11·21 xanh tím, 22 xanh lá;
  - xong bảo hành thì cả ba xanh lá.
- Fixture `freshLines`:
  - chỉ lấy dịch vụ của phiếu chi nhánh 1, vì dịch vụ chi nhánh khác trả 403 Catalogs:0013;
  - giới hạn đơn giá ở `originalPrice`, vì giá cao hơn trả 403 Treatment:0040.
- `tsc -b` + `eslint` sạch.

Retest level **2** (FE của tính năng Công đoạn điều trị; không đổi BE).

## 2026-10-05 — CSKH › Sau điều trị lấy từ "Tiếp tục công đoạn" (R-699 … R-701)

Yêu cầu chủ dự án: tiếp tục công đoạn → mỗi ngày điều trị một phiếu Sau điều trị (Ngày chăm sóc rỗng, cột Ngày điều trị mới), lọc theo tháng mặc định, trạng thái 2 giá trị Đã liên hệ / Chưa liên hệ có ghi lịch sử. Chi tiết: `docs/clone/pages/cskh-grouping.md`.

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-699 | Tab Sau điều trị không bao giờ có dữ liệu thật — chỉ seeder tạo phiếu loại này. | `AfterTreatmentCareRecorder` gọi từ `TreatmentStageAppService.ContinueAsync` (bỏ qua bảo hành); tìm phiếu cùng bệnh nhân + chi nhánh + `TreatmentDate` (ngày UTC+7, `ClinicCalendar`) thì gắn thêm công đoạn, không thì tạo. Migration `AfterTreatmentCareByVisit`: cột `TreatmentDate`, bảng `bd_care_contact_logs`, backfill phiếu loại 1 cũ theo `CreationTime`. |
| R-700 | "Lịch hẹn sắp tới" hiện `01/01/1 07:06` khi bệnh nhân không có lịch hẹn. | `FillAsync` dùng `GetValueOrDefault` trên `Dictionary<Guid, DateTimeOffset>` → `default(DateTimeOffset)` thay vì null. Đổi sang `TryGetValue`; giờ hiện "Chưa có lịch". |
| R-701 | Export Sau điều trị ghi "Chưa liên hệ" cho phiếu đã liên hệ. | `CareExportColumns.StatusLabel` thiếu nhánh `Contacted`; thêm "Đã liên hệ" và cột "Ngày điều trị". |

Kiểm chứng (dev server :5173, host thật :5000 Development, PostgreSQL thật, migration áp bằng DbMigrator): `e2e/cskh-after-treatment.spec.ts` **1/1** — tiếp tục công đoạn qua dialog thật → đúng 1 phiếu hôm nay, tiếp tục lần 2 cùng ngày vẫn 1 phiếu, có cả 2 công đoạn → trang mở ở Tháng, cột Ngày điều trị, Ngày chăm sóc "—" → đổi sang Đã liên hệ → reload vẫn giữ, Ngày chăm sóc = hôm nay, `contact-logs` có dòng mới kèm người đổi. `treatment-stage-chain.spec.ts` 7/7, `patient-care.spec.ts` 2/2, `cskh.spec.ts` 6/8: đỏ có sẵn — "creates a special care task" (locator `combobox` lọc theo nhãn nổi, đỏ cả khi stash thay đổi này) và "file-heart … birthday" (không idempotent: chạy lại trong cùng ngày thì dòng đầu đã Thành công nên click bỏ chọn; lần chạy đầu xanh). Domain.Tests 47/47, Application.Tests (CustomerCare + TreatmentManagement) 187/187, `tsc` sạch.
Retest level **3** (đụng `TreatmentStageAppService` dùng chung với Chi tiết phiếu).

## 2026-10-05 — CSKH: Sinh nhật / Nhắc lịch hẹn lấy từ dữ liệu thật, thêm tab Đặt lịch không đến (R-702 … R-705)

Yêu cầu chủ dự án (3 ảnh chú thích). Chi tiết: `docs/clone/pages/cskh-grouping.md`.

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-702 | Tab Sinh nhật / Nhắc lịch hẹn chỉ có dữ liệu seed — không có gì tạo phiếu. | `CareTaskSync` (gọi trong `FilteredQueryAsync`, chạy trong UoW riêng sau một khoá trong tiến trình vì list + stats tới cùng lúc) tạo phiếu còn thiếu cho khoảng đang xem; kiểm tra tồn tại bỏ qua soft-delete để phiếu đã xoá không sống lại. |
| R-703 | Thêm tab Đặt lịch không đến. | `CareType.MissedAppointment = 8`; `CareAppointmentRules` dùng chung cho đồng bộ và truy vấn: quá giờ > 5 phút, trạng thái Requested/Confirmed/NoShow. Tab Nhắc lịch hẹn bỏ lịch Cancelled. Lọc theo lịch hẹn sống nên dời/huỷ/check-in có hiệu lực ngay. Migration `CareTabsFromAppointments` (index `Type, AppointmentId`). |
| R-704 | Chuyển 2 trạng thái làm bộ đếm "Đã liên hệ" bỏ sót phiếu Thành công/Thất bại cũ; `SetContacted` từ chối phiếu đã đóng. | `CareRecord.IsContacted` = khác Mới và khác Huỷ; `SetContacted` chỉ chặn phiếu huỷ. Bộ đếm và bộ lọc dùng tham số `contacted` thay vì một `status`. |
| R-705 | E2E: dropdown trạng thái không mở khi bấm ngay sau khi gõ tìm kiếm / trên tab bảng cuộn ngang. | Không phải lỗi UI: (1) bấm trước khi request tìm kiếm (debounce) về → dòng bị thay, dropdown đóng; (2) cuộn tối thiểu đặt dropdown dưới cột Thao tác ghim phải. Spec chờ request `filter=` và cuộn dropdown ra giữa trước khi bấm. Test file-heart cũ chuyển sang tab Không làm dịch vụ và nhắm đúng dòng vừa seed (hết phụ thuộc thứ tự chạy). |

Kiểm chứng (dev server :5173, host thật :5000, PostgreSQL thật, migration qua DbMigrator): `e2e/cskh-generated-tabs.spec.ts` **6/6** (3 test × 2 lần): sinh nhật tháng này có trong mặc định Tháng, khách sinh tháng khác không có, bộ đếm Chưa liên hệ gửi `contacted=false`, đổi Đã liên hệ → reload giữ + có log; lịch hẹn ngày mai có trong Nhắc lịch hẹn, huỷ thì mất; lịch đã quá giờ chưa đến có trong Đặt lịch không đến, lịch còn phía trước thì không, check-in thì mất. `cskh.spec.ts` 7/8 (đỏ có sẵn: "creates a special care task"), `cskh-after-treatment.spec.ts` 1/1, `patient-care.spec.ts` 2/2. Domain.Tests CustomerCare 14/14, Application.Tests 187/187, `tsc` sạch.
Retest level **2** (CSKH).

## 2026-10-05 — CSKH › Sinh nhật hiện khách không có ngày sinh (R-706)

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-706 | Lọc tháng 9, tab Chúc mừng sinh nhật hiện khách "KHÔNG NGÀY SINH" (có khách 2 dòng). | Các dòng đó là phiếu "Happy Birthday" do test e2e cũ (`cskh.spec.ts` file-heart, đã sửa ở R-705) `POST` tay với `dueAt` = lúc chạy test; tab chỉ lọc theo `DueAt` nên hiện ra. Tab giờ chỉ lấy phiếu của bệnh nhân **có ngày sinh rơi vào khoảng lọc** (`CareBirthdayRules.PatientIdsBornIn`, dùng chung với `CareTaskSync`). Dữ liệu rác cũ vẫn nằm trong DB nhưng không còn hiện. |

Kiểm chứng: `cskh-generated-tabs.spec.ts` 3/3 — thêm bước tạo tay phiếu sinh nhật cho khách không có ngày sinh → không hiện; `cskh.spec.ts` 7/8 (đỏ có sẵn "creates a special care task"). Retest level **2**.

> Đánh số lại khi merge `origin/main` (2026-10-06): hai mục 2026-10-05 dưới đây bên origin ghi R-682 … R-685, trùng số với các mục Lịch sử lịch hẹn / Tiếp nhận đã có ở trên → đổi thành R-721 … R-724.

## 2026-10-05 — Chi tiết phiếu: ô Bác sĩ / Phụ tá / Bác sĩ hỗ trợ hiện người chưa tick vai trò (R-721 … R-722)

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-721 | Nhân viên chưa tick Bác sĩ/Phụ tá/Y sĩ (vd. "BAC SI 993956") vẫn nằm sẵn trong ô Bác sĩ khi Tiếp tục công đoạn và có trong danh sách. | Hai nguyên nhân: (1) form điền sẵn bác sĩ của công đoạn trước / dòng / phiếu / người đăng nhập mà không kiểm tra vai trò, và `ServerSearchSelect` chèn giá trị đang chọn vào danh sách; (2) hook lọc `isDentist` trên trang 20 dòng ở trình duyệt, không ai khớp thì trả **tất cả**. Sửa: `GET staff?Role=1` (Bác sĩ) / `Role=2` (Phụ tá **hoặc Y sĩ**) lọc ở server, bỏ fallback; composer bỏ tên điền sẵn không thuộc nhóm (`keepEligibleStaff` + `useStaffRoleIds`, có tính cả OFF hôm nay) → form báo "Vui lòng chọn bác sĩ". `useDentistStaffOptions` (CSKH, Labo, báo cáo, lịch hẹn) cũng lọc ở server, không còn fallback. |
| R-722 | E2E dựng công đoạn bằng "nhân viên đầu tiên" (người chưa tick vai trò) rồi Tiếp tục qua giao diện. | Các helper đổi sang `staff?MaxResultCount=1&Role=1`; `treatment-stage-chain` chọn bác sĩ trước khi lưu ở tab Thêm công đoạn (phiếu demo không có bác sĩ được tick). |

Kiểm chứng (dev :5173, host thật :5000, PostgreSQL thật): `stage-staff-pickers.spec.ts` **1/1** mới — công đoạn trước do người chưa tick làm → ô Bác sĩ trống; tìm tên người đó ở cả 3 ô không ra; Y sĩ có trong Phụ tá, không có trong Bác sĩ; bác sĩ không có trong Phụ tá. `treatment-stage-chain` 8/8, `treatment-plan-detail` + `cskh-after-treatment` xanh, `patient-appointment` + `reception-doctor-list` xanh. `patient.spec` nhóm công đoạn: 7 đỏ **có sẵn** (6 do DB local hết dòng dịch vụ còn răng chưa làm — helper dòng 155; 1 ở nhãn "Nội dung điều trị" dòng 2247) — đỏ y hệt khi stash thay đổi này. `tsc` sạch. Retest level **3** (hook chọn nhân viên dùng chung).

## 2026-10-05 — Rà soát ô chọn Bác sĩ / Phụ tá toàn FE (R-723 … R-724)

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-723 | "Tạo tiếp nhận" liệt kê Nguyễn Văn A (chỉ tick Phụ tá + Y sĩ) và cả nhân viên không tick vai trò làm Bác sĩ điều trị. | Rà mọi nguồn danh sách nhân viên ở FE. Sai 3 chỗ, đều sửa sang `role: STAFF_ROLE.Dentist` lọc ở server: (1) `receptionQueries.fetchReceptionDoctors` lấy **cả chi nhánh** — dùng cho bộ lọc, ô bác sĩ trên thẻ, Tạo tiếp nhận, Hẹn tái khám; (2) `staffQueries.useDentistList` lọc `isDentist` trên 50 dòng, không ai khớp thì lấy 8 người bất kỳ — dùng ở Lịch hẹn, Labo, Chẩn đoán & Tư vấn, CSKH bệnh nhân, Dashboard; (3) `ReportToolbar` lọc 200 dòng ở trình duyệt. Đúng sẵn: ô Phụ tá (chỉ ở form công đoạn, Phụ tá + Y sĩ — R-721), Bác sĩ chẩn đoán (`useDentistOptions`), Nhân sự tư vấn / Người tạo / Nhân viên / Chấm công (mọi nhân viên là đúng nghĩa). |
| R-724 | E2E `bookVisitToday` đặt lịch với bất kỳ nhân viên nào làm bác sĩ; Hẹn tái khám giờ bỏ người không phải bác sĩ → 4 đỏ ở `reception-follow-up`. Chỉ còn ~8 bác sĩ chi nhánh 1 nên khung giờ hay kín, và bệnh nhân rảnh cạn sau nhiều lượt chạy. | Fixture: `Role=1`; khung giờ kín thì lùi 10 phút (tối đa 8 giờ, không qua ngày); lấy 1000 bệnh nhân và tạo bệnh nhân mới qua API khi hết người rảnh. Xoá `reception-patient-link.spec.ts` (trùng 4 test sẵn có trong `reception-own-doctor.spec.ts`). |

Kiểm chứng (dev :5173, host thật :5000, PostgreSQL thật): `reception-doctor-roles.spec.ts` **1/1** mới (bộ lọc bác sĩ và Bác sĩ điều trị của Tạo tiếp nhận chỉ có người tick Bác sĩ) — **đỏ khi stash bản sửa**; `reception-follow-up` + `reception-own-doctor` + `appointment-patient-link` 20/20; `reception-doctor-list`, `labo-orders-actions`, `doctor-day-off-pickers` xanh. Đỏ **có sẵn** (y hệt khi stash): `appointment-day-timeline` 2, `reception-temporary` 1, `reception.spec` 2. `tsc` sạch. Retest level **3**.

## 2026-10-06 — Thanh toán & hoá đơn: bỏ chú thích "trên trang này", thêm lọc Ngày / Tuần / Tháng (R-707, R-708)

Yêu cầu chủ dự án (2 ảnh chú thích).

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-707 | Ba thẻ tổng có dòng "trên trang này" — chủ dự án bỏ. | Xoá caption, class `.billing-kpi-caption`, khoá `Billing:KpiOnThisPage`. Lưu ý: ba số vẫn là tổng của trang đang xem (API không trả tổng). |
| R-708 | Thêm bộ lọc Ngày / Tuần / Tháng cho danh sách hoá đơn, mặc định Ngày = hôm nay. | Dùng `PeriodPicker` chung (không `clearableMode` — không có trạng thái "không lọc"). `GetInvoiceListInput.FromDate/ToDate` (`DateOnly`, ngày phòng khám, đóng hai đầu) lọc `IssuedAt` qua `ClinicCalendar.StartOfDay`; Xuất Excel gửi cùng khoảng. Đổi khoảng → về trang 1. |

Kiểm chứng (dev server :5173, host thật :5000, PostgreSQL thật): `e2e/billing-period.spec.ts` **1/1** — mở trang ở Ngày + hôm nay; API: hoá đơn vừa tạo có trong `fromDate=toDate=hôm nay`, không có trong hôm qua; màn hình: reload thấy dòng, lùi 1 ngày mất dòng + "Chưa có hoá đơn", chuyển Tháng thấy lại. `payment-permission-buttons.spec.ts` 2/2. `tsc` sạch, build BE sạch.
Retest level **2** (Thanh toán).

## 2026-10-06 — Lỗi máy chủ không báo gì / trắng trang khi API sập (R-709, R-710, R-711)

Chủ dự án báo: API trả 502 (host :5000 chết sau proxy Vite) thì không có toast, danh sách hiện "Không có bệnh nhân phù hợp"; khi tải lại thì trắng trang.

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-709 | Query lỗi 5xx ở lần tải đầu không báo gì — màn hình hiện như danh sách rỗng. | `QueryCache.onError` trước đây bỏ qua mọi lỗi khi query chưa có dữ liệu (để màn hình tự hiện ErrorView — nhưng đa số màn không có). Giờ chỉ bỏ qua lỗi loại `user` (4xx: 403/404 do màn tự xử lý); lỗi `system` (5xx) và `network` luôn toast. Nhiều query lỗi cùng lúc ra cùng một câu → gộp một toast (id theo nội dung). |
| R-710 | `describeApiError` ném lỗi với 502 từ proxy. | Body rỗng / HTML bị `JSON.parse` thẳng → SyntaxError ngay trong handler lỗi. Thêm `parseBody` nuốt lỗi parse, rơi về câu mặc định "Lỗi hệ thống". |
| R-711 | API sập lúc mở app → trắng trang. | `I18nProvider` chờ `application-localization` mà không bắt reject, `ready` kẹt `false`. Giờ có pha `failed` → render `ServiceUnavailablePage` ("Hệ thống đang bảo trì" + "Thử lại"), tự thử lại mỗi 15 s, thử lại thì giữ màn bảo trì (nút loading) thay vì nháy trắng. Chữ trên trang này nằm cứng vi/en trong component — ngoại lệ có chủ đích vì chính nguồn i18n đang không truy cập được. |

Kiểm chứng: host :5000 tắt, mở `/patient` trên dev server :5173 → hiện màn bảo trì (đã chụp). Chưa kiểm chứng trên trình duyệt: toast R-709 (cần API sống cho localization nhưng endpoint nghiệp vụ trả 5xx). `tsc` sạch, eslint sạch.
Retest level **3** (handler lỗi query toàn cục + khởi động app) — chưa chạy e2e.

## 2026-10-06 — Phiếu thanh toán tạo trên kế hoạch hiện ở Tài chính → Thanh toán (R-712..R-716, F-47)

BA note (ảnh tab Thanh toán của kế hoạch, khoanh "Tạo Phiếu Thanh Toán"): "Sau khi tạo phiếu thanh toán — đổ dữ liệu lên trang Tài chính → Thanh toán". Phương án chủ dự án chốt: trang đọc `PatientPayment` thật, chỉ phiếu Thanh toán (Kind=Payment, mã THANHTOAN…); bỏ lọc trạng thái hoá đơn và các nút Thu tiền / Phát hành / Huỷ trên `/billing`.

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-712 | Phiếu thanh toán tạo trên kế hoạch không bao giờ hiện ở `/billing`. | Nguyên nhân: `/billing` đọc bảng `Invoice`, còn "Tạo Phiếu Thanh Toán" ghi `PatientPayment`. Thêm `PaymentLedgerAppService` (kế thừa `BlueDentalAppService`) + `PaymentLedgerController` viết tay: `GET api/v1/app/payment-ledger` và `/excel`. Chỉ Kind=Payment, theo chi nhánh hiện tại, lọc theo ngày phòng khám (`fromDate`/`toDate`), tìm theo mã phiếu / tên / mã hồ sơ; trả `totalAmount` cho cả khoảng lọc (không chỉ trang đang xem). Quyền: `payment.read` / `payment.export`. |
| R-713 | Trang `/billing` cũ (danh sách hoá đơn) bị thay. | `BillingPage` viết lại: 2 thẻ tổng (Tổng tiền đã thu, Số phiếu thanh toán), ô tìm kiếm, `PeriodPicker` mặc định Ngày = hôm nay, bảng chỉ đọc; mỗi dòng có link về tab Thanh toán của kế hoạch (`planTab=payment-v2`). Xoá `InvoiceRowActions`, `VoidInvoiceDialog`, hook `useInvoiceList` / `useIssueInvoice` / `useVoidInvoice`. R-707 / R-708 bị thay thế; `e2e/billing-period.spec.ts` xoá. Endpoint hoá đơn ở BE giữ nguyên (hồ sơ bệnh nhân và `PaymentModal` vẫn dùng). |
| R-714 | Tạo / xoá phiếu trên kế hoạch thì `/billing` đang mở không tự cập nhật. | Thêm root `["payment-ledger"]` vào entity `payment` trong `src/lib/queryEntities.ts` (kiểm bằng `satisfies RootOf<typeof paymentLedgerKeys>`). |
| R-715 | Gotcha e2e: gọi API thô bằng `page.request` cho kết quả khác với app. | (1) Không có `X-Clinic-Branch-Id` → tài khoản nhân viên (không có claim chi nhánh) bị `Organizations:0005` (403) dù có quyền. (2) Không có `Accept: application/json` → ABP ném lại lỗi phân quyền của action trả file (`IActionResult`) thành **500** thay vì 403. Request thô phải gửi đúng hai header như axios. |
| R-716 | **BẢO MẬT — CÒN MỞ, có từ trước.** Header `X-Clinic-Branch-Id` được tin mà không đối chiếu với chi nhánh user được phân. | `CurrentClinicBranchResolver.GetRequiredClinicBranchId()` lấy header trước, không kiểm tra `GetAccessibleBranchIdsAsync()`. Đo thật: `BRANCH2_USER` gửi header chi nhánh 1 → payment-ledger trả 89 phiếu, `/invoices` trả 76 hoá đơn của chi nhánh 1. Ảnh hưởng mọi service dùng resolver. **Chưa sửa**: sửa ở resolver là thay đổi Level 3 và cần chốt ai được đọc tất cả chi nhánh (admin chuyển chi nhánh không có `StaffBranchAssignment`). Test cách ly hiện có chỉ đi đường claim (không gửi header). |

Kiểm chứng (build production :8080, host thật :5000, PostgreSQL thật, không chặn API): `billing-ledger.spec.ts` **4/4** — tạo phiếu trên kế hoạch → mở Tài chính → Thanh toán từ menu thấy phiếu (mã, kế hoạch, phương thức, số tiền, thẻ tổng), reload còn, lọc hôm qua mất / Tháng thấy lại, phiếu Hoàn tiền không vào danh sách, chi nhánh 2 không thấy, xoá phiếu trên kế hoạch thì mất khỏi danh sách. `payment-permission-buttons.spec.ts` 2/2 (không quyền: 403 + màn "Không có quyền truy cập"; `payment.read`: danh sách, không nút Xuất Excel, `/excel` 403; thêm `payment.export`: tải được .xlsx). Hồi quy: `treatment-plan-detail` 13/13, `debt-history` 4/4, `cross-screen-freshness` 2/2, `einvoice-api` 5/5 — tổng **30/30**. BE: `PaymentLedgerAppServiceContractTests` 4/4, `ControllerConventionTests` 21/21. `routes.spec.ts` `/timekeeping` đỏ (màn "Server Error" của FE, host không có 5xx) — không đụng tới, chưa đối chứng với HEAD.
Retest level **2** (Thanh toán) + spec hồi quy liên quan `PatientPayment`.

## 2026-10-06 — Cột Thao tác ở Tài chính → Thanh toán: Xem/In phiếu + Xuất HĐĐT (R-717..R-720, F-47)

Chủ dự án hỏi có thêm cột Thao tác như tab Thanh toán của kế hoạch (👁 ✏️ 🗑 📄) không; chốt **chỉ 2 nút không làm đổi phiếu**: Xem/In phiếu và Xuất hoá đơn điện tử. Sửa / Huỷ vẫn làm trên kế hoạch (dòng có link về đó).

| ID | Triệu chứng / Quyết định | Xử lý |
|---|---|---|
| R-717 | `/billing` (feature billing) cần dialog "Chi tiết phiếu" và `InvoiceModal` của treatment-management — feature không được import chéo. | Ghép ở tầng app: `src/app/BillingRoute.tsx` import cả hai feature và truyền `dialogs: LedgerRowDialogs` (2 hàm render) vào `BillingPage`; router lazy-load `./BillingRoute`. Thêm `PlanReceiptViewer` (treatment-management) tự nạp bệnh nhân, phiếu kế hoạch, các phiếu thu khác, chi nhánh, tư vấn rồi vẽ đúng `PaymentReceiptDialog` của tab kế hoạch (Đã thanh toán trước / Còn lại tính như trên kế hoạch). Phiếu đã bị huỷ trong lúc xem danh sách → toast "Không tìm thấy phiếu…" và đóng. |
| R-718 | Nút 📄 phải ẩn khi phiếu không còn xuất HĐĐT được — danh sách trải nhiều kế hoạch, FE không có sẵn hoá đơn từng kế hoạch. | Server tính `CanIssueEInvoice` cho từng dòng trong `PaymentLedgerAppService.MapAsync` (một truy vấn cho cả trang): false nếu hoá đơn riêng của phiếu đã khác Draft, hoặc kế hoạch đã có hoá đơn cả phiếu (`PatientPaymentId == null`) chưa Cancelled — cùng luật với `isReceiptInvoiceable` ở FE và guard `EnsureNotInvoicedTwiceAsync` ở BE. Phát hành xong, `useIssueEInvoice` invalidate entity `payment` (đã chứa root `["payment-ledger"]`) → nút tự ẩn. |
| R-719 | 📄 theo quyền. | Chỉ hiện khi có `payment.finalize` (giống tab kế hoạch). `/draft` cần `payment.read`, phát hành cần `payment.finalize`. |
| R-720 | 👁 với user chỉ có quyền Thanh toán → dialog lỗi 403 rồi đóng. | Dialog đọc `GET /patients/{id}` (`patient.read`) và `GET /patient-treatments/{id}` (`treatmentConsultation.read`; tư vấn cũng qua bridge của leaf này). 👁 chỉ hiện khi có **cả hai** quyền đọc đó; chỉ `payment.read` thì dòng vẫn hiện nhưng không có nút. |

Kiểm chứng (build production :8080 proxy tới host mới build ra scratchpad :5001 — host :5000 của session khác khoá DLL nên không đụng; PostgreSQL thật, không chặn API): `billing-ledger.spec.ts` **5/5** (mới: API trả `canIssueEInvoice=true`; 👁 mở "Chi tiết phiếu" đúng mã, số dòng dịch vụ, tổng tiền, nút "In Hoá Đơn"; 📄 gọi `/e-invoices/draft` theo id phiếu, dialog "Hóa đơn" có dòng + "Lưu Nháp" — không phát hành). `payment-permission-buttons.spec.ts` **2/2** (chỉ `payment.read`: không 👁/📄; + `patient.read` + `treatmentConsultation.read`: 👁 mở phiếu, chưa có 📄; + `payment.finalize`: 📄 mở "Hóa đơn"). Hồi quy Level 3: `cross-screen-freshness`, `debt-history`, `einvoice-api`, `treatment-plan-detail`, `treatment-plan` — **33/33**. BE: `PaymentLedger*` 4/4, `ControllerConvention|PaymentLedger|ElectronicInvoice` 21/21. `tsc` + eslint sạch.
Retest level **3** (dialog phiếu + `InvoiceModal` dùng chung với kế hoạch).

## 2026-10-06 — Combo dịch vụ theo review P0510 (R-725 … R-727)

Yêu cầu chủ dự án: `save/P0510.drawio` từ "Update thêm màn hình cho combo nhé" trở xuống
(cộng phần "Thêm dịch vụ → Loại: Combo" mà các màn đó cần). Chi tiết: `docs/clone/pages/combo.md`,
giả định: `docs/clone/unknowns.md` (mục Combo dịch vụ).

| ID | Triệu chứng | Xử lý |
|---|---|---|
| R-725 | Chưa có combo: Danh mục không tạo được, "Chọn Dịch Vụ" không có tab Combo, không có gợi ý. | BE: `CatalogEntry.IsCombo` + `CatalogComboItem`, giá combo tính ở domain (`ReplaceComboItems`, `ChangePrice` bỏ qua trên combo), kiểm thành phần ở AppService (cùng chi nhánh, dịch vụ lẻ, chưa xoá), lọc `isCombo`, `GET catalog-entries/kind-counts`. FE: `ServiceEntryDialog` (Loại), `ComboDialog` + `ComboComponentPicker` / `ComboItemsTable` / `ComboPriceSection`, bốn tab tách ra `ServiceSettingsTabs` dùng chung với `ServiceDialog`; bảng mở dòng combo (`ComboEntryParts`), `ServiceKindFilter`; "Chọn Dịch Vụ": `AdvisePickerHead`, `AdviseComboNotice`, `AdviseComboGrid`, `useAdviseCombos`, `comboSuggestion`, thẻ tóm tắt có danh sách LẺ/COMBO. |
| R-726 | `taxonomy.spec` (3 ca) và `taxonomy-dialogs` (1 ca) đỏ sau khi thêm combo. | Không phải lỗi màn hình: `getByLabel(/^Dịch vụ/)` giờ khớp thêm nút radio "Dịch vụ lẻ", và nút đổi tên thành "Thêm dịch vụ / combo" theo review. Đổi locator sang `getByRole("textbox", { name: /^Dịch vụ/ })` và `/Thêm dịch vụ/`. |
| R-727 | Dialog combo: panel Danh mục bị 34 chip nhóm đẩy mất danh sách dịch vụ (đo bằng ảnh chụp local). Mở sửa một combo thoáng hiện dialog dịch vụ lẻ một khung hình. | Chip nhóm thành một hàng cuộn ngang; loại của dialog lấy thẳng từ mục đang sửa, chỉ mục mới mới dùng công tắc (reset lúc render, không qua effect). |

Kiểm chứng (vite preview :8080, host thật :5000, PostgreSQL thật — container `bluedental-postgres-1`
phải bật lại vì đã dừng 18 giờ, host cũ đang trả 500): `catalog-combo.spec.ts` **3/3**;
`taxonomy*.spec.ts` + `payment-qr` + `branch-isolation` + `branch-switcher` + `consulting-delete-and-picker`
+ `consulting-review`: 64 xanh lượt đầu, 8 đỏ — 4 là R-726 (xanh sau khi sửa), 2 ca `taxonomy-import-api`
(183, 202) xanh khi chạy lại, còn **2 đỏ do dữ liệu local**: `taxonomy-import-api:604` và
`taxonomy-service-sync:321` giả định nhóm quyền seed `dentist` không có quyền nào, nhưng DB local
đang có **372** grant trên nhóm đó (do các spec khác bật lá quyền mà không trả lại) — không liên quan
thay đổi này, chưa đụng vào dữ liệu đó. Domain.Tests **568**, EF.Tests **64**, Application.Tests **656**
xanh; `tsc` sạch; `oxlint` không cảnh báo mới. Retest level **3**.

## 2026-10-06 — Merge `feature/service-combo-f48` vào `main` (R-728, R-729)

Nhánh `feature/service-combo-f48` (commit `34f24a8c`) dựng combo song song với combo đã có trên
`main` (`134377ab`, R-725..R-727), cùng gốc `1863873e`. Khi merge: **phần combo giữ theo `main`**
(`CatalogEntry.IsCombo` + `CatalogComboItem`, migration `CatalogCombos`, `ComboDialog`, "Chọn Dịch Vụ");
mô hình combo của nhánh bỏ hẳn (`ServiceKind` trên `CatalogServiceConfig`, `TaxAmount` /
`AmountCollected`, migration `ServiceCombo` — trùng bảng với `CatalogCombos`, các component
`ComboComponentTable` / `ComboDialogLayout` / `ComboServicePicker` / `ComboSavingsBanner` /
`TaxSegmented`, hook `useComboComponents` / `useComboPricePreview`, spec `taxonomy-combo*`,
`treatment-plan-combo`). Hai sửa lỗi không thuộc combo của nhánh được giữ:

| # | Lỗi | Sửa |
|---|-----|-----|
| R-728 | Nhập Excel cập nhật một dịch vụ làm mất NCC labo đã chọn (sheet không có cột Labo, `EntryMerge.MergeServiceConfig` trả `LaboSupplierIds = []` → `ReplaceLaboSuppliers([])`). Lỗi có sẵn, nhánh ghi trong R-725 của nó. | `EntryMerge.MergeServiceConfig` giữ `stored.LaboSupplierIds`. Spec mới `taxonomy-import-api` "updating a service from the sheet keeps the Labo suppliers it does not carry" (API thật: nhập → gắn NCC → nhập lại đổi giá → giá đổi, NCC còn). |
| R-729 | Đổi chi nhánh rồi reload quay về chi nhánh cũ (R-730 của nhánh): `clinicBranch.syncToUrl` ghi `?branchId=` bằng `history.replaceState` ngoài React Router, lần `setSearchParams` kế tiếp ghi lại chi nhánh cũ. | Lấy nguyên từ nhánh: `clinicBranch.routeBranchUrlThrough(replacer)`, `main.tsx` đăng ký `router.navigate(..., { replace: true, preventScrollReset: true })`; URL không đổi thì không điều hướng. |

Kiểm: `tsc -b` sạch; BE Catalog tests Domain **67**, Application **63**, EF **4** xanh. E2E trên build
production (`vite preview` :8080, API thật :5000): `taxonomy-import-api` + `branch-*` **17/18**,
`taxonomy*` + `payment-qr` + `catalog-combo` **48/49**. Hai ca đỏ là hai ca đỏ có sẵn do dữ liệu local
đã ghi ở mục R-725..R-727 (`taxonomy-import-api` "…gets 403…", `taxonomy-service-sync` "…may only read
services…": nhóm seed `dentist` trên DB local đang có grant) — không do merge này. Retest level **3**.

## 2026-10-06 — Chế tài nhân viên (F-49, R-735..R-738)

Tính năng mới, BlueDental riêng (bản gốc không có) — `docs/clone/pages/staff-penalty.md`.
Hai lỗi tìm thấy khi chạy thật trên trình duyệt trước khi viết E2E, sửa luôn:

| # | Lỗi | Sửa |
|---|-----|-----|
| R-735 | Dialog "Lập phiếu chế tài": ô Ngày vi phạm mở ra trống thay vì hôm nay. `form.setFieldsValue` trong `useEffect` chạy khi Form trong Modal (`destroyOnHidden`) chưa mount nên bị bỏ qua. | Dùng `initialValues` của Form — dialog bị huỷ khi đóng nên mỗi lần mở là một lần mount mới. |
| R-736 | Chọn Loại vi phạm có mức phạt mặc định: hình thức chuyển sang Phạt tiền nhưng ô Số tiền phạt trống. Ô này chỉ render khi `action === Fine`, nên giá trị gán cùng lúc với `action` rơi vào field chưa đăng ký. | Ô luôn có trong form, chỉ `hidden`; luật bắt buộc > 0 chỉ áp khi là Phạt tiền. |
| R-737 | Nhãn "Tổng tiền phạt đã duyệt" in ra `{0}`. Khoá có placeholder nhưng số tiền render riêng trong `<strong>`. | Khoá thành nhãn thuần. |
| R-738 | Chủ dự án: cột Thao tác trống trên các dòng Đã huỷ (phiếu đã huỷ không còn thao tác nào), và không có chỗ xem lý do huỷ / người duyệt ngoài tooltip. | Nút **Xem chi tiết** trên mọi dòng mở `PenaltyDetailDialog` (người lập, người duyệt, lý do huỷ, kèm thời điểm); nút căn trái theo tiêu đề cột. `staff-penalty.spec` khẳng định dòng đã huỷ còn đúng 1 nút và dialog có lý do huỷ. |

Kiểm: `tsc -b` sạch, `oxlint` không cảnh báo. BE: Domain.Tests **580** (StaffPenalty **12**,
catalog quyền 88 subject), Application.Tests **671** (contract **11**). Migration `StaffPenalties`
chỉ tạo 2 bảng; DbMigrator cấp `staffPenalty.*` cho 3 role tĩnh. E2E trên build production
(:8080, API thật :5000): `staff-penalty-api` **4/4**, `staff-penalty` **1/1**, `staff` + `staff-day-off-api`
**4/4**. `role-permissions` và `role-permissions-abilities` đỏ ở bước "dentist chưa có quyền gì"
— lỗi dữ liệu local đã ghi ở mục R-725..R-727 (nhóm `dentist` đang có **370** grant, **0** grant
`staffPenalty`), không do thay đổi này. Retest level **2** (F-49, F-25).

## 2026-10-06 — Danh mục: không cho tạo trùng tên (R-739..R-741)

Từ bug list của tester (Danh mục > Dịch vụ, ưu tiên High). Bản gốc không quan sát được (không
được submit form trên production) — BlueDental chọn quy tắc mà import Excel đã dùng để khớp dòng:
cùng tên = bỏ khoảng trắng đầu/cuối và khoảng trắng thừa, không phân biệt hoa thường
(`ExcelCells.Key`, gói lại trong `CatalogNames`).

| # | Lỗi | Sửa |
|---|-----|-----|
| R-739 | Tạo được nhóm trùng tên: nhập "NHA KHOA TỔNG QUÁT" (đã có) → "Đã thêm nhóm", danh sách có 2 nhóm. | `TaxonomyAppService` từ chối tạo / đổi tên trùng một nhóm khác cùng danh mục (tab) cùng chi nhánh → `Catalogs:0030` "Tên nhóm đã tồn tại.". Chỉ kiểm khi đổi tên, nên dữ liệu cũ đã trùng vẫn sửa màu / ưu tiên được. Áp cho mọi tab dùng nhóm, kể cả Khớp cắn / Đường hoàn tất / Kiểu nhịp Labo. |
| R-740 | Tạo được 2 dịch vụ cùng tên trong một nhóm ("DUNG-TEST Dịch vụ 1", mã c00K2 và CpH8). | `CatalogEntryAppService` từ chối tạo / đổi tên / chuyển nhóm khi nhóm đích đã có mục cùng tên → `Catalogs:0031` "Tên dịch vụ đã tồn tại trong nhóm." (dịch vụ), `0032` "Tên đã tồn tại trong nhóm." (danh mục khác). Mục "Đã xoá" chỉ tính ở danh mục còn hiện và khôi phục được nó; ở danh mục khác mục đã xoá không chặn tên. Cùng tên ở nhóm khác vẫn được — import cũng khoá theo (nhóm, tên). |
| R-741 | (Security review của chính thay đổi này) Sửa một mục và đổi `taxonomyId` sang nhóm của **chi nhánh khác**: server chỉ kiểm chi nhánh của mục, không kiểm nhóm đích — mục chuyển được sang chi nhánh khác (lỗi có sẵn), và kiểm tra trùng tên mới còn cho biết một tên có tồn tại ở nhóm đó không. | Nhóm đích khác chi nhánh được trả lời y như nhóm không tồn tại (`Catalogs:0012`), trước mọi tra cứu tên. Spec `taxonomy-duplicate-names-api` khẳng định. |

Kèm theo: `Taxonomy` / `CatalogEntry` lưu tên đã trim (Create + Rename). Theo ghi chú "áp dụng cho
những bug tạo trùng", Loại vi phạm (Chế tài) cũng chặn trùng tên trong chi nhánh → `StaffPenalty:0008`.
FE không đổi: các dialog vốn giữ nguyên khi server từ chối, thông báo hiện qua toast chung.

Bẫy dữ liệu test: bản đầu của spec mới tạo nhóm rỗng ưu tiên 0 ở tab Loại thuốc → nhóm đó lên đầu, tab mở trên nó và 3 ca `taxonomy*` (cuộn bảng, thanh cuộn, "đang lưu") thấy bảng trống; spec khác còn thêm dịch vụ vào các nhóm rỗng ở đầu. Spec nay tạo nhóm ưu tiên 9999 và tự xoá nhóm rỗng của nó; các nhóm rác local đã đẩy xuống cuối / xoá.

Kiểm: Domain.Tests **582** (thêm 2 ca trim), Application.Tests **671**. E2E mới `taxonomy-duplicate-names-api` **2/2** (đúng hai
bước tái hiện của tester, cộng đổi tên / chuyển nhóm, khác tab / khác chi nhánh vẫn được). Bộ §17 trên
build production :8080 + `catalog-combo` + `staff-penalty*` + spec mới: **72/74** — 2 đỏ là hai ca có sẵn do nhóm
`dentist` local đang có grant (`taxonomy-import-api` "…gets 403…", `taxonomy-service-sync` "…may only
read services…"), như ghi ở R-725..R-727. Retest level **2** (F-02, F-32, F-49).

## 2026-10-06 — Không cho đặt lịch ngoài giờ làm của bác sĩ (R-742, F-10, QA dòng 3)

| # | Vấn đề | Xử lý |
|---|---|---|
| R-742 | QA dòng 3: đặt được lịch BS. Mai Anh Phương 21/10/2026 12:15 (giờ nghỉ trưa) và BS. Nguyễn Lan Chi 06/10/2026 19:00, không cảnh báo. BA: "Ngoài giờ làm việc khóa luôn, không cho book" — **chặn cứng, không có xác nhận/ghi đè**. | BE: domain service `DentistShiftChecker` (`Domain/Appointments`). Khung giờ = ca trong Lịch làm việc (`TimeKeepingRecord` của bác sĩ, theo chi nhánh + ngày giờ phòng khám UTC+7): ca sáng/chiều `PlannedStart–PlannedEnd`, trừ khoảng nghỉ (`LeaveStart–LeaveEnd`), ca chạm nhau thì gộp; **không có bản ghi → mặc định 08:00-12:00, 13:00-17:00**; đăng ký nghỉ cả ngày → không có khung. Lịch phải nằm trọn trong **một** khung, cùng ngày. Từ chối bằng `BlueDental:Appointment:0008` ("Không thể đặt lịch: giờ hẹn nằm ngoài ca làm của bác sĩ (08:00-12:00, 13:00-17:00).", dữ liệu `{Shifts}`) hoặc `:0009` (nghỉ cả ngày); HTTP 403 mặc định của ABP như các BusinessException khác, FE hiện message server qua toast chung, dialog giữ nguyên. `ClinicCalendar.ToLocal` thêm mới. Áp dụng ở `AppointmentAppService`: Create, CreateTemp (chỉ khi có bác sĩ — lịch tạm chưa gán bác sĩ không kiểm), Update (**chỉ khi đổi giờ hoặc đổi bác sĩ** — sửa ghi chú lịch cũ đặt trước khi có luật vẫn được), BookFollowUp. Hệ quả: Tiếp nhận (walk-in đặt lịch "bây giờ") cũng bị chặn ngoài ca — muốn nhận khách tối thì mở ca ở Lịch làm việc. FE không đổi (bản nháp hộp "Vẫn đặt lịch" đã bỏ theo BA). Test: Domain `DentistShiftCheckerTests` **13/13** (mặc định, 12:15, 19:00, biên 12:00/17:00, nghỉ cả ngày, nghỉ nửa buổi, ca đổi giờ + gộp, qua nửa đêm). e2e mới `appointment-working-hours.spec.ts` **3/3** (API: 12:15/19:00/16:45-17:15 bị từ chối kèm khung giờ trong message, không lưu gì, 09:00 lưu; PUT dời sang 19:00 bị từ chối và lịch giữ nguyên; `open-day` ca chiều 13:00-20:00 → 19:00 lưu, 20:00 từ chối "08:00-12:00, 13:00-20:00"; UI `/calendar/list`: 12:15 hiện toast lý do + dialog còn mở, đổi 09:00 lưu được, tìm thấy sau reload). Fixture mới `e2e/fixtures/workShift.ts` `openShiftCovering` — spec đặt lịch theo "bây giờ + N phút" mở ca bao giờ đó qua API Lịch làm việc thật (chỉ khi ngoài ca mặc định); dùng ở `receptionBoard.bookVisitToday`, `appointment-day-timeline` (ca "today"), `cskh-generated-tabs`; `reception-follow-up` chọn giờ ngẫu nhiên trong ca (từng ra 12:30). Retest mức 2 (F-10) + phụ thuộc (Tiếp nhận, CSKH, lịch hẹn bệnh nhân, labo) trên build production (`vite preview` :8093, host :5000, PostgreSQL thật, không chặn API): 15 spec (appointment*, reception*, cskh-generated-tabs, patient-appointment, doctor-day-off-pickers, labo-orders-actions) **47/55**. Sửa thêm do R-742 gây ra: `fixtures/auth.ts` `freeSlot` chọn giờ 07–18 (07/12/17/18 giờ bị từ chối) → nay chỉ 08–11, 13–16; chạy lại `appointment-history` + `patient-appointment` **11/11** (`history:349` đỏ 1 lần khi chạy song song vì đếm lịch sử của tuần dùng chung, chạy riêng xanh). 6 đỏ còn lại **không do R-742**: `appointment.spec` 2 (date-mask, đỏ sẵn — xem F-10), `reception.spec` 2 (chờ endpoint visits cũ, đỏ sẵn), `appointment-day-timeline` :100 (tên hàng in cả họ "… E2E tlon…") và :147 (kéo không cuộn, scrollLeft 0) — FE `src` không đổi so với HEAD, cả hai đã đặt lịch 09:00 thành công trước khi đỏ ở phần giao diện. Lint: `cskh-generated-tabs.spec.ts:49` `no-useless-assignment` và tsc `reception-follow-up.spec.ts:248` `ApiResult` có sẵn ở HEAD. Chưa commit. |

## 2026-10-06 — Form sửa nhân viên tự điền sẵn ô Mật khẩu (R-743, Nhân sự, QA dòng 5)

| # | Vấn đề | Xử lý |
|---|---|---|
| R-743 | QA dòng 5: đăng nhập admin (trình duyệt đã lưu mật khẩu), Vận hành > Nhân sự, sửa nhân viên "0410 Kế toán" → ô Mật khẩu có sẵn 7 ký tự (trùng độ dài mật khẩu admin). Form không tự đặt giá trị: ô Email đứng ngay trước ô password nên Chrome coi đây là form đăng nhập và tự điền mật khẩu đã lưu. Validator "Nhập lại mật khẩu" bỏ qua khi ô đó trống, nên bấm Lưu là **âm thầm đổi mật khẩu nhân viên** thành mật khẩu admin. | `StaffEditorModal.tsx`: cả hai ô `Input.Password` đặt `autoComplete="new-password"`; mở chế độ sửa thì `setFieldsValue` reset `password`/`confirmPassword` về ""; khi sửa, ô Mật khẩu có giá trị mà ô Nhập lại trống thì báo "Vui lòng nhập lại mật khẩu" (key có sẵn `Staff:ConfirmPasswordRequired`) và chặn Lưu, nên lỡ bị trình duyệt điền vẫn không đổi mật khẩu được. Để trống khi sửa = giữ mật khẩu cũ (BE vẫn nhận `password: undefined` như trước). `e2e/staff.spec.ts` (bước sửa) thêm: hai ô trống, có `autocomplete="new-password"`, chỉ gõ Mật khẩu rồi Lưu → hiện lỗi và dialog vẫn mở; xoá ô đi thì Lưu được. Retest mức 2 trên build production (`vite preview` :8094, host :5000, PostgreSQL thật, không chặn API): `staff.spec` **1/1**. tsc sạch. Chưa commit. |


## 2026-10-06 — Đơn thuốc không cảnh báo thuốc bệnh nhân đã khai dị ứng (R-744, F-23, QA dòng 6)

| # | Vấn đề | Xử lý |
|---|---|---|
| R-744 | QA dòng 6 (High): bệnh nhân DH260039 có tiểu sử "Dị ứng thuốc kháng sinh"; Kế hoạch điều trị > DT01 > Tạo Đơn Thuốc, chọn Klamentin 625mg (kháng sinh), Lưu → lưu thành công, không cảnh báo. Mong đợi: cảnh báo khi chọn thuốc thuộc nhóm khách đã khai dị ứng. Danh mục **không có liên kết** nào giữa mục Lịch sử bệnh và nhóm Loại thuốc (Tiểu sử bệnh = `Patient.DiseaseHistoryEntryIds`, chỉ là id các mục đã tích). | **FE-only, không đổi schema, không đụng màn Danh mục (§17).** `treatment-management/utils/allergyConflicts.ts` `findAllergyConflicts`: mục tiểu sử là *dị ứng* khi tên hoặc nhóm của nó chứa "dị ứng"; chủ thể = tên bỏ "dị ứng"/"thuốc"/"nhóm"/"với"/"loại"/"các" (bỏ dấu, "đ"→"d"), vd "Dị ứng thuốc kháng sinh" → "khang sinh"; thuốc bị cảnh báo khi chủ thể nhóm thuốc ("Nhóm Kháng Sinh" → "khang sinh") chứa/được chứa trong chủ thể dị ứng, hoặc tên thuốc chứa chủ thể dị ứng — so khớp **nguyên từ** (thuốc tê "te" không dính "tetracyclin"). Cố ý nghiêng về cảnh báo: "Dị ứng kháng sinh nhóm Penicillin" cảnh báo cả nhóm Kháng Sinh. Hook `usePrescriptionAllergyConflicts` (dòng đã chọn × mục tiểu sử đã tích); `PrescriptionAllergyAlert` (AntD `Alert` warning trên bảng thuốc, mỗi thuốc một dòng: "Klamentin 625mg (thuộc Nhóm Kháng Sinh) — bệnh nhân đã khai: Dị ứng thuốc kháng sinh"), hiện **ngay khi chọn thuốc**; bấm Lưu khi còn xung đột → `ConfirmDialog` "Cảnh báo dị ứng … Bạn vẫn muốn lưu đơn thuốc?" Không / **Vẫn lưu** — cảnh báo, không chặn cứng (bác sĩ quyết). Áp dụng cho cả hai lối vào (`PrescriptionDialog` dùng chung: tab Đơn thuốc và trang chi tiết kế hoạch). Key i18n mới `Treatment:Rx:Allergy*` (vi/en, Domain.Shared — host phải build lại). BE không đổi. e2e mới `prescription-allergy.spec.ts` **2/2** (tạo qua API thật: mục "Dị ứng thuốc kháng sinh <built-in function id>", nhóm "Nhóm Kháng Sinh <built-in function id>" + "Nhóm Giảm Đau <built-in function id>", bệnh nhân có tích mục dị ứng; chọn kháng sinh → cảnh báo nêu thuốc/nhóm/dị ứng; Lưu → hỏi, "Không" không gửi POST và dialog còn mở, "Vẫn lưu" POST 200 và dòng còn sau reload; thuốc giảm đau → không cảnh báo, lưu thẳng). Retest mức 2 trên build production (`vite preview` :8095, host :5000 build lại, PostgreSQL thật, không chặn API): `prescription-allergy` + `prescription` **7/7**. tsc sạch; eslint của feature chỉ còn lỗi có sẵn (`react-hooks/exhaustive-deps` không có định nghĩa ở PlanPayments/Refunds/ServicesTab). Giới hạn: khớp theo **tên** — mục dị ứng đặt tên không nói nhóm thuốc (vd "Dị ứng" trống) thì không cảnh báo; muốn chính xác tuyệt đối cần thêm trường liên kết nhóm thuốc vào mục Lịch sử bệnh (đổi màn Danh mục — chờ BA). Chưa commit. |

## 2026-10-06 — Tab Sau điều trị trống dù trong tháng có khách hoàn thành điều trị (R-745, CSKH, QA dòng 7)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-745 | QA dòng 7 (High): hoàn thành điều trị cho DH260039 ngày 06/10/2026, CSKH > Sau điều trị, Tháng 10/2026 → danh sách trống (0 khách). Nguyên nhân: phiếu Sau điều trị chỉ được mở bởi **Tiếp tục công đoạn** (R-699, yêu cầu 2026-10-05); cả hai lối **Hoàn thành** (hoàn thành công đoạn ở lịch sử công đoạn, và menu trạng thái dòng dịch vụ trên trang chi tiết kế hoạch → "Hoàn thành") không tạo phiếu — dịch vụ một lần khám thì không bao giờ qua "Tiếp tục". | BE: `AfterTreatmentCareRecorder.RecordVisitAsync` thêm overload (bệnh nhân, chi nhánh, người điều trị, danh sách công đoạn) — một phiếu/bệnh nhân/chi nhánh/ngày phòng khám (UTC+7), lần sau chỉ gắn thêm công đoạn. `TreatmentStageAppService.CompleteAsync` gọi recorder khi công đoạn không phải bảo hành; `PatientTreatmentAppService.CompleteServiceAsync` gọi recorder với các công đoạn còn hiệu lực, không bảo hành của dòng (người điều trị = bác sĩ dòng ?? bác sĩ phiếu). `CareRecord.AfterTreatment` nhận danh sách công đoạn. FE không đổi. Domain tests AfterTreatmentCare **14/14**. `e2e/cskh-after-treatment.spec.ts` thêm 2 test (hoàn thành công đoạn → 1 phiếu hôm nay có công đoạn, ngày chăm sóc rỗng; hoàn thành dòng dịch vụ qua UI → toast "Đã hoàn thành dịch vụ", 1 phiếu, hoàn thành thêm công đoạn cùng ngày vẫn 1 phiếu, dòng hiện trên /cskh-grouping với Ngày điều trị = hôm nay) + sửa race tìm kiếm ở test cũ (chờ response `care-records?…filter=`). Retest mức 2 trên build production (`vite preview` :8096, host :5000, PostgreSQL thật, không chặn API): `cskh-after-treatment` **3/3** (lặp 2 lần 6/6). Mức 3 phụ thuộc: `treatment-plan-detail` + `treatment-stage-chain` 7 xanh / 8 đỏ — 7 đỏ stage-chain dừng ở tiền điều kiện fixture "open slip in branch 1" (không tìm được phiếu mở + dòng có `warrantyDays > 0` trong dữ liệu, trả `null` trước mọi request ghi), 1 đỏ là kéo-thả đổi thứ tự dòng (:565) — đều không đi qua code hoàn thành. Giới hạn: hoàn thành trước bản sửa không được tạo bù; huỷ hoàn thành không xoá phiếu. Prod phải deploy lại BE. Chưa commit. |

## 2026-10-06 — Phân quyền: đổi vai trò làm mất thay đổi chưa lưu, không cảnh báo (R-746, F-40, QA dòng 9)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-746 | QA dòng 9 (Medium): Cài đặt > Phân quyền, chọn vai trò DUNG-TEST Vai tro, tích nhóm Báo cáo (chưa Lưu), chọn vai trò dentist rồi quay lại → quyền Báo cáo đã tích biến mất, không hỏi. Nguyên nhân: `RolePermissionEditor` mount theo `key={selectedRole}`, ô đã tích chỉ nằm trong state cục bộ `localGranted`, đổi vai trò là unmount và mất; "có thay đổi" lại chỉ là `localGranted !== null` nên tích rồi bỏ tích vẫn tính là thay đổi. | FE-only. `PermissionsTab.tsx`: editor tính `hasChanges` = có lá nào khác với quyền của vai trò trên server và báo lên cha qua `onDirtyChange`; nút "Lưu thay đổi" chỉ bật khi thật sự khác. Cha giữ `isDirty`: bấm vai trò khác khi còn thay đổi → `UnsavedPermsDialog` "Thay đổi chưa được lưu — Vai trò {0} có thay đổi phân quyền chưa lưu…" **Ở lại** (giữ nguyên ô đã tích) / **Bỏ thay đổi** (chuyển vai trò, không gửi gì). Hook dùng chung mới `src/hooks/useUnsavedChangesGuard.ts` (`useBlocker` + `beforeunload`): rời tab Phân quyền sang tab cài đặt khác / route khác cũng hỏi cùng hộp thoại; tải lại / đóng tab dùng hộp thoại của trình duyệt. Key i18n mới `Organization:UnsavedPerms*` (vi/en, Domain.Shared — host phải build lại). e2e mới `role-permissions-unsaved.spec.ts` **3/3** (đổi vai trò → hỏi, Ở lại giữ ô, Bỏ thay đổi chuyển vai trò và server không đổi; rời sang "Thông tin cá nhân" → hỏi, Ở lại giữ URL, Bỏ thay đổi sang `tab=info`; tích rồi bỏ tích → Lưu bị tắt, không hỏi; Lưu (PUT 200) rồi đổi vai trò → không hỏi, lưu rồi hoàn tác để trả vai trò như cũ). Retest mức 2 trên build production (`vite preview` :8081, host :5000 build lại, PostgreSQL thật, không chặn API): `role-permissions-unsaved` + `role-permissions` + `role-permissions-abilities` + `patient-permission-gates` **6/6**. tsc + eslint sạch. Chưa commit. |

## 2026-10-06 — Phân quyền: quyền Lịch hẹn nằm ở 2 nhóm, bộ đếm cộng trùng (R-747, F-40, QA dòng 10)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-747 | QA dòng 10: Cài đặt > Phân quyền, vai trò DUNG-TEST Vai tro, tích Khách hàng > Xem và nhóm Lịch hẹn → Điều trị > Lịch hẹn cũng tự tích 5/5; bộ đếm 14/378 trong khi chỉ có 9 quyền khác nhau; bỏ tích ở Điều trị > Lịch hẹn thì Lịch hẹn khách hàng cũng mất. Nguyên nhân: `PermissionTreeBuilder` khai báo 5 lá `appointment.*` hai lần (nhóm `appointment-in-treatment` dưới Điều trị và `appointment` dưới Lịch hẹn) — cùng một quyền ABP, FE đếm theo lá nên cộng 2 lần. | Bỏ bản sao dưới Điều trị: mỗi quyền nằm ở **một** nhóm, `appointment.*` ở Lịch hẹn > Lịch hẹn khách hàng (cạnh Lịch làm việc, đúng trang `/calendar`; tab Lịch hẹn trong hồ sơ bệnh nhân vẫn dùng chính quyền này). Tổng số quyền 378 → **373**. FE (`PermissionsTab`): bộ đếm tổng, đếm nhóm, badge vai trò và danh sách gửi lên khi Lưu đều lấy id lá **không trùng** (`uniqueLeafIds`) — nếu sau này cây lại có lá lặp thì vẫn không cộng trùng. Không đổi quyền đã cấp (cùng tên quyền ABP), không migration. e2e mới `role-permissions-tree.spec.ts` **1/1** (cây từ API không có lá trùng, bộ đếm = số lá, tìm `appointment.read` ra đúng 1 lá dưới "Lịch hẹn khách hàng", không còn dưới Điều trị). Retest mức 2 trên build production (`vite preview` :8091, host :5000 build lại, PostgreSQL thật, không chặn API): `role-permissions-tree` + `role-permissions-unsaved` **4/4**; `role-permissions` 0/1 — đỏ có sẵn, không do thay đổi này: vai trò `dentist` local hiện có 152 quyền (CSKH, Vận hành…), test giả định dentist chưa có gì nên thấy 3 nhóm menu thay vì 1. tsc sạch. Chưa commit. |
| R-748 | Sau R-747, owner so với staging: gõ "Lịch hẹn" vào ô "Tìm quyền..." trên staging ra các nhóm Lịch hẹn (Điều trị > Lịch hẹn, Lịch hẹn > Lịch hẹn khách hàng); local không ra gì. Nguyên nhân: `matchesSearch` so chuỗi tìm với `node.label` thô — nhãn nhóm là key i18n (`BE:Perm:Appointments`), nên chỉ tìm được theo id hoặc lá có nhãn tiếng Việt thật; gõ "BE:Perm" lại khớp mọi nhóm. | `matchesSearch` so với **nhãn đã dịch** `t(node.label)` (và id), chuỗi tìm được `trim()`. Như staging: nhóm khớp tên thì hiện và tự mở, nhóm con/lá bên trong vẫn lọc theo cùng quy tắc. Chỉ FE, không đổi API. e2e `role-permissions-tree.spec.ts` thêm ca "the search matches group names as displayed" ("Lịch hẹn" → đúng 1 nhóm "Lịch hẹn" + 1 "Lịch hẹn khách hàng"; "  danh mục  " có khoảng trắng vẫn ra nhóm Danh mục; "BE:Perm" → 0 nhóm) — ca này đỏ trên code cũ. Retest mức 2 trên build production (`vite preview` :8091, host :5000, PostgreSQL thật, không chặn API): `role-permissions-tree` + `role-permissions-unsaved` **5/5**. tsc sạch. Chưa commit. |
| R-749 | Bug list 2026-10-06 #11 — Danh mục > Dịch vụ: bấm Xoá một dịch vụ đã dùng trong kế hoạch điều trị (DT01) → "không xoá, không có thông báo nào"; kỳ vọng "Dịch vụ đang được sử dụng, không thể xóa". Nguyên nhân: `CatalogEntryAppService.DeleteAsync` không kiểm tra dịch vụ có đang được dùng không — server xoá mềm luôn, không có lỗi nào để giao diện báo. | BE: `EnsureServiceNotInUseAsync` — dịch vụ (`care_service`) còn nằm trong dòng kế hoạch điều trị (`TreatmentPlan.Services`, kể cả phiếu/dòng đã xoá mềm) hoặc dòng tư vấn (`PatientAdvise`) thì ném `BusinessException` mã mới `BlueDental:Catalogs:0033` ("Dịch vụ đang được sử dụng, không thể xóa" / en "This service is in use and cannot be deleted"). Chặn ở **cả hai cửa** xoá: nút Xoá (`DELETE`) và trạng thái "Đã xoá" trong dialog (`PUT isDeleted=true`, chỉ khi đang sống → xoá). Thành phần của combo không bị chặn (combo vẫn giữ được thành phần đã xoá, như F-48). FE không đổi: toast lỗi chung của MutationCache hiện đúng câu server trả, dialog xác nhận đóng, dòng vẫn còn nút Xoá. e2e mới `taxonomy-service-in-use.spec.ts` **2/2** — ca combo: combo chọn vào kế hoạch lưu một dòng mang id của chính combo nên bị chặn (0033); combo chưa ai chọn vẫn xoá được dù dịch vụ thành phần đang dùng, và không đụng tới thành phần; dịch vụ chỉ nằm trong combo (chưa vào kế hoạch/tư vấn) vẫn xoá được, theo F-48 combo giữ thành phần đã xoá. Ca bug 11: (nhóm + 2 dịch vụ tạo qua API, 1 dịch vụ gắn vào phiếu điều trị mở; nút Xoá → DELETE ≥400 + câu thông báo, reload vẫn sống; PUT isDeleted → mã 0033, vẫn sống; dịch vụ không ai dùng vẫn xoá được). Retest mức 2 trên build production (`vite preview` :8091 từ thư mục scratchpad vì `dist-preview` :8080 của phiên khác bị build đè, host :5000, PostgreSQL thật, không chặn API): taxonomy* + payment-qr + branch-* **67/68**; đỏ duy nhất `taxonomy-import-api` "account without the tab's create right gets 403" — có sẵn, cùng nguyên nhân với R-747: vai trò `dentist` local đã có ~151 quyền, test giả định không có gì. Hạ tầng: DB local đang ở migration `20261006035206_ServiceCombo` chưa commit của nhánh F-48 (cột `UnitAmount`, thiếu `IsCombo`) nên mọi truy vấn danh mục 500 sau merge — đã đưa về `20261006020719_CatalogCombos` của main bằng tay (đổi cột → `UnitPrice`, thêm `IsCombo` = true cho 87 mục đã có thành phần, sửa `__EFMigrationsHistory`) rồi chạy DbMigrator (`StaffPenalties`). Chưa commit. |

## 2026-10-06 — Bug list: VAT vào phiếu thu / HĐĐT (mục 15), CSKH (mục 12, 13) — R-750..R-754

| # | Lỗi | Sửa |
|---|-----|-----|
| R-750 | (mục 15) Dịch vụ 1.000.000, giảm 10 %, thuế 8 %: Danh mục báo "Thực thu gồm VAT 972.000" nhưng kế hoạch, phiếu thu, HĐĐT đều 900.000; HĐĐT luôn KCT. Thuế chỉ sống trong dialog Danh mục — mọi chỗ sau chỉ chép một đơn giá chưa VAT. | `TreatmentService.TaxRate` (snapshot "% thuế" từ Danh mục lúc dòng vào phiếu — tư vấn, thêm dòng, chuyển đổi). `TreatmentPlan.TaxAmountOf / PayableAmountOf / TaxAmount / PayableAmount`: thuế = thành tiền sau mọi giảm × %. Còn nợ, tối đa phiếu thu, `PaymentSummary.totalPrice`, công nợ báo cáo dùng số gồm VAT; doanh thu vẫn chưa VAT. HĐĐT: phiếu điều trị mỗi mức thuế một dòng (giá trước thuế + thuế), phiếu thu tách thuế ra khỏi số đã thu (`LineFromGross`), so trần trên số gồm VAT; nhiều mức thuế trong một HĐ → `EInvoicing:0016` rõ ràng. Dialog HĐ mở mỗi dòng ở "% thuế" của dịch vụ (dòng KCT vẫn "Chưa xuất" như bản gốc), chọn 0/5/8/10/KCT theo từng dòng. Migration `TreatmentServiceTaxRate`: backfill thuế cho dòng của phiếu **chưa có phiếu thu**; phiếu đã thu giữ nguyên. Xem `docs/clone/unknowns.md` (VAT). |
| R-751 | (mục 15, chủ dự án) Modal "Tạo phiếu thanh toán": số in đậm của dịch vụ là số gồm VAT → người dùng phải tự suy ra đơn giá. | Số in đậm = giá trước thuế (`chargedAmount`), dưới là "Thuế VAT x %: y đ"; khối "Tổng tiền theo kế hoạch" mới cộng: Thuế VAT, Tổng thanh toán (gồm VAT). Chip Còn nợ giữ số gồm VAT. |
| R-752 | (mục 13) CSKH › Nhắc lịch hẹn: đổi sang Đã liên hệ + ghi chú → lưu được nhưng "Nhân viên chăm sóc" vẫn "—". | Người đổi trạng thái thành `CareStaffId`, thời điểm vào `CareRecord.ContactedAt` (migration `CareRecordContactedAt`); đổi về Chưa liên hệ thì xoá thời điểm, giữ tên người chạm gần nhất. Cột hiện tên + giờ liên hệ. |
| R-753 | (mục 12) CSKH › Nhắc lịch hẹn, Tháng 10/2026: liệt kê cả lịch Hoàn thành / Đang khám / Đã đến và lịch đã qua (local: 198 dòng, 145 dòng đã qua, 40 dòng đã đến/đang khám/xong). | Chỉ lịch chưa quá giờ hẹn 5 phút (`MissedAfter`) và còn Đã đặt / Đã xác nhận — phần bù đúng của "Đặt lịch không đến" (local sau sửa: 54 dòng, 0 dòng đã qua). Đổi quy tắc chủ dự án 2026-10-05 — `docs/clone/pages/cskh-grouping.md`. |
| R-754 | (mục 12) "Chưa liên hệ" 8 > "Tổng khách" 5 (local: 194 > 134): Tổng khách đếm bệnh nhân khác nhau (Lịch tạm còn gộp thành một), các ô kia đếm dòng. | `CareStatsDto.TotalRecords`; hai tab theo lịch hẹn hiện "Tổng lịch hẹn" = Đã liên hệ + Chưa liên hệ. Tab khác giữ "Tổng khách". |

Kiểm: Domain.Tests **600** (VAT 14, CSKH 4 mới), Application.Tests **671**, EF.Tests **64**; `tsc` sạch.
E2E mới: `vat-payment-einvoice-api` 1/1, `cskh-contact-staff-api` 1/1, `cskh-reminder-api` 1/1; CSKH cũ
7/7 (+ `cskh.spec:168` đỏ ở dialog **tạo** phiếu — "Chọn khách hàng" không thấy, không đụng tới).
Hồi quy tiền (build production): 70/87 — 17 đỏ lặp lại ổn định, **chưa đối chứng** với commit trước:
`operations-reports` ×8 (giao diện báo cáo vận hành), `report.spec` ×3 (`:294` đỏ có sẵn — cột Excel),
`consulting-plan` ×3, `consulting-delete-and-picker` ×1, `treatment-plan-detail:565` (kéo thả),
`payment-permission-buttons:198` (đỏ ở bước Esc đóng "Chi tiết phiếu", không phải lưu phiếu thu).
Dữ liệu local: spec VAT ghi một dòng + phiếu thu 972.000 vào phiếu mở đầu tiên (DT04 của DH260016) —
cần sửa spec tự tạo phiếu riêng. Retest level **3** (thanh toán, HĐĐT, báo cáo, CSKH).

## 2026-10-06 — Bug list mục 17: lịch quá giờ không đến không tự chuyển Trễ hẹn (R-755)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-755 | (mục 17, Medium) Lịch 05/10/2026 09:30 của DH260033, khách không đến → hôm sau vẫn "Đã đặt lịch"; kỳ vọng tự chuyển Trễ hẹn. Nguyên nhân: không có gì chuyển trạng thái theo giờ — `NoShow` (Trễ hẹn) chỉ đặt tay qua dialog / `no-show`. Local trước khi sửa: 477 lịch đã qua giờ kết thúc vẫn Đã hẹn (257) / Đã xác nhận (220). | `MissedAppointmentWorker` (mỗi phút) → `MissedAppointmentMarker`: lịch Đã hẹn / Đã xác nhận có `slot_end <= now` → `MarkNoShow()`, mỗi lượt tối đa 200 lịch, mỗi lịch ghi một dòng lịch sử `StatusChanged` nguồn `System` (không người thao tác). Quy tắc trong domain: `Appointment.IsMissedAt(now)`. `CheckIn()` nhận thêm `NoShow` — khách Trễ hẹn đến muộn vẫn tiếp đón được; thẻ Tiếp đón bỏ khoá `isNoShow` (chỉ lịch huỷ mới không bấm được bước). Từ giờ hẹn tới giờ kết thúc Tiếp đón vẫn hiện "trễ" theo đồng hồ như cũ. Mốc "qua giờ kết thúc" là giả định — ghi `unknowns.md`. |

Kiểm: Domain.Tests **616** (3 mới: `IsMissedAt` ×2, check-in từ Trễ hẹn). E2E mới `appointment-missed-api` **1/1**
(đăng nhập thật, host thật, PostgreSQL thật: chờ tới khi không còn lịch Đã hẹn/Đã xác nhận nào quá giờ kết
thúc > 2 phút, lịch sử có dòng nguồn Hệ thống 1/2 → 7, check-in lịch Trễ hẹn → 3, đọc lại vẫn 3). Local sau
sửa: 0 lịch quá giờ còn 1/2, DH260033 (05/10 16:12 trên dữ liệu local) → Trễ hẹn có dòng lịch sử Hệ thống.

Hồi quy mức 3 (lịch hẹn, tiếp đón, hồ sơ › lịch hẹn, CSKH) trên build production (`vite preview` :8092 →
host :5100 build riêng vì host :5000 đang thuộc phiên khác): 66 test, 12 đỏ lần đầu. Đối chứng với HEAD
`291f8317` (worktree riêng, host :5200, preview :8093, cùng DB): **8 đỏ có sẵn** — `appointment.spec:85/:101`
(dialog đặt lịch không đóng), `cskh.spec:168` (đã ghi ở R-750), `reception-temporary:132`, `reception.spec:24/:57`
(chờ `/api/v1/app/visits`), `appointment-day-timeline:147` (kéo cuộn ngang, đỏ cả hai bản); `reception-doctor-roles:47`
và `appointment-day-timeline:100`, `patient-appointment:126`, `reception-own-doctor:70` chập chờn, chạy lại xanh
cả hai bản. **Do thay đổi này**: `cskh-generated-tabs:218` — lấy "lịch quá giờ chưa đến" chỉ theo trạng thái 1/2,
nay lịch đó đã là 7 → thêm `statuses=7`; và tra phiếu CSKH thiếu `maxResultCount` (bệnh nhân E2E có 18 phiếu
trong ngày, mặc định 10) → thêm `maxResultCount=1000`. Sau sửa **3/3**.

Lưu ý triển khai: lần chạy đầu trên prod sẽ chuyển toàn bộ lịch cũ quá giờ chưa đến sang Trễ hẹn (200/phút),
mỗi lịch một dòng lịch sử; số "Đã hẹn"/"Trễ hẹn" của báo cáo các kỳ cũ đổi theo. Đặt lại "Đã hẹn" cho một lịch
đã qua mà không dời giờ thì worker sẽ chuyển lại Trễ hẹn trong vòng một phút.
Dữ liệu local: e2e đã check-in 2 lịch Trễ hẹn cũ (thành Đã đến). Retest level **3**.

## 2026-10-06 — Cập nhật lịch hẹn: ô "Chọn bệnh nhân" trống với bệnh nhân cũ (R-766, Lịch hẹn)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-766 | Owner: sửa lịch hẹn của bệnh nhân A, mở lại "Cập nhật lịch hẹn" → ô Chọn bệnh nhân hiện placeholder, không tự chọn A. Nguyên nhân: `usePatientOptions()` chỉ tải **30 bệnh nhân mới nhất** (`maxResultCount: 30`) và dialog lịch hẹn không gửi từ khoá lên server — `SearchSelect` chỉ lọc trong 30 dòng đó. Bệnh nhân ngoài 30 dòng: id có trong form nhưng không có option → ô trống; gõ tìm cũng không ra. Cùng lỗi khi mở "Tạo lịch hẹn" từ hồ sơ bệnh nhân cũ (ô khoá bệnh nhân trống). | FE-only. `usePatientOptions.ts` thêm `usePatientOption(id, enabled)` (GET `/v1/app/patients/{id}`), chỉ gọi khi id đang chọn không nằm trong trang đã tải. `AppointmentEditorModal`: ghim bệnh nhân đang chọn lên đầu danh sách; từ khoá gõ trong ô được debounce 300 ms và tìm **trên server** (tên/mã/SĐT), reset khi đóng ô / đóng dialog. `SearchSelect` thêm prop `filterLocally` (mặc định `true`, các nơi khác không đổi) — ô bệnh nhân lịch hẹn đặt `false` để không lọc lại theo nhãn (nhãn không có SĐT, server khớp không dấu). e2e mới trong `patient-appointment.spec.ts` "an older patient, past the picker's first page, still shows when the booking is reopened" (bệnh nhân ở trang cuối danh sách → ô Tạo lịch hẹn hiện đúng tên, lưu, mở Cập nhật → vẫn hiện đúng tên). Retest mức 2 trên dev server :5173, host :5000, PostgreSQL thật, không chặn API: `patient-appointment` + `appointment-history` **13/13**; `appointment.spec` 2 đỏ có sẵn — `date.fill()` không ăn vào DayPicker chế độ mask nên giờ hẹn rơi vào quá khứ, nút Lưu tắt (ô bệnh nhân vẫn chọn được, xem ảnh lỗi). tsc sạch. Chưa commit. |

## 2026-10-06 — Huỷ lịch không cần lý do; CSKH thiếu Lịch hẹn hủy và Complain (R-756..R-758, R-760..R-761, R-764, Lịch hẹn + CSKH, bug list #16)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-756 | Bug list #16: mở lịch 21/10/2026 12:15 của DH260040, Trạng thái → Đã huỷ, Lưu → lưu luôn, không hỏi lý do. Kỳ vọng: bắt buộc nhập lý do huỷ. | Domain: `Appointment.Cancel(reason, note)` từ chối ghi chú trống (`BlueDental:Appointment:0004`, có sẵn), lưu bản `trim`; `ChangeStatus(…, cancellationNote)` chuyển tiếp. API: `UpdateAppointmentDto.CancellationNote` [500], `CancelAppointmentDto.Note` [500], `AppointmentDto` thêm `CancellationReason`/`CancellationNote`. FE: `AppointmentStatusField` — chọn Đã huỷ hiện ô "Lý do hủy *" (TextArea, 500 ký tự); schema `buildSchema(storedStatus)` báo `Common:CancelReasonRequired` khi đổi **sang** Đã huỷ mà ô trống/khoảng trắng → Lưu tắt; lịch đã huỷ mở lại thì ô hiện lý do cũ, chỉ đọc. Dialog huỷ ở Tiếp nhận vốn đã bắt lý do — không đổi. Domain tests 598/598 (thêm `Cancel_Should_Require_A_Reason`). |
| R-757 | CSKH không có danh sách chăm sóc lịch hẹn huỷ (checklist 2.7). | `CareType.CancelledAppointment = 9` (short, không migration). `CareAppointmentRules`: tab theo lịch hẹn, lọc `Status = Cancelled` và **`CancelledAt` trong khoảng** (không theo giờ hẹn); `SubjectOf` = "Lịch hẹn hủy". `CareRecordDto` thêm `AppointmentCancelledAt`, `AppointmentCancelNote`; sắp theo ngày mới nhất. FE tab `cancelled-appointment` (mô hình Đã liên hệ/Chưa liên hệ, không Tạo mới), cột Ngày hủy + Lý do hủy; xuất Excel `cskh-lich-hen-huy`. |
| R-758 | CSKH không có mục Complain (checklist 2.6: ghi nhận complain và quá trình xử lý của nhân viên phụ trách). | `CareType.Complaint = 10`. FE tab `complaint`: Tạo mới (dialog: Khách hàng*, Ngày ghi nhận, Nhân viên phụ trách → `careStaffId`, Nội dung complain* — Lưu tắt khi trống; bỏ nút +3/6/9 tháng, tách thành `CareQuickMonths`), cột Nhân viên CSKH, kết quả xử lý qua hộp thoại Thành công/Thất bại; xuất Excel `cskh-complain`. Key i18n mới `CSKH:Type:CancelledAppointment/Complaint`, `CSKH:ReceivedAt`, `CSKH:ResponsibleStaff`, `CSKH:Col:CancelledAt/CancelReason/ReceivedAt/HandlingResult/ComplaintContent`, `Appointment:CancelReason` (vi/en, Domain.Shared — host phải build lại). Giả định chưa chốt: `docs/clone/unknowns.md`. e2e: `cskh-generated-tabs.spec.ts` describe mới "Lịch hẹn hủy, Complain" **2/2** (huỷ không lý do/lý do trắng → 0004, tab trống; lý do có khoảng trắng → 200, lưu đã trim, dòng hiện trên bảng hôm nay với Ngày hủy + Lý do hủy, đánh Đã liên hệ; bảng ngày của giờ hẹn vẫn trống; Complain: dialog không có +3 tháng, Lưu tắt tới khi nhập nội dung, chọn nhân viên, POST 200, sau reload còn nội dung + nhân viên, lưu kết quả Thành công còn sau reload); `patient-appointment.spec.ts` ca Trạng thái thêm ô Lý do hủy (trống/khoảng trắng → Lưu tắt, nhập → lưu; reload → hiện lý do, chỉ đọc; về Đã hẹn → ô ẩn); `appointment-day-timeline:108` và `cskh-generated-tabs:212` gửi kèm `note`. Retest mức 3 trên build production (`vite preview` :8080, host :5000 build lại, PostgreSQL thật, không chặn API): `cskh-generated-tabs` + `cskh` + `patient-appointment` + `appointment-day-timeline` + `reception-follow-up` **32/35**; `cskh:168` đỏ 1 lần, chạy lại xanh (flaky); `appointment-day-timeline` :100 (tên hàng in cả họ) và :147 (kéo không cuộn) đỏ sẵn — đã ghi ở R-742, code timeline không đổi. BE Application tests CustomerCare|Appointment 65/65. tsc sạch. Chưa commit. |
| R-760 | Owner, dialog "Tạo công việc mới" (Complain): các ô chọn Khách hàng / Bác sĩ tiếp nhận / Nhân viên phụ trách có khoảng trống bên trái nhãn, trông như mất icon kính lúp. Nguyên nhân: `cskh.css` ẩn kính lúp của `SearchSelect` trong mọi dialog CSKH (bản gốc không vẽ, từ 2026-08-27), nhưng luật toàn cục `.floating-field:has(.ss-icon--search)` vẫn đẩy nhãn sang phải 34px để chừa chỗ cho icon. Áp dụng cho mọi dialog CSKH dùng `MessageField`, không riêng Complain. | `cskh.css`: `.cskh-message-field:has(.ss-trigger) { --ff-prefix-offset: 12px; }` — nhãn ô chọn thẳng hàng với các ô khác. Giữ ẩn kính lúp theo bản gốc. Retest mức 1 trên build production (preview :8097): đo vị trí nhãn của cả 6 ô trong dialog Complain đều cách mép 14px; ảnh chụp khớp. Chưa commit. |
| R-761 | Kiểm thử sau R-756..R-758, R-760 (bản build production, cổng 8080, API thật, PostgreSQL thật). | BE: Domain 598/598, Application 671/671, HttpApi.Host 24/24; `tsc` sạch. E2E `cskh*`, `appointment*`, `patient-appointment`, `reception*`: 59/66 xanh, gồm cả kiểm tra file Excel của tab Lịch hẹn hủy và Complain. 7 đỏ không do thay đổi này: `appointment-day-timeline` :100/:147 (đỏ từ trước); `appointment-history:210` (giờ `freeSlot` trùng lịch của lần chạy trước, "Khung giờ này đã có lịch."); `appointment.spec` :85/:101 (`fill` cả ngày vào ô ngày gõ từng phần, ô giữ ngày hôm nay); `reception.spec` :24/:57 (chờ GET `/api/v1/app/visits`, Tiếp nhận đọc `/appointments` từ `9eb67079`). Chưa chạy lại 7 test đỏ trên HEAD sạch. |
| R-764 | Owner "sửa luôn đi": sửa 7 e2e đỏ của R-761 (đều do spec lệch, không phải lỗi sản phẩm). | (1) `appointment-day-timeline:100`: dòng bác sĩ hiện **tên đầy đủ** (`StaffDto.FullName` = Tên + Họ) → kỳ vọng `working.fullName`. (2) `appointment-day-timeline` kéo-cuộn: chi nhánh nhiều bác sĩ nên dòng của run nằm dưới mép màn hình (y≈975 / viewport 900), nhấn chuột trúng khoảng trống → `scrollIntoViewIfNeeded` trước, và đo `scrollLeft` từ mốc sau khi cuộn (cuộn dọc có thể đẩy ngang vài px) thay vì `toBe(0)`. (3) `fixtures/auth.ts` `freeSlot`: lưới cũ hẹp nên trùng lịch của lần chạy trước (`Appointment:0008` "Khung giờ này đã có lịch.") → 3000 ngày × 16 giờ bắt đầu trong ca 08–12/13–17 (R-742). (4) `appointment.spec` :85/:101: ô ngày ở chế độ mask (`DATE_INPUT_FORMAT`) bỏ qua `fill()` → giữ hôm nay 09:00, lần 2 trùng/không trùng sai → bấm ô ngày ở mép trái, `pressSequentially` chữ số, Enter, kiểm `toHaveValue`. (5) `reception.spec` :24/:57 viết lại theo bảng Tiếp nhận hiện tại (đọc `/appointments` từ `9eb67079`, không còn testid `reception-metric-*`): test 1 tạo bác sĩ + bệnh nhân riêng của run qua API thật, mở ca nếu ngoài giờ (`openShiftCovering`), chờ `/appointments/stats` rồi đọc số trong nhãn Segmented "Tất cả (n)"/"Chờ khám (n)", tạo qua dialog "Tạo tiếp nhận" (AntD Select tìm theo mã BN / tên BS, ghi chú = khoá tìm), POST 200 → hai số +1, reload vẫn +1, thẻ tìm ra bằng ô tìm của bảng, GET lại đúng BN/BS; dọn lịch + nhân viên trong `finally`. Test 2 so 4 nhãn tab với chính response `/appointments/stats` (cùng công thức `receptionApi`). Ghi nhận (không sửa, `ReceptionNewDrawer` đang do phiên khác sửa): giờ mặc định của dialog là phút lúc **mở** dialog, server từ chối slot bắt đầu trước phút hiện tại (`Appointment:0005` "Không thể đặt lịch trong quá khứ.") → lễ tân để dialog mở qua mốc phút rồi Lưu là bị từ chối; spec gõ giờ +3 phút (khi giờ đó còn trong 07–19 của picker). Kiểm chứng: preview :8080 + host :5000 + PostgreSQL thật, không chặn API: `reception.spec` 6/6 (`--repeat-each=3`); lô 16 file như R-761 **65/66** trước khi thêm bước giờ +3 phút (đỏ duy nhất là `0005` ở trên), timeline 4/4, appointment + appointment-history + patient-appointment 15/15. Chưa commit. |

## 2026-10-06 — Các ô chọn bệnh nhân khác cùng lỗi trang đầu (R-759, Tiếp nhận + CSKH + Labo + Báo cáo + Lịch hẹn)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-759 | Owner: "check những chỗ bị lỗi tương tự" sau R-766. Mọi ô chọn bệnh nhân chỉ có **một trang** từ server (30 mới nhất / 20 kết quả tìm / 200 của Báo cáo). Lỗi: (1) **Tiếp nhận > Tạo tiếp nhận** (AntD Select, tìm server): chọn A theo mã rồi gõ từ khoá khác → A rơi khỏi options → ô hiện **GUID thô**, và lưu mất tên/SĐT (lấy từ option); (2) **Mẫu Labo** lọc Khách hàng: như trên, hiện GUID; (3) **CSKH > Tạo công việc mới**: `SearchSelect` chỉ lọc trong 30 dòng → bệnh nhân cũ không tìm ra; (4) **Báo cáo > Phiếu bán hàng** (`SalesEntryModal`): tải 200 bệnh nhân, lọc trên giao diện → quá 200 thì không chọn được; (5) `SearchSelect` đóng ô thì xoá từ khoá nhưng không báo `onSearch("")` → danh sách tìm server mở lại vẫn bị lọc theo từ khoá cũ (cũng ảnh hưởng Lưu tin nhắn / Gửi Zalo CSKH). | FE-only. `src/hooks/usePatientOptions.ts`: thêm `usePinnedPatientOptions(list, selectedId)` (ghim bệnh nhân đang chọn lên đầu khi trang không có, dùng `usePatientOption` của R-766) và `usePatientPicker(selectedId)` (từ khoá debounce 300 ms → tìm server → ghim). Component chung mới `src/components/SearchSelect/PatientSearchSelect.tsx` (`SearchSelect` + `usePatientPicker`, `filterLocally={false}`, `formatLabel` tuỳ màn). Áp dụng: lịch hẹn (`AppointmentFormLeft` — bỏ state từ khoá/ghim tự viết của R-766 khỏi `AppointmentEditorModal`), CSKH `CareCreateDialog` ("Tên (MÃ)"), `SalesEntryModal` ("MÃ - Tên", bỏ tải 200), Labo `LaboOrdersScreen` (AntD Select + `usePatientPicker`, reset từ khoá khi đóng), Tiếp nhận `ReceptionNewDrawer` (giữ `usePatientList` theo branchId, thêm `usePinnedPatientOptions` theo `Form.useWatch("patientId")`). `SearchSelect.closeDropdown` gọi `onSearch("")` khi đang có từ khoá. Đã rà và không lỗi: `AllocationBar` (phòng ban, ít dòng), `InvoiceFormInfo`/`PlanServicePicker` (đã ghim sẵn), `GlobalSearch`/`PatientManagementPage` (không phải ô chọn), `PatientCareDialog`. **Quy tắc mới: ô chọn bệnh nhân mới dùng `PatientSearchSelect` (hoặc `usePatientPicker` cho AntD Select), không tự tải một trang rồi lọc trên giao diện.** e2e mới `e2e/patient-pickers.spec.ts` (bệnh nhân trang cuối /patient, tìm theo mã): Tiếp nhận — gõ từ khoá không khớp rồi rời ô → vẫn hiện tên, không GUID, dòng SĐT còn; CSKH — chọn, mở lại → ô tìm trống, A vẫn `aria-selected`; Labo — như Tiếp nhận. Bước Lưu ở test Tiếp nhận đã bỏ: bác sĩ đầu danh sách trùng khung giờ từ lần chạy trước ("Khung giờ này đã có lịch.") — là chuyện đặt lịch, không phải ô chọn. Sửa locator `cskh.spec.ts` (~181): nhãn nổi "Chọn khách hàng" nằm cạnh combobox chứ không bên trong. Gotcha: AntD render `role="option"` ẩn (mirror a11y) — e2e phải bấm `.ant-select-item-option`. Retest mức 3 (component dùng chung) trên dev server :5173, host :5000, PostgreSQL thật, không chặn API: `patient-pickers` **3/3**; lượt rộng (appointment/patient-appointment/appointment-history/cskh/labo/reception/report) 48/54 — 1 đỏ là locator `cskh.spec.ts` ở trên (đã sửa, xanh lại); 5 đỏ có sẵn, không do thay đổi này: `reception.spec.ts:24,:57` chờ `/api/v1/app/visits` mà màn đã thôi gọi (spec lệch), `labo.spec.ts:156` ô hiện "—", `report.spec.ts:294,:574`. tsc + eslint sạch. Chưa commit. |

## 2026-10-06 — Ô chọn bệnh nhân không tải thêm khi cuộn xuống (R-762, Lịch hẹn + Tiếp nhận + CSKH + Labo + Báo cáo)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-762 | Owner: "các select options đó khi scroll xuống k tải thêm". Sau R-759 mọi ô chọn bệnh nhân vẫn chỉ có **một trang** (30 bệnh nhân mới nhất, Tiếp nhận 20) — cuộn tới cuối là hết, muốn thấy bệnh nhân cũ phải gõ tìm. | FE-only. `usePatientOptions.ts`: thay `usePatientOptions` (useQuery 1 trang) bằng `usePatientOptionPages` (useInfiniteQuery, `skipCount`, 30/trang, `getNextPageParam` theo `totalCount`, `keepPreviousData`, key vẫn dưới `patientOptionKeys.all` nên invalidation cũ còn hiệu lực); `usePatientPicker(selectedId, scope?)` trả thêm `hasMore`, `loadingMore`, `loadMore` (không tải trang kế khi đang hiện dữ liệu placeholder của từ khoá cũ). `scope` (`{ branchId }`, undefined = mọi chi nhánh được xem) cho Tiếp nhận — giữ ngữ nghĩa branchId cũ của `usePatientList`. `SearchSelect` thêm `onLoadMore`/`loadingMore`: cuộn `.ss-options` tới cách đáy 48 px → gọi trang kế, Spin nhỏ dưới dòng cuối; `PatientSearchSelect` truyền vào (lịch hẹn, CSKH, Phiếu bán hàng). AntD Select dùng helper chung mới `src/components/pagedSelectProps.tsx` (`onPopupScroll` + `popupRender` spinner): Labo `LaboOrdersScreen`, Tiếp nhận `ReceptionNewDrawer` (bỏ `usePatientList` 20 + ghim tự ghép, dùng `usePatientPicker`). Util `src/utils/scrollEnd.ts` (`isNearScrollEnd`). Gotcha: AntD 6 virtual list cuộn trong `.ant-select-dropdown-list-holder` (`overflow-y: hidden`, thanh cuộn tự vẽ) — không có phần tử `overflow: auto` nên sentinel IntersectionObserver không dùng được, phải bắt `onPopupScroll`; class cũ `.rc-virtual-list-holder` không còn. e2e `patient-pickers.spec.ts` describe mới "page in more patients as they scroll (R-762)" **3/3**: CSKH (30 dòng → lăn chuột → GET `skipCount=30` 200 → số option ≥ 30 + trang 2, mã cuối trang 2 có trong danh sách), Mẫu Labo và Tiếp nhận (lăn tới khi gọi trang 2 thì dừng, lăn thêm → bệnh nhân đầu trang 2 hiện trong dropdown). Retest mức 3 (component dùng chung) trên dev server :5173, host :5000, PostgreSQL thật (140 bệnh nhân), không chặn API: `patient-pickers` **6/6**; `patient-appointment` "older patient" (R-766) xanh; `cskh.spec` 8/8 (`:252` Xuất Excel đỏ 1 lần, chạy lại xanh — flaky, không liên quan). tsc + eslint sạch. Chưa commit. |

## 2026-10-06 — Toast không tự tắt, chồng nhiều lớp (R-763, toàn hệ thống, bug list #18)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-763 | Bug list #18: lưu liên tiếp vài lần (tạo lịch hẹn, cập nhật chi nhánh…) → toast nằm nguyên nhiều phút, chồng lên nhau; kỳ vọng tự tắt sau vài giây. Nguyên nhân (tái hiện trên dev :5173): sonner **dừng mọi timer khi chuột nằm trên vùng toast** (`expanded`). Toaster đặt `top-center`, `offset 80` — đè đúng lên header/ô đầu của dialog AntD (top 100px). Khi bung ra, 3 toast phủ y 80→269px, rộng 356px giữa màn hình, nên người đang thao tác trong dialog để chuột trong vùng đó → timer không bao giờ chạy lại. Không phải do `duration`: chuột ở ngoài thì toast vẫn tắt sau 4s. | FE-only. Component chung mới `src/components/ToastLifetimeGuard.tsx` (gắn cạnh `<Toaster>` trong `main.tsx`): theo dõi danh sách toast qua `useSonner()`, mỗi toast có hạn cứng = `duration` (mặc định 4000) + 3000 ms, hết hạn gọi `toast.dismiss(id)` dù đang hover. Toast cập nhật cùng id (lỗi trùng của `notify.tsx`) được tính lại từ đầu; `loading` / `duration: Infinity` không bị đụng. Hover vẫn giữ toast thêm tối đa 3s. Không đổi vị trí/giao diện toast. e2e mới `e2e/toast-auto-dismiss.spec.ts` (đăng nhập thật, `/account/profile` bấm "Lưu Thay Đổi" 3 lần → 3 PUT 200 + 3 toast success, rê chuột lên toast → `data-expanded=true`, toast hết trong 12s): **đỏ khi gỡ guard, xanh khi có guard**. Retest mức 3 (chrome dùng chung) trên dev server :5173, host :5000, PostgreSQL thật, không chặn API: spec 1/1. tsc + eslint sạch. Chưa commit. |

## 2026-10-06 — Danh sách chi nhánh thiếu Mã chi nhánh và ngày cập nhật (R-765, Cài đặt, bug list #20)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-765 | Bug list #20: thêm chi nhánh DUNGTEST01, xem Cài đặt > Danh sách chi nhánh → cột "Lần cập nhật cuối" = "—", bảng không có cột Mã chi nhánh, cột ID in GUID. Kỳ vọng: hiện thời gian tạo/cập nhật, có Mã chi nhánh, ID là số tăng dần. Nguyên nhân: ABP chỉ đặt `LastModificationTime` khi sửa — chi nhánh mới tạo luôn null; cột mã chưa từng được khai báo (BE đã trả `code`, `creationTime` qua `FullAuditedEntityDto`). | FE: `ClinicSettingsPage` `BranchListTab` — sắp theo `creationTime` tăng dần, ID = thứ tự 1, 2, 3… (không đổi khi sửa chi nhánh); thêm cột "Mã chi nhánh" (key có sẵn `Organization:BranchCodeLabel`); "Lần cập nhật cuối" = `lastModificationTime ?? creationTime`. `ClinicBranchDto` (FE) thêm `creationTime`. BE: `ClinicBranchAppService.GetListAsync` thêm `OrderBy(CreationTime)` trước `Skip/Take` (trước đây phân trang không ORDER BY — host :5000 chưa restart nên chưa chạy bản này). e2e mới `e2e/branch-list.spec.ts`: tạo chi nhánh qua dialog → reload → cột Mã chi nhánh có, ID là dãy số liên tiếp, dòng mới mang số cuối + đúng mã + có ngày dd/mm/yyyy, rồi xoá. Retest mức 2 trên build production (`vite preview` 127.0.0.1:4791, host :5000, PostgreSQL thật, không chặn API): **1/1**. tsc sạch. Gotcha: `vite preview --port` trên `localhost` báo "Port in use" cho cổng trống (8097) và 8091 đã có server khác — dùng `--host 127.0.0.1`. Chưa commit. |

## 2026-10-06 — Hộp xác nhận xoá dịch vụ nói "không thể hoàn tác" dù chỉ xoá mềm (R-767, Danh mục, bug list #21)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-767 | Bug list #21: Danh mục > Dịch vụ, bấm Xoá một dịch vụ chưa dùng → hộp thoại ghi "Hành động này không thể hoàn tác." nhưng dịch vụ chỉ bị gạch ngang (xoá mềm, R-87 — lấy lại bằng "Đang hoạt động"); hộp thoại không hiện mã dịch vụ. Nguyên nhân: `ConfirmDeleteDialog` dùng chung luôn in dòng "không thể hoàn tác", Danh mục chỉ truyền tên. | FE: `ConfirmDeleteDialog` thêm prop `note` (dòng phụ, mặc định vẫn `Common:CannotUndone` — mọi chỗ xoá khác không đổi). `TaxonomyTab.softDelete` bật cho đúng 6 danh mục có cặp "Đang hoạt động / Đã xoá" (Dịch vụ, Chẩn đoán, Dữ liệu tư vấn, Nguồn đến, Lịch sử bệnh, Nghề nghiệp); xoá **mục** ở các tab đó hiện `Taxonomy:Catalog:SoftDeleteNote` ("Mục này chỉ bị gạch ngang, có thể khôi phục lại." — owner rút gọn). Mục có mã → câu hỏi "Bạn có chắc muốn xoá dịch vụ **Tên** (mã **DV…**) không?" (`Taxonomy:Catalog:DeleteCode`). Xoá **nhóm** giữ nguyên "không thể hoàn tác". Key mới vi/en ở Domain.Shared — host phải build lại. e2e mới `taxonomy-service-in-use.spec.ts` "bug 21" (tạo nhóm + dịch vụ qua API thật, bấm thùng rác → hộp thoại có tên + mã do server cấp, có câu xoá mềm, không có "không thể hoàn tác" → Xoá → reload: dòng còn, tên gạch ngang, mất nút xoá, API `isDeleted: true`) **1/1**. Retest mức 3 (component dùng chung) trên build production (`vite preview` 127.0.0.1:8080, host :5000 build lại, PostgreSQL thật, không chặn API): `taxonomy*` + `payment-qr` + `branch-*` **67/71**, gồm `taxonomy-groups` (hộp xoá nhóm vẫn "không thể hoàn tác"). 4 đỏ chết ở bước dữ liệu, trước phần hộp thoại: `taxonomy-service-in-use` :90/:176 (`useInPlan` — chi nhánh demo không còn phiếu điều trị mở), `taxonomy-dialogs` :104 (không thấy option NCC "Labo e2e …"), :256 ("the branch should have a service group"). Chưa chạy lại 4 test đó trên HEAD sạch. tsc + eslint sạch. Chưa commit. |

## 2026-10-06 — Bug list mục 23: Đơn thuốc không có nút In (R-768)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-768 | (mục 23, Low) Tab Đơn thuốc của hồ sơ (DH260039) chỉ có Sửa/Xóa, không in được đơn. | Cột Thao tác thêm nút In (máy in) cho mọi người xem được tab — cột không còn ẩn khi thiếu quyền sửa/xóa. Bấm mở `PrescriptionViewDialog` "Xem đơn thuốc {mã}": tờ ĐƠN THUỐC chỉ đọc (letterhead chi nhánh, mã đơn, bệnh nhân, chẩn đoán, điều trị, bảng STT / Tên thuốc - Cách dùng / Số lượng, lời dặn, tái khám, chữ ký bác sĩ kê đơn); "In đơn thuốc" mở print preview của trình duyệt chỉ với tờ A4 (cơ chế chung `.pd-print-sheet` + `body.pd-printing`, gom thành hook `usePrintSheet`). Bản gốc không có màn này — bố cục là thiết kế riêng của BlueDental. |

Kiểm: E2E `prescription.spec` **6/6** trên build production (`vite preview` → host build riêng vì host :5000
đang chạy bản chưa có key i18n mới), gồm test mới "In đơn thuốc": mở từ dòng, đúng mã/thuốc/cách dùng/lời dặn,
không có ô nhập, `window.print` được gọi 1 lần, ở media print chỉ tờ đơn hiện, đóng modal thì gỡ tờ in và class.
PDF A4 từ trang ra đúng 1 trang. `prescription-allergy.spec` không chạy được — lỗi có sẵn: import
`e2e/fixtures/catalogApi` không tồn tại trong repo. Nửa sau của mục 23 (danh mục thuốc có tên gần trùng
"Alphachymotrypsine"/"Alphachymotrypsin") là dữ liệu danh mục, không sửa bằng code. Retest level **2**.
Cần khởi động lại backend để nạp key i18n `Treatment:RxPrint:*`.

## 2026-10-06 — Tiếp nhận: "Tất cả" không bằng tổng các chip; Trễ hẹn ngay khi qua giờ, realtime (R-769, R-770)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-769 | Tiếp nhận hôm nay: "Tất cả (47)" nhưng Đã hẹn 17 + Đã đến 8 + Huỷ hẹn 8 + Trễ hẹn 1 = 34 (ba tab Chờ khám/Đang khám/Hoàn thành = 25). Nguyên nhân (`d795506d`, 24/09): `ReceptionPage.adjustedMetrics` ghi đè chip Trễ hẹn bằng số **thẻ đã tải** đang trễ theo đồng hồ (Đã hẹn quá giờ) — bỏ mất lịch `NoShow` (14) mà "Tất cả" vẫn cộng; lịch trễ theo đồng hồ đồng thời vẫn nằm trong Đã hẹn. Bấm chip lọc phía trình duyệt nên tổng trang lệch `total`. | Server quyết "trễ": `GetAppointmentListInput.IsLate` (true = `NoShow` hoặc Đã hẹn/Đã xác nhận có giờ bắt đầu ≤ now; false = phần còn lại) và `AppointmentStatsDto.Overdue`. FE: Đã hẹn = requested + confirmed − overdue, Trễ hẹn = noShow + overdue → bốn chip chia nhau "Tất cả". Chip Đã hẹn lọc `statuses=1,2&isLate=false`, chip Trễ hẹn `isLate=true`; bỏ `adjustedMetrics` và lọc phía client. `isLateAppointment` bỏ ngoại lệ Lịch tạm (lịch tạm đã huỷ không còn hiện "Trễ hẹn"). Ba tab không cộng ra "Tất cả" là đúng — huỷ/trễ không thuộc tab nào. |
| R-770 | Chủ dự án: qua giờ hẹn là Trễ hẹn luôn, không chờ 5 phút; và không phải F5 mới thấy. | `MissedAppointmentMarker` đổi mốc từ giờ kết thúc sang **giờ bắt đầu** (`Appointment.IsMissedAt`: `Slot.Start <= now`); worker 60 s → **15 s**; tab CSKH "Đặt lịch không đến" `MissedAfter` 5 phút → 0 cho khớp. Realtime: worker xong (sau commit) gọi `IAppointmentNotifier` → `SignalRAppointmentNotifier` phát `AppointmentsChanged(branchId)` trên hub `/signalr/notifications` (đã `[Authorize]`, chỉ mang branch id, không PHI); FE `useAppointmentLiveUpdates` (mount ở `AppLayout`) invalidate các query `appointments`, `appointment-history`, `receptions`, `receptionMetrics`, `care-records` khi đúng chi nhánh đang xem ("Tất cả chi nhánh" thì nhận mọi chi nhánh), và tải lại khi kết nối lại. Dự phòng: `useRefetchWhenDue` ở Tiếp nhận hẹn giờ tải lại ngay sau giờ bắt đầu gần nhất của các thẻ đang chờ — thẻ đổi Trễ hẹn đúng giờ kể cả giữa hai lượt worker hay khi lỡ một tin đẩy. |

Kiểm: Domain.Tests **616**; `tsc`/eslint sạch. E2E mới `reception-live-late` **3/3** (×2 lần chạy liền cho hai test
đầu): bốn chip cộng = "Tất cả" và chip Trễ hẹn liệt kê đúng số nó đếm; một Lịch tạm bắt đầu sau 60 s, bảng mở sẵn
**không reload** đổi badge thành Trễ hẹn trong vòng 60 s sau giờ hẹn, server thành `NoShow`; bảng không tải thẻ nào
(tìm tên không có) vẫn tăng chip Trễ hẹn chỉ nhờ tin đẩy. `appointment-missed-api`, `cskh-generated-tabs`,
`cskh-reminder-api` xanh.

Hồi quy mức 3 (build production :8092 → host :5100, cùng DB): 68 test, 56 xanh. Đỏ có sẵn như đối chứng R-755
(`appointment.spec:85/:101`, `cskh.spec:168`, `reception-temporary:132`, `reception.spec:24/:57`,
`appointment-day-timeline:147`; `:100` chập chờn). Mới đỏ nhưng **không do thay đổi**: `reception-follow-up:419/:431` —
fixture `bookVisitToday` đặt lịch +200/+210 phút "trong hôm nay", chạy sau ~20:40 là sang ngày mai nên bỏ cuộc ngay.
Lần chạy đầu `reception-live-late` đỏ: một tiến trình khác (build/test của phiên khác lúc 20:25, chạy code mới trên
cùng DB) đánh dấu lịch trước → worker :5100 gặp `AbpDbConcurrencyException`, không phát tin; trang nối vào :5100 không
nhận. Prod chỉ một backend nên không gặp; dự phòng `useRefetchWhenDue` vẫn che trường hợp này. Lượt worker gặp xung đột
(vd lễ tân check-in đúng lúc) rollback cả lượt và làm lại sau 15 s.
Retest level **3**.

## 2026-10-06 — Bug list mục 24: công nợ âm do thu vượt (R-769)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-769 | (mục 24) CSKH › Phân nhóm CSKH: Số tiền 36.400.000, Thực thu 38.200.000, Công nợ −1.800.000. Ô "Số tiền thanh toán" của "Tạo phiếu thanh toán" cho gõ vượt số còn phải trả (chỉ báo lỗi khi bấm Lưu). | Theo yêu cầu: chặn ngay ở ô nhập. `CurrencyInput` có thêm prop `max` — gõ hoặc dán vượt thì ô dừng đúng ở mức tối đa. Tự động: tối đa = tổng Còn nợ (gồm VAT) của các dịch vụ đã tick (Dư nợ: thêm giới hạn số dư đang giữ); bỏ tick làm mức tối đa giảm thì số đã gõ giảm theo. Thủ công: mỗi ô tối đa = Còn nợ của dịch vụ đó. |

Phân tích nguyên nhân (không sửa trong lượt này): ngoài ô nhập, công nợ âm còn đến từ (1) CSKH › Phân nhóm tính
Số tiền bằng `TotalAmount` chưa VAT và Thực thu cộng cả tiền nạp trước; (2) huỷ dịch vụ đã thu, chuyển đổi sang
dịch vụ rẻ hơn mà không hoàn chênh lệch, giảm giá/voucher sau khi đã thu — giá trị phiếu giảm nhưng tiền đã thu
không được hoàn hay chuyển thành tạm ứng.

Kiểm: E2E mới `payment-amount-cap` **1/1** (đăng nhập thật, phiếu điều trị mới, gõ từng phím và dán số vượt → ô
dừng đúng Còn nợ, số nhỏ hơn giữ nguyên, Thủ công dừng ở Còn nợ dòng, lưu → đọc lại phiếu thu bằng request riêng
đúng số Còn nợ, tải lại không còn dịch vụ để thu). Hồi quy `billing-ledger` + `debt-history` **9/9**. Chạy trên dev
server :5173 → host :5000. Retest level **3** (`CurrencyInput` dùng chung; không truyền `max` thì hành vi như cũ).

## 2026-10-06 — Xoá dịch vụ đang nằm trong combo: báo combo nào, gỡ khỏi combo, lưu người/ngày xoá (R-771, Danh mục, BA bổ sung bug list #11)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-771 | BA (sau bug #11): "Nếu nó đã khai báo trong combo thì hiển thị thông báo đang được sử dụng trong combo nào. Nếu xoá thì dịch vụ này sẽ mất trong combo đó. Xác nhận đồng ý thì xoá. Khi xoá ghi lại lịch sử xoá, người xoá, ngày xoá." Trước đó dịch vụ chỉ nằm trong combo vẫn xoá được nhưng combo giữ nguyên thành phần đã xoá (F-48), hộp xác nhận không nhắc gì. | BE: `CatalogEntry.RemoveComboComponent` gỡ dòng thành phần và tính lại `Price = Σ LineTotal` (domain vốn ép giá combo = tổng dòng → **giá combo giảm theo dòng bị gỡ**). Combo chỉ còn đúng dịch vụ đó → từ chối `Catalogs:0034` "Dịch vụ là thành phần duy nhất của combo \"{comboName}\"…" (domain không cho combo rỗng). `CatalogEntryAppService`: cả hai cửa xoá (DELETE thùng rác và PUT `isDeleted` từ dialog) chạy `EnsureServiceNotInUseAsync` (bug #11, `0033` giữ nguyên) → `RemoveFromCombosAsync`: gỡ khỏi mọi combo **còn sống** cùng chi nhánh trước rồi mới lưu (hỏng một combo là không đổi gì), ghi comment audit log "removed from combos: ids". Combo đã xoá không đụng tới; khôi phục dịch vụ không tự thêm lại vào combo. `DeleterId`/`DeletionTime` (ABP FullAudited) nay trả về trong DTO. Endpoint mới `GET catalog-entries/{id}/combo-holders` (`Catalogs.View`, kiểm chi nhánh) trả combo + `isLastComponent`. FE: `useComboHolders` + `ComboHoldersNotice` (`role=alert`; vàng = `Taxonomy:Catalog:InCombos` "Dịch vụ đang được sử dụng trong combo: …", đỏ = `LastInCombos`) hiện trong hộp xác nhận thùng rác và dưới ô "Đã xoá" của `ServiceDialog`. CSS ở `taxonomy.css`. Không có màn lịch sử xoá — người/ngày xoá lưu trên bản ghi + audit log. |

Kiểm (build production `vite preview` 127.0.0.1:8091, host :5000 build lại, PostgreSQL thật, không chặn API):
`taxonomy-service-in-use.spec.ts` **4/4** — test mới "BA: deleting a combo component…" (3 dịch vụ + combo 3 thành phần
+ combo 1 thành phần qua API thật; thùng rác → hộp thoại nêu tên combo → Xoá → reload: dịch vụ gạch, `deleterId` = user
đăng nhập, `deletionTime` vừa xong, combo còn 2 dòng giá 180.000; dialog tick "Đã xoá" → cùng thông báo → Lưu → combo còn
1 dòng 90.000; thành phần cuối: thông báo đỏ, DELETE bị từ chối + toast, PUT trả `0034`, không gì thay đổi); test combo cũ
sửa theo luật mới (xoá thành phần → combo còn dòng A, giá 90.000, combo đã xoá giữ 2 dòng, lưu lại + đưa vào phiếu điều
trị vẫn được). Lần chạy đầu 2 test cũ đỏ 500 ở `useInPlan`: DB local thiếu migration `TreatmentServiceTaxRate` +
`CareRecordContactedAt` của origin → chạy DbMigrator, xanh lại.
Hồi quy mức 3 `taxonomy*` + `payment-qr` + `branch-*` **69/72**. 3 đỏ chết ở bước chọn dữ liệu, không qua đường xoá:
`taxonomy-dialogs` :104 / :256 lấy `clinic-branches/accessible[0]` = chi nhánh "DANHTEST01" (phiên khác tạo 12:54Z, không
có nhóm dịch vụ / NCC labo → option NCC không thấy, "the branch should have a service group"); `taxonomy.spec` :283 mở
nhóm đầu tiên = "KEO B …" (nhóm rỗng sortOrder 0 do test kéo-thả phiên khác để lại) → bảng không có dòng. Chưa chạy
lại trên HEAD sạch; không xoá dữ liệu của phiên khác. tsc + eslint sạch. Chưa commit. Retest level **3**.

## 2026-10-07 — CSKH: Nhắc lịch hẹn → Đặt lịch không đến realtime, toast báo lịch trễ (R-772)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-772 | Owner: khi lịch qua giờ mà chưa đến, ngoài Tiếp nhận thì CSKH (Nhắc lịch hẹn → Đặt lịch không đến) và các trạng thái liên quan cũng phải cập nhật realtime, kèm sonner báo cho phòng khám biết. Đo trước khi sửa: bảng CSKH đã tự refetch nhờ push `AppointmentsChanged(branchId)` (dòng rời Nhắc lịch hẹn trong ~15 s), nhưng **không có thông báo** — push chỉ mang branchId nên FE không biết lịch nào. | BE: `MissedAppointmentMarker.MarkAsync` trả `LateAppointmentBatch(BranchId, AppointmentIds)`; `IAppointmentNotifier.NotifyMarkedLateAsync` → SignalR `AppointmentsMarkedLate(branchId, appointmentIds)` (thay `AppointmentsChanged`, chỉ id — không có dữ liệu bệnh nhân trên socket). FE: `useAppointmentLiveUpdates` nghe event mới → `invalidateEntities(["appointment"])`; entity `appointment` trong `queryEntities` thêm `appointment-history` + `care-records` (nên check-in/huỷ… do người dùng làm cũng làm mới CSKH). `announceLateAppointments` đọc lại tối đa 5 lịch qua `GET appointments/{id}` (có kiểm quyền; lịch không mở được thì bỏ, không mở được lịch nào thì không toast) → `toast.warning` 10 s: 1 lịch "Trễ hẹn: {tên}" / "Hẹn lúc HH:mm với {bác sĩ}, chưa đến"; nhiều lịch "{n} lịch hẹn chuyển sang Trễ hẹn" + danh sách, "và {k} lịch khác". Key i18n `Appointment:LateToast:*` (vi/en). Toast hiện cho mọi người đang xem chi nhánh đó (hoặc "Tất cả"), không chỉ bác sĩ của lịch. |

Kiểm (build production `vite preview` localhost:8080, host :5000 build lại, PostgreSQL thật, không chặn API):
E2E mới `cskh-live-missed` **1/1** (lịch tạm 45 s tới qua API, mở Nhắc lịch hẹn theo ngày, không reload → toast có tên
+ "Trễ hẹn", dòng rời Nhắc lịch hẹn trong vòng 45 s sau giờ hẹn, tab Đặt lịch không đến có dòng). Hồi quy
`reception-live-late` 3/3 (push mới), `appointment-missed-api`, `cskh-generated-tabs` 5/5, `cross-screen-freshness`
— tổng **12/12**. tsc + eslint sạch, BE build 0 lỗi. Retest level **3** (đổi map invalidation dùng chung).

## 2026-10-07 — Người giám hộ cho hồ sơ dưới 16 tuổi (R-773, Bệnh nhân, F-50, BA)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-773 | BA (ảnh, 2026-10-07): dialog Tạo / Chỉnh sửa hồ sơ chưa có người giám hộ; khách dưới 16 tuổi vẫn lưu được không cần ai đứng tên. | BE: bảng riêng `bd_patient_guardians` (FK `PatientId`, `LinkedPatientId` khi chọn từ hồ sơ có sẵn; migration `20261007013037_PatientGuardians`), `Patient.ReplaceGuardians` giữ luật: dưới 16 theo năm cần ≥ 1 (`0013`), tối đa 3 (`0014`), đúng 1 liên hệ chính (`0015`), đồng ý (`0016`), "Khác" cần ghi rõ + loại giấy tờ (`0017`), file sai loại / > 5MB / blob ngoài chi nhánh (`0018`), thiếu tên/SĐT/CCCD (`0019`). PUT `guardians: null` giữ nhóm cũ, `[]` xoá. Upload `POST patients/guardian-documents` (MinIO `patient-guardians/{branchId}/`, kiểm chữ ký file), tải `GET patients/{id}/guardians/{guardianId}/document`; giấy tờ chỉ giữ cho quan hệ Khác; giấy tờ của người bị gỡ / bị thay xoá sau khi lưu. FE: chip tuổi ở Ngày sinh, pill thứ 3 "Người giám hộ" (chấm đỏ / ✓), banner cam "Nhập ngay", ghi chú chân dialog + Lưu khoá, thẻ người giám hộ; popup `GuardianDialog` (← + breadcrumb, thẻ tóm tắt khách, 1 người = form đơn, 2–3 = accordion nhóm, Tìm & điền theo SĐT/CCCD, pill quan hệ, đồng ý chung, lỗi dưới ô). Pill: `.bd-patient-subtab` padding 8px 12px, gap 6px, `nowrap` để ba pill nằm một hàng. 78 khoá i18n vi/en. |

Kiểm (build production `vite preview` 127.0.0.1:8080, host :5000, PostgreSQL + MinIO thật, không chặn API):
`patient-guardian-api.spec.ts` **5/5**, `patient-guardian.spec.ts` **1/1** (thêm kiểm ba pill cùng một hàng), Domain
`PatientGuardianTests` 13 ca xanh. Hồi quy mức 2 cùng lượt: `patient-national-id` 3/3, `patient-editor-inputs` 3/3,
`patient.spec` **35/65**. 30 đỏ không chạm dialog hồ sơ: 7 chết ở `.pd-profile-card` / nút "Chỉnh sửa hồ sơ" / "Nhãn
bệnh nhân" / "Thêm lý do đến khám" vì trang chi tiết mặc định mở tab Chẩn đoán & Tư vấn (`PatientProfilePage.tsx:124`,
không đổi so với HEAD fb305fb3); 10 dừng ở "the demo clinic should have a slip with a service line / an open line with
công đoạn" (thiếu seed); 2 chờ `tab=consulting`; còn lại drift công đoạn (`.pd-stage-*`), `.pd-money` ≠ 7, nhãn phiếu
thanh toán, chờ response tag, và PUT đổi bác sĩ lịch hẹn bị từ chối (luật ca trực R-742). Cùng nhóm với 27 đỏ patient
có sẵn ở HEAD ngày 2026-10-01 (R-649); chưa chạy lại trên bản HEAD sạch. Retest level **2** (hồ sơ bệnh nhân) + **1**
(CSS pill). Chưa commit.

## 2026-10-07 — Người giám hộ: giao diện theo mock BA (R-774, Bệnh nhân, F-50)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-774 | Owner so ảnh local với mock BA: chip "13 tuổi" sát chữ; banner cảnh báo nằm trên đầu dialog thay vì dưới Ngày sinh; popup "Thông tin người giám hộ" hẹp (760px), các ô dính nhau (`.app-dialog` bỏ margin Form.Item, luật `.bd-patient-dialog` chỉ áp cho dialog chính), không giống mock. | Chip: padding 2px 10px, viền; dưới 16 thì cam (`.bd-patient-agechip--minor`). Banner chuyển vào cột giữa ngay dưới Ngày sinh (`PatientBasicColumn` prop `ageNotice`): icon nhóm người, câu đầu đậm (`RequiredBannerTitle` + `RequiredBannerBody`), nút "Nhập ngay" primary. Popup: rộng 880px, nút ← viền vuông, thẻ khách nền cam + avatar tím đặc + chip cảnh báo có icon, nhãn "Tìm người giám hộ đã có hồ sơ" trên ô tìm + placeholder mới, nút "Tìm & điền" xanh nhạt, tiêu đề "Thông tin cá nhân", lưới 3 cột (gap 22/16px, Giới tính vào hàng 3), nhãn luôn nổi + placeholder ví dụ, DatePicker full width, "Cùng địa chỉ" trong khung xám, bỏ vạch kẻ trên ô đồng ý; ≤ 900px lưới 2 cột, ≤ 640px 1 cột. Khoảng cách do `.bd-guardian-form` (flex gap 18px) lo, Form.Item trong popup margin 0. 9 khoá i18n vi/en mới. |

Kiểm (build production `vite preview` 127.0.0.1:8080, host :5000 build lại để phục vụ khoá i18n mới): `patient-guardian` 1/1,
`patient-guardian-api` 5/5, `patient-national-id` 3/3, `patient-editor-inputs` 3/3 (**12/12**). Ảnh chụp dialog chính, popup
đơn, popup có lỗi và popup nhóm 2 người đã so với mock BA. Retest level **1** (CSS) + **2** (đổi vị trí banner / cấu trúc form). Chưa commit.

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-775 | Chủ dự án (2026-10-07, ảnh dialog local): chip tuổi nằm cạnh icon lịch trong Ngày sinh; trong khối "Khác" hiện nút native "Choose File / No file chosen" dù `<input hidden>` — reset của AntD `.ant-form input[type="file"] { display: block }` đè thuộc tính `hidden`; popup 880px còn hẹp; radio Giới tính thấp hơn ô Email / Nghề nghiệp (đo: radio tâm 758px, ô tâm 744px); khoảng giữa ô đồng ý và vạch footer 46px = body padding 20 + footer margin-top 12 + 14 margin của ô đồng ý (luật `.app-dialog .ant-form > .ant-form-item:not(.ant-form-item-hidden)` 0,4,0 thắng `.app-dialog .ant-form > *:last-child` 0,3,0) và min-height 32px của control. | Có ngày sinh thì chip **thay** icon lịch (chưa có thì vẫn icon), bỏ `.bd-patient-dob-suffix`. `.bd-guardian-upload > input[type="file"][hidden] { display: none }`. Popup `width={1000}`. Giới tính: nhãn absolute trên mép trên ô (như nhãn nổi), Radio.Group cao `--ff-input-height` 42px căn giữa → cùng hàng với Email (cả hai 759–801px). Popup: body padding-bottom 14px, footer margin-top 0, ô đồng ý margin-bottom 0 + control min-height 0 → còn 14px tới vạch footer. |

Kiểm (build production `vite preview` 127.0.0.1:8080, host :5000): đo bằng getBoundingClientRect + ảnh chụp dialog chính, popup "Khác", popup cuộn
xuống cuối; `patient-guardian` 1/1, `patient-guardian-api` 5/5, `patient-national-id` 3/3, `patient-editor-inputs` 3/3 (**12/12**). Retest level **1** (CSS/bố cục). Chưa commit.

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-776 | Chủ dự án hỏi popup người giám hộ đã responsive chưa. Đo 1280 / 1024 / 768 / 390px: không tràn ngang ở cỡ nào, nhưng ở 390px: (1) footer — "+ Thêm người giám hộ thứ 2" bị nút Hủy đè, Playwright báo `.bd-modal-foot-actions` chặn pointer, không bấm được; (2) thẻ khách — chip "9 tuổi · Bắt buộc…" không co, bóp ngày sinh còn 1–2 ký tự mỗi dòng; (3) "Tìm & điền" xếp dọc mất chiều cao (≈20px); (4) nút tải giấy tờ chạm mép khung cam; (5) đầu accordion — tên + tag + "Đang nhập thông tin" chen một hàng, tag xếp dọc; tiêu đề nhóm gãy dòng cạnh nút Thêm. | Thêm vào media ≤ 640px của `patient.css`: footer popup `flex-wrap`, phần trái chiếm cả dòng (căn trái), Hủy/Lưu xuống dòng dưới căn phải; `.bd-guardian-patient` wrap, chip xuống dưới tên thụt 50px; nút tìm cao 40px; nút upload `white-space: normal`, `max-width: 100%`; tiêu đề nhóm và đầu panel wrap — nút Thêm xuống dưới tiêu đề, trạng thái nhập xuống dưới tên (thụt 38px = avatar 28 + gap 10). ≥ 641px không đổi. |

Kiểm (build production `vite preview` 127.0.0.1:8080, host :5000): spec tạm đo tràn ngang + chụp dialog chính, popup đơn "Khác", popup cuộn cuối,
popup nhóm 2 người ở 1280 / 1024 / 768 / 390px → 4/4, 0 phần tử tràn, nút "Thêm người giám hộ thứ 2" bấm được ở 390px (spec tạm đã xoá);
`patient-guardian` 1/1, `patient-guardian-api` 5/5, `patient-national-id` 3/3, `patient-editor-inputs` 3/3 (**12/12**). Retest level **1**. Chưa commit.

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-777 | BA mock 2026-10-07 "Update UI thêm phần Người giám hộ" + "Mở pop-up thêm mới người giám hộ": tab Hồ sơ của chi tiết bệnh nhân không có người giám hộ (quyết định cũ "không hiển thị"). Chủ dự án thêm: bấm cả card để mở/thu gọn chứ không chỉ nút mũi tên, rồi bỏ hẳn nút mũi tên. | BE: `PUT /patients/{id}/guardians` (`UpdateGuardiansAsync`, `patient.update`, kiểm chi nhánh, dùng chung `ApplyGuardiansAsync` → cùng luật 0013–0019, guardian giữ id giữ `ConsentedAt`, giấy bị bỏ thì xoá blob). FE: `PatientGuardianSection` + `PatientGuardianCard` + `usePatientGuardianBlock` dưới `pd-info-grid`; + / bút mở lại `GuardianDialog` (thêm prop `saving`), thùng rác qua `ConfirmDeleteDialog`, mỗi thao tác ghi ngay (`mutate` + onSuccess, lỗi do MutationCache toast); xoá người cuối của khách < 16 bị khoá kèm tooltip; xoá liên hệ chính thì người đầu còn lại lên thay. Chip "Dưới 16 tuổi" cạnh tên, "SĐT của Mẹ - …" dưới SĐT khi số trùng SĐT người giám hộ. Card chính mở sẵn; click bất kỳ đâu trên card để gập/mở (bỏ qua khi đang bôi đen chữ), nút Sửa/Xoá `stopPropagation`; không còn nút mũi tên — bàn phím: khối tên là `role=button` (`aria-expanded`, Enter/Space), bỏ key `Patient:Guardian:ShowDetails/HideDetails`. "Người đưa đến" không dựng — không có nguồn dữ liệu. |

Kiểm (build production `vite preview` 127.0.0.1:8080, host :5000, `--workers=1`): `patient-guardian-api` 6/6 (mới: PUT riêng nhóm, giữ consentedAt — so theo ms vì POST trả 7 chữ số còn PG lưu micro giây —, 0016, 0013, xoá liên hệ chính, chi nhánh 2 bị 403/404), `patient-guardian-detail` 1/1 (mới), `patient-guardian` 1/1 (**8/8**). Chạy song song 2 worker thì `patient-guardian` có lúc đỏ (dialog không đóng) — chạy riêng xanh. Retest level **2**. Chưa commit.
## 2026-10-07 — Bug list mục 25–30 (R-778 → R-783)

| ID | Bug | Sửa |
|---|---|---|
| R-778 | #25 Tiếp nhận: chọn ngày 21/10, bấm bước 1 "Đã đến" trên lịch của DH260039 → check-in thành công, ghi giờ 08:41 và chạy đồng hồ chờ cho lịch ngày 21/10. Mong đợi: chỉ check-in lịch hôm nay. | BE: `Appointment.EnsureCanArriveOn(today)` (lịch chưa tiếp nhận — Đã hẹn/Đã xác nhận/Trễ hẹn — phải đúng ngày phòng khám theo `ClinicCalendar`), gọi ở `CheckInAsync`, `StartAsync`, `CompleteAsync` (hai cửa này check-in ngầm) và `BookFollowUpAsync` khi Hẹn tái khám → `BlueDental:Appointment:0011` "Chỉ check-in được lịch hẹn của ngày hôm nay. Hãy chuyển lịch hẹn về hôm nay trước khi tiếp nhận." (0010 đã bị `UpdateTempPatientInfo` dùng inline). Không đặt trong `CheckIn()` để seeder ngày cũ vẫn chạy. FE: thẻ Tiếp nhận ngày khác chưa đến → thanh bước khoá, "Chuyển bác sĩ"/"Kết thúc điều trị"/"Hẹn tái khám" khoá ("Đã hẹn tiếp" vẫn mở vì không tiếp nhận), tooltip `Reception:CheckInOnItsDay`; thanh bước trong Hồ sơ bệnh nhân (`ReceptionSteps`) khoá bước 1 khi lịch không phải hôm nay. Không làm phương án "hỏi chuyển lịch về hôm nay" — thông báo hướng dẫn chuyển lịch. |
| R-779 | #26 Thanh toán: sửa phiếu THANHTOAN-21/DT01/2026 đổi Ngày tạo sang 28/10/2026 → lưu được. | BE: `PatientPayment.EnsureNotAfterToday(paidAt, now)` (so theo ngày phòng khám) ở `RecordAsync` và `UpdateAsync` (khi có gửi `paidAt`) → `BlueDental:Billing:0094` "Ngày thu không được sau ngày hôm nay.". FE: `PaymentEditDialog` DatePicker `disabledDate` các ngày sau hôm nay. Phiếu cũ đã lỡ mang ngày tương lai phải sửa ngày mới lưu được. |
| R-780 | #27 Danh mục › Dịch vụ: giá 300.000, giảm 500.000 VNĐ → lưu được, giá sau giảm 0. | BE: `CatalogServiceConfig.EnsureDiscountFits(price)` gọi trong `CatalogEntryParts.Apply` sau khi giá đã đặt → `BlueDental:Catalogs:0019` "Giảm giá không hợp lệ." (giữ nguyên clamp "không âm" của công thức xem trước đã đo trên staging, test domain L151/L175 không đổi). Nhập Excel: `ImportRowReader` báo lỗi dòng `Taxonomy:Import:Err:DiscountOverPrice`. FE: `ServiceDialog` ô Giảm giá có rule (% > 100 hoặc VNĐ > Giá) + `dependencies` [price, discountIsPercent] → "Giảm giá không hợp lệ" ngay dưới ô, không gọi API. Ghi vào `docs/clone/pages/taxonomy.md`. |
| R-781 | #28 Thanh toán: xoá THANHTOAN-22/DT01/2026 → phiếu biến mất, công nợ quay lại, không lý do, không dấu vết. | BE: `PatientPayment.CancelReason` (≤ 500, migration `PatientPaymentCancelReason`) + `Cancel(reason)` (trống → `BlueDental:Billing:0095`). `DELETE patient-payments/{id}` thay bằng `POST {id}/cancel { reason }`: lưu lý do **rồi** soft-delete (ABP reload entity khi soft-delete, gộp một lần thì mất lý do — đã gặp khi chạy e2e). Vẫn soft-delete nên mọi chỗ cộng tiền/công nợ/sổ thu/báo cáo tự loại phiếu huỷ. `GetList` thêm `includeCancelled` (chỉ tab Thanh toán dùng); DTO trả `isDeleted`, `deletionTime`, `deleterId`, `cancelReason`, `cancelledByName`. Mã phiếu đếm cả phiếu đã huỷ → không cấp lại số cũ. FE: `PaymentCancelDialog` bắt buộc lý do; cột Trạng thái "Đã hủy" + "{người} hủy lúc {giờ}" + "Lý do: …"; dòng huỷ chỉ còn Xem (bảng + thẻ mobile); in phiếu không cộng phiếu huỷ vào "đã thu trước". Sổ Tài chính › Thanh toán vẫn không liệt kê phiếu huỷ. E2E dọn dữ liệu `billing-ledger` (3) và `payment-permission-buttons` (1) chuyển sang `/cancel`. |
| R-782 | #29 Bệnh nhân: SĐT 0909000222 của DH260039 và DH260040, nhập cho DH260041 → cảnh báo chỉ nêu DH260039. | BE `CheckPhoneAsync`: `FirstOrDefault` → toàn bộ chủ số trong chi nhánh theo mã (`PhoneAvailabilityDto.Owners`). FE: 1 hồ sơ giữ câu cũ; nhiều hồ sơ `Patient:Editor:PhoneTakenMany` "Số điện thoại này đang được dùng cho {n} hồ sơ: [mã] tên, …". |
| R-783 | #30 Bệnh nhân: họ tên "DUNG-TEST &lt;b&gt;@#$%&lt;/b&gt; 123" lưu được. | Owner chốt 2026-10-07: cho phép chữ (kể cả dấu tiếng Việt), số, khoảng trắng, `-` `.` `'`. BE `PersonName` (Domain.Shared) + `Patient.Register`/`UpdateDemographics` → `BlueDental:Patient:0020`; FE `PERSON_NAME_PATTERN` (`utils/vietnameseName.ts`) trên ô Họ và tên + map lỗi server về ô. Hồ sơ cũ có tên sai (vd DH260041) phải sửa tên mới lưu được. Tên Lịch tạm chưa áp rule (sẽ bị chặn khi tạo hồ sơ từ lịch tạm). |

Kiểm (BE build lại, migration áp dụng qua DbMigrator, PostgreSQL thật, không chặn API):
E2E mới `qa-bugs-25-30` **5/5** trên dev :5173 và trên build production `vite preview` :8080.
BE: Domain.Tests **619/619**, Application.Tests **671/671**.
Hồi quy mức 3 Danh mục (mục 17) `taxonomy*` + `payment-qr` + `branch-*` + spec mới trên preview: **74/76** — 2 đỏ
(`taxonomy-import-api` :681, `taxonomy-service-sync` :321) đều do role `dentist` trong DB local đang có cả loạt quyền
(catalog*.create/…, kiểm trong `AbpPermissionGrants`), trong khi test giả định role này không có quyền nào — dữ liệu môi
trường, không phải code (không file nào trong lượt này đụng tới phân quyền). Không tự reset role.
Ghi chú: DbMigrator báo `SlotInThePast` ở `BlueDentalDemoSeedContributor.SeedAppointmentsAsync` sau khi migrate xong
(seed demo đặt lịch hôm nay vào giờ đã qua) — có từ trước, ngoài phạm vi lượt này.
Hồi quy mức 3 Tiếp nhận / Bệnh nhân / Thanh toán trên preview (`reception*`, `billing-ledger`, `debt-history`,
`treatment-plan-detail`, `patient-editor-inputs`, `patient-national-id`, `patient-appointment`,
`appointment-patient-link`, `patient.spec`, `payment-amount-cap`, `cskh-live-missed`; 22,3 phút): **92 xanh, 35 đỏ**.
- 32 đỏ ở `patient.spec`: nhóm đỏ có sẵn (xem mục 2026-10-01 / dòng ~6583) — trang hồ sơ mở mặc định tab "Chẩn đoán &
  Tư vấn" từ `86ccaf00` (2026-09-23) nên các ca chờ nút "Chỉnh sửa hồ sơ"/thẻ Hồ sơ hết giờ, và fixture "the demo clinic
  should have a slip with a service line" hết dữ liệu demo phù hợp. Riêng "the Tiếp nhận steps advance one at a time"
  đỏ **do thay đổi này** (nó đặt lịch +120 ngày rồi bấm "Đã đến") → sửa test: lịch +120 ngày phải khoá bước 1, lịch
  hôm nay (mở ca bằng `openShiftCovering`) đi đủ 3 bước — chạy lại **xanh**.
- `reception-doctor-roles` :47 — chạy lại xanh (chập chờn).
- `patient-appointment` :321 (không thấy dòng lịch vừa tạo trong danh sách) và `treatment-plan-detail` :565 (kéo-thả
  dòng dịch vụ, chờ request lưu thứ tự) — đỏ cả khi chạy lại; không đi qua code của lượt này (không check-in, không
  phiếu thu, không tên bệnh nhân); chưa đối chứng trên HEAD.
tsc sạch; eslint chỉ còn lỗi có sẵn "Definition for rule 'react-hooks/exhaustive-deps' was not found". Retest level **3**.

## 2026-10-07 — Bug list mục 29 bổ sung: trùng SĐT thì không cho lưu/tạo (R-784)

| ID | Yêu cầu | Sửa |
|---|---|---|
| R-784 | Owner (sau R-782): ngoài cảnh báo liệt kê các hồ sơ đang dùng số, khi trùng SĐT thì **không cho lưu/tạo** (hoặc disable nút Lưu). | BE: `PatientAppService.EnsurePhoneIsFreeAsync` (cùng chi nhánh, trừ chính hồ sơ đang sửa, cùng cách so như `CheckPhoneAsync`) ở `RegisterAsync` và `UpdateAsync` → `BlueDental:Patient:0021` "Số điện thoại này đã được dùng cho hồ sơ khác trong chi nhánh." (0013–0019 của người giám hộ, 0020 của tên). FE `PatientEditorDialog`: cảnh báo đổi sang `type="error"` + dòng `Patient:Editor:PhoneTakenBlocked` "Không thể lưu: mỗi số điện thoại chỉ được dùng cho một hồ sơ…", `canSave` thêm `!phoneTaken` → nút Lưu khoá; lỗi 0021 từ server (đua giữa lúc kiểm và lúc lưu) hiện dưới ô Điện thoại. Áp cho mọi cửa mở dialog (Bệnh nhân, Tiếp nhận, Lịch hẹn, Lịch tạm → hồ sơ, Quét CCCD). Dữ liệu cũ đang trùng số (vd DH260039/DH260040): sửa hồ sơ nào cũng bị khoá Lưu cho tới khi đổi sang số khác — đúng yêu cầu "không cho edit". Seeder demo gọi thẳng domain nên không bị ảnh hưởng. |

E2E: `qa-bugs-25-30` ca #29 viết lại (API tạo trùng → 0021, PUT chuyển hồ sơ khác sang số đó → 0021, dialog nêu `[mã] tên` + "Không thể lưu", Lưu khoá, đổi số khác thì mở lại) — **5/5** cả spec trên dev :5173.
Sửa test cũ tạo trùng số: `patient-national-id` (các tag A–H cùng độ dài nên cùng SĐT → mỗi tag một số), `patient.spec`
"the save stays disabled…" (số cố định 0912345678 → số theo `runId`). Chạy lại xanh: `patient-national-id` 3/3,
`reception-temporary` 3/3, `patient-scan-id` 4/4, `patient-guardian-api` 6/6, "the save stays disabled…" 1/1.
`patient.spec` "Lưu Chẩn Đoán…" đỏ — thuộc nhóm đỏ có sẵn (tab mặc định "Chẩn đoán & Tư vấn"). Retest level **2**.

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-785 | BA 2026-10-07: "hồ sơ khách hàng / bệnh nhân thì unique, còn người giám hộ thì không unique" — cùng một người (cùng SĐT, CCCD) là người giám hộ của bệnh nhân A và B; người giám hộ không cần có hồ sơ. Kiểm lại code: không có kiểm tra trùng nào cho `bd_patient_guardians`, khai báo người giám hộ không tạo hồ sơ; CCCD hồ sơ unique theo chi nhánh (0012); SĐT hồ sơ chỉ cảnh báo, không chặn. Chưa có test chứng minh. | Không sửa code. Thêm test API trong `patient-guardian-api.spec.ts`: người mẹ có hồ sơ riêng (cùng SĐT + CCCD) và là người giám hộ của hai bé A, B → cả ba 200, mỗi bé một dòng riêng; thêm lại mẹ qua `PUT …/guardians` → 200; `check-phone` SĐT người bố (chỉ là người giám hộ) → `exists: false`; hồ sơ thứ hai trùng CCCD mẹ → `BlueDental:Patient:0012`. Ô "Tìm người giám hộ đã có hồ sơ" chỉ tìm trong hồ sơ, nên SĐT chỉ có ở người giám hộ thì không tìm ra (đúng thiết kế). |
| R-786 | Gõ CCCD vào ô "Tìm người giám hộ đã có hồ sơ" thì danh sách gợi ý chớp hiện rồi tắt. Nguyên nhân: `usePatientPicker` giữ kết quả cũ (`keepPreviousData`) trong lúc debounce 300 ms + gọi API; ô trống thì "kết quả cũ" là 30 bệnh nhân mới nhất, nên phím đầu tiên hiện 5 người không liên quan, rồi tắt khi tìm CCCD trả rỗng. | `usePatientPicker` trả thêm `resultsFor` (từ khoá của các dòng đang có, lưu trong từng trang). `GuardianSearch` chỉ hiện gợi ý khi `resultsFor` khác rỗng và nằm trong chữ đang gõ (kết quả của từ khoá đang gõ dở thì vẫn dùng được). Các picker khác không đổi. Test: `patient-guardian.spec.ts` gõ từng ký tự một CCCD không có hồ sơ, MutationObserver xác nhận danh sách không lần nào hiện — với code cũ thì đỏ (`Received: "1"`), code mới xanh; guardian specs 9/9. |
| R-787 | BA 2026-10-07 (chat): ô "Tìm người giám hộ đã có hồ sơ" phải tìm **cả** hồ sơ khách hàng/bệnh nhân **lẫn** danh sách người giám hộ đã khai cho bệnh nhân khác — "có thể số đt có nhưng ko phải bệnh nhân, do người đó đã làm giám hộ cho 1 người khác", "quản lý tập trung 1 số đt". Trước đây ô chỉ tìm hồ sơ (R-785), nên SĐT 0722722911 (chỉ là người giám hộ) báo "Không tìm thấy". | API mới `GET /api/v1/app/patients/guardian-candidates?filter=&excludePatientId=` (`GuardianCandidateAppService`, `Patient.Read`, theo chi nhánh): tối đa 5 hồ sơ (tên/mã/SĐT/CCCD, mới nhất trước) rồi tối đa 5 người giám hộ (tên/SĐT/CCCD), gộp theo CCCD, kèm `wards` (đang giám hộ cho ai); người giám hộ trùng một hồ sơ trong kết quả (liên kết hoặc cùng CCCD) bị bỏ — hồ sơ thắng; không trả người giám hộ của chính hồ sơ đang sửa. FE: `GuardianSearch` dùng `useGuardianCandidates` (debounce 300 ms, vẫn giữ quy tắc R-786) + `useFindGuardianCandidates` cho Enter/"Tìm & điền"; dòng người giám hộ hiện "SĐT · Người giám hộ của …"; chọn thì điền thẳng từ kết quả (`fillGuardianFromCandidate`, có cả ngày/nơi cấp CCCD), không gọi thêm `GET /patients/{id}`. Gỡ `resultsFor` khỏi `usePatientOptions` (R-786) vì không còn ai dùng. Test: `patient-guardian-api.spec.ts` thêm 1 test (người giám hộ không hồ sơ tìm ra bằng SĐT/CCCD, một lần, có 2 bé; loại trừ hồ sơ đang sửa; người có hồ sơ kiêm người giám hộ chỉ ra 1 dòng hồ sơ; ô trống → []; BRANCH2 → []); `patient-guardian.spec.ts` tìm bố (hồ sơ) rồi bà (chỉ là người giám hộ của bé khác) và "Tìm & điền" bà. Guardian specs 10/10. |

Sau merge origin 383c6cf4 (bug list 25–30 chiếm R-778 → R-784): 3 dòng trên đổi số R-778/779/780 → R-785/786/787 (cập nhật cả comment code, spec, tài liệu). Kiểm lại trên bản merge (BE build, DbMigrator áp `PatientPaymentCancelReason`, preview :8080, `--workers=1`): `patient-guardian*` 10/10, `patient-national-id` 3/3, `qa-bugs-25-30` 5/5 (**18/18**). Chặn trùng SĐT của R-784 chỉ áp cho hồ sơ — người giám hộ vẫn không unique (R-785). Retest level **2**.

## 2026-10-07 — Cụm 11 mục 11: Xác thực IP theo chi nhánh (R-788 → R-790, F-51)

BlueDental riêng; quyết định ghi ở `docs/clone/pages/branch-ip-restriction.md`.

| ID | Vấn đề / yêu cầu | Xử lý |
|---|---|---|
| R-788 | Cài đặt → Thông tin phòng khám lưu chi nhánh mà không gửi `allowedIpRanges`; nếu BE hiểu `null` là "xoá" thì mỗi lần lưu Cài đặt sẽ xoá mất danh sách IP. | `UpdateAsync`: `null` giữ nguyên, `""` xoá. Dialog chi nhánh luôn gửi chuỗi. Có test (`setBranchIps(…, undefined)` giữ danh sách). |
| R-789 | Lần chạy hồi quy đầu: test giao diện của spec mới hết giờ trước `finally`, để lại chi nhánh `IP718573` mang `203.0.113.0/24` → mọi tài khoản toàn phòng khám không phải admin bị chặn đăng nhập → `current-user-ticks-api` 4 ca đỏ dây chuyền. | Xoá mềm chi nhánh sót trong DB local; spec có `sweepLeftoverBranches` (phiên admin mới) ở `beforeAll`/`afterAll`, timeout 90 s, chờ bảng chi nhánh hiện rồi mới phân trang. Chạy lại: `current-user-ticks-api` xanh. |
| R-790 | `ASPNETCORE_FORWARDEDHEADERS_ENABLED` (production) mặc định tin mọi proxy nhưng chỉ 1 bước: với Caddy → nginx → API, địa chỉ client mà API thấy là địa chỉ của Caddy, không phải của người dùng — kiểm IP theo chi nhánh sẽ so mọi người với địa chỉ proxy. | `ConfigureForwardedHeaders`: chỉ tin loopback + mạng riêng, không giới hạn bước → lấy địa chỉ đầu tiên không phải proxy. Chưa kiểm trên production: gọi `GET /api/v1/app/account/client-ip` từ mạng phòng khám trước khi nhập danh sách IP. |

Kiểm chứng (build production :8080, API thật :5000, PostgreSQL thật, không chặn API): `branch-ip-restriction` **5/5**.
BE: Domain.Tests **664** (mới `BranchIpRestrictionTests` 27), Application.Tests **671**, HttpApi.Host.Tests **24**.
Migration `BranchAllowedIpRanges` chỉ thêm 1 cột. DbMigrator: schema migrate xong, seed demo lỗi `SlotInThePast` — có từ trước (xem mục trên).
Hồi quy mức 3 (auth/chi nhánh/nhân viên/phân quyền: `auth`, `branch-isolation`, `branch-switcher`, `branch-list`, `staff`,
`staff-penalty-api`, `staff-day-off-api`, `role-permissions`, `role-permissions-abilities`, `current-user-ticks-api`,
`header-navigation`, `routes`): **49 xanh, 6 đỏ** — tất cả đã ghi nhận từ trước: `header-navigation` 3 (R-677),
`role-permissions` + `role-permissions-abilities` (dữ liệu role `dentist` local, R-725..R-727), `routes` `/timekeeping` (route cũ).
tsc + eslint sạch. Retest level **3**.

## 2026-10-07 — Cụm 11 mục 13: Quản lý thời gian sử dụng (R-791, F-52)

BlueDental riêng; quyết định ghi ở `docs/clone/pages/usage-hours.md`.

| ID | Vấn đề / yêu cầu | Xử lý |
|---|---|---|
| R-791 | Mục 13 dùng chung đường đăng nhập với mục 11: guard/middleware IP được tổng quát hoá (`LoginIpGuard` → `SignInRestrictionGuard` trả `SignInRefusal`, `LoginIpRestrictionMiddleware` → `SignInRestrictionMiddleware`), mọi tài khoản đi qua cùng một lần kiểm (IP trước, giờ sau). | Spec F-51 chuyển sang fixture chung `e2e/fixtures/restrictedStaff.ts` (chi nhánh + nhân viên dùng một lần, bộ dọn `CN <prefix> <n>`); chạy lại **5/5**. |

Kiểm chứng (build production :8080, API thật :5000, PostgreSQL thật, không chặn API): `branch-usage-hours` **5/5**, `branch-ip-restriction` **5/5**.
BE: Domain.Tests **685** (mới `BranchUsageHoursTests` 21), Application.Tests **671**, HttpApi.Host.Tests **24**. Migration `BranchUsageHours` chỉ thêm 2 cột `time`.
Hồi quy mức 3 (`auth`, `branch-isolation`, `branch-switcher`, `branch-list`, `staff`, `staff-penalty-api`, `staff-day-off-api`,
`current-user-ticks-api`, `role-permissions`, `role-permissions-abilities`, `header-navigation`): **33 xanh, 5 đỏ** — đều đã ghi nhận từ trước:
`header-navigation` 3 (R-677), `role-permissions` + `role-permissions-abilities` (dữ liệu role `dentist` local, R-725..R-727). tsc + eslint sạch. Retest level **3**.

## 2026-10-07 — Cụm 11 mục 9: Ẩn số điện thoại (R-792, R-793, F-53)

Quyết định ghi ở `docs/clone/pages/hide-phone.md`.

| ID | Vấn đề / yêu cầu | Xử lý |
|---|---|---|
| R-792 | Tick "Ẩn số điện thoại" (`patient.hidePhone`) có trên Phân quyền nhưng không có tác dụng; seed lại cấp nó cho cả 3 vai trò tĩnh (nên làm thật thì admin cũng mất số); form sửa hồ sơ / người giám hộ / lịch tạm / hoá đơn điện tử gửi lại số đang hiện, nên số bị che sẽ ghi đè số thật. | Che ở biên ra (result filter + `[PatientPhone]`, Excel tự che), admin không bao giờ bị che, seed bỏ quyền này khỏi vai trò tĩnh + migration `HidePhoneOffStaticRoles` + xoá cache quyền lúc khởi động API; mọi đường ghi đi qua `PatientPhoneMask.Resolve` (giá trị che chỉ là "giữ nguyên" khi khớp đúng số đã biết, khác → 403 `BlueDental:Patient:0022`); FE nhận giá trị che trong ô SĐT; Lịch tạm → Tạo hồ sơ gửi `sourceAppointmentId`. |

| R-793 | Rà bảo mật (trước khi push): (1) `MessageLogDto.Content` / `RecipientName` (và `ZaloMessageDto.RecipientName`) vẫn trả số đầy đủ (`phone=09…` trong nội dung tin ZNS); (2) tìm kiếm theo số vẫn so `Contains` trên số thật, nên tài khoản bị che gõ dần từng chữ số là dò ra phần bị che; `check-phone` trả tên chủ số. | Đánh dấu `[PatientPhone(Embedded = true)]` cho các trường đó; tài khoản bị che chỉ khớp **nguyên số** ở danh sách bệnh nhân, tìm người giám hộ, CSKH, nhật ký tin nhắn / Zalo (nội dung tin không tìm theo chuỗi số); `check-phone` chỉ trả `exists`. Spec thêm ca: tên + 6 số đầu → 0 dòng (admin: 1), `check-phone` không có owners (admin: có). |

Kiểm chứng (build production :8080, API thật :5000, PostgreSQL thật, không chặn API): `patient-hide-phone` **3/3** (cả các ca dò số).
BE: Domain.Tests **700** (mới `PatientPhoneMaskTests` 15), Application.Tests **676** (mới `PatientPhoneMaskerTests` 5), HttpApi.Host.Tests **24**.
Hồi quy mức 3 (`patient-guardian-api`, `patient-guardian`, `patient-guardian-detail`, `patient-editor-inputs`, `patient-national-id`,
`reception-temporary`, `qa-bugs-25-30`, `appointment-history`, `einvoice-api`, `export`, `cskh`, `cskh-reminder-api`,
`patient-permission-gates`, `appointment-patient-link`): **46 xanh, 3 đỏ**, không cái nào do thay đổi này:
- `patient-guardian-api` "proof files…" — MinIO local đang tắt; bật lên chạy lại **xanh**.
- `export` "a prescription row has an In đơn button…" chờ `getByRole('tab', { name: 'Đơn thuốc' })`, và `patient-permission-gates` :112 đếm
  link "Chẩn đoán & Tư vấn" — thanh "Chi tiết bệnh nhân" giờ là link, không còn tab (ảnh chụp có đủ "Đơn thuốc"); test cũ, chưa sửa.
tsc sạch; eslint chỉ còn lỗi có sẵn `react-hooks/exhaustive-deps`. Retest level **3**.

## 2026-10-07 — Cụm 11 mục 12: Quy định giảm giá (R-794, F-54)

Quyết định ghi ở `docs/clone/pages/discount-limit.md`.

| ID | Vấn đề / yêu cầu | Xử lý |
|---|---|---|
| R-794 | Rà bảo mật trước khi push tìm 3 lỗ lách giới hạn: (1) so "mức giảm cũ" bằng tiền nên giảm số lượng dưới cùng số tiền giảm là vượt % (tới 100%); (2) giảm giá phiếu chỉ kiểm lúc đặt — thêm dịch vụ (giảm % phình theo), huỷ / hạ giá dịch vụ (giảm VNĐ thành tỉ lệ lớn) không kiểm lại, và đo sau khi đã cắt ở tổng phiếu; (3) chuyển đổi "giữ dịch vụ" nhân đơn giá đã hạ lên nhiều răng mà không kiểm. | `DiscountLimit.Measure`: so % với % cũ, tiền với tiền cũ; kiểm lại giảm giá phiếu (trước khi cắt, `OwnDiscountUncapped`) sau thêm / sửa / huỷ / chuyển đổi dịch vụ; chuyển đổi đo trên giá danh mục × số răng. Domain + e2e thêm ca giảm số lượng và huỷ dịch vụ. |

Kiểm chứng (build production :8080, API thật :5000, PostgreSQL thật, không chặn API): `discount-limit` **3/3**.
BE: Domain.Tests **710** (mới `DiscountLimitTests` 10), Application.Tests **676**.
Hồi quy mức 3 (`catalog-combo`, `consulting-delete-and-picker`, `consulting-plan`, `consulting-review`, `treatment-plan`, `treatment-plan-detail`,
`payment-amount-cap`, `voucher`, `staff`, `discount-limit`): **47 xanh, 5 đỏ** (bản trước khi vá), không cái nào ghi giảm giá:
`consulting-delete-and-picker` :200 (danh sách "Chọn Dịch Vụ" không thấy dịch vụ vừa tạo), `consulting-plan` :433 (không tìm thấy dòng có giá
cho voucher), :556 (ảnh còn shimmer — MinIO local), :806 (khoảng chữ ký bản in), `treatment-plan-detail` :565 (kéo-thả, đỏ có sẵn).
Sau khi vá: `treatment-plan-detail` chạy lại — chỉ :565 đỏ. tsc + eslint sạch. Retest level **3**.

Sau merge origin eb033298 (F-51..F-54 cụm 11 mục 9/11/12/13 chiếm R-788 → R-794): các mục dưới đây của phiên Marketing/CSKH
đổi số R-788..R-797 → R-795..R-804 và F-51 → F-55 (cập nhật cả comment code, spec, tài liệu). Không đổi nội dung.

## 2026-10-07 — F-55 Marketing → Ticket, đợt 1 (R-795..R-797)

Tính năng mới theo BA PDF cụm 8 (8.1, 8.2, 8.5, 8.7) — xem `docs/clone/pages/marketing-ticket.md`. Ba lỗi dưới đây do
e2e thật bắt được trong lúc dựng, đã sửa trước khi nghiệm thu.

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-795 | Xoá ticket có lý do, nhưng tab Đã xoá hiện lý do trống. Nguyên nhân: soft delete của ABP nạp lại entity trước khi đánh dấu xoá, nên `DeleteReason` vừa gán bị bỏ. | `MarketingTicketAppService.DeleteAsync` lưu lý do (`UpdateAsync`) **rồi** mới `DeleteAsync`. Kiểm bằng `marketing-ticket.spec` (Đã xoá hiện "Nhập nhầm"). |
| R-796 | Đặt lịch từ ticket trả 500 khi giờ hẹn gửi lên có offset +07:00. Nguyên nhân: Npgsql chỉ nhận `DateTimeOffset` UTC cho cột `timestamptz`. | Đổi giờ bắt đầu/kết thúc sang UTC (`ToUniversalTime()`) trước khi tạo lịch. Kiểm bằng ca "Đặt lịch books a temporary appointment…". |
| R-797 | Người không có `readAll` mở ticket của đồng nghiệp: 403 **thân rỗng**, giao diện không biết vì sao. Nguyên nhân: `AbpAuthorizationException` đi qua forbid handler của ABP, handler này không trả body. | `GetCheckedAsync` ném `BusinessException(MarketingTicket:0010)`: vẫn 403, nhưng có mã và câu "Ticket này đang được giao cho nhân viên khác.". Ca own-scope trong `marketing-ticket-api.spec` kiểm mã 0010. |

Chạy thật (build production :8357 → host riêng :5001 có đủ 3 sửa → PostgreSQL): `marketing-ticket-api` **8/8**,
`marketing-ticket` **2/2**. Level 3 vì follower nằm trong UoW của lịch hẹn: `appointment`, `appointment-history`,
`appointment-working-hours` **11/11**. Domain.Tests 663/663, `tsc -b` sạch, eslint sạch trên file mới.
Host chung :5000 (của phiên khác) vẫn chạy code cũ — chưa có 3 sửa trên cho đến khi được khởi động lại.

## 2026-10-07 — F-55 Marketing: giao diện theo style hệ thống (R-798)

| ID | Triệu chứng | Sửa |
|---|---|---|
| R-798 | Chủ dự án: giao diện Marketing "không giống style của hệ thống", phải dùng lại component có sẵn. Bản đầu có dải KPI dạng thẻ, pill trạng thái, toolbar và lưới form tự viết, `RangePicker` và `Select` thô. | Dựng lại theo khung Mẫu Labo. Thêm `MarketingShell`, dùng chung cho cả 3 tab: `PageHeader` + `PageTabBar` + `bd-cat-header`/`bd-cat-body`/`bd-cat-card` + `DataTable`. Dải KPI đổi thành `SegmentedTabs` có số đếm (key `Ticket:Tab:*`, thêm `Ticket:Tab:All`, `Ticket:Noun`). Khoảng ngày dùng `PeriodPicker`. Bộ lọc dùng `FloatingLabel` + `SearchSelect`. Trạng thái dùng `StatusBadge` + `STATUS_TONE`. Thao tác dùng `bd-cat-rowactions` + `ActionTooltip`. Phân trang dùng `countedTotal`. Mọi dialog chuyển sang `FloatingField` + `Row`/`Col`. `marketing.css` viết lại với class `mkt-*`, bỏ toàn bộ class `.ticket-kpi*`, `.ticket-pill*`, `.ticket-toolbar*`. Header bỏ `min-height` của Danh mục (trang Thẻ ticket / Đã xoá có khoảng trắng thừa). Dưới 768 px trang cuộn cả trang. Ảnh 1600×900 đối chiếu với `/labo`. `marketing-ticket-api` + `marketing-ticket` **10/10** trên build production :8357 → host riêng :5001. `tsc -b` và eslint sạch. Retest level **1** (giao diện) + chạy lại spec của feature. |

## 2026-10-07 — Lịch hẹn hủy và Complain thiếu gửi Zalo (R-799, CSKH, checklist 2.6/2.7)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-799 | Checklist 2.6 Complain / 2.7 Lịch hẹn hủy: "SMS, Zalo chăm sóc theo kịch bản riêng (nếu kết nối)". Hai tab (R-757/R-758) có Lưu tin nhắn (SMS) nhưng không có nút Gửi ZBS qua Zalo — `showSend: false`. | FE-only. `careTabs.ts`: `showSend: true` cho `cancelled-appointment` và `complaint`. Cột Thao tác tự rộng ra (`actionsColumnWidth`). Server không cần sửa: `ZaloOaAppService.SendAsync` nhận mọi loại công việc CSKH, điền tham số mẫu từ bệnh nhân + công việc (Complain không có lịch hẹn → dùng `ScheduledStart ?? DueAt`). "Kịch bản riêng" = nhân viên chọn mẫu ZNS đã duyệt của chi nhánh trong dialog, giống Nhắc hẹn/Sinh nhật; chưa có cấu hình mẫu mặc định theo loại chăm sóc (UNKNOWN). e2e `cskh-generated-tabs.spec.ts` thêm `expectMessaging` vào 2 ca Lịch hẹn hủy + Complain: dòng có nút Lưu tin nhắn + Gửi ZBS qua Zalo, bấm Gửi ZBS → GET `/zalo/templates`, dialog hiện đúng khách hàng, Gửi khi chưa chọn mẫu → "Vui lòng chọn mẫu ZBS", không có POST. Chi nhánh local chưa nối Zalo OA nên không gửi thật. Build production (`vite preview` 127.0.0.1:8099), host :5000, PostgreSQL thật, không chặn API: spec **4/5** — 2 ca của thay đổi này xanh; `:239` (Đặt lịch không đến) đỏ vì `Appointment:0011` "chỉ check-in lịch hôm nay" (quy tắc mới của bug list #25 ở origin), không liên quan. `tsc -b` sạch. Chưa commit. |

## 2026-10-07 — Mọi tab CSKH gửi được Zalo + sửa e2e Đặt lịch không đến (R-800, checklist 2.4)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-800 | Checklist 2.4 Đặt lịch không đến (và 2.2 Không làm dịch vụ, 2.5 Sau điều trị, 2.8 Chăm sóc định kỳ, Chăm sóc đặc biệt): yêu cầu "SMS, Zalo chăm sóc theo kịch bản riêng" nhưng tab không có nút Gửi ZBS qua Zalo. e2e `cskh-generated-tabs.spec.ts:239` đỏ: lấy một lịch quá hạn từ ngày trước rồi check-in → `Appointment:0011` (bug #25: chỉ check-in lịch hôm nay). | FE-only. Bỏ cờ `showSend` khỏi `CareTabConfig` — giờ tab nào cũng có Gọi + Lưu tin nhắn + Gửi ZBS (bản gốc chỉ gửi ở Nhắc hẹn/Sinh nhật, ta theo checklist). `careColumns.tsx` luôn truyền `onSend`, cột Thao tác rộng `3 + fileHeart` nút. Server không đổi (R-799). e2e ca Đặt lịch không đến viết lại: tự đặt lịch phút tới (API chặn lịch quá khứ), kiểm chưa tới giờ → không có trên tab, chờ qua giờ hẹn → có dòng, `expectMessaging` (SMS + Zalo, chưa chọn mẫu thì không POST), Đã liên hệ lưu + log, check-in (cùng ngày) → dòng biến mất. Build production :8099, host :5000, PostgreSQL thật, không chặn API: `cskh-generated-tabs` **5/5**, `cskh.spec` **8/8**. `tsc -b` sạch; eslint còn 2 lỗi có sẵn (spec dòng 56 `no-useless-assignment`, rule `react-hooks` ở CskhGroupingPage). Retest level **2** (CSKH). Chưa commit. |

## 2026-10-07 — F-55 Marketing: dialog góp ý của chủ dự án (R-801)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-801 | Chủ dự án (ảnh chụp): (1) các lựa chọn Kết quả liên hệ "nhìn xấu"; (2) ô Nội dung trao đổi / Ghi chú / Lý do quá thấp, chỉ một dòng, ở các dialog Ghi nhận liên hệ, Đặt lịch hẹn, Thêm/Sửa ticket, Không tiềm năng, Xoá ticket; (3) Chuyển người phụ trách hiện GUID thay vì tên; (4) Khôi phục ticket chạy luôn, không hỏi lại. | (1) `Radio.Group` bỏ kiểu nút, đổi thành lưới ô `.mkt-result-options` (viền `--bd-line`, ô được chọn tô `--bd-blue-pale`). (2) Lỗi **chung**: textarea có `showCount` nằm trong affix wrapper, mà `index.css` ghim `.ant-modal .ant-input-affix-wrapper` cao 42px. Wrapper là flex nên kéo textarea về 40px, `rows` vô tác dụng. Thêm `.ant-modal/.ant-drawer .ant-input-textarea-affix-wrapper { height: auto }` **đặt sau** khối 42px ở ~8225 (cùng specificity, đặt trước thì bị đè). Các ô ghi chú dùng `rows={4}`: đo được textarea 104px, wrapper 106px. Ảnh hưởng thêm các dialog showCount khác (Penalty/PaymentCancel): chúng cũng cao đúng theo `rows`. (3) `/marketing-tickets/assignees` chỉ trả nhân viên có `StaffBranchAssignment`; admin đã nhận ticket thì không có trong danh sách nên Select hiện id. `AssignDialog` ghim người đang phụ trách (`currentAssigneeName`) lên đầu options. Lưu mà không đổi người thì chỉ đóng dialog. (4) `ConfirmDialog` "Khôi phục ticket" (key `Ticket:RestoreTitle`, `Ticket:RestoreConfirm`). `useTicketActions` thêm pending `restore`. e2e `marketing-ticket.spec`: bấm Đóng → ticket vẫn ở Đã xoá; xác nhận → về danh sách. Ảnh 6 dialog kiểm bằng mắt. Build production :8357 → host riêng :5001, PostgreSQL thật, không chặn API: `marketing-ticket` + `marketing-ticket-api` **10/10**. `tsc -b` và eslint sạch. Retest level **1** (CSS chung cho modal) + spec của feature. Chưa commit. |

## 2026-10-07 — F-55 Marketing: header ghim và khung bảng (R-802)

| ID | Lỗi | Xử lý / Kiểm chứng |
|---|---|---|
| R-802 | Chủ dự án (ảnh chụp /marketing/tickets): (1) ô header "Mã ticket" (cột ghim trái) không dính khi cuộn — hàng đè lên; (2) card bảng hẹp hơn toolbar, chiều cao chưa lấp hết phần còn lại; (3) cột Ngày nhận / Liên hệ gần nhất bị cắt chữ. | (1) Lỗi **chung** cho mọi bảng `.bd-cat-card`: AntD 6 cho ô ghim `z-index: calc(var(--z-offset-reverse) + 2)`, offset tăng theo số cột (ô body lên tới 14 ở bảng 12 cột), trong khi rule `th` ghim ở index.css chỉ có 5. Nâng lên `60` và cho `.bd-cat-card` `isolation: isolate` để số này không lọt ra ngoài card (dropdown/modal portal ra body nên không bị ảnh hưởng). Đo `elementFromPoint` sau khi cuộn 120px: trúng TH "Mã ticket" (trước: TD). Không sửa rule riêng ở cskh.css (phiên khác giữ). (2) Đã thử cho bảng cao bằng cả cửa sổ, trang cuộn — chủ dự án bác ("cao quá"), quay lại khung cố định như Labo. `.mkt-screen > .bd-cat-body { padding: 16px 0 0 }`: card thẳng mép toolbar (22→1885px ở 1907px) và chạm đáy khung, áp cho cả 3 tab Marketing. Dưới 768px giữ cuộn cả trang. (3) `ticketColumns.tsx`: cột thời gian 150→170px, Liên hệ gần nhất 180→230px. Đo ở 1907×920 đối chiếu `/labo` (cùng khung `bd-shell-page`, độ trượt 26px có sẵn ở mọi trang). Build production :8357 → host riêng :5001, PostgreSQL thật, không chặn API: `marketing-ticket` + `marketing-ticket-api` **10/10**. `tsc -b` sạch. Retest level **3** cho phần z-index chung (kiểm /labo bằng ảnh + đo) + level 1 cho Marketing. Chưa commit. |

## 2026-10-07 — F-55 Marketing: gọn bộ lọc, bỏ Bộ lọc đã lưu (R-803, R-804)

| ID | Yêu cầu | Xử lý / Kiểm chứng |
|---|---|---|
| R-803 | Chủ dự án (ảnh hàng bộ lọc /marketing/tickets): "filter đang có khá nhiều, bỏ bớt đi". | Giữ 3 bộ lọc: Người phụ trách, Nguồn khách, Thẻ ticket. Bỏ Kênh tiếp nhận (cột Nguồn đã hiện "Nguồn · Kênh") và Loại khách (badge Khách cũ đã nằm trong ô Khách hàng). `TicketFilterBar`: tab trạng thái và 3 bộ lọc chung một hàng `mkt-headgroup` (1907px vừa một hàng; 1440px hai bộ lọc xuống hàng), bảng được thêm chiều cao. `useTicketFilters` bỏ `channel`/`returningCustomer`; `ticketConfig` bỏ `channelOptions`; xoá 3 key i18n `Ticket:Customer:New/All`, `Ticket:Field:Customer`. API giữ nguyên tham số `channel`/`returningCustomer`. FE-only. |
| R-804 | Chủ dự án: "bỏ button Bộ lọc đã lưu đi, trong file chức năng có yêu cầu không?" BA 8.7 chỉ ghi "Lọc Ticket — Lọc theo điều kiện tùy chỉnh", không có lưu bộ lọc → tính năng tự suy ra. | Gỡ trọn lát cắt. FE: `SavedFilterMenu.tsx`, `useSavedTicketFilters`/`useSavedTicketFilterCommands`, `parseSavedFilter`/`serialize` (isFiltered đổi sang so trường), `isStatusTabKey`, CSS `.mkt-saved-filter*`. BE: entity `TicketSavedFilter`, `MarketingTicketFilterAppService` + interface + DTO + controller `api/v1/app/marketing-ticket-filters`, mã lỗi `MarketingTicket:0011` (bỏ trống, không dùng lại), 6 key i18n; bảng `bd_marketing_ticket_saved_filters` gỡ khỏi migration `20261007073431_MarketingTickets` (chưa commit nên sửa thẳng) + Designer + snapshot. `dotnet ef migrations has-pending-model-changes` (có build): không có thay đổi. **DB local** đã chạy migration cũ nên còn bảng mồ côi `bd_marketing_ticket_saved_filters` — vô hại, DB mới sẽ không có. Host `:5000` của phiên khác vẫn chạy dll cũ tới khi restart. Endpoint cũ trả 404 trên host mới. Build production :8357 → host riêng :5001, PostgreSQL thật, không chặn API: `marketing-ticket` + `marketing-ticket-api` + ảnh 1907/1440 **12/12**. `tsc -b`, eslint, build host + Domain.Tests sạch. Retest level **2** (feature Marketing). Chưa commit. |

## 2026-10-07 — F-55 Marketing đợt 2: Chuyển ticket hàng loạt + Ticket File (R-805..R-807)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-805 | BA 8.3 "Chuyển dữ liệu ticket theo điều kiện lọc cho nhân viên xử lý hoặc cho nhóm nhân viên khác" và 8.4 "Quản lý ticket theo file, tình trạng xử lý theo từng file import. Import theo template có sẵn hoặc template tùy chọn. Chia dữ liệu cho nhóm hoặc cho nhân viên" — đợt 2 chưa làm. | BE: `POST marketing-tickets/transfer` (body = bộ lọc danh sách + `assigneeIds` ≥ 1, quyền `transfer`, phạm vi riêng như danh sách, thứ tự Ngày nhận → mã, chia lần lượt `TicketDistribution.AssigneeAt`, bỏ qua ticket đã đúng người, ghi Assigned + tính lại SLA) → `{matched, transferred}`. Entity `TicketImportFile` + `Ticket.ImportFileId`, migration `20261007100854_MarketingTicketFiles` (đã áp DB local). `MarketingTicketFileAppService` (quyền `create`; chia cho nhân viên cần thêm `transfer`): danh sách file + tiến độ theo trạng thái, `template`, `inspect` (đọc header, gợi ý cột theo tên mẫu), import multipart. `TicketFileReader` (ClosedXML, sheet đầu). Mã lỗi 0013 file hỏng, 0014 không có dòng, 0015 chưa ghép Họ tên/SĐT. FE: nút "Chuyển ticket" + `TransferDialog`; tab "Ticket File" `/marketing/files` (`MarketingFilePage`, `ticketFileColumns`); dialog Import 3 bước (`TicketImportDialog`/`Mapping`/`Result`); `?file=` trên danh sách ticket + chip "File: …". "Nhóm nhân viên": BA không định nghĩa nhóm → chọn nhiều nhân viên trong cùng ô, chia đều lần lượt (không dựng thực thể nhóm). Chi tiết `docs/clone/pages/marketing-ticket.md`. |
| R-806 | Import tất cả-hoặc-không: cần quyết định dòng lỗi, SĐT trùng trong file, SĐT đã có ticket đang mở. | Kiểm mọi dòng trước; một dòng lỗi → không ghi gì (cả file), trả `{committed:false, errors:[{row, errors[]}]}` theo số dòng Excel, thông báo đã dịch (`Ticket:Import:Err:*`). SĐT trùng trong file = lỗi "trùng với dòng N". SĐT đã có ticket mở = Phát sinh lại trên ticket cũ (đếm "Khách liên hệ lại"), không tạo ticket mới. Ticket mới của file: Kênh = File, Nguồn/Thẻ/Chia cho của file. |
| R-807 | e2e thật cho đợt 2. Lần chạy chung đầu tiên đỏ ca Chuyển ticket (timeout): ô Chuyển cho là danh sách ảo, spec khác vừa thêm nhân viên (`BAC SI …`) nên tên cần chọn nằm ngoài vùng hiển thị. | Spec mới `marketing-ticket-files-api.spec.ts` (4) + `marketing-ticket-files.spec.ts` (3); fixture thêm `FILES`, `staffOf`, `ticketsWhere`, `ticketWorkbook(Buffer)`, `uploadTicketFile` (fetch multipart trong trang + XSRF + `Accept-Language: vi`). `pick()` gõ tên vào ô tìm trước khi bấm `.ant-select-item-option`. Build production :8357 → host riêng :5001, PostgreSQL thật, không chặn API: `marketing-ticket` + `marketing-ticket-api` + 2 spec mới **17/17**. Domain.Tests (Marketing + abilities) **50/50**, `tsc -b` + eslint sạch. Retest level **2** (feature Marketing). Chưa commit. |

## 2026-10-07 — F-55 Marketing: chi tiết ticket chuyển từ drawer sang modal (R-808)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-808 | Owner: chi tiết ticket nên là modal như phần lớn hệ thống (không phải drawer); Thông tin ở trên, Lịch sử chăm sóc ở dưới; modal rộng và cao hơn; các field xếp dạng lưới như các modal chi tiết khác; action xuống footer; bỏ nút Đóng ở footer (đã có X góc trên). Lần đầu đổi sang modal, e2e đỏ vì các nút action nằm trong `title` → tên truy cập của dialog thành `TK… · Tên Ghi nhận liên hệ Đặt lịch hẹn Thêm`. | `TicketDetailDrawer` → `TicketDetailDialog` (AntD `Modal`, `app-dialog`, rộng `min(1120px, 100vw - 32px)`, `centered`): tiêu đề chỉ là `h2` (KHÔNG đặt nút trong title của Modal — nó thành tên dialog); khối "Thông tin ticket" là lưới `dl.mkt-detail-fields` 3 cột (2 cột ≤1100px, 1 cột ≤640px), nhãn trên giá trị, Ghi chú chiếm cả hàng; "Lịch sử chăm sóc" bên dưới. `TicketDetailFooter` mới: Xoá (danger) bên trái; Chỉnh sửa, Chuyển người phụ trách, Không tiềm năng / Mở lại, Nhận, Ghi nhận liên hệ, Đặt lịch hẹn (primary) bên phải — cùng điều kiện hiện như `TicketRowActions`, ẩn hết khi ticket đã xoá. Nút X góc của app tên "Đóng" (không phải "Close"). e2e `marketing-ticket` sửa theo; 4 spec Marketing **17/17** trên build production :8357 → host :5001, PostgreSQL thật, không chặn API. `tsc -b` + eslint sạch. Retest level **2**. Chưa commit. |

## 2026-10-07 — F-56 Phát Hành in PHIẾU THU (PDF) + ô "Xuất hóa đơn đỏ" (R-809..R-813, R-815)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-809 | BA: bấm Phát Hành ở hộp thoại "Hóa đơn" luôn in PHIẾU THU theo mẫu `PHIẾU THU.docx` (mẫu chưa có placeholder); thêm ô "Xuất hóa đơn đỏ" — tick thì ký thêm HĐĐT; phiếu thu không sửa được trên PDF, sai thì sửa dữ liệu rồi in lại. Lưu Nháp giữ nguyên (chỉ lưu nháp EasyInvoice, không in, không liên quan ô tick). | Mẫu thêm 9 placeholder phần thân (`CustomerName`, `TreatmentWork`, `PaidAmount`, `PaidAmountInWords`, `RemainingAmount`, `RemainingAmountInWords`, `PayerName`, `IssueDate`, `CashierName`), mỗi key nằm trọn một run Word. BE: `Printing/DocxTemplate` (OpenXml 3.1.1, thay `{{Key}}`, XML-escape), `PaymentReceiptContent` (tiền `1.234.568 đ`, chữ tiếng Việt), `GotenbergPdfConverter` (`POST /forms/libreoffice/convert`), `RenderReceiptAsync` + `POST api/v1/app/e-invoices/receipt-pdf` (quyền `payment.finalize`, cùng trần tiền `EInvoicing:0010`, phiếu không phải Payment `ReceiptNotInvoiceable`), lỗi `PaymentReceipt:0001/0002` (thiếu mẫu / Gotenberg lỗi). Thanh toán = thành tiền sau thuế của các dòng tick; Người nộp tiền = họ tên bệnh nhân; Ngày lập phiếu = ngày hoá đơn hoặc hôm nay (giờ VN); Người lập phiếu = họ tên người đăng nhập. docker-compose thêm service `gotenberg` (gotenberg/gotenberg:8, cổng máy 13000 → container 3000, đổi được bằng `GOTENBERG_PORT`; healthcheck) và `PaymentReceipt__GotenbergUrl: http://gotenberg:3000` cho api. FE: `useRenderPaymentReceipt` (blob), `useInvoiceIssue` (Phát Hành = `Promise.allSettled` phiếu thu + HĐĐT nếu tick), `InvoiceModal` footer có Checkbox. |
| R-810 | Sau khi tạo `wwwroot/`, mọi request API trả 500: ABP kiểm `wwwroot/libs` lúc khởi động (`AbpMvcLibsOptions.CheckLibs`). Sau đó lại 500 `No service for type IDocxPdfConverter`. | `Configure<AbpMvcLibsOptions>(o => o.CheckLibs = false)` trong `BlueDentalHttpApiHostModule` (host không phục vụ thư viện client). ABP chỉ tự đăng ký interface trùng tên lớp (`IGotenbergPdfConverter`) → thêm `[ExposeServices(typeof(IDocxPdfConverter))]` + test `Gotenberg_Is_Registered_As_The_Docx_Pdf_Converter`. Gotenberg URL mặc định `http://127.0.0.1:13000` (owner: 3000 dễ trùng cổng dev server khác → đổi sang 13000; spec chạy lại 3/3) (không dùng `localhost` — IPv6 ::1 treo, như MinIO R-520). |
| R-811 | Owner: xem phiếu thu ở tab riêng, không phải modal. Tab mở sau khi PDF về bị trình duyệt chặn (không còn trong cử chỉ click). | `openReceiptTab()` gọi `window.open("", "_blank")` **đồng bộ** trong click, ghi "Đang tạo phiếu thu…", PDF về thì `tab.location.href = blobURL` (thu hồi sau 10 phút); lỗi thì đóng tab. Không có tab (bị chặn) → thử mở lại, vẫn bị chặn → toast `Treatment:PaymentReceipt:PopupBlocked`. Lỗi API của request `responseType: "blob"` phải đọc lại JSON từ Blob (`withReadableError`) để toast toàn cục hiện đúng thông báo ABP. Phát Hành không tick → hộp thoại vẫn mở để sửa và in lại; tick và ký thành công → đóng như cũ. |
| R-812 | e2e: lần đầu không thấy ô "Xuất hóa đơn đỏ" — cổng 8091 đang là `vite preview` của phiên khác (bản build cũ), preview của mình báo "Port 8091 is already in use" mà lệnh vẫn chạy tiếp. Sau đó tab mới đứng ở `about:blank`. | Kiểm `index-*.js` mà cổng trả về so với `dist-*/assets` trước khi chạy spec; dùng cổng trống (:8098). Headless Chromium không có trình xem PDF → điều hướng tab tới blob PDF thành **download** của tab đó, URL tab giữ `about:blank`; spec chấp nhận một trong hai (URL tab `blob:` hoặc `download.url()` là `blob:`). Không tick "Xuất hóa đơn đỏ" trong e2e (sẽ ký HĐĐT thật trên nhà cung cấp). |
| R-813 | Bằng chứng. | Build production :8098 → host :5000 → PostgreSQL + Gotenberg thật, không chặn API: `payment-receipt-pdf` **3/3**; hồi quy mức 3 (InvoiceModal dùng chung): `billing-ledger` + `einvoice-api` + `payment-permission-buttons` + `vat-payment-einvoice-api` **13/13**, `treatment-plan` **9/9**. Application.Tests `PaymentReceiptTemplateTests` + `ElectronicInvoiceAppServiceContractTests` **15/15**. Mẫu chưa điền đổi qua Gotenberg ra PDF đúng dấu tiếng Việt, logo, bố cục. Retest level **3**. Chưa commit (`wwwroot/` và `Printing/` đang untracked). |
| R-815 | Chủ dự án: điền dữ liệu vào phiếu thu nhưng dãy "......" sau giá trị vẫn còn (bên LMS điền là mất chấm). | Chấm trong mẫu không phải ký tự mà là **tab stop có `w:leader="dot"`**, nên cách thay chuỗi chấm của LMS (`MergeDotsWithPlaceholders`) không áp được. `DocxTemplate.Fill` giữ nguyên tab (cột "Viết bằng chữ" không lệch) và đặt `Leader=None` cho tab stop ngay sau placeholder có giá trị; giá trị rỗng giữ chấm để viết tay. Unit test `A_Filled_Placeholder_Drops_The_Dots_After_It_And_A_Blank_One_Keeps_Them` (16/16 cùng contract tests). Đã đổi PDF mẫu qua Gotenberg và xem bằng mắt: không còn chấm, cột thẳng. Retest level **2**. |
## 2026-10-07 — Cụm 11 mục 5–6: Bảng lương (R-814, F-57)

Quyết định ghi ở `docs/clone/pages/payroll.md`.

| ID | Vấn đề / yêu cầu | Xử lý |
|---|---|---|
| R-814 | Rà bảo mật trước khi push: `SetCompensationAsync` bỏ qua kiểm tra chi nhánh khi nhân viên đích không gán chi nhánh nào, nên quản lý một chi nhánh đặt được lương cho tài khoản toàn phòng khám (admin, quản lý phòng khám). | Nhân viên không gán chi nhánh chỉ người toàn phòng khám mới đặt lương; kiểm tra trước khi đọc tài khoản. e2e thêm ca 403. |

Ghi chú môi trường: DbMigrator local hỏng ở seed demo (`SlotInThePast`, có từ trước) nên seed quyền bị rollback — quyền `payroll.*`
cho 3 vai trò tĩnh được cấp ở local qua API permission-management; production bỏ qua seed demo nên seed quyền chạy bình thường.
Kiểm chứng (build production :8080, API thật :5000, PostgreSQL thật, không chặn API): `payroll` **3/3**.
BE: Domain.Tests **726** (mới `PayrollTests` 16, catalog 89 subject), Application.Tests **676**, HttpApi.Host.Tests **24**. Migration `Payroll` tạo 3 bảng.
Hồi quy (`staff`, `staff-penalty`, `staff-penalty-api`, `staff-day-off-api`, `timekeeping-api`, `timekeeping-leave`, `role-permissions-tree`,
`role-permissions-unsaved`, `payroll`, `discount-limit`): **25/25**. tsc + eslint sạch. Retest level **3**.

## 2026-10-08 — Hồ sơ bệnh nhân: "Quay lại" về nơi xuất phát (R-816)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-816 | Chủ dự án: bấm tên bệnh nhân trên thẻ Tiếp nhận mở hồ sơ, bấm "Quay lại" lại về danh sách Bệnh nhân thay vì Tiếp nhận. Chốt: áp dụng mọi nơi mở hồ sơ, nút luôn về nơi xuất phát, màn hình quay về ở trạng thái mặc định (Tiếp nhận = hôm nay, không giữ bộ lọc). | Không truyền router state qua từng link (tab hồ sơ, trang kế hoạch, đồng bộ `branchId` trong AppLayout bằng `history.replaceState(null…)` đều làm rơi state). `src/hooks/usePatientOrigin.ts`: `useTrackPatientOrigin()` chạy trong AppLayout, khi URL vào `/patient/:id…` từ một trang không thuộc cùng bệnh nhân thì ghi trang trước (pathname + search) vào sessionStorage `bd.patientOrigin.<id>`; đi lại trong cùng hồ sơ (tab, view, kế hoạch điều trị) giữ nguyên; reload giữ nguyên. `PatientProfilePage` "Quay lại" đọc `readPatientOrigin(id)`, không có thì về `/patient` như cũ. e2e `patient-back-origin` (build production :8093, API thật :5000, PostgreSQL thật, không chặn API): Tiếp nhận → tên → đổi tab + reload → Quay lại = `/reception`; Lịch hẹn → tìm kiếm Ctrl K → hồ sơ → Quay lại = `/calendar`; danh sách → hồ sơ → Quay lại = `/patient`; link trần ở tab mới → `/patient`. **4/4**, chạy 2 lần. tsc + eslint sạch. Retest level **2**. Ghi chú: `appointment-patient-link` đỏ ở bước tìm thẻ tuần theo `searchKey` (0 thẻ), trước khi chạm tới hồ sơ — chưa đối chiếu với HEAD. |

## 2026-10-08 — F-56: "Xuất hóa đơn đỏ" bắt buộc thông tin người mua (R-817)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-817 | BA (ảnh chụp hộp thoại "Hóa đơn"): tick "Xuất hóa đơn đỏ" thì Tên khách hàng, Mã số thuế, Số ĐT, Email bắt buộc nhập. | FE: tick → 4 ô hiện dấu `*` (`FloatingLabel required`); bấm Phát Hành khi còn ô trống → lỗi đỏ dưới từng ô ("Vui lòng nhập …", `aria-invalid`), không mở xác nhận, không gửi request nào (không in phiếu thu, không gọi EasyInvoice); gõ vào ô thì lỗi ô đó mất, bỏ tick thì mất hết. Lưu Nháp không bị ràng buộc (quyết định cũ: Lưu Nháp không liên quan ô tick). Luật ở `redInvoiceRules.ts`, `useInvoiceIssue` (`redInvoiceComplete`, `showRequiredErrors`), ô nhập có `aria-label` (nhãn nổi là `<span>` không gắn với input). BE: `IssueAsync` với `publish=true` thiếu một trong 4 trường (rỗng/khoảng trắng) → `BlueDental:EInvoicing:0017` **trước** khi đọc tài khoản/gọi nhà cung cấp. e2e `payment-receipt-pdf` (build production :8098, API thật :5000, PostgreSQL + Gotenberg thật, không chặn API) thêm ca 4: API trả 0017, UI dấu `*` 0→4, lỗi + không request, xoá lỗi khi gõ/bỏ tick — **4/4**. tsc + eslint sạch. Retest level **2**. Chưa commit. |

## 2026-10-08 — F-58 Đơn thuốc: chẩn đoán chọn từ phiếu điều trị + liều Sáng/Trưa/Chiều/Tối (R-818..R-822)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-818 | BA (mock `P0710.drawio`): dialog "Thêm/Cập nhật đơn thuốc" bỏ ô chữ "Nhập chẩn đoán", chọn chẩn đoán từ phiếu điều trị của bệnh nhân; ghi chú chẩn đoán tự lấy từ phiếu gốc; liều Sáng/Trưa/Chiều/Tối thay "Ngày uống × Mỗi lần". Chủ dự án chốt: 1 dòng = 1 chẩn đoán trong 1 phiếu (gộp răng), lưu liên kết + chữ in, lấy mọi phiếu trừ phiếu đã hủy, liều theo buổi chỉ ở màn Đơn thuốc (Đơn thuốc mẫu giữ nguyên). | BE: `PrescriptionItem` Morning/Noon/Afternoon/Evening, `Quantity = tổng × Days`; `PrescriptionDiagnosis` (liên kết + snapshot PlanCode/DiagnosisName/ToothCodes, server tự dựng từ DB), `DiagnosisNote`, `DiagnosisText` 2000; `GET prescriptions/diagnosis-sources` (bỏ phiếu Cancelled, dòng Cancelled/Replaced/Transferred, chẩn đoán dòng → advise, ghi chú dòng → phiếu chẩn đoán); mã lỗi `Treatment:0044` (phiếu không thuộc bệnh nhân/chi nhánh hoặc không có chẩn đoán đó), `0045` (trùng cặp); migration `20261007204945_PrescriptionDiagnosesAndDailyDoses` backfill giữ nguyên số lượng (1→S, 2→S+T, 3→S+Tr+T, 4→cả 4, dư dồn vào S). FE: `prescription-dialog/` (RxDiagnosisSection, RxTreatmentSlipPicker, RxDiagnosisTable, RxIcdSearch UI-only, RxMedicineTable/Card), `useRxDiagnosisSelection` (ghi chú điền lại đến khi bác sĩ tự gõ), `rxDose.doseFromTemplate` đổi Đơn thuốc mẫu khi chọn, bản in "Sáng 1 · Tối 1 · 5 ngày". Domain 27, EF 8, Application 18 xanh. e2e `prescription` **7/7** + `prescription-allergy` **2/2** (build production :8081, host :5000, PostgreSQL thật, không chặn API). Retest mức **3**. Chưa commit. |
| R-819 | `e2e/prescription-allergy.spec.ts` import `./fixtures/catalogApi` nhưng file chưa từng được commit → spec hỏng ngay ở HEAD; sau F-58 spec còn gõ vào ô "Nhập chẩn đoán" đã bỏ và tìm dòng theo ghi chú (danh sách không có cột đó). | Tạo `e2e/fixtures/catalogApi.ts` (`call<T>` gọi API thật trong trang đã đăng nhập, kèm `X-Clinic-Branch-Id` + Accept JSON; `BRANCH_ONE`, `TAXONOMIES`, `ENTRIES`). Spec gõ "Nhập lời dặn", tìm dòng theo `code` trong response POST. **2/2**. |
| R-820 | Kiểm tra trực quan 390px: ô lọc trong panel "Danh mục ICD-10" bị ép thành biểu tượng; thẻ thuốc hiện liều "1.0 / 0.0". | `≤640px`: `.rx-slip-panel-head` wrap, `.rx-slip-filter` `flex: 1 1 100%; order: 3` (hàng riêng dưới tiêu đề); `plainDose` dùng chung cho bảng và thẻ (`formatter`). Chụp lại desktop 1440 + mobile 390: đúng. Bảng chẩn đoán đã chọn cuộn ngang trên mobile — chấp nhận. |
| R-821 | Hạ tầng: (1) thư mục `dist-*` của một `vite preview` đang chạy bị build đè → `index.html` 200 nhưng mọi asset 404, trang trắng, spec timeout ở form đăng nhập; (2) `vite preview` mồ côi sau TaskStop giữ cổng (`--strictPort` báo in use); (3) host API :5000 bị phiên khác tắt giữa chừng → trang đăng nhập không lên (proxy ECONNREFUSED), test đỏ ở `login`. | Mỗi lần build ra thư mục mới (`dist-f58y`), giết mồ côi theo command line (`Get-CimInstance Win32_Process` khớp `preview --outDir dist-…`); trước khi chạy spec kiểm `curl :5000` — chết thì `dotnet run --project src/BlueDental.HttpApi.Host` rồi chạy lại. |
| R-822 | Hồi quy mức 3: `taxonomy-dialogs` đỏ 2 ca ("a service keeps its price configuration…" không thấy NCC Labo vừa tạo; "the API refuses a labo supplier…" — "the branch should have a service group"). | Không liên quan F-58 (không đổi `features/taxonomy`, `src/components`, `Catalogs`). `currentBranchId` lấy `accessible[0]` = chi nhánh rác của phiên khác (`E2EBR321942` / `DANHTEST01`, tạo 2026-10-06, **0** nhóm `care_service`) — cùng gotcha đã ghi ở R-771. taxonomy-dialogs/flat/import-api **19/21**. |

## 2026-10-08 — F-58: panel "Phiếu điều trị" trống dù bệnh nhân có phiếu (R-823)

| ID | Vấn đề / yêu cầu | Xử lý & bằng chứng |
|---|---|---|
| R-823 | Chủ dự án (ảnh chụp): bệnh nhân có nhiều phiếu điều trị nhưng panel "Danh mục ICD-10" hiện "Phiếu điều trị 0 — Bệnh nhân chưa có phiếu điều trị có chẩn đoán". | Đối chiếu DB + log host: lúc mở dialog (04:42), 7 phiếu DT01–DT07 đều sinh từ tư vấn **không chọn chẩn đoán** (advise `DiagnosisId` null, không có phiếu CD, dòng không có `DiagnosisId`) → đúng luật F-58 (dòng không chẩn đoán thì bỏ). Phiếu chẩn đoán CD26-0249 và DT08 (2 dòng, 1 dòng mang "Chẩn đoán …", răng 14/17) được tạo sau đó (04:43–04:44). Lỗi thật đi kèm: `usePrescriptionDiagnosisSources` dùng `staleTime` mặc định 5 phút của queryClient → mở lại dialog trong 5 phút sau khi tạo phiếu ở tab khác vẫn thấy danh sách cũ. Sửa: `staleTime: 0` (mỗi lần mở dialog đều tải lại). tsc sạch. Retest mức **2**: chưa chạy lại e2e (preview :8080 của phiên khác đang trắng). Chưa commit. |
| R-824 | Chủ dự án (ảnh mock): panel "Danh mục ICD-10" trong mock nhóm theo thời gian ("Buổi điều trị hôm nay · 3 mã"), còn bản dựng nhóm theo phiếu ("DT01 · 08/10/2026"), nên số phiếu bị lặp giữa tiêu đề và tag. | Đổi sang nhóm theo **ngày mở phiếu** (giờ máy khách), mới nhất trước: "Buổi điều trị hôm nay · n chẩn đoán" / "Buổi điều trị dd/MM/yyyy · n chẩn đoán". Số phiếu chỉ còn ở tag của từng dòng. `groupBySlip` → `groupBySession` (`utils/rxDiagnosis.ts`). Thêm key i18n `Treatment:Rx:SessionToday/SessionOn/SessionUndated`, bỏ `SlipHeading`. tsc sạch. Spec thêm kiểm tra tiêu đề "Buổi điều trị hôm nay · n chẩn đoán". Bản build production (:8083) + API :5000: `prescription.spec.ts` **7/7**, `prescription-allergy.spec.ts` **2/2**. (Chạy riêng một test bằng `-g` có lần đỏ ở bước chờ GET khi mở tab — chạy cả file thì xanh, không liên quan thay đổi.) Chưa commit. |
| R-825 | Chủ dự án: "Ghi chú chẩn đoán" điền tự động từ nhiều ghi chú, mỗi ghi chú một dòng — thêm "- " đầu mỗi dòng cho dễ đọc khi ghi chú dài tự xuống dòng. | `mergedNotes` (`utils/rxDiagnosis.ts`): **từ 2 ghi chú trở lên** mỗi dòng bắt đầu bằng "- "; chỉ 1 ghi chú thì để trơn. Vẫn bỏ trùng theo nội dung. Chỉ là chữ điền sẵn — bác sĩ sửa tự do, server lưu đúng như gửi. Spec: tick 1 chẩn đoán → ghi chú trơn, tick 2 → có "- "; POST, bỏ/tick lại và mở Sửa đều kiểm tra dạng mới. Build production (:8083) + API :5000: `prescription.spec.ts` **7/7**, `prescription-allergy.spec.ts` **2/2**. Chưa commit. |
