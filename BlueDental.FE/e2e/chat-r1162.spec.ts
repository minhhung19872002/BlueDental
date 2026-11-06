import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, type Session } from "./fixtures/chatApi";
import { call } from "./fixtures/marketingTicket";

/**
 * R-1162 composer (chat-security-checklist.md I1.1, I1.9, I6.1) in a real
 * browser against the real host, ClamAV and PostgreSQL, no interception:
 * × stops an upload on its way, a file the server refuses stays as a chip to
 * try again or drop (and blocks sending), and the length counter.
 */

const MANAGER_NAME = "Quản lý toàn phòng khám";
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

let admin: Session;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  const manager = await signIn(browser, MANAGER_USER);
  await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }));
  await manager.context.close();
});

test.afterAll(async () => {
  await admin?.context.close();
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });
const sendButton = (page: Page) => panel(page).getByRole("button", { name: "Gửi", exact: true });
const chips = (page: Page) => panel(page).locator(".chat-composer-files .ant-tag");

async function openThread(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Mở chat nội bộ" }).click();
  await panel(page).locator(".chat-conversation").filter({ hasText: MANAGER_NAME }).first().click();
  await expect(composer(page)).toBeVisible();
}

test("I1.1: × on a file still uploading stops it and drops the chip; the words still send", async () => {
  const page = admin.page;
  await openThread(page);
  const name = `ban-chup-lon-${runId()}.txt`;
  await panel(page).locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.alloc(45 * 1024 * 1024, "a"),
  });
  await expect(panel(page).getByRole("progressbar", { name: new RegExp(name) })).toBeVisible();
  const text = `Không kèm tệp nữa e2e-${runId()}`;
  await composer(page).fill(text);
  // While the file is on its way the message waits for it.
  await expect(sendButton(page)).toBeDisabled();

  await panel(page).getByRole("button", { name: `Huỷ tải lên ${name}` }).click();
  await expect(chips(page)).toHaveCount(0);
  await expect(sendButton(page)).toBeEnabled();
  await composer(page).press("Enter");
  const sent = panel(page).locator(".chat-message").filter({ hasText: text });
  await expect(sent).toBeVisible();
  await expect(sent.locator(".chat-attachments")).toHaveCount(0);
});

test("I1.9: a file the scan refuses stays as a failed chip — try again, then drop it to send", async () => {
  const page = admin.page;
  await openThread(page);
  const name = `nhiem-${runId()}.txt`;
  const uploads: number[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/attachments") && r.request().method() === "POST") uploads.push(r.status());
  });
  await panel(page).locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(EICAR) });

  const retry = panel(page).getByRole("button", { name: `Tải lên lại ${name}` });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(panel(page).locator(".chat-upload-chip--failed")).toContainText("Tải lên lỗi");
  await composer(page).fill(`Có tệp lỗi e2e-${runId()}`);
  await expect(sendButton(page)).toBeDisabled();

  // Trying again really uploads again (and is refused again).
  await retry.click();
  await expect.poll(() => uploads.length, { timeout: 30_000 }).toBe(2);
  await expect(retry).toBeVisible();
  expect(uploads.every((status) => status >= 400)).toBe(true);

  await panel(page).getByRole("button", { name: `Bỏ tệp ${name}` }).click();
  await expect(chips(page)).toHaveCount(0);
  await expect(sendButton(page)).toBeEnabled();
});

test("I6.1: the counter shows in the last 400 characters, turns red at 4.000 and the box stops there", async () => {
  const page = admin.page;
  await openThread(page);
  const counter = panel(page).locator(".chat-char-count");

  await composer(page).fill("a".repeat(3500));
  await expect(counter).toHaveCount(0);
  await composer(page).fill("a".repeat(3700));
  await expect(counter).toHaveText("3.700/4.000");
  await expect(counter).toHaveAttribute("aria-label", "Còn 300 ký tự");
  await expect(counter).not.toHaveClass(/chat-char-count--full/);

  await composer(page).fill("a".repeat(4000));
  await composer(page).press("End");
  await composer(page).pressSequentially("bcd");
  await expect(composer(page)).toHaveValue("a".repeat(4000));
  await expect(counter).toHaveText("4.000/4.000");
  await expect(counter).toHaveClass(/chat-char-count--full/);
  await composer(page).fill("");
  await expect(counter).toHaveCount(0);
});
