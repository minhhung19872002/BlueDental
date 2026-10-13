# F-69 — Xuất / nhập danh sách bệnh nhân (/patient, admin)

BA request (Nha Khoa Đức Hạnh), owner answers 2026-10-12. BlueDental-local;
the reference has no such screen. The BA's own Excel holds real patient data
and stays outside the repo; every test row is synthetic.

Status: `VERIFIED` (2026-10-12, uncommitted). Re-verified 2026-10-13 after R-919 (A / E / D).

## What it does

- **Xuất danh sách**: one sheet with every patient of every branch. The
  Action column is left blank and carries an A / E / D drop-down (R-919).
- **Nhập danh sách**: the same sheet back. Rows are matched by Mã khách hàng
  within the row's branch.
  - `A` adds (Thêm mới).
  - `E` edits the patient Mã khách hàng names — only edits (R-919; it used to add as well).
  - `D` soft-deletes.
  - A blank Action skips the row.
  - Any other value is an error.
- **Codes**: a blank code on an `A` row gets the hồ sơ dialog's next `DH{yy}{seq:D4}`.
  A filled, unused code on an `A` row creates a patient with that code.
  `A` on a code a live patient holds (this or another branch) is an error
  (`PatientRoster:Err:CodeTaken`). `E` with a blank code (`EditNeedsCode`) or a code
  not in the system (`EditCodeNotFound`) is an error — nothing is imported.
- **Clearing**: on an edit, a blank cell clears the value.
- **All or nothing**: one wrong row refuses the whole file.
  - "Kiểm tra" is a full dry run.
  - The preview shows each marked row as Thêm mới / Cập nhật / Xoá / Lỗi.
  - "Tải file lỗi" returns the file with a "Lỗi" column added.
- **Access**: the buttons sit in the main toolbar of `/patient` and need
  `BlueDental.SystemAdmin.PatientRoster`. The server checks it too.

### Columns

- **Required:** Họ và tên, Số điện thoại, Chi nhánh (matched by name or code).
- **Optional:** Mã khách hàng, ID hệ thống (stored as `Patient.LegacyId`, migration
  `20261012075641_AddPatientLegacyId`), Giới tính, Ngày sinh, CCCD, Email, Ghi chú,
  Nghề nghiệp, Số thẻ BHYT, Địa chỉ, Tỉnh/TP, Phường/Xã, Địa chỉ cũ, Nguồn đến, Kênh,
  Ngày tạo hồ sơ, Lý do đến khám, Thẻ hồ sơ, Tiền sử bệnh, Người liên hệ khẩn cấp
  (+ SĐT), Người giám hộ (Họ tên / SĐT / CCCD / Quan hệ), Action.

### API

`api/v1/app/patient-roster`:

| Endpoint | Purpose |
|----------|---------|
| `GET export` | Downloads the roster file. |
| `POST import` | Multipart `file` + `dryRun`. |
| `POST import-errors` | The same file back, with a "Lỗi" column. |

## Owner decisions (2026-10-12)

1. Matching is by Mã khách hàng (the old-system ID is kept only as data).
2. A duplicate code within the file is an error.
3. A wrong branch, an unknown code on `D`, or an unknown Action is an error, and the owner fixes the file.
4. `D` = soft delete.
5. One wrong row means nothing is written.
6. Export = all patients of all branches.
7. Branches are created by hand before an import.
8. Admin only, in the patient toolbar. The modal follows the other imports.

## Owner decisions (2026-10-13, R-919 — BA asked for an A action)

1. `A` = add, `E` = edit only, `D` = delete. `E` on data that does not exist is an error and blocks the import (BA).
2. `A` on a Mã khách hàng that already exists is an error — it is not turned into an edit.
3. `A` with a filled, unused Mã khách hàng keeps that code; a blank one gets the next `DH` code.
4. The exported file gets an A / E / D drop-down on the Action column.

Taken during the build (not asked), to revisit if the owner disagrees:

- `D` is refused for a patient who has a booking, treatment slip, payment,
  invoice, prescription or labo order (`PatientRoster:Err:HasRecords`).
- Số điện thoại, CCCD and ID hệ thống are one live record per branch, the same as the hồ sơ dialog (`Patient:0021`, `Patient:0012`). A value another record holds, or one repeated in the file within a branch, is an error. It is free when the same file deletes the holder or moves it to another value (owner 2026-10-12, R-906).
- A code that belongs to a deleted record cannot be reused (`CodeDeleted`).
- A code that belongs to another branch cannot be moved by file (`CodeOtherBranch`).
- Tỉnh/TP and Phường/Xã must match the official list exactly. A ward without a province is an error.
- A bare birth year is not accepted.
- The permission is granted to the admin role only. The clinic and branch
  manager roles do not get it until the owner says so.
- The buttons are in the main toolbar only, not in the sticky one.

## Evidence R-919 (2026-10-13, production build `vite preview` :8111 → host :5000 → PostgreSQL, nothing intercepted)

| Spec | Result |
|------|--------|
| `e2e/patient-roster-api.spec.ts` | **10/10**: export also checks the A,E,D list validation on the Action column (AC2:AC1048576); `A` with no code adds with a DH code; new test — `A` on a taken code, `E` on an unknown code and `E` with a blank code are 3 errors with their messages, and a dry-run `A` with the unused code returns Create keeping that code; the rest as before with new rows marked `A` |
| `e2e/patient-roster.spec.ts` | **4/4**: the import dialog shows the A / E / D hint; `A` add → preview → import → reload finds it; `D` deletes it |

Regression level 3 (`DataMigrationPickLists.Restrict` went public; patient list): `patient.spec`, `patient-permission-gates`, `patient-national-id`, `data-migration-api` — 73/77. Reds not from this change: "Tiếp nhận steps" (TEMP-BUG25-OFF), "payment dialog … momo" (data-dependent, known), "Đặt mới … blocks" (flaky, green on rerun), data-migration "every Khách hàng column" (`catalogPicks` picks a left-over local occupation "Thợ 791507" that the import stores as free text — local data; R-919 only changed `Restrict`'s visibility).

## Evidence F-69 (production build `vite preview` :8093 → host :5000 → PostgreSQL, nothing intercepted)

| Spec | Result |
|------|--------|
| `e2e/patient-roster-api.spec.ts` | **9/9**: export headers + Action blank; the unchanged export imports nothing; `E` create (DH code, dry run writes nothing); `E` edit clears a blank cell; `X` + unknown branch refuse the file + error file; a phone/CCCD held by another record or repeated in the file is refused, and moving the holder off it in the same file frees it (R-906); `D` refused for a booked patient; `D` deletes, the deleted code cannot be edited, and the code estimate no longer offers it (R-905); a throw-away dentist gets 403 on export and import |
| `e2e/patient-roster.spec.ts` | **4/4**: export download; a wrong row blocks import and offers the error file; `E` add → preview → import → reload finds it; `D` deletes it |

Regression level 3 (patient list, hồ sơ create, permissions):

- Ran `patient.spec`, `patient-permission-gates` and `patient-scan-id`: 61/70 the first time.
- The hồ sơ create red was R-905, a pre-existing bug the roster spec's deleted patient exposed. After the fix, 7 of the 9 reds passed on rerun.
- 2 reds remain, neither from this change:
  - "Tiếp nhận steps": intentional, TEMP-BUG25-OFF.
  - "payment dialog … momo": the paid amount is clamped to what the chosen lines still owe (bug 24). With the current local data, typing 100000 and then 50000 changes the remaining amount by 10000, not 50000. The test depends on the data and does not touch the patient list.
