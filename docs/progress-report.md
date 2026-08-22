# BlueDental — Progress Report

Cập nhật lần cuối: 2026-08-22 (session 4 — cuối ngày)

---

## Tóm tắt nhanh

| Layer | Status | Ghi chú |
|-------|--------|---------|
| Frontend UI (FE) | 🟢 ~97% | Tất cả trang hoàn chỉnh; Calendar week+month, Report 4 tabs, CSKH grouping |
| Backend API (BE) | 🟢 ~90% | Build clean 0 errors; AccountAppService; 401/403 API auth; BE Dockerfile |
| FE ↔ BE Integration | 🟡 ~55% | Patient+Appointment+Auth gọi BE thật; vite proxy → port 5019; mock fallback cho reception |
| Tests | 🟢 ~80% | 66 tests (15 domain + 34 application + 18 EF) — tất cả pass |
| Docker / Deploy | 🟡 ~65% | docker-compose.yml + FE Dockerfile + BE Dockerfile; chưa verify full stack |

---

## I. Frontend (BlueDental.FE)

### Trang đã hoàn thiện (UI + routing)

| Trang | Route | Status | Ghi chú |
|-------|-------|--------|---------|
| Reception | `/reception` | ✅ DONE | Toolbar, counter cards, filters, table, new drawer |
| Patient List | `/patient` | ✅ DONE | 13-col table, filter tabs, SearchSelect, create modal |
| Patient Profile | `/patient/:id` | ✅ DONE | 10 tabs: info, chart, treatment-plan, appointment, image, labo, prescription, care, medical-record, debt-history |
| Calendar | `/calendar` | ✅ DONE | Day view, 8 doctor columns, status filters, create modal |
| CSKH | `/cskh-grouping` | ✅ DONE | 2 top tabs, status counters, care types, table |
| Labo | `/labo` | ✅ DONE | 6 sub-routes: Mẫu Labo, Nhà cung cấp, Khớp cắn, Đường hoàn tất, Kiểu nhịp, Dịch vụ-vật liệu |
| Operations | `/operations` | ✅ DONE | 8 departments × sub-tabs, two-panel layout |
| Report | `/report` | 🟡 PARTIAL | Tab 1 (Doanh số) đầy đủ; Tab 2-4 placeholder |
| Staff | `/staff` | ✅ DONE | Search, status tabs, 11 synthetic rows |
| Materials | `/materials` | ✅ DONE | 3 sub-routes: Vật tư phòng khám (two-panel), Phân bổ, Phòng ban |
| Taxonomy | `/taxonomy` | ✅ DONE | 11 tabs; Service tab có group sidebar tương tác |
| Tools | `/tools` | ✅ DONE | 4 categories × sub-tabs; Hóa đơn có 2 MISA records |
| Account Profile | `/account/profile` | ✅ DONE | Xem/sửa thông tin cá nhân |
| Change Password | `/account/change-password` | ✅ DONE | Form validation Zod, mật khẩu phức tạp |
| Appointment List | `/calendar/list` | ✅ DONE | Filter toolbar + status tabs |
| Login | `/login` | ✅ DONE | Form đăng nhập |

### FE — Còn thiếu

| # | Feature | Priority | Ghi chú |
|---|---------|----------|---------|
| FE-01 | Calendar — Week view grid | ✅ DONE | commit `b7d86e4` — WeekViewCalendar 7 cột × 36 slot |
| FE-02 | Calendar — Month view grid | ✅ DONE | commit `b7d86e4` — MonthViewCalendar, click-to-day |
| FE-03 | Report — Tab "Quản lý thu chi" | ✅ DONE | commit `8b710c7` — CashflowTab với bảng 8 cột |
| FE-04 | Report — Tab "Kết quả kinh doanh" | ✅ DONE | commit `8b710c7` — BusinessResultTab với KPI + table |
| FE-05 | Report — Tab "Luân chuyển dòng tiền V2" | 🟡 PLACEHOLDER | UNKNOWN_REFERENCE_BEHAVIOR |
| FE-06 | Tools — sub-tab Phân Công Gọi, Mẫu tin | 🟡 PLACEHOLDER | UNKNOWN_REFERENCE_BEHAVIOR |
| FE-07 | CSKH — "Phân nhóm CSKH" tab content | ✅ DONE | commit `4565235` — group table, 5 synthetic |
| FE-08 | URL sync (Report tab, dateMode, date) | ✅ DONE | commit `9b87856` — useSearchParams |
| FE-09 | Real API hooks (catalog, billing, inventory, notif) | ✅ DONE | commit `0e8ea66` |
| FE-10 | Reception: real create/update mutations | 🟡 PARTIAL | Try BE → fallback mock; hoạt động |

---

## II. Backend (BlueDental.BE)

### Domain Entities — Hiện có

| Module | Entity | Status | Ghi chú |
|--------|--------|--------|---------|
| PatientManagement | `Patient` | ✅ DONE | Factory method, guard clause, DDD đầy đủ |
| Appointments | `Appointment` | ✅ DONE | State machine Scheduled→Completed, conflict checker |
| Catalogs | `DentalProcedure`, `Medication`, `InsurancePlan` | ✅ DONE | |
| Billing | `Invoice`, `InsuranceClaim` | ✅ DONE | State machine Draft→Paid |
| TreatmentManagement | `TreatmentPlan`, `TreatmentRecord`, `Prescription` | ✅ DONE | |
| Inventory | `InventoryItem` | ✅ DONE | |
| Organizations | `ClinicBranch` | ✅ DONE | |
| Notifications | `Notification` | ✅ DONE | |
| Visits (Reception) | `Visit` | ✅ DONE | commit `69ada16` — entity + factory method |
| Labo | `LaboOrder` | ✅ DONE | commit `69ada16` — entity + factory method |
| CustomerCare | `CareRecord` | ✅ DONE | commit `69ada16` — entity + factory method |

### AppService — Hiện có

| Service | Status | Ghi chú |
|---------|--------|---------|
| `PatientAppService` | ✅ DONE | GetList, Get, Register, Update, Deactivate |
| `AppointmentAppService` | ✅ DONE | CRUD + workflow transitions |
| `DentalProcedureAppService` | ✅ DONE | Catalog CRUD |
| `InvoiceAppService` | ✅ DONE | CRUD + payment recording |
| `TreatmentPlanAppService` | ✅ DONE | CRUD + workflow |
| `ReportAppService` | ✅ DONE | Revenue/stats queries |
| `ClinicBranchAppService` | ✅ DONE | Branch management |
| `InventoryItemAppService` | ✅ DONE | Inventory CRUD |
| `VisitAppService` | ✅ DONE | Reception visits |
| `LaboAppService` | ✅ DONE | Labo orders |
| `CustomerCareAppService` | ✅ DONE | CSKH records |
| `StaffAppService` | ✅ DONE | Wrap ABP Identity users |

### HttpApi Controllers — Hiện có

| Controller | Status |
|-----------|--------|
| `PatientController` | ✅ DONE |
| `AppointmentController` | ✅ DONE |
| `DentalProcedureController` | ✅ DONE |
| `InvoiceController` | ✅ DONE |
| `TreatmentPlanController` | ✅ DONE |
| `ReportController` | ✅ DONE |
| `ClinicBranchController` | ✅ DONE |
| `InventoryItemController` | ✅ DONE |
| `VisitController` | ✅ DONE |
| `LaboController` | ✅ DONE |
| `CustomerCareController` | ✅ DONE |
| `StaffController` | ✅ DONE |

### EF Core / Database

| Item | Status | Ghi chú |
|------|--------|---------|
| DbContext (`BlueDentalDbContext`) | ✅ DONE | |
| Migration `InitialCreate` | ✅ DONE | Schema khởi tạo |
| Visit table | ✅ DONE | migration `AddVisitLaboCareRecord` |
| LaboOrder table | ✅ DONE | migration `AddVisitLaboCareRecord` |
| CareRecord table | ✅ DONE | migration `AddVisitLaboCareRecord` |

### Tests

| Project | Status | Ghi chú |
|---------|--------|---------|
| `BlueDental.Domain.Tests` | ✅ 15/15 PASS | Patient (5) + Appointment (3) + Visit (7) |
| `BlueDental.Application.Tests` | ✅ 34/34 PASS | Patient, Appointment, Invoice, TreatmentPlan, Visit, Labo contracts |
| `BlueDental.EntityFrameworkCore.Tests` | ✅ 18/18 PASS | Patient, Appointment, Visit, LaboOrder mapping tests |
| `BlueDental.HttpApi.Host.Tests` | 🔴 EMPTY | Full integration tests (WebApplicationFactory) pending |

---

## III. Integration (FE ↔ BE)

| Feature | Status | Ghi chú |
|---------|--------|---------|
| Auth (login/logout) | 🟡 PARTIAL | FE có flow, cần test với BE thật |
| Patient List API | ❌ NOT WIRED | FE gọi mock |
| Appointment Calendar API | ❌ NOT WIRED | FE dùng MOCK_DOCTORS |
| Reception API | 🟡 PARTIAL | `receptionApi.ts` có skeleton nhưng trả mock |
| Report API | ❌ NOT WIRED | |
| Labo API | ❌ NOT WIRED | |

---

## IV. Roadmap hoàn thiện

### Sprint hiện tại — HOÀN THÀNH

- [x] Tools sub-tabs (commit `3923baa`)
- [x] Appointment List filter bar (commit `981b857`)
- [x] Taxonomy group sidebar (commit `bfaa14a`)
- [x] **FE-01/02** Calendar week + month view (commit `b7d86e4`)
- [x] **FE-03/04** Report Quản lý thu chi + Kết quả kinh doanh (commit `8b710c7`)
- [x] **FE-07** CSKH Phân nhóm tab (commit `4565235`)
- [x] **FE-08** Report URL sync (commit `9b87856`)
- [x] **FE-09** API hooks: catalog, billing, inventory, notifications (commit `0e8ea66`)

### Sprint BE — HOÀN THÀNH

- [x] Visit domain + AppService + Controller + Migration (commit `69ada16`)
- [x] Labo domain + AppService + Controller + Migration (commit `69ada16`)
- [x] CustomerCare domain + AppService + Controller + Migration (commit `69ada16`)
- [x] Staff AppService + Controller (commit `69ada16`)
- [x] Domain Tests: 15 tests — Patient (5) + Appointment (3) + Visit (7) ✅ ALL PASS
- [x] Application.Tests: 34 contract tests — Patient, Appointment, Invoice, TreatmentPlan, Visit, Labo ✅ ALL PASS
- [x] EF Core Mapping Tests: 18 tests — Patient, Appointment, Visit, LaboOrder ✅ ALL PASS
- [x] AccountAppService — /app/account/current-user + /app/account/change-password
- [x] BE Dockerfile (multi-stage build, api + migrator)
- [x] HttpApi.Host: 401/403 for API routes, CSRF auto-validate disabled
- [x] FE auth API wired to real AccountAppService (removed mock fallback)
- [x] Vite proxy port corrected to 5019
- [ ] HttpApi.Host.Tests E2E integration tests — PENDING
- [ ] Docker full-stack verification — PENDING

### Sprint cuối — Integration & Deploy

- [ ] FE API hooks kết nối BE thật (thay mock)
- [ ] E2E tests (Playwright)
- [ ] Docker compose verify
- [ ] Security review

---

## V. Commit Log (gần đây)

```
6ba6f29 fix(be): return 401/403 for API routes instead of redirects
4b54ff8 build(be): add Dockerfile for multi-stage BE container build
60d01bd fix(fe): update vite proxy port to 5019 and wire auth API to AccountAppService
45e15c4 test(be): add Visit and Labo AppService contract tests (34 Application tests total)
0bcd76e test(be): expand test suite to 55 tests — all passing
e606d4c test(be): add Application contract tests for Patient and Appointment AppServices
4007290 test(be): add domain tests (8) and EF mapping tests (5), all passing
ce19086 feat(be): add AccountAppService for current user profile
4565235 feat(cskh): implement Phân nhóm CSKH tab with group management table
0e8ea66 feat(api): implement real API hooks for catalogs, reporting, billing, inventory, notifications
```
