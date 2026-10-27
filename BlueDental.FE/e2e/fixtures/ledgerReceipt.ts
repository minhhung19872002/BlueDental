import { expect, request, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, runId } from "./auth";

/**
 * A THANHTOAN receipt written the way the BA does it: a fresh slip on the first
 * patient, then "Tạo Phiếu Thanh Toán" on its Thanh toán tab. Shared by the
 * Tài chính → Thanh toán specs.
 */

export const PAYMENTS_API = "/api/v1/app/patient-payments";

export interface Receipt {
  id: string;
  code: string;
  amount: number;
  method: number;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string;
  treatmentPlanCode: string;
  staffId: string;
  /** RECEIPT_STATUS: a new receipt is 1 "Chưa thanh toán"; 3 "Đã xuất phiếu thu", 2 "Đã thanh toán", 4 "Phiếu bị hủy" (P2610). */
  status: number;
  lines: { treatmentServiceId: string; amount?: number }[];
}

/** A real request on the signed-in session, with the antiforgery header the app sends. */
export async function call(
  page: Page,
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.fetch(url, {
    method: options.method ?? "GET",
    data: options.json,
    headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status(), body };
}

export const money = (text: string) => Number(text.replace(/[^\d]/g, ""));

export function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

/** The first service worth something — a zero-priced one leaves nothing to collect. */
export async function pickPricedService(dropdown: Locator): Promise<void> {
  const options = dropdown.locator(".ant-select-item-option:has(.tp-opt-service)");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index++) {
    const option = options.nth(index);
    if (money(await option.locator(".tp-opt-price").innerText()) > 0) {
      await option.click();
      return;
    }
  }
  throw new Error("Danh mục dịch vụ không có mục nào còn giá");
}

/**
 * A slip of one priced service on `teeth` (14 by default) for `patientId`, written through
 * the chain the app runs — advise → accept → open slip — on the real API with
 * the browser's own session. The patient tab has no "Tạo kế hoạch mới" any
 * more (owner 2026-10-15): a slip is opened from Chẩn đoán & Tư vấn, and these
 * specs are about what happens on it, not how it was opened.
 */
export interface NewSlipRecord {
  id: string;
  code: string;
  /** The one line's service and the price it was written at. */
  serviceName: string;
  price: number;
}

/**
 * `dentistId` sets the slip's Bác sĩ điều trị; left out, the branch's first
 * staff member. A dentist only opens slips in their treating scope (R-961).
 */
export async function createSlipViaApi(
  page: Page,
  patientId: string,
  teeth: number[] = [14],
  dentistId: string | null = null,
): Promise<NewSlipRecord> {
  return page.evaluate(async ({ patientId, teeth, dentistId }) => {
    const xsrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("XSRF-TOKEN="))
      ?.substring("XSRF-TOKEN=".length);
    const get = async (url: string, branch?: string) =>
      (
        await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json", ...(branch ? { "X-Clinic-Branch-Id": branch } : {}) },
        })
      ).json();
    const patient = (await get(`/api/v1/app/patients/${patientId}`)) as { branchId: string };
    const branch = patient.branchId;
    const post = async (url: string, body?: unknown) => {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
      return res.json();
    };

    // A zero-priced service leaves nothing to collect, so the first one worth something.
    const services = (
      await get(
        `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1000`,
        branch,
      )
    ).items as {
      id: string;
      name: string;
      isDeleted: boolean;
      isCombo: boolean;
      price: number | null;
      serviceConfig?: { priceAfterDiscount: number; taxRate: number } | null;
    }[];
    // The picker's price — "Giá sau giảm" where the service has one — is the ceiling (Treatment:0040).
    const salePrice = (entry: (typeof services)[number]) => entry.serviceConfig?.priceAfterDiscount ?? entry.price ?? 0;
    // The list keeps soft-deleted entries (Danh mục shows them greyed), and a line
    // on one prints no service name. Nor one another spec made for its run (a
    // six-digit runId in the name): those lead the priority order and are deleted
    // by their spec mid-run. And a plain one — no combo, no VAT (rates 0–2 add
    // nothing) — so what the slip owes is the price the specs read off it.
    const service = services.find(
      (entry) =>
        !entry.isDeleted &&
        !entry.isCombo &&
        (entry.serviceConfig?.taxRate ?? 0) <= 2 &&
        salePrice(entry) > 0 &&
        !/\d{6}/.test(entry.name),
    );
    if (!service) throw new Error("Danh mục dịch vụ không có mục nào còn giá");
    const staff = (await get("/api/v1/app/staff?MaxResultCount=1", branch)).items[0] as { id: string };
    const price = salePrice(service);

    const advise = await post("/api/v1/app/patient-advises", {
      patientId,
      clinicBranchId: branch,
      patientDiagnosisId: null,
      diagnosisId: null,
      serviceId: service.id,
      staffId: staff.id,
      originalPrice: price,
      price,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      teeth: teeth.map((toothCode) => ({ toothCode, selected: true, top: false, right: false, bottom: false, left: false, center: false })),
    });
    await post(`/api/v1/app/patient-advises/${advise.id}/accept`);
    const plan = await post("/api/v1/app/patient-treatments", {
      patientId,
      clinicBranchId: branch,
      dentistId: dentistId ?? staff.id,
      discountType: 0,
      discountValue: 0,
      voucherIds: [],
      adviseIds: [advise.id],
    });
    return { id: plan.id as string, code: plan.code as string, serviceName: service.name, price };
  }, { patientId, teeth, dentistId });
}

export interface NewSlip {
  patientId: string;
  /** The patient record, without the query — what the specs come back to. */
  patientUrl: string;
  slip: NewSlipRecord;
}

/** A fresh one-line slip on the first patient; ends on its plan detail. */
export async function openNewSlip(page: Page): Promise<NewSlip> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  const patientUrl = page.url().split("?")[0];
  const patientId = /\/patient\/([0-9a-f-]{36})/.exec(patientUrl)![1];

  const slip = await createSlipViaApi(page, patientId);
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  // The slip list is read through the UI, so the new code shows up as the app lists it.
  await page.locator(".tp-table .tp-code", { hasText: new RegExp(`^${slip.code}$`) }).click({ timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/patient/${patientId}/treatment-plan/${slip.id}`));
  return { patientId, patientUrl, slip };
}

/** PatientPaymentStatus as the API writes it (P2610). */
export const RECEIPT_STATUS = { Pending: 1, Completed: 2, Issued: 3, Cancelled: 4 } as const;

/** The dialog button that writes a new receipt; "Lưu" only corrects a reopened one (P2610). */
export const CREATE_RECEIPT = "Tạo phiếu thanh toán";

/**
 * Tài chính → Phiếu thu, where a new receipt lands (`/billing/receipts/:id`):
 * headed with its number, its PHIẾU THU sheet beside the status column.
 */
export async function expectReceiptPage(page: Page, receipt: Pick<Receipt, "id" | "code">): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/billing/receipts/${receipt.id}`));
  await expect(page.locator(".rcpt-head-code")).toHaveText(`Phiếu thu ${receipt.code}`, { timeout: 20_000 });
  await expect(page.locator(".rcpt-sheet-number")).toHaveText(`Số: ${receipt.code}`);
}

/**
 * "Tạo Phiếu Thanh Toán" for half of the first line, then "Tạo phiếu thanh toán": the
 * "Chưa thanh toán" receipt. Run from the slip's Thanh toán tab.
 *
 * `redInvoice` ticks "Xuất hóa đơn đỏ" first: an exported or paid receipt
 * refuses every write, so the flag can only go on as the receipt is made.
 */
export async function writeOnFirstLine(page: Page, { redInvoice = false } = {}): Promise<Receipt> {
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  await dialog.locator(".pd-newpay-amount").fill(String(Math.max(2, Math.floor(due / 2))));
  if (redInvoice) await dialog.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
  return saveReceipt(page, dialog);
}

/** `writeOnFirstLine`, then walked to "Đã thanh toán" so the money counts (`settleReceipt`). */
export async function collectOnFirstLine(page: Page, options: { redInvoice?: boolean } = {}): Promise<Receipt> {
  return settleReceipt(page, await writeOnFirstLine(page, options));
}

/**
 * "Tạo phiếu thanh toán" on a filled create dialog: the one POST, no question
 * first, no money moved — a "Chưa thanh toán" receipt — and the app lands on
 * its receipt page (P2610). Then Back, to where the dialog was opened, so the
 * caller carries on there.
 */
export async function saveReceipt(page: Page, createDialog: Locator): Promise<Receipt> {
  const saved = page.waitForResponse(
    (res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST",
  );
  const openedFrom = page.url();
  await createDialog.getByRole("button", { name: CREATE_RECEIPT }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.status).toBe(RECEIPT_STATUS.Pending);
  await expectReceiptPage(page, receipt);
  await page.goBack();
  await expect(page).toHaveURL(openedFrom);
  return receipt;
}

/** `saveReceipt`, then `settleReceipt`: for specs about what paid money does, not how it got paid. */
export async function saveAndSettle(page: Page, createDialog: Locator): Promise<Receipt> {
  return settleReceipt(page, await saveReceipt(page, createDialog));
}

const SIGNING_API = "/api/v1/app/receipt-signing";
const DEVICES_API = "/api/v1/app/signing-devices";
const STATION_API = "/api/v1/public/signing-station";
/** A real 1 × 1 PNG: what the station takes is a PNG data URL, decoded and re-checked on the server. */
export const SIGNATURE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
/** Matches BlueDental.Billing.ReceiptSignMode. */
export const SIGN_MODE = { Unsigned: 1, Digital: 2 } as const;
/** Parallel workers share the branch's one iPad session; a send can take another's. */
const EXPORT_ATTEMPTS = 5;

/**
 * The customer's part on a paired iPad, through the station API the iPad
 * itself calls: the receipt sent to it (ending any session it showed), both
 * boxes ticked, the signature. The iPad has no staff session — its own
 * request context carries only the device token.
 */
export async function signOnStation(page: Page, receipt: Pick<Receipt, "id">, token: string): Promise<void> {
  const sent = await call(page, `${SIGNING_API}/${receipt.id}/send`, { method: "POST", json: { replace: true } });
  expect(sent.status, JSON.stringify(sent.body)).toBe(200);

  const ipad = await request.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const asIpad = { headers: { "X-Signing-Device-Token": token, Accept: "application/json" } };
    const current = await ipad.get(STATION_API, asIpad);
    expect(current.status(), await current.text()).toBe(200);
    const { sessionId } = (await current.json()) as { sessionId: string };
    const checked = await ipad.post(`${STATION_API}/sessions/${sessionId}/check`, asIpad);
    expect(checked.status(), await checked.text()).toBe(200);
    const signed = await ipad.post(`${STATION_API}/sessions/${sessionId}/sign`, {
      ...asIpad,
      data: { signatureDataUrl: SIGNATURE_PNG },
    });
    expect(signed.status(), await signed.text()).toBe(200);
  } finally {
    await ipad.dispose();
  }
}

/** An iPad paired to the receipt's branch for one export, then revoked so no other receipt goes to it. */
export async function withPairedIpad<T>(
  page: Page,
  receipt: Pick<Receipt, "clinicBranchId">,
  work: (token: string) => Promise<T>,
): Promise<T> {
  const paired = await call(page, DEVICES_API, {
    method: "POST",
    json: { clinicBranchId: receipt.clinicBranchId, name: `iPad e2e helper ${runId()}` },
  });
  expect(paired.status, JSON.stringify(paired.body)).toBe(200);
  try {
    return await work(String(paired.body.token));
  } finally {
    await call(page, `${DEVICES_API}/${String(paired.body.id)}/revoke`, { method: "POST" });
  }
}

/**
 * "Đã xuất phiếu thu" the real way (P2610 phases 4–5): signed by the
 * customer on a paired iPad, then exported Không ký số by the accountant —
 * the PDF/A written, sealed and kept. Specs about the money, not the export.
 */
export async function issueReceipt(page: Page, receipt: Pick<Receipt, "id" | "clinicBranchId">): Promise<Receipt> {
  return withPairedIpad(page, receipt, async (token) => {
    for (let attempt = 1; ; attempt += 1) {
      await signOnStation(page, receipt, token);
      const issued = await call(page, `${PAYMENTS_API}/${receipt.id}/export`, {
        method: "POST",
        json: { signMode: SIGN_MODE.Unsigned },
      });
      const takenOver = (issued.body.error as { code?: string } | undefined)?.code === "BlueDental:Billing:0112";
      if (takenOver && attempt < EXPORT_ATTEMPTS) continue;
      expect(issued.status, JSON.stringify(issued.body)).toBe(200);
      expect(issued.body.status).toBe(RECEIPT_STATUS.Issued);
      return issued.body as unknown as Receipt;
    }
  });
}

/**
 * Exported, then ✓ "Xác nhận thanh toán" on the API: "Đã thanh toán", and the
 * money counts. Reloads, so the page on screen reads the new figures.
 */
export async function settleReceipt(page: Page, receipt: Pick<Receipt, "id" | "clinicBranchId">): Promise<Receipt> {
  await issueReceipt(page, receipt);
  const confirmed = await call(page, `${PAYMENTS_API}/${receipt.id}/confirm`, { method: "PUT" });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
  expect(confirmed.body.status).toBe(RECEIPT_STATUS.Completed);
  await page.reload();
  return confirmed.body as unknown as Receipt;
}

/** The question ✓ raises on an exported receipt's row. */
export function confirmQuestion(page: Page): Locator {
  return page.getByRole("dialog", { name: "Xác nhận thanh toán", exact: true });
}

/**
 * ✓ on the receipt's row in the slip's Thanh toán tab, then "Có": the one PUT
 * …/confirm, and the receipt is "Đã thanh toán". The row must already be
 * "Đã xuất phiếu thu" on screen.
 */
export async function confirmOnRow(page: Page, scope: Locator, receipt: Pick<Receipt, "id" | "code">): Promise<Receipt> {
  await scope.getByRole("button", { name: `Xác nhận thanh toán phiếu ${receipt.code}` }).click();
  const question = confirmQuestion(page);
  await expect(question).toBeVisible();
  await expect(question).toContainText(`cho phiếu ${receipt.code}`);
  const confirmed = page.waitForResponse(
    (res) => res.url().endsWith(`${PAYMENTS_API}/${receipt.id}/confirm`) && res.request().method() === "PUT",
  );
  await question.getByRole("button", { name: "Có" }).click();
  const response = await confirmed;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(question).toBeHidden();
  const paid = (await response.json()) as Receipt;
  expect(paid.status).toBe(RECEIPT_STATUS.Completed);
  return paid;
}

/** The body PUT …/{id} takes: the receipt's own figures unless overridden. Refused once the receipt is exported. */
export function revisionOf(receipt: Receipt & { splitMode?: number; note?: string | null; paymentAccountId?: string | null }, amount = receipt.amount) {
  const splitMode = receipt.splitMode ?? 1;
  return {
    treatmentServiceIds: receipt.lines.map((line) => line.treatmentServiceId),
    splitMode,
    // Thủ công (2) names each line's share; Tự động leaves the split to the server.
    items: splitMode === 2 ? receipt.lines.map((line) => ({ treatmentServiceId: line.treatmentServiceId, amount: line.amount ?? 0 })) : [],
    method: receipt.method,
    amount,
    note: receipt.note ?? null,
    paymentAccountId: receipt.paymentAccountId ?? null,
  };
}
