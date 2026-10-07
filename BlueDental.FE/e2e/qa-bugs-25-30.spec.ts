import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { openNewSlip, revisionOf, writePendingOnFirstLine } from "./fixtures/ledgerReceipt";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Bug list items 25–30 (QA, 2026-10-07).
 *
 * 25 Tiếp nhận: a booking on another day cannot be checked in.
 * 26 Thanh toán: a receipt cannot be dated after today.
 * 27 Danh mục › Dịch vụ: a VNĐ discount larger than the price is refused.
 * 28 Thanh toán: a receipt is cancelled with a reason and stays listed "Đã hủy".
 * 29 Bệnh nhân: a phone another record holds is named and cannot be saved.
 * 30 Bệnh nhân: a name holds only letters, digits, spaces and - . '
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const APPOINTMENTS = "/api/v1/app/appointments";
const PATIENTS = "/api/v1/app/patients";
const PAYMENTS = "/api/v1/app/patient-payments";

interface ApiResult<T> {
  status: number;
  body: T;
}

interface AbpError {
  error?: { code?: string; message?: string };
}

/** One API call from inside the page, with the session, the branch and the antiforgery header. */
async function call<T>(page: Page, method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : null) as never };
    },
    { method, url, body, branch: BRANCH },
  );
}

/** A unique 10-digit mobile number for this run. */
function phoneOf(id: string, tail: string): string {
  return `09${id}${tail}`.padEnd(10, "0").slice(0, 10);
}

async function newPatient(page: Page, firstName: string, phone: string) {
  const res = await call<{ id: string; patientCode: string } & AbpError>(page, "POST", PATIENTS, {
    firstName,
    lastName: "E2E",
    gender: 1,
    phoneNumber: phone,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, code: res.body.patientCode, name: `E2E ${firstName}` };
}

/** Books the patient at `start` with the first dentist whose shift covers it. */
async function book(page: Page, patientId: string, start: Date): Promise<string> {
  const staff = await call<{ items: { id: string }[] }>(page, "GET", "/api/v1/app/staff?MaxResultCount=20");
  const end = new Date(start.getTime() + 30 * 60_000);
  for (const dentist of staff.body.items) {
    if (!(await openShiftCovering(page, BRANCH, dentist.id, start, end))) continue;
    const res = await call<{ id: string }>(page, "POST", APPOINTMENTS, {
      patientId,
      dentistId: dentist.id,
      branchId: BRANCH,
      slotStart: start.toISOString(),
      slotEnd: end.toISOString(),
      type: 2,
      chiefComplaint: `e2e qa25 ${runId()}`,
    });
    if (res.status === 200) return res.body.id;
  }
  throw new Error("no dentist could take the e2e booking");
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe("25 · Tiếp nhận: only today's bookings are received", () => {
  test("a booking for tomorrow cannot be checked in, on the card or through the API", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/reception");
    const id = runId();
    const patient = await newPatient(page, `Ngay Mai ${id}`, phoneOf(id, "25"));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const appointmentId = await book(page, patient.id, tomorrow);

    // The server refuses every step that would receive it.
    for (const step of ["check-in", "start"]) {
      const res = await call<AbpError>(page, "POST", `${APPOINTMENTS}/${appointmentId}/${step}`, {});
      expect(res.status, step).toBeGreaterThanOrEqual(400);
      expect(res.body.error?.code, step).toBe("BlueDental:Appointment:0011");
    }
    const stored = await call<{ status: number; checkedInAt: string | null }>(page, "GET", `${APPOINTMENTS}/${appointmentId}`);
    expect(stored.body.checkedInAt).toBeNull();

    // Tiếp nhận on tomorrow: the card is listed, but its bar and the outcomes
    // that would receive it are shut.
    await page.reload();
    await page.locator(".reception-toolbar .date-navigator-arrow").last().click();
    const card = page.locator(".rc-wrapper", { hasText: patient.name });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await expect(card.locator(".rc-step").first()).toBeDisabled();
    await expect(card.locator(".rc-outcome-btn", { hasText: "Chuyển bác sĩ" })).toBeDisabled();
    await expect(card.locator(".rc-outcome-btn", { hasText: "Kết thúc điều trị" })).toBeDisabled();
    await expect(card.locator(".rc-col-progress")).toHaveAttribute("title", "Chỉ tiếp nhận được vào đúng ngày hẹn");

    await call(page, "POST", `${APPOINTMENTS}/${appointmentId}/cancel`, { reason: 1, note: "e2e cleanup" });
  });
});

test.describe("26 + 28 · Thanh toán: no future date; cancelling needs a reason and leaves a trace", () => {
  test("a receipt cannot move to tomorrow, and a cancelled one stays listed as Đã hủy with who, when and why", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    // A "Hoàn tất" receipt is final (BA 2026-10-08), so this one stays "Chưa thanh toán".
    const receipt = await writePendingOnFirstLine(page);

    // ── 26: the receipt keeps the day it was written. Since the BA's
    // 2026-10-08 rework the edit dialog shows that day and offers no picker,
    // and a date smuggled into the edit is not taken. ──
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const moved = await call<{ paidAt: string }>(page, "PUT", `${PAYMENTS}/${receipt.id}`, {
      ...revisionOf(receipt),
      paidAt: tomorrow.toISOString(),
    });
    expect(moved.status).toBe(200);
    expect(new Date(moved.body.paidAt).getTime()).toBeLessThanOrEqual(Date.now());

    const row = page.locator("tr.ant-table-row", { hasText: receipt.code });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: `Chỉnh sửa phiếu ${receipt.code}` }).click();
    const editor = page.getByRole("dialog", { name: "Chỉnh sửa phiếu thanh toán" });
    await expect(editor).toBeVisible();
    await expect(editor.locator(".ant-picker")).toHaveCount(0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    await expect(editor).toContainText(`${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
    await editor.getByRole("button", { name: /Huỷ|Đóng/ }).first().click();

    // ── 28: no reason, no cancel ──
    await row.getByRole("button", { name: `Huỷ phiếu ${receipt.code}` }).click();
    const dialog = page.getByRole("dialog", { name: /Xác nhận huỷ phiếu thanh toán/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Huỷ$/ }).click();
    await expect(dialog.getByText("Vui lòng nhập lý do hủy phiếu")).toBeVisible();

    const reason = `Thu nhầm e2e ${runId()}`;
    await dialog.getByLabel("Lý do hủy").fill(reason);
    const cancelled = page.waitForResponse((r) => r.url().endsWith(`${receipt.id}/cancel`) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: /Huỷ$/ }).click();
    expect((await cancelled).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // Still listed, after a reload too, as Đã hủy with who, when and why — and
    // it can no longer be edited or cancelled again.
    await page.reload();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("Đã hủy");
    await expect(row).toContainText(`Lý do: ${reason}`);
    await expect(row).toContainText(/admin.*hủy lúc|hủy lúc/);
    await expect(row.getByRole("button", { name: `Huỷ phiếu ${receipt.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Chỉnh sửa phiếu ${receipt.code}` })).toHaveCount(0);

    // Nothing that adds money up counts it; the tab's own list keeps it. It was
    // cancelled while still "Chưa thanh toán", so like the tab the list asks
    // for pending receipts too.
    const counted = await call<{ items: { id: string }[] }>(
      page,
      "GET",
      `${PAYMENTS}?patientId=${receipt.patientId}&treatmentPlanId=${receipt.treatmentPlanId}&maxResultCount=200`,
    );
    expect(counted.body.items.map((p) => p.id)).not.toContain(receipt.id);
    const listed = await call<{ items: { id: string; isDeleted: boolean; cancelReason: string; deleterId: string }[] }>(
      page,
      "GET",
      `${PAYMENTS}?patientId=${receipt.patientId}&treatmentPlanId=${receipt.treatmentPlanId}&includeCancelled=true&includePending=true&maxResultCount=200`,
    );
    const kept = listed.body.items.find((p) => p.id === receipt.id);
    expect(kept?.isDeleted).toBe(true);
    expect(kept?.cancelReason).toBe(reason);
    expect(kept?.deleterId).toBeTruthy();

    // The API refuses a cancel without a reason.
    const blank = await call<AbpError>(page, "POST", `${PAYMENTS}/${receipt.id}/cancel`, { reason: "  " });
    expect(blank.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("27 · Danh mục › Dịch vụ: a VNĐ discount cannot exceed the price", () => {
  test("500.000 off a 300.000 service is refused in the dialog and by the API", async ({ page }) => {
    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, "/api/v1/app/catalog-entries");

    await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^Dịch vụ/ }).fill(`DV GIAM GIA ${runId()}`);
    await dialog.getByLabel(/^Giá$/).fill("300000");
    await dialog.locator(".bd-svc-price-row .ant-segmented-item", { hasText: "VNĐ" }).click();
    await dialog.getByLabel(/Giảm giá/).fill("500000");

    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/v1/app/catalog-entries")) posted = true;
    });
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText("Giảm giá không hợp lệ")).toBeVisible();
    // Bringing it under the price clears it.
    await dialog.getByLabel(/Giảm giá/).fill("300000");
    await expect(dialog.getByText("Giảm giá không hợp lệ")).toHaveCount(0);
    expect(posted).toBe(false);
    await dialog.getByRole("button", { name: /Huỷ|Đóng/ }).first().click();

    const groups = await call<{ items: { id: string }[] }>(
      page,
      "GET",
      `/api/v1/app/taxonomies?ClinicBranchId=${BRANCH}&Group=care_service&MaxResultCount=1`,
    );
    const refused = await call<AbpError>(page, "POST", "/api/v1/app/catalog-entries", {
      clinicBranchId: BRANCH,
      taxonomyId: groups.body.items[0].id,
      name: `DV GIAM GIA API ${runId()}`,
      price: 300000,
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: false,
        discountValue: 500000,
        requireImage: false,
        deductDoctorOnWarranty: false,
        separateRevenue: false,
        showToothOnInvoice: false,
        revenueByStage: false,
        requireStageSequence: false,
        warrantyDays: 0,
        laboSupplierIds: [],
      },
      stages: [],
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body.error?.code).toBe("BlueDental:Catalogs:0019");
  });
});

test.describe("29 + 30 · Bệnh nhân", () => {
  test("a phone another record holds is named and cannot be saved, in the dialog or through the API", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();
    const phone = phoneOf(id, "29");
    const holder = await newPatient(page, `Trung So A ${id}`, phone);
    const other = await newPatient(page, `Trung So B ${id}`, phoneOf(id, "28"));

    // The API refuses a second record, and moving another record onto the number.
    const created = await call<AbpError>(page, "POST", PATIENTS, {
      firstName: `Trung So C ${id}`,
      lastName: "E2E",
      gender: 1,
      phoneNumber: phone,
    });
    expect(created.status).toBeGreaterThanOrEqual(400);
    expect(created.body.error?.code).toBe("BlueDental:Patient:0021");
    const moved = await call<AbpError>(page, "PUT", `${PATIENTS}/${other.id}`, {
      firstName: `Trung So B ${id}`,
      lastName: "E2E",
      gender: 1,
      phoneNumber: phone,
    });
    expect(moved.status).toBeGreaterThanOrEqual(400);
    expect(moved.body.error?.code).toBe("BlueDental:Patient:0021");

    // The check names every holder (only one can exist now that saves are refused).
    const check = await call<{ exists: boolean; owners: { patientCode: string }[] }>(
      page,
      "GET",
      `${PATIENTS}/check-phone?phone=${phone}`,
    );
    expect(check.body.owners.map((o) => o.patientCode)).toEqual([holder.code]);

    // The dialog names the holder and shuts Lưu; another number opens it again.
    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(`Trung So D ${id}`);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(phone);
    const warning = dialog.locator(".bd-patient-dupe");
    await expect(warning).toContainText(`[${holder.code}] ${holder.name}`, { timeout: 15_000 });
    await expect(warning).toContainText("Không thể lưu");
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(phoneOf(id, "27"));
    await expect(warning).toHaveCount(0, { timeout: 15_000 });
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeEnabled();
  });

  test("a name with HTML or symbols is refused; letters, digits and - . ' are kept", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
    const id = runId();

    const refused = await call<AbpError>(page, "POST", PATIENTS, {
      firstName: "123",
      lastName: "DUNG-TEST <b>@#$%</b>",
      gender: 1,
      phoneNumber: phoneOf(id, "30"),
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body.error?.code).toBe("BlueDental:Patient:0020");

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    const name = dialog.getByRole("textbox", { name: "Họ và tên *" });
    await name.fill("DUNG-TEST <b>@#$%</b> 123");
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(phoneOf(id, "31"));
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith(PATIENTS)) posted = true;
    });
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText("Họ tên chỉ được chứa chữ, số, khoảng trắng và các ký tự - . '")).toBeVisible();
    expect(posted).toBe(false);

    // A real name with a hyphen, an apostrophe and a digit is still accepted.
    const kept = `Nguyễn-Văn O'Neil ${id}`;
    await name.fill(kept);
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(PATIENTS));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await saved).status()).toBe(200);
    await expect(dialog).toBeHidden();
  });
});
