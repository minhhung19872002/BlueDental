import { expect, test, type Locator } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { DAY_OFF, setOwnDay } from "./fixtures/ownDayOff";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: a doctor registered OFF on Chấm công is not offered by the doctor
 * pickers for that day (BA 2026-10-02) — Tạo lịch hẹn, Tạo tiếp nhận and the
 * diagnosis form.
 *
 * Real stack: the run's dentists are written through the real API, and the
 * OFF doctor marks their own day off signed in as themselves (nobody else may);
 * the pickers read the real `/staff` list.
 * Nothing is intercepted.
 */

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → the DD/MM/YYYY the date inputs take. */
function typed(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * The pickers are in mask mode (DATE_INPUT_FORMAT): a click selects the cell
 * under the pointer, so start at the day cell and type the digits bare.
 */
async function typeDate(input: Locator, day: string) {
  await input.click({ position: { x: 6, y: 8 } });
  await input.pressSequentially(typed(day).replaceAll("/", ""));
  await input.press("Enter");
  await expect(input).toHaveValue(typed(day));
}

test.describe("Bác sĩ nghỉ — ẩn khỏi ô chọn bác sĩ", () => {
  let branchId: string;
  let off: RunStaff & { userName: string };
  let working: RunStaff;
  let offName: string;
  let workingName: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    offName = `BSNghi${run}`;
    workingName = `BSLam${run}`;
    const created = await createRunStaff(page, branchId, `off${run}`, { name: offName, isDentist: true, roleNames: ["admin"] });
    off = { ...created, userName: `tk-e2e-off${run}` };
    working = await createRunStaff(page, branchId, `on${run}`, { name: workingName, isDentist: true });
  });

  test.afterEach(async ({ page }) => {
    for (const s of [off, working]) if (s) await deleteStaff(page, s.id);
  });

  test("Tạo lịch hẹn: OFF day leaves the doctor out, and moving a picked doctor onto it clears the field", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 6);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);

    await page.goto("/calendar/list");
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();

    const date = dialog.getByPlaceholder("Chọn thời điểm");
    const doctorField = dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
    const options = page.locator("#ss-portal-dropdown [role=option]");

    // The next day the OFF doctor works: pick them.
    const listed = page.waitForResponse((res) =>
      res.url().toLowerCase().includes(`availableon=${shiftDays(day, 1)}`),
    );
    await typeDate(date, shiftDays(day, 1));
    expect((await listed).ok()).toBeTruthy();
    await doctorField.getByRole("combobox").click();
    await expect(options.filter({ hasText: workingName })).toHaveCount(1);
    await options.filter({ hasText: offName }).click();
    await expect(doctorField).toContainText(offName);

    // Moved onto the OFF day, the choice is cleared with a field error.
    await typeDate(date, day);
    await expect(doctorField).toContainText("Bác sĩ nghỉ vào ngày này, vui lòng chọn bác sĩ khác");
    await expect(doctorField).not.toContainText(offName);

    await doctorField.getByRole("combobox").click();
    await expect(options.filter({ hasText: workingName })).toHaveCount(1);
    await expect(options.filter({ hasText: offName })).toHaveCount(0);

    // Picking another doctor clears the error.
    await options.filter({ hasText: workingName }).click();
    await expect(doctorField).toContainText(workingName);
    await expect(doctorField).not.toContainText("Bác sĩ nghỉ vào ngày này");
  });

  test("Tạo tiếp nhận: Bác sĩ điều trị follows the visit's day", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 7);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);

    await page.goto("/reception");
    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const doctor = dialog.getByRole("combobox").nth(1);
    const date = dialog.locator(".ant-picker input").first();
    const option = (name: string) => page.locator(".ant-select-item-option", { hasText: name });

    // A day the doctor works: offered; pick them.
    await typeDate(date, shiftDays(day, 1));
    await doctor.click();
    await doctor.fill(offName);
    await expect(option(offName)).toHaveCount(1);
    await option(offName).click();

    // The OFF day: cleared with an error, and not offered.
    await typeDate(date, day);
    await expect(dialog).toContainText("Bác sĩ nghỉ vào ngày này, vui lòng chọn bác sĩ khác");
    await doctor.click();
    await doctor.fill(offName);
    await expect(option(offName)).toHaveCount(0);
    await doctor.fill(workingName);
    await expect(option(workingName)).toHaveCount(1);
  });

  test("Tạo chẩn đoán: a doctor OFF today is not offered", async ({ page, browser }) => {
    await setOwnDay(browser, off, branchId, clinicToday(), DAY_OFF);
    const patients = await call<{ items: { id: string }[] }>(page, "/api/v1/app/patients?MaxResultCount=1", { branchId });
    expect(patients.body.items.length, "the branch needs a patient").toBeGreaterThan(0);

    await page.goto(`/patient/${patients.body.items[0].id}?branchId=${branchId}&tab=consulting`);
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();
    const form = page.getByTestId("diagnosis-form");
    await expect(form).toBeVisible();

    const doctor = form.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" });
    const option = (name: string) =>
      page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: name });
    await doctor.click();
    await doctor.fill(workingName);
    await expect(option(workingName)).toHaveCount(1);
    await doctor.fill(offName);
    await expect(option(offName)).toHaveCount(0);
  });
});
