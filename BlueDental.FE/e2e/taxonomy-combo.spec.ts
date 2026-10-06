import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BRANCH_ONE,
  COMBO,
  ENTRIES,
  call,
  createGroup,
  createSingle,
  getEntry,
  type Entry,
} from "./fixtures/catalogApi";

/**
 * Feature: Danh mục → Dịch vụ → "Loại: Dịch vụ lẻ | Combo" (BA request
 * 2026-10-06). The dialog, end to end: real login, real API, real database.
 * The single services are made through the API; the combo itself is built,
 * priced and saved in the browser. Nothing is intercepted.
 */

async function openGroup(page: Page, name: string) {
  await page.locator("#taxonomy-group-search").fill(name);
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /Thêm dịch vụ$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

function kindItem(dialog: Locator, label: "Dịch vụ lẻ" | "Combo") {
  return dialog.locator(".bd-svc-kind .ant-segmented-item", { hasText: new RegExp(`^${label}$`) });
}

function summaryRow(dialog: Locator, label: RegExp) {
  return dialog.locator(".bd-combo-sum").filter({ hasText: label });
}

test.describe("Danh mục — combo dịch vụ", () => {
  test("builds a combo from master services, prices it, takes a typed price and keeps it after reload", async ({ page }) => {
    const id = runId();
    const groupName = `Nhóm combo UI ${id}`;
    const scaling = `Cạo vôi ${id}`;
    const filling = `Trám răng ${id}`;
    const comboName = `Combo UI ${id}`;

    await login(page);
    const loaded = assertRealApiTraffic(page, "/api/v1/app/catalog-entries");
    await page.goto("/taxonomy/service");
    await loaded;

    const groupId = await createGroup(page, BRANCH_ONE, groupName);
    const scalingEntry = await createSingle(page, groupId, scaling, 300_000);
    await createSingle(page, groupId, filling, 500_000);
    await page.reload();
    await openGroup(page, groupName);

    const dialog = await openCreateDialog(page);
    await kindItem(dialog, "Combo").click();
    await expect(dialog.getByText("Gộp nhiều dịch vụ / sản phẩm và bán với một giá")).toBeVisible();
    await expect(dialog.getByLabel(/^Tên combo/)).toBeVisible();
    await expect(dialog.getByLabel(/^Đơn vị$/)).toHaveValue("Combo");
    await expect(dialog.getByRole("button", { name: /Lưu combo$/ })).toBeDisabled();

    // The picker searches the branch's single services on the server.
    const picker = dialog.getByRole("complementary", { name: "Chọn dịch vụ" });
    await picker.getByLabel("Tìm dịch vụ").fill(id);
    await expect(picker.getByText("Dịch vụ (2)")).toBeVisible();

    // A picked service is highlighted and its + becomes ×, which takes it out again.
    await picker.getByRole("button", { name: `Thêm ${scaling} vào combo` }).click();
    const scalingCard = picker.locator(".bd-combo-item", { hasText: scaling });
    await expect(scalingCard).toHaveClass(/bd-combo-item--picked/);
    await expect(picker.getByRole("button", { name: `Thêm ${scaling} vào combo` })).toHaveCount(0);
    await picker.getByRole("button", { name: `Bỏ ${scaling} khỏi combo` }).click();
    await expect(scalingCard).not.toHaveClass(/bd-combo-item--picked/);
    await expect(dialog.getByLabel(`Thành tiền ${scaling}`)).toHaveCount(0);

    // Quantity is the table's job; the picker badge follows it.
    await picker.getByRole("button", { name: `Thêm ${scaling} vào combo` }).click();
    await dialog.getByRole("button", { name: `Tăng số lượng ${scaling}` }).click();
    await expect(picker.getByText("×2 trong combo")).toBeVisible();
    await picker.getByRole("button", { name: `Thêm ${filling} vào combo` }).click();

    // 2 × 300k + 1 × 500k, nothing edited yet: both totals agree, no saving.
    await expect(summaryRow(dialog, /Tổng giá lẻ:/)).toContainText("1.100.000 đ");
    await expect(summaryRow(dialog, /Giá Combo:/)).toContainText("1.100.000 đ");
    await expect(dialog.getByRole("status")).toHaveCount(0);

    // Thành tiền is per unit inside the combo; the retail total keeps the master price.
    const scalingAmount = dialog.getByLabel(`Thành tiền ${scaling}`);
    await scalingAmount.fill("250000");
    await expect(scalingAmount).toHaveValue("250.000");
    await expect(summaryRow(dialog, /Tổng giá lẻ:/)).toContainText("1.100.000 đ");
    await expect(summaryRow(dialog, /Giá Combo:/)).toContainText("1.000.000 đ");
    await expect(dialog.getByRole("status")).toHaveText("Khách tiết kiệm 100.000 đ (9,1%) so với mua lẻ");
    // The BA mock puts it right under Cấu hình giá & thuế, the amount in bold.
    const priceSection = dialog
      .locator(".bd-dialog-section")
      .filter({ has: page.getByText("Cấu hình giá & thuế", { exact: true }) });
    await expect(priceSection.locator("xpath=following-sibling::*[1]")).toHaveAttribute("role", "status");
    await expect(dialog.getByRole("status").locator("strong")).toHaveText("100.000");

    // −/+ move the quantity and both totals, never the per-unit amount.
    await dialog.getByRole("button", { name: `Tăng số lượng ${filling}` }).click();
    await expect(summaryRow(dialog, /Tổng giá lẻ:/)).toContainText("1.600.000 đ");
    await expect(summaryRow(dialog, /Giá Combo:/)).toContainText("1.500.000 đ");
    await dialog.getByRole("button", { name: `Giảm số lượng ${filling}` }).click();
    await expect(dialog.getByRole("button", { name: `Giảm số lượng ${filling}` })).toBeDisabled();
    await expect(summaryRow(dialog, /Giá Combo:/)).toContainText("1.000.000 đ");
    await expect(scalingAmount).toHaveValue("250.000");

    await expect(dialog.getByLabel(/^Tổng giá lẻ/)).toHaveValue("1.100.000");
    await expect(dialog.getByLabel(/^Giá combo/)).toHaveValue("1.000.000");

    // 8 %: tax on top before tax, carved out of the price after tax.
    await dialog.getByLabel(/% thuế/).click();
    await page.locator(".ant-select-item-option").filter({ hasText: /^8%$/ }).click();
    await expect(dialog.getByLabel(/^Tiền thuế/)).toHaveValue("80.000");
    await expect(dialog.getByLabel(/^Thực thu/)).toHaveValue("1.080.000");
    await dialog.locator(".ant-segmented-item", { hasText: "Sau thuế" }).click();
    await expect(dialog.getByLabel(/^Tiền thuế/)).toHaveValue("74.074");
    await expect(dialog.getByLabel(/^Thực thu/)).toHaveValue("925.926");

    // Giá combo starts from the formula and may then be typed over (BA 2026-10-06).
    const comboPrice = dialog.getByLabel(/^Giá combo/);
    await comboPrice.fill("900000");
    await expect(comboPrice).toHaveValue("900.000");
    await expect(summaryRow(dialog, /Giá Combo:/)).toContainText("900.000 đ");
    await expect(summaryRow(dialog, /Tổng giá lẻ:/)).toContainText("1.100.000 đ");
    await expect(dialog.getByRole("status")).toHaveText("Khách tiết kiệm 200.000 đ (18,2%) so với mua lẻ");
    await expect(dialog.getByLabel(/^Tiền thuế/)).toHaveValue("66.667");
    await expect(dialog.getByLabel(/^Thực thu/)).toHaveValue("833.333");

    // Touching the rows works the formula out again; the user types over it once more.
    await dialog.getByRole("button", { name: `Tăng số lượng ${filling}` }).click();
    await expect(comboPrice).toHaveValue("1.500.000");
    await dialog.getByRole("button", { name: `Giảm số lượng ${filling}` }).click();
    await expect(comboPrice).toHaveValue("1.000.000");
    await comboPrice.fill("900000");
    await expect(dialog.getByLabel(/^Thực thu/)).toHaveValue("833.333");

    // An empty Giá combo is refused before anything is sent.
    await comboPrice.fill("");
    await dialog.getByLabel(/^Tên combo/).fill(comboName);
    await dialog.getByRole("button", { name: /Lưu combo$/ }).click();
    await expect(dialog.getByText("Vui lòng nhập giá combo")).toBeVisible();
    await comboPrice.fill("900000");

    await expect(dialog.getByLabel(/Phân loại dịch vụ/)).toBeVisible();
    await dialog.getByRole("button", { name: /Lưu combo$/ }).click();
    await expect(dialog).toBeHidden();

    // After a reload the row carries the Combo tag and reopens as a combo.
    await page.reload();
    await openGroup(page, groupName);
    const row = page.getByRole("row", { name: new RegExp(comboName) });
    await expect(row.getByText("Combo", { exact: true })).toBeVisible();
    await expect(row).toContainText("900.000");

    await page.getByRole("button", { name: `Chỉnh sửa ${comboName}` }).click();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByRole("radio", { name: "Combo" })).toBeChecked();
    await expect(reopened.getByRole("radio", { name: "Combo" })).toBeDisabled();
    await expect(reopened.getByLabel(`Thành tiền ${scaling}`)).toHaveValue("250.000");
    await expect(reopened.getByRole("radio", { name: "Sau thuế" })).toBeChecked();
    await expect(summaryRow(reopened, /Tổng giá lẻ:/)).toContainText("1.100.000 đ");
    // Opening a saved combo keeps its typed price; nothing is worked out again.
    await expect(reopened.getByLabel(/^Giá combo/)).toHaveValue("900.000");
    await expect(summaryRow(reopened, /Giá Combo:/)).toContainText("900.000 đ");
    await expect(reopened.getByLabel(/^Thực thu/)).toHaveValue("833.333");

    // The combo's own price never leaks back into the master service.
    expect((await getEntry(page, scalingEntry.id)).price).toBe(300_000);
    const list = await call<{ items: Entry[] }>(
      page,
      "GET",
      `${ENTRIES}?group=care_service&taxonomyId=${groupId}&kind=${COMBO}&maxResultCount=100`,
    );
    expect(list.status).toBe(200);
    const saved = list.body.items?.find((item) => item.name === comboName);
    expect(saved?.price).toBe(900_000);
    expect(saved?.serviceConfig.kind).toBe(COMBO);
  });

  test("the single-service view is unchanged and leaving Combo drops its unit", async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");

    const dialog = await openCreateDialog(page);
    await expect(dialog.getByRole("radio", { name: "Dịch vụ lẻ" })).toBeChecked();
    await expect(dialog.getByRole("complementary", { name: "Chọn dịch vụ" })).toHaveCount(0);
    await expect(dialog.getByLabel(/Giá sau giảm/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Lưu combo$/ })).toHaveCount(0);

    await kindItem(dialog, "Combo").click();
    await expect(dialog.getByRole("complementary", { name: "Chọn dịch vụ" })).toBeVisible();
    await expect(dialog.getByLabel(/^Đơn vị$/)).toHaveValue("Combo");

    await kindItem(dialog, "Dịch vụ lẻ").click();
    await expect(dialog.getByRole("complementary", { name: "Chọn dịch vụ" })).toHaveCount(0);
    await expect(dialog.getByLabel(/^Đơn vị$/)).toHaveValue("");
    await expect(dialog.getByLabel(/Giá sau giảm/)).toBeVisible();
  });
});
