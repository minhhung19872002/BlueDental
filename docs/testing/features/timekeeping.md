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
- Lịch làm việc grid (`POST /time-keepings/bulk-register`, BA 2026-10-02): the
  caller may only set or clear X (day off) on **their own** row, on a day not
  yet passed, not clocked in and not planned L. Every role, admin included;
  marking L is never accepted; one locked cell refuses the whole batch
  (`BlueDental:Timekeeping:0013`, 403). `workSchedule.update` is still required.
  V/L/X display logic is unchanged.

## Acceptance evidence

`e2e/timekeeping.spec.ts`:

1. asserts the board's six KPIs render from `/time-keepings/summary`
2. asserts the tab lives in the URL (`?tab=timekeeping`) and survives a reload

`e2e/work-schedule-own-dayoff.spec.ts` (R-650 … R-653), signed in as a run
staff member through the real login screen:

1. another staff's row (empty future day, clocked-in L) is refused for admin and
   for the run staff; separate reads show nothing written
2. own row: X on a later day persists and clears; past day, marking L, a mixed
   batch and today once clocked in are refused; the check-in survives
3. UI: own L and every cell of another row are disabled; own empty cell → X →
   Lưu → reload keeps X; clicking X clears it again and that persists too

## Not covered yet

- Check-in / check-out through the UI: no staff has a day record seeded, so there
  is no card to act on. Domain rules are unit-tested (18 tests); an acceptance
  spec needs a seeding step that opens the work day first.
- Overtime and the end-of-day sweep
