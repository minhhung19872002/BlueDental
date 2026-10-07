# F-51 — Marketing → Ticket (đợt 1: BA 8.1, 8.2, 8.5, 8.7)

Status: `VERIFIED` (uncommitted) · Source: BA `Danh-muc-chuc-nang-nha-khoa-v2.pdf` cluster 8 · Regression log: R-788, R-789, R-790, R-791 · Behaviour: `docs/clone/pages/marketing-ticket.md`

## Acceptance specs (real stack, no interception)

| Spec | Cases | What it proves |
|---|---|---|
| `e2e/marketing-ticket-api.spec.ts` | 8 | (1) Mới → Đang chăm sóc on the first contact, and the contact claims the pool ticket. Hẹn gọi lại without a time → 0003. Không tiềm năng without a reason → 400. A closed ticket refuses contacts (0002) and booking (0004). Mở lại → Đang chăm sóc. Then a separate read and the timeline. (2) The same phone, spelled differently → Phát sinh lại on the open ticket. (3) Tag SLA: deadline = received + 3 days, a duplicate tag name → 0008, the TagId filter. (4) Đặt lịch without a patient → lịch tạm; cancelling the appointment → back to Đang chăm sóc. (5) A phone that matches a record links the patient, and booking needs a dentist (0005). (6) Assignees = branch staff; assign and return to pool are both on the timeline. (7) A branch-2 account gets 403 on branch 1's ticket, list and assignees. (8) Own scope: a dentist granted only `read`+`update` gets 0010 on a colleague's ticket and does not see it listed. The dentist does see the pool ticket, and their contact claims it. Their DELETE gets 403 and the ticket stays. |
| `e2e/marketing-ticket.spec.ts` | 2 | Through the UI: Thêm ticket → Mới, Ghi nhận liên hệ → Đang chăm sóc, reload keeps it, the drawer shows Lịch sử chăm sóc, Xoá asks for a reason, Đã xoá shows it, Khôi phục. Thẻ ticket with Thời gian xử lý persists. |
| `Domain.Tests/Marketing/TicketTests.cs` | part of 663 | Transitions, SLA arithmetic, phone normalisation, the appointment follower (incl. Đã đến on check-in, which e2e cannot reach: check-in is same-day only). |

## Run 2026-10-07

- Setup: `vite preview` build on :8357, a private host build on :5001 (all three fixes), real PostgreSQL.
- Results:
  - Marketing **10/10** (API 8, UI 2).
  - Level 3 (the follower hooks appointment events): `appointment`, `appointment-history`, `appointment-working-hours` **11/11**.
  - Domain.Tests **663/663**, `tsc -b` clean, eslint clean on the new files.

## Notes for the next run

- Granting a single leaf such as `marketingTicket.read` with the Phân quyền search box is not possible. The search is a substring match, so it also ticks `readAll` and friends. The own-scope spec therefore grants via `PUT /api/permission-management/permissions?providerName=R&providerKey=dentist` and revokes it in `finally`.
- AntD accessible names carry the icon name ("delete Xoá"), so match with `/Xoá$/`.
- AntD 6 drawers have no `.ant-drawer-content`. Use `getByRole("dialog", { name })`.
- Not covered by any spec yet: the Quá hạn / Hẹn gọi lại filters as UI, and restore refused by a newer open ticket with the same phone (0009).
- Arrival (Đã đến) is not driven end to end: the check-in needs a same-day appointment inside a shift. The cancel path covers the follower instead.
