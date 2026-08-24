import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Tiếp nhận + Lịch hẹn.
 *
 * The reception board used to fall back to a local store, so it looked like it
 * worked while nothing was persisted. These tests only pass if the data really
 * round-trips through the API and PostgreSQL.
 */
test.describe("Tiếp nhận", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const readCounter = async (
    page: import("@playwright/test").Page,
    label: string,
  ): Promise<number> => {
    const text = await page.getByTestId(`reception-metric-${label}`).innerText();
    return Number(text.replace(/[^\d]/g, "") || 0);
  };

  test("receiving a patient stores a real visit and moves the counters", async ({ page }) => {
    await page.goto("/reception");
    await assertRealApiTraffic(page, "/api/v1/app/visits");

    const waitingBefore = await readCounter(page, "WaitingForExam");

    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Patient select — SearchSelect with placeholder "Tìm kiếm khách hàng"
    const patientCombo = dialog.getByRole("combobox").first();
    await patientCombo.click();
    // Wait for dropdown to appear with options
    await expect(page.getByRole("option").first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("option").first().click();

    // Doctor select — second SearchSelect with placeholder "Chọn bác sĩ"
    const doctorCombo = dialog.getByRole("combobox").nth(1);
    await doctorCombo.click();
    await expect(page.getByRole("option").first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("option").first().click();

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    await expect.poll(() => readCounter(page, "WaitingForExam")).toBe(waitingBefore + 1);

    await page.reload();
    await expect.poll(() => readCounter(page, "WaitingForExam")).toBe(waitingBefore + 1);
  });

  test("the board reads its counters from the server, not from the page", async ({ page }) => {
    await page.goto("/reception");
    await assertRealApiTraffic(page, "/api/v1/app/visits");

    await expect(page.getByTestId("reception-metric-WaitingForExam")).toBeVisible();
    await expect(page.getByTestId("reception-metric-InProgress")).toBeVisible();
    await expect(page.getByTestId("reception-metric-Completed")).toBeVisible();
  });
});
