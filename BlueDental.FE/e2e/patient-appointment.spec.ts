import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

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
async function chooseSlot(dialog: ReturnType<Page["getByRole"]>, day: string, time: string) {
  const date = dialog.getByPlaceholder("Chọn thời điểm");
  await date.fill(day);
  await date.press("Enter");

  const clock = dialog.getByPlaceholder("HH:mm");
  await clock.fill(time);
  await clock.press("Enter");
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
 * A day far enough out that the seed data has nothing on it, and different on
 * every run so a re-run does not collide with the appointment the last one
 * left behind — the server rejects a double booking, correctly.
 */
function freeDay(runSuffix: string, offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + 400 + (Number(runSuffix) % 300) + offsetDays);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

test.describe("Lịch hẹn của bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the tab fills the screen and keeps the pager on the card's bottom edge", async ({
    page,
  }) => {
    await openAppointmentTab(page);

    const card = page.locator(".pd-pane .bd-cat-card");
    await expect(card).toBeVisible();

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
    await chooseSlot(dialog, freeDay(id, 1), "08:15");
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
    const row = page.locator("tbody tr", { hasText: reason });
    await expect(row).toBeVisible();
    await expect(row).toContainText(note);
    await expect(row).toContainText(doctorName);
  });

  test("editing an appointment updates it instead of booking a second one", async ({ page }) => {
    const id = runId();
    const reason = `E2E sửa ${id}`;

    await openAppointmentTab(page);
    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
    const create = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await chooseSlot(create, freeDay(id, 2), "09:45");
    await pickFirstDoctor(page);
    await create.getByPlaceholder("Nội dung đặt lịch").fill(reason);
    await create.getByRole("button", { name: "Lưu" }).click();
    await expect(create).toBeHidden();

    const row = page.locator("tbody tr", { hasText: reason });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    const edit = page.getByRole("dialog", { name: "Chỉnh sửa lịch hẹn" });
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
    // second appointment instead of updating the first would match twice here.
    await page.reload();
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
});
