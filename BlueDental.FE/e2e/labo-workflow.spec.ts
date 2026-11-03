import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { openStageDialog } from "./fixtures/stageDialog";
import {
  call,
  clinicToday,
  createOrder,
  LABO_ORDERS,
  laboCatalog,
  laboLine,
  LaboStatus,
  orderBody,
  passAll,
  receive,
  sentOrder,
  STAGES,
  type LaboLine,
  type LaboOrderView,
} from "./fixtures/laboApi";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature F-85: the Labo workflow of P2910_03 driven through the screens —
 * the patient's Labo tab, the three-step Labo dialog, LỊCH SỬ ĐIỀU TRỊ and the
 * slip's Phiếu Labo column (docs/wip/labo-workflow-p2910-03-plan.md §6).
 *
 * Real stack: the real login, real routes, real clicks; orders are seeded
 * through the real API from inside the logged-in page and every outcome is
 * read back on screen after a reload or through a separate request. Nothing
 * is intercepted.
 */

const LOCKED_BY_LABO = "BlueDental:Labo:0031";

/** A 1×1 PNG, the Ảnh kiểm tra a return needs. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function addStage(page: Page, line: LaboLine, staffId: string, note: string): Promise<string> {
  const made = await call<{ id: string }>(page, STAGES, {
    method: "POST",
    branchId: line.branchId,
    json: {
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      treatmentId: line.planId,
      treatmentServiceId: line.lineId,
      serviceId: line.serviceId,
      name: line.serviceName,
      note,
      staffId,
      treatmentDate: clinicToday(),
      teeth: [],
    },
  });
  expect(made.status, made.text).toBe(200);
  return made.body.id!;
}

async function read(page: Page, id: string): Promise<LaboOrderView> {
  const res = await call<LaboOrderView>(page, `${LABO_ORDERS}/${id}`);
  expect(res.status, res.text).toBe(200);
  return res.body as LaboOrderView;
}

/** Thông số từng răng and its row for one tooth (P3110 m139). */
function specTable(dialog: Locator) {
  const table = dialog.getByRole("region", { name: "Thông số từng răng" });
  return { table, row: (tooth: number | string) => table.locator(`tr[data-tooth="${tooth}"]`) };
}

/** Vertical middle of a box, to check cells of a row line up. */
async function middleY(box: Locator): Promise<number> {
  const rect = await box.boundingBox();
  expect(rect).not.toBeNull();
  return rect!.y + rect!.height / 2;
}

/** The first entry of a SearchSelect in that cell. */
async function pickFirst(page: Page, cell: Locator) {
  await cell.locator(".ss-trigger").click();
  const option = page.locator("#ss-portal-dropdown .ss-option").first();
  await expect(option).toBeVisible();
  await option.click();
}

/** DD/MM/YYYY HH:mm, `days` from today at `hour`:00 — what the DatePickers take. */
function pickerStamp(days: number, hour: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} ${pad(hour)}:00`;
}

async function typeDate(field: Locator, value: string) {
  await field.click();
  await field.fill(value);
  await field.press("Enter");
}

async function openLaboTab(page: Page, line: { patientId: string; branchId: string }) {
  await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=labo`);
  await assertRealApiTraffic(page, LABO_ORDERS);
}

function laboRow(page: Page, orderCode: string) {
  return page
    .locator("tbody tr.ant-table-row")
    .filter({ has: page.getByRole("cell", { name: orderCode, exact: true }) })
    .first();
}

/** The aria-labels of a row's Thao tác buttons, in order. */
function actionNames(row: Locator) {
  return row
    .locator(".pd-icon-actions .ant-btn")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
}

function workflowDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
}

async function expectStep(dialog: Locator, step: string, status: string) {
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(step);
  await expect(dialog.locator(".pd-labo-workflow-head")).toContainText(status);
  await expect(dialog.locator(".pd-labo-steps [role=tab][aria-selected=true]")).toContainText(step);
}

function stageRow(page: Page, stageId: string) {
  return page.locator(`.pd-stage-histrow[data-stage-id="${stageId}"]`);
}

/** LỊCH SỬ ĐIỀU TRỊ sits in the slip page's "Chi tiết phiếu" section. */
async function openStageHistory(page: Page, line: LaboLine) {
  await openStageDialog(page, line);
}

async function planLaboCell(page: Page, line: LaboLine) {
  await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}&planTab=detail`);
  const row = page.locator(`tr[data-row-key="${line.lineId}"]`);
  await expect(row).toBeVisible();
  return row;
}

/** R-1121 (BA): no order Chờ kiểm tra on the line — no code, no "Không áp dụng". */
async function expectLaboCellEmpty(planRow: Locator) {
  await expect(planRow.locator(".pdt-labo")).toHaveCount(0);
  await expect(planRow.locator(".pdt-labo-none")).toHaveCount(0);
}

/** Opens the plan row's Đổi trạng thái menu and returns its Hoàn thành entry. */
async function statusMenuDone(page: Page, planRow: Locator) {
  await planRow.locator(".pdt-status-trigger").click();
  const done = page.locator(".ant-dropdown:visible").getByRole("menuitem").filter({ hasText: /^Hoàn thành/ });
  await expect(done).toBeVisible();
  return done;
}

test.describe("Labo workflow on screen (P2910_03)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("a Nháp is sent, returned for one tooth, passed on round 2 and gets a warranty card per tooth", async ({ page }) => {
    test.setTimeout(240_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const stageA = await addStage(page, line, catalog.dentistId, `Labo A ${id}`);
    const stageB = await addStage(page, line, catalog.dentistId, `Labo B ${id}`);
    const draft = await createOrder(
      page,
      orderBody(catalog, line, id, { treatmentServiceId: line.lineId, treatmentStageId: stageA }),
      1,
    );
    expect(draft.status, draft.text).toBe(200);
    const orderId = draft.body.id!;
    const orderCode = draft.body.orderCode!;
    const dialog = workflowDialog(page);

    await test.step("Đặt hàng: Lưu nháp keeps a Nháp, Tạo phiếu Labo sends it", async () => {
      await openLaboTab(page, line);
      const row = laboRow(page, orderCode);
      await expect(row).toContainText("Nháp");
      expect(await actionNames(row)).toEqual(["Xem chi tiết", "Xoá"]);

      await row.getByRole("button", { name: "Xem chi tiết" }).click();
      await expectStep(dialog, "Đặt hàng", "Nháp");
      await expect(dialog.getByRole("tab", { name: /Nhận hàng & kiểm tra/ })).toBeDisabled();
      // The locked fields carry their label as their accessible name.
      const locked = (name: string) => dialog.getByRole("textbox", { name, exact: true });
      await expect(locked("Số phiếu Labo")).toHaveValue(orderCode);
      await expect(locked("Số phiếu Labo")).toBeDisabled();
      await expect(locked("Dịch vụ điều trị")).toHaveValue(line.serviceName);
      await expect(locked("Tên khách hàng")).not.toHaveValue("");
      await expect(locked("Kế hoạch điều trị")).not.toHaveValue("");
      // Răng (P3110 REQ-C6): the teeth picked as chips with Số lượng; the
      // purple button opens the chart, and Hủy there changes nothing.
      const teethRow = dialog.locator(".pd-labo-teeth");
      await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R21"]);
      await expect(teethRow).toContainText("Số lượng: 2");
      await teethRow.getByRole("button", { name: "Chọn răng" }).click();
      const chart = page.getByRole("dialog", { name: "Chọn răng" });
      await expect(chart).toBeVisible();
      await chart.getByRole("button", { name: "Hủy" }).click();
      await expect(chart).toBeHidden();
      await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R21"]);
      // The order-level spec the API took went to both teeth: nothing lacks.
      await expect(dialog.locator(".pd-labo-footer-hint")).toHaveText("Đủ thông tin cho 2 răng.");
      await dialog.getByRole("button", { name: "Lưu nháp" }).click();
      await expect(page.getByText("Đã lưu nháp phiếu Labo")).toBeVisible();
      await expect(dialog).toBeHidden();
      expect((await read(page, orderId)).status).toBe(LaboStatus.Draft);

      await row.getByRole("button", { name: "Xem chi tiết" }).click();
      await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
      await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(row).toContainText("Đã gửi Labo");
      expect(await actionNames(row)).toEqual(["Xem chi tiết", "Kiểm tra Labo"]);
      expect((await read(page, orderId)).status).toBe(LaboStatus.Sent);
    });

    await test.step("while it is out, the raising and later công đoạn are locked and the slip waits on Labo", async () => {
      await openStageHistory(page, line);
      const raised = stageRow(page, stageA);
      await expect(raised.locator(".pd-stage-labo")).toContainText(`${orderCode} · Đã gửi Labo`);
      await expect(raised.getByRole("button", { name: "Tạo Labo" })).toHaveCount(0);
      // BA: an unfinished order greys Hoàn thành on the công đoạn that raised it too.
      await expect(raised.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
      // P3110 m38: the note names the order and links to its check step; the cell tints.
      await expect(raised.locator(".pd-stage-labo-lock > p")).toHaveText(`Khoá: ${orderCode} chưa kiểm tra`);
      await expect(raised.locator(".pd-stage-rowactions")).toHaveClass(/pd-stage-rowactions--locked/);

      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock > p")).toHaveText(`Khoá: ${orderCode} chưa kiểm tra`);
      await expect(later.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
      // Note 16: Tải ảnh stays usable on a locked row; m7 (BA 2026-11-02):
      // "+1 phiếu trước · Xem tất cả ›" under Tạo Labo opens the patient's Labo tab.
      await expect(later.getByRole("button", { name: "Tải ảnh" })).toBeEnabled();
      const count = later.locator(".pd-stage-labo-count");
      await expect(count).toHaveText("+1 phiếu trước · Xem tất cả ›");
      await expect(count).toHaveAttribute("href", /\/patient\/[^?]+\?tab=labo/);
      const locked = await call(page, `${STAGES}/${stageB}/complete`, { method: "POST", branchId: line.branchId });
      expect(locked.status).toBe(403);
      expect((locked.body as { error?: { code?: string } }).error?.code).toBe(LOCKED_BY_LABO);

      // R-1121 (BA): only an order Chờ kiểm tra shows; one still at the Labo leaves the cell empty.
      const planRow = await planLaboCell(page, line);
      await expectLaboCellEmpty(planRow);

      // Đổi trạng thái: Hoàn thành waits on QC too (BA: "không cho hoàn thành").
      const done = await statusMenuDone(page, planRow);
      await expect(done).toHaveAttribute("aria-disabled", "true");
      await expect(done).toContainText("Khoá: phiếu Labo chưa QC đạt");
      await page.keyboard.press("Escape");
    });

    const note = `Hở bờ ${id}`;
    await test.step("round 1: «Kiểm tra Labo» opens B., tooth 21 Lỗi goes back with its own note, picture and a redelivery date", async () => {
      await openLaboTab(page, line);
      await laboRow(page, orderCode).getByRole("button", { name: "Kiểm tra Labo" }).click();
      await expectStep(dialog, "Nhận hàng & kiểm tra", "Đã gửi Labo");
      await expect(dialog.getByRole("heading", { name: /Nhận hàng · lần 1/ })).toBeVisible();
      // P3110 m175: the order at a glance, three by three.
      const summary = dialog.getByRole("region", { name: "Tóm tắt phiếu Labo" });
      await expect(summary.locator(".pd-labo-summary-fact")).toHaveCount(9);
      await expect(summary).toContainText(orderCode);
      await expect(summary).toContainText("Ngày giao dự kiến");
      // P3110 REQ-C2: Ngày gửi / Ngày giao dự kiến are days, no hour.
      await expect(summary).not.toContainText(/\d{2}:\d{2}/);

      // P3110 m279: B. waits behind «Kiểm tra Labo»; nothing to conclude yet.
      const start = dialog.locator(".pd-labo-start-card");
      await expect(start).toContainText("Chưa bắt đầu kiểm tra · 2 răng chờ kiểm tra");
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Chờ bắt đầu kiểm tra");
      await expect(dialog.getByRole("group", { name: "Răng 11" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /^Trả |^Xác nhận Labo đạt/ })).toHaveCount(0);
      await start.getByRole("button", { name: "Kiểm tra Labo" }).click();
      await expect(page.getByText("Đã nhận hàng · bắt đầu kiểm tra")).toBeVisible();
      await expect(dialog.locator(".pd-labo-workflow-head")).toContainText("Chờ kiểm tra");
      expect((await read(page, orderId)).status).toBe(LaboStatus.AwaitingCheck);
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Đạt 0 · Lỗi 0");

      const toothRow = (tooth: number) =>
        dialog.locator(".pd-labo-tooth-row").filter({ has: page.getByRole("group", { name: `Răng ${tooth}` }) });
      await dialog.getByRole("group", { name: "Răng 11" }).getByRole("button", { name: "Đạt" }).click();
      const faulty = dialog.getByRole("group", { name: "Răng 21" });
      await faulty.getByRole("button", { name: "Lỗi" }).click();
      await expect(faulty.getByRole("button", { name: "Lỗi" })).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Đạt 1 · Lỗi 1");
      // P3110 m342: Đã trả counts this return already; BH Labo waits for the fitting.
      await expect(toothRow(11)).toContainText("Đã trả: 0 lần");
      await expect(toothRow(11)).toContainText("BH Labo: chưa kích hoạt");
      await expect(toothRow(11)).not.toContainText("bật sau khi lắp"); // R-1112
      // P0111_02 (R-1110): a Đạt tooth takes its own pictures, five at most.
      const upload11 = toothRow(11).getByRole("button", { name: "Tải ảnh R11" });
      await expect(upload11).toHaveText("Tải ảnh");
      await toothRow(11).locator("input[type=file]").setInputFiles({ name: "dat-r11.png", mimeType: "image/png", buffer: PNG });
      await expect(upload11).toHaveText("Tải ảnh (1/5)");
      await expect(toothRow(11).locator(".pd-labo-tooth-pictures img")).toHaveCount(1);
      const row21 = toothRow(21);
      await expect(row21).toHaveClass(/pd-labo-tooth-row--fail/);
      await expect(row21).toContainText("Đã trả: 1 lần");
      await expect(row21).toContainText("Kết luận R21: KHÔNG ĐẠT → trả Labo lần 1");
      await expect(dialog.getByRole("region", { name: "Trả hàng cho Labo · lần 1" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Trả toàn bộ (2 răng)" })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "Xác nhận Labo đạt", exact: false })).toHaveCount(0);

      // A folded Lỗi group is still checked: the error opens it again.
      await row21.getByRole("button", { name: "Thu gọn" }).click();
      await expect(row21.locator(".pd-labo-defect")).toBeHidden();
      await dialog.getByRole("button", { name: "Trả hàng bị lỗi (1 răng)" }).click();
      await expect(row21.getByText("Vui lòng nhập mô tả gửi Labo cho R21")).toBeVisible();
      await expect(row21.getByRole("button", { name: "Thu gọn" })).toBeVisible();

      await row21.getByLabel("Mô tả gửi Labo · R21").fill(note);
      await typeDate(dialog.getByLabel("Hẹn Labo giao lại"), pickerStamp(5, 10).slice(0, 10));
      // REQ-D6 (R-1093): a Lỗi tooth without its own picture turns its group red.
      await dialog.getByRole("button", { name: "Trả hàng bị lỗi (1 răng)" }).click();
      const missing = row21.getByRole("alert");
      await expect(missing).toHaveText("Vui lòng tải ít nhất một hình ảnh lỗi cho R21");
      await row21.locator(".pd-labo-defect input[type=file]").setInputFiles({
        name: "kiem-tra.png",
        mimeType: "image/png",
        buffer: PNG,
      });
      // P0111_02 (R-1113): the defect well counts against the cap of five.
      await expect(row21.locator(".pd-labo-defect")).toContainText("1/5");
      await expect(missing).toHaveCount(0);

      // The history shows the round being entered, by tooth (m189).
      const history = dialog.locator(".pd-labo-check-section").filter({ hasText: "Lịch sử nhận hàng & trả hàng · theo răng" });
      await expect(history).toContainText("Đạt 1 · Lỗi 1 · đang nhập");
      await expect(history.locator(".pd-labo-check-aside")).toHaveText("1 lần nhận · Đã trả: R21 1");
      await expect(history.locator("tbody tr").filter({ hasText: "R21" })).toContainText(note);
      await expect(history.locator("tbody tr").filter({ hasText: "R21" })).toContainText("Trả lần 1");
      // Hẹn giao lại reads as a day only (m294).
      await expect(history.locator("tbody tr").filter({ hasText: "R21" })).toContainText(pickerStamp(5, 10).slice(0, 10));
      await expect(history.locator("tbody tr").filter({ hasText: "R21" })).not.toContainText(/\d{2}:\d{2}/);

      await dialog.getByRole("button", { name: "Trả hàng bị lỗi (1 răng)" }).click();
      // The return uploads the pictures to MinIO first; under a full run that takes a while.
      await expect(page.getByText("Đã trả hàng cho Labo")).toBeVisible({ timeout: 20_000 });
      await expect(dialog).toBeHidden();
      await expect(laboRow(page, orderCode)).toContainText("Trả hàng");

      const returned = await read(page, orderId);
      expect(returned.status).toBe(LaboStatus.Returned);
      expect(returned.rounds?.[0].toothResults.find((tooth) => tooth.toothNumber === 21)?.note).toBe(note);
      expect(returned.teeth?.find((tooth) => tooth.toothNumber === 11)?.passedAt).toBeTruthy();
      // Both teeth's pictures of round 1 were saved: R11 Đạt (R-1110), R21 Lỗi.
      const round1 = returned.images.filter((image) => image.roundNo === 1);
      expect(round1.map((image) => image.toothNumber).sort()).toEqual([11, 21]);
    });

    await test.step("one tooth Đạt, another Lỗi: still locked and no Kích hoạt bảo hành (BA)", async () => {
      await openStageHistory(page, line);
      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock > p")).toHaveText(`Khoá: ${orderCode} chưa kiểm tra`);
      await expect(later.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
      // Scoped to this line's rows: the shared patient carries other lines from earlier runs.
      for (const row of [stageRow(page, stageA), later]) {
        await expect(row.getByRole("button", { name: /Kích hoạt bảo hành$/ })).toHaveCount(0);
      }
      await openLaboTab(page, line);
    });

    await test.step("round 2: only tooth 21 is due; all passed → Hoàn thành", async () => {
      await page.reload();
      await laboRow(page, orderCode).getByRole("button", { name: "Kiểm tra Labo" }).click();
      await expectStep(dialog, "Nhận hàng & kiểm tra", "Trả hàng");
      await expect(dialog.getByRole("heading", { name: /Nhận hàng · lần 2/ })).toBeVisible();
      await expect(dialog.locator(".pd-labo-start-card")).toContainText("1 răng chờ kiểm tra");
      // Round 1 by tooth, saved (m294): 11 waits for the fitting, 21 went back once.
      const history = dialog.locator(".pd-labo-check-section").filter({ hasText: "Lịch sử nhận hàng & trả hàng · theo răng" });
      await expect(history).toContainText("Đạt 1 · Lỗi 1");
      await expect(history.locator("tbody tr").filter({ hasText: "R11" })).toContainText("Chờ lắp");
      await expect(history.locator("tbody tr").filter({ hasText: "R21" })).toContainText("Trả lần 1");

      await dialog.locator(".pd-labo-start-card").getByRole("button", { name: "Kiểm tra Labo" }).click();
      await expect(dialog.getByRole("group", { name: "Răng 11" })).toHaveCount(0);
      const passed11 = dialog.locator(".pd-labo-tooth-row--locked").filter({ hasText: "Răng 11" });
      await expect(passed11).toContainText("Đạt lần 1 · chờ lắp");
      await expect(passed11).toContainText("không có trong lần giao này");

      // REQ-D6: a tooth back from the Labo starts from the note it went back with.
      const tooth21 = dialog.getByRole("group", { name: "Răng 21" });
      await tooth21.getByRole("button", { name: "Lỗi" }).click();
      const row21 = dialog.locator(".pd-labo-tooth-row--fail");
      await expect(row21.getByLabel("Mô tả gửi Labo · R21")).toHaveValue(note);
      await expect(row21).toContainText("Kết luận R21: KHÔNG ĐẠT → trả Labo lần 2");
      await expect(row21).toContainText(`Lần 1: ${note}`);
      await expect(row21).toContainText("Đã trả: 2 lần");
      // Tooth 11 passed before, so Trả hàng bị lỗi stays beside Trả toàn bộ (REQ-D11).
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Đạt 0 · Lỗi 1");
      await expect(dialog.getByRole("button", { name: "Trả toàn bộ (2 răng)" })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "Trả hàng bị lỗi (1 răng)" })).toBeEnabled();

      await tooth21.getByRole("button", { name: "Đạt" }).click();
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Đạt tất cả 1/1");
      await expect(dialog.locator(".pd-labo-footer-hint")).toHaveText("Phiếu → QC đạt · mở khoá «Lắp»");
      await dialog.getByRole("button", { name: "Xác nhận Labo đạt (1 răng)" }).click();
      await expect(page.getByText("Đã xác nhận Labo đạt")).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(laboRow(page, orderCode)).toContainText("Hoàn thành");
      expect((await read(page, orderId)).status).toBe(LaboStatus.Completed);
    });

    await test.step("QC passed today: the lock lifts and Kích hoạt bảo hành is left to the Labo tab", async () => {
      await openStageHistory(page, line);
      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock")).toHaveCount(0);
      await expect(later.getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
      await expect(stageRow(page, stageA).getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
      await expect(stageRow(page, stageA).locator(".pd-stage-labo-lock")).toHaveCount(0);
      await expect(stageRow(page, stageA).locator(".pd-stage-labo")).toContainText(`${orderCode} · Hoàn thành`);
      // P3110 REQ-A8: the history row no longer offers Kích hoạt bảo hành.
      await expect(later.getByRole("button", { name: /Kích hoạt bảo hành$/ })).toHaveCount(0);

      await openLaboTab(page, line);
      await laboRow(page, orderCode).getByRole("button", { name: /Kích hoạt bảo hành$/ }).click();
      await expectStep(dialog, "Bảo hành", "Hoàn thành");
    });

    await test.step("Bảo hành: one card for tooth 11, tooth 21 left for later", async () => {
      const box = dialog.getByRole("region", { name: "Kích hoạt bảo hành" });
      // 1. Chọn răng kích hoạt: a card per tooth with its own tick, "Tất cả" on the title.
      const pickAll = box.getByRole("checkbox", { name: "Tất cả", exact: true });
      const tooth21 = box.getByRole("checkbox", { name: "Răng 21", exact: true });
      await expect(pickAll).toBeChecked();
      await expect(tooth21).toBeChecked();
      await tooth21.uncheck();
      await expect(tooth21).not.toBeChecked();
      await expect(box.getByRole("article", { name: "Răng 21" })).toHaveCount(0);
      await expect(box.locator(".pd-labo-warranty-pick-all .ant-checkbox-indeterminate")).toHaveCount(1);

      const card = box.getByRole("article", { name: "Răng 11" });
      await typeDate(card.getByLabel("Ngày bắt đầu bảo hành"), pickerStamp(0, 0).slice(0, 10));
      await card.locator(".pd-labo-warranty-duration").filter({ hasText: "6 tháng" }).click();
      // P3110 REQ-E1: Ảnh thẻ bảo hành — Mặt trước picked, Mặt sau left empty.
      await expect(card.getByRole("button", { name: "Tải ảnh Mặt sau" })).toBeVisible();
      await card
        .locator(".bd-warranty-photos input[type=file]")
        .first()
        .setInputFiles({ name: "the-mat-truoc.png", mimeType: "image/png", buffer: PNG });
      await expect(card.getByRole("button", { name: "Tải ảnh Mặt trước" })).toHaveCount(0);
      await expect(card.getByRole("img", { name: "Mặt trước" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Xóa ảnh Mặt trước" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Kích hoạt bảo hành (1 răng)" }).click();
      await expect(page.getByText("Đã kích hoạt bảo hành 1 răng")).toBeVisible();

      const warranted = await read(page, orderId);
      expect(warranted.status).toBe(LaboStatus.Warranty);
      const code11 = warranted.teeth?.find((tooth) => tooth.toothNumber === 11)?.warrantyCardCode ?? "";
      // R-1090: BH-{mã dòng dịch vụ}-{ddMMyyyy}-01, the line's first card of the day.
      const day = pickerStamp(0, 0).slice(0, 10).replaceAll("/", "");
      expect(code11).toMatch(new RegExp(`^BH-DT\\d+-\\d+-${day}-01$`));
      expect(warranted.teeth?.find((tooth) => tooth.toothNumber === 11)?.warrantyMonths).toBe(6);
      expect(warranted.teeth?.find((tooth) => tooth.toothNumber === 21)?.warrantyCardCode).toBeNull();
      expect(warranted.images.filter((image) => image.warrantyCardSide != null).map((image) => [image.toothNumber, image.warrantyCardSide])).toEqual([
        [11, 1],
      ]);

      // Reloaded straight onto tab 3: the cards come back from the server.
      await page.goto(
        `/patient/${line.patientId}?branchId=${line.branchId}&tab=labo&laboModal=order&laboRowId=${orderId}&laboStep=warranty`,
      );
      await expectStep(dialog, "Bảo hành", "Bảo hành");
      await expect(dialog.locator(".pd-labo-warranty-card--active")).toContainText(`Thẻ bảo hành · ${code11}`);
      await expect(dialog.locator(".pd-labo-warranty-card--inactive")).toContainText("Răng 21");
      // REQ-E1/E2: the photo lands in Ảnh thẻ; the card no longer opens a Thông tin thẻ / Lịch sử panel.
      // The table sits on its own view, as the Labo 3 mock lays it out.
      await dialog.getByRole("tab", { name: /^Thẻ bảo hành theo từng răng/ }).click();
      const table = dialog.locator(".pd-labo-warranty-table");
      await expect(table.getByRole("columnheader", { name: "Ảnh thẻ" })).toBeVisible();
      const row11 = table.locator("tbody tr.ant-table-row").filter({ hasText: code11 });
      await expect(row11.getByRole("img", { name: "Mặt trước" })).toBeVisible();
      await expect(row11.getByRole("img", { name: "Mặt sau" })).toHaveCount(0);
      await expect(dialog.getByRole("tab", { name: "Thông tin thẻ" })).toHaveCount(0);
      await expect(dialog.getByRole("tab", { name: "Lịch sử" })).toHaveCount(0);

      // REQ-D7/D8: back on tab 2, B. stays in sight, read-only — fitted and carded vs waiting.
      await dialog.getByRole("tab", { name: /Nhận hàng & kiểm tra/ }).click();
      const passedRows = dialog.locator(".pd-labo-tooth-row--locked");
      await expect(dialog.locator(".pd-labo-check-tally")).toHaveText("Đạt tất cả 2/2");
      await expect(passedRows).toHaveCount(2);
      const fitted = passedRows.filter({ hasText: "Răng 11" });
      await expect(fitted).toContainText(`Đạt lần 1 · đã lắp ${clinicToday().slice(8, 10)}/${clinicToday().slice(5, 7)}`);
      await expect(fitted).toContainText(`BH Labo: đã kích hoạt · ${code11}`);
      const waiting = passedRows.filter({ hasText: "Răng 21" });
      await expect(waiting).toContainText("Đạt lần 2 · chờ lắp");
      await expect(waiting).toContainText("BH Labo: chưa kích hoạt");
      await expect(passedRows.filter({ hasText: "không có trong lần giao này" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Đạt" })).toHaveCount(0);
    });

    await test.step("the slip's Phiếu Labo column empties once checked and Hoàn thành is offered", async () => {
      const planRow = await planLaboCell(page, line);
      // R-1121: Bảo hành waits on no check, so the cell stays empty.
      await expectLaboCellEmpty(planRow);

      const done = await statusMenuDone(page, planRow);
      await expect(done).not.toHaveAttribute("aria-disabled", "true");
      await expect(done).toHaveText("Hoàn thành");
      await page.keyboard.press("Escape");
    });
  });

  test("the slip's Phiếu Labo shows the earliest-created order Chờ kiểm tra, then the next once it is checked (R-1121)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const sendOne = (tag: string) => sentOrder(page, orderBody(catalog, line, `${id}${tag}`, { treatmentServiceId: line.lineId }));
    // Made in this order; D stays at the Labo.
    const a = await sendOne("a");
    const b = await sendOne("b");
    const c = await sendOne("c");
    const d = await sendOne("d");
    // Received out of creation order — A last — so only the creation order can put A first.
    for (const order of [b, c, a]) {
      const received = await receive(page, order.id, 2);
      expect(received.status, received.text).toBe(200);
      expect(received.body.status).toBe(LaboStatus.AwaitingCheck);
    }
    const dialog = workflowDialog(page);

    await test.step("three Chờ kiểm tra: A, the first made, shows with the other three counted", async () => {
      const planRow = await planLaboCell(page, line);
      const cell = planRow.locator(".pdt-labo");
      await expect(cell.locator(".ant-tag")).toHaveText("Chờ kiểm tra");
      await expect(cell.locator(".pdt-labo-code")).toHaveText(a.orderCode);
      await expect(cell.locator(".pdt-labo-due")).toContainText("Đã nhận: ");
      await expect(cell.locator(".pdt-labo-more")).toHaveText("+3 phiếu khác · Xem tất cả ›");
    });

    await test.step("A passed from the cell's own dialog: B takes its place without a reload, and after one", async () => {
      const planRow = page.locator(`tr[data-row-key="${line.lineId}"]`);
      await planRow.locator(".pdt-labo-code").click();
      await expectStep(dialog, "Nhận hàng & kiểm tra", "Chờ kiểm tra");
      for (const tooth of [11, 21]) {
        await dialog.getByRole("group", { name: `Răng ${tooth}` }).getByRole("button", { name: "Đạt" }).click();
      }
      await dialog.getByRole("button", { name: "Xác nhận Labo đạt (2 răng)" }).click();
      await expect(page.getByText("Đã xác nhận Labo đạt")).toBeVisible();
      await expect(dialog).toBeHidden();
      expect((await read(page, a.id)).status).toBe(LaboStatus.Completed);

      await expect(planRow.locator(".pdt-labo-code")).toHaveText(b.orderCode);
      await page.reload();
      await expect(planRow.locator(".pdt-labo-code")).toHaveText(b.orderCode);
      await expect(planRow.locator(".pdt-labo .ant-tag")).toHaveText("Chờ kiểm tra");
      await expect(planRow.locator(".pdt-labo-more")).toHaveText("+3 phiếu khác · Xem tất cả ›");
    });

    await test.step("B and C passed: only D, still at the Labo, is left — the cell empties", async () => {
      await passAll(page, b.id, [11, 21]);
      await page.reload();
      const planRow = page.locator(`tr[data-row-key="${line.lineId}"]`);
      await expect(planRow.locator(".pdt-labo-code")).toHaveText(c.orderCode);
      await passAll(page, c.id, [11, 21]);
      await page.reload();
      await expect(planRow).toBeVisible();
      await expectLaboCellEmpty(planRow);
      expect((await read(page, d.id)).status).toBe(LaboStatus.Sent);
    });
  });

  test("Dùng chung 1 thông số: one start, duration, conditions and photo for every picked tooth, a serial each", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const id = runId();
    const teeth = [11, 21, 22, 23];
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { teeth, quantity: teeth.length, treatmentServiceId: line.lineId }));
    const received = await receive(page, order.id, teeth.length);
    expect(received.status, received.text).toBe(200);
    await passAll(page, order.id, teeth);
    const dialog = workflowDialog(page);
    const box = dialog.getByRole("region", { name: "Kích hoạt bảo hành" });
    const share = box.getByRole("checkbox", { name: "Dùng chung 1 thông số cho tất cả răng" });

    await page.goto(
      `/patient/${line.patientId}?branchId=${line.branchId}&tab=labo&laboModal=order&laboRowId=${order.id}&laboStep=warranty`,
    );
    await assertRealApiTraffic(page, LABO_ORDERS);
    await expectStep(dialog, "Bảo hành", "Hoàn thành");

    await test.step("off by default: a full form per tooth and the hint to turn it on", async () => {
      await expect(share).not.toBeChecked();
      await expect(box.locator(".pd-labo-warranty-share")).toContainText("Bật để nhập 1 lần cho tất cả răng đã chọn");
      await expect(box.getByRole("article", { name: "Răng 22" }).getByLabel("Ngày bắt đầu bảo hành")).toBeVisible();
    });

    await test.step("on: one form for all, a serial per tooth, the preview's head shows three chips", async () => {
      await share.check();
      await expect(box.getByRole("heading", { level: 4 }).filter({ hasText: "(dùng chung)" })).toContainText(
        "Thẻ bảo hành · R11, R21, R22, R23 (dùng chung)",
      );
      await expect(box).toContainText("Ngày bắt đầu, thời hạn, điều kiện và ảnh thẻ áp dụng cho 4 răng đã chọn. Serial nhập riêng.");
      const shared = box.getByRole("region", { name: "Dùng chung 1 thông số cho tất cả răng" });
      await expect(shared.getByPlaceholder("Nhập riêng từng răng bên dưới")).toBeDisabled();
      await expect(box.getByRole("article", { name: "Răng 22" }).getByLabel("Ngày bắt đầu bảo hành")).toHaveCount(0);
      // BA: the card's head names its teeth only while three at most — four, and none, never a cut-off few.
      const headChips = dialog.locator(".pd-labo-warranty-preview .pd-labo-warranty-card-tooth");
      await expect(headChips).toHaveCount(0);
      await expect(dialog.locator(".pd-labo-warranty-preview-teeth")).toContainText("Răng trong thẻ bảo hành (4)");
      await expect(dialog.locator(".pd-labo-warranty-preview-teeth li")).toHaveText(["Răng 11", "Răng 21", "Răng 22", "Răng 23"]);
      const tooth23 = box.getByRole("checkbox", { name: "Răng 23", exact: true });
      await tooth23.uncheck();
      await expect(headChips).toHaveText(["R11", "R21", "R22"]);
      await expect(dialog.locator(".pd-labo-warranty-preview-teeth li")).toHaveText(["Răng 11", "Răng 21", "Răng 22"]);
      await tooth23.check();
      await expect(headChips).toHaveCount(0);

      await typeDate(shared.getByLabel("Ngày bắt đầu bảo hành"), pickerStamp(0, 0).slice(0, 10));
      await shared.locator(".pd-labo-warranty-duration").filter({ hasText: "1 năm" }).click();
      await shared.getByLabel("Điều kiện bảo hành").fill(`Điều kiện chung ${id}`);
      await shared
        .locator(".bd-warranty-photos input[type=file]")
        .first()
        .setInputFiles({ name: "the-chung.png", mimeType: "image/png", buffer: PNG });
      await expect(shared.getByRole("img", { name: "Mặt trước" })).toBeVisible();
      for (const tooth of teeth) {
        await box.getByRole("article", { name: `Răng ${tooth}` }).getByLabel("Số serial nhà sản xuất").fill(`SN-${id}-${tooth}`);
      }
      await expect(box.getByText("4/4 răng đã đủ thông tin").first()).toBeVisible();
      await expect(dialog.locator(".pd-labo-warranty-preview .pd-labo-warranty-card")).toContainText("4 sẵn sàng");
    });

    await test.step("off again keeps what was typed, on each tooth's own form", async () => {
      await share.uncheck();
      const own = box.getByRole("article", { name: "Răng 23" });
      await expect(own.getByLabel("Ngày bắt đầu bảo hành")).toHaveValue(pickerStamp(0, 0).slice(0, 10));
      await expect(own.getByLabel("Điều kiện bảo hành")).toHaveValue(`Điều kiện chung ${id}`);
      await expect(own.getByRole("img", { name: "Mặt trước" })).toBeVisible();
      await share.check();
    });

    await test.step("Kích hoạt: a card per tooth with the shared validity and its own serial, kept after a reload", async () => {
      await dialog.getByRole("button", { name: "Kích hoạt bảo hành (4 răng)" }).click();
      await expect(page.getByText("Đã kích hoạt bảo hành 4 răng")).toBeVisible({ timeout: 30_000 });
      const warranted = await read(page, order.id);
      expect(warranted.status).toBe(LaboStatus.Warranty);
      const cards = teeth.map((tooth) => warranted.teeth.find((row) => row.toothNumber === tooth));
      for (const [i, card] of cards.entries()) {
        expect(card?.warrantyCardCode).toBeTruthy();
        expect(card?.warrantyMonths).toBe(12);
        expect(card?.warrantyStartDate).toBe(clinicToday());
        expect(card?.warrantyConditions).toBe(`Điều kiện chung ${id}`);
        expect(card?.manufacturerSerial).toBe(`SN-${id}-${teeth[i]}`);
      }
      expect(new Set(cards.map((card) => card?.warrantyCardCode)).size).toBe(teeth.length);
      const fronts = warranted.images.filter((image) => image.warrantyCardSide === 1).map((image) => image.toothNumber);
      expect(fronts.sort()).toEqual(teeth);

      await page.reload();
      await expectStep(dialog, "Bảo hành", "Bảo hành");
      await expect(dialog.locator(".pd-labo-warranty-card--active")).toHaveCount(teeth.length);
    });
  });

  test("a tooth already on another order of the slip is flagged, not blocked (P0111_02, R-1106)", async ({ page }) => {
    test.setTimeout(120_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const earlier = await createOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect(earlier.status, earlier.text).toBe(200);
    const later = await createOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId, teeth: [11], quantity: 1 }));
    expect(later.status, later.text).toBe(200);
    const dialog = workflowDialog(page);

    await openLaboTab(page, line);
    await laboRow(page, later.body.orderCode!).getByRole("button", { name: "Xem chi tiết" }).click();
    await expectStep(dialog, "Đặt hàng", "Nháp");
    // R11 sits on the earlier order: an orange chip and the box naming it.
    await expect(dialog.locator(".pd-labo-toothchip--prior")).toHaveText(["R11"]);
    const warning = dialog.locator(".pd-labo-prior");
    await expect(warning.locator(".pd-labo-prior-order")).toHaveCount(1);
    await expect(warning).toContainText("R11 đã có phiếu Labo trước đó");
    await expect(warning.locator(".pd-labo-prior-code")).toHaveText(earlier.body.orderCode!);
    await expect(warning).not.toContainText("R21");

    // «Xem phiếu» opens the earlier order on top; the one being made stays.
    await warning.getByRole("button", { name: "Xem phiếu" }).click();
    const detail = page.locator(".pd-labo-detail-dialog");
    await expect(detail).toBeVisible();
    // The earlier one: both its teeth, where the order being made has R11 only.
    await expect(detail).toContainText("Răng11, 21");
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(dialog).toBeVisible();

    // Only a warning: Tạo phiếu Labo still sends it.
    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
    expect((await read(page, later.body.id!)).status).toBe(LaboStatus.Sent);
  });

  test("Đặt hàng per tooth: pick teeth, fill each row, pictures per tooth, shared mode, sent without a picture (P3110)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const draft = await createOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect(draft.status, draft.text).toBe(200);
    const orderId = draft.body.id!;
    const orderCode = draft.body.orderCode!;
    const dialog = workflowDialog(page);
    const spec = specTable(dialog);
    const teethRow = dialog.locator(".pd-labo-teeth");
    const status = dialog.locator(".pd-labo-footer-hint");
    const send = dialog.getByRole("button", { name: "Tạo phiếu Labo" });

    await test.step("a tooth added on the chart gets an empty row, and Gửi Labo waits on it", async () => {
      await openLaboTab(page, line);
      await laboRow(page, orderCode).getByRole("button", { name: "Xem chi tiết" }).click();
      await expectStep(dialog, "Đặt hàng", "Nháp");
      await teethRow.getByRole("button", { name: "Chọn răng" }).click();
      const chart = page.getByRole("dialog", { name: "Chọn răng" });
      await chart.getByRole("button", { name: "Răng 12", exact: true }).click();
      await expect(chart.locator(".pd-labo-chartcount")).toHaveText("Số lượng: 3");
      await chart.getByRole("button", { name: "Chọn răng" }).click();
      await expect(chart).toBeHidden();
      await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R12", "R21"]);
      await expect(teethRow).toContainText("Số lượng: 3");

      await expect(spec.table.locator("tbody tr")).toHaveCount(3);
      await expect(spec.row(12)).toHaveClass(/pd-labo-spec-row--gap/);
      // The Ảnh "+" sits on the row's middle line with Màu răng (m139), not pushed down.
      const shade = await middleY(spec.row(12).getByRole("textbox", { name: "Màu răng R12" }));
      expect(Math.abs((await middleY(spec.row(12).locator(".pd-labo-cellwell"))) - shade)).toBeLessThanOrEqual(2);
      await expect(status).toHaveText("R12 chưa nhập màu răng và chưa chọn đường hoàn tất.");
      await expect(send).toBeDisabled();

      await spec.row(12).getByRole("textbox", { name: "Màu răng R12" }).fill("A1/A2");
      await expect(status).toHaveText("R12 chưa chọn đường hoàn tất.");
      await pickFirst(page, spec.row(12).locator("td").nth(1));
      await expect(spec.row(12)).not.toHaveClass(/pd-labo-spec-row--gap/);
      await expect(status).toHaveText("Đủ thông tin cho 3 răng.");
      await expect(send).toBeEnabled();
      await spec.row(12).getByRole("textbox", { name: "Ghi chú cho Labo R12" }).fill(`Mài sát ${id}`);
    });

    await test.step("a picture on R12's row, none in common; Lưu nháp keeps both after a reload", async () => {
      await spec.row(12).locator("input[type=file]").setInputFiles([
        { name: "rang-12.png", mimeType: "image/png", buffer: PNG },
      ]);
      await expect(spec.row(12).locator("img")).toHaveCount(1);
      await dialog.getByRole("button", { name: "Lưu nháp" }).click();
      await expect(page.getByText("Đã lưu nháp phiếu Labo")).toBeVisible();
      await expect(dialog).toBeHidden();

      await page.reload();
      await assertRealApiTraffic(page, LABO_ORDERS);
      await laboRow(page, orderCode).getByRole("button", { name: "Xem chi tiết" }).click();
      await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R12", "R21"]);
      await expect(spec.row(12).getByRole("textbox", { name: "Màu răng R12" })).toHaveValue("A1/A2");
      await expect(spec.row(12).getByRole("textbox", { name: "Ghi chú cho Labo R12" })).toHaveValue(`Mài sát ${id}`);
      await expect(spec.row(12).locator("img")).toHaveCount(1);
      await expect(dialog.locator(".pd-labo-row--common img")).toHaveCount(0);
      const saved = await read(page, orderId);
      expect(saved.status).toBe(LaboStatus.Draft);
      expect(saved.images.map((image) => image.toothNumber)).toEqual([12]);
    });

    await test.step("Dùng chung: one row for every tooth, with the caption; unticked, every row takes the shared values", async () => {
      await dialog.getByRole("checkbox", { name: "Dùng chung 1 thông số cho tất cả răng" }).check();
      await expect(spec.table.locator("tbody tr")).toHaveCount(1);
      await expect(spec.table.locator("tbody th")).toHaveText("R11, R12, R21");
      await expect(dialog.locator(".pd-labo-spec-caption")).toHaveText(
        "Thông số trên áp dụng cho cả 3 răng. Bỏ chọn «Dùng chung» để chỉnh riêng từng răng – giá trị chung được điền sẵn vào mỗi dòng.",
      );
      await dialog.getByRole("checkbox", { name: "Dùng chung 1 thông số cho tất cả răng" }).uncheck();
      await expect(spec.table.locator("tbody tr")).toHaveCount(3);
      await expect(dialog.locator(".pd-labo-spec-caption")).toHaveCount(0);
      await expect(status).toHaveText("Đủ thông tin cho 3 răng.");
      // The shared row started from R11 (the first tooth) and now fills each row (m154).
      const shade12 = spec.row(12).getByRole("textbox", { name: "Màu răng R12" });
      const note12 = spec.row(12).getByRole("textbox", { name: "Ghi chú cho Labo R12" });
      await expect(shade12).toHaveValue(`A2-${id}`);
      await expect(note12).toHaveValue("");
      await shade12.fill("A1/A2");
      await note12.fill(`Mài sát ${id}`);
    });

    await test.step("Tạo phiếu Labo: sent with no common picture, each tooth's spec kept", async () => {
      await send.click();
      await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
      await expect(dialog).toBeHidden();
      const sent = await read(page, orderId);
      expect(sent.status).toBe(LaboStatus.Sent);
      expect(sent.teeth.map((tooth) => [tooth.toothNumber, tooth.shade])).toEqual([
        [11, `A2-${id}`],
        [12, "A1/A2"],
        [21, `A2-${id}`],
      ]);
      expect(sent.teeth.every((tooth) => Boolean(tooth.finishLineId))).toBe(true);
      expect(sent.teeth.find((tooth) => tooth.toothNumber === 12)?.labNote).toBe(`Mài sát ${id}`);

      // Sent, it opens on Nhận hàng & kiểm tra; back on Đặt hàng the table
      // reads only: no chart button, the chips stay.
      await page.reload();
      await laboRow(page, orderCode).getByRole("button", { name: "Xem chi tiết" }).click();
      await expectStep(dialog, "Nhận hàng & kiểm tra", "Đã gửi");
      await dialog.getByRole("tab", { name: /Đặt hàng/ }).click();
      await expect(teethRow.locator(".pd-labo-toothchip")).toHaveText(["R11", "R12", "R21"]);
      await expect(teethRow.getByRole("button", { name: "Chọn răng" })).toHaveCount(0);
      await expect(spec.row(12).getByRole("textbox", { name: "Màu răng R12" })).toBeDisabled();
    });
  });

  test("the Labo tab counts by status, deletes a Nháp and keeps a cancelled order listed", async ({ page }) => {
    test.setTimeout(180_000);
    const id = runId();
    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const draft = await createOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));
    expect(draft.status, draft.text).toBe(200);
    const sent = await sentOrder(page, orderBody(catalog, line, `${id}s`, { treatmentServiceId: line.lineId }));

    await openLaboTab(page, line);
    const stats = await call<Record<string, number>>(page, `${LABO_ORDERS}/stats?patientId=${line.patientId}`, {
      branchId: line.branchId,
    });
    expect(stats.status, stats.text).toBe(200);
    const cards = page.locator(".pd-stat");
    await expect(cards.locator("span")).toHaveText([
      "Nháp",
      "Trả hàng",
      "Chờ kiểm tra",
      "Hoàn thành",
      "Đang bảo hành",
      "Hết hạn bảo hành",
    ]);
    const keys = ["draft", "returned", "awaitingCheck", "completed", "inWarranty", "warrantyExpired"];
    await expect(cards.locator("strong")).toHaveText(keys.map((key) => String(stats.body[key])));

    // Xóa on a Nháp: confirmed, it is gone and the count drops.
    const draftRow = laboRow(page, draft.body.orderCode!);
    await draftRow.getByRole("button", { name: "Xoá" }).click();
    const confirmDelete = page.getByRole("dialog").filter({ hasText: `Xóa phiếu nháp ${draft.body.orderCode}?` });
    await confirmDelete.getByRole("button", { name: "Có" }).click();
    await expect(page.getByText("Đã xóa phiếu nháp")).toBeVisible();
    await page.reload();
    await expect(laboRow(page, sent.orderCode)).toBeVisible();
    await expect(laboRow(page, draft.body.orderCode!)).toHaveCount(0);
    await expect(cards.first().locator("strong")).toHaveText(String((stats.body.draft ?? 0) - 1));

    // Hủy phiếu from the dialog: the order stays listed as Đã hủy, with only the eye.
    await laboRow(page, sent.orderCode).getByRole("button", { name: "Xem chi tiết" }).click();
    const dialog = workflowDialog(page);
    await dialog.locator(".pd-labo-step-footer").getByRole("button", { name: "Hủy phiếu" }).click();
    const confirmCancel = page.getByRole("dialog").filter({ hasText: `Hủy phiếu Labo ${sent.orderCode}?` });
    await confirmCancel.getByRole("button", { name: "Có" }).click();
    await expect(page.getByText("Đã hủy phiếu Labo")).toBeVisible();
    await page.reload();
    const cancelled = laboRow(page, sent.orderCode);
    await expect(cancelled).toContainText("Đã hủy");
    expect(await actionNames(cancelled)).toEqual(["Xem chi tiết"]);
    expect((await read(page, sent.id)).status).toBe(LaboStatus.Cancelled);

    // Only cancelled orders left on the line: the slip reads Không áp dụng.
    const row = await planLaboCell(page, line);
    await expect(row.locator(".pdt-labo-none")).toHaveText("Không áp dụng");
  });

  test("the Labo tab and Kiểm tra Labo follow the treatmentLabo leaves", async ({ page, browser }) => {
    test.setTimeout(300_000);
    const id = runId();
    const userName = `bslw${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI LABO WF ${id}`;
    const LEAVES = ["patient.read", "treatmentLabo.read", "treatmentLabo.update"];

    const line = await laboLine(page);
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { treatmentServiceId: line.lineId }));

    await resetDentistLeaves(page, LEAVES);
    await createDentist(page, fullName, userName, password);
    await setDentistLeaf(page, "patient.read", true);
    const dentist = await openDentistSession(browser, userName, password);
    try {
      const patientUrl = `/patient/${line.patientId}?branchId=${line.branchId}&tab=labo`;
      await dentist.page.goto(patientUrl);
      const tabs = dentist.page.getByRole("navigation", { name: "Chi tiết bệnh nhân" });
      await expect(tabs.getByRole("link", { name: "Hồ sơ", exact: true })).toBeVisible();
      await expect(tabs.getByRole("link", { name: "Labo", exact: true })).toHaveCount(0);

      await setDentistLeaf(page, "treatmentLabo.read", true);
      await dentist.page.goto(patientUrl);
      let row = laboRow(dentist.page, order.orderCode);
      await expect(row).toContainText("Đã gửi Labo");
      expect(await actionNames(row)).toEqual(["Xem chi tiết"]);

      await setDentistLeaf(page, "treatmentLabo.update", true);
      await dentist.page.goto(patientUrl);
      row = laboRow(dentist.page, order.orderCode);
      await expect(row).toContainText("Đã gửi Labo");
      expect(await actionNames(row)).toEqual(["Xem chi tiết", "Kiểm tra Labo"]);
    } finally {
      await dentist.context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});
