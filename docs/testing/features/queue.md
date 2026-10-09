# F-45 — Màn hình đợi (`/queue`)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

BlueDental-local feature (no reference page; `docs/backlog-priority.md` item 32).
First built to BA item 22 (2026-09-25, one shared pool — R-582..R-583), then
**redesigned 2026-10-09** to the BA's three mockups (board, counter detail, TV)
and the BA's chat answers relayed by the owner:

- **Each counter has its own queue**, its own number prefix (`Ký hiệu số`, 1–2
  characters A–Z / 0–9, unique in the branch, stored upper-case) and its own
  **required** fixed dentist (BA: "Bắt buộc luôn"). The shared pool is gone;
  priority (Ưu tiên before Bình thường) applies inside one counter.
- A dentist heads **one** counter. The dentist can change only while nobody at
  the counter is waiting or being seen (first assignment of a legacy counter
  with no dentist is always allowed). Name, prefix, start number and the other
  settings still save while the queue runs.
- Counter form ("Thêm quầy" / "Chỉnh sửa {name}", BA mock, R-864) replaces
  "Quản lý quầy" while open and hands back to it on close: Tên quầy*,
  Bác sĩ phụ trách* (a set dentist — saved or just picked — is a locked card
  with "Đổi bác sĩ…", which reopens the picker; shut while anyone waits at the
  counter's saved dentist; no specialty line, R-865), Ký hiệu số* (≤ 2 chars) with a live "Hiển thị: A001"
  preview, Số bắt đầu, Ngưỡng cảnh báo chờ (default 30), the daily-reset
  checkbox and "Đặt lại số thứ tự ngay". Phút khám/BN is NOT on the form (owner):
  a counter keeps its value, a new one gets 12.
- Numbering: `prefix + 3 digits` from Số bắt đầu, auto-reset at 00:00 clinic
  time (UTC+7, `ClinicCalendar`); "Đặt lại số thứ tự ngay" restarts at Số bắt
  đầu, numbers still waiting keep theirs and are passed over when numbering
  reaches them. Tickets from earlier days are expired by the worker.
- "Lấy số mới": the receptionist picks the counter (paused counters disabled),
  Độ ưu tiên, Loại dịch vụ, Ghi chú — no patient field (BA dropped it).
- Board `/queue` (restyled to the owner's mockup, R-861): 4 summary tiles with no
  sub-lines, then a white "Các quầy khám" panel with the wait-colour legend and one
  card per counter (accent cycles blue / purple / green)
  (5 × 2 at 1920 px): dentist "BS. …", number being seen, waiting count, longest
  wait coloured by level, "Gọi <next number>", ↻ "Làm mới" (reloads the board,
  R-862) and the waiting-list button. No "Gọi lại" (BA: hide).
  Paused counter ("Tạm nghỉ"): grey status and a locked grey "Quầy tạm nghỉ" button.
- Counter page `/queue/counters/:id`: header with dentist, "Bỏ qua <current>",
  "Gọi số tiếp theo · <next>", 5 stats, waiting table Số · Lấy số lúc · Đã chờ ·
  Dự kiến gọi · Mức chờ. The estimate steps by the median called→completed time
  of that counter's visits of ≥ 2 min today, once there are ≥ 3 of them; before
  that it uses the configured Phút khám/BN (12′) (R-868).
- Chờ lâu nhất = the longest wait among numbers still Waiting, from taking the
  number, whole minutes rounded down; "—" when nobody waits. Số mới chờ = minutes
  until a new normal number would be called: what is left of the visit under way
  (none if idle or overrun) plus one pace per number ahead, rounded up — the same
  clock as Dự kiến gọi; "—" on a paused counter (R-867).
- Wait level against the counter's threshold: < 70 % green Bình thường,
  ≥ 70 % amber Sắp quá ngưỡng, > threshold red Quá ngưỡng (`QueueWaitLevels`).
- TV `/queue/display?branchId=`: anonymous, compact so 10 counters fit at
  1920 × 1080, shows counter, dentist and numbers only — no PHI.
- "Chuyên khoa" on the mockup: UNKNOWN (see `docs/clone/unknowns.md`), not built.

## API surface

```
POST /api/v1/app/queue/tickets                      { counterId*, priority, serviceType, note }
POST /api/v1/app/queue/tickets/call-next            { counterId* }  ← counter's own queue, urgent first
POST /api/v1/app/queue/tickets/{id}/{call,serve,complete,skip,recall}
GET  /api/v1/app/queue/tickets/{id} · GET tickets?date&status&counterId · GET stats
GET  /api/v1/app/queue/counters/board               per-counter current, upcoming, waiting, longest wait
GET  /api/v1/app/queue/counters/{id}/queue          counter + waiting rows (estimate, level) + nextNumber
GET  /api/v1/app/queue/display/board?branchId       [AllowAnonymous] for the TV, no patient fields
GET/POST /api/v1/app/queue/counters · PUT /{id} · POST /{id}/toggle · POST /{id}/reset-sequence · DELETE /{id}
```

Error codes (`BlueDental:Queue:`): `0001` nobody waiting · `0004` counter
required · `0005` call on a paused counter · `0006` take a number at a paused
counter · `0007` prefix used in the branch · `0008` dentist locked (queue busy)
· `0009` dentist already heads a counter · `0010` invalid prefix · `0011`
invalid settings · `0012` not a dentist · `0013` dentist required.

Migration `20261009050840_PerCounterQueue`: counter columns `DentistId`,
`NumberPrefix`, `StartNumber`, `MinutesPerPatient`, `WaitWarningMinutes`,
`AutoResetDaily`, `LastIssuedNumber`, `LastIssuedDate`; existing counters get
A, B, C… per branch; unique `(ClinicBranchId, NumberPrefix)`; the old unique
`(ClinicBranchId, QueueDate, TicketNumber)` is dropped (numbers repeat across
counters and after a reset); pool tickets with no counter are expired.

Permissions are checked on the server per method: reading needs
`BlueDental.queue.read`, taking a number `BlueDental.queue.create`, calling /
skipping / counter management `BlueDental.queue.update`.

## Rules under test

`e2e/queue-api.spec.ts` (12, real HTTP from the logged-in page):

1. No dentist → `0013`; a non-dentist id → `0012`; prefix `A-` → `0010`.
2. Create X (start 5, lower-case prefix stored upper-case) and Y; same prefix →
   `0007`; same dentist → `0009`; an edit dropping the dentist → `0013`.
3. No counter → `0004`; X hands out `X?005`, `006`, `007` (urgent), with X's
   dentist, no patient; read back by GET.
4. Board: X upcoming = [urgent, 005, 006], Y empty; Y call-next → `0001`.
5. call-next takes the urgent number, then 005; the urgent one is Completed.
6. Changing X's dentist while busy → `0008`; a rename still saves.
7. `counters/X/queue`: current, waiting [006], nextNumber `008`, an estimate.
8. Skip leaves the queue; call-next takes 006, then `0001`.
9. Reset: Y 001 skipped, 002 waiting → after reset the next is 001, then 003;
   002 keeps its number.
10. Paused Y → take `0006`, call `0005`, board `isActive=false`.
11. Anonymous TV board answers with no session and no `patientId/patientName`.
12. Branch 2 does not see X and gets 404 calling or taking a number through it.

`e2e/queue.spec.ts` (5, real UI): Lưu disabled until a dentist is picked, card
shows "BS. <dentist>"; two numbers taken through "Lấy số mới", the card calls
the urgent one first ("Gọi X002" then "Gọi X001"), ↻ "Làm mới" reloads the board; the counter page shows the
five columns, one waiting row, survives a reload, "Bỏ qua X002", "Gọi số tiếp
theo · X001", then "Hết số chờ" + "Không có bệnh nhân chờ"; the TV shows the
dentist and the number; pausing marks the card paused, locks "Quầy tạm nghỉ" and
disables the counter in "Lấy số mới".

## Acceptance evidence

2026-10-09, production build (`vite preview --outDir dist-preview-queue` on
127.0.0.1:8123) → host :5000 → real PostgreSQL, real login, nothing
intercepted: **17/17** (`queue-api` 12/12, `queue` 5/5, 30 s). `tsc -b` and
eslint clean. Screenshots checked at 1920 px (board 5 × 2, counter page),
TV 1920 × 1080 with 10 counters, and 390 px mobile. Specs create their own
counters with free dentists / prefixes and soft-delete them afterwards.

## Not covered yet

- Legacy counters created before the redesign (local A, B, C) have no dentist;
  the form makes one required on their next save, but "Lấy số mới" still lets
  a number be taken there. Possible follow-up: refuse numbers at a counter
  without a dentist.
- The midnight auto-reset and the expiry of yesterday's tickets run in
  `QueueWaitingTimeWorker`; not exercised by e2e (would need a clock).
- SignalR push is exercised only indirectly (the board also polls).
- Serve / complete / recall endpoints have no button (only call-next and skip).
