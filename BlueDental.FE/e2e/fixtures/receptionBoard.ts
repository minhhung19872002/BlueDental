import { expect, test, type Locator, type Page } from "@playwright/test";
import { runId } from "./auth";

/**
 * The Tiếp nhận board, driven through the real API: book a visit for today,
 * find its card with the board's own search, re-read what the server stored.
 */

export const APPOINTMENTS = "/api/v1/app/appointments";

export interface Appointment {
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
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

/** One request from the logged-in page: cookie session, antiforgery and branch headers. */
export async function call<T>(
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
      let parsed: unknown;
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
export async function openBoard(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/reception");
  const branchId = (await request).headers()["x-clinic-branch-id"];
  expect(branchId, "the board should ask for one branch").toBeTruthy();
  return branchId;
}

export const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A visit for later today, with a dentist and a patient free at that time.
 * Its booking note carries a key unique to this run, which the board's search
 * matches, so the visit's card can be found alone. Returns it as stored.
 */
export async function bookVisitToday(
  page: Page,
  branchId: string,
  minutesAhead: number,
  keyPrefix = "e2e-hentiep",
): Promise<Appointment & { searchKey: string }> {
  const searchKey = `${keyPrefix}-${runId()}-${minutesAhead}`;
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
  // Earlier runs leave follow-ups weeks ahead; a patient already booked then
  // would be refused a follow-up the picker (which shows the doctor's slots) offers.
  const monthAhead = new Date();
  monthAhead.setDate(monthAhead.getDate() + 40);
  const upcoming = await call<{ items: Appointment[] }>(
    page, branchId, `${APPOINTMENTS}?fromDate=${today}&toDate=${dayOf(monthAhead)}&MaxResultCount=1000`,
  );
  const bookedPatients = new Set(
    upcoming.body.items.filter((a) => a.status !== 6 && a.status !== 7).map((a) => a.patientId),
  );
  const candidates = patients.body.items.filter((p) => p.patientCode && !bookedPatients.has(p.id));
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

export async function getAppointment(page: Page, branchId: string, id: string): Promise<Appointment> {
  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

/** The visit's card, found by the board's search on its unique booking note. */
export async function cardOf(page: Page, visit: Appointment & { searchKey: string }): Promise<Locator> {
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
