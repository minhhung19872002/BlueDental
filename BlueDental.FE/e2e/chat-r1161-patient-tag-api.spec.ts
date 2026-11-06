import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, TEST_USER, login, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, sqlScalar, type Session } from "./fixtures/chatApi";
import { BRANCH_ONE, BRANCH_TWO, call } from "./fixtures/marketingTicket";
import { call as staffCall } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Gắn khách bằng # trong chat (R-1161, docs/testing/features/chat-patient-tag.md),
 * through the real host and PostgreSQL. Patients are made through the real
 * API; the database is written directly only to soft-delete one patient (no
 * endpoint does that) and read to prove names never reach the audit log.
 */

interface Card {
  id: string;
  missing: boolean;
  name: string | null;
  patientCode: string | null;
  yearOfBirth: number | null;
  canOpen: boolean;
  appointmentAt: string | null;
  dentistName: string | null;
  visitStatus: number | null;
  bookingContent: string | null;
}
interface Message {
  id: string;
  content: string | null;
  editedAt: string | null;
  isRecalled: boolean;
  patients: Card[];
}
interface Suggestion {
  id: string;
  name: string;
  patientCode: string;
  yearOfBirth: number | null;
  todayAt: string | null;
  isToday: boolean;
}
interface Patient {
  id: string;
  patientCode: string;
  name: string;
}

const PATIENTS = "/api/v1/app/patients";
const APPOINTMENTS = "/api/v1/app/appointments";
const PASSWORD = "E2e@123456";
const run = runId();

let admin: Session;
let manager: Session;
let branch2: Session;
let conversationId: string;
const opened: string[] = [];
const madePatients: { id: string; branch: string }[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  branch2 = await signIn(browser, BRANCH2_USER);
  conversationId = await openGroup([manager.userId]);
});

test.afterAll(async () => {
  for (const id of opened) await call(manager.page, "POST", `${CHAT}/conversations/${id}/read`);
  for (const p of madePatients) {
    await call(p.branch === BRANCH_ONE ? admin.page : branch2.page, "POST", `${PATIENTS}/${p.id}/deactivate`, undefined, p.branch);
  }
  await Promise.all([admin?.context.close(), manager?.context.close(), branch2?.context.close()]);
});

async function openGroup(memberIds: string[]): Promise<string> {
  const reply = await call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: `Gắn khách e2e ${runId()}`,
    memberIds,
  });
  expect(reply.status).toBe(200);
  opened.push(reply.body.id);
  return reply.body.id;
}

let phoneSeq = 0;
async function makePatient(lastName: string, firstName: string, branch = BRANCH_ONE): Promise<Patient> {
  const page = branch === BRANCH_ONE ? admin.page : branch2.page;
  const phone = `08${run}${String(phoneSeq++).padStart(2, "0")}`;
  const reply = await call<{ id: string; patientCode: string }>(
    page,
    "POST",
    PATIENTS,
    { lastName, firstName, gender: 2, phoneNumber: phone, dateOfBirth: "1990-05-01" },
    branch,
  );
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  madePatients.push({ id: reply.body.id, branch });
  return { id: reply.body.id, patientCode: reply.body.patientCode, name: `${lastName} ${firstName}` };
}

const token = (p: Patient) => `#[${p.name}](patient:${p.id})`;

const send = (session: Session, conversation: string, content: string, patientIds: string[]) =>
  patiently(() =>
    call<Message>(session.page, "POST", `${CHAT}/conversations/${conversation}/messages`, {
      conversationId: conversation,
      content,
      attachmentIds: [],
      patientIds,
    }),
  );

const edit = (session: Session, message: Message, content: string, patientIds: string[]) =>
  patiently(() =>
    call<Message>(session.page, "PUT", `${CHAT}/messages/${message.id}`, {
      content,
      patientIds,
      expectedEditedAt: message.editedAt,
    }),
  );

async function readMessage(session: Session, conversation: string, id: string): Promise<Message> {
  const page = await call<{ items: Message[] }>(
    session.page,
    "GET",
    `${CHAT}/conversations/${conversation}/messages?maxResultCount=50`,
  );
  expect(page.status).toBe(200);
  const found = page.body.items.find((m) => m.id === id);
  expect(found, "message in the thread").toBeTruthy();
  return found as Message;
}

const messageCount = (conversation: string) =>
  Number(sqlScalar(`select count(*) from bd_chat_messages where "ConversationId" = '${conversation}'`));

const suggest = (session: Session, conversation: string, text: string, branch?: string) =>
  call<Suggestion[]>(session.page, "POST", `${CHAT}/conversations/${conversation}/patient-suggestions`, { text }, branch);

/** A visit for later today, with the first dentist free and on shift. */
async function bookToday(page: Page, patientId: string, content: string): Promise<boolean> {
  const today = new Date();
  const staff = await call<{ items: { id: string }[] }>(
    page,
    "GET",
    `/api/v1/app/staff?MaxResultCount=200&IsActive=true&BranchId=${BRANCH_ONE}&Role=1`,
  );
  for (let shift = 0; shift < 48; shift++) {
    const start = new Date(Date.now() + (30 + shift * 10) * 60_000);
    start.setSeconds(0, 0);
    if (start.getDate() !== today.getDate()) return false;
    const end = new Date(start.getTime() + 15 * 60_000);
    for (const dentist of staff.body.items.slice(0, 8)) {
      if (!(await openShiftCovering(page, BRANCH_ONE, dentist.id, start, end))) continue;
      const reply = await call(page, "POST", APPOINTMENTS, {
        patientId,
        dentistId: dentist.id,
        branchId: BRANCH_ONE,
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
        type: 2,
        chiefComplaint: content,
      });
      if (reply.status === 200) return true;
    }
  }
  return false;
}

test("R-1161: one tagged patient comes back as a card, built from the record", async () => {
  const patient = await makePatient("Hà", `My ${run}`);
  const reply = await send(admin, conversationId, `Khách ${token(patient)} đến rồi`, [patient.id]);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  expect(reply.body.patients).toHaveLength(1);
  const card = reply.body.patients[0];
  expect(card).toMatchObject({ id: patient.id, missing: false, name: patient.name, canOpen: true, yearOfBirth: 1990 });
  expect(card.patientCode).toBe(patient.patientCode);
  // Never the phone number or medical fields.
  expect(Object.keys(card).sort()).toEqual(
    ["appointmentAt", "bookingContent", "canOpen", "dentistName", "id", "missing", "name", "patientCode", "visitStatus", "yearOfBirth"],
  );

  // The other member sees the same card on a separate read.
  const seen = await readMessage(manager, conversationId, reply.body.id);
  expect(seen.patients.map((p) => p.id)).toEqual([patient.id]);
  expect(seen.content).toContain(token(patient));
});

test("R-1161: five patients keep their tag order; a sixth is refused with 0025 and nothing is saved", async () => {
  const five: Patient[] = [];
  for (const letter of ["E", "D", "C", "B", "A"]) five.push(await makePatient("Năm", `${letter} ${run}`));
  const ok = await send(admin, conversationId, five.map(token).join(" "), five.map((p) => p.id));
  expect(ok.status).toBe(200);
  expect(ok.body.patients.map((p) => p.id)).toEqual(five.map((p) => p.id));

  const sixth = await makePatient("Năm", `F ${run}`);
  const all = [...five, sixth];
  const before = messageCount(conversationId);
  const refused = await send(admin, conversationId, all.map(token).join(" "), all.map((p) => p.id));
  expect(refused.status).toBe(403);
  expect(refused.body.error?.code).toBe("BlueDental:Chat:0025");
  expect(messageCount(conversationId)).toBe(before);
});

test("R-1161: another branch's patient or an unknown id is refused with 0026 and nothing is saved", async () => {
  const elsewhere = await makePatient("Khác", `Nhánh ${run}`, BRANCH_TWO);
  const before = messageCount(conversationId);

  const foreign = await send(admin, conversationId, token(elsewhere), [elsewhere.id]);
  expect(foreign.status).toBe(403);
  expect(foreign.body.error?.code).toBe("BlueDental:Chat:0026");

  const ghost = "0e0e0e0e-0000-4000-8000-000000000000";
  const unknown = await send(admin, conversationId, `#[Ai đó](patient:${ghost})`, [ghost]);
  expect(unknown.status).toBe(403);
  expect(unknown.body.error?.code).toBe("BlueDental:Chat:0026");
  expect(messageCount(conversationId)).toBe(before);

  // # never offers another branch's patient either.
  const offered = await suggest(admin, conversationId, `khac nhanh ${run}`);
  expect(offered.status).toBe(200);
  expect(offered.body).toEqual([]);
});

test("R-1161: an edit may change the patients; the earlier wording keeps its own list", async () => {
  const first = await makePatient("Sửa", `Một ${run}`);
  const second = await makePatient("Sửa", `Hai ${run}`);
  const sent = await send(admin, conversationId, `Gọi ${token(first)}`, [first.id]);
  expect(sent.status).toBe(200);

  const edited = await edit(admin, sent.body, `Gọi ${token(second)}`, [second.id]);
  expect(edited.status, JSON.stringify(edited.body)).toBe(200);
  expect(edited.body.patients.map((p) => p.id)).toEqual([second.id]);

  const history = await call<{ content: string; patients: Card[] }[]>(
    manager.page,
    "GET",
    `${CHAT}/messages/${sent.body.id}/revisions`,
  );
  expect(history.status).toBe(200);
  expect(history.body).toHaveLength(1);
  expect(history.body[0].content).toContain(token(first));
  expect(history.body[0].patients.map((p) => p.id)).toEqual([first.id]);

  // Only the patient list changing is still an edit.
  const relisted = await edit(admin, edited.body, `Gọi ${token(second)}`, []);
  expect(relisted.status).toBe(200);
  expect(relisted.body.patients).toEqual([]);
});

test("R-1161: recalling a message takes its cards with it", async () => {
  const patient = await makePatient("Thu", `Hồi ${run}`);
  const sent = await send(admin, conversationId, token(patient), [patient.id]);
  const recalled = await call<Message>(admin.page, "POST", `${CHAT}/messages/${sent.body.id}/recall`);
  expect(recalled.status).toBe(200);
  expect(recalled.body.isRecalled).toBe(true);
  expect(recalled.body.patients).toEqual([]);
  expect((await readMessage(manager, conversationId, sent.body.id)).patients).toEqual([]);
});

test("R-1161: a soft-deleted patient reads 'missing' with nothing else filled", async () => {
  const patient = await makePatient("Xoá", `Mềm ${run}`);
  const sent = await send(admin, conversationId, token(patient), [patient.id]);
  expect(sent.status).toBe(200);
  sqlScalar(`update bd_patients set "IsDeleted" = true where "Id" = '${patient.id}'`);
  const card = (await readMessage(manager, conversationId, sent.body.id)).patients[0];
  expect(card).toMatchObject({ id: patient.id, missing: true, name: null, patientCode: null, canOpen: false });

  // Editing that message keeps the tag only if the patient still exists: 0026, the message unchanged.
  const refused = await edit(admin, sent.body, `${token(patient)} sửa`, [patient.id]);
  expect(refused.status).toBe(403);
  expect(refused.body.error?.code).toBe("BlueDental:Chat:0026");
  expect((await readMessage(admin, conversationId, sent.body.id)).editedAt).toBeNull();
});

test("R-1161: # suggests today's patients first, accent-blind, members only", async () => {
  const later = await makePatient(`Thứ Tự ${run}`, "An");
  const today = await makePatient(`Thứ Tự ${run}`, "Bình");
  test.skip(!(await bookToday(admin.page, today.id, `Khám e2e ${run}`)), "no dentist slot left today");

  const found = await suggest(admin, conversationId, `thu tu ${run}`);
  expect(found.status).toBe(200);
  expect(found.body.map((s) => s.id)).toEqual([today.id, later.id]);
  expect(found.body[0]).toMatchObject({ isToday: true, yearOfBirth: 1990 });
  expect(found.body[0].todayAt).not.toBeNull();
  expect(found.body[1]).toMatchObject({ isToday: false, todayAt: null });

  // "ha my" finds "Hà My"; Mã KH works too.
  const accentless = await suggest(admin, conversationId, `ha my ${run}`);
  expect(accentless.body.map((s) => s.name)).toEqual([`Hà My ${run}`]);
  const byCode = await suggest(admin, conversationId, today.patientCode);
  expect(byCode.body.map((s) => s.id)).toContain(today.id);

  // The card shows today's visit.
  const sent = await send(admin, conversationId, token(today), [today.id]);
  expect(sent.body.patients[0]).toMatchObject({ visitStatus: 1, bookingContent: `Khám e2e ${run}` });
  expect(sent.body.patients[0].appointmentAt).not.toBeNull();
  expect(sent.body.patients[0].dentistName).toBeTruthy();

  // Not a member: no suggestions.
  const outsider = await suggest(branch2, conversationId, `thu tu ${run}`, BRANCH_TWO);
  expect([403, 404]).toContain(outsider.status);
});

test("R-1161: message search finds the #Tên a reader sees, not the token", async () => {
  const patient = await makePatient("Tìm", `Thấy ${run}`);
  const sent = await send(admin, conversationId, `nhắc ${token(patient)}`, [patient.id]);
  const search = (text: string) =>
    call<{ items: Message[] }>(manager.page, "POST", `${CHAT}/conversations/${conversationId}/messages/search`, { text });
  expect((await search(`#tim thay ${run}`)).body.items.map((m) => m.id)).toEqual([sent.body.id]);
  expect((await search(`patient:${patient.id}`)).body.items).toEqual([]);

  // Kho lưu trữ never lists a tag as a link.
  const links = await call<{ items: { url: string }[] }>(
    manager.page,
    "GET",
    `${CHAT}/conversations/${conversationId}/shared/links`,
  );
  expect(links.body.items.filter((l) => l.url.includes("patient"))).toEqual([]);
});

test("R-1161 J1: a tagged name reaches neither the audit log nor the stored message in clear", async () => {
  // Registering the patient is audited by the patient module; only chat’s own records are checked.
  const canary = `Canary${run}`;
  const patient = await makePatient("Kiểm", canary);
  await suggest(admin, conversationId, canary.toLowerCase());
  const sent = await send(admin, conversationId, token(patient), [patient.id]);
  expect(sent.status).toBe(200);
  const edited = await edit(admin, sent.body, `${token(patient)} !`, [patient.id]);
  expect(edited.status).toBe(200);

  expect(sqlScalar(`select count(*) from "AbpAuditLogActions" where "ServiceName" like '%Chat%' and "Parameters" like '%${canary}%'`)).toBe("0");
  expect(sqlScalar(`select count(*) from "AbpEntityPropertyChanges" p join "AbpEntityChanges" c on c."Id" = p."EntityChangeId" where c."EntityTypeFullName" like '%Chat%' and p."NewValue" like '%${canary}%'`)).toBe("0");
  expect(
    sqlScalar(`select count(*) from bd_chat_messages where "ContentCipher" like '%${canary}%'`),
  ).toBe("0");
  expect(
    sqlScalar(`select count(*) from bd_chat_message_revisions where "ContentCipher" like '%${canary}%'`),
  ).toBe("0");
});

test("R-1161 J4/J5 + K1: without Patients.View a viewer sees only Tên + Mã KH, tags only today's patients, and a revoke takes effect", async ({ browser }) => {
  const roleName = `Chat no patient ${run}`;
  const role = await staffCall<{ id: string }>(admin.page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const grant = (isGranted: boolean) =>
    staffCall(admin.page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
      method: "PUT",
      json: { permissions: [{ name: "BlueDental.patient.read", isGranted }] },
    });
  const userName = `chatnopt${run}`;
  let staffId: string | undefined;
  try {
    const staff = await staffCall<{ id: string }>(admin.page, "/api/v1/app/staff", {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        userName, password: PASSWORD, name: `Chat hạn chế ${run}`, email: `${userName}@bluedental.local`,
        roleNames: [roleName], branchIds: [BRANCH_ONE], isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
    staffId = staff.body.id;

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, { userName, password: PASSWORD });
    const me = await call<{ currentUser: { id: string } }>(page, "GET", "/api/abp/application-configuration");
    const limited: Session = { context, page, userId: me.body.currentUser.id };

    const group = await openGroup([limited.userId]);
    const patient = await makePatient("Hạn", `Chế ${run}`);
    const sent = await send(admin, group, token(patient), [patient.id]);
    expect(sent.status).toBe(200);

    const reduced = (await readMessage(limited, group, sent.body.id)).patients[0];
    expect(reduced).toMatchObject({
      id: patient.id, missing: false, name: patient.name, patientCode: patient.patientCode,
      canOpen: false, yearOfBirth: null, appointmentAt: null, dentistName: null, visitStatus: null, bookingContent: null,
    });
    // K1: no visit today, so # does not offer them and the server refuses the tag.
    expect((await suggest(limited, group, `han che ${run}`)).body).toEqual([]);
    expect((await suggest(limited, group, patient.patientCode)).body).toEqual([]);
    const before = messageCount(group);
    const refused = await send(limited, group, `Hỏi ${token(patient)}`, [patient.id]);
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe("BlueDental:Chat:0027");
    expect(messageCount(group)).toBe(before);

    const visiting = await makePatient("Hạn", `Hôm nay ${run}`);
    if (await bookToday(admin.page, visiting.id, `Khám K1 ${run}`)) {
      const offered = await suggest(limited, group, `han hom nay ${run}`);
      expect(offered.body).toEqual([
        expect.objectContaining({ id: visiting.id, isToday: true, yearOfBirth: null, todayAt: null }),
      ]);
      const own = await send(limited, group, `Mời ${token(visiting)}`, [visiting.id]);
      expect(own.status, JSON.stringify(own.body)).toBe(200);
      // The tag already there stays on an edit; one added now must be today's.
      const kept = await edit(limited, own.body, `Mời ${token(visiting)} nhé`, [visiting.id]);
      expect(kept.status, JSON.stringify(kept.body)).toBe(200);
      const added = await edit(limited, kept.body, `Mời ${token(visiting)} ${token(patient)}`, [visiting.id, patient.id]);
      expect(added.status).toBe(403);
      expect(added.body.error?.code).toBe("BlueDental:Chat:0027");
      expect((await readMessage(limited, group, own.body.id)).patients.map((p) => p.id)).toEqual([visiting.id]);
    } else {
      test.info().annotations.push({ type: "skipped-part", description: "no dentist slot left today for the K1 allowed path" });
    }

    // Granted: the full card. Revoked again: back to the reduced one.
    expect((await grant(true)).status).toBe(204);
    expect((await readMessage(limited, group, sent.body.id)).patients[0]).toMatchObject({ canOpen: true, yearOfBirth: 1990 });
    expect((await suggest(limited, group, `han che ${run}`)).body).toEqual([expect.objectContaining({ id: patient.id })]);
    expect((await grant(false)).status).toBe(204);
    expect((await readMessage(limited, group, sent.body.id)).patients[0]).toMatchObject({ canOpen: false, yearOfBirth: null });
    await context.close();
  } finally {
    if (staffId) await staffCall(admin.page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
    await staffCall(admin.page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  }
});

test("R-1161 J6: # suggestions are rate-limited per account (429 / 0020)", async () => {
  // branch2 asks about a thread it is not in: every answer is 404, but the
  // limiter counts per account before the endpoint runs.
  let refused: { status: number; code?: string } | undefined;
  for (let i = 0; i < 40 && !refused; i++) {
    const reply = await suggest(branch2, conversationId, "x", BRANCH_TWO);
    if (reply.status === 429) refused = { status: reply.status, code: reply.body.error?.code };
    else expect([403, 404]).toContain(reply.status);
  }
  expect(refused?.status).toBe(429);
  expect(refused?.code).toBe("BlueDental:Chat:0020");
});
