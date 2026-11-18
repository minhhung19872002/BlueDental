import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, createSlipViaApi, settleReceipt } from "./fixtures/ledgerReceipt";

/**
 * R-1258 (BA 2026-11-18): a receipt's e-invoice printed every service as
 * "1 × Thành tiền" — Cạo vôi 10 × 500.000 went out as 1 × 5.000.000. A
 * service the receipt pays in full now bills the slip's Số lượng and Đơn giá
 * (after its discount: the invoice has no Giảm giá column, 6 = 4 × 5). A part
 * payment stays one line of what was collected until the BA rules on it.
 *
 * Real API on the logged-in session: a catalog service is made, put on a fresh
 * slip ×10, collected, ✓'d, and the receipt's e-invoice draft is read back.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const TAX = { NotTaxable: 0, Eight: 4 } as const;
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
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  vatRate: number;
  taxAmount: number;
  amount: number;
}

async function catalogService(page: Page, name: string, price: number, taxRate: number): Promise<string> {
  const groups = await call(page, `/api/v1/app/taxonomies?group=care_service&clinicBranchId=${BRANCH_ONE}&maxResultCount=1`);
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
  line: { serviceId: string; price: number; quantity: number; discountType?: number; discountValue?: number },
): Promise<{ slip: Slip; line: SlipLine }> {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  const patient = await call(page, "/api/v1/app/patients", {
    method: "POST",
    json: { firstName: `HĐ SL ${tag}`, lastName: "E2E", dateOfBirth: null, gender: "male", phoneNumber: `07${digits}` },
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

/** A receipt of `amount` on the one line, settled ("Đã thanh toán"), and its e-invoice draft's lines. */
async function invoiceLinesOf(page: Page, slip: Slip, line: SlipLine, amount: number): Promise<InvoiceLine[]> {
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
    },
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(200);
  await settleReceipt(page, { id: String(receipt.body.id), clinicBranchId: String(receipt.body.clinicBranchId) });

  const draft = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${String(receipt.body.id)}`);
  expect(draft.status, JSON.stringify(draft.body)).toBe(200);
  expect(draft.body.maxAmount).toBe(amount);
  return draft.body.lines as InvoiceLine[];
}

test.describe("Hóa đơn điện tử từ phiếu thu: Số lượng và Đơn giá của phiếu điều trị (API, R-1258)", () => {
  test("a service paid in full bills 10 × 500.000, a part payment stays 1 × what was paid", async ({ page }) => {
    await login(page);
    const id = runId();
    const serviceId = await catalogService(page, `HĐ SL ${id}`, 500_000, TAX.NotTaxable);

    const full = await slipWith(page, `${id} đủ`, { serviceId, price: 500_000, quantity: 10 });
    expect(full.line.quantity).toBe(10);
    expect(full.line.payableAmount).toBe(5_000_000);
    const [paid] = await invoiceLinesOf(page, full.slip, full.line, 5_000_000);
    expect(paid).toMatchObject({ quantity: 10, unitPrice: 500_000, total: 5_000_000, taxAmount: 0, amount: 5_000_000 });

    // UNKNOWN until the BA answers: how a part payment should read. Today it is one line of the đợt.
    const part = await slipWith(page, `${id} 1 phần`, { serviceId, price: 500_000, quantity: 10 });
    const [partLine] = await invoiceLinesOf(page, part.slip, part.line, 2_000_000);
    expect(partLine).toMatchObject({ quantity: 1, unitPrice: 2_000_000, total: 2_000_000, amount: 2_000_000 });
  });

  test("a discounted line bills its price after the discount, a taxed line its price before VAT", async ({ page }) => {
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
    const [cut] = await invoiceLinesOf(page, discounted.slip, discounted.line, 4_500_000);
    expect(cut).toMatchObject({ quantity: 10, unitPrice: 450_000, total: 4_500_000, amount: 4_500_000 });

    // 8 % VAT: 10 × 900.000 + 720.000 = 9.720.000 collected.
    const taxedId = await catalogService(page, `HĐ SL VAT ${id}`, 900_000, TAX.Eight);
    const taxed = await slipWith(page, `${id} VAT`, { serviceId: taxedId, price: 900_000, quantity: 10 });
    expect(taxed.line.payableAmount).toBe(9_720_000);
    const [vat] = await invoiceLinesOf(page, taxed.slip, taxed.line, 9_720_000);
    expect(vat).toMatchObject({
      quantity: 10,
      unitPrice: 900_000,
      total: 9_000_000,
      vatRate: 8,
      taxAmount: 720_000,
      amount: 9_720_000,
    });
  });
});
