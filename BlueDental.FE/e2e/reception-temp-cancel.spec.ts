import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, dayOf, getAppointment, openBoard, type Appointment } from "./fixtures/receptionBoard";

/**
 * Tiếp nhận — a cancelled "Lịch tạm" ends like any other cancelled visit
 * (BA, R-1033): red card, the bar closes on a red "Huỷ hẹn", the wait clock
 * stops and the cancel button is gone. The "Lịch tạm" tab stays on top.
 *
 * Real stack: the booking is made through the API, check-in and cancel are
 * clicked on the board, nothing is intercepted, the state is re-read after a
 * reload.
 */

const CANCELLED = 6;
const RED = "rgb(229, 72, 77)";
const CANCELLED_CARD_BG = "rgb(253, 236, 237)";

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** A "Lịch tạm" for later today; its unique name is what the board's search matches. */
async function bookTempToday(page: Page, branchId: string, minutesAhead: number) {
  const name = `E2E TAM HUY ${runId()}${minutesAhead}`;
  const start = new Date(Date.now() + minutesAhead * 60_000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 15 * 60_000);
  test.skip(dayOf(end) !== dayOf(new Date()), "too close to midnight to book a visit for today");
  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/temp`, {
    method: "POST",
    json: {
      patientName: name,
      patientPhone: `09${runId().padStart(8, "0").slice(-8)}`,
      branchId,
      slotStart: start.toISOString(),
      slotEnd: end.toISOString(),
    },
  });
  expect(res.status, JSON.stringify(res.body.error)).toBe(200);
  return { ...res.body, name };
}

async function cardByName(page: Page, name: string): Promise<Locator> {
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(name);
  await searched;
  const card = page.locator(".rc-wrapper", { hasText: name });
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  return card;
}

async function cancelOnBoard(page: Page, card: Locator) {
  await card.getByRole("button", { name: "Hủy lịch" }).click();
  const dialog = page.getByRole("dialog", { name: "Huỷ lịch hẹn" });
  await dialog.getByPlaceholder("Nhập lý do huỷ...").fill("e2e lịch tạm");
  await dialog.getByRole("button", { name: /Xác nhận huỷ/ }).click();
  await expect(dialog).toBeHidden();
}

/** Everything a cancelled card shows, whatever it went through before. */
async function expectCancelledCard(card: Locator, bar: { labels: string[]; times: string[] }) {
  await expect(card.locator(".rc-temp-tab")).toHaveText("Lịch tạm");
  await expect(card.locator(".rc-badge")).toHaveText("Huỷ hẹn");
  await expect(card.locator(".rc-card")).toHaveCSS("background-color", CANCELLED_CARD_BG);
  await expect(card.locator(".rc-step-label")).toHaveText(bar.labels);
  await expect(card.locator(".rc-step-time")).toHaveText(bar.times);
  await expect(card.locator(".rc-step-label").last()).toHaveCSS("color", RED);
  await expect(card.locator(".rc-wait-chip")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Hủy lịch" })).toHaveCount(0);
  for (const step of await card.locator(".rc-step").all()) await expect(step).toBeDisabled();
  for (const option of await card.locator(".rc-outcome-btn").all()) await expect(option).toBeDisabled();
}

test.describe("Tiếp nhận — huỷ Lịch tạm", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("came, waited, cancelled: Đã đến → Huỷ hẹn, clock stopped, no cancel button", async ({ page }) => {
    const branchId = await openBoard(page);
    const temp = await bookTempToday(page, branchId, 180);
    const card = await cardByName(page, temp.name);

    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(card.locator(".rc-wait-chip")).toHaveCount(1, { timeout: 15_000 });

    await cancelOnBoard(page, card);
    const stored = await getAppointment(page, branchId, temp.id);
    expect(stored.status).toBe(CANCELLED);
    const bar = { labels: ["Đã đến", "Huỷ hẹn"], times: [hhmm(stored.checkedInAt!), hhmm(stored.cancelledAt!)] };
    await expectCancelledCard(card, bar);

    await page.reload();
    await expectCancelledCard(await cardByName(page, temp.name), bar);
  });

  test("never came: a lone red Huỷ hẹn step", async ({ page }) => {
    const branchId = await openBoard(page);
    const temp = await bookTempToday(page, branchId, 190);
    const card = await cardByName(page, temp.name);

    await cancelOnBoard(page, card);
    const stored = await getAppointment(page, branchId, temp.id);
    expect(stored.status).toBe(CANCELLED);
    const bar = { labels: ["Huỷ hẹn"], times: [hhmm(stored.cancelledAt!)] };
    await expectCancelledCard(card, bar);

    await page.reload();
    await expectCancelledCard(await cardByName(page, temp.name), bar);
  });
});
