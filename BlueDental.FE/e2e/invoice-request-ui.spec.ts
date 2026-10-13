import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call, collectOnFirstLine, openNewSlip } from "./fixtures/ledgerReceipt";

/**
 * F-71 Yêu cầu xuất HĐ through the screens (BA 2026-10-12): the customer opens
 * the QR link of a red-invoice PHIẾU THU on a phone with no session and sends
 * THÔNG TIN XUẤT HÓA ĐƠN; staff see it on the patient's Hóa đơn tab, key one
 * in for another receipt, and work it to Đã xuất HĐ.
 *
 * Real stack only — no route interception. The receipts are written "Hoàn
 * tất" with "Xuất hóa đơn đỏ" ticked as they are made — a Hoàn tất receipt is
 * final (owner 2026-10-13, R-929) — and nothing here issues an e-invoice.
 */

const REQUESTS = "/api/v1/app/invoice-requests";

const rowOf = (page: Page, code: string) => page.locator("tr.ant-table-row", { hasText: code });

test.describe("F-71 Yêu cầu xuất HĐ — screens", () => {
  test.setTimeout(240_000);

  test("QR page → Hóa đơn tab → staff request → Xử lý → Hoàn tất, kept after reload", async ({ page, browser }) => {
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

        // Tên công ty and Mã số thuế are both required.
        await phone.getByLabel("Tên công ty").fill("Công ty TNHH E2E QR");
        await phone.getByRole("button", { name: "Gửi thông tin" }).click();
        await expect(phone.getByText("Xuất hóa đơn cho công ty cần nhập Tên công ty và Mã số thuế.").first()).toBeVisible();

        await phone.getByLabel("Mã số thuế").fill("0101234567");
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

      // ── ② It lands on the patient's Hóa đơn tab, with the tab badge ──────────
      await page.goto(`/patient/${viaQr.patientId}?tab=invoice`);
      const invoiceTab = page.locator("a.pill-tab", { hasText: "Hóa đơn" });
      await expect(invoiceTab.locator(".pill-tab__badge")).toHaveText(/^[1-9]\d*$/);
      await expect(page.getByRole("heading", { name: "Yêu cầu xuất hóa đơn" })).toBeVisible();
      const qrRow = rowOf(page, qrCode);
      await expect(qrRow).toBeVisible();
      await expect(qrRow).toContainText(viaQr.code);
      await expect(qrRow).toContainText("Công ty TNHH E2E QR");
      await expect(qrRow).toContainText("Chờ xử lý");

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

      // ── ③ Staff key one in for the other receipt ─────────────────────────────
      await page.getByRole("button", { name: "Tạo yêu cầu" }).click();
      const dialog = page.getByRole("dialog", { name: /Tạo yêu cầu/ });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("combobox", { name: "Phiếu thu" }).click();
      await page.locator(".ant-select-dropdown .ant-select-item-option", { hasText: byStaff.code }).click();
      await expect(dialog.getByLabel("Họ và tên")).not.toHaveValue("");
      const phoneField = dialog.getByLabel("SĐT");
      if (!(await phoneField.inputValue())) await phoneField.fill("0900000071");
      // Cá nhân (the default) asks the CCCD, not the Email (R-916).
      await expect(dialog.getByRole("radio", { name: "Cá nhân" })).toHaveAttribute("aria-checked", "true");
      await expect(dialog.getByLabel("Email")).toHaveCount(0);
      await dialog.getByLabel("Căn cước công dân").fill("012345678971");
      const posted = page.waitForResponse((res) => res.url().endsWith(REQUESTS) && res.request().method() === "POST");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      const createdRes = await posted;
      expect(createdRes.status(), await createdRes.text()).toBe(200);
      const staffRequest = (await createdRes.json()) as { id: string; code: string };
      created.push(staffRequest.id);
      await expect(dialog).toBeHidden();
      await expect(rowOf(page, staffRequest.code)).toContainText(byStaff.code);

      // ── ④ Both are still there after a reload (read back from PostgreSQL) ───
      await page.reload();
      await expect(rowOf(page, qrCode)).toBeVisible();
      await expect(rowOf(page, staffRequest.code)).toBeVisible();

      // ── ⑤ Xử lý → Hoàn tất on the QR request ─────────────────────────────────
      await rowOf(page, qrCode).getByRole("button", { name: "Xử lý" }).click();
      await expect(rowOf(page, qrCode)).toContainText("Đang xử lý");
      await rowOf(page, qrCode).getByRole("button", { name: "Hoàn tất" }).click();
      const complete = page.getByRole("dialog", { name: new RegExp(`Hoàn tất · ${qrCode}`) });
      await expect(complete).toBeVisible();
      await expect(complete.getByRole("button", { name: "Hoàn tất" }), "no invoice number, no Hoàn tất").toBeDisabled();
      await complete.getByLabel("Số hóa đơn").fill("0007100");
      await complete.getByRole("button", { name: "Hoàn tất" }).click();
      await expect(complete).toBeHidden();
      await expect(rowOf(page, qrCode)).toContainText("Đã xuất HĐ");
      await expect(rowOf(page, qrCode)).toContainText("0007100");

      // ── ⑥ Cần xử lý keeps only what is still open ────────────────────────────
      await page.getByRole("group", { name: "Lọc theo trạng thái" }).getByRole("button", { name: /Cần xử lý/ }).click();
      await expect(rowOf(page, staffRequest.code)).toBeVisible();
      await expect(rowOf(page, qrCode)).toHaveCount(0);

      await page.reload();
      await expect(rowOf(page, qrCode)).toContainText("Đã xuất HĐ");
    } finally {
      for (const id of created) {
        await call(page, `${REQUESTS}/${id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
      }
    }
  });
});
