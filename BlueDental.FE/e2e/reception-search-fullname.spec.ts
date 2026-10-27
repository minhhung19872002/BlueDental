import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { APPOINTMENTS, bookVisitToday, call, dayOf, openBoard } from "./fixtures/receptionBoard";

/**
 * Tiếp nhận — tìm theo họ tên đầy đủ (owner 2026-10-27).
 *
 * "Nguyễn Hải Yến" was found by "yến" but not by "nguyễn hải yến": the
 * server matched the typed text against the family name or the given name
 * alone, never the two together. The search is full text, trimmed and
 * case-blind, so the whole name — however it is spaced or cased — finds it.
 *
 * The visit's patient has a family and a given name, so the full name spans
 * both fields just like the reported one. Real stack, nothing intercepted.
 */

test.describe("Tiếp nhận — tìm bệnh nhân theo họ tên đầy đủ", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the whole name finds the visit, trimmed and in any case", async ({ page }) => {
    const branchId = await openBoard(page);
    const visit = await bookVisitToday(page, branchId, 95, "e2e-fullname");
    // The fixture books whichever pooled patient is free; read their two name parts.
    const patient = await call<{ firstName: string; lastName: string }>(
      page, branchId, `/api/v1/app/patients/${visit.patientId}`,
    );
    expect(patient.status).toBe(200);
    const { lastName, firstName } = patient.body;
    expect(lastName.trim() && firstName.trim(), "the name spans both parts").toBeTruthy();
    const fullName = `${lastName} ${firstName}`;
    const given = firstName;

    const today = dayOf(new Date());
    const found = async (typed: string) => {
      const res = await call<{ items: { id: string }[] }>(
        page,
        branchId,
        `${APPOINTMENTS}?filter=${encodeURIComponent(typed)}&fromDate=${today}&toDate=${today}&maxResultCount=50`,
      );
      expect(res.status).toBe(200);
      return res.body.items.some((item) => item.id === visit.id);
    };

    for (const typed of [
      fullName,
      fullName.toLowerCase(),
      fullName.toUpperCase(),
      `   ${fullName}   `,
      fullName.replace(/ /g, "   "),
      given,
      lastName,
    ]) {
      expect(await found(typed), JSON.stringify(typed)).toBe(true);
    }
    // A different name is not a match.
    expect(await found(`${fullName}9`)).toBe(false);

    // On the board, as reception types it.
    const searched = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok());
    await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(`  ${fullName.toUpperCase()} `);
    const listed = (await (await searched).json()) as { items: { id: string }[] };
    expect(listed.items.map((item) => item.id)).toContain(visit.id);
    // The patient may hold more than one visit today; every card shown is theirs.
    const cards = page.locator(".rc-wrapper");
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    for (const card of await cards.all()) await expect(card).toContainText(fullName);
  });
});
