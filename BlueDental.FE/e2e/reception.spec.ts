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

    const waitingBefore = await readCounter(page, "waiting");

    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();

    const drawer = page.getByRole("dialog");

    // Pick a real patient and a real dentist — both lists come from the API.
    // SearchSelect is BlueDental's own component, so it is driven by its roles.
    await drawer.getByTestId("reception-patient").getByRole("combobox").click();
    await page.getByRole("option").first().click();

    await drawer.getByTestId("reception-doctor").getByRole("combobox").click();
    await page.getByRole("option").first().click();
    await drawer.getByRole("button", { name: "Lưu" }).click();
    await expect(drawer).toBeHidden();

    // The counter is computed by the server over the whole branch.
    await expect.poll(() => readCounter(page, "waiting")).toBe(waitingBefore + 1);

    // It survives a reload, so the visit really reached PostgreSQL.
    await page.reload();
    await expect.poll(() => readCounter(page, "waiting")).toBe(waitingBefore + 1);
  });

  test("the board reads its counters from the server, not from the page", async ({ page }) => {
    await page.goto("/reception");
    await assertRealApiTraffic(page, "/api/v1/app/visits/stats");

    // Every counter is a number the server computed over the whole branch.
    await expect(page.getByTestId("reception-metric-waiting")).toBeVisible();
    await expect(page.getByTestId("reception-metric-in-progress")).toBeVisible();
    await expect(page.getByTestId("reception-metric-completed")).toBeVisible();
  });
});
