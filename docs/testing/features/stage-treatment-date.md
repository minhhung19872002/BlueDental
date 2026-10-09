# F-62 — Ngày điều trị trên công đoạn

Status: `VERIFIED` (2026-10-09, uncommitted, base f43a7853)

Source: BA request (BlueDental-specific, not a reference observation). See the
override note under "Chi tiết phiếu" in `docs/clone/pages/patient-detail.md`.

## Rules

| Rule | Enforced in | Test |
|---|---|---|
| A công đoạn carries a Ngày điều trị; omitted = today (clinic day, UTC+7) | `TreatmentStage.Add` / `ContinueAs` | Domain `Treatment_date_is_today_unless_picked_and_never_after_today`; e2e API test |
| Ngày điều trị after today is refused (`BlueDental:Treatment:0046`) on create and continue | same | Domain; e2e API test |
| FE picker: required, defaults to today, days after today disabled, no clear | `StageForm`, `stageDraft` | e2e UI test |
| `CreationTime` kept, not shown | — | e2e UI test (creationTime is today while treatmentDate is the past day) |
| Lịch sử điều trị groups and dates by Ngày điều trị | `useStageComposer` (`byWorkedOrder`) | e2e UI test |
| Hồ sơ treatment table Ngày column = Ngày điều trị | `treatmentRows` | e2e UI test (after reload) |
| In lịch sử / Nhắc lịch print Ngày điều trị | `TreatmentHistoryPrintDialog`, `RecallDialog` | code only |
| Warranty days left count from Ngày điều trị | `StageTeethPolicy.WarrantyDaysLeft`, FE `warrantyState` | Domain; e2e API test (31 days ago refused 0035, 29 days ago accepted) |
| Legacy import writes the sheet's treatment day into Ngày điều trị | `DataMigrationAppService` | Application DataMigration tests |
| "Tạo bảo hành" picks Ngày điều trị (same picker, required, today default); the warranty công đoạn is saved with it (R-853) | `StageFollowUpDialog`, `useFollowUpForm`, `StageDateField` | e2e follow-up test |
| "Tạo tái khám" picks Ngày điều trị; `PatientReExamination.TreatmentDate`, omitted = today, after today refused (0046) (R-853) | `PatientReExamination.Raise` | Domain `Ngay_dieu_tri_*`; e2e follow-up test (UI + API) |
| Hồ sơ treatment table dates a tái khám row by its Ngày điều trị | `treatmentRows` | e2e follow-up test (after reload) |

## Verification

- Backend: Domain.Tests 777/777; Application.Tests 685/685 (incl. StageChainContract,
  DataMigration and the re-exam contract `A_Follow_Up_Should_Carry_A_Picked_Ngay_Dieu_Tri`).
- Real browser: `e2e/stage-treatment-date.spec.ts` 3/3 against the production build
  (vite preview :8093) → API host :5000 → PostgreSQL, no interception.
- Migration `20261009013454_StageTreatmentDate` applied locally and back-filled 528 rows
  with 0 mismatches. Migration `20261009021402_ReExaminationTreatmentDate` back-filled
  the 4 local tái khám rows from their clinic-local creation day, 0 left unset.
- Regression: `treatment-stage*`, `stage-staff-pickers`, `cskh-after-treatment` 15/15;
  the 6 follow-up tests in `patient.spec` green.
- Permission / branch: unchanged endpoints and guards. The existing
  `treatment-stage-chain` branch-2 test is still green.

## Open

- None. The follow-up dialogs point was settled by the BA on 2026-10-09 ("cũng cho
  chọn ngày luôn") and built as R-853.
