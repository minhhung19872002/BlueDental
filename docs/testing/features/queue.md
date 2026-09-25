# F-43 — Màn hình đợi (`/queue`)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

BlueDental-local feature (no reference page; `docs/backlog-priority.md` item 32),
redesigned 2026-09-25 to BA item 22 "Thiết kế lại màn hình chờ":

- "Lấy số mới" takes a number with **no patient and no counter** — only
  Độ ưu tiên, Loại dịch vụ, Ghi chú. A walk-in has no record yet.
- Block "Các quầy tiếp nhận" **is the whole page** below the header (owner,
  2026-09-25: it replaces the KPI cards, the date/counter filter and the ticket
  table). One card per counter, built to the BA mockup: avatar + name + status
  badge (Đang phục vụ / Tạm ngưng), the number it serves in the card's accent
  colour with the ticket's service type and a clock + HH:mm, the queue's next
  number, and a full-width megaphone "Gọi số tiếp theo" button. Accents cycle
  blue / purple / green.
- Every counter calls from **one shared pool**: urgent numbers first, then the
  lowest number. Calling auto-completes the counter's previous number.
- A paused counter stays on the board, dimmed, with no next number and a locked
  button; the API refuses its call-next.
- Skipped numbers are never taken by call-next — only a manual recall, which
  today exists only as the API `tickets/{id}/recall` (no button on the page).
- TV board (`/queue/display?branchId=`) shows the same cards, anonymous.

Owner decisions (2026-09-25): same global next on every card; auto-complete on
call-next; paused counters remain visible; patient column hidden; skipped numbers
recalled manually; the board fully replaces the stats cards and the ticket table.

## API surface

```
POST /api/v1/app/queue/tickets                      priority, serviceType, note (patientId optional)
POST /api/v1/app/queue/tickets/call-next            { counterId }  ← required, counter must be active
POST /api/v1/app/queue/tickets/{id}/{call,serve,complete,skip,recall}
GET  /api/v1/app/queue/tickets?date&status&counterId
GET  /api/v1/app/queue/counters/board               per-counter current + next (branch of the caller)
GET  /api/v1/app/queue/display/board?branchId       same, [AllowAnonymous], for the TV
GET/POST /api/v1/app/queue/counters · PUT /{id} · POST /{id}/toggle · DELETE /{id}
```

Error codes: `Queue:0001` no ticket waiting · `0004` counter required ·
`0005` counter paused. `bd_queue_tickets.PatientId` is nullable
(migration `MakeQueueTicketPatientOptional`).

## Rules under test

- A number is created without patientId / counterId and persists.
- Board offers every active counter the same next number, urgent first.
- call-next picks urgent → lowest number, pins the ticket to the counter.
- call-next completes the counter's previous Called/Serving ticket; another
  counter's ticket is untouched.
- call-next without counterId → `Queue:0004`; on a paused counter → `Queue:0005`.
- A skipped ticket is passed over by call-next and returns via recall.
- A paused counter's `next` is null; the active one still has a next.
- Another branch's session does not see the counters and gets 404 calling
  through them; the TV board answers with no session.

## Acceptance evidence

Production build (`vite preview` :8083, host :5000, real PostgreSQL), 2026-09-25:

- `e2e/queue-api.spec.ts` — 9 rule tests over real HTTP from the logged-in page:
  **9/9**.
- `e2e/queue.spec.ts` — real UI: no table on the page, Quản lý quầy adds two
  counters, Lấy số mới ×3 (one Ưu tiên) with no patient/counter fields, card A
  calls the urgent number and shows the call time (HH:mm), card B calls the
  next, card A calls again and its urgent ticket is Completed (read back via
  `GET tickets?status=4`), reload keeps the picture, pausing B dims its card
  and locks its button, the anonymous TV page shows A's number and B as
  paused: **1/1**.

Both specs first empty today's shared pool through the real call-next endpoint,
so numbers left by earlier runs do not change the asserted order.

## Not covered yet

- The queue day is `DateTime.UtcNow` (not UTC+7 like Labo, R-521): between
  00:00 and 07:00 local time the board is still on "yesterday".
- SignalR push is exercised only indirectly (the board also polls every 10 s).
- Serve / complete / skip / recall have no UI any more (the ticket table is
  gone); their endpoints stay and are covered by the API spec. If the owner
  wants "Bỏ qua" / "Gọi lại" back, they need a place on the card.
- `GET tickets` and `GET stats` are still served but nothing on the page reads
  them; their hooks remain in `api/` for a later use.
