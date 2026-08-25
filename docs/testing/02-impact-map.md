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
| `LaboOrder` / `LaboAppService` | 2 | F-13 |
| `InventoryItem` / `SuppliesAppService` | 2 | F-14 |
| `OperationsArticle` / `OperationsTask` / `OperationsAbilities` | 2 | F-15 |
| `TreatmentStage` domain / `TreatmentStageAppService` | 2 | F-19 |
| `TreatmentPlan` / `TreatmentService` / `PatientMoneyCalculator` | 3 | F-19, F-21, F-22, F-17, F-18 — the money rollup feeds the reports |
| `PatientPayment` | 3 | F-22, F-17, F-18 |
| `Prescription` | 2 | F-23 |
| `PatientImage` / blob storage | 2 | F-24 |
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

