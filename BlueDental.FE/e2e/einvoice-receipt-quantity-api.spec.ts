import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, createSlipViaApi, settleReceipt } from "./fixtures/ledgerReceipt";

/**
 * R-1258 (BA 2026-11-18, final rule 2026-11-19): a receipt's e-invoice printed
 * every service as "1 × Thành tiền" — Cạo vôi 10 × 500.000 went out as
 * 1 × 5.000.000. Each service is now one line: Số lượng is the slip's, Thành
 * tiền is what the đợt collected on it (VAT backed out), and Đơn giá is only
 * Thành tiền ÷ Số lượng to two decimals — chỉnh nha 1.000.000 VAT 10 % on
 * 2 Hàm = 2 × 454.545,5 = 909.091 + 90.909. The total never moves, and a
 * Lưu Nháp of the untouched lines keeps it to the đồng.
 *
 * Real API on the logged-in session: a catalog service is made, put on a fresh
 * slip, collected, ✓'d, and the receipt's e-invoice draft is read back. Lưu
 * Nháp (send: false) stays in BlueDental — nothing goes to EasyInvoice.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const TAX = { NotTaxable: 0, Eight: 4, Ten: 5 } as const;
const DISCOUNT = { None: 0, Percentage: 2 } as const;

interface SlipLine {
  id: string;
  serviceId: string;
  quantity: number;
  chargedAmount: number;
  taxAmount: number;
  payableAmount: number;
}

interface Slip {
  id: string;
  patientId: string;
  dentistId: string;
  services: SlipLine[];
}

interface InvoiceLine {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  vatRate: number;
  taxAmount: number;
  amount: number;
}

async function catalogService(
  page: Page,
  name: string,
  price: number,
  taxRate: number,
): Promise<string> {
  const groups = await call(
    page,
    `/api/v1/app/taxonomies?group=care_service&clinicBranchId=${BRANCH_ONE}&maxResultCount=1`,
  );
  const taxonomyId = (groups.body.items as { id: string }[])[0].id;
  const created = await call(page, "/api/v1/app/catalog-entries", {
    method: "POST",
    json: {
      taxonomyId,
      name,
      price,
      sortOrder: 9999,
      serviceConfig: {
        taxRate,
        priceIncludesTax: false,
        discountIsPercent: true,
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
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.id as string;
}

/** A fresh slip of its own patient (no slip discount to share out), with `serviceId` × `quantity` on it. */
async function slipWith(
  page: Page,
  tag: string,
  line: {
    serviceId: string;
    price: number;
    quantity: number;
    discountType?: number;
    discountValue?: number;
  },
): Promise<{ slip: Slip; line: SlipLine }> {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  const patient = await call(page, "/api/v1/app/patients", {
    method: "POST",
    json: {
      firstName: `HĐ SL ${tag}`,
      lastName: "E2E",
      dateOfBirth: null,
      gender: "male",
      phoneNumber: `07${digits}`,
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);
  const fresh = await createSlipViaApi(page, String(patient.body.id));
  const added = await call(page, `/api/v1/app/patient-treatments/${fresh.id}/services`, {
    method: "POST",
    json: {
      serviceId: line.serviceId,
      price: line.price,
      quantity: line.quantity,
      discountType: line.discountType ?? DISCOUNT.None,
      discountValue: line.discountValue ?? 0,
      teeth: [],
    },
  });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  const slip = added.body as unknown as Slip;
  return { slip, line: slip.services.find((s) => s.serviceId === line.serviceId)! };
}

/** A receipt of `amount` on the one line (TN giảm `cashierDiscount` off it), settled ("Đã thanh toán"), and its e-invoice draft's lines. */
async function invoiceLinesOf(
  page: Page,
  slip: Slip,
  line: SlipLine,
  amount: number,
  cashierDiscount = 0,
): Promise<{ receiptId: string; receiptCode: string; lines: InvoiceLine[] }> {
  const receipt = await call(page, "/api/v1/app/patient-payments", {
    method: "POST",
    json: {
      patientId: slip.patientId,
      clinicBranchId: BRANCH_ONE,
      treatmentPlanId: slip.id,
      treatmentServiceIds: [line.id],
      splitMode: 1,
      items: [],
      kind: 1,
      method: 1,
      amount,
      staffId: slip.dentistId,
      lineTerms: cashierDiscount
        ? [
            {
              treatmentServiceId: line.id,
              receiptName: null,
              cashierDiscount,
              cashierDiscountReason: "e2e R-1258",
            },
          ]
        : [],
    },
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(200);
  await settleReceipt(page, {
    id: String(receipt.body.id),
    clinicBranchId: String(receipt.body.clinicBranchId),
  });

  const draft = await call(
    page,
    `/api/v1/app/e-invoices/draft?patientPaymentId=${String(receipt.body.id)}`,
  );
  expect(draft.status, JSON.stringify(draft.body)).toBe(200);
  expect(draft.body.maxAmount).toBe(amount);
  const lines = draft.body.lines as InvoiceLine[];
  // Số lượng × Đơn giá rounds back to Thành tiền, and the lines add up to what the đợt collected.
  for (const l of lines) expect(l.total).toBe(Math.round(l.quantity * l.unitPrice));
  expect(lines.reduce((sum, l) => sum + l.amount, 0)).toBe(amount);
  return { receiptId: String(receipt.body.id), receiptCode: String(receipt.body.code), lines };
}

/** Lưu Nháp (send: false — nothing leaves BlueDental) of `lines` as the dialog posts them; the saved figures. */
async function saveDraft(page: Page, receiptId: string, lines: InvoiceLine[]) {
  const saved = await call(page, "/api/v1/app/e-invoices/issue", {
    method: "POST",
    json: {
      patientPaymentId: receiptId,
      send: false,
      lines: lines.map(({ code, name, unit, quantity, unitPrice, vatRate }) => ({
        code,
        name,
        unit,
        quantity,
        unitPrice,
        vatRate,
      })),
    },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return saved.body as { total: number; taxAmount: number; amount: number };
}

/** "qty × unitPrice" of each line, the way the invoice prints them. */
const shape = (lines: InvoiceLine[]) => lines.map((l) => `${l.quantity} × ${l.unitPrice}`);

test.describe("Hóa đơn điện tử từ phiếu thu: Số lượng của phiếu, Đơn giá theo tiền đã thu (API, R-1258)", () => {
  test("paid in full bills 10 × 500.000; a part payment keeps Số lượng 10 at what was paid per unit", async ({
    page,
  }) => {
    await login(page);
    const id = runId();
    const serviceId = await catalogService(page, `HĐ SL ${id}`, 500_000, TAX.NotTaxable);

    const full = await slipWith(page, `${id} đủ`, { serviceId, price: 500_000, quantity: 10 });
    expect(full.line.quantity).toBe(10);
    expect(full.line.payableAmount).toBe(5_000_000);
    const [paid] = (await invoiceLinesOf(page, full.slip, full.line, 5_000_000)).lines;
    expect(paid).toMatchObject({
      quantity: 10,
      unitPrice: 500_000,
      total: 5_000_000,
      taxAmount: 0,
      amount: 5_000_000,
    });

    // BA 2026-11-19: Số lượng stays the slip's 10, Đơn giá is what each đợt paid
    // per unit — 2.000.000 / 2.200.000 / 800.000 → 10 × 200.000 / 220.000 / 80.000.
    const part = await slipWith(page, `${id} 1 phần`, { serviceId, price: 500_000, quantity: 10 });
    expect(shape((await invoiceLinesOf(page, part.slip, part.line, 2_000_000)).lines)).toEqual([
      "10 × 200000",
    ]);
    expect(shape((await invoiceLinesOf(page, part.slip, part.line, 2_200_000)).lines)).toEqual([
      "10 × 220000",
    ]);
    expect(shape((await invoiceLinesOf(page, part.slip, part.line, 800_000)).lines)).toEqual([
      "10 × 80000",
    ]);
  });

  test("Đơn giá is after the line's discount and the đợt's TN giảm, before VAT, to two decimals", async ({
    page,
  }) => {
    await login(page);
    const id = runId();

    // −10 % on the line: 10 × 450.000 = 4.500.000 — Đơn giá after the discount.
    const plainId = await catalogService(page, `HĐ SL giảm ${id}`, 500_000, TAX.NotTaxable);
    const discounted = await slipWith(page, `${id} giảm`, {
      serviceId: plainId,
      price: 500_000,
      quantity: 10,
      discountType: DISCOUNT.Percentage,
      discountValue: 10,
    });
    expect(discounted.line.payableAmount).toBe(4_500_000);
    const [cut] = (await invoiceLinesOf(page, discounted.slip, discounted.line, 4_500_000)).lines;
    expect(cut).toMatchObject({
      quantity: 10,
      unitPrice: 450_000,
      total: 4_500_000,
      amount: 4_500_000,
    });

    // TN giảm 50.000 on 3 × 1.000.000: 2.950.000 ÷ 3 = 983.333,33, Thành tiền
    // stays 2.950.000 — and a Lưu Nháp of that line saves 2.950.000, not 2.949.999,99.
    const reliefId = await catalogService(page, `HĐ SL TN ${id}`, 1_000_000, TAX.NotTaxable);
    const relieved = await slipWith(page, `${id} TN`, {
      serviceId: reliefId,
      price: 1_000_000,
      quantity: 3,
    });
    const relief = await invoiceLinesOf(page, relieved.slip, relieved.line, 2_950_000, 50_000);
    expect(shape(relief.lines)).toEqual(["3 × 983333.33"]);
    expect(relief.lines[0]).toMatchObject({ total: 2_950_000, amount: 2_950_000 });
    expect(await saveDraft(page, relief.receiptId, relief.lines)).toMatchObject({
      total: 2_950_000,
      amount: 2_950_000,
    });

    // 8 % VAT: 10 × 900.000 + 720.000 = 9.720.000 collected.
    const taxedId = await catalogService(page, `HĐ SL VAT ${id}`, 900_000, TAX.Eight);
    const taxed = await slipWith(page, `${id} VAT`, {
      serviceId: taxedId,
      price: 900_000,
      quantity: 10,
    });
    expect(taxed.line.payableAmount).toBe(9_720_000);
    const [vat] = (await invoiceLinesOf(page, taxed.slip, taxed.line, 9_720_000)).lines;
    expect(vat).toMatchObject({
      quantity: 10,
      unitPrice: 900_000,
      total: 9_000_000,
      vatRate: 8,
      taxAmount: 720_000,
      amount: 9_720_000,
    });
  });

  test("chỉnh nha VAT 10 % paid in part bills 2 × 454.545,5 and a Lưu Nháp keeps 1.000.000 to the đồng", async ({
    page,
  }) => {
    await login(page);
    const id = runId();

    // The BA's sample: 2 Hàm × 3.000.000 (+10 %), đợt 1 collects 1.000.000.
    const orthoId = await catalogService(page, `HĐ SL chỉnh nha ${id}`, 3_000_000, TAX.Ten);
    const ortho = await slipWith(page, `${id} CN`, {
      serviceId: orthoId,
      price: 3_000_000,
      quantity: 2,
    });
    expect(ortho.line.payableAmount).toBe(6_600_000);
    const first = await invoiceLinesOf(page, ortho.slip, ortho.line, 1_000_000);
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0]).toMatchObject({
      quantity: 2,
      unitPrice: 454_545.5,
      total: 909_091,
      vatRate: 10,
      taxAmount: 90_909,
      amount: 1_000_000,
    });

    // Untouched, the decimal Đơn giá saves back to exactly what was collected.
    expect(await saveDraft(page, first.receiptId, first.lines)).toMatchObject({
      total: 909_091,
      taxAmount: 90_909,
      amount: 1_000_000,
    });
    // Re-opened, the dialog shows the same line.
    const reread = await call(
      page,
      `/api/v1/app/e-invoices/draft?patientPaymentId=${first.receiptId}`,
    );
    expect(shape(reread.body.lines as InvoiceLine[])).toEqual(["2 × 454545.5"]);

    // A price the cashier typed is priced as typed: 2 × 400.000 + 10 % = 880.000.
    const edited = await saveDraft(page, first.receiptId, [
      { ...first.lines[0], unitPrice: 400_000 },
    ]);
    expect(edited).toMatchObject({ total: 800_000, taxAmount: 80_000, amount: 880_000 });

    // Đợt 2 clears the rest: 5.600.000 → 2 × 2.545.454,5 = 5.090.909 + 509.091.
    const second = await invoiceLinesOf(page, ortho.slip, ortho.line, 5_600_000);
    expect(second.lines[0]).toMatchObject({
      quantity: 2,
      unitPrice: 2_545_454.5,
      total: 5_090_909,
      taxAmount: 509_091,
    });
  });

  test("the Hóa đơn dialog shows Đơn giá 454.545,5 and its Lưu Nháp saves 1.000.000", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const id = runId();
    const orthoId = await catalogService(page, `HĐ SL UI ${id}`, 3_000_000, TAX.Ten);
    const ortho = await slipWith(page, `${id} UI`, {
      serviceId: orthoId,
      price: 3_000_000,
      quantity: 2,
    });
    const { receiptId, receiptCode } = await invoiceLinesOf(
      page,
      ortho.slip,
      ortho.line,
      1_000_000,
    );

    await page.goto("/billing");
    await page
      .getByPlaceholder("Tìm theo mã thanh toán, tên hoặc mã khách hàng...")
      .fill(receiptCode);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: receiptCode });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row
      .getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${receiptCode}` })
      .click();

    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    const line = invoice.locator("tbody tr.ant-table-row").first();
    await expect(line.locator("input.inv-price-input")).toHaveValue("454.545,5");
    await expect(line).toContainText("909.091");
    await expect(line).toContainText("90.909");
    await expect(line).toContainText("1.000.000");

    // Lưu Nháp keeps it in BlueDental (send: false) — what was collected, to the đồng.
    const saved = page.waitForResponse((res) => res.url().includes("/api/v1/app/e-invoices/issue"));
    await invoice.getByRole("button", { name: "Lưu Nháp" }).click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      total: 909_091,
      taxAmount: 90_909,
      amount: 1_000_000,
    });

    // After a reload the saved draft opens on the same line.
    await page.reload();
    const reread = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${receiptId}`);
    expect(shape(reread.body.lines as InvoiceLine[])).toEqual(["2 × 454545.5"]);
  });

  test("a Lưu Nháp kept under the old split rule reopens on today's line; a typed Đơn giá stays", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const id = runId();
    const serviceId = await catalogService(page, `HĐ SL cũ ${id}`, 500_000, TAX.NotTaxable);
    const part = await slipWith(page, `${id} cũ`, { serviceId, price: 500_000, quantity: 10 });
    const { receiptId, receiptCode, lines } = await invoiceLinesOf(page, part.slip, part.line, 2_200_000);
    const [line] = lines;

    // Round 2 (on main until R-1258 round 3) saved 2.200.000 as 4 × 500.000 + 1 × 200.000.
    await saveDraft(page, receiptId, [
      { ...line, quantity: 4, unitPrice: 500_000 },
      { ...line, quantity: 1, unitPrice: 200_000 },
    ]);
    const stale = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${receiptId}`);
    expect(stale.status).toBe(200);
    expect(
      (stale.body.savedForm.lines as InvoiceLine[]).map((l) => `${l.quantity} × ${l.unitPrice}`),
    ).toEqual(["10 × 220000"]);

    // The dialog opens on 10 × 220.000 = 2.200.000 — not 10 × the old 500.000 — and Lưu Nháp saves it.
    await page.goto("/billing");
    await page
      .getByPlaceholder("Tìm theo mã thanh toán, tên hoặc mã khách hàng...")
      .fill(receiptCode);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: receiptCode });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row
      .getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${receiptCode}` })
      .click();
    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    const first = invoice.locator("tbody tr.ant-table-row").first();
    await expect(first.locator("input.inv-price-input")).toHaveValue("220.000");
    await expect(first).toContainText("2.200.000");
    await expect(first.locator("input[type=checkbox]")).toBeChecked();
    const saved = page.waitForResponse((res) => res.url().includes("/api/v1/app/e-invoices/issue"));
    await invoice.getByRole("button", { name: "Lưu Nháp" }).click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({ total: 2_200_000, amount: 2_200_000 });

    // A Đơn giá the cashier typed on today's Số lượng is the cashier's: it reopens as typed.
    await saveDraft(page, receiptId, [{ ...line, unitPrice: 200_000 }]);
    const typed = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${receiptId}`);
    expect(
      (typed.body.savedForm.lines as InvoiceLine[]).map((l) => `${l.quantity} × ${l.unitPrice}`),
    ).toEqual(["10 × 200000"]);
  });
});
