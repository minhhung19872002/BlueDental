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
 *  - the seven money tiles on Hồ sơ add up the same slips, with their payments;
 *    Tạm ứng belongs to no slip and reads 0 once narrowed;
 *  - /patient's Số tiền / Thực thu / Công nợ read "*********" without it, on
 *    screen and in the Excel file;
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
const TOPPED_UP = 50_000;
const MASK = "*********";
const LEAVES = [
  "BlueDental.patient.read",
  "BlueDental.treatmentConsultation.read",
  "BlueDental.treatmentConsultation.update",
  "BlueDental.payment.read",
];
const COST_LEAF = "BlueDental.treatmentCost.read";

type Owner = "head" | "member" | "outsider" | "chief";
type Who = Owner | "clerk" | "accountant";

/**
 * head heads team A (member, clerk) and holds Chi phí; chief heads team B
 * (outsider) without it; clerk and accountant are no dentists, the accountant
 * holding Chi phí.
 */
const LOGIN: Record<Who, string> = { head: "h", member: "m", outsider: "o", chief: "k", clerk: "c", accountant: "a" };

interface Summary {
  totalPrice: number;
  totalPaid: number;
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
    const make = (who: Who, name: string, isDentist: boolean, roleNames: string[]) =>
      createRunStaff(admin, BRANCH_ONE, `${run}${LOGIN[who]}`, { name, isDentist, roleNames });
    staff.head = await make("head", `BS Truong ${run}`, true, [base, costs]);
    staff.member = await make("member", `BS Thanh vien ${run}`, true, [base]);
    staff.outsider = await make("outsider", `BS Ngoai ${run}`, true, [base]);
    staff.chief = await make("chief", `BS Truong B ${run}`, true, [base]);
    staff.clerk = await make("clerk", `NV Le tan ${run}`, false, [base]);
    staff.accountant = await make("accountant", `NV Ke toan ${run}`, false, [base, costs]);
    await createTeam(`E2E Team DT ${run}`, staff.head.id, [staff.member.id, staff.clerk.id]);
    await createTeam(`E2E Team DT B ${run}`, staff.chief.id, [staff.outsider.id]);

    // A patient of the run's own, so the money adds up to the run's slips only.
    const patient = await call<{ id: string; patientCode: string }>(admin, PATIENTS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { firstName: `Chi phi ${run}`, lastName: "E2E", dateOfBirth: null, gender: "male", phoneNumber: `03${run.slice(-6)}47` },
    });
    expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
    patientId = patient.body.id;
    patientCode = patient.body.patientCode;

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
  });

  test.afterAll(async () => {
    for (const id of receipts) await call(admin, `${PAYMENTS}/${id}/cancel`, { method: "POST", branchId: BRANCH_ONE, json: { reason: "e2e cleanup" } });
    for (const slip of Object.values(slips)) await call(admin, `${PLANS}/${slip.id}`, { method: "DELETE", branchId: BRANCH_ONE });
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
        const expected: Summary = {
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

  test("an admin sees every slip and all the money", async () => {
    const codes = await listedCodes(admin, patientId);
    expect([...codes].sort()).toEqual(Object.values(slips).map((slip) => slip.code).sort());
    expect(await summaryOf(admin, patientId)).toMatchObject({ totalPrice: perSlip * 4, totalPaid: PAID, prepaid: TOPPED_UP });
  });

  test("a slip hidden from the tab cannot be opened by its link either", async ({ browser }) => {
    const denied: { who: Who; slip: Owner }[] = [
      { who: "outsider", slip: "member" },
      { who: "clerk", slip: "member" },
      // A head without Chi phí does not open their own team member's slip.
      { who: "chief", slip: "outsider" },
    ];

    for (const { who, slip: owner } of denied) {
      const slip = slips[owner];
      const detailUrl = `/patient/${patientId}/treatment-plan/${slip.id}?branch=BD-001`;
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
        const cells = page.locator("tr.ant-table-row", { hasText: patientCode }).locator(".bd-patient-money");
        await expect(cells).toHaveCount(3);
        await expect(cells).toHaveText(
          hidden ? [MASK, MASK, MASK] : [truth.totalAmount, truth.totalRevenue, truth.totalDebt].map((v) => (v ? v.toLocaleString("vi") : "0")),
        );

        // The Excel file reads the same.
        const file = await page.evaluate(async ({ url, branch }) => {
          const res = await fetch(url, { credentials: "include", headers: { "X-Clinic-Branch-Id": branch, "accept-language": "vi" } });
          const bytes = new Uint8Array(await res.arrayBuffer());
          let binary = "";
          bytes.forEach((b) => (binary += String.fromCharCode(b)));
          return { status: res.status, base64: btoa(binary) };
        }, { url: `${PATIENTS}/excel?filter=${patientCode}`, branch: BRANCH_ONE });
        expect(file.status).toBe(200);
        const book = XLSX.read(file.base64, { type: "base64" });
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
        const header = rows.find((r) => r.includes("Số tiền"))!;
        const line = rows.find((r) => r.some((cell) => String(cell).includes(patientCode)))!;
        const at = (name: string) => line[header.indexOf(name)];
        expect([at("Số tiền"), at("Thực thu"), at("Công nợ")]).toEqual(
          hidden ? [MASK, MASK, MASK] : [truth.totalAmount, truth.totalRevenue, truth.totalDebt],
        );
      } finally {
        await context.close();
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
