import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, dayOf, getAppointment, openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: the last chip of Tiếp nhận, "Chuyển đổi" → "Đã hẹn lại" (BA, R-1039).
 *
 * - The chip counts the board's visits closed with "Hẹn tái khám" — the cards
 *   whose bar reads "Đã hẹn lại" — dated or not.
 * - "Đã hẹn tiếp" is not counted, nor a revisit cancelled afterwards (its card
 *   ends on Hủy hẹn).
 * - Clicking the chip lists those visits only.
 * - Lịch hẹn's own "Chuyển đổi" chip follows (owner, 2026-10-26).
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const OUTCOME = { FollowUp: 2, Revisit: 4 } as const;
const CANCELLED = 6;

const chipButton = (page: Page, label: string) =>
  page
    .locator(".reception-stat-chip-btn")
    .filter({ has: page.locator(".reception-stat-chip-label").getByText(label, { exact: true }) });

async function revisitStat(page: Page, branchId: string): Promise<number> {
  const today = dayOf(new Date());
  const res = await call<{ revisit: number }>(page, branchId, `${APPOINTMENTS}/stats?fromDate=${today}&toDate=${today}`);
  expect(res.status).toBe(200);
  return res.body.revisit;
}

/** Searches the board and waits for the answer, keeping whichever chip is pressed. */
async function search(page: Page, key: string) {
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes(`filter=${key}`) && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(key);
  return searched;
}

test.describe("Tiếp nhận — chip Đã hẹn lại", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
  });

  test("counts and lists the visits closed with Hẹn tái khám, not Đã hẹn tiếp nor a cancelled one", async ({ page }) => {
    const branchId = await openBoard(page);
    await expect(chipButton(page, "Đã hẹn lại")).toHaveCount(1);
    await expect(chipButton(page, "Chuyển đổi")).toHaveCount(0);

    const before = await revisitStat(page, branchId);
    const revisit = await bookVisitToday(page, branchId, 40, "e2e-henlai-chip");
    const followUp = await bookVisitToday(page, branchId, 50, "e2e-henlai-chip");
    const cancelled = await bookVisitToday(page, branchId, 60, "e2e-henlai-chip");

    // Hẹn tái khám through the card, as reception does it.
    const card = await cardOf(page, revisit);
    await card.locator(".rc-col-actions").getByRole("button", { name: "Hẹn tái khám" }).click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await panel.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    expect((await getAppointment(page, branchId, revisit.id)).outcome).toBe(OUTCOME.Revisit);

    // The two that must stay out, through the same endpoints.
    const asFollowUp = await call(page, branchId, `${APPOINTMENTS}/${followUp.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.FollowUp },
    });
    expect(asFollowUp.status).toBe(200);
    const asRevisit = await call(page, branchId, `${APPOINTMENTS}/${cancelled.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.Revisit },
    });
    expect(asRevisit.status).toBe(200);
    const cancel = await call(page, branchId, `${APPOINTMENTS}/${cancelled.id}/cancel`, {
      method: "POST",
      json: { reason: 1, note: "E2E huỷ sau hẹn tái khám" },
    });
    expect(cancel.status).toBe(200);
    const stored = await getAppointment(page, branchId, cancelled.id);
    expect(stored.status).toBe(CANCELLED);
    expect(stored.outcome).toBe(OUTCOME.Revisit);

    // Only the first of the three moves the server's count.
    const after = await revisitStat(page, branchId);
    expect(after - before).toBe(1);

    // The chip reads the server's count, after a reload too.
    await page.reload();
    await expect(chipButton(page, "Đã hẹn lại").locator(".reception-stat-chip-value")).toHaveText(String(after));

    const listed = page.waitForResponse(
      (r) => r.url().includes(`${APPOINTMENTS}?`) && r.url().includes("isRevisit=true") && r.ok(),
    );
    await chipButton(page, "Đã hẹn lại").click();
    await listed;
    await expect(chipButton(page, "Đã hẹn lại")).toHaveAttribute("aria-pressed", "true");

    const cards = page.locator(".rc-wrapper");
    expect((await search(page, revisit.searchKey)).url()).toContain("isRevisit=true");
    await expect(cards).toHaveCount(1, { timeout: 15_000 });
    await expect(cards.first()).toContainText(revisit.patientCode ?? revisit.patientName);
    await expect(cards.first()).toContainText("Đã hẹn lại");

    for (const outside of [followUp, cancelled]) {
      await search(page, outside.searchKey);
      await expect(cards).toHaveCount(0);
    }

    // Released, the chip no longer filters: the follow-up is back on the board.
    await chipButton(page, "Đã hẹn lại").click();
    await expect(chipButton(page, "Đã hẹn lại")).toHaveAttribute("aria-pressed", "false");
    await search(page, followUp.searchKey);
    await expect(cards).toHaveCount(1, { timeout: 15_000 });
  });

  test("Lịch hẹn: the same chip counts and filters the day the same way", async ({ page }) => {
    const branchId = await openBoard(page);
    const revisit = await bookVisitToday(page, branchId, 70, "e2e-henlai-cal");
    const followUp = await bookVisitToday(page, branchId, 80, "e2e-henlai-cal");
    const cancelled = await bookVisitToday(page, branchId, 90, "e2e-henlai-cal");
    for (const [visit, outcome] of [[revisit, OUTCOME.Revisit], [followUp, OUTCOME.FollowUp], [cancelled, OUTCOME.Revisit]] as const) {
      const res = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/rebook-undated`, { method: "POST", json: { outcome } });
      expect(res.status).toBe(200);
    }
    const cancel = await call(page, branchId, `${APPOINTMENTS}/${cancelled.id}/cancel`, {
      method: "POST",
      json: { reason: 1, note: "E2E huỷ sau hẹn tái khám" },
    });
    expect(cancel.status).toBe(200);
    const expected = await revisitStat(page, branchId);

    const today = dayOf(new Date());
    const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${today}`) && r.ok());
    await page.goto(`/calendar?date=${today}`);
    await loaded;
    const calChip = page
      .locator(".cal-counter-btn")
      .filter({ has: page.locator(".cal-counter-label").getByText("Đã hẹn lại", { exact: true }) });
    await expect(page.locator(".cal-counter-label").getByText("Chuyển đổi", { exact: true })).toHaveCount(0);
    // Counted in the browser off the day's list, by the server's own rule.
    await expect(calChip.locator(".cal-counter-value")).toHaveText(String(expected), { timeout: 15_000 });

    await calChip.click();
    await expect(calChip).toHaveAttribute("aria-pressed", "true");
    const blocks = page.locator(".dtl-block");
    const searchBox = page.locator(".cal-search-field input");
    await searchBox.fill(revisit.searchKey);
    await expect(blocks).toHaveCount(1);
    // The timeline never draws a cancelled booking, so only Đã hẹn tiếp proves the filter.
    await searchBox.fill(followUp.searchKey);
    await expect(blocks).toHaveCount(0);

    await calChip.click();
    await expect(calChip).toHaveAttribute("aria-pressed", "false");
    await expect(blocks).toHaveCount(1);
  });
});
