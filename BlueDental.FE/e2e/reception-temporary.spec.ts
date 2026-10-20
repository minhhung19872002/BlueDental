import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Tiếp nhận — a "Lịch tạm" card (review P2909, 2026-09-30).
 *
 * - "Lịch tạm" is a tab on the card's top edge, as the reference draws it; the
 *   badge beside the ticket keeps the visit's own status.
 * - The walk-in's name opens "Tạo hồ sơ" filled with its name and phone, and
 *   the saved record takes the appointment over: the card stops being
 *   temporary, so a second click cannot make a second record.
 *
 * Real stack throughout: the temporary booking is made through the API, the
 * record through the dialog, and every state is re-read from the server.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  branchId: string;
  isTemporary: boolean;
}

interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string } };
}

async function call<T>(
  page: Page,
  branchId: string,
  url: string,
  options: { method?: "GET" | "POST"; json?: unknown } = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options, branchId }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        "X-Clinic-Branch-Id": branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: string | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      }
      const res = await fetch(url, { method: options.method ?? "GET", credentials: "include", headers, body });
      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as never };
    },
    { url, options, branchId },
  );
}

async function openBoard(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/reception");
  return (await request).headers()["x-clinic-branch-id"];
}

/** A "Lịch tạm" for later today, under a name unique to this run. */
async function bookTemporary(page: Page, branchId: string) {
  const name = `E2E TAM ${runId()}`;
  const phone = `09${runId().padStart(8, "0").slice(-8)}`;
  const start = new Date(Date.now() + 45 * 60_000);
  start.setSeconds(0, 0);
  test.skip(start.getDate() !== new Date().getDate(), "too close to midnight to book for today");
  const end = new Date(start.getTime() + 15 * 60_000);

  const res = await call<Appointment>(page, branchId, `${APPOINTMENTS}/temp`, {
    method: "POST",
    json: { patientName: name, patientPhone: phone, branchId, slotStart: start, slotEnd: end },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.isTemporary).toBe(true);
  return { ...res.body, name, phone };
}

async function cardNamed(page: Page, name: string) {
  const searched = page.waitForResponse(
    (r) => r.url().includes(APPOINTMENTS) && r.url().includes("filter=") && r.ok(),
  );
  await page.getByPlaceholder("Tìm bệnh nhân...").first().fill(name);
  await searched;
  const card = page.locator(".rc-wrapper", { hasText: name });
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  return card;
}

test.describe("Tiếp nhận — Lịch tạm", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the tab rides the card's top edge and the badge keeps the visit's status", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const branchId = await openBoard(page);
    const temp = await bookTemporary(page, branchId);
    const card = await cardNamed(page, temp.name);

    const tab = card.locator(".rc-temp-tab");
    await expect(tab).toHaveText("Lịch tạm");
    await expect(card.locator(".rc-badge")).toHaveText("Đã hẹn");

    // Straddling the edge: the tab's middle sits on the card's top border.
    const tabBox = (await tab.boundingBox())!;
    const cardBox = (await card.locator(".rc-card").boundingBox())!;
    expect(Math.abs(tabBox.y + tabBox.height / 2 - cardBox.y)).toBeLessThanOrEqual(2);
    expect(tabBox.x - cardBox.x).toBeGreaterThan(8);
    await expect(tab).toHaveCSS("background-color", "rgb(221, 208, 255)");
    await page.screenshot({
      path: "test-results/reception-temporary-card.png",
      clip: { x: cardBox.x - 12, y: cardBox.y - 24, width: cardBox.width + 24, height: cardBox.height + 36 },
    });
  });

  test("the name opens Tạo hồ sơ filled in, and the saved record takes the appointment over", async ({
    page,
  }) => {
    const branchId = await openBoard(page);
    const temp = await bookTemporary(page, branchId);
    const card = await cardNamed(page, temp.name);

    await card.getByRole("button", { name: temp.name }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/reception/);
    await expect(dialog.getByRole("textbox", { name: /Họ và tên/ })).toHaveValue(temp.name);
    await expect(dialog.getByRole("textbox", { name: /Điện thoại/ })).toHaveValue(temp.phone);

    const attached = page.waitForResponse(
      (r) => r.url().endsWith(`${APPOINTMENTS}/${temp.id}/attach-patient`) && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await attached).status()).toBe(200);
    await expect(dialog).toBeHidden();

    // On the server: no longer temporary, and it names the new record.
    const stored = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${temp.id}`);
    expect(stored.body.isTemporary).toBe(false);
    expect(stored.body.patientId).not.toBe("00000000-0000-0000-0000-000000000000");
    const patient = await call<{ id: string; fullName: string; phoneNumber: string }>(
      page, branchId, `/api/v1/app/patients/${stored.body.patientId}`,
    );
    expect(patient.status).toBe(200);
    expect(patient.body.phoneNumber).toBe(temp.phone);

    // After a reload the card is an ordinary one: no tab, and the name opens
    // the record instead of a second "Tạo hồ sơ".
    await page.reload();
    const again = await cardNamed(page, temp.name);
    await expect(again.locator(".rc-temp-tab")).toHaveCount(0);
    await again.locator(".rc-patient-name").click();
    await expect(page).toHaveURL(new RegExp(`/patient/${stored.body.patientId}`));

    // The server refuses to attach it a second time.
    const twice = await call<unknown>(page, branchId, `${APPOINTMENTS}/${temp.id}/attach-patient`, {
      method: "POST",
      json: { patientId: stored.body.patientId },
    });
    expect(twice.status).not.toBe(200);
    expect(twice.body.error?.code).toBe("BlueDental:Appointment:0007");
  });

  test("another branch cannot attach a record to this branch's Lịch tạm", async ({ page }) => {
    const branchId = await openBoard(page);
    const temp = await bookTemporary(page, branchId);
    const branches = await call<{ items: { id: string }[] }>(
      page, branchId, "/api/v1/app/clinic-branches?maxResultCount=50",
    );
    const other = branches.body.items.find((b) => b.id !== branchId);
    test.skip(!other, "only one branch is seeded");

    const patients = await call<{ items: { id: string }[] }>(
      page, other!.id, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${other!.id}`,
    );
    const res = await call<unknown>(page, other!.id, `${APPOINTMENTS}/${temp.id}/attach-patient`, {
      method: "POST",
      json: { patientId: patients.body.items[0]?.id },
    });
    expect(res.status).toBe(404);
    const stored = await call<Appointment>(page, branchId, `${APPOINTMENTS}/${temp.id}`);
    expect(stored.body.isTemporary).toBe(true);
  });
});
