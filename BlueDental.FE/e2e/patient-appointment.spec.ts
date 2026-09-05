import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, freeSlot, login, runId } from "./fixtures/auth";

/**
 * Feature: "Tạo lịch hẹn" — the booking dialog on a patient's Lịch hẹn tab.
 *
 * Real stack throughout: the dialog POSTs to the real API, the row comes back
 * from PostgreSQL and everything is re-read after a reload. Nothing here is
 * intercepted, so a field the client drops on the wire fails the test.
 */

/** Opens the patient's Lịch hẹn tab from the list. */
async function openAppointmentTab(page: Page) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page
    .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
    .first()
    .click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  await page.getByRole("link", { name: "Lịch hẹn" }).click();
  await expect(page).toHaveURL(/tab=appointment/);
}

/**
 * Books the slot into a clear part of the diary.
 *
 * The dialog opens on "now", and the seeded clinic already has doctors booked
 * around the current hour — the server rejects a clash, correctly. Each run
 * therefore picks a day of its own, far enough out that nothing else is there.
 */
async function chooseSlot(dialog: ReturnType<Page["getByRole"]>, { day, time }: ReturnType<typeof freeSlot>) {
  const date = dialog.getByPlaceholder("Chọn thời điểm");
  await date.fill(day);
  await date.press("Enter");
  await expect(date).toHaveValue(day);

  const clock = dialog.getByPlaceholder("HH:mm");
  await clock.fill(time);
  await clock.press("Enter");
  await expect(clock).toHaveValue(time);
}

/** Takes the first doctor out of the dialog's SearchSelect, by its portal list. */
async function pickFirstDoctor(page: Page): Promise<string> {
  const field = page.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
  await field.getByRole("combobox").click();

  const option = page.locator("#ss-portal-dropdown [role=option]").first();
  await expect(option).toBeVisible();
  const name = (await option.innerText()).trim();
  await option.click();
  return name;
}

/**
 * The tab pages twenty rows at a time and the seeded patient already has more
 * than that, so the row just booked may sit on a later page: walk the pager
 * until it shows up.
 */
async function findRow(page: Page, reason: string) {
  await expect(page.locator(".pd-appointment-card tbody tr.ant-table-row").first()).toBeVisible();
  const row = page.locator("tbody tr", { hasText: reason }).first();
  for (let hop = 0; hop < 10; hop += 1) {
    if (await row.isVisible()) return row;
    const next = page.locator(".ant-pagination-next").first();
    if ((await next.getAttribute("aria-disabled")) === "true") break;
    const loaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "GET",
    );
    await next.click();
    await loaded;
    await expect(page.locator(".ant-pagination-item-active").first()).toHaveText(String(hop + 2));
  }
  await expect(row).toBeVisible();
  return row;
}

/** Walks every page of the tab and fails if any row still carries `reason`. */
async function expectNoRow(page: Page, reason: string) {
  await expect(page.locator(".pd-appointment-card tbody tr.ant-table-row").first()).toBeVisible();
  for (let hop = 0; hop < 10; hop += 1) {
    await expect(page.locator("tbody tr", { hasText: reason })).toHaveCount(0);
    const next = page.locator(".ant-pagination-next").first();
    if ((await next.getAttribute("aria-disabled")) === "true") return;
    const loaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "GET",
    );
    await next.click();
    await loaded;
  }
}

/** Opens Trạng thái in the edit dialog and returns what it offers, top to bottom. */
async function openStatusOptions(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await dialog.locator(".appt-status-select").click();
  const options = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
  await expect(options.first()).toBeVisible();
  return (await options.allInnerTexts()).map((text) => text.trim());
}

async function chooseStatus(page: Page, label: string) {
  await page.locator(`.ant-select-dropdown:visible .ant-select-item-option[title="${label}"]`).click();
}

/** Lưu on the edit dialog; the one PUT it makes must succeed. */
async function saveEdit(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  const updated = page.waitForResponse(
    (res) => res.url().includes("/api/v1/app/appointments/") && res.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  expect((await updated).ok()).toBeTruthy();
  await expect(dialog).toBeHidden();
}

test.describe("Lịch hẹn của bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the tab fills the screen and keeps the pager on the card's bottom edge", async ({
    page,
  }) => {
    await openAppointmentTab(page);

    // One card holds the counters, the commands and the table, as /cskh-grouping does.
    const card = page.locator(".pd-pane .pd-appointment-card");
    await expect(card).toBeVisible();
    await expect(card.locator(".pd-stat-row")).toBeVisible();
    await expect(card.locator(".bd-cat-card")).toBeVisible();

    // The card runs to the bottom of the page, with or without rows.
    const cardBox = await card.boundingBox();
    const pageBox = await page.locator(".pd-page").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(pageBox).not.toBeNull();
    expect(cardBox!.y + cardBox!.height).toBeGreaterThan(pageBox!.y + pageBox!.height - 8);

    // Four counters, in the reference's order.
    for (const label of ["Đã hẹn", "Đã đến", "Đã huỷ", "Trễ hẹn"]) {
      await expect(page.locator(".pd-stat-row").getByText(label, { exact: true })).toBeVisible();
    }

    for (const header of ["NGÀY/ GIỜ", "BÁC SĨ PHỤ TRÁCH", "NỘI DUNG", "GHI CHÚ", "TRẠNG THÁI"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  test("the dialog carries the reference's fields, and saves colour and note for real", async ({
    page,
  }) => {
    const id = runId();
    const reason = `E2E khám ${id}`;
    const note = `E2E ghi chú ${id}`;

    await openAppointmentTab(page);
    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();

    // Opened from a patient, so the patient is fixed; the branch reports the
    // one the session is scoped to.
    await expect(dialog.getByText("Chọn bệnh nhân")).toBeVisible();
    await expect(dialog.locator(".ss-wrapper--disabled")).toHaveCount(1);

    // The agenda is the clinic's whole diary, with all three ranges.
    await expect(dialog.getByText("Lịch đã hẹn")).toBeVisible();
    for (const mode of ["Ngày", "Tuần", "Tháng"]) {
      await expect(dialog.getByText(mode, { exact: true })).toBeVisible();
    }

    // Four colours, and the first of them is preselected. Asserted by position,
    // not by name: the palette itself is a design choice that has already been
    // renamed once, and what matters here is that a colour is chosen for you.
    const swatches = dialog.locator(".appt-color-swatch");
    await expect(swatches).toHaveCount(4);
    await expect(swatches.first()).toHaveClass(/appt-color-swatch--selected/);
    await expect(dialog.locator(".appt-color-swatch--selected")).toHaveCount(1);

    // Fill the form the way the reference does.
    await chooseSlot(dialog, freeSlot(id, 1));
    const doctorName = await pickFirstDoctor(page);

    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(reason);

    // The note panel starts collapsed; "Thêm ngay" reveals the field.
    await expect(dialog.getByText("Chưa có ghi chú")).toBeVisible();
    await dialog.getByRole("button", { name: "Thêm ngay" }).click();
    await dialog.locator(".appt-notes-panel textarea").fill(note);
    await dialog.locator(".appt-notes-panel").getByRole("button").last().click();

    await dialog.getByTitle("Xanh lá").click();
    await expect(dialog.locator(".appt-color-swatch--selected")).toHaveAttribute(
      "title",
      "Xanh lá",
    );

    const created = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await created).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // Reload: the row, its note and its doctor all came from PostgreSQL.
    await page.reload();
    const row = await findRow(page, reason);
    await expect(row).toContainText(note);
    await expect(row).toContainText(doctorName);
  });

  test("editing an appointment updates it instead of booking a second one", async ({ page }) => {
    const id = runId();
    const reason = `E2E sửa ${id}`;

    await openAppointmentTab(page);
    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
    const create = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await chooseSlot(create, freeSlot(id, 2));
    await pickFirstDoctor(page);
    await create.getByPlaceholder("Nội dung đặt lịch").fill(reason);
    await create.getByRole("button", { name: "Lưu" }).click();
    await expect(create).toBeHidden();

    const row = await findRow(page, reason);

    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    const edit = page.getByRole("dialog", { name: "Cập nhật lịch hẹn" });
    await expect(edit).toBeVisible();

    // The dialog opens on what is already stored, not on empty defaults.
    await expect(edit.getByPlaceholder("Nội dung đặt lịch")).toHaveValue(reason);

    const updated = `${reason} v2`;
    await edit.getByPlaceholder("Nội dung đặt lịch").fill(updated);

    const put = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "PUT",
    );
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();

    // One row, not two: `updated` starts with `reason`, so a save that created a
    // second appointment instead of updating the first would match twice on the
    // page the row sits on (the list is sorted by time, so both would share it).
    await page.reload();
    await findRow(page, updated);
    await expect(page.locator("tbody tr", { hasText: reason })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: updated })).toHaveCount(1);
  });

  test("the dialog is styled when opened from the record, not just the calendar", async ({
    page,
  }) => {
    await openAppointmentTab(page);
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();

    // The modal's CSS lived only in the calendar page's stylesheet, so opening
    // it from a record gave a full-width dialog with its columns collapsed.
    const dialog = page.locator(".appt-editor-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".appt-editor-cols")).toBeVisible();

    // Three columns side by side, not stacked.
    const cols = page.locator(".appt-editor-cols > *");
    const first = await cols.first().boundingBox();
    const last = await cols.last().boundingBox();
    expect(last!.x).toBeGreaterThan(first!.x + first!.width - 4);
  });

  test("deleting asks first, Huỷ keeps the row, and Xoá removes it for real", async ({ page }) => {
    const id = runId();
    const reason = `E2E xoá ${id}`;

    await openAppointmentTab(page);
    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
    const create = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await chooseSlot(create, freeSlot(id, 3));
    await pickFirstDoctor(page);
    await create.getByPlaceholder("Nội dung đặt lịch").fill(reason);
    await create.getByRole("button", { name: "Lưu" }).click();
    await expect(create).toBeHidden();

    const row = await findRow(page, reason);

    // Pencil and red bin side by side, as on the reference; the bin asks first,
    // with the reference's own words, and Huỷ changes nothing.
    await row.getByRole("button", { name: "Xoá lịch hẹn" }).click();
    const dialog = page.getByRole("dialog", { name: "Xoá lịch hẹn" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Bạn có chắc muốn xoá lịch hẹn này không?")).toBeVisible();
    await expect(dialog.getByText("Hành động này không thể hoàn tác.")).toBeVisible();
    await dialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();

    // Xoá goes to the server; the row is gone at once and after a reload.
    await row.getByRole("button", { name: "Xoá lịch hẹn" }).click();
    const deleted = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/appointments/") && res.request().method() === "DELETE",
    );
    await dialog.getByRole("button", { name: "Xoá" }).click();
    expect((await deleted).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(page.locator("tbody tr", { hasText: reason })).toHaveCount(0);

    await page.reload();
    await expectNoRow(page, reason);
  });

  test("Trạng thái in the edit dialog always offers booked, cancelled and late, and each sticks", async ({
    page,
  }) => {
    const id = runId();
    const reason = `E2E trạng thái ${id}`;
    const status = (dialog: ReturnType<Page["getByRole"]>) => dialog.locator(".appt-status-select");

    await openAppointmentTab(page);
    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
    const create = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await chooseSlot(create, freeSlot(id, 4));
    await pickFirstDoctor(page);
    await create.getByPlaceholder("Nội dung đặt lịch").fill(reason);
    await create.getByRole("button", { name: "Lưu" }).click();
    await expect(create).toBeHidden();

    // The dialog is titled as the reference titles it, and the select opens
    // on the status the row shows, offering the same three whatever it is.
    let row = await findRow(page, reason);
    await expect(row).toContainText("Đã hẹn");
    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    const edit = page.getByRole("dialog", { name: "Cập nhật lịch hẹn" });
    await expect(edit).toBeVisible();
    await expect(status(edit)).toContainText("Đã hẹn");
    expect(await openStatusOptions(page, edit)).toEqual(["Đã hẹn", "Đã huỷ", "Trễ hẹn"]);
    await chooseStatus(page, "Trễ hẹn");
    await saveEdit(page, edit);
    row = page.locator("tbody tr", { hasText: reason }).first();
    await expect(row).toContainText("Trễ hẹn");

    // Stored: still late after a reload, and the select says so.
    await page.reload();
    row = await findRow(page, reason);
    await expect(row).toContainText("Trễ hẹn");
    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    await expect(edit).toBeVisible();
    await expect(status(edit)).toContainText("Trễ hẹn");
    expect(await openStatusOptions(page, edit)).toEqual(["Đã hẹn", "Đã huỷ", "Trễ hẹn"]);
    await chooseStatus(page, "Trễ hẹn");

    // Changing only the wording keeps it late: a save must not re-book it.
    await edit.getByPlaceholder("Nội dung đặt lịch").fill(`${reason} sửa`);
    await saveEdit(page, edit);
    row = page.locator("tbody tr", { hasText: reason }).first();
    await expect(row).toContainText(`${reason} sửa`);
    await expect(row).toContainText("Trễ hẹn");

    // Đã huỷ goes through the same save, and sticks.
    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    await expect(edit).toBeVisible();
    await openStatusOptions(page, edit);
    await chooseStatus(page, "Đã huỷ");
    await saveEdit(page, edit);
    await expect(page.locator("tbody tr", { hasText: reason }).first()).toContainText("Đã huỷ");

    // And a cancelled one goes back on the book from the same select.
    await page.reload();
    row = await findRow(page, reason);
    await expect(row).toContainText("Đã huỷ");
    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    await expect(edit).toBeVisible();
    await expect(status(edit)).toContainText("Đã huỷ");
    expect(await openStatusOptions(page, edit)).toEqual(["Đã hẹn", "Đã huỷ", "Trễ hẹn"]);
    await chooseStatus(page, "Đã hẹn");
    await saveEdit(page, edit);
    await expect(page.locator("tbody tr", { hasText: reason }).first()).toContainText("Đã hẹn");

    await page.reload();
    row = await findRow(page, reason);
    await expect(row).toContainText("Đã hẹn");
  });
});
