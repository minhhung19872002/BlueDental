# F-86 — Bảo hành trên phiếu điều trị: tab Bảo hành + công đoạn bảo hành (P3110 B/F, R-1088/R-1089)

Source: BA `P3110.drawio` (49 mocks, notes tied to cells by arrows) and the
owner's answers D1–D9 (31/10). BlueDental only: the reference app has no such
tab. The full trace — every BA note as `REQ-xx`, assumptions G1–G25, phase log —
is `docs/wip/p3110-labo-warranty-plan.md`; this file keeps what a tester needs.
The Labo popup parts of P3110 (phases C/D/E) are in `labo-workflow.md` §P3110,
the service-table parts (phase A) in the regression log R-1084.

## Decisions (owner, 2026-10-31)

| # | Topic | Decision |
|---|---|---|
| D1 | "Bảo hành dịch vụ" in LỊCH SỬ ĐIỀU TRỊ | Goes to the slip's **Bảo hành** tab, on that line |
| D4 | Dental card code | `BH-{line code}-{ddMMyyyy of start}-{xx}`, xx a 2-digit number from 01 per line and start day, Dịch vụ and Labo cards counted together, reserved in the activation's transaction by an upsert on `bd_warranty_card_sequences` (R-1090; was the tooth number, 00 for a line without teeth — cards made before keep their code). The line code (`DT01-03`) already holds the slip code |
| D5 | Lượt | None anywhere: no Lượt column, no visit count |
| D6 | Bảo hành column on the service table | Status chips only (Nha khoa / Labo), no second line, no YCBH code |
| D9 | Bảo hành dịch vụ popup (no mock) | Built on the frame of Labo step 3 Bảo hành |

## Tab "Bảo hành" (phase B, m348 / m360 / m361 / m366 / m371)

- Tab count = lines Hoàn thành + Labo orders passed with no return; badge
  "k chờ" = lines whose card is still to activate; "Hôm nay dd/mm/yyyy".
- **TÌNH TRẠNG BẢO HÀNH THEO DỊCH VỤ**: one row per line (not cancelled /
  replaced), chips Tất cả / Sẵn sàng / Đã kích hoạt / Không đủ điều kiện.
  Cells Nha khoa and Labo: `Chờ kích hoạt` · `Đã kích hoạt · n thẻ` ·
  `Không đủ điều kiện` · `–`.
- **Bảo hành dịch vụ** (dental) opens `ServiceWarrantyDialog`: per tooth Ngày
  bắt đầu (≥ the line's completion day, G16), Thời hạn (Theo danh mục / months),
  Điều kiện, Ảnh thẻ Mặt trước / Mặt sau. **Bảo hành Labo** opens the Labo popup
  on step 3.
- **PHIẾU BẢO HÀNH ĐÃ KÍCH HOẠT**: dental cards + activated Labo teeth, no Lượt
  column; "Xem thẻ ›" filters the history to that card.
- **LỊCH SỬ BẢO HÀNH**: Labo QC pass / return / activation, dental activation,
  warranty công đoạn opened / done — newest first; "Lịch sử ↓" scrolls and
  filters, a tag clears it. Not paginated (G18).

## Công đoạn bảo hành (phase F, m390 / m394 / m395 / m400 / m401 / m412 / m415)

- A line enters **TIẾP TỤC BẢO HÀNH** once it holds at least one valid card
  (REQ-B8) — a dental card with `EndDate ≥ today`, or an activated Labo tooth
  still in date. A line finished by hand (no công đoạn) is listed too.
- Same 4-column frame as Thêm / Tiếp tục công đoạn (REQ-F1); "Bác sĩ hỗ trợ" is
  the existing second-staff field (G22).
- **Thẻ bảo hành áp dụng \*** — two cards: **Dịch vụ**, the dental card, named
  as m415 draws it (`Hạn dd/mm/yyyy`) and
  **Labo** (`n Labo · chọn ở Nội dung điều trị`). A kind with no valid card is
  shown faded and inert (`Không có thẻ còn hạn`).
- Nha khoa → teeth = those its cards cover, others listed but not offered;
  Nội dung điều trị only (REQ-F5).
- Labo → `Dịch vụ bảo hành · Labo *` select above Nội dung: line 1 the
  supplier, line 2 `{material} R.. · Hạn ..` (G25); only the line's orders with
  an activated tooth in date; teeth = that order's activated teeth (REQ-F4).
- An open warranty chain keeps its card and order, locked.
- The old "Tạo bảo hành" popup is gone: "Bảo hành dịch vụ" in the history and
  the warranty icon on the record's treatment table both open the slip's tab
  (G24). Tái khám is untouched.
- Service table column **Bảo hành** after Phiếu Labo (REQ-A10): up to two chips
  `Nha khoa · {Chờ kích hoạt | Đã kích hoạt | Không đủ điều kiện}` and the same
  for Labo (Labo only on a line with an order); `–` on neither.

## Server rules

| Rule | Error |
|---|---|
| Warranty công đoạn without `warrantyKind` (1 Nha khoa / 2 Labo) | `Treatment:0058` |
| Nha khoa with no dental card in date on the line, or with a Labo order sent | `0059` / `0060` |
| Labo order not of the line, cancelled, or with no activated tooth in date | `0060` |
| A tooth outside what the card covers | `0061` |
| Activate a dental card: line not Hoàn thành | `0053` |
| … service without a warranty period in Danh mục | `0034` |
| … tooth not of the line, twice, or already carded | `0054` |
| … start before the line's completion day | `0055` |
| … months outside 1..600 | `0056` |
| … Ảnh thẻ naming a card not in this call, or a face twice | `0057` |

Behaviour change (G23): a warranty công đoạn used to be allowed while the
catalog's WarrantyDays, counted from the treatment date, had not run out. It now
follows the cards: no activated card, no warranty công đoạn.

## Data

- `bd_service_warranty_cards` (`ServiceWarrantyCard`, migration
  `20261031142735_ServiceWarrantyCardP3110`): unique (line, tooth) with
  NULLS NOT DISTINCT, soft delete; `PatientImage.ServiceWarrantyCardId` +
  `WarrantyCardSide` for the card photos.
- `bd_treatment_stages`: `WarrantyKind`, `WarrantyLaboOrderId` (copied on
  Tiếp tục; migration `20261031160612_StageWarrantyCardP3110`).
- API: `GET api/v1/app/patient-treatments/{planId}/warranty-overview`;
  `POST api/v1/app/patient-treatments/{planId}/services/{lineId}/warranty`
  (JSON or multipart). Branch scope and grants checked on the server
  (plan read / `TreatmentStage.Update`, G4).

## Tests (real stack: login, API, PostgreSQL — nothing intercepted)

| Spec | Covers |
|---|---|
| `e2e/plan-warranty-api.spec.ts` (7) | counts, cells, card codes, 00 card, Ảnh thẻ rules, no-period service, Labo cell, warranty công đoạn as history, other branch / no grant 403 |
| `e2e/plan-warranty-tab.spec.ts` (3) | tab count + chips + Hôm nay; activate in two rounds + reload; Xem thẻ / Lịch sử filters |
| `e2e/warranty-stage-api.spec.ts` (2) | 0058 / 0059 / 0060 / 0061, kind + order copied on Tiếp tục, line finished by hand |
| `e2e/warranty-stage.spec.ts` (2) | Nha khoa form (inert Labo, required card, teeth follow card, reload, chip); Labo form (order select, R11/R21 option, locked chain, chip) |
| Updated | `stage-treatment-date`, `treatment-stage-chain`, `medical-record-sheet-facts`, `patient.spec` (warranty now needs an activated card), `treatment-plan-detail` (new tab) |

Known, not P3110: `TreatmentPlan.DiscountShareParts` negative → 500 on the
shared slip DT10 (specs use `freshSlip`); `IX_bd_labo_orders_OrderCode` race in
`NextOrderCodeAsync` when two runs share a host.
