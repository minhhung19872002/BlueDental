import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";

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

const APPOINTMENTS = "/api/v1/app/appointments";

const STATUS = { InProgress: 4, Completed: 5 } as const;
const OUTCOME = { EndTreatment: 1, FollowUp: 2, TransferDoctor: 3 } as const;

interface Appointment {
  id: string;
  patientId: string;
  patientCode: string | null;
  patientName: string;
  dentistId: string;
  branchId: string;
  slotStart: string;
  slotEnd: string;
  status: number;
  type: number;
  outcome: number | null;
  followUpAppointmentId: string | null;
  followUpAt: string | null;
}

interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

/** One request from the logged-in page: cookie session, antiforgery and branch headers. */
async function call<T>(
  page: Page,
  branchId: string,
  url: string,
  options: { method?: "GET" | "POST"; json?: unknown } = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options, branchId }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        "X-Clinic-Branch-Id": branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: string | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      }
      const res = await fetch(url, { method: options.method ?? "GET", credentials: "include", headers, body });
      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as never };
    },
    { url, options, branchId },
  );
}

/** The branch the board is showing, read off the board's own request. */
async function openBoard(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/reception");
  const branchId = (await request).headers()["x-clinic-branch-id"];
  expect(branchId, "the board should ask for one branch").toBeTruthy();
  return branchId;
}

const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A visit for later today, with a dentist and a patient free at that time.
 * Its booking note carries a key unique to this run, which the board's search
 * matches, so the visit's card can be found alone. Returns it as stored.
 */
async function bookVisitToday(
  page: Page,
  branchId: string,
  minutesAhead: number,
): Promise<Appointment & { searchKey: string }> {
  const searchKey = `e2e-hentiep-${runId()}-${minutesAhead}`;
  const start = new Date(Date.now() + minutesAhead * 60_000);
  start.setSeconds(0, 0);
  test.skip(dayOf(start) !== dayOf(new Date()), "too close to midnight to book a visit for today");
  const end = new Date(start.getTime() + 15 * 60_000);
  const today = dayOf(new Date());

  const todays = await call<{ items: Appointment[] }>(page, branchId, `${APPOINTMENTS}?fromDate=${today}&toDate=${today}`);
  const busyDentists = new Set(
    todays.body.items
      .filter((a) => a.status !== 6 && a.status !== 7)
      .filter((a) => new Date(a.slotStart) < end && new Date(a.slotEnd) > start)
      .map((a) => a.dentistId),
  );

  const patients = await call<{ items: { id: string; patientCode: string }[] }>(
    page, branchId, `/api/v1/app/patients?MaxResultCount=200&ClinicBranchId=${branchId}`,
  );
  const staff = await call<{ items: { id: string; branchIds: string[] }[] }>(
    page, branchId, `/api/v1/app/staff?MaxResultCount=200&IsActive=true&BranchId=${branchId}`,
  );
  const candidates = patients.body.items.filter((p) => p.patientCode);
  // A dentist may be booked in another branch at that time, which this
  // branch's list does not show; the server says so and the next one is tried.
  const dentists = staff.body.items.filter((s) => !busyDentists.has(s.id));

  let lastError: unknown;
  for (const dentist of dentists.slice(0, 8)) {
    for (const patient of candidates.slice(0, 20)) {
      const res = await call<Appointment>(page, branchId, APPOINTMENTS, {
        method: "POST",
        json: {
          patientId: patient.id,
          dentistId: dentist.id,
          branchId,
          slotStart: start.toISOString(),
          slotEnd: end.toISOString(),
          type: 2,
          chiefComplaint: searchKey,
        },
      });
      if (res.status === 200) return { ...res.body, searchKey };
      lastError = res.body.error;
      if (res.body.error?.code === "BlueDental:Appointment:0002") break;
    }
  }
  throw new Error(`no visit could be booked for today: ${JSON.stringify(lastError)}`);
}

async function getAppointment(page: Page, branchId: string, id: string): Promise<Appointment> {
  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

/** The visit's card, found by the board's search on its unique booking note. */
async function cardOf(page: Page, visit: Appointment & { searchKey: string }): Promise<Locator> {
  // Until the search answers, the unfiltered board may still show another
  // card of the same patient; wait for the filtered list before touching one.
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes(`filter=${visit.searchKey}`) && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(visit.searchKey);
  await searched;
  const cards = page.locator(".rc-wrapper");
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  const card = cards.filter({ hasText: visit.patientCode ?? visit.patientName });
  await expect(card).toHaveCount(1);
  return card;
}

const outcome = (card: Locator, name: string | RegExp) => card.getByRole("button", { name });

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

    // Opening the picker moves the tick and locks "Hẹn tái khám".
    await followUp.click();
    await expect(followUp).toHaveAttribute("aria-pressed", "true");
    await expect(endTreatment).toHaveAttribute("aria-pressed", "false");
    await expect(revisit).toBeDisabled();

    // Backing out brings the saved outcome back; nothing was written.
    await panel.getByRole("button", { name: "Hủy" }).click();
    await expect(panel).toBeHidden();
    await expect(endTreatment).toHaveAttribute("aria-pressed", "true");
    await expect(followUp).toHaveAttribute("aria-pressed", "false");
    await expect(revisit).toBeEnabled();
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

  test("the doctor's booked slots cannot be picked", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 120);

    // Put the dentist in the chair at 08:00 a week from now (or find it taken already).
    const blockStart = new Date();
    blockStart.setDate(blockStart.getDate() + 7);
    blockStart.setHours(8, 0, 0, 0);
    const other = await call<{ items: { id: string }[] }>(page, branchId, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`);
    for (const p of other.body.items.filter((x) => x.id !== visit.patientId).slice(0, 5)) {
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
    at.setHours(8 + (Math.floor(seed / 300) % 8), 30, 0, 0);
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
