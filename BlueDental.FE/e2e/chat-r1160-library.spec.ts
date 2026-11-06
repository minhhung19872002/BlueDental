import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, PNG_1PX_BASE64, patiently, signIn, uploadFile, type Session } from "./fixtures/chatApi";
import { call } from "./fixtures/marketingTicket";

/**
 * Kho lưu trữ (R-1160) in a real browser against the real host and
 * PostgreSQL, no interception. The group and its messages are made through
 * the API; everything after that is clicked.
 */

const PDF_BASE64 = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

let admin: Session;
let manager: Session;
let groupName: string;
let groupId: string;
let linkMessage: string;
const linkUrl = `https://tai-lieu.example.com/huong-dan-${Date.now()}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  await admin.context.grantPermissions(["clipboard-read", "clipboard-write"]);

  groupName = `Kho UI ${runId()}`;
  const group = await call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: groupName,
    memberIds: [manager.userId],
  });
  expect(group.status).toBe(200);
  const id = group.body.id;
  groupId = id;
  const send = async (session: Session, content: string, attachmentIds: string[] = []) => {
    const reply = await patiently(() =>
      call(session.page, "POST", `${CHAT}/conversations/${id}/messages`, { conversationId: id, content, attachmentIds }),
    );
    expect(reply.status).toBe(200);
  };

  const png = await uploadFile(admin.page, id, "phim-ui.png", PNG_1PX_BASE64, "image/png");
  const pdf = await uploadFile(admin.page, id, "bao-gia-ui.pdf", PDF_BASE64, "application/pdf");
  await send(admin, "Ảnh phim và báo giá", [png.body.id!, pdf.body.id!]);
  linkMessage = `Xem hướng dẫn ở ${linkUrl} nhé`;
  await send(manager, linkMessage);
  // Enough after it that the thread opens scrolled well below it.
  for (let i = 0; i < 12; i++) await send(admin, `Tin đệm ${i} e2e`);
});

test.afterAll(async () => {
  // Leaves no unread messages behind for chat.spec's badge check.
  if (groupId) await call(manager.page, "POST", `${CHAT}/conversations/${groupId}/read`);
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const library = (page: Page) => panel(page).getByRole("region", { name: "Kho lưu trữ" });

async function openLibrary(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Mở chat nội bộ" }).click();
  await panel(page).locator(".chat-conversation").filter({ hasText: groupName }).first().click();
  await panel(page).getByRole("button", { name: "Kho lưu trữ" }).click();
  await expect(library(page)).toBeVisible();
}

const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Ngày ${pad(now.getDate())} Tháng ${pad(now.getMonth() + 1)}`;
};

test("tabs Ảnh / File / Link list what was sent, under today's heading", async () => {
  const page = admin.page;
  await openLibrary(page);
  const box = library(page);

  await expect(box.getByRole("region", { name: today() })).toBeVisible();
  await expect(box.getByRole("img", { name: "phim-ui.png" })).toBeVisible();

  await box.getByRole("button", { name: "File", exact: true }).click();
  await expect(box.getByText("bao-gia-ui.pdf")).toBeVisible();
  await expect(box.getByText("phim-ui.png")).toHaveCount(0);

  await box.getByRole("button", { name: "Link", exact: true }).click();
  const link = box.getByRole("link", { name: new RegExp(linkUrl.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")) });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", linkUrl);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("Người gửi narrows the list and says when nothing matches", async () => {
  const page = admin.page;
  await openLibrary(page);
  const box = library(page);
  await box.getByRole("button", { name: "Link", exact: true }).click();
  await expect(box.getByText(linkUrl)).toBeVisible();

  await box.getByRole("combobox", { name: "Người gửi" }).click();
  await page.locator(".ant-select-item-option", { hasText: "Phạm Văn Danh" }).click();
  await expect(box.getByText("Không có mục nào khớp bộ lọc")).toBeVisible();
  await box.getByRole("combobox", { name: "Người gửi" }).click();
  await page.locator(".ant-select-item-option", { hasText: "Quản lý toàn phòng khám" }).click();
  await expect(box.getByText(linkUrl)).toBeVisible();
});

test("Chọn: ticked files download, ticked links are copied", async () => {
  const page = admin.page;
  await openLibrary(page);
  const box = library(page);

  await box.getByRole("button", { name: "File", exact: true }).click();
  await box.getByRole("button", { name: "Chọn", exact: true }).click();
  await box.getByRole("checkbox", { name: /bao-gia-ui\.pdf/ }).check();
  const bar = box.getByRole("toolbar");
  await expect(bar.getByText("Đã chọn 1")).toBeVisible();
  const download = page.waitForEvent("download");
  await bar.getByRole("button", { name: "Tải về" }).click();
  expect((await download).suggestedFilename()).toBe("bao-gia-ui.pdf");
  await expect(bar).toBeHidden();

  await box.getByRole("button", { name: "Link", exact: true }).click();
  await box.getByRole("button", { name: "Chọn", exact: true }).click();
  await box.getByRole("checkbox", { name: new RegExp("tai-lieu\\.example\\.com") }).check();
  await box.getByRole("toolbar").getByRole("button", { name: "Sao chép link" }).click();
  await expect(page.getByText("Đã sao chép 1 link")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(linkUrl);
});

test("Xem tin nhắn brings the thread back scrolled to that message, past late images", async () => {
  const page = admin.page;
  await openLibrary(page);
  const box = library(page);
  await box.getByRole("button", { name: "Link", exact: true }).click();
  await box.getByRole("listitem").filter({ hasText: linkUrl }).getByRole("button", { name: "Xem tin nhắn" }).click();

  await expect(library(page)).toBeHidden();
  const target = panel(page).locator(".chat-message").filter({ hasText: linkMessage });
  await expect(target).toBeInViewport();
  await expect(target).toHaveClass(/chat-message--flash/);
});
