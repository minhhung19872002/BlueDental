# F-54 — Quy định giảm giá (cụm 11 mục 12)

Status: `VERIFIED` · Verified on: uncommitted work on top of `3300ad08` (2026-10-07)
— see `01-feature-verification-registry.md`. Decisions: `docs/clone/pages/discount-limit.md`.

## Runtime evidence

Production build (`vite preview` :8080), real API (:5000), real PostgreSQL, real
login form, nothing intercepted. `e2e/discount-limit.spec.ts` **3/3**. Each run
creates its own role (`patient.read`, `treatmentConsultation.read/create/update`
through the real permission-management API) and a staff member in it; the
consulting lines it raises are deleted at the end.

| Case | What is checked |
|------|-----------------|
| Limits on a consulting line | No limit: 30% passes. 10%: a unit price lowered 12% → 403 `BlueDental:Treatment:0042` (message names 10%), 9% off passes. VNĐ cap: cap + 1.000 → 403 `0043`, the cap itself passes. Admin gives 50%; the limited account keeps the 50% on edit (200) but cannot raise it to 60% (403). Read back: only the accepted lines exist |
| Bypasses | 10 units with one unit's worth off (10%) passes; the same VNĐ off one unit → 403 `0042`. A slip of two lines opened by the limited account with 10% off as VNĐ; cancelling one line (→ 20%) → 403 `0042`, and both lines still count |
| Staff dialog | "Giảm tối đa (%)" 15 and "Giảm tối đa (VNĐ)" 300.000 persist (separate GET) and show after a reload; clearing both saves `null` |

## Backend

- Domain: `DiscountLimitTests` **10** (share and amount, previous-discount
  comparison like with like, quantity shrink, zero-value line, invalid limits).
- Domain.Tests 710, Application.Tests 676 green.

## Regression (level 3)

`catalog-combo`, `consulting-delete-and-picker`, `consulting-plan`,
`consulting-review`, `treatment-plan`, `treatment-plan-detail`,
`payment-amount-cap`, `voucher`, `staff`: 47/52 before the review fixes; the 5
red are reads / layout (service picker list, voucher picker price, image
shimmer, print signature strip) and the known drag-reorder (`:565`) — none
writes a discount. After the fixes `treatment-plan-detail` ran again: only `:565`.
