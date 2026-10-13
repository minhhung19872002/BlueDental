import { expect, test, type Page, type Response } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as staffCall } from "./fixtures/timekeepingStaff";

/**
 * Feature: Tiếp nhận — the Bác sĩ filter picks several doctors, ranked by the
 * "Mức độ ưu tiên" typed on each one's staff form, like a catalogue row's
 * (QA #27, owner 2026-10-13).
 *
 * - `dentistIds` lists the visits of any of them, grouped by doctor in their
 *   Mức độ ưu tiên (lowest first, a tie by name), then by start time — whatever order
 *   the request names them in; the counters count the same visits.
 * - The filter lists the picks in that order, numbered, with nothing to drag.
 * - The staff dialog saves Mức độ ưu tiên (0 by default) and refuses a negative one.
 *
 * Priorities are set on two real dentists and put back afterwards.
 */

const STAFF = "/api/v1/app/staff";

interface Staff {
  id: string;
  name: string | null;
  userName: string;
  priority: number;
  error?: { code?: string };
}

const isBoardList = (r: Response) => {
  const url = r.url();
  return url.includes(APPOINTMENTS) && !url.includes("/stats") && r.request().method() === "GET" && r.ok();
};

const dentistIdsOf = (r: Response) => new URL(r.url()).searchParams.getAll("dentistIds");

const query = (ids: string[], day: string) =>
  `${APPOINTMENTS}?fromDate=${day}&toDate=${day}&MaxResultCount=1000${ids.map((id) => `&dentistIds=${id}`).join("")}`;

/** Each dentist's position in `ids`, row by row; must never go down. */
const ranks = (items: Appointment[], ids: string[]) => items.map((a) => ids.indexOf(a.dentistId));

const nameOf = (s: Staff) => s.name ?? s.userName;

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

async function readStaff(page: Page, id: string): Promise<Staff> {
  const res = await staffCall<Staff>(page, `${STAFF}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

/** The staff form saved with only Mức độ ưu tiên changed. */
async function setPriority(page: Page, id: string, priority: number) {
  const current = await readStaff(page, id);
  return staffCall<Staff>(page, `${STAFF}/${id}`, {
    method: "PUT",
    json: { ...current, password: undefined, priority },
  });
}

/** Runs `body` with the two dentists ranked as given, then puts their numbers back. */
async function withPriorities(
  page: Page,
  ranked: { id: string; order: number }[],
  body: () => Promise<void>,
) {
  const before = await Promise.all(ranked.map(({ id }) => readStaff(page, id)));
  try {
    for (const { id, order } of ranked) {
      const res = await setPriority(page, id, order);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.priority).toBe(order);
    }
    await body();
  } finally {
    for (const staff of before) await setPriority(page, staff.id, staff.priority);
  }
}

test.describe("Tiếp nhận — lọc nhiều bác sĩ theo thứ tự ưu tiên", () => {
  test("the API groups the picked dentists' visits by their Mức độ ưu tiên", async ({ page }) => {
    await login(page);
    const branchId = await openBoard(page);
    const [a, b] = await twoDentistsWithVisits(page, branchId);
    const today = dayOf(new Date());

    const expectGrouped = async (expected: string[]) => {
      // Asked for in either order, the answer is the same.
      for (const asked of [[a, b], [b, a]]) {
        const res = await call<{ items: Appointment[]; totalCount: number }>(page, branchId, query(asked, today));
        expect(res.status).toBe(200);
        const { items } = res.body;
        expect(items.length).toBeGreaterThan(1);
        expect(items.every((x) => asked.includes(x.dentistId)), "only the picked dentists").toBe(true);
        const rank = ranks(items, expected);
        expect(rank, `grouped by ${expected.join(" → ")}`).toEqual([...rank].sort((x, y) => x - y));
        expect(new Set(rank).size).toBe(2);

        // Within one doctor, still by start time.
        for (const id of expected) {
          const starts = items.filter((x) => x.dentistId === id).map((x) => x.slotStart);
          expect(starts).toEqual([...starts].sort());
        }

        // The counters count those same visits.
        const stats = await call<Record<string, number>>(
          page, branchId, query(asked, today).replace(APPOINTMENTS, `${APPOINTMENTS}/stats`),
        );
        expect(stats.status).toBe(200);
        const counted = ["requested", "confirmed", "checkedIn", "inProgress", "completed", "cancelled", "noShow"]
          .reduce((n, k) => n + (stats.body[k] ?? 0), 0);
        expect(counted).toBe(res.body.totalCount);
      }
    };

    await withPriorities(page, [{ id: a, order: 2 }, { id: b, order: 1 }], () => expectGrouped([b, a]));
    // Renumbered, down to the default 0: the board turns round.
    await withPriorities(page, [{ id: a, order: 0 }, { id: b, order: 5 }], () => expectGrouped([a, b]));

    // One dentist alone: only theirs.
    const single = await call<{ items: Appointment[] }>(page, branchId, query([a], today));
    expect(single.body.items.length).toBeGreaterThan(0);
    expect(single.body.items.every((x) => x.dentistId === a)).toBe(true);
  });

  test("the filter ranks the picks by Mức độ ưu tiên, not by the order clicked", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    const branchId = await openBoard(page);
    const [a, b] = await twoDentistsWithVisits(page, branchId);
    const [staffA, staffB] = [await readStaff(page, a), await readStaff(page, b)];

    // b ranks first, though it is clicked second.
    await withPriorities(page, [{ id: a, order: 2 }, { id: b, order: 1 }], async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");

      const filter = page.locator(".reception-doctor-filter");
      await filter.locator(".ss-trigger").click();
      const dropdown = page.locator(".ms-dropdown");
      await expect(dropdown).toBeVisible();

      let listed = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r).length === 1);
      await dropdown.getByRole("option", { name: nameOf(staffA), exact: true }).click();
      expect(dentistIdsOf(await listed)).toEqual([a]);

      listed = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r).length === 2);
      await dropdown.getByRole("option", { name: nameOf(staffB), exact: true }).click();
      const both = await listed;
      expect(dentistIdsOf(both)).toEqual([b, a]);

      const rows = dropdown.locator(".ms-priority-row");
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText(nameOf(staffB));
      await expect(rows.nth(1)).toContainText(nameOf(staffA));
      await expect(dropdown.locator(".ms-priority-hint")).toHaveText("Theo mức độ ưu tiên của nhân viên");
      // Nothing to drag: the order is the staff form's.
      await expect(dropdown.locator(".bd-grip")).toHaveCount(0);
      await expect(filter.locator(".ss-value--selected")).toHaveText(nameOf(staffB));
      await expect(filter.locator(".ms-more")).toHaveText("+1");

      // The cards follow: the top doctor's first, the other's last.
      const body = (await both.json()) as { items: Appointment[] };
      const rank = ranks(body.items, [b, a]);
      expect(rank).toEqual([...rank].sort((x, y) => x - y));
      await page.locator(".reception-page").click({ position: { x: 5, y: 5 } });
      await expect(dropdown).toBeHidden();
      const cards = page.locator(".rc-wrapper");
      await expect(cards).toHaveCount(body.items.length);
      await expect(cards.first().locator(".rc-doctor-select")).toContainText(nameOf(staffB));
      await expect(cards.last().locator(".rc-doctor-select")).toContainText(nameOf(staffA));

      // ✕ on a pick drops it (a's own list was asked for above, so it may come from the cache).
      await filter.locator(".ss-trigger").click();
      await rows.nth(0).locator(".ms-priority-remove").click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(nameOf(staffA));
      await expect(filter.locator(".ms-more")).toHaveCount(0);
      const onlyA = await call<{ totalCount: number }>(page, branchId, query([a], dayOf(new Date())));
      await expect(cards).toHaveCount(onlyA.body.totalCount);
      await page.locator(".reception-page").click({ position: { x: 5, y: 5 } });

      // Cleared: everyone again (the unfiltered day may come from the cache).
      await filter.locator(".ss-icon--clear").dispatchEvent("mousedown");
      await expect(filter.locator(".ss-value--placeholder")).toBeVisible();
      const everyone = await call<{ totalCount: number }>(page, branchId, query([], dayOf(new Date())));
      await expect(page.locator(".rc-wrapper")).toHaveCount(everyone.body.totalCount);
    });
  });

  test("renumbered on Nhân viên in another tab, the open board reorders on coming back", async ({ page, context }) => {
    test.setTimeout(90_000);
    await login(page);
    const branchId = await openBoard(page);
    const [a, b] = await twoDentistsWithVisits(page, branchId);
    const [staffA, staffB] = [await readStaff(page, a), await readStaff(page, b)];

    await withPriorities(page, [{ id: a, order: 1 }, { id: b, order: 2 }], async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      const filter = page.locator(".reception-doctor-filter");
      await filter.locator(".ss-trigger").click();
      const dropdown = page.locator(".ms-dropdown");
      await dropdown.getByRole("option", { name: nameOf(staffA), exact: true }).click();
      await dropdown.getByRole("option", { name: nameOf(staffB), exact: true }).click();
      const rows = dropdown.locator(".ms-priority-row");
      await expect(rows.nth(0)).toContainText(nameOf(staffA));
      await page.locator(".reception-page").click({ position: { x: 5, y: 5 } });
      const cards = page.locator(".rc-wrapper");
      await expect(cards.first().locator(".rc-doctor-select")).toContainText(nameOf(staffA));

      // Another tab, the staff form's own endpoint: A drops behind B.
      const staffTab = await context.newPage();
      await staffTab.goto("/staff");
      const renumbered = await setPriority(staffTab, a, 3);
      expect(renumbered.status, JSON.stringify(renumbered.body)).toBe(200);
      await staffTab.close();

      // Back on the board: the doctors are read again and the board follows.
      const reordered = page.waitForResponse((r) => isBoardList(r) && dentistIdsOf(r)[0] === b);
      await page.bringToFront();
      // What the browser fires on coming back to the tab (it bubbles up to window).
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
      expect(dentistIdsOf(await reordered)).toEqual([b, a]);
      await expect(cards.first().locator(".rc-doctor-select")).toContainText(nameOf(staffB));
      await expect(cards.last().locator(".rc-doctor-select")).toContainText(nameOf(staffA));
      await filter.locator(".ss-trigger").click();
      await expect(rows.nth(0)).toContainText(nameOf(staffB));
      await expect(rows.nth(1)).toContainText(nameOf(staffA));
    });
  });

  test("the staff dialog saves Mức độ ưu tiên, 0 by default, and the server refuses a negative one", async ({ page }) => {
    await login(page);
    const id = runId();
    const userName = `uutien${id}`;
    const created = await staffCall<Staff>(page, STAFF, {
      method: "POST",
      json: {
        userName,
        password: "UuTien@123456",
        name: `Bác sĩ ưu tiên ${id}`,
        email: `${userName}@bluedental.local`,
        roleNames: ["dentist"],
        branchIds: ["11111111-1111-1111-1111-111111111111"],
        isActive: true,
        isDentist: true,
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const staffId = created.body.id;
    try {
      expect(created.body.priority).toBe(0);

      const negative = await setPriority(page, staffId, -1);
      expect(negative.status).toBe(403);
      expect(negative.body.error?.code).toBe("BlueDental:Staff:0012");

      await page.goto("/staff");
      const row = page.getByRole("row").filter({ hasText: `Bác sĩ ưu tiên ${id}` });
      await row.getByRole("button").first().click();
      const dialog = page.getByRole("dialog");
      const field = dialog.getByLabel("Mức độ ưu tiên");
      await expect(field).toHaveValue("0");
      await field.fill("3");
      const saved = page.waitForResponse((r) => r.url().includes(`${STAFF}/${staffId}`) && r.request().method() === "PUT");
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      expect((await saved).ok()).toBe(true);
      await expect(dialog).toBeHidden();
      expect((await readStaff(page, staffId)).priority).toBe(3);

      await page.reload();
      await row.getByRole("button").first().click();
      const reopened = page.getByRole("dialog");
      await expect(reopened.getByLabel("Mức độ ưu tiên")).toHaveValue("3");

      // Cleared: back to the default 0.
      await reopened.getByLabel("Mức độ ưu tiên").fill("");
      await reopened.getByRole("button", { name: /Lưu/ }).click();
      await expect(reopened).toBeHidden();
      expect((await readStaff(page, staffId)).priority).toBe(0);
    } finally {
      await staffCall(page, `${STAFF}/${staffId}`, { method: "DELETE" });
    }
  });
});
