import { expect, test, type Locator } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  call,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  RUN_STAFF_PASSWORD,
  type RunStaff,
} from "./fixtures/timekeepingStaff";
import { bookVisitToday, cardOf } from "./fixtures/receptionBoard";

/**
 * Feature: "Chọn lịch hẹn tiếp theo" draws the doctor's Lịch làm việc, read
 * from GET /appointments/dentist-work-days — the rule booking itself applies
 * (DentistShiftChecker): the profile hours, less a day off or leave.
 *
 * Each run makes a throw-away dentist with its own profile hours, who signs
 * in to take next month's 10th off and the 12th from 09:00 to 10:00 ("Đăng
 * ký nghỉ" works on one's own row only). Real stack, nothing intercepted.
 */

const WORK_DAYS = "/api/v1/app/appointments/dentist-work-days";
const REGISTER_LEAVE = "/api/v1/app/time-keepings/register-leave";
const LeaveShift = { Morning: 1, FullDay: 3 } as const;

interface ShiftWindow {
  start: string;
  end: string;
}

interface WorkDay {
  date: string;
  morning: ShiftWindow;
  afternoon: ShiftWindow;
  windows: ShiftWindow[];
}

/** Next month's `day`, so every day of it can still be taken off. */
function nextMonth(day: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(day);
  return d;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const vn = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const DAY_OFF = nextMonth(10);
const LEAVE_DAY = nextMonth(12);
const PLAIN_DAY = nextMonth(11);

/** "07:30-11:30, 13:30-18:00". */
const hours = (windows: ShiftWindow[]) => windows.map((w) => `${w.start.slice(0, 5)}-${w.end.slice(0, 5)}`).join(", ");

const workDaysUrl = (dentistId: string, from: Date, to: Date) =>
  `${WORK_DAYS}?dentistId=${dentistId}&fromDate=${iso(from)}&toDate=${iso(to)}`;

test.describe("Chọn lịch hẹn tiếp theo — ca làm việc của bác sĩ", () => {
  let branchId: string;
  let dentist: RunStaff;
  /** What the doctor pickers call them: the staff record's name. */
  let dentistName: string;

  test.beforeEach(async ({ page, browser }) => {
    await login(page);
    branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentistName = `BS Ca ${run}`;
    dentist = await createRunStaff(page, branchId, `wd${run}`, {
      name: dentistName,
      roleNames: ["admin"],
      isDentist: true,
      morningStartTime: "07:30",
      morningEndTime: "11:30",
      afternoonStartTime: "13:30",
      afternoonEndTime: "18:00",
    });

    const context = await browser.newContext();
    const own = await context.newPage();
    await login(own, { userName: `tk-e2e-wd${run}`, password: RUN_STAFF_PASSWORD });
    const leave = await call(own, REGISTER_LEAVE, {
      method: "POST",
      branchId,
      json: {
        staffId: dentist.id,
        reason: "E2E",
        days: [
          { workDate: iso(DAY_OFF), shift: LeaveShift.FullDay },
          { workDate: iso(LEAVE_DAY), shift: LeaveShift.Morning, start: "09:00:00", end: "10:00:00" },
        ],
      },
    });
    expect(leave.status, JSON.stringify(leave.body.error)).toBe(200);
    await context.close();
  });

  test.afterEach(async ({ page }) => {
    if (dentist) await deleteStaff(page, dentist.id);
  });

  test("the API lays out a day off, leave and the profile hours, day by day", async ({ page }) => {
    const res = await call<WorkDay[]>(page, workDaysUrl(dentist.id, DAY_OFF, LEAVE_DAY), { branchId });
    expect(res.status, JSON.stringify(res.body.error)).toBe(200);
    const [off, plain, leave] = res.body;
    expect(res.body.map((d) => d.date)).toEqual([iso(DAY_OFF), iso(PLAIN_DAY), iso(LEAVE_DAY)]);

    // A day off keeps its planned shifts to draw, with nothing left to book.
    expect(off.windows).toEqual([]);
    expect(off.morning.start).toBeTruthy();
    // No record that day: the profile hours, not the clinic's 08:00-12:00 / 13:00-17:00.
    expect(hours(plain.windows)).toBe("07:30-11:30, 13:30-18:00");
    expect(hours([plain.morning, plain.afternoon])).toBe("07:30-11:30, 13:30-18:00");
    // Leave is cut out of the morning it falls in.
    expect(hours(leave.windows)).toMatch(/-09:00, 10:00-/);
  });

  test("the API refuses a range it cannot answer, and strangers", async ({ page, browser }) => {
    const backwards = await call(page, workDaysUrl(dentist.id, LEAVE_DAY, DAY_OFF), { branchId });
    expect(backwards.status).toBe(400);
    const far = new Date(DAY_OFF);
    far.setDate(far.getDate() + 62);
    const tooLong = await call(page, workDaysUrl(dentist.id, DAY_OFF, far), { branchId });
    expect(tooLong.status).toBe(400);
    const noDentist = await call(page, `${WORK_DAYS}?fromDate=${iso(DAY_OFF)}&toDate=${iso(LEAVE_DAY)}`, { branchId });
    expect(noDentist.status).toBe(400);

    const anonymous = await browser.newPage();
    await anonymous.goto("/login");
    const refused = await call(anonymous, workDaysUrl(dentist.id, DAY_OFF, LEAVE_DAY));
    expect(refused.status).toBe(401);
    await anonymous.close();
  });

  // Naming another branch in X-Clinic-Branch-Id is not checked against the
  // account's branches anywhere yet (CurrentClinicBranchResolver) — reported
  // separately, so only the account's own branch is asserted here.
  test("another branch reads its own Chấm công, not this branch's leave", async ({ browser }) => {
    const other = await browser.newPage();
    await login(other, BRANCH2_USER);
    const own = await call<WorkDay[]>(other, workDaysUrl(dentist.id, DAY_OFF, DAY_OFF));
    expect(own.status, JSON.stringify(own.body.error)).toBe(200);
    expect(hours(own.body[0].windows)).toBe("07:30-11:30, 13:30-18:00");
    await other.close();
  });

  test("the picker greys out the day off and the leave, and shows the week's hours", async ({ page }) => {
    await page.goto("/reception");
    const visit = await bookVisitToday(page, branchId, 110, "e2e-ca");
    const card = await cardOf(page, visit);
    await card.locator(".rc-col-actions").getByRole("button", { name: /Đổi lịch hẹn/ }).click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    // Đổi bác sĩ → the run's dentist, found by name.
    await panel.getByRole("button", { name: /Đổi bác sĩ/ }).click();
    const search = page.getByRole("textbox", { name: "Tìm bác sĩ" });
    await search.fill(dentistName);
    await search.press("Enter");
    await expect(panel.locator(".fu-doctor-name")).toContainText(dentistName);

    await showWeekOf(panel, DAY_OFF);
    const dayOff = panel.getByRole("button", { name: `Chọn ngày ${vn(DAY_OFF)} · BS nghỉ` });
    await expect(dayOff).toBeDisabled();
    await expect(panel.locator(".fu-doctor-shift")).toContainText("nghỉ");
    await expect(panel.locator(".fu-doctor-shift")).toContainText("07:30–11:30, 13:30–18:00");

    // The leave day: its morning bar runs 07:30–11:30 with 09:00–10:00 hatched.
    await panel.getByRole("button", { name: new RegExp(`^Chọn ngày ${vn(LEAVE_DAY)}`) }).click();
    await expect(panel.locator(".fu-session-range").first()).toHaveText("07:30 – 11:30");
    const morning = panel.getByRole("button", { name: "Chọn khung giờ Buổi sáng" });
    await expect(morning.locator(".fu-off")).toHaveCount(1);

    // A press inside the leave picks nothing; one beside it does.
    const box = (await morning.boundingBox())!;
    const at = (m: number) => ({ x: ((m - 450) / 240) * box.width + 2, y: box.height / 2 });
    await morning.click({ position: at(9 * 60 + 15) });
    await expect(panel.locator(".fu-time--start")).toHaveText("--:--");
    await morning.click({ position: at(10 * 60) });
    await expect(panel.locator(".fu-time--start")).toHaveText("10:00");
    await expect(panel.locator(".fu-time--end")).toHaveText("10:30");
    // The range cannot be stretched back into the leave.
    await expect(panel.getByRole("button", { name: "Lùi giờ bắt đầu 15 phút" })).toBeDisabled();
  });
});

/** Steps the week strip forward until `day` is on it. */
async function showWeekOf(panel: Locator, day: Date) {
  const target = panel.getByRole("button", { name: new RegExp(`^Chọn ngày ${vn(day)}`) });
  for (let i = 0; i < 10 && !(await target.isVisible()); i++) {
    await panel.getByRole("button", { name: "Tuần kế tiếp" }).click();
  }
  await expect(target).toBeVisible();
}
