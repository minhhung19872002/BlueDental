import { expect, type Page, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { BRANCH_ONE } from "./fixtures/laboApi";
import { fullSlip, newPatient, readBack, save, slipCatalog, slipNo } from "./fixtures/laboSlipApi";
import { fillRequired, openLaboTab, ordersOf, patientRow, sentOrder, slipDialog, startSlip } from "./fixtures/laboSlipUi";

/**
 * P1211 (R-1212): Yêu cầu on the Phiếu yêu cầu is a text-only rich text box,
 * no ruled lines. Real login, real API, real database, no interception — what
 * the browser writes is read back with its own GET, and what the API stores
 * is read back through the screens.
 */

/** The words of a stored body: tags off, Quill's &nbsp; back to spaces. */
const plain = (html: string | null | undefined) =>
  (html ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");

/** Xem chi tiết on the patient's Labo tab, then the slip itself (tab Đặt hàng). */
async function reopenSlip(page: Page, patientId: string, no: string) {
  await openLaboTab(page, patientId);
  await patientRow(page, no).getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
  const dialog = slipDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** «Xem» on /labo: the slip's facts with its print sheet beside them. */
async function viewOnLaboScreen(page: Page, no: string) {
  await page.goto(`/labo?branchId=${BRANCH_ONE}`);
  const row = page.locator(".bd-labo-screen tbody tr.ant-table-row").filter({ hasText: no }).first();
  await row.getByRole("button", { name: "Xem", exact: true }).click();
  const detail = page.getByRole("dialog").filter({ hasText: no });
  await expect(detail).toBeVisible();
  return detail;
}

test.describe("Labo Phiếu yêu cầu — Yêu cầu as rich text (P1211, R-1212)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Yêu cầu is a text-only editor without ruled lines; bold survives the save, the slip's facts and the print sheet", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "rt");
    const no = slipNo("rt");
    const dialog = await startSlip(page, patientId);
    const note = dialog.locator(".rs-note");
    const body = dialog.getByLabel("Yêu cầu", { exact: true });

    await test.step("a toolbar for text, nothing for pictures, no ruled lines", async () => {
      await expect(note.locator(".ql-toolbar .ql-bold")).toBeVisible();
      await expect(note.locator(".ql-toolbar .ql-image")).toHaveCount(0);
      await expect(note.locator(".ql-toolbar .ql-video")).toHaveCount(0);
      for (const part of [note, body]) {
        expect(await part.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
      }
      await expect(body).toHaveAttribute("data-placeholder", /.+/);
    });

    await test.step("typed with Ctrl+B, the bold part is marked", async () => {
      await fillRequired(page, dialog, no, c.ceramic.name);
      await body.click();
      await page.keyboard.press("Control+B");
      await page.keyboard.type("Gấp");
      await page.keyboard.press("Control+B");
      await page.keyboard.type(" làm sát nướu");
      await expect(body.locator("strong")).toHaveText("Gấp");
      await expect(dialog.getByRole("status")).toHaveText("Phiếu đã đủ thông tin.");
    });

    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();

    await test.step("stored as markup, read back with its own GET", async () => {
      const order = await readBack(page, (await sentOrder(page, patientId, no)).id);
      expect(order.notes).toMatch(/<strong>Gấp<\/strong>/);
      expect(plain(order.notes)).toBe("Gấp làm sát nướu");
    });

    await test.step("reopened after a reload, the sent slip reads it back without an editor", async () => {
      const reopened = await reopenSlip(page, patientId, no);
      const view = reopened.locator(".rs-note--view");
      await expect(view.locator("strong")).toHaveText("Gấp");
      await expect(view).toContainText("làm sát nướu");
      await expect(reopened.locator(".rs-note .ql-toolbar")).toHaveCount(0);
      await expect(view.locator(".ql-editor")).toHaveAttribute("contenteditable", "false");
    });

    await test.step("Xem on /labo: the facts and the print sheet keep the bold", async () => {
      const detail = await viewOnLaboScreen(page, no);
      await expect(detail.locator("strong").filter({ hasText: "Gấp" }).first()).toBeVisible();
      const sheet = page.locator(".pd-slip-print");
      await expect(sheet.locator(".pd-slip-print-notes strong")).toHaveText("Gấp");
      await expect(sheet).toContainText("làm sát nướu");
    });
  });

  test("a Yêu cầu written as plain text before R-1212 keeps its lines and its < >", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "rt-old");
    const no = slipNo("rt-old");
    const made = await save(page, fullSlip(c, patientId, no, { notes: "Dòng một\nDòng hai < ba" }));
    expect(made.status, made.text).toBe(200);
    // Multipart writes the line break as CRLF; asRichText splits on either.
    expect((await readBack(page, made.body.id)).notes?.replace(/\r\n/g, "\n")).toBe("Dòng một\nDòng hai < ba");

    const reopened = await reopenSlip(page, patientId, no);
    await expect(reopened.locator(".rs-note--view .ql-editor > p")).toHaveText(["Dòng một", "Dòng hai < ba"]);

    await viewOnLaboScreen(page, no);
    await expect(page.locator(".pd-slip-print .pd-slip-print-notes .ql-editor > p")).toHaveText([
      "Dòng một",
      "Dòng hai < ba",
    ]);
  });

  test("markup that tries to run script is shown inert", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "rt-xss");
    const no = slipNo("rt-xss");
    const payload = '<p>Sạch<img src="x" onerror="window.__r1212=1"></p><script>window.__r1212=2</script>';
    const made = await save(page, fullSlip(c, patientId, no, { notes: payload }));
    expect(made.status, made.text).toBe(200);

    const reopened = await reopenSlip(page, patientId, no);
    await expect(reopened.locator(".rs-note--view")).toContainText("Sạch");
    await viewOnLaboScreen(page, no);
    await expect(page.locator(".pd-slip-print")).toContainText("Sạch");
    // Quill re-renders its own document: no handler attribute, no script tag.
    await expect(page.locator(".rs-note--view [onerror], .pd-slip-print [onerror], .bd-rich-view script")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __r1212?: number }).__r1212)).toBeUndefined();
  });

  test("Yêu cầu takes 5000 characters; one more is refused with Labo:0061 and nothing is made", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "rt-len");

    const atLimit = slipNo("rt-len-a");
    const ok = await save(page, fullSlip(c, patientId, atLimit, { notes: "a".repeat(5000) }));
    expect(ok.status, ok.text).toBe(200);
    expect((await readBack(page, ok.body.id)).notes).toHaveLength(5000);

    const over = await save(page, fullSlip(c, patientId, slipNo("rt-len-b"), { notes: "a".repeat(5001) }));
    expect(over.status).not.toBe(200);
    expect(over.text).toContain("BlueDental:Labo:0061");
    expect((await ordersOf(page, patientId)).map((order) => order.labSlipNo)).toEqual([atLimit]);
  });
});
