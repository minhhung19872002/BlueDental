import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: several hồ sơ on one phone number (BA P2710_02, F-82, R-1057).
 *
 * The rules the server keeps on its own, whatever the dialog sends:
 * - a number another hồ sơ of the branch holds needs "Là … của …"; the link
 *   lands in the relations table, so the Mối quan hệ tab shows it;
 * - "của …" is someone over 18 by year, or of unknown age — except that Bố/Mẹ,
 *   Ông/Bà and Người giám hộ khác answer for a child — and anyone when nobody qualifies;
 * - one name per number (letter case does not count, accents do), one CCCD per branch;
 * - a guardian without a hồ sơ who answers on the number is offered, and saving
 *   them from that row links their guardian cards to the new hồ sơ — even one
 *   whose CCCD another hồ sơ carries is offered, and refused at Lưu (0012);
 * - one number however it is typed: a Vietnamese one without its 0 or with
 *   84 / +84 in front is the same phone, a foreign one is its E.164 form;
 * - a masked account (Ẩn SĐT) keeps the old refusal, and money follows "Chi phí › Xem".
 *
 * Every call is a real HTTP request from inside the logged-in page (cookie
 * session + antiforgery header). Nothing is intercepted; the database is real.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const PATIENTS = "/api/v1/app/patients";
const RELATIONS = "/api/v1/app/patient-relations";
const PASSWORD = "ChungSo@123456";
const asBranchOne = { branchId: BRANCH_ONE };

const CODE = {
  duplicatePhone: "BlueDental:Patient:0021",
  duplicateNationalId: "BlueDental:Patient:0012",
  linkRequired: "BlueDental:Patient:0033",
  anchorInvalid: "BlueDental:Patient:0034",
  duplicateName: "BlueDental:Patient:0035",
  invalidRelation: "BlueDental:PatientRelation:0003",
} as const;

/** `PatientRelationType`. */
const REL = { Spouse: 1, Parent: 2, Child: 3, Sibling: 4, Friend: 8, OtherGuardian: 11 } as const;
const GUARDIAN = { Mother: 2 } as const;
const SOURCE = { Relationship: 1, Guardian: 2 } as const;

interface Guardian {
  id?: string;
  linkedPatientId?: string | null;
  relation: number;
  fullName: string;
  phone: string;
  nationalId: string;
  dateOfBirth?: string | null;
  gender?: number | null;
  email?: string | null;
  sameAddressAsPatient: boolean;
  isPrimaryContact: boolean;
}

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  gender: number;
  dateOfBirth: string | null;
  phoneNumber: string;
  nationalId: string | null;
  guardians: Guardian[];
}

interface PatientInput {
  firstName: string;
  lastName: string;
  gender: number;
  phoneNumber: string;
  dateOfBirth: string | null;
  nationalId?: string | null;
  guardians?: Guardian[];
  guardiansConsented?: boolean;
  sharedPhoneLink?: { relation: number; anchorPatientId: string } | null;
  sourceGuardianId?: string | null;
}

interface Owner {
  id: string;
  patientCode: string;
  patientName: string;
  gender: number;
  dateOfBirth: string | null;
  isPhoneOwner: boolean;
  isAdult: boolean;
  relationType: number | null;
  relatedToName: string | null;
}

interface PhoneGuardian {
  guardianId: string;
  relation: number;
  fullName: string;
  nationalId: string;
  dateOfBirth: string | null;
  gender: number | null;
  email: string | null;
  wards: { patientId: string; patientCode: string; fullName: string }[];
}

interface PhoneCheck {
  exists: boolean;
  owners?: Owner[];
  guardians?: PhoneGuardian[];
}

interface LinkedPeople {
  sharedPhone: { id: string; isPhoneOwner: boolean; totalDebt: number; relationType: number | null; relatedToName: string | null }[];
  groupDebt: number;
  moneyHidden: boolean;
  canAddSharedPhone: boolean;
  guardians: { guardianId: string; patientId: string; patientCode: string }[];
}

interface Relation {
  source: number;
  relatedPatientId: string;
  type: number | null;
}

/** Two digits that differ for every person one run makes. */
let counter = 0;
const serial = () => String(counter++ % 100).padStart(2, "0");
const phoneOf = (id: string) => `09${id}${serial()}`;
const bornYearsAgo = (years: number) => `${new Date().getFullYear() - years}-06-15`;
const fullName = (p: Pick<Patient, "lastName" | "firstName">) => `${p.lastName} ${p.firstName}`;

function person(id: string, firstName: string, phone: string, overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    firstName,
    lastName: `Chung Số E2E ${id}`,
    gender: 1,
    phoneNumber: phone,
    dateOfBirth: bornYearsAgo(40),
    ...overrides,
  };
}

const link = (relation: number, anchor: { id: string }) => ({ sharedPhoneLink: { relation, anchorPatientId: anchor.id } });

async function register(page: Page, input: PatientInput) {
  return call<Patient>(page, PATIENTS, { method: "POST", json: input, ...asBranchOne });
}

async function registered(page: Page, input: PatientInput): Promise<Patient> {
  const res = await register(page, input);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

/** The update body as the edit dialog sends it: everything it loaded, sent back. */
function echo(patient: Patient, overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: patient.phoneNumber,
    nationalId: patient.nationalId,
    guardians: patient.guardians,
    guardiansConsented: true,
    ...overrides,
  };
}

async function update(page: Page, patient: Patient, overrides: Partial<PatientInput>) {
  return call<Patient>(page, `${PATIENTS}/${patient.id}`, { method: "PUT", json: echo(patient, overrides), ...asBranchOne });
}

async function checkPhone(page: Page, phone: string, excludeId?: string) {
  const query = new URLSearchParams({ phone, ...(excludeId ? { excludeId } : {}) });
  return call<PhoneCheck>(page, `${PATIENTS}/check-phone?${query}`, asBranchOne);
}

async function relationsOf(page: Page, patientId: string): Promise<Relation[]> {
  const res = await call<{ items: Relation[] }>(page, `${RELATIONS}?patientId=${patientId}`, asBranchOne);
  expect(res.status).toBe(200);
  return res.body.items;
}

async function linkedPeople(page: Page, patientId: string) {
  return call<LinkedPeople>(page, `${PATIENTS}/${patientId}/linked-people`, asBranchOne);
}

test.describe("Several hồ sơ on one phone (real API)", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
  });

  test("a number another hồ sơ holds needs 'Là … của …', and the link shows in Mối quan hệ", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const hung = await registered(page, person(id, "Hùng", phone, { dateOfBirth: "1982-04-12" }));

    const bare = await register(page, person(id, "Lan", phone));
    expect(bare.status).toBe(403);
    expect(bare.body.error?.code).toBe(CODE.linkRequired);

    const stranger = await register(page, { ...person(id, "Lan", phone), ...link(REL.Spouse, { id: crypto.randomUUID() }) });
    expect(stranger.body.error?.code).toBe(CODE.anchorInvalid);

    // "Bạn bè" is a relation of the Mối quan hệ tab, not one of the eight the link offers.
    const friend = await register(page, { ...person(id, "Lan", phone), ...link(REL.Friend, hung) });
    expect(friend.body.error?.code).toBe(CODE.invalidRelation);

    const lan = await registered(page, { ...person(id, "Lan", phone, { gender: 2 }), ...link(REL.Spouse, hung) });
    const son = await registered(page, { ...person(id, "Minh", phone, { dateOfBirth: bornYearsAgo(25) }), ...link(REL.Child, hung) });

    // The link is a relation like any other: Hùng is Minh's Bố/Mẹ, Minh is Hùng's Con.
    const ofSon = await relationsOf(page, son.id);
    expect(ofSon.filter((r) => r.relatedPatientId === hung.id)).toEqual([
      expect.objectContaining({ source: SOURCE.Relationship, type: REL.Parent }),
    ]);
    const ofHung = await relationsOf(page, hung.id);
    expect(ofHung.find((r) => r.relatedPatientId === son.id)?.type).toBe(REL.Child);
    expect(ofHung.find((r) => r.relatedPatientId === lan.id)?.type).toBe(REL.Spouse);

    // The dropdown: Chủ số first (the oldest), then each with their chip.
    const check = await checkPhone(page, phone);
    expect(check.body.exists).toBe(true);
    expect(check.body.owners?.map((o) => o.id)).toEqual([hung.id, lan.id, son.id]);
    expect(check.body.owners?.[0]).toMatchObject({ isPhoneOwner: true, isAdult: true, dateOfBirth: "1982-04-12", gender: 1 });
    expect(check.body.owners?.[1]).toMatchObject({ isPhoneOwner: false, relationType: REL.Spouse, relatedToName: fullName(hung) });
    expect(check.body.owners?.[2]).toMatchObject({ relationType: REL.Child, relatedToName: fullName(hung) });
    expect(check.body.guardians).toEqual([]);

    // The record being edited is left out, but the Chủ số stays the Chủ số.
    const editing = await checkPhone(page, phone, hung.id);
    expect(editing.body.owners?.map((o) => o.id)).toEqual([lan.id, son.id]);
    expect(editing.body.owners?.some((o) => o.isPhoneOwner)).toBe(false);
  });

  test("'của …' is someone over 18 or of unknown age, except for Bố/Mẹ, Ông/Bà, Người giám hộ khác", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, person(id, "Chủ", phone, { dateOfBirth: bornYearsAgo(45) }));
    // 18 by year is not over 18; 19 is.
    const eighteen = await registered(page, { ...person(id, "Mười Tám", phone, { dateOfBirth: bornYearsAgo(18) }), ...link(REL.Child, owner) });
    const nineteen = await registered(page, { ...person(id, "Mười Chín", phone, { dateOfBirth: bornYearsAgo(19) }), ...link(REL.Child, owner) });
    const undated = await registered(page, { ...person(id, "Chưa Rõ", phone, { dateOfBirth: null }), ...link(REL.Sibling, owner) });

    const check = await checkPhone(page, phone);
    const adult = Object.fromEntries((check.body.owners ?? []).map((o) => [o.id, o.isAdult]));
    expect(adult).toEqual({ [owner.id]: true, [eighteen.id]: false, [nineteen.id]: true, [undated.id]: true });

    const toMinor = await register(page, { ...person(id, "Vợ", phone), ...link(REL.Spouse, eighteen) });
    expect(toMinor.body.error?.code).toBe(CODE.anchorInvalid);
    await registered(page, { ...person(id, "Anh", phone), ...link(REL.Sibling, nineteen) });
    await registered(page, { ...person(id, "Em Họ", phone), ...link(REL.Sibling, undated) });
    await registered(page, { ...person(id, "Mẹ", phone, { gender: 2 }), ...link(REL.Parent, eighteen) });
    await registered(page, { ...person(id, "Giám Hộ", phone), ...link(REL.OtherGuardian, eighteen) });

    // Nobody over 18 on the number: everyone may be picked, so a save is never stuck.
    const young = phoneOf(id);
    const only = await registered(page, person(id, "Trẻ", young, { dateOfBirth: bornYearsAgo(17) }));
    await registered(page, { ...person(id, "Bạn Cùng Số", young), ...link(REL.Sibling, only) });
  });

  test("one name and one CCCD per number; an unchanged number is not asked about again", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, person(id, "Hà My", phone, { nationalId: `0790${id}${serial()}` }));

    const sameName = await register(page, { ...person(id, "hà  my", phone), ...link(REL.Sibling, owner) });
    expect(sameName.status).toBe(403);
    expect(sameName.body.error?.code).toBe(CODE.duplicateName);

    const sameCccd = await register(page, { ...person(id, "Khác", phone, { nationalId: owner.nationalId }), ...link(REL.Sibling, owner) });
    expect(sameCccd.body.error?.code).toBe(CODE.duplicateNationalId);

    // Accents count: "Ha My" is somebody else.
    const haMy = await registered(page, { ...person(id, "Ha My", phone), ...link(REL.Sibling, owner) });

    // Saving with the number it already had needs no link…
    const touched = await update(page, haMy, { gender: 2 });
    expect(touched.status, JSON.stringify(touched.body)).toBe(200);
    // …but a new name must still be free on the number.
    const renamed = await update(page, touched.body, { firstName: "HÀ MY" });
    expect(renamed.body.error?.code).toBe(CODE.duplicateName);

    // Moving to a number another hồ sơ holds is handled like creating one.
    const elsewhere = await registered(page, person(id, "Chuyển Số", phoneOf(id)));
    const moved = await update(page, elsewhere, { phoneNumber: phone });
    expect(moved.body.error?.code).toBe(CODE.linkRequired);
    const linked = await update(page, elsewhere, { phoneNumber: phone, ...link(REL.Sibling, owner) });
    expect(linked.status, JSON.stringify(linked.body)).toBe(200);
    expect((await relationsOf(page, elsewhere.id)).find((r) => r.relatedPatientId === owner.id)?.type).toBe(REL.Sibling);
  });

  test("a guardian on the number is offered, and saving them from it links their guardian cards", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const nationalId = `0791${id}${serial()}`;
    const mother: Guardian = {
      relation: GUARDIAN.Mother,
      fullName: `Mẹ Chung Số ${id}`,
      phone,
      nationalId,
      dateOfBirth: "1990-03-03",
      gender: 2,
      email: `me${id}@example.test`,
      sameAddressAsPatient: true,
      isPrimaryContact: true,
    };
    const child = await registered(page, {
      ...person(id, "Bé An", phone, { dateOfBirth: bornYearsAgo(9) }),
      guardians: [mother],
      guardiansConsented: true,
    });
    // The same mother, declared again on a sibling with a number of its own.
    const sibling = await registered(page, {
      ...person(id, "Bé Bình", phoneOf(id), { dateOfBirth: bornYearsAgo(6) }),
      guardians: [{ ...mother, nationalId: ` ${nationalId.toLowerCase()} ` }],
      guardiansConsented: true,
    });

    const offered = await checkPhone(page, phone);
    expect(offered.body.owners?.map((o) => o.id)).toEqual([child.id]);
    expect(offered.body.guardians).toHaveLength(1);
    const guardianRow = offered.body.guardians![0];
    expect(guardianRow).toMatchObject({
      relation: GUARDIAN.Mother,
      fullName: mother.fullName,
      dateOfBirth: "1990-03-03",
      gender: 2,
      email: mother.email,
    });
    // One person, declared twice: one row naming both children, the newest first.
    expect(guardianRow.wards.map((w) => w.patientId)).toEqual([sibling.id, child.id]);

    // The dialog copies the guardian in, the link block says "Bố/Mẹ của Bé An".
    const saved = await registered(page, {
      firstName: "Mẹ",
      lastName: `Chung Số ${id}`,
      gender: 2,
      dateOfBirth: "1990-03-03",
      phoneNumber: phone,
      nationalId: guardianRow.nationalId,
      sourceGuardianId: guardianRow.guardianId,
      ...link(REL.Parent, child),
    });

    for (const ward of [child, sibling]) {
      const reread = await call<Patient>(page, `${PATIENTS}/${ward.id}`, asBranchOne);
      expect(reread.body.guardians[0].linkedPatientId, `guardian card of ${ward.firstName}`).toBe(saved.id);
      const people = await linkedPeople(page, ward.id);
      expect(people.body.guardians).toEqual([
        expect.objectContaining({ patientId: saved.id, patientCode: saved.patientCode }),
      ]);
    }

    // The guardian declaration already says Bố/Mẹ: no second row for the same pair.
    const ofMother = (await relationsOf(page, saved.id)).filter((r) => r.relatedPatientId === child.id);
    expect(ofMother).toHaveLength(1);
    expect(ofMother[0].source).toBe(SOURCE.Guardian);

    // Now a hồ sơ, the mother is offered as one — not as a guardian any more.
    const after = await checkPhone(page, phone);
    expect(after.body.owners?.map((o) => o.id)).toEqual([child.id, saved.id]);
    expect(after.body.guardians).toEqual([]);
  });

  test("a guardian whose CCCD another hồ sơ carries is still offered, and Lưu refuses them (0012)", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const nationalId = `0792${id}${serial()}`;
    const motherName = `Mẹ Trùng CCCD ${id}`;
    // Someone else, on a number of their own, already holds the CCCD.
    await registered(page, person(id, "Chủ CCCD", phoneOf(id), { nationalId }));
    const child = await registered(page, {
      ...person(id, "Bé Cường", phone, { dateOfBirth: bornYearsAgo(8) }),
      guardians: [
        { relation: GUARDIAN.Mother, fullName: motherName, phone, nationalId, sameAddressAsPatient: true, isPrimaryContact: true },
      ],
      guardiansConsented: true,
    });

    // P2710_02: the row shows; "CCCD đã tồn tại" is said at Lưu, not by hiding it.
    const offered = await checkPhone(page, phone);
    expect(offered.body.guardians?.map((g) => g.fullName)).toEqual([motherName]);

    const refused = await register(page, {
      firstName: "Trùng CCCD",
      lastName: `Mẹ ${id}`,
      gender: 2,
      dateOfBirth: null,
      phoneNumber: phone,
      nationalId,
      sourceGuardianId: offered.body.guardians![0].guardianId,
      ...link(REL.Parent, child),
    });
    expect(refused.body.error?.code).toBe(CODE.duplicateNationalId);

    // Nothing was written: the card is still unlinked, the row still offered.
    const reread = await call<Patient>(page, `${PATIENTS}/${child.id}`, asBranchOne);
    expect(reread.body.guardians[0].linkedPatientId ?? null).toBeNull();
    expect((await checkPhone(page, phone)).body.guardians).toHaveLength(1);
  });

  test("one number however it is typed: without its 0, with 84 or +84, and a foreign one in E.164", async ({ page }) => {
    const id = runId();
    const phone = phoneOf(id);
    const bare = phone.slice(1);

    // Typed beside +84 without its 0, it is stored with it, and every spelling finds it.
    const owner = await registered(page, person(id, "Gốc Số", bare));
    expect(owner.phoneNumber).toBe(phone);
    for (const typed of [phone, bare, `84${bare}`, `+84 ${bare}`, `0084${bare}`]) {
      expect((await checkPhone(page, typed)).body.owners?.map((o) => o.id), typed).toEqual([owner.id]);
    }
    // Zalo's "84…" is the same number: still asked "Là … của …", and stored with its 0.
    expect((await register(page, person(id, "Thứ Hai", `84${bare}`))).body.error?.code).toBe(CODE.linkRequired);
    const second = await registered(page, { ...person(id, "Thứ Hai", `84${bare}`), ...link(REL.Sibling, owner) });
    expect(second.phoneNumber).toBe(phone);

    // Abroad: E.164 however it is spaced or prefixed; the same digits under
    // another country, or as a Vietnamese number, are someone else.
    const national = `4${id}${serial()}`;
    const visitor = await registered(page, person(id, "Khách Úc", `0061 ${national}`));
    expect(visitor.phoneNumber).toBe(`+61${national}`);
    for (const typed of [`+61${national}`, `+61 ${national}`]) {
      expect((await checkPhone(page, typed)).body.owners?.map((o) => o.id), typed).toEqual([visitor.id]);
    }
    for (const other of [`+64${national}`, `0${national}`]) {
      expect((await checkPhone(page, other)).body.exists, other).toBe(false);
    }
    expect((await register(page, person(id, "Bạn Úc", `+61 ${national}`))).body.error?.code).toBe(CODE.linkRequired);
  });

  test("a masked account keeps the old refusal, money follows Chi phí, and another branch sees nothing", async ({ page, browser }) => {
    const id = runId();
    const phone = phoneOf(id);
    const owner = await registered(page, person(id, "Chủ Số", phone));
    const wife = await registered(page, { ...person(id, "Vợ", phone, { gender: 2 }), ...link(REL.Spouse, owner) });

    const asAdmin = await linkedPeople(page, owner.id);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.sharedPhone.map((m) => m.id)).toEqual([wife.id]);
    expect(asAdmin.body.sharedPhone[0]).toMatchObject({ isPhoneOwner: false, relationType: REL.Spouse, relatedToName: fullName(owner) });
    expect(asAdmin.body).toMatchObject({ moneyHidden: false, canAddSharedPhone: true });
    const ofWife = await linkedPeople(page, wife.id);
    expect(ofWife.body.sharedPhone).toEqual([expect.objectContaining({ id: owner.id, isPhoneOwner: true })]);

    const fixture = await setUpMaskedStaff(page, id);
    const masked = await openSession(browser, fixture.userName);
    try {
      const taken = await checkPhone(masked.page, phone);
      expect(taken.body.exists).toBe(true);
      expect(taken.body.owners ?? []).toHaveLength(0);
      expect(taken.body.guardians ?? []).toHaveLength(0);

      const refused = await register(masked.page, { ...person(id, "Người Mới", phone), ...link(REL.Sibling, owner) });
      expect(refused.status).toBe(403);
      expect(refused.body.error?.code).toBe(CODE.duplicatePhone);

      // No "Chi phí › Xem": the group is listed, its money is not.
      const people = await linkedPeople(masked.page, owner.id);
      expect(people.status).toBe(200);
      expect(people.body).toMatchObject({ moneyHidden: true, canAddSharedPhone: false, groupDebt: 0 });
      expect(people.body.sharedPhone.every((m) => m.totalDebt === 0)).toBe(true);
    } finally {
      await masked.context.close();
      await tearDown(page, fixture);
    }

    const elsewhere = await openSession(browser, BRANCH2_USER.userName, BRANCH2_USER.password);
    try {
      const ownBranch = await call<PhoneCheck>(elsewhere.page, `${PATIENTS}/check-phone?phone=${phone}`);
      expect(ownBranch.status).toBe(200);
      expect(ownBranch.body.exists).toBe(false);
      const foreign = await call(elsewhere.page, `${PATIENTS}/${owner.id}/linked-people`);
      expect([403, 404]).toContain(foreign.status);
    } finally {
      await elsewhere.context.close();
    }
  });
});

interface MaskedStaff {
  roleId: string;
  staffId: string;
  userName: string;
}

/** A throw-away role with Ẩn SĐT and without "Chi phí › Xem", and one staff member in it. */
async function setUpMaskedStaff(page: Page, id: string): Promise<MaskedStaff> {
  const roleName = `Chung SĐT ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const grants = ["BlueDental.patient.read", "BlueDental.patient.create", "BlueDental.patient.update", "BlueDental.patient.hidePhone"];
  const granted = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: grants.map((name) => ({ name, isGranted: true })) },
  });
  expect(granted.status).toBe(204);

  const userName = `chungso${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên chung số ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status, JSON.stringify(staff.body)).toBe(200);
  return { roleId: role.body.id, staffId: staff.body.id, userName };
}

async function tearDown(page: Page, fixture: MaskedStaff) {
  await call(page, `/api/v1/app/staff/${fixture.staffId}`, { method: "DELETE" });
  await call(page, `/api/identity/roles/${fixture.roleId}`, { method: "DELETE" });
}

async function openSession(browser: Browser, userName: string, password = PASSWORD) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password });
  return { context, page };
}
