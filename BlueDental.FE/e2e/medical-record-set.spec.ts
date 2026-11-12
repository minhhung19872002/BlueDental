import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  SETS_API,
  SHEETS_API,
  openBenhAn,
  seedPatientWithSlips,
  setsOf,
  slipsOf,
  type SeededPatient,
} from "./fixtures/medicalRecordSet";

/**
 * Feature: Bộ hồ sơ bệnh án — the clinic's own design (save/P1710.drawio,
 * 2026-10-17). A patient's Bệnh án sheets are kept in sets, each opened for
 * one or more treatment slips; a sheet or a set is cancelled, never deleted.
 *
 * Real stack throughout: each test seeds a patient of its own (diagnosis slip →
 * consulting lines → three treatment slips) through the real API, drives the UI,
 * and reads the result back from PostgreSQL through the API. Nothing is
 * intercepted.
 */

const picker = (page: Page) => page.locator(".rs-picker-trigger");

/**
 * Each slip is one table row, its cells side by side left to right. R-1213:
 * the Labo Phiếu yêu cầu's `.rs-slip` (a flex column) once matched the row
 * class here too and stacked every cell under the tick box.
 */
async function expectSlipRowsLaidOut(scope: Locator) {
  const rows = scope.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) {
    await expect(row).toHaveCSS("display", "table-row");
    const boxes = await row.locator("> td").evaluateAll((cells) =>
      cells.map((cell) => {
        const box = cell.getBoundingClientRect();
        return { top: box.top, left: box.left };
      }),
    );
    expect(boxes.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].top - boxes[0].top)).toBeLessThan(2);
      expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].left);
    }
  }
}

/** Opens the set dialog from the picker's "+ Tạo bộ hồ sơ mới", or the pencil of a set. */
async function openFromPicker(page: Page, action: string) {
  await picker(page).click();
  await page.getByRole("button", { name: action }).click();
  return page.getByRole("dialog");
}

test.describe("Bộ hồ sơ bệnh án", () => {
  test.describe.configure({ timeout: 120_000 });

  let patient: SeededPatient;

  test.beforeEach(async ({ page }) => {
    await login(page);
    patient = await seedPatientWithSlips(page);
  });

  test("a set is made from ticked slips, numbered for the patient and day, and shows only the forms kept", async ({
    page,
  }) => {
    await openBenhAn(page, patient.id);

    // No set yet: only the slips not in any set, each with its diagnosis — the
    // intro and the nine forms above them are gone (the clinic's ask).
    const free = page.locator(".rs-free");
    await expect(
      free.getByRole("heading", { name: "Phiếu điều trị chưa thuộc bộ nào" }),
    ).toBeVisible();
    await expect(page.getByText("Bệnh nhân chưa có bộ hồ sơ bệnh án")).toHaveCount(0);
    for (const slip of patient.slips) {
      await expect(free.getByRole("checkbox", { name: slip.code })).toBeVisible();
    }
    await expect(free.getByText(patient.diagnosisName).first()).toBeVisible();
    await expectSlipRowsLaidOut(free);
    const create = free.getByRole("button", { name: "Tạo hồ sơ" });
    await expect(create).toBeDisabled();

    for (const slip of patient.slips) await free.getByRole("checkbox", { name: slip.code }).check();
    await create.click();

    const dialog = page.getByRole("dialog", { name: /Tạo bộ hồ sơ bệnh án mới/ });
    await expect(dialog).toBeVisible();
    for (const slip of patient.slips) {
      await expect(dialog.getByRole("checkbox", { name: slip.code })).toBeChecked();
    }
    await expectSlipRowsLaidOut(dialog.locator(".rs-slips"));
    await dialog.getByRole("checkbox", { name: "9. Phiếu chăm sóc" }).uncheck();
    // The reference's nine forms and the clinic's mẫu 10.
    await expect(dialog).toContainText(
      `${patient.slips.length} phiếu điều trị · 10 mục · hiển thị 9`,
    );
    await dialog.getByRole("button", { name: "Tạo bộ hồ sơ" }).click();
    await expect(page.getByText("Đã tạo bộ hồ sơ").first()).toBeVisible();

    // HS{Mã KH}-{DDMMYYYY}-01, under it "{Mã phiếu chẩn đoán} - {Mã phiếu điều trị}" of the newest slip.
    const code = new RegExp(`^HS${patient.code}-\\d{8}-01$`);
    const [set] = await setsOf(page, patient.id);
    expect(set.code).toMatch(code);
    expect(set.plans.map((plan) => plan.treatmentPlanId).sort()).toEqual(
      patient.slips.map((slip) => slip.id).sort(),
    );
    expect(set.visibleForms).not.toContain(9);
    await expect(picker(page)).toContainText(set.code);
    await expect(picker(page)).toContainText(
      `${patient.diagnosisSlipCode} - ${patient.slips.at(-1)!.code}`,
    );
    await expect(page.locator(".pd-medical-form")).toHaveCount(9);
    await expect(page.locator(".pd-medical-form", { hasText: "Phiếu chăm sóc" })).toHaveCount(0);

    // Both slips are now held: none is left free.
    expect((await slipsOf(page, patient.id)).every((slip) => slip.recordSetId === set.id)).toBe(
      true,
    );

    // The doctor picker above the sheet is gone (the clinic's ask).
    await page
      .locator(".pd-medical-form", { hasText: "Bìa hồ sơ bệnh án" })
      .getByRole("button", { name: "Thêm" })
      .click();
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
    await expect(page.locator(".pd-medical-canvas-head")).toBeVisible();
    await expect(page.locator(".pd-medical-canvas-head .ant-select")).toHaveCount(0);

    // A reload reads it all back.
    await page.reload();
    await expect(picker(page)).toContainText(set.code);
    await expect(page.locator(".pd-medical-form")).toHaveCount(9);

    // Mục hiển thị is edited the same way, the clinic's mẫu 10 included:
    // unticked it leaves the set and the index, ticked again both have it back.
    for (const [shown, rows] of [
      [false, 8],
      [true, 9],
    ] as const) {
      const edit = await openFromPicker(page, `Sửa bộ hồ sơ ${set.code}`);
      await expect(edit).toContainText("Bộ hồ sơ luôn gồm đủ 10 mục");
      const contract = edit.getByRole("checkbox", { name: "10. Hợp đồng thỏa thuận niềng răng" });
      await (shown ? contract.check() : contract.uncheck());
      await edit.getByRole("button", { name: "Lưu" }).click();
      await expect
        .poll(async () => (await setsOf(page, patient.id))[0].visibleForms.includes(10))
        .toBe(shown);
      await page.reload();
      await expect(page.locator(".pd-medical-form")).toHaveCount(rows);
    }
  });

  test("a sheet is cancelled with a reason, kept as Đã hủy, and can no longer change", async ({
    page,
  }) => {
    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [patient.slips[0].id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await openBenhAn(page, patient.id);

    const row = page.locator(".pd-medical-form", { hasText: "Bìa hồ sơ bệnh án" });
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(row.locator(".pd-sheet-card")).toHaveCount(1);
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(row.locator(".pd-sheet-card")).toHaveCount(2);
    // No stamp tick any more.
    await expect(page.locator(".pd-sheet-check")).toHaveCount(0);

    const first = row.locator(".pd-sheet-card").first();
    await first.getByRole("button", { name: "Hủy Bìa hồ sơ bệnh án" }).click();
    const dialog = page.getByRole("dialog", { name: /Hủy phiếu/ });
    await expect(dialog).toContainText("Bìa hồ sơ bệnh án · Bản 01");
    // The reason is required.
    await dialog.getByRole("button", { name: "Hủy phiếu" }).click();
    await expect(dialog.getByText("Vui lòng nhập lý do hủy")).toBeVisible();
    await dialog.getByLabel("Lý do hủy").fill("Ghi sai ngày tái khám");
    const cancelled = page.waitForResponse(
      (res) =>
        /\/patient-medical-records\/[0-9a-f-]{36}\/cancel$/.test(res.url()) &&
        res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Hủy phiếu" }).click();
    expect((await cancelled).ok()).toBeTruthy();
    await expect(page.getByText("Đã hủy phiếu").first()).toBeVisible();

    // Kept, after a reload, as Đã hủy with its number — and only printable.
    await page.reload();
    const kept = page
      .locator(".pd-medical-form", { hasText: "Bìa hồ sơ bệnh án" })
      .locator(".pd-sheet-card")
      .first();
    await expect(kept).toHaveClass(/pd-sheet-card--cancelled/);
    await expect(kept).toContainText("Bản 01");
    await expect(kept).toContainText("Đã hủy");
    await expect(kept.getByRole("button", { name: /^Hủy / })).toHaveCount(0);
    await expect(kept.getByRole("button", { name: /^In nhanh/ })).toHaveCount(1);
    await expect(page.locator(".pd-medical-form", { hasText: "Bìa hồ sơ bệnh án" })).toContainText(
      "2 bản · 1 đã hủy",
    );

    await kept.locator(".pd-sheet-open").click();
    await expect(page.locator(".pd-medical-canvas-head")).toContainText("Phiếu đã hủy");
    await expect(
      page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }),
    ).toBeDisabled();

    // Logged: who, when, why. And the server refuses to change it.
    const sheets = await call<{
      items: {
        id: string;
        cancelledAt: string | null;
        cancelReason: string | null;
        cancellerName: string | null;
      }[];
    }>(page, `${SHEETS_API}?patientId=${patient.id}&maxResultCount=10`);
    const sheet = sheets.body.items.find((item) => item.cancelledAt);
    expect(sheet?.cancelReason).toBe("Ghi sai ngày tái khám");
    expect(sheet?.cancellerName).toBeTruthy();
    const edit = await call<{ error?: { code?: string } }>(page, `${SHEETS_API}/${sheet!.id}`, {
      method: "PUT",
      json: { content: JSON.stringify({ fieldValues: {} }) },
    });
    expect(edit.status).toBe(403);
    expect(edit.body.error?.code).toBe("BlueDental:Patient:0028");
    // A sheet is never deleted.
    expect(
      (await call(page, `${SHEETS_API}/${sheet!.id}`, { method: "DELETE" })).status,
    ).toBeGreaterThanOrEqual(400);
  });

  test("a slip in another set is locked in both dialogs and moves in two steps; a started one stays; cancelling frees", async ({
    page,
    browser,
  }) => {
    const [a, b, c] = patient.slips;
    const first = await call<{ id: string; code: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [a.id, b.id], visibleForms: [] },
    });
    expect(first.status).toBe(200);
    await openBenhAn(page, patient.id);

    // A new set takes free slips only: the two the first set holds are locked
    // — and the server refuses them too.
    let dialog = await openFromPicker(page, "Tạo bộ hồ sơ mới");
    await expect(dialog.getByRole("checkbox", { name: a.code })).toBeDisabled();
    await expect(dialog.getByRole("checkbox", { name: b.code })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: c.code }).check();
    await dialog.getByRole("button", { name: "Tạo bộ hồ sơ" }).click();
    await expect(page.getByText("Đã tạo bộ hồ sơ").first()).toBeVisible();
    const taken = await call<{ error?: { code?: string } }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [a.id], visibleForms: [] },
    });
    expect(taken.status).toBe(403);
    expect(taken.body.error?.code).toBe("BlueDental:Patient:0032");

    let sets = await setsOf(page, patient.id);
    const second = sets.find((set) => set.id !== first.body.id)!;
    expect(second.code).toMatch(/-02$/);

    // The edit view locks them as well: no set takes a slip another set holds.
    dialog = await openFromPicker(page, `Sửa bộ hồ sơ ${second.code}`);
    await expect(dialog.getByRole("checkbox", { name: b.code })).toBeDisabled();
    await expect(dialog.getByRole("checkbox", { name: a.code })).toBeDisabled();
    await dialog.getByRole("button", { name: "Huỷ" }).click();
    const pulled = await call<{ error?: { code?: string } }>(page, `${SETS_API}/${second.id}`, {
      method: "PUT",
      json: { treatmentPlanIds: [b.id, c.id], visibleForms: [] },
    });
    expect(pulled.status).toBe(403);
    expect(pulled.body.error?.code).toBe("BlueDental:Patient:0032");

    // Moving is two steps. 1: unticked in its own set — not started, so it may leave.
    dialog = await openFromPicker(page, `Sửa bộ hồ sơ ${first.body.code}`);
    await dialog.getByRole("checkbox", { name: b.code }).uncheck();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect
      .poll(
        async () =>
          (await slipsOf(page, patient.id)).find((slip) => slip.treatmentPlanId === b.id)!
            .recordSetId,
      )
      .toBeNull();
    // 2: free now, it is ticked into the second set.
    dialog = await openFromPicker(page, `Sửa bộ hồ sơ ${second.code}`);
    await expect(dialog.getByRole("checkbox", { name: b.code })).toBeEnabled();
    await dialog.getByRole("checkbox", { name: b.code }).check();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect
      .poll(
        async () =>
          (await setsOf(page, patient.id)).find((set) => set.id === second.id)!.plans.length,
      )
      .toBe(2);
    sets = await setsOf(page, patient.id);
    expect(
      sets
        .find((set) => set.id === second.id)!
        .plans.map((plan) => plan.treatmentPlanId)
        .sort(),
    ).toEqual([b.id, c.id].sort());
    expect(
      sets.find((set) => set.id === first.body.id)!.plans.map((plan) => plan.treatmentPlanId),
    ).toEqual([a.id]);

    // Treatment starts on c: from now on it stays in its set.
    const done = await call(
      page,
      `/api/v1/app/patient-treatments/${c.id}/services/${c.lineId}/complete`,
      {
        method: "POST",
        branchId: patient.branchId,
      },
    );
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const dropped = await call<{ error?: { code?: string } }>(page, `${SETS_API}/${second.id}`, {
      method: "PUT",
      json: { treatmentPlanIds: [b.id], visibleForms: [] },
    });
    expect(dropped.status).toBe(403);
    expect(dropped.body.error?.code).toBe("BlueDental:Patient:0026");

    // No reload: the dialog was opened on this page before the slip started,
    // and opening it again reads the slips afresh — the status is today's.
    dialog = await openFromPicker(page, `Sửa bộ hồ sơ ${second.code}`);
    const startedRow = dialog.locator(".rs-slip-row", {
      has: page.getByRole("checkbox", { name: c.code }),
    });
    await expect(startedRow).toContainText("Hoàn thành");
    await expect(dialog.getByRole("checkbox", { name: c.code })).toBeDisabled();
    await expect(dialog.getByRole("checkbox", { name: c.code })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: b.code })).toBeEnabled();
    await expect(dialog.getByRole("checkbox", { name: a.code })).toBeDisabled();
    await dialog.getByRole("button", { name: "Huỷ" }).click();

    // Another branch cannot see the patient's sets at all.
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await login(otherPage, BRANCH2_USER);
      const peek = await call(otherPage, `${SETS_API}?patientId=${patient.id}`);
      expect(peek.status).toBe(404);
    } finally {
      await other.close();
    }

    // Cancelling the second set: kept, marked Đã hủy, last in the list; its slips are free again.
    await picker(page).click();
    await page.getByRole("button", { name: `Hủy bộ hồ sơ ${second.code}` }).click();
    const confirm = page.getByRole("dialog", { name: /Hủy bộ hồ sơ/ });
    await expect(confirm).toContainText(`${second.code} · 2 phiếu điều trị`);
    await confirm.getByRole("button", { name: "Hủy bộ hồ sơ" }).click();
    await expect(page.getByText("Đã hủy bộ hồ sơ").first()).toBeVisible();

    sets = await setsOf(page, patient.id);
    expect(sets.at(-1)!.id).toBe(second.id);
    expect(sets.at(-1)!.status).toBe(2);
    const after = await slipsOf(page, patient.id);
    expect(
      after
        .filter((slip) => slip.recordSetId === null)
        .map((slip) => slip.treatmentPlanId)
        .sort(),
    ).toEqual([b.id, c.id].sort());

    await page.reload();
    await picker(page).click();
    const items = page.locator(".rs-picker-item");
    await expect(items.last()).toContainText(second.code);
    await expect(items.last()).toContainText("Đã hủy");
    await expect(items.last().getByRole("button", { name: /^Sửa bộ hồ sơ/ })).toHaveCount(0);

    // A cancelled set takes nothing new.
    const add = await call<{ error?: { code?: string } }>(page, SHEETS_API, {
      method: "POST",
      json: { patientId: patient.id, recordSetId: second.id, form: 1, title: "Bìa hồ sơ bệnh án" },
    });
    expect(add.status).toBe(403);
    expect(add.body.error?.code).toBe("BlueDental:Patient:0025");
  });
});
