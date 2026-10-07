# F-53 — Ẩn số điện thoại (cụm 11 mục 9)

Status: `VERIFIED` · Verified on: uncommitted work on top of `7395f11c` (2026-10-07)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/hide-phone.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/patient-hide-phone.spec.ts` **3/3**. Each
run creates its own role (granted `patient.read/update/export/hidePhone` through
the real permission-management API), a staff member in it, and an adult patient
with one guardian.

| Case | What is checked |
|------|-----------------|
| Masked read | Search by the full number finds the record and lists it masked; name + the first six digits finds nothing for the masked account (admin: the record); `check-phone` answers `exists` without owners (admin: the owner); detail masks patient and guardian phones; the downloaded Excel (parsed back) carries the mask and not the number; admin sees both numbers in full; unticking the leaf shows the masked account full numbers on its next request |
| Masked write | PUT of the record exactly as shown (masked phone + guardian rows) saves the name change and keeps both real numbers; a masked value that fits nothing → 403 `BlueDental:Patient:0022`; a new full number is saved |
| Screens | Bệnh nhân list row and profile show the mask and never the number; "Chỉnh sửa hồ sơ" opens with the masked value, Lưu → PUT 200, the stored numbers are unchanged |

## Backend

- Domain: `PatientPhoneMaskTests` **15** (mask shapes, free text, resolve rules).
- Application: `PatientPhoneMaskerTests` **5** (paged / nested / history rows,
  staff phones untouched, cycles).
- Domain.Tests 700, Application.Tests 676, HttpApi.Host.Tests 24 green.
- Migration `HidePhoneOffStaticRoles` (data only): 0 static-role grants left locally.

## Not covered by a runtime test

- Appointment, CSKH, e-invoice draft, Zalo/tool logs responses: masked by the
  same filter through `[PatientPhone]` (unit-tested on the DTOs), not walked in
  e2e with a masked account.
- Production: roles the clinic made that still hold the tick (query in the page doc).
