# Sơ đồ tổ chức — /staff/org-chart

**BlueDental-local.** The reference (app.nfcdental.com) has no org-chart screen, so
nothing here is cloned. The source is the BA mockup and notes of 2026-10-09
("Ui mới, update giúp anh (tab Sơ đồ tổ chức)"), plus the owner's answers to the
seven open questions (2026-10-10). Feature F-67, tests in
`docs/testing/features/org-chart.md`.

## Where

A fourth tab beside Danh sách nhân viên · Chế tài · Bảng lương (`StaffTabBar`,
key `orgChart`). Route `/staff/org-chart`, guarded by `orgChart:read`.

Layout, top to bottom:

- toolbar: search (highlights units whose name, code or any member matches and dims the rest), **Lịch sử thay
  đổi** (popup), **+ Thêm đơn vị**;
- tree (left) + detail panel of the selected unit (right; the root by default);
- strip "Chưa thuộc đơn vị nào (n)" with **Phân vào đơn vị**: a cream band along the
  bottom of the tree card, with the note "Nhân sự chưa thuộc đơn vị chỉ thấy dữ liệu của chính mình".

## Look (matched to the BA mock by screenshot, R-892)

- Kind colours: root indigo (`--bd-blue-dark`), Phòng ban teal (`--bd-teal`), Team
  orange (`--bd-orange`). The legend uses role names: Tổng giám đốc · Trưởng phòng · Trưởng team.
- A tree node is built around its head: unit label (Phòng ban in capitals), initials
  avatar + head name + role, then a foot with the size ("2 team · 5 nhân sự") and a
  pill "Thấy: …". Team nodes show member initials instead of the pill.
- Detail panel: head avatar, name, "vai trò · đơn vị"; Báo cáo cho ("BS. X (đơn vị)",
  or "— (gốc của cây)" on the root); Quy mô; a box "Phạm vi dữ liệu được xem" with a
  badge and rows Lịch làm việc / Chấm công / Các màn hình khác ("Theo phân quyền được
  cấp"); Cấp dưới trực tiếp listed by head name + unit; members (a Phòng ban or the
  root lists them only when someone besides the head sits there).
- Panel foot (R-893): plain **Sửa đơn vị** · **Thêm thành viên** on Phòng ban and Team
  ("Chỉ có nhánh phòng ban / hoặc team bác sĩ mới có chức năng này"), **Đổi người đứng
  đầu** on the root. The panel is capped at the screen height and its body scrolls, so
  the foot is always at the bottom of the card. The two buttons split the row 50/50 (R-894).
- Responsive (R-894): ≤1100 the card drops under the tree, the tree scrolls sideways
  inside its card, and tapping a node scrolls the card into view; ≤640 the
  "Phân vào đơn vị" button takes the full width of the strip.
- Dialog: when the form has errors a red band reads "Còn n lỗi cần sửa trước khi lưu:
  Tên đơn vị, Trưởng đơn vị." (each label scrolls to its field), and **Lưu đơn vị** stays
  disabled until they are fixed.
- Deliberate differences from the mock: no chi nhánh anywhere, no "Hiệu lực từ ngày",
  scope rows only for Lịch làm việc / Chấm công, sizes counted in "nhân sự" (members
  need not be dentists).
- Gotcha: nodes are `<button>`s, and the global `.app-main button { white-space: nowrap }`
  wins over node text, so `.org-node__foot` sets `white-space: normal` to keep the pill inside.

## Model

| Kind | Code | Parent | Head |
|------|------|--------|------|
| Tổng giám đốc (root) | fixed, one row, id `0f9a0000-0000-4000-8000-000000000001` | none | anyone, may be empty |
| Phòng ban | `PB-xxx` (auto, editable) | root only | required, anyone |
| Team bác sĩ | `TBS-xxx` (auto, editable) | root or a Phòng ban | required, anyone |

- Units are not tied to a clinic branch (BA, 2026-10-10: "không theo chi nhánh").
  The chart is one tree for the whole clinic.
- A staff member heads at most one unit and belongs to at most one unit. The head
  of a unit cannot be a plain member elsewhere.
- Only Phòng ban and Team bác sĩ have members ("Chỉ có nhánh phòng ban / hoặc team
  bác sĩ mới có chức năng này"). Members show as a list.

## Rules (BA note → behaviour)

| BA note | Behaviour |
|---------|-----------|
| "Nhánh đầu tiên mặc định ko xóa được – có thể thay đổi người đứng đầu" | Root has no Xoá; "Đổi người đứng đầu" sets or clears its head (`PUT /root/head`). Delete → `OrgChart:0006` |
| "check trùng match case – hiển thị recommend – tên đã tồn tại thì không cho tạo" | Name compared ignoring case and repeated spaces, accents kept, across the whole system. The dialog suggests existing names while typing and shows "Tên đơn vị đã tồn tại"; server refuses `0001`. Code likewise `0002` |
| "Phòng ban chỉ under Tổng giám đốc; Team bác sĩ chọn Phòng ban hoặc Tổng giám đốc" | Parent picker offers only those; server refuses `0003` |
| "Bắt buộc phải có 1 người làm trưởng đơn vị" | Form rule + server `0004` |
| "Ghi nhận lại log trên 1 popup" | Every write logs a row (Tạo / Sửa / Xoá / Đổi trưởng đơn vị / Gán nhân sự) shown in the history popup: search, action and date filters, paged |
| Delete (owner answer 6) | Xoá sits inside "Sửa đơn vị"; a Phòng ban with teams is refused (`0007`); members of a deleted unit become unassigned |
| Team head (BA, 2026-10-10, replaces owner answer 7) | Anyone, dentist or not: "ai cũng được vì có trường hợp team lễ tân cũng có trưởng phòng". `0008` and `0009` are retired |

## Data scope (Lịch làm việc and Chấm công only)

"Tổng giám đốc thấy tất cả; BS trưởng thấy lịch các BS bên dưới team; BS trong
team chỉ thấy lịch của mình; user ngoài bác sĩ thấy hết (theo phân quyền)."

`OrgChartScopeResolver.VisibleScheduleStaffAsync()` for the signed-in user:

1. not a dentist → no restriction (permissions alone decide);
2. head of the root → no restriction;
3. head of a unit → self + every member and head in that unit's subtree;
4. any other dentist, in a unit or not → self only.

BA (2026-10-10): "em xem sao cho phù hợp là được" — kept as above. A non-dentist
head (e.g. a lễ tân trưởng phòng) falls under rule 1 and keeps what their
permissions give; the chart only narrows dentists.

Applied by `GET /api/v1/app/staff?ScheduleScope=true` (the staff lists of
`TimekeepingBoard` and `WorkScheduleBuilder`) and by the time-keeping list, open
work day and single-record reads (`OrgChart:0012` when out of scope). Every other
screen is unchanged.

## Deleting a staff member

`StaffAppService.DeleteAsync` now leaves the chart first: a staff member who heads
a Phòng ban or Team is refused (`OrgChart:0013`, names the unit); the root seat is
emptied; member rows are removed.

## API

```
GET    /api/v1/app/org-chart                         → { units[], unassigned[] }
GET    /api/v1/app/org-chart/next-code?kind=2|3      → "PB-004" / "TBS-002"
GET    /api/v1/app/org-chart/history?Filter&Action&OrgUnitId&FromDate&ToDate&SkipCount&MaxResultCount
POST   /api/v1/app/org-chart/units                   { kind, name, code?, parentId, headStaffId, memberStaffIds[] }
PUT    /api/v1/app/org-chart/units/{id}              (same body)
DELETE /api/v1/app/org-chart/units/{id}
PUT    /api/v1/app/org-chart/root/head               { headStaffId | null }
POST   /api/v1/app/org-chart/assign                  { orgUnitId, staffIds[] }
```

Tables `bd_org_units`, `bd_org_unit_members`, `bd_org_unit_change_logs`
(migration `20261009221107_AddOrgChart`). Permission subject `orgChart`: read ·
create · update · delete.

## Not built

- "Hiệu lực từ ngày" (owner answer 5).
- Org-chart scope on screens other than Lịch làm việc / Chấm công (owner answer 3).
