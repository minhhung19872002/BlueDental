# F-83 — Thanh toán nhiều đợt (P2910, R-1080)

Source: BA `P2910.drawio`, which redesigns the "Tạo phiếu thanh toán" dialog.
Owner answers 2026-10-29: 11 plan questions, then VAT per đợt, the voucher base
(Còn nợ), TN giảm as real relief, and editing only Chưa TT receipts.
BlueDental only; the reference app has nothing like it. Branch: develop.

## Behaviour

### Đợt and service cards

- A đợt is any non-cancelled receipt that carries the line (Chưa TT, Đã xuất or
  Đã TT). Each card lists its đợt with their status
  (`PaymentRoundHistory`).
- "Đã thanh toán" and "Ưu đãi các đợt trước" add up **Đã TT** receipts only;
  the `ISettleable` filter keeps pending receipts out. A new receipt can still be
  made while an earlier one is unpaid.
- Tags:
  - đợt 1 ("Thanh toán 1 lần") has no tag; tags start at đợt 2;
  - "BS giảm" shows when the slip line has a doctor discount.
- On a ticked card, "Đang chỉnh phiếu đợt N" (`PaymentLineTermsForm`) holds:
  - **Tên trên phiếu**: print only, never changes the slip. From đợt 2 it is
    prefilled with "Tên DV – Đợt N".
  - **TN giảm**: in đ or %. The % is taken on the line's pre-VAT Còn nợ.
  - **Lý do**: optional.
- Áp dụng saves the edit to the draft and collapses the card; Khôi phục puts the
  card back as it was. The collapse link is on ticked cards only. Tick-all
  leaves the cards collapsed.
- Save is blocked while a card has an edit that hasn't been applied.

### Money rule: VAT and relief

- Relief (TN giảm + voucher) is taken **before** VAT. In the formulas below:
  - G = price after BS giảm, before VAT;
  - R = relief already in force;
  - r = the line's VAT rate.
- Formulas:
  - line VAT = round((G − R) × r);
  - Còn nợ = (G − R) + VAT − cash.
- The cashier still types the cash **including** VAT. Each receipt line stores
  the VAT backed out of that cash (`PatientPaymentLine.TaxAmount`). The đợt that
  clears the line takes "VAT after relief − VAT of earlier đợt", so rounding
  lands there.
- Old receipts (TaxAmount null) still back VAT out of the amount, as before.
- Example, 10.000.000 at 10%:
  - đợt 1 pays 5.500.000 (VAT 500.000);
  - đợt 2 has TN 1.000.000 and collects 4.400.000 (VAT 400.000);
  - total VAT 900.000.
- Domain code:
  - `PaymentRound` (Billing) works out each line's ceiling, voucher share and
    VAT for one đợt;
  - `LineSettlement` (Cash, Relief, Tax) is what Đã TT receipts did to a line;
  - `TreatmentPlan.PreTaxOutstandingOf` and the relief incl. VAT drop,
    R + round(G r) − round((G − R) r), sit beside `TaxAmountOf`.
- Plan prices and `TaxAmountOf` / `PayableAmountOf` are unchanged. Rollups
  subtract the relief:
  - `PaymentSummary`, `PatientMoneyCalculator`, Còn nợ in Hồ sơ;
  - the advise rows' `PaymentReliefAmount`, which feeds TỔNG KẾ HOẠCH;
  - DTO `PreTaxOutstandingAmount`.

### Voucher at payment time

- `PaymentVoucherPicker` sits under "Thông tin thanh toán". It is searchable,
  because 50+ vouchers in a virtual list can't be picked otherwise.
- Only vouchers that would take something off are offered.
- It is hidden without Khuyến mãi → Xem. A reopened receipt keeps the voucher
  it holds.
- The voucher's base is the pre-VAT Còn nợ of the chosen lines, after earlier
  đợt and after this đợt's TN, even when the customer pays only part.
- Split:
  - even across the lines the voucher reaches; a Theo dịch vụ voucher reaches
    only its target lines;
  - the odd đồng goes on the last line;
  - what a line has no room for moves to the others.
- Rules are the same as a slip voucher: branch, scope, exclusive, dates, minimum
  order, maximum discount, per-customer limit. The per-customer limit counts
  slip uses and receipt uses together.
- Exclusive vouchers are hidden in the FE and refused by the server.
- The voucher's use is held when the receipt is made. It is released on cancel,
  or when the voucher is removed in an edit.
- Revising a receipt with the same voucher skips the date and limit recheck.
- The slip's doctor voucher shows only on đợt 1.

### Totals and receipt

- `PaymentSelectedTotals` keeps the BA's 10 rows:
  1. Tổng tiền
  2. Giảm giá bác sĩ
  3. Giảm giá thu ngân
  4. Voucher
  5. Tổng tiền sau giảm
  6. Thuế VAT
  7. Tổng thanh toán
  8. Đã thanh toán
  9. Ưu đãi các đợt trước
  10. Còn nợ cần thanh toán
- `PaymentCollectBox` follows with "Thu đợt này (trong đó VAT x)" and "Còn nợ
  sau đợt này".
- "Khách sẽ thấy trên phiếu" (`PaymentCustomerPreview`) shows the names and
  amounts that will print.
- A 0 đ receipt is allowed when TN + voucher clear the debt. A line settled by
  relief alone is locked in later đợt.
- Receipt content (`PaymentReceiptSnapshot`) gains:
  - per line: TN, voucher share, VAT;
  - per receipt: voucher code, relief before, relief.
- Where it shows:
  - receipt page, iPad `/sign` and the PDF show the lines (`ReceiptLines`);
  - Còn lại follows the rule above;
  - the TN reason is shown to the accountant only, at step 6
    (`ReceiptCashierDiscounts`), and never on the customer's copy.
- TỔNG KẾ HOẠCH gets "Ưu đãi khi thanh toán", shown only when it is above 0.
- Reports (`ClinicReportAppService`) count TN + voucher under Giảm giá, not as
  revenue.
- E-invoices use the stored line VAT.
- Refunds give back cash only, never relief.
- Editing: only Chưa TT receipts. Đã xuất has a sealed PDF and a signature, so it
  must be cancelled and made again.

### API

- `POST`/`PUT /api/v1/app/patient-payments` take:
  - `lineTerms[] { treatmentServiceId, receiptName, cashierDiscount, cashierDiscountReason }`;
  - `voucherId`.
- Lines return `receiptName`, `cashierDiscount`, `cashierDiscountReason`,
  `voucherShare`, `taxAmount`. The receipt returns `voucherId`, `voucherCode`,
  `voucherAmount`, `cashierDiscountTotal`.
- `Billing:0116` is returned when TN + voucher exceed what a line owes.
- Migration `20261029094513_PaymentRounds`:
  - `bd_patient_payments`: VoucherId (indexed), VoucherCode(64),
    VoucherAmount, CashierDiscountTotal;
  - lines: ReceiptName(200), CashierDiscount, CashierDiscountReason(500),
    VoucherShare, TaxAmount (nullable).

## Tests

- `e2e/payment-rounds.spec.ts` (real stack, 2 tests). Setup: S1 10.000.000 at
  VAT 10% and S2 2.000.000 with no VAT and BS giảm 200.000.
  - Test 1:
    - đợt 1 collects 5.500.000 (VAT 500.000);
    - đợt 2: tag, history with status, terms form, TN 1.000.000;
    - a 500.000 voucher split 250k/250k;
    - the 10 rows; Thu đợt này with VAT 375.000 (= 875.000 − 500.000);
    - preview;
    - the receipt read back via API (VAT, voucher, reason) and on the receipt
      page (reason at step 6);
    - Chẩn đoán & Tư vấn, both lines ticked: TỔNG KẾ HOẠCH "Ưu đãi khi thanh
      toán" 1.625.000 (1.500.000 relief + 125.000 VAT drop).
  - Test 2: a 0 đ receipt cleared by TN + voucher holds the voucher's use, and
    cancelling releases it.
- `Domain.Tests/Billing/PaymentRoundTests` (13): the BA VAT example, rounding
  onto the clearing đợt, untaxed lines, the voucher base and split, overflow,
  service-scoped vouchers, held uses and the customer limit, branch and
  exclusive refusals, TN ceiling, 0 đ receipt, only paid receipts settle.
- Updated: `PatientPaymentTests`, `PatientListRollupTests`,
  `SlipSeenThroughLinesTests`. Domain.Tests total 1196/1196.
- `e2e/payment-amount-select.spec.ts` had been broken since `a6b73c80` (it
  imported the removed `answerYes`). It is now on the shared `saveReceipt`
  fixture.

## Open

- Deleting a slip does not release vouchers held by its receipts.
- If receipts are confirmed out of the order they were made, a line's VAT can
  drift by ±1 đ.
- The PHIẾU THU docx has no per-line relief note. TN and voucher show only as
  totals.
- `OperationsReport` doctor sales are not reduced by TN or voucher (owner to
  decide).
- TỔNG KẾ HOẠCH relief includes the VAT drop, while Thành tiền is pre-VAT. The
  printed quote sheets don't show the relief.
- Promotions.View is not in any role seed, so the picker is hidden for roles
  without it until someone grants it.
- API checks ran as real-stack e2e on an isolated DB, not as a Testcontainers
  Application.Tests suite.
