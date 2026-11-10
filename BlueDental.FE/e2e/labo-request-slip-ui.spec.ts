import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { BRANCH_ONE, call, LABO_ORDERS, LaboStatus, type Paged } from "./fixtures/laboApi";
import {
  CaseType,
  fullSlip,
  Layout,
  newPatient,
  post,
  readBack,
  save,
  slipCatalog,
  slipNo,
  type SlipOrderView,
} from "./fixtures/laboSlipApi";

/**
 * Feature F-91 through the screens: the Phiếu yêu cầu that replaced tab Đặt
 * hàng, driven from the patient's Labo tab in a real browser — real login,
 * real API, real database, no interception. Every order the browser makes is
 * read back with its own GET.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** DD/MM/YYYY, `days` from today — what the slip's DatePickers show and take. */
function day(days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
}

async function typeDate(field: Locator, value: string) {
  await field.click();
  await field.fill(value);
  await field.press("Enter");
}

async function openLaboTab(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?branchId=${BRANCH_ONE}&tab=labo`);
  await assertRealApiTraffic(page, LABO_ORDERS);
}

function slipDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.locator(".rs-slip") });
}

function patientRow(page: Page, text: string) {
  return page.locator("tbody tr.ant-table-row").filter({ hasText: text }).first();
}

async function ordersOf(page: Page, patientId: string): Promise<SlipOrderView[]> {
  const res = await call<Paged<SlipOrderView>>(
    page,
    `${LABO_ORDERS}?BranchId=${BRANCH_ONE}&PatientId=${patientId}&MaxResultCount=50`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status, res.text).toBe(200);
  return res.body.items ?? [];
}

/** Opens a fresh Phiếu yêu cầu from the patient's Labo tab. */
async function startSlip(page: Page, patientId: string) {
  await openLaboTab(page, patientId);
  await page.getByRole("button", { name: "Tạo phiếu Labo" }).first().click();
  const dialog = slipDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Chỉ định: the purple tooth button opens Chọn răng; each listed tooth is toggled, then confirmed. */
async function pickTeeth(page: Page, dialog: Locator, teeth: number[], deciduous = false) {
  await dialog.locator(".rs-teeth").getByRole("button", { name: "Chọn răng", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(picker).toBeVisible();
  if (deciduous) await picker.getByRole("radio", { name: "Răng sữa" }).check();
  for (const fdi of teeth)
    await picker.getByRole("button", { name: `Răng ${fdi}`, exact: true }).click();
  await picker.getByRole("button", { name: "Chọn răng", exact: true }).click();
  await expect(picker).toBeHidden();
}

/** Everything «Tạo phiếu Labo» waits on, the doctor picked from the real list. */
async function fillRequired(page: Page, dialog: Locator, no: string, implantName: string) {
  await dialog.getByLabel("Màu thân gần").fill("a2");
  await dialog.getByLabel("Mã số", { exact: true }).fill(no);
  await dialog.getByLabel("Bác sĩ chỉ định").click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await typeDate(dialog.getByLabel("Ngày nhận dự kiến"), day(5));
  await pickTeeth(page, dialog, [16, 17]);
  await dialog.getByLabel(`${implantName} – Trên implant`, { exact: true }).check();
}

/** Pages in a PDF, and its first page's size in points (A4 = 595 × 842). */
function pdfShape(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const box = text.match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return {
    pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    size: box ? [Math.round(Number(box[1])), Math.round(Number(box[2]))] : [],
  };
}

test.describe("Labo Phiếu yêu cầu UI (F-91)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Tạo phiếu Labo from the patient's tab sends a full slip, lands on the patient's Labo list and prints the new sheet", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "ui");
    const no = slipNo("ui");
    const dialog = await startSlip(page, patientId);

    await test.step("what is known is already filled", async () => {
      await expect(dialog.getByLabel("Ngày gửi")).toHaveValue(day(0));
      await expect(dialog.getByRole("radio", { name: "Ca mới" })).toBeChecked();
      await expect(dialog.getByRole("textbox", { name: "Bệnh nhân" })).toContainText("Phiếu YC ui");
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
    });

    await test.step("the sheet scrolls with the wheel under a pinned footer", async () => {
      // Playwright scrolls targets into view on its own, so only a real wheel
      // shows whether a person can reach the bottom of the sheet.
      const scroller = dialog.locator(".rs-slip-scroll");
      // A flex column squeezes clipped sections to a hairline: every one must keep its height.
      for (const part of [".rs-info", ".rs-note"]) {
        const box = await dialog.locator(part).first().boundingBox();
        expect(box?.height ?? 0, part).toBeGreaterThan(100);
      }
      await scroller.hover();
      await page.mouse.wheel(0, await scroller.evaluate((el) => el.scrollHeight));
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeInViewport();
      await expect(dialog.getByLabel("Yêu cầu", { exact: true })).toBeInViewport();
    });

    await test.step("Chỉ định picks teeth in the system's Chọn răng dialog, Răng sữa too", async () => {
      const row = dialog.locator(".rs-teeth");
      await pickTeeth(page, dialog, [55], true);
      await expect(row).toContainText("R55");
      await expect(row).toContainText("Số lượng: 1");
      await pickTeeth(page, dialog, [55], true);
      await expect(row).not.toContainText("R55");
    });

    await test.step("the sheet folds to the screen without a sideways scroll", async () => {
      const scroller = dialog.locator(".rs-slip-scroll");
      const size = page.viewportSize();
      for (const width of [1100, 800, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await expect
          .poll(() => scroller.evaluate((el) => el.scrollWidth - el.clientWidth), {
            message: `${width}px`,
          })
          .toBeLessThanOrEqual(1);
      }
      if (size) await page.setViewportSize(size);
    });

    await test.step("fill the slip", async () => {
      await fillRequired(page, dialog, no, c.implantMaterial.name);
      await dialog.getByLabel("Màu thân gần").fill("a2");
      await expect(dialog.getByLabel("Màu thân gần")).toHaveValue("A2");
      await dialog.getByRole("checkbox", { name: c.finishLines[0].name }).check();
      await dialog.getByLabel("Yêu cầu", { exact: true }).fill("Làm sát nướu");
      await expect(dialog.getByRole("status")).toHaveText("Phiếu đã đủ thông tin.");
    });

    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    // Back on the patient's own Labo tab, not /labo (owner, 2026-11-10).
    await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=labo`));
    await expect(slipDialog(page)).toBeHidden();
    const row = page.locator(".pd-pane tbody tr.ant-table-row").filter({ hasText: no }).first();
    await expect(row).toContainText(`${c.implantMaterial.name} (trên implant)`);
    await expect(row).toContainText("Đã gửi");

    await test.step("stored once per tooth, no plan, no supplier", async () => {
      const [made] = await ordersOf(page, patientId);
      const order = await readBack(page, made.id);
      expect(order.layout).toBe(Layout.RequestSlip);
      expect(order.labSlipNo).toBe(no);
      expect(order.caseType).toBe(CaseType.New);
      expect(order.status).toBe(LaboStatus.Sent);
      expect(order.treatmentServiceId).toBeNull();
      expect(order.treatmentStageId).toBeNull();
      expect(order.supplierName ?? null).toBeNull();
      expect(order.notes).toBe("Làm sát nướu");
      expect(order.teeth.map((tooth) => tooth.toothNumber).sort()).toEqual([16, 17]);
      for (const tooth of order.teeth) {
        expect(tooth.restorations.map((r) => [r.materialId, r.onImplant])).toEqual([
          [c.implantMaterial.id, true],
        ]);
        expect(tooth.shadeZones?.bodyMesial).toBe("A2");
        expect(tooth.finishLineIds).toEqual([c.finishLines[0].id]);
      }
    });

    await test.step("Xem shows the slip's facts and the new print sheet", async () => {
      await page.goto(`/labo?branchId=${BRANCH_ONE}`);
      const again = page
        .locator(".bd-labo-screen tbody tr.ant-table-row")
        .filter({ hasText: no })
        .first();
      await again.getByRole("button", { name: "Xem", exact: true }).click();
      const detail = page.getByRole("dialog").filter({ hasText: no });
      await expect(detail).toContainText(`${c.implantMaterial.name} (trên implant)`);
      await expect(detail.getByRole("button", { name: "In Phiếu Labo" })).toBeVisible();

      const sheet = page.locator(".pd-slip-print");
      await expect(sheet).toContainText("PHIẾU YÊU CẦU LABO");
      await expect(sheet).toContainText(`Mã số: ${no}`);
      await expect(sheet).toContainText(c.finishLines[0].name);
      expect((await sheet.locator(".is-picked").allTextContents()).sort()).toEqual(["16", "17"]);
    });

    await test.step("In Phiếu Labo prints one A4 page whatever paper the printer offers", async () => {
      // A PDF printer's default paper is small: the sheet used to reflow onto
      // three pages there. Only the browser's own print dialog is skipped.
      await page.evaluate(() => {
        window.print = () => undefined;
      });
      const detail = page.getByRole("dialog").filter({ hasText: no });
      await detail.getByRole("button", { name: "In Phiếu Labo" }).click();
      const pdf = await page.pdf({ width: "105mm", height: "148mm", preferCSSPageSize: true });
      expect(pdfShape(pdf)).toEqual({ pages: 1, size: [595, 842] });
    });
  });

  test("a Mã số already on another order of the branch is refused and nothing is made", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const no = slipNo("dup");
    const first = await save(page, fullSlip(c, await newPatient(page, "dup-a"), no));
    expect(first.status, first.text).toBe(200);

    const patientId = await newPatient(page, "dup-b");
    const dialog = await startSlip(page, patientId);
    await fillRequired(page, dialog, no, c.implantMaterial.name);
    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();

    await expect(
      page.getByText(`Mã số ${no} đã có trên phiếu Labo khác của chi nhánh.`),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await ordersOf(page, patientId)).toHaveLength(0);
  });

  test("a draft without Mã số reopens refilled; a sent slip opens locked with Hủy phiếu and In phiếu", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "lock");
    const draft = await save(page, {
      patientId,
      dentistId: c.dentistId,
      teeth: [21],
      zones: { incisalDistal: "B1" },
      restorations: [{ materialId: c.plainMaterial.id, onImplant: false }],
      submit: false,
    });
    expect(draft.status, draft.text).toBe(200);
    const sentNo = slipNo("lock");
    const sent = await save(page, fullSlip(c, patientId, sentNo));
    expect(sent.status, sent.text).toBe(200);

    await openLaboTab(page, patientId);

    await test.step("the draft comes back as it was left", async () => {
      await patientRow(page, draft.body.orderCode!)
        .getByRole("button", { name: "Xem chi tiết" })
        .click();
      const dialog = slipDialog(page);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toHaveValue("");
      await expect(dialog.locator(".rs-teeth .pd-labo-toothchip")).toHaveText(["R21"]);
      await expect(dialog.getByLabel("Màu rìa cắn xa")).toHaveValue("B1");
      await expect(
        dialog.getByLabel(`${c.plainMaterial.name} – ${c.groupName}`, { exact: true }),
      ).toBeChecked();
      await expect(dialog.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Huỷ", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step("the sent slip is the same sheet, shut", async () => {
      // A sent order opens on the step it waits on; Đặt hàng is one tab back.
      await patientRow(page, sentNo).getByRole("button", { name: "Xem chi tiết" }).click();
      await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
      const dialog = slipDialog(page);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toHaveValue(sentNo);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toBeDisabled();
      await expect(
        dialog.locator(".rs-teeth").getByRole("button", { name: "Chọn răng", exact: true }),
      ).toHaveCount(0);
      await expect(dialog.locator(".rs-teeth")).toContainText("R16");
      await expect(dialog.getByRole("button", { name: "Hủy phiếu" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "In Phiếu Labo" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Lưu nháp" })).toHaveCount(0);
    });
  });

  test("Có lựa chọn Trên implant is saved from the material dialog", async ({ page }) => {
    const c = await slipCatalog(page);
    const group = await post<{ id: string }>(page, "/api/v1/app/taxonomies", {
      group: "labo_material",
      name: `${c.groupName} UI`,
      clinicBranchId: BRANCH_ONE,
    });
    const material = await post(page, "/api/v1/app/labo-materials", {
      name: `${c.plainMaterial.name} UI`,
      taxonomyId: group.id,
      clinicBranchId: BRANCH_ONE,
    });

    await page.goto("/labo/service-material");
    await assertRealApiTraffic(page, "/labo-materials");
    await page.getByRole("textbox", { name: "Tìm kiếm vật liệu" }).fill(material.name);
    await page.getByRole("button", { name: `Chỉnh sửa ${material.name}`, exact: true }).click();

    const dialog = page.getByRole("dialog");
    const allow = dialog.getByRole("checkbox", { name: "Có lựa chọn Trên implant" });
    await expect(allow).not.toBeChecked();
    await allow.check();
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const res = await call<Paged<{ id: string; allowOnImplant: boolean }>>(
      page,
      `/api/v1/app/labo-materials?ClinicBranchId=${BRANCH_ONE}&TaxonomyId=${group.id}&MaxResultCount=50`,
      { branchId: BRANCH_ONE },
    );
    expect(res.status, res.text).toBe(200);
    expect(res.body.items?.find((m) => m.id === material.id)?.allowOnImplant).toBe(true);
  });
});
