import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, removeTicket, syntheticPhone, TAGS, TICKETS } from "./fixtures/marketingTicket";

/**
 * Feature: Marketing → Ticket (F-51) — the screen, end to end, against the real
 * API and database. BlueDental-local; see docs/clone/pages/marketing-ticket.md.
 * The rules the server keeps on its own are in marketing-ticket-api.spec.ts.
 */

const ticketRow = (page: Page, text: string) => page.locator("tbody tr.ant-table-row").filter({ hasText: text });

async function searchFor(page: Page, phone: string) {
  const list = page.waitForResponse((r) => r.url().includes(`${TICKETS}?`) && r.url().includes(phone) && r.ok());
  await page.getByPlaceholder("Tìm theo mã, tên, số điện thoại").fill(phone);
  await list;
}

async function idsByPhone(page: Page, phone: string, deleted = false): Promise<string[]> {
  const res = await call<{ items: { id: string }[] }>(page, "GET", `${TICKETS}?Filter=${phone}&Deleted=${deleted}`);
  return res.body.items?.map((t) => t.id) ?? [];
}

test.describe("Marketing → Ticket", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("create, log a call, read the history, delete with a reason and restore", async ({ page }) => {
    const name = `Khách marketing ${runId()}`;
    const phone = syntheticPhone();
    await page.goto("/marketing/tickets");
    await assertRealApiTraffic(page, TICKETS);
    await expect(page.getByRole("link", { name: "Ticket", exact: true })).toBeVisible();

    // Thêm ticket — lands as Mới, in the pool.
    await page.getByRole("button", { name: "Thêm ticket" }).click();
    const create = page.getByRole("dialog", { name: /Thêm ticket/ });
    await create.getByLabel("Họ và tên").fill(name);
    await create.getByLabel("Số điện thoại").fill(phone);
    await create.getByRole("button", { name: "Lưu" }).click();
    await expect(create).toBeHidden();
    await searchFor(page, phone);
    await expect(ticketRow(page, name)).toContainText("Mới");

    // Ghi nhận liên hệ — the first call moves it to Đang chăm sóc.
    await ticketRow(page, name).getByRole("button", { name: "Ghi nhận liên hệ" }).click();
    const contact = page.getByRole("dialog", { name: /Ghi nhận liên hệ/ });
    await contact.getByText("Quan tâm", { exact: true }).click();
    await contact.getByLabel("Nội dung trao đổi").fill("Hỏi giá niềng răng");
    await contact.getByRole("button", { name: "Lưu" }).click();
    await expect(contact).toBeHidden();
    await expect(ticketRow(page, name)).toContainText("Đang chăm sóc");

    // Persisted: a reload reads it back from the database.
    await page.reload();
    await searchFor(page, phone);
    await expect(ticketRow(page, name)).toContainText("Đang chăm sóc");

    // The row opens the detail drawer with the care history.
    await ticketRow(page, name).getByText(phone).click();
    const drawer = page.getByRole("dialog", { name: new RegExp(`· ${name}$`) });
    await expect(drawer.getByRole("heading", { name: "Lịch sử chăm sóc" })).toBeVisible();
    await expect(drawer.getByText("Hỏi giá niềng răng")).toBeVisible();
    await expect(drawer.getByText("Tạo ticket")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Xoá needs a reason; the ticket leaves the list for Đã xoá.
    await ticketRow(page, name).getByRole("button", { name: "Thêm", exact: true }).click();
    await page.getByRole("menuitem", { name: /Xoá$/ }).click();
    const remove = page.getByRole("dialog", { name: /Xoá ticket/ });
    await remove.getByRole("button", { name: /Xoá$/ }).click();
    await expect(remove.getByText("Vui lòng nhập lý do")).toBeVisible();
    await remove.getByLabel("Lý do xoá").fill("Nhập nhầm");
    await remove.getByRole("button", { name: /Xoá$/ }).click();
    await expect(remove).toBeHidden();
    await expect(ticketRow(page, name)).toHaveCount(0);

    await page.getByRole("link", { name: "Đã xoá", exact: true }).click();
    await expect(page).toHaveURL(/\/marketing\/deleted/);
    // The deleted list is its own lazy page: search only once it has replaced the Ticket list.
    await expect(page.getByRole("columnheader", { name: "Lý do xoá" })).toBeVisible();
    await searchFor(page, phone);
    await expect(ticketRow(page, name)).toContainText("Nhập nhầm");
    // Khôi phục asks first; closing the question leaves the ticket deleted.
    await ticketRow(page, name).getByRole("button", { name: "Khôi phục" }).click();
    const restore = page.getByRole("dialog", { name: "Khôi phục ticket" });
    await expect(restore).toContainText(name);
    // The corner X is "Đóng" too; the footer button is the last one.
    await restore.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(restore).toBeHidden();
    await expect(ticketRow(page, name)).toHaveCount(1);
    await ticketRow(page, name).getByRole("button", { name: "Khôi phục" }).click();
    await restore.getByRole("button", { name: /Khôi phục$/ }).click();
    await expect(restore).toBeHidden();
    await expect(ticketRow(page, name)).toHaveCount(0);

    const live = await idsByPhone(page, phone);
    expect(live).toHaveLength(1);
    await removeTicket(page, live[0]);
  });

  test("a tag with Thời gian xử lý is created on Thẻ ticket and shown with its deadline", async ({ page }) => {
    const tagName = `Implant ${runId()}`;
    await page.goto("/marketing/tags");
    await assertRealApiTraffic(page, TAGS);
    await page.getByRole("button", { name: "Thêm thẻ" }).click();
    const dialog = page.getByRole("dialog", { name: /Thêm thẻ/ });
    await dialog.getByLabel("Tên thẻ").fill(tagName);
    await dialog.getByLabel("Thời gian xử lý").fill("4");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    const row = page.locator("tbody tr.ant-table-row").filter({ hasText: tagName });
    await expect(row).toContainText("4");

    const tags = await call<{ items: { id: string; name: string }[] }>(page, "GET", `${TAGS}?Filter=${encodeURIComponent(tagName)}`);
    const created = tags.body.items.find((t) => t.name === tagName);
    expect(created).toBeTruthy();
    if (created) await call(page, "DELETE", `${TAGS}/${created.id}`);
  });
});
