import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * CSKH — a booking moves from Nhắc lịch hẹn to Đặt lịch không đến live
 * (owner 2026-10-07).
 *
 * When a booking's time passes with no arrival the server marks it Trễ hẹn and
 * pushes the change over SignalR. An open CSKH board drops it from Nhắc lịch
 * hẹn without a reload, Đặt lịch không đến lists it, and a toast names the
 * patient so the clinic knows.
 *
 * Real stack: the booking is made through the API, the board is a real page,
 * nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const CARE = "/api/v1/app/care-records";

async function call<T>(
  page: Page,
  branchId: string,
  url: string,
  options: { method?: "GET" | "POST"; json?: unknown } = {},
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ url, options, branchId }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "X-Clinic-Branch-Id": branchId,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { url, options, branchId },
  );
}

function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Opens one CSKH tab on today and waits for its list, returning the branch it asked for. */
async function openTab(page: Page, tab: string): Promise<string> {
  const listed = page.waitForRequest(
    (r) => r.url().includes(`${CARE}?`) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto(`/cskh-grouping?page=${tab}&care_dateMode=day&care_date=${localIsoDate(new Date())}`);
  return (await listed).headers()["x-clinic-branch-id"];
}

async function search(page: Page, text: string): Promise<void> {
  const listed = page.waitForResponse(
    (r) => r.url().includes(`${CARE}?`) && r.url().includes("filter=") && r.request().method() === "GET",
  );
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(text);
  await listed;
}

const rows = (page: Page, name: string) => page.locator(".cskh-table tbody tr.ant-table-row", { hasText: name });

test.describe("CSKH — Đặt lịch không đến, live", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a booking leaves Nhắc lịch hẹn for Đặt lịch không đến when its time passes, with a toast, without a reload", async ({
    page,
  }) => {
    test.setTimeout(4 * 60_000);
    const branchId = await openTab(page, "remind-appointment");

    const name = `E2E CSKH TRE ${runId()}`;
    const start = new Date(Date.now() + 45_000);
    test.skip(start.getDate() !== new Date(start.getTime() + 15 * 60_000).getDate(), "too close to midnight");
    const end = new Date(start.getTime() + 15 * 60_000);
    const booked = await call<{ id: string }>(page, branchId, `${APPOINTMENTS}/temp`, {
      method: "POST",
      json: { patientName: name, patientPhone: `09${runId().padStart(8, "0").slice(-8)}`, branchId, slotStart: start, slotEnd: end },
    });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);

    // Load the board once with the new booking, then never again.
    await page.reload();
    await search(page, name);
    await expect(rows(page, name)).toHaveCount(1, { timeout: 15_000 });
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    // Its time passes: the server marks it and pushes; the board refetches.
    const toast = page.locator("[data-sonner-toast]", { hasText: name });
    await expect(toast).toBeVisible({ timeout: 60_000 });
    await expect(toast).toContainText("Trễ hẹn");
    await expect(rows(page, name)).toHaveCount(0, { timeout: 15_000 });
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    expect(Date.now()).toBeLessThan(start.getTime() + 45_000);

    // Đặt lịch không đến lists it.
    await page.getByRole("button", { name: "Đặt lịch không đến", exact: true }).click();
    await search(page, name);
    await expect(rows(page, name)).toHaveCount(1, { timeout: 15_000 });
  });
});
