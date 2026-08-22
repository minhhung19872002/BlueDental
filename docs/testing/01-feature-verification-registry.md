# Feature Verification Registry

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `READY_FOR_TEST` · `FAILED` ·
`VERIFIED` · `DIRTY` · `BLOCKED`.

Only `VERIFIED` means the feature passed **real runtime acceptance** — real
browser, real API, real PostgreSQL (see `00-test-policy.md`).

Last run: 2026-08-23, stack on `localhost:5173` (Vite) → `localhost:5019` (API)
→ PostgreSQL 15 in Docker. Acceptance suite: **9 passed**.

| ID | Feature | Status | Acceptance spec | Notes |
|----|---------|--------|-----------------|-------|
| F-01 | Đăng nhập | `VERIFIED` | `e2e/fixtures/auth.ts` (used by every spec) | Real login form, real cookie auth |
| F-02 | Danh mục (taxonomy + catalog entries) | `VERIFIED` | `e2e/taxonomy.spec.ts` | Group + priced service created and persisted across reload |
| F-03 | Chấm công (lịch làm việc) | `VERIFIED` | `e2e/timekeeping.spec.ts` | KPI bar served by `/time-keepings/summary`; tab persisted in URL |
| F-04 | Thu chi (phiếu thu/chi + duyệt) | `VERIFIED` | `e2e/finance.spec.ts` | Pending expense excluded from Tổng chi; approval adds exactly its amount |
| F-05 | Luân chuyển dòng tiền | `VERIFIED` | `e2e/finance.spec.ts` | Deposit moves Tổng Tiền Mặt by the deposited amount |
| F-06 | Hồ sơ bệnh nhân (đăng ký + danh sách) | `VERIFIED` | `e2e/patient.spec.ts` | Registered through the UI, persisted, reopened from the list |
| F-07 | Sơ đồ răng theo mặt (chẩn đoán & tư vấn) | `VERIFIED` | `e2e/patient.spec.ts` | Whole-tooth, whole-jaw and clear all behave; surface text matches the reference wording |
| F-08 | Voucher khuyến mãi | `READY_FOR_TEST` | — | Screen loads against the real API; no acceptance spec for create/redeem yet |
| F-09 | Chẩn đoán & Tư vấn (phiếu chẩn đoán / tư vấn) | `READY_FOR_TEST` | — | Tables read the real API; no create dialog yet, so nothing to accept end to end |
| F-10 | Lịch hẹn (calendar) | `IN_PROGRESS` | — | Day/week/month grids render; appointment creation not verified |
| F-11 | Tiếp nhận | `IN_PROGRESS` | — | Still falls back to mock data when the API is unavailable |
| F-12 | CSKH | `NOT_STARTED` | — | UI only |
| F-13 | Labo | `NOT_STARTED` | — | UI only |
| F-14 | Vật tư | `NOT_STARTED` | — | UI only |
| F-15 | Quản trị vận hành | `NOT_STARTED` | — | UI only; reference payloads unobserved |
| F-16 | Công cụ (call/message/Zalo/hóa đơn) | `BLOCKED` | — | `UNKNOWN_REFERENCE_BEHAVIOR` — no data on the reference to observe |
| F-17 | Báo cáo doanh số | `IN_PROGRESS` | — | Tab reads `/reports/revenue`; totals not asserted |
| F-18 | Kết quả kinh doanh | `NOT_STARTED` | — | Static figures |

## Backend regression nets (not acceptance)

| Suite | Count | Last run |
|-------|-------|----------|
| `BlueDental.Domain.Tests` | 153 | 2026-08-23 — pass |
| `BlueDental.Application.Tests` | 51 | 2026-08-23 — pass |
| `BlueDental.EntityFrameworkCore.Tests` | 39 | 2026-08-23 — pass |
| `BlueDental.HttpApi.Host.Tests` | 15 | 2026-08-23 — pass |
| `BlueDental.FE` Vitest | 3 | 2026-08-23 — pass |
