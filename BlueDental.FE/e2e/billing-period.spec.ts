import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Feature: Thanh toán & hoá đơn reads one Ngày / Tuần / Tháng window at a time,
 * opening on today (owner's request, 2026-10-06).
 *
 * Real stack only — signed in through the login screen, an invoice made through
 * the real API, the list filtered by the server. Nothing is stubbed.
 */

const INVOICES = "/api/v1/app/invoices";

/** A real request from inside a signed-in page — its cookie session and antiforgery header. */
async function call(
  page: Page,
  url: string,
  options: { method?: "GET" | "POST"; json?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(
    async ({ url, options }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      if (options.json !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : {} };
    },
    { url, options },
  );
}

const pad = (value: number) => String(value).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shownDay = (date: Date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

test.describe("Thanh toán & hoá đơn — period filter", () => {
  test("opens on today's day, and the server filters by the window", async ({ page }) => {
    test.setTimeout(120_000);

    await login(page);
    await page.goto("/billing");

    const picker = page.locator(".bd-period");
    await expect(picker.getByRole("button", { name: "Ngày", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const today = new Date();
    await expect(picker.locator("input")).toHaveValue(shownDay(today));

    // An invoice issued now, in the admin's own branch.
    const slips = await call(page, "/api/v1/app/patient-treatments?maxResultCount=1");
    const patientId = (slips.body.items as { patientId: string }[])[0]?.patientId;
    expect(patientId, "the seed should have a patient").toBeTruthy();
    const created = await call(page, INVOICES, {
      method: "POST",
      json: {
        patientId,
        subTotal: 100000,
        taxAmount: 0,
        discountAmount: 0,
        currency: "VND",
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    });
    expect(created.status).toBe(200);
    const invoiceId = created.body.id as string;
    const invoiceNumber = created.body.invoiceNumber as string;

    try {
      // Server: today's window holds it, yesterday's does not.
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const inToday = await call(
        page,
        `${INVOICES}?filter=${invoiceNumber}&fromDate=${isoDay(today)}&toDate=${isoDay(today)}`,
      );
      expect(inToday.body.totalCount).toBe(1);
      const inYesterday = await call(
        page,
        `${INVOICES}?filter=${invoiceNumber}&fromDate=${isoDay(yesterday)}&toDate=${isoDay(yesterday)}`,
      );
      expect(inYesterday.body.totalCount).toBe(0);

      // Screen: listed under today after a reload.
      await page.reload();
      await page.getByPlaceholder("Tìm theo mã phiếu...").fill(invoiceNumber);
      const row = page.locator(".ant-table-tbody tr").filter({ hasText: invoiceNumber });
      await expect(row).toBeVisible({ timeout: 20_000 });

      // One day back: gone.
      await picker.getByRole("button", { name: "Ngày trước" }).click();
      await expect(picker.locator("input")).toHaveValue(shownDay(yesterday));
      await expect(row).toHaveCount(0);
      await expect(page.getByText("Chưa có hoá đơn")).toBeVisible();

      // Tháng re-anchors on now, so it is back.
      await picker.getByRole("button", { name: "Tháng", exact: true }).click();
      await expect(picker.locator("input")).toHaveValue(
        `${pad(today.getMonth() + 1)}/${today.getFullYear()}`,
      );
      await expect(row).toBeVisible();
    } finally {
      await call(page, `${INVOICES}/${invoiceId}/void`, {
        method: "POST",
        json: { reason: "E2E cleanup" },
      });
    }
  });
});
