# F-81 phase 6 — Hủy phiếu thu, panel đã xuất / đã thanh toán (R-1052)

Source: BA P2610 (`P2610.drawio`), screens "Hủy phiếu thu" and "Đã xuất phiếu
thu"; BA answers 2026-10-27: "Ở step nào cũng có hủy hết", "Hủy thì mình update
status", "Ko cho mở lại". BlueDental only; the reference app has nothing like it.
Phase 5 (export) is in `receipt-export.md`.

## Behaviour

- "Hủy phiếu thu" sits in the receipt page head for `payment.delete`, at every
  step except once cancelled (`isCancellable`). It opens
  `/billing/receipts/:id/cancel`.
- The cancel page: "Phiếu thu gốc" (number, slip, payer, amount, status) on the
  left, "Lý do hủy" on the right — one of four fixed reasons plus Mô tả chi tiết,
  both required. It calls the existing
  `POST /api/v1/app/patient-payments/{id}/cancel { reasonCode, reason }`; the
  receipt becomes "Phiếu bị hủy" and cannot be reopened. The mock's Hóa đơn row is
  left out (no data yet).
- Signed, not yet exported: [Yêu cầu khách ký lại][Xuất phiếu thu] on one row,
  Hủy phiên & sửa phiếu below; no Gửi lại, no In phiếu thu.
- Exported (Đã xuất phiếu thu) and paid (Đã thanh toán) share
  `ReceiptExportedPanel`: ✓ + title + "Ghi nhận thanh toán lúc …", the facts
  Hình thức ký / Ký số đơn vị / Lưu trữ (+ Xác nhận thanh toán when paid), then
  In phiếu (the kept file, new tab) · Tải PDF (the kept file, named after the
  number with `/` → `-`) · Tạo phiếu mới (the slip's Thanh toán tab with
  "Tạo phiếu thanh toán" open once, via `?newPayment=1`, dropped from the URL).
  The column is only as tall as its content.
- Step bar: "Kế toán kiểm tra" carries the export time, same as "Xuất phiếu thu".
- While the receipt and the iPad state load, `ReceiptPageSkeleton` draws the
  page outline instead of a spinner.

## Tests

- `e2e/receipt-cancel.spec.ts` (real stack): cancel from the receipt page —
  missing reason / description blocked, after cancel the status is Phiếu bị hủy,
  no cancel button, same after reload; branch 2 is refused.
- `e2e/receipt-exported.spec.ts`: the exported column as the mock, step 5 = step
  6 time, In phiếu → `receipt-file` in a new tab, Tải PDF → `%PDF-` file,
  Tạo phiếu mới opens the dialog once.
- `e2e/receipt-page.spec.ts`: the Đã thanh toán column (4 facts, 3 buttons).

## Open

- A paid receipt can still be cancelled (BA: every step). Asked the BA whether
  to block it.
- The on-screen sheet header (clinic name, logo) reads live settings; the
  exported PDF is frozen.
- Ký số (phase 7) not done.
