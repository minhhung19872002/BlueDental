import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { sqlScalar } from "./fixtures/chatApi";
import {
  call,
  collectOnFirstLine,
  openNewSlip,
  PAYMENTS_API,
  revisionOf,
  settleReceipt,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * F-71 Yêu cầu xuất HĐ (BA 2026-10-12, flow P1811): a receipt marked "Xuất hóa
 * đơn đỏ" prints its PHIẾU THU with a QR; the QR opens a public form; what the
 * customer sends lands as a Mới request. Xử lý hands it to EasyInvoice (Chờ xử
 * lý), whose sync brings it back Đã xuất HĐ or Đã hủy; Đã hủy is sent again
 * (Xử lý lại) or closed for good (Hủy yêu cầu → Đã hủy yêu cầu).
 *
 * Real stack only: real login, a fresh slip and receipts through the real
 * dialogs, every call a real HTTP request into PostgreSQL, the public page
 * called from a context with no session at all. Nothing here sends an invoice
 * to EasyInvoice: Xử lý is only called where the server must refuse it before
 * sending (a 9-digit CCCD, a state that is not Mới / Đã hủy), and the states
 * only EasyInvoice can produce are written straight into the database.
 */

const REQUESTS = "/api/v1/app/invoice-requests";
const PUBLIC = "/api/v1/public/invoice-requests";
const RECEIPT_PDF = "/api/v1/app/e-invoices/receipt-pdf";

const STATUS = { Pending: 1, Processing: 2, Issued: 4, Cancelled: 5, Withdrawn: 6 } as const;

interface InvoiceRequest {
  id: string;
  code: string;
  status: number;
  source: number;
  patientPaymentId: string;
  paymentCode: string;
  fullName: string;
  birthYear: number | null;
  phone: string;
  nationalId: string | null;
  email: string;
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

/**
 * What only EasyInvoice's sync can do — Chờ xử lý, Đã xuất HĐ, Đã hủy — written
 * into PostgreSQL, so no invoice is ever sent from a test. The id is the API's.
 */
function forceStatus(id: string, status: number, extra = ""): void {
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  sqlScalar(`update bd_invoice_requests set "Status"=${status}${extra} where "Id"='${id}'`);
}

const issue = (id: string, invoiceNo: string) =>
  forceStatus(id, STATUS.Issued, `,"InvoiceNo"='${invoiceNo}',"CompletedAt"=now()`);

/** Every action that needs Mới or Đã hủy is refused with 0009, and nothing moved. */
async function expectViewOnly(page: Page, id: string, status: number) {
  for (const action of ["process", "withdraw"]) {
    const res = await call(page, `${REQUESTS}/${id}/${action}`, { method: "POST", json: { reason: "e2e" } });
    expect(res.status, `${action} on status ${status}`).toBe(403);
    expect(errorCode(res.body)).toBe("BlueDental:InvoiceRequest:0009");
  }
  expect((await call(page, `${REQUESTS}/${id}`)).body.status).toBe(status);
}

async function withdrawAll(page: Page, ids: string[]) {
  for (const id of ids) {
    await call(page, `${REQUESTS}/${id}/withdraw`, { method: "POST", json: { reason: "e2e cleanup" } });
  }
}

test.describe("F-71 Yêu cầu xuất HĐ — real API", () => {
  test.setTimeout(180_000);

  test("QR form → request → P1811 flow, with masking, single submit and branch scope", async ({ page, browser, baseURL }) => {
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const viaQr = await collectOnFirstLine(page, { redInvoice: true });
    const byStaff = await collectOnFirstLine(page);
    const created: string[] = [];
    let patientName: string | undefined;

    try {
      // ── ① A red-invoice receipt prints its PHIẾU THU (QR inside) and owns one link ──
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
        patientName = String(form.body.fullName);
        expect(form.body.submitted).toBe(false);
        expect(form.body.expired).toBe(false);
        for (const hint of ["phoneHint", "nationalIdHint"] as const) {
          const value = form.body[hint];
          if (value) expect(String(value), `${hint} must be masked`).toContain("*");
        }

        const company = { isCompany: true, companyName: "Công ty TNHH E2E", taxCode: "0101234567" };
        const noTaxCode = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, {
          data: { isCompany: true, companyName: "Công ty E2E", companyAddress: "1 Đường Thử" },
        }));
        expect(noTaxCode.status, "a company needs its MST").toBe(403);
        expect(errorCode(noTaxCode.body)).toBe("BlueDental:InvoiceRequest:0004");
        // EasyInvoice refuses a Mã số thuế with no address, so the form does too.
        const noAddress = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, { data: company }));
        expect(noAddress.status, JSON.stringify(noAddress.body)).toBe(403);
        expect(errorCode(noAddress.body)).toBe("BlueDental:InvoiceRequest:0018");

        const sent = await json(await phone.post(`${PUBLIC}/${tokenOf(url)}`, {
          data: {
            ...company,
            // Công ty asks no personal lines: whatever comes is dropped (R-916).
            fullName: "Khách QR E2E",
            phone: "0900000916",
            nationalId: "012345678916",
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

      // ── ③ It lands on the patient's list as Mới, read back by a separate GET ──
      const listed = await call(page, `${REQUESTS}?patientId=${viaQr.patientId}&maxResultCount=50`);
      expect(listed.status).toBe(200);
      const qrRequest = (listed.body.items as InvoiceRequest[]).find((r) => r.patientPaymentId === viaQr.id);
      expect(qrRequest, "the customer's answer is on the Hóa đơn tab").toBeDefined();
      const request = qrRequest as InvoiceRequest;
      created.push(request.id);
      expect(request.status).toBe(STATUS.Pending);
      expect(request.source).toBe(1);
      expect(request.isCompany).toBe(true);
      expect(request.taxCode).toBe("0101234567");
      expect(request.fullName, "Công ty keeps the patient's name, not the one typed").toBe(patientName);
      expect([request.phone, request.nationalId, request.birthYear], "Công ty stores no personal lines").toEqual(["", null, null]);
      expect(request.email).toBe("e2e.qr@example.com");
      expect(request.paymentCode).toBe(viaQr.code);
      expect(request.assigneeName, "nobody pressed Xử lý yet").toBeNull();
      expect(new Date(request.dueAt).getTime() - new Date(request.requestedAt).getTime()).toBe(24 * 3600 * 1000);

      const duplicate = await call(page, REQUESTS, {
        method: "POST",
        json: { patientPaymentId: viaQr.id, fullName: "Trùng" },
      });
      expect(duplicate.status, "one live request per receipt").toBe(403);
      expect(errorCode(duplicate.body)).toBe("BlueDental:InvoiceRequest:0008");

      // ── ④ Mới can be corrected; once EasyInvoice issued it, it is only looked at ──
      const edited = await call(page, `${REQUESTS}/${request.id}`, {
        method: "PUT",
        json: { isCompany: true, companyName: "Công ty TNHH E2E", taxCode: "0101234567", companyAddress: "2 Đường Đã Sửa, Hà Nội" },
      });
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      expect(edited.body.companyAddress).toBe("2 Đường Đã Sửa, Hà Nội");
      expect(edited.body.email, "Email is optional for a company too").toBeFalsy();
      expect(edited.body.fullName, "an edit keeps the name on the request").toBe(patientName);
      expect(edited.body.status).toBe(STATUS.Pending);

      issue(request.id, "0001234");
      const issued = await call(page, `${REQUESTS}/${request.id}`);
      expect([issued.body.status, issued.body.invoiceNo]).toEqual([STATUS.Issued, "0001234"]);
      await expectViewOnly(page, request.id, STATUS.Issued);
      const lateEdit = await call(page, `${REQUESTS}/${request.id}`, { method: "PUT", json: { isCompany: true, ...edited.body } });
      expect(lateEdit.status, "an issued request is final").toBe(403);
      expect(errorCode(lateEdit.body)).toBe("BlueDental:InvoiceRequest:0009");

      // ── ⑤ Staff key one in: Cá nhân needs the CCCD and an address, not the SĐT ──
      const options = await call(page, `${REQUESTS}/payment-options/${byStaff.patientId}`);
      const offered = (options.body as unknown as { patientPaymentId: string }[]).map((o) => o.patientPaymentId);
      expect(offered).toContain(byStaff.id);
      expect(offered, "a requested receipt is not offered again").not.toContain(viaQr.id);

      const draft = await call(page, `${REQUESTS}/draft/${byStaff.id}`);
      expect(draft.status).toBe(200);
      expect(draft.body.paymentCode).toBe(byStaff.code);
      const fullName = String(draft.body.fullName);
      // A 9-digit CMND is still taken, but cannot be the invoice's Mã số thuế.
      const staffForm = { patientPaymentId: byStaff.id, fullName, nationalId: "012345678", personalAddress: "3 Đường Thử, Hà Nội" };

      const noCccd = await call(page, REQUESTS, { method: "POST", json: { ...staffForm, nationalId: null } });
      expect(noCccd.status, JSON.stringify(noCccd.body)).toBe(403);
      expect(errorCode(noCccd.body)).toBe("BlueDental:InvoiceRequest:0016");
      const noPersonalAddress = await call(page, REQUESTS, { method: "POST", json: { ...staffForm, personalAddress: " " } });
      expect(noPersonalAddress.status, "the CCCD goes out as a Mã số thuế, which needs an address").toBe(403);
      expect(errorCode(noPersonalAddress.body)).toBe("BlueDental:InvoiceRequest:0018");
      const noCompanyAddress = await call(page, REQUESTS, {
        method: "POST",
        json: { patientPaymentId: byStaff.id, isCompany: true, companyName: "Công ty E2E", taxCode: "0101234567" },
      });
      expect(noCompanyAddress.status, JSON.stringify(noCompanyAddress.body)).toBe(403);
      expect(errorCode(noCompanyAddress.body)).toBe("BlueDental:InvoiceRequest:0018");

      const keyed = await call(page, REQUESTS, {
        method: "POST",
        // No SĐT; a company line sent with Cá nhân is dropped.
        json: { ...staffForm, companyName: "Bỏ qua" },
      });
      expect(keyed.status, JSON.stringify(keyed.body)).toBe(200);
      const keyedId = String(keyed.body.id);
      created.push(keyedId);
      expect([keyed.body.companyName, keyed.body.nationalId, keyed.body.personalAddress]).toEqual([null, "012345678", "3 Đường Thử, Hà Nội"]);
      expect([keyed.body.source, keyed.body.isCompany, keyed.body.status]).toEqual([2, false, STATUS.Pending]);
      expect(keyed.body.requesterName, "staff-keyed rows name who keyed them").toBeTruthy();

      // Xử lý checks the buyer before anything is sent: a 9-digit CCCD is refused, nothing moves.
      const refused = await call(page, `${REQUESTS}/${keyedId}/process`, { method: "POST" });
      expect(refused.status, JSON.stringify(refused.body)).toBe(403);
      expect(errorCode(refused.body)).toBe("BlueDental:InvoiceRequest:0017");
      const unmoved = await call(page, `${REQUESTS}/${keyedId}`);
      expect([unmoved.body.status, unmoved.body.assigneeName]).toEqual([STATUS.Pending, null]);

      const stats = await call(page, `${REQUESTS}/stats?patientId=${byStaff.patientId}`);
      expect(Number(stats.body.pending)).toBeGreaterThanOrEqual(1);
      expect(Number(stats.body.issued)).toBeGreaterThanOrEqual(1);
      const open = await call(page, `${REQUESTS}?patientId=${byStaff.patientId}&openOnly=true&maxResultCount=50`);
      const openIds = (open.body.items as InvoiceRequest[]).map((r) => r.id);
      expect(openIds).toContain(keyedId);
      expect(openIds, "Đã xuất HĐ is not Cần xử lý").not.toContain(request.id);

      // ── ⑥ Another branch neither reads nor moves it ──────────────────────────
      const other = await browser.newContext();
      try {
        const branch2 = await other.newPage();
        await login(branch2, BRANCH2_USER);
        expect((await call(branch2, `${REQUESTS}/${keyedId}`)).status).toBe(403);
        for (const action of ["process", "withdraw"]) {
          const res = await call(branch2, `${REQUESTS}/${keyedId}/${action}`, { method: "POST", json: { reason: "e2e" } });
          expect(res.status, `branch 2 ${action}`).toBe(403);
        }
        const all = await call(branch2, `${REQUESTS}?maxResultCount=50`);
        expect((all.body.items as InvoiceRequest[]).map((r) => r.id), "Hóa đơn đỏ lists only its own branch").not.toContain(keyedId);
      } finally {
        await other.close();
      }
      // The branch-wide list (Tài chính › Hóa đơn đỏ) has it for this branch.
      const branchList = await call(page, `${REQUESTS}?maxResultCount=50`);
      expect((branchList.body.items as InvoiceRequest[]).map((r) => r.id)).toContain(keyedId);

      // ── ⑦ Hủy yêu cầu needs a reason, closes it for good and frees the receipt ──
      const withdraw = (id: string, reason: string) =>
        call(page, `${REQUESTS}/${id}/withdraw`, { method: "POST", json: { reason } });
      expect((await withdraw(keyedId, "")).status).toBe(400);
      const withdrawn = await withdraw(keyedId, "Khách đổi ý");
      expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200);
      expect([withdrawn.body.status, withdrawn.body.reason]).toEqual([STATUS.Withdrawn, "Khách đổi ý"]);
      await expectViewOnly(page, keyedId, STATUS.Withdrawn);

      const reopened = await call(page, REQUESTS, {
        method: "POST",
        json: { patientPaymentId: byStaff.id, isCompany: true, companyName: "Công ty Lại E2E", taxCode: "0101234567", companyAddress: "4 Đường Thử" },
      });
      expect(reopened.status, "Đã hủy yêu cầu frees the receipt").toBe(200);
      const reopenedId = String(reopened.body.id);
      created.push(reopenedId);

      // ── ⑧ Chờ xử lý is EasyInvoice's turn; Đã hủy comes back to be decided ──
      forceStatus(reopenedId, STATUS.Processing, `,"ProcessedAt"=now()`);
      await expectViewOnly(page, reopenedId, STATUS.Processing);
      forceStatus(reopenedId, STATUS.Cancelled, `,"Reason"='EasyInvoice: e2e hủy'`);
      const cancelled = await call(page, `${REQUESTS}/${reopenedId}`);
      expect([cancelled.body.status, cancelled.body.reason]).toEqual([STATUS.Cancelled, "EasyInvoice: e2e hủy"]);
      const reopenedOpen = await call(page, `${REQUESTS}?patientId=${byStaff.patientId}&openOnly=true&maxResultCount=50`);
      expect((reopenedOpen.body.items as InvoiceRequest[]).map((r) => r.id), "Đã hủy needs a decision").toContain(reopenedId);
      expect((await withdraw(reopenedId, "Khách không lấy HĐ nữa")).body.status).toBe(STATUS.Withdrawn);
    } finally {
      await withdrawAll(page, created);
    }
  });

  // P2610: a paid receipt is taken back with one of the fixed reasons, and that
  // cancel still closes its open request and voids its QR (R-915).
  test("R-915: Hủy phiếu closes its open request and voids the QR; an issued one stays", async ({ page, baseURL }) => {
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const issuedOn = await collectOnFirstLine(page, { redInvoice: true });
    const openOn = await collectOnFirstLine(page);
    const created: string[] = [];

    try {
      // One request at Đã xuất HĐ, one waiting on EasyInvoice (Chờ xử lý), each with its QR.
      const issuedLink = await call(page, `${REQUESTS}/links/${issuedOn.id}`, { method: "POST" });
      const keyed = async (receipt: Receipt) => {
        const draft = await call(page, `${REQUESTS}/draft/${receipt.id}`);
        const res = await call(page, REQUESTS, {
          method: "POST",
          json: {
            patientPaymentId: receipt.id,
            fullName: String(draft.body.fullName),
            nationalId: "012345678915",
            personalAddress: "915 Đường Thử, Hà Nội",
          },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        created.push(String(res.body.id));
        return String(res.body.id);
      };
      const issuedId = await keyed(issuedOn);
      issue(issuedId, "0000915");
      const openId = await keyed(openOn);
      forceStatus(openId, STATUS.Processing, `,"ProcessedAt"=now()`);

      for (const receipt of [issuedOn, openOn]) {
        const res = await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reasonCode: 4, reason: "e2e R-915" } });
        expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
      }

      // Read back with separate GETs.
      const open = await call(page, `${REQUESTS}/${openId}`);
      expect(open.body.status, "the open request died with its receipt").toBe(STATUS.Withdrawn);
      expect(String(open.body.reason)).toMatch(/^(Phiếu thu đã bị hủy|Receipt cancelled): e2e R-915$/);
      const issued = await call(page, `${REQUESTS}/${issuedId}`);
      expect(issued.body.status, "an issued request stays as history").toBe(STATUS.Issued);
      expect(issued.body.invoiceNo).toBe("0000915");

      // The link button and the QR now say "cancelled", not "no entity".
      const link = await call(page, `${REQUESTS}/links/${openOn.id}`, { method: "POST" });
      expect(link.status).toBe(403);
      expect(errorCode(link.body)).toBe("BlueDental:InvoiceRequest:0015");
      const phone = await anonymous(baseURL ?? "http://127.0.0.1:8080");
      try {
        const form = await json(await phone.get(`${PUBLIC}/${tokenOf(String(issuedLink.body.url))}`));
        expect(form.status).toBe(403);
        expect(errorCode(form.body)).toBe("BlueDental:InvoiceRequest:0015");
      } finally {
        await phone.dispose();
      }
      await page.goto(`/invoice-request/${tokenOf(String(issuedLink.body.url))}`);
      await expect(page.getByRole("heading", { name: /Phiếu thu đã bị hủy|Receipt cancelled/ })).toBeVisible();
      await expect(page.locator("form")).toHaveCount(0);
    } finally {
      await withdrawAll(page, created);
    }
  });

  // P2910_02: Dịch vụ on the QR form is the name the receipt printed
  // ("Tên trên phiếu"), not the catalog's — and the staff draft agrees.
  test("R-1081: the QR form names the service as the receipt does", async ({ page, baseURL }) => {
    await login(page);
    const { slip } = await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();

    // Đợt 1 gives the line no name of its own: the catalog's is read.
    const plain = await collectOnFirstLine(page, { redInvoice: true });
    const plainDraft = await call(page, `${REQUESTS}/draft/${plain.id}`);
    expect(plainDraft.status, JSON.stringify(plainDraft.body)).toBe(200);
    expect(plainDraft.body.serviceName).toBe(slip.serviceName);

    // Đợt 2 comes prefilled "… – Đợt 2"; the cashier's own wording wins.
    const written = await writeOnFirstLine(page, { redInvoice: true });
    const receiptName = `${slip.serviceName} – Đợt e2e ${written.code}`;

    const named = await call(page, `${PAYMENTS_API}/${written.id}`, {
      method: "PUT",
      json: {
        ...revisionOf(written),
        redInvoiceRequested: true,
        lineTerms: [{ treatmentServiceId: written.lines[0].treatmentServiceId, receiptName, cashierDiscount: 0 }],
      },
    });
    expect(named.status, JSON.stringify(named.body)).toBe(200);
    await settleReceipt(page, written);

    const draft = await call(page, `${REQUESTS}/draft/${written.id}`);
    expect(draft.status, JSON.stringify(draft.body)).toBe(200);
    expect(draft.body.serviceName).toBe(receiptName);

    const link = await call(page, `${REQUESTS}/links/${written.id}`, { method: "POST" });
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const phone = await anonymous(baseURL ?? "http://127.0.0.1:8080");
    try {
      const form = await json(await phone.get(`${PUBLIC}/${tokenOf(String(link.body.url))}`));
      expect(form.status, JSON.stringify(form.body)).toBe(200);
      expect(form.body.serviceName).toBe(receiptName);
      expect(form.body.serviceName).not.toBe(slip.serviceName);
    } finally {
      await phone.dispose();
    }
  });
});
