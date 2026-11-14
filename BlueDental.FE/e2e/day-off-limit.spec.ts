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
 * Lịch nghỉ rules (BA 2026-11-14, R-1233):
 *  - a day off may not cover an appointment already booked with the person,
 *    by half day as booking reads it (Lịch tạm counts, Hủy hẹn does not) —
 *    admin is held to it too (Timekeeping:0020);
 *  - nobody but admin may end a calendar month with more days off than the
 *    branch's "Tối đa ngày nghỉ/tháng" (default 4; nghỉ sáng / chiều count 0.5)
 *    — a head registering for a member is held to it as well (Timekeeping:0021);
 *    a change that lowers the month always passes;
 *  - only admin sets the limit, on the board toolbar.
 *
 * Real stack: run staff, a role and a Phòng ban created through the real API,
 * each account signs in through the login screen, nothing is intercepted.
 */

const BOARD = "/api/v1/app/work-schedules";
const SAVE = `${BOARD}/save`;
const LIMIT = `${BOARD}/day-off-limit`;
const ORG = "/api/v1/app/org-chart";
const APPOINTMENTS = "/api/v1/app/appointments";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT = 1;
const DEPARTMENT = 2;
const SHIFT = { None: 0, Morning: 1, Afternoon: 2, FullDay: 3 } as const;
const OVER_APPOINTMENTS = "BlueDental:Timekeeping:0020";
const OVER_LIMIT = "BlueDental:Timekeeping:0021";
const DEFAULT_LIMIT = 4;
const LEAVES = ["BlueDental.workSchedule.read", "BlueDental.workSchedule.update", "BlueDental.workSchedule.attendanceOthers"];
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

type Who = "head" | "doctor";
type Item = { staffId: string; workDate: string; shift: number };

interface Board {
  maxDayOffDays: number;
  canSetDayOffLimit: boolean;
  groups: { members: { staffId: string; days: { workDate: string; shift: number }[] }[] }[];
}

/** Day `day` of the month `ahead` months after the clinic's current one. */
function dayIn(ahead: number, day: number): string {
  const today = new Date(`${clinicToday()}T00:00:00Z`);
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + ahead, day)).toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+07:00`).toISOString();

/** "Lê An, T3 11/11:" — the start of a team-grid cell's accessible name. */
function cellName(staff: RunStaff, day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${staff.fullName}, ${DOW[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}:`;
}

const save = (page: Page, items: Item[]) =>
  call<{ saved: number }>(page, SAVE, { method: "POST", branchId: BRANCH_ONE, json: { items } });

const setLimit = (page: Page, maxDayOffDays: number) =>
  call<{ maxDayOffDays: number }>(page, LIMIT, { method: "PUT", branchId: BRANCH_ONE, json: { maxDayOffDays } });

async function readBoard(page: Page, day: string): Promise<Board> {
  const res = await call<Board>(page, `${BOARD}?year=${day.slice(0, 4)}&month=${Number(day.slice(5, 7))}`, { branchId: BRANCH_ONE });
  expect(res.status, `read the board (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}

function shiftOn(board: Board, staffId: string, day: string): number {
  const member = board.groups.flatMap((g) => g.members).find((m) => m.staffId === staffId);
  return member?.days.find((d) => d.workDate === day)?.shift ?? SHIFT.None;
}

async function expectSaved(page: Page, items: Item[]) {
  const res = await save(page, items);
  expect(res.status, JSON.stringify(res.body.error)).toBe(200);
}

async function expectRefused(page: Page, items: Item[], code: string): Promise<string> {
  const res = await save(page, items);
  expect(res.status, JSON.stringify(res.body)).toBe(403);
  expect(res.body.error?.code).toBe(code);
  return res.body.error?.message ?? "";
}

test.describe("Lịch nghỉ — giới hạn ngày nghỉ/tháng và lịch hẹn đã có (R-1233)", () => {
  test.describe.configure({ mode: "serial" });

  let admin: Page;
  let adminContext: BrowserContext;
  const staff = {} as Record<Who, RunStaff>;
  const sessions: BrowserContext[] = [];
  const bookings: string[] = [];
  let roleId: string | undefined;
  let unitId: string | undefined;
  let patientId: string;
  let run: string;

  async function signIn(browser: Browser, who: Who): Promise<Page> {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    sessions.push(context);
    const page = await context.newPage();
    await login(page, { userName: `tk-e2e-${run}${who[0]}`, password: RUN_STAFF_PASSWORD });
    return page;
  }

  const off = (who: Who, workDate: string, shift: number): Item => ({ staffId: staff[who].id, workDate, shift });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    run = `dl${runId()}`;
    adminContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    admin = await adminContext.newPage();
    await login(admin);

    const roleName = `E2E gioi han nghi ${run}`;
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

    staff.head = await createRunStaff(admin, BRANCH_ONE, `${run}h`, { roleNames: [roleName] });
    staff.doctor = await createRunStaff(admin, BRANCH_ONE, `${run}d`, { roleNames: [roleName], isDentist: true });

    const chart = await call<{ units: { id: string; kind: number }[] }>(admin, ORG, { branchId: BRANCH_ONE });
    const root = chart.body.units.find((u) => u.kind === ROOT);
    expect(root, "the chart has its root").toBeDefined();
    const unit = await call<{ id: string }>(admin, `${ORG}/units`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { kind: DEPARTMENT, name: `E2E Phòng nghỉ ${run}`, parentId: root!.id, headStaffId: staff.head.id, memberStaffIds: [staff.doctor.id] },
    });
    expect(unit.status, JSON.stringify(unit.body.error)).toBe(200);
    unitId = unit.body.id;

    const patients = await call<{ items: { id: string }[] }>(
      admin, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${BRANCH_ONE}`, { branchId: BRANCH_ONE },
    );
    expect(patients.body.items.length, "the branch needs a patient").toBeGreaterThan(0);
    patientId = patients.body.items[0].id;
  });

  test.beforeEach(() => test.setTimeout(90_000));

  test.afterAll(async () => {
    await setLimit(admin, DEFAULT_LIMIT);
    for (const context of sessions) await context.close();
    for (const id of bookings) await call(admin, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId: BRANCH_ONE });
    if (unitId) await call(admin, `${ORG}/units/${unitId}`, { method: "DELETE", branchId: BRANCH_ONE });
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    if (roleId) await call(admin, `/api/identity/roles/${roleId}`, { method: "DELETE" });
    await adminContext.close();
  });

  test("API: a month stops at 4 days off, S and C half a day; the head is held to it, admin is not", async ({ browser }) => {
    const A = (d: number) => dayIn(2, d);
    const doctor = await signIn(browser, "doctor");
    const head = await signIn(browser, "head");

    const asDoctor = await readBoard(doctor, A(1));
    expect(asDoctor.maxDayOffDays).toBe(DEFAULT_LIMIT);
    expect(asDoctor.canSetDayOffLimit, "only admin sets the limit").toBe(false);
    expect((await readBoard(admin, A(1))).canSetDayOffLimit).toBe(true);

    // 1 + 1 + 1 + 0.5 + 0.5 = 4: exactly the limit.
    await expectSaved(doctor, [
      off("doctor", A(3), SHIFT.FullDay),
      off("doctor", A(4), SHIFT.FullDay),
      off("doctor", A(5), SHIFT.FullDay),
      off("doctor", A(6), SHIFT.Morning),
      off("doctor", A(7), SHIFT.Afternoon),
    ]);

    // Half a day more is over — whether the doctor or the head asks.
    const message = await expectRefused(doctor, [off("doctor", A(8), SHIFT.Morning)], OVER_LIMIT);
    // The raw request names no language: the units after the change, the month, the max.
    expect(message).toMatch(/4[.,]5/);
    expect(message).toContain(`${A(1).slice(5, 7)}/${A(1).slice(0, 4)}`);
    expect(message).toMatch(/\b4\.?$/);
    await expectRefused(head, [off("doctor", A(8), SHIFT.Morning)], OVER_LIMIT);
    // The head's own month is their own.
    await expectSaved(head, [off("head", A(8), SHIFT.FullDay)]);

    // Moving half a day within the month stays at 4; the next month starts again.
    await expectSaved(doctor, [off("doctor", A(3), SHIFT.Morning), off("doctor", A(8), SHIFT.Morning)]);
    await expectSaved(doctor, [off("doctor", dayIn(3, 3), SHIFT.FullDay)]);

    // Admin may go over; the doctor then can only cut back.
    await expectSaved(admin, [off("doctor", A(9), SHIFT.FullDay)]);
    expect(shiftOn(await readBoard(admin, A(9)), staff.doctor.id, A(9))).toBe(SHIFT.FullDay);
    await expectRefused(doctor, [off("doctor", A(10), SHIFT.Morning)], OVER_LIMIT);
    await expectSaved(doctor, [off("doctor", A(9), SHIFT.None)]);

    const after = await readBoard(admin, A(1));
    expect(shiftOn(after, staff.doctor.id, A(3))).toBe(SHIFT.Morning);
    expect(shiftOn(after, staff.doctor.id, A(8))).toBe(SHIFT.Morning);
    expect(shiftOn(after, staff.doctor.id, A(9))).toBe(SHIFT.None);
  });

  test("API: only admin sets the limit, 1 to 31, and the board takes it at once", async ({ browser }) => {
    const A = (d: number) => dayIn(2, d);
    const doctor = await signIn(browser, "doctor");

    expect((await setLimit(doctor, 6)).status).toBe(403);
    expect((await setLimit(admin, 0)).status).toBe(400);
    expect((await setLimit(admin, 32)).status).toBe(400);

    try {
      const raised = await setLimit(admin, 5);
      expect(raised.status, JSON.stringify(raised.body.error)).toBe(200);
      expect(raised.body.maxDayOffDays).toBe(5);
      expect((await readBoard(doctor, A(1))).maxDayOffDays).toBe(5);
      // The doctor's month holds 4 days: one more fits under 5, half a day more does not.
      await expectSaved(doctor, [off("doctor", A(10), SHIFT.FullDay)]);
      await expectRefused(doctor, [off("doctor", A(11), SHIFT.Morning)], OVER_LIMIT);
    } finally {
      expect((await setLimit(admin, DEFAULT_LIMIT)).status).toBe(200);
    }
    expect((await readBoard(doctor, A(1))).maxDayOffDays).toBe(DEFAULT_LIMIT);
    await expectSaved(doctor, [off("doctor", A(10), SHIFT.None)]);
  });

  test("API: a day off may not cover a booked appointment, by half day — Lịch tạm counts, Hủy hẹn not, admin included", async ({ browser }) => {
    const C = (d: number) => dayIn(4, d);
    const doctor = await signIn(browser, "doctor");

    const booked = await call<{ id: string }>(admin, APPOINTMENTS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        patientId, dentistId: staff.doctor.id, branchId: BRANCH_ONE, type: 2,
        slotStart: at(C(15), "09:00"), slotEnd: at(C(15), "09:30"), chiefComplaint: `e2e-gioihan-${run}`,
      },
    });
    expect(booked.status, JSON.stringify(booked.body.error)).toBe(200);
    bookings.push(booked.body.id);

    const [y, m, d] = C(15).split("-");
    const message = await expectRefused(doctor, [off("doctor", C(15), SHIFT.FullDay)], OVER_APPOINTMENTS);
    expect(message).toContain(`${d}/${m}/${y}`);
    await expectRefused(doctor, [off("doctor", C(15), SHIFT.Morning)], OVER_APPOINTMENTS);
    await expectRefused(admin, [off("doctor", C(15), SHIFT.FullDay)], OVER_APPOINTMENTS);
    // The 09:00 visit is a morning one: the afternoon is free to take off, the whole day still not.
    await expectSaved(doctor, [off("doctor", C(15), SHIFT.Afternoon)]);
    await expectRefused(doctor, [off("doctor", C(15), SHIFT.FullDay)], OVER_APPOINTMENTS);

    // A Lịch tạm with the doctor counts as well.
    const temp = await call<{ id: string }>(admin, `${APPOINTMENTS}/temp`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        patientName: `E2E tạm ${run}`, dentistId: staff.doctor.id, branchId: BRANCH_ONE,
        slotStart: at(C(16), "14:00"), slotEnd: at(C(16), "14:30"),
      },
    });
    expect(temp.status, JSON.stringify(temp.body.error)).toBe(200);
    bookings.push(temp.body.id);
    await expectRefused(doctor, [off("doctor", C(16), SHIFT.Afternoon)], OVER_APPOINTMENTS);
    await expectSaved(doctor, [off("doctor", C(16), SHIFT.Morning)]);

    // Once the visit is cancelled the whole day may be taken off.
    const cancel = await call(admin, `${APPOINTMENTS}/${booked.body.id}/cancel`, {
      method: "POST", branchId: BRANCH_ONE, json: { reason: 1, note: "e2e" },
    });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);
    await expectSaved(doctor, [off("doctor", C(15), SHIFT.FullDay)]);

    const board = await readBoard(admin, C(15));
    expect(shiftOn(board, staff.doctor.id, C(15))).toBe(SHIFT.FullDay);
    expect(shiftOn(board, staff.doctor.id, C(16))).toBe(SHIFT.Morning);
  });

  test("UI: the doctor's row reads 4/4, painting past it is refused; admin paints past it and sets the limit", async ({ browser }) => {
    const target = dayIn(2, 12);
    const doctor = await signIn(browser, "doctor");

    const open = async (page: Page) => {
      const loaded = page.waitForResponse((r) => r.url().includes(`${BOARD}?`) && r.request().method() === "GET");
      await page.goto(`/calendar?tab=timekeeping&date=${target}`);
      expect((await loaded).status()).toBe(200);
      await page.locator(".ws-search input").fill(run);
    };

    await open(doctor);
    await expect(doctor.locator(".ws-limit--read")).toHaveText("Tối đa 4 ngày nghỉ/tháng");
    await expect(doctor.locator(".ws-sub").filter({ hasText: "4/4 ngày nghỉ" })).toHaveCount(1);
    await doctor.locator(".ws-brushbar").getByRole("button", { name: /Nghỉ sáng/ }).click();
    const mine = doctor.getByRole("button", { name: cellName(staff.doctor, target) });
    await mine.click();
    await expect(doctor.getByText("Vượt số ngày nghỉ tối đa trong tháng (4 ngày, nghỉ sáng/chiều tính 0,5).")).toBeVisible();
    await expect(mine).not.toHaveText("S");
    await expect(mine).not.toHaveClass(/ws-cell--pending/);
    await expect(doctor.getByRole("button", { name: "Lưu lịch nghỉ" })).toBeDisabled();

    await open(admin);
    await admin.locator(".ws-brushbar").getByRole("button", { name: /Nghỉ sáng/ }).click();
    const theirs = admin.getByRole("button", { name: cellName(staff.doctor, target) });
    await theirs.click();
    await expect(theirs, "admin is not held to the limit").toHaveText("S");
    await expect(admin.locator(".ws-sub--over").filter({ hasText: "4,5/4 ngày nghỉ" })).toHaveCount(1);

    const input = admin.getByRole("spinbutton", { name: "Tối đa ngày nghỉ/tháng" });
    await expect(input).toHaveValue("4");
    const store = admin.locator(".ws-limit").getByRole("button", { name: /Lưu$/ });
    await expect(store).toBeDisabled();
    try {
      await input.fill("5");
      const put = admin.waitForResponse((r) => r.url().endsWith(LIMIT) && r.request().method() === "PUT");
      await store.click();
      expect((await put).status()).toBe(200);
      await expect(admin.getByText("Đã đặt tối đa 5 ngày nghỉ mỗi tháng.")).toBeVisible();
      await expect(admin.locator(".ws-sub").filter({ hasText: "4,5/5 ngày nghỉ" })).toHaveCount(1);
      expect((await readBoard(doctor, target)).maxDayOffDays).toBe(5);
    } finally {
      expect((await setLimit(admin, DEFAULT_LIMIT)).status).toBe(200);
    }
    // The painted cell was never saved.
    expect(shiftOn(await readBoard(admin, target), staff.doctor.id, target)).toBe(SHIFT.None);
  });
});
