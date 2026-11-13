import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * R-1226 — "Chuyển đổi dịch vụ" (BA screenshots, 2026-11-13):
 * - "THÔNG TIN THANH TOÁN HIỆN TẠI" opens with the line's Đơn giá and Số lượng,
 *   the count followed by the service's Đơn vị in Danh mục ("3 Răng"), above
 *   Tổng tiền.
 * - The new service's "THÔNG TIN THANH TOÁN" ends on "Cần thanh toán thêm",
 *   no longer "Còn lại".
 *
 * Real stack: real login, real API, real PostgreSQL; the catalog entry and the
 * slip are written through the API with the browser's own session. Nothing is
 * converted — the dialog is only read, then closed.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

interface Call {
  method: "POST" | "GET";
  url: string;
  body?: unknown;
}

/** The browser's own fetch: its cookie, its XSRF token, the patient's branch. */
async function api<T>(page: Page, branch: string, call: Call): Promise<T> {
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
          ...(branch ? { "X-Clinic-Branch-Id": branch } : {}),
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

const PRICE = 600_000;
const TEETH = [14, 15, 16];

test("Chuyển đổi prints the line's Đơn giá and Số lượng with its unit, and Cần thanh toán thêm", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  const patientId = /\/patient\/([0-9a-f-]{36})/.exec(page.url())![1];
  const { branchId: branch } = await api<{ branchId: string }>(page, "", {
    method: "GET",
    url: `/api/v1/app/patients/${patientId}`,
  });

  // A 600.000 đ service counted in "Răng". It stays afterwards: a line uses it,
  // so Danh mục refuses to delete it (Catalogs:0033); the six-digit run id
  // keeps the other specs' slip fixtures off it.
  const name = `e2e chuyển đổi đơn vị ${runId()}`;
  const groups = await api<{ items: { id: string }[] }>(page, branch, {
    method: "GET",
    url: `/api/v1/app/taxonomies?ClinicBranchId=${branch}&Group=care_service&MaxResultCount=1`,
  });
  const entry = await api<{ id: string }>(page, branch, {
    method: "POST",
    url: "/api/v1/app/catalog-entries",
    body: {
      clinicBranchId: branch,
      taxonomyId: groups.items[0].id,
      name,
      unit: "Răng",
      price: PRICE,
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 0,
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

  // A one-line slip of it on three teeth: 3 × 600.000 đ.
  const staff = await api<{ items: { id: string }[] }>(page, branch, {
    method: "GET",
    url: "/api/v1/app/staff?MaxResultCount=1",
  });
  const advise = await api<{ id: string }>(page, branch, {
    method: "POST",
    url: "/api/v1/app/patient-advises",
    body: {
      patientId,
      clinicBranchId: branch,
      patientDiagnosisId: null,
      diagnosisId: null,
      serviceId: entry.id,
      staffId: staff.items[0].id,
      originalPrice: PRICE,
      price: PRICE,
      quantity: TEETH.length,
      discountType: 0,
      discountValue: 0,
      teeth: TEETH.map((toothCode) => ({
        toothCode,
        selected: true,
        top: false,
        right: false,
        bottom: false,
        left: false,
        center: false,
      })),
    },
  });
  await api(page, branch, { method: "POST", url: `/api/v1/app/patient-advises/${advise.id}/accept` });
  const slip = await api<{ id: string }>(page, branch, {
    method: "POST",
    url: PLANS_API,
    body: {
      patientId,
      clinicBranchId: branch,
      dentistId: staff.items[0].id,
      discountType: 0,
      discountValue: 0,
      voucherIds: [],
      adviseIds: [advise.id],
    },
  });

  // The slip's read carries the catalog's unit on the line.
  const read = await api<{ services: { serviceId: string; unit: string | null; quantity: number; price: number }[] }>(
    page,
    branch,
    { method: "GET", url: `${PLANS_API}/${slip.id}` },
  );
  const line = read.services.find((item) => item.serviceId === entry.id);
  expect(line).toMatchObject({ unit: "Răng", quantity: TEETH.length, price: PRICE });

  await page.goto(`/patient/${patientId}/treatment-plan/${slip.id}`);
  const row = page.locator(".pdt-table tbody tr.ant-table-row", { hasText: name });
  await row.locator(".pdt-status-trigger").click();
  await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
  const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
  await expect(dialog).toBeVisible();

  // Left column, THÔNG TIN THANH TOÁN HIỆN TẠI: Đơn giá, Số lượng, then Tổng tiền.
  const current = dialog.locator(".cvt-col").first().locator(".cvt-section").last();
  await expect(current.locator(".cvt-fact-label").nth(0)).toHaveText("Đơn giá");
  await expect(current.locator(".cvt-fact-value").nth(0)).toHaveText(money(PRICE));
  await expect(current.locator(".cvt-fact-label").nth(1)).toHaveText("Số lượng");
  await expect(current.locator(".cvt-fact-value").nth(1)).toHaveText(`${TEETH.length} Răng`);
  await expect(current.locator(".cvt-fact-label").nth(2)).toHaveText("Tổng tiền");
  await expect(current.locator(".cvt-fact-value").nth(2)).toHaveText(money(PRICE * TEETH.length));

  // Right column, THÔNG TIN THANH TOÁN: its last row is "Cần thanh toán thêm".
  const next = dialog.locator(".cvt-section").last();
  await expect(next.locator(".cvt-fact-label").last()).toHaveText("Cần thanh toán thêm");
  await expect(next.locator(".cvt-fact-label", { hasText: /^Còn lại$/ })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
