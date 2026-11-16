import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday } from "./fixtures/timekeepingStaff";
import { openBlockEditor } from "./fixtures/calendarBlock";

/**
 * R-1240 (BA 2026-11-16): "Màu lịch hẹn" is gone; "Gán sao" puts one of four
 * stars (tím / xanh lá / cam / đỏ) before the patient's name on the calendar.
 * No checkbox: a click on a star assigns it, a second click takes it off.
 * Old bookings keep their colour in the database but show no star.
 *
 * Real stack: booked through the dialog and the API, read back after a
 * reload. Nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  patientName: string;
  star: string | null;
  color: string | null;
}

interface ApiError {
  error?: { code?: string };
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

async function openDay(page: Page, day: string): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  await expect(page.locator(".dtl-col").first()).toBeVisible();
}

test.describe("Lịch hẹn — Gán sao", () => {
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

  async function walkIn(page: Page, day: string, name: string): Promise<Booking> {
    const res = await call<{ items: Booking[] }>(page, `${APPOINTMENTS}?date=${day}&MaxResultCount=200`, { branchId });
    expect(res.status).toBe(200);
    const found = res.body.items.filter((b) => b.patientName === name);
    expect(found).toHaveLength(1);
    return found[0];
  }

  test("a star picked in Tạo lịch tạm shows before the name, survives a reload, and a second click takes it off", async ({ page }) => {
    const day = farDay();
    const name = `E2E SAO ${runId()}`;

    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    // No colour swatches and no checkbox — four star buttons, none pressed.
    await expect(dialog.getByRole("checkbox", { name: "Gán sao" })).toHaveCount(0);
    await expect(dialog.getByRole("group", { name: "Gán sao" }).getByRole("button")).toHaveCount(4);
    await expect(dialog.getByRole("button", { pressed: true })).toHaveCount(0);

    await dialog.getByPlaceholder("Họ tên bệnh nhân").fill(name);
    await typeDate(dialog, day);
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("09:00");
    await time.press("Enter");

    // Pick tím, change mind to đỏ: only one is ever pressed.
    const purple = dialog.getByRole("button", { name: "Sao tím" });
    const red = dialog.getByRole("button", { name: "Sao đỏ" });
    await purple.click();
    await red.click();
    await expect(red).toHaveAttribute("aria-pressed", "true");
    await expect(purple).toHaveAttribute("aria-pressed", "false");

    const saved = page.waitForResponse((r) => r.url().includes(`${APPOINTMENTS}/temp`) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    const booking = await walkIn(page, day, name);
    bookings.push(booking.id);
    expect(booking.star).toBe("red");

    await openDay(page, day);
    const block = page.locator(".dtl-col--unassigned .dtl-block").filter({ hasText: name });
    const label = block.locator(".dtl-block-label");
    // Before the name: the label's first child.
    await expect(label.locator(":scope > :first-child")).toHaveAccessibleName("Sao đỏ");
    await expect(label.getByRole("img", { name: "Sao đỏ" })).toBeVisible();

    await page.reload();
    await expect(label.getByRole("img", { name: "Sao đỏ" })).toBeVisible();

    // The editor opens on the saved star; clicking it again takes it off.
    await openBlockEditor(page, block);
    const edit = page.getByRole("dialog", { name: "Chỉnh sửa lịch tạm" });
    const editRed = edit.getByRole("button", { name: "Sao đỏ" });
    await expect(editRed).toHaveAttribute("aria-pressed", "true");
    await editRed.click();
    await expect(edit.getByRole("button", { pressed: true })).toHaveCount(0);
    const put = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "PUT");
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();

    await expect(label.getByRole("img")).toHaveCount(0);
    await page.reload();
    await expect(block).toBeVisible();
    await expect(label.getByRole("img")).toHaveCount(0);
    expect((await walkIn(page, day, name)).star).toBeNull();
  });

  test("the API keeps only the four stars, and an old coloured booking shows no star", async ({ page }) => {
    const day = farDay();
    const slot = { branchId, slotStart: at(day, "10:00"), slotEnd: at(day, "10:30") };

    const gold = await call<ApiError>(page, `${APPOINTMENTS}/temp`, {
      method: "POST",
      branchId,
      json: { ...slot, patientName: `E2E SAO VANG ${runId()}`, star: "gold" },
    });
    expect(gold.status).not.toBe(200);
    expect(gold.body.error?.code).toBe("BlueDental:Appointment:0021");

    const orangeName = `E2E SAO CAM ${runId()}`;
    const orange = await call<Booking>(page, `${APPOINTMENTS}/temp`, {
      method: "POST",
      branchId,
      json: { ...slot, patientName: orangeName, star: " Orange " },
    });
    expect(orange.status, JSON.stringify(orange.body)).toBe(200);
    bookings.push(orange.body.id);
    expect((await walkIn(page, day, orangeName)).star).toBe("orange");

    // Booked before R-1240 with a colour: the colour stays stored, no star shows.
    const oldName = `E2E MAU CU ${runId()}`;
    const old = await call<Booking>(page, `${APPOINTMENTS}/temp`, {
      method: "POST",
      branchId,
      json: { ...slot, slotStart: at(day, "11:00"), slotEnd: at(day, "11:30"), patientName: oldName, color: "#EF4444" },
    });
    expect(old.status, JSON.stringify(old.body)).toBe(200);
    bookings.push(old.body.id);
    const stored = await walkIn(page, day, oldName);
    expect(stored.star).toBeNull();
    expect(stored.color).toBe("#EF4444");

    await openDay(page, day);
    const col = page.locator(".dtl-col--unassigned");
    await expect(col.locator(".dtl-block").filter({ hasText: orangeName }).getByRole("img", { name: "Sao cam" })).toBeVisible();
    const oldBlock = col.locator(".dtl-block").filter({ hasText: oldName });
    await expect(oldBlock).toBeVisible();
    await expect(oldBlock.locator(".dtl-block-label").getByRole("img")).toHaveCount(0);
  });
});
