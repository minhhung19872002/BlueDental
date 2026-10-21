import { expect, test, type Browser, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, createRunStaff, deleteStaff, RUN_STAFF_PASSWORD, type RunStaff } from "./fixtures/timekeepingStaff";
import { openSlipFor, type TreatingSlip as Slip } from "./fixtures/treatingSlip";

/**
 * Which slips, and whose money, a user sees on a patient (R-961, reshaped by BA
 * P2010 "Tài chính / Kế toán › Chi phí › Xem"):
 *
 *  - the "Kế hoạch điều trị" tab, and a slip's page by its link: without
 *    "Chi phí › Xem" only the slips the user received (Bác sĩ tiếp nhận), even
 *    as a team head; with it a dentist sees their part of the Sơ đồ tổ chức (a
 *    head their own and their team's, their own first) and anyone else every
 *    slip; an admin every slip. Payment, labo and Hồ sơ's table keep every slip;
 *  - a slip received outside that part still shows when one of its lines is
 *    assigned inside it — Bác sĩ điều trị, Bác sĩ tư vấn (the slip's when the
 *    line names none) or Bác sĩ tư vấn 2, never Bác sĩ chẩn đoán. With
 *    "Chi phí › Xem" only those lines' money shows; without it none does, their
 *    own lines' included ("Dc assign mà ko có quyền xem thì masking lại hết").
 *    Masked figures read "*********" (the API sends 0); the slip offers no
 *    money tab, invoice, print, Thêm dịch vụ phát sinh or action on the other
 *    lines, and a masked own line no pencil or Chuyển đổi (BA bug 40);
 *  - the seven money tiles on Hồ sơ add up the same slips, with their payments;
 *    Tạm ứng belongs to no slip and reads 0 once narrowed;
 *  - /patient's Số tiền / Thực thu / Công nợ read "*********" without it, on
 *    screen and in the Excel file; with it they add up the same slips and
 *    lines as the record's Hồ sơ tab — a member's, a head's team's, everyone's
 *    for an admin or a non-dentist (BA bug 41);
 *  - Phân quyền lists Thanh toán and the new Chi phí under "Tài chính / Kế
 *    toán", the last group.
 *
 * And the line's pencil on the slip's "Chi tiết điều trị" opens the "Thêm dịch
 * vụ" dialog again on that line ("Chỉnh sửa dịch vụ"), saving quantity and
 * discount onto it.
 *
 * Real stack only: the patient, run staff, roles, teams, slips and money are
 * made through the real API; every account signs in through the login screen;
 * nothing is intercepted.
 */

const PLANS = "/api/v1/app/patient-treatments";
const PAYMENTS = "/api/v1/app/patient-payments";
const PATIENTS = "/api/v1/app/patients";
const ORG = "/api/v1/app/org-chart";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT_ID = "0f9a0000-0000-4000-8000-000000000001";
const DOCTOR_TEAM = 3;
const PERCENTAGE = 2;
const KIND = { Payment: 1, Prepaid: 3 } as const;
const CASH = 1;
const PAID = 100_000;
/** Less than any run slip asks (at least 100 000), so bug 41's finished slip stays owed on. */
const PART_PAID = 30_000;
const TOPPED_UP = 50_000;
const MASK = "*********";
const LEAVES = [
  "BlueDental.patient.read",
  "BlueDental.treatmentConsultation.read",
  "BlueDental.treatmentConsultation.update",
  "BlueDental.payment.read",
];
const COST_LEAF = "BlueDental.treatmentCost.read";
/** What makes the invoice, the row bins and a line's Xoá show — the member's and the chief's. */
const ACTION_LEAVES = [
  "BlueDental.payment.create",
  "BlueDental.treatmentConsultation.delete",
  "BlueDental.treatmentConsultation.deletePlan",
];

type Owner = "head" | "member" | "outsider" | "chief";
type Who = Owner | "clerk" | "accountant" | "deputy";

/**
 * Bug 40's slips, two lines each, on a patient of their own: X received by the
 * chief, Y and Z by the outsider (team B).
 */
type Far = "x" | "y" | "z";
type LineNo = 0 | 1;
/** Paid per line: on X's first line, which no one of team A is assigned, and on Y's second, the head's. */
const FAR_PAID: Record<Far, [number, number]> = { x: [30_000, 0], y: [0, 100_000], z: [0, 0] };

/**
 * head heads team A (member, clerk, deputy) and holds Chi phí; chief heads team
 * B (outsider) without it; clerk and accountant are no dentists, the accountant
 * holding Chi phí; deputy is a dentist of team A holding Chi phí.
 */
const LOGIN: Record<Who, string> = { head: "h", member: "m", outsider: "o", chief: "k", clerk: "c", accountant: "a", deputy: "d" };

/** Bug 41's patient: a finished, part-paid slip of team B's and one of team A's deputy. */
type Aside = "outsider" | "deputy";

interface Summary {
  totalPrice: number;
  totalPaid: number;
  totalRefund: number;
  totalDue: number;
  prepaid: number;
}

interface ListRow {
  id: string;
  patientCode: string;
  totalAmount: number;
  totalRevenue: number;
  totalDebt: number;
  moneyHidden: boolean;
}

interface ScopedSlip {
  id: string;
  seenThroughLines: boolean;
  moneyHidden: boolean;
  payment: { totalPrice: number; totalPaid: number };
  services: { id: string; moneyHidden: boolean; assignedToViewer: boolean; effectiveAmount: number; paidAmount: number }[];
}

async function signIn(browser: Browser, who: Who, run: string) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await login(page, { userName: `tk-e2e-${run}${LOGIN[who]}`, password: RUN_STAFF_PASSWORD });
  return { context, page };
}

/** The DT codes the "Kế hoạch điều trị" tab lists, after it has loaded from the real API. */
async function listedCodes(page: Page, patientId: string): Promise<string[]> {
  const loaded = page.waitForResponse(
    (res) => res.url().includes(PLANS) && res.url().includes("treatingScope=true") && res.request().method() === "GET",
  );
  await page.goto(`/patient/${patientId}?tab=treatment-plan&branch=BD-001`);
  expect((await loaded).ok()).toBeTruthy();
  await expect(page.locator(".tp-table")).toBeVisible();
  return page.locator(".tp-table tr.ant-table-row .tp-code").allInnerTexts();
}

async function summaryOf(page: Page, patientId: string): Promise<Summary> {
  const account = await call<{ payment: Summary }>(page, `${PAYMENTS}/account?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}`, { branchId: BRANCH_ONE });
  expect(account.status).toBe(200);
  return account.body.payment;
}

async function listRowOf(page: Page, patientCode: string): Promise<ListRow> {
  const list = await call<{ items: ListRow[] }>(page, `${PATIENTS}?filter=${patientCode}&maxResultCount=10`, { branchId: BRANCH_ONE });
  expect(list.status).toBe(200);
  const row = list.body.items.find((item) => item.patientCode === patientCode);
  expect(row, "the run's patient on /patient").toBeTruthy();
  return row!;
}

/** "1.234.567 đ", as the tiles print it. */
const tile = (value: number) => `${value.toLocaleString("vi")} đ`;

const LIST_MONEY = ["Số tiền", "Thực thu", "Công nợ"];

/** /patient's three money cells on the row of `patientCode`. */
const moneyCells = (page: Page, patientCode: string) =>
  page.locator("tr.ant-table-row", { hasText: patientCode }).locator(".bd-patient-money");

/** /patient's Excel file for `filter`: Số tiền, Thực thu and Công nợ on the line of a patient code. */
async function listFileOf(page: Page, filter: string) {
  const file = await page.evaluate(async ({ url, branch }) => {
    const res = await fetch(url, { credentials: "include", headers: { "X-Clinic-Branch-Id": branch, "accept-language": "vi" } });
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return { status: res.status, base64: btoa(binary) };
  }, { url: `${PATIENTS}/excel?filter=${filter}`, branch: BRANCH_ONE });
  expect(file.status).toBe(200);
  const book = XLSX.read(file.base64, { type: "base64" });
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
  const header = rows.find((r) => r.includes("Số tiền"))!;
  return (patientCode: string) => {
    const line = rows.find((r) => r.some((cell) => String(cell).includes(patientCode)))!;
    return LIST_MONEY.map((name) => line[header.indexOf(name)]);
  };
}

test.describe.serial("Kế hoạch điều trị và Chi phí — phiếu theo Bác sĩ tiếp nhận, quyền Chi phí và Sơ đồ tổ chức", () => {
  test.setTimeout(240_000);
  const run = `ts${runId()}`;
  let admin: Page;
  const staff = {} as Record<Who, RunStaff>;
  const slips = {} as Record<Owner, Slip>;
  const roles: { id: string; name: string }[] = [];
  const teams: string[] = [];
  const receipts: string[] = [];
  let patientId = "";
  let patientCode = "";
  /** What one slip asks — every run slip is the same one-line service. */
  let perSlip = 0;
  const far = {} as Record<Far, Slip>;
  /** Each far slip's line ids: the one it opened with, then the added one. */
  const farLines = {} as Record<Far, [string, string]>;
  let farPatientId = "";
  let farPatientCode = "";
  /** What one far line asks — every line is the same service again. */
  let perLine = 0;
  const aside = {} as Record<Aside, Slip>;
  let asidePatientId = "";
  let asidePatientCode = "";

  async function createPatient(firstName: string, phoneNumber: string) {
    const patient = await call<{ id: string; patientCode: string }>(admin, PATIENTS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { firstName, lastName: "E2E", dateOfBirth: null, gender: "male", phoneNumber },
    });
    expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
    return patient.body;
  }

  /** A second line on tooth 26, through the inline new row's endpoint, assigned as given. */
  async function addLine(key: Far, assignees: Record<string, string>) {
    const first = far[key].services[0];
    const added = await call<Slip>(admin, `${PLANS}/${far[key].id}/services`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        serviceId: first.serviceId,
        price: first.price,
        quantity: 1,
        discountType: 0,
        discountValue: 0,
        teeth: [{ toothCode: 26, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
        ...assignees,
      },
    });
    expect(added.status, JSON.stringify(added.body.error)).toBe(200);
    expect(added.body.services).toHaveLength(2);
    far[key] = added.body;
    farLines[key] = [first.id, added.body.services.find((line) => line.id !== first.id)!.id];
  }

  async function createRole(name: string, leaves: string[]) {
    const role = await call<{ id: string }>(admin, "/api/identity/roles", {
      method: "POST",
      json: { name, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    roles.push({ id: role.body.id, name });
    const grant = await call(admin, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(name)}`, {
      method: "PUT",
      json: { permissions: leaves.map((leaf) => ({ name: leaf, isGranted: true })) },
    });
    expect(grant.status).toBe(204);
    return name;
  }

  async function createTeam(name: string, headStaffId: string, memberStaffIds: string[]) {
    const team = await call<{ id: string }>(admin, `${ORG}/units`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { kind: DOCTOR_TEAM, name, parentId: ROOT_ID, headStaffId, memberStaffIds },
    });
    expect(team.status, JSON.stringify(team.body.error)).toBe(200);
    teams.push(team.body.id);
  }

  async function record(json: Record<string, unknown>) {
    const receipt = await call<{ id: string }>(admin, PAYMENTS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { patientId, clinicBranchId: BRANCH_ONE, method: CASH, staffId: staff.head.id, ...json },
    });
    expect(receipt.status, JSON.stringify(receipt.body.error)).toBe(200);
    receipts.push(receipt.body.id);
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    admin = await (await browser.newContext()).newPage();
    await login(admin);

    const base = await createRole(`E2E phieu BS ${run}`, LEAVES);
    const costs = await createRole(`E2E chi phi ${run}`, [COST_LEAF]);
    const acts = await createRole(`E2E thao tac ${run}`, ACTION_LEAVES);
    const make = (who: Who, name: string, isDentist: boolean, roleNames: string[]) =>
      createRunStaff(admin, BRANCH_ONE, `${run}${LOGIN[who]}`, { name, isDentist, roleNames });
    staff.head = await make("head", `BS Truong ${run}`, true, [base, costs]);
    staff.member = await make("member", `BS Thanh vien ${run}`, true, [base, acts]);
    staff.outsider = await make("outsider", `BS Ngoai ${run}`, true, [base]);
    staff.chief = await make("chief", `BS Truong B ${run}`, true, [base, acts]);
    staff.clerk = await make("clerk", `NV Le tan ${run}`, false, [base]);
    staff.accountant = await make("accountant", `NV Ke toan ${run}`, false, [base, costs]);
    staff.deputy = await make("deputy", `BS Pho ${run}`, true, [base, costs]);
    await createTeam(`E2E Team DT ${run}`, staff.head.id, [staff.member.id, staff.clerk.id, staff.deputy.id]);
    await createTeam(`E2E Team DT B ${run}`, staff.chief.id, [staff.outsider.id]);

    // A patient of the run's own, so the money adds up to the run's slips only.
    const patient = await createPatient(`Chi phi ${run}`, `03${run.slice(-6)}47`);
    patientId = patient.id;
    patientCode = patient.patientCode;

    for (const owner of ["head", "member", "outsider", "chief"] as const) {
      slips[owner] = await openSlipFor(admin, BRANCH_ONE, patientId, staff[owner].id);
    }
    // Money on the head's slip, and a top-up that belongs to no slip.
    await record({ treatmentPlanId: slips.head.id, treatmentServiceIds: [slips.head.services[0].id], kind: KIND.Payment, amount: PAID });
    await record({ kind: KIND.Prepaid, amount: TOPPED_UP });

    const whole = await summaryOf(admin, patientId);
    expect(whole.totalPrice % 4).toBe(0);
    perSlip = whole.totalPrice / 4;
    expect(perSlip).toBeGreaterThan(0);

    // BA bug 40, on a second patient: team B's slips with lines assigned into team A.
    ({ id: farPatientId, patientCode: farPatientCode } = await createPatient(`Phieu cheo ${run}`, `03${run.slice(-6)}48`));
    far.x = await openSlipFor(admin, BRANCH_ONE, farPatientId, staff.chief.id);
    far.y = await openSlipFor(admin, BRANCH_ONE, farPatientId, staff.outsider.id);
    far.z = await openSlipFor(admin, BRANCH_ONE, farPatientId, staff.outsider.id, { consultantStaffId: staff.member.id });
    // X: the member treats the second line.
    await addLine("x", { dentistId: staff.member.id });
    // Y: the head consults the second line; the member only diagnoses it, which does not count.
    await addLine("y", { consultantStaffId: staff.head.id, diagnoserStaffId: staff.member.id });
    // Z: the first line names no consultant and takes the slip's, the member; the second names the outsider.
    await addLine("z", { consultantStaffId: staff.outsider.id });
    for (const key of ["x", "y", "z"] as const) {
      for (const no of [0, 1] as const) {
        const amount = FAR_PAID[key][no];
        if (!amount) continue;
        await record({ patientId: farPatientId, treatmentPlanId: far[key].id, treatmentServiceIds: [farLines[key][no]], kind: KIND.Payment, amount });
      }
    }

    const farWhole = await summaryOf(admin, farPatientId);
    expect(farWhole.totalPrice % 6).toBe(0);
    perLine = farWhole.totalPrice / 6;
    expect(perLine).toBe(perSlip);

    // BA bug 41, on a third patient: team B's slip finished and part paid, so it is owed on; the deputy's untouched.
    ({ id: asidePatientId, patientCode: asidePatientCode } = await createPatient(`Chia doi ${run}`, `03${run.slice(-6)}49`));
    aside.outsider = await openSlipFor(admin, BRANCH_ONE, asidePatientId, staff.outsider.id);
    aside.deputy = await openSlipFor(admin, BRANCH_ONE, asidePatientId, staff.deputy.id);
    const owed = aside.outsider.services[0].id;
    await record({ patientId: asidePatientId, treatmentPlanId: aside.outsider.id, treatmentServiceIds: [owed], kind: KIND.Payment, amount: PART_PAID });
    const done = await call(admin, `${PLANS}/${aside.outsider.id}/services/${owed}/complete`, { method: "POST", branchId: BRANCH_ONE });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
  });

  test.afterAll(async () => {
    for (const id of receipts) await call(admin, `${PAYMENTS}/${id}/cancel`, { method: "POST", branchId: BRANCH_ONE, json: { reason: "e2e cleanup" } });
    for (const slip of [...Object.values(slips), ...Object.values(far), ...Object.values(aside)]) {
      await call(admin, `${PLANS}/${slip.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    }
    for (const id of teams) await call(admin, `${ORG}/units/${id}`, { method: "DELETE", branchId: BRANCH_ONE });
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    for (const role of roles) await call(admin, `/api/identity/roles/${role.id}`, { method: "DELETE" });
    await admin.context().close();
  });

  const cases: { who: Who; sees: Owner[]; prepaid: boolean }[] = [
    { who: "member", sees: ["member"], prepaid: false },
    { who: "head", sees: ["head", "member"], prepaid: false },
    // Heading team B is not enough without Chi phí: the outsider's slip stays hidden.
    { who: "chief", sees: ["chief"], prepaid: false },
    { who: "outsider", sees: ["outsider"], prepaid: false },
    { who: "clerk", sees: [], prepaid: false },
    { who: "accountant", sees: ["head", "member", "outsider", "chief"], prepaid: true },
  ];

  for (const { who, sees, prepaid } of cases) {
    test(`${who} sees ${sees.length ? sees.join(" + ") : "no"} slip(s) on the tab and in the money tiles`, async ({ browser }) => {
      const { context, page } = await signIn(browser, who, run);
      try {
        const ours = Object.values(slips).map((slip) => slip.code);
        const codes = (await listedCodes(page, patientId)).filter((code) => ours.includes(code));
        expect([...codes].sort()).toEqual(sees.map((key) => slips[key].code).sort());
        // A head's own slips lead — the member's slip is newer, yet comes second.
        if (who === "head") expect(codes).toEqual([slips.head.code, slips.member.code]);
        // Nothing of anyone else's: every listed slip is in scope.
        const listed = await call<{ items: Slip[] }>(page, `${PLANS}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&treatingScope=true&maxResultCount=100`, { branchId: BRANCH_ONE });
        expect(listed.status).toBe(200);
        expect(listed.body.items.map((slip) => slip.id).sort()).toEqual(sees.map((key) => slips[key].id).sort());

        // Without the flag (payment, labo, Hồ sơ) the list is not narrowed.
        const whole = await call<{ items: Slip[] }>(page, `${PLANS}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&maxResultCount=100`, { branchId: BRANCH_ONE });
        expect(whole.body.items.map((slip) => slip.id).sort()).toEqual(Object.values(slips).map((slip) => slip.id).sort());

        // The money adds up the same slips: the head's receipt only where the head's slip shows.
        const expected: Pick<Summary, "totalPrice" | "totalPaid" | "prepaid"> = {
          totalPrice: perSlip * sees.length,
          totalPaid: sees.includes("head") ? PAID : 0,
          prepaid: prepaid ? TOPPED_UP : 0,
        };
        const summary = await summaryOf(page, patientId);
        expect({ totalPrice: summary.totalPrice, totalPaid: summary.totalPaid, prepaid: summary.prepaid }).toEqual(expected);

        await page.goto(`/patient/${patientId}?tab=profile&branch=BD-001`);
        const money = (label: string) =>
          page.locator(".pd-money", { has: page.locator("small", { hasText: new RegExp(`^${label}$`) }) }).locator("strong");
        await expect(page.locator(".pd-money")).toHaveCount(7);
        await expect(money("Tổng dự kiến thu")).toHaveText(tile(expected.totalPrice));
        await expect(money("Đã thu")).toHaveText(tile(expected.totalPaid));
        await expect(money("Tạm ứng")).toHaveText(tile(expected.prepaid));

        // Survives a reload.
        const again = await listedCodes(page, patientId);
        expect(again.filter((code) => ours.includes(code))).toEqual(codes);
      } finally {
        await context.close();
      }
    });
  }

  /**
   * Bug 40, per account: `whole` slips are received inside the account's part
   * of the Sơ đồ tổ chức and show all their money; `through` lists, per slip
   * received outside it, the lines assigned inside it — the slip shows, with
   * those lines' money only, or with none at all when `masked` (no Chi phí).
   */
  const farCases: { who: Who; whole: Far[]; through: Partial<Record<Far, LineNo[]>>; masked: boolean }[] = [
    // No Chi phí: their own lines — X's they treat, Z's they consult through the slip; not Y's they diagnose — every figure masked.
    { who: "member", whole: [], through: { x: [1], z: [0] }, masked: true },
    // With Chi phí the head counts the member's lines too, and their own consulting one on Y, with their money.
    { who: "head", whole: [], through: { x: [1], y: [1], z: [0] }, masked: false },
    { who: "chief", whole: ["x"], through: {}, masked: false },
    { who: "outsider", whole: ["y", "z"], through: {}, masked: false },
    { who: "clerk", whole: [], through: {}, masked: false },
    { who: "accountant", whole: ["x", "y", "z"], through: {}, masked: false },
  ];

  for (const { who, whole, through, masked } of farCases) {
    const lineOnly = Object.keys(through) as Far[];
    // The lines whose money the account sees.
    const seen: [Far, LineNo][] = [
      ...whole.flatMap((key) => [[key, 0], [key, 1]] as [Far, LineNo][]),
      ...(masked ? [] : lineOnly.flatMap((key) => through[key]!.map((no) => [key, no] as [Far, LineNo]))),
    ];
    const label = [...whole.map((key) => `${key} whole`), ...lineOnly.map((key) => `${key} through its lines`)];

    test(`bug 40: ${who} sees ${label.length ? label.join(", ") : "no slip"}`, async ({ browser }) => {
      const { context, page } = await signIn(browser, who, run);
      try {
        const listed = await call<{ items: ScopedSlip[] }>(page, `${PLANS}?patientId=${farPatientId}&clinicBranchId=${BRANCH_ONE}&treatingScope=true&maxResultCount=100`, { branchId: BRANCH_ONE });
        expect(listed.status).toBe(200);
        const byId = new Map(listed.body.items.map((slip) => [slip.id, slip]));
        expect([...byId.keys()].sort()).toEqual([...whole, ...lineOnly].map((key) => far[key].id).sort());

        const truth = (key: Far, no: LineNo) => far[key].services.find((line) => line.id === farLines[key][no])!;
        const lineOf = (slip: ScopedSlip, key: Far, no: LineNo) => slip.services.find((l) => l.id === farLines[key][no])!;
        const figures = (slip: ScopedSlip, key: Far) =>
          ([0, 1] as const).map((no) => {
            const line = lineOf(slip, key, no);
            return [line.moneyHidden, line.effectiveAmount, line.paidAmount];
          });
        const assigned = (slip: ScopedSlip, key: Far) => ([0, 1] as const).filter((no) => lineOf(slip, key, no).assignedToViewer);
        for (const key of whole) {
          const slip = byId.get(far[key].id)!;
          expect([slip.seenThroughLines, slip.moneyHidden]).toEqual([false, false]);
          expect(figures(slip, key)).toEqual(([0, 1] as const).map((no) => [false, truth(key, no).effectiveAmount, FAR_PAID[key][no]]));
          expect(slip.payment).toMatchObject({ totalPrice: perLine * 2, totalPaid: FAR_PAID[key][0] + FAR_PAID[key][1] });
          // A slip seen whole marks no line: every one is the viewer's to act on.
          expect(assigned(slip, key)).toEqual([]);
        }
        for (const key of lineOnly) {
          const own = through[key]!;
          const shown = masked ? [] : own;
          const slip = byId.get(far[key].id)!;
          expect([slip.seenThroughLines, slip.moneyHidden]).toEqual([true, masked]);
          expect(assigned(slip, key)).toEqual(own);
          // A masked line's figures never leave the API: 0 and the flag.
          expect(figures(slip, key)).toEqual(
            ([0, 1] as const).map((no) => (shown.includes(no) ? [false, truth(key, no).effectiveAmount, FAR_PAID[key][no]] : [true, 0, 0])),
          );
          expect(slip.payment).toMatchObject({
            totalPrice: perLine * shown.length,
            totalPaid: shown.reduce<number>((sum, no) => sum + FAR_PAID[key][no], 0),
          });
        }

        // The patient's money adds up the same lines, on the API and the Hồ sơ tiles.
        const expected = { totalPrice: perLine * seen.length, totalPaid: seen.reduce<number>((sum, [key, no]) => sum + FAR_PAID[key][no], 0) };
        const summary = await summaryOf(page, farPatientId);
        expect({ totalPrice: summary.totalPrice, totalPaid: summary.totalPaid }).toEqual(expected);
        await page.goto(`/patient/${farPatientId}?tab=profile&branch=BD-001`);
        const money = (name: string) =>
          page.locator(".pd-money", { has: page.locator("small", { hasText: new RegExp(`^${name}$`) }) }).locator("strong");
        await expect(money("Tổng dự kiến thu")).toHaveText(tile(expected.totalPrice));
        await expect(money("Đã thu")).toHaveText(tile(expected.totalPaid));

        // The tab lists the same slips, and still does after a reload.
        const codes = (await listedCodes(page, farPatientId)).sort();
        expect(codes).toEqual([...whole, ...lineOnly].map((key) => far[key].code).sort());
        await page.reload();
        await expect(page.locator(".tp-table tr.ant-table-row .tp-code")).toHaveCount(codes.length);
      } finally {
        await context.close();
      }
    });
  }

  test("bug 40: on a slip seen through a line the masked money and the slip's actions are gone", async ({ browser }) => {
    // The member and the chief hold the same rights, the head Chi phí and no action leaf; only the chief received X.
    const slip = far.x;
    const views = [
      // No Chi phí: every figure masked, their own line's too, which keeps its status menu and Xoá but no pencil or Chuyển đổi.
      { who: "member", through: true, masked: true },
      // With Chi phí the member's line, theirs to look after, shows its money and its pencil.
      { who: "head", through: true, masked: false },
      { who: "chief", through: false, masked: false },
    ] as const;
    // Đơn giá, Giảm giá and Thành tiền on the slip page; Tổng tiền, Giảm giá and Thanh toán in the detail dialog.
    const LINE_MONEY = 3;
    // Every one of the twelve default columns shows, seven of them money.
    const SLIP_MONEY = 7;
    for (const { who, through, masked } of views) {
      // Whose money is masked: the other line on a slip seen through lines, the own one too without Chi phí.
      const hidden = { others: through, own: masked };
      const deletes = who !== "head";
      const { context, page } = await signIn(browser, who, run);
      try {
        // Waits on the tab's real list request.
        await listedCodes(page, farPatientId);
        const row = page.locator(".tp-table tr.ant-table-row", { hasText: slip.code });
        await expect(row).toHaveCount(1);
        await expect(row.locator(".tp-money-hidden")).toHaveCount(masked ? SLIP_MONEY : 0);
        if (masked) await expect(row.locator(".tp-money-hidden").first()).toHaveText(MASK);
        await expect(row.getByRole("button", { name: `Phiếu thu ${slip.code}` })).toHaveCount(through ? 0 : 1);
        await expect(row.getByRole("button", { name: `Xoá phiếu điều trị ${slip.code}` })).toHaveCount(through ? 0 : 1);

        // The row's eye lists both lines, two money cells each.
        await row.getByRole("button", { name: `Danh sách dịch vụ - ${slip.code}` }).click();
        const list = page.locator(".tp-services-table");
        await expect(list.locator("tr.ant-table-row")).toHaveCount(2);
        await expect(list.locator(".tp-money-hidden")).toHaveCount(2 * (Number(hidden.others) + Number(hidden.own)));
        if (through) await expect(list.locator(".tp-money-hidden").first()).toHaveText(MASK);
        await page.keyboard.press("Escape");
        await expect(list).toHaveCount(0);

        // Asked for Thanh toán: a slip seen through lines has Chi tiết điều trị only, and no money summary.
        const answered = page.waitForResponse((res) => res.url().includes(`${PLANS}/${slip.id}/treating`));
        await page.goto(`/patient/${farPatientId}/treatment-plan/${slip.id}?branch=BD-001&planTab=payment-v2`);
        expect((await answered).status()).toBe(200);
        const tabs = page.locator(".pdt-tabrow").getByRole("tab");
        if (through) {
          await expect(tabs).toHaveText(["Chi tiết điều trị"]);
          await expect(page.locator(".pdt-stats")).toHaveCount(0);
        } else {
          await expect(tabs).toHaveCount(4);
          await expect(page.locator(".pdt-stats")).toBeVisible();
          await tabs.filter({ hasText: "Chi tiết điều trị" }).click();
        }

        const rows = page.locator(".pdt-table tbody tr.ant-table-row");
        await expect(rows).toHaveCount(2);
        const toolbar = page.locator(".pdt-toolbar");
        await expect(toolbar.getByRole("button", { name: "Thêm dịch vụ phát sinh" })).toHaveCount(through ? 0 : 1);
        await expect(toolbar.getByRole("button", { name: "In Hóa Đơn" })).toHaveCount(through ? 0 : 1);
        await expect(toolbar.getByRole("button", { name: "In phiếu điều trị" })).toHaveCount(through ? 0 : 1);

        const lineOn = (tooth: string) => rows.filter({ has: page.getByRole("cell", { name: tooth, exact: true }) });
        const lines = { others: lineOn("16"), own: lineOn("26") };
        const { others, own } = lines;
        for (const key of ["others", "own"] as const) {
          await expect(lines[key].locator(".tp-money-hidden")).toHaveCount(hidden[key] ? LINE_MONEY : 0);
          if (hidden[key]) await expect(lines[key].locator(".tp-money-hidden").first()).toHaveText(MASK);
        }
        await expect(others.getByRole("button", { name: /^Đổi trạng thái/ })).toHaveCount(through ? 0 : 1);
        await expect(others.getByRole("button", { name: "Xoá" })).toHaveCount(through ? 0 : 1);
        // Paid on for real, so no pencil for anyone — though the member is sent 0.
        await expect(others.getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);
        await expect(own.getByRole("button", { name: /^Đổi trạng thái/ })).toHaveCount(1);
        await expect(own.getByRole("button", { name: "Xoá" })).toHaveCount(deletes ? 1 : 0);
        // A masked line's 0 would be saved as its price, and Chuyển đổi is all about what was paid on it.
        await expect(own.getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(masked ? 0 : 1);
        await own.getByRole("button", { name: /^Đổi trạng thái/ }).click();
        const menu = page.locator(".ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item");
        await expect(menu).toHaveText(masked ? ["Hoàn thành", "Hủy dịch vụ"] : ["Hoàn thành", "Chuyển đổi", "Hủy dịch vụ"]);
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);

        const detail = page.getByRole("dialog", { name: "Chi tiết dịch vụ" });
        for (const key of ["others", "own"] as const) {
          await lines[key].getByRole("button", { name: "Xem chi tiết" }).click();
          await expect(detail).toBeVisible();
          await expect(detail.locator(".tp-money-hidden")).toHaveCount(hidden[key] ? LINE_MONEY : 0);
          if (key === "others" && !through) await expect(detail).toContainText(FAR_PAID.x[0].toLocaleString("vi"));
          // The footer's — the corner X carries the same name.
          await detail.locator(".pdt-confirm-foot").getByRole("button", { name: "Đóng" }).click();
          await expect(detail).toBeHidden();
        }

        // Survives a reload.
        await page.reload();
        await expect(rows).toHaveCount(2);
        for (const key of ["others", "own"] as const) {
          await expect(lines[key].locator(".tp-money-hidden")).toHaveCount(hidden[key] ? LINE_MONEY : 0);
        }
      } finally {
        await context.close();
      }
    }
  });

  test("an admin sees every slip and all the money", async () => {
    const codes = await listedCodes(admin, patientId);
    expect([...codes].sort()).toEqual(Object.values(slips).map((slip) => slip.code).sort());
    expect(await summaryOf(admin, patientId)).toMatchObject({ totalPrice: perSlip * 4, totalPaid: PAID, prepaid: TOPPED_UP });
  });

  test("a slip hidden from the tab cannot be opened by its link either", async ({ browser }) => {
    const denied: { who: Who; slip: Slip }[] = [
      { who: "outsider", slip: slips.member },
      { who: "clerk", slip: slips.member },
      // A head without Chi phí does not open their own team member's slip.
      { who: "chief", slip: slips.outsider },
      // Bug 40: diagnosing a line is no assignment, nor is heading the one who treats it.
      { who: "member", slip: far.y },
      { who: "clerk", slip: far.x },
    ];

    for (const { who, slip } of denied) {
      const detailUrl = `/patient/${slip.patientId}/treatment-plan/${slip.id}?branch=BD-001`;
      const { context, page } = await signIn(browser, who, run);
      try {
        for (const planTab of ["detail", "payment-v2", "debt"]) {
          const answered = page.waitForResponse((res) => res.url().includes(`${PLANS}/${slip.id}/treating`));
          await page.goto(`${detailUrl}&planTab=${planTab}`);
          expect((await answered).status()).toBe(403);
          await expect(page.getByText("Bạn không có quyền xem phiếu điều trị này", { exact: false }).first()).toBeVisible();
          await expect(page.getByRole("tab", { name: "Chi tiết điều trị" })).toHaveCount(0);
          await expect(page.locator(".pdt-table")).toHaveCount(0);
        }
        const refused = await call(page, `${PLANS}/${slip.id}/treating`, { branchId: BRANCH_ONE });
        expect(refused.status).toBe(403);
        expect(refused.body.error?.code).toBe("BlueDental:Treatment:0052");
      } finally {
        await context.close();
      }
    }

    // The head with Chi phí looks after the member, the accountant after everyone.
    for (const who of ["head", "accountant"] as const) {
      const { context, page } = await signIn(browser, who, run);
      try {
        await page.goto(`/patient/${patientId}/treatment-plan/${slips.member.id}?branch=BD-001&planTab=detail`);
        await expect(page.getByRole("tab", { name: "Chi tiết điều trị" })).toBeVisible();
        await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(1);
      } finally {
        await context.close();
      }
    }
  });

  test("/patient masks Số tiền, Thực thu and Công nợ without Chi phí, on screen and in the file", async ({ browser }) => {
    const truth = await listRowOf(admin, patientCode);
    expect(truth.moneyHidden).toBe(false);
    expect(truth.totalAmount).toBeGreaterThan(0);

    for (const who of ["member", "accountant"] as const) {
      const hidden = who === "member";
      const { context, page } = await signIn(browser, who, run);
      try {
        // The figures never leave the API for the member: 0 and the flag.
        const row = await listRowOf(page, patientCode);
        expect(row.moneyHidden).toBe(hidden);
        expect([row.totalAmount, row.totalRevenue, row.totalDebt]).toEqual(
          hidden ? [0, 0, 0] : [truth.totalAmount, truth.totalRevenue, truth.totalDebt],
        );

        await page.goto("/patient?branch=BD-001");
        await assertRealApiTraffic(page, PATIENTS);
        const cells = moneyCells(page, patientCode);
        await expect(cells).toHaveCount(3);
        await expect(cells).toHaveText(
          hidden ? [MASK, MASK, MASK] : [truth.totalAmount, truth.totalRevenue, truth.totalDebt].map((v) => v.toLocaleString("vi")),
        );

        // The Excel file reads the same.
        const file = await listFileOf(page, patientCode);
        expect(file(patientCode)).toEqual(hidden ? [MASK, MASK, MASK] : [truth.totalAmount, truth.totalRevenue, truth.totalDebt]);
      } finally {
        await context.close();
      }
    }
  });

  /**
   * Bug 41, per account: a /patient row adds up the money the record's Hồ sơ
   * tab shows that account. Per patient, how many slips' (or lines') price it
   * counts, what was paid on them, and whether anything is owed — only on team
   * B's finished slip of the third patient.
   */
  test("bug 41: /patient counts only the money the account sees, as Hồ sơ does — on the API, on screen and in the file", async ({ browser }) => {
    type Patient = "main" | "far" | "aside";
    const patients: Record<Patient, { id: string; code: string }> = {
      main: { id: patientId, code: patientCode },
      far: { id: farPatientId, code: farPatientCode },
      aside: { id: asidePatientId, code: asidePatientCode },
    };
    const farPaid = Object.values(FAR_PAID).flat().reduce((sum, paid) => sum + paid, 0);
    const everything: Record<Patient, [number, number, boolean]> = {
      main: [4, PAID, false],
      far: [6, farPaid, false],
      aside: [2, PART_PAID, true],
    };
    const views: { who: Who | "admin"; sees: Record<Patient, [number, number, boolean]> }[] = [
      { who: "admin", sees: everything },
      { who: "accountant", sees: everything },
      // Team A's: their slip and the member's, the far lines of theirs and the member's, the deputy's slip — never team B's.
      { who: "head", sees: { main: [2, PAID, false], far: [3, FAR_PAID.y[1], false], aside: [1, 0, false] } },
      // A member with Chi phí: the slip they received, nothing of their head's or a teammate's.
      { who: "deputy", sees: { main: [0, 0, false], far: [0, 0, false], aside: [1, 0, false] } },
    ];

    for (const { who, sees } of views) {
      const session = who === "admin" ? null : await signIn(browser, who, run);
      const page = session?.page ?? admin;
      try {
        const shown = {} as Record<Patient, number[]>;
        for (const key of Object.keys(patients) as Patient[]) {
          const [count, paid, owes] = sees[key];
          const row = await listRowOf(page, patients[key].code);
          expect(row.moneyHidden).toBe(false);
          expect([row.totalAmount, row.totalRevenue], `${who} on ${key}`).toEqual([perSlip * count, paid]);
          expect(row.totalDebt > 0, `${who} owed on ${key}`).toBe(owes);
          // The Hồ sơ cards: Tổng dự kiến thu, Đã thu less Đã hoàn, Phải thu.
          const cards = await summaryOf(page, patients[key].id);
          expect([row.totalAmount, row.totalRevenue, row.totalDebt]).toEqual([
            cards.totalPrice,
            cards.totalPaid - cards.totalRefund,
            Math.max(0, cards.totalDue),
          ]);
          shown[key] = [row.totalAmount, row.totalRevenue, row.totalDebt];
        }

        // On screen, the run's three patients found by the search box — which a reload empties.
        const searchRun = async () => {
          const searched = page.waitForResponse((res) => res.url().includes(`${PATIENTS}?`) && res.url().includes(`filter=${run}`));
          await page.getByPlaceholder(/Tìm/).first().fill(run);
          expect((await searched).ok()).toBeTruthy();
          await expect(page.locator("tr.ant-table-row")).toHaveCount(3);
        };
        await page.goto("/patient?branch=BD-001");
        await searchRun();
        const file = await listFileOf(page, run);
        for (const key of Object.keys(patients) as Patient[]) {
          await expect(moneyCells(page, patients[key].code)).toHaveText(shown[key].map((v) => v.toLocaleString("vi")));
          expect(file(patients[key].code), `${who}'s file on ${key}`).toEqual(shown[key]);
        }

        await page.reload();
        await searchRun();
        await expect(moneyCells(page, patients.aside.code)).toHaveText(shown.aside.map((v) => v.toLocaleString("vi")));
      } finally {
        await session?.context.close();
      }
    }
  });

  test("Phân quyền lists Thanh toán and Chi phí under Tài chính / Kế toán, the last group", async () => {
    interface Node { type: "group" | "leaf"; id: string; label: string; children?: Node[] }
    const leaves = (node: Node): string[] => (node.type === "leaf" ? [node.id] : (node.children ?? []).flatMap(leaves));

    const treeResponse = admin.waitForResponse((res) => res.url().includes("/role-permission/permission-tree"));
    await admin.goto("/settings?tab=permission");
    const { tree } = (await (await treeResponse).json()) as { tree: Node[] };
    const finance = tree[tree.length - 1];
    expect(finance.id).toBe("finance-accounting");
    expect(tree[tree.length - 2].label).toBe("BE:Perm:HelpSupport");
    expect(finance.children?.map((child) => [child.id, leaves(child)])).toEqual([
      ["payment", ["payment.read", "payment.create", "payment.update", "payment.delete", "payment.export", "payment.finalize"]],
      ["treatmentCost", ["treatmentCost.read"]],
    ]);
    // Moved, not copied: Khách hàng keeps no payment leaf.
    const customer = tree.find((node) => node.id === "patient")!;
    expect(leaves(customer).filter((id) => id.startsWith("payment."))).toEqual([]);

    await admin.locator(".perm-role-item").filter({ hasText: `E2E chi phi ${run}` }).click();
    await expect(admin.locator(".perm-group--top > .perm-group-header .perm-group-label").last()).toHaveText("Tài chính / Kế toán");
    // Báo cáo › Quản lý thu chi has a "Chi phí" of its own (the report's); the new one sits under Tài chính / Kế toán.
    const financeGroup = admin.locator(".perm-group--top").filter({ hasText: "Tài chính / Kế toán" });
    await admin.getByPlaceholder("Tìm quyền...").fill("Chi phí");
    const costGroup = financeGroup.locator(".perm-group-header", { has: admin.locator(".perm-group-label", { hasText: /^Chi phí$/ }) });
    await expect(costGroup).toHaveCount(1);
    await expect(costGroup.locator(".perm-group-count")).toHaveText("1/1");

    await admin.getByPlaceholder("Tìm quyền...").fill("");
    await admin.getByRole("button", { name: "Mở tất cả" }).click();
    const leaf = financeGroup.locator('.perm-leaf[data-permission="treatmentCost.read"]');
    await expect(leaf).toHaveCount(1);
    await expect(leaf).toContainText("Xem");
    await expect(leaf.getByRole("checkbox")).toBeChecked();
  });

  test("the pencil reopens Thêm dịch vụ on the line and saves quantity and discount onto it", async ({ browser }) => {
    const { context, page } = await signIn(browser, "member", run);
    try {
      const slip = slips.member;
      const line = slip.services[0];
      await page.goto(`/patient/${patientId}/treatment-plan/${slip.id}?planTab=detail&branch=BD-001`);
      await assertRealApiTraffic(page, `${PLANS}/${slip.id}`);
      const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
      await row.getByRole("button", { name: "Chỉnh sửa" }).click();

      const dialog = page.getByRole("dialog", { name: "Chỉnh sửa dịch vụ" });
      await expect(dialog).toBeVisible();
      // Opened on the line: its advisor (the consulting line's), its service (locked), teeth and quantity.
      await expect(dialog.locator(".tp-advisor-field").first()).toContainText(`BS Thanh vien ${run}`);
      await expect(dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ })).toBeDisabled();
      await expect(dialog.getByLabel("Số lượng")).toHaveValue("1");
      await expect(dialog.locator(".tp-create-teeth")).toContainText("16");

      await dialog.getByLabel("Số lượng").fill("2");
      await dialog.getByRole("button", { name: "%", exact: true }).click();
      await dialog.getByRole("textbox", { name: "Giảm giá" }).fill("10");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(page.getByText("Đã cập nhật dịch vụ")).toBeVisible();
      await expect(dialog).toBeHidden();

      // Persisted: a separate request and a reload both read it back.
      const saved = await call<Slip>(page, `${PLANS}/${slip.id}`, { branchId: BRANCH_ONE });
      const savedLine = saved.body.services.find((s) => s.id === line.id)!;
      expect(savedLine.quantity).toBe(2);
      expect(savedLine.discountType).toBe(PERCENTAGE);
      expect(savedLine.discountValue).toBe(10);
      expect(savedLine.effectiveAmount).toBe(Math.round(line.price * 2 * 0.9));

      await page.reload();
      await row.getByRole("button", { name: "Chỉnh sửa" }).click();
      await expect(dialog.getByLabel("Số lượng")).toHaveValue("2");
      await expect(dialog.getByRole("textbox", { name: "Giảm giá" })).toHaveValue("10");
    } finally {
      await context.close();
    }
  });
});
