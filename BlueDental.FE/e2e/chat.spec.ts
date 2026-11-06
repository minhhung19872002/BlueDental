import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { signIn, type Session } from "./fixtures/chatApi";

/**
 * Chat nội bộ (F-89 / R-1157) in the real browser against the real host and
 * PostgreSQL: two staff logged in through the login screen, no interception.
 * Admin (Phạm Văn Danh) writes to manager (Quản lý toàn phòng khám).
 */

const ADMIN_NAME = "Phạm Văn Danh";
const MANAGER_NAME = "Quản lý toàn phòng khám";

let admin: Session;
let manager: Session;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
});

test.afterAll(async () => {
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const chatButton = (page: Page) => page.getByRole("button", { name: "Mở chat nội bộ" });
const arrivalButton = (page: Page) => page.locator(".arrival-dock-button");
const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
}

async function openThreadWith(page: Page, title: string) {
  await page.reload();
  await chatButton(page).click();
  await panel(page).locator(".chat-conversation").filter({ hasText: title }).first().click();
  await expect(composer(page)).toBeVisible();
}

const message = (page: Page, text: string) => panel(page).locator(".chat-message").filter({ hasText: text });

test("the chat button sits bottom-right, Mời lên to its left, and both move left of the open panel", async () => {
  const page = admin.page;
  await expect(chatButton(page)).toBeVisible();
  await expect(arrivalButton(page)).toBeVisible();
  const viewport = page.viewportSize()!;

  const chatClosed = await box(chatButton(page));
  const arrivalClosed = await box(arrivalButton(page));
  expect(viewport.width - (chatClosed.x + chatClosed.width)).toBeLessThanOrEqual(32);
  expect(arrivalClosed.x + arrivalClosed.width).toBeLessThanOrEqual(chatClosed.x);

  await chatButton(page).click();
  await expect(panel(page)).toBeVisible();
  const aside = await box(panel(page));
  const chatOpen = await box(chatButton(page));
  const arrivalOpen = await box(arrivalButton(page));
  expect(viewport.width - (aside.x + aside.width)).toBeLessThanOrEqual(24);
  expect(chatOpen.x + chatOpen.width).toBeLessThanOrEqual(aside.x);
  expect(arrivalOpen.x + arrivalOpen.width).toBeLessThanOrEqual(chatOpen.x);

  await panel(page).getByRole("button", { name: "Đóng" }).click();
  await expect(panel(page)).toBeHidden();
});

test("a message and a file reach the other person, who sees the unread badge and downloads the file", async () => {
  const text = `Chào chị, phim của bệnh nhân e2e-${runId()}`;
  const fileName = `ghi-chu-${runId()}.txt`;
  const page = admin.page;

  await chatButton(page).click();
  await panel(page).getByRole("button", { name: "Cuộc trò chuyện mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Cuộc trò chuyện mới" });
  await dialog.getByRole("textbox", { name: "Tìm nhân viên" }).fill("manager");
  await dialog.getByRole("button", { name: new RegExp(MANAGER_NAME) }).click();
  await expect(dialog).toBeHidden();
  await expect(panel(page).getByText(MANAGER_NAME).first()).toBeVisible();

  await composer(page).fill(text);
  await composer(page).press("Enter");
  await expect(message(page, text)).toBeVisible();
  await expect(composer(page)).toHaveValue("");

  await panel(page).locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("Hẹn tái khám thứ Hai"),
  });
  await expect(panel(page).getByLabel(`Bỏ tệp ${fileName}`)).toBeVisible();
  await panel(page).getByRole("button", { name: "Gửi" }).click();
  await expect(panel(page).getByRole("button", { name: `Tải xuống ${fileName}` })).toBeVisible();

  // Manager: a separate browser, a fresh page load.
  const other = manager.page;
  await other.reload();
  await expect(chatButton(other).locator(".chat-dock-badge")).toHaveText(/^[1-9]\d*\+?$/);
  await openThreadWith(other, ADMIN_NAME);
  await expect(message(other, text)).toBeVisible();
  const downloadButton = panel(other).getByRole("button", { name: `Tải xuống ${fileName}` });
  const [download] = await Promise.all([other.waitForEvent("download"), downloadButton.click()]);
  expect(download.suggestedFilename()).toBe(fileName);
  const saved = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of saved) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).toString("utf8")).toBe("Hẹn tái khám thứ Hai");

  // Reading the thread clears the badge.
  await other.reload();
  await expect(chatButton(other)).toBeVisible();
  await expect(chatButton(other).locator(".chat-dock-badge")).toHaveCount(0);
});

test("the sender edits a message and recalls the file; both survive a reload on either side", async () => {
  const page = admin.page;
  const original = `Bản nháp e2e-${runId()}`;
  const edited = `${original} (đã chỉnh)`;
  const fileName = `huy-${runId()}.txt`;

  await openThreadWith(page, MANAGER_NAME);
  await composer(page).fill(original);
  await composer(page).press("Enter");
  await expect(message(page, original)).toBeVisible();

  await message(page, original).getByRole("button", { name: "Thao tác tin nhắn" }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  await expect(panel(page).getByText("Đang sửa tin nhắn")).toBeVisible();
  await expect(composer(page)).toHaveValue(original);
  await composer(page).fill(edited);
  await panel(page).getByRole("button", { name: "Lưu" }).click();
  await expect(message(page, edited)).toContainText("đã sửa");

  await panel(page).locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("sẽ thu hồi"),
  });
  await expect(panel(page).getByLabel(`Bỏ tệp ${fileName}`)).toBeVisible();
  await panel(page).getByRole("button", { name: "Gửi" }).click();
  const fileMessage = panel(page).locator(".chat-message").filter({
    has: page.getByRole("button", { name: `Tải xuống ${fileName}` }),
  });
  await expect(fileMessage).toBeVisible();
  await fileMessage.getByRole("button", { name: "Thao tác tin nhắn" }).click();
  await page.getByRole("menuitem", { name: "Thu hồi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Thu hồi" }).click();
  await expect(panel(page).getByRole("button", { name: `Tải xuống ${fileName}` })).toHaveCount(0);
  const recalled = panel(page).locator(".chat-message--recalled").last();
  await expect(recalled).toHaveText(/Tin nhắn đã được thu hồi/);
  await expect(recalled.getByRole("button", { name: "Thao tác tin nhắn" })).toHaveCount(0);

  for (const viewer of [page, manager.page]) {
    await openThreadWith(viewer, viewer === page ? MANAGER_NAME : ADMIN_NAME);
    await expect(message(viewer, edited)).toContainText("đã sửa");
    await expect(panel(viewer).getByText(original, { exact: true })).toHaveCount(0);
    await expect(panel(viewer).getByRole("button", { name: `Tải xuống ${fileName}` })).toHaveCount(0);
    await expect(panel(viewer).locator(".chat-message--recalled").last()).toHaveText(/Tin nhắn đã được thu hồi/);
  }
});
