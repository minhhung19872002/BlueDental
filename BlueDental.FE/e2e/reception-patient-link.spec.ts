import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { bookVisitToday, cardOf, openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — the patient's name on a reception card opens the record
 * on "Chẩn đoán & Tư vấn" for an account ticked "Bác sĩ", "Phụ tá" or "Y sĩ"
 * on the staff form, and on "Hồ sơ" otherwise (owner, 2026-10-05; same rule as
 * Lịch hẹn, appointment-patient-link.spec.ts).
 *
 * Real stack: real login per seeded account, real board, nothing intercepted.
 */

const CASES = [
  { who: "Bác sĩ", user: { userName: "bs.long", password: "Staff@123456" }, dentist: true, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "Phụ tá", user: { userName: "pt.linh", password: "Staff@123456" }, dentist: false, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "Y sĩ", user: { userName: "ys.trang", password: "Staff@123456" }, dentist: false, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "no tick", user: { userName: "lt.huong", password: "Staff@123456" }, dentist: false, tab: "profile", label: "Hồ sơ" },
] as const;

/**
 * A dentist's board starts filtered to their own patients — set once the
 * doctor list arrives, so it is waited for — and is cleared to show everyone.
 */
async function showEveryDoctor(page: Page): Promise<void> {
  const filter = page.locator(".reception-doctor-filter");
  await expect(filter.locator(".ss-value--selected")).toBeVisible();
  // The unfiltered list may already be cached from before the default landed,
  // so there is no request to wait for — only the cleared field.
  await filter.locator(".ss-icon--clear").dispatchEvent("mousedown");
  await expect(filter.locator(".ss-value--placeholder")).toBeVisible();
}

test.describe("Tiếp nhận — mở hồ sơ bệnh nhân", () => {
  CASES.forEach(({ who, user, dentist, tab, label }, i) => {
    test(`${who}: the patient's name on a reception card opens the ${label} tab`, async ({ page }) => {
      await login(page, user);
      const branchId = await openBoard(page);
      const visit = await bookVisitToday(page, branchId, 70 + i, "e2e-tn-link");

      await page.reload();
      if (dentist) await showEveryDoctor(page);
      const card = await cardOf(page, visit);
      await card.locator(".rc-patient-name--link").click();

      await expect(page).toHaveURL(new RegExp(`/patient/${visit.patientId}\\?tab=${tab}$`));
      await expect(page.locator(".pill-tab--active")).toHaveText(label);
    });
  });
});
