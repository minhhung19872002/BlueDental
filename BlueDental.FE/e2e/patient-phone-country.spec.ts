import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: country calling code on phone fields (owner request 2026-10-13).
 *
 * The phone box of Tạo/Sửa hồ sơ, Người giám hộ and Lịch hẹn tạm carries a
 * flag + calling code picked from a searchable list. Vietnamese numbers keep
 * their national form ("0901234567"); a foreign one is stored E.164
 * ("+14155550123"). The trunk 0 typed after a foreign code is dropped, a
 * pasted "+…" picks its own country, and the server refuses a number that is
 * neither (BlueDental:Patient:0023) while it normalises spellings such as
 * "+84 90…" or "0082 10-…".
 *
 * Real login, real API, real database; nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";
const APPOINTMENTS = "/api/v1/app/appointments";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

interface Body {
  id?: string;
  phoneNumber?: string;
  patientPhone?: string;
  guardians?: { phone: string }[];
  error?: { code?: string };
}

/** One request from the logged-in page: cookie session + antiforgery header. */
async function call(page: Page, method: "GET" | "POST" | "PUT", url: string, json?: unknown) {
  return page.evaluate(
    async ({ method, url, json, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        "X-Clinic-Branch-Id": branch,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      if (json !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as Body };
    },
    { method, url, json, branch: BRANCH_ONE },
  );
}

/** Opens the country list of a phone field and picks the country by name. */
async function pickCountry(page: Page, scope: Locator, name: string) {
  await scope.getByRole("combobox", { name: "Mã vùng quốc gia" }).click();
  await page.keyboard.type(name);
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: name }).first().click();
  await expect(page.locator(".ant-select-dropdown:visible")).toHaveCount(0);
}

const country = (scope: Locator) => scope.locator(".phone-input-country .phone-input-selected");
const SAVE = /^(save )?Lưu$/;

test.describe("phone with country calling code", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a hồ sơ saves a foreign number as E.164 and reads it back by its flag", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const editor = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    const id = runId();
    const name = `E2E ${id} Quốc Tế`;
    await editor.getByRole("textbox", { name: /^Họ và tên/ }).fill(name);

    // Vietnam is the default: a national number is kept as typed.
    const phoneField = editor.locator(".phone-input").first();
    await expect(country(phoneField)).toHaveText("+84");
    await expect(phoneField.locator(".fi-vn")).toBeVisible();

    // Under Hoa Kỳ the trunk 0 is dropped as it is typed.
    await pickCountry(page, phoneField, "Hoa Kỳ");
    await expect(country(phoneField)).toHaveText("+1");
    const number = editor.getByRole("textbox", { name: /^Điện thoại/ });
    const local = `0415${id.slice(-6)}0`.slice(0, 11);
    await number.fill(local);
    await expect(number).toHaveValue(local.slice(1));
    await phoneField.screenshot({ path: "test-results/phone-country-patient.png" });

    const [saved] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(PATIENTS) && r.request().method() === "POST"),
      editor.getByRole("button", { name: SAVE }).click(),
    ]);
    expect(saved.status()).toBe(200);
    const patient = (await saved.json()) as Body;
    expect(patient.phoneNumber).toBe(`+1${local.slice(1)}`);
    await expect(editor).toBeHidden({ timeout: 15_000 });

    // A separate request reads the stored value…
    const stored = await call(page, "GET", `${PATIENTS}/${patient.id}`);
    expect(stored.body.phoneNumber).toBe(`+1${local.slice(1)}`);

    // …and after a reload the edit dialog splits it back into flag and number.
    await page.goto(`/patient/${patient.id}?tab=profile`);
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
    const edit = page.getByRole("dialog");
    const editPhone = edit.locator(".phone-input").first();
    await expect(country(editPhone)).toHaveText("+1");
    await expect(editPhone.locator(".fi-us")).toBeVisible();
    await expect(edit.getByLabel(/Điện thoại/).first()).toHaveValue(local.slice(1));

    // Pasting a full +44 number switches the flag by itself; Lưu stores it.
    await edit.getByLabel(/Điện thoại/).first().fill(`+44 20 7946 ${id.slice(-4)}`);
    await expect(country(editPhone)).toHaveText("+44");
    await expect(edit.getByLabel(/Điện thoại/).first()).toHaveValue(`207946${id.slice(-4)}`);
    const [updated] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`${PATIENTS}/${patient.id}`) && r.request().method() === "PUT"),
      edit.getByRole("button", { name: SAVE }).click(),
    ]);
    expect(updated.status()).toBe(200);
    expect((await call(page, "GET", `${PATIENTS}/${patient.id}`)).body.phoneNumber).toBe(`+44207946${id.slice(-4)}`);
  });

  test("the server normalises spellings and refuses a number that is neither form", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const body = (phoneNumber: string, suffix: string) => ({
      firstName: suffix,
      lastName: `E2E ${id} Phone`,
      gender: 1,
      phoneNumber,
      dateOfBirth: "1990-01-01",
    });

    // "+84 9…" is a Vietnamese number: stored national with its 0.
    const vn = await call(page, "POST", PATIENTS, body(`+84 93 ${id} 1`, "VN"));
    expect(vn.status, JSON.stringify(vn.body)).toBe(200);
    expect(vn.body.phoneNumber).toBe(`093${id}1`);

    // "0082 10-…" is Korea: stored E.164.
    const kr = await call(page, "POST", PATIENTS, body(`0082 10-${id.slice(0, 4)}-${id.slice(-4)}`, "KR"));
    expect(kr.status, JSON.stringify(kr.body)).toBe(200);
    expect(kr.body.phoneNumber).toBe(`+8210${id.slice(0, 4)}${id.slice(-4)}`);

    // Letters, a lone "+" code, or too few digits: 0023.
    for (const bad of ["09ab123456", "+0123456789", "12345"]) {
      const refused = await call(page, "POST", PATIENTS, body(bad, "Bad"));
      expect(refused.status, bad).toBe(403);
      expect(refused.body.error?.code, bad).toBe("BlueDental:Patient:0023");
    }
  });

  test("a guardian's phone takes a country too", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const child = await call(page, "POST", PATIENTS, {
      firstName: "Con",
      lastName: `E2E ${id} GH`,
      gender: 1,
      phoneNumber: `09${id}55`,
      dateOfBirth: `${new Date().getFullYear() - 8}-05-05`,
      guardians: [
        {
          relation: 2,
          fullName: `Mẹ E2E ${id}`,
          phone: `+61 412 ${id}`,
          nationalId: `0792${id}44`,
          idIssuedPlace: "Cục CS QLHC về TTXH",
          sameAddressAsPatient: true,
          isPrimaryContact: true,
        },
      ],
      guardiansConsented: true,
    });
    expect(child.status, JSON.stringify(child.body)).toBe(200);
    expect(child.body.guardians?.[0].phone).toBe(`+61412${id}`);

    // The guardian popup shows it under the Úc flag.
    await page.goto(`/patient/${child.body.id}?tab=profile`);
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
    const editor = page.getByRole("dialog");
    await editor.getByRole("tab", { name: /Người giám hộ/ }).click();
    await editor.locator(".bd-guardian-card").first().getByRole("button", { name: "Sửa" }).click();
    const popup = page.getByRole("dialog", { name: /Thông tin người giám hộ/ });
    const phoneField = popup.locator(".phone-input").first();
    await expect(country(phoneField)).toHaveText("+61");
    await expect(phoneField.locator(".fi-au")).toBeVisible();
    await expect(phoneField.getByRole("textbox")).toHaveValue(`412${id}`);
    await phoneField.screenshot({ path: "test-results/phone-country-guardian.png" });
  });

  test("Lịch hẹn tạm composes a foreign number, refuses a bad one, and the server stores E.164", async ({ page }) => {
    await page.goto("/calendar");
    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    await expect(dialog).toBeVisible();

    const phoneField = dialog.locator(".phone-input");
    await pickCountry(page, phoneField, "Hàn Quốc");
    await expect(country(phoneField)).toHaveText("+82");
    const box = phoneField.getByRole("textbox");
    await box.fill("010-1234-5678");
    await expect(box).toHaveValue("1012345678");
    // Same height as the other boxes of the form.
    const heights = await dialog.locator(".appt-field .ant-input").evaluateAll((els) =>
      els.slice(0, 2).map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    expect(heights).toEqual([40, 40]);
    await dialog.screenshot({ path: "test-results/phone-country-temp.png" });

    // Through the API: a foreign spelling is normalised, a bad one refused.
    const start = new Date(Date.now() + 26 * 3600_000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 15 * 60_000);
    const temp = await call(page, "POST", `${APPOINTMENTS}/temp`, {
      patientName: `E2E TAM ${runId()}`,
      patientPhone: "+82 10-1234-5678",
      branchId: BRANCH_ONE,
      slotStart: start,
      slotEnd: end,
    });
    expect(temp.status, JSON.stringify(temp.body)).toBe(200);
    expect(temp.body.patientPhone).toBe("+821012345678");
    expect((await call(page, "GET", `${APPOINTMENTS}/${temp.body.id}`)).body.patientPhone).toBe("+821012345678");

    const refused = await call(page, "POST", `${APPOINTMENTS}/temp`, {
      patientName: `E2E TAM ${runId()}`,
      patientPhone: "+82",
      branchId: BRANCH_ONE,
      slotStart: start,
      slotEnd: end,
    });
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe("BlueDental:Patient:0023");
  });
});
