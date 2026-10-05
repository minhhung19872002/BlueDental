import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, openBoard } from "./fixtures/receptionBoard";
import {
  call,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  RUN_STAFF_PASSWORD,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: Tiếp nhận — a branch with more than 50 staff (R-693).
 *
 * The board's doctor list used to stop at the first 50 staff by name, so a
 * dentist further down could neither be picked nor start on their own
 * patients. The board now asks for the whole branch, and the server maps the
 * page's roles and branches in one query each instead of two per person.
 *
 * Real HTTP and a real login against the real database. Fillers named
 * "Aaa E2E …" sort ahead of the dentist; all of them are deleted afterwards.
 */

const FILLERS = 52;
const FILLER_ROLES: string[][] = [[], ["dentist"], ["Quản lý chi nhánh", "dentist"]];
const BOARD_ROLE = "Quản lý chi nhánh"; // Tiếp nhận + "Nhân viên – xem"
const FILLER_PREFIX = "Aaa E2E";
const DENTIST_PREFIX = "Bác sĩ E2E";

interface Staff {
  id: string;
  roleNames: string[];
  branchIds: string[];
}

const staffList = (page: Page, branchId: string, max: number, extra = "") =>
  call<{ totalCount: number; items: Staff[] }>(
    page,
    `/api/v1/app/staff?MaxResultCount=${max}&IsActive=true&BranchId=${branchId}${extra}`,
    { branchId },
  );

const sorted = (values: string[]) => [...values].sort();

test.describe.serial("Tiếp nhận — chi nhánh hơn 50 nhân viên", () => {
  const created: RunStaff[] = [];
  let branchId = "";
  let dentist: RunStaff;
  let dentistUserName = "";
  let dentistName = "";

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await browser.newPage();
    await login(page);
    branchId = await firstBranchId(page);
    const run = `dl${runId()}`;

    // One at a time: concurrent creates race on the role's concurrency stamp.
    for (let n = 0; n < FILLERS; n++) {
      created.push(
        await createRunStaff(page, branchId, `${run}f${n}`, {
          name: `${FILLER_PREFIX} ${run} ${String(n).padStart(2, "0")}`,
          roleNames: FILLER_ROLES[n % FILLER_ROLES.length],
        }),
      );
    }

    dentistUserName = `tk-e2e-${run}d`;
    dentistName = `${DENTIST_PREFIX} ${run}`;
    dentist = await createRunStaff(page, branchId, `${run}d`, {
      name: dentistName,
      isDentist: true,
      roleNames: [BOARD_ROLE],
    });
    created.push(dentist);
    await page.close();
  });

  // By name rather than by `created`, so a run that broke off half-way is
  // cleaned up too.
  test.afterAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await browser.newPage();
    await login(page);
    for (const prefix of [FILLER_PREFIX, DENTIST_PREFIX]) {
      const left = await call<{ items: { id: string }[] }>(
        page, `/api/v1/app/staff?MaxResultCount=1000&Filter=${encodeURIComponent(`${prefix} dl`)}`,
      );
      for (const staff of left.body.items) await deleteStaff(page, staff.id);
    }
    await page.close();
  });

  test("the whole branch comes back, each row as the single-staff read has it", async ({ page }) => {
    await login(page);

    // The case being fixed: the dentist is not among the first 50.
    const first50 = await staffList(page, branchId, 50);
    expect(first50.status).toBe(200);
    expect(first50.body.totalCount).toBeGreaterThan(50);
    expect(first50.body.items.map((s) => s.id)).not.toContain(dentist.id);

    const started = Date.now();
    const all = await staffList(page, branchId, 1000);
    const elapsed = Date.now() - started;
    test.info().annotations.push({ type: "list time", description: `${all.body.items.length} staff in ${elapsed} ms` });

    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(all.body.totalCount);
    const ids = all.body.items.map((s) => s.id);
    for (const staff of created) expect(ids).toContain(staff.id);
    expect(elapsed, "one page of the whole branch").toBeLessThan(3_000);

    // Batched roles and branches = what GET /staff/{id} maps one by one.
    for (const row of all.body.items) {
      const single = await call<Staff>(page, `/api/v1/app/staff/${row.id}`, { branchId });
      expect(single.status).toBe(200);
      expect(sorted(row.roleNames), `roles of ${row.id}`).toEqual(sorted(single.body.roleNames));
      expect(sorted(row.branchIds), `branches of ${row.id}`).toEqual(sorted(single.body.branchIds));
    }

    // The pickers' per-day list (days OFF left out) reaches them too.
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const available = await staffList(page, branchId, 1000, `&AvailableOn=${today}`);
    expect(available.status).toBe(200);
    expect(available.body.items.map((s) => s.id)).toContain(dentist.id);
  });

  test("a dentist past the first 50 still opens the board on their own patients", async ({ page }) => {
    await login(page, { userName: dentistUserName, password: RUN_STAFF_PASSWORD });

    const ownList = page.waitForResponse((r) => {
      const url = r.url();
      return url.includes(APPOINTMENTS) && !url.includes("/stats") && r.request().method() === "GET"
        && new URL(url).searchParams.get("dentistId") === dentist.id;
    });
    await openBoard(page);
    expect((await ownList).ok()).toBe(true);

    await expect(page.locator(".reception-doctor-filter .ss-value--selected")).toHaveText(dentistName);
  });
});
