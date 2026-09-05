# F-06 / F-07 — Hồ sơ bệnh nhân và sơ đồ răng

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

Registering a patient, listing patients, opening a record, and recording tooth
surfaces on the consulting chart.

## API surface

```
GET  /api/v1/app/patients?skipCount&maxResultCount&filter&status&branchId
GET  /api/v1/app/patients/{id}
POST /api/v1/app/patients
PUT  /api/v1/app/patients/{id}
GET  /api/v1/app/patient-diagnoses?patientId
GET  /api/v1/app/patient-advises?patientId  (+ /summary)
```

## Rules under test

- Registration needs a full name, a phone number and a date of birth; the name is
  split into họ (lastName) and tên (firstName) the Vietnamese way.
- The patient code is unique per branch and year.
- The list shows the name in Vietnamese order and never crashes on data the API
  does not send.
- The tooth chart stores `{ code, selected, top, right, bottom, left, center }`;
  marking a surface narrows a whole-tooth selection, and a tooth with nothing
  marked is dropped (the server rejects empty selections).

## Acceptance evidence

`e2e/patient.spec.ts`:

1. registers a patient through the real dialog, asserts the row appears, reloads
   to prove it reached PostgreSQL, then opens the record
2. selects a whole tooth, applies the Hàm Trên shortcut and clears the selection,
   asserting the summary text each time

## Lịch sử thay đổi lịch hẹn (2026-09-05, VERIFIED)

Endpoints: `GET /api/v1/app/appointment-change-log` and `/stats`, filters
`patientId`, `fromDate`, `toDate`, `action`, `statuses[]`, `source`, `actor`,
`keyword`, `importantOnly`. Rows are written by `AppointmentChangeRecorder`
from every write in `AppointmentAppService`; the client never posts to them.

Rules under test:

- Booking an appointment leaves one "Tạo mới" row; editing it leaves a
  "Cập nhật" row whose diff names the field that moved; cancelling leaves
  "Hủy" and is flagged important.
- Stat cards appear only for counts above zero; creations do not add a status
  card.
- The list is scoped to the caller's branch and needs `Appointment.Read`.
- Filters: the week navigator bounds `fromDate` / `toDate`; "Đã đến" sends
  three status codes; "Xóa lọc" returns to the current week.

Acceptance evidence (2026-09-05, dev server on 5185 → API 5000 → PostgreSQL,
nothing intercepted): `e2e/appointment-history.spec.ts`, 4/4 green —

1. a booking made through the real dialog shows up as the newest "Tạo mới"
   row with actor `admin`, source Web, letter avatar; the chevron opens the
   detail (người thực hiện, thông tin truy cập with IP and browser, so sánh
   trước / sau, các trường bị ảnh hưởng) and closes it; footer reads
   "Hiển thị a–b trên n lịch sử";
2. an edit through "Chỉnh sửa lịch hẹn" adds a "Cập nhật" row whose "Thay
   đổi" names `content` (and not the untouched `note`), whose Before → After
   shows `old → new`, and whose stat card appears; Hành động = Tạo mới re-reads
   the list with `action=1` and drops the row; Xóa lọc brings it back;
3. the timeline groups the same rows under "05 THÁNG 9 2026 · n mục" and opens
   the detail inline; closing (the antd close button is named "Đóng" under the
   Vietnamese locale) and reopening reads the log again;
4. the next week is empty: the stat cards give way to the grey bar "Chưa có
   thao tác nào trong khoảng thời gian này.", the bordered "Không có lịch sử
   thay đổi" card shows, the table panel is hidden and the dialog keeps its
   full height (viewport − 32px); the previous week brings the rows back.

Backend: Domain `AppointmentChangeLogTests` 13/13, Application
`AppointmentChangeLog*` 7/7, Host `ControllerConventionTests` 14/14.

Fixed while verifying: the explicit `AppointmentChangeLogController` was
missing (the dialog got 404); the migration had not been applied (the Host does
not migrate — run `BlueDental.DbMigrator`); the stats cards read the wrong
dictionary keys (enum names, not codes) so only "Tổng thao tác" rendered; a
null → "" note was logged as a change on every edit.

2026-09-05, later (Level 2): the history week now runs Sunday to Saturday
like the reference (`weekStartsOn={0}` on the navigator, independent of the
dayjs locale); the timeline dropped its pager and loads the next page of 20
on scroll, its footer counting the rows on screen; every new string has an
English entry in `en.json`. E2E test 3 checks the scroll-load and the missing
pager, test 4 the Sunday week label.

2026-09-05, later (Level 1, visual): the expanded row was restyled to the
reference's card layout (bordered badge strip, icon rows, one-line diff rows,
two-column meta card, pale-blue circle avatars) and `UserAgentSummary` now
keeps browser and OS names without versions ("Chrome trên Windows"). Rows
recorded before that change still carry "Chrome 151" / "Windows 10".
Re-run: e2e 4/4, Application change-log + user-agent tests 13/13.

2026-09-05, later still (Level 1, visual): the stat cards sat flush under
the modal header and the quiet "Chưa có thao tác nào…" bar had a solid
border. Header padding is now 8/16 and body padding-top 14, measured at
1600×900: title 17px under the modal top, first stat card 30px under the
subtitle, both as on the reference. The quiet bar is `1px dashed`. The edit
test now walks the Lịch hẹn pager to its booked row, because the seeded
patient has grown past one page of appointments. Re-run: e2e 4/4.

2026-09-05, multi-select (Level 2): Hành động / Trạng thái / Nguồn take
several values. `GetAppointmentChangeLogListInput` gained `Actions` and
`Sources` lists next to `Statuses`; the FE sends repeated keys. The edit
test now picks Tạo mới alone (no Cập nhật row survives), then adds Cập nhật
and checks both `actions=1&actions=2` go over the wire and the edit row is
back. Re-run: e2e 4/4, Application change-log tests 13/13.

## Not covered yet

- Creating a diagnosis or an advise (no dialog yet — F-09)
- Editing a patient
- Branch isolation: only one branch is seeded, so cross-branch denial is untested
