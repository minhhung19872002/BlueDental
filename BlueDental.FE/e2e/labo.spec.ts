import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Mẫu Labo.
 *
 * The rule worth protecting is "Mẫu Giao Trễ": a sample counts as late only
 * while it is out at the lab past its due date. Once it comes back it is not
 * late any more, however long it took.
 */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

async function seedOrder(
  page: import("@playwright/test").Page,
  provider: string,
  dueDate: string,
) {
  return page.evaluate(
    async ({ branchId, labProviderName, due }) => {
      const patients = await fetch("/api/v1/app/patients?maxResultCount=1").then((r) => r.json());

      const res = await fetch("/api/v1/app/labo-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patients.items?.[0]?.id,
          branchId,
          labProviderName,
          toothNumbers: "36",
          estimatedCost: 1500000,
          dueDate: due,
          kind: 1,
        }),
      });

      const body = await res.json();
      return { status: res.status, id: body.id as string };
    },
    { branchId: BRANCH_ONE, labProviderName: provider, due: dueDate },
  );
}

test.describe("Labo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a sample sent past its due date reads as late until it comes back", async ({ page }) => {
    const provider = `Labo E2E ${runId()}`;

    await page.goto("/labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // Due yesterday, so it is late the moment it leaves the clinic.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const created = await seedOrder(page, provider, yesterday.toISOString().slice(0, 10));
    expect(created.status).toBe(200);

    await page.reload();

    const row = page.getByRole("row", { name: new RegExp(provider) });
    await expect(row).toBeVisible();

    // A draft has not been sent, so it is not late yet.
    await expect(row).toContainText("Chưa gửi");

    await row.getByRole("button", { name: "Gửi mẫu" }).click();
    await expect(row).toContainText("Chưa nhận");
    await expect(row).toContainText("trễ");

    await expect(page.getByRole("button", { name: /Mẫu Giao Trễ \(\d+\)/ })).toBeVisible();

    // Receiving it clears the lateness — the sample is back.
    await row.getByRole("button", { name: "Nhận hàng" }).click();
    await expect(row).toContainText("Đã nhận hàng");
    await expect(row).not.toContainText("trễ");

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(provider) })).toContainText("Đã nhận hàng");
  });

  test("the Mẫu Chưa Nhận chip only lists samples still out", async ({ page }) => {
    await page.goto("/labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/app/labo-orders?")) requests.push(req.url());
    });

    await page.getByRole("button", { name: /Mẫu Chưa Nhận/ }).click();

    // sampleFilter=1 is AwaitingReturn in BlueDental.Labo.LaboSampleFilter.
    await expect.poll(() => requests.some((url) => url.includes("sampleFilter=1"))).toBe(true);

    for (const row of await page.locator("tr.ant-table-row").all()) {
      await expect(row).toContainText("Chưa nhận");
    }
  });
});
