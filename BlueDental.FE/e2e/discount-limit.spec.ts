import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Cụm 11 mục 12 — Quy định giảm giá (F-54). A staff member's
 * "Giảm tối đa (%)" / "Giảm tối đa (VNĐ)" caps what they may take off a line
 * when they consult. See docs/clone/pages/discount-limit.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own role (consulting leaves only) and staff member; the lines
 * it raises are deleted at the end.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ADVISES = "/api/v1/app/patient-advises";
const PASSWORD = "GiamGia@123456";
const ABOVE_PERCENT = "BlueDental:Treatment:0042";
const ABOVE_AMOUNT = "BlueDental:Treatment:0043";
const DISCOUNT = { None: 0, Money: 1, Percentage: 2 } as const;
const LEAVES = [
  "BlueDental.patient.read",
  "BlueDental.treatmentConsultation.read",
  "BlueDental.treatmentConsultation.create",
  "BlueDental.treatmentConsultation.update",
];
const asBranchOne = { branchId: BRANCH_ONE };

interface Staff {
  id: string;
  maxDiscountPercent: number | null;
  maxDiscountAmount: number | null;
}

interface Fixture {
  roleId: string;
  staffId: string;
  userName: string;
  staffName: string;
  patientId: string;
  serviceId: string;
  /** What one unit sells for before anyone discounts it: the catalogue's "Giá sau giảm". */
  reference: number;
}

interface Advise {
  id: string;
  effectiveAmount: number;
}

async function setUp(page: Page): Promise<Fixture> {
  const id = runId();
  const roleName = `Giam gia ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const grant = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: LEAVES.map((name) => ({ name, isGranted: true })) },
  });
  expect(grant.status).toBe(204);

  const userName = `gg${id}`;
  const staffName = `Nhân viên giảm giá ${id}`;
  const staff = await call<Staff>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: staffName,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);
  expect([staff.body.maxDiscountPercent, staff.body.maxDiscountAmount]).toEqual([null, null]);

  const patients = await call<{ items: { id: string }[] }>(page, "/api/v1/app/patients?maxResultCount=1", asBranchOne);
  const services = await call<{ items: { id: string; price: number | null; service?: { priceAfterDiscount?: number } | null }[] }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${BRANCH_ONE}&group=care_service&isActive=true&maxResultCount=200`,
    asBranchOne,
  );
  const priced = services.body.items
    .map((s) => ({ id: s.id, reference: s.service?.priceAfterDiscount || s.price || 0 }))
    .filter((s) => s.reference >= 500_000)
    .sort((a, b) => b.reference - a.reference)[0];
  expect(priced, "branch 1 needs a priced service").toBeTruthy();

  return {
    roleId: role.body.id,
    staffId: staff.body.id,
    userName,
    staffName,
    patientId: patients.body.items[0].id,
    serviceId: priced.id,
    reference: priced.reference,
  };
}

async function setLimit(page: Page, fixture: Fixture, maxDiscountPercent: number | null, maxDiscountAmount: number | null) {
  const current = await call<Staff>(page, `/api/v1/app/staff/${fixture.staffId}`);
  const res = await call<Staff>(page, `/api/v1/app/staff/${fixture.staffId}`, {
    method: "PUT",
    json: { ...current.body, password: undefined, maxDiscountPercent, maxDiscountAmount },
  });
  expect(res.status).toBe(200);
  expect([res.body.maxDiscountPercent, res.body.maxDiscountAmount]).toEqual([maxDiscountPercent, maxDiscountAmount]);
}

async function tearDown(page: Page, fixture: Fixture, adviseIds: string[]) {
  for (const id of adviseIds) await call(page, `${ADVISES}/${id}`, { method: "DELETE", ...asBranchOne });
  await call(page, `/api/v1/app/staff/${fixture.staffId}`, { method: "DELETE" });
  await call(page, `/api/identity/roles/${fixture.roleId}`, { method: "DELETE" });
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}

function line(fixture: Fixture, price: number, discountType: number, discountValue: number) {
  return {
    patientId: fixture.patientId,
    clinicBranchId: BRANCH_ONE,
    serviceId: fixture.serviceId,
    staffId: fixture.staffId,
    originalPrice: fixture.reference,
    price,
    quantity: 1,
    discountType,
    discountValue,
    note: "E2E quy định giảm giá",
    teeth: [{ toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
  };
}

async function raise(page: Page, body: ReturnType<typeof line>) {
  return call<Advise & { error?: { code?: string; message?: string } }>(page, ADVISES, { method: "POST", json: body, ...asBranchOne });
}

test.describe("Quy định giảm giá", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a share or an amount above the account's limit is refused, a lowered price counts, within it is fine, admin is not limited", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const created: string[] = [];
    const staff = await openSession(browser, fixture.userName);
    try {
      const r = fixture.reference;

      // No limit set: anything goes.
      const free = await raise(staff.page, line(fixture, r, DISCOUNT.Percentage, 30));
      expect(free.status).toBe(200);
      created.push(free.body.id);

      // 10 %: a price lowered by 12 % is a 12 % discount; 9 % off is fine.
      await setLimit(page, fixture, 10, null);
      const lowered = await raise(staff.page, line(fixture, Math.round(r * 0.88), DISCOUNT.None, 0));
      expect(lowered.status).toBe(403);
      expect(lowered.body.error?.code).toBe(ABOVE_PERCENT);
      expect(lowered.body.error?.message).toContain("10%");
      const nine = await raise(staff.page, line(fixture, r, DISCOUNT.Percentage, 9));
      expect(nine.status).toBe(200);
      created.push(nine.body.id);

      // An amount cap bites even on a small share.
      const cap = Math.round(r * 0.05);
      await setLimit(page, fixture, null, cap);
      const above = await raise(staff.page, line(fixture, r, DISCOUNT.Money, cap + 1000));
      expect(above.status).toBe(403);
      expect(above.body.error?.code).toBe(ABOVE_AMOUNT);
      const within = await raise(staff.page, line(fixture, r, DISCOUNT.Money, cap));
      expect(within.status).toBe(200);
      created.push(within.body.id);

      // Admin has no limit.
      const big = await raise(page, line(fixture, r, DISCOUNT.Percentage, 50));
      expect(big.status).toBe(200);
      created.push(big.body.id);

      // The limited account may keep the admin's 50 % while editing the line,
      // but not raise it.
      const kept = await call<Advise>(staff.page, `${ADVISES}/${big.body.id}`, {
        method: "PUT",
        json: { price: r, quantity: 1, discountType: DISCOUNT.Percentage, discountValue: 50, sortOrder: 0 },
        ...asBranchOne,
      });
      expect(kept.status, JSON.stringify(kept.body)).toBe(200);
      const raised = await call<{ error?: { code?: string } }>(staff.page, `${ADVISES}/${big.body.id}`, {
        method: "PUT",
        json: { price: r, quantity: 1, discountType: DISCOUNT.Percentage, discountValue: 60, sortOrder: 0 },
        ...asBranchOne,
      });
      expect(raised.status).toBe(403);
      expect(raised.body.error?.code).toBe(ABOVE_AMOUNT);

      // Read back separately: the refused lines were never stored.
      const listed = await call<{ items: { id: string; note?: string }[] }>(
        page,
        `${ADVISES}?PatientId=${fixture.patientId}&maxResultCount=1000`,
        asBranchOne,
      );
      const ours = listed.body.items.filter((a) => created.includes(a.id));
      expect(ours).toHaveLength(created.length);
    } finally {
      await staff.context.close();
      await tearDown(page, fixture, created);
    }
  });

  test("a limit cannot be got round by shrinking a line under its discount, or by cancelling what a slip discount is taken off", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const created: string[] = [];
    const staff = await openSession(browser, fixture.userName);
    try {
      const r = fixture.reference;
      await setLimit(page, fixture, 10, null);

      // Ten units with one unit's worth off is 10 %; the same amount off one unit is all of it.
      const ten = await raise(staff.page, { ...line(fixture, r, DISCOUNT.Money, r), quantity: 10 });
      expect(ten.status, JSON.stringify(ten.body)).toBe(200);
      created.push(ten.body.id);
      const shrunk = await call<{ error?: { code?: string } }>(staff.page, `${ADVISES}/${ten.body.id}`, {
        method: "PUT",
        json: { price: r, quantity: 1, discountType: DISCOUNT.Money, discountValue: r, sortOrder: 0 },
        ...asBranchOne,
      });
      expect(shrunk.status).toBe(403);
      expect(shrunk.body.error?.code).toBe(ABOVE_PERCENT);

      // A slip of two lines with 10 % of it off as VNĐ; cancelling one line would make it 20 %.
      const a = await raise(page, line(fixture, r, DISCOUNT.None, 0));
      const b = await raise(page, line(fixture, r, DISCOUNT.None, 0));
      created.push(a.body.id, b.body.id);
      for (const id of [a.body.id, b.body.id]) {
        expect((await call(page, `${ADVISES}/${id}/accept`, { method: "POST", ...asBranchOne })).status).toBe(200);
      }
      const slip = await call<{ id: string; services: { id: string }[]; error?: { code?: string } }>(
        staff.page, "/api/v1/app/patient-treatments", {
          method: "POST",
          json: {
            patientId: fixture.patientId,
            clinicBranchId: BRANCH_ONE,
            dentistId: fixture.staffId,
            discountType: DISCOUNT.Money,
            discountValue: Math.round(r * 2 * 0.1),
            adviseIds: [a.body.id, b.body.id],
          },
          ...asBranchOne,
        });
      expect(slip.status, JSON.stringify(slip.body)).toBe(200);
      const cancel = await call<{ error?: { code?: string } }>(
        staff.page, `/api/v1/app/patient-treatments/${slip.body.id}/services/${slip.body.services[0].id}/cancel`,
        { method: "POST", ...asBranchOne });
      expect(cancel.status).toBe(403);
      expect(cancel.body.error?.code).toBe(ABOVE_PERCENT);

      // Nothing changed: both lines still count on the slip.
      const after = await call<{ services: { status: number }[] }>(
        page, `/api/v1/app/patient-treatments/${slip.body.id}`, asBranchOne);
      expect(after.body.services.filter((s) => s.status !== 4)).toHaveLength(2);
    } finally {
      await staff.context.close();
      await tearDown(page, fixture, created);
    }
  });

  test("the staff dialog sets and clears the limits", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      await page.goto("/staff");
      const row = page.getByRole("row").filter({ hasText: fixture.staffName });
      await row.getByRole("button").first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Giảm tối đa (%)").fill("15");
      await dialog.getByLabel("Giảm tối đa (VNĐ)").fill("300000");
      await expect(dialog.getByLabel("Giảm tối đa (VNĐ)")).toHaveValue(/300\.000/);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden();

      const saved = (await call<Staff>(page, `/api/v1/app/staff/${fixture.staffId}`)).body;
      expect([saved.maxDiscountPercent, saved.maxDiscountAmount]).toEqual([15, 300000]);

      await page.reload();
      await row.getByRole("button").first().click();
      await expect(page.getByRole("dialog").getByLabel("Giảm tối đa (%)")).toHaveValue("15.00");
      await page.getByRole("dialog").getByLabel("Giảm tối đa (%)").fill("");
      await page.getByRole("dialog").getByLabel("Giảm tối đa (VNĐ)").fill("");
      await page.getByRole("dialog").getByRole("button", { name: /Lưu/ }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      const cleared = (await call<Staff>(page, `/api/v1/app/staff/${fixture.staffId}`)).body;
      expect([cleared.maxDiscountPercent, cleared.maxDiscountAmount]).toEqual([null, null]);
    } finally {
      await tearDown(page, fixture, []);
    }
  });
});
