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
- `isImageRequired` is **recorded, not enforced**. It was originally a stated
  assumption — a service carrying "Yêu cầu hình ảnh khi điều trị" would refuse
  completion until a picture was attached — and the reference was then observed
  to tick Hoàn thành with no image at all, so the block is gone (R-287). What the
  flag actually drives on the reference is UNKNOWN_REFERENCE_BEHAVIOR; the app
  only surfaces it as a hint ("Cần ảnh" tag, and an advise-form alert).
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
domain rules above — including the inverse of the removed image rule: a stage
whose service sets `isImageRequired` completes with no image attached.

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

## 2026-09-24 — per-tooth công đoạn, continue chain, warranty chain (observed on staging)

The provenance note above no longer covers the dialog: on 2026-09-24 the owner
had the warranty flow worked on staging (record HN8510) and the stage modal's
logic was read from the reference's published chunks. What is now observed, not
assumed, is listed in docs/clone/pages/patient-detail.md ("Survey 2026-09-24").

Model changes: `TreatmentStage.ContinuedFromId`, `IsSuperseded` (the reference's
`disabled`), `WarrantyRootStageId`; `StageTeethPolicy`; `POST …/{id}/continue`
now writes the next công đoạn (`ContinueTreatmentStageDto`); a warranty create
names `warrantySourceStageId`. Migration `20260924032742_AddStageContinuationChain`
(back-fills `IsSuperseded`).

| Rule | Where it is enforced | Test |
|---|---|---|
| A new công đoạn takes only teeth of its line that no công đoạn holds | `StageTeethPolicy.EnsureNewStageTeeth` (0030/0031/0032) | Domain `StageChainAndWarrantyTests`; e2e `treatment-stage-chain` "several cards…" |
| Several cards open at once, one save writes one công đoạn per form | `useStageComposer.save` | e2e "several cards…" |
| Continue writes a new row, keeps the teeth, supersedes the old one | `TreatmentStage.ContinueAs` | Domain; e2e "continuing writes the next visit…" |
| A superseded công đoạn refuses every change | `TreatmentStage.GuardLive` (0018) | Domain; e2e (complete on the old one refused) |
| A warranty: finished live source, period, days left, no open warranty, root's teeth | `StageTeethPolicy.EnsureWarranty` (0033–0036) | Domain; e2e "a warranty picks among the root's teeth…" |
| A line closes only when every tooth has had a công đoạn and every live one is finished | `TreatmentStageAppService.MoveServiceLineAsync` | e2e (existing Hoàn thành specs) |
| Another branch cannot continue a branch-1 công đoạn | `BranchAccessChecker` in `LoadAsync` | e2e "another branch may not continue…" (403) |
| Plan table "Chỉnh sửa": closed/paid lines refused, in-treatment price/diagnosis/staged teeth kept | `TreatmentService.Revise` (0037/0038/0039) | Domain `TreatmentServiceReviseTests`; e2e "Chỉnh sửa rewrites a saved line…" |
