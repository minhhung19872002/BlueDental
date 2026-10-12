import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { call, openNewSlip, PAYMENTS_API, revisionOf, writePendingOnFirstLine, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * F-71 Yêu cầu xuất HĐ (BA 2026-10-12): a receipt marked "Xuất hóa đơn đỏ"
 * prints its PHIẾU THU with a QR; the QR opens a public form; what the
 * customer sends lands on the patient's Hóa đơn tab as a request staff work
 * through Chờ xử lý → Đang xử lý → (Cần bổ sung) → Đã xuất HĐ / Đã hủy.
 *
 * Real stack only: real login, a fresh slip and receipts through the real
 * dialogs, every call a real HTTP request into PostgreSQL, the public page
 * called from a context with no session at all. The receipts stay "Chưa
 * thanh toán" and are cancelled at the end — none is confirmed, so no
 * e-invoice is ever issued.
 */

const REQUESTS = "/api/v1/app/invoice-requests";
const PUBLIC = "/api/v1/public/invoice-requests";
const RECEIPT_PDF = "/api/v1/app/e-invoices/receipt-pdf";

interface InvoiceRequest {
  id: string;
  code: string;
  status: number;
  source: number;
  patientPaymentId: string;
  paymentCode: string;
  fullName: string;
  phone: string;
  companyName: string | null;
  taxCode: string | null;
  isCompany: boolean;
  assigneeName: string | null;
  invoiceNo: string | null;
  reason: string | null;
  requestedAt: string;
  dueAt: string;
}

const errorCode = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code;
const tokenOf = (url: string) => url.substring(url.lastIndexOf("/") + 1);

/** A request with no cookie, no header — what a phone that scanned the QR sends. */
async function anonymous(baseURL: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { accept: "application/json" } });
}

async function json(res: Awaited<ReturnType<APIRequestContext["get"]>>) {
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function markRedInvoice(page: Page, receipt: Receipt): Promise<void> {
  const res = await call(page, `${PAYMENTS_API}/${receipt.id}`, {
    method: "PUT",
    json: { ...revisionOf(receipt), redInvoiceRequested: true },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.redInvoiceRequested).toBe(true);
  expect(res.body.status, "the receipt must stay unconfirmed").toBe(1);
}

test.describe("F-71 Yêu cầu xuất HĐ — real API", () => {
  test.setTimeout(180_000);

  test("QR form → request → workflow, with masking, single submit and branch scope", async ({ page, browser, baseURL }) => {
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const viaQr = await writePendingOnFirstLine(page);
    const byStaff = await writePendingOnFirstLine(page);
    const created: string[] = [];

    try {
      // ── ① A red-invoice receipt prints its PHIẾU THU (QR inside) and owns one link ──
      await markRedInvoice(page, viaQr);
      const pdf = await page.request.post(RECEIPT_PDF, {
        data: { patientPaymentId: viaQr.id, lines: [] },
        headers: {
          accept: "application/pdf, application/json",
          RequestVerificationToken: decodeURIComponent(
            (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "",
          ),
        },
      });
      expect(pdf.status(), await pdf.text()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");

      const link = await call(page, `${REQUESTS}/links/${viaQr.id}`, { method: "POST" });
      expect(link.status, JSON.stringify(link.body)).toBe(200);
      const url = String(link.body.url);
      expect(url).toMatch(/\/invoice-request\/[A-Za-z0-9_-]{43}$/);
      const again = await call(page, `${REQUESTS}/links/${viaQr.id}`, { method: "POST" });
      expect(tokenOf(String(again.body.url)), "one receipt keeps one QR").toBe(tokenOf(url));

      // ── ② The public form: no session, contact details only as hints ─────────
      const phone = await anonymous(baseURL ?? "http://127.0.0.1:8080");
      try {
        expect((await phone.get(`${REQUESTS}?patientId=${viaQr.patientId}`)).status(), "staff list needs a login").toBe(401);
        expect((await phone.get(`${PUBLIC}/short`)).status()).toBe(404);
        expect((await phone.get(`${PUBLIC}/${"x".repeat(43)}`)).status()).toBe(404);

        const form = await json(await phone.get(`${PUBLIC}/${tokenOf(url)}`));
        expect(form.status, JSON.stringify(form.body)).toBe(200);
        expect(form.body.paymentCode).toBe(viaQr.code);
        expect(form.body.amount).toBe(viaQr.amount);
        expect(String(form.body.fullName).length).toBeGreaterThan(0);
        expect(form.body.submitted).toBe(false);
        expect(form.body.expired).toBe(false);
        for (const hint of ["phoneHint", "nationalIdHint"] as const) {
          const value = form.body[hint];
          if (value) expect(String(value), `${hint} must be masked`).toContain("*");
        }

        const invalid = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, {
          data: { fullName: "Khách QR", companyName: "Công ty E2E", email: "e2e.qr@example.com" },
        }));
        expect(invalid.status, "a company needs its MST").toBe(403);
        expect(errorCode(invalid.body)).toBe("BlueDental:InvoiceRequest:0004");

        const sent = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, {
          data: {
            fullName: "Khách QR E2E",
            companyName: "Công ty TNHH E2E",
            taxCode: "0101234567",
            companyAddress: "1 Đường Thử, Hà Nội",
            email: "e2e.qr@example.com",
            wantsPaperInvoice: true,
          },
        }));
        expect(sent.status, JSON.stringify(sent.body)).toBe(200);
        expect(String(sent.body.code)).toMatch(/^YC-HD-\d{4}$/);

        const twice = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, { data: { fullName: "Lần hai" } }));
        expect(twice.status, "one answer per QR").toBe(403);
        expect(errorCode(twice.body)).toBe("BlueDental:InvoiceRequest:0013");
        expect((await json(await phone.get(`${PUBLIC}/${tokenOf(url)}`))).body.submitted).toBe(true);
      } finally {
        await phone.dispose();
      }

      // ── ③ It lands on the patient's list, read back by a separate GET ────────
      const listed = await call(page, `${REQUESTS}?patientId=${viaQr.patientId}&maxResultCount=50`);
      expect(listed.status).toBe(200);
      const qrRequest = (listed.body.items as InvoiceRequest[]).find((r) => r.patientPaymentId === viaQr.id);
      expect(qrRequest, "the customer's answer is on the Hóa đơn tab").toBeDefined();
      const request = qrRequest as InvoiceRequest;
      created.push(request.id);
      expect(request.status).toBe(1);
      expect(request.source).toBe(1);
      expect(request.isCompany).toBe(true);
      expect(request.taxCode).toBe("0101234567");
      expect(request.paymentCode).toBe(viaQr.code);
      expect(new Date(request.dueAt).getTime() - new Date(request.requestedAt).getTime()).toBe(24 * 3600 * 1000);

      const duplicate = await call(page, REQUESTS, {
        method: "POST",
        json: { patientPaymentId: viaQr.id, fullName: "Trùng" },
      });
      expect(duplicate.status, "one live request per receipt").toBe(403);
      expect(errorCode(duplicate.body)).toBe("BlueDental:InvoiceRequest:0008");

      // ── ④ Workflow: Xử lý → Cần bổ sung → (sửa) → Xử lý → Hoàn tất ──────────
      const path = (action: string) => `${REQUESTS}/${request.id}/${action}`;
      const started = await call(page, path("start"), { method: "POST" });
      expect(started.status, JSON.stringify(started.body)).toBe(200);
      expect(started.body.status).toBe(2);
      expect(started.body.assigneeName, "Xử lý takes the request").toBeTruthy();

      expect((await call(page, path("needs-info"), { method: "POST", json: { reason: "" } })).status).toBe(400);
      const asked = await call(page, path("needs-info"), { method: "POST", json: { reason: "Thiếu địa chỉ MST" } });
      expect(asked.body.status).toBe(3);
      expect(asked.body.reason).toBe("Thiếu địa chỉ MST");

      const edited = await call(page, `${REQUESTS}/${request.id}`, {
        method: "PUT",
        json: {
          fullName: "Khách QR E2E",
          companyName: "Công ty TNHH E2E",
          taxCode: "0101234567",
          companyAddress: "2 Đường Đã Sửa, Hà Nội",
          email: "e2e.qr@example.com",
          phone: request.phone,
          wantsPaperInvoice: true,
        },
      });
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      expect(edited.body.companyAddress).toBe("2 Đường Đã Sửa, Hà Nội");
      expect(edited.body.status, "a fix sends it back to the queue").toBe(1);

      expect((await call(page, path("start"), { method: "POST" })).body.status).toBe(2);
      expect((await call(page, path("complete"), { method: "POST", json: { invoiceNo: "" } })).status).toBe(400);
      const done = await call(page, path("complete"), { method: "POST", json: { invoiceNo: "0001234" } });
      expect(done.status, JSON.stringify(done.body)).toBe(200);
      expect(done.body.status).toBe(4);
      expect(done.body.invoiceNo).toBe("0001234");

      const late = await call(page, path("cancel"), { method: "POST", json: { reason: "quá muộn" } });
      expect(late.status, "an issued request is final").toBe(403);
      expect(errorCode(late.body)).toBe("BlueDental:InvoiceRequest:0009");

      // ── ⑤ Staff keys one in; Hủy frees the receipt for a new request ────────
      const options = await call(page, `${REQUESTS}/payment-options/${byStaff.patientId}`);
      const offered = (options.body as unknown as { patientPaymentId: string }[]).map((o) => o.patientPaymentId);
      expect(offered).toContain(byStaff.id);
      expect(offered, "a requested receipt is not offered again").not.toContain(viaQr.id);

      const draft = await call(page, `${REQUESTS}/draft/${byStaff.id}`);
      expect(draft.status).toBe(200);
      expect(draft.body.paymentCode).toBe(byStaff.code);
      // The dialog sends the drafted phone back as it shows it, masked or not.
      const staffForm = { patientPaymentId: byStaff.id, phone: draft.body.phone ?? "0900000071", email: "staff.e2e@example.com" };
      const keyed = await call(page, REQUESTS, {
        method: "POST",
        json: { ...staffForm, fullName: String(draft.body.fullName) },
      });
      expect(keyed.status, JSON.stringify(keyed.body)).toBe(200);
      created.push(String(keyed.body.id));
      expect(keyed.body.source).toBe(2);
      expect(keyed.body.isCompany).toBe(false);
      expect(keyed.body.requesterName, "staff-keyed rows name who keyed them").toBeTruthy();

      const stats = await call(page, `${REQUESTS}/stats?patientId=${byStaff.patientId}`);
      expect(Number(stats.body.open)).toBeGreaterThanOrEqual(1);
      expect(Number(stats.body.issued)).toBeGreaterThanOrEqual(1);
      const open = await call(page, `${REQUESTS}?patientId=${byStaff.patientId}&openOnly=true&maxResultCount=50`);
      const openIds = (open.body.items as InvoiceRequest[]).map((r) => r.id);
      expect(openIds).toContain(String(keyed.body.id));
      expect(openIds, "Đã xuất HĐ is not Cần xử lý").not.toContain(request.id);

      // ── ⑥ Another branch neither reads nor moves it ──────────────────────────
      const other = await browser.newContext();
      try {
        const branch2 = await other.newPage();
        await login(branch2, BRANCH2_USER);
        expect((await call(branch2, `${REQUESTS}/${String(keyed.body.id)}`)).status).toBe(403);
        expect((await call(branch2, `${REQUESTS}/${String(keyed.body.id)}/start`, { method: "POST" })).status).toBe(403);
      } finally {
        await other.close();
      }

      expect((await call(page, `${REQUESTS}/${String(keyed.body.id)}/cancel`, { method: "POST", json: { reason: "" } })).status).toBe(400);
      const cancelled = await call(page, `${REQUESTS}/${String(keyed.body.id)}/cancel`, {
        method: "POST",
        json: { reason: "Khách đổi ý" },
      });
      expect(cancelled.body.status).toBe(5);
      const reopened = await call(page, REQUESTS, {
        method: "POST",
        json: { ...staffForm, fullName: "Khách lại muốn HĐ" },
      });
      expect(reopened.status, "Đã hủy frees the receipt").toBe(200);
      created.push(String(reopened.body.id));
    } finally {
      for (const id of created) {
        await call(page, `${REQUESTS}/${id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
      }
      for (const receipt of [viaQr, byStaff]) {
        await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
      }
    }
  });
});
