import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận offers as doctors only staff ticked "Bác sĩ" on the staff
 * form (owner, 2026-10-05). Before, the whole branch was offered — "Tạo tiếp
 * nhận" listed a Phụ tá / Y sĩ as Bác sĩ điều trị.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

interface Staff {
  id: string;
  fullName: string | null;
  userName: string;
  isDentist: boolean;
}

async function branchStaff(page: Page, branchId: string): Promise<Staff[]> {
  return page.evaluate(async (branch) => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const res = await fetch(
      `/api/v1/app/staff?MaxResultCount=1000&IsActive=true&BranchId=${branch}&AvailableOn=${day}`,
      { credentials: "include", headers: { "X-Clinic-Branch-Id": branch } },
    );
    return (await res.json()).items;
  }, branchId);
}

const nameOf = (s: Staff) => (s.fullName ?? "").trim() || s.userName;

/** The labels an AntD select offers once `term` is typed into it. */
async function antdOffers(page: Page, select: Locator, term: string): Promise<string[]> {
  await select.click();
  await page.keyboard.type(term);
  const dropdown = page.locator(".ant-select-dropdown:visible");
  await expect(dropdown.locator(".ant-select-item-option, .ant-select-item-empty").first()).toBeVisible();
  const labels = await dropdown.locator(".ant-select-item-option").allInnerTexts();
  await page.keyboard.press("Escape");
  return labels.map((l) => l.trim());
}

test.describe("Tiếp nhận — chỉ bác sĩ được tick mới là bác sĩ", () => {
  test("Tạo tiếp nhận and the board's Bác sĩ filter offer staff ticked Bác sĩ, nobody else", async ({ page }) => {
    await login(page);
    const branchId = await openBoard(page);
    const staff = await branchStaff(page, branchId);
    const dentist = staff.find((s) => s.isDentist);
    const notDentist = staff.find((s) => !s.isDentist);
    expect(dentist && notDentist, "the branch should have both a dentist and other staff on today").toBeTruthy();

    // Bác sĩ filter above the board.
    const filter = page.locator(".reception-doctor-filter .ss-wrapper");
    await filter.click();
    const filterOptions = page.locator(".ss-dropdown .ss-options");
    await expect(filterOptions).toBeVisible();
    const filterLabels = (await filterOptions.locator("> div").allInnerTexts()).map((l) => l.trim());
    expect(filterLabels).toContain(nameOf(dentist!));
    expect(filterLabels).not.toContain(nameOf(notDentist!));
    await page.keyboard.press("Escape");

    // Bác sĩ điều trị of Tạo tiếp nhận.
    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo tiếp nhận" });
    await expect(dialog).toBeVisible();
    const doctor = dialog.locator(".floating-field").filter({ hasText: "Bác sĩ điều trị" }).locator(".ant-select");

    expect(await antdOffers(page, doctor, nameOf(notDentist!))).not.toContain(nameOf(notDentist!));
    expect(await antdOffers(page, doctor, nameOf(dentist!))).toContain(nameOf(dentist!));
  });
});
