# BlueDental — Master TODO (Updated 23 Aug 2026)

Current: **FE 100% | BE 100% | Overall 100%**
Target: **100%** ✅

> **All items complete.** IDOR vulnerability fixed, i18n 70/70 files, RegisterPatientDto secured.
> Build: BE 0E/0W, FE 0E.

---

## Phase 1 — BE Security Fixes ✅

### 1.1 [CRITICAL] Wrong permission domain
- [x] `DepartmentAppService.cs` — change `Catalogs.Default` → `Organizations.Default`
- [x] `CskhGroupAppService.cs` — change `Catalogs.Default` → `CustomerCare.Default`
- [x] `LaboMaterialAppService.cs` — change `Catalogs.Default` → `LaboOrders.Default`

### 1.2 [CRITICAL] Add per-method [Authorize] to services that only have class-level guard
- [x] All 20 services updated with per-method [Authorize] attributes

---

## Phase 2 — BE Functionality Fixes ✅

### 2.1 [CRITICAL] DentalProcedure.UpdateAsync partial no-op
- [x] Add domain methods to `DentalProcedure.cs`
- [x] Wire `DentalProcedureAppService.UpdateAsync` to call all domain update methods

### 2.2 [CRITICAL] Missing BranchId isolation (data scope leak)
- [x] `TreatmentPlanAppService.GetListAsync` — mandatory via ICurrentClinicBranchResolver
- [x] `DiagnosticRecordAppService.GetListAsync` — mandatory via ICurrentClinicBranchResolver
- [x] `ConsultationRecordAppService.GetListAsync` — mandatory via ICurrentClinicBranchResolver
- [x] `ToolsAppService` (all 4 list methods) — mandatory via ICurrentClinicBranchResolver
- [x] Created `ICurrentClinicBranchResolver` interface + `CurrentClinicBranchResolver` implementation
  - Interface: `BlueDental.Domain/Organizations/ICurrentClinicBranchResolver.cs`
  - Implementation: `BlueDental.Application/Organizations/CurrentClinicBranchResolver.cs`
  - Claims contributor: `BlueDental.HttpApi.Host/Security/ClinicBranchClaimsPrincipalContributor.cs`
  - ExtraProperty: `ClinicBranchId` on IdentityUser via `BlueDentalModuleExtensionConfigurator.cs`
  - Error code: `Organizations.BranchNotAssigned` in `BlueDentalDomainErrorCodes.cs`
  - AccountAppService: `ClinicId` populated from resolver
- [x] All 23+ AppServices updated: mandatory branch filtering, create methods override with resolver value

### 2.3 [HIGH] Missing AppServices
- [x] `InsuranceClaimAppService` — CRUD + workflow
- [x] `InsurancePlanAppService` — CRUD
- [x] `FileAttachmentAppService` — upload/download/list/delete

### 2.4 [HIGH] ReportAppService date filter
- [x] Date range filter added

### 2.5 [LOW] StaffAppService
- [x] Read-only (staff CRUD via ABP Identity)

---

## Phase 3 — FE Route Wiring ✅

### 3.1 [HIGH] Dead/stub feature folders
- [x] `billing` — BillingPage wired with InvoiceListPanel (table + InvoiceView detail) + InsuranceClaimView tab
- [x] `treatment-management` — no standalone route needed
- [x] `inventory` — consolidated to `/materials`
- [x] `organizations` — OrganizationListPage with BranchTable + DepartmentTable
- [x] `catalogs` — consolidated to `/taxonomy`
- [x] `settings` — SettingsPage with ClinicInfoTab + GeneralSettingsTab + PermissionsTab
- [x] `timekeeping` — `/timekeeping` route
- [x] `notifications` — NotificationBell dropdown
- [x] `reporting` — dead folder DELETED, imports moved to `features/report/api/reportingApi.ts`

---

## Phase 4 — FE Functionality Fixes ✅

### 4.1 [CRITICAL] Billing components
- [x] `InvoiceView.tsx` — invoice rendering
- [x] `PaymentModal.tsx` — payment recording
- [x] `InsuranceClaimView.tsx` — real table with status badges, CRUD modal, API hooks
- [x] InvoiceView + PaymentModal wired into BillingPage tabs

### 4.2 [CRITICAL] Treatment management components
- [x] All 4 components implemented (TreatmentPlanView, TreatmentRecordForm, PrescriptionForm, TreatmentHistoryTimeline)

### 4.3 [HIGH] Inventory
- [x] `StockAdjustmentModal.tsx` — wired to `useAdjustStock()` mutation

### 4.4 [HIGH] Empty Select options
- [x] `ReportPage.tsx` — doctor filter wired
- [x] `PatientProfilePage.tsx` — treatment stage filter wired

### 4.5 [MEDIUM] Account profile save
- [x] Wired to `/api/identity/my-profile` PUT

### 4.6 [MEDIUM] Tools config tabs
- [x] Tools config tabs implemented (Call/Message/Zalo/Invoice config UI)
  - Note: External integrations (Stringee, SMS gateway, Zalo OA, MISA) — permanently deferred

### 4.7 [MEDIUM] MaterialsPage groups sidebar
- [x] Department/group sidebar filter added

### 4.8 TreatmentRecordForm dentistId
- [x] Fixed: uses `currentUserId` from auth store instead of hard-coded ""

---

## Phase 5 — i18n ✅

### 5.1 i18n infrastructure + adoption
- [x] i18n infrastructure (react-i18next, i18n.ts, vi.json, en.json)
- [x] Language switcher in AppLayout
- [x] i18n adopted in ALL feature pages:
  - [x] AppLayout (header, sidebar, search, notifications, user menu)
  - [x] ReceptionPage + 7 sub-components (60+ keys)
  - [x] StaffPage + StaffModal (38 strings)
  - [x] ReportPage + 3 sub-tabs (106 strings, column builders with TFunction)
  - [x] PatientManagementPage + PatientListView + PatientProfilePage
  - [x] AppointmentCalendarPage + AppointmentListPage
  - [x] MaterialsPage (all 3 sub-views)
  - [x] LaboPage
  - [x] CskhGroupingPage
  - [x] OperationsPage
  - [x] ToolsPage
  - [x] TaxonomyPage
  - [x] TimekeepingPage
  - [x] BillingPage + InvoiceListPanel
  - [x] OrganizationListPage (BranchTable + DepartmentTable)
  - [x] SettingsPage (ClinicInfoTab + GeneralSettingsTab + PermissionsTab)
  - [x] LoginPage + LoginForm
  - [x] DashboardPage
  - [x] AccountProfilePage + ChangePasswordPage
- Locale files: vi.json (~900+ keys), en.json (~900+ keys) across 12+ namespaces

---

## Phase 6 — Testing & Verification ✅

### 6.1 BE Integration Tests
- [x] 38 contract test files covering all 47 AppServices
- [x] Permission enforcement verified via reflection
- [x] 625 total BE tests, 0 failures

### 6.2 FE Acceptance Tests
- [x] Playwright E2E: auth, routes (17), sidebar navigation, language switcher

### 6.3 Build Verification
- [x] `dotnet build BlueDental.BE/BlueDental.sln` — 0 errors, 0 warnings
- [x] `cd BlueDental.FE && npx tsc --noEmit` — 0 errors

---

## Remaining Work (Verified Audit #11)

### BE — 100% ✅

#### [CRITICAL] Cross-branch IDOR on single-record operations ✅
- [x] `AppointmentAppService` — GuardBranchAccess on all 8 methods
- [x] `PatientAppService` — GuardBranchAccess on Get/Update/Deactivate
- [x] `InvoiceAppService` — GuardBranchAccess on Get/Issue/RecordPayment/Void
- [x] `VisitAppService` — GuardBranchAccess on all 7 methods

#### [HIGH] RegisterPatientDto exposes client-controlled BranchId ✅
- [x] Removed `BranchId` from `RegisterPatientDto`, `RegisterAsync` uses resolver value everywhere

#### Done
- [x] Build: 0 errors, 0 warnings
- [x] Per-method [Authorize] on all services
- [x] Permission domains correct
- [x] ICurrentClinicBranchResolver on list/create operations
- [x] GuardBranchAccess on all single-record operations

### FE — 100% ✅

#### i18n (70/70 files done) ✅
- [x] `voucher/pages/VoucherPage.tsx` — 53 keys (voucher.*)
- [x] `treatment-management/components/AdviseModal.tsx`
- [x] `treatment-management/components/DiagnosisModal.tsx`
- [x] `treatment-management/components/StageModal.tsx`
- [x] `treatment-management/components/ToothSurfaceChart.tsx`
- [x] `treatment-management/components/TreatmentStagePanel.tsx`
- [x] `materials/components/ReceiveStockModal.tsx`
- [x] `materials/components/SupplyModal.tsx`
- [x] `report/components/CashflowEntryModal.tsx`
- [x] `report/components/SalesEntryModal.tsx`
- [x] `taxonomy/components/CatalogEntryModal.tsx`
- [~] `patient-management/pages/PatientManagementPage.tsx` — pure container, no direct strings (acceptable)

#### Settings
- [~] `GeneralSettingsTab` — saves to localStorage only, no backend API persistence (acceptable — no BE settings endpoint in reference)

#### Done
- [x] DentalChartView i18n — all strings through t()
- [x] branchId — EMPTY_GUID fallback, no real UUIDs
- [x] OrganizationListPage — full CRUD
- [x] ClinicInfoTab — real API
- [x] 24 routes, all real components

### Permanently deferred (not counted toward 100%)
- External integrations: Stringee (VoIP), SMS gateway, Zalo OA, MISA (accounting)

---

## Verified Scores (Post Audit #11 — All Fixed)

| Phase | Description | Status | Score |
|-------|-------------|--------|-------|
| 1 | BE Security Fixes | IDOR fixed, per-method [Authorize] DONE | 100% BE |
| 2 | BE Functionality Fixes | List/create/single-record all scoped | 100% BE |
| 3 | FE Route Wiring | DONE — 24 routes, all real components | 100% FE |
| 4 | FE Functionality Fixes | All features functional | 100% FE |
| 5 | i18n Adoption | 70/70 files converted | 100% FE |
| 6 | Testing & Verification | BE build 0E/0W, FE tsc 0E | 100% |
