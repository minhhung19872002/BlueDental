import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: hồ sơ bệnh nhân → tab Labo → "Xem chi tiết" on a row: the read-only
 * "Thông tin chung" modal and the "PHIẾU ĐẶT HÀNG LABO" sheet behind "In Phiếu
 * Labo" (docs/clone/pages/patient-detail.md, Tab 6; R-317).
 *
 * Real stack: the browser logs in through the login screen and the tab reads
 * its rows from the real API. The order under test is created through the same
 * endpoint the dialog posts to, with the cookie the browser holds, so the modal
 * has known values to show; the only browser-side shim is window.print, which
 * headless Chromium cannot open a preview for.
 */

interface Target {
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
}

interface Seeded {
  orderCode: string;
  supplierName: string;
  teeth: string;
  shade: string;
  instruction: string;
}

/** Any patient of the demo clinic, with the branch its record belongs to. */
async function findPatient(page: Page): Promise<Target> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const found = await page.evaluate(async () => {
    const list = (await (
      await fetch("/api/v1/app/patients?maxResultCount=1", { credentials: "include" })
    ).json()) as { items: { id: string }[] };
    const id = list.items[0]?.id;
    if (!id) return null;
    const patient = (await (
      await fetch(`/api/v1/app/patients/${id}`, { credentials: "include" })
    ).json()) as { id: string; patientCode: string; fullName: string; branchId: string };
    return {
      patientId: patient.id,
      patientCode: patient.patientCode,
      patientName: patient.fullName,
      branchId: patient.branchId,
    };
  });
  expect(found, "the demo clinic should have a patient").toBeTruthy();
  return found!;
}

/**
 * One Đặt mới order with every field the modal reads out, posted the way the
 * dialog posts it. The supplier is created only when the branch has none.
 */
async function seedOrder(page: Page, target: Target, id: string): Promise<Seeded> {
  return page.evaluate(
    async ({ target, id }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": target.branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
        return (await res.json()) as { name: string; orderCode: string };
      };

      const suppliers = (await (
        await fetch(
          `/api/v1/app/labo-suppliers?ClinicBranchId=${target.branchId}&IsActive=true&MaxResultCount=1`,
          { credentials: "include", headers },
        )
      ).json()) as { items: { name: string }[] };
      const supplierName =
        suppliers.items[0]?.name ??
        (
          await post("/api/v1/app/labo-suppliers", {
            name: `Labo e2e ${id}`,
            email: `labo-${id}@example.com`,
            clinicBranchId: target.branchId,
          })
        ).name;

      const order = {
        patientId: target.patientId,
        branchId: target.branchId,
        labProviderName: supplierName,
        kind: 1,
        estimatedCost: 0,
        quantity: 2,
        toothNumbers: "11, 12",
        toothShade: `A2-${id}`,
        workDescription: `Chỉ định e2e ${id}`,
        sentAt: new Date().toISOString(),
      };
      const saved = await post("/api/v1/app/labo-orders", order);
      return {
        orderCode: saved.orderCode,
        supplierName,
        teeth: order.toothNumbers,
        shade: order.toothShade,
        instruction: order.workDescription,
      };
    },
    { target, id },
  );
}

/** The row whose Mã phiếu cell is exactly this code. */
function rowWithCode(page: Page, code: string) {
  return page
    .locator(".pd-pane--fill tbody tr.ant-table-row")
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) })
    .first();
}

test.describe("Patient Labo tab — Xem chi tiết", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the eye opens the read-only modal, and In Phiếu Labo prints the sheet", async ({
    page,
  }) => {
    const id = runId();
    const target = await findPatient(page);
    const seeded = await seedOrder(page, target, id);

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // ── The row's first action is the eye ───────────────────────────────
    const row = rowWithCode(page, seeded.orderCode);
    await expect(row).toBeVisible();
    const actions = row.locator(".pd-icon-actions .ant-btn");
    await expect(actions.first()).toHaveAttribute("aria-label", "Xem chi tiết");
    await actions.first().click();

    // ── Four blocks, the status pill, and the two footer buttons ─────────
    const dialog = page.getByRole("dialog", { name: "Thông tin chung" });
    await expect(dialog).toBeVisible();
    const blocks = dialog.locator(".pd-labo-detail-block h3");
    await expect(blocks).toHaveText([
      "Thông tin chung",
      "Thông tin labo",
      "Thông số labo",
      "Chi tiết phiếu",
      "Trạng thái",
    ]);
    const valueOf = (label: string) =>
      dialog
        .locator(".pd-labo-detail-row")
        .filter({ has: page.locator("span:first-child", { hasText: new RegExp(`^${label}$`) }) })
        .locator("span:last-child");
    await expect(valueOf("Khách hàng")).toHaveText(`${target.patientCode} - ${target.patientName}`);
    await expect(valueOf("Nhà cung cấp")).toHaveText(seeded.supplierName);
    await expect(valueOf("Ngày gửi")).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    await expect(valueOf("Răng")).toHaveText(seeded.teeth);
    await expect(valueOf("Màu chi tiết")).toHaveText(seeded.shade);
    await expect(valueOf("Số lượng")).toHaveText("2");
    await expect(valueOf("Chỉ định")).toHaveText(seeded.instruction);
    // A value the order never had is left empty, not dashed (as on the reference).
    await expect(valueOf("Kiểu nhịp")).toHaveText("");
    await expect(dialog.locator(".pd-labo-detail-pill")).toHaveText("Đơn hàng mới");
    // Nothing to edit here: no Lưu, no status control.
    await expect(dialog.getByRole("button", { name: "Lưu" })).toHaveCount(0);
    await expect(dialog.locator(".ant-select")).toHaveCount(0);
    const printButton = dialog.getByRole("button", { name: "In Phiếu Labo" });
    await expect(printButton).toBeEnabled();
    // AntD's corner "X" is also named Đóng; the footer's is the primary one.
    const closeButton = dialog.locator(".pd-labo-detail-footer .ant-btn-primary");
    await expect(closeButton).toHaveText("Đóng");

    // ── The sheet sits on <body>, outside the modal, off-screen ──────────
    const sheet = page.locator("body > .pd-print-sheet .pd-labo-sheet");
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toBeHidden();
    await expect(sheet.locator("h2")).toHaveText("PHIẾU ĐẶT HÀNG LABO");
    await expect(sheet).toContainText(`Số: ${seeded.orderCode}`);
    await expect(sheet).toContainText(`Mã KH: ${target.patientCode}`);
    await expect(sheet).toContainText(`Khách hàng: ${target.patientName}`);
    await expect(sheet).toContainText(`Nhà cung cấp: ${seeded.supplierName}`);
    await expect(sheet).toContainText(`Số răng: ${seeded.teeth}`);
    await expect(sheet).toContainText(`Nội dung chỉ định: ${seeded.instruction}`);
    // A missing value prints as a dash on paper.
    await expect(sheet).toContainText("Kiểu nhịp: —");
    await expect(sheet).toContainText("Người đặt hàng");
    await expect(sheet).toContainText("(Ký xác nhận)");

    // ── Printing: the body wears the print class and the file name, until
    //    the browser says it is done. Headless Chromium has no preview, so
    //    window.print is the one thing shimmed here. ────────────────────────
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await printButton.click();
    await expect(page.locator("body")).toHaveClass(/pd-printing/);
    await expect(page).toHaveTitle(`phieu-labo-${seeded.orderCode}`);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator("body")).not.toHaveClass(/pd-printing/);
    await expect(page).not.toHaveTitle(/phieu-labo/);

    // ── Đóng takes the modal and its sheet away ──────────────────────────
    await closeButton.click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body > .pd-print-sheet")).toHaveCount(0);
  });
});
