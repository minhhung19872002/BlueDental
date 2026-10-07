# F-51 — Xác thực IP theo chi nhánh (cụm 11 mục 11)

Status: `VERIFIED` · Verified on: uncommitted work on top of `383c6cf4` (2026-10-07)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/branch-ip-restriction.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/branch-ip-restriction.spec.ts` **5/5**:

| Case | What is checked |
|------|-----------------|
| Outside the network | Wrong password → generic message, nothing about IP. Right password → `POST /api/account/login` 403 `BlueDental:Auth:LoginIpNotAllowed`, the form shows "Tài khoản này chỉ được đăng nhập từ mạng của phòng khám…", reload stays on `/login` |
| Listed or exempt | `client-ip` returns the address the server sees; a loosely typed list is stored normalized (`203.0.113.9/24` → `203.0.113.0/24`, one per line); a PUT without the field keeps it; `/accessible` hides it; the account signs in once its address is listed; with the list back to the office only, ticking "Cho phép đăng nhập ngoài công ty" (read back by a separate GET) lets it in |
| Bad entry | `203.0.113.x` → 403 `BlueDental:Organizations:0007`, message names the entry, the stored list is unchanged |
| Session carried on | Signed in while listed; the address is removed; within the one-minute cache the next page load lands on `/login?reason=ip` with "Bạn đã bị đăng xuất vì đang dùng mạng ngoài phòng khám", and the cookie is gone (`current-user` 401) |
| Dialogs | Branch dialog shows "IP hiện tại của bạn: …", "Thêm vào danh sách" appends it and turns into "Đã có trong danh sách", Lưu persists (separate GET); staff dialog tick persists across a reload |

Isolation: each run creates its own branch (`CN IP <n>`) and staff member, and
deletes them; a sweeper with a fresh admin session removes any `CN IP <n>`
branch before and after the group, because a leftover list locks clinic-wide
non-admin accounts out of other specs (R-789).

## Backend

- Domain: `BranchIpRestrictionTests` **27** (parsing, CIDR containment, IPv4-mapped
  IPv6, normalization, refusal by name, the policy's four rules).
- Application.Tests 671, HttpApi.Host.Tests 24 (controller conventions, host
  configuration) green.

## Permission / branch scope

- Branch list and edit keep their `Organizations.*` permissions; `client-ip`
  needs a signed-in user only.
- The rule is scoped to the account's own branches (assignments → home branch →
  all branches for a clinic-wide account).

## Not covered

- The address seen through Caddy → nginx on production (R-790): verify
  `GET /api/v1/app/account/client-ip` from a clinic network before entering a list.
- The bearer-token path (`/connect/token`) is not used by the app and is not
  guarded by the sign-in check; the per-request middleware still applies to it.
