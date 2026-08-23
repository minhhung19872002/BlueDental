import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Voucher khuyến mãi.
 *
 * A voucher is only usable once activated, and it locks itself down after its
 * first redemption — both are server rules, so this drives the real API.
 */
test.describe("Voucher", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a draft voucher, activates it, and pauses it again", async ({ page }) => {
    const id = runId();
    const code = `E2E${id}`;
    const name = `Khuyến mãi E2E ${id}`;

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã voucher").fill(code);
    await dialog.getByLabel("Tên chương trình").fill(name);
    await dialog.getByLabel("Mức giảm (%)").fill("10");
    await dialog.getByRole("button", { name: "Tạo" }).click();

    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toBeVisible();

    // A new voucher starts as a draft — it must not be usable yet.
    await expect(row).toContainText("Nháp");
    await expect(row).toContainText("10%");
    await expect(row).toContainText("0 / ∞");

    await row.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(row).toContainText("Đang hoạt động");

    await row.getByRole("button", { name: "Tạm dừng" }).click();
    await expect(row).toContainText("Tạm dừng");

    // Server state, not component state.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("Tạm dừng");
  });

  test("counts an active voucher in the stats bar", async ({ page }) => {
    const id = runId();
    const code = `E2S${id}`;

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers/stats");

    // The stat labels also appear as status tags in the table, so read the tiles
    // by their test id instead of by text.
    const readStat = async (testId: string) => {
      const text = await page.getByTestId(testId).innerText();
      return Number(text.replace(/[^\d]/g, "") || 0);
    };

    const totalBefore = await readStat("voucher-stat-total");
    const activeBefore = await readStat("voucher-stat-active");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã voucher").fill(code);
    await dialog.getByLabel("Tên chương trình").fill(`Stats ${id}`);
    await dialog.getByLabel("Mức giảm (%)").fill("5");
    await dialog.getByRole("button", { name: "Tạo" }).click();

    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toBeVisible();
    await expect.poll(() => readStat("voucher-stat-total")).toBe(totalBefore + 1);

    // A draft is not "đang hoạt động" until it is activated.
    expect(await readStat("voucher-stat-active")).toBe(activeBefore);

    await row.getByRole("button", { name: "Kích hoạt" }).click();
    await expect.poll(() => readStat("voucher-stat-active")).toBe(activeBefore + 1);
  });

  test("rejects a percentage above 100", async ({ page }) => {
    await page.goto("/voucher");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Mã voucher").fill(`BAD${runId()}`);
    await dialog.getByLabel("Tên chương trình").fill("Quá tay");
    await dialog.getByLabel("Mức giảm (%)").fill("150");
    await dialog.getByRole("button", { name: "Tạo" }).click();

    await expect(dialog.getByText("Phần trăm tối đa là 100")).toBeVisible();
  });
});
