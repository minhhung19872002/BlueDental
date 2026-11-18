import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { sqlScalar } from "./fixtures/chatApi";
import { call, collectOnFirstLine, openNewSlip } from "./fixtures/ledgerReceipt";

/**
 * F-71 Yêu cầu xuất HĐ through the screens (BA 2026-10-12, flow P1811): the
 * customer opens the QR link of a red-invoice PHIẾU THU on a phone with no
 * session and sends THÔNG TIN XUẤT HÓA ĐƠN; staff see it on the patient's Hóa
 * đơn tab as Mới, key one in for another receipt, and work both from there or
 * from Tài chính › Hóa đơn đỏ.
 *
 * Real stack only — no route interception. Nothing here sends an invoice to
 * EasyInvoice: Xử lý is pressed only on a request the server refuses before
 * sending (a 9-digit CCCD), and what only EasyInvoice's sync can produce (Đã
 * hủy, Đã xuất HĐ) is written straight into PostgreSQL.
 */

const REQUESTS = "/api/v1/app/invoice-requests";

const rowOf = (page: Page, code: string) => page.locator("tr.ant-table-row", { hasText: code });

/** Đã hủy / Đã xuất HĐ as EasyInvoice's sync would leave them. The id is the API's. */
function forceStatus(id: string, set: string): void {
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  sqlScalar(`update bd_invoice_requests set ${set} where "Id"='${id}'`);
}

test.describe("F-71 Yêu cầu xuất HĐ — screens", () => {
  test.setTimeout(240_000);

  test("QR page → Hóa đơn tab → staff request → P1811 buttons by status, kept after reload", async ({ page, browser }) => {
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const viaQr = await collectOnFirstLine(page, { redInvoice: true });
    const byStaff = await collectOnFirstLine(page);
    const created: string[] = [];

    try {
      const link = await call(page, `${REQUESTS}/links/${viaQr.id}`, { method: "POST" });
      expect(link.status, JSON.stringify(link.body)).toBe(200);
      const publicPath = new URL(String(link.body.url)).pathname;
      expect(publicPath).toMatch(/^\/invoice-request\/[A-Za-z0-9_-]{43}$/);

      // ── ① The customer's phone: no session, the receipt on top, contacts hidden ──
      const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      let qrCode = "";
      try {
        const phone = await phoneContext.newPage();
        await phone.goto(publicPath);
        await expect(phone.getByRole("heading", { name: "Thông tin xuất hóa đơn", level: 2 })).toBeVisible();
        await expect(phone.locator(".pir-head__receipt")).toContainText(viaQr.code);
        // Loại hóa đơn (BA, R-916): Cá nhân ticked first, only the personal lines on screen.
        const kind = phone.getByRole("radiogroup", { name: "Loại hóa đơn" });
        await expect(kind.getByRole("radio", { name: "Cá nhân" })).toHaveAttribute("aria-checked", "true");
        await expect(phone.getByLabel(/^Căn cước công dân/)).toBeVisible();
        await expect(phone.getByLabel("Tên công ty")).toHaveCount(0);
        await expect(phone.getByLabel(/^Email/)).toHaveCount(0);
        await expect(phone.getByText("BẮT BUỘC phải ghi MÃ SỐ THUẾ")).toHaveCount(0);
        await expect(phone.locator(".inv-paper__field", { hasText: "Số tiền:" })).toBeVisible();
        // The CCCD is the invoice's Mã số thuế, so the address is required (P1811).
        await expect(phone.locator(".inv-paper__lined-field", { hasText: "Địa chỉ cá nhân:" }).locator(".inv-paper__required")).toBeVisible();
        // A contact on file stays hidden: blank line, no "Để trống để giữ …" hint (BA, R-914).
        await expect(phone.getByLabel(/^SĐT/)).toHaveValue("");
        await expect(phone.getByText(/Để trống để giữ/)).toHaveCount(0);

        // Công ty swaps the personal lines for the MÃ SỐ THUẾ note, the company lines and Email.
        await kind.getByRole("radio", { name: "Công ty" }).click();
        await expect(kind.getByRole("radio", { name: "Công ty" })).toHaveAttribute("aria-checked", "true");
        await expect(phone.getByText("BẮT BUỘC phải ghi MÃ SỐ THUẾ")).toBeVisible();
        await expect(phone.getByLabel(/^SĐT/)).toHaveCount(0);
        await expect(phone.getByLabel(/^Căn cước công dân/)).toHaveCount(0);
        await expect(phone.locator(".inv-paper__field", { hasText: "Số tiền:" })).toBeVisible();

        // Tên công ty, Mã số thuế and Địa chỉ công ty are required.
        await phone.getByLabel("Tên công ty").fill("Công ty TNHH E2E QR");
        await phone.getByRole("button", { name: "Gửi thông tin" }).click();
        await expect(phone.getByText("Xuất hóa đơn cho công ty cần nhập Tên công ty và Mã số thuế.").first()).toBeVisible();
        await expect(phone.getByText("Vui lòng nhập địa chỉ: hóa đơn có mã số thuế cần địa chỉ người mua.").first()).toBeVisible();

        await phone.getByLabel("Mã số thuế").fill("0101234567");
        await phone.getByLabel(/^Địa chỉ công ty/).fill("1 Đường Thử, Hà Nội");
        await phone.getByLabel(/^Email/).fill("e2e.qr.ui@example.com");
        const sent = phone.waitForResponse((res) => res.url().includes("/api/v1/public/invoice-requests/") && res.request().method() === "POST");
        await phone.getByRole("button", { name: "Gửi thông tin" }).click();
        const response = await sent;
        expect(response.status(), await response.text()).toBe(200);
        qrCode = String(((await response.json()) as { code: string }).code);
        await expect(phone.getByRole("heading", { name: "Đã gửi thông tin" })).toBeVisible();
        await expect(phone.getByText(qrCode)).toBeVisible();

        await phone.reload();
        await expect(phone.getByRole("heading", { name: "Đã gửi trước đó" })).toBeVisible();
        await expect(phone.getByRole("button", { name: "Gửi thông tin" })).toHaveCount(0);

        await phone.goto(`/invoice-request/${"x".repeat(43)}`);
        await expect(phone.getByRole("heading", { name: "Liên kết không hợp lệ" })).toBeVisible();
      } finally {
        await phoneContext.close();
      }

      // ── ② It lands on the patient's Hóa đơn tab as Mới, with the tab badge ──
      await page.goto(`/patient/${viaQr.patientId}?tab=invoice`);
      const invoiceTab = page.locator("a.pill-tab", { hasText: "Hóa đơn" });
      await expect(invoiceTab.locator(".pill-tab__badge")).toHaveText(/^[1-9]\d*$/);
      await expect(page.getByRole("heading", { name: "Yêu cầu xuất hóa đơn" })).toBeVisible();
      const qrRow = rowOf(page, qrCode);
      await expect(qrRow).toBeVisible();
      await expect(qrRow).toContainText(viaQr.code);
      await expect(qrRow).toContainText("Công ty TNHH E2E QR");
      await expect(qrRow.locator(".ir-status")).toHaveText("Mới");
      // Mới offers only Xử lý (P1811), no Hủy yêu cầu.
      await expect(qrRow.getByRole("button", { name: "Xử lý", exact: true })).toBeVisible();
      await expect(qrRow.getByRole("button", { name: "Hủy yêu cầu" })).toHaveCount(0);

      // The detail is the paper sheet: company lines filled, "Không" ticked for paper.
      await qrRow.getByRole("button", { name: "Chi tiết" }).click();
      const detail = page.getByRole("dialog", { name: "Chi tiết yêu cầu xuất hóa đơn" });
      await expect(detail.locator(".inv-paper")).toContainText("0101234567");
      await expect(detail.getByText("BẮT BUỘC phải ghi MÃ SỐ THUẾ")).toBeVisible();
      await expect(detail.getByRole("checkbox", { name: "Không" })).toHaveAttribute("aria-checked", "true");
      await expect(detail.getByRole("checkbox", { name: "Có" })).toHaveAttribute("aria-checked", "false");
      await detail.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();
      await expect(detail).toBeHidden();

      const listed = await call(page, `${REQUESTS}?patientId=${viaQr.patientId}&maxResultCount=50`);
      const qrId = (listed.body.items as { id: string; code: string }[]).find((r) => r.code === qrCode)?.id ?? "";
      expect(qrId).not.toBe("");
      created.push(qrId);

      // ── ③ Staff key one in; Cá nhân's address is required on screen too ──────
      await page.getByRole("button", { name: "Tạo yêu cầu" }).click();
      const dialog = page.getByRole("dialog", { name: /Tạo yêu cầu/ });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("combobox", { name: "Phiếu thu" }).click();
      await page.locator(".ant-select-dropdown .ant-select-item-option", { hasText: byStaff.code }).click();
      await expect(dialog.getByLabel("Họ và tên")).not.toHaveValue("");
      // Cá nhân (the default) asks the CCCD and the address, not the Email (R-916).
      await expect(dialog.getByRole("radio", { name: "Cá nhân" })).toHaveAttribute("aria-checked", "true");
      await expect(dialog.getByLabel("Email")).toHaveCount(0);
      // A 9-digit CMND is taken here, and refused at Xử lý before anything is sent.
      await dialog.getByLabel("Căn cước công dân").fill("012345678");
      const address = dialog.getByLabel(/^Địa chỉ cá nhân/);
      await address.fill("");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(dialog.getByText("Vui lòng nhập địa chỉ: hóa đơn có mã số thuế cần địa chỉ người mua.")).toBeVisible();
      await address.fill("3 Đường Thử, Hà Nội");
      const posted = page.waitForResponse((res) => res.url().endsWith(REQUESTS) && res.request().method() === "POST");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      const createdRes = await posted;
      expect(createdRes.status(), await createdRes.text()).toBe(200);
      const staffRequest = (await createdRes.json()) as { id: string; code: string };
      created.push(staffRequest.id);
      await expect(dialog).toBeHidden();
      const staffRow = rowOf(page, staffRequest.code);
      await expect(staffRow).toContainText(byStaff.code);

      // Xử lý asks first, then the server's refusal is shown and the row stays Mới.
      await staffRow.getByRole("button", { name: "Xử lý", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Xử lý" });
      await expect(confirm).toContainText(staffRequest.code);
      await confirm.getByRole("button", { name: /Có$/ }).click();
      await expect(page.getByText("Hóa đơn cá nhân dùng CCCD làm mã số thuế: vui lòng nhập CCCD đủ 12 chữ số.")).toBeVisible();
      await expect(confirm).toBeHidden();
      await expect(staffRow.locator(".ir-status")).toHaveText("Mới");

      // ── ④ Both are still there after a reload (read back from PostgreSQL) ───
      await page.reload();
      await expect(rowOf(page, qrCode)).toBeVisible();
      await expect(rowOf(page, staffRequest.code).locator(".ir-status")).toHaveText("Mới");

      // ── ⑤ EasyInvoice cancelled one and issued the other ─────────────────────
      forceStatus(qrId, `"Status"=5,"Reason"='EasyInvoice: e2e hủy'`);
      forceStatus(staffRequest.id, `"Status"=4,"InvoiceNo"='0007100',"CompletedAt"=now()`);
      await page.reload();

      // Đã hủy is red, with Xử lý lại and Hủy yêu cầu.
      const cancelledTag = rowOf(page, qrCode).locator(".ir-status");
      await expect(cancelledTag).toHaveText("Đã hủy");
      await expect(cancelledTag).toHaveClass(/ir-status--red/);
      await expect(rowOf(page, qrCode)).toContainText("EasyInvoice: e2e hủy");
      await expect(rowOf(page, qrCode).getByRole("button", { name: "Xử lý lại" })).toBeVisible();
      await expect(rowOf(page, qrCode).getByRole("button", { name: "Xử lý", exact: true })).toHaveCount(0);

      // Đã xuất HĐ is only looked at: no action button, nothing to edit in the detail.
      const issuedRow = rowOf(page, staffRequest.code);
      await expect(issuedRow.locator(".ir-status")).toHaveText("Đã xuất HĐ");
      await expect(issuedRow).toContainText("0007100");
      await expect(issuedRow.getByRole("button", { name: /Xử lý|Hủy yêu cầu/ })).toHaveCount(0);
      await issuedRow.getByRole("button", { name: "Chi tiết" }).click();
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("button", { name: /Sửa|Xử lý|Hủy yêu cầu/ })).toHaveCount(0);
      await detail.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();

      // Cần xử lý keeps Đã hủy (a decision is due), not Đã xuất HĐ.
      await page.getByRole("group", { name: "Lọc theo trạng thái" }).getByRole("button", { name: /Cần xử lý/ }).click();
      await expect(rowOf(page, qrCode)).toBeVisible();
      await expect(rowOf(page, staffRequest.code)).toHaveCount(0);

      // ── ⑥ Tài chính › Hóa đơn đỏ: every customer's, worked, never added to ───
      await page.locator('.app-nav-group[title="Tài chính"]').click();
      await page.locator('.app-ribbon-item[title="Hóa đơn đỏ"]').click();
      await expect(page).toHaveURL(/\/invoice-requests$/);
      await expect(page.getByRole("heading", { name: "Hóa đơn đỏ" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Khách hàng" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Tạo yêu cầu" })).toHaveCount(0);
      const pageRow = rowOf(page, qrCode);
      await expect(pageRow).toBeVisible();
      await expect(rowOf(page, staffRequest.code)).toBeVisible();

      // Làm mới reads the list again without a page load: what the sync worker
      // changed behind the page shows up (here, a corrected invoice number).
      forceStatus(staffRequest.id, `"InvoiceNo"='0007101'`);
      await expect(rowOf(page, staffRequest.code)).toContainText("0007100");
      const refreshed = page.waitForResponse((res) => res.url().includes("/invoice-requests?") && res.ok());
      await page.getByRole("button", { name: "Làm mới" }).click();
      await refreshed;
      await expect(rowOf(page, staffRequest.code)).toContainText("0007101");

      // Hủy yêu cầu needs a reason, then the row is closed for good.
      await pageRow.getByRole("button", { name: "Hủy yêu cầu" }).click();
      const withdraw = page.getByRole("dialog", { name: new RegExp(`Hủy yêu cầu · ${qrCode}`) });
      await expect(withdraw).toBeVisible();
      const confirmWithdraw = withdraw.getByRole("button", { name: "Hủy yêu cầu" });
      await expect(confirmWithdraw, "no reason, no Hủy yêu cầu").toBeDisabled();
      await withdraw.getByLabel("Lý do hủy yêu cầu").fill("Khách không lấy HĐ nữa");
      await confirmWithdraw.click();
      await expect(withdraw).toBeHidden();
      await expect(pageRow.locator(".ir-status")).toHaveText("Đã hủy yêu cầu");
      await expect(pageRow.getByRole("button", { name: /Xử lý|Hủy yêu cầu/ })).toHaveCount(0);

      await page.reload();
      await expect(rowOf(page, qrCode).locator(".ir-status")).toHaveText("Đã hủy yêu cầu");
      await expect(rowOf(page, staffRequest.code).locator(".ir-status")).toHaveText("Đã xuất HĐ");
    } finally {
      for (const id of created) {
        await call(page, `${REQUESTS}/${id}/withdraw`, { method: "POST", json: { reason: "e2e cleanup" } });
      }
    }
  });
});
