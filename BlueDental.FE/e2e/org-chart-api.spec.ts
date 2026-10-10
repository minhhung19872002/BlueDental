import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, createRunStaff, deleteStaff, RUN_STAFF_PASSWORD, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Nhân viên → Sơ đồ tổ chức (F-67) — the rules the API keeps on its
 * own. BlueDental-local; see docs/clone/pages/org-chart.md.
 *
 * Every call is a real HTTP request from inside a page logged in through the
 * login screen. The run's staff are real accounts created through the staff
 * API; the scope checks sign in as those dentists. Nothing is intercepted and
 * every follow-up read is a separate request.
 */

const ORG = "/api/v1/app/org-chart";
const STAFF = "/api/v1/app/staff";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT_ID = "0f9a0000-0000-4000-8000-000000000001";

const KIND = { Root: 1, Department: 2, DoctorTeam: 3 } as const;
const ACTION = { Created: 1, Updated: 2, Deleted: 3, HeadChanged: 4, MembersAssigned: 5 } as const;

interface OrgStaff {
  id: string;
  name: string;
}

interface OrgUnit {
  id: string;
  code: string;
  name: string;
  kind: number;
  parentId: string | null;
  headStaffId: string | null;
  members: OrgStaff[];
}

interface OrgChart {
  units: OrgUnit[];
  unassigned: OrgStaff[];
}

interface ChangeLog {
  orgUnitId: string;
  action: number;
  changes: { field: string; before: string | null; after: string | null }[];
}

interface UnitInput {
  kind?: number;
  name: string;
  code?: string;
  parentId: string;
  headStaffId: string;
  memberStaffIds?: string[];
}

const errorCode = (body: { error?: { code?: string } }) => body.error?.code;

async function chart(page: Page): Promise<OrgChart> {
  const res = await call<OrgChart>(page, ORG, { branchId: BRANCH_ONE });
  expect(res.status, "read the chart").toBe(200);
  return res.body;
}

async function createUnit(page: Page, input: UnitInput) {
  return call<OrgUnit>(page, `${ORG}/units`, { method: "POST", branchId: BRANCH_ONE, json: { memberStaffIds: [], ...input } });
}

async function updateUnit(page: Page, id: string, input: UnitInput) {
  return call<OrgUnit>(page, `${ORG}/units/${id}`, { method: "PUT", branchId: BRANCH_ONE, json: { memberStaffIds: [], ...input } });
}

async function deleteUnit(page: Page, id: string) {
  return call(page, `${ORG}/units/${id}`, { method: "DELETE", branchId: BRANCH_ONE });
}

async function history(page: Page, unitId: string): Promise<ChangeLog[]> {
  const res = await call<{ items: ChangeLog[] }>(page, `${ORG}/history?OrgUnitId=${unitId}&MaxResultCount=50`, { branchId: BRANCH_ONE });
  expect(res.status, "read the history").toBe(200);
  return res.body.items;
}

/** Whose rows the signed-in account gets on Lịch làm việc, among this run's staff. */
async function scheduleRows(page: Page, run: string): Promise<string[]> {
  const res = await call<{ items: { id: string }[] }>(
    page,
    `${STAFF}?ScheduleScope=true&Filter=${encodeURIComponent(run)}&MaxResultCount=100`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status, `schedule staff list (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body.items.map((s) => s.id).sort();
}

async function signInAs(browser: Browser, userName: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: RUN_STAFF_PASSWORD });
  return page;
}

test.describe.serial("Sơ đồ tổ chức — API rules", () => {
  const run = `oc${runId()}`;
  let admin: Page;
  /** Dentists A, B, C and non-dentists X, Y; A/B/C sign in with the admin role so only the chart narrows them. */
  const staff: Record<"a" | "b" | "c" | "x" | "y", RunStaff> = {} as Record<"a" | "b" | "c" | "x" | "y", RunStaff>;
  const units: string[] = [];
  let rootHeadBefore: string | null = null;

  test.beforeAll(async ({ browser }) => {
    admin = await (await browser.newContext()).newPage();
    await login(admin);
    rootHeadBefore = (await chart(admin)).units.find((u) => u.id === ROOT_ID)?.headStaffId ?? null;
    for (const key of ["a", "b", "c"] as const) {
      staff[key] = await createRunStaff(admin, BRANCH_ONE, `${run}${key}`, { name: `BS ${key.toUpperCase()}`, isDentist: true, roleNames: ["admin"] });
    }
    for (const key of ["x", "y"] as const) {
      staff[key] = await createRunStaff(admin, BRANCH_ONE, `${run}${key}`, { name: `NV ${key.toUpperCase()}` });
    }
  });

  test.afterAll(async () => {
    await call(admin, `${ORG}/root/head`, { method: "PUT", branchId: BRANCH_ONE, json: { headStaffId: rootHeadBefore } });
    // Children first: a Phòng ban with teams under it refuses.
    for (const id of units.reverse()) await deleteUnit(admin, id);
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    await admin.context().close();
  });

  test("a team is created, edited and deleted; its people go back to unassigned and each step is logged", async () => {
    const before = await chart(admin);
    expect(before.unassigned.map((s) => s.id)).toEqual(expect.arrayContaining([staff.a.id, staff.b.id]));

    const name = `E2E Team ${run}`;
    const created = await createUnit(admin, {
      kind: KIND.DoctorTeam,
      name,
      parentId: ROOT_ID,
      headStaffId: staff.a.id,
      memberStaffIds: [staff.b.id],
    });
    expect(created.status, JSON.stringify(created.body.error)).toBe(200);
    const team = created.body;
    units.push(team.id);
    expect(team.code, "an empty code takes the next free team code").toMatch(/^TBS-\d{3}$/);
    expect(team.members.map((m) => m.id), "the head comes first").toEqual([staff.a.id, staff.b.id]);

    const afterCreate = await chart(admin);
    expect(afterCreate.units.find((u) => u.id === team.id)?.headStaffId).toBe(staff.a.id);
    expect(afterCreate.unassigned.map((s) => s.id)).not.toContain(staff.a.id);
    expect(afterCreate.unassigned.map((s) => s.id)).not.toContain(staff.b.id);

    // Renaming is an ordinary edit; handing the team to B with A as member is a head change.
    const renamed = await updateUnit(admin, team.id, { name: `${name} sửa`, parentId: ROOT_ID, headStaffId: staff.a.id, memberStaffIds: [staff.b.id] });
    expect(renamed.status, JSON.stringify(renamed.body.error)).toBe(200);
    const handed = await updateUnit(admin, team.id, { name: `${name} sửa`, parentId: ROOT_ID, headStaffId: staff.b.id, memberStaffIds: [staff.a.id] });
    expect(handed.status, JSON.stringify(handed.body.error)).toBe(200);
    expect((await chart(admin)).units.find((u) => u.id === team.id)?.headStaffId).toBe(staff.b.id);

    const removed = await deleteUnit(admin, team.id);
    expect(removed.status, JSON.stringify(removed.body.error)).toBeLessThan(300);
    units.splice(units.indexOf(team.id), 1);

    const afterDelete = await chart(admin);
    expect(afterDelete.units.map((u) => u.id)).not.toContain(team.id);
    expect(afterDelete.unassigned.map((s) => s.id)).toEqual(expect.arrayContaining([staff.a.id, staff.b.id]));

    const log = await history(admin, team.id);
    expect(log.map((l) => l.action).sort()).toEqual([ACTION.Created, ACTION.Updated, ACTION.Deleted, ACTION.HeadChanged].sort());
    const rename = log.find((l) => l.action === ACTION.Updated);
    expect(rename?.changes).toContainEqual({ field: "name", before: name, after: `${name} sửa` });
  });

  test("the chart refuses what the BA rules forbid", async () => {
    const dept = await createUnit(admin, {
      kind: KIND.Department,
      name: `E2E Phòng ${run}`,
      code: `PB-${run}`,
      parentId: ROOT_ID,
      headStaffId: staff.x.id,
    });
    expect(dept.status, JSON.stringify(dept.body.error)).toBe(200);
    units.push(dept.body.id);

    // "check trùng match case": case and extra spaces do not make a new name.
    const dupName = await createUnit(admin, {
      kind: KIND.DoctorTeam,
      name: `  e2e   PHÒNG ${run} `,
      parentId: ROOT_ID,
      headStaffId: staff.a.id,
    });
    expect(errorCode(dupName.body)).toBe("BlueDental:OrgChart:0001");

    const dupCode = await createUnit(admin, { kind: KIND.DoctorTeam, name: `E2E Mã ${run}`, code: `pb-${run}`, parentId: ROOT_ID, headStaffId: staff.a.id });
    expect(errorCode(dupCode.body)).toBe("BlueDental:OrgChart:0002");

    // A team may hang under a Phòng ban...
    const team = await createUnit(admin, { kind: KIND.DoctorTeam, name: `E2E Team PB ${run}`, parentId: dept.body.id, headStaffId: staff.a.id });
    expect(team.status, JSON.stringify(team.body.error)).toBe(200);
    units.push(team.body.id);

    // ...but a Phòng ban only under the Tổng giám đốc.
    const deptUnderTeam = await createUnit(admin, { kind: KIND.Department, name: `E2E PB con ${run}`, parentId: team.body.id, headStaffId: staff.y.id });
    expect(errorCode(deptUnderTeam.body)).toBe("BlueDental:OrgChart:0003");
    const deptUnderDept = await createUnit(admin, { kind: KIND.Department, name: `E2E PB con ${run}`, parentId: dept.body.id, headStaffId: staff.y.id });
    expect(errorCode(deptUnderDept.body)).toBe("BlueDental:OrgChart:0003");

    const twoUnits = await createUnit(admin, { kind: KIND.DoctorTeam, name: `E2E Team 2 ${run}`, parentId: ROOT_ID, headStaffId: staff.a.id });
    expect(errorCode(twoUnits.body)).toBe("BlueDental:OrgChart:0005");

    const rootDelete = await deleteUnit(admin, ROOT_ID);
    expect(errorCode(rootDelete.body)).toBe("BlueDental:OrgChart:0006");

    const deptDelete = await deleteUnit(admin, dept.body.id);
    expect(errorCode(deptDelete.body)).toBe("BlueDental:OrgChart:0007");

    // Anyone may head a team, not only a dentist: a lễ tân team has its trưởng phòng too (BA, 2026-10-10).
    const nonDentistHead = await createUnit(admin, { kind: KIND.DoctorTeam, name: `E2E Team NV ${run}`, parentId: ROOT_ID, headStaffId: staff.y.id });
    expect(nonDentistHead.status, JSON.stringify(nonDentistHead.body.error)).toBe(200);
    expect((await deleteUnit(admin, nonDentistHead.body.id)).status).toBeLessThan(300);

    // A head cannot be deleted from the staff list while they lead a unit.
    const headDelete = await call(admin, `${STAFF}/${staff.x.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(errorCode(headDelete.body)).toBe("BlueDental:OrgChart:0013");

    // Nothing refused reached the chart.
    const names = (await chart(admin)).units.map((u) => u.name);
    expect(names.filter((n) => n.includes(run)).sort()).toEqual([`E2E Phòng ${run}`, `E2E Team PB ${run}`].sort());
  });

  test("Phân vào đơn vị moves people into a unit and the Tổng giám đốc can be changed", async () => {
    const team = (await chart(admin)).units.find((u) => u.name === `E2E Team PB ${run}`);
    expect(team, "the team from the previous step").toBeTruthy();

    const assigned = await call(admin, `${ORG}/assign`, { method: "POST", branchId: BRANCH_ONE, json: { orgUnitId: team!.id, staffIds: [staff.c.id] } });
    expect(assigned.status, JSON.stringify(assigned.body.error)).toBeLessThan(300);
    const after = await chart(admin);
    expect(after.units.find((u) => u.id === team!.id)?.members.map((m) => m.id)).toEqual([staff.a.id, staff.c.id]);
    expect(after.unassigned.map((s) => s.id)).not.toContain(staff.c.id);
    expect((await history(admin, team!.id)).map((l) => l.action)).toContain(ACTION.MembersAssigned);

    // A head cannot be pulled out of the unit they lead.
    const dept = after.units.find((u) => u.name === `E2E Phòng ${run}`)!;
    const pullHead = await call(admin, `${ORG}/assign`, { method: "POST", branchId: BRANCH_ONE, json: { orgUnitId: dept.id, staffIds: [staff.a.id] } });
    expect(errorCode(pullHead.body)).toBe("BlueDental:OrgChart:0010");

    // "Có thể thay đổi người đứng đầu" — the one edit the root takes.
    const rootHead = await call<OrgUnit>(admin, `${ORG}/root/head`, { method: "PUT", branchId: BRANCH_ONE, json: { headStaffId: staff.y.id } });
    expect(rootHead.status, JSON.stringify(rootHead.body.error)).toBe(200);
    expect((await chart(admin)).units.find((u) => u.id === ROOT_ID)?.headStaffId).toBe(staff.y.id);
    const rootLog = await history(admin, ROOT_ID);
    expect(rootLog.some((l) => l.action === ACTION.HeadChanged && l.changes.some((c) => c.after?.includes("NV Y")))).toBe(true);

    // Put the seat back the way the run found it.
    const restored = await call(admin, `${ORG}/root/head`, { method: "PUT", branchId: BRANCH_ONE, json: { headStaffId: rootHeadBefore } });
    expect(restored.status).toBe(200);
  });

  test("a head dentist sees their team's schedules, a member dentist only their own, a non-dentist everyone", async ({ browser }) => {
    // The team from the previous steps: A heads it, C is a member, B sits nowhere.
    const everyone = await scheduleRows(admin, run);
    expect(everyone, "admin is not a dentist").toEqual(Object.values(staff).map((s) => s.id).sort());

    const head = await signInAs(browser, `tk-e2e-${run}a`);
    expect(await scheduleRows(head, run)).toEqual([staff.a.id, staff.c.id].sort());
    await head.context().close();

    const member = await signInAs(browser, `tk-e2e-${run}c`);
    expect(await scheduleRows(member, run)).toEqual([staff.c.id]);
    await member.context().close();

    const loner = await signInAs(browser, `tk-e2e-${run}b`);
    expect(await scheduleRows(loner, run)).toEqual([staff.b.id]);
    await loner.context().close();
  });
});
