import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";
import { BRANCH_ONE } from "./fixtures/catalogApi";
import { addPlanLine, findLaboPatient } from "./fixtures/laboSeed";
import { call, confirmOnRow, openNewSlip, PAYMENTS_API, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * F-63 Thẻ trả trước (function list cụm 3). BlueDental-local — see
 * docs/clone/pages/prepaid-card.md.
 *
 * Real stack only: real login, the real API, real PostgreSQL; nothing is
 * intercepted. Every run makes its own card types and cards.
 */

const CARDS = "/api/v1/app/prepaid-cards";
const PAY_BY_CARD = 6;
const PERCENT = 1;

interface CardType {
  id: string;
  name: string;
  soldCount: number;
}

interface CardTx {
  type: number;
  value: number;
  paidAmount: number;
  balanceAfter: number;
  patientPaymentCode: string | null;
}

interface Card {
  id: string;
  code: string;
  balance: number;
  totalLoaded: number;
  usedCount: number;
  commissionAmount: number;
  transactions: CardTx[];
}

const errorCode = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code;

async function currentUserId(page: Page): Promise<string> {
  const config = await call(page, "/api/abp/application-configuration");
  return (config.body.currentUser as { id: string }).id;
}

async function createType(page: Page, name: string, scope: { serviceIds?: string[]; serviceGroupIds?: string[] } = {}) {
  const res = await call(page, `${CARDS}/types`, {
    method: "POST",
    json: {
      clinicBranchId: BRANCH_ONE,
      name,
      salePrice: 900_000,
      usageValue: 1_000_000,
      maxUses: 2,
      commissionType: PERCENT,
      commissionValue: 10,
      allowFamily: true,
      serviceIds: scope.serviceIds ?? [],
      serviceGroupIds: scope.serviceGroupIds ?? [],
      isOnSale: true,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as unknown as CardType;
}

async function sell(page: Page, cardTypeId: string, ownerPatientId: string, sellerStaffId: string) {
  const res = await call(page, CARDS, {
    method: "POST",
    json: { cardTypeId, clinicBranchId: BRANCH_ONE, ownerPatientId, memberPatientIds: [], sellerStaffId, method: 1 },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as unknown as Card;
}

async function readCard(page: Page, id: string) {
  const res = await call(page, `${CARDS}/${id}`);
  expect(res.status).toBe(200);
  return res.body as unknown as Card;
}

test("API: a card is sold, pays a receipt in its scope, gets the value back, tops up and stays in its branch", async ({
  page,
  browser,
}) => {
  await login(page);
  const staffId = await currentUserId(page);
  const line = await addPlanLine(page);
  const plan = await call(page, `/api/v1/app/patient-treatments/${line.planId}`);
  const services = plan.body.services as { id: string; serviceId: string; outstandingAmount: number }[];
  const target = services.find((s) => s.id === line.lineId)!;
  const amount = Math.min(target.outstandingAmount, 50_000);
  expect(amount).toBeGreaterThan(0);

  // Khởi tạo thẻ, then Bán thẻ: loaded with the usage value, commission fixed at 10 % of the price.
  const type = await createType(page, `E2E Thẻ ${runId()}`, { serviceIds: [target.serviceId] });
  const card = await sell(page, type.id, line.patientId, staffId);
  expect(card.code).toMatch(/^TT\d{2}-\d{4}$/);
  expect(card.balance).toBe(1_000_000);
  expect(card.commissionAmount).toBe(90_000);
  expect(card.transactions).toHaveLength(1);
  expect(card.transactions[0].paidAmount).toBe(900_000);

  const usable = await call(page, `${CARDS}/usable?patientId=${line.patientId}`);
  expect((usable.body.items as Card[]).map((c) => c.id)).toContain(card.id);

  const pay = (cardId: string, extra: Record<string, unknown> = {}) =>
    call(page, PAYMENTS_API, {
      method: "POST",
      json: {
        patientId: line.patientId,
        clinicBranchId: line.branchId,
        treatmentPlanId: line.planId,
        treatmentServiceIds: [line.lineId],
        splitMode: 1,
        items: [],
        kind: 1,
        method: PAY_BY_CARD,
        amount,
        staffId,
        prepaidCardId: cardId,
        ...extra,
      },
    });

  // Paid from the card: the balance drops by the receipt and one use is taken.
  const paid = await pay(card.id);
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const receipt = paid.body as unknown as Receipt & { prepaidCardCode: string };
  expect(receipt.method).toBe(PAY_BY_CARD);
  expect(receipt.prepaidCardCode).toBe(card.code);

  let stored = await readCard(page, card.id);
  expect(stored.balance).toBe(1_000_000 - amount);
  expect(stored.usedCount).toBe(1);
  expect(stored.transactions[0]).toMatchObject({ type: 3, value: amount, patientPaymentCode: receipt.code });

  // No card named → refused by the receipt itself.
  const noCard = await pay(card.id, { prepaidCardId: null });
  expect(errorCode(noCard.body)).toBe("BlueDental:PrepaidCard:0013");

  // A card whose scope does not cover the service is refused.
  const narrow = await createType(page, `E2E Thẻ hẹp ${runId()}`, { serviceGroupIds: [crypto.randomUUID()] });
  const narrowCard = await sell(page, narrow.id, line.patientId, staffId);
  expect(errorCode((await pay(narrowCard.id)).body)).toBe("BlueDental:PrepaidCard:0011");

  // A locked card pays nothing until it is unlocked.
  expect((await call(page, `${CARDS}/${card.id}/lock`, { method: "POST" })).status).toBe(200);
  expect(errorCode((await pay(card.id)).body)).toBe("BlueDental:PrepaidCard:0007");
  expect((await call(page, `${CARDS}/${card.id}/unlock`, { method: "POST" })).status).toBe(200);

  // Cancelling the receipt gives the value and the use back, as a "Hoàn lại" line.
  const cancelled = await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, {
    method: "POST",
    json: { reason: "E2E huỷ phiếu thẻ" },
  });
  expect(cancelled.status, JSON.stringify(cancelled.body)).toBeLessThan(300);
  stored = await readCard(page, card.id);
  expect(stored.balance).toBe(1_000_000);
  expect(stored.usedCount).toBe(0);
  expect(stored.transactions[0]).toMatchObject({ type: 4, value: amount, balanceAfter: 1_000_000 });

  // Topup: value and money may differ.
  const topped = await call(page, `${CARDS}/${card.id}/topup`, {
    method: "POST",
    json: { value: 500_000, paidAmount: 450_000, method: 1 },
  });
  expect(topped.status, JSON.stringify(topped.body)).toBe(200);
  stored = await readCard(page, card.id);
  expect(stored.balance).toBe(1_500_000);
  expect(stored.totalLoaded).toBe(1_500_000);

  // The owner cannot be a member of their own card.
  const members = await call(page, `${CARDS}/${card.id}/members`, {
    method: "PUT",
    json: { memberPatientIds: [line.patientId] },
  });
  expect(errorCode(members.body)).toBe("BlueDental:PrepaidCard:0006");

  // The type list counts what was sold from it.
  const types = await call(page, `${CARDS}/types?ClinicBranchId=${BRANCH_ONE}`);
  expect((types.body.items as CardType[]).find((x) => x.id === type.id)?.soldCount).toBe(1);

  // A type taken off the shelf keeps its sold card working.
  expect((await call(page, `${CARDS}/types/${narrow.id}`, { method: "DELETE" })).status).toBeLessThan(300);
  expect((await call(page, `${CARDS}/${narrowCard.id}`)).status).toBe(200);

  // Another branch's account reads the card as missing.
  const context = await browser.newContext();
  const other = await context.newPage();
  await login(other, BRANCH2_USER);
  expect((await call(other, `${CARDS}/${card.id}`)).status).toBe(404);
  await context.close();
});

test("UI: a card type is set up, a card sold and topped up, and both survive a reload", async ({ page }) => {
  await login(page);
  const line = await findLaboPatient(page);
  const name = `E2E Thẻ UI ${runId()}`;

  await page.goto("/prepaid-card");
  await assertRealApiTraffic(page, CARDS);
  await page.locator(".prepaid-views").getByText("Loại thẻ", { exact: true }).click();
  await page.getByRole("button", { name: "Thêm loại thẻ" }).first().click();

  const typeDialog = page.getByRole("dialog", { name: "Thêm loại thẻ trả trước" });
  await typeDialog.getByLabel("Tên loại thẻ").fill(name);
  await typeDialog.getByLabel("Giá bán").fill("4500000");
  await typeDialog.getByLabel("Giá trị sử dụng").fill("5000000");
  await typeDialog.getByLabel("Số lần sử dụng tối đa").fill("10");
  await typeDialog.locator(".prepaid-commission input").last().fill("5");
  await typeDialog.getByRole("button", { name: "Lưu" }).click();
  await expect(typeDialog).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

  await page.locator(".prepaid-views").getByText("Thẻ đã phát hành", { exact: true }).click();
  await page.getByRole("button", { name: "Bán thẻ" }).first().click();
  const sellDialog = page.getByRole("dialog", { name: "Bán thẻ" });
  await sellDialog.getByLabel("Loại thẻ").click();
  await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: name }).click();
  await expect(sellDialog.getByText("5.000.000")).toBeVisible();

  await sellDialog.locator(".ss-trigger").first().click();
  await page.locator("#ss-portal-dropdown .ss-search-input").fill(line.patientCode);
  await page.locator("#ss-portal-dropdown .ss-option", { hasText: line.patientCode }).first().click();

  const sold = page.waitForResponse((res) => res.url().endsWith(CARDS) && res.request().method() === "POST");
  await sellDialog.getByRole("button", { name: "Bán & phát hành" }).click();
  const response = await sold;
  expect(response.ok(), await response.text()).toBeTruthy();
  const card = (await response.json()) as Card;

  // The new card opens: its balance is the usage value.
  // The new card opens in its dialog (not a drawer).
  const detail = page.getByRole("dialog", { name: `${card.code} · ${name}` });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("5.000.000").first()).toBeVisible();

  await detail.getByRole("button", { name: "Nạp thêm" }).click();
  const topup = page.getByRole("dialog", { name: `Nạp thêm giá trị cho thẻ ${card.code}` });
  await topup.getByLabel("Giá trị nạp thêm").fill("1000000");
  await topup.getByRole("button", { name: "Nạp tiền" }).click();
  await expect(topup).toBeHidden();
  await expect(detail.getByText("6.000.000").first()).toBeVisible();
  await detail.locator(".prepaid-detail-foot").getByRole("button", { name: "Đóng" }).click();
  await expect(detail).toBeHidden();

  // Read back after a reload, from the server.
  await page.reload();
  await page.getByPlaceholder("Tìm mã thẻ, tên hoặc mã khách hàng").fill(card.code);
  const row = page.getByRole("row", { name: new RegExp(card.code) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("6.000.000");
  await expect(row).toContainText("Đang hoạt động");

  // "Xem" in the sticky Thao tác column opens the same dialog.
  await row.getByRole("button", { name: `Xem thẻ ${card.code}` }).click();
  await expect(page.getByRole("dialog", { name: `${card.code} · ${name}` })).toBeVisible();
});

test("UI: the payment dialog pays a slip from the patient's card, once, through confirmation", async ({ page }) => {
  await login(page);
  const staffId = await currentUserId(page);
  await openNewSlip(page);
  const patientId = page.url().match(/\/patient\/([0-9a-f-]{36})/)![1];

  const type = await createType(page, `E2E Thẻ TT ${runId()}`);
  const card = await sell(page, type.id, patientId, staffId);

  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await dialog.locator(".pd-newpay-lines > li").first().locator("input[type=checkbox]").check();
  await dialog.getByRole("button", { name: /Thẻ trả trước/ }).click();
  await dialog.locator(".pd-newpay-cardrow", { hasText: card.code }).click();

  const saved = page.waitForResponse((res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.method).toBe(PAY_BY_CARD);
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Thẻ trả trước (${card.code})`).first()).toBeVisible();

  // Confirming the receipt as written takes nothing more from the card.
  await confirmOnRow(page, receipt.code);
  const stored = await readCard(page, card.id);
  expect(stored.balance).toBe(1_000_000 - receipt.amount);
  expect(stored.usedCount).toBe(1);
  expect(stored.transactions.filter((tx) => tx.type === 3)).toHaveLength(1);

  // Hoàn tiền: money the card paid goes back onto the card, chosen as the channel.
  await page.getByRole("tab", { name: "Hoàn tiền", exact: true }).click();
  await page.getByRole("button", { name: "Hoàn Tiền" }).click();
  const refund = page.getByRole("dialog", { name: "Hoàn tiền" });
  await refund.getByRole("combobox", { name: "Hình thức" }).click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option", { hasText: "Thẻ trả trước" }).click();
  await refund.getByRole("textbox", { name: /^Số tiền hoàn / }).first().fill(String(receipt.amount));
  const filed = page.waitForResponse((res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST");
  await refund.getByRole("button", { name: "Lưu" }).click();
  const refunded = await filed;
  expect(refunded.ok(), await refunded.text()).toBeTruthy();
  await expect(refund).toBeHidden();
  const back = await readCard(page, card.id);
  expect(back.balance).toBe(1_000_000);
  expect(back.transactions[0].type).toBe(4);

  // The patient record lists the card; it opens the card list searched by its number.
  await page.goto(`/patient/${patientId}`);
  await page.getByRole("link", { name: "Hồ sơ", exact: true }).click();
  const chip = page.locator(".pd-card-chip", { hasText: card.code });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("1.000.000");
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/prepaid-card\\?q=${card.code}`));
  await expect(page.getByRole("row", { name: new RegExp(card.code) })).toBeVisible();
});

test("API: card-paid money is refunded only onto the card, an unused card can be cancelled, and cards count as money held", async ({
  page,
}) => {
  await login(page);
  const staffId = await currentUserId(page);
  const line = await addPlanLine(page);
  const plan = await call(page, `/api/v1/app/patient-treatments/${line.planId}`);
  const target = (plan.body.services as { id: string; outstandingAmount: number }[]).find((s) => s.id === line.lineId)!;
  const amount = Math.min(target.outstandingAmount, 50_000);

  const typeRes = await call(page, `${CARDS}/types`, {
    method: "POST",
    json: {
      clinicBranchId: BRANCH_ONE, name: `E2E Thẻ 12 tháng ${runId()}`, salePrice: 900_000, usageValue: 1_000_000,
      maxUses: null, validityMonths: 12, commissionType: PERCENT, commissionValue: 10, allowFamily: false,
      serviceIds: [], serviceGroupIds: [], isOnSale: true,
    },
  });
  expect(typeRes.status, JSON.stringify(typeRes.body)).toBe(200);
  const card = await sell(page, (typeRes.body as unknown as CardType).id, line.patientId, staffId);
  const expires = (card as Card & { expiresOn: string }).expiresOn;
  expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Number(expires.slice(0, 4))).toBe(new Date().getFullYear() + 1);

  const figures = {
    treatmentServiceIds: [line.lineId], splitMode: 1, items: [], method: PAY_BY_CARD, amount, prepaidCardId: card.id,
  };
  const paid = await call(page, PAYMENTS_API, {
    method: "POST",
    json: { ...figures, patientId: line.patientId, clinicBranchId: line.branchId, treatmentPlanId: line.planId, kind: 1, staffId },
  });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const confirmed = await call(page, `${PAYMENTS_API}/${(paid.body as unknown as Receipt).id}/confirm`, {
    method: "PUT",
    json: figures,
  });
  expect((confirmed.body as unknown as Receipt).status).toBe(2);

  const refund = (method: number, cardId?: string) =>
    call(page, PAYMENTS_API, {
      method: "POST",
      json: {
        patientId: line.patientId, clinicBranchId: line.branchId, treatmentPlanId: line.planId, kind: 2,
        treatmentServiceIds: [line.lineId], splitMode: 2, items: [{ treatmentServiceId: line.lineId, amount }],
        method, amount, staffId, prepaidCardId: cardId,
      },
    });

  // Cash may not give back what the card paid.
  expect(errorCode((await refund(1)).body)).toBe("BlueDental:Billing:0093");
  // Onto the card it goes: value back, the use stays used.
  const back = await refund(PAY_BY_CARD, card.id);
  expect(back.status, JSON.stringify(back.body)).toBe(200);
  const stored = await readCard(page, card.id);
  expect(stored.balance).toBe(1_000_000);
  expect(stored.usedCount).toBe(1);
  expect(stored.transactions[0].type).toBe(4);

  // A card that paid for a service cannot be cancelled …
  const usedCancel = await call(page, `${CARDS}/${card.id}/cancel`, { method: "POST", json: { reason: "E2E" } });
  expect(errorCode(usedCancel.body)).toBe("BlueDental:PrepaidCard:0017");

  // … an unused one can: money back, no commission, nothing more to spend.
  const unused = await sell(page, (typeRes.body as unknown as CardType).id, line.patientId, staffId);
  const cancelled = await call(page, `${CARDS}/${unused.id}/cancel`, { method: "POST", json: { reason: "Bán nhầm" } });
  expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
  expect(cancelled.body).toMatchObject({ status: 3, balance: 0, commissionAmount: 0, cancelReason: "Bán nhầm" });
  expect((cancelled.body as unknown as Card).transactions[0]).toMatchObject({ type: 5, paidAmount: 900_000 });

  // What the branch's cards still hold is counted as money held for customers.
  const balance = await call(page, `/api/v1/app/cash-management/balance?clinicBranchId=${BRANCH_ONE}`);
  const prepaidCardBalance = balance.body.prepaidCardBalance as number;
  expect(prepaidCardBalance).toBeGreaterThanOrEqual(1_000_000);
  expect(balance.body.customerPrepaid as number).toBeGreaterThanOrEqual(prepaidCardBalance);
});
