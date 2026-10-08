import { expect, test, type Browser, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Cụm 11 mục 9 — "Ẩn số điện thoại" (F-53). The `patient.hidePhone`
 * tick on a role masks patient and guardian phones for its members:
 * responses, the Excel file, and the screens. See docs/clone/pages/hide-phone.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own role (so no shared role's grants are touched), a staff
 * member in it, and an adult patient with one guardian.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const PATIENTS = "/api/v1/app/patients";
const PASSWORD = "AnSdt@123456";
const MASKED_UNRESOLVED = "BlueDental:Patient:0022";
const GRANTS = ["BlueDental.patient.read", "BlueDental.patient.update", "BlueDental.patient.export", "BlueDental.patient.hidePhone"];

interface Guardian {
  id: string;
  relation: number;
  fullName: string;
  phone: string;
  nationalId: string;
  sameAddressAsPatient: boolean;
  isPrimaryContact: boolean;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  gender: number;
  dateOfBirth: string | null;
  phoneNumber: string;
  guardians: Guardian[];
}

interface Fixture {
  roleId: string;
  roleName: string;
  staffId: string;
  userName: string;
  patient: Patient;
  phone: string;
  guardianPhone: string;
}

const mask = (phone: string) => `${phone.slice(0, 3)}${"*".repeat(phone.length - 6)}${phone.slice(-3)}`;
const asBranchOne = { branchId: BRANCH_ONE };

async function setGrants(page: Page, roleName: string, names: string[], granted: boolean) {
  const res = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: names.map((name) => ({ name, isGranted: granted })) },
  });
  expect(res.status).toBe(204);
}

async function setUp(page: Page): Promise<Fixture> {
  const id = runId();
  const roleName = `An SĐT ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  await setGrants(page, roleName, GRANTS, true);

  const userName = `ansdt${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên ẩn SĐT ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);

  const phone = `09${id}${String(Date.now()).slice(-2)}`;
  const guardianPhone = `07${id}${String(Date.now()).slice(-2)}`;
  const patient = await call<Patient>(page, PATIENTS, {
    method: "POST",
    ...asBranchOne,
    json: {
      firstName: "Hạnh",
      lastName: `Ẩn Số E2E ${id}`,
      gender: 1,
      phoneNumber: phone,
      dateOfBirth: "1990-05-05",
      guardians: [
        {
          relation: 2,
          fullName: `GH Ẩn Số ${id}`,
          phone: guardianPhone,
          nationalId: `0791${id}55`,
          sameAddressAsPatient: true,
          isPrimaryContact: true,
        },
      ],
      guardiansConsented: true,
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);

  return { roleId: role.body.id, roleName, staffId: staff.body.id, userName, patient: patient.body, phone, guardianPhone };
}

async function tearDown(page: Page, fixture: Fixture) {
  await call(page, `/api/v1/app/staff/${fixture.staffId}`, { method: "DELETE" });
  await call(page, `/api/identity/roles/${fixture.roleId}`, { method: "DELETE" });
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}

/** The patient's update body as the edit dialog sends it: everything it loaded, sent back. */
function echo(patient: Patient, overrides: Partial<Patient> = {}) {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: patient.phoneNumber,
    guardians: patient.guardians,
    guardiansConsented: true,
    ...overrides,
  };
}

/** The patient Excel as the masked account downloads it, read back as rows of text. */
async function exportedText(page: Page, filter: string): Promise<string> {
  const base64 = await page.evaluate(
    async ({ url, branch }) => {
      const res = await fetch(url, { credentials: "include", headers: { "X-Clinic-Branch-Id": branch } });
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      return btoa(binary);
    },
    { url: `${PATIENTS}/excel?Filter=${encodeURIComponent(filter)}`, branch: BRANCH_ONE },
  );
  const book = XLSX.read(Buffer.from(base64, "base64"));
  return XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]]);
}

test.describe("Ẩn số điện thoại", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a role with the tick sees patient and guardian phones masked — in lists, detail and Excel — and admin does not", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const masked = await openSession(browser, fixture.userName);
    try {
      // Searching by the full number still finds the record; it just shows masked.
      const list = await call<{ items: Patient[] }>(masked.page, `${PATIENTS}?Filter=${fixture.phone}`, asBranchOne);
      expect(list.status).toBe(200);
      expect(list.body.items.map((p) => p.phoneNumber)).toEqual([mask(fixture.phone)]);

      // …but only by the whole number: part of it cannot spell out the hidden digits.
      const partial = await call<{ items: Patient[] }>(
        masked.page,
        `${PATIENTS}?Filter=${encodeURIComponent(`${fixture.patient.lastName} ${fixture.phone.slice(0, 6)}`)}`,
        asBranchOne,
      );
      expect(partial.body.items).toHaveLength(0);
      const partialAsAdmin = await call<{ items: Patient[] }>(
        page,
        `${PATIENTS}?Filter=${encodeURIComponent(`${fixture.patient.lastName} ${fixture.phone.slice(0, 6)}`)}`,
        asBranchOne,
      );
      expect(partialAsAdmin.body.items.map((p) => p.id)).toEqual([fixture.patient.id]);

      // The duplicate check says the number is taken, not whose it is.
      const taken = await call<{ exists: boolean; owners?: { id: string }[] }>(
        masked.page, `${PATIENTS}/check-phone?phone=${fixture.phone}`, asBranchOne);
      expect(taken.body.exists).toBe(true);
      expect(taken.body.owners ?? []).toHaveLength(0);
      const takenAsAdmin = await call<{ owners: { id: string }[] }>(
        page, `${PATIENTS}/check-phone?phone=${fixture.phone}`, asBranchOne);
      expect(takenAsAdmin.body.owners.map((o) => o.id)).toContain(fixture.patient.id);

      const detail = await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne);
      expect(detail.body.phoneNumber).toBe(mask(fixture.phone));
      expect(detail.body.guardians[0].phone).toBe(mask(fixture.guardianPhone));

      const sheet = await exportedText(masked.page, fixture.phone);
      expect(sheet).toContain(mask(fixture.phone));
      expect(sheet).not.toContain(fixture.phone);

      const asAdmin = await call<Patient>(page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne);
      expect(asAdmin.body.phoneNumber).toBe(fixture.phone);
      expect(asAdmin.body.guardians[0].phone).toBe(fixture.guardianPhone);

      // Untick: the same account sees the numbers again (grant changes are not cached).
      await setGrants(page, fixture.roleName, ["BlueDental.patient.hidePhone"], false);
      const unmasked = await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne);
      expect(unmasked.body.phoneNumber).toBe(fixture.phone);
    } finally {
      await masked.context.close();
      await tearDown(page, fixture);
    }
  });

  test("saving a record as shown keeps the real numbers; a masked value that fits nothing is refused; a new number is saved", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const masked = await openSession(browser, fixture.userName);
    try {
      const shown = (await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne)).body;
      expect(shown.phoneNumber).toBe(mask(fixture.phone));

      const saved = await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, {
        ...asBranchOne,
        method: "PUT",
        json: echo(shown, { firstName: "Hạnh Sửa" }),
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);

      const stored = (await call<Patient>(page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne)).body;
      expect(stored.firstName).toBe("Hạnh Sửa");
      expect(stored.phoneNumber).toBe(fixture.phone);
      expect(stored.guardians[0].phone).toBe(fixture.guardianPhone);

      const forged = await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, {
        ...asBranchOne,
        method: "PUT",
        json: echo(shown, { phoneNumber: "091****000" }),
      });
      expect(forged.status).toBe(403);
      expect((forged.body as { error?: { code?: string } }).error?.code).toBe(MASKED_UNRESOLVED);

      const fresh = `08${fixture.phone.slice(2)}`;
      const changed = await call<Patient>(masked.page, `${PATIENTS}/${fixture.patient.id}`, {
        ...asBranchOne,
        method: "PUT",
        json: echo(shown, { phoneNumber: fresh }),
      });
      expect(changed.status).toBe(200);
      expect((await call<Patient>(page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne)).body.phoneNumber).toBe(fresh);
    } finally {
      await masked.context.close();
      await tearDown(page, fixture);
    }
  });

  test("on screen the list and the edit dialog show the masked number, and Lưu keeps the real one", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const masked = await openSession(browser, fixture.userName);
    try {
      await masked.page.goto("/patient");
      await masked.page.getByPlaceholder(/Tìm/).first().fill(fixture.phone);
      const row = masked.page.getByRole("row").filter({ hasText: fixture.patient.lastName });
      await expect(row).toContainText(mask(fixture.phone));
      await expect(row).not.toContainText(fixture.phone);

      await masked.page.goto(`/patient/${fixture.patient.id}`);
      await expect(masked.page.getByText(mask(fixture.phone)).first()).toBeVisible();
      await expect(masked.page.getByText(fixture.phone)).toHaveCount(0);
      await masked.page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
      const dialog = masked.page.getByRole("dialog");
      await expect(dialog.getByLabel(/Điện thoại/).first()).toHaveValue(mask(fixture.phone));
      const [response] = await Promise.all([
        masked.page.waitForResponse((r) => r.url().includes(`${PATIENTS}/${fixture.patient.id}`) && r.request().method() === "PUT"),
        dialog.getByRole("button", { name: /Lưu/ }).click(),
      ]);
      expect(response.status()).toBe(200);

      const stored = (await call<Patient>(page, `${PATIENTS}/${fixture.patient.id}`, asBranchOne)).body;
      expect(stored.phoneNumber).toBe(fixture.phone);
      expect(stored.guardians[0].phone).toBe(fixture.guardianPhone);
    } finally {
      await masked.context.close();
      await tearDown(page, fixture);
    }
  });

  test("a number another record holds is refused without naming it — never '0 hồ sơ'", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const otherPhone = `08${fixture.phone.slice(2)}`;
    const other = await call<Patient>(page, PATIENTS, {
      method: "POST",
      ...asBranchOne,
      json: { firstName: "Khác", lastName: `Chủ Số ${fixture.userName}`, gender: 1, phoneNumber: otherPhone, dateOfBirth: "1991-01-01" },
    });
    expect(other.status, JSON.stringify(other.body)).toBe(200);
    const masked = await openSession(browser, fixture.userName);
    try {
      await masked.page.goto(`/patient/${fixture.patient.id}`);
      await masked.page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
      const dialog = masked.page.getByRole("dialog");
      await dialog.getByLabel(/Điện thoại/).first().fill(otherPhone);

      const alert = dialog.locator(".bd-patient-dupe");
      await expect(alert).toContainText("Số điện thoại này đã được dùng cho một hồ sơ khác");
      await expect(alert).not.toContainText("0 hồ sơ");
      await expect(alert).not.toContainText(other.body.lastName);
      await expect(dialog.getByRole("button", { name: /Lưu/ })).toBeDisabled();
    } finally {
      await masked.context.close();
      await tearDown(page, fixture);
    }
  });
});
