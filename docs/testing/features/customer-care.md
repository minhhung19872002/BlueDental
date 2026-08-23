# F-12 — CSKH (Chăm sóc khách hàng)

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The CSKH grouping screen: care tasks per patient, grouped by care programme
(Sau điều trị, Sinh nhật, Nhắc lịch hẹn, Định kỳ, Đặc biệt) with per-status
counters.

## API surface

```
GET  /api/v1/app/care-records?branchId&type&status&patientId
GET  /api/v1/app/care-records/stats?branchId&type
POST /api/v1/app/care-records
POST /api/v1/app/care-records/{id}/contact
POST /api/v1/app/care-records/{id}/succeed
POST /api/v1/app/care-records/{id}/fail
POST /api/v1/app/care-records/{id}/cancel
```

## Rules under test

- Lifecycle `New → Contacted → Succeeded / Failed / Cancelled`.
- Succeeding **requires** an outcome (Tốt / Khá / Bình thường / Phàn nàn).
- A closed record is immutable — no further transition is offered.
- The counters are server-derived, not client tallies.
- Every read and write is branch-scoped.

## Acceptance evidence

`e2e/cskh.spec.ts`:

1. seeds a care task through the real API, then drives it from "Chưa CS" to
   "Thành công" in the browser and asserts the counters move by exactly one and
   that no further action is offered;
2. switches care programme and asserts the server is re-queried with that `type`
   rather than the list being filtered client-side.

## Not covered yet

- Zalo send (`zaloSentAt`) — no provider wired
- Scheduling a care appointment from the record
- Care programmes other than Sau điều trị on the reference remain
  `UNKNOWN_REFERENCE_BEHAVIOR`; BlueDental's own enum is what is tested here
