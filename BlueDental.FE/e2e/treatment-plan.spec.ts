import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { selectOption } from "./fixtures/antd";

/**
 * Feature: Kế hoạch điều trị + Hóa đơn.
 *
 * The rules worth protecting are the money ones, and every figure is derived on
 * the server: what the slip is worth, what has actually been collected, what is
 * still owed, and what the clinic is holding for the patient.
 */
test.describe("Kế hoạch điều trị", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });


  /** Registers a fresh patient so each run owns its own money. */
  async function createPatient(page: Page): Promise<string> {
    const fullName = `TRAN KEHOACH ${runId()}`;

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.getByRole("button", { name: /Tạo hồ sơ/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Nguyễn Văn An").fill(fullName);
    await dialog.getByPlaceholder("09xxxxxxxx").fill("0900000003");

    const dob = dialog.getByPlaceholder("Chọn thời điểm");
    await dob.fill("20/03/1992");
    await dob.press("Enter");
    await dialog.getByRole("button", { name: /Lưu/ }).click();

    // The list grows across runs, so find the new record instead of assuming page 1.
    await page.getByPlaceholder("Tìm kiếm").fill(fullName);
    await page.getByRole("row", { name: new RegExp(fullName) }).click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    return page.url();
  }

  /** Diagnosis → advise at a known price → accept. */
  async function acceptServiceAt(page: Page, price: string): Promise<void> {
    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    await page.getByRole("button", { name: "11", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phiếu chẩn đoán" }).click();

    const diagnosisDialog = page.getByRole("dialog");
    await selectOption(page, diagnosisDialog, "Chẩn đoán");
    await selectOption(page, diagnosisDialog, "Bác sĩ chẩn đoán");
    await diagnosisDialog.getByRole("button", { name: "Tạo" }).click();
    await expect(diagnosisDialog).toBeHidden();

    await page.getByRole("button", { name: "Tạo Dịch Vụ" }).first().click();
    const adviseDialog = page.getByRole("dialog");
    await selectOption(page, adviseDialog, "Dịch vụ");
    await adviseDialog.getByLabel("Đơn giá (đ)", { exact: true }).fill(price);
    await selectOption(page, adviseDialog, "Bác sĩ tư vấn");
    await adviseDialog.getByRole("button", { name: "Tạo" }).click();
    await expect(adviseDialog).toBeHidden();

    await page.getByRole("button", { name: "Chấp nhận" }).first().click();
    await expect(page.getByText("Đã chốt").first()).toBeVisible();
  }

  const money = async (page: Page, testId: string) => {
    const text = await page.getByTestId(testId).innerText();
    return Number(text.replace(/[^\d]/g, "") || 0);
  };

  test("an accepted consulting line becomes a priced service line on a slip", async ({ page }) => {
    await createPatient(page);
    await acceptServiceAt(page, "2000000");

    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-treatments");

    // Nothing planned yet.
    await expect(page.getByText("Chưa có kế hoạch điều trị")).toBeVisible();

    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();

    const row = page.getByRole("row", { name: /DT01/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("2.000.000 đ");
    await expect(row).toContainText("Chưa điều trị");

    // The consulting line is spent — it cannot be planned twice.
    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();
    await expect(page.getByText("Đã lên KHĐT").first()).toBeVisible();
  });

  test("only finished work becomes Phải thu, and paying clears it", async ({ page }) => {
    const profileUrl = await createPatient(page);
    await acceptServiceAt(page, "2000000");

    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-treatments");
    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    await expect(page.getByRole("row", { name: /DT01/ })).toBeVisible();

    // Nothing delivered yet, so nothing is collectable even though the slip is worth 2M.
    await page.getByRole("tab", { name: "Hóa đơn" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-payments/account");

    expect(await money(page, "acc-total")).toBe(2_000_000);
    expect(await money(page, "acc-debt")).toBe(0);

    // Finish the service — now the clinic may collect for it.
    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();
    await page.getByRole("row", { name: /DT01/ }).getByRole("button", { name: "Hoàn thành" }).click();
    await expect(page.getByRole("row", { name: /DT01/ })).toContainText("Hoàn thành");

    await page.getByRole("tab", { name: "Hóa đơn" }).click();
    await expect.poll(() => money(page, "acc-debt")).toBe(2_000_000);

    // Collect half of it.
    await page.getByRole("button", { name: "Ghi nhận thanh toán" }).click();
    const dialog = page.getByRole("dialog");
    await selectOption(page, dialog, "Kế hoạch điều trị", "DT01");
    await dialog.getByLabel("Số tiền (đ)", { exact: true }).fill("1000000");
    await selectOption(page, dialog, "Người thu");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(() => money(page, "acc-paid")).toBe(1_000_000);
    await expect.poll(() => money(page, "acc-debt")).toBe(1_000_000);
    await expect.poll(() => money(page, "acc-due")).toBe(1_000_000);

    // It survives a reload, so it really reached PostgreSQL.
    await page.goto(`${profileUrl}?tab=invoice`);
    await expect.poll(() => money(page, "acc-paid")).toBe(1_000_000);
  });

  test("a refund cannot give back more than was collected", async ({ page }) => {
    await createPatient(page);
    await acceptServiceAt(page, "1000000");

    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-treatments");
    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    await expect(page.getByRole("row", { name: /DT01/ })).toBeVisible();

    await page.getByRole("tab", { name: "Hóa đơn" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-payments/account");

    // Nothing has been collected, so any refund must be refused by the server.
    await page.getByRole("button", { name: "Ghi nhận thanh toán" }).click();
    const dialog = page.getByRole("dialog");
    await selectOption(page, dialog, "Loại giao dịch", "Hoàn tiền");
    await selectOption(page, dialog, "Kế hoạch điều trị", "DT01");
    await dialog.getByLabel("Số tiền (đ)", { exact: true }).fill("500000");
    await selectOption(page, dialog, "Người thu");
    await dialog.getByRole("button", { name: "Lưu" }).click();

    // The server refuses it, and the reason reaches the user in Vietnamese.
    await expect(page.getByText("Số tiền không hợp lệ cho thao tác này.").first()).toBeVisible();
    expect(await money(page, "acc-refund")).toBe(0);
  });

  test("money topped up for the patient is held, not counted as paid", async ({ page }) => {
    await createPatient(page);

    await page.getByRole("tab", { name: "Hóa đơn" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-payments/account");

    await page.getByRole("button", { name: "Ghi nhận thanh toán" }).click();
    const dialog = page.getByRole("dialog");
    await selectOption(page, dialog, "Loại giao dịch", "Nạp quỹ");
    await dialog.getByLabel("Số tiền (đ)", { exact: true }).fill("3000000");
    await selectOption(page, dialog, "Người thu");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(() => money(page, "acc-held")).toBe(3_000_000);
    expect(await money(page, "acc-paid")).toBe(0);
  });
});
