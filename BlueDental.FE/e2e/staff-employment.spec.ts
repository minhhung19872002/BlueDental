import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Nhân viên → Hồ sơ công việc (F-60; Cụm 11 mục 1 — chức vụ, chứng
 * chỉ hành nghề, loại hợp đồng). BlueDental-local; see
 * docs/clone/pages/staff-employment.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run creates and deletes its own staff member in branch 1.
 */

const STAFF = "/api/v1/app/staff";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const PROBATION = 1;
const INDEFINITE = 3;

interface Staff {
  id: string;
  position: string | null;
  practiceCertificateNumber: string | null;
  practiceCertificateIssuedOn: string | null;
  practiceCertificateIssuedPlace: string | null;
  contractType: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  error?: { code?: string };
}

async function createStaff(page: Page, id: string, extra: Partial<Staff> = {}) {
  const userName = `hs${id}`;
  const res = await call<Staff>(page, STAFF, {
    method: "POST",
    json: {
      userName,
      password: "HoSo@123456",
      name: `Nhân viên hồ sơ ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: [BRANCH_ONE],
      isActive: true,
      ...extra,
    },
  });
  return res;
}

test.describe("Hồ sơ công việc nhân viên", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("chức vụ, chứng chỉ hành nghề and hợp đồng are saved, read back, suggested and checked", async ({ page }) => {
    const id = runId();
    const position = `Bác sĩ chính ${id}`;
    const created = await createStaff(page, id, {
      position: `  ${position}  `,
      practiceCertificateNumber: `CCHN-${id}`,
      practiceCertificateIssuedOn: "2020-05-12",
      practiceCertificateIssuedPlace: "Sở Y tế TP.HCM",
      contractType: PROBATION,
      contractStartDate: "2026-10-01",
      contractEndDate: "2026-12-01",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const staffId = created.body.id;
    try {
      const read = (await call<Staff>(page, `${STAFF}/${staffId}`)).body;
      expect(read.position).toBe(position);
      expect(read.practiceCertificateNumber).toBe(`CCHN-${id}`);
      expect(read.practiceCertificateIssuedOn).toBe("2020-05-12");
      expect(read.practiceCertificateIssuedPlace).toBe("Sở Y tế TP.HCM");
      expect(read.contractType).toBe(PROBATION);
      expect([read.contractStartDate, read.contractEndDate]).toEqual(["2026-10-01", "2026-12-01"]);

      const positions = await call<string[]>(page, `${STAFF}/positions`);
      expect(positions.body).toContain(position);

      // An end before the start, a certificate from the future, an unknown contract type.
      for (const [bad, code] of [
        [{ contractStartDate: "2026-10-01", contractEndDate: "2026-09-30" }, "BlueDental:Staff:0009"],
        [{ practiceCertificateIssuedOn: "2099-01-01" }, "BlueDental:Staff:0010"],
        [{ contractType: 9 }, "BlueDental:Staff:0011"],
      ] as const) {
        const res = await call<Staff>(page, `${STAFF}/${staffId}`, {
          method: "PUT",
          json: { ...read, password: undefined, ...bad },
        });
        expect(res.status, JSON.stringify(bad)).toBe(403);
        expect(res.body.error?.code).toBe(code);
      }

      // Indefinite with no end, and the certificate cleared.
      const updated = await call<Staff>(page, `${STAFF}/${staffId}`, {
        method: "PUT",
        json: {
          ...read,
          password: undefined,
          contractType: INDEFINITE,
          contractEndDate: null,
          practiceCertificateNumber: "",
          practiceCertificateIssuedOn: null,
          practiceCertificateIssuedPlace: null,
        },
      });
      expect(updated.status).toBe(200);
      const after = (await call<Staff>(page, `${STAFF}/${staffId}`)).body;
      expect(after.contractType).toBe(INDEFINITE);
      expect(after.contractEndDate).toBeNull();
      expect(after.practiceCertificateNumber).toBeNull();
      expect(after.position).toBe(position);
    } finally {
      await call(page, `${STAFF}/${staffId}`, { method: "DELETE" });
    }
  });

  test("the staff dialog edits the work record and it survives a reload", async ({ page }) => {
    const id = runId();
    const created = await createStaff(page, id);
    expect(created.status).toBe(200);
    const staffId = created.body.id;
    try {
      await page.goto("/staff");
      const row = page.getByRole("row").filter({ hasText: `Nhân viên hồ sơ ${id}` });
      await row.getByRole("button").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Hồ sơ công việc")).toBeVisible();

      await dialog.getByLabel("Chức vụ").fill(`Phụ tá trưởng ${id}`);
      await dialog.getByLabel("Loại hợp đồng").click();
      await page.locator('.ant-select-item-option[title="Có thời hạn"]').click();
      await dialog.getByLabel("Ngày bắt đầu hợp đồng").fill("01/10/2026");
      await dialog.getByLabel("Ngày bắt đầu hợp đồng").press("Enter");
      await dialog.getByLabel("Ngày kết thúc hợp đồng").fill("30/09/2026");
      await dialog.getByLabel("Ngày kết thúc hợp đồng").press("Enter");
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog.getByText("Ngày kết thúc phải từ ngày bắt đầu trở về sau")).toBeVisible();

      await dialog.getByLabel("Ngày kết thúc hợp đồng").fill("30/09/2027");
      await dialog.getByLabel("Ngày kết thúc hợp đồng").press("Enter");
      await dialog.getByLabel("Số chứng chỉ hành nghề").fill(`CCHN-${id}`);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden();

      const saved = (await call<Staff>(page, `${STAFF}/${staffId}`)).body;
      expect(saved.position).toBe(`Phụ tá trưởng ${id}`);
      expect(saved.contractType).toBe(2);
      expect([saved.contractStartDate, saved.contractEndDate]).toEqual(["2026-10-01", "2027-09-30"]);
      expect(saved.practiceCertificateNumber).toBe(`CCHN-${id}`);

      await page.reload();
      await row.getByRole("button").first().click();
      const reopened = page.getByRole("dialog");
      await expect(reopened.getByLabel("Chức vụ")).toHaveValue(`Phụ tá trưởng ${id}`);
      await expect(reopened.getByLabel("Ngày kết thúc hợp đồng")).toHaveValue("30/09/2027");
      await expect(reopened.getByText("Có thời hạn")).toBeVisible();
    } finally {
      await call(page, `${STAFF}/${staffId}`, { method: "DELETE" });
    }
  });
});
