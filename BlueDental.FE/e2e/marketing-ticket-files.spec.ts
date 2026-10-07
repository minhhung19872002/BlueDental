import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BRANCH_ONE,
  call,
  FILES,
  removeTicket,
  staffOf,
  syntheticPhone,
  ticketsWhere,
  TICKETS,
  ticketWorkbookBuffer,
} from "./fixtures/marketingTicket";

/**
 * Feature: Marketing → Ticket (F-55), đợt 2 — Chuyển ticket hàng loạt (BA 8.3)
 * and Ticket File (BA 8.4) on screen, against the real API and database.
 * BlueDental-local; see docs/clone/pages/marketing-ticket.md. The rules the
 * server keeps on its own are in marketing-ticket-files-api.spec.ts.
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ticketRow = (page: Page, text: string) => page.locator("tbody tr.ant-table-row").filter({ hasText: text });

/**
 * Picks options of a searchable AntD select by their visible text — typed first,
 * since the dropdown is virtual and only renders the options in view.
 */
async function pick(page: Page, field: Locator, labels: string[]) {
  for (const label of labels) {
    await field.click();
    await field.fill(label);
    await page.locator(".ant-select-item-option").filter({ hasText: label }).first().click();
  }
  await page.keyboard.press("Escape");
}

async function chooseFile(dialog: Locator, name: string, rows: string[][]) {
  await dialog.locator('input[type="file"]').setInputFiles({ name, mimeType: XLSX_MIME, buffer: ticketWorkbookBuffer(rows) });
}

test.describe("Marketing → Ticket File & Chuyển ticket", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("import a file, open its tickets from Ticket File, and the list stays narrowed after a reload", async ({ page }) => {
    const id = runId();
    const staff = await staffOf(page);
    const phones = [syntheticPhone(), syntheticPhone()];
    const names = [`Nhap file A ${id}`, `Nhap file B ${id}`];
    const fileName = `khach-${id}.xlsx`;
    let created: string[] = [];

    await page.goto("/marketing/files");
    await assertRealApiTraffic(page, FILES);
    try {
      await page.getByRole("button", { name: "Import file" }).click();
      const dialog = page.getByRole("dialog", { name: /Import ticket từ file/ });
      await chooseFile(dialog, fileName, [
        ["Họ và tên", "Số điện thoại", "Email", "Ghi chú"],
        [names[0], phones[0], "", "Hỏi giá niềng"],
        [names[1], phones[1], "", ""],
      ]);
      await dialog.getByRole("button", { name: "Tiếp tục" }).click();

      // The template's headers are already matched; the file is shared to one staff member.
      await expect(dialog.getByText(`File ${fileName} có 2 dòng dữ liệu.`)).toBeVisible();
      await expect(dialog.getByText("Cột B · Số điện thoại")).toBeVisible();
      await pick(page, dialog.getByLabel("Chia cho"), [staff[0].name]);
      await dialog.getByRole("button", { name: "Import 2 dòng" }).click();
      await expect(dialog.getByText("Đã import file")).toBeVisible();
      await expect(dialog.getByText(/^2 ticket mới, 0 số điện thoại/)).toBeVisible();
      await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(dialog).toBeHidden();

      // Ticket File lists it with its two new tickets.
      await page.getByPlaceholder("Tìm theo tên file").fill(fileName);
      const fileRow = ticketRow(page, fileName);
      await expect(fileRow).toBeVisible();
      await expect(fileRow).toContainText(staff[0].name);

      // A row opens the Ticket list narrowed to the file.
      await fileRow.click();
      await expect(page).toHaveURL(/\/marketing\/tickets\?file=/);
      await expect(page.locator(".mkt-file-chip")).toContainText(fileName);
      for (const name of names) await expect(ticketRow(page, name)).toContainText(staff[0].name);
      created = (await ticketsWhere(page, `Filter=${id}`)).map((t) => t.id);
      expect(created).toHaveLength(2);

      await page.reload();
      await expect(page.locator(".mkt-file-chip")).toContainText(fileName);
      await expect(page.locator("tbody tr.ant-table-row")).toHaveCount(2);

      // Closing the chip lets go of the file.
      await page.locator(".mkt-file-chip .ant-tag-close-icon").click();
      await expect(page).not.toHaveURL(/file=/);
      await expect(page.locator(".mkt-file-chip")).toHaveCount(0);
    } finally {
      for (const ticketId of created) await removeTicket(page, ticketId);
    }
  });

  test("a file with bad rows is refused whole and Quay lại starts over", async ({ page }) => {
    const id = runId();
    const fileName = `loi-${id}.xlsx`;
    await page.goto("/marketing/files");

    await page.getByRole("button", { name: "Import file" }).click();
    const dialog = page.getByRole("dialog", { name: /Import ticket từ file/ });
    await chooseFile(dialog, fileName, [
      ["Họ và tên", "Số điện thoại"],
      [`Tot ${id}`, syntheticPhone()],
      ["", syntheticPhone()],
    ]);
    await dialog.getByRole("button", { name: "Tiếp tục" }).click();
    await dialog.getByRole("button", { name: "Import 2 dòng" }).click();

    await expect(dialog.getByText("File chưa được import")).toBeVisible();
    const errorRow = dialog.locator(".mkt-import-table tbody tr.ant-table-row");
    await expect(errorRow).toHaveCount(1);
    await expect(errorRow).toContainText("3");
    await expect(errorRow).toContainText("Thiếu họ tên");

    await dialog.getByRole("button", { name: "Quay lại" }).click();
    await expect(dialog.getByText("Bấm hoặc kéo file Excel vào đây")).toBeVisible();
    await page.keyboard.press("Escape");

    // Nothing reached the database: not the good row, not the file.
    expect(await ticketsWhere(page, `Filter=${encodeURIComponent(`Tot ${id}`)}`)).toHaveLength(0);
    const list = await call<{ items: unknown[] }>(page, "GET", `${FILES}?Filter=${encodeURIComponent(fileName)}`);
    expect(list.body.items).toHaveLength(0);
  });

  test("Chuyển ticket moves every ticket under the filter to the chosen group", async ({ page }) => {
    const staff = await staffOf(page);
    expect(staff.length, "branch 1 needs two staff to split between").toBeGreaterThanOrEqual(2);
    const tag = `Chuyen UI ${runId()}`;
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await call<{ ticket: { id: string } }>(page, "POST", TICKETS, { clinicBranchId: BRANCH_ONE, tagIds: [], fullName: `${tag} ${i}`, phone: syntheticPhone() });
      ids.push(res.body.ticket.id);
    }

    try {
      await page.goto("/marketing/tickets");
      const list = page.waitForResponse((r) => r.url().includes(`${TICKETS}?`) && r.url().includes(encodeURIComponent("Chuyen")) && r.ok());
      await page.getByPlaceholder("Tìm theo mã, tên, số điện thoại").fill(tag);
      await list;
      await expect(page.locator("tbody tr.ant-table-row")).toHaveCount(2);

      await page.getByRole("button", { name: "Chuyển ticket" }).click();
      const dialog = page.getByRole("dialog", { name: /Chuyển ticket hàng loạt/ });
      await expect(dialog.getByText("2 ticket khớp bộ lọc hiện tại")).toBeVisible();

      // No one chosen is caught on the form.
      await dialog.getByRole("button", { name: "Chuyển ticket" }).click();
      await expect(dialog.getByText("Vui lòng chọn ít nhất một nhân viên")).toBeVisible();

      await pick(page, dialog.getByLabel("Chuyển cho"), [staff[0].name, staff[1].name]);
      await dialog.getByRole("button", { name: "Chuyển ticket" }).click();
      await expect(page.getByText("Đã chuyển 2/2 ticket")).toBeVisible();
      await expect(dialog).toBeHidden();

      // One each, read back after a reload.
      await page.reload();
      await page.getByPlaceholder("Tìm theo mã, tên, số điện thoại").fill(tag);
      await expect(ticketRow(page, `${tag} 0`)).toBeVisible();
      const owners = (await ticketsWhere(page, `Filter=${encodeURIComponent(tag)}`)).map((t) => t.assigneeId).sort();
      expect(owners).toEqual([staff[0].id, staff[1].id].sort());
      for (const name of [`${tag} 0`, `${tag} 1`]) {
        await expect(ticketRow(page, name)).toContainText(new RegExp([staff[0].name, staff[1].name].map(escapeRegExp).join("|")));
      }
    } finally {
      for (const id of ids) await removeTicket(page, id);
    }
  });
});
