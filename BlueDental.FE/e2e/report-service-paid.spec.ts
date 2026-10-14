import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { PAYMENTS_API, call, collectOnFirstLine, money, openNewSlip, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 31 (QA, 2026-10-14): Báo cáo › Doanh số và lượt khách ›
 * "Khách hàng phát sinh dịch vụ" read 0 đ in "Đã thanh toán" on every line.
 *
 * A line's Đã thanh toán is what its slip has really collected for it, less
 * refunds, whenever the money moved — not only inside the report period (owner
 * 2026-10-14) — the same figure the plan detail shows as "Đã thu".
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const SERVICE_LINES_API = "/api/v1/app/clinic-reports/service-lines";
const EARLIER_PAYMENT = 3;
const REFUND = 1;

interface ServiceLine {
  id: string;
  ticketCode: string;
  paidAmount: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** One more receipt (or refund) on the receipt's first line, through the real API. */
async function moveMoney(
  page: Page,
  receipt: Receipt,
  kind: 1 | 2,
  amount: number,
  paidAt?: Date,
): Promise<void> {
  const res = await call(page, PAYMENTS_API, {
    method: "POST",
    json: {
      patientId: receipt.patientId,
      clinicBranchId: receipt.clinicBranchId,
      treatmentPlanId: receipt.treatmentPlanId,
      treatmentServiceIds: [receipt.lines[0].treatmentServiceId],
      splitMode: 1,
      items: [],
      kind,
      method: 1,
      amount,
      staffId: receipt.staffId,
      ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("31 · Đã thanh toán of a service line is what its slip collected, less refunds, whenever paid", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // Today's slip, half its line collected the way the cashier does it.
  await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  const receipt = await collectOnFirstLine(page);
  const lineId = receipt.lines[0].treatmentServiceId;

  // A receipt dated yesterday — outside a "today" report — and a small refund.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await moveMoney(page, receipt, 1, EARLIER_PAYMENT, yesterday);
  await moveMoney(page, receipt, 2, REFUND);
  const expected = receipt.amount + EARLIER_PAYMENT - REFUND;

  // Server: today's report carries the net figure for the line.
  const today = isoDay(new Date());
  const lines = await call(page, `${SERVICE_LINES_API}?fromDate=${today}&toDate=${today}`);
  expect(lines.status).toBe(200);
  const line = (lines.body as unknown as ServiceLine[]).find((l) => l.id === lineId);
  expect(line, "the new slip's line is in today's report").toBeDefined();
  expect(line?.paidAmount).toBe(expected);

  // Screen: the default view (Ngày, today, "Khách hàng phát sinh dịch vụ").
  const traffic = assertRealApiTraffic(page, SERVICE_LINES_API);
  await page.goto("/report");
  await traffic;
  const row = page.locator(`tr.ant-table-row[data-row-key="${lineId}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  const paidCell = row.locator("td").last();
  await expect.poll(async () => money(await paidCell.innerText())).toBe(expected);

  // Still there after a full reload.
  await page.reload();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => money(await paidCell.innerText())).toBe(expected);
});
