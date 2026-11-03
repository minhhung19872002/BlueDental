import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  call,
  expectReceiptPage,
  money,
  openDropdown,
  PAYMENTS_API,
  RECEIPT_STATUS,
  settleReceipt,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2910 (F-83 / R-1080): a service paid over several đợt, with Giảm giá thu
 * ngân and a payment-time voucher, through the real "Tạo phiếu thanh toán".
 *
 *   S1 10.000.000 đ, VAT 10 %          S2 2.000.000 đ, no VAT, BS giảm 200.000
 *   Đợt 1  S1 only, 5.500.000 collected → 5.000.000 + VAT 500.000
 *   Đợt 2  S1: TN giảm 1.000.000; voucher 500.000 split 250.000 / 250.000
 *          S1 VAT after relief = (10tr − 1tr − 250k) × 10 % = 875.000,
 *          so đợt 2 carries 875.000 − 500.000 = 375.000 of it.
 *
 * Real stack only: real login, data provisioned through the real API, every
 * figure read back from the rendered dialog, the receipt page and separate
 * requests into PostgreSQL.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const TAX_TEN = 5; // ServiceTaxRate.Ten
const NOT_TAXABLE = 0;
const CANCEL_OTHER = 4;

interface Provisioned {
  patientId: string;
  slipId: string;
  staffId: string;
  s1: { name: string; adviseId: string; lineId: string };
  s2: { name: string; adviseId: string; lineId: string };
  voucher: { id: string; code: string };
}

interface ServiceSpec {
  name: string;
  price: number;
  taxRate: number;
  /** The advise's own Money discount — "BS giảm". */
  doctorDiscount: number;
  /** Danh mục's price when it is not the line's — the slip keeps `price` as its giá gốc. */
  catalogPrice?: number;
}

/**
 * A fresh patient whose slip holds one line per service in `specs`, each made
 * in Danh mục for this run, and a published fixed voucher for the whole slip —
 * redeemed on the slip itself when `voucherOnSlip`, else left for a đợt to use.
 */
async function provision(page: Page, id: string, specs: ServiceSpec[], voucherValue: number, voucherOnSlip = false) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  return page.evaluate(
    async ({ branch, id, specs, voucherValue, voucherOnSlip }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Clinic-Branch-Id": branch,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const post = async (url: string, body?: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };

      const taxonomyId = (
        await get(`/api/v1/app/taxonomies?group=care_service&clinicBranchId=${branch}&maxResultCount=1`)
      ).items[0].id as string;
      const staffId = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0].id as string;
      const patient = await post("/api/v1/app/patients", {
        firstName: `Đợt ${id}`,
        lastName: "E2E",
        dateOfBirth: null,
        gender: "male",
        phoneNumber: `08${id.padStart(8, "0").slice(-8)}`,
      });

      const advises: { name: string; adviseId: string; serviceId: string }[] = [];
      for (const spec of specs) {
        const service = await post("/api/v1/app/catalog-entries", {
          taxonomyId,
          name: spec.name,
          price: spec.catalogPrice ?? spec.price,
          sortOrder: 9999,
          serviceConfig: {
            taxRate: spec.taxRate,
            priceIncludesTax: false,
            discountIsPercent: false,
            discountValue: 0,
            requireImage: false,
            deductDoctorOnWarranty: false,
            separateRevenue: false,
            showToothOnInvoice: false,
            revenueByStage: false,
            requireStageSequence: false,
            warrantyDays: 0,
            laboSupplierIds: [],
          },
        });
        const advise = await post("/api/v1/app/patient-advises", {
          patientId: patient.id,
          clinicBranchId: branch,
          patientDiagnosisId: null,
          diagnosisId: null,
          serviceId: service.id,
          staffId,
          originalPrice: spec.price,
          price: spec.price,
          quantity: 1,
          discountType: spec.doctorDiscount > 0 ? 1 : 0,
          discountValue: spec.doctorDiscount,
          teeth: [{ toothCode: 11 + advises.length, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
        });
        await post(`/api/v1/app/patient-advises/${advise.id}/accept`);
        advises.push({ name: spec.name, adviseId: advise.id as string, serviceId: service.id as string });
      }

      const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d.toISOString().slice(0, 10);
      };
      const voucher = await post("/api/v1/app/vouchers", {
        code: `DT${id}`,
        name: `e2e đợt ${id}`,
        discountType: "fixed_amount",
        discountValue: voucherValue,
        scopeTarget: "treatment",
        targetIds: [],
        startDate: day(-1),
        endDate: day(30),
        usageLimit: 100,
        isExclusive: false,
        customerTargets: ["new", "returning"],
        isDaysOfWeekLimited: false,
        daysOfWeek: [],
        displayOnNfcDental: true,
        branchId: branch,
      });
      await post(`/api/v1/app/vouchers/${voucher.id}/publish`);

      const slip = await post("/api/v1/app/patient-treatments", {
        patientId: patient.id,
        clinicBranchId: branch,
        dentistId: staffId,
        discountType: 0,
        discountValue: 0,
        voucherIds: voucherOnSlip ? [voucher.id] : [],
        adviseIds: advises.map((advise) => advise.adviseId),
      });
      const lines = slip.services as { id: string; serviceId: string }[];

      return {
        patientId: patient.id as string,
        slipId: slip.id as string,
        staffId,
        lines: advises.map((advise) => ({
          name: advise.name,
          adviseId: advise.adviseId,
          lineId: lines.find((line) => line.serviceId === advise.serviceId)!.id,
        })),
        voucher: { id: voucher.id as string, code: voucher.code as string },
      };
    },
    { branch: BRANCH_ONE, id, specs, voucherValue, voucherOnSlip },
  );
}

async function openCreateDialog(page: Page, made: Pick<Provisioned, "patientId" | "slipId">): Promise<Locator> {
  await page.goto(`/patient/${made.patientId}/treatment-plan/${made.slipId}`);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(dialog.locator(".pd-newpay-lines > li").first()).toBeVisible({ timeout: 20_000 });
  return dialog;
}

/** "Nội dung → amount" of every fact row in `scope`. */
async function factsOf(scope: Locator): Promise<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const row of await scope.locator(".pd-newpay-fact").all()) {
    const [label, value] = await row.locator(":scope > span").allInnerTexts();
    facts[label.trim()] = money(value);
  }
  return facts;
}

/** "Tạo phiếu thanh toán": the one POST, landing on the new receipt's page. */
async function createReceipt(page: Page, dialog: Locator): Promise<Receipt & Record<string, unknown>> {
  const saved = page.waitForResponse((res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST");
  await dialog.getByRole("button", { name: "Tạo phiếu thanh toán" }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const receipt = (await response.json()) as Receipt & Record<string, unknown>;
  expect(receipt.status).toBe(RECEIPT_STATUS.Pending);
  await expectReceiptPage(page, receipt);
  return receipt;
}

async function usedCount(page: Page, voucherId: string): Promise<number> {
  const voucher = await call(page, `/api/v1/app/vouchers/${voucherId}`);
  return Number(voucher.body.usedCount);
}

interface StoredLine {
  treatmentServiceId: string;
  amount: number;
  receiptName: string | null;
  cashierDiscount: number | null;
  cashierDiscountReason: string | null;
  voucherShare: number | null;
  taxAmount: number;
}

test.describe("Thanh toán nhiều đợt (P2910)", () => {
  test("đợt 2 with TN giảm and a voucher: VAT after relief, receipt reason, plan relief", async ({ page }) => {
    test.setTimeout(180_000);
    const id = runId();
    await login(page);
    const made = await provision(
      page,
      id,
      [
        { name: `P2910 thuế ${id}`, price: 10_000_000, taxRate: TAX_TEN, doctorDiscount: 0 },
        { name: `P2910 không thuế ${id}`, price: 2_000_000, taxRate: NOT_TAXABLE, doctorDiscount: 200_000 },
      ],
      500_000,
    );
    const [s1, s2] = made.lines;
    const reason = `Khách quen ${id}`;

    // ── Đợt 1: half of S1, VAT included ─────────────────────────────────
    let dialog = await openCreateDialog(page, made);
    let card1 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s1.name });
    let card2 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s2.name });
    await expect(card1.locator(".pd-newpay-tag--round")).toHaveCount(0);
    await expect(card2.locator(".pd-newpay-tag--doctor")).toHaveText("BS giảm 200.000 đ");
    await expect(card1.locator(".pd-newpay-due")).toHaveText("Còn nợ 11.000.000 đ");
    await card1.locator("input[type=checkbox]").first().check();
    await dialog.locator(".pd-newpay-amount").fill("5500000");
    await expect(dialog.locator(".pd-newpay-collect")).toContainText("trong đó VAT 500.000 đ");
    const first = await createReceipt(page, dialog);
    expect((first.lines as StoredLine[])[0].taxAmount).toBe(500_000);
    await settleReceipt(page, first);

    // ── Đợt 2: the card knows its round and what đợt 1 paid ─────────────
    dialog = await openCreateDialog(page, made);
    card1 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s1.name });
    card2 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s2.name });
    await expect(card1.locator(".pd-newpay-tag--round")).toHaveText("Thanh toán nhiều đợt · đợt 2");
    await expect(card1.locator(".pd-newpay-due")).toHaveText("Còn nợ 5.500.000 đ");
    const history = card1.locator(".pd-newpay-history");
    await expect(history.locator("li").first()).toContainText("Đợt 1");
    await expect(history.locator("li").first()).toContainText("5.500.000 đ");
    await expect(history.locator("li").first()).toContainText("Đã thanh toán");
    await expect(history.locator(".pd-newpay-history-foot")).toContainText("Đã thanh toán 1 đợt: 5.500.000 đ");

    // Ticking opens "Đang chỉnh phiếu đợt 2"; Áp dụng keeps the terms and folds it.
    await card1.locator("input[type=checkbox]").first().check();
    await expect(card1.locator(".pd-newpay-editlink")).toHaveText(/Đang chỉnh phiếu đợt 2/);
    await expect(card1.getByLabel("Tên trên phiếu (đợt 2)")).toHaveValue(`${s1.name} – Đợt 2`);
    await card1.getByLabel("Giảm giá thu ngân").fill("1000000");
    await card1.getByLabel("Lý do giảm giá").fill(reason);
    await card1.getByRole("button", { name: "Áp dụng" }).click();
    await expect(card1.locator(".pd-newpay-editlink")).toHaveText(/Chỉnh phiếu đợt 2/);
    await expect(card1.locator(".pd-newpay-editrow .pd-newpay-chip")).toHaveText("TN giảm 1.000.000 đ");
    // The đợt 2 row: what it would collect without TN giảm (VAT included) struck over what it does.
    const nowRow = history.locator(".pd-newpay-history-now");
    await expect(nowRow.locator(".pd-newpay-history-was")).toHaveText("5.500.000 đ");
    await expect(nowRow.locator(".pd-newpay-history-discounted")).toHaveText("4.400.000 đ");
    await expect(nowRow).toContainText("Chưa thanh toán");

    await card2.locator("input[type=checkbox]").first().check();
    await card2.getByRole("button", { name: "Áp dụng" }).click();

    // The voucher of this đợt, split evenly over both services.
    await dialog.getByRole("combobox", { name: "Voucher" }).click();
    await page.keyboard.type(made.voucher.code);
    await openDropdown(page).locator(".ant-select-item-option", { hasText: made.voucher.code }).click();
    await expect(dialog.locator(".pd-newpay-voucher-off")).toHaveText("−500.000 đ");
    // Only TN giảm is struck: the voucher share stays off both figures.
    await expect(nowRow.locator(".pd-newpay-history-was")).toHaveText("5.225.000 đ");
    await expect(nowRow.locator(".pd-newpay-history-discounted")).toHaveText("4.125.000 đ");

    const totals = dialog.locator("section", { has: page.locator("h4", { hasText: "Tổng tiền dịch vụ đã chọn" }) });
    await expect
      .poll(() => factsOf(totals))
      .toEqual({
        "Tổng tiền": 12_000_000,
        "Giảm giá bác sĩ": 200_000,
        "Giảm giá thu ngân": 1_000_000,
        Voucher: 500_000,
        "Tổng tiền sau giảm": 10_300_000,
        "Thuế VAT": 875_000,
        "Tổng thanh toán (gồm VAT)": 11_175_000,
        "Đã thanh toán": 5_500_000,
        "Ưu đãi các đợt trước": 0,
        "Còn nợ cần thanh toán": 5_675_000,
      });
    const collect = dialog.locator(".pd-newpay-collect");
    await expect(collect.locator("b").first()).toHaveText("5.675.000 đ");
    await expect(collect).toContainText("trong đó VAT 375.000 đ");
    await expect(collect.locator("b").last()).toHaveText("0 đ");

    // "Khách sẽ thấy trên phiếu": Tên trên phiếu, what is let off, what is collected.
    const preview = dialog.locator(".pd-newpay-preview li");
    const seen1 = preview.filter({ hasText: s1.name });
    await expect(seen1).toContainText(`${s1.name} – Đợt 2`);
    await expect(seen1.locator("small")).toHaveText("Giảm giá −1.000.000 đ · Voucher −250.000 đ");
    await expect(seen1.locator("b")).toHaveText("4.125.000 đ");
    const seen2 = preview.filter({ hasText: s2.name });
    await expect(seen2.locator("small")).toHaveText("Voucher −250.000 đ");
    await expect(seen2.locator("b")).toHaveText("1.550.000 đ");
    await expect(dialog.locator(".pd-newpay-preview")).not.toContainText(reason);

    // ── The receipt: stored terms, and the reason for the accountant ────
    const second = await createReceipt(page, dialog);
    expect(second.amount).toBe(5_675_000);
    expect(second.voucherCode).toBe(made.voucher.code);
    expect(second.voucherAmount).toBe(500_000);
    expect(second.cashierDiscountTotal).toBe(1_000_000);
    const lines = second.lines as StoredLine[];
    expect(lines.find((line) => line.treatmentServiceId === s1.lineId)).toMatchObject({
      amount: 4_125_000,
      receiptName: `${s1.name} – Đợt 2`,
      cashierDiscount: 1_000_000,
      cashierDiscountReason: reason,
      voucherShare: 250_000,
      taxAmount: 375_000,
    });
    expect(lines.find((line) => line.treatmentServiceId === s2.lineId)).toMatchObject({
      amount: 1_550_000,
      voucherShare: 250_000,
      taxAmount: 0,
    });
    const discounts = page.locator(".rcpt-discounts");
    await expect(discounts).toContainText(`${s1.name} – Đợt 2`);
    await expect(discounts).toContainText("1.000.000");
    await expect(discounts).toContainText(reason);
    await expect(page.locator(".rcpt-lines")).toContainText("Voucher −250.000");
    // The use is held as soon as the receipt is written.
    expect(await usedCount(page, made.voucher.id)).toBe(1);
    await settleReceipt(page, second);

    // ── Read back with separate requests ────────────────────────────────
    const slip = await call(page, `/api/v1/app/patient-treatments/${made.slipId}`);
    const services = slip.body.services as { id: string; taxAmount: number; outstandingAmount: number; paidAmount: number }[];
    expect(services.find((line) => line.id === s1.lineId)).toMatchObject({
      taxAmount: 875_000,
      outstandingAmount: 0,
      paidAmount: 9_625_000,
    });
    expect(services.find((line) => line.id === s2.lineId)).toMatchObject({ outstandingAmount: 0, paidAmount: 1_550_000 });

    const stored = await call(page, `${PAYMENTS_API}?patientId=${made.patientId}&maxResultCount=100`);
    const receipts = stored.body.items as (Receipt & { lines: StoredLine[] })[];
    expect(receipts.map((receipt) => receipt.status)).toEqual([RECEIPT_STATUS.Completed, RECEIPT_STATUS.Completed]);
    const s1Tax = receipts
      .flatMap((receipt) => receipt.lines)
      .filter((line) => line.treatmentServiceId === s1.lineId)
      .reduce((sum, line) => sum + line.taxAmount, 0);
    expect(s1Tax).toBe(875_000);

    // ── TỔNG KẾ HOẠCH: what the paid receipts let off, VAT drop included ─
    await page.goto(`/patient/${made.patientId}?tab=consulting&branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, "/api/v1/app/patient-advises");
    for (const line of [s1, s2]) {
      const row = page.locator(`.pd-advise-table tr[data-row-key="${line.adviseId}"]`);
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.locator(".ant-checkbox-input").check();
    }
    const relief = page.locator(".pd-plan-row--off").filter({ hasText: "Ưu đãi khi thanh toán" });
    await expect.poll(async () => money(await relief.locator("b").innerText())).toBe(1_625_000);
  });

  test("Giá gốc is the slip's, not Danh mục's; the slip voucher is Voucher, not BS giảm; the card head ticks it (R-1102)", async ({
    page,
  }) => {
    const id = runId();
    await login(page);
    // The owner's case: a line made at 1.000.000 đ while Danh mục now says
    // 500.000 đ, no doctor discount on it; a second line with BS giảm 50.000;
    // a 100.000 đ voucher redeemed on the slip.
    const made = await provision(
      page,
      id,
      [
        { name: `R1102 giá sửa ${id}`, price: 1_000_000, catalogPrice: 500_000, taxRate: NOT_TAXABLE, doctorDiscount: 0 },
        { name: `R1102 BS giảm ${id}`, price: 500_000, taxRate: NOT_TAXABLE, doctorDiscount: 50_000 },
      ],
      100_000,
      true,
    );
    const [s1, s2] = made.lines;

    const dialog = await openCreateDialog(page, made);
    const card1 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s1.name });
    const card2 = dialog.locator(".pd-newpay-lines > li").filter({ hasText: s2.name });
    await expect(card1.locator(".pd-newpay-price").first()).toHaveText("Giá gốc: 1.000.000 đ");
    await expect(card1.locator(".pd-newpay-tag--doctor")).toHaveCount(0);
    await expect(card2.locator(".pd-newpay-price").first()).toHaveText("Giá gốc: 500.000 đ");
    await expect(card2.locator(".pd-newpay-tag--doctor")).toHaveText("BS giảm 50.000 đ");

    // A click on the prices ticks the card and a second one unticks it; a
    // click on the name (the checkbox's own label) ticks it once, not twice.
    const box1 = card1.locator("input[type=checkbox]").first();
    await card1.locator(".pd-newpay-card-money").click();
    await expect(box1).toBeChecked();
    await card1.locator(".pd-newpay-card-money").click();
    await expect(box1).not.toBeChecked();
    await card1.locator(".pd-newpay-name").click();
    await expect(box1).toBeChecked();
    await card2.locator(".pd-newpay-due").click();
    await expect(card2.locator("input[type=checkbox]").first()).toBeChecked();

    const totals = dialog.locator("section", { has: page.locator("h4", { hasText: "Tổng tiền dịch vụ đã chọn" }) });
    await expect
      .poll(() => factsOf(totals))
      .toEqual({
        "Tổng tiền": 1_500_000,
        "Giảm giá bác sĩ": 50_000,
        "Giảm giá thu ngân": 0,
        Voucher: 100_000,
        "Tổng tiền sau giảm": 1_350_000,
        "Thuế VAT": 0,
        "Tổng thanh toán (gồm VAT)": 1_350_000,
        "Đã thanh toán": 0,
        "Ưu đãi các đợt trước": 0,
        "Còn nợ cần thanh toán": 1_350_000,
      });
  });

  test("a 0 đ receipt cleared by TN giảm and a voucher holds the use until cancelled", async ({ page }) => {
    const id = runId();
    await login(page);
    const made = await provision(
      page,
      id,
      [{ name: `P2910 0đ ${id}`, price: 1_000_000, taxRate: NOT_TAXABLE, doctorDiscount: 0 }],
      300_000,
    );
    const [line] = made.lines;
    const body = (amount: number, relief: boolean) => ({
      patientId: made.patientId,
      clinicBranchId: BRANCH_ONE,
      treatmentPlanId: made.slipId,
      treatmentServiceIds: [line.lineId],
      splitMode: 1,
      items: [],
      kind: 1,
      method: 1,
      amount,
      staffId: made.staffId,
      lineTerms: relief
        ? [{ treatmentServiceId: line.lineId, receiptName: null, cashierDiscount: 700_000, cashierDiscountReason: "e2e" }]
        : [],
      voucherId: relief ? made.voucher.id : null,
    });

    // No money and nothing let off is not a receipt.
    const empty = await call(page, PAYMENTS_API, { method: "POST", json: body(0, false) });
    expect(empty.status, JSON.stringify(empty.body)).toBe(403);
    expect((empty.body.error as { code: string }).code).toBe("BlueDental:Billing:0004");

    // TN giảm 700.000 + voucher 300.000 clear the line: a 0 đ receipt.
    const zero = await call(page, PAYMENTS_API, { method: "POST", json: body(0, true) });
    expect(zero.status, JSON.stringify(zero.body)).toBe(200);
    expect(zero.body).toMatchObject({
      status: RECEIPT_STATUS.Pending,
      amount: 0,
      voucherAmount: 300_000,
      cashierDiscountTotal: 700_000,
    });
    expect(await usedCount(page, made.voucher.id)).toBe(1);

    // Cancelled, the use goes back.
    const cancelled = await call(page, `${PAYMENTS_API}/${String(zero.body.id)}/cancel`, {
      method: "POST",
      json: { reasonCode: CANCEL_OTHER, reason: `e2e P2910 ${id}` },
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(204);
    const after = await call(page, `${PAYMENTS_API}?patientId=${made.patientId}&includeCancelled=true&includePending=true&maxResultCount=10`);
    expect((after.body.items as Receipt[]).find((receipt) => receipt.id === zero.body.id)?.status).toBe(RECEIPT_STATUS.Cancelled);
    expect(await usedCount(page, made.voucher.id)).toBe(0);
  });
});
