import { test, type Locator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

const OUT = process.env.MEASURE_OUT ?? "test-results";

async function fill(page: Page, dialog: Locator) {
  await dialog.getByLabel("Tên thuốc", { exact: true }).fill("Paracetamol");
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await dialog.getByRole("button", { name: /^Sử dụng$/ }).click();
  await page.getByLabel("Sau khi ăn").check();
  await page.getByLabel("Trong khi ăn").check();
  await page.getByRole("button", { name: /Lưu$/ }).last().click();
  await page.waitForTimeout(800);
}

async function measure(dialog: Locator) {
  return dialog.evaluate((el) => {
    const holder = el.querySelector(".bd-rx-table .ant-table-content") as HTMLElement;
    const ths = [...el.querySelectorAll(".bd-rx-table thead th")].map((th) =>
      Math.round(th.getBoundingClientRect().width),
    );
    return { holderClient: holder.clientWidth, holderScroll: holder.scrollWidth, ths };
  });
}

for (const width of [1472, 1280, 1100]) {
  test(`template dialog @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto("/taxonomy/prescription-template");
    await page.getByRole("button", { name: /Thêm đơn thuốc mẫu/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".bd-rx-table").waitFor();
    await page.waitForTimeout(800);
    await fill(page, dialog);
    console.log(`template@${width}`, JSON.stringify(await measure(dialog)));
    await page.screenshot({ path: `${OUT}/rx-template-${width}.png` });
  });
}

for (const width of [1472, 1280]) {
  test(`prescription dialog @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto("/patient");
    const id = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/patients?maxResultCount=1", {
        credentials: "include",
        headers: { Accept: "application/json", "X-Clinic-Branch-Id": "3a1c9b2e-0000-4000-8000-000000000001" },
      });
      return ((await res.json()).items[0]?.id ?? "") as string;
    });
    await page.goto(`/patient/${id}?tab=prescription&create=true`);
    const dialog = page.getByRole("dialog");
    await dialog.locator(".bd-rx-table").waitFor();
    await page.waitForTimeout(800);
    await fill(page, dialog);
    console.log(`rx@${width}`, JSON.stringify(await measure(dialog)));
    await dialog.locator(".bd-rx-table").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/rx-dialog-${width}.png` });
  });
}
