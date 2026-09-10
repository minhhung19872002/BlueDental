import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Bệnh án — the record's second view, behind the header's
 * Chi tiết hồ sơ / Bệnh án switch.
 *
 * Every form is drawn from the blank it is printed on, filled through its
 * `data-medical-record-field` blanks, in its own document. So the assertions
 * reach into that document rather than into the app's DOM.
 *
 * Real stack throughout: adding a sheet POSTs, saving PUTs, and everything is
 * read back from PostgreSQL after a reload. Nothing is intercepted.
 */

/** Opens a patient's record and switches to Bệnh án. */
async function openMedicalRecord(page: Page) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page
    .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
    .first()
    .click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  // The tab mounts only when the view opens, so its list request goes out on
  // this click. Counting cards before it lands reads zero on a patient who
  // already has sheets.
  const listed = page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/app/patient-medical-records") &&
      res.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Bệnh án" }).click();
  await expect(page).toHaveURL(/view=medical-record/);
  expect((await listed).ok()).toBeTruthy();
}

/** The sheet cards nested under one form's row in the index. */
function cardsUnder(page: Page, form: string) {
  return page.locator(".pd-medical-form", { hasText: form }).locator(".pd-sheet-card");
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
    await expect(page.getByText("Đã thêm phiếu bệnh án")).toBeVisible();
  }
  await cards.first().locator(".pd-sheet-open").click();
  await sheetReady(page);
}

/** The frame is in the DOM before its document is; the blanks say when it is. */
async function sheetReady(page: Page) {
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(sheet(page).locator("[data-medical-record-field]").first()).toBeAttached();
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

/** The nine forms, by the number the API stores them under. */
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
};

/**
 * A sheet with nothing written on it, for the tests that assert what the
 * *record* answers, or what a blank form draws.
 *
 * Wipes the form's first copy rather than adding another one: a run that adds
 * leaves the sheet behind, and after a few of them the index carries dozens of
 * copies and the suite slows to a crawl. Keyed on the form's number, not its
 * name — a sheet can be renamed.
 */
async function openFreshSheet(page: Page, form: string) {
  const row = page.locator(".pd-medical-form", { hasText: form });
  const cards = row.locator(".pd-sheet-card");

  if ((await cards.count()) === 0) {
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(cards).toHaveCount(1);
  }

  const wiped = await page.evaluate(async (number: number) => {
    const patientId = window.location.pathname.split("/")[2];
    const read = async () => {
      const res = await fetch(
        `/api/v1/app/patient-medical-records?patientId=${patientId}&maxResultCount=200`,
        { credentials: "include" },
      );
      const items: Array<{ id: string; form: number; creationTime: string; content: string | null }> =
        (await res.json()).items;
      return items
        .filter((item) => item.form === number)
        .sort((a, b) => a.creationTime.localeCompare(b.creationTime))[0];
    };

    const sheet = await read();
    if (!sheet) return "no sheet";

    const put = await fetch(`/api/v1/app/patient-medical-records/${sheet.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // An explicitly empty set of values, not null: the API treats a null
      // content as "leave it as it is", which is what lets a rename send only
      // a title.
      body: JSON.stringify({ content: JSON.stringify({ fieldValues: {} }) }),
    });
    if (!put.ok) return `put ${put.status}`;

    // Read it back: the sheet is drawn again straight after, and it has to be
    // the wiped copy that appears.
    for (let tries = 0; tries < 10; tries += 1) {
      const again = await read();
      const values = again?.content ? Object.keys(JSON.parse(again.content).fieldValues ?? {}) : [];
      if (values.length === 0) return "ok";
      await new Promise((done) => setTimeout(done, 150));
    }
    return "still filled";
  }, FORM_NUMBER[form]);
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

test.describe("Bệnh án", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the index lists the reference's nine forms and the view rides in the URL", async ({
    page,
  }) => {
    await openMedicalRecord(page);

    // The index, in the reference's own order and wording.
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
    ];
    await expect(page.locator(".pd-medical-form")).toHaveCount(forms.length);
    for (const label of forms) {
      await expect(page.locator(".pd-medical-form").getByText(label, { exact: true })).toBeVisible();
    }

    // The bar the reference floats along the bottom, and the doctor picker it
    // puts at the end of the sheet's own heading.
    for (const command of ["Từng phiếu", "Toàn bộ", "In biểu mẫu", "Đồng bộ phiếu", "Lưu"]) {
      await expect(page.locator(".pd-medical-bar").getByText(command, { exact: true })).toBeVisible();
    }
    await expect(page.locator(".pd-medical-zoom")).toContainText("100%");
    await expect(page.locator(".pd-medical-doctor")).toBeVisible();

    // Switching back to the tabbed view drops the parameter again.
    await page.getByRole("button", { name: "Chi tiết hồ sơ" }).click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.locator(".pd-profile-card")).toBeVisible();
  });

  /**
   * The nine forms are documents, not code: the only thing worth asserting
   * about their layout is that each draws the whole of its own printed
   * original. The counts are the reference's, taken off the same blanks.
   */
  test("every form draws the whole of its printed original", async ({ page }) => {
    // Nine forms, each wiped and reloaded before it is counted.
    test.slow();
    await openMedicalRecord(page);

    const expected = [
      { form: "Bìa hồ sơ bệnh án", blanks: 56, boxes: 20, pages: 3 },
      { form: "Bệnh án ngoại trú Răng Hàm Mặt", blanks: 142, boxes: 18, pages: 3 },
      { form: "Bệnh án chỉnh nha", blanks: 182, boxes: 64, pages: 3 },
      { form: "Phiếu Tư Vấn Tổng Quát", blanks: 23, boxes: 0, pages: 1 },
      { form: "Phiếu tư vấn và xác nhận đồng ý điều trị", blanks: 82, boxes: 21, pages: 2 },
      { form: "Giấy đồng ý thực hiện phẫu thuật/thủ thuật", blanks: 49, boxes: 26, pages: 2 },
      { form: "Phiếu phẫu thuật/thủ thuật", blanks: 38, boxes: 2, pages: 1 },
      { form: "Phiếu theo dõi điều trị", blanks: 111, boxes: 2, pages: 1 },
      { form: "Phiếu chăm sóc", blanks: 118, boxes: 2, pages: 1 },
    ];

    for (const item of expected) {
      // On a wiped copy: a row added by another test and saved would show up
      // here as extra blanks. The heading carries the *sheet's* name, which may
      // have been renamed, so what identifies the form is the blanks it draws.
      await openFreshSheet(page, item.form);

      const document = sheet(page);
      await expect(document.locator("[data-medical-record-field]")).toHaveCount(item.blanks);
      await expect(document.locator(".nfc-medical-record-checkbox")).toHaveCount(item.boxes);
      // Pages are separated by a rule; one rule is two pages.
      await expect(document.locator(".nfc-tpl > hr")).toHaveCount(item.pages - 1);
    }
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

    // And the one it deliberately leaves for the clinic's pen.
    await expect(blank(page, "cover.patient.address")).toBeEmpty();

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
          .filter((item: { form: number }) => item.form === 1)
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

    const number = blank(page, "treatment-tracking.page-1.patient.code");
    await expect(number).toBeEmpty();
    await expect(number).not.toHaveAttribute("data-field-source", /.+/);
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
    // The eighth cost line: the form prints eight, so the next is row 9.
    await hoverRow(page, "consultation.text.42");
    await document.getByRole("button", { name: "Thêm dòng" }).click();
    await expect(rows).toHaveCount(before + 1);

    const added = blank(page, "consultation.treatment-cost.row-9.service");
    await expect(added).toBeAttached();
    await added.fill("Cạo vôi răng");
    await save(page);

    await page.reload();
    // The sheet this test made, not the record's first copy of the form.
    await openLastSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    await expect(blank(page, "consultation.treatment-cost.row-9.service")).toHaveText(
      "Cạo vôi răng",
    );
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
    await page.getByRole("button", { name: "Mở mục lục" }).click();
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
  test("the tick in a card's corner keeps clear of its action buttons", async ({ page }) => {
    for (const width of [1440, 900]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 1440) await openMedicalRecord(page);
      if (width === 900) await page.getByRole("button", { name: "Mở mục lục" }).click();

      const geometry = await page.locator(".pd-sheet-card").evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          const tick = card.querySelector(".pd-sheet-check")!.getBoundingClientRect();
          const actions = card.querySelector(".pd-sheet-actions")!.getBoundingClientRect();
          return {
            height: Math.round(box.height),
            gap: Math.round(actions.top - tick.bottom),
            // Neither may hang off the card.
            inside: tick.top >= box.top && actions.bottom <= box.bottom,
          };
        }),
      );

      expect(geometry.length).toBeGreaterThan(0);
      for (const card of geometry) {
        expect(card.height).toBeGreaterThanOrEqual(93);
        expect(card.gap).toBeGreaterThanOrEqual(4);
        expect(card.inside).toBe(true);
      }
    }
  });

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

    await hoverRow(page, "consultation.text.42");
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
        .querySelector('[data-medical-record-field="consultation.text.42"]')!
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
   * What reaches the paper is the record and nothing else, at its full length.
   *
   * Everything from the app shell down to the sheet column is a fixed-height
   * clipping box, so a record two and a half pages long came out as one page —
   * the printer paginates what the root lays out. The isolation has to open
   * every one of them.
   */
  test("printing lays out the whole record and nothing else", async ({ page }) => {
    // The real print button, with only the dialog itself stubbed out.
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { __printed?: boolean }).__printed = true;
      };
    });
    await openMedicalRecord(page);
    await openSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed?: boolean }).__printed)).toBe(
      true,
    );

    // The index is not on the paper; the sheet's own column is.
    await expect(page.locator('.pd-medical-index[data-mr-print="hide"]')).toHaveCount(1);
    await expect(page.locator('[data-mr-print="path"]')).not.toHaveCount(0);

    await page.emulateMedia({ media: "print" });
    const paper = await page.evaluate(() => {
      const doc = document.querySelector<HTMLElement>(".mr-doc")!;
      const box = doc.getBoundingClientRect();
      const clipping: string[] = [];
      for (let node = doc.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowY !== "visible" || style.overflowX !== "visible") {
          clipping.push(`${node.tagName}.${String(node.className).split(" ")[0]}`);
        }
      }
      return {
        sheetTop: Math.round(box.top + window.scrollY),
        sheetHeight: Math.round(box.height),
        rootHeight: Math.round(document.documentElement.getBoundingClientRect().height),
        clipping,
      };
    });
    await page.emulateMedia({ media: null });

    // A record is taller than the window; if anything still clipped, the root
    // would be the window's height and every page after the first would be lost.
    expect(paper.sheetTop).toBe(0);
    expect(paper.sheetHeight).toBeGreaterThan(1200);
    expect(paper.rootHeight).toBe(paper.sheetHeight);
    expect(paper.clipping).toEqual([]);
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
    await page.setViewportSize({ width: 900, height: 700 });

    const index = page.locator(".pd-medical-index");
    const bar = page.locator(".pd-medical-barwrap");
    const openTitle = page.locator(".pd-medical-canvas-head strong");

    await expect(index).toHaveClass(/--collapsed/);
    await page.getByRole("button", { name: "Mở mục lục" }).click();
    await expect(index).not.toHaveClass(/--collapsed/);

    /*
     * The bar floats over the window here, so with the list open it floats over
     * the list — and its buttons swallowed taps meant for the cards under it (a
     * click on a card landed on the zoom's `+`). It stands down until the list
     * folds again.
     */
    await expect(bar).toBeHidden();

    const target = page.locator(".pd-medical-form", { hasText: "3. Bệnh án chỉnh nha" });
    const name = await target.locator(".pd-sheet-title").first().textContent();
    await target.locator(".pd-sheet-open").first().click();

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

  test("picking the day prints it on the sheet, and it survives a reload", async ({ page }) => {
    await openMedicalRecord(page);
    await openFreshSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");

    const printed = blank(page, "consultation.text.4");
    await expect(printed).toBeEmpty();

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
});
