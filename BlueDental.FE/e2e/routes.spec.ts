import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";

test.describe("Route smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const routes = [
    { path: "/reception", marker: /tiếp nhận|reception/i },
    { path: "/patient", marker: /bệnh nhân|patient/i },
    { path: "/calendar", marker: /lịch hẹn|appointment/i },
    { path: "/cskh-grouping", marker: /cskh|chăm sóc/i },
    { path: "/labo", marker: /labo/i },
    { path: "/operations", marker: /quản trị|operation/i },
    { path: "/report", marker: /doanh số|lượt khách|quản lý thu chi/i },
    { path: "/staff", marker: /nhân viên|staff/i },
    { path: "/timekeeping", marker: /chấm công|timekeeping/i },
    { path: "/materials", marker: /vật tư|material/i },
    { path: "/billing", marker: /thanh toán|billing|hóa đơn/i },
    // The catalog screen follows the reference, which titles itself by the
    // selected catalog rather than by the word "Danh mục".
    { path: "/taxonomy", marker: /nhóm dịch vụ|dịch vụ/i },
    { path: "/tools", marker: /tổng đài|tin nhắn|zalo oa/i },
    { path: "/settings", marker: /cài đặt|setting/i },
    { path: "/organizations", marker: /chi nhánh|branch/i },
    { path: "/identity", marker: /người dùng|user|vai trò|role/i },
    { path: "/audit-logs", marker: /nhật ký|audit/i },
  ];

  for (const { path, marker } of routes) {
    test(`${path} loads without error`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const body = page.locator("body");
      await expect(body).not.toContainText("Unexpected Application Error");
      await expect(body.getByText(marker).first()).toBeVisible({ timeout: 10000 });
    });
  }
});
