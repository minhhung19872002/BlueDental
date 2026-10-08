# F-60 — Hồ sơ công việc nhân viên (cụm 11 mục 1)

Status: `VERIFIED` · Verified on: uncommitted work on top of `84adde11` (2026-10-08)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/staff-employment.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/staff-employment.spec.ts` **2/2**; each
run creates and deletes its own staff member.

| Case | What is checked |
|------|-----------------|
| API | Chức vụ (trimmed), số / ngày / nơi cấp CCHN, loại hợp đồng and its dates are stored and read back by a separate GET; the chức vụ shows up in `/staff/positions`; end before start → 403 `BlueDental:Staff:0009`, a certificate dated 2099 → `0010`, contract type 9 → `0011`; Không thời hạn with no end and a cleared certificate save as `null` |
| Dialog | "Hồ sơ công việc" block: chức vụ typed, "Có thời hạn" picked, an end before the start blocked on the form ("Ngày kết thúc phải từ ngày bắt đầu trở về sau"), then saved; read back by GET and shown again after a reload |

Found while testing: ABP hands a "yyyy-MM-dd" extra property back as a
`DateTime`, so dates read as `null` until the reader took that shape too.

## Backend

- Domain: `StaffEmploymentTests` **7**. Domain.Tests 759, Application.Tests 683 green.
