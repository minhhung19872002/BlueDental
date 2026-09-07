# Chi tiết kế hoạch điều trị — `/patient/:patientId/treatment-plan/:planId`

Status: OBSERVED on **production** (`app.nfcdental.com`, read-only, 2026-09-07) and
staging. Captures (git-ignored) in `reference-private/plan-detail/`: full-page
screenshots at 1440 and 640, dialog screenshots, visible DOM trees, computed
styles and the four GET responses the page issues.

The owner's decision for the clone: production is the canonical layout (four
tabs, five head figures, breadcrumb from the patient), every tab and dialog is
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
| Head figures | five, right-aligned, value 16/700 above a 12px label: `Doanh thu dự kiến` (ink) · `Đã thanh toán` (ink) · `Công nợ` (green) · `Đã hoàn` (red) · `Dư nợ` (amber). One row at 640 | `PlanDetailHead`, `.pdt-stat--{tone}`; values read from `GET patient-treatments/{id}` → `payment.{totalPrice,totalPaid,debt,totalRefund,outstandingDebt}` |

## Tab Chi tiết (`planTab=detail`)

Toolbar: service picker `Thêm dịch vụ mới` (250px, folder icon) + `Thêm công
đoạn` (primary) on the left; `Tạo Đơn Thuốc`, `In Hóa Đơn` (outline) and a
printer icon button on the right. At 640 the picker and `Thêm công đoạn` share a
row, the two outline buttons share the next row, the printer sits beside them.

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

Table, 15 columns, default **10 / trang**:
`Dịch vụ` (name, regular weight, with date + status pill on a second line) ·
`Chẩn đoán` · `Bác sĩ điều trị` · `Răng` · `Số lượng` · `Đơn giá` · `Tổng giảm
giá` · `Thành tiền` (bold) · `Ghi chú` · `Bác sĩ chẩn đoán 1` · `Chẩn đoán 2` ·
`Nhân sự tư vấn 1` · `Nhân sự tư vấn 2` · `Thao tác` (eye, fixed right).
Drag handle in the first cell. Status pill values: `Đã tạo`, `Đang điều trị`,
`Hoàn thành`, `Chuyển đổi`, `Đã hủy`; the pill is a menu on unfinished lines
(Hoàn thành / Chuyển đổi / Hủy).

≤640: one `RecordCard` per line, head shows only the line's index (`1`, `2`…),
first four rows visible, `Xem thêm` for the rest, shared pager below.

## Tab Thanh toán (`planTab=payment-v2`)

Toolbar: `Tạo Phiếu Thanh Toán` (primary, `$` icon) on the **left**, `In hóa
đơn tổng` (outline, printer) on the **right**. Table, default 20 / trang:
`Mã thanh toán` · `Ngày tạo` (dd/MM/yyyy HH:mm) · `Dịch vụ điều trị` · `Tổng
tiền phiếu` · `Thanh toán` · `Phương thức thanh toán` · `Ghi chú` · `Trạng thái`
(`Hoàn tất` pill) · `Thao tác` (eye). All cells regular weight.

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
  its 250px column; own pager
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
