import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-977 (owner 2026-10-16): the hours a calendar shows are the viewer's own
 * choice, kept in the browser only. Every view has a ⏱ button — view Ngày,
 * view Tuần and "Lịch đã hẹn" in Tạo lịch hẹn — and all of them share one
 * window: 08:00–18:45 by default (the 18:45 slot is still drawn). A booking
 * outside the window is hidden until the viewer widens it; the view never
 * widens by itself.
 *
 * Real stack: a throw-away dentist with long profile hours, a booking at
 * 07:00 on a day years out written through the real API, no interception.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  return (await request).headers()["x-clinic-branch-id"];
}

/** Books `dentistId` with the first patient the server accepts at that time. */
async function book(page: Page, branchId: string, dentistId: string, slotStart: string, slotEnd: string): Promise<string> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<{ id: string }>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: { patientId: patient.id, dentistId, branchId, slotStart, slotEnd, type: 2, chiefComplaint: `e2e-hours-${runId()}` },
    });
    if (res.status === 200) return res.body.id;
    lastError = res.body.error;
  }
  throw new Error(`no booking could be made: ${JSON.stringify(lastError)}`);
}

async function openDay(page: Page, day: string): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  await expect(page.locator(".dtl-col").first()).toBeVisible();
}

/** Opens the ⏱ popover from `button` and returns it. */
async function openHours(page: Page, button: Locator): Promise<Locator> {
  await button.click();
  const popover = page.locator(".cal-hours-popover:not(.ant-popover-hidden)");
  await expect(popover.getByText("Khung giờ hiển thị")).toBeVisible();
  return popover;
}

/** Types a time into the popover's Từ giờ / Đến giờ picker, as a user would. */
async function setClock(popover: Locator, label: "Từ giờ" | "Đến giờ", value: string): Promise<void> {
  const input = popover.locator(".cal-hours-field").filter({ hasText: label }).locator("input");
  await input.click();
  await input.fill(value);
  await input.press("Enter");
  await expect(input).toHaveValue(value);
}

test.describe("Khung giờ hiển thị — lịch hẹn (R-977)", () => {
  let branchId: string;
  let dentist: RunStaff;
  let dentistName: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentistName = `BSGio${run}`;
    dentist = await createRunStaff(page, branchId, `sh${run}`, {
      name: dentistName,
      isDentist: true,
      morningStartTime: "07:00",
      morningEndTime: "12:00",
      afternoonStartTime: "13:00",
      afternoonEndTime: "21:00",
    });
    const traffic = assertRealApiTraffic(page, APPOINTMENTS);
    await page.goto("/calendar");
    await traffic;
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
  });

  test("08:00–18:45 by default; widening it shows the 07:00 booking in every view and survives a reload; Mặc định resets all views", async ({ page }) => {
    const day = farDay();
    bookings.push(await book(page, branchId, dentist.id, at(day, "07:00"), at(day, "07:30")));

    // Default window: the 07:00 booking is outside it, so it is not drawn —
    // the doctor's count still covers the whole day.
    await openDay(page, day);
    const ticks = page.locator(".dtl-tick");
    await expect(ticks.first()).toHaveText("08:00");
    await expect(ticks.last()).toHaveText("18:45");
    const column = page.locator(".dtl-col").filter({ hasText: dentistName });
    await expect(column).toHaveCount(1);
    await expect(column.locator(".dtl-block")).toHaveCount(0);
    await expect(column.locator(".dtl-count")).toHaveText("1");

    // An end before the start is refused before it reaches the calendars.
    const dayButton = page.locator(".cal-btn-hours.cal-btn-slot--desktop");
    let popover = await openHours(page, dayButton);
    await setClock(popover, "Từ giờ", "07:00");
    await setClock(popover, "Đến giờ", "06:00");
    await expect(popover.getByRole("alert")).toHaveText("Giờ kết thúc phải sau giờ bắt đầu.");
    await expect(popover.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
    await expect(ticks.first()).toHaveText("08:00");

    await setClock(popover, "Đến giờ", "20:00");
    await popover.getByRole("button", { name: "Áp dụng" }).click();
    await expect(popover).toBeHidden();
    await expect(ticks.first()).toHaveText("07:00");
    await expect(ticks.last()).toHaveText("20:00");
    await expect(column.locator(".dtl-block")).toHaveCount(1);

    // Kept by the browser: a reload shows the same window and the booking.
    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: dentistName }).locator(".dtl-block")).toHaveCount(1);
    await expect(ticks.first()).toHaveText("07:00");
    await expect(ticks.last()).toHaveText("20:00");

    // View Tuần shares the window.
    await page.locator(".cal-view-controls").getByText("Tuần", { exact: true }).click();
    const weekSlots = page.locator(".cal-week-day-col").first().locator(".cal-day-slot-bg");
    await expect(weekSlots.first()).toHaveAttribute("data-time", "07:00");
    await expect(weekSlots.last()).toHaveAttribute("data-time", /^(19:30|19:45|20:00)$/);

    // So does "Lịch đã hẹn" in Tạo lịch hẹn; its own ⏱ resets every view.
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    const miniTicks = dialog.locator(".mcal-day-time-cell");
    await expect(miniTicks.first()).toHaveText("07:00");
    await expect(miniTicks.last()).toHaveText("20:00");

    popover = await openHours(page, dialog.locator(".appt-mini-cal-hours-btn"));
    await popover.getByRole("button", { name: "Mặc định" }).click();
    await expect(popover.locator(".cal-hours-field").filter({ hasText: "Từ giờ" }).locator("input")).toHaveValue("08:00");
    await expect(popover.locator(".cal-hours-field").filter({ hasText: "Đến giờ" }).locator("input")).toHaveValue("18:45");
    await popover.getByRole("button", { name: "Áp dụng" }).click();
    await expect(miniTicks).toHaveCount(44);
    await expect(miniTicks.first()).toHaveText("08:00");
    await expect(miniTicks.last()).toHaveText("18:45");

    await dialog.getByRole("button", { name: "Đóng" }).click();
    await expect(dialog).toBeHidden();
    await expect(weekSlots.first()).toHaveAttribute("data-time", "08:00");

    await openDay(page, day);
    await expect(ticks.first()).toHaveText("08:00");
    await expect(ticks.last()).toHaveText("18:45");
    await expect(page.locator(".dtl-col").filter({ hasText: dentistName }).locator(".dtl-block")).toHaveCount(0);
  });
});
