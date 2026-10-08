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
(see "Open — owner decisions").

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
| Tình trạng | Stored: Đang hoạt động / Tạm khoá. Shown also "Hết giá trị" when the balance is 0 or no use is left (derived, not stored) |
| Sổ giao dịch | Phát hành · Nạp thêm · Sử dụng · Hoàn lại, numbered per card, never edited; the drawer shows the balance after each line |
| Chi nhánh | Types and cards belong to the branch that set them up / sold them and are managed there (another branch reads them as 404). A card **pays at any branch** — it is the customer's (`GET prepaid-cards/usable`, guarded by `payment.create`) |
| Hoa hồng | Card-sale commission is added to the seller's "Hoa hồng" in Bảng lương (F-57) for the month the card was sold, in the selling branch |
| Báo cáo | `PaymentStatSummaryDto.ByPrepaidCard` added (BE). Card payments count in revenue when a receipt is paid from the card, like Dư nợ. The money taken at sale / topup is **not** posted to the cash book — see Open |
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

`patient-payments` POST / PUT / confirm take `prepaidCardId` (required with
method 6); `PatientPaymentDto` returns `prepaidCardId` + `prepaidCardCode`.

Errors `BlueDental:PrepaidCard:0001`–`0014` (vi/en texts in the localization files).

## Screen

Two tabs (Segmented): **Thẻ đã phát hành** — four tiles, search / status /
type filters, table (Mã thẻ, Loại thẻ, Chủ thẻ, Thành viên, Số dư / tổng nạp,
Lượt đã dùng, Nhân viên bán, Ngày bán, Trạng thái), "Bán thẻ"; the card number
opens a drawer with the terms, the members editor, "Nạp thêm", "Khoá / Mở
khoá" and the ledger. **Loại thẻ** — table + "Thêm loại thẻ" dialog.

In "Tạo phiếu thanh toán", a sixth pill "Thẻ trả trước" lists the patient's
usable cards (own and shared) with balance and uses left; the amount is capped
at the card's balance. The receipt row reads "Thẻ trả trước (TT26-0001)".

## Open — owner decisions

- Post card sale / topup money to the cash book (Thu chi) and to the sales
  report as its own line; today it is only on the card's ledger and the tiles.
- Expiry date for cards (not in the function list).
- Refunding a card itself (giving money back for unused value) / cancelling a sale.
- A refund (Hoàn tiền) on a service paid by card goes out by cash / bank / card
  today; returning it to the card instead is not built.
- Card list on the patient record.
