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
      // Răng is not picked: the chart only shows the công đoạn's teeth, and
      // Số lượng is their count (P2910_03).
      const teethRow = dialog.locator(".pd-labo-teeth");
      await expect(teethRow).toContainText(/Số lượng: [1-9]\d*/);
      await teethRow.getByRole("button", { name: "Xem sơ đồ răng" }).click();
      const chart = page.getByRole("dialog", { name: new RegExp(orderCode) });
      await expect(chart).toBeVisible();
      await chart.getByRole("button", { name: /Close|Đóng/ }).first().click();
      await expect(chart).toBeHidden();
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
      await expect(raised.locator(".pd-stage-labo-lock")).toHaveText("Khoá: phiếu Labo chưa QC đạt");

      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock")).toHaveText("Khoá: phiếu Labo chưa QC đạt");
      await expect(later.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
      const locked = await call(page, `${STAGES}/${stageB}/complete`, { method: "POST", branchId: line.branchId });
      expect(locked.status).toBe(403);
      expect((locked.body as { error?: { code?: string } }).error?.code).toBe(LOCKED_BY_LABO);

      const planRow = await planLaboCell(page, line);
      const cell = planRow.locator(".pdt-labo");
      await expect(cell).toContainText("Chờ Labo");
      await expect(cell.locator(".pdt-labo-code")).toHaveText(orderCode);

      // Đổi trạng thái: Hoàn thành waits on QC too (BA: "không cho hoàn thành").
      const done = await statusMenuDone(page, planRow);
      await expect(done).toHaveAttribute("aria-disabled", "true");
      await expect(done).toContainText("Khoá: phiếu Labo chưa QC đạt");
      await page.keyboard.press("Escape");
    });

    const note = `Hở bờ ${id}`;
    await test.step("round 1: tooth 21 Lỗi goes back with an Ảnh kiểm tra and a redelivery date", async () => {
      await openLaboTab(page, line);
      await laboRow(page, orderCode).getByRole("button", { name: "Kiểm tra Labo" }).click();
      await expectStep(dialog, "Nhận hàng & kiểm tra", "Đã gửi Labo");
      await expect(dialog.getByRole("heading", { name: /Nhận hàng · lần 1/ })).toBeVisible();
      // The order and patient sit locked above the summary (BA mock: "lock hết").
      const slip = dialog.getByRole("textbox", { name: "Phiếu dịch vụ Labo", exact: true });
      await expect(slip).toHaveValue(orderCode);
      await expect(slip).toBeDisabled();
      await expect(dialog.getByRole("textbox", { name: "Tên khách hàng", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("textbox", { name: "Số lượng đặt", exact: true })).toBeDisabled();

      await dialog.getByRole("group", { name: "Răng 11" }).getByRole("button", { name: "Đạt" }).click();
      const faulty = dialog.getByRole("group", { name: "Răng 21" });
      await faulty.getByRole("button", { name: "Lỗi" }).click();
      await expect(faulty.getByRole("button", { name: "Lỗi" })).toHaveAttribute("aria-pressed", "true");
      await dialog.getByPlaceholder("Ghi chú lỗi").fill(note);

      await expect(dialog.getByRole("region", { name: /Kết luận/ })).toBeVisible();
      await expect(dialog.getByLabel("Mô tả gửi Labo")).toHaveValue(new RegExp(`Răng 21: ${note}`));
      await dialog.locator(".pd-labo-pictures input[type=file]").setInputFiles({
        name: "kiem-tra.png",
        mimeType: "image/png",
        buffer: PNG,
      });
      await typeDate(dialog.getByLabel("Hẹn Labo giao lại"), pickerStamp(5, 10));

      await dialog.getByRole("button", { name: "Trả hàng bị lỗi" }).click();
      await expect(page.getByText("Đã trả hàng cho Labo")).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(laboRow(page, orderCode)).toContainText("Trả hàng");

      const returned = await read(page, orderId);
      expect(returned.status).toBe(LaboStatus.Returned);
      expect(returned.rounds?.[0].toothResults.find((tooth) => tooth.toothNumber === 21)?.note).toBe(note);
      expect(returned.teeth?.find((tooth) => tooth.toothNumber === 11)?.passedAt).toBeTruthy();
    });

    await test.step("one tooth Đạt, another Lỗi: still locked and no Kích hoạt bảo hành (BA)", async () => {
      await openStageHistory(page, line);
      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock")).toHaveText("Khoá: phiếu Labo chưa QC đạt");
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
      await expect(dialog.getByText("Trả hàng lỗi")).toBeVisible();
      await expect(dialog.getByRole("group", { name: "Răng 11" })).toHaveCount(0);
      await expect(dialog.getByText("Đạt (lần trước)")).toBeVisible();

      await dialog.getByRole("group", { name: "Răng 21" }).getByRole("button", { name: "Đạt" }).click();
      await dialog.getByRole("button", { name: "Xác nhận Labo đạt" }).click();
      await expect(page.getByText("Đã xác nhận Labo đạt")).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(laboRow(page, orderCode)).toContainText("Hoàn thành");
      expect((await read(page, orderId)).status).toBe(LaboStatus.Completed);
    });

    await test.step("QC passed: the lock lifts and the latest công đoạn offers Kích hoạt bảo hành", async () => {
      await openStageHistory(page, line);
      const later = stageRow(page, stageB);
      await expect(later.locator(".pd-stage-labo-lock")).toHaveCount(0);
      await expect(later.getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
      await expect(stageRow(page, stageA).getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
      await expect(stageRow(page, stageA).locator(".pd-stage-labo-lock")).toHaveCount(0);
      await expect(stageRow(page, stageA).locator(".pd-stage-labo")).toContainText(`${orderCode} · Hoàn thành`);

      await later.getByRole("button", { name: /Kích hoạt bảo hành$/ }).click();
      await expectStep(dialog, "Bảo hành", "Hoàn thành");
    });

    await test.step("Bảo hành: one card for tooth 11, tooth 21 left for later", async () => {
      const box = dialog.getByRole("region", { name: "Kích hoạt bảo hành" });
      const tooth21 = box.locator(".pd-labo-warranty-pick").filter({ hasText: "Răng 21" });
      await expect(tooth21).toHaveAttribute("aria-pressed", "true");
      await tooth21.click();
      await expect(tooth21).toHaveAttribute("aria-pressed", "false");
      await expect(box.getByRole("article", { name: "Răng 21" })).toHaveCount(0);

      const card = box.getByRole("article", { name: "Răng 11" });
      await typeDate(card.getByLabel("Ngày bắt đầu bảo hành"), pickerStamp(0, 0).slice(0, 10));
      await card.locator(".pd-labo-warranty-duration").filter({ hasText: "6 tháng" }).click();
      await dialog.getByRole("button", { name: "Kích hoạt bảo hành (1 răng)" }).click();
      await expect(page.getByText("Đã kích hoạt bảo hành 1 răng")).toBeVisible();

      const warranted = await read(page, orderId);
      expect(warranted.status).toBe(LaboStatus.Warranty);
      const code11 = warranted.teeth?.find((tooth) => tooth.toothNumber === 11)?.warrantyCardCode ?? "";
      expect(code11).toMatch(/^BH-\d{4}-\w{4}-11$/);
      expect(warranted.teeth?.find((tooth) => tooth.toothNumber === 11)?.warrantyMonths).toBe(6);
      expect(warranted.teeth?.find((tooth) => tooth.toothNumber === 21)?.warrantyCardCode).toBeNull();

      // Reloaded straight onto tab 3: the cards come back from the server.
      await page.goto(
        `/patient/${line.patientId}?branchId=${line.branchId}&tab=labo&laboModal=order&laboRowId=${orderId}&laboStep=warranty`,
      );
      await expectStep(dialog, "Bảo hành", "Bảo hành");
      await expect(dialog.locator(".pd-labo-warranty-card--active")).toContainText(`Thẻ bảo hành · ${code11}`);
      await expect(dialog.locator(".pd-labo-warranty-card--inactive")).toContainText("Răng 21");
    });

    await test.step("the slip's Phiếu Labo column turns Bảo hành and Hoàn thành is offered", async () => {
      const planRow = await planLaboCell(page, line);
      const cell = planRow.locator(".pdt-labo");
      await expect(cell).toContainText("Bảo hành");
      await expect(cell.locator(".pdt-labo-code")).toHaveText(orderCode);

      const done = await statusMenuDone(page, planRow);
      await expect(done).not.toHaveAttribute("aria-disabled", "true");
      await expect(done).toHaveText("Hoàn thành");
      await page.keyboard.press("Escape");
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
