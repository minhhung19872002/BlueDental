import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Chẩn đoán & Tư vấn: the plan footer, the advise table's drag-to-reorder, and
 * the two printed sheets — all on the real stack, against the second branch,
 * which is where the plan-scoped vouchers are seeded.
 *
 * No `page.route`, no injected token: the tests log in through the real screen
 * and every assertion below is served by the real API and PostgreSQL.
 */

/** The seeded second branch, and a patient of it that carries advise rows. */
const BRANCH = "22222222-2222-2222-2222-222222222222";
const PATIENT = "3a238cc0-d36b-309e-9ac6-9413686a82c3";
const CONSULTING = `/patient/${PATIENT}?tab=consulting&branchId=${BRANCH}`;

async function openConsulting(page: Page) {
  await page.goto(CONSULTING);
  await assertRealApiTraffic(page, "/api/v1/app/patient-advises");
  await expect(page.locator(".pd-advise-card")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".pd-advise-table tbody tr.ant-table-row").first()).toBeVisible({
    timeout: 20000,
  });
}

/** The service names down the advise table, in the order the table shows them. */
function serviceOrder(page: Page) {
  return page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-strong").allTextContents();
}

test.describe("Chẩn đoán & Tư vấn — kế hoạch", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the image panel spins until the photographs arrive, never offering the empty zone first", async ({
    page,
  }) => {
    await page.goto(CONSULTING);

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

    // "28 - âsasa" — the teeth and the diagnosis read as one fact in link blue.
    const diagnosis = page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-link").first();
    await expect(diagnosis).toBeVisible();
    await expect(diagnosis).toHaveText(/.+ - .+/);
    await expect(diagnosis).toHaveCSS("color", "rgb(38, 113, 216)");

    // The service names itself and nothing else: the teeth moved one column on.
    const service = page.locator(".pd-advise-table tbody tr.ant-table-row .pd-cell-strong").first();
    await expect(service).toBeVisible();
    await expect(service).not.toHaveText(/ - /);
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

  test("Thêm kế hoạch điều trị raises a slip off the ticked line and converts it", async ({
    page,
  }) => {
    await openConsulting(page);

    // Provisions its own consulting line through the real API, because opening a
    // slip **converts** the lines it pulls in — a converted line can never be
    // accepted again, so a test that reused the seeded rows would pass once.
    const line = await page.evaluate(
      async ({ patient, branch }) => {
        const send = (url: string, init?: RequestInit) =>
          fetch(url, {
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
            ...init,
          });

        const slip = (
          await (
            await send(`/api/v1/app/patient-diagnoses?patientId=${patient}&maxResultCount=1`)
          ).json()
        ).items?.[0] as { id: string; diagnosisId: string; staffId: string } | undefined;
        const service = (
          await (
            await send("/api/v1/app/catalog-entries?group=care_service&maxResultCount=1")
          ).json()
        ).items?.[0] as { id: string; price: number | null } | undefined;
        if (!slip || !service) return null;

        const advise = await (
          await send("/api/v1/app/patient-advises", {
            method: "POST",
            body: JSON.stringify({
              patientId: patient,
              clinicBranchId: branch,
              patientDiagnosisId: slip.id,
              diagnosisId: slip.diagnosisId,
              serviceId: service.id,
              staffId: slip.staffId,
              originalPrice: service.price ?? 100000,
              price: service.price ?? 100000,
              quantity: 1,
              discountType: 0,
              discountValue: 0,
              // At least one tooth: the server refuses a line without one
              // ("Select at least one tooth or surface").
              teeth: [
                {
                  toothCode: 27,
                  selected: true,
                  top: false,
                  right: false,
                  bottom: false,
                  left: false,
                  center: false,
                },
              ],
            }),
          })
        ).json();
        return advise as { id: string; code: string };
      },
      { patient: PATIENT, branch: BRANCH },
    );
    expect(line?.id, `the line should have been created, got ${JSON.stringify(line)}`).toBeTruthy();

    // The new line is the one this test ticks, found by its own code.
    await page.reload();
    const row = page.locator(`.pd-advise-table tr[data-row-key="${line!.id}"]`);
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.locator(".ant-checkbox-input").check();

    await page.getByLabel("Chọn bác sĩ điều trị").click();
    await page.locator(".ant-select-item-option").first().click();

    const opened = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-treatments") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Thêm kế hoạch điều trị" }).click();
    const response = await opened;
    expect(response.ok(), await response.text()).toBeTruthy();

    // The slip carries the line it was raised off, priced from it.
    const slip = (await response.json()) as {
      code: string;
      services: { sourceAdviseId: string | null }[];
    };
    expect(slip.code).toMatch(/^DT\d+$/);
    expect(slip.services.map((s) => s.sourceAdviseId)).toContain(line!.id);

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
      { id: line!.id, branch: BRANCH },
    );
    expect(status.status).toBe(3); // Converted
    expect(status.treatmentPlanId).not.toBeNull();
  });

  test("the voucher picker offers the branch's own plan vouchers, and one comes off the total", async ({
    page,
  }) => {
    await openConsulting(page);

    // The picker asks the server what applies to the ticked total, so the read
    // goes out on the tick — before the popover is ever opened.
    const available = page.waitForResponse(
      (res) =>
        res.url().includes("/vouchers/available") &&
        res.url().includes("orderAmount=") &&
        !res.url().includes("orderAmount=0") &&
        res.request().method() === "GET",
    );
    await page
      .locator(".pd-advise-table tbody tr.ant-table-row")
      .first()
      .locator(".ant-checkbox-input")
      .check();
    expect((await available).ok()).toBeTruthy();

    await page.getByRole("button", { name: /Chọn voucher|Voucher \(/ }).click();

    // Staging's search box and its count.
    await expect(page.getByRole("textbox", { name: "Tìm voucher" })).toHaveAttribute(
      "placeholder",
      "Tìm voucher theo mã hoặc tên...",
    );
    await expect(page.getByText("Đã chọn: 0")).toBeVisible();

    // Seeded for this branch, treatment-scoped, published and inside their dates.
    const list = page.locator(".pd-voucher-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText("CN2WELCOME");

    // A code no voucher carries leaves the bordered box on its empty sentence.
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill("KHONG-CO-MA-NAY");
    await expect(
      page.getByText("Không có voucher nào khả dụng cho kế hoạch điều trị."),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill("");
    await expect(list).toContainText("CN2WELCOME");

    const before = await page.locator(".pd-plan-net b").innerText();
    await page.locator(".pd-voucher-row").filter({ hasText: "CN2WELCOME" }).click();
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
    await page.goto(CONSULTING);

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
      await page.getByRole("button", { name: "Cột hiển thị" }).click();
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
      { patient: PATIENT, branch: BRANCH },
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

    // The ✕ drops the quote it belongs to, and the drop is the server's too, so
    // it does not come back on the next load. Also leaves this patient with no
    // quotes, so a re-run starts where this one did.
    await page.getByRole("tab", { name: newestLabel }).click();
    await page.getByRole("button", { name: `Bỏ ${newestLabel}` }).click();
    await expect(quoteTabs()).toHaveCount(1);
    await page.getByRole("tab", { name: firstLabel }).click();
    await page.getByRole("button", { name: `Bỏ ${firstLabel}` }).click();
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
