# F-13 — Mẫu Labo

Status: `VERIFIED` · Verified commit: see `01-feature-verification-registry.md`

## Scope

The Labo screen: samples sent to an external lab, their kind (Đơn hàng mới,
Tiếp tục công đoạn, Bảo hành) and the "Mẫu Chưa Nhận" / "Mẫu Giao Trễ" chips.

## API surface

```
GET  /api/v1/app/labo-orders?branchId&status&kind&patientId
GET  /api/v1/app/labo-orders/stats?branchId
POST /api/v1/app/labo-orders
POST /api/v1/app/labo-orders/{id}/send
POST /api/v1/app/labo-orders/{id}/receive
POST /api/v1/app/labo-orders/{id}/cancel
```

## Rules under test

- "Mẫu Giao Trễ" is derived, not stored: a sample is late only while it is still
  out **and** past its due date. Once received it is no longer late, however long
  it took.
- "Mẫu Chưa Nhận" lists exactly the samples still at the lab.
- The three kinds mirror the reference counters (`created`, `continue`,
  `guarantee`).
- Every read and write is branch-scoped.

## Acceptance evidence

`e2e/labo.spec.ts`:

1. seeds a sample with a past due date, sends it, asserts it reads as late, then
   receives it and asserts it stops being late;
2. asserts the "Mẫu Chưa Nhận" chip lists only samples still out.

## Not covered yet

- Attachments on an order
- Supplier / material / bite / finish-line / rhythm taxonomies are BlueDental's
  own slugs — the reference's own list was not observable
