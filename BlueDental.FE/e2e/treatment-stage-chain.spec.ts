import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: "Chi tiết phiếu" — per-tooth công đoạn, the continue chain and the
 * warranty chain, plus the plan table's "Chỉnh sửa". Measured on staging
 * 2026-09-24; see docs/clone/pages/patient-detail.md ("Survey 2026-09-24") and
 * docs/clone/pages/treatment-plan-detail.md.
 *
 * Real stack throughout: the fixtures are written through the real API with the
 * session the real login screen gave, and every assertion is on the browser
 * after the server answered — nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Line {
  patientId: string;
  planId: string;
  branchId: string;
  lineId: string;
  serviceId: string;
  serviceName: string;
}

interface Tooth {
  code: number;
  surface?: "top" | "right" | "bottom" | "left" | "center";
}

/**
 * Writes fresh lines onto one open slip of branch 1, so each test owns the
 * teeth it asserts on. `warranty` picks a service whose catalog entry carries a
 * warranty period.
 */
async function freshLines(
  page: Page,
  specs: { teeth: Tooth[]; warranty?: boolean }[],
): Promise<Line[]> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const made = await page.evaluate(
    async ({ wanted, branch }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const slips = (
        await (await fetch("/api/v1/app/patient-treatments?maxResultCount=300", { credentials: "include" })).json()
      ).items as {
        id: string;
        patientId: string;
        branchId: string;
        status: number;
        services: { id: string; serviceId: string; serviceName: string | null; warrantyDays: number }[];
      }[];

      const lines = slips.flatMap((slip) => slip.services);
      const warrantyService = lines.find((line) => line.warrantyDays > 0)?.serviceId;
      const plainService = lines.find((line) => line.warrantyDays <= 0)?.serviceId ?? warrantyService;
      // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
      const slip = slips.find((item) => item.branchId === branch && item.status !== 5 && item.status !== 6);
      if (!slip || !warrantyService || !plainService) return null;

      const out = [];
      let known = new Set(slip.services.map((line) => line.id));
      for (const spec of wanted) {
        const serviceId = spec.warranty ? warrantyService : plainService;
        const res = await fetch(`/api/v1/app/patient-treatments/${slip.id}/services`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            serviceId,
            price: 100000,
            quantity: spec.teeth.length,
            discountType: 0,
            discountValue: 0,
            status: 1,
            teeth: spec.teeth.map((tooth) => ({
              toothCode: tooth.code,
              selected: !tooth.surface,
              top: tooth.surface === "top",
              right: tooth.surface === "right",
              bottom: tooth.surface === "bottom",
              left: tooth.surface === "left",
              center: tooth.surface === "center",
            })),
          }),
        });
        if (!res.ok) return { error: `${res.status} ${await res.text()}` };
        const updated = (await res.json()) as typeof slip;
        const line = updated.services.find((item) => !known.has(item.id))!;
        known = new Set(updated.services.map((item) => item.id));
        out.push({
          patientId: slip.patientId,
          planId: slip.id,
          branchId: slip.branchId,
          lineId: line.id,
          serviceId: line.serviceId,
          serviceName: line.serviceName ?? "",
        });
      }
      return { lines: out };
    },
    { wanted: specs, branch: BRANCH },
  );

  expect(made, "the demo clinic should have an open slip in branch 1").toBeTruthy();
  expect("error" in made! ? made.error : null, "the fixture lines should be written").toBeNull();
  return (made as { lines: Line[] }).lines;
}

/** One API call from inside the page, with the session and the branch header. */
async function call(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; text: string }> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      // A 403 from the branch guard answers with no JSON body.
      const parse = () => {
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return null;
        }
      };
      return { status: res.status, json: parse(), text };
    },
    { method, url, body, branch: BRANCH },
  );
}

async function staffId(page: Page): Promise<string> {
  const res = await call(page, "GET", "/api/v1/app/staff?MaxResultCount=1");
  return ((res.json as { items: { id: string }[] }).items[0]).id;
}

/** A công đoạn written straight to the API, optionally closed, returning its id. */
async function stageOn(page: Page, line: Line, teeth: number[], done: boolean): Promise<string> {
  const res = await call(page, "POST", "/api/v1/app/treatment-stages", {
    patientId: line.patientId,
    clinicBranchId: line.branchId,
    treatmentId: line.planId,
    treatmentServiceId: line.lineId,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note: `e2e gốc ${runId()}`,
    staffId: await staffId(page),
    teeth: teeth.map((code) => ({ toothCode: code, selected: true, top: false, right: false, bottom: false, left: false, center: false })),
  });
  expect(res.status, res.text).toBe(200);
  const id = (res.json as { id: string }).id;
  if (done) {
    const closed = await call(page, "POST", `/api/v1/app/treatment-stages/${id}/complete`);
    expect(closed.status, closed.text).toBe(200);
  }
  return id;
}

/** The plan detail page of the slip, and "Chi tiết phiếu" opened from its toolbar. */
async function openSlipDialog(page: Page, line: Line): Promise<Locator> {
  await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}`);
  await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Thêm công đoạn" }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const chips = (form: Locator) => form.locator(".pd-stage-teeth > div > button:not(.pd-stage-chartbtn)");

async function chipStates(form: Locator): Promise<string[]> {
  return chips(form).evaluateAll((buttons) =>
    buttons.map(
      (button) =>
        `${button.textContent}${button.classList.contains("active") ? "*" : ""}${(button as HTMLButtonElement).disabled ? "!" : ""}`,
    ),
  );
}

test.describe("Chi tiết phiếu — công đoạn theo răng, tiếp tục và bảo hành", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
  });

  test("several cards open at once, each takes the teeth it is given, and one press saves them all", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [first, second] = await freshLines(page, [
      { teeth: [{ code: 11 }, { code: 21 }, { code: 22 }] },
      { teeth: [{ code: 14 }] },
    ]);

    const dialog = await openSlipDialog(page, first);
    await expect(dialog.getByRole("tab", { name: /THÊM CÔNG ĐOẠN/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("tab", { name: /TIẾP TỤC BẢO HÀNH/ })).toBeVisible();

    await dialog.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`).click();
    await dialog.locator(`.pd-stage-picks button[data-line-id="${second.lineId}"]`).click();

    const formA = dialog.locator(`.pd-stage-form[data-item-id="${first.lineId}"]`);
    const formB = dialog.locator(`.pd-stage-form[data-item-id="${second.lineId}"]`);
    await expect(formA).toBeVisible();
    await expect(formB).toBeVisible();
    // One save for all of them, under the last form only. The forms stack in
    // card order, not in the order they were opened — as the reference's do.
    await expect(dialog.getByRole("button", { name: "Lưu công đoạn" })).toHaveCount(1);
    await expect(dialog.locator(".pd-stage-form").last().getByRole("button", { name: "Lưu công đoạn" })).toBeVisible();

    // Every free tooth starts picked; the doctor drops 22 from this công đoạn.
    expect(await chipStates(formA)).toEqual(["11*", "21*", "22*"]);
    await chips(formA).filter({ hasText: "22" }).click();
    expect(await chipStates(formA)).toEqual(["11*", "21*", "22"]);

    await formA.locator("textarea").fill(`e2e nhiều ${runId()} A`);
    await formB.locator("textarea").fill(`e2e nhiều ${runId()} B`);

    const posted: Record<string, unknown>[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/v1/app/treatment-stages")) {
        posted.push(request.postDataJSON() as Record<string, unknown>);
      }
    });
    await dialog.getByRole("button", { name: "Lưu công đoạn" }).click();
    await expect(page.getByText("Đã thêm công đoạn")).toBeVisible();
    await expect(formA).toHaveCount(0);
    await expect(formB).toHaveCount(0);

    // One request per form, each with its own teeth.
    expect(posted).toHaveLength(2);
    const teethOf = (body: Record<string, unknown>) =>
      (body.teeth as { toothCode: number }[]).map((tooth) => tooth.toothCode);
    expect(teethOf(posted.find((body) => body.treatmentServiceId === first.lineId)!)).toEqual([11, 21]);
    expect(teethOf(posted.find((body) => body.treatmentServiceId === second.lineId)!)).toEqual([14]);

    // 22 is still to start, so its line stays under THÊM CÔNG ĐOẠN with 22 alone.
    const cardA = dialog.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`);
    await expect(cardA).toContainText("22");
    await expect(cardA).not.toContainText("11");
    await expect(dialog.locator(`.pd-stage-picks button[data-line-id="${second.lineId}"]`)).toHaveCount(0);

    // Both are now being worked.
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await expect(dialog.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`)).toContainText("11");
    await expect(dialog.locator(`.pd-stage-picks button[data-line-id="${second.lineId}"]`)).toBeVisible();

    // And it all reached the database.
    await page.reload();
    const again = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    await expect(again.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"] i`)).toHaveText(["22"]);

    // The server refuses a tooth another công đoạn already holds.
    const doubled = await call(page, "POST", "/api/v1/app/treatment-stages", {
      patientId: first.patientId,
      clinicBranchId: first.branchId,
      treatmentId: first.planId,
      treatmentServiceId: first.lineId,
      serviceId: first.serviceId,
      name: "e2e",
      note: "e2e",
      staffId: await staffId(page),
      teeth: [{ toothCode: 11, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    });
    expect(doubled.status).not.toBe(200);
    expect(doubled.text).toContain("BlueDental:Treatment:0031");
  });

  test("continuing writes the next visit, keeps its teeth and greys the one before", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [line] = await freshLines(page, [{ teeth: [{ code: 31 }, { code: 32 }] }]);
    const firstStage = await stageOn(page, line, [31, 32], false);

    const dialog = await openSlipDialog(page, line);
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-stage-id="${firstStage}"]`).click();

    const form = dialog.locator(`.pd-stage-form[data-item-id="${firstStage}"]`);
    // The chain keeps its teeth: shown, not clickable.
    expect(await chipStates(form)).toEqual(["31*!", "32*!"]);
    await expect(dialog.getByRole("button", { name: "Tiếp tục công đoạn" })).toBeVisible();

    // The chart opens read-only on a continued công đoạn.
    await form.getByRole("button", { name: "Xem sơ đồ răng" }).click();
    const chart = page.locator(".pd-stage-chartdialog");
    await expect(chart).toContainText("giữ nguyên răng");
    await expect(chart.getByRole("button", { name: "Răng 31", exact: true })).toBeDisabled();
    await chart.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();

    await form.locator("textarea").fill(`e2e lần 2 ${runId()}`);
    const continued = page.waitForResponse(
      (res) => res.url().includes(`/treatment-stages/${firstStage}/continue`) && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const next = await (await continued).json();
    expect(next.id).not.toBe(firstStage);
    expect(next.continuedFromId).toBe(firstStage);
    expect(next.teeth.map((tooth: { toothCode: number }) => tooth.toothCode)).toEqual([31, 32]);

    await expect(dialog.locator(`.pd-stage-histrow[data-stage-id="${firstStage}"]`)).toHaveAttribute("aria-disabled", "true");
    await expect(dialog.locator(`.pd-stage-histrow[data-stage-id="${next.id}"]`)).toHaveAttribute("aria-disabled", "false");

    // A superseded công đoạn is history on the server too.
    const reclosed = await call(page, "POST", `/api/v1/app/treatment-stages/${firstStage}/complete`);
    expect(reclosed.status).not.toBe(200);
    expect(reclosed.text).toContain("BlueDental:Treatment:0018");

    await page.reload();
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    await expect(
      page.getByRole("dialog", { name: "Chi tiết phiếu" }).locator(`.pd-stage-histrow[data-stage-id="${firstStage}"]`),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("a warranty picks among the root's teeth, locks the line's Bảo hành until it is finished, and can follow itself", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [line] = await freshLines(page, [
      { teeth: [{ code: 11 }, { code: 21 }, { code: 22 }], warranty: true },
    ]);
    const root = await stageOn(page, line, [11, 21, 22], true);

    const dialog = await openSlipDialog(page, line);
    const rootRow = dialog.locator(`.pd-stage-histrow[data-stage-id="${root}"]`);
    await rootRow.getByRole("button", { name: "Bảo hành" }).click();

    const warranty = page.getByRole("dialog", { name: "Tạo bảo hành" });
    await expect(warranty).toBeVisible();
    expect(await chipStates(warranty)).toEqual(["11*", "21*", "22*"]);
    await chips(warranty).filter({ hasText: "22" }).click();
    await warranty.locator("textarea").fill(`e2e bảo hành ${runId()}`);
    const created = page.waitForResponse(
      (res) => res.url().endsWith("/api/v1/app/treatment-stages") && res.request().method() === "POST",
    );
    await warranty.locator(".ant-modal-footer").getByRole("button", { name: "Lưu" }).click();
    const firstWarranty = await (await created).json();
    expect(firstWarranty.isGuarantee).toBe(true);
    expect(firstWarranty.warrantyRootStageId).toBe(root);
    expect(firstWarranty.teeth.map((tooth: { toothCode: number }) => tooth.toothCode)).toEqual([11, 21]);
    await expect(warranty).toBeHidden();

    // It waits under TIẾP TỤC BẢO HÀNH, and the line's Bảo hành is shut meanwhile.
    await expect(rootRow.getByRole("button", { name: "Bảo hành" })).toBeDisabled();
    const second = await call(page, "POST", "/api/v1/app/treatment-stages", {
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      treatmentId: line.planId,
      treatmentServiceId: line.lineId,
      serviceId: line.serviceId,
      name: "e2e",
      note: "e2e",
      staffId: await staffId(page),
      isGuarantee: true,
      warrantySourceStageId: root,
      teeth: [{ toothCode: 11, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    });
    expect(second.status).not.toBe(200);
    expect(second.text).toContain("BlueDental:Treatment:0033");

    await dialog.getByRole("tab", { name: /TIẾP TỤC BẢO HÀNH/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-stage-id="${firstWarranty.id}"]`).click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="${firstWarranty.id}"]`);
    expect(await chipStates(form)).toEqual(["11*!", "21*!"]);
    await form.locator("textarea").fill(`e2e tiếp tục bảo hành ${runId()}`);
    const continued = page.waitForResponse(
      (res) => res.url().includes(`/treatment-stages/${firstWarranty.id}/continue`) && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Tiếp tục bảo hành" }).click();
    const nextWarranty = await (await continued).json();
    expect(nextWarranty.isGuarantee).toBe(true);
    await expect(dialog.locator(`.pd-stage-histrow[data-stage-id="${firstWarranty.id}"]`)).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // Finishing the warranty takes it off the tab and opens Bảo hành again.
    const nextRow = dialog.locator(`.pd-stage-histrow[data-stage-id="${nextWarranty.id}"]`);
    const completed = page.waitForResponse(
      (res) => res.url().includes(`/treatment-stages/${nextWarranty.id}/complete`) && res.request().method() === "POST",
    );
    await nextRow.locator(".pd-stage-rowactions").getByRole("checkbox").click({ force: true });
    expect((await completed).ok()).toBe(true);
    await expect(dialog.locator(`.pd-stage-picks button[data-stage-id="${nextWarranty.id}"]`)).toHaveCount(0);
    await expect(rootRow.getByRole("button", { name: "Bảo hành" })).toBeEnabled();

    // A warranty off the finished warranty offers the root's teeth again.
    await nextRow.getByRole("button", { name: "Bảo hành" }).click();
    await expect(warranty).toBeVisible();
    expect(await chipStates(warranty)).toEqual(["11*", "21*", "22"]);
    await warranty.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();
    await expect(warranty).toBeHidden();

    // The profile tab's table: a warranty row reads Bảo hành, prints numbers
    // only, counts its own teeth and offers no payment.
    await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=profile`);
    const row = page.locator(`.pd-treatment-table tbody tr[data-row-key="${line.lineId}:${nextWarranty.id}"]`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.locator(".pd-tr-chip")).toHaveText("Bảo hành");
    await expect(row.locator(".pd-tr-teeth")).toHaveText("11, 21");
    await expect(row.locator(".pd-tr-pay")).toHaveCount(0);
  });

  test("Chỉnh sửa rewrites a saved line, and a line in treatment keeps its price, diagnosis and staged teeth", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1800, height: 950 });
    const [line] = await freshLines(page, [{ teeth: [{ code: 11, surface: "top" }, { code: 12 }] }]);

    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}`);
    const row = page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    // Tooth numbers only, surfaces and all left off.
    await expect(row.locator("td").nth(4)).toHaveText("11, 12");

    await row.getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(row.getByRole("button", { name: "Lưu" })).toBeVisible();
    const note = `e2e sửa ${runId()}`;
    await row.getByRole("textbox", { name: "Ghi chú" }).fill(note);
    const saved = page.waitForResponse(
      (res) => res.url().includes(`/services/${line.lineId}`) && res.request().method() === "PUT",
    );
    await row.getByRole("button", { name: "Lưu" }).click();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toContainText(note);

    // Put 11 to work: the line is now in treatment.
    await stageOn(page, line, [11], false);
    await page.reload();
    const treated = page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`);
    await treated.getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(treated).toContainText("Không thể đổi chẩn đoán khi đang điều trị");
    await expect(treated).toContainText("Không thể đổi giá khi đang điều trị");

    await treated.getByRole("button", { name: "Chọn răng" }).click();
    const picker = page.locator(".tp-teeth-dialog");
    await expect(picker).toContainText("Răng 11 đang điều trị — không thể bỏ chọn.");
    await picker.getByRole("button", { name: "Răng 11", exact: true }).click();
    await expect(picker.getByRole("button", { name: "Răng 11", exact: true })).toHaveAttribute("aria-pressed", "true");
    await picker.locator(".tp-teeth-foot button").click();
    await treated.getByRole("button", { name: "Hủy" }).click();

    // The server holds the same line.
    const dropped = await call(page, "PUT", `/api/v1/app/patient-treatments/${line.planId}/services/${line.lineId}`, {
      price: 100000,
      quantity: 1,
      teeth: [{ toothCode: 12, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
      diagnosisId: null,
    });
    expect(dropped.status).not.toBe(200);
    expect(dropped.text).toContain("BlueDental:Treatment:0039");
    const repriced = await call(page, "PUT", `/api/v1/app/patient-treatments/${line.planId}/services/${line.lineId}`, {
      price: 1,
      quantity: 2,
      teeth: [
        { toothCode: 11, selected: false, top: true, right: false, bottom: false, left: false, center: false },
        { toothCode: 12, selected: true, top: false, right: false, bottom: false, left: false, center: false },
      ],
      diagnosisId: null,
    });
    expect(repriced.status).not.toBe(200);
    expect(repriced.text).toContain("BlueDental:Treatment:0038");
  });

  test("another branch may not continue a công đoạn it cannot see", async ({ page, browser }) => {
    const [line] = await freshLines(page, [{ teeth: [{ code: 41 }] }]);
    const stage = await stageOn(page, line, [41], false);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, BRANCH2_USER);
    const refused = await otherPage.evaluate(async (id) => {
      const res = await fetch(`/api/v1/app/treatment-stages/${id}/continue`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: "00000000-0000-0000-0000-000000000000", note: "e2e", serviceItemIds: [] }),
      });
      return res.status;
    }, stage);
    expect(refused).toBe(403);
    await other.close();
  });
});
