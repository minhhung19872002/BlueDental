import { expect, type Page, type Response } from "@playwright/test";
import { money, openDropdown } from "./ledgerReceipt";

/**
 * "+ Thêm dịch vụ phát sinh" on a slip's Chi tiết tab: the button opens the
 * "Thêm dịch vụ" modal, and its "Lưu" adds the service as a new line on
 * this slip — one `POST …/services` (owner 2026-10-15; it replaced the inline
 * "Thêm dịch vụ mới" row).
 */

export interface ExtraServiceOptions {
  /** Skip the service of this name — a second line on another service. */
  except?: string;
  teeth?: number[];
  /** Only a service priced above this — 0 by default, so never a free one. */
  minPrice?: number;
  /** A "VNĐ" discount typed into the modal before "Lưu". */
  discount?: number;
}

const escapeRegExp = (text: string) => text.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The open modal, after "Thêm dịch vụ phát sinh". */
export async function openExtraServiceDialog(page: Page) {
  await page.locator(".pdt-toolbar").getByRole("button", { name: "Thêm dịch vụ phát sinh" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm dịch vụ" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Fills the modal with a priced service and saves it; returns the POST and the service name. */
export async function addExtraService(
  page: Page,
  { except, teeth = [15], minPrice = 0, discount }: ExtraServiceOptions = {},
): Promise<{ response: Response; name: string; price: number }> {
  const dialog = await openExtraServiceDialog(page);

  await dialog.getByRole("combobox", { name: /Bác sĩ tư vấn(?! 2)/ }).click();
  const advisor = openDropdown(page).locator(".ant-select-item-option").first();
  await expect(advisor).toBeVisible();
  await advisor.click();

  await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  let options = openDropdown(page, ".tp-service-dropdown").locator(".ant-select-item-option:has(.tp-opt-service)");
  // Matched on the name span alone: the option prints its price beside it.
  if (except) options = options.filter({ hasNot: page.locator(".tp-opt-name", { hasText: new RegExp(`^${escapeRegExp(except)}$`) }) });
  await expect(options.first()).toBeVisible();
  let name = "";
  let price = 0;
  for (let index = 0, count = await options.count(); index < count && !name; index++) {
    const option = options.nth(index);
    const listed = money(await option.locator(".tp-opt-price").innerText());
    if (listed > minPrice) {
      name = (await option.locator(".tp-opt-name").innerText()).trim();
      price = listed;
      await option.click();
    }
  }
  if (!name) throw new Error("Danh mục dịch vụ không có mục nào còn giá");

  await dialog.locator(".tp-tooth-btn").click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(picker).toBeVisible();
  for (const tooth of teeth) await picker.getByRole("button", { name: `Răng ${tooth}`, exact: true }).click();
  await picker.locator(".tp-teeth-foot button").click();
  await expect(picker).toBeHidden();

  if (discount) {
    await dialog.locator(".tp-toggle button", { hasText: "VNĐ" }).click();
    await dialog.locator(".tp-create-discount input:visible").fill(String(discount));
  }

  const added = page.waitForResponse((res) => /\/services$/.test(new URL(res.url()).pathname) && res.request().method() === "POST");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const response = await added;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(dialog).toBeHidden();
  return { response, name, price };
}
