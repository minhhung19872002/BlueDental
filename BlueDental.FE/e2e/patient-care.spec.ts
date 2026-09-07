import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: patient detail → "Chăm sóc KH" tab.
 *
 * Real stack throughout: the counters and the log come from the real API, the
 * dialog POSTs/PUTs/DELETEs against PostgreSQL and everything is re-read after
 * a reload. Nothing is intercepted.
 */

const API = "/api/v1/app/care-records";

/** Opens the first listed patient's care tab and waits for its first log request. */
async function openCareTab(page: Page) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page
    .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
    .first()
    .click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  await Promise.all([
    assertRealApiTraffic(page, API),
    page.getByRole("link", { name: "Chăm sóc KH" }).click(),
  ]);
  await expect(page).toHaveURL(/tab=care/);
}

function chip(page: Page, label: string): Locator {
  return page.locator(".pc-chip").filter({ has: page.locator(".pc-chip-label", { hasText: label }) });
}

async function chipCount(page: Page, label: string): Promise<number> {
  const text = await chip(page, label).locator(".pc-chip-count").innerText();
  return Number.parseInt(text, 10);
}

function rowWith(page: Page, note: string): Locator {
  return page.locator(".pc-card tbody tr").filter({ hasText: note });
}

const NOTE_PREFIX = "E2E chăm sóc";

/** A failed run can leave its entry behind; delete such rows before measuring counters. */
async function deleteLeftovers(page: Page) {
  for (let guard = 0; guard < 5; guard += 1) {
    const stale = rowWith(page, NOTE_PREFIX).first();
    if ((await stale.count()) === 0) return;
    await stale.getByRole("button", { name: "Xoá" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Xóa lượt chăm sóc" });
    await saveAndWait(page, confirm.getByRole("button", { name: "Xoá" }), "DELETE");
    await expect(confirm).toBeHidden();
    await expect(stale).toBeHidden();
  }
}

/** Waits for the one mutating request the click sends, and checks the server took it. */
async function saveAndWait(page: Page, trigger: Locator, method: "POST" | "PUT" | "DELETE") {
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(API) && res.request().method() === method),
    trigger.click(),
  ]);
  expect(response.ok(), `${method} ${API} should succeed`).toBeTruthy();
}

test.describe("Patient care tab", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows the reference's counters, columns and pager", async ({ page }) => {
    await openCareTab(page);

    const labels = [
      "Đã chăm sóc",
      "Tốt",
      "Khá",
      "Bình thường",
      "Khiếu nại",
      "Đặc biệt",
      "Định kỳ",
      "Cơ bản",
    ];
    await expect(page.locator(".pc-chip")).toHaveCount(labels.length);
    for (const label of labels) await expect(chip(page, label)).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByRole("button", { name: "CSKH đặc biệt" })).toBeVisible();
    for (const column of [
      "Ngày chăm sóc",
      "Trạng thái CSKH",
      "Nhóm",
      "Dịch vụ",
      "Nội dung",
      "Bác sĩ điều trị",
      "Nhân viên chăm sóc",
      "Đánh giá",
      "Thao tác",
    ]) {
      await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
    }
  });

  test("creates, filters, inspects, edits and deletes a care entry", async ({ page }) => {
    test.setTimeout(120_000);
    await openCareTab(page);
    await deleteLeftovers(page);
    const note = `${NOTE_PREFIX} ${runId()}`;
    const caredBefore = await chipCount(page, "Đã chăm sóc");
    const goodBefore = await chipCount(page, "Tốt");
    const specialBefore = await chipCount(page, "Đặc biệt");

    // ── create ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "CSKH đặc biệt" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Chăm sóc khách hàng" });
    await expect(dialog.getByRole("heading", { name: "Chăm sóc khách hàng" })).toBeVisible();
    // Họ và tên and Nhân viên chăm sóc are locked, the way the reference locks them.
    await expect(dialog.locator(".pc-static-field .ss-wrapper--disabled")).toHaveCount(2);
    await expect(dialog.getByRole("radio", { name: "Khá" })).toBeChecked();

    await dialog.getByLabel("Ghi chú lần chăm sóc").fill(note);
    await dialog.getByRole("radio", { name: "Tốt" }).check();
    await saveAndWait(page, dialog.getByRole("button", { name: "Lưu" }), "POST");
    await expect(dialog).toBeHidden();

    const row = rowWith(page, note);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Tốt");
    await expect(row).toContainText("CSKH đặc biệt");
    await expect(row).not.toContainText("Không có");
    await expect(page.locator(".pc-card .ant-pagination")).toContainText("nhật ký");
    await expect
      .poll(() => chipCount(page, "Đã chăm sóc"), { timeout: 10_000 })
      .toBe(caredBefore + 1);
    expect(await chipCount(page, "Tốt")).toBe(goodBefore + 1);
    expect(await chipCount(page, "Đặc biệt")).toBe(specialBefore + 1);

    // ── chip filter: one server-side param, single select ─────────────────
    const [filtered] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(API) && res.url().includes("outcome=4")),
      chip(page, "Khiếu nại").click(),
    ]);
    expect(filtered.ok()).toBeTruthy();
    await expect(chip(page, "Khiếu nại")).toHaveAttribute("aria-pressed", "true");
    await expect(row).toBeHidden();

    await Promise.all([
      page.waitForResponse((res) => res.url().includes(API) && res.url().includes("outcome=1")),
      chip(page, "Tốt").click(),
    ]);
    await expect(chip(page, "Khiếu nại")).toHaveAttribute("aria-pressed", "false");
    await expect(chip(page, "Tốt")).toHaveAttribute("aria-pressed", "true");
    await expect(row).toBeVisible();

    await chip(page, "Tốt").click();
    await expect(chip(page, "Tốt")).toHaveAttribute("aria-pressed", "false");
    await expect(row).toBeVisible();

    // ── Chi tiết ──────────────────────────────────────────────────────────
    await row.getByRole("button", { name: "Chi tiết" }).click();
    const detail = page.getByRole("dialog").filter({ hasText: "Chi tiết phiếu" });
    await expect(detail).toContainText("CSKH đặc biệt");
    await expect(detail).toContainText(note);
    await expect(detail).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
    await detail.getByRole("button", { name: "Đóng" }).click();
    await expect(detail).toBeHidden();

    // ── edit ──────────────────────────────────────────────────────────────
    await row.getByRole("button", { name: "Chỉnh sửa" }).click();
    const edit = page.getByRole("dialog").filter({ hasText: "Cập nhật chăm sóc khách hàng" });
    await expect(edit.getByLabel("Ghi chú lần chăm sóc")).toHaveValue(note);
    await expect(edit.getByRole("radio", { name: "Tốt" })).toBeChecked();
    await expect(edit.locator(".pc-static-field .ss-wrapper--disabled")).toHaveCount(2);
    await edit.getByRole("radio", { name: "Khiếu nại" }).check();
    await saveAndWait(page, edit.getByRole("button", { name: "Lưu" }), "PUT");
    await expect(edit).toBeHidden();
    await expect(row).toContainText("Khiếu nại");

    await page.reload();
    await expect(page).toHaveURL(/tab=care/);
    await expect(rowWith(page, note)).toContainText("Khiếu nại");
    expect(await chipCount(page, "Tốt")).toBe(goodBefore);

    // ── same record on the CSKH board ─────────────────────────────────────
    // Both screens read one table; the board's "CSKH đặc biệt" tab windows by
    // the schedule slot, which this dialog must fill in alongside the care date.
    await Promise.all([
      assertRealApiTraffic(page, `${API}?`),
      page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day"),
    ]);
    const boardRow = page.getByRole("row").filter({ hasText: note });
    await expect(boardRow).toBeVisible({ timeout: 10_000 });
    await expect(boardRow).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);

    await openCareTab(page);

    // ── delete ────────────────────────────────────────────────────────────
    await rowWith(page, note).getByRole("button", { name: "Xoá" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Xóa lượt chăm sóc" });
    await expect(confirm).toContainText("Bạn có chắc chắn muốn xóa lượt chăm sóc này không?");
    await saveAndWait(page, confirm.getByRole("button", { name: "Xoá" }), "DELETE");
    await expect(confirm).toBeHidden();
    await expect(rowWith(page, note)).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/tab=care/);
    await expect(page.locator(".pc-chip").first()).toBeVisible();
    await expect(rowWith(page, note)).toHaveCount(0);
    await expect
      .poll(() => chipCount(page, "Đã chăm sóc"), { timeout: 10_000 })
      .toBe(caredBefore);
  });
});
