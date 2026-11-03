import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  activateWarranty,
  call,
  clinicToday,
  freshSlip,
  laboCatalog,
  orderBody,
  passAll,
  receive,
  sentOrder,
  serviceLine,
  STAGES,
  type LaboLine,
  type LineOptions,
  type SpecService,
} from "./fixtures/laboApi";
import { openStageDialog, reopenStageDialog } from "./fixtures/stageDialog";
import { activateDental, completeLine, WarrantyKind } from "./fixtures/warrantyApi";

/**
 * Feature F-86, phase F through the screen: the TIẾP TỤC BẢO HÀNH form picks
 * "Thẻ bảo hành áp dụng" (P3110 REQ-F3), a Labo card its order (REQ-F4), the
 * teeth follow the card, and the slip's service table shows the line's cards
 * (REQ-A10). Real login, real API, real database — nothing is intercepted.
 */

const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };

interface StageRead {
  id: string;
  isGuarantee: boolean;
  warrantyKind: number | null;
  warrantyLaboOrderId: string | null;
  teeth: { toothCode: number; selected: boolean }[];
}

async function freshLine(page: Page, options: Omit<LineOptions, "planId">): Promise<LaboLine> {
  return serviceLine(page, { ...options, planId: await freshSlip(page, runId()) });
}

const chips = (form: Locator) => form.locator(".pd-stage-teeth > div > button:not(.pd-stage-chartbtn)");

/** `22*` picked, `22!` listed but not offered by the card. */
async function chipStates(form: Locator): Promise<string[]> {
  const buttons = await chips(form).all();
  return Promise.all(
    buttons.map(async (button) => {
      const text = (await button.innerText()).trim();
      if (await button.isDisabled()) return `${text}!`;
      return (await button.getAttribute("aria-pressed")) === "true" ? `${text}*` : text;
    }),
  );
}

async function pickDoctor(page: Page, form: Locator): Promise<void> {
  const doctor = form.locator(".ant-select").first();
  if ((await doctor.locator(".ant-select-content-has-value").count()) > 0) return;
  await doctor.click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
}

/** The line's card under TIẾP TỤC BẢO HÀNH, opened; returns its form. */
async function openWarrantyForm(page: Page, line: LaboLine): Promise<{ panel: Locator; form: Locator }> {
  const panel = await openStageDialog(page, line);
  await panel.getByRole("tab", { name: /TIẾP TỤC BẢO HÀNH/ }).click();
  await panel.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
  const form = panel.locator(`.pd-stage-form[data-item-id="continueWarranty:${line.lineId}"]`);
  await expect(form).toBeVisible();
  return { panel, form };
}

async function saveWarranty(page: Page, panel: Locator): Promise<StageRead> {
  const created = page.waitForResponse(
    (res) => res.request().method() === "POST" && res.url().endsWith("/api/v1/app/treatment-stages"),
  );
  await panel.getByRole("button", { name: "Tiếp tục bảo hành" }).click();
  const res = await created;
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as StageRead;
}

async function readStage(page: Page, line: LaboLine, id: string): Promise<StageRead> {
  const res = await call<StageRead>(page, `${STAGES}/${id}`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as StageRead;
}

const selectedTeeth = (stage: StageRead) =>
  stage.teeth.filter((tooth) => tooth.selected).map((tooth) => tooth.toothCode).sort((a, b) => a - b);

test.describe("TIẾP TỤC BẢO HÀNH form (P3110 phase F)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a line finished by hand opens a warranty under Nha khoa on the teeth its cards cover", async ({ page }) => {
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [36, 37, 38] });
    expect((await completeLine(page, line)).status).toBe(200);
    const today = clinicToday();
    const activated = await activateDental(page, line, [36, 37].map((toothNumber) => ({ toothNumber, startDate: today })));
    expect(activated.status, activated.text).toBe(200);

    const { panel, form } = await openWarrantyForm(page, line);
    const dental = form.locator(".pd-wcard--dental");
    const labo = form.locator(".pd-wcard--labo");
    await expect(dental).toBeEnabled();
    // m415 names the left card "Dịch vụ" (was "Nha khoa", G21 withdrawn).
    await expect(dental.locator(".pd-wcard-head")).toHaveText("Dịch vụ");
    // No Labo order on the line: the card stays on show, faded and inert (REQ-F3).
    await expect(labo).toBeDisabled();
    await expect(labo).toContainText("Không có thẻ còn hạn");

    await form.locator("textarea").first().fill(`e2e bảo hành nha khoa ${runId()}`);
    await pickDoctor(page, form);

    // Saving before a card is picked is stopped on the screen.
    await panel.getByRole("button", { name: "Tiếp tục bảo hành" }).click();
    await expect(form.getByText("Vui lòng chọn thẻ bảo hành áp dụng")).toBeVisible();

    await dental.click();
    await expect(dental).toHaveAttribute("aria-pressed", "true");
    await expect(form.getByText("Vui lòng chọn thẻ bảo hành áp dụng")).toHaveCount(0);
    await expect(form.locator(".pd-wlabo-select")).toHaveCount(0);
    // 38 holds no card: listed, not offered.
    expect(await chipStates(form)).toEqual(["36*", "37*", "38!"]);
    await chips(form).filter({ hasText: "37" }).click();
    expect(await chipStates(form)).toEqual(["36*", "37", "38!"]);

    const made = await saveWarranty(page, panel);
    expect(made).toMatchObject({ isGuarantee: true, warrantyKind: WarrantyKind.Dental, warrantyLaboOrderId: null });

    // Read back with a separate request, then after a reload.
    expect(selectedTeeth(await readStage(page, line, made.id))).toEqual([36]);
    await page.reload();
    const again = await reopenStageDialog(page, line);
    await again.getByRole("tab", { name: /TIẾP TỤC BẢO HÀNH/ }).click();
    const card = again.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`);
    await expect(card).toHaveAttribute("data-stage-id", made.id);

    // The slip's service table names the line's activated card (REQ-A10).
    await expect(page.locator(".pdt-wchip--dental")).toHaveText("Nha khoa · Đã kích hoạt");
    await expect(page.locator(".pdt-wchip--labo")).toHaveCount(0);
  });

  test("a Labo card asks for its order and offers only that order's activated teeth", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21, 22] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, line, id, { teeth: [11, 21], treatmentServiceId: line.lineId }));
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await completeLine(page, line)).status).toBe(200);
    const today = clinicToday();
    const activated = await activateWarranty(page, order.id, [
      { toothNumber: 11, startDate: today, months: 12 },
      { toothNumber: 21, startDate: today, months: 12 },
    ]);
    expect(activated.status, activated.text).toBe(200);

    const { panel, form } = await openWarrantyForm(page, line);
    // No dental card was activated on this line.
    await expect(form.locator(".pd-wcard--dental")).toBeDisabled();
    const labo = form.locator(".pd-wcard--labo");
    // The detail wraps inside its card instead of running into Nội dung điều trị.
    const card = await labo.boundingBox();
    const detail = await labo.locator(".pd-wcard-detail").boundingBox();
    expect(card && detail && detail.x + detail.width <= card.x + card.width).toBe(true);
    await labo.click();
    await expect(labo).toHaveAttribute("aria-pressed", "true");
    await expect(form.locator(".pd-wlabo-select")).toBeVisible();
    // The picked card clicked again lets go of it, its order select and its teeth.
    await labo.click();
    await expect(labo).toHaveAttribute("aria-pressed", "false");
    await expect(form.locator(".pd-wlabo-select")).toHaveCount(0);
    await labo.click();
    await expect(labo).toHaveAttribute("aria-pressed", "true");

    await form.locator("textarea").first().fill(`e2e bảo hành labo ${id}`);
    await pickDoctor(page, form);
    await panel.getByRole("button", { name: "Tiếp tục bảo hành" }).click();
    await expect(form.getByText("Vui lòng chọn phiếu Labo bảo hành")).toBeVisible();

    const select = form.locator(".pd-wlabo-select");
    await select.click();
    const option = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
    await expect(option).toHaveCount(1);
    await expect(option).toContainText("R11, R21");
    await option.click();
    await expect(form.getByText("Vui lòng chọn phiếu Labo bảo hành")).toHaveCount(0);
    expect(await chipStates(form)).toEqual(["11*", "21*", "22!"]);

    const made = await saveWarranty(page, panel);
    expect(made).toMatchObject({ isGuarantee: true, warrantyKind: WarrantyKind.Labo, warrantyLaboOrderId: order.id });
    expect(selectedTeeth(await readStage(page, line, made.id))).toEqual([11, 21]);

    // After a reload the open chain keeps its card and order, both locked.
    await page.reload();
    const again = await reopenStageDialog(page, line);
    await again.getByRole("tab", { name: /TIẾP TỤC BẢO HÀNH/ }).click();
    await again.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const kept = again.locator(`.pd-stage-form[data-item-id="continueWarranty:${line.lineId}"]`);
    await expect(kept.locator(".pd-wcard--labo")).toHaveAttribute("aria-pressed", "true");
    await expect(kept.locator(".pd-wcard--labo")).toBeDisabled();
    await expect(kept.locator(".pd-wlabo-select")).toHaveClass(/ant-select-disabled/);

    await expect(page.locator(".pdt-wchip--labo")).toHaveText("Labo · Đã kích hoạt");
  });
});
