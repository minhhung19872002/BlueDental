# Thẻ trả trước — /prepaid-card (menu Tài chính)

**BlueDental-local.** The reference (app.nfcdental.com) has no prepaid cards: no
sidebar entry, no route, no payment method. Source: the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cụm 3:

- 3.1 *Tạo thẻ trả trước — Khởi tạo, bán và phát hành thẻ. Thẻ có thể áp dụng
  cho thành viên trong gia đình hoặc không áp dụng. Cài đặt số lần tối đa sử
  dụng, hoa hồng khi bán, giá trị bán - giá trị sử dụng và các dịch vụ, nhóm
  dịch vụ được sử dụng thẻ.*
- 3.2 *Tình trạng thẻ — Quản lý & ghi nhận tình trạng sử dụng thẻ của từng
  khách hàng. Topup giá trị sử dụng thẻ.*

Everything below was chosen on 2026-10-08 in place of an answer from the owner
(asked, the owner answered "làm cái bạn thấy hợp lý hơn" — the second round
below: refunds onto the card, cards as money held, expiry, cancelling, the
patient record).

Not to be confused with **Dư nợ / tạm ứng** (`PatientPaymentKind.Prepaid`,
`HeldForPatient`): that is one undifferentiated balance per patient. A card has
its own number, terms, scope, use count and holders.

## Model

| Concept | Chosen |
|---|---|
| Loại thẻ (`PrepaidCardType`) | The template a card is sold from, per branch: tên, giá bán, giá trị sử dụng, số lần sử dụng tối đa (empty = unlimited), hoa hồng khi bán (% of the sale price or a fixed VNĐ amount ≤ giá bán), "Áp dụng cho thành viên gia đình", dịch vụ + nhóm dịch vụ áp dụng (both empty = every service), "Đang bán", ghi chú |
| Thẻ (`PrepaidCard`) | Sold from a type that is on sale. **Copies the type's terms** — editing or deleting a type never changes a sold card. Mã thẻ `TT{yy}-{0001}`, one clinic-wide sequence per year (unique index; deleted cards keep their number) |
| Chủ thẻ / thành viên | One owner; up to 10 family members (other patient records) when the type allows family. The owner is never a member. Members can be changed later |
| Bán | Takes money by Tiền mặt / Chuyển khoản / Quẹt thẻ / Ví điện tử (Ngân hàng & Ví momo name the clinic account, as receipts do). Dư nợ and another card are refused (`0014`). The card is loaded with giá trị sử dụng; the seller's commission is fixed at the sale |
| Nạp thêm (topup) | Adds usage value; the money taken may differ (defaults to the value). Refused on a locked card |
| Sử dụng | New payment method **Thẻ trả trước** (`PaymentMethodKind.PrepaidCard = 6`) in "Tạo phiếu thanh toán". **One receipt = one use**, whatever it covers. The server checks: card not locked, patient is owner or member, a use left, every service line of the receipt in the card's scope (catalog service, or the service's group = `CatalogEntry.TaxonomyId`), amount ≤ balance |
| When value leaves the card | When the receipt is **written** ("Chưa thanh toán"), not when it is confirmed — so two pending receipts cannot spend the same value. Confirming a receipt as written touches nothing; editing it re-settles the card only when card / amount / lines changed ("Hoàn lại" + new "Sử dụng"); cancelling it writes a "Hoàn lại" line giving the value and the use back |
| Tình trạng | Stored: Đang hoạt động / Tạm khoá / Đã huỷ. Shown also "Hết hạn" (past `ExpiresOn`, clinic calendar day) and "Hết giá trị" (balance 0 or no use left) — derived, not stored |
| Thời hạn | Optional "Thời hạn sử dụng" on the type, 1–120 months (empty = never expires). The card's `ExpiresOn` = sale day + months, fixed at the sale. After it the card neither pays nor tops up (`0015`); value already returned by a cancelled / edited receipt still comes back. No extension yet |
| Hoàn tiền | Money a card paid on a service goes back **onto that card**: the refund dialog offers "Thẻ trả trước" (with the card) when the slip has card-paid money, capped per line at what that card paid less what was refunded to it; the card gets a "Hoàn lại" line and keeps the use. Cash / bank / card-swipe / e-wallet refunds are capped per line at what was **not** paid by a card (`Billing:0093` otherwise) — card value can never walk out as cash. The server enforces both caps |
| Huỷ thẻ | For a sale made by mistake: only a card that never paid for a service (`0017` otherwise), with a reason (`0019`). Balance written off, the money taken (sale + top-ups) recorded as given back on a "Huỷ thẻ" ledger line, commission set to 0 (so nothing reaches Bảng lương), status Đã huỷ — final. Guarded by `prepaidCard.delete` |
| Sổ giao dịch | Phát hành · Nạp thêm · Sử dụng · Hoàn lại, numbered per card, never edited; the card dialog shows the balance after each line |
| Chi nhánh | Types and cards belong to the branch that set them up / sold them and are managed there (another branch reads them as 404). A card **pays at any branch** — it is the customer's (`GET prepaid-cards/usable`, guarded by `payment.create`) |
| Hoa hồng | Card-sale commission is added to the seller's "Hoa hồng" in Bảng lương (F-57) for the month the card was sold, in the selling branch |
| Tài chính | Revenue is recognised when a receipt is paid from the card (like Dư nợ), so the sale / top-up money is **not** a phiếu thu — that would count it twice. Instead "Đang giữ hộ khách" (`CashBalanceDto.CustomerPrepaid`) now adds what the branch's cards still hold (also returned alone as `PrepaidCardBalance`), and a sale / top-up taken by card swipe adds to "Cà thẻ (đối soát)". `PaymentStatSummaryDto.ByPrepaidCard` (BE) splits card-paid receipts out of the rollup |
| Hồ sơ bệnh nhân | A "Thẻ trả trước" strip under the money tiles (with `prepaidCard.read`): every card the patient owns or shares — number, balance, uses left or why it cannot be spent; each opens `/prepaid-card?q=<mã thẻ>` |
| Quyền | Subject `prepaidCard`: read · create (bán thẻ, thêm loại thẻ) · update (nạp, thành viên, khoá, sửa loại thẻ) · delete (xoá loại thẻ). Granted to the three static manager roles like every subject |

## API — `api/v1/app/prepaid-cards`

| Method | Path | Body / query |
|---|---|---|
| GET | `types` | `ClinicBranchId`, `Filter`, `OnSaleOnly` |
| POST / PUT / DELETE | `types`, `types/{id}` | `SavePrepaidCardTypeDto` |
| GET | `` (list) | `ClinicBranchId`, `Filter` (mã thẻ, tên/mã khách), `CardTypeId`, `PatientId`, `State` (1 Usable · 2 Locked · 3 Exhausted), paging |
| GET | `summary` | tiles: card count, usable, outstanding balance, money received, commission |
| GET | `{id}` | card + members + ledger (newest first, `balanceAfter`) |
| GET | `usable?patientId=` | the payment dialog's picker |
| POST | `` | `SellPrepaidCardDto` — cardTypeId, ownerPatientId, memberPatientIds, sellerStaffId, method, paymentAccountId, note |
| POST | `{id}/topup` | value, paidAmount?, method, paymentAccountId |
| PUT | `{id}/members` | memberPatientIds |
| POST | `{id}/lock`, `{id}/unlock` | — |
| POST | `{id}/cancel` | reason — only a card never used |

`patient-payments` POST / PUT / confirm take `prepaidCardId` (required with
method 6, on a payment or a refund against a slip); `PatientPaymentDto` returns
`prepaidCardId` + `prepaidCardCode`. List `State` also takes 4 Expired · 5 Cancelled;
types take `validityMonths`; cards return `expiresOn`, `isExpired`, `cancelReason`.

Errors `BlueDental:PrepaidCard:0001`–`0019` (vi/en texts in the localization files).

## Screen

Two tabs (Segmented): **Thẻ đã phát hành** — four tiles, search / status /
type filters, table (Mã thẻ, Loại thẻ, Chủ thẻ, Thành viên, Số dư / tổng nạp,
Lượt đã dùng, Nhân viên bán, Ngày bán, Trạng thái), "Bán thẻ"; the card number
opens the card in a **dialog** (owner feedback 2026-10-09: dialogs, not drawers) — the "Xem" button in the sticky right **Thao tác** column — with the terms, the members editor, "Nạp thêm", "Khoá / Mở
khoá" and the ledger. **Loại thẻ** — table + "Thêm loại thẻ" dialog.

In "Tạo phiếu thanh toán", a sixth pill "Thẻ trả trước" lists the patient's
usable cards (own and shared) with balance and uses left; the amount is capped
at the card's balance. The receipt row reads "Thẻ trả trước (TT26-0001)".

## Open — owner decisions

- Extending an expired card, or a grace period.
- Cashing out the unused value of a card that **has** been used (today only an
  unused card can be cancelled).
- A sales-report line for card sales (today: card page tiles, "Đang giữ hộ khách").
