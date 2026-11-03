import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  call,
  createOrder,
  freshSlip,
  LABO_ORDERS,
  laboCatalog,
  laboLine,
  orderBody,
  PLANS,
  serviceLine,
  type LaboLine,
  type SpecService,
} from "./fixtures/laboApi";

/**
 * R-1098 (BA Định, 2026-11-01): a line whose teeth are exactly a whole jaw
 * reads by the jaw's name — "Hàm trên", "Hàm dưới", "Hai hàm" — on the Labo
 * dialog's Răng row and in the slip's Bảo hành tab, instead of sixteen or
 * thirty-two tooth numbers. Anything short of a whole jaw still lists teeth.
 *
 * Real stack: orders and lines are made through the app's own endpoints from
 * the logged-in page, then read on screen after a fresh load. Nothing is
 * intercepted.
 */

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** A service with a warranty period, so finished lines show in the Bảo hành tab. */
const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };

async function openLaboDraft(page: Page, line: LaboLine, teeth: number[]) {
  const id = runId();
  const catalog = await laboCatalog(page, line.branchId, id);
  const draft = await createOrder(
    page,
    orderBody(catalog, line, id, { treatmentServiceId: line.lineId, teeth, quantity: teeth.length }),
  );
  expect(draft.status, draft.text).toBe(200);
  await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=labo`);
  await assertRealApiTraffic(page, LABO_ORDERS);
  await page
    .locator("tbody tr.ant-table-row")
    .filter({ has: page.getByRole("cell", { name: draft.body.orderCode!, exact: true }) })
    .getByRole("button", { name: "Xem chi tiết" })
    .click();
  return page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") }).locator(".pd-labo-teeth");
}

async function finishedLine(page: Page, planId: string, teeth: number[]) {
  const line = await serviceLine(page, { planId, service: WARRANTY_SERVICE, teeth });
  const done = await call(page, `${PLANS}/${line.planId}/services/${line.lineId}/complete`, {
    method: "POST",
    branchId: line.branchId,
  });
  expect(done.status, done.text).toBe(200);
  return line;
}

test.describe("Whole jaw read by its name (R-1098)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("Labo Đặt hàng: the upper jaw is one chip «Hàm trên», the count stays 16; two teeth stay two chips", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const line = await laboLine(page);

    const jawRow = await openLaboDraft(page, line, UPPER);
    await expect(jawRow.locator(".pd-labo-toothchip")).toHaveText(["Hàm trên"]);
    await expect(jawRow).toContainText("Số lượng: 16");
    await page.keyboard.press("Escape");

    const teethRow = await openLaboDraft(page, line, [11, 21]);
    await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R21"]);
    await expect(teethRow).toContainText("Số lượng: 2");
  });

  test("Bảo hành tab: Dịch vụ · răng reads «Hàm dưới» / «Hai hàm» for whole jaws, tooth numbers otherwise", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const planId = await freshSlip(page, runId());
    const lower = await finishedLine(page, planId, LOWER);
    await finishedLine(page, planId, [...UPPER, ...LOWER]);
    await finishedLine(page, planId, [36, 37]);

    await page.goto(`/patient/${lower.patientId}/treatment-plan/${planId}?branchId=${lower.branchId}&planTab=warranty`);
    const status = page.locator('section[aria-labelledby="pwt-status-title"]');
    const titles = status.locator("tbody tr.ant-table-row");
    // Three lines of ours plus the slip's own R18 Labo line (freshSlip).
    await expect(titles).toHaveCount(4);
    await expect(titles.filter({ hasText: "- R18" })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${WARRANTY_SERVICE.name} - Hàm dưới` })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${WARRANTY_SERVICE.name} - Hai hàm` })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${WARRANTY_SERVICE.name} - R36, R37` })).toHaveCount(1);
    await expect(status).not.toContainText("R48");
  });
});
