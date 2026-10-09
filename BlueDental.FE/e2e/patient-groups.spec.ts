import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call } from "./fixtures/catalogApi";

/**
 * F-64 Hồ sơ nhóm (4.10), with the Mối quan hệ (4.8) records it reads.
 * BlueDental-local — see docs/clone/pages/patient-relations.md.
 *
 * Real stack only: real login, the real API, real PostgreSQL; nothing is
 * intercepted. Every run registers its own patients, so relations never clash.
 */

const RELATIONS = "/api/v1/app/patient-relations";
const GROUPS = "/api/v1/app/patient-groups";
const PARENT = 2;
const CHILD = 3;
const SIBLING = 4;
const FAMILY = 1;
const HEAD = 1;
const MEMBER = 2;

interface Person {
  id: string;
  code: string;
  name: string;
}

interface RelationRow {
  id: string | null;
  source: number;
  relatedPatientId: string;
  type: number | null;
  isFamily: boolean;
}

const errorCode = (body: unknown) => (body as { error?: { code?: string } }).error?.code;

/** A patient of branch 1 with a run-unique phone. */
async function person(page: Page, run: string, tag: string, gender: number): Promise<Person> {
  const phone = `09${run}${tag}`.padEnd(10, "0").slice(0, 10);
  const res = await call<{ id: string; patientCode: string }>(page, "POST", "/api/v1/app/patients", {
    firstName: `${tag} ${run}`,
    lastName: "NH",
    gender,
    phoneNumber: phone,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, code: res.body.patientCode, name: `NH ${tag} ${run}` };
}

async function relationsOf(page: Page, patientId: string) {
  return (await call<{ items: RelationRow[] }>(page, "GET", `${RELATIONS}?patientId=${patientId}`)).body.items;
}

test("API: a relation reads both ways and a family group joins people once", async ({ page }) => {
  await login(page);
  const run = runId();
  const child = await person(page, run, "1", 2);
  const father = await person(page, run, "2", 1);
  const mother = await person(page, run, "3", 2);

  // Mối quan hệ: declared once on the child's record, read as the inverse on the father's.
  const created = await call(page, "POST", RELATIONS, { patientId: child.id, relatedPatientId: father.id, type: PARENT });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  expect((await relationsOf(page, child.id)).find((r) => r.relatedPatientId === father.id)?.type).toBe(PARENT);
  expect((await relationsOf(page, father.id)).find((r) => r.relatedPatientId === child.id)?.type).toBe(CHILD);

  // The same pair the other way round, and a record related to itself, are refused.
  const reverse = await call(page, "POST", RELATIONS, { patientId: father.id, relatedPatientId: child.id, type: CHILD });
  expect(errorCode(reverse.body)).toBe("BlueDental:PatientRelation:0002");
  const self = await call(page, "POST", RELATIONS, { patientId: child.id, relatedPatientId: child.id, type: SIBLING });
  expect(errorCode(self.body)).toBe("BlueDental:PatientRelation:0001");

  // Hồ sơ nhóm: a family with the father as head; the mother becomes the child's người nhà through it.
  const group = await call<{ id: string; members: { patientId: string; role: number; relationToHead: number | null }[] }>(
    page,
    "POST",
    GROUPS,
    {
      name: `Gia đình NH ${run}`,
      kind: FAMILY,
      sharedMedicalNote: "Tiền sử tiểu đường bên nội",
      members: [
        { patientId: father.id, role: HEAD },
        { patientId: mother.id, role: MEMBER },
        { patientId: child.id, role: MEMBER },
      ],
    },
    BRANCH_ONE,
  );
  expect(group.status, JSON.stringify(group.body)).toBe(200);
  expect(group.body.members[0]).toMatchObject({ patientId: father.id, role: HEAD });
  expect(group.body.members.find((m) => m.patientId === child.id)?.relationToHead).toBe(CHILD);

  // One family group per record.
  const second = await call(page, "POST", GROUPS, {
    name: `Gia đình khác ${run}`,
    kind: FAMILY,
    members: [{ patientId: child.id, role: HEAD }],
  });
  expect(errorCode(second.body)).toBe("BlueDental:PatientRelation:0008");

  const byPatient = await call<{ items: { id: string }[] }>(page, "GET", `${GROUPS}/by-patient?patientId=${child.id}`);
  expect(byPatient.body.items.map((g) => g.id)).toEqual([group.body.id]);

  const family = await call<{ items: RelationRow[] }>(page, "GET", `${RELATIONS}/family?patientId=${child.id}`);
  expect(family.body.items.map((r) => r.relatedPatientId).sort()).toEqual([father.id, mother.id].sort());
});

test("UI: Hồ sơ nhóm gathers a family, shows it, and keeps it after a reload", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const run = runId();
  const child = await person(page, run, "5", 1);
  const sister = await person(page, run, "7", 2);

  // The menu leads to the page.
  await page.goto("/patient");
  await page.getByText("Hồ sơ nhóm", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/patient-group/);

  // A family seeded from a record, then a second member, a shared medical note.
  await page.goto(`/patient-group?new=${child.id}`);
  const form = page.getByRole("dialog", { name: "Tạo hồ sơ nhóm" });
  await expect(form.locator(".pg-members__list li", { hasText: child.code })).toBeVisible();
  const groupName = `Gia đình UI ${run}`;
  await form.getByLabel("Tên nhóm").fill(groupName);
  await form.locator(".pg-members .ss-trigger").click();
  await page.locator("#ss-portal-dropdown .ss-search-input").fill(sister.code);
  await page.locator("#ss-portal-dropdown .ss-option", { hasText: sister.code }).first().click();
  await form.getByLabel("Thông tin y khoa chung").fill("Dị ứng Penicillin cả nhà");
  await form.getByRole("button", { name: "Lưu" }).click();
  await expect(form).toBeHidden();

  const detail = page.getByRole("dialog").filter({ hasText: groupName });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Dị ứng Penicillin cả nhà");
  await expect(detail.getByRole("link", { name: sister.name })).toBeVisible();
  await detail.locator(".pg-detail-foot").getByRole("button", { name: "Đóng" }).click();

  // The list keeps it; "Xem" opens it again. Reload first: the data comes from the server.
  await page.reload();
  await page.getByPlaceholder("Tìm tên nhóm, tên hoặc mã thành viên").fill(groupName);
  await page.getByRole("button", { name: `Xem nhóm ${groupName}` }).click();
  const reopened = page.getByRole("dialog").filter({ hasText: groupName });
  await expect(reopened).toBeVisible();
  await expect(reopened.getByRole("link", { name: child.name })).toBeVisible();

  // And the server reads the same group for the record.
  const byPatient = await call<{ items: { name: string }[] }>(page, "GET", `${GROUPS}/by-patient?patientId=${child.id}`);
  expect(byPatient.body.items.map((g) => g.name)).toEqual([groupName]);
});
