import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Nhân viên → Bảng lương (F-57; Cụm 11 mục 5, with chấm công from
 * mục 6). BlueDental-local; see docs/clone/pages/payroll.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own branch with one staff member, so the month's sheet holds
 * exactly that person: pay terms, today's chấm công (one shift + tăng ca) and
 * an approved fine all come from the real screens' endpoints.
 */

const BRANCHES = "/api/v1/app/clinic-branches";
const STAFF = "/api/v1/app/staff";
const PAYROLL = "/api/v1/app/payroll";
const TIMEKEEPING = "/api/v1/app/time-keepings";
const BASE_SALARY = 10_400_000;
const ALLOWANCE = 500_000;
const FINE = 100_000;
const NOT_DRAFT = "BlueDental:Payroll:0004";
const DUPLICATE = "BlueDental:Payroll:0006";

interface Entry {
  staffId: string;
  staffName: string;
  baseSalary: number;
  allowance: number;
  workedDays: number;
  payableWorkDays: number;
  overtimeMinutes: number;
  salaryByWorkDays: number;
  overtimePay: number;
  penaltyAmount: number;
  bonus: number;
  netSalary: number;
}

interface Period {
  id: string;
  status: number;
  standardWorkDays: number;
  overtimeRate: number;
  entries: Entry[];
  error?: { code?: string };
}

interface Fixture {
  branchId: string;
  branchName: string;
  staffId: string;
  staffName: string;
  year: number;
  month: number;
}

/** The clinic's calendar day (UTC+7) as "YYYY-MM-DD". */
const clinicToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

async function setUp(page: Page): Promise<Fixture> {
  const id = runId();
  const branchName = `CN LUONG ${id}`;
  const branch = await call<{ id: string }>(page, BRANCHES, { method: "POST", json: { code: `LG${id}`, name: branchName } });
  expect(branch.status).toBe(200);
  const branchId = branch.body.id;

  const userName = `luong${id}`;
  const staffName = `Nhân viên lương ${id}`;
  const staff = await call<{ id: string }>(page, STAFF, {
    method: "POST",
    json: {
      userName,
      password: "Luong@123456",
      name: staffName,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: [branchId],
      isActive: true,
      isDentist: true,
    },
  });
  expect(staff.status).toBe(200);
  const staffId = staff.body.id;

  const pay = await call(page, `${PAYROLL}/compensations/${staffId}`, {
    method: "PUT",
    json: { baseSalary: BASE_SALARY, allowance: ALLOWANCE },
  });
  expect(pay.status).toBe(200);

  // Today's chấm công at the new branch: the morning shift in and out, 2 h tăng ca.
  const today = clinicToday();
  const record = await call<{ id: string }>(page, `${TIMEKEEPING}/open-day`, {
    method: "POST",
    branchId,
    json: { staffId, clinicBranchId: branchId, workDate: today },
  });
  expect(record.status, JSON.stringify(record.body)).toBe(200);
  for (const [action, json] of [
    ["register-working", undefined],
    ["check-in", { shift: 1 }],
    ["check-out", { shift: 1 }],
    ["overtime", { minutes: 120 }],
  ] as const) {
    const res = await call(page, `${TIMEKEEPING}/${record.body.id}/${action}`, { method: "POST", branchId, json });
    expect(res.status, `${action} ${JSON.stringify(res.body)}`).toBe(200);
  }

  // An approved Phạt tiền of today, and a draft one that must not count.
  for (const approve of [true, false]) {
    const fine = await call<{ id: string }>(page, "/api/v1/app/staff-penalties", {
      method: "POST",
      branchId,
      json: { clinicBranchId: branchId, staffId, violationDate: today, action: 3, fineAmount: FINE, description: "E2E lương" },
    });
    expect(fine.status, JSON.stringify(fine.body)).toBe(200);
    if (approve) {
      expect((await call(page, `/api/v1/app/staff-penalties/${fine.body.id}/approve`, { method: "POST", branchId })).status).toBe(200);
    }
  }

  const [year, month] = today.split("-").map(Number);
  return { branchId, branchName, staffId, staffName, year, month };
}

async function tearDown(page: Page, fixture: Fixture) {
  await call(page, `${STAFF}/${fixture.staffId}`, { method: "DELETE" });
  await call(page, `${BRANCHES}/${fixture.branchId}`, { method: "DELETE" });
}

const round = (value: number) => Math.round(value);

function expectRow(entry: Entry, standard: number, rate: number, bonus = 0) {
  const salary = round((BASE_SALARY * Math.min(entry.payableWorkDays, standard)) / standard);
  const overtime = round((BASE_SALARY / standard / 8) * 2 * rate);
  expect(entry.workedDays).toBe(0.5);
  expect(entry.overtimeMinutes).toBe(120);
  expect(entry.salaryByWorkDays).toBe(salary);
  expect(entry.overtimePay).toBe(overtime);
  expect(entry.penaltyAmount).toBe(FINE);
  expect(entry.netSalary).toBe(salary + ALLOWANCE + overtime + bonus - FINE);
}

test.describe("Bảng lương", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the month's sheet adds up pay terms, chấm công and approved fines; hand-entered parts survive; chốt freezes it", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      const created = await call<Period>(page, `${PAYROLL}/periods`, {
        method: "POST",
        json: { clinicBranchId: fixture.branchId, year: fixture.year, month: fixture.month },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(200);
      const period = created.body;
      expect(period.entries.map((e) => e.staffId)).toEqual([fixture.staffId]);
      expectRow(period.entries[0], period.standardWorkDays, period.overtimeRate);

      // One sheet per branch and month.
      const again = await call<Period>(page, `${PAYROLL}/periods`, {
        method: "POST",
        json: { clinicBranchId: fixture.branchId, year: fixture.year, month: fixture.month },
      });
      expect(again.status).toBe(403);
      expect(again.body.error?.code).toBe(DUPLICATE);

      // Thưởng and a corrected ngày công, then a recalculation and new terms keep them.
      await call(page, `${PAYROLL}/periods/${period.id}/entries/${fixture.staffId}`, {
        method: "PUT",
        json: { workDaysOverride: 20, bonus: 1_000_000, otherDeduction: 0, note: "E2E" },
      });
      await call(page, `${PAYROLL}/periods/${period.id}/recalculate`, { method: "POST" });
      const terms = await call<Period>(page, `${PAYROLL}/periods/${period.id}/terms`, {
        method: "PUT",
        json: { standardWorkDays: 26, overtimeRate: 2 },
      });
      expect(terms.status).toBe(200);
      const reread = (await call<Period>(page, `${PAYROLL}/periods/${period.id}`)).body;
      expect(reread.entries[0].payableWorkDays).toBe(20);
      expect(reread.entries[0].bonus).toBe(1_000_000);
      expectRow(reread.entries[0], 26, 2, 1_000_000);

      // The file carries the same figures.
      const base64 = await page.evaluate(async (url) => {
        const bytes = new Uint8Array(await (await fetch(url, { credentials: "include" })).arrayBuffer());
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary);
      }, `${PAYROLL}/periods/${period.id}/excel`);
      const sheet = XLSX.utils.sheet_to_csv(XLSX.read(Buffer.from(base64, "base64")).Sheets["Bang luong"], { rawNumbers: true });
      expect(sheet).toContain(fixture.staffName);
      expect(sheet).toContain(String(reread.entries[0].netSalary));

      // Chốt: frozen.
      expect((await call(page, `${PAYROLL}/periods/${period.id}/finalize`, { method: "POST" })).status).toBe(200);
      const frozen = await call<Period>(page, `${PAYROLL}/periods/${period.id}/recalculate`, { method: "POST" });
      expect(frozen.status).toBe(403);
      expect(frozen.body.error?.code).toBe(NOT_DRAFT);
      expect((await call(page, `${PAYROLL}/periods/${period.id}`, { method: "DELETE" })).status).toBe(403);
      expect((await call<Period>(page, `${PAYROLL}/periods/${period.id}`)).body.status).toBe(2);
    } finally {
      await tearDown(page, fixture);
    }
  });

  test("on screen: set the pay, create the sheet, adjust a row and chốt it", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      await page.goto(`/staff/payroll?branchId=${fixture.branchId}`);
      await page.getByText("Lương cơ bản & phụ cấp").click();
      const payRow = page.getByRole("row").filter({ hasText: fixture.staffName });
      await expect(payRow).toContainText("10.400.000");

      await page.getByText("Bảng lương tháng").click();
      await page.getByRole("button", { name: "Tạo bảng lương" }).click();
      const row = page.getByRole("row").filter({ hasText: fixture.staffName });
      await expect(row).toBeVisible();
      await expect(page.getByText("Nháp")).toBeVisible();

      await row.getByRole("button", { name: "Điều chỉnh" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Thưởng").fill("750000");
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toContainText("750.000");

      await page.getByRole("button", { name: "Chốt bảng lương" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Chốt bảng lương" }).click();
      await expect(page.getByText("Đã chốt").first()).toBeVisible();

      await page.reload();
      await expect(page.getByText("Đã chốt").first()).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: fixture.staffName })).toContainText("750.000");
      await expect(page.getByRole("button", { name: "Tính lại" })).toHaveCount(0);
    } finally {
      await tearDown(page, fixture);
    }
  });

  test("a branch manager sets the pay of its own branch's staff, never of a clinic-wide account", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const id = runId();
    const roleName = `Ke toan ${id}`;
    const role = await call<{ id: string }>(page, "/api/identity/roles", { method: "POST", json: { name: roleName, isPublic: true } });
    expect(role.status).toBe(200);
    expect((await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
      method: "PUT",
      json: { permissions: ["read", "update"].map((a) => ({ name: `BlueDental.payroll.${a}`, isGranted: true })) },
    })).status).toBe(204);

    const make = async (userName: string, branchIds: string[]) =>
      (await call<{ id: string }>(page, STAFF, {
        method: "POST",
        json: { userName, password: "KeToan@123456", name: userName, email: `${userName}@bluedental.local`, roleNames: [roleName], branchIds, isActive: true },
      })).body.id;
    const managerId = await make(`kt${id}`, [fixture.branchId]);
    const clinicWideId = await make(`cw${id}`, []);

    const context = await browser.newContext();
    const manager = await context.newPage();
    try {
      await login(manager, { userName: `kt${id}`, password: "KeToan@123456" });
      const own = await call(manager, `${PAYROLL}/compensations/${fixture.staffId}`, { method: "PUT", json: { baseSalary: 9_000_000, allowance: 0 } });
      expect(own.status).toBe(200);

      const above = await call<{ error?: { code?: string } }>(manager, `${PAYROLL}/compensations/${clinicWideId}`, {
        method: "PUT",
        json: { baseSalary: 1, allowance: 0 },
      });
      expect(above.status).toBe(403);
      expect(above.body.error?.code).toBe("BlueDental:Authorization:0001");

      // Admin (clinic-wide) may.
      expect((await call(page, `${PAYROLL}/compensations/${clinicWideId}`, { method: "PUT", json: { baseSalary: 1, allowance: 0 } })).status).toBe(200);
    } finally {
      await context.close();
      await call(page, `${STAFF}/${managerId}`, { method: "DELETE" });
      await call(page, `${STAFF}/${clinicWideId}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
      await tearDown(page, fixture);
    }
  });
});
