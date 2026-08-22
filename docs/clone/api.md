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
| 9 | CSKH endpoints | Not triggered |
