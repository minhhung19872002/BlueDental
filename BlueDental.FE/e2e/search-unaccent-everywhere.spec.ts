import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { createRunStaff, deleteStaff, call as staffCall, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: tìm kiếm không dấu ở mọi ô tìm (R-1051, owner 2026-10-27: "mấy cái
 * tìm kiếm cho phép không dấu hết nha" — "áp dụng tất cả luôn"). The report:
 * "van dinh" in Tiếp nhận found nothing for a patient named "Văn Định".
 *
 * A patient "Văn Định E2E…" and a dentist "… Định…" of this run are created
 * and booked for today through the real API, then searched without marks:
 * the appointment list (the board's search), the staff list, the board itself,
 * and the Tạo tiếp nhận doctor dropdown (filtered in the browser). Nothing is
 * intercepted.
 */

const PATIENTS = "/api/v1/app/patients";

test.describe.serial("Tìm kiếm không dấu", () => {
  const run = runId();
  const token = `e2e${run}`;
  let branchId: string;
  let dentist: RunStaff | undefined;
  let patientId: string | undefined;
  let visit: Appointment | undefined;

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await openBoard(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (visit) await staffCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
    if (patientId) await call(page, branchId, `${PATIENTS}/${patientId}/deactivate`, { method: "POST" });
    if (dentist) await deleteStaff(page, dentist.id);
    await page.close();
  });

  test("the API matches names typed without marks; đ = d", async ({ page }) => {
    const start = new Date(Date.now() + 150 * 60_000);
    start.setSeconds(0, 0);
    test.skip(dayOf(start) !== dayOf(new Date()), "too close to midnight to book a visit for today");
    const end = new Date(start.getTime() + 15 * 60_000);

    dentist = await createRunStaff(page, branchId, `kd${run}`, { name: `Định${run}`, isDentist: true });
    const patient = await call<{ id: string }>(page, branchId, PATIENTS, {
      method: "POST",
      json: { lastName: "Văn", firstName: `Định ${token}`, gender: 1, phoneNumber: `08${run}50` },
    });
    expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
    patientId = patient.body.id;

    expect(await openShiftCovering(page, branchId, dentist.id, start, end), "the run's dentist on shift").toBe(true);
    const booked = await call<Appointment>(page, branchId, APPOINTMENTS, {
      method: "POST",
      json: {
        patientId, dentistId: dentist.id, branchId, type: 2,
        slotStart: start.toISOString(), slotEnd: end.toISOString(), chiefComplaint: `Khám ${token}`,
      },
    });
    expect(booked.status, JSON.stringify(booked.body.error)).toBe(200);
    visit = booked.body;

    const today = dayOf(new Date());
    const visitFound = async (filter: string) => {
      const res = await call<{ items: Appointment[] }>(
        page, branchId, `${APPOINTMENTS}?fromDate=${today}&toDate=${today}&filter=${encodeURIComponent(filter)}`,
      );
      expect(res.status, `appointments "${filter}"`).toBe(200);
      return res.body.items.some((a) => a.id === visit?.id);
    };
    expect(await visitFound(`van dinh ${token}`), "the patient's full name, no marks").toBe(true);
    expect(await visitFound(`VĂN ĐỊNH ${token}`), "with marks, upper case").toBe(true);
    expect(await visitFound(`dinh${run}`), "the dentist's name, no marks").toBe(true);
    expect(await visitFound(`van dung ${token}`), "a different name").toBe(false);

    const staffFound = async (filter: string) => {
      const res = await call<{ items: { id: string }[] }>(
        page, branchId, `/api/v1/app/staff?Filter=${encodeURIComponent(filter)}&MaxResultCount=50`,
      );
      expect(res.status, `staff "${filter}"`).toBe(200);
      return res.body.items.some((s) => s.id === dentist?.id);
    };
    expect(await staffFound(`dinh${run}`), "staff list, no marks").toBe(true);
    expect(await staffFound(`DINH${run}`), "staff list, upper case").toBe(true);
  });

  test("the Tiếp nhận board finds the visit typed without marks", async ({ page }) => {
    test.skip(!visit, "no visit was booked");
    const searched = page.waitForResponse(
      (r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.url().includes(token) && r.ok(),
    );
    await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(`van dinh ${token}`);
    await searched;
    const cards = page.locator(".rc-wrapper");
    await expect(cards).toHaveCount(1, { timeout: 15_000 });
    await expect(cards.first()).toContainText("Văn Định");
  });

  test("the Tạo tiếp nhận doctor dropdown finds the dentist typed without marks", async ({ page }) => {
    test.skip(!dentist, "no dentist was created");
    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const doctor = dialog.getByRole("combobox").nth(1);
    const option = page.locator(".ant-select-item-option", { hasText: `Định${run}` });
    await doctor.click();
    await doctor.fill(`dinh${run}`);
    await expect(option).toHaveCount(1);
    await doctor.fill(`ĐỊNH${run}`);
    await expect(option).toHaveCount(1);
    await doctor.fill(`dung${run}`);
    await expect(option).toHaveCount(0);
  });
});
