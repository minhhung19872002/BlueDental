# F-63 — Thẻ trả trước (cụm 3: 3.1 Tạo thẻ, 3.2 Tình trạng thẻ)

Status: `VERIFIED` · Verified on: uncommitted work on top of `c1d5f62b` (2026-10-08)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/prepaid-card.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/prepaid-card.spec.ts` **3/3**; every run
makes its own card types and cards. Second round (refunds onto the card, expiry,
Huỷ thẻ, money held, patient record): **4/4**.

| Case | What is checked |
|------|-----------------|
| API | Type created (10 % commission, 2 uses, scope = one catalog service) → card sold: `TT{yy}-{nnnn}`, balance = usage value, commission 90.000 fixed at the sale, Issue line with the money taken. Listed by `usable`. A receipt by card (method 6) → balance down by the receipt, 1 use, a Use line naming the receipt code; `prepaidCardCode` on the receipt. No card named → `0013`; card scoped to another group → `0011`; locked → `0007`, unlocked again. Cancelling the receipt → value and use back as a Hoàn lại line. Topup 500.000 for 450.000 → balance / total loaded. Owner as member → `0006`. `soldCount` on the type. A deleted type keeps its card readable. The second branch's account reads the card as 404 |
| UI — Loại thẻ / Bán thẻ | Type created in the dialog, row shown; card sold in "Bán thẻ" (type picked, owner searched by code), the card **dialog** opens on the new card with 5.000.000; "Nạp thêm" 1.000.000 → 6.000.000; "Đóng"; after a reload the list (searched by code) shows 6.000.000 and "Đang hoạt động", and "Xem" in the sticky Thao tác column opens the dialog again |
| UI — thanh toán | Fresh slip; card sold to the patient; "Tạo phiếu thanh toán" → pill "Thẻ trả trước" → card row → Lưu: POST method 6, row "Thẻ trả trước (TT…)"; "Xác nhận thanh toán" as written → exactly **one** Use on the card, balance down once. Then "Hoàn Tiền" → Hình thức "Thẻ trả trước" → the amount back onto the card (balance whole again, a Refund line). The patient's Hồ sơ shows the card chip with its balance; the chip opens `/prepaid-card?q=<mã>` with the row listed |
| API — round 2 | Type with 12-month validity → `expiresOn` a year on. Card receipt confirmed; a **cash** refund of it → `Billing:0093`; a refund onto the card → balance back, use kept, Refund line. Cancelling the used card → `0017`; an unused one → status Đã huỷ, balance 0, commission 0, Huỷ thẻ line giving back 900.000. `cash-management/balance` returns `prepaidCardBalance` ≥ 1.000.000 inside `customerPrepaid` |

Found while testing: `Form.useWatch` called inside a `.find()` callback in the
sale dialog broke the rules of hooks and crashed the page (React #310) — hoisted.

## Backend

- Domain: `PrepaidCardTests` **21** (Domain 795 green). Application: `PrepaidCardAppServiceContractTests`
  (every method names its leaf; `usable` is `payment.create`), `CrossBranchDenialTests` now covers
  `PrepaidCardAppService` (Application 704 green). Host 24 green. Ability catalog 94.
- Migrations `PrepaidCards` (`bd_prepaid_card_types`, `bd_prepaid_cards`, `bd_prepaid_card_transactions`,
  `bd_patient_payments.PrepaidCardId`) and `PrepaidCardExpiryAndCancel` (`ValidityMonths`, `ExpiresOn`, `CancelReason`).

## Regression (level 3 — shared payment path, payroll, reports, nav, permission tree)

See `03-regression-log.md` (2026-10-08, R-904 / R-905): 60 green, 13 red on the first pass; every red case is
either already logged (R-677, R-725..R-727, `/timekeeping`, `payment-permission-buttons:198`, `report:294`) or outside
this feature's code and not yet compared against the pre-change build (`qa-bugs-25-30:99`, `report:377`, `report:574`,
`treatment-plan-detail:575`).
