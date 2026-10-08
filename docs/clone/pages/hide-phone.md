# Ẩn số điện thoại — quyền `patient.hidePhone`

**BlueDental-local behaviour of a reference permission.** The reference's ability
list has `patient.hidePhone` ("Mask patient phone number", `permissions.md`), but
what it does on the reference was never observed —
UNKNOWN_REFERENCE_BEHAVIOR (it cannot be tried there without changing a role).
Until now the tick existed on Cài đặt → Phân quyền and did nothing. Cluster 11
item 9 asks for it to work; the choices below were made on 2026-10-07 in place
of an answer from the owner.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| What the tick means | Ticked = the role's members see patient phones **masked**. Like every grant, any one of the account's roles is enough |
| Mask | First three and last three characters, the rest `*`: `0901234567` → `090****567` (6 characters or fewer: only the last two) |
| Whose phones | The patient's and the patient's guardians'; the walk-in phone on a Lịch tạm card; the CSKH rows; the e-invoice draft; Zalo / message / call logs (including phones quoted inside a message's text, and a recipient name that is only a number); the "patientPhone" rows of appointment history. **Not** staff, branch, payment-account or supplier phones |
| Where | Every JSON response (a result filter on the API) and the Excel files that carry a phone (Bệnh nhân, CSKH). The FE prints read the same DTOs, so they print masked too |
| Who is never masked | The `admin` role. The seed used to grant every permission to the three static roles; it no longer grants this one, and migration `HidePhoneOffStaticRoles` took it back from `admin`, "Quản lý phòng khám" and "Quản lý chi nhánh". **Roles the clinic made itself keep whatever was ticked** — check them after deploying (see below) |
| Searching by phone | A masked account finds a record by its **whole** number only (patients, guardian lookup, CSKH, message / Zalo logs); part of a number matches nothing, so typing digit after digit cannot spell out the hidden ones. The duplicate check (`check-phone`) tells it the number is taken but not whose it is: the patient dialog says "Số điện thoại này đã được dùng cho một hồ sơ khác" (R-832; it used to read "đang được dùng cho 0 hồ sơ"). Everyone else searches as before |
| Editing a record shown masked | The edit dialogs send back what they showed. A masked value is read as "unchanged" only when it is the mask of a number the record knows — the patient's own, a guardian's own on file, a linked patient's, the Lịch tạm card's (via `sourceAppointmentId`), the invoice's patient. Anything else masked is refused (`BlueDental:Patient:0022` "Số điện thoại đang bị ẩn nên không lưu được. Nhập số điện thoại đầy đủ."). A full number typed in is saved as usual |
| Not masked on purpose | What is stored: an appointment's history snapshot is taken before the response is masked, so the log keeps the real number |

## Implementation

- `PatientPhoneMask` (Domain.Shared): `Mask`, `MaskEmbedded`, `Resolve`.
- `[PatientPhone]` on 13 DTO properties (`Embedded = true` on the Zalo message text);
  `AppointmentFieldChangeDto` implements `IPatientPhoneMaskable`.
- `PatientPhoneMasker` (Application, scoped): decides once per request (signed
  in, not admin, holds `patient.hidePhone`) and walks a DTO graph.
- `PatientPhoneMaskingFilter` (Host): masks every `ObjectResult`. The two
  Excel exports call the masker themselves.
- `HidePhoneCacheReset` (Host, start-up): drops the static roles' cached
  `hidePhone` grant, which the migration's SQL cannot reach (Redis).

## Before deploying to production

The tick did nothing until now, so a role may have it from a "chọn tất cả".
After the migration, list the roles that still hold it:

```sql
SELECT "ProviderKey" FROM "AbpPermissionGrants"
WHERE "Name" = 'BlueDental.patient.hidePhone' AND "ProviderName" = 'R';
```

Every member of those roles will see masked phones from the deploy on.
