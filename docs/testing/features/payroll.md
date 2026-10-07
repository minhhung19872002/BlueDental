# F-57 — Bảng lương (cụm 11 mục 5, chấm công mục 6)

Status: `VERIFIED` · Verified on: uncommitted work on top of `eb033298` (2026-10-07)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/payroll.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/payroll.spec.ts` **3/3**. Each run creates
its own branch with one staff member, sets the pay terms through the API, clocks
today's morning shift in and out with 2 h tăng ca, and files one approved and
one draft Phạt tiền — all through the real endpoints the screens use.

| Case | What is checked |
|------|-----------------|
| API | The month's sheet holds exactly that staff member; ½ ngày công, 120 min tăng ca, salary by days, overtime pay and the approved fine (not the draft) match the formula; a second sheet for the month → 403 `BlueDental:Payroll:0006`; a corrected ngày công and Thưởng survive "Tính lại" and new terms (26 days, hệ số 2) and the row recomputes; the Excel (parsed back) carries the name and the net figure; after Chốt, recalculation and delete → 403 `0004` |
| Branch scope | A user limited to one branch with `payroll.read/update` sets the pay of that branch's staff (200) but not of a clinic-wide account (403 `BlueDental:Authorization:0001`); admin may |
| Screen | "Lương cơ bản & phụ cấp" lists the pay; "Tạo bảng lương" creates the draft; "Điều chỉnh" Thưởng 750.000 shows on the row; "Chốt bảng lương" → "Đã chốt" after a reload, no "Tính lại" any more |

Not covered at runtime: hoa hồng (needs a completed công đoạn at the test
branch); its arithmetic is unit-tested (`PayrollCommission`).

## Backend

- Domain: `PayrollTests` **16** (row arithmetic, caps, overtime, kept
  adjustments, staff joining/leaving, chốt freezing, terms range, default
  standard days, chấm công → ngày công, commission per step).
- Catalogue of abilities: 89 subjects (`payroll` added).
- Domain.Tests 726, Application.Tests 676, HttpApi.Host.Tests 24 green.

## Regression (level 2–3)

`staff`, `staff-penalty`, `staff-penalty-api`, `staff-day-off-api`, `timekeeping-api`, `timekeeping-leave`,
`role-permissions-tree`, `role-permissions-unsaved`, `payroll`, `discount-limit`: **25/25**.
