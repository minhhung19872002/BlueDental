import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Bug list #18: toasts never closed and piled up after several saves.
 *
 * sonner pauses its timers while the pointer is over the toaster, which sits
 * top-center over the working area, so a hovered stack stayed for minutes.
 * ToastLifetimeGuard caps every toast at its duration plus a short grace.
 */
test.describe("Toast auto-dismiss (bug #18)", () => {
  test("stacked save toasts close by themselves even while hovered", async ({ page }) => {
    await login(page);
    await page.goto("/account/profile");

    const success = page.locator('[data-sonner-toast][data-type="success"]');
    const save = page.getByRole("button", { name: "Lưu Thay Đổi" });

    for (let i = 1; i <= 3; i++) {
      const saved = page.waitForResponse((res) => res.request().method() === "PUT");
      await save.click();
      expect((await saved).ok()).toBeTruthy();
      await expect(success).toHaveCount(i);
    }

    await success.first().hover();
    await expect(success.first()).toHaveAttribute("data-expanded", "true");

    // 4 s sonner default + 3 s hover grace, measured from the last save.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 12_000 });
  });
});
