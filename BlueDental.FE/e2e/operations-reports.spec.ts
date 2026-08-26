import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Feature: the Vận hành report sub-tabs.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. Each of
 * these reads tables another feature owns, so the assertions are about the
 * shape the reference gives each screen and about the server actually answering
 * — not about particular seeded rows, which move as the demo clinic is rebuilt.
 */
test.describe("Vận hành — báo cáo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Báo cáo lists work across the clinic and filters by action", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    for (const heading of ["Ngày / Khách hàng", "Nhân sự", "Hành động", "Doanh số"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    // The server answered with rows, not an empty screen.
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    const all = await page.locator("tbody tr.ant-table-row").count();

    // Every action is selected to begin with, as the reference leaves it, so
    // narrowing means clearing them and picking one back.
    const actions = page.getByLabel("Hành động");
    await actions.click();
    await page.locator(".ant-select-clear").click();
    await actions.click();
    await page
      .locator(".ant-select-dropdown:visible .ant-select-item-option")
      .filter({ hasText: /^Chẩn đoán$/ })
      .click();
    await page.keyboard.press("Escape");

    await expect
      .poll(async () => page.locator("tbody tr.ant-table-row").count())
      .toBeLessThanOrEqual(all);
    // Only diagnosis groups survive, and each names its own count.
    await expect(page.locator(".bd-ops-action").first()).toHaveText(/^Chẩn đoán \(\d+\)$/);
  });

  test("Chẩn đoán chưa điều trị only lists diagnoses with no treatment", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=untreated");

    for (const heading of ["Ngày", "Khách hàng", "Răng", "Chẩn đoán"]) {
      await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    // No category panel here: this sub-tab is a report, not the article screen.
    await expect(page.getByRole("button", { name: /Thêm Mới$/ })).toHaveCount(0);
  });

  test("Đơn thuốc says what the reference says: not built yet", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=prescription");

    await expect(page.getByText("Nội dung đang được xây dựng.")).toBeVisible();
    // The period switch is still there, as it is on the reference.
    await expect(page.getByRole("tab", { name: "Ngày", exact: true })).toBeVisible();
  });

  test("Khách hàng phát sinh totals each consultant, and stops at Tháng", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=customer-report");

    for (const heading of ["Nhân sự tư vấn", "Tổng lượt tư vấn", "Doanh thu từ tư vấn"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    // The reference offers no Năm on this report.
    await expect(page.getByRole("tab", { name: "Tháng", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Năm", exact: true })).toHaveCount(0);
  });

  test("Hóa đơn lists invoices with their money split out", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=invoice");

    for (const heading of ["Số hóa đơn", "Tổng trước VAT", "Tổng VAT", "Tổng tiền"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
  });

  test("Hoàn thành theo dịch vụ shows its five figures over the service lines", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=service-complete");

    for (const label of [
      "Thực thu",
      "Tổng doanh thu",
      "Doanh thu từ KH tạm ứng",
      "Dịch vụ hoàn thành",
      "Dịch vụ doanh số riêng",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    await expect(page.getByText(/Hiển thị .* dịch vụ/)).toBeVisible();
  });

  test("Truy cập filters by the card that is picked", async ({ page }) => {
    await page.goto("/operations/treatment?treatmentTab=access");

    const total = page.getByRole("button", { name: /Tổng doanh số/ });
    const completed = page.getByRole("button", { name: /Dịch vụ đã hoàn thành/ });

    await expect(total).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    const everything = await page.locator("tbody tr.ant-table-row").count();

    await completed.click();
    await expect(completed).toHaveAttribute("aria-pressed", "true");

    // Only finished lines survive, so the list can only shrink — and every
    // classification cell left must be the finished one.
    await expect.poll(async () => page.locator("tbody tr.ant-table-row").count()).toBeLessThanOrEqual(everything);
    await expect(page.locator(".bd-ops-pill--own")).toHaveCount(0);
  });

  test("the period switch re-reads the server", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=service-complete");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();

    const monthly = await page.getByText(/Hiển thị .* dịch vụ/).innerText();

    // One day holds less than a whole month, so the summary has to change.
    await page.getByRole("tab", { name: "Ngày", exact: true }).click();
    await expect
      .poll(async () => page.getByText(/Hiển thị .* dịch vụ/).innerText())
      .not.toBe(monthly);
  });

  test("the period date opens a picker at the right granularity", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    const picker = page.locator(".bd-ops-period-picker input");

    // Tháng is the default, so the picker opens on months.
    await picker.click();
    await expect(page.locator(".ant-picker-month-panel")).toBeVisible();
    await page.keyboard.press("Escape");

    // Năm opens on years instead.
    await page.getByRole("tab", { name: "Năm", exact: true }).click();
    await picker.click();
    await expect(page.locator(".ant-picker-year-panel")).toBeVisible();
    await page.keyboard.press("Escape");

    // And Ngày on days.
    await page.getByRole("tab", { name: "Ngày", exact: true }).click();
    await picker.click();
    await expect(page.locator(".ant-picker-date-panel")).toBeVisible();
  });

  test("the selected period keeps its white label while hovered", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    const active = page.locator(".bd-ops-period-option--active");
    const colourOf = () =>
      active.evaluate((el) => getComputedStyle(el).color);

    const resting = await colourOf();
    await active.hover();

    // White on blue either way: repainting it on hover made it unreadable.
    expect(await colourOf()).toBe(resting);
    expect(resting).toBe("rgb(255, 255, 255)");
  });

  test("Báo cáo groups its rows by visit and by action", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    const firstVisitCell = page.locator("tbody tr.ant-table-row td").first();
    await expect(firstVisitCell).toBeVisible();

    // The visit cell spans its whole block, and carries the three steps.
    expect(await firstVisitCell.evaluate((td) => (td as HTMLTableCellElement).rowSpan))
      .toBeGreaterThan(1);
    for (const step of ["Đã đến", "Đang khám", "Hoàn tất"]) {
      await expect(firstVisitCell.getByText(step)).toBeVisible();
    }

    // An action cell names its kind and counts what is under it.
    const action = page.locator(".bd-ops-action").first();
    await expect(action).toHaveText(/^.+ \(\d+\)$/);

    // The one figure the reference puts on this screen.
    await expect(page.getByText("Doanh số chốt kế hoạch")).toBeVisible();
  });

  test("the reports filter by staff and by invoice status", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=untreated");
    await expect(page.getByLabel("Người tạo")).toBeVisible();

    await page.goto("/operations/finance?financeSubTab=invoice");
    await expect(page.getByLabel("Tất cả trạng thái")).toBeVisible();

    await page.goto("/operations/finance?financeSubTab=customer-report");
    await expect(page.getByRole("heading", { name: "Báo cáo khách hàng phát sinh" })).toBeVisible();
    await expect(page.getByLabel("Nhân sự tư vấn")).toBeVisible();
  });

  test("Báo cáo is laid out per division, as the reference lays it out", async ({ page }) => {
    // Quản trị vận hành: all three filters, the figure at the far end, and the
    // pager naming what it counts.
    await page.goto("/operations/overview?overviewSubTab=report");
    await expect(page.getByLabel("Người tạo")).toBeVisible();
    await expect(page.getByLabel("Hành động")).toBeVisible();
    await expect(page.getByLabel("Tìm kiếm khách hàng")).toBeVisible();
    await expect(page.getByText(/Hiển thị .* công việc/)).toBeVisible();

    // Khối CSKH is the same screen.
    await page.goto("/operations/cskh?cskhSubTab=report");
    await expect(page.getByLabel("Hành động")).toBeVisible();

    // Khối lễ tân narrows to one filter and drops the noun from the pager.
    await page.goto("/operations/reception?receptionSubTab=report");
    await expect(page.getByLabel("Người tạo")).toBeVisible();
    await expect(page.getByLabel("Hành động")).toHaveCount(0);
    await expect(page.getByLabel("Tìm kiếm khách hàng")).toHaveCount(0);
    await expect(page.getByText(/Hiển thị .* công việc/)).toHaveCount(0);
    await expect(page.getByText(/^Hiển thị/)).toBeVisible();

    // Khối điều trị offers no filter at all, and stands its figure on the left.
    await page.goto("/operations/treatment?treatmentSubTab=report");
    await expect(page.getByLabel("Người tạo")).toHaveCount(0);
    await expect(page.locator(".bd-ops-report-head--start")).toBeVisible();
    await expect(page.getByText("Doanh số chốt kế hoạch")).toBeVisible();
  });

  test("the period switch sits in the tab row above the report", async ({ page }) => {
    // No middle row: it belongs to the sub-tab row.
    await page.goto("/operations/overview?overviewSubTab=report");
    await expect(page.locator(".bd-ops-subtabs .bd-ops-period")).toBeVisible();

    // With a middle row, it belongs there instead.
    await page.goto("/operations/treatment?treatmentTab=access");
    await expect(page.locator(".bd-ops-middletabs .bd-ops-period")).toBeVisible();
    await expect(page.locator(".bd-ops-subtabs .bd-ops-period")).toHaveCount(0);
  });

  test("the rows scroll inside the table, under a header that stays put", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();

    const body = page.locator(".bd-cat-card .ant-table-content");
    const header = page.locator(".bd-cat-card thead th").first();

    // antd writes `overflow: auto hidden` inline here, which used to pin the
    // list open and push its last rows out of reach.
    expect(await body.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight + 2)).toBe(true);

    const headerTop = await header.evaluate((el) => el.getBoundingClientRect().top);
    await body.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // The header did not move, and everything below is now reachable.
    expect(
      await header.evaluate((el) => el.getBoundingClientRect().top),
    ).toBeCloseTo(headerTop, 0);
    await expect(page.locator("tbody tr.ant-table-row").last()).toBeInViewport();
    await expect(page.locator(".ant-pagination").first()).toBeInViewport();
  });

  test("the visit cell is centred against the block it spans", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    const cell = page.locator("tbody tr.ant-table-row td").first();
    await expect(cell).toBeVisible();

    expect(await cell.evaluate((td) => getComputedStyle(td).verticalAlign)).toBe("middle");
  });
});
