# Quy định giảm giá — Nhân sự

**BlueDental-local.** The reference (app.nfcdental.com) has no such setting, so
nothing here is cloned. The source is the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 12: *"Quy định chi tiết số
phần trăm, tổng tiền giảm tối đa của user khi tư vấn, lên dịch vụ cho khách
hàng."* The choices below were made on 2026-10-07 in place of an answer from
the owner.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| Where it is set | Per staff member, on the staff dialog: "Giảm tối đa (%)" (0–100) and "Giảm tối đa (VNĐ)". Either, both or neither; blank = no limit. Per user rather than per role: the function list says "của user", and roles carry no settings of their own |
| Who is limited | The signed-in account doing the typing — not the consultant the line names (that field is a free pick). The `admin` role is never limited |
| What is measured | One line or one slip at a time. A line's discount is what it takes off its service's catalogue price ("Giá sau giảm" — the catalogue's own discount is not the user's): a lowered unit price and a %/VNĐ discount count alike. The % is of that catalogue amount; the VNĐ cap applies to the same discount |
| Where it is enforced (server) | Phiếu tư vấn line create / edit / voucher amount; báo giá line reprice; treatment slip: the slip's own discount at open and on "giảm giá phiếu", a service added on the slip, a line's unit price edited, and the "Thanh toán" amount of a conversion. Lines copied from accepted consulting lines into a slip are not re-checked (they were checked when typed) |
| Not counted | Vouchers redeemed on a slip (a promotion the clinic set, not the user's discount); a combo sold at its catalogue price |
| Editing someone else's discount | Allowed as long as the discount does not grow — its share and its amount are each compared with what they were: a line a manager discounted 50% can be edited (same discount) by staff limited to 10%, but not raised, and shrinking the quantity under the same VNĐ discount (a bigger share) is checked |
| The slip's own discount | Measured before the cap at the slip total, and checked again after anything that changes what it is taken off: adding a service (a % slip discount grows), editing or cancelling one, a conversion (a VNĐ slip discount becomes a bigger share) |
| Conversions | The new line is measured against the catalogue price of the service it becomes × its teeth, so carrying a lowered unit price onto more teeth counts |
| Refusal | 403 `BlueDental:Treatment:0042` "Mức giảm vượt quá quy định giảm giá của bạn: tối đa {MaxPercent}% giá dịch vụ." or `0043` "…tối đa {MaxAmount} VNĐ."; the FE shows the server's message (toast) where the discount was typed |

## API

```
POST/PUT /api/v1/app/staff[/{id}]   { …, maxDiscountPercent: number|null, maxDiscountAmount: number|null }
GET      /api/v1/app/staff[/{id}]   → { …, maxDiscountPercent, maxDiscountAmount }
```

Out-of-range limits → 403 `BlueDental:Staff:0008`.

## Implementation

- `DiscountLimit` (Domain, record): `EnsureAllows(listAmount, discount, previousDiscount)`.
- `DiscountLimitGuard` (Application, scoped): the caller's limit (extra
  properties `MaxDiscountPercent` / `MaxDiscountAmount`), and the catalogue
  reference price of a service.
- Hooks in `PatientAdviseAppService`, `PatientQuoteAppService`,
  `PatientTreatmentAppService`.

## Open — owner decisions

- Whether the limit should also cap the sum of every discount on one slip
  (lines + slip), rather than each discount on its own.
- Whether vouchers should count toward a user's limit.
- Per-role limits.

## Security review (before push)

Three bypasses were found and closed before the first push: a quantity cut
under an unchanged VNĐ discount (share compared with share now); a slip
discount that drifted as services were added, cancelled or repriced (re-checked
after each); a "Giữ dịch vụ" conversion multiplying a lowered unit price across
more teeth (measured against the catalogue).
