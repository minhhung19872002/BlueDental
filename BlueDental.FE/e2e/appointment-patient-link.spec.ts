import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: Lịch hẹn — the patient's name on a week-view card opens the record
 * on "Chẩn đoán & Tư vấn" for an account ticked "Bác sĩ", "Phụ tá" or "Y sĩ"
 * on the staff form, and on "Hồ sơ" otherwise (BA 2026-10-05, same rule as
 * Tiếp nhận).
 */

/** Seeded staff with the "Phụ tá" tick, and one with no tick; both may book. */
const CASES = [
  { who: "Phụ tá", user: { userName: "pt.linh", password: "Staff@123456" }, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "no tick", user: { userName: "lt.huong", password: "Staff@123456" }, tab: "profile", label: "Hồ sơ" },
] as const;

test.describe("Lịch hẹn — mở hồ sơ bệnh nhân", () => {
  CASES.forEach(({ who, user, tab, label }, i) => {
    test(`${who}: the patient's name on a week card opens the ${label} tab`, async ({ page }) => {
      await login(page, user);
      const branchId = await openBoard(page);
      const visit = await bookVisitToday(page, branchId, 45 + i, "e2e-lich");

      await page.goto("/calendar");
      const week = page.waitForResponse(
        (r) => r.url().includes(APPOINTMENTS) && r.url().includes("fromDate=") && r.ok(),
      );
      await page.getByText("Tuần", { exact: true }).first().click();
      await week;

      const card = page.locator(".evt-card").filter({ hasText: visit.searchKey });
      await expect(card).toHaveCount(1);
      // Earlier runs stack cards in the same slot over this one, so the link is
      // opened from the keyboard, which the card supports, not by a pointer.
      await card.locator(".evt-card-title").press("Enter");

      await expect(page).toHaveURL(new RegExp(`/patient/${visit.patientId}\\?tab=${tab}$`));
      await expect(page.locator(".pill-tab--active")).toHaveText(label);
    });
  });
});
