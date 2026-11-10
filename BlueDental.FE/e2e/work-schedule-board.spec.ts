import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  RUN_STAFF_PASSWORD,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature F-90: Lịch làm việc board (BA P0911). Each person registers Ca sáng /
 * Ca chiều / Cả ngày per day; today and every day before it are locked, and a
 * saved day changed the day before is written to the change log. Whose days
 * show and may change come from the org chart: a Phòng ban member sees the
 * Phòng ban and edits only their own days, its head edits everyone under them,
 * staff in no unit sit in "Chưa phân nhóm", seen by admin and themselves.
 *
 * Real stack: run staff, a role and a Phòng ban are created through the real
 * API; every account signs in through the login screen; nothing is intercepted.
 */

const BOARD = "/api/v1/app/work-schedules";
const SAVE = `${BOARD}/save`;
const ORG = "/api/v1/app/org-chart";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT = 1;
const DEPARTMENT = 2;
const SHIFT = { None: 0, Morning: 1, Afternoon: 2, FullDay: 3 } as const;
const DAY_LOCKED = "BlueDental:Timekeeping:0018";
const NOT_EDITABLE = "BlueDental:Timekeeping:0019";
const NOT_IN_BRANCH = "BlueDental:Timekeeping:0016";
const LEAVES = ["BlueDental.workSchedule.read", "BlueDental.workSchedule.update", "BlueDental.workSchedule.attendanceOthers"];
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface BoardMember {
  staffId: string;
  fullName: string;
  canEdit: boolean;
  days: { workDate: string; shift: number }[];
}
interface Board {
  today: string;
  groups: { unitId: string | null; name: string | null; members: BoardMember[] }[];
}
interface SaveResult {
  saved: number;
  logged: number;
}

type Who = "head" | "member" | "peer" | "loner";

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function readBoard(page: Page, day: string, branchId = BRANCH_ONE): Promise<Board> {
  const res = await call<Board>(page, `${BOARD}?year=${day.slice(0, 4)}&month=${Number(day.slice(5, 7))}`, { branchId });
  expect(res.status, `read the board (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}

function memberOf(board: Board, staffId: string): BoardMember | undefined {
  return board.groups.flatMap((g) => g.members).find((m) => m.staffId === staffId);
}

function shiftOn(board: Board, staffId: string, day: string): number {
  return memberOf(board, staffId)?.days.find((d) => d.workDate === day)?.shift ?? SHIFT.None;
}

async function save(page: Page, items: { staffId: string; workDate: string; shift: number }[], branchId = BRANCH_ONE) {
  return call<SaveResult>(page, SAVE, { method: "POST", branchId, json: { items } });
}

/** "Lê An, T3 11/11:" — the start of a team-grid cell's accessible name. */
function cellName(staff: RunStaff, day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${staff.fullName}, ${DOW[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}:`;
}

test.describe("Lịch làm việc (F-90)", () => {
  test.describe.configure({ mode: "serial" });

  let admin: Page;
  let adminContext: BrowserContext;
  const staff = {} as Record<Who, RunStaff>;
  const sessions: BrowserContext[] = [];
  let roleId: string | undefined;
  let unitId: string | undefined;
  let run: string;

  async function signIn(browser: Browser, who: Who): Promise<Page> {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    sessions.push(context);
    const page = await context.newPage();
    await login(page, { userName: `tk-e2e-${run}${who[0]}`, password: RUN_STAFF_PASSWORD });
    return page;
  }

  test.beforeAll(async ({ browser }) => {
    run = `ws${runId()}`;
    adminContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    admin = await adminContext.newPage();
    await login(admin);

    const roleName = `E2E lich lam viec ${run}`;
    const role = await call<{ id: string }>(admin, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status, JSON.stringify(role.body.error)).toBe(200);
    roleId = role.body.id;
    const grant = await call(admin, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
      method: "PUT",
      json: { permissions: LEAVES.map((name) => ({ name, isGranted: true })) },
    });
    expect(grant.status).toBe(204);

    for (const who of ["head", "member", "peer", "loner"] as const) {
      staff[who] = await createRunStaff(admin, BRANCH_ONE, `${run}${who[0]}`, { roleNames: [roleName] });
    }

    const chart = await call<{ units: { id: string; kind: number }[] }>(admin, ORG, { branchId: BRANCH_ONE });
    const root = chart.body.units.find((u) => u.kind === ROOT);
    expect(root, "the chart has its root").toBeDefined();
    const unit = await call<{ id: string }>(admin, `${ORG}/units`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        kind: DEPARTMENT,
        name: `E2E Phòng lịch ${run}`,
        parentId: root!.id,
        headStaffId: staff.head.id,
        memberStaffIds: [staff.member.id, staff.peer.id],
      },
    });
    expect(unit.status, JSON.stringify(unit.body.error)).toBe(200);
    unitId = unit.body.id;
  });

  test.afterAll(async () => {
    for (const context of sessions) await context.close();
    if (unitId) await call(admin, `${ORG}/units/${unitId}`, { method: "DELETE", branchId: BRANCH_ONE });
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    if (roleId) await call(admin, `/api/identity/roles/${roleId}`, { method: "DELETE" });
    await adminContext.close();
  });

  test("API: who sees whom — Phòng ban, its head, Chưa phân nhóm, admin", async ({ browser }) => {
    const tomorrow = shiftDays(clinicToday(), 1);

    const asAdmin = await readBoard(admin, tomorrow);
    expect(asAdmin.today).toBe(clinicToday());
    const unassigned = asAdmin.groups.find((g) => g.unitId === null);
    expect(unassigned?.members.map((m) => m.staffId), "admin sees Chưa phân nhóm").toContain(staff.loner.id);
    const dept = asAdmin.groups.find((g) => g.unitId === unitId);
    expect(dept?.members.map((m) => m.staffId)).toEqual(
      expect.arrayContaining([staff.head.id, staff.member.id, staff.peer.id]),
    );
    expect(dept?.members[0].staffId, "the head leads the group").toBe(staff.head.id);
    for (const who of ["head", "member", "peer", "loner"] as const) {
      expect(memberOf(asAdmin, staff[who].id)?.canEdit, `admin edits ${who}`).toBe(true);
    }

    const head = await readBoard(await signIn(browser, "head"), tomorrow);
    expect(memberOf(head, staff.loner.id), "the head does not see Chưa phân nhóm").toBeUndefined();
    for (const who of ["head", "member", "peer"] as const) {
      expect(memberOf(head, staff[who].id)?.canEdit, `head edits ${who}`).toBe(true);
    }

    const member = await readBoard(await signIn(browser, "member"), tomorrow);
    expect(memberOf(member, staff.loner.id)).toBeUndefined();
    expect(memberOf(member, staff.member.id)?.canEdit, "member edits themselves").toBe(true);
    expect(memberOf(member, staff.peer.id)?.canEdit, "member sees the peer, read only").toBe(false);
    expect(memberOf(member, staff.head.id)?.canEdit, "member sees the head, read only").toBe(false);

    const loner = await readBoard(await signIn(browser, "loner"), tomorrow);
    const everyone = loner.groups.flatMap((g) => g.members.map((m) => m.staffId));
    expect(everyone, "staff in no unit see only themselves").toEqual([staff.loner.id]);
    expect(loner.groups[0].unitId).toBeNull();
  });

  test("API: tomorrow on saves and persists, a late change is logged, today and the past are locked", async ({ browser }) => {
    const today = clinicToday();
    const tomorrow = shiftDays(today, 1);
    const later = shiftDays(today, 3);
    const member = await signIn(browser, "member");
    const head = await signIn(browser, "head");

    // A member may not touch the peer's days; one refused cell refuses the batch.
    const refused = await save(member, [
      { staffId: staff.member.id, workDate: later, shift: SHIFT.FullDay },
      { staffId: staff.peer.id, workDate: later, shift: SHIFT.FullDay },
    ]);
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe(NOT_EDITABLE);
    expect(shiftOn(await readBoard(admin, later), staff.member.id, later), "nothing written").toBe(SHIFT.None);

    // A new day — tomorrow included — is no late change.
    const own = await save(member, [
      { staffId: staff.member.id, workDate: tomorrow, shift: SHIFT.FullDay },
      { staffId: staff.member.id, workDate: later, shift: SHIFT.Morning },
    ]);
    expect(own.status, JSON.stringify(own.body.error)).toBe(200);
    expect(own.body).toEqual({ saved: 2, logged: 0 });

    // The head changes, then cancels, the member's saved tomorrow: logged both times.
    const edit = await save(head, [{ staffId: staff.member.id, workDate: tomorrow, shift: SHIFT.Afternoon }]);
    expect(edit.body).toEqual({ saved: 1, logged: 1 });
    expect(shiftOn(await readBoard(admin, tomorrow), staff.member.id, tomorrow)).toBe(SHIFT.Afternoon);
    const cancel = await save(head, [{ staffId: staff.member.id, workDate: tomorrow, shift: SHIFT.None }]);
    expect(cancel.body).toEqual({ saved: 1, logged: 1 });

    // Further ahead a change is not late; saving the same shift again writes nothing.
    const ahead = await save(head, [{ staffId: staff.member.id, workDate: later, shift: SHIFT.FullDay }]);
    expect(ahead.body).toEqual({ saved: 1, logged: 0 });
    const same = await save(head, [{ staffId: staff.member.id, workDate: later, shift: SHIFT.FullDay }]);
    expect(same.body).toEqual({ saved: 0, logged: 0 });

    const board = await readBoard(admin, later);
    expect(shiftOn(board, staff.member.id, later)).toBe(SHIFT.FullDay);
    if (later.slice(0, 7) === tomorrow.slice(0, 7)) {
      expect(shiftOn(board, staff.member.id, tomorrow), "a cancelled day reads Chưa đăng ký").toBe(SHIFT.None);
    }

    // Today and yesterday are locked for everyone, admin included.
    for (const [who, page] of [["admin", admin], ["member", member]] as const) {
      for (const workDate of [today, shiftDays(today, -1)]) {
        const res = await save(page, [{ staffId: staff.member.id, workDate, shift: SHIFT.Morning }]);
        expect(res.status, `${who} → ${workDate}`).toBe(403);
        expect(res.body.error?.code, `${who} → ${workDate}`).toBe(DAY_LOCKED);
      }
    }
    expect(shiftOn(await readBoard(admin, today), staff.member.id, today)).toBe(SHIFT.None);
  });

  test("API: another branch neither lists nor writes this branch's staff", async () => {
    const branches = await call<{ items: { id: string }[] }>(admin, "/api/v1/app/clinic-branches/accessible");
    const other = branches.body.items.find((b) => b.id !== BRANCH_ONE);
    expect(other, "admin works in a second branch").toBeDefined();
    const day = shiftDays(clinicToday(), 4);

    const board = await readBoard(admin, day, other!.id);
    expect(memberOf(board, staff.member.id)).toBeUndefined();

    const res = await save(admin, [{ staffId: staff.member.id, workDate: day, shift: SHIFT.FullDay }], other!.id);
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe(NOT_IN_BRANCH);
    expect(shiftOn(await readBoard(admin, day), staff.member.id, day)).toBe(SHIFT.None);
  });

  test("UI: paint, confirm and save survive a reload; locked and read-only cells refuse", async ({ browser }) => {
    const today = clinicToday();
    const target = shiftDays(today, 5);
    const page = await signIn(browser, "head");

    const open = async (day: string) => {
      const loaded = page.waitForResponse((r) => r.url().includes(`${BOARD}?`) && r.request().method() === "GET");
      await page.goto(`/calendar?tab=timekeeping&date=${day}`);
      expect((await loaded).status()).toBe(200);
      await page.locator(".ws-search input").fill(run);
    };
    const cell = (who: RunStaff, day: string) => page.getByRole("button", { name: cellName(who, day) });

    await open(target);
    const mine = cell(staff.member, target);
    await expect(mine).toHaveAccessibleName(`${cellName(staff.member, target)} Chưa đăng ký`);

    await page.locator(".ws-brushbar").getByRole("button", { name: /Ca sáng/ }).click();
    await mine.click();
    await expect(mine).toHaveText("S");
    await expect(mine).toHaveClass(/ws-cell--pending/);

    await page.getByRole("button", { name: "Lưu lịch" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(staff.member.fullName);
    const saved = page.waitForResponse((r) => r.url().endsWith(SAVE) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Xác nhận lưu" }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Đã lưu 1 thay đổi lịch làm việc.")).toBeVisible();

    await page.reload();
    await page.locator(".ws-search input").fill(run);
    await expect(cell(staff.member, target)).toHaveText("S");
    await expect(cell(staff.member, target)).not.toHaveClass(/ws-cell--pending/);
    expect(shiftOn(await readBoard(admin, target), staff.member.id, target)).toBe(SHIFT.Morning);

    // Today is locked: a press warns and changes nothing.
    await open(today);
    const locked = cell(staff.member, today);
    await expect(locked).toHaveAttribute("aria-disabled", "true");
    await locked.click({ force: true });
    await expect(page.getByText("Không thể đăng ký cho hôm nay hoặc ngày đã qua.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu lịch" })).toBeDisabled();

    // The member sees the head's row read only.
    const asMember = await signIn(browser, "member");
    await asMember.goto(`/calendar?tab=timekeeping&date=${target}`);
    await asMember.locator(".ws-search input").fill(run);
    const headCell = asMember.getByRole("button", { name: cellName(staff.head, target) });
    await expect(headCell).toHaveAttribute("aria-disabled", "true");
    await headCell.click({ force: true });
    await expect(asMember.getByText("Bạn không có quyền sửa lịch làm việc của người này.")).toBeVisible();
    await expect(asMember.getByRole("button", { name: cellName(staff.member, target) })).toHaveAttribute("aria-disabled", "false");
  });
});
