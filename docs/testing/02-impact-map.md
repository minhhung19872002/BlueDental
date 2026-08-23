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
| `lib/clinicBranch.ts` (branch scope) | 3 | F-02, F-03, F-04, F-05, F-06, F-08, F-12..F-15, F-19, F-20 |
| `BranchAccessChecker` / `StaffBranchAssignment` | 3 | F-20 first, then every branch-scoped spec |
| `BlueDentalCatalogSeedContributor` (seeded chẩn đoán + dịch vụ) | 3 | F-09, F-19 — the clinical chain starts from those two entries |
| `BlueDentalDbContext` / model-creating extensions | 3 | Every spec touching persistence |
| Global exception handling, `apiError.ts` | 3 | Every spec that asserts an error message |
| `components/` shared UI (tables, modals, selects) | 2 per consumer | Specs of the screens using them |

## Feature-local dependencies

| Change here | Level | Retest |
|-------------|-------|--------|
| `Catalogs` domain / `TaxonomyAppService` / `CatalogEntryAppService` | 2 | F-02 |
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

## Cross-feature couplings worth remembering

- **Pending expenses**: `SalesEntry.CountsTowardsCashflow` decides whether a
  voucher reaches the totals. Changing it affects F-04 and any report that sums
  vouchers.
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
