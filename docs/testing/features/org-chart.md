# F-67 — Sơ đồ tổ chức (/staff/org-chart)

BA mockup + notes 2026-10-09, owner answers 2026-10-10. BlueDental-local, nothing
measured on the reference. Behaviour and API: `docs/clone/pages/org-chart.md`.

Status: `VERIFIED` (2026-10-10, uncommitted; re-verified after the BA answers, R-891, and after the BA-mock UI pass, R-892, after the panel-foot fix, R-893, and after the 50/50 buttons + responsive pass, R-894).

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

Total: 26 pass, 5 red. None of the reds comes from F-67:

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
