import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, freeSlot, login, runId } from "./fixtures/auth";
import { call, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-1141 (BA 2026-11-03): on Lịch hẹn, when the Bác sĩ filter holds exactly one
 * doctor, "Tạo lịch hẹn" and "Lịch tạm" open with Chọn bác sĩ already set to
 * that doctor. Two doctors in the filter (or none) leave it empty, as before.
 * Real stack: two throw-away dentists, the booking saved through the dialog
 * and read back after a reload; nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  dentistId: string;
  slotStart: string;
}

/** Adds `name` to the toolbar's Bác sĩ filter. */
async function filterDoctor(page: Page, name: string): Promise<void> {
  await page.locator(".cal-doctor-field .ant-select").click();
  await page.keyboard.type(name);
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: name }).click();
  await page.keyboard.press("Escape");
}

async function openCreate(page: Page) {
  await page.locator(".cal-toolbar-row2, .cal-page").getByRole("button", { name: /^Tạo lịch hẹn/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
  await expect(dialog).toBeVisible();
  return {
    dialog,
    doctorField: dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first(),
  };
}

test.describe("Lịch hẹn — lọc đúng 1 bác sĩ thì Tạo lịch hẹn điền sẵn bác sĩ đó", () => {
  let branchId: string;
  let first: RunStaff;
  let second: RunStaff;
  let firstName: string;
  let secondName: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const request = page.waitForRequest(
      (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
    );
    await page.goto("/calendar");
    branchId = (await request).headers()["x-clinic-branch-id"];

    const run = `${runId()}${test.info().workerIndex}`;
    firstName = `BSLocMot${run}`;
    secondName = `BSLocHai${run}`;
    first = await createRunStaff(page, branchId, `lf${run}`, { name: firstName, isDentist: true });
    second = await createRunStaff(page, branchId, `ls${run}`, { name: secondName, isDentist: true });

    // Reopened so the Bác sĩ filter lists the run's dentists.
    await page.goto("/calendar");
    await assertRealApiTraffic(page, APPOINTMENTS);
  });

  test.afterEach(async ({ page }) => {
    for (const s of [first, second]) {
      if (!s) continue;
      const res = await call<{ items: Booking[] }>(
        page, `${APPOINTMENTS}?DentistId=${s.id}&MaxResultCount=50`, { branchId },
      );
      for (const booking of res.body.items ?? []) {
        await call(page, `${APPOINTMENTS}/${booking.id}`, { method: "DELETE", branchId });
      }
      await deleteStaff(page, s.id);
    }
  });

  test("1 bác sĩ → điền sẵn, 2 bác sĩ → để trống; lưu và đọc lại đúng bác sĩ", async ({ page }) => {
    // No doctor in the filter: Chọn bác sĩ starts empty.
    let opened = await openCreate(page);
    await expect(opened.doctorField).not.toContainText(firstName);
    await opened.dialog.getByRole("button", { name: "Close" }).click();
    await expect(opened.dialog).toBeHidden();

    // Two doctors: still empty — the calendar cannot tell which one is meant.
    await filterDoctor(page, firstName);
    await filterDoctor(page, secondName);
    opened = await openCreate(page);
    await expect(opened.doctorField).not.toContainText(firstName);
    await expect(opened.doctorField).not.toContainText(secondName);
    await opened.dialog.getByRole("button", { name: "Close" }).click();
    await expect(opened.dialog).toBeHidden();

    // Back to one doctor: Chọn bác sĩ comes filled with that doctor.
    await page.locator(".cal-doctor-field .ant-select-selection-item").filter({ hasText: secondName })
      .locator(".ant-select-selection-item-remove").click();
    await page.keyboard.press("Escape");

    // Lịch tạm takes the same doctor.
    await page.locator(".cal-btn-temp").click();
    const temp = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    await expect(temp).toBeVisible();
    await expect(temp.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first()).toContainText(firstName);
    await temp.getByRole("button", { name: "Close" }).click();
    await expect(temp).toBeHidden();

    opened = await openCreate(page);
    const { dialog, doctorField } = opened;
    await expect(doctorField).toContainText(firstName);

    // The rest of the form, then Lưu — the doctor is the one saved.
    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    const slot = freeSlot(runId(), 0);
    const date = dialog.getByPlaceholder("Chọn thời điểm");
    await date.click({ position: { x: 4, y: 8 } });
    await date.pressSequentially(slot.day.replace(/\D/g, ""));
    await date.press("Enter");
    await expect(date).toHaveValue(slot.day);
    await expect(doctorField).toContainText(firstName);
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill(slot.time);
    await time.press("Enter");
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(`Lọc 1 bác sĩ ${runId()}`);

    const saved = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.reload();
    const res = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?DentistId=${first.id}&MaxResultCount=50`, { branchId },
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const [d, m, y] = slot.day.split("/");
    expect(new Date(res.body.items[0].slotStart).toISOString())
      .toBe(new Date(`${y}-${m}-${d}T${slot.time}:00+07:00`).toISOString());
  });
});
