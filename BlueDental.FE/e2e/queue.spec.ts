import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Màn hình đợi (F-43) — BA item 22 through the real UI.
 *
 * Real login, real routes, real backend, real PostgreSQL. The only direct
 * HTTP here is the set-up that empties today's shared pool (so the order the
 * cards show is the order this spec created) and the clean-up that removes
 * the counters it added; both go through the real API with the real cookie.
 */

const BASE = "/api/v1/app/queue";

interface BoardCounter {
  id: string;
  name: string;
}

async function api(page: Page, url: string, method: "GET" | "POST" | "DELETE" = "GET") {
  return page.evaluate(
    async ({ url, method }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        ...(method === "POST" ? { body: "{}" } : {}),
      });
      const text = await res.text();
      return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
    },
    { url, method },
  );
}

async function drainPool(page: Page, counterId: string): Promise<void> {
  for (let i = 0; i < 300; i += 1) {
    const res = await page.evaluate(
      async ({ url, counterId }) => {
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const r = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
          body: JSON.stringify({ counterId }),
        });
        return r.status;
      },
      { url: `${BASE}/tickets/call-next`, counterId },
    );
    if (res !== 200) return;
  }
}

function card(page: Page, name: string): Locator {
  return page.locator(".queue-counter", { has: page.locator(".queue-counter__name", { hasText: name }) });
}

async function addCounter(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Quản lý quầy" });
  await dialog.getByPlaceholder("VD: Quầy 1").fill(name);
  await dialog.getByRole("button", { name: "Thêm quầy" }).click();
  await expect(dialog.getByRole("cell", { name, exact: true })).toBeVisible();
}

async function takeNumber(page: Page, urgent: boolean): Promise<string> {
  await page.getByRole("button", { name: "Lấy số mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Lấy số thứ tự" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Bệnh nhân")).toHaveCount(0);
  await expect(dialog.getByText("Quầy", { exact: true })).toHaveCount(0);
  if (urgent) await dialog.getByRole("radio", { name: "Ưu tiên" }).check();
  const created = page.waitForResponse(
    (res) => res.url().includes(`${BASE}/tickets`) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lấy số" }).click();
  const body = (await (await created).json()) as { displayNumber: string };
  await expect(dialog).toBeHidden();
  return body.displayNumber;
}

test.describe("Màn hình đợi — counter cards call from one shared queue", () => {
  const run = runId();
  const nameA = `Quầy A ${run}`;
  const nameB = `Quầy B ${run}`;
  const created: BoardCounter[] = [];

  test.afterEach(async ({ page }) => {
    for (const counter of created) {
      await api(page, `${BASE}/counters/${counter.id}`, "DELETE");
    }
  });

  test("take numbers, call per counter, persist, pause", async ({ page }) => {
    await login(page);
    await page.goto("/queue");
    await expect(page.getByRole("heading", { name: "Màn hình đợi" })).toBeVisible();

    // The board replaces the old KPI cards and ticket table (owner, 2026-09-25).
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Các quầy tiếp nhận" })).toBeVisible();

    // Quản lý quầy → two counters, each becomes a card on the board.
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    await addCounter(page, nameA);
    await addCounter(page, nameB);
    await page.getByRole("dialog", { name: "Quản lý quầy" }).getByLabel("Close").click();
    await expect(card(page, nameA)).toBeVisible();
    await expect(card(page, nameB)).toBeVisible();

    const board = (await api(page, `${BASE}/counters/board`)).body as BoardCounter[];
    created.push(...board.filter((c) => c.name === nameA || c.name === nameB));
    const idA = created.find((c) => c.name === nameA)?.id ?? "";
    await drainPool(page, idA);

    // Three numbers: two normal, one urgent. Both cards offer the urgent one next.
    const n1 = await takeNumber(page, false);
    const n2 = await takeNumber(page, false);
    const urgent = await takeNumber(page, true);
    await expect(card(page, nameA).locator(".queue-counter__next-number")).toHaveText(urgent);
    await expect(card(page, nameB).locator(".queue-counter__next-number")).toHaveText(urgent);
    await expect(card(page, nameA).locator(".queue-counter__next")).toContainText("Ưu tiên");

    // Counter A calls: it now serves the urgent number; both cards move on to n1.
    await card(page, nameA).getByRole("button", { name: "Gọi số tiếp theo" }).click();
    await expect(card(page, nameA).locator(".queue-counter__number")).toHaveText(urgent);
    await expect(card(page, nameA).locator(".queue-counter__meta")).toHaveText(/\d{2}:\d{2}/);
    await expect(card(page, nameA).locator(".queue-counter__next-number")).toHaveText(n1);
    await expect(card(page, nameB).locator(".queue-counter__next-number")).toHaveText(n1);

    // Counter B calls n1; counter A calls again and gets n2, its urgent one completes.
    await card(page, nameB).getByRole("button", { name: "Gọi số tiếp theo" }).click();
    await expect(card(page, nameB).locator(".queue-counter__number")).toHaveText(n1);
    await card(page, nameA).getByRole("button", { name: "Gọi số tiếp theo" }).click();
    await expect(card(page, nameA).locator(".queue-counter__number")).toHaveText(n2);
    await expect(card(page, nameA).locator(".queue-counter__next-number")).toHaveText("Hết số chờ");

    // A's first number was auto-completed by its second call (owner decision 2).
    // Paged list: ask for the whole day so earlier runs' completed numbers do not push ours off page 1.
    const urgentTicket = (await api(page, `${BASE}/tickets?status=4&maxResultCount=1000`)).body as {
      items: { displayNumber: string; status: number }[];
    };
    expect(urgentTicket.items.some((item) => item.displayNumber === urgent)).toBe(true);

    // Persisted: a reload shows the same picture.
    await page.reload();
    await expect(card(page, nameA).locator(".queue-counter__number")).toHaveText(n2);
    await expect(card(page, nameB).locator(".queue-counter__number")).toHaveText(n1);

    // Pause counter B: still on the board, dimmed, its button locked.
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    const dialog = page.getByRole("dialog", { name: "Quản lý quầy" });
    await dialog.getByRole("switch", { name: nameB }).click();
    await expect(dialog.getByRole("row", { name: new RegExp(nameB) })).toContainText("Tạm ngưng");
    await dialog.getByLabel("Close").click();
    await expect(card(page, nameB)).toHaveClass(/queue-counter--paused/);
    await expect(card(page, nameB).locator(".queue-counter__status")).toHaveText("Tạm ngưng");
    await expect(card(page, nameB).getByRole("button", { name: "Gọi số tiếp theo" })).toBeDisabled();
    await expect(card(page, nameA).getByRole("button", { name: "Gọi số tiếp theo" })).toBeEnabled();

    // The public TV board shows the same numbers, with no session at all.
    const branchId = (await api(page, `${BASE}/counters`)).body as { clinicBranchId: string }[];
    const tv = await page.context().browser()!.newContext();
    const tvPage = await tv.newPage();
    try {
      await tvPage.goto(`/queue/display?branchId=${branchId[0].clinicBranchId}`);
      const tvCard = tvPage.locator(".queue-display__counter-card", { hasText: nameA });
      await expect(tvCard.locator(".queue-display__counter-number")).toHaveText(n2);
      await expect(tvPage.locator(".queue-display__counter-card", { hasText: nameB })).toHaveClass(
        /queue-display__counter-card--paused/,
      );
    } finally {
      await tv.close();
    }
  });
});
