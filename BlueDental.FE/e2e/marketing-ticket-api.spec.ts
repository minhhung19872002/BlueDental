import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { BRANCH_ONE, BRANCH_TWO, call, removeTicket, syntheticPhone, TAGS, TICKETS } from "./fixtures/marketingTicket";
import { createDentist, deleteDentist, DENTIST_ROLE, openDentistSession } from "./fixtures/restrictedDentist";

/**
 * Feature: Marketing → Ticket (F-51) — the rules the API keeps on its own.
 * BlueDental-local; see docs/clone/pages/marketing-ticket.md.
 *
 * Every call is a real HTTP request from inside a page logged in through the
 * login screen, with the cookie and antiforgery token the server set. Nothing
 * is intercepted; every follow-up read is a separate request. Phones are
 * synthetic (09 + run digits), so no real customer is touched.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

const STATUS = { New: 1, InCare: 2, Booked: 3, Arrived: 4, NotPotential: 5 } as const;
const RESULT = { Interested: 1, NoNeed: 2, NoAnswer: 3, Unreachable: 4, CallBack: 5 } as const;
const KIND = { Created: 1, Contact: 2, StatusChanged: 3, Assigned: 4, Reoccurred: 5, Booked: 6, AppointmentChanged: 7 } as const;

const ERR = {
  TicketClosed: "BlueDental:MarketingTicket:0002",
  CallBackTimeRequired: "BlueDental:MarketingTicket:0003",
  InvalidTransition: "BlueDental:MarketingTicket:0004",
  DentistRequired: "BlueDental:MarketingTicket:0005",
  DuplicateTagName: "BlueDental:MarketingTicket:0008",
  DuplicateOpenPhone: "BlueDental:MarketingTicket:0009",
  NotYours: "BlueDental:MarketingTicket:0010",
  BookFromOtherBranch: "BlueDental:MarketingTicket:0012",
} as const;

interface Ticket {
  id: string;
  code: string;
  clinicBranchId: string;
  phone: string;
  status: number;
  assigneeId: string | null;
  assigneeName: string | null;
  patientId: string | null;
  isReturningCustomer: boolean;
  appointmentId: string | null;
  contactCount: number;
  nextCallAt: string | null;
  notPotentialReason: string | null;
  receivedAt: string;
  dueAt: string | null;
  processingDays: number | null;
  isOverdue: boolean;
  isDeleted: boolean;
  deleteReason: string | null;
}

interface Activity {
  kind: number;
  fromStatus: number | null;
  toStatus: number | null;
  assigneeName: string | null;
}

async function createTicket(page: Page, input: Record<string, unknown>, branch = BRANCH_ONE) {
  const res = await call<{ ticket: Ticket; reoccurred: boolean }>(
    page,
    "POST",
    TICKETS,
    { clinicBranchId: branch, tagIds: [], ...input },
    branch,
  );
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

const getTicket = (page: Page, id: string, branch = BRANCH_ONE) => call<Ticket>(page, "GET", `${TICKETS}/${id}`, undefined, branch);
const activitiesOf = async (page: Page, id: string) =>
  (await call<Activity[]>(page, "GET", `${TICKETS}/${id}/activities`)).body;

/** A half-hour far in the future (clinic time, UTC+7), different on every run. */
function futureSlot(offsetDays: number) {
  const day = new Date(Date.now() + (500 + (Number(runId()) % 2000) + offsetDays) * 86_400_000);
  const date = day.toISOString().slice(0, 10);
  return { slotStart: `${date}T09:00:00+07:00`, slotEnd: `${date}T09:30:00+07:00` };
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Marketing ticket (API)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Mới → Đang chăm sóc → Không tiềm năng → mở lại, with every step on the timeline", async ({ page }) => {
    const id = runId();
    const { ticket, reoccurred } = await createTicket(page, { fullName: `Khách thử ${id}`, phone: syntheticPhone() });
    expect(reoccurred).toBe(false);
    expect(ticket.status).toBe(STATUS.New);
    expect(ticket.assigneeId, "no assignee leaves it in the pool").toBeNull();
    expect(ticket.code).toMatch(/\S+/);

    // The first contact moves Mới to Đang chăm sóc and hands a pool ticket to whoever called.
    const contacted = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/contacts`, { result: RESULT.NoAnswer, note: "Gọi lần 1" });
    expect(contacted.status).toBe(200);
    expect(contacted.body.status).toBe(STATUS.InCare);
    expect(contacted.body.assigneeId).not.toBeNull();
    expect(contacted.body.contactCount).toBe(1);

    // Hẹn gọi lại needs a future time.
    const noTime = await call(page, "POST", `${TICKETS}/${ticket.id}/contacts`, { result: RESULT.CallBack });
    expect(noTime.status).toBe(403);
    expect(noTime.body.error?.code).toBe(ERR.CallBackTimeRequired);
    const nextCallAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const callBack = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/contacts`, { result: RESULT.CallBack, nextCallAt });
    expect(callBack.status).toBe(200);
    expect(callBack.body.nextCallAt).not.toBeNull();

    // Không tiềm năng needs a reason and closes the ticket.
    const noReason = await call(page, "POST", `${TICKETS}/${ticket.id}/not-potential`, { reason: "" });
    expect(noReason.status).toBe(400);
    const lost = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/not-potential`, { reason: "Đã làm ở nơi khác" });
    expect(lost.status).toBe(200);
    expect(lost.body.status).toBe(STATUS.NotPotential);
    expect(lost.body.notPotentialReason).toBe("Đã làm ở nơi khác");

    const closed = await call(page, "POST", `${TICKETS}/${ticket.id}/contacts`, { result: RESULT.Interested });
    expect(closed.body.error?.code).toBe(ERR.TicketClosed);
    const book = await call(page, "POST", `${TICKETS}/${ticket.id}/appointments`, futureSlot(0));
    expect(book.body.error?.code).toBe(ERR.InvalidTransition);

    const reopened = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/reopen`);
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe(STATUS.InCare);

    // A separate read: the record and the timeline are what was persisted.
    const reread = await getTicket(page, ticket.id);
    expect(reread.body.status).toBe(STATUS.InCare);
    expect(reread.body.contactCount).toBe(2);
    const kinds = (await activitiesOf(page, ticket.id)).map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining([KIND.Created, KIND.Contact, KIND.StatusChanged]));
    expect(kinds.filter((k) => k === KIND.Contact)).toHaveLength(2);

    await removeTicket(page, ticket.id);
  });

  test("the same phone, however it is spelled, reopens nothing new: it logs Phát sinh lại on the open ticket", async ({ page }) => {
    const phone = syntheticPhone();
    const first = await createTicket(page, { fullName: `Khách trùng ${runId()}`, phone });

    const spelled = `+84 ${phone.slice(1, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    const again = await createTicket(page, { fullName: "Tên khác", phone: spelled });
    expect(again.reoccurred).toBe(true);
    expect(again.ticket.id).toBe(first.ticket.id);
    expect((await activitiesOf(page, first.ticket.id)).map((a) => a.kind)).toContain(KIND.Reoccurred);

    // Editing another ticket onto the phone is refused too.
    const other = await createTicket(page, { fullName: `Khách khác ${runId()}`, phone: syntheticPhone() });
    const clash = await call(page, "PUT", `${TICKETS}/${other.ticket.id}`, { fullName: "Khách khác", phone, tagIds: [] });
    expect(clash.body.error?.code).toBe(ERR.DuplicateOpenPhone);

    // Delete keeps the why; a restore is refused while a newer open ticket holds the phone.
    const reason = `Nhập trùng ${runId()}`;
    expect((await call(page, "DELETE", `${TICKETS}/${first.ticket.id}`, { reason })).status).toBe(204);
    const deleted = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&Deleted=true&Filter=${phone}`);
    expect(deleted.body.items.map((t) => t.id)).toContain(first.ticket.id);
    expect(deleted.body.items.find((t) => t.id === first.ticket.id)?.deleteReason).toBe(reason);
    const live = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&Filter=${phone}`);
    expect(live.body.items.map((t) => t.id)).not.toContain(first.ticket.id);

    const newer = await createTicket(page, { fullName: "Khách quay lại", phone });
    expect(newer.reoccurred).toBe(false);
    const refused = await call(page, "POST", `${TICKETS}/${first.ticket.id}/restore`);
    expect(refused.body.error?.code).toBe(ERR.DuplicateOpenPhone);

    await removeTicket(page, newer.ticket.id);
    const restored = await call<Ticket>(page, "POST", `${TICKETS}/${first.ticket.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.isDeleted).toBe(false);
    expect((await getTicket(page, first.ticket.id)).status).toBe(200);

    await removeTicket(page, first.ticket.id);
    await removeTicket(page, other.ticket.id);
  });

  test("a tag's Thời gian xử lý sets the deadline; a booked ticket is never overdue", async ({ page }) => {
    const id = runId();
    const tag = await call<{ id: string }>(page, "POST", TAGS, {
      clinicBranchId: BRANCH_ONE,
      name: `Niềng răng ${id}`,
      color: "#6366f1",
      maxProcessingDays: 3,
    });
    expect(tag.status).toBe(200);
    const duplicate = await call(page, "POST", TAGS, { clinicBranchId: BRANCH_ONE, name: ` niềng RĂNG ${id} `, color: "#0e9f6e" });
    expect(duplicate.body.error?.code).toBe(ERR.DuplicateTagName);

    const { ticket } = await createTicket(page, { fullName: `Khách SLA ${id}`, phone: syntheticPhone(), tagIds: [tag.body.id] });
    expect(ticket.processingDays).toBe(3);
    expect(ticket.dueAt).not.toBeNull();
    const span = new Date(ticket.dueAt ?? 0).getTime() - new Date(ticket.receivedAt).getTime();
    expect(Math.round(span / 86_400_000)).toBe(3);
    expect(ticket.isOverdue).toBe(false);

    const tagged = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&TagId=${tag.body.id}`);
    expect(tagged.body.items.map((t) => t.id)).toEqual([ticket.id]);

    await removeTicket(page, ticket.id);
    expect((await call(page, "DELETE", `${TAGS}/${tag.body.id}`)).status).toBe(204);
  });

  test("Đặt lịch books a temporary appointment; cancelling it sends the ticket back to Đang chăm sóc", async ({ page }) => {
    const { ticket } = await createTicket(page, { fullName: `Khách đặt lịch ${runId()}`, phone: syntheticPhone() });

    const wrongBranch = await call(page, "POST", `${TICKETS}/${ticket.id}/appointments`, futureSlot(1), BRANCH_TWO);
    expect(wrongBranch.body.error?.code).toBe(ERR.BookFromOtherBranch);

    const booked = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/appointments`, { ...futureSlot(1), notes: "Từ ticket" });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);
    expect(booked.body.status).toBe(STATUS.Booked);
    expect(booked.body.appointmentId).not.toBeNull();
    expect(booked.body.assigneeId, "booking a pool ticket claims it").not.toBeNull();
    expect(booked.body.isOverdue).toBe(false);

    const appointmentId = booked.body.appointmentId ?? "";
    const appointment = await call<{ id: string; isTemp?: boolean; patientPhone?: string }>(page, "GET", `${APPOINTMENTS}/${appointmentId}`);
    expect(appointment.status).toBe(200);

    // The appointment side drives the ticket: no ticket call is made here.
    const cancelled = await call(page, "POST", `${APPOINTMENTS}/${appointmentId}/cancel`, { reason: 1, note: "Khách bận" });
    expect(cancelled.status).toBe(200);
    const after = await getTicket(page, ticket.id);
    expect(after.body.status).toBe(STATUS.InCare);
    const changed = (await activitiesOf(page, ticket.id)).find((a) => a.kind === KIND.AppointmentChanged);
    expect(changed?.fromStatus).toBe(STATUS.Booked);
    expect(changed?.toStatus).toBe(STATUS.InCare);

    await removeTicket(page, ticket.id);
  });

  test("a customer who already has a record is linked and needs a dentist to book", async ({ page }) => {
    const patients = await call<{ items: { id: string; phoneNumber: string | null }[] }>(
      page,
      "GET",
      `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${BRANCH_ONE}`,
    );
    const patient = patients.body.items.find((p) => p.phoneNumber && /^0\d{9,10}$/.test(p.phoneNumber));
    test.skip(!patient, "the branch has no patient with a phone to match");
    if (!patient?.phoneNumber) return;

    // An earlier run may have left an open ticket on this phone; either way it is the patient's.
    const { ticket } = await createTicket(page, { fullName: "Khách cũ", phone: patient.phoneNumber });
    expect(ticket.patientId).toBe(patient.id);
    expect(ticket.isReturningCustomer).toBe(true);

    const returning = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&ReturningCustomer=true&Filter=${patient.phoneNumber}`);
    expect(returning.body.items.map((t) => t.id)).toContain(ticket.id);

    const noDentist = await call(page, "POST", `${TICKETS}/${ticket.id}/appointments`, futureSlot(2));
    expect(noDentist.body.error?.code).toBe(ERR.DentistRequired);

    await removeTicket(page, ticket.id);
  });

  test("assignees are the branch's staff; assigning and returning to the pool are both on the timeline", async ({ page }) => {
    const assignees = await call<{ items: { id: string; name: string }[] }>(page, "GET", `${TICKETS}/assignees?clinicBranchId=${BRANCH_ONE}`);
    expect(assignees.status).toBe(200);
    expect(assignees.body.items.length).toBeGreaterThan(0);
    const staff = assignees.body.items[0];

    const { ticket } = await createTicket(page, { fullName: `Khách giao ${runId()}`, phone: syntheticPhone() });
    const assigned = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/assign`, { assigneeId: staff.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assigneeId).toBe(staff.id);
    expect(assigned.body.assigneeName).toBe(staff.name);

    const mine = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&AssigneeId=${staff.id}&Filter=${ticket.phone}`);
    expect(mine.body.items.map((t) => t.id)).toEqual([ticket.id]);

    const pooled = await call<Ticket>(page, "POST", `${TICKETS}/${ticket.id}/assign`, { assigneeId: null });
    expect(pooled.body.assigneeId).toBeNull();
    const pool = await call<{ items: Ticket[] }>(page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&Unassigned=true&Filter=${ticket.phone}`);
    expect(pool.body.items.map((t) => t.id)).toEqual([ticket.id]);

    const assignedLines = (await activitiesOf(page, ticket.id)).filter((a) => a.kind === KIND.Assigned);
    expect(assignedLines.map((a) => a.assigneeName)).toEqual(expect.arrayContaining([staff.name, null]));

    await removeTicket(page, ticket.id);
  });

  test("a branch-2 account can neither read nor list branch 1's tickets", async ({ page, browser }) => {
    const { ticket } = await createTicket(page, { fullName: `Khách chi nhánh 1 ${runId()}`, phone: syntheticPhone() });
    const other = await openSession(browser, BRANCH2_USER);
    try {
      const read = await getTicket(other.page, ticket.id, BRANCH_TWO);
      expect(read.status).toBe(403);
      const listed = await call<{ items: Ticket[] }>(other.page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}`, undefined, BRANCH_TWO);
      expect(listed.status).toBe(403);
      const assignees = await call(other.page, "GET", `${TICKETS}/assignees?clinicBranchId=${BRANCH_ONE}`, undefined, BRANCH_TWO);
      expect(assignees.status).toBe(403);
      const own = await call<{ items: Ticket[] }>(other.page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_TWO}&Filter=${ticket.phone}`, undefined, BRANCH_TWO);
      expect(own.status).toBe(200);
      expect(own.body.items).toHaveLength(0);
    } finally {
      await other.context.close();
      await removeTicket(page, ticket.id);
    }
  });
});

/**
 * Without `marketingTicket.readAll` a user works the pool and their own
 * tickets only. The account is a real dentist created on Nhân sự and signed
 * in on the login screen. Its leaves are saved through the endpoint Cài đặt →
 * Phân quyền saves to: the tree's search matches `marketingTicket.read`
 * inside `…readAll` too, so `setDentistLeaf` cannot single it out. Serial
 * because the dentist role's grants are shared with other permission specs.
 */
test.describe.serial("Marketing ticket (API) — own scope", () => {
  const LEAVES = ["marketingTicket.read", "marketingTicket.update"];

  async function grantDentist(page: Page, isGranted: boolean) {
    const permissions = LEAVES.map((leaf) => ({ name: `BlueDental.${leaf}`, isGranted }));
    const saved = await call(page, "PUT", `/api/permission-management/permissions?providerName=R&providerKey=${DENTIST_ROLE}`, { permissions });
    expect(saved.status).toBeLessThan(300);
  }

  test("a user without Xem tất cả sees the pool and their own tickets, not a colleague's", async ({ page, browser }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const id = runId();
    const userName = `bsmkt${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI MARKETING ${id}`;

    await login(page);
    await createDentist(page, fullName, userName, password);
    await grantDentist(page, true);

    const { ticket: pooled } = await createTicket(page, { fullName: `Khách chung ${id}`, phone: syntheticPhone() });
    const { ticket: taken } = await createTicket(page, { fullName: `Khách của admin ${id}`, phone: syntheticPhone() });
    const claimed = await call<Ticket>(page, "POST", `${TICKETS}/${taken.id}/contacts`, { result: RESULT.NoAnswer });
    expect(claimed.body.assigneeId).not.toBeNull();

    const dentist = await openDentistSession(browser, userName, password);
    try {
      const colleague = await getTicket(dentist.page, taken.id);
      expect(colleague.status).toBe(403);
      expect(colleague.body.error?.code).toBe(ERR.NotYours);
      const hidden = await call<{ items: Ticket[] }>(dentist.page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&Filter=${taken.phone}`);
      expect(hidden.body.items).toHaveLength(0);

      expect((await getTicket(dentist.page, pooled.id)).status).toBe(200);
      const listed = await call<{ items: Ticket[] }>(dentist.page, "GET", `${TICKETS}?ClinicBranchId=${BRANCH_ONE}&Filter=${pooled.phone}`);
      expect(listed.body.items.map((t) => t.id)).toEqual([pooled.id]);

      // Working a pool ticket makes it theirs; deleting is a leaf they lack.
      const worked = await call<Ticket>(dentist.page, "POST", `${TICKETS}/${pooled.id}/contacts`, { result: RESULT.Interested });
      expect(worked.status).toBe(200);
      expect(worked.body.assigneeName).toBe(fullName);
      const removed = await call(dentist.page, "DELETE", `${TICKETS}/${pooled.id}`, { reason: "thử xoá" });
      expect(removed.status).toBe(403);
      expect((await getTicket(page, pooled.id)).body.isDeleted).toBe(false);
    } finally {
      await dentist.context.close();
      await grantDentist(page, false);
      await deleteDentist(page, fullName);
      await removeTicket(page, pooled.id);
      await removeTicket(page, taken.id);
    }
  });
});
