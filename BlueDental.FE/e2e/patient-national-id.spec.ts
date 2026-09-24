import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân → CCCD is unique inside a branch (R-564).
 *
 * The rule the server keeps on its own: two records in one clinic branch never
 * share a CCCD; the refusal names the record that already holds it. A person
 * seen at two branches holds a record at each, so the same CCCD is free in the
 * other branch.
 *
 * Every call is a real HTTP request from inside the logged-in page, with the
 * cookie the real login left and the antiforgery token the server set. Nothing
 * is intercepted, no token is injected, the database is the real one.
 */

const PATIENTS = "/api/v1/app/patients";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const DUPLICATE_CODE = "BlueDental:Patient:0012";

interface PatientBody {
  id: string;
  patientCode: string;
  nationalId: string | null;
  error?: { code?: string; message?: string };
}

interface ApiResult {
  status: number;
  body: PatientBody;
}

interface PatientInput {
  firstName: string;
  lastName: string;
  gender: number;
  phoneNumber: string;
  nationalId: string | null;
}

/** One JSON request from the logged-in page: cookie session + antiforgery header. */
async function sendJson(
  page: Page,
  method: "POST" | "PUT",
  url: string,
  payload: PatientInput,
  branchHeader?: string,
): Promise<ApiResult> {
  return page.evaluate(
    async ({ method, url, payload, branchHeader }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        "content-type": "application/json",
        ...(branchHeader ? { "X-Clinic-Branch-Id": branchHeader } : {}),
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let body: unknown = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      return { status: res.status, body: body as ApiResult["body"] };
    },
    { method, url, payload, branchHeader },
  );
}

/** A 12-digit CCCD that no earlier run used. */
function freshNationalId(id: string, tail: string): string {
  return `9${id}${tail}`.padEnd(12, "0").slice(0, 12);
}

function patient(id: string, tag: string, nationalId: string | null): PatientInput {
  return {
    firstName: `Cccd ${tag}`,
    lastName: `E2E ${id}`,
    gender: 1,
    phoneNumber: `09${id}${tag.length}0`.slice(0, 10),
    nationalId,
  };
}

test.describe("Patient CCCD uniqueness (real API)", () => {
  test("a second record with the same CCCD is refused without revealing the holder", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const id = runId();
    const cccd = freshNationalId(id, "01");

    const first = await sendJson(page, "POST", PATIENTS, patient(id, "A", cccd), BRANCH_ONE);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.nationalId).toBe(cccd);

    // Same branch, same CCCD → refused; the message must NOT reveal whose record it is.
    const second = await sendJson(page, "POST", PATIENTS, patient(id, "B", cccd), BRANCH_ONE);
    expect(second.status).toBe(403);
    expect(second.body.error?.code).toBe(DUPLICATE_CODE);
    expect(second.body.error?.message).not.toContain(first.body.patientCode);
    expect(second.body.error?.message).not.toContain(`Cccd A`);

    // Moving another record onto the taken CCCD is refused the same way...
    const other = await sendJson(page, "POST", PATIENTS, patient(id, "C", null), BRANCH_ONE);
    expect(other.status, JSON.stringify(other.body)).toBe(200);
    const moved = await sendJson(
      page,
      "PUT",
      `${PATIENTS}/${other.body.id}`,
      patient(id, "C", cccd),
      BRANCH_ONE,
    );
    expect(moved.status).toBe(403);
    expect(moved.body.error?.code).toBe(DUPLICATE_CODE);

    // ...while the holder may keep its own CCCD through an update.
    const kept = await sendJson(
      page,
      "PUT",
      `${PATIENTS}/${first.body.id}`,
      patient(id, "A", cccd),
      BRANCH_ONE,
    );
    expect(kept.status, JSON.stringify(kept.body)).toBe(200);
    expect(kept.body.nationalId).toBe(cccd);

    // Blank CCCDs never collide with each other.
    const blankOne = await sendJson(page, "POST", PATIENTS, patient(id, "D", null), BRANCH_ONE);
    const blankTwo = await sendJson(page, "POST", PATIENTS, patient(id, "E", ""), BRANCH_ONE);
    expect(blankOne.status).toBe(200);
    expect(blankTwo.status).toBe(200);
  });

  test("the same CCCD is free in another branch", async ({ browser }) => {
    const id = runId();
    const cccd = freshNationalId(id, "02");

    const adminPage = await browser.newPage();
    await login(adminPage);
    await adminPage.goto("/patient");
    const taken = await sendJson(adminPage, "POST", PATIENTS, patient(id, "F", cccd), BRANCH_ONE);
    expect(taken.status, JSON.stringify(taken.body)).toBe(200);
    await adminPage.close();

    // branch2 carries its branch as a claim: no header needed, and the check
    // is scoped to that branch.
    const branchPage = await browser.newPage();
    await login(branchPage, BRANCH2_USER);
    await branchPage.goto("/patient");
    const elsewhere = await sendJson(branchPage, "POST", PATIENTS, patient(id, "G", cccd));
    expect(elsewhere.status, JSON.stringify(elsewhere.body)).toBe(200);
    expect(elsewhere.body.nationalId).toBe(cccd);
    await branchPage.close();
  });

  test("the create dialog shows the refusal under the CCCD box and stays open", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const id = runId();
    const cccd = freshNationalId(id, "03");
    const holder = await sendJson(page, "POST", PATIENTS, patient(id, "H", cccd), BRANCH_ONE);
    expect(holder.status, JSON.stringify(holder.body)).toBe(200);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(`E2E ${id} Cccd UI`);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(`08${id}0099`.slice(0, 10));
    const cccdBox = dialog.getByRole("textbox", { name: "CCCD" });
    await cccdBox.fill(cccd);
    await dialog.getByRole("button", { name: "Lưu" }).click();

    // The dialog stays open; the server's message sits under the CCCD field
    // without revealing which record holds it.
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".ant-form-item-explain-error")).toContainText("CCCD");
    await expect(dialog.locator(".ant-form-item-explain-error")).not.toContainText(holder.body.patientCode);

    // A free CCCD saves.
    await cccdBox.fill(freshNationalId(id, "04"));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(`E2E ${id} Cccd UI`).first()).toBeVisible();
  });
});
