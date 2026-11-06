import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, sqlScalar, type Session } from "./fixtures/chatApi";
import { BRANCH_ONE, BRANCH_TWO, call } from "./fixtures/marketingTicket";
import { call as staffCall } from "./fixtures/timekeepingStaff";

/**
 * R-1162 (chat-security-checklist.md I6.6, I1.6, I4.5, D1) through the real
 * host and PostgreSQL, no interception: paging over messages that share a
 * SentAt, a retried send stored once, two people opening the same 1-1 at
 * once, and the per-account limit on thread management.
 */

interface Message {
  id: string;
  content: string | null;
}
interface Page {
  items: Message[];
  hasMore: boolean;
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

async function newGroup(name: string): Promise<string> {
  const reply = await patiently(() =>
    call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, { name, memberIds: [manager.userId] }),
  );
  expect(reply.status).toBe(200);
  return reply.body.id;
}

function send(session: Session, conversationId: string, content: string, clientMessageId?: string) {
  return patiently(() =>
    call<Message>(session.page, "POST", `${CHAT}/conversations/${conversationId}/messages`, {
      conversationId,
      content,
      attachmentIds: [],
      ...(clientMessageId ? { clientMessageId } : {}),
    }),
  );
}

const rowsOf = (conversationId: string) =>
  Number(sqlScalar(`select count(*) from bd_chat_messages where "ConversationId"='${conversationId}'`));

test("I6.6: paging older messages never skips or repeats ones that share a SentAt", async () => {
  const id = await newGroup(`Cùng giờ ${runId()}`);
  const sent: string[] = [];
  for (let i = 0; i < 7; i++) sent.push((await send(admin, id, `Cùng giờ ${i}`)).body.id);
  // Seven messages stamped in the same instant (a burst, or a coarse clock).
  sqlScalar(`update bd_chat_messages set "SentAt" = '2026-11-06 03:00:00' where "ConversationId"='${id}'`);

  const seen: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < 10; page++) {
    const query = `maxResultCount=2${before ? `&beforeId=${before}` : ""}`;
    const reply = await call<Page>(admin.page, "GET", `${CHAT}/conversations/${id}/messages?${query}`);
    expect(reply.status).toBe(200);
    seen.push(...reply.body.items.map((m) => m.id));
    if (!reply.body.hasMore) break;
    before = reply.body.items.at(-1)!.id;
  }
  expect(seen).toHaveLength(7);
  expect(new Set(seen)).toEqual(new Set(sent));
});

test("I1.6: a retried send with the same clientMessageId is stored once and returns the same message", async () => {
  const id = await newGroup(`Gửi lại ${runId()}`);
  const clientId = randomUUID();

  const first = await send(admin, id, "Gửi một lần", clientId);
  expect(first.status).toBe(200);
  const again = await send(admin, id, "Gửi một lần", clientId);
  expect(again.status).toBe(200);
  expect(again.body.id).toBe(first.body.id);
  expect(rowsOf(id)).toBe(1);

  // Four tabs (or a double click plus a retry) at the same instant.
  const burstId = randomUUID();
  const burst = await Promise.all([0, 1, 2, 3].map(() => send(admin, id, "Bấm nhiều lần", burstId)));
  expect(burst.map((r) => r.status)).toEqual([200, 200, 200, 200]);
  expect(new Set(burst.map((r) => r.body.id)).size).toBe(1);
  expect(rowsOf(id)).toBe(2);

  // The id is per sender: someone else using the same one sends their own message.
  const other = await send(manager, id, "Của người khác", clientId);
  expect(other.status).toBe(200);
  expect(other.body.id).not.toBe(first.body.id);
  // Without an id every send is a new message, as before.
  await send(admin, id, "Không có mã");
  await send(admin, id, "Không có mã");
  expect(rowsOf(id)).toBe(5);
});

test("I4.5: four requests opening the same 1-1 at once all get the one conversation", async () => {
  const roleName = `Chat mở song song ${runId()}`;
  const role = await staffCall<{ id: string }>(admin.page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const userName = `chatpair${runId()}`;
  let staffId: string | undefined;
  try {
    const staff = await staffCall<{ id: string }>(admin.page, "/api/v1/app/staff", {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        userName, password: "E2e@123456", name: `Chat mở song song ${runId()}`, email: `${userName}@bluedental.local`,
        roleNames: [roleName], branchIds: [BRANCH_ONE], isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
    staffId = staff.body.id;
    const userId = sqlScalar(`select "Id" from "AbpUsers" where "UserName"='${userName}'`);
    expect(userId).not.toBe("");

    const opened = await Promise.all(
      [0, 1, 2, 3].map(() =>
        patiently(() => call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/direct`, { userId })),
      ),
    );
    expect(opened.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(new Set(opened.map((r) => r.body.id)).size).toBe(1);
    const pairs = sqlScalar(
      `select count(*) from bd_chat_conversations c where c."IsDeleted" = false and c."DirectKey" is not null
         and exists (select 1 from bd_chat_members m where m."ConversationId" = c."Id" and m."UserId" = '${userId}')`,
    );
    expect(pairs).toBe("1");
  } finally {
    if (staffId) await staffCall(admin.page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
    await staffCall(admin.page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  }
});

test("D1: starting threads and changing members / names is limited per account (429 / 0020)", async () => {
  // branch2 renames a thread it cannot see: each attempt 404s, but the limiter
  // counts requests per account before the endpoint runs, so nothing changes.
  const missing = randomUUID();
  const statuses: number[] = [];
  let code: string | undefined;
  for (let i = 0; i < 30 && !code; i++) {
    const reply = await call(branch2.page, "PUT", `${CHAT}/conversations/${missing}/name`, { name: "x" }, BRANCH_TWO);
    statuses.push(reply.status);
    if (reply.status === 429) code = reply.body.error?.code;
  }
  expect(code, `statuses: ${statuses.join(",")}`).toBe("BlueDental:Chat:0020");
  expect(statuses.length).toBeLessThanOrEqual(21);
  // The same account's other manage calls share the bucket…
  const group = await call(branch2.page, "POST", `${CHAT}/conversations/group`, { name: "x", memberIds: [] }, BRANCH_TWO);
  expect(group.status).toBe(429);
  // …while other people are not slowed.
  expect((await newGroup(`Vẫn tạo được ${runId()}`)).length).toBeGreaterThan(0);
});

test("D1: recalling counts against the send limit", async () => {
  const missing = randomUUID();
  const statuses: number[] = [];
  for (let i = 0; i < 40 && !statuses.includes(429); i++) {
    statuses.push((await call(branch2.page, "POST", `${CHAT}/messages/${missing}/recall`, undefined, BRANCH_TWO)).status);
  }
  expect(statuses, statuses.join(",")).toContain(429);
  expect(statuses.length).toBeLessThanOrEqual(31);
});
