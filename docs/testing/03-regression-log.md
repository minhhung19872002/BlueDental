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

