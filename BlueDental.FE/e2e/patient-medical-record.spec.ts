import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { SETS_API, openRecordWithSet } from "./fixtures/medicalRecordSet";
import { firstLineOf, pdfPageTexts } from "./fixtures/pdfText";
import { call, firstBranchId } from "./fixtures/timekeepingStaff";

/**
 * Feature: Bệnh án — the record's second view, a tab of its own on the right
 * of the tab row (R-1204; before that a Chi tiết hồ sơ / Bệnh án switch).
 *
 * Every form is drawn from the blank it is printed on, filled through its
 * `data-medical-record-field` blanks, in its own document. So the assertions
 * reach into that document rather than into the app's DOM.
 *
 * Real stack throughout: adding a sheet POSTs, saving PUTs, and everything is
 * read back from PostgreSQL after a reload. Nothing is intercepted.
 */

/**
 * Opens the record patient's Bệnh án, on the bộ hồ sơ their sheets are kept in
 * — see fixtures/medicalRecordSet.ts.
 */
async function openMedicalRecord(page: Page) {
  await openRecordWithSet(page);
}

/**
 * A sheet card still in use. A cancelled copy ("Đã hủy") stays in the index
 * but takes no writing, so the helpers below never pick one.
 */
const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";

/** The sheet cards nested under one form's row in the index. */
function cardsUnder(page: Page, form: string) {
  return page.locator(".pd-medical-form", { hasText: form }).locator(LIVE_CARD);
}

/** The open sheet's own document. */
function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

/** One blank on the open sheet, by the id the form gives it. */
function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

/** Opens a form's first sheet, adding one if the patient has none yet. */
async function openSheet(page: Page, form: string) {
  const cards = cardsUnder(page, form);
  if ((await cards.count()) === 0) {
    await page.locator(".pd-medical-form", { hasText: form }).getByRole("button", { name: "Thêm" }).click();
    // Adding several forms in a row stacks their toasts; the newest is the one meant.
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
  }
  await cards.first().locator(".pd-sheet-open").click();
  await sheetReady(page);
}

/** The frame is in the DOM before its document is; the blanks say when it is. */
async function sheetReady(page: Page) {
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(sheet(page).locator("[data-medical-record-field]").first()).toBeAttached();
}

/** The fixed group of Danh mục → Vật liệu nha khoa a kind is filed under; the server makes them on first read. */
async function materialGroup(page: Page, branch: string, kind: number): Promise<string> {
  const groups = await call<{ items: Array<{ id: string; subGroup: string | null }> }>(
    page,
    `/api/v1/app/taxonomies?clinicBranchId=${branch}&group=dental_material&maxResultCount=20`,
    { branchId: branch },
  );
  const wanted = kind === 2 ? "implant" : "crown";
  const group = groups.body.items.find((item) => item.subGroup === wanted);
  expect(group, `the ${wanted} group`).toBeTruthy();
  return group!.id;
}

async function save(page: Page) {
  await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
  // Saving twice in one test stacks two toasts; the newest is the one meant.
  await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();
}

/**
 * A brand-new copy of a form, so nothing written on an earlier one is in the
 * way. The tests that assert what the *record* answers need that.
 */
async function openLastSheet(page: Page, form: string) {
  await cardsUnder(page, form).first().locator(".pd-sheet-open").click();
  await sheetReady(page);
}

/** The forms, by the number the API stores them under. */
const FORM_NUMBER: Record<string, number> = {
  "Bìa hồ sơ bệnh án": 1,
  "Bệnh án ngoại trú Răng Hàm Mặt": 2,
  "Bệnh án chỉnh nha": 3,
  "Phiếu Tư Vấn Tổng Quát": 4,
  "Phiếu tư vấn và xác nhận đồng ý điều trị": 5,
  "Giấy đồng ý thực hiện phẫu thuật/thủ thuật": 6,
  "Phiếu phẫu thuật/thủ thuật": 7,
  "Phiếu theo dõi điều trị": 8,
  "Phiếu chăm sóc": 9,
  "Hợp đồng thỏa thuận niềng răng": 10,
};

/** A diagnosis too long for its blank's line, so it goes on to lines of its own (flowLines). */
const LONG_DIAGNOSIS =
  "S02.5 - Gãy răng (răng 18); K13.2 - Bạch sản niêm mạc miệng (răng 17); K12.2 - Viêm mô tế bào và áp xe miệng (răng 16); K08.3 - Chân răng còn sót lại (răng 14); K05.1 - Viêm lợi mạn (răng 25, 26)";

/**
 * A sheet with nothing written on it, for the tests that assert what the
 * *record* answers, or what a blank form draws.
 *
 * Wipes the form's first copy rather than adding another one: a run that adds
 * leaves the sheet behind, and after a few of them the index carries dozens of
 * copies and the suite slows to a crawl. Keyed on the form's number, not its
 * name — a sheet can be renamed.
 *
 * `written` is put on it instead of nothing: a sheet as it was saved before.
 */
async function openFreshSheet(page: Page, form: string, written: Record<string, string> = {}) {
  const row = page.locator(".pd-medical-form", { hasText: form });
  const cards = row.locator(LIVE_CARD);

  if ((await cards.count()) === 0) {
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(cards).toHaveCount(1);
  }

  const wiped = await page.evaluate(async ({ number, written }) => {
    const patientId = window.location.pathname.split("/")[2];
    const read = async () => {
      // Only the live set's sheets: one in a cancelled set is read-only, and the
      // server refuses to write on it.
      const sets: Array<{ id: string; status: number }> = (
        await (await fetch(`/api/v1/app/medical-record-sets?patientId=${patientId}`, { credentials: "include" })).json()
      ).items;
      const live = new Set(sets.filter((set) => set.status === 1).map((set) => set.id));
      const res = await fetch(
        `/api/v1/app/patient-medical-records?patientId=${patientId}&maxResultCount=200`,
        { credentials: "include" },
      );
      const items: Array<{
        id: string;
        form: number;
        recordSetId: string;
        creationTime: string;
        content: string | null;
        cancelledAt: string | null;
      }> = (await res.json()).items;
      return items
        .filter((item) => item.form === number && !item.cancelledAt && live.has(item.recordSetId))
        .sort((a, b) => a.creationTime.localeCompare(b.creationTime))[0];
    };

    const sheet = await read();
    if (!sheet) return "no sheet";

    const put = await fetch(`/api/v1/app/patient-medical-records/${sheet.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // An explicit set of values, empty unless asked, not null: the API treats
      // a null content as "leave it as it is", which is what lets a rename send
      // only a title.
      body: JSON.stringify({ content: JSON.stringify({ fieldValues: written }) }),
    });
    if (!put.ok) return `put ${put.status}`;

    // Read it back: the sheet is drawn again straight after, and it has to be
    // the wiped copy that appears.
    for (let tries = 0; tries < 10; tries += 1) {
      const again = await read();
      const values = again?.content ? Object.keys(JSON.parse(again.content).fieldValues ?? {}) : [];
      if (values.length === Object.keys(written).length) return "ok";
      await new Promise((done) => setTimeout(done, 150));
    }
    return "still filled";
  }, { number: FORM_NUMBER[form], written });
  expect(wiped).toBe("ok");

  await page.reload();
  await cards.first().locator(".pd-sheet-open").click();
  await sheetReady(page);
}

/**
 * Hovering a row inside the sheet's own document, having brought it into view
 * first — below the breakpoint the column around it is a scroller of its own.
 */
async function hoverRow(page: Page, field: string) {
  const row = blank(page, field);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
}

/** Puts `text` on the clipboard — with an HTML copy beside it, as a page copies, when `html` is given. */
async function copyText(page: Page, text: string, html?: string) {
  await page.evaluate(
    async ({ text, html }) => {
      if (html === undefined) return navigator.clipboard.writeText(text);
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    },
    { text, html },
  );
}

/** A blank's whole value, its own line and the lines it flowed onto joined by a space. */
async function flowedValue(page: Page, field: string) {
  return sheet(page)
    .locator(`[data-medical-record-field="${field}"], [data-flow-of="${field}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.textContent).join(" "));
}

test.describe("Bệnh án", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the index lists the reference's nine forms, then the clinic's own, and the view rides in the URL", async ({
    page,
  }) => {
    await openMedicalRecord(page);

    // The index, in the reference's own order and wording, then the clinic's mẫu 10, 11, 12.
    const forms = [
      "1. Bìa hồ sơ bệnh án",
      "2. Bệnh án ngoại trú Răng Hàm Mặt",
      "3. Bệnh án chỉnh nha",
      "4. Phiếu Tư Vấn Tổng Quát",
      "5. Phiếu tư vấn và xác nhận đồng ý điều trị",
      "6. Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
      "7. Phiếu phẫu thuật/thủ thuật",
      "8. Phiếu theo dõi điều trị",
      "9. Phiếu chăm sóc",
      "10. Hợp đồng thỏa thuận niềng răng",
      "11. Bảng kiểm an toàn phẫu thuật",
      "12. Bảng kiểm đếm gạc, dụng cụ sắc nhọn, dụng cụ",
    ];
    await expect(page.locator(".pd-medical-form")).toHaveCount(forms.length);
    for (const label of forms) {
      await expect(page.locator(".pd-medical-form").getByText(label, { exact: true })).toBeVisible();
    }

    // The bar the reference floats along the bottom. The doctor picker the
    // reference puts at the end of the sheet's heading is hidden (clinic, 2026-10-17).
    for (const command of ["Từng phiếu", "Toàn bộ", "In biểu mẫu", "Đồng bộ phiếu", "Lưu"]) {
      await expect(page.locator(".pd-medical-bar").getByText(command, { exact: true })).toBeVisible();
    }
    await expect(page.locator(".pd-medical-zoom")).toContainText("100%");
    await expect(page.locator(".pd-medical-canvas-head .ant-select")).toHaveCount(0);

    // Bệnh án is a tab: it alone is current while open (R-1204).
    const tabs = page.locator(".pd-tabrow");
    const recordTab = tabs.getByRole("link", { name: "Bệnh án", exact: true });
    // The pill, not aria-current: every tab shares /patient/:id and differs in
    // ?tab= alone, which NavLink's own match ignores.
    await expect(recordTab).toHaveClass(/pill-tab--active/);
    await expect(tabs.locator(".pill-tab--active")).toHaveCount(1);

    // Any tab on the left leaves it — no "Chi tiết hồ sơ" to press first.
    await expect(page.getByRole("button", { name: "Chi tiết hồ sơ" })).toHaveCount(0);
    await tabs.getByRole("link", { name: "Lịch hẹn", exact: true }).click();
    await expect(page).toHaveURL(/tab=appointment/);
    await expect(page).not.toHaveURL(/medical-record/);
    await expect(page.locator(".pd-medical-form")).toHaveCount(0);
    await tabs.getByRole("link", { name: "Hồ sơ", exact: true }).click();
    await expect(page.locator(".pd-profile-card")).toBeVisible();

    // Back again through its own tab; the link from before R-1204 still opens it.
    const profileUrl = page.url();
    await recordTab.click();
    await expect(page).toHaveURL(/tab=medical-record/);
    await expect(page.locator(".pd-medical-form")).toHaveCount(forms.length);
    await page.goto(profileUrl.replace(/tab=profile/, "view=medical-record"));
    await expect(page.locator(".pd-medical-form")).toHaveCount(forms.length);
    await expect(recordTab).toHaveClass(/pill-tab--active/);
  });

  /**
   * The nine forms are documents, not code: the only thing worth asserting
   * about their layout is that each draws the whole of its own printed
   * original. The counts are the reference's, taken off the same blanks.
   */
  test("every form draws the whole of its printed original", async ({ page }) => {
    // Ten forms, each wiped and reloaded before it is counted.
    test.slow();
    await openMedicalRecord(page);

    const expected = [
      // The reference's 56, plus Phường/Xã and Tỉnh/Thành phố under Địa chỉ (clinic, 2026-10-16).
      { form: "Bìa hồ sơ bệnh án", blanks: 58, boxes: 20, pages: 3 },
      // The reference's 142, less Thôn, phố and Huyện (clinic, 2026-10-16).
      { form: "Bệnh án ngoại trú Răng Hàm Mặt", blanks: 140, boxes: 18, pages: 3 },
      // Plus "Tôi …" and the patient's name under NGƯỜI BỆNH/THÂN NHÂN (clinic, 2026-11-10, R-1191).
      { form: "Bệnh án chỉnh nha", blanks: 184, boxes: 64, pages: 3 },
      { form: "Phiếu Tư Vấn Tổng Quát", blanks: 22, boxes: 0, pages: 1 },
      // The reference's 82, less the cost table's eighth line: seven and Tổng, as on paper (2026-10-16).
      // Since 2026-10-16: "Loại" comes from Danh mục (Zirconia…Khác and the implant's typed type
      // became one blank each) and "Niềng răng" joined Phương pháp điều trị.
      { form: "Phiếu tư vấn và xác nhận đồng ý điều trị", blanks: 75, boxes: 17, pages: 2 },
      // The reference's 49, plus a blank after "Tê môi, tê lưỡi" (BA, 2026-11-02, R-1132).
      { form: "Giấy đồng ý thực hiện phẫu thuật/thủ thuật", blanks: 50, boxes: 26, pages: 2 },
      // 38 of the reference's, plus our drawing blank for "Lược đồ"; since the BA's
      // Word copy (R-1280) a blank for the place before the signing day, and the
      // tenth TRÌNH TỰ line only on a sheet already written on it.
      { form: "Phiếu phẫu thuật/thủ thuật", blanks: 39, boxes: 2, pages: 1 },
      // The BA's Word copies: seventeen log rows on mẫu 8 (R-1281), twenty on mẫu 9 (R-1282).
      { form: "Phiếu theo dõi điều trị", blanks: 75, boxes: 2, pages: 1 },
      { form: "Phiếu chăm sóc", blanks: 108, boxes: 2, pages: 1 },
      // The clinic's .docx (2026-10-29): every dotted line a blank; Loại mắc cài
      // as on mẫu 3, four boxes and their prices (BA, 2026-11-01, R-1097). Since
      // the clinic's own copy (R-1266) one break only: the contract, then the
      // agreement, each running on over as many sheets as it takes.
      { form: "Hợp đồng thỏa thuận niềng răng", blanks: 53, boxes: 4, pages: 2 },
    ];

    for (const item of expected) {
      // On a wiped copy: a row added by another test and saved would show up
      // here as extra blanks. The heading carries the *sheet's* name, which may
      // have been renamed, so what identifies the form is the blanks it draws.
      await openFreshSheet(page, item.form);

      const document = sheet(page);
      // The form's own blanks: lines or rows the record's treatment slips grow
      // it by (P1810 — a long plan on mẫu 3, a long log) are not the original's.
      await expect(
        document.locator("[data-medical-record-field]:not([data-medical-record-generated-row] *)"),
      ).toHaveCount(item.blanks);
      // The form's own boxes: "Loại" on mẫu 5 draws one per type in Danh mục, which varies.
      await expect(document.locator(".nfc-medical-record-checkbox:not(.nfc-material-box)")).toHaveCount(item.boxes);
      // Pages are separated by a rule; one rule is two pages.
      await expect(document.locator(".nfc-tpl > hr")).toHaveCount(item.pages - 1);
    }
  });

  /*
   * Clinic, 2026-10-27: the "MS:" corner carries each printed form's own code.
   * BA, 2026-10-29 (R-1069): and nobody changes it — the blank takes no typing,
   * a sheet saved with another code before shows the form's own, and the code
   * reads as plain text rather than as a blank, on screen and on paper.
   */
  test("Bệnh án ngoại trú, Giấy đồng ý and Phiếu phẫu thuật print their MS, which nobody can change", async ({
    page,
  }) => {
    await openMedicalRecord(page);
    const codes: Array<[string, string, string]> = [
      ["Bệnh án ngoại trú Răng Hàm Mặt", "custom.text.8b780086e4014a049f87decd95bffaf3", "16/BV-01"],
      ["Giấy đồng ý thực hiện phẫu thuật/thủ thuật", "custom.text.6d1c4222d1b041c1aff9becd446183e1", "01/BV2"],
      ["Phiếu phẫu thuật/thủ thuật", "custom.text.8d7eb5b7fe9746b3909ce9c21ba46a31", "PT-11"],
    ];
    // The code against the words around it: the box, tint and dotted line a blank draws.
    const looks = (node: Element) => {
      const style = getComputedStyle(node);
      const around = getComputedStyle(node.parentElement!);
      return {
        border: style.borderBottomStyle,
        outline: style.outlineStyle,
        background: style.backgroundColor,
        sameColour: style.color === around.color,
      };
    };
    const plain = { border: "none", outline: "none", background: "rgba(0, 0, 0, 0)", sameColour: true };
    for (const [form, field, code] of codes) {
      await openFreshSheet(page, form, { [field]: "99/SỬA TAY" });
      const ms = blank(page, field);
      await expect(ms, form).toHaveText(code);
      await expect(ms, form).not.toHaveAttribute("contenteditable");
      expect(await ms.evaluate(looks), form).toEqual(plain);
      await ms.click();
      await page.keyboard.type("9");
      await expect(ms, form).toHaveText(code);

      await page.emulateMedia({ media: "print" });
      const printed = await ms.evaluate(looks);
      await page.emulateMedia({ media: "screen" });
      expect(printed, `${form} on paper`).toEqual(plain);
    }

    // A form without a code of its own still has its MS written by hand, in a blank.
    await openFreshSheet(page, "Phiếu theo dõi điều trị");
    const handWritten = blank(page, "custom.text.15acbc6a08b2454e985bf7bc663d4afe");
    await expect(handWritten).toHaveAttribute("contenteditable", "true");
    expect(await handWritten.evaluate((node) => getComputedStyle(node).borderBottomStyle)).toBe("dotted");
  });

  test("the cover prints the record's own identity", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bìa hồ sơ bệnh án");

    // The blanks the reference answers from the record. The name is printed in
    // capitals, which is a different blank from the plain one. The date of
    // birth is left out on purpose: the front desk may register a patient
    // without one, and then the sheet has nothing to print there either.
    await expect(blank(page, "cover.patient.code")).not.toBeEmpty();
    await expect(blank(page, "cover.patient.name")).not.toBeEmpty();
    await expect(blank(page, "cover.patient.name")).toHaveText(/^[^a-z]+$/);

    // The letterhead comes from the branch, not from the form.
    await expect(sheet(page).locator(".nfc-tpl")).toContainText("SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH");
    await expect(sheet(page).locator(".nfc-tpl")).toContainText("THUỘC");
  });

  test("what is written on a sheet survives a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Bìa hồ sơ bệnh án");

    const archive = `LT-${runId()}`;
    await blank(page, "cover.text.1").fill(archive);
    await blank(page, "cover.checkbox.1").check();
    await save(page);

    await page.reload();
    await openSheet(page, "Bìa hồ sơ bệnh án");
    await expect(blank(page, "cover.text.1")).toHaveText(archive);
    await expect(blank(page, "cover.checkbox.1")).toBeChecked();
  });

  /**
   * A blank left as the record answered it is not stored, so a later correction
   * to the patient still shows through. Writing something else over it *is*
   * stored — that is a decision about this sheet — and putting the record's own
   * answer back drops it again.
   */
  test("a blank that agrees with the record is not frozen into the sheet", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bìa hồ sơ bệnh án");

    const code = blank(page, "cover.patient.code");
    const fromRecord = (await code.textContent()) ?? "";
    expect(fromRecord).not.toBe("");

    const stored = async () => {
      const raw = await page.evaluate(async () => {
        const url = new URL(window.location.href);
        const id = url.pathname.split("/")[2];
        const res = await fetch(
          `/api/v1/app/patient-medical-records?patientId=${id}&maxResultCount=100`,
          { credentials: "include" },
        );
        const body = await res.json();
        const covers = body.items
          .filter((item: { form: number; cancelledAt: string | null }) => item.form === 1 && !item.cancelledAt)
          .sort((a: { creationTime: string }, b: { creationTime: string }) =>
            a.creationTime.localeCompare(b.creationTime),
          );
        return covers[0]?.content ?? "{}";
      });
      return JSON.parse(raw).fieldValues ?? {};
    };

    await code.fill(`${fromRecord}-X`);
    await save(page);
    expect(Object.keys(await stored())).toContain("cover.patient.code");

    await code.fill(fromRecord);
    await save(page);
    expect(Object.keys(await stored())).not.toContain("cover.patient.code");
  });

  test("a sheet can be renamed from its card, and keeps what is written on it", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Phiếu chăm sóc");

    const note = `CS-${runId()}`;
    await blank(page, "care.patient.code").fill(note);
    await save(page);

    const card = cardsUnder(page, "Phiếu chăm sóc").first();
    await card.getByRole("button", { name: /^Đổi tên/ }).click();
    const dialog = page.getByRole("dialog", { name: "Đổi tên phiếu" });
    await expect(dialog).toBeVisible();
    const renamed = `Phiếu chăm sóc ${runId()}`;
    await dialog.getByRole("textbox").fill(renamed);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã đổi tên phiếu")).toBeVisible();

    await page.reload();
    await openSheet(page, "Phiếu chăm sóc");
    await expect(cardsUnder(page, "Phiếu chăm sóc").first()).toContainText(renamed);
    await expect(blank(page, "care.patient.code")).toHaveText(note);
  });

  test("Toàn bộ shows every sheet at once, and none of them takes edits", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Bìa hồ sơ bệnh án");

    const total = await page.locator(".pd-sheet-card").count();
    await page.locator(".pd-medical-bar").getByText("Toàn bộ", { exact: true }).click();
    await expect(page.locator(".mr-doc-frame")).toHaveCount(total);

    const first = page.frameLocator(".mr-doc-frame").first();
    await expect(first.locator("[contenteditable]")).toHaveCount(0);
    /*
     * Held still by the stylesheet, never `disabled`: a disabled box is greyed
     * by the browser and the reference's blue tick goes with it — which is
     * exactly what these sheets lost.
     */
    await expect(first.locator(".nfc-medical-record-checkbox:disabled")).toHaveCount(0);
    await expect(first.locator('.nfc-tpl[data-readonly="true"]')).toHaveCount(1);
  });
  test("the outpatient form draws the two figures it is printed with", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");

    // Section IV-3 is a drawing, not text: without the files the sheet prints
    // a broken box where the clinic marks the teeth.
    const figures = sheet(page).locator("img");
    await expect(figures).toHaveCount(2);
    const loaded = await page
      .frameLocator(".mr-doc-frame")
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).naturalWidth),
      );
    for (const width of loaded) expect(width).toBeGreaterThan(0);
  });

  test("the outpatient number is the clinic's own, not the record's code", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu theo dõi điều trị");

    // The set's Số ngoại trú, NT-{xxxxxxxx}{MMdd} (R-1305) — never the bare patient code.
    const number = blank(page, "treatment-tracking.page-1.patient.code");
    await expect(number).toHaveText(/^NT-\d{12}$/);
    await expect(number).not.toHaveAttribute("data-field-source", /.+/);
  });

  /**
   * Owner, 2026-10-19: a row added under row 1 came back at the bottom of the
   * table once the sheet was saved and drawn again, and `−` overlapped `+`.
   */
  test("a row added mid-table stays where it was added, and − and + stand apart", async ({ page }) => {
    const id = runId();
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu theo dõi điều trị");

    const document = sheet(page);
    const firstBlanks = () =>
      document
        .locator("tbody > tr")
        .evaluateAll((rows) =>
          rows
            .map((row) => row.querySelector("[data-medical-record-field]")?.getAttribute("data-medical-record-field") ?? "")
            .filter((field) => field.includes(".row-")),
        );

    const rowOne = document.locator("tr", {
      has: document.locator('[data-medical-record-field="treatment-tracking.page-1.row-1.date-time"]'),
    });
    await rowOne.hover();
    const plus = document.getByRole("button", { name: "Thêm dòng" });
    const minus = document.getByRole("button", { name: "Xóa dòng" });
    const [plusBox, minusBox] = [await plus.boundingBox(), await minus.boundingBox()];
    expect(plusBox!.x - (minusBox!.x + minusBox!.width), "a clear gap between − and +").toBeGreaterThanOrEqual(4);

    await plus.click();
    const added = (await firstBlanks())[1];
    expect(added).not.toBe("treatment-tracking.page-1.row-2.date-time");
    await document.locator(`[data-medical-record-field="${added}"]`).fill(`GIỮA ${id}`);

    // Row 3 is removed too: after more writing and a second save it stays gone.
    const rowThree = document.locator("tr", {
      has: document.locator('[data-medical-record-field="treatment-tracking.page-1.row-3.date-time"]'),
    });
    await rowThree.hover();
    await minus.click();
    await save(page);
    await document.locator('[data-medical-record-field="treatment-tracking.page-1.row-2.date-time"]').fill(`SAU ${id}`);
    await save(page);

    await page.reload();
    await openLastSheet(page, "Phiếu theo dõi điều trị");
    const order = await firstBlanks();
    expect(order[1], "the added row is still under row 1").toBe(added);
    expect(order).not.toContain("treatment-tracking.page-1.row-3.date-time");
    await expect(document.locator(`[data-medical-record-field="${added}"]`)).toHaveText(`GIỮA ${id}`);
    await expect(document.locator('[data-medical-record-field="treatment-tracking.page-1.row-2.date-time"]')).toHaveText(
      `SAU ${id}`,
    );
  });

  /**
   * The cost table on the consent form is a list, so the reference lets a row
   * be added — and only added: nothing printed on that form can be taken away.
   */
  test("a cost row can be added, and comes back after a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    const document = sheet(page);
    await expect(document.getByRole("button", { name: "Xóa dòng" })).toHaveCount(0);

    const rows = document.locator("tbody > tr");
    const before = await rows.count();
    // The form prints seven cost lines (clinic, 2026-10-16). The eighth comes back
    // under its old names, so a sheet written on before the change keeps its line;
    // the ninth is the first with the newer ones.
    await hoverRow(page, "consultation.text.39");
    await document.getByRole("button", { name: "Thêm dòng" }).click();
    await expect(rows).toHaveCount(before + 1);
    const eighth = blank(page, "consultation.text.43");
    await expect(eighth).toBeAttached();
    await eighth.fill("Cạo vôi răng");

    await hoverRow(page, "consultation.text.43");
    await document.getByRole("button", { name: "Thêm dòng" }).click();
    await expect(rows).toHaveCount(before + 2);
    await blank(page, "consultation.treatment-cost.row-9.service").fill("Trám răng");
    await save(page);

    await page.reload();
    // The sheet this test made, not the record's first copy of the form.
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(blank(page, "consultation.text.43")).toHaveText("Cạo vôi răng");
    await expect(blank(page, "consultation.treatment-cost.row-9.service")).toHaveText("Trám răng");
  });

  /**
   * The two treatment logs offer both handles: a whole printed block can be
   * taken off them, and the removal has to outlive the row it removed.
   */
  test("a row of the treatment log can be removed for good", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu chăm sóc");

    const document = sheet(page);
    const rows = document.locator("tbody > tr");
    const before = await rows.count();

    const firstLogRow = blank(page, "care.row-1.date");
    await hoverRow(page, "care.row-1.date");
    await document.getByRole("button", { name: "Xóa dòng" }).click();
    await expect(rows).toHaveCount(before - 1);
    await expect(firstLogRow).toHaveCount(0);
    await save(page);

    await page.reload();
    await openLastSheet(page, "Phiếu chăm sóc");
    await expect(blank(page, "care.row-1.date")).toHaveCount(0);
    await expect(sheet(page).locator("tbody > tr")).toHaveCount(before - 1);
  });

  test("the open sheet's card wears its own form's colour", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Bệnh án chỉnh nha");

    const card = cardsUnder(page, "Bệnh án chỉnh nha").first();
    const add = page
      .locator(".pd-medical-form", { hasText: "Bệnh án chỉnh nha" })
      .getByRole("button", { name: "Thêm" });

    // The card is inside that form's row and next to its own button; a blue
    // ring on the orange row reads as belonging to something else.
    const accent = await add.evaluate((node) => getComputedStyle(node).backgroundColor);
    await expect(card).toHaveClass(/pd-sheet-card--active/);
    const border = await card.evaluate((node) => getComputedStyle(node).borderTopColor);
    expect(border).toBe(accent);
  });
  test("every sheet's name is shown in full, however long", async ({ page }) => {
    await openMedicalRecord(page);

    // The longest of the nine is "Giấy đồng ý thực hiện phẫu thuật/thủ thuật";
    // it wraps onto a second line and the card grows, rather than the name
    // being cut off — which is what a button's `nowrap` used to do to it.
    const clipped = await page.locator(".pd-sheet-title").evaluateAll((titles) =>
      titles
        .filter(
          (title) =>
            title.scrollHeight > Math.ceil(title.getBoundingClientRect().height) + 1 ||
            title.scrollWidth > Math.ceil(title.getBoundingClientRect().width) + 1,
        )
        .map((title) => title.textContent),
    );
    expect(clipped).toEqual([]);
  });

  /**
   * The reference keeps a 320px index beside the sheet while there is room, and
   * folds to one column below 1024px — closing the index to its header and
   * pinning the bar to the window, because there is no column left to sit over.
   */
  /**
   * On a wide window the index folds to the reference's 64px rail
   * (`lg:grid-cols-[64px_minmax(0,1fr)]`) holding only its PanelLeftOpen
   * button, and the sheet takes the width. Read off its bundle 2026-09-24.
   */
  test("the index folds to a rail on a wide window and opens again", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openMedicalRecord(page);

    const grid = page.locator(".pd-medical-grid");
    const index = page.locator(".pd-medical-index");
    const canvas = page.locator(".pd-medical-canvas");
    await expect(grid).toHaveCSS("grid-template-columns", /^320px /);
    const wideBefore = (await canvas.boundingBox())!.width;

    const fold = page.getByRole("button", { name: "Thu gọn mục lục bệnh án" });
    await expect(fold).toHaveAttribute("title", "Thu gọn mục lục");
    await fold.click();

    await expect(index).toHaveClass(/--collapsed/);
    await expect(grid).toHaveCSS("grid-template-columns", /^64px /);
    await expect.poll(async () => Math.round((await index.boundingBox())!.width)).toBe(64);
    // The rail is the button and nothing else — no set picker, no forms.
    await expect(index.locator(".rs-picker-trigger")).toBeHidden();
    await expect(page.locator(".pd-medical-forms")).toBeHidden();
    // It keeps the column's height, as the reference's `lg:h-full` does.
    expect((await index.boundingBox())!.height).toBeGreaterThan(400);
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(wideBefore + 200);

    const open = page.getByRole("button", { name: "Mở rộng mục lục bệnh án" });
    await expect(open).toHaveAttribute("title", "Mở rộng mục lục");
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await open.click();
    await expect(index).not.toHaveClass(/--collapsed/);
    await expect(grid).toHaveCSS("grid-template-columns", /^320px /);
    await expect(page.locator(".pd-medical-forms")).toBeVisible();
    await expect(index.locator(".rs-picker-trigger")).toBeVisible();
  });

  test("the two columns fold on a narrow window", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMedicalRecord(page);

    const grid = page.locator(".pd-medical-grid");
    await expect(grid).toHaveCSS("grid-template-columns", /^320px /);
    await expect(page.locator(".pd-medical-index")).not.toHaveClass(/--collapsed/);
    await expect(page.locator(".pd-medical-barwrap")).toHaveCSS("position", "absolute");

    // The bar sits over the sheet, not over the index.
    const centres = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return Math.round(rect.x + rect.width / 2);
      };
      return { bar: box(".pd-medical-bar"), canvas: box(".pd-medical-canvas") };
    });
    expect(Math.abs(centres.bar - centres.canvas)).toBeLessThanOrEqual(2);

    await page.setViewportSize({ width: 900, height: 900 });
    await expect(grid).toHaveCSS("grid-template-columns", /^\d+px$/);
    await expect(page.locator(".pd-medical-index")).toHaveClass(/--collapsed/);
    await expect(page.locator(".pd-medical-barwrap")).toHaveCSS("position", "fixed");

    /*
     * The sheet column keeps a scroller of its own here, as the reference does
     * at every width — a window's worth of height with a 560px floor. Handing
     * all the scrolling to the page instead meant a record could only be read
     * by scrolling the whole app past it.
     */
    const scrolling = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>(".pd-medical-canvas")!;
      const scroller = document.querySelector<HTMLElement>(".pd-medical-canvas-scroll")!;
      const paper = document.querySelector<HTMLElement>(".pd-medical-paper")!;
      scroller.scrollTop = 400;
      return {
        canvasHeight: Math.round(canvas.getBoundingClientRect().height),
        scrolls: scroller.scrollHeight > scroller.clientHeight + 1,
        scrolledTo: scroller.scrollTop,
        paperHeight: Math.round(paper.getBoundingClientRect().height),
      };
    });
    expect(scrolling.canvasHeight).toBeGreaterThanOrEqual(560);
    expect(scrolling.scrolls).toBe(true);
    expect(scrolling.scrolledTo).toBe(400);
    // The paper is the sheet's own height; the column above is what scrolls it.
    expect(scrolling.paperHeight).toBeGreaterThan(900);

    /*
     * The index gets the same treatment. It is bounded to a window's worth and
     * its list scrolls inside it, so the header stays put — nine form rows and
     * every copy made from them is several windows of content otherwise.
     */
    await page.getByRole("button", { name: "Mở rộng mục lục bệnh án" }).click();
    const listScrolling = await page.evaluate(() => {
      const index = document.querySelector<HTMLElement>(".pd-medical-index")!;
      const list = document.querySelector<HTMLElement>(".pd-medical-forms")!;
      const headTop = document.querySelector(".pd-medical-index-head")!.getBoundingClientRect().top;
      list.scrollTop = 300;
      return {
        indexHeight: Math.round(index.getBoundingClientRect().height),
        scrolls: list.scrollHeight > list.clientHeight + 1,
        scrolledTo: list.scrollTop,
        headStaysPut:
          document.querySelector(".pd-medical-index-head")!.getBoundingClientRect().top === headTop,
      };
    });
    expect(listScrolling.indexHeight).toBeGreaterThanOrEqual(560);
    expect(listScrolling.scrolls).toBe(true);
    expect(listScrolling.scrolledTo).toBe(300);
    expect(listScrolling.headStaysPut).toBe(true);

    // Narrow enough that a sheet of A4 no longer fits: only the paper slides
    // sideways, never the app around it.
    await page.setViewportSize({ width: 640, height: 900 });
    const slides = await page.evaluate(() => ({
      paper:
        document.querySelector(".pd-medical-paper")!.scrollWidth >
        document.querySelector(".pd-medical-paper")!.clientWidth,
      app: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    expect(slides.paper).toBe(true);
    expect(slides.app).toBe(false);
  });
  /**
   * The reference's sheet card is a sticky header over a scrolling body, so
   * `Bản NN`, the sheet's name and the day it is filled in for stay in place
   * while the A4 moves under them. It holds at both widths: the scroller is
   * inside the column, and the bar that floats over the column is outside it.
   */
  test("the sheet's own head stays put while the paper scrolls", async ({ page }) => {
    for (const width of [1440, 900]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 1440) await openMedicalRecord(page);
      await sheetReady(page);

      const head = page.locator(".pd-medical-canvas-head");
      await expect(head).toHaveCSS("position", "sticky");

      const moved = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>(".pd-medical-canvas-scroll")!;
        const at = () => ({
          head: Math.round(
            document.querySelector(".pd-medical-canvas-head")!.getBoundingClientRect().top,
          ),
          sheet: Math.round(document.querySelector(".mr-doc")!.getBoundingClientRect().top),
        });
        scroller.scrollTop = 0;
        const before = at();
        scroller.scrollTop = 600;
        return { before, after: at(), scrolled: scroller.scrollTop };
      });

      expect(moved.scrolled).toBe(600);
      // The sheet went up by the whole scroll; the head did not move at all.
      expect(moved.before.sheet - moved.after.sheet).toBe(600);
      expect(moved.after.head).toBe(moved.before.head);

      // And the bar rides with the column, not with the sheet.
      await expect(page.locator(".pd-medical-bar")).toBeVisible();
    }
  });

  /**
   * The card's height is the reference's own 93px — the text block inside
   * `12px 10px` and a 2px border — and 113px when the name takes two lines.
   * It is what holds the tick in the corner clear of the three action buttons
   * across the middle: widen the index into one column and the meta fits on a
   * single row, which took the card down to ~65px and brought the buttons up
   * level with the tick.
   */
  /**
   * `+` sits just off the row's right edge, so a hand reaching it crosses a few
   * pixels of nothing. It has to survive that crossing.
   *
   * `locator.click()` cannot catch this: Playwright jumps the pointer straight
   * onto the button, and the handle only vanished for a pointer that travelled.
   * So this walks it across in small steps, the way a hand does.
   */
  test("the + on a row survives the pointer travelling to it", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    const document = sheet(page);
    const rows = document.locator("tbody > tr");
    const before = await rows.count();

    await hoverRow(page, "consultation.text.39");
    const plus = document.getByRole("button", { name: "Thêm dòng" });
    await expect(plus).toBeVisible();

    // Where the row ends and where the button sits, in the page's own frame.
    const where = await page.evaluate(() => {
      const frame = document.querySelector("iframe.mr-doc-frame") as HTMLIFrameElement;
      const origin = frame.getBoundingClientRect();
      const inner = frame.contentDocument!;
      const button = [...inner.querySelectorAll("body > button")].find(
        (node) => node.getAttribute("aria-label") === "Thêm dòng",
      )!;
      const box = button.getBoundingClientRect();
      const row = inner
        .querySelector('[data-medical-record-field="consultation.text.39"]')!
        .closest("tr")!
        .getBoundingClientRect();
      return {
        rowRight: origin.x + row.right,
        midY: origin.y + row.top + row.height / 2,
        buttonX: origin.x + box.left + box.width / 2,
        buttonY: origin.y + box.top + box.height / 2,
        gap: Math.round(box.left - row.right),
      };
    });

    // The reference puts it 4px clear of the row; that gap is the whole problem.
    expect(where.gap).toBeGreaterThan(0);

    await page.mouse.move(where.rowRight - 40, where.midY);
    for (let x = where.rowRight - 40; x <= where.buttonX; x += 3) {
      await page.mouse.move(x, where.midY + (where.buttonY - where.midY) / 8);
    }
    await page.mouse.move(where.buttonX, where.buttonY);

    // Still there after the journey — and it still does what it says.
    await expect(plus).toBeVisible();
    await page.mouse.click(where.buttonX, where.buttonY);
    await expect(rows).toHaveCount(before + 1);
  });

  /**
   * What reaches the paper is a *copy* of the sheet, made in the app's own
   * document — the reference prints the same way.
   *
   * Printing the sheet's own frame in place cannot work: to a printer an
   * iframe is one box, sliced wherever the outer page ends, and a row of the
   * table came out torn in half across the fold. The copy is real markup in
   * the page, so the form's own page breaks are what decide where paper ends.
   */
  test("printing copies the sheet into the page, with everything on it", async ({ page }) => {
    // The real print button, with only the dialog itself stubbed out.
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { __printed?: boolean }).__printed = true;
      };
    });
    await openMedicalRecord(page);
    await openSheet(page, "Bìa hồ sơ bệnh án");

    // Something written on the sheet, to prove the copy is the live one.
    const note = `In ${runId()}`;
    await blank(page, "cover.text.1").fill(note);

    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed?: boolean }).__printed)).toBe(
      true,
    );

    const copy = page.locator(".mr-print-copy");
    await expect(copy.locator(".nfc-tpl")).toHaveCount(1);
    await expect(copy).toContainText(note);

    const paper = await page.evaluate(() => {
      const holder = document.querySelector<HTMLElement>(".mr-print-copy")!;
      const live = document
        .querySelector<HTMLIFrameElement>(".mr-doc-frame")!
        .contentDocument!.querySelector(".nfc-tpl")!;
      const copied = holder.querySelector(".nfc-tpl")!;
      const text = (node: Element) => (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const ticked = (node: Element, live: boolean) =>
        [...node.querySelectorAll("input[type=checkbox]")].filter((box) =>
          live ? (box as HTMLInputElement).checked : box.hasAttribute("checked"),
        ).length;
      return {
        sameText: text(live) === text(copied),
        // The form's own page breaks travel with it.
        pageBreaks: copied.querySelectorAll(":scope > hr").length,
        liveTicks: ticked(live, true),
        copiedTicks: ticked(copied, false),
        // And the copy is a child of the body, so isolating it is one rule.
        atBodyLevel: holder.parentElement === document.body,
      };
    });

    expect(paper.sameText).toBe(true);
    expect(paper.pageBreaks).toBeGreaterThan(0);
    expect(paper.copiedTicks).toBe(paper.liveTicks);
    expect(paper.atBodyLevel).toBe(true);

    // On paper: the copy, and nothing else of the app.
    await page.emulateMedia({ media: "print" });
    const onPaper = await page.evaluate(() => {
      const tick = document
        .querySelector(".mr-print-copy")!
        .querySelector<HTMLElement>(".nfc-medical-record-checkbox");
      const style = tick && getComputedStyle(tick);
      return {
        shown: [...document.body.children]
          .filter((node) => getComputedStyle(node).display !== "none")
          .map((node) => node.className || node.tagName),
        // A ticked box keeps the reference's blue; a printer set to economy
        // would otherwise grey it out.
        tickAccent: style?.accentColor,
        tickColours: style?.printColorAdjust,
      };
    });
    await page.emulateMedia({ media: null });

    expect(onPaper.shown).toEqual(["mr-print-copy"]);
    expect(onPaper.tickAccent).toBe("rgb(38, 113, 216)");
    expect(onPaper.tickColours).toBe("exact");
  });

  /**
   * "Chọn phiếu in" asks which sheets go in one run, so the ticks have to
   * decide what is copied — printing everything on the canvas ignored them.
   */
  test("the print picker copies only the sheets that were ticked", async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await openMedicalRecord(page);

    await page.locator(".pd-medical-bar").getByRole("button", { name: "Toàn bộ" }).click();
    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();

    const picker = page.locator(".pd-print-pick");
    await expect(picker).toBeVisible();

    // It opens with the whole record ticked: printing all of it is what the
    // panel is usually opened for.
    const rows = picker.locator(".pd-print-pick-row");
    const total = await rows.count();
    expect(total).toBeGreaterThan(2);
    await expect(picker.locator(".pd-print-pick-row .ant-checkbox-checked")).toHaveCount(total);

    // Leave two ticked, and only those two reach the paper.
    for (let at = 2; at < total; at++) await rows.nth(at).click();
    await expect(picker.locator(".pd-print-pick-row .ant-checkbox-checked")).toHaveCount(2);

    await picker.getByRole("button", { name: "In" }).click();
    await expect(page.locator(".mr-print-copy .nfc-tpl")).toHaveCount(2);
  });

  /**
   * With one column the index sits above the sheet and is a window tall, so a
   * sheet picked from it opens a screen and a half below the fold — picking a
   * card looked like it did nothing. The list has to fold away and the sheet
   * come into view. With two columns nothing may move.
   */
  test("picking a sheet from the folded index opens it and closes the list", async ({ page }) => {
    // Opened wide — the patient list is a table there — then folded, which is
    // also how a real window reaches this state.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMedicalRecord(page);
    // The shared record may keep no mẫu 3 or Bìa yet (a run's own patient with
    // a few other sheets can be the one picked), so both are made sure of; the
    // Bìa is left open, so picking mẫu 3 below has to change the sheet.
    await openSheet(page, "3. Bệnh án chỉnh nha");
    await openSheet(page, "1. Bìa hồ sơ bệnh án");
    await page.setViewportSize({ width: 900, height: 700 });

    const index = page.locator(".pd-medical-index");
    const bar = page.locator(".pd-medical-barwrap");
    const openTitle = page.locator(".pd-medical-canvas-head strong");

    await expect(index).toHaveClass(/--collapsed/);
    await page.getByRole("button", { name: "Mở rộng mục lục bệnh án" }).click();
    await expect(index).not.toHaveClass(/--collapsed/);

    /*
     * The bar floats over the window here, so with the list open it floats over
     * the list — and its buttons swallowed taps meant for the cards under it (a
     * click on a card landed on the zoom's `+`). It stands down until the list
     * folds again.
     */
    await expect(bar).toBeHidden();

    const target = cardsUnder(page, "3. Bệnh án chỉnh nha").first();
    const name = await target.locator(".pd-sheet-title").textContent();
    await target.locator(".pd-sheet-open").click();

    await expect(index).toHaveClass(/--collapsed/);
    await expect(openTitle).toHaveText(name!);
    await expect(bar).toBeVisible();

    // The reveal scrolls smoothly, so this is what it settles on.
    await expect(async () => {
      const seen = await page.locator(".pd-medical-canvas").evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.top < window.innerHeight && box.bottom > 0 && box.top < 200;
      });
      expect(seen).toBe(true);
    }).toPass({ timeout: 5000 });

    // Two columns: both are already in view, so the list stays as it was.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(index).not.toHaveClass(/--collapsed/);
    await page
      .locator(".pd-medical-form", { hasText: "1. Bìa hồ sơ bệnh án" })
      .locator(".pd-sheet-open")
      .first()
      .click();
    await expect(openTitle).toHaveText("Bìa hồ sơ bệnh án");
    await expect(index).not.toHaveClass(/--collapsed/);
    await expect(bar).toBeVisible();
  });

  /**
   * Five of the nine are filled in for a particular day, and say so beside the
   * doctor picker. The wording is each form's own.
   */
  test("the dated forms carry their own date filter", async ({ page }) => {
    await openMedicalRecord(page);

    const expected: Array<[string, string | null]> = [
      ["Bìa hồ sơ bệnh án", null],
      ["Bệnh án ngoại trú Răng Hàm Mặt", null],
      ["Bệnh án chỉnh nha", null],
      ["Phiếu Tư Vấn Tổng Quát", "Ngày thực hiện"],
      ["Phiếu tư vấn và xác nhận đồng ý điều trị", "Ngày tư vấn"],
      ["Giấy đồng ý thực hiện phẫu thuật/thủ thuật", "Ngày thực hiện"],
      ["Phiếu phẫu thuật/thủ thuật", null],
      ["Phiếu theo dõi điều trị", "Ngày thực hiện"],
      ["Phiếu chăm sóc", "Ngày thực hiện"],
    ];

    for (const [form, label] of expected) {
      await openSheet(page, form);
      const picker = page.locator(".pd-medical-date");
      if (label === null) {
        await expect(picker).toHaveCount(0);
      } else {
        await expect(picker).toContainText(label);
        // Opens on today, as the reference does.
        await expect(picker.locator("input")).not.toHaveValue("");
      }
    }
  });

  /**
   * The address and the diagnoses, which the reference leaves for the clinic's
   * pen and the clinic asked to have printed (2026-10-14). A patient of its own,
   * so the address and the one diagnosis on the sheets are known.
   */
  test("the record's address and diagnoses reach every form that prints them", async ({ page }) => {
    test.setTimeout(120_000);
    const branch = "11111111-1111-1111-1111-111111111111";
    const suffix = runId();
    // Kept without its leading 0, as imported records carry it; the sheet prints the 0.
    const guardianPhone = `9${suffix.padStart(8, "0").slice(-8)}`;
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const patient = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
      method: "POST",
      branchId: branch,
      json: {
        firstName: "Địa Chỉ",
        lastName: `Ràng Buộc ${suffix}`,
        gender: 2,
        phoneNumber: `07${suffix.padStart(8, "0").slice(-8)}`,
        dateOfBirth: "1990-05-05",
        address: "12 Lý Thường Kiệt",
        provinceCode: "01",
        wardCode: "00004",
        examinationReason: `Đau răng hàm dưới ${suffix}`,
        guardians: [
          {
            id: null,
            linkedPatientId: null,
            relation: 2,
            relationNote: null,
            proofType: null,
            proofBlobName: null,
            proofFileName: null,
            fullName: `Mẹ Ràng Buộc ${suffix}`,
            phone: guardianPhone,
            nationalId: `0791${suffix.padStart(8, "0").slice(-8)}`,
            dateOfBirth: null,
            idIssuedOn: null,
            idIssuedPlace: null,
            gender: 2,
            email: null,
            occupationEntryId: null,
            sameAddressAsPatient: true,
            address: null,
            isPrimaryContact: true,
          },
        ],
        guardiansConsented: true,
      },
    });
    expect(patient.status, JSON.stringify(patient.body)).toBe(200);

    const catalog = await call<{ items: Array<{ id: string; name: string }> }>(
      page,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`,
      { branchId: branch },
    );
    const staff = await call<{ items: Array<{ id: string }> }>(page, "/api/v1/app/staff?MaxResultCount=1", {
      branchId: branch,
    });
    const diagnosis = catalog.body.items[0];
    const slip = await call(page, "/api/v1/app/patient-diagnoses", {
      method: "POST",
      branchId: branch,
      json: {
        patientId: patient.body.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.body.items[0].id,
        teeth: [{ toothCode: 16, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
      },
    });
    expect(slip.status, JSON.stringify(slip.body)).toBe(200);

    const address = "12 Lý Thường Kiệt, Phường Ba Đình, Thành phố Hà Nội";
    const diagnosed = `${diagnosis.name} (răng 16)`;

    // Sheets are kept in a bộ hồ sơ, and a set is opened for a treatment slip.
    const treatment = await createSlipViaApi(page, patient.body.id);
    const set = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.body.id, treatmentPlanIds: [treatment.id], visibleForms: [] },
    });
    expect(set.status, JSON.stringify(set.body)).toBe(200);

    // The name under BÁC SĨ on mẫu 3 is the slip's doctor, by Chức danh (R-1197).
    const facts = await call<{ plans: { dentistName: string | null }[] }>(
      page,
      `${SETS_API}/${set.body.id}/sheet-facts`,
    );
    expect(facts.status, JSON.stringify(facts.body)).toBe(200);
    const slipDentist = facts.body.plans[0]?.dentistName ?? "";
    expect(slipDentist).not.toBe("");

    await page.goto(`/patient/${patient.body.id}?branchId=${branch}&view=medical-record`);
    await expect(page.locator(".pd-medical-form").first()).toBeVisible();

    // Every form with an address or a Chẩn đoán blank, by the blank it prints them in.
    const expected: Array<[string, Record<string, string>]> = [
      [
        "Bìa hồ sơ bệnh án",
        {
          // The ward and province have a line of their own under Địa chỉ (clinic, 2026-10-16).
          "cover.patient.address": "12 Lý Thường Kiệt",
          "cover.patient.ward": "Phường Ba Đình",
          "cover.patient.province": "Thành phố Hà Nội",
        },
      ],
      [
        "Bệnh án ngoại trú Răng Hàm Mặt",
        {
          // Số nhà / Xã, phường / Tỉnh are three blanks on this form.
          "outpatient.patient.address": "12 Lý Thường Kiệt",
          "outpatient-dental.text.5": "Phường Ba Đình",
          "outpatient-dental.text.7": "Thành phố Hà Nội",
          "outpatient-dental.text.43": diagnosed,
          // II. Lý do vào viện (clinic, 2026-10-16).
          "custom.text.66d78a3bbe7442658cecbf611b7b286d": `Đau răng hàm dưới ${suffix}`,
          // + Gia đình is the family's illnesses, not the guardian on file (R-1195).
          "outpatient-dental.text.23": "Chưa phát hiện gì bất thường",
          // What the clinic writes on nearly every one (2026-11-09): Dân tộc, a
          // Bản thân the hồ sơ says nothing of, and the director's name.
          "outpatient-dental.text.3": "Kinh",
          "outpatient.patient.history": "Chưa phát hiện gì bất thường",
          "outpatient-dental.text.59": "BS.CKII. BÙI VĂN TỚI",
        },
      ],
      [
        "Bệnh án chỉnh nha",
        {
          "orthodontic.patient.address": address,
          "orthodontic.text.86": diagnosed,
          // The names at the foot (clinic, 2026-11-10): under NGƯỜI BỆNH/THÂN NHÂN
          // the patient; under BÁC SĨ the slip's doctor — BS.CKII. BÙI VĂN TỚI
          // only with no slip to name one (R-1191, R-1197).
          "orthodontic.text.114": `Ràng Buộc ${suffix} Địa Chỉ`,
          "orthodontic.text.112": slipDentist,
        },
      ],
      [
        "Phiếu Tư Vấn Tổng Quát",
        {
          "general-consultation.text.10": `RÀNG BUỘC ${suffix} ĐỊA CHỈ`,
          "general-consultation.text.11": "1990",
          "general-consultation.text.12": address,
          "general-consultation.text.13": patient.body.patientCode,
          "custom.text.9959ffa6f36f45b89e42d5a486996216": diagnosed,
        },
      ],
      [
        "Phiếu tư vấn và xác nhận đồng ý điều trị",
        {
          "consultation.text.1": patient.body.patientCode,
          "consultation.patient.address": address,
          // "II. CHẨN ĐOÁN" is the doctor's to write at the consultation.
          "consultation.text.5": "",
        },
      ],
      [
        "Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
        // Chẩn đoán is the doctor's to write: the sheet cannot tell which slip the operation is for.
        { "surgery-consent.text.3": `Ràng Buộc ${suffix} Địa Chỉ`, "surgery-consent.text.4": "" },
      ],
      ["Phiếu phẫu thuật/thủ thuật", { "procedure-record.text.1": diagnosed }],
      ["Phiếu chăm sóc", { "care.diagnosis": diagnosed }],
      [
        "Hợp đồng thỏa thuận niềng răng",
        {
          "orthodontic-contract.patient.address": address,
          // Chẩn đoán is written by hand: the contract is for braces alone and
          // the record's other diagnoses do not belong on it (R-1324).
          "orthodontic-contract.text.7": "",
          // An adult signs alone: the guardian on file is not printed as a parent.
          "orthodontic-contract.text.29": "",
        },
      ],
    ];

    for (const [form, blanks] of expected) {
      await openSheet(page, form);
      for (const [field, text] of Object.entries(blanks)) {
        await expect(blank(page, field), `${form} · ${field}`).toHaveText(text);
      }
    }

    // The 2025 two-level units have no hamlet or district: those blanks are gone.
    await openSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    await expect(blank(page, "outpatient-dental.text.4")).toHaveCount(0);
    await expect(blank(page, "outpatient-dental.text.6")).toHaveCount(0);
    await expect(sheet(page).getByText("Thôn, phố")).toHaveCount(0);
    // 13. … nơi giới thiệu: "2. Tự đến" is ticked, "1. Y tế" is not (clinic, 2026-11-09).
    await expect(blank(page, "outpatient-dental.checkbox.6")).toBeChecked();
    await expect(blank(page, "outpatient-dental.checkbox.5")).not.toBeChecked();
    // A default is a blank, not print: unticked and saved, it stays unticked.
    await blank(page, "outpatient-dental.checkbox.6").uncheck();
    await save(page);
    await page.reload();
    await openSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    await expect(blank(page, "outpatient-dental.checkbox.6")).not.toBeChecked();
    await expect(blank(page, "outpatient-dental.text.3")).toHaveText("Kinh");

    // Saved as the record answered it, nothing is frozen into the sheet, and the
    // answer comes back from PostgreSQL after a reload.
    await openSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await save(page);
    await page.reload();
    await openSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(blank(page, "consultation.patient.address")).toHaveText(address);
    await expect(blank(page, "consultation.text.5")).toBeEmpty();
  });

  /**
   * Mẫu 10 asks for a parent or guardian "nếu khách hàng chưa đủ 18 tuổi"
   * (R-1079): for a patient under 18 the primary guardian's name is printed
   * there. An adult's guardian is not — the test above.
   */
  test("mẫu 10 names the guardian of a patient under 18", async ({ page }) => {
    const branch = "11111111-1111-1111-1111-111111111111";
    const suffix = runId();
    const born = new Date().getFullYear() - 10;
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const patient = await call<{ id: string }>(page, "/api/v1/app/patients", {
      method: "POST",
      branchId: branch,
      json: {
        firstName: "Niềng Răng",
        lastName: `Vị Thành Niên ${suffix}`,
        gender: 2,
        phoneNumber: `08${suffix.padStart(8, "0").slice(-8)}`,
        dateOfBirth: `${born}-03-03`,
        guardians: [
          {
            id: null,
            linkedPatientId: null,
            relation: 2,
            relationNote: null,
            proofType: null,
            proofBlobName: null,
            proofFileName: null,
            fullName: `Mẹ Hợp Đồng ${suffix}`,
            phone: `03${suffix.padStart(8, "0").slice(-8)}`,
            nationalId: `0792${suffix.padStart(8, "0").slice(-8)}`,
            dateOfBirth: null,
            idIssuedOn: null,
            idIssuedPlace: null,
            gender: 2,
            email: null,
            occupationEntryId: null,
            sameAddressAsPatient: true,
            address: null,
            isPrimaryContact: true,
          },
        ],
        guardiansConsented: true,
      },
    });
    expect(patient.status, JSON.stringify(patient.body)).toBe(200);

    const treatment = await createSlipViaApi(page, patient.body.id);
    const set = await call(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.body.id, treatmentPlanIds: [treatment.id], visibleForms: [] },
    });
    expect(set.status, JSON.stringify(set.body)).toBe(200);

    await page.goto(`/patient/${patient.body.id}?branchId=${branch}&view=medical-record`);
    await expect(page.locator(".pd-medical-form").first()).toBeVisible();
    await openSheet(page, "Hợp đồng thỏa thuận niềng răng");
    // The label runs most of the line (R-1266): the name flows on to the line under it.
    const guardian = await sheet(page)
      .locator('[data-medical-record-field="orthodontic-contract.text.29"], [data-flow-of="orthodontic-contract.text.29"]')
      .allTextContents();
    expect(guardian.join(" ").replace(/\s+/g, " ").trim()).toBe(`Mẹ Hợp Đồng ${suffix}`);
    await expect(blank(page, "orthodontic-contract.patient.date-of-birth")).toHaveText(`03/03/${born}`);
  });

  test("Toàn màn hình spreads the sheet over the window and gives it back", async ({ page }) => {
    await openMedicalRecord(page);
    await openSheet(page, "Bìa hồ sơ bệnh án");
    const canvas = page.locator(".pd-medical-canvas");
    const bar = page.locator(".pd-medical-bar");

    await bar.getByRole("button", { name: "Toàn màn hình" }).hover();
    await expect(page.getByRole("tooltip", { name: "Toàn màn hình" })).toBeVisible();
    await bar.getByRole("button", { name: "Toàn màn hình" }).click();
    await expect(canvas).toHaveClass(/pd-medical-canvas--fullscreen/);
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const box = await canvas.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    // The sheet is still there to be written on while it covers the window.
    await expect(blank(page, "cover.text.1")).toBeVisible();

    await bar.getByRole("button", { name: "Thoát toàn màn hình" }).click();
    await expect(canvas).not.toHaveClass(/pd-medical-canvas--fullscreen/);
  });

  /**
   * Mẫu 5 laid out as the clinic's paper copy (2026-10-16): the title on one
   * line and sections I–IV — the cost table and "tổng tiền viết bằng chữ"
   * included — on the first printed page, which holds 280mm (A4 less the 5mm
   * print margins and the sheet's 7mm top padding), measured under the
   * sheet's print rules.
   */
  test("mẫu 5 fits sections I–IV on its first page, under a one-line title", async ({ page }) => {
    // Seven cost lines and Tổng, type a size up, the paper's small boxes, "Khác" under the grid's column.
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    const title = sheet(page).locator('h1[data-record-section="consultation-title"]');
    await expect(title).toHaveText("PHIẾU TƯ VẤN VÀ XÁC NHẬN ĐỒNG Ý ĐIỀU TRỊ NHA KHOA");
    const titleBox = await title.locator("strong").evaluate((node) => {
      const range = node.ownerDocument.createRange();
      range.selectNodeContents(node);
      return range.getClientRects().length;
    });
    expect(titleBox, "the title wraps").toBe(1);

    for (const heading of ["I. Thông tin khách hàng:", "II. Chẩn đoán:", "III. Phương pháp điều trị:", "IV. Chi phí điều trị"]) {
      await expect(sheet(page).getByText(heading, { exact: true })).toBeVisible();
    }

    // Measured as it prints: the sheet's print rules lay the page out wider than the screen does.
    await page.emulateMedia({ media: "print" });
    const firstPageMm = await sheet(page)
      .locator(".nfc-tpl")
      .evaluate((tpl) => {
        const rule = tpl.querySelector(":scope > hr") as HTMLElement;
        const padding = parseFloat(getComputedStyle(tpl).paddingTop);
        return ((rule.offsetTop - padding) * 25.4) / 96;
      });
    await page.emulateMedia({ media: "screen" });
    expect(firstPageMm).toBeLessThanOrEqual(280);

    const document = sheet(page);
    await expect(document.locator('table[data-record-section="consultation-cost"] tbody > tr')).toHaveCount(9);
    await expect(document.locator('table[data-record-section="consultation-cost"] tbody > tr').last()).toContainText("Tổng");
    // 13pt, as the BA's Word copy sets it (R-1274, sizes again R-1291).
    expect(await document.locator(".nfc-tpl").evaluate((tpl) => getComputedStyle(tpl).fontSize)).toBe("17.333px");

    const box = (field: string) => document.locator(`[data-medical-record-field="${field}"]`).boundingBox();
    const [scaling, other] = await Promise.all([box("consultation.checkbox.1"), box("consultation.checkbox.9")]);
    expect(other?.x).toBeCloseTo(scaling?.x ?? -1, 0);
    expect(scaling?.width).toBeCloseTo(12, 0);

    // On paper a blank inside a table has no dotted line; one outside keeps it.
    await page.emulateMedia({ media: "print" });
    const line = (field: string) =>
      document
        .locator(`[data-medical-record-field="${field}"]`)
        .evaluate((blank) => getComputedStyle(blank).borderBottomStyle);
    expect(await line("consultation.text.22")).toBe("none");
    expect(await line("consultation.text.3")).toBe("dotted");
    await page.emulateMedia({ media: "screen" });
  });

  /**
   * Enter in a blank, as the reference does it (staging, 2026-10-16): the
   * blank in the block below takes the caret; with none there, a new line
   * holding one blank is added under it — inside the cell, in a table — and
   * the lines added come back after a reload.
   */
  test("Enter moves to the blank below, or adds a line that survives a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    const document = sheet(page);
    const caret = () =>
      document
        .locator("body")
        .evaluate((body) => body.ownerDocument.activeElement?.getAttribute("data-medical-record-field") ?? null);
    const blanks = document.locator("[data-medical-record-field]");
    const before = await blanks.count();

    // A blank right below: the caret moves, nothing is added.
    await blank(page, "consultation.text.5").click();
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("consultation.text.6");
    // "Họ tên" goes down to "Địa chỉ", not across to "Ngày sinh".
    await blank(page, "consultation.patient.name").click();
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("consultation.patient.address");
    await expect(blanks).toHaveCount(before);

    // A heading below: a line is added under the blank, and Enter keeps adding.
    await blank(page, "consultation.text.6").click();
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("custom.line.consultation.text.6.1");
    await page.keyboard.type("Viêm nướu");
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("custom.line.consultation.text.6.2");
    await page.keyboard.type("Sâu răng 16");
    await expect(blanks).toHaveCount(before + 2);

    // Backspace or Delete in an empty added line takes it away again (owner, 2026-10-16).
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("custom.line.consultation.text.6.3");
    await page.keyboard.press("Backspace");
    await expect(blank(page, "custom.line.consultation.text.6.3")).toHaveCount(0);
    expect(await caret()).toBe("custom.line.consultation.text.6.2");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Delete");
    await expect(blank(page, "custom.line.consultation.text.6.3")).toHaveCount(0);
    expect(await caret()).toBe("custom.line.consultation.text.6.2");
    // A line with words keeps them until they are rubbed out; a printed blank never goes.
    await page.keyboard.press("Backspace");
    await expect(blank(page, "custom.line.consultation.text.6.2")).toHaveText("Sâu răng 1");
    await page.keyboard.type("6");
    await blank(page, "consultation.text.5").click();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await expect(blank(page, "consultation.text.5")).toHaveCount(1);
    await expect(blanks).toHaveCount(before + 2);

    // In a table cell the line stays in the cell; the table gains no row.
    const costRows = document.locator('table[data-record-section="consultation-cost"] tbody > tr');
    const rowCount = await costRows.count();
    await blank(page, "consultation.text.22").click();
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("custom.line.consultation.text.22.1");
    await page.keyboard.type("Cạo vôi");
    await expect(costRows).toHaveCount(rowCount);
    await expect(
      document.locator("td", { has: blank(page, "consultation.text.22") }).locator('[data-medical-record-field="custom.line.consultation.text.22.1"]'),
    ).toHaveCount(1);

    // Under a right-aligned "Mã hồ sơ:", the added blank stacks right under the one above.
    await blank(page, "consultation.text.1").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    expect(await caret()).toBe("custom.line.consultation.text.1.1");
    const [code, stacked] = await Promise.all([
      blank(page, "consultation.text.1").boundingBox(),
      blank(page, "custom.line.consultation.text.1.1").boundingBox(),
    ]);
    expect(stacked?.x).toBeCloseTo(code?.x ?? -1, 0);
    expect(stacked?.width).toBeCloseTo(code?.width ?? -1, 0);
    expect(stacked?.y ?? 0).toBeGreaterThan(code?.y ?? 0);
    await save(page);

    await page.reload();
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(blank(page, "custom.line.consultation.text.6.1")).toHaveText("Viêm nướu");
    await expect(blank(page, "custom.line.consultation.text.6.2")).toHaveText("Sâu răng 16");
    await expect(blank(page, "custom.line.consultation.text.22.1")).toHaveText("Cạo vôi");
    await expect(blank(page, "custom.line.consultation.text.6.3")).toHaveCount(0);
    // In order, right under the blank they grew from.
    const order = await document
      .locator('[data-medical-record-field^="consultation.text.6"], [data-medical-record-field^="custom.line.consultation.text.6."]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-medical-record-field")));
    expect(order).toEqual([
      "consultation.text.6",
      "custom.line.consultation.text.6.1",
      "custom.line.consultation.text.6.2",
    ]);
  });

  /**
   * Copying what is written over several lines (clinic, 2026-11-09, R-1179):
   * every line is a blank of its own, and a selection used to stop at the
   * first one's edge. A drag across lines now takes them, and Ctrl+A in a
   * blank every line it flowed onto (R-1223: that blank only); the copy joins
   * the lines the width broke with a space and keeps the ones the writer broke. The next key or click gives the blanks back, and
   * what is written is untouched — all but Delete / Backspace, which erase the
   * selection (R-1221), and a letter typed over it (R-1223) — the test after
   * this one.
   */
  /**
   * Clinic, 2026-11-25: a blank after a label grew with what was typed in it to
   * the width of the whole line, and ran past the right margin by the label's
   * width — "1. Quá trình bệnh lý: aaaa…", "+ Bản thân: …thường0000…". A blank
   * takes at most the rest of its line; long writing wraps there, and once
   * saved goes on to lines of its own, never past the margin.
   */
  test("a blank written past its line stays inside the margin, typed and after a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    const ids = ["outpatient-dental.text.20", "outpatient.patient.history"];

    /** How far each blank's box and writing run past the edge of its line, at most. */
    const overrun = () =>
      sheet(page)
        .locator("body")
        .evaluate((body, fields) => {
          const doc = body.ownerDocument;
          const tpl = doc.querySelector<HTMLElement>(".nfc-tpl")!;
          const edge = tpl.getBoundingClientRect().right - parseFloat(getComputedStyle(tpl).paddingRight);
          return fields.map((id) => {
            const parts = [
              doc.querySelector(`[data-medical-record-field="${id}"]`)!,
              ...Array.from(doc.querySelectorAll(`[data-flow-of="${id}"]`)),
            ];
            return Math.max(
              ...parts.flatMap((part) => {
                const range = doc.createRange();
                range.selectNodeContents(part);
                return [part.getBoundingClientRect().right, ...Array.from(range.getClientRects()).map((box) => box.right)];
              }),
            ) - edge;
          });
        }, ids);

    await blank(page, ids[0]).click();
    await page.keyboard.type("a".repeat(170));
    await blank(page, ids[1]).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Chưa phát hiện gì bất thường" + "0".repeat(90));
    for (const over of await overrun()) expect(over, "typed: inside the margin").toBeLessThanOrEqual(1);

    await save(page);
    await page.reload();
    await openLastSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    for (const over of await overrun()) expect(over, "after a reload: inside the margin").toBeLessThanOrEqual(1);
  });

  test("a summary written over several lines can be selected and copied whole", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const summary =
      "Bệnh nhân nam 35t, đến khám do răng khôn hàm dưới mọc lệch, gây sưng đau, và mắc thức ăn. Bệnh nhân đã uống thuốc nhiều lần nhưng bị tái đi tái lại. Qua thăm khám hỏi bệnh thấy: R38 lệch gần 90 độ, chân răng xòe, sát ống thần kinh";
    const below = "Nướu nề nhẹ, không sưng, không có dịch, há ngậm miệng bình thường";
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt", {
      "outpatient-dental.text.37": summary,
      "outpatient-dental.text.38": below,
    });
    const document = sheet(page);
    const flowed = document.locator('[data-flow-of="outpatient-dental.text.37"]');
    expect(await flowed.count(), "the summary runs over lines of its own").toBeGreaterThanOrEqual(1);
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    const editable = (field: string) => blank(page, field).getAttribute("contenteditable");

    // A drag from the summary's first word to the end of the line under it.
    await blank(page, "outpatient-dental.text.37").scrollIntoViewIfNeeded();
    const from = await blank(page, "outpatient-dental.text.37").boundingBox();
    const to = await blank(page, "outpatient-dental.text.38").boundingBox();
    if (!from || !to) throw new Error("the blanks are not on screen");
    // The sheet must not move as the drag takes hold of it: blanks held still keep
    // the shape they had while editable, so the pointer stays on the line it was on.
    const sheetHeight = () => page.locator(".mr-doc-frame").first().evaluate((frame) => frame.getBoundingClientRect().height);
    const heightBefore = await sheetHeight();
    await page.mouse.move(from.x + 1, from.y + from.height / 2);
    await page.mouse.down();
    // Onto the line under it: since mẫu 2's lines are taller (R-1268) a few px
    // below the blank are still its own line, where the caret stays in it.
    const next = await flowed.first().boundingBox();
    if (!next) throw new Error("the summary's next line is not on screen");
    await page.mouse.move(from.x + from.width / 2, next.y + next.height / 2, { steps: 2 });
    expect(await editable("outpatient-dental.text.38"), "held once the drag leaves its blank").toBe("false");
    expect((await blank(page, "outpatient-dental.text.37").boundingBox())?.y, "the sheet stays where it was").toBe(from.y);
    expect(await sheetHeight()).toBe(heightBefore);
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 5 });
    await page.mouse.move(to.x + to.width - 2, to.y + to.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await editable("outpatient-dental.text.38"), "held still while the selection lasts").toBe("false");
    await page.keyboard.press("Control+c");
    expect(await clipboard()).toBe(`${summary}\n${below}`);

    // Any other key gives the blanks back, and is spent on that: nothing is written.
    await page.keyboard.press("ArrowRight");
    expect(await editable("outpatient-dental.text.38")).toBe("true");
    await expect(blank(page, "outpatient-dental.text.38")).toHaveText(below);

    // Ctrl+A on a line the summary flowed onto takes the summary, all its lines — not the blank under it (R-1223).
    await flowed.first().click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+c");
    expect(await clipboard()).toBe(summary);

    // A click writes again, where it lands.
    await blank(page, "outpatient-dental.text.38").click();
    expect(await editable("outpatient-dental.text.38")).toBe("true");
    await page.keyboard.press("End");
    await page.keyboard.type(".");
    // Ctrl+A in a blank with print after it on its line ("Sinh ngày __/") is that blank only.
    await blank(page, "outpatient.patient.birth-day").click();
    await page.keyboard.press("Control+a");
    expect(await editable("outpatient-dental.text.38"), "one blank needs no holding").toBe("true");
    await save(page);

    await page.reload();
    await openLastSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    await expect(blank(page, "outpatient-dental.text.38")).toHaveText(`${below}.`);
    const written = await document
      .locator('[data-medical-record-field="outpatient-dental.text.37"], [data-flow-of="outpatient-dental.text.37"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent).join(" "));
    expect(written).toBe(summary);
  });

  /**
   * Ctrl+A selects the blank the caret is in, and nothing else (owner,
   * 2026-11-13, R-1223 — it used to take the label's whole entry, lines under
   * it too). Delete / Backspace erase it (R-1221), and so does a letter typed
   * over it, which is then written in its place — it used to be spent on
   * giving the blanks back, so "dòng" came out "òng".
   */
  test("Ctrl+A selects only the blank it is pressed in; Delete, Backspace or typing replace it", async ({ page }) => {
    const specialty = "Viêm lợi mạn toàn hàm";
    const summary =
      "Bệnh nhân nam 35t, đến khám do răng khôn hàm dưới mọc lệch, gây sưng đau, và mắc thức ăn. Bệnh nhân đã uống thuốc nhiều lần nhưng bị tái đi tái lại. Qua thăm khám hỏi bệnh thấy: R38 lệch gần 90 độ, chân răng xòe, sát ống thần kinh";
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt", {
      "outpatient-dental.text.30": specialty,
      "outpatient-dental.text.31": "Sâu răng 36",
      "outpatient-dental.text.37": summary,
      "outpatient-dental.text.38": summary,
    });
    const document = sheet(page);
    const editable = (field: string) => blank(page, field).getAttribute("contenteditable");

    // The screenshot's case: Ctrl+A in "2. Bệnh chuyên khoa" takes that line only, and typing replaces it whole.
    await blank(page, "outpatient-dental.text.30").click();
    await page.keyboard.press("Control+a");
    expect(await editable("outpatient-dental.text.31"), "the line under it is not taken").toBe("true");
    await page.keyboard.type("dòng");
    await expect(blank(page, "outpatient-dental.text.30")).toHaveText("dòng");
    await expect(blank(page, "outpatient-dental.text.31")).toHaveText("Sâu răng 36");
    // Then Delete wipes it, and the caret stays to write on.
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect(blank(page, "outpatient-dental.text.30")).toHaveText("");
    await expect(document.getByText("2. Bệnh chuyên khoa:")).toBeVisible();
    await page.keyboard.type("Viêm nha chu");
    await expect(blank(page, "outpatient-dental.text.30")).toHaveText("Viêm nha chu");
    await expect(blank(page, "outpatient-dental.text.31")).toHaveText("Sâu răng 36");

    // A blank flowed over lines of its own is one blank: Ctrl+A takes all its lines, not the next blank's.
    const flowed37 = document.locator('[data-flow-of="outpatient-dental.text.37"]');
    const flowed38 = document.locator('[data-flow-of="outpatient-dental.text.38"]');
    expect(await flowed37.count()).toBeGreaterThanOrEqual(1);
    expect(await flowed38.count()).toBeGreaterThanOrEqual(1);
    await flowed37.first().click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await expect(blank(page, "outpatient-dental.text.37")).toHaveText("");
    await expect(flowed37).toHaveCount(0);
    const text38 = await document
      .locator('[data-medical-record-field="outpatient-dental.text.38"], [data-flow-of="outpatient-dental.text.38"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent).join(" "));
    expect(text38, "the blank under it is untouched").toBe(summary);
    await page.keyboard.type("Răng 38 mọc lệch");
    await expect(blank(page, "outpatient-dental.text.37")).toHaveText("Răng 38 mọc lệch");

    // Typed over a flowed blank's selection: the first letter is kept.
    await flowed38.first().click();
    await page.keyboard.press("Control+a");
    expect(await editable("outpatient-dental.text.38"), "held while it runs over lines").toBe("false");
    await page.keyboard.type("Nướu nề nhẹ");
    await expect(blank(page, "outpatient-dental.text.38")).toHaveText("Nướu nề nhẹ");
    await expect(flowed38).toHaveCount(0);
    expect(await editable("outpatient-dental.text.38")).toBe("true");

    await save(page);
    await page.reload();
    await openLastSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    await expect(blank(page, "outpatient-dental.text.30")).toHaveText("Viêm nha chu");
    await expect(blank(page, "outpatient-dental.text.31")).toHaveText("Sâu răng 36");
    await expect(blank(page, "outpatient-dental.text.37")).toHaveText("Răng 38 mọc lệch");
    await expect(blank(page, "outpatient-dental.text.38")).toHaveText("Nướu nề nhẹ");
  });

  /**
   * Pasting several lines (clinic, 2026-11-21, R-1263: "copy đc nhiều dòng rồi
   * nhưng paste lại vào hết 1 ô"): each line goes on a line of its own. An empty
   * line for writing under the blank takes the next one; a line with writing,
   * or one the form labels, gets a line added before it and moves down. What
   * stood after the caret ends the last line pasted. Only the text is pasted.
   */
  test("lines pasted go on lines of their own, pushing down what is written and never into the next label", async ({
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const form = "Bệnh án ngoại trú Răng Hàm Mặt";
    await openMedicalRecord(page);
    await openFreshSheet(page, form, {
      "outpatient-dental.text.43": "K02.1 - Sâu ngà",
      "outpatient-dental.text.44": "Sâu răng 36 cần điều trị tủy",
      "outpatient-dental.text.47": "Đã trám tạm",
    });
    const document = sheet(page);
    const blanks = document.locator("[data-medical-record-field]");
    const before = await blanks.count();
    const pasteInto = async (field: string, text: string, html?: string) => {
      await copyText(page, text, html);
      await blank(page, field).click();
      await page.keyboard.press("Control+v");
    };
    const line = (anchor: string, at: number) => blank(page, `custom.line.outpatient-dental.text.${anchor}.${at}`);

    // Empty lines under the blank take the lines, one each; nothing is added.
    await pasteInto("outpatient-dental.text.31", "Viêm lợi\nSâu răng 16\nMòn cổ răng");
    await expect(blank(page, "outpatient-dental.text.31")).toHaveText("Viêm lợi");
    await expect(blank(page, "outpatient-dental.text.32")).toHaveText("Sâu răng 16");
    await expect(blank(page, "outpatient-dental.text.33")).toHaveText("Mòn cổ răng");
    await expect(blank(page, "outpatient-dental.text.34")).toHaveText("");
    await expect(blanks).toHaveCount(before);

    // One line pastes where the caret is, as ever.
    await copyText(page, "; R26");
    await blank(page, "outpatient-dental.text.32").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Control+v");
    await expect(blank(page, "outpatient-dental.text.32")).toHaveText("Sâu răng 16; R26");
    await expect(blanks).toHaveCount(before);

    // More lines than "4. Tóm tắt bệnh án" has: lines are added under its last, "5. Chẩn đoán" keeps its own.
    await pasteInto("outpatient-dental.text.37", "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8");
    for (const [at, text] of [37, 38, 39, 40, 41, 42].map((field, index) => [field, `L${index + 1}`] as const)) {
      await expect(blank(page, `outpatient-dental.text.${at}`)).toHaveText(text);
    }
    await expect(line("42", 1)).toHaveText("L7");
    await expect(line("42", 2)).toHaveText("L8");
    await expect(blank(page, "outpatient-dental.text.43")).toHaveText("K02.1 - Sâu ngà");
    await expect(blanks).toHaveCount(before + 2);

    // Pasted in the middle of what is written: the rest goes on after the last line, where the caret is left.
    await blank(page, "outpatient-dental.text.44").click();
    await page.keyboard.press("Home");
    for (let step = 0; step < "Sâu răng 36".length; step += 1) await page.keyboard.press("ArrowRight");
    await copyText(page, ", 37\nRăng 38 cũng");
    await page.keyboard.press("Control+v");
    await page.keyboard.type(" vẫn");
    await expect(blank(page, "outpatient-dental.text.44")).toHaveText("Sâu răng 36, 37");
    await expect(line("44", 1)).toHaveText("Răng 38 cũng vẫn cần điều trị tủy");
    await expect(blank(page, "outpatient-dental.text.45"), "the next label's blank stays empty").toHaveText("");
    await expect(blanks).toHaveCount(before + 3);

    // A line with writing under the blank moves down: lines are added before it, in order.
    await pasteInto("outpatient-dental.text.46", "Lấy tủy R36\nBơm rửa\nĐặt thuốc");
    await expect(blank(page, "outpatient-dental.text.46")).toHaveText("Lấy tủy R36");
    await expect(line("46", 1)).toHaveText("Bơm rửa");
    await expect(line("46", 2)).toHaveText("Đặt thuốc");
    await expect(blank(page, "outpatient-dental.text.47")).toHaveText("Đã trám tạm");
    await expect(blanks).toHaveCount(before + 5);

    // Copied off a page with its formatting: only the text comes, on its lines.
    await pasteInto("outpatient-dental.text.49", "Răng 11\nRăng 21", "<b>Răng 11</b><br><i style=\"color:red\">Răng 21</i>");
    await expect(blank(page, "outpatient-dental.text.49")).toHaveText("Răng 11");
    await expect(blank(page, "outpatient-dental.text.50")).toHaveText("Răng 21");
    await expect(document.locator('[data-medical-record-field^="outpatient-dental.text.49"] *, [data-medical-record-field^="outpatient-dental.text.50"] *')).toHaveCount(0);

    // A line too long for its blank flows over lines of its own; the next pasted line goes under them.
    await pasteInto("outpatient-dental.text.51", `${LONG_DIAGNOSIS}\nTái khám sau 1 tuần`);
    expect(await document.locator('[data-flow-of="outpatient-dental.text.51"]').count()).toBeGreaterThanOrEqual(1);
    expect(await flowedValue(page, "outpatient-dental.text.51")).toBe(LONG_DIAGNOSIS);
    await expect(blank(page, "outpatient-dental.text.52")).toHaveText("Tái khám sau 1 tuần");

    // A blank sharing its line with print ("Huyết áp __/__ mmHg"): the next line is added, "Nhịp thở" is not filled.
    await pasteInto("outpatient-dental.text.26", "120\n80");
    await expect(blank(page, "outpatient-dental.text.26")).toHaveText("120");
    await expect(line("26", 1)).toHaveText("80");
    await expect(blank(page, "outpatient-dental.text.27")).toHaveText("");
    await expect(blank(page, "outpatient-dental.text.28")).toHaveText("");
    await expect(blanks).toHaveCount(before + 6);
    await save(page);

    await page.reload();
    await openLastSheet(page, form);
    await expect(blank(page, "outpatient-dental.text.33")).toHaveText("Mòn cổ răng");
    await expect(blank(page, "outpatient-dental.text.32")).toHaveText("Sâu răng 16; R26");
    await expect(line("42", 2)).toHaveText("L8");
    await expect(line("44", 1)).toHaveText("Răng 38 cũng vẫn cần điều trị tủy");
    await expect(blank(page, "outpatient-dental.text.52")).toHaveText("Tái khám sau 1 tuần");
    await expect(line("26", 1)).toHaveText("80");
    const order = (
      await document
        .locator("[data-medical-record-field]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-medical-record-field") ?? ""))
    ).filter((id) => /outpatient-dental\.text\.4\d(\.\d+)?$/.test(id));
    expect(order).toEqual([
      "outpatient-dental.text.40",
      "outpatient-dental.text.41",
      "outpatient-dental.text.42",
      "custom.line.outpatient-dental.text.42.1",
      "custom.line.outpatient-dental.text.42.2",
      "outpatient-dental.text.43",
      "outpatient-dental.text.44",
      "custom.line.outpatient-dental.text.44.1",
      "outpatient-dental.text.45",
      "outpatient-dental.text.46",
      "custom.line.outpatient-dental.text.46.1",
      "custom.line.outpatient-dental.text.46.2",
      "outpatient-dental.text.47",
      "outpatient-dental.text.48",
      "outpatient-dental.text.49",
    ]);
  });

  /** A paste in a table cell keeps to the cell, as Enter does; Excel's and Word's line ends and tabs read as text. */
  test("lines pasted in a table cell stay in the cell, whatever they were copied from", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const form = "Phiếu tư vấn và xác nhận đồng ý điều trị";
    await openMedicalRecord(page);
    await openFreshSheet(page, form);
    const document = sheet(page);
    const costRows = document.locator('table[data-record-section="consultation-cost"] tbody > tr');
    const rowCount = await costRows.count();

    // Copied off a spreadsheet: cells split by a tab, rows ended by CR LF, the last one too.
    await copyText(page, "Cạo vôi\tx1\r\nĐánh bóng\r\n");
    // The cell may already hold the record's own service: the paste goes on after it.
    const own = (await blank(page, "consultation.text.22").textContent()) ?? "";
    await blank(page, "consultation.text.22").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Control+v");
    await expect(blank(page, "consultation.text.22")).toHaveText(`${own}Cạo vôi x1`);
    const added = blank(page, "custom.line.consultation.text.22.1");
    await expect(added).toHaveText("Đánh bóng");
    await expect(blank(page, "custom.line.consultation.text.22.2"), "no empty line for the last line end").toHaveCount(0);
    await expect(costRows).toHaveCount(rowCount);
    await expect(document.locator("td", { has: blank(page, "consultation.text.22") }).locator('[data-medical-record-field="custom.line.consultation.text.22.1"]')).toHaveCount(1);
    await save(page);

    await page.reload();
    await openLastSheet(page, form);
    await expect(blank(page, "consultation.text.22")).toHaveText(`${own}Cạo vôi x1`);
    await expect(blank(page, "custom.line.consultation.text.22.1")).toHaveText("Đánh bóng");
  });

  /**
   * Ctrl+Z / Ctrl+Y take back and redo what the sheet writes itself (R-1263): a
   * paste over lines, an erase across lines, a line Enter adds or Backspace
   * takes away — each one step. What is typed after is the browser's to undo
   * first.
   */
  test("Ctrl+Z takes back a paste over lines, an erase and an added line; Ctrl+Y does them again", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const form = "Bệnh án ngoại trú Răng Hàm Mặt";
    await openMedicalRecord(page);
    await openFreshSheet(page, form, {
      "outpatient-dental.text.40": "Đã có sẵn",
      "outpatient-dental.text.44": LONG_DIAGNOSIS,
    });
    const document = sheet(page);
    const blanks = document.locator("[data-medical-record-field]");
    const before = await blanks.count();
    const text = (field: string) => blank(page, `outpatient-dental.text.${field}`);
    const added = blank(page, "custom.line.outpatient-dental.text.39.1");
    const pasted = async () => {
      await expect(text("37")).toHaveText("U1");
      await expect(text("38")).toHaveText("U2");
      await expect(text("39")).toHaveText("U3");
      await expect(added).toHaveText("U4");
      await expect(text("40")).toHaveText("Đã có sẵn");
      await expect(blanks).toHaveCount(before + 1);
    };
    const undone = async () => {
      await expect(text("37")).toHaveText("");
      await expect(text("38")).toHaveText("");
      await expect(text("39")).toHaveText("");
      await expect(added).toHaveCount(0);
      await expect(text("40")).toHaveText("Đã có sẵn");
      await expect(blanks).toHaveCount(before);
    };

    await copyText(page, "U1\nU2\nU3\nU4");
    await text("37").click();
    await page.keyboard.press("Control+v");
    await pasted();
    // The whole paste is one step, both ways, by either key for redo.
    await page.keyboard.press("Control+z");
    await undone();
    await page.keyboard.press("Control+y");
    await pasted();
    await page.keyboard.press("Control+z");
    await undone();
    await page.keyboard.press("Control+Shift+z");
    await pasted();

    // Typed after the paste: Ctrl+Z takes back the typing first, then the paste.
    await page.keyboard.type("!");
    await expect(added).toHaveText("U4!");
    await page.keyboard.press("Control+z");
    await expect(added).toHaveText("U4");
    await page.keyboard.press("Control+z");
    await undone();
    // Something written after an undo: there is nothing to redo.
    await page.keyboard.type("q");
    await page.keyboard.press("Control+y");
    await expect(text("37")).toHaveText("q");
    await expect(text("38")).toHaveText("");
    await expect(added).toHaveCount(0);
    await page.keyboard.press("Backspace");

    // A line Enter adds goes again with Ctrl+Z; one Backspace took away comes back. Nothing is under "3." to step to.
    await text("36").click();
    await page.keyboard.press("Enter");
    const enterLine = blank(page, "custom.line.outpatient-dental.text.36.1");
    await expect(enterLine).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(enterLine).toHaveCount(0);
    await page.keyboard.press("Control+y");
    await expect(enterLine).toHaveCount(1);
    await enterLine.click();
    await page.keyboard.press("Backspace");
    await expect(enterLine).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(enterLine).toHaveCount(1);
    await page.keyboard.type("Thêm dòng");
    await expect(enterLine).toHaveText("Thêm dòng");

    // Erasing a selection across a long blank's lines comes back whole.
    const flowed = document.locator('[data-flow-of="outpatient-dental.text.44"]');
    expect(await flowed.count()).toBeGreaterThanOrEqual(1);
    await flowed.first().click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect(text("44")).toHaveText("");
    await expect(flowed).toHaveCount(0);
    await page.keyboard.press("Control+z");
    expect(await flowedValue(page, "outpatient-dental.text.44")).toBe(LONG_DIAGNOSIS);
    expect(await flowed.count()).toBeGreaterThanOrEqual(1);

    // Pasted over that selection: it is replaced, and one Ctrl+Z gives it back.
    await copyText(page, "V1\nV2");
    await flowed.first().click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+v");
    await expect(text("44")).toHaveText("V1");
    await expect(blank(page, "custom.line.outpatient-dental.text.44.1")).toHaveText("V2");
    await expect(flowed).toHaveCount(0);
    await page.keyboard.press("Control+z");
    expect(await flowedValue(page, "outpatient-dental.text.44")).toBe(LONG_DIAGNOSIS);
    await expect(blank(page, "custom.line.outpatient-dental.text.44.1")).toHaveCount(0);
    await save(page);

    await page.reload();
    await openLastSheet(page, form);
    await expect(text("37")).toHaveText("");
    await expect(blank(page, "custom.line.outpatient-dental.text.39.1")).toHaveCount(0);
    await expect(blank(page, "custom.line.outpatient-dental.text.36.1")).toHaveText("Thêm dòng");
    expect(await flowedValue(page, "outpatient-dental.text.44")).toBe(LONG_DIAGNOSIS);
    await expect(blank(page, "custom.line.outpatient-dental.text.44.1")).toHaveCount(0);
  });

  /**
   * The other eight forms take mẫu 5's style (clinic, 2026-10-16): taken in
   * like it, each at the largest type whose every page fits its sheet of A4 —
   * so each prints exactly the pages it is drawn with, through the app's own
   * print path — the paper's 12px boxes, a bold letterhead, and blanks in a
   * grid cell printed without the dotted line while those outside keep it.
   * Enter is checked on mẫu 5; it is the same code on every form.
   */
  test("every form shares mẫu 5's type, boxes, letterhead and print rules", async ({ page }) => {
    test.slow();
    await openMedicalRecord(page);

    const expected: Array<[string, string, string, number]> = [
      ["Bìa hồ sơ bệnh án", "17.333px", "PHÒNG KHÁM CHUYÊN KHOA RĂNG HÀM MẶT", 3],
      ["Bệnh án ngoại trú Răng Hàm Mặt", "16px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 5],
      ["Bệnh án chỉnh nha", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 4],
      ["Phiếu Tư Vấn Tổng Quát", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 1],
      ["Phiếu tư vấn và xác nhận đồng ý điều trị", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 2],
      ["Giấy đồng ý thực hiện phẫu thuật/thủ thuật", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 2],
      ["Phiếu phẫu thuật/thủ thuật", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 1],
      ["Phiếu theo dõi điều trị", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 1],
      ["Phiếu chăm sóc", "17.333px", "Phòng khám Chuyên khoa Răng Hàm Mặt", 1],
    ];
    for (const [form, size, letterhead, pages] of expected) {
      // Blank, so what other tests wrote on the sheet does not add lines.
      await openFreshSheet(page, form);
      const document = sheet(page);
      const tpl = document.locator(".nfc-tpl");
      expect(await tpl.evaluate((node) => getComputedStyle(node).fontSize), `${form} · type`).toBe(size);

      // Mẫu 1's first box is the cover's Nam, drawn as HC-01's 18px ⬜ (R-1316); its page 3 keeps 12px.
      const box = document.locator(".nfc-medical-record-checkbox").first();
      if ((await box.count()) > 0) {
        expect((await box.boundingBox())?.width, `${form} · box`).toBeCloseTo(FORM_NUMBER[form] === 1 ? 18 : 12, 0);
      }
      if (FORM_NUMBER[form] === 1) {
        expect((await document.locator('[data-medical-record-field="cover.checkbox.1"]').boundingBox())?.width, `${form} · page 3 box`).toBeCloseTo(12, 0);
      }

      const weight = await document
        .getByText(letterhead, { exact: false })
        .first()
        .evaluate((node) => Number(getComputedStyle(node).fontWeight));
      expect(weight, `${form} · letterhead`).toBeGreaterThanOrEqual(700);

      await page.emulateMedia({ media: "print" });
      const lines = await tpl.evaluate((root) => {
        const style = (node: Element | null) => (node ? getComputedStyle(node).borderBottomStyle : null);
        return {
          // Mẫu 2's vitals box and files table keep their dots, as its Word copy (R-1270),
          // and so do the blanks in the box on mẫu 1's cover (R-1271).
          inGrid: style(
            root.querySelector(
              '[data-grid-cell] .nfc-medical-record-text-field:not(:is(table[data-record-section="vitals"], table[data-record-section="summary-files"], table[data-cover]) *)',
            ),
          ),
          // …and its dots, drawn by ::after (R-1284), are clear too (but see mẫu 7, 8, 9 below).
          gridDots: (() => {
            const blank = root.querySelector(
              '[data-grid-cell]:not(:last-child) .nfc-medical-record-text-field:not(:is(table[data-record-section="vitals"], table[data-record-section="summary-files"], table[data-cover], table[data-record-section="surgical-count"]) *)',
            );
            return blank ? getComputedStyle(blank, "::after").opacity : null;
          })(),
          // MS is print, not a blank (R-1069): it has no line at all.
          outside: style(
            Array.from(root.querySelectorAll(".nfc-medical-record-text-field:not([data-form-code])")).find(
              (node) => !node.closest("[data-grid-cell]") && !node.closest("[data-cover]"),
            ) ?? null,
          ),
        };
      });
      await page.emulateMedia({ media: "screen" });
      // Mẫu 7, 8 and 9 print the dots their Word copies have in every table blank (R-1286).
      const dottedTables = [7, 8, 9].includes(FORM_NUMBER[form]);
      if (lines.inGrid !== null) expect(lines.inGrid, `${form} · grid blank on paper`).toBe(dottedTables ? "dotted" : "none");
      if (lines.gridDots !== null) expect(lines.gridDots, `${form} · grid blank's dots on paper`).toBe(dottedTables ? "1" : "0");
      if (lines.outside !== null) expect(lines.outside, `${form} · other blank on paper`).toBe("dotted");

      // Every page fits its sheet of A4: the print job has exactly the pages the form is drawn with.
      // "In biểu mẫu" copies the sheet into the page and opens the print dialog; the dialog is
      // skipped (again for each form — opening a fresh sheet reloads the page).
      await page.evaluate(() => {
        window.print = () => undefined;
      });
      await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
      await page.waitForTimeout(800);
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      const printed = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      // Phiếu theo dõi điều trị carries the set's treatment log (P1810), so a
      // patient with a long history runs onto more pages than the blank form.
      if (form === "Phiếu theo dõi điều trị") expect(printed, `${form} · printed pages`).toBeGreaterThanOrEqual(pages);
      else expect(printed, `${form} · printed pages`).toBe(pages);
    }
  });

  /**
   * Mẫu 2 inside 15mm margins (clinic, 2026-10-28, R-1067): 15mm on every edge
   * of the sheet and of every printed page; the letterhead on the left margin;
   * MS / Số ngoại trú / Số lưu trữ a column of labels and a column of blanks
   * against the right margin; each vital sign on one line, its unit against the
   * cell's right edge. The blanks at the clinic's widths (R-1073): Địa chỉ,
   * Tiền sử bệnh, Gia đình run to the right margin on the line they start on,
   * and the lines a long Chẩn đoán goes on to reach it too.
   */
  test("mẫu 2: 15mm margins, the MS block and the vital signs lined up", async ({ page }) => {
    const margin = (15 / 25.4) * 96;
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt", {
      "outpatient-dental.text.43": LONG_DIAGNOSIS,
      "outpatient-dental.text.26": "120",
      "outpatient-dental.text.27": "120",
      "outpatient-dental.text.1": "NT-000000751116",
      "outpatient-dental.text.2": "NK-1126DH269999DT01",
    });

    const layout = await sheet(page)
      .locator(".nfc-tpl")
      .evaluate((root) => {
        const style = getComputedStyle(root);
        const box = root.getBoundingClientRect();
        const left = box.left + parseFloat(style.paddingLeft);
        const right = box.right - parseFloat(style.paddingRight);
        const rect = (node: Node) => {
          const range = root.ownerDocument.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        };
        const ids = root.querySelector(".record-ids");
        const vitals = Array.from(root.querySelectorAll('table[data-record-section="vitals"] td > p'));
        const cell = vitals[0]?.closest("td");
        return {
          padding: ["Top", "Right", "Bottom", "Left"].map((edge) => parseFloat(style.getPropertyValue(`padding-${edge.toLowerCase()}`))),
          letterhead: rect(root.querySelector('table[data-record-section="layout"] td p')!).left - left,
          labels: Array.from(ids?.querySelectorAll(".record-ids-label") ?? []).map((node) => node.getBoundingClientRect().left),
          blanks: Array.from(ids?.querySelectorAll(".nfc-medical-record-text-field") ?? []).map((node) => node.getBoundingClientRect().left),
          idsRight: right - (ids?.getBoundingClientRect().right ?? 0),
          // Số ngoại trú / Số lưu trữ boxes to the right margin, a long number on one line (BA, 2026-11-25, R-1321).
          idBoxes: ["outpatient-dental.text.1", "outpatient-dental.text.2"].map((id) => {
            const node = root.querySelector(`[data-medical-record-field="${id}"]`)!;
            return {
              right: right - node.getBoundingClientRect().right,
              lines: node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight),
              room: node.getBoundingClientRect().width - rect(node).width,
            };
          }),
          vitalLines: vitals.map((node) => node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)),
          unitsRight: vitals.map((node) => (cell ? cell.getBoundingClientRect().right - parseFloat(getComputedStyle(cell).paddingRight) - rect(node.lastChild!).right : NaN)),
          reaching: ["outpatient.patient.address", "outpatient.patient.history", "outpatient-dental.text.23"].map((id) => {
            const node = root.querySelector(`[data-medical-record-field="${id}"]`)!;
            return { right: right - node.getBoundingClientRect().right, lines: node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight) };
          }),
          flowed: Array.from(root.querySelectorAll('[data-flow-of="outpatient-dental.text.43"]')).map((node) => right - node.getBoundingClientRect().right),
          // Line 13 ends in "2. Tự đến ☐": the box, margin and all, on the line (2026-11-10).
          referralLines: (() => {
            const line = root.querySelector('[data-medical-record-field="outpatient-dental.checkbox.6"]')!.closest("p")!;
            return line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight);
          })(),
          // "9. Đối tượng" with all four boxes on its line, and the title two 16pt lines (BA docx, 2026-11-21).
          // "+ Bản thân:" and its blank on one line, as "+ Gia đình:" (BA, 2026-11-22, R-1270).
          historyLines: (() => {
            const line = root.querySelector('[data-medical-record-field="outpatient.patient.history"]')!.closest("p")!;
            return line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight);
          })(),
          subjectLines: (() => {
            const line = root.querySelector('[data-medical-record-field="outpatient-dental.checkbox.4"]')!.closest("p")!;
            return line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight);
          })(),
          titles: Array.from(root.querySelectorAll('table[data-record-page="outpatient-main"] h1')).map((node) => getComputedStyle(node).fontSize),
          // The MS block 10pt, and a page begun where the BA's Word copy begins one (R-1269).
          idsSize: ids ? getComputedStyle(ids).fontSize : "",
          pagesBegin: Array.from(root.querySelectorAll(":scope > hr")).map((hr) => hr.nextElementSibling?.querySelector("h1, h2")?.textContent?.trim() ?? ""),
          // Huyết áp holds three digits a side, "120/120", on its line (BA, 2026-11-23, R-1304).
          pressureLines: ["outpatient-dental.text.26", "outpatient-dental.text.27"].map((id) => {
            const node = root.querySelector(`[data-medical-record-field="${id}"]`)!;
            return node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight);
          }),
          // Toàn thân's boxes in a column each, on Word's right tab (BA, 2026-11-23, R-1304).
          boxColumns: Array.from(root.querySelectorAll('table[data-record-section="general-exam"] > tbody > tr > td'))
            .slice(0, 2)
            .map((td) => Array.from(td.querySelectorAll("input")).map((box) => box.getBoundingClientRect().right)),
        };
      });

    for (const edge of layout.padding) expect(edge, "sheet margin").toBeCloseTo(margin, 1);
    expect(Math.abs(layout.letterhead), "letterhead on the left margin").toBeLessThan(1);
    expect(layout.labels, "MS labels").toHaveLength(3);
    for (const at of layout.labels) expect(at, "labels in one column").toBeCloseTo(layout.labels[0], 0);
    for (const at of layout.blanks) expect(at, "blanks in one column").toBeCloseTo(layout.blanks[0], 0);
    expect(Math.abs(layout.idsRight), "MS block on the right margin").toBeLessThan(1);
    for (const { right, lines } of layout.idBoxes) {
      expect(Math.abs(right), "Số ngoại trú / Số lưu trữ box to the right margin").toBeLessThan(1);
      expect(lines, "its number on one line").toBeLessThan(1.6);
    }
    // As wide as the longer number, Số lưu trữ, and one character more (½em in Times) — no wider.
    expect(layout.idBoxes[1].room, "Số lưu trữ box one character to spare").toBeGreaterThan(6);
    expect(layout.idBoxes[1].room, "Số lưu trữ box no wider").toBeLessThan(15);
    expect(layout.vitalLines, "vital signs").toHaveLength(5);
    for (const lines of layout.vitalLines) expect(lines, "one line each").toBeLessThan(1.6);
    for (const gap of layout.unitsRight) expect(Math.abs(gap), "units against the cell's edge").toBeLessThan(1);
    for (const { right, lines } of layout.reaching) {
      expect(lines, "the blank stays on its line").toBeLessThan(1.6);
      expect(Math.abs(right), "the blank runs to the right margin").toBeLessThan(2);
    }
    expect(layout.flowed.length, "Chẩn đoán goes on to lines of its own").toBeGreaterThanOrEqual(1);
    for (const right of layout.flowed) expect(Math.abs(right), "a line of its own reaches the right margin").toBeLessThan(1);
    expect(layout.referralLines, "line 13 with its Tự đến box on one line").toBeLessThan(1.6);
    expect(layout.subjectLines, "9. Đối tượng with its four boxes on one line").toBeLessThan(1.6);
    expect(layout.historyLines, "+ Bản thân: and its blank on one line").toBeLessThan(1.6);
    for (const lines of layout.pressureLines) expect(lines, "120 on one line in each Huyết áp blank").toBeLessThan(1.6);
    expect(layout.boxColumns.map((column) => column.length), "Toàn thân, five boxes a column").toEqual([5, 5]);
    for (const column of layout.boxColumns) for (const right of column) expect(right, "boxes lined up").toBeCloseTo(column[0], 0);
    expect(layout.titles, "the title, two 16pt lines").toEqual(["21.333px", "21.333px"]);
    expect(layout.idsSize, "MS / Số ngoại trú / Số lưu trữ at 10pt").toBe("13.333px");
    expect(layout.pagesBegin, "pages begin at IV. and at the summary").toEqual(["IV. KHÁM BỆNH:", "TỔNG KẾT BỆNH ÁN:"]);

    // On paper the margin is the page's, on every page: a page of its own — 15mm, 7mm at the foot since
    // 2026-11-12 (`@page outpatient-dental`) — and no padding on the sheet.
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    const copy = page.locator(".mr-print-copy .nfc-tpl");
    await expect(copy).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const printed = await copy.evaluate((node) => {
      const style = getComputedStyle(node);
      return { page: style.getPropertyValue("page"), padding: style.paddingTop };
    });
    // The vitals box and the files table keep their dots on paper, as in Word: "Mạch ......lần/ph",
    // "Số tờ ......"; Người nhận's "Họ tên ......" on one line (BA, 2026-11-22, R-1270).
    const boxes = await copy.evaluate((node) => {
      const fields = (section: string) =>
        Array.from(node.querySelectorAll(`table[data-record-section="${section}"] .nfc-medical-record-text-field`));
      const receiver = node.querySelector('[data-medical-record-field="outpatient-dental.text.107"]')!;
      const line = receiver.closest("p")!;
      return {
        vitals: fields("vitals").map((field) => getComputedStyle(field).borderBottomStyle),
        files: fields("summary-files").map((field) => getComputedStyle(field).borderBottomStyle),
        receiverLines: line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight),
        // The code boxes' rows on "Bệnh chính" and "Bệnh kèm theo", as in Word — not two 17px rows (R-1270).
        codeRows: (() => {
          const rows = Array.from(node.querySelectorAll('table[data-record-section="diagnosis-code"] tr'));
          return ["outpatient-dental.text.80", "outpatient-dental.text.81"].map((id, at) => {
            const text = node.querySelector(`[data-medical-record-field="${id}"]`)!.closest("p")!.getBoundingClientRect();
            const row = rows[at].getBoundingClientRect();
            return { top: row.top - text.top, height: row.height - text.height };
          });
        })(),
        codeWidth: node.querySelector('table[data-record-section="diagnosis-code"]')!.getBoundingClientRect().width,
        // Dots as Word prints them — full stops on the line, drawn by ::after over a clear
        // border (R-1284; finer border dots at R-1270); none on a blank written in.
        dots: ["outpatient-dental.text.25", "outpatient-dental.text.43"].map((id) => {
          const field = node.querySelector(`[data-medical-record-field="${id}"]`)!;
          const after = getComputedStyle(field, "::after");
          return {
            border: getComputedStyle(field).borderBottomColor,
            shown: after.display,
            stops: /^"\.{100,}"$/.test(after.content),
            opacity: after.opacity,
            top: after.top,
          };
        }),
      };
    });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(printed).toEqual({ page: "outpatient-dental", padding: "0px" });
    expect(boxes.vitals, "Mạch, Nhiệt độ, Huyết áp ×2, Nhịp thở, Cân nặng").toHaveLength(6);
    expect(new Set(boxes.vitals), "the vitals keep their dots").toEqual(new Set(["dotted"]));
    expect(boxes.files.length, "the files table's blanks").toBeGreaterThanOrEqual(10);
    expect(new Set(boxes.files), "the files table keeps its dots").toEqual(new Set(["dotted"]));
    // "Người nhận hồ sơ:", three empty lines to sign on (clinic, 2026-11-25), then
    // "Họ tên ......" on one line, not wrapped on to another.
    expect(boxes.receiverLines, "Người nhận hồ sơ, room to sign, then Họ tên on one line").toBeGreaterThan(4.4);
    expect(boxes.receiverLines, "Người nhận hồ sơ, room to sign, then Họ tên on one line").toBeLessThan(5.6);
    for (const { top, height } of boxes.codeRows) {
      expect(Math.abs(top), "a code row on its line").toBeLessThan(1.5);
      expect(Math.abs(height), "a code row a line tall").toBeLessThan(1.5);
    }
    expect(boxes.codeWidth, "the code boxes as wide as Word's, 1740 twips").toBeCloseTo(116, 0);
    // BA, 2026-11-22: "dấu chấm này chỉnh nhỏ hơn"; "nếu như có data bỏ hết dấu ... đi".
    const [empty, written] = boxes.dots;
    // Owner, 2026-11-23: "chỗ trống là dấu chấm chứ đâu phải line ngang".
    expect(empty, "an empty blank: Word's full stops on its own line").toEqual({
      border: "rgba(0, 0, 0, 0)",
      shown: "block",
      stops: true,
      opacity: "1",
      top: "0px",
    });
    expect(written.shown, "a blank written in: no dots").toBe("none");
  });

  /**
   * Mẫu 6 as the clinic's own copy (2026-10-29, R-1068): 15mm on every edge of
   * the sheet and of every printed page; the boxes that open a line on the left
   * margin; the blanks after "Tôi tên là", "Chức danh", "Chẩn đoán" running to the
   * right margin, on the line they start on. Type and spacing as the BA's Word copy
   * (R-1275, R-1293): Word's 1.3 lines (1.495), the letterhead at 11pt where Word sets it
   * (its widest line 3.3px past the margin, as Word prints it); MS against the right margin (BA, 2026-11-25, R-1321 —
   * before that where Word's tab put it, 463px in, R-1293).
   */
  test("mẫu 6: 15mm margins, the letterhead, MS and the boxes on the margins", async ({ page }) => {
    const margin = (15 / 25.4) * 96;
    await openMedicalRecord(page);
    await openFreshSheet(page, "Giấy đồng ý thực hiện phẫu thuật/thủ thuật");

    const layout = await sheet(page)
      .locator(".nfc-tpl")
      .evaluate((root) => {
        const style = getComputedStyle(root);
        const box = root.getBoundingClientRect();
        const left = box.left + parseFloat(style.paddingLeft);
        const right = box.right - parseFloat(style.paddingRight);
        const rect = (node: Node) => {
          const range = root.ownerDocument.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        };
        const header = root.querySelector(":scope > table:first-child");
        const letterhead = header?.querySelector("td:first-child > p");
        const ms = header?.querySelector("td:last-child > p");
        const opening = Array.from(root.querySelectorAll(".nfc-medical-record-checkbox")).filter(
          (node) => !node.previousSibling?.textContent?.trim() && !node.closest("td:not(:first-child)"),
        );
        const blank = (id: string) => root.querySelector(`[data-medical-record-field="surgery-consent.${id}"]`)!;
        const reaching = ["text.1", "text.2", "text.4"].map((id) => {
          const node = blank(id);
          return { right: right - node.getBoundingClientRect().right, lines: node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight) };
        });
        return {
          padding: ["Top", "Right", "Bottom", "Left"].map((edge) => parseFloat(style.getPropertyValue(`padding-${edge.toLowerCase()}`))),
          lineHeight: parseFloat(getComputedStyle(blank("text.1").closest("p")!).lineHeight) / parseFloat(style.fontSize),
          letterheadSize: parseFloat(getComputedStyle(letterhead!.querySelector("span")!).fontSize),
          letterhead: rect(letterhead!).left - left,
          ms: right - rect(ms!).right,
          boxes: opening.map((node) => node.getBoundingClientRect().left - left),
          reaching,
        };
      });

    for (const edge of layout.padding) expect(edge, "sheet margin").toBeCloseTo(margin, 1);
    expect(layout.lineHeight, "Word's 1.3 lines").toBeCloseTo(1.495, 2);
    expect(layout.letterheadSize, "letterhead at 11pt").toBeCloseTo((11 * 4) / 3, 2);
    expect(Math.abs(layout.letterhead + 3.6), "letterhead where Word sets it").toBeLessThan(1);
    expect(Math.abs(layout.ms), "MS against the right margin").toBeLessThan(1);
    // Chẩn đoán … Kết quả, the first column of the two lists, Không, 1. and 2.
    expect(layout.boxes.length, "boxes opening a line").toBeGreaterThanOrEqual(14);
    for (const gap of layout.boxes) expect(Math.abs(gap), "box on the left margin").toBeLessThan(1);
    for (const { right, lines } of layout.reaching) {
      expect(lines, "the blank stays on its line").toBeLessThan(1.6);
      // 6px into the margin, as Word's -91 twips indent (R-1293).
      expect(right, "the blank runs to the right margin").toBeGreaterThanOrEqual(-7);
      expect(right, "the blank runs to the right margin").toBeLessThan(18);
    }

    // On paper the margin is the page's, on every page: a page of its own, and no padding on the sheet.
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    const copy = page.locator(".mr-print-copy .nfc-tpl");
    await expect(copy).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const printed = await copy.evaluate((node) => {
      const style = getComputedStyle(node);
      return { page: style.getPropertyValue("page"), padding: style.paddingTop };
    });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(printed).toEqual({ page: "consent-form", padding: "0px" });
  });

  /**
   * Mẫu 7 as the clinic's own copy (2026-10-29, R-1073), then the BA's Word
   * copy (R-1280): 12.5pt type; 12.5mm above, 7.5mm below and 15mm at the sides
   * of the sheet and of every printed page; Word's 1.5 lines (1.725 × the
   * size); the letterhead on the left margin; MS / Mã người bệnh a
   * column of labels and a column of blanks against the right margin; the
   * blanks after Chẩn đoán sau … Số đăng ký running to the right margin on the
   * line they start on, and the lines a long Chẩn đoán trước goes on to
   * reaching it too.
   */
  test("mẫu 7: Word's margins, the letterhead, the MS block and the blanks to the right margin", async ({ page }) => {
    const mm = (value: number) => (value / 25.4) * 96;
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu phẫu thuật/thủ thuật", { "procedure-record.text.1": LONG_DIAGNOSIS });

    const layout = await sheet(page)
      .locator(".nfc-tpl")
      .evaluate((root) => {
        const style = getComputedStyle(root);
        const box = root.getBoundingClientRect();
        const left = box.left + parseFloat(style.paddingLeft);
        const right = box.right - parseFloat(style.paddingRight);
        const rect = (node: Node) => {
          const range = root.ownerDocument.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        };
        const ids = root.querySelector(".record-ids");
        const blank = (id: string) => root.querySelector(`[data-medical-record-field="procedure-record.${id}"]`)!;
        const reaching = ["text.2", "text.3", "text.4", "text.5", "text.6", "text.11", "text.31", "text.33", "text.34", "text.35"].map((id) => {
          const node = blank(id);
          return { id, right: right - node.getBoundingClientRect().right, lines: node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight) };
        });
        return {
          fontSize: style.fontSize,
          padding: ["Top", "Right", "Bottom", "Left"].map((edge) => parseFloat(style.getPropertyValue(`padding-${edge.toLowerCase()}`))),
          lineHeight: parseFloat(getComputedStyle(blank("text.2").closest("p")!).lineHeight) / parseFloat(style.fontSize),
          letterhead: rect(root.querySelector(":scope > table:first-child td:first-child > p")!).left - left,
          labels: Array.from(ids?.querySelectorAll(".record-ids-label") ?? []).map((node) => node.getBoundingClientRect().left),
          blanks: Array.from(ids?.querySelectorAll(".nfc-medical-record-text-field") ?? []).map((node) => node.getBoundingClientRect().left),
          idsRight: right - (ids?.getBoundingClientRect().right ?? 0),
          reaching,
          flowed: Array.from(root.querySelectorAll('[data-flow-of="procedure-record.text.1"]')).map((node) => right - node.getBoundingClientRect().right),
        };
      });

    expect(layout.fontSize, "type").toBe("17.333px");
    const margins = [mm(12.5), mm(15), mm(7.5), mm(15)];
    layout.padding.forEach((edge, at) => expect(edge, "sheet margin").toBeCloseTo(margins[at], 1));
    expect(layout.lineHeight, "Word's 1.5 lines").toBeCloseTo(1.725, 2);
    expect(Math.abs(layout.letterhead), "letterhead on the left margin").toBeLessThan(1);
    expect(layout.labels, "MS labels").toHaveLength(2);
    for (const at of layout.labels) expect(at, "labels in one column").toBeCloseTo(layout.labels[0], 0);
    for (const at of layout.blanks) expect(at, "blanks in one column").toBeCloseTo(layout.blanks[0], 0);
    expect(Math.abs(layout.idsRight), "MS block on the right margin").toBeLessThan(1);
    for (const { id, right, lines } of layout.reaching) {
      expect(lines, `${id} stays on its line`).toBeLessThan(1.6);
      expect(Math.abs(right), `${id} runs to the right margin`).toBeLessThan(2);
    }
    expect(layout.flowed.length, "Chẩn đoán trước goes on to lines of its own").toBeGreaterThanOrEqual(1);
    for (const right of layout.flowed) expect(Math.abs(right), "a line of its own reaches the right margin").toBeLessThan(1);

    // On paper the margin is the page's, on every page: a page of its own, and no padding on the sheet.
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    const copy = page.locator(".mr-print-copy .nfc-tpl");
    await expect(copy).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const printed = await copy.evaluate((node) => {
      const style = getComputedStyle(node);
      return { page: style.getPropertyValue("page"), padding: style.paddingTop };
    });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(printed).toEqual({ page: "procedure-record", padding: "0px" });
  });

  /**
   * Mẫu 10 — Hợp đồng thỏa thuận niềng răng, the clinic's own form (.docx,
   * 2026-10-29): the contract and the Bản thỏa thuận attached to it, at the
   * clinic's .docx (R-1327) — 13pt, the contract on Word's 1.3 lines and the
   * agreement single, the titles at 15pt, 18mm above and below, 22mm left and
   * 20mm right on the sheet and on every printed page. Bên B is answered from the record — the
   * name in capitals, the code, CCCD — and so is the customer under III. Đồng ý
   * điều trị; a dotted line after a label runs to the right margin, and what the
   * clinic writes on the sheet comes back after a reload.
   */
  test("mẫu 10: the contract is filled from the record, keeps what is written and prints as the BA's Word", async ({ page }) => {
    const margins = [18, 20, 18, 22].map((mm) => (mm / 25.4) * 96);
    const form = "Hợp đồng thỏa thuận niềng răng";
    await openMedicalRecord(page);
    const patientId = new URL(page.url()).pathname.split("/")[2];
    const branch = await firstBranchId(page);
    const record = await call<{ patientCode: string; fullName: string; dateOfBirth: string | null; nationalId: string | null }>(
      page,
      `/api/v1/app/patients/${patientId}`,
      { branchId: branch },
    );
    expect(record.status).toBe(200);
    const patient = record.body;

    await openFreshSheet(page, form);
    await expect(blank(page, "orthodontic-contract.patient.name")).toHaveText(patient.fullName.trim().toUpperCase());
    await expect(blank(page, "orthodontic-contract.patient.code")).toHaveText(patient.patientCode);
    await expect(blank(page, "orthodontic-contract.patient.signer-name")).toHaveText(patient.fullName.trim());
    if (patient.nationalId?.trim()) {
      await expect(blank(page, "orthodontic-contract.patient.cccd")).toHaveText(patient.nationalId.trim());
    }
    if (patient.dateOfBirth) {
      const [year, month, day] = patient.dateOfBirth.slice(0, 10).split("-");
      await expect(blank(page, "orthodontic-contract.patient.date-of-birth")).toHaveText(`${day}/${month}/${year}`);
    }
    // Bên A and its representative are the clinic's print, not blanks.
    await expect(sheet(page).locator(".nfc-tpl")).toContainText("Đại diện: Bác sĩ Bùi Văn Tới – Bác sĩ phụ trách");

    const layout = await sheet(page)
      .locator(".nfc-tpl")
      .evaluate((root) => {
        const style = getComputedStyle(root);
        const right = root.getBoundingClientRect().right - parseFloat(style.paddingRight);
        const ratio = (node: Element) =>
          parseFloat(getComputedStyle(node).lineHeight) / parseFloat(getComputedStyle(node).fontSize);
        // The blanks that end their line, as the .docx's dotted lines do; the
        // record's own answers are left out, since a long one wraps as on any form.
        const reaching = Array.from(root.querySelectorAll('[data-medical-record-field][data-field-full-width="false"]'))
          .filter((node) => !node.textContent && !node.nextSibling && !node.parentElement?.nextSibling)
          .map((node) => {
            const box = node.getBoundingClientRect();
            return {
              id: node.getAttribute("data-medical-record-field"),
              right: right - box.right,
              lines: box.height / parseFloat(getComputedStyle(node).lineHeight),
            };
          });
        const title = (text: string) =>
          Array.from(root.querySelectorAll("h1")).find((node) => node.textContent?.includes(text));
        return {
          fontSize: style.fontSize,
          padding: ["top", "right", "bottom", "left"].map((edge) => parseFloat(style.getPropertyValue(`padding-${edge}`))),
          contract: ratio(root.querySelector('[data-medical-record-field="orthodontic-contract.text.7"]')!.closest("p")!),
          agreement: ratio(Array.from(root.querySelectorAll("p")).find((node) => node.textContent?.startsWith("1. Một số vấn đề"))!),
          titles: ["HỢP ĐỒNG THỎA THUẬN", "BẢN THỎA THUẬN"].map((text) => {
            const node = title(text)!.querySelector("span")!;
            return getComputedStyle(node).fontSize;
          }),
          reaching,
        };
      });
    expect(layout.fontSize, "13pt, as the clinic's .docx (R-1327)").toBe("17.333px");
    layout.padding.forEach((edge, at) => expect(edge, "sheet margin").toBeCloseTo(margins[at], 1));
    expect(layout.contract, "the contract on Word's 1.3 lines").toBeCloseTo(1.495, 2);
    expect(layout.agreement, "the agreement single").toBeCloseTo(1.15, 2);
    expect(layout.titles, "both titles at 15pt").toEqual(["20px", "20px"]);
    // The record answers several of them (Bên B, Chẩn đoán, the plan, the costs).
    expect(layout.reaching.length, "the dotted lines that end a line").toBeGreaterThanOrEqual(8);
    for (const { id, right, lines } of layout.reaching) {
      expect(lines, `${id} stays on its line`).toBeLessThan(1.6);
      expect(Math.abs(right), `${id} runs to the right margin`).toBeLessThan(4);
    }

    // What the clinic writes in the blanks the record leaves to the pen is the
    // sheet's, and comes back after a reload.
    const promise = `Đều răng, khớp cắn loại I ${runId()}`;
    await blank(page, "orthodontic-contract.text.19").fill("24 tháng");
    await blank(page, "orthodontic-contract.text.21").fill(promise);
    await save(page);
    await page.reload();
    await openSheet(page, form);
    await expect(blank(page, "orthodontic-contract.text.19")).toHaveText("24 tháng");
    await expect(blank(page, "orthodontic-contract.text.21")).toHaveText(promise);

    // On paper the margins are the page's, on every page — and each of the five
    // pages fits its sheet of A4, so the job has exactly five.
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    const copy = page.locator(".mr-print-copy .nfc-tpl");
    await expect(copy).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const printed = await copy.evaluate((node) => {
      const style = getComputedStyle(node);
      return { page: style.getPropertyValue("page"), padding: style.paddingTop };
    });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(printed).toEqual({ page: "orthodontic-contract", padding: "0px" });
    // As the clinic's PDF of the form (R-1327): six pages, the contract three
    // and the agreement three.
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length, "printed pages").toBe(6);
  });

  /**
   * A page filled to its foot prints no blank page (2026-11-21, R-1264). The
   * 7mm under a 5mm sheet's last line, a 3px gap closing a page, or the last
   * box's bottom margin went on to a page of their own when a page was full to
   * within a few px, and the printer gave out a sheet with nothing but its
   * page number. Lines written under "Thời gian mang duy trì" fill the
   * contract's first page a line at a time, through and past its foot; at every
   * step each printed page has writing on it.
   */
  test("mẫu 10: a page filled to its foot prints no blank page", async ({ page }) => {
    test.slow();
    const form = "Hợp đồng thỏa thuận niềng răng";
    await openMedicalRecord(page);
    await openFreshSheet(page, form);
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    const printJob = async () => {
      await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
      await expect(page.locator(".mr-print-copy .nfc-tpl")).toBeAttached();
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      return pdfPageTexts(pdf);
    };

    expect(await printJob(), "the blank form").toHaveLength(6);

    // Each Enter under the last line of page 1 adds a line there (lineEditing).
    let last = "orthodontic-contract.text.20";
    await blank(page, last).click();
    await page.keyboard.type("Hàm duy trì trong suốt");
    let pages = 6;
    for (let line = 1; line <= 30; line += 1) {
      // Printing took the caret out of the sheet: back to the end of the last line.
      await blank(page, last).click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      last = await sheet(page)
        .locator(":focus")
        .evaluate((node) => node.getAttribute("data-medical-record-field") ?? "");
      await page.keyboard.type(`Ghi chú thêm dòng ${line}`);

      const printed = await printJob();
      printed.forEach((text, at) => {
        expect(firstLineOf(text), `${line} added line(s): page ${at + 1} has writing`).not.toBe("");
      });
      pages = printed.length;
    }
    expect(pages, "thirty more lines run the contract onto a sheet more").toBeGreaterThan(6);
  });

  /**
   * A browser extension's block prints no page (clinic, 2026-10-29, R-1070).
   * An extension can put a block in the page that no print rule of the app's
   * hides — at the end of `<html>`, `display: … !important` inline, behind a
   * closed shadow root — and Chrome starts a page wherever the page name
   * changes. On mẫu 2 and mẫu 6's 15mm page such a block printed a blank last
   * page; one standing before a job that opens on another form and ends on
   * one of them, a blank first page.
   */
  test("a browser extension's block in the page prints no blank page", async ({ page }) => {
    test.slow();
    const outpatient = "Bệnh án ngoại trú Răng Hàm Mặt";
    const consent = "Giấy đồng ý thực hiện phẫu thuật/thủ thuật";
    const procedure = "Phiếu phẫu thuật/thủ thuật";
    const treatment = "Phiếu tư vấn và xác nhận đồng ý điều trị";
    const contract = "Hợp đồng thỏa thuận niềng răng";

    const extension = () =>
      page.evaluate(() => {
        const shadowed = (display: string) => {
          const host = document.createElement("div");
          host.attachShadow({ mode: "closed" }).innerHTML = `<style>:host{display:${display}!important}</style><div></div>`;
          return host;
        };
        const inline = document.createElement("div");
        inline.style.setProperty("display", "block", "important");
        document.body.append(shadowed("contents"), shadowed("block"), inline);
        document.documentElement.append(document.createElement("div"));
      });

    /** Pages "In biểu mẫu" sends to the printer; `pick` is what the Toàn bộ view's list ticks. */
    const printedPages = async (pick: string[], withExtension: boolean) => {
      await page.evaluate(() => {
        window.print = () => undefined;
      });
      // One block there from the start, as an extension's is — before the copy is made — and one added after.
      if (withExtension) await extension();
      await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
      if (pick.length) {
        const all = page.getByRole("checkbox", { name: "Chọn tất cả phiếu bệnh án" });
        await all.check();
        await all.uncheck();
        for (const form of pick) await page.getByRole("checkbox", { name: `Chọn ${form}` }).first().check();
        await page.getByRole("button", { name: "In", exact: true }).click();
      }
      await expect(page.locator(".mr-print-copy > .nfc-tpl")).toHaveCount(Math.max(pick.length, 1));
      if (withExtension) await extension();
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    };

    await openMedicalRecord(page);
    // Opening a fresh sheet reloads the page, which clears the blocks of the form before.
    await openFreshSheet(page, consent);
    expect(await printedPages([], true), `${consent} · printed pages`).toBe(2);
    await openFreshSheet(page, outpatient);
    // Five since the BA's Word sizes (R-1268).
    expect(await printedPages([], true), `${outpatient} · printed pages`).toBe(5);
    // Mẫu 7 on the 15mm page since R-1073, on a page of its own (12.5mm / 7.5mm) since R-1280.
    await openFreshSheet(page, procedure);
    expect(await printedPages([], true), `${procedure} · printed pages`).toBe(1);
    // Mẫu 10 on a page of its own (18mm / 20mm / 18mm / 22mm) since R-1327.
    await openFreshSheet(page, contract);
    expect(await printedPages([], true), `${contract} · printed pages`).toBe(6);

    // Mẫu 5 on the 5mm page, then mẫu 6 on the 15mm one: as many pages as the two print without the blocks.
    await openFreshSheet(page, treatment);
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Toàn bộ" }).click();
    const alone = await printedPages([treatment, consent], false);
    expect(await printedPages([treatment, consent], true), "mẫu 5 + mẫu 6 · printed pages").toBe(alone);
  });

  /**
   * Mẫu 5, clinic 2026-10-16: "Chi tiết răng sứ" / "Chi tiết Implant" show only
   * for their ticked method and number themselves after "Bác sĩ điều trị";
   * "Loại" lists Danh mục → Vật liệu nha khoa, fills Hãng / Xuất xứ / Bảo hành
   * from the ticked types, adds a type with ⊕ and corrects one on a double click.
   */
  test("mẫu 5: crown and implant parts follow their method, and Loại comes from Danh mục", async ({ page }) => {
    test.slow();
    const id = runId();
    const branch = "11111111-1111-1111-1111-111111111111";
    await page.goto("/patient");
    const material = async (name: string, kind: number, brand: string, origin: string, warranty: string) => {
      const taxonomyId = await materialGroup(page, branch, kind);
      const created = await call(page, "/api/v1/app/catalog-entries", {
        method: "POST",
        branchId: branch,
        json: { clinicBranchId: branch, taxonomyId, name, sortOrder: 0, restoration: { kind, brand, origin, warranty } },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(200);
    };
    const crownA = `Sứ A ${id}`;
    const crownB = `Sứ B ${id}`;
    await material(crownA, 1, `Hãng A ${id}`, "Mỹ", "15 năm");
    await material(crownB, 1, `Hãng B ${id}`, "Đức", "10 năm");

    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    const document = sheet(page);
    const crownPart = document.locator('[data-show-when="consultation.checkbox.6"]');
    const implantPart = document.locator('[data-show-when="consultation.checkbox.7"]');
    const numberOf = (part: typeof crownPart) => part.first().locator("[data-item-number]");

    // Hidden until their method is ticked; "Niềng răng" is a method of its own.
    await expect(crownPart.first()).toBeHidden();
    await expect(implantPart.first()).toBeHidden();
    await expect(document.getByText("Niềng răng")).toBeVisible();

    await blank(page, "consultation.checkbox.7").check();
    await expect(implantPart.first()).toBeVisible();
    await expect(numberOf(implantPart)).toHaveText("2");
    await blank(page, "consultation.checkbox.6").check();
    await expect(numberOf(crownPart)).toHaveText("2");
    await expect(numberOf(implantPart)).toHaveText("3");

    // One type: its values. Two: "value (type)" joined by "; ".
    const option = (name: string) => document.locator(".nfc-material-option", { hasText: name });
    await option(crownA).locator("input").check();
    await expect(blank(page, "consultation.text.12")).toHaveText(`Hãng A ${id}`);
    await expect(blank(page, "consultation.text.13")).toHaveText("Mỹ");
    await expect(blank(page, "consultation.text.14")).toHaveText("15 năm");
    await option(crownB).locator("input").check();
    for (const part of [`Hãng A ${id} (${crownA})`, `Hãng B ${id} (${crownB})`]) {
      await expect(blank(page, "consultation.text.12")).toContainText(part);
    }
    await expect(blank(page, "consultation.text.12")).toContainText("; ");
    await expect(blank(page, "consultation.text.14")).toContainText(`10 năm (${crownB})`);

    // ⊕ adds an implant type to Danh mục and ticks it.
    const implant = `Implant ${id}`;
    await document.locator('[data-medical-record-field="consultation.implant.types"] [data-material-action="add"]').click();
    let dialog = page.getByRole("dialog", { name: "Thêm loại implant" });
    await dialog.getByLabel(/Loại/).fill(implant);
    await dialog.getByLabel(/Hãng/).fill("Nobel");
    await dialog.getByLabel(/Xuất xứ/).fill("Thụy Điển");
    await dialog.getByLabel(/Bảo hành/).fill("Trọn đời");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();
    await expect(option(implant).locator("input")).toBeChecked();
    await expect(blank(page, "consultation.text.18")).toHaveText("Nobel");
    await expect(blank(page, "consultation.text.19")).toHaveText("Thụy Điển");
    await expect(blank(page, "consultation.text.20")).toHaveText("Trọn đời");

    // A double click corrects it, in Danh mục too.
    await option(implant).dblclick();
    dialog = page.getByRole("dialog", { name: "Sửa loại implant" });
    await expect(dialog.getByLabel(/Hãng/)).toHaveValue("Nobel");
    await dialog.getByLabel(/Hãng/).fill("Nobel Biocare");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();
    await expect(blank(page, "consultation.text.18")).toHaveText("Nobel Biocare");
    const listed = await call<{ items: Array<{ name: string; restoration: { kind: number; brand: string } | null }> }>(
      page,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=dental_material&filter=${encodeURIComponent(implant)}`,
      { branchId: branch },
    );
    expect(listed.body.items.find((item) => item.name === implant)?.restoration).toMatchObject({ kind: 2, brand: "Nobel Biocare" });

    await save(page);
    await page.reload();
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(crownPart.first()).toBeVisible();
    await expect(implantPart.first()).toBeVisible();
    await expect(option(crownA).locator("input")).toBeChecked();
    await expect(option(crownB).locator("input")).toBeChecked();
    await expect(option(implant).locator("input")).toBeChecked();
    await expect(blank(page, "consultation.text.12")).toContainText(`Hãng A ${id} (${crownA})`);
    await expect(blank(page, "consultation.text.18")).toHaveText("Nobel Biocare");
  });

  test("mẫu 5: a sheet from before opens with the ticks of its old fixed boxes", async ({ page }) => {
    const id = runId();
    const branch = "11111111-1111-1111-1111-111111111111";
    await page.goto("/patient");
    const taxonomyId = await materialGroup(page, branch, 1);
    const lava = await call<{ items: Array<{ name: string }> }>(
      page,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=dental_material&isDeleted=false&filter=Lava`,
      { branchId: branch },
    );
    if (!lava.body.items.some((item) => item.name === "Lava")) {
      await call(page, "/api/v1/app/catalog-entries", {
        method: "POST",
        branchId: branch,
        json: { clinicBranchId: branch, taxonomyId, name: "Lava", sortOrder: 0, restoration: { kind: 1, brand: "Lava", origin: "Mỹ", warranty: "15 năm" } },
      });
    }

    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    // What a sheet saved before 2026-10-16 holds: the fixed "Lava" and "Khác: …" boxes.
    const written = await page.evaluate(async (other) => {
      const patientId = window.location.pathname.split("/")[2];
      const list = await fetch(`/api/v1/app/patient-medical-records?patientId=${patientId}&maxResultCount=200`, {
        credentials: "include",
      }).then((r) => r.json());
      const target = (list.items as Array<{ id: string; form: number; creationTime: string; cancelledAt: string | null }>)
        .filter((item) => item.form === 5 && !item.cancelledAt)
        .sort((a, b) => a.creationTime.localeCompare(b.creationTime))[0];
      const res = await fetch(`/api/v1/app/patient-medical-records/${target.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: JSON.stringify({
            fieldValues: {
              "consultation.checkbox.6": true,
              "consultation.checkbox.12": true,
              "consultation.checkbox.14": true,
              "consultation.text.11": other,
            },
          }),
        }),
      });
      return res.status;
    }, `Sứ cũ ${id}`);
    expect(written).toBe(200);

    await page.reload();
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    const document = sheet(page);
    await expect(document.locator('[data-show-when="consultation.checkbox.6"]').first()).toBeVisible();
    await expect(document.locator(".nfc-material-option[data-material-name='Lava'] input")).toBeChecked();
    await expect(document.locator(".nfc-material-option", { hasText: `Sứ cũ ${id}` }).locator("input")).toBeChecked();
  });

  /**
   * Clinic, 2026-10-16: unsaved writing is not lost by wandering off. Opening
   * another sheet, or leaving the Bệnh án view, asks first — Lưu, Không lưu,
   * Ở lại — and a click into a blank that changes nothing asks nothing.
   */
  test("leaving a sheet with unsaved writing asks to save it first", async ({ page }) => {
    const id = runId();
    await openMedicalRecord(page);
    await openFreshSheet(page, "Bìa hồ sơ bệnh án");
    // Mã lưu trữ is answered by the set (P1810); discarding the writing brings it back.
    const storageCode = (await blank(page, "cover.text.1").textContent()) ?? "";
    const dialog = page.getByRole("dialog", { name: "Phiếu chưa được lưu" });
    const otherSheet = page.locator(".pd-medical-form", { hasText: "Phiếu chăm sóc" });
    if ((await otherSheet.locator(LIVE_CARD).count()) === 0) {
      await otherSheet.getByRole("button", { name: "Thêm" }).click();
      await expect(dialog).toBeHidden();
      await expect(otherSheet.locator(LIVE_CARD)).toHaveCount(1);
      await openSheet(page, "Bìa hồ sơ bệnh án");
    }

    // A click that changes nothing is not a change.
    await blank(page, "cover.text.1").click();
    await otherSheet.locator(LIVE_CARD).first().locator(".pd-sheet-open").click();
    await expect(dialog).toBeHidden();
    await openSheet(page, "Bìa hồ sơ bệnh án");

    // Another sheet: "Ở lại" keeps the writing; "Không lưu" goes on without it.
    await blank(page, "cover.text.1").fill(`LT ${id}`);
    await otherSheet.locator(LIVE_CARD).first().locator(".pd-sheet-open").click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Bìa hồ sơ bệnh án");
    await dialog.getByRole("button", { name: "Ở lại" }).click();
    await expect(dialog).toBeHidden();
    await expect(blank(page, "cover.text.1")).toHaveText(`LT ${id}`);
    await otherSheet.locator(LIVE_CARD).first().locator(".pd-sheet-open").click();
    await dialog.getByRole("button", { name: "Không lưu" }).click();
    await expect(dialog).toBeHidden();
    await expect(blank(page, "care.diagnosis")).toBeAttached();
    await openSheet(page, "Bìa hồ sơ bệnh án");
    await expect(blank(page, "cover.text.1")).toHaveText(storageCode);

    // Leaving the Bệnh án tab for another: "Lưu" saves, then goes on — and it is there after a reload.
    await blank(page, "cover.text.1").fill(`LT ${id}`);
    await page.locator(".pd-tabrow").getByRole("link", { name: "Hồ sơ", exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/tab=profile/);
    await page.goto(page.url().replace(/tab=profile/, "tab=medical-record"));
    await openLastSheet(page, "Bìa hồ sơ bệnh án");
    await expect(blank(page, "cover.text.1")).toHaveText(`LT ${id}`);
  });

  test("picking the day prints it on the sheet, and it survives a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    // Before a day is picked it shows the consulting day, or today (P1810).
    const printed = blank(page, "consultation.text.4");
    await expect(printed).not.toHaveText("15/08/2026");

    await page.locator(".pd-medical-date input").fill("15/08/2026");
    await page.locator(".pd-medical-date input").press("Enter");
    // The open document takes the value without being rebuilt under the caret.
    await expect(printed).toHaveText("15/08/2026");
    await save(page);

    await page.reload();
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(blank(page, "consultation.text.4")).toHaveText("15/08/2026");
    await expect(page.locator(".pd-medical-date input")).toHaveValue("15/08/2026");
  });

  /**
   * Clinic, 2026-11-26 (R-1325): a name under a signature, centred in its
   * column, broke "BS. PHẠM THỊ THANH / HƯƠNG" over two lines with half the
   * column still free — a blank was let grow only to the right of where it
   * stood. On every form, a long name in a blank on a centred line of its own
   * stays on one line, and the sheet is exactly as tall as with it empty.
   */
  test("a long name under a signature stays on one line on every form, and nothing on the sheet moves", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const NAME = "BS. PHẠM THỊ THANH HƯƠNG";
    const forms: Array<[string, number]> = [
      ...Object.entries(FORM_NUMBER),
      ["Bảng kiểm an toàn phẫu thuật", 11],
      ["Bảng kiểm đếm gạc, dụng cụ sắc nhọn, dụng cụ", 12],
    ];
    for (const [form, number] of forms) FORM_NUMBER[form] = number;

    /** The blanks on a centred line of their own — the names under signatures — and how tall the sheet is. */
    const measure = () =>
      sheet(page)
        .locator("body")
        .evaluate((body) => {
          const doc = body.ownerDocument;
          const view = doc.defaultView!;
          const ids = Array.from(doc.querySelectorAll<HTMLElement>('[data-medical-record-field][data-field-type="text"]'))
            .filter((field) => {
              const block = field.parentElement?.closest("p");
              if (!block || !["center", "-webkit-center"].includes(view.getComputedStyle(block).textAlign)) return false;
              // Under a signature: "(Ký, ghi rõ họ tên)" in its cell, or on a line just above it.
              const cell = block.closest("td");
              const above: Element[] = [block];
              for (let prev = block.previousElementSibling; prev && above.length < 5; prev = prev.previousElementSibling) {
                above.push(prev);
              }
              const signed = (cell ? [cell] : above).some((part) => part.textContent?.toLowerCase().includes("ký"));
              if (!signed) return false;
              const box = field.getBoundingClientRect();
              // Nothing else written on the blank's line.
              const range = doc.createRange();
              const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.closest("[data-medical-record-field]") || !node.textContent?.trim()) continue;
                range.selectNodeContents(node);
                const onLine = Array.from(range.getClientRects()).some(
                  (rect) => rect.width > 0 && rect.top < box.bottom - 1 && rect.bottom > box.top + 1,
                );
                if (onLine) return false;
              }
              return true;
            })
            .map((field) => field.getAttribute("data-medical-record-field")!);
          return { ids, height: Math.ceil(doc.documentElement.scrollHeight) };
        });

    /** Each name blank: on one line, nothing flowed on under it. */
    const lines = (ids: string[]) =>
      sheet(page)
        .locator("body")
        .evaluate((body, ids) => {
          const doc = body.ownerDocument;
          const view = doc.defaultView!;
          return ids.map((id) => {
            const field = doc.querySelector<HTMLElement>(`[data-medical-record-field="${id}"]`)!;
            const style = view.getComputedStyle(field);
            const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
            const flowed = doc.querySelectorAll(`[data-flow-of="${id}"]`).length;
            return { id, text: field.textContent, oneLine: field.getBoundingClientRect().height < lineHeight * 1.6 && flowed === 0 };
          });
        }, ids);

    await openMedicalRecord(page);
    let checked = 0;
    for (const [form] of forms) {
      await openFreshSheet(page, form);
      const empty = await measure();
      if (empty.ids.length === 0) continue;

      await openFreshSheet(page, form, Object.fromEntries(empty.ids.map((id) => [id, NAME])));
      for (const name of await lines(empty.ids)) {
        expect(name.text, `${form} ${name.id}`).toBe(NAME);
        expect(name.oneLine, `${form} ${name.id}: one line`).toBe(true);
        checked += 1;
      }
      expect((await measure()).height, `${form}: as tall as with the names empty`).toBe(empty.height);
    }
    expect(checked, "names under signatures checked").toBeGreaterThan(10);
  });

  /**
   * Clinic, 2026-11-26 (R-1328): on mẫu 5, "BS. PHẠM THỊ THANH / HƯƠNG" broke
   * over two lines in the Bác sĩ tư vấn blank — "Ngày tư vấn" stood well left
   * of "Ngày sinh" above it. Ngày tư vấn now starts where Ngày sinh starts, so
   * the consultant's blank reaches as far as the name's, and the name holds.
   */
  test("mẫu 5: Ngày tư vấn starts under Ngày sinh, and a long consultant name stays on one line", async ({ page }) => {
    const NAME = "BS. PHẠM THỊ THANH HƯƠNG";
    const form = "Phiếu tư vấn và xác nhận đồng ý điều trị";

    /** Where the label after the blank starts — the text right after the blank's own span. */
    const measure = () =>
      sheet(page)
        .locator("body")
        .evaluate((body) => {
          const doc = body.ownerDocument;
          const labelLeft = (id: string) => {
            const span = doc.querySelector(`[data-medical-record-field="${id}"]`)!.parentElement!;
            let node = span.nextSibling;
            while (node && node.nodeType !== Node.TEXT_NODE) node = node.nextSibling;
            const text = node!.textContent!;
            const at = text.search(/\S/u);
            const range = doc.createRange();
            range.setStart(node!, at);
            range.setEnd(node!, at + 1);
            return range.getBoundingClientRect().left;
          };
          const consultant = doc.querySelector<HTMLElement>('[data-medical-record-field="consultation.text.3"]')!;
          const style = doc.defaultView!.getComputedStyle(consultant);
          const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
          return {
            dateOfBirth: labelLeft("consultation.patient.name"),
            consulted: labelLeft("consultation.text.3"),
            oneLine: consultant.getBoundingClientRect().height < lineHeight * 1.6,
            height: Math.ceil(doc.documentElement.scrollHeight),
          };
        });

    await openMedicalRecord(page);
    await openFreshSheet(page, form);
    const empty = await measure();
    expect(Math.abs(empty.consulted - empty.dateOfBirth), "Ngày tư vấn under Ngày sinh").toBeLessThan(1);

    await openFreshSheet(page, form, { "consultation.text.3": NAME });
    const filled = await measure();
    await expect(blank(page, "consultation.text.3")).toHaveText(NAME);
    expect(filled.oneLine, "the consultant's name on one line").toBe(true);
    expect(Math.abs(filled.consulted - filled.dateOfBirth), "still under Ngày sinh").toBeLessThan(1);
    expect(filled.height, "the sheet as tall as with it empty").toBe(empty.height);
  });
});
