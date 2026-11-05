import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";

/**
 * Feature: Lịch hẹn — a booking clicked opens its patient, as a Tiếp nhận card
 * does (R-1149, BA 2026-11-05 "click cho mở luôn vào hồ sơ, lịch tạm thì mở
 * tạo hồ sơ"):
 *
 * - view Ngày: a click on the block opens the record; a "Lịch tạm" opens
 *   "Tạo hồ sơ" filled in, and the saved record takes the booking over;
 * - view Tuần: a "Lịch tạm"'s name opens "Tạo hồ sơ" too.
 *
 * Editing moved to ⋮ → "Cập nhật" (covered by the day-timeline specs).
 * Real stack throughout; every state is re-read from the server.
 */

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

/** A "Lịch tạm" for later today, under a name unique to this run. */
async function bookTemporary(page: Page, branchId: string, minutesAhead: number) {
  const name = `E2E MO HS ${runId()}`;
  const phone = `09${runId().padStart(8, "0").slice(-8)}`;
  const start = new Date(Date.now() + minutesAhead * 60_000);
  start.setSeconds(0, 0);
  test.skip(dayOf(start) !== dayOf(new Date()), "too close to midnight to book for today");
  const end = new Date(start.getTime() + 30 * 60_000);
  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/temp`, {
    method: "POST",
    json: { patientName: name, patientPhone: phone, branchId, slotStart: start, slotEnd: end },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.isTemporary).toBe(true);
  return { ...res.body, name, phone };
}

/** Today's calendar in the given view, narrowed by the toolbar search. */
async function openCalendar(page: Page, view: "Ngày" | "Tuần", search: string) {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.ok());
  await page.goto("/calendar");
  await loaded;
  if (view === "Tuần") {
    const week = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes("fromDate=") && r.ok());
    await page.getByText("Tuần", { exact: true }).first().click();
    await week;
  }
  await page.locator(".cal-search-field input").fill(search);
}

test.describe("Lịch hẹn — bấm lịch mở hồ sơ (R-1149)", () => {
  let branchId: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await openBoard(page);
  });

  test("view Ngày: a click on a booking opens its patient's record", async ({ page }) => {
    const visit = await bookVisitToday(page, branchId, 50, "e2e-mohs");
    await openCalendar(page, "Ngày", visit.searchKey);

    const block = page.locator(".dtl-block");
    await expect(block).toHaveCount(1);
    await block.click();
    await expect(page).toHaveURL(new RegExp(`/patient/${visit.patientId}\\?tab=(profile|consulting)$`));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("view Ngày: a Lịch tạm opens Tạo hồ sơ filled in, and the saved record takes the booking over", async ({ page }) => {
    const temp = await bookTemporary(page, branchId, 55);
    await openCalendar(page, "Ngày", temp.name);

    const block = page.locator(".dtl-block").filter({ hasText: temp.name });
    await expect(block).toHaveCount(1);
    await block.click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(dialog.getByRole("textbox", { name: /Họ và tên/ })).toHaveValue(temp.name);
    await expect(dialog.getByRole("textbox", { name: /Điện thoại/ })).toHaveValue(temp.phone);

    const attached = page.waitForResponse(
      (r) => r.url().endsWith(`${APPOINTMENTS}/${temp.id}/attach-patient`) && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await attached).status()).toBe(200);
    await expect(dialog).toBeHidden();

    // On the server: no longer temporary, and it names the new record.
    const stored = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${temp.id}`);
    expect(stored.body.isTemporary).toBe(false);
    expect(stored.body.patientId).not.toBe(EMPTY_GUID);

    // After a reload the block is an ordinary booking: a click opens the new record.
    await page.reload();
    await page.locator(".cal-search-field input").fill(temp.name);
    await expect(block).toHaveCount(1);
    await block.click();
    await expect(page).toHaveURL(new RegExp(`/patient/${stored.body.patientId}\\?tab=`));
  });

  test("view Tuần: a Lịch tạm's name opens Tạo hồ sơ filled in", async ({ page }) => {
    const temp = await bookTemporary(page, branchId, 60);
    await openCalendar(page, "Tuần", temp.name);

    const card = page.locator(".evt-card").filter({ hasText: temp.name });
    await expect(card).toHaveCount(1);
    // Cards stacked in the same slot can cover this one: open it from the keyboard.
    await card.locator(".evt-card-title").press("Enter");
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: /Họ và tên/ })).toHaveValue(temp.name);
    await dialog.getByRole("button", { name: /Hủy|Đóng/ }).first().click();
    await expect(dialog).toBeHidden();

    // Closed without saving: still a Lịch tạm.
    const stored = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${temp.id}`);
    expect(stored.body.isTemporary).toBe(true);
  });
});
