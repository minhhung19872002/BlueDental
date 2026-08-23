import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Chăm sóc khách hàng (CSKH).
 *
 * The rule under test is the care lifecycle: a task starts as "Chưa chăm sóc",
 * only counts as success once an outcome is recorded, and cannot be re-actioned
 * afterwards. All of that is server state.
 */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

/** Creates a care task for the first patient via the real API. */
async function seedCareRecord(page: import("@playwright/test").Page, subject: string) {
  return page.evaluate(
    async ({ branchId, careSubject }) => {
      const patients = await fetch("/api/v1/app/patients?maxResultCount=1").then((r) => r.json());
      const patientId = patients.items?.[0]?.id;

      const res = await fetch("/api/v1/app/care-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          branchId,
          type: 1, // Sau điều trị
          subject: careSubject,
          dueAt: new Date().toISOString(),
        }),
      });

      return res.status;
    },
    { branchId: BRANCH_ONE, careSubject: subject },
  );
}

test.describe("CSKH", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a care task moves from Chưa CS to Thành công and updates the counters", async ({ page }) => {
    await page.goto("/cskh-grouping");
    await assertRealApiTraffic(page, "/api/v1/app/care-records");

    const readCounter = async (label: string) => {
      const button = page.getByRole("button", { name: new RegExp(`\\d+\\s*${label}`) });
      const text = await button.innerText();
      return Number(text.replace(/[^\d]/g, "") || 0);
    };

    const totalBefore = await readCounter("Tổng khách");
    const succeededBefore = await readCounter("Thành công");

    expect(await seedCareRecord(page, `CSKH E2E ${runId()}`)).toBe(200);
    await page.reload();

    await expect.poll(() => readCounter("Chưa CS")).toBeGreaterThan(0);
    expect(await readCounter("Tổng khách")).toBeGreaterThanOrEqual(totalBefore);

    const row = page.locator("tr.ant-table-row").first();
    await expect(row).toContainText("Chưa chăm sóc");

    await row.getByRole("button", { name: "Thành công" }).click();

    await expect(row).toContainText("Thành công");
    await expect(row).toContainText("Tốt");
    await expect.poll(() => readCounter("Thành công")).toBe(succeededBefore + 1);

    // A closed task offers no further outcome actions.
    await expect(row.getByRole("button", { name: "Thất bại" })).toHaveCount(0);

    // Server state, not component state.
    await page.reload();
    await expect(page.locator("tr.ant-table-row").first()).toContainText("Thành công");
  });

  test("switching care programme re-queries the server", async ({ page }) => {
    await page.goto("/cskh-grouping");
    await assertRealApiTraffic(page, "/api/v1/app/care-records");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/app/care-records")) requests.push(req.url());
    });

    await page.getByRole("button", { name: "Chúc mừng sinh nhật" }).click();

    // type=2 is Birthday in BlueDental.CustomerCare.CareType.
    await expect.poll(() => requests.some((url) => url.includes("type=2"))).toBe(true);
  });
});
