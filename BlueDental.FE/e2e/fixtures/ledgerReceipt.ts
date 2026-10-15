import { expect, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";

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
  /** 1 = "Chưa thanh toán" (legacy only), 2 = "Hoàn tất" — every new receipt (owner 2026-10-13). */
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

export async function createSlipViaApi(
  page: Page,
  patientId: string,
  teeth: number[] = [14],
): Promise<NewSlipRecord> {
  return page.evaluate(async ({ patientId, teeth }) => {
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
      dentistId: staff.id,
      discountType: 0,
      discountValue: 0,
      voucherIds: [],
      adviseIds: [advise.id],
    });
    return { id: plan.id as string, code: plan.code as string, serviceName: service.name, price };
  }, { patientId, teeth });
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

/**
 * "Tạo Phiếu Thanh Toán" for half of the first line, "Lưu", then "Có" in the
 * "Xác nhận thanh toán" question: the receipt is written "Hoàn tất" and moves
 * money at once (owner 2026-10-13). Returns the saved receipt.
 *
 * `redInvoice` ticks "Xuất hóa đơn đỏ" first: a Hoàn tất receipt refuses every
 * later write, so the flag can only go on as the receipt is made.
 */
export async function collectOnFirstLine(page: Page, { redInvoice = false } = {}): Promise<Receipt> {
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  await dialog.locator(".pd-newpay-amount").fill(String(Math.max(2, Math.floor(due / 2))));
  if (redInvoice) await dialog.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  return answerYes(page, dialog);
}

/**
 * The "Xác nhận thanh toán" question "Lưu" raises on a new receipt: "Có" sends
 * the one POST, and both dialogs close on the Hoàn tất receipt it returns.
 */
export async function answerYes(page: Page, createDialog: Locator): Promise<Receipt> {
  const saved = page.waitForResponse(
    (res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST",
  );
  await answerQuestionYes(page);
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(paymentQuestion(page)).toBeHidden();
  await expect(createDialog).toBeHidden();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.status).toBe(2);
  return receipt;
}

/** The question "Lưu" raises on a new receipt, the create dialog still open behind it. */
export function paymentQuestion(page: Page): Locator {
  return page.getByRole("dialog", { name: "Xác nhận thanh toán", exact: true });
}

/**
 * "Có" in that question — for specs that watch the POST themselves. The
 * question names the amount and says the receipt is paid once saved.
 */
export async function answerQuestionYes(page: Page): Promise<void> {
  const question = paymentQuestion(page);
  await expect(question).toBeVisible();
  await expect(question).toContainText("Phiếu sẽ được ghi nhận là đã thanh toán ngay khi lưu.");
  await question.getByRole("button", { name: "Có" }).click();
}

/** The body PUT …/{id} and PUT …/{id}/confirm take: the receipt's own figures unless overridden. Both refuse a Hoàn tất receipt. */
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
