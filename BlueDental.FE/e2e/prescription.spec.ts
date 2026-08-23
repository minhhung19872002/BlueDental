import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { pickOption, selectOption } from "./fixtures/antd";

/**
 * Feature: Đơn thuốc, plus the patient tabs that read other modules.
 *
 * The reference lists prescriptions with "Mã đơn thuốc, Bác sĩ, Chẩn đoán,
 * Tái khám, Ngày tạo"; the medicines are the slip's lines. A dispensed slip is
 * frozen.
 */
test.describe("Đơn thuốc", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /** Opens the newest patient — the list is sorted newest first. */
  async function openFirstPatient(page: Page): Promise<string> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator("tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    return page.url();
  }

  test("a prescription lists its medicines and freezes once dispensed", async ({ page }) => {
    const diagnosis = `Viêm lợi ${runId()}`;

    const profileUrl = await openFirstPatient(page);
    await page.getByRole("tab", { name: "Đơn thuốc" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/prescriptions");

    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    const dialog = page.getByRole("dialog");

    await selectOption(page, dialog, "Bác sĩ kê đơn", "admin");
    await dialog.getByLabel("Chẩn đoán", { exact: true }).fill(diagnosis);

    // One medicine line, from the Loại thuốc catalog. The line carries no label,
    // so it is reached by its test id.
    await pickOption(page, dialog.getByTestId("prescription-medicine").getByRole("combobox"));
    await dialog.getByPlaceholder("Liều dùng").fill("1 viên");
    await dialog.getByPlaceholder("Tần suất").fill("2 lần/ngày");

    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(diagnosis) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Chưa phát");
    // The medicine name is snapshotted onto the line, so it shows in the list.
    await expect(row).toContainText("×");

    await row.getByRole("button", { name: "Phát thuốc" }).click();
    await expect(row).toContainText("Đã phát");
    await expect(row.getByRole("button", { name: "Phát thuốc" })).toHaveCount(0);

    // It survives a reload, so it really reached PostgreSQL.
    await page.goto(`${profileUrl}?tab=prescription`);
    await expect(page.getByRole("row", { name: new RegExp(diagnosis) })).toContainText("Đã phát");
  });

  test("a prescription needs at least one medicine", async ({ page }) => {
    await openFirstPatient(page);
    await page.getByRole("tab", { name: "Đơn thuốc" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/prescriptions");

    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    const dialog = page.getByRole("dialog");

    await selectOption(page, dialog, "Bác sĩ kê đơn", "admin");
    await dialog.getByRole("button", { name: "Tạo" }).click();

    // The empty medicine line fails validation, so the dialog stays open.
    await expect(dialog.locator(".ant-form-item-explain-error")).toContainText("Chọn thuốc");
    await expect(dialog).toBeVisible();
  });

  test("the patient tabs read the real modules", async ({ page }) => {
    await openFirstPatient(page);

    await page.getByRole("tab", { name: "Lịch hẹn" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/appointments");
    await expect(page.getByTestId("patient-appointment-counters")).toBeVisible();

    await page.getByRole("tab", { name: "Labo" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    await page.getByRole("tab", { name: "Chăm sóc KH" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/care-records");
  });
});
