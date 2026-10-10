import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Nhân viên → Sơ đồ tổ chức (F-67) — the screen, end to end.
 * BlueDental-local; see docs/clone/pages/org-chart.md.
 *
 * Logs in through the login screen, adds a Team bác sĩ through the dialog,
 * reads it back from the tree, the detail panel and the history popup, reloads
 * to prove it was stored, then deletes it from inside "Sửa đơn vị". The run's
 * dentist is a real account created through the staff API. Nothing is
 * intercepted.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

function dialog(page: Page) {
  return page.locator(".org-unit-dialog");
}

async function openOrgChart(page: Page) {
  const chart = page.waitForResponse((r) => r.url().includes("/api/v1/app/org-chart") && r.request().method() === "GET");
  await page.goto("/staff/org-chart");
  expect((await chart).ok(), "the chart comes from the real API").toBe(true);
}

test.describe("Sơ đồ tổ chức — screen", () => {
  const run = `ocui${runId()}`;
  const unitName = `E2E Team UI ${run}`;
  let dentist: RunStaff;

  test.beforeEach(async ({ page }) => {
    await login(page);
    dentist = await createRunStaff(page, BRANCH_ONE, run, { name: `BS ${run}`, isDentist: true });
  });

  test.afterEach(async ({ page }) => {
    // A failed run may leave its team behind; the head cannot be deleted before it.
    const chart = await call<{ units: { id: string; name: string }[] }>(page, "/api/v1/app/org-chart", { branchId: BRANCH_ONE });
    for (const unit of chart.body.units?.filter((u) => u.name === unitName) ?? []) {
      await call(page, `/api/v1/app/org-chart/units/${unit.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    }
    if (dentist) await deleteStaff(page, dentist.id);
  });

  test("a team is added through the dialog, survives a reload, shows in the history and is deleted from Sửa đơn vị", async ({ page }) => {
    await openOrgChart(page);
    await expect(page.getByRole("link", { name: "Sơ đồ tổ chức" })).toHaveAttribute("aria-current", "page");
    // The strip names only its first few people, so its count tells whether the dentist sits there.
    const unassigned = page.locator(".org-unassigned__title");
    await expect(unassigned).toHaveText(/\(\d+\)/);
    const freeBefore = Number((await unassigned.textContent())?.match(/\((\d+)\)/)?.[1]);

    // Thêm đơn vị: Team bác sĩ is the default kind and the code fills itself.
    await page.getByRole("button", { name: "Thêm đơn vị" }).click();
    await expect(dialog(page)).toContainText("Thêm đơn vị mới");
    await expect(dialog(page).getByRole("radio", { name: /Team bác sĩ/ })).toHaveAttribute("aria-checked", "true");
    await expect(dialog(page).getByLabel("Mã đơn vị")).toHaveValue(/^TBS-\d{3}$/);

    // "Bắt buộc phải có 1 người làm trưởng đơn vị" — saving empty shows the rules, not a request.
    await dialog(page).getByRole("button", { name: "Lưu đơn vị" }).click();
    await expect(dialog(page)).toContainText("Vui lòng nhập tên đơn vị");
    await expect(dialog(page)).toContainText("Bắt buộc phải có 1 người làm trưởng đơn vị");
    // The mock's banner names what is left to fix, and Lưu waits until it is.
    await expect(dialog(page).locator(".org-form__error")).toHaveText("Còn 2 lỗi cần sửa trước khi lưu: Tên đơn vị, Trưởng đơn vị.");
    await expect(dialog(page).getByRole("button", { name: "Lưu đơn vị" })).toBeDisabled();

    await dialog(page).getByLabel("Tên đơn vị").fill(unitName);
    await dialog(page).getByLabel("Trưởng đơn vị").fill(run);
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: run }).first().click();

    const saved = page.waitForResponse((r) => r.url().endsWith("/api/v1/app/org-chart/units") && r.request().method() === "POST");
    await dialog(page).getByRole("button", { name: "Lưu đơn vị" }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Đã tạo đơn vị")).toBeVisible();
    await expect(dialog(page)).toBeHidden();

    const node = page.locator(".org-node").filter({ hasText: unitName });
    await expect(node).toHaveCount(1);
    await expect(node).toContainText("Trưởng team");
    await expect(unassigned).toContainText(`(${freeBefore - 1})`);

    // "check trùng match case": the same name in other casing and spacing is refused while typing.
    await page.getByRole("button", { name: "Thêm đơn vị" }).click();
    await dialog(page).getByLabel("Tên đơn vị").fill(`  ${unitName.toUpperCase()} `);
    await expect(dialog(page)).toContainText("Tên đơn vị đã tồn tại");
    await dialog(page).getByRole("button", { name: "Hủy" }).click();
    await expect(dialog(page)).toBeHidden();

    // A click on the node opens it in the detail panel.
    await node.click();
    const detail = page.getByRole("complementary", { name: /chi tiết|đơn vị/i });
    await expect(detail.locator(".org-detail__name")).toContainText(run);
    await expect(detail.locator(".org-detail__sub")).toContainText(unitName);

    await page.reload();
    await expect(page.locator(".org-node").filter({ hasText: unitName })).toHaveCount(1);

    // "Ghi nhận lại log trên 1 popup".
    await page.getByRole("button", { name: "Lịch sử thay đổi" }).click();
    const historyModal = page.locator(".org-history-modal");
    await expect(historyModal).toContainText("Lịch sử thay đổi sơ đồ tổ chức");
    await historyModal.getByPlaceholder("Tìm theo đơn vị hoặc người thực hiện").fill(run);
    const createdRow = historyModal.locator(".ant-table-row").filter({ hasText: unitName });
    await expect(createdRow).toHaveCount(1);
    await expect(createdRow).toContainText("Tạo đơn vị");
    await page.keyboard.press("Escape");
    await expect(historyModal).toBeHidden();

    // Xoá sits inside "Sửa đơn vị"; the head goes back to the unassigned strip.
    await page.locator(".org-node").filter({ hasText: unitName }).click();
    await page.getByRole("button", { name: "Sửa đơn vị" }).click();
    await expect(dialog(page)).toContainText(unitName);
    await dialog(page).getByRole("button", { name: "Xoá đơn vị" }).click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận xoá đơn vị" });
    await expect(confirm).toContainText(unitName);
    await expect(confirm).toContainText("Chưa thuộc đơn vị nào");
    const removed = page.waitForResponse((r) => r.url().includes("/api/v1/app/org-chart/units/") && r.request().method() === "DELETE");
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await removed).status()).toBeLessThan(300);
    await expect(page.getByText("Đã xoá đơn vị")).toBeVisible();
    await expect(page.locator(".org-node").filter({ hasText: unitName })).toHaveCount(0);
    await expect(unassigned).toContainText(`(${freeBefore})`);

    await page.reload();
    await expect(page.locator(".org-node").filter({ hasText: unitName })).toHaveCount(0);
  });
});
