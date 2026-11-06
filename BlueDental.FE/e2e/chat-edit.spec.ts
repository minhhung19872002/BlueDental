import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, signIn, sqlScalar, type Session, patiently } from "./fixtures/chatApi";
import { call } from "./fixtures/marketingTicket";

/**
 * Sửa tin chat (R-1159 / F5) and the pending-file chip (R-1158) in two real
 * browsers against the real host and PostgreSQL, no interception. Admin
 * writes to manager; manager's page is never reloaded while it watches.
 */

const ADMIN_NAME = "Phạm Văn Danh";
const MANAGER_NAME = "Quản lý toàn phòng khám";

let admin: Session;
let manager: Session;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }));
});

test.afterAll(async () => {
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });
const message = (page: Page, text: string) => panel(page).locator(".chat-message").filter({ hasText: text });

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

test("A edits; B sees the new words and 'đã chỉnh sửa' live, then opens the earlier version", async () => {
  const original = `Hẹn bệnh nhân lúc 9 giờ e2e-${runId()}`;
  const edited = original.replace("9 giờ", "10 giờ");

  await openThreadWith(admin.page, MANAGER_NAME);
  await openThreadWith(manager.page, ADMIN_NAME);
  await sendFromComposer(admin.page, original);
  await expect(message(manager.page, original)).toBeVisible();

  await message(admin.page, original).getByRole("button", { name: "Thao tác tin nhắn" }).click();
  await admin.page.getByRole("menuitem", { name: "Sửa" }).click();
  await expect(panel(admin.page).getByText("Đang sửa tin nhắn")).toBeVisible();
  await composer(admin.page).fill(edited);
  await composer(admin.page).press("Enter");
  await expect(panel(admin.page).getByText("Đang sửa tin nhắn")).toBeHidden();

  // Manager: no reload, the SignalR push refreshes the thread.
  const seen = message(manager.page, edited);
  await expect(seen).toBeVisible();
  const mark = seen.getByRole("button", { name: "đã chỉnh sửa" });
  await expect(mark).toBeVisible();
  await mark.click();
  const history = manager.page.locator(".chat-edit-history");
  await expect(manager.page.getByText("Các bản trước khi sửa")).toBeVisible();
  await expect(history.locator(".chat-edit-history-text")).toHaveText([original]);
});

test("↑ in an empty box edits my newest message; Esc drops the edit and brings the draft back", async () => {
  const page = admin.page;
  await openThreadWith(page, MANAGER_NAME);
  const older = `Tin cũ hơn e2e-${runId()}`;
  const newest = `Tin mới nhất e2e-${runId()}`;
  await sendFromComposer(page, older);
  await sendFromComposer(page, newest);

  await composer(page).press("ArrowUp");
  await expect(panel(page).getByText("Đang sửa tin nhắn")).toBeVisible();
  await expect(composer(page)).toHaveValue(newest);
  // Files are text-only while editing: no paperclip.
  await expect(panel(page).getByRole("button", { name: "Đính kèm tệp" })).toHaveCount(0);
  await composer(page).press("Escape");
  await expect(panel(page).getByText("Đang sửa tin nhắn")).toBeHidden();
  await expect(composer(page)).toHaveValue("");
  await expect(message(page, newest)).not.toContainText("đã chỉnh sửa");

  // A draft typed before editing survives the edit.
  await composer(page).fill("nháp đang gõ");
  await message(page, older).getByRole("button", { name: "Thao tác tin nhắn" }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  await expect(composer(page)).toHaveValue(older);
  await panel(page).getByRole("button", { name: "Hủy sửa" }).click();
  await expect(composer(page)).toHaveValue("nháp đang gõ");
  await composer(page).fill("");
});

test("once the 15 minutes are over, Sửa is gone from the menu (Thu hồi stays)", async () => {
  const page = admin.page;
  const text = `Sắp hết hạn sửa e2e-${runId()}`;
  // A thread of its own: moved 16 minutes back, the message must still be on the first page.
  const groupName = `Nhóm hết hạn ${runId()}`;
  const group = await patiently(() => call<{ id: string }>(page, "POST", `${CHAT}/conversations/group`, {
    name: groupName,
    memberIds: [manager.userId],
  }));
  await openThreadWith(page, groupName);
  await sendFromComposer(page, text);
  const id = sqlScalar(
    `select "Id" from bd_chat_messages where "ConversationId"='${group.body.id}' order by "SentAt" desc limit 1`,
  );
  sqlScalar(`update bd_chat_messages set "SentAt" = "SentAt" - interval '16 minutes' where "Id"='${id}'`);

  await openThreadWith(page, groupName);
  await message(page, text).getByRole("button", { name: "Thao tác tin nhắn" }).click();
  await expect(page.getByRole("menuitem", { name: "Thu hồi" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("a long file name stays inside its chip while uploading and after, with no sideways scroll", async () => {
  const page = admin.page;
  await openThreadWith(page, MANAGER_NAME);
  const name = `場所・スケジュール・Teamsリンク・会議の議事録・最終版-${runId()}.txt`;
  await panel(page).locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.alloc(6 * 1024 * 1024, "a"),
  });
  const files = panel(page).locator(".chat-composer-files");
  const fits = () => files.evaluate((el) => el.scrollWidth <= el.clientWidth);

  const uploading = panel(page).getByRole("progressbar", { name: new RegExp("Đang tải lên") });
  await expect(uploading).toBeVisible();
  expect(await fits()).toBe(true);
  // The label is localized, never a raw key.
  await expect(uploading).not.toContainText("Chat:");

  await expect(panel(page).getByLabel(`Bỏ tệp ${name}`)).toBeVisible({ timeout: 60_000 });
  expect(await fits()).toBe(true);
  await panel(page).getByLabel(`Bỏ tệp ${name}`).click();
  await expect(files).toHaveCount(0);
});
