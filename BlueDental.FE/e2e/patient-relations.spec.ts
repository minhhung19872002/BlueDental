import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call } from "./fixtures/catalogApi";

/**
 * F-64 Mối quan hệ (4.8) · Người giám hộ (4.9) · Hồ sơ nhóm (4.10) · family
 * prepaid card (3.1), one story since 2026-10-12: a guardian picked from a hồ
 * sơ is that person's relation, a family group's members are related to its
 * Chủ hộ, and the dialog lists each person once.
 * BlueDental-local — see docs/clone/pages/patient-relations.md.
 *
 * Real stack only: real login, the real API, real PostgreSQL; nothing is
 * intercepted. Every run registers its own patients, so relations never clash.
 */

const RELATIONS = "/api/v1/app/patient-relations";
const GROUPS = "/api/v1/app/patient-groups";
const CARDS = "/api/v1/app/prepaid-cards";
const PATIENTS = "/api/v1/app/patients";
const SPOUSE = 1;
const PARENT = 2;
const CHILD = 3;
const SIBLING = 4;
const GRANDPARENT = 5;
const GUARDIAN_FATHER = 1;
const GUARDIAN_GRANDFATHER = 3;
const GUARDED_BY_PATIENT = 2;
const FAMILY = 1;
const HEAD = 1;
const MEMBER = 2;

interface Person {
  id: string;
  code: string;
  name: string;
  phone: string;
}

interface RelationRow {
  id: string | null;
  source: number;
  relatedPatientId: string;
  type: number | null;
  isFamily: boolean;
  guardianDirection: number | null;
  guardianRelation: number | null;
  setByGuardian: boolean;
  inFamilyGroup: boolean;
}

const errorCode = (body: unknown) => (body as { error?: { code?: string } }).error?.code;

/** A patient of branch 1 with a run-unique phone. */
async function person(page: Page, run: string, tag: string, gender: number): Promise<Person> {
  const phone = `09${run}${tag}`.padEnd(10, "0").slice(0, 10);
  const res = await call<{ id: string; patientCode: string }>(page, "POST", "/api/v1/app/patients", {
    firstName: `${tag} ${run}`,
    lastName: "QH",
    gender,
    phoneNumber: phone,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, code: res.body.patientCode, name: `QH ${tag} ${run}`, phone };
}

/** A guardian card picked from a patient record. */
const guardianOf = (who: Person, relation: number, run: string) => ({
  linkedPatientId: who.id,
  relation,
  fullName: who.name,
  phone: who.phone,
  nationalId: `0791${run}`.padEnd(12, "1").slice(0, 12),
  sameAddressAsPatient: true,
  isPrimaryContact: true,
});

/**
 * A dialog done appearing. A dialog still fading in takes the focus when it
 * finishes, which closes a dropdown already open in the dialog stacked on it.
 */
async function settled(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/-appear/);
  return dialog;
}

/** The record's hồ sơ editor, then its "Gia đình & Quan hệ" dialog. */
async function openFamily(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?tab=profile`);
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  const editor = page.getByRole("dialog", { name: "Chỉnh sửa hồ sơ" });
  await editor.getByRole("button", { name: /^Gia đình & Quan hệ/ }).click();
  const family = await settled(page.getByRole("dialog", { name: /^Gia đình & Quan hệ — / }));
  return { editor, family };
}

async function relationsOf(page: Page, patientId: string) {
  return (await call<{ items: RelationRow[] }>(page, "GET", `${RELATIONS}?patientId=${patientId}`)).body.items;
}

test("API: a relation reads both ways, a family group joins people once, and a family card is shared with family only", async ({
  page,
}) => {
  await login(page);
  const run = runId();
  const child = await person(page, run, "1", 2);
  const father = await person(page, run, "2", 1);
  const mother = await person(page, run, "3", 2);
  const cousin = await person(page, run, "4", 1);

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

  // Hồ sơ nhóm: a family with the father as head; the mother says she is his wife (written
  // as their Mối quan hệ), the child's relation is on file. The mother becomes the child's người nhà.
  const group = await call<{ id: string; members: { patientId: string; role: number; relationToHead: number | null; diseaseHistory: string[] }[] }>(
    page,
    "POST",
    GROUPS,
    {
      name: `Gia đình QH ${run}`,
      kind: FAMILY,
      sharedMedicalNote: "Tiền sử tiểu đường bên nội",
      members: [
        { patientId: father.id, role: HEAD },
        { patientId: mother.id, role: MEMBER, relationToHead: SPOUSE },
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

  // A family card is shared with người nhà only: the cousin needs a relation, which the sale records.
  const me = (await call<{ currentUser: { id: string } }>(page, "GET", "/api/abp/application-configuration")).body.currentUser;
  const type = await call<{ id: string }>(page, "POST", `${CARDS}/types`, {
    clinicBranchId: BRANCH_ONE, name: `Thẻ gia đình QH ${run}`, salePrice: 1_000_000, usageValue: 1_000_000,
    commissionType: 1, commissionValue: 0, allowFamily: true, serviceIds: [], serviceGroupIds: [], isOnSale: true,
  });
  const sale = (extra: object) =>
    call<{ id: string; members: { patientId: string }[] }>(page, "POST", CARDS, {
      cardTypeId: type.body.id, clinicBranchId: BRANCH_ONE, ownerPatientId: child.id, sellerStaffId: me.id, method: 1,
      memberPatientIds: [mother.id, cousin.id], ...extra,
    });
  expect(errorCode((await sale({})).body)).toBe("BlueDental:PrepaidCard:0020");
  const sold = await sale({ newRelations: [{ patientId: cousin.id, type: 7 }] });
  expect(sold.status, JSON.stringify(sold.body)).toBe(200);
  expect(sold.body.members.map((m) => m.patientId).sort()).toEqual([mother.id, cousin.id].sort());
  expect((await relationsOf(page, child.id)).find((r) => r.relatedPatientId === cousin.id)).toMatchObject({ type: 7, isFamily: true });
});

test("API: a guardian picked from a hồ sơ is that record's relation, kept in step with the card", async ({ page }) => {
  await login(page);
  const run = runId();
  const father = await person(page, run, "8", 1);
  const childPhone = `08${run}9`.padEnd(10, "0").slice(0, 10);

  // A 9-year-old whose guardian is the father's own record, with the pill "Bố".
  const created = await call<{ id: string }>(page, "POST", PATIENTS, {
    firstName: `9 ${run}`,
    lastName: "QH",
    gender: 2,
    phoneNumber: childPhone,
    dateOfBirth: `${new Date().getFullYear() - 9}-06-15`,
    guardiansConsented: true,
    guardians: [guardianOf(father, GUARDIAN_FATHER, run)],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const childId = created.body.id;

  // One row for the father — a relation written by the card, not a second guardian row.
  const rows = (await relationsOf(page, childId)).filter((r) => r.relatedPatientId === father.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: PARENT, guardianRelation: GUARDIAN_FATHER, setByGuardian: true });
  expect(rows[0].id).not.toBeNull();
  const back = (await relationsOf(page, father.id)).filter((r) => r.relatedPatientId === childId);
  expect(back).toHaveLength(1);
  expect(back[0]).toMatchObject({ type: CHILD, guardianDirection: GUARDED_BY_PATIENT, setByGuardian: true });

  // The card owns it: the relation list and a family group cannot say otherwise.
  const edit = await call(page, "PUT", `${RELATIONS}/${rows[0].id}`, { patientId: childId, type: SIBLING });
  expect(errorCode(edit.body)).toBe("BlueDental:PatientRelation:0012");
  const remove = await call(page, "DELETE", `${RELATIONS}/${rows[0].id}`);
  expect(errorCode(remove.body)).toBe("BlueDental:PatientRelation:0012");
  const clash = await call(page, "POST", GROUPS, {
    name: `Gia đình GH ${run}`,
    kind: FAMILY,
    members: [{ patientId: father.id, role: HEAD }, { patientId: childId, role: MEMBER, relationToHead: SIBLING }],
  }, BRANCH_ONE);
  expect(errorCode(clash.body)).toBe("BlueDental:PatientRelation:0012");
  // With nothing given, the relation on file is the child's place in the family.
  const group = await call<{ members: { patientId: string; relationToHead: number | null }[] }>(page, "POST", GROUPS, {
    name: `Gia đình GH ${run}`,
    kind: FAMILY,
    members: [{ patientId: father.id, role: HEAD }, { patientId: childId, role: MEMBER }],
  }, BRANCH_ONE);
  expect(group.status, JSON.stringify(group.body)).toBe(200);
  expect(group.body.members.find((m) => m.patientId === childId)?.relationToHead).toBe(CHILD);

  // The card changes to "Ông": the relation follows on the hồ sơ's save.
  const changed = await call(page, "PUT", `${PATIENTS}/${childId}/guardians`, {
    guardiansConsented: true,
    guardians: [guardianOf(father, GUARDIAN_GRANDFATHER, run)],
  });
  expect(changed.status, JSON.stringify(changed.body)).toBe(200);
  const after = (await relationsOf(page, childId)).filter((r) => r.relatedPatientId === father.id);
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ type: GRANDPARENT, setByGuardian: true, inFamilyGroup: true });
});

test("UI: the hồ sơ editor's family pill relates two records, Hồ sơ nhóm gathers a family, and the card suggests người nhà", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const run = runId();
  const child = await person(page, run, "5", 1);
  const mother = await person(page, run, "6", 2);
  const sister = await person(page, run, "7", 2);

  // "Gia đình & Quan hệ" opens from the hồ sơ editor's third pill: the family group on
  // top, then one list of people (owner, 2026-10-12).
  const { editor, family } = await openFamily(page, child.id);
  await expect(family.getByRole("region", { name: "Hồ sơ nhóm" })).toContainText("Chưa thuộc nhóm gia đình nào.");
  const relations = family.getByRole("region", { name: "Người nhà & quan hệ" });
  await expect(relations).toContainText("Chưa có người nhà hay mối quan hệ nào.");

  await relations.getByRole("button", { name: "Thêm mối quan hệ" }).click();
  const dialog = await settled(page.getByRole("dialog", { name: "Thêm mối quan hệ" }));
  await dialog.locator(".ss-trigger").click();
  await page.locator("#ss-portal-dropdown .ss-search-input").fill(mother.code);
  await page.locator("#ss-portal-dropdown .ss-option", { hasText: mother.code }).first().click();
  await dialog.getByLabel(/Là gì của/).fill("Bố");
  await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: "Bố/Mẹ" }).click();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();

  await expect(relations.locator(".pf-relation", { hasText: mother.name })).toContainText("Mẹ");

  // The name opens the mother's record in a new browser tab; the editor stays as it is.
  const [motherTab] = await Promise.all([
    page.context().waitForEvent("page"),
    relations.getByRole("link", { name: mother.name }).click(),
  ]);
  await expect(family).toBeVisible();
  await expect(editor).toBeVisible();
  // The mother's record reads the inverse by itself.
  const motherFamily = (await openFamily(motherTab, mother.id)).family;
  await expect(
    motherFamily.getByRole("region", { name: "Người nhà & quan hệ" }).locator(".pf-relation", { hasText: child.name }),
  ).toContainText("Con");
  await motherTab.close();

  // Hồ sơ nhóm: a family seeded from the record, then a second member, a shared medical note.
  await page.goto(`/patient-group?new=${child.id}`);
  const form = page.getByRole("dialog", { name: "Tạo hồ sơ nhóm" });
  await expect(form.locator(".pg-members__list li", { hasText: child.code })).toBeVisible();
  const groupName = `Gia đình UI ${run}`;
  await form.getByLabel("Tên nhóm").fill(groupName);
  await form.locator(".pg-members .ss-trigger").click();
  await page.locator("#ss-portal-dropdown .ss-search-input").fill(sister.code);
  await page.locator("#ss-portal-dropdown .ss-option", { hasText: sister.code }).first().click();
  // A family member says what they are to the Chủ hộ.
  await form.getByRole("combobox", { name: /^Là gì của chủ hộ/ }).click();
  await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: "Anh/Chị/Em" }).click();
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
  await expect(page.getByRole("dialog").filter({ hasText: groupName })).toBeVisible();

  // Back on the record: the family group on top, with the child as Chủ hộ; the sister is
  // one row with her relation and the group badge; the mother's row is unchanged.
  const wide = (await openFamily(page, child.id)).family;
  const groups = wide.getByRole("region", { name: "Hồ sơ nhóm" });
  await expect(groups).toContainText(groupName);
  await expect(groups).toContainText(`Chủ hộ: ${child.name}`);
  const people = wide.getByRole("region", { name: "Người nhà & quan hệ" });
  const sisterRow = people.locator(".pf-relation", { hasText: sister.name });
  await expect(sisterRow).toHaveCount(1);
  await expect(sisterRow).toContainText("Chị/Em gái");
  await expect(sisterRow).toContainText("Cùng nhóm gia đình");
  await expect(people.locator(".pf-relation", { hasText: mother.name })).toContainText("Mẹ");

  // Bán thẻ: the owner's người nhà are offered as chips; the mother is one tap.
  await page.goto("/prepaid-card");
  await page.locator(".prepaid-views").getByText("Loại thẻ", { exact: true }).click();
  await page.getByRole("button", { name: "Thêm loại thẻ" }).first().click();
  const typeDialog = page.getByRole("dialog", { name: "Thêm loại thẻ trả trước" });
  const typeName = `Thẻ gia đình UI ${run}`;
  await typeDialog.getByLabel("Tên loại thẻ").fill(typeName);
  await typeDialog.getByLabel("Giá bán").fill("1000000");
  await typeDialog.getByLabel("Giá trị sử dụng").fill("1000000");
  await typeDialog.locator(".prepaid-commission input").last().fill("0");
  await typeDialog.getByLabel("Áp dụng cho thành viên gia đình").click();
  await typeDialog.getByRole("button", { name: "Lưu" }).click();
  await expect(typeDialog).toBeHidden();

  await page.locator(".prepaid-views").getByText("Thẻ đã phát hành", { exact: true }).click();
  await page.getByRole("button", { name: "Bán thẻ" }).first().click();
  const sell = page.getByRole("dialog", { name: "Bán thẻ" });
  await sell.getByLabel("Loại thẻ").click();
  await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: typeName }).click();
  await sell.locator(".ss-trigger").first().click();
  await page.locator("#ss-portal-dropdown .ss-search-input").fill(child.code);
  await page.locator("#ss-portal-dropdown .ss-option", { hasText: child.code }).first().click();

  await sell.locator(".prepaid-members__chip", { hasText: mother.name }).click();
  await expect(sell.locator(".prepaid-members__list li", { hasText: mother.code })).toContainText("Người nhà");

  const sold = page.waitForResponse((res) => res.url().endsWith(CARDS) && res.request().method() === "POST");
  await sell.getByRole("button", { name: "Bán & phát hành" }).click();
  const response = await sold;
  expect(response.ok(), await response.text()).toBeTruthy();
  const card = (await response.json()) as { members: { patientId: string }[] };
  expect(card.members.map((m) => m.patientId)).toEqual([mother.id]);
});
