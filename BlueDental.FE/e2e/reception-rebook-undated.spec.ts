import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, dayOf, getAppointment, openBoard } from "./fixtures/receptionBoard";

/**
 * Feature: "Hẹn lại - Chưa chốt ngày" (owner, 2026-10-09, save/P0910_3.drawio).
 *
 * - The "Chọn lịch hẹn tiếp theo" panel of "Đã hẹn tiếp" / "Hẹn tái khám" has
 *   a button that skips the required day and time: the outcome is saved with
 *   no next appointment, the card keeps "Cần chọn ngày giờ hẹn".
 * - The visit is filed on the CSKH tab of the same name, its booking note as
 *   Nội dung hẹn; saving again keeps the one task.
 * - The date can still be booked from the card later.
 * - "Lịch hẹn sắp tới" never shows the visit itself — these visits are booked
 *   later today, so their own slot is still to come.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const CARE = "/api/v1/app/care-records";
const CARE_TYPE_UNDATED = 11;
const STATUS = { InProgress: 4 } as const;
const OUTCOME = { FollowUp: 2, Revisit: 4 } as const;

interface CareRow {
  id: string;
  type: number;
  status: number;
  subject: string;
  appointmentId: string | null;
  assignedStaffId: string | null;
  nextAppointmentAt: string | null;
}

const outcome = (card: Locator, name: string | RegExp) =>
  card.locator(".rc-col-actions").getByRole("button", { name });

/** The undated-rebook care tasks of one visit, read back through the board's own list API. */
async function careTasksOf(page: Page, branchId: string, visit: { id: string; patientId: string }) {
  const today = dayOf(new Date());
  const res = await call<{ items: CareRow[] }>(
    page,
    branchId,
    `${CARE}?type=${CARE_TYPE_UNDATED}&patientId=${visit.patientId}&fromDate=${today}T00:00:00&toDate=${today}T23:59:59&MaxResultCount=100`,
  );
  expect(res.status).toBe(200);
  return res.body.items.filter((r) => r.appointmentId === visit.id);
}

test.describe("Tiếp nhận — Hẹn lại - Chưa chốt ngày", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
  });

  test("saves Đã hẹn tiếp without a date, files it on CSKH, and the date can be booked later", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 200, "e2e-henlai");
    const card = await cardOf(page, visit);
    const followUp = outcome(card, /Đã hẹn tiếp/);
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    await followUp.click();
    await expect(panel.getByRole("button", { name: "Xác nhận hẹn tiếp" })).toBeDisabled();
    const undated = panel.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" });
    // No day, no time: the required fields do not hold it back.
    await expect(undated).toBeEnabled();

    const note = `E2E hẹn lại ${runId()}`;
    await panel.getByRole("textbox").fill(note);
    const saved = page.waitForResponse((r) => r.url().includes(`/${visit.id}/rebook-undated`));
    await undated.click();
    expect((await saved).status()).toBe(200);
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("Đã lưu hẹn lại, chuyển CSKH chốt ngày")).toBeVisible();

    let stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.FollowUp);
    expect(stored.followUpAppointmentId).toBeNull();
    expect(stored.followUpAt).toBeNull();
    await expect(followUp).toHaveAttribute("aria-pressed", "true");
    await expect(followUp).toContainText("Cần chọn ngày giờ hẹn");
    await expect(outcome(card, "Kết thúc điều trị")).toBeDisabled();

    let tasks = await careTasksOf(page, branchId, visit);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subject).toBe(note);
    expect(tasks[0].assignedStaffId).toBe(visit.dentistId);
    expect(tasks[0].status).toBe(1);
    expect(tasks[0].nextAppointmentAt).toBeNull();

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(outcome(reloaded, /Đã hẹn tiếp/)).toHaveAttribute("aria-pressed", "true");
    await expect(outcome(reloaded, /Đã hẹn tiếp/)).toContainText("Cần chọn ngày giờ hẹn");

    // Saved again with a new note: still one task, carrying the new note.
    const secondNote = `${note} lần 2`;
    await outcome(reloaded, /Đã hẹn tiếp/).click();
    const reopened = reloaded.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await reopened.getByRole("textbox").fill(secondNote);
    await reopened.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" }).click();
    await expect(reopened).toBeHidden({ timeout: 10_000 });
    tasks = await careTasksOf(page, branchId, visit);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subject).toBe(secondNote);

    // CSKH › Hẹn lại - Chưa chốt ngày lists it for today, after Nhắc lịch hẹn.
    await page.goto(`/cskh-grouping?tab=care&page=undated-rebook&care_dateMode=day&care_date=${dayOf(new Date())}`);
    await assertRealApiTraffic(page, `${CARE}/stats`);
    const tab = page.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày", exact: true });
    await expect(tab).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Nội dung hẹn", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ngày ghi nhận", exact: true })).toBeVisible();
    const listed = page.waitForResponse(
      (r) => r.url().includes(`${CARE}?`) && r.url().includes("filter=") && r.request().method() === "GET",
    );
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(visit.patientCode ?? visit.patientName);
    await listed;
    const row = page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: secondNote });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row.locator(".cskh-contact-select")).toContainText("Chưa liên hệ");
    await expect(row).toContainText("Chưa có lịch");

    // The date is fixed later from the same card: the follow-up books normally.
    await openBoard(page);
    const again = await cardOf(page, visit);
    await outcome(again, /Đã hẹn tiếp/).click();
    const picker = again.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await picker.getByRole("button", { name: /^\+1 tuần/ }).click();
    await picker.getByRole("button", { name: "Xác nhận hẹn tiếp" }).click();
    await expect(picker).toBeHidden({ timeout: 10_000 });
    stored = await getAppointment(page, branchId, visit.id);
    expect(stored.followUpAt).toBeTruthy();
    // Now the task reads as rebooked, with the follow-up — not the visit — as next.
    tasks = await careTasksOf(page, branchId, visit);
    expect(new Date(tasks[0].nextAppointmentAt ?? 0).getTime()).toBe(new Date(stored.followUpAt!).getTime());

    // A booked follow-up cannot be turned back into an undated one.
    const refused = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.FollowUp },
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.status).toBeLessThan(500);
  });

  test("Hẹn tái khám without a date moves the bar like a booked one", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 230, "e2e-henlai");
    const card = await cardOf(page, visit);
    const revisit = outcome(card, "Hẹn tái khám");

    await revisit.click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await panel.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });

    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.Revisit);
    expect(stored.status).toBe(STATUS.InProgress);
    expect(stored.followUpAt).toBeNull();
    await expect(revisit).toHaveAttribute("aria-pressed", "true");
    await expect(revisit).toContainText("Cần chọn ngày giờ hẹn");

    const tasks = await careTasksOf(page, branchId, visit);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subject).toBe("Hẹn lại - Chưa chốt ngày");
  });

  test("the server refuses a note longer than the care task holds", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 260, "e2e-henlai");

    const refused = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.FollowUp, note: "x".repeat(301) },
    });
    expect(refused.status).toBe(400);
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();
    expect(await careTasksOf(page, branchId, visit)).toHaveLength(0);
  });
});
