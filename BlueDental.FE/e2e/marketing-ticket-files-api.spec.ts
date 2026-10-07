import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  BRANCH_ONE,
  BRANCH_TWO,
  call,
  FILES,
  removeTicket,
  staffOf,
  syntheticPhone,
  ticketsWhere,
  TICKETS,
  ticketWorkbook,
  uploadTicketFile,
} from "./fixtures/marketingTicket";

/**
 * Feature: Marketing → Ticket (F-55), đợt 2 — Chuyển ticket hàng loạt (BA 8.3)
 * and Ticket File (BA 8.4), the rules the API keeps on its own.
 * BlueDental-local; see docs/clone/pages/marketing-ticket.md.
 *
 * Real HTTP from a page logged in through the login screen; nothing is
 * intercepted, every follow-up read is its own request. Phones are synthetic.
 */

const ERR = {
  AssigneeNotInBranch: "BlueDental:MarketingTicket:0006",
  ImportInvalidFile: "BlueDental:MarketingTicket:0013",
  ImportColumnMissing: "BlueDental:MarketingTicket:0015",
} as const;

interface ImportResult {
  committed: boolean;
  rowCount: number;
  createdCount: number;
  reoccurredCount: number;
  errors: { row: number; errors: string[] }[];
  file?: { id: string; fileName: string; assigneeNames: string[]; progress: { all: number; new: number } } | null;
}

async function createTicket(page: Page, fullName: string, phone: string) {
  const res = await call<{ ticket: { id: string } }>(page, "POST", TICKETS, { clinicBranchId: BRANCH_ONE, tagIds: [], fullName, phone });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.ticket.id;
}

test.describe("Marketing ticket — Chuyển ticket & Ticket File (API)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/marketing/tickets");
  });

  test("Chuyển ticket deals the filtered tickets in turn to the chosen staff, and only those", async ({ page }) => {
    const staff = await staffOf(page);
    expect(staff.length, "branch 1 needs two staff to split between").toBeGreaterThanOrEqual(2);
    const [first, second] = staff;
    const tag = `Chuyen ${runId()}`;
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(await createTicket(page, `${tag} ${i}`, syntheticPhone()));
    const outsider = await createTicket(page, `Ngoai loc ${runId()}`, syntheticPhone());

    try {
      // A group of two: four tickets → two each, oldest first.
      const moved = await call<{ matched: number; transferred: number }>(page, "POST", `${TICKETS}/transfer`, {
        clinicBranchId: BRANCH_ONE,
        filter: tag,
        assigneeIds: [first.id, second.id],
      });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
      expect(moved.body).toEqual({ matched: 4, transferred: 4 });

      const after = await ticketsWhere(page, `Filter=${encodeURIComponent(tag)}`);
      const byAssignee = (id: string) => after.filter((t) => t.assigneeId === id).length;
      expect(byAssignee(first.id)).toBe(2);
      expect(byAssignee(second.id)).toBe(2);
      // The ticket outside the filter stays in the pool.
      const untouched = await call<{ assigneeId: string | null }>(page, "GET", `${TICKETS}/${outsider}`);
      expect(untouched.body.assigneeId).toBeNull();
      // Each move is on the ticket's timeline as Phân công (kind 4).
      const activities = await call<{ kind: number; assigneeName: string | null }[]>(page, "GET", `${TICKETS}/${ids[0]}/activities`);
      expect(activities.body.some((a) => a.kind === 4 && a.assigneeName)).toBe(true);

      // The same deal again finds every ticket already with its staff member.
      const again = await call<{ matched: number; transferred: number }>(page, "POST", `${TICKETS}/transfer`, {
        clinicBranchId: BRANCH_ONE,
        filter: tag,
        assigneeIds: [first.id, second.id],
      });
      expect(again.body).toEqual({ matched: 4, transferred: 0 });

      // Nobody to transfer to, or someone from outside the branch, is refused.
      const nobody = await call(page, "POST", `${TICKETS}/transfer`, { clinicBranchId: BRANCH_ONE, filter: tag, assigneeIds: [] });
      expect(nobody.status).toBe(400);
      const stranger = await call(page, "POST", `${TICKETS}/transfer`, {
        clinicBranchId: BRANCH_ONE,
        filter: tag,
        assigneeIds: ["00000000-0000-0000-0000-00000000abcd"],
      });
      expect(stranger.body.error?.code).toBe(ERR.AssigneeNotInBranch);
    } finally {
      for (const id of [...ids, outsider]) await removeTicket(page, id);
    }
  });

  test("a file of the clinic's own layout imports through the mapping; a known phone is Phát sinh lại", async ({ page }) => {
    const staff = await staffOf(page);
    const id = runId();
    const known = syntheticPhone();
    const knownId = await createTicket(page, `Da co ${id}`, known);
    const fresh = [syntheticPhone(), syntheticPhone()];
    // Columns in an order of the clinic's own, with headers the template does not use.
    const file = ticketWorkbook([
      ["Ghi chu", "SDT khach", "Ten KH", "Thu"],
      ["Hoi nieng rang", fresh[0], `File A ${id}`, "a@example.com"],
      ["", `${fresh[1].slice(0, 4)} ${fresh[1].slice(4)}`, `File B ${id}`, ""],
      ["Goi lai", known, `Da co ${id}`, ""],
    ]);
    const fileName = `khach-${id}.xlsx`;

    const headers = await uploadTicketFile<{ headers: string[]; rowCount: number; suggested: Record<string, number | null> }>(
      page,
      `${FILES}/inspect`,
      fileName,
      file,
      [],
    );
    expect(headers.status).toBe(200);
    expect(headers.body.headers).toEqual(["Ghi chu", "SDT khach", "Ten KH", "Thu"]);
    expect(headers.body.rowCount).toBe(3);
    expect(headers.body.suggested.phone ?? null).toBeNull();

    const imported = await uploadTicketFile<ImportResult>(page, FILES, fileName, file, [
      ["clinicBranchId", BRANCH_ONE],
      ["fullNameColumn", "3"],
      ["phoneColumn", "2"],
      ["emailColumn", "4"],
      ["noteColumn", "1"],
      ["assigneeIds", staff[0].id],
    ]);
    let createdIds: string[] = [];
    try {
      expect(imported.status, JSON.stringify(imported.body)).toBe(200);
      expect(imported.body).toMatchObject({ committed: true, rowCount: 3, createdCount: 2, reoccurredCount: 1, errors: [] });
      const fileId = imported.body.file?.id ?? "";
      expect(imported.body.file?.assigneeNames).toEqual([staff[0].name]);

      // The file's tickets: the two new ones, both dealt to the chosen staff member, phones normalised.
      const tickets = await ticketsWhere(page, `ImportFileId=${fileId}`);
      createdIds = tickets.map((t) => t.id);
      expect(tickets.map((t) => t.phone).sort()).toEqual([...fresh].sort());
      expect(tickets.every((t) => t.assigneeId === staff[0].id)).toBe(true);

      // The known phone did not get a second ticket; its open one logged Phát sinh lại (kind 5).
      expect((await ticketsWhere(page, `Filter=${known}`)).map((t) => t.id)).toEqual([knownId]);
      const log = await call<{ kind: number }[]>(page, "GET", `${TICKETS}/${knownId}/activities`);
      expect(log.body.some((a) => a.kind === 5)).toBe(true);

      // Ticket File lists it, with the progress of its own tickets — read back by a separate request.
      const list = await call<{ items: { id: string; createdCount: number; progress: { all: number; new: number } }[] }>(
        page,
        "GET",
        `${FILES}?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(fileName)}`,
      );
      const row = list.body.items.find((f) => f.id === fileId);
      expect(row?.createdCount).toBe(2);
      expect(row?.progress.new).toBe(2);
    } finally {
      for (const ticketId of [...createdIds, knownId]) await removeTicket(page, ticketId);
    }
  });

  test("one bad row refuses the whole file and names every row to fix", async ({ page }) => {
    const id = runId();
    const good = syntheticPhone();
    const dup = syntheticPhone();
    const file = ticketWorkbook([
      ["Họ và tên", "Số điện thoại", "Email", "Ghi chú"],
      [`Tot ${id}`, good, "", ""],
      ["", syntheticPhone(), "", ""],
      [`Sai so ${id}`, "12ab", "", ""],
      [`Trung 1 ${id}`, dup, "khong-phai-email", ""],
      [`Trung 2 ${id}`, dup, "", ""],
    ]);
    const fileName = `loi-${id}.xlsx`;

    // The template's own headers are matched without a mapping.
    const headers = await uploadTicketFile<{ suggested: Record<string, number> }>(page, `${FILES}/inspect`, fileName, file, []);
    expect(headers.body.suggested).toMatchObject({ fullName: 1, phone: 2, email: 3, note: 4 });

    const refused = await uploadTicketFile<ImportResult>(page, FILES, fileName, file, [
      ["clinicBranchId", BRANCH_ONE],
      ["fullNameColumn", "1"],
      ["phoneColumn", "2"],
      ["emailColumn", "3"],
    ]);
    expect(refused.status).toBe(200);
    expect(refused.body.committed).toBe(false);
    expect(refused.body.createdCount).toBe(0);
    const errorsOf = (row: number) => refused.body.errors.find((e) => e.row === row)?.errors ?? [];
    expect(refused.body.errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(errorsOf(3)).toContain("Thiếu họ tên");
    expect(errorsOf(4).join()).toContain("Số điện thoại không hợp lệ");
    expect(errorsOf(5).join()).toContain("Email không hợp lệ");
    expect(errorsOf(6)).toContain("Số điện thoại trùng với dòng 5");

    // Nothing was written: not the good row, not the file.
    expect(await ticketsWhere(page, `Filter=${good}`)).toHaveLength(0);
    const list = await call<{ items: unknown[] }>(page, "GET", `${FILES}?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(fileName)}`);
    expect(list.body.items).toHaveLength(0);

    // Without Số điện thoại mapped, or not an Excel file at all, there is nothing to read.
    const unmapped = await uploadTicketFile(page, FILES, fileName, file, [
      ["clinicBranchId", BRANCH_ONE],
      ["fullNameColumn", "1"],
    ]);
    expect(unmapped.body.error?.code).toBe(ERR.ImportColumnMissing);
    const notExcel = await uploadTicketFile(page, `${FILES}/inspect`, "ghi-chu.xlsx", btoa("not a workbook"), []);
    expect(notExcel.body.error?.code).toBe(ERR.ImportInvalidFile);
  });

  test("a branch-2 account cannot import into, list or transfer branch 1", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, BRANCH2_USER);
      await page.goto("/marketing/tickets");
      const file = ticketWorkbook([["Họ và tên", "Số điện thoại"], [`X ${runId()}`, syntheticPhone()]]);
      const imported = await uploadTicketFile(page, FILES, "x.xlsx", file, [
        ["clinicBranchId", BRANCH_ONE],
        ["fullNameColumn", "1"],
        ["phoneColumn", "2"],
      ], BRANCH_TWO);
      expect(imported.status).toBe(403);
      const list = await call(page, "GET", `${FILES}?ClinicBranchId=${BRANCH_ONE}`, undefined, BRANCH_TWO);
      expect(list.status).toBe(403);
      const transfer = await call(page, "POST", `${TICKETS}/transfer`, { clinicBranchId: BRANCH_ONE, assigneeIds: [BRANCH_TWO] }, BRANCH_TWO);
      expect(transfer.status).toBe(403);
    } finally {
      await context.close();
    }
  });
});
