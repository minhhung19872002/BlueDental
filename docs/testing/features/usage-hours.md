# F-52 — Quản lý thời gian sử dụng (cụm 11 mục 13)

Status: `VERIFIED` · Verified on: uncommitted work on top of `588417c5` (2026-10-07)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/usage-hours.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/branch-usage-hours.spec.ts` **5/5**; the
windows are built around the clinic's current time so the spec runs at any hour.

| Case | What is checked |
|------|-----------------|
| Outside the window | Right password → `POST /api/account/login` 403 `BlueDental:Auth:LoginOutsideHours`; the form shows the message with the window ("…trong khung giờ HH:mm–HH:mm"); reload stays on `/login` |
| Inside / exempt | A window spanning now (across midnight when it falls there) lets the account in; a PUT without the times keeps them; with the window ahead again, ticking "Cho phép dùng ngoài giờ" (read back by a separate GET) lets it in |
| Bad input | Half a window, two equal times, "6h" → 403 `BlueDental:Organizations:0008`, stored window unchanged; both blank clears it |
| Session at the end of the window | Signed in inside the window; the window moves ahead; within the one-minute cache the next page load lands on `/login?reason=hours` with "Bạn đã bị đăng xuất vì đã hết khung giờ…", and every later call is refused with the same code |
| Dialogs | Branch dialog shows the saved times; clearing one blocks Lưu with "Nhập đủ cả giờ bắt đầu và giờ kết thúc"; typed 07:00–19:30 persists (separate GET); staff dialog tick persists across a reload and does not touch the IP tick |

Item 11's spec now shares `e2e/fixtures/restrictedStaff.ts` with this one and
was re-run: `branch-ip-restriction` **5/5**.

## Backend

- Domain: `BranchUsageHoursTests` **21** (day and overnight windows, edges,
  half/empty window refused, clearing, the policy's rules, window text).
  Domain.Tests 685, Application.Tests 671, HttpApi.Host.Tests 24 green.
- Migration `BranchUsageHours`: two nullable `time` columns.
