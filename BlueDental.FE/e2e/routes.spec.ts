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
    // Chấm công has no address of its own: it is the calendar's work tab.
    { path: "/calendar?tab=timekeeping", marker: /chấm công|lịch làm việc/i },
    { path: "/materials", marker: /vật tư|material/i },
    { path: "/billing", marker: /thanh toán|billing|hóa đơn/i },
    // The catalog screen follows the reference, which titles itself by the
    // selected catalog rather than by the word "Danh mục".
    { path: "/taxonomy", marker: /nhóm dịch vụ|dịch vụ/i },
    { path: "/tools", marker: /tổng đài|tin nhắn|zalo oa/i },
    // The screen titles itself by the account section it opens on, not by the
    // word "Cài đặt" — which used to be matched on the old rail's menu entry.
    { path: "/settings", marker: /hồ sơ|thông tin cá nhân/i },
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

  // Bug list #38: an unknown address used to render the crash screen
  // ("Đã xảy ra lỗi ngoài dự kiến") and log "Lỗi điều hướng: null".
  for (const path of ["/catalog", "/patients"]) {
    test(`${path} shows the 404 page inside the shell`, async ({ page }) => {
      const routeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("Lỗi điều hướng")) routeErrors.push(message.text());
      });

      await page.goto(path);

      await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
      await expect(page.getByText("Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Đã xảy ra lỗi ngoài dự kiến");
      // The shell's menu stays, so the user can move on from it.
      await expect(page.locator(".app-header")).toBeVisible();
      expect(routeErrors).toEqual([]);

      await page.getByRole("button", { name: "Về trang chủ" }).click();
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByText("Không tìm thấy trang")).toHaveCount(0);
    });
  }

  // A settings tab that does not exist opens the first tab, not "Không có
  // quyền truy cập" — that answer is kept for a real tab the account may not
  // use (role-permissions.spec). The address is corrected, other params kept.
  test("/settings with an unknown tab opens the first tab", async ({ page }) => {
    await page.goto("/settings?tab=abc&x=1");

    await expect(page).toHaveURL(/[?&]tab=info(&|$)/);
    await expect(page).toHaveURL(/[?&]x=1(&|$)/);
    await expect(page.locator(".profile-sidebar-item--active")).toHaveText(/Thông tin cá nhân/);
    await expect(page.getByText("Không có quyền truy cập")).toHaveCount(0);
  });
});
