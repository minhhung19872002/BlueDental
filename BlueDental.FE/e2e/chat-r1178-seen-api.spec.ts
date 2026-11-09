import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, signIn, type Session, patiently } from "./fixtures/chatApi";
import { BRANCH_TWO, call } from "./fixtures/marketingTicket";

/**
 * Đã xem (R-1178) through the real host and PostgreSQL: every member of a
 * conversation carries its read mark, which moves when that member reads.
 * Three real logins, no interception.
 */

interface Member {
  userId: string;
  fullName: string;
  isMe: boolean;
  lastReadAt: string | null;
}
interface Conversation {
  id: string;
  members: Member[];
}
interface Message {
  id: string;
  sentAt: string;
}

let admin: Session;
let manager: Session;
let branch2: Session;
const opened: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  branch2 = await signIn(browser, BRANCH2_USER);
});

test.afterAll(async () => {
  // Leave manager with nothing unread, or chat.spec's badge check goes red.
  for (const id of opened) await call(manager.page, "POST", `${CHAT}/conversations/${id}/read`);
  await Promise.all([admin?.context.close(), manager?.context.close(), branch2?.context.close()]);
});

const at = (iso: string | null) => (iso === null ? Number.NEGATIVE_INFINITY : Date.parse(iso));

async function conversationAs(session: Session, id: string): Promise<Conversation> {
  const reply = await call<Conversation>(session.page, "GET", `${CHAT}/conversations/${id}`);
  expect(reply.status).toBe(200);
  return reply.body;
}

async function send(session: Session, conversationId: string, content: string): Promise<Message> {
  const reply = await patiently(() =>
    call<Message>(session.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
      conversationId,
      content,
      attachmentIds: [],
      patientIds: [],
    }),
  );
  expect(reply.status).toBe(200);
  return reply.body;
}

const memberOf = (conversation: Conversation, userId: string) => {
  const member = conversation.members.find((m) => m.userId === userId);
  expect(member).toBeDefined();
  return member as Member;
};

test("direct: the reader's mark passes my message only once they read, and each side knows which member is them", async () => {
  const direct = await patiently(() =>
    call<Conversation>(admin.page, "POST", `${CHAT}/conversations/direct`, { userId: manager.userId }),
  );
  expect(direct.status).toBe(200);
  const id = direct.body.id;
  opened.push(id);
  await call(manager.page, "POST", `${CHAT}/conversations/${id}/read`);

  const sent = await send(admin, id, `R-1178 seen probe e2e-${runId()}`);

  // Sending is reading: my own mark covers the message, the other side's does not.
  const before = await conversationAs(admin, id);
  expect(memberOf(before, admin.userId).isMe).toBe(true);
  expect(memberOf(before, manager.userId).isMe).toBe(false);
  expect(at(memberOf(before, admin.userId).lastReadAt)).toBeGreaterThanOrEqual(Date.parse(sent.sentAt));
  expect(at(memberOf(before, manager.userId).lastReadAt)).toBeLessThan(Date.parse(sent.sentAt));

  // Manager reads, through their own session.
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${id}/read`)).status).toBe(204);

  // A separate request from admin sees the mark move past the message.
  const after = await conversationAs(admin, id);
  const readAt = memberOf(after, manager.userId).lastReadAt;
  expect(at(readAt)).toBeGreaterThanOrEqual(Date.parse(sent.sentAt));

  // Manager sees the same marks, with isMe on their own row.
  const theirs = await conversationAs(manager, id);
  expect(memberOf(theirs, manager.userId).isMe).toBe(true);
  expect(memberOf(theirs, admin.userId).isMe).toBe(false);
  expect(memberOf(theirs, manager.userId).lastReadAt).toBe(readAt);

  // The list carries the marks too.
  const list = await call<Conversation[]>(admin.page, "GET", `${CHAT}/conversations`);
  expect(memberOf(list.body.find((c) => c.id === id) as Conversation, manager.userId).lastReadAt).toBe(readAt);

  // Another branch's account sees nothing of it, read marks included.
  expect((await call(branch2.page, "GET", `${CHAT}/conversations/${id}`, undefined, BRANCH_TWO)).status).toBe(404);
});

test("group: a member who has not opened it yet has no mark; the one who read is past the message", async () => {
  const contacts = await call<{ id: string; fullName: string }[]>(admin.page, "GET", `${CHAT}/contacts`);
  const third = contacts.body.find((c) => c.id !== manager.userId);
  expect(third, "branch 1 needs a third staff account").toBeDefined();
  const group = await patiently(() =>
    call<Conversation>(admin.page, "POST", `${CHAT}/conversations/group`, {
      name: `Seen e2e-${runId()}`,
      memberIds: [manager.userId, third!.id],
    }),
  );
  expect(group.status).toBe(200);
  opened.push(group.body.id);

  const sent = await send(admin, group.body.id, `R-1178 group probe e2e-${runId()}`);
  expect((await call(manager.page, "POST", `${CHAT}/conversations/${group.body.id}/read`)).status).toBe(204);

  const seen = await conversationAs(admin, group.body.id);
  expect(at(memberOf(seen, manager.userId).lastReadAt)).toBeGreaterThanOrEqual(Date.parse(sent.sentAt));
  expect(memberOf(seen, third!.id).lastReadAt).toBeNull();
  expect(seen.members.filter((m) => m.isMe).map((m) => m.userId)).toEqual([admin.userId]);
});
