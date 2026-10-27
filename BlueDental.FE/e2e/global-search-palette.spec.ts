import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { createRunStaff, deleteStaff, call as staffCall, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Ctrl+K tìm cả 4 nhóm (R-1053, owner 2026-10-27: "ở modal này hình
 * như hiện tại mới tìm kiếm bệnh nhân à" → "cách 1"). Typing two characters
 * searches Bệnh nhân, Lịch hẹn (from today on, the customer only), CSKH and
 * Nhân viên; each group has its header and count, ↑/↓ + Enter walk all rows,
 * and a group the account may not read is neither asked nor shown.
 *
 * A patient "Trần Thị Thuỷ e2e…", a booking of theirs for tomorrow, a CSKH
 * task of theirs and a dentist "Đoàn Khôi …" are created through the real API;
 * the palette is then driven as a user would. Nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";
const CARE = "/api/v1/app/care-records";
const PASSWORD = "E2e@123456";

const group = (page: Page, title: string) => page.locator(`section.app-search-group[aria-label="${title}"]`);

async function openPalette(page: Page, term: string) {
  await page.locator(".app-header-search").click();
  await page.locator(".app-search-field").fill(term);
}

test.describe.serial("Ctrl+K tìm 4 nhóm", () => {
  const run = runId();
  const token = `e2e${run}`;
  const patientTerm = `thuy ${token}`;
  const staffTerm = `doan khoi ${run}`;
  let branchId: string;
  let dentist: RunStaff | undefined;
  let patientId: string | undefined;
  let visit: Appointment | undefined;
  let careId: string | undefined;

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await openBoard(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (careId) await staffCall(page, `${CARE}/${careId}`, { method: "DELETE", branchId });
    if (visit) await staffCall(page, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE", branchId });
    if (patientId) await call(page, branchId, `${PATIENTS}/${patientId}/deactivate`, { method: "POST" });
    if (dentist) await deleteStaff(page, dentist.id);
    await page.close();
  });

  test("the patient shows under Bệnh nhân, Lịch hẹn and CSKH, typed without marks", async ({ page }) => {
    dentist = await createRunStaff(page, branchId, `gs${run}`, { name: `Đoàn Khôi ${run}`, isDentist: true });
    const patient = await call<{ id: string }>(page, branchId, PATIENTS, {
      method: "POST",
      json: { lastName: "Trần Thị", firstName: `Thuỷ ${token}`, gender: 2, phoneNumber: `07${run}53` },
    });
    expect(patient.status, JSON.stringify(patient.body.error)).toBe(200);
    patientId = patient.body.id;

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 15 * 60_000);
    expect(await openShiftCovering(page, branchId, dentist.id, start, end), "the run's dentist on shift").toBe(true);
    const booked = await call<Appointment>(page, branchId, APPOINTMENTS, {
      method: "POST",
      json: {
        patientId, dentistId: dentist.id, branchId, type: 2,
        slotStart: start.toISOString(), slotEnd: end.toISOString(), chiefComplaint: "Khám định kỳ",
      },
    });
    expect(booked.status, JSON.stringify(booked.body.error)).toBe(200);
    visit = booked.body;

    const care = await call<{ id: string }>(page, branchId, CARE, {
      method: "POST",
      json: { patientId, branchId, type: 1, subject: `Hỏi thăm ${token}`, dueAt: new Date().toISOString() },
    });
    expect(care.status, JSON.stringify(care.body.error)).toBe(200);
    careId = care.body.id;

    // The booking's Nội dung đặt lịch is not the customer: "kham dinh" finds no Lịch hẹn row of this run.
    const byContent = await call<{ items: Appointment[] }>(
      page, branchId, `${APPOINTMENTS}?patientFilter=${encodeURIComponent(`kham dinh ${token}`)}`,
    );
    expect(byContent.status).toBe(200);
    expect(byContent.body.items.some((a) => a.id === visit?.id), "content is not searched").toBe(false);

    await openPalette(page, patientTerm);
    for (const title of ["Bệnh nhân", "Lịch hẹn", "CSKH"]) {
      const hits = group(page, title).locator(".app-search-hit");
      await expect(hits, title).toHaveCount(1, { timeout: 15_000 });
      await expect(hits.first(), title).toContainText("Thuỷ");
      await expect(group(page, title).locator(".app-search-group-count"), title).toHaveText("1");
    }
    await expect(group(page, "Nhân viên")).toHaveCount(0);
  });

  test("↓ then Enter opens the Lịch hẹn row on the patient's appointment tab", async ({ page }) => {
    test.skip(!visit, "no visit was booked");
    await openPalette(page, patientTerm);
    const options = page.getByRole("option");
    await expect(options).toHaveCount(3, { timeout: 15_000 });
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    await page.locator(".app-search-field").press("ArrowDown");
    await expect(group(page, "Lịch hẹn").getByRole("option")).toHaveAttribute("aria-selected", "true");
    await page.locator(".app-search-field").press("Enter");

    await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=appointment`));
    await expect(page.locator(".app-search-modal")).toHaveCount(0);
  });

  test("a CSKH row opens the patient's care tab", async ({ page }) => {
    test.skip(!careId, "no care task was created");
    await openPalette(page, patientTerm);
    await group(page, "CSKH").locator(".app-search-hit").click({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=care`));
  });

  test("a Nhân viên row opens the staff list searched by that name", async ({ page }) => {
    test.skip(!dentist, "no dentist was created");
    await openPalette(page, staffTerm);
    const hit = group(page, "Nhân viên").locator(".app-search-hit");
    await expect(hit).toHaveCount(1, { timeout: 15_000 });
    await expect(hit).toContainText(`Đoàn Khôi ${run}`);
    await expect(group(page, "Bệnh nhân")).toHaveCount(0);
    await hit.click();

    await expect(page).toHaveURL(/\/staff\?q=/);
    await expect(page.locator(".desktop-only").getByPlaceholder("Tìm theo tên, email, số điện thoại..."))
      .toHaveValue(new RegExp(`^Đoàn Khôi ${run}`));
    await expect(page.locator(".ant-table-row", { hasText: `Đoàn Khôi ${run}` })).toHaveCount(1, { timeout: 15_000 });
  });

  test("an account without CSKH and Nhân viên rights neither asks nor sees those groups", async ({ page, browser }) => {
    test.skip(!careId || !dentist, "the run's records were not created");
    const roleName = `Tìm nhanh ${run}`;
    const role = await staffCall<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    const userName = `timnhanh${run}`;
    let staffId: string | undefined;
    try {
      const granted = await staffCall(
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
      const staff = await staffCall<{ id: string }>(page, "/api/v1/app/staff", {
        method: "POST",
        branchId,
        json: {
          userName, password: PASSWORD, name: `Tìm nhanh ${run}`, email: `${userName}@bluedental.local`,
          roleNames: [roleName], branchIds: [branchId], isActive: true,
        },
      });
      expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
      staffId = staff.body.id;

      const context = await browser.newContext();
      const limited = await context.newPage();
      const asked: string[] = [];
      limited.on("request", (r) => asked.push(r.url()));
      await login(limited, { userName, password: PASSWORD });
      await limited.goto("/patient?branch=BD-001");

      await openPalette(limited, patientTerm);
      await expect(group(limited, "Bệnh nhân").locator(".app-search-hit")).toHaveCount(1, { timeout: 15_000 });
      await expect(group(limited, "Lịch hẹn").locator(".app-search-hit")).toHaveCount(1);
      await expect(group(limited, "CSKH")).toHaveCount(0);
      await expect(group(limited, "Nhân viên")).toHaveCount(0);

      await limited.locator(".app-search-field").fill(staffTerm);
      await expect(limited.locator(".app-search-hint")).toContainText("Không tìm thấy", { timeout: 15_000 });

      expect(asked.filter((url) => url.includes(CARE) && /filter=/i.test(url)), "no CSKH search").toEqual([]);
      expect(asked.filter((url) => /\/api\/v1\/app\/staff\?/.test(url) && /filter=/i.test(url)), "no staff search")
        .toEqual([]);
      await context.close();
    } finally {
      if (staffId) await staffCall(page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
      await staffCall(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    }
  });
});
