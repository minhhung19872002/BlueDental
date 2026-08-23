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

## Not covered yet

- Creating a diagnosis or an advise (no dialog yet — F-09)
- Editing a patient
- Branch isolation: only one branch is seeded, so cross-branch denial is untested
