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

    await dialog.getByPlaceholder("Nguyễn Văn A").fill(fullName);
    await dialog.getByPlaceholder("09xxxxxxxx").fill("0900000002");

    const dob = dialog.locator(".ant-picker-input input").first();
    await dob.click();
    await dob.pressSequentially("15/06/1990", { delay: 20 });
    await dialog.getByPlaceholder("09xxxxxxxx").click();

    await dialog.getByRole("button", { name: /Lưu/ }).click();

    const row = page.getByRole("row", { name: new RegExp(fullName) });
    await expect(row).toBeVisible();

    // Survives a reload — i.e. it really reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(fullName) })).toBeVisible();

    await page.getByRole("row", { name: new RegExp(fullName) }).click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    // The profile repeats the name (breadcrumb, header, visit rows) — assert
    // the header specifically, which is unique.
    await expect(page.locator(".pt-head-name")).toHaveText(fullName);
  });

  test("records tooth surfaces on the consulting chart", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator("tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    // Initially no teeth selected.
    await expect(page.getByText("Chưa chọn răng")).toBeVisible();

    // Click tooth 11 via its aria-label (SVG <g role="button" aria-label="Răng 11 — …">).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText(/Đã chọn:.*11/)).toBeVisible();

    // Click tooth 11 again to deselect (toggle).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText("Chưa chọn răng")).toBeVisible();
  });
});
