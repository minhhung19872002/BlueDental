# F-03 — Chấm công (Lịch làm việc)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The "Lịch làm việc" tab of the calendar screen: the KPI bar and one attendance
card per staff member.

## API surface

```
GET  /api/v1/app/time-keepings?clinicBranchId&fromDate&toDate
GET  /api/v1/app/time-keepings/summary?clinicBranchId&workDate
POST /api/v1/app/time-keepings/open-day
POST /api/v1/app/time-keepings/{id}/{register-working,register-day-off,check-in,check-out,overtime}
POST /api/v1/app/time-keepings/close-abandoned
```

## Rules under test

- Registration (ON/OFF) locks once a shift has been checked in.
- Check-in is refused on a day registered as off.
- A shift cannot be checked out before it is checked in, or twice.
- An open shift at end of day becomes "nghỉ ngang".
- Clocking yourself needs `workSchedule.update`; clocking someone else needs
  `workSchedule.attendanceOthers`.

## Acceptance evidence

`e2e/timekeeping.spec.ts`:

1. asserts the board's six KPIs render from `/time-keepings/summary`
2. asserts the tab lives in the URL (`?tab=timekeeping`) and survives a reload

## Not covered yet

- Check-in / check-out through the UI: no staff has a day record seeded, so there
  is no card to act on. Domain rules are unit-tested (18 tests); an acceptance
  spec needs a seeding step that opens the work day first.
- Overtime and the end-of-day sweep
