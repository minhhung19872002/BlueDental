import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, openBoard, type Appointment } from "./fixtures/receptionBoard";

/**
 * Feature: patient record — "Quay lại" goes back to the screen the record was
 * opened from (owner 2026-10-08): Tiếp nhận, Lịch hẹn, the patient list… even
 * after moving between the record's tabs or reloading. A record opened from a
 * bare link, with nowhere to go back to, still falls back to the patient list.
 */

const goBack = (page: Page) => page.locator(".pd-breadcrumb").getByRole("button", { name: "Quay lại" });

const patientIdInUrl = (page: Page) => /\/patient\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";

/** Moves to another of the record's tabs, then reloads, before going back. */
async function wanderInsideRecord(page: Page, patientId: string): Promise<void> {
  await page.locator(".pd-tabrow .pill-tab").filter({ hasText: "Lịch hẹn" }).click();
  await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=appointment`));
  await page.reload();
  await expect(goBack(page)).toBeVisible();
}

async function cancelVisit(page: Page, branchId: string, visit: Appointment): Promise<void> {
  await call(page, branchId, `${APPOINTMENTS}/${visit.id}/cancel`, { method: "POST", json: { reason: 1, note: "e2e cleanup" } });
}

test.describe("Hồ sơ bệnh nhân — Quay lại về nơi xuất phát", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opened from a Tiếp nhận card, it goes back to Tiếp nhận", async ({ page }) => {
    test.setTimeout(90_000);
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 50, "e2e-back");
    try {
      await page.reload();
      const card = await cardOf(page, visit);
      await card.locator(".rc-patient-name--link").click();
      await expect(page).toHaveURL(new RegExp(`/patient/${visit.patientId}`));

      await wanderInsideRecord(page, visit.patientId);
      await goBack(page).click();

      await expect(page).toHaveURL(/\/reception/);
      await expect(page.getByPlaceholder("Tìm bệnh nhân...").first()).toBeVisible();
    } finally {
      await cancelVisit(page, branchId, visit);
    }
  });

  test("opened from the header search on Lịch hẹn, it goes back to Lịch hẹn", async ({ page }) => {
    const branchId = await openBoard(page);
    const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
      page, branchId, `/api/v1/app/patients?MaxResultCount=20&ClinicBranchId=${branchId}`,
    );
    const patient = patients.body.items.find((p) => p.patientCode);
    expect(patient, "the branch should have a patient with a code").toBeTruthy();
    if (!patient?.patientCode) return;

    await page.goto("/calendar");
    await page.locator(".app-header-search").click();
    await page.locator(".app-search-field").fill(patient.patientCode);
    const hit = page.locator(".app-search-hit").filter({ hasText: patient.patientCode });
    await expect(hit.first()).toBeVisible({ timeout: 15_000 });
    await hit.first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await wanderInsideRecord(page, patientIdInUrl(page));
    await goBack(page).click();

    await expect(page).toHaveURL(/\/calendar/);
  });

  test("opened from the patient list, it goes back to the list", async ({ page }) => {
    await page.goto("/patient");
    const name = page.locator(".bd-patient-name").first();
    await expect(name).toBeVisible({ timeout: 15_000 });
    await name.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await wanderInsideRecord(page, patientIdInUrl(page));
    await goBack(page).click();

    await expect(page).toHaveURL(/\/patient(\?|$)/);
    await expect(page.locator(".bd-patient-name").first()).toBeVisible();
  });

  test("opened from a bare link, it falls back to the patient list", async ({ page }) => {
    await page.goto("/patient");
    const href = await page.locator(".bd-patient-name").first().getAttribute("href");
    expect(href).toBeTruthy();

    // A new tab of its own: nothing remembered, no screen before it.
    const fresh = await page.context().newPage();
    await fresh.goto(href ?? "");
    await expect(goBack(fresh)).toBeVisible({ timeout: 15_000 });
    await goBack(fresh).click();

    await expect(fresh).toHaveURL(/\/patient(\?|$)/);
  });
});
