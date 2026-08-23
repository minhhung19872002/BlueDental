import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân + Chẩn đoán & Tư vấn.
 */
test.describe("Bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("registers a patient that persists and opens their record", async ({ page }) => {
    const id = runId();
    const fullName = `NGUYỄN E2E ${id}`;

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.getByRole("button", { name: /Tạo hồ sơ/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByPlaceholder("Nguyễn Văn An").fill(fullName);
    await dialog.getByPlaceholder("09xxxxxxxx").fill("0900000002");

    // antd's DatePicker only commits a typed value on Enter.
    const dob = dialog.getByPlaceholder("Chọn thời điểm");
    await dob.fill("15/06/1990");
    await dob.press("Enter");

    await dialog.getByRole("button", { name: /Lưu/ }).click();

    const row = page.getByRole("row", { name: new RegExp(fullName) });
    await expect(row).toBeVisible();

    // Survives a reload — i.e. it really reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(fullName) })).toBeVisible();

    await page.getByRole("row", { name: new RegExp(fullName) }).click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    await expect(page.getByText(fullName)).toBeVisible();
  });

  test("records tooth surfaces on the consulting chart", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator("tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    // Whole-tooth selection via the tooth number.
    await page.getByRole("button", { name: "11", exact: true }).click();
    await expect(page.getByText(/Đã chọn:.*11/)).toBeVisible();

    // Whole-jaw shortcut, then clear.
    await page.getByRole("button", { name: "Hàm Trên" }).click();
    await expect(page.getByText(/Đã chọn:.*18/)).toBeVisible();

    await page.getByRole("button", { name: "Bỏ chọn" }).click();
    await expect(page.getByText("Đã chọn: Chưa chọn răng")).toBeVisible();
  });
});
