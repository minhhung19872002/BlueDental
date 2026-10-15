# F-67 — Sơ đồ tổ chức (/staff/org-chart)

BA mockup + notes 2026-10-09, owner answers 2026-10-10. BlueDental-local, nothing
measured on the reference. Behaviour and API: `docs/clone/pages/org-chart.md`.

Status: `VERIFIED` (2026-10-10, uncommitted; re-verified after the BA answers, R-891, and after the BA-mock UI pass, R-892, after the panel-foot fix, R-893, and after the 50/50 buttons + responsive pass, R-894; re-verified 2026-10-13 after R-918: Thêm thành viên + × on the root).

## BA 2026-10-13 (R-918)

- "Thêm thành viên" on the Tổng giám đốc: BS tới may run a team of their own.
- Its member dentists see only themselves on Lịch làm việc / Chấm công (rule 4 of
  the scope, unchanged). Non-dentists keep their permissions (BA answer A).
- Owner chose option B: a × per member, with a confirm, logged as
  "Gỡ khỏi đơn vị" (action 6). Removing a unit's head is refused (`0014`).
- Owner, same day: the × is red (`danger`) with the tooltip "Gỡ khỏi đơn vị", and
  every unit's panel has it (Phòng ban, Team, root), not only the root. The head's
  row has none.
- Evidence: Domain `OrgChartTests` 20/20 (new: a dentist in the root's team sees
  only themself, a non-dentist is not narrowed), Application `OrgChart` 12/12
  (RemoveMemberAsync needs `OrgChart.Update`), e2e `org-chart-api` 5/5 (new test 5)
  and `org-chart` 3/3 (new UI tests: root Thêm thành viên + × with tooltip and
  Hủy/Gỡ; a team member removed from the panel, the head row without ×) on vite
  preview :8113 → host :5000 → PostgreSQL.

## Owner decisions (2026-10-10)

1. The name check ignores case and extra spaces, keeps accents, and applies across
   the whole system.
2. ~~A Phòng ban links to at most one clinic branch.~~ BA, 2026-10-10: units are
   not tied to a branch. The link, its column and `0009` are removed (R-891).
3. The org-chart scope applies to Lịch làm việc and Chấm công only.
4. Every other screen keeps "theo phân quyền được cấp".
5. There is no "Hiệu lực từ ngày".
6. Deleting a unit:
   - Xoá sits inside the Sửa dialog;
   - a Phòng ban that still has teams is refused;
   - members of a deleted unit become unassigned;
   - the root can never be deleted.
7. ~~A Team head must be a dentist.~~ BA, 2026-10-10: anyone may head any unit
   ("team lễ tân cũng có trưởng phòng"). `0008` is removed (R-891).
8. Data scope (BA, 2026-10-10: "em xem sao cho phù hợp"): kept as built. A
   non-dentist head is not narrowed and keeps their permissions.

Taken during the build (not asked), to revisit if the owner disagrees:

- Deleting a staff member who heads a Phòng ban or Team is refused
  (`OrgChart:0013`) until another head is picked.
- Deleting the root head empties the seat instead of refusing.
- Member rows are removed.

## Evidence (real stack: production build `vite preview` :8098, rerun :8113 for R-891..R-894 → host :5000 → PostgreSQL, nothing intercepted)

| Layer | Result |
|-------|--------|
| Domain tests `Staff/OrgChartTests` (14) + `BlueDentalAbilitiesTests` | Domain **843/843** |
| Application `Staff/OrgChartAppServiceContractTests` (5) | Application **715/715** |
| `e2e/org-chart-api.spec.ts` | **4/4**, see the API table below |
| `e2e/org-chart.spec.ts` | **1/1**, see the UI flow below |

`e2e/org-chart-api.spec.ts`:

| Test | Covers |
|------|--------|
| 1 | Create, rename, swap head and delete a team. Codes `TBS-xxx`, head listed first. Members go back to unassigned. History logs Created / Updated / HeadChanged / Deleted |
| 2 | Every refusal: `0001` name differing only in case or spaces, `0002` code, `0003` wrong parent kind, `0005`, `0006` root delete, `0007`, and `0013` staff delete. A Team headed by a non-dentist is accepted (then deleted). None of the refused units is stored |
| 3 | Assign members (MembersAssigned). A head assigned elsewhere gets `0010`. A root head change is logged, then restored |
| 4 | Scope through `GET /staff?ScheduleScope=true`, each user signed in as themselves: admin (non-dentist) sees all 5, the team head sees head + member, the member sees only themself, a dentist in no unit sees only themself |
| 5 | R-954 "Bác sĩ tư vấn" through `GET /staff?AdvisorScope=true&Role=1`, in the returned order: admin gets A, C, B by Mức độ ưu tiên (1, 3, 5); head A gets [A, C]; member C gets [C, A] (self ahead of A's higher priority); B in no unit gets [B]. Test 6 adds: B as a member of the root gets only [B] (Y is no dentist, the units below are not offered) |

`e2e/plan-advisor-scope.spec.ts` (R-954, 1 test): dentist D (member, priority 9)
signs in through the login screen, opens "+ Thêm dịch vụ phát sinh" on a fresh slip:
title "Thêm dịch vụ", no "Nhân sự tư vấn", the "Bác sĩ tư vấn" list is exactly
[D, H] — D first though head H has priority 1; lễ tân N in the team and dentist O
outside it are not offered. Saves with D, reloads, the new line names D.
Then on the plan-detail table: the column headers read "Bác sĩ tư vấn" /
"Bác sĩ tư vấn 2" (no "Nhân sự tư vấn"); the eye's "Chi tiết dịch vụ" lists
"Bác sĩ tư vấn: BS D" and "Bác sĩ tư vấn 2:"; the pencil's "Bác sĩ tư vấn"
picker offers exactly [D, H] again, and "Bác sĩ tư vấn 2" the same two.

`e2e/org-chart.spec.ts` covers the UI flow in one test:

- sign in through the login screen;
- the dialog shows its rules when saved empty (tên, trưởng đơn vị), the red band "Còn 2 lỗi cần sửa trước khi lưu: Tên đơn vị, Trưởng đơn vị." with Lưu disabled, and fills the code `TBS-xxx`;
- save the team: POST 200, toast, node appears, the unassigned count drops by 1;
- the name in other casing and spacing shows "Tên đơn vị đã tồn tại";
- the new node reads "Trưởng team"; the detail panel opens on it, led by the head's name with the unit name beside the role;
- the team survives a reload;
- the history popup has a "Tạo đơn vị" row;
- delete from Sửa đơn vị via the confirm dialog: toast, node gone, count restored, and still gone after a reload.

Data: each run creates its own staff (`tk-e2e-…`) through the staff API and removes
them, its units and the root head it changed in `afterAll`/`afterEach`.

Persistence: verified by reload in the UI spec and by follow-up GETs in the API
spec. Permission: subject `orgChart` (read/create/update/delete), admin role
seeded. Scope: test 4 above. Branch isolation: the chart is clinic-wide, not
branch-scoped (one root, no unit tied to a branch).

## Regression (level 3: shared staff list + Chấm công)

Run with `org-chart*` on the same build:

| Spec | Result |
|------|--------|
| `staff` | green |
| `staff-day-off-api` | green |
| `staff-penalty-api` | green |
| `timekeeping-api` | green |
| `timekeeping-leave` | green |
| `work-schedule-own-dayoff` | green |
| `timekeeping` | 3/4 |
| `staff-employment` | 1/2 |
| `doctor-day-off-pickers` | 0/3 |

Total: 26 pass, 5 red. None of the reds comes from F-67 (all five fixed spec-side
on 2026-10-13, R-920; the same set is now fully green):

- **Pre-existing at HEAD.** The same build of HEAD (git archive, without F-67) on
  :8113 against the same host and DB gives the same 4 reds with the same errors:
  - `timekeeping` KPI test: `data-testid="timekeeping-kpis"` no longer exists in
    `src`. The six KPIs render.
  - `doctor-day-off-pickers` Tạo lịch hẹn and Tạo tiếp nhận: picker UI drift. The
    API part of the same rule, `staff-day-off-api`, is green.
  - `doctor-day-off-pickers` Tạo chẩn đoán: "the branch needs a patient", a seed gap.
- **Data growth.** `staff-employment` UI test: `/staff` sorts by name, 20 per page,
  and the DB has 49 active users. The new "Nhân viên hồ sơ …" row lands on page 3
  and the click times out. Its `finally` cleanup never ran; the 2 leaked rows were
  deleted through the API afterwards.
