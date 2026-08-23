# Business Feature Map — Reference Application

Source: https://app.nfcdental.com (READ-ONLY observation, 2026-08-23)
API base: `https://api.nfcdental.com/api/v1`

All values below are **structure only**. No production patient data is recorded here.

Request conventions observed on every business call:

| Item | Value |
|------|-------|
| Auth | `Authorization: Bearer <JWT ES256>` |
| Branch scope | `x-branch-id: <objectId>` header **and** `branchId` query param |
| Language | `x-custom-lang: vi` |
| Envelope | `{ statusCode, message, data, metadata }` |
| Pagination | `page` + (`perPage` \| `take`) — offset based |
| Sorting | `sortBy` + `sortDirection` \| `orderBy=field:dir` |
| Realtime | socket.io polling transport at `/socket.io/` |

---

## 1. Reception — Tiếp nhận (`/reception`)

Endpoints:

```
GET /reception?branchId&startTime&toTime&page&take
GET /schedules/schedule_stats?branchId&startTime&toTime
GET /schedules/stats-by-time?branchId&startTime&toTime&dataType=logs
```

A reception record IS a schedule record enriched with check-in checkpoints.

```jsonc
{
  "id": "<objectId>", "patientId": "<objectId>", "staffId": "<objectId>",
  "startTime": "<date>", "toTime": "<date>", "duration": "<number>",
  "status": "done | late | ...",
  "logStatus": "arrived | done | ...",
  "logs": {
    "arrived":   { "checked": true, "dateTime": "<date>", "staffId": null },
    "reception": { "checked": true, "dateTime": "<date>", "staffId": null },
    "done":      { "checked": true, "dateTime": "<date>", "staffId": null }
  },
  "patientNote": { "text": "<string>", "key": "continue_schedule | end_treatment" },
  "isNewPatient": false, "isGenerated": false, "createFromReception": false,
  "fromTempt": false, "transferFromTempt": false, "tempPatient": null,
  "colorCode": "default", "cancelReason": null, "rescheduleAt": null,
  "reminderSuccess": false, "reminderNote": null, "laboOrderId": null,
  "comments": [], "searchMetaText": "<string>", "code": null,
  "patient": { "id", "name", "code", "phone", "dateOfBirth", "email" },
  "staff":   { "id", "name" }
}
```

Business rules observed:

- Reception timeline is a **3-checkpoint state machine**: `arrived -> reception -> done`.
  Each checkpoint stores its own timestamp and the staff who ticked it.
- A "lịch tạm" (temporary schedule) is a schedule with `fromTempt = true`;
  converting it sets `transferFromTempt = true` (UI counter "Chuyển đổi").
- Date range mode: Ngày / Tuần / Tháng -> `startTime`/`toTime` bounds.
- UI filter tabs: `Tất cả`, `Chờ khám`, `Đang khám`, `Hoàn thành` + doctor selector.
- Status counters: `Đã hẹn`, `Đã đến`, `Huỷ hẹn`, `Trễ hẹn`, `Lịch tạm`, `Chuyển đổi`.

---

## 2. Patient — Bệnh nhân (`/patient`, `/patient/:id`)

```
GET /patients?page&perPage&branchId[&q&status&doctorId&serviceId&tagId]
GET /patients/:id
GET /patients/tags
GET /patients/history?page&take&startTime&toTime&branchId&sortBy&sortDirection
GET /patient-timeline?patientId&page&take&sortDirection
GET /schedules/latest?patientId&branchId&sortBy&sortDirection&rootSchedule=true
```

Patient detail carries a denormalised financial rollup:

```jsonc
"patientSummary": {
  "treatmentStatus": "none | created | in-progress | done",
  "progress": 0,
  "staffIds": [], "serviceIds": [], "diagnosisIds": [],
  "payment": {
    "totalPrice": 0,            // tổng dự kiến thu
    "totalPaid": 0,             // đã thu
    "totalDue": 0,              // dự kiến thu còn lại
    "receivable": 0,            // phải thu
    "paidUncompleted": 0,       // đã thu của phần chưa hoàn tất
    "completedValue": 0,        // giá trị đã hoàn tất
    "totalRefund": 0,           // đã hoàn
    "debt": 0,                  // dư nợ
    "discount": 0,
    "outstandingDebt": 0,       // dư nợ tồn
    "outstandingDebtConsumed": 0,
    "prepaid": 0,               // trả trước / giữ hộ khách
    "carryOverAmount": null
  }
}
```

Other detail fields: `code` (patient code, pattern `<branchPrefix><yy><seq>`),
`gender`, `dateOfBirth`, `job`, `address`/`adressFull`, `country`, `note`,
`examinationReason: [{ id, isRoot, createdAt, content, note }]` (lý do đến khám, append-only log),
`diseaseHistoryIds` + `diseaseHistoryDetails`, `tags`, `hasZalo`,
`nextAppointmentAt`, `nextAppointmentNote`, `clinicDetails`, `branchDetails`.

Patient detail tabs (10): Hồ sơ, Chẩn đoán & Tư vấn, Kế hoạch điều trị, Lịch hẹn,
Hình ảnh, Labo, Đơn thuốc, Chăm sóc KH, **Hóa đơn (placeholder in the reference —
renders "Nội dung đang được hoàn thiện")**, Lịch sử dư nợ.

Profile tab treatment table filters: `Tất cả`, `Điều trị hoàn tất`, `Đang điều trị`,
`Các chẩn đoán`, `Tái khám`, `Bảo hành`.
Columns: Ngày, Dịch vụ, Nội dung điều trị, Răng, SL, Bác sĩ điều trị, Bác sĩ hỗ trợ,
Công đoạn, Chăm sóc sau điều trị, Thao tác.

---

## 3. Diagnosis & Consulting — Chẩn đoán & Tư vấn (`?tab=consulting`)

```
GET /patient-diagnoses?patientId&page&take
GET /patient-advises?patientId&page&status=created&take&sortBy=sortOrder&sortDirection=asc
GET /advise-groups?patientId&take&sortBy&sortDirection
```

### Tooth selection value object (used by diagnosis AND advise)

```jsonc
"content": [
  { "code": 18, "selected": true,
    "top": false, "right": false, "bottom": false, "left": false, "center": true }
]
```

`code` = FDI tooth number. The five booleans are the **tooth surfaces**
(top/right/bottom/left/center). `selected` marks whole-tooth selection.
This is the reference's dental-chart primitive — one row per tooth touched.

### PatientDiagnosis

```jsonc
{ "id", "patientId", "staffId", "staffSecondId", "diagnosisId", "clinicId",
  "content": [ /* tooth[] */ ], "note": "<string>", "contentDiagnosis": null,
  "code": "<string>", "status": "inProgress | ...", "hasTreatmentService": false,
  "staff": {...}, "staffSecond": null, "diagnosis": { "id", "name", "isDeleted", "content" } }
```

### PatientAdvise (tư vấn — the priced line item)

```jsonc
{ "id", "patientId", "code", "type": "advise",
  "staffId", "staffSecondId", "serviceId", "taxonomyId",
  "diagnosisId", "patientDiagnosisId", "patientTreatmentId",
  "price": 0, "originalPrice": 0, "quantity": 1,
  "discountType": "money | percentage", "discountValue": 0,
  "voucherDiscountAmount": null, "appliedCoupons": [],
  "status": "created | ...", "sortOrder": 0,
  "content": [ /* tooth[] */ ],
  "imageIds": [], "adviseGroupIds": [], "adviseGroupId": null,
  "dateTime": null, "note": null,
  "isDeleted": false, "deletedAt": null, "deletedBy": null,
  "service": { "id", "name", "price", "isImageRequired", "discountType", "discountValue", "stages": [] },
  "patientDiagnosis": { "id", "code", "note", "content": [...], "staff": {...} },
  "diagnosis": { "id", "name" }, "images": [] }
```

**Business chain**: `Diagnosis (catalog) -> PatientDiagnosis (per tooth) ->
PatientAdvise (priced, per service) -> grouped by AdviseGroup -> converted into
PatientTreatment (kế hoạch điều trị)`.

`service.isImageRequired` forces attaching an image before the advise can proceed.

---

## 4. Treatment Plan — Kế hoạch điều trị (`?tab=treatment-plan`)

```
GET /patient-treatments?patientId&page&take&sortBy=createdAt&sortDirection=desc
GET /patient-treatments/summary?patientId    ->  { active: [], recent: [] }
```

```jsonc
{ "id", "patientId", "code", "status": "done | in-progress | ...",
  "clinicId", "branchId", "staffId", "consultantStaffId",
  "progress": 100,
  "discountType": "percentage | money", "discountValue": 0,
  "voucherDiscountAmount": null, "appliedCoupons": [],
  "payment": { /* same 13-field payment rollup as patientSummary */ },
  "patientAdvises": [ { "id", "code", "type": "advise", "staffId", "staffSecondId",
                        "patientDiagnosisId", "patientDiagnosis": {...} } ],
  "treatmentServices": [ { "id", "serviceId", "service": { "id", "name" } } ],
  "staff": {...}, "patient": { "id", "name", "code" } }
```

`summary.recent[]`: `{ treatmentServiceId, treatmentId, treatmentCode, serviceName, stageNote }`.

TreatmentService (seen in the report payload) carries its own money + status:

```jsonc
{ "id", "code", "price", "quantity", "createdAt",
  "status": "in-progress | canceled | done",
  "effectiveAmount": 0,
  "payment": { "totalPrice", "totalPaid", "receivable", "debt", "prepaid" },
  "service": { "id", "name" } }
```

Treatment **stages** (công đoạn) are a separate concept — permission
`treatmentStage` has actions `read, create, update, continue, complete, print`,
and CSKH records reference `stageIds`. Stage payload not directly observed ->
`UNKNOWN_REFERENCE_BEHAVIOR`.

BlueDental implements the concept anyway, from the five facts that *were*
observed — the six verbs, the per-service "Thêm công đoạn" action, `stageIds` /
`patientStages[] = { id, serviceId, serviceDetails.isImageRequired }`,
`summary.recent[].stageNote`, and the Labo "Tiếp tục công đoạn" kind. Everything
beyond those is BlueDental's own design and is marked as an assumption in
`BlueDental.Domain/TreatmentManagement/TreatmentStage.cs`:

- a stage is a step of one **service line**, numbered 1..n inside it;
- `Pending -> InProgress -> Completed`, with **no cancel state** because the
  reference exposes no cancel verb on this subject;
- `complete` is reachable straight from `Pending`, because continue and complete
  are separate abilities and a user may hold only the latter;
- a service whose catalog entry has `isImageRequired` cannot have its stage
  completed until an image is attached;
- progress ("Trạng thái - Tiến độ") is derived from completed stages, never stored.

---

## 5. Appointments / Calendar — Lịch hẹn (`/calendar`)

```
GET /schedules?branchId&page&take&staffIds=<csv>&startTime&toTime
GET /schedules/schedule_stats?branchId&startTime&toTime   -> { da_hen, da_den, da_huy, tre_hen }
GET /schedules/stats-by-time?branchId&startTime&toTime&dataType=logs
GET /schedule-logs?patientId&page&take&fromDate&toDate
GET /user/me/preferences/calendar-doctor-filter
GET /time-keepings/doctors/work-status?branchId&date
```

- Two top-level tabs: **Lịch hẹn khách hàng** and **Lịch làm việc** (`?tab=timekeeping`).
- View modes: Ngày / Tuần / Tháng.
- Day grid: one column per doctor (8 observed, each with an appointment count),
  rows every 30 minutes from **06:00 to 23:30 (36 slots)**.
- Toolbar: Tìm kiếm, Chọn bác sĩ, Xuất File, **Tạo lịch hẹn mới**, **Tạo lịch tạm**.
- Status counters: Đã hẹn, Đã đến, Huỷ hẹn, Trễ hẹn, Lịch tạm, Chuyển đổi.
- The selected doctor filter is **persisted server-side per user** via
  `/user/me/preferences/calendar-doctor-filter`.
- `rootSchedule=true` distinguishes parent appointments from follow-ups.

---

## 6. Timekeeping — Lịch làm việc / Chấm công (`/calendar?tab=timekeeping`)

**Module missing from earlier BlueDental discovery docs.**

```
GET /time-keepings/list?branchId&startDate&endDate&page&perPage
GET /time-keepings/records
GET /time-keepings/doctors/work-status?branchId&date
GET /staff/list?branchId&status=active&workStatus=working&page&perPage
```

KPI bar: `Tổng CBNV`, `Đăng kí làm`, `Đăng kí nghỉ`, `Đang làm việc`,
`Nghỉ ngang`, `Giờ tăng ca` (HH:MM).

Per-staff card:

| Element | Meaning |
|---------|---------|
| OFF / ON toggle | register working / off for the day |
| Vị trí | position (Bác sĩ, Nhân viên) |
| LỊCH LÀM VIỆC | two shifts — `08:00 - 12:00`, `13:00 - 17:00` |
| VÀO CA - RA CA | actual check-in / check-out per shift (`-- / --` when absent) |

Permission `workSchedule` = `read, update, attendanceOthers`
(`attendanceOthers` = clock in/out on behalf of another staff member).

---

## 7. Customer Care — CSKH (`/cskh-grouping`, `?tab=care`)

```
GET /customer-care?branchId&type&isDeleted=false&overview=false&hydrate=compact
                  &sortBy=dateTime&sortDirection=desc&startTime&toTime&page&take
GET /customer-care-stats?branchId&type&isDeleted&overview&hydrate&startTime&toTime
GET /customer-care?patientId&isDeleted=false&overview=false&page&take   // patient tab
```

Care types (UI tabs -> `type` param):

| UI | `type` |
|----|--------|
| Sau điều trị | `afterTreatment` |
| Chúc mừng sinh nhật | (birthday — value not observed) |
| Nhắc lịch hẹn | (appointment reminder — not observed) |
| CSKH định kì | (periodic — not observed) |
| CSKH đặc biệt | (special — not observed) |

Record shape:

```jsonc
{ "id", "patientId", "clinicId", "branchId", "staffId", "careStaffId",
  "dateTime", "scheduleStartTime", "scheduleToTime",
  "type": "afterTreatment", "status": "new | ...",
  "subject": "<string>", "note": "<string>", "code": "<string>",
  "taxonomyId": "<objectId>",        // care_service taxonomy
  "stageIds": ["<objectId>"],        // treatment stages being followed up
  "patientStages": [ { "id", "serviceId", "serviceDetails": { "name", "isImageRequired" } } ],
  "patientDetails": { "id", "name", "code", "phone", "dateOfBirth", "gender", "nextAppointmentDate" },
  "staffDetails": {...}, "careStaffDetails": null, "taxonomyDetails": null }
```

Grouping page stats: `Tổng khách`, `Thành công`, `Thất bại`, `Chưa CS`, `Đã gửi Zalo`.
Patient-tab stats: `Đã chăm sóc`, `Tốt`, `Khá`, `Bình thường`, `Khiếu nại`,
`Đặc biệt`, `Định kỳ`, `Cơ bản`.
Table columns: Ngày chăm sóc, Trạng thái CSKH, Nhóm, Dịch vụ, Nội dung,
Bác sĩ điều trị, Nhân viên chăm sóc, Đánh giá, Thao tác.

---

## 8. Prescriptions — Đơn thuốc (`?tab=prescription`)

```
GET /prescriptions?patientId&page&take
```

Table columns: Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám, Ngày tạo, Thao tác.
Permission `prescription` = CRUD + export. Template source: `/medicine-template/list`.

---

## 9. Patient Images — Hình ảnh (`?tab=image`)

```
GET /patient-images?patientId&take&page
```

Images are referenced by advises via `imageIds`; `service.isImageRequired`
makes an image mandatory for certain services.

---

## 10. Labo (`/labo/*`, `?tab=labo`)

```
GET /orders?page&perPage&branchId&orderBy=createdAt:desc          // labo orders (Mẫu Labo)
GET /clinic-orders?patientId&branchId&page&perPage&orderBy         // patient tab
GET /clinic-order-status?patientId&branchId                        // { created, guarantee, continue, total }
```

Sub-routes: Mẫu Labo, Nhà cung cấp Labo, Khớp cắn Labo, Đường hoàn tất,
Kiểu nhịp Labo, Dịch vụ - vật liệu
(permissions `laboTemplate`, `laboSupplier`, `laboBite`, `laboFinishLine`,
`laboRhythm`, `laboMaterial`).

Mẫu Labo filters: `Tất Cả Mẫu`, `Mẫu Chưa Nhận`, `Mẫu Giao Trễ`, `Mẫu Đã Nhận Hàng`
plus customer selector, doctor selector, date mode and Xuất Excel.
Columns: Nhà cung cấp / Ngày tạo, Tên khách hàng, Ngày gửi / Tình trạng mẫu,
Ngày giao / Trạng thái Labo, Bác sĩ chỉ định, Vật liệu, Răng,
File phòng khám gửi về, Thao tác.

Patient-tab counters: `Đơn hàng mới` (`created`), `Tiếp tục công đoạn` (`continue`),
`Bảo hành` (`guarantee`).

---

## 11. Materials — Vật tư (`/materials/*`)

```
GET /taxonomy/?group=supplies&branchId&perPage&includeCount=true
GET /supplies/list?branchId&perPage
```

Sub-routes: Vật tư phòng khám, Phân bổ vật tư, Phòng ban.
Left panel = supply groups (taxonomy `supplies`), right panel = supply table.
Columns: Tên vật liệu, Nhóm phân loại, Nhập kho, Hạn sử dụng, Cảnh báo hết hạn,
Tồn kho, Trạng thái, Nhà cung cấp, Xuất xứ, Giá nhập, Giá bán, Thao tác.
Toolbar: Thêm vật tư, Tìm kiếm, **Sync data hệ thống**.
Permission `materials` includes `approve` (material request approval).

---

## 12. Taxonomy / Danh mục (`/taxonomy/*`)

Generic pattern — every catalog is `taxonomy group` (left panel) + entity list (right panel):

```
GET /taxonomy/?group=<group>&branchId&perPage&includeCount=true
GET /<entity>/list?branchId&page&perPage&taxonomyId=<groupId>
```

| Sub-route | taxonomy `group` | Entity list endpoint |
|-----------|------------------|----------------------|
| `/taxonomy/service` | `care_service` | `/care-service/list` |
| `/taxonomy/diagnosis` | `diagnosis` | `/diagnosis/list` |
| `/taxonomy/medicine` | `medication_type` | `/medicine/list` |
| `/taxonomy/consulting` | `consulting_data` | (taxonomy only) |
| `/taxonomy/source` | `source` | `/source/list` |
| `/taxonomy/history` | `disease_history` | `/disease-history/list` |
| `/taxonomy/prescription-template` | `prescription_template` | `/medicine-template/list?group=prescription_template` |
| `/taxonomy/medical-record-template` | `medical_record_template` | `/medical-record/template/list` |
| `/taxonomy/tags` | — | `/medical-record/tag/list?orderBy=createdAt` |
| `/taxonomy/payment-method` | — | `/setting/system?module=payment_method` + `/payment-method/list?type=momo\|bank` |
| `/taxonomy/occupation` | `occupation` | (taxonomy only) |
| (materials) | `supplies` | `/supplies/list` |

Taxonomy item shape:

```jsonc
{ "id", "name", "alias", "color": "#RRGGBB", "description",
  "group", "subGroup", "ownerType", "clinicId", "branchId", "laboId",
  "isSystem": false, "order": 0, "externalId": null, "isDeleted": false,
  "itemCount": 0 }
```

Payment methods are **accounts**, not enum values: MoMo accounts
(Số điện thoại, Tên chủ tài khoản) and Bank accounts.

---

## 13. Reports — Báo cáo (`/report`)

Shared toolbar: date mode `Ngày | Tuần | Tháng | Năm` (`report_dateMode`, `report_date`)
plus a doctor filter. Four tabs via `reportTab`.

### 13.1 Doanh số và lượt khách (default)

```
GET /patients/history?page&take=500&startTime&toTime&branchId&sortBy&sortDirection
GET /payment-stat/summary?startTime&toTime&branchId&period=daily|weekly|monthly|yearly
```

Sub-filters: `Khách hàng phát sinh dịch vụ`, `Thanh toán`, `Hoàn tiền`, `Dư nợ`.
Columns: Ngày, Tên khách hàng, Nhân sự tư vấn, Bác sĩ tiếp nhận, Dịch vụ điều trị,
Số lượng, Thành tiền, Đã thanh toán.
Cancelled services render as `<service>(đã hủy)` with a **negative** amount.

`payment-stat/summary` — the finance rollup contract:

```jsonc
{ "totalPrice", "totalPaid", "totalRefund",
  "byCash", "byBanking", "byCard", "byOutstandingDebt",
  "refundByCash", "refundByBanking", "refundByCard",
  "totalIncome", "totalExpense",
  "totalIncomeByCash", "totalIncomeByBanking",
  "totalExpenseByCash", "totalExpenseByBanking",
  "totalOutstandingDebt", "totalRefundOutstandingDebt",
  "totalArisingOutstandingDebt", "totalArisingPrepaid", "totalPrepaid",
  "totalDebtTopup", "totalReplaceCarryoverOutstandingDebt",
  "totalActualReceived" }
```

-> **Payment methods are `cash | banking | card | outstandingDebt`.**

`patients/history` row (the revenue ledger entry):

```jsonc
{ "id", "index", "clinicId", "clinic", "branchId", "branch",
  "patientId", "patient", "staffId", "staff",
  "consultantStaffIds", "consultantStaffs", "subStaffId", "subStaff",
  "serviceIds", "services",
  "treatmentServiceIds", "treatmentServices",
  "replaceServiceIds", "replaceServices",
  "cancelServiceIds", "cancelServices",
  "date", "week", "month", "year",
  "isReplace", "isNewPatient",
  "payment": { "totalPrice", "totalPaid", "totalRefund", "receivable",
               "debt", "totalOutstandingDebt", "prepaid" },
  "actionType": "<string>", "walletAction": null,
  "correlationKey": "<string>", "effectiveAmount": 0 }
```

### 13.2 Quản lý thu chi (`reportTab=cashflow`)

```
GET /sales?page&perPage&branchId&startTime&toTime&type=income|expense&orderBy=date:desc[&approved=true|false]
GET /sales/stats?branchId&startTime&toTime
```

Sub-tabs: `Thu nhập`, `Chi phí`, `Danh mục`. Toolbar: Xuất Excel, Thêm mới.
Columns: Ngày tạo, Khách hàng, Nội dung thu, Nhân viên thu, Mục thu, Doanh thu,
Hình thức, Thao tác.
Footer panel "Thông tin thu chi": Hôm nay / Tuần này / Tháng này / Năm nay / Toàn bộ,
each rendered as `thu / chi`.
Expenses carry an **approval flag** (`approved`) — matches `reportCost.approve`.
Categories = `reportCashflowCategory` (CRUD).

### 13.3 Kết quả kinh doanh (`reportTab=result`)

```
GET /result-stat/summary?branchId&startTime&toTime&period=monthly
```

Rows: Doanh thu tổng, Thu từ dịch vụ điều trị, Thu khác,
Hoàn tiền từ dịch vụ điều trị, Chi phí, **Kết quả kinh doanh**.

### 13.4 Luân chuyển dòng tiền V2 (`reportTab=cashflow-v2`)

```
GET /cash-management/balance?branchId
GET /cash-management/cashflow-overview?branchId&fromDate&toDate
GET /cash-management/cashflow-entries?branchId&fromDate&toDate&page&take
```

Sub-tabs `Tổng quan` / `Danh mục`; actions **Luân chuyển**, **Nạp**, **Rút**
(= `reportTransfer.transfer | deposit | withdraw`).
Summary panels: `Tổng Tiền`, `Tổng Tiền Mặt`, `Tổng Chuyển Khoản`,
`Đang Giữ Hộ Khách` (customer prepaid held by the clinic), plus `Doanh thu dịch vụ`.
Columns: Ngày, Loại giao dịch, Hình thức, Danh mục, Số tiền, Người tạo, Ghi chú, Thao tác.
Categories = `reportTransferCategory` (CRUD).

---

## 14. Operations — Quản trị vận hành (`/operations/*`)

8 departments x sections. Section semantics come from the permission names:

| Section | Type |
|---------|------|
| Trang chủ (`Home`) | article/announcement list, CRUD |
| Quy trình (`Process`) | SOP article list, CRUD |
| Công việc (`Task`) | task list, CRUD |
| Báo cáo (`Report`) | read + export |
| Truy cập (`Access`) | read + export |
| Chẩn đoán chưa điều trị (`Diagnosis`) | read + export |
| Đơn thuốc (`Prescription`) | read + export |
| Khách hàng phát sinh / Hóa đơn (`Invoice`) | read + export |
| Hoàn thành theo dịch vụ (`ServiceComplete`) | read + export |

`/operations/finance?financeSubTab=invoice` — **VAT e-invoice register**:
Ngày tạo, Số hóa đơn, Tên bệnh nhân, Tên đơn vị, Hình thức thanh toán,
Trạng thái hóa đơn, Trạng thái, Tổng trước VAT, Tổng VAT, Tổng tiền,
Nhà cung cấp, Thao tác. Filter: `Tất cả trạng thái`.

---

## 15. Voucher (`/voucher`) — not in sidebar

```
GET /voucher/stats
GET /voucher/list?page
GET /voucher/available?customerTarget=returning|new|...
```

Stats: `Tổng voucher`, `Đang hoạt động`, `Đã phát hành`, `Đã hết hạn`.
Columns: Mã / Tên Voucher, Mức giảm, Điều kiện áp dụng, Thời hạn, Lượt dùng,
Trạng thái, (issuer), Thao tác.
`/voucher/available` is called on the patient screen -> vouchers are applied to
advises/treatments (`appliedCoupons`, `voucherDiscountAmount`).

---

## 16. Staff & Identity (`/staff`)

```
GET /staff/list?page&perPage&branchId[&status=active&isResigned=false][&isDoctor=true][&workStatus=working]
GET /user/profile
GET /user/me/permissions
GET /user/me/preferences/<key>
```

Filter tabs: `Tất cả`, `Đang làm việc`, `Đã nghỉ`.
Columns: Tên, Số điện thoại, Email, **Phân quyền** (role), Địa chỉ, Thao tác.
Staff record carries per-shift working hours (`morning*`, `afternoon*`),
flags `isDoctor`, `isDentalAssistant`, `isPhysician`, `isStaff`, `isResigned`,
and `branchIds[]` (multi-branch assignment).
Role names observed in the list: Quản lý phòng khám, Bác Sĩ Điều Trị, Lễ Tân, Kế Toán.

---

## 17. Tools — Công cụ (`/tools/*`)

```
GET /clinic-configure?module=call|message|zalo-oa|invoice&branchId&page&perPage
```

Sub-routes: Gọi thoại, Tin nhắn, Zalo OA, Hóa đơn.
The call module has sub-tabs `Cấu Hình`, `Phân Công Gọi`, `Danh Sách Cuộc Gọi`.
Config table: Tên, Chi nhánh, Loại cài đặt, Nhà cung cấp, Trạng thái, Thao tác.
Permissions: `toolCall`, `toolMessage`, `chatbot`.

---

## 18. Platform / Shell

```
GET /maintenance/status
GET /branch/public
GET /clinic/detail
```

Header chrome: global search (khách hàng, lịch hẹn, nhân viên), clinic/branch
switcher, language switcher (VI/EN), notifications, user menu.
Clinic identity (logo, name, slogan) is served by `/clinic/detail`.

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Item | Reason |
|---|------|--------|
| 1 | All POST/PUT/PATCH/DELETE contracts | Mutating — never triggered against production |
| 2 | Ability sets of non-admin roles | Would require logging in as those roles |
| 3 | CSKH `type` values other than `afterTreatment` | Tab switch not exercised |
| 4 | Treatment **stage** payload | No patient with active stages inspected. BlueDental implements its own model (see `TreatmentStage`); the shape is an assumption, not observed parity |
| 5 | Full `status` enum domains (treatment, advise, schedule) | Only values present in data observed |
| 6 | `actionType` / `walletAction` vocabulary in `/patients/history` | Only one value present |
| 7 | Operations article/task payloads | No API call fired for those sub-tabs |
| 8 | E-invoice (VAT) provider integration | No data present |
| 9 | socket.io event names/payloads | Only the polling transport was observed |
| 10 | `/patient?tab=debt` | Route renders the profile tab; the real debt-history param is unknown |
