# Data Model & Constraints

Source: Derived from reference app observation + CLAUDE.md domain model
Observed: 2026-08-21 to 2026-08-22
Status: PARTIAL — Reception and Patient observed; other modules inferred

---

## Overview

BlueDental manages dental clinic operations across multiple branches. The core data hierarchy:

```
Organization (Hệ thống)
└── ClinicBranch (Chi nhánh phòng khám)
    ├── Staff (Nhân viên) — dentists, counselors, receptionists
    ├── Patient (Bệnh nhân) — patient registry
    │   └── DentalChart (Sơ đồ răng)
    ├── Appointment (Lịch hẹn) → Reception (Tiếp nhận)
    │   └── TreatmentPlan (Kế hoạch điều trị)
    │       └── TreatmentRecord (Hồ sơ điều trị)
    ├── Invoice (Hóa đơn)
    │   ├── InsuranceClaim (Yêu cầu bảo hiểm)
    │   └── Payment (Thanh toán)
    ├── LaboOrder (Đơn labo)
    └── Inventory (Vật tư kho)
```

---

## Core Constraint: ClinicBranchId

**EVERY entity that belongs to a clinic must carry `ClinicBranchId`.**

- Data filtering is performed at the AppService layer, not database level
- Users can only see/edit data belonging to their assigned branch
- Cross-branch queries require elevated permission (organization-level admin)
- The reference app passes `branchId` as a query parameter on every route

---

## Entity: Patient (Bệnh nhân)

**Observed fields (from patient list table):**

| Field | Vietnamese | Type | Constraints |
|-------|-----------|------|-------------|
| Id | — | Guid | PK, not null |
| ClinicBranchId | Chi nhánh | Guid | FK → ClinicBranch, not null |
| Code | Mã bệnh nhân | string | Format: `{ClinicPrefix}{YY}{SEQ}`, unique per branch |
| FirstName | Tên | string | not null, min 1 char |
| LastName | Họ | string | not null, min 1 char |
| FullName | Họ và tên | computed | LastName + FirstName |
| DateOfBirth | Ngày sinh | Date | nullable (observed "—" in reference) |
| Gender | Giới tính | enum | Male/Female/Other |
| PhoneNumber | Số điện thoại | string | 10-digit, format 0xxxxxxxxx |
| Email | Email | string | nullable |
| Address | Địa chỉ | string | nullable |
| Status | Trạng thái | enum | see PatientStatus below |
| Tags | Phân loại Tag | string[] | for CSKH grouping |
| CreatedAt | Ngày tạo hồ sơ | DateTime | auto-set on create |
| DentistId | Bác sĩ phụ trách | Guid | FK → Staff, nullable |

**PatientStatus enum:**
| Value | Vietnamese | Color in UI |
|-------|-----------|-------------|
| NotStarted | Chưa phát sinh | Gray |
| InTreatment | Đang điều trị | Blue |
| Completed | Hoàn tất | Green |

**Patient Code format:**
- `{ClinicPrefix}{YY}{SEQ}`
- ClinicPrefix: defined per clinic (e.g. "DH" for Đức Hạnh)
- YY: 2-digit year (26 = 2026)
- SEQ: incremental sequence, NOT zero-padded consistently
- Must be unique within the clinic (not global)

**Constraints:**
- Phone number: 10 digits, starts with 0
- DateOfBirth: must be in the past
- Status is computed/derived from treatment activity, not directly set
- A patient must belong to exactly one ClinicBranch

**Financial summary fields (derived/aggregated):**
| Field | Vietnamese | Computation |
|-------|-----------|-------------|
| TotalAmount | Số tiền | Sum of all treatment invoices |
| TotalCollected | Thực thu | Sum of all received payments |
| TotalDebt | Công nợ | TotalAmount - TotalCollected |

---

## Entity: Reception / Visit (Tiếp nhận)

**Observed from reference screenshots (22/08/2026 with 5 records):**

| Field | Vietnamese | Type | Constraints |
|-------|-----------|------|-------------|
| Id | — | Guid | PK |
| ClinicBranchId | Chi nhánh | Guid | FK → ClinicBranch, not null |
| TicketNumber | Số phiếu | string | Format: `TN-{YYYYMMDD}-{NN}`, unique per day per branch |
| PatientId | Bệnh nhân | Guid | FK → Patient, not null |
| DentistId | Bác sĩ tiếp nhận | Guid | FK → Staff (doctor), not null |
| ConsultantId | Nhân sự tư vấn | Guid | FK → Staff, nullable |
| Source | Nguồn tiếp nhận | enum | see ReceptionSource below |
| Status | Trạng thái | enum | see ReceptionStatus below |
| TreatmentServices | Dịch vụ điều trị | string[] | List of selected service names |
| TotalAmount | Tổng tiền | decimal | Sum of selected services (VND) |
| AppointmentTime | Giờ hẹn | Time | HH:mm |
| Notes | Ghi chú | string | nullable, free text |
| ArrivedAt | Đã đến lúc | DateTime | nullable, set when patient arrives |
| StartedAt | Bắt đầu khám lúc | DateTime | nullable, set when exam starts |
| CompletedAt | Hoàn thành lúc | DateTime | nullable, set when exam ends |
| Outcome | Kết quả | enum | see ReceptionOutcome below |
| Date | Ngày | Date | date of reception, used for day-view filter |

**Ticket number format:** `TN-{YYYYMMDD}-{NN}`
- YYYYMMDD: date (e.g. 20260822)
- NN: sequential number for that day, padded to 2 digits (01, 02, ...)
- Unique per branch per day

**ReceptionSource enum:**
| Value | Vietnamese | Badge Color |
|-------|-----------|------------|
| Self | Tự đến | Blue |
| Medical | Y tế | Purple |
| Marketing | Marketing | Green |
| Referral | Giới thiệu | Cyan/Orange |

**ReceptionStatus enum (row-level filter tabs):**
| Value | Vietnamese | Badge Color | Icon |
|-------|-----------|------------|------|
| Waiting | Chờ khám | Blue | Clock |
| InProgress | Đang khám | Orange | Sync spinner |
| Completed | Hoàn thành | Green | Checkmark |

**Appointment counter-card statuses (different from row status):**
| Value | Vietnamese | Card Border Color |
|-------|-----------|-----------------|
| Scheduled | Đã hẹn | Blue (#1E70E6) |
| Arrived | Đã đến | Green (#10B981) |
| Cancelled | Huỷ hẹn | Red (#EF4444) |
| Late | Trễ hẹn | Amber (#F59E0B) |
| Temporary | Lịch tạm | Orange (#F97316) |
| Converted | Chuyển đổi | Cyan (#06B6D4) |

**ReceptionOutcome enum (set when completing):**
| Value | Vietnamese |
|-------|-----------|
| TreatmentEnded | Kết thúc điều trị |
| NextAppointmentBooked | Đã hẹn tiếp |
| DoctorTransfer | Chuyển bác sĩ |
| FollowUp | Hẹn tái khám |

**Patient type badge:**
| Value | Vietnamese | Color |
|-------|-----------|-------|
| New | Mới | Green |
| Returning | Cũ | Gray |

**Status transition rules (OBSERVED from detail card):**
```
Chờ khám (Waiting)
    ↓ [Tiếp nhận button] → records ArrivedAt
Đang khám (InProgress)
    ↓ [Xong button] → records CompletedAt + sets Outcome
Hoàn thành (Completed)
```

**Constraints:**
- TicketNumber is unique per branch per day
- DentistId is required (must assign a doctor)
- Status can only move forward (no reversal)
- CompletedAt requires Outcome to be set
- TreatmentServices: list of service names from the catalog
- TotalAmount: computed from TreatmentServices prices

---

## Entity: Appointment (Lịch hẹn)

Distinct from Reception. An Appointment is a scheduled future visit.
A Reception is the day-of visit record (may be walk-in or from appointment).

**Status workflow (CLAUDE.md):**
```
Scheduled → Confirmed → CheckedIn → InProgress → Completed
                                               → Cancelled
                                               → NoShow
```

| Status | Vietnamese | Notes |
|--------|-----------|-------|
| Scheduled | Đã hẹn | Initial state |
| Confirmed | Đã xác nhận | After clinic confirmation |
| CheckedIn | Đã đến | Patient arrived |
| InProgress | Đang khám | Exam started |
| Completed | Hoàn thành | Exam done |
| Cancelled | Đã hủy | Requires reason |
| NoShow | Vắng mặt | Patient didn't come |

**Cancellation rule:** After Confirmed, cancellation requires a reason (CancellationReason field, not null).
**CheckIn rule:** Only allowed when patient physically arrives.

---

## Entity: TreatmentPlan (Kế hoạch điều trị)

**Status workflow (CLAUDE.md):**
```
Draft → Active → Completed
             → Cancelled
```

| Status | Rules |
|--------|-------|
| Draft | Can add/edit/delete items |
| Active | Can only add TreatmentRecords, cannot edit plan items |
| Completed | All items done, immutable |
| Cancelled | Requires reason |

**Items (TreatmentPlanItem):**
- Procedure (from Catalogs)
- ToothLocation (Value Object: tooth number FDI + surface)
- EstimatedCost (VND)
- AssignedDentistId

---

## Entity: Invoice (Hóa đơn)

**Status workflow (CLAUDE.md):**
```
Draft → Issued → PartiallyPaid → Paid
              → Overdue
              → Voided
```

| Status | Rules |
|--------|-------|
| Draft | Can edit line items |
| Issued | Cannot edit, only record payments |
| Voided | Requires reason, cannot void Paid invoice |

---

## Entity: InsuranceClaim (Yêu cầu bảo hiểm)

**Status workflow (CLAUDE.md):**
```
Submitted → UnderReview → Approved
                       → Rejected (requires reason)
```

Approved claim: updates insurance coverage amount on the linked Invoice.

---

## Entity: Staff (Nhân viên)

**Types observed:**
- Bác sĩ (Doctor) — displayed as "BS." prefix in patient table
- Nhân sự tư vấn (Counselor) — displayed without prefix in reception table

**Fields (inferred):**
| Field | Vietnamese | Type | Constraints |
|-------|-----------|------|-------------|
| Id | — | Guid | PK |
| ClinicBranchId | Chi nhánh | Guid | FK, not null |
| Code | Mã nhân viên | string | unique per branch |
| FullName | Họ và tên | string | not null |
| Role | Vai trò | enum | Doctor/Counselor/Receptionist/Manager/... |
| IsActive | Hoạt động | bool | for filter dropdowns |

---

## Catalog Entities (Danh mục)

Used for dropdowns and service selection:

| Entity | Vietnamese | Used in |
|--------|-----------|---------|
| DentalProcedure | Thủ thuật nha khoa | Treatment plans, reception services |
| ServiceCategory | Phân loại dịch vụ | Patient filter |
| InsurancePlan | Gói bảo hiểm | Billing |
| ToothNumber (FDI) | Hệ thống đánh số răng | Dental chart |
| DrugCatalog | Danh mục thuốc | Prescriptions |
| IcdCode | Mã ICD-10 | Diagnosis |

**DentalProcedure constraints:**
- Code: unique, not null
- Price: VND, >= 0
- Category: FK → ServiceCategory

---

## Entity: LaboOrder (Đơn Labo)

Inferred from sidebar "Labo" page. Route: `/labo`

Lab orders for prosthetics, implants, orthodontics requiring external lab work.

**Inferred fields:**
| Field | Vietnamese | Type |
|-------|-----------|------|
| Id | — | Guid |
| ClinicBranchId | Chi nhánh | Guid |
| PatientId | Bệnh nhân | Guid |
| DentistId | Bác sĩ yêu cầu | Guid |
| LaboProviderId | Nhà cung cấp Labo | Guid |
| OrderDate | Ngày đặt | Date |
| ExpectedReturnDate | Ngày dự kiến trả | Date |
| Status | Trạng thái | enum |
| Items | Công việc yêu cầu | JSON |

---

## Entity: Inventory (Vật tư)

Inferred from sidebar "Vật tư" page. Route: `/materials`

**Inferred fields:**
| Field | Vietnamese | Type |
|-------|-----------|------|
| Id | — | Guid |
| ClinicBranchId | Chi nhánh | Guid |
| Name | Tên vật tư | string |
| Unit | Đơn vị | string |
| QuantityInStock | Tồn kho | decimal |
| MinimumStock | Mức tối thiểu | decimal |
| UnitCost | Giá nhập | decimal |

---

## Cross-Entity Relationships

```
ClinicBranch ────── has many ──→ Staff
ClinicBranch ────── has many ──→ Patient
ClinicBranch ────── has many ──→ Reception
ClinicBranch ────── has many ──→ Appointment
ClinicBranch ────── has many ──→ Invoice
ClinicBranch ────── has many ──→ LaboOrder
ClinicBranch ────── has many ──→ Inventory

Patient ────────── has many ──→ Reception (visit records)
Patient ────────── has many ──→ Appointment (scheduled visits)
Patient ────────── has one  ──→ DentalChart
Patient ────────── has many ──→ TreatmentPlan
Patient ────────── has many ──→ Invoice
Patient ────────── has many ──→ Prescription

Reception ─────── links to  ──→ Patient (required)
Reception ─────── links to  ──→ Staff/Dentist (required)
Reception ─────── links to  ──→ Staff/Consultant (optional)
Reception ─────── links to  ──→ Appointment (optional — if pre-booked)
Reception ─────── has many  ──→ DentalProcedure references (services)

TreatmentPlan ─── links to  ──→ Patient (required)
TreatmentPlan ─── links to  ──→ Reception (optional)
TreatmentPlan ─── has many  ──→ TreatmentPlanItem
TreatmentPlanItem ── links ──→ DentalProcedure (required)
TreatmentPlanItem ── links ──→ Staff/Dentist (optional)
TreatmentPlanItem ── has   ──→ ToothLocation Value Object

Invoice ───────── links to  ──→ Patient (required)
Invoice ───────── links to  ──→ TreatmentPlan (optional)
Invoice ───────── has many  ──→ InvoiceLineItem
Invoice ───────── has many  ──→ Payment
Invoice ───────── has many  ──→ InsuranceClaim

LaboOrder ──────── links to ──→ Patient (required)
LaboOrder ──────── links to ──→ Staff/Dentist (required)
LaboOrder ──────── links to ──→ TreatmentPlanItem (optional)
```

---

## Business Rules Summary

### Patient
1. Patient code is unique per branch (not globally unique)
2. Phone number is required, must be 10 digits
3. Date of birth must be in the past
4. PatientStatus is derived: NotStarted = no treatment, InTreatment = active plan, Completed = all plans done
5. Financial summary (Số tiền / Thực thu / Công nợ) is aggregated across all invoices

### Reception
1. Ticket number is unique per branch per day (TN-YYYYMMDD-NN)
2. Doctor assignment is required
3. Status can only move forward: Waiting → InProgress → Completed
4. Outcome must be set before marking Completed
5. Services list drives the TotalAmount calculation
6. ArrivedAt is recorded when "Tiếp nhận" is clicked
7. CompletedAt is recorded when "Xong" is clicked

### Appointment
1. Cancellation after Confirmed requires a non-empty reason
2. CheckIn is only allowed when patient is physically present
3. InProgress cannot revert to earlier states
4. NoShow can be set after the appointment time has passed without CheckIn

### TreatmentPlan
1. Items can only be added/edited/deleted in Draft state
2. Active state allows adding TreatmentRecords but not modifying plan items
3. All items must be completed before marking plan Completed
4. Cancellation requires a reason

### Invoice
1. Line items can only be modified in Draft state
2. Payments can only be recorded in Issued, PartiallyPaid states
3. A Paid invoice cannot be Voided
4. Voiding requires a non-empty reason

### Insurance Claim
1. Rejection requires a non-empty reason
2. Approved claim automatically updates the insurance coverage amount on the linked Invoice

### Data Scoping
1. ALL queries must be filtered by ClinicBranchId
2. Users can only access data from their assigned branch(es)
3. Organization-level admin can see across branches
4. branchId is required on every API request

---

## VND Currency Rules

- No decimals (VND has no fractional currency)
- Dot as thousands separator: 1.500.000
- Display format: `{amount} đ` (e.g. "1.500.000 đ")
- Stored as integer in database (no decimal/float precision issues)
- Range: 0 to ~999.999.999 for a single item

---

## Date/Time Rules

- All dates displayed in DD/MM/YYYY format (Vietnamese locale)
- All times displayed in HH:mm (24-hour)
- DateTime displayed as DD/MM/YYYY HH:mm
- Timezone: Vietnam Standard Time (UTC+7), not UTC
- Server stores in UTC, displays in UTC+7

---

## File/Attachment Rules (from CLAUDE.md)

- Allowed formats: PDF, images (JPEG/PNG), Excel, X-ray images (JPEG/PNG only — no DICOM)
- Storage: MinIO (S3-compatible)
- X-ray images: store reference link only, NOT binary in PostgreSQL
- File size limits: UNKNOWN_REFERENCE_BEHAVIOR
