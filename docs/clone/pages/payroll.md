# Bảng lương — Nhân viên → Bảng lương (/staff/payroll)

**BlueDental-local.** The reference (app.nfcdental.com) has no payroll, so
nothing here is cloned. Sources: the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 5 (*"Theo dõi lương, phụ
cấp, hoa hồng của nhân viên"*) and item 6 (*"Chấm công … phục vụ cho việc tính
lương"*), plus the salary fields of item 1 (lương, phụ cấp). The choices below
were made on 2026-10-07 in place of an answer from the owner.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| Pay terms | "Lương cơ bản & phụ cấp" per staff member (VNĐ / month), kept apart from the staff profile (`StaffCompensation`) so the staff pickers used everywhere never carry a salary; read and edited only under the `payroll` ability. One set per person, whichever branch |
| The sheet | One per branch and month. Rows: the active staff assigned to the branch. Created from the screen ("Tạo bảng lương"), then a draft until "Chốt" |
| Ngày công (mục 6) | From chấm công at that branch in the month: each shift clocked in **and** out = ½ day; an abandoned shift or a no-show = 0. "Đăng ký nghỉ" counts as leave (½ or 1 day) and is shown, but not paid |
| Lương theo công | Lương cơ bản × ngày công / ngày công chuẩn, never more than the full salary. Ngày công chuẩn defaults to Mon–Sat of the month and can be changed per sheet ("Thông số") |
| Tăng ca | Minutes recorded on chấm công × (lương cơ bản / ngày công chuẩn / 8) × hệ số tăng ca (default 1,5, per sheet) |
| Hoa hồng | Each step of a công đoạn ticked done in the month pays the dentist of the công đoạn what the catalogue says for that step ("Giá trị": % of what the teeth it covers are charged after discounts, before VAT; or VNĐ per tooth, never more units than were sold). Warranty công đoạn pay nothing; steps flagged "Tính lương cho phòng MKT" are left out (marketing, not the dentist) |
| Phạt | The month's approved "Phạt tiền" under Chế tài at that branch; drafts and cancelled ones do not count |
| Hand-entered | Per row: ngày công điều chỉnh (overrides chấm công), Thưởng, Khấu trừ khác, Ghi chú. "Tính lại" refreshes everything else and keeps these |
| Thực lĩnh | Lương theo công + phụ cấp + tăng ca + hoa hồng + thưởng − phạt − khấu trừ khác |
| Chốt | Freezes the sheet (who and when are shown): no recalculation, edit or delete. A finalized sheet cannot be reopened |
| Export | Excel of the sheet ("Xuất Excel") |
| Who | Ability subject `payroll`: read (view sheets and pay terms), create, update (recalculate, terms, rows, pay terms), delete (a draft), approve (= chốt), export. Branch-scoped like every other screen |

## API

```
GET    /api/v1/app/payroll/periods?ClinicBranchId&Year
GET    /api/v1/app/payroll/periods/{id}
POST   /api/v1/app/payroll/periods                         { clinicBranchId?, year, month, standardWorkDays?, overtimeRate? }
POST   /api/v1/app/payroll/periods/{id}/recalculate
PUT    /api/v1/app/payroll/periods/{id}/terms              { standardWorkDays, overtimeRate }
PUT    /api/v1/app/payroll/periods/{id}/entries/{staffId}  { workDaysOverride?, bonus, otherDeduction, note? }
POST   /api/v1/app/payroll/periods/{id}/finalize
DELETE /api/v1/app/payroll/periods/{id}                    draft only
GET    /api/v1/app/payroll/periods/{id}/excel
GET    /api/v1/app/payroll/compensations?ClinicBranchId
PUT    /api/v1/app/payroll/compensations/{staffId}         { baseSalary, allowance }
```

Errors: `BlueDental:Payroll:0001` negative pay terms · `0002` bad month · `0003`
terms out of range · `0004` sheet already finalized · `0005` bad adjustment ·
`0006` the month already has a sheet.

## Security review (before push)

A user limited to one branch could set the pay of a clinic-wide account (one
with no branch assignment — head office, clinic managers), since the branch
check was skipped when the target had no branch. Fixed: such accounts' pay is
set only by a clinic-wide caller; covered by `payroll.spec` (403).

## Open — owner decisions

- Segregation of duties: the seeded "Quản lý chi nhánh" holds every `payroll`
  leaf, so a branch manager can set their own pay and bonus and chốt the month.
  Untick `payroll.update` / `payroll.approve` on that role, or ask for a
  "nobody edits their own row" rule.

- Whether leave days (nghỉ phép) are paid, and how many per year.
- Whether commission is earned on completion (current) or on payment collected.
- Marketing commission ("Tính lương cho phòng MKT" steps) — who receives it.
- Clinic-wide staff with no branch assignment are on no branch's sheet.
- The rest of item 1 (chức vụ, chứng chỉ hành nghề, loại hợp đồng) is not built.
