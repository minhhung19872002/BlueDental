import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Kế hoạch điều trị + Hóa đơn.
 *
 * The TreatmentPlanPanel component is built but the PatientProfilePage renders
 * an inline placeholder for the treatment plan tab. The "Tạo kế hoạch mới"
 * button has no onClick handler. These tests verify the layout renders
 * correctly with data from the real API.
 */
test.describe("Kế hoạch điều trị", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function openFirstPatient(page: Page): Promise<void> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    await firstName.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  }

  test("the treatment plan tab renders its layout and table", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();

    // The tab renders TreatmentPlanPanel: a slip is opened from accepted
    // consulting lines, so the action is "Tạo kế hoạch mới".
    await expect(page.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible();

    // Summary cards: what is being worked, and the slip behind it.
    await expect(page.getByText("DỊCH VỤ ĐANG ĐIỀU TRỊ", { exact: true })).toBeVisible();
    await expect(page.getByText("DỊCH VỤ CÓ CÔNG ĐOẠN GẦN NHẤT", { exact: true })).toBeVisible();

    // One row per service line, on the app's own table card.
    await expect(page.getByRole("columnheader", { name: "Số phiếu" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Trạng thái - Tiến độ" })).toBeVisible();

    // The card fills the rest of the screen, pager pinned to its bottom edge.
    const cardBox = await page.locator(".pd-pane .bd-cat-card").boundingBox();
    const pageBox = await page.locator(".pd-page").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(pageBox).not.toBeNull();
    expect(cardBox!.y + cardBox!.height).toBeGreaterThan(pageBox!.y + pageBox!.height - 8);
  });

  test("the treatment plan tab loads plan data from the API", async ({ page }) => {
    // Watched from the first navigation: the record and its plan tab share a
    // query cache, so the read may already have gone out by the time the tab
    // is clicked. The panel reads treatment *slips* — `/patient-treatments` —
    // not the `/treatment-plans` collection this used to watch, which is why it
    // never saw a request.
    const requests: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/patient-treatments")) requests.push(`${res.status()} ${res.url()}`);
    });

    await openFirstPatient(page);
    await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
    await expect(page.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((line) => line.startsWith("200"))).toBeTruthy();
  });

  test("the invoice tab renders its layout", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Hóa đơn" }).click();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("the diagnosis tab renders correctly", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});
