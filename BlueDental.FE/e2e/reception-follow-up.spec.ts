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
  type Appointment,
} from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — progress bar ↔ outcome, and "Đã hẹn tiếp".
 *
 * - "Đang khám" ticks "Chuyển bác sĩ", and "Chuyển bác sĩ" puts the visit in
 *   the chair; "Hoàn tất" ticks "Kết thúc điều trị", and the reverse.
 * - "Đã hẹn tiếp" opens a picker; the outcome is only saved together with a
 *   real next appointment, whose date then shows under the option.
 *
 * Each test books its own visit for today through the real API, then finds
 * its card with the board's search and drives it in the browser.
 * Nothing is intercepted; every state is re-read from the server.
 */

const STATUS = { InProgress: 4, Completed: 5 } as const;
const OUTCOME = { EndTreatment: 1, FollowUp: 2, TransferDoctor: 3, Revisit: 4 } as const;

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
});

test.describe("Tiếp nhận — Đã hẹn tiếp", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the outcome is saved only with a booked next appointment", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 90);
    const card = await cardOf(page, visit);

    const followUp = outcome(card, /Đã hẹn tiếp/);
    await expect(followUp).toContainText("Cần chọn ngày giờ hẹn");
    await followUp.click();

    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await expect(panel).toBeVisible();
    const confirm = panel.getByRole("button", { name: "Xác nhận hẹn tiếp" });
    await expect(confirm).toBeDisabled();

    // Cancelling saves nothing.
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();

    await followUp.click();
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await expect(panel.getByRole("button", { name: /^\+1 tuần/ })).toHaveAttribute("aria-pressed", "true");
    const pickedSlot = panel.locator(".fu-slot[aria-pressed='true']");
    await expect(pickedSlot).toHaveCount(1);
    const time = (await pickedSlot.innerText()).trim();

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
    await expect(outcome(reloaded, /Đã hẹn tiếp/)).toContainText(label);
    await expect(outcome(reloaded, /Đã hẹn tiếp/)).toHaveAttribute("aria-pressed", "true");
  });

  test("the open picker swaps the tick with Kết thúc điều trị until it is booked", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 120);
    const card = await cardOf(page, visit);
    const endTreatment = outcome(card, "Kết thúc điều trị");
    const followUp = outcome(card, /Đã hẹn tiếp/);
    const revisit = outcome(card, "Hẹn tái khám");
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    await endTreatment.click();
    await expect(endTreatment).toHaveAttribute("aria-pressed", "true");
    // A finished treatment has nothing to revisit.
    await expect(revisit).toBeDisabled();

    // Opening the picker moves the tick; "Hẹn tái khám" stays locked.
    await followUp.click();
    await expect(followUp).toHaveAttribute("aria-pressed", "true");
    await expect(endTreatment).toHaveAttribute("aria-pressed", "false");
    await expect(revisit).toBeDisabled();

    // Backing out brings the saved outcome back; nothing was written.
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    await expect(endTreatment).toHaveAttribute("aria-pressed", "true");
    await expect(followUp).toHaveAttribute("aria-pressed", "false");
    await expect(revisit).toBeDisabled();
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.EndTreatment);

    await followUp.click();
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();
    await panel.getByRole("button", { name: "Xác nhận hẹn tiếp" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(followUp).toHaveAttribute("aria-pressed", "true");
    await expect(endTreatment).toHaveAttribute("aria-pressed", "false");
    await expect(revisit).toBeDisabled();
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.FollowUp);
  });

  test("Hẹn tái khám is saved only with a booked date and then locks the rest", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 150);
    const card = await cardOf(page, visit);
    const revisit = outcome(card, "Hẹn tái khám");
    const followUp = outcome(card, /Đã hẹn tiếp/);
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
    await expect(outcome(reloaded, /Đã hẹn tiếp/)).toContainText("Cần chọn ngày giờ hẹn");
    for (const other of [outcome(reloaded, /Đã hẹn tiếp/), outcome(reloaded, "Kết thúc điều trị"), outcome(reloaded, "Chuyển bác sĩ")]) {
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

    // Moving off Hẹn tái khám would take the slot back — refused now it is taken.
    const back = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/set-outcome`, {
      method: "POST",
      json: { outcome: OUTCOME.EndTreatment },
    });
    expect(back.status).toBeGreaterThanOrEqual(400);
    expect(back.body.error?.code).toBe("BlueDental:Appointment:0002");
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBe(OUTCOME.Revisit);
  });

  test("the doctor's booked slots cannot be picked", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 120);

    // Put the dentist in the chair at 08:00 a week from now (or find it taken already).
    const blockStart = new Date();
    blockStart.setDate(blockStart.getDate() + 7);
    blockStart.setHours(8, 0, 0, 0);
    const other = await call<{ items: { id: string }[] }>(page, branchId, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`);
    for (const p of other.body.items.filter((x) => x.id !== visit.patientId)) {
      const res = await call<Appointment>(page, branchId, APPOINTMENTS, {
        method: "POST",
        json: {
          patientId: p.id,
          dentistId: visit.dentistId,
          branchId,
          slotStart: blockStart.toISOString(),
          slotEnd: new Date(blockStart.getTime() + 30 * 60_000).toISOString(),
          type: 2,
        },
      });
      if (res.status === 200 || res.body.error?.code === "BlueDental:Appointment:0002") break;
    }

    const card = await cardOf(page, visit);
    await outcome(card, /Đã hẹn tiếp/).click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });
    await panel.getByRole("button", { name: /^\+1 tuần/ }).click();

    await expect(panel.getByRole("button", { name: "08:00", exact: true })).toBeDisabled();
    await expect(panel.locator(".fu-slot[aria-pressed='true']")).not.toHaveText("08:00");

    // The server refuses the same slot even if the page were to send it.
    const refused = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/follow-up`, {
      method: "POST",
      json: { slotStart: blockStart.toISOString(), slotEnd: new Date(blockStart.getTime() + 30 * 60_000).toISOString() },
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body.error?.code).toBe("BlueDental:Appointment:0002");
    expect((await getAppointment(page, branchId, visit.id)).outcome).toBeNull();
  });

  test("a visit gets one live follow-up, and only inside its branch", async ({ page, browser }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 150);

    // Far out and different on every run, so the last run's bookings for the
    // same dentist do not trip the double-booking guard.
    const seed = Number(runId());
    const at = new Date();
    at.setDate(at.getDate() + 200 + (seed % 300));
    // Inside the default shifts (08-12, 13-17): bookings outside them are refused (R-735).
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
