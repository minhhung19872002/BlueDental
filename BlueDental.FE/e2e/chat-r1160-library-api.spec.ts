import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, PNG_1PX_BASE64, patiently, signIn, sqlScalar, uploadFile, type Session } from "./fixtures/chatApi";
import { BRANCH_TWO, call } from "./fixtures/marketingTicket";

/**
 * Kho lưu trữ (R-1160): the pictures, files and links of one conversation,
 * through the real host and PostgreSQL. Each test opens its own group so the
 * lists hold only what that test sent. The database is written directly only
 * to move a message back in time for the date filter.
 */

interface Conversation {
  id: string;
}
interface Message {
  id: string;
}
interface SharedItem {
  messageId: string;
  senderId: string;
  senderName: string;
  sentAt: string;
}
interface SharedFile extends SharedItem {
  attachment: { id: string; fileName: string; contentType: string };
}
interface FilePage {
  items: SharedFile[];
  hasMore: boolean;
}
interface LinkResult {
  items: (SharedItem & { url: string })[];
  isComplete: boolean;
}

const MEDIA = 1;
const FILE = 2;
const PDF_BASE64 = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

let admin: Session;
let manager: Session;
let branch2: Session;
/** Groups made here; the manager reads them all at the end so chat.spec's unread badge starts clean. */
const opened: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  branch2 = await signIn(browser, BRANCH2_USER);
});

test.afterAll(async () => {
  for (const id of opened) await call(manager.page, "POST", `${CHAT}/conversations/${id}/read`);
  await Promise.all([admin?.context.close(), manager?.context.close(), branch2?.context.close()]);
});

async function openGroup(): Promise<string> {
  const reply = await call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: `Kho e2e ${runId()}`,
    memberIds: [manager.userId],
  });
  expect(reply.status).toBe(200);
  opened.push(reply.body.id);
  return reply.body.id;
}

async function send(session: Session, conversationId: string, content: string, attachmentIds: string[] = []) {
  const reply = await patiently(() =>
    call<Message>(session.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
      conversationId,
      content,
      attachmentIds,
    }),
  );
  expect(reply.status).toBe(200);
  return reply.body;
}

async function attach(session: Session, conversationId: string, fileName: string, base64: string, type: string) {
  const upload = await uploadFile(session.page, conversationId, fileName, base64, type);
  expect(upload.status).toBe(200);
  return upload.body.id!;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  return search.toString();
};

const files = (
  session: Session,
  conversationId: string,
  params: Record<string, string | number | undefined>,
  branch?: string,
) =>
  call<FilePage>(session.page, "GET", `${CHAT}/conversations/${conversationId}/shared/files?${query(params)}`, undefined, branch);

const links = (session: Session, conversationId: string, params: Record<string, string | undefined> = {}, branch?: string) =>
  call<LinkResult>(session.page, "GET", `${CHAT}/conversations/${conversationId}/shared/links?${query(params)}`, undefined, branch);

/** A clinic-local (UTC+7) calendar day, `daysAgo` before today, as YYYY-MM-DD. */
const clinicDay = (daysAgo: number) =>
  new Date(Date.now() + 7 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);

test("Ảnh holds the pictures and File the rest, newest first, with sender and time", async () => {
  const id = await openGroup();
  const png = await attach(admin, id, "phim-1.png", PNG_1PX_BASE64, "image/png");
  const pdf = await attach(admin, id, "bao-gia.pdf", PDF_BASE64, "application/pdf");
  const first = await send(admin, id, "Ảnh và báo giá", [png, pdf]);
  const png2 = await attach(manager, id, "phim-2.png", PNG_1PX_BASE64, "image/png");
  const second = await send(manager, id, "Ảnh thứ hai", [png2]);

  const media = await files(manager, id, { kind: MEDIA });
  expect(media.status).toBe(200);
  expect(media.body.hasMore).toBe(false);
  expect(media.body.items.map((f) => f.attachment.fileName)).toEqual(["phim-2.png", "phim-1.png"]);
  expect(media.body.items.map((f) => f.messageId)).toEqual([second.id, first.id]);
  expect(media.body.items[0]).toMatchObject({ senderId: manager.userId });
  expect(media.body.items[0].senderName).toBeTruthy();
  expect(Date.parse(media.body.items[0].sentAt)).toBeGreaterThan(Date.now() - 5 * 60_000);

  const other = await files(admin, id, { kind: FILE });
  expect(other.body.items.map((f) => [f.attachment.fileName, f.messageId])).toEqual([["bao-gia.pdf", first.id]]);
});

test("a recalled message takes its files and links out of the library", async () => {
  const id = await openGroup();
  const png = await attach(admin, id, "se-thu-hoi.png", PNG_1PX_BASE64, "image/png");
  const gone = await send(admin, id, "Xem https://thu-hoi.example.com/a", [png]);
  const kept = await send(admin, id, "Còn https://con-lai.example.com/b");
  expect((await call(admin.page, "POST", `${CHAT}/messages/${gone.id}/recall`)).status).toBe(200);

  expect((await files(manager, id, { kind: MEDIA })).body.items).toEqual([]);
  const found = await links(manager, id);
  expect(found.body.items.map((l) => [l.url, l.messageId])).toEqual([["https://con-lai.example.com/b", kept.id]]);
});

test("links: only http(s) are kept, trailing punctuation dropped, www. read as https, repeats once", async () => {
  const id = await openGroup();
  const message = await send(
    admin,
    id,
    [
      "Tài liệu (https://docs.example.com/a?b=1). Xem thêm www.example.vn/bang-gia,",
      "javascript:alert(1) ftp://files.example.com/x http://localhost/ok",
      "lặp lại https://docs.example.com/a?b=1 và <https://wiki.example.org/Rang_(nha_khoa)>",
    ].join("\n"),
  );

  const found = await links(manager, id);
  expect(found.status).toBe(200);
  expect(found.body.isComplete).toBe(true);
  expect(found.body.items.map((l) => l.url)).toEqual([
    "https://docs.example.com/a?b=1",
    "https://www.example.vn/bang-gia",
    "https://wiki.example.org/Rang_(nha_khoa)",
  ]);
  expect(found.body.items.every((l) => l.messageId === message.id && l.senderId === admin.userId)).toBe(true);
});

test("Người gửi and Ngày gửi narrow every tab; a day is the clinic's calendar day", async () => {
  const id = await openGroup();
  const oldPng = await attach(admin, id, "cu.png", PNG_1PX_BASE64, "image/png");
  const old = await send(admin, id, "Cũ https://cu.example.com", [oldPng]);
  sqlScalar(`update bd_chat_messages set "SentAt" = "SentAt" - interval '3 days' where "Id"='${old.id}'`);
  const newPng = await attach(manager, id, "moi.png", PNG_1PX_BASE64, "image/png");
  await send(manager, id, "Mới https://moi.example.com", [newPng]);

  const names = async (params: Record<string, string | number | undefined>) =>
    (await files(admin, id, { kind: MEDIA, ...params })).body.items.map((f) => f.attachment.fileName);

  expect(await names({})).toEqual(["moi.png", "cu.png"]);
  expect(await names({ senderId: admin.userId })).toEqual(["cu.png"]);
  expect(await names({ senderId: manager.userId })).toEqual(["moi.png"]);
  expect(await names({ sentFrom: clinicDay(0) })).toEqual(["moi.png"]);
  expect(await names({ sentTo: clinicDay(1) })).toEqual(["cu.png"]);
  expect(await names({ sentFrom: clinicDay(3), sentTo: clinicDay(3) })).toEqual(["cu.png"]);
  expect(await names({ sentFrom: clinicDay(0), senderId: admin.userId })).toEqual([]);

  const linkUrls = async (params: Record<string, string | undefined>) =>
    (await links(admin, id, params)).body.items.map((l) => l.url);
  expect(await linkUrls({ senderId: admin.userId })).toEqual(["https://cu.example.com"]);
  expect(await linkUrls({ sentFrom: clinicDay(0) })).toEqual(["https://moi.example.com"]);
});

test("pages: maxResultCount + skipCount walk the list and hasMore says when to stop", async () => {
  const id = await openGroup();
  for (const name of ["p1.png", "p2.png", "p3.png"]) {
    const png = await attach(admin, id, name, PNG_1PX_BASE64, "image/png");
    await send(admin, id, name, [png]);
  }

  const first = await files(admin, id, { kind: MEDIA, skipCount: 0, maxResultCount: 2 });
  expect(first.body.items.map((f) => f.attachment.fileName)).toEqual(["p3.png", "p2.png"]);
  expect(first.body.hasMore).toBe(true);
  const second = await files(admin, id, { kind: MEDIA, skipCount: 2, maxResultCount: 2 });
  expect(second.body.items.map((f) => f.attachment.fileName)).toEqual(["p1.png"]);
  expect(second.body.hasMore).toBe(false);

  expect((await files(admin, id, { kind: MEDIA, maxResultCount: 101 })).status).toBe(400);
  expect((await files(admin, id, { kind: MEDIA, maxResultCount: 0 })).status).toBe(400);
});

test("only members of the branch see it: a leaver and another branch get 404", async () => {
  const id = await openGroup();
  const png = await attach(admin, id, "rieng.png", PNG_1PX_BASE64, "image/png");
  await send(admin, id, "Riêng https://rieng.example.com", [png]);

  expect((await files(branch2, id, { kind: MEDIA }, BRANCH_TWO)).status).toBe(404);
  expect((await links(branch2, id, {}, BRANCH_TWO)).status).toBe(404);
  // (Scope follows the account's branch assignment, not the header: the admin,
  // assigned nowhere, works clinic-wide, so no header test for it here.)

  expect((await call(manager.page, "POST", `${CHAT}/conversations/${id}/leave`)).status).toBe(204);
  expect((await files(manager, id, { kind: MEDIA })).status).toBe(404);
  expect((await links(manager, id)).status).toBe(404);
});
