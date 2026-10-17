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
 * Feature: Tiếp nhận — cards ordered by the visit's step (BA, 2026-10-17, R-978, R-979).
 *
 * - "Đang khám" cards come first, "Hoàn tất" cards last, across the whole board.
 * - Among "Đang khám", the one who sat down last is on top — by when the step
 *   was clicked, not by booking time, whoever the doctor (R-979).
 * - Everything else — booked, arrived, late, cancelled — stays between them in
 *   start-time order; "Hủy hẹn" is not sent down with "Hoàn tất" (owner).
 * - It is the board's order: the list endpoint still answers by start time.
 *
 * Six visits are booked for today through the real API. The earliest is
 * finished; three go into the chair in an order that is neither booking order
 * nor its reverse, the last of them from the card itself.
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
  test("Đang khám goes first, last seated on top, and Hoàn tất last, after a reload and after a click", async ({ page }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const key = `e2e-thutu-${runId()}`;
    const today = dayOf(new Date());

    const booked: Appointment[] = [];
    for (const minutesAhead of [20, 50, 80, 110, 140, 170]) {
      booked.push(await bookVisitToday(page, branchId, minutesAhead, key));
    }

    // The API's own order — start time — names the visits.
    const listed = await call<{ items: Appointment[] }>(
      page, branchId, `${APPOINTMENTS}?filter=${key}&fromDate=${today}&toDate=${today}`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(6);
    const [finished, seatedFirst, cancelled, seatedLast, waiting, seatedSecond] = listed.body.items.map((a) => a.id);

    await advance(page, branchId, finished, ["check-in", "start", "complete"]);
    const cancel = await call(page, branchId, `${APPOINTMENTS}/${cancelled}/cancel`, {
      method: "POST",
      json: { reason: 1, note: key },
    });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);
    await advance(page, branchId, seatedFirst, ["check-in", "start"]);
    await advance(page, branchId, seatedSecond, ["check-in", "start"]);
    await advance(page, branchId, seatedLast, ["check-in"]);

    // The endpoint is untouched: still start time, whatever the step.
    const after = await call<{ items: Appointment[] }>(
      page, branchId, `${APPOINTMENTS}?filter=${key}&fromDate=${today}&toDate=${today}`,
    );
    expect(after.body.items.map((a) => a.id)).toEqual(listed.body.items.map((a) => a.id));

    const codeOf = (id: string) => booked.find((b) => b.id === id)?.patientCode ?? "";
    const cards = page.locator(".rc-wrapper");
    const expectOrder = async (ids: string[]) => {
      await expect(cards).toHaveCount(ids.length, { timeout: 15_000 });
      for (const [index, id] of ids.entries()) {
        await expect(cards.nth(index), `card ${index + 1}`).toContainText(codeOf(id));
      }
    };

    // Booked later but seated later too: on top. The arrived one waits mid-board.
    await page.reload();
    await search(page, key);
    await expectOrder([seatedSecond, seatedFirst, cancelled, seatedLast, waiting, finished]);

    // Seated from its card: booked between the other two, it still goes on top.
    await cards.filter({ hasText: codeOf(seatedLast) }).getByRole("button", { name: /Đang khám/ }).click();
    const inChair = [seatedLast, seatedSecond, seatedFirst];
    await expectOrder([...inChair, cancelled, waiting, finished]);

    await page.reload();
    await search(page, key);
    await expectOrder([...inChair, cancelled, waiting, finished]);

    // Finished from the card: it drops below the visit finished earlier.
    await cards.filter({ hasText: codeOf(seatedLast) }).getByRole("button", { name: /Hoàn tất/ }).click();
    await expectOrder([seatedSecond, seatedFirst, cancelled, waiting, finished, seatedLast]);

    await page.reload();
    await search(page, key);
    await expectOrder([seatedSecond, seatedFirst, cancelled, waiting, finished, seatedLast]);
  });
});
