import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Quản trị vận hành.
 *
 * Each department + section pair is guarded by its own ability subject on the
 * reference (operations<Department><Section>), and one BlueDental endpoint serves
 * them all — so the department must travel with every request.
 */
test.describe("Quản trị vận hành", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("an article stays a draft until it has content to publish", async ({ page }) => {
    const title = `Thông báo E2E ${runId()}`;

    await page.goto("/operations");
    await assertRealApiTraffic(page, "/api/v1/app/operations-articles");

    await page.getByRole("button", { name: "Tạo Bài Viết" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Tiêu đề").fill(title);
    await dialog.getByPlaceholder(/Nội dung/).fill("Nội dung thông báo E2E.");
    await dialog.getByRole("button", { name: "Tạo" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Nháp");

    await row.getByRole("button", { name: "Đăng" }).click();
    await expect(row).toContainText("Đã đăng");

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toContainText("Đã đăng");
  });

  test("a task runs Chưa làm → Đang làm → Hoàn thành and moves the counters", async ({ page }) => {
    const title = `Công việc E2E ${runId()}`;

    await page.goto("/operations");
    await page.getByRole("button", { name: "Công việc" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/operations-tasks");

    // The stat labels also appear as row action buttons, so read the tiles by id.
    const readStat = async (testId: string) => {
      const text = await page.getByTestId(testId).innerText();
      return Number(text.replace(/[^\d]/g, "") || 0);
    };

    const doneBefore = await readStat("ops-stat-done");

    await page.getByRole("button", { name: "Tạo Công Việc" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Tên công việc").fill(title);
    await dialog.getByRole("button", { name: "Tạo" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Chưa làm");

    await row.getByRole("button", { name: "Bắt đầu" }).click();
    await expect(row).toContainText("Đang làm");

    await row.getByRole("button", { name: "Hoàn thành" }).click();
    await expect(row).toContainText("Hoàn thành");
    await expect.poll(() => readStat("ops-stat-done")).toBe(doneBefore + 1);

    // A finished task offers no further transitions.
    await expect(row.getByRole("button", { name: "Bắt đầu" })).toHaveCount(0);
  });

  test("switching department re-queries with that department", async ({ page }) => {
    await page.goto("/operations");
    await assertRealApiTraffic(page, "/api/v1/app/operations-articles");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/app/operations-articles")) requests.push(req.url());
    });

    await page.getByRole("tab", { name: "Khối lễ tân" }).click();

    // department=3 is Reception in BlueDental.Operations.OperationsDepartment.
    await expect.poll(() => requests.some((url) => url.includes("department=3"))).toBe(true);
  });
});
