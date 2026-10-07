import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân → Người giám hộ, in the browser (BA, 2026-10-07; R-773).
 *
 * A 9-year-old cannot be saved until a guardian is entered: the age chip, the
 * banner, the red dot and the footer note say so, and Lưu stays disabled.
 * "Nhập ngay" opens the popup; one guardian is typed in, a second is found by
 * phone among the existing hồ sơ ("Tìm & điền"), and "Lưu & quay lại hồ sơ"
 * hands both back as cards. Lưu writes them; after a reload the edit dialog
 * reads the same group back from the database.
 *
 * Real login, real API, real database; nothing is intercepted. The adult who is
 * found by the search is created through the real API first.
 */

const PATIENTS = "/api/v1/app/patients";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

/** An adult hồ sơ to be found by phone, made through the logged-in page. */
async function createAdult(page: Page, lastName: string, phone: string): Promise<void> {
  const status = await page.evaluate(
    async ({ url, branch, body }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify(body),
      });
      return res.status;
    },
    {
      url: PATIENTS,
      branch: BRANCH_ONE,
      body: { firstName: "Bố", lastName, gender: 1, phoneNumber: phone, dateOfBirth: "1985-03-10" },
    },
  );
  expect(status).toBe(200);
}

/** The hồ sơ's own Lưu — its icon makes the name "save Lưu"; never "Lưu & quay lại hồ sơ". */
const SAVE = /^(save )?Lưu$/;

const field = (scope: Locator, label: string) => scope.getByRole("textbox", { name: new RegExp(`^${label}`) });

test("an under-16 hồ sơ is saved only with its guardians, and reads them back", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, PATIENTS);

  const id = runId();
  const childName = `E2E ${id} Giám Hộ`;
  const fatherPhone = `03${id}88`;
  await createAdult(page, `E2E ${id}`, fatherPhone);

  await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
  const editor = page.getByRole("dialog", { name: "Tạo hồ sơ" });
  await field(editor, "Họ và tên").fill(childName);
  await field(editor, "Điện thoại").fill(`09${id}66`);

  // Born nine years ago (by year): the chip in Ngày sinh reads the age.
  const dob = editor.getByRole("textbox", { name: "Ngày sinh" });
  await dob.click();
  await page.keyboard.type(`1506${new Date().getFullYear() - 9}`);
  await field(editor, "Họ và tên").click();
  await expect(editor.locator(".bd-patient-agechip")).toHaveText("9 tuổi");

  // Everything that says a guardian is missing, and Lưu held back.
  const pill = editor.getByRole("tab", { name: /Người giám hộ/ });
  await expect(pill.getByLabel("Chưa có người giám hộ")).toBeVisible();
  const banner = editor.getByRole("alert").filter({ hasText: "Khách hàng dưới 16 tuổi" });
  await expect(banner).toBeVisible();
  await expect(editor.getByText("Chưa có thông tin người giám hộ")).toBeVisible();
  await expect(editor.getByRole("button", { name: SAVE })).toBeDisabled();

  // The third pill fits on the row beside the other two, dot included.
  const rows = await editor
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
  expect(new Set(rows).size, "the three pills share one row").toBe(1);

  // "Nhập ngay" opens the popup over the hồ sơ.
  await banner.getByRole("button", { name: "Nhập ngay" }).click();
  const popup = page.getByRole("dialog", { name: /Thông tin người giám hộ/ });
  await expect(popup).toBeVisible();
  await expect(popup.locator(".bd-guardian-crumb")).toContainText("Tạo hồ sơ");
  await expect(popup.locator(".bd-guardian-agechip--required")).toHaveText("9 tuổi · Bắt buộc có người giám hộ");

  // Nothing filled: the errors sit under the inputs and the popup stays.
  await popup.getByRole("button", { name: "Lưu & quay lại hồ sơ" }).click();
  await expect(popup.getByText("Vui lòng nhập họ và tên")).toBeVisible();
  await expect(popup.getByText("Vui lòng xác nhận đồng ý thăm khám, điều trị")).toBeVisible();

  // Guardian 1, typed in.
  await popup.getByRole("radio", { name: "Mẹ" }).click();
  await field(popup, "Họ và tên").fill(`Mẹ E2E ${id}`);
  await field(popup, "Điện thoại").fill(`07${id}11`);
  await field(popup, "CCCD").fill(`0791${id}11`);

  // Guardian 2, found by phone among the existing hồ sơ.
  await popup.getByRole("button", { name: "Thêm người giám hộ thứ 2" }).click();
  await expect(popup.getByText("NHÓM NGƯỜI GIÁM HỘ (2)")).toBeVisible();
  await expect(popup.getByText("2 người giám hộ trong nhóm")).toBeVisible();
  const second = popup.locator(".ant-collapse-item").nth(1);
  await second.getByRole("textbox", { name: "Tìm người giám hộ đã có hồ sơ" }).fill(fatherPhone);
  await second.getByRole("button", { name: "Tìm & điền" }).click();
  await expect(field(second, "Điện thoại")).toHaveValue(fatherPhone);
  await expect(field(second, "Họ và tên")).toHaveValue(new RegExp(`E2E ${id}`, "i"));
  await second.getByRole("radio", { name: "Bố" }).click();
  await field(second, "CCCD").fill(`0791${id}22`);

  await popup.getByRole("checkbox", { name: /Các người giám hộ xác nhận/ }).check();
  await popup.getByRole("button", { name: "Lưu & quay lại hồ sơ" }).click();
  await expect(popup).toBeHidden();

  // Back on the hồ sơ: the ✓, two cards, the first one the primary contact, Lưu free.
  await expect(pill.getByLabel("Đã có người giám hộ")).toBeVisible();
  await expect(banner).toBeHidden();
  const cards = editor.locator(".bd-guardian-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText(`Mẹ E2E ${id}`);
  await expect(cards.first()).toContainText("Liên hệ chínhCó");
  await expect(cards.nth(1)).toContainText(fatherPhone);
  await editor.getByRole("button", { name: SAVE }).click();
  await expect(editor).toBeHidden({ timeout: 15_000 });

  // After a reload the edit dialog reads the group back from the database.
  await page.reload();
  await page.getByRole("button", { name: `Chỉnh sửa ${childName.toUpperCase()}` }).click();
  const reopened = page.getByRole("dialog", { name: "Chỉnh sửa hồ sơ" });
  await reopened.getByRole("tab", { name: /Người giám hộ/ }).click();
  const saved = reopened.locator(".bd-guardian-card");
  await expect(saved).toHaveCount(2);
  await expect(saved.first()).toContainText(`Mẹ E2E ${id}`);
  await expect(saved.first()).toContainText("Đã xác nhận");
  await expect(saved.nth(1)).toContainText(fatherPhone);
  await expect(reopened.getByRole("button", { name: SAVE })).toBeEnabled();
});
