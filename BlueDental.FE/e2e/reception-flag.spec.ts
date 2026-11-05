import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  APPOINTMENTS,
  bookVisitToday,
  call,
  cardOf,
  getAppointment,
  openBoard,
  type Appointment,
} from "./fixtures/receptionBoard";
import { call as adminCall, RUN_STAFF_PASSWORD } from "./fixtures/timekeepingStaff";

/**
 * Feature: Tiếp nhận — "Đặt cờ" / "Gỡ cờ" (R-1150).
 *
 * ⋮ in a card's top-left corner flags the visit: the card runs a rainbow
 * border with the waving pennant in that chip, and so does the visit's
 * booking on Lịch hẹn; its row on the floating "Đã đến" panel glows and
 * starts with the pennant. The panel's round button stays plain. "Gỡ cờ"
 * from the pennant clears all of it.
 *
 * Each test books its own visit for today through the real API and drives it
 * in the browser. Nothing is intercepted; every state is re-read from the server.
 */

type FlaggedAppointment = Appointment & { isFlagged: boolean; flaggedAt: string | null };

const RING = /\bbd-rgb-ring\b/;

async function flagFromMenu(page: Page, card: ReturnType<Page["locator"]>, item: "Đặt cờ" | "Gỡ cờ") {
  await card.getByRole("button", { name: "Tuỳ chọn cờ" }).click();
  await page.getByRole("menuitem", { name: item }).click();
  await expect(page.getByText(item === "Đặt cờ" ? "Đã đặt cờ" : "Đã gỡ cờ").first()).toBeVisible();
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Tiếp nhận — đặt cờ", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a flag glows on the card, the booking and the Đã đến panel, and Gỡ cờ clears it", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 45, "e2e-dat-co");
    const card = await cardOf(page, visit);
    const ring = card.locator(".rc-card");

    await expect(ring).not.toHaveClass(RING);
    await flagFromMenu(page, card, "Đặt cờ");
    await expect(ring).toHaveClass(RING);
    await expect(card.locator("img.rc-flag-img")).toBeVisible();

    let stored = (await getAppointment(page, branchId, visit.id)) as FlaggedAppointment;
    expect(stored.isFlagged).toBe(true);
    expect(stored.flaggedAt).toBeTruthy();
    // A marker only: the visit has not moved.
    expect(stored.status).toBe(visit.status);

    // Kept by the server, not the page.
    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(reloaded.locator(".rc-card")).toHaveClass(RING);

    // Arrived: the panel lists the visit — its row glows and carries the
    // pennant; the round button stays plain.
    await reloaded.getByRole("button", { name: /Đã đến/ }).click();
    const dockButton = page.locator(".arrival-dock-button");
    await dockButton.click();
    const row = page.locator(".arrival-row", { hasText: visit.patientName });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row).toHaveClass(RING);
    await expect(row.getByRole("img", { name: "Đã đặt cờ" })).toBeVisible();
    await expect(dockButton).not.toHaveClass(RING);

    // Lịch hẹn, day view: the visit's block glows. The patient may also hold
    // a cancelled booking today, so only the glowing one is counted.
    await page.goto("/calendar");
    const glowing = page.locator(`.dtl-block.bd-rgb-ring[aria-label^="[${visit.patientCode}]"]`);
    await expect(glowing).toHaveCount(1, { timeout: 15_000 });

    // Gỡ cờ from the pennant clears every screen.
    await page.goto("/reception");
    const back = await cardOf(page, visit);
    await flagFromMenu(page, back, "Gỡ cờ");
    await expect(back.locator(".rc-card")).not.toHaveClass(RING);
    await expect(back.locator("img.rc-flag-img")).toHaveCount(0);
    await page.locator(".arrival-dock-button").click();
    const plainRow = page.locator(".arrival-row", { hasText: visit.patientName });
    await expect(plainRow).not.toHaveClass(RING);
    await expect(plainRow.getByRole("img", { name: "Đã đặt cờ" })).toHaveCount(0);

    stored = (await getAppointment(page, branchId, visit.id)) as FlaggedAppointment;
    expect(stored.isFlagged).toBe(false);
    expect(stored.flaggedAt).toBeNull();

    await page.goto("/calendar");
    await expect(page.locator(`.dtl-block[aria-label^="[${visit.patientCode}]"]`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`.dtl-block.bd-rgb-ring[aria-label^="[${visit.patientCode}]"]`)).toHaveCount(0);
  });

  test("a viewer without update sees the pennant but no ⋮, and the server refuses them", async ({
    page,
    browser,
  }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 75, "e2e-co-xem");
    const flagged = await call<FlaggedAppointment>(page, branchId, `${APPOINTMENTS}/${visit.id}/flag`, { method: "POST" });
    expect(flagged.status).toBe(200);
    expect(flagged.body.isFlagged).toBe(true);

    const run = runId();
    const roleName = `Cờ chỉ xem ${run}`;
    const role = await adminCall<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    let staffId: string | undefined;
    try {
      const granted = await adminCall(
        page,
        `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`,
        {
          method: "PUT",
          json: {
            permissions: ["BlueDental.reception.read", "BlueDental.appointment.read", "BlueDental.patient.read"].map(
              (name) => ({ name, isGranted: true }),
            ),
          },
        },
      );
      expect(granted.status).toBe(204);
      const userName = `coxem${run}`;
      const staff = await adminCall<{ id: string }>(page, "/api/v1/app/staff", {
        method: "POST",
        branchId,
        json: {
          userName, password: RUN_STAFF_PASSWORD, name: roleName, email: `${userName}@bluedental.local`,
          roleNames: [roleName], branchIds: [branchId], isActive: true,
        },
      });
      expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
      staffId = staff.body.id;

      const limited = await openSession(browser, { userName, password: RUN_STAFF_PASSWORD });
      try {
        await openBoard(limited.page);
        const card = await cardOf(limited.page, visit);
        await expect(card.locator(".rc-card")).toHaveClass(RING);
        await expect(card.getByRole("img", { name: "Đã đặt cờ" })).toBeVisible();
        await expect(card.getByRole("button", { name: "Tuỳ chọn cờ" })).toHaveCount(0);

        const refused = await call(limited.page, branchId, `${APPOINTMENTS}/${visit.id}/unflag`, { method: "POST" });
        expect(refused.status).toBe(403);
      } finally {
        await limited.context.close();
      }
      expect(((await getAppointment(page, branchId, visit.id)) as FlaggedAppointment).isFlagged).toBe(true);
    } finally {
      if (staffId) await adminCall(page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
      await adminCall(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    }

    // Another branch cannot clear it either.
    const other = await openSession(browser, BRANCH2_USER);
    try {
      const foreign = await other.page.evaluate(async (url) => {
        const xsrf = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.substring(11);
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
        });
        return res.status;
      }, `${APPOINTMENTS}/${visit.id}/unflag`);
      expect([403, 404]).toContain(foreign);
    } finally {
      await other.context.close();
    }
    expect(((await getAppointment(page, branchId, visit.id)) as FlaggedAppointment).isFlagged).toBe(true);
  });
});
