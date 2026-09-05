import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: "Lịch sử thay đổi" — the change log behind a patient's Lịch hẹn tab.
 *
 * Real stack throughout. The rows the dialog shows are written server-side by
 * AppointmentAppService on every save, so the test books and edits through the
 * real dialog and then reads the log back through the real API. Nothing is
 * intercepted: a change the recorder misses is a failure here.
 */

const LOG_URL = "/api/v1/app/appointment-change-log";

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

async function chooseSlot(dialog: ReturnType<Page["getByRole"]>, day: string, time: string) {
  const date = dialog.getByPlaceholder("Chọn thời điểm");
  await date.fill(day);
  await date.press("Enter");

  const clock = dialog.getByPlaceholder("HH:mm");
  await clock.fill(time);
  await clock.press("Enter");
}

async function pickFirstDoctor(page: Page) {
  const field = page.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
  await field.getByRole("combobox").click();
  const option = page.locator("#ss-portal-dropdown [role=option]").first();
  await expect(option).toBeVisible();
  await option.click();
}

/** A day with nothing on it, different per run so re-runs do not collide. */
function freeDay(runSuffix: string, offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + 400 + (Number(runSuffix) % 300) + offsetDays);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Books one appointment through the real dialog and returns its reason text. */
async function bookAppointment(page: Page, id: string, offsetDays: number, time: string) {
  const reason = `E2E lịch sử ${id}`;
  await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
  await chooseSlot(dialog, freeDay(id, offsetDays), time);
  await pickFirstDoctor(page);
  await dialog.getByPlaceholder("Nội dung đặt lịch").fill(reason);

  const created = page.waitForResponse(
    (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  expect((await created).ok()).toBeTruthy();
  await expect(dialog).toBeHidden();
  return reason;
}

/**
 * The Lịch hẹn tab pages twenty rows at a time and every run books a few
 * more, so the row just booked is not always on the first page: walk the
 * pager until it shows up.
 */
async function findAppointmentRow(page: Page, reason: string) {
  const row = page.locator(".bd-patient-tablecard tbody tr, tbody tr", { hasText: reason }).first();
  for (let hop = 0; hop < 10; hop += 1) {
    if (await row.isVisible()) {
      return row;
    }
    const next = page.locator(".ant-pagination-next").first();
    if (await next.getAttribute("aria-disabled") === "true") {
      break;
    }
    const loaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "GET",
    );
    await next.click();
    await loaded;
  }
  await expect(row).toBeVisible();
  return row;
}

/** Opens the history dialog and waits for its first real list response. */
/** "DD/MM - DD/MM/YYYY" for the Sunday-to-Saturday week `offset` weeks from today. */
function weekLabel(offset: number): string {
  const sunday = new Date();
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay() + offset * 7);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const two = (n: number) => String(n).padStart(2, "0");
  const dayMonth = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
  return `${dayMonth(sunday)} - ${dayMonth(saturday)}/${saturday.getFullYear()}`;
}

async function openHistory(page: Page) {
  const list = page.waitForResponse(
    (res) => res.url().includes(LOG_URL) && !res.url().includes("/stats") && res.ok(),
  );
  const stats = page.waitForResponse((res) => res.url().includes(`${LOG_URL}/stats`) && res.ok());
  await page.getByRole("button", { name: "Lịch sử thay đổi" }).click();
  await list;
  await stats;

  const dialog = page.getByRole("dialog", { name: /Lịch sử thay đổi lịch hẹn/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Lịch sử thay đổi lịch hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a booking leaves a Tạo mới row with the actor, source and expandable detail", async ({
    page,
  }) => {
    const id = runId();
    await openAppointmentTab(page);
    const reason = await bookAppointment(page, id, 3, "10:15");

    const dialog = await openHistory(page);

    // The reference's structure: title, subtitle, stat cards, filter row, view switch.
    await expect(dialog.getByText("Toàn bộ thao tác CR/Edit/Delete cho bệnh nhân này.")).toBeVisible();
    await expect(dialog.getByTestId("ah-stats")).toBeVisible();
    await expect(dialog.getByTestId("ah-stats").getByText("Tạo mới", { exact: true })).toBeVisible();
    await expect(dialog.getByTestId("ah-filters")).toBeVisible();
    await expect(dialog.getByText("Bảng", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Dòng thời gian", { exact: true })).toBeVisible();

    for (const header of ["Thời gian", "Loại", "Thay đổi", "Before → After", "Trạng thái", "Người", "Nguồn"]) {
      await expect(dialog.getByRole("columnheader", { name: header })).toBeVisible();
    }

    // The newest row is the booking just made: created, by the admin, from the web.
    const first = dialog.locator(".ah-table tbody tr.ant-table-row").first();
    await expect(first).toContainText("Tạo mới");
    await expect(first).toContainText("Web");
    await expect(first.locator(".ah-avatar")).toBeVisible();

    // The chevron opens the detail panel beneath the row, with the diff inside.
    await first.getByRole("button", { name: "Mở rộng" }).click();
    const detail = dialog.getByTestId("ah-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Người thực hiện");
    await expect(detail).toContainText("Thông tin truy cập");
    await expect(detail).toContainText("So sánh trước / sau");
    await expect(detail).toContainText("Các trường bị ảnh hưởng");
    await expect(detail).toContainText(reason);
    await expect(detail.locator(".ah-diff-box--after")).not.toHaveCount(0);

    await first.getByRole("button", { name: "Thu gọn" }).click();
    await expect(detail).toBeHidden();

    await expect(dialog.locator(".ah-footer")).toContainText(/Hiển thị \d+–\d+ trên \d+ lịch sử/);
  });

  test("an edit adds a Cập nhật row whose diff names the field, and the filters hit the server", async ({
    page,
  }) => {
    const id = runId();
    await openAppointmentTab(page);
    const reason = await bookAppointment(page, id, 4, "11:30");

    const row = await findAppointmentRow(page, reason);
    await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
    const edit = page.getByRole("dialog", { name: "Chỉnh sửa lịch hẹn" });
    const updated = `${reason} v2`;
    // The form is reset once the appointment arrives; type only after that.
    await expect(edit.getByPlaceholder("Nội dung đặt lịch")).toHaveValue(reason);
    await edit.getByPlaceholder("Nội dung đặt lịch").fill(updated);
    const put = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments") && res.request().method() === "PUT",
    );
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();

    const dialog = await openHistory(page);

    const first = dialog.locator(".ah-table tbody tr.ant-table-row").first();
    await expect(first).toContainText("Cập nhật");
    // The reference prints the raw field keys in "Thay đổi"; the untouched note
    // must not show up there (null before, empty after is no change).
    await expect(first).toContainText("content");
    await expect(first).not.toContainText("note");
    await expect(first).toContainText(`${reason} → ${updated}`);
    await expect(dialog.getByTestId("ah-stats").getByText("Cập nhật", { exact: true })).toBeVisible();

    // Hành động is a multi-select. Tạo mới alone: the list is re-read with
    // actions=1 and no Cập nhật row survives.
    const rows = dialog.locator(".ah-table tbody tr.ant-table-row");
    const filtered = page.waitForResponse(
      (res) => res.url().includes(LOG_URL) && res.url().includes("actions=1") && res.ok(),
    );
    const actionBox = dialog.locator(".ah-select").first();
    await actionBox.click();
    const menu = page.locator(".ant-select-dropdown:visible");
    await menu.getByText("Tạo mới", { exact: true }).click();
    expect((await filtered).ok()).toBeTruthy();
    await expect(actionBox).toContainText("Tạo mới");
    await expect(rows.filter({ hasText: "Cập nhật" })).toHaveCount(0);
    await expect(rows.first()).toContainText("Tạo mới");

    // Adding Cập nhật keeps Tạo mới: both codes go over the wire and the edit row is back.
    const both = page.waitForResponse(
      (res) =>
        res.url().includes(LOG_URL) &&
        res.url().includes("actions=1") &&
        res.url().includes("actions=2") &&
        res.ok(),
    );
    await menu.getByText("Cập nhật", { exact: true }).click();
    expect((await both).ok()).toBeTruthy();
    // The 160px box shows the first tag and folds the rest into "+n".
    await expect(actionBox).toContainText("+1");
    await expect(rows.first()).toContainText("Cập nhật");
    await expect(rows.filter({ hasText: "Tạo mới" })).not.toHaveCount(0);
    await dialog.locator(".ah-title").click();

    // Xóa lọc brings everything back.
    await dialog.getByRole("button", { name: "Xóa lọc" }).click();
    await expect(dialog.locator(".ah-table tbody tr.ant-table-row").first()).toContainText("Cập nhật");
  });

  test("the timeline groups the same rows by day and opens the detail inline", async ({ page }) => {
    const id = runId();
    await openAppointmentTab(page);
    await bookAppointment(page, id, 5, "14:00");

    const dialog = await openHistory(page);
    await dialog.getByText("Dòng thời gian", { exact: true }).click();

    const timeline = dialog.getByTestId("ah-timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline.locator(".ah-tl-date").first()).toContainText(/\d{2} THÁNG \d{1,2} \d{4}/i);
    await expect(timeline.locator(".ah-tl-count").first()).toContainText(/\d+ mục/);

    const item = timeline.locator(".ah-tl-item").first();
    await expect(item).toContainText("Tạo mới");
    await item.click();
    await expect(item).toHaveAttribute("aria-expanded", "true");
    await expect(timeline.getByTestId("ah-detail")).toBeVisible();

    // No pager here: the footer counts the rows on screen, and the list grows
    // as it is scrolled, one page of 20 per request, until the total is reached.
    const footer = dialog.locator(".ah-footer");
    await expect(footer).toContainText(/Hiển thị \d+ lịch sử/);
    await expect(footer.locator(".ant-pagination")).toHaveCount(0);
    const items = timeline.locator(".ah-tl-item");
    const shown = await items.count();
    await expect(footer).toContainText(`Hiển thị ${shown} lịch sử`);
    const total = Number(await dialog.locator(".ah-stat-value").first().innerText());
    expect(total).toBeGreaterThanOrEqual(shown);
    // Recorded so a run's report says whether the second page was exercised.
    test.info().annotations.push({ type: "timeline", description: `${shown} of ${total} rows on the first page` });
    if (total > shown) {
      const nextPage = page.waitForResponse(
        (res) => res.url().includes(LOG_URL) && res.url().includes(`skipCount=${shown}`) && res.ok(),
      );
      await dialog.locator(".ah-panel-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      expect((await nextPage).ok()).toBeTruthy();
      await expect(items).toHaveCount(Math.min(total, shown * 2));
      await expect(footer).toContainText(`Hiển thị ${Math.min(total, shown * 2)} lịch sử`);
    }

    // Closing and reopening reads the log again; nothing lives in the client.
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).toBeHidden();
    const reopened = await openHistory(page);
    await expect(reopened.locator(".ah-table tbody tr.ant-table-row").first()).toContainText("Tạo mới");
  });

  test("a week with nothing in it shows the quiet bar and the empty card, still full height", async ({
    page,
  }) => {
    const id = runId();
    await openAppointmentTab(page);
    await bookAppointment(page, id, 6, "15:30");

    const dialog = await openHistory(page);
    await expect(dialog.getByTestId("ah-stats")).toContainText("Tổng thao tác");
    await expect(dialog.locator(".ah-table tbody tr.ant-table-row").first()).toContainText("Tạo mới");
    // The history week runs Sunday to Saturday, as on the reference.
    const weekBox = dialog.locator(".ah-week .date-navigator-label");
    await expect(weekBox).toHaveText(weekLabel(0));

    // Every row is stamped with the moment it was written, so next week is empty.
    const nextWeek = page.waitForResponse(
      (res) => res.url().includes(LOG_URL) && !res.url().includes("/stats") && res.ok(),
    );
    await dialog.locator(".ah-filters button").nth(1).click();
    expect((await nextWeek).ok()).toBeTruthy();
    await expect(weekBox).toHaveText(weekLabel(1));

    await expect(dialog.getByTestId("ah-stats")).toHaveText("Chưa có thao tác nào trong khoảng thời gian này.");
    await expect(dialog.locator(".ah-stat")).toHaveCount(0);
    const empty = dialog.getByTestId("ah-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Không có lịch sử thay đổi");
    await expect(empty).toContainText("Thử điều chỉnh khoảng thời gian hoặc bỏ bộ lọc để xem thêm thao tác.");
    await expect(dialog.locator(".ah-panel")).toBeHidden();

    // The dialog keeps its full height with nothing in it.
    const viewport = page.viewportSize();
    const box = await page.locator(".ah-modal .ant-modal-container").boundingBox();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(Math.round(box!.height)).toBe(viewport!.height - 32);

    // Back one week and the rows return.
    await dialog.locator(".ah-filters button").nth(0).click();
    await expect(dialog.locator(".ah-table tbody tr.ant-table-row").first()).toContainText("Tạo mới");
    await expect(dialog.getByTestId("ah-stats")).toContainText("Tổng thao tác");
  });
});
