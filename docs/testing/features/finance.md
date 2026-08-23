# F-04 / F-05 — Thu chi và Luân chuyển dòng tiền

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The two finance tabs of the report screen: "Quản lý thu chi" (receipts and
payments with an approval step) and "Luân chuyển dòng tiền V2" (deposits,
withdrawals and transfers between holdings).

## API surface

```
GET  /api/v1/app/sales?clinicBranchId&type&fromDate&toDate&approved
GET  /api/v1/app/sales/stats
POST /api/v1/app/sales
PUT  /api/v1/app/sales/{id}
POST /api/v1/app/sales/{id}/approve
POST /api/v1/app/sales/{id}/reject
GET  /api/v1/app/cashflow-categories
POST /api/v1/app/cashflow-categories
GET  /api/v1/app/cash-management/{balance,cashflow-overview,cashflow-entries}
POST /api/v1/app/cash-management/cashflow-entries
```

## Rules under test

- A receipt counts immediately; an expense starts `Pending` and is excluded from
  the totals until approved.
- Rejection requires a reason; a rejected voucher can be corrected and approved.
- An approved voucher is locked from edits and deletion.
- Receipts are guarded by `reportIncome`, payments by `reportCost`; approval by
  `reportCost.approve`.
- Deposit / withdraw / transfer each require their own action on `reportTransfer`.
- A transfer must move between two different holdings.
- "Tổng Tiền" excludes `CustomerPrepaid` — money held for customers is not the
  clinic's money.

## Acceptance evidence

`e2e/finance.spec.ts`:

1. creates an expense with an inline new category, asserts it shows "Chờ duyệt"
   and that Tổng chi is **unchanged**, approves it, then asserts Tổng chi grew by
   exactly the voucher amount and the edit action disappeared
2. records a deposit and asserts Tổng Tiền Mặt grew by exactly that amount

Both assert deltas, because the branch accumulates vouchers across runs.

## Not covered yet

- Rejection flow through the UI (server rule is unit-tested)
- Category management screen ("Danh mục" sub-tab)
- Excel export
