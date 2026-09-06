# F-23 — Đơn thuốc

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The "Đơn thuốc" tab of the patient record: listing the patient's slips on the
current branch, creating one with medicine lines, filing it as a Đơn thuốc
mẫu, editing it, and deleting it.

Rebuilt 2026-09-05 against the staging reference (see
`docs/clone/pages/patient-detail.md`, Tab 7) and the product owner's answers
(Sửa/Xóa only; "Tên đơn thuốc mẫu" field; create/edit/delete scope).

## API surface

```
GET    /api/v1/app/prescriptions?patientId&clinicBranchId
GET    /api/v1/app/prescriptions/{id}
POST   /api/v1/app/prescriptions
         { patientId, clinicBranchId, staffId, diagnosisText, note, treatmentType,
           followUpDate, saveAsTemplate, templateName,
           items[{ medicationId, timesPerDay, amountPerTime, days, usage, otherUsage }] }
PUT    /api/v1/app/prescriptions/{id}      (same body minus patientId/clinicBranchId)
DELETE /api/v1/app/prescriptions/{id}
GET    /api/v1/app/catalog-entries?group=prescription_template   (template picker)
GET    /api/v1/app/catalog-entries?group=medication_type         (medicine picker)
```

## Rules under test

- A slip needs a doctor and at least one medicine line; `Số lượng` is
  `Ngày uống × Mỗi lần × Số ngày`, computed by the domain and shown disabled.
- The code is `DT{yy}-{nnnn}`, unique per branch.
- `saveAsTemplate` with a `templateName` creates a `prescription_template`
  catalog entry carrying the lines and the lời dặn; picking that template on
  a later slip prefills lines and lời dặn.
- Every read and write is checked against the caller's branches
  (`BranchAccessChecker`); a foreign branch is refused with **403**.
- Permissions: `Prescription.Read/Create/Update/Delete`.

## Acceptance evidence

Backend (`dotnet test`) — shape and invariant checks, not runtime evidence:

- `PrescriptionTests` (Domain) — line arithmetic, code format, guards.
- `PrescriptionAppServiceContractTests` (Application) — reflection only: each
  operation carries its own `Prescription.*` permission, the reference's absent
  operations (dispense / cancel / export) do not exist, and the create / item
  DTOs mirror the reference dialog and its template lines.
- `PrescriptionMappingTests` (EF) — model metadata after the
  `20260905120000_RebuildPrescriptionLines` migration: `bd_prescription_items`
  columns and types, `Quantity` not mapped, the branch and sort indexes.

Persistence, template filing and branch refusal are proven only by the
real-stack spec below.

Frontend (`e2e/prescription.spec.ts`, `vite preview` 8080 → real API 5000,
real login, no interception), serial:

1. Tab shows the six reference columns and the "Hiển thị n trên m" pager;
   "Tạo đơn thuốc" writes `create=true`, "Hủy" clears it, the direct URL opens
   the dialog, other tab links do not carry the flag; "Lưu" is disabled empty.
2. Create: doctor, diagnosis, lời dặn, medicine 2×1×3 → Số lượng 6, tick
   "Lưu đơn thuốc mẫu" → name field → POST 2xx → row `DT\d{2}-\d{4}` →
   reload → reopen and pick the template → Số lượng 6 and lời dặn prefilled.
3. Sửa opens "Cập nhật đơn thuốc" prefilled, PUT persists across a reload.
4. `branch2` fetching the slip under branch 1 gets **403** and sees no row.
5. Xóa confirms with the code, DELETE 2xx, row gone after reload.

Result 2026-09-05: 5/5 on three consecutive runs. Shared-component retest
(Level 3): the taxonomy/payment-qr/branch suite on the production build
(`vite preview`, port 8080) is 42 tests: 39 green, 3 red. The 3 red ones
(`taxonomy-dialogs.spec.ts:152`, `:207`, `taxonomy.spec.ts:277`) fail identically
on a clean build of `HEAD` `20c4815` and are attributed in
`03-regression-log.md` (2026-09-05, "chạy lại đủ bộ danh mục"): a click-timing
trap on the virtualised medicine dropdown, and the shell's `.app-content`
scroller; neither is caused by the shared line editor.

## Known deviations

- "Lưu" is disabled until the form is valid; the reference renders it enabled
  and its click was not tried (mutation).
- App-wide primary colour and `AppDialog` title size differ from staging's
  theme; both are global tokens, not feature choices.
- Print / PDF is out of scope (owner: Sửa and Xóa only).
