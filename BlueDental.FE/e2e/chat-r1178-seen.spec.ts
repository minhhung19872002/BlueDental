import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, signIn, type Session, patiently } from "./fixtures/chatApi";
import { call } from "./fixtures/marketingTicket";

/**
 * Đã xem (R-1178) in two real browsers against the real host and PostgreSQL,
 * no interception. Admin writes; manager reading flips admin's status live
 * (SignalR "ChatRead"), and it survives a reload.
 */

const ADMIN_NAME = "Phạm Văn Danh";
const MANAGER_NAME = "Quản lý toàn phòng khám";

let admin: Session;
let manager: Session;
let groupId: string | undefined;
let groupName: string;
let thirdName: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }));

  const contacts = await call<{ id: string; fullName: string }[]>(admin.page, "GET", `${CHAT}/contacts`);
  const third = contacts.body.find((c) => c.id !== manager.userId);
  if (!third) throw new Error("branch 1 needs a third staff account");
  thirdName = third.fullName;
  groupName = `Đã xem e2e-${runId()}`;
  const group = await patiently(() =>
    call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, {
      name: groupName,
      memberIds: [manager.userId, third.id],
    }),
  );
  groupId = group.body.id;
});

test.afterAll(async () => {
  if (groupId) await call(manager.page, "POST", `${CHAT}/conversations/${groupId}/read`);
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });
const message = (page: Page, text: string) => panel(page).locator(".chat-message").filter({ hasText: text });
const status = (page: Page) => panel(page).locator(".chat-seen-text");

async function openThreadWith(page: Page, title: string) {
  await page.reload();
  await page.getByRole("button", { name: "Mở chat nội bộ" }).click();
  await panel(page).locator(".chat-conversation").filter({ hasText: title }).first().click();
  await expect(composer(page)).toBeVisible();
}

async function sendFromComposer(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press("Enter");
  await expect(message(page, text)).toBeVisible();
}

test("direct: 'Đã gửi' under my newest message turns into 'Đã xem HH:mm' the moment the other side opens it", async () => {
  const text = `Đã xem trực tiếp e2e-${runId()}`;
  await openThreadWith(admin.page, MANAGER_NAME);
  await sendFromComposer(admin.page, text);
  await expect(status(admin.page)).toHaveText("Đã gửi");
  await expect(status(admin.page)).toHaveCount(1);

  // Manager opens the thread; admin's page is not reloaded.
  await openThreadWith(manager.page, ADMIN_NAME);
  await expect(message(manager.page, text)).toBeVisible();
  await expect(status(admin.page)).toHaveText(/^Đã xem \d{2}:\d{2}$/);
  // Manager's newest message is not theirs, so they see no status at all.
  await expect(status(manager.page)).toHaveCount(0);

  const shown = await status(admin.page).textContent();
  await openThreadWith(admin.page, MANAGER_NAME);
  await expect(status(admin.page)).toHaveText(shown ?? "");

  // A reply from manager: admin's newest message is no longer theirs, so the status goes.
  await sendFromComposer(manager.page, `Đã nhận e2e-${runId()}`);
  await expect(status(admin.page)).toHaveCount(0);
});

test("group: avatars sit under the message a member stopped at; the dialog lists seen and not seen", async () => {
  const text = `Đã xem nhóm e2e-${runId()}`;
  await openThreadWith(admin.page, groupName);
  await sendFromComposer(admin.page, text);
  await expect(status(admin.page)).toHaveText("Đã gửi");

  await openThreadWith(manager.page, groupName);
  await expect(message(manager.page, text)).toBeVisible();

  // Live on admin's page: the status gives way to manager's avatar.
  const avatars = panel(admin.page).getByRole("button", { name: `Đã xem: ${MANAGER_NAME}` });
  await expect(avatars).toBeVisible();
  await expect(status(admin.page)).toHaveCount(0);
  await expect(avatars.locator(".chat-seen-avatar")).toHaveCount(1);

  await avatars.click();
  const dialog = admin.page.getByRole("dialog", { name: "Trạng thái xem tin nhắn" });
  await expect(dialog).toBeVisible();
  const seen = dialog.getByRole("region", { name: "Đã xem (1)" });
  const notSeen = dialog.getByRole("region", { name: "Chưa xem (1)" });
  await expect(seen.locator(".chat-member-name")).toHaveText([MANAGER_NAME]);
  await expect(seen.locator(".chat-seen-time")).toHaveText(/^\d{2}:\d{2}$/);
  await expect(notSeen.locator(".chat-member-name")).toHaveText([thirdName]);
  // Admin is the viewer and the sender: in neither list.
  await expect(dialog.getByText(ADMIN_NAME)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Đóng" }).first().click();
  await expect(dialog).toBeHidden();

  // After a reload the avatar is still there, from the database.
  await openThreadWith(admin.page, groupName);
  await expect(panel(admin.page).getByRole("button", { name: `Đã xem: ${MANAGER_NAME}` })).toBeVisible();
});
