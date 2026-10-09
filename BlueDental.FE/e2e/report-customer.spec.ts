import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";
import { BRANCH_ONE, BRANCH_TWO, call, removeTicket, syntheticPhone, TICKETS } from "./fixtures/marketingTicket";
import { createDentist, deleteDentist, openDentistSession } from "./fixtures/restrictedDentist";

/**
 * Feature: /report › Telesale - follow khách hàng (checklist 16.8) and
 * Chăm sóc khách hàng (16.11). BlueDental-local; see docs/clone/pages/report.md.
 *
 * Every call is a real HTTP request from a page logged in through the login
 * screen. Nothing is intercepted; each read-back is a separate request. The
 * ticket the spec files carries a synthetic phone and is deleted afterwards.
 */

const REPORTS = "/api/v1/app/clinic-reports";
const CARE = "/api/v1/app/care-records";
// The tabs of /cskh-grouping in order: Sau điều trị … Lịch hẹn hủy, CSKH định kì, CSKH đặc biệt, Complain.
const BOARD_TYPES = [1, 2, 3, 11, 7, 8, 9, 4, 5, 10];
const CHANNEL_MANUAL = 1;

interface StatusRow {
  total: number;
  new: number;
  inCare: number;
  booked: number;
  arrived: number;
  notPotential: number;
  overdue: number;
}

interface TelesaleReport {
  summary: StatusRow;
  byDay: (StatusRow & { date: string })[];
  bySource: StatusRow[];
  byChannel: (StatusRow & { channel: number })[];
  byCustomerType: (StatusRow & { isReturningCustomer: boolean })[];
  byFile: StatusRow[];
  byAssignee: StatusRow[];
}

interface CareRow {
  total: number;
  new: number;
  contacted: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  zaloSent: number;
}

interface CareReport {
  summary: CareRow;
  byType: (CareRow & { type: number })[];
  byOutcome: { notRated: number; good: number; fair: number; normal: number; complaint: number };
  byStaff: (CareRow & { staffId: string | null })[];
}

/** A clinic day (UTC+7) `offset` days from today, as yyyy-MM-dd. */
function clinicDay(offset = 0): string {
  return new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
}

const TODAY = clinicDay();
const MONTH_AGO = clinicDay(-30);

function telesale(page: Page, branch: string) {
  return call<TelesaleReport>(page, "GET", `${REPORTS}/telesale?clinicBranchId=${branch}&fromDate=${TODAY}&toDate=${TODAY}`, undefined, branch);
}

const manualOf = (r: TelesaleReport) => r.byChannel.find((c) => c.channel === CHANNEL_MANUAL)?.total ?? 0;
const todayOf = (r: TelesaleReport) => r.byDay.find((d) => d.date === TODAY)?.total ?? 0;

/** Status and content type of a file download, read from inside the page. */
async function download(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u, { credentials: "include", headers: { "X-Clinic-Branch-Id": "11111111-1111-1111-1111-111111111111" } });
    const bytes = (await res.arrayBuffer()).byteLength;
    return { status: res.status, type: res.headers.get("content-type") ?? "", bytes };
  }, url);
}

test.describe("Báo cáo Telesale & CSKH (API)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a new ticket counts once on its branch, in its state of today, and leaves when deleted", async ({ page }) => {
    const before = await telesale(page, BRANCH_ONE);
    expect(before.status, JSON.stringify(before.body)).toBe(200);
    const otherBefore = await telesale(page, BRANCH_TWO);

    const created = await call<{ ticket: { id: string } }>(page, "POST", TICKETS, {
      clinicBranchId: BRANCH_ONE,
      tagIds: [],
      fullName: `Khách báo cáo ${runId()}`,
      phone: syntheticPhone(),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const ticketId = created.body.ticket.id;

    try {
      const after = (await telesale(page, BRANCH_ONE)).body;
      expect(after.summary.total).toBe(before.body.summary.total + 1);
      expect(after.summary.new).toBe(before.body.summary.new + 1);
      expect(manualOf(after)).toBe(manualOf(before.body) + 1);
      expect(todayOf(after)).toBe(todayOf(before.body) + 1);
      // Every breakdown is a split of the same tickets.
      for (const slices of [after.bySource, after.byChannel, after.byCustomerType, after.byAssignee]) {
        expect(slices.reduce((sum, r) => sum + r.total, 0)).toBe(after.summary.total);
      }

      // Branch 2 never sees a branch 1 ticket.
      expect((await telesale(page, BRANCH_TWO)).body.summary.total).toBe(otherBefore.body.summary.total);

      // Counted in the state it is in now, not the one it was received in.
      const lost = await call(page, "POST", `${TICKETS}/${ticketId}/not-potential`, { reason: "Báo cáo e2e" });
      expect(lost.status, JSON.stringify(lost.body)).toBe(200);
      const moved = (await telesale(page, BRANCH_ONE)).body;
      expect(moved.summary.total).toBe(after.summary.total);
      expect(moved.summary.new).toBe(after.summary.new - 1);
      expect(moved.summary.notPotential).toBe(after.summary.notPotential + 1);
    } finally {
      await removeTicket(page, ticketId);
    }

    const gone = (await telesale(page, BRANCH_ONE)).body;
    expect(gone.summary.total).toBe(before.body.summary.total);
  });

  test("the care report lists the ten board types and adds up to each /cskh-grouping tab", async ({ page }) => {
    const res = await call<CareReport>(
      page,
      "GET",
      `${REPORTS}/customer-care?clinicBranchId=${BRANCH_ONE}&fromDate=${MONTH_AGO}&toDate=${TODAY}`,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const report = res.body;

    expect(report.byType.map((r) => r.type)).toEqual(BOARD_TYPES);
    const sum = (key: keyof CareRow) => report.byType.reduce((s, r) => s + r[key], 0);
    for (const key of ["total", "new", "contacted", "succeeded", "failed", "cancelled", "zaloSent"] as const) {
      expect(report.summary[key], key).toBe(sum(key));
    }
    for (const row of report.byType) {
      expect(row.new + row.contacted + row.succeeded + row.failed + row.cancelled).toBe(row.total);
    }
    expect(report.byStaff.reduce((s, r) => s + r.total, 0)).toBe(report.summary.total);
    const o = report.byOutcome;
    expect(o.notRated + o.good + o.fair + o.normal + o.complaint).toBe(report.summary.succeeded);

    // Same window, same branch: each row is what that tab of the board lists.
    const from = encodeURIComponent(`${MONTH_AGO}T00:00:00+07:00`);
    const to = encodeURIComponent(`${TODAY}T23:59:59.9999999+07:00`);
    for (const row of report.byType) {
      const tab = await call<{ totalCount: number }>(
        page,
        "GET",
        `${CARE}?type=${row.type}&branchId=${BRANCH_ONE}&fromDate=${from}&toDate=${to}&maxResultCount=1`,
      );
      expect(tab.status).toBe(200);
      expect(row.total, `care type ${row.type}`).toBe(tab.body.totalCount);
    }
  });

  test("both reports export to Excel", async ({ page }) => {
    for (const path of ["telesale/excel", "customer-care/excel"]) {
      const file = await download(page, `${REPORTS}/${path}?clinicBranchId=${BRANCH_ONE}&fromDate=${MONTH_AGO}&toDate=${TODAY}`);
      expect(file.status, path).toBe(200);
      expect(file.type).toContain("spreadsheetml");
      expect(file.bytes).toBeGreaterThan(1000);
    }
  });

  test("a branch 2 user cannot read branch 1", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, BRANCH2_USER);
      const own = await telesale(page, BRANCH_TWO);
      expect(own.status).toBe(200);
      const crossTelesale = await call(page, "GET", `${REPORTS}/telesale?clinicBranchId=${BRANCH_ONE}`, undefined, BRANCH_TWO);
      expect(crossTelesale.status).toBe(403);
      const crossCare = await call(page, "GET", `${REPORTS}/customer-care?clinicBranchId=${BRANCH_ONE}`, undefined, BRANCH_TWO);
      expect(crossCare.status).toBe(403);
    } finally {
      await context.close();
    }
  });

  test("a user without the report grants is refused", async ({ page, browser }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const id = runId();
    const userName = `bsbc${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI BAO CAO ${id}`;
    await createDentist(page, fullName, userName, password);

    const dentist = await openDentistSession(browser, userName, password);
    try {
      for (const path of ["telesale", "customer-care", "telesale/excel", "customer-care/excel"]) {
        const res = await call(dentist.page, "GET", `${REPORTS}/${path}?fromDate=${TODAY}&toDate=${TODAY}`);
        expect(res.status, path).toBe(403);
      }
    } finally {
      await dentist.context.close();
      await deleteDentist(page, fullName);
    }
  });
});

test.describe("Báo cáo Telesale & CSKH (UI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("Telesale tab draws its charts and tables from the real API", async ({ page }) => {
    const traffic = assertRealApiTraffic(page, `${REPORTS}/telesale`);
    await page.goto("/report?reportTab=telesale&report_dateMode=month");
    await traffic;

    await expect(page.getByText("Telesale - follow khách hàng").first()).toBeVisible();
    for (const title of [
      "Ticket tiếp nhận theo thời gian",
      "Tình trạng xử lý",
      "Theo nguồn dữ liệu",
      "Hiệu quả theo file import",
    ]) {
      await expect(page.locator(".report-chart-card").filter({ hasText: title }).first()).toBeVisible();
    }
    await expect(page.getByText("Tổng ticket").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Xuất Excel/ })).toBeVisible();
    await expect(page.locator(".report-breakdown-tabs .ant-table").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("Chăm sóc khách hàng tab lists every care type with its counts", async ({ page }) => {
    const traffic = assertRealApiTraffic(page, `${REPORTS}/customer-care`);
    await page.goto("/report?reportTab=care&report_dateMode=month");
    await traffic;

    await expect(page.locator(".report-chart-card").filter({ hasText: "Theo loại hình chăm sóc" }).first()).toBeVisible();
    await expect(page.locator(".report-chart-card").filter({ hasText: "Đánh giá sau chăm sóc" })).toBeVisible();
    const table = page.locator(".report-breakdown-tabs .ant-table").first();
    for (const type of ["Sau điều trị", "Nhắc lịch hẹn", "Đặt lịch không đến", "Lịch hẹn hủy", "Complain"]) {
      await expect(table.getByRole("cell", { name: type, exact: true })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Theo nhân viên chăm sóc" }).click();
    await expect(page.locator(".report-breakdown-tabs .ant-table:visible")).toBeVisible();
  });
});
