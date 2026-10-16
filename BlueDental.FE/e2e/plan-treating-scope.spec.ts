import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, createRunStaff, deleteStaff, RUN_STAFF_PASSWORD, type RunStaff } from "./fixtures/timekeepingStaff";
import { firstPatientOf, openSlipFor, type TreatingSlip as Slip } from "./fixtures/treatingSlip";

/**
 * Owner 2026-10-15: the patient record's "Kế hoạch điều trị" tab lists only the
 * slips whose Bác sĩ điều trị lies in the signed-in user's part of the Sơ đồ tổ
 * chức — an admin every slip, any other non-dentist none, a team head their
 * own and their team's (their own first), any other dentist their own. Other screens reading the
 * same list (payment, labo, Hồ sơ) keep every slip.
 *
 * And the line's pencil on the slip's "Chi tiết điều trị" opens the "Thêm dịch
 * vụ" dialog again on that line ("Chỉnh sửa dịch vụ"), saving quantity and
 * discount onto it.
 *
 * Real stack only: run staff, role, team and slips are made through the real
 * API; every account signs in through the login screen; nothing is intercepted.
 */

const PLANS = "/api/v1/app/patient-treatments";
const ORG = "/api/v1/app/org-chart";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT_ID = "0f9a0000-0000-4000-8000-000000000001";
const DOCTOR_TEAM = 3;
const PERCENTAGE = 2;
const LEAVES = [
  "BlueDental.patient.read",
  "BlueDental.treatmentConsultation.read",
  "BlueDental.treatmentConsultation.update",
];

type Who = "head" | "member" | "outsider" | "clerk";

async function signIn(browser: Browser, userName: string, password: string) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await login(page, { userName, password });
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

test.describe.serial("Kế hoạch điều trị — phiếu theo Bác sĩ điều trị và Sơ đồ tổ chức", () => {
  test.setTimeout(240_000);
  const run = `ts${runId()}`;
  let admin: Page;
  const staff = {} as Record<Who, RunStaff>;
  const slips = {} as Record<"head" | "member" | "outsider", Slip>;
  let roleId = "";
  let roleName = "";
  let teamId = "";
  let patientId = "";

  test.beforeAll(async ({ browser }) => {
    admin = await (await browser.newContext()).newPage();
    await login(admin);

    roleName = `E2E phieu BS ${run}`;
    const role = await call<{ id: string }>(admin, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    roleId = role.body.id;
    const grant = await call(admin, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
      method: "PUT",
      json: { permissions: LEAVES.map((name) => ({ name, isGranted: true })) },
    });
    expect(grant.status).toBe(204);

    const roleNames = [roleName];
    staff.head = await createRunStaff(admin, BRANCH_ONE, `${run}h`, { name: `BS Truong ${run}`, isDentist: true, roleNames });
    staff.member = await createRunStaff(admin, BRANCH_ONE, `${run}m`, { name: `BS Thanh vien ${run}`, isDentist: true, roleNames });
    staff.outsider = await createRunStaff(admin, BRANCH_ONE, `${run}o`, { name: `BS Ngoai ${run}`, isDentist: true, roleNames });
    // A lễ tân with the same rights, even heading nothing, sees no slip.
    staff.clerk = await createRunStaff(admin, BRANCH_ONE, `${run}c`, { name: `NV Le tan ${run}`, roleNames });

    const team = await call<{ id: string }>(admin, `${ORG}/units`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { kind: DOCTOR_TEAM, name: `E2E Team DT ${run}`, parentId: ROOT_ID, headStaffId: staff.head.id, memberStaffIds: [staff.member.id, staff.clerk.id] },
    });
    expect(team.status, JSON.stringify(team.body.error)).toBe(200);
    teamId = team.body.id;

    patientId = await firstPatientOf(admin, BRANCH_ONE);
    slips.head = await openSlipFor(admin, BRANCH_ONE, patientId, staff.head.id);
    slips.member = await openSlipFor(admin, BRANCH_ONE, patientId, staff.member.id);
    slips.outsider = await openSlipFor(admin, BRANCH_ONE, patientId, staff.outsider.id);
  });

  test.afterAll(async () => {
    for (const slip of Object.values(slips)) await call(admin, `${PLANS}/${slip.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    if (teamId) await call(admin, `${ORG}/units/${teamId}`, { method: "DELETE", branchId: BRANCH_ONE });
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    if (roleId) await call(admin, `/api/identity/roles/${roleId}`, { method: "DELETE" });
    await admin.context().close();
  });

  const cases: { who: Who; sees: ("head" | "member" | "outsider")[] }[] = [
    { who: "member", sees: ["member"] },
    { who: "head", sees: ["head", "member"] },
    { who: "outsider", sees: ["outsider"] },
    { who: "clerk", sees: [] },
  ];

  for (const { who, sees } of cases) {
    test(`${who} sees only ${sees.length ? sees.join(" + ") : "no"} slip(s) on the tab, and other screens keep every slip`, async ({ browser }) => {
      const { context, page } = await signIn(browser, `tk-e2e-${run}${who[0]}`, RUN_STAFF_PASSWORD);
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
        expect(whole.body.items.map((slip) => slip.id)).toEqual(expect.arrayContaining(Object.values(slips).map((slip) => slip.id)));

        // Survives a reload.
        await page.reload();
        await expect(page.locator(".tp-table")).toBeVisible();
        const again = (await page.locator(".tp-table tr.ant-table-row .tp-code").allInnerTexts()).filter((code) => ours.includes(code));
        expect(again).toEqual(codes);
      } finally {
        await context.close();
      }
    });
  }

  test("a slip hidden from the tab cannot be opened by its link either", async ({ browser }) => {
    const slip = slips.member;
    const detailUrl = `/patient/${patientId}/treatment-plan/${slip.id}?branch=BD-001`;
    const denied: Who[] = ["outsider", "clerk"];

    for (const who of denied) {
      const { context, page } = await signIn(browser, `tk-e2e-${run}${who[0]}`, RUN_STAFF_PASSWORD);
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

    // The head looks after the member: the page opens, its tabs too.
    const { context, page } = await signIn(browser, `tk-e2e-${run}h`, RUN_STAFF_PASSWORD);
    try {
      await page.goto(`${detailUrl}&planTab=detail`);
      await expect(page.getByRole("tab", { name: "Chi tiết điều trị" })).toBeVisible();
      await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test("an admin sees every slip", async () => {
    const codes = await listedCodes(admin, patientId);
    expect(codes).toEqual(expect.arrayContaining(Object.values(slips).map((slip) => slip.code)));
  });

  test("the pencil reopens Thêm dịch vụ on the line and saves quantity and discount onto it", async ({ browser }) => {
    const { context, page } = await signIn(browser, `tk-e2e-${run}m`, RUN_STAFF_PASSWORD);
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
