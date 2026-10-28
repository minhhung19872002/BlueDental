import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: several hồ sơ on one phone number — what the front desk sees
 * (BA P2710_02, F-82, R-1057).
 *
 * - "Tạo hồ sơ": a number on file shows an "N hồ sơ" badge and the holders'
 *   list under the box; "Người mới" asks "Là … của …" and Lưu waits for it.
 * - On the Bệnh nhân page a holder's row leaves for that hồ sơ; inside a flow
 *   (Lịch tạm) the row is the answer — no second hồ sơ — and "Mở hồ sơ" opens
 *   a new tab so the flow is kept.
 * - A guardian without a hồ sơ who answers on the number fills the form, and
 *   their guardian card then names the new hồ sơ.
 * - The Hồ sơ tab lists the others on the number and its + adds one, linked.
 * - The number is one however it is typed: beside +84 without its 0 or as
 *   84…, abroad with or without the trunk 0 or pasted with its +.
 *
 * Real stack: real login, real API, real PostgreSQL; set-up data goes through
 * the API from inside the logged-in page, everything else through the UI.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const PATIENTS = "/api/v1/app/patients";
const APPOINTMENTS = "/api/v1/app/appointments";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  guardians: { linkedPatientId?: string | null }[];
}

interface Appointment {
  id: string;
  patientId: string;
  isTemporary: boolean;
}

/** Two digits that differ for every number one run makes. */
let counter = 0;
const serial = () => String(counter++ % 100).padStart(2, "0");
const phoneOf = (id: string) => `09${id}${serial()}`;
const fullName = (p: Pick<Patient, "lastName" | "firstName">) => `${p.lastName} ${p.firstName}`;
/** "DH26 0012" — how the cards print a code. */
const spaced = (code: string) => code.replace(/^(\D+\d{2})(\d+)$/, "$1 $2");

async function registered(page: Page, json: Record<string, unknown>, branchId = BRANCH_ONE): Promise<Patient> {
  const res = await call<Patient>(page, PATIENTS, { method: "POST", json: { gender: 1, ...json }, branchId });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function ownersOf(page: Page, phone: string, branchId = BRANCH_ONE): Promise<string[]> {
  const res = await call<{ owners?: { id: string }[] }>(page, `${PATIENTS}/check-phone?phone=${phone}`, { branchId });
  return (res.body.owners ?? []).map((o) => o.id);
}

async function openCreate(page: Page): Promise<Locator> {
  await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const nameBox = (dialog: Locator) => dialog.getByRole("textbox", { name: "Họ và tên *" });
const phoneBox = (dialog: Locator) => dialog.getByRole("textbox", { name: "Điện thoại *" });
const holdersIn = (dialog: Locator) => dialog.getByRole("region", { name: "Những người đang dùng số điện thoại này" });
const holderRow = (holders: Locator, name: string) => holders.locator(".bd-holder", { hasText: name });

async function pickRelation(page: Page, dialog: Locator, label: string) {
  await dialog.getByRole("combobox", { name: "Quan hệ" }).click();
  await page
    .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", {
      hasText: new RegExp(`^${label}$`),
    })
    .click();
}

/** Clicks Lưu and returns the hồ sơ the server made. */
async function saveNew(page: Page, dialog: Locator): Promise<Patient> {
  const response = page.waitForResponse((r) => r.url().endsWith(PATIENTS) && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const res = await response;
  expect(res.status(), await res.text()).toBe(200);
  await expect(dialog).toBeHidden();
  return (await res.json()) as Patient;
}

const profileTab = (patientId: string) => `/patient/${patientId}?branchId=${BRANCH_ONE}&tab=profile`;
const sharedSection = (page: Page) => page.getByRole("region", { name: "Người dùng chung SĐT", exact: true });

test.describe("Several hồ sơ on one phone — the UI", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a new person on a held number is linked first, and both Hồ sơ tabs list each other", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, {
      firstName: `An${id}`,
      lastName: "Chung Số Ui",
      phoneNumber: phone,
      dateOfBirth: "1980-04-12",
    });

    const dialog = await openCreate(page);
    const save = dialog.getByRole("button", { name: "Lưu" });
    await nameBox(dialog).fill(`Chung Số Ui Bình${id}`);
    await phoneBox(dialog).fill(phone);
    await expect(dialog.getByRole("button", { name: "1 hồ sơ", exact: true })).toBeVisible({ timeout: 15_000 });
    const holders = holdersIn(dialog);
    await expect(holderRow(holders, fullName(owner))).toContainText("Chủ số");
    await expect(holderRow(holders, fullName(owner))).toContainText(spaced(owner.patientCode));

    // "Người mới": the list shuts, the link block opens on the owner, Lưu waits for "Là …".
    await holders.getByRole("button", { name: "Người mới, dùng chung số này" }).click();
    await expect(holders).toBeHidden();
    const linkBlock = dialog.locator(".bd-phone-link");
    await expect(linkBlock).toContainText("Liên kết người dùng chung SĐT");
    await expect(linkBlock).toContainText(`của ${fullName(owner)}`);
    await expect(linkBlock).toContainText("Chọn quan hệ để lưu.");
    await expect(save).toBeDisabled();
    await pickRelation(page, dialog, "Vợ/Chồng");
    await expect(save).toBeEnabled();
    const spouse = await saveNew(page, dialog);
    expect(spouse.phoneNumber).toBe(phone);
    expect(await ownersOf(page, phone)).toEqual([owner.id, spouse.id]);

    // The owner's Hồ sơ tab lists the spouse with the relation; the chevron opens them.
    await page.goto(profileTab(owner.id));
    const section = sharedSection(page);
    await expect(section.locator(".pd-guardians-count")).toHaveText("1");
    const spouseCard = section.locator("li", { hasText: fullName(spouse) });
    await expect(spouseCard).toContainText(`Vợ/Chồng của An${id}`);
    await expect(spouseCard).toContainText(spaced(spouse.patientCode));
    await expect(section).toContainText("Tổng dư nợ cả nhóm:");
    await spouseCard.getByRole("button", { name: `Mở hồ sơ ${fullName(spouse)}` }).click();
    await expect(page).toHaveURL(new RegExp(`/patient/${spouse.id}`));

    // From the spouse's side the owner is "Chủ số", and a reload reads the same.
    await page.goto(profileTab(spouse.id));
    await page.reload();
    const back = sharedSection(page);
    await expect(back.locator(".pd-guardians-count")).toHaveText("1");
    await expect(back.locator("li", { hasText: fullName(owner) })).toContainText("Chủ số");
  });

  test("the Hồ sơ tab's + opens Tạo hồ sơ on the number, already linked to that record", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, {
      firstName: `Cường${id}`,
      lastName: "Chung Số Ui",
      phoneNumber: phone,
      dateOfBirth: "1975-01-20",
    });

    await page.goto(profileTab(owner.id));
    const section = sharedSection(page);
    await expect(section.locator(".pd-guardians-count")).toHaveText("0");
    await expect(section).toContainText("Chưa có hồ sơ nào khác dùng số này.");
    await section.getByRole("button", { name: "Thêm người dùng chung số điện thoại" }).click();

    // The number is in, its list stays shut (the record is known), and "của …" is this record.
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(phoneBox(dialog)).toHaveValue(phone);
    await expect(dialog.getByRole("button", { name: "1 hồ sơ", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(holdersIn(dialog)).toHaveCount(0);
    const linkBlock = dialog.locator(".bd-phone-link");
    await expect(linkBlock).toContainText(`của ${fullName(owner)}`);
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled();

    // The badge still opens the list on demand; Esc shuts the list, not the dialog.
    await dialog.getByRole("button", { name: "1 hồ sơ", exact: true }).click();
    await expect(holderRow(holdersIn(dialog), fullName(owner))).toContainText("Chủ số");
    await page.keyboard.press("Escape");
    await expect(holdersIn(dialog)).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await nameBox(dialog).fill(`Chung Số Ui Dũng${id}`);
    await pickRelation(page, dialog, "Con");
    const child = await saveNew(page, dialog);

    await expect(section.locator(".pd-guardians-count")).toHaveText("1");
    await expect(section.locator("li", { hasText: fullName(child) })).toContainText(`Con của Cường${id}`);
    await page.reload();
    await expect(sharedSection(page).locator(".pd-guardians-count")).toHaveText("1");
  });

  test("on the Bệnh nhân page a holder's row and Mở hồ sơ both leave for that hồ sơ", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, { firstName: `Giang${id}`, lastName: "Chung Số Ui", phoneNumber: phone });

    let dialog = await openCreate(page);
    await phoneBox(dialog).fill(phone);
    await holderRow(holdersIn(dialog), fullName(owner)).getByRole("button", { name: /Mở hồ sơ/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/patient/${owner.id}`));

    await page.goto("/patient");
    dialog = await openCreate(page);
    await phoneBox(dialog).fill(phone);
    await holderRow(holdersIn(dialog), fullName(owner)).locator(".bd-holder-main").click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/patient/${owner.id}`));
    expect(await ownersOf(page, phone)).toEqual([owner.id]);
  });

  test("a Lịch tạm on a held number takes that hồ sơ from its row, without a second one", async ({ page }) => {
    const request = page.waitForRequest(
      (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
    );
    await page.goto("/reception");
    const branchId = (await request).headers()["x-clinic-branch-id"];
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(
      page,
      { firstName: `Hạnh${id}`, lastName: "Chung Số Ui", phoneNumber: phone, dateOfBirth: "1985-08-08" },
      branchId,
    );

    const start = new Date(Date.now() + 45 * 60_000);
    start.setSeconds(0, 0);
    test.skip(start.getDate() !== new Date().getDate(), "too close to midnight to book for today");
    const walkIn = `E2E TAM CHUNG ${id}`;
    const temp = await call<Appointment>(page, `${APPOINTMENTS}/temp`, {
      method: "POST",
      json: { patientName: walkIn, patientPhone: phone, branchId, slotStart: start, slotEnd: new Date(start.getTime() + 15 * 60_000) },
      branchId,
    });
    expect(temp.status, JSON.stringify(temp.body)).toBe(200);

    const searched = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok());
    await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(walkIn);
    await searched;
    const card = page.locator(".rc-wrapper", { hasText: walkIn });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await card.getByRole("button", { name: walkIn }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(phoneBox(dialog)).toHaveValue(phone);
    const row = holderRow(holdersIn(dialog), fullName(owner));
    await expect(row).toContainText("Chủ số", { timeout: 15_000 });

    // "Mở hồ sơ" opens a new tab; the booking's dialog stays where it was.
    const opened = page.context().waitForEvent("page");
    await row.getByRole("button", { name: /Mở hồ sơ/ }).click();
    const tab = await opened;
    await expect(tab).toHaveURL(new RegExp(`/patient/${owner.id}`));
    await tab.close();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/reception/);

    // The row itself is the answer: the Lịch tạm takes the existing hồ sơ.
    const attached = page.waitForResponse(
      (r) => r.url().endsWith(`${APPOINTMENTS}/${temp.body.id}/attach-patient`) && r.request().method() === "POST",
    );
    await row.locator(".bd-holder-main").click();
    const attach = await attached;
    expect(attach.status()).toBe(200);
    expect(attach.request().postDataJSON()).toMatchObject({ patientId: owner.id });
    await expect(dialog).toBeHidden();

    const stored = await call<Appointment>(page, `${APPOINTMENTS}/${temp.body.id}`, { branchId });
    expect(stored.body.isTemporary).toBe(false);
    expect(stored.body.patientId).toBe(owner.id);
    expect(await ownersOf(page, phone, branchId)).toEqual([owner.id]);
  });

  test("a guardian on the number fills the form, and their card then opens the new hồ sơ", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const motherPhone = phoneOf(id);
    const nationalId = `0792${id}${serial()}`;
    const motherName = `Chung Số Ui Mẹ${id}`;
    const child = await registered(page, {
      firstName: `Khôi${id}`,
      lastName: "Chung Số Ui",
      phoneNumber: phoneOf(id),
      dateOfBirth: `${new Date().getFullYear() - 8}-05-05`,
      guardiansConsented: true,
      guardians: [
        {
          relation: 2,
          fullName: motherName,
          phone: motherPhone,
          nationalId,
          dateOfBirth: "1990-03-03",
          gender: 2,
          sameAddressAsPatient: true,
          isPrimaryContact: true,
        },
      ],
    });

    const dialog = await openCreate(page);
    await phoneBox(dialog).fill(motherPhone);
    await expect(dialog.getByRole("button", { name: "1 giám hộ", exact: true })).toBeVisible({ timeout: 15_000 });
    const row = holderRow(holdersIn(dialog), motherName);
    await expect(row).toContainText(`Người giám hộ của Khôi${id}`);
    await expect(row).toContainText("Chưa có hồ sơ");

    await row.locator(".bd-holder-main").click();
    await expect(holdersIn(dialog)).toHaveCount(0);
    await expect(nameBox(dialog)).toHaveValue(motherName);
    await expect(dialog.getByRole("textbox", { name: /^CCCD/ })).toHaveValue(nationalId);
    // Only a guardian is on the number: nothing to link, Lưu is free.
    await expect(dialog.locator(".bd-phone-link")).toHaveCount(0);
    const mother = await saveNew(page, dialog);

    const reread = await call<Patient>(page, `${PATIENTS}/${child.id}`, { branchId: BRANCH_ONE });
    expect(reread.body.guardians[0].linkedPatientId).toBe(mother.id);

    await page.goto(profileTab(child.id));
    const card = page.getByRole("region", { name: "Người giám hộ", exact: true }).locator("article.pd-guardian");
    await expect(card).toContainText(spaced(mother.patientCode));
    await card.getByRole("button", { name: `Mở hồ sơ ${motherName}` }).click();
    await expect(page).toHaveURL(new RegExp(`/patient/${mother.id}`));
  });

  test("one number however it is typed: without its 0, as 84…, and abroad with or without its trunk 0", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const phone = phoneOf(id);
    const bare = phone.slice(1);
    const motherPhone = phoneOf(id);
    const national = `4${id}${serial()}`;
    await registered(page, { firstName: `Gốc${id}`, lastName: "Chung Số Ui", phoneNumber: phone });
    await registered(page, { firstName: `Khách${id}`, lastName: "Chung Số Ui", phoneNumber: `+61${national}` });
    await registered(page, {
      firstName: `Bé${id}`,
      lastName: "Chung Số Ui",
      phoneNumber: phoneOf(id),
      dateOfBirth: `${new Date().getFullYear() - 8}-05-05`,
      guardiansConsented: true,
      guardians: [
        {
          relation: 2,
          fullName: `Chung Số Ui Mẹ${id}`,
          phone: motherPhone,
          nationalId: `0792${id}${serial()}`,
          dateOfBirth: "1990-03-03",
          gender: 2,
          sameAddressAsPatient: true,
          isPrimaryContact: true,
        },
      ],
    });

    const dialog = await openCreate(page);
    const box = phoneBox(dialog);
    const oneRecord = dialog.getByRole("button", { name: "1 hồ sơ", exact: true });

    // Beside +84 the 0 may be left out, or 84 typed in front: the same hồ sơ, the same guardian.
    await box.fill(bare);
    await expect(oneRecord).toBeVisible({ timeout: 15_000 });
    await expect(box).toHaveValue(bare);
    await box.fill(`84${bare}`);
    await expect(box).toHaveValue(phone);
    await expect(oneRecord).toBeVisible();
    await box.fill(motherPhone.slice(1));
    await expect(dialog.getByRole("button", { name: "1 giám hộ", exact: true })).toBeVisible({ timeout: 15_000 });

    // Under Úc the trunk 0 is dropped and a pasted +61 picks the country: one holder each time.
    await box.fill("");
    await pickCountry(page, dialog, "Úc");
    for (const typed of [`0${national}`, national, `+61${national}`]) {
      await box.fill("");
      await expect(oneRecord).toHaveCount(0);
      await box.fill(typed);
      await expect(box, typed).toHaveValue(national);
      await expect(oneRecord, typed).toBeVisible({ timeout: 15_000 });
    }
  });
});

async function pickCountry(page: Page, scope: Locator, name: string) {
  await scope.getByRole("combobox", { name: "Mã vùng quốc gia" }).click();
  await page.keyboard.type(name);
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: name }).first().click();
  await expect(page.locator(".ant-select-dropdown:visible")).toHaveCount(0);
}
