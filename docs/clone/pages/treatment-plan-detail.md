# Chi tiết kế hoạch điều trị — `/patient/:patientId/treatment-plan/:planId`

Status: OBSERVED on **production** (`app.nfcdental.com`, read-only, 2026-09-07) and
staging. Captures (git-ignored) in `reference-private/plan-detail/`: full-page
screenshots at 1440 and 640, dialog screenshots, visible DOM trees, computed
styles and the four GET responses the page issues.

The owner's decision for the clone: production is the canonical layout (four
tabs, six head figures, breadcrumb from the patient), every tab and dialog is
built, **frontend only** (no backend changes), the app's own primary colour
instead of the reference blue, existing shared components, responsive.

Nothing was written to the reference: the create-payment, refund and print
dialogs were opened and closed without saving.

## Route and entry points

```
/patient/{patientId}/treatment-plan/{planId}?branchId=…&planTab=detail|payment-v2|refund|debt
```

Reached from the Kế hoạch điều trị tab: the slip code link in the table, the
items in the two summary cards, and (≤640px) the card head. The tab is kept in
the URL, so a reload lands on the same tab. Local: `planTab` values are the same
four words; `branchId` comes from the branch store rather than the query string.

## Page head (facts)

| Element | Reference | BlueDental |
|---|---|---|
| Breadcrumb | `←` circle · `[<mã KH>] - <TÊN>` · `Kế hoạch điều trị` · `<mã phiếu>` (current, blue) | same, `.pdt-crumb`; the patient and tab crumbs link back |
| Tabs | four grey pills `Chi tiết` `Thanh toán` `Hoàn tiền` `Dư nợ`, 8×16 padding, 14/500, active = filled blue with white text; they wrap at 640 | `.pdt-tab` pills, active uses `--bd-primary` |
| Head figures | **six**, right-aligned, value **15/700** (line 22.5) above a 12/18 label: `Doanh thu dự kiến` (ink) · `Đã thanh toán` (ink) · `Công nợ` (green) · `Đã hoàn` (red) · `Tạm ứng` (amber) · `Dư nợ` (ink). One row at 640. Re-measured 2026-09-22: `Tạm ứng` had been missed, `Dư nợ` is amber like it, and the three tones are the reference's own — green `#2BB673`, red `#E5484D`, amber `#D97706` | `PlanDetailHead`, `.pdt-stat--{tone}`; values read from `GET patient-treatments/{id}` → `payment.{totalPrice,totalPaid,debt,totalRefund,paidUncompleted,outstandingDebt}` (which field feeds `Tạm ứng` is not fully decided — see unknowns) |

## Tab Chi tiết (`planTab=detail`)

Toolbar: service picker `Thêm dịch vụ mới` (250px, folder icon) + `Thêm công
đoạn` (primary) on the left; `Tạo Đơn Thuốc`, `In Hóa Đơn` (outline) and a
printer icon button on the right.

**On a finished slip the picker is not there** (re-measured 2026-09-21: the
`done` slip DT32 shows only `Thêm công đoạn` · `Tạo Đơn Thuốc` · `In Hóa Đơn` ·
printer, the open slip DT33 shows the picker as well). BlueDental hides it the
same way — the server refuses a new line on a closed slip, so leaving the field
there only produced "Không thể thực hiện thao tác này trên kế hoạch điều trị".

The picker **searches on the server**: typing fires
`care-service/list?search=…&page=1&perPage=20` on the reference, and the popup
asks for the next page as it is scrolled. Locally it is
`catalog-entries?filter=…&skipCount=…&maxResultCount=20`, debounced 300ms, with
the group panel searching its own group the same way.

At 640 the picker and `Thêm công đoạn` share a row, the two outline buttons
share the next row, the printer sits beside them.

Picking a service **appends an editable row to the table** rather than opening a
dialog: the service name and today's date in the first cell with its status
pill, then six server-search pickers (`Chẩn đoán` · `Bác sĩ điều trị` ·
`Bác sĩ chẩn đoán 1` · `Chẩn đoán 2` · `Tư vấn 1` · `Tư vấn 2`), a tooth
button, quantity, price, note, and ✓ / ✕ in the action cell.

**Each picker fills its column** — 168px inside the 200px cells, 148px inside the
180px ones, i.e. the cell less the table's 16px side padding. Worth stating,
because AntD's `Select` sizes to its own content and an empty one is just the
search icon and the caret: without an explicit width it renders **71px** wide and
its dropdown, which matches the trigger, crops the option names to `Sai …`
(fixed 2026-09-22, R-455).

The **printer icon** opens the slip's own **"Chi tiết phiếu"** (1024px), it does
not download anything (observed 2026-09-07, evening):

- `THÔNG TIN CHI NHÁNH`: `Phòng khám` · `Địa chỉ` · `ĐT` · `Email` — left;
  `THÔNG TIN KHÁCH HÀNG`: `Mã KH` · `Họ và tên` — right
- `CHI TIẾT DỊCH VỤ`: table, 20 / trang, `Hiển thị 1 trên 1 dịch vụ`, columns
  `Dịch vụ` (the teeth in blue over the service name — "Nguyên hàm" on the
  reference row) · `Trạng thái` · `Bác sĩ điều trị` · `Số lượng` · `Đơn giá` ·
  `Giảm giá` · `Thành tiền` (bold) · … (the table scrolls; the columns past
  `Thành tiền` were not read, see unknowns)
- `TỔNG THANH TOÁN DỊCH VỤ` (right): `Tổng phí` · `Đã trả trước đó` · `Tổng còn
  nợ` (red)
- footer: only `In Phiếu` (primary, printer icon)

`In Phiếu` prints **"PHIẾU ĐIỀU TRỊ"**, one A4 portrait sheet in serif: the
clinic facts (`Phòng khám` / `Địa chỉ` / `ĐT` / `Email`, bold labels) top-left,
the title with `Ngày 7 tháng 9 năm 2026` under it in the middle, `Mã KH` / `Họ
và tên` top-right; a ruled table `Dịch vụ` (teeth bold, service name under) ·
`Trạng thái` · `Bác sĩ` · `Đơn giá` (`300.000 đ x 1` — the net unit price times
the quantity) · `Thành tiền` (bold); `TỔNG THANH TOÁN DỊCH VỤ` on the right
with `Tổng phí` / `Đã trả trước đó` / `Tổng còn nợ`; `Người lập phiếu` and
`Khách hàng`, each over *(Ký, họ tên)*, the dentist's and the customer's names
in bold below.

Local: `PlanSlipDialog` + `PlanSlipSheet` (`slipView.ts`), the same print
mechanism as the receipt (`printSheet.ts`, the `pdt-print-dialog` class). The
print rules set `@page { margin: 0 }` so the browser adds no header or footer
of its own (date, document title, URL, page number); the sheet carries its
15mm margin. Before this the icon downloaded the API's PDF of the plan.

Table, 16 columns, default **10 / trang** (re-counted against the reference
2026-09-22 — `Tạm ứng` had been missed):
`Dịch vụ` (name, regular weight, with date + status pill on a second line) ·
`Chẩn đoán` · `Bác sĩ điều trị` · `Răng` · `Số lượng` · `Đơn giá` · `Tổng giảm
giá` · `Thành tiền` (bold) · `Tạm ứng` · `Ghi chú` · `Bác sĩ chẩn đoán 1` ·
`Chẩn đoán 2` · `Nhân sự tư vấn 1` · `Nhân sự tư vấn 2` · `Thao tác` (eye,
fixed right). `Tạm ứng` is money collected on the line that its work has not
earned yet — everything paid while the line is still open (`advanceOn` in
`planDetailTypes.ts`); which of the payload's two equal fields the reference
prints could not be told apart, see unknowns.

Default order is **newest first**: the reference asks for
`treatment-services?…&sortBy=createdAt&sortDirection=desc`.

Drag handle in the first cell, and it is a working one: dragging a row moves it
and the move is saved (`POST …/services/reorder`, 1-based `sortOrder`). It is a
real button, so the up/down arrow keys move the row too. A line is written
without a position (`sortOrder: 0`) so an untouched slip keeps reading
newest-first; the first drag numbers every line on the slip and they stay
numbered. The server builds the sequence the same way the table reads it —
`sortOrder`, then newest first — or a drop would be measured against an order
the clinic never saw.

Status pill values: `Đã tạo`, `Đang điều trị`, `Hoàn thành`, `Chuyển đổi`,
`Đã hủy`; the pill is a menu on unfinished lines (Hoàn thành / Chuyển đổi /
Hủy). On the reference a line in `created` offers only two of those — see
unknowns.

### "Chỉnh sửa" and the Răng column (read 2026-09-24 from the published column builder)

- **Răng prints tooth numbers only** — `getSelectedToothCodesDisplay(content)`,
  never "11 - Mặt ngoài", on the saved rows and on the inline row once teeth are
  picked. A jaw preset still prints its name.
- **Thao tác** holds the eye and, where offered, a **pencil** (`Chỉnh sửa`,
  `gap-4`). The pencil is offered when `canEdit` holds: the line is not
  `done / canceled / replaced` **and** nothing has been paid on it
  (`payment.totalPaid > 0` hides it). It is only offered while no other row is
  being written.
- The pencil turns the line back into the inline row (✓ Lưu / ✕ Hủy). On a line
  **in treatment** the diagnosis and the unit price stay as they are, printed
  with *Không thể đổi chẩn đoán khi đang điều trị* / *Không thể đổi giá khi đang
  điều trị* under them, and the teeth that already have a công đoạn cannot be
  unpicked — the tooth dialog says *Răng … đang điều trị — không thể bỏ chọn.*
  and folds them back in on confirm.

BlueDental: `useEditServiceRow` + `PUT /api/v1/app/patient-treatments/{id}/services/{lineId}`
(`TreatmentService.Revise`, errors `Treatment:0037/0038/0039`); the line
carries `stagedTeeth` for the lock. Not observed and not copied: the reference
recomputes **Số lượng** from the teeth on the inline row; BlueDental keeps its
own quantity field, as the new-service row always has. What the reference's ✕
does on an edited row (it shares one cancel handler with the new row) is not
known; BlueDental just leaves edit mode — nothing is deleted.

### Đơn giá · Tổng giảm giá · Thành tiền — giá gốc và bốn khoản giảm (staging 2026-09-28)

Read-only: one existing line (catalog 1.000.000, unit price edited to 910.000,
plan voucher 10 %) hovered and its `GET` responses read; the published column
builder and the ✓ handler read from the page's JS. Nothing typed or saved —
the edit-mode and validation states come from the owner's screenshots.

**The line carries two prices.** `GET /v1/treatment-services?patientTreatmentId=`
returns per line:

```json
{ "originalPrice": 1000000, "price": 910000, "quantity": 1,
  "discountType": "money", "discountValue": 90000, "discountAmount": 0,
  "serviceDiscount": 90000, "serviceVoucher": 0,
  "khdtDiscount": 0, "khdtVoucher": 100000,
  "appliedCoupons": [], "appliedCouponIds": [],
  "payment": { "totalPrice": 810000, "discount": 190000, "debt": 810000, … } }
```

- `originalPrice` — the catalog price the line was opened with; the ceiling.
- `price` — the unit price actually charged. Lowering it **is** the line's own
  discount: `serviceDiscount = (originalPrice − price) × quantity`, mirrored as
  `discountType: "money"`, `discountValue: 90000`.
- `serviceVoucher` — vouchers applied to this line alone
  (`POST /voucher/apply { targetType: "treatmentService" }`, sent after a new
  line is created with coupons picked on the inline row).
- `khdtDiscount` / `khdtVoucher` — the line's share of the plan's ("KHDT" =
  kế hoạch điều trị) own discount and of the plan's vouchers.

The plan (`GET /patient-treatments/{id}`) keeps `voucherDiscountAmount: 100000`,
`appliedCoupons[{ code, discountType: "percentage", discountValue: 10,
sourceScope: "treatment" }]` and `payment { totalPrice: 810000, discount: 190000 }`.

**Columns (saved row):**

| Column | Reference formula |
|---|---|
| Đơn giá | `originalPrice` (falls back to `price`) — **before** anything is taken off: 1.000.000 |
| Tổng giảm giá | `serviceDiscount + khdtDiscount + serviceVoucher + khdtVoucher` = 190.000, dotted underline |
| Thành tiền | `payment.totalPrice` of the line, else `originalPrice × qty − Tổng giảm giá` = 810.000 |

**Tooltip on Tổng giảm giá — four lines, zeros included, always in this order:**

```
Giảm dịch vụ: 90.000 đ
Voucher dịch vụ: 0 đ
Giảm KHDT: 0 đ
Voucher KHDT: 100.000 đ
```

The two `Voucher …` lines are shown only while the clinic's secondary feature
`voucher` is on (`useSecondaryFeatureEnabled(SECONDARY_FEATURE_KEYS.voucher)`);
the two `Giảm …` lines always.

**Edit mode (pencil):** the Đơn giá cell becomes a currency input prefilled
with `price` (910.000, not the 1.000.000 the column showed). Thành tiền opens
on the row's saved total (810.000); the published `onDraftChange` then sets
`total = unitPrice × quantity` on the first change to the price, the quantity
or the teeth, so Thành tiền follows the input as it is typed — slip shares and
line discount are not taken off it until the line is saved. Tổng giảm giá keeps
the saved `serviceDiscount`-based figure while editing. (Corrected 2026-09-28
on the owner's note: the first reading, "Thành tiền stays put", came from a
screenshot taken before anything was typed.) The **new-service** row
recomputes both on each keystroke: its discount is
`max(0, (originalUnitPrice − unitPrice) × quantity)`; the picker gives the new
row `price = originalPrice = the catalog's resolved unit price`.

**Validation on ✓ (Joi, before any request):**

| Field | Rule | Message |
|---|---|---|
| unitPrice | number, required | *Vui lòng nhập đơn giá hợp lệ.* / *Vui lòng nhập đơn giá.* |
| unitPrice | `min(0)` | *Đơn giá phải lớn hơn hoặc bằng 0.* |
| unitPrice | `max(originalUnitPrice)` | *Đơn giá không được lớn hơn giá gốc của dịch vụ.* (red under the input) |
| diagnosisId, doctorId | required | — |
| selectedTeeth | `min(1)` | — |
| staffDiagnosisSecondId | ≠ staffDiagnosisId | *Chẩn đoán 2 phải khác bác sĩ chẩn đoán 1.* |
| adviseStaffSecondId | ≠ adviseStaffId | *Nhân sự tư vấn 2 phải khác nhân sự tư vấn 1.* |
| note | max 1000 | — |

On a line in treatment the `unitPrice` rule is stripped (the price is locked).

**What ✓ sends on an edited line:** `PATCH /v1/treatment-services/{id}` with a
**diff** — `{ patientId, patientTreatmentId }` plus only the fields that
changed; a changed unit price travels as `amount` (never on a line in
treatment). The server derives `price`, `serviceDiscount` and the shares — the
client sends no discount fields.

**Voucher after a price edit:** on the observed line the plan voucher was
applied at 1.000.000 (10 % → 100.000, plan `updatedAt` 09:23) and the price
was edited later (line `updatedAt` 09:26); `khdtVoucher` is still 100.000, not
91.000 — the voucher amount is fixed when applied. Whether the server re-splits
it across lines after an edit is UNKNOWN (single-line plan).

The tooltip is the reference's own Radix bubble, measured with
`getComputedStyle` while hovered: background `rgb(27, 42, 65)`, radius 6px,
padding `6px 12px`, lines 12px/16px weight 400, 4px apart (20px steps), opened
`placement: "left"`; the figure is `underline-offset-2`. Below the figure the
reference also lists up to two of the **line's own** coupon codes as badges
(`+n` beyond) — only while the voucher feature is on.

**BlueDental (R-605):**

- `TreatmentService.OriginalPrice` (migration
  `20260928094604_AddTreatmentServiceOriginalPrice`; existing lines got
  their own price, or the consulting line's higher list price). A line opened
  from a consulting line takes the advise's `OriginalPrice`; a line added
  through the inline row takes the catalog price; a conversion takes the unit
  price it was given. `ServiceDiscountAmount` = (giá gốc − đơn giá) × SL +
  the carried-over line discount; the slip's `ServicesGrossTotal` is summed at
  giá gốc, so Tổng phiếu / Giảm giá / `payment.discount` read 1.000.000 /
  190.000 as on the reference. What the patient owes is unchanged.
- The unit price may not rise above the giá gốc: `Revise` and `AddService`
  refuse with `403 BlueDental:Treatment:0040` "Đơn giá không được lớn hơn giá
  gốc của dịch vụ."; the inline row refuses it on ✓ first, red input and the
  same message, and clears it once the price is back under.
- `TreatmentServiceDto` adds `originalPrice`, `serviceDiscountAmount`,
  `planDiscountShare` ("Giảm KHDT") and `planVoucherShare` ("Voucher KHDT") —
  `TreatmentPlan.DiscountShareParts()` splits each line's existing share, so
  `chargedAmount` does not move.
- Table / cards: Đơn giá = giá gốc; Tổng giảm giá = the four parts, tooltip in
  the reference's four lines and bubble (`--bd-tooltip-bg`); Thành tiền after
  every discount. An edited line opens on its saved Thành tiền and switches to
  đơn giá × số lượng on the first change to price, quantity or teeth; its Tổng
  giảm giá stays saved until Lưu. The new row recomputes its Giảm dịch vụ live.
- Not copied: "Voucher dịch vụ" is always 0 and no coupon badges show —
  BlueDental redeems vouchers on the slip only (R-590). The two voucher lines
  always show; BlueDental has no secondary-feature switch.

### Dialog "Chuyển đổi dịch vụ" (status pill → Chuyển đổi)

Measured 2026-09-22 on the reference, read-only: the dialog was opened and
measured, never saved. Modal 1024 wide, body padding `12px 24px 24px`, one
primary `Lưu` in the footer. Unlike every other dialog in the app it keeps **no
scroller of its own** — it grows to its content and the overlay scrolls on a
window too short to hold it, so nothing is ever cut off inside. Body is `grid gap-8 lg:grid-cols-2`; every block is
headed by an icon and one uppercase 14/600 line, and its rows are
`grid-cols-[150px_minmax(0,1fr)]` with a 64px gutter, label `#5A6B82`, value
`#1B2A41`, both 14/400.

Left column — `DỊCH VỤ HIỆN TẠI`: `Dịch vụ hiện tại` · `Chẩn đoán` · `Nội dung
điều trị` · `Răng` · `Trạng thái` (pill). Then, above a `border-t`,
`THÔNG TIN THANH TOÁN HIỆN TẠI`: `Tổng tiền` · `Giảm giá` · `Đã thanh toán` ·
`Công nợ` · `Còn lại` (8px apart rather than 16).

Right column — `DỊCH VỤ MỚI`:

- `Loại chuyển đổi`: two radio cards 40px tall, radius 8, side by side —
  `Thay thế` (selected on open, border `#2671D8`) and `Dịch vụ cũ` (border
  `#DCE3EE`). `Thay thế` swaps in a different service at its list price;
  `Dịch vụ cũ` re-issues the same one at the price it was sold for, and hides
  the picker.
- The service picker (`Thêm dịch vụ mới`), same server-search control as the
  toolbar's, with the group folder beside it.
- `Thanh toán` — what the patient is actually charged; empty means the new
  service's full price.
- `Ghi chú*`, `min-height: 112px`, required.
- A tinted box (`#F8FAFD`, border `#E7EDF6`, radius 12, padding 12) with
  `Bác sĩ chẩn đoán 1*` and `Nhân sự tư vấn 1*`, each with a round blue `+`
  that reveals a second picker and a red `×` that takes it away again.
- `Xử lý chênh lệch` appears only once a service is picked **and** more was
  collected on the old line than the new one costs: `Hoàn tiền` ("Chuyển đổi sẽ
  cần tạo hoàn tiền dịch vụ cho dịch vụ cũ") or `Dư nợ` ("Khi chuyển đổi, tiền
  dịch vụ cũ được tính vào dư nợ").
- `Răng: …` with a 28px blue tooth button opening the shared picker; the teeth
  of the line being closed are carried over.
- `THÔNG TIN THANH TOÁN`: `Tổng tiền` · `Giảm giá` · `Đã thanh toán` ·
  **`Hoàn trả chênh lệch`** · `Còn lại`, where
  `đã thanh toán = min(đã thu trên dòng cũ, số tiền tính)`,
  `hoàn trả = max(đã thu − số tiền tính, 0)` and
  `còn lại = max(số tiền tính − đã thu, 0)`.

**What it refuses to save** (the wording is the reference's own, read off its
published bundle 2026-09-22 — these are i18n keys, so the refusal itself comes
from its server):

| Key | Vietnamese |
|---|---|
| `treatment.validation.convertNotAllowed` | `Dịch vụ đã hoàn thành/huỷ không được phép chuyển đổi.` |
| `treatment.validation.convertNoteRequired` | `Vui lòng nhập lý do chuyển đổi dịch vụ.` |
| `treatment.validation.convertDifferenceRequired` | `Bạn chưa chọn phương thức xử lý tiền chênh lệch.` |
| `treatment.validation.convertTypeUnsupported` | `Loại chuyển đổi này chưa được hỗ trợ.` |
| `treatment.validation.selectNewService` | `Vui lòng chọn dịch vụ mới` |

The reference's own rule keys off the **line's status** — finished or cancelled.
BlueDental keeps that (`BlueDental:Treatment:0027`, same wording) and adds one
the owner asked for: a line that already carries a **finished công đoạn** is
refused even while its own status is still open
(`BlueDental:Treatment:0028` — `Dịch vụ đã có công đoạn hoàn thành, không được chuyển đổi.`),
because that work was done and charged against this very service. The two cases
differ only when the line is **part** finished; once every công đoạn is done the
line closes, and a closed line shows no status menu, so the dialog cannot be
opened from the table at all.

Saving closes the old line (`Replaced`, printed "Chuyển đổi"), writes a fresh
line for the new service, points the two at each other through `replacedId`, and
moves the collected money onto the new line up to what it costs. What is left
over is refunded (a `HT…` receipt against the old line) or kept as the patient's
credit, per `Xử lý chênh lệch`.

Local: `plan-detail/convert/` — `ConvertServiceDialog` (shell),
`useConvertServiceForm` (state, rules, save), `ConvertCurrentService` /
`ConvertNewService` / `ConvertStaffBox` / `ConvertFacts` (presentation),
`convertMoney.ts` (the arithmetic). Styles under `.cvt-*` in
`plan-detail.css`.

≤640: one `RecordCard` per line, head shows only the line's index (`1`, `2`…),
first four rows visible, `Xem thêm` for the rest, shared pager below.

## Tab Thanh toán (`planTab=payment-v2`)

Toolbar: `Tạo Phiếu Thanh Toán` (primary, `$` icon) on the **left**, `In hóa
đơn tổng` (outline, printer) on the **right**. Table, default 20 / trang:
`Mã thanh toán` · `Ngày tạo` (dd/MM/yyyy HH:mm) · `Dịch vụ điều trị` · `Tổng
tiền phiếu` · `Thanh toán` · `Phương thức thanh toán` · `Ghi chú` · `Trạng thái`
(`Hoàn tất` pill) · `Thao tác`. All cells regular weight.

`Thao tác` carries **three** actions (re-measured 2026-09-21), each a 28px ghost
button: `Xem` (eye) · `Chỉnh sửa` (pencil) · `Huỷ` (trash, `#E5484D`, hover
`#E5484D`/10%).

Local: `Chỉnh sửa` opens a dialog over what the receipt says about *how* the
money was taken — `Hình thức`, the account behind it when the channel needs one,
`Ngày tạo` and `Ghi chú` — through `PUT patient-payments/{id}`. The amount and
the per-service split are read-only there: the slip's rollup and every line's
"Còn nợ" are derived from them, so a wrong amount is voided and collected again.
`Huỷ` asks for confirmation and then deletes the movement (a soft delete — the
aggregate is fully audited), which recomputes every figure on the slip.

`Tạo Phiếu Thanh Toán` opens the shared "Tạo phiếu thanh toán" dialog
(`CreatePaymentDialog`, already built for the Hồ sơ tab) with every service of
the slip pre-ticked. The dialog imports its own stylesheet, so it is dressed on
this route too — before 2026-09-07 (evening) only the patient page loaded it
and the dialog opened bare here.

The eye and `In hóa đơn tổng` open **"Chi tiết phiếu"** (1024px):

- `CHI TIẾT PHIẾU`: `Mã thanh toán:` · `Ngày tạo:` · `Phương thức thanh toán:` · `Ghi chú:`
- `THÔNG TIN KHÁCH HÀNG`: `Mã khách hàng:` · `Khách hàng:` · `Số điện thoại:` · `Địa chỉ:` · `Ngày sinh:`
- `CHI TIẾT DỊCH VỤ`: table `Dịch vụ` · `Chẩn đoán` · `Bác sĩ điều trị` · `Số
  lượng` · `Đơn giá` · `Giảm giá` · `Thành tiền` (bold), own pager, horizontal
  scroll when narrow (the reference scrolls too)
- `TỔNG THANH TOÁN DỊCH VỤ` (right-aligned, 380px): for one receipt `Tổng phí` ·
  `Giảm giá` · `Đã trả trước đó` · `Số tiền TT` · `Tổng còn nợ` (red); for the
  aggregate `Mã thanh toán: Tổng hợp`, `Ngày tạo: Ngày 7 tháng 9 năm 2026`,
  `Phương thức thanh toán: Tổng hợp`, totals `Doanh thu dự kiến` · `Đã thanh
  toán` · `Công nợ` (red)
- footer: only `In Hoá Đơn` (primary, printer icon); the X closes

`In Hoá Đơn` prints **"BIÊN LAI THU TIỀN"**, not the dialog. Observed on the
reference's aggregate print preview (2026-09-07, one A4 portrait sheet, serif):

- centred letterhead: clinic name (bold, uppercase) · address · phone
- title `BIÊN LAI THU TIỀN` (bold) · `Hoá đơn chỉ được xuất trong ngày` (small,
  bold italic)
- three groups separated by dashed rules, bold labels with a colon:
  `Ngày:` (`Ngày 7 tháng 9 năm 2026`) · `Nhân viên:` (blank on the aggregate) /
  `Khách hàng:` (`[code] NAME`) · `ĐT:` · `Địa chỉ:` /
  `Thành tiền:` · `Số tiền bằng chữ:` (`Ba trăm nghìn đồng`) · `Phương thức
  TT:` (`Tổng hợp`) · `Dịch vụ:` (service names) · `Nội dung TT:`
- two signature blocks `Người lập phiếu` / `Khách hàng`, the names in bold
  below (the aggregate signs with the treating dentist)

Local: `ReceiptSheet` sits off-screen inside the dialog; `window.print()` with
the `pdt-printing` class on `<html>` shows only it. `Số tiền bằng chữ` comes
from `utils/moneyWords.ts`. For a single receipt the sheet prints the
receipt's own date, `Nhân viên` = who collected, its channel and amount, and
that person signs `Người lập phiếu` — the reference's single-receipt print
was not observed (see unknowns).

## Tab Hoàn tiền (`planTab=refund`)

Toolbar: `Hoàn Tiền` (primary, undo icon) on the left. Table, 20 / trang:
`Mã hoàn tiền` · `Ngày tạo` · `Dịch vụ` · `Đã hoàn` · `Phương thức thanh toán` ·
`Ghi chú` · `Thao tác` (eye → the same "Chi tiết phiếu").

`Hoàn Tiền` opens **"Hoàn tiền"** (1240px):

- left column, stacked floating fields: `Loại` (`Hoàn tiền dịch vụ` / `Hoàn tiền
  dư nợ`) · `Hình thức` (search icon; exactly three options `Tiền mặt` /
  `Chuyển khoản` / `Quẹt thẻ` — a label only, **no account picker** follows) ·
  `Ngày tạo` (disabled, `d/M/yyyy`, calendar icon)
- right column: `Nội dung` textarea, 152px tall, `0/500` counter
- table `Dịch vụ` · `Tổng tiền` · `Đã thanh toán` · `Còn lại` · `Đã hoàn` · `Nhập
  số tiền hoàn` (placeholder "Nhập số tiền hoàn"); the four money headers are
  right-aligned over their numbers, the input header left over a box that fills
  its 250px column; own pager. **With nothing to refund the grid stays** — the
  head and the frame remain and a single "Không có dữ liệu" row fills the width,
  rather than the table being replaced by a sentence
- `Tổng tiền trả:` right-aligned, blue, bold, above a divider
- footer: only `Lưu` (save icon)

Local: `Đã thanh toán` is the gross collected on the line (net paid + refunded);
the box accepts up to the **net** amount still held on that line, because the
API's `paidAmount` is already net of refunds. Saving posts one
`patient-payments` of kind Refund with manual lines.

## Tab Dư nợ (`planTab=debt`)

No toolbar. Table, 20 / trang: `Dịch vụ` · `Chẩn đoán` · `Bác sĩ điều trị` ·
`Răng` · `Số lượng` · `Dư nợ` · `Tổng tiền` · `Thao tác`. No `Ghi chú`. Empty on
every slip observed ("Không có dữ liệu").

## Accepted deviations (house chrome and shared components)

- Navy sidebar / house header instead of the reference chrome.
- `--bd-primary` (indigo) wherever the reference paints `#2671D8`.
- The shared pager (`useTablePagination.buildConfig`: "Hiển thị a–b trên n …",
  page-size select on the left of the page numbers) instead of the reference's
  `Trước` / `Sau` pager with the select on the far left.
- `RecordCard` at ≤640 lays label and value on one line; the reference stacks
  them. Card head content (the index) matches.
- Empty tables hide the pager (antd), the reference keeps "Hiển thị 0 trên 0".

## Unknowns

See `docs/clone/unknowns.md` — "Chi tiết kế hoạch điều trị" entries: what
`Thêm dịch vụ mới` and `Chuyển đổi` do after the pick, which lines feed the Dư
nợ tab, the meaning of the aggregate receipt's totals, the refund table's
columns on a partly-refunded line, and `Hoàn tiền dư nợ`.
