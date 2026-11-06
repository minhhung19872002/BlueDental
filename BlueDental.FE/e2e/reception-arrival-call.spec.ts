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

/**
 * Counts the "ting ting" sounds the page plays (R-1144), and which file.
 * Only watches the browser's audio; no API is touched, and the sound still plays.
 */
function countChimes() {
  Reflect.set(window, "__bdChimes", []);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    // The silent check of whether sound may play on load (R-1145) is no chime.
    if (this.volume === 0) return play.call(this);
    const played: unknown = Reflect.get(window, "__bdChimes");
    const src = this.currentSrc || this.src;
    const result = play.call(this);
    // Every attempt counts; it reads as the URL only once the browser really
    // played it, "blocked:…" if refused.
    if (Array.isArray(played)) {
      const index = played.push(`pending:${src}`) - 1;
      result.then(
        () => (played[index] = src),
        () => (played[index] = `blocked:${src}`),
      );
    }
    return result;
  };
}
/**
 * Makes this browser act like Chrome on a fresh load or F5 (R-1145): no user
 * activation until the first click or key press. `blocked`: audio is refused
 * until then too (Chrome's default). `allowed`: audio plays anyway, as on a
 * site in the AutoplayAllowlist policy. Playwright's own pages always report
 * activation, so neither state can happen otherwise. Only the browser's
 * activation flag and `play()` are touched; no API is.
 * Install it before {@link countChimes} so the count sees the refusals.
 */
function noClickYet(sound: "blocked" | "allowed") {
  let active = false;
  const activate = () => (active = true);
  window.addEventListener("pointerdown", activate, true);
  window.addEventListener("keydown", activate, true);
  Object.defineProperty(navigator, "userActivation", {
    get: () => ({ hasBeenActive: active, isActive: active }),
  });
  if (sound === "allowed") return;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (active) return play.call(this);
    return Promise.reject(new DOMException("play() failed: no user activation", "NotAllowedError"));
  };
}
const chimesPlayed = (page: Page) =>
  page.evaluate(() => {
    const played: unknown = Reflect.get(window, "__bdChimes");
    return Array.isArray(played) ? played.map(String) : [];
  });
const chimeCount = async (page: Page) => (await chimesPlayed(page)).length;

/** A separate browser signed in as `userName` on the login screen, on `path`. */
async function openAs(browser: Browser, userName: string, path: string, options: { noClick?: "blocked" | "allowed" } = {}) {
  const context = await browser.newContext();
  if (options.noClick) await context.addInitScript(noClickYet, options.noClick);
  await context.addInitScript(countChimes);
  const page = await context.newPage();
  await login(page, { userName, password: RUN_STAFF_PASSWORD });
  await page.goto(path);
  return { context, page };
}

const dockButton = (page: Page) => page.getByRole("button", { name: "Khách đã đến" });
const SOUND_OFF_HINT = "Bấm vào trang một lần để bật âm thanh";
const mutedBell = (page: Page) => dockButton(page).getByRole("img", { name: SOUND_OFF_HINT });
const panel = (page: Page) => page.getByRole("dialog", { name: "Khách đã đến" });
const rowOf = (page: Page, visit: Visit) => panel(page).locator(".arrival-row").filter({ hasText: visit.patientName });
/** One list of the panel, by its title: an admin has both, so a patient can be in each. */
const section = (page: Page, title: string) =>
  panel(page).locator("section").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("Tiếp nhận — Mời lên / Tiếp nhận", () => {
  test("the doctor calls their own patient up and a role with Tiếp nhận Sửa seats them, live", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const fixture = await setUp(page, branchId);
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];

    try {
      const doctor = await openAs(browser, fixture.doctor.userName, "/reception");
      // The app shell carries the button, so it floats over every screen, not only Tiếp nhận.
      const receptionist = await openAs(browser, fixture.receptionist.userName, "/calendar/list");
      sessions.push(doctor, receptionist);

      // The doctor's panel lists their own arrived patient only.
      await expect(dockButton(doctor.page).locator(".arrival-dock-badge")).toHaveText("1");
      await dockButton(doctor.page).click();
      await expect(panel(doctor.page)).toContainText("Khách đã đến");
      await expect(panel(doctor.page)).not.toContainText("Bác sĩ mời lên");
      await expect(rowOf(doctor.page, fixture.ownVisit)).toBeVisible();
      await expect(rowOf(doctor.page, fixture.ownVisit).locator(".arrival-row-doctor")).toContainText(fixture.doctor.userName);
      await expect(rowOf(doctor.page, fixture.otherVisit)).toHaveCount(0);

      // The receptionist has nothing to seat yet, and no "Mời lên" list.
      await dockButton(receptionist.page).click();
      await expect(panel(receptionist.page)).toContainText("Bác sĩ mời lên");
      await expect(panel(receptionist.page)).not.toContainText("Khách đã đến");
      await expect(rowOf(receptionist.page, fixture.ownVisit)).toHaveCount(0);
      // Patients called up before the panel loaded do not ring.
      expect(await chimeCount(receptionist.page), "no ring for the first list").toBe(0);
      // Sound is on (this browser has had a click): no muted bell (R-1145).
      await expect(mutedBell(receptionist.page)).toHaveCount(0);
      // The panel is folded away again: the chime must not need it open.
      await receptionist.page.locator("main.app-content").click({ position: { x: 5, y: 5 } });
      await expect(panel(receptionist.page)).toHaveCount(0);

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

      // The receptionist hears "ting ting" once (R-1144) with the panel still
      // closed; the doctor's own screen stays quiet.
      await expect
        .poll(() => chimeCount(receptionist.page), { message: "one chime, panel closed", timeout: 15_000 })
        .toBe(1);
      await expect(panel(receptionist.page)).toHaveCount(0);
      // BA's sound file, really played: a refused play reads "blocked:…".
      await expect
        .poll(async () => (await chimesPlayed(receptionist.page))[0], { message: "BA's sound file, played" })
        .toMatch(/^https?:\/\/[^/]+\/sounds\/invite-chime\.mp3$/);
      const sound = await receptionist.page.request.get("/sounds/invite-chime.mp3");
      expect(sound.status(), "the sound file is served").toBe(200);
      expect(sound.headers()["content-type"]).toContain("audio/mpeg");
      expect(await chimeCount(doctor.page), "no chime for the doctor").toBe(0);

      // The panel, opened now, has it with no reload.
      await dockButton(receptionist.page).click();
      const seatRow = rowOf(receptionist.page, fixture.ownVisit);
      await expect(seatRow).toBeVisible();
      await expect(seatRow).toContainText(fixture.ownVisit.searchKey);
      await expect(seatRow.locator(".arrival-row-doctor")).toContainText(fixture.doctor.userName);
      // The branch is shared: other visits called up today count too.
      const seatRows = panel(receptionist.page).locator(".arrival-row");
      await expect(dockButton(receptionist.page).locator(".arrival-dock-badge")).toHaveText(String(await seatRows.count()));

      // "Tiếp nhận": the visit is in the chair and leaves both panels.
      await seatRow.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(receptionist.page.getByText("Đã tiếp nhận bệnh nhân")).toBeVisible();
      await expect(seatRow).toHaveCount(0);
      await expect(rowOf(doctor.page, fixture.ownVisit)).toHaveCount(0, { timeout: 15_000 });
      // Seating someone takes them off the list; that never rings.
      expect(await chimeCount(receptionist.page), "no chime for seating").toBe(1);

      const stored = await getAppointment(page, branchId, fixture.ownVisit.id);
      expect(stored.status, "Đang khám").toBe(4);
      expect(stored.startedAt).not.toBeNull();

      // Reloaded, the panel still has nothing of it, and the list it loads does not ring.
      await receptionist.page.reload();
      await dockButton(receptionist.page).click();
      await expect(panel(receptionist.page)).toBeVisible();
      await expect(panel(receptionist.page).locator(".arrival-panel-empty .ant-spin")).toHaveCount(0);
      await expect(rowOf(receptionist.page, fixture.ownVisit)).toHaveCount(0);
      expect(await chimeCount(receptionist.page), "no chime after a reload").toBe(0);

      // A click outside folds the panel away.
      await receptionist.page.locator("main.app-content").click({ position: { x: 5, y: 5 } });
      await expect(panel(receptionist.page)).toHaveCount(0);
    } finally {
      for (const session of sessions) await session.context.close();
      await tearDown(page, branchId, fixture);
    }
  });

  /**
   * R-1164 (BA 2026-11-06, owner: anyone who sees the list, several doctors,
   * kept per device): the 👁 on "Khách đã đến" picks whose arrived patients it
   * shows. Another doctor's patient is only looked at — "Mời lên" stays theirs.
   */
  test("the 👁 picks whose arrived patients a doctor sees, kept on this device (R-1164)", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const fixture = await setUp(page, branchId);
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];
    const id = `${runId()}${test.info().workerIndex}`;
    const peerRole = `Bác sĩ xem ${id}`;
    fixture.roleIds.push(await createRole(page, peerRole, [...BOARD_GRANTS, EDIT_GRANT]));
    const peer = await createUser(page, branchId, `mlbx${id}`, peerRole, true);

    try {
      // The other arrived visit belongs to a second run doctor.
      const handed = await call(page, branchId, `${APPOINTMENTS}/${fixture.otherVisit.id}/assign-dentist`, {
        method: "POST",
        json: { dentistId: peer.id },
      });
      expect(handed.status, "hand the other visit to the peer doctor").toBe(200);

      const doctor = await openAs(browser, fixture.doctor.userName, "/reception");
      const receptionist = await openAs(browser, fixture.receptionist.userName, "/calendar/list");
      sessions.push(doctor, receptionist);

      // The API: a doctor gets the branch's doctors and any doctor's arrivals; reception gets neither.
      const doctors = await call<{ id: string; name: string }[]>(doctor.page, branchId, `${ARRIVAL_CALLS}/doctors`);
      expect(doctors.status).toBe(200);
      expect(doctors.body.map((d) => d.id)).toEqual(expect.arrayContaining([fixture.doctor.id, peer.id]));
      expect(doctors.body.find((d) => d.id === peer.id)?.name).toBe(peer.userName);
      const doctorsForDesk = await call<unknown[]>(receptionist.page, branchId, `${ARRIVAL_CALLS}/doctors`);
      expect(doctorsForDesk.status).toBe(200);
      expect(doctorsForDesk.body, "reception picks no doctors").toEqual([]);
      const peerArrivals = await call<{ id: string }[]>(doctor.page, branchId, `${ARRIVAL_CALLS}/waiting?dentistIds=${peer.id}`);
      expect(peerArrivals.body.map((a) => a.id)).toEqual([fixture.otherVisit.id]);
      const ownArrivals = await call<{ id: string }[]>(doctor.page, branchId, `${ARRIVAL_CALLS}/waiting`);
      expect(ownArrivals.body.map((a) => a.id), "nothing picked: own patients").toEqual([fixture.ownVisit.id]);
      // Looking is not calling up: "Mời lên" on the peer's patient is still refused.
      const inviteOther = await call(doctor.page, branchId, `${ARRIVAL_CALLS}/${fixture.otherVisit.id}/invite`, { method: "POST" });
      expect(inviteOther.status, "a doctor cannot call up another doctor's patient").toBe(403);

      // Never picked: the doctor sees their own patient, ticked in the 👁.
      const desk = doctor.page;
      await dockButton(desk).click();
      await expect(rowOf(desk, fixture.ownVisit)).toBeVisible();
      await expect(rowOf(desk, fixture.otherVisit)).toHaveCount(0);
      const eye = section(desk, "Khách đã đến").getByRole("button", { name: "Chọn bác sĩ hiển thị" });
      await eye.click();
      const picker = desk.locator(".arrival-doctor-pick");
      await expect(picker).toBeVisible();
      await expect(picker.getByRole("checkbox", { name: fixture.doctor.userName })).toBeChecked();
      await expect(picker.getByRole("checkbox", { name: peer.userName })).not.toBeChecked();

      // Search, tick the peer: both patients, only the own one with "Mời lên".
      await picker.getByPlaceholder("Tìm bác sĩ...").fill(peer.userName);
      await expect(picker.getByRole("checkbox", { name: fixture.doctor.userName })).toHaveCount(0);
      await picker.getByRole("checkbox", { name: peer.userName }).check();
      await expect(panel(desk), "ticking keeps the panel open").toBeVisible();
      await expect(rowOf(desk, fixture.otherVisit)).toBeVisible();
      await expect(rowOf(desk, fixture.otherVisit).locator(".arrival-row-doctor")).toContainText(peer.userName);
      await expect(rowOf(desk, fixture.otherVisit).getByRole("button", { name: "Mời lên" })).toHaveCount(0);
      await expect(rowOf(desk, fixture.ownVisit).getByRole("button", { name: "Mời lên" })).toBeVisible();
      // The badge still counts only what waits for this doctor's click.
      await expect(dockButton(desk).locator(".arrival-dock-badge")).toHaveText("1");

      // Kept on this device: after a reload the pick stands.
      await desk.reload();
      await dockButton(desk).click();
      await expect(rowOf(desk, fixture.otherVisit)).toBeVisible();
      await expect(rowOf(desk, fixture.ownVisit)).toBeVisible();

      // Nothing ticked: the list says so.
      await section(desk, "Khách đã đến").getByRole("button", { name: "Chọn bác sĩ hiển thị" }).click();
      const all = picker.getByRole("checkbox", { name: "Tất cả bác sĩ" });
      for (const name of [fixture.doctor.userName, peer.userName]) {
        await picker.getByRole("checkbox", { name }).uncheck();
      }
      await expect(all).not.toBeChecked();
      await expect(section(desk, "Khách đã đến")).toContainText("Chưa chọn bác sĩ nào");
      await expect(section(desk, "Khách đã đến").locator(".arrival-row")).toHaveCount(0);
      await expect(dockButton(desk).locator(".arrival-dock-badge")).toHaveCount(0);

      // "Tất cả bác sĩ": every doctor's.
      await all.check();
      await expect(picker.getByRole("checkbox", { name: peer.userName })).toBeChecked();
      await expect(rowOf(desk, fixture.ownVisit)).toBeVisible();
      await expect(rowOf(desk, fixture.otherVisit)).toBeVisible();
      // The 👁 again folds the list away; the rows stay as picked.
      await section(desk, "Khách đã đến").getByRole("button", { name: "Chọn bác sĩ hiển thị" }).click();
      await expect(picker).toHaveCount(0);
      await expect(rowOf(desk, fixture.otherVisit)).toBeVisible();

      // Reception's "Bác sĩ mời lên" has no 👁 and is not filtered.
      await dockButton(receptionist.page).click();
      await expect(panel(receptionist.page)).toContainText("Bác sĩ mời lên");
      await expect(panel(receptionist.page).getByRole("button", { name: "Chọn bác sĩ hiển thị" })).toHaveCount(0);
    } finally {
      for (const session of sessions) await session.context.close();
      await plainCall(page, `${STAFF}/${peer.id}`, { method: "DELETE" });
      await tearDown(page, branchId, fixture);
    }
  });

  test("before the first click the dock says sound is off, and a chime the browser refused blinks it (R-1145)", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const fixture = await setUp(page, branchId);
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];

    try {
      const doctor = await openAs(browser, fixture.doctor.userName, "/reception");
      // Reception just opened the page: no click yet, the list not opened.
      const receptionist = await openAs(browser, fixture.receptionist.userName, "/reception", { noClick: "blocked" });
      sessions.push(doctor, receptionist);
      const desk = receptionist.page;

      // The muted bell, and its hint on hover (a hover is no click).
      await expect(mutedBell(desk)).toBeVisible();
      await dockButton(desk).hover();
      await expect(desk.getByRole("tooltip")).toHaveText(SOUND_OFF_HINT);
      await expect(mutedBell(doctor.page), "the chime is not for the doctor").toHaveCount(0);
      await expect(dockButton(desk)).not.toHaveClass(/arrival-dock-button--missed/);
      // The list the call-up is compared with has loaded.
      await expect
        .poll(() =>
          desk.evaluate(() =>
            performance.getEntriesByType("resource").some((entry) => entry.name.includes("/arrival-calls/invited")),
          ),
        )
        .toBe(true);

      // The doctor calls the patient up; the browser refuses the chime.
      await dockButton(doctor.page).click();
      await rowOf(doctor.page, fixture.ownVisit).getByRole("button", { name: "Mời lên" }).click();
      await expect(doctor.page.getByText("Đã mời bệnh nhân lên")).toBeVisible();
      await expect
        .poll(() => chimesPlayed(desk), { message: "one chime, tried and refused", timeout: 15_000 })
        .toEqual([expect.stringMatching(/^blocked:https?:\/\/[^/]+\/sounds\/invite-chime\.mp3$/)]);
      // So the dock blinks instead, with the list still closed.
      await expect(dockButton(desk)).toHaveClass(/arrival-dock-button--missed/);
      await expect(panel(desk)).toHaveCount(0);

      // One click anywhere turns sound on: the bell goes, the blink stays
      // until the list is seen.
      await desk.locator("main.app-content").click({ position: { x: 5, y: 5 } });
      await expect(mutedBell(desk)).toHaveCount(0);
      await expect(dockButton(desk)).toHaveClass(/arrival-dock-button--missed/);

      // Opening the list shows the patient and stops the blink, for good.
      await dockButton(desk).click();
      await expect(rowOf(desk, fixture.ownVisit)).toBeVisible();
      await expect(dockButton(desk)).not.toHaveClass(/arrival-dock-button--missed/);
      await desk.locator("main.app-content").click({ position: { x: 5, y: 5 } });
      await expect(panel(desk)).toHaveCount(0);
      await expect(dockButton(desk)).not.toHaveClass(/arrival-dock-button--missed/);

      // F5 is a fresh page: sound is off again until the next click, and the
      // patient already on the list neither rings nor blinks.
      await desk.reload();
      await expect(mutedBell(desk)).toBeVisible();
      await expect(dockButton(desk).locator(".arrival-dock-badge")).not.toHaveCount(0);
      expect(await chimeCount(desk), "no chime after a reload").toBe(0);
      await expect(dockButton(desk)).not.toHaveClass(/arrival-dock-button--missed/);
    } finally {
      for (const session of sessions) await session.context.close();
      await tearDown(page, branchId, fixture);
    }
  });

  test("a browser that lets the site play sound shows no muted bell, and rings with no click (R-1145)", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const fixture = await setUp(page, branchId);
    const sessions: Awaited<ReturnType<typeof openAs>>[] = [];

    try {
      const doctor = await openAs(browser, fixture.doctor.userName, "/reception");
      // F5 with the site in Chrome/Edge's AutoplayAllowlist: no click, yet sound may play.
      const receptionist = await openAs(browser, fixture.receptionist.userName, "/reception", { noClick: "allowed" });
      sessions.push(doctor, receptionist);
      const desk = receptionist.page;

      await expect(dockButton(desk)).toBeVisible();
      await expect(mutedBell(desk), "the silent check found sound allowed").toHaveCount(0);
      expect(await desk.evaluate(() => navigator.userActivation.hasBeenActive), "still no click").toBe(false);
      expect(await chimeCount(desk), "the silent check is no chime").toBe(0);
      await expect
        .poll(() =>
          desk.evaluate(() =>
            performance.getEntriesByType("resource").some((entry) => entry.name.includes("/arrival-calls/invited")),
          ),
        )
        .toBe(true);

      // The call-up rings, really played, with no click on the page and no blink.
      await dockButton(doctor.page).click();
      await rowOf(doctor.page, fixture.ownVisit).getByRole("button", { name: "Mời lên" }).click();
      await expect(doctor.page.getByText("Đã mời bệnh nhân lên")).toBeVisible();
      await expect
        .poll(() => chimesPlayed(desk), { message: "one chime, played", timeout: 15_000 })
        .toEqual([expect.stringMatching(/^https?:\/\/[^/]+\/sounds\/invite-chime\.mp3$/)]);
      await expect(dockButton(desk)).not.toHaveClass(/arrival-dock-button--missed/);
      expect(await desk.evaluate(() => navigator.userActivation.hasBeenActive), "still no click").toBe(false);
    } finally {
      for (const session of sessions) await session.context.close();
      await tearDown(page, branchId, fixture);
    }
  });

  test("a called-up Lịch tạm gets its record before Tiếp nhận", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await login(page);
    const branchId = await openBoard(page);
    const id = `${runId()}${test.info().workerIndex}`;
    const doctorRole = `Bác sĩ lịch tạm ${id}`;
    const roleId = await createRole(page, doctorRole, [...BOARD_GRANTS, EDIT_GRANT]);
    const doctor = await createUser(page, branchId, `mltam${id}`, doctorRole, true);

    const name = `E2E TAM MOI ${id}`;
    const start = new Date(Date.now() + 40 * 60_000);
    start.setSeconds(0, 0);
    test.skip(start.getDate() !== new Date().getDate(), "too close to midnight to book for today");
    const booked = await call<Appointment>(page, branchId, `${APPOINTMENTS}/temp`, {
      method: "POST",
      json: { patientName: name, patientPhone: `09${id.slice(-8).padStart(8, "0")}`, branchId, slotStart: start, slotEnd: new Date(start.getTime() + 15 * 60_000) },
    });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);
    const visitId = booked.body.id;
    let doctorSession: Awaited<ReturnType<typeof openAs>> | undefined;

    try {
      const assigned = await call(page, branchId, `${APPOINTMENTS}/${visitId}/assign-dentist`, { method: "POST", json: { dentistId: doctor.id } });
      expect(assigned.status, "hand the walk-in to the run doctor").toBe(200);
      expect((await call(page, branchId, `${APPOINTMENTS}/${visitId}/check-in`, { method: "POST" })).status).toBe(200);
      doctorSession = await openAs(browser, doctor.userName, "/reception");
      const invited = await call(doctorSession.page, branchId, `${ARRIVAL_CALLS}/${visitId}/invite`, { method: "POST" });
      expect(invited.status, "the doctor calls the walk-in up").toBe(200);

      // The admin (not ticked Bác sĩ) gets "Tạo hồ sơ", not "Tiếp nhận".
      await page.goto("/calendar/list");
      await dockButton(page).click();
      const row = section(page, "Bác sĩ mời lên").locator(".arrival-row").filter({ hasText: name });
      await expect(row.locator(".arrival-row-temp")).toHaveText("Lịch tạm");
      await expect(row).toContainText("Lịch tạm: tạo hồ sơ trước khi tiếp nhận");
      await expect(row.getByRole("button", { name: "Tiếp nhận" })).toHaveCount(0);

      // The server refuses to seat it before the record exists.
      const early = await call<{ error?: { code?: string } }>(page, branchId, `${ARRIVAL_CALLS}/${visitId}/admit`, { method: "POST" });
      expect(early.status, "no Tiếp nhận for a Lịch tạm").not.toBe(200);
      expect(early.body.error?.code).toBe("BlueDental:Appointment:0018");

      // "Tạo hồ sơ" opens the record form filled in; saving it attaches the record.
      await row.getByRole("button", { name: "Tạo hồ sơ" }).click();
      const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
      await expect(dialog.getByRole("textbox", { name: /Họ và tên/ })).toHaveValue(name);
      const attached = page.waitForResponse(
        (r) => r.url().endsWith(`${APPOINTMENTS}/${visitId}/attach-patient`) && r.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Lưu" }).click();
      expect((await attached).status()).toBe(200);
      await expect(dialog).toBeHidden();

      // The same row now seats the patient.
      await expect(row.locator(".arrival-row-temp")).toHaveCount(0);
      await row.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(page.getByText("Đã tiếp nhận bệnh nhân")).toBeVisible();
      await expect(row).toHaveCount(0);

      const stored = await getAppointment(page, branchId, visitId);
      expect(stored.status, "Đang khám").toBe(4);
      expect(stored.isTemporary).toBe(false);
    } finally {
      await doctorSession?.context.close();
      await plainCall(page, `${APPOINTMENTS}/${visitId}`, { method: "DELETE", branchId });
      await plainCall(page, `${STAFF}/${doctor.id}`, { method: "DELETE" });
      await plainCall(page, `${ROLES}/${roleId}`, { method: "DELETE" });
    }
  });

  test("an admin sees both lists, for every doctor, and does both steps", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 160, "e2e-admin-moilen");

    try {
      expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" })).status).toBe(200);

      // The seeded admin is not ticked "Bác sĩ", yet gets both lists, after a reload too.
      await page.addInitScript(countChimes);
      await page.goto("/calendar/list");
      await page.reload();
      await dockButton(page).click();
      const waiting = section(page, "Khách đã đến");
      const invited = section(page, "Bác sĩ mời lên");
      await expect(waiting).toBeVisible();
      await expect(invited).toBeVisible();

      // "Mời lên" for another doctor's patient, then "Tiếp nhận" from the other list.
      const waitingRow = waiting.locator(".arrival-row").filter({ hasText: visit.searchKey });
      await waitingRow.getByRole("button", { name: "Mời lên" }).click();
      await expect(page.getByText("Đã mời bệnh nhân lên")).toBeVisible();
      await expect(waitingRow).toContainText("Đã mời");

      const seatRow = invited.locator(".arrival-row").filter({ hasText: visit.searchKey });
      await expect(seatRow).toBeVisible();
      // The admin called this one up themselves: no ring for their own click (R-1144).
      expect(await chimeCount(page), "no chime for one's own Mời lên").toBe(0);
      await seatRow.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(page.getByText("Đã tiếp nhận bệnh nhân")).toBeVisible();
      await expect(seatRow).toHaveCount(0);
      await expect(waitingRow).toHaveCount(0);

      const stored = await getAppointment(page, branchId, visit.id);
      expect(stored.status, "Đang khám").toBe(4);
    } finally {
      await plainCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
    }
  });

  /**
   * R-1156 (BA 2026-11-06): each row runs the card's "Đang chờ" clock, from the
   * server's check-in stamp, in both lists, on any page. Only the browser's
   * clock is moved forward, as in `reception-wait-time`.
   */
  test("every row runs the card's wait clock, on any page, until the chair takes them", async ({ page }) => {
    test.setTimeout(180_000);
    await page.clock.install();
    await login(page);
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 170, "e2e-cho-noi");

    try {
      expect((await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" })).status).toBe(200);

      // Not Tiếp nhận: the chip carries its own styles wherever the panel opens.
      await page.goto("/calendar/list");
      await dockButton(page).click();
      const waitingRow = section(page, "Khách đã đến").locator(".arrival-row").filter({ hasText: visit.searchKey });
      const timer = waitingRow.getByRole("timer");
      await expect(timer).toHaveText(/^Đang chờ 00:\d\d$/);
      await expect(timer).toHaveClass(/rc-wait-chip--normal/);
      await expect(timer).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(timer).toHaveCSS("border-radius", /px/);

      const shown = (await timer.textContent()) ?? "";
      await page.clock.fastForward(3_000);
      await expect(timer).not.toHaveText(shown);

      await page.clock.fastForward("05:00");
      await expect(timer).toHaveText(/^Đang chờ 05:\d\d$/);
      await expect(timer).toHaveClass(/rc-wait-chip--warning/);

      // Called up, the patient still waits: the clock follows them into "Bác sĩ mời lên".
      await waitingRow.getByRole("button", { name: "Mời lên" }).click();
      await expect(page.getByText("Đã mời bệnh nhân lên")).toBeVisible();
      const seatRow = section(page, "Bác sĩ mời lên").locator(".arrival-row").filter({ hasText: visit.searchKey });
      await expect(seatRow.getByRole("timer")).toHaveText(/^Đang chờ 05:\d\d$/);

      await page.clock.fastForward("05:00");
      await expect(seatRow.getByRole("timer")).toHaveText(/^Chờ quá lâu 10:\d\d$/);
      await expect(seatRow.getByRole("timer")).toHaveClass(/rc-wait-chip--overdue/);

      // Counted from the stored check-in, not from when the panel opened.
      await page.reload();
      await dockButton(page).click();
      const reloadedRow = section(page, "Bác sĩ mời lên").locator(".arrival-row").filter({ hasText: visit.searchKey });
      await expect(reloadedRow.getByRole("timer")).toHaveText(/^Chờ quá lâu 10:\d\d$/);

      // Seated: the row, and its clock, leave the panel.
      await reloadedRow.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(page.getByText("Đã tiếp nhận bệnh nhân")).toBeVisible();
      await expect(reloadedRow).toHaveCount(0);
      expect((await getAppointment(page, branchId, visit.id)).status, "Đang khám").toBe(4);
    } finally {
      await plainCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
    }
  });
});
