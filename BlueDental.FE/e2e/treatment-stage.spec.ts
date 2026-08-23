import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { selectOption } from "./fixtures/antd";

/**
 * Feature: Công đoạn điều trị.
 *
 * The reference never exposed a stage payload that could be read without mutating
 * production, so BlueDental's model is documented as an assumption. What this spec
 * verifies is BlueDental's own chain end to end: chẩn đoán → tư vấn → chốt →
 * công đoạn → tiếp tục → hoàn thành, all through the real API and PostgreSQL.
 */
test.describe("Công đoạn điều trị", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /**
   * antd keeps a closed Select's dropdown mounted, so the option must be picked
   * from the dropdown that is actually open.
   */

  /** Opens the first patient in the list and returns their profile URL. */
  async function openFirstPatient(page: Page): Promise<string> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator("tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    return page.url();
  }

  /** Diagnosis → advise → accept, i.e. the service line a stage can hang off. */
  async function createAcceptedServiceLine(page: Page): Promise<void> {
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
    await selectOption(page, adviseDialog, "Bác sĩ tư vấn");
    await adviseDialog.getByRole("button", { name: "Tạo" }).click();
    await expect(adviseDialog).toBeHidden();

    // Only an accepted line becomes a treatment service.
    await page.getByRole("button", { name: "Chấp nhận" }).first().click();
    await expect(page.getByText("Đã chốt").first()).toBeVisible();
  }

  /** Turns the accepted lines into a real treatment slip with service lines. */
  async function openTreatmentPlan(page: Page): Promise<void> {
    // The tab fires both queries at once, so the listeners go up before the click.
    const plans = assertRealApiTraffic(page, "/api/v1/app/patient-treatments");
    const stages = assertRealApiTraffic(page, "/api/v1/app/treatment-stages");

    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();
    await Promise.all([plans, stages]);

    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    await expect(page.getByTestId("plan-slip-count")).toContainText("DT");
  }

  test("a stage runs Chưa làm → Đang làm → Hoàn thành and persists", async ({ page }) => {
    const stageName = `Công đoạn E2E ${runId()}`;

    const profileUrl = await openFirstPatient(page);
    await createAcceptedServiceLine(page);
    await openTreatmentPlan(page);

    await page.getByRole("button", { name: "Công đoạn" }).click();
    const dialog = page.getByRole("dialog");
    await selectOption(page, dialog, "Dịch vụ điều trị");
    await dialog.getByPlaceholder("Tên công đoạn").fill(stageName);
    await selectOption(page, dialog, "Bác sĩ thực hiện");
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(stageName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Chưa làm");

    await row.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(row).toContainText("Đang làm");

    await row.getByRole("button", { name: "Hoàn thành" }).click();
    await expect(row).toContainText("Hoàn thành");

    // A completed stage offers no further transitions and survives a reload.
    await expect(row.getByRole("button", { name: "Tiếp tục" })).toHaveCount(0);

    await page.goto(`${profileUrl}?tab=treatment-plan`);
    const reloaded = page.getByRole("row", { name: new RegExp(stageName) });
    await expect(reloaded).toContainText("Hoàn thành");
    await expect(reloaded.getByRole("button", { name: "Hoàn thành" })).toHaveCount(0);
  });

  test("the latest stage card and the progress bar follow the real stages", async ({ page }) => {
    const stageName = `Công đoạn tiến độ ${runId()}`;
    const note = `Ghi chú ${runId()}`;

    await openFirstPatient(page);
    await createAcceptedServiceLine(page);
    await openTreatmentPlan(page);

    const progress = page.getByTestId("stage-progress");
    const readCompleted = async () => {
      const text = await progress.innerText();
      const match = text.match(/Tiến độ:\s*(\d+)\/(\d+)/);
      return { completed: Number(match?.[1] ?? 0), total: Number(match?.[2] ?? 0) };
    };

    const before = await readCompleted();

    await page.getByRole("button", { name: "Công đoạn" }).click();
    const dialog = page.getByRole("dialog");
    await selectOption(page, dialog, "Dịch vụ điều trị");
    await dialog.getByPlaceholder("Tên công đoạn").fill(stageName);
    await selectOption(page, dialog, "Bác sĩ thực hiện");
    await dialog.getByPlaceholder("Ghi chú công đoạn").fill(note);
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog).toBeHidden();

    // A new stage adds to the total without moving the completed count.
    await expect.poll(async () => (await readCompleted()).total).toBe(before.total + 1);
    expect((await readCompleted()).completed).toBe(before.completed);

    // The newest stage is the one the card reports.
    await expect(progress).toContainText(note);

    const row = page.getByRole("row", { name: new RegExp(stageName) });
    await row.getByRole("button", { name: "Hoàn thành" }).click();
    await expect.poll(async () => (await readCompleted()).completed).toBe(before.completed + 1);
  });
});
