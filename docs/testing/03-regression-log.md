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
| R-12 | Not one business error code was localized | Every BusinessException in the app reached the user as "Có một lỗi nội bộ xảy ra" | ABP looks the code up in a localization resource; the resource had none of them | All 112 codes carry an English and a Vietnamese message | Every spec that asserts a refusal |
| R-13 | Patient search never worked | Typing a name filtered nothing | The browser sent "keyword" while the server reads "filter", and the server matched the name halves separately so a typed full name never hit | Request mirrors the contract; the server also matches the concatenation and the phone | F-06, and every spec that finds a patient |
| R-14 | The patient list came back in arbitrary order | A record just created could land on any page | No ordering was applied | Newest first | F-06, F-21 |
| R-15 | The whole appointment feature spoke a contract the server never had | Nothing it sent could be stored | doctorId / startTime / lowercase status against DentistId / SlotStart / numeric enum | The translation lives in the api layer | F-10 |
| R-16 | The appointment list ignored its own date filter | Each calendar grid was fed every appointment the clinic has ever had | The filter existed in the DTO and was never applied | Date and a from/to range are honoured | F-10 |
| R-17 | Every booking 500'd | No appointment could be created from the UI | The browser sent local wall-clock time and Npgsql refuses a +07:00 offset | Times are converted to a UTC instant | F-10 |
| R-18 | The reception board fell back to a local store | The screen looked like it worked while nothing was persisted | A try/catch around every call swallowed the failure | Every call goes to the real API | F-11 |
| R-19 | The staff screen rendered a hard-coded list | Its Create / Edit / Delete buttons did nothing | The server only had GetList and Get | Full CRUD over identity accounts | F-25 |
| R-20 | The image URL was prefixed twice | Uploaded images never rendered | The server returns an app-relative path and the component prefixed the API root again | The path is used as-is | F-24 |
| R-10 | Every treatment-stage request 500'd | The whole công đoạn panel was dead on arrival | The entity was mapped in `ModelCreatingExtensions` but had no `DbSet` on the DbContext, so ABP registered no default repository and the app service could not be activated | Added `DbSet<TreatmentStage>` | F-19 |
| R-11 | An accepted service line could never be produced through the UI | Công đoạn was unreachable: only accepted advises become service lines, and nothing accepted them | The advise table had no action column, though `useAcceptAdvise` already existed | Added the "Chấp nhận" action | F-09, F-19 |
| R-09 | Stale ReceptionPage tests | Suite was red, so it stopped being run | Assertions still expected "Khách đến" and a dialog title that had changed | Updated to the current UI wording | `BlueDental.FE` Vitest |

## Notes

- R-01 through R-05 were all in one feature and all invisible to the existing
  unit/mocked tests — they only appeared once a browser talked to a real API and
  a real database. That is the reason `00-test-policy.md` refuses to count
  mocked tests as acceptance.
- R-12 through R-20 all came out of wiring group A and B. Every one of them was
  invisible to the type checker and to the unit tests: the code compiled, the
  migrations applied, and the screens rendered. Only a browser talking to a real
  API and a real database showed that nothing was being stored.
- R-10 is the same lesson as R-01: the code compiled, the migration applied, and
  the unit tests passed. Only a browser hitting the real DI container found it.
- R-04 only reproduces on the *second* write in a period. Specs that create data
  every run are what catch this class of defect; a fixture that reuses one record
  would not.

## 2026-08-24 — merging origin/main into the design branch

Three defects that only a running browser would have shown. None were type
errors, so neither branch's typecheck had caught them.

| What broke | Why | Fix |
|---|---|---|
| Every screen answered 403 | The merged services authorise against the ability catalogue, but the merge kept only main's permission definition provider, which does not declare it. ABP refuses a permission that was never defined, so no grant could help. | Registered the ability catalogue alongside main's permissions again, and made the seeder grant whatever the definitions declare rather than naming one catalogue. |
| Every screen then answered `BlueDental:Organizations:0005` | main's resolver takes the clinic from a `ClinicBranchId` claim, which the claims contributor reads off the user's extra properties. The `admin` account had none. | The seeder now sets that property (and the assignment row) for admin, the demo dentists and the branch-two account. |
| Labo crashed on render | `LABO_STATUS_CONFIG` was keyed by a string union (`"New"`, `"Warranty"`) the server never sends — `LaboStatus` is a numeric enum. `CONFIG[1]` was undefined and reading `.color` threw. Pre-existing on main. | Keyed the config by the server's enum and pointed the filter chips at Sent / InProgress / Received. |

Caught by `e2e/screen-sweep.mjs`, which walks every route and fails on an
application console error or an empty page.
