import { expect, type Locator, type Page } from "@playwright/test";
import { qrPng } from "./cccdQr";

/** Shared steps of the "Quét CCCD" specs — all through the real UI and API. */

export const PATIENTS = "/api/v1/app/patients";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

/** Pre-2025 shape without the unit words, as cards print it. */
export const OLD_ADDRESS = "Thôn Đông, Bình Thuận, Bình Sơn, Quảng Ngãi";
export const OLD_ADDRESS_HCM = "12 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh";
/** Already in today's two-tier shape. */
export const NEW_ADDRESS = "180b/4 Ấp Long Hưng 2, Hòa Long, Đồng Tháp";

interface JsonResult<T> {
  status: number;
  body: T;
}

/** A GET from the logged-in page, with its real cookie session. */
export async function getJson<T>(
  page: Page,
  url: string,
  branchHeader?: string,
): Promise<JsonResult<T>> {
  return page.evaluate(
    async ({ url, branchHeader }) => {
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          accept: "application/json",
          ...(branchHeader ? { "X-Clinic-Branch-Id": branchHeader } : {}),
        },
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as T };
    },
    { url, branchHeader },
  );
}

/** A 12-digit CCCD no earlier run used. */
export function freshNationalId(id: string, tail: string): string {
  return `8${id}${tail}`.padEnd(12, "0").slice(0, 12);
}

export async function openScan(page: Page): Promise<Locator> {
  await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Quét CCCD" }).click();
  const dialog = page.getByRole("dialog", { name: "Quét CCCD" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** "Tải ảnh" with a picture of the QR carrying this text. */
export async function scanPhoto(page: Page, text: string): Promise<Locator> {
  const dialog = await openScan(page);
  await dialog.locator("input[type=file]").setInputFiles({
    name: "cccd.png",
    mimeType: "image/png",
    buffer: await qrPng(text),
  });
  return dialog;
}

export function preview(dialog: Locator): Locator {
  return dialog.getByRole("region", { name: "Thông tin CCCD" });
}

/** The saved record, read back with separate requests. */
export async function recordOf(page: Page, cccd: string): Promise<Record<string, unknown>> {
  const list = await getJson<{ items: { id: string }[]; totalCount: number }>(
    page,
    `${PATIENTS}?filter=${cccd}&maxResultCount=10`,
    BRANCH_ONE,
  );
  expect(list.body.totalCount).toBe(1);
  const record = await getJson<Record<string, unknown>>(
    page,
    `${PATIENTS}/${list.body.items[0].id}`,
    BRANCH_ONE,
  );
  return record.body;
}

export async function saveWithPhone(page: Page, phone: string): Promise<void> {
  const form = page.getByRole("dialog", { name: "Tạo hồ sơ" });
  await form.getByRole("textbox", { name: "Điện thoại *" }).fill(phone);
  await form.getByRole("button", { name: "Lưu" }).click();
  await expect(form).toBeHidden({ timeout: 15_000 });
}

/** The dialog body fits on screen — nothing to scroll to reach a button. */
export async function fitsWithoutScrolling(dialog: Locator): Promise<boolean> {
  return dialog.locator(".ant-modal-body").evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
}
