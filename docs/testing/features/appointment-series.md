# F-65 — Lặp lại lịch hẹn (Tạo lịch hẹn)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

BlueDental-local feature (BA request + 4 mockups, 2026-10-09; no reference page).
In the "Tạo lịch hẹn" dialog, a **"Lặp lại lịch hẹn"** checkbox under Giờ hẹn /
Phút. Ticked, it shows the repeat rule and a third column "Danh sách buổi hẹn".

- **Everything is read off Ngày hẹn** (BA: "Dựa vào ngày hẹn mình lấy ra thứ"):
  - Hàng ngày
  - Hàng tuần vào thứ X (X = weekday of Ngày hẹn)
  - Hàng tháng vào ngày D (D = day of Ngày hẹn; day 29/30/31 falls back to the
    last day of a shorter month)
  - Tuỳ chỉnh…: "Mỗi [− N +] [ngày | tuần | tháng]" — the unit is a
    `Segmented` like the calendar's Ngày / Tuần / Tháng, styled per the BA mock
    (grey track, white picked item); for tuần, "Vào thứ" chips T2…CN with Ngày
    hẹn's weekday always on (locked) (R-874).
- **Kết thúc** (shown for every option, not only Tuỳ chỉnh — local decision,
  mockup only drew it under Tuỳ chỉnh): `Segmented` "Sau số lần | Đến ngày", and
  under it only the chosen input — stepper "− 6 + lần" (default 6, 1–60) or a
  date (no date before Ngày hẹn). At most **60 sessions** (BA, R-877; was 100)
  (`BlueDental:Appointment:0013`), interval 1–99 (`0014`).
- Every session keeps the first one's clinic wall-clock time (UTC+7) and length.
- **Danh sách buổi hẹn**: index, "T5, 08/10/2026", "09:00 – 09:30", status chip.
  Clicking a row moves "Lịch đã hẹn" (mini calendar) to that day in day view and
  marks the slot with a dashed box.
- **Trùng lịch** (red row + reason tooltip) when: the dentist is booked, the
  patient is booked, the slot is outside the dentist's shift (R-742 rule), the
  dentist is off that day, or the time has passed. Any Trùng lịch blocks the
  whole save with the **toast** "Bác sĩ đã có lịch bị trùng, không thể tạo lịch
  hẹn" (`BlueDental:Appointment:0012`, BA: no per-case resolution). The server
  re-checks on save, so a race still refuses the series.
- Footer: "Từ dd/MM/yyyy đến dd/MM/yyyy"; save button "Lưu N lịch hẹn"; success
  toast "Đã tạo N lịch hẹn".
- Ticked, Ghi chú moves under Nội dung (column 2) and the list takes column 3,
  filling the row height and scrolling inside (R-876);
  ≤ 1100 px the list wraps under the form, full width, 330 px tall.
- Normal booking only — not Lịch tạm.

### Editing a session of a series

- The checkbox is ticked and locked; the rule cannot change.
- Only the opened session is edited (the usual single-booking save).
- The list is read-only but rows still click to the mini calendar; the edited
  session is outlined.
- Statuses after booking: Đã hẹn, Đổi giờ (same day, other time), Đã đổi lịch
  (other day), Đã huỷ hẹn, **Kết thúc** (completed — greyed; save is disabled and
  the server refuses edit/delete with `0015`; the calendar card menu hides
  delete for it).
- A booking that is not in a series shows no repeat field when edited.

## Implementation

BE
- `Domain/Appointments/AppointmentRecurrence.cs` — value object, `DatesFrom(first)`.
- `Domain/Appointments/AppointmentSeriesPlanner.cs` — domain service, whole series
  checked in three queries (bookings, timekeeping records, shift defaults).
- `Domain/Appointments/AppointmentSeries.cs` — aggregate; `Appointment.SeriesId`,
  `SeriesPlannedStart` (the planned slot, so Đổi giờ / Đã đổi lịch can be told
  apart later); migration `20261009084720_AppointmentSeries`.
- `Application/Appointments/AppointmentSeriesAppService.cs` (derives from
  `BlueDentalAppService`) + `HttpApi/Appointments/AppointmentSeriesController.cs`:
  `POST /api/v1/app/appointment-series/preview` and `POST …` (appointment.create),
  `GET …/by-appointment/{id}` (appointment.read).

FE (`src/features/appointments/`)
- `types/appointmentSeries.ts`, `api/appointmentSeries{Api,Queries,Adapters}.ts`.
- `hooks/useRecurrence.ts` (rule state + debounced preview input),
  `hooks/useAppointmentSeriesDialog.ts` (preview / series read, focus, save).
- `components/Recurrence{Field,CustomPanel,EndRow,Stepper,SessionList}.tsx`,
  `recurrenceLabels.ts`, `appointmentSeriesSlots.tsx`; CSS in `calendar.css`
  (`appt-recur-*`, `appt-series-*`, `mcal-day-focus`).
- i18n `Appointment:Series:*` in BE `vi.json` / `en.json`.

## Tests

| Layer | Spec | Result |
|---|---|---|
| Domain | `AppointmentRecurrenceTests` (rule dates, month-end fallback, limits) | in Domain **810/810** |
| Application | `AppointmentSeriesAppServiceContractTests` (base class, permissions, contract) | **5/5**; Application **704/704** |
| API (real HTTP + PostgreSQL) | `e2e/appointment-series-api.spec.ts` (incl. 60 ok / 61 refused) | **5/5** |
| UI (real browser, no interception) | `e2e/appointment-series-ui.spec.ts` | **2/2** |
| Regression (Level 2, production build) | series ui/api + `appointment*`, `appointment-working-hours`, `day-timeline`, `patient-appointment` | **23/23** |

UI spec: weekly × 6 → six "Còn trống" rows on the right weekdays at 09:00, range
footer, row 3 click → mini calendar reads that day and shows the marker, "Lưu 6
lịch hẹn" → toast, six bookings in one series read back by API and after reload
in the list; a dentist booking on week 2 → that row red "Trùng lịch" with the
reason tooltip, Lưu → toast, nothing stored.

Not covered in the browser: the edit-mode lock (covered by the API spec — `0015`
and the series read) and the Tuỳ chỉnh / monthly presets (covered by the domain
tests and the API spec).
