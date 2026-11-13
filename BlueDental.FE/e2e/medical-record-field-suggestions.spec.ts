import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { SETS_API, SHEETS_API, openBenhAn, seedPatientWithSlips } from "./fixtures/medicalRecordSet";
import { call, firstBranchId } from "./fixtures/timekeepingStaff";

/**
 * Feature: "Gợi ý khi nhập" on Bệnh án mẫu 2 (R-1219, clinic 2026-11-12).
 * Typing in "2. Bệnh chuyên khoa" (text.30) or "5. Chẩn đoán của khoa khám
 * bệnh" (text.43) lists what the branch wrote in that blank before, from the
 * first letter; Ctrl + Space lists it in an empty blank too (R-1220) — only
 * texts written for at least two patients, so one patient's own note is
 * never offered on another's sheet. Every printed line of the part offers the
 * same list, line by line, a page at a time as it is scrolled (R-1222).
 *
 * Real login, real API, real PostgreSQL: the history is written through the
 * sheets API for patients of the run's own, then the clinic's side is driven
 * in the browser and read back after a reload. Nothing is intercepted. Each
 * run's texts carry its run id, so earlier runs' sheets do not get in the way.
 */

const FORM_OUTPATIENT_DENTAL = 2;
const SPECIALTY = "outpatient-dental.text.30";
const DIAGNOSIS = "outpatient-dental.text.43";
const FORM_ROW = "Bệnh án ngoại trú Răng Hàm Mặt";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

interface Sheet {
  id: string;
  content: string | null;
}

async function liveSetOf(page: Page, patientId: string, slipId: string, branchId: string): Promise<string> {
  const made = await call<{ id: string }>(page, SETS_API, {
    method: "POST",
    branchId,
    json: { patientId, treatmentPlanIds: [slipId], visibleForms: [] },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  return made.body.id;
}

/** A mẫu 2 sheet holding `values`, written the way the sheet itself saves. */
async function writeSheet(
  page: Page,
  patient: { id: string; setId: string; branchId: string },
  title: string,
  values: Record<string, string>,
): Promise<string> {
  const added = await call<{ id: string }>(page, SHEETS_API, {
    method: "POST",
    branchId: patient.branchId,
    json: { patientId: patient.id, recordSetId: patient.setId, form: FORM_OUTPATIENT_DENTAL, title },
  });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  const saved = await call(page, `${SHEETS_API}/${added.body.id}`, {
    method: "PUT",
    branchId: patient.branchId,
    json: { content: JSON.stringify({ fieldValues: values }) },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return added.body.id;
}

async function seedWithSet(page: Page) {
  const patient = await seedPatientWithSlips(page, 1);
  const setId = await liveSetOf(page, patient.id, patient.slips[0].id, patient.branchId);
  return { id: patient.id, setId, branchId: patient.branchId };
}

async function suggestionsFor(page: Page, branchId: string) {
  return call<{ field: string; fields: string[]; values: string[] }[]>(
    page,
    `${SHEETS_API}/field-suggestions?form=${FORM_OUTPATIENT_DENTAL}`,
    { branchId },
  );
}

test.describe("Bệnh án mẫu 2 — gợi ý khi nhập", () => {
  test.describe.configure({ timeout: 240_000 });

  test("gợi ý câu đã dùng cho ≥ 2 bệnh nhân; ↓ + Enter và bấm chuột điền vào ô; câu riêng của 1 bệnh nhân không hiện; lưu và tải lại vẫn còn", async ({ page }) => {
    const id = runId();
    const sharedDiagnosis = `E2E${id} Sai khớp cắn hạng II (hai hàm)`;
    const sharedSpecialty = `E2E${id} Viêm lợi mạn toàn hàm`;
    const ownNote = `E2E${id} Ghi chú riêng của một bệnh nhân`;

    await login(page);
    const [a, b, c] = [await seedWithSet(page), await seedWithSet(page), await seedWithSet(page)];
    const branchId = a.branchId;
    await writeSheet(page, a, `E2E gợi ý A ${id}`, { [DIAGNOSIS]: sharedDiagnosis, [SPECIALTY]: sharedSpecialty });
    await writeSheet(page, b, `E2E gợi ý B ${id}`, { [DIAGNOSIS]: `  ${sharedDiagnosis} `, [SPECIALTY]: sharedSpecialty });
    // Written twice, but for one patient: still that patient's own.
    await writeSheet(page, c, `E2E gợi ý C1 ${id}`, { [DIAGNOSIS]: ownNote });
    await writeSheet(page, c, `E2E gợi ý C2 ${id}`, { [DIAGNOSIS]: ownNote });
    // The sheet the clinic writes on now: both blanks emptied, not answered by the record.
    const title = `E2E gợi ý viết ${id}`;
    const sheetId = await writeSheet(page, c, title, { [DIAGNOSIS]: "", [SPECIALTY]: "" });

    const offered = await suggestionsFor(page, branchId);
    expect(offered.status).toBe(200);
    const byField = new Map(offered.body.map((item) => [item.field, item.values]));
    expect([...byField.keys()]).toEqual([SPECIALTY, DIAGNOSIS]);
    expect(byField.get(DIAGNOSIS)).toContain(sharedDiagnosis);
    expect(byField.get(DIAGNOSIS)).not.toContain(ownNote);
    expect(byField.get(SPECIALTY)).toContain(sharedSpecialty);

    // Another branch's sheets offer nothing of this branch's.
    const elsewhere = await suggestionsFor(page, BRANCH_TWO);
    expect(elsewhere.status).toBe(200);
    expect(elsewhere.body.flatMap((item) => item.values)).not.toContain(sharedDiagnosis);
    // A form that offers none answers empty.
    const cover = await call<unknown[]>(page, `${SHEETS_API}/field-suggestions?form=1`, { branchId });
    expect(cover.body).toEqual([]);

    await openBenhAn(page, c.id);
    await page.locator(".pd-medical-form", { hasText: FORM_ROW }).locator(".pd-sheet-card", { hasText: title })
      .locator(".pd-sheet-open").click();
    const sheet = page.frameLocator(".mr-doc-frame");
    const blank = (field: string) => sheet.locator(`[data-medical-record-field="${field}"]`);
    await expect(blank(DIAGNOSIS)).toBeAttached();
    const list = page.getByRole("listbox", { name: "Gợi ý từ các phiếu trước" });

    // Ctrl + Space in the empty blank: its most used texts, in the server's order — and no space typed.
    await blank(DIAGNOSIS).click();
    await page.keyboard.press("Control+Space");
    await expect(list).toBeVisible();
    const top = (byField.get(DIAGNOSIS) ?? []).slice(0, 10);
    await expect(list.getByRole("option")).toHaveText(top);
    await expect(blank(DIAGNOSIS)).toHaveText("");
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);

    // One letter is enough to be offered something.
    const private_ = `e2e${id} ghi chu`;
    await page.keyboard.type(private_.charAt(0));
    await expect(list).toBeVisible();

    // One patient's own note is never offered, however much of it is typed — not on Ctrl + Space either.
    await page.keyboard.type(private_.slice(1));
    await expect(blank(DIAGNOSIS)).toHaveText(private_);
    await expect(list).toHaveCount(0);
    await page.keyboard.press("Control+Space");
    await expect(list).toHaveCount(0);

    // Without accents, a word at a time: the shared diagnosis is offered, the typed part plain.
    for (let i = 0; i < private_.length; i += 1) await page.keyboard.press("Backspace");
    await expect(blank(DIAGNOSIS)).toHaveText("");
    await page.keyboard.type(`e2e${id} sai khop`);
    const option = list.getByRole("option", { name: sharedDiagnosis });
    await expect(option).toBeVisible();
    await expect(option.locator("strong")).toHaveCount(1);
    await expect(option.locator("strong")).toHaveText(/^\s*cắn hạng II \(hai hàm\)$/);

    // Esc closes; typing on opens it again; ↓ then Enter writes it in instead of moving to the next line.
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await page.keyboard.type(" c");
    await expect(option).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(blank(DIAGNOSIS)).toHaveText(sharedDiagnosis);

    // A click picks too, and the caret stays to type on.
    await blank(SPECIALTY).click();
    await page.keyboard.type(`E2E${id} viem`);
    await list.getByRole("option", { name: sharedSpecialty }).click();
    await expect(list).toHaveCount(0);
    await page.keyboard.type(" (đã điều trị)");
    await expect(blank(SPECIALTY)).toHaveText(`${sharedSpecialty} (đã điều trị)`);

    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();

    const stored = await call<Sheet>(page, `${SHEETS_API}/${sheetId}`, { branchId });
    const values = JSON.parse(stored.body.content ?? "{}").fieldValues;
    expect(values[DIAGNOSIS]).toBe(sharedDiagnosis);
    expect(values[SPECIALTY]).toBe(`${sharedSpecialty} (đã điều trị)`);

    await page.reload();
    await page.locator(".pd-medical-form", { hasText: FORM_ROW }).locator(".pd-sheet-card", { hasText: title })
      .locator(".pd-sheet-open").click();
    await expect(blank(DIAGNOSIS)).toHaveText(sharedDiagnosis);
  });

  test("mọi dòng của mục đều gợi ý như dòng đầu; danh sách dài cuộn tới cuối thì tải thêm", async ({ page }) => {
    const id = runId();
    const line = (n: number) => `E2E${id} Mục ${String(n).padStart(2, "0")}`;
    const many = Array.from({ length: 12 }, (_, n) => line(n + 1));
    const added = `E2E${id} Dòng thêm`;
    const diagnosisLine = `E2E${id} Mất răng 36`;

    await login(page);
    const [a, b, c] = [await seedWithSet(page), await seedWithSet(page), await seedWithSet(page)];
    const branchId = a.branchId;
    // Written on different lines of the part, several to a blank, one on a line added with Enter:
    // each line counts on its own, wherever in the part it was written.
    await writeSheet(page, a, `E2E dòng A ${id}`, {
      "outpatient-dental.text.32": many.join("\n"),
      "custom.line.outpatient-dental.text.35.1": added,
      "outpatient-dental.text.44": diagnosisLine,
    });
    await writeSheet(page, b, `E2E dòng B ${id}`, {
      "outpatient-dental.text.31": many.slice(0, 6).join("\n"),
      "outpatient-dental.text.34": many.slice(6).join("\n"),
      [SPECIALTY]: added,
      [DIAGNOSIS]: diagnosisLine,
    });
    const title = `E2E dòng viết ${id}`;
    await writeSheet(page, c, title, {});

    const offered = await suggestionsFor(page, branchId);
    expect(offered.status).toBe(200);
    const [specialty, diagnosis] = offered.body;
    expect(specialty.fields).toEqual([30, 31, 32, 33, 34, 35].map((n) => `outpatient-dental.text.${n}`));
    expect(diagnosis.fields).toEqual([DIAGNOSIS, "outpatient-dental.text.44"]);
    expect(specialty.values).toEqual(expect.arrayContaining([...many, added]));
    expect(diagnosis.values).toContain(diagnosisLine);

    await openBenhAn(page, c.id);
    await page.locator(".pd-medical-form", { hasText: FORM_ROW }).locator(".pd-sheet-card", { hasText: title })
      .locator(".pd-sheet-open").click();
    const sheet = page.frameLocator(".mr-doc-frame");
    const blank = (field: string) => sheet.locator(`[data-medical-record-field="${field}"]`);
    await expect(blank(SPECIALTY)).toBeAttached();
    const list = page.getByRole("listbox", { name: "Gợi ý từ các phiếu trước" });
    const options = list.getByRole("option");

    // Full text, trimmed (R-1223): a piece from inside a word, a space after it, still finds the line.
    await blank(SPECIALTY).click();
    await page.keyboard.type(`2e${id} dong them `);
    await expect(options).toHaveText([added]);
    // Only what the choice adds is bold: here the "E" before the piece typed.
    await expect(options.first().locator("strong")).toHaveText(["E"]);

    // The first line, then Enter to the line under it: that line offers the same list.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await page.keyboard.type(`e2e${id} muc`);
    await expect(options).toHaveCount(10);
    await expect(options.first()).toHaveText(line(1));

    // Scrolled to its end, the list loads the rest.
    await list.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
    await expect(options).toHaveCount(12);
    await options.last().click();
    await expect(list).toHaveCount(0);
    await expect(blank("outpatient-dental.text.31")).toHaveText(line(12));
    await expect(blank(SPECIALTY)).toHaveText(`2e${id} dong them`);

    // A lower line reached by clicking: ↓ past the tenth loads the next page and keeps it in sight.
    await blank("outpatient-dental.text.34").click();
    await page.keyboard.press("Control+Space");
    await expect(options).toHaveCount(Math.min(10, specialty.values.length));
    if (specialty.values.length > 10) {
      for (let i = 0; i < 11; i += 1) await page.keyboard.press("ArrowDown");
      await expect(options).toHaveCount(Math.min(20, specialty.values.length));
      await expect(options.nth(10)).toHaveAttribute("aria-selected", "true");
      await expect(options.nth(10)).toBeInViewport();
    }
    await page.keyboard.press("Escape");

    // "5. Chẩn đoán": its second line offers what was written on either of its lines.
    await blank("outpatient-dental.text.44").click();
    await page.keyboard.type(`e2e${id} mat`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(blank("outpatient-dental.text.44")).toHaveText(diagnosisLine);

    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();
    await page.reload();
    await page.locator(".pd-medical-form", { hasText: FORM_ROW }).locator(".pd-sheet-card", { hasText: title })
      .locator(".pd-sheet-open").click();
    await expect(blank("outpatient-dental.text.31")).toHaveText(line(12));
    await expect(blank("outpatient-dental.text.44")).toHaveText(diagnosisLine);
  });

  test("không có quyền sửa bệnh án thì không được hỏi gợi ý", async ({ page, browser }) => {
    await login(page);
    await page.goto("/patient");
    const branchId = await firstBranchId(page);
    const roleName = `Gợi ý chỉ xem ${runId()}`;
    const role = await call<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    const granted = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
      method: "PUT",
      json: { permissions: [{ name: "BlueDental.patientMedicalRecord.read", isGranted: true }] },
    });
    expect(granted.status).toBe(204);
    const userName = `goiy${runId()}`;
    const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
      method: "POST",
      json: {
        userName,
        password: "GoiY@123456",
        name: `Nhân viên gợi ý ${userName}`,
        email: `${userName}@bluedental.local`,
        roleNames: [roleName],
        branchIds: [branchId],
        isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body)).toBe(200);

    const context = await browser.newContext();
    try {
      const reader = await context.newPage();
      await login(reader, { userName, password: "GoiY@123456" });
      expect((await suggestionsFor(reader, branchId)).status).toBe(403);
    } finally {
      await context.close();
      await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    }
  });
});
