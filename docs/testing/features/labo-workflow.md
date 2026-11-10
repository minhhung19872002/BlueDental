# F-85 — Quy trình Labo mới: Đặt hàng / Nhận hàng & kiểm tra / Bảo hành (P2910_03, R-1083)

Source: BA `P2910_03.drawio` plus the owner's twelve answers (30/10, kept in
§Decisions below). BlueDental only: the reference app has the old Labo order
(the one cloned in `docs/clone/pages/labo.md`), not this flow. The BA sources
(renders, text dump, `owner_ketluan.png`, `owner_state_machine.png`) are in
`reference-private/p2910_03/` and are never committed.

## Decisions (owner, 2026-10-30)

| # | Topic | Decision |
|---|---|---|
| 1 | Branch | develop |
| 2 | Steps | One popup, 3 tabs: Đặt hàng / Nhận hàng & kiểm tra / Bảo hành. Trả hàng is recorded inside tab 2 |
| 3 | Old data | Mapped onto the new statuses (table under Migration). Giao trễ is no longer picked by hand; it follows the due date |
| 4 | Old child orders | The Làm tiếp công đoạn / Bảo hành child tabs are gone. Old child orders still open read-only. Tiếp nhận bảo hành (Lần BH, BH1) is a later round; "Lần BH" shows 0 |
| 5 | Kết luận box | Exactly `owner_ketluan.png`: "Lý do lỗi \*" kept as a heading without chips; Mô tả gửi Labo\*; Ngày trả hàng\* / Hẹn Labo giao lại\*; Chi phí phát sinh grey, disabled, "0 đ". No Răng trả lại, Bên chịu lỗi, checkboxes, or Bên chịu column |
| 6 | Who moves the status | Saving Nhận hàng → Chờ kiểm tra; all teeth Đạt → "Xác nhận Labo đạt" → Hoàn thành; "Kiểm tra Labo" on Đã gửi Labo, Chờ kiểm tra and Trả hàng |
| 7 | Partial pass | Passed teeth show on Bảo hành but activate only once the whole order is Hoàn thành. The next check re-checks the failed teeth only (Trả toàn bộ re-checks all) |
| 8 | Warranty | No card sending. "Kích hoạt bảo hành (n răng)", per tooth. Order → Bảo hành on the first activation. Hết hạn computed at read time. Card code `BH-{service line code}-{ddMMyyyy of start}-{xx}`, xx from 01 per line and start day, shared with the line's Dịch vụ cards (R-1090; was `BH-{yyMM}-{last 4 of LABO}-{tooth}`). An order without a service line cannot activate (`Labo:0037`, owner to decide) |
| 9 | Hoàn thành lock | The công đoạn that raised the order **and** the later công đoạn of the same service line lock (the raising one was exempt until the owner's review the same day — see §BA recheck); those worked before it stay tickable. They lock until the order is Hoàn thành / Bảo hành / Hết hạn. Đã hủy does not lock, Nháp does. "Kích hoạt bảo hành" sits on the line's latest công đoạn. The old green treatment "Bảo hành" button is untouched |
| 10 | Plan column | Newest non-cancelled order: "Chờ Labo" (Nháp → Hoàn thành), "Bảo hành" (Bảo hành / Hết hạn); none, or cancelled only: "Không áp dụng" |
| 11 | `/labo` Mẫu Labo | New status pill; the hand status select (`LaboStatusSelect`) removed; Chưa nhận / Giao trễ / Đã nhận recomputed |
| 12 | Tab filter cards | Exactly six: Nháp, Trả hàng, Chờ kiểm tra, Hoàn thành, Đang bảo hành, Hết hạn bảo hành. None pressed = all; press again to clear |
| — | Permissions | Existing `treatmentLabo` leaves: `create` = Đặt hàng (Lưu nháp, Tạo phiếu Labo); `update` = receive / check / return / pass / warranty / cancel; `delete` = delete a Nháp |

## Statuses and transitions

`LaboStatus`: Draft 1 Nháp · Sent 2 Đã gửi Labo · AwaitingCheck 3 Chờ kiểm tra ·
Returned 4 Trả hàng · Completed 5 Hoàn thành · Cancelled 6 Đã hủy · Warranty 7
Bảo hành. "Hết hạn bảo hành" is not stored: `LaboOrder.IsWarrantyExpiredOn(today)`
(rows) and `LaboOrder.WarrantyExpiredOn(today)` (the same rule as a query, for
counters and filters) — status Bảo hành and every activated tooth past its end
date, Vietnam calendar day.

| From | Action (endpoint) | To | Guard |
|---|---|---|---|
| — | Lưu nháp (`POST labo-orders`, `submit=false`) | Nháp | ≤ 5 pictures (`0016`) |
| Nháp | Lưu nháp again (`PUT {id}`) | Nháp | only Nháp (`0002`) |
| Nháp | Tạo phiếu Labo (`POST`/`PUT` with `submit=true`) | Đã gửi Labo | every required field (`0015`), 1–5 pictures (`0016`), due ≥ sent (`0013`) |
| Đã gửi Labo / Trả hàng | Lưu phần Nhận hàng (`POST {id}/receive`) | Chờ kiểm tra | 1 ≤ qty ≤ ordered (`0017`), received ≥ sent (`0018`); opens round N |
| Chờ kiểm tra | Xác nhận Labo đạt (`POST {id}/check`, pass) | Hoàn thành | a result per tooth under check (`0019`, `0020`), all Đạt (`0022`) |
| Chờ kiểm tra | Trả toàn bộ / Trả hàng bị lỗi (`POST {id}/check`) | Trả hàng | a Lỗi tooth (`0021`), description + Ngày trả hàng + Hẹn giao lại (`0023`), redelivery after return (`0024`), check pictures (`0025`). Hẹn giao lại becomes the order's due date |
| Hoàn thành / Bảo hành | Kích hoạt bảo hành (`POST {id}/warranty`) | Bảo hành | order QC-passed (`0026`), tooth Đạt and not yet active (`0027`), start ≥ day passed (`0028`), months > 0 (`0029`) |
| Nháp / Đã gửi Labo / Chờ kiểm tra | Hủy phiếu (`POST {id}/cancel`) | Đã hủy (stays listed) | other statuses `0002` (422) |
| Nháp | Bin (`DELETE {id}`) | soft-deleted | only Nháp (`0030`) |

Other codes: `0031` completing a locked công đoạn; `0032` a service line of
another patient on the order; `0033` Hoàn thành of a service line while one of
its orders is unfinished (`PatientTreatmentAppService.CompleteServiceAsync`,
same rule as `IsUnfinished`, Nháp included).

## Data

- `bd_labo_order_teeth` (`LaboOrderTooth`): one row per FDI tooth —
  `CheckResult` (None / Passed / Failed), `DefectNote`, `PassedAt`, and the
  warranty card (`WarrantyCardCode`, `ManufacturerSerial`, start, months, end,
  conditions, activated at / by).
- `bd_labo_order_rounds` (`LaboOrderRound`): one row per Nhận hàng — round no,
  received at / quantity / by, checked at, outcome, return description, return
  day, redelivery day; per-tooth results of that round as jsonb
  (`ToothResults`). Unique (`LaboOrderId`, `RoundNo`).
- `bd_patient_images.LaboRoundNo`: Ảnh kiểm tra are patient images tagged with
  their round; order pictures keep `LaboRoundNo` null.
- `ToothNumbers` on the order is kept and rewritten from the teeth, so the
  print sheet, the Excel export and `/labo` read it as before.
- Migration `20261030022639_LaboWorkflowP291003` maps the old statuses in one
  `CASE`: 1→1; 2, 3, 7→2; 4→3; 5→5; 6, 8→6. It splits `ToothNumbers` into
  teeth, marks every tooth of a Hoàn thành order Đạt (`PassedAt` = received ??
  modified ?? created), and gives each order that had been received a round 1.

## Screens

- **Workflow dialog** (`features/labo/components/workflow/`, `check/`,
  `warranty/`): one popup for every "Tạo Labo" / "Tạo phiếu Labo" / "Kiểm tra
  Labo" / "Kích hoạt bảo hành" / "Xem phiếu Labo". Three step tabs, locked
  (🔒) until reached; tab 1 is read-only once sent. Kept in the URL:
  `laboModal=order`, `laboRowId`, `laboStep=order|check|warranty`. With no
  step the dialog opens on the one the status waits on.
- **Patient → Labo tab**: columns per the BA (sơ đồ răng view-only via
  `ToothChart interaction`, Phiếu ĐT link, Ngày hẹn giao with "còn N ngày" /
  red "Trễ N ngày" / "đã giao dd/MM", Trạng thái), six server-side filter cards
  (`statusFilter`), server paging. Thao tác: Xem always; plus Xoá (Nháp),
  Kiểm tra Labo (Đã gửi Labo / Chờ kiểm tra / Trả hàng), Kích hoạt bảo hành
  (Hoàn thành).
- **Plan page → Chi tiết điều trị**: column Phiếu Labo (`PlanLaboCell`) —
  chip, LABO code link opening the dialog read-only, "Dự kiến giao".
  Đổi trạng thái → Hoàn thành is disabled with "Khoá: phiếu Labo chưa QC đạt"
  while a line's order is unfinished (`ServiceStatusMenu`; BA: "vẫn cho tiếp
  tục các công đoạn… nhưng không cho hoàn thành"); the server refuses it with
  `0033`.
- **Đặt hàng locked fields** (Tên khách hàng, Kế hoạch / Dịch vụ điều trị,
  Số phiếu Labo, Số lượng) use `LaboLockedField`, so each input's accessible
  name is its label.
- **LỊCH SỬ ĐIỀU TRỊ**: chip "LABO-xxxx · status" + "Xem phiếu Labo" on the
  công đoạn that raised it; Hoàn thành disabled with "Khoá: phiếu Labo chưa QC
  đạt" on that công đoạn and the later ones (`LaboStagePolicy`, enforced again by
  `TreatmentStageAppService`, `0031`); "Kích hoạt bảo hành" on the latest
  công đoạn once QC passed.
- **`/labo` Mẫu Labo**: status pill, eye only ("Thông tin chung", read-only).
  Sample chips, split on the due day:

  | Chip | Statuses | Due |
  |---|---|---|
  | Mẫu Chưa Nhận | Đã gửi Labo, Trả hàng | none or today and later |
  | Mẫu Giao Trễ | Đã gửi Labo, Trả hàng | before today |
  | Mẫu Đã Nhận Hàng | Chờ kiểm tra, Hoàn thành, Bảo hành | — |

  Nháp and Đã hủy show under Tất cả only.

## Tests

- BE: `Domain.Tests/Labo/LaboOrderWorkflowTests` (35), `LaboStagePolicyTests`
  (8); `Application.Tests/Labo/LaboAppServiceContractTests` (13);
  `EntityFrameworkCore.Tests/Labo/LaboOrderMappingTests` (8). The old
  `LaboOrderTests` (child orders, hand status) was removed with the code it
  tested.
- E2E, real stack, nothing intercepted (37 tests, 9 specs):
  - `labo-workflow` (3):
    - a Nháp sent, returned for one tooth, passed on round 2 and given a
      warranty card per tooth, with the stage lock (screen + server 403
      `0031`), the plan column and the Hoàn thành menu lock along the way,
      the locked fields found by their accessible name, read back after reloads;
    - the tab's counters, deleting a Nháp, a cancelled order kept listed and
      "Không áp dụng" on the slip;
    - a restricted account with `treatmentLabo.read` / `update` only.
  - `labo-api` (9): the state machine and every wrong step, Trả toàn bộ,
    the stage lock, Nháp delete / edit / Ngày gửi, dropped pictures, the
    service-line block, Hoàn thành dịch vụ refused with `0033` for a Nháp and
    a sent order then allowed after QC, 403 without the grants, branch
    isolation.
  - `labo-tab-list` (2): dialog in the URL; server paging and filters. It
    replaces `labo-warranty`.
  - Rewritten for the new flow: `labo` (14), `labo-orders-actions` (3),
    `labo-orders-permissions` (1), `labo-detail` (1),
    `labo-material-search` (1); unchanged: `labo-supplier-color` (3).
- Fixtures: `e2e/fixtures/laboApi.ts` (create / send / receive / pass / return
  through the real endpoints), `e2e/fixtures/laboSeed.ts`.
- Level-3 regression (`stage-*`, `treatment-*`, `plan-*`, `branch-*`,
  `payment-from-slip`): 95/96. `treatment-plan-detail` was updated for the
  new "Phiếu Labo" column and the "Đã hủy" label; the one red,
  `stage-staff-pickers:163`, predates F-85 (R-956). Detail in R-1083.

## Layout follow-up (2026-10-30, owner review)

- Đặt hàng: the option chips sit under their label beside a search box;
  Răng = a view-only chart button + "Số lượng: N"; Màu răng / Đường hoàn tất /
  Khớp cắn / Kiểu nhịp in two columns (one at ≤640); "Ảnh đính kèm" kept.
- Tab 2: Phiếu dịch vụ Labo* and Tên khách hàng locked above the summary
  (BA mock: "lock hết"). Số lượng đặt / Người nhận / Chi phí phát sinh use the
  same floating label as their neighbours, so each row lines up. The
  Kết luận box spaces Mô tả from the dates.
- Tab 3: each tooth card spaces its rows by 16px; the month box sits after
  the six chips; on a phone the caption drops under Răng + badge.
- Responsive checked at 1600 / 768 / 390: no horizontal scroll; the footer
  buttons wrap, on a phone onto their own full-width line.
- Tests: `labo-workflow` checks the tab-2 locked fields; `patient.spec`
  "Tạo Labo opens Đặt hàng…" and "Đặt hàng is built…" rewritten for the new
  dialog. labo-api + labo-material-search + labo-workflow 13/13, patient.spec
  Labo 2/2 on the isolated stack.

### Second pass (same day, owner mock)

- Thời hạn bảo hành: bold label with a red *, on one line left of the chips;
  "Khác (tháng)" floats on the border of a "Số tháng" box, 32px like the chips.
- Warranty cards: clinic logo (`clinicLogoUrl`, else `/logo.png`), "THẺ BẢO
  HÀNH · BH-…" uppercase, restoration line semibold, translucent status pill;
  slate before activation, purple after, gold border on the focused card.
- Thông tin thẻ: seven locked floating-label fields (Mã thẻ tự sinh theo răng,
  Phục hình · răng, Thời hạn, Mã thẻ hãng / serial, Ngày bắt đầu, Ngày hết hạn
  tự tính, Điều kiện / ghi chú) beside a 420px purple→blue preview card with
  the logo, clinic name, patient name and "Mã thẻ: **code**".
- Dialog `min(1080px, 100vw - 32px)` (owner: 1200 too wide). At ≤1100 the
  preview drops under the fields (max 440px); at ≤640 everything is one column.
  Checked at 1600 / 1000 / 390: no horizontal scroll.
- New i18n keys `Labo:Warranty:Info:Serial|EndDate|Conditions`; a running BE
  must restart to serve them (else raw keys and "Mã: {0}" show).
- Tests: the card code assertion now reads "Thẻ bảo hành · BH-…".
  labo-workflow 3/3, patient.spec Labo 2/2, tsc clean.

### BA recheck (same day, stage history "Hành động")

The owner sent two BA notes. Both were already built; no code changed.
- **Note 1.** Hoàn thành is enabled and "Kích hoạt bảo hành" shows only when
  every tooth is Đạt. If one tooth is Đạt and another Lỗi, the order goes to
  Trả hàng: it stays unfinished and later stages stay locked, with no button.
- **Note 2.** An unfinished Labo order lets stages go on but greys their
  Hoàn thành. The order is recorded on the stage and date where it was raised,
  and that stage shows the chip.
- **Change after review.** The owner saw the raising stage still tickable
  ("sao t vẫn hoàn thành được"). `LaboStagePolicy.LocksCompletion` now locks
  that stage too: on-or-after instead of after. Stages worked before it stay
  free. A stage ticked before this change stays ticked and can still be
  unticked; it cannot be re-ticked until QC passes. Tests:
  `LaboStagePolicyTests` (raised → locked); `labo-api.spec` (stage A 403
  `0031`, then 200 after QC); `labo-workflow.spec` (stage A greyed with the
  lock note, enabled after QC). Labo e2e 12/12 and patient.spec Labo 1/1 on
  :5140/:8170.

`labo-workflow.spec` gained a step after round 1 asserting note 1's negative
case: the lock note, the checkbox disabled, and no button on either of the
line's rows. The button is matched as `/Kích hoạt bảo hành$/` because the icon
adds "safety" to its accessible name. The positive step uses the same selector,
so the negative step cannot pass vacuously. 3/3 green on :8170.

## P3110 — Labo popup rework (F-86 phases C/D/E, R-1085..R-1087, 2026-10-31)

BA `P3110.drawio`, owner answers D2/D3/D7. Full trace in
`docs/wip/p3110-labo-warranty-plan.md` §2 C/D/E; the slip's Bảo hành tab and
the warranty công đoạn are in `plan-warranty.md`.

| Step | What changed |
|---|---|
| 1 · Đặt hàng | Header "Đặt hàng" + status chip; no Giờ gửi / Giờ nhận (days only, `CreationTime` keeps the time); Dịch vụ / Vật liệu show 2–3 entries, "Xem thêm" opens a one-pick modal with search + recent; teeth picked on the chart with a count; **Thông số từng răng** — Màu răng\* (several shades split by "/"), Đường hoàn tất\*, Kiểu nhịp, **Khớp cắn** (after Kiểu nhịp, D3), Ảnh per tooth (MinIO, D7), Ghi chú cho Labo; a row lacking a required cell reads faint pink with the cell red, and the footer names it; "Dùng chung 1 thông số" collapses to one row saved per tooth; Ảnh đính kèm chung not required (D2); footer Huỷ · Lưu nháp · Gửi Labo & in phiếu |
| 2 · Nhận hàng & kiểm tra | Summary 3×3, "Răng" only (no SL · Màu); no Lưu nhận hàng; "▶ Kiểm tra Labo" → Chờ kiểm tra; per tooth Đạt / Lỗi, a Lỗi tooth gets its own description + pictures; "Đã trả: n lần" per tooth; a tooth passed earlier is locked; no Chi phí phát sinh; buttons count the teeth they return, Trả hàng bị lỗi is purple; history table per tooth |
| 3 · Bảo hành | Ảnh thẻ Mặt trước / Mặt sau per tooth (optional, sent with Kích hoạt bảo hành, `Labo:0036`); Thông tin thẻ / Lịch sử panels removed — the history moved to the slip's Bảo hành tab |

Data: tooth spec columns on `bd_labo_order_teeth` + `SharedSpec`; per-tooth
defect description in the round's tooth results (jsonb); `PatientImage`
`LaboToothNumber` / round / `WarrantyCardSide` (migrations
`20261031102022_LaboToothSpecP3110`, `20261031135031_WarrantyCardPhotoP3110`).

Tests: `labo-workflow.spec` (Đặt hàng per tooth, shared mode, pictures per
tooth, sent without a picture; Ảnh thẻ through the UI; the Ảnh "+" lines up
with Màu răng), `labo-api.spec` (REQ-E1 photo rules, per-tooth returns),
`patient.spec` Labo, BE Domain Labo + PatientImage.

## F-88 — Labo warranty apart from the line, date lock, admin delete (BA 2026-11-02, R-1122..R-1124)

Origin: on staging, slip line DT01-02 stayed "Đang điều trị" with no "Bảo hành
dịch vụ" button because an open Labo-warranty công đoạn counted in the line.

**Part A — the Labo warranty is the lab's, not the clinic's (R-1122)**

| Rule | Where |
|---|---|
| A công đoạn with `IsGuarantee` + `WarrantyKind = Labo` (`TreatmentStage.IsLaboWarranty`) never moves the service line, open or closed | `ServiceLineProgress.Move` (domain; returns false when only Labo warranties remain) |
| "Bảo hành dịch vụ" is refused while a non-cancelled Labo order of the line has not passed QC | `Treatment:0062`; tab Bảo hành Dịch vụ cell = Chưa đủ điều kiện (`ServiceWarrantyCard.LaboUnfinished`) |
| Lines already pulled back are recomputed once | `BlueDentalLaboWarrantyLineSeeder` (DbMigrator, idempotent) |

**Divergence from the reference (deliberate, BA):** the reference folds the
Labo warranty into the service's own status. BlueDental keeps it apart — the
service warranty is the line's final lock.

**Part B — only the newest Ngày điều trị of a line moves it (R-1123)**

- Within **one service line** (not per tooth), only the rows with the line's
  newest Ngày điều trị are actionable (`StageDateLock`, DTO `isDateLocked`).
- On an older row: Hoàn thành and its revert are refused (`Treatment:0063`,
  checkbox disabled, note "Khoá: dịch vụ đã có công đoạn ngày mới hơn"),
  Tạo Labo is hidden and refused on the server (`0063`). Tải ảnh, Nội dung and
  Ghi chú stay editable.
- A past date is still accepted on Thêm / Tiếp tục công đoạn; the row is just
  locked when the line already has a newer one. A sole back-dated row, and
  every row sharing the newest day, stays open.
- Superseded rows count toward the newest day; Labo-warranty rows neither lock
  nor are locked.
- The way out of a locked, unfinished row: Tiếp tục công đoạn to the newest day.
- Under Tạo Labo: "+n phiếu trước · Xem tất cả ›" links to the patient's
  `?tab=labo`.
- Order of guards on Hoàn thành: the date lock (`0063`) answers before the
  Labo lock (`Labo:0031`) — `labo-api` REQ-A7 asserts the Labo lock first,
  before a newer row exists.

**Admin "Xóa công đoạn" (R-1124)** — permission `treatmentStage.delete`
("Công đoạn › Xóa"), granted to admin only.

- The deleted row's teeth go back to the row it continued from
  (`TreatmentStage.TakeBackTeeth`), and the line is recomputed.
- Refused with `0064` while a non-cancelled Labo order hangs on the row, and
  with `0065` when another row was built on it (continued or warrantied).
- Pictures stay in the patient's Hình ảnh.

Assumptions taken without the BA (owner may overturn): Tạo Labo hidden on a
locked row; same-day rows all open; superseded rows count; Labo warranties
excluded; delete admin-only; pictures kept.

Tests:
- `e2e/stage-date-lock-api.spec.ts` (7, real HTTP): Labo warranty keeps the
  line Done; a hand-finished line with only a Labo warranty stays Done; `0062`
  then 200 after cancelling the order; `0063` on complete / Labo create /
  revert, carried row unlocks; sole and same-day rows open; delete `0065` →
  `0064` → 200 with teeth back and line reopened; dentist without the
  permission → 403.
- `e2e/stage-date-lock.spec.ts` (1, browser): locked row disabled + note + no
  Tạo Labo + Tải ảnh enabled; Xóa công đoạn + red confirm; after reload the
  older row is open and the deleted one is 404.
- `labo-workflow` (count link), `labo-api` REQ-A7 (restructured),
  `stage-treatment-date` (R-951 case continues onto the newer day).
- Domain `BlueDentalAbilitiesTests` (`treatmentStage.delete`).

**Round 2 — edit everything, log everything (BA 2026-11-02, R-1126/R-1127)**

- A Tiếp tục dated before its source row is frozen history (`IsBackfill`):
  it takes no teeth, the source keeps them and stays the working row; an admin
  may delete it. Same day or later hands the teeth on as before.
- Nội dung điều trị and Ghi chú save on every row (finished, continued,
  date-locked); Tải ảnh stays on a continued row too.
- Every change is written to `TreatmentStageChangeLog` (outlives the row):
  1 Nội dung, 2 Ghi chú, 3 Sửa công đoạn, 4 Hoàn thành, 5 Bỏ hoàn thành,
  6 Tải ảnh, 7 Xóa ảnh, 8 Xóa công đoạn, 9 Sửa bước — each with its fields
  before / after.
- Admin viewer: one "Lịch sử chỉnh sửa" button on the LỊCH SỬ ĐIỀU TRỊ header
  (owner: no per-row button). Dialog filters by công đoạn and action, expands
  each entry into field Trước → Sau, names a deleted row "(Đã xóa)". Reads
  `GET /treatment-stages/change-logs?treatmentId=` (newest first); permission
  `treatmentStage.delete`.
- Open: back-dated continuations made before F-88 still carry teeth — no
  seeder yet; owner to decide (admin delete meanwhile).

Tests (round 2): `e2e/stage-backfill-log-api.spec.ts` (6, real HTTP),
`e2e/stage-change-log.spec.ts` (1, browser); `stage-remark` and
`treatment-stage-chain` updated to the new rule; related run 26/26; Domain
`TreatmentStageBackfillTests`.

## Labo v2 — Đặt hàng (BA mock "màn 15b", R-1150, 2026-11-05)

- Thông số từng răng is one card per tooth. Each card has a Mặt răng picker:
  the chart's tooth picture plus a big five-face circle (no tooth number, the
  card head already says R11). Clicking the picture picks every surface;
  clicking it again when all five are on takes them all off.
- Surfaces: incisors/canines M · D · I · F · L, premolars/molars
  M · D · O · B · L (`ToothSurfaces`). "Riêng theo mặt" splits Màu răng /
  Đường hoàn tất per surface.
- Two switches: Thông số răng Chung / Riêng, and while Chung, Màu răng
  Chung / Riêng → `LaboSpecMode` 1 SharedAll · 2 SharedSpecOwnShade ·
  3 PerTooth. Values stay on every tooth; switching modes keeps what was typed.
- Khớp cắn belongs to the order (old orders: the first tooth's value).
- Required to send: Mặt răng and Màu răng on every tooth (`Labo:0038`,
  `Labo:0034`); Đường hoàn tất is not required. Each card shows "n lỗi" /
  "Đủ thông tin"; the footer gives the summary and the list of gaps.
- Per-tooth Ảnh and Ghi chú are gone (owner, following the mock). Lưu nháp,
  "Tạo phiếu Labo" and the old prior-tooth warning stay.
- Old drafts must pick surfaces before sending. Sent orders without surfaces
  show "—".
- Tests: `e2e/labo-workflow.spec.ts` rewritten (7). `labo-api` fixtures send
  `toothSpecs` with surface M by default.

## Labo v2 — Nhận hàng & kiểm tra (BA mock "Labo 2 v2", R-1151, 2026-11-05)

- Owner: keep the old Kiểm tra fields inside the new layout. Lỗi always means
  the Labo remakes it; the Xử lý select, "Sửa tại phòng khám" and per-tooth
  Hẹn giao lại are gone. Section C keeps Ngày trả hàng and Hẹn Labo giao lại.
  Hình ảnh lỗi 0/5, Mô tả gửi Labo, Đã trả n lần and BH Labo stay.
- Each Lỗi tooth picks its faulty faces on the tooth picture: only the ordered
  faces can be clicked (name + shade shown). At least one is required
  (`Labo:0040`); a face not ordered is refused (`Labo:0041`). The line reads
  "Mặt bị lỗi: chưa chọn — bấm trên sơ đồ" / "Mặt bị lỗi: Gần".
- Faults are stored per round (`LaboRoundToothResult.FaultSurfaces`); a new
  round starts with no faces picked.
- Tally "Đạt n · Lỗi n · Chưa đánh giá n" and "Đạt tất cả" above the teeth.
- Footer: an amber hint while something is missing ("Còn n răng chưa đánh
  giá", "Nhập mô tả lỗi gửi Labo cho n răng"), else where the order goes.
  While teeth are unpicked, "Trả toàn bộ (n răng)" and "Xác nhận đạt (n răng)"
  both show greyed. Once nothing is left to conclude: hint + Đóng +
  "Tiếp: Bảo hành ›" (hidden in the R-1120 view-only popup).
- History cards: "Sai màu (mặt Gần, Xa) · hẹn 12/11/2026".
- Chỉnh sửa stays on cards not yet activated; activated cards are locked and
  show Xem chi tiết (R-1120, unchanged).
- Tests: `e2e/labo-workflow.spec.ts` (7), `plan-warranty-tab` (6),
  `labo-api` (14).

## Labo v2 — Bảo hành (BA mock "BaoHanhV2", R-1152, 2026-11-05)

- Two tabs: "Kích hoạt bảo hành" (only while a Đạt tooth still lacks a card
  and the order may activate) and "Tổng quan thẻ bảo hành (n)".
- Kích hoạt has 3 columns:
  - The teeth list, each with Đủ thông tin / Thiếu … and "Đủ thông tin r/s
    răng" at the bottom of the column.
  - The open tooth's card: tooth info with its faces, the form, and
    "‹ Răng trước" "Răng tiếp theo ›" side by side at the right.
  - The card preview with ‹ i/n › and the tooth chips.
- Only the open tooth's form is mounted. Dùng chung still keeps one serial per
  tooth.
- "Kích hoạt bảo hành (r/s răng)" stays disabled until every picked tooth has
  a start date and a duration. The footer hint says how many are missing.
- Tổng quan:
  - A ready draft card is purple, with "Sẵn sàng kích hoạt"; an incomplete
    one reads "Chưa kích hoạt".
  - "Chỉnh sửa" appears only on cards not activated yet (owner Q10, R-1120
    kept). It returns to that tooth's form with the values kept.
  - The table has Thời hạn instead of Còn lại.
- Responsive:
  - Below 1100px the columns stack.
  - From 641 to 1100px Tổng quan shows 2 cards per row.
  - At 640px and below it shows 1 card per row and the nav buttons share the
    width.
- Tests: `e2e/labo-workflow.spec.ts` (Bảo hành + Dùng chung), `plan-warranty-tab`.

## F-91 — Phiếu yêu cầu Labo (BA mock "bản 2 nhập mã số, không kế hoạch nhà cung cấp", R-1198)

Step 1 Đặt hàng of a **new** order is now the Labo's own Phiếu yêu cầu
(`request-slip/LaboRequestSlipStep`). Orders made before keep the old form
(`layout` 1 = Classic, 2 = RequestSlip).

- Thông tin phiếu:
  - Mã số is typed by hand and required to send, not to save a draft.
  - It is unique per branch, case-sensitive, and cancelled orders do not count:
    `Labo:0042` (missing) and `Labo:0043` (taken).
  - Loại phiếu is Ca mới or Sửa / làm lại. It is a stored flag only.
  - Phòng khám, Bệnh nhân and Tuổi · Giới tính are read-only.
  - Bác sĩ chỉ định.
  - Ngày gửi defaults to today. Ngày nhận dự kiến must come after it.
- Loại phục hình comes from Danh mục vật liệu (`labo_material` groups):
  - A group that has a material ticked "Có lựa chọn Trên implant" shows as a
    2-column table (Thường / Trên implant).
  - Other groups show as a list.
  - `Labo:0044` means none is picked; `Labo:0045` means the pick is not in the
    catalog, or Trên implant was picked on a material that does not allow it.
- Màu răng has 6 zones (Cổ / Thân / Rìa cắn × Gần / Xa).
- Chỉ định is the system's "Răng *" row (`LaboToothRow`):
  - The purple tooth button opens the shared Chọn răng dialog (Răng vĩnh viễn
    / Răng sữa).
  - The picked teeth follow as chips, with Số lượng.
  - It sits in column 3, above Đường hoàn tất (owner, 2026-11-10).
  - The prior-tooth warning covers every order of the patient that is Nháp,
    Đã gửi, Chờ kiểm tra or Labo trả lại.
- Đường hoàn tất comes from the `labo_finish_line` taxonomy. Several can be
  picked, and each one's tooltip is its description.
- Yêu cầu and Ảnh chung.
- Everything is entered once and stored on **every** tooth
  (`bd_labo_order_teeth`: restorations jsonb, shade zones, finish line ids).
- No supplier, no plan, no line and no công đoạn link.
- "Tạo phiếu Labo" waits for the footer to show "Phiếu đã đủ thông tin.", sends
  the order, then goes to the patient's Labo tab (`/patient/:id?tab=labo`).
  It went to `/labo` until the owner changed it on 2026-11-10.
- A sent order shows the same sheet locked, with Hủy phiếu and In Phiếu Labo.
- An old draft reopens with its saved values filled in.
- Print: "PHIẾU YÊU CẦU LABO" (`LaboRequestSlipSheet`) uses the app font, with
  the Màu răng grid and the tooth chart with the picked teeth boxed. Old orders
  keep "PHIẾU ĐẶT HÀNG LABO".
- In Phiếu Labo puts `@page { size: A4; margin: 0 }` on the page while it
  prints (`useLaboPrint`, both sheets). Without it the page took the
  printer's default paper: on a PDF printer's small default the letterhead ran
  together, the type looked oversized and one order filled three sheets.
- The sheet scrolls under a pinned footer (`.rs-slip-scroll`; its children
  are `flex: none` or the clipped sections collapse to a line) and folds to
  2 columns at 1280px, then 1 column at 640px, with no sideways scroll.
- Lists:
  - Mã số replaces Mã phiếu on `/labo`, on the patient Labo tab and on the
    workflow card. Old orders show the order code.
  - Loại phục hình replaces Vật liệu.
  - The supplier column and its colour badge are gone from both lists.
  - The supplier master data (`/labo/supplier`) stays.
- Accepted for now (owner, 2026-11-10):
  - No công đoạn lock.
  - No service-completion block.
  - No Phiếu Labo cell on the slip.
  - No warranty activation until the Bảo hành step is reworked.
  - The Kiểm tra step reads the old fields ("làm sau").
- Tests:
  - `e2e/labo-request-slip-api.spec.ts` (8).
  - `e2e/labo-request-slip-ui.spec.ts` (5):
    - Create from the patient tab: scroll by wheel, Chọn răng with Răng sữa,
      widths 1100 / 800 / 390.
    - Land back on the patient's Labo tab.
    - Read each tooth back; Xem and the print sheet print as one A4 page when
      the paper defaults to 105×148mm.
    - A duplicate Mã số is refused.
    - A tooth on another open order is flagged but not blocked (R-1106 carried
      over).
    - A draft refills; a sent sheet is locked.
    - The Trên implant checkbox in the material dialog.
  - Older specs brought in line:
    - `labo-workflow:182` now starts from an old-form order already sent
      through the API.
    - `labo-supplier-color` no longer looks for the badge on the two Labo
      lists.
    - `test.skip` with a note: `labo-workflow` R-1106 and R-1150 (old-form
      editing) and `labo-material-search:204` (no Vật liệu popup any more).
    - The Labo specs ran 24 passed / 3 skipped.

## F-92 — Vật liệu & loại phục hình (BA P1011, R-1199)

The screen and the slip are described in `docs/clone/pages/labo.md` §11. The
proposal for other suppliers' forms is in §11.1.

- Owner's answers, 2026-11-11:
  1. Multi-supplier: write a proposal only (Option A recommended).
  2. Drop the Phiếu điều trị column everywhere: `/labo`, the patient Labo tab
     and the Excel export.
  3. Keep the material dialog as a modal.
  4. Leave out "Xem trước trên phiếu", the "Loại phục hình (n)" tab and the
     inline tooth chart.
- Data:
  - `LaboMaterial.Code` is unique per branch, case-insensitive. The error
    codes are `Labo:0046` (missing) and `Labo:0047` (taken).
  - `IsActive` is edited through the dialog or `PUT {id}/active`.
  - Migration `LaboMaterialCodeP1011`.
- Fixed groups:
  - Defined in `LaboMaterialGroups` and seeded per branch by
    `TaxonomyAppService.EnsureFixedGroupsAsync`.
  - The same helper now also seeds the Vật liệu nha khoa groups; the existing
    check is limited to `IsSystem` rows.
- Slip rule (`LaboMaterialGroups.Accepts`, `Labo:0045`):
  - Toàn sứ and Hợp kim accept either column.
  - KHAC accepts only `onImplant`.
  - An old group keeps the material's F-91 `AllowOnImplant` flag.
- Tests:
  - `e2e/labo-request-slip-api.spec.ts` (10) adds:
    - the three groups are seeded once per branch;
    - Mã: required, unique per branch, free in another branch, found by
      search;
    - the `/active` switch;
    - the KHAC and old-group rules.
  - `e2e/labo-request-slip-ui.spec.ts` (7) adds:
    - the columns and the 10-row scroll;
    - the master screen: three groups, no add, code chip, Mã dialog,
      duplicate toast, search by Mã, switch survives a reload;
    - a Ngừng material is not offered on the slip.
  - Older specs brought in line:
    - `labo-orders-actions`: the plan cell is gone and the indexes shift by
      one. After the image preview the list is reloaded before the eye is
      clicked, because AntD's leave motion now and then stalls headless and
      its mask stays over the table.
    - `labo-tab-list`: Trạng thái is now the 4th column.
    - `labo.spec`: the new tab name, the three groups, and the column indexes
      of the "names, not ids" check.
  - The Labo specs ran 60 passed / 3 skipped (the F-91 skips).
    `taxonomy-dental-material` ran 2/2.

## Not built / open

- Tiếp nhận bảo hành (Lần BH, phiếu BH1) — later round.
- "Tạo Labo" still shows on the other công đoạn of a line that already has a
  live order (a second order is allowed).
- Assumptions taken without the BA: `docs/clone/unknowns.md` (P2910_03).

## F-93 — Mẫu phiếu bổ sung (hybrid, R-1200, 2026-11-11)

What was built and the rules: `docs/clone/pages/labo.md` §12.

Tests: stack :5152/:8098, real login, no interception.

- **`e2e/labo-form-template-api.spec.ts` (14).** It covers:
  - CRUD with stable keys;
  - name rules;
  - field-list checks;
  - branch isolation;
  - 401 for a caller who is not signed in;
  - permissions: no leaf → 403, `catalogService.read` → reads only, every
    write still 403;
  - every answer kind, cleaned;
  - invalid answers;
  - a draft against a sent slip with a required field;
  - the copy surviving an edit, a stop and a delete;
  - a stopped or unknown template refused;
  - switching templates and clearing them;
  - a Classic order.
- **`e2e/labo-form-template-ui.spec.ts` (2).**
  - The Mẫu phiếu tab builds a template field by field. It checks:
    - the footer messages that block Lưu;
    - search without accents;
    - edit in place;
    - Ngừng;
    - Xoá.
  - The slip:
    - the section is hidden when the branch has no active template;
    - the section appears once one exists, marked "Không in trên phiếu";
    - Tạo phiếu Labo stays disabled while a Bắt buộc field is blank;
    - a draft keeps its answers, read back from the API;
    - after the template is renamed, edited and stopped, the slip keeps its own
      copy, which is offered next to the live templates;
    - a sent slip shows its answers locked;
    - the print leaves the section out.
- **Shared helpers** for the Phiếu yêu cầu UI were moved to
  `e2e/fixtures/laboSlipUi.ts`.
