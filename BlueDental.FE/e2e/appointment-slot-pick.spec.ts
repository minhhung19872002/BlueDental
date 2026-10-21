import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-976 (BA 2026-10-16): calendars run on 15-minute slots to the end of the day. In
 * Tạo lịch hẹn, Phút starts at 15, Lịch đã hẹn shows 07:00–24:00 in 15-minute
 * slots, and clicking a slot fills Giờ hẹn. The booking it saves is read back
 * after a reload, and the main day view shows it on its 15-minute row.
 * Real stack: a throw-away dentist, a day years out, no interception.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  slotStart: string;
  slotEnd: string;
}

function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

/** "2031-04-17" → "17/04/2031". */
function vnDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar/list");
  return (await request).headers()["x-clinic-branch-id"];
}

test.describe("Lưới 15 phút — Tạo lịch hẹn bấm ô Lịch đã hẹn", () => {
  let branchId: string;
  let dentist: RunStaff;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentist = await createRunStaff(page, branchId, `sp${run}`, { name: `BSO15${run}`, isDentist: true });
    // Reopened so the dentist picker lists the run's dentist.
    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, APPOINTMENTS);
  });

  test.afterEach(async ({ page }) => {
    const left = await dentistBookings(page);
    for (const booking of left) await call(page, `${APPOINTMENTS}/${booking.id}`, { method: "DELETE", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
  });

  async function dentistBookings(page: Page): Promise<Booking[]> {
    const res = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?DentistId=${dentist.id}&fromDate=2027-01-01&toDate=2045-12-31&MaxResultCount=200`, { branchId },
    );
    expect(res.status).toBe(200);
    return res.body.items;
  }

  test("Phút defaults to 15, a click on 10:15 fills Giờ hẹn, the 10:15–10:30 booking survives a reload", async ({ page }) => {
    const day = farDay();
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });

    const minutes = dialog.locator(".appt-field").filter({ hasText: /^Phút/ }).getByRole("spinbutton");
    await expect(minutes).toHaveValue("15");

    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    await dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").filter({ hasText: dentist.fullName }).first().click();

    // Mask mode: fill() is ignored, so type the digits.
    const dateInput = dialog.getByPlaceholder("Chọn thời điểm");
    const dayRead = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
    await dateInput.click({ position: { x: 4, y: 8 } });
    await dateInput.pressSequentially(vnDate(day).replace(/\D/g, ""));
    await dateInput.press("Enter");
    await expect(dateInput).toHaveValue(vnDate(day));
    await dayRead;
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(`Ô 15 phút ${runId()}`);

    // Lịch đã hẹn: the default shown hours 08:00 … 18:45 (R-977), one column per
    // 15 minutes, the 12:00–13:00 break folded out (R-1005): 40 slots, 11:45 then 13:00.
    const ticks = dialog.locator(".mcal-day-time-cell");
    await expect(ticks).toHaveCount(40);
    await expect(ticks.first()).toHaveText("08:00");
    await expect(ticks.nth(1)).toHaveText("08:15");
    await expect(ticks.nth(15)).toHaveText("11:45");
    await expect(ticks.nth(16)).toHaveText("13:00");
    await expect(ticks.last()).toHaveText("18:45");

    const time = dialog.getByPlaceholder("HH:mm");
    await expect(time).toHaveValue("");
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 10:15" }).click();
    await expect(time).toHaveValue("10:15");
    // Picking again replaces it.
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 18:45" }).click();
    await expect(time).toHaveValue("18:45");
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 10:15" }).click();
    await expect(time).toHaveValue("10:15");

    const saved = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.reload();
    const [booking, ...others] = await dentistBookings(page);
    expect(others).toHaveLength(0);
    expect(new Date(booking.slotStart).toISOString()).toBe(at(day, "10:15"));
    expect(new Date(booking.slotEnd).toISOString()).toBe(at(day, "10:30"));

    // The main day view runs on 15-minute rows over the default shown hours
    // (R-977: 08:00–18:45), every quarter hour labelled (BA: 10:00, 10:15, 10:30…).
    const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
    await page.goto(`/calendar?date=${day}`);
    await loaded;
    const column = page.locator(".dtl-col").filter({ hasText: dentist.fullName });
    await expect(column).toHaveCount(1);
    await expect(page.locator(".dtl-tick").nth(9)).toHaveText("10:15");
    await expect(page.locator(".dtl-tick").last()).toHaveText("18:45");
    await expect(column.locator('.dtl-cell[data-time="10:15"]')).toHaveCount(1);
    await expect(column.locator(".dtl-block")).toHaveCount(1);
  });

  test("Tạo lịch tạm: Phút defaults to 15 and a click in Lịch đã hẹn fills Giờ hẹn too", async ({ page }) => {
    await page.goto("/calendar");
    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    await expect(dialog).toBeVisible();

    const minutes = dialog.locator(".appt-field").filter({ hasText: /^Phút/ }).getByRole("spinbutton");
    await expect(minutes).toHaveValue("15");

    // A far day, so no booking left on today's diary sits over the slots clicked below.
    const day = farDay();
    const dateInput = dialog.locator(".appt-field").filter({ hasText: /^Ngày hẹn/ }).getByPlaceholder("Chọn thời điểm");
    const dayRead = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
    await dateInput.click({ position: { x: 4, y: 8 } });
    await dateInput.pressSequentially(vnDate(day).replace(/\D/g, ""));
    await dateInput.press("Enter");
    await expect(dateInput).toHaveValue(vnDate(day));
    await dayRead;
    await expect(dialog.locator(".mcal-day-time-cell")).toHaveCount(40);

    const time = dialog.getByPlaceholder("HH:mm");
    await expect(time).toHaveValue("");
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 10:15" }).click();
    await expect(time).toHaveValue("10:15");
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 18:45" }).click();
    await expect(time).toHaveValue("18:45");
  });
});
