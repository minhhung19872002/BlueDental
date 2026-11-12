import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { laboCatalog, orderBody, passAll, receive, sentOrder } from "./fixtures/laboApi";
import { addPlanLine, findLaboPatient, seedLaboOrder } from "./fixtures/laboSeed";

/**
 * Feature: Labo → Mẫu Labo — the columns and the Thao tác column after
 * P2910_03 (F-85). The BA folded "Ngày gửi / Tình trạng mẫu" and "Ngày giao /
 * Trạng thái Labo" into "Gửi → Hẹn giao" and "Trạng thái", and moved every
 * step of the order onto the patient record's one Labo dialog: on Mẫu Labo
 * the eye alone is left, opening the read-only "Thông tin chung". The plus,
 * the shield and the Trạng thái select of R-479/R-480 went with that change.
 *
 * Real stack: the browser logs in through the login screen, the lists read
 * from the real API and the orders under test are moved through the same
 * endpoints the workflow dialog posts to. Nothing is intercepted.
 */

const HEADERS = [
  "Mã số",
  "Ngày tạo",
  "Tên khách hàng",
  "Gửi → Hẹn giao",
  "Trạng thái",
  "Bác sĩ chỉ định",
  "Loại phục hình",
  "Răng",
  "File phòng khám gửi về",
  "Thao tác",
];

/** The row whose Mã phiếu cell is exactly this code. */
function rowWithCode(page: Page, code: string) {
  return page
    .locator(".bd-labo-screen tbody tr.ant-table-row")
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) })
    .first();
}

/** The patient tab's row whose Mã phiếu cell is exactly this code. */
function patientRowWithCode(page: Page, code: string) {
  return page
    .locator(".pd-pane--fill tbody tr.ant-table-row")
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) })
    .first();
}

/** The aria-labels of the row's Thao tác buttons, in order. */
function actionNames(row: Locator) {
  return row.locator(".pd-icon-actions .ant-btn").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  );
}

/** The value span of a "label: value" row inside the detail dialog. */
function valueOf(page: Page, dialog: Locator, label: string) {
  return dialog
    .locator(".pd-labo-detail-row")
    .filter({ has: page.locator("span:first-child", { hasText: new RegExp(`^${label}$`) }) })
    .locator("span:last-child");
}

/** The patient record's Labo dialog: the one with the three step tabs. */
function workflowDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
}

/** Opens the eye on the row and hands back the dialog. */
async function openDetail(page: Page, code: string) {
  await rowWithCode(page, code).getByRole("button", { name: "Xem", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Thông tin chung" });
  await expect(detail).toBeVisible();
  return detail;
}

test.describe("Mẫu Labo — columns and Thao tác", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the table has the BA's columns and the eye opens the read-only detail", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const seeded = await seedLaboOrder(page, target, id);

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // ── Ten headers, Gửi → Hẹn giao and Trạng thái in the middle ──────
    await expect(page.locator(".bd-labo-screen thead th")).toHaveText(HEADERS);

    const row = rowWithCode(page, seeded.orderCode);
    await expect(row).toBeVisible();
    const cells = row.getByRole("cell");

    // ── Tên khách hàng is a link into the record, "[code] - name" ───────
    const patientLink = cells.nth(2).getByRole("link");
    await expect(patientLink).toHaveText(`[${target.patientCode}] - ${target.patientName}`);
    // The branch rides along as its code (F-68).
    await expect(patientLink).toHaveAttribute("href", `/patient/${target.patientId}?branch=BD-001`);
    // ── "dd/MM → dd/MM"; a Nháp is not at the Labo, so no due tag ───────
    await expect(cells.nth(3)).toHaveText(/^\d{2}\/\d{2} → \d{2}\/\d{2}$/);
    await expect(cells.nth(4)).toHaveText("Nháp");

    // ── No returned file yet: the folder is greyed ───────────────────────
    await expect(cells.nth(8).getByRole("button", { name: "Xem file phòng khám gửi về" })).toBeDisabled();

    // ── Thao tác: the eye alone, whatever the status ─────────────────────
    expect(await actionNames(row)).toEqual(["Xem"]);

    // ── The eye opens the read-only modal with this row's patient ────────
    const detail = await openDetail(page, seeded.orderCode);
    await expect(valueOf(page, detail, "Khách hàng")).toHaveText(target.patientName);
    await expect(valueOf(page, detail, "Nhà cung cấp")).toHaveText(seeded.supplierName);
    await expect(valueOf(page, detail, "Răng")).toHaveText(seeded.teeth);
    // The status moves only on the patient record: no select, no well, no Lưu.
    await expect(detail.getByLabel("Trạng thái", { exact: true })).toHaveCount(0);
    await expect(detail.locator(".pd-labo-well")).toHaveCount(0);
    await expect(detail.locator(".pd-labo-detail-footer .ant-btn")).toHaveText([
      "In Phiếu Labo",
      "Tạo Lịch Hẹn Mới",
      "Đóng",
    ]);

    // ── Tạo Lịch Hẹn Mới still opens the appointment editor ─────────────
    await detail.getByRole("button", { name: "Tạo Lịch Hẹn Mới" }).click();
    const appointment = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(appointment).toBeVisible();
    await appointment.locator(".ant-modal-close").click();
    await expect(appointment).toBeHidden();

    await detail.locator(".pd-labo-detail-footer").getByRole("button", { name: "Đóng" }).click();
    await expect(detail).toBeHidden();
  });

  test("a sent order's pictures show in the folder and the detail, read-only", async ({ page }) => {
    const id = runId();
    const line = await addPlanLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const sent = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const cells = rowWithCode(page, sent.orderCode).getByRole("cell");
    await expect(cells.nth(3)).toContainText(/còn \d+ ngày/);
    await expect(cells.nth(4)).toHaveText("Đã gửi Labo");

    // ── The folder previews the picture sent with the order ─────────────
    const file = cells.nth(8).getByRole("button", { name: "Xem file phòng khám gửi về" });
    await expect(file).toBeEnabled();
    await file.click();
    await expect(page.locator(".ant-image-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    // AntD leaves the closed preview mounted in its fade-leave state at opacity 0.
    await expect(page.locator(".ant-image-preview:not(.ant-image-preview-fade-leave)")).toHaveCount(0);
    // Now and then its leave motion stalls in "fade-leave-active" headless and
    // the mask stays over the table, catching the next click: start the detail
    // from a fresh load of the list.
    await page.reload();
    await expect(rowWithCode(page, sent.orderCode)).toBeVisible();

    // ── The detail lists it with Xem ảnh only, no Xóa ảnh ────────────────
    const detail = await openDetail(page, sent.orderCode);
    const tiles = detail.locator(".pd-labo-gallery-tile");
    await expect(tiles).toHaveCount(1);
    await expect(tiles.getByRole("button", { name: /^Xem ảnh / })).toBeVisible();
    await expect(tiles.getByRole("button", { name: /^Xóa ảnh / })).toHaveCount(0);
  });

  /**
   * The patient tab draws one step beside the eye, the one the status waits
   * on (Kiểm tra Labo while at the Labo, Kích hoạt bảo hành once Hoàn thành);
   * Mẫu Labo keeps the eye alone for the same orders.
   */
  test("the patient tab's step button follows the status; Mẫu Labo keeps the eye", async ({ page }) => {
    test.setTimeout(120_000);
    const id = runId();
    const line = await addPlanLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const atLab = await sentOrder(page, orderBody(catalog, line, `${id}a`, { treatmentServiceId: line.lineId }));
    const done = await sentOrder(page, orderBody(catalog, line, `${id}b`, { treatmentServiceId: line.lineId }));
    const received = await receive(page, done.id, 2);
    expect(received.status, received.text).toBe(200);
    await passAll(page, done.id, [11, 21]);

    // ── The patient's Labo tab ───────────────────────────────────────────
    await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const atLabRow = patientRowWithCode(page, atLab.orderCode);
    await expect(atLabRow).toBeVisible();
    expect(await actionNames(atLabRow)).toEqual(["Xem chi tiết", "Kiểm tra Labo"]);
    const doneRow = patientRowWithCode(page, done.orderCode);
    await expect(doneRow).toContainText("Hoàn thành");
    expect(await actionNames(doneRow)).toEqual(["Xem chi tiết", "Kích hoạt bảo hành"]);

    // Each step button opens the one dialog on its own tab.
    const dialog = workflowDialog(page);
    await atLabRow.getByRole("button", { name: "Kiểm tra Labo" }).click();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Nhận hàng & kiểm tra");
    await dialog.locator(".pd-labo-step-footer").getByRole("button", { name: "Huỷ", exact: true }).click();
    await expect(dialog).toBeHidden();
    await doneRow.getByRole("button", { name: "Kích hoạt bảo hành" }).click();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Bảo hành");

    // ── Mẫu Labo, after a fresh load ─────────────────────────────────────
    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    for (const code of [atLab.orderCode, done.orderCode]) {
      const listRow = rowWithCode(page, code);
      await expect(listRow).toBeVisible();
      expect(await actionNames(listRow)).toEqual(["Xem"]);
    }
    await expect(rowWithCode(page, done.orderCode).getByRole("cell").nth(4)).toHaveText("Hoàn thành");
  });
});
