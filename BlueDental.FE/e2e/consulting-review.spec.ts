import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Chẩn đoán & Tư vấn — the fixes asked for in review P2909 (2026-09-30):
 *
 * - "Bác sĩ chẩn đoán 2" on the diagnosis card, "-" when nobody is named, a
 *   printer on its print button, and a sticky bar the form's labels no longer
 *   ride over;
 * - the empty image zone opens the file chooser;
 * - Phiếu tư vấn and each báo giá carry independent figures: a discount
 *   changed on one quote moves that quote only.
 *
 * Everything is provisioned through the real API on the first branch — a
 * fresh patient per test — and read back from PostgreSQL. Nothing intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const PRICE = 900_000;

interface Provisioned {
  patientId: string;
  adviseId: string;
}

/** A patient with no photographs and one priced consulting line off a chẩn đoán with one doctor. */
async function provision(page: Page): Promise<Provisioned> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  return page.evaluate(
    async ({ branch, price, suffix }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };

      const patient = await post("/api/v1/app/patients", {
        firstName: `Rà soát ${suffix}`,
        lastName: "E2E",
        dateOfBirth: null,
        gender: "male",
        phoneNumber: `08${suffix.padStart(8, "0").slice(-8)}`,
      });
      const diagnosis = (
        await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)
      ).items[0];
      const service = (
        await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)
      ).items[0];
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = { toothCode: 26, selected: true, top: false, right: false, bottom: false, left: false, center: false };

      const slip = await post("/api/v1/app/patient-diagnoses", {
        patientId: patient.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.id,
        note: `e2e rà soát ${suffix}`,
        teeth: [tooth],
      });
      const advise = await post("/api/v1/app/patient-advises", {
        patientId: patient.id,
        clinicBranchId: branch,
        patientDiagnosisId: slip.id,
        diagnosisId: diagnosis.id,
        serviceId: service.id,
        staffId: staff.id,
        originalPrice: price,
        price,
        quantity: 1,
        discountType: 0,
        discountValue: 0,
        teeth: [tooth],
      });
      return { patientId: patient.id as string, adviseId: advise.id as string };
    },
    { branch: BRANCH, price: PRICE, suffix: runId() },
  );
}

async function api<T>(page: Page, method: string, url: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${method} ${url} ${res.status} ${await res.text()}`);
      return res.json();
    },
    { method, url, body, branch: BRANCH },
  ) as Promise<T>;
}

interface QuoteLine {
  adviseId: string;
  discountValue: number;
  discountAmount: number;
  effectiveAmount: number;
}
interface Quote {
  id: string;
  ordinal: number;
  lines: QuoteLine[];
}

async function openConsulting(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);
  await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
}

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

test.describe("Chẩn đoán & Tư vấn — rà soát P2909", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the diagnosis card names Bác sĩ chẩn đoán 2, prints a dash for none, and prints with a printer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    const { patientId } = await provision(page);
    await openConsulting(page, patientId);

    const card = page.locator(".pd-diagnosis-card");
    const headers = card.locator("thead th");
    await expect(headers.filter({ hasText: /^Bác sĩ chẩn đoán 2$/i })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Chẩn đoán 2$/i })).toHaveCount(0);

    const index = await headers.evaluateAll((cells) =>
      cells.findIndex((cell) => cell.textContent?.trim().toLowerCase() === "bác sĩ chẩn đoán 2"),
    );
    const row = card.locator("tbody tr.ant-table-row").first();
    await expect(row.locator("td").nth(index)).toHaveText("-");
    await expect(row).not.toContainText("Chưa cập nhật");

    const print = row.getByRole("button", { name: "In chẩn đoán" });
    await expect(print.locator("svg.lucide-printer")).toHaveCount(1);

    // The form: the second doctor's box carries the same words.
    await card.locator(".pd-card-head").getByRole("button").first().click();
    await page.getByRole("button", { name: "Thêm bác sĩ chẩn đoán" }).click();
    await expect(card.locator(".floating-field-label", { hasText: "Bác sĩ chẩn đoán 2" })).toBeVisible();

    // Scrolled, the sticky bar covers the doctors' labels instead of the other
    // way round: what is painted where a label sits is the bar.
    const label = card.locator(".floating-field-label", { hasText: "Bác sĩ chẩn đoán 1" });
    const head = card.locator(".pd-card-head");
    const headBox = (await head.boundingBox())!;
    const labelBox = (await label.boundingBox())!;
    await card.evaluate((el, by) => el.scrollBy(0, by), labelBox.y - headBox.y - headBox.height / 2);
    const onTop = await label.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return Boolean(hit?.closest(".pd-card-head"));
    });
    expect(onTop).toBe(true);
  });

  test("the empty image zone opens the file chooser and the picture lands", async ({ page }) => {
    const { patientId } = await provision(page);
    await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);

    const zone = page.getByRole("button", { name: "Kéo ảnh vào hoặc bấm nút để tải lên" });
    await expect(zone).toBeVisible({ timeout: 20_000 });
    const chooser = page.waitForEvent("filechooser");
    await zone.click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const uploaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/patient-images") && res.request().method() === "POST",
    );
    await (await chooser).setFiles({ name: "e2e-zone.png", mimeType: "image/png", buffer: png });
    expect((await uploaded).status()).toBe(200);
    await expect(page.locator(".pd-image-tile")).toHaveCount(1);

    await page.reload();
    await expect(page.locator(".pd-image-tile")).toHaveCount(1, { timeout: 20_000 });
  });

  test("Chọn ảnh hiển thị asks before deleting, and its Xoá spins until the server answers", async ({
    page,
  }) => {
    const { patientId } = await provision(page);
    await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);

    // One photograph of this patient's own, through the empty zone.
    const zone = page.getByRole("button", { name: "Kéo ảnh vào hoặc bấm nút để tải lên" });
    await expect(zone).toBeVisible({ timeout: 20_000 });
    const chooser = page.waitForEvent("filechooser");
    await zone.click();
    const uploaded = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/patient-images") && res.request().method() === "POST",
    );
    await (await chooser).setFiles({
      name: "e2e-xoa.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    const image = (await (await uploaded).json()) as { id: string };

    await page.getByRole("button", { name: "Danh sách ảnh" }).click();
    const picker = page.getByRole("dialog", { name: "Chọn ảnh hiển thị" });
    await expect(picker.getByRole("button", { name: "Xoá ảnh" })).toHaveCount(1);

    // The bin asks first; Huỷ leaves the photograph where it was.
    const deletes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "DELETE" && request.url().includes("/api/v1/app/patient-images/")) deletes.push(request.url());
    });
    await picker.getByRole("button", { name: "Xoá ảnh" }).click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận xoá ảnh" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Bạn có chắc muốn xoá ảnh này không?");
    await expect(confirm).toContainText("Hành động này không thể hoàn tác.");
    await confirm.getByRole("button", { name: "Huỷ" }).click();
    await expect(confirm).toBeHidden();
    expect(deletes).toHaveLength(0);
    await expect(picker.getByRole("button", { name: "Xoá ảnh" })).toHaveCount(1);

    // Xoá: the button reads "Đang xoá…" while the request is out — recorded by
    // an observer rather than raced with a poll — and the dialog closes after.
    await picker.getByRole("button", { name: "Xoá ảnh" }).click();
    await expect(confirm).toBeVisible();
    await page.evaluate(() => {
      const seen = { spinning: false };
      (window as unknown as { __deleteSpin: typeof seen }).__deleteSpin = seen;
      new MutationObserver(() => {
        const dialogs = [...document.querySelectorAll(".ant-modal")];
        if (dialogs.some((el) => el.textContent?.includes("Đang xoá…") && el.querySelector(".ant-btn-loading")))
          seen.spinning = true;
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    const removed = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/app/patient-images/${image.id}`) && res.request().method() === "DELETE",
    );
    await confirm.getByRole("button", { name: "Xoá" }).click();
    expect((await removed).ok()).toBe(true);
    await expect(confirm).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __deleteSpin: { spinning: boolean } }).__deleteSpin.spinning)).toBe(true);
    await expect(picker.getByRole("button", { name: "Xoá ảnh" })).toHaveCount(0);
    expect(deletes).toHaveLength(1);

    // Gone on the server too.
    await page.reload();
    await expect(page.getByRole("button", { name: "Kéo ảnh vào hoặc bấm nút để tải lên" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".pd-image-tile")).toHaveCount(0);
  });

  test("Chọn Dịch Vụ sells at the catalogue's Giá sau giảm, and Giảm giá counts only what is typed there", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const { patientId } = await provision(page);

    // A service of 300.000 đ with 10% off in Danh mục: "Giá sau giảm" 270.000 đ.
    const name = `e2e giá sau giảm ${runId()}`;
    const entry = await page.evaluate(
      async ({ branch, name }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const groups = await (
          await fetch(`/api/v1/app/taxonomies?ClinicBranchId=${branch}&Group=care_service&MaxResultCount=1`, {
            credentials: "include",
            headers,
          })
        ).json();
        const res = await fetch("/api/v1/app/catalog-entries", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            clinicBranchId: branch,
            taxonomyId: groups.items[0].id,
            name,
            price: 300_000,
            serviceConfig: {
              taxRate: 0,
              priceIncludesTax: false,
              discountIsPercent: true,
              discountValue: 10,
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
          }),
        });
        if (!res.ok) throw new Error(`catalog ${res.status} ${await res.text()}`);
        return (await res.json()) as { id: string; serviceConfig: { priceAfterDiscount: number } };
      },
      { branch: BRANCH, name },
    );
    expect(entry.serviceConfig.priceAfterDiscount).toBe(270_000);

    await openConsulting(page, patientId);
    await page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first().getByRole("button", { name: "Tạo Dịch Vụ" }).click();
    const dialog = page.getByRole("dialog", { name: /Chọn Dịch Vụ/ });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("Tìm dịch vụ").fill(name);
    const row = dialog.locator(".am-table tbody tr", { hasText: name });
    await expect(row).toHaveCount(1, { timeout: 15_000 });

    // Unticked, the row already reads the price it will be sold at.
    await expect(row).toContainText(money(270_000));
    await expect(row).not.toContainText(money(300_000));

    // Ticked, 10% here comes off 270.000 × 2.
    await row.getByRole("checkbox").check();
    await expect(row.getByRole("textbox", { name: "Đơn giá" })).toHaveValue("270.000");
    await row.getByRole("spinbutton", { name: "Số lượng" }).fill("2");
    await row.locator(".am-discount input").fill("10");
    await expect(row.locator(".am-cell-amount")).toHaveText(money(486_000));

    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-advises"),
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const saved = (await (await created).json()) as {
      id: string;
      price: number;
      originalPrice: number;
      discountAmount: number;
      effectiveAmount: number;
    };
    expect(saved.price).toBe(270_000);
    expect(saved.originalPrice).toBe(270_000);
    expect(saved.discountAmount).toBe(54_000);
    expect(saved.effectiveAmount).toBe(486_000);
    await expect(dialog).toBeHidden();

    // Phiếu tư vấn, after a reload: Đơn giá 270.000, Giảm giá only the 10% typed.
    await page.reload();
    const line = page.locator(`.pd-advise-table tbody tr[data-row-key="${saved.id}"]`);
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toContainText(money(270_000));
    await expect(line).toContainText(money(54_000));
    await expect(line).not.toContainText(money(30_000));
  });

  test("a voucher picked on one báo giá stays on that tab", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const { patientId, adviseId } = await provision(page);
    const first = await api<Quote>(page, "POST", "/api/v1/app/patient-quotes", {
      patientId,
      clinicBranchId: BRANCH,
      adviseIds: [adviseId],
    });
    const second = await api<Quote>(page, "POST", `/api/v1/app/patient-quotes/${first.id}/duplicate`);

    // A plan voucher of this run's own, so the pick is not someone else's.
    const stamp = runId();
    const code = `E2EBG${stamp}`;
    const voucher = await api<{ id: string }>(page, "POST", "/api/v1/app/vouchers", {
      code,
      name: `Voucher báo giá ${stamp}`,
      discountType: "percentage",
      discountValue: 10,
      scopeTarget: "treatment",
      targetIds: [],
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      usageLimit: 100,
      isExclusive: false,
      customerTargets: ["new", "returning"],
      isDaysOfWeekLimited: false,
      daysOfWeek: [],
      displayOnNfcDental: true,
    });
    await api(page, "POST", `/api/v1/app/vouchers/${voucher.id}/publish`);

    await openConsulting(page, patientId);
    const card = page.locator(".pd-advise-card");
    const applied = card.locator(".pd-plan-applied");
    const net = card.locator(".pd-plan-row", { hasText: "Thành tiền" }).locator(":scope > b");

    // Picked on BG first…
    await page.getByRole("tab", { name: `BG ${first.ordinal}` }).click();
    await card.getByRole("button", { name: "Chọn voucher" }).click();
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill(code);
    await page.getByRole("button", { name: new RegExp(code) }).click();
    await page.keyboard.press("Escape");
    await expect(applied).toHaveCount(1);
    await expect(applied.locator(".pd-plan-applied__code")).toHaveText(`[${code}]`);
    await expect(net).toHaveText(money(PRICE - PRICE / 10));

    // …it is not on the other quote, nor on Phiếu tư vấn.
    await page.getByRole("tab", { name: `BG ${second.ordinal}` }).click();
    await expect(applied).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Chọn voucher" })).toBeVisible();
    await expect(net).toHaveText(money(PRICE));

    await page.getByRole("tab", { name: "Phiếu tư vấn" }).click();
    await card.locator(".pd-advise-table tbody tr.ant-table-row").first().getByRole("checkbox").check();
    await expect(applied).toHaveCount(0);
    await expect(net).toHaveText(money(PRICE));

    // And the first quote kept its own.
    await page.getByRole("tab", { name: `BG ${first.ordinal}` }).click();
    await expect(applied).toHaveCount(1);
    await expect(card.getByRole("button", { name: "Voucher (1)" })).toBeVisible();
    await expect(net).toHaveText(money(PRICE - PRICE / 10));
  });

  test("a discount changed on one báo giá moves that quote only", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const { patientId, adviseId } = await provision(page);
    const first = await api<Quote>(page, "POST", "/api/v1/app/patient-quotes", {
      patientId,
      clinicBranchId: BRANCH,
      adviseIds: [adviseId],
    });
    const second = await api<Quote>(page, "POST", `/api/v1/app/patient-quotes/${first.id}/duplicate`);
    // Each quote starts from the consulting line's own price.
    expect(first.lines[0].effectiveAmount).toBe(PRICE);

    await openConsulting(page, patientId);
    await page.getByRole("tab", { name: `BG ${first.ordinal}` }).click();
    const row = page.locator(".pd-advise-table tbody tr.ant-table-row").first();
    await row.locator(".pd-cell-strong").click();

    const dialog = page.getByRole("dialog", { name: "Cập nhật phiếu dịch vụ" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("group", { name: /đơn vị/i }).getByRole("button").last().click();
    const discount = dialog.locator("#discountValue");
    await discount.fill("150000");
    const repriced = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/app/patient-quotes/${first.id}/lines/${adviseId}`) &&
        res.request().method() === "PUT",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await repriced).status()).toBe(200);
    await expect(dialog).toBeHidden();

    // This quote's figures moved; the other quote's and Phiếu tư vấn's did not.
    const quotes = await api<{ items: Quote[] }>(
      page, "GET", `/api/v1/app/patient-quotes?patientId=${patientId}&clinicBranchId=${BRANCH}`,
    );
    const lineOf = (id: string) => quotes.items.find((quote) => quote.id === id)!.lines[0];
    expect(lineOf(first.id).discountAmount).toBe(150_000);
    expect(lineOf(first.id).effectiveAmount).toBe(PRICE - 150_000);
    expect(lineOf(second.id).discountAmount).toBe(0);
    const advise = await api<{ discountAmount: number; effectiveAmount: number }>(
      page, "GET", `/api/v1/app/patient-advises/${adviseId}`,
    );
    expect(advise.discountAmount).toBe(0);
    expect(advise.effectiveAmount).toBe(PRICE);

    // On screen, after a reload: each tab prices the line its own way.
    await page.reload();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    const figure = (label: string) => page.locator(".pd-plan-row", { hasText: label }).locator(":scope > b");

    await page.getByRole("tab", { name: `BG ${first.ordinal}` }).click();
    await expect(figure("Tổng cộng")).toHaveText(money(PRICE));
    await expect(figure("Giảm giá")).toHaveText(`-${money(150_000)}`);
    await expect(figure("Thành tiền")).toHaveText(money(PRICE - 150_000));

    await page.getByRole("tab", { name: `BG ${second.ordinal}` }).click();
    await expect(figure("Giảm giá")).toHaveText(money(0));
    await expect(figure("Thành tiền")).toHaveText(money(PRICE));

    await page.getByRole("tab", { name: "Phiếu tư vấn" }).click();
    await page.locator(".pd-advise-table tbody tr.ant-table-row").first().getByRole("checkbox").check();
    await expect(figure("Thành tiền")).toHaveText(money(PRICE));
    await page.locator(".pd-plan-summary").screenshot({ path: "test-results/consulting-plan-totals.png" });

    // Chi tiết phiếu closes on the same four lines, under the same title.
    await page.getByRole("tab", { name: `BG ${first.ordinal}` }).click();
    await page.getByRole("button", { name: "In Báo giá", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    const totals = detail.locator(".pq-totals");
    await expect(totals.locator(".pq-totals-title")).toHaveText("TỔNG KẾ HOẠCH");
    await expect(totals.locator(".pq-totals-row > span")).toHaveText(["Tổng cộng", "Giảm giá", "Voucher", "Thành tiền"]);
    await expect(totals.locator(".pq-totals-row--net > strong")).toHaveText(money(PRICE - 150_000));
    await totals.screenshot({ path: "test-results/quote-detail-totals.png" });
  });
});
