import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Patient pickers outside the booking dialog (R-759, R-762).
 *
 * Every picker pages patients in from the server — the most recent ones, or
 * the hits for what was typed — 30 at a time as the list is scrolled. A patient picked from a search used to vanish
 * from the options once the keyword moved on, and the picker then showed a raw
 * id (AntD) or went blank (SearchSelect). Real stack, nothing intercepted.
 */

interface OlderPatient {
  code: string;
  name: string;
}

/** AntD's role="option" nodes are hidden a11y mirrors; click the painted row. */
const antdOption = (page: Page, text: RegExp) =>
  page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: text });

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A patient from the list's last page, so it is not among the most recent. */
async function findOlderPatient(page: Page): Promise<OlderPatient> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const names = page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name");
  await expect(names.first()).toBeVisible();
  const lastPage = page.locator(".bd-patient-tablecard .ant-pagination-item").last();
  if (!(await lastPage.getAttribute("class"))?.includes("ant-pagination-item-active")) {
    const loaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/patients") && res.request().method() === "GET",
    );
    await lastPage.click();
    await loaded;
  }
  // The cell reads "[CODE] – Name".
  const cell = (await names.last().innerText()).trim();
  const code = /\[([^\]]+)\]/.exec(cell)?.[1] ?? "";
  const name = cell.split(/\s[–-]\s/).pop()!.trim();
  expect(code).not.toBe("");
  return { code, name };
}

test.describe("Patient pickers keep the picked patient", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Tiếp nhận: a searched patient survives a new keyword, name and phone intact", async ({ page }) => {
    const patient = await findOlderPatient(page);
    const nameMatch = new RegExp(escapeRegExp(patient.name), "i");

    await page.goto("/reception");
    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
    const dialog = page.getByRole("dialog");
    const picker = dialog.locator(".ant-select").first();

    await picker.click();
    await page.keyboard.type(patient.code);
    await antdOption(page, nameMatch).click();
    await expect(picker).toContainText(nameMatch);

    // Search again, find nothing, walk away: the pick must still read as a name.
    await picker.click();
    await page.keyboard.type(`khong-co-${runId()}`);
    await dialog.locator(".ant-modal-title").click();
    await expect(picker).toContainText(nameMatch);
    await expect(picker).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);

    // The save reads name and phone off the picked option; the phone line shows it is still there.
    await expect(dialog.getByText(/Số điện thoại:\s*\d{9,}/)).toBeVisible();
  });

  test("CSKH Tạo công việc mới: a searched patient stays shown after the box closes", async ({ page }) => {
    const patient = await findOlderPatient(page);
    const nameMatch = new RegExp(escapeRegExp(patient.name), "i");

    await page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.getByRole("button", { name: "Tạo mới" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo công việc mới" });
    const picker = dialog.locator(".cskh-message-field").filter({ hasText: "Chọn khách hàng" }).getByRole("combobox");

    // The code is not in the "Name (CODE)" label's first page — only the server finds it.
    await picker.click();
    const dropdown = page.locator("#ss-portal-dropdown");
    await dropdown.getByRole("textbox").fill(patient.code);
    await dropdown.getByRole("option", { name: nameMatch }).click();
    await expect(picker).toContainText(nameMatch);

    // Reopened, the list is the recent page again — and the pick is still on it.
    await picker.click();
    await expect(dropdown.getByRole("textbox")).toHaveValue("");
    await expect(dropdown.getByRole("option", { name: nameMatch })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(picker).toContainText(nameMatch);
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeEnabled();
  });

  test("Mẫu Labo: the customer filter keeps its patient after another search", async ({ page }) => {
    const patient = await findOlderPatient(page);
    const nameMatch = new RegExp(escapeRegExp(patient.name), "i");

    await page.goto("/labo/mau-labo");
    const picker = page.locator(".bd-labo-picker").first();
    await picker.click();
    await page.keyboard.type(patient.code);
    await antdOption(page, nameMatch).click();
    await expect(picker).toContainText(nameMatch);

    await picker.click();
    await page.keyboard.type(`khong-co-${runId()}`);
    await page.keyboard.press("Escape");
    await expect(picker).toContainText(nameMatch);
    await expect(picker).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

/** The picker's second page of patients — it starts where the first 30 end. */
const isSecondPage = (res: Response) =>
  res.url().includes("/api/v1/app/patients?") &&
  res.request().method() === "GET" &&
  new URL(res.url()).searchParams.get("skipCount") === "30";

interface PatientPage {
  items: { patientCode: string }[];
}

/** Wheels `list` down until the next page is asked for — no further — and returns its rows. */
async function scrollForNextPage(page: Page, list: Locator): Promise<PatientPage> {
  let landed: Response | undefined;
  const nextPage = page.waitForResponse(isSecondPage).then((res) => (landed = res));
  await list.hover();
  for (let i = 0; i < 20 && !landed; i += 1) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(150);
  }
  const res = await nextPage;
  expect(res.status()).toBe(200);
  return (await res.json()) as PatientPage;
}

/** The new page joins under the old rows: a little more wheel brings its first patient into view. */
async function expectAntdRowAfterScroll(page: Page, code: string) {
  const row = antdOption(page, new RegExp(escapeRegExp(`[${code}]`)));
  await expect(async () => {
    await page.mouse.wheel(0, 100);
    await expect(row).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

test.describe("Patient pickers page in more patients as they scroll (R-762)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("CSKH Tạo công việc mới: scrolling past 30 patients loads the next page", async ({ page }) => {
    await page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.getByRole("button", { name: "Tạo mới" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo công việc mới" });
    await dialog.locator(".cskh-message-field").filter({ hasText: "Chọn khách hàng" }).getByRole("combobox").click();

    const dropdown = page.locator("#ss-portal-dropdown");
    const options = dropdown.getByRole("option");
    await expect(options).toHaveCount(30);

    const second = await scrollForNextPage(page, dropdown.locator(".ss-options"));
    expect(second.items.length).toBeGreaterThan(0);
    // The wheel keeps going, so later pages may land too — at least this one has.
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(30 + second.items.length);
    const last = second.items[second.items.length - 1]!;
    await expect(options.filter({ hasText: last.patientCode })).toHaveCount(1);
  });

  test("Mẫu Labo: the customer filter loads the next page at the bottom of its list", async ({ page }) => {
    await page.goto("/labo/mau-labo");
    await page.locator(".bd-labo-picker").first().click();
    const holder = page.locator(".ant-select-dropdown:visible .ant-select-dropdown-list-holder");
    await expect(holder).toBeVisible();

    const second = await scrollForNextPage(page, holder);
    await expectAntdRowAfterScroll(page, second.items[0]!.patientCode);
  });

  test("Tiếp nhận: the customer picker loads the next page at the bottom of its list", async ({ page }) => {
    await page.goto("/reception");
    await page.getByRole("button", { name: "Tạo tiếp nhận" }).click();
    await page.getByRole("dialog").locator(".ant-select").first().click();
    const holder = page.locator(".ant-select-dropdown:visible .ant-select-dropdown-list-holder");
    await expect(holder).toBeVisible();

    const second = await scrollForNextPage(page, holder);
    await expectAntdRowAfterScroll(page, second.items[0]!.patientCode);
  });
});
