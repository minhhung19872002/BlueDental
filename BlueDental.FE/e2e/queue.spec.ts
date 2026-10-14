import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE } from "./fixtures/catalogApi";
import {
  deleteCounters,
  drainCounter,
  freeDentists,
  freePrefixes,
  listCounters,
  type Counter,
} from "./fixtures/queueApi";

/**
 * Feature: Màn hình đợi (F-45, BA redesign 2026-10-09) through the real UI:
 * add a counter with its required dentist, take numbers at that counter,
 * call them from the board and from the counter's own page, pause it, and
 * watch the TV.
 *
 * Real login, real routes, real backend, real PostgreSQL. The only direct
 * HTTP is reading which prefixes are free and deleting the counter at the
 * end, both with the real session.
 */

const ENABLED_OPTION = ".ant-select-item-option:not(.ant-select-item-option-disabled)";

function dialogNamed(page: Page, title: string): Locator {
  return page.getByRole("dialog", { name: title, exact: true });
}

/** The screens put "BS." in front themselves; some seeded names already carry it. */
function titled(label: string): string {
  return `BS. ${label.replace(/^\s*bs\.?\s+/i, "")}`;
}

function cardOf(page: Page, name: string): Locator {
  return page.locator(".queue-card").filter({ has: page.locator(".queue-card__name", { hasText: name }) });
}

/**
 * Picks a dentist who heads no counter yet. Typed into the search first: the
 * picker is a virtual list and, once the branch has many counters, the taken
 * (disabled) dentists fill the visible window.
 */
async function pickFreeDentist(page: Page, form: Locator, label: string): Promise<string> {
  await form.getByRole("combobox", { name: /^\*?\s*Bác sĩ phụ trách/ }).click();
  await page.keyboard.type(label);
  const option = page.locator(ENABLED_OPTION).filter({ hasText: label }).first();
  const text = (await option.innerText()).trim();
  await option.click();
  return text;
}

async function takeNumber(page: Page, counterName: string, priority: "Bình thường" | "Ưu tiên"): Promise<void> {
  await page.getByRole("button", { name: "Lấy số mới" }).click();
  const modal = dialogNamed(page, "Lấy số thứ tự");
  await modal.getByRole("combobox").click();
  await page.keyboard.type(counterName);
  await page.locator(ENABLED_OPTION).filter({ hasText: counterName }).click();
  await modal.getByLabel(priority).check();
  const created = page.waitForResponse((r) => r.url().endsWith("/queue/tickets") && r.request().method() === "POST");
  await modal.getByRole("button", { name: "Lấy số" }).click();
  expect((await created).status()).toBe(200);
  await expect(modal).toBeHidden();
}

test.describe("Màn hình đợi — per-counter queues in the browser", () => {
  test.describe.configure({ mode: "serial" });

  const run = runId();
  const name = `E2E Quầy ${run}`;
  let page: Page;
  let prefix: string;
  let dentistLabel: string;
  let freeDentistLabel: string;
  let counter: Counter | undefined;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
    await page.goto("/queue");
    [prefix] = await freePrefixes(page, 1);
    [{ label: freeDentistLabel }] = await freeDentists(page, 1);
  });

  test.afterAll(async () => {
    await deleteCounters(page, [counter]);
    await page.context().close();
  });

  test("a counter cannot be saved until its dentist is chosen", async () => {
    await expect(page.getByRole("region", { name: "Tổng quan hàng chờ" })).toBeVisible();
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    const manager = dialogNamed(page, "Quản lý quầy");
    await manager.getByRole("button", { name: "Thêm quầy" }).click();

    const form = dialogNamed(page, "Thêm quầy");
    await expect(form).toBeVisible();
    await expect(manager, "the form takes the manager's place").toBeHidden();
    const save = form.getByRole("button", { name: /Lưu$/ });
    const prefixBox = form.getByRole("textbox", { name: /^\*?\s*Ký hiệu số/ });
    await form.getByRole("textbox", { name: /^\*?\s*Tên quầy/ }).fill(name);
    await prefixBox.fill(prefix.toLowerCase());
    await expect(prefixBox, "prefix is upper-cased").toHaveValue(prefix);
    await expect(form.getByText(`Hiển thị: ${prefix}001`)).toBeVisible();
    await expect(save, "no dentist yet").toBeDisabled();

    dentistLabel = await pickFreeDentist(page, form, freeDentistLabel);
    expect(dentistLabel).not.toBe("");
    await expect(form.locator(".queue-form__dentist-name"), "the pick turns into the locked card").toHaveText(
      titled(dentistLabel),
    );
    await expect(form.getByRole("button", { name: "Đổi bác sĩ…" })).toBeEnabled();
    await expect(save).toBeEnabled();

    const saved = page.waitForResponse((r) => r.url().endsWith("/queue/counters") && r.request().method() === "POST");
    await save.click();
    expect((await saved).status()).toBe(200);
    await expect(form).toBeHidden();
    await expect(manager, "closing the form brings the manager back").toBeVisible();

    const row = manager.locator("tr", { hasText: name });
    await expect(row).toContainText(dentistLabel);
    await manager.locator(".ant-modal-close").click();

    counter = (await listCounters(page)).find((c) => c.name === name);
    expect(counter?.numberPrefix).toBe(prefix);
    await expect(cardOf(page, name).locator(".queue-card__dentist")).toHaveText(titled(dentistLabel));
  });

  test("a second counter cannot take the same name in another case or spacing (bug #34)", async () => {
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    const manager = dialogNamed(page, "Quản lý quầy");
    await manager.getByRole("button", { name: "Thêm quầy" }).click();
    const form = dialogNamed(page, "Thêm quầy");

    const posts: string[] = [];
    const onRequest = (r: { url(): string; method(): string }) => {
      if (r.url().endsWith("/queue/counters") && r.method() === "POST") posts.push(r.url());
    };
    page.on("request", onRequest);
    try {
      await form.getByRole("textbox", { name: /^\*?\s*Tên quầy/ }).fill(`  ${name.toUpperCase().replace(" ", "   ")} `);
      await expect(form.getByText("Tên quầy đã tồn tại"), "shown under the field as it is typed").toBeVisible();

      // The prefix clash shows the same way, under its field, before Lưu.
      const prefixBox = form.getByRole("textbox", { name: /^\*?\s*Ký hiệu số/ });
      await prefixBox.fill(prefix.toLowerCase());
      await expect(form.getByText("Ký hiệu số đã được quầy khác dùng")).toBeVisible();
      await prefixBox.fill("Z0");
      await expect(form.getByText("Ký hiệu số đã được quầy khác dùng")).toBeHidden();
      const [other] = await freeDentists(page, 1);
      await pickFreeDentist(page, form, other.label);
      await form.getByRole("button", { name: /Lưu$/ }).click();
      await expect(form.getByText("Tên quầy đã tồn tại")).toBeVisible();
      await expect(form, "the dialog stays open").toBeVisible();
      expect(posts, "nothing is sent to the server").toEqual([]);
    } finally {
      page.off("request", onRequest);
    }

    await form.locator(".ant-modal-close").click();
    await expect(manager).toBeVisible();
    await manager.locator(".ant-modal-close").click();
    expect((await listCounters(page)).filter((c) => c.name.toLowerCase() === name.toLowerCase())).toHaveLength(1);
  });

  test("numbers taken at the counter are called urgent first from its card", async () => {
    await takeNumber(page, name, "Bình thường");
    await takeNumber(page, name, "Ưu tiên");

    const card = cardOf(page, name);
    const call = card.getByRole("button", { name: `Gọi ${prefix}002` });
    await expect(call, "the urgent number is next").toBeVisible();
    await call.click();
    await expect(card.locator(".queue-card__now")).toContainText(`${prefix}002`);
    await expect(card.getByRole("button", { name: `Gọi ${prefix}001` })).toBeVisible();

    // ↻ reloads the board from the server and stays on the board (it is not "Gọi lại").
    const reloaded = page.waitForResponse(
      (r) => r.url().endsWith("/queue/counters/board") && r.request().method() === "GET",
    );
    await card.getByRole("button", { name: "Làm mới" }).click();
    expect((await reloaded).status()).toBe(200);
    await expect(page).toHaveURL(/\/queue(\?|$)/);
    await expect(card.locator(".queue-card__now")).toContainText(`${prefix}002`);
  });

  test("the counter's page lists its queue, survives a reload, skips and calls", async () => {
    await cardOf(page, name).locator(".queue-card__name").click();
    await expect(page).toHaveURL(new RegExp(`/queue/counters/${counter?.id}(\\?|$)`));
    await expect(page.getByRole("heading", { name: `Hàng chờ · ${name}` })).toBeVisible();

    const table = page.locator(".queue-detail__list");
    await expect(table.getByRole("columnheader")).toHaveText(["Số", "Lấy số lúc", "Đã chờ", "Dự kiến gọi", "Mức chờ"]);
    await expect(table.locator("tr.ant-table-row")).toHaveCount(1);
    await expect(table.locator("tr.ant-table-row").first()).toContainText(`${prefix}001`);

    await page.reload();
    await expect(table.locator("tr.ant-table-row").first(), "persisted").toContainText(`${prefix}001`);

    await page.getByRole("button", { name: `Bỏ qua ${prefix}002` }).click();
    await expect(page.getByRole("button", { name: /Bỏ qua$/ })).toBeDisabled();

    await page.getByRole("button", { name: `Gọi số tiếp theo · ${prefix}001` }).click();
    await expect(page.getByRole("button", { name: "Hết số chờ" })).toBeDisabled();
    await expect(table.getByText("Không có bệnh nhân chờ")).toBeVisible();
  });

  test("the TV shows the counter, its dentist and the number being seen", async ({ browser }) => {
    const tv = await browser.newPage();
    try {
      await tv.goto(`/queue/display?branchId=${BRANCH_ONE}`);
      const card = tv.locator(".queue-tv__card").filter({ hasText: name });
      await expect(card.locator(".queue-tv__dentist")).toHaveText(titled(dentistLabel));
      await expect(card.locator(".queue-tv__number")).toHaveText(`${prefix}001`);
    } finally {
      await tv.context().close();
    }
  });

  test("a paused counter is marked paused and hands out no number", async () => {
    await page.goto("/queue");
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    const manager = dialogNamed(page, "Quản lý quầy");
    await manager.getByRole("switch", { name }).click();
    await expect(manager.locator("tr", { hasText: name })).toContainText("Tạm nghỉ");
    await manager.locator(".ant-modal-close").click();

    const card = cardOf(page, name);
    await expect(card).toHaveClass(/queue-card--paused/);
    await expect(card.getByRole("button", { name: "Quầy tạm nghỉ" })).toBeDisabled();
    const newWait = card.locator(".queue-card__facts > div").filter({ hasText: "Số mới chờ" }).locator("dd");
    await expect(newWait, "no number is handed out, so no wait is quoted").toHaveText("—");

    await page.getByRole("button", { name: "Lấy số mới" }).click();
    await dialogNamed(page, "Lấy số thứ tự").getByRole("combobox").click();
    await page.keyboard.type(name);
    await expect(page.locator(".ant-select-item-option").filter({ hasText: name })).toHaveClass(
      /ant-select-item-option-disabled/,
    );
  });

  test("Xoá quầy is refused with a toast while a number is still there, then deletes once it is empty", async () => {
    if (!counter) throw new Error("the counter was not created");
    const counterId = counter.id;
    await page.goto("/queue");
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    const manager = dialogNamed(page, "Quản lý quầy");
    const deletes: string[] = [];
    const onRequest = (r: { url(): string; method(): string }) => {
      if (r.method() === "DELETE" && r.url().includes("/queue/counters/")) deletes.push(r.url());
    };
    page.on("request", onRequest);
    try {
      // 001 is still being called at this counter.
      await manager.getByRole("button", { name: `Xoá ${name}` }).click();
      await expect(page.getByText(`Không thể xoá ${name} vì còn 1 bệnh nhân trong hàng đợi.`)).toBeVisible();
      await expect(dialogNamed(page, "Xác nhận xoá quầy"), "no confirm for a busy counter").toBeHidden();
      expect(deletes, "nothing is sent").toEqual([]);
    } finally {
      page.off("request", onRequest);
    }
    await manager.locator(".ant-modal-close").click();

    // The desk finishes the queue; the (still paused) counter may now go.
    await drainCounter(page, counterId);
    await page.reload();
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    await manager.getByRole("button", { name: `Xoá ${name}` }).click();
    const confirm = dialogNamed(page, "Xác nhận xoá quầy");
    await expect(confirm).toContainText(`Bạn có chắc muốn xoá quầy ${name} không?`);
    const deleted = page.waitForResponse(
      (r) => r.url().endsWith(`/queue/counters/${counterId}`) && r.request().method() === "DELETE",
    );
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await deleted).status()).toBeLessThan(300);
    await expect(page.getByText("Đã xoá", { exact: true })).toBeVisible();
    await expect(confirm).toBeHidden();
    await expect(manager.locator("tr", { hasText: name })).toHaveCount(0);

    await page.reload();
    await expect(cardOf(page, name), "gone from the board").toHaveCount(0);
    await page.getByRole("button", { name: "Quản lý quầy" }).click();
    await expect(manager.locator("tr.ant-table-row").first()).toBeVisible();
    await expect(manager.locator("tr", { hasText: name }), "persisted").toHaveCount(0);
    counter = undefined;
  });
});
