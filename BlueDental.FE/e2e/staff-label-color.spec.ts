import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, cardOf, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as staffCall, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Màu nhãn on a staff member (R-1155, BA 2026-11-06, a BlueDental
 * addition the reference does not have). The Thêm/Cập nhật nhân viên dialog
 * gets the Labo supplier's colour picker (R-1072); with no colour picked the
 * badge is pink #FF007F (owner). The doctor's name then reads as that badge
 * on the Nhân viên list, the Tiếp nhận card, the floating "Khách đã đến" panel
 * and the doctor's column head on Lịch hẹn view Ngày.
 *
 * Real stack: the admin signs in on the login screen; the run doctor and one
 * arrived visit of theirs are made through the real API, the colour is picked
 * and saved in the real dialog, and every reading comes after a reload.
 */

const STAFF = "/api/v1/app/staff";
const PINK = { hex: "#FF007F", rgb: "rgb(255, 0, 127)" };
const BLUE = { hex: "#2671D8", rgb: "rgb(38, 113, 216)" };
const WHITE_RGB = "rgb(255, 255, 255)";

const background = (badge: Locator) => badge.evaluate((el) => getComputedStyle(el).backgroundColor);
const textColor = (badge: Locator) => badge.evaluate((el) => getComputedStyle(el).color);

interface Staff {
  id: string;
  labelColor: string | null;
  [key: string]: unknown;
}

const searchStaff = (page: Page) => page.getByPlaceholder("Tìm theo tên, email, số điện thoại...").first();

/** The Nhân viên row of the run doctor, searched for so it is on page one. */
async function staffRow(page: Page, name: string): Promise<Locator> {
  await page.goto("/staff");
  await assertRealApiTraffic(page, STAFF);
  await searchStaff(page).fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  return row;
}

/** The four places the doctor's badge shows, each read after a fresh load. */
async function expectBadgeEverywhere(
  page: Page,
  doctorName: string,
  visit: Appointment & { searchKey: string },
  colour: { rgb: string },
) {
  // Nhân viên list, Tên column.
  const row = await staffRow(page, doctorName);
  const listBadge = row.locator(".bd-label-badge");
  await expect(listBadge).toContainText(doctorName);
  expect(await background(listBadge), "Nhân viên list").toBe(colour.rgb);
  expect(await textColor(listBadge)).toBe(WHITE_RGB);

  // Tiếp nhận card, the 🩺 line.
  await openBoard(page);
  const card = await cardOf(page, visit);
  const cardBadge = card.locator(".rc-details .bd-label-badge");
  await expect(cardBadge).toContainText(doctorName);
  expect(await background(cardBadge), "Tiếp nhận card").toBe(colour.rgb);

  // The floating "Khách đã đến" panel, beside the 🩺.
  await page.getByRole("button", { name: "Khách đã đến" }).click();
  const panel = page.getByRole("dialog", { name: "Khách đã đến" });
  const panelRow = panel.locator(".arrival-row").filter({ hasText: visit.patientName }).first();
  const panelBadge = panelRow.locator(".arrival-row-doctor .bd-label-badge");
  await expect(panelBadge).toContainText(doctorName);
  expect(await background(panelBadge), "Khách đã đến panel").toBe(colour.rgb);

  // Lịch hẹn view Ngày: the column head, the patient count left beside it.
  const day = dayOf(new Date());
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  const column = page.locator(".dtl-col").filter({ has: page.locator(".dtl-name", { hasText: doctorName }) });
  await expect(column).toHaveCount(1, { timeout: 15_000 });
  const headBadge = column.locator(".dtl-doc .dtl-name .bd-label-badge");
  await expect(headBadge).toContainText(doctorName);
  expect(await background(headBadge), "Lịch hẹn Ngày head").toBe(colour.rgb);
  await expect(column.locator(".dtl-count")).toHaveText("1");
}

test.describe("Nhân viên — Màu nhãn (R-1155)", () => {
  test("no colour reads pink everywhere; the colour picked in the dialog follows the doctor's name", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const branchId = await openBoard(page);

    const id = runId();
    const doctorName = `Màu nhãn ${id}`;
    const doctor: RunStaff = await createRunStaff(page, branchId, `mau${id}`, {
      name: doctorName,
      isDentist: true,
      // The Cập nhật dialog requires a Nhóm quyền before it saves.
      roleNames: ["admin"],
    });
    let visit: (Appointment & { searchKey: string }) | undefined;

    try {
      // The API stores no colour until one is picked.
      const fresh = await staffCall<Staff>(page, `${STAFF}/${doctor.id}`);
      expect(fresh.body.labelColor).toBeNull();

      // One arrived visit of theirs, today.
      visit = await bookVisitToday(page, branchId, 150, "e2e-maunhan");
      const assigned = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/assign-dentist`, {
        method: "POST",
        json: { dentistId: doctor.id },
      });
      expect(assigned.status, "hand the visit to the run doctor").toBe(200);
      const arrived = await call(page, branchId, `${APPOINTMENTS}/${visit.id}/check-in`, { method: "POST" });
      expect(arrived.status, "check the visit in").toBe(200);

      // ── No colour: pink #FF007F in all four places ──
      await expectBadgeEverywhere(page, doctorName, visit, PINK);

      // ── Pick blue in the Cập nhật nhân viên dialog ──
      const row = await staffRow(page, doctorName);
      await row.getByRole("button").first().click();
      const dialog = page.getByRole("dialog");
      const swatches = dialog.getByRole("radiogroup", { name: "Màu nhãn" }).getByRole("radio");
      await expect(swatches).toHaveCount(9);
      const byDefault = dialog.getByRole("radio", { name: "Mặc định (hồng)" });
      await expect(byDefault).toHaveAttribute("aria-checked", "true");
      expect(await background(byDefault)).toBe(PINK.rgb);
      const preview = dialog.locator(".bd-label-preview .bd-label-badge");
      expect(await background(preview)).toBe(PINK.rgb);

      await dialog.getByRole("radio", { name: `Chọn màu ${BLUE.hex}` }).click();
      expect(await background(preview)).toBe(BLUE.rgb);
      const saved = page.waitForResponse((r) => r.url().includes(`${STAFF}/${doctor.id}`) && r.request().method() === "PUT");
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      const savedRes = await saved;
      expect(savedRes.status()).toBe(200);
      expect(((await savedRes.json()) as Staff).labelColor).toBe(BLUE.hex);
      await expect(dialog).toBeHidden({ timeout: 10_000 });

      // ── After a reload, blue in all four places ──
      await expectBadgeEverywhere(page, doctorName, visit, BLUE);

      // The dialog opens on the stored colour.
      const again = await staffRow(page, doctorName);
      await again.getByRole("button").first().click();
      await expect(page.getByRole("dialog").getByRole("radio", { name: `Chọn màu ${BLUE.hex}` })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await page.keyboard.press("Escape");

      // ── The API refuses anything but #RRGGBB, and keeps the colour ──
      const current = (await staffCall<Staff>(page, `${STAFF}/${doctor.id}`)).body;
      const refused = await staffCall<Staff>(page, `${STAFF}/${doctor.id}`, {
        method: "PUT",
        json: { ...current, password: undefined, labelColor: "red" },
      });
      expect(refused.status, "a colour that is not #RRGGBB").toBe(400);
      expect((await staffCall<Staff>(page, `${STAFF}/${doctor.id}`)).body.labelColor).toBe(BLUE.hex);

      // ── Lower case is stored upper case; blank goes back to the default ──
      const lower = await staffCall<Staff>(page, `${STAFF}/${doctor.id}`, {
        method: "PUT",
        json: { ...current, password: undefined, labelColor: "#10b981" },
      });
      expect(lower.status).toBe(200);
      expect(lower.body.labelColor).toBe("#10B981");
      const cleared = await staffCall<Staff>(page, `${STAFF}/${doctor.id}`, {
        method: "PUT",
        json: { ...current, password: undefined, labelColor: "" },
      });
      expect(cleared.status).toBe(200);
      expect(cleared.body.labelColor).toBeNull();
    } finally {
      if (visit) await call(page, branchId, `${APPOINTMENTS}/${visit.id}`, { method: "DELETE" });
      await deleteStaff(page, doctor.id);
    }
  });
});
