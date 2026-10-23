import { createHash } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: CSKH ▸ Hộp thư Zalo + the record's Lịch sử chăm sóc (F-80, BA P2210).
 *
 * A customer's message comes in by Zalo's signed webhook; Nhận xử lý holds the
 * conversation, the holder answers with a "tin tư vấn", hands it on or lets it
 * go; Chưa trả lời / Đã chăm sóc follow the chat; free-text tags; care notes
 * are written, changed and struck through with a log, and are the same notes
 * on the record; the ZNS row fills a template with the customer and sends it;
 * the record's Chăm sóc KH tab opens the chat and the send screen and lists
 * the whole care history. cskhInbox read / update; branch scope.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Zalo
 * is the local stub (e2e/fixtures/zalo-stub.mjs) — never the real OA — and
 * the host must sign webhooks with the secret below, so the spec runs only
 * with E2E_ZALO_STUB=1. Host env: Zalo__AppId=e2e-app,
 * Zalo__AppSecret=e2e-app-secret, Zalo__WebhookSecret=e2e-webhook-secret,
 * Zalo__OaId=stub-oa and the three base URLs on the stub.
 */

const INBOX = "/api/v1/app/zalo-inbox";
const ZALO = "/api/v1/app/zalo";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const STUB_URL = process.env.E2E_ZALO_STUB_URL ?? "http://127.0.0.1:5199";
const APP_ID = process.env.E2E_ZALO_APP_ID ?? "e2e-app";
const WEBHOOK_SECRET = process.env.E2E_ZALO_WEBHOOK_SECRET ?? "e2e-webhook-secret";
const OA_ID = process.env.E2E_ZALO_OA_ID ?? "stub-oa";
const PASSWORD = "HopThu@123456";
const CHANNEL_ZALO = 1;
const CARE_APPOINTMENT_REMINDER = 3;
const asBranchOne = { branchId: BRANCH_ONE };

interface Patient {
  id: string;
  code: string;
  name: string;
  phone: string;
}

interface Conversation {
  id: string;
  status: number;
  holderId: string | null;
  patientId: string | null;
  tags: string[];
}

const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]", { hasText: text });
const conversationRow = (page: Page, name: string) =>
  page.getByRole("region", { name: "Danh sách hội thoại" }).getByRole("button", { name: new RegExp(name) });
const chat = (page: Page) => page.locator(".ibx-chat");
/** A message bubble — not the reply box, whose typed text the chat region also contains. */
const bubble = (page: Page, text: string) =>
  chat(page).locator(".ibx-bubble-text").filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
const side = (page: Page) => page.getByRole("complementary", { name: "Thông tin khách hàng" });
const statusCard = (page: Page) =>
  page.getByRole("region", { name: "Lịch sử chăm sóc khách hàng" }).getByRole("region", { name: "Trạng thái chăm sóc" });

/** A Zalo user id no earlier run used: digits, like Zalo's. */
function zaloUser(): string {
  return `45${runId()}${String(Math.floor(Math.random() * 9000 + 1000))}`;
}

/** Signs and posts a webhook event the way Zalo does: mac = sha256(appId + body + timestamp + secret). */
async function webhook(page: Page, event: Record<string, unknown>): Promise<void> {
  const timestamp = String(event.timestamp ?? Date.now());
  const body = JSON.stringify({ app_id: APP_ID, timestamp, ...event });
  const mac = createHash("sha256").update(APP_ID + body + timestamp + WEBHOOK_SECRET).digest("hex");
  const res = await page.request.post(`${ZALO}/webhook`, {
    data: body,
    headers: { "content-type": "application/json", "X-ZEvent-Signature": `mac=${mac}` },
  });
  expect(res.status()).toBe(200);
}

/** The customer writes to the OA. */
async function customerWrites(page: Page, userId: string, text: string, at = Date.now()): Promise<void> {
  await webhook(page, {
    event_name: "user_send_text",
    timestamp: String(at),
    sender: { id: userId },
    recipient: { id: OA_ID },
    message: { msg_id: `in-${userId}-${at}`, text },
  });
}

async function stub(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${STUB_URL}${path}`, { method: "POST", body: JSON.stringify(body) });
  expect(res.ok).toBeTruthy();
}

async function stubCalls(path: string): Promise<{ path: string; body: string; query: string }[]> {
  const calls = (await (await fetch(`${STUB_URL}/__calls`)).json()) as { path: string; body: string; query: string }[];
  return calls.filter((c) => c.path === path);
}

async function newPatient(page: Page): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `Hộp thư ${suffix}`;
  const phone = `09${suffix.padStart(8, "0").slice(-8)}`;
  const res = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
    ...asBranchOne,
    method: "POST",
    json: { firstName, lastName: "E2E", dateOfBirth: null, gender: "female", phoneNumber: phone },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, code: res.body.patientCode, name: `E2E ${firstName}`, phone };
}

/** The conversation the inbox opened for a Zalo user, found through the list search by their shown name. */
async function conversationOf(page: Page, name: string): Promise<Conversation> {
  const res = await call<{ items: (Conversation & { displayName: string; patientName: string | null })[] }>(
    page,
    `${INBOX}/conversations?tab=3&filter=${encodeURIComponent(name)}`,
    asBranchOne,
  );
  expect(res.status).toBe(200);
  const found = res.body.items.find((c) => (c.patientName ?? c.displayName) === name);
  expect(found, `conversation of ${name}`).toBeTruthy();
  return found!;
}

/** A ready Zalo template on ZNS #301001 with every parameter filled, the customer's name included. */
async function znsTemplate(page: Page, name: string, promoNote = `Ghi chú ${name}`): Promise<{ id: string; name: string }> {
  const res = await call<{ id: string; status: number }>(page, "/api/v1/app/message-templates", {
    ...asBranchOne,
    method: "POST",
    json: {
      publish: true,
      channel: CHANNEL_ZALO,
      name,
      purpose: CARE_APPOINTMENT_REMINDER,
      content: null,
      subject: null,
      externalTemplateId: "301001",
      paramMap: {
        customer_name: "{ten_khach_hang}",
        booking_date: "01/01/2031",
        booking_time: "09:00",
        promo_note: promoNote,
      },
      removeDiacritics: false,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.status, "the stub approved #301001").toBe(1);
  return { id: res.body.id, name };
}

async function openInbox(page: Page, conversationId?: string): Promise<void> {
  const loaded = assertRealApiTraffic(page, `${INBOX}/conversations`);
  await page.goto(`/cskh-grouping?branch=BD-001&tab=inbox${conversationId ? `&conversation=${conversationId}` : ""}`);
  await loaded;
}

/** A throw-away role holding just `grants`, and a staff member of BD-001 in it. */
async function makeStaff(page: Page, grants: string[]) {
  const id = runId() + String(Math.floor(Math.random() * 90 + 10));
  const roleName = `Hộp thư ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const granted = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: grants.map((name) => ({ name, isGranted: true })) },
  });
  expect(granted.status).toBe(204);

  const userName = `hopthu${id}`;
  const fullName = `Nhân viên hộp thư ${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: fullName,
      email: `${userName}@bluedental.local`,
      phoneNumber: null,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status, JSON.stringify(staff.body)).toBe(200);

  const tearDown = async () => {
    await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
    await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  };
  return { id: staff.body.id, name: fullName, credentials: { userName, password: PASSWORD }, tearDown };
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("CSKH — Hộp thư Zalo (Zalo giả lập)", () => {
  test.skip(!process.env.E2E_ZALO_STUB, "cần host trỏ Zalo về e2e/fixtures/zalo-stub.mjs (E2E_ZALO_STUB=1)");
  test.describe.configure({ timeout: 180_000 });

  let linkedHere = false;

  // Linked the way a manager links the real OA: the signed state from
  // connect-url comes back on Zalo's redirect, and the stub takes any code.
  test.beforeEach(async ({ page }) => {
    await login(page);
    const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, asBranchOne);
    linkedHere = !status.body.isConnected;
    if (!linkedHere) return;

    const connect = await call<{ url: string }>(page, `${ZALO}/connect-url`, asBranchOne);
    expect(connect.status, "connect-url needs the host's Zalo app credentials").toBe(200);
    const state = new URL(connect.body.url).searchParams.get("state") ?? "";
    const callback = await page.request.get(`${ZALO}/oauth/callback`, {
      params: { code: "stub-code", state },
      maxRedirects: 0,
    });
    expect(callback.headers().location).toContain("zalo=connected");
  });

  test.afterEach(async ({ page }) => {
    if (!linkedHere) return;
    const unlinked = await call(page, `${ZALO}/connection`, { ...asBranchOne, method: "DELETE" });
    expect(unlinked.status, "unlink the stub OA").toBe(204);
  });

  test("Tin đến → Nhận xử lý → trả lời → Đã chăm sóc; tag tự do; ghi chú tạo / sửa / xoá có log; tải lại vẫn còn", async ({ page }) => {
    const userId = zaloUser();
    const name = `Khách Zalo ${userId.slice(-6)}`;
    await stub("/__users", { userId, displayName: name });
    await customerWrites(page, userId, "Em niềng 1 tuần vẫn đau, có sao không ạ?");

    await openInbox(page);
    const row = conversationRow(page, name);
    await expect(row).toContainText("Chưa trả lời");
    await row.click();
    await expect(chat(page).getByRole("heading", { name })).toBeVisible();
    await expect(bubble(page, "Em niềng 1 tuần vẫn đau, có sao không ạ?")).toBeVisible();
    await expect(page.getByText("Bấm Nhận xử lý để trả lời.", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nội dung trả lời" })).toBeDisabled();

    await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
    await expect(chat(page).getByText("Bạn đang xử lý")).toBeVisible();
    // Just in: the full 48 hours, never "49" (the clock is floored to the minute).
    await expect(page.getByText(/Còn 48 giờ để trả lời trong khung 48 giờ/)).toBeVisible();

    const sentBefore = (await stubCalls("/v3.0/oa/message/cs")).length;
    await page.getByRole("textbox", { name: "Nội dung trả lời" }).fill("Dạ, chị qua phòng khám để bác sĩ kiểm tra ạ.");
    await page.getByRole("button", { name: /^send Gửi$/ }).click();
    await expect(bubble(page, "Dạ, chị qua phòng khám để bác sĩ kiểm tra ạ.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nội dung trả lời" })).toHaveValue("");
    await expect(chat(page)).toContainText(/Gửi bởi/);
    const sent = (await stubCalls("/v3.0/oa/message/cs")).slice(sentBefore);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0].body)).toMatchObject({
      recipient: { user_id: userId },
      message: { text: "Dạ, chị qua phòng khám để bác sĩ kiểm tra ạ." },
    });
    await expect(chat(page).locator(".ibx-chat-actions")).toContainText("Đã chăm sóc");

    // Tag: free text, saved at once.
    await side(page).getByRole("button", { name: /Tag$/ }).click();
    const tagBox = side(page).getByRole("combobox", { name: "Nhập tag" });
    await tagBox.fill(`Niềng răng ${userId.slice(-3)}`);
    await tagBox.press("Enter");
    await expect(side(page).locator(".ibx-tag", { hasText: `Niềng răng ${userId.slice(-3)}` })).toBeVisible();

    // Notes: write, change (logged), strike through (stays, with who).
    await side(page).getByRole("button", { name: /Thêm ghi chú$/ }).click();
    await side(page).getByRole("textbox", { name: "Nội dung ghi chú" }).fill("Khách hay hỏi lúc tối");
    await side(page).getByRole("button", { name: "Lưu ghi chú" }).click();
    const note = side(page).locator(".cn-note", { hasText: "Khách hay hỏi lúc tối" });
    await expect(note).toBeVisible();
    await note.getByRole("button", { name: "Sửa ghi chú" }).click();
    await side(page).getByRole("textbox", { name: "Nội dung ghi chú" }).fill("Ưu tiên trả lời trước 18h");
    await side(page).getByRole("button", { name: "Lưu thay đổi" }).click();
    const edited = side(page).locator(".cn-note", { hasText: "Ưu tiên trả lời trước 18h" });
    await expect(edited).toContainText("Đã sửa bởi");
    await edited.getByRole("button", { name: "Lịch sử ghi chú" }).click();
    await expect(page.getByRole("list", { name: "Lịch sử ghi chú" })).toContainText("Trước: Khách hay hỏi lúc tối");
    await page.keyboard.press("Escape");
    await edited.getByRole("button", { name: "Xoá ghi chú" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Xoá$/ }).click();
    await expect(edited).toHaveClass(/cn-note--removed/);
    await expect(edited).toContainText("Đã xoá bởi");

    // Everything is the server's: a reload shows the same.
    await page.reload();
    await expect(bubble(page, "Dạ, chị qua phòng khám để bác sĩ kiểm tra ạ.")).toBeVisible();
    await expect(side(page).locator(".ibx-tag", { hasText: `Niềng răng ${userId.slice(-3)}` })).toBeVisible();
    await expect(side(page).locator(".cn-note--removed", { hasText: "Ưu tiên trả lời trước 18h" })).toBeVisible();

    // Nhả hội thoại: back to Nhận xử lý for everyone.
    await chat(page).getByRole("button", { name: "Nhả hội thoại" }).click();
    await expect(toast(page, "Đã nhả hội thoại")).toBeVisible();
    await expect(chat(page).getByRole("button", { name: "Nhận xử lý" })).toBeVisible();

    // The customer writes again: Chưa trả lời again.
    await customerWrites(page, userId, "Mai em qua được không ạ?");
    await expect(bubble(page, "Mai em qua được không ạ?")).toBeVisible({ timeout: 15_000 });
    await expect(conversationRow(page, name)).toContainText("Chưa trả lời", { timeout: 15_000 });
  });

  test("Đồng bộ lịch sử Zalo, liên kết hồ sơ qua SĐT khách chia sẻ; ZNS: chọn mẫu đổ dữ liệu khách, chọn mẫu khác thì thay, gửi", async ({ page }) => {
    const patient = await newPatient(page);
    const userId = zaloUser();
    const start = Date.now() - 60 * 60_000;
    await stub("/__users", { userId, displayName: `Zalo ${patient.name}`, phone: `84${patient.phone.slice(1)}` });
    await stub("/__history", {
      userId,
      items: [
        ...Array.from({ length: 12 }, (_, i) => ({
          messageId: `h-${userId}-${i}`,
          fromOa: i % 2 === 1,
          text: `Tin lịch sử ${i}`,
          time: start + i * 60_000,
        })),
        // An OA message of another type that still carries words: they show, not "[Tin nhắn khác]".
        { messageId: `h-${userId}-tpl`, fromOa: true, type: "template", text: "Mời anh chị đánh giá dịch vụ", time: start + 12 * 60_000 },
      ],
    });
    const first = await znsTemplate(page, `E2E Hộp thư A ${runId()}`);
    const second = await znsTemplate(page, `E2E Hộp thư B ${runId()}`);

    // Opening the tab reads Zalo's recent chats; the shared phone links the record.
    await openInbox(page);
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    const row = conversationRow(page, patient.name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(side(page)).toContainText(`[${patient.code}] ${patient.name}`);
    await expect(side(page).getByRole("heading", { name: "Lịch hẹn" })).toBeVisible();

    // The newest 10 on open (3…11 + the template message), the rest on "Tải tin cũ hơn".
    await expect(bubble(page, "Mời anh chị đánh giá dịch vụ")).toBeVisible();
    await expect(chat(page).getByText("[Tin nhắn khác]")).toHaveCount(0);
    await expect(bubble(page, "Tin lịch sử 11")).toBeVisible();
    await expect(chat(page).locator(".ibx-bubble-text")).toHaveCount(10);
    await expect(bubble(page, "Tin lịch sử 1")).toHaveCount(0);
    await chat(page).getByRole("button", { name: "Tải tin cũ hơn" }).click();
    await expect(bubble(page, "Tin lịch sử 0")).toBeVisible();
    await expect(chat(page).locator(".ibx-bubble-text")).toHaveCount(13);

    await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
    await expect(chat(page).getByText("Bạn đang xử lý")).toBeVisible();

    // The newest templates are the chips; a pick fills it with the customer.
    const znsRow = page.getByRole("group", { name: "Mẫu ZNS" });
    await znsRow.getByRole("button", { name: `Mẫu: ${second.name}` }).click();
    const card = page.getByRole("region", { name: "Kiểm tra tin ZNS trước khi gửi" });
    await expect(card).toContainText(`ZNS · ${second.name}`);
    await expect(card).toContainText(patient.name);
    await expect(card).toContainText(`Ghi chú ${second.name}`);

    // Picking another replaces the first, through "Xem thêm".
    await znsRow.getByRole("button", { name: "Xem thêm" }).click();
    const dialog = page.getByRole("dialog", { name: "Chọn mẫu ZNS" });
    await dialog.getByRole("searchbox", { name: "Tìm tên mẫu" }).fill(first.name);
    await dialog.getByRole("button", { name: new RegExp(first.name) }).click();
    await expect(card).toContainText(`ZNS · ${first.name}`);
    await expect(card).not.toContainText(second.name);
    await expect(page.getByRole("region", { name: "Kiểm tra tin ZNS trước khi gửi" })).toHaveCount(1);

    const znsBefore = (await stubCalls("/message/template")).length;
    await card.getByRole("button", { name: /Gửi ZNS$/ }).click();
    await expect(toast(page, `Đã gửi ZNS ${first.name}`)).toBeVisible();
    const zns = (await stubCalls("/message/template")).slice(znsBefore);
    expect(zns).toHaveLength(1);
    expect(JSON.parse(zns[0].body)).toMatchObject({
      template_id: "301001",
      template_data: { customer_name: patient.name, promo_note: `Ghi chú ${first.name}` },
    });
    await expect(chat(page).locator(".ibx-bubble--zns", { hasText: `ZNS · ${first.name}` })).toBeVisible();
  });

  test("Tin OA đã lưu không có chữ: Đồng bộ lại điền chữ vào cả dòng hội thoại lẫn bong bóng, tải lại vẫn còn", async ({ page }) => {
    const userId = zaloUser();
    const name = `Khách Zalo ${userId.slice(-6)}`;
    const messageId = `tpl-${userId}`;
    const time = Date.now() - 5 * 60_000;
    const words = "Mời anh chị đánh giá dịch vụ";
    await stub("/__users", { userId, displayName: name });
    // Stored the way the old sync left it: a template message without its words.
    await stub("/__history", { userId, items: [{ messageId, fromOa: true, type: "template", text: "", time }] });

    await openInbox(page);
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    const row = conversationRow(page, name);
    await expect(row).toContainText("[Tin nhắn khác]", { timeout: 15_000 });

    // Zalo hands the same message over again, words included.
    await stub("/__history", { userId, items: [{ messageId, fromOa: true, type: "template", text: words, time }] });
    await page.getByRole("button", { name: /Đồng bộ$/ }).click();
    await expect(row).toContainText(words);
    await expect(row).not.toContainText("[Tin nhắn khác]");
    await row.click();
    await expect(bubble(page, words)).toBeVisible();
    await expect(chat(page).getByText("[Tin nhắn khác]")).toHaveCount(0);

    await page.reload();
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    await expect(conversationRow(page, name)).toContainText(words);
    await expect(bubble(page, words)).toBeVisible();
  });

  test("Giữ hội thoại: người khác thấy đang giữ và không nhận được; Chuyển cho → người kia trả lời; quá 48 giờ chỉ gửi ZNS", async ({ page, browser }) => {
    const colleague = await makeStaff(page, ["BlueDental.cskhInbox.read", "BlueDental.cskhInbox.update"]);
    try {
      const userId = zaloUser();
      const name = `Khách giữ ${userId.slice(-6)}`;
      await stub("/__users", { userId, displayName: name });
      await customerWrites(page, userId, "Cho em hỏi giá niềng");
      const conversation = await conversationOf(page, name);

      await openInbox(page, conversation.id);
      await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
      await expect(chat(page).getByText("Bạn đang xử lý")).toBeVisible();

      const other = await openSession(browser, colleague.credentials);
      try {
        await openInbox(other.page, conversation.id);
        await expect(chat(other.page).locator(".ibx-pill--holder")).toContainText("đang giữ");
        await expect(chat(other.page).getByRole("button", { name: "Nhận xử lý" })).toHaveCount(0);
        const refused = await call(other.page, `${INBOX}/conversations/${conversation.id}/claim`, {
          ...asBranchOne,
          method: "POST",
        });
        expect(refused.status, "someone else holds it").toBe(403);
        expect(JSON.stringify(refused.body)).toContain("BlueDental:ZaloInbox:0001");

        // Chuyển cho người khác: only staff who may handle the inbox are offered.
        await chat(page).getByRole("button", { name: "Chuyển cho..." }).click();
        const dialog = page.getByRole("dialog", { name: "Chuyển cho người khác" });
        await dialog.getByRole("radio", { name: colleague.name }).check();
        await dialog.getByRole("button", { name: /Chuyển$/ }).click();
        await expect(toast(page, `Đã chuyển hội thoại cho ${colleague.name}`)).toBeVisible();
        await expect(chat(page).getByRole("textbox", { name: "Nội dung trả lời" })).toBeDisabled();

        await other.page.reload();
        await expect(chat(other.page).getByText("Bạn đang xử lý")).toBeVisible();
        await other.page.getByRole("textbox", { name: "Nội dung trả lời" }).fill("Dạ em gửi bảng giá ạ");
        await other.page.getByRole("button", { name: /^send Gửi$/ }).click();
        await expect(bubble(other.page, "Dạ em gửi bảng giá ạ")).toBeVisible();
        await expect(chat(other.page)).toContainText(`Gửi bởi ${colleague.name}`);
      } finally {
        await other.context.close();
      }

      // A customer who last wrote three days ago is past Zalo's 48 hours.
      const lateUser = zaloUser();
      const lateName = `Khách cũ ${lateUser.slice(-6)}`;
      await stub("/__users", { userId: lateUser, displayName: lateName });
      await customerWrites(page, lateUser, "Tin từ 3 ngày trước", Date.now() - 72 * 3_600_000);
      const late = await conversationOf(page, lateName);
      await openInbox(page, late.id);
      await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
      await expect(page.getByText("Đã quá 48 giờ từ tin cuối của khách, chỉ gửi được ZNS")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Nội dung trả lời" })).toBeDisabled();
      const closed = await call(page, `${INBOX}/conversations/${late.id}/messages`, {
        ...asBranchOne,
        method: "POST",
        json: { text: "Dạ" },
      });
      expect(JSON.stringify(closed.body)).toContain("BlueDental:ZaloInbox:0003");
    } finally {
      await colleague.tearDown();
    }
  });

  test("Hồ sơ › Chăm sóc KH: Mở chat Zalo, Gửi tin (SMS, khoá khách); Lịch sử chăm sóc đồng bộ ghi chú với chat, Đã liên hệ, tóm tắt năm", async ({ page }) => {
    const patient = await newPatient(page);
    const userId = zaloUser();
    await stub("/__users", { userId, displayName: `Zalo ${patient.name}`, phone: patient.phone });
    await customerWrites(page, userId, "Em muốn đặt lịch tái khám");
    const conversation = await conversationOf(page, patient.name);
    expect(conversation.patientId, "the shared phone linked the record").toBe(patient.id);

    // A note from the chat, before anything is said back.
    const chatNote = `Ghi chú từ chat ${runId()}`;
    const created = await call(page, `${INBOX}/conversations/${conversation.id}/notes`, {
      ...asBranchOne,
      method: "POST",
      json: { content: chatNote },
    });
    expect(created.status).toBe(200);

    await page.goto(`/patient/${patient.id}?branch=BD-001&tab=care`);
    const history = page.getByRole("region", { name: "Lịch sử chăm sóc khách hàng" });
    await expect(history).toContainText("Khách nhắn Zalo OA");
    await expect(history).toContainText("Em muốn đặt lịch tái khám");
    await expect(history).toContainText(chatNote);
    await expect(statusCard(page).locator(".ch-pill")).toHaveText("Chưa liên hệ");
    await expect(statusCard(page).locator(".ibx-pill")).toHaveText("Chưa trả lời");

    // Ghi nhận chăm sóc with a quick tag alone: the note reads the tag, and the chat shows it.
    await history.getByRole("button", { name: "Không nghe máy" }).click();
    await history.getByRole("button", { name: "Lưu ghi chú" }).click();
    await expect(history.locator(".ch-line", { hasText: "Ghi chú" }).locator(".cn-outcome", { hasText: "Không nghe máy" }).first()).toBeVisible();

    // Filters.
    await history.getByRole("tab", { name: "Chat Zalo" }).click();
    await expect(history).toContainText("Em muốn đặt lịch tái khám");
    await expect(history).not.toContainText(chatNote);
    await history.getByRole("tab", { name: "Ghi chú" }).click();
    await expect(history).toContainText(chatNote);
    await expect(history).not.toContainText("Em muốn đặt lịch tái khám");
    await history.getByRole("tab", { name: "Tất cả" }).click();

    // Mở chat Zalo lands on the conversation, where both notes are.
    await page.getByRole("button", { name: /Mở chat Zalo$/ }).click();
    await expect(page).toHaveURL(new RegExp(`tab=inbox&conversation=${conversation.id}`));
    await expect(side(page)).toContainText(chatNote);
    await expect(side(page).locator(".cn-outcome", { hasText: "Không nghe máy" })).toBeVisible();

    // An answer in the chat makes the record Đã liên hệ.
    await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
    await page.getByRole("textbox", { name: "Nội dung trả lời" }).fill("Dạ em đặt lịch cho chị ạ");
    await page.getByRole("button", { name: /^send Gửi$/ }).click();
    await expect(bubble(page, "Dạ em đặt lịch cho chị ạ")).toBeVisible();

    await page.goto(`/patient/${patient.id}?branch=BD-001&tab=care`);
    await expect(statusCard(page).locator(".ch-pill")).toHaveText("Đã liên hệ");
    await expect(statusCard(page).locator(".ibx-pill")).toHaveText("Đã chăm sóc");
    await expect(history).toContainText("Trả lời Zalo");
    await expect(history.getByRole("region", { name: /Tóm tắt chi phí năm \d{4}/ })).toContainText("Tin nhắn chat Zalo");

    // Gửi tin: Gửi tin nhắn on SMS, this customer locked.
    await page.getByRole("button", { name: /Gửi tin$/ }).click();
    await expect(page).toHaveURL(/\/cskh-grouping\/send\?.*channel=sms.*patientId=/);
    await expect(page.getByRole("radiogroup", { name: "Kênh gửi" }).getByRole("radio", { name: /^SMS/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("row").filter({ hasText: patient.name })).toHaveCount(1, { timeout: 15_000 });
  });

  test("Quyền và chi nhánh: chỉ Xem không nhận xử lý được; Ẩn số điện thoại che cả số trong tin; chi nhánh khác không thấy hội thoại", async ({ page, browser }) => {
    const reader = await makeStaff(page, [
      "BlueDental.cskhInbox.read",
      "BlueDental.treatmentCskh.read",
      "BlueDental.patient.read",
      "BlueDental.patient.hidePhone",
    ]);
    try {
      // A linked customer who got a ZNS carrying their own phone ({so_dien_thoai}).
      const patient = await newPatient(page);
      const userId = zaloUser();
      const name = patient.name;
      await stub("/__users", { userId, displayName: `Zalo ${name}`, phone: patient.phone });
      await customerWrites(page, userId, "Xin chào");
      const conversation = await conversationOf(page, name);
      expect(conversation.patientId).toBe(patient.id);
      const template = await znsTemplate(page, `E2E Hộp thư SĐT ${runId()}`, "SĐT {so_dien_thoai}");
      const claimed = await call(page, `${INBOX}/conversations/${conversation.id}/claim`, { ...asBranchOne, method: "POST" });
      expect(claimed.status).toBe(200);
      const sentZns = await call<{ text: string }>(page, `${INBOX}/conversations/${conversation.id}/zns`, {
        ...asBranchOne,
        method: "POST",
        json: { templateId: template.id },
      });
      expect(sentZns.status, JSON.stringify(sentZns.body)).toBe(200);
      expect(sentZns.body.text, "the admin sees the number").toContain(patient.phone);

      const session = await openSession(browser, reader.credentials);
      try {
        // "Ẩn số điện thoại": the number inside the sent message is masked too, in the chat and the record's history.
        const messages = await call<{ text: string }[]>(session.page, `${INBOX}/conversations/${conversation.id}/messages`, asBranchOne);
        expect(messages.status).toBe(200);
        const zns = messages.body.find((m) => m.text.startsWith("customer_name"));
        expect(zns, "the ZNS is in the chat").toBeTruthy();
        expect(zns!.text).not.toContain(patient.phone);
        expect(zns!.text).toContain(patient.phone.slice(-3));
        const history = await call<{ text: string | null }[]>(session.page, `/api/v1/app/patients/${patient.id}/care-history`, asBranchOne);
        expect(history.status).toBe(200);
        expect(JSON.stringify(history.body)).not.toContain(patient.phone);

        await openInbox(session.page, conversation.id);
        await expect(chat(session.page)).toContainText("Xin chào");
        await expect(chat(session.page).getByRole("button", { name: "Nhận xử lý" })).toHaveCount(0);
        await expect(session.page.getByRole("group", { name: "Mẫu ZNS" })).toHaveCount(0);
        await expect(side(session.page).getByRole("button", { name: /Thêm ghi chú$/ })).toHaveCount(0);
        const claim = await call(session.page, `${INBOX}/conversations/${conversation.id}/claim`, {
          ...asBranchOne,
          method: "POST",
        });
        expect(claim.status).toBe(403);
        const note = await call(session.page, `${INBOX}/conversations/${conversation.id}/notes`, {
          ...asBranchOne,
          method: "POST",
          json: { content: "không được" },
        });
        expect(note.status).toBe(403);
      } finally {
        await session.context.close();
      }

      // Another branch's id is not found, never refused.
      const elsewhere = await call(page, `${INBOX}/conversations/${conversation.id}`, { branchId: BRANCH_TWO });
      expect(elsewhere.status).toBe(404);
      const listed = await call<{ items: { id: string }[] }>(page, `${INBOX}/conversations?tab=3`, { branchId: BRANCH_TWO });
      expect(listed.body.items.map((c) => c.id)).not.toContain(conversation.id);
    } finally {
      await reader.tearDown();
    }
  });
});
