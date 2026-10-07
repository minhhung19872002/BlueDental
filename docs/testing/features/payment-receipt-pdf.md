# F-56 — Phát Hành in PHIẾU THU (PDF) + ô "Xuất hóa đơn đỏ"

Status: `VERIFIED` · Verified on: `41eac777` (2026-10-07)
— see `01-feature-verification-registry.md`, regression log R-809..R-813, R-815.

BlueDental-only (BA message, 2026-10-07); the reference has no such receipt.

## Behaviour

| Button | "Xuất hóa đơn đỏ" | What happens |
|--------|-------------------|--------------|
| Lưu Nháp | ignored | EasyInvoice draft only, as before. Nothing is printed. |
| Phát Hành | unticked (default) | The PHIẾU THU PDF opens in a new tab. The dialog stays open so the data can be corrected and printed again. |
| Phát Hành | ticked | Same confirm dialog as before. Then the receipt and the e-invoice signing run side by side. The receipt opens whether or not signing works; a signing error shows as its own toast. If signing works, the dialog closes. |

The PDF cannot be edited. To fix a receipt, correct the data and issue it again.

## Fields (template `BlueDental.HttpApi.Host/wwwroot/templates/PHIẾU THU.docx`)

| Placeholder | Value |
|-------------|-------|
| `CustomerName` | Tên người mua from the dialog, else the patient's full name |
| `TreatmentWork` | Slip: names of the charged services. Receipt: names of its lines |
| `PaidAmount` / `PaidAmountInWords` | Sum of the ticked lines **after VAT** (`1.234.568 đ`, Vietnamese words) |
| `RemainingAmount` / `…InWords` | `max(0, slip payable − PaidAmount)`. **Provisional**, see `docs/clone/unknowns.md` |
| `PayerName` | Patient full name |
| `IssueDate` | The dialog's invoice date, else today (clinic day, UTC+7), `dd/MM/yyyy` |
| `CashierName` | Signed-in user's full name |

The header, logo, address and footer are fixed text in the template.

## Runtime evidence

Production build (`vite preview` :8098), real API (:5000), real PostgreSQL,
real Gotenberg 8 (Docker, host port 13000), real login. Nothing is intercepted.
`e2e/payment-receipt-pdf.spec.ts` **3/3**:

| Case | What is checked |
|------|-----------------|
| API | A fresh receipt is collected on a new slip. `POST e-invoices/receipt-pdf` returns 200 `application/pdf` with a body starting `%PDF-`. A line worth 10× the collected amount returns 403 `BlueDental:EInvoicing:0010`. |
| Branch | A branch-2 account cannot render the receipt (not 200, not a PDF). |
| UI | /billing, row 📄 opens "Hóa đơn". The checkbox is unticked. Phát Hành makes the API answer with a PDF, and a new tab receives the `blob:` PDF. The dialog stays open with Phát Hành enabled. |

Headless Chromium has no PDF viewer. When the tab is pointed at the blob, it downloads it instead, so the spec accepts either outcome: the tab URL becomes `blob:`, or the tab downloads a `blob:` URL.

The spec never ticks "Xuất hóa đơn đỏ": ticked, it would sign a real e-invoice.

## Backend

- `PaymentReceiptTemplateTests` (8):
  - every key in the shipped template is filled, with XML escaping;
  - the template's key set equals `ToPlaceholders()`;
  - a filled value drops the dot leader of the tab after it, a blank value keeps it, and tab positions do not move (R-815);
  - the remaining amount is never negative;
  - money formatting;
  - the Gotenberg converter is exposed as `IDocxPdfConverter`.
- `ElectronicInvoiceAppServiceContractTests`: `RenderReceiptAsync` requires `payment.finalize`.
- Result: 16/16.

## Regression (level 3, shared `InvoiceModal`)

- `billing-ledger`, `einvoice-api`, `payment-permission-buttons` and `vat-payment-einvoice-api`: **13/13**
- `treatment-plan`: **9/9**

## Operations

- Docker: `docker compose up -d gotenberg`. The api uses `PaymentReceipt__GotenbergUrl=http://gotenberg:3000`.
- Outside Docker, the default is `http://127.0.0.1:13000` (host port 13000 → container 3000; override with `GOTENBERG_PORT`). 3000 was avoided because other dev servers often hold it.
- The template is served statically at `/templates/PHIẾU THU.docx` and contains no patient data.

## Open

- The remaining-amount rule for multiple collections on one slip is waiting on the BA.
- A very long `TreatmentWork` list wraps under the dotted line in the template; this has not been checked with real long slips.
