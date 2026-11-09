import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { openNewSlip } from "./fixtures/ledgerReceipt";

/**
 * R-1184 — "Chuyển đổi dịch vụ" → Thay thế prices the new service at Danh
 * mục's "Giá sau giảm", as Chọn dịch vụ does: a 300.000 đ service with 10% off
 * reads and is written at 270.000 đ, not at its list price.
 *
 * Real stack: real login, real API, real PostgreSQL; the catalog entry and the
 * slip are written through the API with the browser's own session.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

interface CatalogCall {
  method: "POST" | "GET";
  url: string;
  body?: unknown;
}

/** The browser's own fetch: its cookie, its XSRF token, the patient's branch. */
async function api<T>(page: Page, branch: string, call: CatalogCall): Promise<T> {
  return page.evaluate(
    async ({ branch, call }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(call.url, {
        method: call.method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
      });
      if (!res.ok) throw new Error(`${call.method} ${call.url} ${res.status} ${await res.text()}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    { branch, call },
  ) as Promise<T>;
}

test("Chuyển đổi → Thay thế charges the new service at its Giá sau giảm", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  const { patientId, slip } = await openNewSlip(page);
  const { branchId: branch } = await api<{ branchId: string }>(page, "", {
    method: "GET",
    url: `/api/v1/app/patients/${patientId}`,
  });

  // A service of 300.000 đ with 10% off in Danh mục: "Giá sau giảm" 270.000 đ.
  const name = `e2e chuyển đổi giá sau giảm ${runId()}`;
  const groups = await api<{ items: { id: string }[] }>(page, branch, {
    method: "GET",
    url: `/api/v1/app/taxonomies?ClinicBranchId=${branch}&Group=care_service&MaxResultCount=1`,
  });
  const entry = await api<{ id: string; serviceConfig: { priceAfterDiscount: number } }>(page, branch, {
    method: "POST",
    url: "/api/v1/app/catalog-entries",
    body: {
      clinicBranchId: branch,
      taxonomyId: groups.items[0].id,
      name,
      price: 300_000,
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 10,
        requireImage: false,
        deductDoctorOnWarranty: false,
        separateRevenue: false,
        showToothOnInvoice: false,
        revenueByStage: false,
        requireStageSequence: false,
        warrantyDays: 0,
        laboSupplierIds: [],
      },
      stages: [],
    },
  });
  expect(entry.serviceConfig.priceAfterDiscount).toBe(270_000);

  // The entry stays: a line now uses it, so Danh mục refuses to delete it
  // (Catalogs:0033), and its six-digit run id keeps other specs off it.
  await page.reload();
  const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
  await row.locator(".pdt-status-trigger").click();
  await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
  const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
  await expect(dialog).toBeVisible();

  const picker = dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ });
  await picker.click();
  await picker.pressSequentially(name);
  const option = page
    .locator(".tp-service-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")
    .filter({ hasText: name });
  await expect(option).toHaveCount(1, { timeout: 15_000 });
  await option.click();

  // Thông tin thanh toán of the new service, one tooth: Tổng tiền and Còn lại
  // at the sale price, nothing taken off on top of it.
  const facts = dialog.locator(".cvt-section").last().locator(".cvt-fact-value");
  await expect(facts).toHaveText([money(270_000), money(0), money(0), money(0), money(270_000)]);

  await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill("R-1184 giá sau giảm");
  for (const label of ["Bác sĩ chẩn đoán 1", "Nhân sự tư vấn 1"]) {
    await dialog.getByRole("combobox", { name: label }).click();
    const first = page
      .locator(".ant-select-dropdown:not(.tp-service-dropdown):not(.ant-select-dropdown-hidden)")
      .last()
      .locator(".ant-select-item-option")
      .first();
    await expect(first).toBeVisible();
    await first.click();
  }

  const converted = page.waitForResponse(
    (res) => res.url().includes("/convert") && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  expect((await converted).ok()).toBeTruthy();
  await expect(dialog).toBeHidden();

  // Read back on a separate request: the new line was written at 270.000 đ.
  const saved = await api<{
    services: { serviceId: string; price: number; originalPrice: number; effectiveAmount: number }[];
  }>(page, branch, { method: "GET", url: `${PLANS_API}/${slip.id}` });
  const line = saved.services.find((item) => item.serviceId === entry.id);
  expect(line).toBeDefined();
  expect(line!.price).toBe(270_000);
  expect(line!.originalPrice).toBe(270_000);
  expect(line!.effectiveAmount).toBe(270_000);

  // And the slip table, reloaded, prints it so.
  await page.reload();
  const newRow = page.locator(".pdt-table tbody tr.ant-table-row", { hasText: name });
  await expect(newRow).toContainText(money(270_000));
  await expect(newRow).not.toContainText(money(300_000));
});
