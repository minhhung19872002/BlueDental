import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: patient detail → "Chỉnh sửa hồ sơ" → pill "Gia đình & Quan hệ"
 * (owner, 2026-10-09; R-914). Replaces the record's own family tab.
 *
 * A 9-year-old with one guardian: the "Dưới 16 tuổi" chip and the phone note
 * stay on the Hồ sơ tab; the guardians sit, as people, in the one list of the
 * editor's third pill (owner, 2026-10-12). A guardian added there is staged
 * with the editor and written by its Lưu. A reload reads the group back.
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

/** Opens the hồ sơ editor, then its "Gia đình & Quan hệ" dialog. */
async function openFamily(page: Page) {
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  const editor = page.getByRole("dialog", { name: "Chỉnh sửa hồ sơ" });
  await editor.getByRole("button", { name: /^Gia đình & Quan hệ/ }).click();
  const family = page.getByRole("dialog", { name: /^Gia đình & Quan hệ — / });
  await expect(family).toBeVisible();
  return { editor, family };
}

test("the editor's Gia đình & Quan hệ pill opens the guardians, relations and groups in a dialog", async ({ page }) => {
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
  // The record has no family tab of its own any more.
  await expect(page.getByRole("link", { name: "Gia đình & Quan hệ" })).toHaveCount(0);

  const { editor, family } = await openFamily(page);
  // The three pills share one row, the family one included.
  const rows = await editor
    .locator(".bd-patient-subtab")
    .evaluateAll((pills) => pills.map((pill) => Math.round(pill.getBoundingClientRect().top)));
  expect(rows).toHaveLength(3);
  expect(new Set(rows).size, "the three pills share one row").toBe(1);

  const people = family.getByRole("region", { name: "Người nhà & quan hệ" });
  const guardianRows = people.locator(".pf-relation", { hasText: "Người giám hộ" });
  await expect(people.locator(".pf-section__count")).toHaveText("1");
  await expect(guardianRows).toHaveCount(1);
  await expect(guardianRows.first()).toContainText(`Mẹ E2E ${id}`);
  await expect(guardianRows.first()).toContainText("Liên hệ chính");
  await expect(family.getByRole("region", { name: "Hồ sơ nhóm" })).toBeVisible();

  // A second guardian: the popup comes up over the family dialog.
  await people.getByRole("button", { name: "Thêm người giám hộ" }).click();
  const popup = page.getByRole("dialog", { name: /Thông tin người giám hộ/ });
  await expect(popup).toBeVisible();
  await expect(popup.getByText("NHÓM NGƯỜI GIÁM HỘ (2)")).toBeVisible();
  const second = popup.locator(".ant-collapse-item").nth(1);
  await second.getByRole("radio", { name: "Bố" }).click();
  await field(second, "Họ và tên").fill(`Bố E2E ${id}`);
  await field(second, "Điện thoại").fill(`03${id}22`);
  await field(second, "CCCD").fill(`0791${id}22`);
  await popup.getByRole("button", { name: "Lưu & quay lại hồ sơ" }).click();
  await expect(popup).toBeHidden();
  await expect(people.locator(".pf-section__count")).toHaveText("2");
  await expect(guardianRows.nth(1)).toContainText(`Bố E2E ${id}`);
  await expect(guardianRows.nth(1)).toContainText("Chưa lưu");

  // Closing the dialog keeps the pair staged; the editor's Lưu writes it.
  await family.locator(".ant-modal-close").click();
  await expect(family).toBeHidden();
  await expect(editor.getByRole("button", { name: /^Gia đình & Quan hệ/ }).getByLabel("Đã có người giám hộ")).toBeVisible();
  await editor.getByRole("button", { name: /^(save )?Lưu$/ }).click();
  await expect(editor).toBeHidden({ timeout: 15_000 });

  // A reload reads the same group back from the database.
  await page.reload();
  const reopened = await openFamily(page);
  const saved = reopened.family.locator(".pf-relation", { hasText: "Người giám hộ" });
  await expect(saved).toHaveCount(2);
  await expect(saved.first()).toContainText(`Mẹ E2E ${id}`);
  await expect(saved.nth(1)).toContainText(`Bố E2E ${id}`);
});
