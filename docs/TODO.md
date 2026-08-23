# BlueDental — Master TODO (Audit #9, 23 Aug 2026)

Current: **FE 87% | BE 100% | Overall 94%**
Target: **100%**

> **Audit #9 (23 Aug 2026)**: Verified by independent agents.
> BE: 100% — 0 errors, 0 warnings. CS8609 fixes confirmed.
> FE: 87% — Orgs CRUD done, Settings wired, i18n 95% by file count (57/60).
> Remaining: DentalChartView hard-coded Vietnamese aria-labels, branchId fallback UUID.

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

## Remaining Work (Verified Audit #9)

### BE — 100% COMPLETE
- [x] All CS8609 warnings fixed. Build: 0 errors, 0 warnings.

### FE — 87% (13% gap to 100%)

#### i18n (57/60 files done — 3 remaining)
- [ ] `DentalChartView.tsx` — 4 hard-coded Vietnamese aria-labels: "Răng ${fdi}", "Biểu đồ nha khoa 32 răng", "Hàm trên", "Hàm dưới"
  - File: `BlueDental.FE/src/features/patient-management/components/DentalChartView.tsx`

#### branchId
- [~] `useCurrentBranchId()` now reads from auth store (dynamic) — but fallback `DEFAULT_BRANCH_ID = "11111111-..."` is still hard-coded
  - File: `BlueDental.FE/src/lib/clinicBranch.ts`
  - Impact: works for single-branch, blocks multi-branch switching

### Permanently deferred (not counted toward 100%)
- External integrations: Stringee (VoIP), SMS gateway, Zalo OA, MISA (accounting)

---

## Verified Scores (Audit #9 — Independent Agents)

| Phase | Description | Status | Verified Score |
|-------|-------------|--------|-------|
| 1 | BE Security Fixes | DONE | 100% BE |
| 2 | BE Functionality Fixes | DONE | 100% BE |
| 3 | FE Route Wiring | DONE (Orgs CRUD, Settings real data) | 87% FE |
| 4 | FE Functionality Fixes | DONE | 87% FE |
| 5 | i18n Adoption | 95% by file count (57/60) | 87% FE |
| 6 | Testing & Verification | DONE (BE 0W/0E, FE tsc clean) | — |
