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
