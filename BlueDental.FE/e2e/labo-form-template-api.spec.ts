import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { BRANCH_ONE, call, LABO_ORDERS, laboCatalog, LaboStatus, orderBody, orderPayload, type Paged } from "./fixtures/laboApi";
import { fullSlip, newPatient, slipCatalog, slipNo, type SlipBody } from "./fixtures/laboSlipApi";
import {
  FieldType,
  FORM_TEMPLATES,
  keyOf,
  newTemplate,
  readExtra,
  saveExtra,
  saveTemplate,
  setActive,
  templateName,
  valuesOf,
  type ExtraOrderView,
  type FieldInput,
  type TemplateView,
} from "./fixtures/laboFormTemplateApi";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature F-93: Mẫu phiếu bổ sung — the hybrid of labo.md §11.1. A branch keeps
 * its own lists of extra fields; a Phiếu yêu cầu may pick one (no supplier
 * link) and answers it under Thông tin bổ sung. The order copies the fields it
 * was filled with, so editing, stopping or deleting the template never changes
 * an order already written.
 *
 * Every call is a real HTTP request from the logged-in page — cookie session,
 * antiforgery header, real database — and every write is read back with its own GET.
 */

const code = (n: number) => `BlueDental:Labo:${String(n).padStart(4, "0")}`;
const EXTRA_FIELD_REQUIRED = code(48);
const EXTRA_ANSWER_INVALID = code(49);
const NAME_REQUIRED = code(50);
const NAME_TAKEN = code(51);
const FIELD_COUNT = code(52);
const LABEL_REQUIRED = code(53);
const LABEL_DUPLICATE = code(54);
const OPTIONS_INVALID = code(55);
const TYPE_INVALID = code(56);
const TEMPLATE_UNAVAILABLE = code(57);
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
// The Mẫu phiếu endpoints sit behind Catalogs.*, like Vật liệu Labo: any catalog read leaf opens them.
const PERMISSION_LEAVES = ["catalogService.read"];

function expectRefused(res: { status: number; body: { error?: { code?: string } }; text: string }, errorCode: string) {
  expect(res.status, res.text).toBe(403);
  expect(res.body.error?.code, res.text).toBe(errorCode);
}

async function getTemplate(page: Page, id: string) {
  return call<TemplateView>(page, `${FORM_TEMPLATES}/${id}`, { branchId: BRANCH_ONE });
}

async function listIds(page: Page, query: string, branchId = BRANCH_ONE) {
  const res = await call<Paged<TemplateView>>(page, `${FORM_TEMPLATES}?ClinicBranchId=${branchId}&MaxResultCount=1000&${query}`, {
    branchId,
  });
  expect(res.status, res.text).toBe(200);
  return (res.body.items ?? []).map((t) => t.id);
}

const textFields = (count: number): FieldInput[] =>
  Array.from({ length: count }, (_, i) => ({ label: `Trường ${i + 1}`, type: FieldType.Text }));

async function draftBody(page: Page, tag: string): Promise<SlipBody> {
  const c = await slipCatalog(page);
  const patientId = await newPatient(page, tag);
  return { patientId, dentistId: c.dentistId, teeth: [21], submit: false };
}

test.describe("Labo Mẫu phiếu bổ sung API (F-93)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a template is created, read, found, edited with stable keys, switched off and deleted", async ({ page }) => {
    const name = templateName("Sửa đổi");
    const made = await saveTemplate(page, {
      name: `  ${name}  `,
      description: "  Mô tả e2e  ",
      fields: [
        { label: "  Mã labo ", type: FieldType.Text, required: true, options: ["bỏ qua"] },
        { label: "Hãng sứ", type: FieldType.Select, options: [" Emax ", "", "Cercon"] },
      ],
    });
    expect(made.status, made.text).toBe(200);
    const created = made.body as TemplateView;
    expect(created).toMatchObject({
      name,
      description: "Mô tả e2e",
      isActive: true,
      version: 1,
      clinicBranchId: BRANCH_ONE,
    });
    // Labels and options trimmed; options kept on choice fields only; every field given a key.
    expect(created.fields.map(({ label, type, required, options }) => ({ label, type, required, options }))).toEqual([
      { label: "Mã labo", type: FieldType.Text, required: true, options: [] },
      { label: "Hãng sứ", type: FieldType.Select, required: false, options: ["Emax", "Cercon"] },
    ]);
    const [codeKey, brandKey] = created.fields.map((f) => f.key);
    expect(codeKey).toMatch(/^[0-9a-f]{32}$/);
    expect(brandKey).not.toBe(codeKey);

    const read = await getTemplate(page, created.id);
    expect(read.status, read.text).toBe(200);
    expect(read.body).toMatchObject({ id: created.id, name, version: 1 });

    // Found by an unaccented, lower-case part of the name; the Ngừng filter leaves it out.
    const term = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
    expect(await listIds(page, `Filter=${encodeURIComponent(term)}`)).toEqual([created.id]);
    expect(await listIds(page, "IsActive=true")).toContain(created.id);
    expect(await listIds(page, "IsActive=false")).not.toContain(created.id);

    // Edit: a renamed field keeps its key, a new one is given one, Version goes up.
    const edited = await saveTemplate(
      page,
      {
        name,
        fields: [
          { key: brandKey, label: "Hãng sứ (đổi tên)", type: FieldType.Select, options: ["Lava"] },
          { key: codeKey, label: "Mã labo", type: FieldType.Text, required: false },
          { label: "Số trụ", type: FieldType.Number },
        ],
      },
      { id: created.id },
    );
    expect(edited.status, edited.text).toBe(200);
    const after = (await getTemplate(page, created.id)).body as TemplateView;
    expect(after.version).toBe(2);
    expect(after.description).toBeNull();
    expect(after.fields.map((f) => [f.key, f.label, f.required, f.options])).toEqual([
      [brandKey, "Hãng sứ (đổi tên)", false, ["Lava"]],
      [codeKey, "Mã labo", false, []],
      [after.fields[2].key, "Số trụ", false, []],
    ]);
    expect([codeKey, brandKey]).not.toContain(after.fields[2].key);

    // Ngừng: off the Đang dùng list, Version untouched; an edit without isActive keeps it off.
    await setActive(page, created.id, false);
    expect(await listIds(page, "IsActive=true")).not.toContain(created.id);
    expect(await listIds(page, "IsActive=false")).toContain(created.id);
    const stillOff = await saveTemplate(page, { name, fields: after.fields }, { id: created.id });
    expect(stillOff.status, stillOff.text).toBe(200);
    expect((await getTemplate(page, created.id)).body).toMatchObject({ isActive: false, version: 3 });
    await setActive(page, created.id, true);
    expect((await getTemplate(page, created.id)).body).toMatchObject({ isActive: true, version: 3 });

    const removed = await call(page, `${FORM_TEMPLATES}/${created.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(removed.status, removed.text).toBe(204);
    expect((await getTemplate(page, created.id)).status).toBe(404);
    expect(await listIds(page, "")).not.toContain(created.id);

    // A deleted template's name is free again.
    const again = await saveTemplate(page, { name, fields: textFields(1) });
    expect(again.status, again.text).toBe(200);
  });

  test("the name is required and unique within the branch, ignoring case and outer spaces", async ({ page }) => {
    for (const blank of [undefined, "", "   "]) {
      expectRefused(await saveTemplate(page, { name: blank, fields: textFields(1) }), NAME_REQUIRED);
    }
    const tooLong = await saveTemplate(page, { name: "x".repeat(201), fields: textFields(1) });
    expect(tooLong.status, tooLong.text).toBe(400);

    const first = await newTemplate(page, "Trùng", textFields(1));
    expectRefused(await saveTemplate(page, { name: `  ${first.name.toUpperCase()} `, fields: textFields(1) }), NAME_TAKEN);

    const second = await newTemplate(page, "Khác", textFields(1));
    expectRefused(
      await saveTemplate(page, { name: first.name.toLowerCase(), fields: textFields(1) }, { id: second.id }),
      NAME_TAKEN,
    );
    // Saving a template under its own name is fine.
    const own = await saveTemplate(page, { name: first.name, fields: textFields(2) }, { id: first.id });
    expect(own.status, own.text).toBe(200);

    // Another branch may use the same name.
    const elsewhere = await saveTemplate(page, { name: first.name, fields: textFields(1) }, { branchId: BRANCH_TWO });
    expect(elsewhere.status, elsewhere.text).toBe(200);
    expect(elsewhere.body.clinicBranchId).toBe(BRANCH_TWO);
  });

  test("the field list is checked: count, labels, types, options and keys", async ({ page }) => {
    const save = (fields: FieldInput[]) => saveTemplate(page, { name: templateName("Trường"), fields });

    expectRefused(await save([]), FIELD_COUNT);
    expectRefused(await save(textFields(31)), FIELD_COUNT);
    expect((await save(textFields(30))).status).toBe(200);

    expectRefused(await save([{ label: "A", type: FieldType.Text }, { label: "  ", type: FieldType.Text }]), LABEL_REQUIRED);
    expectRefused(await save([{ label: "Màu", type: FieldType.Text }, { label: " MÀU ", type: FieldType.Number }]), LABEL_DUPLICATE);

    for (const type of [0, 8, 99]) expectRefused(await save([{ label: "Kiểu lạ", type }]), TYPE_INVALID);

    for (const options of [[], ["  ", ""], ["Emax", "emax"], Array.from({ length: 51 }, (_, i) => `L${i}`), ["x".repeat(101)]]) {
      expectRefused(await save([{ label: "Chọn", type: FieldType.Select, options }]), OPTIONS_INVALID);
      expectRefused(await save([{ label: "Chọn nhiều", type: FieldType.MultiSelect, options }]), OPTIONS_INVALID);
    }
    const fifty = await save([{ label: "Đủ 50", type: FieldType.Select, options: Array.from({ length: 50 }, (_, i) => `L${i}`) }]);
    expect(fifty.status, fifty.text).toBe(200);

    // A malformed key, or one sent twice, is replaced; the keys of one template never collide.
    const keys = await save([
      { key: "co dau cach", label: "A", type: FieldType.Text },
      { key: "same-key", label: "B", type: FieldType.Text },
      { key: "same-key", label: "C", type: FieldType.Text },
    ]);
    expect(keys.status, keys.text).toBe(200);
    const [a, b, c] = (keys.body as TemplateView).fields.map((f) => f.key);
    expect(a).not.toBe("co dau cach");
    expect(b).toBe("same-key");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  test("templates stay in their branch", async ({ page, browser }) => {
    const mine = await newTemplate(page, "CN1", textFields(1));
    const theirs = await newTemplate(page, "CN2", textFields(1), BRANCH_TWO);
    expect(await listIds(page, "")).toContain(mine.id);
    expect(await listIds(page, "")).not.toContain(theirs.id);
    expect(await listIds(page, "", BRANCH_TWO)).toContain(theirs.id);

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const read = await call(other, `${FORM_TEMPLATES}/${mine.id}`, { branchId: BRANCH_TWO });
      expect(read.status, read.text).not.toBe(200);
      const edit = await call(other, `${FORM_TEMPLATES}/${mine.id}`, {
        method: "PUT",
        branchId: BRANCH_TWO,
        json: { name: "Chiếm", fields: textFields(1) },
      });
      expect(edit.status, edit.text).not.toBe(200);
      const off = await call(other, `${FORM_TEMPLATES}/${mine.id}/active`, {
        method: "PUT",
        branchId: BRANCH_TWO,
        json: { isActive: false },
      });
      expect(off.status, off.text).not.toBe(200);
      const remove = await call(other, `${FORM_TEMPLATES}/${mine.id}`, { method: "DELETE", branchId: BRANCH_TWO });
      expect(remove.status, remove.text).not.toBe(204);
      const list = await call<Paged<TemplateView>>(other, `${FORM_TEMPLATES}?MaxResultCount=1000`, { branchId: BRANCH_TWO });
      if (list.status === 200) expect((list.body.items ?? []).map((t) => t.id)).not.toContain(mine.id);
    } finally {
      await context.close();
    }
    // Untouched.
    expect((await getTemplate(page, mine.id)).body).toMatchObject({ name: mine.name, isActive: true, version: 1 });

    // A branch-2 template cannot be picked on a branch-1 slip.
    expectRefused(await saveExtra(page, await draftBody(page, "cn2"), theirs.id, []), TEMPLATE_UNAVAILABLE);
  });

  test("a signed-out caller gets nothing", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto("/login");
      const res = await call(page, `${FORM_TEMPLATES}?MaxResultCount=1`, { branchId: BRANCH_ONE });
      expect(res.status, res.text).toBe(401);
    } finally {
      await context.close();
    }
  });

  test("the templates follow the catalog leaves: read lists them, writing needs more", async ({ page, browser }) => {
    test.setTimeout(300_000);
    const id = runId();
    const userName = `bsmau${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI MAU ${id}`;
    const ours = await newTemplate(page, "quyen");
    const body = { name: templateName("quyen-bs"), fields: textFields(1) };

    await resetDentistLeaves(page, PERMISSION_LEAVES);
    await createDentist(page, fullName, userName, password);
    const dentist = await openDentistSession(browser, userName, password);
    try {
      // No leaf: nothing to read, nothing to write.
      let list = await call(dentist.page, `${FORM_TEMPLATES}?ClinicBranchId=${BRANCH_ONE}&MaxResultCount=1`, { branchId: BRANCH_ONE });
      expect(list.status, list.text).toBe(403);
      expect((await saveTemplate(dentist.page, body)).status).toBe(403);

      // catalogService:read — the list and one template, still no create / edit / switch / delete.
      await setDentistLeaf(page, "catalogService.read", true);
      list = await call(dentist.page, `${FORM_TEMPLATES}?ClinicBranchId=${BRANCH_ONE}&MaxResultCount=1`, { branchId: BRANCH_ONE });
      expect(list.status, list.text).toBe(200);
      const one = await getTemplate(dentist.page, ours.id);
      expect(one.status, one.text).toBe(200);
      expect(one.body.name).toBe(ours.name);
      expect((await saveTemplate(dentist.page, body)).status).toBe(403);
      expect((await saveTemplate(dentist.page, { name: ours.name, fields: textFields(2) }, { id: ours.id })).status).toBe(403);
      const stop = await call(dentist.page, `${FORM_TEMPLATES}/${ours.id}/active`, {
        method: "PUT",
        branchId: BRANCH_ONE,
        json: { isActive: false },
      });
      expect(stop.status, stop.text).toBe(403);
      const del = await call(dentist.page, `${FORM_TEMPLATES}/${ours.id}`, { method: "DELETE", branchId: BRANCH_ONE });
      expect(del.status, del.text).toBe(403);

      // Nothing the dentist tried changed the template.
      const after = await getTemplate(page, ours.id);
      expect(after.body.isActive).toBe(true);
      expect(after.body.fields).toHaveLength(ours.fields.length);
    } finally {
      await dentist.context.close();
      await resetDentistLeaves(page, PERMISSION_LEAVES);
      await deleteDentist(page, fullName);
    }
  });

  test("a slip stores every kind of answer cleaned, in the template's field order", async ({ page }) => {
    const template = await newTemplate(page, "Đủ loại");
    const k = (label: string) => keyOf(template, label);
    const made = await saveExtra(page, await draftBody(page, "kinds"), template.id, [
      { key: k("Mã labo"), values: ["  LB-01  "] },
      { key: k("Ghi chú kỹ thuật"), values: ["Dòng 1\nDòng 2"] },
      { key: k("Số lượng trụ"), values: ["-007.50"] },
      { key: k("Hạn bảo hành"), values: ["2027-02-28"] },
      { key: k("Hãng sứ"), values: ["Emax"] },
      { key: k("Phụ kiện"), values: ["Khay", "Trụ", "Khay"] },
      { key: k("Có mẫu hàm"), values: ["True"] },
      { key: "khong-co-truong-nay", values: ["bỏ qua"] },
    ]);
    expect(made.status, made.text).toBe(200);

    const order = await readExtra(page, made.body.id!);
    expect(order.extraForm).toMatchObject({ templateId: template.id, templateName: template.name, version: 1 });
    expect(order.extraForm!.entries.map((e) => [e.key, e.label, e.type, e.required, e.options])).toEqual(
      template.fields.map((f) => [f.key, f.label, f.type, f.required, f.options]),
    );
    expect(valuesOf(order, "Mã labo")).toEqual(["LB-01"]);
    expect(valuesOf(order, "Ghi chú kỹ thuật")).toEqual(["Dòng 1\nDòng 2"]);
    expect(valuesOf(order, "Số lượng trụ")).toEqual(["-7.50"]);
    expect(valuesOf(order, "Hạn bảo hành")).toEqual(["2027-02-28"]);
    expect(valuesOf(order, "Hãng sứ")).toEqual(["Emax"]);
    expect(valuesOf(order, "Phụ kiện")).toEqual(["Trụ", "Khay"]);
    expect(valuesOf(order, "Có mẫu hàm")).toEqual(["true"]);

    // Saved again with some answers cleared: blank ones read back as none.
    const cleared = await saveExtra(
      page,
      await draftBody(page, "kinds2"),
      template.id,
      [
        { key: k("Mã labo"), values: ["   "] },
        { key: k("Có mẫu hàm"), values: ["false"] },
      ],
      order.id,
    );
    expect(cleared.status, cleared.text).toBe(200);
    const reread = await readExtra(page, order.id);
    expect(valuesOf(reread, "Mã labo")).toEqual([]);
    expect(valuesOf(reread, "Số lượng trụ")).toEqual([]);
    expect(valuesOf(reread, "Có mẫu hàm")).toEqual(["false"]);
  });

  test("an answer that does not fit its field is refused", async ({ page }) => {
    const template = await newTemplate(page, "Sai kiểu");
    const k = (label: string) => keyOf(template, label);
    const body = await draftBody(page, "invalid");
    const wrong: [string, string[]][] = [
      ["Mã labo", ["x".repeat(501)]],
      ["Mã labo", ["một", "hai"]],
      ["Ghi chú kỹ thuật", ["x".repeat(4001)]],
      ["Số lượng trụ", ["1,5"]],
      ["Số lượng trụ", ["abc"]],
      ["Số lượng trụ", ["1e3"]],
      ["Hạn bảo hành", ["28/02/2027"]],
      ["Hạn bảo hành", ["2027-02-30"]],
      ["Hãng sứ", ["Zirconia"]],
      ["Hãng sứ", ["Emax", "Lava"]],
      ["Hãng sứ", ["emax"]],
      ["Phụ kiện", ["Trụ", "Sứ"]],
      ["Có mẫu hàm", ["yes"]],
      ["Có mẫu hàm", ["1"]],
    ];
    for (const [label, values] of wrong) {
      const res = await saveExtra(page, body, template.id, [{ key: k(label), values }]);
      expectRefused(res, EXTRA_ANSWER_INVALID);
    }
    const ok = await saveExtra(page, body, template.id, [{ key: k("Mã labo"), values: ["x".repeat(500)] }]);
    expect(ok.status, ok.text).toBe(200);
  });

  test("Lưu nháp keeps a blank Bắt buộc field; Tạo phiếu Labo needs it filled", async ({ page }) => {
    const c = await slipCatalog(page);
    const template = await newTemplate(page, "Bắt buộc");
    const k = (label: string) => keyOf(template, label);
    const patientId = await newPatient(page, "required");
    const slip = fullSlip(c, patientId, slipNo("req"));

    const draft = await saveExtra(page, { ...slip, submit: false }, template.id, []);
    expect(draft.status, draft.text).toBe(200);
    expect((await readExtra(page, draft.body.id!)).status).toBe(LaboStatus.Draft);

    const missing = await saveExtra(page, slip, template.id, [{ key: k("Mã labo"), values: ["LB"] }], draft.body.id);
    expectRefused(missing, EXTRA_FIELD_REQUIRED);
    expect(missing.text).toContain("Hạn bảo hành");
    const blank = await saveExtra(
      page,
      slip,
      template.id,
      [
        { key: k("Mã labo"), values: ["  "] },
        { key: k("Hạn bảo hành"), values: ["2027-01-01"] },
      ],
      draft.body.id,
    );
    expectRefused(blank, EXTRA_FIELD_REQUIRED);
    expect((await readExtra(page, draft.body.id!)).status).toBe(LaboStatus.Draft);

    const sent = await saveExtra(
      page,
      slip,
      template.id,
      [
        { key: k("Mã labo"), values: ["LB-9"] },
        { key: k("Hạn bảo hành"), values: ["2027-01-01"] },
      ],
      draft.body.id,
    );
    expect(sent.status, sent.text).toBe(200);
    const order = await readExtra(page, draft.body.id!);
    expect(order.status).toBe(LaboStatus.Sent);
    expect(valuesOf(order, "Mã labo")).toEqual(["LB-9"]);
    expect(valuesOf(order, "Hạn bảo hành")).toEqual(["2027-01-01"]);

    // Without a template, nothing extra is asked for.
    const plain = await saveExtra(page, fullSlip(c, await newPatient(page, "plain"), slipNo("plain")), undefined, []);
    expect(plain.status, plain.text).toBe(200);
    expect((await readExtra(page, plain.body.id!)).extraForm).toBeNull();
  });

  test("the order keeps its copy when the template is edited, stopped or deleted", async ({ page }) => {
    const template = await newTemplate(page, "Bản sao");
    const k = (label: string) => keyOf(template, label);
    const body = await draftBody(page, "snapshot");
    const answers = [
      { key: k("Mã labo"), values: ["LB-1"] },
      { key: k("Hãng sứ"), values: ["Cercon"] },
    ];
    const made = await saveExtra(page, body, template.id, answers);
    expect(made.status, made.text).toBe(200);
    const id = made.body.id!;
    const before = await readExtra(page, id);

    // The template changes: a label renamed, an option dropped, a field added.
    const edited = await saveTemplate(
      page,
      {
        name: template.name,
        fields: [
          ...template.fields.map((f) =>
            f.label === "Hãng sứ" ? { ...f, label: "Hãng sứ mới", options: ["Lava"] } : f,
          ),
          { label: "Trường mới", type: FieldType.Text, required: true },
        ],
      },
      { id: template.id },
    );
    expect(edited.status, edited.text).toBe(200);

    const resaved = await saveExtra(
      page,
      body,
      template.id,
      [
        { key: k("Mã labo"), values: ["LB-2"] },
        { key: k("Hãng sứ"), values: ["Cercon"] },
      ],
      id,
    );
    expect(resaved.status, resaved.text).toBe(200);
    let order = await readExtra(page, id);
    expect(order.extraForm!.version).toBe(1);
    expect(order.extraForm!.entries.map((e) => [e.label, e.options])).toEqual(
      before.extraForm!.entries.map((e) => [e.label, e.options]),
    );
    expect(order.extraForm!.entries.some((e) => e.label === "Trường mới")).toBe(false);
    // The copy's own options still decide what is valid: Cercon stays allowed.
    expect(valuesOf(order, "Hãng sứ")).toEqual(["Cercon"]);
    expect(valuesOf(order, "Mã labo")).toEqual(["LB-2"]);

    // Stopped, then deleted: the order still saves against its copy.
    await setActive(page, template.id, false);
    expect((await saveExtra(page, body, template.id, answers, id)).status).toBe(200);
    const removed = await call(page, `${FORM_TEMPLATES}/${template.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(removed.status, removed.text).toBe(204);
    const afterDelete = await saveExtra(page, body, template.id, answers, id);
    expect(afterDelete.status, afterDelete.text).toBe(200);
    order = await readExtra(page, id);
    expect(order.extraForm).toMatchObject({ templateId: template.id, templateName: template.name, version: 1 });
    expect(valuesOf(order, "Mã labo")).toEqual(["LB-1"]);

    // A new order cannot pick it any more.
    expectRefused(await saveExtra(page, await draftBody(page, "gone"), template.id, []), TEMPLATE_UNAVAILABLE);
  });

  test("a stopped or unknown template cannot be newly picked", async ({ page }) => {
    const stopped = await newTemplate(page, "Ngừng", textFields(1));
    await setActive(page, stopped.id, false);
    const body = await draftBody(page, "stopped");
    expectRefused(await saveExtra(page, body, stopped.id, []), TEMPLATE_UNAVAILABLE);
    expectRefused(await saveExtra(page, body, "00000000-0000-0000-0000-00000000f093", []), TEMPLATE_UNAVAILABLE);

    await setActive(page, stopped.id, true);
    const picked = await saveExtra(page, body, stopped.id, []);
    expect(picked.status, picked.text).toBe(200);
  });

  test("switching the template takes a fresh copy; none clears the section", async ({ page }) => {
    const first = await newTemplate(page, "Mẫu A");
    const second = await newTemplate(page, "Mẫu B", [
      { label: "Loại khay", type: FieldType.Select, options: ["Nhựa", "Kim loại"] },
    ]);
    const body = await draftBody(page, "switch");
    const made = await saveExtra(page, body, first.id, [{ key: keyOf(first, "Mã labo"), values: ["LB-A"] }]);
    expect(made.status, made.text).toBe(200);
    const id = made.body.id!;

    // The first template's answer keys mean nothing to the second.
    const switched = await saveExtra(
      page,
      body,
      second.id,
      [
        { key: keyOf(first, "Mã labo"), values: ["LB-A"] },
        { key: keyOf(second, "Loại khay"), values: ["Nhựa"] },
      ],
      id,
    );
    expect(switched.status, switched.text).toBe(200);
    let order = await readExtra(page, id);
    expect(order.extraForm).toMatchObject({ templateId: second.id, templateName: second.name });
    expect(order.extraForm!.entries.map((e) => [e.label, e.values])).toEqual([["Loại khay", ["Nhựa"]]]);

    // Going back to a template the order no longer holds needs it live again.
    await setActive(page, first.id, false);
    expectRefused(await saveExtra(page, body, first.id, [], id), TEMPLATE_UNAVAILABLE);
    order = await readExtra(page, id);
    expect(order.extraForm?.templateId).toBe(second.id);

    const cleared = await saveExtra(page, body, undefined, [{ key: keyOf(second, "Loại khay"), values: ["Nhựa"] }], id);
    expect(cleared.status, cleared.text).toBe(200);
    expect((await readExtra(page, id)).extraForm).toBeNull();
  });

  test("an old-form (Classic) order never keeps an extra section", async ({ page }) => {
    const template = await newTemplate(page, "Classic", textFields(1));
    const id = runId();
    const catalog = await laboCatalog(page, BRANCH_ONE, id);
    const patientId = await newPatient(page, "classic");
    const body = orderPayload(orderBody(catalog, { patientId, branchId: BRANCH_ONE }, id));
    const made = await call<ExtraOrderView>(page, LABO_ORDERS, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        ...body,
        layout: 1,
        extraFormTemplateId: template.id,
        extraFormAnswers: [{ key: template.fields[0].key, values: ["bỏ qua"] }],
      },
    });
    expect(made.status, made.text).toBe(200);
    const order = await readExtra(page, made.body.id!);
    expect(order.layout).toBe(1);
    expect(order.extraForm).toBeNull();
  });
});
