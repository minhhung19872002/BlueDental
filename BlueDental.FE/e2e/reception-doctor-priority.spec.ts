import { expect, test, type Page, type Response } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — the Bác sĩ filter picks several doctors, in a priority
 * order the user drags (QA #27).
 *
 * - `dentistIds` lists the visits of any of them, grouped by doctor in the
 *   order given, then by start time; the counters count the same visits.
 * - The board sends the picked doctors in their priority order, and its cards
 *   come in that order; reordering the picks reorders the board.
 */

const isBoardList = (r: Response) => {
  const url = r.url();
  return url.includes(APPOINTMENTS) && !url.includes("/stats") && r.request().method() === "GET" && r.ok();
};

const dentistIdsOf = (r: Response) => new URL(r.url()).searchParams.getAll("dentistIds");

const query = (ids: string[], day: string) =>
  `${APPOINTMENTS}?fromDate=${day}&toDate=${day}&MaxResultCount=1000${ids.map((id) => `&dentistIds=${id}`).join("")}`;

/** Each dentist's position in `ids`, row by row; must never go down. */
const ranks = (items: Appointment[], ids: string[]) => items.map((a) => ids.indexOf(a.dentistId));

/** Two dentists with visits today, booking more until two different ones have some. */
async function twoDentistsWithVisits(page: Page, branchId: string): Promise<[string, string]> {
  const today = dayOf(new Date());
  for (let attempt = 0; attempt < 6; attempt++) {
    const todays = await call<{ items: Appointment[] }>(page, branchId, query([], today));
    const dentists = [...new Set(todays.body.items.map((a) => a.dentistId).filter(Boolean))];
    if (dentists.length >= 2) return [dentists[0], dentists[1]];
    await bookVisitToday(page, branchId, 50 + attempt * 7, "e2e-uutien");
  }
  throw new Error("could not get visits for two different dentists today");
}

test.describe("Tiếp nhận — lọc nhiều bác sĩ theo thứ tự ưu tiên", () => {
  test("the API lists the picked dentists' visits in the order given", async ({ page }) => {
    await login(page);
    const branchId = await openBoard(page);
    const [first, second] = await twoDentistsWithVisits(page, branchId);
    const today = dayOf(new Date());

    for (const order of [[first, second], [second, first]]) {
      const res = await call<{ items: Appointment[]; totalCount: number }>(page, branchId, query(order, today));
      expect(res.status).toBe(200);
      const { items } = res.body;
      expect(items.length).toBeGreaterThan(1);
      expect(items.every((a) => order.includes(a.dentistId)), "only the picked dentists").toBe(true);
      const rank = ranks(items, order);
      expect(rank, `grouped by ${order.join(" → ")}`).toEqual([...rank].sort((a, b) => a - b));
      expect(new Set(rank).size).toBe(2);

      // Within one doctor, still by start time.
      for (const id of order) {
        const starts = items.filter((a) => a.dentistId === id).map((a) => a.slotStart);
        expect(starts).toEqual([...starts].sort());
      }

      // The counters count those same visits.
      const stats = await call<Record<string, number>>(
        page, branchId, query(order, today).replace(APPOINTMENTS, `${APPOINTMENTS}/stats`),
      );
      expect(stats.status).toBe(200);
      const counted = ["requested", "confirmed", "checkedIn", "inProgress", "completed", "cancelled", "noShow"]
        .reduce((n, k) => n + (stats.body[k] ?? 0), 0);
      expect(counted).toBe(res.body.totalCount);
    }

    // One dentist alone: only theirs.
    const single = await call<{ items: Appointment[] }>(page, branchId, query([first], today));
    expect(single.body.items.length).toBeGreaterThan(0);
    expect(single.body.items.every((a) => a.dentistId === first)).toBe(true);
  });

  test("the board sends the picks in priority order and reorders with them", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    const branchId = await openBoard(page);
    const [first, second] = await twoDentistsWithVisits(page, branchId);
    const staff = await call<{ items: { id: string; name: string | null; userName: string }[] }>(
      page, branchId, `/api/v1/app/staff?MaxResultCount=1000&IsActive=true&BranchId=${branchId}&Role=1`,
    );
    const nameOf = (id: string) => {
      const s = staff.body.items.find((x) => x.id === id);
      return s?.name ?? s?.userName ?? "";
    };
    await page.reload();
    await page.waitForLoadState("networkidle");

    const filter = page.locator(".reception-doctor-filter");
    await filter.locator(".ss-trigger").click();
    const dropdown = page.locator(".ms-dropdown");
    await expect(dropdown).toBeVisible();

    // Pick first, then second: the board asks for them in that order.
    let listed = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r).length === 1);
    await dropdown.getByRole("option", { name: nameOf(first), exact: true }).click();
    expect(dentistIdsOf(await listed)).toEqual([first]);

    listed = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r).length === 2);
    await dropdown.getByRole("option", { name: nameOf(second), exact: true }).click();
    const both = await listed;
    expect(dentistIdsOf(both)).toEqual([first, second]);

    const rows = dropdown.locator(".ms-priority-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(nameOf(first));
    await expect(rows.nth(1)).toContainText(nameOf(second));
    // The dropdown stays open for more picks; the trigger names the first and counts the rest.
    await expect(filter.locator(".ss-value--selected")).toHaveText(nameOf(first));
    await expect(filter.locator(".ms-more")).toHaveText("+1");

    const cardsInOrder = async (body: { items: Appointment[] }, order: string[]) => {
      const rank = ranks(body.items, order);
      expect(rank).toEqual([...rank].sort((a, b) => a - b));
      const cards = page.locator(".rc-wrapper");
      await expect(cards).toHaveCount(body.items.length);
      // The first card is the top doctor's, the last the other's.
      await expect(cards.first().locator(".rc-doctor-select")).toContainText(nameOf(order[0]));
      await expect(cards.last().locator(".rc-doctor-select")).toContainText(nameOf(order[1]));
    };
    await cardsInOrder((await both.json()) as { items: Appointment[] }, [first, second]);

    // The second pick moved up with the keyboard: the board turns round.
    listed = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r)[0] === second);
    await rows.nth(1).locator(".bd-grip").focus();
    await page.keyboard.press("ArrowUp");
    const reordered = await listed;
    expect(dentistIdsOf(reordered)).toEqual([second, first]);
    await expect(rows.nth(0)).toContainText(nameOf(second));
    // Closed by a click away, like any dropdown.
    await page.locator(".reception-page").click({ position: { x: 5, y: 5 } });
    await expect(dropdown).toBeHidden();
    await cardsInOrder((await reordered.json()) as { items: Appointment[] }, [second, first]);

    // Cleared: everyone again (the unfiltered day may come from the cache).
    await filter.locator(".ss-icon--clear").dispatchEvent("mousedown");
    await expect(filter.locator(".ss-value--placeholder")).toBeVisible();
    const everyone = await call<{ totalCount: number }>(page, branchId, query([], dayOf(new Date())));
    await expect(page.locator(".rc-wrapper")).toHaveCount(everyone.body.totalCount);
  });
});
