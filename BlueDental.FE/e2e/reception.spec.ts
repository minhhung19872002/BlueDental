import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, cardOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as staffCall, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Tiếp nhận + Lịch hẹn.
 *
 * The reception board used to fall back to a local store, so it looked like it
 * worked while nothing was persisted. These tests only pass if the data really
 * round-trips through the API and PostgreSQL: a visit is an appointment of the
 * day, and the tab counters are the server's `/appointments/stats`.
 */

interface Stats {
  requested?: number;
  confirmed?: number;
  checkedIn?: number;
  inProgress?: number;
  completed?: number;
  cancelled?: number;
  noShow?: number;
}

/** The Segmented tabs, in board order: Tất cả, Chờ khám, Đang khám, Hoàn thành. */
const tab = (page: Page, index: number): Locator =>
  page.locator(".reception-filter-left .ant-segmented-item").nth(index);

async function countOf(item: Locator): Promise<number> {
  const match = /\((\d+)\)\s*$/.exec((await item.innerText()).trim());
  return match ? Number(match[1]) : Number.NaN;
}

const statsResponse = (page: Page) =>
  page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}/stats`) && r.request().method() === "GET" && r.ok());

/** Picks the option of an AntD Select whose label contains `text`, searching for it first. */
async function pick(page: Page, select: Locator, text: string): Promise<void> {
  await select.click();
  await select.locator("input").fill(text);
  const option = page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: text });
  await expect(option.first()).toBeVisible({ timeout: 15_000 });
  await option.first().click();
}

test.describe("Tiếp nhận", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("receiving a patient stores a real visit and moves the counters", async ({ page }) => {
    test.setTimeout(90_000);
    const branchId = await openBoard(page);
    const run = `${runId()}${test.info().workerIndex}`;
    const searchKey = `e2e-tiepnhan-${run}`;

    // The drawer books 30 minutes from about now; a visit cannot cross midnight.
    const start = new Date();
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 40 * 60_000);
    test.skip(end.getDate() !== start.getDate(), "too close to midnight to receive a patient for today");

    // A dentist and a patient of this run alone, so no earlier booking is in the way.
    const doctorName = `BSTiepNhan${run}`;
    let dentist: RunStaff | undefined;
    let visitId: string | undefined;
    try {
      dentist = await createRunStaff(page, branchId, `rcp${run}`, { name: doctorName, isDentist: true });
      // Off-hours runs (lunch, evening) need the dentist on shift first.
      expect(await openShiftCovering(page, branchId, dentist.id, start, end), "the run's dentist should be on shift now").toBe(true);
      const suffix = run.slice(-8).padStart(8, "0");
      const patientName = `Tiếp nhận ${suffix}`;
      const patient = await call<{ id: string; patientCode: string }>(page, branchId, "/api/v1/app/patients", {
        method: "POST",
        json: { firstName: patientName, lastName: "E2E", gender: "male", phoneNumber: `07${suffix}` },
      });
      expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);

      // The doctor list is read when the board opens; until the stats answer,
      // every tab shows a placeholder "(0)".
      const statsLoaded = statsResponse(page);
      await page.reload();
      await statsLoaded;
      const all = tab(page, 0);
      const waiting = tab(page, 1);
      const allBefore = await countOf(all);
      const waitingBefore = await countOf(waiting);

      await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const selects = dialog.locator(".ant-select");
      await pick(page, selects.nth(0), patient.body.patientCode);
      await pick(page, selects.nth(1), doctorName);
      await dialog.locator("textarea").fill(searchKey);

      // The time defaults to the minute the drawer opened, and the server refuses
      // a slot that starts before the current minute, so a save that runs past
      // the minute boundary would be "in the past". A few minutes ahead keeps it
      // valid, as long as the picker still lists that hour (07–19).
      const ahead = new Date(Date.now() + 3 * 60_000);
      if (ahead.getHours() <= 19 && ahead.getDate() === start.getDate()) {
        const hhmm = `${String(ahead.getHours()).padStart(2, "0")}:${String(ahead.getMinutes()).padStart(2, "0")}`;
        const time = dialog.locator(".ant-picker input").nth(1);
        await time.fill(hhmm);
        await time.press("Enter");
        await expect(time).toHaveValue(hhmm);
      }

      const created = page.waitForResponse(
        (r) => r.url().endsWith(APPOINTMENTS) && r.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Lưu" }).click();
      const response = await created;
      expect(response.status(), await response.text()).toBe(200);
      const visit = (await response.json()) as Appointment;
      visitId = visit.id;
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Tạo tiếp nhận thành công!")).toBeVisible();

      // The visit is waiting, so both "Tất cả" and "Chờ khám" move by one.
      await expect.poll(() => countOf(all)).toBe(allBefore + 1);
      await expect.poll(() => countOf(waiting)).toBe(waitingBefore + 1);

      await page.reload();
      await expect.poll(() => countOf(tab(page, 0))).toBe(allBefore + 1);
      await expect.poll(() => countOf(tab(page, 1))).toBe(waitingBefore + 1);

      // And the board shows its card, as stored, for the patient and doctor picked.
      const card = await cardOf(page, { ...visit, searchKey });
      await expect(card).toContainText(patient.body.patientCode);
      const stored = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}`);
      expect(stored.body.patientId).toBe(patient.body.id);
      expect(stored.body.dentistId).toBe(dentist.id);
    } finally {
      if (visitId) await staffCall(page, `${APPOINTMENTS}/${visitId}`, { method: "DELETE", branchId });
      if (dentist) await deleteStaff(page, dentist.id);
    }
  });

  test("the board reads its counters from the server, not from the page", async ({ page }) => {
    const stats = statsResponse(page);
    await openBoard(page);
    const s = (await (await stats).json()) as Stats;

    const scheduled = (s.requested ?? 0) + (s.confirmed ?? 0);
    const arrived = (s.checkedIn ?? 0) + (s.inProgress ?? 0) + (s.completed ?? 0);
    await expect(tab(page, 0)).toHaveText(new RegExp(`\\(${scheduled + arrived + (s.cancelled ?? 0) + (s.noShow ?? 0)}\\)$`));
    await expect(tab(page, 1)).toHaveText(new RegExp(`\\(${scheduled + (s.checkedIn ?? 0)}\\)$`));
    await expect(tab(page, 2)).toHaveText(new RegExp(`\\(${s.inProgress ?? 0}\\)$`));
    await expect(tab(page, 3)).toHaveText(new RegExp(`\\(${s.completed ?? 0}\\)$`));
  });
});
