# BlueDental — Progress Report

Cập nhật lần cuối: 2026-08-22 (session 4)

---

## Tóm tắt nhanh

| Layer | Status | Ghi chú |
|-------|--------|---------|
| Frontend UI (FE) | 🟢 ~97% | Tất cả trang hoàn chỉnh; Calendar week+month, Report 4 tabs, CSKH grouping |
| Backend API (BE) | 🟢 ~85% | Build clean 0 errors; tất cả domain + AppService + Controller; 2 migrations |
| FE ↔ BE Integration | 🟡 ~40% | Patient+Appointment gọi BE thật; catalog/billing/inventory/notif hooks xong |
| Tests | 🟢 ~75% | 55 tests (15 domain + 22 application + 18 EF) — tất cả pass |
| Docker / Deploy | 🟡 50% | docker-compose.yml tồn tại, chưa verify chạy |

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
| `BlueDental.Domain.Tests` | ✅ 15/15 PASS | Patient (5) + Appointment (3) + Visit (7 từ agent) |
| `BlueDental.Application.Tests` | ✅ 22/22 PASS | Contract tests: Patient, Appointment, Invoice, TreatmentPlan |
| `BlueDental.EntityFrameworkCore.Tests` | ✅ 18/18 PASS | Mapping tests: Patient, Appointment, Visit, LaboOrder |
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
- [x] Domain Tests: 8 tests — Patient (5) + Appointment (3) ✅ ALL PASS
- [x] EF Core Mapping Tests: 5 tests — PatientMappingTests ✅ ALL PASS
- [ ] Application.Tests contract tests — PENDING
- [ ] HttpApi.Host.Tests E2E integration tests — PENDING

### Sprint cuối — Integration & Deploy

- [ ] FE API hooks kết nối BE thật (thay mock)
- [ ] E2E tests (Playwright)
- [ ] Docker compose verify
- [ ] Security review

---

## V. Commit Log (gần đây)

```
4565235 feat(cskh): implement Phân nhóm CSKH tab with group management table
0e8ea66 feat(api): implement real API hooks for catalogs, reporting, billing, inventory, notifications
9b87856 feat(report): sync tab, dateMode, date state to URL search params
8b710c7 feat(report): implement Quản lý thu chi and Kết quả kinh doanh tabs
b7d86e4 feat(calendar): add week and month view grids
bfaa14a feat(taxonomy): improve service panel with searchable group sidebar
981b857 feat(appointments): add filter toolbar to appointment list view
80e824a docs(clone): add complete survey documentation for all 12 reference pages
3923baa feat(tools): implement sub-tabs for all 4 tool categories
8cd92eb feat(calendar): appointment creation form + doctor filter
```
