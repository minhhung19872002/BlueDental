import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, type Session } from "./fixtures/chatApi";
import { BRANCH_ONE, call, syntheticPhone } from "./fixtures/marketingTicket";

/**
 * R-1217 — the Trễ hẹn notice moves from the top-center toast to the top-right
 * corner, into one column with the chat toasts (owner 2026-11-12: "giống bên
 * tin nhắn, cùng thông báo thì đẩy xuống"): the newest of either kind on top,
 * the older ones pushed down, never one over the other.
 *
 * Real stack: admin books through the API, the host's own worker marks the
 * booking Trễ hẹn once its time passes and pushes over SignalR, manager's page
 * reads the booking back and shows the card. Nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

let admin: Session;
let manager: Session;
let directId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  const direct = await patiently(() =>
    call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }),
  );
  expect(direct.status).toBe(200);
  directId = direct.body.id;
});

test.afterAll(async () => {
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const lateRegion = (page: Page) => page.getByRole("region", { name: "Thông báo trễ hẹn" });
const lateCard = (page: Page, name: string) => lateRegion(page).locator(".late-notice").filter({ hasText: name });
const chatToast = (page: Page, text: string) =>
  page.getByRole("region", { name: "Tin nhắn mới" }).locator(".chat-toast").filter({ hasText: text });

/** A Lịch tạm starting in `seconds`; the worker marks it Trễ hẹn on its next 15 s pass after that. */
async function bookSoon(seconds: number): Promise<string> {
  const name = `E2E TRE GOC ${runId()}`;
  const start = new Date(Date.now() + seconds * 1000);
  const end = new Date(start.getTime() + 15 * 60_000);
  test.skip(start.getDate() !== end.getDate(), "too close to midnight");
  const booked = await call<{ id: string }>(admin.page, "POST", `${APPOINTMENTS}/temp`, {
    patientName: name,
    patientPhone: syntheticPhone(),
    branchId: BRANCH_ONE,
    slotStart: start,
    slotEnd: end,
  });
  expect(booked.status, JSON.stringify(booked.body)).toBe(200);
  return name;
}

async function sendChat(content: string) {
  const reply = await patiently(() =>
    call(admin.page, "POST", `${CHAT}/conversations/${directId}/messages`, { conversationId: directId, content, attachmentIds: [] }),
  );
  expect(reply.status).toBe(200);
}

/** Manager on a fresh page, chat closed, the thread read, the hubs joined. */
async function freshManager() {
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${directId}/read`)).status).toBe(204);
  await manager.page.goto("/appointments");
  await expect(manager.page.getByRole("button", { name: "Mở chat nội bộ" })).toBeVisible();
  await manager.page.waitForTimeout(1_500);
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
}

test("a booking that turns Trễ hẹn shows top right under the header, not top center, and leaves after about 10 s", async () => {
  test.setTimeout(3 * 60_000);
  await freshManager();
  const page = manager.page;
  const name = await bookSoon(20);

  const card = lateCard(page, name);
  await expect(card).toBeVisible({ timeout: 90_000 });
  const appearedAt = Date.now();
  await expect(card).toContainText(/Trễ hẹn: |lịch hẹn chuyển sang Trễ hẹn/);
  // The old sonner toast is gone: nothing about it top center.
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: name })).toHaveCount(0);

  const rect = await box(card);
  const header = await box(page.locator(".app-header, header").first());
  const viewport = page.viewportSize()!;
  expect(rect.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(viewport.width - (rect.x + rect.width)).toBeLessThanOrEqual(32);

  // Out of the way of the mouse, so nothing pauses the bar.
  await page.mouse.move(5, viewport.height - 5);
  await expect(card).toBeHidden({ timeout: 15_000 });
  const elapsed = Date.now() - appearedAt;
  expect(elapsed).toBeGreaterThan(7_500);
  expect(elapsed).toBeLessThan(13_000);
});

test("Trễ hẹn cards and chat toasts share one column: the newest on top, the older pushed down; × closes a card", async () => {
  test.setTimeout(3 * 60_000);
  await freshManager();
  const page = manager.page;

  // A chat toast first, held by the pointer while the booking runs late.
  const first = `Goc e2e-${runId()} truoc`;
  await sendChat(first);
  const toast = chatToast(page, first);
  await expect(toast).toBeVisible();
  await toast.hover();
  const name = await bookSoon(20);

  // The card comes later, so it goes on top and pushes the toast down.
  const card = lateCard(page, name);
  await expect(card).toBeVisible({ timeout: 90_000 });
  let cardBox = await box(card);
  let toastBox = await box(toast);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(toastBox.y);
  expect(Math.abs(cardBox.x + cardBox.width - (toastBox.x + toastBox.width))).toBeLessThanOrEqual(1);

  // A newer message goes on top of the card in turn.
  await card.hover();
  const second = `Goc e2e-${runId()} sau`;
  await sendChat(second);
  const newer = chatToast(page, second);
  await expect(newer).toBeVisible();
  cardBox = await box(card);
  toastBox = await box(newer);
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(cardBox.y);

  await card.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(card).toHaveCount(0);
});
