import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, getAppointment, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as plainCall, RUN_STAFF_PASSWORD } from "./fixtures/timekeepingStaff";

/**
 * Tiếp nhận — "Đã đến" and "Đang khám" are the front desk's steps (R-1193,
 * Huỳnh Văn Định 2026-11-10): an account ticked "Bác sĩ" cannot press them,
 * forward or back, even with Tiếp nhận "Sửa"; it still presses "Hoàn tất". An
 * account not ticked "Bác sĩ" with the same role presses all of them. The
 * patient record's stepper holds the same two steps. A screen lock only — the
 * owner asked for no server rule — so only what each screen offers is checked.
 *
 * Real stack: the run role, staff and visit are made through the real API by an
 * admin signed in on the login screen; each user signs in on the login screen
 * too, and nothing is intercepted.
 */

const ROLES = "/api/identity/roles";
const STAFF = "/api/v1/app/staff";
/** Tiếp nhận + Lịch hẹn Xem/Sửa (what the steps write with), and Hồ sơ Xem for the record's stepper. */
const GRANTS = [
  "BlueDental.reception.read",
  "BlueDental.reception.update",
  "BlueDental.appointment.read",
  "BlueDental.appointment.update",
  "BlueDental.patient.read",
];
const LOCKED_HINT = "Bước này do lễ tân thao tác";

type Visit = Appointment & { searchKey: string };

interface RunUser {
  id: string;
  userName: string;
}

async function createRole(page: Page, name: string): Promise<string> {
  const role = await plainCall<{ id: string }>(page, ROLES, {
    method: "POST",
    json: { name, isDefault: false, isPublic: true },
  });
  expect(role.status, "create run role").toBe(200);
  const granted = await plainCall(
    page,
    `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(name)}`,
    { method: "PUT", json: { permissions: GRANTS.map((grant) => ({ name: grant, isGranted: true })) } },
  );
  expect(granted.status, "grant run role").toBe(204);
  return role.body.id;
}

async function createUser(page: Page, branchId: string, userName: string, roleName: string, isDentist: boolean) {
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
  return { id: res.body.id, userName } satisfies RunUser;
}

async function openAs(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: RUN_STAFF_PASSWORD });
  await page.goto("/reception");
  return { context, page };
}

/** The card's step whose label reads `label`. */
const stepOf = (card: Locator, label: string) =>
  card.locator(".rc-step").filter({ has: card.page().locator(".rc-step-label", { hasText: new RegExp(`^${label}$`) }) });

async function expectLocked(step: Locator) {
  await expect(step).toBeDisabled();
  await expect(step).toHaveAttribute("title", LOCKED_HINT);
}

/** The board again after a reload, on the visit's card. */
async function reloadCard(page: Page, visit: Visit) {
  await page.reload();
  return cardOf(page, visit);
}

/** Presses a step and waits for the server to take it. */
async function press(page: Page, step: Locator, visit: Visit, command: string) {
  const answered = page.waitForResponse(
    (r) => r.url().endsWith(`${APPOINTMENTS}/${visit.id}/${command}`) && r.request().method() === "POST",
  );
  await step.click();
  expect((await answered).ok(), `${command} should be taken`).toBeTruthy();
}

test.describe("Tiếp nhận — Đã đến / Đang khám locked for a doctor", () => {
  test("a doctor cannot press Đã đến or Đang khám, forward or back, but finishes with Hoàn tất; the front desk presses them", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const id = `${runId()}${test.info().workerIndex}`;
    const roleName = `Khoá bước lễ tân ${id}`;
    const roleId = await createRole(page, roleName);
    const users: RunUser[] = [];
    let visit: Visit | undefined;
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];

    try {
      // Same role for both: the "Bác sĩ" tick alone makes the difference.
      const doctorUser = await createUser(page, branchId, `kbbs${id}`, roleName, true);
      users.push(doctorUser);
      const deskUser = await createUser(page, branchId, `kbtn${id}`, roleName, false);
      users.push(deskUser);
      visit = await bookVisitToday(page, branchId, 150, "e2e-khoabuoc");
      const assigned = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/assign-dentist`, {
        method: "POST",
        json: { dentistId: doctorUser.id },
      });
      expect(assigned.status, "hand the visit to the run doctor").toBe(200);

      const doctor = await openAs(browser, doctorUser.userName);
      sessions.push(doctor);
      const desk = await openAs(browser, deskUser.userName);
      sessions.push(desk);

      // Booked: the doctor's "Đã đến" is shut and says who marks it.
      let doctorCard = await cardOf(doctor.page, visit);
      await expectLocked(stepOf(doctorCard, "Đã đến"));
      await expect(stepOf(doctorCard, "Đang khám")).toBeDisabled();

      // The front desk marks the arrival from the same board.
      let deskCard = await cardOf(desk.page, visit);
      await expect(stepOf(deskCard, "Đã đến")).not.toHaveAttribute("title", LOCKED_HINT);
      await press(desk.page, stepOf(deskCard, "Đã đến"), visit, "check-in");
      await expect(stepOf(deskCard, "Đã đến")).toHaveAttribute("title", "Bấm để huỷ Đã đến");

      // Arrived: the doctor can neither take "Đã đến" back nor seat the patient.
      doctorCard = await reloadCard(doctor.page, visit);
      await expectLocked(stepOf(doctorCard, "Đã đến"));
      await expectLocked(stepOf(doctorCard, "Đang khám"));
      await expect(doctorCard.locator(".rc-step--undo")).toHaveCount(0);

      // The patient record's stepper holds the same step for the doctor.
      await doctor.page.goto(`/patient/${visit.patientId}?branchId=${branchId}&tab=profile`);
      const recordSteps = doctor.page.locator(".pd-appt-steps button");
      await expect(recordSteps).toHaveCount(3);
      await expect(doctor.page.locator(".pd-appt-steps li").first()).toHaveClass(/reached/);
      await expectLocked(recordSteps.nth(1));
      await expect(recordSteps.nth(2)).toBeDisabled();

      // The front desk seats the patient.
      deskCard = await reloadCard(desk.page, visit);
      await press(desk.page, stepOf(deskCard, "Đang khám"), visit, "start");

      // In the chair: "Đang khám" stays shut for the doctor, "Hoàn tất" opens.
      await doctor.page.goto("/reception");
      doctorCard = await cardOf(doctor.page, visit);
      await expectLocked(stepOf(doctorCard, "Đang khám"));
      const finish = stepOf(doctorCard, "Hoàn tất");
      await expect(finish).toBeEnabled();
      await expect(finish).not.toHaveAttribute("title", LOCKED_HINT);
      await press(doctor.page, finish, visit, "complete");

      const stored = await getAppointment(page, branchId, visit.id);
      expect(stored.checkedInAt, "the front desk's arrival is kept").toBeTruthy();
      expect(stored.startedAt, "the front desk's seating is kept").toBeTruthy();
      expect(stored.completedAt, "the doctor's Hoàn tất is kept").toBeTruthy();
    } finally {
      for (const session of sessions) await session.context.close();
      if (visit) await plainCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
      for (const user of users) await plainCall(page, `${STAFF}/${user.id}`, { method: "DELETE" });
      await plainCall(page, `${ROLES}/${roleId}`, { method: "DELETE" });
    }
  });
});
