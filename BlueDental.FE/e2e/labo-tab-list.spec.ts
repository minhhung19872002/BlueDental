import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  LABO_ORDERS,
  call,
  createOrder,
  laboCatalog,
  laboLine,
  orderBody,
  sentOrder,
  type LaboLine,
  type Paged,
} from "./fixtures/laboApi";

/**
 * Feature: hồ sơ bệnh nhân → tab Labo — the dialog kept in the URL and the
 * list paged and filtered on the server (P2910_03, F-85). Rewritten from
 * labo-warranty.spec.ts, whose Đặt mới → Bảo hành child-order test went with
 * the child orders themselves: warranty is now per-tooth cards on the same
 * order, covered by labo-workflow.spec.ts.
 *
 * Real stack: the browser logs in through the login screen, the orders are
 * created through the endpoints the dialog posts to, and every list and
 * counter is the server's. Nothing is intercepted.
 */

interface LaboStats {
  total: number;
  draft: number;
  returned: number;
  awaitingCheck: number;
}

const PAGE = 10;
/** LaboStatusFilter.Draft — the first card, Nháp. */
const DRAFT_FILTER = 1;

function laboRows(page: Page) {
  return page.locator(".pd-pane--fill tbody tr.ant-table-row");
}

function workflowDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
}

function laboTabUrl(line: LaboLine, extra = "") {
  return `/patient/${line.patientId}?branchId=${line.branchId}&tab=labo${extra}`;
}

async function readStats(page: Page, line: LaboLine): Promise<LaboStats> {
  const stats = await call<LaboStats>(page, `${LABO_ORDERS}/stats?patientId=${line.patientId}`, {
    branchId: line.branchId,
  });
  expect(stats.status, stats.text).toBe(200);
  return stats.body as LaboStats;
}

async function countOrders(page: Page, line: LaboLine): Promise<number> {
  const list = await call<Paged<unknown>>(page, `${LABO_ORDERS}?patientId=${line.patientId}&maxResultCount=1`, {
    branchId: line.branchId,
  });
  expect(list.status, list.text).toBe(200);
  return list.body.totalCount ?? 0;
}

/** The list request the tab sends, matched on the paging and filter it carries. */
function laboListRequest(page: Page, query: Record<string, number>) {
  return page.waitForResponse((res) => {
    const url = new URL(res.url());
    if (!url.pathname.endsWith(LABO_ORDERS)) return false;
    return Object.entries(query).every(([key, value]) => url.searchParams.get(key) === String(value));
  });
}

test.describe("Patient Labo tab — URL and server paging", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the dialog lives in the URL: a reload reopens it, closing clears it", async ({ page }) => {
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const sent = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    // A sent order with no step named opens on Nhận hàng & kiểm tra.
    await page.goto(laboTabUrl(line, `&laboModal=order&laboRowId=${sent.id}`));
    const dialog = workflowDialog(page);
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Nhận hàng & kiểm tra");

    // Picking a tab writes it to the URL, and a reload lands on it again.
    await dialog.getByRole("tab", { name: /Đặt hàng/ }).click();
    await expect(page).toHaveURL(/laboStep=order/);
    await page.reload();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Đặt hàng");
    await expect(dialog.locator(`input[value="${sent.orderCode}"]`)).toBeVisible();

    await dialog.locator(".pd-labo-step-footer").getByRole("button", { name: "Huỷ", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=|laboRowId=|laboStep=/);
    await expect(page).toHaveURL(/tab=labo/);
  });

  test("pages, counts and filters on the server, not on the page", async ({ page }) => {
    test.setTimeout(180_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);

    // Two pages of ten, with at least one Nháp: topped up through the real API.
    const before = await countOrders(page, line);
    for (let n = 0; n < Math.max(1, PAGE + 1 - before); n++) {
      const made = await createOrder(page, orderBody(catalog, line, `${id}${n}`));
      expect(made.status, made.text).toBe(200);
    }
    const stats = await readStats(page, line);
    expect(stats.total).toBeGreaterThan(PAGE);

    await page.goto(laboTabUrl(line));
    await assertRealApiTraffic(page, LABO_ORDERS);
    const pane = page.locator(".pd-pane--fill");
    const cards = pane.locator(".pd-stat");
    const pagerText = pane.locator(".ant-pagination-total-text");

    // ── The counters are the server's, over the whole record ──────────────
    await expect(cards.nth(0).locator("strong")).toHaveText(String(stats.draft));
    await expect(cards.nth(1).locator("strong")).toHaveText(String(stats.returned));
    await expect(cards.nth(2).locator("strong")).toHaveText(String(stats.awaitingCheck));

    // ── Page size 10: the server is asked for ten from the top ────────────
    const firstPage = laboListRequest(page, { skipCount: 0, maxResultCount: PAGE });
    await pane.locator(".ant-pagination-options .ant-select").click();
    await page.getByRole("option", { name: `${PAGE} / trang`, exact: true }).click();
    await firstPage;
    await expect(laboRows(page)).toHaveCount(PAGE);
    await expect(pagerText).toHaveText(`Hiển thị 1–${PAGE} trên ${stats.total} phiếu labo`);

    // ── Page 2: the server is asked for the next ten ─────────────────────
    const secondPage = laboListRequest(page, { skipCount: PAGE, maxResultCount: PAGE });
    await pane.locator(".ant-pagination-item-2").click();
    await secondPage;
    const onSecond = Math.min(PAGE, stats.total - PAGE);
    await expect(laboRows(page)).toHaveCount(onSecond);
    await expect(pagerText).toHaveText(`Hiển thị ${PAGE + 1}–${PAGE + onSecond} trên ${stats.total} phiếu labo`);

    // ── Nháp filters on the server and goes back to page 1 ───────────────
    const filtered = laboListRequest(page, { statusFilter: DRAFT_FILTER, skipCount: 0, maxResultCount: PAGE });
    await cards.nth(0).click();
    await filtered;
    await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(pagerText).toContainText(`trên ${stats.draft} phiếu labo`);
    await expect(laboRows(page)).toHaveCount(Math.min(PAGE, stats.draft));
    // Every row on the page is a Nháp; the counters still count the whole record.
    await expect(laboRows(page).locator("td:nth-child(4)").filter({ hasNotText: "Nháp" })).toHaveCount(0);
    await expect(cards.nth(1).locator("strong")).toHaveText(String(stats.returned));

    // ── Pressing it again clears the filter ──────────────────────────────
    await cards.nth(0).click();
    await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(pagerText).toHaveText(`Hiển thị 1–${PAGE} trên ${stats.total} phiếu labo`);
  });
});
