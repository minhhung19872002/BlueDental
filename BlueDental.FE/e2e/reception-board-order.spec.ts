import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  APPOINTMENTS,
  bookVisitToday,
  call,
  dayOf,
  openBoard,
  type Appointment,
} from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — cards ordered by the visit's step (BA, 2026-10-17, R-978).
 *
 * - "Đang khám" cards come first, "Hoàn tất" cards last, across the whole board.
 * - Everything else — booked, arrived, late, cancelled — stays between them in
 *   start-time order; "Hủy hẹn" is not sent down with "Hoàn tất" (owner).
 * - It is the board's order: the list endpoint still answers by start time.
 *
 * Four visits are booked for today through the real API and moved so that the
 * earliest is finished and the latest in the chair — the opposite of time order.
 */

type Step = "check-in" | "start" | "complete";

async function advance(page: Page, branchId: string, id: string, steps: Step[]) {
  for (const step of steps) {
    const res = await call(page, branchId, `${APPOINTMENTS}/${id}/${step}`, { method: "POST", json: {} });
    expect(res.status, `${step}: ${JSON.stringify(res.body.error)}`).toBe(200);
  }
}

async function search(page: Page, key: string) {
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes(`filter=${key}`) && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(key);
  await searched;
}

test.describe("Tiếp nhận — thứ tự thẻ theo bước khám", () => {
  test("Đang khám goes first and Hoàn tất last, after a reload and after a click", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    const branchId = await openBoard(page);
    const key = `e2e-thutu-${runId()}`;
    const today = dayOf(new Date());

    const booked: Appointment[] = [];
    for (const minutesAhead of [20, 70, 120, 170]) {
      booked.push(await bookVisitToday(page, branchId, minutesAhead, key));
    }

    // The API's own order — start time — names the visits.
    const listed = await call<{ items: Appointment[] }>(
      page, branchId, `${APPOINTMENTS}?filter=${key}&fromDate=${today}&toDate=${today}`,
    );
    expect(listed.status).toBe(200);
    const [finished, cancelled, waiting, inChair] = listed.body.items.map((a) => a.id);
    expect(listed.body.items).toHaveLength(4);

    await advance(page, branchId, finished, ["check-in", "start", "complete"]);
    const cancel = await call(page, branchId, `${APPOINTMENTS}/${cancelled}/cancel`, {
      method: "POST",
      json: { reason: 1, note: key },
    });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);
    await advance(page, branchId, inChair, ["check-in", "start"]);

    // The endpoint is untouched: still start time, whatever the step.
    const after = await call<{ items: Appointment[] }>(
      page, branchId, `${APPOINTMENTS}?filter=${key}&fromDate=${today}&toDate=${today}`,
    );
    expect(after.body.items.map((a) => a.id)).toEqual([finished, cancelled, waiting, inChair]);

    const codeOf = (id: string) => booked.find((b) => b.id === id)?.patientCode ?? "";
    const cards = page.locator(".rc-wrapper");
    const expectOrder = async (ids: string[]) => {
      await expect(cards).toHaveCount(ids.length, { timeout: 15_000 });
      for (const [index, id] of ids.entries()) {
        await expect(cards.nth(index), `card ${index + 1}`).toContainText(codeOf(id));
      }
    };

    await page.reload();
    await search(page, key);
    await expectOrder([inChair, cancelled, waiting, finished]);

    // Finished from the card: it drops below the visit finished earlier.
    const card = cards.filter({ hasText: codeOf(inChair) });
    await card.getByRole("button", { name: /Hoàn tất/ }).click();
    await expectOrder([cancelled, waiting, finished, inChair]);

    await page.reload();
    await search(page, key);
    await expectOrder([cancelled, waiting, finished, inChair]);
  });
});
