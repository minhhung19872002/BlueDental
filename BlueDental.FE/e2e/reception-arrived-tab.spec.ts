import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { createRunStaff, deleteStaff, call as staffCall } from "./fixtures/timekeepingStaff";

/**
 * Tiếp nhận — tab "Đã đến" (owner 2026-10-27, R-1047).
 *
 * The second tab was "Chờ khám" and listed bookings not yet arrived alongside
 * arrived ones. It is now "Đã đến": only visits checked in and not yet seen.
 * A visit enters it on Đã đến and leaves it on Đang khám. The Đã đến chip is
 * left as it was (it still counts every arrival, so the chips add up to Tất cả).
 *
 * Real stack: the visit is booked and moved through the real API, the board is
 * a real page reading the server, nothing is intercepted.
 */

type Visit = Appointment & { searchKey: string };

const arrivedTab = (page: Page) => page.locator(".reception-filter-left .ant-segmented-item").nth(1);

/** Opens the board fresh on the Đã đến tab, searching for this run's visit only. */
async function showArrivedTab(page: Page, visit: Visit): Promise<void> {
  const stats = page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}/stats`) && r.ok());
  await page.reload();
  await stats;
  await expect(arrivedTab(page)).toHaveText(/^Đã đến \(\d+\)$/);
  await arrivedTab(page).click();
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes(`filter=${visit.searchKey}`) && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(visit.searchKey);
  await searched;
}

test.describe("Tiếp nhận — tab Đã đến", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("lists a visit only from Đã đến until Đang khám", async ({ page }) => {
    test.setTimeout(120_000);
    const branchId = await openBoard(page);
    // A dentist of this run, so a branch with every dentist booked still takes the visit.
    const run = `${runId()}${test.info().workerIndex}`;
    const dentist = await createRunStaff(page, branchId, `arr${run}`, { name: `BSDaDen${run}`, isDentist: true });
    let visit: Visit | undefined;
    const cards = page.locator(".rc-wrapper");
    try {
      visit = await bookVisitToday(page, branchId, 150, "e2e-r1047");

      // Booked, not arrived: not in the tab.
      await showArrivedTab(page, visit);
      await expect(cards).toHaveCount(0);

      // Arrived: in the tab, with the Đã đến step done.
      expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" })).status).toBe(200);
      await showArrivedTab(page, visit);
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText(visit.patientCode ?? visit.patientName);

      // Being seen: out of the tab again.
      expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/start`, { method: "POST", json: {} })).status).toBe(200);
      await showArrivedTab(page, visit);
      await expect(cards).toHaveCount(0);
    } finally {
      if (visit) await staffCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
      await deleteStaff(page, dentist.id);
    }
  });
});
