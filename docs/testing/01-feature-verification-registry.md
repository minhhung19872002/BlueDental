# Feature Verification Registry

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `READY_FOR_TEST` · `FAILED` ·
`VERIFIED` · `DIRTY` · `BLOCKED`.

Only `VERIFIED` means the feature passed **real runtime acceptance** — real
browser, real API, real PostgreSQL (see `00-test-policy.md`).

Last run: 2026-08-24, stack on `localhost:5173` (Vite) → `localhost:5019` (API)
→ PostgreSQL 15 and MinIO in Docker. Acceptance suite: **48 passed**.

| ID | Feature | Status | Acceptance spec | Notes |
|----|---------|--------|-----------------|-------|
| F-01 | Đăng nhập | `VERIFIED` | `e2e/fixtures/auth.ts` (used by every spec) | Real login form, real cookie auth |
| F-02 | Danh mục (taxonomy + catalog entries) | `VERIFIED` | `e2e/taxonomy.spec.ts` | Group + priced service created and persisted across reload |
| F-03 | Chấm công (lịch làm việc) | `VERIFIED` | `e2e/timekeeping.spec.ts` | Work day opened, shift clocked in and out through the UI |
| F-04 | Thu chi (phiếu thu/chi + duyệt) | `VERIFIED` | `e2e/finance.spec.ts` | Pending expense excluded from Tổng chi; approval adds exactly its amount |
| F-05 | Luân chuyển dòng tiền | `VERIFIED` | `e2e/finance.spec.ts` | Deposit moves Tổng Tiền Mặt by the deposited amount |
| F-06 | Hồ sơ bệnh nhân (đăng ký + danh sách) | `VERIFIED` | `e2e/patient.spec.ts` | Registered through the UI, persisted, reopened from the list |
| F-07 | Sơ đồ răng theo mặt | `VERIFIED` | `e2e/patient.spec.ts` | Whole-tooth, whole-jaw and clear all behave |
| F-08 | Voucher khuyến mãi | `VERIFIED` | `e2e/voucher.spec.ts` | Draft → active → paused; percentage above 100 refused |
| F-09 | Chẩn đoán & Tư vấn | `VERIFIED` | `e2e/treatment-stage.spec.ts`, `e2e/treatment-plan.spec.ts` | Diagnosis and advise created, then accepted |
| F-10 | Lịch hẹn | `VERIFIED` | `e2e/appointment.spec.ts` | Booking stored and found by a **server-side** search over every appointment (it used to filter only the fetched page); double-booking refused; day and week grids query their own range and now draw their bookings |
| F-11 | Tiếp nhận | `VERIFIED` | `e2e/reception.spec.ts` | Visit stored through the real API; counters served by `/visits/stats` |
| F-12 | CSKH | `VERIFIED` | `e2e/cskh.spec.ts` | Care task Chưa CS → Thành công moves the counters |
| F-13 | Labo | `VERIFIED` | `e2e/labo.spec.ts` | Overdue sample reads late until returned |
| F-14 | Vật tư | `VERIFIED` | `e2e/materials.spec.ts` | Supply added, stock received, status derived from expiry |
| F-15 | Quản trị vận hành | `VERIFIED` | `e2e/operations.spec.ts` | Article draft → published; task lifecycle; department travels with the query |
| F-16 | Công cụ (call/message/Zalo/hóa đơn) | `BLOCKED` | — | `UNKNOWN_REFERENCE_BEHAVIOR` — no data on the reference to observe |
| F-17 | Báo cáo doanh số | `VERIFIED` | `e2e/report.spec.ts` | Ledger and payment split served by `/clinic-reports`; period switch re-queries |
| F-18 | Kết quả kinh doanh | `VERIFIED` | `e2e/report.spec.ts` | Six rows agree with the cards; result = revenue − refunds − expenses |
| F-19 | Công đoạn điều trị | `VERIFIED` | `e2e/treatment-stage.spec.ts` | Chưa làm → Đang làm → Hoàn thành, persisted. **Model is BlueDental's assumption** — see below |
| F-20 | Phân tách chi nhánh | `VERIFIED` | `e2e/branch-isolation.spec.ts` | A branch-scoped account is refused another branch |
| F-21 | Phiếu điều trị + dòng dịch vụ | `VERIFIED` | `e2e/treatment-plan.spec.ts` | Accepted advise becomes a priced service line on DT01; a line cannot be planned twice |
| F-22 | Thanh toán bệnh nhân | `VERIFIED` | `e2e/treatment-plan.spec.ts` | Only finished work becomes Phải thu; refund capped at what was collected; prepaid held, not counted as paid |
| F-23 | Đơn thuốc | `VERIFIED` | `e2e/prescription.spec.ts` | Medicine lines snapshotted; a dispensed slip is frozen |
| F-24 | Hình ảnh bệnh nhân | `VERIFIED` | `e2e/patient-image.spec.ts` | Real multipart upload to MinIO, bytes fetched back through the API |
| F-25 | Nhân viên | `VERIFIED` | `e2e/staff.spec.ts` | Account created, edited and deleted; weak password refused by Identity |
| F-28 | Tìm kiếm nhanh (Ctrl K) | `VERIFIED` | manual browser run, 2026-08-24 | The palette used to render a search box with no `value`, no `onChange` and no results. It now queries `/patients?filter=` and opens the record; typing TRAN returned 8 real patients and the first one opened `/patient/:id` |
| F-27 | Thanh toán & hoá đơn (màn hoá đơn phòng khám) | `VERIFIED` | manual browser run, 2026-08-24 | Payment recorded through the real modal on `HD-202608-0012`; PostgreSQL shows `paid_amount=1000000`, `Status=3 (PartiallyPaid)`; survives a reload. Excel export returns a real `.xlsx` |
| F-26 | Song ngữ Việt/Anh (i18n) | `VERIFIED` | manual browser sweep, 2026-08-23 | Switch is instant, no reload; 985 keys, 0 untranslated; survives reload via `localStorage`; Zod messages and `Accept-Language` follow the switch |

## F-19 note — assumed, not observed

The reference never exposed a treatment-stage payload that could be read without
mutating production. What was observed is only: the ability subject
`treatmentStage` and its six verbs, the per-service "Thêm công đoạn" action,
`stageIds` / `patientStages[]` on CSKH records, and `stageNote` in the treatment
summary. Everything else — sequence numbers, tooth selection, timestamps, and the
image rule — is BlueDental's own design and is documented as such in
`TreatmentStage`.

## Backend regression nets (not acceptance)

| Suite | Count | Last run |
|-------|-------|----------|
| `BlueDental.Domain.Tests` | 178 | 2026-08-24 — pass |
| `BlueDental.Application.Tests` | 51 | 2026-08-24 — pass |
| `BlueDental.EntityFrameworkCore.Tests` | 39 | 2026-08-24 — pass |
| `BlueDental.HttpApi.Host.Tests` | 15 | 2026-08-24 — pass |
| `BlueDental.FE` Vitest | 3 | 2026-08-24 — pass |

## Still not covered

- **Công cụ** (F-16): gọi điện / SMS / Zalo / hoá đơn điện tử — the reference had
  no data to observe.
- **Xuất Excel / PDF**: wired on patients, labo, CSKH, reports, prescriptions,
  treatment plans and invoices. Screens without an export endpoint still have no
  button.
- **i18n export language**: a PDF or Excel export is still generated in
  Vietnamese regardless of the UI language.
- **i18n on the login screen**: the switcher lives in the app header, which only
  exists after sign-in, so the sign-in page is always Vietnamese.
- Two catalogs ("Thẻ hồ sơ", "Phương thức thanh toán") that the reference does not
  model as catalogs.
