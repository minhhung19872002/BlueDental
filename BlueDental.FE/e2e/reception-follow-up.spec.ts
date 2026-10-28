import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  APPOINTMENTS,
  bookVisitToday,
  call,
  cardOf,
  dayOf,
  getAppointment,
  openBoard,
  type ApiResult,
  type Appointment,
} from "./fixtures/receptionBoard";
import { createRunStaff, deleteStaff, firstBranchId, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Tiếp nhận — progress bar ↔ outcome, and "Đổi lịch hẹn".
 *
 * - "Đang khám" ticks "Chuyển bác sĩ", and "Chuyển bác sĩ" puts the visit in
 *   the chair; "Hoàn tất" ticks "Kết thúc điều trị", and the reverse.
 * - "Đổi lịch hẹn" opens a picker; the outcome is only saved together with a
 *   real next appointment, whose date then shows under the option.
 *
 * Each test books its own visit for today through the real API, then finds
 * its card with the board's search and drives it in the browser.
 * Nothing is intercepted; every state is re-read from the server.
 */

const STATUS = { Requested: 1, CheckedIn: 3, InProgress: 4, Completed: 5 } as const;
const OUTCOME = { EndTreatment: 1, FollowUp: 2, TransferDoctor: 3, Revisit: 4 } as const;

/** "13:30" → 810. */
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.trim().split(":").map(Number);
  return h * 60 + m;
};

/** 810 → "13:30". */
const hhmmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The outcome options only — the picker's own buttons share their words. */
const outcome = (card: Locator, name: string | RegExp) =>
  card.locator(".rc-col-actions").getByRole("button", { name });

test.describe("Tiếp nhận — tiến trình và kết quả", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the progress bar ticks the matching outcome", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 30);
    const card = await cardOf(page, visit);

    // Arrival alone picks no outcome.
    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(card.getByRole("button", { name: /Đang khám/ })).toBeEnabled();
    await expect(card.locator(".rc-outcome-btn[aria-pressed='true']")).toHaveCount(0);

    await card.getByRole("button", { name: /Đang khám/ }).click();
    await expect(outcome(card, "Chuyển bác sĩ")).toHaveAttribute("aria-pressed", "true");
    let stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.InProgress);
    expect(stored.outcome).toBe(OUTCOME.TransferDoctor);

    await card.getByRole("button", { name: /Hoàn tất/ }).click();
    await expect(outcome(card, "Kết thúc điều trị")).toHaveAttribute("aria-pressed", "true");
    await expect(outcome(card, "Chuyển bác sĩ")).toHaveAttribute("aria-pressed", "false");
    stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.Completed);
    expect(stored.outcome).toBe(OUTCOME.EndTreatment);

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(outcome(reloaded, "Kết thúc điều trị")).toHaveAttribute("aria-pressed", "true");
  });

  test("an outcome moves the progress bar", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 60);
    const card = await cardOf(page, visit);

    await outcome(card, "Chuyển bác sĩ").click();
    await expect(outcome(card, "Chuyển bác sĩ")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await getAppointment(page, branchId, visit.id)).status).toBe(STATUS.InProgress);
    // Still in the chair: "Chuyển bác sĩ" does not finish the visit.
    await expect(card.getByRole("button", { name: /Hoàn tất/ })).toBeEnabled();

    await outcome(card, "Kết thúc điều trị").click();
    await expect(outcome(card, "Kết thúc điều trị")).toHaveAttribute("aria-pressed", "true");
    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.Completed);
    expect(stored.outcome).toBe(OUTCOME.EndTreatment);
  });

  // Owner 2026-10-28: "Đã đến" pressed by mistake is pressed again to take it
  // back, and its time goes — but only while the patient still waits.
  test("Đã đến pressed again takes the arrival back while the patient waits", async ({ page, browser }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 45);
    const card = await cardOf(page, visit);
    const arrived = card.getByRole("button", { name: /Đã đến/ });
    const arrivedTime = card.locator(".rc-step-time").first();

    await arrived.click();
    await expect(arrivedTime).toHaveText(/^\d\d:\d\d$/);
    expect((await getAppointment(page, branchId, visit.id)).status).toBe(STATUS.CheckedIn);

    // Pressed again: back on the book, the arrival time and the wait gone.
    await expect(arrived).toHaveAttribute("title", "Bấm để huỷ Đã đến");
    await arrived.click();
    await expect(arrivedTime).toHaveText("--:--");
    await expect(card.locator(".rc-wait-gap")).toHaveCount(0);
    let stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.Requested);
    expect(stored.checkedInAt).toBeNull();

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(reloaded.locator(".rc-step-time").first()).toHaveText("--:--");

    // Arriving again starts afresh.
    await reloaded.getByRole("button", { name: /Đã đến/ }).click();
    await expect(reloaded.locator(".rc-step-time").first()).toHaveText(/^\d\d:\d\d$/);

    // Another branch cannot take it back.
    const other = await browser.newPage();
    await login(other, BRANCH2_USER);
    const foreign = await other.evaluate(async (url) => {
      const xsrf = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.substring(11);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
      });
      return res.status;
    }, `${APPOINTMENTS}/${visit.id}/undo-check-in`);
    await other.close();
    expect([403, 404]).toContain(foreign);
    expect((await getAppointment(page, branchId, visit.id)).status).toBe(STATUS.CheckedIn);

    // In the chair the arrival stands: the step no longer answers, nor does the server.
    await reloaded.getByRole("button", { name: /Đang khám/ }).click();
    await expect(reloaded.getByRole("button", { name: /Đã đến/ })).toBeDisabled();
    const refused = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/undo-check-in`, { method: "POST" });
    expect(refused.body.error?.code).toBe("BlueDental:Appointment:0003");
    stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.InProgress);
    expect(stored.checkedInAt).toBeTruthy();
  });
});

test.describe("Tiếp nhận — Đổi lịch hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the outcome is saved only with a booked next appointment", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 90);
    const card = await cardOf(page, visit);

    const followUp = outcome(card, /Đổi lịch hẹn/);
    await expect(followUp).toContainText("Cần chọn ngày giờ hẹn");
    await followUp.click();

    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await expect(panel).toBeVisible();
    const confirm = panel.getByRole("button", { name: "Xác nhận đổi lịch hẹn" });
    await expect(confirm).toBeDisabled();

    // Cancelling saves nothing.
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();

    await followUp.click();
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await expect(panel.getByRole("button", { name: /^\+1 tuần/ })).toHaveAttribute("aria-pressed", "true");
    // The quick pick lands on the doctor's first free half hour — read once the
    // bookings are in (Xác nhận waits for them too), or it may still move.
    const pickedStart = panel.locator(".fu-time--start");
    await expect(confirm).toBeEnabled();
    await expect(pickedStart).toHaveText(/^\d\d:\d\d$/);
    const time = (await pickedStart.innerText()).trim();

    // A day picked by hand clears the quick pick: only one is ever active.
    await panel.locator(".fu-day:not([disabled])[aria-pressed='false']").first().click();
    await expect(panel.getByRole("button", { name: /^\+1 tuần/ })).toHaveAttribute("aria-pressed", "false");
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();

    await confirm.click();
    await expect(panel).toBeHidden({ timeout: 10_000 });

    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.FollowUp);
    expect(stored.followUpAppointmentId).toBeTruthy();
    expect(stored.followUpAt).toBeTruthy();

    const next = await getAppointment(page, branchId, stored.followUpAppointmentId!);
    expect(next.patientId).toBe(visit.patientId);
    expect(next.dentistId).toBe(visit.dentistId);
    expect(next.type).toBe(5);
    const nextStart = new Date(next.slotStart);
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    expect(dayOf(nextStart)).toBe(dayOf(inAWeek));
    expect(`${String(nextStart.getHours()).padStart(2, "0")}:${String(nextStart.getMinutes()).padStart(2, "0")}`).toBe(time);

    const label = `${time} ${String(inAWeek.getDate()).padStart(2, "0")}/${String(inAWeek.getMonth() + 1).padStart(2, "0")}/${inAWeek.getFullYear()}`;
    await expect(followUp).toContainText(label);

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(outcome(reloaded, /Đổi lịch hẹn/)).toContainText(label);
    await expect(outcome(reloaded, /Đổi lịch hẹn/)).toHaveAttribute("aria-pressed", "true");
  });

  // The drag tests take a dentist of their own: earlier runs fill the seeded
  // dentists' days, and a booked visit can no longer be picked over.
  test("a range dragged on the timeline, then stretched and nudged, is the one booked", async ({ page }) => {
    const dentist = await runDentist(page, "Keo");
    try {
      await dragStretchAndBook(page, dentist);
    } finally {
      await dropRunDentist(page, dentist.id);
    }
  });

  test("the picked range is moved and stretched by hand, and the wheel zooms the bar", async ({ page }) => {
    const dentist = await runDentist(page, "Doi");
    try {
      await moveStretchAndZoom(page, dentist);
    } finally {
      await dropRunDentist(page, dentist.id);
    }
  });

  // P2710.drawio (owner 2026-10-27): once done, "Đổi lịch hẹn" and "Chuyển bác
  // sĩ" are shut and only "Hẹn tái khám" books the next visit.
  test("Kết thúc điều trị leaves Hẹn tái khám as the only booking, swapped in only once confirmed", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 120);
    const card = await cardOf(page, visit);
    const endTreatment = outcome(card, "Kết thúc điều trị");
    const reschedule = outcome(card, /Đổi lịch hẹn/);
    const transfer = outcome(card, "Chuyển bác sĩ");
    const revisit = outcome(card, "Hẹn tái khám");
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    await endTreatment.click();
    await expect(endTreatment).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await getAppointment(page, branchId, visit.id)).status).toBe(STATUS.Completed);
    await expect(reschedule).toBeDisabled();
    await expect(transfer).toBeDisabled();
    await expect(revisit).toBeEnabled();

    // Opening the picker moves the tick; backing out brings the saved one back.
    await revisit.click();
    await expect(revisit).toHaveAttribute("aria-pressed", "true");
    await expect(endTreatment).toHaveAttribute("aria-pressed", "false");
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    await expect(endTreatment).toHaveAttribute("aria-pressed", "true");
    await expect(revisit).toHaveAttribute("aria-pressed", "false");
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.EndTreatment);

    await revisit.click();
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await panel.getByRole("button", { name: "Xác nhận hẹn tái khám" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(revisit).toHaveAttribute("aria-pressed", "true");
    for (const other of [endTreatment, reschedule, transfer]) await expect(other).toBeDisabled();
    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.Revisit);
    expect(stored.status).toBe(STATUS.Completed);
    expect(stored.followUpAppointmentId).toBeTruthy();

    // The server holds the line too: no "Đổi lịch hẹn" on a finished visit.
    const refused = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.FollowUp },
    });
    expect(refused.body.error?.code).toBe("BlueDental:Appointment:0017");
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.Revisit);
  });

  test("in the chair the card reads Chuyển bác sĩ, shuts Đổi lịch hẹn, and Hẹn tái khám finishes the visit", async ({
    page,
  }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 135);
    const card = await cardOf(page, visit);
    const reschedule = outcome(card, /Đổi lịch hẹn/);
    const revisit = outcome(card, "Hẹn tái khám");
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    // "Đổi lịch hẹn" without a date first: the chair replaces it all the same.
    await reschedule.click();
    await panel.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.FollowUp);

    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(card.getByRole("button", { name: /Đang khám/ })).toBeEnabled();
    await card.getByRole("button", { name: /Đang khám/ }).click();
    await expect(outcome(card, "Chuyển bác sĩ")).toHaveAttribute("aria-pressed", "true");
    await expect(reschedule).toBeDisabled();
    await expect(revisit).toBeEnabled();
    let stored = await getAppointment(page, branchId, visit.id);
    expect(stored.status).toBe(STATUS.InProgress);
    expect(stored.outcome).toBe(OUTCOME.TransferDoctor);

    const refused = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/rebook-undated`, {
      method: "POST",
      json: { outcome: OUTCOME.FollowUp },
    });
    expect(refused.body.error?.code).toBe("BlueDental:Appointment:0017");

    // Hẹn tái khám without a date still finishes the visit, with its time.
    await revisit.click();
    await panel.getByRole("button", { name: "Hẹn lại - Chưa chốt ngày" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.Revisit);
    expect(stored.status).toBe(STATUS.Completed);
    expect(stored.completedAt).toBeTruthy();

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(outcome(reloaded, "Hẹn tái khám")).toHaveAttribute("aria-pressed", "true");
    for (const other of [outcome(reloaded, /Đổi lịch hẹn/), outcome(reloaded, "Kết thúc điều trị"), outcome(reloaded, "Chuyển bác sĩ")]) {
      await expect(other).toBeDisabled();
    }
  });

  test("Hẹn tái khám is saved only with a booked date and then locks the rest", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 150);
    const card = await cardOf(page, visit);
    const revisit = outcome(card, "Hẹn tái khám");
    const followUp = outcome(card, /Đổi lịch hẹn/);
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    await expect(revisit).toContainText("Cần chọn ngày giờ hẹn");
    await revisit.click();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Bắt buộc để chuyển trạng thái sang "Hẹn tái khám"');
    await expect(revisit).toHaveAttribute("aria-pressed", "true");
    await expect(followUp).toBeDisabled();

    // Cancelling saves nothing.
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    await expect(revisit).toHaveAttribute("aria-pressed", "false");
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();

    await revisit.click();
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await panel.getByRole("button", { name: "Xác nhận hẹn tái khám" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });

    const stored = await getAppointment(page, branchId, visit.id);
    expect(stored.outcome).toBe(OUTCOME.Revisit);
    expect(stored.followUpAppointmentId).toBeTruthy();
    // Booked before the chair: the bar moves one step and stops there, so
    // step 2 becomes the last step "Đã hẹn lại" with its time.
    expect(stored.startedAt).toBeTruthy();
    expect(stored.completedAt).toBeNull();
    const next = new Date((await getAppointment(page, branchId, stored.followUpAppointmentId!)).slotStart);
    const pad = (n: number) => String(n).padStart(2, "0");
    const label = `${pad(next.getHours())}:${pad(next.getMinutes())} ${pad(next.getDate())}/${pad(next.getMonth() + 1)}/${next.getFullYear()}`;

    await page.reload();
    const reloaded = await cardOf(page, visit);
    const reloadedRevisit = outcome(reloaded, "Hẹn tái khám");
    await expect(reloadedRevisit).toHaveAttribute("aria-pressed", "true");
    await expect(reloadedRevisit).toContainText(label);
    await expect(reloaded.locator(".rc-step")).toHaveCount(2);
    await expect(reloaded.locator(".rc-step-label").nth(1)).toHaveText("Đã hẹn lại");
    await expect(reloaded.locator(".rc-step-time").nth(1)).toHaveText(/^\d{2}:\d{2}$/);
    await expect(outcome(reloaded, /Đổi lịch hẹn/)).toContainText("Cần chọn ngày giờ hẹn");
    for (const other of [outcome(reloaded, /Đổi lịch hẹn/), outcome(reloaded, "Kết thúc điều trị"), outcome(reloaded, "Chuyển bác sĩ")]) {
      await expect(other).toBeDisabled();
    }
  });

  test("Hẹn tái khám frees the doctor's slot like a cancellation", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 180);
    const slot = { slotStart: visit.slotStart, slotEnd: visit.slotEnd };

    /** Books another patient with the visit's dentist at the visit's time. */
    const bookSameSlot = async () => {
      const patients = await call<{ items: { id: string }[] }>(
        page, branchId, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`,
      );
      let last: ApiResult<Appointment> | undefined;
      for (const p of patients.body.items.filter((x) => x.id !== visit.patientId)) {
        last = await call<Appointment>(page, branchId, APPOINTMENTS, {
          method: "POST",
          json: { patientId: p.id, dentistId: visit.dentistId, branchId, ...slot, type: 2 },
        });
        // Only the patient being booked elsewhere is worth another try.
        if (last.body.error?.code !== "BlueDental:Appointment:0006") return last;
      }
      return last!;
    };

    // Still held while the visit is on the book.
    expect((await bookSameSlot()).body.error?.code).toBe("BlueDental:Appointment:0002");

    const card = await cardOf(page, visit);
    await outcome(card, "Hẹn tái khám").click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await panel.getByRole("button", { name: "Xác nhận hẹn tái khám" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.Revisit);

    // Freed: another patient takes the dentist at that time.
    const taken = await bookSameSlot();
    expect(taken.status, JSON.stringify(taken.body.error)).toBe(200);
    expect(taken.body.dentistId).toBe(visit.dentistId);

    // Moving off Hẹn tái khám takes the slot back even though it is taken now:
    // the visit already happened, and a doubled dentist is only a warning
    // when booking (BA 2026-10-16), never a reason to refuse an outcome.
    const back = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/set-outcome`, {
      method: "POST",
      json: { outcome: OUTCOME.EndTreatment },
    });
    expect(back.status, JSON.stringify(back.body.error)).toBe(200);
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.EndTreatment);
  });

  // Owner 2026-10-28: the picker no longer lets a range onto a booked visit —
  // not by a press, a drag, a stretch, the steppers or the length chips.
  test("the doctor's booked visits are marked and cannot be picked over", async ({ page }) => {
    const dentist = await runDentist(page, "Kin");
    try {
      const branchId = await openBoard(page);
      const visit = await bookVisitToday(page, branchId, 120);
      // The run's dentist holds 08:00–08:30 and 09:30–10:00 a week from now.
      const weekAhead = (h: number, m: number) => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        d.setHours(h, m, 0, 0);
        return d;
      };
      await holdDentist(page, branchId, dentist.id, weekAhead(8, 0), 30, visit.patientId);
      await holdDentist(page, branchId, dentist.id, weekAhead(9, 30), 30, visit.patientId);

      const card = await cardOf(page, visit);
      await outcome(card, /Đổi lịch hẹn/).click();
      const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
      await switchDoctor(page, panel, dentist.name);
      await panel.getByRole("button", { name: /^\+1 tuần/ }).click();

      // Drawn on the morning bar; the quick pick lands on the first free half hour.
      await expect(panel.locator(".fu-booked")).toHaveCount(2);
      const start = panel.locator(".fu-time--start");
      const end = panel.locator(".fu-time--end");
      await expect(start).toHaveText("08:30");
      await expect(end).toHaveText("09:00");

      const morning = panel.getByRole("button", { name: "Chọn khung giờ Buổi sáng" });
      // The mouse only reaches what is on screen.
      await morning.scrollIntoViewIfNeeded();
      const [from, to] = (await panel.locator(".fu-session-range").first().innerText()).split(" – ").map(minutesOf);
      const box = (await morning.boundingBox())!;
      const x = (m: number) => box.x + ((m - from) / (to - from)) * box.width;
      const y = box.y + box.height / 2;
      const dragOnBar = async (fromMinute: number, toMinute: number) => {
        await page.mouse.move(x(fromMinute), y);
        await page.mouse.down();
        await page.mouse.move(x(toMinute), y, { steps: 6 });
        await page.mouse.up();
      };

      // A press on a booked visit picks nothing.
      await page.mouse.click(x(8 * 60 + 10), y);
      await expect(start).toHaveText("08:30");
      // Neither stepper nor chip reaches into one.
      await expect(panel.getByRole("button", { name: "Lùi giờ bắt đầu 15 phút" })).toBeDisabled();
      await expect(panel.getByRole("button", { name: "60 phút" })).toBeEnabled();
      await expect(panel.getByRole("button", { name: "90 phút" })).toBeDisabled();

      // Stretched toward 10:30, the end stops where the next visit begins.
      await dragOnBar(9 * 60, 10 * 60 + 30);
      await expect(end).toHaveText("09:30");

      // Moved past that visit, the range jumps to where it fits whole…
      await dragOnBar(9 * 60, 10 * 60 + 45);
      await expect(start).toHaveText("10:15");
      await expect(end).toHaveText("11:15");
      // …and moved back onto it, it stops against it.
      await dragOnBar(10 * 60 + 45, 9 * 60 + 15);
      await expect(start).toHaveText("10:00");
      await expect(end).toHaveText("11:00");

      // The server itself still only warns about a doubled dentist (a visit
      // booked while the picker was open), and books nothing without a yes.
      const held = weekAhead(8, 0);
      const warned = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/follow-up`, {
        method: "POST",
        json: { dentistId: dentist.id, slotStart: held.toISOString(), slotEnd: new Date(held.getTime() + 30 * 60_000).toISOString() },
      });
      expect(warned.body.error?.code).toBe("BlueDental:Appointment:0002");
      expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();

      await panel.getByRole("button", { name: "Xác nhận đổi lịch hẹn" }).click();
      await expect(panel).toBeHidden({ timeout: 10_000 });
      const stored = await getAppointment(page, branchId, visit.id);
      expect(stored.outcome).toBe(OUTCOME.FollowUp);
      const next = await getAppointment(page, branchId, stored.followUpAppointmentId!);
      expect(next.dentistId).toBe(dentist.id);
      expect(new Date(next.slotStart).getHours()).toBe(10);
      expect(new Date(next.slotStart).getMinutes()).toBe(0);
    } finally {
      await dropRunDentist(page, dentist.id);
    }
  });

  test("a visit gets one live follow-up, and only inside its branch", async ({ page, browser }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 150);

    // Far out and different on every run, so the last run's bookings for the
    // same dentist do not trip the double-booking guard.
    const seed = Number(runId());
    const at = new Date();
    at.setDate(at.getDate() + 200 + (seed % 300));
    // Inside the default shifts (08-12, 13-17): bookings outside them are refused (R-742).
    const hours = [8, 9, 10, 11, 13, 14, 15, 16];
    at.setHours(hours[Math.floor(seed / 300) % hours.length], 30, 0, 0);
    const slot = { slotStart: at.toISOString(), slotEnd: new Date(at.getTime() + 30 * 60_000).toISOString() };

    // Another branch cannot see the visit, let alone book from it.
    const other = await browser.newPage();
    await login(other, BRANCH2_USER);
    const foreign = await other.evaluate(async ({ url, slot }) => {
      const xsrf = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.substring(11);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify(slot),
      });
      return res.status;
    }, { url: `${APPOINTMENTS}/${visit.id}/follow-up`, slot });
    await other.close();
    expect([403, 404]).toContain(foreign);
    expect((await getAppointment(page, branchId, visit.id)).followUpAppointmentId).toBeNull();

    const first = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/follow-up`, { method: "POST", json: slot });
    expect(first.status).toBe(200);
    expect(first.body.outcome).toBe(OUTCOME.FollowUp);

    const later = new Date(at.getTime() + 24 * 3600_000);
    const second = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/follow-up`, {
      method: "POST",
      json: { slotStart: later.toISOString(), slotEnd: new Date(later.getTime() + 30 * 60_000).toISOString() },
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.error?.code).toBe("BlueDental:Appointment:0003");

    // Once the follow-up is cancelled, a new one may replace it.
    const cancelled = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${first.body.followUpAppointmentId}/cancel`, {
      method: "POST",
      json: { reason: 1, note: "e2e" },
    });
    expect(cancelled.status).toBe(200);
    expect((await getAppointment(page, branchId, visit.id)).followUpAt).toBeNull();

    const replaced = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/follow-up`, {
      method: "POST",
      json: { slotStart: later.toISOString(), slotEnd: new Date(later.getTime() + 30 * 60_000).toISOString() },
    });
    expect(replaced.status, JSON.stringify(replaced.body.error)).toBe(200);
    expect(replaced.body.followUpAppointmentId).not.toBe(first.body.followUpAppointmentId);
    expect(new Date(replaced.body.followUpAt!).getTime()).toBe(later.getTime());
  });
});


test.describe("Tiếp nhận — thanh tiến trình khi huỷ hẹn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const cancel = async (page: Page, branchId: string, id: string) => {
    const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${id}/cancel`, {
      method: "POST",
      json: { reason: 1, note: "e2e" },
    });
    expect(res.status, JSON.stringify(res.body.error)).toBe(200);
    expect(res.body.cancelledAt).toBeTruthy();
    return res.body;
  };

  /** Labels and times of the bar, in order. */
  const barOf = async (card: Locator) => ({
    labels: await card.locator(".rc-step-label").allInnerTexts(),
    times: await card.locator(".rc-step-time").allInnerTexts(),
  });

  test("never came: one red Hủy hẹn step with the time it was cancelled", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 200);
    const cancelled = await cancel(page, branchId, visit.id);

    await page.reload();
    const card = await cardOf(page, visit);
    expect(await barOf(card)).toEqual({ labels: ["Huỷ hẹn"], times: [hhmm(cancelled.cancelledAt!)] });
    await expect(card.locator(".rc-step-label").last()).toHaveCSS("color", "rgb(229, 72, 77)");
    await expect(card.locator(".rc-step")).toHaveCount(1);
  });

  test("came and sat in the chair: Đã đến → Đang khám → Hủy hẹn, only the last one red", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 210);
    const card = await cardOf(page, visit);
    await card.getByRole("button", { name: /Đã đến/ }).click();
    await card.getByRole("button", { name: /Đang khám/ }).click();
    await expect.poll(async () => (await getAppointment(page, branchId, visit.id)).status).toBe(STATUS.InProgress);
    const cancelled = await cancel(page, branchId, visit.id);

    await page.reload();
    const reloaded = await cardOf(page, visit);
    const bar = await barOf(reloaded);
    expect(bar.labels).toEqual(["Đã đến", "Đang khám", "Huỷ hẹn"]);
    expect(bar.times[0]).toBe(hhmm(cancelled.checkedInAt!));
    // It did sit in the chair, so step 2 still notes how long it waited.
    const waited = Math.floor((Date.parse(cancelled.startedAt!) - Date.parse(cancelled.checkedInAt!)) / 60_000);
    expect(bar.times[1]).toBe(`${hhmm(cancelled.startedAt!)} · chờ ${waited}p`);
    expect(bar.times[2]).toBe(hhmm(cancelled.cancelledAt!));
    const labels = reloaded.locator(".rc-step-label");
    await expect(labels.nth(0)).not.toHaveCSS("color", "rgb(229, 72, 77)");
    await expect(labels.nth(1)).not.toHaveCSS("color", "rgb(229, 72, 77)");
    await expect(labels.nth(2)).toHaveCSS("color", "rgb(229, 72, 77)");
    // Nothing on a cancelled bar moves it on.
    for (const step of await reloaded.locator(".rc-step").all()) await expect(step).toBeDisabled();
  });

  test("Hẹn tái khám then cancelled: Hủy hẹn takes the place of Đã hẹn lại", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 220);
    const card = await cardOf(page, visit);
    await card.getByRole("button", { name: /Đã đến/ }).click();
    await expect(card.getByRole("button", { name: /Đang khám/ })).toBeEnabled();

    await outcome(card, "Hẹn tái khám").click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await panel.getByRole("button", { name: "Xác nhận hẹn tái khám" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(card.locator(".rc-step-label").nth(1)).toHaveText("Đã hẹn lại");

    const cancelled = await cancel(page, branchId, visit.id);
    await page.reload();
    const reloaded = await cardOf(page, visit);
    expect(await barOf(reloaded)).toEqual({
      labels: ["Đã đến", "Huỷ hẹn"],
      times: [hhmm(cancelled.checkedInAt!), hhmm(cancelled.cancelledAt!)],
    });
  });
});

type RunDentist = RunStaff & { name: string };

/**
 * A dentist for one test alone: nothing booked, the clinic's default hours.
 * Made before the board loads, so its doctor list has them.
 */
async function runDentist(page: Page, tag: string): Promise<RunDentist> {
  const run = `${runId()}${test.info().workerIndex}`;
  const name = `BS ${tag} ${run}`;
  const staff = await createRunStaff(page, await firstBranchId(page), `${tag.toLowerCase()}${run}`, { name, isDentist: true });
  return { ...staff, name };
}

/** Cancels whatever the run's dentist was booked for, then removes them. */
async function dropRunDentist(page: Page, dentistId: string) {
  const branchId = await firstBranchId(page);
  const until = new Date();
  until.setDate(until.getDate() + 40);
  const booked = await call<{ items: Appointment[] }>(
    page, branchId, `${APPOINTMENTS}?dentistId=${dentistId}&fromDate=${dayOf(new Date())}&toDate=${dayOf(until)}&MaxResultCount=200`,
  );
  for (const a of (booked.body.items ?? []).filter((x) => x.status !== 6)) {
    await call(page, branchId, `${APPOINTMENTS}/${a.id}/cancel`, { method: "POST", json: { reason: 1, note: "e2e" } });
  }
  await deleteStaff(page, dentistId);
}

/** Books `dentistId` from `start` for `minutes` with a patient other than `notPatient`. */
async function holdDentist(page: Page, branchId: string, dentistId: string, start: Date, minutes: number, notPatient: string) {
  const patients = await call<{ items: { id: string }[] }>(page, branchId, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`);
  for (const p of patients.body.items.filter((x) => x.id !== notPatient)) {
    const res = await call<Appointment>(page, branchId, APPOINTMENTS, {
      method: "POST",
      json: {
        patientId: p.id,
        dentistId,
        branchId,
        slotStart: start.toISOString(),
        slotEnd: new Date(start.getTime() + minutes * 60_000).toISOString(),
        type: 2,
      },
    });
    if (res.status === 200) return;
  }
  throw new Error("no patient was free to hold the dentist");
}

/** "Đổi bác sĩ" → `name`, through the list's search. */
async function switchDoctor(page: Page, panel: Locator, name: string) {
  await panel.getByRole("button", { name: /Đổi bác sĩ/ }).click();
  const search = page.getByRole("textbox", { name: "Tìm bác sĩ" });
  await search.fill(name);
  await search.press("Enter");
  await expect(panel.locator(".fu-doctor-name")).toContainText(name);
}

/** A visit's "Đổi lịch hẹn" picker, on `dentist`, two weeks out, with nothing picked yet. */
async function pickerTwoWeeksOut(page: Page, dentist: RunDentist, minutesAhead: number) {
  const branchId = await openBoard(page);
  const visit = await bookVisitToday(page, branchId, minutesAhead);
  const card = await cardOf(page, visit);
  await outcome(card, /Đổi lịch hẹn/).click();
  const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
  await switchDoctor(page, panel, dentist.name);
  await panel.getByRole("button", { name: /^\+2 tuần/ }).click();
  // The same day by hand lets the quick pick's half hour go.
  await panel.locator(".fu-day[aria-pressed='true']").click();
  await expect(panel.locator(".fu-time--start")).toHaveText("--:--");

  // The afternoon bar, measured off the shift it is drawn over.
  const afternoon = panel.getByRole("button", { name: "Chọn khung giờ Buổi chiều" });
  await expect(afternoon).toBeVisible();
  // The mouse only reaches what is on screen.
  await afternoon.scrollIntoViewIfNeeded();
  const [from, to] = (await panel.locator(".fu-session-range").nth(1).innerText()).split(" – ").map(minutesOf);
  const box = (await afternoon.boundingBox())!;
  const x = (m: number) => box.x + ((m - from) / (to - from)) * box.width;
  const y = box.y + box.height / 2;
  const dragOnBar = async (fromMinute: number, toMinute: number, nudge = 0) => {
    await page.mouse.move(x(fromMinute) + nudge, y);
    await page.mouse.down();
    await page.mouse.move(x(toMinute) + nudge, y, { steps: 6 });
    await page.mouse.up();
  };
  return { branchId, visit, panel, from, x, y, dragOnBar };
}

async function dragStretchAndBook(page: Page, dentist: RunDentist) {
  const { branchId, visit, panel, dragOnBar } = await pickerTwoWeeksOut(page, dentist, 100);

  await dragOnBar(14 * 60, 15 * 60, 2);
  await expect(panel.locator(".fu-time--start")).toHaveText("14:00");
  await expect(panel.locator(".fu-time--end")).toHaveText("15:00");
  await expect(panel.getByRole("button", { name: "60 phút" })).toHaveAttribute("aria-pressed", "true");

  // 45 phút keeps the start; Từ + moves it a quarter hour on.
  await panel.getByRole("button", { name: "45 phút" }).click();
  await panel.getByRole("button", { name: "Tăng giờ bắt đầu 15 phút" }).click();
  await expect(panel.locator(".fu-summary")).toContainText("14:15 – 14:45 (30 phút)");

  await panel.getByRole("button", { name: "Xác nhận đổi lịch hẹn" }).click();
  await expect(panel).toBeHidden({ timeout: 10_000 });

  const stored = await getAppointment(page, branchId, visit.id);
  expect(stored.outcome).toBe(OUTCOME.FollowUp);
  const next = await getAppointment(page, branchId, stored.followUpAppointmentId!);
  expect(next.dentistId).toBe(dentist.id);
  const start = new Date(next.slotStart);
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  expect(dayOf(start)).toBe(dayOf(inTwoWeeks));
  expect([start.getHours(), start.getMinutes()]).toEqual([14, 15]);
  expect(new Date(next.slotEnd).getTime() - start.getTime()).toBe(30 * 60_000);
}

async function moveStretchAndZoom(page: Page, dentist: RunDentist) {
  const { panel, from, x, y, dragOnBar } = await pickerTwoWeeksOut(page, dentist, 105);
  const start = panel.locator(".fu-time--start");
  const end = panel.locator(".fu-time--end");

  await dragOnBar(14 * 60, 15 * 60, 2);
  await expect(start).toHaveText("14:00");
  await expect(end).toHaveText("15:00");

  // Held by its middle, the range moves and keeps its hour.
  await dragOnBar(14 * 60 + 30, 15 * 60 + 30);
  await expect(start).toHaveText("15:00");
  await expect(end).toHaveText("16:00");

  // Held by an edge, only that end moves.
  await dragOnBar(16 * 60, 16 * 60 + 30);
  await expect(start).toHaveText("15:00");
  await expect(end).toHaveText("16:30");
  await dragOnBar(15 * 60, 15 * 60 + 15);
  await expect(start).toHaveText("15:15");
  await expect(end).toHaveText("16:30");

  // The wheel zooms around the pointer; the range stays as picked.
  const ticks = panel.locator(".fu-session").nth(1).locator(".fu-tick");
  await expect(ticks.first()).toHaveText(hhmmOf(from));
  await page.mouse.move(x(15 * 60 + 30), y);
  await page.mouse.wheel(0, -500);
  const reset = panel.getByRole("button", { name: "Xem cả buổi" });
  await expect(reset).toBeVisible();
  await expect(panel.locator(".fu-overview")).toBeVisible();
  await expect(ticks.first()).not.toHaveText(hhmmOf(from));
  await expect(start).toHaveText("15:15");

  await reset.click();
  await expect(reset).toBeHidden();
  await expect(ticks.first()).toHaveText(hhmmOf(from));
}
