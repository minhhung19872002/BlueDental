# Feature Verification Registry

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `READY_FOR_TEST` · `FAILED` ·
`VERIFIED` · `DIRTY` · `BLOCKED`.

Only `VERIFIED` means the feature passed **real runtime acceptance** — real
browser, real API, real PostgreSQL (see `00-test-policy.md`).

Last run: 2026-08-23, stack on `localhost:5173` (Vite) → `localhost:5019` (API)
→ PostgreSQL 15 in Docker. Acceptance suite: **27 passed**.

| ID | Feature | Status | Acceptance spec | Notes |
|----|---------|--------|-----------------|-------|
| F-01 | Đăng nhập | `VERIFIED` | `e2e/fixtures/auth.ts` (used by every spec) | Real login form, real cookie auth |
| F-02 | Danh mục (taxonomy + catalog entries) | `VERIFIED` | `e2e/taxonomy.spec.ts` | Group + priced service created and persisted across reload |
| F-03 | Chấm công (lịch làm việc) | `VERIFIED` | `e2e/timekeeping.spec.ts` | Work day opened, shift clocked in and out through the UI |
| F-04 | Thu chi (phiếu thu/chi + duyệt) | `VERIFIED` | `e2e/finance.spec.ts` | Pending expense excluded from Tổng chi; approval adds exactly its amount |
| F-05 | Luân chuyển dòng tiền | `VERIFIED` | `e2e/finance.spec.ts` | Deposit moves Tổng Tiền Mặt by the deposited amount |
| F-06 | Hồ sơ bệnh nhân (đăng ký + danh sách) | `VERIFIED` | `e2e/patient.spec.ts` | Registered through the UI, persisted, reopened from the list |
| F-07 | Sơ đồ răng theo mặt (chẩn đoán & tư vấn) | `VERIFIED` | `e2e/patient.spec.ts` | Whole-tooth, whole-jaw and clear all behave; surface text matches the reference wording |
| F-08 | Voucher khuyến mãi | `VERIFIED` | `e2e/voucher.spec.ts` | Draft → active → paused; stat tile counts the active one; percentage above 100 refused |
| F-09 | Chẩn đoán & Tư vấn (phiếu chẩn đoán / tư vấn) | `VERIFIED` | `e2e/treatment-stage.spec.ts` | Diagnosis and advise created through the dialogs, then accepted |
| F-10 | Lịch hẹn (calendar) | `IN_PROGRESS` | — | Day/week/month grids render; appointment creation not verified |
| F-11 | Tiếp nhận | `IN_PROGRESS` | — | Still falls back to mock data when the API is unavailable |
| F-12 | CSKH | `VERIFIED` | `e2e/cskh.spec.ts` | Care task Chưa CS → Thành công moves the counters; programme switch re-queries |
| F-13 | Labo | `VERIFIED` | `e2e/labo.spec.ts` | Overdue sample reads late until returned; Mẫu Chưa Nhận lists only samples still out |
| F-14 | Vật tư | `VERIFIED` | `e2e/materials.spec.ts` | Supply added, stock received, status derived from expiry |
| F-15 | Quản trị vận hành | `VERIFIED` | `e2e/operations.spec.ts` | Article stays a draft until published; task lifecycle moves the counters; department travels with the query |
| F-16 | Công cụ (call/message/Zalo/hóa đơn) | `BLOCKED` | — | `UNKNOWN_REFERENCE_BEHAVIOR` — no data on the reference to observe |
| F-17 | Báo cáo doanh số | `IN_PROGRESS` | — | Tab reads `/reports/revenue`; totals not asserted |
| F-18 | Kết quả kinh doanh | `NOT_STARTED` | — | Static figures |
| F-19 | Công đoạn điều trị | `VERIFIED` | `e2e/treatment-stage.spec.ts` | Chưa làm → Đang làm → Hoàn thành, persisted across reload; progress and the "công đoạn gần nhất" card follow the real stages. **Model is BlueDental's assumption** — see the note below |
| F-20 | Phân tách chi nhánh | `VERIFIED` | `e2e/branch-isolation.spec.ts` | A branch-scoped account is refused another branch and never sees its rows |

## F-19 note — assumed, not observed

The reference never exposed a treatment-stage payload that could be read without
mutating production. What was observed is only: the ability subject
`treatmentStage` and its six verbs, the per-service "Thêm công đoạn" action,
`stageIds` / `patientStages[]` on CSKH records, and `stageNote` in the treatment
summary. Everything else — sequence numbers, tooth selection, timestamps, and the
rule that an image-required service cannot close a stage without a photo — is
BlueDental's own design and is documented as such in `TreatmentStage`.

The acceptance spec therefore verifies **BlueDental's** chain end to end, not
parity with the reference.

## Backend regression nets (not acceptance)

| Suite | Count | Last run |
|-------|-------|----------|
| `BlueDental.Domain.Tests` | 162 | 2026-08-23 — pass |
| `BlueDental.Application.Tests` | 51 | 2026-08-23 — pass |
| `BlueDental.EntityFrameworkCore.Tests` | 39 | 2026-08-23 — pass |
| `BlueDental.HttpApi.Host.Tests` | 15 | 2026-08-23 — pass |
| `BlueDental.FE` Vitest | 3 | 2026-08-23 — pass |
