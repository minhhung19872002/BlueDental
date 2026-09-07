# Patient Detail Page — /patient/:id

Source: https://app.nfcdental.com/patient/:patientId?branchId=<id>
Observed: 2026-08-28
Patient observed: existing record (identifiers omitted; no production PHI is recorded here)

## Route

`/patient/:patientId?branchId=<branchId>&tab=<tabKey>`

Tab query params (CONFIRMED from network capture + JS bundle):
- (default/none) → Hồ sơ
- `?tab=consulting` → Chẩn đoán & Tư vấn
- `?tab=treatment-plan` → Kế hoạch điều trị
- `?tab=appointment` → Lịch hẹn
- `?tab=image` → Hình ảnh
- `?tab=labo` → Labo
- `?tab=prescription` → Đơn thuốc
- `?tab=care` → Chăm sóc KH
- `?tab=invoice` → Hóa đơn
- `?tab=debt-history` → Lịch sử dư nợ

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Header]                                                     │
│           │──────────────────────────────────────────────────────────── │
│           │ BREADCRUMB                                                    │
│           │ ← Quay lại  /  [PATIENT_CODE] - PATIENT_NAME                │
│           │──────────────────────────────────────────────────────────── │
│           │ TABS                                                          │
│           │ [Hồ sơ][Chẩn đoán & Tư vấn][Kế hoạch điều trị][Lịch hẹn] │
│           │ [Hình ảnh][Labo][Đơn thuốc][Chăm sóc KH][Hóa đơn]         │
│           │ [Lịch sử dư nợ]                                              │
│           │──────────────────────────────────────────────────────────── │
│           │ TAB CONTENT (varies per tab)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Breadcrumb Navigation

- Back link: "Quay lại" → `/patient?branchId=<id>`
- Separator: `/`
- Current page: `[PATIENT_CODE] - PATIENT_NAME` (patient code + full name)

## Tab List (10 tabs in order)

| # | Label (VI) | Tab Key | Status |
|---|-----------|---------|--------|
| 1 | Hồ sơ | (default) | OBSERVED |
| 2 | Chẩn đoán & Tư vấn | consulting | OBSERVED |
| 3 | Kế hoạch điều trị | treatment-plan | OBSERVED |
| 4 | Lịch hẹn | appointment | OBSERVED |
| 5 | Hình ảnh | image | OBSERVED |
| 6 | Labo | labo | OBSERVED |
| 7 | Đơn thuốc | prescription | OBSERVED |
| 8 | Chăm sóc KH | care | OBSERVED |
| 9 | Hóa đơn | invoice | OBSERVED (not implemented — "đang hoàn thiện") |
| 10 | Lịch sử dư nợ | debt-history | OBSERVED |

---

## Tab 1: Hồ sơ (Profile)

### Top card — three columns

- Left: patient code/name with edit and tag controls; date of birth + age,
  phone, email, gender, national ID, occupation, and full-width address.
- Middle: `LÝ DO ĐẾN KHÁM`, disease history, customer/national-ID information,
  and acquisition source.
- Right: `LỊCH HẸN GẦN NHẤT` with a circular create button and an empty state
  when there is no upcoming appointment.

#### Lịch hẹn gần nhất (re-measured 2026-09-06, staging)

Labels are `text-label` 14px; values are **16px/500**, and the **Bác sĩ** value
alone is `#2671D8` — a coloured `<p>`, not a link.

Under the Tiếp nhận stepper, inside the same bordered block, sits one more
control the card had been missing:

```html
<div class="mt-3 flex items-center gap-2 text-[14px]">
  <button role="combobox" aria-haspopup="listbox"
          class="h-10 rounded-lg border border-[#DCE3EE] pl-11 pr-[18px] text-[14px]">
    <!-- search glyph at left, floating "Bác sĩ" label on the border -->
    Nguyễn Trung Thông
  </button>
</div>
```

A searchable doctor select that reassigns **the shown appointment's** doctor in
place, without opening the editor. (Its list was empty on staging —
`/staff/list?isDoctor=true` answers 403 for that account.)

#### Thẻ hồ sơ on the identity card (observed 2026-09-06, staging)

The name, its pencil and every tag on the record share **one wrapping row**;
the picker button sits outside it, pinned right. Reference markup:

```html
<div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-2">
  <h1 class="min-w-0 text-[18px] font-bold uppercase text-[#2671D8]">…</h1>
  <button aria-label="Chỉnh sửa bệnh nhân">…</button>
  <!-- one chip per tag -->
</div>
```

So a first chip rides beside the name and the rest drop to a second line
(6px across, 8px down) rather than pushing the picker off the card. The picker
ticks (✓, right-aligned) every tag the record carries and toggles one per
click, saving immediately — several tags at once is normal.

`GET /api/v1/medical-record/tag/list?page=1&perPage=20&orderBy=createdAt&branchId=…`
answers **403** for the staging account, so the tag list itself could not be
read there; the chip and tick styling above come from the user's own captures
of a clinic that has tags.

#### Lý do đến khám (observed 2026-09-06, staging)

Not one note — a **dated list**. `GET /api/v1/patients/{id}` returns:

```json
"examinationReason": [
  { "id": 2, "isRoot": false, "createdAt": "<iso>", "content": "<string>", "note": null },
  { "id": 1, "isRoot": true,  "createdAt": "<iso>", "content": "<string>", "note": null }
]
```

Newest first, rendered one row per entry:

```html
<div class="mb-3 max-h-[156px] space-y-3 overflow-y-auto pr-2">
  <div class="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 text-[14px]">
    <span class="font-medium text-[#1B2A41]">06/09/2026</span>
    <span class="whitespace-pre-wrap break-words font-semibold text-[#E5484D]">…</span>
  </div>
</div>
```

Rows are inert — no hover, no cursor, no edit or delete control.

Two doors write to the list:

- The card's **+** opens "Thêm lý do đến khám": a 500px modal with one empty
  textarea (452×140, no maxlength) and **Lưu**. It opens empty even on a record
  that already has reasons, so Lưu **appends** a line.
- The **Chỉnh sửa hồ sơ** dialog's `Lý do đến khám` box shows the entry whose
  `isRoot` is true and rewrites it in place.

`isRoot` marks the first reason a record was given (id 1 in the capture above),
which is why the hồ sơ dialog and the card agree on which one it edits.

UNKNOWN_REFERENCE_BEHAVIOR — the POST behind + was not captured (production and
staging are read-only). BlueDental defines its own:
`POST /api/v1/app/patients/{id}/examination-reasons { content, note? }`.

### Financial cards

**Seven** equal cards in one row (`xl:grid-cols-7`, 12px gap, 8px radius,
0.8px `#DCE3EE` border, 12px padding): `Tổng dự kiến thu`, `Đã thu`,
`Dự kiến thu còn lại`, `Dư nợ`, `Phải thu`, `Đã hoàn`, `Tạm ứng`.

Figure colours, measured on staging 2026-09-06:

| Tile | Colour | Source field |
|------|--------|--------------|
| Tổng dự kiến thu | `#2671D8` | `patientSummary.payment.totalPrice` |
| Đã thu | `#2BB673` | `totalPaid` |
| Dự kiến thu còn lại | `#E5484D` | `totalDue` |
| Dư nợ | `#1B2A41` | `outstandingDebt` |
| Phải thu | `#E5484D` | `receivable` |
| Đã hoàn | `#F5A400` | `totalRefund` |
| Tạm ứng | `#2671D8` | `prepaid` |

### Treatment table (re-measured 2026-09-06 on staging, one surveyed record)

Filter pills: Tất cả, Điều trị hoàn tất, Đang điều trị, Các chẩn đoán,
Tái khám, Bảo hành. Actions: Tạo Tái khám and Thanh toán.

Ten columns. Header: `8px 16px`, **14px/500, sentence case**, `#5A6B82` on
`#F6F8FB`. Cell: `12px 16px`, `vertical-align: middle`, `border-right: 0.8px
solid #DCE3EE` on all but the last — a ruled grid, ~81px per row.

| # | Column | Width | Cell |
|---|--------|-------|------|
| 1 | Ngày | 140 | `font-medium text-label` |
| 2 | Dịch vụ | 150 | bold `<p>`: the `DT…` code as a `#2671D8` button (hover underline) + ` - ` + service name; under it a status chip — `h-8`, `rounded-lg`, 12px/600, bg `#EFF6FF` |
| 3 | Nội dung điều trị | 210 | the **stage's** `note`, plain text |
| 4 | Răng | 122 | chip — `rounded-md`, border `#B8D1F7`, bg blue/10, `px-2 py-1`, 12px/700, `#2671D8` |
| 5 | SL | 47 | centred |
| 6 | Bác sĩ điều trị | 200 | `staff.name`, then `Phụ tá: …` (`assistantStaff`) in `text-label` |
| 7 | Bác sĩ hỗ trợ | 200 | `subStaff`, or `Không có` |
| 8 | Công đoạn | 120 | at 0/0 a 32px round **+**, bg `#E6F8EE`, green, hover green/white |
| 9 | Chăm sóc sau điều trị | 172 | a 16px ring with an 8px dot + `care.status` — `new` prints `Chưa chăm sóc` |
| 10 | Thao tác | 88 | a 20px banknote button, `text-primary` → "Tạo phiếu thanh toán" |

Empty state: `Chưa có điều trị`.

The table is fed by `GET /api/v1/patient-timeline`, whose rows are treatment
**stages** (`type: "stage"`, `code: "STG…"`) — which is why column 3 is the
stage's note and not the service name, and why `assistantStaffId` and
`subStaffId` are two different slots.

**Rows are công đoạn, grouped by day (observed 2026-09-06, second survey).**
`GET /v1/patient-timeline?patientId&page&take&sortDirection=desc` returns rows
of `type: "stage"` — one per công đoạn, newest first. A line worked three times
is three rows, and the **Ngày** cell carries `rowSpan` so one date covers its
whole day. Each row prints its own công đoạn's note under Nội dung điều trị, its
own teeth, and its own Bác sĩ / Phụ tá / Bác sĩ hỗ trợ; Dịch vụ, Công đoạn,
Chăm sóc and Thao tác come from the line behind it.

A timeline row also carries **`disabled`**, set by the server: the newest công
đoạn of a line is `false` and every earlier one `true`. That is what greys out
the older rows inside "Chi tiết phiếu" — and **only** there. Adding a công đoạn
does not finish the ones before it: in the table every unfinished công đoạn
keeps its live **+**, and the row's status chip is the **công đoạn's** own
(`created`/`inProgress` → *Đang điều trị*, `done` → *Hoàn thành*), so three rows
of one line can read differently.

The Công đoạn cell therefore has three states, all measured on 2026-09-06:

| State | Cell |
|---|---|
| công đoạn not finished | green **+**, `size-8 rounded-full bg-[#E6F8EE] text-[#12A960]` 18px/600, hover solid green — tooltip *Thêm công đoạn* |
| finished, service carries a warranty | amber **Bảo hành**, `bg-[#FFF4E5] text-amber-600`, hover `bg-amber-500` white, briefcase-medical icon |
| finished, service carries none | grey inert `span`, `bg-[#F6F8FB] text-[#98A2B3] cursor-not-allowed` — tooltip **"Không bảo hành"** |

Re-measured on staging 2026-09-07 (patient `HN8516`, four rows), which confirmed
the first two rows above to the pixel — the amber button's icon is lucide
`briefcase-medical` at 16px and our six paths match it exactly — and turned up a
**fourth** state the clone does not model: when the *service line* reads
**"Chuyển đổi"**, the reference still draws the `+` but **disabled**
(`bg-[#F6F8FB] text-[#98A2B3] opacity-50 cursor-not-allowed`, tooltip kept).
BlueDental has no branch for it, so such a row keeps a live `+`. Recorded in
docs/clone/unknowns.md; not built.

Inside "Chi tiết phiếu" the same rule applies to the row's action: a finished
công đoạn swaps **Tạo Labo** for a green **Bảo hành**, and shows neither when
the service has no warranty period. Both buttons open the same **"Tạo bảo
hành"** dialog — laid out exactly like the stage form (Ngày tạo disabled ·
Bác sĩ · Phụ tá · Bác sĩ hỗ trợ | Dịch vụ disabled as `DT32 - Test DV` · Răng
chips · Hình ảnh · Tải Ảnh | Nội dung điều trị · Danh sách công đoạn) with
**Đóng** and **Lưu bảo hành** in the footer. It writes an ordinary công đoạn
with `isGuarantee: true`, which is how the table's Bảo hành filter finds them.

BlueDental: `TreatmentStage.IsGuarantee` (migration
`20260906180000_AddStageGuarantee`) and `TreatmentServiceDto.WarrantyDays`,
copied from the service's `CatalogServiceConfig.WarrantyDays`. The demo clinic
now seeds a warranty on five of its eight services and none on three, so both
endings are reachable.

BlueDental builds the same rows from its own two reads (the patient account plus
`GET /treatment-stages?patientId&clinicBranchId`) — see `buildTreatmentRows`. A
line with **no** công đoạn yet still gets one row, so its "+" stays reachable;
whether the reference lists one is unobserved (docs/clone/unknowns.md).

**Superseded note.** Our table used to be one row per *service line*: a line that
has not been broken into steps has no stage here, and a stage-driven table
would show nothing for it. Columns 3 and 8 therefore read the line's stages
(`stageNotes`, `stageCount`), and the status chip is the *line's* status where
the reference chips the plan's — the two agree on a one-line plan. Phụ tá and
Bác sĩ hỗ trợ are not modelled at all and always print the empty state.

### "Tạo phiếu thanh toán" (observed 2026-09-06, staging, read-only)

The row's Thao tác opens a **1024px** dialog, radius 16, title 24px/600. The
top-right **Thanh toán** button opens the *history* dialog instead — a different
thing, and the one BlueDental already had.

Left column:

- `NỘI DUNG THANH TOÁN` — `Nội dung: Thanh toán điều trị ngày dd/MM/yyyy`,
  `Ngày thanh toán: dd/MM/yyyy`
- `DỊCH VỤ` with a search icon, and `☐ Chọn Tất Cả` on its right. One row per
  service: a checkbox with the service name, its amount on the right, a
  `Còn nợ … đ` chip and `Số lượng: n`. Nothing ticked shows
  `Bạn cần chọn ít nhất 1 dịch vụ` in red.
- `TỔNG TIỀN THEO KẾ HOẠCH` — Tổng tiền / Giảm giá / Tổng tiền sau giảm /
  Đã thanh toán / **Còn lại** (bold)

Right column:

- `THÔNG TIN THANH TOÁN` — two radio cards, `Chia Tiền Tự Động` (default) /
  `Chia Tiền Thủ Công`; a `Số tiền thanh toán` box; a `Ghi chú` textarea with a
  `0/500` counter
- `PHƯƠNG THỨC THANH TOÁN` — `Tiền mặt` (default) · `Ngân hàng` · `Ví momo` ·
  `Quẹt thẻ` · `Dư nợ <số dư> đ`

Footer: `ⓘ Phiếu thanh toán chỉ có thể chỉnh sửa trong vòng 7 ngày kể từ ngày
tạo.` on the left, `💾 Lưu` on the right.

Measured detail (2026-09-06, staging):

| Part | Reference |
|------|-----------|
| Modal | 1024px, radius 16; title 24px/600 |
| Layout | `grid gap-8 lg:grid-cols-2`; the right column is `lg:sticky lg:top-0` |
| Section heading | 14px/600 **uppercase** `#1B2A41`, with a `text-primary` 16px icon (notebook-text · square-chart-gantt · dollar-sign · credit-card) |
| Fact row | `grid-cols-[150px_minmax(0,1fr)] gap-16`; label `text-label`, value left-aligned; **Còn lại** value `16px/700` |
| Dịch vụ header | heading + a `size-8` search toggle (`aria-label="Tìm dịch vụ"`) on the left, `☐ Chọn Tất Cả` on the right |
| Search | the toggle reveals a `Tìm dịch vụ` box above the list; it is not there by default |
| Service row | `flex items-start gap-4`: checkbox · (name 14px / `Còn nợ … đ` pill `rounded-full bg-[#F0F4FA] px-3 py-1 12px` / `Số lượng: n`) · amount `14px/600` on the right |
| Nothing ticked | `Bạn cần chọn ít nhất 1 dịch vụ`, 14px red, shown **immediately** — not only after a save attempt |
| Split mode | two `<input type=radio name=split-mode>` labels, 230×40, `rounded-lg border bg-white px-2`, 14px; selected border `#2671D8`; ring `size-6` / dot `size-3` |
| Số tiền thanh toán | floating-label input (label 13px/500), `inputmode="numeric"` |
| Ghi chú | floating-label textarea `min-h-16`, `maxlength=500`, `0/500` right-aligned 12px under it |
| Methods | five **pills**: `px-3 py-2 rounded-full border 12px/600 shadow-sm`, 42px tall, each with a `size-6` round icon badge. Selected: border `#2671D8`, bg `#F3F8FF`, text `#2F66E7`, badge `bg-[#2F66E7] text-white`. Unselected: border `#DCE3EE`, bg white, text `#111827`, badge `bg-[#EEF5FF] text-[#2F66E7]`. Order: Tiền mặt · Ngân hàng · **Ví momo** · Quẹt thẻ · Dư nợ, the last with the balance in `#08A652` |
| Footer | `ⓘ …` 13px amber on the left, `💾 Lưu` on the right |

Two behaviours worth naming:

- **Còn lại is a live preview.** It is `plan.totalDue − the amount being
  entered`, not the stored figure: typing 100.000 against a 409.091 remainder
  shows 309.091 straight away. `Đã thanh toán` above it stays at what is stored.
- **Chia Tiền Thủ Công** replaces the single amount box with **one row per
  ticked service** in the right column, each seeded with that line's Còn nợ.

#### The write contract, read from the reference's own bundle (2026-09-06)

No request was ever sent: the account we survey with has **no `payment`
ability at all** (`GET /v1/payment-v2` answers 403), so the dialog could not
have saved even if we had pressed Lưu. The contract below comes from the
shipped JavaScript, which rule 00 lists as safe to read.

```
BASE = /v1/payment-v2
list      GET    /v1/payment-v2                 ?status=pending,finalized
getById   GET    /v1/payment-v2/{id}
create    POST   /v1/payment-v2
update    PATCH  /v1/payment-v2/{id}
void      POST   /v1/payment-v2/{id}/void       ← the undo
finalize  POST   /v1/payment-v2/{id}/finalize
export    GET    /v1/payment-v2/export          → thanh-toan.xlsx
```

Its create is validated by this schema, verbatim:

```js
patientId:           string,   required
patientTreatmentId:  string,   required          // the slip
treatmentServiceIds: string[], min(1), required  // "Bạn cần chọn ít nhất 1 dịch vụ"
paymentMethod:       "cash" | "bank" | "momo" | "card" | "outstanding-debt", required
splitMode:           "auto" | "manual", required
amount:              number, min 0, max = maxAllowedAmount, required
maxAllowedAmount:    number, min 0, required
paymentAccountId:    required WHEN paymentMethod is "bank" or "momo"
items:               required WHEN splitMode = "manual":
                       [{ treatmentServiceId, amount (max maxAllowedAmount), maxAllowedAmount }], min(1)
```

Overpay message: *"Số tiền thanh toán không được vượt quá số tiền còn phải
thanh toán"*. The auto-mode prefill is:

```js
paymentMethod === "outstanding-debt"
  ? Math.min(Math.max(patientOutstandingDebt, 0), Math.max(selectedTotal, 0))
  : Math.max(selectedTotal, 0)
```

and a line's Còn nợ is `max(price − paid, 0)`.

**`paymentAccountId` — the field this clone was missing.** Choosing Ngân hàng
or Ví momo reveals a picker below the pills, reading
`GET /v1/payment-method/list?type=bank|momo&branchId=…`:

| Method | Columns | Empty state | Pager |
|--------|---------|-------------|-------|
| Ngân hàng | `Chọn` · `Tên ngân hàng` · `Số tài khoản` | Không có phương thức ngân hàng | Hiển thị 0 trên 0 tài khoản ngân hàng |
| Ví momo | `Chọn` · `Số điện thoại` · `Tên chủ tài khoản` | Không có phương thức MoMo | Hiển thị 0 trên 0 ví MoMo |

That is BlueDental's own `PaymentAccount` catalog (`/taxonomy/payment-method`),
so the dialog reads `GET /v1/app/payment-accounts?clinicBranchId&kind` and
`PatientPayment` gained a nullable `PaymentAccountId` (migration
`20260906120000_AddPaymentAccountOnPatientPayment`), required by the aggregate
for Banking and EWallet.

`Ví momo` is a fifth method the reference offers even though its own rollup
splits money four ways. `PaymentMethodKind.EWallet = 5` carries it, and the
clinic report gained `ByEWallet` / `RefundByEWallet` so e-wallet money cannot
fall out of the totals.

**One receipt covering several services — closed 2026-09-06.** The reference
posts **one** payment carrying `treatmentServiceIds[]` (and `items[]` in manual
mode). BlueDental used to name a single `treatmentServiceId` and post one
receipt per line: the money landed identically but the payment history showed
N rows where the reference shows one.

`PatientPayment` now owns child `PatientPaymentLine` rows — one per service,
`(treatmentServiceId, amount)` — and carries `SplitMode`
(`Auto = 1`, `Manual = 2`). The aggregate refuses a line of zero and refuses a
receipt whose lines do not add up to its total, so a per-line "Còn nợ" can
never disagree with the receipt it came from. Migration
`20260906140000_AddPatientPaymentLines` creates `bd_patient_payment_lines`,
backfills one line per existing payment that named a service, and drops
`bd_patient_payments.TreatmentServiceId`; a refund that named no service simply
has no lines.

Who splits the money follows the reference: **Tự động** sends only `amount` and
the server spreads it oldest-first, capped at what each line still owes;
**Thủ công** sends `items[]` and the server takes them as typed. Either way an
allocation past a line's outstanding is refused with the reference's own
wording, *"Số tiền thanh toán không được vượt quá số tiền còn phải thanh
toán"*. The rollup that drives each line's `paidAmount` reads the receipt's
lines, so a refund still subtracts.

Verified end to end (R-197): one two-line slip, 3.000.000 collected against
4.900.000 owed, produced a single receipt `splitMode = 1` with lines
2.400.000 + 600.000, one row in the payment history, and per-line rollups of
`paid 2.400.000 / due 0` and `paid 600.000 / due 1.900.000`.

### "Chi tiết phiếu" — công đoạn (observed 2026-09-06, staging, read-only)

The treatment row's **Công đoạn** cell opens this, not an inline editor. Modal
`calc(100vw - 32px)` (1568 at a 1600 viewport), radius 16, title 24px/600.

A tinted card (`#F7FAFF`, radius 16, padding 12, border `#DCE3EE`) holds:

- A tab strip — `#DDEBFA` on a `#C7D7EA` border, radius 8, padding 4 — with two
  36px tabs, 13px/600, radius 6: `THÊM CÔNG ĐOẠN ⟨n⟩` and
  `TIẾP TỤC CÔNG ĐOẠN ⟨n⟩`, each with an 18px round count badge. Active is white
  on `#2671D8` text. The first tab lists services with **no** công đoạn yet, the
  second those that already have one.
- On its right, `$ Thanh toán` (green outline) and `🖨 In lịch sử điều trị`.
- Four column heads, `#EAF4FF` / `#2671D8` / 14px/600 / radius 12 / `12px 16px`:
  `Chi tiết` · `Ngày - Nhân sự` · `Dịch vụ đã chọn` · `Nội dung điều trị`, over a
  `320px + 1fr` grid.
- `Chi tiết` lists one card per eligible service (name in blue, `Răng:` + tooth
  chips). Nothing selected shows the dashed
  `Chọn công đoạn ở cột chi tiết để hiển thị nội dung.`; an empty tab shows
  `Tất cả dịch vụ đã được thêm công đoạn`.
- Selecting a card reveals the form inside a card whose border turns
  `#2671D8`, `rounded-xl border p-4`, laid out
  `grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3` — three columns at 1280 and
  up, two below that with **Nội dung điều trị** spanning the pair, one on a
  phone. At a 1600 viewport the dialog is 1568 wide and each column measures
  **366px**; every control in it — the date read-out, the three comboboxes, the
  service read-out and the textarea — is exactly that wide and 40 tall (the
  textarea 127).

  | Column | Contents |
  |---|---|
  | Ngày - Nhân sự | **Ngày tạo** (*disabled*, today) · Bác sĩ · Phụ tá · Bác sĩ hỗ trợ |
  | Dịch vụ đã chọn | **Dịch vụ** (*disabled*) · `Răng:` over blue filled chips (`min-w-9 rounded-sm p-1 text-[13px]`, disabled, `opacity-70`) · `Hình ảnh:` and `(Trống)` on **two stacked lines** · full-width `Tải Ảnh` outline button |
  | Nội dung điều trị | textarea `min-h-16` rows 5, `maxlength 1000`, floating label with **no asterisk** · `Danh sách công đoạn` (14px/600) / `(Trống)` · right-aligned `Hủy` + `💾 Thêm/Tiếp tục công đoạn` (`min-w-[100px]`) |

  `Tải Ảnh` is **not** disabled: the form card carries its own hidden
  `<input type="file" accept="image/jpeg,image/jpg,image/png" multiple>`, so a
  picture can be chosen before the công đoạn exists.

#### LỊCH SỬ ĐIỀU TRỊ

Header bar white, `px-4 py-3`, title 14px/600 uppercase `#2671D8`, `n công đoạn`
muted on the right. The body scrolls inside `min-w-[1180px]`; the head is
`grid-cols-[190px_1fr_1.15fr_0.7fr_0.7fr]` on `#F6F8FB` with a right rule on
every cell but the last.

A body row is **a grid inside a grid**: the outer one is
`grid-cols-[190px_minmax(0,1fr)]` so the date cell spans **every công đoạn of
that day**, and the right half repeats `grid-cols-[1fr_1.15fr_0.7fr_0.7fr]` once
per stage.

| Cell | Contents |
|---|---|
| Ngày | date **`d/M/yyyy`** — not zero-padded — 16px/600, then `n công đoạn` 14px muted |
| Dịch vụ & răng | service 14px/500 · tooth chips (white, bordered, 12px) · then the stage's pictures as **68px** thumbnails, `rounded-lg`, with a bottom gradient caption `Ảnh điều trị` in 11px white. Clicking one opens the image viewer (rotate ×2, flip ×2, zoom ±, close, and an `n / m` counter) |
| Ghi chú | a **pencil** top-right (`lucide-pencil`, 16px, muted → `#2671D8`) over the note in an `min-h-[84px]` block with a rule under it; below, `flex gap-8`: a column of `Bác sĩ:` / `Bác sĩ hỗ trợ:` and, beside it, `Phụ tá:` — so it prints as *"Bác sĩ: X   Phụ tá: (Trống)"* over *"Bác sĩ hỗ trợ: (Trống)"* |
| Công đoạn | the stage's `stageServiceItems`; blank on staging |
| Hành động | `☐ Hoàn thành` (20px Radix checkbox), full-width `Tải ảnh` outline, full-width `Tạo Labo` solid `mt-2`. The box turns **both ways** — the reference keeps a `revert-status` beside its `status` — so un-ticking re-opens the công đoạn; only an earlier công đoạn of the line is locked |

**The pencil edits in place**, it does not open a dialog: it swaps the note for a
`rows=4 min-h-[96px] resize-none` textarea with right-aligned `Hủy` / `Lưu`
under it, and the pencil itself disappears while editing.

#### What the dialog reads

Opening it fires exactly four GETs, all scoped to the slip:

```
GET /v1/treatment-services?patientId&patientTreatmentId&status=created,inProgress,guarantee&take=50&sortBy=createdAt&sortDirection=desc
GET /v1/patient-stages?patientId&patientTreatmentId&take=50&sortBy=createdAt&sortDirection=desc
GET /v1/treatment-lines?patientId&patientTreatmentId&take=50&sortBy=createdAt&sortDirection=desc
GET /v1/patient-images?patientId&branchId&take=20&sortBy=createdAt&sortDirection=desc
```

The first explains the treatment table: **only `created`, `inProgress` and
`guarantee` lines can take a công đoạn**, which is why a finished line's Công
đoạn cell is an inert grey `briefcase-medical` chip
(`size-8 rounded-full bg-[#F6F8FB] text-[#98A2B3] cursor-not-allowed`) rather
than the live one (`bg-[#E6F8EE]`, `#12A960`, 18px/600, hover solid green).

A `patient-stages` row carries `code` (`STG24`), `treatmentServiceId`,
`serviceId`, `staffId`, `subStaffId`, `assistantStaffId`, `selectedContent[]`
(the teeth), `note`, `imageIds[]`, `totalStageCount` / `completedStageCount`,
`stageServiceItems[]`, `status`, `isGuarantee`, `hasReExamination`, `dateTime`,
a `care` block and a per-stage `payment` rollup. `treatment-lines` is the
per-service record holding `treatmentLineItems`, `sequentialStages` and
`earningByStage` — the source of `Danh sách công đoạn`.

#### The three hidden modals, and Thanh toán

| Control | What it actually does |
|---|---|
| **Thanh toán** | **Navigates**, closing the dialog: `/patient/{id}/treatment-plan/{planId}?planTab=detail`. It does *not* open a payment form. |
| **In lịch sử điều trị** | Opens a second modal, also titled *Chi tiết phiếu*: two fact blocks (`THÔNG TIN CHI NHÁNH` — Phòng khám / Địa chỉ / ĐT / Email; `THÔNG TIN KHÁCH HÀNG` — Mã KH in blue / Họ và tên), then a borderless 6-column table (`Dịch vụ` = teeth in `#165DFF` semibold over the service name · `Ngày điều trị` = date over a `#D9EEFF`/`#2671D8` status pill · `Nội dung điều trị` · `Bác sĩ` · `Phụ tá` · `Bác sĩ hỗ trợ`), and one footer button **In Phiếu**. A **hidden A4 sheet** rides along (`max-w-[794px]`, inner `min-h-[980px] px-8 py-8`): a three-column header (clinic 11px · centred `CHI TIẾT PHIẾU` 17px/700 uppercase tracking .02em + `Ngày 6 tháng 9 năm 2026` 12px · patient right-aligned), the same table at 11px, and two `w-44` signature blocks — `Người lập phiếu` / `Khách hàng`, each over `(Ký, họ tên)` and a `pt-14` name. |
| **Tạo Labo** | Opens the Labo **Đặt mới** dialog, filled from the công đoạn: `Tên khách hàng*` (`<mã KH> - <tên>`), `Kế hoạch điều trị*` (`DT32 - <dentist>`), `Dịch vụ điều trị*`, `Bác sĩ chỉ định*` — the first, second and fourth disabled — plus `Số phiếu Labo*` prefilled `LABO-202609061`, `Ngày gửi*`/`Giờ gửi*` set to now, `Nhà cung cấp*`, `Ngày nhận dự kiến*`/`Giờ nhận*`, a `Lựa chọn dịch vụ*` chip list feeding `Vật liệu*` (empty until one is picked: *"Chọn dịch vụ trước"*), `Răng:*` with `Chọn tất cả`, then `Màu răng` / `Đường hoàn tất`, `Số lượng*` / `Kiểu nhịp`, `Khớp cắn`, `Nội dung`, `Tải ảnh` and a footer `Lưu`. |
| **Tải ảnh** (row) and **Tải Ảnh** (form) | Both open the OS file chooser — each sits beside its own hidden multiple-file input. |

#### The stage write contract, from the same bundle

```
BASE = /v1/patient-stages
list                    GET  /v1/patient-stages
getById                 GET  /v1/patient-stages/{id}
create                  POST /v1/patient-stages                        "Tạo công đoạn thành công"
update                  PUT  /v1/patient-stages/{id}
continue                POST /v1/patient-stages/{id}/continue          "Tiếp tục công đoạn thành công"
createReExamination     POST /v1/patient-stages/{id}/re-examination
updateStatus            PUT  /v1/patient-stages/{id}/status            ← Hoàn thành
revertStatus            PUT  /v1/patient-stages/{id}/revert-status
updateStageServiceItems PUT  /v1/patient-stages/{id}/stage-service-items
```

The surveyed account's abilities list `treatmentStage: read, create, update,
**continue**, **complete**, print` — so the two tabs really are two operations,
and there is **no delete**: a công đoạn created on staging could not have been
undone, which is why none was.

Create payload (Thêm công đoạn):

```js
patientId, treatmentServiceId*, serviceId*, staffId*,      // * required
subStaffId,          // ← the form's "Phụ tá"
assistantStaffId,    // ← the form's "Bác sĩ hỗ trợ"
selectedContent[],   // teeth, min 1, required
note,                // "Nội dung điều trị", required, max 1000
imageIds[], dateTime, stageServiceItems: [{ stageServiceId }], isGuarantee
```

Continue takes the same body against `{stageId}`, minus `serviceId`. Note the
naming: the reference's *Phụ tá* is `subStaffId` and its *Bác sĩ hỗ trợ* is
`assistantStaffId` — the opposite of what the words suggest.

Three rules this clone had wrong and now enforces: **doctor, teeth and the
treatment note are all required**, and the note is capped at 1000.

`Danh sách công đoạn` is a checklist of the *service catalog's* own công đoạn
(`stageServiceItems`); it read `(Trống)` on staging because the surveyed
service has no stages in its catalog entry.

**Closed 2026-09-06 (second survey)** — what the first pass left short:

- The form's controls now fill their column, and the card lays out three / two /
  one across the reference's own breakpoints.
- `Tải Ảnh` in the form is **live**: the pictures are held and attached to the
  công đoạn the moment it is saved, which is what the reference's in-form file
  input implies.
- `Phụ tá` and `Bác sĩ hỗ trợ` are **stored**. `TreatmentStage.SecondStaffId`
  is Bác sĩ hỗ trợ (reference `assistantStaffId`) and the new
  `TreatmentStage.SubStaffId` is Phụ tá (reference `subStaffId`); migration
  `20260906160000_AddStageSubStaff`. The history row and the printed sheet read
  both names back.
- The history is grouped by day with a spanning date cell, prints `d/M/yyyy`,
  and shows each công đoạn's pictures as 68px thumbnails that open a viewer.
- The note's pencil edits in place through `PUT /treatment-stages/{id}`.
- `Thanh toán` navigates instead of stacking the payment form — to **that
  slip's** detail screen, `/patient/{id}/treatment-plan/{planId}?planTab=detail&branchId=`,
  re-measured on the reference 2026-09-07. (It used to land on the patient's
  `?tab=treatment-plan` list here, which was wrong: that is the listing of every
  slip, not the one the clicked row belongs to.) The DT code chip on the Kế
  hoạch điều trị tab is the contrasting case — it goes to the same page with
  **no** `planTab`, letting it fall back to Chi tiết, so `planDetailPath` takes
  the tab as an optional argument rather than always writing it.
- `In lịch sử điều trị` opens the print modal plus its hidden A4 sheet.
- `Tạo Labo` opens the Labo **Đặt mới** dialog in place. `LaboOrder` gained
  `ToothShade`, `Quantity`, `TreatmentServiceId` and `TreatmentStageId`
  (migration `20260906170000_AddLaboOrderTreatmentLink`), and
  `GET /v1/app/labo-orders/next-code` allocates `LABO-yyyyMMddN` per branch.

**Still divergent**, recorded in docs/clone/unknowns.md:

- `Danh sách công đoạn` reads `(Trống)`: it is the *service catalog's* own
  checklist (`stageServiceItems` / `treatmentLineItems`), which BlueDental does
  not model. The history's Công đoạn column prints the stage's own name instead
  of that checklist.
- The Labo form's `Giờ nhận` is collected but not stored — `LaboOrder.DueDate`
  is a date.
- `Tải ảnh` and `Chọn tất cả` on that form **are** built (an earlier note here
  said they were not). The tile is the reference's 80×80 dashed square and its
  input is `accept="image/*" multiple`, matching the reference. What the
  reference *draws* for a chosen-but-unsaved picture stays unobserved — see
  docs/clone/unknowns.md.
- The chip strips' **magnifier**, which opens the reference's "Tìm dịch vụ"
  popover (Tab 6 table below), is not built: the strips list every option
  instead of offering a search.
- Primary buttons are BlueDental indigo (`--bd-primary #6366f1`), not the
  reference's blue `#2671D8`. That is the clone's own brand, applied
  app-wide.

---

## Tab 2: Chẩn đoán & Tư vấn (Diagnosis & Consulting)

URL: `?tab=consulting`
Status: OBSERVED

### Default layout — two-column split

- Left: fixed-width image drop/gallery area with zoom/grid/list controls.
- Right: `Tạo chẩn đoán` card. The diagnosis editor is collapsed by default;
  its plus button reveals the doctor fields, tooth chart, diagnosis and note
  controls. The diagnosis records table remains below the header.
- Full width below: `Phiếu tư vấn`, summary totals, doctor selector, and plan /
  quotation / print actions.

**Tiếp nhận (observed 2026-09-06).** The three steps are `<button>`s in a
`grid-cols-3`, each a connector line either side of a `size-8` numbered circle
over a 12px/600 label and a 12px time that reads `--:--` until the step is
taken. Only the **next** one is enabled; the other two carry `disabled` and
`cursor-not-allowed`, so reception cannot skip ahead or walk back. BlueDental
posts `check-in` → `start` → `complete` on the appointment, which is where the
times come from.

**Tạo Tái khám (observed 2026-09-06).** Three column heads — Ngày - Nhân sự ·
Dịch vụ đã hoàn tất · Nội dung điều trị — over one row per **finished** công
đoạn; with none it prints *"Chưa có dịch vụ hoàn tất"*. A row carries the date
with Bác sĩ / Phụ tá, the service and its teeth, the note and Danh sách công
đoạn, and beside them a ticked read-only **Hoàn thành**, a disabled **Tải Ảnh**,
**Tái Khám** and **Chi Tiết**.

**What those two buttons open (observed 2026-09-07).** They are two different
dialogs, not the stage dialog:

- **Tái Khám** → the follow-up form. Its teeth are the source công đoạn's,
  offered as toggles with **none ticked** — the reference keeps `content` (the
  source's teeth, for display) apart from `selectedContent` (what the user
  ticked), and only the second reaches the row. Chosen pictures list as
  thumbnails, each with its own remove, under a count label ("2 ảnh").
- **Chi Tiết** → "Chi tiết dịch vụ", read-only, 772px wide, four blocks, footer
  **Đóng** only.

**A saved tái khám is a row of its own.** The reference's timeline returns
`type: "re_examination"` beside `type: "stage"`, so the row sits in the treatment
table under its own code `REX001` with a **Tái khám** chip, and its **Công đoạn**
and **Chăm sóc sau điều trị** cells are left **empty** — it is not another công
đoạn on the line, and it prints no Phụ tá line. `SL` comes from the service line
the source stage belongs to. The source stage flips `hasReExamination`. Payload
and endpoint in `docs/clone/api.md`; the model correction is R-267.

**"Danh sách công đoạn" — measured 2026-09-07.** A service declares its own
steps in Danh mục (`service.stages[]` = `{ id, name, value, valueType }`; the
one surveyed had `công d1` at 100.000 fixed and `2` at 20 percent). Those steps
appear twice on this screen:

- **On the công đoạn form**, as checkboxes under "Danh sách công đoạn" — which
  steps this công đoạn will cover. Every box opens **unticked**. A service that
  declares none prints `(Trống)`.
- **In the treatment history row's Công đoạn column**, as the same checkboxes,
  now ticking those steps off as they are done. Toggling one saves immediately
  and toasts **"Cập nhật thành công"** (failure: "Không thể cập nhật công đoạn").

The markup is a `space-y-3` list, each row a `<label>` at `flex items-center
gap-3` / 14px with a **20px** checkbox, `4px` radius, `slate-400` border,
filling `#2671D8` with a white glyph when ticked.

A công đoạn carries them as `stageServiceItems[]` =
`{ stageServiceId, isCompleted, completedAt, staffId }` — so the tick records
**who** and **when**. Ticking again keeps the first stamp; unticking clears both.

Endpoint: `PUT /v1/patient-stages/{id}/stage-service-items`, mirrored locally as
`PUT api/v1/app/treatment-stages/{id}/service-items`. Its payload is the **whole**
list, not the one step that moved, which is what lets one call both tick and
untick — see docs/clone/unknowns.md, the body itself was not observable.

Names are never copied onto the công đoạn: it stores ids and the name is read
from `CatalogServiceStage`, so renaming a step in Danh mục shows through
everywhere at once.

**The tái khám screens mean something else by that heading — measured
2026-09-07 off the reference bundle.** "Tạo tái khám" does **not** show the
service's steps. Its row mapper synthesises at most one entry out of the
finished công đoạn's own Nội dung điều trị:

```js
// chunk 0568b3ed70779de1.js, the l6 row mapper
a = l5(e.content)            // trimmed; a lone "—" counts as blank
stageChecklist: a ? [{ id: `${e.id}-re-examination-stage`, label: a, checked: !1 }] : []
```

So the label is the **note**, never a step name, and there is never more than
one. It renders in two places, differently:

| Where | Ticked | Enabled | Label |
|---|---|---|---|
| The listing row behind "Tạo Tái khám" | never | **disabled** | `font-semibold text-primary` — #2671D8 at weight 600 |
| The form behind that row's `Tái Khám` | starts unticked | **tickable** | plain |

An empty list prints `<p class="text-label">(Trống)</p>`. The form keeps the
source công đoạn's label even though its own Nội dung điều trị starts blank,
because the item is cloned from the listing row rather than rebuilt.

"Tạo bảo hành" takes the other branch of the same mapper, which sets
`stageChecklist: []` and `treatmentContent: ""` outright — so a warranty visit
always reads `(Trống)`.

BlueDental builds this in `stage/reExaminationChecklist.ts` and renders it
through the shared `StageStepList` (`tone="accent"` for the read-only listing).
Whether ticking the box on the form sends anything is **unobserved** — see
docs/clone/unknowns.md.

**Not built:** each step also carries a commission (`earningByStage`,
`earningAmount`, and the step's `value`/`valueType`), and the reference's tick
invalidates its payment queries — so a tick moves the doctor's pay. That reaches
payroll and is out of scope here; recorded in unknowns.md.

**Status chips — measured 2026-09-07, two different sets.** A row of the
treatment table carries **its own** status, not the line's: the timeline returns
`status` per row (`created`, `done`, `replaced` observed), and two rows of one
line were seen reading "Hoàn thành" and "Đang điều trị" at once. Note the
wording: a `created` row reads **"Đang điều trị"**, not "Chưa điều trị", and
`replaced` reads **"Chuyển đổi"**, not "Đã thay thế".

| | Table chip — 32px, radius 8px, 12px/600 | Print pill — 26px, radius 9999px, 12px/500 |
|---|---|---|
| Đang điều trị | `#EFF6FF` on `#1D4ED8` | `#D9EEFF` on `#2671D8` |
| Hoàn thành | `#E7F8EF` on `#12A960` | `#DDF6E8` on `#10A861` |
| Chuyển đổi | `#E6F8FB` on `#1A606B` | not observed — see unknowns.md |

The two sets are **deliberately different**, in tint and in shape; the reference
does not reuse the table's colours on the sheet. These are the reference's own
values, not the app's `--bd-*` palette, so they stay as literals.

**The printed sheet.** "In lịch sử điều trị" holds an off-screen A4 copy —
`max-width: 794px` centred (A4 at 96dpi), `min-height: 980px`, 32px padding —
with a three-column head (`minmax(0,1fr) auto minmax(0,1fr)`): clinic facts left
at 11px, the centred `CHI TIẾT PHIẾU` at 17px/700 with "Ngày D tháng M năm YYYY"
at 12px under it, and Mã KH / Họ và tên right-aligned. Then the six-column table
(Dịch vụ · Ngày điều trị · Nội dung điều trị · Bác sĩ · Phụ tá · Bác sĩ hỗ trợ,
rows ruled `#DCE3EE`, `align-top`), then two `w-44` signature blocks centred with
a 64px gap: role in semibold, *(Ký, họ tên)* italic, and the name 56px below.

That sheet must be portaled to `document.body`, **not** left inside the modal:
AntD renders the modal into a portal wrapper of its own, and a print rule that
hides the body's other children hides that wrapper too — a descendant cannot
un-hide itself past a `display: none` ancestor, which is why printing from
inside the modal produced a blank preview (R-277).

**Accents inside these dialogs follow the clone's primary, on purpose.** The
project owner asked on 2026-09-07 that every chip, floating label and focus ring
in "Đặt mới" and the công đoạn/tái khám dialogs take `--bd-primary` (indigo
`#6366f1`) rather than the reference's `#2671D8`: a modal mixing reference-blue
chips with an indigo Lưu button reads as two accents. This is a **deliberate
divergence** from the reference — do not "fix" it back (R-268).

### Expanded diagnosis editor (hidden state)
- Header text: "Bác sĩ có trách nhiệm thông báo / Những vấn đề răng miệng đang gặp phải – Hiểu về tiến trình của bệnh lý"
- "Đóng" button (collapse panel)

**Diagnosis form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Bác sĩ chẩn đoán 1* | Combobox | Required |
| "Thêm bác sĩ chẩn đoán" | Button | Add second diagnosing doctor |
| Chẩn đoán 2 | Combobox | Optional; "Tắt Chẩn đoán 2" toggle button |

**Dental Chart (Sơ đồ răng) — interactive tooth selector:**

Chart view tabs (4):
- "Chọn Răng" (default) — select individual teeth
- "Hàm Trên" — upper jaw
- "Hàm Dưới" — lower jaw
- "Nguyên Hàm" — full jaw

Tooth type radio:
- "Răng vĩnh viễn" (Permanent teeth) — default selected
- "Răng sữa" (Baby teeth)

Tooth layout: FDI numbering system
- Upper jaw: 18, 17, 16, 15, 14, 13, 12, 11 (left half) | 21, 22, 23, 24, 25, 26, 27, 28 (right half)
- Lower jaw: 48, 47, 46, 45, 44, 43, 42, 41 (left half) | 31, 32, 33, 34, 35, 36, 37, 38 (right half)

Each tooth has:
- Tooth button (clickable) with type label ("Răng hàm" / "Răng trước") and FDI number
- 5 surface buttons around each tooth (mesial, distal, buccal, lingual, occlusal surfaces)

**Diagnosis service form (below chart):**

| Field | Type | Required |
|-------|------|----------|
| Chẩn đoán* | Combobox | Yes |
| Ghi chú | Textbox | No |
| Răng đã chọn | Display | Shows selected teeth or "Chưa chọn răng" |

Action buttons (disabled until form filled):
- "Thêm chẩn đoán"
- "Tạo dịch vụ"
- "Lưu Chẩn Đoán"

**Right column — Diagnosis records table (Phiếu chẩn đoán)**

Table columns (6):

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | Số phiếu | Diagnosis slip no. | e.g. "CD01" |
| 2 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 | Doctor name + date |
| 3 | Chẩn đoán 2 | Diagnosis 2 | Doctor name + date (or "Chưa cập nhật") |
| 4 | Răng | Tooth(teeth) | e.g. "Nguyên hàm" + diagnosis label |
| 5 | Ghi chú | Notes | Free text |
| 6 | Thao tác | Actions | "Tạo Dịch Vụ" + edit + "Xoá" |

Pagination: 20/page default; "Hiển thị 1 trên 1 chẩn đoán"

---

**Section 2: Phiếu tư vấn (Consultation slips)**

Header: "Phiếu tư vấn" button + description text:
"Bác sĩ đưa ra các phương pháp can thiệp điều trị. Từ tốt nhất để phù hợp nhất với từng vấn đề đang gặp phải"

Toolbar: "Cột hiển thị" (column visibility toggle)

Consultation table columns (14):

| # | Column (VI) | English | Notes |
|---|------------|---------|-------|
| 1 | (expand) | Row expand | Toggle details |
| 2 | (checkbox) | Select | Multi-select |
| 3 | Ngày | Date | DD/MM/YYYY |
| 4 | Dịch vụ | Service | Service name |
| 5 | Chẩn đoán | Diagnosis | Tooth + diagnosis; notes in parentheses button |
| 6 | Nhân sự tư vấn 1 | Counselor 1 | Staff name |
| 7 | Nhân sự tư vấn 2 | Counselor 2 | "-" if none |
| 8 | Bác sĩ chẩn đoán 1 | Diagnosing doctor 1 | |
| 9 | Chẩn đoán 2 | Diagnosis 2 | "-" if none |
| 10 | Số lượng | Quantity | Integer |
| 11 | Đơn giá | Unit price | VND |
| 12 | Giảm giá | Discount | VND |
| 13 | Thành tiền | Total | VND |
| 14 | Ghi chú tư vấn | Consultation notes | "---" if empty |
| 15 | Thao tác | Actions | "Xoá" |

Pagination: 20/page default; "Hiển thị 1 trên 1 dịch vụ"

**Summary bar (bottom):**
- "TỔNG KẾ HOẠCH"
- "Tổng thành tiền: 0 đ"
- "Tổng tiền: 0 đ"
- "Chọn bác sĩ điều trị" combobox
- Buttons: "Thêm kế hoạch điều trị", "Tạo báo giá", third button (disabled)

---

## Tab 3: Kế hoạch điều trị (Treatment Plan)

URL: `?tab=treatment-plan`
Status: OBSERVED (re-surveyed 2026-09-07 on staging, one patient with three
slips; captures in `reference-private/treatment-plan-tab/`)

> The slip code link, the items in the two summary cards and the ≤640 card head
> open **Chi tiết kế hoạch điều trị** — `/patient/:id/treatment-plan/:planId`,
> documented in `treatment-plan-detail.md` (built 2026-09-07, F-39).

### Toolbar (top-right, 2 buttons)

| Button | Notes |
|--------|-------|
| `+ Tạo kế hoạch mới` | primary, opens **"Tạo phiếu dịch vụ"** (below) |
| `👁 Xem tất cả dịch vụ` | outlined, opens **"Danh sách dịch vụ"** — every service line of every slip |

### Summary widgets (2 cards above table)

Each card: tinted round icon chip, UPPERCASE title, a 2-column grid of items
(`grid grid-cols-2 content-start gap-2`), and the count as a red round badge on
the far right.

Item (measured on staging 2026-09-07, both cards share it): flex row,
`items-center gap-2`, `rounded-lg` (8px), `border #DCE3EE`, `px-3 py-2`,
57.5px tall, `cursor-pointer`, hover `bg #F6F8FB`. Text block `min-w-0 flex-1`
then a lucide `chevron-right` 16px in `text-label` (#5A6B82).

- line 1: service name, 13px / 600 / #1B2A41, single line, ellipsis.
- line 2 (`mt-0.5 flex items-center gap-1.5`, 12px):
  - **DỊCH VỤ ĐANG ĐIỀU TRỊ** — slip code 500 blue, then the slip date in
    11px `text-label`; badge = count of lines in treatment.
  - **DỊCH VỤ CÓ CÔNG ĐOẠN GẦN NHẤT** — slip code 600 blue (`hover:underline`),
    then the latest stage note, ellipsised.

Clicking an item navigates to
`/patient/:id/treatment-plan/:planId` (the plan-detail page — deferred, see
unknowns), so BlueDental keeps the pointer cursor and the hover tint but no
navigation, the same treatment as the DT code link.

`/patient-treatments/summary` answered `{ active: [], recent: [] }` on every
surveyed record, so BlueDental derives both cards from the slip list (see
unknowns).

### Treatment Plan Table

`Cột hiển thị` (right-aligned above the table) opens the **"Cấu hình cột"**
popover: one switch per column, drag handle to reorder, `Lưu`. The layout is
kept in memory only — a reload restores the default.

Columns, default order. "Thêm công đoạn" and "Thao tác" are pinned to the
edges and are not in the popover.

| # | Column | Cell |
|---|--------|------|
| 1 | Thêm công đoạn | `+` icon button → "Chi tiết phiếu" (công đoạn dialog, see Tab 1) |
| 2 | Số phiếu | `DT<n>`, link-styled (the reference navigates to `/patient/{id}/treatment-plan/{planId}` — not built yet) |
| 3 | *(no header)* | eye icon → **"Danh sách dịch vụ - DT<n>"** modal |
| 4 | Bác sĩ tiếp nhận | staff name |
| 5 | Trạng thái - Tiến độ | pill: `Đã tạo` (grey) · `Đang điều trị` (blue) · `Hoàn thành` (green) · `Huỷ phiếu` (red) |
| 6 | Ngày tạo | `DD/MM/YYYY` |
| 7–13 | Tổng phiếu · Giảm giá · Thành tiền · Đã trả · Hoàn tiền · Còn lại · Phải thu | right-aligned, every cell carries the unit: `4.000.000 đ`, `0 đ` |
| 14 | Thao tác | `In bệnh án` (clipboard icon, no action wired) · `Phiếu thu` (receipt icon → the invoice modal for the slip) |

Reference pager: `[20 / trang] Hiển thị 1–3 trên 3 kế hoạch … [‹ Trước][1][Sau ›]`
(outlined 32px buttons). **BlueDental uses the app's shared pager instead**
(`useTablePagination`: `20 / trang`, `Hiển thị 1-3/3`, antd prev/next) — the
owner's rule of 2026-09-07 is one pager for the whole app.

### "Tạo phiếu dịch vụ" (Tạo kế hoạch mới — observed on staging, form filled, never saved)

Modal ≈ 1024px, title left, `×` right, `Lưu` in the header row.

| Field | Notes |
|-------|-------|
| Người tạo | read-only chip with the signed-in staff |
| Thêm dịch vụ mới* | the voucher dialog's "Tìm dịch vụ hoặc nhóm dịch vụ" picker: type to search, a swap icon toggles service ↔ group mode; a group row opens the group, a service row is the value |
| Đơn giá / Số lượng | price prefilled from the service; quantity ≥ 1 |
| Giảm giá | amount with a `%` / `đ` toggle |
| Bác sĩ chẩn đoán 1* / Chẩn đoán 2* | floating-label selects |
| Răng | `Chọn răng` button → **"Chọn răng"** dialog; the pick renders as `Răng: 14, 21` (or `Hàm trên` / `Hàm dưới` / `Toàn hàm`) |
| Tình trạng răng | mirrors the chosen diagnosis |
| Ghi chú | textarea |
| Thông tin thanh toán | `Tổng cộng` · `Giảm giá` · `Thành tiền`, recomputed as the fields change |

Saving creates the slip and one service line; the tab lists it as `Đã tạo`.

### "Chọn răng" dialog

Tab strip `Răng` · `Hàm trên` · `Hàm dưới` · `Toàn hàm`; under `Răng` a radio
pair `Răng vĩnh viễn` / `Răng sữa` and the FDI chart: 32 permanent (or 20
deciduous) teeth in four quadrants split by hairlines, each with a five-surface
circle (top/right/bottom/left wedges + occlusal centre). Clicking a number
selects the tooth; clicking a wedge selects that surface. A jaw tab hides the
chart and stands for the whole jaw. Footer `Chọn răng`. Switching dentition
clears the picks.

### Secondary modals

- **Danh sách dịch vụ - DT<n>** (eye): the slip's lines — teeth above the
  service name, dentist, status pill, quantity, price, discount, amount, and
  the same shared pager.
- **Danh sách dịch vụ** (`Xem tất cả dịch vụ`): the same table over every slip,
  with the slip code in front of each line.
- **Chi tiết phiếu** (`+`): the công đoạn dialog documented under Tab 1.
- **Hóa đơn** (`Phiếu thu`): the existing invoice modal for the slip (it shows
  the service lines, not the slip code).

### Responsive (BlueDental)

At 640px and below the table and both service lists fold into the
"Thêm đơn thuốc" record cards (`RecordCard`): code + pill in the head, the
first rows visible, `Xem thêm` / `Rút gọn` for the money rows, the four row
actions as card buttons, and the same pager under the list. The create dialog
and the tooth chart go single-column. The reference's own <769px pager is a
two-row strip; BlueDental keeps the shared pager here too.

---

## Tab 4: Lịch hẹn (Appointments)

URL: `?tab=appointment`
Screenshot: reference-private/survey/patient-detail-appointment.png

### Counter Cards (4 cards, top of tab)

| Card | Vietnamese | Value observed |
|------|-----------|----------------|
| 1 | Đã hẹn | 0 |
| 2 | Đã đến | 0 |
| 3 | Đã huỷ | 0 |
| 4 | Trễ hẹn | 0 |

### Toolbar Buttons (top right)

| Button | Style | Notes |
|--------|-------|-------|
| Lịch sử thay đổi | Secondary/outline | View change history |
| Tạo lịch hẹn mới | Primary blue | Opens the **Tạo lịch hẹn** dialog — see survey pass 2026-08-28 (2), §2 |

### Table Columns (6 columns)

| # | Column Header (VI) | Notes |
|---|-------------------|-------|
| 1 | Ngày/ Giờ | Date + time of appointment |
| 2 | Bác sĩ phụ trách | Assigned doctor |
| 3 | Nội dung | Appointment content/purpose |
| 4 | Ghi chú | Notes |
| 5 | Trạng thái | Status badge |
| 6 | Thao tác | Pencil (opens **Cập nhật lịch hẹn**) and a red trash (confirm) — see survey pass 2026-09-05 |

Empty state: "Không có dữ liệu"

### Pagination

Options: 5, 10, 20 (default), 25, 50, 100 per page
Text: "Hiển thị 0 trên 0 lịch hẹn"

---

## Tab 5: Hình ảnh (Images)

URL: `?tab=image`
Screenshot: reference-private/survey/patient-detail-image.png

Đo lại **2026-09-05** trên staging, hồ sơ có 3 ảnh cùng một ngày. Nguồn: DOM +
computed styles + bundle client (module `patient-images`). Chỉ thao tác không
ghi: mở dropdown, chọn lọc, bấm "Xóa lọc", mở overlay xem ảnh, bấm "Tải ảnh"
để xem nó mở gì (không chọn file). **Không kéo, không xoá, không tải.**

### Toolbar

`section` bo **16px**, viền `#DCE3EE`, nền trắng, đệm **8px**, rộng theo nội
dung (`w-fit`, 368×44 phần trong). Các control cách nhau **12px**:

| Control | Kích thước | Ghi chú |
|---|---|---|
| Select **Giai đoạn điều trị** (floating label) | 230×40, bo 8px, viền `#DCE3EE`, chữ 14px, chevron 16px | Nhãn nằm trong ô khi rỗng, nổi lên viền (`#5A6B82`/80, 500) khi có giá trị. Đúng **2** lựa chọn: `Trước điều trị` (`before`), `Sau điều trị` (`after`). **Không có giá trị mặc định** — mở tab là "tất cả". |
| Nút **Xóa lọc** (`aria-label`) | 40×40, bo 12px, viền `#DCE3EE`, nền trong suốt, icon lucide `x` 16px, chữ `#1B2A41` | **Chỉ hiện khi đã chọn** một giai đoạn. Bấm → về "tất cả". |
| Nút **Tải ảnh** | 126×44, bo 12px, viền **đứt** `#B9C4D4`, chữ `#2671D8` 14px/500, icon lucide `image-plus` 28px, hover nền `#E7F0FB` | Chỉ hiện với quyền `treatmentImage.create`. Bấm → mở **hộp chọn file của hệ điều hành** ngay (`accept=image/jpeg,image/jpg,image/png`, `multiple`), không có dialog trung gian. Khi đang xử lý: chữ đổi "Đang tải", disabled. |

Bộ lọc **không** ghi vào URL. Chọn giai đoạn → gọi lại API có `&type=`; "Xóa
lọc" → về query không `type` (không gọi lại nếu cache còn).

### Dữ liệu

```
GET /api/v1/patient-images?patientId=<id>&take=25&page=1[&type=before|after]
```

- Infinite scroll: sentinel 16px cuối danh sách, "Đang tải thêm…" khi tải trang sau.
- Ảnh gộp theo **ngày** của `createdAt` (`YYYY-MM-DD`), ngày mới nhất trên cùng.
  Trong ngày giữ **thứ tự API trả** (API trả `ordering` 1, 2, 3 tăng dần).
- Client lọc thêm một lần nữa theo `type`; `type` khác `before`/`after` xếp
  vào `other` ("Khác").
- Có lớp phủ loading (spinner) khi đang fetch / tải / sắp xếp / xoá. Khi rỗng
  mà đang tải: ô rỗng in "Đang tải dữ liệu…".

### Timeline theo ngày

Khối ngoài `space-y-5 relative`, có **đường dọc 1px** `#D6E6F7` chạy suốt
chiều cao tại **left 133px** (mobile: 19px). Mỗi ngày là `section` grid
`190px | 1fr`, gap **24px**:

| Phần | Bản gốc |
|---|---|
| Cột trái | rộng 134px, cao tối thiểu 48px, `position: relative` |
| Nhãn ngày | nền `#BFC3CB`, chữ trắng **14px/500**, đệm `2px 4px`, đặt `left: 28px`, canh giữa dọc; đuôi mũi tên là ô vuông **18px** xoay 45° cùng màu, `right: -8px`, `z-index: -1` |
| Chấm | tròn **20px**, viền trắng 2px, nền `#D6E6F7`, bóng nhẹ, tại `right: -9px` (đè lên đường dọc); trong là chấm **16px** `#3E8AD8` |
| Số ảnh | `p` 14px `#5A6B82`, `padding: 0 0 8px 24px`, `max-width 120px`: "N ảnh" |
| Cột phải | hàng thẻ **ngang** `flex gap-4 overflow-x-auto`, bo **24px**, viền `#DCE3EE`, nền `#F8FBFF`, đệm `16px 16px 20px`, scrollbar mỏng; đây là vùng thả (droppable, `direction: horizontal`) |

### Thẻ ảnh (`article`)

| Phần | Bản gốc |
|---|---|
| Thẻ | **280px**, không co, `flex-col gap-3`, bo **22px**, viền `#DCE3EE`, nền trắng, đệm **12px**, bóng `0 10px 24px rgba(15,23,42,.05)`; đang kéo: viền `#2671D8`, bóng `0 18px 36px rgba(38,113,216,.16)` |
| Ảnh | nút `aria-label="Xem ảnh <tên file>"` bọc `img` tỉ lệ **4:3**, rộng hết thẻ (254×190), `object-cover`, bo **18px**, hover `scale(1.01)` |
| Tên file | 14px/600 `#1B2A41`, 1 dòng (`line-clamp-1`) |
| Thời gian | 12px `#5A6B82`, `dd/MM/yyyy HH:mm` (theo `createdAt`) |
| Hàng nút | căn phải, gap 8px, `margin-top: auto`. Ba nút tròn **36px**: kéo (`grip-vertical`, viền `#DCE3EE`, nền trắng, chữ `#5A6B82`, hover nền `#F6F8FB` chữ `#1B2A41`), xem (`eye`, viền `#DCE3EE`, chữ `#2671D8`, hover chữ `#1E5BB0`), xoá (`trash-2`, nền `#FFF1F1`, chữ `#E5484D`, hover nền `#FFE2E2`, không viền). Icon 16px. |
| Tooltip | "Sắp xếp ảnh" / "Xem ảnh" / "Xóa ảnh" |

Nút kéo chỉ hiện với quyền `treatmentImage.update`, nút xoá với
`treatmentImage.delete`.

### Hành động

- **Xem** (nút mắt hoặc bấm ảnh): overlay lightGallery toàn màn hình, nền đen.
  Toolbar phải: Vẽ chú thích · Xoay phải · Xoay trái · Lật ngang · Lật dọc ·
  Zoom xa · Zoom gần · Đóng; mũi tên "Ảnh trước"/"Ảnh sau" hai bên; tên file
  dưới ảnh; đếm "1 / N"; dải thumbnail **160×96** cách 10px ở đáy, thumb đang
  xem viền xanh. Danh sách trong overlay = **mọi ảnh đang hiển thị (mọi ngày)**,
  mở tại ảnh được bấm. Esc đóng.
- **Kéo sắp xếp**: react-beautiful-dnd, kéo ngang **trong cùng một ngày**
  (thả sang ngày khác bị bỏ qua). Thả → `PUT /api/v1/patient-images/reorder`
  body `{ id, ordering: <vị trí đích, tính từ 1> }`, xong invalidate danh sách.
  Không kéo trên bản gốc — server xếp lại các ảnh còn lại thế nào là
  UNKNOWN_REFERENCE_BEHAVIOR (xem `unknowns.md`).
- **Xoá**: modal xác nhận, tiêu đề "Xác nhận xoá ảnh", nội dung "Bạn có chắc
  muốn xoá ảnh này không?", `DELETE /api/v1/patient-images/{id}`, toast
  "Đã xoá ảnh" / lỗi "Không thể xoá ảnh". Không bấm trên bản gốc.
- **Tải ảnh**: lọc `image/*`; tối đa **10 file/lần** (nhiều hơn → toast lỗi
  nhưng vẫn tải 10 file đầu); client **resize** về tối đa 1600×1600, giới hạn
  5 MB; `type` gửi lên = giai đoạn đang lọc, chưa lọc → `before`; tải **tuần
  tự** từng file `POST /api/v1/patient-images/upload` (multipart `patientId`,
  `type`, `file`, tuỳ chọn `note`, `ordering`); lỗi → toast "Không thể tải ảnh".

### Rỗng

Khung bo **28px**, viền **đứt** `#D6E6F7`, nền `#F8FBFF`, đệm `64px 24px`, canh
giữa: "Không có ảnh trong bộ lọc đã chọn" (15px/600 `#1B2A41`) và "Hãy đổi bộ
lọc hoặc tải thêm ảnh để tiếp tục." (13px `#5A6B82`, cách 4px). Không có icon.
Khung **không** kéo dài hết màn hình — chiều cao theo nội dung.

---

## Tab 6: Labo

URL: `?tab=labo`
API: `GET /api/v1/clinic-orders?patientId=...&branchId=...&page=1&perPage=20&orderBy=createdAt:desc[&statusClinic=created|continue|guarantee]`
Status API: `GET /api/v1/clinic-order-status?patientId=...&branchId=...`

Surveyed again on staging 2026-09-05 with a patient that has two orders (a
"Đặt mới" parent and a "Làm tiếp công đoạn" child). Everything below is
read-only observation; no form was saved. Screenshots (patient data, never
committed): `reference-private/labo/ref-labo-*.png`.

### Counter Buttons (3, top-left — toggle filters)

| Label (VI) | API field | `statusClinic` filter | Color |
|-----------|-----------|-----------------------|-------|
| {N} Đơn hàng mới | `created` | `created` | Green |
| {N} Tiếp tục công đoạn | `continue` | `continue` | Amber |
| {N} Bảo hành | `guarantee` | `guarantee` | Red/Pink |

- Counts come from `/clinic-order-status` → `{ created, guarantee, continue, total }`
  and are counted on **`statusClinic`** (Tình trạng mẫu), not on `status`.
- Clicking a counter re-queries the list with `&statusClinic=<code>` and the
  pager text follows ("Hiển thị 1 trên 1 phiếu labo"); the active counter gets
  an extra blue outline. Clicking it again clears the filter (the unfiltered
  list comes back from cache, no new request). Only one counter is active at a
  time.

### Toolbar (top-right)

| Button | Style | Behaviour |
|--------|-------|-----------|
| Tạo phiếu Labo | Primary blue, box icon | Sets `?laboModal=new-order` and opens the tabbed order dialog (below) |

### Table Columns (10 columns)

| # | Column Header (VI) | Cell |
|---|-------------------|------|
| 1 | Mã phiếu labo | `code`. Existing rows show `LABO_DTS67` (`LABO_` + treatment-service code); the estimate endpoint now hands out `LABO-YYYYMMDDn`. A continue/warranty child row shows the **same code** as its parent |
| 2 | Ngày gửi / Tình trạng mẫu | `createdAt` as `DD/MM/YYYY HH:mm`, then a `statusClinic` pill (`Mẫu mới`, `Tiếp tục công đoạn`, `Bảo hành`, …) |
| 3 | Ngày giao / Trạng thái Labo | `estimatedDeliveryDate` as `DD/MM/YYYY HH:mm`, then a `status` pill (`Đơn hàng mới`, …) |
| 4 | Bác sĩ chỉ định | `staff.name` |
| 5 | Nhà cung cấp | `labo.name` |
| 6 | Vật liệu | `material.name` |
| 7 | Số răng | `toothContents` joined with `, ` |
| 8 | Số lượng | number of teeth |
| 9 | File Labo gửi về | Button `Xem file -` (disabled) when `images` is empty; with images the button opens a lightbox (see labo.md, not observed with data here) |
| 10 | Thao tác | three icon buttons: `Xem chi tiết` (eye), `Tiếp tục công đoạn` (plus), `Bảo hành` (green gift/shield icon) |

Pill labels and tones for the ten status codes: `docs/clone/pages/labo.md` §2.5.

Empty state: "Không có dữ liệu"

### Pagination

Options: 5, 10, 20 (default), 25, 50, 100 per page
Text: "Hiển thị 1–2 trên 2 phiếu labo" (no rows: "Hiển thị 0 trên 0 phiếu labo")

### "Xem chi tiết" — read-only modal "Thông tin chung"

No extra request; the row object is rendered. Same layout as the `/labo`
detail modal (labo.md §2.6): uppercase section headings THÔNG TIN CHUNG
(Bác sĩ chỉ định · Khách hàng · Ngày sinh), THÔNG TIN LABO (Nhà cung cấp ·
Ngày gửi · Ngày nhận dự kiến), THÔNG SỐ LABO (Vật liệu · Đường hoàn tất ·
Khớp cắn · Kiểu nhịp · Chỉ định · Ghi chú), CHI TIẾT PHIẾU (Dịch vụ điều trị ·
Loại phục hình · Răng · Màu chi tiết · Số lượng), then a TRẠNG THÁI pill.
Footer: `In Phiếu Labo` (outline, printer icon) and `Đóng`. A hidden print
sheet titled "PHIẾU ĐẶT HÀNG LABO" is rendered for the print button.
Unlike `/labo`, the patient tab's modal has **no** status select and no Lưu.

### Order dialog (`?laboModal=new-order | continue-process | warranty[&laboRowId=<id>]`)

~770 px wide, title = active tab, three pill tabs `Đặt mới` ·
`Làm tiếp công đoạn` · `Bảo hành`, footer `Lưu` (primary, save icon).
Lookups fired on open (structure in `docs/clone/api.md` → Labo → "Patient tab:
list, counters and the create flow"): taxonomy `serviceMaterial`, `line`,
`joint`, `bridge`; `staff/list …&isDoctor=true` (403 for the surveyed
account); patient treatments; treatment services with
`status=created,inProgress`; suppliers.

**Đặt mới** (two-column grid, MUI outlined fields, `*` on required):

| Field | Control | Notes |
|-------|---------|-------|
| Tên khách hàng* | disabled select | `code - name` of the current patient |
| Kế hoạch điều trị* | searchable select | options `DT<code> - <staff.name>` from patient-treatments; choosing one refetches treatment services with `patientTreatmentId`; a `done` plan yields no services; clear icon "Xóa lựa chọn" |
| Dịch vụ điều trị* | searchable select | options `<service.code> - <service.name>` (one per treatment service, duplicates allowed). Can be chosen without a plan — the plan field is then auto-filled (the reference prints the raw plan id in that case) |
| Bác sĩ chỉ định* | searchable select | doctors; empty on staging because the staff list returned 403 |
| Số phiếu Labo* | disabled text | empty until a treatment service is chosen, then `GET /clinic-orders/estimate-code?branchId=` → `LABO-202609051` |
| Ngày gửi* / Giờ gửi* | date (`DD/MM/YYYY`) + time (`HH:mm`) | prefilled today / now |
| Nhà cung cấp* | searchable select | from `labos/?branchId=&perPage=100&orderBy=name:asc` |
| Ngày nhận dự kiến* / Giờ nhận* | date + time | empty |
| Lựa chọn dịch vụ* | list + search icon | the icon reveals a popover search box "Tìm dịch vụ"; list shows "Không có dữ liệu" on staging — it is the labo-service list for the chosen treatment service (`service.laboIds`, empty on staging) |
| Vật liệu* | list + search icon | "Chọn dịch vụ trước" until a labo service is chosen |
| Răng:* | `Chọn tất cả` checkbox + one toggle button per tooth | "Chọn dịch vụ điều trị trước" until a treatment service is chosen; teeth come from the treatment service's `content[].code` (e.g. 12, 11, 22), all selected by default. Un-toggling a tooth unticks Chọn tất cả and Số lượng drops by one |
| Màu răng | text | |
| Số lượng* | disabled text | = number of selected teeth |
| Khớp cắn / Đường hoàn tất / Kiểu nhịp | searchable selects | taxonomy `joint` / `line` / `bridge` |
| Nội dung | multiline text | |
| Tải ảnh | dashed upload tile | |

**Làm tiếp công đoạn** and **Bảo hành** (toolbar entry): only
`Chọn phiếu dịch vụ Labo*` (options `Phiếu dịch vụ Labo #<code>` for every
order of the patient, children included) and Lưu stays disabled until one is
chosen. Entering from a row action prefills that field and shows the rest:

| Field | Notes |
|-------|-------|
| Kế hoạch điều trị / Dịch vụ điều trị / Số phiếu Labo | disabled textboxes (`DT35 - BS Minh`, service name, `LABO_DTS67` — the child keeps the parent's code) |
| Bác sĩ chỉ định*, Nhà cung cấp* | prefilled from the parent |
| Ngày gửi*/Giờ gửi* (continue) · Ngày bảo hành*/Giờ bảo hành* (warranty) | prefilled today / now |
| Ngày nhận dự kiến* / Giờ nhận* | empty |
| Radio `Theo vật liệu cũ` (default) | shows "Dịch vụ hiện tại: <labo service>" and "Vật liệu: <material>" |
| Radio `Thay đổi vật liệu mới` | swaps in the `Lựa chọn dịch vụ labo*` + `Vật liệu*` lists from Đặt mới |
| Răng, Màu răng, Nội dung, Số lượng, Tải ảnh | as Đặt mới, prefilled from the parent |

Save (`POST /v1/clinic-orders` with `Idempotency-Key`) was **not** issued; the
payload is unknown (unknowns.md).

---

## Tab 7: Đơn thuốc (Prescriptions)

URL: `?tab=prescription`

### Toolbar
| Control | Type |
|---------|------|
| Tạo đơn thuốc | Button (primary) |

### Table Columns (6 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Mã đơn thuốc | Prescription code |
| 2 | Bác sĩ | Doctor |
| 3 | Chẩn đoán | Diagnosis |
| 4 | Tái khám | Follow-up date |
| 5 | Ngày tạo | Created date |
| 6 | Thao tác | Actions |

Empty state: "Không có dữ liệu"
Pagination text: "Hiển thị 0 trên 0"

### "Thêm đơn thuốc" dialog (observed 2026-09-05 on staging, read-only)

Opening "Tạo đơn thuốc" adds `&create=true` to the URL (the dialog is
URL-driven; reloading the URL reopens it). Closing with Escape or "Hủy" drops
the flag. Opening fires two reads, and the medicine picker a third:

| Request | Purpose |
|---|---|
| `GET /api/v1/medicine-template/list?branchId=&page=1&perPage=20` | prescription templates ("Chọn đơn thuốc mẫu") |
| `GET /api/v1/staff/list?page=1&perPage=20&status=active&isResigned=false&branchId=&isDoctor=true` | doctors ("Chọn bác sĩ*") |
| `GET /api/v1/medicine-template/medicines?branchId=&limit=20` | medicines for "Tên thuốc*" (cursor-paged, fired when the picker opens) |

Dialog geometry: 897×829 at (16,16); content column x=40, width 843.
Title "Thêm đơn thuốc" + close X.

Layout, top to bottom:

1. **Patient block** — avatar, the patient's **name only** (uppercase, no
   code), "Giới tính: <Nam/Nữ> - dd/MM/yyyy - N tuổi", "Tiểu sử bệnh: <names |
   Chưa có dữ liệu>", "Liên hệ: <phone>".
2. **Row**: combobox "Chọn đơn thuốc mẫu" (611×40, searchable) + primary
   button "Thêm loại thuốc" (180×40). The button is a plain navigation to
   `/taxonomy/medicine?branchId=` (no sub-dialog; the unsaved slip is lost).
3. **Row**: combobox "Chọn bác sĩ*" (h40, required) · textarea "Nhập chẩn
   đoán" (h96, free text — not the diagnosis catalog).
4. **Row**: textbox "Nhập lời dặn" (h40) · checkbox "Lưu đơn thuốc mẫu".
5. **Row**: combobox "Điều trị" (floating label, searchable; options
   "Điều trị ngoại trú" — default — and "Điều trị nội trú") · date input
   "Tái khám" with calendar button (react-day-picker style popover, Vietnamese
   month header "Tháng Chín 2026", Mon-first `Th 2 … CN`, days before today
   disabled).
6. Outlined button "Thêm mới" (122×40, right-aligned) — appends a line.
7. **Line table** — columns and widths: Tên thuốc (208) · Ngày uống (102) ·
   Mỗi lần (90) · Số ngày (90) · Số lượng (90, disabled = Ngày uống × Mỗi lần
   × Số ngày) · Sử dụng (221) · delete (40). One default line: "Tên thuốc*"
   combobox (searchable listbox, "Tìm kiếm" box, "Không tìm thấy dữ liệu"
   when empty), 1 / 1 / 1 / 1, button "Sử dụng".
   The table has its own pager: page-size select `5 / 10 / 20 / 25 / 50 /
   100 " / trang"` (default 20), "Hiển thị 1 trên 1", Trước / 1 / Sau.
8. **"Sử dụng" popover** — checkboxes Sau khi ăn · Trước khi ăn · Trong khi
   ăn · Sau khi thức dậy · Trước khi ngủ · Khác; ticking Khác reveals a
   required textbox "Vui lòng nhập*" (error "Vui lòng nhập giá trị!", "Lưu"
   disabled until filled). Same widget as the Đơn thuốc mẫu dialog on
   `/taxonomy/prescription-template`.
9. Footer: "Hủy" (60×40) · primary "Lưu" (100×40).

Not observed (see unknowns): the POST payload, what the template pick fills
(staging has no templates), print layout, and what "Lưu" does when the form
is incomplete (it renders enabled; clicking it is a mutation, so not tried).

Answered by the product owner on 2026-09-05 (screenshot of the target dialog):

- "Thao tác" on a saved slip = **Sửa** and **Xóa** — no print action.
- Ticking "Lưu đơn thuốc mẫu" reveals a text field **"Tên đơn thuốc mẫu"**;
  the template takes that name.
- Scope of the feature = create, edit, delete.

Screenshots: `reference-private/survey/staging/prescription-tab.png`,
`reference-private/survey/staging/prescription-create-dialog.png`; local
counterparts in `reference-private/survey/local/` (same 929×861 viewport).

### Local implementation (2026-09-05)

`PrescriptionPanel` → `PrescriptionDialog` → shared `PrescriptionLineEditor`
(`src/components/prescription-lines/`, lifted out of the Đơn thuốc mẫu dialog
so both screens use one widget). Measured against the staging capture:

| Element | Reference | Local | Note |
|---|---|---|---|
| Dialog width | 897 | 897 | |
| Template combobox / "Thêm loại thuốc" | 611×40 / 180×40 | 1fr / 180×42 | antd `large` is 42 |
| Doctor, lời dặn, Điều trị, Tái khám | h40 | h42 | same |
| Diagnosis textarea | h96 | h96 | |
| "Thêm mới" | 122×40 outlined | 116×36 outlined | shared widget, same as Đơn thuốc mẫu |
| Line table columns | 208·102·90·90·90·221·40 | same widths | |
| Title | 24px | 16px | app-wide `AppDialog` title, kept |
| Primary colour | blue | `--bd-primary` indigo | app-wide token, kept |
| "Lưu" when incomplete | enabled | disabled until doctor + one medicine | app-wide dialog rule; reference click not tried |
| Table pager on empty list | "Hiển thị 0 trên 0" + Trước/Sau | "Hiển thị 0 trên 0" + antd pager | antd hides its pager on an empty table, so the tab draws one itself |

---

## Tab 8: Chăm sóc KH (Customer Care)

URL: `?tab=care` — khảo sát lại 2026-09-05 trên staging, viewport 1600×900.
Ảnh: `reference-private/survey/staging/patient-care-2026-09-05/01..06-*.png`.

### API (cookie auth)

| Khi nào | Request |
|---|---|
| Mở tab | `GET /customer-care?patientId=&isDeleted=false&overview=false&page=1&take=20` |
| Mở tab | `GET /customer-care-stats?patientId=&isDeleted=false&overview=false` |
| Bấm chip Đã chăm sóc | list + `&status=success` |
| Bấm chip Tốt / Khá / Bình thường / Khiếu nại | list + `&colorCode=green|blue|orange|red` |
| Bấm chip Đặc biệt / Định kỳ / Cơ bản | list + `&type=special|recurring|base` |
| Bấm lại chip đang chọn | bỏ filter (list không tham số thêm) |
| Mở dialog sửa / tạo | `GET /staff/list?...&isDoctor=true` (403 với tài khoản staging này) |

Chip là **single-select** (`aria-pressed`), đổi chip không gọi lại stats; stats
chỉ tải một lần khi mở tab.

Stats shape: `{ color:{green,red,orange,blue,total}, status:{new,success,fail,total},
type:{happyBirthday,afterTreatment,reminder,recurring,special,base,total}, zalo }`.

Record shape (structure only): `id, patientId, branchId, staffId (Bác sĩ điều trị),
careStaffId, dateTime, scheduleStartTime, scheduleToTime, type
(afterTreatment|happyBirthday|reminder|recurring|special|base), status
(new|success|fail), subject, note, code ("CARE/…"), formattedDate,
colorCode (green|blue|orange|red|null), taxonomyId, stageIds[], patientDetails,
staffDetails{name}, careStaffDetails{name}|null, patientStages[{serviceDetails{name}}]`.

Contract POST/PUT: xem `docs/clone/pages/cskh-grouping.md` (không thử mutation từ tab này).

### Toolbar

`flex justify-between items-center`, mb 16. Hàng chip gap 8; **một vạch dọc** giữa
"Khiếu nại" và "Đặc biệt" (khoảng cách 25px thay vì 8).

Chip: `button[aria-pressed]` 82×52 (min-w 65), `rounded-md border py-2`, xếp dọc:
số `16px/700`, nhãn `11px/500`. Khi pressed: `ring-1 ring-[#2671D8] ring-offset-2`
(box-shadow trắng 2px + #2671D8 3px). Không hover state.

| Chip | Nguồn số | border / bg / text |
|---|---|---|
| Đã chăm sóc | `status.success` | #CCD6E5 / #E8EEF7 / #34445A |
| Tốt | `color.green` | #BDE8CF / #DDF3E7 / #1F7A45 |
| Khá | `color.blue` | #BFD6F6 / #DCEBFA / #1E5BB0 |
| Bình thường | `color.orange` | #E8CF92 / #F7E7C2 / #9A6A10 |
| Khiếu nại | `color.red` | #F3BABA / #FBE0E0 / #B93832 |
| Đặc biệt | `type.special` | như Khiếu nại (đỏ) |
| Định kỳ | `type.recurring` | như Đã chăm sóc (xám xanh) |
| Cơ bản | `type.base` | như Tốt (xanh lá) |

Nút phải: "CSKH đặc biệt" — primary gradient, h-40 rounded-lg px-4, 14px/500,
icon lucide `plus` → mở dialog **Chăm sóc khách hàng** (tạo mới, xem dưới).
Không còn UNKNOWN.

### Bảng

Card `rounded-[16px] border #DCE3EE bg-white shadow 0 2px 6px rgba(27,42,65,.06)`.
th `h-10 bg-#F6F8FB 14px/500 #5A6B82 px-4 py-2 sticky top`. td `h-14 px-4 py-3
14px #1B2A41 border-r #DCE3EE`, hàng cao 67.

| Cột | min-w | Nội dung |
|---|---|---|
| Ngày chăm sóc | 140 | `dateTime` → `dd/MM/yyyy` |
| Trạng thái CSKH | 140 | badge `inline-flex h-8 rounded-lg border px-2 12px/600`, bg rgb(244,244,245) text rgb(119,119,119), icon lucide `clock` stroke 3 cho "Chưa chăm sóc" |
| Nhóm | 120 | nhãn type ("Sau điều trị", …) |
| Dịch vụ | 160 | `patientStages[].serviceDetails.name` nối ", " (giữ trùng) |
| Nội dung | 220 | `note` 13px pre-wrap max-w 360 + nút "Chi tiết" 12px/500 #2671D8 hover underline → dialog Chi tiết phiếu |
| Bác sĩ điều trị | 150 | `staffDetails.name` |
| Nhân viên chăm sóc | 160 | `careStaffDetails?.name ?? "Không có"` |
| Đánh giá | 130 | chấm `size-3 rounded-full` + nhãn 13px/500; `colorCode` null → hiển thị "Khá" xanh #2671D8 |
| Thao tác | w 70, sticky right, bóng trái | Chỉnh sửa (lucide `pencil`, size-7, text-label) + Xoá (lucide `trash-2`, #E5484D) |

Empty: một `td colSpan=9 h-32 text-center 14px #5A6B82` "Không có dữ liệu".

Pagination: select `5/10/20/25/50/100 " / trang"`, text "Hiển thị **N** trên **M**
nhật ký" (N = số dòng trang hiện tại), nút Trước / 1 / Sau.

### Dialog "Chi tiết phiếu" (nút Chi tiết)

500px, radius 16, header 24px/600 pad 12/12/12/24 border-b, body pad 12 24 24.
Mỗi field: nhãn 12px text-label + giá trị:

- Tiêu đề = `"CSKH " + nhãn type` (ví dụ "CSKH Sau điều trị"), không phải `subject`
- Nhân viên chăm sóc = tên hoặc "-"
- Thời gian = `dd/MM/yyyy HH:mm:ss`
- Ghi chú lần chăm sóc = `note` (pre-wrap)

### Dialog sửa "Cập nhật chăm sóc khách hàng" / tạo "Chăm sóc khách hàng"

500×595, form id `patient-care-form`, cùng bố cục cho cả hai:

1. Hàng: **Ngày chăm sóc\*** (text `dd/MM/yyyy` + icon `calendar-days`) | **Giờ chăm sóc\*** (w-32, `HH:mm` + icon `clock`)
2. **Họ và tên\*** combobox disabled = `"<code> - <name>"`
3. Textarea floating-label **Ghi chú lần chăm sóc** (`name=note`, maxlength 500)
4. `<hr>`
5. **Bác sĩ tiếp nhận** combobox có icon search (nguồn `staff/list?isDoctor=true`)
6. **Nhân viên chăm sóc\*** combobox **disabled = user đang đăng nhập**
7. **Mức độ hài lòng\*** — 4 radio xếp cột (radio trên, nhãn màu 12px/500 dưới):
   Tốt #2BB673, Khá #2671D8 (mặc định), Bình thường #F5A400, Khiếu nại #E5484D
8. Footer `flex justify-end`: nút **Lưu** 100×40, icon lucide `save`

Tạo mới: mặc định ngày/giờ hiện tại, ghi chú trống, bác sĩ trống, Khá.
Sửa: điền từ record (dateTime, note, staffId, colorCode).

### Dialog xác nhận xoá (nút Xoá — `06-delete-confirm.png`)

Bấm Xoá được chủ dự án cho phép (2026-09-05), **không** bấm xác nhận. Dialog
~380px, radius 16: tiêu đề **Xóa lượt chăm sóc** (18px/600), câu hỏi 16px
"Bạn có chắc chắn muốn xóa lượt chăm sóc này không?", dòng phụ 14px màu nhạt
"Hành động này không thể hoàn tác.", footer phải: **Huỷ** (outline) · **Xóa** (đỏ).

UNKNOWN_REFERENCE_BEHAVIOR — request sau nút Xóa: không bấm. Giả định soft
delete (`isDeleted=true`, list luôn gọi `isDeleted=false`).

Body PUT do chủ dự án cung cấp (2026-09-05), cấu trúc:
`{ patientId, staffId, careStaffId, dateTime, scheduleStartTime, scheduleToTime,
type:"afterTreatment", subject:"Customer Care - afterTreatment", note,
colorCode:"blue", status:"success", branchId }` — POST giả định tương tự
(UNKNOWN, không thử).

### Quyết định triển khai BlueDental (2026-09-05, theo trả lời của chủ dự án)

- **Nhân viên chăm sóc** = người đang đăng nhập, khoá ở cả dialog tạo lẫn sửa;
  **Họ và tên** khoá. Bản ghi đã đóng vẫn sửa được (không khoá theo trạng thái).
- **Mức độ hài lòng**: đúng 4 mức Tốt / Khá / Bình thường / Khiếu nại, mặc định
  Khá; `outcome` null hiển thị "Khá" xanh như bản gốc hiển thị `colorCode` null.
- Lưu gửi `status: Succeeded (3)` + `outcome` — tương ứng `status:"success"` +
  `colorCode` của bản gốc; vì thế mọi bản ghi từ tab này đều lên chip "Đã chăm sóc".
- Chip → **một** tham số server-side trên `GET /api/v1/app/care-records`:
  `status=3`, `outcome=1|2|3|4`, `type=5|4|6`; `GET …/stats` trả thêm
  `special` / `periodic` / `base`. Đổi chip không gọi lại stats.
- Xoá: `DELETE /api/v1/app/care-records/{id}` (soft delete, cần quyền Manage,
  chặn chéo chi nhánh) sau `ConfirmDeleteDialog` dùng chung — dialog nhà 440px,
  câu hỏi 14px, hơi khác ~380px/16px của bản gốc (quy ước toàn app, không sửa riêng).
- Cột Nhóm của bản ghi Đặc biệt hiển thị "CSKH đặc biệt" (nhãn của module CSKH);
  bản gốc chỉ có bản ghi Sau điều trị nên nhãn thật cho loại này chưa quan sát
  được — xem `docs/clone/unknowns.md`.
- Đo pixel trên `02-care-tab-1600.png`: th bg `#f6f8fb` chữ `#5a6b82` 14px/500
  không viết hoa, viền cột `#dce3ee`, pager bg `#f6f8fb` thứ tự "N / trang" →
  "Hiển thị **N** trên **M** nhật ký" → Trước / 1 / Sau (nút có chữ). Select
  khoá trong dialog: bg `#f3f6fa`, chữ `#a6b1be`; tiêu đề dialog 22px/700.
- Lệch còn lại là chrome chung: sidebar navy, nút primary tím của app thay cho
  xanh `#2671D8`.

---

## Tab 9: Hóa đơn (Invoices)

URL: `?tab=invoice`

**State observed**: "Nội dung đang được hoàn thiện." — feature not yet implemented in production.

---

## Tab 10: Lịch sử dư nợ (Debt History)

URL: `?tab=debt-history`

Note: URL param is `debt-history`, not `debt`.

### Table Columns (5 columns)

| # | Column (VI) | English |
|---|------------|---------|
| 1 | Ngày giao dịch | Transaction date |
| 2 | Loại | Type |
| 3 | Số tiền | Amount |
| 4 | Nhân viên | Staff |
| 5 | Ghi chú | Notes |

Empty state: "Chưa có lịch sử dư nợ"
Pagination text: "Hiển thị 0 trên 0 giao dịch"

---

## UNKNOWN_REFERENCE_BEHAVIOR Summary

| # | Item | Reason |
|---|------|--------|
| 1 | Tab 2 (Chẩn đoán) "Tạo Dịch Vụ" button in diagnosis row | Would create a service — mutating |
| 2 | Tab 2 (Tư vấn) expanded row content | Not clicked |
| 3 | Tab 3 "Tạo kế hoạch mới" form fields | Form not opened — mutating |
| 4 | Tab 3 "Thêm công đoạn" button action | Not clicked — mutating |
| 5 | Tab 3 "DT01" plan slip click — detail view | Not clicked (read-only observation only) |
| 3 | Edit patient button | Mutating — not clicked |
| 4 | "Tạo lịch hẹn mới" form fields | Resolved: create dialog in survey pass 2026-08-28 (2) §2, edit dialog and row actions in survey pass 2026-09-05 |
| 5 | "Tải ảnh" behavior | File upload — mutating |
| 6 | "Lịch sử thay đổi" modal content | Not clicked |
| 7 | Image gallery layout | No images to observe |
| 8 | Dental chart SVG in tab 2 | Not captured in snapshot |
| 9 | ~~"Tạo phiếu Labo" form fields~~ | RESOLVED 2026-09-05 — three-tab dialog documented under Tab 6; POST payload and the labo-service/material lists (empty on staging) remain unknown |
| 10 | ~~Labo row action buttons~~ | RESOLVED 2026-09-05 — Xem chi tiết / Tiếp tục công đoạn / Bảo hành, documented under Tab 6 |
| 11 | ~~"Tạo đơn thuốc" form fields~~ | RESOLVED 2026-09-05 — dialog documented under Tab 7; row actions (Sửa/Xóa) and the "Tên đơn thuốc mẫu" field confirmed by the owner; POST payload and template fill remain unknown |
| 12 | "CSKH đặc biệt" button behavior | Not clicked |
| 13 | Hóa đơn tab actual content | Feature not yet implemented ("đang hoàn thiện") |
| 14 | Debt history transaction types (Loại column) | No data rows |

---

## Survey pass 2026-08-28 — what still differs

Reference re-surveyed read-only on a patient with real treatment data.
Screenshots in `reference-private/survey-patient/`.

### Fixed in this pass

- **The app did not build.** `AppointmentEditorModal` had been deleted while six
  files still imported it — Dashboard, the appointment calendar and list, and
  two patient-detail tabs. Restored, and given the prefill props those callers
  were already passing (`initialPatientId`, `initialDoctorId`, `initialEndTime`,
  `initialReason`, `initialNotes`). It now seeds the form **on open** rather
  than once at mount, so reopening it for a different patient or slot no longer
  shows whichever one it saw first — `initialTime` was declared and dropped on
  the floor before this.
- **Lý do đến khám** stated its three notes as stacked label-over-value with
  BlueDental's own wording. The reference writes them on one line in its own
  words: `Tiểu sử bệnh:`, `Về KH:`, `Nguồn đến:`. Matched, and the reason
  itself now carries the accent the reference gives it.
- **Lý do đến khám was one string** (2026-09-06). The reference keeps a dated
  list; BlueDental kept a single `bd_patients.ExaminationReason` column, so the
  card showed one undated line and the + button silently overwrote it. The
  column moved to `bd_patient_examination_reasons` (migration
  `20260906000000_AddPatientExaminationReasons`, which carries every existing
  value across as that record's root line dated from its creation), the card
  renders the list, and + appends.
- **Ticking a tag did nothing visible** (2026-09-06). The tick was there and
  the save reached the server — but `CheckOutlined` renders a bare `<span>`,
  which the picker row's own `button > span` chip rule matched, painting the ✓
  white on white with chip padding. The chip is a class of its own now
  (`.pd-tag-chip`), so nothing else can claim it. The tags on a record were
  never drawn beside the name either; they are, in the catalog order the picker
  lists them in, on the same wrapping row as the name.
- **Tạm ứng was missing** from the money row (2026-09-06) — six tiles where the
  reference shows seven. `payment.prepaid` was already on the wire and rolled
  up server side; only the tile was absent.
- **Lý do đến khám read a size too large** (2026-09-06). The reference sets it
  at 14px, but its whole column runs a notch above ours (heading 16 vs our 14,
  facts 14 vs our 13.5). Dropped to 13.5px/20 beside the facts, with the date
  column scaled 88 → 85px to keep the two as tight as the reference's.
- **The Phân loại theo Tag filter drew coloured chips** (2026-09-06) — invented,
  not observed. The reference's two "Phân loại" filters are the same widget down
  to the markup: a search box over plain rows. The chip renderer is out of
  `SearchSelect` entirely, so the CSKH grouping filter loses it too; the
  coloured chip stays where it was actually seen, on the record's own picker.
- **Lịch hẹn gần nhất had no doctor select** (2026-09-06) — see above. Added,
  sending the whole appointment back because `UpdateAsync` rebuilds the slot and
  the details from the request: a doctor-only body would clear the note, the
  colour and the time.
- **The treatment table was the wrong shape** (2026-09-06) — uppercase 11.5px
  headers, no rules between cells, nine columns instead of ten, the service name
  printed twice (Dịch vụ *and* Nội dung điều trị), plain text where the
  reference chips, `0/0` where it shows a green **+**, and a pencil into the
  plan where it opens "Tạo phiếu thanh toán". Rebuilt to the table above; the
  columns moved into `treatmentColumns.tsx` rather than growing the tab further.
- **The card clipped its own first row** after that. `.pd-profile > .bd-cat-card`
  was `flex: 1` inside a fixed-height pane, so a two-line row did not fit in the
  240px it was left. It sizes to content now and the pane scrolls, which is what
  the reference does.
- **Lịch hẹn gần nhất** showed a compact block and, worse, filtered to
  *future* appointments only — so the card was empty for every patient between
  visits. The reference asks for `/schedules/latest` (ascending, no date
  filter) and shows the nearest appointment whether or not it has passed. Now
  matched, laid out as labelled rows (Ngày / Giờ hẹn / Bác sĩ / Nội dung) with
  the **Tiếp nhận** stepper under it: Đã đến → Đang khám → Hoàn tất.

### Reference layout, for the record

| Area | What it holds |
|------|---------------|
| Header | `‹ Quay lại / [code] - NAME`, and on the right a two-way switch: **Chi tiết hồ sơ** (the tabbed detail) / **Bệnh án** |
| Tabs (10) | Hồ sơ · Chẩn đoán & Tư vấn · Kế hoạch điều trị · Lịch hẹn · Hình ảnh · Labo · Đơn thuốc · Chăm sóc KH · Hóa đơn · Lịch sử dư nợ |
| Hồ sơ | Identity card · Lý do đến khám · Lịch hẹn gần nhất; seven money tiles; a treatment table under six filter chips |
| Endpoints | `GET /v1/patients/{id}`, `/v1/schedules/latest`, `/v1/patient-timeline`, `/v1/staff/list?isDoctor=true` |

The treatment table is fed by `patient-timeline`, whose rows are **treatment
stages**, not service lines: `patientTreatment.code` gives the `DT…` shown,
`note` carries the stage names that fill "Nội dung điều trị", and
`treatmentService.serviceStages` is that service's own stage list — confirming
công đoạn are per-service and declared in Danh mục → Dịch vụ.

### Still to build

1. **Bệnh án** — a whole second view behind the header switch: a "Mục lục bệnh
   án" index of numbered form templates (Bia hồ sơ, Bệnh án ngoại trú RHM, Bệnh
   án chỉnh nha, Phiếu tư vấn tổng quát, …), each with `+ Thêm`, an A4 canvas,
   and a bottom bar of `Từng phiếu` / `Toàn bộ`, zoom, `In biểu mẫu`, `Lưu`.
2. **Chăm sóc sau điều trị** column on the Hồ sơ treatment table. Left out
   rather than faked: it needs care records tied to a treatment stage
   (`care.status` / `stageIds` on the reference's timeline row), which
   BlueDental does not model yet — a column that could only ever say
   "Chưa chăm sóc" would state something it cannot know.
3. **Date on the visit reason.** The reference dates that line from the visit
   that raised it; BlueDental keeps the reason on the patient with no date of
   its own.
**Tiếp nhận stepper (measured 2026-09-07, patient `HN8521`, unreached).** Three
buttons; only the next one is enabled, the other two `disabled` +
`cursor-not-allowed`. Each renders **both halves** of its rail with the outer
edges `invisible`: a 2px `#DCE3EE` bar either side of a **32px** white dot that
carries the step number (`1px #DCE3EE`, 13px/600). Label 12px/600 and time 12px,
both `#1B2A41` — and the label's colour is an **inline style**, which is how the
reached colour comes to be the step's own rather than one shared tint. Reached:
the dot fills with that colour and wears a tick, the label follows, and the rail
leading into the step is coloured too — blue, amber, green across the three. The
reached colours themselves are an assumption; see docs/clone/unknowns.md.

`POST /appointments/{id}/complete` binds a body (`CompleteAppointmentDto`) where
check-in and start take none, and `Appointment.Complete(notes)` assigns `Notes`
unconditionally — so the third step must send the appointment's existing note
back or it erases it.

4. **Tiếp nhận times.** The three steps draw `--:--`: an appointment records
   when it was booked for, not when the patient walked in. The reference fills
   these from reception.
5. **Bác sĩ select** under the stepper — it reassigns the visit's doctor on the
   reference; left out until there is an endpoint behind it.
6. The remaining tabs were surveyed only far enough to map them; Chẩn đoán &
   Tư vấn in particular is large (image dropzone with three view modes, a
   diagnosis table with per-row `Tạo Dịch Vụ`, an advise table with drag
   handles and column settings, and a totals footer with a %/VNĐ discount
   toggle, `Thêm kế hoạch điều trị` and `Tạo báo giá`).

---

## Survey pass 2026-08-28 (2) — Tạo lịch hẹn, Chẩn đoán & Tư vấn, table chrome

Observed read-only against
`https://app.nfcdental.com/patient/<id>?branchId=<id>&tab=appointment|consulting`.
Screenshots and network captures stay in `reference-private/survey-patient/`.

### 1. Lịch hẹn tab

| Area | Reference |
|------|-----------|
| Counters | Four chips, left: `Đã hẹn` (blue), `Đã đến` (green), `Đã huỷ` (red), `Trễ hẹn` (amber) |
| Commands | `Lịch sử thay đổi` (outline, history icon), `Tạo lịch hẹn mới` (primary, calendar icon) |
| Columns | Ngày/ Giờ · Bác sĩ phụ trách · Nội dung · Ghi chú · Trạng thái · Thao tác |
| Empty | `Không có dữ liệu`, then `20 / trang` + `Hiển thị 0 trên 0 lịch hẹn` + Trước/Sau |

Endpoints the tab loads:

```
GET /api/v1/schedules?patientId=&branchId=&page=1&take=20&sortBy=startTime&sortDirection=desc&rootSchedule=true
GET /api/v1/schedules/schedule_stats?patientId=&branchId=&rootSchedule=true&startTime=2000-01-01&toTime=2099-12-31
GET /api/v1/schedules/stats-by-time?...&dataType=logs
GET /api/v1/schedule-logs?patientId=&page=1&take=20&fromDate=&toDate=
GET /api/v1/schedule-logs/stats?patientId=&fromDate=&toDate=
```

### 2. "Tạo lịch hẹn" dialog

Title is **Tạo lịch hẹn** (not "… mới"); the trigger button is the one that says
"mới". Shell measured at **1240 × 857**, radius 16, header 61px, scrolling body,
footer 69px with a single right-aligned `Lưu` carrying a save icon.
**No cancel button** — the X is the only way out.

Body is `flex flex-col gap-5`: a `grid-cols-3 gap-5` form (three 382px columns,
each `space-y-3`) over a bordered `rounded-xl … p-4` agenda card.

| Column | Fields |
|--------|--------|
| 1 | `Chọn bệnh nhân*` (floating-label select, **disabled** when opened from a patient) · `Chi nhánh` · `Ngày hẹn` (masked DD/MM/YYYY + calendar popover) · `Giờ hẹn` (HH:mm + clock popover) and `Phút` (duration, defaults 30) side by side |
| 2 | `Chọn bác sĩ*` (search select, magnifier prefix; its panel has a `Tìm kiếm` box then plain names) · `Nội dung đặt lịch` (textarea, `min-h-16`) · `Màu lịch hẹn` |
| 3 | `Ghi chú` card: title, `+ Thêm ngay` link, body `Chưa có ghi chú` |

`Màu lịch hẹn` — four 36px circles, `border-2`, unselected `opacity-80`,
selected `scale-110 ring-2 ring-offset-1`:

| title | fill | border |
|-------|------|--------|
| Mặc định | `#E3F2FD` | `#1565C0` |
| Xanh lá | `#E8F5E9` | `#2E7D32` |
| Cam | `#FFF3E0` | `#EF6C00` |
| Đỏ | `#FFEBEE` | `#C62828` |

**Lịch đã hẹn** — the branch's whole diary, not the patient's:

- Header: `h3` 15px/600 plus a 36px round `Đổi cách xem` button (day mode only),
  then `Ngày | Tuần | Tháng` (h-10, radius 8, p-1, border `#DCE3EE`) and a
  `‹ [calendar] date ›` nav in a 230px-min bordered group.
- Body: `h-[460px] overflow-auto rounded-lg border`.
- **Ngày**: horizontal axis 06:00 → 24:00, 60px per half hour (2160px wide),
  sticky tick row; empty reads `Chưa có lịch hẹn ngày DD/MM/YYYY`.
  `Đổi cách xem` swaps to a layout with a ~200px label gutter down the left.
- **Tuần**: seven columns, day number over `Thứ 2 … Chủ nhật`; today's column is
  blue with an underline; an empty day shows a dashed placeholder box. Range
  label `24/08 - 30/08/2026`.
- **Tháng**: 7-column grid, out-of-month days greyed on a tint; a day with
  appointments prints three tallies — `Đã đến (n)` with a green check,
  `Đã huỷ (n)` with a red slash, `Đã hẹn (n)` with a blue clock. Label `08/2026`.

Loads: `GET /api/v1/time-keepings/doctors/work-status?branchId=&date=` (the
doctor list, each row carrying `canBookAppointment`, `hasCheckedIn`, `checkIn`)
and `GET /api/v1/schedules?branchId=&page=1&take=100&startTime=&toTime=`.

### 3. Chẩn đoán & Tư vấn

Top row is a fixed ~605px band: a 350px image panel on the left, the diagnosis
card filling the rest. The consulting sheet runs full width underneath and the
page scrolls.

**The three buttons over the drop zone** (36px, stacked, 4px apart, dark navy):

| aria-label | Behaviour |
|------------|-----------|
| `Thêm ảnh` | Opens the OS file chooser directly |
| `Danh sách ảnh` | Dialog **Chọn ảnh hiển thị** — grid of the patient's images, footer `Chọn tất cả` + `Xong`, empty `Chưa có ảnh nào.` |
| `Danh mục` | Popover **Dữ liệu tư vấn**, from `GET /api/v1/taxonomy/?group=consulting_data&perPage=20&branchId=`, empty `Không có danh mục.` |

**Tạo chẩn đoán** card — title plus a round `+`, and on the right two blue lines:
`Bác sĩ có trách nhiệm thông báo` /
`Những vấn đề răng miệng đang gặp phải – Hiểu về tiến trình của bệnh lý`.

Columns: `Số phiếu` (blue) · `Bác sĩ chẩn đoán 1` (name over date) ·
`Chẩn đoán 2` (second doctor, or **`Chưa cập nhật` in red**, over date) ·
`Răng` (teeth in blue over the diagnosis name) · `Ghi chú` · `Thao tác`
(`Tạo Dịch Vụ` primary, a calendar icon, a red trash).

`GET /api/v1/patient-diagnoses?patientId=&page=1&take=20` returns
`{ id, patientId, staffId, staffSecondId, diagnosisId, content:[{code,selected}],
note, code, status, hasTreatmentService, staff{id,name,isResigned}, staffSecond,
diagnosis{id,name,isDeleted,content} }`.

**Phiếu tư vấn** card — a primary `Phiếu tư vấn` button on the left, blue helper
text centred, then a right-aligned `Cột hiển thị` on its own row. That opens
**Cấu hình cột**: a scrollable list of drag handle + label + toggle rows with a
full-width blue `Lưu`.

Thirteen columns: [drag] [checkbox] `Ngày` · `Dịch vụ` · `Chẩn đoán` ·
`Nhân sự tư vấn 1` · `Nhân sự tư vấn 2` · `Bác sĩ chẩn đoán 1` · `Chẩn đoán 2` ·
`Số lượng` · `Đơn giá` · `Giảm giá` · `Thành tiền` · `Ghi chú tư vấn` ·
`Thao tác`. Empty reads `Chưa có kế hoạch`; the pager says
`Hiển thị 0 trên 0 dịch vụ`.

Footer **TỔNG KẾ HOẠCH**, in the right half of the card, one fact per line:
`Tổng thành tiền` · `Giảm giá:` with a `%` / `VNĐ` toggle and a number box ·
`Tổng giảm giá` and `Tổng tiền` on one line · then a `Chọn bác sĩ điều trị`
select, `+ Thêm kế hoạch điều trị`, `+ Tạo báo giá` (primary) and a print icon.

Loads: `patient-images`, `patient-diagnoses`, `patient-advises?…status=created
&sortBy=sortOrder&sortDirection=asc`, `advise-groups`, `voucher/available`.

### 4. Table chrome

Every table's scroller in the reference is
`relative w-full min-h-0 flex-1 overflow-auto`, with `sticky top-0` headers —
the same shape as BlueDental's own `.bd-cat-card`.

---

## What BlueDental now does

### Applied

- **`.pd-page` owns the viewport height** (`calc(100vh - header - 32px)`,
  `overflow: hidden`), `.pd-pane` is the scrolling pane, and `.pd-pane--fill`
  hands the height down to the card. Every table tab — Chẩn đoán & Tư vấn, Kế
  hoạch điều trị, Lịch hẹn, Labo, Đơn thuốc, Chăm sóc KH, Hóa đơn, Lịch sử dư
  nợ — now uses the app's own `.bd-cat-card`, so the header stays
  put, the rows scroll and the pager sits on the card's bottom edge **even with
  no rows**. The bespoke `.pd-table-card` chrome is gone from those tabs.
- **Tạo lịch hẹn** rebuilt to the layout above, including the colour swatches,
  the note card and the three-mode agenda drawn from the branch's real diary.
- **Chẩn đoán & Tư vấn** rebuilt: the three image commands with the reference's
  labels and dialogs, the paired-fact diagnosis columns with their three row
  actions, the thirteen-column consulting sheet behind `Cấu hình cột`, and the
  TỔNG KẾ HOẠCH block with its %/VNĐ toggle and four commands.

### Backend defects this pass turned up

1. `PatientDiagnosisDto.StaffName` and `DiagnosisName` were declared and **never
   filled**, so `Bác sĩ chẩn đoán 1`, `Chẩn đoán 2` and the diagnosis name under
   `Răng` always read an em dash. Now resolved in one read per kind, alongside a
   new `SecondStaffName`.
2. `PatientAdviseDto` likewise: `ServiceName` and `StaffName` unfilled, and no
   `SecondStaffName` or `DiagnosisName` at all — four of the reference's columns
   could not be drawn. Fixed the same way.
3. `usePrescriptionTemplateList` and `useConsultingDataList` called
   `/v1/app/prescription-templates` and `/v1/app/consulting-data`, routes that do
   not exist — both 404'd on every visit and their pickers were permanently
   empty. Both now read `/v1/app/catalog-entries` with their group, and
   `CatalogOption` carries `content` so a picked template still fills the note.

### Superseded by main (rebase 2026-08-31)

Three more defects were found and fixed on this branch, then **dropped when it
was rebased onto `main`** — `main` had solved all three independently, and
better:

- `AppointmentAppService.UpdateAsync` dropped `ChiefComplaint`, and neither
  create nor update carried `Notes`. `main` now routes both through
  `Appointment.UpdateDetails(chiefComplaint, notes, color)`.
- The editor called `create` even in edit mode, so saving an edit booked a
  second appointment. `main`'s editor branches on `appointmentId`.
- The appointment had no colour. This branch added an `AppointmentColor` enum
  and migration `20260828090000_AddAppointmentColor`; `main` had already added
  `Color` as a **nullable `varchar(20)`** in `20260829173829_AddAppointmentColor`,
  which is the shape that survives. The swatch key travels as the stored string.

The whole booking dialog likewise came from `main`
(`AppointmentEditorModal` + `AppointmentFormLeft/Center/Right` +
`AppointmentColorPicker` + `AppointmentMiniCalendar`), so this branch's own
`AppointmentAgenda` and `appointment.css` were deleted rather than merged. Two
optional props were added to `main`'s dialog for the patient screen:
`initialPatientId` / `initialReason` seed it, and `lockPatient` greys the
patient field out the way the reference greys it.

`main`'s day view also answers the `Đổi cách xem` question this branch had
logged as unknown: it toggles between "Xem theo giờ" and "Xem theo bác sĩ".

### Deliberate divergences

- **No drag handle** on the consulting sheet: reordering advises is not
  implemented, and a handle that does nothing is worse than none.
- **`Lịch sử thay đổi`** (rebuilt 2026-09-05 from a read-only look at staging)
  now reads a real per-change log, `appointment-change-log`, written on every
  appointment create / update / status change / cancel / delete. Observed
  structure, matched locally: title "LỊCH SỬ THAY ĐỔI LỊCH HẸN" + subtitle
  (title 17px under the modal top, first stat card 30px under the subtitle
  at 1600×900; an empty week swaps the cards for a dashed grey bar "Chưa có
  thao tác nào trong khoảng thời gian này.");
  stat cards (Tổng, then one per action and per resulting status **only when
  its count is above zero**: flex-1, min 112 × 62, radius 12, teal border for
  Tạo mới, orange for Cập nhật / Trễ hẹn); a 36px filter row (week navigator,
  three 160px **multi-selects** — Hành động, Trạng thái, Nguồn; chosen values
  as small tags, the overflow folded into "+n" (tag styling is BlueDental's,
  see unknowns) —, two text boxes, a bordered checkbox "Chỉ hiển thị thay
  đổi quan trọng", "Xóa lọc" once anything is set); a grey Bảng / Dòng thời
  gian switch with a white active tab and "Xuất dữ liệu" (CSV / Excel / JSON);
  the table (th 40px grey, td 12×16 padding) with Thời gian · Loại · Thay đổi ·
  Before → After · Trạng thái · Người (letter avatar) · Nguồn · chevron; the
  expanded panel (re-measured 2026-09-05: 16px of grey around white cards,
  radius 12, 16px padding, 16px apart) — a bordered strip with the action
  badge, THÔNG TIN, LỊCH HẸN and the time on the right; NGƯỜI THỰC HIỆN (28px
  pale-blue circle avatar with blue initials, name 13/600 over the role,
  then "Loại: Người dùng" on its own line); THÔNG TIN TRUY CẬP as three
  icon rows (globe IP, device "Chrome trên Windows" — browser and OS names
  only, no versions —, server Nguồn) with bold labels and blue values;
  SO SÁNH TRƯỚC / SAU with one line per field: "# Ghi chú" in a 152px column,
  a 26px red-edged TRƯỚC box, an arrow, a green-edged SAU box; CÁC TRƯỜNG BỊ
  ẢNH HƯỞNG chips; and a last card in two columns — Schedule (id in a grey
  mono pill) / Trạng thái, Actor / IP, Trình duyệt / Hệ điều hành; the
  timeline groups rows by day ("05 THÁNG 9 2026",
  "n mục") and opens the same panel inline; footer "Hiển thị a–b trên n lịch
  sử" with "‹ Trước / Sau ›" under the table, only "Hiển thị n lịch sử" under
  the timeline, which loads its next page of 20 on scroll (BlueDental's own:
  the reference's timeline was seen with one page only); the week runs
  Sunday to Saturday. Vietnamese labels for actions, statuses and
  sources are the reference's. Component: `features/appointments/components/history/`.
  The reference's export was broken while observed, so the three formats are
  BlueDental's own full-column output.

---

## Survey pass 2026-08-31 — the whole record, tab by tab

Every one of the ten tabs was captured on the reference at 1600×900 and set
beside the local screen. Captures are in `reference-private/survey-patient/`.

### Header

The tab row is a flat 40px row, not pills: `padding: 2px 16px`, `14px/600`,
inactive `#475569`, active `#2671D8` on `#E7F0FB` with a 2px `#1B2A41` rule
under it. On its right sits a two-way switch, 125×32, radius 6, `13px/500`:
**Chi tiết hồ sơ** / **Bệnh án**. Both are now built; the view rides in the URL
as `?view=medical-record`, so a bệnh án can be linked to.

### Bệnh án

| Area | Reference |
|------|-----------|
| Left | Card "Mục lục bệnh án" / "N biểu mẫu", then nine numbered rows, each a tinted card with an icon chip and a coloured `+ Thêm` |
| Right | The sheet being worked on; empty reads `Chưa có phiếu bệnh án. Chọn "Thêm" ở mục lục để tạo phiếu mới.` |
| Bottom | `Từng phiếu` / `Toàn bộ` · `Zoom` − 100% + · `In biểu mẫu` · `Đồng bộ phiếu` · `Lưu` |

The nine forms, with the tint / accent / icon background measured off the
reference's own computed styles (rows 8 and 9 repeat rows 1 and 2):

| # | Form | tint | accent |
|---|------|------|--------|
| 1 | Bìa hồ sơ bệnh án | `#F4F8FF` | `#3075CC` |
| 2 | Bệnh án ngoại trú Răng Hàm Mặt | `#F0FBF9` | `#22B5A6` |
| 3 | Bệnh án chỉnh nha | `#FFF7F1` | `#D97A40` |
| 4 | Phiếu Tư Vấn Tổng Quát | `#FAF6FF` | `#A174E0` |
| 5 | Phiếu tư vấn và xác nhận đồng ý điều trị | `#FFF9EF` | `#E2A32A` |
| 6 | Giấy đồng ý thực hiện phẫu thuật/thủ thuật | `#F2FCF5` | `#18AA65` |
| 7 | Phiếu phẫu thuật/thủ thuật | `#FFF5F7` | `#F05D79` |
| 8 | Phiếu theo dõi điều trị | `#F4F8FF` | `#3075CC` |
| 9 | Phiếu chăm sóc | `#F0FBF9` | `#22B5A6` |

Reads `GET /api/v1/patient-medical-record/files/{patientId}`, which answers a
list of *files* — several sheets of the same form may sit on one record.

### Kế hoạch điều trị

Two commands: `+ Tạo kế hoạch mới` (primary) and `👁 Xem tất cả dịch vụ`
(outlined, eye icon). Then two summary cards, each a tinted icon chip, an
UPPERCASE title with its detail under it, and the count as a round red badge on
the far right: `DỊCH VỤ ĐANG ĐIỀU TRỊ` and `DỊCH VỤ CÓ CÔNG ĐOẠN GẦN NHẤT`.
`Cột hiển thị` sits right-aligned above the table.

### The remaining tabs

| Tab | Reference | Local |
|---|---|---|
| Hình ảnh | `Giai đoạn điều trị` select + `Tải ảnh`; dashed gallery card, "Không có ảnh trong bộ lọc đã chọn" | matches |
| Labo | three chips (Đơn hàng mới / Tiếp tục công đoạn / Bảo hành), `Tạo phiếu Labo`, ten columns | column names match; cells, pills, row actions and the dialog did not (rebuilt 2026-09-05, see Tab 6) |
| Đơn thuốc | `+ Tạo đơn thuốc`; Mã đơn thuốc · Bác sĩ · Chẩn đoán · Tái khám · Ngày tạo · Thao tác | matches |
| Chăm sóc KH | eight chips, `+ CSKH đặc biệt`, nine columns, pager counts "nhật ký"; Chi tiết phiếu / Cập nhật / Xóa lượt chăm sóc dialogs | matches (rebuilt 2026-09-05; house chrome and the shared 440px confirm dialog are the only deviations) |
| Lịch sử dư nợ | Ngày giao dịch · Loại · Số tiền · Nhân viên · Ghi chú | matches |
| **Hóa đơn** | **`Nội dung đang được hoàn thiện.`** — not built on the reference | BlueDental already has a real invoice table, so it is **ahead**; left as it is |

---

## What BlueDental now does (pass 2)

### Bệnh án — built end to end

- New aggregate `PatientMedicalRecord` (patient, branch, form, title, sort
  order, JSON content) with `MedicalRecordForm` naming the nine printed forms,
  migration `20260831060000_AddPatientMedicalRecord`, an app service and an
  explicit controller at `api/v1/app/patient-medical-records`.
- A new ability subject `patientMedicalRecord` (read/create/update/delete/print)
  in the catalog and in the role-permission tree.
- The view reuses what the app already has rather than growing a second
  implementation: **`MedicalRecordSheet`** — the A4 form Danh mục draws for
  "Bệnh án mẫu" — plus `SegmentedTabs` and `ConfirmDeleteDialog`.
- Only the filled cells are stored. The printed layout lives on the client, so
  changing a form never migrates anyone's record.

### Everything else

- The tab row is the reference's flat row, scoped to this page so the shared
  pill switcher used by Danh mục and Labo is untouched.
- Kế hoạch điều trị's summary cards rebuilt to the reference's shape; the eye
  icon added to `Xem tất cả dịch vụ`.
- Chăm sóc KH's pager counts "nhật ký", as the reference counts them.

### Still divergent, on purpose

1. **Only form 2 is drawn to the reference's layout.** "Bệnh án ngoại trú Răng
   Hàm Mặt" is the one printed form BlueDental has, because it is the one Danh
   mục already builds. The other eight could only have been seen by pressing
   "Thêm" on the reference, which writes, so their layouts were never observed
   and are not reproduced. Adding one of them opens a plain A4 sheet of the
   clinic's own instead — the form's title, a ruled body, and a
   "Bắt đầu từ mẫu" picker that drops in one of the clinic's own
   **Danh mục → Bệnh án mẫu** entries. Every index row therefore produces a
   sheet that can be written on and saved; none of them claims to be the
   reference's printed form.
2. **No `Đồng bộ phiếu`.** The reference's button copies patient details into
   the sheet's header cells. What it copies was not observed, so it is left out
   rather than guessed — see `docs/clone/unknowns.md`.
3. **Table headers are uppercase.** `index.css` uppercases every table header in
   the app; the reference uses sentence case at 14px/500. Changing it would
   touch every screen including the frozen `/taxonomy`, so it is left alone and
   noted here.
4. **The tab row wears the app's pills.** The reference draws a flat underlined
   row here. BlueDental switches screens with pills everywhere else — Danh mục,
   Labo, Vật tư — and staying consistent inside the application was chosen over
   matching the reference on this one row. It sits on the same white strip
   `/materials` uses, sharing the card with the Chi tiết hồ sơ / Bệnh án switch.
5. **Hình ảnh follows the reference again.** On 2026-08-28 the gallery was
   stretched to fill the screen; on 2026-09-05 the tab was rebuilt to the
   measurements in *Tab 5* above — content-height toolbar and day timeline,
   280px cards, drag-to-reorder within a day, a free in-house viewer in place of
   lightGallery — so it is once more a short box with white space under it.
6. **`Chăm sóc sau điều trị`** column on the Hồ sơ table still needs care
   records tied to a treatment stage, which BlueDental does not model. A column
   that could only ever say "Chưa chăm sóc" would state something it cannot know.
7. **Hóa đơn** is ahead of the reference, not behind it.

### The hồ sơ dialog

`Chỉnh sửa hồ sơ` on the record opens the **same** `PatientEditorDialog` the
list opens — one dialog, 1240px, seventeen fields across three columns,
including **Thẻ hồ sơ**. It once looked like a different screen here: the
dialog's styling lives in `patient-management/components/patient.css`, which
only `PatientManagementPage` imported, so opening it from a record produced an
unstyled form whose tag field was invisible. The dialog imports its own
stylesheet now. `patient.spec.ts › the record opens the same hồ sơ dialog the
list opens` holds the two entry points to the same field list.

Beside the patient's name sits the tag chip: 32×24, `#E7F0FB` on `#2671D8`,
4px radius, no border — measured off the reference's computed styles.

---

## Survey pass 2026-08-31 (tối) — Bệnh án, đọc từ phiếu thật

Lần khảo sát trước tôi ghi "tám biểu mẫu không quan sát được vì bấm *Thêm* là
ghi". Nay trên bản gốc **đã có sẵn ba phiếu**, nên đọc được mà không cần ghi gì.
Toàn bộ phần dưới đây đo trên phiếu có thật, chỉ đọc.

### Mục lục — phiếu nằm **lồng trong hàng biểu mẫu**

Đây là điểm tôi dựng sai trước đó: tôi để phiếu thành hàng chip phía trên khung
giấy, còn bản gốc **nhét mỗi phiếu thành một thẻ ngay dưới biểu mẫu sinh ra nó**.

| Thành phần | Bản gốc |
|---|---|
| Panel | 320px, `rounded-xl`, viền `--bd-line`, dính `top: 132px` |
| Đầu panel | Icon + "Mục lục bệnh án" + "N biểu mẫu" (**đếm phiếu**, không phải biểu mẫu) + nút thu gọn |
| Hàng biểu mẫu | `rounded-2xl`, nền tint riêng, `padding: 8px 10px` |
| Thẻ phiếu | 268x113, `rounded-xl`, viền 2px `#D7E0ED`, nền trắng, `shadow-sm`; hover nhấc `-2px` |
| Thẻ đang mở | viền `#2671D8`, nền `#EAF2FD`, quầng `ring-2` 20% |
| Trong thẻ | chip icon 36px, tiêu đề (2 dòng, 14px/500 `#1B2A41`), huy hiệu `Bản 01` + `Tạo: dd/MM/yyyy HH:mm` |
| Huy hiệu | `#E5F0FF` trên `#1769E0`, 11px/700, bo 6px |
| Bên phải thẻ | ô tích (góc trên) và ba nút in / sửa / xoá, `#53657D` |

`Bản NN` đánh số **trong phạm vi từng biểu mẫu**, đệm hai chữ số.

Panel phải: `Bản NN` (12px/400 `#1B2A41`) trên tên biểu mẫu (16px/500 `#2671D8`).

Thanh dưới **nổi giữa trên tờ giấy**, bo tròn, có đổ bóng — không phải footer
chạy hết chiều ngang.

### Ba biểu mẫu đọc được

Bản gốc dựng mỗi tờ A4 trong **`<iframe>`** (cách ly để in). BlueDental dựng
thẳng trong trang; khác kiến trúc nhưng cùng kết quả in.

**1. Bìa hồ sơ bệnh án** — mẫu bìa chuẩn Bộ Y tế. Đếm được **20 checkbox** và
**36 ô contenteditable**:

- 2 checkbox giới tính (Nam/Nữ)
- 15 checkbox trong bảng "Phần kiểm soát", 3 checkbox ở ba dòng kết quả
- Bảng kiểm soát là **hai cột `Nội dung` / `Đầy đủ / Đạt` cạnh nhau**, mục ghép
  đôi theo hàng; ô nhãn phải để trống **vẫn có** ô tích; nhóm
  "6. Thanh toán ra viện" tích ngay trên **dòng tiêu đề** và không có mục con
- Hai cột `Số lượng (ngày)` của bảng thành phần **không điền được** — là chỗ
  trắng in ra viết tay
- Mã bệnh nhân, họ tên, ngày sinh, tuổi, địa chỉ **được mồi từ hồ sơ nhưng vẫn
  sửa được**

**4. Phiếu Tư Vấn Tổng Quát** — **không có ô nhập nào**. In ra rồi điền tay, nên
không có gì để lưu.

**2. Bệnh án ngoại trú Răng Hàm Mặt** — đã dựng từ trước, dùng chung tờ A4 mà
Danh mục vẽ cho "Bệnh án mẫu".

### BlueDental làm theo

- Mục lục dựng lại đúng: thẻ phiếu lồng trong hàng biểu mẫu, đủ huy hiệu
  `Bản NN`, ngày tạo, ô tích, in / đổi tên / xoá.
- Dựng mới `MedicalRecordCoverSheet` (biểu mẫu 1, 2 mặt, 20 ô tích) và
  `MedicalRecordConsultationSheet` (biểu mẫu 4, chỉ để in — nút **Lưu** khoá lại
  vì không có gì để lưu).
- Thanh dưới nổi giữa trên giấy như bản gốc.
- Sáu biểu mẫu còn lại vẫn mở tờ A4 trắng của phòng khám, bắt đầu được từ
  "Bệnh án mẫu" — bố cục in của chúng vẫn chưa quan sát được.

### Còn khác, có chủ ý

1. **View Bệnh án nằm trong URL của BlueDental** (`?view=medical-record`), bản
   gốc giữ nguyên `?tab=...` và không ghi view vào URL. Giữ bản của tôi: có thế
   mới gửi link thẳng tới bệnh án được, và test dựa vào đó.
2. **Không có `Đồng bộ phiếu`.** Bản gốc có nút này; nó chép thông tin bệnh nhân
   vào các ô đầu phiếu. Chép những gì thì chưa quan sát được — xem
   `docs/clone/unknowns.md`.
3. **Letterhead phòng khám để trống.** Bản gốc in tên/địa chỉ/điện thoại chi
   nhánh lên biểu mẫu 1 và 4. Lấy được dữ liệu đó phải import chéo feature
   (`organizations`), mà CLAUDE.md muc 4.2 cấm. Cần một hook dùng chung cho
   thông tin chi nhánh rồi mới nối vào — chưa làm trong đợt này.
4. **Ô tích trên thẻ phiếu** dùng để chọn phiếu đem in / xem ở chế độ "Toàn bộ".
   Bản gốc dùng nó làm gì thì chưa quan sát được; đây là suy đoán, đã ghi vào
   `unknowns.md`.

---

## Đối chiếu ảnh chụp — tab Chẩn đoán & Tư vấn (2026-08-31)

Chụp bản gốc và local **cùng khung 1920x900**, đặt cạnh nhau. Ảnh nằm trong
`reference-private/survey-patient/` (có dữ liệu bệnh nhân thật, không commit).

Lần chụp đầu tôi rơi vào một bệnh nhân **do e2e tạo** nên tab trống trơn —
danh sách sắp mới nhất trước, mà 20 bệnh nhân mới nhất đều là rác test hôm nay
(`BD260044`–`BD260055`, 0 chẩn đoán). Trong 63 bệnh nhân thì **43 có dữ liệu
lâm sàng**; seeder không thiếu. Đã chụp lại trên bệnh nhân có dữ liệu thật.

### Khớp

Panel ảnh bên trái (ba nút icon xếp dọc, vùng thả ảnh gạch đứt, đúng câu chữ),
thẻ "Tạo chẩn đoán" + nút tròn xanh, hai dòng chữ xanh bên phải, sáu cột, cụm
thao tác `Tạo Dịch Vụ` + lịch + thùng rác, nút "Phiếu tư vấn" và dòng chữ xanh
dưới cùng.

### Lệch, đã sửa

| Chỗ | Bản gốc | Local (trước) |
|---|---|---|
| Số phiếu | `#2671D8`, 14px/**700** | navy `#1c3566`, 600 |
| Răng | `#2671D8`, 14px/**700** | **không xanh được** |
| "Chưa cập nhật" | `#E5484D`, 500 | `#d4380d`, 600 |

Ô "Răng" là **lỗi độ đặc hiệu CSS**: `.pd-cell-link` đặt trên cùng thẻ `<b>` mà
`.pd-cell-stack > b` nhắm tới, mà selector sau đặc hiệu hơn (0,1,1 so với 0,1,0)
— nên màu xanh **chưa bao giờ hiện ra** kể từ khi viết.

Thêm token dùng chung `--bd-link: #2671d8` vào `:root`. Nó **không phải**
`--bd-blue` (`#1c3566`) — token kia là navy thương hiệu của app. Bản gốc dùng
`#2671D8` cho link và viền chrome đang chọn; trước đây màu này nằm rải rác dạng
hex thô trong `calendar.css`. Chỉ áp token vào **bốn chỗ đã đo được** là màu đó:
số phiếu, ô răng, tiêu đề panel phiếu bệnh án, viền thẻ phiếu đang mở, và chip
thẻ hồ sơ.

### Lệch, **không** sửa — vì thống nhất nội bộ thắng

| Chỗ | Bản gốc | BlueDental | Lý do giữ |
|---|---|---|---|
| Header bảng | `text-transform: none`, 14px/500, nền `#F6F8FB`, padding `8px 16px` | `uppercase`, 11.5px/700, nền `#FAFBFD` | `index.css` viết hoa header **toàn ứng dụng**. Sửa là đụng mọi màn, kể cả `/taxonomy` đang đóng băng |
| Phân trang | ô "20 / trang" **trước**, rồi "Hiển thị …" | "Hiển thị …" trước, rồi ô chọn | Thứ tự do AntD `showTotal`/`showSizeChanger` qua `useTablePagination` dùng chung |
| Cỡ chữ ô | 14px | 13px (dòng chính) / 12px (dòng phụ) | Cùng thang chữ với mọi bảng khác trong app |
| Hàng tab | gạch chân phẳng | pill | Đã chốt ở lần trước theo yêu cầu đồng bộ với `/materials` |

Ba dòng đầu là **một quyết định**: đổi thang chữ và kiểu header cho khớp bản gốc
thì phải đổi toàn ứng dụng. Cần anh chốt trước khi làm.

### Còn tồn — rác dữ liệu test

E2E tạo bệnh nhân mới mỗi lần chạy và **không dọn**, nên đầu danh sách bệnh nhân
ngày càng nhiều hồ sơ rỗng. Không phải lỗi sản phẩm nhưng làm demo khó xem và
làm chính việc đối chiếu ảnh bị sai lần đầu. Nên cho các spec đó dọn hồ sơ chúng
tạo ra, hoặc seed lại DB trước mỗi đợt đối chiếu.

---

## Đối chiếu cột từng tab (2026-08-31) — sau khi seed đủ dữ liệu

Trước đợt này bốn tab không so được vì local trống: **Hình ảnh** 0 dòng,
**Hóa đơn** 71 dòng nhưng dồn hết vào **một** bệnh nhân, **Labo** 5 bệnh nhân,
**Chăm sóc KH** 11. Nay cả bốn phủ **63/63** bệnh nhân chi nhánh 1.

Cột local đối chiếu với bản ghi khảo sát bản gốc ở trên:

| Tab | Bản gốc | Local | Kết quả |
|---|---|---|---|
| Labo | 3 chip + `Tạo phiếu Labo`, 10 cột | 3 chip + nút, 10 cột đúng tên | tên cột khớp; ô, pill, thao tác và dialog lệch — dựng lại 2026-09-05 (Tab 6) |
| Đơn thuốc | Mã đơn thuốc · Bác sĩ · Chẩn đoán · Tái khám · Ngày tạo · Thao tác | y hệt | khớp |
| Chăm sóc KH | 8 chip, `CSKH đặc biệt`, 9 cột, phân trang đếm "nhật ký" | 8 chip **có số thật**, đủ nút, 9 cột, đếm "nhật ký" | khớp |
| Lịch sử dư nợ | Ngày giao dịch · Loại · Số tiền · Nhân viên · Ghi chú | y hệt | khớp |
| Hình ảnh | select `Giai đoạn điều trị` + `Tải ảnh`, thẻ gallery | y hệt, nay có ảnh thật | khớp |
| Hóa đơn | **`Nội dung đang được hoàn thiện.`** trên bản gốc | bảng thật, 7 cột | BlueDental **đi trước** |

Hai chỗ số đếm trông sai nhưng **kiểm tra ra là đúng**:

- Chip Lịch hẹn đọc `319 Đã hẹn / 80 Đã đến / 3 Đã huỷ / 4 Trễ hẹn`. Trông như
  đếm toàn chi nhánh, nhưng bệnh nhân demo này thật sự có **406 lịch hẹn**
  (319+80+3+4). Seeder lịch hẹn dồn nhiều lịch vào một hồ sơ — lệch dữ liệu,
  không phải lỗi giao diện.
- Chip CSKH từng đọc 0 hết dù có 3 dòng. Ba dòng đó do seeder cũ tạo, đều ở
  trạng thái *chưa chăm sóc* — nên **0 là đúng**. Đã xử lý ở phần seed bên dưới.

### Seed lại cho bốn tab

Seeder mới `BlueDentalPatientTabsDemoSeeder` chạy **theo từng bệnh nhân**:
3 ảnh, 2 hóa đơn (một đã thu đủ, một thu 40% để tab dư nợ có số dư), 1 phiếu
labo, 2 lượt CSKH (một đã hoàn thành và có đánh giá, một còn mở).

Hai điều đáng ghi:

1. **Ảnh phải có file thật.** `PatientImage` giữ `BlobName`; seed suông thì
   thumbnail vỡ. `DemoPngWriter` sinh PNG gradient ngay trong code (tự dựng
   IHDR/IDAT/IEND, CRC32 trên `ZLibStream`) — không commit file nhị phân, không
   thêm thư viện ảnh. Kéo theo: **DbMigrator nay phải cấu hình MinIO** như
   HttpApi.Host, nếu không `IBlobContainer` không resolve được.
2. **Phiếu labo phải trỏ vào bản ghi supplier/material**, không chỉ tên. Seeder
   cũ đã cố ý làm vậy và có comment giải thích; bản đầu của tôi để null nên cột
   Nhà cung cấp / Vật liệu ở `/labo/mau-labo` thành "—" và test canh đúng chỗ đó
   đỏ ngay.

Điều kiện idempotent kiểm **theo đúng id sẽ tạo**, không phải "bệnh nhân này đã
có bản ghi nào chưa". Hỏi kiểu sau thì bản ghi của seeder khác chặn mất seeder
này — đó chính là lý do tab CSKH của bệnh nhân demo chính vẫn đọc 0 hết. Chạy
migrator hai lần liên tiếp cho ra **đúng cùng số dòng**.

---

## Nút tag và bảng chọn tag — đo trên bản gốc (2026-09-03)

Khảo sát **chỉ đọc**: đăng nhập, mở popover, đo, đóng. **Không bấm vào tag nào**
— bấm là gắn tag thật vào hồ sơ bệnh nhân trên production.

| Thành phần | Bản gốc |
|---|---|
| Nút | `aria-label="Thêm tag"`, **32×24**, nền `#DCEBFA`, icon `#2671D8`, bo 4px, không viền |
| Bảng | **258px**, mở **dưới nút, mép trái thẳng mép nút** (không phải canh phải), hở **9px**, **không có mũi tên** |
| Ô tìm | đặt trong khối `padding: 12px`, gạch dưới `#DCE3EE`, placeholder `Tìm tag` |
| Dòng tag | cao **40px**, `padding: 8px 12px`, `gap: 8px` |
| Chip | chữ **12px/700** trắng, nền lấy theo màu tag |
| Đang gắn | có **dấu tích** ở mép phải |

BlueDental đã chỉnh theo đúng các số này: đổi `bottomRight` → `bottomLeft`, tắt
mũi tên (chính nó tạo ra khoảng hở 16px thay vì 9px), panel 258px, dòng 40px,
chip 12px/700, nút đổi nền `#e7f0fb` → `#dcebfa`.

Đo lại sau khi sửa: rộng **258** (gốc 258), hở **8** (gốc 9), lệch trái **4**
(gốc 1), dòng **40** (gốc 40).

Một điểm **bản gốc cũng bị**: ở cửa sổ hẹp, cột `Thao tác` ghim phải của bảng
che mất phần đuôi tiêu đề `Phương thức thanh toán`. Không phải chuyện BlueDental
làm sai — nên test đo phần này chạy ở khổ đủ rộng chứ không khẳng định điều mà
bản gốc cũng không giữ.

## Chẩn đoán & Tư vấn — đo lại panel ảnh và nút "+" (2026-09-03)

Khảo sát **chỉ đọc** ở 1600×950. **Không bấm nút "Thêm ảnh"** — nó mở hộp chọn
file và dẫn tới upload thật.

### Nút "Tạo chẩn đoán +"

Cả cụm là **một** `<button>` 146×28 chứa nhãn và vòng tròn:

| Phần | Bản gốc |
|---|---|
| Nhãn | **16px/700**, `#1B2A41` |
| Vòng "+" | `<span>` **28×28**, tròn, nền `#2671D8`, icon **16px** trắng |
| Thanh đầu thẻ | `sticky top-0 z-30`, nền trắng, gạch dưới `#DCE3EE`, cao 67px |

BlueDental trước đó dùng nút tròn mặc định của AntD (**32px**) nên nhìn nặng
hơn tiêu đề. Đã ép về 28px, icon 16px, và nhãn đổi 600 → **700**.

### Panel ảnh — ba nút và hành vi

| Nút | Icon | Bấm vào ra gì |
|---|---|---|
| `Thêm ảnh` | `lucide-zoom-in` | Mở hộp chọn file để tải ảnh (**không thử**) |
| `Danh sách ảnh` | `lucide-grid-2x2` | Modal **"Chọn ảnh hiển thị"**, rỗng ghi "Chưa có ảnh nào.", footer `Chọn tất cả` + `Xong` |
| `Danh mục` | `lucide-list` | Popover **"Dữ liệu tư vấn"**, rỗng ghi "Không có danh mục." |

Lưu ý: icon nút đầu là kính lúp nhưng **chức năng là tải ảnh**, không phải zoom.

| Thành phần | Bản gốc | BlueDental |
|---|---|---|
| Thẻ ảnh | 350px, trắng, viền 1px `#DCE3EE`, bo 12, đệm 8 | khớp |
| Vùng thả | `#E6EAF0`, bo 12, cao 240, rộng 332 | khớp |
| Ba nút | 36×36, `rgba(0,0,0,.8)`, bo 6, cách 4px, icon trắng | khớp |
| Chữ vùng thả | 14px/500 `#5A6B82` | khớp |

Ba hành vi và toàn bộ số đo panel ảnh **vốn đã đúng** và đã có test từ trước;
lần này chỉ nút "+" phải sửa.

### Còn khác, có chủ ý

Vòng "+" ở bản gốc là `#2671D8`; BlueDental vẽ bằng màu primary của **v2**
(indigo `#6366f1`) cho thống nhất với toàn ứng dụng sau đợt restyle. Kích thước
thì đã khớp.

### Panel ảnh — cách ảnh được chọn và xem (đo 2026-09-03)

Bên bản gốc nay đã có ảnh thật nên quan sát được đầy đủ. **Không bấm "Thêm
ảnh"** (mở hộp chọn file).

**Ngoài panel.** Ảnh được chọn xếp **dọc**, mỗi tấm bọc trong `<a>` cao 240px,
`object-fit: cover`, bo 12px, cách nhau 8px, rộng hết thẻ (332px). Bấm vào mở
**overlay xem ảnh** — bản gốc dùng lightGallery (`lg-react-element`).

**Modal "Chọn ảnh hiển thị".**

| Thành phần | Bản gốc |
|---|---|
| Modal | rộng **1024px** |
| Tiêu đề nhóm | ngày chụp, **12px/600** `#5A6B82` |
| Thẻ | **280px**, bo **22px**, đệm **12px**, nền trắng, đổ bóng `0 10px 24px rgba(15,23,42,.05)`, **viền xanh khi được chọn** |
| Ảnh trong thẻ | **254×190**, `object-fit: cover`, bo **18px** |
| Ô tích | đè lên góc trên trái của ảnh |
| Dưới ảnh | tên file, rồi `dd/MM/yyyy HH:mm` |
| Góc dưới phải | hai nút tròn: **kéo sắp xếp** và **xoá** (đỏ) |
| Footer | `Chọn tất cả` + `Xong` |

**BlueDental làm theo**, với ba điểm hành vi anh yêu cầu:

1. **Ảnh mới tải lên hiện ngay.** Trạng thái lưu là danh sách *bị ẩn*, không
   phải danh sách *được chọn* — nên một tấm vừa có là hiện luôn, không phải vào
   chọn thủ công. `Chọn tất cả` xoá sạch danh sách ẩn.
2. **Tải ảnh có loading**: nút "Thêm ảnh" quay, vùng thả đổi thành `Spin`.
3. **Bấm ảnh mở overlay**: dùng `Image.PreviewGroup` của AntD — có đếm `1 / 3`,
   nút chuyển ảnh, xoay/lật/zoom, nền mờ `rgba(0,0,0,.45)`. Dùng component sẵn
   có của app thay vì thêm lightGallery.

Nút xoá trên thẻ nối vào `useDeletePatientImage` đã có sẵn.

**Chưa làm:** nút kéo sắp xếp mới chỉ có hình. Bản gốc lưu thứ tự ở đâu thì chưa
quan sát được — ghi vào `unknowns.md`.


---

## Survey pass 2026-09-05 — Lịch hẹn row actions and the edit dialog

Observed read-only on staging from the user's screenshots; nothing that could
save was pressed on the reference, and no patient data is recorded here.

### Thao tác column

Two icon buttons per row: a pencil (edit) and a red trash. The trash opens a
confirm dialog:

| Part | Reference |
|------|-----------|
| Title | `Xoá lịch hẹn` |
| Body | `Bạn có chắc muốn xoá lịch hẹn này không?` over `Hành động này không thể hoàn tác.` |
| Footer | `Huỷ` (outline) · `Xoá` (red) |

### "Cập nhật lịch hẹn" dialog

The pencil opens the same shell and three columns as **Tạo lịch hẹn** (§2 of
the 2026-08-28 (2) pass), titled **Cập nhật lịch hẹn**, fields pre-filled.
Column 3 starts with a **Trạng thái** select above the `Ghi chú` card. On a
`Trễ hẹn` appointment it offered exactly two options, `Đã huỷ` and `Trễ hẹn`,
the current one ticked. The status is saved by the same `Lưu` as the rest.

BlueDental: the select always offers `Đã hẹn` · `Đã huỷ` · `Trễ hẹn`, in that
order, and shows `Đã đến` only as the current value of a visit that arrived
(the user's decision, 2026-09-05, so a cancelled or late appointment can be put
back on the book from the same dialog). What the reference offers for a booked
or cancelled appointment is in `unknowns.md`.
