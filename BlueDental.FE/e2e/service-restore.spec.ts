import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { createSlipViaApi, settleReceipt, PAYMENTS_API, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * R-1230 — "Khôi phục dịch vụ" (owner 2026-11-13): a "Hủy dịch vụ" line gets
 * a ↺ in Thao tác, under the same right as cancelling it. Confirmed, the line
 * is "Đã tạo" again and is charged on the slip again. Money already refunded
 * on the line does not block it; the question warns in red that the amount is
 * owed again.
 *
 * Real stack: real login, real API, real PostgreSQL. The slip, the cancel, the
 * receipt and the refund are written through the API with the browser's own
 * session; the restore itself is done on screen.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const SERVICE_STATUS = { Created: 1, Cancelled: 4 } as const;
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

interface Line {
  id: string;
  status: number;
  payableAmount: number;
  paidAmount: number;
  refundedAmount: number;
  outstandingAmount: number;
}
interface Slip {
  id: string;
  patientId: string;
  clinicBranchId: string;
  servicesTotal: number;
  services: Line[];
}

/** The browser's own fetch: its cookie, its XSRF token, the slip's branch. */
async function api<T>(page: Page, branch: string, method: "GET" | "POST" | "PUT", url: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ branch, method, url, body }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(branch ? { "X-Clinic-Branch-Id": branch } : {}),
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${method} ${url} ${res.status} ${await res.text()}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    { branch, method, url, body },
  ) as Promise<T>;
}

async function openFirstPatient(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  return /\/patient\/([0-9a-f-]{36})/.exec(page.url())![1];
}

async function readSlip(page: Page, planId: string): Promise<Slip> {
  return api<Slip>(page, "", "GET", `${PLANS_API}/${planId}`);
}

async function cancelLine(page: Page, slip: Slip): Promise<Slip> {
  return api<Slip>(page, slip.clinicBranchId, "POST", `${PLANS_API}/${slip.id}/services/${slip.services[0].id}/cancel`);
}

function serviceRow(page: Page, serviceName: string) {
  return page.locator(".pdt-table tbody tr.ant-table-row").filter({ hasText: serviceName }).first();
}

const restoreQuestion = (page: Page) => page.getByRole("dialog", { name: "Xác nhận khôi phục dịch vụ" });

test("a cancelled line is restored from ↺ and charged on the slip again", async ({ page }) => {
  const patientId = await openFirstPatient(page);
  const created = await createSlipViaApi(page, patientId, [14]);
  const before = await readSlip(page, created.id);
  const cancelled = await cancelLine(page, before);
  expect(cancelled.services[0].status).toBe(SERVICE_STATUS.Cancelled);
  expect(cancelled.servicesTotal).toBe(0);

  await page.goto(`/patient/${patientId}/treatment-plan/${created.id}`);
  const row = serviceRow(page, created.serviceName);
  await expect(row.locator(".pdt-status")).toHaveText("Hủy dịch vụ", { timeout: 20_000 });

  const restore = row.getByRole("button", { name: "Khôi phục dịch vụ" });
  await expect(restore).toBeVisible();
  await restore.click();

  const question = restoreQuestion(page);
  await expect(question).toBeVisible();
  await expect(question).toContainText(created.serviceName);
  // Nothing was refunded, so no warning.
  await expect(question.getByRole("alert")).toHaveCount(0);

  const restored = page.waitForResponse(
    (res) => res.url().includes(`/services/${before.services[0].id}/restore`) && res.request().method() === "POST",
  );
  await question.getByRole("button", { name: "Khôi phục dịch vụ" }).click();
  expect((await restored).status()).toBe(200);
  await expect(page.getByText("Đã khôi phục dịch vụ")).toBeVisible();
  await expect(question).toBeHidden();

  await expect(row.locator(".pdt-status")).not.toHaveText("Hủy dịch vụ");
  await expect(row.getByRole("button", { name: "Khôi phục dịch vụ" })).toHaveCount(0);

  // Server: the line is "Đã tạo" and counts on the slip again.
  const after = await readSlip(page, created.id);
  expect(after.services[0].status).toBe(SERVICE_STATUS.Created);
  expect(after.servicesTotal).toBe(before.servicesTotal);

  // Persisted.
  await page.reload();
  await expect(serviceRow(page, created.serviceName).locator(".pdt-status")).not.toHaveText("Hủy dịch vụ", {
    timeout: 20_000,
  });

  // A second restore is refused: only a cancelled line comes back.
  const again = await page.evaluate(
    async ({ url }) => {
      const xsrf = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.substring(11);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}) },
      });
      return { status: res.status, body: await res.text() };
    },
    { url: `${PLANS_API}/${created.id}/services/${before.services[0].id}/restore` },
  );
  expect(again.status).toBe(403);
  expect(again.body).toContain("BlueDental:Treatment:0067");
});

test("restoring a line refunded after its cancel warns that the refund is owed again", async ({ page }) => {
  test.setTimeout(120_000);
  const patientId = await openFirstPatient(page);
  const created = await createSlipViaApi(page, patientId, [15]);
  const slip = await readSlip(page, created.id);
  const line = slip.services[0];
  const branch = slip.clinicBranchId;

  // Paid in full, the receipt settled, then the line cancelled and part refunded.
  const staff = (await api<{ items: { id: string }[] }>(page, branch, "GET", "/api/v1/app/staff?MaxResultCount=1"))
    .items[0];
  const receipt = await api<Receipt>(page, branch, "POST", PAYMENTS_API, {
    patientId,
    clinicBranchId: branch,
    treatmentPlanId: slip.id,
    treatmentServiceIds: [line.id],
    splitMode: 1,
    items: [],
    kind: 1,
    method: 1,
    amount: line.payableAmount,
    staffId: staff.id,
  });
  await settleReceipt(page, receipt);
  await cancelLine(page, slip);
  const refundAmount = Math.max(1, Math.floor(line.payableAmount / 2));
  await api(page, branch, "POST", PAYMENTS_API, {
    patientId,
    clinicBranchId: branch,
    treatmentPlanId: slip.id,
    treatmentServiceIds: [line.id],
    kind: 2,
    method: 1,
    amount: refundAmount,
    staffId: staff.id,
  });

  const cancelled = (await readSlip(page, slip.id)).services[0];
  expect(cancelled.status).toBe(SERVICE_STATUS.Cancelled);
  expect(cancelled.refundedAmount).toBe(refundAmount);

  await page.goto(`/patient/${patientId}/treatment-plan/${slip.id}`);
  const row = serviceRow(page, created.serviceName);
  await expect(row.locator(".pdt-status")).toHaveText("Hủy dịch vụ", { timeout: 20_000 });
  await row.getByRole("button", { name: "Khôi phục dịch vụ" }).click();

  const question = restoreQuestion(page);
  await expect(question.getByRole("alert")).toHaveText(
    `Đã hoàn ${money(refundAmount)} cho dịch vụ này — khôi phục sẽ phát sinh nợ lại.`,
  );
  await question.getByRole("button", { name: "Khôi phục dịch vụ" }).click();
  await expect(page.getByText("Đã khôi phục dịch vụ")).toBeVisible();

  // Charged again: what is still owed is the refund, the receipts net of it.
  const restored = (await readSlip(page, slip.id)).services[0];
  expect(restored.status).toBe(SERVICE_STATUS.Created);
  expect(restored.paidAmount).toBe(line.payableAmount - refundAmount);
  expect(restored.outstandingAmount).toBe(refundAmount);
});
