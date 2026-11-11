import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { OFF, setDayOff } from "./fixtures/lichNghi";
import { DAY_OFF, NOT_REGISTERED, setOwnDay } from "./fixtures/ownDayOff";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: doctor pickers leave out staff off the whole day (BA 2026-10-02;
 * R-1210, owner 2026-11-11). `GET /staff?AvailableOn=` is what every picker
 * reads. Off the whole day = SC (nghỉ cả ngày) on the Lịch nghỉ board, or a
 * day off on the old Chấm công; S / C (nghỉ sáng / chiều) stay listed and are
 * refused at save for the half they are off.
 *
 * Real HTTP from inside logged-in pages against the real database; the board
 * marks go through the real board save, the old day off through the real
 * bulk-register endpoint by the doctor themselves (only they may mark their X).
 */

const STAFF = "/api/v1/app/staff";

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface StaffPage {
  items: { id: string }[];
}

async function listedIds(page: Parameters<typeof call>[0], branchId: string, query: string): Promise<string[]> {
  const res = await call<StaffPage>(page, `${STAFF}?MaxResultCount=1000&${query}`, { branchId });
  expect(res.status, `GET staff ${query}`).toBe(200);
  return res.body.items.map((s) => s.id);
}

test.describe("Bác sĩ nghỉ — /staff AvailableOn", () => {
  let branchId: string;
  let otherBranchId: string | undefined;
  let off: RunStaff & { userName: string };
  let unregistered: RunStaff;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await login(page);
    branchId = await firstBranchId(page);
    const branches = await call<{ items: { id: string }[] }>(page, "/api/v1/app/clinic-branches/accessible");
    otherBranchId = branches.body.items.find((b) => b.id !== branchId)?.id;

    const run = `${runId()}${test.info().workerIndex}`;
    const created = await createRunStaff(page, branchId, `off${run}`, {
      isDentist: true,
      roleNames: ["admin"],
      branchIds: otherBranchId ? [branchId, otherBranchId] : [branchId],
    });
    off = { ...created, userName: `tk-e2e-off${run}` };
    unregistered = await createRunStaff(page, branchId, `nr${run}`, { isDentist: true });
  });

  test.afterEach(async ({ page }) => {
    for (const s of [off, unregistered]) if (s) await deleteStaff(page, s.id);
  });

  test("Lịch nghỉ: SC leaves the doctor out that day only, S and C keep them listed, clearing SC brings them back", async ({ page }) => {
    const day = shiftDays(clinicToday(), 2);
    await setDayOff(page, branchId, off.id, day, OFF.FullDay);
    await setDayOff(page, branchId, unregistered.id, day, OFF.Morning);

    const onDay = await listedIds(page, branchId, `AvailableOn=${day}`);
    expect(onDay, "SC left out").not.toContain(off.id);
    expect(onDay, "S still listed").toContain(unregistered.id);
    expect(await listedIds(page, branchId, `AvailableOn=${shiftDays(day, 1)}`), "SC is per day").toContain(off.id);

    await setDayOff(page, branchId, off.id, day, OFF.Afternoon);
    expect(await listedIds(page, branchId, `AvailableOn=${day}`), "SC → C: listed again").toContain(off.id);
    await setDayOff(page, branchId, off.id, day, OFF.FullDay);
    expect(await listedIds(page, branchId, `AvailableOn=${day}`)).not.toContain(off.id);
    await setDayOff(page, branchId, off.id, day, OFF.None);
    expect(await listedIds(page, branchId, `AvailableOn=${day}`), "SC cleared: listed again").toContain(off.id);
  });

  test("old Chấm công X on a day: left out that day only", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 3);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);

    const onDay = await listedIds(page, branchId, `AvailableOn=${day}`);
    expect(onDay, "OFF staff left out").not.toContain(off.id);
    expect(onDay, "unregistered staff still listed").toContain(unregistered.id);

    const nextDay = await listedIds(page, branchId, `AvailableOn=${shiftDays(day, 1)}`);
    expect(nextDay, "OFF is per day").toContain(off.id);

    const noDay = await listedIds(page, branchId, "");
    expect(noDay, "without AvailableOn nobody is filtered").toContain(off.id);
  });

  test("X cleared again: back in the list", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 4);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);
    expect(await listedIds(page, branchId, `AvailableOn=${day}`)).not.toContain(off.id);

    await setOwnDay(browser, off, branchId, day, NOT_REGISTERED);
    expect(await listedIds(page, branchId, `AvailableOn=${day}`)).toContain(off.id);
  });

  test("OFF at another branch does not hide the staff here", async ({ page, browser }) => {
    test.skip(!otherBranchId, "needs a second accessible branch");
    const day = shiftDays(clinicToday(), 5);
    await setOwnDay(browser, off, otherBranchId!, day, DAY_OFF);

    expect(await listedIds(page, branchId, `AvailableOn=${day}`)).toContain(off.id);
    expect(await listedIds(page, otherBranchId!, `AvailableOn=${day}`)).not.toContain(off.id);
  });
});
