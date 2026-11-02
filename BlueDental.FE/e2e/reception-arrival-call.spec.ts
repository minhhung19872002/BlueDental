import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, getAppointment, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as plainCall, RUN_STAFF_PASSWORD } from "./fixtures/timekeepingStaff";

/**
 * Tiếp nhận — the floating "Đã đến" panel (BA 2026-11-02).
 *
 * Which list an account gets is the "Bác sĩ" tick on the staff form, not a
 * role's name; the role's Tiếp nhận permissions apply on top. A doctor sees
 * only their own arrived patients and calls one up with "Mời lên" — even with
 * Tiếp nhận "Sửa" they never see the called-up list, so two doctors do not
 * see each other's. An account not ticked "Bác sĩ" with Tiếp nhận Xem + Sửa
 * sees the called-up patient and seats them with "Tiếp nhận", which moves the
 * visit to Đang khám. That panel follows the doctor's click live, without a
 * reload.
 *
 * Real stack: run roles, staff and visits are made through the real API by an
 * admin signed in on the login screen; each user signs in on the login screen
 * too, and nothing is intercepted.
 */

const ARRIVAL_CALLS = "/api/v1/app/arrival-calls";
const ROLES = "/api/identity/roles";
const STAFF = "/api/v1/app/staff";
/** What opening Tiếp nhận and reading its board takes. */
const BOARD_GRANTS = ["BlueDental.reception.read", "BlueDental.appointment.read"];
/** Tiếp nhận "Sửa": what "Mời lên" and "Tiếp nhận" write with (owner 2026-11-02). */
const EDIT_GRANT = "BlueDental.reception.update";

type Visit = Appointment & { searchKey: string };

interface RunUser {
  id: string;
  userName: string;
}

interface Fixture {
  roleIds: string[];
  doctor: RunUser;
  receptionist: RunUser;
  ownVisit: Visit;
  otherVisit: Visit;
}

async function createRole(page: Page, name: string, grants: string[]): Promise<string> {
  const role = await plainCall<{ id: string }>(page, ROLES, {
    method: "POST",
    json: { name, isDefault: false, isPublic: true },
  });
  expect(role.status, "create run role").toBe(200);
  const granted = await plainCall(
    page,
    `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(name)}`,
    { method: "PUT", json: { permissions: grants.map((grant) => ({ name: grant, isGranted: true })) } },
  );
  expect(granted.status, "grant run role").toBe(204);
  return role.body.id;
}

async function createUser(
  page: Page,
  branchId: string,
  userName: string,
  roleName: string,
  isDentist: boolean,
): Promise<RunUser> {
  const res = await plainCall<{ id: string }>(page, STAFF, {
    method: "POST",
    branchId,
    json: {
      userName,
      password: RUN_STAFF_PASSWORD,
      name: userName,
      surname: "E2E",
      email: `${userName}@example.test`,
      isActive: true,
      isDentist,
      roleNames: [roleName],
      branchIds: [branchId],
    },
  });
  expect(res.status, `create ${userName} (${JSON.stringify(res.body.error)})`).toBe(200);
  return { id: res.body.id, userName };
}

async function setUp(page: Page, branchId: string): Promise<Fixture> {
  const id = `${runId()}${test.info().workerIndex}`;
  const doctorRole = `Bác sĩ mời lên ${id}`;
  const admitRole = `Đón khách ${id}`;
  const roleIds = [
    // The doctor may edit Tiếp nhận too: the tick, not the permission, keeps them off the called-up list.
    await createRole(page, doctorRole, [...BOARD_GRANTS, EDIT_GRANT]),
    // Not named Lễ tân: the tick, not the role's name, shows "Tiếp nhận".
    await createRole(page, admitRole, [...BOARD_GRANTS, EDIT_GRANT]),
  ];
  const doctor = await createUser(page, branchId, `mlbs${id}`, doctorRole, true);
  const receptionist = await createUser(page, branchId, `mltn${id}`, admitRole, false);

  // Two arrived visits: one handed to the run doctor, one left with another doctor.
  const ownVisit = await bookVisitToday(page, branchId, 150, "e2e-moilen");
  const otherVisit = await bookVisitToday(page, branchId, 180, "e2e-moilen");
  const assigned = await call(page, branchId, `${APPOINTMENTS}/${ownVisit.id}/assign-dentist`, {
    method: "POST",
    json: { dentistId: doctor.id },
  });
  expect(assigned.status, "hand the visit to the run doctor").toBe(200);
  for (const visit of [ownVisit, otherVisit]) {
    const arrived = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" });
    expect(arrived.status, "check the visit in").toBe(200);
  }
  return { roleIds, doctor, receptionist, ownVisit, otherVisit };
}

async function tearDown(page: Page, branchId: string, fixture: Fixture) {
  for (const visit of [fixture.ownVisit, fixture.otherVisit]) {
    await plainCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
  }
  for (const user of [fixture.doctor, fixture.receptionist]) {
    await plainCall(page, `${STAFF}/${user.id}`, { method: "DELETE" });
  }
  for (const roleId of fixture.roleIds) {
    await plainCall(page, `${ROLES}/${roleId}`, { method: "DELETE" });
  }
}

/** A separate browser signed in as `userName` on the login screen, on Tiếp nhận. */
async function openAs(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: RUN_STAFF_PASSWORD });
  await page.goto("/reception");
  return { context, page };
}

const dockButton = (page: Page) => page.getByRole("button", { name: "Khách đã đến" });
const panel = (page: Page) => page.getByRole("dialog", { name: "Khách đã đến" });
const rowOf = (page: Page, visit: Visit) => panel(page).locator(".arrival-row").filter({ hasText: visit.patientName });

test.describe("Tiếp nhận — Mời lên / Tiếp nhận", () => {
  test("the doctor calls their own patient up and a role with Tiếp nhận Sửa seats them, live", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const fixture = await setUp(page, branchId);
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];

    try {
      const doctor = await openAs(browser, fixture.doctor.userName);
      const receptionist = await openAs(browser, fixture.receptionist.userName);
      sessions.push(doctor, receptionist);

      // The doctor's panel lists their own arrived patient only.
      await expect(dockButton(doctor.page).locator(".arrival-dock-badge")).toHaveText("1");
      await dockButton(doctor.page).click();
      await expect(panel(doctor.page)).toContainText("Khách đã đến");
      await expect(panel(doctor.page)).not.toContainText("Bác sĩ mời lên");
      await expect(rowOf(doctor.page, fixture.ownVisit)).toBeVisible();
      await expect(rowOf(doctor.page, fixture.otherVisit)).toHaveCount(0);

      // The receptionist has nothing to seat yet, and no "Mời lên" list.
      await dockButton(receptionist.page).click();
      await expect(panel(receptionist.page)).toContainText("Bác sĩ mời lên");
      await expect(panel(receptionist.page)).not.toContainText("Khách đã đến");
      await expect(rowOf(receptionist.page, fixture.ownVisit)).toHaveCount(0);

      // Neither may press the other's button through the API.
      const admitByDoctor = await call(doctor.page, branchId, `${ARRIVAL_CALLS}/${fixture.ownVisit.id}/admit`, { method: "POST" });
      expect(admitByDoctor.status, "a doctor cannot seat, even with Sửa").toBe(403);
      const invitedForDoctor = await call(doctor.page, branchId, `${ARRIVAL_CALLS}/invited`);
      expect(invitedForDoctor.status, "a doctor has no called-up list, even with Sửa").toBe(403);
      const inviteByReception = await call(receptionist.page, branchId, `${ARRIVAL_CALLS}/${fixture.ownVisit.id}/invite`, { method: "POST" });
      expect(inviteByReception.status, "only the visit's doctor calls up").toBe(403);
      const inviteOther = await call(doctor.page, branchId, `${ARRIVAL_CALLS}/${fixture.otherVisit.id}/invite`, { method: "POST" });
      expect(inviteOther.status, "a doctor cannot call up another doctor's patient").toBe(403);

      // "Mời lên": the row is flagged and the badge clears.
      await rowOf(doctor.page, fixture.ownVisit).getByRole("button", { name: "Mời lên" }).click();
      await expect(doctor.page.getByText("Đã mời bệnh nhân lên")).toBeVisible();
      await expect(rowOf(doctor.page, fixture.ownVisit)).toContainText("Đã mời");
      await expect(dockButton(doctor.page).locator(".arrival-dock-badge")).toHaveCount(0);

      // The receptionist's open panel picks it up with no reload.
      const seatRow = rowOf(receptionist.page, fixture.ownVisit);
      await expect(seatRow).toBeVisible({ timeout: 15_000 });
      await expect(seatRow).toContainText(fixture.ownVisit.searchKey);
      // The branch is shared: other visits called up today count too.
      const seatRows = panel(receptionist.page).locator(".arrival-row");
      await expect(dockButton(receptionist.page).locator(".arrival-dock-badge")).toHaveText(String(await seatRows.count()));

      // "Tiếp nhận": the visit is in the chair and leaves both panels.
      await seatRow.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(receptionist.page.getByText("Đã tiếp nhận bệnh nhân")).toBeVisible();
      await expect(seatRow).toHaveCount(0);
      await expect(rowOf(doctor.page, fixture.ownVisit)).toHaveCount(0, { timeout: 15_000 });

      const stored = await getAppointment(page, branchId, fixture.ownVisit.id);
      expect(stored.status, "Đang khám").toBe(4);
      expect(stored.startedAt).not.toBeNull();

      // Reloaded, the panel still has nothing of it.
      await receptionist.page.reload();
      await dockButton(receptionist.page).click();
      await expect(panel(receptionist.page)).toBeVisible();
      await expect(rowOf(receptionist.page, fixture.ownVisit)).toHaveCount(0);

      // A click outside folds the panel away.
      await receptionist.page.locator(".reception-card--toolbar").click({ position: { x: 5, y: 5 } });
      await expect(panel(receptionist.page)).toHaveCount(0);
    } finally {
      for (const session of sessions) await session.context.close();
      await tearDown(page, branchId, fixture);
    }
  });
});
