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
  PLANS,
  receive,
  sentOrder,
  serviceLine,
  type LaboLine,
  type SpecService,
} from "./fixtures/laboApi";

/**
 * Feature F-86, phase B in the browser: the slip's Bảo hành tab (P3110
 * REQ-B1..B7, mocks m348 / m366 / m360 / m371),
 * docs/wip/p3110-labo-warranty-plan.md.
 *
 * Real login, real backend, real PostgreSQL. The slip is seeded through the
 * same endpoints the app calls, from inside the logged-in page; the tab is
 * then driven only by clicks, and every activation is read back after a
 * reload. No route is intercepted.
 */

/** A service with a warranty period of its own: Danh mục "Thời gian bảo hành (ngày)" = 365. */
const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };

function complete(page: Page, line: LaboLine) {
  return call(page, `${PLANS}/${line.planId}/services/${line.lineId}/complete`, { method: "POST", branchId: line.branchId });
}

interface Slip {
  /** R36 + R37, finished, no card yet → Sẵn sàng kích hoạt. */
  ready: LaboLine;
  /** R46, finished, one 12-month card already → Đã kích hoạt. */
  activated: LaboLine;
  /** R15, untouched → Chưa đủ điều kiện (with the slip's own R18 Labo line). */
  open: LaboLine;
  cardCode: string;
}

async function seedSlip(page: Page): Promise<Slip> {
  const planId = await freshSlip(page, runId());
  const ready = await serviceLine(page, { planId, service: WARRANTY_SERVICE, teeth: [36, 37] });
  expect((await complete(page, ready)).status).toBe(200);
  const activated = await serviceLine(page, { planId, service: WARRANTY_SERVICE, teeth: [46] });
  expect((await complete(page, activated)).status).toBe(200);
  const card = await call<{ cards: { code: string }[] }>(
    page,
    `${PLANS}/${planId}/services/${activated.lineId}/warranty`,
    {
      method: "POST",
      branchId: activated.branchId,
      json: { cards: [{ toothNumber: 46, startDate: clinicToday(), months: 12 }] },
    },
  );
  expect(card.status, card.text).toBe(200);
  const open = await serviceLine(page, { planId, service: WARRANTY_SERVICE, teeth: [15] });
  const overview = await call<{ cards: { code: string }[] }>(page, `${PLANS}/${planId}/warranty-overview`, {
    branchId: ready.branchId,
  });
  expect(overview.body?.cards).toHaveLength(1);
  return { ready, activated, open, cardCode: overview.body!.cards[0].code };
}

const openTab = (page: Page, line: LaboLine) =>
  page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}&planTab=warranty`);

const card = (page: Page, titleId: string) => page.locator(`section[aria-labelledby="${titleId}"]`);
const rows = (section: Locator) => section.locator("tbody tr.ant-table-row");
const statusRow = (page: Page, teeth: string) =>
  rows(card(page, "pwt-status-title")).filter({ hasText: `${WARRANTY_SERVICE.name} - ${teeth}` });
const warrantyTab = (page: Page) => page.getByRole("tab", { name: /Bảo hành/ });

test.describe("Plan warranty tab (F-86 phase B, UI)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("tab count, filter chips and Hôm nay read the slip as seeded", async ({ page }) => {
    const slip = await seedSlip(page);
    await openTab(page, slip.ready);
    const status = card(page, "pwt-status-title");
    await expect(status).toBeVisible();

    // m348: two finished lines → count 2; only R36/R37 still waits → "1 chờ".
    const tab = warrantyTab(page);
    await expect(tab.locator(".pdt-tab-count")).toHaveText("2");
    await expect(tab.locator(".pdt-tab-pending")).toHaveText("1 chờ");
    await expect(page.locator(".pdt-header-aside")).toContainText(/Hôm nay: \d{2}\/\d{2}\/\d{4}/);

    // m366: the chips count each group and narrow the table to it.
    const chips = status.getByRole("group");
    await expect(chips.getByRole("button", { name: "Tất cả 4" })).toHaveAttribute("aria-pressed", "true");
    await expect(rows(status)).toHaveCount(4);
    await chips.getByRole("button", { name: "Sẵn sàng kích hoạt 1" }).click();
    await expect(rows(status)).toHaveCount(1);
    await expect(rows(status).first()).toContainText("R36, R37");
    await expect(rows(status).first()).toContainText("Chờ kích hoạt");
    await expect(rows(status).first().getByRole("button", { name: "Bảo hành dịch vụ" })).toBeVisible();
    await chips.getByRole("button", { name: "Đã kích hoạt 1" }).click();
    await expect(rows(status)).toHaveCount(1);
    await expect(rows(status).first()).toContainText("Đã kích hoạt · 1 thẻ");
    await chips.getByRole("button", { name: "Chưa đủ điều kiện 2" }).click();
    await expect(rows(status)).toHaveCount(2);
    await expect(statusRow(page, "R15")).toContainText("Chưa đủ điều kiện");
    await expect(statusRow(page, "R15").getByRole("button")).toHaveCount(0);
  });

  test("Bảo hành dịch vụ activates the picked teeth and survives a reload", async ({ page }) => {
    const slip = await seedSlip(page);
    await openTab(page, slip.ready);
    await statusRow(page, "R36, R37").getByRole("button", { name: "Bảo hành dịch vụ" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Bảo hành dịch vụ");
    await expect(dialog).toContainText(WARRANTY_SERVICE.name);
    await expect(dialog.getByRole("button", { name: "Răng 36" })).toHaveAttribute("aria-pressed", "true");
    // "Theo danh mục · 365 ngày" is the default period; today the default start.
    const tooth36 = dialog.getByRole("article", { name: "Răng 36" });
    await expect(tooth36.getByRole("button", { name: "Theo danh mục · 365 ngày" })).toBeVisible();
    await expect(tooth36).toContainText("Đủ thông tin");

    // Leave R37 for later: the button follows the count.
    await dialog.getByRole("button", { name: "Răng 37" }).click();
    await expect(dialog.getByRole("article", { name: "Răng 37" })).toHaveCount(0);
    const save = dialog.getByRole("button", { name: "Kích hoạt bảo hành (1 răng)" });
    await expect(save).toBeEnabled();
    const answer = page.waitForResponse(
      (res) => res.url().includes(`/services/${slip.ready.lineId}/warranty`) && res.request().method() === "POST",
    );
    await save.click();
    expect((await answer).status()).toBe(200);
    await expect(page.getByText("Đã kích hoạt 1 thẻ bảo hành")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.reload();
    const cards = card(page, "pwt-cards-title");
    await expect(rows(cards)).toHaveCount(2);
    await expect(rows(cards).filter({ hasText: "R36" })).toContainText("Còn hạn");
    // R37 still waits, so the line stays ready and the tab keeps "1 chờ".
    await expect(statusRow(page, "R36, R37")).toContainText("Chờ kích hoạt");
    await expect(warrantyTab(page).locator(".pdt-tab-pending")).toHaveText("1 chờ");

    // The second round takes R37 only — R36 is no longer offered.
    await statusRow(page, "R36, R37").getByRole("button", { name: "Bảo hành dịch vụ" }).click();
    await expect(dialog.getByRole("button", { name: "Răng 36" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "1 năm" }).click();
    await dialog.getByRole("button", { name: "Kích hoạt bảo hành (1 răng)" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(rows(card(page, "pwt-cards-title"))).toHaveCount(3);
    await expect(statusRow(page, "R36, R37")).toContainText("Đã kích hoạt · 2 thẻ");
    await expect(warrantyTab(page).locator(".pdt-tab-pending")).toHaveCount(0);
    await expect(warrantyTab(page).locator(".pdt-tab-count")).toHaveText("2");
    const history = card(page, "pwt-history-title");
    await expect(history.locator(".pwt-event").filter({ hasText: "Kích hoạt 1 thẻ" })).toHaveCount(3);
    await expect(history).toContainText("1 năm");
  });

  test("Xem thẻ narrows the cards to the line, Lịch sử ↓ the history to the card", async ({ page }) => {
    const slip = await seedSlip(page);
    await openTab(page, slip.ready);
    await statusRow(page, "R36, R37").getByRole("button", { name: "Bảo hành dịch vụ" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kích hoạt bảo hành (2 răng)" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const cards = card(page, "pwt-cards-title");
    await expect(rows(cards)).toHaveCount(3);
    await statusRow(page, "R46").getByRole("button", { name: "Xem thẻ ›" }).click();
    await expect(cards.locator(".pwt-filter-tag")).toHaveText(`${WARRANTY_SERVICE.name} - R46`);
    await expect(rows(cards)).toHaveCount(1);
    await expect(rows(cards).first()).toContainText(slip.cardCode);
    // Closing the tag brings every card back.
    await cards.locator(".pwt-filter-tag .ant-tag-close-icon").click();
    await expect(rows(cards)).toHaveCount(3);

    const history = card(page, "pwt-history-title");
    await expect(history.locator(".pwt-event")).toHaveCount(2);
    await rows(cards).filter({ hasText: slip.cardCode }).getByRole("button", { name: "Lịch sử ↓" }).click();
    await expect(history.locator(".pwt-filter-tag")).toHaveText(slip.cardCode);
    await expect(history.locator(".pwt-event")).toHaveCount(1);
    await expect(history.locator(".pwt-event").first()).toContainText(slip.cardCode);
    await expect(history.locator(".pwt-event").first()).toContainText("1 năm");
  });

  test("Xem chi tiết opens each card's warranty dialog, view only, on the card pressed (R-1120)", async ({ page }) => {
    const slip = await seedSlip(page);
    const id = runId();
    // A Labo line on the same slip: R11 + R21 passed, only R11 carded — R21 would still offer Kích hoạt.
    const laboLine = await serviceLine(page, { planId: slip.ready.planId, service: WARRANTY_SERVICE, teeth: [11, 21] });
    const catalog = await laboCatalog(page, laboLine.branchId, id);
    const order = await sentOrder(page, orderBody(catalog, laboLine, id, { treatmentServiceId: laboLine.lineId }));
    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await complete(page, laboLine)).status).toBe(200);
    const carded = await activateWarranty(page, order.id, [{ toothNumber: 11, startDate: clinicToday(), months: 12 }]);
    expect(carded.status, carded.text).toBe(200);
    const laboCode = carded.body.teeth?.find((tooth) => tooth.toothNumber === 11)?.warrantyCardCode ?? "";
    expect(laboCode).not.toBe("");

    await openTab(page, slip.ready);
    const cards = card(page, "pwt-cards-title");
    await expect(rows(cards)).toHaveCount(2);
    await expect(cards.getByRole("columnheader", { name: "Thao tác" })).toBeVisible();
    const url = page.url();

    await test.step("a Labo card reopens its order on Bảo hành, nothing to press but In Phiếu Labo", async () => {
      const row = rows(cards).filter({ hasText: laboCode });
      await expect(row.getByRole("button", { name: "Lịch sử ↓" })).toBeVisible();
      await row.getByRole("button", { name: "Xem chi tiết" }).click();
      const dialog = page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Bảo hành");
      await expect(dialog.getByRole("article", { name: `Thẻ bảo hành · ${laboCode}` })).toHaveAttribute("aria-current", "true");
      await expect(dialog.locator(".pd-labo-warranty-card--inactive")).toContainText("Răng 21");
      await expect(dialog.locator(".pd-labo-warranty-row--focus")).toContainText(laboCode);
      // R21 waits for its card, yet neither the Kích hoạt view nor its button is offered.
      await expect(dialog.getByRole("tab", { name: "Kích hoạt bảo hành" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /Kích hoạt/ })).toHaveCount(0);
      await expect(dialog.locator(".bd-warranty-photos input[type=file]")).toHaveCount(0);

      await dialog.getByRole("tab", { name: /Nhận hàng & kiểm tra/ }).click();
      await expect(dialog.getByRole("button", { name: "Đạt" })).toHaveCount(0);
      await expect(dialog.locator(".pd-labo-step-footer button")).toHaveCount(1);

      await dialog.getByRole("tab", { name: /Đặt hàng/ }).click();
      await expect(dialog.getByRole("button", { name: "In Phiếu Labo" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Hủy phiếu|Lưu nháp|Tạo phiếu/ })).toHaveCount(0);
      // The viewer stays off the URL: a reload never lands back on it.
      expect(page.url()).toBe(url);
      await dialog.getByRole("button", { name: "Huỷ" }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step("a dental card shows its line's cards on the same frame, nothing to change", async () => {
      await rows(cards).filter({ hasText: slip.cardCode }).getByRole("button", { name: "Xem chi tiết" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Bảo hành dịch vụ");
      await expect(dialog.locator(".pd-labo-step-hint")).toContainText(WARRANTY_SERVICE.name);
      const face = dialog.getByRole("article", { name: `Thẻ bảo hành · ${slip.cardCode}` });
      await expect(face).toHaveAttribute("aria-current", "true");
      await expect(face).toContainText("Răng 46");
      await expect(face).toContainText("1 năm");
      await expect(dialog.getByRole("article")).toHaveCount(1);
      await expect(dialog.locator(".pd-labo-warranty-row--focus")).toContainText(slip.cardCode);
      await expect(dialog.locator(".pd-labo-warranty-row--focus")).toContainText("Còn hiệu lực");
      await expect(dialog.locator("input, textarea")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /Kích hoạt|Lưu/ })).toHaveCount(0);
      await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Đóng" }).click();
      await expect(dialog).toBeHidden();
    });

    await page.reload();
    await expect(rows(card(page, "pwt-cards-title"))).toHaveCount(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
