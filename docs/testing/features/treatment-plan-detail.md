# F-39 — Chi tiết kế hoạch điều trị

Status: `DIRTY` (2026-09-07 tối: inline new row + group table in the picker, not retested; last `VERIFIED` run below) · Verified commit: uncommitted working tree of 2026-09-07 (the
owner asked for no commit) · Retest level used: **2** (one feature) plus the
F-21 spec because its links now navigate.

## Scope

`/patient/:patientId/treatment-plan/:planId?planTab=detail|payment-v2|refund|debt`
— the page behind the slip code link, the summary-card items and the ≤640 card
head on the Kế hoạch điều trị tab. Four tabs, five head figures, the
"Tạo phiếu thanh toán", "Chi tiết phiếu" and "Hoàn tiền" dialogs, the status
menu on a service line, the print of a receipt. Frontend only — the API surface
below already existed. One backend guard was relaxed on the owner's screenshot
(2026-09-07, afternoon): `PatientPayment.Record` requires a `paymentAccountId`
for bank / e-wallet money **coming in** only; a refund names just the channel
(`Tiền mặt` / `Chuyển khoản` / `Quẹt thẻ`), like production's dialog.

Reference notes: `docs/clone/pages/treatment-plan-detail.md`.

## API surface (unchanged, all existing)

```
GET  /api/v1/app/patient-treatments/{id}                       the slip + services[] + payment{}
GET  /api/v1/app/patient-payments?patientId&clinicBranchId&treatmentPlanId&kind
POST /api/v1/app/patient-payments                              kind 1 = Payment, 2 = Refund
GET  /api/v1/app/patient-payments/account?patientId&clinicBranchId
GET  /api/v1/app/patient-advises?patientId&clinicBranchId       Chẩn đoán / Ghi chú columns
POST /api/v1/app/patient-treatments/{id}/services/{serviceId}/complete | convert | cancel
```

## Files

```
src/features/treatment-management/pages/TreatmentPlanDetailPage.tsx
src/features/treatment-management/components/plan-detail/
  PlanDetailHeader.tsx  PlanDetailHead.tsx  plan-detail.css
  PlanServicesTab.tsx   PlanServicesToolbar.tsx  serviceColumns.tsx  ServiceCardList.tsx
  ServiceStatusPill.tsx ServiceDetailDialog.tsx  CancelServiceDialog.tsx
  PlanPaymentsTab.tsx   PlanRefundsTab.tsx  paymentColumns.tsx  PaymentCardList.tsx
  PaymentReceiptDialog.tsx  receiptView.ts  ReceiptSheet.tsx  ReceiptParts.tsx  printSheet.ts
  PlanSlipDialog.tsx  PlanSlipSheet.tsx  slipView.ts
  RefundDialog.tsx  RefundLinesTable.tsx  useRefundForm.ts
  PlanDebtTab.tsx   planDetailTypes.ts
src/utils/moneyWords.ts                        "Số tiền bằng chữ"
src/features/patient-management/components/patient-detail/CreatePaymentDialog.tsx  (now imports its stylesheet)
e2e/treatment-plan-detail.spec.ts
```

## Real-stack evidence — `e2e/treatment-plan-detail.spec.ts` (6, serial)

Run on the production build (`vite preview --strictPort`, port 8093 in this
session because 8080 belonged to another checkout), against the real API on
:5000 and the real PostgreSQL. No `page.route`, no injected tokens; every test
asserts real `/api/` traffic.

| # | Test | What it proves |
|---|------|----------------|
| 1 | the slip code opens the detail page | login → patient → tab → create a slip with a service and teeth through the real form → the DT code link navigates; breadcrumb ends in the code, four tabs, five stats, 15-column table with the "Hiển thị 1–1 trên 1 dịch vụ" pager; the printer icon opens the slip's "Chi tiết phiếu" (four headings, the clinic's name, `Mã KH`, one line, `Tổng phí` / `Đã trả trước đó` / `Tổng còn nợ`, `In Phiếu`) with the hidden "Phiếu điều trị" sheet inside, and no download event fires |
| 2 | Thanh toán collects money | `Tạo Phiếu Thanh Toán` → shared dialog pre-ticked → Lưu → `POST patient-payments` → row with `Hoàn tất`, `Đã thanh toán` figure moves → eye opens "Chi tiết phiếu" with the code, one service row and "Tổng thanh toán dịch vụ" → `In hóa đơn tổng` shows `Tổng hợp` and `Doanh thu dự kiến`; the off-screen `BIÊN LAI THU TIỀN` sheet is in the dialog, hidden, with the letterhead, `Số tiền bằng chữ` spelled out (`… đồng`) and both signature blocks |
| 3 | Hoàn tiền files a refund | `Hoàn Tiền` → dialog: `Hình thức` lists exactly Tiền mặt / Chuyển khoản / Quẹt thẻ, picking Chuyển khoản shows no account field; the line shows the gross paid amount → type an amount → `Tổng tiền trả` follows → Lưu → `POST patient-payments` kind 2 by bank with no account → refund row, `Đã hoàn` figure moves, `Đã thanh toán` drops |
| 4 | reload + Dư nợ + status menu | reload keeps `planTab`; Dư nợ answers (empty state); status pill menu → Hoàn thành → pill changes, survives a reload |
| 5 | ≤640 folds into cards | 640×900: no `.pdt-table`, one `RecordCard` per line with the index on the head, shared pager text, five stats in a row; payment and refund cards carry their codes |
| 6 | another branch is refused | the branch-2 account gets an error state, not the slip |

Result 2026-09-07: **6 passed** (44s), twice after the parity pass; **6 passed**
again (53s) after the refund-channel change, on the API rebuilt with the
relaxed guard. `PatientPaymentTests` 13/13 (one new: a bank refund stores no
account). **6 passed** (42s) after the printed sheet and the dialog stylesheet
(R-246, R-247); print previews captured with `emulateMedia({ media: "print" })`
for the aggregate and a single receipt. **6 passed** (43s) after the printer
icon's dialog and sheet (R-248, R-249); one earlier run of that batch failed
test 2 once and passed on the two reruns — the payment flow's timing, not the
dialog. The slip helper now finds the new code instead of counting rows, since
the test patient's plan list outgrew page one.

Type-check and lint: clean (`tsc --noEmit -p tsconfig.app.json`, `oxlint src`).

## Visual parity

Reference captures vs local screenshots (`shots.cjs`) at 1440 / 640 for every
tab and dialog. Matched after the pass: tab pills, toolbar sides, table columns
and weights, "Chi tiết phiếu" sections and totals, refund dialog layout, card
heads, head figures in one row at 640. Accepted deviations are listed in the
page notes.

## Known limitations (FE-only round)

- A refund on a line that is **fully paid** is refused by the API
  (`Manual` items must each be ≤ outstanding). The dialog shows the line and
  the guard message comes back from the server.
- `Hoàn tiền dư nợ` posts a Refund without `treatmentPlanId`; the reference's
  contract for that case was not observed.
- `Chuyển đổi` stops at a toast — see unknowns.
- `Thêm dịch vụ mới` (2026-09-07 tối) appends the inline new row (status pill
  of seven, Chẩn đoán / Bác sĩ / răng / Số lượng / Đơn giá / Ghi chú / BS chẩn
  đoán 1–2 / Tư vấn 1–2, Lưu ✓ / Hủy ✗); group mode opens the group's service
  table inside the popover. Lưu calls the new `POST patient-treatments/{id}/services`
  (BE: `TreatmentService` gained nullable DiagnosisId / DentistId / Note /
  Diagnoser / Consultant columns, migration `20260907090000_AddTreatmentServiceDetails`).
  The running API host must be restarted and the migrator run before Lưu
  works; **not retested** — status `DIRTY` until the spec covers it. No unit
  tests by the owner's instruction. ≤640 cards do not show the draft row.
