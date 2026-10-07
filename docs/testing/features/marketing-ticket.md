# F-55 — Marketing → Ticket (đợt 1: BA 8.1, 8.2, 8.5, 8.7 · đợt 2: 8.3, 8.4)

Status: `VERIFIED` (uncommitted) · Source: BA `Danh-muc-chuc-nang-nha-khoa-v2.pdf` cluster 8 · Regression log: R-795..R-798, R-801..R-807 · Behaviour: `docs/clone/pages/marketing-ticket.md`

## Acceptance specs (real stack, no interception)

| Spec | Cases | What it proves |
|---|---|---|
| `e2e/marketing-ticket-api.spec.ts` | 8 | (1) Mới → Đang chăm sóc on the first contact, and the contact claims the pool ticket. Hẹn gọi lại without a time → 0003. Không tiềm năng without a reason → 400. A closed ticket refuses contacts (0002) and booking (0004). Mở lại → Đang chăm sóc. Then a separate read and the timeline. (2) The same phone, spelled differently → Phát sinh lại on the open ticket. (3) Tag SLA: deadline = received + 3 days, a duplicate tag name → 0008, the TagId filter. (4) Đặt lịch without a patient → lịch tạm; cancelling the appointment → back to Đang chăm sóc. (5) A phone that matches a record links the patient, and booking needs a dentist (0005). (6) Assignees = branch staff; assign and return to pool are both on the timeline. (7) A branch-2 account gets 403 on branch 1's ticket, list and assignees. (8) Own scope: a dentist granted only `read`+`update` gets 0010 on a colleague's ticket and does not see it listed. The dentist does see the pool ticket, and their contact claims it. Their DELETE gets 403 and the ticket stays. |
| `e2e/marketing-ticket.spec.ts` | 2 | Through the UI: Thêm ticket → Mới, Ghi nhận liên hệ → Đang chăm sóc, reload keeps it, the drawer shows Lịch sử chăm sóc, Xoá asks for a reason, Đã xoá shows it, Khôi phục. Thẻ ticket with Thời gian xử lý persists. |
| `e2e/marketing-ticket-files-api.spec.ts` | 4 | (1) Chuyển ticket: 4 tickets under a search go to 2 staff → `{matched 4, transferred 4}`, 2 each, Assigned on the timeline, a ticket outside the filter stays in the pool; the same call again → transferred 0; nobody chosen → 400; a stranger id → 0006. (2) A file of the clinic's own layout (other headers, other column order): inspect returns the headers, 3 rows and no suggestion; import with an explicit mapping and 1 assignee → 2 created (phone with a space normalised), 1 Phát sinh lại on the existing open ticket (kind 5, no second ticket); `ImportFileId` lists the 2, both with the assignee; the file list shows created 2, progress new 2. (3) The template headers are pre-matched; a file with a missing name, a bad phone, a bad email and an in-file duplicate is refused whole: rows 3-6 with their Vietnamese messages, the good row and the file are not written. Phone not mapped → 0015, not an .xlsx → 0013. (4) A branch-2 account gets 403 importing into, listing and transferring branch 1. |
| `e2e/marketing-ticket-files.spec.ts` | 3 | Through the UI: (1) Import file dialog on `/marketing/files` → Tiếp tục → template headers pre-matched ("Cột B · Số điện thoại") → Chia cho one staff member → "Import 2 dòng" → Đã import file → the row in Ticket File with the staff name → click → `/marketing/tickets?file=` with the File chip and both rows under that staff member → reload keeps chip + 2 rows → closing the chip drops the param. (2) A file with a nameless row → "File chưa được import", error table row 3 "Thiếu họ tên", Quay lại back to step 1; nothing in the database. (3) Chuyển ticket from the list under a search: "2 ticket khớp bộ lọc hiện tại", empty submit → "Vui lòng chọn ít nhất một nhân viên", 2 staff → toast "Đã chuyển 2/2 ticket", after a reload one ticket each. |
| `Domain.Tests/Marketing/TicketTests.cs` | part of 663 | Transitions, SLA arithmetic, phone normalisation, the appointment follower (incl. Đã đến on check-in, which e2e cannot reach: check-in is same-day only). |

## Run 2026-10-07

- Setup: `vite preview` build on :8357, a private host build on :5001 (all three fixes), real PostgreSQL.
- Results:
  - Marketing **10/10** (API 8, UI 2).
  - Level 3 (the follower hooks appointment events): `appointment`, `appointment-history`, `appointment-working-hours` **11/11**.
  - Domain.Tests **663/663**, `tsc -b` clean, eslint clean on the new files.

## Run 2026-10-07 (đợt 2, R-805..R-807)

- Same setup: production build on :8357 → private host :5001 (migration `MarketingTicketFiles` applied), real PostgreSQL, no interception.
- `marketing-ticket` + `marketing-ticket-api` + `marketing-ticket-files` + `marketing-ticket-files-api` **17/17** in one run.
- Domain.Tests (Marketing + abilities) **50/50**. `tsc -b` and eslint clean.

## Notes for the next run

- Granting a single leaf such as `marketingTicket.read` with the Phân quyền search box is not possible. The search is a substring match, so it also ticks `readAll` and friends. The own-scope spec therefore grants via `PUT /api/permission-management/permissions?providerName=R&providerKey=dentist` and revokes it in `finally`.
- AntD accessible names carry the icon name ("delete Xoá"), so match with `/Xoá$/`.
- AntD 6 drawers have no `.ant-drawer-content`. Use `getByRole("dialog", { name })`.
- Not covered by any spec yet: the Quá hạn / Hẹn gọi lại filters as UI, and restore refused by a newer open ticket with the same phone (0009).
- The staff dropdowns are virtual lists: other specs add staff (e.g. `BAC SI …` dentists), so the wanted name can be out of view. `pick()` types the name before clicking `.ant-select-item-option`.
- Multipart uploads go through `uploadTicketFile` (page fetch + XSRF + `Accept-Language: vi`, so header matching and row errors are Vietnamese).
- Not covered by a spec: an import shared to a group via the UI (the API case covers one assignee; transfer covers the round-robin), the template download in the UI, and 0014 (header row only).
- Arrival (Đã đến) is not driven end to end: the check-in needs a same-day appointment inside a shift. The cancel path covers the follower instead.
