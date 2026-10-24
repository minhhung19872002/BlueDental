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
  sharedPhone: string | null;
  infoRequestedAt: string | null;
  tags: string[];
}

const CARD_TITLE = "Chia sẻ số điện thoại để được tư vấn nhanh hơn";
const CARD_SUBTITLE =
  "Bấm vào đây để gửi số điện thoại Zalo của bạn cho phòng khám. Nhân viên sẽ tra hồ sơ và hỗ trợ bạn ngay.";

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

/** "Người dùng gửi thông tin" (R-1026): the customer sends the OA their details, the phone among them. */
async function sharesInfo(page: Page, userId: string, phone?: string): Promise<void> {
  await webhook(page, {
    event_name: "user_submit_info",
    sender: { id: userId },
    recipient: { id: OA_ID },
    info: phone ? { name: "Khách gửi thông tin", phone, address: "", city: "", district: "", ward: "" } : {},
  });
}

/** A 10-digit number no record of this run holds. */
function freshPhone(): string {
  return `09${(runId() + String(Math.floor(Math.random() * 90 + 10))).slice(-8)}`;
}

/** The Zalo user/detail calls the host made for this user since `from`. */
async function profileReads(userId: string, from = 0): Promise<number> {
  const calls = (await stubCalls("/v3.0/oa/user/detail")).slice(from);
  return calls.filter((c) => decodeURIComponent(c.query).includes(userId)).length;
}

/** The cards asking for the phone (R-1028) sent to this user, after the first `from` "tin tư vấn" calls. */
async function cardsTo(userId: string, from = 0): Promise<Record<string, unknown>[]> {
  return (await stubCalls("/v3.0/oa/message/cs"))
    .slice(from)
    .map((c) => JSON.parse(c.body) as { recipient?: { user_id?: string }; message?: { attachment?: unknown } })
    .filter((b) => b.recipient?.user_id === userId && b.message?.attachment != null);
}

async function syncNow(page: Page): Promise<void> {
  const synced = page.waitForResponse((r) => r.url().endsWith(`${INBOX}/sync`) && r.request().method() === "POST");
  await page.getByRole("button", { name: /Đồng bộ$/ }).click();
  expect((await synced).ok()).toBeTruthy();
}

async function stub(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${STUB_URL}${path}`, { method: "POST", body: JSON.stringify(body) });
  expect(res.ok).toBeTruthy();
}

async function stubCalls(path: string): Promise<{ path: string; body: string; query: string }[]> {
  const calls = (await (await fetch(`${STUB_URL}/__calls`)).json()) as { path: string; body: string; query: string }[];
  return calls.filter((c) => c.path === path);
}

async function newPatient(page: Page, phone = freshPhone()): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `Hộp thư ${suffix}`;
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
    await expect(row).toContainText("[Tin tự động của OA]", { timeout: 15_000 });

    // Zalo hands the same message over again, words included.
    await stub("/__history", { userId, items: [{ messageId, fromOa: true, type: "template", text: words, time }] });
    await page.getByRole("button", { name: /Đồng bộ$/ }).click();
    await expect(row).toContainText(words);
    await expect(row).not.toContainText("[Tin tự động của OA]");
    await row.click();
    await expect(bubble(page, words)).toBeVisible();
    await expect(chat(page).getByText("[Tin tự động của OA]")).toHaveCount(0);

    await page.reload();
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    await expect(conversationRow(page, name)).toContainText(words);
    await expect(bubble(page, words)).toBeVisible();
  });

  test("Tin OA tự gửi mà Zalo không kèm chữ (thẻ chào mừng) đọc là [Tin tự động của OA]; của khách vẫn là [Tin nhắn khác]", async ({ page }) => {
    const oaUser = zaloUser();
    const oaName = `Khách chào ${oaUser.slice(-6)}`;
    const customerUser = zaloUser();
    const customerName = `Khách lạ ${customerUser.slice(-6)}`;
    const time = Date.now() - 5 * 60_000;
    await stub("/__users", { userId: oaUser, displayName: oaName });
    await stub("/__users", { userId: customerUser, displayName: customerName });
    // The welcome card a follow triggers: Zalo's history hands it over with no message, url or thumb.
    await stub("/__history", { userId: oaUser, items: [{ messageId: `welcome-${oaUser}`, fromOa: true, type: "template", text: "", time }] });
    await stub("/__history", { userId: customerUser, items: [{ messageId: `odd-${customerUser}`, fromOa: false, type: "template", text: "", time }] });

    await openInbox(page);
    await page.getByRole("button", { name: /Đồng bộ$/ }).click();
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    const oaRow = conversationRow(page, oaName);
    await expect(oaRow).toContainText("[Tin tự động của OA]", { timeout: 15_000 });
    await expect(oaRow).not.toContainText("[Tin nhắn khác]");
    await expect(conversationRow(page, customerName)).toContainText("[Tin nhắn khác]");

    await oaRow.click();
    await expect(chat(page).getByText("[Tin tự động của OA]")).toBeVisible();
    await expect(chat(page).getByText("[Tin nhắn khác]")).toHaveCount(0);
    await conversationRow(page, customerName).click();
    await expect(chat(page).getByText("[Tin nhắn khác]")).toBeVisible();
    await expect(chat(page).getByText("[Tin tự động của OA]")).toHaveCount(0);
  });

  test("Tải lại vẫn ở chip đang chọn, dòng đang mở vẫn được chọn; link chỉ có hội thoại thì mở ở Tất cả", async ({ page }) => {
    const userId = zaloUser();
    const name = `Khách tải lại ${userId.slice(-6)}`;
    await stub("/__users", { userId, displayName: name });
    await customerWrites(page, userId, "Cho em hỏi lịch tái khám");
    const conversation = await conversationOf(page, name);
    // Answered, so it is not under Chưa trả lời, the chip a fresh inbox opens on.
    const claimed = await call(page, `${INBOX}/conversations/${conversation.id}/claim`, { ...asBranchOne, method: "POST" });
    expect(claimed.status).toBe(200);
    const replied = await call(page, `${INBOX}/conversations/${conversation.id}/messages`, {
      ...asBranchOne,
      method: "POST",
      json: { text: "Dạ em xem lịch cho chị ạ" },
    });
    expect(replied.status, JSON.stringify(replied.body)).toBe(200);

    await openInbox(page);
    await page.getByRole("tab", { name: /^Đã trả lời/ }).click();
    await conversationRow(page, name).click();
    await expect(page).toHaveURL(new RegExp(`box=cared.*conversation=${conversation.id}`));

    await page.reload();
    await expect(page.getByRole("tab", { name: /^Đã trả lời/ })).toHaveAttribute("aria-selected", "true");
    await expect(conversationRow(page, name)).toHaveAttribute("aria-current", "true");
    await expect(bubble(page, "Dạ em xem lịch cho chị ạ")).toBeVisible();

    // Mở chat Zalo names only the conversation.
    await openInbox(page, conversation.id);
    await expect(page.getByRole("tab", { name: /^Tất cả/ })).toHaveAttribute("aria-selected", "true");
    await expect(conversationRow(page, name)).toHaveAttribute("aria-current", "true");
    await expect(conversationRow(page, name)).toBeInViewport();
  });

  test("Khách gửi thông tin (user_submit_info): SĐT nối hồ sơ; chưa có hồ sơ thì nối khi khách nhắn lại; 2 hồ sơ cùng số hoặc hồ sơ đã chọn tay thì không đổi", async ({ page }) => {
    // Shared after the chat began: the record links, and stays linked after a reload.
    const patient = await newPatient(page);
    const userId = zaloUser();
    const name = `Khách gửi SĐT ${userId.slice(-6)}`;
    await stub("/__users", { userId, displayName: name });
    await customerWrites(page, userId, "Cho em xin lịch khám");
    expect((await conversationOf(page, name)).patientId, "no phone shared yet").toBeNull();
    await sharesInfo(page, userId);
    expect((await conversationOf(page, name)).patientId, "details without a phone link nothing").toBeNull();

    await sharesInfo(page, userId, `84${patient.phone.slice(1)}`);
    const linked = await conversationOf(page, patient.name);
    expect(linked.patientId).toBe(patient.id);
    await openInbox(page, linked.id);
    await expect(side(page)).toContainText(`[${patient.code}] ${patient.name}`);
    await page.reload();
    await expect(side(page)).toContainText(`[${patient.code}] ${patient.name}`);

    // A number no record holds yet: the record made later links on the customer's next message.
    const laterUser = zaloUser();
    const laterName = `Khách chưa có hồ sơ ${laterUser.slice(-6)}`;
    const laterPhone = freshPhone();
    await stub("/__users", { userId: laterUser, displayName: laterName });
    await customerWrites(page, laterUser, "Em là khách mới");
    await sharesInfo(page, laterUser, laterPhone);
    expect((await conversationOf(page, laterName)).patientId, "no record holds the number yet").toBeNull();
    const later = await newPatient(page, laterPhone);
    await customerWrites(page, laterUser, "Em đặt lịch rồi ạ");
    expect((await conversationOf(page, later.name)).patientId).toBe(later.id);

    // Two records hold the number (in two spellings): neither is linked, staff pick.
    const twin = await newPatient(page);
    await newPatient(page, `84${twin.phone.slice(1)}`);
    const twinUser = zaloUser();
    const twinName = `Khách hai hồ sơ ${twinUser.slice(-6)}`;
    await stub("/__users", { userId: twinUser, displayName: twinName });
    await customerWrites(page, twinUser, "Em hỏi giá");
    await sharesInfo(page, twinUser, twin.phone);
    expect((await conversationOf(page, twinName)).patientId, "two records hold it").toBeNull();

    // The record staff picked stays, whatever phone comes after.
    const picked = await newPatient(page);
    const other = await newPatient(page);
    const handUser = zaloUser();
    const handName = `Khách chọn tay ${handUser.slice(-6)}`;
    await stub("/__users", { userId: handUser, displayName: handName });
    await customerWrites(page, handUser, "Em là người nhà");
    const hand = await conversationOf(page, handName);
    const put = await call(page, `${INBOX}/conversations/${hand.id}/patient`, {
      ...asBranchOne,
      method: "PUT",
      json: { patientId: picked.id },
    });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    await sharesInfo(page, handUser, other.phone);
    await customerWrites(page, handUser, "Em nhắn thêm");
    expect((await conversationOf(page, picked.name)).patientId).toBe(picked.id);
  });

  test("Đồng bộ hỏi lại Zalo SĐT của hội thoại chưa nối hồ sơ: khách chia sẻ sau thì nối; đã nối thì không hỏi lại", async ({ page }) => {
    const patient = await newPatient(page);
    const userId = zaloUser();
    const name = `Khách đồng bộ ${userId.slice(-6)}`;
    await stub("/__users", { userId, displayName: name });
    await stub("/__history", { userId, items: [{ messageId: `s-${userId}`, fromOa: false, text: "Em hỏi chút ạ", time: Date.now() - 60_000 }] });

    // Opening the tab reads the recent chats: the conversation opens with no phone, unlinked.
    await openInbox(page);
    await page.getByRole("tab", { name: /^Tất cả/ }).click();
    await expect(conversationRow(page, name)).toBeVisible({ timeout: 15_000 });
    const opened = await conversationOf(page, name);
    expect(opened.patientId).toBeNull();
    expect(opened.sharedPhone, "Zalo's phone 0 is no phone (R-1027)").toBeNull();

    // The customer shares the phone with the OA; no webhook says so.
    await stub("/__users", { userId, displayName: name, phone: `84${patient.phone.slice(1)}` });
    const before = (await stubCalls("/v3.0/oa/user/detail")).length;
    await syncNow(page);
    expect(await profileReads(userId, before), "the sync asked Zalo once").toBe(1);
    const row = conversationRow(page, patient.name);
    await expect(row).toBeVisible();
    await row.click();
    await expect(side(page)).toContainText(`[${patient.code}] ${patient.name}`);
    expect((await conversationOf(page, patient.name)).patientId).toBe(patient.id);

    // Linked: the next sync leaves this customer alone.
    const linkedAt = (await stubCalls("/v3.0/oa/user/detail")).length;
    await syncNow(page);
    expect(await profileReads(userId, linkedAt)).toBe(0);
    await page.reload();
    await expect(side(page)).toContainText(`[${patient.code}] ${patient.name}`);
  });

  test("Khách lạ đến (nhắn tin, quan tâm OA, bấm Nhắn tin) nhận thẻ xin SĐT đúng 1 lần; thẻ không tính là trả lời; đã có SĐT thì không gửi; Zalo từ chối thì lần sau gửi lại; Đồng bộ thay tên tạm", async ({ page }) => {
    // Zalo does not know the user yet: the conversation goes by a placeholder name.
    const userId = zaloUser();
    const placeholder = `Zalo …${userId.slice(-4)}`;
    const name = `Khách lạ thẻ ${userId.slice(-6)}`;
    await customerWrites(page, userId, "Cho em hỏi giá tẩy trắng");
    const cards = await cardsTo(userId);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      recipient: { user_id: userId },
      message: {
        attachment: {
          type: "template",
          payload: { template_type: "request_user_info", elements: [{ title: CARD_TITLE, subtitle: CARD_SUBTITLE }] },
        },
      },
    });
    await customerWrites(page, userId, "Em nhắn thêm ạ");
    expect(await cardsTo(userId), "once per conversation").toHaveLength(1);

    // Zalo's echo of the card (one it sent itself, an id we never got) answers nothing either.
    await webhook(page, {
      event_name: "oa_send_template",
      sender: { id: OA_ID },
      recipient: { id: userId },
      message: {
        msg_id: `echo-card-${userId}`,
        attachments: [{ type: "template", payload: { template_type: "request_user_info", elements: [{ title: CARD_TITLE }] } }],
      },
    });
    const conversation = await conversationOf(page, placeholder);
    expect(conversation.status, "the card is no answer").toBe(0);
    expect(conversation.infoRequestedAt).not.toBeNull();

    await openInbox(page, conversation.id);
    const row = conversationRow(page, placeholder);
    await expect(row).toContainText("Chưa trả lời");
    await expect(row).toContainText("Chưa có SĐT");
    await expect(chat(page).locator(".ibx-chat-title")).toContainText("Chưa có SĐT");
    await expect(chat(page).locator(".ibx-chat-sub")).toContainText("Đã gửi thẻ xin SĐT lúc");
    await expect(bubble(page, CARD_TITLE)).toHaveCount(2);
    await expect(chat(page).locator(".ibx-bubble-tag--info").first()).toHaveText("Thẻ xin số điện thoại");

    // Zalo knows the name now: Đồng bộ puts it in place of the placeholder.
    await stub("/__users", { userId, displayName: name });
    await syncNow(page);
    await expect(conversationRow(page, name)).toBeVisible();
    await expect(conversationRow(page, placeholder)).toHaveCount(0);

    // Following the OA or pressing its "Nhắn tin" is arriving too: the card goes before a word is written.
    const follower = zaloUser();
    await stub("/__users", { userId: follower, displayName: `Khách quan tâm ${follower.slice(-6)}` });
    await webhook(page, { event_name: "follow", oa_id: OA_ID, follower: { id: follower } });
    expect(await cardsTo(follower)).toHaveLength(1);
    await customerWrites(page, follower, "Em mới quan tâm OA");
    expect(await cardsTo(follower)).toHaveLength(1);
    expect((await conversationOf(page, `Khách quan tâm ${follower.slice(-6)}`)).infoRequestedAt).not.toBeNull();
    const clicker = zaloUser();
    await webhook(page, { event_name: "user_click_chatnow", oa_id: OA_ID, user_id: clicker });
    expect(await cardsTo(clicker)).toHaveLength(1);

    // A customer whose Zalo phone is already shared is known: no card.
    const known = zaloUser();
    const knownName = `Khách có SĐT ${known.slice(-6)}`;
    await stub("/__users", { userId: known, displayName: knownName, phone: `84${freshPhone().slice(1)}` });
    await customerWrites(page, known, "Em hỏi lịch");
    expect(await cardsTo(known)).toHaveLength(0);
    await page.reload();
    await expect(conversationRow(page, knownName)).toBeVisible();
    await expect(conversationRow(page, knownName)).not.toContainText("Chưa có SĐT");

    // Zalo refusing the card (999… is refused by the stub) leaves it to the next message.
    const refused = `999${runId()}${String(Math.floor(Math.random() * 9000 + 1000))}`;
    const refusedName = `Khách từ chối ${refused.slice(-6)}`;
    await stub("/__users", { userId: refused, displayName: refusedName });
    await customerWrites(page, refused, "Tin một");
    expect(await cardsTo(refused)).toHaveLength(1);
    expect((await conversationOf(page, refusedName)).infoRequestedAt, "the refused card is not counted as sent").toBeNull();
    await customerWrites(page, refused, "Tin hai");
    expect(await cardsTo(refused), "tried again").toHaveLength(2);
  });

  test("Xin SĐT: chỉ người giữ thấy nút, gửi lại thẻ mà trạng thái giữ nguyên; khách chia sẻ SĐT thì hết nhãn và nút; quá 48 giờ thì nút khoá", async ({ page }) => {
    const userId = zaloUser();
    const name = `Khách xin SĐT ${userId.slice(-6)}`;
    await stub("/__users", { userId, displayName: name });
    await customerWrites(page, userId, "Em muốn hỏi về niềng răng");
    const conversation = await conversationOf(page, name);

    await openInbox(page, conversation.id);
    await expect(chat(page).getByRole("button", { name: /Xin SĐT$/ })).toHaveCount(0);
    await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
    await expect(chat(page).getByText("Bạn đang xử lý")).toBeVisible();

    const sentBefore = (await stubCalls("/v3.0/oa/message/cs")).length;
    await chat(page).getByRole("button", { name: /Xin SĐT$/ }).click();
    await expect(toast(page, "Đã gửi thẻ xin số điện thoại")).toBeVisible();
    expect(await cardsTo(userId, sentBefore)).toHaveLength(1);
    await expect(bubble(page, CARD_TITLE)).toHaveCount(2);
    await expect(chat(page).locator(".ibx-chat-actions")).toContainText("Chưa trả lời");
    await page.reload();
    await expect(conversationRow(page, name)).toContainText("Chưa trả lời");
    await expect(bubble(page, CARD_TITLE)).toHaveCount(2);

    // The customer taps the card: the phone is theirs, nothing more to ask.
    await sharesInfo(page, userId, freshPhone());
    await page.reload();
    await expect(chat(page).getByRole("heading", { name })).toBeVisible();
    await expect(chat(page).locator(".ibx-chat-title")).not.toContainText("Chưa có SĐT");
    await expect(conversationRow(page, name)).toBeVisible();
    await expect(conversationRow(page, name)).not.toContainText("Chưa có SĐT");
    await expect(chat(page).getByRole("button", { name: /Xin SĐT$/ })).toHaveCount(0);

    // Past Zalo's 48 hours the card would be refused: the button is locked, the API says why.
    const lateUser = zaloUser();
    const lateName = `Khách cũ xin SĐT ${lateUser.slice(-6)}`;
    await stub("/__users", { userId: lateUser, displayName: lateName });
    await customerWrites(page, lateUser, "Tin từ 3 ngày trước", Date.now() - 72 * 3_600_000);
    const late = await conversationOf(page, lateName);
    await openInbox(page, late.id);
    await chat(page).getByRole("button", { name: "Nhận xử lý" }).click();
    await expect(chat(page).getByRole("button", { name: /Xin SĐT$/ })).toBeDisabled();
    const closed = await call(page, `${INBOX}/conversations/${late.id}/request-info`, { ...asBranchOne, method: "POST" });
    expect(JSON.stringify(closed.body)).toContain("BlueDental:ZaloInbox:0003");
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
        const card = await call(session.page, `${INBOX}/conversations/${conversation.id}/request-info`, {
          ...asBranchOne,
          method: "POST",
        });
        expect(card.status, "Xin SĐT needs cskhInbox.update").toBe(403);
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
