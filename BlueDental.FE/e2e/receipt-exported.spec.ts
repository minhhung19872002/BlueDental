import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import {
  expectReceiptPage,
  issueReceipt,
  openNewSlip,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2610 · Tài chính → Phiếu thu, step "Xuất phiếu thu" as the BA mock draws
 * it: the column says ✓ Đã xuất phiếu thu with when the payment was recorded,
 * how the receipt was signed and kept, then In phiếu · Tải PDF · Tạo phiếu mới.
 * Both files are the one kept at export; Tạo phiếu mới opens the slip's
 * "Tạo phiếu thanh toán" once.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const panel = (page: Page) => page.getByRole("complementary", { name: "Trạng thái" });
const storedFile = (page: Page, receipt: Pick<Receipt, "id">) =>
  page.waitForResponse((res) => res.url().includes(`/${receipt.id}/receipt-file`) && res.ok());

test("an exported receipt reads as the mock: facts, In phiếu, Tải PDF and Tạo phiếu mới", async ({ page }) => {
  await login(page);
  const { slip } = await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  const written = await writeOnFirstLine(page);
  await issueReceipt(page, written);
  await page.goto(`/billing/receipts/${written.id}`);
  await expectReceiptPage(page, written);

  // Kế toán kiểm tra and Xuất phiếu thu are one click, so they share its time.
  const captions = page.locator(".rcpt-track-card .step-track-caption");
  await expect(captions.nth(4)).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  expect(await captions.nth(4).textContent()).toBe(await captions.nth(5).textContent());

  // ── The column: ✓ heading, when, three facts ────────────────────────────
  await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Đã xuất phiếu thu");
  const column = panel(page);
  await expect(column.locator(".rcpt-done-icon")).toBeVisible();
  await expect(column.locator(".rcpt-panel-title")).toHaveText("Đã xuất phiếu thu");
  await expect(column.locator(".rcpt-done-sub")).toHaveText(
    /^Ghi nhận thanh toán lúc \d{2}:\d{2}:\d{2} ngày \d{2}\/\d{2}\/\d{4}$/,
  );
  // P2910_02: when and by whom it was exported, how each side signed.
  await expect(column.locator(".rcpt-done-fact dt")).toHaveText([
    "Xuất phiếu",
    "Hình thức ký số",
    "Chữ ký kế toán",
    "Khách ký",
    "Ký số đơn vị",
    "Lưu trữ",
  ]);
  await expect(column.locator(".rcpt-done-fact dd")).toHaveText([
    /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(:\d{2})? · .+$/,
    /^Ký tay trực tiếp – .+ xác nhận$/,
    "Ký tay trực tiếp trên phiếu in",
    /^Trên iPad lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/,
    "Chưa ký số",
    "PDF/A · tối thiểu 10 năm",
  ]);
  // The ✓ hint and the slip link of the old column are gone (mock).
  await expect(column).not.toContainText("Bấm ✓");
  await expect(column.getByRole("link")).toHaveCount(0);

  // The column is only as tall as what it says, like the steps before (owner).
  const actions = column.locator(".rcpt-done-actions");
  await expect(actions.getByRole("button")).toHaveText(["In phiếu", "Tải PDF", "Tạo phiếu mới"]);
  const sheetBox = await page.locator(".rcpt-sheet").boundingBox();
  const columnBox = await column.boundingBox();
  expect(columnBox?.height ?? Infinity).toBeLessThan(sheetBox?.height ?? 0);

  // ── In phiếu opens the kept file in a new tab; the page stays ───────────
  const printed = storedFile(page, written);
  const tab = page.waitForEvent("popup");
  await actions.getByRole("button", { name: "In phiếu" }).click();
  const printedRes = await printed;
  expect(printedRes.headers()["content-type"]).toContain("application/pdf");
  await (await tab).close();
  await expect(page).toHaveURL(new RegExp(`/billing/receipts/${written.id}`));

  // ── Tải PDF saves the same kept file, named after the receipt ───────────
  const downloaded = storedFile(page, written);
  const download = page.waitForEvent("download");
  await actions.getByRole("button", { name: "Tải PDF" }).click();
  await downloaded;
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${written.code.replaceAll("/", "-")}.pdf`);
  const bytes = await readFile((await file.path()) ?? "");
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // ── Tạo phiếu mới: the slip's Thanh toán tab with the dialog open, once ──
  await actions.getByRole("button", { name: "Tạo phiếu mới" }).click();
  await expect(page).toHaveURL(new RegExp(`/treatment-plan/${slip.id}.*planTab=payment-v2`));
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/newPayment=/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator(".ant-table-row", { hasText: written.code })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Tạo phiếu thanh toán" })).toHaveCount(0);
});
