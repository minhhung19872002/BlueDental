import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { bookVisitToday, cardOf, getAppointment, openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — the wait clock between "Đã đến" and "Đang khám" (BA).
 *
 * - From check-in the card runs "Đang chờ mm:ss": green under 5 minutes,
 *   yellow from 5, red "Chờ quá lâu" from 10; the yellow and red waits also
 *   recolour the card's edge.
 * - Once the patient is in the chair the clock stops and step 2 notes the
 *   total wait.
 *
 * The visit is booked, checked in and started through the real API and UI;
 * only the browser's clock is moved forward, with Playwright's clock, so the
 * thresholds can be crossed without waiting ten real minutes.
 */

const INDIGO = "rgb(99, 102, 241)";
const AMBER = "rgb(217, 139, 15)";
const RED = "rgb(229, 72, 77)";

test.describe("Tiếp nhận — thời gian chờ", () => {
  test("the clock colours the wait, survives a reload and freezes in the chair", async ({ page }) => {
    await page.clock.install();
    await login(page);
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 25, "e2e-cho");
    const card = await cardOf(page, visit);
    const timer = card.getByRole("timer");
    const edge = card.locator(".rc-card");

    // Not arrived yet: no clock.
    await expect(timer).toHaveCount(0);

    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(timer).toHaveText(/^Đang chờ 00:\d\d$/);
    await expect(timer).toHaveClass(/rc-wait-chip--normal/);
    await expect(edge).toHaveCSS("border-top-color", INDIGO);

    const shown = (await timer.textContent()) ?? "";
    await page.clock.fastForward(3_000);
    await expect(timer).not.toHaveText(shown);

    await page.clock.fastForward("05:00");
    await expect(timer).toHaveText(/^Đang chờ 05:\d\d$/);
    await expect(timer).toHaveClass(/rc-wait-chip--warning/);
    await expect(edge).toHaveCSS("border-top-color", AMBER);

    await page.clock.fastForward("05:00");
    await expect(timer).toHaveText(/^Chờ quá lâu 10:\d\d$/);
    await expect(timer).toHaveClass(/rc-wait-chip--overdue/);
    await expect(edge).toHaveCSS("border-top-color", RED);

    // The clock counts from the server's check-in stamp, not from page load.
    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(reloaded.getByRole("timer")).toHaveText(/^Chờ quá lâu 10:\d\d$/);

    await reloaded.getByRole("button", { name: /Đang khám/ }).click();
    await expect(reloaded.getByRole("timer")).toHaveCount(0);
    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.checkedInAt).toBeTruthy();
    expect(stored.startedAt).toBeTruthy();
    // Both stamps are the server's real time; the browser's clock moved alone.
    const waited = Math.floor((Date.parse(stored.startedAt!) - Date.parse(stored.checkedInAt!)) / 60_000);
    const inChair = reloaded.getByRole("button", { name: /Đang khám/ });
    await expect(inChair).toContainText(`chờ ${waited}p`);
    await expect(reloaded.locator(".rc-card")).toHaveCSS("border-top-color", INDIGO);

    await page.reload();
    const afterStart = await cardOf(page, visit);
    await expect(afterStart.getByRole("timer")).toHaveCount(0);
    await expect(afterStart.getByRole("button", { name: /Đang khám/ })).toContainText(`chờ ${waited}p`);
  });
});
