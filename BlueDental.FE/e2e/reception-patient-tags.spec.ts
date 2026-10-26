import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { APPOINTMENTS, call, bookVisitToday, cardOf, dayOf, openBoard, type Appointment } from "./fixtures/receptionBoard";
import { call as callAny } from "./fixtures/timekeepingStaff";

/**
 * Tiếp nhận — Thẻ hồ sơ on the board's cards (R-1034). Each card of a visit
 * with a record shows the record's tags under the patient's name: two chips,
 * then "+N" whose tooltip names them all, and the 🏷 picker that saves each
 * tick at once through PUT /patients/{id}/tags. A Lịch tạm has no record, so
 * no row; a role without patient.update sees the chips but no picker.
 *
 * Real stack: tags and visits are made through the API, ticks are clicked on
 * the board, nothing is intercepted, the result is re-read after a reload and
 * from the hồ sơ page.
 */

const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const PATIENTS = "/api/v1/app/patients";
const TAGS = "/api/v1/app/patient-tags";
const PASSWORD = "TagThe@123456";

interface Tag {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  tagIds: string[];
}

type Visit = Appointment & { searchKey: string };

async function createTag(page: Page, branchId: string, name: string): Promise<Tag> {
  const res = await call<Tag>(page, branchId, TAGS, {
    method: "POST",
    json: { clinicBranchId: branchId, name, color: "#3B82F6" },
  });
  expect(res.status, JSON.stringify(res.body.error)).toBe(200);
  return res.body;
}

async function getPatient(page: Page, branchId: string, id: string): Promise<Patient> {
  const res = await call<Patient>(page, branchId, `${PATIENTS}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

async function setTags(page: Page, branchId: string, patientId: string, tagIds: string[]) {
  return call<Patient>(page, branchId, `${PATIENTS}/${patientId}/tags`, { method: "PUT", json: { tagIds } });
}

/** A "Lịch tạm" for later today; its unique name is what the board's search matches. */
async function bookTempToday(page: Page, branchId: string, minutesAhead: number) {
  const name = `E2E TAM TAG ${runId()}${minutesAhead}`;
  const start = new Date(Date.now() + minutesAhead * 60_000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 15 * 60_000);
  test.skip(dayOf(end) !== dayOf(new Date()), "too close to midnight to book a visit for today");
  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/temp`, {
    method: "POST",
    json: {
      patientName: name,
      patientPhone: `09${runId().padStart(8, "0").slice(-8)}`,
      branchId,
      slotStart: start.toISOString(),
      slotEnd: end.toISOString(),
    },
  });
  expect(res.status, JSON.stringify(res.body.error)).toBe(200);
  return { ...res.body, name };
}

async function cancelVisit(page: Page, branchId: string, id: string) {
  await call(page, branchId, `${APPOINTMENTS}/${id}/cancel`, { method: "POST", json: { reason: 1, note: "e2e tag" } });
}

test.describe("Tiếp nhận — Thẻ hồ sơ trên thẻ", () => {
  test.describe.configure({ mode: "serial" });

  let branchId: string;
  let visit: Visit;
  let originalTags: string[];
  const tags: Tag[] = [];

  // One visit and three fresh tags for the whole file; the patient is a shared
  // fixture, so its own tags are put back afterwards.
  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await openBoard(page);
    if (visit) return;
    visit = await bookVisitToday(page, branchId, 30, "e2e-tagcard");
    originalTags = (await getPatient(page, branchId, visit.patientId)).tagIds;
    const id = runId();
    for (const suffix of ["A", "B", "C"]) tags.push(await createTag(page, branchId, `E2E Tag ${id} ${suffix}`));
    expect((await setTags(page, branchId, visit.patientId, [])).status).toBe(200);
    // The board loaded the tag catalog before these tags existed.
    await page.reload();
  });

  test.afterAll(async ({ browser }) => {
    if (!visit) return;
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);
    await setTags(page, branchId, visit.patientId, originalTags);
    await cancelVisit(page, branchId, visit.id);
    for (const tag of tags) await callAny(page, `${TAGS}/${tag.id}`, { method: "DELETE", branchId });
    await context.close();
  });

  test("a tick on the card's picker saves at once and shows on the card and the hồ sơ", async ({ page }) => {
    const card = await cardOf(page, visit);
    await expect(card.locator(".rc-tag-row .pd-tag-chip")).toHaveCount(0);

    await card.getByRole("button", { name: "Nhãn bệnh nhân" }).click();
    await page.getByPlaceholder("Tìm tag").fill(tags[0].name);
    const saved = page.waitForResponse(
      (r) => r.url().includes(`${PATIENTS}/${visit.patientId}/tags`) && r.request().method() === "PUT",
    );
    await page.locator(".pd-tag-options button", { hasText: tags[0].name }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Đã thêm tag")).toBeVisible();
    await expect(page.locator(".pd-tag-options button", { hasText: tags[0].name }).locator(".pd-tag-tick")).toBeVisible();
    await expect(card.locator(".rc-tag-row .pd-tag-chip")).toHaveText([tags[0].name]);

    expect((await getPatient(page, branchId, visit.patientId)).tagIds).toEqual([tags[0].id]);

    await page.reload();
    const reloaded = await cardOf(page, visit);
    await expect(reloaded.locator(".rc-tag-row .pd-tag-chip")).toHaveText([tags[0].name]);

    await page.goto(`/patient/${visit.patientId}`);
    await page.getByRole("navigation", { name: "Chi tiết bệnh nhân" }).getByRole("link", { name: "Hồ sơ", exact: true }).click();
    await expect(page.locator(".pd-profile-name .pd-tag-chip", { hasText: tags[0].name })).toBeVisible();
  });

  test("unticking takes the chip off the card", async ({ page }) => {
    expect((await setTags(page, branchId, visit.patientId, [tags[0].id])).status).toBe(200);
    await page.reload();
    const card = await cardOf(page, visit);
    await expect(card.locator(".rc-tag-row .pd-tag-chip")).toHaveCount(1);

    await card.getByRole("button", { name: "Nhãn bệnh nhân" }).click();
    await page.getByPlaceholder("Tìm tag").fill(tags[0].name);
    await page.locator(".pd-tag-options button", { hasText: tags[0].name }).click();
    await expect(page.getByText("Đã bỏ tag")).toBeVisible();
    await expect(card.locator(".rc-tag-row .pd-tag-chip")).toHaveCount(0);
    expect((await getPatient(page, branchId, visit.patientId)).tagIds).toEqual([]);
  });

  test("three tags fold into two chips and +1, whose tooltip names all three", async ({ page }) => {
    expect((await setTags(page, branchId, visit.patientId, tags.map((t) => t.id))).status).toBe(200);
    await page.reload();
    const card = await cardOf(page, visit);

    const chips = card.locator(".rc-tag-row .pd-tag-chip");
    await expect(chips).toHaveCount(3);
    const more = card.locator(".rc-tag-row .pd-tag-more");
    await expect(more).toHaveText("+1");
    await expect(card.locator(".rc-tag-row .pd-tag-chip:not(.pd-tag-more)")).toHaveCount(2);

    await more.hover();
    const tooltip = page.locator(".pd-tag-strip-tooltip");
    await expect(tooltip).toBeVisible();
    for (const tag of tags) await expect(tooltip).toContainText(tag.name);
  });

  test("a Lịch tạm card carries no tag row", async ({ page }) => {
    const temp = await bookTempToday(page, branchId, 45);
    try {
      const searched = page.waitForResponse(
        (r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok(),
      );
      await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(temp.name);
      await searched;
      const card = page.locator(".rc-wrapper", { hasText: temp.name });
      await expect(card).toHaveCount(1, { timeout: 15_000 });
      await expect(card.locator(".rc-temp-tab")).toBeVisible();
      await expect(card.locator(".rc-tag-row")).toHaveCount(0);
    } finally {
      await cancelVisit(page, branchId, temp.id);
    }
  });

  test("a tag from another branch's catalog is dropped by the server", async ({ page }) => {
    const foreign = await createTag(page, BRANCH_TWO, `E2E Tag ngoai ${runId()}`);
    try {
      const res = await setTags(page, branchId, visit.patientId, [tags[1].id, foreign.id]);
      expect(res.status).toBe(200);
      expect(res.body.tagIds).toEqual([tags[1].id]);
      expect((await getPatient(page, branchId, visit.patientId)).tagIds).toEqual([tags[1].id]);
    } finally {
      await callAny(page, `${TAGS}/${foreign.id}`, { method: "DELETE", branchId: BRANCH_TWO });
    }
  });

  test("without patient.update the chips show but the picker does not, and the API refuses", async ({ page, browser }) => {
    expect((await setTags(page, branchId, visit.patientId, [tags[2].id])).status).toBe(200);
    const staff = await makeReadOnlyStaff(page, branchId);
    try {
      const session = await openSession(browser, staff.userName);
      try {
        await openBoard(session.page);
        const card = await cardOf(session.page, visit);
        await expect(card.locator(".rc-tag-row .pd-tag-chip")).toHaveText([tags[2].name]);
        await expect(card.getByRole("button", { name: "Nhãn bệnh nhân" })).toHaveCount(0);

        const refused = await setTags(session.page, branchId, visit.patientId, []);
        expect(refused.status).toBe(403);
        expect((await getPatient(page, branchId, visit.patientId)).tagIds).toEqual([tags[2].id]);
      } finally {
        await session.context.close();
      }
    } finally {
      await callAny(page, `/api/v1/app/staff/${staff.staffId}`, { method: "DELETE" });
      await callAny(page, `/api/identity/roles/${staff.roleId}`, { method: "DELETE" });
    }
  });
});

/** A role that reads the board and records but may not edit a record, and a member of it. */
async function makeReadOnlyStaff(page: Page, branchId: string) {
  const id = runId();
  const roleName = `Xem the tag ${id}`;
  const role = await callAny<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const grants = await callAny(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: {
      // Catalogs.View: the chips' names come from the Thẻ hồ sơ catalog, which
      // only that grant may list (the hồ sơ header has the same need).
      permissions: [
        "BlueDental.reception.read",
        "BlueDental.appointment.read",
        "BlueDental.patient.read",
        "BlueDental.Catalogs",
        "BlueDental.Catalogs.View",
      ].map(
        (name) => ({ name, isGranted: true }),
      ),
    },
  });
  expect(grants.status).toBe(204);

  const userName = `xemtag${id}`;
  const staff = await callAny<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên xem tag ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [branchId],
      isActive: true,
    },
  });
  expect(staff.status, JSON.stringify(staff.body)).toBe(200);
  return { roleId: role.body.id, staffId: staff.body.id, userName };
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}
