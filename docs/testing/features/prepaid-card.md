# F-63 — Thẻ trả trước (cụm 3: 3.1 Tạo thẻ, 3.2 Tình trạng thẻ)

Status: `VERIFIED` · Verified on: uncommitted work on top of `c1d5f62b` (2026-10-08)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/prepaid-card.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/prepaid-card.spec.ts` **3/3**; every run
makes its own card types and cards.

| Case | What is checked |
|------|-----------------|
| API | Type created (10 % commission, 2 uses, scope = one catalog service) → card sold: `TT{yy}-{nnnn}`, balance = usage value, commission 90.000 fixed at the sale, Issue line with the money taken. Listed by `usable`. A receipt by card (method 6) → balance down by the receipt, 1 use, a Use line naming the receipt code; `prepaidCardCode` on the receipt. No card named → `0013`; card scoped to another group → `0011`; locked → `0007`, unlocked again. Cancelling the receipt → value and use back as a Hoàn lại line. Topup 500.000 for 450.000 → balance / total loaded. Owner as member → `0006`. `soldCount` on the type. A deleted type keeps its card readable. The second branch's account reads the card as 404 |
| UI — Loại thẻ / Bán thẻ | Type created in the dialog, row shown; card sold in "Bán thẻ" (type picked, owner searched by code), drawer opens on the new card with 5.000.000; "Nạp thêm" 1.000.000 → 6.000.000; after a reload the list (searched by code) shows 6.000.000 and "Đang hoạt động" |
| UI — thanh toán | Fresh slip; card sold to the patient; "Tạo phiếu thanh toán" → pill "Thẻ trả trước" → card row → Lưu: POST method 6, row "Thẻ trả trước (TT…)"; "Xác nhận thanh toán" as written → exactly **one** Use on the card, balance down once |

Found while testing: `Form.useWatch` called inside a `.find()` callback in the
sale dialog broke the rules of hooks and crashed the page (React #310) — hoisted.

## Backend

- Domain: `PrepaidCardTests` **15** (Domain 789 green). Application: `PrepaidCardAppServiceContractTests`
  (every method names its leaf; `usable` is `payment.create`), `CrossBranchDenialTests` now covers
  `PrepaidCardAppService` (Application 703 green). Host 24 green. Ability catalog 94.
- Migration `PrepaidCards`: `bd_prepaid_card_types`, `bd_prepaid_cards`, `bd_prepaid_card_transactions`,
  `bd_patient_payments.PrepaidCardId`.

## Regression (level 3 — shared payment path, payroll, reports, nav, permission tree)

See `03-regression-log.md` (2026-10-08, R-853 / R-854): 60 green, 13 red on the first pass; every red case is
either already logged (R-677, R-725..R-727, `/timekeeping`, `payment-permission-buttons:198`, `report:294`) or outside
this feature's code and not yet compared against the pre-change build (`qa-bugs-25-30:99`, `report:377`, `report:574`,
`treatment-plan-detail:575`).
