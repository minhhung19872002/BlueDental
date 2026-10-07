# Marketing → Ticket (F-55, đợt 1 + đợt 2)

BlueDental-local. The reference app.nfcdental.com has no ticket screen; this is
cluster 8 of the BA list `Danh-muc-chuc-nang-nha-khoa-v2.pdf`. Built so far:

| BA item | Text | Built as |
|---|---|---|
| 8.1 Danh sách Ticket | Quản lý danh sách ticket của từng nhân viên và trạng thái xử lý | `/marketing/tickets`: list, status tabs with counts, detail modal (field grid of the details, care history below, the row's actions in the footer) |
| 8.2 Ticket Tag List | Phân loại theo Tag, cấu hình số ngày xử lý tối đa theo tag; chuyển data cho telesale khác | `/marketing/tags` (Thời gian xử lý = SLA days), and "Phân công" on a single ticket |
| 8.3 Chuyển Ticket | Chuyển dữ liệu ticket theo điều kiện lọc cho nhân viên xử lý hoặc cho nhóm nhân viên khác | "Chuyển ticket" on the Ticket toolbar: every ticket under the current filter goes to one or more staff (đợt 2) |
| 8.4 Ticket File | Quản lý ticket theo file, tình trạng xử lý theo từng file import. Import theo template có sẵn hoặc template tùy chọn. Chia dữ liệu cho nhóm hoặc cho nhân viên | `/marketing/files`: imported files with their progress; Import file dialog (the template or the clinic's own layout + column mapping, shared to staff); a row opens the Ticket list narrowed to the file (đợt 2) |
| 8.5 Ticket đã xóa | Ghi nhận ticket đã xóa, lý do xóa và khôi phục | `/marketing/deleted` |
| 8.7 Lọc Ticket | Lọc theo điều kiện tùy chỉnh | Filter bar: search, Ngày nhận, status tabs, Người phụ trách, Nguồn, Thẻ. No saved filters: 8.7 does not ask for them, removed R-804 |

Not built yet: 8.6 Ticket Website (landing-page API) — later.

## Workflow

```
Mới (1) ──first contact──▶ Đang chăm sóc (2) ──đặt lịch──▶ Đã đặt lịch (3) ──check-in──▶ Đã đến (4)
  │                          │   ▲                          │
  └──────── Không tiềm năng (5) ◀┘   └── appointment cancelled / no-show / deleted ──┘
             (reason required)  ──Mở lại──▶ Đang chăm sóc
```

- The first logged contact moves Mới → Đang chăm sóc. A contact on a pool ticket (no assignee) claims it for the caller.
- Contact results: Quan tâm, Không có nhu cầu, Không nghe máy, Không liên lạc được, Hẹn gọi lại. Hẹn gọi lại needs a call-back time (0003).
- Đặt lịch from Mới or Đang chăm sóc:
  - The phone matches a patient → a regular appointment; a dentist is required (0005).
  - No patient → a lịch tạm.
  - The usual appointment rules apply (slot, dentist shift, `appointment.create`).
  - Only from the ticket's own branch (0012).
- `TicketAppointmentFollower` runs inside the appointment's unit of work:
  - check-in → Đã đến;
  - cancel, no-show or delete → back to Đang chăm sóc;
  - restoring the appointment → Đã đặt lịch.
  - It leaves alone a ticket that is already closed by hand or already arrived.
- Không tiềm năng from Mới or Đang chăm sóc needs a reason (trimmed, ≤ 500). It clears the call-back time. Mở lại puts the ticket back to Đang chăm sóc.
- A closed ticket (Đã đến / Không tiềm năng) refuses contacts and edits (0002); an invalid jump gives 0004.
- Every step writes a `TicketActivity` row: Created, Contact, StatusChanged, Assigned, Reoccurred, Booked, AppointmentChanged, Deleted, Restored. The detail modal's "Lịch sử chăm sóc" reads these.

## Decisions

| Question | Decision |
|---|---|
| Code | `TK000001`, sequential per branch |
| Same phone arrives again | The phone is normalised (`TicketPhone.Normalize`). If an open ticket already holds that phone in the branch, nothing new is created. The existing ticket records Reoccurred, and the create answers `{ ticket, reoccurred: true }`. |
| SLA ("Thời gian xử lý") | Deadline = start + the **shortest** `MaxProcessingDays` among the ticket's tags. Start = time received, or the last re-assignment (assigning restarts the clock). Quá hạn = past the deadline and not yet booked. No tag with days → no deadline. |
| Who sees what | `marketingTicket.readAll` → every ticket of the branch. Without it → the unassigned pool plus your own tickets. Someone else's ticket answers 0010 on read and on write. |
| Assignee picker | `GET marketing-tickets/assignees` lists the branch staff, so assigning does not need `staff.read` |
| Delete | Soft delete with a required reason. Đã xoá lists the reason and the deleter, and Khôi phục brings the ticket back. A restore is refused (0009) when another open ticket now holds the phone. |
| Tags | Soft-deleted. A deleted tag disappears from its tickets. Name is unique per branch (0008). |
| "Nhóm nhân viên" (8.3, 8.4) | No staff-group entity: the BA does not define one. A group is several staff picked in the same multi-select. Tickets are dealt in turn (round-robin, `TicketDistribution.AssigneeAt`), so a group of two gets an even split. |
| Chuyển ticket scope | Every ticket the list's current filter matches (search, Ngày nhận, status tab, Người phụ trách, Nguồn, Thẻ, file), not a row selection. Own scope applies as in the list. Order: Ngày nhận, then code. A ticket already with its target is skipped. Each move writes Assigned on the timeline and restarts the SLA clock, as Phân công does. One branch only: the button is disabled under "Tất cả chi nhánh". |
| Import all-or-nothing | Every row is checked first. One bad row → nothing is written, not the file either, and the dialog lists each Excel row number with its errors. |
| Import duplicates | The same phone twice in the file is a row error ("trùng với dòng N"). A phone that already has an open ticket in the branch is not an error: that ticket records Phát sinh lại, counted as "Khách liên hệ lại", and no new ticket is made. |
| Template vs own layout | `GET …/template` gives the 4-column file (Họ và tên*, Số điện thoại*, Email, Ghi chú). Any other .xlsx works too: the mapping step picks which column is which. Headers that read as the template's own names are pre-matched. First sheet only. |
| Per-file settings | Nguồn / Kênh, Thẻ and Chia cho apply to every new ticket of the file. Channel = File. Leaving Chia cho empty puts the tickets in the pool. |
| File progress | "Tình trạng xử lý" counts the file's own tickets by status, for the whole branch (not own-scoped). Opening the file applies the usual own scope to the list. |

## API

```
GET    /api/v1/app/marketing-tickets                ?ClinicBranchId&Filter&Statuses&TagId&AssigneeId&Unassigned
                                                    &SourceTaxonomyId&SourceEntryId&Channel&FromDate&ToDate
                                                    &OverdueOnly&CallBackDue&ReturningCustomer&ImportFileId&Deleted&Skip&MaxResultCount
GET    /api/v1/app/marketing-tickets/stats          → total, new, inCare, booked, arrived, notPotential, overdue, callBackDue
GET    /api/v1/app/marketing-tickets/assignees      ?clinicBranchId
GET    /api/v1/app/marketing-tickets/{id}
GET    /api/v1/app/marketing-tickets/{id}/activities
POST   /api/v1/app/marketing-tickets                → { ticket, reoccurred }
PUT    /api/v1/app/marketing-tickets/{id}
POST   /api/v1/app/marketing-tickets/{id}/contacts | claim | assign | not-potential | reopen | appointments | restore
POST   /api/v1/app/marketing-tickets/transfer       body = the list filter + assigneeIds[] (≥ 1) → { matched, transferred }
DELETE /api/v1/app/marketing-tickets/{id}           body { reason }

GET/POST/PUT/DELETE /api/v1/app/marketing-ticket-tags

GET    /api/v1/app/marketing-ticket-files           ?ClinicBranchId&Filter&SkipCount&MaxResultCount → files + progress
GET    /api/v1/app/marketing-ticket-files/{id}
GET    /api/v1/app/marketing-ticket-files/template  → mau-ticket.xlsx
POST   /api/v1/app/marketing-ticket-files/inspect   multipart file → { headers, rowCount, suggested }
POST   /api/v1/app/marketing-ticket-files           multipart file, clinicBranchId, fullNameColumn, phoneColumn, emailColumn,
                                                    noteColumn, sourceTaxonomyId, sourceEntryId, tagIds[], assigneeIds[]
                                                    → { committed, rowCount, createdCount, reoccurredCount, errors[{ row, errors[] }], file }
```

Permissions: `marketingTicket.read|readAll|create|update|delete|transfer` and
`marketingTicketTag.read|create|update|delete`. They sit in the Phân quyền tree under
the group Marketing. `transfer` gates Phân công and Chuyển ticket. Ticket File (list,
template, import) needs `create`; sharing an import to staff also needs `transfer`
(without it the dialog hides Chia cho and the tickets go to the pool).

## Errors (`BlueDental:MarketingTicket:*`)

| Code | Meaning |
|---|---|
| 0001 | Phone number invalid |
| 0002 | Ticket is closed |
| 0003 | Hẹn gọi lại needs a call-back time |
| 0004 | Status change not allowed |
| 0005 | The ticket has a patient: pick a dentist |
| 0006 | Assignee does not work in this branch (also: Chuyển ticket with nobody chosen) |
| 0007 | Tag missing or from another branch |
| 0008 | Tag name already used |
| 0009 | Another open ticket holds this phone (restore) |
| 0010 | The ticket belongs to someone else (a business error, not an empty 403 — R-797) |
| 0011 | Retired (saved filters were removed, R-804) |
| 0012 | Booking only from the ticket's branch |
| 0013 | Import: the file is not a readable .xlsx |
| 0014 | Import: the file has no data rows |
| 0015 | Import: Họ và tên or Số điện thoại is not mapped to a column of the file |

## Server-side checks

- Branch scope on every call, through the shared branch guard. Tags and assignees must belong to the ticket's branch.
- Own scope (pool + own tickets) is applied in the list query and in every single-ticket fetch (`GetCheckedAsync`).
- Slot times are converted to UTC before they reach Npgsql (R-796).
- The delete reason is saved before the soft delete (R-795).

## UI (R-798)

The screens follow the system's catalog look, the same frame as Mẫu Labo, and reuse the shared components rather than custom ones:

- Frame: `bd-shell-page` > `PageHeader` > `.mkt-page` > `PageTabBar` (Ticket · Thẻ ticket · Đã xoá) > `bd-cat-header` + `bd-cat-body` > `bd-cat-card` > `DataTable`. The table scrolls inside the card.
- Ticket toolbar, row 1: search (360 px), `PeriodPicker` (Ngày / Tuần / Tháng / Chọn thời gian), then Thêm ticket on the right.
- Row 2 (wraps when narrow): `SegmentedTabs` with counts (Tất cả, Mới, Đang chăm sóc, Đã đặt lịch, Đã đến, Không tiềm năng, Quá hạn xử lý, Cần gọi lại), then `FloatingLabel` + `SearchSelect` for Người phụ trách, Nguồn khách and Thẻ ticket (R-803). Kênh tiếp nhận and Loại khách are not filters: the Nguồn column shows "Nguồn · Kênh" and the customer cell carries the Khách cũ badge. The API still accepts `channel` / `returningCustomer`.
- Cells: `bd-cat-name` / `bd-cat-subtle`, empty cells show "—" (`bd-cat-num`), status uses `StatusBadge` + `STATUS_TONE`, and row actions use `bd-cat-rowactions` + `ActionTooltip`. The pager uses `useTablePagination` + `countedTotal` ("Hiển thị 1–20 trên N ticket").
- Dialogs: `AppDialog` + `FloatingField` in a `Row`/`Col` grid, as in the Labo supplier and staff dialogs. Radio groups and colour swatches keep a plain label, as in `StaffEditorModal`.
- Under 768 px the page scrolls as a whole instead of keeping the fixed frame.

## UI — đợt 2 (R-805)

- Ticket toolbar: "Chuyển ticket" next to Thêm ticket (only with `transfer`). Disabled with a tooltip under "Tất cả chi nhánh" or when nothing matches. The dialog states "N ticket khớp bộ lọc hiện tại", asks Chuyển cho (multi-select, required) and toasts "Đã chuyển X/N ticket".
- Tab "Ticket File" (`/marketing/files`, only with `create`): search by file name, Tải file mẫu, Import file. Columns: Tên file, Thời gian import, Người import, Số dòng, Ticket mới, Khách liên hệ lại, Chia cho, Tình trạng xử lý.
- A file row opens `/marketing/tickets?file=<id>`: the list carries a green "File: …" chip; closing it drops the `file` param. The param survives a reload.
- Import dialog, 3 steps: Chọn file (Upload.Dragger, .xlsx only, branch hint, template link) → Ghép cột & chia dữ liệu (Họ và tên*, Số điện thoại*, Email, Ghi chú shown as "Cột B · header"; Nguồn, Kênh, Thẻ, Chia cho) → Kết quả (summary, or the error table by row with Quay lại).

## Known limits

- Two creates at the same instant can race for the same `TK` code.
- Changing a tag's Thời gian xử lý does not move deadlines already computed.
- `AppointmentId` stays on the ticket after the appointment is cancelled or marked no-show.
- The counts on the status tabs ignore the status, overdue and call-back filters (they count by the other filters).
- The dentist picker in the booking dialog lists staff, so it needs `staff.read`.
- The Nhân viên filter is shown only to `readAll` users; the Đã xoá tab only to `delete` users.
- Chuyển ticket has no closed-status guard: tickets already Đã đến / Không tiềm năng under the filter move too. Pick a status tab first to avoid that.
- A Phát sinh lại row of a file is not linked to the file: the file's ticket list shows only the tickets it created.
- Import has no row or size limit beyond the host's upload limit.

## Files

- BE Domain `Marketing/`: `Ticket`, `TicketActivity`, `TicketAppointmentFollower`, `TicketImportFile` (+ `TicketDistribution`), `TicketPhone`, `TicketTag`.
- BE Domain.Shared: `Enums/MarketingTicketEnums.cs`, plus error codes, abilities and permissions.
- BE Application `Marketing/`: `MarketingTicketAppService` (incl. `TransferAsync`), `MarketingTicketFileAppService`, `TicketFileReader`, `MarketingTicketTagAppService`, `TicketListQuery`, `TicketMapper`, `TicketReferenceChecker`.
- BE Contracts: `IMarketingTicketAppService`, `MarketingTicketDtos`, `MarketingTicketFileDtos`.
- BE HttpApi: `Marketing/MarketingTicketControllers.cs`, and a Marketing group in `PermissionTreeBuilder`.
- BE migrations: `20261007073431_MarketingTickets`, `20261007100854_MarketingTicketFiles`.
- FE `features/marketing/`:
  - `api/`: `ticketApi`, `ticketSupportApi`, `ticketFileApi`.
  - `components/`: `MarketingShell` (the Labo frame shared by the three tabs), toolbar, filter bar, `TicketCells`, dialogs, `TicketDetailDialog` and timeline, `TransferDialog`, `TicketImportDialog` / `TicketImportMapping` / `TicketImportResult`, `ticketFileColumns`, `marketing.css`.
  - `hooks/`: `useTicketFilters`, `useTicketActions`, `useTicketRights`, `useSourceOptions`, `useTicketTransfer`, `useTicketImport`.
  - `pages/`: Ticket, Thẻ ticket, Ticket File, Đã xoá, home redirect.
- FE wiring: `router.tsx`, `nav.ts`, `routePermissions.ts`, `useAbility.ts`.
- Tests:
  - `Domain.Tests/Marketing/TicketTests.cs`;
  - `e2e/marketing-ticket-api.spec.ts`, `e2e/marketing-ticket.spec.ts`, `e2e/marketing-ticket-files-api.spec.ts`, `e2e/marketing-ticket-files.spec.ts`, `e2e/fixtures/marketingTicket.ts`.
