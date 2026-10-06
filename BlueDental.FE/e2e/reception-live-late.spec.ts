import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Tiếp nhận — Trễ hẹn (owner 2026-10-06, after bug list item 17).
 *
 * - A booking is Trễ hẹn as soon as its start time passes with no arrival —
 *   no 5-minute grace — and an open board shows it without a reload: the
 *   server pushes a change over SignalR and the board refetches.
 * - Đã hẹn, Đã đến, Huỷ hẹn and Trễ hẹn split the board, so they add up to
 *   Tất cả (it read 47 while the chips added up to 34: the Trễ hẹn chip only
 *   counted cards past their time, not bookings already marked Trễ hẹn).
 *
 * Real stack: the booking is made through the API, the board is a real page,
 * nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const NO_SHOW = 7;

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
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json",
        "X-Clinic-Branch-Id": branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { url, options, branchId },
  );
}

async function openBoard(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/reception");
  return (await request).headers()["x-clinic-branch-id"];
}

const chip = (page: Page, label: string) =>
  page.locator(".reception-stat-chip-btn", { hasText: label }).locator(".reception-stat-chip-value");

async function readChip(page: Page, label: string): Promise<number> {
  return Number(await chip(page, label).innerText());
}

async function readAllTab(page: Page): Promise<number> {
  const text = await page.locator(".ant-segmented-item", { hasText: "Tất cả" }).innerText();
  return Number(/\((\d+)\)/.exec(text)?.[1] ?? NaN);
}

async function chipsAddUp(page: Page): Promise<boolean> {
  const parts = await Promise.all(["Đã hẹn", "Đã đến", "Huỷ hẹn", "Trễ hẹn"].map((l) => readChip(page, l)));
  return parts.reduce((a, b) => a + b, 0) === (await readAllTab(page));
}

test.describe("Tiếp nhận — Trễ hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Đã hẹn, Đã đến, Huỷ hẹn and Trễ hẹn add up to Tất cả", async ({ page }) => {
    // Before the stats arrive every number reads 0, which adds up trivially.
    const stats = page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}/stats`) && r.ok());
    await openBoard(page);
    await stats;
    await expect.poll(() => readAllTab(page), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => chipsAddUp(page), { timeout: 15_000 }).toBe(true);

    // The Trễ hẹn chip lists exactly what it counts.
    const late = await readChip(page, "Trễ hẹn");
    const listed = page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}?`) && r.url().includes("isLate=true"));
    await page.locator(".reception-stat-chip-btn", { hasText: "Trễ hẹn" }).click();
    const body = (await (await listed).json()) as { totalCount: number };
    expect(body.totalCount).toBe(late);
  });

  test("a booking turns Trễ hẹn the moment its time passes, on an open board, without a reload", async ({ page }) => {
    test.setTimeout(4 * 60_000);
    const branchId = await openBoard(page);

    const name = `E2E TRE ${runId()}`;
    const start = new Date(Date.now() + 60_000);
    test.skip(start.getDate() !== new Date(start.getTime() + 15 * 60_000).getDate(), "too close to midnight");
    const end = new Date(start.getTime() + 15 * 60_000);
    const booked = await call<{ id: string; status: number }>(page, branchId, `${APPOINTMENTS}/temp`, {
      method: "POST",
      json: { patientName: name, patientPhone: `09${runId().padStart(8, "0").slice(-8)}`, branchId, slotStart: start, slotEnd: end },
    });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);

    // Load the board once with the new booking, then never again.
    await page.reload();
    const card = page.locator(".rc-wrapper", { hasText: name });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await expect(card.locator(".rc-badge")).not.toHaveText("Trễ hẹn");
    const lateBefore = await readChip(page, "Trễ hẹn");
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    // Its time passes: the board refetches right after the start time, and
    // the server's push when it marks the booking refetches it again.
    await expect(card.locator(".rc-badge")).toHaveText("Trễ hẹn", { timeout: 90_000 });
    // At least this one more — other bookings may pass their time meanwhile.
    await expect.poll(() => readChip(page, "Trễ hẹn"), { timeout: 15_000 }).toBeGreaterThan(lateBefore);
    await expect.poll(() => chipsAddUp(page), { timeout: 15_000 }).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    expect(Date.now()).toBeLessThan(start.getTime() + 60_000);

    // The server has marked it too, on its next pass (every 15 seconds).
    const stored = () => call<{ status: number }>(page, branchId, `${APPOINTMENTS}/${booked.body.id}`);
    await expect.poll(async () => (await stored()).body.status, { timeout: 30_000 }).toBe(NO_SHOW);
  });

  test("the server's push alone refreshes an open board", async ({ page }) => {
    test.setTimeout(4 * 60_000);
    const branchId = await openBoard(page);

    // A search no card matches: nothing is loaded, so the board has no timer
    // of its own — only the push can make it refetch. The chips still count
    // the whole day.
    const searched = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok());
    await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(`khong-co-ai-${runId()}`);
    await searched;
    await expect(page.locator(".rc-wrapper")).toHaveCount(0);

    const start = new Date(Date.now() + 45_000);
    test.skip(start.getDate() !== new Date(start.getTime() + 15 * 60_000).getDate(), "too close to midnight");
    const booked = await call<{ id: string }>(page, branchId, `${APPOINTMENTS}/temp`, {
      method: "POST",
      json: {
        patientName: `E2E PUSH ${runId()}`,
        patientPhone: `08${runId().padStart(8, "0").slice(-8)}`,
        branchId,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 15 * 60_000),
      },
    });
    expect(booked.status).toBe(200);

    // The board has not refetched since the booking was made.
    const lateBefore = await readChip(page, "Trễ hẹn");
    const statsAfterMark = page.waitForResponse(
      (r) => r.url().includes(`${APPOINTMENTS}/stats`) && Date.now() > start.getTime(),
      { timeout: 90_000 },
    );
    await statsAfterMark;
    await expect.poll(() => readChip(page, "Trễ hẹn"), { timeout: 15_000 }).toBeGreaterThan(lateBefore);
    const stored = await call<{ status: number }>(page, branchId, `${APPOINTMENTS}/${booked.body.id}`);
    expect(stored.body.status).toBe(NO_SHOW);
  });
});
