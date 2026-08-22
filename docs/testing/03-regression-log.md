# Regression Log

Defects found by running the real stack, and what stops them coming back.

## 2026-08-23 — first real acceptance run

| # | Defect | Impact | Root cause | Fix | Guarded by |
|---|--------|--------|------------|-----|------------|
| R-01 | Patient list crashed with `Cannot read properties of undefined (reading 'toLocaleString')` as soon as one patient existed | Screen unusable — it only "worked" while empty | The table bound the server DTO directly while expecting UI field names and a financial rollup the API never sends | `PatientDto` now mirrors the server; `adaptPatientListItem` produces the row shape | F-06 |
| R-02 | Create-patient form could never be submitted | No patient could be registered through the UI | One "Họ và tên" input was bound to `lastName` while the schema also required `firstName`; validation failed with no visible error | Single full-name field, split into họ/tên on submit | F-06 |
| R-03 | Create-patient request 400'd | Registration failed even after R-02 | FE sent `phone` instead of `phoneNumber`, an empty `dateOfBirth`, and no `branchId` | Request type mirrors `RegisterPatientDto`; date of birth is required | F-06 |
| R-04 | Duplicate `PatientCode` — 500 on the second registration of the day | Registration failed intermittently, looked random | Code used six characters of a **sequential** GUID; those are high-order timestamp bits and barely change | Per-branch, per-year sequence with a uniqueness walk | F-06 (spec creates a new patient every run) |
| R-05 | Enter inside the patient dialog submitted the form twice | Duplicate registration attempt; the save button hung in a loading state | Enter commits a typed value in antd's DatePicker and also submits the surrounding form | The form ignores Enter from inputs; submitting stays on the Lưu button | F-06 |
| R-06 | Newly created catalog group was not selected, so the next entry landed in the wrong group | Silent mis-filing of catalog data | The "fall back to all groups" effect ran while the group refetch was still in flight and cleared the fresh selection | Select the created group, and only fall back once the list has settled | F-02 |
| R-07 | Finance tables showed "—" for category and staff | Data existed but was invisible | `SalesEntryDto` / `CashflowEntryDto` never hydrated `categoryName` / staff name | Both app services resolve the names | F-04, F-05 |
| R-08 | Two `[Authorize]` attributes on one method | Reflection-based contract tests threw `AmbiguousMatchException`; endpoints were double-gated against a legacy permission the admin may not hold | Ability attributes were added on top of the older hand-rolled ones | Consolidated on the ability model | `BlueDental.Application.Tests` |
| R-09 | Stale ReceptionPage tests | Suite was red, so it stopped being run | Assertions still expected "Khách đến" and a dialog title that had changed | Updated to the current UI wording | `BlueDental.FE` Vitest |

## Notes

- R-01 through R-05 were all in one feature and all invisible to the existing
  unit/mocked tests — they only appeared once a browser talked to a real API and
  a real database. That is the reason `00-test-policy.md` refuses to count
  mocked tests as acceptance.
- R-04 only reproduces on the *second* write in a period. Specs that create data
  every run are what catch this class of defect; a fixture that reuses one record
  would not.
