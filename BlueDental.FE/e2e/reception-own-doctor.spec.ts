import { expect, test, type Page, type Response } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, openBoard, type Appointment } from "./fixtures/receptionBoard";

/**
 * Feature: Tiếp nhận — the doctor filter and the patient link (BA 2026-10-05).
 *
 * - An account ticked "Bác sĩ" on the staff form opens the board filtered to
 *   itself; the filter can be cleared to see everyone, and a change of day
 *   keeps whatever is picked. Anyone else opens it unfiltered.
 * - The patient's name on a card opens the record on "Chẩn đoán & Tư vấn" for
 *   an account ticked "Bác sĩ", "Phụ tá" or "Y sĩ", and on "Hồ sơ" otherwise.
 */

/** A seeded dentist (IsDentist = true), in the default branch. */
const DENTIST_USER = { userName: "bs.anh", password: "Dentist@123456" };
const DENTIST_NAME = "BS. Trần Quốc Anh";

/** A seeded receptionist: no "Bác sĩ" tick. */
const STAFF_USER = { userName: "lt.huong", password: "Staff@123456" };

const isBoardList = (r: Response) => {
  const url = r.url();
  return url.includes(APPOINTMENTS) && !url.includes("/stats") && r.request().method() === "GET" && r.ok();
};

const dentistIdOf = (r: Response) => new URL(r.url()).searchParams.get("dentistId");

const doctorFilter = (page: Page) => page.locator(".reception-doctor-filter");

test.describe("Tiếp nhận — lọc bác sĩ", () => {
  test("a dentist starts on their own patients, can clear it, and a new day keeps the choice", async ({ page }) => {
    await login(page, DENTIST_USER);
    const ownList = page.waitForResponse((r) => isBoardList(r) && !!dentistIdOf(r));
    const branchId = await openBoard(page);
    const me = await call<{ id: string }>(page, branchId, "/api/v1/app/account/current-user");
    expect(me.status).toBe(200);

    const filtered = await ownList;
    expect(dentistIdOf(filtered)).toBe(me.body.id);
    const { items } = (await filtered.json()) as { items: Appointment[] };
    expect(items.every((a) => a.dentistId === me.body.id)).toBe(true);
    await expect(doctorFilter(page).locator(".ss-value--selected")).toHaveText(DENTIST_NAME);

    // Another day: still their own.
    const nextDay = page.waitForResponse((r) => isBoardList(r) && dentistIdOf(r) === me.body.id);
    await page.getByRole("button", { name: "right" }).click();
    await nextDay;
    await expect(doctorFilter(page).locator(".ss-value--selected")).toHaveText(DENTIST_NAME);

    // Cleared: everyone, and it is not put back on another day.
    const everyone = page.waitForResponse((r) => isBoardList(r) && !dentistIdOf(r));
    await doctorFilter(page).locator(".ss-icon--clear").dispatchEvent("mousedown");
    await everyone;
    await expect(doctorFilter(page).locator(".ss-value--placeholder")).toBeVisible();

    // A day not loaded yet, so it is fetched rather than served from the cache.
    const dayAfter = page.waitForResponse(isBoardList);
    await page.getByRole("button", { name: "right" }).click();
    expect(dentistIdOf(await dayAfter)).toBeNull();
    await expect(doctorFilter(page).locator(".ss-value--placeholder")).toBeVisible();

    // Opening the board again starts on them again.
    const reloaded = page.waitForResponse((r) => isBoardList(r) && !!dentistIdOf(r));
    await page.reload();
    expect(dentistIdOf(await reloaded)).toBe(me.body.id);
    await expect(doctorFilter(page).locator(".ss-value--selected")).toHaveText(DENTIST_NAME);
  });

  test("an account without the Bác sĩ tick opens the board unfiltered", async ({ page }) => {
    await login(page, STAFF_USER);
    const firstList = page.waitForResponse(isBoardList);
    await openBoard(page);
    expect(dentistIdOf(await firstList)).toBeNull();

    // The doctors have arrived and nothing was picked for this account.
    await page.waitForLoadState("networkidle");
    await expect(doctorFilter(page).locator(".ss-value--placeholder")).toBeVisible();
  });
});

/** Seeded staff, one per tick; all of them may book visits. */
const PATIENT_LINK_CASES = [
  { who: "Bác sĩ", user: DENTIST_USER, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "Phụ tá", user: { userName: "pt.linh", password: "Staff@123456" }, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "Y sĩ", user: { userName: "ys.trang", password: "Staff@123456" }, tab: "consulting", label: "Chẩn đoán & Tư vấn" },
  { who: "no tick", user: STAFF_USER, tab: "profile", label: "Hồ sơ" },
] as const;

test.describe("Tiếp nhận — mở hồ sơ bệnh nhân", () => {
  PATIENT_LINK_CASES.forEach(({ who, user, tab, label }, i) => {
    test(`${who}: the patient's name opens the record on the ${label} tab`, async ({ page }) => {
      await login(page, user);
      const branchId = await openBoard(page);
      // A dentist's board is filtered to them; the visit may be someone else's.
      if (user === DENTIST_USER) {
        await expect(doctorFilter(page).locator(".ss-value--selected")).toHaveText(DENTIST_NAME);
        await doctorFilter(page).locator(".ss-icon--clear").dispatchEvent("mousedown");
        await expect(doctorFilter(page).locator(".ss-value--placeholder")).toBeVisible();
      }
      const visit = await bookVisitToday(page, branchId, 35 + i, "e2e-hoso");
      const card = await cardOf(page, visit);

      await card.locator(".rc-patient-name--link").click();

      await expect(page).toHaveURL(new RegExp(`/patient/${visit.patientId}\\?tab=${tab}$`));
      await expect(page.locator(".pill-tab--active")).toHaveText(label);
    });
  });
});
