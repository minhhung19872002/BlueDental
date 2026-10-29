# F-81 phase 5 — Kế toán kiểm tra & xuất phiếu thu (R-1049)

> **Superseded in part by P2910_02 (F-84, R-1081, see `receipt-paper-sign.md`).**
>
> Hình thức ký số is now a radio with three choices:
>
> - Ký điện tử (3): the default; uses the accountant's saved signature;
> - Token điện tử (2): formerly "Ký số", still refused with `0113`;
> - Ký tay trực tiếp (1): formerly "Không ký số".
>
> A receipt printed for paper exports without an iPad drawing. Where the text
> below says "Ký số / Không ký số", read the new names.

Source: BA P2610 (`P2610.drawio`), step "Kế toán kiểm tra & xuất". BlueDental only;
the reference app has nothing like it. Phase 4 (iPad signing) is in
`receipt-ipad-signing.md`.

## Behaviour

- The receipt page shows the panel once the receipt is "Chưa thanh toán" and the
  customer has signed in the open iPad session.
- Hình thức ký: Ký số (disabled until phase 7) / Không ký số. Nothing is picked;
  the button is disabled with "Chọn hình thức ký trước khi xuất." until one is.
  The button reads "Ký số và xuất phiếu thu" or "Xuất phiếu thu" after the choice.
- `POST /api/v1/app/patient-payments/{id}/export { signMode }` (Payment.Update,
  branch-scoped):
  - not signed in an open session → 403 `Billing:0112`;
  - `signMode: 2` (Ký số) → 403 `Billing:0113`;
  - not "Chưa thanh toán" → 403 `Billing:0096`;
  - otherwise: the F-56 PHIẾU THU `.docx` filled from the frozen content, the
    signature inline above the payer name (≤ 50 × 18 mm), converted by
    Gotenberg to PDF/A-2b, SHA-256 taken, sealed (AES-256-GCM, `ReceiptVault:Key`,
    version byte 0x01) to MinIO `receipts/{branch}/{id}.pdf.enc`; the receipt
    becomes "Đã xuất phiếu thu" (`signMode`, `hasFile` on the receipt read) and
    the iPad session closes as Issued.
- `GET /api/v1/app/patient-payments/{id}/receipt-file` returns the stored PDF,
  re-checking the SHA-256 (missing → `0114`, changed or undecryptable → `0115`).
  The export opens it in a new tab; "In phiếu thu" prints it from then on.
- The interim `POST {id}/issue` is gone.

## Tests

`e2e/receipt-export.spec.ts` (real stack, serial):

1. Unsigned export → `0112`; `receipt-file` → `0114`; still Pending. Pair a
   helper iPad, check + sign through the station API; Ký số → `0113`, still
   Pending; Không ký số → 200 Issued. Separate read: `signMode` 1, `hasFile`,
   session closed. `receipt-file` is a PDF with `pdfaid:part`, byte-identical on
   a second read. A second export → `0096`.
2. Branch 2 can neither export nor read the file (4xx, no PDF bytes); branch 1
   still reads it.

`e2e/receipt-ipad.spec.ts` test 2 now exports through the panel: disabled button
and hint, Ký số disabled, pick Không ký số, click → `receipt-file` answers a PDF
and a tab opens; the iPad shows "Đã xuất phiếu thu"; after reload "In phiếu thu"
reads `receipt-file` again.

`fixtures/ledgerReceipt.ts` `issueReceipt` takes the real path for every money
spec: pair a helper iPad for the receipt's branch, send (replace), check, sign,
export Không ký số, retry when a parallel worker took the branch's session
(`0112`), revoke the device. Callers pass `{ id, clinicBranchId }`.

BE: `Domain.Tests/Billing/PatientPaymentTests` (issue guards),
`ReceiptSigningTests` (seal / open / tamper),
`Application.Tests/Printing/PaymentReceiptTemplateTests` (signature placed above
the payer, size in EMU).

Checked by hand once: the MinIO object starts with 0x01 and holds no `%PDF`;
decrypted, it is one A5 landscape page, PDF/A part 2, signature above the payer name.

## Assumptions (not in the BA mock)

See `docs/clone/unknowns.md` → P2610 phase 5.
