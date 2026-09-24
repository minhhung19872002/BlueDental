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

`e2e/labo-orders-actions.spec.ts` (R-500..R-511, 2026-09-24, real stack on the
production build at :8080 over the :5000 host): seeds through `fixtures/laboSeed.ts`
(a plan with one open and one completed service line, a labo order on each) and
runs two cases. **Columns and Thao tác**: the eleven headers in order, the
patient and plan links, the three row buttons with the eye named "Xem", the
plus present on the open line's row and absent on the completed line's row;
the Tiếp tục công đoạn dialog with its locked picker (`code - name`,
`.ss-wrapper--disabled`), the floated "Giờ nhận" over `HH:mm` and empty, the
Bảo hành dialog title. **Detail modal**: pick a status, add two pictures,
remove one, Lưu → the toast, reload, the status pill and the one remaining
tile back from the API, and the folder column enabled. Not covered: the real
print preview (headless), the `Tạo Lịch Hẹn Mới` save (opens the shared
appointment modal only), and there is **no backend host test** for
`SaveDetailAsync` yet.

## Field, i18n and API audit (2026-09-24, R-512..R-519)

Backend: `LaboOrder.DueDate` (day) became `DueAt` (stamp) with the after-sent
guard `Labo:0013` (Domain 16/16, contract 11/11); `ChangeStatus` takes only the
five dialog values; every id route runs `BranchAccessChecker`; removed
pictures lose their blob. Migration `20260923232410_RenameLaboDueDateToDueAt`
renames in place (existing days kept at 00:00). Verified over real HTTP with a
cookie session: 422 `Labo:0002` on `status=2`, 403 `Labo:0012` on cancelling a
received order, 403 `Labo:0013` on a due stamp before the sent stamp.

Frontend: `LABO_KIND_CONFIG` / `LABO_STATUS_CONFIG` and the print sheet's long
date read `t()` keys; Ngày nhận dự kiến + Giờ nhận post one `dueAt`; the due
pair carries the after-sent rule. `labo-orders-actions` 2/2, `labo-detail`,
`labo-warranty`, `labo` — 20/20 on the production build at :8080 over the
:5000 host, no interception. `labo-warranty.spec.ts:315` was re-anchored on the
label/value pair R-510 introduced.

## Leftovers closed (2026-09-24, R-521..R-524)

`e2e/labo-api.spec.ts` drives the API over the real request pipeline from the
logged-in page (cookie session + antiforgery header, multipart via `FormData`,
no interception, no injected token) and is the host-test substitute while the
ABP test base cannot start. It covers: the due stamp keeps its hour and is
refused before the sent stamp (403 `Labo:0013`); `PUT {id}/detail` status
guard (422 `Labo:0002` for Sent, 200 + `receivedAt` for Received, 403
`Labo:0012` cancelling a received order); pictures added and dropped through
the detail — the dropped one answers 403 `Patient:0008` and its MinIO blob is
gone (checked once by hand with `ls -R`); and the branch guard measured with
the `branch2` account (GET 403, PUT 403, list excludes the order).

Clinic day is UTC+7 for the Excel "Hẹn trả" column (R-522; the same entry's
"overdue from midnight" rule was withdrawn by R-530 below). Excel headers were raw `BE:*` keys because the service relied
on ABP's default-resource lookup; it now binds `BlueDentalResource` explicitly
(R-521). `labo*` 24/24 on the production build; Domain 16/16, contract 35/35.

All three were closed later the same day — next section.

## `statusClinic`, the shared localization base and the Excel status (2026-09-24, R-525..R-529)

Staging write survey (`reference-private/survey/staging/labo-statusclinic-cancel-2026-09-24.json`):
the plan page asks `include=labOrders[id,statusClinic,status]`; cancelling a
line with an unfinished labo order answers 400 "Dịch vụ có đơn labo chưa hoàn
tất, không thể huỷ."; the Chuyển đổi dialog shows the "Dịch vụ đang có phiếu
Labo…" block whose "Hủy phiếu Labo" confirm issues
`PUT /api/v1/orders/{id}/update-status {status: canceled, statusClinic: canceled}`
per order, after which both pills read "Đã huỷ" and the counters drop it.

BlueDental mirrors that as `LaboOrder.IsUnfinished`, `CancelForServiceChange()`
(Kind `Canceled = 4`, Status `Rejected`), the `BlueDental:Treatment:0029` guard
on `cancel` / `convert`, `TreatmentServiceDto.labOrders[]` and
`POST /api/v1/app/patient-treatments/{id}/services/{lineId}/cancel-labo-orders`.

Evidence, all real stack on the production build (:8080, host :5000):

- `e2e/labo-api.spec.ts` 5/5 — the guard, the cascade (`labOrders[]` all
  `isUnfinished=false`, order reread `kind 4 / status 6`) and the cancel that
  follows, on a line added for the test so the seed is not used up.
- `e2e/treatment-plan-detail.spec.ts` 14/14 — the block and the disabled Lưu,
  Đóng leaves everything, Xác nhận clears the block with no toast, the patient's
  Labo tab reads "Đã huỷ" after a reload, the reopened dialog has no block.
- `e2e/labo*` full set in file order: 25/25 (2.7 min). The regression log notes
  the pre-existing ordering fragility of "a row names its customer, dentist and
  material" when the files are run out of order.
- Domain 23/23, Application (Labo + TreatmentPlan) 40/40.

Shared base `BlueDentalAppService` sets `LocalizationResource` for the seven
exporting services (R-525); the Excel "Trạng thái" column is localized (R-526).

Still unknown: whether the reference counts `delivered` / `replaced` as
finished for the guard, whether a saved conversion touches `statusClinic`, and
the block's CSS on staging (only its text was captured).

## The three sample filters (2026-09-24, R-530)

The owner found the tabs above the Mẫu Labo table nearly empty. The cause:
every order the app writes is Draft (the FE never calls `/send`), and the
server's "chưa nhận" only took Sent / InProgress / LateDelivery, while
"giao trễ" was derived from the due date. Staging's tabs, clicked for real,
are exact status filters — `status=created` returned orders due back months
earlier, `status=lateDelivery` returned none, and cancelled / replaced orders
sit under Tất cả only. The filter, the counters and the Excel "Giao trễ"
column now share three status rules: awaiting = Draft ∪ Sent ∪ InProgress,
overdue = LateDelivery, returned = Received ∪ Completed. Evidence: demo branch
0→156, 1→110, 2→1, 3→25 by curl; `labo-api.spec.ts` walks one order through
all three tabs and the counters; `labo.spec.ts` reads each tab's real
response. `e2e/labo` 26/26 on the production build.

## The Thao tác conditions on both tables (2026-09-24, R-531)

The owner asked whether the row buttons follow the reference's conditions.
Staging's bundle and DOM, read on Mẫu Labo and on the patient's Labo tab,
agree: the eye is unconditional; with `treatmentLabo:create` the shield is
unconditional and the plus hides only while the treatment line is `done`. The
order's status and statusClinic play no part (a cancelled order keeps all
three) and nothing is disabled. Mẫu Labo already matched; the patient tab
showed the plus on finished lines. The gate moved into the shared
`LaboRowActions` cell. Evidence: `labo-orders-actions.spec.ts` adds two real
service lines to a slip, raises an order on each, completes one line and
cancels the other through the real API, then reads the button names on both
tables and opens Bảo hành from the finished row. `e2e/labo` 27/27 on the
production build.

## Buttons by permission leaf (2026-09-24, R-532)

The owner asked for certainty that every visible action matches staging.
Re-reading the live bundle showed three gaps: the plus and the shield were
gated on `laboTemplate:create` instead of `treatmentLabo:create`; the detail
dialog folded `laboTemplate:update` and `appointment:create` into one flag,
hid the status select instead of greying it and showed a Đóng the reference
does not have; and "In Phiếu Labo" depended on `GET clinic-branches/{id}`,
which only `branchManager.read` may call. The dialog now takes a mode
(`patient` | `orders` with the two abilities), the footer is its own
component, the picture well has a read-only form, and `useBranchInfo` reads
the accessible-branch list. Evidence: `labo-orders-permissions.spec.ts`
creates a dentist through the Nhân sự dialog, grants `laboTemplate.read`,
`treatmentLabo.create`, `appointment.create` and `laboTemplate.update` one at
a time on Cài đặt → Phân quyền, and after each grant the dentist's own session
reloads Mẫu Labo and the test reads the row buttons, the select's disabled
state, the well and the footer text. `e2e/labo` 28/28 on the production
build; `role-permissions-abilities.spec.ts` 1/1 after its helpers moved to
`e2e/fixtures/restrictedDentist.ts`.
