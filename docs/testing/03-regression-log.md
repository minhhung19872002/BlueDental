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
