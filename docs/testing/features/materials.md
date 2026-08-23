# F-14 — Vật tư

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The Vật tư screen: supply groups, supplies with purchase and sale price, stock
receipts, and the derived "Trạng thái".

## API surface

```
GET  /api/v1/app/inventory-items?clinicBranchId&taxonomyId&status
POST /api/v1/app/inventory-items
PUT  /api/v1/app/inventory-items/{id}
POST /api/v1/app/inventory-items/{id}/receive
```

## Rules under test

- Status is derived, never stored, and **expiry outranks stock level** — a full
  shelf of expired stock must never read "Còn hàng".
- A supply with nothing received reads "Hết hàng".
- Expiry warning defaults to 30 days before the expiry date.
- Every read and write is branch-scoped.

## Acceptance evidence

`e2e/materials.spec.ts` creates a group, adds a supply, asserts it starts out of
stock, receives stock with an expiry date, and asserts the status follows the
expiry rather than the quantity.

## Not covered yet

- Consumption / stock-out flow
- Reorder alerts
