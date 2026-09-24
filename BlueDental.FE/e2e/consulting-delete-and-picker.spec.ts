import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Chẩn đoán & Tư vấn — "Xoá phiếu chẩn đoán" / "Xoá dịch vụ tư vấn"
 * delete for good, and "Chọn Dịch Vụ" lists its services from the server per
 * group. Read off the reference's published bundle 2026-09-24:
 * `patientDiagnosisApi.delete` → "Đã xoá chẩn đoán", `patientAdviseApi.delete`
 * → "Đã xoá dịch vụ", and `careServiceApi.list({ taxonomyId, search, page,
 * perPage: 20 })` behind the "Lựa chọn dịch vụ" strip.
 *
 * Real stack: fixtures go through the real API with the session the login
 * screen gave; nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const BRANCH2 = "22222222-2222-2222-2222-222222222222";
const ADVISE_CONVERTED = 3;

interface Fixture {
  patientId: string;
  diagnosisId: string;
  diagnosisCode: string;
  adviseId: string;
  serviceName: string;
}

/** A fresh diagnosis slip on a branch-1 patient, with one consulting line under it. */
async function seedSlip(page: Page, note: string): Promise<Fixture> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const made = await page.evaluate(
    async ({ branch, text }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      // The branch header already scopes the list to branch 1.
      const patient = (await get("/api/v1/app/patients?maxResultCount=1")).items[0];
      const diagnosis = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)).items[0];
      const service = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)).items[0];
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = { toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false };

      const slipRes = await fetch("/api/v1/app/patient-diagnoses", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          patientId: patient.id,
          clinicBranchId: branch,
          diagnosisId: diagnosis.id,
          staffId: staff.id,
          note: text,
          teeth: [tooth],
        }),
      });
      if (!slipRes.ok) return { error: `diagnosis ${slipRes.status} ${await slipRes.text()}` };
      const slip = await slipRes.json();

      const adviseRes = await fetch("/api/v1/app/patient-advises", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          patientId: patient.id,
          clinicBranchId: branch,
          patientDiagnosisId: slip.id,
          diagnosisId: diagnosis.id,
          serviceId: service.id,
          staffId: staff.id,
          originalPrice: service.price ?? 0,
          price: service.price ?? 0,
          quantity: 1,
          discountType: 0,
          discountValue: 0,
          note: text,
          teeth: [tooth],
        }),
      });
      if (!adviseRes.ok) return { error: `advise ${adviseRes.status} ${await adviseRes.text()}` };
      const advise = await adviseRes.json();
      return {
        patientId: patient.id as string,
        diagnosisId: slip.id as string,
        diagnosisCode: slip.code as string,
        adviseId: advise.id as string,
        serviceName: service.name as string,
      };
    },
    { branch: BRANCH, text: note },
  );
  expect("error" in made ? made.error : null, "the fixture should be written").toBeNull();
  return made as Fixture;
}

/** DELETE as a given branch; the status the server answers with. */
async function deleteAs(page: Page, url: string, branch: string): Promise<number> {
  return page.evaluate(
    async ({ target, header }) =>
      (
        await fetch(target, {
          method: "DELETE",
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": header },
        })
      ).status,
    { target: url, header: branch },
  );
}

async function openConsulting(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?branchId=${BRANCH}&tab=consulting`);
  await expect(page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first()).toBeVisible({
    timeout: 20000,
  });
}

test.describe("Chẩn đoán & Tư vấn — xoá và chọn dịch vụ", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("Xoá phiếu chẩn đoán deletes the slip for good, and only in its own branch", async ({ page }) => {
    const fixture = await seedSlip(page, `e2e xoá chẩn đoán ${runId()}`);

    // Another branch cannot reach it: the id is simply not found there.
    expect(await deleteAs(page, `/api/v1/app/patient-diagnoses/${fixture.diagnosisId}`, BRANCH2)).toBe(404);

    await openConsulting(page, fixture.patientId);
    const row = page.locator(".pd-diagnosis-card tbody tr.ant-table-row", { hasText: fixture.diagnosisCode });
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "Xoá chẩn đoán" }).click();
    const deleted = page.waitForResponse(
      (res) =>
        res.request().method() === "DELETE" &&
        res.url().includes(`/api/v1/app/patient-diagnoses/${fixture.diagnosisId}`),
    );
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xoá$/ }).click();
    expect((await deleted).ok()).toBeTruthy();
    await expect(page.getByText("Đã xoá chẩn đoán")).toBeVisible();
    await expect(row).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first()).toBeVisible();
    await expect(page.locator(".pd-diagnosis-card", { hasText: fixture.diagnosisCode })).toHaveCount(0);
  });

  test("Xoá dịch vụ tư vấn deletes the line — not 'đã từ chối' — and a planned line stays", async ({ page }) => {
    const note = `e2e xoá tư vấn ${runId()}`;
    const fixture = await seedSlip(page, note);
    expect(await deleteAs(page, `/api/v1/app/patient-advises/${fixture.adviseId}`, BRANCH2)).toBe(404);

    await openConsulting(page, fixture.patientId);
    const line = page.locator(".pd-advise-table tbody tr.ant-table-row", { hasText: note });
    await expect(line).toHaveCount(1);

    await line.getByRole("button", { name: "Xoá dịch vụ tư vấn" }).click();
    const deleted = page.waitForResponse(
      (res) =>
        res.request().method() === "DELETE" &&
        res.url().includes(`/api/v1/app/patient-advises/${fixture.adviseId}`),
    );
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xoá$/ }).click();
    expect((await deleted).ok()).toBeTruthy();
    await expect(page.getByText("Đã xoá dịch vụ", { exact: true })).toBeVisible();
    await expect(page.getByText("Đã từ chối dịch vụ tư vấn")).toHaveCount(0);
    await expect(line).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first()).toBeVisible();
    await expect(page.locator(".pd-advise-table tbody tr.ant-table-row", { hasText: note })).toHaveCount(0);

    // A line already pulled into a treatment plan belongs to that plan: refused.
    const converted = await page.evaluate(
      async ({ branch, status }) => {
        const res = await fetch("/api/v1/app/patient-advises?maxResultCount=1000", {
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": branch },
        });
        const row = (await res.json()).items.find((item: { status: number }) => item.status === status);
        return (row?.id as string | undefined) ?? null;
      },
      { branch: BRANCH, status: ADVISE_CONVERTED },
    );
    expect(converted, "the demo clinic should hold a consulting line already in a plan").toBeTruthy();
    // BlueDental:Treatment:0011 is a business refusal — ABP answers 422.
    expect(await deleteAs(page, `/api/v1/app/patient-advises/${converted}`, BRANCH)).toBe(422);
    const stillThere = await page.evaluate(
      async ({ id, branch }) =>
        (await fetch(`/api/v1/app/patient-advises/${id}`, {
          credentials: "include",
          headers: { "X-Clinic-Branch-Id": branch },
        })).status,
      { id: converted, branch: BRANCH },
    );
    expect(stillThere, "the planned line is still there").toBe(200);
  });

  test("Chọn Dịch Vụ lists a group's services from the server, and a search narrows them", async ({
    page,
  }) => {
    const fixture = await seedSlip(page, `e2e chọn dịch vụ ${runId()}`);
    // The group whose services the catalogue lists last: exactly the rows a
    // one-slice-and-filter picker lost.
    const target = await page.evaluate(async (branch) => {
      const headers = { "X-Clinic-Branch-Id": branch };
      const all = await (
        await fetch(
          `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&skipCount=0&maxResultCount=1000`,
          { credentials: "include", headers },
        )
      ).json();
      const last = all.items[all.items.length - 1];
      const groups = await (
        await fetch(`/api/v1/app/taxonomies?clinicBranchId=${branch}&group=care_service&maxResultCount=20`, {
          credentials: "include",
          headers,
        })
      ).json();
      const firstPage = new Set(groups.items.map((item: { id: string }) => item.id));
      // A group on the strip's first page, so no paging is needed to reach its pill.
      const entry = all.items
        .slice()
        .reverse()
        .find((item: { taxonomyId: string }) => firstPage.has(item.taxonomyId));
      const group = groups.items.find((item: { id: string }) => item.id === (entry ?? last).taxonomyId);
      return {
        groupId: group?.id as string,
        groupName: group?.name as string,
        serviceName: (entry ?? last).name as string,
        total: all.totalCount as number,
      };
    }, BRANCH);
    expect(target.groupId, "a care-service group with services on the first page").toBeTruthy();

    await openConsulting(page, fixture.patientId);
    const slipRow = page.locator(".pd-diagnosis-card tbody tr.ant-table-row", { hasText: fixture.diagnosisCode });
    await slipRow.getByRole("button", { name: "Tạo Dịch Vụ" }).click();
    const dialog = page.getByRole("dialog", { name: /Chọn Dịch Vụ/ });
    await expect(dialog).toBeVisible();

    // The reference's layout: label + search on one line, the pill strip under it
    // between two arrows, and no "Tất cả dịch vụ" pill.
    await expect(dialog.getByText("Lựa chọn dịch vụ", { exact: true })).toBeVisible();
    await expect(dialog.getByPlaceholder("Tìm dịch vụ")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Trượt Lựa chọn dịch vụ sang trái" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Trượt Lựa chọn dịch vụ sang phải" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tất cả dịch vụ" })).toHaveCount(0);

    // Picking the group asks the server for that group, and its service is there.
    const filtered = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/catalog-entries") && res.url().includes(`taxonomyId=${target.groupId}`),
    );
    const pill = dialog.locator(".am-picker-row > button", { hasText: target.groupName }).first();
    await pill.click();
    expect((await filtered).ok()).toBeTruthy();
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    const rows = dialog.locator(".am-table tbody tr");
    await expect(rows.filter({ hasText: target.serviceName }).first()).toBeVisible();
    await expect(dialog.getByText("Không có dịch vụ phù hợp")).toHaveCount(0);

    // A tick survives the group being let go of, and Lưu writes it.
    await rows.filter({ hasText: target.serviceName }).first().getByRole("checkbox").check();
    await pill.click();
    await expect(pill).toHaveAttribute("aria-pressed", "false");

    // The search goes to the server too.
    const searched = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/catalog-entries") && res.url().includes("filter="),
    );
    await dialog.getByPlaceholder("Tìm dịch vụ").fill(target.serviceName);
    expect((await searched).ok()).toBeTruthy();
    await expect(rows.filter({ hasText: target.serviceName }).first()).toBeVisible();

    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-advises"),
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const body = JSON.parse((await created).request().postData() ?? "{}");
    expect(body.patientDiagnosisId).toBe(fixture.diagnosisId);
    await expect(dialog).toBeHidden();
  });
});
