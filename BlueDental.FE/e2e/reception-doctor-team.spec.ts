import { expect, test, type Page, type Response } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as staffCall, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Tiếp nhận — the Nhóm bác sĩ filter (owner, 2026-10-13).
 *
 * - It offers the Team bác sĩ boxes of Nhân sự → Sơ đồ tổ chức whose head is
 *   ticked "Bác sĩ"; a team headed by anyone else is left out.
 * - `doctorTeamId` lists the visits of the team's members, counters included.
 * - Picking a team clears the doctors picked one by one, and the other way round.
 *
 * Each run makes its own dentist, a team they head, a team headed by staff
 * without the tick, and one visit for the dentist — all through the real API —
 * and takes them away again.
 */

const isBoardList = (r: Response) => {
  const url = r.url();
  return url.includes(APPOINTMENTS) && !url.includes("/stats") && r.request().method() === "GET" && r.ok();
};
const params = (r: Response) => new URL(r.url()).searchParams;

interface Team {
  id: string;
  code: string;
  name: string;
  headName: string;
}

interface Fixture {
  branchId: string;
  dentist: RunStaff;
  /** The dentist's Tên — what the board's pickers and the team list name them by. */
  dentistName: string;
  other: RunStaff;
  dentistTeam: { id: string; name: string };
  otherTeam: { id: string; name: string };
  visit: Appointment;
}

async function createTeam(page: Page, branchId: string, name: string, headStaffId: string) {
  const chart = await call<{ units: { id: string; kind: number }[] }>(page, branchId, "/api/v1/app/org-chart");
  const root = chart.body.units.find((u) => u.kind === 1);
  expect(root, "the chart has its root").toBeTruthy();
  const res = await call<{ id: string; name: string }>(page, branchId, "/api/v1/app/org-chart/units", {
    method: "POST",
    json: { kind: 3, name, parentId: root!.id, headStaffId, memberStaffIds: [headStaffId] },
  });
  expect(res.status, `create team ${name}`).toBe(200);
  return res.body;
}

/** One visit for `dentistId` later today, with the first patient free then. */
async function bookFor(page: Page, branchId: string, dentistId: string): Promise<Appointment> {
  const start = new Date(Date.now() + 90 * 60_000);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  test.skip(dayOf(start) !== dayOf(new Date()), "too close to midnight to book a visit for today");
  const end = new Date(start.getTime() + 30 * 60_000);
  expect(await openShiftCovering(page, branchId, dentistId, start, end), "the run dentist is on shift").toBe(true);

  const patients = await call<{ items: { id: string }[] }>(
    page, branchId, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`,
  );
  for (const patient of patients.body.items) {
    const res = await call<Appointment>(page, branchId, APPOINTMENTS, {
      method: "POST",
      json: { patientId: patient.id, dentistId, branchId, slotStart: start.toISOString(), slotEnd: end.toISOString(), type: 2 },
    });
    if (res.status === 200) return res.body;
  }
  throw new Error("no patient was free to book with the run dentist");
}

test.describe("Tiếp nhận — lọc theo nhóm bác sĩ", () => {
  let fx: Fixture | undefined;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const branchId = await openBoard(page);
    const run = `team${runId()}`;
    const dentistName = `BS Team ${run}`;
    const dentist = await createRunStaff(page, branchId, run, { name: dentistName, isDentist: true });
    const other = await createRunStaff(page, branchId, `${run}x`, { name: `LT Team ${run}` });
    const dentistTeam = await createTeam(page, branchId, `E2E Nhóm ${run}`, dentist.id);
    const otherTeam = await createTeam(page, branchId, `E2E Nhóm LT ${run}`, other.id);
    const visit = await bookFor(page, branchId, dentist.id);
    fx = { branchId, dentist, dentistName, other, dentistTeam, otherTeam, visit };
  });

  test.afterEach(async ({ page }) => {
    if (!fx) return;
    const { branchId, visit, dentistTeam, otherTeam, dentist, other } = fx;
    await call(page, branchId, `${APPOINTMENTS}/${visit.id}/cancel`, { method: "POST", json: { reason: 1, note: "e2e" } });
    // The heads cannot be deleted while they head a team.
    for (const team of [dentistTeam, otherTeam]) {
      await staffCall(page, `/api/v1/app/org-chart/units/${team.id}`, { method: "DELETE", branchId });
    }
    await deleteStaff(page, dentist.id);
    await deleteStaff(page, other.id);
    fx = undefined;
  });

  test("the API offers dentist-headed teams only and lists their members' visits", async ({ page }) => {
    const { branchId, dentist, dentistName, dentistTeam, otherTeam, visit } = fx!;
    const teams = await call<Team[]>(page, branchId, `${APPOINTMENTS}/doctor-teams`);
    expect(teams.status).toBe(200);
    const ids = teams.body.map((t) => t.id);
    expect(ids).toContain(dentistTeam.id);
    expect(ids, "a team headed by staff without the Bác sĩ tick").not.toContain(otherTeam.id);
    expect(teams.body.find((t) => t.id === dentistTeam.id)?.headName).toBe(dentistName);

    // Every team offered is a Team bác sĩ of the chart, headed by a dentist.
    const chart = await call<{ units: { id: string; kind: number; headStaffId: string; members: { id: string; isDentist: boolean }[] }[] }>(
      page, branchId, "/api/v1/app/org-chart",
    );
    for (const team of teams.body) {
      const unit = chart.body.units.find((u) => u.id === team.id);
      expect(unit?.kind, team.name).toBe(3);
      expect(unit?.members.find((m) => m.id === unit.headStaffId)?.isDentist, `${team.name}'s head`).toBe(true);
    }

    const today = dayOf(new Date(visit.slotStart));
    const listed = await call<{ items: Appointment[]; totalCount: number }>(
      page, branchId, `${APPOINTMENTS}?fromDate=${today}&toDate=${today}&doctorTeamId=${dentistTeam.id}`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((a) => a.id)).toContain(visit.id);
    expect(listed.body.items.every((a) => a.dentistId === dentist.id), "only the team's members").toBe(true);

    const stats = await call<Record<string, number>>(
      page, branchId, `${APPOINTMENTS}/stats?fromDate=${today}&toDate=${today}&doctorTeamId=${dentistTeam.id}`,
    );
    const counted = ["requested", "confirmed", "checkedIn", "inProgress", "completed", "cancelled", "noShow"]
      .reduce((n, k) => n + (stats.body[k] ?? 0), 0);
    expect(counted).toBe(listed.body.totalCount);
  });

  test("on the board, a team clears the picked doctors and a doctor clears the team", async ({ page }) => {
    const { dentistName, dentistTeam, otherTeam, visit } = fx!;
    await page.reload();
    await page.waitForLoadState("networkidle");
    const teamFilter = page.locator(".reception-team-filter");
    const doctorFilter = page.locator(".reception-doctor-filter");

    // A doctor first.
    await doctorFilter.locator(".ss-trigger").click();
    let listed = page.waitForResponse((r) => isBoardList(r) && params(r).getAll("dentistIds").length === 1);
    await page.locator(".ms-dropdown").getByRole("option", { name: dentistName, exact: true }).click();
    await listed;
    await page.locator(".reception-page").click({ position: { x: 5, y: 5 } });

    // Then the team: the doctor is dropped, the board asks for the team alone.
    await teamFilter.locator(".ss-trigger").click();
    const options = page.locator("#ss-portal-dropdown [role=option]");
    await expect(options.filter({ hasText: dentistTeam.name })).toHaveCount(1);
    await expect(options.filter({ hasText: otherTeam.name })).toHaveCount(0);
    listed = page.waitForResponse((r) => isBoardList(r) && params(r).get("doctorTeamId") === dentistTeam.id);
    await options.filter({ hasText: dentistTeam.name }).click();
    const byTeam = await listed;
    expect(params(byTeam).getAll("dentistIds")).toEqual([]);
    await expect(teamFilter.locator(".ss-value--selected")).toHaveText(dentistTeam.name);
    await expect(doctorFilter.locator(".ss-value--placeholder")).toBeVisible();
    const body = (await byTeam.json()) as { items: Appointment[] };
    expect(body.items.map((a) => a.id)).toContain(visit.id);
    await expect(page.locator(".rc-wrapper")).toHaveCount(body.items.length);

    // A doctor again: the team is dropped. That exact filter was loaded at the
    // start, so the board may answer from its cache instead of a new request.
    await doctorFilter.locator(".ss-trigger").click();
    await page.locator(".ms-dropdown").getByRole("option", { name: dentistName, exact: true }).click();
    await expect(teamFilter.locator(".ss-value--placeholder")).toBeVisible();
    await expect(doctorFilter.locator(".ss-value--selected")).toHaveText(dentistName);
  });

  // The endpoint is guarded by appointment.read, not orgChart.read.
  test("a receptionist gets the teams and the filter on the board", async ({ page }) => {
    const { dentistTeam } = fx!;
    await page.context().clearCookies();
    await login(page, { userName: "lt.huong", password: "Staff@123456" });
    const branchId = await openBoard(page);
    const teams = await call<Team[]>(page, branchId, `${APPOINTMENTS}/doctor-teams`);
    expect(teams.status).toBe(200);
    expect(teams.body.map((t) => t.id)).toContain(dentistTeam.id);

    // The team filter is offered to them on the board.
    await page.locator(".reception-team-filter .ss-trigger").click();
    await expect(page.locator("#ss-portal-dropdown [role=option]").filter({ hasText: dentistTeam.name })).toHaveCount(1);
    await page.keyboard.press("Escape");

    // Cleanup runs as admin again.
    await page.context().clearCookies();
    await login(page);
  });
});
