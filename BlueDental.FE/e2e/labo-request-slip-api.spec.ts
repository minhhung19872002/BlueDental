import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call, LABO_ORDERS, LaboStatus, type Paged } from "./fixtures/laboApi";
import {
  CaseType,
  fixedGroups,
  fullSlip,
  Layout,
  newMaterial,
  newPatient,
  readBack,
  save,
  slipCatalog,
  slipNo,
  taxonomy,
  type Restoration,
  type SlipOrderView,
} from "./fixtures/laboSlipApi";

/**
 * Feature F-91: the Labo Phiếu yêu cầu (BA mock "bản 2 nhập mã số, không kế
 * hoạch nhà cung cấp") — Mã số typed by hand and kept unique per branch,
 * Loại phục hình as one Dịch vụ and one Vật liệu of this branch (R-1216, no
 * Trên implant), Màu răng in six zones, Đường hoàn tất several at once,
 * Kiểu nhịp and Khớp cắn, all of it entered once and stored on every tooth,
 * no supplier and no slip link.
 *
 * Every call is a real HTTP request from the logged-in page — cookie session,
 * antiforgery header, real database. Every write is read back with its own GET.
 */

const code = (n: number) => `BlueDental:Labo:${String(n).padStart(4, "0")}`;
const LAB_SLIP_NO_REQUIRED = code(42);
const LAB_SLIP_NO_TAKEN = code(43);
const RESTORATION_MISSING = code(44);
const RESTORATION_INVALID = code(45);
const TOOTH_SPEC_INCOMPLETE = code(34);
const MATERIAL_CODE_TAKEN = code(47);
const MATERIALS = "/api/v1/app/labo-materials";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

test.describe("Labo Phiếu yêu cầu API (F-91)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("each material is filed under one of the branch's fixed groups and reads back with its Mã", async ({ page }) => {
    const c = await slipCatalog(page);
    const res = await call<Paged<{ id: string; code: string | null; taxonomyId: string }>>(
      page,
      `/api/v1/app/labo-materials?ClinicBranchId=${BRANCH_ONE}&MaxResultCount=1000`,
      { branchId: BRANCH_ONE },
    );
    expect(res.status, res.text).toBe(200);
    const byId = new Map((res.body.items ?? []).map((m) => [m.id, m]));
    expect(byId.get(c.ceramic.id)).toMatchObject({ code: c.ceramic.code, taxonomyId: c.groups.TOAN_SU.id });
    expect(byId.get(c.alloy.id)).toMatchObject({ code: c.alloy.code, taxonomyId: c.groups.HOP_KIM.id });
    expect(byId.get(c.implantOther.id)).toMatchObject({
      code: c.implantOther.code,
      taxonomyId: c.groups.KHAC_TREN_IMPLANT.id,
    });
  });

  test("every branch has the three fixed groups, seeded once", async ({ page }) => {
    for (const branchId of [BRANCH_ONE, BRANCH_TWO]) {
      const first = await fixedGroups(page, branchId);
      const again = await fixedGroups(page, branchId);
      expect(again).toEqual(first);
      expect(new Set(Object.values(first).map((g) => g.id)).size).toBe(3);
    }
  });

  test("a material needs a Mã unique within its branch, found by search and switched on and off", async ({ page }) => {
    const c = await slipCatalog(page);
    const noCode = await call(page, MATERIALS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { code: "  ", name: `Không mã ${runId()}`, taxonomyId: c.groups.TOAN_SU.id, clinicBranchId: BRANCH_ONE },
    });
    expect([400, 403], noCode.text).toContain(noCode.status);

    const taken = await call<{ error?: { code?: string } }>(page, MATERIALS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { code: c.ceramic.code, name: `Trùng mã ${runId()}`, taxonomyId: c.groups.HOP_KIM.id, clinicBranchId: BRANCH_ONE },
    });
    expect(taken.status, taken.text).toBe(403);
    expect(taken.body.error?.code).toBe(MATERIAL_CODE_TAKEN);

    // The same Mã is free in another branch.
    const elsewhere = await call(page, MATERIALS, {
      method: "POST",
      branchId: BRANCH_TWO,
      json: {
        code: c.ceramic.code,
        name: `CN2 ${runId()}`,
        taxonomyId: (await fixedGroups(page, BRANCH_TWO)).TOAN_SU.id,
        clinicBranchId: BRANCH_TWO,
      },
    });
    expect(elsewhere.status, elsewhere.text).toBe(200);

    const found = await call<Paged<{ id: string }>>(
      page,
      `${MATERIALS}?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(c.ceramic.code.toLowerCase())}&MaxResultCount=10`,
      { branchId: BRANCH_ONE },
    );
    expect(found.status, found.text).toBe(200);
    expect(found.body.items?.map((m) => m.id)).toEqual([c.ceramic.id]);

    const readActive = async () => {
      const res = await call<Paged<{ id: string; isActive: boolean }>>(
        page,
        `${MATERIALS}?ClinicBranchId=${BRANCH_ONE}&TaxonomyId=${c.groups.TOAN_SU.id}&MaxResultCount=1000`,
        { branchId: BRANCH_ONE },
      );
      expect(res.status, res.text).toBe(200);
      return res.body.items?.find((m) => m.id === c.ceramic.id)?.isActive;
    };
    for (const isActive of [false, true]) {
      const set = await call(page, `${MATERIALS}/${c.ceramic.id}/active`, {
        method: "PUT",
        branchId: BRANCH_ONE,
        json: { isActive },
      });
      expect(set.status, set.text).toBe(200);
      expect(await readActive()).toBe(isActive);
    }
  });

  test("Lưu nháp needs no Mã số and carries no supplier or slip link", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "draft");
    const made = await save(page, { patientId, dentistId: c.dentistId, teeth: [21], submit: false });
    expect(made.status, made.text).toBe(200);

    const order = await readBack(page, made.body.id!);
    expect(order.status).toBe(LaboStatus.Draft);
    expect(order.layout).toBe(Layout.RequestSlip);
    expect(order.labSlipNo).toBeNull();
    expect(order.treatmentServiceId).toBeNull();
    expect(order.treatmentStageId).toBeNull();
    expect(order.labProviderName).toBe("");
    expect(order.supplierName).toBeNull();
  });

  test("Gửi without Mã số is refused", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "nocode");
    const res = await save(page, fullSlip(c, patientId, ""));
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe(LAB_SLIP_NO_REQUIRED);
  });

  test("a full Phiếu yêu cầu is sent and every tooth keeps the whole spec", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "full");
    const no = slipNo("full");
    const made = await save(
      page,
      fullSlip(c, patientId, no, {
        caseType: CaseType.Redo,
        zones: { cervicalMesial: "a3", bodyMesial: " a2 ", incisalDistal: "B1" },
        finishLineIds: c.finishLines.map((f) => f.id),
        restorations: [{ materialId: c.alloy.id, onImplant: false }],
        rhythmId: c.rhythm.id,
        biteId: c.bite.id,
      }),
    );
    expect(made.status, made.text).toBe(200);

    const order = await readBack(page, made.body.id!);
    expect(order.status).toBe(LaboStatus.Sent);
    expect(order.labSlipNo).toBe(no);
    expect(order.caseType).toBe(CaseType.Redo);
    expect(order.labProviderName).toBe("");
    expect(order.toothShade).toBe("A3/A2/B1");
    expect(order.teeth.map((t) => t.toothNumber).sort()).toEqual([16, 17]);
    expect([order.rhythmName, order.biteName]).toEqual([c.rhythm.name, c.bite.name]);
    for (const tooth of order.teeth) {
      expect(tooth.shadeZones).toMatchObject({ cervicalMesial: "A3", bodyMesial: "A2", incisalDistal: "B1" });
      expect(tooth.shadeZones?.bodyDistal ?? null).toBeNull();
      expect(tooth.shade).toBe("A3/A2/B1");
      expect(tooth.finishLineIds).toEqual(c.finishLines.map((f) => f.id));
      expect(tooth.finishLineNames).toEqual(c.finishLines.map((f) => f.name));
      expect(tooth.restorations).toEqual([
        { materialId: c.alloy.id, onImplant: false, materialName: c.alloy.name, groupName: c.alloy.groupName },
      ]);
      expect([tooth.rhythmId, tooth.rhythmName, tooth.biteId, tooth.biteName]).toEqual([
        c.rhythm.id,
        c.rhythm.name,
        c.bite.id,
        c.bite.name,
      ]);
    }
  });

  test("Mã số is unique per branch, exact case, and freed by Hủy phiếu", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "dup");
    const no = slipNo("dup");
    const first = await save(page, fullSlip(c, patientId, no));
    expect(first.status, first.text).toBe(200);

    const again = await save(page, fullSlip(c, patientId, no));
    expect(again.status).toBe(403);
    expect(again.body.error?.code).toBe(LAB_SLIP_NO_TAKEN);

    const otherCase = await save(page, fullSlip(c, patientId, no.toLowerCase()));
    expect(otherCase.status, otherCase.text).toBe(200);

    // A draft re-saved under its own number is not a duplicate of itself.
    const draft = await save(page, fullSlip(c, patientId, `${no}-D`, { submit: false }));
    expect(draft.status, draft.text).toBe(200);
    const resaved = await save(page, fullSlip(c, patientId, `${no}-D`, { submit: false }), draft.body.id!);
    expect(resaved.status, resaved.text).toBe(200);

    const cancelled = await call(page, `${LABO_ORDERS}/${first.body.id}/cancel`, {
      method: "POST",
      branchId: BRANCH_ONE,
    });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect((await readBack(page, first.body.id!)).status).toBe(LaboStatus.Cancelled);

    const reused = await save(page, fullSlip(c, patientId, no));
    expect(reused.status, reused.text).toBe(200);
  });

  test("Loại phục hình is one active Vật liệu of this branch, never on an implant", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "restoration");
    const id = runId();
    const refused = async (tag: string, restorations: Restoration[]) => {
      const res = await save(page, fullSlip(c, patientId, slipNo(tag), { restorations }));
      expect(res.status, `${tag}: ${res.text}`).toBe(403);
      expect(res.body.error?.code).toBe(RESTORATION_INVALID);
    };

    await refused("two", [
      { materialId: c.ceramic.id, onImplant: false },
      { materialId: c.alloy.id, onImplant: false },
    ]);
    await refused("imp", [{ materialId: c.implantOther.id, onImplant: true }]);

    const foreign = await newMaterial(page, (await fixedGroups(page, BRANCH_TWO)).TOAN_SU, `CN2 vật liệu ${id}`, BRANCH_TWO);
    await refused("cn2", [{ materialId: foreign.id, onImplant: false }]);

    const retired = await newMaterial(page, c.groups.HOP_KIM, `Ngưng e2e ${id}`);
    const off = await call(page, `${MATERIALS}/${retired.id}/active`, { method: "PUT", branchId: BRANCH_ONE, json: { isActive: false } });
    expect(off.status, off.text).toBe(200);
    await refused("off", [{ materialId: retired.id, onImplant: false }]);

    // Any group's material stands alone now, Khác trên implant included.
    const other = await save(page, fullSlip(c, patientId, slipNo("oth"), { restorations: [{ materialId: c.implantOther.id, onImplant: false }] }));
    expect(other.status, other.text).toBe(200);
  });

  test("Kiểu nhịp and Khớp cắn of another branch or another Danh mục are dropped", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "rhythm");
    const id = runId();
    const foreignRhythm = await taxonomy(page, "labo_rhythm", `CN2 nhịp ${id}`, BRANCH_TWO);
    const made = await save(
      page,
      fullSlip(c, patientId, slipNo("rb"), { rhythmId: foreignRhythm.id, biteId: c.rhythm.id }),
    );
    expect(made.status, made.text).toBe(200);
    const order = await readBack(page, made.body.id!);
    expect([order.rhythmName, order.biteName]).toEqual([null, null]);
    for (const tooth of order.teeth) expect([tooth.rhythmId, tooth.biteId]).toEqual([null, null]);
  });

  test("Gửi needs a Loại phục hình and a Màu răng", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "missing");
    const noRestoration = await save(page, fullSlip(c, patientId, slipNo("nr"), { restorations: [] }));
    expect(noRestoration.status).toBe(403);
    expect(noRestoration.body.error?.code).toBe(RESTORATION_MISSING);

    const noShade = await save(page, fullSlip(c, patientId, slipNo("ns"), { zones: {} }));
    expect(noShade.status).toBe(403);
    expect(noShade.body.error?.code).toBe(TOOTH_SPEC_INCOMPLETE);
  });

  test("the /labo search finds an order by its Mã số", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "search");
    const no = slipNo("find");
    const made = await save(page, fullSlip(c, patientId, no));
    expect(made.status, made.text).toBe(200);

    const found = await call<Paged<SlipOrderView>>(
      page,
      `${LABO_ORDERS}?BranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(no.toLowerCase())}&MaxResultCount=10`,
      { branchId: BRANCH_ONE },
    );
    expect(found.status, found.text).toBe(200);
    expect(found.body.items?.map((o) => o.id)).toContain(made.body.id);
  });
});
