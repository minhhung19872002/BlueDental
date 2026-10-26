import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import {
  APPOINTMENTS,
  bookVisitToday,
  call,
  cardOf,
  getAppointment,
  openBoard,
  type Appointment,
} from "./fixtures/receptionBoard";

/**
 * R-1034 — a visit that arrived never turns Trễ hẹn (prod, DH260035): the
 * patient was checked in at 11:12 for 11:15, cancelled by mistake a few
 * seconds later, then put back from the edit dialog — back to Đã hẹn, with
 * its arrival time kept — and the worker marked it Trễ hẹn at 11:15.
 *
 * Now putting back a visit that arrived returns it to Đã đến (Đang khám if it
 * had started) with its arrival time, the edit dialog offers it Đã đến and
 * Đã huỷ only, and the server refuses Trễ hẹn for it whatever the path.
 *
 * Real stack: the board, the patient's Lịch hẹn tab and its edit dialog are
 * real pages, the worker is the real one, nothing is intercepted.
 */

const CHECKED_IN = 3;
const IN_PROGRESS = 4;
const CANCELLED = 6;
const NO_SHOW = 7;
const ARRIVED_CANNOT_BE_LATE = "BlueDental:Appointment:0016";
/** The worker runs every 15 seconds; two passes after the start time. */
const WORKER_PASSES_MS = 35_000;

type Visit = Appointment & { searchKey: string };

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

async function cancelOnBoard(page: Page, card: Locator) {
  await card.getByRole("button", { name: "Hủy lịch" }).click();
  const dialog = page.getByRole("dialog", { name: "Huỷ lịch hẹn" });
  await dialog.getByPlaceholder("Nhập lý do huỷ...").fill("e2e bấm nhầm");
  await dialog.getByRole("button", { name: /Xác nhận huỷ/ }).click();
  await expect(dialog).toBeHidden();
}

/** The visit's row on its patient's Lịch hẹn tab, edit dialog open. */
async function openEditDialog(page: Page, visit: Visit) {
  await page.goto(`/patient/${visit.patientId}?tab=appointment`);
  const row = page.locator(".pd-appointment-tab tbody tr", { hasText: visit.searchKey }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Chỉnh sửa lịch hẹn" }).click();
  const dialog = page.getByRole("dialog", { name: "Cập nhật lịch hẹn" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function statusOptions(page: Page, dialog: Locator) {
  await dialog.locator(".appt-status-select").click();
  const options = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
  await expect(options.first()).toBeVisible();
  return (await options.allInnerTexts()).map((text) => text.trim());
}

async function chooseAndSave(page: Page, dialog: Locator, label: string) {
  await page.locator(`.ant-select-dropdown:visible .ant-select-item-option[title="${label}"]`).click();
  const updated = page.waitForResponse(
    (res) => res.url().includes(`${APPOINTMENTS}/`) && res.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  expect((await updated).ok()).toBeTruthy();
  await expect(dialog).toBeHidden();
}

/** The edit dialog's own save, asking for `status` — what a stale client or another caller could send. */
const putStatus = (page: Page, branchId: string, visit: Visit, status: number) =>
  call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}`, {
    method: "PUT",
    json: {
      slotStart: visit.slotStart,
      slotEnd: visit.slotEnd,
      dentistId: visit.dentistId,
      chiefComplaint: visit.searchKey,
      status,
    },
  });

test.describe("Tiếp nhận — đã đến thì không thành Trễ hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("arrived, cancelled by mistake, put back from the edit dialog: Đã đến with its arrival time, never Trễ hẹn", async ({
    page,
  }) => {
    test.setTimeout(15 * 60_000);
    const branchId = await openBoard(page);
    // Starts within the minute (or a few slots later when every dentist is
    // booked), so its time passes while the test watches.
    const visit = await bookVisitToday(page, branchId, 1, "e2e-r1034");
    const card = await cardOf(page, visit);

    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect.poll(async () => (await getAppointment(page, branchId, visit.id)).status).toBe(CHECKED_IN);
    const arrivedAt = (await getAppointment(page, branchId, visit.id)).checkedInAt!;
    await cancelOnBoard(page, card);
    expect((await getAppointment(page, branchId, visit.id)).status).toBe(CANCELLED);

    // The cancelled visit is offered Đã đến and Đã huỷ — no Đã hẹn, no Trễ hẹn.
    let dialog = await openEditDialog(page, visit);
    await expect(dialog.locator(".appt-status-select")).toContainText("Đã huỷ");
    expect(await statusOptions(page, dialog)).toEqual(["Đã đến", "Đã huỷ"]);
    await chooseAndSave(page, dialog, "Đã đến");

    let stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(CHECKED_IN);
    expect(stored.checkedInAt).toBe(arrivedAt);
    expect(stored.cancelledAt).toBeNull();

    // Its time passes and the worker runs: still Đã đến.
    const due = new Date(visit.slotStart).getTime() + WORKER_PASSES_MS;
    await page.waitForTimeout(Math.max(0, due - Date.now()));
    stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(CHECKED_IN);
    expect(stored.checkedInAt).toBe(arrivedAt);

    // The board shows it arrived at the old time, after a reload too.
    for (let pass = 0; pass < 2; pass++) {
      await openBoard(page);
      const restored = await cardOf(page, visit);
      await expect(restored.locator(".rc-badge")).not.toHaveText(/Trễ hẹn|Huỷ hẹn/);
      await expect(restored.locator(".rc-step-time").first()).toHaveText(hhmm(arrivedAt));
      await expect(restored.locator(".rc-wait-chip")).toHaveCount(1);
      if (pass === 0) await page.reload();
    }

    // An arrived visit opens on Đã đến and still has no Trễ hẹn to pick.
    dialog = await openEditDialog(page, visit);
    await expect(dialog.locator(".appt-status-select")).toContainText("Đã đến");
    expect(await statusOptions(page, dialog)).toEqual(["Đã đến", "Đã huỷ"]);
  });

  test("a visit cancelled in the chair goes back to Đang khám", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 200, "e2e-r1034-kham");
    expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" })).status).toBe(200);
    expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/start`, { method: "POST", json: {} })).status).toBe(200);
    const started = await getAppointment(page, branchId, visit.id);
    const cancel = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/cancel`, {
      method: "POST",
      json: { reason: 6, note: "e2e bấm nhầm" },
    });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);

    const dialog = await openEditDialog(page, visit);
    expect(await statusOptions(page, dialog)).toEqual(["Đã đến", "Đã huỷ"]);
    await chooseAndSave(page, dialog, "Đã đến");

    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(IN_PROGRESS);
    expect(stored.checkedInAt).toBe(started.checkedInAt);
    expect(stored.startedAt).toBe(started.startedAt);
  });

  test("the server refuses Trễ hẹn for a visit that arrived, cancelled or not", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 210, "e2e-r1034-api");
    expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" })).status).toBe(200);

    const whileArrived = await putStatus(page, branchId, visit, NO_SHOW);
    expect(whileArrived.body.error?.code).toBe(ARRIVED_CANNOT_BE_LATE);
    const byEndpoint = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/no-show`, { method: "POST" });
    expect(byEndpoint.body.error?.code).toBe(ARRIVED_CANNOT_BE_LATE);
    expect((await getAppointment(page, branchId, visit.id)).status).toBe(CHECKED_IN);

    await call(page, branchId, `${APPOINTMENTS}/${visit.id}/cancel`, { method: "POST", json: { reason: 6, note: "e2e" } });
    const whileCancelled = await putStatus(page, branchId, visit, NO_SHOW);
    expect(whileCancelled.body.error?.code).toBe(ARRIVED_CANNOT_BE_LATE);
    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(CANCELLED);
    expect(stored.cancelledAt).not.toBeNull();
  });

  test("a visit that never came still goes back to Đã hẹn and still turns Trễ hẹn", async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 1, "e2e-r1034-chua");
    await cancelOnBoard(page, await cardOf(page, visit));

    const dialog = await openEditDialog(page, visit);
    expect(await statusOptions(page, dialog)).toEqual(["Đã hẹn", "Đã huỷ", "Trễ hẹn"]);
    await chooseAndSave(page, dialog, "Đã hẹn");
    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBeLessThanOrEqual(2);
    expect(stored.checkedInAt).toBeNull();

    const due = new Date(visit.slotStart).getTime();
    await page.waitForTimeout(Math.max(0, due - Date.now()));
    await expect
      .poll(async () => (await getAppointment(page, branchId, visit.id)).status, { timeout: WORKER_PASSES_MS + 15_000 })
      .toBe(NO_SHOW);
  });
});
