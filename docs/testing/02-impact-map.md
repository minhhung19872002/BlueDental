# Impact Map

What to retest when a shared piece changes. Levels are defined in
`00-test-policy.md`.

## Shared dependencies → dependent features

| Change here | Level | Retest |
|-------------|-------|--------|
| `lib/axios.ts` (API client, auth interceptor) | 3 | Every acceptance spec |
| `features/auth/*`, `AccountAppService` | 3 | Every acceptance spec |
| `BlueDentalAbilities` / `BlueDentalAbilityPermissions` / permission provider | 3 | Every acceptance spec — a missing grant is a 403 on every screen |
| `BlueDentalAbilitySeedContributor` | 3 | Every acceptance spec |
| `lib/clinicBranch.ts` (branch scope, branch store) | 3 | F-30 first, then F-02, F-03, F-04, F-05, F-06, F-08, F-12..F-15, F-19, F-20 — every screen reads its branch from here |
| `BranchAccessChecker` / `StaffBranchAssignment` | 3 | F-20 first, then every branch-scoped spec |
| `BlueDentalCatalogSeedContributor` (seeded chẩn đoán + dịch vụ) | 3 | F-09, F-19 — the clinical chain starts from those two entries |
| `BlueDentalTaxonomyDemoSeedContributor` (both branches' catalogs, tags, payment accounts) | 2 | F-02, F-29, F-30 — those specs assert on seeded group names per branch |
| `BlueDentalBranchSeedContributor` (second branch, `branch2`, `manager`) | 3 | F-30 first, then F-20 and every branch-scoped spec |
| `app/AppLayout.tsx` (nav rail, header, branch switcher) | 3 | F-30 first, then any spec that navigates through the chrome |
| `BlueDentalDbContext` / model-creating extensions | 3 | Every spec touching persistence |
| Global exception handling, `apiError.ts` | 3 | Every spec that asserts an error message |
| `components/` shared UI (tables, modals, selects) | 2 per consumer | Specs of the screens using them |
| `vite.config.ts` build plugins (Tailwind, React) | 3 | Every acceptance spec — the plugin list decides whether utility classes are compiled at all |
| `styles/index.css` `@theme` tokens and overlay z-index | 3 | Every spec that opens a dialog, sheet, popover or dropdown |

## Feature-local dependencies

| Change here | Level | Retest |
|-------------|-------|--------|
| `Catalogs` domain / `TaxonomyAppService` / `CatalogEntryAppService` | 2 | F-02, F-32 |
| `hooks/useDragReorder.ts` | 2 per consumer | F-32 (group panel) and F-02 (entry table) — both order their rows through it |
| `components/FloatingField.tsx` | 2 per consumer | F-32 — the group dialog's two fields |
| `PaymentAccount` domain / `PaymentAccountAppService` (incl. QR blob handling) | 2 | F-29, F-31 |
| `CatalogServiceConfig` / `CatalogMedicine` / `CatalogServiceStage` / `PrescriptionTemplateLine` | 2 | F-34, and F-19 for the image requirement |
| `components/AppDialog.tsx`, `FloatingField`, `FloatingSelect`, `RichTextField` | 2 per consumer | F-32, F-34 |
| `TaxonomyGroupAbilities` | 3 | F-02 (all twelve catalogs are gated through it) |
| `Timekeeping` domain / `TimeKeepingAppService` | 2 | F-03 |
| `Finance` domain / `SalesEntryAppService` | 2 | F-04, and F-17 if totals are shared |
| `CashManagementAppService` | 2 | F-05 |
| `PatientAppService`, patient adapters/types | 2 | F-06, F-07 |
| `ToothSelection` value object | 2 | F-07, F-09 |
| `PatientAdvise` / `PatientDiagnosis` | 2 | F-07, F-09 |
| `Voucher` domain | 2 | F-08, and F-09 (advises can carry a voucher discount) |
| `CareRecord` / `CustomerCareAppService` | 2 | F-12 |
| `LaboOrder` / `LaboAppService` | 3 | F-13, and F-38 — "Tạo Labo" on a công đoạn opens the same Đặt mới form and posts the same contract |
| `InventoryItem` / `SuppliesAppService` | 2 | F-14 |
| `OperationsArticle` / `OperationsTask` / `OperationsAbilities` | 2 | F-15 |
| `TreatmentStage` domain / `TreatmentStageAppService` | 3 | F-19, F-38 (the Hồ sơ treatment table's Công đoạn cell and "Chi tiết phiếu"), F-13 — a labo order now names the công đoạn it was raised from. `MoveServiceLineAsync` runs **both ways** since the revert landed: completing or re-opening a công đoạn moves its service line and can open or close the whole slip, so a change here moves F-21/F-22 (plan + invoice status) and the money rollup with it |
| `PatientReExamination` / `PatientReExaminationAppService` | 2 | F-38 only, for now — a tái khám is a **row of its own** on the Hồ sơ treatment table (`type: "re_examination"`), so `buildTreatmentRows` and `treatmentColumns` move with it. It reads the source công đoạn on create and flips that stage's `HasReExamination`, and takes the row's SL off the service line's `Quantity`, so a change to `TreatmentStage` or `TreatmentService` can break it without touching this file. Gated by the **công đoạn** abilities (`read`/`complete`/`update`) — the reference has none of its own — so an ability rename lands here too |
| `plan/planTypes.ts` → `planDetailPath` | 3 | F-38, F-21, F-39 — every jump to a slip's own screen goes through it. Its `tab` argument is **optional on purpose**: the DT code chip omits `planTab`, the stage dialog's Thanh toán writes `planTab=detail`, and the reference really does differ between the two (measured 2026-09-07). Making it always write the tab would silently change F-21's verified URLs. |
| `stage/reExaminationChecklist.ts` + `StageStepList`'s `tone` | 2 | F-38 — the one entry both tái khám screens list under "Danh sách công đoạn". It is built from the công đoạn's **note**, not from the service's steps, so it moves with `TreatmentStageDto.note` rather than with the catalog. `StageStepList` is shared with the Chi tiết phiếu form and history row, where the same heading **does** mean the service's steps — changing that component touches both meanings. |
| `stage/useStageComposer.ts` — `closedLineIds` / `inTab` | 2 | F-38 — the **single** place that decides which of "THÊM CÔNG ĐOẠN" / "TIẾP TỤC CÔNG ĐOẠN" a service line belongs to, and it feeds three things at once: the tab counts, the `Chi tiết` picker, and (through `offered`) whether the form may stand at all. Membership is read off the line's **live** công đoạn — the newest one — because `StageHistory` disables `Hoàn thành` on every earlier row, so a rule keyed off *all* stages would strand a line in the tab with no way to close it (R-283). It therefore moves with `liveStages`, which `StageHistory` also consumes: changing "which công đoạn is live" changes both the picker and the history's greying at once |
| `TreatmentStage.Complete()` — the image gate that was removed | 3 | F-19, F-38, and every e2e fixture that needs a **closable** công đoạn. It used to throw `BlueDental:Treatment:0019` when the service carried "Yêu cầu hình ảnh khi điều trị" and no picture was attached — an invented rule, gone since R-287 because the reference closes a công đoạn with no image. `CatalogServiceConfig.RequireImage` (settled /taxonomy screen) and `TreatmentStage.IsImageRequired` both stay: the flag is **recorded and shown as a hint**, never enforced. Do not re-add a block without an observation — `docs/clone/unknowns.md` holds the open question of what the flag really drives |
| `TreatmentServiceDto.Note` vs `.StageNotes` | 2 | F-38, F-39 — **two different notes, and they are not interchangeable**. `Note` is the service line's own (from "Thêm dịch vụ mới"); `StageNotes` is the roll-up of its công đoạn's notes. "Chi tiết dịch vụ" prints `Note` (OBSERVED 2026-09-07 — the reference's `GET /v1/treatment-services/{id}` carries both and the dialog printed the document's own), while `PlanSummaryCards` deliberately takes `stageNotes.at(-1)` for a stage-driven column. Joining the roll-up into a plan field grew it by a clause per công đoạn forever (R-291), so check which of the two a new field means before wiring it |
| `stage/stageFieldErrors.ts` | 2 | F-38 — the required-field rule (Bác sĩ · Răng · Nội dung điều trị) and its wording, shared by the công đoạn form and both follow-up forms (Tạo bảo hành / Tạo tái khám). One module so the three cannot drift apart; the teeth check is passed in because each form gets its teeth differently (the công đoạn form inherits the line's, a tái khám picks among them, a bảo hành cannot get them wrong). Messages render as `.pd-stage-error` under the field — never a toast — so the specs assert on that class in both places |
| `stageRowStatus.ts` | 2 | F-38 — the **single** source for what status a treatment row shows and what it is called. Both the table chip (`.pd-tr-chip--*`) and the printed sheet's pill (`.pd-print-chip--*`) read it, so a change here moves both at once. The two CSS sets carry the reference's **own** colour pairs, measured 2026-09-07, and are deliberately different from each other and from the `--bd-*` palette — do not fold them together or onto the app's tokens (R-274…R-276). Adding a status means adding both classes |
| `StageStepList` + `TreatmentStage.ServiceItems` | 3 | F-38, and **F-05 Danh mục** — the step names and their order come from `CatalogServiceStage`, so renaming or reordering a service’s công đoạn in /taxonomy changes what this screen lists. One component serves two places (the công đoạn form picks the steps, the history row ticks them off), so a change moves both. The PUT takes the **whole** list — a step left out comes back unticked — which is what makes one endpoint turn both ways; do not narrow it to a single step (R-278…R-281). Untouched on purpose: the commission each step carries, which would pull payroll in |
| `.pd-print-sheet` + the `@media print` block | 2 | F-38 — the sheet is portaled to `document.body` on purpose. Moving it back inside the Modal breaks printing silently: AntD's portal wrapper becomes a `display: none` ancestor and the preview comes out blank with no error (R-277). The spec `In Phiếu prints the A4 sheet, not the dialog` asserts `body > .pd-print-sheet` for exactly this reason |
| `TreatmentPlan` / `TreatmentService` / `PatientMoneyCalculator` | 3 | F-19, F-21, F-22, F-17, F-18 — the money rollup feeds the reports; F-39 reads the same slip and the five head figures come from `payment{}` |
| `PatientPayment` / `PatientPaymentLine` | 3 | F-22, F-17, F-18, F-38, F-39 — a receipt's **lines** drive each service's Đã thu / Còn nợ, so touching them moves the Hồ sơ treatment table, the plan-detail Thanh toán / Hoàn tiền tabs and both reports; the refund dialog relies on `paidAmount` being **net** of refunds |
| `features/treatment-management/components/plan-detail/`, `CreatePaymentDialog` (shared with the Hồ sơ tab), `utils/moneyWords.ts`, `hooks/useBranchInfo.ts` (letterhead) | 2 | F-39; F-38 when the payment dialog changes (it imports `patient-detail.css` itself since R-246); F-21 for the links into the page; the printed "In lịch sử điều trị" sheet shares `useBranchInfo` |
| `Prescription` / `PrescriptionAppService` | 2 | F-23 |
| `patient-detail.css` — the `.pd-labo-*` / `.pd-stage-*` block | 2 | F-38, **and the Labo tab's "Tạo phiếu Labo" dialog** (`PatientRecordDialogs`). The two share class names: `.pd-labo-grid` was declared twice in this one file, three columns for the 1180px dialog and two for "Đặt mới", and the later rule silently won for both (R-236). Scope a new rule to the dialog that needs it, and grep the file for the class name before adding one |
| `BlueDentalDemoSeedContributor` — appointment slot allocation | 3 | Every spec that picks an appointment out of demo data (F-10, F-38, the reception steps). The seeder must not write states the aggregate refuses on update: reserving only `(dentist, slot)` and drawing the patient afterwards left 206 patient-overlapping pairs, and `HasPatientConflictAsync` then blocked every edit of those cards (R-241). After changing it, re-seed and re-count overlaps |
| `src/components/prescription-lines/` (shared line editor) | 3 | F-23 and F-34 (Đơn thuốc mẫu dialog) |
| `PatientImage` / blob storage / `patient-images` reorder | 2 | F-24, and the Chẩn đoán & Tư vấn tab's "Chọn ảnh hiển thị" picker, which reads the same list |
| `AccountAppService` (`current-user`, granted permissions) | 3 | F-24 and any screen that hides a control by permission; the login flow itself (F-01) |
| `Visit` / `VisitAppService` | 2 | F-11 |
| `Appointment` / appointment adapters | 3 | F-10, and the patient Lịch hẹn tab |
| `StaffAppService` / identity | 3 | F-25, and every screen that picks a dentist |
| `ClinicReportAppService` | 2 | F-17, F-18 |
| Localization resources (`en.json` / `vi.json`) | 3 | Every spec that asserts a refusal message |

## Cross-feature couplings worth remembering

- **Pending expenses**: `SalesEntry.CountsTowardsCashflow` decides whether a
  voucher reaches the totals. Changing it affects F-04 and any report that sums
  vouchers.
- **The money rollup**: `PaymentSummary` is derived on every read from the slips
  and the money movements, so a change to `TreatmentPlan.CompletedValue` or to
  `PatientPayment` moves the patient account, the treatment table and both
  reports at once.
- **A receipt covers several services**: one `PatientPayment` carries a
  `PatientPaymentLine` per service, and the server — not the browser — decides
  the split in Tự động mode. Anything that changes how a line's outstanding is
  computed therefore changes what a *new* receipt allocates, not only what the
  old ones display.
- **The clinical chain**: công đoạn hangs off a service line, and a service line is
  an *accepted* `PatientAdvise`, which in turn answers a `PatientDiagnosis`.
  Changing any link breaks F-19 even though nothing in the stage code moved.
- **Patient code**: generated per branch and year with a uniqueness walk. A change
  there can collide on the unique index and break F-06 only under repetition —
  run the spec twice.
- **Tooth surfaces**: the UI, the DTO and the domain value object share one shape.
  Changing any one of them breaks F-07 silently unless all three move together.
- **Branch scope**: every list endpoint filters by `ClinicBranchId`. A regression
  shows up as "empty screen", not as an error.

- **i18n (`lib/i18n.tsx`)**: every visible string on every screen goes through
  `t()`, so this is a Level 3 dependency — a change here can blank the whole app
  (the provider withholds children until the overlay resolves). Two rules the
  code depends on:
  - `t()` must never be called at module scope. A module constant is evaluated
    once, at import time, before the overlay is fetched, and is not re-evaluated
    when the language changes — so its labels freeze in whatever language loaded
    first. Label maps are therefore builder functions (`statusConfig()`), not
    constants.
  - The English overlay lives in the **backend** resource
    `BlueDental.Domain.Shared/Localization/BlueDental/en.json` and ships as an
    embedded resource. Adding a key means rebuilding and restarting the API, not
    just the frontend — a missing key silently falls back to Vietnamese.

