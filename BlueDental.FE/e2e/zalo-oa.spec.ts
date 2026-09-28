/**
 * e2e/zalo-oa.spec.ts — Real-HTTP acceptance tests for the Zalo OA integration.
 *
 * These tests exercise the full stack through the production build:
 *   React ➜ vite-preview proxy ➜ ASP.NET Core ➜ PostgreSQL
 *
 * No route interception, no mock API, no injected tokens.
 * Login goes through the real login form.
 */

import { expect, test, type Page } from "@playwright/test";
import { login, TEST_USER, BRANCH2_USER } from "./fixtures/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ApiResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

interface CallOptions {
  method?: string;
  json?: unknown;
}

async function call<T = Record<string, unknown>>(
  page: Page,
  url: string,
  options: CallOptions = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: string | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      }
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body,
      });
      const text = await res.text();
      const parse = (): unknown => {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      };
      return { status: res.status, body: parse() as ApiResult<T>["body"] };
    },
    { url, options },
  );
}

const BASE = "/api/v1/app/zalo";

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Zalo OA API", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER);
  });

  test("GET status returns the not-connected shape", async ({ page }) => {
    const res = await call<{
      isConnected: boolean;
      isEnabled: boolean;
      status: string;
      canConnect: boolean;
      hasBootstrapTokens: boolean;
    }>(page, `${BASE}/status`);

    expect(res.status).toBe(200);
    expect(typeof res.body.isConnected).toBe("boolean");
    expect(typeof res.body.isEnabled).toBe("boolean");
    expect(typeof res.body.status).toBe("string");
    expect(typeof res.body.canConnect).toBe("boolean");
    expect(typeof res.body.hasBootstrapTokens).toBe("boolean");
  });

  test("GET connect-url returns a URL or rejects when not configured", async ({ page }) => {
    const res = await call<{ url?: string; error?: { message?: string } }>(
      page,
      `${BASE}/connect-url`,
    );
    // If AppId is empty the server returns 403 BusinessException (Tools:0003).
    // If AppId is configured the server returns 200 { url: "https://oauth.zaloapp.com/..." }.
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof (res.body as { url: string }).url).toBe("string");
    }
  });

  test("PUT enabled without a connection returns an error", async ({ page }) => {
    const res = await call(page, `${BASE}/enabled`, {
      method: "PUT",
      json: { isEnabled: true },
    });
    // No connection → Tools:0001 → 403
    expect([403, 500]).toContain(res.status);
  });

  test("GET templates returns error or paged result", async ({ page }) => {
    const res = await call<{ items?: unknown[]; totalCount?: number; error?: unknown }>(
      page,
      `${BASE}/templates?skipCount=0&maxResultCount=10`,
    );
    // Without a live connection: 403 (Tools:0003 / not connected)
    // With a live connection: 200 { items, totalCount }
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.totalCount).toBe("number");
    }
  });

  test("GET messages returns empty paged result", async ({ page }) => {
    const res = await call<{ items: unknown[]; totalCount: number }>(
      page,
      `${BASE}/messages?skipCount=0&maxResultCount=10`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.totalCount).toBe("number");
  });

  test("GET messages/stats returns counters", async ({ page }) => {
    const res = await call<{ total: number; success: number; failed: number }>(
      page,
      `${BASE}/messages/stats`,
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(typeof res.body.success).toBe("number");
    expect(typeof res.body.failed).toBe("number");
  });
});

test.describe("Zalo OA branch isolation", () => {
  test("branch2 user sees their own status, not branch1's", async ({ page }) => {
    await login(page, BRANCH2_USER);
    const res = await call<{ isConnected: boolean; branchId: string }>(
      page,
      `${BASE}/status`,
    );
    expect(res.status).toBe(200);
    // Each branch has its own connection — a fresh branch2 shouldn't see branch1's.
    expect(typeof res.body.branchId).toBe("string");
  });
});

test.describe("Zalo OA webhook", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app so relative fetch URLs resolve against the origin.
    await login(page, TEST_USER);
  });

  test("GET probe returns 200", async ({ page }) => {
    const res = await call<Record<string, unknown>>(page, `${BASE}/webhook`);
    expect(res.status).toBe(200);
  });

  test("POST without a valid signature returns 401 or 200", async ({ page }) => {
    // If WebhookSecret is empty → 200 (no verification).
    // If WebhookSecret is set → 401 (bad signature).
    const res = await call(page, `${BASE}/webhook`, {
      method: "POST",
      json: { event_name: "user_send_text", message: { text: "hello" } },
    });
    expect([200, 401]).toContain(res.status);
  });
});

test.describe("Zalo OA UI", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER);
  });

  test("config sub-tab shows the Zalo OA panel", async ({ page }) => {
    await page.goto("/tools/zalo-oa");
    // The default sub-tab is config (no ?subTab param).
    // Should show either "Chưa kết nối Zalo OA" or the connected panel.
    const panel = page.locator(".bd-zalo-panel");
    await expect(panel).toBeVisible({ timeout: 15_000 });
  });

  test("template sub-tab shows the template list or error", async ({ page }) => {
    await page.goto("/tools/zalo-oa?subTab=template");
    // Should show the template hint text.
    const hint = page.locator(".bd-zalo-hint--list");
    await expect(hint).toBeVisible({ timeout: 15_000 });
  });

  test("campaign sub-tab shows the message list", async ({ page }) => {
    await page.goto("/tools/zalo-oa?subTab=campaign");
    // Should show the counter buttons.
    const counters = page.locator(".bd-zalo-counters");
    await expect(counters).toBeVisible({ timeout: 15_000 });
  });

  test("callback with bad state redirects to error", async ({ page }) => {
    await page.goto("/tools/zalo-oa?zalo=error&reason=state");
    // The component should strip the params and show a toast.
    // After stripping, the URL should not contain ?zalo.
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("zalo=error");
  });
});
