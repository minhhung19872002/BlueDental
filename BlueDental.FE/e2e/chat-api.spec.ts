import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, PNG_1PX_BASE64, downloadFile, minioObject, signIn, sqlScalar, uploadFile, type Session, patiently } from "./fixtures/chatApi";
import { BRANCH_ONE, BRANCH_TWO, call } from "./fixtures/marketingTicket";

/**
 * Chat nội bộ (F-89 / R-1157) through the real host and PostgreSQL: three real
 * logins (admin + manager in branch 1, branch2 in branch 2), no interception.
 */

interface Conversation {
  id: string;
  kind: number;
  title: string;
  members: { userId: string }[];
  unreadCount: number;
}
interface Message {
  id: string;
  content: string | null;
  isMine: boolean;
  isRecalled: boolean;
  editedAt: string | null;
  attachments: { id: string; fileName: string; isImage: boolean }[];
}

let admin: Session;
let manager: Session;
let branch2: Session;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  branch2 = await signIn(browser, BRANCH2_USER);
});

test.afterAll(async () => {
  await Promise.all([admin?.context.close(), manager?.context.close(), branch2?.context.close()]);
});

async function openDirect(): Promise<Conversation> {
  const reply = await patiently(() => call<Conversation>(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }));
  expect(reply.status).toBe(200);
  return reply.body;
}

async function send(session: Session, conversationId: string, content: string, attachmentIds: string[] = []) {
  return call<Message>(session.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
    conversationId,
    content,
    attachmentIds,
  });
}

test("contacts are the branch's own staff, never yourself or another branch's", async () => {
  // The list is capped (50), so each person is looked up the way the search box does.
  const idsFor = async (filter: string) =>
    (await call<{ id: string }[]>(admin.page, "GET", `${CHAT}/contacts?filter=${filter}`)).body.map((c) => c.id);
  expect(await idsFor("manager")).toContain(manager.userId);
  expect(await idsFor("admin")).not.toContain(admin.userId);
  expect(await idsFor("branch2")).not.toContain(branch2.userId);

  const crossBranch = await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: branch2.userId }));
  expect(crossBranch.body.error?.code).toBe("BlueDental:Chat:0008");
  const withSelf = await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: admin.userId }));
  expect(withSelf.body.error?.code).toBe("BlueDental:Chat:0009");
});

test("direct chat: one thread per pair, unread for the other side until read, stored encrypted", async () => {
  const first = await openDirect();
  const again = await openDirect();
  expect(again.id).toBe(first.id);
  expect(first.kind).toBe(1);

  const text = `Xin chào bác sĩ e2e-${runId()}`;
  const sent = await send(admin, first.id, text);
  expect(sent.status).toBe(200);
  expect(sent.body.content).toBe(text);
  expect(sent.body.isMine).toBe(true);

  // The other side, a separate session and request: unread, then read.
  const inbox = await call<Conversation[]>(manager.page, "GET", `${CHAT}/conversations`);
  const row = inbox.body.find((c) => c.id === first.id);
  expect(row?.unreadCount).toBeGreaterThanOrEqual(1);
  const page = await call<{ items: Message[] }>(manager.page, "GET", `${CHAT}/conversations/${first.id}/messages`);
  expect(page.body.items[0]).toMatchObject({ id: sent.body.id, content: text, isMine: false });
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${first.id}/read`)).status).toBe(204);
  const after = await call<Conversation>(manager.page, "GET", `${CHAT}/conversations/${first.id}`);
  expect(after.body.unreadCount).toBe(0);

  // At rest: AES-GCM ciphertext, never the words themselves.
  const stored = sqlScalar(`select "ContentCipher" from bd_chat_messages where "Id" = '${sent.body.id}'`);
  expect(stored.startsWith("v1:")).toBe(true);
  expect(stored).not.toContain("Xin");
  expect(stored).not.toContain("e2e-");
});

test("another branch's account cannot read, write or upload into the thread", async () => {
  const conversation = await openDirect();
  for (const branch of [BRANCH_ONE, BRANCH_TWO]) {
    expect((await call(branch2.page, "GET", `${CHAT}/conversations/${conversation.id}`, undefined, branch)).status).toBe(404);
    expect((await call(branch2.page, "GET", `${CHAT}/conversations/${conversation.id}/messages`, undefined, branch)).status).toBe(404);
  }
  const intrude = await call(branch2.page, "POST", `${CHAT}/conversations/${conversation.id}/messages`, {
    conversationId: conversation.id,
    content: "không được",
    attachmentIds: [],
  }, BRANCH_TWO);
  expect(intrude.status).toBe(404);
  const upload = await uploadFile(branch2.page, conversation.id, "x.png", PNG_1PX_BASE64, "image/png", BRANCH_TWO);
  expect(upload.status).toBe(404);
  const list = await call<Conversation[]>(branch2.page, "GET", `${CHAT}/conversations`, undefined, BRANCH_TWO);
  expect(list.body.map((c) => c.id)).not.toContain(conversation.id);
});

test("edit and recall are the sender's only; a recalled message keeps its place with nothing in it", async () => {
  const conversation = await openDirect();
  const sent = await send(admin, conversation.id, "Bản nháp");

  const notMine = await call(manager.page, "PUT", `${CHAT}/messages/${sent.body.id}`, { content: "sửa trộm" });
  expect(notMine.body.error?.code).toBe("BlueDental:Chat:0004");
  const edited = await call<Message>(admin.page, "PUT", `${CHAT}/messages/${sent.body.id}`, { content: "Bản đã sửa" });
  expect(edited.body).toMatchObject({ content: "Bản đã sửa" });
  expect(edited.body.editedAt).not.toBeNull();

  const upload = await uploadFile(admin.page, conversation.id, "phim.png", PNG_1PX_BASE64, "image/png");
  const withFile = await send(admin, conversation.id, "", [upload.body.id!]);
  expect(withFile.status).toBe(200);
  const recallOther = await patiently(() => call(manager.page, "POST", `${CHAT}/messages/${withFile.body.id}/recall`));
  expect(recallOther.body.error?.code).toBe("BlueDental:Chat:0004");
  const recalled = await patiently(() => call<Message>(admin.page, "POST", `${CHAT}/messages/${withFile.body.id}/recall`));
  expect(recalled.body).toMatchObject({ isRecalled: true, content: null, attachments: [] });

  const seen = await call<{ items: Message[] }>(manager.page, "GET", `${CHAT}/conversations/${conversation.id}/messages`);
  expect(seen.body.items.find((m) => m.id === withFile.body.id)).toMatchObject({ isRecalled: true, content: null, attachments: [] });
  const file = await downloadFile(manager.page, withFile.body.id, upload.body.id!);
  expect(file.status).toBe(404);
  const twice = await call(admin.page, "PUT", `${CHAT}/messages/${withFile.body.id}`, { content: "hồi sinh" });
  expect(twice.body.error?.code).toBe("BlueDental:Chat:0005");
});

test("attachments round-trip byte for byte, sealed in MinIO, and bad files are refused", async () => {
  const conversation = await openDirect();
  const name = `phim-x-quang-${runId()}.png`;
  const upload = await uploadFile(admin.page, conversation.id, name, PNG_1PX_BASE64, "image/png");
  expect(upload.status).toBe(200);
  expect(upload.body.isImage).toBe(true);
  const sent = await send(admin, conversation.id, "Ảnh phim", [upload.body.id!]);
  expect(sent.body.attachments).toEqual([expect.objectContaining({ id: upload.body.id, fileName: name, isImage: true })]);

  const file = await downloadFile(manager.page, sent.body.id, upload.body.id!);
  expect(file.status).toBe(200);
  expect(file.base64).toBe(PNG_1PX_BASE64);

  // At rest: the file name and the bytes are both sealed.
  const row = sqlScalar(`select "FileNameCipher" || '|' || "BlobName" from bd_chat_attachments where "Id" = '${upload.body.id}'`);
  const [fileNameCipher, blobName] = row.split("|");
  expect(fileNameCipher.startsWith("v1:")).toBe(true);
  expect(fileNameCipher).not.toContain("phim");
  expect(blobName).toMatch(/^chat\/.+\.enc$/);
  const onDisk = minioObject(blobName);
  expect(onDisk.length).toBeGreaterThan(0);
  expect(onDisk.includes(Buffer.from(PNG_1PX_BASE64, "base64").subarray(0, 8))).toBe(false);
  expect(onDisk.includes(Buffer.from("IHDR"))).toBe(false);

  // A ".png" that is not a PNG, and a type outside the list.
  const fake = await uploadFile(admin.page, conversation.id, "gia.png", btoa("not really a picture"), "image/png");
  expect(fake.body.error?.code).toBe("BlueDental:Chat:0011");
  const exe = await uploadFile(admin.page, conversation.id, "run.exe", btoa("MZ...."), "application/octet-stream");
  expect(exe.body.error?.code).toBe("BlueDental:Chat:0011");
  // An upload already sent cannot ride along on a second message.
  const reuse = await send(admin, conversation.id, "lại", [upload.body.id!]);
  expect(reuse.body.error?.code).toBe("BlueDental:Chat:0013");
});

test("the audit log keeps who did what, never the message or file name in clear", async () => {
  const conversation = await openDirect();
  // ASCII on purpose: the audit JSON escapes non-ASCII, which would hide a leak from LIKE.
  const canary = `CANARY${runId()}`;
  const upload = await uploadFile(admin.page, conversation.id, `${canary}-file.png`, PNG_1PX_BASE64, "image/png");
  expect(upload.status).toBe(200);
  const sent = await send(admin, conversation.id, `${canary}-sent`, [upload.body.id!]);
  expect(sent.status).toBe(200);
  const edited = await call(admin.page, "PUT", `${CHAT}/messages/${sent.body.id}`, { content: `${canary}-edited` });
  expect(edited.status).toBe(200);

  const leaks = sqlScalar(
    `select (select count(*) from "AbpAuditLogActions" where "Parameters" like '%${canary}%')
          + (select count(*) from "AbpAuditLogs" where coalesce("Exceptions",'') || coalesce("Comments",'') || coalesce("Url",'') like '%${canary}%')
          + (select count(*) from "AbpEntityPropertyChanges" where coalesce("NewValue",'') || coalesce("OriginalValue",'') like '%${canary}%')`,
  );
  expect(leaks).toBe("0");
  // The actions themselves are still on record, with the ids that tie them to the row.
  const audited = sqlScalar(
    `select count(*) from "AbpAuditLogActions" where "MethodName" in ('SendAsync','EditMessageAsync') and ("Parameters" like '%${conversation.id}%' or "Parameters" like '%${sent.body.id}%')`,
  );
  expect(Number(audited)).toBeGreaterThanOrEqual(2);
});

test("groups: anyone creates, members rename and add, a leaver loses access", async () => {
  const name = `Nhóm lễ tân ${runId()}`;
  const created = await patiently(() => call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name,
    memberIds: [manager.userId],
  }));
  expect(created.status).toBe(200);
  expect(created.body).toMatchObject({ kind: 2, title: name });
  expect(created.body.members.map((m) => m.userId).sort()).toEqual([admin.userId, manager.userId].sort());

  const outsider = await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/${created.body.id}/members`, { userIds: [branch2.userId] }));
  expect(outsider.body.error?.code).toBe("BlueDental:Chat:0008");
  const renamed = await patiently(() => call<Conversation>(manager.page, "PUT", `${CHAT}/conversations/${created.body.id}/name`, { name: `${name} (mới)` }));
  expect(renamed.body.title).toBe(`${name} (mới)`);
  const direct = await openDirect();
  const renameDirect = await patiently(() => call(admin.page, "PUT", `${CHAT}/conversations/${direct.id}/name`, { name: "x" }));
  expect(renameDirect.body.error?.code).toBe("BlueDental:Chat:0010");

  await send(manager, created.body.id, "Chào cả nhóm");
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${created.body.id}/leave`)).status).toBe(204);
  expect((await call(manager.page, "GET", `${CHAT}/conversations/${created.body.id}`)).status).toBe(404);
  const still = await call<{ items: Message[] }>(admin.page, "GET", `${CHAT}/conversations/${created.body.id}/messages`);
  expect(still.body.items.map((m) => m.content)).toContain("Chào cả nhóm");
});
