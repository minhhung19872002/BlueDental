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

## Child orders from the patient's Labo tab (2026-09-08)

`e2e/labo-warranty.spec.ts`, real stack on the production build:

1. logs in through the login screen, seeds a supplier, a `labo_material` group
   and a material through the real API only when the branch has none;
2. opens `/patient/:id?branchId=…&tab=labo`, raises Đặt mới from the tab, picks
   an open service line **before any plan** and asserts the plan fills itself,
   that Bác sĩ chỉ định is a select already holding the line's doctor and that
   Số phiếu Labo and Số lượng are locked (R-306), that Số lượng equals the
   tooth-chip count and goes to 0 / back when "Chọn tất cả" is clicked, that
   Lưu with every tooth unticked prints "Vui lòng chọn răng." under a red
   Răng row and a tick clears it (R-311), that clearing the service line
   brings back "Chọn dịch vụ điều trị trước" with no checkbox, no chips and
   Số lượng 0 (R-310), that a service chip clicked again is unselected and
   Vật liệu falls back to "Chọn dịch vụ trước", that each strip has two
   arrows, that one PNG picked through the hidden file input shows as one
   draft tile and, after Lưu, raises the patient's picture count read from the
   real API by one (R-311), and
   that the native file picker behind "Tải ảnh" stays hidden (R-309). Before
   picking anything it
   clicks Lưu and asserts the reference's per-field validation (R-307): Số lượng
   reads "0", the eight "Vui lòng chọn …" helper lines show under their fields,
   both chip strips are red, the Nhà cung cấp label is red and the dialog
   stays; picking the service line clears the plan / service / doctor errors.
   Then it picks the supplier, a due date, a due time (through the picker's OK,
   since Enter would submit), a service chip and the seeded material, asserts
   no error remains, saves, and asserts the row, its "Mẫu mới" pill and the
   cleared URL;
3. raises Bảo hành from the row and asserts the URL (`laboModal=warranty`,
   `laboRowId`), the locked code, the "Ngày bảo hành" label and the default
   "Theo vật liệu cũ";
4. clicks Lưu with the due date and time empty and asserts the two
   "Vui lòng chọn ngày nhận dự kiến." / "Vui lòng chọn giờ nhận." lines and
   that the dialog stays open (the server-side "Vui lòng chọn vật liệu." step
   is gone: Đặt mới now requires a material, so the parent always has one);
5. switches pills and asserts the parent stays in the URL;
6. picks "Thay đổi vật liệu mới", a group chip and the material, fills the
   due date and time, saves, and
   asserts a second row with the **same code**, the "Bảo hành" pill and the new
   material; reloads and reads both rows back;
7. opens `?laboModal=warranty` cold and asserts Lưu is disabled until a parent
   is picked, and that ✕ clears both params.

Covered since R-312: the code shown in Đặt mới taken by another slip before Lưu — a real POST claims it, Lưu still succeeds and the row carries the next code.

Since R-315 the order and its pictures go up as **one** multipart `POST /api/v1/app/labo-orders` (the JSON action stays beside it, routed by `[Consumes]`); the spec's picture-count check now covers that single request, and the before/after order count is read from the server's `totalCount` because the tab pages at 20 rows. Since R-316 the Bảo hành step also asserts the parent's service line, labo service and material are named on the child form.

Not covered yet: Làm tiếp công đoạn save (same form and server path as Bảo
hành, only `Kind` differs), pictures on a child order (same upload path as
Đặt mới, now with the parent's plan and stage).

`e2e/labo-detail.spec.ts` (R-318, real stack on the production build): seeds an
order through the JSON `POST /labo-orders` with the browser's cookie, opens the
row's eye, asserts the five block titles, the values by label (Khách hàng,
Nhà cung cấp, Ngày gửi, Răng, Màu chi tiết, Số lượng, Chỉ định), an empty
Kiểu nhịp on screen, the "Đơn hàng mới" pill, no Lưu / no status select, the
hidden sheet on `<body>` with `Số:`, `Mã KH:` and `Kiểu nhịp: —`, the print
class + `phieu-labo-<code>` title around a stubbed `window.print`, the
`afterprint` restore, and that Đóng removes the sheet. Not covered: the real
print preview (headless), the dentist's name (the seeded order has none).
