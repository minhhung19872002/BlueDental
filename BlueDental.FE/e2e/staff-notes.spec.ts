import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, MANAGER_USER, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: header → "Thêm ghi chú" (F-74), in the browser. BlueDental-local
 * (BA mock 2026-10-19); see docs/testing/features/staff-notes.md.
 *
 * Real stack only: login through the login screen, the production build, the
 * real API and PostgreSQL. Nothing is intercepted; the API is only used to
 * clear away what the run wrote.
 */

const NOTES = "/api/v1/app/staff-notes";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const MAIN_BRANCH = "Nha Khoa Đức Hạnh Premium";
const SCOPE = { Shared: 1, Personal: 2 } as const;
/** The icon names itself too ("plus Thêm"), so match the end of the name. */
const ADD_BUTTON = /(^| )Thêm$/;
const SAVE_BUTTON = /(^| )Lưu$/;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const launcher = (page: Page) => page.locator(".app-header").getByRole("button", { name: "Ghi chú", exact: true });
const notesDialog = (page: Page) => page.locator(".staff-notes-dialog");
const box = (page: Page) => page.locator(".staff-notes-dialog .ant-modal-container");
const searchBox = (dialog: Locator) => dialog.getByRole("textbox", { name: "Tìm kiếm" });
const draftBox = (dialog: Locator) => dialog.getByRole("textbox", { name: "Ghi chú" });
const rows = (dialog: Locator) => dialog.locator(".ant-table-tbody tr.ant-table-row");
const rowOf = (dialog: Locator, text: string) => rows(dialog).filter({ hasText: text });

async function pickBranch(page: Page, name: string) {
  const menu = page.locator(".app-popover-list");
  await page.locator(".app-header-branch").click();
  await expect(menu).toBeVisible();
  await menu.getByText(name, { exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".app-header-branch-name")).toHaveText(name);
}

async function openNotes(page: Page): Promise<Locator> {
  await launcher(page).click();
  const dialog = notesDialog(page);
  await expect(dialog).toBeVisible();
  await expect(searchBox(dialog)).toBeFocused();
  return dialog;
}

async function searchFor(dialog: Locator, text: string) {
  await searchBox(dialog).fill(text);
}

async function scope(dialog: Locator, label: "Chung" | "Cá nhân") {
  await dialog.locator(".seg-tabs").getByText(label, { exact: true }).click();
}

/** Opens "Thêm mới" when it is folded. */
async function unfoldComposer(dialog: Locator) {
  const head = dialog.locator(".staff-notes-composer-head");
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  await expect(draftBox(dialog)).toBeVisible();
}

async function addNote(page: Page, dialog: Locator, content: string) {
  await unfoldComposer(dialog);
  await draftBox(dialog).fill(content);
  await dialog.getByRole("button", { name: ADD_BUTTON }).click();
  await expect(page.getByText("Đã thêm ghi chú").last()).toBeVisible();
  await expect(draftBox(dialog), "the draft clears for the next note").toHaveValue("");
}

/** Removes every note the run wrote, in either scope. */
async function purge(page: Page, run: string) {
  for (const scopeValue of [SCOPE.Shared, SCOPE.Personal]) {
    const res = await call<{ items: { id: string }[] }>(
      page,
      `${NOTES}?Scope=${scopeValue}&Filter=${encodeURIComponent(run)}&MaxResultCount=100`,
      { branchId: scopeValue === SCOPE.Shared ? BRANCH_ONE : undefined },
    );
    for (const note of res.body.items ?? []) {
      await call(page, `${NOTES}/${note.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    }
  }
}

test.describe("Ghi chú — the dialog", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await pickBranch(page, MAIN_BRANCH);
  });

  test("opens from the icon or Alt+N, floats without a backdrop, and only X or Hủy close it", async ({ page }) => {
    await expect(launcher(page)).toHaveAttribute("aria-keyshortcuts", "Alt+N");
    const dialog = await openNotes(page);
    await expect(dialog.getByText("Thêm ghi chú", { exact: true })).toBeVisible();
    await expect(page.locator(".ant-modal-mask"), "nothing dims the page").toHaveCount(0);
    await expect(dialog.locator(".staff-notes-composer-head")).toHaveAttribute("aria-expanded", "false");
    await expect(draftBox(dialog), "Thêm mới starts folded").toHaveCount(0);

    // A stray Escape or click elsewhere leaves it up.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // The page behind keeps working — and the dialog rides along to the next screen.
    await page.locator('.app-nav-group[title="Tổng quan"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dialog).toBeVisible();

    // Alt+N while it is up does not close it; it puts the cursor back in the search box.
    await dialog.getByRole("button", { name: "Thêm mới" }).focus();
    await page.keyboard.press("Alt+KeyN");
    await expect(dialog).toBeVisible();
    await expect(searchBox(dialog)).toBeFocused();

    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.keyboard.press("Alt+KeyN");
    await expect(dialog).toBeVisible();
    await expect(searchBox(dialog)).toBeFocused();
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("drags by its title and comes back centred when reopened", async ({ page }) => {
    const dialog = await openNotes(page);
    const before = (await box(page).boundingBox())!;
    const handle = (await dialog.locator(".staff-notes-handle").boundingBox())!;

    const fromX = handle.x + 60;
    const fromY = handle.y + handle.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX - 120, fromY + 60, { steps: 6 });
    await page.mouse.move(fromX - 180, fromY + 90, { steps: 6 });
    await page.mouse.up();

    const after = (await box(page).boundingBox())!;
    expect(Math.round(after.x - before.x)).toBe(-180);
    expect(Math.round(after.y - before.y)).toBe(90);

    // Still a working dialog where it landed.
    await searchBox(dialog).fill("kéo xong");
    await expect(searchBox(dialog)).toHaveValue("kéo xong");

    // Where it used to be, the page takes the clicks again.
    await page.locator('.app-nav-group[title="Tổng quan"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(dialog).toBeHidden();
    await openNotes(page);
    const reopened = (await box(page).boundingBox())!;
    expect(Math.round(reopened.x)).toBe(Math.round(before.x));
    expect(Math.round(reopened.y)).toBe(Math.round(before.y));
  });

  test("adds, copies, edits and deletes a Chung note, and it is still there after a reload", async ({ page, browser }) => {
    const run = `snui${runId()}`;
    try {
      const dialog = await openNotes(page);
      await searchFor(dialog, run);
      await expect(dialog.getByText("Chưa có ghi chú nào")).toBeVisible();

      await unfoldComposer(dialog);
      await expect(dialog.getByRole("button", { name: ADD_BUTTON }), "nothing to add yet").toBeDisabled();
      await addNote(page, dialog, `${run} gọi lại khách lúc 15h`);
      await addNote(page, dialog, `${run} nhắc đặt vật tư`);

      // Newest first, numbered, with who wrote it.
      await expect(rows(dialog)).toHaveCount(2);
      await expect(rows(dialog).nth(0)).toContainText(`${run} nhắc đặt vật tư`);
      await expect(rows(dialog).nth(0).locator("td").first()).toHaveText("1");
      await expect(rows(dialog).nth(1).locator("td").first()).toHaveText("2");
      await expect(rows(dialog).nth(1).locator(".staff-notes-byline")).toContainText("·");
      await expect(rowOf(dialog, "15h").locator(".staff-notes-text"))
        .toHaveAttribute("title", `${run} gọi lại khách lúc 15h`);

      // Copy puts the whole note on the clipboard.
      await rowOf(dialog, "15h").getByRole("button", { name: "Sao chép" }).click();
      await expect(page.getByText("Đã sao chép").last()).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${run} gọi lại khách lúc 15h`);

      // Sửa loads the note into the composer; Lưu writes it back.
      await rowOf(dialog, "15h").getByRole("button", { name: "Sửa" }).click();
      await expect(dialog.locator(".staff-notes-composer-title")).toHaveText("Sửa ghi chú");
      await expect(draftBox(dialog)).toHaveValue(`${run} gọi lại khách lúc 15h`);
      await draftBox(dialog).fill(`${run} gọi lại khách lúc 16h`);
      await dialog.getByRole("button", { name: SAVE_BUTTON }).click();
      await expect(page.getByText("Đã lưu ghi chú").last()).toBeVisible();
      await expect(dialog.locator(".staff-notes-composer-title")).toHaveText("Thêm mới");
      await expect(draftBox(dialog)).toHaveValue("");
      await expect(rowOf(dialog, "16h")).toHaveCount(1);
      await expect(rowOf(dialog, "15h")).toHaveCount(0);

      // Hủy sửa leaves the note as it was.
      await rowOf(dialog, "vật tư").getByRole("button", { name: "Sửa" }).click();
      await draftBox(dialog).fill(`${run} bỏ dở`);
      await dialog.getByRole("button", { name: "Hủy sửa" }).click();
      await expect(dialog.locator(".staff-notes-composer-title")).toHaveText("Thêm mới");
      await expect(draftBox(dialog)).toHaveValue("");
      await expect(rowOf(dialog, "vật tư")).toHaveCount(1);
      await expect(rowOf(dialog, "bỏ dở")).toHaveCount(0);

      // Xóa asks first.
      await rowOf(dialog, "vật tư").getByRole("button", { name: "Xóa" }).click();
      const confirm = page.getByRole("dialog").filter({ hasText: "Bạn có chắc muốn xóa ghi chú này không?" });
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Xoá" }).click();
      await expect(page.getByText("Đã xóa ghi chú").last()).toBeVisible();
      await expect(rows(dialog)).toHaveCount(1);

      // Search runs on the server: every word, any case.
      await searchFor(dialog, `${run} 16H`);
      await expect(rows(dialog)).toHaveCount(1);
      await searchFor(dialog, `${run} không-có`);
      await expect(dialog.getByText("Chưa có ghi chú nào")).toBeVisible();

      // After a reload the saved note is still there, and only it.
      await page.reload();
      // The shortcut is the app shell's, so it works once the header is up.
      await expect(launcher(page)).toBeVisible();
      await page.keyboard.press("Alt+KeyN");
      const reopened = notesDialog(page);
      await expect(reopened).toBeVisible();
      await searchFor(reopened, run);
      await expect(rows(reopened)).toHaveCount(1);
      await expect(rows(reopened).first()).toContainText(`${run} gọi lại khách lúc 16h`);
      await expect(rows(reopened).first().getByRole("button", { name: "Sửa" })).toBeVisible();

      // A colleague in the same branch reads it and may copy it, not change it.
      const other = await (await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] })).newPage();
      await login(other, MANAGER_USER);
      await pickBranch(other, MAIN_BRANCH);
      const theirs = await openNotes(other);
      await searchFor(theirs, run);
      await expect(rows(theirs)).toHaveCount(1);
      await expect(rows(theirs).first().getByRole("button", { name: "Sao chép" })).toBeVisible();
      await expect(rows(theirs).first().getByRole("button", { name: "Sửa" })).toHaveCount(0);
      await expect(rows(theirs).first().getByRole("button", { name: "Xóa" })).toHaveCount(0);
      await other.context().close();
    } finally {
      await purge(page, run);
    }
  });

  test("a Cá nhân note shows to its author only", async ({ page, browser }) => {
    const run = `snme${runId()}`;
    try {
      const dialog = await openNotes(page);
      await scope(dialog, "Cá nhân");
      await searchFor(dialog, run);
      await addNote(page, dialog, `${run} việc riêng`);
      await expect(rows(dialog)).toHaveCount(1);
      await expect(rows(dialog).first().locator(".staff-notes-byline"), "no byline: it is always the viewer").toHaveCount(0);

      await scope(dialog, "Chung");
      await expect(dialog.getByText("Chưa có ghi chú nào"), "not under Chung").toBeVisible();

      const other = await (await browser.newContext()).newPage();
      await login(other, MANAGER_USER);
      const theirs = await openNotes(other);
      await scope(theirs, "Cá nhân");
      await searchFor(theirs, run);
      await expect(theirs.getByText("Chưa có ghi chú nào")).toBeVisible();
      await other.context().close();
    } finally {
      await purge(page, run);
    }
  });

  test("with Tất cả chi nhánh picked, a new Chung note waits for a branch; Cá nhân does not", async ({ page }) => {
    await pickBranch(page, "Tất cả chi nhánh");
    const dialog = await openNotes(page);
    await unfoldComposer(dialog);

    await expect(draftBox(dialog)).toBeDisabled();
    await expect(dialog.getByText("Chọn một chi nhánh ở góc trên để thêm ghi chú chung.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: ADD_BUTTON })).toBeDisabled();

    await scope(dialog, "Cá nhân");
    await expect(draftBox(dialog)).toBeEnabled();
    await expect(dialog.getByText("Chọn một chi nhánh ở góc trên để thêm ghi chú chung.")).toHaveCount(0);
  });
});
