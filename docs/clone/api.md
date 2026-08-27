# API Observations — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21 / 2026-08-22

## Technology Stack

The reference application is:
- **Frontend**: Next.js with React Server Components (RSC), Turbopack build
- **Backend API**: Separate REST API at `https://api.nfcdental.com/api/v1/`
- **API version**: `"version":"1"`, `"repoVersion":"8.2.2"`

## Base URL

```
https://api.nfcdental.com/api/v1/
```

All endpoints require `branchId` (24-char MongoDB hex ObjectId) in query params.

## Authentication

UNKNOWN_REFERENCE_BEHAVIOR — auth mechanism not directly observed.
Requests include bearer token or session cookie (not captured per production data rules).

---

## Endpoint Reference

### Patients

```
GET  /api/v1/patients
     ?page=1&perPage=20&branchId=<id>
     [&status=<status>]
     [&doctorId=<id>]
     [&serviceId=<id>]
     [&tagId=<id>]
     [&q=<search>]

GET  /api/v1/patients/:id

GET  /api/v1/patients/tags
     Response: [{ id, name, color }]
     Sample tags: "Chỉnh Nha" (#F59E0B), "Implant" (#3B82F6),
                  "Tư Vấn Chỉnh Nha" (#EF4444), "Tổng quát" (#10B981)
```

**Patient list response fields per item:**
```json
{
  "id": "<string>",
  "name": "<string>",
  "code": "<string>",
  "phone": "<string>",
  "hasZalo": null,
  "dateOfBirth": "<ISO date>",
  "branchId": "<string>",
  "branchName": "<string>",
  "treatmentStatus": "none|in-progress|done|created",
  "staffIds": ["<string>"],
  "staffNames": ["<string>"],
  "totalDebt": 0,
  "totalRevenue": 0,
  "totalAmount": 0,
  "serviceNames": ["<string>"],
  "lastAppointmentDate": "<ISO date>",
  "lastTreatmentDate": "<ISO date>",
  "createdAt": "<ISO date>",
  "schedule": {
    "nextAppointmentDate": "<ISO date>",
    "currentAppointmentDate": "<ISO date>",
    "currentTreatmentDate": "<ISO date>"
  }
}
```

**Patient treatmentStatus enum:**
| API value | UI label (VI) | UI label (EN) |
|-----------|--------------|---------------|
| `none` | Chưa phát sinh | No Activity |
| `created` | Chưa phát sinh | No Activity |
| `in-progress` | Đang điều trị | In Treatment |
| `done` | Hoàn tất | Completed |

**Patient detail response additional fields:**
```json
{
  "gender": "male|female|other",
  "address": "<string>",
  "adressFull": "<string>",
  "city": "<string>",
  "district": "<string>",
  "note": "<string>",
  "examinationReason": ["<string>"],
  "country": "<string>",
  "diseaseHistoryIds": ["<string>"],
  "diseaseHistoryDetails": [{}],
  "tags": [{}],
  "patientSummary": {
    "payment": 0,
    "patientId": "<string>",
    "clinicId": "<string>",
    "branchId": "<string>",
    "treatmentStatus": "<string>",
    "progress": 0,
    "staffIds": ["<string>"],
    "serviceIds": ["<string>"],
    "diagnosisIds": ["<string>"],
    "updatedAt": "<ISO date>"
  },
  "nextAppointmentNote": "<string>",
  "nextAppointmentAt": "<ISO date>"
}
```

---

### Appointments (Schedules)

```
GET  /api/v1/schedules
     ?patientId=<id>&branchId=<id>
     &page=1&take=20
     &sortBy=startTime&sortDirection=desc
     &rootSchedule=true

GET  /api/v1/schedules/schedule_stats
     ?patientId=<id>&branchId=<id>
     &rootSchedule=true
     &startTime=2000-01-01&toTime=2099-12-31
     Response: { da_hen, da_den, da_huy, tre_hen }

GET  /api/v1/schedules/stats-by-time
     ?patientId=<id>&branchId=<id>&rootSchedule=true
     &startTime=<date>&toTime=<date>&dataType=logs

GET  /api/v1/schedule-logs
     ?patientId=<id>&page=1&take=20
     &fromDate=<date>&toDate=<date>
```

---

### Treatments

```
GET  /api/v1/patient-treatments
     ?patientId=<id>&page=1&take=20
     &sortBy=createdAt&sortDirection=desc

GET  /api/v1/patient-treatments/summary
     ?patientId=<id>
     Response: { active: [], recent: [] }
```

---

### Diagnoses & Consulting

```
GET  /api/v1/patient-diagnoses
     ?patientId=<id>&page=1&take=20

GET  /api/v1/patient-advises
     ?patientId=<id>&page=1&status=created&take=20
     &sortBy=sortOrder&sortDirection=asc

GET  /api/v1/advise-groups
     ?patientId=<id>&take=20
     &sortBy=createdAt&sortDirection=asc
```

---

### Patient Images

```
GET  /api/v1/patient-images
     ?patientId=<id>&take=25&page=1
```

---

### Labo (Clinic Orders)

```
GET  /api/v1/clinic-orders
     ?patientId=<id>&branchId=<id>
     &page=1&perPage=20&orderBy=createdAt:desc

GET  /api/v1/clinic-order-status
     ?patientId=<id>&branchId=<id>
     Response: { data: [{ created: 0, guarantee: 0, continue: 0, total: 0 }] }
```

**Status counters:**
| API field | UI label (VI) | Color |
|-----------|--------------|-------|
| `created` | Đơn hàng mới | Green |
| `continue` | Tiếp tục công đoạn | Orange |
| `guarantee` | Bảo hành | Red/Pink |

---

### Patient Timeline

```
GET  /api/v1/patient-timeline
     ?patientId=<id>&page=1&take=20&sortDirection=desc
```

---

### Staff

```
GET  /api/v1/staff/list
     ?page=1&perPage=20&status=active
     &isResigned=false&branchId=<id>
     [&isDoctor=true]

Response fields per staff:
{
  "id": "<string>",
  "fullName": "<string>",
  "email": "<string>",
  "phoneNumber": "<string>",
  "role": "<string>",
  "clinic": "<string>",
  "status": "active|inactive",
  "isDoctor": true,
  "isDentalAssistant": false,
  "isPhysician": false,
  "morningStartTime": "<time>",
  "morningEndTime": "<time>",
  "afternoonStartTime": "<time>",
  "afternoonEndTime": "<time>",
  "branchIds": ["<string>"],
  "avatarUrl": "<string>",
  "isDeleted": false,
  "isStaff": true,
  "isResigned": false
}
```

---

### Taxonomy / Catalogs

```
GET  /api/v1/taxonomy/
     ?group=<group>&branchId=<id>&perPage=50

Groups observed: "care_service"

Response fields per item:
{
  "id": "<string>",
  "name": "<string>",
  "alias": "<string>",
  "color": "<hex>",
  "description": "<string>",
  "group": "care_service",
  "subGroup": "<string>",
  "ownerType": "<string>",
  "clinicId": "<string>",
  "branchId": "<string>",
  "laboId": null,
  "isSystem": false,
  "order": 0,
  "externalId": null,
  "isDeleted": false,
  "itemCount": 26
}
```

**Sample care_service subGroups (dental service categories):**
| Name | Item count |
|------|-----------|
| NHA KHOA TỔNG QUÁT | 26 |
| NHA KHOA THẨM MỸ | 24 |
| CHỈNH NHA | 10 |
| CẤY GHÉP IMPLANT | 8 |
| PHẪU THUẬT NHA CHU | 0 |

**Reorder — one call carries the whole list** (observed 2026-08-24, Network tab):

```
POST <taxonomy reorder endpoint>

{
  "group": "care_service",
  "branchId": "<guid>",
  "items": [
    { "id": "<guid>", "order": 0 },
    { "id": "<guid>", "order": 1 },
    ...
  ]
}
```

The entry list reorders the same way, with the group added:

```
POST <catalog entry reorder endpoint>

{
  "group": "care_service",
  "branchId": "<guid>",
  "taxonomyId": "<guid>",
  "items": [{ "id": "<guid>", "order": 0 }, ...]
}
```

Every row of the list is sent, not only the ones that moved, and `order` is the
zero-based position. The URL itself was not captured — only the payload was
visible — so BlueDental exposes it as
`POST /api/v1/app/taxonomies/reorder` and `POST /api/v1/app/catalog-entries/reorder`,
and names the branch field `clinicBranchId` as every other BlueDental endpoint
does.

---

### Vouchers

```
GET  /api/v1/voucher/available
     ?customerTarget=returning
```

---

## RSC Route Prefetch (Next.js)

On page load, the app prefetches all sidebar routes via RSC format (`_rsc` token):

```
GET  /reception?branchId=<id>&_rsc=<token>       → 200
GET  /patient?branchId=<id>&_rsc=<token>          → 200
GET  /calendar?branchId=<id>&_rsc=<token>         → 200
GET  /cskh-grouping?branchId=<id>&_rsc=<token>    → 200
GET  /labo?branchId=<id>&_rsc=<token>             → 200
GET  /operations?branchId=<id>&_rsc=<token>       → 200
GET  /report?branchId=<id>&_rsc=<token>           → 200
GET  /staff?branchId=<id>&_rsc=<token>            → 200
GET  /materials?branchId=<id>&_rsc=<token>        → 200
GET  /taxonomy?branchId=<id>&_rsc=<token>         → 200
GET  /tools?branchId=<id>&_rsc=<token>            → 200
```

Also observed: `/voucher?branchId=<id>` route (not in sidebar nav).

---

## UNKNOWN_REFERENCE_BEHAVIOR

| # | Item | Reason |
|---|------|--------|
| 1 | Auth mechanism | Not observed — session/token not captured |
| 2 | POST/PUT/DELETE contracts | Mutating — not triggered |
| 3 | WebSocket / SignalR usage | Not observed |
| 4 | Error response formats | Not triggered |
| 5 | Pagination: cursor vs offset | Appears offset-based (page + perPage) |
| 6 | /voucher page route | In network but not in sidebar nav |
| 7 | Invoices/billing endpoints | Not triggered |
| 8 | Prescription endpoints | Not triggered |
| 9 | ~~CSKH endpoints~~ | RESOLVED 2026-08-26 — see "Customer Care (CSKH)" section below |

---

## Customer Care (CSKH) — observed 2026-08-26 on staging.nfcdental.com

> staging.nfcdental.com là reference chuẩn mới từ 2026-08-26. API base: `https://api.staging.nfcdental.com/api/v1`.
> Chi tiết đầy đủ (ma trận tab/cột/filter): docs/clone/pages/cskh-grouping.md

```
GET /customer-care?branchId=&type=<afterTreatment|happyBirthday|reminder|recurring|special>
    &isDeleted=false&overview=false&hydrate=compact
    &sortBy=<dateTime|scheduleStartTime>&sortDirection=<asc|desc>
    &startTime=<iso>&toTime=<iso>            ← afterTreatment/happyBirthday/reminder
    &scheduleStartTime=<iso>&scheduleToTime=<iso>  ← recurring/special
    [&status=new|success|fail][&staffId=][&careStaffId=][&q=]
    &page=1&take=20                                          → list

GET /customer-care-stats?<same params, no page/take/status>  → 5 counters

GET /customer-care/export?<same params, no page/take/hydrate> → file xlsx
    (1 sheet "Chăm sóc khách hàng", không style, cột per-tab — xem page doc)

GET /customer-care?patientId=&type=base,recurring,special&page=1&take=100
    ← lịch sử CSKH trong dialog "Thông tin tổng quan"

POST /call-sessions/make-a-call              ← nút phone (staging trả 400)

# Mutations (capture 2026-08-26 qua network-block client-side — KHÔNG gửi tới server)
POST /customer-care                           ← Tạo mới (periodic/special) VÀ file-heart tab group
    # Tạo mới (dialog Tạo công việc mới ở tab care):
    { "patientId": "<id>", "staffId": null, "careStaffId": null,
      "dateTime": "<iso>", "scheduleStartTime": "<iso>", "scheduleToTime": "<iso>",  # cả 3 = ngày+giờ chọn
      "subject": "Customer Care - special",   # auto "Customer Care - <type>"
      "type": "special|recurring", "note": "<string>", "status": "new", "branchId": "<id>" }
    # File-heart tab group (dialog Tạo công việc mới bản phân nhóm):
    { "patientId": "<id>", "staffId": null, "careStaffId": null,
      "dateTime": "<ngày chọn, giờ=now>", "scheduleStartTime": "=dateTime", "scheduleToTime": "=dateTime+1h",
      "subject": "<Tiêu đề nhập tay>", "type": "base", "note": "<string>", "status": "success",
      "colorCode": "green|blue|orange|red",   # Tốt/Khá(inferred)/Bình thường/Khiếu nại
      "branchId": "<id>" }

PUT /customer-care/{id}                       ← ghi chú inline (blur) VÀ dialog kết quả chăm sóc
    { "patientId": "<id>", "staffId": "<id|null>", "dateTime": "<iso>", "subject": "<string>",
      "type": "<type>", "note": "<string>", "scheduleStartTime": "<iso>", "scheduleToTime": "<iso>",
      "status": "new|success|fail", "stageIds": [], "careStaffId": null }
    # PUT gửi FULL object; có stageIds, KHÔNG có branchId (POST ngược lại)

GET /zalo-oa-templates?branchId=&perPage=100  ← dialog "Gửi ZBS qua Zalo" (400 nếu chưa config Zalo OA)

GET /sender-sms-templates?perPage=50&page=1&search=          ← dialog Lưu tin nhắn
GET /clinic-configure?perPage=50&page=1&search=&module=sms&isEnabled=true
    # Local mirror (2026-08-27): /api/v1/app/sender-sms-templates + /api/v1/app/clinic-configure
    # (ABP paging skipCount/maxResultCount/filter). Templates = Tools.MessageTemplate (Channel=Sms,
    # IsActive); configures = bd_clinic_configures. Submit gửi tin: chưa implement (UNKNOWN).
GET /patient-treatments?patientId=&page=1&take=20&sortBy=createdAt&sortDirection=desc
GET /patient-stages?patientId=&stageIds=&page=1&take=1
GET /staff/list?page=1&perPage=20&status=active&isResigned=false&branchId=&isDoctor=true

# Tab Phân nhóm CSKH (tab=group)
GET /patients?page=&perPage=&branchId=&excludeTreatmentNone=true
    [&taxonomyId=][&birthdayDate=yyyy-MM-dd][&staffId=][&q=]  → list bệnh nhân
GET /taxonomy/?group=care_service&branchId=&perPage=100       → Nhóm dịch vụ
GET /medical-record/tag/list?branchId=&page=1&perPage=20&orderBy=order → Thẻ tag
```

Patients item (sanitized): `{ id, name, code, phone, hasZalo, dateOfBirth, branchId, branchName, treatmentStatus: "created|in-progress|done", staffIds[], totalDebt, totalRevenue, totalAmount, serviceNames[], staffNames[], schedule{ nextAppointmentDate, currentAppointmentDate, currentTreatmentDate }, lastAppointmentDate, lastTreatmentDate, createdAt }`

---

# Labo — full API capture (app.nfcdental.com, read-only, 2026-08-27)

Screen notes: `docs/clone/pages/labo.md`. Every path, verb and payload field
below is taken from the shipped API client (`_next/static/chunks/`
`91cfc74e0d6e2817.js` → `taxonomyApi`, `serviceMaterialApi`, `labOrderApi`;
`371d50d53d0310c9.js` → `laboApi`, lab-order hooks; `a606f3013073d406.js` →
the HTTP layer) and cross-checked against live GET traffic. **No mutating
request was ever issued** — the write verbs are read out of the client, not
observed on the wire, and are marked accordingly.

## Transport conventions

Base: `https://api.nfcdental.com/api` (client paths below start at `/v1/...`).

Request headers on every call:

```
authorization: Bearer <JWT, ES256>
x-branch-id:   <branchId>        ← branch is sent as a header AND a query param
x-custom-lang: vi                ← drives server-side message localisation
accept:        application/json
```

Response headers: `x-request-id`, `x-correlation-id`, `x-timestamp`,
`x-timezone`, `x-version`, `x-repo-version`, `x-response-time`, `etag`.

Every response uses one envelope:

```json
{
  "statusCode": 200,
  "message": "<localised, e.g. labOrder.list>",
  "metadata": {
    "language": "vi", "timestamp": 0, "timezone": "Asia/Ho_Chi_Minh",
    "path": "/api/v1/...", "version": "1", "repoVersion": "8.2.2",
    "requestId": "<uuid>", "correlationId": "<uuid>",
    "type": "offset|cursor",
    "count": 0, "page": 1, "perPage": 20, "totalPage": 0,
    "hasNext": false, "hasPrevious": false,
    "nextPage": null, "nextCursor": null,
    "orderBy": [{ "<field>": "asc|desc" }],
    "availableOrderBy": ["<field>"]
  },
  "data": [],
  "stats": {}
}
```

The client unwraps it as: items = `data`, pagination = `_pagination` when
present else the fields above out of `metadata`, plus a sibling `stats` used by
counter strips. `getData`/`postData`/`putData`/`patchData`/`deleteData` all
return `data` unwrapped. File downloads go through a blob path that re-throws
when the server answers `application/json` instead of a file.

Sorting is always `?orderBy=<field>:<asc|desc>`; the server echoes the allowed
fields back in `metadata.availableOrderBy`.

---

## 1. Lab orders — `labOrderApi`

```
GET    /v1/orders                       listOrders(params)
GET    /v1/orders/{id}                  getOrder
PUT    /v1/orders/{id}                  updateOrder(id, payload)        <- NOT ISSUED
PUT    /v1/orders/{id}/update-status    updateOrderStatus(id, payload)  <- NOT ISSUED, unused by /labo
GET    /v1/orders/export/excel          exportExcel(params)

GET    /v1/clinic-orders                listClinicOrders
POST   /v1/clinic-orders                createClinicOrder + header Idempotency-Key: <uuid>  <- NOT ISSUED
GET    /v1/clinic-orders/estimate-code  estimateClinicOrderCode
GET    /v1/clinic-orders/{id}           getClinicOrder
GET    /v1/clinic-order-status          getClinicOrderStatus
```

`/labo/mau-labo` uses only `listOrders`, `exportExcel` and `updateOrder`.
The `clinic-orders` family is the creation flow, which lives on the patient
screen — note it is create-only via POST carrying an idempotency key.

### List query (observed)

```
GET /api/v1/orders
    ?page=1&perPage=20
    &branchId=<id>
    &orderBy=createdAt:desc
    [&status=created|lateDelivery|delivered]
    [&patientId=<id>]
    [&staffId=<id>]
    [&startTime=<ISO>&toTime=<ISO>]
```

`metadata.message = "labOrder.list"`,
`availableOrderBy = ["createdAt","updatedAt","estimatedDeliveryDate"]`.
Export re-sends the same object with `page` and `perPage` deleted.

### Item shape

Structure only — the surveyed branch holds 0 lab orders, so this is read from
the client's row mapper rather than from a live payload.

```json
{
  "id": "<string>",
  "status":       "created|received|processing|completed|delivered|canceled|guarantee|continue|lateDelivery|replaced",
  "statusClinic": "<same code set>",
  "createdAt": "<ISO>",
  "estimatedDeliveryDate": "<ISO>",
  "note": "<string>",
  "serviceTreatment": "<string>",
  "toothColor": "<string>",
  "toothContents": ["<string>"],
  "patientId": "<string>",
  "staffId": "<string>",
  "patient":    { "id": "<string>", "code": "<string>", "name": "<string>", "phone": "<string>", "address": "<string>", "dateOfBirth": "<ISO>" },
  "staff":      { "id": "<string>", "name": "<string>" },
  "labo":       { "id": "<string>", "name": "<string>" },
  "material":   { "id": "<string>", "name": "<string>" },
  "service":    { "id": "<string>", "name": "<string>" },
  "finishLine": { "name": "<string>" },
  "biteJoint":  { "name": "<string>" },
  "bridges":    { "name": "<string>" },
  "clinic":     { "name": "<string>" },
  "images":     [{ "id": "<string>", "name": "<string>", "fileName": "<string>", "cdnUrl": "<string>", "completedUrl": "<string>", "url": "<string>", "path": "<string>" }],
  "imageLabos": [{ "id": "<string>", "key": "<string>", "name": "<string>", "cdnUrl": "<string>", "completedUrl": "<string>", "url": "<string>", "path": "<string>" }],
  "imageLaboIds": ["<string>"]
}
```

Image URL resolution is `cdnUrl ?? completedUrl ?? url ?? path`; a null result
drops the image from the gallery. `images` feeds the table's
"File phòng khám gửi về" lightbox; `imageLabos` feeds the detail modal's
editable attachments.

### Update payload (read from the client, never sent)

```
PUT /v1/orders/{id}
{ "status": "<code>", "imageLaboIds": ["<mediaId>"] }
```

Nothing else on `/labo` is editable. Success toast
`Cập nhật phiếu Labo thành công`; failure `Không thể cập nhật phiếu Labo`.
On success the client invalidates `labOrders.all`, `labOrders.detail(id)`,
`clinic-orders`, `clinic-order-status` and `treatmentServices.all`.

---

## 2. Lab suppliers — `laboApi` (base `/v1/labos/`)

```
GET    /v1/labos/            list(params)          cursor-paged
GET    /v1/labos/list        listOffset(params)    offset-paged  <- what /labo/supplier uses
GET    /v1/labos/{id}        detail
POST   /v1/labos/            create(payload)       <- NOT ISSUED
PUT    /v1/labos/{id}        update(id, payload)   <- NOT ISSUED
DELETE /v1/labos/{id}        delete(id)            <- NOT ISSUED
```

### List query (observed)

```
GET /api/v1/labos/list?branchId=<id>[&search=<q>]&orderBy=updatedAt:desc&page=1&perPage=20
```

`availableOrderBy = ["name","createdAt","updatedAt"]`.
`search` is debounced 400 ms and capped at 100 characters.

### Item shape (observed, values redacted)

```json
{
  "id": "<string>",
  "name": "<string>",
  "phoneNumber": "<string|null>",
  "contactPerson": "<string|null>",
  "email": "<string|null>",
  "taxCode": "<string|null>",
  "address": "<string|null>",
  "city": "<province code, e.g. 79>",
  "district": "<district code, e.g. 766>",
  "ward": "<ward code, e.g. 27001>",
  "addressFull": "<string|null, composed server-side from address + ward + district + city>",
  "code": "<string|null>",
  "logoFileId": "<string|null>",
  "logoPath": "<string|null>",
  "clinicId": "<string>",
  "branchId": "<string>",
  "isDeleted": false,
  "createdAt": "<ISO>", "createdBy": "<userId>",
  "updatedAt": "<ISO>", "updatedBy": "<userId>"
}
```

### Create / update payload (read from the client, never sent)

```json
{
  "name": "<string, 2..100, required>",
  "email": "<email, max 100, required>",
  "phoneNumber": "<string|undefined, max 15, digits>",
  "contactPerson": "<string|undefined, 2..100>",
  "taxCode": "<string|undefined, max 100>",
  "city": "<province code|undefined>",
  "district": "<district code|undefined>",
  "ward": "<ward code|undefined>",
  "address": "<string|undefined, max 100>",
  "logoFileId": "<string|undefined>",
  "logoPath": "<string|undefined>",
  "branchId": "<string>"
}
```

Empty strings become `undefined` before sending. The dialog's own state keys
differ from the wire keys: `phone → phoneNumber`, `contact → contactPerson`,
`provinceCode → city`, `districtCode → district`, `wardCode → ward`.

---

## 3. Taxonomy — `taxonomyApi` (base `/v1/taxonomy/`)

Backs Khớp cắn, Đường hoàn tất, Kiểu nhịp **and** the Dịch vụ - vật liệu group
panel — the same collection `/taxonomy` uses.

```
GET    /v1/taxonomy/                 list(params)          cursor-paged
GET    /v1/taxonomy/list             listOffset(params)    offset-paged
POST   /v1/taxonomy/                 create(payload)       <- NOT ISSUED
PUT    /v1/taxonomy/{id}             update(id, payload)   <- NOT ISSUED
DELETE /v1/taxonomy/{id}             delete(id)            <- NOT ISSUED
PATCH  /v1/taxonomy/reorder          reorder(payload)      <- NOT ISSUED, unused by /labo
PATCH  /v1/taxonomy/reorder-items    reorderItems(payload) <- NOT ISSUED, unused by /labo
```

### Observed queries

```
# bite / finish-line / nhip
GET /api/v1/taxonomy/list?group=joint|line|bridge&branchId=<id>[&search=<q>]
    &orderBy=createdAt:desc&page=1&perPage=20

# Dịch vụ - vật liệu, left panel (infinite scroll)
GET /api/v1/taxonomy/?group=serviceMaterial&branchId=<id>
    &orderBy=order:asc&perPage=20&includeCount=true
```

`availableOrderBy = ["name","order","createdAt","updatedAt"]`.
`includeCount=true` adds `itemCount` to each row. The cursor form returns
`metadata.type = "cursor"` and no `page`/`totalPage`.

### Item shape (observed, values redacted)

```json
{
  "id": "<string>",
  "name": "<string>",
  "alias": "<string, server-generated: name + ' - ' + 10 random chars>",
  "color": null,
  "description": null,
  "group": "joint|line|bridge|serviceMaterial|material|service|tooth",
  "subGroup": null,
  "ownerType": null,
  "clinicId": "<string>",
  "branchId": "<string>",
  "laboId": "<string|null>",
  "isSystem": false,
  "order": 0,
  "externalId": null,
  "createdAt": "<ISO>", "createdBy": "<userId|null>",
  "updatedAt": "<ISO>", "updatedBy": "<userId|null>",
  "isDeleted": false,
  "itemCount": 0
}
```

### Payloads (read from the client, never sent)

```json
// create
{ "name": "<string, 1..100>", "group": "<group>", "branchId": "<string>", "order": 0 }

// update - taxonomyId is repeated inside the body as well as in the path
{ "taxonomyId": "<id>", "name": "<string>", "group": "<group>", "branchId": "<string>", "order": 0 }
```

On the three simple tabs `order` on create is `max(order visible on the current
page) + 1`, and on update the row's existing `order` is sent back unchanged.
On the service-material group dialog `order` comes from the
"Mức độ ưu tiên" field.

### Labo taxonomy groups

| group | Meaning | Surfaced on /labo |
|-------|---------|-------------------|
| `joint` | Khớp cắn Labo | yes — `/labo/bite` |
| `line` | Đường hoàn tất | yes — `/labo/finish-line` |
| `bridge` | Kiểu nhịp Labo | yes — `/labo/nhip` |
| `serviceMaterial` | Dịch vụ - vật liệu (group) | yes — left panel |
| `material` | Vật liệu Labo | no |
| `service` | Dịch vụ | no |
| `tooth` | Màu răng | no |

---

## 4. Service materials — `serviceMaterialApi`

Base `/v1/taxonomy/service-materials`. Unlike the others it puts the verb in
the path:

```
GET    /v1/taxonomy/service-materials/list           list(params)
POST   /v1/taxonomy/service-materials/create         create(payload)      <- NOT ISSUED
PUT    /v1/taxonomy/service-materials/update/{id}    update(id, payload)  <- NOT ISSUED
DELETE /v1/taxonomy/service-materials/delete/{id}    delete(id)           <- NOT ISSUED
```

### Observed query

```
GET /api/v1/taxonomy/service-materials/list
    ?branchId=<id>[&taxonomyId=<groupId>][&search=<q>]&page=1&perPage=20
```

### Item shape (observed, values redacted)

```json
{
  "id": "<string>",
  "name": "<string>",
  "alias": "<string, server-generated>",
  "taxonomyId": "<taxonomy id>",
  "taxonomy": { "id": "<string>", "name": "<string>" },
  "taxonomyName": "<string>",
  "clinicId": "<string>",
  "order": 0,
  "isDeleted": false,
  "createdAt": "<ISO>", "createdBy": "<userId|null>",
  "updatedAt": "<ISO>", "updatedBy": "<userId|null>"
}
```

The item carries **no `branchId`** — scoping rides on the parent taxonomy.

### Payload (read from the client, never sent)

```json
{ "name": "<string, 1..100>", "taxonomyId": "<group id>", "branchId": "<string>" }
```

Same body for create and update.

---

## 5. Supporting endpoints used by /labo

```
# Patient combobox on Mẫu Labo (paged, server-searched)
GET /api/v1/patients?page=<n>&perPage=20&q=<search>&branchId=<id>
    item: { id, name, code, phone, hasZalo, dateOfBirth, branchId, branchName,
            treatmentStatus, staffIds[], totalDebt, totalRevenue, totalAmount,
            serviceNames[], staffNames[], lastAppointmentDate,
            lastTreatmentDate, createdAt }
    option label = "[" + code + "] - " + name ; option value = id -> sent as patientId

# Doctor combobox on Mẫu Labo
GET /api/v1/staff/list?page=1&perPage=20&status=active&isResigned=false
    &branchId=<id>&isDoctor=true
    item: { id, fullName, email, phoneNumber, role, clinic, status, createdAt,
            avatarUrl, address, isDeleted, isStaff, isResigned, isDoctor,
            isDentalAssistant, isPhysician, morningStartTime, morningEndTime,
            afternoonStartTime, afternoonEndTime, branchIds[] }
    the client filters again on status === "active" && !isResigned
    option value = id -> sent as staffId

# Address cascade in the supplier dialog
GET /api/v1/country/province                          -> 63 items
GET /api/v1/country/province/{provinceCode}/district
GET /api/v1/country/district/{districtCode}/ward
    item: { id, code, fullName, createdAt, updatedAt }
    option label = fullName ; option value = code ; the supplier row stores the code

# Permissions, read once at boot and used to gate every labo control
GET /api/v1/user/me/permissions
{
  "roleType": "clinicAdmin",
  "roleName": "<string>",
  "abilities": [ { "subject": "<subject>", "action": ["read","create","update","delete","export"] } ]
}
    labo subjects: laboTemplate, laboSupplier, laboBite, laboFinishLine,
                   laboRhythm, laboMaterial

# Branch list, used by the branch switcher
GET /api/v1/branch/public
    item: { id, name, taxCode, email, contactPerson, phoneNumber, cityId,
            districtId, wardId, clinicId, branchCode, logoFileId, avatarUrl,
            address, createdAt, updatedAt }
```

## 6. Media upload

The order detail modal and the supplier dialog both defer their uploads: files
go to S3 first, then the returned `{ mediaId, url }` pairs are folded into the
save payload.

| Screen | folder | max files | max size | accept | type |
|--------|--------|-----------|----------|--------|------|
| Mẫu Labo detail | `labo/mau-labo` | 5 | 5 MB | `image/*` | — |
| Nhà cung cấp dialog | `labo/supplier` | 1 | 5 MB | `image/*` | `avatar` |

The upload endpoint itself was **not** captured — uploading would write to
production storage. `UNKNOWN_REFERENCE_BEHAVIOR`.

## 7. Session expiry

Any 401 that cannot be refreshed via `POST /api/auth/refresh` (a Next.js route
on the app origin, not the API host) raises a blocking modal:
title `Phiên đăng nhập đã hết hạn`, body
`Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.`,
single full-width button `Đồng ý` which routes to `/signin`. No close button,
no click-outside.
