import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Lịch hẹn.
 *
 * The appointment feature spoke a contract the server never had, so nothing it
 * sent could have been stored. These tests only pass if a booking round-trips
 * through the real API.
 */
test.describe("Lịch hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /**
   * A slot the clinic cannot already have taken: the double-booking guard is
   * real, so each run books its own future day.
   */
  function uniqueDay(): string {
    // A day another run already booked would make even the first booking clash,
    // so the window is wide enough that a collision practically never happens.
    const offset = 1 + Math.floor(Math.random() * 5000);
    const day = new Date();
    day.setDate(day.getDate() + offset);

    const dd = String(day.getDate()).padStart(2, "0");
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${day.getFullYear()}`;
  }

  /** Fills the editor and saves; the caller asserts what happened. */
  async function book(page: Page, day: string, reason: string): Promise<void> {
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog");

    // Both pickers read the real patient and staff lists. SearchSelect is
    // BlueDental's own component, so it is driven by its roles.
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();

    // Order is Ngày hẹn, Giờ bắt đầu, Giờ kết thúc; antd commits on Enter.
    const date = dialog.locator(".ant-picker-input input").first();
    await date.fill(day);
    await date.press("Enter");

    const time = dialog.locator(".ant-picker-input input").nth(1);
    await time.fill("09:00");
    await time.press("Enter");

    await dialog.getByPlaceholder("Nhập lý do khám").fill(reason);
    await dialog.getByRole("button", { name: /Lưu lịch hẹn/ }).click();
  }

  /**
   * The booking lands on a random day years out, so it is never guaranteed to be
   * on the first page. Searching for it is what proves it was stored — and the
   * search runs on the server, over every appointment rather than one page.
   */
  async function findInList(page: Page, reason: string): Promise<void> {
    await page
      .getByPlaceholder("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...")
      .fill(reason);

    await expect(page.getByRole("row", { name: new RegExp(reason) })).toBeVisible({
      timeout: 15_000,
    });
  }

  test("a booking is stored and appears in the list", async ({ page }) => {
    const reason = `Khám E2E ${runId()}`;

    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, "/api/v1/app/appointments");

    await book(page, uniqueDay(), reason);
    await expect(page.getByRole("dialog")).toBeHidden();

    // The list is served by the API, so the row proves it was stored.
    await findInList(page, reason);

    await page.reload();
    await findInList(page, reason);
  });

  test("the same dentist cannot be booked twice into one slot", async ({ page }) => {
    const day = uniqueDay();

    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, "/api/v1/app/appointments");

    await book(page, day, `Khám lần đầu ${runId()}`);
    await expect(page.getByRole("dialog")).toBeHidden();

    // Same dentist, same day, same time — the server refuses it.
    await book(page, day, `Khám trùng giờ ${runId()}`);
    await expect(page.getByText("Khung giờ này đã có lịch.").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("the calendar grids read their own date range from the server", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/app/appointments")) requests.push(req.url());
    });

    await page.goto("/calendar");
    await assertRealApiTraffic(page, "/api/v1/app/appointments");

    // The day grid asks for one day...
    await expect.poll(() => requests.some((url) => url.includes("date="))).toBe(true);

    // ...and the week grid for a week. The switcher is an antd Segmented.
    await page.getByText("Tuần", { exact: true }).first().click();
    await expect
      .poll(() => requests.some((url) => url.includes("fromDate=") && url.includes("toDate=")))
      .toBe(true);
  });
});
