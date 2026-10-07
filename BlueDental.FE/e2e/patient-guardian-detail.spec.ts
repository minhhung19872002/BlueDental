import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: patient detail → Hồ sơ tab → "NGƯỜI GIÁM HỘ (n)" (BA mock 2026-10-07; R-777).
 *
 * A 9-year-old with one guardian: the "Dưới 16 tuổi" chip, the section with
 * its count, the primary card open with its consent line, and its trash off
 * (the last guardian of an under-16 record). + opens the "Thông tin người giám
 * hộ" popup on a new guardian, the pencil on an existing one, the trash asks
 * first — and each one is written at once. A reload reads the group back.
 *
 * Real login, real API, real database; nothing is intercepted. The child is
 * created through the real API first.
 */

const PATIENTS = "/api/v1/app/patients";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

/** A 9-year-old with one primary guardian, made through the logged-in page. */
async function createChild(page: Page, id: string): Promise<string> {
  const result = await page.evaluate(
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
      return { status: res.status, body: (await res.json()) as { id?: string } };
    },
    {
      url: PATIENTS,
      branch: BRANCH_ONE,
      body: {
        firstName: "Giám Hộ",
        lastName: `E2E ${id}`,
        gender: 1,
        phoneNumber: `07${id}11`,
        dateOfBirth: `${new Date().getFullYear() - 9}-06-15`,
        guardiansConsented: true,
        guardians: [
          {
            relation: 2,
            fullName: `Mẹ E2E ${id}`,
            phone: `07${id}11`,
            nationalId: `0791${id}11`,
            sameAddressAsPatient: true,
            isPrimaryContact: true,
          },
        ],
      },
    },
  );
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.id!;
}

const field = (scope: Locator, label: string) => scope.getByRole("textbox", { name: new RegExp(`^${label}`) });

test("the Hồ sơ tab adds, edits and deletes guardians, each written at once", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, PATIENTS);

  const id = runId();
  const patientId = await createChild(page, id);
  await page.goto(`/patient/${patientId}?branchId=${BRANCH_ONE}&tab=profile`);

  // The child's header and phone say who they belong to.
  await expect(page.locator(".pd-underage-chip")).toHaveText("Dưới 16 tuổi");
  await expect(page.locator(".pd-phone-owner")).toHaveText(`SĐT của Mẹ - Mẹ E2E ${id}`);

  const section = page.getByRole("region", { name: "Người giám hộ" });
  const count = section.locator(".pd-guardians-count");
  const cards = section.locator("article.pd-guardian");
  await expect(count).toHaveText("1");
  const mother = cards.first();
  await expect(mother).toContainText(`Mẹ E2E ${id}`);
  await expect(mother).toContainText("Liên hệ chính");
  // No chevron: the card itself is the toggle; its name block carries the state.
  await expect(mother.locator(".pd-guardian-who")).toHaveAttribute("aria-expanded", "true");
  await expect(mother.locator(".pd-guardian-consent")).toContainText("Đã xác nhận đồng ý điều trị");
  // The only guardian of an under-16 record cannot be removed.
  await expect(mother.getByRole("button", { name: "Xoá" })).toBeDisabled();

  // + opens the popup on a new, second guardian.
  await section.getByRole("button", { name: "Thêm người giám hộ" }).click();
  const popup = page.getByRole("dialog", { name: /Thông tin người giám hộ/ });
  await expect(popup).toBeVisible();
  await expect(popup.getByText("NHÓM NGƯỜI GIÁM HỘ (2)")).toBeVisible();
  const second = popup.locator(".ant-collapse-item").nth(1);
  await second.getByRole("radio", { name: "Bố" }).click();
  await field(second, "Họ và tên").fill(`Bố E2E ${id}`);
  await field(second, "Điện thoại").fill(`03${id}22`);
  await field(second, "CCCD").fill(`0791${id}22`);
  await popup.getByRole("button", { name: "Lưu & quay lại hồ sơ" }).click();
  await expect(popup).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Đã cập nhật người giám hộ")).toBeVisible();
  await expect(count).toHaveText("2");

  // The new one is folded; the mother's trash is free now.
  const father = cards.nth(1);
  await expect(father).toContainText(`Bố E2E ${id}`);
  await expect(father.locator(".pd-guardian-who")).toHaveAttribute("aria-expanded", "false");
  await expect(section.locator(".pd-guardian-toggle")).toHaveCount(0);
  await expect(mother.getByRole("button", { name: "Xoá" })).toBeEnabled();

  // A click anywhere on a card folds or unfolds it, not just on the chevron.
  await father.getByText(`Bố E2E ${id}`).click();
  await expect(father.locator(".pd-guardian-who")).toHaveAttribute("aria-expanded", "true");
  await expect(father.locator(".pd-guardian-facts")).toBeVisible();
  await mother.locator(".pd-guardian-consent").click();
  await expect(mother.locator(".pd-guardian-facts")).toBeHidden();
  // From the keyboard: Enter on the name block unfolds it again.
  await mother.locator(".pd-guardian-who").press("Enter");
  await expect(mother.locator(".pd-guardian-facts")).toBeVisible();

  // The pencil opens the popup on that guardian.
  await father.getByRole("button", { name: "Sửa" }).click();
  await expect(popup).toBeVisible();
  const editing = popup.locator(".ant-collapse-item").nth(1);
  await expect(field(editing, "Họ và tên")).toHaveValue(`Bố E2E ${id}`);
  await field(editing, "Họ và tên").fill(`Ba E2E ${id}`);
  await popup.getByRole("button", { name: "Lưu & quay lại hồ sơ" }).click();
  await expect(popup).toBeHidden({ timeout: 15_000 });
  await expect(cards.nth(1)).toContainText(`Ba E2E ${id}`);
  // The pencil opened the popup without folding the card behind it.
  await expect(cards.nth(1).locator(".pd-guardian-facts")).toBeVisible();

  // The trash asks first, then writes.
  await cards.nth(1).getByRole("button", { name: "Xoá" }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: `Ba E2E ${id}` });
  await confirm.getByRole("button", { name: /Xoá|Xóa/ }).last().click();
  await expect(page.getByText("Đã xoá người giám hộ")).toBeVisible();
  await expect(count).toHaveText("1");

  // A reload reads the same group back from the database.
  await page.reload();
  await expect(count).toHaveText("1");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(`Mẹ E2E ${id}`);
  await expect(cards.first()).toContainText("Liên hệ chính");
});
