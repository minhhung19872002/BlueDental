# F-71 — Yêu cầu xuất HĐ (QR trên PHIẾU THU → tab Hóa đơn)

Status: `VERIFIED` · Verified on: uncommitted working tree (2026-10-12)
— see `01-feature-verification-registry.md`, regression log R-908, R-909.

BlueDental-only. Sources: the BA mockup of the patient's Hóa đơn tab, the BA
note "khách hàng nhập thông tin vào form xuất hoá đơn thì đổ dữ liệu về đây",
the BA drawio `P1210_01.drawio` and the owner's answers of 2026-10-12. The
reference app has no such screen.

## Flow

1. A PHIẾU THU whose receipt carries "Xuất hóa đơn đỏ" (`RedInvoiceRequested`,
   F-70) prints a QR. The QR belongs to **one receipt and one customer**
   (`InvoiceRequestLink`, one live link per receipt, renewed when it runs out).
2. The QR opens `/invoice-request/{token}`. This public page needs no sign-in,
   and the token is the only key.
3. The page shows the receipt (code, amount, service) and the THÔNG TIN XUẤT
   HÓA ĐƠN form:
   - **Prefilled:** full name and year of birth.
   - **Hidden, shown only as a masked hint** ("Để trống để giữ 09•••••12"):
     phone, CCCD, address and email.
   - **Blank:** company name, tax code and company address.
   - **Not asked:** Cân nặng and Chiều cao. The customer writes them by hand on
     the printed sheet.
4. A blank field keeps the value on file, but only in the request. The patient
   profile is never written to.
5. One submit per link:
   - Opening the link again shows "Đã gửi trước đó".
   - An expired link shows "Mã QR đã hết hạn".
   - An unknown token shows "Liên kết không hợp lệ".
6. The request lands on the patient's **Hóa đơn** tab under "Yêu cầu xuất HĐ".
   The old payment table moved behind the second segment, "Phiếu thu".

## Hóa đơn tab

- The tab badge shows the number of open requests. It is `aria-hidden`, so the
  link's accessible name stays "Hóa đơn".
- Banner: "N yêu cầu cần xử lý", plus overdue when there are any, and "Xem ngay"
  switches the filter.
- Filter chips: Tất cả / Cần xử lý / each status, with counts from `stats`.
- Columns:
  - Mã yêu cầu, with "MỚI" and "Khách gửi qua QR"
  - Thời gian gửi
  - Phiếu thu / Dịch vụ
  - Số tiền
  - Thông tin xuất HĐ (Cá nhân / Công ty + MST, Số HĐ once issued)
  - Trạng thái
  - Hạn xử lý
  - Phụ trách
  - Actions
- "Tạo yêu cầu": staff enter a request for a red-invoice receipt that has none
  yet. The dialog uses the same fields, with the patient's data filled in.
- The detail dialog shows the THÔNG TIN XUẤT HÓA ĐƠN sheet and can print it.
  On the printed sheet, Cân nặng and Chiều cao are left blank.

## Workflow (`InvoiceRequest`, server-side guards)

| From | Action | To | Rule |
|------|--------|----|------|
| Pending, NeedsInfo | Xử lý | Processing | assignee = current user |
| Pending, Processing | Cần bổ sung | NeedsInfo | reason required (`0010`) |
| Processing | Hoàn tất | Issued | Số hóa đơn required (`0011`); the button is disabled while it is empty |
| any open | Hủy yêu cầu | Cancelled | reason required |
| any open | Sửa | same; NeedsInfo → Pending | |
| anything else | — | — | `BlueDental:InvoiceRequest:0009` |

Other rules:

- One live request per receipt (`0008`).
- Only a Kind=Payment receipt that is not cancelled qualifies (`0014`).
- Due time = sent time + 24 h (`ProcessingWindow`).
- Branch scope: every endpoint checks the branch of the receipt or request.

Permissions:

| Permission | Covers |
|------------|--------|
| `payment.read` | the list, stats, detail and options |
| `payment.create` | the QR link, Tạo yêu cầu and Sửa |
| `payment.finalize` | Xử lý, Cần bổ sung, Hoàn tất and Hủy |

## API

- Staff endpoints (`api/v1/app/invoice-requests`):
  - `GET` the list (`patientId`, `status`, `openOnly`)
  - `GET stats`
  - `GET payment-options/{patientId}`
  - `GET draft/{paymentId}`
  - `POST links/{paymentId}`
  - `GET {id}`
  - `POST` create
  - `PUT {id}`
  - `POST {id}/start`, `{id}/needs-info`, `{id}/complete`, `{id}/cancel`
- Public endpoints (`api/v1/public/invoice-requests/{token}`): `GET` the form and
  `POST` the answer. Both are anonymous.
- Migration: `20261012111426_InvoiceRequests`.
- The QR is drawn into `PHIẾU THU.docx` (`PaymentReceiptQr`, 20 mm at left
  182 mm / top 120 mm). Its URL is `PaymentReceipt:PublicFormBaseUrl`, which
  docker sets to `https://${SITE_DOMAIN}` in prod and to `FRONTEND_URL` locally.

## Also in this change

The "Chi tiết phiếu" footer button for a receipt is now **In phiếu thu** and
opens the PHIẾU THU PDF (`PrintReceiptButton`). "In hóa đơn tổng" and refunds
still print the sheet beside the dialog.

## Tests (real stack: production build :8081 → host :5000 → PostgreSQL)

| Spec | What |
|------|------|
| `e2e/invoice-request-api.spec.ts` (1) | QR link → public GET (masked hints) → submit → second submit refused → staff create (dup refused) → workflow guards → other branch 403 |
| `e2e/invoice-request-ui.spec.ts` (1) | Phone (390×844, no session) fills the QR form as a company; reload shows "Đã gửi trước đó"; a bogus token shows "Liên kết không hợp lệ". On the tab: badge, row, Tạo yêu cầu, reload, Xử lý → Hoàn tất (disabled until Số hóa đơn is filled), Cần xử lý filter, reload |
| `e2e/billing-ledger.spec.ts` (5) | "In phiếu thu" on the ledger's Xem |
| `e2e/treatment-plan-detail.spec.ts` (13) | "In phiếu thu" on the plan's receipt |
| `e2e/patient-permission-gates.spec.ts` | tab named "Hóa đơn" with the badge |

The receipts the specs create stay "Chưa thanh toán" and are cancelled at the
end. No e-invoice is ever issued.

Not covered: no backend xUnit tests were added; the API spec is the real-HTTP
evidence.

## Open with the BA (`docs/clone/unknowns.md`)

- the SLA (24 h)
- the link lifetime (30 days)
- Phụ trách before anyone starts the request
- how "MỚI" is defined
- the QR's size and position on the template
- how the customer re-sends after "Cần bổ sung"
- notifications
- a cross-patient screen
