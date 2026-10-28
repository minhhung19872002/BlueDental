import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { APPOINTMENTS, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Ghi chú lịch hẹn sửa ngay trong bảng (R-1063, BA 2026-10-28: "Cột
 * ghi chú vẫn còn DB chứ? Giờ cho chỉnh sửa ở đây nha"). The booking dialogs
 * lost Ghi chú in R-1055; the patient's Lịch hẹn tab now edits it in its cell
 * with a pencil, whatever the visit's status, through its own
 * PUT /appointments/{id}/notes.
 *
 * A dentist, a patient and a booking for tomorrow are created through the real
 * API; the cell is then driven as a user would. Nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";
const LOG_URL = "/api/v1/app/appointment-change-log";
const PASSWORD = "E2e@123456";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const UPDATED = 2;

interface NotedAppointment extends Appointment {
  notes: string | null;
  chiefComplaint: string | null;
}

interface ChangeLog {
  action: number;
  diff: { field: string; before: string | null; after: string | null }[];
}

const notesUrl = (id: string) => `${APPOINTMENTS}/${id}/notes`;

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe.serial("Ghi chú lịch hẹn trên tab Lịch hẹn", () => {
  const run = runId();
  const content = `Khám e2e ghi chú ${run}`;
  let branchId: string;
  let dentist: RunStaff | undefined;
  let patientId: string | undefined;
  let visit: NotedAppointment | undefined;

  const tabUrl = () => `/patient/${patientId}?tab=appointment&branch=BD-001`;
  const rowOf = (page: Page) => page.locator(".pd-appointment-tab tbody tr", { hasText: content });

  async function updateLog(page: Page): Promise<ChangeLog[]> {
    const res = await call<{ items: ChangeLog[] }>(
      page,
      `${LOG_URL}?appointmentId=${visit?.id}&actions=${UPDATED}&maxResultCount=50`,
      { branchId },
    );
    expect(res.status).toBe(200);
    return res.body.items;
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await openBoard(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (visit) await call(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
    if (patientId) await call(page, `${PATIENTS}/${patientId}/deactivate`, { method: "POST", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
    await page.close();
  });

  test("the notes endpoint trims, clears on blank, refuses 2001 characters and logs only a real change", async ({
    page,
  }) => {
    dentist = await createRunStaff(page, branchId, `gc${run}`, { name: `Bác sĩ ghi chú ${run}`, isDentist: true });
    const patient = await call<{ id: string }>(page, PATIENTS, {
      method: "POST",
      branchId,
      json: { lastName: "Lê Thị", firstName: `Ghi chú ${run}`, gender: 2, phoneNumber: `07${run}58` },
    });
    expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
    patientId = patient.body.id;

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 15 * 60_000);
    expect(await openShiftCovering(page, branchId, dentist.id, start, end), "the run's dentist on shift").toBe(true);
    const booked = await call<NotedAppointment>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId, dentistId: dentist.id, branchId, type: 2,
        slotStart: start.toISOString(), slotEnd: end.toISOString(), chiefComplaint: content,
      },
    });
    expect(booked.status, JSON.stringify(booked.body.error)).toBe(200);
    visit = booked.body;
    expect(visit.notes).toBeNull();

    const note = `Gọi trước một ngày ${run}`;
    const saved = await call<NotedAppointment>(page, notesUrl(visit.id), {
      method: "PUT",
      branchId,
      json: { notes: `   ${note}  ` },
    });
    expect(saved.status, JSON.stringify(saved.body.error)).toBe(200);
    expect(saved.body.notes).toBe(note);

    // Read back on its own request: the note is stored, nothing else moved.
    const read = await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit.id}`, { branchId });
    expect(read.body.notes).toBe(note);
    expect(read.body.chiefComplaint).toBe(content);
    expect(read.body.slotStart).toBe(visit.slotStart);
    expect(read.body.status).toBe(visit.status);

    const afterSave = await updateLog(page);
    expect(afterSave).toHaveLength(1);
    expect(afterSave[0].diff).toEqual([{ field: "note", before: null, after: note }]);

    // The same text again, spaces aside, is no change: no second Cập nhật row.
    const same = await call<NotedAppointment>(page, notesUrl(visit.id), {
      method: "PUT",
      branchId,
      json: { notes: `${note} ` },
    });
    expect(same.status).toBe(200);
    expect(await updateLog(page)).toHaveLength(1);

    const tooLong = await call(page, notesUrl(visit.id), {
      method: "PUT",
      branchId,
      json: { notes: "x".repeat(2001) },
    });
    expect(tooLong.status).toBe(400);
    expect((await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit.id}`, { branchId })).body.notes).toBe(note);

    const cleared = await call<NotedAppointment>(page, notesUrl(visit.id), {
      method: "PUT",
      branchId,
      json: { notes: "   " },
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.notes).toBeNull();
    expect((await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit.id}`, { branchId })).body.notes).toBeNull();
    const afterClear = await updateLog(page);
    expect(afterClear).toHaveLength(2);
    expect(afterClear[0].diff).toEqual([{ field: "note", before: note, after: null }]);
  });

  test("the pencil edits Ghi chú in its cell: Esc drops the draft, Lưu keeps it over a reload", async ({ page }) => {
    test.skip(!visit, "no visit was booked");
    const notesCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/notes") && r.method() === "PUT") notesCalls.push(r.url());
    });
    await page.goto(tabUrl());
    const row = rowOf(page);
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    const pencil = row.getByRole("button", { name: "Sửa ghi chú" });
    const box = row.getByRole("textbox", { name: "Ghi chú" });

    // Esc and Hủy both leave without a request.
    await pencil.click();
    await expect(box).toBeFocused();
    await box.fill("bản nháp bỏ đi");
    await box.press("Escape");
    await expect(box).toHaveCount(0);
    await expect(row).not.toContainText("bản nháp bỏ đi");
    await pencil.click();
    await box.fill("bản nháp thứ hai");
    await row.getByRole("button", { name: "Hủy" }).click();
    await expect(box).toHaveCount(0);
    // Left as it was, Lưu closes the editor and sends nothing either.
    await pencil.click();
    await row.getByRole("button", { name: "Lưu" }).click();
    await expect(box).toHaveCount(0);
    expect(notesCalls).toEqual([]);

    const note = `Mang phim cũ ${run}`;
    await pencil.click();
    await box.fill(note);
    const put = page.waitForResponse((res) => res.url().includes(notesUrl(visit!.id)) && res.request().method() === "PUT");
    await row.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(page.getByText("Đã lưu ghi chú")).toBeVisible();
    await expect(box).toHaveCount(0);
    await expect(row).toContainText(note);

    await page.reload();
    await expect(rowOf(page)).toContainText(note, { timeout: 15_000 });

    // Reopened, the caret waits after the saved note, ready to add to it.
    await rowOf(page).getByRole("button", { name: "Sửa ghi chú" }).click();
    const reopened = rowOf(page).getByRole("textbox", { name: "Ghi chú" });
    await expect(reopened).toBeFocused();
    const caret = await reopened.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]);
    expect(caret).toEqual([note.length, note.length]);
    await reopened.press("Escape");
    await expect(reopened).toHaveCount(0);

    // Lịch sử thay đổi names the field in words.
    const list = page.waitForResponse(
      (res) => res.url().includes(LOG_URL) && res.url().includes("appointmentId=") && res.ok(),
    );
    await rowOf(page).getByRole("button", { name: "Lịch sử thay đổi lịch hẹn" }).click();
    await list;
    const dialog = page.getByRole("dialog", { name: /Lịch sử thay đổi lịch hẹn/ });
    const first = dialog.locator(".ah-table tbody tr.ant-table-row").first();
    await expect(first).toContainText("Cập nhật");
    await expect(first.locator(".ah-values--after")).toContainText(`Ghi chú: ${note}`);
  });

  test("a cancelled visit still takes a note", async ({ page }) => {
    test.skip(!visit, "no visit was booked");
    const cancelled = await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit!.id}/cancel`, {
      method: "POST",
      branchId,
      json: { reason: 1, note: `Khách bận ${run}` },
    });
    expect(cancelled.status, JSON.stringify(cancelled.body.error)).toBe(200);

    await page.goto(tabUrl());
    const row = rowOf(page);
    await expect(row).toContainText("Đã huỷ", { timeout: 15_000 });
    const note = `Hẹn lại tuần sau ${run}`;
    await row.getByRole("button", { name: "Sửa ghi chú" }).click();
    await row.getByRole("textbox", { name: "Ghi chú" }).fill(note);
    const put = page.waitForResponse((res) => res.url().includes(notesUrl(visit!.id)) && res.request().method() === "PUT");
    await row.getByRole("button", { name: "Lưu" }).click();
    expect((await put).ok()).toBeTruthy();
    await expect(row).toContainText(note);

    const read = await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit!.id}`, { branchId });
    expect(read.body.notes).toBe(note);
    expect(read.body.cancelledAt).not.toBeNull();
  });

  test("an account without appointment.update sees no pencil and is refused by the server", async ({
    page,
    browser,
  }) => {
    test.skip(!visit, "no visit was booked");
    const roleName = `Ghi chú xem ${run}`;
    const role = await call<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    const userName = `ghichu${run}`;
    let staffId: string | undefined;
    try {
      const granted = await call(
        page,
        `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`,
        {
          method: "PUT",
          json: {
            permissions: ["BlueDental.patient.read", "BlueDental.appointment.read"].map((name) => ({
              name, isGranted: true,
            })),
          },
        },
      );
      expect(granted.status).toBe(204);
      const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
        method: "POST",
        branchId,
        json: {
          userName, password: PASSWORD, name: `Ghi chú xem ${run}`, email: `${userName}@bluedental.local`,
          roleNames: [roleName], branchIds: [branchId], isActive: true,
        },
      });
      expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
      staffId = staff.body.id;

      const limited = await openSession(browser, { userName, password: PASSWORD });
      try {
        await limited.page.goto(tabUrl());
        const row = rowOf(limited.page);
        await expect(row).toHaveCount(1, { timeout: 15_000 });
        await expect(row.getByRole("button", { name: "Sửa ghi chú" })).toHaveCount(0);

        const refused = await call(limited.page, notesUrl(visit!.id), {
          method: "PUT",
          branchId,
          json: { notes: "không được ghi" },
        });
        expect(refused.status).toBe(403);
      } finally {
        await limited.context.close();
      }
      expect((await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit!.id}`, { branchId })).body.notes)
        .not.toBe("không được ghi");
    } finally {
      if (staffId) await call(page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    }
  });

  test("another branch's account cannot write the note", async ({ page, browser }) => {
    test.skip(!visit, "no visit was booked");
    const before = (await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit!.id}`, { branchId })).body.notes;
    const other = await openSession(browser, BRANCH2_USER);
    try {
      // From its own branch the appointment does not exist; claiming branch one is refused outright.
      const own = await call(other.page, notesUrl(visit!.id), {
        method: "PUT",
        branchId: BRANCH_TWO,
        json: { notes: "chi nhánh khác" },
      });
      expect(own.status).toBe(404);
      const claimed = await call(other.page, notesUrl(visit!.id), {
        method: "PUT",
        branchId,
        json: { notes: "chi nhánh khác" },
      });
      expect(claimed.status).toBe(403);
    } finally {
      await other.context.close();
    }
    expect((await call<NotedAppointment>(page, `${APPOINTMENTS}/${visit!.id}`, { branchId })).body.notes).toBe(before);
  });
});
