import { expect, test, type Locator, type Page } from "@playwright/test";
import { pickOption } from "./fixtures/antd";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { addPlanLine, driveLine, findLaboPatient, seedLaboOrder } from "./fixtures/laboSeed";

/**
 * Feature: Labo → Mẫu Labo — the reference's eleven columns and the Thao tác
 * column (docs/clone/pages/labo.md §2.4–§2.6; R-479, R-480). The eye opens
 * the editable "Thông tin chung" modal (Trạng thái select, Tải ảnh well, In
 * Phiếu Labo, Tạo Lịch Hẹn Mới, Lưu); the plus and the shield raise the
 * tab-less "Làm tiếp công đoạn" / "Bảo hành" forms on the row through the URL.
 *
 * Real stack: the browser logs in through the login screen, the list reads
 * from the real API, the order under test is created through the same
 * endpoint the dialog posts to, and Lưu goes up as the real multipart PUT.
 * Nothing is intercepted.
 */

const HEADERS = [
  "Mã phiếu labo",
  "Nhà cung cấp / Ngày tạo",
  "Tên khách hàng",
  "Phiếu điều trị",
  "Ngày gửi / Tình trạng mẫu",
  "Ngày giao / Trạng thái Labo",
  "Bác sĩ chỉ định",
  "Vật liệu",
  "Răng",
  "File phòng khám gửi về",
  "Thao tác",
];

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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

/** A floating field of the child form, by its label. */
function field(scope: Locator, label: string) {
  return scope.locator(".floating-field").filter({ hasText: label }).first();
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

  test("the table has the reference's columns, links and row buttons", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const seeded = await seedLaboOrder(page, target, id);

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // ── Eleven headers, in the reference's order ─────────────────────────
    await expect(page.locator(".bd-labo-screen thead th")).toHaveText(HEADERS);

    const row = rowWithCode(page, seeded.orderCode);
    await expect(row).toBeVisible();
    const cells = row.getByRole("cell");

    // ── Tên khách hàng is a link into the record, "[code] - name" ───────
    const patientLink = cells.nth(2).getByRole("link");
    await expect(patientLink).toHaveText(`[${target.patientCode}] - ${target.patientName}`);
    await expect(patientLink).toHaveAttribute(
      "href",
      `/patient/${target.patientId}?branchId=${target.branchId}`,
    );
    // No treatment slip behind an order raised straight on the patient.
    await expect(cells.nth(3)).toHaveText("—");

    // ── The two date/pill pairs ──────────────────────────────────────────
    await expect(cells.nth(4)).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await expect(cells.nth(4)).toContainText("Mẫu mới");
    await expect(cells.nth(5)).toContainText("—");
    await expect(cells.nth(5)).toContainText("Đơn hàng mới");

    // ── No returned file yet: the folder is greyed ───────────────────────
    const file = cells.nth(9).getByRole("button", { name: "Xem file phòng khám gửi về" });
    await expect(file).toBeDisabled();

    // ── Thao tác: eye, plus, shield ──────────────────────────────────────
    const actions = cells.nth(10).locator(".pd-icon-actions .ant-btn");
    await expect(actions).toHaveCount(3);
    // The eye is "Xem" here; the patient tab's reads "Xem chi tiết".
    await expect(actions.nth(0)).toHaveAttribute("aria-label", "Xem");
    await expect(actions.nth(1)).toHaveAttribute("aria-label", "Tiếp tục công đoạn");
    await expect(actions.nth(2)).toHaveAttribute("aria-label", "Bảo hành");

    // ── The eye opens the editable modal with this row's patient ─────────
    const detail = await openDetail(page, seeded.orderCode);
    // The reference shows the name alone here; the code stays on the print sheet.
    await expect(valueOf(page, detail, "Khách hàng")).toHaveText(target.patientName);
    await expect(valueOf(page, detail, "Nhà cung cấp")).toHaveText(seeded.supplierName);
    await expect(valueOf(page, detail, "Răng")).toHaveText(seeded.teeth);
    await expect(valueOf(page, detail, "Ghi chú")).toHaveText("");
    // Its footer: In Phiếu Labo, Tạo Lịch Hẹn Mới, Lưu — no Đóng.
    const footer = detail.locator(".pd-labo-detail-footer .ant-btn");
    await expect(footer).toHaveText(["In Phiếu Labo", "Tạo Lịch Hẹn Mới", "Lưu"]);
    await expect(detail.getByLabel("Trạng thái", { exact: true })).toBeVisible();
    await expect(detail.locator(".pd-labo-well")).toHaveText("Tải ảnh");
    await detail.locator(".ant-modal-close").click();
    await expect(detail).toBeHidden();

    // ── The plus raises Làm tiếp công đoạn: one form, no pills, no picker ─
    await actions.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`laboModal=continue-process&laboRowId=${seeded.id}`));
    const cont = page.getByRole("dialog", { name: "Làm tiếp công đoạn" });
    await expect(cont).toBeVisible();
    // The row's patient is locked in as "code - name" in a disabled picker;
    // the slip gets its own number.
    const customer = `${target.patientCode} - ${target.patientName}`;
    await expect(field(cont, "Tên khách hàng").getByRole("combobox")).toHaveText(customer);
    await expect(field(cont, "Tên khách hàng").locator(".ss-wrapper--disabled")).toHaveCount(1);
    // The time labels stay on the border over the reference's "HH:mm" hint.
    await expect(field(cont, "Giờ nhận")).toHaveClass(/floating-field--floated/);
    await expect(field(cont, "Giờ nhận").locator("input")).toHaveAttribute("placeholder", "HH:mm");
    await expect(field(cont, "Giờ nhận").locator("input")).toHaveValue("");
    await expect(field(cont, "Số phiếu Labo").locator("input")).toHaveValue(/^LABO-\d+$/);
    await expect(cont.locator(".pd-labo-tabs")).toHaveCount(0);
    await expect(cont.locator(".pd-labo-order-select")).toHaveCount(0);
    await expect(cont.locator(".pd-labo-footer .ant-btn")).toHaveText(["Lưu"]);
    await cont.locator(".ant-modal-close").click();
    await expect(cont).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=/);

    // ── The shield raises Bảo hành the same way ──────────────────────────
    await actions.nth(2).click();
    await expect(page).toHaveURL(new RegExp(`laboModal=warranty&laboRowId=${seeded.id}`));
    const warranty = page.getByRole("dialog", { name: "Bảo hành" });
    await expect(warranty).toBeVisible();
    await expect(field(warranty, "Tên khách hàng").getByRole("combobox")).toHaveText(customer);
    await expect(warranty.locator(".pd-labo-tabs")).toHaveCount(0);
    await expect(warranty.locator(".pd-labo-order-select")).toHaveCount(0);
    await expect(warranty.locator(".pd-labo-footer .ant-btn")).toHaveText(["Lưu"]);
    await warranty.locator(".ant-modal-close").click();
    await expect(warranty).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=/);
  });

  /**
   * The reference (staging, 2026-09-24, Mẫu Labo and the patient's Labo tab
   * alike): the eye is always drawn; with treatmentLabo:create the shield is
   * always drawn and the plus is drawn unless the order's treatment line is
   * done (`isTreatmentServiceDone` in the bundle). The order's own status and
   * kind never matter — an "Đã huỷ" order keeps all three buttons.
   */
  test("the plus follows the treatment line, not the order, on both tables", async ({ page }) => {
    const id = runId();
    const doneLine = await addPlanLine(page);
    const onDoneLine = await seedLaboOrder(page, doneLine, `${id}a`, doneLine.lineId);
    const cancelledLine = await addPlanLine(page, doneLine.planId);
    const onCancelledLine = await seedLaboOrder(page, cancelledLine, `${id}b`, cancelledLine.lineId);

    // The first line is finished; the second loses its order and is cancelled.
    await driveLine(page, doneLine, "complete");
    await driveLine(page, cancelledLine, "cancel-labo-orders");
    await driveLine(page, cancelledLine, "cancel");

    // ── The patient's Labo tab ───────────────────────────────────────────
    await page.goto(`/patient/${doneLine.patientId}?branchId=${doneLine.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const doneRow = patientRowWithCode(page, onDoneLine.orderCode);
    await expect(doneRow).toBeVisible();
    expect(await actionNames(doneRow)).toEqual(["Xem chi tiết", "Bảo hành"]);

    const cancelledRow = patientRowWithCode(page, onCancelledLine.orderCode);
    await expect(cancelledRow.getByRole("cell").nth(1)).toContainText("Đã huỷ");
    await expect(cancelledRow.getByRole("cell").nth(2)).toContainText("Đã huỷ");
    expect(await actionNames(cancelledRow)).toEqual(["Xem chi tiết", "Tiếp tục công đoạn", "Bảo hành"]);

    // ── Mẫu Labo, after a fresh load ─────────────────────────────────────
    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const doneListRow = rowWithCode(page, onDoneLine.orderCode);
    await expect(doneListRow).toBeVisible();
    expect(await actionNames(doneListRow)).toEqual(["Xem", "Bảo hành"]);
    const cancelledListRow = rowWithCode(page, onCancelledLine.orderCode);
    await expect(cancelledListRow.getByRole("cell").nth(4)).toContainText("Đã huỷ");
    expect(await actionNames(cancelledListRow)).toEqual(["Xem", "Tiếp tục công đoạn", "Bảo hành"]);

    // The shield still raises Bảo hành on the finished line.
    await doneListRow.getByRole("button", { name: "Bảo hành" }).click();
    await expect(page.getByRole("dialog", { name: "Bảo hành" })).toBeVisible();
  });

  test("the detail modal saves the status and the pictures", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const seeded = await seedLaboOrder(page, target, id);

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // ── Trạng thái → Đã nhận hàng, one picture through the well ─────────
    let detail = await openDetail(page, seeded.orderCode);
    await pickOption(page, detail.getByLabel("Trạng thái", { exact: true }), "Đã nhận hàng");
    await detail
      .locator(".pd-labo-pictures input[type=file]")
      .setInputFiles([{ name: `labo-${id}.png`, mimeType: "image/png", buffer: PNG_1PX }]);
    const tiles = detail.locator(".pd-labo-gallery-tile");
    await expect(tiles).toHaveCount(1);
    await expect(tiles.getByRole("button", { name: `Xem ảnh labo-${id}.png` })).toBeVisible();
    await expect(tiles.getByRole("button", { name: `Xóa ảnh labo-${id}.png` })).toBeVisible();

    const saved = page.waitForResponse(
      (r) => r.url().includes(`/api/v1/app/labo-orders/${seeded.id}/detail`) && r.request().method() === "PUT",
    );
    await detail.getByRole("button", { name: "Lưu" }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Đã lưu phiếu Labo")).toBeVisible();
    await expect(detail).toBeHidden();

    // ── The row follows: the pill and the folder ─────────────────────────
    const cells = rowWithCode(page, seeded.orderCode).getByRole("cell");
    await expect(cells.nth(5)).toContainText("Đã nhận hàng");
    const file = cells.nth(9).getByRole("button", { name: "Xem file phòng khám gửi về" });
    await expect(file).toBeEnabled();
    await file.click();
    await expect(page.locator(".ant-image-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".ant-image-preview")).toBeHidden();

    // ── Persisted: after a reload the dialog reopens on the saved state ──
    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    detail = await openDetail(page, seeded.orderCode);
    await expect(detail.locator(".pd-labo-status")).toContainText("Đã nhận hàng");
    await expect(detail.locator(".pd-labo-gallery-tile")).toHaveCount(1);

    // ── Đã huỷ is refused on a received order, on the client ─────────────
    await pickOption(page, detail.getByLabel("Trạng thái", { exact: true }), "Đã huỷ");
    await expect(page.getByText("Chỉ được huỷ đơn hàng mới")).toBeVisible();
    await expect(detail.locator(".pd-labo-status")).toContainText("Đã nhận hàng");

    // ── Tạo Lịch Hẹn Mới opens the appointment editor ───────────────────
    await detail.getByRole("button", { name: "Tạo Lịch Hẹn Mới" }).click();
    const appointment = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(appointment).toBeVisible();
    await appointment.locator(".ant-modal-close").click();
    await expect(appointment).toBeHidden();

    // ── Removing the tile and saving drops the picture ───────────────────
    await detail.getByRole("button", { name: /^Xóa ảnh / }).click();
    await expect(detail.locator(".pd-labo-gallery-tile")).toHaveCount(0);
    await detail.getByRole("button", { name: "Lưu" }).click();
    await expect(detail).toBeHidden();
    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    await expect(
      rowWithCode(page, seeded.orderCode)
        .getByRole("cell")
        .nth(9)
        .getByRole("button", { name: "Xem file phòng khám gửi về" }),
    ).toBeDisabled();
  });
});
