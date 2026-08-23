# F-19 — Công đoạn điều trị

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Provenance — read this first

The reference application never exposed a stage payload that could be read
without mutating production, so this feature is **not** a parity clone. It is
BlueDental's own model, built from the five things that were observed:

| Observed | Where |
|----------|-------|
| Subject `treatmentStage` with `read, create, update, continue, complete, print` | `/permissions` |
| "Thêm công đoạn" is a per-row action on the treatment-plan table | Patient detail, tab Kế hoạch điều trị |
| `stageIds` and `patientStages[] = { id, serviceId, serviceDetails.isImageRequired }` | CSKH record payload |
| `summary.recent[] = { treatmentServiceId, treatmentId, treatmentCode, serviceName, stageNote }` | `/patient-treatments/summary` |
| Labo order kind "Tiếp tục công đoạn" | Patient detail, tab Labo |

Everything else is assumed and is marked as such in `TreatmentStage`. Do not cite
this feature as evidence of reference parity.

## Scope

Công đoạn are the steps that make up one treatment service line. In BlueDental a
service line is a `PatientAdvise` the patient accepted, so the chain is:

```
PatientDiagnosis → PatientAdvise → (accept) → TreatmentStage 1..n
```

## API surface

```
GET  /api/v1/app/treatment-stages?patientId&clinicBranchId&treatmentServiceId&status
GET  /api/v1/app/treatment-stages/progress?treatmentServiceId
GET  /api/v1/app/treatment-stages/latest?patientId
POST /api/v1/app/treatment-stages
PUT  /api/v1/app/treatment-stages/{id}
POST /api/v1/app/treatment-stages/{id}/continue
POST /api/v1/app/treatment-stages/{id}/complete
POST /api/v1/app/treatment-stages/{id}/images
DELETE /api/v1/app/treatment-stages/{id}
```

`continue` and `complete` are separate endpoints because the reference gives them
separate ability verbs.

## Rules under test

- A new stage is `Pending`, numbered 1..n inside its own service line.
- `continue` is re-entrant and keeps the first start time.
- `complete` is reachable straight from `Pending` — a user may hold the `complete`
  ability without `continue`.
- A service whose catalog entry sets `isImageRequired` refuses completion until an
  image is attached.
- A completed stage is frozen: no continue, no re-complete, no edit, no new image.
- There is **no cancel state**, because the reference exposes no cancel verb.
- Progress is derived from completed stages, never stored.
- Every read and write is branch-checked through `BranchAccessChecker`.

## Acceptance evidence

`e2e/treatment-stage.spec.ts` (real browser → real API → real PostgreSQL):

1. builds the whole chain through the UI — diagnosis on tooth 11, advise on a
   seeded service, accept — then adds a stage and drives it
   `Chưa làm → Đang làm → Hoàn thành`, asserts the completed row offers no further
   transition, and re-opens the tab to prove it persisted;
2. asserts the progress counter grows by one on create **without** moving the
   completed count, that the "công đoạn gần nhất" card reports the newest note,
   and that completing moves the completed count by exactly one.

Both assert deltas — the patient accumulates stages across runs.

`BlueDental.Domain.Tests/TreatmentManagement/TreatmentStageTests.cs` covers the
nine domain rules above, including the image requirement and the frozen state.

## Fixtures

`BlueDentalCatalogSeedContributor` seeds one diagnosis ("Sâu ngà") and one priced
service ("Trám răng thẩm mỹ") in the default branch, Development only. Without
them the clinical chain has nothing to start from.

## Not covered yet

- Attaching an image through the UI (the endpoint and the domain rule are tested,
  the FE has no uploader on the stage row yet)
- Editing a stage
- `print` — no print pipeline exists yet
- Tooth selection on a stage (the model supports it; the create dialog does not
  offer the chart yet)
