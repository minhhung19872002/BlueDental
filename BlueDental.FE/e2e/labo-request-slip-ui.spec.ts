import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call, LaboStatus, type Paged } from "./fixtures/laboApi";
import {
  CaseType,
  fullSlip,
  laboServices,
  Layout,
  MaterialGroup,
  newMaterial,
  newPatient,
  readBack,
  save,
  slipCatalog,
  slipNo,
} from "./fixtures/laboSlipApi";
import {
  chooseOption,
  day,
  fillRequired,
  openLaboTab,
  ordersOf,
  patientRow,
  pickRestoration,
  pickTeeth,
  restorationRows,
  sentOrder,
  slipDialog,
  startSlip,
} from "./fixtures/laboSlipUi";

/**
 * Feature F-91 through the screens: the Phiếu yêu cầu that replaced tab Đặt
 * hàng, driven from the patient's Labo tab in a real browser — real login,
 * real API, real database, no interception. Every order the browser makes is
 * read back with its own GET.
 */

/** Pages in a PDF, and its first page's size in points (A4 = 595 × 842). */
function pdfShape(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const box = text.match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return {
    pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    size: box ? [Math.round(Number(box[1])), Math.round(Number(box[2]))] : [],
  };
}

test.describe("Labo Phiếu yêu cầu UI (F-91)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Tạo phiếu Labo from the patient's tab sends a full slip, lands on the patient's Labo list and prints the new sheet", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "ui");
    const no = slipNo("ui");
    const dialog = await startSlip(page, patientId);

    await test.step("what is known is already filled", async () => {
      await expect(dialog.getByLabel("Ngày gửi")).toHaveValue(day(0));
      await expect(dialog.getByRole("radio", { name: "Ca mới" })).toBeChecked();
      await expect(dialog.getByRole("textbox", { name: "Bệnh nhân" })).toContainText("Phiếu YC ui");
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
      // P1311: no supplier yet, so its address waits for one.
      await expect(dialog.getByRole("textbox", { name: "Địa chỉ nhà cung cấp" })).toHaveText("Chọn nhà cung cấp trước");
      await expect(dialog.getByRole("status")).toContainText("Chưa chọn nhà cung cấp");
    });

    await test.step("the sheet scrolls with the wheel under a pinned footer", async () => {
      // Playwright scrolls targets into view on its own, so only a real wheel
      // shows whether a person can reach the bottom of the sheet.
      const scroller = dialog.locator(".rs-slip-scroll");
      // A flex column squeezes clipped sections to a hairline: every one must keep its height.
      for (const part of [".rs-info", ".rs-note"]) {
        const box = await dialog.locator(part).first().boundingBox();
        expect(box?.height ?? 0, part).toBeGreaterThan(100);
      }
      await scroller.hover();
      await page.mouse.wheel(0, await scroller.evaluate((el) => el.scrollHeight));
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeInViewport();
      await expect(dialog.getByLabel("Yêu cầu", { exact: true })).toBeInViewport();
    });

    await test.step("Chỉ định picks teeth in the system's Chọn răng dialog, Răng sữa too", async () => {
      const row = dialog.locator(".rs-teeth");
      await pickTeeth(page, dialog, [55], true);
      await expect(row).toContainText("R55");
      await expect(row).toContainText("Số lượng: 1");
      await pickTeeth(page, dialog, [55], true);
      await expect(row).not.toContainText("R55");
    });

    await test.step("the sheet folds to the screen without a sideways scroll", async () => {
      const scroller = dialog.locator(".rs-slip-scroll");
      const size = page.viewportSize();
      for (const width of [1100, 800, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await expect
          .poll(() => scroller.evaluate((el) => el.scrollWidth - el.clientWidth), {
            message: `${width}px`,
          })
          .toBeLessThanOrEqual(1);
      }
      if (size) await page.setViewportSize(size);
    });

    await test.step("fill the slip", async () => {
      await fillRequired(page, dialog, no, c.ceramic, c.supplier);
      await dialog.getByLabel("Màu thân gần").fill("a2");
      await expect(dialog.getByLabel("Màu thân gần")).toHaveValue("A2");
      await dialog.getByRole("checkbox", { name: c.finishLines[0].name }).check();
      await chooseOption(page, dialog, "Kiểu nhịp", c.rhythm.name);
      await chooseOption(page, dialog, "Khớp cắn", c.bite.name);
      await dialog.getByLabel("Yêu cầu", { exact: true }).fill("Làm sát nướu");
      await expect(dialog.getByRole("status")).toHaveText("Phiếu đã đủ thông tin.");
    });

    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    // Back on the patient's own Labo tab, not /labo (owner, 2026-11-10).
    await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=labo`));
    await expect(slipDialog(page)).toBeHidden();
    const row = page.locator(".pd-pane tbody tr.ant-table-row").filter({ hasText: no }).first();
    await expect(row).toContainText(c.ceramic.name);
    await expect(row).not.toContainText("trên implant");
    await expect(row).toContainText("Đã gửi");

    await test.step("stored once per tooth, no plan, the supplier picked", async () => {
      const [made] = await ordersOf(page, patientId);
      const order = await readBack(page, made.id);
      expect(order.layout).toBe(Layout.RequestSlip);
      expect(order.labSlipNo).toBe(no);
      expect(order.caseType).toBe(CaseType.New);
      expect(order.status).toBe(LaboStatus.Sent);
      expect(order.treatmentServiceId).toBeNull();
      expect(order.treatmentStageId).toBeNull();
      expect(order.supplierName).toBe(c.supplier.name);
      // Rich text since R-1212: Quill keeps the words in a paragraph, spaces as &nbsp;.
      expect((order.notes ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")).toBe("Làm sát nướu");
      expect(order.teeth.map((tooth) => tooth.toothNumber).sort()).toEqual([16, 17]);
      expect([order.rhythmName, order.biteName]).toEqual([c.rhythm.name, c.bite.name]);
      for (const tooth of order.teeth) {
        expect(tooth.restorations.map((r) => [r.materialId, r.onImplant])).toEqual([
          [c.ceramic.id, false],
        ]);
        expect(tooth.shadeZones?.bodyMesial).toBe("A2");
        expect(tooth.finishLineIds).toEqual([c.finishLines[0].id]);
        expect([tooth.rhythmId, tooth.biteId]).toEqual([c.rhythm.id, c.bite.id]);
      }
    });

    await test.step("Xem shows the slip's facts and the new print sheet", async () => {
      await page.goto(`/labo?branchId=${BRANCH_ONE}`);
      const again = page
        .locator(".bd-labo-screen tbody tr.ant-table-row")
        .filter({ hasText: no })
        .first();
      await again.getByRole("button", { name: "Xem", exact: true }).click();
      const detail = page.getByRole("dialog").filter({ hasText: no });
      for (const fact of [c.ceramic.name, c.rhythm.name, c.bite.name]) await expect(detail).toContainText(fact);
      await expect(detail).not.toContainText("trên implant");
      await expect(detail.getByRole("button", { name: "In Phiếu Labo" })).toBeVisible();

      const sheet = page.locator(".pd-slip-print");
      await expect(sheet).toContainText("PHIẾU YÊU CẦU LABO");
      await expect(sheet).toContainText(`Mã số: ${no}`);
      for (const fact of [c.finishLines[0].name, c.rhythm.name, c.bite.name]) await expect(sheet).toContainText(fact);
      expect((await sheet.locator(".is-picked").allTextContents()).sort()).toEqual(["16", "17"]);
    });

    await test.step("In Phiếu Labo prints one A4 page whatever paper the printer offers", async () => {
      // A PDF printer's default paper is small: the sheet used to reflow onto
      // three pages there. Only the browser's own print dialog is skipped.
      await page.evaluate(() => {
        window.print = () => undefined;
      });
      const detail = page.getByRole("dialog").filter({ hasText: no });
      await detail.getByRole("button", { name: "In Phiếu Labo" }).click();
      const pdf = await page.pdf({ width: "105mm", height: "148mm", preferCSSPageSize: true });
      expect(pdfShape(pdf)).toEqual({ pages: 1, size: [595, 842] });
    });
  });

  test("a Mã số already on another order of the branch is refused and nothing is made", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const no = slipNo("dup");
    const first = await save(page, fullSlip(c, await newPatient(page, "dup-a"), no));
    expect(first.status, first.text).toBe(200);

    const patientId = await newPatient(page, "dup-b");
    const dialog = await startSlip(page, patientId);
    await fillRequired(page, dialog, no, c.ceramic, c.supplier);
    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();

    await expect(
      page.getByText(`Mã số ${no} đã có trên phiếu Labo khác của chi nhánh.`),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await ordersOf(page, patientId)).toHaveLength(0);
  });

  /** R-1106 carried onto the Phiếu yêu cầu: kept by the owner's F-91 decisions. */
  test("a tooth another order of the patient is still making is flagged, not blocked", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "prior");
    const earlierNo = slipNo("prior-a");
    const earlier = await save(page, fullSlip(c, patientId, earlierNo, { teeth: [16] }));
    expect(earlier.status, earlier.text).toBe(200);

    const dialog = await startSlip(page, patientId);
    const no = slipNo("prior-b");
    await fillRequired(page, dialog, no, c.ceramic, c.supplier);

    // R16 sits on the earlier order: the box names it, R17 is not in it.
    const warning = dialog.locator(".pd-labo-prior");
    await expect(warning.locator(".pd-labo-prior-order")).toHaveCount(1);
    await expect(warning).toContainText("R16 đã có phiếu Labo trước đó");
    await expect(warning.locator(".pd-labo-prior-code")).toHaveText(earlierNo);
    await expect(warning).not.toContainText("R17");

    // «Xem phiếu» opens the earlier order on top; the slip being made stays.
    await warning.getByRole("button", { name: /Xem phiếu/ }).click();
    const detail = page.locator(".pd-labo-detail-dialog");
    await expect(detail).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Mã số", { exact: true })).toHaveValue(no);

    // Only a warning: Tạo phiếu Labo still sends it.
    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    await expect(page).toHaveURL(new RegExp(`/patient/${patientId}\\?.*tab=labo`));
    // The slip was opened from this very tab, so the URL says nothing: wait for the order.
    const made = await sentOrder(page, patientId, no);
    expect(made.status).toBe(LaboStatus.Sent);
  });

  test("a draft without Mã số reopens refilled; a sent slip opens locked with Hủy phiếu and In phiếu", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "lock");
    const draft = await save(page, {
      patientId,
      dentistId: c.dentistId,
      teeth: [21],
      zones: { incisalDistal: "B1" },
      restorations: [{ materialId: c.alloy.id, onImplant: false }],
      submit: false,
    });
    expect(draft.status, draft.text).toBe(200);
    const sentNo = slipNo("lock");
    const sent = await save(page, fullSlip(c, patientId, sentNo));
    expect(sent.status, sent.text).toBe(200);

    await openLaboTab(page, patientId);

    await test.step("the draft comes back as it was left", async () => {
      await patientRow(page, draft.body.orderCode!)
        .getByRole("button", { name: "Xem chi tiết" })
        .click();
      const dialog = slipDialog(page);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toHaveValue("");
      await expect(dialog.locator(".rs-teeth .pd-labo-toothchip")).toHaveText(["R21"]);
      await expect(dialog.getByLabel("Màu rìa cắn xa")).toHaveValue("B1");
      const rows = restorationRows(dialog);
      await expect(rows.service(c.alloy.groupName)).toBeChecked();
      await expect(rows.chips).toHaveText([`${c.alloy.name}×`]);
      await expect(dialog.getByRole("textbox", { name: "Địa chỉ nhà cung cấp" })).toHaveText("Chọn nhà cung cấp trước");
      await expect(dialog.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Huỷ", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step("the sent slip is the same sheet, shut", async () => {
      // A sent order opens on the step it waits on; Đặt hàng is one tab back.
      await patientRow(page, sentNo).getByRole("button", { name: "Xem chi tiết" }).click();
      await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
      const dialog = slipDialog(page);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toHaveValue(sentNo);
      await expect(dialog.getByLabel("Mã số", { exact: true })).toBeDisabled();
      await expect(
        dialog.locator(".rs-teeth").getByRole("button", { name: "Chọn răng", exact: true }),
      ).toHaveCount(0);
      await expect(dialog.locator(".rs-teeth")).toContainText("R16");
      await expect(dialog.getByRole("button", { name: "Hủy phiếu" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "In Phiếu Labo" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Lưu nháp" })).toHaveCount(0);
    });
  });

  test("Dịch vụ is one radio, Vật liệu any of its materials: searched, chipped, filtered, let go with another Dịch vụ (P1311)", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "pick");
    const id = runId();
    const second = await newMaterial(page, c.groups.TOAN_SU, `Emax e2e ${id}`);
    const dialog = await startSlip(page, patientId);
    const rows = restorationRows(dialog);

    await test.step("the three fixed groups lead the Dịch vụ list; Vật liệu waits for one", async () => {
      await expect(rows.services.nth(0)).toHaveText(c.groups.TOAN_SU.name);
      await expect(rows.services.nth(1)).toHaveText(c.groups.HOP_KIM.name);
      await expect(rows.services.nth(2)).toHaveText(c.groups.KHAC_TREN_IMPLANT.name);
      await expect(rows.materials).toHaveCount(0);
      await expect(rows.empty).toHaveText("Chọn dịch vụ trước");
      await expect(rows.search).toBeDisabled();
      await expect(dialog.getByText("Trên implant", { exact: true })).toHaveCount(0);
    });

    await test.step("two materials of one Dịch vụ, found by an accent-blind search, shown as chips", async () => {
      await pickRestoration(page, dialog, c.ceramic);
      await rows.search.fill(`emax E2E ${id}`.toUpperCase());
      await expect(rows.materials).toHaveCount(1);
      await rows.material(second.name).check();
      await rows.search.fill(`khong co ${id}`);
      await expect(rows.empty).toHaveText(`Không tìm thấy vật liệu "khong co ${id}".`);
      await rows.search.fill("");
      await expect(rows.chips).toHaveText([`${c.ceramic.name}×`, `${second.name}×`]);
    });

    await test.step("Đã chọn lists only the picks; a chip's × lets one go; Bỏ chọn tất cả all of them", async () => {
      await rows.filter.getByRole("button", { name: "Đã chọn (2)" }).click();
      // In the catalog's order, not the order they were picked.
      await expect(rows.materials).toHaveCount(2);
      await expect(rows.materials.filter({ hasText: c.ceramic.name })).toHaveCount(1);
      await expect(rows.materials.filter({ hasText: second.name })).toHaveCount(1);
      await rows.box.getByRole("button", { name: `Bỏ ${second.name}` }).click();
      await expect(rows.materials).toHaveText([c.ceramic.name]);
      await rows.box.getByRole("button", { name: "Bỏ chọn tất cả" }).click();
      await expect(rows.chips).toHaveCount(0);
      await expect(rows.empty).toHaveText("Chưa chọn vật liệu nào.");
      await rows.filter.getByRole("button", { name: /^Tất cả/ }).click();
    });

    await test.step("another Dịch vụ lets every pick go", async () => {
      await pickRestoration(page, dialog, c.ceramic);
      await pickRestoration(page, dialog, second);
      await rows.service(c.groups.HOP_KIM.name).check();
      await expect(rows.chips).toHaveCount(0);
      await expect(rows.materials.filter({ hasText: c.ceramic.name })).toHaveCount(0);
      await rows.service(c.groups.TOAN_SU.name).check();
      await pickRestoration(page, dialog, c.ceramic);
      await pickRestoration(page, dialog, second);
    });

    await test.step("sent with both on every tooth, both read back on the reopened slip", async () => {
      const no = slipNo("pick");
      // fillRequired ticks the ceramic again, which it already holds.
      await fillRequired(page, dialog, no, c.ceramic, c.supplier);
      await expect(rows.chips).toHaveCount(2);
      await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
      const made = await sentOrder(page, patientId, no);
      const order = await readBack(page, made.id);
      for (const tooth of order.teeth)
        expect(tooth.restorations.map((r) => r.materialId).sort()).toEqual([c.ceramic.id, second.id].sort());
      expect([order.rhythmName, order.biteName]).toEqual([null, null]);

      await patientRow(page, no).getByRole("button", { name: "Xem chi tiết" }).click();
      await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
      const again = restorationRows(slipDialog(page));
      await expect(again.chips).toHaveText([c.ceramic.name, second.name], { useInnerText: true });
      await expect(slipDialog(page).getByRole("textbox", { name: "Địa chỉ nhà cung cấp" })).not.toHaveText(
        "Chọn nhà cung cấp trước",
      );
    });
  });

  test("Nhà cung cấp (Labo) is required; its + makes one, picks it and shows its address and Liên hệ (P1311)", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "sup");
    const dialog = await startSlip(page, patientId);
    const no = slipNo("sup");
    await fillRequired(page, dialog, no, c.ceramic, c.supplier);
    await expect(dialog.getByRole("status")).toHaveText("Phiếu đã đủ thông tin.");

    const name = `NCC slip e2e ${runId()}`;
    await dialog.getByRole("button", { name: "Thêm nhà cung cấp mới" }).click();
    const create = page.getByRole("dialog").filter({ hasNot: page.locator(".rs-slip") }).last();
    await create.getByRole("textbox", { name: /^Tên nhà cung cấp/ }).fill(name);
    await create.getByRole("textbox", { name: /^Email/ }).fill("ncc-slip@example.com");
    await create.getByRole("textbox", { name: /^Số điện thoại/ }).fill("0912345678");
    await create.getByRole("textbox", { name: /^Địa chỉ/ }).fill("12 Lê Lợi");
    await create.getByRole("button", { name: /Lưu/ }).click();
    await expect(create).toBeHidden({ timeout: 10_000 });

    const select = dialog.locator(".rs-supplier .ant-select");
    await expect(select).toContainText(name);
    await expect(dialog.getByRole("textbox", { name: "Địa chỉ nhà cung cấp" })).toContainText("12 Lê Lợi");
    await expect(dialog.locator(".rs-contact")).toHaveText("Liên hệ: 0912345678");

    await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    const made = await sentOrder(page, patientId, no);
    expect(made.supplierName).toBe(name);
  });

  test("Dịch vụ Labo: a Dịch vụ is added, renamed, refused deletion while it holds a material, then deleted; the fixed three stay locked (P1311)", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    await page.goto(`/labo/service-material?branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, "/labo-materials");
    await expect(page.getByRole("link", { name: "Dịch vụ Labo", exact: true })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Danh mục dịch vụ" });
    const id = runId();
    const first = `Veneer UI ${id}`;
    const renamed = `Veneer sứ UI ${id}`;

    await test.step("the fixed three lead the list and offer no commands", async () => {
      const buttons = nav.locator(".bd-group-btn");
      await expect(buttons.nth(0)).toHaveText(c.groups.TOAN_SU.name);
      await expect(buttons.nth(1)).toHaveText(c.groups.HOP_KIM.name);
      await expect(buttons.nth(2)).toHaveText(c.groups.KHAC_TREN_IMPLANT.name);
      for (const name of [c.groups.TOAN_SU.name, c.groups.HOP_KIM.name, c.groups.KHAC_TREN_IMPLANT.name]) {
        const row = nav.locator(".bd-group-row").filter({ hasText: name });
        await expect(row.getByRole("button", { name: "Thêm thao tác" })).toHaveCount(0);
      }
    });

    await test.step("+ adds a Dịch vụ, Chỉnh sửa renames it", async () => {
      await page.getByRole("button", { name: "Thêm dịch vụ" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: /^Tên dịch vụ/ }).fill(first);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      const row = nav.locator(".bd-group-row").filter({ hasText: first });
      await expect(row).toHaveCount(1);

      await row.getByRole("button", { name: "Thêm thao tác" }).click();
      await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
      await dialog.getByRole("textbox", { name: /^Tên dịch vụ/ }).fill(renamed);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      await page.reload();
      await expect(nav.locator(".bd-group-row").filter({ hasText: renamed })).toHaveCount(1);
    });

    await test.step("Xoá is refused while the Dịch vụ holds a material, done once it is empty", async () => {
      const service = (await laboServices(page)).find((one) => one.name === renamed);
      expect(service, renamed).toBeTruthy();
      const material = await newMaterial(page, { id: service!.id, name: renamed }, `Lithium UI ${id}`);
      const row = nav.locator(".bd-group-row").filter({ hasText: renamed });
      const remove = async () => {
        await row.getByRole("button", { name: "Thêm thao tác" }).click();
        await page.getByRole("menuitem", { name: "Xoá" }).click();
        await page.getByRole("dialog", { name: "Xác nhận xoá dịch vụ" }).getByRole("button", { name: /Xoá$/ }).click();
      };
      await remove();
      await expect(page.getByText("Dịch vụ còn vật liệu, hãy xoá hoặc chuyển các vật liệu trước khi xoá dịch vụ.")).toBeVisible();
      await expect(row).toHaveCount(1);
      await page.keyboard.press("Escape");

      const gone = await call(page, `/api/v1/app/labo-materials/${material.id}`, { method: "DELETE", branchId: BRANCH_ONE });
      expect(gone.status, gone.text).toBeLessThan(300);
      await page.reload();
      await remove();
      await expect(row).toHaveCount(0);
      expect((await laboServices(page)).some((one) => one.name === renamed)).toBe(false);
    });
  });

  test("a material of Dịch vụ Labo takes a unique Mã and its Trạng thái is switched in the table (P1011)", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    await page.goto(`/labo/service-material?branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, "/labo-materials");

    await test.step("the code shown in the head", async () => {
      const nav = page.getByRole("navigation", { name: "Danh mục dịch vụ" });
      await nav.getByText(c.groups.HOP_KIM.name, { exact: true }).click();
      await expect(page.locator(".bd-labo-material-title")).toContainText(MaterialGroup.Alloy);
      await expect(page.locator(".bd-labo-material-hint")).toHaveText(
        "Nhóm = Dịch vụ trên phiếu · Vật liệu = chọn sau khi chọn Dịch vụ",
      );
    });

    const code = `UI-${runId()}`.slice(0, 50);
    const name = `Vật liệu UI ${runId()}`;
    await test.step("Tạo vật liệu with a Mã; the same Mã again is refused", async () => {
      await page.getByRole("button", { name: "Tạo vật liệu" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: /^Mã/ }).fill(code);
      await dialog.getByRole("textbox", { name: /^Tên vật liệu/ }).fill(name);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });

      await page.getByRole("button", { name: "Tạo vật liệu" }).click();
      await dialog.getByRole("textbox", { name: /^Mã/ }).fill(c.alloy.code);
      await dialog.getByRole("textbox", { name: /^Tên vật liệu/ }).fill(`${name} 2`);
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(page.getByText(`Mã vật liệu ${c.alloy.code} đã tồn tại.`)).toBeVisible();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await test.step("found by its Mã, switched off, still off after a reload", async () => {
      const search = page.getByRole("textbox", { name: "Tìm kiếm vật liệu" });
      await search.fill(code.toLowerCase());
      const row = page.locator("tbody tr.ant-table-row").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row.locator(".bd-labo-material-code")).toHaveText(code);
      await row.getByRole("switch", { name: `Trạng thái ${name}` }).click();
      await expect(row).toContainText("Ngừng");

      await page.reload();
      await page.getByRole("navigation", { name: "Danh mục dịch vụ" }).getByText(c.groups.HOP_KIM.name, { exact: true }).click();
      await page.getByRole("textbox", { name: "Tìm kiếm vật liệu" }).fill(code);
      const again = page.locator("tbody tr.ant-table-row").filter({ hasText: name });
      await expect(again.getByRole("switch", { name: `Trạng thái ${name}` })).not.toBeChecked();
      await expect(again).toContainText("Ngừng");
    });

    await test.step("the stored row says so", async () => {
      const res = await call<Paged<{ code: string; name: string; isActive: boolean; taxonomyId: string }>>(
        page,
        `/api/v1/app/labo-materials?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(code)}&MaxResultCount=10`,
        { branchId: BRANCH_ONE },
      );
      expect(res.status, res.text).toBe(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({ code, name, isActive: false, taxonomyId: c.groups.HOP_KIM.id }),
      ]);
    });
  });

  test("a material switched to Ngừng is not offered on a new slip (P1011)", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const stopped = await newMaterial(page, c.groups.TOAN_SU, `Ngừng e2e ${runId()}`);
    const set = await call(page, `/api/v1/app/labo-materials/${stopped.id}/active`, {
      method: "PUT",
      branchId: BRANCH_ONE,
      json: { isActive: false },
    });
    expect(set.status, set.text).toBe(200);

    const dialog = await startSlip(page, await newPatient(page, "stop"));
    const rows = restorationRows(dialog);
    await rows.service(c.groups.TOAN_SU.name).check();
    await expect(rows.materials.filter({ hasText: c.ceramic.name })).toHaveCount(1);
    await expect(rows.materials.filter({ hasText: stopped.name })).toHaveCount(0);
    await rows.search.fill(stopped.name);
    await expect(rows.materials).toHaveCount(0);
    await rows.search.fill(c.ceramic.name);
    await expect(rows.materials).toHaveCount(1);
  });
});
