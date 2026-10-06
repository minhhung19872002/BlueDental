# Chế tài nhân viên — /staff/penalties

**BlueDental-local.** The reference (app.nfcdental.com) has no staff-penalty
screen, so nothing here is cloned. The source is the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 4: *"Quản lý các chế tài xử
phạt nhân viên."* The design choices below were made on 2026-10-06 in place of
an answer from the owner, and are the ones to revisit if the owner decides
otherwise.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| What a record holds | Nhân viên, chi nhánh, ngày vi phạm, loại vi phạm, hình thức xử lý, số tiền phạt, nội dung, người lập |
| Workflow | Nháp → Đã duyệt / Đã huỷ. A draft is edited and deleted freely; an approved record is locked and can only be cancelled, with a reason; a cancelled one is final |
| Hình thức xử lý | Nhắc nhở · Cảnh cáo · Phạt tiền · Khác. Only Phạt tiền carries an amount (> 0); every other action is saved with 0 |
| Loại vi phạm | A per-branch list with a default fine. Picking a type pre-fills the fine and switches the action to Phạt tiền; the record keeps its own copy, so changing the type never rewrites a penalty already given. A deleted type (soft delete) still names its records |
| Where | A second tab beside the staff list: `/staff` (Danh sách nhân viên) · `/staff/penalties` (Chế tài) |
| Who | New ability subject `staffPenalty`: read · create · update · delete · approve. Huỷ also needs **approve**, since cancelling an approved record undoes an approval |
| Payroll | The list returns `approvedFineTotal` — Σ of the approved fines matching the filter — the figure Bảng lương (cluster 11 item 5) will deduct |

## API

```
GET    /api/v1/app/staff-penalties?ClinicBranchId&StaffId&Status&FromDate&ToDate&Filter&SkipCount&MaxResultCount
         → { totalCount, items[], approvedFineTotal }
GET    /api/v1/app/staff-penalties/{id}
POST   /api/v1/app/staff-penalties                 { clinicBranchId?, staffId, violationTypeId?, violationDate, action, fineAmount, description? }
PUT    /api/v1/app/staff-penalties/{id}            (same body, no branch)
DELETE /api/v1/app/staff-penalties/{id}            draft only
POST   /api/v1/app/staff-penalties/{id}/approve
POST   /api/v1/app/staff-penalties/{id}/cancel     { reason }

GET    /api/v1/app/staff-violation-types?ClinicBranchId&Filter
POST   /api/v1/app/staff-violation-types           { clinicBranchId?, name, defaultFineAmount }
PUT    /api/v1/app/staff-violation-types/{id}
DELETE /api/v1/app/staff-violation-types/{id}      soft delete
```

`violationDate` is a `DateOnly` (`YYYY-MM-DD`); "today" is the clinic's
(UTC+7). `Filter` matches the staff member's name or user name, or the description.

Errors `BlueDental:StaffPenalty:0001`–`0007`: not a draft · already cancelled ·
fine needs an amount · date after today · staff not at the branch · violation
type not the branch's · negative amount.

## Server-side checks

- Branch scope through `BranchAccessChecker` (read, write target, every record).
- The staff member must have a `StaffBranchAssignment` at the record's branch.
- The violation type must belong to the record's branch.
- Workflow and amount rules live on `StaffPenalty` (Domain), not in the service.

## Known limits

- The Nhân viên picker reads `/api/v1/app/staff`, which needs the `staff`
  read right. An account holding only `staffPenalty` sees the tab but an empty
  picker.
- The Nhân sự menu entry still follows `staff`; an account with only
  `staffPenalty` reaches the tab by its URL.
- No export yet, and the record has no attachment.

## Files

BE: `Domain/Staff/StaffPenalty.cs`, `StaffViolationType.cs`,
`Application/Staff/StaffPenaltyAppService.cs`, `StaffViolationTypeAppService.cs`,
`HttpApi/Staff/StaffPenaltyControllers.cs`, migration `StaffPenalties`.
FE: `features/staff/pages/StaffPenaltyPage.tsx`, `features/staff/components/penalty/*`,
`features/staff/hooks/usePenalty*.ts`, `features/staff/api/staffPenaltyApi.ts`.
Tests: `Domain.Tests/Staff/StaffPenaltyTests.cs`,
`Application.Tests/Staff/StaffPenaltyAppServiceContractTests.cs`,
`e2e/staff-penalty-api.spec.ts`, `e2e/staff-penalty.spec.ts`.
