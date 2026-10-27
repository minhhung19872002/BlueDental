import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday } from "./fixtures/timekeepingStaff";

/**
 * R-1046 (owner 2026-10-27): Tạo / Chỉnh sửa lịch tạm has "Nội dung đặt lịch"
 * under Chọn bác sĩ, as Tạo lịch hẹn does. It is saved as the booking's
 * chiefComplaint, shows on view Ngày like any booking's content, and an edit
 * keeps it — before, saving the edit dialog wiped it.
 *
 * R-1055 (owner 2026-10-27): the right column's read-only Ngày hẹn echo and
 * Ghi chú are gone; Nội dung đặt lịch moved there, under Chi nhánh. A booking
 * saved earlier with a Ghi chú keeps it through an edit.
 *
 * Real stack: the walk-in is booked through the dialog and the API, read back
 * from the server after a reload. Nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  patientName: string;
  chiefComplaint: string | null;
  notes: string | null;
  isTemporary: boolean;
}

/** A day years out, so the run's walk-in is alone in "Chưa chọn bác sĩ". */
function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

/** "2031-04-17" → "17/04/2031". */
function vnDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  return (await request).headers()["x-clinic-branch-id"];
}

/** Mask mode: fill() is ignored, so type the digits. */
async function typeDate(dialog: Locator, day: string): Promise<void> {
  const input = dialog.locator(".appt-field").filter({ hasText: /^Ngày hẹn/ }).getByPlaceholder("Chọn thời điểm");
  await input.click({ position: { x: 4, y: 8 } });
  await input.pressSequentially(vnDate(day).replace(/\D/g, ""));
  await input.press("Enter");
  await expect(input).toHaveValue(vnDate(day));
}

/** Opens view Ngày on `day` and waits for that day's bookings to arrive. */
async function openDay(page: Page, day: string): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  await expect(page.locator(".dtl-col").first()).toBeVisible();
}

test.describe("Lịch tạm — Nội dung đặt lịch", () => {
  let branchId: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    await assertRealApiTraffic(page, APPOINTMENTS);
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
  });

  async function walkInsOn(page: Page, day: string, name: string): Promise<Booking[]> {
    const res = await call<{ items: Booking[] }>(page, `${APPOINTMENTS}?date=${day}&MaxResultCount=200`, { branchId });
    expect(res.status).toBe(200);
    return res.body.items.filter((b) => b.patientName === name);
  }

  test("Tạo lịch tạm saves Nội dung đặt lịch, under Chi nhánh, and view Ngày shows it", async ({ page }) => {
    const day = farDay();
    const name = `E2E TAM ND ${runId()}`;
    const content = `Nhổ răng khôn ${runId()}`;

    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    const field = dialog.getByPlaceholder("Nội dung đặt lịch");
    await expect(field).toHaveValue("");
    // R-1055: in the right column, labelled, straight under Chi nhánh — where Ngày hẹn's echo was.
    // `has` takes a locator rooted at the page, not one chained from `dialog`.
    const contentField = dialog.locator(".appt-field").filter({ has: page.getByPlaceholder("Nội dung đặt lịch") });
    await expect(contentField.locator(".appt-field-label")).toHaveText("Nội dung đặt lịch");
    const branch = await dialog.locator(".appt-field").filter({ hasText: /^Chi nhánh/ }).boundingBox();
    const box = await field.boundingBox();
    if (!branch || !box) throw new Error("Chi nhánh or Nội dung đặt lịch is not on screen");
    expect(Math.abs(box.x - branch.x)).toBeLessThan(2);
    expect(box.y).toBeGreaterThan(branch.y + branch.height - 1);
    // One Ngày hẹn (the picker on the left), and no Ghi chú at all.
    await expect(dialog.locator(".appt-field").filter({ hasText: /^Ngày hẹn/ })).toHaveCount(1);
    await expect(dialog.getByPlaceholder("Ghi chú")).toHaveCount(0);
    await expect(dialog.getByText("Ghi chú", { exact: true })).toHaveCount(0);

    await dialog.getByPlaceholder("Họ tên bệnh nhân").fill(name);
    await typeDate(dialog, day);
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("09:00");
    await time.press("Enter");
    await field.fill(content);

    const saved = page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}/temp`) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    const [booking, ...others] = await walkInsOn(page, day, name);
    expect(others).toHaveLength(0);
    bookings.push(booking.id);
    expect(booking.isTemporary).toBe(true);
    expect(booking.chiefComplaint).toBe(content);

    await openDay(page, day);
    const block = page.locator(".dtl-col--unassigned .dtl-block").filter({ hasText: name });
    await expect(block.locator(".dtl-block-note")).toHaveText(content);
  });

  test("Chỉnh sửa lịch tạm shows Nội dung đặt lịch, saves a change, and keeps it and an old Ghi chú when only the colour changes", async ({ page }) => {
    const day = farDay();
    const name = `E2E TAM SUA ${runId()}`;
    const content = `Tư vấn niềng ${runId()}`;
    // Saved before R-1055, when the dialog still had Ghi chú.
    const oldNote = `ghi chú cũ ${runId()}`;
    const res = await call<Booking>(page, `${APPOINTMENTS}/temp`, {
      method: "POST",
      branchId,
      json: { patientName: name, branchId, slotStart: at(day, "10:00"), slotEnd: at(day, "10:30"), chiefComplaint: content, notes: oldNote },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    bookings.push(res.body.id);

    await openDay(page, day);
    const block = page.locator(".dtl-col--unassigned .dtl-block").filter({ hasText: name });
    await block.click();
    const edit = page.getByRole("dialog", { name: "Chỉnh sửa lịch tạm" });
    const field = edit.getByPlaceholder("Nội dung đặt lịch");
    // The form is reset once the booking arrives; type only after that.
    await expect(field).toHaveValue(content);

    // No Ghi chú to edit. Only the colour changes: content and the old note must survive the save.
    await expect(edit.getByPlaceholder("Ghi chú")).toHaveCount(0);
    await edit.locator(".appt-color-swatch:not(.appt-color-swatch--selected)").first().click();
    let put = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "PUT");
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();
    const [kept] = await walkInsOn(page, day, name);
    expect(kept.chiefComplaint).toBe(content);
    expect(kept.notes).toBe(oldNote);

    // Changed: saved, shown on the board, and still there after a reload.
    const updated = `Đã sửa ${runId()}`;
    await block.click();
    await expect(field).toHaveValue(content);
    await field.fill(updated);
    put = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "PUT");
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();
    await expect(block.locator(".dtl-block-note")).toHaveText(updated);

    await page.reload();
    await expect(block.locator(".dtl-block-note")).toHaveText(updated);
    expect((await walkInsOn(page, day, name))[0].chiefComplaint).toBe(updated);
  });
});
