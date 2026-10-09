# F-58 — Đơn thuốc: chẩn đoán chọn từ phiếu điều trị + liều Sáng/Trưa/Chiều/Tối

Status: `VERIFIED` · Verified on: uncommitted work on top of `5d1d7af6` (2026-10-08)
— see `01-feature-verification-registry.md`. Builds on F-23 (`prescription.md`).

Source: BA mock `P0710.drawio` (dialog "Thêm/Cập nhật đơn thuốc"). BlueDental's own
design, not observed on the reference. Owner decisions (2026-10-08):

- One row = one diagnosis of one phiếu điều trị; its teeth are merged.
- The slip stores the links **and** a snapshot (số phiếu, tên chẩn đoán, răng)
  plus the printed text, so the print and the edit dialog survive later changes
  to the phiếu.
- Source = every phiếu of the patient on the branch **except cancelled** ones.
- ~~Session dosing is for the prescription screen only. The Đơn thuốc mẫu
  (`/taxonomy`, section 17) keeps "lần × mỗi lần"; a picked template is
  converted (`doseFromTemplate`).~~ **Reversed by the owner 2026-10-10 (R-884):**
  the Đơn thuốc mẫu dialog uses the same line table as "Danh sách thuốc"
  (Sáng / Trưa / Chiều / Tối · Số ngày · Số lượng · Sử dụng). Templates store
  the four sessions, so "Lưu đơn thuốc mẫu" and picking a template copy them
  as they are; `doseFromTemplate` is gone. Migration
  `20261009201645_RxTemplateSessionDoses` backfills old template lines with the
  same rule as below.
- The diagnosis is optional, so a patient with no phiếu can still be prescribed.

## Behaviour

- Khối "Chẩn đoán" folds, open by default, chip "n đã chọn".
- "Danh mục ICD-10" opens a panel whose only group is "Phiếu điều trị (n)".
  Rows are grouped by "Buổi điều trị", the day the phiếu was opened, newest
  first, as in the mock ("Buổi điều trị hôm nay · 3 chẩn đoán", "Buổi điều trị
  07/10/2026 · 2 chẩn đoán"; R-824). Each row has a checkbox, the số phiếu tag,
  the diagnosis name and the teeth. There is a local filter
  (số phiếu / tên / răng) and "Xong, thu gọn".
- The picked table: Số phiếu · Chẩn đoán · Răng · Thuốc gợi ý theo phác đồ · ×,
  then "Trên đơn in: DT01 – … (R36, R37); …".
- "Ghi chú chẩn đoán" is filled from the source notes: line note, or else the
  CDyy phiếu chẩn đoán note through the advise. Distinct notes go one per
  line and a duplicate is shown once. It is refilled on every pick change until
  the doctor types in it; editing a slip keeps the saved note. From two notes
  on, each line starts with "- "; a single note stays bare (R-825).
- Medicine lines: Sáng · Trưa · Chiều · Tối · Số ngày, plus Số lượng
  = (S+Tr+C+T) × số ngày, derived and disabled. Below 640px each line is a card.
- The print shows "Sáng 1 · Tối 1 · 5 ngày".
- **UI only** (no ICD-10 catalogue exists): the ICD-10 search box (its dropdown
  shows "Chưa liên kết danh mục ICD-10" and a link that opens the panel), the
  "Thuốc gợi ý theo phác đồ" column, "+ Thêm vào đơn" and "Thêm thuốc của tất
  cả chẩn đoán" (disabled, with a tooltip). See `docs/clone/unknowns.md`.

## API surface (changes over F-23)

```
GET  /api/v1/app/prescriptions/diagnosis-sources?patientId&clinicBranchId
       → [{ treatmentPlanId, planCode, planCreationTime, diagnosisId,
            diagnosisName, toothCodes[], notes[] }]
POST/PUT /api/v1/app/prescriptions
       + diagnosisNote, diagnoses[{ treatmentPlanId, diagnosisId }]
       items[{ medicationId, morning, noon, afternoon, evening, days, usage, otherUsage }]
PrescriptionDto + diagnosisNote, diagnoses[{ …ids, planCode, diagnosisName, toothCodes, sortOrder }]
```

- `diagnosisText` (printed) max length is now 2000.
- The server builds the snapshot from the DB and ignores anything the client
  sends.
- Errors:
  - `BlueDental:Treatment:0044`: the phiếu is not the patient's live phiếu on
    this branch, or it carries no such diagnosis.
  - `BlueDental:Treatment:0045`: the same pair was picked twice.
- Sources skip service lines that are Cancelled, Replaced or Transferred, and
  lines with no diagnosis. The diagnosis is the line's own, or else the
  advise's. Newest phiếu first.

## Migration `20261007204945_PrescriptionDiagnosesAndDailyDoses`

- Adds 4 dose columns, backfilled from timesPerDay/amountPerTime so the quantity
  does not change:
  - 1 lần → Sáng.
  - 2 lần → Sáng + Tối.
  - 3 lần → Sáng + Trưa + Tối.
  - 4 lần → all four sessions.
  - More than 4 → the extra doses go to Sáng.
- Then drops the old columns.
- Adds the table `PrescriptionDiagnoses` and the column `DiagnosisNote`.

## Evidence

Backend:
- `PrescriptionTests` (Domain) **27**: session quantity, dose guards, duplicate pair.
- `PrescriptionMappingTests` (EF) **8**.
- `PrescriptionAppServiceContractTests` **18**.

Real stack: production build (`vite preview` :8081), API :5000, PostgreSQL. Login
goes through the login form and nothing is intercepted.

`e2e/prescription.spec.ts` **7/7**. Each run creates its own treatment plan with
two diagnosed lines.

| Case | What is checked |
|------|-----------------|
| Tab | Columns, and the dialog opened from `create=true` |
| Create | The section is open, folds and reopens; the panel lists only "Phiếu điều trị"; ticking 2 rows fills the table (số phiếu, răng), the "Trên đơn in" line and the merged, deduplicated note; S/Tr/C/T × days gives Số lượng; the template is filed; after a reload the row is there |
| Sửa | The picks, note and doses come back; a typed note is kept on PUT |
| In | The print shows the session doses and the diagnosis text |
| Isolation | Another patient's phiếu → 4xx `Treatment:0044`; a pair picked twice → `0045` |
| Branch | An account limited to branch 2 → 403 on the slip list and on `diagnosis-sources` |
| Xóa | Asks first, the row is gone after a reload |

`e2e/prescription-allergy.spec.ts` **2/2** (the "Nhập chẩn đoán" box is gone; rows
are found by the code returned from the POST).

Visual check: desktop 1440 and mobile 390 screenshots against the mock.
- At mobile width the panel filter used to collapse to an icon. It now takes its
  own row (`.rx-slip-filter` flex 100%).
- Card doses used to read "1.0". They now go through `plainDose`.
- At mobile width the picked table scrolls sideways (accepted).

## R-884 (2026-10-10) — Đơn thuốc mẫu dosed by session too

Owner reversed the "template keeps lần × mỗi lần" decision.

- `PrescriptionTemplateLine`: Morning / Noon / Afternoon / Evening (numeric
  18,2) + Days; Quantity = sum × days. TimesPerDay / AmountPerTime removed.
- Migration `20261009201645_RxTemplateSessionDoses`: adds the 4 columns,
  backfills with the rule above (1 → Sáng, 2 → Sáng + Tối, 3 → Sáng + Trưa +
  Tối, 4 → all, beyond 4 → Sáng), drops the old columns; Down folds back.
  Checked in the local DB: e.g. 2 lần × 1.5 became Sáng 1.5 + Tối 1.5.
- "Lưu đơn thuốc mẫu" and picking a template copy the sessions as they are;
  `doseFromTemplate` removed.
- FE: the line table, cards and "Thêm mới" moved to
  `src/components/prescription-lines/` (`PrescriptionLineList`,
  `PrescriptionLineTable`, `PrescriptionLineCard`, `dose.ts`); the
  treatment-management `RxMedicineTable` / `RxMedicineCard` were deleted.
  i18n `Treatment:Rx:Morning…` → `Common:Rx:*`; `Common:Rx:TimesPerDay` /
  `AmountPerTime` removed.
- `e2e/prescription.spec.ts`: the line now carries Chiều 0.5 (7.5 thuốc), a
  dose "n lần × mỗi lần" could not hold; the next slip picks the template and
  gets Sáng 1 / Trưa 0 / Chiều 0.5 / Tối 1 × 3 back; print "Sáng 1 · Chiều 0.5 ·
  Tối 1 · 3 ngày".

Evidence (Build production :8093 → host :5000 (bản build mới) → PostgreSQL thật, không chặn API): Domain **824/824**, Application **704/704**, EF prescription/catalog
**13/13**; `prescription` + `prescription-allergy` + `taxonomy-dialogs`
(template tests) + `taxonomy-import*` **24/25**. The red one is the 403 test
whose cleanup cannot find the new staff row on `/staff`; it fails identically on
a HEAD build.
