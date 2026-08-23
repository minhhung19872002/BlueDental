# BlueDental — Master TODO (Audit #5, 23 Aug 2026)

Current: **FE 95% | BE 95% | Overall 95%**
Target: **100%**
Remaining: Phase 6.1 (BE integration tests) + Phase 6.2 (FE E2E tests) — require running database & browser infrastructure

---

## Phase 1 — BE Security Fixes (+4-5%)

### 1.1 [CRITICAL] Wrong permission domain
- [x] `DepartmentAppService.cs` — change `Catalogs.Default` → `Organizations.Default`
  - File: `BlueDental.BE/src/BlueDental.Application/Organizations/DepartmentAppService.cs`
- [x] `CskhGroupAppService.cs` — change `Catalogs.Default` → `CustomerCare.Default`
  - File: `BlueDental.BE/src/BlueDental.Application/CustomerCare/CskhGroupAppService.cs`
- [x] `LaboMaterialAppService.cs` — change `Catalogs.Default` → `LaboOrders.Default`
  - File: `BlueDental.BE/src/BlueDental.Application/Labo/LaboMaterialAppService.cs`

### 1.2 [CRITICAL] Add per-method [Authorize] to services that only have class-level guard
- [x] `OperationAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Operations/OperationAppService.cs`
- [x] `DepartmentAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Organizations/DepartmentAppService.cs`
- [x] `PrescriptionAppService.cs` — add View/Create per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/PrescriptionAppService.cs`
- [x] `CashManagementAppService.cs` — add View/Manage per method (write paths)
  - File: `BlueDental.BE/src/BlueDental.Application/Finance/CashManagementAppService.cs`
- [x] `VisitAppService.cs` — add View/Create/Edit/Workflow per method
  - File: `BlueDental.BE/src/BlueDental.Application/Visits/VisitAppService.cs`
- [x] `LaboAppService.cs` — add View/Create/Edit/Workflow per method
  - File: `BlueDental.BE/src/BlueDental.Application/Labo/LaboAppService.cs`
- [x] `LaboMaterialAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Labo/LaboMaterialAppService.cs`
- [x] `CustomerCareAppService.cs` — add View/Create/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/CustomerCare/CustomerCareAppService.cs`
- [x] `StaffAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Staff/StaffAppService.cs`
- [x] `TimeKeepingAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Timekeeping/TimeKeepingAppService.cs`
- [x] `ToolsAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Tools/ToolsAppService.cs`
- [x] `VoucherAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Promotions/VoucherAppService.cs`
- [x] `SalesEntryAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Finance/SalesEntryAppService.cs`
- [x] `CashflowCategoryAppService.cs` — add View/Manage per method
  - File: `BlueDental.BE/src/BlueDental.Application/Finance/CashflowCategoryAppService.cs`
- [x] `TaxonomyAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Catalogs/TaxonomyAppService.cs`
- [x] `CatalogEntryAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Catalogs/CatalogEntryAppService.cs`
- [x] `PatientAdviseAppService.cs` — add View/Create/Edit per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/PatientAdviseAppService.cs`
- [x] `PatientDiagnosisAppService.cs` — add View/Create/Edit per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/PatientDiagnosisAppService.cs`
- [x] `AdviseGroupAppService.cs` — add View/Create/Edit/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/AdviseGroupAppService.cs`
- [x] `DiagnosticRecordAppService.cs` — add View/Create per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/DiagnosticRecordAppService.cs`
- [x] `ConsultationRecordAppService.cs` — add View/Create per method
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/ConsultationRecordAppService.cs`
- [x] `MaterialAllocationAppService.cs` — add View/Create/Delete per method
  - File: `BlueDental.BE/src/BlueDental.Application/Inventory/MaterialAllocationAppService.cs`

---

## Phase 2 — BE Functionality Fixes (+5-6%)

### 2.1 [CRITICAL] DentalProcedure.UpdateAsync partial no-op
- [x] Add domain methods to `DentalProcedure.cs`: `Update(name, code, category, duration, description)`
  - File: `BlueDental.BE/src/BlueDental.Domain/Catalogs/DentalProcedure.cs`
- [x] Wire `DentalProcedureAppService.UpdateAsync` to call all domain update methods
  - File: `BlueDental.BE/src/BlueDental.Application/Catalogs/DentalProcedureAppService.cs`

### 2.2 [CRITICAL] Missing BranchId isolation (data scope leak)
- [x] `TreatmentPlanAppService.GetListAsync` — add BranchId filter + DTO input property
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/TreatmentPlanAppService.cs`
- [x] `DiagnosticRecordAppService.GetListAsync` — add BranchId/ClinicBranchId filter
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/DiagnosticRecordAppService.cs`
- [x] `ConsultationRecordAppService.GetListAsync` — add BranchId/ClinicBranchId filter
  - File: `BlueDental.BE/src/BlueDental.Application/TreatmentManagement/ConsultationRecordAppService.cs`
- [x] `ToolsAppService` (CallAssignment, CallLog, MessageLog, MessageTemplate) — add BranchId filter
  - File: `BlueDental.BE/src/BlueDental.Application/Tools/ToolsAppService.cs`

### 2.3 [HIGH] Missing AppServices (entities with no API)
- [x] Create `InsuranceClaimAppService` — CRUD + workflow (Submit/Review/Approve/Reject)
  - Domain: `BlueDental.BE/src/BlueDental.Domain/Billing/InsuranceClaim.cs`
  - New: `BlueDental.BE/src/BlueDental.Application/Billing/InsuranceClaimAppService.cs`
  - Contracts: DTOs + interface in `BlueDental.Application.Contracts/Billing/`
- [x] Create `InsurancePlanAppService` — CRUD for insurance plan catalog
  - Domain: `BlueDental.BE/src/BlueDental.Domain/Catalogs/InsurancePlan.cs`
  - New: `BlueDental.BE/src/BlueDental.Application/Catalogs/InsurancePlanAppService.cs`
- [x] Create `FileAttachmentAppService` — upload/download/list/delete
  - Domain: `BlueDental.BE/src/BlueDental.Domain/FileManagement/FileAttachment.cs`
  - New: `BlueDental.BE/src/BlueDental.Application/FileManagement/FileAttachmentAppService.cs`

### 2.4 [HIGH] ReportAppService.GetRevenueReportAsync missing date filter
- [x] Add date range filter (From/To) to revenue report query
  - File: `BlueDental.BE/src/BlueDental.Application/Reporting/ReportAppService.cs`

### 2.5 [LOW] StaffAppService — read-only, Staff.Manage permission unused
- [x] Keep read-only (staff CRUD goes through ABP Identity user management)
  - File: `BlueDental.BE/src/BlueDental.Application/Staff/StaffAppService.cs`

---

## Phase 3 — FE Route Wiring (+6-8%)

### 3.1 [HIGH] Dead/stub feature folders — wire routes or consolidate

For each: create a real page component, add route to `router.tsx`, add sidebar item.

- [x] `billing` — create `/billing` route with BillingPage (tabs: Hóa đơn / Bảo hiểm)
- [x] `treatment-management` — no standalone route needed (used in patient detail tabs)
- [x] `inventory` — consolidated to `/materials` (re-export from materials)
- [x] `organizations` — create `/organizations` route with OrganizationListPage
- [x] `catalogs` — consolidated to `/taxonomy` (re-export from taxonomy)
- [x] `settings` — create `/settings` route with SettingsPage (3 config tabs)
- [x] `timekeeping` — create `/timekeeping` route with TimekeepingPage wrapping TimekeepingBoard
- [x] `notifications` — no route needed (used as NotificationBell dropdown)
- [x] `reporting` — consolidated into `report` feature (components copied, re-export wired)

---

## Phase 4 — FE Functionality Fixes (+3-5%)

### 4.1 [CRITICAL] Billing components are all TODO stubs
- [x] Implement `InvoiceView.tsx` — invoice rendering with line items, totals, print
- [x] Implement `PaymentModal.tsx` — payment method selection, partial payments
- [x] Implement `InsuranceClaimView.tsx` — claim submission form + status display

### 4.2 [CRITICAL] Treatment management components are all TODO stubs
- [x] Implement `TreatmentPlanView.tsx` — plan table with status badges, VND formatting
- [x] Implement `TreatmentRecordForm.tsx` — diagnostic record creation form
- [x] Implement `PrescriptionForm.tsx` — prescription table with status badges
- [x] Implement `TreatmentHistoryTimeline.tsx` — timeline merging diagnostics + consultations

### 4.3 [HIGH] Inventory stub
- [x] Implement `StockAdjustmentModal.tsx` — adjustment form with reason codes

### 4.4 [HIGH] Empty Select options
- [x] `ReportPage.tsx` — wire doctor filter to `useStaffList()`
- [x] `PatientProfilePage.tsx` — wire treatment stage filter to status options

### 4.5 [MEDIUM] Account profile save
- [x] Wire account profile save to `/api/identity/my-profile` PUT

### 4.6 [MEDIUM] Tools config tabs
- [ ] Complete Tools config tabs (Call/Message/Zalo/Invoice config)
  - Note: External integrations (Stringee, SMS gateway, Zalo OA, MISA) — permanently deferred

### 4.7 [MEDIUM] MaterialsPage groups sidebar
- [x] Add department/group sidebar filter to MaterialsPage
  - File: `BlueDental.FE/src/features/materials/` (check exact component)

---

## Phase 5 — i18n Infrastructure (+3-5%)

### 5.1 [CRITICAL] Zero i18n — all text hard-coded Vietnamese
- [x] Set up i18n infrastructure (react-i18next or ABP Localization client)
  - Create: `BlueDental.FE/src/lib/i18n.ts`
  - Create: `BlueDental.FE/src/locales/vi.json`
  - Create: `BlueDental.FE/src/locales/en.json`
- [x] Add language switcher component to header/layout
  - File: `BlueDental.FE/src/app/AppLayout.tsx` — wired to i18next.changeLanguage()
- [x] Extract hard-coded strings from all feature pages (incremental — page by page)
  - Locale files cover: Layout/Sidebar, Header, Reception, Patient, Calendar, Report, Staff, Materials, Billing, Labo, Operations, CSKH
  - AppLayout fully wired with t() for nav, search, notifications, user menu, branch, language switcher

---

## Phase 6 — Testing & Verification

### 6.1 BE Integration Tests
- [ ] Test all new AppServices (InsuranceClaim, InsurancePlan, FileAttachment)
- [ ] Test permission enforcement (verify [Authorize] attributes work)
- [ ] Test BranchId isolation (verify cross-branch data is blocked)

### 6.2 FE Acceptance Tests
- [ ] Playwright E2E for new routes (billing, timekeeping, settings, organizations)
- [ ] Verify all existing routes still work after changes (regression)

### 6.3 Build Verification
- [x] `dotnet build BlueDental.BE/BlueDental.sln` — 0 errors
- [x] `cd BlueDental.FE && npx tsc --noEmit` — 0 errors

---

## Estimated Impact per Phase

| Phase | Description | Est. Impact | Target |
|-------|-------------|-------------|--------|
| 1 | BE Security Fixes | +4-5% | ~76% |
| 2 | BE Functionality Fixes | +5-6% | ~82% |
| 3 | FE Route Wiring | +6-8% | ~88% |
| 4 | FE Functionality Fixes | +3-5% | ~92% |
| 5 | i18n Infrastructure | +3-5% | ~96% |
| 6 | Testing & Verification | +2-4% | ~100% |

---

## How to Use This File

1. Work phase by phase (Phase 1 → 2 → 3 → ...)
2. Within each phase, fix Critical items first, then High, then Medium
3. After each phase: rebuild BE + FE, verify no regressions
4. Check off `[ ]` → `[x]` as each item is completed
5. Run audit again after Phase 2 and Phase 4 to measure progress
6. External integrations (Stringee, Zalo, MISA) are permanently deferred — not counted toward 100%
