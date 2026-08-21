# BlueDental Reference — Unknown Reference Behaviors Log

> Reference System: https://app.nfcdental.com  
> Inspection Date: 2026-08-21  
> Highest Priority Rule: `.claude/rules/00-reference-readonly.md` — The production reference application is STRICTLY READ ONLY.  
> Guideline: For any control requiring an unsafe interaction, record it as `UNKNOWN_REFERENCE_BEHAVIOR` instead.

---

## 1. Safety Log Policy

When safety and clone accuracy conflict, safety MUST be chosen. Any control, button, form, or action on `https://app.nfcdental.com` that could potentially create, modify, or delete production data, trigger backend side effects, or submit business forms is strictly left unclicked and logged below as `UNKNOWN_REFERENCE_BEHAVIOR`.

---

## 2. Unknown Behaviors Log

### UNKNOWN_REFERENCE_BEHAVIOR #1
- **Page**: `/signin`
- **Control**: Sign In Form Submit Button (`Đăng Nhập`) (`type="submit"`)
- **Reason**: Submitting credentials against production authentication API (`/api/auth/login`) executes backend authentication logic and mutates session state.
- **Action Taken**: NONE.
- **Local Implementation Strategy**: Implement standard JWT/Cookie auth flow in local ASP.NET Core backend with local test seed accounts (`admin@bluedental.com`, `doctor@bluedental.com`, `receptionist@bluedental.com`).

### UNKNOWN_REFERENCE_BEHAVIOR #2
- **Page**: `/reception`
- **Control**: `Tạo tiếp nhận` Primary Action Button (`overview.action.newProfile`)
- **Reason**: Submitting the form inside the "Tạo tiếp nhận" modal/drawer creates a new patient reception entry in the production PostgreSQL database (`POST /v1/receptions`).
- **Action Taken**: NONE.
- **Local Implementation Strategy**: Inspect modal form field specifications from JS chunk strings (`patientName`, `phoneNumber`, `dateOfBirth`, `doctor`, `receptionNote`, `refType`), and implement local drawer form using React Hook Form + Zod schema validation.

### UNKNOWN_REFERENCE_BEHAVIOR #3
- **Page**: `/reception`
- **Control**: Queue Row Action `Tiếp nhận` (`appointmentSchedule.action.reception`)
- **Reason**: Executing the `Tiếp nhận` action transitions appointment/queue status from `Khách đến` to `Đang khám`, issuing state change requests (`PUT /v1/receptions/{id}/status`) to production backend.
- **Action Taken**: NONE.
- **Local Implementation Strategy**: Implement state machine transition logic in local ABP Aggregate Root (`Appointment` / `Reception` entity) following the documented state workflow: `Scheduled -> Confirmed -> CheckedIn (Khách đến) -> InProgress (Đang khám) -> Completed (Hoàn thành)`.

### UNKNOWN_REFERENCE_BEHAVIOR #4
- **Page**: `/reception`
- **Control**: Queue Row Action `Xoá ghi chú` (`note.action.remove`) & `Sửa ghi chú` (`note.action.edit`)
- **Reason**: Deleting or updating reception notes mutates persistent production database records.
- **Action Taken**: NONE.
- **Local Implementation Strategy**: Implement note CRUD endpoints in local AppService with full audit logging.

### UNKNOWN_REFERENCE_BEHAVIOR #5
- **Page**: Header Chrome
- **Control**: Branch Switcher Select (`placeHolder.label.branch`)
- **Reason**: Changing active clinic branch context may set session cookies or update server-side user context.
- **Action Taken**: NONE.
- **Local Implementation Strategy**: Implement local Organization Unit pattern (`ClinicBranchId` header / user context claim) to switch active branch context locally.
