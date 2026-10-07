import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";
import {
  PAYMENTS_API,
  call,
  collectOnFirstLine,
  openNewSlip,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * Feature: the payment commands on a patient's slips follow Khách hàng ›
 * Thanh toán, leaf by leaf.
 *
 * Runs against the real stack only — a dentist created through the Nhân sự
 * dialog, signed in through the real login screen in its own cookie session,
 * with leaves toggled on the Phân quyền tab by admin. Nothing is stubbed.
 *
 * Each command is gated on the leaf its server endpoint checks:
 *
 *  - payment.read — the Thanh toán / Hoàn tiền / Dư nợ tabs of the slip
 *    detail; a `?planTab=` naming one of them falls back to Chi tiết;
 *  - payment.create — "Thanh toán" in Chi tiết phiếu, and on Hồ sơ both the
 *    toolbar "Thanh toán" and each row's "Tạo phiếu thanh toán" (the Hồ sơ
 *    treatment table itself needs no payment leaf);
 *  - payment.finalize — the "Hóa đơn" icon on Kế hoạch điều trị and
 *    "In Hóa Đơn" on the slip detail, which issue an e-invoice.
 *
 * The seeded `dentist` role carries no grants; every leaf is reset at the
 * start and again at the end.
 */

const BASE_LEAVES = ["patient.read", "treatmentConsultation.read", "treatmentStage.read"] as const;
const PAYMENT_LEAVES = ["payment.read", "payment.create", "payment.finalize"] as const;
const LEAVES = [...BASE_LEAVES, ...PAYMENT_LEAVES];

interface Slip {
  patientId: string;
  planId: string;
  planCode: string;
  serviceId: string;
  branchId: string;
}

/**
 * An open line of the dentist's own branch that still takes a công đoạn, so its
 * row on Hồ sơ carries the green + into Chi tiết phiếu. Read with the admin's
 * clinic-wide session.
 */
async function findStageableSlip(admin: Page, branchId: string): Promise<Slip> {
  const found = await admin.evaluate(async (branchId) => {
    const res = await fetch("/api/v1/app/patient-treatments?maxResultCount=300", {
      credentials: "include",
    });
    const items = (await res.json()).items as {
      id: string;
      code: string;
      patientId: string;
      branchId: string;
      services: {
        id: string;
        status: number;
        stageCount: number;
        teeth: { toothCode: number }[];
        stagedTeeth: number[];
      }[];
    }[];
    for (const slip of items.filter((one) => one.branchId === branchId)) {
      // 1 = Created, 2 = InProgress, with a tooth no công đoạn holds yet (or a
      // whole-mouth line): the rows that still offer "Thêm công đoạn".
      const line = slip.services.find(
        (service) =>
          (service.status === 1 || service.status === 2) &&
          (service.teeth.length === 0 ||
            service.teeth.some((tooth) => !service.stagedTeeth.includes(tooth.toothCode))),
      );
      if (line) {
        return {
          patientId: slip.patientId,
          planId: slip.id,
          planCode: slip.code,
          serviceId: line.id,
          branchId: slip.branchId,
        };
      }
    }
    return null;
  }, branchId);
  expect(found, "the dentist's branch should have a slip with an open line").toBeTruthy();
  return found!;
}

const profilePath = (slip: Slip) =>
  `/patient/${slip.patientId}?branchId=${slip.branchId}&tab=profile`;
const planListPath = (slip: Slip) =>
  `/patient/${slip.patientId}?branchId=${slip.branchId}&tab=treatment-plan`;
const planDetailPath = (slip: Slip, planTab = "detail") =>
  `/patient/${slip.patientId}/treatment-plan/${slip.planId}?branchId=${slip.branchId}&planTab=${planTab}`;

const treatmentRow = (page: Page, slip: Slip) =>
  page.locator(`.pd-treatment-table tbody tr[data-row-key^="${slip.serviceId}"]`).first();

/**
 * Hồ sơ: the treatment history is there whatever the payment leaves — it is
 * built off the slip list, not the money endpoint — while the toolbar
 * "Thanh toán" and the row's "Tạo phiếu thanh toán" follow payment.create.
 */
async function expectProfile(page: Page, slip: Slip, canCreate: boolean) {
  await page.goto(profilePath(slip));
  const row = treatmentRow(page, slip);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByRole("button", { name: "Tạo phiếu thanh toán" })).toHaveCount(
    canCreate ? 1 : 0,
  );
  const toolbarPay = page.locator(".pd-btn-outline").filter({ hasText: /^Thanh toán$/ });
  await expect(toolbarPay).toHaveCount(canCreate ? 1 : 0);
}

/** Chi tiết phiếu's "Thanh toán", once its toolbar is on screen. */
async function expectStageDialogPay(page: Page, canCreate: boolean) {
  const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await expect(dialog).toBeVisible();
  // The other command needs no leaf, so the toolbar has rendered.
  await expect(dialog.getByRole("button", { name: "In lịch sử điều trị" })).toBeVisible();
  // The icon's own label ("dollar") leads the accessible name.
  await expect(dialog.getByRole("button", { name: /(^|\s)Thanh toán$/ })).toHaveCount(
    canCreate ? 1 : 0,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

/** Chi tiết phiếu opened from the slip row's + on Kế hoạch điều trị. */
async function expectStageDialogFromPlanList(page: Page, slip: Slip, canCreate: boolean) {
  await page.goto(planListPath(slip));
  await page.getByRole("button", { name: `Thêm công đoạn ${slip.planCode}` }).click();
  await expectStageDialogPay(page, canCreate);
}

/** Chi tiết phiếu opened from the Công đoạn cell of the row on Hồ sơ. */
async function expectStageDialogFromProfile(page: Page, slip: Slip, canCreate: boolean) {
  await page.goto(profilePath(slip));
  const row = treatmentRow(page, slip);
  await expect(row).toBeVisible({ timeout: 20_000 });
  // The pinned Thao tác column covers this cell until the table is scrolled.
  await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await row.getByRole("button", { name: "Thêm công đoạn" }).click();
  await expectStageDialogPay(page, canCreate);
}

/** Kế hoạch điều trị: the row's "Hóa đơn" icon. */
async function expectPlanList(page: Page, slip: Slip, canFinalize: boolean) {
  await page.goto(planListPath(slip));
  await expect(page.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible({
    timeout: 20_000,
  });
  const code = page.getByText(slip.planCode, { exact: true }).first();
  await expect(code).toBeVisible();
  await expect(page.getByRole("button", { name: `Phiếu thu ${slip.planCode}` })).toHaveCount(
    canFinalize ? 1 : 0,
  );
}

/** The slip detail: its tabs, the ?planTab= fallback, and "In Hóa Đơn". */
async function expectPlanDetail(page: Page, slip: Slip, canRead: boolean, canFinalize: boolean) {
  await page.goto(planDetailPath(slip, "payment-v2"));
  const tabs = page.getByRole("tablist", { name: "Kế hoạch điều trị" }).getByRole("tab");
  await expect(tabs.first()).toBeVisible({ timeout: 20_000 });
  if (canRead) {
    await expect(tabs).toHaveText(["Chi tiết", "Thanh toán", "Hoàn tiền", "Dư nợ"]);
    await expect(page.getByRole("tab", { name: "Thanh toán" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  } else {
    // A link straight to a money tab lands on Chi tiết instead.
    await expect(tabs).toHaveText(["Chi tiết"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  }

  await page.goto(planDetailPath(slip));
  await expect(page.getByRole("tab", { name: "Chi tiết" })).toHaveAttribute("aria-selected", "true");
  // The print icon needs no leaf, so the toolbar has rendered.
  await expect(page.getByRole("button", { name: "In phiếu điều trị" })).toBeVisible();
  await expect(page.getByRole("button", { name: "In Hóa Đơn" })).toHaveCount(canFinalize ? 1 : 0);
}

test.describe("Thanh toán — the payment commands follow the leaves", () => {
  test("read opens the money tabs, create the pay buttons, finalize the invoice", async ({
    page,
    browser,
  }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    await resetDentistLeaves(page, LEAVES);
    await createDentist(page, fullName, userName, password);
    for (const leaf of BASE_LEAVES) await setDentistLeaf(page, leaf, true);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    try {
      await dentist.setViewportSize({ width: 1600, height: 900 });
      await dentist.goto("/patient");
      await expect(dentist).toHaveURL(/branchId=/);
      const branchId = new URL(dentist.url()).searchParams.get("branchId")!;
      const slip = await findStageableSlip(page, branchId);

      // ── no Thanh toán leaf: the history stays, every payment command goes ─
      await expectProfile(dentist, slip, false);
      await expectStageDialogFromProfile(dentist, slip, false);
      await expectStageDialogFromPlanList(dentist, slip, false);
      await expectPlanList(dentist, slip, false);
      await expectPlanDetail(dentist, slip, false, false);

      // ── Xem: the money tabs come back, no command does ───────────────────
      await setDentistLeaf(page, "payment.read", true);
      await expectPlanDetail(dentist, slip, true, false);
      await expectProfile(dentist, slip, false);
      await expectStageDialogFromProfile(dentist, slip, false);
      await expectStageDialogFromPlanList(dentist, slip, false);
      await expectPlanList(dentist, slip, false);

      // ── Thêm: collecting money, still no e-invoice ───────────────────────
      await setDentistLeaf(page, "payment.create", true);
      await expectProfile(dentist, slip, true);
      await expectStageDialogFromProfile(dentist, slip, true);
      await expectStageDialogFromPlanList(dentist, slip, true);
      await expectPlanList(dentist, slip, false);
      await expectPlanDetail(dentist, slip, true, false);

      // ── Chốt phiếu: the invoice commands ────────────────────────────────
      await setDentistLeaf(page, "payment.finalize", true);
      await expectPlanList(dentist, slip, true);
      await expectPlanDetail(dentist, slip, true, true);

      // ── finalize without create: invoice yes, pay buttons no ─────────────
      await setDentistLeaf(page, "payment.create", false);
      await expectProfile(dentist, slip, false);
      await expectStageDialogFromProfile(dentist, slip, false);
      await expectStageDialogFromPlanList(dentist, slip, false);
      await expectPlanList(dentist, slip, true);
      await expectPlanDetail(dentist, slip, true, true);
    } finally {
      await context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});

const LEDGER = "/api/v1/app/payment-ledger";
const LEDGER_LEAVES = [
  "payment.read",
  "payment.export",
  "payment.finalize",
  "patient.read",
  "treatmentConsultation.read",
] as const;

/**
 * The status alone — the Excel file is not JSON. Both headers are the ones the
 * app's axios client sends: a dentist has no branch claim to fall back on, and
 * without a JSON `Accept` ABP rethrows a refused file action as a 500.
 */
async function statusOf(page: Page, url: string, branchId: string): Promise<number> {
  const headers = { "X-Clinic-Branch-Id": branchId, Accept: "application/json, text/plain, */*" };
  return (await page.request.get(url, { headers })).status();
}

test.describe("Tài chính → Thanh toán — Xem opens the list, Xuất file the Excel, Chốt phiếu the e-invoice", () => {
  test("no read: 403; read: the list; + patient/slip read: its sheet; export: the file; finalize: the e-invoice", async ({
    page,
    browser,
  }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    await resetDentistLeaves(page, LEDGER_LEAVES);
    await createDentist(page, fullName, userName, password);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    let receipt: Receipt | undefined;
    try {
      await dentist.setViewportSize({ width: 1600, height: 900 });
      await dentist.goto("/patient");
      await expect(dentist).toHaveURL(/branchId=/);
      const branchId = new URL(dentist.url()).searchParams.get("branchId")!;

      // Today's receipt for the row actions, written by admin on the BA's path.
      await openNewSlip(page);
      await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
      receipt = await collectOnFirstLine(page);
      expect(receipt.clinicBranchId, "admin and the dentist share a branch").toBe(branchId);
      const viewButton = dentist.getByRole("button", { name: `Xem phiếu ${receipt.code}` });
      const invoiceButton = dentist.getByRole("button", {
        name: `Xuất hóa đơn điện tử cho phiếu ${receipt.code}`,
      });

      // ── Nothing granted: the route and the endpoint both refuse ──────────
      await dentist.goto("/billing");
      await expect(dentist.getByText("Không có quyền truy cập")).toBeVisible();
      expect(await statusOf(dentist, LEDGER, branchId)).toBe(403);

      // ── Xem: the list, but no "Xuất Excel" and no file ───────────────────
      await setDentistLeaf(page, "payment.read", true);
      await dentist.goto("/billing");
      await expect(dentist.getByPlaceholder(/Tìm theo mã thanh toán/)).toBeVisible();
      await expect(dentist.locator(".billing-kpi-label").first()).toHaveText("Tổng tiền đã thu");
      await expect(dentist.getByRole("button", { name: "Xuất Excel" })).toHaveCount(0);
      expect(await statusOf(dentist, LEDGER, branchId)).toBe(200);
      expect(await statusOf(dentist, `${LEDGER}/excel`, branchId)).toBe(403);

      // The row is listed, but its sheet reads the patient and the slip: no
      // 👁 on payment.read alone, and no e-invoice before finalize.
      await dentist.getByPlaceholder(/Tìm theo mã thanh toán/).fill(receipt.code);
      await expect(dentist.locator(".ant-table-row").filter({ hasText: receipt.code })).toBeVisible({
        timeout: 20_000,
      });
      await expect(viewButton).toHaveCount(0);
      await expect(invoiceButton).toHaveCount(0);

      // ── + Bệnh nhân Xem + Tư vấn Xem: 👁 opens "Chi tiết phiếu" ──────────
      await setDentistLeaf(page, "patient.read", true);
      await setDentistLeaf(page, "treatmentConsultation.read", true);
      await dentist.goto("/billing");
      await dentist.getByPlaceholder(/Tìm theo mã thanh toán/).fill(receipt.code);
      await expect(viewButton).toBeVisible({ timeout: 20_000 });
      await expect(invoiceButton).toHaveCount(0);
      await viewButton.click();
      const detail = dentist.getByRole("dialog", { name: "Chi tiết phiếu" });
      await expect(detail.locator(".pdt-receipt-head")).toContainText(receipt.code, { timeout: 20_000 });
      await dentist.keyboard.press("Escape");
      await expect(detail).toBeHidden();

      // ── Xem + Chốt phiếu: "Xuất hoá đơn điện tử" on the row ──────────────
      await setDentistLeaf(page, "payment.finalize", true);
      await dentist.goto("/billing");
      await dentist.getByPlaceholder(/Tìm theo mã thanh toán/).fill(receipt.code);
      await expect(invoiceButton).toBeVisible({ timeout: 20_000 });
      await invoiceButton.click();
      const invoice = dentist.getByRole("dialog", { name: "Hóa đơn" });
      await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
      await dentist.keyboard.press("Escape");
      await expect(invoice).toBeHidden();

      // ── Xem + Xuất file: the button downloads the server's workbook ──────
      await setDentistLeaf(page, "payment.export", true);
      await dentist.goto("/billing");
      const exportButton = dentist.getByRole("button", { name: "Xuất Excel" });
      await expect(exportButton).toBeVisible();
      const download = dentist.waitForEvent("download");
      await exportButton.click();
      expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
    } finally {
      await context.close();
      if (receipt) await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
      await resetDentistLeaves(page, LEDGER_LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});
