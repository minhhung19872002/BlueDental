import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { BRANCH_ONE, call, LaboStatus, type Paged } from "./fixtures/laboApi";
import {
  BlockKind,
  FieldType,
  FORM_TEMPLATES,
  keyOf,
  readExtra,
  saveExtra,
  saveTemplate,
  systemBlocks,
  templateName,
  valuesOf,
  type BlockInput,
  type BlockView,
  type FieldInput,
  type TemplateView,
} from "./fixtures/laboFormTemplateApi";
import { fullSlip, newPatient, slipCatalog, slipNo } from "./fixtures/laboSlipApi";
import { day, openLaboTab, patientRow, pickTeeth, sentOrder, slipDialog, startSlip, typeDate } from "./fixtures/laboSlipUi";

/**
 * Feature F-94: the Mẫu phiếu lays out the whole Phiếu yêu cầu. The slip's own
 * blocks (Thông tin phiếu, Loại phục hình, Màu răng, Chỉ định, Đường hoàn tất,
 * Yêu cầu) are renamed, resized, reordered or hidden — Thông tin phiếu and Chỉ
 * định always shown — with the template's own sections among them; the slip
 * and its print follow the order's copy of that layout. Real login, real API,
 * real database, no interception; every write is read back with its own GET.
 */

const code = (n: number) => `BlueDental:Labo:${String(n).padStart(4, "0")}`;
const TOOTH_SPEC_INCOMPLETE = code(34);
const RESTORATION_MISSING = code(44);
const FIELD_COUNT = code(52);
const LAYOUT_INVALID = code(58);
const BLOCK_TITLE_REQUIRED = code(59);
const BLOCK_EMPTY = code(60);

type Refusable = { status: number; body: { error?: { code?: string } }; text: string };

function expectRefused(res: Refusable, errorCode: string) {
  expect(res.status, res.text).toBe(403);
  expect(res.body.error?.code, res.text).toBe(errorCode);
}

const section = (key: string, title: string, span = 3): BlockInput => ({ key, kind: BlockKind.Custom, title, span });

/** The system blocks with one change applied to the block of `kind`. */
function withSystem(kind: number, change: Partial<BlockInput>): BlockInput[] {
  return systemBlocks().map((block) => (block.kind === kind ? { ...block, ...change } : block));
}

/** The layout's shape, without keys a system block is given by the server. */
const shapeOf = (blocks: BlockView[]) => blocks.map((b) => [b.kind, b.title, b.visible, b.span]);

async function getTemplate(page: Page, id: string) {
  const res = await call<TemplateView>(page, `${FORM_TEMPLATES}/${id}`, { branchId: BRANCH_ONE });
  expect(res.status, res.text).toBe(200);
  return res.body as TemplateView;
}

async function layoutTemplate(page: Page, tag: string, blocks: BlockInput[], fields: FieldInput[]) {
  const res = await saveTemplate(page, { name: templateName(tag), blocks, fields });
  expect(res.status, res.text).toBe(200);
  return res.body as TemplateView;
}

async function templateByName(page: Page, name: string): Promise<TemplateView> {
  const res = await call<Paged<TemplateView>>(
    page,
    `${FORM_TEMPLATES}?ClinicBranchId=${BRANCH_ONE}&Filter=${encodeURIComponent(name)}&MaxResultCount=10`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status, res.text).toBe(200);
  const found = (res.body.items ?? []).find((template) => template.name === name);
  expect(found, `template ${name}`).toBeTruthy();
  return found!;
}

/** Opens an AntD Select and picks the option with this exact text. */
async function choose(page: Page, field: Locator, option: string) {
  await field.click();
  await page.locator(".ant-select-dropdown:visible").last().locator(".ant-select-item-option").filter({ hasText: new RegExp(`^${option}$`) }).click();
  // The list fades out; the next Select must not catch its closing options.
  await expect(page.locator(".ant-select-dropdown:visible")).toHaveCount(0);
}

test.describe("Labo Mẫu phiếu layout API (F-94)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a layout holds every system block once, known kinds only, at most ten titled sections with a field each", async ({ page }) => {
    const field: FieldInput = { label: "Mã labo", type: FieldType.Text, blockKey: "s1" };
    const save = (blocks: BlockInput[], fields: FieldInput[] = [field]) =>
      saveTemplate(page, { name: templateName("Bố cục sai"), blocks, fields });

    await test.step("a system block missing, twice, or of a kind there is not: 0058", async () => {
      const noNotes = systemBlocks().filter((b) => b.kind !== BlockKind.Notes);
      expectRefused(await save([...noNotes, section("s1", "Mục")]), LAYOUT_INVALID);
      expectRefused(await save([...systemBlocks(), { kind: BlockKind.Info }, section("s1", "Mục")]), LAYOUT_INVALID);
      expectRefused(await save([...systemBlocks(), { kind: 42 }, section("s1", "Mục")]), LAYOUT_INVALID);
    });

    await test.step("eleven sections, or two with one key: 0058", async () => {
      const eleven = Array.from({ length: 11 }, (_, i) => section(`s${i + 1}`, `Mục ${i + 1}`));
      const fields = eleven.map((b, i) => ({ label: `Trường ${i + 1}`, type: FieldType.Text, blockKey: b.key }));
      expectRefused(await save([...systemBlocks(), ...eleven], fields), LAYOUT_INVALID);
      expectRefused(await save([...systemBlocks(), section("s1", "Một"), section("s1", "Hai")]), LAYOUT_INVALID);
    });

    await test.step("a section with no title, or no field: 0059 / 0060", async () => {
      expectRefused(await save([...systemBlocks(), section("s1", "  ")]), BLOCK_TITLE_REQUIRED);
      const fields = [field];
      expectRefused(await save([...systemBlocks(), section("s1", "Có trường"), section("s2", "Trống")], fields), BLOCK_EMPTY);
    });

    await test.step("no layout and no field is still refused as before: 0052", async () => {
      expectRefused(await saveTemplate(page, { name: templateName("Rỗng"), fields: [] }), FIELD_COUNT);
    });
  });

  test("the layout is kept as sent: order, headings, widths, hidden blocks; locked blocks show, widths are held to 1–3", async ({ page }) => {
    await test.step("a layout of system blocks only needs no field", async () => {
      const made = await layoutTemplate(page, "Chỉ khối hệ thống", withSystem(BlockKind.Shade, { visible: false }), []);
      expect(made.fields).toEqual([]);
      expect(made.blocks.map((b) => b.kind)).toEqual(systemBlocks().map((b) => b.kind));
      expect(made.blocks.find((b) => b.kind === BlockKind.Shade)?.visible).toBe(false);
    });

    const blocks: BlockInput[] = [
      { kind: BlockKind.Info, span: 3, visible: false },
      { kind: BlockKind.Teeth, span: 1, title: "Răng làm", visible: false },
      { kind: BlockKind.Restoration, span: 9 },
      section("tech", "Kỹ thuật", 1),
      { kind: BlockKind.Shade, span: 0, title: "  Màu sắc  " },
      { kind: BlockKind.FinishLine, visible: false },
      section("ship", "Giao nhận", 2),
      { kind: BlockKind.Notes, title: "Dặn dò" },
    ];
    const fields: FieldInput[] = [
      { label: "Loại trụ", type: FieldType.Select, options: ["Straumann", "Osstem"], blockKey: "tech" },
      { label: "Ngày giao", type: FieldType.Date, blockKey: "ship" },
      { label: "Không rõ mục", type: FieldType.Text, blockKey: "nowhere" },
    ];
    const made = await layoutTemplate(page, "Bố cục riêng", blocks, fields);

    await test.step("read back with its own GET, as laid out", async () => {
      const back = await getTemplate(page, made.id);
      expect(shapeOf(back.blocks)).toEqual([
        [BlockKind.Info, null, true, 3],
        [BlockKind.Teeth, "Răng làm", true, 1],
        [BlockKind.Restoration, null, true, 3],
        [BlockKind.Custom, "Kỹ thuật", true, 1],
        [BlockKind.Shade, "Màu sắc", true, 1],
        [BlockKind.FinishLine, null, false, 3],
        [BlockKind.Custom, "Giao nhận", true, 2],
        [BlockKind.Notes, "Dặn dò", true, 3],
      ]);
      expect(back.blocks.filter((b) => b.kind === BlockKind.Custom).map((b) => b.key)).toEqual(["tech", "ship"]);
      // A field naming no section of the layout goes to the first one.
      expect(back.fields.map((f) => [f.label, f.blockKey])).toEqual([
        ["Loại trụ", "tech"],
        ["Ngày giao", "ship"],
        ["Không rõ mục", "tech"],
      ]);
    });

    await test.step("a template saved the F-93 way reads as the slip's own layout with one Thông tin bổ sung section", async () => {
      const res = await saveTemplate(page, { name: templateName("Kiểu cũ"), fields: [{ label: "Mã labo", type: FieldType.Text }] });
      expect(res.status, res.text).toBe(200);
      const back = await getTemplate(page, res.body.id);
      expect(shapeOf(back.blocks)).toEqual([
        [BlockKind.Info, null, true, 3],
        [BlockKind.Restoration, null, true, 2],
        [BlockKind.Teeth, null, true, 1],
        [BlockKind.Shade, null, true, 1],
        [BlockKind.FinishLine, null, true, 2],
        [BlockKind.Custom, null, true, 3],
        [BlockKind.Notes, null, true, 3],
      ]);
      expect(back.fields.map((f) => f.blockKey)).toEqual(["extra"]);
    });
  });

  test("an order keeps its copy of the layout; what the layout hides is neither kept nor asked for", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "layout-api");
    const hiding = await layoutTemplate(
      page,
      "Ẩn khối",
      [
        ...systemBlocks().map((b) =>
          [BlockKind.Restoration, BlockKind.Shade, BlockKind.FinishLine, BlockKind.Notes].includes(b.kind as 2 | 3 | 5 | 6)
            ? { ...b, visible: false }
            : b,
        ),
        section("lab", "Phòng lab"),
      ],
      [{ label: "Mã labo", type: FieldType.Text, required: true, blockKey: "lab" }],
    );

    await test.step("a layout that shows them still asks for Loại phục hình and Màu răng", async () => {
      const shown = await layoutTemplate(page, "Hiện đủ", [...systemBlocks(), section("lab", "Phòng lab")], [
        { label: "Mã labo", type: FieldType.Text, blockKey: "lab" },
      ]);
      const body = fullSlip(c, patientId, slipNo("lay0"), { restorations: [] });
      expectRefused(await saveExtra(page, body, shown.id, []), RESTORATION_MISSING);
      const noShade = fullSlip(c, patientId, slipNo("lay1"), { zones: {} });
      expectRefused(await saveExtra(page, noShade, shown.id, []), TOOTH_SPEC_INCOMPLETE);
    });

    const no = slipNo("lay2");
    let orderId = "";

    await test.step("hidden, they are dropped from what the form sent and the slip is sent without them", async () => {
      const body = fullSlip(c, patientId, no, {
        notes: "Không được giữ",
        finishLineIds: [c.finishLines[0].id],
      });
      const res = await saveExtra(page, body, hiding.id, [{ key: keyOf(hiding, "Mã labo"), values: ["ML-9"] }]);
      expect(res.status, res.text).toBe(200);
      orderId = res.body.id;

      const order = await readExtra(page, orderId);
      expect(order.status).toBe(LaboStatus.Sent);
      expect(order.notes ?? null).toBeNull();
      for (const tooth of order.teeth) {
        expect(tooth.restorations).toEqual([]);
        expect(tooth.finishLineIds).toEqual([]);
        expect(Object.values(tooth.shadeZones ?? {}).every((zone) => zone == null)).toBe(true);
      }
      expect(valuesOf(order, "Mã labo")).toEqual(["ML-9"]);
      expect(shapeOf(order.extraForm!.blocks)).toEqual(shapeOf(hiding.blocks));
      expect(order.extraForm!.entries.map((e) => e.blockKey)).toEqual(["lab"]);
    });

    await test.step("the template edited afterwards leaves the order's layout as it was", async () => {
      const edited = await saveTemplate(
        page,
        { name: hiding.name, blocks: [...systemBlocks(), section("lab", "Đổi tên")], fields: hiding.fields },
        { id: hiding.id },
      );
      expect(edited.status, edited.text).toBe(200);
      const order = await readExtra(page, orderId);
      expect(shapeOf(order.extraForm!.blocks)).toEqual(shapeOf(hiding.blocks));
      expect(order.extraForm!.blocks.find((b) => b.kind === BlockKind.Custom)?.title).toBe("Phòng lab");
    });
  });
});

test.describe("Labo Mẫu phiếu layout UI (F-94)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the builder renames, resizes, hides and moves the slip's blocks, adds and removes a section, and saves the layout", async ({ page }) => {
    const name = templateName("Bố cục UI");
    await page.goto(`/labo/form-template?branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, FORM_TEMPLATES);

    const dialog = page.getByRole("dialog").filter({ has: page.locator(".ft-dialog") });
    const problem = dialog.locator(".ft-problem");
    const saveButton = dialog.locator(".bd-modal-foot-actions .ant-btn-primary");
    const blockRow = (text: string) => dialog.getByTestId("form-block-row").filter({ has: page.getByLabel(`Tiêu đề khối ${text}`) });

    await test.step("a new template starts from the slip's own blocks; Thông tin phiếu and Chỉ định cannot be hidden", async () => {
      await page.getByRole("button", { name: "Tạo mẫu phiếu" }).click();
      await expect(dialog.getByTestId("form-block-row")).toHaveCount(7);
      await expect(dialog.getByLabel("Tiêu đề khối 6")).toHaveValue("Thông tin bổ sung");
      for (const locked of ["Thông tin phiếu", "Chỉ định"]) {
        await expect(blockRow(locked)).toContainText("Luôn hiện");
        await expect(dialog.getByRole("switch", { name: `Hiện khối ${locked}` })).toHaveCount(0);
      }
      await expect(dialog.getByRole("button", { name: "Đưa khối Thông tin phiếu lên trên" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Đưa khối Yêu cầu xuống dưới" })).toBeDisabled();
      await dialog.getByLabel("Tên mẫu").fill(name);
      await dialog.getByLabel("Tên trường 1").fill("Mã labo");
      await expect(problem).toHaveCount(0);
    });

    await test.step("system blocks are renamed, resized and hidden", async () => {
      await dialog.getByLabel("Tiêu đề khối Màu răng").fill("Màu sắc");
      await choose(page, dialog.getByLabel("Độ rộng khối Màu răng"), "Cả dòng");
      await dialog.getByRole("switch", { name: "Hiện khối Đường hoàn tất" }).click();
      await expect(dialog.getByRole("switch", { name: "Hiện khối Đường hoàn tất" })).not.toBeChecked();
    });

    await test.step("Thêm mục adds a section before Yêu cầu; untitled, it stops Lưu", async () => {
      await dialog.getByRole("button", { name: "Thêm mục" }).click();
      await expect(dialog.getByTestId("form-block-row")).toHaveCount(8);
      await expect(dialog).toContainText("2/10 mục");
      await expect(problem).toHaveText("Khối 7 chưa có tiêu đề");
      await expect(saveButton).toBeDisabled();
      await dialog.getByLabel("Tiêu đề khối 7").fill("Kỹ thuật");
      await expect(problem).toHaveText("Trường 2 chưa có tên");
      await dialog.getByLabel("Tên trường 2").fill("Loại trụ");
      await expect(problem).toHaveCount(0);
    });

    await test.step("Yêu cầu moves up above the new section", async () => {
      await dialog.getByRole("button", { name: "Đưa khối Yêu cầu lên trên" }).click();
      await expect(dialog.getByLabel("Tiêu đề khối 8")).toHaveValue("Kỹ thuật");
    });

    await test.step("Lưu keeps the layout as built", async () => {
      await saveButton.click();
      await expect(page.getByText("Đã thêm").first()).toBeVisible();
      await expect(dialog).toBeHidden();
      const made = await templateByName(page, name);
      expect(shapeOf(made.blocks)).toEqual([
        [BlockKind.Info, null, true, 3],
        [BlockKind.Restoration, null, true, 2],
        [BlockKind.Teeth, null, true, 1],
        [BlockKind.Shade, "Màu sắc", true, 3],
        [BlockKind.FinishLine, null, false, 2],
        [BlockKind.Custom, "Thông tin bổ sung", true, 3],
        [BlockKind.Notes, null, true, 3],
        [BlockKind.Custom, "Kỹ thuật", true, 3],
      ]);
      const sections = made.blocks.filter((b) => b.kind === BlockKind.Custom).map((b) => b.key);
      expect(made.fields.map((f) => [f.label, f.blockKey])).toEqual([
        ["Mã labo", sections[0]],
        ["Loại trụ", sections[1]],
      ]);
    });

    await test.step("Sửa loads it back; a section removed takes its fields with it", async () => {
      const before = await templateByName(page, name);
      await page.getByRole("textbox", { name: "Tìm mẫu phiếu" }).fill(name);
      await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
      await expect(dialog.getByLabel("Tiêu đề khối Màu răng")).toHaveValue("Màu sắc");
      await expect(dialog.getByRole("switch", { name: "Hiện khối Đường hoàn tất" })).not.toBeChecked();
      await expect(dialog.getByLabel("Tiêu đề khối 8")).toHaveValue("Kỹ thuật");
      await dialog.getByRole("button", { name: "Xoá khối 8" }).click();
      await expect(dialog.getByTestId("form-block-row")).toHaveCount(7);
      await saveButton.click();
      await expect(page.getByText("Đã cập nhật").first()).toBeVisible();

      const after = await templateByName(page, name);
      expect(after.version).toBe(2);
      expect(after.blocks.filter((b) => b.kind === BlockKind.Custom).map((b) => b.key)).toEqual([before.blocks[5].key]);
      expect(after.fields.map((f) => f.label)).toEqual(["Mã labo"]);
      expect(after.fields[0].key).toBe(before.fields[0].key);
    });
  });

  test("the slip and its print follow the order's layout: blocks in order, own headings, hidden ones left out", async ({ page }) => {
    const c = await slipCatalog(page);
    const patientId = await newPatient(page, "layout-ui");
    const no = slipNo("layui");
    const template = await layoutTemplate(
      page,
      "Phiếu bố cục",
      [
        { kind: BlockKind.Info, span: 3 },
        { kind: BlockKind.Teeth, span: 1, title: "Răng làm" },
        { kind: BlockKind.Restoration, span: 2 },
        section("tech", "Kỹ thuật", 3),
        { kind: BlockKind.Shade, visible: false },
        { kind: BlockKind.FinishLine, visible: false },
        { kind: BlockKind.Notes, span: 3, title: "Dặn dò" },
      ],
      [
        { label: "Loại trụ", type: FieldType.Select, options: ["Straumann", "Osstem"], required: true, blockKey: "tech" },
        { label: "Có mẫu hàm", type: FieldType.YesNo, blockKey: "tech" },
      ],
    );

    await test.step("picked, the slip is laid out by the template", async () => {
      const dialog = await startSlip(page, patientId);
      await choose(page, dialog.getByLabel("Mẫu phiếu", { exact: true }), template.name);
      const blocks = dialog.locator(".rs-blocks > .rs-block");
      await expect(blocks).toHaveCount(5);
      const order = await blocks.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-kind") ?? `section:${node.getAttribute("aria-label")}`),
      );
      expect(order).toEqual(["1", "4", "2", "section:Kỹ thuật", "6"]);
      await expect(blocks.nth(1)).toContainText("Răng làm");
      await expect(blocks.nth(4)).toContainText("Dặn dò");
      await expect(dialog.locator(".rs-shade")).toHaveCount(0);
      await expect(dialog.getByText("Đường hoàn tất", { exact: true })).toHaveCount(0);
      await expect(blocks.nth(1)).toHaveClass(/is-span-1/);
      await expect(blocks.nth(2)).toHaveClass(/is-span-2/);
    });

    await test.step("filled without Màu răng, the slip is sent", async () => {
      const dialog = slipDialog(page);
      await dialog.getByLabel("Mã số", { exact: true }).fill(no);
      await dialog.getByLabel("Bác sĩ chỉ định").click();
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
      await typeDate(dialog.getByLabel("Ngày nhận dự kiến"), day(5));
      await pickTeeth(page, dialog, [16, 17]);
      await dialog.getByLabel(`${c.ceramic.name} – Trên implant`, { exact: true }).check();
      await dialog.getByLabel("Yêu cầu", { exact: true }).fill("Làm sát nướu");
      const tech = dialog.getByRole("region", { name: "Kỹ thuật" });
      await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toBeDisabled();
      await choose(page, tech.getByLabel("Loại trụ", { exact: true }), "Osstem");
      await choose(page, tech.getByLabel("Có mẫu hàm", { exact: true }), "Có");
      await expect(dialog.getByRole("status")).toHaveText("Phiếu đã đủ thông tin.");
      await dialog.getByRole("button", { name: "Tạo phiếu Labo" }).click();

      const sent = await sentOrder(page, patientId, no);
      const order = await readExtra(page, sent.id);
      expect(shapeOf(order.extraForm!.blocks)).toEqual(shapeOf(template.blocks));
      expect(order.notes).toBe("Làm sát nướu");
      expect(valuesOf(order, "Loại trụ")).toEqual(["Osstem"]);
      expect(order.teeth.every((tooth) => tooth.restorations.length === 1)).toBe(true);
    });

    await test.step("reopened after a reload, the sent slip keeps the layout, shut", async () => {
      await openLaboTab(page, patientId);
      await page.reload();
      await patientRow(page, no).getByRole("button", { name: "Xem chi tiết" }).click();
      await page.getByRole("dialog").getByRole("tab", { name: "Đặt hàng" }).click();
      const dialog = slipDialog(page);
      await expect(dialog.locator(".rs-blocks > .rs-block")).toHaveCount(5);
      await expect(dialog.getByRole("region", { name: "Kỹ thuật" })).toContainText("Osstem");
      await expect(dialog.getByLabel("Mẫu phiếu", { exact: true })).toBeDisabled();
    });

    await test.step("In Phiếu Labo prints the blocks in the same order under the same headings", async () => {
      await page.goto(`/labo?branchId=${BRANCH_ONE}`);
      const row = page.locator(".bd-labo-screen tbody tr.ant-table-row").filter({ hasText: no }).first();
      await row.getByRole("button", { name: "Xem", exact: true }).click();
      const sheet = page.locator(".pd-slip-print");
      await expect(sheet).toContainText(`Mã số: ${no}`);
      await expect(sheet.locator(".pd-slip-print-block > h3")).toHaveText([
        "Thông tin phiếu",
        "Răng làm",
        "LOẠI PHỤC HÌNH",
        "Kỹ thuật",
        "Dặn dò",
      ]);
      const tech = sheet.locator(".pd-slip-print-block").filter({ hasText: "Kỹ thuật" });
      await expect(tech).toContainText("Loại trụ: Osstem");
      await expect(tech).toContainText("Có mẫu hàm: Có");
      await expect(sheet).toContainText("Làm sát nướu");
      await expect(sheet).not.toContainText("Màu răng");
      await expect(sheet).not.toContainText("Đường hoàn tất");
    });
  });
});
