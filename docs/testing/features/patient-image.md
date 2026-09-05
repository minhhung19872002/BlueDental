# F-24 — Hình ảnh bệnh nhân

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The "Hình ảnh" tab of the patient record: uploading photographs under a
treatment stage, browsing them day by day, opening them in the viewer,
dragging them into order within a day, and deleting them.

Rebuilt 2026-09-05 against the staging reference (see
`docs/clone/pages/patient-detail.md`, Tab 5).

## API surface

```
GET    /api/v1/app/patient-images?patientId&clinicBranchId&type&skipCount&maxResultCount
POST   /api/v1/app/patient-images              (multipart: patientId, type, files[])
GET    /api/v1/app/patient-images/{id}/content
PUT    /api/v1/app/patient-images/reorder      { id, ordering }
DELETE /api/v1/app/patient-images/{id}
GET    /api/v1/app/account/current-user        (permissions the tab keys off)
```

## Rules under test

- Every picture carries a `type` (`Before` = Trước điều trị, `After` = Sau
  điều trị). Upload tags files with the active filter, else `Before`.
- The list is ordered `Ordering desc, TakenAt desc`; the tab groups it by local
  day, newest day first, and lets a card be dragged past another card of the
  same day only. The new position is saved through `PUT /reorder`.
- Upload, sort and delete controls appear only with
  `BlueDental.treatmentImage.create` / `.update` / `.delete`, which
  `current-user` now reports (before this feature it always returned an empty
  list).
- A branch-scoped account that names another branch is refused with **403**,
  not answered with an empty list.
- Delete asks "Xác nhận xoá ảnh" first and toasts "Đã xoá ảnh" only after the
  server answers.
- The viewer is the app's own: zoom / rotate / flip / annotate are client-side
  and never sent to the server.

## Acceptance evidence

Backend: `BlueDental.Domain.Tests/PatientManagement/PatientImageTests.cs` (11)
and `BlueDental.EntityFrameworkCore.Tests/PatientManagement/PatientImageMappingTests.cs` (3).

`e2e/patient-image.spec.ts` (real backend, real MinIO, no interception):

1. chooses "Trước điều trị", uploads two PNGs, asserts both cards land in
   today's group with a count, that the `<img>` really decoded, that "Sau điều
   trị" hides them and "Xóa lọc" brings them back, then reloads
2. opens the viewer from the eye button, checks caption and "1 / N" counter,
   walks with "Ảnh sau" / "Ảnh trước", zooms, closes with Escape
3. drags the second card's grip onto the first, waits for `PUT /reorder`, and
   proves the order after a reload
4. deletes both through the confirmation dialog, sees the toast, reloads and
   finds neither
5. logs in as `branch2` and asserts `?clinicBranchId=<branch one>` → 403
