import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, type Session } from "./fixtures/chatApi";
import { call } from "./fixtures/marketingTicket";

/**
 * R-1165 — new-message toasts (BA 2026-11-06 "thông báo để xem nhanh, 5s"),
 * in the real browser against the real host and PostgreSQL. Admin sends
 * through the API; manager's page gets the SignalR push and shows the toast.
 * Only the browser's Notification / hasFocus are stubbed, for the Windows
 * notification case — no BlueDental request is intercepted.
 */

const ADMIN_NAME = "Phạm Văn Danh";

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

const toasts = (page: Page) => page.getByRole("region", { name: "Tin nhắn mới" });
const toast = (page: Page, text: string) => toasts(page).locator(".chat-toast").filter({ hasText: text });
const chatButton = (page: Page) => page.getByRole("button", { name: "Mở chat nội bộ" });
const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });

async function send(from: Session, conversationId: string, content: string) {
  const reply = await patiently(() =>
    call(from.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
      conversationId,
      content,
      attachmentIds: [],
    }),
  );
  expect(reply.status).toBe(200);
}

/** Manager starts each case on a fresh page, chat closed, the thread read. */
async function freshManager() {
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${directId}/read`)).status).toBe(204);
  await manager.page.reload();
  await expect(chatButton(manager.page)).toBeVisible();
  // The hub needs a moment to join after the load.
  await manager.page.waitForTimeout(1_500);
}

test("a message from someone else shows top right under the header and leaves after about 5 s", async () => {
  await freshManager();
  const page = manager.page;
  const text = `Toast e2e-${runId()} phim đã chụp xong`;

  await send(admin, directId, text);
  const shown = toast(page, text);
  await expect(shown).toBeVisible();
  const appearedAt = Date.now();
  await expect(shown).toContainText(ADMIN_NAME);

  // Top right, below the header.
  const rect = (await shown.boundingBox())!;
  const header = (await page.locator(".app-header, header").first().boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(rect.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(viewport.width - (rect.x + rect.width)).toBeLessThanOrEqual(32);

  await expect(shown).toBeHidden({ timeout: 10_000 });
  const elapsed = Date.now() - appearedAt;
  expect(elapsed).toBeGreaterThan(3_500);
  expect(elapsed).toBeLessThan(8_000);
});

test("the toast comes with a ting once the page has had a click", async () => {
  await freshManager();
  const page = manager.page;
  await page.evaluate(() => {
    const store = window as unknown as { __tones: number };
    store.__tones = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function patched(this: AudioContext) {
      store.__tones += 1;
      return original.call(this);
    };
  });
  // Browsers keep sound off until the user has clicked something.
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  const text = `Ting e2e-${runId()}`;

  await send(admin, directId, text);
  await expect(toast(page, text)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBe(2);
});

test("pointing at the toast holds it; × closes it", async () => {
  await freshManager();
  const page = manager.page;
  const text = `Hover e2e-${runId()}`;

  await send(admin, directId, text);
  const shown = toast(page, text);
  await expect(shown).toBeVisible();
  await shown.hover();
  await page.waitForTimeout(6_500);
  await expect(shown).toBeVisible();

  await shown.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(shown).toBeHidden();
});

test("a newer message in the same conversation replaces its toast and counts the unread", async () => {
  await freshManager();
  const page = manager.page;
  const first = `Một e2e-${runId()}`;
  const second = `Hai e2e-${runId()}`;

  await send(admin, directId, first);
  await expect(toast(page, first)).toBeVisible();
  await send(admin, directId, second);
  await expect(toast(page, second)).toBeVisible();
  await expect(toast(page, second)).toContainText("2 tin chưa đọc");
  await expect(toasts(page).locator(".chat-toast")).toHaveCount(1);
});

test("a click on the toast opens that thread in the chat panel", async () => {
  await freshManager();
  const page = manager.page;
  const text = `Mở e2e-${runId()}`;

  await send(admin, directId, text);
  await toast(page, text).getByRole("button", { name: new RegExp(ADMIN_NAME) }).click();
  await expect(composer(page)).toBeVisible();
  await expect(panel(page).locator(".chat-message").filter({ hasText: text })).toBeVisible();
  await expect(toast(page, text)).toHaveCount(0);

  // The thread on screen gets no toast for the next message.
  const next = `Đang xem e2e-${runId()}`;
  await send(admin, directId, next);
  await expect(panel(page).locator(".chat-message").filter({ hasText: next })).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(toasts(page).locator(".chat-toast")).toHaveCount(0);

  // Closing and reopening the chat starts from the list, as before.
  await panel(page).getByRole("button", { name: "Đóng" }).click();
  await chatButton(page).click();
  await expect(panel(page).getByRole("button", { name: "Cuộc trò chuyện mới" })).toBeVisible();
});

test("my own message shows no toast to me", async () => {
  await freshManager();
  const page = manager.page;
  const text = `Của tôi e2e-${runId()}`;

  await send(manager, directId, text);
  // Admin, the other side, does get one.
  await expect(toast(admin.page, text)).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(toast(page, text)).toHaveCount(0);
});

test("a group toast names the sender and the group", async () => {
  await freshManager();
  const name = `Nhóm toast ${runId()}`;
  const group = await patiently(() =>
    call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, { name, memberIds: [manager.userId] }),
  );
  expect(group.status).toBe(200);
  const text = `Nhóm e2e-${runId()}`;

  await send(admin, group.body.id, text);
  await expect(toast(manager.page, text)).toContainText(`${ADMIN_NAME} · ${name}`);
});

test("while the app is in the background the message is also a Windows notification that opens the thread", async () => {
  await freshManager();
  const page = manager.page;
  await page.evaluate(() => {
    const store = window as unknown as {
      __notices: { title: string; body?: string; tag?: string; renotify?: boolean; onclick: (() => void) | null }[];
    };
    store.__notices = [];
    class FakeNotification {
      static permission = "granted";
      static requestPermission = () => Promise.resolve("granted");
      onclick: (() => void) | null = null;
      constructor(
        public title: string,
        options: { body?: string; tag?: string; renotify?: boolean },
      ) {
        store.__notices.push(Object.assign(this, options));
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
    document.hasFocus = () => false;
  });
  const text = `Nền e2e-${runId()}`;

  await send(admin, directId, text);
  await expect(toast(page, text)).toBeVisible();
  const notices = () =>
    page.evaluate(() =>
      (window as unknown as { __notices: { title: string; body?: string; tag?: string; renotify?: boolean }[] }).__notices.map(
        (n) => ({ title: n.title, body: n.body, tag: n.tag, renotify: n.renotify }),
      ),
    );
  await expect.poll(notices).toEqual([{ title: ADMIN_NAME, body: text, tag: directId, renotify: true }]);

  // R-1166: the next message pops up again (same tag + renotify), not a silent swap.
  const next = `Nền tiếp e2e-${runId()}`;
  await send(admin, directId, next);
  await expect(toast(page, next)).toBeVisible();
  await expect.poll(notices).toEqual([
    { title: ADMIN_NAME, body: text, tag: directId, renotify: true },
    { title: ADMIN_NAME, body: next, tag: directId, renotify: true },
  ]);

  await page.evaluate(() => {
    const all = (window as unknown as { __notices: { onclick: () => void }[] }).__notices;
    all[all.length - 1].onclick();
  });
  await expect(composer(page)).toBeVisible();
  await expect(panel(page).locator(".chat-message").filter({ hasText: next })).toBeVisible();
});
