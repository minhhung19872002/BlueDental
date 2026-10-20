import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Chẩn đoán & Tư vấn: the plan footer, the advise table's drag-to-reorder, and
 * the two printed sheets — all on the real stack, against the second branch,
 * which is where the plan-scoped vouchers are seeded.
 *
 * No `page.route`, no injected token: the tests log in through the real screen
 * and every assertion below is served by the real API and PostgreSQL.
 */

/** The second branch, where the shared patient below is provisioned. */
const BRANCH = "22222222-2222-2222-2222-222222222222";
/** The first branch, which the slip-opening test provisions its own rows on. */
const BRANCH1 = "11111111-1111-1111-1111-111111111111";

/**
 * The patient most tests read: provisioned once per run through the real API
 * rather than taken from the demo seed, which a re-import of the local DB wipes
 * (the seeded patient and its CN2WELCOME voucher were gone on 2026-10-15). It
 * carries a diagnosis slip with teeth and a note, two priced advise lines on
 * different services, one photograph, and a published plan voucher of its own.
 */
interface Seeded {
  patientId: string;
  voucherId: string;
  voucherCode: string;
}

let seeded: Seeded;

/** A 1×1 PNG, enough for the image panel to hold one tile. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function seedPatient(page: Page): Promise<Seeded> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  return page.evaluate(
    async ({ branch, suffix, png }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) =>
        (await fetch(url, { credentials: "include", headers })).json();
      const send = async (url: string, init: RequestInit) => {
        const res = await fetch(url, { credentials: "include", ...init });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };
      const post = (url: string, body?: unknown) =>
        send(url, {
          method: "POST",
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });

      const patient = await post("/api/v1/app/patients", {
        firstName: `Tư vấn ${suffix}`,
        lastName: "E2E",
        dateOfBirth: null,
        gender: "male",
        phoneNumber: `07${suffix.padStart(8, "0").slice(-8)}`,
      });
      const diagnosis = (
        await get(
          `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`,
        )
      ).items[0];
      const services = (
        await get(
          `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=2`,
        )
      ).items;
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = (toothCode: number) => ({
        toothCode,
        selected: true,
        top: false,
        right: false,
        bottom: false,
        left: false,
        center: false,
      });

      const slip = await post("/api/v1/app/patient-diagnoses", {
        patientId: patient.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.id,
        note: `e2e tư vấn ${suffix}`,
        teeth: [tooth(12), tooth(11)],
      });
      // Priced by hand: a voucher is only offered against a total worth something.
      for (const [index, price] of [800_000, 500_000].entries()) {
        await post("/api/v1/app/patient-advises", {
          patientId: patient.id,
          clinicBranchId: branch,
          patientDiagnosisId: slip.id,
          diagnosisId: diagnosis.id,
          serviceId: services[index].id,
          staffId: staff.id,
          originalPrice: price,
          price,
          quantity: 1,
          discountType: 0,
          discountValue: 0,
          teeth: [tooth(12 - index)],
        });
      }

      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "image/png" }), "e2e-consulting.png");
      form.append("patientId", patient.id);
      form.append("clinicBranchId", branch);
      await send("/api/v1/app/patient-images", {
        method: "POST",
        headers: { "X-Clinic-Branch-Id": branch },
        body: form,
      });

      const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d.toISOString().slice(0, 10);
      };
      const voucher = await post("/api/v1/app/vouchers", {
        code: `CN2${suffix}`,
        name: `e2e kế hoạch ${suffix}`,
        discountType: "fixed_amount",
        discountValue: 100_000,
        scopeTarget: "treatment",
        targetIds: [],
        startDate: day(-1),
        endDate: day(30),
        usageLimit: 100,
        isExclusive: false,
        customerTargets: ["new", "returning"],
        isDaysOfWeekLimited: false,
        daysOfWeek: [],
        displayOnNfcDental: true,
        branchId: branch,
      });
      await post(`/api/v1/app/vouchers/${voucher.id}/publish`);

      return {
        patientId: patient.id as string,
        voucherId: voucher.id as string,
        voucherCode: voucher.code as string,
      };
    },
    { branch: BRANCH, suffix: runId(), png: PNG_BASE64 },
  );
}

function consultingUrl(): string {
  return `/patient/${seeded.patientId}?tab=consulting&branchId=${BRANCH}`;
}

async function openConsulting(page: Page) {
  await page.goto(consultingUrl());
  await assertRealApiTraffic(page, "/api/v1/app/patient-advises");
  await expect(page.locator(".pd-advise-card")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
    timeout: 20000,
  });
}

/** What the plan-scoped voucher is worth and how often it has been used, read off the real API. */
async function voucherUses(
  page: Page,
  code: string,
  orderAmount: number,
  branch: string,
): Promise<{ id: string; usedCount: number; usageLimit: number | null }> {
  const found = await page.evaluate(
    async ({ branch, amount, wanted }) => {
      const res = await fetch(
        `/api/v1/app/vouchers/available?orderAmount=${amount}&clinicBranchId=${branch}`,
        { credentials: "include", headers: { "X-Clinic-Branch-Id": branch } },
      );
      const list = (await res.json()) as {
        id: string;
        code: string;
        usedCount: number;
        usageLimit: number | null;
      }[];
      return list.find((v) => v.code === wanted) ?? null;
    },
    { branch, amount: orderAmount, wanted: code },
  );
  expect(found, `${code} should be offered for ${orderAmount}`).not.toBeNull();
  return found!;
}

/** The service names down the advise table, in the order the table shows them. */
function serviceOrder(page: Page) {
  return page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-strong").allTextContents();
}

test.describe("Chẩn đoán & Tư vấn — kế hoạch", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    seeded = await seedPatient(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!seeded) return;
    const page = await browser.newPage();
    await login(page);
    await page.goto("/patient");
    const statuses = await page.evaluate(
      async ({ branch, voucherId, patientId }) => {
        const headers = { "X-Clinic-Branch-Id": branch };
        const drop = async (url: string) =>
          (await fetch(url, { method: "DELETE", credentials: "include", headers })).status;
        // The patient stays: patients have no delete endpoint (405).
        return [await drop(`/api/v1/app/vouchers/${voucherId}`)];
      },
      { branch: BRANCH, voucherId: seeded.voucherId },
    );
    await page.close();
    expect(statuses.every((status) => status < 300), `cleanup ${statuses.join(", ")}`).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the image panel spins until the photographs arrive, never offering the empty zone first", async ({
    page,
  }) => {
    await page.goto(consultingUrl());

    // The panel is the slowest read on the tab. While it is in flight the box
    // must hold a spinner, not "Kéo ảnh vào" — that text means "no photographs",
    // which is a different thing from "not read yet".
    const zone = page.locator(".pd-image-drop");
    if (await zone.isVisible().catch(() => false)) {
      await expect(zone.locator(".ant-spin")).toBeVisible();
      await expect(zone).not.toContainText("Kéo ảnh vào");
    }

    // This patient has photographs, so the zone gives way to them entirely.
    await expect(page.locator(".pd-image-tile").first()).toBeVisible({ timeout: 20000 });
    await expect(zone).toHaveCount(0);
  });

  test("the diagnosis cell carries the teeth and the slip's note, and the service stands alone", async ({
    page,
  }) => {
    await openConsulting(page);

    // "12, 11, 22 - vôi răng" — the tooth **numbers** and the diagnosis read as
    // one fact in link blue. No surfaces: the reference prints the bare numbers
    // even on teeth whose surfaces are picked, and a line with no diagnosis
    // stops after the numbers, with no trailing dash.
    const cells = page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-link");
    await expect(cells.first()).toBeVisible();
    for (const text of await cells.allInnerTexts()) {
      expect(text.trim()).toMatch(/^\d+(, \d+)*( - .+)?$/);
    }
    await expect(cells.first()).toHaveCSS("color", "rgb(102, 32, 204)");

    // Empty cells of this table read "-", the reference's hyphen, never "—".
    // Chẩn đoán 2 opens switched off (owner, 2026-10-19), so it is put on first.
    await page.getByRole("button", { name: "Cột hiển thị" }).click();
    const panel = page.locator(".pd-column-popover:visible");
    await panel.locator(".pd-column-row").filter({ hasText: "Chẩn đoán 2" }).getByRole("switch").click();
    await panel.getByRole("button", { name: "Lưu" }).click();
    await expect(panel).toBeHidden();
    const headers = await page.locator(".pd-advise-table thead th").allInnerTexts();
    const secondDiagnosisAt = headers.findIndex((h) => h.trim().toLowerCase() === "chẩn đoán 2");
    expect(secondDiagnosisAt).toBeGreaterThan(-1);
    const secondDiagnosis = page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator("td")
      .nth(secondDiagnosisAt);
    await expect(secondDiagnosis).not.toHaveText("—");

    // The service names itself and nothing else: the teeth moved one column on.
    const service = page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-strong").first();
    await expect(service).toBeVisible();
    await expect(service).not.toHaveText(/ - /);
  });

  test("Cập nhật Chẩn Đoán may correct the condition it found", async ({ page }) => {
    await openConsulting(page);

    const row = page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first();
    await expect(row).toBeVisible();
    await row.locator("td").nth(1).click();

    const form = page.locator('[data-testid="diagnosis-form"]');
    await expect(form).toBeVisible();

    // The select is the point of this form, so it is editable while editing.
    const picker = form.locator(".ant-select").nth(1);
    await expect(picker).not.toHaveClass(/ant-select-disabled/);
    const before = (await picker.innerText()).trim();

    await picker.click();
    const option = page
      .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")
      .filter({ hasNotText: before })
      .first();
    await expect(option).toBeVisible();
    const chosen = (await option.innerText()).trim();
    await option.click();

    const saved = page.waitForResponse(
      (res) => res.url().includes("/patient-diagnoses/") && res.request().method() === "PUT",
    );
    await form.getByRole("button", { name: "Cập nhật Chẩn Đoán" }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByText("Đã cập nhật phiếu chẩn đoán")).toBeVisible();

    // The correction is the server's: the row carries it, and so does a reload.
    await expect.poll(async () => (await row.innerText()).includes(chosen)).toBe(true);
    await page.reload();
    await expect(page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first()).toContainText(
      chosen,
      { timeout: 20000 },
    );
  });

  test("the plan commands stay disabled until a service is ticked", async ({ page }) => {
    await openConsulting(page);

    const addToPlan = page.getByRole("button", { name: "Thêm kế hoạch điều trị" });
    const quote = page.getByRole("button", { name: "Tạo báo giá" });
    const print = page.getByRole("button", { name: "In Báo giá", exact: true });
    const voucher = page.getByRole("button", { name: /Chọn voucher|Voucher \(/ });

    for (const command of [addToPlan, quote, print, voucher]) {
      await expect(command).toBeDisabled();
    }

    // Nothing ticked prices nothing.
    await expect(page.locator(".pd-plan-total")).toContainText("0 đ");

    await page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator(".ant-checkbox-input")
      .check();

    for (const command of [addToPlan, quote, print, voucher]) {
      await expect(command).toBeEnabled();
    }
  });

  test("Thêm kế hoạch điều trị refuses to go without a doctor, and says so under the field", async ({
    page,
  }) => {
    await openConsulting(page);
    await page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator(".ant-checkbox-input")
      .check();

    await page.getByRole("button", { name: "Thêm kế hoạch điều trị" }).click();

    // The message belongs under the field it is about, and the tab has not moved.
    const error = page.locator(".pd-plan-dentist-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText("Vui lòng chọn bác sĩ điều trị");
    await expect(page).toHaveURL(/tab=consulting/);

    // Picking a doctor clears it. Stops there on purpose: pressing the command
    // for real raises a slip and converts the lines, which is not repeatable —
    // that path has a test of its own below, on a line it creates itself.
    await page.getByLabel("Chọn bác sĩ điều trị").click();
    await page.locator(".ant-select-item-option").first().click();
    await expect(error).toHaveCount(0);
    await expect(page).toHaveURL(/tab=consulting/);
  });

  test("Thêm kế hoạch điều trị raises a slip off the ticked line, converts it, and burns the picked voucher's use", async ({
    page,
  }) => {
    // Provisions everything it touches through the real API, on the first
    // branch: a consulting line of its own, because opening a slip **converts**
    // the lines it pulls in — a converted line can never be accepted again, so
    // a test that reused seeded rows would pass once — and a voucher of its
    // own, so "Lượt dùng" is read from zero rather than from whatever earlier
    // runs left on a shared one.
    const PRICE = 800_000;
    const OFF = 200_000;
    const id = runId();

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    const made = await page.evaluate(
      async ({ branch, price, off, suffix }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const get = async (url: string) =>
          (await fetch(url, { credentials: "include", headers })).json();
        const post = async (url: string, body?: unknown) => {
          const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
          return res.json();
        };

        const patient = (await get("/api/v1/app/patients?maxResultCount=1")).items[0];
        const diagnosis = (
          await get(
            `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`,
          )
        ).items[0];
        const service = (
          await get(
            `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`,
          )
        ).items[0];
        const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
        const tooth = {
          toothCode: 27,
          selected: true,
          top: false,
          right: false,
          bottom: false,
          left: false,
          center: false,
        };

        const slip = await post("/api/v1/app/patient-diagnoses", {
          patientId: patient.id,
          clinicBranchId: branch,
          diagnosisId: diagnosis.id,
          staffId: staff.id,
          note: `e2e voucher ${suffix}`,
          teeth: [tooth],
        });
        const advise = await post("/api/v1/app/patient-advises", {
          patientId: patient.id,
          clinicBranchId: branch,
          patientDiagnosisId: slip.id,
          diagnosisId: diagnosis.id,
          serviceId: service.id,
          staffId: staff.id,
          // Priced by hand: the catalog collects zero-priced junk from earlier
          // runs, and a voucher is only offered against a total worth something.
          originalPrice: price,
          price,
          quantity: 1,
          discountType: 0,
          discountValue: 0,
          teeth: [tooth],
        });

        const day = (offset: number) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          return d.toISOString().slice(0, 10);
        };
        const voucher = await post("/api/v1/app/vouchers", {
          code: `VC${suffix}`,
          name: `e2e lượt dùng ${suffix}`,
          discountType: "fixed_amount",
          discountValue: off,
          scopeTarget: "treatment",
          targetIds: [],
          startDate: day(-1),
          endDate: day(30),
          usageLimit: 100,
          isExclusive: false,
          customerTargets: ["new", "returning"],
          isDaysOfWeekLimited: false,
          daysOfWeek: [],
          displayOnNfcDental: true,
          branchId: branch,
        });
        await post(`/api/v1/app/vouchers/${voucher.id}/publish`);

        return {
          patientId: patient.id as string,
          adviseId: advise.id as string,
          voucherId: voucher.id as string,
          voucherCode: voucher.code as string,
        };
      },
      { branch: BRANCH1, price: PRICE, off: OFF, suffix: id },
    );

    await page.goto(`/patient/${made.patientId}?tab=consulting&branchId=${BRANCH1}`);
    await assertRealApiTraffic(page, "/api/v1/app/patient-advises");
    const row = page.locator(`.pd-advise-table tr[data-row-key="${made.adviseId}"]`);
    await expect(row).toBeVisible({ timeout: 20000 });

    // The picker asks the server what applies to the ticked total.
    const available = page.waitForResponse(
      (res) =>
        res.url().includes("/vouchers/available") &&
        res.url().includes(`orderAmount=${PRICE}`) &&
        res.request().method() === "GET",
    );
    await row.locator(".ant-checkbox-input").check();
    expect((await available).ok()).toBeTruthy();

    await page.getByLabel("Chọn bác sĩ điều trị").click();
    await page.locator(".ant-select-item-option").first().click();

    // BA item 24 — a voucher's "Lượt dùng" moves when the slip opens, not when
    // it is ticked.
    const before = await voucherUses(page, made.voucherCode, PRICE, BRANCH1);
    expect(before.usedCount).toBe(0);
    await page.getByRole("button", { name: /Chọn voucher|Voucher \(/ }).click();
    await page.locator(".pd-voucher-row").filter({ hasText: made.voucherCode }).click();
    await expect(page.locator(".pd-voucher-row--on")).toHaveCount(1);
    await page.keyboard.press("Escape");
    // Ticking alone burns nothing.
    expect((await voucherUses(page, made.voucherCode, PRICE, BRANCH1)).usedCount).toBe(0);

    const opened = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-treatments") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Thêm kế hoạch điều trị" }).click();
    const response = await opened;
    expect(response.ok(), await response.text()).toBeTruthy();

    // The client sends the voucher's id, never an amount.
    const body = JSON.parse(response.request().postData() ?? "{}") as {
      voucherIds?: string[];
      voucherDiscountAmount?: number;
    };
    expect(body.voucherIds).toEqual([made.voucherId]);
    expect(body.voucherDiscountAmount).toBeUndefined();

    // The slip carries the line it was raised off, priced from it, and the
    // server has worked the voucher out and pinned it on the slip.
    const slip = (await response.json()) as {
      id: string;
      code: string;
      services: { sourceAdviseId: string | null }[];
      voucherDiscountAmount: number | null;
      totalAmount: number;
      appliedVouchers: { voucherId: string; code: string; discountAmount: number }[];
    };
    expect(slip.code).toMatch(/^DT\d+$/);
    expect(slip.services.map((s) => s.sourceAdviseId)).toContain(made.adviseId);
    expect(slip.voucherDiscountAmount).toBe(OFF);
    expect(slip.totalAmount).toBe(PRICE - OFF);
    expect(slip.appliedVouchers).toEqual([
      expect.objectContaining({
        voucherId: made.voucherId,
        code: made.voucherCode,
        discountAmount: OFF,
      }),
    ]);

    // Only then does the tab move.
    await expect(page).toHaveURL(/tab=treatment-plan/);

    // And the line is converted: it now belongs to that slip, for good.
    const status = await page.evaluate(
      async ({ id, branch }) => {
        const res = await fetch(`/api/v1/app/patient-advises/${id}`, {
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": branch },
        });
        return (await res.json()) as { status: number; treatmentPlanId: string | null };
      },
      { id: made.adviseId, branch: BRANCH1 },
    );
    expect(status.status).toBe(3); // Converted
    expect(status.treatmentPlanId).toBe(slip.id);

    // One use burnt, on the voucher itself …
    const after = await voucherUses(page, made.voucherCode, PRICE, BRANCH1);
    expect(after.usedCount).toBe(1);

    // … and the slip still lists the coupon when read back on its own.
    const reread = await page.evaluate(
      async ({ id, branch }) => {
        const res = await fetch(`/api/v1/app/patient-treatments/${id}`, {
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": branch },
        });
        return (await res.json()) as { appliedVouchers: { code: string }[] };
      },
      { id: slip.id, branch: BRANCH1 },
    );
    expect(reread.appliedVouchers.map((v) => v.code)).toEqual([made.voucherCode]);

    // The voucher list's "Lượt dùng" column shows the new count; the header
    // branch follows the URL the tab was opened with.
    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");
    await expect(page.getByRole("row", { name: new RegExp(made.voucherCode) })).toContainText(
      "1 / 100",
    );
  });

  test("a Theo dịch vụ voucher takes off only the lines it names, before the plan voucher (R-949)", async ({
    page,
  }) => {
    // Two lines on two services of two different groups, all provisioned here:
    //   A 1.000.000 đ — VS: 10 % for service A          → 100.000 off A
    //   B   600.000 đ — VG: 100.000 đ for B's group      → 100.000 off B
    //   VP: 200.000 đ off the plan, worked out on what is left (1.400.000),
    //       split by that remainder: A 128.571, B 71.429
    //   VX: a service voucher for a third service nobody ticked — never offered.
    const A_PRICE = 1_000_000;
    const B_PRICE = 600_000;
    const id = runId();

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    const made = await page.evaluate(
      async ({ branch, aPrice, bPrice, suffix }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const get = async (url: string) =>
          (await fetch(url, { credentials: "include", headers })).json();
        const post = async (url: string, body?: unknown) => {
          const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
          return res.json();
        };

        type Entry = { id: string; name: string; taxonomyId: string };
        const patient = (await get("/api/v1/app/patients?maxResultCount=1")).items[0];
        const diagnosis = (
          await get(
            `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`,
          )
        ).items[0];
        const services = (
          await get(
            `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=200`,
          )
        ).items as Entry[];
        const a = services[0];
        const b = services.find((s) => s.taxonomyId !== a.taxonomyId);
        const c = services.find((s) => s.taxonomyId !== a.taxonomyId && s.taxonomyId !== b?.taxonomyId);
        if (!b || !c) throw new Error("needs care services in three groups");
        const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
        const tooth = (toothCode: number) => ({
          toothCode,
          selected: true,
          top: false,
          right: false,
          bottom: false,
          left: false,
          center: false,
        });

        const slip = await post("/api/v1/app/patient-diagnoses", {
          patientId: patient.id,
          clinicBranchId: branch,
          diagnosisId: diagnosis.id,
          staffId: staff.id,
          note: `e2e service voucher ${suffix}`,
          teeth: [tooth(26)],
        });
        const advise = (serviceId: string, price: number, toothCode: number) =>
          post("/api/v1/app/patient-advises", {
            patientId: patient.id,
            clinicBranchId: branch,
            patientDiagnosisId: slip.id,
            diagnosisId: diagnosis.id,
            serviceId,
            staffId: staff.id,
            originalPrice: price,
            price,
            quantity: 1,
            discountType: 0,
            discountValue: 0,
            teeth: [tooth(toothCode)],
          });
        const lineA = await advise(a.id, aPrice, 26);
        const lineB = await advise(b.id, bPrice, 36);

        const day = (offset: number) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          return d.toISOString().slice(0, 10);
        };
        const voucher = async (
          code: string,
          discountType: "percentage" | "fixed_amount",
          discountValue: number,
          scopeTarget: "service" | "treatment",
          targetIds: string[],
        ) => {
          const made = await post("/api/v1/app/vouchers", {
            code: `${code}${suffix}`,
            name: `e2e ${code} ${suffix}`,
            discountType,
            discountValue,
            scopeTarget,
            targetIds,
            startDate: day(-1),
            endDate: day(30),
            usageLimit: 100,
            isExclusive: false,
            customerTargets: ["new", "returning"],
            isDaysOfWeekLimited: false,
            daysOfWeek: [],
            displayOnNfcDental: true,
            branchId: branch,
          });
          await post(`/api/v1/app/vouchers/${made.id}/publish`);
          return { id: made.id as string, code: made.code as string };
        };

        return {
          patientId: patient.id as string,
          lineA: lineA.id as string,
          lineB: lineB.id as string,
          nameA: a.name,
          nameB: b.name,
          vs: await voucher("VS", "percentage", 10, "service", [a.id]),
          vg: await voucher("VG", "fixed_amount", 100_000, "service", [b.taxonomyId]),
          vp: await voucher("VP", "fixed_amount", 200_000, "treatment", []),
          vx: await voucher("VX", "fixed_amount", 50_000, "service", [c.id]),
        };
      },
      { branch: BRANCH1, aPrice: A_PRICE, bPrice: B_PRICE, suffix: id },
    );

    await page.goto(`/patient/${made.patientId}?tab=consulting&branchId=${BRANCH1}`);
    await assertRealApiTraffic(page, "/api/v1/app/patient-advises");
    const rowA = page.locator(`.pd-advise-table tr[data-row-key="${made.lineA}"]`);
    const rowB = page.locator(`.pd-advise-table tr[data-row-key="${made.lineB}"]`);
    await expect(rowA).toBeVisible({ timeout: 20000 });
    const digits = async (text: Promise<string>) => Number((await text).replace(/\D/g, ""));
    const net = () => digits(page.locator(".pd-plan-net b").innerText());
    const card = (code: string) => page.locator(".pd-voucher-row").filter({ hasText: code });
    const openPicker = async () => {
      await page.getByRole("button", { name: /Chọn voucher|Voucher \(/ }).click();
      await expect(page.locator(".pd-voucher-list")).toBeVisible();
    };

    // Only B ticked: A's voucher has nothing to take off, B's group voucher has.
    const onB = page.waitForResponse(
      (res) => res.url().includes("/vouchers/available") && res.url().includes(`orderAmount=${B_PRICE}`),
    );
    await rowB.locator(".ant-checkbox-input").check();
    expect((await onB).ok()).toBeTruthy();
    await openPicker();
    await expect(card(made.vg.code)).toContainText("Dịch vụ");
    await expect(card(made.vg.code)).toContainText(`Áp cho: ${made.nameB}`);
    await expect(card(made.vp.code)).toContainText("Kế hoạch");
    await expect(card(made.vs.code)).toHaveCount(0);
    await expect(card(made.vx.code)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A ticked too: now A's voucher is offered, naming A alone, and worth 10 % of A.
    const onBoth = page.waitForResponse(
      (res) =>
        res.url().includes("/vouchers/available") &&
        res.url().includes(`orderAmount=${A_PRICE + B_PRICE}`),
    );
    await rowA.locator(".ant-checkbox-input").check();
    expect((await onBoth).ok()).toBeTruthy();
    await openPicker();
    await expect(card(made.vs.code)).toContainText(`Áp cho: ${made.nameA}`);
    await expect(card(made.vs.code)).not.toContainText(made.nameB);
    await expect(card(made.vs.code)).toContainText("100.000");
    await expect(card(made.vx.code)).toHaveCount(0);

    // Plan voucher first, then the two service ones: the server still works the
    // service ones out first, and the footer shows what it will charge.
    await card(made.vp.code).click();
    await card(made.vs.code).click();
    await card(made.vg.code).click();
    await expect(page.locator(".pd-voucher-row--on")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect.poll(net).toBe(1_200_000);
    const applied = page.locator(".pd-plan-applied");
    await expect(applied).toHaveCount(3);
    await expect(applied.filter({ hasText: made.vs.code })).toContainText(`cho ${made.nameA}`);
    await expect(applied.filter({ hasText: made.vs.code })).toContainText("-100.000");
    await expect(applied.filter({ hasText: made.vp.code })).toContainText("-200.000");

    // Unticking A drops the voucher that only reached A; ticking it back does not re-pick it.
    await rowA.locator(".ant-checkbox-input").uncheck();
    await expect(applied).toHaveCount(2);
    await expect(applied.filter({ hasText: made.vs.code })).toHaveCount(0);
    await expect.poll(net).toBe(B_PRICE - 100_000 - 200_000);
    await rowA.locator(".ant-checkbox-input").check();
    await expect(applied).toHaveCount(2);
    await openPicker();
    await card(made.vs.code).click();
    await page.keyboard.press("Escape");
    await expect(applied).toHaveCount(3);
    await expect.poll(net).toBe(1_200_000);

    await page.getByLabel("Chọn bác sĩ điều trị").click();
    await page.locator(".ant-select-item-option").first().click();

    const opened = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-treatments") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Thêm kế hoạch điều trị" }).click();
    const response = await opened;
    expect(response.ok(), await response.text()).toBeTruthy();

    // The ids go in pick order (VP, VG, then VS after its re-pick) and nothing else.
    const body = JSON.parse(response.request().postData() ?? "{}") as { voucherIds?: string[] };
    expect(body.voucherIds).toEqual([made.vp.id, made.vg.id, made.vs.id]);

    type Slip = {
      id: string;
      code: string;
      totalAmount: number;
      totalDiscountAmount: number;
      serviceVoucherAmount: number;
      voucherDiscountAmount: number | null;
      services: {
        sourceAdviseId: string | null;
        serviceVoucherAmount: number;
        planVoucherShare: number;
      }[];
      appliedVouchers: { voucherId: string; scopeTarget: string; discountAmount: number }[];
    };
    const expectSlip = (slip: Slip) => {
      expect(slip.totalAmount).toBe(1_200_000);
      expect(slip.serviceVoucherAmount).toBe(200_000);
      expect(slip.voucherDiscountAmount).toBe(200_000);
      expect(slip.totalDiscountAmount).toBe(400_000);
      const line = (advise: string) => slip.services.find((s) => s.sourceAdviseId === advise)!;
      expect(line(made.lineA).serviceVoucherAmount).toBe(100_000);
      expect(line(made.lineB).serviceVoucherAmount).toBe(100_000);
      expect(line(made.lineA).planVoucherShare).toBe(128_571);
      expect(line(made.lineB).planVoucherShare).toBe(71_429);
      expect(slip.appliedVouchers).toEqual([
        expect.objectContaining({ voucherId: made.vp.id, scopeTarget: "treatment", discountAmount: 200_000 }),
        expect.objectContaining({ voucherId: made.vg.id, scopeTarget: "service", discountAmount: 100_000 }),
        expect.objectContaining({ voucherId: made.vs.id, scopeTarget: "service", discountAmount: 100_000 }),
      ]);
    };
    const slip = (await response.json()) as Slip;
    expectSlip(slip);
    await expect(page).toHaveURL(/tab=treatment-plan/);

    // Read back on its own request: the figures were stored, not just returned.
    const reread = await page.evaluate(
      async ({ id, branch }) => {
        const res = await fetch(`/api/v1/app/patient-treatments/${id}`, {
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": branch },
        });
        return res.json();
      },
      { id: slip.id, branch: BRANCH1 },
    );
    expectSlip(reread as Slip);

    // One use each — the service vouchers included, each once however many lines it reached.
    for (const voucher of [made.vs, made.vg, made.vp]) {
      expect((await voucherUses(page, voucher.code, A_PRICE + B_PRICE, BRANCH1)).usedCount).toBe(1);
    }
    expect((await voucherUses(page, made.vx.code, A_PRICE + B_PRICE, BRANCH1)).usedCount).toBe(0);

    // Chi tiết kế hoạch: each line's Thành tiền nets out its own voucher and its share.
    await page.reload();
    await page.locator(".tp-table .tp-code", { hasText: slip.code }).click();
    await expect(page).toHaveURL(/\/treatment-plan\/[0-9a-f-]{36}/);
    const lines = page.locator(".pdt-table tbody tr.ant-table-row");
    await expect(lines).toHaveCount(2, { timeout: 20000 });
    // Rows read by their Đơn giá: the name sits in a cell the row text leaves out.
    await expect(lines.filter({ hasText: "1.000.000" })).toContainText("228.571");
    await expect(lines.filter({ hasText: "1.000.000" })).toContainText("771.429");
    await expect(lines.filter({ hasText: "600.000" })).toContainText("171.429");
    await expect(lines.filter({ hasText: "600.000" })).toContainText("428.571");
  });

  test("the voucher picker offers the branch's own plan vouchers, and one comes off the total", async ({
    page,
  }) => {
    await openConsulting(page);

    // A voucher is offered against a total, so the row ticked here has to be
    // worth something. The catalog collects zero-priced junk from earlier runs
    // and a consulting line written off one of those totals nothing.
    const rows = page.locator(".pd-advise-table tbody tr.ant-table-row");
    await expect(rows.first()).toBeVisible();

    // The biggest money figure on the row stands for what it is worth; the
    // column it sits in moves with "Cột hiển thị", so it is not indexed.
    const worthOf = async (index: number): Promise<number> => {
      const text = await rows.nth(index).innerText();
      const figures = [...text.matchAll(/([\d.]+)\s*đ/g)].map((m) =>
        Number(m[1].replace(/\D/g, "")),
      );
      return figures.length > 0 ? Math.max(...figures) : 0;
    };

    let priced = -1;
    for (let index = 0; index < (await rows.count()); index++) {
      if ((await worthOf(index)) > 0) {
        priced = index;
        break;
      }
    }
    expect(priced).toBeGreaterThan(-1);

    // The picker asks the server what applies to the ticked total, so the read
    // goes out on the tick — before the popover is ever opened.
    const available = page.waitForResponse(
      (res) =>
        res.url().includes("/vouchers/available") &&
        res.url().includes("orderAmount=") &&
        !res.url().includes("orderAmount=0") &&
        res.request().method() === "GET",
    );
    await rows.nth(priced).locator(".ant-checkbox-input").check();
    expect((await available).ok()).toBeTruthy();

    await page.getByRole("button", { name: /Chọn voucher|Voucher \(/ }).click();

    // Staging's search box and its count.
    await expect(page.getByRole("textbox", { name: "Tìm voucher" })).toHaveAttribute(
      "placeholder",
      "Tìm voucher theo mã hoặc tên...",
    );
    await expect(page.getByText("Đã chọn: 0")).toBeVisible();

    // Provisioned for this branch: treatment-scoped, published, inside its dates.
    const list = page.locator(".pd-voucher-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText(seeded.voucherCode);

    // A code no voucher carries leaves the bordered box on its empty sentence.
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill("KHONG-CO-MA-NAY");
    await expect(
      page.getByText("Không có voucher nào khả dụng cho kế hoạch điều trị."),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill("");
    await expect(list).toContainText(seeded.voucherCode);

    const before = await page.locator(".pd-plan-net b").innerText();
    await page.locator(".pd-voucher-row").filter({ hasText: seeded.voucherCode }).click();
    await expect(page.locator(".pd-voucher-row--on")).toHaveCount(1);
    await expect.poll(async () => page.locator(".pd-plan-net b").innerText()).not.toBe(before);
  });

  test("dragging a service by its grip reorders the table, and the order survives a reload", async ({
    page,
  }) => {
    await openConsulting(page);

    const before = await serviceOrder(page);
    test.skip(before.length < 2, "needs two advise rows to swap");

    const grips = page.locator(".pd-advise-table tbody tr.ant-table-row .bd-grip");
    const rows = page.locator(".pd-advise-table tbody tr.ant-table-row");

    // The card sits well below the fold, and boundingBox() does not scroll —
    // driving the mouse at an off-screen coordinate presses nothing at all.
    await grips.nth(0).scrollIntoViewIfNeeded();
    const from = (await grips.nth(0).boundingBox())!;
    const to = (await rows.nth(1).boundingBox())!;

    const saved = page.waitForResponse(
      (res) => res.url().includes("/patient-advises/reorder") && res.request().method() === "PUT",
    );
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 5 });
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await saved).ok()).toBeTruthy();

    const swapped = [before[1], before[0], ...before.slice(2)];
    await expect.poll(() => serviceOrder(page)).toEqual(swapped);

    // The order is the server's, not the browser's.
    await page.reload();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
    await expect.poll(() => serviceOrder(page)).toEqual(swapped);

    // Put it back so a re-run starts where this one did.
    await grips.nth(1).scrollIntoViewIfNeeded();
    const b1 = (await grips.nth(1).boundingBox())!;
    const r0 = (await rows.nth(0).boundingBox())!;
    const restored = page.waitForResponse(
      (res) => res.url().includes("/patient-advises/reorder") && res.request().method() === "PUT",
    );
    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
    await page.mouse.down();
    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2 - 12, { steps: 5 });
    await page.mouse.move(b1.x + b1.width / 2, r0.y + r0.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await restored).ok()).toBeTruthy();
    await expect.poll(() => serviceOrder(page)).toEqual(before);
  });

  test("a photograph's tile shimmers until its own file paints", async ({ page }) => {
    await page.goto(consultingUrl());

    // The rows come back long before the files do. A tile that only reserves
    // its 240px reads as an empty panel, so it carries the loading class until
    // its <img> fires load — and every tile has dropped it once they paint.
    const tiles = page.locator(".pd-image-tile");
    await expect(tiles.first()).toBeVisible({ timeout: 20000 });
    await expect.poll(() => page.locator(".pd-image-tile--loading").count()).toBe(0);
    await expect(tiles.first().locator("img")).toHaveJSProperty("complete", true);
  });

  test("the grip is the leftmost cell, ahead of the tick box, and no wider than it needs", async ({
    page,
  }) => {
    await openConsulting(page);

    // antd puts its selection column first whatever the column order, so the
    // grip only leads if it is named before Table.SELECTION_COLUMN.
    const firstRow = page.locator(".pd-advise-table tbody tr.ant-table-row").first();
    const gripCell = firstRow.locator("td").first();
    await expect(gripCell.locator(".bd-grip")).toBeVisible();
    await expect(firstRow.locator("td").nth(1).locator(".ant-checkbox-input")).toHaveCount(1);

    // Just wide enough for the grip: antd's own cell padding would otherwise
    // hold it open to about a normal column's width.
    const width = Math.round((await gripCell.boundingBox())!.width);
    expect(width).toBeLessThanOrEqual(40);
    expect(width).toBeGreaterThanOrEqual(20);
  });

  test("Cột hiển thị drags its rows and applies nothing until Lưu", async ({ page }) => {
    await openConsulting(page);

    // The header row renders uppercase (text-transform), so compare uppercase.
    const NGAY = "NGÀY";
    const DICH_VU = "DỊCH VỤ";
    const headers = () =>
      page.locator(".pd-advise-table thead th").filter({ hasText: /\S/ }).allInnerTexts();
    const before = await headers();
    expect(before).toContain(NGAY);
    expect(before).toContain(DICH_VU);

    const open = async () => {
      // Scrolled to the top first: the panel drops below the button, and with
      // the card low on the screen its lower rows fall past the fold, where a
      // drag cannot reach them.
      const button = page.getByRole("button", { name: "Cột hiển thị" });
      await button.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await button.click();
      // `:visible` because antd keeps a closed popover's content mounted — a
      // bare class query can resolve to the hidden copy of an earlier open.
      const panel = page.locator(".pd-column-popover:visible");
      await expect(panel).toBeVisible();
      // Polled: antd scales the panel in, so a box read the moment it turns
      // visible is nowhere near where the grip settles — and a drag pressed at
      // that coordinate misses the grip entirely.
      await expect
        .poll(async () =>
          Math.round((await panel.locator(".pd-column-row").first().boundingBox())!.width),
        )
        .toBeGreaterThanOrEqual(240);
      return panel;
    };

    // Turning a column off and closing without Lưu changes nothing.
    let panel = await open();
    await expect(panel.getByRole("button", { name: "Lưu" })).toBeVisible();
    await panel.locator(".pd-column-row").filter({ hasText: "Ngày" }).getByRole("switch").click();
    await page.locator(".pd-column-close:visible").click();
    await expect(panel).toBeHidden();
    expect(await headers()).toEqual(before);

    // The same edit, saved, drops the column.
    panel = await open();
    await panel.locator(".pd-column-row").filter({ hasText: "Ngày" }).getByRole("switch").click();
    await panel.getByRole("button", { name: "Lưu" }).click();
    await expect(panel).toBeHidden();
    await expect.poll(headers).not.toContain(NGAY);

    // Back on, then dragged below "Dịch vụ": the panel's order is the table's.
    panel = await open();
    const row = (label: string) => panel.locator(".pd-column-row").filter({ hasText: label });
    await row("Ngày").getByRole("switch").click();
    const from = (await row("Ngày").locator(".bd-grip").boundingBox())!;
    const to = (await row("Dịch vụ").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 6, { steps: 4 });
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2 + 4, { steps: 10 });
    await page.mouse.up();
    await panel.getByRole("button", { name: "Lưu" }).click();

    await expect
      .poll(async () => {
        const now = await headers();
        return now.indexOf(DICH_VU) < now.indexOf(NGAY);
      })
      .toBe(true);

    // No restore needed: the column setting is this card's own state, so the
    // next test's navigation brings the reference's order back by itself.
  });

  test("Tạo báo giá asks first, then opens a BG tab that outlives a reload", async ({ page }) => {
    await openConsulting(page);

    const before = await serviceOrder(page);
    const quoteTabs = () => page.getByRole("tab").filter({ hasText: /^BG/ });
    const numberOf = (label: string) => Number(label.replace(/\D+/g, ""));

    // Quotes are stored now, so this patient may carry some from an earlier run
    // that ended badly. Cleared through the real API rather than assumed away —
    // the test asserts counts, and a leftover would fail it for the wrong reason.
    await page.evaluate(
      async ({ patient, branch }) => {
        const headers = { "X-Clinic-Branch-Id": branch };
        const existing = (await (
          await fetch(`/api/v1/app/patient-quotes?patientId=${patient}&maxResultCount=50`, {
            credentials: "include",
            headers,
          })
        ).json()) as { items: { id: string }[] };

        for (const quote of existing.items) {
          await fetch(`/api/v1/app/patient-quotes/${quote.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
          });
        }
      },
      { patient: seeded.patientId, branch: BRANCH },
    );
    await page.reload();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });

    await page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator(".ant-checkbox-input")
      .check();

    // Nothing happens until the confirmation is answered.
    await page.getByRole("button", { name: "Tạo báo giá" }).click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("bạn có thể chỉnh sửa ở phần báo giá");
    await confirm.getByRole("button", { name: "Không" }).click();
    await expect(quoteTabs()).toHaveCount(0);

    await page.getByRole("button", { name: "Tạo báo giá" }).click();
    await confirm.getByRole("button", { name: "Có" }).click();

    // The quote opens on its own tab, carrying only what was ticked. Its number
    // is the server's — counted over every quote ever raised for this patient,
    // deleted ones included — so the label is read rather than assumed "BG 1".
    await expect(quoteTabs()).toHaveCount(1);
    const firstTab = quoteTabs().first();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    const firstLabel = (await firstTab.innerText()).trim();
    // One tab per quote, and only ever one open. An impure state updater used
    // to insert each quote twice under StrictMode, and both copies then drew as
    // the open one — ✕ and all. Counted here because the production build hides
    // that class of bug: StrictMode only double-invokes in development.
    await expect(page.locator(".pd-advise-tab--on")).toHaveCount(1);
    await expect.poll(() => serviceOrder(page)).toEqual([before[0]]);

    // The plan block stays under a quote, priced on the quote's own ticks, and
    // its middle command becomes "Sao chép báo giá".
    const summary = page.locator(".pd-plan-summary");
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("button", { name: "Thêm kế hoạch điều trị" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "In Báo giá", exact: true })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Tạo báo giá" })).toHaveCount(0);
    const copy = summary.getByRole("button", { name: "Sao chép báo giá" });
    await expect(copy).toBeVisible();

    // Copying raises a second quote off the same rows, opens it, and puts it in
    // front — the newest sits next to "Phiếu tư vấn".
    await copy.click();
    await expect(quoteTabs()).toHaveCount(2);
    const newestTab = quoteTabs().first();
    await expect(newestTab).toHaveAttribute("aria-selected", "true");
    const newestLabel = (await newestTab.innerText()).trim();
    expect(newestLabel).not.toBe(firstLabel);
    expect(numberOf(newestLabel)).toBeGreaterThan(numberOf(firstLabel));
    await expect.poll(() => serviceOrder(page)).toEqual([before[0]]);
    await expect(page.locator(".pd-advise-tab--on")).toHaveCount(1);

    // Only the open quote offers its ✕.
    await expect(page.getByRole("button", { name: `Bỏ ${newestLabel}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Bỏ ${firstLabel}` })).toHaveCount(0);

    // Back to the plan, and the whole list is there again.
    await page.getByRole("tab", { name: "Phiếu tư vấn" }).click();
    await expect.poll(() => serviceOrder(page)).toEqual(before);
    await expect(summary.getByRole("button", { name: "Tạo báo giá" })).toBeVisible();

    // Both quotes are the server's, so a reload still finds them — newest
    // first, and the strip opens on the plan again.
    await page.reload();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
    await expect(quoteTabs()).toHaveCount(2);
    await expect(quoteTabs().first()).toHaveText(newestLabel);
    await expect(page.getByRole("tab", { name: "Phiếu tư vấn" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Clicking "Phiếu tư vấn" while it is already open does nothing at all —
    // no dialog, no navigation.
    const openTabs = await page.getByRole("tab").allInnerTexts();
    await page.getByRole("tab", { name: "Phiếu tư vấn" }).click();
    await expect(page.locator(".ant-modal-wrap:not([style*='display: none'])")).toHaveCount(0);
    expect(await page.getByRole("tab").allInnerTexts()).toEqual(openTabs);

    // The ✕ asks first — a quote is dropped on the server and does not come
    // back. Answering "Huỷ" leaves it where it was.
    const dropQuote = async (label: string) => {
      await page.getByRole("tab", { name: label }).click();
      await page.getByRole("button", { name: `Bỏ ${label}` }).click();
      const ask = page.getByRole("dialog", { name: "Xóa báo giá" });
      await expect(ask).toBeVisible();
      await expect(ask).toContainText(`Phiếu báo giá ${label} sẽ bị xoá`);
      await expect(ask).toContainText("Hành động này không thể hoàn tác.");
      await ask.getByRole("button", { name: "Huỷ" }).click();
      await expect(ask).toBeHidden();
      await expect(page.getByRole("tab", { name: label })).toBeVisible();

      await page.getByRole("button", { name: `Bỏ ${label}` }).click();
      await expect(ask).toBeVisible();
      // The confirm button's name carries its icon: "delete Xoá".
      await ask.getByRole("button", { name: /Xoá/ }).click();
      await expect(ask).toBeHidden();
    };

    // Also leaves this patient with no quotes, so a re-run starts where this
    // one did.
    await dropQuote(newestLabel);
    await expect(quoteTabs()).toHaveCount(1);
    await dropQuote(firstLabel);
    await expect(quoteTabs()).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
    await expect(quoteTabs()).toHaveCount(0);
  });

  test("both printed sheets end on the reference's signature strip", async ({ page }) => {
    await openConsulting(page);
    await page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator(".ant-checkbox-input")
      .check();

    await page.getByRole("button", { name: "In Báo giá", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(detail).toBeVisible();

    // "In Hoá Đơn" — PHIẾU BÁO GIÁ: the caption sits under the role, the
    // signing space above the printed name.
    await detail.getByRole("button", { name: "In Hoá Đơn" }).click();
    const quote = page.locator(".pq-sheet:visible .pq-signs");
    await expect(quote).toBeVisible();
    await expect(quote.locator(".pq-signs__role")).toHaveText(["Người lập phiếu", "Khách hàng"]);
    await expect(quote.locator(".pq-signs__caption").first()).toHaveText("(Ký, ghi rõ họ tên)");
    await expect(quote.locator(".pq-signs__name").first()).toHaveText("Thu Ngân / Bác Sĩ");
    await page
      .getByRole("button", { name: /^Đóng|close/i })
      .last()
      .click()
      .catch(() => {});
    await page.keyboard.press("Escape");

    // "In hóa đơn kèm chẩn đoán" — the diagnosis invoice names the doctor and
    // captions it underneath.
    await detail.getByRole("button", { name: "In hóa đơn kèm chẩn đoán" }).click();
    // `:visible` for the same reason as the column panel: a preview that has
    // been closed can still be mounted, and the geometry below would then be
    // measured across two copies of the sheet.
    const invoice = page.locator(".pq-dx:visible .pq-signs");
    await expect(invoice).toBeVisible();
    await expect(invoice.locator(".pq-signs__role")).toHaveText(["Bác sĩ chẩn đoán", "Khách hàng"]);
    await expect(invoice.locator(".pq-signs__caption").first()).toHaveText("(Ký, họ tên)");

    // The doctor is the one field the reference lets you correct on the sheet.
    // The customer's name beside it is not editable.
    const doctor = invoice.getByRole("textbox", { name: "Bác sĩ chẩn đoán" });
    await expect(doctor).toBeVisible();
    await doctor.fill("BS Kiểm Tra");
    await expect(doctor).toHaveValue("BS Kiểm Tra");
    await expect(invoice.locator("input")).toHaveCount(1);

    // Both columns leave room for a pen above the name, and leave the same
    // amount. Measured at the text rather than the box: the printed name is a
    // <p> holding that space as padding — inside its box — while the editable
    // one has to hold it as margin, since padding in an input only makes the
    // box tall. Comparing box tops would read 51px against 6px and mean nothing.
    const columns = invoice.locator(".pq-signs__col");
    const textTop = (index: number) =>
      columns
        .nth(index)
        .locator(".pq-signs__name")
        .evaluate((el) => {
          const box = el.getBoundingClientRect();
          return box.y + parseFloat(getComputedStyle(el).paddingTop);
        });
    const roleBottom = async (index: number) => {
      const role = (await columns.nth(index).locator(".pq-signs__role").boundingBox())!;
      return role.y + role.height;
    };

    const doctorSpace = (await textTop(0)) - (await roleBottom(0));
    const customerSpace = (await textTop(1)) - (await roleBottom(1));
    expect(doctorSpace).toBeGreaterThanOrEqual(30);
    expect(Math.abs(doctorSpace - customerSpace)).toBeLessThanOrEqual(8);

    // And the field is centred under its heading, not flush left.
    const column = (await columns.nth(0).boundingBox())!;
    const field = (await doctor.boundingBox())!;
    const leftGap = field.x - column.x;
    const rightGap = column.x + column.width - (field.x + field.width);
    // Loose enough for subpixel layout, tight enough that flush-left (which
    // would leave the whole 40% on one side) still fails.
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(10);
  });
});
