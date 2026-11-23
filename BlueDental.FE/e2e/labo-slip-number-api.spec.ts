import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { BRANCH_ONE, call, LABO_ORDERS, LaboStatus, type Paged } from "./fixtures/laboApi";
import { fullSlip, newPatient, post, readBack, save, slipCatalog, slipNo, type SlipOrderView } from "./fixtures/laboSlipApi";

/**
 * R-1288: the Phiếu yêu cầu's Mã số is the server's — "{Mã BN}-{yyyyMMdd}-{xxx}",
 * the day the number is handed out (clinic time) and xxx counting the patient's
 * slips over their whole life, never reused. The form no longer sends one; an
 * explicit one (API, old hand-typed slips) is still kept and kept unique.
 *
 * Every call is a real HTTP request from the logged-in page against the real
 * database; every write is read back with its own GET.
 */

const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const LAB_SLIP_NO_TAKEN = "BlueDental:Labo:0043";

/** Today in the clinic's calendar (Asia/Ho_Chi_Minh), as yyyyMMdd. */
function clinicToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts.replaceAll("-", "");
}

async function patientCode(page: Page, patientId: string, branchId = BRANCH_ONE): Promise<string> {
  const res = await call<{ patientCode: string }>(page, `/api/v1/app/patients/${patientId}`, { branchId });
  expect(res.status, res.text).toBe(200);
  return res.body.patientCode!;
}

function nextSlipNo(page: Page, patientId: string, branchId = BRANCH_ONE) {
  return call<string>(page, `${LABO_ORDERS}/next-slip-no?patientId=${patientId}`, { branchId });
}

/** A Phiếu yêu cầu saved the way the form now saves it: no Mã số. */
async function saveAuto(page: Page, patientId: string, submit = true): Promise<SlipOrderView> {
  const c = await slipCatalog(page);
  const made = await save(page, fullSlip(c, patientId, "", { submit }));
  expect(made.status, made.text).toBe(200);
  return readBack(page, made.body.id!);
}

test.describe("Labo Phiếu yêu cầu Mã số tự động (R-1288)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a patient's first slip takes {Mã BN}-{today}-001, previewed beforehand, then 002, 003", async ({ page }) => {
    const patientId = await newPatient(page, "sn-first");
    const code = await patientCode(page, patientId);
    const today = clinicToday();

    const preview = await nextSlipNo(page, patientId);
    expect(preview.status, preview.text).toBe(200);
    expect(preview.body).toBe(`${code}-${today}-001`);

    const first = await saveAuto(page, patientId);
    expect(first.status).toBe(LaboStatus.Sent);
    expect(first.labSlipNo).toBe(`${code}-${today}-001`);

    expect((await nextSlipNo(page, patientId)).body).toBe(`${code}-${today}-002`);
    const draft = await saveAuto(page, patientId, false);
    expect(draft.status).toBe(LaboStatus.Draft);
    expect(draft.labSlipNo).toBe(`${code}-${today}-002`);
    const third = await saveAuto(page, patientId);
    expect(third.labSlipNo).toBe(`${code}-${today}-003`);
  });

  test("each patient counts on their own", async ({ page }) => {
    const a = await newPatient(page, "sn-a");
    const b = await newPatient(page, "sn-b");
    const today = clinicToday();
    await saveAuto(page, a);
    await saveAuto(page, a);
    const firstOfB = await saveAuto(page, b);
    expect(firstOfB.labSlipNo).toBe(`${await patientCode(page, b)}-${today}-001`);
    expect((await nextSlipNo(page, a)).body).toBe(`${await patientCode(page, a)}-${today}-003`);
  });

  test("several people saving a slip for one patient at the same moment each get their own number", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "sn-race");
    const code = await patientCode(page, patientId);
    const today = clinicToday();

    // Five saves in flight together, drafts and sends mixed: none may fail on
    // the unique index, none may share a number.
    const made = await Promise.all(
      [true, false, true, false, true].map((submit) => save(page, fullSlip(c, patientId, "", { submit }))),
    );
    for (const res of made) expect(res.status, res.text).toBe(200);

    const numbers = await Promise.all(made.map(async (res) => (await readBack(page, res.body.id!)).labSlipNo));
    expect([...numbers].sort()).toEqual(["001", "002", "003", "004", "005"].map((n) => `${code}-${today}-${n}`));
    expect((await nextSlipNo(page, patientId)).body).toBe(`${code}-${today}-006`);
  });

  test("a cancelled or deleted slip keeps its number used", async ({ page }) => {
    const patientId = await newPatient(page, "sn-gone");
    const code = await patientCode(page, patientId);
    const today = clinicToday();

    const sent = await saveAuto(page, patientId);
    const cancelled = await call(page, `${LABO_ORDERS}/${sent.id}/cancel`, { method: "POST", branchId: BRANCH_ONE });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect((await readBack(page, sent.id)).labSlipNo).toBe(`${code}-${today}-001`);

    const draft = await saveAuto(page, patientId, false);
    expect(draft.labSlipNo).toBe(`${code}-${today}-002`);
    const deleted = await call(page, `${LABO_ORDERS}/${draft.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(deleted.status, deleted.text).toBe(204);
    expect((await call(page, `${LABO_ORDERS}/${draft.id}`, { branchId: BRANCH_ONE })).status).toBe(404);

    const next = await saveAuto(page, patientId);
    expect(next.labSlipNo).toBe(`${code}-${today}-003`);
  });

  test("a saved slip keeps its number on every later save, Lưu nháp and Gửi alike", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "sn-keep");
    const draft = await saveAuto(page, patientId, false);
    const own = draft.labSlipNo!;

    // A later slip takes 002, so a re-numbering on save would show.
    await saveAuto(page, patientId);

    const resaved = await save(page, fullSlip(c, patientId, "", { submit: false, teeth: [26] }), draft.id);
    expect(resaved.status, resaved.text).toBe(200);
    expect((await readBack(page, draft.id)).labSlipNo).toBe(own);

    const sent = await save(page, fullSlip(c, patientId, ""), draft.id);
    expect(sent.status, sent.text).toBe(200);
    const after = await readBack(page, draft.id);
    expect(after.status).toBe(LaboStatus.Sent);
    expect(after.labSlipNo).toBe(own);
  });

  test("an old hand-typed Mã số is kept, and never moves the counter", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "sn-typed");
    const code = await patientCode(page, patientId);
    const typed = slipNo("typed");

    const old = await save(page, fullSlip(c, patientId, typed, { submit: false }));
    expect(old.status, old.text).toBe(200);
    // Saved again as the form now saves it: no Mã số sent.
    const resaved = await save(page, fullSlip(c, patientId, ""), old.body.id!);
    expect(resaved.status, resaved.text).toBe(200);
    expect((await readBack(page, old.body.id!)).labSlipNo).toBe(typed);

    const auto = await saveAuto(page, patientId);
    expect(auto.labSlipNo).toBe(`${code}-${clinicToday()}-001`);
  });

  test("the counter carries on from the patient's highest number, whatever its day", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "sn-day");
    const code = await patientCode(page, patientId);

    // A slip numbered on an earlier day (sent explicitly, as an import would).
    const earlier = await save(page, fullSlip(c, patientId, `${code}-20250101-007`));
    expect(earlier.status, earlier.text).toBe(200);

    const next = await saveAuto(page, patientId);
    expect(next.labSlipNo).toBe(`${code}-${clinicToday()}-008`);
  });

  test("an explicit Mã số is still unique in the branch, the server's included", async ({ page }) => {
    const c = await slipCatalog(page);
    const a = await newPatient(page, "sn-dup-a");
    const b = await newPatient(page, "sn-dup-b");
    const taken = (await saveAuto(page, a)).labSlipNo!;

    const clash = await save(page, fullSlip(c, b, taken));
    expect(clash.status).toBe(403);
    expect(clash.body.error?.code).toBe(LAB_SLIP_NO_TAKEN);
  });

  test("the preview needs a patient of the current branch", async ({ page }) => {
    const other = await post(
      page,
      "/api/v1/app/patients",
      {
        firstName: "Phiếu YC sn-b2",
        lastName: "E2E",
        dateOfBirth: null,
        gender: "male",
        phoneNumber: `07${`${Date.now()}`.slice(-8)}`,
      },
      BRANCH_TWO,
    );

    const fromBranchOne = await nextSlipNo(page, other.id, BRANCH_ONE);
    expect(fromBranchOne.status, fromBranchOne.text).toBe(404);

    const fromBranchTwo = await nextSlipNo(page, other.id, BRANCH_TWO);
    expect(fromBranchTwo.status, fromBranchTwo.text).toBe(200);
    expect(fromBranchTwo.body).toBe(`${await patientCode(page, other.id, BRANCH_TWO)}-${clinicToday()}-001`);

    const unknown = await nextSlipNo(page, "00000000-0000-0000-0000-000000000001");
    expect(unknown.status).toBe(404);
  });

  test("/labo search finds a slip by its full Mã số and by the shown yyyyMMdd-xxx", async ({ page }) => {
    const patientId = await newPatient(page, "sn-find");
    const made = await saveAuto(page, patientId);
    const full = made.labSlipNo!;
    const shown = full.slice(-12);

    for (const term of [full, shown]) {
      const found = await call<Paged<SlipOrderView>>(
        page,
        `${LABO_ORDERS}?BranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(term)}&MaxResultCount=200`,
        { branchId: BRANCH_ONE },
      );
      expect(found.status, found.text).toBe(200);
      expect(found.body.items?.map((o) => o.id), term).toContain(made.id);
    }
  });
});
