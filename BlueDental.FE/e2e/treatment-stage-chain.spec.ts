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
        services: {
          id: string;
          serviceId: string;
          serviceName: string | null;
          warrantyDays: number;
          originalPrice: number;
        }[];
      }[];

      // Only this branch's services: another branch's catalog entry is refused (Catalogs:0013).
      const lines = slips.filter((slip) => slip.branchId === branch).flatMap((slip) => slip.services);
      const warrantyLine = lines.find((line) => line.warrantyDays > 0);
      const plainLine = lines.find((line) => line.warrantyDays <= 0) ?? warrantyLine;
      const warrantyService = warrantyLine?.serviceId;
      const plainService = plainLine?.serviceId;
      // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
      const slip = slips.find((item) => item.branchId === branch && item.status !== 5 && item.status !== 6);
      if (!slip || !warrantyService || !plainService) return null;

      const out = [];
      let known = new Set(slip.services.map((line) => line.id));
      for (const spec of wanted) {
        const source = spec.warranty ? warrantyLine! : plainLine!;
        const res = await fetch(`/api/v1/app/patient-treatments/${slip.id}/services`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            serviceId: source.serviceId,
            // Never above the catalog's own price (Treatment:0040).
            price: Math.min(100000, source.originalPrice),
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
  const res = await call(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
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

/** Picks the first doctor the Bác sĩ picker offers, when the form starts without one. */
async function pickDoctor(page: Page, form: Locator): Promise<void> {
  const doctor = form.locator(".ant-select").first();
  if ((await doctor.locator(".ant-select-content-has-value").count()) > 0) return;
  await doctor.click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
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

  test("one card opens at a time, keeps its draft, and a staged tooth stays on show, faded", async ({
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

    const cardA = dialog.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`);
    const cardB = dialog.locator(`.pd-stage-picks button[data-line-id="${second.lineId}"]`);
    const formA = dialog.locator(`.pd-stage-form[data-item-id="${first.lineId}"]`);
    const formB = dialog.locator(`.pd-stage-form[data-item-id="${second.lineId}"]`);

    // Opening B closes A: one service's form on screen, never a stack.
    await cardA.click();
    await expect(formA).toBeVisible();
    await cardB.click();
    await expect(formB).toBeVisible();
    await expect(formA).toHaveCount(0);
    await expect(dialog.locator(".pd-stage-form")).toHaveCount(1);
    await expect(cardA).toHaveAttribute("aria-pressed", "false");
    const noteB = `e2e một thẻ ${runId()} B`;
    await formB.locator("textarea").fill(noteB);

    // Every free tooth starts picked; the doctor drops 22 from this công đoạn.
    await cardA.click();
    await expect(formB).toHaveCount(0);
    expect(await chipStates(formA)).toEqual(["11*", "21*", "22*"]);
    await chips(formA).filter({ hasText: "22" }).click();
    expect(await chipStates(formA)).toEqual(["11*", "21*", "22"]);
    await formA.locator("textarea").fill(`e2e một thẻ ${runId()} A`);
    // The slip's doctor is not ticked "Bác sĩ", so the form starts without one.
    await pickDoctor(page, formA);

    const posted: Record<string, unknown>[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/v1/app/treatment-stages")) {
        posted.push(request.postDataJSON() as Record<string, unknown>);
      }
    });
    const teethOf = (body: Record<string, unknown>) =>
      (body.teeth as { toothCode: number }[]).map((tooth) => tooth.toothCode);

    // The save under the one open form saves that form only.
    await expect(dialog.getByRole("button", { name: "Lưu công đoạn" })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Lưu công đoạn" }).click();
    await expect(page.getByText("Đã thêm công đoạn")).toBeVisible();
    await expect(formA).toHaveCount(0);
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0].treatmentServiceId).toBe(first.lineId);
    expect(teethOf(posted[0])).toEqual([11, 21]);

    // B kept what was typed into it while A was open.
    await cardB.click();
    await expect(formB.locator("textarea")).toHaveValue(noteB);
    await pickDoctor(page, formB);
    await dialog.getByRole("button", { name: "Lưu công đoạn" }).click();
    await expect.poll(() => posted.length).toBe(2);
    expect(posted[1].treatmentServiceId).toBe(second.lineId);
    expect(teethOf(posted[1])).toEqual([14]);

    // 22 is still to start, so A stays under THÊM CÔNG ĐOẠN — with 11 and 21
    // still listed, faded, and inert on its form.
    const faded = (card: Locator) => card.locator("i.pd-stage-tooth--done");
    await expect(cardA.locator("i")).toHaveText(["11", "21", "22"]);
    await expect(faded(cardA)).toHaveText(["11", "21"]);
    await cardA.click();
    expect(await chipStates(formA)).toEqual(["11!", "21!", "22*"]);
    await cardA.click();
    await expect(cardB).toHaveCount(0);

    // Both are now being worked.
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await expect(dialog.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`)).toContainText("11");
    await expect(dialog.locator(`.pd-stage-picks button[data-line-id="${second.lineId}"]`)).toBeVisible();

    // And it all reached the database.
    await page.reload();
    const again = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const reopened = again.locator(`.pd-stage-picks button[data-line-id="${first.lineId}"]`);
    await expect(reopened.locator("i")).toHaveText(["11", "21", "22"]);
    await expect(faded(reopened)).toHaveText(["11", "21"]);

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

  test("continuing takes the teeth picked, leaves the rest open, and greys the visit once none is left", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [line] = await freshLines(page, [{ teeth: [{ code: 31 }, { code: 32 }] }]);
    const firstStage = await stageOn(page, line, [31, 32], false);

    const dialog = await openSlipDialog(page, line);
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-stage-id="${firstStage}"]`).click();

    const form = dialog.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    // Every open tooth starts picked and each one can be dropped (owner's rule,
    // 2026-10-03: a tooth stays continuable until its công đoạn is finished).
    expect(await chipStates(form)).toEqual(["31*", "32*"]);
    await chips(form).filter({ hasText: "32" }).click();
    expect(await chipStates(form)).toEqual(["31*", "32"]);

    await form.locator("textarea").fill(`e2e lần 2 ${runId()}`);
    const continued = page.waitForResponse(
      (res) => res.url().includes(`/treatment-stages/${firstStage}/continue`) && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const next = await (await continued).json();
    expect(next.id).not.toBe(firstStage);
    expect(next.continuedFromId).toBe(firstStage);
    expect(next.teeth.map((tooth: { toothCode: number }) => tooth.toothCode)).toEqual([31]);

    // 32 is still open on the first visit, which stays live and keeps its history.
    await expect(dialog.locator(`.pd-stage-histrow[data-stage-id="${firstStage}"]`)).toHaveAttribute("aria-disabled", "false");
    await expect(
      dialog.locator(`.pd-stage-histrow[data-stage-id="${firstStage}"] .pd-stage-histtooth--worked`),
    ).toHaveText(["31", "32"]);

    // Next visit, from a fresh load: the card offers 31 (on the new visit) and
    // 32 (still on the first) — on the server's word.
    await page.reload();
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const again = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await again.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await again.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const form2 = again.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    expect(await chipStates(form2)).toEqual(["31*", "32*"]);
    // A tooth already handed on cannot be continued from the old visit again.
    const twice = await call(page, "POST", `/api/v1/app/treatment-stages/${firstStage}/continue`, {
      staffId: await staffId(page),
      note: "e2e",
      serviceItemIds: [],
      toothCodes: [31],
    });
    expect(twice.status).not.toBe(200);
    expect(twice.text).toContain("BlueDental:Treatment:0041");

    await chips(form2).filter({ hasText: "31" }).click();
    await form2.locator("textarea").fill(`e2e lần 3 ${runId()}`);
    const rest = page.waitForResponse(
      (res) => res.url().includes(`/treatment-stages/${firstStage}/continue`) && res.request().method() === "POST",
    );
    await again.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const last = await (await rest).json();
    expect(last.teeth.map((tooth: { toothCode: number }) => tooth.toothCode)).toEqual([32]);

    // Nothing left open on the first visit: now it is history.
    await expect(again.locator(`.pd-stage-histrow[data-stage-id="${firstStage}"]`)).toHaveAttribute("aria-disabled", "true");
    await expect(again.locator(`.pd-stage-histrow[data-stage-id="${next.id}"]`)).toHaveAttribute("aria-disabled", "false");

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

  test("two open chains of one line read as one card, continue tooth by tooth or together as one visit, and history marks each visit's teeth", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [line] = await freshLines(page, [{ teeth: [{ code: 11 }, { code: 21 }, { code: 22 }] }]);
    const chain11 = await stageOn(page, line, [11], false);
    const chain21 = await stageOn(page, line, [21], false);

    const dialog = await openSlipDialog(page, line);

    // History: every tooth of the service on each row, that visit's in blue.
    const worked = (stageId: string) =>
      dialog.locator(`.pd-stage-histrow[data-stage-id="${stageId}"] .pd-stage-histteeth > span`);
    await expect(worked(chain11)).toHaveText(["11", "21", "22"]);
    await expect(
      dialog.locator(`.pd-stage-histrow[data-stage-id="${chain11}"] .pd-stage-histtooth--worked`),
    ).toHaveText(["11"]);
    await expect(
      dialog.locator(`.pd-stage-histrow[data-stage-id="${chain21}"] .pd-stage-histtooth--worked`),
    ).toHaveText(["21"]);

    // One card for the line, however many chains are open on it.
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    const card = dialog.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-stage-id", new RegExp(`${chain11}.*${chain21}|${chain21}.*${chain11}`));
    await expect(card.locator("i")).toHaveText(["11", "21", "22"]);
    await expect(card.locator("i.pd-stage-tooth--done")).toHaveText(["22"]);

    // Both chains start picked; 22 was never staged, so it cannot be.
    await card.click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    expect(await chipStates(form)).toEqual(["11*", "21*", "22!"]);
    await chips(form).filter({ hasText: "21" }).click();
    expect(await chipStates(form)).toEqual(["11*", "21", "22!"]);
    await dialog.screenshot({ path: "test-results/stage-merged-card.png" });
    await form.locator("textarea").fill(`e2e gộp ${runId()}`);

    const continued: string[] = [];
    page.on("request", (request) => {
      const match = /\/treatment-stages\/([^/]+)\/continue$/.exec(request.url());
      if (request.method() === "POST" && match) continued.push(match[1]);
    });
    await dialog.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    await expect(page.getByText("Tiếp tục công đoạn thành công")).toBeVisible();
    expect(continued).toEqual([chain11]);

    // 21's chain is still open, so the card stays — on the server's word too.
    await page.reload();
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const again = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await again.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await expect(again.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`)).toHaveCount(1);
    await expect(again.locator(`.pd-stage-histrow[data-stage-id="${chain11}"]`)).toHaveAttribute("aria-disabled", "true");
    await expect(again.locator(`.pd-stage-histrow[data-stage-id="${chain21}"]`)).toHaveAttribute("aria-disabled", "false");

    // Picking 11 and 21 together — two chains — is one visit: one request, one
    // công đoạn holding both, one history row (owner, 2026-10-03).
    await again.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const both = again.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    expect(await chipStates(both)).toEqual(["11*", "21*", "22!"]);
    await both.locator("textarea").fill(`e2e cả hai ${runId()}`);
    continued.length = 0;
    const merged = page.waitForResponse(
      (res) => /\/treatment-stages\/[^/]+\/continue$/.test(res.url()) && res.request().method() === "POST",
    );
    await again.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const visit = await (await merged).json();
    expect(visit.teeth.map((tooth: { toothCode: number }) => tooth.toothCode)).toEqual([11, 21]);
    await expect(page.getByText("Tiếp tục công đoạn thành công")).toBeVisible();
    expect(continued).toHaveLength(1);
    await expect(
      again.locator(`.pd-stage-histrow[data-stage-id="${visit.id}"] .pd-stage-histtooth--worked`),
    ).toHaveText(["11", "21"]);
    await expect(again.locator(`.pd-stage-histrow[data-stage-id="${chain21}"]`)).toHaveAttribute("aria-disabled", "true");
  });

  test("a finished tooth is green from the row that finished it on, blue before, and un-ticking takes it back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const [line] = await freshLines(page, [{ teeth: [{ code: 11 }, { code: 12 }, { code: 13 }] }]);
    // 11·12 started, 11 carried on to a second visit, then 13 started later.
    const first = await stageOn(page, line, [11, 12], false);
    const carried = await call(page, "POST", `/api/v1/app/treatment-stages/${first}/continue`, {
      staffId: await staffId(page),
      note: `e2e răng xong ${runId()}`,
      serviceItemIds: [],
      toothCodes: [11],
      alsoFrom: [],
    });
    expect(carried.status, carried.text).toBe(200);
    const second = (carried.json as { id: string }).id;
    const later = await stageOn(page, line, [13], false);

    const dialog = await openSlipDialog(page, line);
    const row = (id: string) => dialog.locator(`.pd-stage-histrow[data-stage-id="${id}"]`);
    const teethIn = (id: string, state: "worked" | "done") =>
      row(id).locator(`.pd-stage-histteeth > span.pd-stage-histtooth--${state}`);
    // The history lists the whole shared slip; earlier tests finish stages on it.
    const lineDone = dialog.locator(`.pd-stage-histrow[data-line-id="${line.lineId}"] .pd-stage-histtooth--done`);

    // Nothing finished yet: only blue.
    await expect(teethIn(second, "worked")).toHaveText(["11"]);
    await expect(lineDone).toHaveCount(0);

    const toggle = (id: string, action: "complete" | "revert-status") => {
      const answered = page.waitForResponse(
        (res) => res.url().includes(`/treatment-stages/${id}/${action}`) && res.request().method() === "POST",
      );
      // No force: right after opening, the modal is still zooming in, and a
      // forced click lands on its mask and closes it.
      return row(id)
        .locator(".pd-stage-rowactions")
        .getByRole("checkbox")
        .click()
        .then(() => answered);
    };
    expect((await toggle(second, "complete")).ok()).toBe(true);

    const expectFinished = async () => {
      // The visit that finished 11 shows it green…
      await expect(teethIn(second, "done")).toHaveText(["11"]);
      await expect(teethIn(second, "worked")).toHaveCount(0);
      // …the visit before it keeps it blue…
      await expect(teethIn(first, "worked")).toHaveText(["11", "12"]);
      await expect(teethIn(first, "done")).toHaveCount(0);
      // …and a later visit of another tooth shows it green beside its own blue.
      await expect(teethIn(later, "done")).toHaveText(["11"]);
      await expect(teethIn(later, "worked")).toHaveText(["13"]);
    };
    await expectFinished();
    await dialog.screenshot({ path: "test-results/stage-tooth-done.png" });

    // From the database, on a fresh load.
    await page.reload();
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    await expectFinished();

    // Un-ticking Hoàn thành makes 11 an ordinary blue tooth again, everywhere.
    expect((await toggle(second, "revert-status")).ok()).toBe(true);
    await expect(teethIn(second, "worked")).toHaveText(["11"]);
    await expect(lineDone).toHaveCount(0);
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

    // The finished root is green; the warranty re-working 11·21 shows those
    // blue on its own row, and 22 — finished, untouched — stays green.
    await expect(rootRow.locator(".pd-stage-histtooth--done")).toHaveText(["11", "21", "22"]);
    const warrantyRow = dialog.locator(`.pd-stage-histrow[data-stage-id="${firstWarranty.id}"]`);
    await expect(warrantyRow.locator(".pd-stage-histtooth--worked")).toHaveText(["11", "21"]);
    await expect(warrantyRow.locator(".pd-stage-histtooth--done")).toHaveText(["22"]);

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
    const form = dialog.locator(`.pd-stage-form[data-item-id="continueWarranty:${line.lineId}"]`);
    // 22 is the line's but not this warranty's: listed, faded, inert.
    expect(await chipStates(form)).toEqual(["11*", "21*", "22!"]);
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
    // Finished in turn, the warranty's own teeth go green again.
    await expect(nextRow.locator(".pd-stage-histtooth--done")).toHaveText(["11", "21", "22"]);

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

/**
 * A công đoạn names its ticked steps through their catalog ids. Saving the
 * service in Danh mục used to re-create every step under a new id, which left
 * those công đoạn pointing at nothing — "Tạo bảo hành" then listed blank
 * checkboxes. The save now keeps the id of every step the dialog sends back.
 */
test.describe("Danh mục dịch vụ — bước công đoạn giữ nguyên khi sửa", () => {
  test("re-saving a service keeps its steps' ids; only a new row gets a new one", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const result = await page.evaluate(
      async ({ branch, stamp }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const call = async (method: string, url: string, body?: unknown) => {
          const res = await fetch(url, {
            method,
            credentials: "include",
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return { status: res.status, json: res.ok ? await res.json() : await res.text() };
        };
        const group = (
          await call("GET", `/api/v1/app/taxonomies?clinicBranchId=${branch}&group=care_service&maxResultCount=1`)
        ).json.items[0];
        const made = await call("POST", "/api/v1/app/catalog-entries", {
          clinicBranchId: branch,
          taxonomyId: group.id,
          name: `e2e bước ${stamp}`,
          price: 0,
          stages: [
            { name: "Bước A", value: 0 },
            { name: "Bước B", value: 0 },
          ],
        });
        if (made.status !== 200) return { error: `create ${made.status} ${String(made.json)}` };
        const before = made.json.stages as { id: string; name: string; value: number }[];

        // What the Danh mục dialog sends back: the rows it loaded, ids and all,
        // one renamed, plus a row typed in anew.
        const saved = await call("PUT", `/api/v1/app/catalog-entries/${made.json.id}`, {
          taxonomyId: group.id,
          name: made.json.name,
          price: 0,
          isActive: true,
          isDeleted: false,
          sortOrder: 0,
          stages: [
            { id: before[0].id, name: "Bước A", value: 0 },
            { id: before[1].id, name: "Bước B sửa", value: 5 },
            { name: "Bước C", value: 0 },
          ],
        });
        if (saved.status !== 200) return { error: `update ${saved.status} ${String(saved.json)}` };
        const after = (await call("GET", `/api/v1/app/catalog-entries/${made.json.id}`)).json.stages as {
          id: string;
          name: string;
          value: number;
        }[];

        // And a row dropped from the table is gone.
        await call("PUT", `/api/v1/app/catalog-entries/${made.json.id}`, {
          taxonomyId: group.id,
          name: made.json.name,
          price: 0,
          isActive: true,
          isDeleted: false,
          sortOrder: 0,
          stages: [after[0], after[2]],
        });
        const dropped = (await call("GET", `/api/v1/app/catalog-entries/${made.json.id}`)).json.stages as {
          id: string;
        }[];
        return { before, after, dropped };
      },
      { branch: BRANCH, stamp: runId() },
    );

    expect("error" in result ? result.error : null).toBeNull();
    const { before, after, dropped } = result as {
      before: { id: string }[];
      after: { id: string; name: string; value: number }[];
      dropped: { id: string }[];
    };
    expect(after.map((step) => step.name)).toEqual(["Bước A", "Bước B sửa", "Bước C"]);
    expect(after[0].id, "an unchanged step keeps its id").toBe(before[0].id);
    expect(after[1].id, "a renamed step keeps its id").toBe(before[1].id);
    expect(after[1].value).toBe(5);
    expect(before.map((step) => step.id)).not.toContain(after[2].id);
    expect(dropped.map((step) => step.id)).toEqual([after[0].id, after[2].id]);
  });
});
