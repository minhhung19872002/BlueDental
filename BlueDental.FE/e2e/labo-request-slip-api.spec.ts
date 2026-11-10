import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call, LABO_ORDERS, LaboStatus, type Paged } from "./fixtures/laboApi";
import {
  CaseType,
  fullSlip,
  Layout,
  newPatient,
  post,
  readBack,
  save,
  slipCatalog,
  slipNo,
  type SlipOrderView,
} from "./fixtures/laboSlipApi";

/**
 * Feature F-91: the Labo Phiếu yêu cầu (BA mock "bản 2 nhập mã số, không kế
 * hoạch nhà cung cấp") — Mã số typed by hand and kept unique per branch,
 * Loại phục hình from Danh mục vật liệu (Trên implant only where the material
 * allows it), Màu răng in six zones, Đường hoàn tất several at once, all of
 * it entered once and stored on every tooth, no supplier and no slip link.
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
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

test.describe("Labo Phiếu yêu cầu API (F-91)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a material can be marked Trên implant and reads back so", async ({ page }) => {
    const c = await slipCatalog(page);
    const res = await call<Paged<{ id: string; allowOnImplant: boolean }>>(
      page,
      `/api/v1/app/labo-materials?ClinicBranchId=${BRANCH_ONE}&MaxResultCount=1000`,
      { branchId: BRANCH_ONE },
    );
    expect(res.status, res.text).toBe(200);
    const byId = new Map((res.body.items ?? []).map((m) => [m.id, m.allowOnImplant]));
    expect(byId.get(c.implantMaterial.id)).toBe(true);
    expect(byId.get(c.plainMaterial.id)).toBe(false);
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
        restorations: [
          { materialId: c.implantMaterial.id, onImplant: true },
          { materialId: c.plainMaterial.id, onImplant: false },
        ],
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
    for (const tooth of order.teeth) {
      expect(tooth.shadeZones).toMatchObject({ cervicalMesial: "A3", bodyMesial: "A2", incisalDistal: "B1" });
      expect(tooth.shadeZones?.bodyDistal ?? null).toBeNull();
      expect(tooth.shade).toBe("A3/A2/B1");
      expect(tooth.finishLineIds).toEqual(c.finishLines.map((f) => f.id));
      expect(tooth.finishLineNames).toEqual(c.finishLines.map((f) => f.name));
      expect(tooth.restorations).toEqual([
        { materialId: c.implantMaterial.id, onImplant: true, materialName: c.implantMaterial.name, groupName: c.groupName },
        { materialId: c.plainMaterial.id, onImplant: false, materialName: c.plainMaterial.name, groupName: c.groupName },
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

  test("Trên implant needs a material that allows it, of this branch", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "implant");
    const plainOnImplant = await save(
      page,
      fullSlip(c, patientId, slipNo("imp"), { restorations: [{ materialId: c.plainMaterial.id, onImplant: true }] }),
    );
    expect(plainOnImplant.status).toBe(403);
    expect(plainOnImplant.body.error?.code).toBe(RESTORATION_INVALID);

    const id = runId();
    const group = await post(page, "/api/v1/app/taxonomies", { group: "labo_material", name: `CN2 e2e ${id}`, clinicBranchId: BRANCH_TWO }, BRANCH_TWO);
    const foreign = await post(
      page,
      "/api/v1/app/labo-materials",
      { name: `CN2 vật liệu ${id}`, taxonomyId: group.id, clinicBranchId: BRANCH_TWO, allowOnImplant: true },
      BRANCH_TWO,
    );
    const foreignRes = await save(
      page,
      fullSlip(c, patientId, slipNo("cn2"), { restorations: [{ materialId: foreign.id, onImplant: false }] }),
    );
    expect(foreignRes.status).toBe(403);
    expect(foreignRes.body.error?.code).toBe(RESTORATION_INVALID);
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
