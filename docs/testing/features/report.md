# F-17 / F-18 — Báo cáo (`/report`)

Status: `VERIFIED` (2026-09-22, run (2) of the evening) · Verified commit:
uncommitted working tree — see `01-feature-verification-registry.md`

## Scope

The four tabs of the report screen, all on the real API since 2026-09-21:

1. Doanh số và lượt khách — five sub-tables, the "Doanh số" tile, four bottom
   cards, server-generated Excel for Thanh toán and Hoàn tiền.
2. Quản lý thu chi — receipts, expenses with approval, per-type categories,
   browser-generated Excel.
3. Kết quả kinh doanh — six fixed rows.
4. Luân chuyển dòng tiền V2 — balances, deposits / withdrawals / transfers,
   cashbook categories, browser-generated Excel.

F-04 / F-05 (`features/finance.md`) keep the two server rules; this file
covers the screen.

## API surface

```
GET  /api/v1/app/clinic-reports/{service-lines,payment-lines,refund-lines,debt-lines,prepaid-lines}
GET  /api/v1/app/clinic-reports/{sales-summary,overview-stats,payment-stat,business-result}
GET  /api/v1/app/clinic-reports/{patient-history,business-result}/excel
GET  /api/v1/app/sales, /sales/stats
POST /api/v1/app/sales · PUT /sales/{id} · PUT /sales/{id}/approve (no body) · DELETE /sales/{id} (soft)
GET/POST/PUT/DELETE /api/v1/app/cashflow-categories[/{id}]
GET  /api/v1/app/cash-management/{balance,cashflow-overview,cashflow-entries}
POST/PUT/DELETE /api/v1/app/cash-management/cashflow-entries[/{id}]
```

Structure in `docs/clone/api.md` ("Báo cáo — Thu chi, Sổ quỹ, Doanh số").

## Rules under test

- URL state: `reportTab`, `report_dateMode`, `report_date`, `salesTab`
  round-trip; a plain `/report` becomes `?report_dateMode=day&report_date=<today>`
  on load (reference behaviour), every mode click writes its value, the
  default tab is left out; the doctor filter is hidden on tab 3.
- Tab 1: the "Doanh số thực" pill shows the 8-column plan-line table and no
  overview charts; downloads are real files: Thanh toán has the reference's
  15 headers in order with numeric amount cells and a
  `THANHTOAN-NN/DTNN/yyyy` code; Hoàn tiền has the 7 headers.
- Tab 2: a category is created, renamed and deleted per type; the receipt
  dialog's Hình thức is the searchable four-item list (Tiền mặt / Chuyển
  khoản / Quẹt thẻ / Dư nợ); a receipt shows in the table with its category
  and method; an income row has only Chỉnh sửa + In (no delete), its edit
  dialog is "Chỉnh sửa khoản thu"; a pending expense carries the four round
  buttons (Duyệt chi / Chỉnh sửa / Xoá / In) and is excluded from "Tổng chi
  phí"; Duyệt chi goes through "Xác nhận duyệt" and leaves only In on the
  row; the In button opens "Chi tiết phiếu" (clinic / customer blocks, one-row
  table, Tổng cộng, "In chi phí" / "In thu nhập"); a second expense stays
  "Dự chi" (also in the Excel file), is edited via "Chỉnh sửa chi phí" and
  deleted through "Xác nhận xoá" ("Đã xoá phiếu thu chi"). Validation:
  "Vui lòng nhập số tiền", "Mục thu là trường bắt buộc.". Deleting a
  category still in use succeeds ("Đã xoá nhóm") and the vouchers keep its
  name. Both Excel files open with the title in row 1, headers in row 3 and
  the bundle's column widths; the customer column is `payerName` or "—".
- Tab 3: the six rows are present and carry numbers from the API.
- Tab 4: Nạp lists Tiền mặt / Chuyển khoản / Cà thẻ (đối soát) and shows the
  "Số dư khả dụng" line only for the card holding, labelled "(Cà thẻ chờ đối
  soát)"; Rút lists two and the line follows the chosen holding; a deposit
  moves Tổng Tiền Mặt, a withdraw above the balance is refused inline ("Số dư
  không đủ…"); in Luân chuyển both selects list both holdings, picking one
  side onto the other flips the other side (no error text, the balance line
  follows the source), a
  transfer moves cash → bank, edit goes through PUT (no duplicate row), hủy
  restores the balance, the creator column shows the real user name, cashbook
  categories CRUD (colour stored), the Excel file matches the spec.
- Responsive: no horizontal overflow at 1280 / 1100 / 640.

## Acceptance evidence

`e2e/report.spec.ts` — 5 tests, `e2e/finance.spec.ts` — 2 tests. Run
2026-09-22 on the production build (`vite preview` :8080) against the real API
(:5000) and PostgreSQL after migration
`20260922000000_AddCategoryColorAndPayerName`; real login;
`assertRealApiTraffic` proves the page talks to `/api/v1/app/...` with no
interception. **7/7 green (1.2 min).** Retest level 2 (feature-local FE + BE
+ a nullable-column migration). Re-run the same afternoon after the tab-4
dialog changes (balance line rules, symmetric holding flip, stale-error fix —
R-367 → R-369): **7/7 green (1.2 min)**, FE-only change, retest level 2.
Re-run 2026-09-22 (evening) after the staging sync (row actions, confirm
dialogs, print preview, soft delete, approve without body, categories
deletable while in use, `cashflowTab` URL param, tab-1 Tạm ứng tiles —
R-370 → R-379): **7/7 green (1.3 min)**, FE + BE (no migration), retest
level 2. The specs now tidy their categories, so the category tables stay
on page 1 (R-376).
Re-run 2026-09-22 (evening, 2) after the four-tab re-check against the
staging bundle (per-type voucher labels and "In khoản thu", 8-column detail
table, 7-column print sheet, permission gating, "Chỉnh sửa danh mục …",
tab-4 View modal "Chi tiết phiếu" / "In Hoá Đơn" with the money in words,
tile tones, category pill colours, tab-1 Dư nợ chips and red "(đã huỷ)" —
R-380 → R-387): **7/7 green (1.4 min)**, FE + BE (new DTO fields, no
migration), retest level 2. The spec now opens the tab-4 voucher modal and
finds the row buttons by their reference labels ("Xem chi tiết", "Chỉnh
sửa", "Hủy", "In khoản thu", "In chi phí").

Backend: `dotnet build` clean; `CashManagementAppServiceContractTests` (9,
reflection-only contract checks). There is **no** real-HTTP backend test for
`ClinicReportAppService`, `SalesEntryAppService` or `CashManagementAppService`
— `BlueDental.HttpApi.Host.Tests` has no WebApplicationFactory / Testcontainers
infrastructure yet. The browser specs above are the runtime evidence.

## Reference comparison

Seven reference dialogs were opened (never saved) and match field for field —
`docs/clone/pages/report.md` §Dialogs. Tab-2 / tab-4 export files could not be
downloaded with data (the reference branch had no rows in any period, only the
"Không có dữ liệu để xuất" toast); their layout is taken from the bundle's
export component and column tables. A staging account would let us capture
real files.

## Known deviations (raised, not invented)

2026-09-22, on the owner's "make it match, don't ask": payment code format,
`ColorCode`, Người nộp / Người nhận, the card-reconciliation holding, default
period + URL shape, pager sizes, the "Doanh số thực" pill and every dialog
option list now match the reference (`docs/clone/pages/report.md` §"Đợt đồng
bộ 2026-09-22"). Two of them rest on stated ASSUMPTIONS: the `TAMUNG` code
shape and the "Doanh thu dịch vụ" / "Cà thẻ chờ đối soát" formulas (the
reference showed 0 for both).

2026-09-22 (evening), on the owner's "làm local luôn, giống ref app 100%":
the tab-2 write flows were exercised on **staging** (allowed) and rebuilt
locally — per-row round buttons, no reject, "Xác nhận duyệt" / "Xác nhận
xoá" dialogs, the "Chi tiết phiếu" print preview with a hidden A4 sheet,
the reference toasts and validation texts, soft delete, approve as `PUT`
without body, categories deletable while in use (names kept via a
soft-delete-filter bypass), "Tổng chi phí" = approved only, `payerName` in
the customer column and the Excel files, `cashflowTab` in the URL, tab-1
Tạm ứng tiles / event labels / row spans and the sixth Thanh toán tile
(`docs/clone/pages/report.md` §"Đợt đồng bộ staging 2026-09-22").

2026-09-22 (evening, 2), "kiểm tra kỹ … hoàn thiện cho giống 100%": every
tab was re-read against the staging bundle. Fixed: per-type voucher labels
("In khoản thu" / "In chi phí", Ngày thực thu / chi, Người nộp / nhận), the
detail modal's 8 columns and the print sheet's 7 columns, per-button
permission gating (`useReportPermissions`), "Chỉnh sửa danh mục …" titles,
category action widths and upper-case colour codes, tab-4 tile tones (blue /
green / gold / violet), the tab-4 "Xem chi tiết" voucher modal ("Chi tiết
phiếu", PHIẾU THU / CHI / LUÂN CHUYỂN DÒNG TIỀN, Bằng chữ, "In Hoá Đơn"),
category pills coloured by `categoryColor`, tab-1 Dư nợ chips "(đã hủy)" /
"(thay thế)", the red "(đã huỷ)" after cancelled services in Thanh toán, the
Dư nợ / Chi phí column widths and the "dòng" / "phiếu" counters
(`docs/clone/pages/report.md` §"Đợt đồng bộ staging 2026-09-22 (2)").
Stated ASSUMPTIONS: `@page` A4 10mm, tab-2 action column 180 / 100 instead
of the reference's 70 sticky, tab-4 "Nội dung" = note.

2026-09-22 (evening, 3), the owner answered the open list: toast after
Duyệt = "Duyệt chi phí thành công" (owner's "decide yourself"), printing =
`window.print` (confirmed), the income / expense category delete dialog =
"Xác nhận xoá" with the name in bold (staging screenshot — local now
matches, cashbook keeps "Xác nhận xoá danh mục"), the tab-4 hủy dialog =
"Xác nhận hủy giao dịch" / note in bold / red "Hủy giao dịch" / toast "Đã
hủy giao dịch" (owner's "decide yourself"), the tile formulas stay as
implemented (owner's "what do you think" → documented decision). Re-run:
**7/7 green (1.4 min)** on `dist-preview4` :8080, FE-only, retest level 2
(plus an additive `confirmLabel` prop on the shared `ConfirmDeleteDialog`,
whose 27 other callers keep the default "Xoá" — level 3 not triggered, no
behaviour change for them).

2026-09-22 (evening, 4), the owner's staging screenshot of sub-tab Tạm ứng
(year view): the "DT" half of a payment code is the slip's own code
(`THANHTOAN-31/DT32/2026`, DT32 = HN8521's "Test DV") — `FormatCode` now
takes the plan code and `PatientPaymentAppService` looks it up (earlier rows
keep their issued code); the deposit row shows its voucher (blue) instead of
"-"; tiles are "Tạm ứng phát sinh" blue / "Tiêu dùng tạm ứng" gold /
"Hoàn tiền tạm ứng" red / "Số dư tạm ứng hiện tại" violet; amounts are
signed and coloured by sign; Số dư sau is blue; the balance tile is all-time
(staging: 10.070.000 tile beside a 5.570.000 pill). Stated ASSUMPTIONS: the
`TAMUNG` shape for a slip-less top-up, the all-time formula. Not built: the
slip-bound consumption / transfer / replace events (local deposits are held
outside any slip — `docs/clone/unknowns.md`). Re-run: **7/7 green (1.5
min)** on `dist-preview5` :8080 with the rebuilt host on :5000, retest level
2 for /report; the code change touches the patient-payment write path (F-39
plan page issues codes) — its shape for payments is unchanged apart from the
DT segment, and the `report.spec.ts` regex still passes.

Still open: the "Nạp vào dư nợ" / "Rút dư nợ" rows (owner: not sure yet),
the tab-1 staging workbook, the red "(Đã hủy)" rich text inside the Excel
file, the slip-less prepaid code and the slip-bound deposit events — all in
`docs/clone/unknowns.md`.
