import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call, ENTRIES, TAXONOMIES } from "./fixtures/catalogApi";

/**
 * R-744 (QA dòng 6): a patient who declared "Dị ứng thuốc kháng sinh" in
 * Tiểu sử bệnh is prescribed a medicine of the antibiotic group. The dialog
 * warns as soon as the medicine is picked and asks again on Lưu; "Không"
 * keeps the slip unsaved, "Vẫn lưu" saves it. A medicine of another group
 * raises nothing.
 *
 * Real stack only: the allergy, the medicine groups and the patient are made
 * through the real API, the slip through the real dialog.
 */

const PRESCRIPTIONS_API = "/api/v1/app/prescriptions";
const PATIENTS_API = "/api/v1/app/patients";

interface Seed {
  patientId: string;
  antibiotic: string;
  painkiller: string;
  allergy: string;
}

async function catalogEntry(page: Page, group: string, groupName: string, name: string): Promise<string> {
  const taxonomy = await call<{ id: string }>(page, "POST", TAXONOMIES, {
    clinicBranchId: BRANCH_ONE,
    group,
    name: groupName,
  });
  expect(taxonomy.status, JSON.stringify(taxonomy.body)).toBe(200);
  const entry = await call<{ id: string }>(page, "POST", ENTRIES, {
    clinicBranchId: BRANCH_ONE,
    taxonomyId: taxonomy.body.id,
    name,
  });
  expect(entry.status, JSON.stringify(entry.body)).toBe(200);
  return entry.body.id;
}

async function seed(page: Page, id: string): Promise<Seed> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, PATIENTS_API);

  const allergy = `Dị ứng thuốc kháng sinh ${id}`;
  const allergyId = await catalogEntry(page, "disease_history", `Nhóm Dị Ứng ${id}`, allergy);
  const antibiotic = `Klamentin 625mg ${id}`;
  await catalogEntry(page, "medication_type", `Nhóm Kháng Sinh ${id}`, antibiotic);
  const painkiller = `Paracetamol 500mg ${id}`;
  await catalogEntry(page, "medication_type", `Nhóm Giảm Đau ${id}`, painkiller);

  const patient = await call<{ id: string }>(page, "POST", PATIENTS_API, {
    firstName: `Dị ứng ${id}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `07${id.padStart(8, "0").slice(-8)}`,
    diseaseHistoryEntryIds: [allergyId],
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);
  return { patientId: patient.body.id, antibiotic, painkiller, allergy };
}

async function pickOption(page: Page, text: string) {
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: text }).first().click();
}

/** Opens "Tạo đơn thuốc" on the patient's Đơn thuốc tab with a doctor picked. */
async function openDialog(page: Page, patientId: string): Promise<Locator> {
  await page.goto(`/patient/${patientId}?tab=prescription`);
  await assertRealApiTraffic(page, PRESCRIPTIONS_API);
  await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Thêm đơn thuốc" });
  await dialog.getByLabel("Chọn bác sĩ").click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  return dialog;
}

async function pickMedicine(page: Page, dialog: Locator, name: string) {
  await dialog.getByLabel("Tên thuốc", { exact: true }).fill(name);
  await pickOption(page, name);
}

function posted(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes(PRESCRIPTIONS_API) && res.request().method() === "POST",
  );
}

test("a medicine of a group the patient is allergic to is warned on pick and confirmed on save", async ({ page }) => {
  const id = runId();
  await login(page);
  const data = await seed(page, id);

  const dialog = await openDialog(page, data.patientId);
  await expect(dialog).toContainText(`Tiểu sử bệnh: ${data.allergy}`);
  await dialog.getByLabel("Nhập lời dặn").fill(`Dị ứng e2e ${id}`);

  // Picking the antibiotic raises the warning over the lines, naming the
  // medicine, its group and the allergy it falls under.
  const warning = dialog.getByRole("alert").filter({ hasText: "Cảnh báo dị ứng" });
  await expect(warning).toHaveCount(0);
  await pickMedicine(page, dialog, data.antibiotic);
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(data.antibiotic);
  await expect(warning).toContainText(`Nhóm Kháng Sinh ${id}`);
  await expect(warning).toContainText(data.allergy);

  // Lưu asks first; "Không" leaves the slip unsaved and the dialog open.
  let sent = false;
  page.on("request", (req) => {
    if (req.url().includes(PRESCRIPTIONS_API) && req.method() === "POST") sent = true;
  });
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Bạn vẫn muốn lưu đơn thuốc?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Không" }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  expect(sent).toBe(false);

  // "Vẫn lưu" saves it for real.
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  const created = posted(page);
  await confirm.getByRole("button", { name: "Vẫn lưu" }).click();
  const response = await created;
  expect(response.ok()).toBeTruthy();
  const { code } = (await response.json()) as { code: string };
  await expect(dialog).toBeHidden();

  // The list shows no advice column, so the saved slip is found by its code.
  await page.reload();
  await assertRealApiTraffic(page, PRESCRIPTIONS_API);
  await expect(page.getByRole("row", { name: new RegExp(code) })).toBeVisible();
});

test("a medicine of another group raises nothing and saves straight away", async ({ page }) => {
  const id = runId();
  await login(page);
  const data = await seed(page, id);

  const dialog = await openDialog(page, data.patientId);
  await dialog.getByLabel("Nhập lời dặn").fill(`Không dị ứng e2e ${id}`);
  await pickMedicine(page, dialog, data.painkiller);
  await expect(dialog.getByText("Cảnh báo dị ứng")).toHaveCount(0);

  const created = posted(page);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  const response = await created;
  expect(response.ok()).toBeTruthy();
  const { code } = (await response.json()) as { code: string };
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(code) })).toBeVisible();
});
