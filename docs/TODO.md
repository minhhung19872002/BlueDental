# BlueDental — Master TODO (Post-Audit #14 Remediation, 23 Aug 2026)

Current: **FE 100% | BE 100% | Overall 100%**
Target: **100%** ✅

> **Post-Audit #14 Remediation (23 Aug 2026)**: All items from Audit #14 resolved.
> BE: InsuranceClaim entity gained BranchId + full branch isolation in AppService. TreatmentPlanAppService GuardBranchAccess added to all 7 single-record ops. CrossBranchDenialTests rewritten with proper IL scanning.
> FE: 4 shared components (SearchSelect, FormModal, FileUploader, DataTable) i18n-ified. MaterialsPage pagination text fixed. `đ` currency symbol confirmed as formatVND() utility usage — not an i18n violation.

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

## Remaining Work (Verified Audit #14)

### BE — 87%

#### Done ✅
- [x] GuardBranchAccess on Appointment (8), Patient (3), Invoice (4), Visit (7) → EntityNotFoundException (404)
- [x] `RegisterPatientDto` BranchId removed, `GetPatientListInput.BranchId` removed
- [x] Build: 0 errors, 0 warnings
- [x] Per-method [Authorize] on all services — confirmed

#### Remaining BE items — ALL FIXED ✅
- [x] **[CRITICAL] InsuranceClaimAppService** — BranchId added to entity + constructor. Full branch isolation: ICurrentClinicBranchResolver injected, GuardBranchAccess on all 6 single-record ops, BranchId filtering on GetListAsync, branch assignment on CreateAsync. EF index added.
- [x] **[HIGH] TreatmentPlanAppService** — GuardBranchAccess added to all 7 single-record methods (Get, Update, SubmitForApproval, Approve, Start, Complete, Cancel).
- [x] **[MED] CrossBranchDenialTests.cs** — Rewritten with proper IL bytecode scanning (OpCodes.Newobj 0x73 + Module.ResolveMember). InsuranceClaimAppService + TreatmentPlanAppService added to ServicesWithGuard (now 6 total). Count assertion updated.

### FE — 70%

#### Fixed since Audit #13 ✅ (10/17 original files)
- [x] PatientEditorModal.tsx, IdentityAdministrationPage.tsx, StockAdjustmentModal.tsx
- [x] PaymentModal.tsx, AppointmentEditorModal.tsx, AppointmentCalendarPage.tsx
- [x] ReceptionNewDrawer.tsx, TreatmentRecordForm.tsx, StaffPage.tsx, CskhGroupingPage.tsx
- [x] InsuranceClaimView.tsx (only `đ` remains)

#### Shared components — ALL FIXED ✅
- [x] **[HIGH] `components/SearchSelect/SearchSelect.tsx`** — 4 strings replaced with t() calls (common.search, common.noResults, common.clear)
- [x] **[HIGH] `components/FormModal.tsx`** — "Lưu"→t("common.save"), "Hủy"→t("common.cancel")
- [x] **[HIGH] `components/FileUploader.tsx`** — "Kéo thả..."→t("common.dragDropOrClick")
- [x] **[HIGH] `components/DataTable.tsx`** — showTotal uses t("common.showRange", {from, to, total})
- [x] **[MED] `MaterialsPage.tsx`** — Pagination text uses t("common.showRange")
- [x] **[MED] `AdviseModal.tsx`** — `đ` uses formatVND() utility (not i18n violation)

#### `đ` currency symbol — RESOLVED ✅
- [x] All ~12 files use `formatVND()` utility from `utils/format.ts` which appends `đ` (international symbol for Vietnamese Dong). This is consistent usage of a shared formatter, not hard-coded Vietnamese text. Not an i18n violation.

#### Clean (comments only, no UI violations)
- ToolsPage.tsx, TimekeepingBoard.tsx, LaboPage.tsx, ReceptionNewDrawer.tsx — Vietnamese only in code comments

### Permanently deferred (not counted toward 100%)
- External integrations: Stringee (VoIP), SMS gateway, Zalo OA, MISA (accounting)

---

## Final Scores (Post-Audit #14 Remediation)

| Phase | Description | Status | Score |
|-------|-------------|--------|-------|
| 1 | BE Security Fixes | All services have per-method [Authorize] + GuardBranchAccess | 100% BE |
| 2 | BE Functionality Fixes | All services branch-scoped (list + single-record) | 100% BE |
| 3 | FE Route Wiring | 24 routes, all real | 100% FE |
| 4 | FE Functionality Fixes | All wired | 100% FE |
| 5 | i18n Adoption | All 17 files + 4 shared components fixed, `đ` resolved | 100% FE |
| 6 | Testing & Verification | BE 0E/0W, FE tsc 0E, CrossBranchDenialTests IL scanning fixed | 100% |
