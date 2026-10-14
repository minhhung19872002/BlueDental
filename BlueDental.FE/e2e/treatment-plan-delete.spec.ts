import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_IN_URL, workingBranchId } from "./fixtures/branch";
import { PAYMENTS_API, call, collectOnFirstLine, openNewSlip } from "./fixtures/ledgerReceipt";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature: "Xoá phiếu điều trị" — the red bin in the Thao tác column of
 * Kế hoạch điều trị (BlueDental-local, owner 2026-10-14).
 *
 * Runs against the real stack only: slips opened through "Tạo kế hoạch mới",
 * money taken through "Tạo Phiếu Thanh Toán", the leaf toggled on Phân quyền,
 * a restricted dentist signed in through the login screen. Nothing is stubbed.
 *
 *  - the bin deletes a slip nothing has been done against; it stays gone after
 *    a reload and its consulting lines are back to "accepted";
 *  - a slip with a receipt goes too, and its money with it: the receipt is
 *    gone, and the patient's account no longer counts the slip or the money;
 *  - the bin and the endpoint follow treatmentConsultation.deletePlan.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const ADVISES_API = "/api/v1/app/patient-advises";
/** ADVISE_STATUS.Accepted. */
const ACCEPTED = 2;

interface Advise {
  id: string;
  treatmentPlanId: string | null;
  status: number;
}

async function advisesOf(page: Page, patientId: string): Promise<Advise[]> {
  const { body } = await call(page, `${ADVISES_API}?patientId=${patientId}&maxResultCount=200`);
  return body.items as Advise[];
}

interface OpenedSlip {
  patientId: string;
  planId: string;
  code: string;
}

/** A fresh one-line slip on the first patient, read back off the URL and the API. */
async function openSlip(page: Page): Promise<OpenedSlip> {
  await openNewSlip(page);
  const [, patientId, planId] =
    /\/patient\/([0-9a-f-]{36})\/treatment-plan\/([0-9a-f-]{36})/.exec(page.url()) ?? [];
  const { status, body } = await call(page, `${PLANS_API}/${planId}`);
  expect(status).toBe(200);
  return { patientId, planId, code: String(body.code) };
}

/** "Đã thanh toán" on the patient's account, as the server sums it. */
async function paidOf(page: Page, accountUrl: string): Promise<number> {
  const { body } = await call(page, accountUrl);
  return Number((body.payment as { totalPaid?: number } | undefined)?.totalPaid ?? Number.NaN);
}

async function openPlanTab(page: Page, slip: OpenedSlip) {
  await page.goto(`/patient/${slip.patientId}`);
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  await expect(page.locator(".tp-table .tp-code", { hasText: slip.code })).toBeVisible({
    timeout: 20_000,
  });
}

const binOf = (page: Page, slip: OpenedSlip) =>
  page.getByRole("button", { name: `Xoá phiếu điều trị ${slip.code}` });

async function confirmDelete(page: Page, slip: OpenedSlip) {
  await binOf(page, slip).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận xoá phiếu điều trị" });
  await expect(dialog).toContainText(slip.code);
  const sent = page.waitForResponse(
    (res) => res.url().endsWith(`${PLANS_API}/${slip.planId}`) && res.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Xoá" }).click();
  return { dialog, response: await sent };
}

test.describe("Kế hoạch điều trị — Xoá phiếu điều trị", () => {
  test("deletes an untouched slip and frees its consulting lines", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    const slip = await openSlip(page);
    const pulledIn = (await advisesOf(page, slip.patientId))
      .filter((advise) => advise.treatmentPlanId === slip.planId)
      .map((advise) => advise.id);
    expect(pulledIn.length).toBeGreaterThan(0);
    await openPlanTab(page, slip);

    const { dialog, response } = await confirmDelete(page, slip);
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`Đã xoá phiếu điều trị ${slip.code}`)).toBeVisible();
    await expect(page.locator(".tp-table .tp-code", { hasText: slip.code })).toHaveCount(0);

    // Persisted: gone after a reload and from the API.
    await page.reload();
    await expect(page.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible();
    await expect(page.locator(".tp-table .tp-code", { hasText: slip.code })).toHaveCount(0);
    expect((await call(page, `${PLANS_API}/${slip.planId}`)).status).not.toBe(200);

    // Its consulting lines are back to "accepted", free for a new slip.
    const after = await advisesOf(page, slip.patientId);
    for (const adviseId of pulledIn) {
      const advise = after.find((one) => one.id === adviseId);
      expect(advise?.status).toBe(ACCEPTED);
      expect(advise?.treatmentPlanId).toBeNull();
    }
  });

  test("deletes a paid slip with its receipt, and the money no longer counts", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    const slip = await openSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const receipt = await collectOnFirstLine(page);
    const accountUrl = `${PAYMENTS_API}/account?patientId=${slip.patientId}&clinicBranchId=${receipt.clinicBranchId}`;
    const paidBefore = await paidOf(page, accountUrl);
    expect(paidBefore).toBeGreaterThanOrEqual(receipt.amount);

    await openPlanTab(page, slip);
    const { dialog, response } = await confirmDelete(page, slip);
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible();
    await expect(page.locator(".tp-table .tp-code", { hasText: slip.code })).toHaveCount(0);

    // The receipt went with the slip, and neither is counted any more.
    expect((await call(page, `${PAYMENTS_API}/${receipt.id}`)).status).not.toBe(200);
    const account = (await call(page, accountUrl)).body as {
      plans: { id: string }[];
      payments: { id: string }[];
    };
    expect(account.plans.some((plan) => plan.id === slip.planId)).toBe(false);
    expect(account.payments.some((payment) => payment.id === receipt.id)).toBe(false);
    expect(await paidOf(page, accountUrl)).toBe(paidBefore - receipt.amount);
  });

  test("the bin and the endpoint follow treatmentConsultation.deletePlan", async ({
    page,
    browser,
  }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;
    const leaves = ["patient.read", "treatmentConsultation.read", "treatmentConsultation.deletePlan"];

    await login(page);
    await resetDentistLeaves(page, leaves);
    await createDentist(page, fullName, userName, password);
    await setDentistLeaf(page, "patient.read", true);
    await setDentistLeaf(page, "treatmentConsultation.read", true);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    try {
      await dentist.setViewportSize({ width: 1600, height: 900 });
      await dentist.goto("/patient");
      await expect(dentist).toHaveURL(BRANCH_IN_URL);
      const branchId = (await workingBranchId(dentist))!;
      const slip = await openSlip(page);
      // The headers the app's axios client sends: the branch, and the
      // antiforgery token so the refusal is the permission, not the XSRF check.
      const xsrf = (await context.cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
      const headers = {
        "X-Clinic-Branch-Id": branchId,
        RequestVerificationToken: decodeURIComponent(xsrf),
        Accept: "application/json, text/plain, */*",
      };

      // ── no leaf: no bin, and the server refuses the call itself ─────────
      await openPlanTab(dentist, slip);
      await expect(binOf(dentist, slip)).toHaveCount(0);
      const refused = await dentist.request.delete(`${PLANS_API}/${slip.planId}`, { headers });
      expect(refused.status()).toBe(403);

      // ── Xoá phiếu điều trị: the bin, and the delete goes through ────────
      await setDentistLeaf(page, "treatmentConsultation.deletePlan", true);
      await openPlanTab(dentist, slip);
      const { response } = await confirmDelete(dentist, slip);
      expect(response.ok(), await response.text()).toBeTruthy();
      await dentist.reload();
      await expect(dentist.locator(".tp-table .tp-code", { hasText: slip.code })).toHaveCount(0);
    } finally {
      await context.close();
      await resetDentistLeaves(page, leaves);
      await deleteDentist(page, fullName);
    }
  });
});
