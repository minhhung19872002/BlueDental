import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, MANAGER_USER, runId, TEST_USER } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: header → "Thêm ghi chú" (F-74) — the rules the API keeps on its own.
 * BlueDental-local; see docs/testing/features/staff-notes.md.
 *
 * Every call is a real HTTP request from inside a page logged in through the
 * login screen, as three seeded accounts: admin, manager (no branch
 * assignment, so clinic-wide; own branch BD-001) and branch2 (limited to the
 * second branch). Nothing is intercepted; every follow-up read is a separate
 * request.
 */

const NOTES = "/api/v1/app/staff-notes";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const SCOPE = { Shared: 1, Personal: 2 } as const;

interface StaffNote {
  id: string;
  scope: number;
  clinicBranchId: string | null;
  content: string;
  creatorId: string | null;
  creatorName: string | null;
  creationTime: string;
  lastModificationTime: string | null;
  canEdit: boolean;
}

interface NotePage {
  totalCount: number;
  items: StaffNote[];
}

const errorCode = (body: { error?: { code?: string } }) => body.error?.code;

async function signIn(browser: Browser, credentials: { userName: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, credentials);
  return page;
}

async function create(page: Page, scope: number, content: string, branchId?: string) {
  return call<StaffNote>(page, NOTES, { method: "POST", branchId, json: { scope, content } });
}

async function createOk(page: Page, scope: number, content: string, branchId?: string): Promise<StaffNote> {
  const res = await create(page, scope, content, branchId);
  expect(res.status, `create "${content}" (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}

async function list(page: Page, scope: number, filter: string, branchId?: string, paging = "MaxResultCount=50") {
  const query = `Scope=${scope}&Filter=${encodeURIComponent(filter)}&${paging}`;
  return call<NotePage>(page, `${NOTES}?${query}`, { branchId });
}

async function listOk(page: Page, scope: number, filter: string, branchId?: string, paging?: string): Promise<NotePage> {
  const res = await list(page, scope, filter, branchId, paging);
  expect(res.status, `list "${filter}" (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}

const update = (page: Page, id: string, content: string, branchId?: string) =>
  call<StaffNote>(page, `${NOTES}/${id}`, { method: "PUT", branchId, json: { content } });

const remove = (page: Page, id: string, branchId?: string) =>
  call(page, `${NOTES}/${id}`, { method: "DELETE", branchId });

const contents = (page: NotePage) => page.items.map((n) => n.content).sort();

test.describe.serial("Ghi chú — API rules", () => {
  const run = `sn${runId()}`;
  let admin: Page;
  let manager: Page;
  let branch2: Page;
  /** Every note the run wrote, so afterAll can leave nothing behind. */
  const written: { page: () => Page; id: string; branchId?: string }[] = [];

  test.beforeAll(async ({ browser }) => {
    admin = await signIn(browser, TEST_USER);
    manager = await signIn(browser, MANAGER_USER);
    branch2 = await signIn(browser, BRANCH2_USER);
  });

  test.afterAll(async () => {
    for (const note of written) {
      await remove(note.page(), note.id, note.branchId);
    }
  });

  test("a Cá nhân note belongs to its author alone, whichever branch is picked", async () => {
    const note = await createOk(admin, SCOPE.Personal, `${run} riêng tư`, BRANCH_ONE);
    written.push({ page: () => admin, id: note.id });
    expect(note.scope).toBe(SCOPE.Personal);
    expect(note.clinicBranchId, "a Cá nhân note is tied to no branch").toBeNull();
    expect(note.canEdit).toBe(true);

    // The author finds it from any branch, and from "Tất cả chi nhánh".
    for (const branchId of [BRANCH_ONE, BRANCH_TWO, undefined]) {
      expect(contents(await listOk(admin, SCOPE.Personal, run, branchId)), `author, branch ${branchId ?? "all"}`)
        .toEqual([`${run} riêng tư`]);
    }

    // Nobody else does — not even a clinic-wide account.
    expect((await listOk(manager, SCOPE.Personal, run)).totalCount).toBe(0);
    expect((await listOk(branch2, SCOPE.Personal, run, BRANCH_TWO)).totalCount).toBe(0);
    expect((await listOk(manager, SCOPE.Shared, run)).totalCount, "it never shows under Chung").toBe(0);

    // To anyone else it does not exist.
    expect((await update(manager, note.id, "chiếm")).status).toBe(404);
    expect((await remove(manager, note.id)).status).toBe(404);
    expect((await listOk(admin, SCOPE.Personal, run)).items[0].content, "untouched").toBe(`${run} riêng tư`);
  });

  test("a Chung note is seen in its branch only, and written only where the account may work", async () => {
    const one = await createOk(admin, SCOPE.Shared, `${run} chung một`, BRANCH_ONE);
    written.push({ page: () => admin, id: one.id, branchId: BRANCH_ONE });
    const two = await createOk(branch2, SCOPE.Shared, `${run} chung hai`, BRANCH_TWO);
    written.push({ page: () => branch2, id: two.id, branchId: BRANCH_TWO });
    expect(one.clinicBranchId).toBe(BRANCH_ONE);
    expect(two.clinicBranchId).toBe(BRANCH_TWO);

    // branch2 sees its own branch, picked or not.
    expect(contents(await listOk(branch2, SCOPE.Shared, run, BRANCH_TWO))).toEqual([`${run} chung hai`]);
    expect(contents(await listOk(branch2, SCOPE.Shared, run))).toEqual([`${run} chung hai`]);

    // The clinic-wide manager sees the picked branch, or every branch.
    expect(contents(await listOk(manager, SCOPE.Shared, run, BRANCH_ONE))).toEqual([`${run} chung một`]);
    expect(contents(await listOk(manager, SCOPE.Shared, run, BRANCH_TWO))).toEqual([`${run} chung hai`]);
    expect(contents(await listOk(manager, SCOPE.Shared, run))).toEqual([`${run} chung hai`, `${run} chung một`]);

    // branch2 cannot read, write into, or touch the first branch.
    expect((await list(branch2, SCOPE.Shared, run, BRANCH_ONE)).status, "read another branch").toBe(403);
    expect((await create(branch2, SCOPE.Shared, `${run} lạc nhánh`, BRANCH_ONE)).status, "write into it").toBe(403);
    expect((await update(branch2, one.id, "chiếm", BRANCH_TWO)).status, "edit its note").toBe(403);
    expect((await remove(branch2, one.id, BRANCH_TWO)).status, "delete its note").toBe(403);
    expect(contents(await listOk(manager, SCOPE.Shared, `${run} chung`, BRANCH_ONE)), "nothing landed")
      .toEqual([`${run} chung một`]);
  });

  test("with no branch picked, a new Chung note lands in the account's own branch", async () => {
    const note = await createOk(manager, SCOPE.Shared, `${run} mặc định`);
    written.push({ page: () => manager, id: note.id });
    expect(note.clinicBranchId, "manager's own branch is BD-001").toBe(BRANCH_ONE);
    expect(contents(await listOk(admin, SCOPE.Shared, `${run} mặc định`, BRANCH_ONE))).toEqual([`${run} mặc định`]);
  });

  test("only the author edits or deletes a Chung note; everyone in the branch reads it", async () => {
    const note = await createOk(admin, SCOPE.Shared, `${run} của admin`, BRANCH_ONE);
    written.push({ page: () => admin, id: note.id, branchId: BRANCH_ONE });

    const seen = (await listOk(manager, SCOPE.Shared, `${run} của admin`, BRANCH_ONE)).items[0];
    expect(seen.id).toBe(note.id);
    expect(seen.canEdit, "manager may copy, not edit").toBe(false);
    expect(seen.creatorName, "the byline names the author").toBeTruthy();

    const foreignEdit = await update(manager, note.id, "chiếm", BRANCH_ONE);
    expect(errorCode(foreignEdit.body)).toBe("BlueDental:StaffNote:0004");
    const foreignDelete = await remove(manager, note.id, BRANCH_ONE);
    expect(errorCode(foreignDelete.body)).toBe("BlueDental:StaffNote:0004");

    const edited = await update(admin, note.id, `   ${run} của admin, đã sửa  `, BRANCH_ONE);
    expect(edited.status, JSON.stringify(edited.body.error)).toBe(200);
    expect(edited.body.content, "trimmed").toBe(`${run} của admin, đã sửa`);

    const reread = (await listOk(manager, SCOPE.Shared, `${run} của admin`, BRANCH_ONE)).items;
    expect(reread.map((n) => n.content)).toEqual([`${run} của admin, đã sửa`]);
    expect(reread[0].lastModificationTime, "the edit is stamped").not.toBeNull();
  });

  test("content is required, at most 2000 characters, and the scope must be one of the two", async () => {
    expect(errorCode((await create(admin, SCOPE.Personal, "   ")).body)).toBe("BlueDental:StaffNote:0001");
    expect(errorCode((await create(admin, SCOPE.Shared, "", BRANCH_ONE)).body)).toBe("BlueDental:StaffNote:0001");

    const tooLong = await create(admin, SCOPE.Personal, `${run} ${"x".repeat(2000)}`);
    expect(errorCode(tooLong.body)).toBe("BlueDental:StaffNote:0002");
    const atLimit = await createOk(admin, SCOPE.Personal, `${run}${"y".repeat(2000 - run.length)}`);
    written.push({ page: () => admin, id: atLimit.id });
    expect(atLimit.content).toHaveLength(2000);

    expect(errorCode((await create(admin, 9, `${run} lạ`)).body)).toBe("BlueDental:StaffNote:0005");

    expect(errorCode((await update(admin, atLimit.id, "  ")).body), "an edit cannot empty it")
      .toBe("BlueDental:StaffNote:0001");
    expect((await listOk(admin, SCOPE.Personal, `${run}yyy`)).items[0].content, "untouched").toHaveLength(2000);
    expect((await listOk(admin, SCOPE.Personal, `${run} lạ`)).totalCount, "nothing stored").toBe(0);
  });

  test("search is on the server, every word must match, case does not matter", async () => {
    const tag = `${run}tk`;
    for (const content of [`${tag} Nhắc lễ tân gọi khách`, `${tag} gọi LẠI bác sĩ`, `${tag} đặt vật tư`]) {
      written.push({ page: () => admin, id: (await createOk(admin, SCOPE.Personal, content)).id });
    }

    expect(contents(await listOk(admin, SCOPE.Personal, `${tag} GỌI`)))
      .toEqual([`${tag} Nhắc lễ tân gọi khách`, `${tag} gọi LẠI bác sĩ`]);
    expect(contents(await listOk(admin, SCOPE.Personal, `${tag} gọi lại`))).toEqual([`${tag} gọi LẠI bác sĩ`]);
    expect((await listOk(admin, SCOPE.Personal, `${tag} không có`)).totalCount).toBe(0);
  });

  test("pages come newest first with the full count", async () => {
    const tag = `${run}pg`;
    for (const n of [1, 2, 3]) {
      written.push({ page: () => admin, id: (await createOk(admin, SCOPE.Personal, `${tag} số ${n}`)).id });
    }

    const first = await listOk(admin, SCOPE.Personal, tag, undefined, "SkipCount=0&MaxResultCount=2");
    expect(first.totalCount).toBe(3);
    expect(first.items.map((n) => n.content)).toEqual([`${tag} số 3`, `${tag} số 2`]);
    const second = await listOk(admin, SCOPE.Personal, tag, undefined, "SkipCount=2&MaxResultCount=2");
    expect(second.items.map((n) => n.content)).toEqual([`${tag} số 1`]);
  });

  test("a deleted note is gone from the list and can no longer be edited", async () => {
    const note = await createOk(admin, SCOPE.Shared, `${run} sẽ xoá`, BRANCH_ONE);

    expect((await remove(admin, note.id, BRANCH_ONE)).status).toBe(204);
    expect((await listOk(manager, SCOPE.Shared, `${run} sẽ xoá`, BRANCH_ONE)).totalCount).toBe(0);
    expect((await update(admin, note.id, "hồi sinh", BRANCH_ONE)).status).toBe(404);
    expect((await remove(admin, note.id, BRANCH_ONE)).status, "deleting twice").toBe(404);
  });
});
