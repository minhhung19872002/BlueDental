import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { BRANCH_ONE, call, type Paged } from "./fixtures/laboApi";
import {
  FORM_TEMPLATES,
  newTemplate,
  readExtra,
  saveTemplate,
  setActive,
  templateName,
  valuesOf,
  type TemplateView,
} from "./fixtures/laboFormTemplateApi";
import { newPatient, slipCatalog, slipNo } from "./fixtures/laboSlipApi";
import { day, fillRequired, openLaboTab, ordersOf, patientRow, sentOrder, slipDialog, startSlip, typeDate } from "./fixtures/laboSlipUi";

/**
 * Feature F-93 through the screens: tab Mẫu phiếu builds the branch's extra
 * field lists, and the Phiếu yêu cầu takes one under Thông tin bổ sung. Real
 * login, real API, real database, no interception; what the browser saves is
 * read back with its own GET.
 */

/** What an accent-blind search box matches: no marks, đ as d. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

/** yyyy-MM-dd, `days` from today — how a Ngày answer is stored. */
function isoDay(days: number): string {
  const [d, m, y] = day(days).split("/");
  return `${y}-${m}-${d}`;
}

/** Opens an AntD Select and picks the option with this exact text. */
async function choose(page: Page, field: Locator, option: string) {
  await field.click();
  // The last dropdown opened is the newest one in the page; an earlier one may still be fading out.
  await page.locator(".ant-select-dropdown:visible").last().locator(".ant-select-item-option").filter({ hasText: new RegExp(`^${option}$`) }).click();
}

async function getTemplate(page: Page, id: string) {
  return call<TemplateView>(page, `${FORM_TEMPLATES}/${id}`, { branchId: BRANCH_ONE });
}

async function templateByName(page: Page, name: string): Promise<TemplateView> {
  const res = await call<Paged<TemplateView>>(
    page,
    `${FORM_TEMPLATES}?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(name)}&MaxResultCount=10`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status, res.text).toBe(200);
  const found = (res.body.items ?? []).find((template) => template.name === name);
  expect(found, `template ${name}`).toBeTruthy();
  return found!;
}

/** Every Đang dùng template of branch 1 switched off, so the slip has none to offer. */
async function stopAllTemplates(page: Page) {
  for (;;) {
    const res = await call<Paged<TemplateView>>(
      page,
      `${FORM_TEMPLATES}?ClinicBranchId=${BRANCH_ONE}&IsActive=true&MaxResultCount=200`,
      { branchId: BRANCH_ONE },
    );
    expect(res.status, res.text).toBe(200);
    const live = res.body.items ?? [];
    if (live.length === 0) return;
    for (const template of live) await setActive(page, template.id, false);
  }
}

function templateRow(page: Page, name: string) {
  return page.locator(".bd-labo-screen tbody tr.ant-table-row").filter({ hasText: name });
}

async function searchTemplates(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Tìm mẫu phiếu" }).fill(text);
}

test.describe("Labo Mẫu phiếu bổ sung UI (F-93)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("tab Mẫu phiếu builds a template field by field, finds it accent-blind, edits it in place, stops it and deletes it", async ({
    page,
  }) => {
    const name = templateName("Giao diện Đặt");
    await page.goto(`/labo/form-template?branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, FORM_TEMPLATES);

    const dialog = page.getByRole("dialog").filter({ has: page.locator(".ft-dialog") });
    const problem = dialog.locator(".ft-problem");
    const saveButton = dialog.locator(".bd-modal-foot-actions .ant-btn-primary");

    await test.step("what still stops Lưu reads in the footer", async () => {
      await page.getByRole("button", { name: "Tạo mẫu phiếu" }).click();
      await expect(dialog).toContainText("Tạo mẫu phiếu");
      await expect(problem).toHaveText("Vui lòng nhập Tên mẫu");
      await expect(saveButton).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Xoá trường 1" })).toBeDisabled();

      await dialog.getByLabel("Tên mẫu").fill(name);
      await expect(problem).toHaveText("Trường 1 chưa có tên");
      await dialog.getByLabel("Tên trường 1").fill("Mã labo");
      await expect(problem).toHaveCount(0);
      await expect(saveButton).toBeEnabled();

      await dialog.getByRole("button", { name: "Thêm trường" }).click();
      await expect(problem).toHaveText("Trường 2 chưa có tên");
      await dialog.getByLabel("Tên trường 2").fill("mã LABO");
      await expect(problem).toHaveText('Tên trường "mã LABO" bị trùng');
      await expect(saveButton).toBeDisabled();
      await dialog.getByLabel("Tên trường 2").fill("Hãng sứ");
      await choose(page, dialog.getByLabel("Kiểu trường 2"), "Chọn một");
      await expect(problem).toHaveText('Trường "Hãng sứ" chưa có lựa chọn');
    });

    await test.step("choices are typed with Enter or split by ;", async () => {
      const options = dialog.getByLabel("Lựa chọn của trường 2");
      await options.pressSequentially("Cercon");
      await options.press("Enter");
      await options.pressSequentially("Emax;Lava;");
      const tags = dialog.locator(".ft-row-options .ant-select-selection-item");
      await expect(tags).toHaveText(["Cercon", "Emax", "Lava"]);
      await expect(problem).toHaveCount(0);
    });

    await test.step("fields are added, moved and removed; Bắt buộc is ticked per field", async () => {
      await dialog.getByRole("button", { name: "Thêm trường" }).click();
      await dialog.getByLabel("Tên trường 3").fill("Ghi chú kỹ thuật");
      await choose(page, dialog.getByLabel("Kiểu trường 3"), "Đoạn văn");
      await dialog.getByRole("button", { name: "Đưa trường 3 lên trên" }).click();
      await expect(dialog.getByLabel("Tên trường 2")).toHaveValue("Ghi chú kỹ thuật");
      await expect(dialog.getByLabel("Tên trường 3")).toHaveValue("Hãng sứ");
      await expect(dialog.getByRole("button", { name: "Đưa trường 1 lên trên" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Đưa trường 3 xuống dưới" })).toBeDisabled();

      await dialog.getByRole("button", { name: "Thêm trường" }).click();
      await dialog.getByLabel("Tên trường 4").fill("Bỏ đi");
      await expect(dialog).toContainText("4/30 trường");
      await dialog.getByRole("button", { name: "Xoá trường 4" }).click();
      await expect(dialog).toContainText("3/30 trường");
      await expect(dialog.getByTestId("form-field-row")).toHaveCount(3);

      await dialog.getByTestId("form-field-row").first().getByRole("checkbox", { name: "Bắt buộc" }).check();
      await dialog.getByLabel("Mô tả").fill("Mẫu thử giao diện");
    });

    await test.step("Lưu adds it; the server holds it as built", async () => {
      await saveButton.click();
      await expect(page.getByText("Đã thêm").first()).toBeVisible();
      await expect(dialog).toBeHidden();

      const made = await templateByName(page, name);
      expect(made.description).toBe("Mẫu thử giao diện");
      expect(made.isActive).toBe(true);
      expect(made.version).toBe(1);
      expect(made.fields.map((f) => [f.label, f.type, f.required])).toEqual([
        ["Mã labo", 1, true],
        ["Ghi chú kỹ thuật", 2, false],
        ["Hãng sứ", 5, false],
      ]);
      expect(made.fields[2].options).toEqual(["Cercon", "Emax", "Lava"]);
      expect(made.fields[0].options).toEqual([]);
    });

    await test.step("the search box finds it without accents", async () => {
      await searchTemplates(page, fold(name).toLowerCase());
      const row = templateRow(page, name);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("3 trường");
      await expect(row).toContainText("Mã labo, Ghi chú kỹ thuật, Hãng sứ");
      await expect(row).toContainText("Đang dùng");
    });

    await test.step("a name the branch already has is refused and the dialog stays", async () => {
      await page.getByRole("button", { name: "Tạo mẫu phiếu" }).click();
      await dialog.getByLabel("Tên mẫu").fill(name.toUpperCase());
      await dialog.getByLabel("Tên trường 1").fill("Khác");
      await saveButton.click();
      await expect(page.getByText(`Mẫu phiếu ${name.toUpperCase()} đã tồn tại.`)).toBeVisible();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(templateRow(page, name)).toHaveCount(1);
    });

    const before = await templateByName(page, name);

    await test.step("Sửa keeps every field's key and moves the version on", async () => {
      await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
      await expect(dialog).toContainText("Sửa mẫu phiếu");
      await expect(dialog).toContainText("Phiếu đã chọn mẫu này giữ bản cũ");
      await expect(dialog.getByLabel("Tên mẫu")).toHaveValue(name);
      await expect(dialog.getByLabel("Tên trường 3")).toHaveValue("Hãng sứ");
      await dialog.getByLabel("Tên trường 3").fill("Hãng sứ (mới)");
      await saveButton.click();
      await expect(page.getByText("Đã cập nhật").first()).toBeVisible();
      await expect(dialog).toBeHidden();

      const after = await templateByName(page, name);
      expect(after.version).toBe(2);
      expect(after.fields.map((f) => f.key)).toEqual(before.fields.map((f) => f.key));
      expect(after.fields[2].label).toBe("Hãng sứ (mới)");
      await expect(templateRow(page, name)).toContainText("Hãng sứ (mới)");
    });

    await test.step("the Trạng thái switch stops it, and it stays stopped after a reload", async () => {
      await page.getByRole("switch", { name: `Trạng thái ${name}` }).click();
      await expect(templateRow(page, name)).toContainText("Ngừng");
      await page.reload();
      await searchTemplates(page, name);
      await expect(templateRow(page, name)).toContainText("Ngừng");
      expect((await templateByName(page, name)).isActive).toBe(false);
    });

    await test.step("Xoá asks first, then the template is gone", async () => {
      await page.getByRole("button", { name: `Xoá ${name}` }).click();
      const confirm = page.getByRole("dialog", { name: "Xác nhận xoá mẫu phiếu" });
      await confirm.getByRole("button", { name: /Xoá$/ }).click();
      await expect(page.getByText("Đã xoá").first()).toBeVisible();
      await expect(templateRow(page, name)).toHaveCount(0);
      expect((await getTemplate(page, before.id)).status).toBe(404);
    });
  });

  test("Thông tin bổ sung on the Phiếu yêu cầu: hidden with no template, answered, saved as a draft, kept as a copy, sent and printed", async ({
    page,
  }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "extra-ui");
    const no = slipNo("xui");
    const section = (dialog: Locator) => dialog.getByRole("region", { name: "Thông tin bổ sung" });
    const status = (dialog: Locator) => dialog.getByRole("status");

    await test.step("no Đang dùng template: the slip reads as before, no section, no picker", async () => {
      await stopAllTemplates(page);
      const dialog = await startSlip(page, patientId);
      await expect(dialog.locator(".rs-teeth")).toBeVisible();
      await expect(section(dialog)).toHaveCount(0);
      await expect(dialog.getByLabel("Mẫu phiếu", { exact: true })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Huỷ", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    const template = await newTemplate(page, "Phiếu UI");
    const other = await newTemplate(page, "Khác UI", [{ label: "Ghi chú riêng", type: 1 }]);
    let orderId = "";

    await test.step("with one, the picker shows and is searched accent-blind", async () => {
      const dialog = await startSlip(page, patientId);
      // Nothing picked yet: the fixed slip, the picker at its top (F-94).
      await expect(section(dialog)).toHaveCount(0);
      await expect(dialog.getByLabel("Mẫu phiếu", { exact: true })).toBeVisible();
      await fillRequired(page, dialog, no, c.ceramic.name);
      await expect(status(dialog)).toHaveText("Phiếu đã đủ thông tin.");

      const picker = dialog.getByLabel("Mẫu phiếu", { exact: true });
      await picker.click();
      await picker.fill(fold(template.name).toLowerCase());
      const options = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
      await expect(options).toHaveText([template.name]);
      await options.first().click();

      // A template saved without a layout lays the slip out as the default one, its fields printed (F-94).
      await expect(dialog.locator(".rs-blocks")).toBeVisible();
      await expect(section(dialog)).not.toContainText("Không in trên phiếu");
      for (const label of ["Mã labo", "Ghi chú kỹ thuật", "Số lượng trụ", "Hạn bảo hành", "Hãng sứ", "Phụ kiện", "Có mẫu hàm"])
        await expect(section(dialog).getByLabel(label, { exact: true })).toBeVisible();
      await expect(section(dialog).locator(".rs-extra-field.is-missing")).toHaveCount(2);
      await expect(status(dialog)).toContainText("Chưa nhập đủ thông tin bổ sung bắt buộc");
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
    });

    await test.step("every kind is answered; Số takes a comma as the point and nothing else", async () => {
      const dialog = slipDialog(page);
      const extra = section(dialog);
      await extra.getByLabel("Mã labo", { exact: true }).fill("ML-01");
      await extra.getByLabel("Ghi chú kỹ thuật", { exact: true }).fill("Dòng một\nDòng hai");
      const count = extra.getByLabel("Số lượng trụ", { exact: true });
      await count.fill("2,5");
      await expect(count).toHaveValue("2.5");
      await count.fill("2.5x");
      await expect(count).toHaveValue("2.5");
      await choose(page, extra.getByLabel("Hãng sứ", { exact: true }), "Emax");
      await choose(page, extra.getByLabel("Phụ kiện", { exact: true }), "Khay");
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: /^Trụ$/ }).click();
      await page.keyboard.press("Escape");
      await choose(page, extra.getByLabel("Có mẫu hàm", { exact: true }), "Có");
      // Hạn bảo hành is left blank: a draft may keep a Bắt buộc field empty.
      await expect(extra.locator(".rs-extra-field.is-missing")).toHaveCount(1);
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Lưu nháp" }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step("the draft holds the copy and the cleaned answers", async () => {
      await expect.poll(async () => (await ordersOf(page, patientId)).length).toBe(1);
      const [made] = await ordersOf(page, patientId);
      orderId = made.id;
      const order = await readExtra(page, orderId);
      expect(order.extraForm?.templateId).toBe(template.id);
      expect(order.extraForm?.templateName).toBe(template.name);
      expect(order.extraForm?.version).toBe(1);
      expect(order.extraForm?.entries.map((e) => e.label)).toEqual(template.fields.map((f) => f.label));
      expect(valuesOf(order, "Mã labo")).toEqual(["ML-01"]);
      expect(valuesOf(order, "Ghi chú kỹ thuật")).toEqual(["Dòng một\nDòng hai"]);
      expect(valuesOf(order, "Số lượng trụ")).toEqual(["2.5"]);
      expect(valuesOf(order, "Hạn bảo hành")).toEqual([]);
      expect(valuesOf(order, "Hãng sứ")).toEqual(["Emax"]);
      expect(valuesOf(order, "Phụ kiện")).toEqual(["Trụ", "Khay"]);
      expect(valuesOf(order, "Có mẫu hàm")).toEqual(["true"]);
    });

    await test.step("edited and stopped afterwards, the template leaves the draft's copy as it was", async () => {
      const fields = template.fields.map((f) => (f.label === "Hãng sứ" ? { ...f, label: "Hãng sứ đổi tên" } : f));
      const edited = await saveTemplate(page, { name: template.name, fields }, { id: template.id });
      expect(edited.status, edited.text).toBe(200);
      await setActive(page, template.id, false);

      await openLaboTab(page, patientId);
      await patientRow(page, no).getByRole("button", { name: "Xem chi tiết" }).click();
      const dialog = slipDialog(page);
      const extra = section(dialog);
      await expect(dialog.locator(".rs-extra-pick")).toContainText(template.name);
      await expect(extra.getByLabel("Mã labo", { exact: true })).toHaveValue("ML-01");
      await expect(extra.getByLabel("Ghi chú kỹ thuật", { exact: true })).toHaveValue("Dòng một\nDòng hai");
      await expect(extra.getByLabel("Số lượng trụ", { exact: true })).toHaveValue("2.5");
      await expect(extra.getByLabel("Hãng sứ", { exact: true })).toBeVisible();
      await expect(extra.getByLabel("Hãng sứ đổi tên", { exact: true })).toHaveCount(0);
      await expect(extra.locator(".rs-extra-field").filter({ hasText: "Hãng sứ" })).toContainText("Emax");
      await expect(extra.locator(".rs-extra-field").filter({ hasText: "Phụ kiện" })).toContainText("Trụ");
      await expect(extra.locator(".rs-extra-field").filter({ hasText: "Phụ kiện" })).toContainText("Khay");
      await expect(extra.locator(".rs-extra-field").filter({ hasText: "Có mẫu hàm" })).toContainText("Có");
    });

    await test.step("cleared, the picker stays for the saved copy; picked again, the answers come back", async () => {
      const dialog = slipDialog(page);
      const pick = dialog.locator(".rs-extra-pick .ant-select");
      await pick.hover();
      await pick.locator(".ant-select-clear").click();
      await expect(section(dialog).getByLabel("Mã labo", { exact: true })).toHaveCount(0);
      await expect(dialog.getByLabel("Mẫu phiếu", { exact: true })).toBeVisible();
      await expect(status(dialog)).toHaveText("Phiếu đã đủ thông tin.");

      // The stopped template is offered only as the slip's own copy, next to the live one.
      await dialog.getByLabel("Mẫu phiếu", { exact: true }).click();
      const options = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
      await expect(options.filter({ hasText: other.name })).toHaveCount(1);
      await options.filter({ hasText: template.name }).click();
      await expect(section(dialog).getByLabel("Mã labo", { exact: true })).toHaveValue("ML-01");
      await expect(section(dialog).getByLabel("Hãng sứ", { exact: true })).toBeVisible();
    });

    await test.step("a Bắt buộc field emptied blocks Tạo phiếu Labo; filled, the slip is sent", async () => {
      const dialog = slipDialog(page);
      const extra = section(dialog);
      await typeDate(extra.getByLabel("Hạn bảo hành", { exact: true }), day(30));
      await expect(status(dialog)).toHaveText("Phiếu đã đủ thông tin.");
      await extra.getByLabel("Mã labo", { exact: true }).fill("");
      await expect(status(dialog)).toContainText("Chưa nhập đủ thông tin bổ sung bắt buộc");
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
      await extra.getByLabel("Mã labo", { exact: true }).fill("ML-02");
      await expect(status(dialog)).toHaveText("Phiếu đã đủ thông tin.");
      await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();

      const sent = await sentOrder(page, patientId, no);
      const order = await readExtra(page, sent.id);
      expect(order.extraForm?.version).toBe(1);
      expect(valuesOf(order, "Mã labo")).toEqual(["ML-02"]);
      expect(valuesOf(order, "Hạn bảo hành")).toEqual([isoDay(30)]);
      expect(valuesOf(order, "Hãng sứ")).toEqual(["Emax"]);
      expect(order.extraForm?.entries.some((e) => e.label === "Hãng sứ đổi tên")).toBe(false);
    });

    await test.step("the sent slip shows the answers, shut", async () => {
      await openLaboTab(page, patientId);
      await patientRow(page, no).getByRole("button", { name: "Xem chi tiết" }).click();
      await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
      const dialog = slipDialog(page);
      const extra = section(dialog);
      await expect(extra.getByLabel("Mã labo", { exact: true })).toHaveValue("ML-02");
      await expect(extra.getByLabel("Mã labo", { exact: true })).toBeDisabled();
      await expect(dialog.getByLabel("Mẫu phiếu", { exact: true })).toBeDisabled();
      await expect(dialog.locator(".rs-extra-pick")).toContainText(template.name);
    });

    await test.step("In Phiếu Labo prints Thông tin bổ sung as the template lays it out (F-94)", async () => {
      await page.goto(`/labo?branchId=${BRANCH_ONE}`);
      const row = page.locator(".bd-labo-screen tbody tr.ant-table-row").filter({ hasText: no }).first();
      await row.getByRole("button", { name: "Xem", exact: true }).click();
      const sheet = page.locator(".pd-slip-print");
      await expect(sheet).toContainText(`Mã số: ${no}`);
      const extra = sheet.locator(".pd-slip-print-block").filter({ hasText: "Thông tin bổ sung" });
      await expect(extra).toHaveCount(1);
      await expect(extra).toContainText("Mã labo: ML-02");
      await expect(extra).toContainText("Hãng sứ: Emax");
      await expect(extra).toContainText("Phụ kiện: Trụ, Khay");
      await expect(extra).toContainText("Có mẫu hàm: Có");
      await expect(extra).toContainText(`Hạn bảo hành: ${day(30)}`);
      await expect(sheet).not.toContainText(template.name);
    });
  });
});
