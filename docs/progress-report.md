# BlueDental — Progress Report

Cập nhật lần cuối: 2026-08-22

---

## Tóm tắt nhanh

| Layer | Status | Ghi chú |
|-------|--------|---------|
| Frontend UI (FE) | 🟡 ~90% | 12/12 trang có UI; còn một số tab placeholder |
| Backend API (BE) | 🟡 ~60% | Build clean; thiếu Reception, Labo, CSKH, Staff, Tests |
| FE ↔ BE Integration | 🔴 ~5% | Chỉ Reception mock; hầu hết FE không gọi BE thật |
| Tests | 🔴 ~5% | Chỉ test base rỗng, chưa có test case thật |
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
| FE-01 | Calendar — Week view grid | HIGH | Hiện tại chỉ có day view |
| FE-02 | Calendar — Month view grid | MEDIUM | Cần grid 4-5 tuần |
| FE-03 | Report — Tab "Quản lý thu chi" | MEDIUM | Toolbar + bảng thu chi |
| FE-04 | Report — Tab "Kết quả kinh doanh" | MEDIUM | Charts doanh thu |
| FE-05 | Report — Tab "Luân chuyển dòng tiền V2" | LOW | UNKNOWN behavior |
| FE-06 | Tools — Các sub-tab 2-3 (Phân Công Gọi, Mẫu Tin Nhắn...) | LOW | UNKNOWN behavior |
| FE-07 | CSKH — "Phân nhóm CSKH" tab content | LOW | UNKNOWN behavior |
| FE-08 | URL sync (Report dateMode, Calendar date) | MEDIUM | UX improvement |
| FE-09 | Real API integration (kết nối BE thật) | HIGH | Hiện tại dùng mock |
| FE-10 | Reception: real create/update mutations | HIGH | Drawer submit chưa nối BE |

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
| **Reception/Visits** | **`Visit`** | ❌ MISSING | Tiếp nhận — entity chưa tồn tại |
| **Labo** | **`LaboOrder`** | ❌ MISSING | Phiếu labo chưa tồn tại |
| **CustomerCare** | **`CareRecord`** | ❌ MISSING | CSKH chưa tồn tại |

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
| **`VisitAppService`** | ❌ MISSING | Reception visits |
| **`LaboAppService`** | ❌ MISSING | Labo orders |
| **`CustomerCareAppService`** | ❌ MISSING | CSKH records |
| **`StaffAppService`** | ❌ MISSING | Wrap ABP Identity users |

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
| `VisitController` | ❌ MISSING |
| `LaboController` | ❌ MISSING |
| `CustomerCareController` | ❌ MISSING |
| `StaffController` | ❌ MISSING |

### EF Core / Database

| Item | Status | Ghi chú |
|------|--------|---------|
| DbContext (`BlueDentalDbContext`) | ✅ DONE | |
| Migration `InitialCreate` | ✅ DONE | Schema khởi tạo |
| **Visit table** | ❌ MISSING | Chưa có migration |
| **LaboOrder table** | ❌ MISSING | Chưa có migration |
| **CareRecord table** | ❌ MISSING | Chưa có migration |

### Tests

| Project | Status | Ghi chú |
|---------|--------|---------|
| `BlueDental.Domain.Tests` | 🔴 EMPTY | Chỉ có setup, chưa có test case |
| `BlueDental.Application.Tests` | 🔴 EMPTY | Chưa có test case |
| `BlueDental.EntityFrameworkCore.Tests` | 🔴 EMPTY | Chưa có test case |
| `BlueDental.HttpApi.Host.Tests` | 🔴 EMPTY | Chưa có test case |

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

### Sprint hiện tại — FE UI hoàn thiện

- [x] Tools sub-tabs (commit `3923baa`)
- [x] Appointment List filter bar (commit `981b857`)
- [x] Taxonomy group sidebar (commit `bfaa14a`)
- [ ] **FE-01** Calendar week view
- [ ] **FE-08** Report URL sync + remaining tabs
- [ ] **FE-09** Wire FE → BE (Patient, Appointment APIs)

### Sprint tiếp theo — BE bổ sung

- [ ] Reception/Visit domain + AppService + Controller + Migration
- [ ] Labo domain + AppService + Controller + Migration
- [ ] CustomerCare domain + AppService + Controller + Migration
- [ ] Staff AppService (wrap ABP Identity)
- [ ] Application Tests coverage

### Sprint cuối — Integration & Deploy

- [ ] FE API hooks kết nối BE thật (thay mock)
- [ ] E2E tests (Playwright)
- [ ] Docker compose verify
- [ ] Security review

---

## V. Commit Log (gần đây)

```
bfaa14a feat(taxonomy): improve service panel with searchable group sidebar
981b857 feat(appointments): add filter toolbar to appointment list view
80e824a docs(clone): add complete survey documentation for all 12 reference pages
3923baa feat(tools): implement sub-tabs for all 4 tool categories
18af2d6 fix(tools): fix sub-route labels to match reference
5388f76 feat(report): fix tab labels + implement revenue tab
dd3a1d7 feat(operations): fix tab labels + department sub-tabs
89e05c0 feat(account): implement account profile and change-password pages
8cd92eb feat(calendar): appointment creation form + doctor filter
a45cdd2 feat(patient-detail): implement remaining 6 tabs
```
