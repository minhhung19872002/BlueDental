import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { OFF, setDayOff } from "./fixtures/lichNghi";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";
import { openBlockEditor } from "./fixtures/calendarBlock";

/**
 * Feature: Lịch hẹn khách hàng — view Ngày as a doctor timeline (BA
 * 2026-10-03, turned round 2026-10-16): doctors are columns with a patient
 * count beside the name, time runs 07:00–20:00 top to bottom, a mouse drag
 * only scrolls the board sideways, a doctor off all day on Lịch nghỉ has no
 * column, a cancelled booking is neither drawn nor counted, a "Lịch tạm" with
 * no doctor sits in a last "Chưa chọn bác sĩ" column (walk-ins counted by
 * name), and a booking's colour follows its state.
 *
 * Real stack: the run's dentists and bookings are written through the real
 * API, the day off is saved through the real Lịch nghỉ board, and the
 * board reads the real `/appointments` and `/staff` lists. Nothing is
 * intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  slotStart: string;
  patientCode: string | null;
}

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

/** Laid-out pixels agree within one, whatever the browser rounds subpixels to. */
function expectNear(actual: number, expected: number): void {
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected}`).toBeLessThanOrEqual(1);
}

/** The branch the calendar is showing, read off its own request. */
async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  return (await request).headers()["x-clinic-branch-id"];
}

/**
 * Books `dentistId` with the first patient the server accepts at that time; `content` is its Nội dung đặt lịch.
 * `overlap` confirms the doctor's double-booking warning (R-971) the way Xác nhận does.
 */
async function book(
  page: Page,
  branchId: string,
  dentistId: string,
  slotStart: string,
  slotEnd: string,
  content = `e2e-timeline-${runId()}`,
  overlap = false,
): Promise<Booking> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId: patient.id, dentistId, branchId, slotStart, slotEnd, type: 2,
        ...(content ? { chiefComplaint: content } : {}),
        ...(overlap ? { allowDentistOverlap: true } : {}),
      },
    });
    if (res.status === 200) return res.body;
    lastError = res.body.error;
  }
  throw new Error(`no booking could be made: ${JSON.stringify(lastError)}`);
}

interface ColumnState {
  name: string;
  unassigned: boolean;
  blocks: number;
}

/** The board's columns left to right: name, whether it is "Chưa chọn bác sĩ", how many blocks it draws. */
async function columnStates(page: Page): Promise<ColumnState[]> {
  return page.locator(".dtl-col").evaluateAll((cols) =>
    cols.map((c) => ({
      name: c.querySelector(".dtl-name")?.textContent?.trim() ?? "",
      unassigned: c.classList.contains("dtl-col--unassigned"),
      blocks: c.querySelectorAll(".dtl-block").length,
    })),
  );
}

/** Opens view Ngày on `day` and waits for that day's bookings to arrive. */
async function openDay(page: Page, day: string): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  await expect(page.locator(".dtl-col").first()).toBeVisible();
}

test.describe("Lịch hẹn — view Ngày dạng timeline bác sĩ theo cột", () => {
  let branchId: string;
  let working: RunStaff;
  let off: RunStaff & { userName: string };
  let workingName: string;
  let offName: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    workingName = `BSTimeline${run}`;
    offName = `BSNghiTL${run}`;
    working = await createRunStaff(page, branchId, `tlon${run}`, { name: workingName, isDentist: true });
    const created = await createRunStaff(page, branchId, `tloff${run}`, { name: offName, isDentist: true, roleNames: ["admin"] });
    off = { ...created, userName: `tk-e2e-tloff${run}` };
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    for (const s of [working, off]) if (s) await deleteStaff(page, s.id);
  });

  test("doctors are columns: nghỉ cả ngày on Lịch nghỉ has none (R-1210), a booking sits in its doctor's column, is counted and survives a reload", async ({ page }) => {
    const day = shiftDays(clinicToday(), 6);
    await setDayOff(page, branchId, off.id, day, OFF.FullDay);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    // BA: "đã hủy không hiện ở đây" — a cancelled booking leaves no block.
    const cancelled = await book(page, branchId, working.id, at(day, "10:00"), at(day, "10:30"));
    bookings.push(cancelled.id);
    const cancel = await call(page, `${APPOINTMENTS}/${cancelled.id}/cancel`, { method: "POST", branchId, json: { reason: 1, note: "e2e" } });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);

    await openDay(page, day);
    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    await expect(column).toHaveCount(1);
    // Nghỉ cả ngày takes the doctor's column away (R-1210).
    await expect(page.locator(".dtl-col").filter({ hasText: offName })).toHaveCount(0);

    // The time column shows the viewer's hours (R-977 default 08:00–18:45); the column is headed by the
    // doctor's full name (Tên + Họ, as the staff list returns it) and the
    // patient count — the cancelled booking is not counted.
    await expect(page.locator(".dtl-tick").first()).toHaveText("08:00");
    await expect(page.locator(".dtl-tick").last()).toHaveText("18:45");
    await expect(column.locator(".dtl-name")).toHaveText(working.fullName);
    await expect(column.locator(".dtl-count")).toHaveText("1");

    // Time runs down the column: 09:00 sits straight below 08:00, both under the name.
    const name = await column.locator(".dtl-doc").boundingBox();
    const eight = await column.locator('.dtl-cell[data-time="08:00"]').boundingBox();
    const nine = await column.locator('.dtl-cell[data-time="09:00"]').boundingBox();
    if (!name || !eight || !nine) throw new Error("the doctor's column is not laid out");
    expect(nine.x).toBe(eight.x);
    expect(nine.y).toBeGreaterThan(eight.y);
    expect(eight.y).toBeGreaterThanOrEqual(name.y + name.height - 1);

    const block = column.locator(".dtl-block");
    await expect(block).toHaveCount(1);
    await expect(block).toHaveAttribute("aria-label", new RegExp(booking.patientCode ?? ""));
    await expect(block).toHaveClass(/dtl-block--booked/);

    // The count follows the toolbar search, like the blocks it counts.
    const search = page.locator(".cal-search-field input");
    await search.fill(`khong-co-${runId()}`);
    await expect(block).toHaveCount(0);
    // A doctor with nobody shows no chip at all, not a 0.
    await expect(column.locator(".dtl-count")).toHaveCount(0);
    await search.fill("");
    await expect(column.locator(".dtl-count")).toHaveText("1");

    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block")).toHaveCount(1);

    // ⋮ → Cập nhật opens its booking (a click on the block opens the patient, R-1149).
    await openBlockEditor(page, page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block"));
    await expect(page.getByRole("dialog", { name: "Cập nhật lịch hẹn" })).toBeVisible();
  });

  test("a booking's content shows under the name, line breaks kept, cut where the block ends, and follows an edit", async ({ page }) => {
    const day = shiftDays(clinicToday(), 10);
    const id = runId();
    const firstLine = `Nội dung ${id}`;
    const tail = `cuối-${id}`;
    // Two lines as typed; the second runs well past the three lines a 30-minute block has room for.
    const content = `${firstLine}\n${"Niềng răng tái khám chỉnh mắc cài ".repeat(8)}${tail}`;
    const withContent = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"), content);
    bookings.push(withContent.id);
    const withoutContent = await book(page, branchId, working.id, at(day, "10:00"), at(day, "10:30"), "");
    bookings.push(withoutContent.id);

    await openDay(page, day);
    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    const block = column.locator(".dtl-block").filter({ hasText: firstLine });
    const note = block.locator(".dtl-block-note");
    await expect(note).toBeVisible();
    // The typed line break survives: the first line stands alone.
    expect((await note.evaluate((el) => (el as HTMLElement).innerText)).split("\n")[0]).toBe(firstLine);

    // Too long for the block: cut inside it, the rest still hidden in the text box...
    const blockBox = await block.boundingBox();
    const noteBox = await note.boundingBox();
    if (!blockBox || !noteBox) throw new Error("the block is not laid out");
    expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(blockBox.y + blockBox.height);
    expect(await note.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    // ...and whole in the tooltip.
    await block.hover();
    await expect(page.locator(".dtl-tip-note")).toContainText(tail);

    // No content, no second line: the block holds the name alone.
    const plain = column.locator(".dtl-block").filter({ hasNot: page.locator(".dtl-block-note") });
    await expect(plain).toHaveCount(1);

    await page.reload();
    await expect(column.locator(".dtl-block-note")).toHaveCount(1);
    await expect(block.locator(".dtl-block-note")).toContainText(firstLine);

    // An edit in Cập nhật lịch hẹn shows on the board once saved.
    await openBlockEditor(page, block);
    const edit = page.getByRole("dialog", { name: "Cập nhật lịch hẹn" });
    // The form is reset once the booking arrives; type only after that.
    await expect(edit.getByPlaceholder("Nội dung đặt lịch")).toHaveValue(content);
    const updated = `Đã sửa ${id}`;
    await edit.getByPlaceholder("Nội dung đặt lịch").fill(updated);
    const put = page.waitForResponse((res) => res.url().includes(APPOINTMENTS) && res.request().method() === "PUT");
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(edit).toBeHidden();
    await expect(column.locator(".dtl-block-note")).toHaveText(updated);
    await expect(column.locator(".dtl-block").filter({ hasNot: page.locator(".dtl-block-note") })).toHaveCount(1);
  });

  test("only bookings that overlap share the column: a lone one takes the whole width, one with free lanes beside it widens into them", async ({ page }) => {
    // R-1147, BA 2026-11-05: "Mấy lịch không trùng khung giờ có thể bung hết view".
    const day = shiftDays(clinicToday(), 11);
    const id = runId();
    // 09:00–10:00 three deep (lanes 0, 1, 2); the 09:30 one takes lane 1 once its 09:00–09:30 owner is done
    // and widens over lane 2, whose 09:00–09:15 booking is over by then. 11:00 overlaps nobody.
    const layout = [
      { key: "long", from: "09:00", to: "10:00" },
      { key: "half", from: "09:00", to: "09:30" },
      { key: "quarter", from: "09:00", to: "09:15" },
      { key: "late", from: "09:30", to: "10:00" },
      { key: "lone", from: "11:00", to: "11:30" },
    ];
    for (const { key, from, to } of layout) {
      const booking = await book(page, branchId, working.id, at(day, from), at(day, to), `${key}-${id}`, true);
      bookings.push(booking.id);
    }

    await openDay(page, day);
    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    await expect(column.locator(".dtl-block")).toHaveCount(layout.length);
    const track = await column.locator(".dtl-track").boundingBox();
    if (!track) throw new Error("the doctor's column is not laid out");
    const box = async (key: string) => {
      const found = await column.locator(".dtl-block").filter({ hasText: `${key}-${id}` }).boundingBox();
      if (!found) throw new Error(`block ${key} is not laid out`);
      return found;
    };
    // Each block keeps a 3px gutter on both sides of its lanes.
    const lanesWide = (lanes: number, of: number) => (track.width * lanes) / of - 6;

    const lone = await box("lone");
    expectNear(lone.width, lanesWide(1, 1));
    expectNear(lone.x, track.x + 3);

    const long = await box("long");
    const half = await box("half");
    const quarter = await box("quarter");
    for (const third of [long, half, quarter]) expectNear(third.width, lanesWide(1, 3));
    expect([long.x, half.x, quarter.x]).toEqual([...[long.x, half.x, quarter.x]].sort((a, b) => a - b));

    const late = await box("late");
    expectNear(late.x, half.x);
    expectNear(late.width, lanesWide(2, 3));

    // The column is still wide enough for three readable lanes.
    expect(track.width).toBeGreaterThanOrEqual(3 * 110 - 1);

    await page.reload();
    await expect(column.locator(".dtl-block")).toHaveCount(layout.length);
    expectNear((await box("lone")).width, lanesWide(1, 1));
  });

  test("clicking an empty slot opens Tạo lịch hẹn for that doctor and time", async ({ page }) => {
    const day = shiftDays(clinicToday(), 7);
    await openDay(page, day);

    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    await column.locator('.dtl-cell[data-time="08:00"]').click();

    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("HH:mm")).toHaveValue("08:00");
    await expect(dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ|Bác sĩ/ }).first()).toContainText(workingName);
  });

  test("a Lịch tạm with no doctor sits in a last 'Chưa chọn bác sĩ' column, counted by name, whose slots book no one", async ({ page }) => {
    const day = shiftDays(clinicToday(), 9);
    const name = `E2E TAM TL ${runId()}`;
    // The same walk-in twice (case and spacing aside) and a second walk-in: two people.
    const walkIns = [
      { patientName: name, time: "09:00" },
      { patientName: `  ${name.toLowerCase().replace(/ /g, "  ")} `, time: "10:00" },
      { patientName: `${name} B`, time: "11:00" },
    ];
    for (const w of walkIns) {
      const res = await call<Booking>(page, `${APPOINTMENTS}/temp`, {
        method: "POST",
        branchId,
        json: { patientName: w.patientName, branchId, slotStart: at(day, w.time), slotEnd: at(day, `${w.time.slice(0, 2)}:30`) },
      });
      expect(res.status, JSON.stringify(res.body.error)).toBe(200);
      bookings.push(res.body.id);
    }

    await openDay(page, day);
    const column = page.locator(".dtl-col--unassigned");
    await expect(column).toHaveCount(1);
    await expect(column.locator(".dtl-name")).toHaveText("Chưa chọn bác sĩ");
    await expect(column.locator(".dtl-doc")).toHaveAttribute("title", /Lịch tạm chưa gán bác sĩ/);
    await expect(column.locator(".dtl-block").filter({ hasText: name })).toHaveCount(3);
    // R-1173: it comes after every doctor with a booking and before those with none.
    const states = await columnStates(page);
    const unassignedAt = states.findIndex((c) => c.unassigned);
    expect(states.slice(0, unassignedAt).every((c) => c.blocks > 0), JSON.stringify(states)).toBe(true);
    expect(states.slice(unassignedAt + 1).every((c) => c.blocks === 0), JSON.stringify(states)).toBe(true);
    expect(states.findIndex((c) => c.name === working.fullName)).toBeGreaterThan(unassignedAt);
    // Only this run's walk-ins can sit here on a day this far out; they are two people.
    await expect(column.locator(".dtl-count")).toHaveText("2");

    // An empty slot there has no doctor to book for: nothing opens.
    await column.locator('.dtl-cell[data-time="15:00"]').click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // ⋮ → Cập nhật still opens its booking, to put a doctor on it.
    await openBlockEditor(page, column.locator(".dtl-block").first());
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("doctors with no booking that day move to the end; a search does not reorder; a cancel-only doctor counts as free", async ({ page }) => {
    // R-1173, BA 2026-11-09: "bác nào không có lịch hẹn thì đẩy về cuối hết. Có thì giữ vị trí sắp xếp như cũ."
    const day = shiftDays(clinicToday(), 12);
    // Both run dentists work that day; only `off` (despite its name, not OFF here) gets a live booking.
    const live = await book(page, branchId, off.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(live.id);
    const cancelled = await book(page, branchId, working.id, at(day, "10:00"), at(day, "10:30"));
    bookings.push(cancelled.id);
    const cancel = await call(page, `${APPOINTMENTS}/${cancelled.id}/cancel`, { method: "POST", branchId, json: { reason: 1, note: "e2e" } });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);

    await openDay(page, day);
    await expect(page.locator(".dtl-col").filter({ hasText: offName }).locator(".dtl-block")).toHaveCount(1);
    const expectBusyFirst = async () => {
      const states = (await columnStates(page)).filter((c) => !c.unassigned);
      const firstIdle = states.findIndex((c) => c.blocks === 0);
      expect(firstIdle, JSON.stringify(states)).toBeGreaterThan(-1);
      expect(states.slice(firstIdle).every((c) => c.blocks === 0), JSON.stringify(states)).toBe(true);
      const busyAt = states.findIndex((c) => c.name === off.fullName);
      const idleAt = states.findIndex((c) => c.name === working.fullName);
      expect(busyAt).toBeGreaterThan(-1);
      expect(busyAt).toBeLessThan(firstIdle);
      // The cancelled booking is not drawn, so its doctor is among the free ones at the end.
      expect(idleAt).toBeGreaterThanOrEqual(firstIdle);
      return states.map((c) => c.name);
    };
    const order = await expectBusyFirst();

    // Searching hides the blocks but leaves the columns where they were.
    await page.locator(".cal-search-field input").fill(`khong-co-${runId()}`);
    await expect(page.locator(".dtl-block")).toHaveCount(0);
    expect((await columnStates(page)).filter((c) => !c.unassigned).map((c) => c.name)).toEqual(order);
    await page.locator(".cal-search-field input").fill("");

    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: offName }).locator(".dtl-block")).toHaveCount(1);
    expect(await expectBusyFirst()).toEqual(order);
  });

  test("a mouse drag scrolls the board sideways and moves no booking", async ({ page }) => {
    const day = shiftDays(clinicToday(), 8);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    // Narrow enough that the branch's doctor columns overflow the board.
    await page.setViewportSize({ width: 1000, height: 900 });
    await openDay(page, day);

    const board = page.locator(".dtl-scroll");
    await expect(board).toHaveClass(/has-horizontal-scroll/);
    expect(await board.evaluate((el) => el.scrollLeft)).toBe(0);

    // The leftmost column has the whole board to its right to scroll into.
    // 12:00–13:00 is the default break (R-1005), folded out of the board.
    const cell = page.locator(".dtl-col").first().locator('.dtl-cell[data-time="13:00"]');
    // Time runs down the board: bring 13:00 up before pressing on it.
    await cell.scrollIntoViewIfNeeded();
    // Bringing it up may nudge the board a few pixels sideways; measure from there.
    const before = await board.evaluate((el) => el.scrollLeft);
    const room = await board.evaluate((el) => el.scrollWidth - el.clientWidth);
    const box = await cell.boundingBox();
    if (!box) throw new Error("the 13:00 slot is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 500, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => board.evaluate((el) => el.scrollLeft)).toBeGreaterThanOrEqual(Math.min(before + 300, room));
    expect(room - before, "the board should have room to scroll sideways").toBeGreaterThan(100);
    // Letting go over a slot does not open the create dialog...
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // ...and the booking is where it was.
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${booking.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString()).toBe(new Date(booking.slotStart).toISOString());
  });

  test("today: the now line and its badge move exactly when the clock turns a minute", async ({ page }) => {
    // Ten seconds before a minute turns, on today's real date (the board's data stays real).
    const start = new Date();
    if (start.getSeconds() >= 45) start.setMinutes(start.getMinutes() + 1);
    start.setSeconds(50, 0);
    test.skip(start.getHours() < 7 || start.getHours() >= 19, "outside the board's working hours");
    // R-1005: the default 12:00–13:00 break is folded out, the now line with it.
    test.skip(start.getHours() === 12, "inside the default break, where no now line is drawn");
    await page.clock.install({ time: start });
    await openDay(page, clinicToday());

    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const next = new Date(start.getTime() + 10_000);
    const badge = page.locator(".dtl-now-badge");
    const line = page.locator(".dtl-now-line");
    await expect(badge).toHaveText(hhmm(start));
    const before = await line.boundingBox();

    // Still inside the minute: nothing moves.
    await page.clock.runFor(8_000);
    await expect(badge).toHaveText(hhmm(start));

    // The minute turns: badge and line follow at once, no 30-second lag.
    await page.clock.runFor(3_000);
    await expect(badge).toHaveText(hhmm(next));
    const after = await line.boundingBox();
    if (!before || !after) throw new Error("the now line is not drawn");
    expect(after.y).toBeGreaterThan(before.y);
  });

  test("today: a checked-in patient is waiting, a started visit is in progress, and now is marked", async ({ page }) => {
    const start = new Date(Date.now() + 5 * 60_000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const clinicDayOfEnd = new Date(end.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    test.skip(clinicDayOfEnd !== clinicToday(), "too close to midnight to book a visit for today");
    // R-1005: the default 12:00–13:00 break is folded out, the now line with it.
    test.skip(new Date().getHours() === 12, "inside the default break, where no now line is drawn");
    expect(await openShiftCovering(page, branchId, working.id, start, end), "the run's dentist should be on shift then").toBe(true);
    const booking = await book(page, branchId, working.id, start.toISOString(), end.toISOString());
    bookings.push(booking.id);

    const checkIn = await call(page, `${APPOINTMENTS}/${booking.id}/check-in`, { method: "POST", branchId });
    expect(checkIn.status, JSON.stringify(checkIn.body.error)).toBe(200);
    await openDay(page, clinicToday());
    const block = page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block");
    await expect(block).toHaveClass(/dtl-block--waiting/);
    await expect(page.locator(".dtl-now-line")).toHaveCount(1);
    await expect(page.locator(".dtl-now-badge")).toBeVisible();

    const started = await call(page, `${APPOINTMENTS}/${booking.id}/start`, { method: "POST", branchId, json: {} });
    expect(started.status, JSON.stringify(started.body.error)).toBe(200);
    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block")).toHaveClass(/dtl-block--inProgress/);
  });
});
