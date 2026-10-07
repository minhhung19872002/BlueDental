# F-50 — Người giám hộ trong hồ sơ bệnh nhân

Status: `VERIFIED` (uncommitted) · Source: BA spec (ảnh), 2026-10-07 · Regression log: R-772, R-773 (UI theo mock), R-774 (UI tweaks), R-775 (responsive) · Not committed yet

Not a reference-clone feature: app.nfcdental.com has no guardian section. It is a BA
addition to the "Tạo hồ sơ" / "Chỉnh sửa hồ sơ" dialog.

## Scope

- Age = current year − birth year. Shown as a chip in the dialog's Ngày sinh field.
- Under 16 (with a birth date) → at least one guardian is required. Without a birth date there is no age and no requirement.
- A third pill "Người giám hộ", always shown:
  - a red dot when a guardian is required and missing;
  - ✓ when guardians are entered.
- When a guardian is required and missing:
  - an orange banner with a "Nhập ngay" button;
  - the footer note "Chưa có thông tin người giám hộ";
  - Lưu disabled.
- The popup "Thông tin người giám hộ":
  - Header: ← (back), plus the breadcrumb "Tạo hồ sơ › Người giám hộ".
  - Top of the body: the patient summary with the age chip.
  - Group rules:
    - 1 guardian = a single form, with "+ Thêm người giám hộ thứ 2" in the footer;
    - 2–3 guardians = a group view with an accordion;
    - at most 3 guardians;
    - exactly 1 primary contact.
  - Search for an existing hồ sơ by phone or CCCD ("Tìm & điền").
  - Relation pills. "Khác" adds:
    - a required "Ghi rõ quan hệ";
    - a required paper type (constants: Giấy uỷ quyền, Quyết định công nhận giám hộ, Giấy khai sinh, Khác);
    - an optional JPG/PNG/PDF scan ≤ 5MB.
  - Required: name, phone, CCCD. Optional: everything else (DOB, ngày/nơi cấp, giới tính, email, nghề nghiệp, địa chỉ).
  - "Cùng địa chỉ với khách hàng" shows "Lấy theo: …".
  - The consent tick is required.
- "Lưu & quay lại hồ sơ" only hands the group back to the hồ sơ dialog. Nothing reaches the server until the hồ sơ's own Lưu.
- X, ← and Hủy drop the popup's edits.

## Decisions (owner, 2026-10-07)

| Question | Decision |
|---|---|
| Storage | A separate table `bd_patient_guardians` (FK `PatientId`, nullable `LinkedPatientId` when the guardian is picked from an existing hồ sơ). Not JSON on the patient row. |
| Older under-16 records with no guardian | Blocked on save (FE and BE) until a guardian is added. |
| Proof file for "Khác" | Optional for now. If it becomes required later, validate on the FE. |
| Pill visibility | Always shown, not only for under-16. |
| Primary contact | Only stored; nothing sends SMS to it yet. |
| Relation → gender | No auto-fill. |
| Detail page "Hồ sơ" tab | Does not show guardians. |

## API surface

```
POST /api/v1/app/patients                     guardians?: [...], guardiansConsented: bool
PUT  /api/v1/app/patients/{id}                guardians: null = keep the saved group, [] = clear it (refused under 16)
GET  /api/v1/app/patients/{id}                → guardians[] (id, relation 1–8, proof*, consentedAt, …)
POST /api/v1/app/patients/guardian-documents  multipart "file" → { blobName, fileName }
GET  /api/v1/app/patients/{id}/guardians/{guardianId}/document
```

Error codes (HTTP 403, `error.code`):

| Code | Meaning |
|---|---|
| `Patient:0013` | under 16 with no guardian |
| `Patient:0014` | more than 3 guardians |
| `Patient:0015` | not exactly 1 primary contact |
| `Patient:0016` | consent not ticked |
| `Patient:0017` | "Khác" without its note or paper type |
| `Patient:0018` | bad document: type, signature, > 5MB, or a blob name outside this branch |
| `Patient:0019` | name, phone or CCCD missing |

Server-side rules:

- Upload needs `Patient.Create` or `Patient.Update`.
- Blobs live under `patient-guardians/{branchId}/`, and a saved blob name must sit under the caller's branch prefix.
- A proof file is kept only on a "Khác" guardian. On any other relation the server drops it.
- A paper whose guardian was removed, or which a new upload replaced, is deleted after the save.

## Acceptance evidence

All runs used the real login, the host on :5000 and real PostgreSQL. The browser tests ran on the production build (`vite preview` on 127.0.0.1:8080). Nothing was intercepted.

| Test | Result |
|---|---|
| `BlueDental.Domain.Tests/PatientManagement/PatientGuardianTests.cs` | 13 facts, green |
| `e2e/patient-guardian-api.spec.ts` | **5/5** |
| `e2e/patient-guardian.spec.ts` | **1/1** |

`e2e/patient-guardian-api.spec.ts` sends real HTTP from the logged-in page and covers:

- under 16 by year with `[]` or no guardians → `0013`;
- 16 by year (birthday 31/12) and an undated record → 200;
- 4 guardians → `0014`; 0 or 2 primaries → `0015`; no consent → `0016`;
- a blank phone → `0019`; "Khác" with nothing filled → `0017`; "Khác" with a note and a paper but no file → 200;
- a 2-guardian group → a separate GET reads it back (order and primary);
- PUT with `null` keeps the group; PUT by id renames and drops one; PUT with `[]` → `0013`;
- an adult changed to under 16 → `0013` until a guardian is added;
- uploads: `.txt`, a fake `.pdf` and a > 5MB file → `0018`; a real PDF → saved on "Khác" and downloaded (`%PDF-`);
- a forged blob name on "Khác" → `0018`; the same name on a parent is dropped (null);
- the BRANCH2 user downloading the paper → refused.

`e2e/patient-guardian.spec.ts` walks the dialog in the browser:

1. Enter a 9-year-old: the chip reads "9 tuổi"; the dot, banner and footer note show; Lưu is disabled.
2. The three pills share one row.
3. "Nhập ngay" opens the popup: breadcrumb "Tạo hồ sơ" and the chip "9 tuổi · Bắt buộc có người giám hộ".
4. An empty "Lưu & quay lại" leaves the errors under the inputs.
5. Guardian 1 is typed in. Guardian 2 is found by phone with "Tìm & điền" from an adult created through the API.
6. Tick consent, then "Lưu & quay lại": the ✓ shows, with 2 cards and the first one as primary contact.
7. Lưu, reload, "Chỉnh sửa": the same 2 cards come back from the DB, marked "Đã xác nhận".

Regression on the same build (level 2):

- `patient-national-id.spec.ts` 3/3 and `patient-editor-inputs.spec.ts` 3/3. Both drive the same hồ sơ dialog.
- `patient.spec.ts` 35/65. None of the 30 failures reaches the hồ sơ dialog:
  - The detail page opens on Chẩn đoán & Tư vấn, as it does at HEAD, so the tests that expect `.pd-profile-card` or "Chỉnh sửa hồ sơ" there time out.
  - The demo seed has no slip with a service line.
  - The rest is công đoạn and money UI drift.
  - These match the pre-existing patient reds (R-649). Details are in R-772.

UI polish against the BA mock (R-773), same build:

- The banner sits under Ngày sinh in the middle column.
- The popup is 880px wide with a 3-column grid (1000px since R-774).
- `patient-guardian` 1/1, `patient-guardian-api` 5/5, `patient-national-id` 3/3, `patient-editor-inputs` 3/3.

Owner tweaks (R-774), same build:

- Once a birth date is set, the age chip replaces the calendar icon in Ngày sinh.
- The native file input under "Khác" is hidden. AntD's form reset had forced `display: block` over `hidden`.
- The popup is 1000px wide.
- The Giới tính radios sit level with Email / Nghề nghiệp.
- 14px from the consent to the footer rule (was 46px).
- 12/12 on the same four specs.

Responsive check (R-775), same build, at 1280 / 1024 / 768 / 390px:

- No horizontal overflow at any size.
- ≤ 900px the grid has 2 columns; ≤ 640px it has 1.
- ≤ 640px the popup stacks:
  - the footer (add / count on its own line, Hủy and Lưu under it);
  - the age chip under the patient name;
  - the search button under the input;
  - the group header and each panel header.
- Same 12/12.

## Known limitations

- **Orphaned blobs**: a file uploaded in the popup and then abandoned (Hủy, or the hồ sơ dialog closed without Lưu) stays in MinIO under `patient-guardians/{branchId}/`. No cleanup job exists yet.
- The primary contact is not used by SMS/Zalo reminders yet.
- Guardians are not shown on the patient detail page's Hồ sơ tab (by decision).
- Not tested yet:
  - the "Khác" upload through the browser (it is covered over the API);
  - the 3-guardian cap in the UI (the Add button disables at 3; the BE cap is tested).
