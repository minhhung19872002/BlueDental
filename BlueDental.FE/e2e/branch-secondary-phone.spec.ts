import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/catalogApi";

/**
 * "Số điện thoại 2" of Cài đặt → Thông tin phòng khám (R-1335): a second
 * clinic line that every printed letterhead shows after the first, both
 * grouped 4-3-3 — "0779 160 888 - 0767 080 333".
 *
 * Real stack only: the form saves through the real API into PostgreSQL, and
 * the printed sheets read the branch back from it. The tests edit the second
 * branch and put every field back afterwards.
 */

const BRANCH = "22222222-2222-2222-2222-222222222222";
const BRANCHES = "/api/v1/app/clinic-branches";
const FIRST = "0779160888";
const SECOND = "0767080333";
const BOTH_PRINTED = "0779 160 888 - 0767 080 333";
const INVALID_PHONE = "BlueDental:Organizations:0011";

interface Branch {
  id: string;
  code: string;
  name: string;
  phoneNumber: string | null;
  secondaryPhoneNumber: string | null;
  email: string | null;
  address: string | null;
  provinceId: string | null;
  wardId: string | null;
  slogan: string | null;
  taxCode: string | null;
  contactPerson: string | null;
}

let original: Branch;
let patientId: string;

const readBranch = async (page: Page) => (await call<Branch>(page, "GET", `${BRANCHES}/${BRANCH}`, undefined, BRANCH)).body;

/** Every field the update takes, as the branch has them now — so a test changes only what it names. */
const fullUpdate = (branch: Branch, patch: Partial<Record<keyof Branch, string | null>> = {}) => ({
  name: branch.name,
  phoneNumber: branch.phoneNumber,
  email: branch.email,
  address: branch.address,
  provinceId: branch.provinceId,
  wardId: branch.wardId,
  slogan: branch.slogan,
  taxCode: branch.taxCode,
  contactPerson: branch.contactPerson,
  ...patch,
});

const putBranch = (page: Page, body: unknown) => call<Branch & { error?: { code: string } }>(page, "PUT", `${BRANCHES}/${BRANCH}`, body, BRANCH);

/** A patient on the second branch with one priced advise line, for the báo giá. */
async function seedQuotePatient(page: Page): Promise<string> {
  return page.evaluate(
    async ({ branch, suffix }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };
      const patient = await post("/api/v1/app/patients", {
        firstName: `SĐT 2 ${suffix}`,
        lastName: "E2E",
        gender: "female",
        phoneNumber: `08${suffix.padStart(8, "0").slice(-8)}`,
      });
      const diagnosis = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)).items[0];
      const service = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)).items[0];
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = { toothCode: 21, selected: true, top: false, right: false, bottom: false, left: false, center: false };
      const slip = await post("/api/v1/app/patient-diagnoses", {
        patientId: patient.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.id,
        note: `e2e sđt 2 ${suffix}`,
        teeth: [tooth],
      });
      await post("/api/v1/app/patient-advises", {
        patientId: patient.id,
        clinicBranchId: branch,
        patientDiagnosisId: slip.id,
        diagnosisId: diagnosis.id,
        serviceId: service.id,
        staffId: staff.id,
        originalPrice: 3_900_000,
        price: 3_900_000,
        quantity: 2,
        discountType: 0,
        discountValue: 0,
        teeth: [tooth],
      });
      return patient.id as string;
    },
    { branch: BRANCH, suffix: runId() },
  );
}

async function openClinicInfo(page: Page) {
  await page.goto(`/settings?tab=clinic&branchId=${BRANCH}`);
  await expect(page.getByLabel("Số điện thoại 2")).toBeVisible({ timeout: 20_000 });
  // The form fills from the branch after it loads; wait until it has.
  await expect(page.getByLabel("Tên chi nhánh")).not.toHaveValue("");
}

/** Lưu Thay Đổi, and what the server answered. */
async function saveClinicInfo(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`${BRANCHES}/${BRANCH}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Lưu Thay Đổi" }).click(),
  ]);
  return { status: response.status(), sent: response.request().postDataJSON() as Record<string, unknown>, body: (await response.json()) as Branch };
}

/** The ĐT line of THÔNG TIN CHI NHÁNH on the printed báo giá. */
async function quoteLetterheadPhone(page: Page) {
  await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);
  const row = page.locator(".pd-advise-table tbody tr.ant-table-row").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator(".ant-checkbox-input").check();
  await page.getByRole("button", { name: "In Báo giá", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await detail.getByRole("button", { name: "In Hoá Đơn" }).click();
  const branch = page.locator(".pq-dialog--preview:visible .pq-sheet__branch");
  await expect(branch).toBeVisible();
  return branch.locator("p").filter({ hasText: /^ĐT:/ });
}

test.describe.serial("Thông tin phòng khám — Số điện thoại 2 (R-1335)", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await page.goto("/patient");
    original = await readBranch(page);
    expect(original.id).toBe(BRANCH);
    patientId = await seedQuotePatient(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!original) return;
    const page = await browser.newPage();
    await login(page);
    await page.goto("/patient");
    const restored = await putBranch(page, fullUpdate(original, { secondaryPhoneNumber: original.secondaryPhoneNumber ?? "" }));
    await page.close();
    expect(restored.status).toBe(200);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Lưu Thay Đổi keeps Số điện thoại 2 beside the first, and a reload reads both back", async ({ page }) => {
    await openClinicInfo(page);
    const first = page.getByLabel("Số điện thoại", { exact: true });
    const second = page.getByLabel("Số điện thoại 2");

    // The two lines share a row, the first on the left.
    const firstBox = (await first.boundingBox())!;
    const secondBox = (await second.boundingBox())!;
    expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThanOrEqual(2);
    expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width);

    await first.fill(FIRST);
    await second.fill(SECOND);
    const saved = await saveClinicInfo(page);
    expect(saved.status).toBe(200);
    expect(saved.sent.secondaryPhoneNumber).toBe(SECOND);
    expect(saved.body.phoneNumber).toBe(FIRST);
    expect(saved.body.secondaryPhoneNumber).toBe(SECOND);
    await expect(page.getByText("Cập nhật thông tin phòng khám thành công")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Số điện thoại 2")).toHaveValue(SECOND, { timeout: 20_000 });
    await expect(page.getByLabel("Số điện thoại", { exact: true })).toHaveValue(FIRST);

    // The accessible list — what every letterhead reads — carries it too.
    const accessible = await call<{ items: Branch[] }>(page, "GET", `${BRANCHES}/accessible`, undefined, BRANCH);
    expect(accessible.body.items.find((b) => b.id === BRANCH)?.secondaryPhoneNumber).toBe(SECOND);
  });

  test("the báo giá and the phiếu chẩn đoán print both lines, 4-3-3, joined by a dash", async ({ page }) => {
    await putBranch(page, fullUpdate(await readBranch(page), { phoneNumber: FIRST, secondaryPhoneNumber: SECOND }));

    await expect(await quoteLetterheadPhone(page)).toHaveText(`ĐT: ${BOTH_PRINTED}`);

    // The same branch line on the diagnosis sheet.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.reload();
    const print = page.locator(".pd-diagnosis-card").getByRole("button", { name: "In chẩn đoán" });
    await expect(print.first()).toBeVisible({ timeout: 20_000 });
    await print.first().click();
    const sheet = page.locator(".dp-dialog .dp-sheet-head").first();
    await expect(sheet).toContainText(BOTH_PRINTED);
  });

  test("the báo giá shows Số lượng 2 and the bare Đơn giá of a two-unit line", async ({ page }) => {
    await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);
    const row = page.locator(".pd-advise-table tbody tr.ant-table-row").first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator(".ant-checkbox-input").check();
    await page.getByRole("button", { name: "In Báo giá", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    const line = detail.locator(".pq-services tbody tr.ant-table-row").first();
    await expect(line.locator("td").nth(1)).toHaveText("2");
    await expect(line.locator("td").nth(2)).toHaveText("3.900.000 đ");
    await expect(line.locator("td").nth(4)).toHaveText("7.800.000 đ");

    await detail.getByRole("button", { name: "In Hoá Đơn" }).click();
    const sheetLine = page.locator(".pq-dialog--preview:visible .pq-sheet tbody tr").first();
    await expect(sheetLine.locator("td")).toHaveText([/.+/, "2", "3.900.000 đ", "0 đ", "7.800.000 đ"]);
  });

  test("an emptied Số điện thoại 2 clears it, and the letterhead prints the first line alone", async ({ page }) => {
    await putBranch(page, fullUpdate(await readBranch(page), { phoneNumber: FIRST, secondaryPhoneNumber: SECOND }));
    await openClinicInfo(page);
    await expect(page.getByLabel("Số điện thoại 2")).toHaveValue(SECOND);
    await page.getByLabel("Số điện thoại 2").fill("");
    const saved = await saveClinicInfo(page);
    expect(saved.status).toBe(200);
    expect(saved.sent.secondaryPhoneNumber).toBe("");
    expect(saved.body.secondaryPhoneNumber).toBeNull();

    await page.reload();
    await expect(page.getByLabel("Tên chi nhánh")).not.toHaveValue("", { timeout: 20_000 });
    await expect(page.getByLabel("Số điện thoại 2")).toHaveValue("");

    await expect(await quoteLetterheadPhone(page)).toHaveText("ĐT: 0779 160 888");
  });

  test("a malformed Số điện thoại 2 is refused under the field and nothing is sent", async ({ page }) => {
    await openClinicInfo(page);
    let sent = 0;
    page.on("request", (r) => {
      if (r.url().includes(`${BRANCHES}/${BRANCH}`) && r.method() === "PUT") sent += 1;
    });
    const field = page.getByLabel("Số điện thoại 2");
    const item = page.locator(".ant-form-item").filter({ has: field });
    for (const bad of ["12345", "0767 080 333", "1767080333", "07670803334x"]) {
      await field.fill(bad);
      await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();
      await expect(item.locator(".ant-form-item-explain-error")).toHaveText("Số điện thoại không hợp lệ");
    }
    // An 11-digit line is a real number and passes the form.
    await field.fill("07670803334");
    await expect(item.locator(".ant-form-item-explain-error")).toHaveCount(0);
    expect(sent).toBe(0);
  });

  test("the server refuses a malformed or overlong number and keeps the one on file", async ({ page }) => {
    await page.goto("/patient");
    const before = await putBranch(page, fullUpdate(await readBranch(page), { secondaryPhoneNumber: SECOND }));
    expect(before.status).toBe(200);

    for (const bad of ["abc", "12345", "0767-080-333"]) {
      const refused = await putBranch(page, fullUpdate(await readBranch(page), { secondaryPhoneNumber: bad }));
      expect(refused.status, bad).toBe(403);
      expect(refused.body.error?.code, bad).toBe(INVALID_PHONE);
    }
    const overlong = await putBranch(page, fullUpdate(await readBranch(page), { secondaryPhoneNumber: "0".repeat(21) }));
    expect(overlong.status).toBe(400);

    expect((await readBranch(page)).secondaryPhoneNumber).toBe(SECOND);

    // Spaces around a good number are trimmed, not refused.
    const trimmed = await putBranch(page, fullUpdate(await readBranch(page), { secondaryPhoneNumber: `  ${SECOND}  ` }));
    expect(trimmed.status).toBe(200);
    expect(trimmed.body.secondaryPhoneNumber).toBe(SECOND);
  });

  test("saves that do not carry Số điện thoại 2 — the branch dialog, Thông tin cá nhân — leave it alone", async ({ page }) => {
    await page.goto("/patient");
    await putBranch(page, fullUpdate(await readBranch(page), { secondaryPhoneNumber: SECOND }));

    // The shape Thông tin cá nhân sends: name, phone, email, address — no second line.
    const branch = await readBranch(page);
    const personal = await putBranch(page, {
      name: branch.name,
      phoneNumber: FIRST,
      email: branch.email,
      address: branch.address,
      provinceId: branch.provinceId,
      wardId: branch.wardId,
    });
    expect(personal.status).toBe(200);
    expect(personal.body.secondaryPhoneNumber).toBe(SECOND);

    // The branch dialog (Danh sách chi nhánh → sửa) saves without it too.
    await page.goto(`/settings?tab=branches&branchId=${BRANCH}`);
    const row = page.locator("tbody tr.ant-table-row").filter({ hasText: branch.code }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`${BRANCHES}/${BRANCH}`) && r.request().method() === "PUT"),
      dialog.getByRole("button", { name: "Lưu" }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).not.toHaveProperty("secondaryPhoneNumber");
    expect(((await response.json()) as Branch).secondaryPhoneNumber).toBe(SECOND);
    expect((await readBranch(page)).secondaryPhoneNumber).toBe(SECOND);
  });
});
