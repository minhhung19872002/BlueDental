import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: tìm bệnh nhân không dấu (R-1035, owner 2026-10-26: "cho phép kiếm
 * k dấu luôn nha"). "Ha My" in the header search (Ctrl+K) finds "Hà My", the
 * same way the patient list's own search box does — both read
 * `GET /patients?Filter=`.
 *
 * The patient is created and searched through the real API from inside the
 * page logged in through the login screen; the palette is then driven as a
 * user would. Nothing is intercepted. Every term carries the run's own token,
 * so the seed's other "Hà My" never crowd the hit out of the first page.
 */

const PATIENTS = "/api/v1/app/patients";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

interface Patient {
  id: string;
  fullName: string;
}

test.describe.serial("Tìm bệnh nhân không dấu", () => {
  const run = runId();
  const token = `e2e${run}`;
  let patient: Patient;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/patient?branch=BD-001`);
  });

  test.afterAll(async ({ browser }) => {
    if (!patient) return;
    const page = await browser.newPage();
    await login(page);
    await call(page, `${PATIENTS}/${patient.id}/deactivate`, { method: "POST", branchId: BRANCH_ONE });
    await page.close();
  });

  test("the name matches with or without marks; đ = d", async ({ page }) => {
    const created = await call<Patient>(page, PATIENTS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        lastName: `Nguyễn Đức E2E${run}`,
        firstName: "Hà My",
        gender: 2,
        phoneNumber: `09${run}35`,
        dateOfBirth: "1990-05-01",
      },
    });
    expect(created.status, JSON.stringify(created.body.error)).toBe(200);
    patient = created.body;

    const found = async (filter: string) => {
      const res = await call<{ items: Patient[] }>(
        page,
        `${PATIENTS}?Filter=${encodeURIComponent(filter)}&MaxResultCount=20`,
        { branchId: BRANCH_ONE },
      );
      expect(res.status, `search "${filter}"`).toBe(200);
      return res.body.items.some((p) => p.id === patient.id);
    };

    expect(await found(`${token} Ha My`), "accentless").toBe(true);
    expect(await found(`${token} hà my`), "with marks, lower case").toBe(true);
    expect(await found(`${token} NGUYEN DUC`), "Đ typed as D, upper case").toBe(true);
    expect(await found(`${token} nguyễn ha`), "marks on one word only").toBe(true);
    expect(await found(`${token} Ha Mi`), "a different name").toBe(false);
    expect(await found(`09${run}35`), "the phone still finds it").toBe(true);
  });

  test("the header search finds it typed without marks and opens the record", async ({ page }) => {
    await page.locator(".app-header-search").click();
    await page.locator(".app-search-field").fill(`ha my ${token}`);

    const hit = page.locator(".app-search-hit").filter({ hasText: `E2E${run}` });
    await expect(hit).toHaveCount(1, { timeout: 15_000 });
    await expect(hit).toContainText("Hà My");
    await hit.click();

    await expect(page).toHaveURL(new RegExp(`/patient/${patient.id}`));
  });
});
