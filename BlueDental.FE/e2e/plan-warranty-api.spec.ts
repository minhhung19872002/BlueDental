import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import {
  activateWarranty,
  call,
  CardSide,
  clinicToday,
  freshSlip,
  LABO_SERVICE,
  laboCatalog,
  orderBody,
  passAll,
  PLANS,
  receive,
  sentOrder,
  serviceLine,
  type CardPhoto,
  type LaboLine,
  type LineOptions,
  type SpecService,
} from "./fixtures/laboApi";
import {
  activateDental,
  addStage,
  closeStage,
  completeLine,
  dentalWarrantyUrl,
  WarrantyKind,
  type DentalCardInput,
} from "./fixtures/warrantyApi";

/**
 * Feature F-86, phase B: the slip's Bảo hành tab (P3110 REQ-B1..B7) —
 * `GET warranty-overview` and "Bảo hành dịch vụ"
 * (`POST services/{line}/warranty`), docs/wip/p3110-labo-warranty-plan.md.
 *
 * Every call is a real HTTP request issued from inside the logged-in page,
 * with the cookie the real login left and the antiforgery token the server
 * set. No route is intercepted, no token is injected, and every write is read
 * back with a separate request.
 */

const code = (n: number) => `BlueDental:Treatment:${String(n).padStart(4, "0")}`;
const SERVICE_HAS_NO_WARRANTY = code(34);
const LINE_NOT_DONE = code(53);
const TOOTH_INVALID = code(54);
const START_BEFORE_COMPLETION = code(55);
const DURATION_INVALID = code(56);
const CARD_PHOTO_INVALID = code(57);

/** A service with a warranty period of its own: Danh mục "Thời gian bảo hành (ngày)" = 365. */
const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };

/** WarrantyCellState / WarrantyRowGroup / WarrantyCardKind / WarrantyEventKind on the wire. */
const Cell = { None: 0, NotEligible: 1, Pending: 2, Activated: 3 } as const;
const Group = { Ready: 1, Activated: 2, NotEligible: 3 } as const;
const Kind = { Dental: 1, Labo: 2 } as const;
const Event = {
  LaboPassed: 1,
  LaboReturned: 2,
  LaboActivated: 3,
  DentalActivated: 4,
  RequestOpened: 5,
  RequestDone: 6,
} as const;

interface Row {
  lineId: string;
  lineCode: string;
  serviceName: string;
  teeth: number[];
  status: number;
  completedOn: string | null;
  laboFitted: boolean;
  laboOrderCodes: string[];
  warrantyDays: number;
  dental: number;
  dentalCardCount: number;
  dentalPendingTeeth: (number | null)[];
  labo: number;
  laboCardCount: number;
  pendingLaboOrderId: string | null;
  group: number;
}

interface Card {
  code: string;
  kind: number;
  lineId: string;
  toothNumber: number | null;
  laboOrderCode: string | null;
  supplierName: string | null;
  startDate: string;
  endDate: string;
  durationMonths: number | null;
  durationDays: number | null;
  conditions: string | null;
  photos: { id: string; url: string; side: number }[];
}

interface WarrantyEvent {
  at: string;
  source: number;
  kind: number;
  lineId: string;
  laboOrderCode: string | null;
  teeth: number[];
  cardCodes: string[];
  stageName: string | null;
  staffName: string | null;
}

interface Overview {
  today: string;
  tabCount: number;
  pendingCount: number;
  rows: Row[];
  cards: Card[];
  history: WarrantyEvent[];
  openRequests: number;
  doneRequests: number;
}

const overviewUrl = (line: LaboLine) => `${PLANS}/${line.planId}/warranty-overview`;

/** A line on a slip of the test's own, so the tab's counts move only by what the test does. */
async function freshLine(page: Page, options: Omit<LineOptions, "planId">): Promise<LaboLine> {
  return serviceLine(page, { ...options, planId: await freshSlip(page, runId()) });
}

async function overview(page: Page, line: LaboLine): Promise<Overview> {
  const res = await call<Overview>(page, overviewUrl(line), { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as Overview;
}

async function rowOf(page: Page, line: LaboLine): Promise<Row> {
  const row = (await overview(page, line)).rows.find((one) => one.lineId === line.lineId);
  expect(row, "the line should have a row on its slip's Bảo hành tab").toBeTruthy();
  return row!;
}

/** "Bảo hành dịch vụ" as the dialog posts it: multipart `cards[i].*` keys + the Ảnh thẻ. */
function activateWithPhotos(
  page: Page,
  line: LaboLine,
  cards: DentalCardInput[],
  cardPhotos: readonly CardPhoto[],
) {
  const form: Record<string, string | number> = {};
  cards.forEach((card, i) => {
    for (const [key, value] of Object.entries(card)) {
      if (value !== null && value !== undefined) form[`cards[${i}].${key}`] = value;
    }
  });
  return call<Overview>(page, dentalWarrantyUrl(line), {
    method: "POST",
    branchId: line.branchId,
    form,
    cardPhotos,
  });
}

/** `yyyy-MM-dd` moved by whole days or months, as DateOnly.AddDays / AddMonths would. */
function shift(iso: string, { days = 0, months = 0 }: { days?: number; months?: number }): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** D4: BH-{mã phiếu dịch vụ}-{ddMMyyyy}-{răng, 00 when none}. */
function cardCode(lineCode: string, start: string, tooth: number | null): string {
  const [y, m, d] = start.split("-");
  return `BH-${lineCode}-${d}${m}${y}-${String(tooth ?? 0).padStart(2, "0")}`;
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Slip Bảo hành tab API (P3110 phase B)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a finished line waits for its dental cards, one per tooth, and reads them back (REQ-B3/B5/B6)", async ({
    page,
  }) => {
    const id = runId();
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [36, 37] });

    // Đang điều trị: the period is known, nothing can be activated yet.
    const treating = await rowOf(page, line);
    expect(treating).toMatchObject({
      teeth: [36, 37],
      status: 1,
      completedOn: null,
      warrantyDays: 365,
      dental: Cell.NotEligible,
      dentalPendingTeeth: [],
      labo: Cell.None,
      group: Group.NotEligible,
    });
    const early = await activateDental<Overview>(page, line, [
      { toothNumber: 36, startDate: today },
    ]);
    expect(early.status, early.text).toBe(403);
    expect(early.body.error?.code).toBe(LINE_NOT_DONE);

    const before = await overview(page, line);
    expect((await completeLine(page, line)).status).toBe(200);
    const done = await overview(page, line);
    const ready = done.rows.find((one) => one.lineId === line.lineId)!;
    expect(ready).toMatchObject({
      status: 3,
      completedOn: today,
      dental: Cell.Pending,
      dentalPendingTeeth: [36, 37],
      group: Group.Ready,
    });
    expect(done.today).toBe(today);
    expect(done.tabCount).toBe(before.tabCount + 1);
    expect(done.pendingCount).toBe(before.pendingCount + 1);

    // Every card is checked before any is written.
    const refused: [DentalCardInput[], string][] = [
      [[], TOOTH_INVALID],
      [[{ toothNumber: 11, startDate: today }], TOOTH_INVALID],
      [[{ toothNumber: null, startDate: today }], TOOTH_INVALID],
      [
        [
          { toothNumber: 36, startDate: today },
          { toothNumber: 36, startDate: today },
        ],
        TOOTH_INVALID,
      ],
      [[{ toothNumber: 36, startDate: shift(today, { days: -1 }) }], START_BEFORE_COMPLETION],
      [[{ toothNumber: 36, startDate: today, months: 0 }], DURATION_INVALID],
      [[{ toothNumber: 36, startDate: today, months: 601 }], DURATION_INVALID],
      [
        [
          { toothNumber: 37, startDate: today, months: 12 },
          { toothNumber: 36, startDate: today, months: 601 },
        ],
        DURATION_INVALID,
      ],
    ];
    for (const [cards, error] of refused) {
      const res = await activateDental<Overview>(page, line, cards);
      expect(res.status, `${JSON.stringify(cards)}: ${res.text}`).toBe(403);
      expect(res.body.error?.code).toBe(error);
    }
    expect((await rowOf(page, line)).dentalCardCount).toBe(0);

    // R36 "Theo danh mục", then R37 for 24 months with both card faces.
    const first = await activateDental<Overview>(page, line, [
      { toothNumber: 36, startDate: today, conditions: `  Điều kiện ${id} ` },
    ]);
    expect(first.status, first.text).toBe(200);
    const again = await activateDental<Overview>(page, line, [
      { toothNumber: 36, startDate: today },
    ]);
    expect(again.status, again.text).toBe(403);
    expect(again.body.error?.code).toBe(TOOTH_INVALID);
    const later = shift(today, { days: 3 });
    const second = await activateWithPhotos(
      page,
      line,
      [{ toothNumber: 37, startDate: later, months: 24 }],
      [
        { tooth: 37, side: CardSide.Front },
        { tooth: 37, side: CardSide.Back },
      ],
    );
    expect(second.status, second.text).toBe(200);

    // Read back with a separate request.
    const reread = await overview(page, line);
    expect(reread.rows.find((one) => one.lineId === line.lineId)).toMatchObject({
      dental: Cell.Activated,
      dentalCardCount: 2,
      dentalPendingTeeth: [],
      group: Group.Activated,
    });
    expect(reread.pendingCount).toBe(before.pendingCount);
    const cards = reread.cards.filter((card) => card.lineId === line.lineId);
    expect(cards.map((card) => card.code)).toEqual([
      cardCode(ready.lineCode, later, 37),
      cardCode(ready.lineCode, today, 36),
    ]);
    expect(cards[1]).toMatchObject({
      kind: Kind.Dental,
      toothNumber: 36,
      startDate: today,
      endDate: shift(today, { days: 365 }),
      durationMonths: null,
      durationDays: 365,
      conditions: `Điều kiện ${id}`,
      photos: [],
    });
    expect(cards[0]).toMatchObject({
      toothNumber: 37,
      startDate: later,
      endDate: shift(later, { months: 24 }),
      durationMonths: 24,
      durationDays: null,
    });
    expect(cards[0].photos.map((photo) => photo.side)).toEqual([CardSide.Front, CardSide.Back]);
    for (const photo of cards[0].photos) expect((await call(page, photo.url)).status).toBe(200);

    // Lịch sử: newest first, each naming the cards it made.
    const events = reread.history.filter((event) => event.lineId === line.lineId);
    expect(events.map((event) => [event.kind, event.teeth, event.cardCodes])).toEqual([
      [Event.DentalActivated, [37], [cards[0].code]],
      [Event.DentalActivated, [36], [cards[1].code]],
    ]);
  });

  test("a line without teeth gets one card coded 00, its Ảnh thẻ named tooth 0", async ({
    page,
  }) => {
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, status: 3 });

    const row = await rowOf(page, line);
    expect(row).toMatchObject({
      teeth: [],
      completedOn: today,
      dental: Cell.Pending,
      dentalPendingTeeth: [null],
    });
    const tooth = await activateDental<Overview>(page, line, [
      { toothNumber: 11, startDate: today },
    ]);
    expect(tooth.body.error?.code).toBe(TOOTH_INVALID);

    const made = await activateWithPhotos(
      page,
      line,
      [{ toothNumber: null, startDate: today }],
      [{ tooth: 0, side: CardSide.Back }],
    );
    expect(made.status, made.text).toBe(200);

    const card = (await overview(page, line)).cards.find((one) => one.lineId === line.lineId);
    expect(card).toMatchObject({ code: cardCode(row.lineCode, today, null), toothNumber: null });
    expect(card!.photos.map((photo) => photo.side)).toEqual([CardSide.Back]);
    expect((await rowOf(page, line)).dental).toBe(Cell.Activated);
  });

  test("Ảnh thẻ must name a card of this activation, each face once — a refused call writes nothing", async ({
    page,
  }) => {
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [46, 47], status: 3 });
    const card46 = [{ toothNumber: 46, startDate: today }];

    // A face the card does not have never reaches the service: model binding refuses it.
    const noSuchFace = await activateWithPhotos(page, line, card46, [{ tooth: 46, side: 3 }]);
    expect(noSuchFace.status, noSuchFace.text).toBe(400);
    expect(noSuchFace.text).toContain("cardPhotoSides");

    const refused: CardPhoto[][] = [
      [{ tooth: 47, side: CardSide.Front }],
      [{ tooth: 0, side: CardSide.Front }],
      [
        { tooth: 46, side: CardSide.Front },
        { tooth: 46, side: CardSide.Front },
      ],
    ];
    for (const photos of refused) {
      const wrong = await activateWithPhotos(page, line, card46, photos);
      expect(wrong.status, wrong.text).toBe(403);
      expect(wrong.body.error?.code).toBe(CARD_PHOTO_INVALID);
    }
    // A tooth and a face with no photo beside them.
    const unpaired = await call(page, dentalWarrantyUrl(line), {
      method: "POST",
      branchId: line.branchId,
      form: {
        "cards[0].toothNumber": 46,
        "cards[0].startDate": today,
        cardPhotoTeeth: [46],
        cardPhotoSides: [CardSide.Front],
      },
    });
    expect(unpaired.status, unpaired.text).toBe(403);
    expect(unpaired.body.error?.code).toBe(CARD_PHOTO_INVALID);

    const after = await overview(page, line);
    expect(after.cards.filter((card) => card.lineId === line.lineId)).toEqual([]);
    expect(after.rows.find((one) => one.lineId === line.lineId)?.dentalPendingTeeth).toEqual([
      46, 47,
    ]);
  });

  test("a service without a warranty period shows – and refuses Bảo hành dịch vụ", async ({
    page,
  }) => {
    const line = await freshLine(page, { service: LABO_SERVICE, teeth: [15], status: 3 });
    expect(await rowOf(page, line)).toMatchObject({
      warrantyDays: 0,
      dental: Cell.None,
      labo: Cell.None,
      group: Group.NotEligible,
    });
    const refused = await activateDental<Overview>(page, line, [
      { toothNumber: 15, startDate: clinicToday() },
    ]);
    expect(refused.status, refused.text).toBe(403);
    expect(refused.body.error?.code).toBe(SERVICE_HAS_NO_WARRANTY);
  });

  test("the Labo cell follows the line's order — QC passed waits, Kích hoạt bảo hành activates (REQ-B3/B7)", async ({
    page,
  }) => {
    const id = runId();
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [11, 21] });
    const catalog = await laboCatalog(page, line.branchId, id);
    const order = await sentOrder(
      page,
      orderBody(catalog, line, id, { treatmentServiceId: line.lineId }),
    );

    const sent = await overview(page, line);
    expect(sent.rows.find((one) => one.lineId === line.lineId)).toMatchObject({
      labo: Cell.NotEligible,
      laboOrderCodes: [order.orderCode],
      laboFitted: false,
    });

    expect((await receive(page, order.id, 2)).status).toBe(200);
    await passAll(page, order.id, [11, 21]);
    expect((await completeLine(page, line)).status).toBe(200);

    const passed = await overview(page, line);
    // The finished line and the order passed without a return each count once.
    expect(passed.tabCount).toBe(sent.tabCount + 2);
    expect(passed.rows.find((one) => one.lineId === line.lineId)).toMatchObject({
      status: 3,
      laboFitted: true,
      labo: Cell.Pending,
      pendingLaboOrderId: order.id,
      dental: Cell.Pending,
      group: Group.Ready,
    });

    const labo = await activateWarranty(page, order.id, [
      { toothNumber: 11, startDate: today, months: 12, manufacturerSerial: `SN-${id}` },
      { toothNumber: 21, startDate: today, months: 12 },
    ]);
    expect(labo.status, labo.text).toBe(200);

    const activated = await overview(page, line);
    expect(activated.rows.find((one) => one.lineId === line.lineId)).toMatchObject({
      labo: Cell.Activated,
      laboCardCount: 2,
      pendingLaboOrderId: null,
      // Nha khoa still waits: the Labo cards do not stand for the dental ones.
      dental: Cell.Pending,
      group: Group.Ready,
    });
    const cards = activated.cards.filter((card) => card.lineId === line.lineId);
    expect(
      cards.map((card) => [card.kind, card.toothNumber, card.laboOrderCode, card.supplierName]),
    ).toEqual([
      [Kind.Labo, 11, order.orderCode, catalog.supplierName],
      [Kind.Labo, 21, order.orderCode, catalog.supplierName],
    ]);
    expect(cards[0]).toMatchObject({ durationMonths: 12, endDate: shift(today, { months: 12 }) });

    const events = activated.history.filter((event) => event.lineId === line.lineId);
    expect(events.map((event) => [event.kind, event.teeth, event.laboOrderCode])).toEqual([
      [Event.LaboActivated, [11, 21], order.orderCode],
      [Event.LaboPassed, [11, 21], order.orderCode],
    ]);
    expect(events[0].cardCodes).toEqual(cards.map((card) => card.code));
  });

  test("a warranty công đoạn shows as Yêu cầu bảo hành, opened then done, naming the line's cards", async ({
    page,
  }) => {
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [26] });
    const root = await addStage(page, line, [26]);
    // Closing the line's last công đoạn finishes it (status 3); G16: on that công đoạn's day.
    await closeStage(page, line, root);
    const row = await rowOf(page, line);
    expect(row.status).toBe(3);
    expect(row.completedOn).toBe(today);
    expect(
      (await activateDental<Overview>(page, line, [{ toothNumber: 26, startDate: today }])).status,
    ).toBe(200);

    const before = await overview(page, line);
    const request = await addStage(page, line, [26], { source: root, kind: WarrantyKind.Dental });
    const opened = await overview(page, line);
    expect(opened.openRequests).toBe(before.openRequests + 1);
    await closeStage(page, line, request);
    const closed = await overview(page, line);
    expect(closed.openRequests).toBe(before.openRequests);
    expect(closed.doneRequests).toBe(before.doneRequests + 1);

    const code26 = cardCode(row.lineCode, today, 26);
    const events = closed.history.filter((event) => event.lineId === line.lineId);
    expect(events.map((event) => [event.kind, event.teeth, event.cardCodes])).toEqual([
      [Event.RequestDone, [26], [code26]],
      [Event.RequestOpened, [26], [code26]],
      [Event.DentalActivated, [26], [code26]],
    ]);
    expect(events[0].stageName).toBe(line.serviceName);
    expect(events[0].staffName).toBeTruthy();
  });

  test("another branch and an account without the grants get 403 and change nothing", async ({
    page,
    browser,
  }) => {
    const id = runId();
    const today = clinicToday();
    const line = await freshLine(page, { service: WARRANTY_SERVICE, teeth: [44], status: 3 });
    const body = { cards: [{ toothNumber: 44, startDate: today }] };

    // branch2 holds the admin abilities but works in branch two only. It
    // sends no branch header: the header itself is not trusted yet (open gap,
    // memory branch-header-trust-gap / R-1064 proposal).
    const elsewhere = await openSession(browser, BRANCH2_USER);
    try {
      expect((await call(elsewhere.page, overviewUrl(line))).status).toBe(403);
      expect(
        (await call(elsewhere.page, dentalWarrantyUrl(line), { method: "POST", json: body }))
          .status,
      ).toBe(403);
    } finally {
      await elsewhere.context.close();
    }

    const userName = `bh${id}`;
    const password = "Warranty@123456";
    const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
      method: "POST",
      json: {
        userName,
        password,
        name: `Bảo hành không quyền ${id}`,
        email: `${userName}@bluedental.local`,
        roleNames: ["dentist"],
        branchIds: [line.branchId],
        isActive: true,
      },
    });
    expect(staff.status, staff.text).toBe(200);
    const other = await openSession(browser, { userName, password });
    try {
      const read = await call(other.page, overviewUrl(line), { branchId: line.branchId });
      expect(read.status, read.text).toBe(403);
      const write = await call(other.page, dentalWarrantyUrl(line), {
        method: "POST",
        branchId: line.branchId,
        json: body,
      });
      expect(write.status, write.text).toBe(403);
    } finally {
      await other.context.close();
      await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
    }

    const after = await rowOf(page, line);
    expect(after).toMatchObject({
      dentalCardCount: 0,
      dentalPendingTeeth: [44],
      group: Group.Ready,
    });
  });
});
