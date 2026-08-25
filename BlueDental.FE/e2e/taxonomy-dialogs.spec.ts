import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: the per-catalog dialogs. The reference gives every catalog its own
 * form rather than one shared one, so each of these checks the field set it
 * actually offers and that what was typed comes back from the server.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

async function createGroup(page: Page, name: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();

  // Creating a group selects it. Wait for that: an entry dialog opened before
  // the selection lands would default to whichever group was selected before.
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function reopen(page: Page, rowName: string) {
  await page
    .getByRole("row", { name: new RegExp(rowName) })
    .getByRole("button")
    .nth(1)
    .click();
  return page.getByRole("dialog");
}

test.describe("Danh mục — dialog theo từng danh mục", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a service keeps its price configuration, stages and warranty", async ({ page }) => {
    const id = runId();
    const name = `DV CAU HINH ${id}`;

    await page.goto("/taxonomy/service");
    await createGroup(page, `NHOM DV ${id}`);

    await page.getByRole("button", { name: /Thêm dịch vụ$/ }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/^Dịch vụ/).fill(name);
    await dialog.getByLabel(/Tên chi tiết/).fill("Tên chi tiết E2E");
    await dialog.getByLabel(/^Giá$/).fill("1000");
    await dialog.getByLabel(/Giảm giá/).fill("10");
    await dialog.getByLabel(/^Đơn vị$/).fill("Răng");

    // 10% VAT, price quoted before tax
    await dialog.getByLabel(/% thuế/).click();
    await page.locator(".ant-select-item-option").filter({ hasText: /^10%$/ }).click();

    await dialog.getByLabel("Yêu cầu hình ảnh khi điều trị").check();
    await dialog.getByLabel("Hiển thị răng ở hóa đơn").check();

    await dialog.getByRole("tab", { name: "Công đoạn" }).click();
    await dialog.getByLabel("Tính doanh số trên công đoạn").check();
    await dialog.getByLabel(/^Công đoạn$/).fill("Lấy dấu");
    await dialog.getByRole("button", { name: "Công đoạn", exact: true }).click();
    await expect(dialog.getByRole("cell", { name: "Lấy dấu", exact: true })).toBeVisible();

    await dialog.getByRole("tab", { name: "Bảo hành" }).click();
    await dialog.getByLabel("Bảo hành 1 năm").check();

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

    // Everything comes back from the server, including the two boxes it works out.
    await page.reload();
    dialog = await reopen(page, name);

    await expect(dialog.getByLabel(/Tên chi tiết/)).toHaveValue("Tên chi tiết E2E");
    await expect(dialog.getByLabel(/^Đơn vị$/)).toHaveValue("Răng");
    await expect(dialog.getByLabel("Yêu cầu hình ảnh khi điều trị")).toBeChecked();
    await expect(dialog.getByLabel("Hiển thị răng ở hóa đơn")).toBeChecked();
    // 1000 − 10% = 900, then +10% VAT = 990.
    await expect(dialog.getByLabel(/Giá sau giảm/)).toHaveValue(/900/);
    await expect(dialog.getByLabel(/Thực thu từ khách/)).toHaveValue(/990/);

    await dialog.getByRole("tab", { name: "Công đoạn" }).click();
    await expect(dialog.getByRole("cell", { name: "Lấy dấu", exact: true })).toBeVisible();

    await dialog.getByRole("tab", { name: "Bảo hành" }).click();
    await expect(dialog.getByLabel("Bảo hành 1 năm")).toBeChecked();
    await expect(dialog.getByLabel("Không bảo hành")).not.toBeChecked();
  });

  test("a medicine keeps both prices and its ingredient", async ({ page }) => {
    const id = runId();
    const name = `THUOC ${id}`;

    await page.goto("/taxonomy/medicine");
    await createGroup(page, `NHOM THUOC ${id}`);

    await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên thuốc/).fill(name);
    await dialog.getByLabel(/Hoạt chất/).fill("Amoxicillin");
    await dialog.getByLabel(/Cách dùng/).fill("Uống sau ăn");
    await dialog.getByLabel(/Giá mua/).fill("8000");
    await dialog.getByLabel(/Giá bán/).fill("12000");
    await dialog.getByLabel(/Đơn vị tính/).fill("Viên");

    // This catalog is the one the reference gives no state checkboxes.
    await expect(dialog.getByLabel("Đang hoạt động")).toHaveCount(0);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.getByLabel(/Hoạt chất/)).toHaveValue("Amoxicillin");
    await expect(dialog.getByLabel(/Giá mua/)).toHaveValue("8000");
    await expect(dialog.getByLabel(/Giá bán/)).toHaveValue("12000");
  });

  test("a diagnosis keeps its rich-text body and its note", async ({ page }) => {
    const id = runId();
    const name = `CHAN DOAN ${id}`;

    await page.goto("/taxonomy/diagnosis");
    await createGroup(page, `NHOM CD ${id}`);

    await page.getByRole("button", { name: /Thêm chẩn đoán$/ }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên chẩn đoán/).fill(name);
    // The Quill editor is a contenteditable, not an input.
    await dialog.locator(".ql-editor").click();
    await page.keyboard.type("Nội dung tư vấn E2E");
    await dialog.getByLabel(/Ghi chú/).fill("Ghi chú E2E");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.locator(".ql-editor")).toContainText("Nội dung tư vấn E2E");
    await expect(dialog.getByLabel(/Ghi chú/)).toHaveValue("Ghi chú E2E");
  });

  test("a prescription template stores its lines and works out the quantity", async ({ page }) => {
    const id = runId();
    const medicine = `THUOC DON ${id}`;
    const template = `DON MAU ${id}`;

    // The line picker reads the branch's medicine catalog, so seed one first.
    await page.goto("/taxonomy/medicine");
    await createGroup(page, `NHOM DON ${id}`);
    await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên thuốc/).fill(medicine);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/taxonomy/prescription-template");
    await page.getByRole("button", { name: /Thêm đơn thuốc mẫu$/ }).click();
    dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên đơn thuốc mẫu/).fill(template);
    await dialog.getByLabel(/Lời dặn/).fill("Uống đủ liều");

    await dialog.getByLabel(/Tên thuốc/).click();
    await page.locator(".ant-select-item-option", { hasText: medicine }).click();
    await dialog.getByLabel("Ngày uống").fill("2");
    await dialog.getByLabel("Mỗi lần").fill("1.5");
    await dialog.getByLabel("Số ngày").fill("5");

    // "Số lượng" is derived, and the reference shows it disabled.
    const quantity = dialog.getByLabel("Số lượng");
    await expect(quantity).toBeDisabled();
    await expect(quantity).toHaveValue("15");

    await dialog.getByRole("button", { name: /^Sử dụng$/ }).click();
    await page.getByLabel("Sau khi ăn").check();
    await page.getByLabel("Trước khi ngủ").check();
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, template);
    await expect(dialog.getByLabel("Số lượng")).toHaveValue("15");
    await expect(dialog.getByRole("button", { name: /Sau khi ăn/ })).toContainText("Trước khi ngủ");
  });

  test("a medical record template stores the A4 sheet it was filled in with", async ({ page }) => {
    const id = runId();
    const name = `BENH AN ${id}`;

    await page.goto("/taxonomy/medical-record-template");
    await createGroup(page, `NHOM BA ${id}`);

    await page.getByRole("button", { name: /Thêm bệnh án mẫu$/ }).click();
    let dialog = page.getByRole("dialog");

    // The printed sheet is the dental outpatient record, not a blank form.
    await expect(dialog.getByRole("heading", { name: "BỆNH ÁN NGOẠI TRÚ" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "CHUYÊN KHOA RĂNG HÀM MẶT" })).toBeVisible();
    await expect(dialog.getByText("I. HÀNH CHÍNH:")).toBeVisible();
    await expect(dialog.getByText("Mạch:")).toBeVisible();
    await expect(dialog.getByText("TỔNG KẾT BỆNH ÁN:")).toBeVisible();
    await expect(dialog.getByText("Phân loại khe hở môi vòm miệng")).toBeVisible();

    // The vitals are a ruled box to the *right* of the examination notes, not a
    // row stacked under the section heading.
    const layout = await page.evaluate(() => {
      // The innermost element holding every vital is the ruled box itself —
      // a single row would only hold one of them.
      const box = [...document.querySelectorAll("[role=dialog] div")]
        .filter((el) => {
          const text = el.textContent ?? "";
          return text.includes("Mạch:") && text.includes("Cân nặng:");
        })
        .pop()!;
      const exam = document.querySelector<HTMLElement>(
        '[role=dialog] [aria-label="Nhập khám toàn thân..."]',
      )!;
      const b = box.getBoundingClientRect();
      const e = exam.getBoundingClientRect();

      // Each "Họ tên" of the handover table is written on a rule, and neither
      // heading in that column is allowed to wrap.
      const labels = [...document.querySelectorAll("[role=dialog] td p")].filter((el) =>
        /^Người (giao|nhận) hồ sơ:$/.test((el.textContent ?? "").trim()),
      );
      return {
        boxIsRightOfExam: b.left >= e.right,
        boxOverlapsExamBand: b.top < e.bottom + 60,
        boxHasBorder: getComputedStyle(box).borderTopWidth !== "0px",
        handoverLabels: labels.length,
        wrapped: labels.filter((el) => el.getBoundingClientRect().height > 26).length,
      };
    });
    expect(layout.boxIsRightOfExam).toBe(true);
    expect(layout.boxOverlapsExamBand).toBe(true);
    expect(layout.boxHasBorder).toBe(true);
    expect(layout.handoverLabels).toBe(2);
    expect(layout.wrapped, "the handover column is too narrow and its headings wrap").toBe(0);
    await expect(dialog.getByText("ĐẠI DIỆN CƠ SỞ KHÁM CHỮA BỆNH")).toBeVisible();

    await dialog.getByLabel(/Nhập tên mẫu bệnh án/).fill(name);
    await dialog.getByLabel("Nhập lý do vào viện...").fill("Đau răng số 36");
    await dialog.getByLabel("Nhập khám toàn thân...").fill("Thể trạng bình thường");
    // A cell on each of the other two pages, so all three are wired up.
    await dialog.getByLabel("Nhập bệnh chính...").fill("Sâu ngà răng 36");
    await dialog.getByLabel("Nhập tóm tắt bệnh án...").fill("Tóm tắt E2E");

    // The zoom control the reference puts above the sheet. A transform does not
    // change an element's layout box, so this also guards the sheet staying
    // centred instead of drifting to the left edge as it scales.
    await dialog.getByRole("button", { name: "Phóng to" }).click();
    await expect(dialog.getByText("100%")).toBeVisible();

    const margins = await page.evaluate(() => {
      const sheetPage = document.querySelector<HTMLElement>("[role=dialog] .bd-a4-page")!;
      const scroller = sheetPage.closest("div.bd-a4-viewport")!;
      const outer = scroller.getBoundingClientRect();
      const inner = sheetPage.getBoundingClientRect();
      return { left: inner.left - outer.left, right: outer.right - inner.right };
    });
    expect(Math.abs(margins.left - margins.right)).toBeLessThan(6);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.getByLabel("Nhập lý do vào viện...")).toHaveValue("Đau răng số 36");
    await expect(dialog.getByLabel("Nhập khám toàn thân...")).toHaveValue("Thể trạng bình thường");
    await expect(dialog.getByLabel("Nhập bệnh chính...")).toHaveValue("Sâu ngà răng 36");
    await expect(dialog.getByLabel("Nhập tóm tắt bệnh án...")).toHaveValue("Tóm tắt E2E");
  });
});
