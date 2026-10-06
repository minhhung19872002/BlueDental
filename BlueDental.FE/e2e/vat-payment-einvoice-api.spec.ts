import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 15 (2026-10-06): "[Báo giá / Kế hoạch điều trị] Không cộng VAT
 * của dịch vụ". A service of 1.000.000, −10 %, 8 % VAT shows "Thực thu gồm
 * VAT 972.000" in Danh mục, but the slip, the receipt and the e-invoice all
 * asked for 900.000.
 *
 * Real API on the logged-in session: the service is created in Danh mục, put
 * on an open slip, collected, and the receipt's e-invoice draft is read back.
 * Every follow-up is a separate request.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const TAX_EIGHT = 4; // ServiceTaxRate.Eight

interface Line {
  id: string;
  serviceId: string;
  chargedAmount: number;
  taxPercent: number;
  taxAmount: number;
  payableAmount: number;
  outstandingAmount: number;
  paidAmount: number;
}

interface Slip {
  id: string;
  code: string;
  patientId: string;
  branchId: string;
  dentistId: string;
  status: number;
  taxAmount: number;
  payableAmount: number;
  totalAmount: number;
  services: Line[];
}

async function taxedService(page: Page, id: string): Promise<string> {
  const groups = await call(page, `/api/v1/app/taxonomies?group=care_service&clinicBranchId=${BRANCH_ONE}&maxResultCount=1`);
  const taxonomyId = (groups.body.items as { id: string }[])[0].id;
  const created = await call(page, "/api/v1/app/catalog-entries", {
    method: "POST",
    json: {
      taxonomyId,
      name: `VAT 8% ${id}`,
      price: 1_000_000,
      sortOrder: 9999,
      serviceConfig: {
        taxRate: TAX_EIGHT,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 10,
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
  expect(created.status).toBe(200);
  // The catalog's own figures, the ones the bug list quotes.
  const config = (created.body as { serviceConfig: { priceAfterDiscount: number; amountCollected: number } }).serviceConfig;
  expect(config.priceAfterDiscount).toBe(900_000);
  expect(config.amountCollected).toBe(972_000);
  return created.body.id as string;
}

/** An open slip of the first branch that takes a new line; returns it with the line added. */
async function addToOpenSlip(page: Page, serviceId: string): Promise<{ slip: Slip; line: Line }> {
  const list = await call(page, `/api/v1/app/patient-treatments?clinicBranchId=${BRANCH_ONE}&maxResultCount=50`);
  const open = (list.body.items as Slip[]).filter((s) => s.status < 5 && s.branchId === BRANCH_ONE);
  for (const slip of open) {
    const added = await call(page, `/api/v1/app/patient-treatments/${slip.id}/services`, {
      method: "POST",
      // The picker offers the catalog's giá sau giảm; the catalog price is the ceiling.
      json: { serviceId, price: 900_000, quantity: 1, discountType: 0, discountValue: 0, teeth: [] },
    });
    if (added.status !== 200) continue;
    const next = added.body as unknown as Slip;
    const line = next.services.find((s) => s.serviceId === serviceId)!;
    return { slip: next, line };
  }
  throw new Error("no open slip in the first branch takes a new line");
}

test.describe("VAT của dịch vụ vào kế hoạch, phiếu thu và hóa đơn (API)", () => {
  test("a 1.000.000 −10 % +8 % service is charged, collected and invoiced at 972.000", async ({ page }) => {
    await login(page);
    const serviceId = await taxedService(page, runId());
    const { slip, line } = await addToOpenSlip(page, serviceId);

    // ── The slip line carries the service's VAT ─────────────────────────
    expect(line.chargedAmount).toBe(900_000);
    expect(line.taxPercent).toBe(8);
    expect(line.taxAmount).toBe(72_000);
    expect(line.payableAmount).toBe(972_000);
    expect(line.outstandingAmount).toBe(972_000);
    expect(slip.payableAmount - slip.totalAmount).toBe(slip.taxAmount);

    // ── The slip's e-invoice draft bills VAT on top of Thành tiền ───────
    const slipDraft = await call(page, `/api/v1/app/e-invoices/draft?treatmentPlanId=${slip.id}`);
    expect(slipDraft.status).toBe(200);
    expect(slipDraft.body.maxAmount).toBe(slip.payableAmount);
    const slipLines = slipDraft.body.lines as { vatRate: number; total: number; taxAmount: number; amount: number }[];
    const eight = slipLines.find((l) => l.vatRate === 8)!;
    expect(eight.taxAmount).toBeGreaterThanOrEqual(72_000);
    expect(eight.amount).toBe(eight.total + eight.taxAmount);

    // ── Collected VAT included: 972.000 clears the line ─────────────────
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
        amount: 972_000,
        staffId: slip.dentistId,
      },
    });
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(200);

    const after = (await call(page, `/api/v1/app/patient-treatments/${slip.id}`)).body as unknown as Slip;
    const paidLine = after.services.find((s) => s.id === line.id)!;
    expect(paidLine.paidAmount).toBe(972_000);
    expect(paidLine.outstandingAmount).toBe(0);

    // ── The receipt's e-invoice backs the VAT out of what was paid ──────
    const draft = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${receipt.body.id as string}`);
    expect(draft.status).toBe(200);
    expect(draft.body.maxAmount).toBe(972_000);
    const lines = draft.body.lines as { vatRate: number; total: number; taxAmount: number; amount: number }[];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ vatRate: 8, total: 900_000, taxAmount: 72_000, amount: 972_000 });
  });
});
