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
 * R-1005 (BA 2026-10-21): breaks inside the window fold out of every view
 * with no mark left — 12:00–13:00 by default, so 11:45 is followed by 13:00.
 * A booking inside a break is hidden, one across it is a single shorter
 * block, and the doctor's count still covers the whole day.
 *
 * Real stack: a throw-away dentist working 07:00–21:00 straight (morning
 * ending as the afternoon starts, so bookings over the lunch hour fit), its
 * bookings on a day years out written through the real API, no interception.
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

interface Booked {
  id: string;
  patientId: string;
}

/**
 * Books `dentistId` with the first patient the server accepts at that time;
 * `allowDentistOverlap` confirms the double-booking warning (R-971).
 */
async function book(
  page: Page, branchId: string, dentistId: string, slotStart: string, slotEnd: string, allowDentistOverlap = false,
): Promise<Booked> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<{ id: string }>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId: patient.id, dentistId, branchId, slotStart, slotEnd, type: 2,
        chiefComplaint: `e2e-hours-${runId()}`, allowDentistOverlap,
      },
    });
    if (res.status === 200) return { id: res.body.id, patientId: patient.id };
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

/** Types a time into a break's picker, found by its accessible name ("Giờ giải lao 2 từ"). */
async function setBreakClock(popover: Locator, label: string, value: string): Promise<void> {
  const input = popover.getByLabel(label, { exact: true });
  await input.click();
  await input.fill(value);
  await input.press("Enter");
  await expect(input).toHaveValue(value);
}

/** The booking across 12:00–13:00 is one block from the 11:30 row to the 13:30 row. */
async function expectAcrossBlock(column: Locator): Promise<void> {
  const blocks = column.locator(".dtl-block");
  const heights = await blocks.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  const tallest = blocks.nth(heights.indexOf(Math.max(...heights)));
  const [block, from, to] = await Promise.all([
    tallest.boundingBox(),
    column.locator('.dtl-cell[data-time="11:30"]').boundingBox(),
    column.locator('.dtl-cell[data-time="13:30"]').boundingBox(),
  ]);
  if (!block || !from || !to) throw new Error("the block or its rows are not laid out");
  expect(Math.abs(block.y - from.y)).toBeLessThanOrEqual(4);
  expect(Math.abs(block.y + block.height - to.y)).toBeLessThanOrEqual(4);
}

const dayMonth = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

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
      morningEndTime: "13:00",
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
    bookings.push((await book(page, branchId, dentist.id, at(day, "07:00"), at(day, "07:30"))).id);

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
    // 08:00 … 18:45 by 15 minutes, less the 12:00–13:00 break (R-1005).
    await expect(miniTicks).toHaveCount(40);
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

  test("the 12:00–13:00 break folds out of every view; breaks are added, refused when they do not fit, removed and kept on reload (R-1005)", async ({ page }) => {
    const day = farDay();
    // Inside the break, across it, after it.
    const inside = await book(page, branchId, dentist.id, at(day, "12:15"), at(day, "12:45"));
    bookings.push(inside.id);
    const across = await book(page, branchId, dentist.id, at(day, "11:30"), at(day, "13:30"), true);
    bookings.push(across.id);
    const after = await book(page, branchId, dentist.id, at(day, "14:00"), at(day, "14:30"));
    bookings.push(after.id);
    const patients = new Set([inside.patientId, across.patientId, after.patientId]).size;

    // Default: 13:00 right under 11:45, nothing between. The booking inside the
    // break is not drawn, the one across it is a single block an hour tall, and
    // the doctor's count still covers the whole day.
    await openDay(page, day);
    const ticks = page.locator(".dtl-tick");
    await expect(ticks).toHaveCount(40);
    await expect(ticks.nth(15)).toHaveText("11:45");
    await expect(ticks.nth(16)).toHaveText("13:00");
    const column = page.locator(".dtl-col").filter({ hasText: dentistName });
    const blocks = column.locator(".dtl-block");
    await expect(blocks).toHaveCount(2);
    await expect(column.locator(".dtl-count")).toHaveText(String(patients));
    await expect(column.locator('.dtl-cell[data-time="12:00"]')).toHaveCount(0);
    await expectAcrossBlock(column);

    // View Tuần folds the same hour.
    await page.locator(".cal-view-controls").getByText("Tuần", { exact: true }).click();
    await expect(page.locator(".cal-week-day-header")).toHaveCount(7);
    const dates = await page.locator(".cal-week-day-header .cal-week-day-date").allTextContents();
    const weekCol = page.locator(".cal-week-day-col").nth(dates.indexOf(dayMonth(day)));
    await expect(weekCol.locator('.cal-day-slot-bg[data-time="11:45"]')).toHaveCount(1);
    await expect(weekCol.locator('.cal-day-slot-bg[data-time="12:00"]')).toHaveCount(0);
    await expect(weekCol.locator('.cal-day-slot-bg[data-time="13:00"]')).toHaveCount(1);
    await expect(weekCol.locator(".cal-day-card-positioner")).toHaveCount(2);

    // So does "Lịch đã hẹn" in Tạo lịch hẹn.
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    const miniTicks = dialog.locator(".mcal-day-time-cell");
    await expect(miniTicks).toHaveCount(40);
    await expect(miniTicks.nth(15)).toHaveText("11:45");
    await expect(miniTicks.nth(16)).toHaveText("13:00");
    await dialog.getByRole("button", { name: "Đóng" }).click();
    await expect(dialog).toBeHidden();

    // A second break starts an hour after the first ends; it hides the 14:00
    // booking and is kept by the browser.
    await openDay(page, day);
    const dayButton = page.locator(".cal-btn-hours.cal-btn-slot--desktop");
    let popover = await openHours(page, dayButton);
    await expect(popover.getByLabel("Giờ giải lao 1 từ", { exact: true })).toHaveValue("12:00");
    await expect(popover.getByLabel("Giờ giải lao 1 đến", { exact: true })).toHaveValue("13:00");
    await popover.getByRole("button", { name: "Thêm giờ giải lao" }).click();
    await expect(popover.getByLabel("Giờ giải lao 2 từ", { exact: true })).toHaveValue("14:00");
    await expect(popover.getByLabel("Giờ giải lao 2 đến", { exact: true })).toHaveValue("15:00");
    await popover.getByRole("button", { name: "Áp dụng" }).click();
    await expect(popover).toBeHidden();
    await expect(ticks).toHaveCount(36);
    await expect(ticks.nth(19)).toHaveText("13:45");
    await expect(ticks.nth(20)).toHaveText("15:00");
    await expect(blocks).toHaveCount(1);

    await page.reload();
    await expect(ticks.nth(20)).toHaveText("15:00");
    await expect(blocks).toHaveCount(1);
    await expect(column.locator(".dtl-count")).toHaveText(String(patients));

    // A break that does not fit is refused before it reaches the calendars.
    popover = await openHours(page, dayButton);
    const alert = popover.getByRole("alert");
    const apply = popover.getByRole("button", { name: "Áp dụng" });
    await setBreakClock(popover, "Giờ giải lao 2 từ", "11:00");
    await expect(alert).toHaveText("Các giờ giải lao không được chồng lên nhau.");
    await expect(apply).toBeDisabled();
    await setBreakClock(popover, "Giờ giải lao 2 từ", "19:00");
    await expect(alert).toHaveText("Giờ giải lao: giờ kết thúc phải sau giờ bắt đầu.");
    await expect(apply).toBeDisabled();
    await setBreakClock(popover, "Giờ giải lao 2 đến", "20:00");
    await expect(alert).toHaveText("Giờ giải lao phải nằm trong khung giờ hiển thị.");
    await expect(apply).toBeDisabled();
    await expect(ticks.nth(20)).toHaveText("15:00");

    // With both breaks removed the whole day is back, lunch-hour booking included.
    await popover.getByRole("button", { name: "Xoá giờ giải lao 2" }).click();
    await expect(alert).toHaveCount(0);
    await expect(popover.getByText("Lịch hẹn ngoài khung giờ này hoặc trong giờ giải lao sẽ bị ẩn.")).toBeVisible();
    await popover.getByRole("button", { name: "Xoá giờ giải lao 1" }).click();
    await expect(popover.locator(".cal-hours-break")).toHaveCount(0);
    await apply.click();
    await expect(popover).toBeHidden();
    await expect(ticks).toHaveCount(44);
    await expect(ticks.nth(16)).toHaveText("12:00");
    await expect(blocks).toHaveCount(3);

    // Mặc định brings 12:00–13:00 back.
    popover = await openHours(page, dayButton);
    await popover.getByRole("button", { name: "Mặc định" }).click();
    await expect(popover.getByLabel("Giờ giải lao 1 từ", { exact: true })).toHaveValue("12:00");
    await expect(popover.getByLabel("Giờ giải lao 1 đến", { exact: true })).toHaveValue("13:00");
    await popover.getByRole("button", { name: "Áp dụng" }).click();
    await expect(ticks).toHaveCount(40);
    await expect(blocks).toHaveCount(2);
    await expectAcrossBlock(column);
  });
});
