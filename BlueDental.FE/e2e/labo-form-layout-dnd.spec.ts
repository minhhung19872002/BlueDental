import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";
import { BRANCH_ONE, call, type Paged } from "./fixtures/laboApi";
import { BlockKind, FORM_TEMPLATES, templateName, type TemplateView } from "./fixtures/laboFormTemplateApi";

/**
 * R-1202 (F-94): the Mẫu phiếu builder by drag and drop, with its preview.
 * Blocks move by their grip — keyboard included — and by the preview; fields
 * move by their grip into another section, an emptied section saying so until
 * one lands in it; the preview draws the shown blocks in order at their
 * widths, names the hidden ones, and a click on a block opens its card. Real
 * login, real API, real database, no interception; the saved layout is read
 * back with its own GET.
 */

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

/**
 * A pointer drag dnd-kit sees: press, pass its 5px threshold, glide, settle,
 * release. The target is measured again at each step — the list may scroll
 * under the drag, and a fixed end point would then miss it.
 */
async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  if (!start) throw new Error("drag: handle not on screen");
  let x = start.x + start.width / 2;
  let y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 10, { steps: 3 });
  y += 10;
  for (let left = 12; left > 0; left--) {
    const end = await to.boundingBox();
    if (!end) throw new Error("drag: target not on screen");
    x += (end.x + end.width / 2 - x) / left;
    y += (end.y + end.height / 2 - y) / left;
    await page.mouse.move(x, y, { steps: 2 });
  }
  await page.mouse.move(x, y + 1, { steps: 2 });
  await page.mouse.up();
}

test.describe("Labo Mẫu phiếu builder drag and drop + preview (R-1202)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("blocks and fields move by drag, the preview follows the layout and moves it too, and Lưu keeps it", async ({ page }) => {
    const name = templateName("Kéo thả");
    await page.goto(`/labo/form-template?branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, FORM_TEMPLATES);

    const dialog = page.getByRole("dialog").filter({ has: page.locator(".ft-dialog") });
    const problem = dialog.locator(".ft-problem");
    const saveButton = dialog.locator(".bd-modal-foot-actions .ant-btn-primary");
    const preview = dialog.getByRole("complementary", { name: "Xem trước" });
    const previewBlocks = preview.getByTestId("form-preview-block");
    // A preview block is named by its title; the slip part inside draws the heading its own way.
    const previewBlock = (title: string) => preview.getByRole("button", { name: new RegExp(`^${title}$`, "i") });
    const previewTitles = () => previewBlocks.evaluateAll((blocks) => blocks.map((b) => b.getAttribute("aria-label")?.toLowerCase()));
    const blockGrips = dialog.locator(".ft-sortable--block > .ft-grip");
    const blockOrder = () => blockGrips.evaluateAll((grips) => grips.map((g) => g.getAttribute("aria-label")));
    const titleField = (n: number) => dialog.getByLabel(`Tiêu đề khối ${n}`);
    // `has` resolves inside the row, so its locator must not start from the dialog.
    const sectionAt = (n: number) =>
      dialog.getByTestId("form-block-row").filter({ has: page.getByLabel(`Tiêu đề khối ${n}`) });

    await test.step("the preview draws the slip's blocks in order, each at its width", async () => {
      await page.getByRole("button", { name: "Tạo mẫu phiếu" }).click();
      await dialog.getByLabel("Tên mẫu").fill(name);
      // A new template holds the slip's own blocks alone (owner, 2026-11-11).
      await expect(previewBlocks).toHaveCount(6);
      expect(await previewTitles()).not.toContain("thông tin bổ sung");
      await dialog.getByRole("button", { name: "Thêm mục" }).click();
      await titleField(6).fill("Thông tin bổ sung");
      await dialog.getByLabel("Tên trường 1").fill("Mã labo");
      await expect(previewBlocks).toHaveCount(7);
      expect(await previewTitles()).toEqual([
        "thông tin phiếu", "loại phục hình", "màu răng", "chỉ định", "đường hoàn tất",
        "thông tin bổ sung", "yêu cầu",
      ]);
      const spans = await previewBlocks.evaluateAll((blocks) => blocks.map((b) => /is-span-(\d)/.exec(b.className)?.[1]));
      expect(spans).toEqual(["3", "1", "1", "1", "1", "3", "3"]);
      await expect(previewBlock("Thông tin bổ sung")).toContainText("Mã labo");
    });

    await test.step("Yêu cầu moves up a place from the keyboard: grip, Space, ↑, Space", async () => {
      await dialog.getByRole("button", { name: "Kéo khối Yêu cầu" }).focus();
      await page.keyboard.press("Space");
      await expect(dialog.locator(".ft-sortable--block.is-dragging")).toHaveCount(1);
      // The drag measures its targets first; ↑ before that has nowhere to go.
      await expect(async () => {
        await page.keyboard.press("ArrowUp");
        // The block it passes slides down to make room.
        await expect(dialog.locator(".ft-sortable--block").nth(5)).toHaveAttribute("style", /--ft-drag-transform: translate3d\(0px, [1-9]/, { timeout: 500 });
      }).toPass({ timeout: 5000 });
      await page.keyboard.press("Space");
      await expect(dialog.locator(".ft-sortable--block.is-dragging")).toHaveCount(0);
      await expect(titleField(7)).toHaveValue("Thông tin bổ sung");
      expect((await blockOrder()).slice(5)).toEqual(["Kéo khối Yêu cầu", "Kéo khối 7"]);
      await expect(previewBlocks.nth(5)).toHaveAttribute("aria-label", "Yêu cầu");
    });

    await test.step("a field dragged into another section moves there; the emptied one waits for a field", async () => {
      await dialog.getByRole("button", { name: "Thêm mục" }).click();
      await titleField(8).fill("Kỹ thuật");
      await dialog.getByLabel("Tên trường 2").fill("Loại trụ");
      await expect(problem).toHaveCount(0);

      await drag(page, dialog.getByRole("button", { name: "Kéo trường 2" }), sectionAt(7).getByRole("button", { name: "Thêm trường" }));
      await expect(sectionAt(7).getByTestId("form-field-row")).toHaveCount(2);
      await expect(sectionAt(8).getByText("Kéo trường vào đây")).toBeVisible();
      await expect(problem).toHaveText('Mục "Kỹ thuật" chưa có trường');
      await expect(saveButton).toBeDisabled();
      await expect(previewBlock("Kỹ thuật")).toContainText("Chưa có trường");

      await drag(page, dialog.getByRole("button", { name: "Kéo trường 1" }), sectionAt(8).getByText("Kéo trường vào đây"));
      await expect(dialog.getByLabel("Tên trường 1")).toHaveValue("Loại trụ");
      await expect(dialog.getByLabel("Tên trường 2")).toHaveValue("Mã labo");
      await expect(sectionAt(8).getByTestId("form-field-row")).toHaveCount(1);
      await expect(previewBlock("Kỹ thuật")).toContainText("Mã labo");
      await expect(problem).toHaveCount(0);
    });

    await test.step("a block dragged in the preview moves in the builder too", async () => {
      await drag(page, previewBlock("Màu răng"), previewBlock("loại phục hình"));
      await expect(previewBlocks.nth(1)).toHaveAttribute("aria-label", "Màu răng");
      expect((await blockOrder()).slice(0, 3)).toEqual(["Kéo khối Thông tin phiếu", "Kéo khối Màu răng", "Kéo khối LOẠI PHỤC HÌNH"]);
    });

    await test.step("a hidden block leaves the preview and is named under it; a click on a block opens its card", async () => {
      await dialog.getByRole("switch", { name: "Hiện khối Đường hoàn tất" }).click();
      await expect(previewBlocks).toHaveCount(7);
      await expect(preview.getByRole("note")).toHaveText("Đang ẩn: Đường hoàn tất");
      await previewBlock("Kỹ thuật").click();
      await expect(titleField(8)).toBeFocused();
    });

    await test.step("Lưu keeps the layout as dragged", async () => {
      await saveButton.click();
      await expect(page.getByText("Đã thêm").first()).toBeVisible();
      await expect(dialog).toBeHidden();
      const made = await templateByName(page, name);
      expect(made.blocks.map((b) => [b.kind, b.title, b.visible, b.span])).toEqual([
        [BlockKind.Info, null, true, 3],
        [BlockKind.Shade, null, true, 1],
        [BlockKind.Restoration, null, true, 1],
        [BlockKind.Teeth, null, true, 1],
        [BlockKind.FinishLine, null, false, 1],
        [BlockKind.Notes, null, true, 3],
        [BlockKind.Custom, "Thông tin bổ sung", true, 3],
        [BlockKind.Custom, "Kỹ thuật", true, 3],
      ]);
      const [extra, technique] = made.blocks.filter((b) => b.kind === BlockKind.Custom).map((b) => b.key);
      expect(made.fields.map((f) => [f.label, f.blockKey])).toEqual([
        ["Loại trụ", extra],
        ["Mã labo", technique],
      ]);
    });
  });
});
