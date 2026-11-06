import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, PNG_1PX_BASE64, signIn, sqlScalar, uploadFile, type Session } from "./fixtures/chatApi";
import { BRANCH_TWO, call, type Reply } from "./fixtures/marketingTicket";

/**
 * Chat nội bộ hardening (R-1158) and message editing (R-1159 / F5) through the
 * real host and PostgreSQL. No interception; the database is read directly
 * only to prove what is (not) stored and to move clocks back.
 *
 * Runs serially; the rate-limit test is last because it spends branch2's
 * send budget for the window.
 */

interface Conversation {
  id: string;
  ownerId: string | null;
  members: { userId: string }[];
}
interface Message {
  id: string;
  content: string | null;
  editedAt: string | null;
  canEdit: boolean;
  editableUntil: string | null;
  attachments: { id: string; fileName: string }[];
}
interface Revision {
  content: string | null;
  editedAt: string;
}
interface ApiError {
  error?: { code?: string };
}

const code = (body: unknown) => (body as ApiError).error?.code;

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
  const reply = await call<Conversation>(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId });
  expect(reply.status).toBe(200);
  return reply.body;
}

/**
 * Sends and edits share the per-account limit (30 / 30 s) and this file makes
 * more than that in a row, so a 429 here is waited out instead of failing the
 * test that happened to cross it. The limit itself is proven by the last test.
 */
async function patiently<T>(request: () => Promise<Reply<T>>): Promise<Reply<T>> {
  for (let attempt = 0; ; attempt++) {
    const reply = await request();
    if (reply.status !== 429 || attempt === 20) return reply;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

const send = (session: Session, conversationId: string, content: string, attachmentIds: string[] = []) =>
  patiently(() =>
    call<Message>(session.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
      conversationId,
      content,
      attachmentIds,
    }),
  );

const edit = (session: Session, message: { id: string; editedAt: string | null }, content: string) =>
  patiently(() =>
    call<Message>(session.page, "PUT", `${CHAT}/messages/${message.id}`, {
      content,
      expectedEditedAt: message.editedAt,
    }),
  );

const revisions = (session: Session, messageId: string, branch?: string) =>
  call<Revision[]>(session.page, "GET", `${CHAT}/messages/${messageId}/revisions`, undefined, branch);

const revisionCount = (messageId: string) =>
  Number(sqlScalar(`select count(*) from bd_chat_message_revisions where "MessageId"='${messageId}'`));

// ---------------------------------------------------------------- R-1159 F5

test("F5: the sender edits within the window; the old text is kept as an encrypted revision", async () => {
  const conversation = await openDirect();
  const first = `Hẹn 9 giờ e2e-${runId()}`;
  const sent = await send(admin, conversation.id, first);
  expect(sent.status).toBe(200);
  expect(sent.body.canEdit).toBe(true);
  expect(Date.parse(sent.body.editableUntil!)).toBeGreaterThan(Date.now() + 14 * 60_000);

  const second = `${first} → 10 giờ`;
  const edited = await edit(admin, sent.body, second);
  expect(edited.status).toBe(200);
  expect(edited.body.content).toBe(second);
  expect(edited.body.editedAt).not.toBeNull();
  // The window runs from SentAt, so editing does not extend it. (Milliseconds:
  // PostgreSQL keeps microseconds, the freshly sent copy has .NET ticks.)
  expect(Date.parse(edited.body.editableUntil!)).toBe(Date.parse(sent.body.editableUntil!));

  expect(revisionCount(sent.body.id)).toBe(1);
  const stored = sqlScalar(`select "ContentCipher" from bd_chat_message_revisions where "MessageId"='${sent.body.id}'`);
  expect(stored).toMatch(/^v1:[A-Za-z0-9+/=]+$/);
  expect(Buffer.from(stored.slice(3), "base64").toString("utf8")).not.toContain("e2e-");

  const third = `${second} → 11 giờ`;
  const again = await edit(admin, edited.body, third);
  expect(again.status).toBe(200);

  // Members (not only the sender) read the history, newest first.
  const history = await revisions(manager, sent.body.id);
  expect(history.status).toBe(200);
  expect(history.body.map((r) => r.content)).toEqual([second, first]);
});

test("F5: identical text makes no revision and leaves editedAt alone", async () => {
  const conversation = await openDirect();
  const sent = await send(admin, conversation.id, `Không đổi e2e-${runId()}`);
  const edited = await edit(admin, sent.body, `${sent.body.content}  `);
  expect(edited.status).toBe(200);
  expect(edited.body.editedAt).toBeNull();
  expect(revisionCount(sent.body.id)).toBe(0);
});

test("F5: a stale expectedEditedAt is refused as a conflict (0024) and changes nothing", async () => {
  const conversation = await openDirect();
  const sent = await send(admin, conversation.id, `Bản A e2e-${runId()}`);
  const fresh = await edit(admin, sent.body, `Bản B e2e-${runId()}`);
  expect(fresh.status).toBe(200);

  // Second tab still holds the never-edited copy.
  const stale = await edit(admin, sent.body, "Bản C");
  expect(code(stale.body)).toBe("BlueDental:Chat:0024");
  expect(revisionCount(sent.body.id)).toBe(1);
  const page = await call<{ items: Message[] }>(admin.page, "GET", `${CHAT}/conversations/${conversation.id}/messages`);
  expect(page.body.items.find((m) => m.id === sent.body.id)?.content).toBe(fresh.body.content);
});

test("F5: 16 minutes after sending the window is closed (0023) and canEdit says so", async () => {
  // Its own group: in the shared 1-1 thread a message moved 16 minutes back
  // can fall off the first page once earlier runs have filled it.
  const group = await call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: `Quá hạn e2e ${runId()}`,
    memberIds: [manager.userId],
  });
  const conversation = group.body;
  const sent = await send(admin, conversation.id, `Quá hạn e2e-${runId()}`);
  sqlScalar(`update bd_chat_messages set "SentAt" = "SentAt" - interval '16 minutes' where "Id"='${sent.body.id}'`);

  const late = await edit(admin, sent.body, "muộn rồi");
  expect(code(late.body)).toBe("BlueDental:Chat:0023");
  const page = await call<{ items: Message[] }>(admin.page, "GET", `${CHAT}/conversations/${conversation.id}/messages`);
  const stored = page.body.items.find((m) => m.id === sent.body.id)!;
  expect(stored.canEdit).toBe(false);
  expect(stored.content).toBe(sent.body.content);
  expect(revisionCount(sent.body.id)).toBe(0);
  // Nothing left unread for chat.spec's badge check.
  await call(manager.page, "POST", `${CHAT}/conversations/${conversation.id}/read`);
});

test("F5: only the sender edits (0004); a recalled message cannot be edited (0005) and shows no history", async () => {
  const conversation = await openDirect();
  const sent = await send(admin, conversation.id, `Của admin e2e-${runId()}`);
  const byOther = await edit(manager, sent.body, "manager sửa");
  expect(code(byOther.body)).toBe("BlueDental:Chat:0004");

  const edited = await edit(admin, sent.body, `Đã sửa e2e-${runId()}`);
  expect(edited.status).toBe(200);
  expect((await call(admin.page, "POST", `${CHAT}/messages/${sent.body.id}/recall`)).status).toBe(200);

  const afterRecall = await edit(admin, edited.body, "sau thu hồi");
  expect(code(afterRecall.body)).toBe("BlueDental:Chat:0005");
  const history = await revisions(manager, sent.body.id);
  expect(history.status).toBe(200);
  expect(history.body).toEqual([]);
});

test("F5: someone outside the conversation gets 404 for the history", async () => {
  const conversation = await openDirect();
  const sent = await send(admin, conversation.id, `Riêng tư e2e-${runId()}`);
  await edit(admin, sent.body, `Riêng tư 2 e2e-${runId()}`);
  expect((await revisions(branch2, sent.body.id, BRANCH_TWO)).status).toBe(404);
  // Same branch, not a member: a group without manager.
  const group = await call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: `Nhóm riêng ${runId()}`,
    memberIds: [],
  });
  const inGroup = await send(admin, group.body.id, `Trong nhóm e2e-${runId()}`);
  await edit(admin, inGroup.body, `Trong nhóm 2 e2e-${runId()}`);
  expect((await revisions(manager, inGroup.body.id)).status).toBe(404);
});

test("F5: edited text never reaches the audit log in clear", async () => {
  const conversation = await openDirect();
  const canary = `CANARY${runId()}`;
  const sent = await send(admin, conversation.id, `${canary}-v1`);
  const edited = await edit(admin, sent.body, `${canary}-v2`);
  expect(edited.status).toBe(200);
  expect((await revisions(admin, sent.body.id)).body[0].content).toBe(`${canary}-v1`);

  const leaks = sqlScalar(
    `select (select count(*) from "AbpAuditLogActions" where "Parameters" like '%${canary}%')
          + (select count(*) from "AbpEntityPropertyChanges" where coalesce("NewValue",'') || coalesce("OriginalValue",'') like '%${canary}%')`,
  );
  expect(leaks).toBe("0");
});

test("F5: a revision cipher copied onto another revision does not decrypt (bound to its id)", async () => {
  const conversation = await openDirect();
  const a = await send(admin, conversation.id, `Gốc A e2e-${runId()}`);
  const b = await send(admin, conversation.id, `Gốc B e2e-${runId()}`);
  await edit(admin, a.body, `Sửa A e2e-${runId()}`);
  await edit(admin, b.body, `Sửa B e2e-${runId()}`);
  const revA = sqlScalar(`select "Id" from bd_chat_message_revisions where "MessageId"='${a.body.id}'`);
  const revB = sqlScalar(`select "Id" from bd_chat_message_revisions where "MessageId"='${b.body.id}'`);
  const original = sqlScalar(`select "ContentCipher" from bd_chat_message_revisions where "Id"='${revB}'`);

  sqlScalar(
    `update bd_chat_message_revisions set "ContentCipher" = (select "ContentCipher" from bd_chat_message_revisions where "Id"='${revA}') where "Id"='${revB}'`,
  );
  try {
    const swapped = await revisions(admin, b.body.id);
    expect(swapped.status).not.toBe(200);
    expect(JSON.stringify(swapped.body)).not.toContain("Gốc A");
  } finally {
    sqlScalar(`update bd_chat_message_revisions set "ContentCipher" = '${original}' where "Id"='${revB}'`);
  }
  expect((await revisions(admin, b.body.id)).body[0].content).toBe(b.body.content);
});

test("F5: a message with files may lose all its words, but files stay as sent", async () => {
  const conversation = await openDirect();
  const upload = await uploadFile(admin.page, conversation.id, `anh-${runId()}.png`, PNG_1PX_BASE64, "image/png");
  const sent = await send(admin, conversation.id, `Chú thích e2e-${runId()}`, [upload.body.id!]);
  const emptied = await edit(admin, sent.body, "");
  expect(emptied.status).toBe(200);
  expect(emptied.body.content ?? "").toBe("");
  expect(emptied.body.attachments.map((a) => a.id)).toEqual([upload.body.id]);

  const textOnly = await send(admin, conversation.id, `Chỉ chữ e2e-${runId()}`);
  const blank = await edit(admin, textOnly.body, "   ");
  expect(code(blank.body)).toBe("BlueDental:Chat:0001");
});

// ---------------------------------------------------------------- R-1158

test("R-1158: an EICAR test file is refused as infected (0018) and nothing is kept", async () => {
  const conversation = await openDirect();
  const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  const name = `eicar-${runId()}.txt`;
  const reply = await uploadFile(admin.page, conversation.id, name, Buffer.from(eicar).toString("base64"), "text/plain");
  expect(code(reply.body)).toBe("BlueDental:Chat:0018");
  expect(sqlScalar(`select count(*) from bd_chat_attachments where "ConversationId"='${conversation.id}' and "MessageId" is null and "CreationTime" > now() - interval '1 minute' and "SizeInBytes"=${eicar.length}`)).toBe("0");
});

test("R-1158: direction-override characters are stripped from file names", async () => {
  const conversation = await openDirect();
  const id = runId();
  // "hoa-don-‮fdp.exe" would render as "hoa-don-exe.pdf".
  const upload = await uploadFile(admin.page, conversation.id, `hoa-don-${id}‮gnp.txt`, Buffer.from("x").toString("base64"), "text/plain");
  expect(upload.status).toBe(200);
  const sent = await send(admin, conversation.id, "", [upload.body.id!]);
  expect(sent.body.attachments[0].fileName).toBe(`hoa-don-${id}gnp.txt`);
});

test("R-1158: an upload never sent is swept after the grace period", async () => {
  const conversation = await openDirect();
  const upload = await uploadFile(admin.page, conversation.id, `mo-coi-${runId()}.png`, PNG_1PX_BASE64, "image/png");
  expect(upload.status).toBe(200);
  const id = upload.body.id!;
  // Fresh orphans survive (the composer may still send them).
  sqlScalar(`update bd_chat_attachments set "CreationTime" = now() - interval '23 hours' where "Id"='${id}'`);
  await new Promise((resolve) => setTimeout(resolve, 7_000));
  expect(sqlScalar(`select count(*) from bd_chat_attachments where "Id"='${id}'`)).toBe("1");

  sqlScalar(`update bd_chat_attachments set "CreationTime" = now() - interval '25 hours' where "Id"='${id}'`);
  await expect
    .poll(() => sqlScalar(`select count(*) from bd_chat_attachments where "Id"='${id}'`), { timeout: 20_000 })
    .toBe("0");
  // Sending it now fails: the id is gone.
  const late = await send(admin, conversation.id, "", [id]);
  expect(late.status).not.toBe(200);
});

test("R-1158: only the group owner removes members; the removed lose access; ownership hands over", async () => {
  const contacts = await call<{ id: string; userName: string }[]>(admin.page, "GET", `${CHAT}/contacts`);
  const third = contacts.body.find((c) => c.id !== manager.userId);
  expect(third).toBeDefined();

  const group = await call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: `Nhóm xoá ${runId()}`,
    memberIds: [manager.userId, third!.id],
  });
  expect(group.body.ownerId).toBe(admin.userId);
  const remove = (session: Session, userId: string) =>
    call(session.page, "DELETE", `${CHAT}/conversations/${group.body.id}/members/${userId}`);

  expect(code((await remove(manager, third!.id)).body)).toBe("BlueDental:Chat:0021");
  expect(code((await remove(admin, admin.userId)).body)).toBe("BlueDental:Chat:0022");
  expect((await remove(admin, manager.userId)).status).toBe(204);
  expect((await call(manager.page, "GET", `${CHAT}/conversations/${group.body.id}`)).status).toBe(404);
  expect((await send(manager, group.body.id, "còn gửi được không")).status).toBe(404);

  expect((await call(admin.page, "POST", `${CHAT}/conversations/${group.body.id}/leave`)).status).toBe(204);
  expect(sqlScalar(`select "OwnerId" from bd_chat_conversations where "Id"='${group.body.id}'`)).toBe(third!.id);
});

test("R-1158: search is accent-blind, skips recalled messages, is members-only and not audited in clear", async () => {
  const conversation = await openDirect();
  const id = runId();
  const hit = await send(admin, conversation.id, `Nhớ gọi Hà My ${id} chiều nay`);
  const gone = await send(admin, conversation.id, `Hà My ${id} đã huỷ`);
  await call(admin.page, "POST", `${CHAT}/messages/${gone.body.id}/recall`);

  const search = (session: Session, text: string, branch?: string) =>
    call<{ items: Message[]; isComplete: boolean }>(
      session.page,
      "POST",
      `${CHAT}/conversations/${conversation.id}/messages/search`,
      { text },
      branch,
    );
  const found = await search(manager, `ha my ${id}`);
  expect(found.status).toBe(200);
  expect(found.body.items.map((m) => m.id)).toEqual([hit.body.id]);
  expect(found.body.isComplete).toBe(true);
  expect((await search(branch2, "ha my", BRANCH_TWO)).status).toBe(404);

  const canary = `CANARY${runId()}`;
  expect((await search(admin, canary)).status).toBe(200);
  expect(sqlScalar(`select count(*) from "AbpAuditLogActions" where "Parameters" like '%${canary}%'`)).toBe("0");
});

test("R-1158: sending faster than 30 messages in 30 s is refused with 429 / 0020 and Retry-After", async () => {
  // branch2 floods admin's thread: every attempt 404s, but the limiter counts
  // requests per account before the endpoint runs, so no real message is made.
  const conversation = await openDirect();
  const statuses: number[] = [];
  let refused: { status: number; retryAfter: string | null; code?: string } | undefined;
  for (let i = 0; i < 40 && !refused; i++) {
    const reply = await branch2.page.evaluate(
      async ({ url, branch }) => {
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Clinic-Branch-Id": branch,
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
          body: JSON.stringify({ content: "x", attachmentIds: [] }),
        });
        const text = await res.text();
        return { status: res.status, retryAfter: res.headers.get("retry-after"), body: text };
      },
      { url: `${CHAT}/conversations/${conversation.id}/messages`, branch: BRANCH_TWO },
    );
    statuses.push(reply.status);
    if (reply.status === 429) {
      refused = { status: 429, retryAfter: reply.retryAfter, code: (JSON.parse(reply.body) as ApiError).error?.code };
    }
  }
  expect(refused, `statuses: ${statuses.join(",")}`).toBeDefined();
  expect(statuses.length).toBe(31);
  expect(refused!.code).toBe("BlueDental:Chat:0020");
  expect(Number(refused!.retryAfter)).toBeGreaterThan(0);
  // Other people are not slowed by branch2's flood.
  expect((await send(admin, conversation.id, `Vẫn gửi được e2e-${runId()}`)).status).toBe(200);
});
