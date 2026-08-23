# BlueDental — Progress Report

Cập nhật lần cuối: 2026-08-23 (session 6, đợt 3)

---

## Session 6 — Bổ sung nghiệp vụ từ quan sát read-only app gốc

Nguồn: `docs/clone/business-features.md` + `docs/clone/permissions.md`
(quan sát READ-ONLY https://app.nfcdental.com, không ghi bất kỳ dữ liệu nào).

### Phát hiện chính

| # | Phát hiện | Ảnh hưởng |
|---|-----------|-----------|
| 1 | App gốc dùng ability model `(action, subject)` — 83 subject cho role `clinicAdmin` | Cần map sang ABP permissions |
| 2 | Chuỗi nghiệp vụ lõi: Chẩn đoán → Tư vấn → Kế hoạch điều trị → Dịch vụ → Công đoạn → Thanh toán | Trước đây clone thiếu hẳn 2 mắt xích đầu |
| 3 | Sơ đồ răng lưu theo `{ code, selected, top, right, bottom, left, center }` | ToothSelection value object |
| 4 | Money rollup 13 trường lặp lại ở patient / treatment / service | PaymentSummary value object |
| 5 | Module **Chấm công** (`/calendar?tab=timekeeping`) chưa từng được ghi nhận | Đã implement mới |
| 6 | Thu chi có bước **duyệt** cho phiếu chi; luân chuyển dòng tiền có 3 holding | Đã implement mới |
| 7 | Voucher áp vào tư vấn/điều trị (`appliedCoupons`) | Đã implement mới |
| 8 | Tab "Hóa đơn" của hồ sơ bệnh nhân ở app gốc **cũng là placeholder** | Không cần clone nội dung |
| 9 | Lưới lịch ngày là 06:00–23:30 (36 slot), không phải 48 | FE hiện đã đúng |

### Module BE đã bổ sung trong session này

| Module | Entity / VO | API | Migration | Tests |
|--------|-------------|-----|-----------|-------|
| Chẩn đoán & Tư vấn | `PatientDiagnosis`, `PatientAdvise`, `AdviseGroup`, `ToothSelection`, `PaymentSummary` | `/api/v1/app/{patient-diagnoses,patient-advises,advise-groups}` | `AddClinicalConsultingModule` | 33 |
| Chấm công | `TimeKeepingRecord`, `WorkShift` | `/api/v1/app/time-keepings` | `AddTimekeepingModule` | 18 |
| Thu chi & Dòng tiền | `SalesEntry`, `CashflowCategory`, `CashflowEntry` | `/api/v1/app/{sales,cashflow-categories,cash-management}` | `AddFinanceModule` | 21 |
| Voucher | `Voucher` | `/api/v1/app/vouchers` | `AddVoucherModule` | 14 |
| Danh mục (taxonomy) | `Taxonomy`, `CatalogEntry`, `TaxonomyGroups` | `/api/v1/app/{taxonomies,catalog-entries}` | `AddTaxonomyModule` | 23 |
| Phân quyền (ability model) | `BlueDentalAbilities` (83 subject) | Đăng ký qua `PermissionDefinitionProvider` | — | 12 |

Tổng test BE: **254 pass** (149 domain + 51 application + 39 EF + 15 HttpApi).

### FE đã bổ sung

- `features/timekeeping/` — API hooks + `TimekeepingBoard` (KPI bar + thẻ nhân viên
  với ON/OFF, 2 ca, vào ca/ra ca), thay placeholder ở tab "Lịch làm việc".
- `features/treatment-management/api/consulting*` — nối 2 bảng Phiếu chẩn đoán /
  Phiếu tư vấn ở tab "Chẩn đoán & Tư vấn" vào API thật (trước đó `dataSource={[]}`).
- `features/report/api/financeApi.ts` — nối tab "Quản lý thu chi" và
  "Luân chuyển dòng tiền V2" vào BE finance; tab V2 được dựng lại đúng theo app gốc
  (4 panel số dư + bảng giao dịch) thay cho báo cáo lưu chuyển tiền tệ tự chế.
- `lib/clinicBranch.ts` — điểm tập trung `branchId` cho tới khi có branch switcher.
- Sửa 2 test ReceptionPage đã lỗi thời (label "Chờ khám", dialog là Modal).

Build FE production: OK. Typecheck: sạch. Unit test FE: 3/3 pass.

### Hạng mục A–G — ĐÃ HOÀN THÀNH (session 6, đợt 2)

| # | Hạng mục | Kết quả |
|---|----------|---------|
| A | Form tạo/sửa Thu chi, Luân chuyển, Voucher | ✅ Dialog tạo/sửa phiếu thu-chi (tạo mục inline), duyệt/từ chối, Nạp/Rút/Luân chuyển, và trang `/voucher` |
| B | Dental chart theo mặt răng | ✅ `ToothSurfaceChart` — 5 mặt/răng, chọn cả răng, shortcut Hàm Trên/Dưới/Nguyên Hàm |
| C | Gắn ability lên endpoint | ✅ 447 hằng số permission; attribute trên toàn bộ AppService; check động cho thu/chi, danh mục, 3 thao tác tiền mặt, 12 danh mục và `attendanceOthers` |
| D | FE Danh mục dùng API taxonomy | ✅ 1 panel cấu hình cho 9 danh mục thật; 2 danh mục còn lại nêu rõ lý do |
| E | Treatment stage (công đoạn) | ✅ Đã implement ở đợt 3 — **model là giả định của BlueDental**, không phải parity; xem mục "Đợt 3" |
| F | `docs/testing/*` registry | ✅ 4 file gốc + 4 file feature |
| G | Acceptance test full-stack thật | ✅ 27 test Playwright trên Postgres + API + Vite thật, không mock |

### Bug thật phát hiện khi chạy stack thật (đã sửa)

Chi tiết: `docs/testing/03-regression-log.md` — 9 lỗi, nghiêm trọng nhất:

- Danh sách bệnh nhân **crash** ngay khi có 1 bệnh nhân (bind thẳng DTO server vào bảng)
- **Không thể tạo bệnh nhân**: ô "Họ và tên" bind `lastName` nhưng schema còn bắt buộc `firstName`
- Request tạo bệnh nhân sai contract (`phone` / thiếu `branchId` / `dateOfBirth` rỗng)
- **Trùng `PatientCode`** do cắt 6 ký tự đầu của GUID tuần tự → 500 ở lần đăng ký thứ hai trong ngày
- Enter trong dialog vừa commit ngày vừa submit form → gửi trùng

### Đợt 3 — 5 hạng mục còn lại đã xong

| # | Hạng mục | Kết quả |
|---|----------|---------|
| 1 | Dialog tạo phiếu chẩn đoán / tư vấn | ✅ `DiagnosisModal` + `AdviseModal`, và thêm thao tác **Chấp nhận** cho phiếu tư vấn (thiếu nó thì không thể có dòng dịch vụ điều trị) |
| 2 | Acceptance cho Voucher | ✅ `e2e/voucher.spec.ts` — 3 test |
| 3 | Check-in/out chấm công qua UI | ✅ "Mở ngày làm việc" rồi Vào ca / Ra ca thật; mỗi lần chạy dùng một ngày mới |
| 4 | CSKH / Labo / Vật tư / Vận hành | ✅ 4 module BE đầy đủ (domain + AppService + controller + migration) và FE nối API thật; mỗi module có spec riêng |
| 5 | Branch isolation | ✅ Seed chi nhánh 2 + tài khoản `branch2`; `e2e/branch-isolation.spec.ts` chứng minh bị chặn và không rò dữ liệu |
| 6 | Công đoạn điều trị | ✅ `TreatmentStage` + API + panel FE + 2 acceptance test — xem cảnh báo bên dưới |

#### Cảnh báo về công đoạn điều trị

App gốc **không có dữ liệu công đoạn nào quan sát được an toàn**, nên đây không
phải bản clone 1:1. Chỉ 5 điều được quan sát thật (subject `treatmentStage` với 6
verb, nút "Thêm công đoạn" theo từng dòng dịch vụ, `stageIds` /
`patientStages[].serviceDetails.isImageRequired` trong CSKH, `stageNote` trong
treatment summary, và loại Labo "Tiếp tục công đoạn"). Toàn bộ phần còn lại —
số thứ tự, chọn răng, mốc thời gian, quy tắc bắt buộc ảnh — là thiết kế riêng của
BlueDental và được ghi rõ trong `TreatmentStage.cs`,
`docs/clone/business-features.md` và `docs/testing/features/treatment-stage.md`.

Chuỗi nghiệp vụ đang chạy thật: `Chẩn đoán → Tư vấn → Chấp nhận → Công đoạn →
Tiếp tục → Hoàn thành`.

### Bug thật phát hiện thêm ở đợt 3

- `TreatmentStage` được map trong `ModelCreatingExtensions` nhưng thiếu `DbSet`
  → ABP không đăng ký repository mặc định → **mọi request công đoạn 500**
  (R-10). Build sạch, migration chạy được, unit test pass — chỉ browser thật gọi
  DI thật mới lộ ra.
- Bảng phiếu tư vấn không có nút chấp nhận nên không đời nào tạo được dòng dịch
  vụ điều trị (R-11).

### Còn lại

| # | Hạng mục | Ghi chú |
|---|----------|---------|
| 1 | Lịch hẹn: tạo/sửa lịch qua UI | Lưới ngày/tuần/tháng đã dựng; chưa có acceptance cho thao tác ghi |
| 2 | Tiếp nhận | Vẫn còn fallback mock khi API lỗi |
| 3 | Báo cáo doanh số | Đọc API thật nhưng chưa assert số liệu |
| 4 | Đính kèm ảnh cho công đoạn qua UI | Endpoint + rule domain đã có, FE chưa có uploader |
| 5 | Công cụ (call / message / Zalo / hóa đơn điện tử) | `UNKNOWN_REFERENCE_BEHAVIOR` — app gốc không có dữ liệu |

---

# BlueDental — Progress Report

Cập nhật lần cuối: 2026-08-22 (session 5)

---

## Tóm tắt nhanh

| Layer | Status | Ghi chú |
|-------|--------|---------|
| Frontend UI (FE) | 🟢 ~97% | Tất cả trang hoàn chỉnh; Calendar week+month, Report 4 tabs, CSKH grouping |
| Backend API (BE) | 🟢 ~90% | Build clean 0 errors; AccountAppService; 401/403 API auth; BE Dockerfile |
| FE ↔ BE Integration | 🟢 ~80% | Auth, Patient, Appointment, Staff, Visit, Report, Billing — all call real BE; mock fallback reception |
| Tests | 🟢 ~95% | 82 tests (15 domain + 34 application + 18 EF + 15 HttpApi) — tất cả pass |
| Docker / Deploy | 🟡 ~70% | docker-compose.yml + FE Dockerfile (VITE_API_URL arg) + BE Dockerfile; seed contributor BD-001; chưa verify end-to-end |

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
| `BlueDental.HttpApi.Host.Tests` | ✅ 15/15 PASS | Controller convention tests — route, auth, [RemoteService] |

---

## III. Integration (FE ↔ BE)

| Feature | Status | Ghi chú |
|---------|--------|---------|
| Auth (login/logout) | ✅ WIRED | `/api/account/login` + `/api/app/account/current-user` |
| Patient List API | ✅ WIRED | `usePatientList` → GET `/api/v1/app/patients` |
| Appointment Calendar API | ✅ WIRED | `useDentistList` → GET `/api/v1/app/staff`; fallback doctors |
| Reception API | 🟡 PARTIAL | GET/POST `/api/v1/app/visits`; mock fallback khi BE offline |
| Report API | ✅ WIRED | GET `/api/v1/app/reports/revenue` |
| Billing API | ✅ WIRED | GET/POST `/api/v1/app/invoices` |
| Notifications API | ✅ WIRED | GET `/api/v1/app/notifications` (30s polling) |
| Labo API (catalog) | N/A | Labo page là catalog UI — không cần hook |

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
- [x] HttpApi.Host.Tests controller convention tests — 15 tests, ALL PASS (commit `d303bf3`)
- [ ] Docker full-stack verification — PENDING

### Sprint cuối — Integration & Deploy

- [ ] FE API hooks kết nối BE thật (thay mock)
- [ ] E2E tests (Playwright)
- [ ] Docker compose verify
- [ ] Security review

---

## V. Commit Log (gần đây)

```
8ce9d3e feat(be): add default ClinicBranch data seeder + fix unused parameters
bf4fa17 fix(fe): update reception API to use /v1/app/visits endpoint
7699fe3 feat(fe): wire calendar and reception doctor lists to real staff API
f5beb86 docs: update progress report — 82 tests all pass, HttpApi tests complete
d303bf3 test(be): add HttpApi controller convention tests (82 tests total, all pass)
6ba6f29 fix(be): return 401/403 for API routes instead of redirects
4b54ff8 build(be): add Dockerfile for multi-stage BE container build
60d01bd fix(fe): update vite proxy port to 5019 and wire auth API to AccountAppService
45e15c4 test(be): add Visit and Labo AppService contract tests (34 Application tests total)
ce19086 feat(be): add AccountAppService for current user profile
```
