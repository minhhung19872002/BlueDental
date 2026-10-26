import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  APPOINTMENTS,
  bookVisitToday,
  call,
  cardOf,
  openBoard,
  type Appointment,
} from "./fixtures/receptionBoard";
import { call as staffCall, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Tiếp nhận — Ghi chú (R-1037, R-1038).
 *
 * - "Tạo tiếp nhận" has the booking dialog's Ghi chú card on its right: the
 *   note is saved as the appointment's `notes`, apart from Nội dung đặt lịch
 *   (`chiefComplaint`), and the card shows it beside 📄.
 * - Hoàn tất on the board keeps that note; it used to send `notes: null`,
 *   which wiped it.
 *
 * Real stack: the dialog is filled and saved in the browser, nothing is
 * intercepted, the result is re-read after a reload and from the API.
 */

type StoredVisit = Appointment & { notes: string | null; chiefComplaint: string | null };

/** Picks the option of an AntD Select whose label contains `text`, searching for it first. */
async function pick(page: Page, select: Locator, text: string): Promise<void> {
  await select.click();
  await select.locator("input").fill(text);
  const option = page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: text });
  await expect(option.first()).toBeVisible({ timeout: 15_000 });
  await option.first().click();
}

async function stored(page: Page, branchId: string, id: string): Promise<StoredVisit> {
  const res = await call<StoredVisit>(page, branchId, `${APPOINTMENTS}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

test.describe("Tiếp nhận — Ghi chú", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Tạo tiếp nhận saves Ghi chú apart from Nội dung đặt lịch and the card shows it", async ({ page }) => {
    test.setTimeout(90_000);
    const branchId = await openBoard(page);
    const run = `${runId()}${test.info().workerIndex}`;
    const searchKey = `e2e-ghichu-${run}`;
    const note = `Ghi chú tiếp nhận ${run}`;

    const start = new Date();
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 40 * 60_000);
    test.skip(end.getDate() !== start.getDate(), "too close to midnight to receive a patient for today");

    const doctorName = `BSGhiChu${run}`;
    let dentist: RunStaff | undefined;
    let visitId: string | undefined;
    try {
      dentist = await createRunStaff(page, branchId, `rgc${run}`, { name: doctorName, isDentist: true });
      expect(await openShiftCovering(page, branchId, dentist.id, start, end), "the run's dentist should be on shift now").toBe(true);
      const suffix = run.slice(-8).padStart(8, "0");
      const patient = await call<{ id: string; patientCode: string }>(page, branchId, "/api/v1/app/patients", {
        method: "POST",
        json: { firstName: `Ghi chú ${suffix}`, lastName: "E2E", gender: "male", phoneNumber: `07${suffix}` },
      });
      expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
      await page.reload();

      await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const selects = dialog.locator(".ant-select");
      await pick(page, selects.nth(0), patient.body.patientCode);
      await pick(page, selects.nth(1), doctorName);
      await dialog.locator(".rn-form textarea").fill(searchKey);

      // The Ghi chú card starts empty; ✕ drops a draft, ✓ keeps it.
      const panel = dialog.locator(".notes-panel");
      await expect(panel).toContainText("Chưa có ghi chú");
      await panel.getByRole("button", { name: "Thêm ngay" }).click();
      await panel.locator("textarea").fill("bản nháp bỏ đi");
      await panel.getByRole("button", { name: "Hủy" }).click();
      await expect(panel).toContainText("Chưa có ghi chú");
      await panel.getByRole("button", { name: "Thêm ngay" }).click();
      await panel.locator("textarea").fill(note);
      await panel.getByRole("button", { name: "Xác nhận" }).click();
      await expect(panel.locator(".notes-panel-content")).toHaveText(note);

      // The server refuses a slot before the current minute; book a few minutes ahead.
      const ahead = new Date(Date.now() + 3 * 60_000);
      if (ahead.getHours() <= 19 && ahead.getDate() === start.getDate()) {
        const hhmm = `${String(ahead.getHours()).padStart(2, "0")}:${String(ahead.getMinutes()).padStart(2, "0")}`;
        const time = dialog.locator(".ant-picker input").nth(1);
        await time.fill(hhmm);
        await time.press("Enter");
        await expect(time).toHaveValue(hhmm);
      }

      const created = page.waitForResponse((r) => r.url().endsWith(APPOINTMENTS) && r.request().method() === "POST");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      const response = await created;
      expect(response.status(), await response.text()).toBe(200);
      const visit = (await response.json()) as StoredVisit;
      visitId = visit.id;
      await expect(dialog).toBeHidden();

      // Two fields, two columns: neither overwrites the other.
      const saved = await stored(page, branchId, visit.id);
      expect(saved.chiefComplaint).toBe(searchKey);
      expect(saved.notes).toBe(note);

      await page.reload();
      const card = await cardOf(page, { ...visit, searchKey });
      await expect(card.locator(".rc-detail-notes")).toHaveText(note);
    } finally {
      if (visitId) await staffCall(page, `${APPOINTMENTS}/${visitId}`, { method: "DELETE", branchId });
      if (dentist) await deleteStaff(page, dentist.id);
    }
  });

  test("Hoàn tất on the board keeps the Ghi chú", async ({ page }) => {
    const branchId = await openBoard(page);
    const note = `Ghi chú giữ lại ${runId()}`;
    const visit = await bookVisitToday(page, branchId, 30, "e2e-ghichu-xong", note);
    const card = await cardOf(page, visit);
    await expect(card.locator(".rc-detail-notes")).toHaveText(note);

    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(card.getByRole("button", { name: /Đang khám/ })).toBeEnabled();
    await card.getByRole("button", { name: /Đang khám/ }).click();
    await expect(card.getByRole("button", { name: /Hoàn tất/ })).toBeEnabled();
    await card.getByRole("button", { name: /Hoàn tất/ }).click();
    await expect.poll(async () => (await stored(page, branchId, visit.id)).status).toBe(5);

    expect((await stored(page, branchId, visit.id)).notes).toBe(note);
    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(reloaded.locator(".rc-detail-notes")).toHaveText(note);
  });
});
