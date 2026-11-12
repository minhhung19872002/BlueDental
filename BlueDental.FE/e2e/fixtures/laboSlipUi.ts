import { expect, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";
import { BRANCH_ONE, call, LABO_ORDERS, LaboStatus, type Paged } from "./laboApi";
import type { SlipOrderView } from "./laboSlipApi";

/**
 * Driving the Phiếu yêu cầu from the patient's Labo tab in a real browser
 * (F-91, reused by F-93): opening the slip, picking teeth, filling what Tạo
 * phiếu Labo waits on, and reading the patient's orders back over the API.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** DD/MM/YYYY, `days` from today — what the slip's DatePickers show and take. */
export function day(days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
}

export async function typeDate(field: Locator, value: string) {
  await field.click();
  await field.fill(value);
  await field.press("Enter");
}

export async function openLaboTab(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?branchId=${BRANCH_ONE}&tab=labo`);
  await assertRealApiTraffic(page, LABO_ORDERS);
}

export function slipDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.locator(".rs-slip") });
}

export function patientRow(page: Page, text: string) {
  return page.locator("tbody tr.ant-table-row").filter({ hasText: text }).first();
}

export async function ordersOf(page: Page, patientId: string): Promise<SlipOrderView[]> {
  const res = await call<Paged<SlipOrderView>>(
    page,
    `${LABO_ORDERS}?BranchId=${BRANCH_ONE}&PatientId=${patientId}&MaxResultCount=50`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status, res.text).toBe(200);
  return res.body.items ?? [];
}

/** The patient's order under this Mã số, once the save has landed. */
export async function sentOrder(page: Page, patientId: string, no: string): Promise<SlipOrderView> {
  let found: SlipOrderView | undefined;
  await expect
    .poll(async () => {
      found = (await ordersOf(page, patientId)).find((order) => order.labSlipNo === no);
      return found?.status;
    })
    .toBe(LaboStatus.Sent);
  if (!found) throw new Error(`no order ${no}`);
  return found;
}

/** Opens a fresh Phiếu yêu cầu from the patient's Labo tab. */
export async function startSlip(page: Page, patientId: string) {
  await openLaboTab(page, patientId);
  await page.getByRole("button", { name: "Tạo phiếu Labo" }).first().click();
  const dialog = slipDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Chỉ định: the purple tooth button opens Chọn răng; each listed tooth is toggled, then confirmed. */
export async function pickTeeth(page: Page, dialog: Locator, teeth: number[], deciduous = false) {
  await dialog.locator(".rs-teeth").getByRole("button", { name: "Chọn răng", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(picker).toBeVisible();
  if (deciduous) await picker.getByRole("radio", { name: "Răng sữa" }).check();
  for (const fdi of teeth)
    await picker.getByRole("button", { name: `Răng ${fdi}`, exact: true }).click();
  await picker.getByRole("button", { name: "Chọn răng", exact: true }).click();
  await expect(picker).toBeHidden();
}

/** Loại phục hình (R-1216): the Dịch vụ row, then the Vật liệu row, each a strip of chips. */
export function restorationRows(dialog: Locator) {
  const rows = dialog.locator(".rs-restoration .pd-labo-choice");
  return {
    services: rows.nth(0).locator(".pd-labo-choice-chip"),
    material: rows.nth(1),
    materials: rows.nth(1).locator(".pd-labo-choice-chip"),
  };
}

/**
 * Picks the material's group as the Dịch vụ, then the material — its chip
 * when the row shows it, else through «Xem thêm vật liệu», since a branch
 * that ran these specs before holds many materials per group.
 */
export async function pickRestoration(page: Page, dialog: Locator, material: { name: string; groupName: string }) {
  const rows = restorationRows(dialog);
  await rows.services.filter({ hasText: material.groupName }).click();
  const chip = rows.materials.filter({ hasText: material.name });
  if ((await chip.count()) > 0) {
    await chip.click();
  } else {
    await rows.material.getByRole("button", { name: "Xem thêm vật liệu" }).click();
    const popup = page.locator(".pd-labo-pick").filter({ hasText: "Chọn vật liệu" });
    await popup.getByRole("textbox").fill(material.name);
    await popup.getByRole("radio").filter({ hasText: material.name }).click();
    await popup.getByRole("button", { name: "Chọn vật liệu" }).click();
    await expect(popup).toBeHidden();
  }
  await expect(rows.materials.filter({ hasText: material.name })).toHaveAttribute("aria-pressed", "true");
}

/** An option of one of the slip's dropdowns (Kiểu nhịp, Khớp cắn), typed into its search. */
export async function chooseOption(page: Page, dialog: Locator, label: string, option: string) {
  const select = dialog.getByLabel(label, { exact: true });
  await select.click();
  await select.fill(option);
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: option }).click();
}

/** Everything «Tạo phiếu Labo» waits on, the doctor picked from the real list. */
export async function fillRequired(page: Page, dialog: Locator, no: string, material: { name: string; groupName: string }) {
  await dialog.getByLabel("Màu thân gần").fill("a2");
  await dialog.getByLabel("Mã số", { exact: true }).fill(no);
  await dialog.getByLabel("Bác sĩ chỉ định").click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await typeDate(dialog.getByLabel("Ngày nhận dự kiến"), day(5));
  await pickTeeth(page, dialog, [16, 17]);
  await pickRestoration(page, dialog, material);
}
