import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Labo.
 *
 * Six sub-screens, each its own URL. Every assertion here runs against the real
 * backend and the real database — no interception, no seeded fixtures beyond
 * what DbMigrator writes — so a green run is evidence the whole path works.
 */

/** The tab row, and where each tab lands. */
const TABS = [
  { label: "Mẫu Labo", path: "/labo/mau-labo" },
  { label: "Nhà cung cấp Labo", path: "/labo/supplier" },
  { label: "Khớp cắn Labo", path: "/labo/bite" },
  { label: "Đường hoàn tất", path: "/labo/finish-line" },
  { label: "Kiểu nhịp Labo", path: "/labo/nhip" },
  { label: "Dịch vụ - vật liệu", path: "/labo/service-material" },
];

/** Row of the catalog table carrying the given name. */
function catalogRow(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

test.describe("Labo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("/labo opens Mẫu Labo and lists orders from the server", async ({ page }) => {
    await page.goto("/labo");

    await assertRealApiTraffic(page, "/labo-orders");
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");

    // The reference gives this screen four filters and, deliberately, no create
    // button — a labo order is raised from the patient's own screen.
    for (const label of ["Tất Cả Mẫu", "Mẫu Chưa Nhận", "Mẫu Giao Trễ", "Mẫu Đã Nhận Hàng"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Tạo mẫu Labo/i })).toHaveCount(0);
  });

  test("every tab is its own route and loads its own screen", async ({ page }) => {
    await page.goto("/labo");

    for (const tab of TABS) {
      await page.getByRole("link", { name: tab.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tab.path}(\\?|$)`));
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    }
  });

  test("a sub-route can be opened directly and comes back after a reload", async ({ page }) => {
    await page.goto("/labo/nhip");
    await expect(page.getByRole("button", { name: /Tạo kiểu nhịp/ })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/labo\/nhip/);
    await expect(page.getByRole("button", { name: /Tạo kiểu nhịp/ })).toBeVisible();
  });

  test("the Mẫu Chưa Nhận filter re-queries the server", async ({ page }) => {
    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/labo-orders");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-orders")) requests.push(req.url());
    });

    await page.getByRole("button", { name: "Mẫu Chưa Nhận" }).click();

    // The filter is applied by the server, not by narrowing the fetched page.
    await expect
      .poll(() => requests.some((url) => url.includes("sampleFilter=1")))
      .toBeTruthy();
  });

  test("Khớp cắn survives create, rename, reload and delete", async ({ page }) => {
    const name = `Khớp cắn E2E ${runId()}`;
    const renamed = `${name} (đã sửa)`;

    await page.goto("/labo/bite");
    await assertRealApiTraffic(page, "/taxonomies");

    // ── Create ───────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /Tạo khớp cắn/ }).click();
    await page.getByRole("textbox", { name: /Tên khớp cắn/ }).fill(name);
    await page.getByRole("button", { name: /^save Lưu$|^Lưu$/ }).click();

    await expect(catalogRow(page, name)).toBeVisible();

    // The reference lists these newest-first, so a new row lands at the top.
    await expect(page.getByRole("row").nth(1)).toContainText(name);

    // ── Rename ───────────────────────────────────────────────────────────
    await catalogRow(page, name).getByRole("button", { name: "Chỉnh sửa" }).click();
    await page.getByRole("textbox", { name: /Tên khớp cắn/ }).fill(renamed);
    await page.getByRole("button", { name: /^save Lưu$|^Lưu$/ }).click();

    await expect(catalogRow(page, renamed)).toBeVisible();

    // ── Persisted, not just held in the client ───────────────────────────
    await page.reload();
    await expect(catalogRow(page, renamed)).toBeVisible();

    // ── Delete ───────────────────────────────────────────────────────────
    await catalogRow(page, renamed).getByRole("button", { name: "Xoá" }).click();
    await expect(page.getByRole("dialog")).toContainText(renamed);
    // antd folds the button's icon into its accessible name ("delete Xoá").
    await page.getByRole("dialog").getByRole("button", { name: /Xoá$/ }).click();

    await expect(catalogRow(page, renamed)).toHaveCount(0);

    await page.reload();
    await expect(catalogRow(page, renamed)).toHaveCount(0);
  });

  test("the Khớp cắn search runs on the server", async ({ page }) => {
    await page.goto("/labo/bite");
    await assertRealApiTraffic(page, "/taxonomies");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/taxonomies")) requests.push(req.url());
    });

    await page.getByRole("textbox", { name: /Tìm kiếm khớp cắn/ }).fill("khôngtồntại");

    // A client-side filter would narrow only the page already fetched.
    await expect.poll(() => requests.some((url) => url.includes("Filter="))).toBeTruthy();
    await expect(page.locator("tbody")).toContainText("Không tìm thấy kết quả phù hợp");
  });

  test("a row names its customer, dentist and material, not just their ids", async ({ page }) => {
    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/labo-orders");

    // The filters above the table work by id, so these columns went on reading
    // "—" for every row while the filtering itself looked fine.
    const first = page.getByRole("row").nth(1);
    await expect(first).toBeVisible();

    for (const column of [1, 4, 5]) {
      await expect(first.getByRole("cell").nth(column)).not.toHaveText("—");
    }
  });

  test("the period picker sends a range only once a mode is chosen", async ({ page }) => {
    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/labo-orders");

    // Until a mode is picked there is nothing to send, and the reference
    // leaves its own button disabled to say so.
    await expect(page.getByRole("button", { name: /Chọn thời gian/ })).toBeDisabled();

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-orders")) requests.push(req.url());
    });

    await page.getByRole("button", { name: "Ngày", exact: true }).click();

    await expect
      .poll(() => requests.some((url) => url.includes("fromDate=") && url.includes("toDate=")))
      .toBeTruthy();
    // The button is replaced by a stepper around the day being read.
    await expect(page.getByRole("button", { name: /Chọn thời gian/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ngày kế tiếp" })).toBeVisible();
  });

  test("Nhà cung cấp Labo lists suppliers and searches on the server", async ({ page }) => {
    await page.goto("/labo/supplier");

    await assertRealApiTraffic(page, "/labo-suppliers");
    await expect(page.getByRole("columnheader", { name: "Tên labo" })).toBeVisible();

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-suppliers")) requests.push(req.url());
    });

    await page.getByRole("textbox", { name: /Tìm kiếm Labo/ }).fill("khôngtồntại");

    await expect.poll(() => requests.some((url) => url.includes("Filter="))).toBeTruthy();
    await expect(page.locator("tbody")).toContainText("Không tìm thấy kết quả phù hợp");
  });

  test("the supplier dialog asks for everything the reference asks for", async ({ page }) => {
    await page.goto("/labo/supplier");
    await assertRealApiTraffic(page, "/labo-suppliers");

    await page.getByRole("button", { name: /Tạo nhà cung cấp/ }).click();

    const dialog = page.getByRole("dialog");
    for (const label of [
      /Tên nhà cung cấp/,
      /^Email/,
      /Số điện thoại/,
      /Người liên hệ/,
      /Mã số thuế/,
      /Tỉnh\/ Thành phố/,
      /Xã\/ Phường/,
      /Địa chỉ/,
    ]) {
      await expect(dialog.getByText(label).first()).toBeVisible();
    }

    // The reference greys its save out until both name and email are filled.
    const save = dialog.getByRole("button", { name: /Lưu/ });
    await expect(save).toBeDisabled();
    await dialog.getByRole("textbox", { name: /Tên nhà cung cấp/ }).fill("Labo E2E");
    await expect(save).toBeDisabled();
    await dialog.getByRole("textbox", { name: /^Email/ }).fill("labo.e2e@test.local");
    await expect(save).toBeEnabled();
  });

  test("a supplier logo is uploaded, stored and served back", async ({ page }) => {
    await page.goto("/labo/supplier");
    await assertRealApiTraffic(page, "/labo-suppliers");

    await page.getByRole("button", { name: /^Chỉnh sửa/ }).first().click();
    const dialog = page.getByRole("dialog");

    // A 2×2 PNG is enough to prove the round trip.
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "labo-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FAP2FCP1zqZmiAAAAAElFTkSuQmCC",
        "base64",
      ),
    });

    // Picking one shows it and offers to take it away again.
    await expect(dialog.locator(".bd-labo-avatar-btn img")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Xóa ảnh/ })).toBeVisible();

    const upload = page.waitForResponse(
      (res) => res.url().includes("/logo") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    expect((await upload).ok()).toBeTruthy();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Reopened, the logo comes back from the server, not from the browser.
    await page.reload();
    await page.getByRole("button", { name: /^Chỉnh sửa/ }).first().click();

    const logo = page.getByRole("dialog").locator(".bd-labo-avatar-btn img");
    await expect(logo).toHaveAttribute("src", /\/labo-suppliers\/.+\/logo$/);
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Put the supplier back as it was found.
    await page.getByRole("dialog").getByRole("button", { name: /Xóa ảnh/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Lưu/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
  });

  test("Dịch vụ - vật liệu puts its groups beside its materials", async ({ page }) => {
    await page.goto("/labo/service-material");

    await assertRealApiTraffic(page, "/labo-materials");

    // The group panel, and a material carrying the group it is filed under.
    await expect(page.getByRole("columnheader", { name: "Nhóm phân loại" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Vật liệu" })).toBeVisible();

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-materials")) requests.push(req.url());
    });

    // Picking a group narrows the table through the server, not in the browser.
    await page.locator("[data-group-row]").first().locator("button").first().click();

    await expect.poll(() => requests.some((url) => url.includes("TaxonomyId="))).toBeTruthy();
  });

  test("the material search runs on the server", async ({ page }) => {
    await page.goto("/labo/service-material");
    await assertRealApiTraffic(page, "/labo-materials");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-materials")) requests.push(req.url());
    });

    await page.getByRole("textbox", { name: /Tìm kiếm vật liệu/ }).fill("khôngtồntại");

    await expect.poll(() => requests.some((url) => url.includes("Filter="))).toBeTruthy();
    await expect(page.locator("tbody")).toContainText("Không tìm thấy kết quả phù hợp");
  });

  test("the create dialog does not clip its focused field", async ({ page }) => {
    await page.goto("/labo/nhip");

    await page.getByRole("button", { name: /Tạo kiểu nhịp/ }).click();
    const input = page.getByRole("textbox", { name: /Tên kiểu nhịp/ });
    await input.focus();

    // The body scrolls, so with no room under the last field its focus ring is
    // clipped and the field reads as cut in half. Polled because the dialog
    // scales in, and mid-animation every rect is smaller than it settles at.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const body = document.querySelector(".app-dialog .ant-modal-body");
          const field = document.querySelector(".app-dialog .floating-field");
          if (!body || !field) return -1;
          return body.getBoundingClientRect().bottom - field.getBoundingClientRect().bottom;
        }),
      )
      .toBeGreaterThanOrEqual(3);
  });
});
